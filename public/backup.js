// Versioned, portable backup format. Shared validation runs in browser and Worker.
export const BACKUP_FORMAT = "caption-studio";
export const BACKUP_VERSION = 2;
export const MAX_BACKUP_BYTES = 100 * 1024 * 1024;
export const MAX_BACKUP_POSTS = 10000;
const fail = (message) => { throw new Error(message); };
const object = (v) => v && typeof v === "object" && !Array.isArray(v);
function text(value, max, label, fallback = "") {
  if (value == null) return fallback;
  if (typeof value !== "string" || value.length > max) fail(`${label} must be text, at most ${max} characters`);
  return value;
}
function date(value, label) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) fail(`${label} is not a valid timestamp`);
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const calendar = new Date(0);
  calendar.setUTCFullYear(year, month - 1, day);
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) fail(`${label} contains an invalid calendar day`);
  return new Date(value).toISOString();
}
function list(value, max, length, label) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > max || value.some((v) => typeof v !== "string" || !v.trim() || v.length > length)) fail(`${label} is invalid`);
  return [...new Set(value)];
}
function base64(value, max, label) {
  if (typeof value !== "string" || !value.length || value.length > Math.ceil(max / 3) * 4 || value.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) fail(`${label} contains invalid or oversized base64 data`);
  const bytes = value.length / 4 * 3 - (value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0);
  if (bytes > max) fail(`${label} is too large`);
  return bytes;
}
export function validateBackupPost(value, legacy = false) {
  if (!object(value)) fail("Each caption must be an object");
  const id = value.id == null ? null : value.id;
  if (id !== null && (!Number.isSafeInteger(id) || id <= 0)) fail("Caption ID is invalid");
  const p = {
    id, title: text(value.title, 200, "Title"), caption: text(value.caption, 10000, "Caption"),
    content_type: text(value.content_type, 60, "Content type"), platforms: list(value.platforms, 10, 40, "Platforms"),
    notes: text(value.notes, 5000, "Notes"), status: value.status ?? "draft",
    scheduled_at: date(value.scheduled_at, "Scheduled date"),
    created_at: date(value.created_at, "Created date"), updated_at: date(value.updated_at, "Updated date"),
    posted_at: date(value.posted_at, "Posted date"), archived_at: date(value.archived_at, "Archive date"),
    reminder_offsets: value.reminder_offsets == null ? null : value.reminder_offsets,
    images: [], missing_images: 0,
  };
  if (!["idea", "draft", "ready", "posted"].includes(p.status)) fail("Unknown caption status");
  if (p.archived_at && p.status !== "posted") fail("Only posted captions can be archived");
  if (p.reminder_offsets !== null && (!Array.isArray(p.reminder_offsets) || p.reminder_offsets.length > 8 || p.reminder_offsets.some((n) => !Number.isInteger(n) || n < 0 || n > 20160))) fail("Reminder offsets are invalid");
  if (p.reminder_offsets !== null) p.reminder_offsets = [...new Set(p.reminder_offsets)];
  const images = value.images ?? [];
  if (!Array.isArray(images) || images.length > 10) fail("A caption can contain up to 10 photos");
  if (legacy) p.missing_images = images.length;
  else {
    if (value.missing_images != null && (!Number.isInteger(value.missing_images) || value.missing_images < 0 || value.missing_images > 10)) fail("Missing-photo count is invalid");
    p.missing_images = value.missing_images || 0;
    if (images.length + p.missing_images > 10) fail("Photo count is invalid");
    p.images = images.map((image, i) => {
      if (!object(image) || !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(image.mime)) fail(`Photo ${i + 1} has an unsupported format`);
      const size = base64(image.data, 1400000, `Photo ${i + 1}`);
      const prefix = atob(image.data.slice(0, 32));
      const signature = image.mime === "image/png" ? prefix.startsWith("\x89PNG\r\n\x1a\n")
        : image.mime === "image/jpeg" ? prefix.startsWith("\xff\xd8\xff")
        : image.mime === "image/gif" ? /^GIF8[79]a/.test(prefix)
        : prefix.startsWith("RIFF") && prefix.slice(8, 12) === "WEBP";
      if (!signature) fail(`Photo ${i + 1} data does not match its image format`);
      const dimension = (n) => n == null ? null : Number.isInteger(n) && n > 0 && n <= 100000 ? n : fail("Photo dimensions are invalid");
      return { mime: image.mime, width: dimension(image.width), height: dimension(image.height), size, data: image.data };
    });
  }
  if (!p.title.trim() && !p.caption.trim() && !p.images.length) {
    if (p.missing_images) fail("A photo-only caption has no bundled photos. Use a photo-inclusive backup or add a title before exporting.");
    fail("A caption needs a title, caption text, or a photo");
  }
  return p;
}
export function validateBackupTemplates(value) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 30) fail("A backup can contain up to 30 templates");
  const names = new Set();
  return value.map((t) => {
    if (!object(t)) fail("Each template must be an object");
    const name = text(t.name, 80, "Template name").trim();
    if (!name || names.has(name.toLowerCase())) fail("Template names must be nonempty and unique");
    names.add(name.toLowerCase());
    const result = { name, title: text(t.title, 200, "Template title"), caption: text(t.caption, 10000, "Template caption"), notes: text(t.notes, 5000, "Template notes"), content_type: text(t.content_type, 60, "Template type"), platforms: list(t.platforms, 10, 40, "Template platforms") };
    if (!result.title.trim() && !result.caption.trim()) fail("Each template needs a title or caption");
    return result;
  });
}
export function validateBackup(value) {
  if (!object(value)) fail("Choose a Caption Studio JSON backup, not a spreadsheet");
  const legacy = value.format == null && value.version == null && typeof value.exported_at === "string" && Array.isArray(value.posts);
  if (!legacy && (value.format !== BACKUP_FORMAT || value.version !== BACKUP_VERSION)) fail("Unsupported backup format or version");
  if (!date(value.exported_at, "Export date")) fail("Backup export date is missing");
  if (!Array.isArray(value.posts) || value.posts.length > MAX_BACKUP_POSTS) fail(`A backup can contain up to ${MAX_BACKUP_POSTS} captions`);
  const posts = value.posts.map((p, i) => {
    try { return validateBackupPost(p, legacy); }
    catch (err) { fail(`Caption ${i + 1}: ${err.message}`); }
  });
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, legacy, exported_at: value.exported_at, posts, templates: validateBackupTemplates(legacy ? [] : value.templates) };
}
export async function backupPostKey(post) {
  // Independent of export time, restore options, database IDs assigned on import, or object key order.
  const canonical = validateBackupPost(post);
  const data = new TextEncoder().encode(JSON.stringify(canonical));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2, "0")).join("");
}
export function isExistingBackupPost(post, key, existing) {
  return existing.some((p) => p.restore_key === key || (post.id && post.created_at && post.updated_at && p.id === post.id && p.created_at === post.created_at && p.updated_at === post.updated_at));
}
export function restoredPostFields(post, keepSchedule) {
  return {
    ...post,
    status: post.status === "posted" ? "posted" : keepSchedule ? post.status : "draft",
    scheduled_at: post.status === "posted" || keepSchedule ? post.scheduled_at : null,
  };
}
