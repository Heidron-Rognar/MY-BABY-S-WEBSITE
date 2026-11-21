import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateBrandIcon, normalizeBrandIcon, MAX_ICON_DATA_LENGTH } from "../public/branding.js";
import { normalizeSettings } from "../src/lib.js";

const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";

test("theme defaults preserve existing branding unless the user explicitly opts in", () => {
  assert.deepEqual(normalizeSettings().brand_icon, { mode: "theme" });
  for (const invalid of [undefined, null, [], {}, { mode: "other" }, { mode: "emoji", value: "text" }]) {
    assert.deepEqual(normalizeBrandIcon(invalid), { mode: "theme" });
  }
  assert.deepEqual(validateBrandIcon({ mode: "theme", value: "ignored" }), { mode: "theme" });
});

test("single emoji accepts compound families, flags, modifiers, and keycaps, not arbitrary text", () => {
  for (const emoji of ["🐚", "🍵", "✨", "✍️", "👩🏽‍💻", "👨‍👩‍👧‍👦", "🇵🇭", "1️⃣", "❤️"]) {
    assert.deepEqual(validateBrandIcon({ mode: "emoji", value: emoji }), { mode: "emoji", value: emoji });
  }
  for (const value of ["", "Hello", "A", "✨🐚", "✨text", "\n", "✨\ntext", "x".repeat(100000)]) {
    assert.throws(() => validateBrandIcon({ mode: "emoji", value }));
  }
});

test("title image accepts only bounded, small PNG data, never remote URLs or SVG", () => {
  assert.deepEqual(validateBrandIcon({ mode: "image", value: png }), { mode: "image", value: png });
  for (const value of ["https://example.com/logo.png", "javascript:alert(1)", "data:image/svg+xml,<svg/>", "data:image/png;base64,SGVsbG8=", png + "x".repeat(MAX_ICON_DATA_LENGTH)]) {
    assert.throws(() => validateBrandIcon({ mode: "image", value }));
  }
  const bytes = Buffer.from(png.split(",")[1], "base64");
  bytes.writeUInt32BE(1024, 16);
  assert.throws(() => validateBrandIcon({ mode: "image", value: `data:image/png;base64,${bytes.toString("base64")}` }), /128/);
  assert.deepEqual(normalizeSettings({ brand_icon: { mode: "image", value: png } }).brand_icon, { mode: "image", value: png });
});

test("custom overrides are opt-in, suppress theme ornaments, and keep images within the badge", () => {
  const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
  const html = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(css, /\.brand-mark\[data-icon-mode\]::before,[\s\S]*?content: none/);
  assert.match(css, /\.brand-mark\[data-icon-mode="image"\] img \{[^}]*object-fit: contain/);
  assert.match(html, /id="brand-icon-mode"/);
  assert.match(html, /Use original theme icon/);
  assert.match(html, /The login screen and app icon stay unchanged/);
});
