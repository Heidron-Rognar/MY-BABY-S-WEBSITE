/** Pure helpers shared by the worker (and unit tests). No Cloudflare APIs in here. */

export const STATUSES = ["idea", "draft", "ready", "posted"];

export const DEFAULT_SETTINGS = {
  app_name: "Caption Studio",
  content_types: ["Reel", "Carousel", "Photo", "Story", "Video", "Live", "Text post"],
  platforms: ["Instagram", "TikTok", "Facebook", "YouTube", "Threads", "X"],
  reminder_offsets: [1440, 60, 0], // minutes before the post: 1 day, 1 hour, at post time
  digest_hour: 8, // daily "today's posts" message at 8 AM local time; -1 = off
  digest_when_empty: false,
  nudge_unposted: true, // "did you post it?" 2h after the time if not marked posted
  timezone: "Asia/Manila",
  telegram_chat_id: "",
  bot_username: "",
  app_url: "",
  webhook_url: "",
  last_digest: "",
};

const str = (v, max) => (typeof v === "string" ? v : v == null ? "" : String(v)).trim().slice(0, max);

function cleanList(value, fallback, maxItems = 30, maxLen = 40) {
  if (!Array.isArray(value)) return [...fallback];
  const seen = new Set();
  const out = [];
  for (const item of value) {
    const s = str(item, maxLen);
    const key = s.toLowerCase();
    if (!s || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
}

export function isValidTimeZone(tz) {
  if (typeof tz !== "string" || !tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function normalizeSettings(raw = {}) {
  const s = { ...DEFAULT_SETTINGS };
  if (raw.app_name !== undefined) s.app_name = str(raw.app_name, 60) || DEFAULT_SETTINGS.app_name;
  if (raw.content_types !== undefined) s.content_types = cleanList(raw.content_types, DEFAULT_SETTINGS.content_types);
  if (raw.platforms !== undefined) s.platforms = cleanList(raw.platforms, DEFAULT_SETTINGS.platforms);
  if (raw.reminder_offsets !== undefined) {
    const arr = Array.isArray(raw.reminder_offsets) ? raw.reminder_offsets : [];
    s.reminder_offsets = [...new Set(arr.map((n) => Math.round(Number(n))).filter((n) => Number.isFinite(n) && n >= 0 && n <= 20160))]
      .sort((a, b) => b - a)
      .slice(0, 8);
  }
  if (raw.digest_hour !== undefined) {
    const h = Math.round(Number(raw.digest_hour));
    s.digest_hour = Number.isFinite(h) && h >= -1 && h <= 23 ? h : DEFAULT_SETTINGS.digest_hour;
  }
  if (raw.digest_when_empty !== undefined) s.digest_when_empty = Boolean(raw.digest_when_empty);
  if (raw.nudge_unposted !== undefined) s.nudge_unposted = Boolean(raw.nudge_unposted);
  if (raw.timezone !== undefined) s.timezone = isValidTimeZone(raw.timezone) ? raw.timezone : DEFAULT_SETTINGS.timezone;
  if (raw.telegram_chat_id !== undefined) {
    const id = str(raw.telegram_chat_id, 32);
    s.telegram_chat_id = /^-?\d{1,20}$/.test(id) ? id : "";
  }
  for (const k of ["bot_username", "app_url", "webhook_url", "last_digest"]) {
    if (raw[k] !== undefined) s[k] = str(raw[k], 300);
  }
  return s;
}

export function normalizePostInput(body = {}) {
  const title = str(body.title, 200);
  const caption = typeof body.caption === "string" ? body.caption.replace(/\r\n/g, "\n").slice(0, 10000) : "";
  const content_type = str(body.content_type, 60);
  const platforms = cleanList(body.platforms, [], 10, 40);
  const notes = typeof body.notes === "string" ? body.notes.slice(0, 5000) : "";
  const status = STATUSES.includes(body.status) ? body.status : "draft";

  let scheduled_at = null;
  if (body.scheduled_at !== undefined && body.scheduled_at !== null && body.scheduled_at !== "") {
    const t = Date.parse(body.scheduled_at);
    if (!Number.isFinite(t)) return { error: "Invalid scheduled date" };
    scheduled_at = new Date(t).toISOString();
  }
  if (!title && !caption.trim()) return { error: "Write a caption or a title first" };
  return { value: { title, caption, content_type, platforms, notes, status, scheduled_at } };
}

/**
 * Decide which reminders are due for a post.
 *  - `due`: offsets (minutes before) whose time has come and haven't been sent yet.
 *    Only one Telegram message is sent per run, even if several are due at once
 *    (e.g. a post created 30 minutes before its time).
 *  - `nudge`: true when the post time passed `nudgeAfterMin` minutes ago and it's still not posted.
 */
export function computeDueReminders(post, offsets, sent, now, { nudgeAfterMin = null, nudgeOffset = -120 } = {}) {
  const sched = Date.parse(post.scheduled_at);
  const result = { due: [], nudge: false };
  if (!Number.isFinite(sched) || post.status === "posted") return result;
  const key = (o) => `${post.id}|${o}|${post.scheduled_at}`;

  if (sched >= now - 30 * 60e3) {
    for (const o of offsets) {
      if (sched - o * 60e3 <= now && !sent.has(key(o))) result.due.push(o);
    }
  }
  if (
    !result.due.length &&
    nudgeAfterMin != null &&
    now >= sched + nudgeAfterMin * 60e3 &&
    now <= sched + 26 * 3600e3 &&
    !sent.has(key(nudgeOffset))
  ) {
    result.nudge = true;
  }
  return result;
}

export function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour") % 24, minute: get("minute"), second: get("second") };
}

export function formatInZone(date, timeZone) {
  const day = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" }).format(date);
  const time = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(date);
  return `${day} · ${time}`;
}

/** Human label like "in 45 min", "in about 3 hours", "today", "tomorrow", "in 3 days". */
export function relativeLabel(diffMs, timeZone, now, schedMs) {
  const mins = Math.round(diffMs / 60e3);
  if (mins <= 5) return "now";
  if (mins < 60) return `in ${mins} min`;
  if (mins < 6 * 60) {
    const h = Math.round(mins / 60);
    return h === 1 ? "in about 1 hour" : `in about ${h} hours`;
  }
  const a = zonedParts(new Date(now), timeZone);
  const b = zonedParts(new Date(schedMs), timeZone);
  const dayDiff = Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 864e5);
  if (dayDiff <= 0) return "later today";
  if (dayDiff === 1) return "tomorrow";
  return `in ${dayDiff} days`;
}

export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function truncate(s, n) {
  const t = String(s ?? "");
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
}
