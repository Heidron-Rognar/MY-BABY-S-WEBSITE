/**
 * Caption Studio — Cloudflare Worker
 *
 *  • Serves the website (static files in /public)
 *  • JSON API for captions / settings  (/api/*)
 *  • Telegram bot webhook               (/telegram/webhook)
 *  • Cron job that sends posting reminders + a daily digest to Telegram
 */

import { Buffer } from "node:buffer";
import { getEsvVerse } from "./esv.js";
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  normalizePostInput,
  computeDueReminders,
  relativeLabel,
  formatInZone,
  zonedParts,
  escapeHtml,
  truncate,
  STATUSES,
  MAX_REMINDER_MIN,
  MAX_IMAGES_PER_POST,
  MAX_IMAGE_BYTES,
  MAX_THUMB_BYTES,
  CONTENT_TYPES_VERSION,
} from "./lib.js";

const enc = new TextEncoder();
const SESSION_COOKIE = "cs_session";
const SESSION_DAYS = 30;
const NUDGE_AFTER_MIN = 120; // "Did you post it?" nudge, 2h after the scheduled time
const NUDGE_OFFSET = -NUDGE_AFTER_MIN; // stored in reminders_sent as a negative offset

/* ------------------------------------------------------------------ */
/* Database                                                            */
/* ------------------------------------------------------------------ */

let schemaPromise = null;
function ensureSchema(env) {
  if (!schemaPromise) {
    schemaPromise = env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL DEFAULT '',
        caption TEXT NOT NULL DEFAULT '',
        content_type TEXT NOT NULL DEFAULT '',
        platforms TEXT NOT NULL DEFAULT '[]',
        scheduled_at TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        notes TEXT NOT NULL DEFAULT '',
        posted_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_posts_scheduled ON posts(scheduled_at)`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS reminders_sent (
        post_id INTEGER NOT NULL,
        offset_min INTEGER NOT NULL,
        scheduled_at TEXT NOT NULL,
        sent_at TEXT NOT NULL,
        PRIMARY KEY (post_id, offset_min, scheduled_at)
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        mime TEXT NOT NULL,
        width INTEGER,
        height INTEGER,
        size INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        thumb TEXT,
        data TEXT NOT NULL
      )`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_images_post ON images(post_id, position)`),
    ])
      .then(async () => {
        // Lightweight migrations for databases created by older versions of the app.
        const { results } = await env.DB.prepare("PRAGMA table_info(posts)").all();
        const cols = new Set(results.map((c) => c.name));
        if (!cols.has("reminder_offsets")) {
          await env.DB.prepare("ALTER TABLE posts ADD COLUMN reminder_offsets TEXT").run();
        }
        // Archive: hides posted captions from the Posted list without deleting anything.
        if (!cols.has("archived_at")) {
          await env.DB.prepare("ALTER TABLE posts ADD COLUMN archived_at TEXT").run();
        }
        // One-time switch to the new default content types (later edits in Settings are kept).
        const ver = await env.DB.prepare("SELECT value FROM settings WHERE key = 'content_types_version'").first();
        if (!ver || Number(JSON.parse(ver.value)) < CONTENT_TYPES_VERSION) {
          const upsert = "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value";
          await env.DB.batch([
            env.DB.prepare(upsert).bind("content_types", JSON.stringify(DEFAULT_SETTINGS.content_types)),
            env.DB.prepare(upsert).bind("content_types_version", JSON.stringify(CONTENT_TYPES_VERSION)),
          ]);
        }
      })
      .catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}

async function getSettings(env) {
  const { results } = await env.DB.prepare("SELECT key, value FROM settings").all();
  const raw = {};
  for (const row of results) {
    try {
      raw[row.key] = JSON.parse(row.value);
    } catch {
      /* ignore broken rows */
    }
  }
  return normalizeSettings(raw);
}

async function saveSettings(env, partial) {
  const stmts = Object.entries(partial).map(([k, v]) =>
    env.DB.prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).bind(k, JSON.stringify(v))
  );
  if (stmts.length) await env.DB.batch(stmts);
}

function parseJson(value, fallback) {
  try {
    return value == null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function rowToPost(row, images = []) {
  const reminder_offsets = parseJson(row.reminder_offsets, null);
  return {
    ...row,
    platforms: parseJson(row.platforms, []),
    reminder_offsets: Array.isArray(reminder_offsets) ? reminder_offsets : null,
    images,
  };
}

const IMAGE_META_COLS = "id, post_id, position, mime, width, height, size";
const imageMeta = (r) => ({ id: r.id, width: r.width, height: r.height, size: r.size, mime: r.mime });

/** Image metadata (no bytes) grouped by post id. Pass null to load for every post. */
async function imagesByPost(env, postIds = null) {
  const stmt =
    postIds === null
      ? env.DB.prepare(`SELECT ${IMAGE_META_COLS} FROM images ORDER BY post_id, position, id`)
      : env.DB.prepare(
          `SELECT ${IMAGE_META_COLS} FROM images WHERE post_id IN (SELECT value FROM json_each(?)) ORDER BY post_id, position, id`
        ).bind(JSON.stringify(postIds));
  const { results } = await stmt.all();
  const map = new Map();
  for (const r of results) {
    if (!map.has(r.post_id)) map.set(r.post_id, []);
    map.get(r.post_id).push(imageMeta(r));
  }
  return map;
}

async function withImages(env, rows) {
  if (!rows.length) return [];
  const map = await imagesByPost(env, rows.map((r) => r.id));
  return rows.map((r) => rowToPost(r, map.get(r.id) || []));
}

async function getPost(env, id) {
  const row = await env.DB.prepare("SELECT * FROM posts WHERE id = ?").bind(id).first();
  return row ? (await withImages(env, [row]))[0] : null;
}

/* ---------- base64 helpers (images are stored as base64 text in D1) ----------
 * Node's native Buffer is ~30x faster than doing this in plain JS, which keeps each
 * request well inside the free plan's 10 ms CPU limit. */

const bytesToBase64 = (bytes) => Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64");
const base64ToBytes = (b64) => Buffer.from(b64, "base64");

/** Signed, expiring link so Telegram can download a photo without logging in. */
const imageSig = (env, id, exp) => hmac(`${env.TELEGRAM_BOT_TOKEN}|${env.APP_PASSWORD}`, `img:${id}:${exp}`);
async function signedImageUrl(env, origin, id) {
  const exp = Date.now() + 3 * 3600e3;
  return `${origin}/telegram/image/${id}?exp=${exp}&sig=${await imageSig(env, id, exp)}`;
}

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

async function setPostStatus(env, id, status) {
  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE posts SET status = ?, updated_at = ?,
       posted_at = CASE WHEN ? = 'posted' THEN COALESCE(posted_at, ?) ELSE NULL END
     WHERE id = ?`
  )
    .bind(status, now, status, now, id)
    .run();
}

