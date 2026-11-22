import { STAMP_STYLES, stampStyle, DEFAULT_STAMP_PLACEMENT, normalizeStampPreferences, completedCaptionDays, stampBounds } from "./stamp-catalog.js";
import { stampImageUrl } from "./stamp-art.js";
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const clamp = (n) => Math.max(0, Math.min(1, n));

export function createCalendarStamps({ api, getPosts, getPreferences, savePreferences, refreshPreferences, onRender }) {
  const stage = document.querySelector("#view");
  const records = new Map(), ranges = new Map();
  let range = "", days = [], completed = new Map(), arranging = false, selectedDay = null;
  let saving = false, drag = null, observer = null, message = "", picker = null, epoch = 0;
  const preferences = () => normalizeStampPreferences(getPreferences());
  const placement = (day) => ({ ...DEFAULT_STAMP_PLACEMENT, ...records.get(day) });
  const imageStyle = (day) => stampStyle(placement(day).style || preferences().style);
  const loaded = () => ranges.get(range) === "loaded";
  function announce(text) { message = text; const live = stage.querySelector("#stamp-status"); if (live) live.textContent = text; }
  async function load(key) {
    if (ranges.has(key)) return;
    ranges.set(key, "loading");
    const [start, end] = key.split("|");
    const generation = epoch;
    try {
      const [result] = await Promise.all([api(`/api/calendar-stamps?start=${start}&end=${end}`), refreshPreferences?.()]);
      if (generation !== epoch) return;
      for (const day of [...records.keys()]) if (day >= start && day <= end) records.delete(day);
      result.stamps.forEach((record) => records.set(record.day, record));
      ranges.set(key, "loaded");
    } catch { if (generation !== epoch) return; ranges.set(key, "failed"); if (range === key) message = "Stamp placements could not load. Your captions are unchanged; retry to arrange stamps."; }
    if (range === key) onRender();
  }
  function prepare(visibleDays) {
    if (!preferences().enabled) arranging = false;
    days = visibleDays; range = `${days[0]}|${days.at(-1)}`;
    completed = completedCaptionDays(getPosts());
    if (!completed.has(selectedDay) || !days.includes(selectedDay)) selectedDay = days.find((day) => completed.has(day)) || null;
    void load(range);
  }
  function controlsHTML() {
    const pref = preferences();
    const editable = pref.enabled && loaded();
    return `<section class="planning-panel stamp-tools" aria-label="Completion stamps" aria-busy="${saving}">
      <div class="stamp-toolbar"><div><strong>A little well done</strong><p class="muted small">A stamp when every scheduled caption for a day is marked Posted. No empty-day awards, reminders or pressure.</p></div>
      <button type="button" class="btn btn-ghost btn-sm" data-stamp-action="default-style" ${saving ? "disabled" : ""}>Change shared default</button>
      <button type="button" class="btn btn-ghost btn-sm" data-stamp-action="arrange" aria-pressed="${arranging}" ${saving || (!arranging && !editable) ? "disabled" : ""}>${arranging ? "Done arranging" : "Arrange stamps"}</button></div>
      <label class="check"><input type="checkbox" id="show-completion-stamps" ${pref.enabled ? "checked" : ""} ${saving ? "disabled" : ""}/> Show completion stamps</label>
      <p class="small muted">Default: ${esc(stampStyle(pref.style).name)}. Placement and per-day styles sync across devices. Captions stay above a reserved stamp area.</p>
      ${editable ? `<div class="stamp-inspector"><label class="field"><span>Choose a completed day</span><select id="stamp-day-choice" ${!selectedDay || saving ? "disabled" : ""}>${selectedDay ? days.filter((day) => completed.has(day)).map((day) => `<option value="${day}" ${selectedDay === day ? "selected" : ""}>${day} · ${completed.get(day).total} posted</option>`).join("") : '<option value="">No completed days in this calendar</option>'}</select></label>
      <button type="button" class="btn btn-ghost btn-sm" data-stamp-action="day-style" ${!selectedDay || saving ? "disabled" : ""}>Choose stamp for this day · 200 styles</button>
      <p class="small muted">Tap a stamp or select a date above. Your choice changes only that day, not other days or the shared default.</p>
      <p class="small" id="stamp-selected-style">${selectedDay ? esc(imageStyle(selectedDay).name) : ""}</p>
      ${arranging ? `<p class="small" id="stamp-arrange-help">Drag a stamp with your mouse or finger within its day. Or focus it and use arrow keys (Shift for larger steps). Caption rescheduling is paused while arranging.</p>
      <div class="stamp-adjust"><label for="stamp-rotation">Tilt</label><input id="stamp-rotation" type="range" min="-18" max="18" value="${selectedDay ? placement(selectedDay).rotation : -8}" ${!selectedDay || saving ? "disabled" : ""}/><output id="stamp-rotation-value">${selectedDay ? placement(selectedDay).rotation : -8}°</output>
      ${[["left", "←"], ["up", "↑"], ["down", "↓"], ["right", "→"]].map(([id, arrow]) => `<button type="button" class="btn btn-ghost btn-sm" data-stamp-action="${id}" aria-label="Move stamp ${id}" ${!selectedDay || saving ? "disabled" : ""}>${arrow}</button>`).join("")}</div>
      <div class="stamp-toolbar"><button type="button" class="btn btn-ghost btn-sm" data-stamp-action="follow-default" ${!selectedDay || saving ? "disabled" : ""}>Use default style for this day</button><button type="button" class="btn btn-ghost btn-sm" data-stamp-action="reset" ${!selectedDay || saving ? "disabled" : ""}>Reset position</button></div>` : ""}</div>` : ""}
      <p id="stamp-status" class="small" role="status">${esc(message || (loaded() ? "Choose a stamp for a completed day, or tap its stamp. Other days stay unchanged." : "Loading saved stamp placements…"))}</p>
      ${ranges.get(range) === "failed" ? '<button type="button" class="btn btn-ghost btn-sm" data-stamp-action="retry">Retry loading stamps</button>' : ""}
    </section>`;
  }
  function dayHTML(day) {
    if (!preferences().enabled || !loaded() || !completed.has(day)) return "";
    const style = imageStyle(day);
    return `<div class="stamp-bay"><button type="button" class="completion-stamp ${style.kind}" data-stamp-day="${day}" aria-label="${day}: all ${completed.get(day).total} captions posted. ${esc(style.name)} stamp. ${arranging ? "Use arrow keys to move." : "Choose a stamp for this day only."}" ${saving ? "disabled" : ""}><img src="${stampImageUrl(style.id, day)}" alt="" draggable="false" /></button></div>`;
  }
  function paint(button, value = placement(button.dataset.stampDay)) {
    const bay = button.parentElement;
    button.style.transform = `rotate(${value.rotation}deg)`;
    const bounds = stampBounds(button.offsetWidth, button.offsetHeight, bay.clientWidth, bay.clientHeight, value.rotation);
    button.style.left = `${bounds.left + clamp(value.x) * bounds.travelX}px`;
    button.style.top = `${bounds.top + clamp(value.y) * bounds.travelY}px`;
    button.classList.toggle("stamp-selected", arranging && button.dataset.stampDay === selectedDay);
  }
  function syncInspector() {
    const value = selectedDay ? placement(selectedDay) : DEFAULT_STAMP_PLACEMENT;
    const select = stage.querySelector("#stamp-day-choice"); if (select) select.value = selectedDay || "";
    const slider = stage.querySelector("#stamp-rotation"); if (slider) slider.value = value.rotation;
    const output = stage.querySelector("#stamp-rotation-value"); if (output) output.textContent = `${value.rotation}°`;
    const name = stage.querySelector("#stamp-selected-style"); if (name) name.textContent = selectedDay ? imageStyle(selectedDay).name : "";
    stage.querySelectorAll(".completion-stamp").forEach((button) => paint(button));
  }
  function mount() {
    observer?.disconnect();
    stage.querySelector(".cal")?.setAttribute("data-stamp-arrange", String(arranging));
    observer = new ResizeObserver(() => stage.querySelectorAll(".completion-stamp").forEach((button) => paint(button)));
    stage.querySelectorAll(".stamp-bay").forEach((bay) => observer.observe(bay));
    stage.querySelectorAll(".completion-stamp").forEach((button) => paint(button));
  }
  function restoreFocus(day) { requestAnimationFrame(() => stage.querySelector(`[data-stamp-day="${day}"]`)?.focus({ preventScroll: true })); }
  async function savePlacement(day, value) {
    if (saving || !loaded()) return false;
    const old = records.get(day);
    saving = true; records.set(day, { ...value, updated_at: old?.updated_at }); announce("Saving stamp placement…"); onRender();
    try {
      const result = await api(`/api/calendar-stamps/${day}`, { method: "PUT", body: { x: value.x, y: value.y, rotation: value.rotation, style: value.style, expected_updated_at: old?.updated_at ?? null } });
      records.set(day, result.stamp); announce("Stamp saved. Your captions and posting dates are unchanged."); return true;
    } catch (err) {
      old ? records.set(day, old) : records.delete(day);
      announce(`Could not confirm the save: ${err.message} Reload placements before trying again.`);
      ranges.set(range, "failed"); return false;
    } finally { saving = false; onRender(); restoreFocus(day); }
  }
  async function saveDefault(value) {
    if (saving) return false;
    saving = true; onRender();
    try { await savePreferences(value); if (!value.enabled) arranging = false; announce("Completion stamp preference saved."); return true; }
    catch (err) { announce(`Could not save stamp preference: ${err.message}`); return false; }
    finally { saving = false; onRender(); }
  }
  function nudge(dx, dy) {
    if (!selectedDay || saving || !loaded()) return;
    const current = placement(selectedDay);
    void savePlacement(selectedDay, { ...current, x: clamp(current.x + dx), y: clamp(current.y + dy) });
  }
  function cancelDrag() {
    if (!drag) return;
    const previous = drag; drag = null;
    if (previous.button.isConnected) paint(previous.button, previous.start);
    if (previous.button.hasPointerCapture(previous.id)) previous.button.releasePointerCapture(previous.id);
    announce("Stamp movement cancelled; its saved position is unchanged.");
  }
  stage.addEventListener("pointerdown", (event) => {
    const button = event.target.closest("[data-stamp-day]");
    if (!button || !arranging || saving || !loaded() || event.button !== 0) return;
    selectedDay = button.dataset.stampDay; syncInspector();
    const start = placement(selectedDay), bay = button.parentElement;
    const bounds = stampBounds(button.offsetWidth, button.offsetHeight, bay.clientWidth, bay.clientHeight, start.rotation);
    drag = { button, id: event.pointerId, day: selectedDay, start, value: start, clientX: event.clientX, clientY: event.clientY, bounds, moved: false };
    button.setPointerCapture(event.pointerId); button.focus({ preventScroll: true }); event.preventDefault();
  });
  stage.addEventListener("pointermove", (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.clientX, dy = event.clientY - drag.clientY;
    if (Math.abs(dx) + Math.abs(dy) < 3 && !drag.moved) return;
    drag.moved = true;
    drag.value = { ...drag.start, x: drag.bounds.travelX ? clamp(drag.start.x + dx / drag.bounds.travelX) : .5, y: drag.bounds.travelY ? clamp(drag.start.y + dy / drag.bounds.travelY) : .5 };
    paint(drag.button, drag.value); event.preventDefault();
  });
  stage.addEventListener("pointerup", (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const finished = drag; drag = null;
    if (finished.button.hasPointerCapture(event.pointerId)) finished.button.releasePointerCapture(event.pointerId);
    if (finished.moved) void savePlacement(finished.day, finished.value);
  });
  stage.addEventListener("pointercancel", cancelDrag);
  stage.addEventListener("lostpointercapture", () => { if (drag) cancelDrag(); });
  stage.addEventListener("keydown", (event) => {
    if (!arranging || !event.target.closest("[data-stamp-day]")) return;
    if (event.key === "Escape") { event.preventDefault(); cancelDrag(); return; }
    const offsets = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (!offsets[event.key]) return;
    event.preventDefault(); selectedDay = event.target.closest("[data-stamp-day]").dataset.stampDay;
    const [x, y] = offsets[event.key], step = event.shiftKey ? .15 : .05; nudge(x * step, y * step);
  });
  stage.addEventListener("input", (event) => {
    if (event.target.id !== "stamp-rotation" || !selectedDay) return;
    const value = Number(event.target.value), button = stage.querySelector(`[data-stamp-day="${selectedDay}"]`);
    if (button) paint(button, { ...placement(selectedDay), rotation: value });
    stage.querySelector("#stamp-rotation-value").textContent = `${value}°`;
  });
  stage.addEventListener("change", (event) => {
    if (event.target.id === "show-completion-stamps") void saveDefault({ ...preferences(), enabled: event.target.checked });
    if (event.target.id === "stamp-day-choice") { selectedDay = event.target.value; syncInspector(); restoreFocus(selectedDay); }
    if (event.target.id === "stamp-rotation" && selectedDay) void savePlacement(selectedDay, { ...placement(selectedDay), rotation: Number(event.target.value) });
  });
  stage.addEventListener("click", (event) => {
    const stamp = event.target.closest("[data-stamp-day]");
    if (stamp) { event.preventDefault(); event.stopImmediatePropagation(); if (!saving) { selectedDay = stamp.dataset.stampDay; syncInspector(); if (!arranging) showPicker(selectedDay); } return; }
    const control = event.target.closest("[data-stamp-action]");
    if (!control) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (saving) return;
    const action = control.dataset.stampAction;
    if (action === "arrange") { arranging = !arranging; message = arranging ? "Arrange mode is on. Captions cannot be opened or rescheduled until you choose Done arranging." : "Arrangement finished. Saved stamps stay where you placed them."; onRender(); stage.querySelector('[data-stamp-action="arrange"]')?.focus(); }
    if (action === "retry") { ranges.delete(range); void load(range); onRender(); }
    if (action === "default-style") showPicker(null);
    if (action === "day-style" && selectedDay) showPicker(selectedDay);
    if (action === "follow-default" && selectedDay) void savePlacement(selectedDay, { ...placement(selectedDay), style: null });
    if (action === "reset" && selectedDay) void savePlacement(selectedDay, { ...DEFAULT_STAMP_PLACEMENT, style: placement(selectedDay).style });
    if (action === "left") nudge(-.1, 0);
    if (action === "right") nudge(.1, 0);
    if (action === "up") nudge(0, -.1);
    if (action === "down") nudge(0, .1);
  }, true);

  function showPicker(targetDay) {
    picker?.remove();
    picker = document.createElement("dialog"); picker.className = "stamp-picker"; picker.setAttribute("aria-labelledby", "stamp-picker-title");
    let choice = targetDay ? imageStyle(targetDay).id : preferences().style;
    picker.innerHTML = `<header><div><h2 id="stamp-picker-title">Choose a little celebration</h2><p class="muted small">50 world-place postage designs · 50 engraved wax seals · 50 retro bottle caps · 50 pearly storybook seals. ${targetDay ? `For ${targetDay} only. Other days and your shared default will not change.` : "Shared default: changes every day without its own style. Individually chosen stamps stay unchanged."}</p></div><button type="button" class="icon-btn" id="stamp-picker-close" aria-label="Close stamp picker">✕</button></header>
      <div class="stamp-picker-preview"><img id="stamp-big-preview" alt=""/><div><strong id="stamp-preview-name"></strong><p class="small muted">Original decorative artwork. Storybook seals and bottle caps are unofficial, original show/game-inspired designs, not affiliated merchandise.</p></div></div>
      <div class="stamp-picker-filters"><label class="field"><span>Find a stamp</span><input type="search" id="stamp-search" placeholder="Harry Potter, Enola Holmes, pearl…" /></label><label class="field"><span>Collection</span><select id="stamp-kind"><option value="all">All 200 styles</option><option value="postage">Postage · 50 places</option><option value="wax">All wax seals · 100 styles</option><option value="pearl">Pearly storybook wax · 50 styles</option><option value="harry-potter">Pearl · Harry Potter · 25</option><option value="enola-holmes">Pearl · Enola Holmes · 25</option><option value="cap">Bottle caps · 50 styles</option></select></label></div>
      <p class="small muted" id="stamp-results" role="status"></p><div class="stamp-gallery" aria-label="Stamp styles"></div>
      <footer><p id="stamp-picker-status" class="small" role="status">Select a style, then apply it.</p><button type="button" class="btn btn-ghost" id="stamp-picker-cancel">Cancel</button><button type="button" class="btn btn-primary" id="stamp-picker-apply">${targetDay ? "Use for this day only" : "Update shared default"}</button></footer>`;
    document.body.append(picker);
    const find = (s) => picker.querySelector(s);
    function preview() {
      find("#stamp-big-preview").src = stampImageUrl(choice, targetDay || "");
      find("#stamp-preview-name").textContent = stampStyle(choice).name;
      picker.querySelectorAll("[data-style]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.style === choice)));
    }
    function gallery() {
      const query = find("#stamp-search").value.trim().toLocaleLowerCase(), kind = find("#stamp-kind").value;
      const matches = STAMP_STYLES.filter((s) => (kind === "all" || s.kind === kind || (kind === "pearl" && s.finish === "pearl") || (s.finish === "pearl" && s.collectionId === kind)) && `${s.name} ${s.finish === "pearl" ? "pearl pearly white ivory embossed storybook wax" : ""} ${s.kind === "wax" && s.art === "laurel" ? "wildflowers botanical bouquet" : ""} ${s.kind === "cap" ? "retro soda softdrink bottle cap" : ""}`.toLocaleLowerCase().includes(query));
      find(".stamp-gallery").innerHTML = matches.map((s) => `<button type="button" data-style="${s.id}" aria-pressed="${s.id === choice}"><img src="${stampImageUrl(s.id)}" alt="" loading="lazy" draggable="false"/><span>${esc(s.name)}</span><small>${s.finish === "pearl" ? "Pearly embossed wax" : s.kind === "wax" ? "Engraved wax seal" : s.kind === "cap" ? "Retro bottle cap" : "Vintage postage"}</small></button>`).join("");
      find("#stamp-results").textContent = `${matches.length} of 200 styles`; preview();
    }
    find("#stamp-search").addEventListener("input", gallery); find("#stamp-kind").addEventListener("change", gallery);
    find(".stamp-gallery").addEventListener("click", (event) => { const option = event.target.closest("[data-style]"); if (option) { choice = option.dataset.style; preview(); } });
    const close = () => { if (saving) return; picker.close(); if (targetDay) restoreFocus(targetDay); };
    picker.addEventListener("cancel", (event) => { if (saving) event.preventDefault(); });
    find("#stamp-picker-close").addEventListener("click", close); find("#stamp-picker-cancel").addEventListener("click", close);
    picker.addEventListener("click", (event) => { if (event.target === picker) close(); });
    find("#stamp-picker-apply").addEventListener("click", async () => {
      picker.querySelectorAll("button, input, select").forEach((element) => element.disabled = true);
      find("#stamp-picker-status").textContent = "Saving stamp choice…";
      const success = targetDay ? await savePlacement(targetDay, { ...placement(targetDay), style: choice }) : await saveDefault({ ...preferences(), style: choice });
      if (success) close();
      else { picker.querySelectorAll("button, input, select").forEach((element) => element.disabled = false); find("#stamp-picker-status").textContent = message; }
    });
    gallery(); picker.showModal();
  }
  function refreshOnReturn() {
    if (document.hidden || saving || drag || picker?.open || !range || !stage.querySelector(".stamp-tools") || ranges.get(range) === "loading") return;
    ranges.delete(range); void load(range);
  }
  window.addEventListener("focus", refreshOnReturn);
  window.addEventListener("pageshow", refreshOnReturn);
  document.addEventListener("visibilitychange", refreshOnReturn);
  return { prepare, controlsHTML, dayHTML, mount, isArranging: () => arranging, isComplete: (day) => preferences().enabled && loaded() && completed.has(day), leave() { cancelDrag(); observer?.disconnect(); arranging = false; picker?.close(); ranges.clear(); range = ""; epoch++; } };
}
