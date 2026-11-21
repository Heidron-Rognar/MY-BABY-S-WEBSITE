import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cleanDraft, draftKey, readDrafts, writeDrafts, moveToLocalDay, RECOVERY_KEY } from "../public/planning-tools.js";
import { normalizeSettings, normalizeTemplates, computeDueReminders } from "../src/lib.js";

const store = () => ({ data: new Map(), getItem(k) { return this.data.get(k) ?? null; }, setItem(k, v) { this.data.set(k, v); }, removeItem(k) { this.data.delete(k); } });
const draft = (extra = {}) => cleanDraft({ title: "Work in progress", caption: "Do not lose me", date: "2026-11-23", time: "18:30", platforms: ["Instagram"], status: "ready", reminder_offsets: [60, 0], ...extra });

test("recovery roundtrips independent new and existing edits without photos or credentials", () => {
  const storage = store();
  const drafts = { new: draft({ blob: "secret image", password: "secret" }), "12": draft({ postId: 12, notes: "More details", sourceUpdatedAt: "2026-11-21T12:00:00Z" }) };
  assert.equal(writeDrafts(storage, drafts), true);
  assert.deepEqual(readDrafts(storage), drafts);
  assert.equal(draftKey(null), "new");
  assert.equal(draftKey(12), "12");
  assert.doesNotMatch(storage.getItem(RECOVERY_KEY), /secret|blob|password/);
  delete drafts.new;
  writeDrafts(storage, drafts);
  assert.deepEqual(Object.keys(readDrafts(storage)), ["12"]);
  writeDrafts(storage, {});
  assert.equal(storage.getItem(RECOVERY_KEY), null);
});

test("corrupt or unavailable recovery storage does not break editing", () => {
  const storage = store();
  for (const raw of ["null", "[]", "not json", "42", '{"new":null}']) {
    storage.setItem(RECOVERY_KEY, raw);
    assert.deepEqual(readDrafts(storage), {});
  }
  assert.deepEqual(readDrafts(null), {});
  assert.equal(writeDrafts(null, { new: draft() }), false);
  assert.equal(writeDrafts({ setItem() { throw Error("QuotaExceededError"); } }, { new: draft() }), false);
});

test("recovery sanitizes bounds and metadata without ever storing binary image data", () => {
  const result = cleanDraft({ title: "x".repeat(300), caption: "x".repeat(12000), notes: "x".repeat(6000), time: "99:99", date: "invalid", status: "unknown", reminder_offsets: [-1, 0, 60, 60, 20161], platforms: [null, "Instagram"], postId: -1 });
  assert.equal(result.title.length, 200);
  assert.equal(result.caption.length, 10000);
  assert.equal(result.notes.length, 5000);
  assert.equal(result.time, "");
  assert.equal(result.date, "");
  assert.equal(result.status, "draft");
  assert.equal(result.postId, null);
  assert.deepEqual(result.platforms, ["Instagram"]);
  assert.deepEqual(result.reminder_offsets, [0, 60]);
  assert.equal(cleanDraft(null), null);
});

test("template normalization limits names, rejects empty/duplicate templates, and excludes scheduling", () => {
  const result = normalizeTemplates([
    { name: " Product ", title: "A launch", caption: "Caption", notes: "Notes", platforms: ["Instagram", "Instagram"], scheduled_at: "2026-12-01", status: "posted", reminder_offsets: [0], images: ["image"] },
    { name: "PRODUCT", caption: "Duplicate" }, { name: " ", caption: "Unnamed" }, { name: "Blank", caption: " " }, null,
  ]);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0], { name: "Product", title: "A launch", caption: "Caption", notes: "Notes", content_type: "", platforms: ["Instagram"] });
  assert.deepEqual(normalizeSettings({ caption_templates: result }).caption_templates, result);
  assert.deepEqual(normalizeSettings().caption_templates, []);
  assert.deepEqual(normalizeTemplates({}), []);
  assert.equal(normalizeTemplates(Array.from({ length: 50 }, (_, i) => ({ name: `Template ${i}`, caption: "Text" }))).length, 30);
  const long = normalizeTemplates([{ name: "x".repeat(100), caption: "x".repeat(11000), notes: "x".repeat(6000) }])[0];
  assert.equal(long.name.length, 80); assert.equal(long.caption.length, 10000); assert.equal(long.notes.length, 5000);
});

test("calendar moves preserve local wall-clock time across months, leap years, and Manila dates", () => {
  const url = new URL("../public/planning-tools.js", import.meta.url).href;
  const run = (tz, code) => execFileSync(process.execPath, ["--input-type=module", "-e", `import assert from 'node:assert/strict'; import {moveToLocalDay} from '${url}'; ${code}`], { env: { ...process.env, TZ: tz } });
  run("Asia/Manila", `assert.equal(moveToLocalDay('2026-11-21T10:30:00.000Z','2027-01-02'),'2027-01-02T10:30:00.000Z'); assert.equal(moveToLocalDay('2028-02-28T10:30:00.000Z','2028-02-29'),'2028-02-29T10:30:00.000Z');`);
  run("America/New_York", `assert.equal(moveToLocalDay('2026-03-07T23:30:00.000Z','2026-03-08'),'2026-03-08T22:30:00.000Z'); assert.throws(()=>moveToLocalDay('2026-03-07T07:30:00.000Z','2026-03-08'),/does not exist/);`);
  for (const invalid of ["not-a-day", "2026-02-30", "2026-13-01"]) assert.throws(() => moveToLocalDay("2026-11-21T10:30:00Z", invalid));
  for (const invalid of [null, "bad", ""]) assert.throws(() => moveToLocalDay(invalid, "2026-12-01"));
});

test("a moved caption's reminders use the new schedule without changing its offsets", () => {
  const previous = "2026-11-21T10:00:00.000Z";
  const scheduled_at = "2026-11-22T10:00:00.000Z";
  const sent = new Set([`12|60|${previous}`, `12|0|${previous}`]);
  const post = { id: 12, status: "ready", scheduled_at };
  const result = computeDueReminders(post, [60, 0], sent, Date.parse(scheduled_at) - 3600000);
  assert.deepEqual(result.due, [60]);
  assert.deepEqual(computeDueReminders({ ...post, status: "posted" }, [60, 0], sent, Date.parse(scheduled_at)).due, []);
});
