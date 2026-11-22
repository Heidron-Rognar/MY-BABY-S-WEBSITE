import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { STAMP_STYLES, STAMP_IDS, DEFAULT_STAMP_PLACEMENT, completedCaptionDays, validateStampPreferences, normalizeStampPreferences, validateStampPlacement, validStampDay, stampBounds } from "../public/stamp-catalog.js";
import { stampSvg, stampImageUrl } from "../public/stamp-art.js";
import { normalizeSettings } from "../src/lib.js";

test("270 distinct designs include 20 original embroidered patches", () => {
  assert.equal(STAMP_STYLES.length, 270); assert.equal(STAMP_IDS.size, 270);
  assert.equal(STAMP_STYLES.filter((s) => s.kind === "postage").length, 100);
  assert.equal(STAMP_STYLES.filter((s) => s.kind === "wax").length, 100);
  assert.equal(new Set(STAMP_STYLES.map((s) => s.name)).size, 270);
  assert.equal(STAMP_STYLES.filter((s) => s.kind === "cap").length, 50);
  const images = STAMP_STYLES.map((s) => stampSvg(s.id));
  assert.equal(new Set(images).size, 270);
  for (const [index, svg] of images.entries()) {
    assert.match(svg, /^<svg xmlns=/); assert.doesNotMatch(svg, /undefined|<script|<foreignObject|onload=|https?:\/\/(?!www.w3.org\/2000\/svg)/);
    assert.ok(svg.length < (STAMP_STYLES[index].kind === "patch" ? 16000 : 12000));
  }
});

test("only nonempty, entirely posted scheduled days qualify, including archived history", () => {
  const posts = [
    { scheduled_at: "2026-11-12T12:00:00", status: "posted" },
    { scheduled_at: "2026-11-12T18:00:00", status: "posted", archived_at: "2026-11-13" },
    { scheduled_at: "2026-11-13T12:00:00", status: "posted" },
    { scheduled_at: "2026-11-13T18:00:00", status: "ready" },
    { scheduled_at: "2026-11-14T18:00:00", status: "draft" },
    { scheduled_at: null, status: "posted" }, { scheduled_at: "bad", status: "posted" },
  ];
  assert.deepEqual([...completedCaptionDays(posts)], [["2026-11-12", { total: 2, posted: 2 }]]);
  assert.equal(completedCaptionDays([]).size, 0);
  // A status reversal removes the award without deleting the remembered layout.
  posts[0].status = "draft"; assert.equal(completedCaptionDays(posts).size, 0);
  posts[0].status = "posted"; assert.equal(completedCaptionDays(posts).size, 1);
});

test("completion uses device-local dates, not UTC or Telegram reminder timezone", () => {
  const url = new URL("../public/stamp-catalog.js", import.meta.url).href;
  execFileSync(process.execPath, ["--input-type=module", "-e", `import assert from 'node:assert/strict';import{completedCaptionDays}from'${url}';assert.equal([...completedCaptionDays([{scheduled_at:'2026-11-12T17:00:00Z',status:'posted'}]).keys()][0],'2026-11-13');`], { env: { ...process.env, TZ: "Asia/Manila" } });
});

test("preference and placement validators reject unknown styles, dates, coordinates, and rotation", () => {
  assert.deepEqual(normalizeSettings().completion_stamps, { enabled: true, style: "post-paris" });
  assert.deepEqual(normalizeStampPreferences({ style: "bad" }), { enabled: true, style: "post-paris" });
  assert.deepEqual(validateStampPreferences({ enabled: false, style: "wax-pearl-shell" }), { enabled: false, style: "wax-pearl-shell" });
  for (const value of [{ enabled: "yes", style: "post-paris" }, { enabled: true, style: "fake" }]) assert.throws(() => validateStampPreferences(value));
  assert.deepEqual(validateStampPlacement(DEFAULT_STAMP_PLACEMENT), DEFAULT_STAMP_PLACEMENT);
  for (const change of [{ x: -1 }, { x: NaN }, { y: Infinity }, { y: 1.1 }, { x: "0.5" }, { rotation: 40 }, { style: "<script>" }]) assert.throws(() => validateStampPlacement({ ...DEFAULT_STAMP_PLACEMENT, ...change }));
  assert.equal(validStampDay("2028-02-29"), true);
  for (const day of ["2026-02-29", "2026-02-30", "2026-13-01", "2026-11-2", "../file", null]) assert.equal(validStampDay(day), false);
});