/* ------------------------------------------------------------------ */
/* Crypto helpers (sessions + Telegram link codes)                     */
/* ------------------------------------------------------------------ */

function b64url(buf) {
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(key, message) {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return b64url(await crypto.subtle.sign("HMAC", k, enc.encode(message)));
}

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function makeSession(env) {
  const exp = Date.now() + SESSION_DAYS * 864e5;
  return `${exp}.${await hmac(env.APP_PASSWORD, `session:${exp}`)}`;
}

async function isAuthed(request, env) {
  if (!env.APP_PASSWORD) return false;
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (!match) return false;
  const [expStr, sig] = decodeURIComponent(match[1]).split(".");
  const exp = Number(expStr);
  if (!exp || exp < Date.now()) return false;
  return safeEqual(sig, await hmac(env.APP_PASSWORD, `session:${exp}`));
}

// EMBEDDED_PREVIEW=1 (local testing only, set in .dev.vars) lets the login cookie
// work when the site is shown inside another page's frame (e.g. a preview window).
// Production keeps the stricter SameSite=Lax.
function sessionCookie(value, maxAge, secure, embedded) {
  const site = embedded ? "SameSite=None; Secure; Partitioned" : `SameSite=Lax${secure ? "; Secure" : ""}`;
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; ${site}; Max-Age=${maxAge}`;
}

const webhookSecret = (env) => hmac(env.TELEGRAM_BOT_TOKEN, "webhook-secret");
const linkCode = async (env) => (await hmac(`${env.TELEGRAM_BOT_TOKEN}|${env.APP_PASSWORD}`, "link")).slice(0, 24);

/* ------------------------------------------------------------------ */
/* HTTP helpers                                                        */
/* ------------------------------------------------------------------ */

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

const error = (message, status = 400) => json({ error: message }, status);

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Telegram                                                            */
/* ------------------------------------------------------------------ */

async function tg(env, method, payload) {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN secret is not set");
  const base = env.TELEGRAM_API_BASE || "https://api.telegram.org"; // override only for local testing
  const res = await fetch(`${base}/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({ ok: false, description: `HTTP ${res.status}` }));
  if (!data.ok) throw new Error(data.description || "Telegram API error");
  return data.result;
}

/** Telegram call with file uploads (multipart). `files` = { name: { bytes, mime, filename } }. */
async function tgUpload(env, method, fields, files) {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN secret is not set");
  const base = env.TELEGRAM_API_BASE || "https://api.telegram.org";
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, typeof v === "string" ? v : JSON.stringify(v));
  for (const [name, f] of Object.entries(files)) form.append(name, new Blob([f.bytes], { type: f.mime }), f.filename);
  const res = await fetch(`${base}/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, { method: "POST", body: form });
  const data = await res.json().catch(() => ({ ok: false, description: `HTTP ${res.status}` }));
  if (!data.ok) throw new Error(data.description || "Telegram API error");
  return data.result;
}

/** Send a post's images to Telegram: one photo, or an album of up to 10. */
async function sendPostImages(env, chatId, post, settings) {
  if (!post.images?.length) return;
  const ids = post.images.slice(0, 10).map((i) => i.id);
  const origin = settings?.app_url;
  if (origin && origin.startsWith("https://")) {
    // Preferred: give Telegram signed links. Telegram downloads each photo in its own request,
    // so this run doesn't have to load all the photos at once (keeps us within free CPU limits).
    const urls = await Promise.all(ids.map((id) => signedImageUrl(env, origin, id)));
    if (urls.length === 1) await tg(env, "sendPhoto", { chat_id: chatId, photo: urls[0] });
    else await tg(env, "sendMediaGroup", { chat_id: chatId, media: urls.map((u) => ({ type: "photo", media: u })) });
    return;
  }
  // Fallback (local testing without a public https address): upload the files directly.
  const { results } = await env.DB.prepare(
    "SELECT id, mime, data FROM images WHERE id IN (SELECT value FROM json_each(?)) ORDER BY position, id"
  )
    .bind(JSON.stringify(ids))
    .all();
  if (!results.length) return;
  const ext = (m) => (m === "image/png" ? "png" : m === "image/webp" ? "webp" : m === "image/gif" ? "gif" : "jpg");
  const files = {};
  results.forEach((r, i) => {
    files[`photo${i}`] = { bytes: base64ToBytes(r.data), mime: r.mime, filename: `post-${post.id}-${i + 1}.${ext(r.mime)}` };
  });
  if (results.length === 1) {
    await tgUpload(env, "sendPhoto", { chat_id: String(chatId) }, { photo: files.photo0 });
  } else {
    const media = results.map((_, i) => ({ type: "photo", media: `attach://photo${i}` }));
    await tgUpload(env, "sendMediaGroup", { chat_id: String(chatId), media }, files);
  }
}

