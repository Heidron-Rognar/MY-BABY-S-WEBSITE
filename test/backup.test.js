import test from "node:test";
import assert from "node:assert/strict";
import { BACKUP_FORMAT, validateBackup, validateBackupPost, validateBackupTemplates, backupPostKey, isExistingBackupPost, restoredPostFields } from "../public/backup.js";
import { readBackupBody, restoreBackupPost } from "../src/backup.js";
import worker from "../src/worker.js";

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
const record = (extra = {}) => ({ id: 42, title: "A memory", caption: "Caption", status: "ready", platforms: ["Instagram"], scheduled_at: "2026-12-01T10:30:00.000Z", created_at: "2026-11-21T10:00:00.000Z", updated_at: "2026-11-21T10:00:00.000Z", reminder_offsets: [60, 0], images: [{ mime: "image/png", data: png, width: 1, height: 1 }], ...extra });
const backup = (extra = {}) => ({ format: BACKUP_FORMAT, version: 2, exported_at: "2026-11-21T10:00:00Z", posts: [record()], templates: [{ name: "Template", caption: "Reusable" }], ...extra });

test("portable backup validates photos, text, templates, and archive history without credentials", () => {
  const value = validateBackup(backup({ password: "not imported", settings: { telegram_chat_id: "private" } }));
  assert.equal(value.posts[0].images[0].size, Buffer.from(png, "base64").length);
  assert.equal(value.templates[0].name, "Template");
  assert.equal(value.password, undefined); assert.equal(value.settings, undefined);
  const archived = validateBackupPost(record({ status: "posted", archived_at: "2026-11-22T10:00:00Z" }));
  assert.equal(restoredPostFields(archived, false).status, "posted");
  assert.equal(restoredPostFields(archived, false).scheduled_at, archived.scheduled_at);
});

test("invalid or future backups are rejected before any import", () => {
  for (const value of [null, [], {}, backup({ version: 3 }), backup({ format: "other" }), backup({ posts: "bad" }), backup({ posts: [record(), record({ status: "publish-now" })] })]) {
    assert.throws(() => validateBackup(value));
  }
  for (const change of [{ caption: "x".repeat(10001) }, { scheduled_at: "yesterday" }, { scheduled_at: "2026-02-30T10:00:00Z" }, { reminder_offsets: [-1] }, { platforms: [123] }, { images: [{ mime: "image/svg+xml", data: png }] }, { images: [{ mime: "image/png", data: "not base64" }] }, { images: [{ mime: "image/png", data: btoa("<html>not an image</html>") }] }, { images: Array(11).fill({ mime: "image/png", data: png }) }, { archived_at: "2026-11-22T10:00:00Z" }]) {
    assert.throws(() => validateBackupPost(record(change)));
  }
  assert.throws(() => validateBackupTemplates([{ name: "A", caption: "Text" }, { name: "a", caption: "Text" }]));
});

test("old caption exports remain supported with explicit missing-photo counts", () => {
  const value = validateBackup({ exported_at: "2026-11-21T10:00:00Z", posts: [record({ images: [{ id: 7, width: 1 }] })] });
  assert.equal(value.legacy, true); assert.equal(value.posts[0].missing_images, 1); assert.deepEqual(value.posts[0].images, []);
  assert.throws(() => validateBackup({ exported_at: "2026-11-21T10:00:00Z", posts: [record({ title: "", caption: "", images: [{ id: 7 }] })] }), /photo-only/);
});

test("duplicate keys are stable across key ordering and export times but detect changed content", async () => {
  const post = validateBackupPost(record());
  const key = await backupPostKey(post);
  assert.equal(key, await backupPostKey(Object.fromEntries(Object.entries(post).reverse())));
  assert.notEqual(key, await backupPostKey({ ...post, caption: "Changed" }));
  assert.ok(isExistingBackupPost(post, key, [{ id: 999, restore_key: key }]));
  assert.ok(isExistingBackupPost(post, key, [{ id: post.id, created_at: post.created_at, updated_at: post.updated_at }]));
  assert.equal(isExistingBackupPost(post, key, [{ id: post.id, created_at: post.created_at, updated_at: "changed" }]), false);
});

test("restore defaults to unscheduled drafts and only explicitly restores active schedules", () => {
  const post = validateBackupPost(record());
  const safe = restoredPostFields(post, false);
  assert.equal(safe.status, "draft"); assert.equal(safe.scheduled_at, null);
  assert.equal(restoredPostFields(post, true).scheduled_at, post.scheduled_at);
  assert.equal(restoredPostFields(post, true).status, "ready");
  assert.deepEqual(safe.reminder_offsets, [60, 0]);
});

test("backup request reader bounds chunked payloads and rejects malformed JSON", async () => {
  const req = (text) => new Request("https://example.test", { method: "POST", body: text });
  assert.deepEqual(await readBackupBody(req('{"valid":true}'), 100), { valid: true });
  await assert.rejects(() => readBackupBody(req("x".repeat(101)), 100), /too large/);
  await assert.rejects(() => readBackupBody(req("not JSON"), 100), /not valid JSON/);
});

test("each caption and its photos are sent in one transactional D1 batch with race-safe tokens", async () => {
  let statements;
  const db = { prepare(sql) { return { sql, values: [], bind(...values) { this.values = values; return this; }, async first() { return sql.includes("SELECT id, restore_token") ? { id: 100, restore_token: statements[0].values.at(-1) } : null; } }; }, async batch(values) { statements = values; } };
  assert.deepEqual(await restoreBackupPost(db, record(), false), { id: 100, skipped: false });
  assert.equal(statements.length, 2);
  assert.match(statements[0].sql, /ON CONFLICT\(restore_key\) DO NOTHING/);
  assert.equal(statements[0].values[4], null); assert.equal(statements[0].values[5], "draft");
  assert.match(statements[1].sql, /WHERE restore_key = \? AND restore_token = \?/);
  assert.equal(statements[1].values.at(-1), statements[0].values.at(-1));
});

test("already-restored captions never execute another insert batch", async () => {
  const db = { prepare() { return { bind() { return this; }, async first() { return { id: 123 }; } }; }, async batch() { assert.fail("Duplicate should not insert posts or images"); } };
  assert.deepEqual(await restoreBackupPost(db, record(), true), { id: 123, skipped: true });
});

test("all backup routes require authentication before accessing the database", async () => {
  for (const [path, method] of [["info", "GET"], ["posts/1", "GET"], ["restore-post", "POST"], ["restore-templates", "POST"]]) {
    const response = await worker.fetch(new Request(`https://example.test/api/backup/${path}`, { method }), { APP_PASSWORD: "test", DB: { prepare() { assert.fail("Unauthenticated database access"); } } });
    assert.equal(response.status, 401);
  }
});
