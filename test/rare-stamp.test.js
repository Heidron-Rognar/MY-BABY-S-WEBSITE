import test from "node:test";
import assert from "node:assert/strict";
import {
  STAMP_STYLES,
  RARE_STAMP_ID,
  RARE_STAMP_GOAL,
  RARE_STAMP_MESSAGE,
  RARE_STAMP_DATE_LABEL,
  RARE_STAMP_DATE,
  BADOG_PATROL_ID,
  BADOG_PATROL_GOAL,
  BADOG_PATROL_MESSAGE,
  isBadogPatrolGoal,
  isBadogPatrolUnlocked,
  postedCaptionCount,
  isRareStampGoal,
  isRareStampUnlocked,
  visibleStampStyles,
  validateStampPlacement,
  validateStampPreferences,
  DEFAULT_STAMP_PLACEMENT,
} from "../public/stamp-catalog.js";
import { stampSvg, stampImageUrl } from "../public/stamp-art.js";
import { tubbyCatSvg } from "../public/rare-stamp-art.js";
import { readFileSync } from "node:fs";

const posts = (n, extra = {}) =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, status: "posted", scheduled_at: "2026-11-22T12:00:00", ...extra }));

test("rare stamp is one-of-a-kind, distinct kind, and accepted by validators", () => {
  const rare = STAMP_STYLES.filter((s) => s.kind === "rare");
  assert.equal(rare.length, 1);
  assert.equal(rare[0].id, RARE_STAMP_ID);
  assert.equal(rare[0].id, "rare-henlo-love");
  assert.notEqual(rare[0].kind, "postage");
  assert.notEqual(rare[0].kind, "wax");
  assert.notEqual(rare[0].kind, "patch");
  assert.equal(validateStampPlacement({ ...DEFAULT_STAMP_PLACEMENT, style: RARE_STAMP_ID }).style, RARE_STAMP_ID);
  assert.equal(validateStampPreferences({ enabled: true, style: RARE_STAMP_ID }).style, RARE_STAMP_ID);
  assert.match(stampImageUrl(RARE_STAMP_ID), /^data:image\/svg\+xml;charset=utf-8,/);
});

test("rare artwork shows couple selfie, dog, boy scout, house with balloons, and immigration date", () => {
  const svg = stampSvg(RARE_STAMP_ID);
  assert.match(svg, /^<svg xmlns=/);
  assert.doesNotMatch(svg, /undefined|NaN|<script|<foreignObject|<image|https?:\/\/(?!www\.w3\.org\/2000\/svg)/);
  assert.ok(svg.length < 12000, `rare svg too large: ${svg.length}`);
  // Immigration stamp: fixed today date, not the per-day cancellation.
  assert.match(svg, /22 NOV 2026/);
  assert.match(svg, /ADMITTED WITH LOVE/);
  assert.match(svg, /HENLO MY LOVE/);
  assert.match(svg, /UP, UP &amp; AWAY/);
  assert.match(svg, /ONE OF A KIND/);
  assert.match(svg, /13 POSTED/);
  // Scene elements (balloons, house, phone selfie, dog collar, scout sash).
  assert.match(svg, /<ellipse cx="122" cy="52"/);
  assert.match(svg, /<rect x="118" y="82"/);
  assert.match(svg, /<rect x="73" y="80"/);
  assert.match(svg, /stroke="#e2557c" stroke-width="2\.4"/);
  assert.match(svg, /stroke="#8a5a3b" stroke-width="2\.6"/);
  // Fixed date regardless of the day argument (one-of-a-kind dated stamp).
  assert.equal(stampSvg(RARE_STAMP_ID, "2026-11-12"), svg);
  assert.equal(stampSvg(RARE_STAMP_ID, "2026-11-22"), svg);
  assert.equal(RARE_STAMP_DATE, "2026-11-22");
  assert.equal(RARE_STAMP_DATE_LABEL, "22 NOV 2026");
});

test("posted count includes archived history and only counts posted status", () => {
  assert.equal(postedCaptionCount([]), 0);
  assert.equal(postedCaptionCount(null), 0);
  assert.equal(postedCaptionCount(posts(13)), 13);
  assert.equal(postedCaptionCount([...posts(12), { status: "draft" }, { status: "ready" }, { status: "idea" }]), 12);
  assert.equal(postedCaptionCount([...posts(10), ...posts(3, { archived_at: "2026-11-23T00:00:00" })]), 13);
  assert.equal(postedCaptionCount([{ status: "posted" }, null, undefined, {}]), 1);
});

test("Tubby only visits at exactly 13 posted captions", () => {
  assert.equal(RARE_STAMP_GOAL, 13);
  assert.equal(isRareStampGoal(13), true);
  assert.equal(isRareStampGoal(12), false);
  assert.equal(isRareStampGoal(14), false);
  assert.equal(isRareStampGoal(0), false);
  assert.equal(isRareStampGoal(100), false);
});

