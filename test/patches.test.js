import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PATCH_STYLES } from '../public/patch-catalog.js';
import { STAMP_STYLES, DEFAULT_STAMP_PLACEMENT, validateStampPlacement, validateStampPreferences } from '../public/stamp-catalog.js';
import { stampSvg } from '../public/stamp-art.js';

test('20 distinct embroidered compositions cover all requested themes with varied cloth colors and silhouettes', () => {
  assert.equal(PATCH_STYLES.length, 20);
  assert.equal(new Set(PATCH_STYLES.map((p) => p.art)).size, 20);
  assert.equal(new Set(PATCH_STYLES.map((p) => p.color)).size, 20);
  assert.equal(new Set(PATCH_STYLES.map((p) => p.shape)).size, 6);
  for (const theme of ['flowers', 'skies', 'beach', 'shell', 'books', 'calligraphy', 'art', 'matcha']) {
    assert.ok(PATCH_STYLES.some((p) => p.tags.includes(theme)), theme);
  }
  for (const p of PATCH_STYLES) {
    assert.equal(p.kind, 'patch');
    assert.equal(validateStampPlacement({ ...DEFAULT_STAMP_PLACEMENT, style: p.id }).style, p.id);
    assert.equal(validateStampPreferences({ enabled: true, style: p.id }).style, p.id);
  }
});

test('patch artwork has fabric weave, satin thread, raised details and stitched edges, not flat recolored icons', () => {
  const artwork = PATCH_STYLES.map((p) => stampSvg(p.id));
  assert.equal(new Set(artwork).size, 20);
  for (const svg of artwork) {
    for (const id of ['cloth-weave', 'silk-thread', 'patch-shape', 'thread-lift']) assert.ok(svg.includes(`id="${id}"`), id);
    assert.match(svg, /stroke-dasharray=/);
    assert.match(svg, /clip-path="url\(#patch-shape\)"/);
    assert.doesNotMatch(svg, /undefined|NaN|<script|<foreignObject|<image/);
    assert.ok(svg.length < 16000);
  }
});

test('all prior 250 artworks remain byte-for-byte unchanged', () => {
  const previous = STAMP_STYLES.filter((s) => s.kind !== 'patch' && s.kind !== 'rare');
  assert.equal(previous.length, 250);
  const rendered = previous.map((s) => stampSvg(s.id, '2026-11-12')).join('\n');
  assert.equal(createHash('sha256').update(rendered).digest('hex'), '0355966d685189dde535f343e109d957aead53c264194ef99d55c6a98d15beb3');
});
