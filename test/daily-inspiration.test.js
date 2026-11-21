import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { VERSE_REFERENCES, FALLBACK_SEED, VERSE_SEED_KEY, getVerseSeed, getDailyReference, localDateKey, localDayNumber, millisecondsUntilMidnight } from "../public/daily-verses.js";
import { greetingForTheme, initDailyInspiration, salutation } from "../public/daily-inspiration.js";

const day = (offset = 0, hour = 12) => new Date(2026, 10, 21 + offset, hour);
const storage = (saved = null) => ({
  value: saved,
  getItem(key) { assert.equal(key, VERSE_SEED_KEY); return this.value; },
  setItem(key, value) { assert.equal(key, VERSE_SEED_KEY); this.value = value; },
});

test("reference pool contains 100 unique single verses, without bundled licensed text", () => {
  assert.equal(VERSE_REFERENCES.length, 100);
  assert.equal(new Set(VERSE_REFERENCES).size, VERSE_REFERENCES.length);
  for (const verse of VERSE_REFERENCES) {
    assert.match(verse, /^[1-3]? ?[A-Za-z ]+ \d+:\d+$/);
  }
});

test("the seed is created once and reused across reloads, including zero", () => {
  const store = storage();
  assert.equal(getVerseSeed(store, () => 1234), 1234);
  assert.equal(getVerseSeed(store, () => { throw new Error("Must reuse the saved seed"); }), 1234);
  assert.equal(getVerseSeed(storage("0")), 0);
  for (const value of ["bad", "-1", "4294967296", "", "1.2"]) {
    assert.equal(getVerseSeed(storage(value), () => 32), 32);
  }
});

test("blocked, full, or unavailable storage yields a stable daily fallback", () => {
  assert.equal(getVerseSeed({ getItem() { throw new Error("Blocked"); } }), FALLBACK_SEED);
  assert.equal(getVerseSeed({ getItem() { return null; }, setItem() { throw new Error("Full"); } }, () => 7), FALLBACK_SEED);
  assert.equal(getVerseSeed(undefined), FALLBACK_SEED);
  assert.equal(getDailyReference(day(), FALLBACK_SEED), getDailyReference(day(), FALLBACK_SEED));
});

test("a verse is stable all local day, changes tomorrow, and does not repeat within a cycle", () => {
  for (const seed of [0, 1, 24681357, 0xffffffff, FALLBACK_SEED]) {
    assert.equal(getDailyReference(day(0, 0), seed), getDailyReference(day(0, 23), seed));
    const cycle = Array.from({ length: VERSE_REFERENCES.length }, (_, i) => getDailyReference(day(i), seed));
    assert.equal(new Set(cycle).size, VERSE_REFERENCES.length);
    assert.notEqual(cycle.at(-1), getDailyReference(day(VERSE_REFERENCES.length), seed));
    assert.equal(cycle[0], getDailyReference(day(VERSE_REFERENCES.length), seed));
  }
  assert.notDeepEqual(
    Array.from({ length: 10 }, (_, i) => getDailyReference(day(i), 12)),
    Array.from({ length: 10 }, (_, i) => getDailyReference(day(i), 34)),
  );
});

test("date helpers use civil dates across years, leap days and pre-epoch dates", () => {
  assert.equal(localDateKey(day()), "2026-11-21");
  assert.equal(localDayNumber(new Date(2027, 0, 1)) - localDayNumber(new Date(2026, 11, 31)), 1);
  assert.equal(localDayNumber(new Date(2028, 2, 1)) - localDayNumber(new Date(2028, 1, 28)), 2);
  assert.ok(VERSE_REFERENCES.includes(getDailyReference(new Date(1960, 0, 1), 1)));
  assert.throws(() => getDailyReference(new Date("invalid"), 1), RangeError);
  assert.equal(millisecondsUntilMidnight(new Date(2026, 10, 21, 23, 59, 59)), 1100);
});

test("local midnight is independent of UTC and daylight-saving days can be 23 or 25 hours", () => {
  const moduleUrl = new URL("../public/daily-verses.js", import.meta.url).href;
  const run = (tz, code) => execFileSync(process.execPath, ["--input-type=module", "-e", `
    import assert from 'node:assert/strict';
    import {getDailyReference, localDateKey, localDayNumber, millisecondsUntilMidnight} from '${moduleUrl}';
    ${code}
  `], { env: { ...process.env, TZ: tz } });
  run("Asia/Manila", `
    const before = new Date('2026-11-21T15:59:59Z');
    const after = new Date('2026-11-21T16:00:00Z');
    assert.equal(localDateKey(before), '2026-11-21');
    assert.equal(localDateKey(after), '2026-11-22');
    assert.notEqual(getDailyReference(before, 42), getDailyReference(after, 42));
  `);
  run("America/New_York", `
    assert.equal(millisecondsUntilMidnight(new Date(2026, 2, 8)), 23 * 3600000 + 100);
    assert.equal(millisecondsUntilMidnight(new Date(2026, 10, 1)), 25 * 3600000 + 100);
    assert.equal(localDayNumber(new Date(2026, 2, 9)) - localDayNumber(new Date(2026, 2, 8)), 1);
    assert.equal(getDailyReference(new Date(2026, 10, 1, 0), 42), getDailyReference(new Date(2026, 10, 1, 23), 42));
  `);
});