test("normalized positions keep the entire rotated design within desktop/mobile reserved bays", () => {
  for (const [width, height, bayWidth, bayHeight] of [[62, 72.33, 120, 94], [30, 35, 44, 60], [62, 62, 120, 94]]) {
    for (const rotation of [-18, -8, 0, 18]) {
      const bounds = stampBounds(width, height, bayWidth, bayHeight, rotation);
      assert.ok(bounds.left >= 0 && bounds.top >= 0);
      for (const [x, y] of [[0, 0], [.82, .7], [1, 1]]) {
        const left = bounds.left + x * bounds.travelX, top = bounds.top + y * bounds.travelY;
        assert.ok(left - bounds.left >= -.00001 && top - bounds.top >= -.00001);
        assert.ok(left + width + bounds.left <= bayWidth + .001);
        assert.ok(top + height + bounds.top <= bayHeight + .001);
      }
    }
  }
});

test("postage date is deterministic and invalid injected dates never become SVG markup", () => {
  const image = stampSvg("post-paris", "2026-11-12");
  assert.match(image, /12\.11\.2026/);
  assert.equal(stampImageUrl("post-paris", "2026-11-12"), stampImageUrl("post-paris", "2026-11-12"));
  assert.doesNotMatch(stampSvg("post-paris", '<script>alert(1)</script>'), /<script>/);
  assert.match(stampImageUrl("wax-pearl-shell"), /^data:image\/svg\+xml;charset=utf-8,/);
});

test("all 50 postage designs remain byte-for-byte unchanged", async () => {
  const { createHash } = await import("node:crypto");
  const rendered = STAMP_STYLES.filter((s) => s.kind === "postage" && !s.collectionId).map((s) => stampSvg(s.id, "2026-11-12")).join("\n");
  assert.equal(createHash("sha256").update(rendered).digest("hex"), "f29bd2d2013a5c05a2a59abba5862eaa4189b771f37e4c929eaf0db088e5006e");
});

test("ten named cap collections offer five distinct fictional flavors each, accepted by placement validation", () => {
  const caps = STAMP_STYLES.filter((s) => s.kind === "cap");
  const collections = [...new Set(caps.map((s) => s.collection))];
  assert.equal(collections.length, 10);
  for (const name of ["Stranger Things", "Fallout", "Cyberpunk", "The Witcher", "Crimson Desert"]) assert.ok(collections.includes(name));
  for (const name of collections) {
    const group = caps.filter((s) => s.collection === name);
    assert.equal(group.length, 5); assert.equal(new Set(group.map((s) => s.title)).size, 5);
    assert.equal(new Set(group.map((s) => stampSvg(s.id))).size, 5);
  }
  for (const cap of caps) {
    assert.equal(validateStampPlacement({ ...DEFAULT_STAMP_PLACEMENT, style: cap.id }).style, cap.id);
    assert.match(stampSvg(cap.id), /id="metal"/);
    assert.match(stampSvg(cap.id), /<polygon points=/);
    assert.doesNotMatch(stampSvg(cap.id), /NaN|undefined/);
  }
});

