import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const runtimeFonts = runInNewContext(`(${app.match(/const THEME_FONTS = (\{[\s\S]*?\n\});/)[1]})`);
const startupFonts = runInNewContext(`(${html.match(/var fonts = (\{[\s\S]*?\n        \});/)[1]})`);

test("saved-theme startup and runtime switching request identical font families", () => {
  assert.deepEqual(Object.keys(runtimeFonts).sort(), ["cyber", "matcha"]);
  for (const theme of Object.keys(runtimeFonts)) {
    assert.equal(startupFonts[theme], runtimeFonts[theme]);
    assert.equal(new URL(runtimeFonts[theme]).searchParams.get("display"), "swap");
  }
});

test("Cyber loads the heading and terminal fonts used in its CSS", () => {
  const families = new URL(runtimeFonts.cyber).searchParams.getAll("family");
  assert.ok(families.some((family) => family.startsWith("Chakra Petch:")));
  assert.ok(families.some((family) => family.startsWith("IBM Plex Mono:")));
  assert.match(css, /--font: "Chakra Petch"/);
  assert.match(css, /--wide: "Chakra Petch"/);
  assert.match(css, /--mono: "IBM Plex Mono"/);
  assert.match(css, /\[data-theme="cyber"\] \.caption-wrap textarea \{[^}]*font-family: var\(--mono\)/);
  assert.match(css, /\[data-theme="cyber"\] \.notes textarea \{[^}]*font-family: var\(--mono\)/);
});

test("Matcha retains its bookish pairing and readable notebook metrics", () => {
  const families = new URL(runtimeFonts.matcha).searchParams.getAll("family");
  assert.ok(families.some((family) => family.startsWith("Fraunces:")));
  assert.ok(families.some((family) => family.startsWith("Literata:")));
  assert.match(css, /--font: "Literata"/);
  assert.match(css, /--serif-display: "Fraunces"/);
  assert.match(css, /\[data-theme="matcha"\] \.caption-wrap textarea \{\s*--lh: 27px;\s*line-height: var\(--lh\)/);
});