test("every theme has a greeting and salutations follow the local time", () => {
  const labels = new Set(["rose", "rose-dark", "matcha", "bookish", "cyber", "christmas"].map((t) => greetingForTheme(t).label));
  assert.equal(labels.size, 6);
  assert.equal(greetingForTheme("auto"), greetingForTheme("unknown"));
  assert.equal(salutation(day(0, 9)), "Good morning");
  assert.equal(salutation(day(0, 12)), "Good afternoon");
  assert.equal(salutation(day(0, 18)), "Good evening");
});

function fixture() {
  const elements = new Map(["daily-inspiration", "daily-label", "daily-title", "daily-ornament", "daily-salutation", "daily-date", "daily-verse-text", "daily-verse-reference", "daily-reading", "daily-status", "daily-retry", "daily-copyright"].map((id) => [id, Object.assign(new EventTarget(), { hidden: true, textContent: "" })]));
  const root = new EventTarget();
  root.hidden = false;
  root.querySelector = (selector) => elements.get(selector.slice(1));
  const host = new EventTarget();
  host.localStorage = storage("42");
  host.calls = [];
  host.fetch = async (url) => {
    host.calls.push(url);
    const reference = new URL(url, "https://example.test").searchParams.get("reference");
    return Response.json({ reference, translation: "ESV", text: `Invented test-only provider fixture for ${reference}. (ESV)` });
  };
  let nextId = 0;
  host.timers = new Map();
  host.setTimeout = (fn, delay) => { const id = ++nextId; host.timers.set(id, { fn, delay }); return id; };
  host.clearTimeout = (id) => host.timers.delete(id);
  return { root, host, elements };
}

test("card preserves the verse when switching themes and refreshes at midnight, on focus, and on resume", async () => {
  const { root, host, elements } = fixture();
  let date = day();
  let theme = "rose";
  const controller = initDailyInspiration(() => theme, { root, host, now: () => date });
  const verseText = () => elements.get("daily-verse-text").textContent;
  await controller.refresh();
  const first = verseText();
  assert.equal(elements.get("daily-inspiration").hidden, false);
  assert.equal(elements.get("daily-date").dateTime, "2026-11-21");
  for (theme of ["matcha", "bookish", "cyber", "christmas", "rose-dark", "auto"]) {
    await controller.refresh();
    assert.equal(verseText(), first);
    assert.equal(elements.get("daily-title").textContent, greetingForTheme(theme).title);
    assert.equal(host.timers.size, 1);
  }
  date = day(1, 0);
  await host.timers.values().next().value.fn();
  assert.notEqual(verseText(), first);
  assert.equal(elements.get("daily-date").dateTime, "2026-11-22");
  date = day(2);
  root.hidden = true;
  root.dispatchEvent(new Event("visibilitychange"));
  assert.equal(elements.get("daily-date").dateTime, "2026-11-22");
  root.hidden = false;
  root.dispatchEvent(new Event("visibilitychange"));
  await controller.refresh();
  assert.equal(elements.get("daily-date").dateTime, "2026-11-23");
  date = day(3);
  host.dispatchEvent(new Event("focus"));
  await controller.refresh();
  assert.equal(elements.get("daily-date").dateTime, "2026-11-24");
  date = day(4);
  host.dispatchEvent(new Event("pageshow"));
  await controller.refresh();
  assert.equal(elements.get("daily-date").dateTime, "2026-11-25");
  controller.destroy();
  assert.equal(host.timers.size, 0);
  host.dispatchEvent(new Event("focus"));
  assert.equal(host.timers.size, 0);
});

test("a blocked localStorage getter does not prevent the card from loading", async () => {
  const { root, host, elements } = fixture();
  Object.defineProperty(host, "localStorage", { get() { throw new Error("Blocked"); } });
  const controller = initDailyInspiration(() => "christmas", { root, host, now: () => day() });
  await controller.refresh();
  assert.equal(elements.get("daily-verse-reference").textContent, getDailyReference(day(), FALLBACK_SEED));
  controller.destroy();
});