const sendMessage = (env, chatId, text, extra = {}) =>
  tg(env, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...extra,
  });

function postKeyboard(post, settings) {
  const row = [{ text: "✅ Mark as posted", callback_data: `posted:${post.id}` }];
  if (settings.app_url && settings.app_url.startsWith("https://")) {
    row.push({ text: "✏️ Open", url: `${settings.app_url}/#post/${post.id}` });
  }
  return { inline_keyboard: [row] };
}

function postMeta(post) {
  const bits = [];
  if (post.content_type) bits.push(`🎬 ${escapeHtml(post.content_type)}`);
  if (post.platforms?.length) bits.push(`📱 ${escapeHtml(post.platforms.join(", "))}`);
  return bits.join("  ·  ");
}

function reminderText(post, settings, now) {
  const sched = new Date(post.scheduled_at);
  const label = relativeLabel(sched.getTime() - now, settings.timezone, now, sched.getTime());
  const isNow = sched.getTime() - now <= 5 * 60e3;
  const lines = [];
  lines.push(isNow ? "🚀 <b>Time to post!</b>" : `⏰ <b>Posting ${escapeHtml(label)}</b>`);
  lines.push(`🗓 ${escapeHtml(formatInZone(sched, settings.timezone))}`);
  const meta = postMeta(post);
  if (meta) lines.push(meta);
  if (post.title) lines.push(`\n<b>${escapeHtml(post.title)}</b>`);
  if (!isNow && post.caption) lines.push(`\n<i>${escapeHtml(truncate(post.caption, 280))}</i>`);
  const nImg = post.images?.length || 0;
  if (nImg && !isNow) lines.push(`🖼 ${nImg} image${nImg === 1 ? "" : "s"} attached — I'll send ${nImg === 1 ? "it" : "them"} at posting time.`);
  if (post.status !== "ready" && !isNow) lines.push(`\n⚠️ Status: <b>${escapeHtml(post.status)}</b> — caption not marked ready yet.`);
  if (isNow && (post.caption || nImg)) {
    const parts = [nImg ? (nImg === 1 ? "your image" : `your ${nImg} images`) : "", post.caption ? "the caption (long-press to copy)" : ""].filter(Boolean);
    lines.push(`\n👇 Next: ${parts.join(", then ")}.`);
  }
  return { text: lines.join("\n"), isNow };
}

async function sendReminder(env, chatId, post, settings, now) {
  const { text, isNow } = reminderText(post, settings, now);
  await sendMessage(env, chatId, text, { reply_markup: postKeyboard(post, settings) });
  if (isNow) {
    try {
      await sendPostImages(env, chatId, post, settings);
    } catch (err) {
      console.error("sending images failed", post.id, err);
      await sendMessage(env, chatId, `⚠️ Couldn't send the images (${escapeHtml(err.message)}). Open the website to download them.`).catch(() => {});
    }
  }
  if (isNow && post.caption) {
    // Plain message containing only the caption so it can be copied in one go.
    await tg(env, "sendMessage", { chat_id: chatId, text: post.caption.slice(0, 4096) });
  }
}

function listForTelegram(posts, settings, heading) {
  if (!posts.length) return `${heading}\n\nNothing scheduled. 🌿`;
  const lines = [heading, ""];
  for (const p of posts) {
    const when = formatInZone(new Date(p.scheduled_at), settings.timezone);
    const done = p.status === "posted" ? "✅ " : p.status === "ready" ? "🟢 " : "📝 ";
    const name = p.title || truncate(p.caption.replace(/\s+/g, " "), 50) || "(no caption yet)";
    const meta = [p.content_type, p.platforms?.join("/")].filter(Boolean).join(" · ");
    lines.push(`${done}<b>${escapeHtml(when)}</b> — ${escapeHtml(name)}${meta ? `\n      <i>${escapeHtml(meta)}</i>` : ""}`);
  }
  lines.push("", "🟢 ready  📝 draft  ✅ posted");
  return lines.join("\n");
}

async function postsBetween(env, fromIso, toIso) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM posts WHERE scheduled_at IS NOT NULL AND scheduled_at >= ? AND scheduled_at < ? ORDER BY scheduled_at"
  )
    .bind(fromIso, toIso)
    .all();
  return withImages(env, results);
}