test("rare stamp and special patch stay hidden from the picker until unlocked, then join the collection", () => {
  const lockedStore = { getItem: () => null };
  const rareStore = { getItem: (k) => (k === "cs-rare-stamp-unlocked" ? "1" : null) };
  const bothStore = { getItem: (k) => (k === "cs-rare-stamp-unlocked" || k === "cs-badog-patrol-unlocked" ? "1" : null) };
  assert.equal(isRareStampUnlocked(lockedStore), false);
  assert.equal(isRareStampUnlocked(rareStore), true);
  assert.equal(isRareStampUnlocked({ getItem: () => { throw new Error("blocked"); } }), false);
  assert.equal(isBadogPatrolUnlocked(lockedStore), false);
  assert.equal(isBadogPatrolUnlocked(bothStore), true);
  assert.equal(visibleStampStyles(lockedStore).length, 270);
  assert.equal(visibleStampStyles(lockedStore).some((s) => s.kind === "rare"), false);
  assert.equal(visibleStampStyles(lockedStore).some((s) => s.special), false);
  assert.equal(visibleStampStyles(rareStore).length, 271);
  assert.equal(visibleStampStyles(rareStore).some((s) => s.id === RARE_STAMP_ID), true);
  assert.equal(visibleStampStyles(rareStore).some((s) => s.special), false);
  assert.equal(visibleStampStyles(bothStore).length, 272);
  assert.equal(visibleStampStyles(bothStore).some((s) => s.id === BADOG_PATROL_ID), true);
});

test("Badog Patrol special patch: exactly 30, verbatim message, circular patch with lettering", () => {
  assert.equal(BADOG_PATROL_GOAL, 30);
  assert.equal(isBadogPatrolGoal(30), true);
  assert.equal(isBadogPatrolGoal(29), false);
  assert.equal(isBadogPatrolGoal(31), false);
  assert.equal(
    BADOG_PATROL_MESSAGE,
    "Henlo love, i hope you re doing well there, Keep on living marami pa tayong gagawin together ahihi. Nothing special sa number just checking on you lang. I love you!"
  );
  const style = STAMP_STYLES.find((s) => s.id === BADOG_PATROL_ID);
  assert.equal(style.kind, "patch");
  assert.equal(style.special, true);
  assert.equal(style.shape, "circle");
  assert.equal(validateStampPlacement({ ...DEFAULT_STAMP_PLACEMENT, style: BADOG_PATROL_ID }).style, BADOG_PATROL_ID);
  assert.equal(validateStampPreferences({ enabled: true, style: BADOG_PATROL_ID }).style, BADOG_PATROL_ID);
  const svg = stampSvg(BADOG_PATROL_ID);
  assert.match(svg, /^<svg xmlns=/);
  assert.doesNotMatch(svg, /undefined|NaN|<script|<foreignObject|<image|https?:\/\/(?!www\.w3\.org\/2000\/svg)/);
  assert.match(svg, /cloth-weave/);
  // "BADOG PATROL" lettered around the top arc — one <text> per letter.
  assert.match(svg, />B<\/text><text[^>]*>A<\/text><text[^>]*>D<\/text><text[^>]*>O<\/text><text[^>]*>G<\/text>/);
  assert.match(svg, />P<\/text><text[^>]*>A<\/text><text[^>]*>T<\/text><text[^>]*>R<\/text><text[^>]*>O<\/text><text[^>]*>L<\/text>/);
  assert.match(svg, /patch-shape/);
  assert.ok(svg.length < 16000);
});

test("word-per-word letter is exact and Tubby cat is pixel art", () => {
  assert.equal(
    RARE_STAMP_MESSAGE,
    "Henlo my love, you re doing really fine if you've seen this message. I am so proud of you for reaching your dreams, tomorrow will be a big struggle but you'll be fine because I know you're a strong person. I love you so so much! Keep up the good work my love!"
  );
  assert.ok(RARE_STAMP_MESSAGE.split(/\s+/).length > 30);
  const cat = tubbyCatSvg();
  assert.match(cat, /^<svg xmlns=/);
  assert.match(cat, /shape-rendering="crispEdges"/);
  assert.match(cat, /viewBox="0 0 18 16"/);
  assert.match(cat, /tubby-leg/);
  assert.doesNotMatch(cat, /undefined|NaN|<script|<image|https?:\/\/(?!www\.w3\.org\/2000\/svg)/);
  assert.ok(cat.length > 1000);
});

test("rare glow, cat walk, plain counter and unlock window styles are wired", () => {
  const css = readFileSync(new URL("../public/rare-stamp.css", import.meta.url), "utf8");
  assert.match(css, /\.completion-stamp\.rare/);
  assert.match(css, /rare-glow/);
  assert.match(css, /drop-shadow\(0 0 6px #ff6ec7\)/);
  assert.match(css, /\.tubby-cat/);
  assert.match(css, /tubby-walk/);
  assert.match(css, /image-rendering: pixelated/);
  assert.match(css, /\.posted-counter/);
  assert.match(css, /\.rare-stamp-dialog/);
  assert.match(css, /\.rare-message \.w/);
  assert.match(css, /\.rare-immigration-badge/);
  assert.match(css, /badog-badge/);
  assert.match(css, /special-glow/);
  assert.match(css, /\.completion-stamp\.special/);
  // Plain counter: number only — no goal, no bar, no dots, no hint text.
  assert.doesNotMatch(css, /pc-goal|pc-bar|pc-dots|pc-hint/);
  const js = readFileSync(new URL("../public/rare-stamp.js", import.meta.url), "utf8");
  assert.match(js, /Congratulations! You've unlocked a rare Stamp/);
  assert.match(js, /Tubby brought you a special patch!/);
  assert.match(js, /isRareStampGoal/);
  assert.match(js, /isBadogPatrolGoal/);
  assert.match(js, /RARE_STAMP_MESSAGE/);
  assert.match(js, /BADOG_PATROL_MESSAGE/);
  assert.doesNotMatch(js, /hintFor|questPanel|13\/13/);
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /rare-stamp\.css/);
  const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(app, /initRareStamp/);
  assert.match(app, /rareStamp\?\.refresh\(\)/);
});
