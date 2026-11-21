import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/christmas.css", import.meta.url), "utf8");

test("Christmas has a separate picker entry, browser color, fonts, and confetti", () => {
  assert.match(app, /id: "christmas", name: "Christmas"/);
  assert.match(app, /christmas: "#f3f6ef"/);
  assert.match(app, /const THEME_CONFETTI = \{\s*christmas: \[/);
  const fonts = runInNewContext(`(${app.match(/const THEME_FONTS = (\{[\s\S]*?\n\});/)[1]})`);
  const families = new URL(fonts.christmas).searchParams.getAll("family");
  assert.ok(families.some((f) => f.startsWith("Nunito:")));
  assert.ok(families.some((f) => f.startsWith("Playfair Display:")));
  assert.match(css, /--font: "Nunito"/);
  assert.match(css, /--holiday-display: "Playfair Display"/);
  assert.match(html, /href="\/christmas.css"/);
});

test("Christmas decorations are hidden elsewhere and all overrides are scoped", () => {
  assert.match(css, /\.xm-only \{ display: none !important; \}/);
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const block of clean.split(/[{}]/)) {
    if (!block.trim() || block.includes(";") || block.trim().startsWith("@")) continue;
    for (const selector of block.trim().split(/,\s*(?=(?:\[|:root|\.tp|\.xm))/)) {
      assert.match(selector, /^(?::root)?\[data-theme="christmas"\]|^\.tp-christmas\b|^\.xm-only\b/);
    }
  }
  assert.doesNotMatch(css, /animation\s*:/, "Holiday decorations should not distract from writing");
  const garland = readFileSync(new URL("../public/christmas-garland.svg", import.meta.url), "utf8");
  assert.match(garland, /<svg /);
  assert.doesNotMatch(garland, /<script|href="(?:https?:|\/\/)/);
});

function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map((c) => parseInt(c, 16) / 255)
    .map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

test("Christmas selected chips have an explicit fill and readable labels", () => {
  const rule = css.match(/\[data-theme="christmas"\] \.chip\[aria-pressed="true"\],\s*\[data-theme="christmas"\] \.chip\[aria-checked="true"\] \{([^}]+)\}/);
  assert.ok(rule);
  assert.match(rule[1], /background: var\(--chip-color, var\(--accent\)\)/);
  assert.match(rule[1], /color: var\(--surface\)/);
  const palette = runInNewContext(app.match(/christmas: (\[[^\]]+\])/)[1]);
  const surface = css.match(/--surface: (#[\da-f]{6});/)[1];
  const accent = css.match(/--accent: (#[\da-f]{6});/)[1];
  for (const fill of [...palette, accent]) {
    const contrast = (luminance(surface) + 0.05) / (luminance(fill) + 0.05);
    assert.ok(contrast >= 4.5, `${fill} has only ${contrast.toFixed(2)}:1 contrast`);
  }
});