/** Start/end of "today" in the configured time zone, as UTC Date objects. */
function zonedDayRange(timezone, now, days = 1) {
  const p = zonedParts(new Date(now), timezone);
  // Offset of the zone at this instant (ms): local wall time minus UTC.
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const offset = asUtc - Math.floor(now / 1000) * 1000;
  const start = Date.UTC(p.year, p.month - 1, p.day) - offset;
  return { start: new Date(start), end: new Date(start + days * 864e5) };
}

async function handleWebhook(request, env) {
  if (!env.TELEGRAM_BOT_TOKEN) return new Response("not configured", { status: 404 });
  const secret = request.headers.get("x-telegram-bot-api-secret-token") || "";
  if (!safeEqual(secret, await webhookSecret(env))) return new Response("forbidden", { status: 403 });

  await ensureSchema(env);
  const update = await readJson(request);
  if (!update) return new Response("ok");
  const settings = await getSettings(env);

  try {
    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = String(cq.message?.chat?.id ?? "");
      if (!settings.telegram_chat_id || chatId !== String(settings.telegram_chat_id)) {
        await tg(env, "answerCallbackQuery", { callback_query_id: cq.id, text: "Not allowed." });
        return new Response("ok");
      }
      const [action, idStr] = String(cq.data || "").split(":");
      const id = Number(idStr);
      if (action === "posted" && id) {
        const post = await getPost(env, id);
        if (!post) {
          await tg(env, "answerCallbackQuery", { callback_query_id: cq.id, text: "That post no longer exists." });
        } else {
          await setPostStatus(env, id, "posted");
          await tg(env, "answerCallbackQuery", { callback_query_id: cq.id, text: "Marked as posted 🎉" });
          await tg(env, "editMessageReplyMarkup", {
            chat_id: cq.message.chat.id,
            message_id: cq.message.message_id,
            reply_markup: { inline_keyboard: [[{ text: "✅ Posted — nice work!", callback_data: "noop:0" }]] },
          }).catch(() => {});
        }
      } else {
        await tg(env, "answerCallbackQuery", { callback_query_id: cq.id });
      }
      return new Response("ok");
    }

    const msg = update.message;
    if (!msg || typeof msg.text !== "string") return new Response("ok");
    const chatId = String(msg.chat.id);
    const text = msg.text.trim();
    const [rawCmd, arg] = text.split(/\s+/, 2);
    const cmd = rawCmd.toLowerCase().replace(/@.*$/, "");

    if (cmd === "/start" && arg) {
      if (safeEqual(arg, await linkCode(env))) {
        await saveSettings(env, { telegram_chat_id: chatId });
        await sendMessage(
          env,
          chatId,
          "✅ <b>Connected!</b>\n\nI'll remind you here before each scheduled post.\n\nCommands:\n/today — today's posts\n/week — next 7 days\n/next — the next post"
        );
      } else {
        await sendMessage(env, chatId, "That link code isn't valid. Open the link from the website's Settings page again.");
      }
      return new Response("ok");
    }

    if (!settings.telegram_chat_id || chatId !== String(settings.telegram_chat_id)) {
      await sendMessage(env, chatId, "🔒 This is a private reminder bot.");
      return new Response("ok");
    }

    const now = Date.now();
    if (cmd === "/today") {
      const { start, end } = zonedDayRange(settings.timezone, now);
      const posts = await postsBetween(env, start.toISOString(), end.toISOString());
      await sendMessage(env, chatId, listForTelegram(posts, settings, "📅 <b>Today</b>"));
    } else if (cmd === "/week") {
      const { start, end } = zonedDayRange(settings.timezone, now, 7);
      const posts = await postsBetween(env, start.toISOString(), end.toISOString());
      await sendMessage(env, chatId, listForTelegram(posts, settings, "🗓 <b>Next 7 days</b>"));
    } else if (cmd === "/next") {
      const row = await env.DB.prepare(
        "SELECT * FROM posts WHERE scheduled_at >= ? AND status != 'posted' ORDER BY scheduled_at LIMIT 1"
      )
        .bind(new Date(now).toISOString())
        .first();
      if (!row) await sendMessage(env, chatId, "Nothing coming up. Time to plan some content! ✨");
      else await sendReminder(env, chatId, (await withImages(env, [row]))[0], settings, now);
    } else {
      await sendMessage(env, chatId, "Hi! 👋\n/today — today's posts\n/week — next 7 days\n/next — the next post");
    }
  } catch (err) {
    console.error("webhook error", err);
  }
  return new Response("ok");
}

async function serveSignedImage(env, url, id) {
  const exp = Number(url.searchParams.get("exp"));
  const sig = url.searchParams.get("sig") || "";
  if (!env.TELEGRAM_BOT_TOKEN || !env.APP_PASSWORD || !exp || exp < Date.now()) return new Response("expired", { status: 403 });
  if (!safeEqual(sig, await imageSig(env, id, exp))) return new Response("forbidden", { status: 403 });
  await ensureSchema(env);
  const row = await env.DB.prepare("SELECT mime, data FROM images WHERE id = ?").bind(id).first();
  if (!row) return new Response("not found", { status: 404 });
  return new Response(base64ToBytes(row.data), { headers: { "content-type": row.mime, "cache-control": "private, max-age=3600" } });
}

/* ------------------------------------------------------------------ */
/* Cron: reminders + daily digest                                      */
/* ------------------------------------------------------------------ */

