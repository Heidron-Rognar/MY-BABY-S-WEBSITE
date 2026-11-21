import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const css = readFileSync(new URL("../public/bookish.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");

test("Bookish selected filters and editor options override the paper chip background", () => {
  const selected = css.match(/\[data-theme="bookish"\] \.chip\[aria-pressed="true"\],\s*\[data-theme="bookish"\] \.chip\[aria-checked="true"\] \{([^}]+)\}/);
  assert.ok(selected, "Both pressed filters and checked editor options need a selected rule");
  assert.match(selected[1], /background: var\(--chip-color, var\(--accent\)\)/);
  assert.match(selected[1], /border-color: var\(--chip-color, var\(--accent\)\)/);
  assert.match(selected[1], /color: var\(--surface\)/);
  assert.match(css, /\[data-theme="bookish"\] \.chip\[aria-pressed="true"\] \.dot,\s*\[data-theme="bookish"\] \.chip\[aria-checked="true"\] \.dot \{ background: var\(--surface\); \}/);
});

function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map((c) => parseInt(c, 16) / 255)
    .map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

test("Bookish selected labels meet WCAG AA contrast for every type and the default accent", () => {
  const palette = runInNewContext(app.match(/const THEME_PALETTES = \{\s*bookish: (\[[^\]]+\])/)[1]);
  const surface = css.match(/--surface: (#[\da-f]{6});/)[1];
  const accent = css.match(/--accent: (#[\da-f]{6});/)[1];
  for (const fill of [...palette, accent]) {
    const contrast = (luminance(surface) + 0.05) / (luminance(fill) + 0.05);
    assert.ok(contrast >= 4.5, `${fill} has only ${contrast.toFixed(2)}:1 contrast`);
  }
});