test("every theme shares one accessible greeting with verse attribution, not duplicate banners", () => {
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  assert.equal((html.match(/id="daily-inspiration"/g) || []).length, 1);
  assert.match(html, /<section id="daily-inspiration"[^>]*aria-labelledby="daily-title" hidden>/);
  assert.match(html, /<blockquote><p id="daily-verse-text"><\/p><\/blockquote>/);
  assert.match(html, /<cite id="daily-verse-reference"><\/cite>/);
  assert.match(html, /class="daily-version"> · ESV/);
  assert.doesNotMatch(html, /class="(?:xm-only xm-greeting|bk-only bk-frontispiece)"/);
  assert.match(html, /href="\/daily-inspiration.css"/);
});

test("theme changes reuse the loaded passage, and failed requests show a retriable error without false scripture", async () => {
  const { root, host, elements } = fixture();
  let calls = 0;
  host.fetch = async (url) => {
    calls++;
    if (calls === 1) return Response.json({ code: "esv_not_configured", error: "Add the ESV_API_KEY secret." }, { status: 503 });
    const reference = new URL(url, "https://example.test").searchParams.get("reference");
    return Response.json({ reference, translation: "ESV", text: "Invented provider fixture. (ESV)" });
  };
  const controller = initDailyInspiration(() => "christmas", { root, host, now: () => day() });
  await controller.refresh();
  assert.equal(elements.get("daily-reading").hidden, true);
  assert.equal(elements.get("daily-copyright").hidden, true);
  assert.equal(elements.get("daily-retry").hidden, false);
  assert.match(elements.get("daily-status").textContent, /ESV_API_KEY/);
  await controller.refresh();
  assert.equal(calls, 1, "Focus/theme changes should not spam a failing provider");
  elements.get("daily-retry").dispatchEvent(new Event("click"));
  await controller.refresh();
  assert.equal(calls, 2);
  assert.equal(elements.get("daily-reading").hidden, false);
  assert.equal(elements.get("daily-copyright").hidden, false);
  assert.equal(elements.get("daily-status").hidden, true);
  await controller.refresh();
  assert.equal(calls, 2, "Reuse today's successful request");
  controller.destroy();
});

test("a late response from yesterday cannot replace today's passage", async () => {
  const { root, host, elements } = fixture();
  const requests = [];
  let date = day();
  host.fetch = (url) => new Promise((resolve) => requests.push({ url, resolve }));
  const controller = initDailyInspiration(() => "rose", { root, host, now: () => date });
  const oldPending = controller.refresh();
  date = day(1);
  const currentPending = controller.refresh();
  const reference = new URL(requests[1].url, "https://example.test").searchParams.get("reference");
  requests[1].resolve(Response.json({ reference, translation: "ESV", text: "Today's invented fixture. (ESV)" }));
  await currentPending;
  const oldReference = new URL(requests[0].url, "https://example.test").searchParams.get("reference");
  requests[0].resolve(Response.json({ reference: oldReference, translation: "ESV", text: "Yesterday's invented fixture. (ESV)" }));
  await oldPending;
  assert.equal(elements.get("daily-verse-reference").textContent, reference);
  assert.equal(elements.get("daily-verse-text").textContent, "Today's invented fixture. (ESV)");
  controller.destroy();
});

test("midnight hides yesterday's verse until today's request resolves, and network errors remain recoverable", async () => {
  const { root, host, elements } = fixture();
  let date = day();
  const controller = initDailyInspiration(() => "matcha", { root, host, now: () => date });
  await controller.refresh();
  host.fetch = async () => { throw new Error("Network unavailable"); };
  date = day(1);
  const pending = controller.refresh();
  assert.equal(elements.get("daily-reading").hidden, true);
  await pending;
  assert.equal(elements.get("daily-reading").hidden, true);
  assert.equal(elements.get("daily-retry").hidden, false);
  assert.match(elements.get("daily-status").textContent, /Network unavailable/);
  controller.destroy();
});

test("a timed-out verse request gets a retry message and teardown cancels its timers", async () => {
  const { root, host, elements } = fixture();
  host.fetch = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  });
  const controller = initDailyInspiration(() => "cyber", { root, host, now: () => day() });
  const pending = controller.refresh();
  [...host.timers.values()].find((timer) => timer.delay === 12000).fn();
  await pending;
  assert.match(elements.get("daily-status").textContent, /timed out/);
  assert.equal(elements.get("daily-retry").hidden, false);
  controller.destroy();
  assert.equal(host.timers.size, 0);
});
