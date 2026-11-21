import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { greetingForTheme } from "../public/daily-inspiration.js";

const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/beach.css", import.meta.url), "utf8");

test("Beach is a separate persisted-theme option with a preview, palette, and browser color", () => {
  assert.match(app, /id: "beach", name: "Beach"/);
  assert.match(app, /preview: "tp-beach"/);
  assert.match(app, /beach: "#e7f5f1"/);
  for (const name of ["THEME_PALETTES", "THEME_CONFETTI"]) {
    const values = runInNewContext(`(${app.match(new RegExp(`const ${name} = (\\{[\\s\\S]*?\\n\\});`))[1]})`, { CYBER_PALETTE: [] });
    assert.ok(values.beach.length >= 5);
  }
  assert.match(html, /href="\/beach.css"/);
  assert.equal(greetingForTheme("beach").label, "A MOMENT BY THE SEA");
  assert.notEqual(greetingForTheme("beach"), greetingForTheme("auto"));
});

test("Beach scenery stays local, lightweight, static, and isolated from existing themes", () => {
  assert.match(css, /\.beach-only \{ display: none !important; \}/);
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const block of clean.split(/[{}]/)) {
    if (!block.trim() || block.includes(";") || block.trim().startsWith("@")) continue;
    for (const selector of block.trim().split(/,\s*(?=(?:\[|:root|\.tp|\.beach))/)) {
      assert.match(selector, /^(?::root)?\[data-theme="beach"\]|^\.tp-beach\b|^\.beach-only\b/);
    }
  }
  assert.doesNotMatch(css, /animation\s*:|https?:/);
  for (const asset of ["beach-water.jpg", "beach-shell.svg"]) {
    assert.ok(statSync(new URL(`../public/${asset}`, import.meta.url)).size < 500_000);
    assert.ok(css.includes(`/${asset}`));
  }
  const shell = readFileSync(new URL("../public/beach-shell.svg", import.meta.url), "utf8");
  assert.doesNotMatch(shell, /<script|href=/);
  assert.match(html, /class="beach-only beach-letter-head" aria-hidden="true"/);
  assert.match(css, /@media \(max-width: 640px\)/);
});

function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map((c) => parseInt(c, 16) / 255)
    .map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);

test("Beach selected chips and body text meet AA contrast on solid pearl surfaces", () => {
  const rule = css.match(/\[data-theme="beach"\] \.chip\[aria-pressed="true"\],\s*\[data-theme="beach"\] \.chip\[aria-checked="true"\] \{([^}]+)\}/);
  assert.ok(rule);
  assert.match(rule[1], /background: var\(--chip-color, var\(--accent\)\)/);
  assert.match(rule[1], /color: var\(--surface\)/);
  const palette = runInNewContext(app.match(/beach: (\[[^\]]+\])/)[1]);
  const variable = (name) => css.match(new RegExp(`--${name}: (#[\\da-f]{6});`))[1];
  for (const fill of [...palette, variable("accent")]) {
    assert.ok(contrast(variable("surface"), fill) >= 4.5, `${fill} has insufficient selected-label contrast`);
  }
  for (const text of ["text", "muted", "accent"]) {
    for (const surface of ["surface", "surface-2"]) {
      assert.ok(contrast(variable(text), variable(surface)) >= 4.5, `${text} on ${surface}`);
    }
  }
});