export async function runScheduled(env, now = Date.now()) {
  await ensureSchema(env);
  const settings = await getSettings(env);
  const chatId = settings.telegram_chat_id;
  const report = { reminders: 0, nudges: 0, digest: false, errors: [] };
  if (!env.TELEGRAM_BOT_TOKEN || !chatId) return report;

  const lower = new Date(now - (settings.nudge_unposted ? 26 * 60 : 30) * 60e3).toISOString();
  // Posts can have their own custom reminder times (up to 14 days before), so look that far ahead.
  const upper = new Date(now + (MAX_REMINDER_MIN + 1) * 60e3).toISOString();

  const { results } = await env.DB.prepare(
    "SELECT * FROM posts WHERE status != 'posted' AND scheduled_at IS NOT NULL AND scheduled_at >= ? AND scheduled_at <= ? ORDER BY scheduled_at"
  )
    .bind(lower, upper)
    .all();
  const posts = await withImages(env, results);

  if (posts.length) {
    const ids = JSON.stringify(posts.map((p) => p.id));
    const sentRows = (
      await env.DB.prepare(
        "SELECT post_id, offset_min, scheduled_at FROM reminders_sent WHERE post_id IN (SELECT value FROM json_each(?))"
      )
        .bind(ids)
        .all()
    ).results;
    const sent = new Set(sentRows.map((r) => `${r.post_id}|${r.offset_min}|${r.scheduled_at}`));

    for (const post of posts) {
      const offsets = Array.isArray(post.reminder_offsets) ? post.reminder_offsets : settings.reminder_offsets;
      const { due, nudge, markAlso } = computeDueReminders(post, offsets, sent, now, {
        nudgeAfterMin: settings.nudge_unposted ? NUDGE_AFTER_MIN : null,
        nudgeOffset: NUDGE_OFFSET,
      });
      try {
        if (due.length) {
          await sendReminder(env, chatId, post, settings, now);
          report.reminders++;
          await markSent(env, post, [...due, ...markAlso], now);
        } else if (nudge) {
          const text = [
            "🤔 <b>Did you post this?</b>",
            `🗓 Was scheduled for ${escapeHtml(formatInZone(new Date(post.scheduled_at), settings.timezone))}`,
            postMeta(post),
            post.title ? `\n<b>${escapeHtml(post.title)}</b>` : "",
            post.caption ? `<i>${escapeHtml(truncate(post.caption, 200))}</i>` : "",
          ]
            .filter(Boolean)
            .join("\n");
          await sendMessage(env, chatId, text, { reply_markup: postKeyboard(post, settings) });
          report.nudges++;
          await markSent(env, post, [NUDGE_OFFSET], now);
        }
      } catch (err) {
        report.errors.push(`post ${post.id}: ${err.message}`);
        console.error("reminder failed", post.id, err);
      }
    }
  }

  // Daily digest at the configured local hour.
  if (settings.digest_hour >= 0) {
    const p = zonedParts(new Date(now), settings.timezone);
    const todayKey = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
    if (p.hour === settings.digest_hour && settings.last_digest !== todayKey) {
      const { start, end } = zonedDayRange(settings.timezone, now);
      const today = await postsBetween(env, start.toISOString(), end.toISOString());
      if (today.length || settings.digest_when_empty) {
        try {
          await sendMessage(env, chatId, listForTelegram(today, settings, "☀️ <b>Good morning! Today's posts</b>"));
          report.digest = true;
        } catch (err) {
          report.errors.push(`digest: ${err.message}`);
        }
      }
      await saveSettings(env, { last_digest: todayKey });
    }
  }
  return report;
}

async function markSent(env, post, offsets, now) {
  const sentAt = new Date(now).toISOString();
  await env.DB.batch(
    offsets.map((o) =>
      env.DB.prepare(
        "INSERT OR IGNORE INTO reminders_sent (post_id, offset_min, scheduled_at, sent_at) VALUES (?, ?, ?, ?)"
      ).bind(post.id, o, post.scheduled_at, sentAt)
    )
  );
}

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

