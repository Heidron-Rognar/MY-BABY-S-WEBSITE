/**
 * Caption Studio — Cloudflare Worker
 *
 *  • Serves the website (static files in /public)
 *  • JSON API for captions / settings  (/api/*)
 *  • Telegram bot webhook               (/telegram/webhook)
 *  • Cron job that sends posting reminders + a daily digest to Telegram
 */

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
    ]).catch((err) => {
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

function rowToPost(row) {
  let platforms = [];
  try {
    platforms = JSON.parse(row.platforms || "[]");
  } catch {
    platforms = [];
  }
  return { ...row, platforms };
}

async function getPost(env, id) {
  const row = await env.DB.prepare("SELECT * FROM posts WHERE id = ?").bind(id).first();
  return row ? rowToPost(row) : null;
}

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

function sessionCookie(value, maxAge, secure) {
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${
    secure ? "; Secure" : ""
  }`;
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
  if (post.status !== "ready" && !isNow) lines.push(`\n⚠️ Status: <b>${escapeHtml(post.status)}</b> — caption not marked ready yet.`);
  if (isNow && post.caption) lines.push("\n👇 Caption is in the next message — long-press to copy.");
  return { text: lines.join("\n"), isNow };
}

async function sendReminder(env, chatId, post, settings, now) {
  const { text, isNow } = reminderText(post, settings, now);
  await sendMessage(env, chatId, text, { reply_markup: postKeyboard(post, settings) });
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
  return results.map(rowToPost);
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
      else await sendReminder(env, chatId, rowToPost(row), settings, now);
    } else {
      await sendMessage(env, chatId, "Hi! 👋\n/today — today's posts\n/week — next 7 days\n/next — the next post");
    }
  } catch (err) {
    console.error("webhook error", err);
  }
  return new Response("ok");
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

  const offsets = settings.reminder_offsets;
  const maxOffset = Math.max(0, ...offsets);
  const lower = new Date(now - (settings.nudge_unposted ? 26 * 60 : 30) * 60e3).toISOString();
  const upper = new Date(now + (maxOffset + 1) * 60e3).toISOString();

  const { results } = await env.DB.prepare(
    "SELECT * FROM posts WHERE status != 'posted' AND scheduled_at IS NOT NULL AND scheduled_at >= ? AND scheduled_at <= ? ORDER BY scheduled_at"
  )
    .bind(lower, upper)
    .all();
  const posts = results.map(rowToPost);

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
      const { due, nudge } = computeDueReminders(post, offsets, sent, now, {
        nudgeAfterMin: settings.nudge_unposted ? NUDGE_AFTER_MIN : null,
        nudgeOffset: NUDGE_OFFSET,
      });
      try {
        if (due.length) {
          await sendReminder(env, chatId, post, settings, now);
          report.reminders++;
          await markSent(env, post, due, now);
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
  const secure = url.protocol === "https:";

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
    return json({ ok: true }, 200, { "set-cookie": sessionCookie(await makeSession(env), SESSION_DAYS * 86400, secure) });
  }

  if (path === "/api/logout" && method === "POST") {
    return json({ ok: true }, 200, { "set-cookie": sessionCookie("", 0, secure) });
  }

  if (!(await isAuthed(request, env))) return error("Not logged in", 401);
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
    return json({ posts: results.map(rowToPost) });
  }

  if (path === "/api/posts" && method === "POST") {
    const input = normalizePostInput((await readJson(request)) || {});
    if (input.error) return error(input.error);
    const now = new Date().toISOString();
    const p = input.value;
    const row = await env.DB.prepare(
      `INSERT INTO posts (title, caption, content_type, platforms, scheduled_at, status, notes, posted_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
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
        now,
        now
      )
      .first();
    return json({ post: rowToPost(row) }, 201);
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
      const input = normalizePostInput(merged);
      if (input.error) return error(input.error);
      const p = input.value;
      const now = new Date().toISOString();
      const postedAt = p.status === "posted" ? existing.posted_at || now : null;
      const row = await env.DB.prepare(
        `UPDATE posts SET title = ?, caption = ?, content_type = ?, platforms = ?, scheduled_at = ?, status = ?,
           notes = ?, posted_at = ?, updated_at = ? WHERE id = ? RETURNING *`
      )
        .bind(p.title, p.caption, p.content_type, JSON.stringify(p.platforms), p.scheduled_at, p.status, p.notes, postedAt, now, id)
        .first();
      return json({ post: rowToPost(row) });
    }

    if (method === "DELETE") {
      await env.DB.batch([
        env.DB.prepare("DELETE FROM posts WHERE id = ?").bind(id),
        env.DB.prepare("DELETE FROM reminders_sent WHERE post_id = ?").bind(id),
      ]);
      return json({ ok: true });
    }
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
  const { last_digest, webhook_url, ...rest } = s;
  return rest;
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/")) return await handleApi(request, env, url);
      if (url.pathname === "/telegram/webhook" && request.method === "POST") return await handleWebhook(request, env);
      if (url.pathname.startsWith("/telegram/")) return new Response("Not found", { status: 404 });
      return env.ASSETS.fetch(request);
    } catch (err) {
      console.error(err);
      return error("Something went wrong on the server.", 500);
    }
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      runScheduled(env).then((r) => {
        if (r.reminders || r.nudges || r.digest || r.errors.length) console.log("cron", JSON.stringify(r));
      })
    );
  },
};

export { DEFAULT_SETTINGS };
