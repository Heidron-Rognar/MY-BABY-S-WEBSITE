import test from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { createCalendarStamps } from "../public/calendar-stamps.js";

const settle = () => new Promise((resolve) => setImmediate(resolve));

test("day stamp chooser is available without Arrange mode and saves only the selected day", async (t) => {
  const { document, window } = parseHTML('<html><body><div id="view"></div></body></html>');
  for (const [key, value] of Object.entries({ document, window, ResizeObserver: class { observe() {} disconnect() {} }, requestAnimationFrame: (fn) => fn() })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => previous ? Object.defineProperty(globalThis, key, previous) : delete globalThis[key]);
  }
  // Supply the few browser-only form/dialog methods that this DOM implementation omits.
  Object.defineProperty(window.HTMLSelectElement.prototype, "value", {
    configurable: true,
    get() { return (this.querySelector('option[selected]') || this.querySelector('option'))?.value; },
    set(value) { this.querySelectorAll('option').forEach((o) => o.toggleAttribute('selected', o.value === value)); },
  });
  const create = document.createElement.bind(document);
  document.createElement = (tag) => {
    const el = create(tag);
    if (tag === "dialog") { el.showModal = () => { el.open = true; }; el.close = () => { el.open = false; }; }
    return el;
  };
  let prefs = { enabled: true, style: "post-paris" }, failSave = false;
  const days = ["2026-11-12", "2026-11-13"];
  const records = new Map([[days[0], { day: days[0], x: .3, y: .4, rotation: 12, style: null, updated_at: "first" }]]);
  const writes = [], preferenceWrites = [];
  const stage = document.querySelector('#view');
  const render = () => {
    controller.prepare(days);
    stage.innerHTML = controller.controlsHTML() + `<div class="cal">${days.map((day) => controller.dayHTML(day)).join('')}</div>`;
  };
  const controller = createCalendarStamps({
    getPosts: () => days.map((day) => ({ status: "posted", scheduled_at: `${day}T12:00:00` })),
    getPreferences: () => prefs,
    savePreferences: async (value) => { prefs = value; preferenceWrites.push(value); },
    api: async (path, options) => {
      if (!options) return { stamps: [...records.values()] };
      if (failSave) throw Error("Offline");
      const day = path.split('/').at(-1), { expected_updated_at, ...placement } = options.body;
      assert.equal(expected_updated_at, records.get(day)?.updated_at ?? null);
      const record = { day, ...placement, updated_at: `saved-${writes.length}` };
      records.set(day, record); writes.push({ path, body: options.body }); return { stamp: record };
    },
    onRender: render,
  });
  const click = (selector) => { const el = document.querySelector(selector); assert.ok(el, selector); el.click(); };
  render(); await settle();
  assert.equal(controller.isArranging(), false);
  assert.ok(document.querySelector('[data-stamp-action="day-style"]'));
  assert.equal(document.querySelector('[data-stamp-day]').hasAttribute('disabled'), false);

  // Open the actual stamp directly, and apply a day-specific wax design.
  click(`[data-stamp-day="${days[0]}"]`);
  assert.equal(document.querySelectorAll('.stamp-gallery button').length, 270);
  assert.match(document.querySelector('#stamp-picker-title').parentElement.textContent, /Other days and your shared default will not change/);
  assert.equal(document.querySelector('#stamp-picker-apply').textContent, "Use for this day only");
  click('[data-style="wax-pearl-shell"]'); click('#stamp-picker-apply'); await settle();
  assert.equal(records.get(days[0]).style, 'wax-pearl-shell');
  assert.deepEqual([records.get(days[0]).x, records.get(days[0]).y, records.get(days[0]).rotation], [.3, .4, 12]);
  assert.equal(records.has(days[1]), false);
  assert.deepEqual(preferenceWrites, []);

  // A different day gets its own independent design; neither choice replaces the other.
  click(`[data-stamp-day="${days[1]}"]`); click('[data-style="post-manila"]'); click('#stamp-picker-apply'); await settle();
  assert.equal(records.get(days[0]).style, 'wax-pearl-shell');
  assert.equal(records.get(days[1]).style, 'post-manila');
  assert.deepEqual(preferenceWrites, []);
  assert.equal(controller.isArranging(), false);

  // Caps have their own collection filter and can be searched by their inspiration.
  click(`[data-stamp-day="${days[1]}"]`);
  const collection = document.querySelector('#stamp-kind'); collection.value = 'cap';
  collection.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(document.querySelectorAll('.stamp-gallery button').length, 50);
  const search = document.querySelector('#stamp-search'); search.value = 'Fallout';
  search.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.equal(document.querySelectorAll('.stamp-gallery button').length, 5);
  click('[data-style="cap-fallout-1"]'); click('#stamp-picker-apply'); await settle();
  assert.equal(records.get(days[1]).style, 'cap-fallout-1');
  assert.equal(records.get(days[0]).style, 'wax-pearl-shell');
  assert.deepEqual(preferenceWrites, []);

  // New pearly reliefs have a dedicated filter plus a 25-design filter per story.
  click(`[data-stamp-day="${days[1]}"]`);
  const pearlCollection = document.querySelector('#stamp-kind'); pearlCollection.value = 'pearl';
  pearlCollection.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(document.querySelectorAll('.stamp-gallery button').length, 50);
  for (const story of ['harry-potter', 'enola-holmes']) {
    pearlCollection.value = story;
    pearlCollection.dispatchEvent(new window.Event('change', { bubbles: true }));
    assert.equal(document.querySelectorAll('.stamp-gallery button').length, 25);
  }
  click('[data-style="pearl-enola-holmes-bicycle-blooms"]'); click('#stamp-picker-apply'); await settle();
  assert.equal(records.get(days[1]).style, 'pearl-enola-holmes-bicycle-blooms');
  assert.equal(records.get(days[0]).style, 'wax-pearl-shell');
  assert.deepEqual(preferenceWrites, []);

  // Literary postage can be filtered by the corrected book/author without changing other days.
  click(`[data-stamp-day="${days[1]}"]`);
  const bookCollection = document.querySelector('#stamp-kind'); bookCollection.value = 'bright-years';
  bookCollection.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(document.querySelectorAll('.stamp-gallery button').length, 50);
  const bookSearch = document.querySelector('#stamp-search'); bookSearch.value = 'Sarah Damoff';
  bookSearch.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.equal(document.querySelectorAll('.stamp-gallery button').length, 50);
  bookSearch.value = 'Porch Light'; bookSearch.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.equal(document.querySelectorAll('.stamp-gallery button').length, 1);
  click('[data-style="post-bright-years-porch-light"]'); click('#stamp-picker-apply'); await settle();
  assert.equal(records.get(days[1]).style, 'post-bright-years-porch-light');
  assert.equal(records.get(days[0]).style, 'wax-pearl-shell');
  assert.deepEqual(preferenceWrites, []);

  // Embroidered patches have a dedicated collection and searchable themes.
  click(`[data-stamp-day="${days[1]}"]`);
  const patchCollection = document.querySelector('#stamp-kind'); patchCollection.value = 'patch';
  patchCollection.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(document.querySelectorAll('.stamp-gallery button').length, 20);
  const patchSearch = document.querySelector('#stamp-search');
  for (const theme of ['flowers', 'skies', 'beach', 'books', 'calligraphy', 'art', 'matcha']) {
    patchSearch.value = theme; patchSearch.dispatchEvent(new window.Event('input', { bubbles: true }));
    assert.ok(document.querySelectorAll('.stamp-gallery button').length > 0, theme);
  }
  click('[data-style="patch-matcha-book-club"]');
  assert.equal(document.querySelector('#stamp-big-preview').dataset.kind, 'patch');
  click('#stamp-picker-apply'); await settle();
  assert.equal(records.get(days[1]).style, 'patch-matcha-book-club');
  assert.equal(records.get(days[0]).style, 'wax-pearl-shell');
  assert.deepEqual(preferenceWrites, []);

  // Keyboard-accessible select/button path uses the selected date too.
  const daySelect = document.querySelector('#stamp-day-choice'); daySelect.value = days[0];
  daySelect.dispatchEvent(new window.Event('change', { bubbles: true }));
  click('[data-stamp-action="day-style"]'); click('[data-style="post-palawan"]'); click('#stamp-picker-cancel');
  assert.equal(writes.length, 6); assert.equal(records.get(days[0]).style, 'wax-pearl-shell');

  // Failure never overwrites another day or the default and keeps the picker open.
  failSave = true;
  click(`[data-stamp-day="${days[0]}"]`); click('[data-style="post-palawan"]'); click('#stamp-picker-apply'); await settle();
  assert.match(document.querySelector('#stamp-picker-status').textContent, /Offline/);
  assert.equal(document.querySelector('.stamp-picker').open, true);
  assert.equal(records.get(days[0]).style, 'wax-pearl-shell');
  assert.equal(records.get(days[1]).style, 'patch-matcha-book-club');
  click('#stamp-picker-cancel'); failSave = false;

  // Shared default is a separate, explicitly labeled action, never a side effect.
  click('[data-stamp-action="default-style"]');
  assert.match(document.querySelector('#stamp-picker-apply').textContent, /Update shared default/);
  click('[data-style="post-palawan"]'); click('#stamp-picker-apply'); await settle();
  assert.equal(prefs.style, 'post-palawan'); assert.equal(preferenceWrites.length, 1);
  assert.equal(records.get(days[0]).style, 'wax-pearl-shell');
  assert.equal(records.get(days[1]).style, 'patch-matcha-book-club');

  controller.leave(); render(); await settle();
  assert.match(document.querySelector(`[data-stamp-day="${days[0]}"]`).getAttribute('aria-label'), /Pearl/);
  assert.match(document.querySelector(`[data-stamp-day="${days[1]}"]`).getAttribute('aria-label'), /Matcha Book Club/);
});