test("wax preserves the 50 saved IDs and uses engraved botanical relief, inset rims and texture", () => {
  const waxes = STAMP_STYLES.filter((s) => s.kind === "wax" && s.finish !== "pearl");
  assert.equal(waxes.length, 50);
  for (const wax of waxes) {
    const svg = stampSvg(wax.id);
    assert.match(svg, /id="engraving"/); assert.match(svg, /id="wax-grain"/);
    assert.match(svg, /id="wax-well"/); assert.equal((svg.match(/<use href="#engraving"/g) || []).length, 2);
    assert.equal(stampSvg(wax.id, "2026-11-12"), svg);
  }
});

test("50 new pearly wax seals have distinct motifs split evenly between Harry Potter and Enola Holmes", () => {
  const pearl = STAMP_STYLES.filter((s) => s.finish === "pearl");
  assert.equal(pearl.length, 50); assert.equal(new Set(pearl.map((s) => s.art)).size, 50);
  for (const collection of ["Harry Potter", "Enola Holmes"]) {
    assert.equal(pearl.filter((s) => s.collection === collection).length, 25);
  }
  for (const s of pearl) {
    assert.equal(s.kind, "wax");
    assert.equal(validateStampPlacement({ ...DEFAULT_STAMP_PLACEMENT, style: s.id }).style, s.id);
    assert.equal(validateStampPreferences({ enabled: true, style: s.id }).style, s.id);
    const svg = stampSvg(s.id);
    assert.match(svg, /id="raised"/); assert.match(svg, /id="pearl-body"/);
    assert.doesNotMatch(svg, /undefined|NaN|<image|<text/);
  }
});

test("the previous 150 postage, engraved wax and cap renderings stay unchanged", async () => {
  const { createHash } = await import("node:crypto");
  const previous = STAMP_STYLES.filter((s) => s.finish !== "pearl" && s.collectionId !== "bright-years" && s.kind !== "patch");
  assert.equal(previous.length, 150);
  const rendered = previous.map((s) => stampSvg(s.id, "2026-11-12")).join("\n");
  assert.equal(createHash("sha256").update(rendered).digest("hex"), "45e1e4dbd083a74b9e389855aae922bfd0407da6278e0f5f65754b51e282d6e5");
});

test("50 distinct spoiler-light Bright Years postage designs identify Sarah Damoff correctly", async () => {
  const { BRIGHT_YEARS_ART } = await import('../public/bright-years-art.js');
  const literary = STAMP_STYLES.filter((s) => s.collectionId === 'bright-years');
  assert.equal(literary.length, 50); assert.equal(Object.keys(BRIGHT_YEARS_ART).length, 50);
  assert.equal(new Set(literary.map((s) => s.art)).size, 50);
  for (const style of literary) {
    assert.equal(style.kind, 'postage'); assert.equal(style.author, 'Sarah Damoff');
    assert.match(style.name, /The Bright Years · Sarah Damoff$/);
    assert.ok(BRIGHT_YEARS_ART[style.art]);
    assert.equal(validateStampPlacement({ ...DEFAULT_STAMP_PLACEMENT, style: style.id }).style, style.id);
    assert.equal(validateStampPreferences({ enabled: true, style: style.id }).style, style.id);
    const svg = stampSvg(style.id, '2026-11-12');
    assert.match(svg, /THE BRIGHT YEARS/); assert.match(svg, /SARAH DAMOFF/);
    assert.match(svg, /12\.11\.2026/); assert.doesNotMatch(svg, /undefined|NaN|Alison|Espach|<image/);
  }
});

test("all previous 200 designs retain their exact artwork", async () => {
  const { createHash } = await import('node:crypto');
  const previous = STAMP_STYLES.filter((s) => s.collectionId !== 'bright-years' && s.kind !== 'patch');
  assert.equal(previous.length, 200);
  const rendered = previous.map((s) => stampSvg(s.id, '2026-11-12')).join('\n');
  assert.equal(createHash('sha256').update(rendered).digest('hex'), '9a59590fec1b2e64b86eb72ed1adc8dea1df2b10b7853bb1e36acdad512f12f7');
});
