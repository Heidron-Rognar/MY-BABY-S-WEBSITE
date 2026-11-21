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
  assert.deepEqual(Object.keys(runtimeFonts).sort(), ["bookish", "christmas", "cyber", "matcha"]);
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


test("Bookish registers a separate font pairing, palette, and picker entry", () => {
  const families = new URL(runtimeFonts.bookish).searchParams.getAll("family");
  assert.ok(families.some((family) => family.startsWith("Cormorant Garamond:")));
  assert.ok(families.some((family) => family.startsWith("Literata:")));
  assert.match(app, /id: "bookish", name: "Bookish"/);
  assert.match(app, /bookish: "#f2eadb"/);
  assert.match(app, /const THEME_PALETTES = \{\s*bookish: \[/);
  assert.match(app, /const THEME_CONFETTI = \{[\s\S]*?bookish: \[/);
  assert.match(html, /href="\/bookish.css"/);
});

test("Bookish styles are isolated from Matcha and the other themes", () => {
  const bookish = readFileSync(new URL("../public/bookish.css", import.meta.url), "utf8");
  assert.match(bookish, /\.bk-only \{ display: none !important; \}/);
  assert.match(bookish, /--book-display: "Cormorant Garamond"/);
  assert.doesNotMatch(bookish, /data-theme="matcha"/);
  // Every selector must target Bookish, its swatch, or its hidden-only decorations.
  const clean = bookish.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const block of clean.split(/[{}]/)) {
    if (!block.trim() || block.includes(";") || block.trim().startsWith("@")) continue;
    for (const selector of block.trim().split(/,\s*(?=(?:\[|:root|\.tp|\.bk))/)) {
      assert.match(selector, /^(?::root)?\[data-theme="bookish"\]|^\.tp-bookish\b|^\.bk-only\b/);
    }
  }
});