async function handleApi(request, env, url) {
  const path = url.pathname.replace(/\/+$/, "");
  const method = request.method;
  const secure = url.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  const embedded = env.EMBEDDED_PREVIEW === "1";

  if (!env.APP_PASSWORD) {
    return error("The APP_PASSWORD secret is not set yet. See README → Setup.", 503);
  }

  if (path === "/api/login" && method === "POST") {
    const body = (await readJson(request)) || {};
    const given = await hmac("login-compare", String(body.password ?? ""));
    const expected = await hmac("login-compare", env.APP_PASSWORD);
    if (!safeEqual(given, expected)) {
      await new Promise((r) => setTimeout(r, 600)); // slow down guessing
      return error("Wrong password", 401);
    }
    return json({ ok: true }, 200, { "set-cookie": sessionCookie(await makeSession(env), SESSION_DAYS * 86400, secure, embedded) });
  }

  if (path === "/api/logout" && method === "POST") {
    return json({ ok: true }, 200, { "set-cookie": sessionCookie("", 0, secure, embedded) });
  }

  if (!(await isAuthed(request, env))) return error("Not logged in", 401);

  // Shared server-side scripture cache; no database migration is needed.
  if (path === "/api/verse" && method === "GET") {
    const result = await getEsvVerse(url.searchParams.get("reference"), env);
    return json(result.body, result.status);
  }
  await ensureSchema(env);

  // Remember the public URL so Telegram buttons can link back to the site.
  const origin = url.origin;

  if (path === "/api/me" && method === "GET") {
    const settings = await getSettings(env);
    if (origin.startsWith("https://") && settings.app_url !== origin) await saveSettings(env, { app_url: origin });
    return json({ ok: true, settings: publicSettings(settings), statuses: STATUSES });
  }

  /* ---------- posts ---------- */
  if (path === "/api/posts" && method === "GET") {
    const { results } = await env.DB.prepare(
      "SELECT * FROM posts ORDER BY CASE WHEN scheduled_at IS NULL THEN 1 ELSE 0 END, scheduled_at, id DESC"
    ).all();
    const imgs = await imagesByPost(env);
    return json({ posts: results.map((r) => rowToPost(r, imgs.get(r.id) || [])) });
  }

  if (path === "/api/posts" && method === "POST") {
    const input = normalizePostInput((await readJson(request)) || {});
    if (input.error) return error(input.error);
    const now = new Date().toISOString();
    const p = input.value;
    const row = await env.DB.prepare(
      `INSERT INTO posts (title, caption, content_type, platforms, scheduled_at, status, notes, posted_at, reminder_offsets, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
    )
      .bind(
        p.title,
        p.caption,
        p.content_type,
        JSON.stringify(p.platforms),
        p.scheduled_at,
        p.status,
        p.notes,
        p.status === "posted" ? now : null,
        p.reminder_offsets ? JSON.stringify(p.reminder_offsets) : null,
        now,
        now
      )
      .first();
    return json({ post: rowToPost(row) }, 201);
  }

  // Archive / unarchive posted captions: { archived: true|false, ids: [1,2,3] } or { archived, all: true }.
  // Only posts marked "posted" can be archived.
  if (path === "/api/posts/archive" && method === "POST") {
    const body = (await readJson(request)) || {};
    const archived = body.archived !== false;
    const stamp = archived ? new Date().toISOString() : null;
    const base = archived
      ? "UPDATE posts SET archived_at = ? WHERE status = 'posted' AND archived_at IS NULL"
      : "UPDATE posts SET archived_at = ? WHERE status = 'posted' AND archived_at IS NOT NULL";
    let updated = 0;
    if (body.all === true) {
      const r = await env.DB.prepare(base).bind(stamp).run();
      updated = r.meta?.changes ?? 0;
    } else {
      const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
      if (!ids.length) return error("Pick at least one post");
      if (ids.length > 1000) return error("Too many posts at once");
      // D1 allows max 100 bound values per statement, so go in chunks.
      const stmts = [];
      for (let i = 0; i < ids.length; i += 90) {
        const chunk = ids.slice(i, i + 90);
        stmts.push(env.DB.prepare(`${base} AND id IN (${chunk.map(() => "?").join(",")})`).bind(stamp, ...chunk));
      }
      const results = await env.DB.batch(stmts);
      updated = results.reduce((n, r) => n + (r.meta?.changes ?? 0), 0);
    }
    return json({ ok: true, updated });
  }

  const postMatch = path.match(/^\/api\/posts\/(\d+)$/);
  if (postMatch) {
    const id = Number(postMatch[1]);
    const existing = await getPost(env, id);
    if (!existing) return error("Post not found", 404);

    if (method === "GET") return json({ post: existing });

    if (method === "PUT" || method === "PATCH") {
      const body = (await readJson(request)) || {};
      const merged = method === "PATCH" ? { ...existing, ...body } : body;
      const input = normalizePostInput({ ...merged, has_images: Boolean(body.has_images) || existing.images.length > 0 });
      if (input.error) return error(input.error);
      const p = input.value;
      const now = new Date().toISOString();
      const postedAt = p.status === "posted" ? existing.posted_at || now : null;
      const row = await env.DB.prepare(
        `UPDATE posts SET title = ?, caption = ?, content_type = ?, platforms = ?, scheduled_at = ?, status = ?,
           notes = ?, posted_at = ?, reminder_offsets = ?, updated_at = ?,
           archived_at = CASE WHEN ? = 'posted' THEN archived_at ELSE NULL END
         WHERE id = ? RETURNING *`
      )
        .bind(
          p.title,
          p.caption,
          p.content_type,
          JSON.stringify(p.platforms),
          p.scheduled_at,
          p.status,
          p.notes,
          postedAt,
          p.reminder_offsets ? JSON.stringify(p.reminder_offsets) : null,
          now,
          p.status,
          id
        )
        .first();
      return json({ post: rowToPost(row, existing.images) });
    }

    if (method === "DELETE") {
      await env.DB.batch([
        env.DB.prepare("DELETE FROM posts WHERE id = ?").bind(id),
        env.DB.prepare("DELETE FROM reminders_sent WHERE post_id = ?").bind(id),
        env.DB.prepare("DELETE FROM images WHERE post_id = ?").bind(id),
      ]);
      return json({ ok: true });
    }
  }

  /* ---------- images ---------- */
  const imgUpload = path.match(/^\/api\/posts\/(\d+)\/images$/);
  if (imgUpload && method === "POST") {
    const postId = Number(imgUpload[1]);
    const exists = await env.DB.prepare("SELECT id FROM posts WHERE id = ?").bind(postId).first();
    if (!exists) return error("Post not found", 404);
    const count = (await env.DB.prepare("SELECT COUNT(*) AS n FROM images WHERE post_id = ?").bind(postId).first()).n;
    if (count >= MAX_IMAGES_PER_POST) return error(`Max ${MAX_IMAGES_PER_POST} images per post`);

    let form;
    try {
      form = await request.formData();
    } catch {
      return error("Expected an image upload");
    }
    const file = form.get("image");
    const thumb = form.get("thumb");
    if (!file || typeof file === "string") return error("No image received");
    if (!IMAGE_TYPES.has(file.type)) return error("Only JPG, PNG, WebP or GIF images are supported");
    if (file.size > MAX_IMAGE_BYTES) return error(`Image is too large (max ${(MAX_IMAGE_BYTES / 1e6).toFixed(1)} MB after resizing)`);
    const bytes = new Uint8Array(await file.arrayBuffer());
    let thumbB64 = null;
    if (thumb && typeof thumb !== "string" && IMAGE_TYPES.has(thumb.type) && thumb.size <= MAX_THUMB_BYTES) {
      thumbB64 = bytesToBase64(new Uint8Array(await thumb.arrayBuffer()));
    }
    const int = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : null);
    let row;
    try {
      row = await env.DB.prepare(
        `INSERT INTO images (post_id, position, mime, width, height, size, data, thumb, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING ${IMAGE_META_COLS}`
      )
        .bind(postId, count, file.type, int(form.get("width")), int(form.get("height")), bytes.length, bytesToBase64(bytes), thumbB64, new Date().toISOString())
        .first();
    } catch (err) {
      if (/maximum DB size|SQLITE_FULL|database or disk is full/i.test(String(err.message))) {
        return error("Storage is full (free database limit is 500 MB). Free up space in Settings → Storage.", 507);
      }
      throw err;
    }
    return json({ image: imageMeta(row) }, 201);
  }

  if (imgUpload && method === "PUT") {
    // Reorder: { ids: [3, 1, 2] }
    const postId = Number(imgUpload[1]);
    const body = (await readJson(request)) || {};
    const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(Boolean) : [];
    if (ids.length) {
      await env.DB.batch(
        ids.map((imgId, i) => env.DB.prepare("UPDATE images SET position = ? WHERE id = ? AND post_id = ?").bind(i, imgId, postId))
      );
    }
    return json({ images: (await imagesByPost(env, [postId])).get(postId) || [] });
  }

  const imgMatch = path.match(/^\/api\/images\/(\d+)$/);
  if (imgMatch && method === "GET") {
    const wantThumb = url.searchParams.get("size") === "thumb";
    const row = await env.DB.prepare(`SELECT mime, ${wantThumb ? "COALESCE(thumb, data)" : "data"} AS b64, thumb IS NOT NULL AS has_thumb FROM images WHERE id = ?`)
      .bind(Number(imgMatch[1]))
      .first();
    if (!row) return error("Image not found", 404);
    const mime = wantThumb && row.has_thumb ? "image/jpeg" : row.mime;
    const headers = { "content-type": mime, "cache-control": "private, max-age=31536000, immutable" };
    if (url.searchParams.get("download")) headers["content-disposition"] = `attachment; filename="image-${imgMatch[1]}.${mime.split("/")[1].replace("jpeg", "jpg")}"`;
    return new Response(base64ToBytes(row.b64), { headers });
  }

  if (imgMatch && method === "DELETE") {
    await env.DB.prepare("DELETE FROM images WHERE id = ?").bind(Number(imgMatch[1])).run();
    return json({ ok: true });
  }

  /* ---------- storage ---------- */
  if (path === "/api/storage" && method === "GET") {
    // Estimate: photos are stored as base64 (≈ 4/3 of their size) + small thumbnails.
    const r = await env.DB.prepare(
      "SELECT COUNT(*) AS n, COALESCE(SUM(size), 0) AS bytes FROM images"
    ).first();
    const days = Math.max(1, Math.min(365, Number(url.searchParams.get("days")) || 30));
    const cutoff = new Date(Date.now() - days * 864e5).toISOString();
    const old = await env.DB.prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(i.size), 0) AS bytes FROM images i JOIN posts p ON p.id = i.post_id
       WHERE p.status = 'posted' AND COALESCE(p.scheduled_at, p.posted_at) < ?`
    )
      .bind(cutoff)
      .first();
    const est = (n, bytes) => Math.round(bytes * 1.37 + n * 50_000);
    return json({
      images: r.n,
      used: est(r.n, r.bytes),
      limit: 500 * 1024 * 1024,
      oldPosted: { days, images: old.n, bytes: est(old.n, old.bytes) },
    });
  }

  if (path === "/api/storage/cleanup" && method === "POST") {
    const body = (await readJson(request)) || {};
    const days = Math.max(1, Math.min(365, Number(body.days) || 30));
    const cutoff = new Date(Date.now() - days * 864e5).toISOString();
    const res = await env.DB.prepare(
      `DELETE FROM images WHERE post_id IN (SELECT id FROM posts WHERE status = 'posted' AND COALESCE(scheduled_at, posted_at) < ?)`
    )
      .bind(cutoff)
      .run();
    return json({ ok: true, deleted: res.meta?.changes ?? 0 });
  }

  /* ---------- settings ---------- */
  if (path === "/api/settings" && method === "GET") {
    return json({ settings: publicSettings(await getSettings(env)) });
  }

  if (path === "/api/settings" && method === "PUT") {
    const body = (await readJson(request)) || {};
    const current = await getSettings(env);
    const allowed = [
      "app_name",
      "content_types",
      "platforms",
      "reminder_offsets",
      "digest_hour",
      "digest_when_empty",
      "nudge_unposted",
      "timezone",
      "telegram_chat_id",
    ];
    const patch = {};
    for (const k of allowed) if (k in body) patch[k] = body[k];
    const next = normalizeSettings({ ...current, ...patch });
    if (patch.timezone && next.timezone !== patch.timezone) return error("Unknown time zone");
    const toSave = {};
    for (const k of allowed) if (k in patch) toSave[k] = next[k];
    await saveSettings(env, toSave);
    return json({ settings: publicSettings(next) });
  }

  /* ---------- telegram ---------- */
  if (path === "/api/telegram/status" && method === "GET") {
    const settings = await getSettings(env);
    const tokenSet = Boolean(env.TELEGRAM_BOT_TOKEN);
    let link = null;
    if (tokenSet && settings.bot_username) {
      link = `https://t.me/${settings.bot_username}?start=${await linkCode(env)}`;
    }
    return json({
      previewMode: env.PREVIEW_MODE === "1",
      tokenSet,
      connected: Boolean(settings.telegram_chat_id),
      chatId: settings.telegram_chat_id || null,
      botUsername: settings.bot_username || null,
      webhookReady: Boolean(settings.webhook_url),
      link,
      https: origin.startsWith("https://"),
    });
  }

  if (path === "/api/telegram/setup" && method === "POST") {
    if (!env.TELEGRAM_BOT_TOKEN) return error("Set the TELEGRAM_BOT_TOKEN secret first (see README).");
    if (!origin.startsWith("https://")) {
      return error("Telegram needs a public https:// address. Deploy the site first, then connect from there.");
    }
    try {
      const me = await tg(env, "getMe", {});
      const webhookUrl = `${origin}/telegram/webhook`;
      await tg(env, "setWebhook", {
        url: webhookUrl,
        secret_token: await webhookSecret(env),
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: true,
      });
      await tg(env, "setMyCommands", {
        commands: [
          { command: "today", description: "Today's scheduled posts" },
          { command: "week", description: "Posts in the next 7 days" },
          { command: "next", description: "The next post coming up" },
        ],
      }).catch(() => {});
      await saveSettings(env, { bot_username: me.username, webhook_url: webhookUrl, app_url: origin });
      return json({ ok: true, botUsername: me.username, link: `https://t.me/${me.username}?start=${await linkCode(env)}` });
    } catch (err) {
      return error(`Telegram said: ${err.message}`, 502);
    }
  }

  if (path === "/api/telegram/test" && method === "POST") {
    const settings = await getSettings(env);
    if (!settings.telegram_chat_id) return error("Telegram isn't connected yet.");
    try {
      await sendMessage(
        env,
        settings.telegram_chat_id,
        `🔔 <b>Test from ${escapeHtml(settings.app_name)}</b>\n\nReminders are working! It's ${escapeHtml(
          formatInZone(new Date(), settings.timezone)
        )} (${escapeHtml(settings.timezone)}).`
      );
      return json({ ok: true });
    } catch (err) {
      return error(`Telegram said: ${err.message}`, 502);
    }
  }

  if (path === "/api/telegram/disconnect" && method === "POST") {
    await saveSettings(env, { telegram_chat_id: "" });
    return json({ ok: true });
  }

  if (path === "/api/run-reminders" && method === "POST") {
    // Manually trigger the cron logic (handy for testing).
    return json(await runScheduled(env));
  }

  return error("Not found", 404);
}

function publicSettings(s) {
  // Everything except internal bookkeeping.
  const { last_digest, webhook_url, content_types_version, ...rest } = s;
  return rest;
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

/**
 * Cloudflare branch Previews set PREVIEW_MODE=1 (see wrangler.jsonc "previews").
 * A test copy must never talk to the real Telegram bot (it could steal the bot's
 * webhook or message the real chat), so we hide the bot token there no matter what.
 */
const forPreview = (env) => (env.PREVIEW_MODE === "1" ? { ...env, TELEGRAM_BOT_TOKEN: undefined } : env);

export default {
  async fetch(request, rawEnv) {
    const env = forPreview(rawEnv);
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/")) return await handleApi(request, env, url);
      if (url.pathname === "/telegram/webhook" && request.method === "POST") return await handleWebhook(request, env);
      const tgImg = url.pathname.match(/^\/telegram\/image\/(\d+)$/);
      if (tgImg && request.method === "GET") return await serveSignedImage(env, url, Number(tgImg[1]));
      if (url.pathname.startsWith("/telegram/")) return new Response("Not found", { status: 404 });
      return env.ASSETS.fetch(request);
    } catch (err) {
      console.error(err);
      return error("Something went wrong on the server.", 500);
    }
  },

  async scheduled(_event, rawEnv, ctx) {
    const env = forPreview(rawEnv);
    ctx.waitUntil(
      runScheduled(env).then((r) => {
        if (r.reminders || r.nudges || r.digest || r.errors.length) console.log("cron", JSON.stringify(r));
      })
    );
  },
};

export { DEFAULT_SETTINGS };
