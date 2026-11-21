import { validateBackupPost, backupPostKey, restoredPostFields } from "../public/backup.js";

export async function exportBackupPost(db, id) {
  const row = await db.prepare("SELECT * FROM posts WHERE id = ?").bind(id).first();
  if (!row) return null;
  const { results } = await db.prepare("SELECT mime, width, height, data FROM images WHERE post_id = ? ORDER BY position, id").bind(id).all();
  return validateBackupPost({ ...row, platforms: JSON.parse(row.platforms || "[]"), reminder_offsets: JSON.parse(row.reminder_offsets || "null"), images: results });
}

export async function restoreBackupPost(db, input, keepSchedule) {
  const original = validateBackupPost(input);
  const key = await backupPostKey(original);
  const existing = await db.prepare(
    "SELECT id FROM posts WHERE restore_key = ? OR (id = ? AND created_at = ? AND updated_at = ?) LIMIT 1"
  ).bind(key, original.id, original.created_at, original.updated_at).first();
  if (existing) return { id: existing.id, skipped: true };
  const p = restoredPostFields(original, keepSchedule);
  const token = crypto.randomUUID();
  const now = new Date().toISOString();
  const statements = [db.prepare(
    `INSERT INTO posts (title, caption, content_type, platforms, scheduled_at, status, notes, posted_at,
      reminder_offsets, created_at, updated_at, archived_at, restore_key, restore_token)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(restore_key) DO NOTHING`
  ).bind(p.title, p.caption, p.content_type, JSON.stringify(p.platforms), p.scheduled_at, p.status, p.notes,
    p.status === "posted" ? p.posted_at || now : null, p.reminder_offsets === null ? null : JSON.stringify(p.reminder_offsets),
    p.created_at || now, now, p.archived_at, key, token)];
  p.images.forEach((image, index) => statements.push(db.prepare(
    `INSERT INTO images (post_id, position, mime, width, height, size, data, thumb, created_at)
     SELECT id, ?, ?, ?, ?, ?, ?, NULL, ? FROM posts WHERE restore_key = ? AND restore_token = ?`
  ).bind(index, image.mime, image.width, image.height, image.size, image.data, now, key, token)));
  // D1 batch is transactional: a post and all its photos succeed or roll back together.
  // The unique key plus request token also make retries and racing imports safe.
  await db.batch(statements);
  const row = await db.prepare("SELECT id, restore_token FROM posts WHERE restore_key = ?").bind(key).first();
  if (!row) throw new Error("The caption could not be restored");
  return { id: row.id, skipped: row.restore_token !== token };
}
/** Bound backup payloads even when Content-Length is missing/chunked. */
export async function readBackupBody(request, limit = 21000000) {
  if (Number(request.headers.get("content-length")) > limit) throw new Error("Backup request is too large");
  if (!request.body) throw new Error("Backup request is empty");
  const reader = request.body.getReader();
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error("Backup request is too large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const buffer = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(buffer)); }
  catch { throw new Error("Backup request is not valid JSON"); }
}
