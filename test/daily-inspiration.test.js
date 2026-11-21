import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { VERSE_REFERENCES, FALLBACK_SEED, VERSE_SEED_KEY, getVerseSeed, getDailyReference, getDailyVerse, localDateKey, localDayNumber, millisecondsUntilMidnight } from "../public/daily-verses.js";
import { WEB_VERSES } from "../public/web-verses.js";
import { greetingForTheme, initDailyInspiration, salutation } from "../public/daily-inspiration.js";

const day = (offset = 0, hour = 12) => new Date(2026, 10, 21 + offset, hour);
const storage = (saved = null) => ({
  value: saved,
  getItem(key) { assert.equal(key, VERSE_SEED_KEY); return this.value; },
  setItem(key, value) { assert.equal(key, VERSE_SEED_KEY); this.value = value; },
});

test("reference pool contains exactly 100 unique single verses with bundled WEB text", () => {
  assert.equal(VERSE_REFERENCES.length, 100);
  assert.equal(new Set(VERSE_REFERENCES).size, VERSE_REFERENCES.length);
  assert.deepEqual(Object.keys(WEB_VERSES), [...VERSE_REFERENCES]);
  for (const reference of VERSE_REFERENCES) {
    assert.match(reference, /^[1-3]? ?[A-Za-z ]+ \d+:\d+$/);
    assert.equal(typeof WEB_VERSES[reference], "string");
    assert.ok(WEB_VERSES[reference].length > 10);
    assert.doesNotMatch(WEB_VERSES[reference], /<[^>]+>|\s{2,}/);
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
  const labels = new Set(["rose", "rose-dark", "matcha", "bookish", "cyber", "christmas", "beach"].map((t) => greetingForTheme(t).label));
  assert.equal(labels.size, 7);
  assert.equal(greetingForTheme("auto"), greetingForTheme("unknown"));
  assert.equal(salutation(day(0, 9)), "Good morning");
  assert.equal(salutation(day(0, 12)), "Good afternoon");
  assert.equal(salutation(day(0, 18)), "Good evening");
});

function fixture() {
  const elements = new Map(["daily-inspiration", "daily-label", "daily-title", "daily-ornament", "daily-salutation", "daily-date", "daily-verse-text", "daily-verse-reference"].map((id) => [id, Object.assign(new EventTarget(), { hidden: true, textContent: "" })]));
  const root = new EventTarget();
  root.hidden = false;
  root.querySelector = (selector) => elements.get(selector.slice(1));
  const host = new EventTarget();
  host.localStorage = storage("42");
  host.calls = [];
  host.fetch = () => { host.calls.push("fetch"); assert.fail("Bundled verses must not use a verse API"); };
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
  for (theme of ["matcha", "bookish", "cyber", "christmas", "beach", "rose-dark", "auto"]) {
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
  assert.match(html, /class="daily-version"> · WEB/);
  assert.doesNotMatch(html, /class="(?:xm-only xm-greeting|bk-only bk-frontispiece)"/);
  assert.match(html, /href="\/daily-inspiration.css"/);
});

test("the full 100-day cycle resolves real bundled WEB text without an API", () => {
  const seen = new Set();
  for (let i = 0; i < 100; i++) {
    const verse = getDailyVerse(day(i), 42);
    assert.equal(verse.reference, getDailyReference(day(i), 42));
    assert.equal(verse.translation, "WEB");
    assert.equal(verse.text, WEB_VERSES[verse.reference]);
    seen.add(verse.reference);
  }
  assert.equal(seen.size, 100);
  assert.equal(WEB_VERSES["Psalm 119:105"], "Your word is a lamp to my feet, and a light for my path.");
  assert.equal(WEB_VERSES["1 Thessalonians 5:17"], "Pray without ceasing.");
});

test("card text renders immediately, makes no fetch calls, and keeps the same verse across themes", () => {
  const { root, host, elements } = fixture();
  let theme = "rose";
  const controller = initDailyInspiration(() => theme, { root, host, now: () => day() });
  const expected = getDailyVerse(day(), 42);
  assert.equal(elements.get("daily-verse-text").textContent, expected.text);
  assert.equal(elements.get("daily-verse-reference").textContent, expected.reference);
  for (theme of ["auto", "rose", "rose-dark", "matcha", "bookish", "cyber", "christmas", "beach"]) {
    controller.refresh();
    assert.equal(elements.get("daily-verse-text").textContent, expected.text);
  }
  assert.equal(host.calls.length, 0);
  controller.destroy();
});

test("WEB source attribution replaces all API setup and error UI", () => {
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /href="https:\/\/worldenglish.bible\/"/);
  assert.match(html, /World English Bible · Public domain/);
  for (const file of ["../public/daily-inspiration.js", "../src/worker.js", "../README.md", "../.dev.vars.example", "../wrangler.jsonc"]) {
    const text = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(text, /ESV_API_KEY|api\.esv\.org|\/api\/verse/);
  }
  assert.doesNotMatch(html, /daily-status|daily-retry|daily-copyright/);
});
