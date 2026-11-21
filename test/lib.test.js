import test from "node:test";
import assert from "node:assert/strict";
import { computeDueReminders, normalizePostInput, normalizeSettings, relativeLabel, formatInZone } from "../src/lib.js";

const H = 3600e3;
const NOW = Date.parse("2026-11-21T04:00:00Z"); // 12:00 PM Manila
const post = (hoursFromNow, extra = {}) => ({
  id: 1,
  status: "ready",
  scheduled_at: new Date(NOW + hoursFromNow * H).toISOString(),
  ...extra,
});

test("no reminder when far away", () => {
  const r = computeDueReminders(post(48), [1440, 60, 0], new Set(), NOW);
  assert.deepEqual(r.due, []);
});

test("1-day reminder fires exactly when due", () => {
  const r = computeDueReminders(post(24), [1440, 60, 0], new Set(), NOW);
  assert.deepEqual(r.due, [1440]);
});

test("already-sent reminders are skipped", () => {
  const p = post(0.5);
  const sent = new Set([`1|1440|${p.scheduled_at}`]);
  const r = computeDueReminders(p, [1440, 60, 0], sent, NOW);
  assert.deepEqual(r.due, [60]);
});

test("rescheduling resets reminders", () => {
  const p = post(0.5);
  const sent = new Set([`1|60|2026-01-01T00:00:00.000Z`]);
  assert.deepEqual(computeDueReminders(p, [60], sent, NOW).due, [60]);
});

test("post created last-minute gets all due offsets in one batch", () => {
  const r = computeDueReminders(post(0.2), [1440, 60, 0], new Set(), NOW);
  assert.deepEqual(r.due, [1440, 60]);
});

test("posted posts never remind", () => {
  const r = computeDueReminders(post(0, { status: "posted" }), [0], new Set(), NOW, { nudgeAfterMin: 120 });
  assert.deepEqual(r, { due: [], nudge: false });
});

test("nudge 2h after if not posted, only once", () => {
  const p = post(-3);
  const sentAll = new Set([`1|0|${p.scheduled_at}`]);
  assert.equal(computeDueReminders(p, [0], sentAll, NOW, { nudgeAfterMin: 120 }).nudge, true);
  sentAll.add(`1|-120|${p.scheduled_at}`);
  assert.equal(computeDueReminders(p, [0], sentAll, NOW, { nudgeAfterMin: 120 }).nudge, false);
  assert.equal(computeDueReminders(p, [0], new Set(), NOW, { nudgeAfterMin: null }).nudge, false);
});

test("old posts (logged history) don't trigger 'time to post'", () => {
  assert.deepEqual(computeDueReminders(post(-5), [0], new Set(), NOW).due, []);
});

test("post input validation", () => {
  assert.ok(normalizePostInput({}).error);
  assert.ok(normalizePostInput({ caption: "hi", scheduled_at: "nope" }).error);
  const ok = normalizePostInput({ caption: "hi", scheduled_at: "2026-11-22T10:00:00+08:00", status: "weird", platforms: ["IG", "ig", ""] });
  assert.equal(ok.value.scheduled_at, "2026-11-22T02:00:00.000Z");
  assert.equal(ok.value.status, "draft");
  assert.deepEqual(ok.value.platforms, ["IG"]);
});

test("settings normalization", () => {
  const s = normalizeSettings({ reminder_offsets: [0, "60", 60, -5, 1440], timezone: "Mars/Base", digest_hour: 99, telegram_chat_id: "abc" });
  assert.deepEqual(s.reminder_offsets, [1440, 60, 0]);
  assert.equal(s.timezone, "Asia/Manila");
  assert.equal(s.digest_hour, 8);
  assert.equal(s.telegram_chat_id, "");
});

test("labels", () => {
  assert.equal(relativeLabel(2 * 60e3, "Asia/Manila", NOW, NOW + 2 * 60e3), "now");
  assert.equal(relativeLabel(45 * 60e3, "Asia/Manila", NOW, NOW + 45 * 60e3), "in 45 min");
  assert.equal(relativeLabel(3 * H, "Asia/Manila", NOW, NOW + 3 * H), "in about 3 hours");
  assert.equal(relativeLabel(24 * H, "Asia/Manila", NOW, NOW + 24 * H), "tomorrow");
  assert.equal(relativeLabel(72 * H, "Asia/Manila", NOW, NOW + 72 * H), "in 3 days");
  assert.equal(formatInZone(new Date(NOW), "Asia/Manila"), "Sat, Nov 21 · 12:00 PM");
});
