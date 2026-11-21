// Caption Studio — front-end (no build step, plain JS)

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const PALETTE = ["#e2557c", "#7c5cff", "#f08a5d", "#1fa6a0", "#3b82f6", "#d97706", "#16a34a", "#c026d3", "#64748b", "#ef4444"];
// Content-type colors for the Cyber theme: signal yellow, white, and a few neon accents.
const CYBER_PALETTE = ["#f5c400", "#f2f2f2", "#ff7a1a", "#b6f24a", "#4dd8e0", "#a0a3a8", "#ff4d6d", "#d9c27a", "#8b93ff", "#e0e0e0"];

/* ------------------------------------------------------------------ */
/* Themes (saved per device in localStorage)                           */
/* ------------------------------------------------------------------ */
const THEMES = [
  { id: "auto", name: "Rosé · Auto", desc: "Light by day, dark at night. Follows your phone.", preview: "tp-auto" },
  { id: "rose", name: "Rosé Light", desc: "The original soft pink look.", preview: "tp-rose" },
  { id: "rose-dark", name: "Rosé Night", desc: "Same look, always dark.", preview: "tp-rose-dark" },
  { id: "cyber", name: "Cyber", desc: "Black, white & signal yellow.", preview: "tp-cyber" },
  { id: "matcha", name: "Matcha", desc: "Cream paper, serif type & matcha green. Cozy and bookish.", preview: "tp-matcha" },
];
const THEME_BG = { rose: "#fff7f3", "rose-dark": "#1b1517", cyber: "#121316", matcha: "#f3eee1" };
// Extra fonts are only downloaded when their theme is picked (keep in sync with the snippet in index.html).
const THEME_FONTS = {
  cyber: "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&display=swap",
  matcha:
    "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..700&family=Literata:ital,opsz,wght@0,7..72,400..700;1,7..72,400..600&display=swap",
};
// Content-type colors per theme (default: PALETTE).
const THEME_PALETTES = {
  cyber: CYBER_PALETTE,
  // Earthy tea-shop tones: matcha, terracotta, ochre, sage, plum, slate, moss, clay, hojicha, olive.
  matcha: ["#6b8f47", "#c0674a", "#c49a3a", "#7f9f86", "#8a5a7a", "#5b7a99", "#4e6b3a", "#b77b7b", "#8b6b4a", "#9a9a4a"],
};
const THEME_CONFETTI = {
  cyber: ["#f5c400", "#f5c400", "#f2f2f2", "#ffe27a", "#8d9096"],
  matcha: ["#6b8f47", "#9cb86a", "#c5d8a4", "#f3eee1", "#e8b4b8", "#4e6b3a"],
};

function currentTheme() {
  return document.documentElement.dataset.theme || "auto";
}

function applyThemeChrome() {
  const t = currentTheme();
  // Browser bar color on phones.
  $$('meta[name="theme-color"]').forEach((m) => {
    const dark = (m.getAttribute("media") || "").includes("dark");
    m.setAttribute("content", THEME_BG[t] || (dark ? THEME_BG["rose-dark"] : THEME_BG.rose));
  });
  if (THEME_FONTS[t] && !$(`#${t}-fonts`)) {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.id = `${t}-fonts`;
    l.href = THEME_FONTS[t];
    document.head.append(l);
  }
}

function setTheme(id) {
  if (!THEMES.some((t) => t.id === id)) id = "auto";
  try {
    localStorage.setItem("cs-theme", id);
  } catch {}
  if (id === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = id;
  applyThemeChrome();
}
applyThemeChrome();
const STATUS_LABELS = { idea: "Idea", draft: "Draft", ready: "Ready", posted: "Posted" };
// Character / hashtag limits per platform (used for gentle warnings in the editor).
const LIMITS = {
  instagram: { chars: 2200, hashtags: 30 },
  tiktok: { chars: 4000 },
  facebook: { chars: 63206 },
  youtube: { chars: 5000 },
  threads: { chars: 500 },
  x: { chars: 280 },
  twitter: { chars: 280 },
  linkedin: { chars: 3000 },
  pinterest: { chars: 500 },
};
const REMINDER_CHOICES = [
  [10080, "1 week before"],
  [4320, "3 days before"],
  [1440, "1 day before"],
  [180, "3 hours before"],
  [60, "1 hour before"],
  [30, "30 min before"],
  [15, "15 min before"],
  [0, "At posting time"],
];

const MAX_REMINDERS = 8;
const MAX_REMINDER_MIN = 20160; // 14 days
const MAX_IMAGES = 10;
const IMG_MAX_EDGE = 2048;
const IMG_MAX_BYTES = 1_300_000;
const THUMB_EDGE = 480;

/** "45 min before", "2 hours before", "1 day before", "1 h 30 min before", "At posting time" */
function offsetLabel(min, { short = false } = {}) {
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  let t;
  if (min === 0) return short ? "at posting time" : "At posting time";
  if (min % 1440 === 0) t = plural(min / 1440, "day");
  else if (min % 60 === 0) t = plural(min / 60, "hour");
  else if (min > 60) t = `${Math.floor(min / 60)} h ${min % 60} min`;
  else t = `${min} min`;
  return short ? t : `${t} before`;
}

function adderHTML(id) {
  return `<div class="adder" data-adder="${id}">
    <input type="number" min="1" max="999" step="1" inputmode="numeric" placeholder="e.g. 45" aria-label="Amount" />
    <select aria-label="Unit"><option value="1">minutes</option><option value="60">hours</option><option value="1440">days</option></select>
    <span class="muted small">before</span>
    <button type="button" class="btn btn-ghost btn-sm" data-add>Add</button>
  </div>`;
}

/** Read an adder; returns minutes or null (and shows a toast on invalid input). */
function readAdder(root, existing) {
  const n = Number($("input", root).value);
  const unit = Number($("select", root).value);
  if (!Number.isFinite(n) || n <= 0) {
    toast("Type a number first", "error");
    $("input", root).focus();
    return null;
  }
  const min = Math.round(n * unit);
  if (min > MAX_REMINDER_MIN) return toast("Max is 14 days before", "error"), null;
  if (existing.includes(min)) return toast("You already have that reminder", "error"), null;
  if (existing.length >= MAX_REMINDERS) return toast(`Max ${MAX_REMINDERS} reminders`, "error"), null;
  $("input", root).value = "";
  return min;
}

const state = {
  posts: [],
  settings: null,
  view: "upcoming",
  search: "",
  typeFilter: null,
  calMonth: startOfMonth(new Date()),
  calSelected: null,
  editing: null, // post being edited (null = new)
  editorSnapshot: "",
};

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty */
  }
  if (res.status === 401 && path !== "/api/login") {
    showLogin();
    throw new Error("Please log in again");
  }
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

/* ------------------------------------------------------------------ */
/* Date helpers (browser local time)                                   */
/* ------------------------------------------------------------------ */

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const fmtTime = (d) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const fmtDate = (d, opts = {}) => d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", ...opts });

function dayHeading(d) {
  const today = startOfDay(new Date());
  const diff = Math.round((startOfDay(d) - today) / 864e5);
  if (diff === 0) return ["Today", fmtDate(d)];
  if (diff === 1) return ["Tomorrow", fmtDate(d)];
  if (diff === -1) return ["Yesterday", fmtDate(d)];
  if (diff > 1 && diff < 7) return [d.toLocaleDateString([], { weekday: "long" }), d.toLocaleDateString([], { month: "short", day: "numeric" })];
  return [fmtDate(d, { year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined }), ""];
}

function relativeFromNow(d) {
  const mins = Math.round((d - Date.now()) / 60e3);
  const abs = Math.abs(mins);
  if (abs < 1) return "now";
  const label = abs < 60 ? `${abs} min` : abs < 48 * 60 ? `${Math.round(abs / 60)} h` : `${Math.round(abs / 1440)} days`;
  return mins >= 0 ? `in ${label}` : `${label} ago`;
}

/* ------------------------------------------------------------------ */
/* Utilities                                                           */
/* ------------------------------------------------------------------ */

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function typeColor(type) {
  if (!type) return "#9c8a8f";
  const list = state.settings?.content_types || [];
  const i = list.findIndex((t) => t.toLowerCase() === type.toLowerCase());
  const pal = THEME_PALETTES[currentTheme()] || PALETTE;
  if (i >= 0) return pal[i % pal.length];
  let h = 0;
  for (const c of type) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return pal[h % pal.length];
}

function toast(msg, kind = "") {
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = msg;
  $("#toasts").append(el);
  setTimeout(() => el.remove(), 2600);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.append(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  toast("Caption copied 📋");
}

function captionStats(text) {
  const chars = [...text].length;
  const hashtags = (text.match(/(^|\s)#[\p{L}\p{N}_]+/gu) || []).length;
  const mentions = (text.match(/(^|\s)@[\w.]+/g) || []).length;
  const words = (text.trim().match(/\S+/g) || []).length;
  return { chars, hashtags, mentions, words };
}

function matchesSearch(p) {
  if (state.typeFilter && p.content_type !== state.typeFilter) return false;
  const q = state.search.trim().toLowerCase();
  if (!q) return true;
  return [p.title, p.caption, p.notes, p.content_type, ...(p.platforms || []), STATUS_LABELS[p.status]]
    .join(" \n ")
    .toLowerCase()
    .includes(q);
}

/* ------------------------------------------------------------------ */
/* Boot / auth                                                         */
/* ------------------------------------------------------------------ */

function showLogin() {
  $("#app").hidden = true;
  $("#login").hidden = false;
  $("#editor").open && $("#editor").close();
  setTimeout(() => $("#login-password").focus(), 50);
}

async function boot() {
  try {
    const me = await api("/api/me");
    state.settings = me.settings;
  } catch (err) {
    if (!$("#login").hidden) return;
    $("#login").hidden = false;
    if (!/log in/i.test(err.message)) $("#login-error").textContent = err.message;
    return;
  }
  $("#login").hidden = true;
  $("#app").hidden = false;
  applyBranding();
  await loadPosts();
  route();
}

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.submitter || $("#login-form button");
  btn.disabled = true;
  $("#login-error").textContent = "";
  try {
    await api("/api/login", { method: "POST", body: { password: $("#login-password").value } });
    $("#login-password").value = "";
    await boot();
  } catch (err) {
    $("#login-error").textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

function applyBranding() {
  const name = state.settings?.app_name || "Caption Studio";
  $("#brand-name").textContent = name;
  document.title = name;
}

async function loadPosts() {
  const { posts } = await api("/api/posts");
  state.posts = posts;
  updateCounts();
}

function upsertLocal(post) {
  const i = state.posts.findIndex((p) => p.id === post.id);
  if (i >= 0) state.posts[i] = post;
  else state.posts.push(post);
  updateCounts();
}

/* ------------------------------------------------------------------ */
/* Routing                                                             */
/* ------------------------------------------------------------------ */

window.addEventListener("hashchange", route);

function route() {
  if ($("#app").hidden) return;
  const hash = location.hash.replace(/^#/, "") || "upcoming";
  const postMatch = hash.match(/^post\/(\d+)$/);
  if (postMatch) {
    const post = state.posts.find((p) => p.id === Number(postMatch[1]));
    if (post) openEditor(post);
    else toast("That post doesn't exist anymore", "error");
    history.replaceState(null, "", `#${state.view}`);
    render();
    return;
  }
  if (hash === "new") {
    history.replaceState(null, "", `#${state.view}`);
    openEditor(null);
    render();
    return;
  }
  state.view = ["upcoming", "calendar", "ideas", "posted", "settings"].includes(hash) ? hash : "upcoming";
  render();
}

function render() {
  $$(".tabs a").forEach((a) => a.classList.toggle("active", a.dataset.view === state.view));
  $("#settings-link").classList.toggle("active", state.view === "settings");
  $("#fab").hidden = state.view === "settings";
  renderTypeFilter();
  const view = $("#view");
  if (state.view === "settings") return renderSettings(view);
  if (state.view === "calendar") return renderCalendar(view);
  if (state.view === "ideas") return renderIdeas(view);
  if (state.view === "posted") return renderPosted(view);
  return renderUpcoming(view);
}

function updateCounts() {
  const upcoming = state.posts.filter((p) => p.scheduled_at && p.status !== "posted").length;
  const ideas = state.posts.filter((p) => !p.scheduled_at && p.status !== "posted").length;
  const posted = state.posts.filter((p) => p.status === "posted").length;
  const set = (k, n) => ($(`[data-count="${k}"]`).textContent = n ? String(n) : "");
  set("upcoming", upcoming);
  set("ideas", ideas);
  set("posted", posted);
}

function renderTypeFilter() {
  const row = $("#type-filter");
  if (state.view === "settings") {
    row.innerHTML = "";
    return;
  }
  const used = new Set(state.posts.map((p) => p.content_type).filter(Boolean));
  const types = [...(state.settings?.content_types || []).filter((t) => used.has(t)), ...[...used].filter((t) => !(state.settings?.content_types || []).includes(t))];
  if (types.length < 2 && !state.typeFilter) {
    row.innerHTML = "";
    return;
  }
  row.innerHTML =
    `<button class="chip" aria-pressed="${!state.typeFilter}" data-type="">All types</button>` +
    types
      .map(
        (t) =>
          `<button class="chip" style="--chip-color:${typeColor(t)}" aria-pressed="${state.typeFilter === t}" data-type="${esc(t)}"><span class="dot"></span>${esc(t)}</button>`
      )
      .join("");
}

$("#type-filter").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-type]");
  if (!btn) return;
  state.typeFilter = btn.dataset.type || null;
  render();
});

let searchTimer;
$("#search").addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = e.target.value;
    if (state.view === "settings") location.hash = "#upcoming";
    else render();
  }, 120);
});

/* ------------------------------------------------------------------ */
/* Cards & lists                                                       */
/* ------------------------------------------------------------------ */

const ICON_COPY = `<svg viewBox="0 0 24 24"><path d="M8 3h11a2 2 0 0 1 2 2v11h-2V5H8V3Zm-3 4h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Zm0 2v10h10V9H5Z"/></svg>`;
const ICON_CHECK = `<svg viewBox="0 0 24 24"><path d="m9.5 16.2-4.2-4.2-1.4 1.4 5.6 5.6 11-11-1.4-1.4z"/></svg>`;

function cardHTML(p, { showDate = false } = {}) {
  const color = typeColor(p.content_type);
  const d = p.scheduled_at ? new Date(p.scheduled_at) : null;
  const when = d ? (showDate ? `${fmtDate(d)} · ${fmtTime(d)}` : fmtTime(d)) : "";
  const overdue = d && d < new Date() && p.status !== "posted";
  const caption = p.caption.trim();
  return `
  <article class="card" tabindex="0" data-id="${p.id}" style="--type-color:${color}">
    <div class="card-bar"></div>
    <div class="card-main">
      <div class="card-top">
        ${when ? `<span class="card-time">${esc(when)}</span>` : ""}
        ${d && p.status !== "posted" ? `<span class="muted small" ${overdue ? 'style="color:var(--danger)"' : ""}>${esc(relativeFromNow(d))}</span>` : ""}
        <span class="spacer" style="flex:1"></span>
        <span class="status status-${p.status}">${STATUS_LABELS[p.status]}</span>
      </div>
      <div class="card-content">
        <div class="card-text">
          ${p.title ? `<div class="card-title">${esc(p.title)}</div>` : ""}
          <p class="card-caption ${caption ? "" : "empty"}">${caption ? esc(caption) : p.images?.length ? "Image only — no caption yet" : "No caption yet"}</p>
        </div>
        ${
          p.images?.length
            ? `<div class="card-thumb"><img loading="lazy" alt="" src="/api/images/${p.images[0].id}?size=thumb" />${
                p.images.length > 1 ? `<span>+${p.images.length - 1}</span>` : ""
              }</div>`
            : ""
        }
      </div>
      <div class="card-foot">
        ${p.content_type ? `<span class="badge type">${esc(p.content_type)}</span>` : ""}
        ${(p.platforms || []).map((x) => `<span class="badge">${esc(x)}</span>`).join("")}
        <span class="spacer"></span>
        ${caption ? `<button class="mini-btn" data-act="copy" title="Copy caption">${ICON_COPY}Copy</button>` : ""}
        ${p.status !== "posted" ? `<button class="mini-btn ok" data-act="posted" title="Mark as posted">${ICON_CHECK}Posted</button>` : ""}
      </div>
    </div>
  </article>`;
}

function groupByDay(posts) {
  const groups = new Map();
  for (const p of posts) {
    const d = new Date(p.scheduled_at);
    const k = dayKey(d);
    if (!groups.has(k)) groups.set(k, { date: startOfDay(d), posts: [] });
    groups.get(k).posts.push(p);
  }
  return [...groups.values()];
}

function dayGroupsHTML(groups) {
  return groups
    .map(({ date, posts }) => {
      const [h, sub] = dayHeading(date);
      return `<section class="day-group">
        <div class="day-head"><h3>${esc(h)}</h3><span class="muted">${esc(sub)}</span></div>
        <div class="cards">${posts.map((p) => cardHTML(p)).join("")}</div>
      </section>`;
    })
    .join("");
}

function emptyHTML(emoji, title, text, withButton = true) {
  return `<div class="empty-state"><div class="big">${emoji}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>
  ${withButton ? `<button class="btn btn-primary" data-act="new">+ New caption</button>` : ""}</div>`;
}

function renderUpcoming(view) {
  const now = new Date();
  const today = startOfDay(now);
  const scheduled = state.posts
    .filter((p) => p.scheduled_at && p.status !== "posted" && matchesSearch(p))
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const overdue = scheduled.filter((p) => new Date(p.scheduled_at) < today);
  const upcoming = scheduled.filter((p) => new Date(p.scheduled_at) >= today);

  if (!scheduled.length) {
    view.innerHTML = state.search || state.typeFilter
      ? emptyHTML("🔍", "No matches", "Try a different search or filter.", false)
      : emptyHTML("🗓️", "Nothing scheduled yet", "Write a caption, pick a date and I'll remind you on Telegram.");
    return;
  }
  let html = "";
  if (overdue.length) {
    html += `<section class="day-group">
      <div class="day-head overdue"><h3>Overdue</h3><span class="muted">past date, not marked posted</span></div>
      <div class="cards">${overdue.map((p) => cardHTML(p, { showDate: true })).join("")}</div>
    </section>`;
  }
  html += dayGroupsHTML(groupByDay(upcoming));
  view.innerHTML = html;
}

function renderIdeas(view) {
  const posts = state.posts
    .filter((p) => !p.scheduled_at && p.status !== "posted" && matchesSearch(p))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  if (!posts.length) {
    view.innerHTML = state.search || state.typeFilter
      ? emptyHTML("🔍", "No matches", "Try a different search or filter.", false)
      : emptyHTML("💡", "No ideas parked here", "Captions without a date land here — perfect for random thoughts you'll schedule later.");
    return;
  }
  view.innerHTML = `<p class="muted small" style="margin:0 4px 12px">Captions without a posting date. Open one and pick a date to schedule it.</p>
    <div class="cards">${posts.map((p) => cardHTML(p)).join("")}</div>`;
}

function renderPosted(view) {
  const posts = state.posts
    .filter((p) => p.status === "posted" && matchesSearch(p))
    .sort((a, b) => (b.scheduled_at || b.posted_at || "").localeCompare(a.scheduled_at || a.posted_at || ""));
  if (!posts.length) {
    view.innerHTML = state.search || state.typeFilter
      ? emptyHTML("🔍", "No matches", "Try a different search or filter.", false)
      : emptyHTML("🎉", "Nothing posted yet", "When you mark a caption as posted it moves here, so you can reuse old captions later.", false);
    return;
  }
  view.innerHTML = `<div class="cards">${posts.map((p) => cardHTML(p, { showDate: true })).join("")}</div>`;
}

/* ---------- calendar ---------- */

function renderCalendar(view) {
  const month = state.calMonth;
  const first = startOfMonth(month);
  // Start the grid on Sunday.
  const gridStart = addDays(first, -first.getDay());
  const today = new Date();
  const byDay = new Map();
  for (const p of state.posts) {
    if (!p.scheduled_at || !matchesSearch(p)) continue;
    const k = dayKey(new Date(p.scheduled_at));
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(p);
  }
  for (const list of byDay.values()) list.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));

  const dows = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => `<div class="cal-dow">${d}</div>`).join("");
  let cells = "";
  const weeks = Math.ceil((first.getDay() + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7);
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(gridStart, i);
    const k = dayKey(d);
    const posts = byDay.get(k) || [];
    const cls = ["cal-cell", d.getMonth() !== month.getMonth() && "other", sameDay(d, today) && "today", state.calSelected === k && "selected"]
      .filter(Boolean)
      .join(" ");
    const items = posts
      .slice(0, 3)
      .map(
        (p) =>
          `<span class="cal-item ${p.status === "posted" ? "posted" : ""}" style="--type-color:${typeColor(p.content_type)}" data-id="${p.id}">${esc(
            fmtTime(new Date(p.scheduled_at)).replace(/\s?([AP])M/i, (_, a) => a.toLowerCase())
          )} ${esc(p.title || p.content_type || p.caption.slice(0, 30))}</span>`
      )
      .join("");
    const more = posts.length > 3 ? `<span class="cal-more">+${posts.length - 3} more</span>` : "";
    const dots = posts.length ? `<span class="cal-dots">${posts.slice(0, 4).map((p) => `<i style="--type-color:${typeColor(p.content_type)}"></i>`).join("")}</span>` : "";
    cells += `<button type="button" class="${cls}" data-day="${k}" aria-label="${esc(fmtDate(d))}${posts.length ? `, ${posts.length} posts` : ""}">
      <span class="cal-num">${d.getDate()}</span>${items}${more}${dots}</button>`;
  }

  let panel = "";
  if (state.calSelected) {
    const [y, m, dd] = state.calSelected.split("-").map(Number);
    const sel = new Date(y, m - 1, dd);
    const posts = byDay.get(state.calSelected) || [];
    const [h, sub] = dayHeading(sel);
    panel = `<section class="cal-day-panel day-group">
      <div class="day-head"><h3>${esc(h)}</h3><span class="muted">${esc(sub)}</span><span class="spacer" style="flex:1"></span>
      <button class="btn btn-ghost btn-sm" data-act="new-on-day" data-day="${state.calSelected}">+ Add on this day</button></div>
      ${posts.length ? `<div class="cards">${posts.map((p) => cardHTML(p)).join("")}</div>` : `<p class="muted" style="margin:4px">Nothing planned this day.</p>`}
    </section>`;
  }

  view.innerHTML = `
    <div class="cal-head">
      <h2>${month.toLocaleDateString([], { month: "long", year: "numeric" })}</h2>
      <button class="btn btn-ghost btn-sm" data-cal="today">Today</button>
      <button class="icon-btn" data-cal="-1" aria-label="Previous month"><svg viewBox="0 0 24 24"><path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4-4.6-4.6z"/></svg></button>
      <button class="icon-btn" data-cal="1" aria-label="Next month"><svg viewBox="0 0 24 24"><path d="M8.6 16.6 10 18l6-6-6-6-1.4 1.4 4.6 4.6z"/></svg></button>
    </div>
    <div class="cal">${dows}${cells}</div>
    ${panel}`;
}

/* ---------- global click handling for views ---------- */

$("#view").addEventListener("click", async (e) => {
  const act = e.target.closest("[data-act]");
  if (act) {
    e.stopPropagation();
    const card = act.closest(".card");
    const post = card ? state.posts.find((p) => p.id === Number(card.dataset.id)) : null;
    if (act.dataset.act === "copy" && post) return copyText(post.caption);
    if (act.dataset.act === "posted" && post) return markPosted(post, act);
    if (act.dataset.act === "new") return openEditor(null);
    if (act.dataset.act === "new-on-day") return openEditor(null, { day: act.dataset.day });
  }
  const calBtn = e.target.closest("[data-cal]");
  if (calBtn) {
    const v = calBtn.dataset.cal;
    state.calMonth = v === "today" ? startOfMonth(new Date()) : new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() + Number(v), 1);
    if (v === "today") state.calSelected = dayKey(new Date());
    return render();
  }
  const calItem = e.target.closest(".cal-item");
  if (calItem && window.matchMedia("(min-width: 641px)").matches) {
    const post = state.posts.find((p) => p.id === Number(calItem.dataset.id));
    if (post) return openEditor(post);
  }
  const cell = e.target.closest(".cal-cell");
  if (cell) {
    state.calSelected = state.calSelected === cell.dataset.day ? null : cell.dataset.day;
    render();
    $(".cal-day-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }
  const card = e.target.closest(".card");
  if (card) {
    const post = state.posts.find((p) => p.id === Number(card.dataset.id));
    if (post) openEditor(post);
  }
});

$("#view").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.classList.contains("card")) e.target.click();
});

/* ---------- confetti 🎉 (tiny, no library) ---------- */

function confetti(x = window.innerWidth / 2, y = window.innerHeight / 2) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.createElement("canvas");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.className = "confetti";
  // Inside an open <dialog> the canvas must live in the dialog to appear above it.
  (editor.open ? editor : document.body).append(canvas);
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  const colors = THEME_CONFETTI[currentTheme()] || ["#e2557c", "#f08a5d", "#ffd166", "#7c5cff", "#1fa6a0", "#3b82f6"];
  const pieces = Array.from({ length: 70 }, () => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
    const speed = 5 + Math.random() * 7;
    return {
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      w: 5 + Math.random() * 5,
      h: 7 + Math.random() * 7,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.35,
      color: colors[(Math.random() * colors.length) | 0],
      round: Math.random() < 0.3,
    };
  });
  const start = performance.now();
  const DURATION = 1500;
  (function frame(now) {
    const t = now - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - DURATION * 0.6) / (DURATION * 0.4));
    for (const p of pieces) {
      p.vy += 0.28; // gravity
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * (0.4 + 0.6 * Math.abs(Math.cos(p.rot * 2))));
      }
      ctx.restore();
    }
    if (t < DURATION) requestAnimationFrame(frame);
    else canvas.remove();
  })(start);
}

function confettiFrom(el) {
  if (!el?.getBoundingClientRect) return confetti();
  const r = el.getBoundingClientRect();
  confetti(r.left + r.width / 2, r.top + r.height / 2);
}

async function markPosted(post, fromEl) {
  try {
    const { post: updated } = await api(`/api/posts/${post.id}`, { method: "PATCH", body: { status: "posted" } });
    confettiFrom(fromEl);
    upsertLocal(updated);
    render();
    toast("Marked as posted 🎉");
  } catch (err) {
    toast(err.message, "error");
  }
}

$("#fab").addEventListener("click", () => {
  const day = state.view === "calendar" && state.calSelected ? state.calSelected : null;
  openEditor(null, { day, ideas: state.view === "ideas" });
});

/* ------------------------------------------------------------------ */
/* Editor                                                              */
/* ------------------------------------------------------------------ */

const editor = $("#editor");
const form = $("#editor-form");
const ed = {
  title: $("#f-title"),
  caption: $("#f-caption"),
  date: $("#f-date"),
  time: $("#f-time"),
  notes: $("#f-notes"),
  types: $("#f-types"),
  platforms: $("#f-platforms"),
  status: $("#f-status"),
};
let edType = "";
let edPlatforms = [];
let edStatus = "draft";
let edReminders = null; // null = use defaults from Settings, array = custom minutes for this post
let edImages = []; // { id, width, height } for saved images, { key, pending: true, blob, thumb, url } for new ones
let edRemovedImages = [];
let lightboxIndex = -1;
let pendingKey = 0;

function openEditor(post, { day = null, ideas = false } = {}) {
  state.editing = post;
  $("#editor-title").textContent = post ? "Edit caption" : "New caption";
  $("#delete-btn").hidden = !post;
  $("#duplicate-btn").hidden = !post;

  ed.title.value = post?.title || "";
  ed.caption.value = post?.caption || "";
  ed.notes.value = post?.notes || "";
  $("#notes-details").open = Boolean(post?.notes);

  if (post?.scheduled_at) {
    const d = new Date(post.scheduled_at);
    ed.date.value = dayKey(d);
    ed.time.value = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } else if (day) {
    ed.date.value = day;
    ed.time.value = "18:00";
  } else {
    ed.date.value = "";
    ed.time.value = "";
  }

  const settings = state.settings;
  edType = post ? post.content_type : ideas ? "" : settings.content_types[0] || "";
  edPlatforms = post ? [...(post.platforms || [])] : settings.platforms.slice(0, 1);
  edStatus = post ? post.status : ideas ? "idea" : "draft";
  edReminders = Array.isArray(post?.reminder_offsets) ? [...post.reminder_offsets] : null;
  clearPendingImages();
  edImages = (post?.images || []).map((i) => ({ ...i }));
  edRemovedImages = [];
  closeLightbox();

  renderEditorChips();
  renderEditorImages();
  updateCaptionStats();
  updateReminderPreview();
  state.editorSnapshot = editorSignature();
  if (!editor.open) editor.showModal();
  requestAnimationFrame(() => {
    autoGrow();
    if (!post) ed.caption.focus();
  });
}

function renderEditorChips() {
  const types = [...state.settings.content_types];
  if (edType && !types.includes(edType)) types.push(edType);
  ed.types.innerHTML = types
    .map(
      (t) =>
        `<button type="button" class="chip" role="radio" style="--chip-color:${typeColor(t)}" aria-checked="${t === edType}" data-value="${esc(t)}"><span class="dot"></span>${esc(t)}</button>`
    )
    .join("");

  const platforms = [...state.settings.platforms];
  for (const p of edPlatforms) if (!platforms.includes(p)) platforms.push(p);
  ed.platforms.innerHTML = platforms
    .map((p) => `<button type="button" class="chip" aria-pressed="${edPlatforms.includes(p)}" data-value="${esc(p)}">${esc(p)}</button>`)
    .join("");

  ed.status.innerHTML = Object.entries(STATUS_LABELS)
    .map(([k, label]) => `<button type="button" role="radio" aria-checked="${k === edStatus}" data-value="${k}">${label}</button>`)
    .join("");
}

ed.types.addEventListener("click", (e) => {
  const b = e.target.closest("[data-value]");
  if (!b) return;
  edType = edType === b.dataset.value ? "" : b.dataset.value;
  renderEditorChips();
});
ed.platforms.addEventListener("click", (e) => {
  const b = e.target.closest("[data-value]");
  if (!b) return;
  const v = b.dataset.value;
  edPlatforms = edPlatforms.includes(v) ? edPlatforms.filter((x) => x !== v) : [...edPlatforms, v];
  renderEditorChips();
  updateCaptionStats();
});
ed.status.addEventListener("click", (e) => {
  const b = e.target.closest("[data-value]");
  if (!b) return;
  edStatus = b.dataset.value;
  renderEditorChips();
  updateReminderPreview();
});

function autoGrow() {
  const ta = ed.caption;
  ta.style.height = "auto";
  ta.style.height = `${Math.min(Math.max(ta.scrollHeight + 2, 180), window.innerHeight * 0.55)}px`;
}

function updateCaptionStats() {
  const text = ed.caption.value;
  const s = captionStats(text);
  $("#caption-stats").textContent = `${s.chars.toLocaleString()} characters · ${s.words} words · ${s.hashtags} hashtag${s.hashtags === 1 ? "" : "s"}${
    s.mentions ? ` · ${s.mentions} mention${s.mentions === 1 ? "" : "s"}` : ""
  }`;
  const warnings = [];
  for (const p of edPlatforms) {
    const lim = LIMITS[p.toLowerCase().replace(/\s|\(.*\)/g, "")];
    if (!lim) continue;
    if (s.chars > lim.chars) warnings.push(`${p}: ${s.chars - lim.chars} characters over the ${lim.chars.toLocaleString()} limit`);
    if (lim.hashtags && s.hashtags > lim.hashtags) warnings.push(`${p}: max ${lim.hashtags} hashtags (you have ${s.hashtags})`);
  }
  $("#caption-warnings").innerHTML = warnings.map((w) => `<div class="warn">⚠️ ${esc(w)}</div>`).join("");
}

function editorDate() {
  if (!ed.date.value) return null;
  const [y, m, d] = ed.date.value.split("-").map(Number);
  const [hh, mm] = (ed.time.value || "18:00").split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

function updateReminderPreview() {
  renderEditorReminders();
  const el = $("#reminder-preview");
  const d = editorDate();
  if (!d) {
    el.textContent = "No date → saved under “Ideas & drafts”. No reminders.";
    return;
  }
  if (edStatus === "posted") {
    el.textContent = "Marked as posted — no reminders will be sent.";
    return;
  }
  el.textContent = `🗓 ${fmtDate(d)}, ${fmtTime(d)} (${relativeFromNow(d)})`;
}

function renderEditorReminders() {
  const box = $("#reminder-box");
  const hasDate = Boolean(ed.date.value) && edStatus !== "posted";
  box.hidden = !hasDate;
  if (!hasDate) return;
  const custom = Array.isArray(edReminders);
  $$("#f-rem-mode button").forEach((b) => b.setAttribute("aria-checked", String((b.dataset.mode === "custom") === custom)));
  const target = $("#f-reminders");
  if (!custom) {
    const offs = state.settings.reminder_offsets || [];
    target.innerHTML = `<p class="muted small" style="margin:0">${
      offs.length ? esc(offs.map((m) => offsetLabel(m, { short: true })).join(" · ")) : "No default reminders"
    } — <a href="#settings" data-goto-settings>change defaults</a></p>`;
    return;
  }
  const list = [...edReminders].sort((a, b) => b - a);
  target.innerHTML = `<div class="rem-chips">${
    list.length
      ? list.map((m) => `<span class="rem-chip">${esc(offsetLabel(m))}<button type="button" data-rem-remove="${m}" aria-label="Remove">×</button></span>`).join("")
      : `<span class="muted small">No reminders for this post</span>`
  }</div>
  <div style="margin-top:8px">${adderHTML("post")}</div>
  <div class="rem-chips" style="margin-top:8px">${[0, 15, 30, 60, 180, 1440]
    .filter((m) => !list.includes(m))
    .map((m) => `<button type="button" class="chip" data-rem-quick="${m}">+ ${esc(offsetLabel(m, { short: true }))}</button>`)
    .join("")}</div>`;
}

$("#f-rem-mode").addEventListener("click", (e) => {
  const b = e.target.closest("[data-mode]");
  if (!b) return;
  if (b.dataset.mode === "custom" && !Array.isArray(edReminders)) edReminders = [...(state.settings.reminder_offsets || [])];
  if (b.dataset.mode === "default") edReminders = null;
  renderEditorReminders();
});

$("#f-reminders").addEventListener("click", (e) => {
  if (e.target.closest("[data-goto-settings]")) {
    e.preventDefault();
    closeEditor();
    if (!editor.open) location.hash = "#settings";
    return;
  }
  const rm = e.target.closest("[data-rem-remove]");
  if (rm) {
    edReminders = edReminders.filter((m) => m !== Number(rm.dataset.remRemove));
    return renderEditorReminders();
  }
  const quick = e.target.closest("[data-rem-quick]");
  if (quick) {
    if (edReminders.length >= MAX_REMINDERS) return toast(`Max ${MAX_REMINDERS} reminders`, "error");
    edReminders = [...edReminders, Number(quick.dataset.remQuick)];
    return renderEditorReminders();
  }
  if (e.target.closest("[data-add]")) {
    const min = readAdder(e.target.closest("[data-adder]"), edReminders);
    if (min !== null) {
      edReminders = [...edReminders, min];
      renderEditorReminders();
    }
  }
});
$("#f-reminders").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.matches("[data-adder] input")) {
    e.preventDefault();
    $("[data-add]", e.target.closest("[data-adder]")).click();
  }
});

ed.caption.addEventListener("input", () => {
  updateCaptionStats();
  autoGrow();
});
ed.date.addEventListener("change", () => {
  if (ed.date.value && !ed.time.value) ed.time.value = "18:00";
  updateReminderPreview();
});
ed.time.addEventListener("change", updateReminderPreview);

$(".quick-dates").addEventListener("click", (e) => {
  const b = e.target.closest("[data-quick]");
  if (!b) return;
  const now = new Date();
  let d = startOfDay(now);
  if (b.dataset.quick === "tomorrow") d = addDays(d, 1);
  if (b.dataset.quick === "weekend") d = addDays(d, d.getDay() === 0 ? 0 : 6 - d.getDay()); // Saturday (or today if weekend)
  if (b.dataset.quick === "nextweek") d = addDays(d, ((8 - d.getDay()) % 7) || 7);
  ed.date.value = dayKey(d);
  if (!ed.time.value) ed.time.value = "18:00";
  if (edStatus === "idea") {
    edStatus = "draft";
    renderEditorChips();
  }
  updateReminderPreview();
});

function editorSignature() {
  return JSON.stringify([
    ed.title.value,
    ed.caption.value,
    ed.date.value,
    ed.time.value,
    ed.notes.value,
    edType,
    edPlatforms,
    edStatus,
    edReminders,
    edImages.map((i) => i.id || i.key),
  ]);
}

function editorPayload() {
  const d = editorDate();
  return {
    title: ed.title.value.trim(),
    caption: ed.caption.value,
    content_type: edType,
    platforms: edPlatforms,
    status: edStatus,
    notes: ed.notes.value,
    scheduled_at: d ? d.toISOString() : null,
    reminder_offsets: edReminders,
    has_images: edImages.length > 0,
  };
}

function closeEditor(force = false) {
  if (!force && editorSignature() !== state.editorSnapshot && !confirm("Discard your unsaved changes?")) return;
  editor.close();
  state.editing = null;
  closeLightbox();
  clearPendingImages();
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = editorPayload();
  if (!payload.title && !payload.caption.trim() && !edImages.length) {
    toast("Write a caption, a title or add an image first", "error");
    ed.caption.focus();
    return;
  }
  if (edImages.some((i) => i.processing)) return toast("Still preparing images — one moment", "error");
  const buttons = $$('button[type="submit"]', form);
  const setLabel = (t) => buttons.forEach((b) => (b.textContent = t));
  buttons.forEach((b) => (b.disabled = true));
  const wasEditing = Boolean(state.editing);
  let saved = null;
  try {
    const justPosted = payload.status === "posted" && state.editing?.status !== "posted";
    const res = wasEditing
      ? await api(`/api/posts/${state.editing.id}`, { method: "PUT", body: payload })
      : await api("/api/posts", { method: "POST", body: payload });
    const btnRect = (e.submitter || buttons[0]).getBoundingClientRect();
    saved = res.post;
    state.editing = saved; // from now on, retries update this post instead of creating a new one
    upsertLocal(saved);
    await syncImages(saved.id, setLabel);
    const { post: fresh } = await api(`/api/posts/${saved.id}`);
    upsertLocal(fresh);
    closeEditor(true);
    render();
    if (justPosted) {
      confetti(btnRect.left + btnRect.width / 2, btnRect.top + btnRect.height / 2);
      toast("Posted — nice work! 🎉");
    } else toast(wasEditing ? "Saved ✨" : fresh.scheduled_at ? "Scheduled 🗓️" : "Saved to ideas 💡");
  } catch (err) {
    toast(err.message, "error");
    if (saved) {
      // The post itself is saved; keep the editor open so the remaining images can be retried.
      $("#editor-title").textContent = "Edit caption";
      $("#delete-btn").hidden = false;
      $("#duplicate-btn").hidden = false;
      renderEditorImages();
      state.editorSnapshot = "";
      render();
    }
  } finally {
    setLabel("Save");
    buttons.forEach((b) => (b.disabled = false));
  }
});

/** Apply image removals, uploads and ordering for a saved post. */
async function syncImages(postId, setLabel) {
  for (const id of [...edRemovedImages]) {
    await api(`/api/images/${id}`, { method: "DELETE" });
    edRemovedImages = edRemovedImages.filter((x) => x !== id);
  }
  const pending = edImages.filter((i) => i.pending);
  let n = 0;
  for (const img of pending) {
    n++;
    setLabel(`Uploading ${n}/${pending.length}…`);
    const fd = new FormData();
    fd.append("image", img.blob, img.name || "image.jpg");
    if (img.thumb) fd.append("thumb", img.thumb, "thumb.jpg");
    if (img.width) fd.append("width", String(img.width));
    if (img.height) fd.append("height", String(img.height));
    const res = await fetch(`/api/posts/${postId}/images`, { method: "POST", body: fd, credentials: "same-origin" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ? `Image upload failed: ${data.error}` : "Image upload failed");
    URL.revokeObjectURL(img.url);
    const i = edImages.indexOf(img);
    if (i >= 0) edImages[i] = { ...data.image };
  }
  const ids = edImages.map((i) => i.id).filter(Boolean);
  if (ids.length > 1) await api(`/api/posts/${postId}/images`, { method: "PUT", body: { ids } });
}

/* ---------- images in the editor ---------- */

function clearPendingImages() {
  for (const i of edImages) if (i.url) URL.revokeObjectURL(i.url);
}

function imgSrc(img, thumb = true) {
  if (img.pending) return img.url;
  return `/api/images/${img.id}${thumb ? "?size=thumb" : ""}`;
}

function renderEditorImages() {
  const grid = $("#f-images");
  grid.innerHTML =
    edImages
      .map(
        (img, i) => `<div class="img-tile ${img.pending ? "pending" : ""} ${img.processing ? "busy" : ""}" data-img="${i}" role="button" tabindex="0" aria-label="Image ${i + 1}">
          ${img.processing ? "" : `<img alt="" src="${esc(imgSrc(img))}" />`}
          ${i === 0 ? `<span class="img-badge">Cover</span>` : ""}
          <button type="button" class="img-x" data-img-remove="${i}" aria-label="Remove image">×</button>
        </div>`
      )
      .join("") +
    (edImages.length < MAX_IMAGES ? `<button type="button" class="img-add" data-img-add><span>+</span><span>Add photo</span></button>` : "");
  $("#img-count").textContent = edImages.length ? `${edImages.length}/${MAX_IMAGES}` : "";
}

$("#f-images").addEventListener("click", (e) => {
  const rm = e.target.closest("[data-img-remove]");
  if (rm) {
    e.stopPropagation();
    removeImage(Number(rm.dataset.imgRemove));
    return;
  }
  if (e.target.closest("[data-img-add]")) return $("#f-image-input").click();
  const tile = e.target.closest("[data-img]");
  if (tile && !edImages[Number(tile.dataset.img)]?.processing) openLightbox(Number(tile.dataset.img));
});
$("#f-images").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.matches("[data-img]")) openLightbox(Number(e.target.dataset.img));
});

$("#f-image-input").addEventListener("change", (e) => {
  addImageFiles([...e.target.files]);
  e.target.value = "";
});

function removeImage(i) {
  const img = edImages[i];
  if (!img) return;
  if (img.id) edRemovedImages.push(img.id);
  if (img.url) URL.revokeObjectURL(img.url);
  edImages.splice(i, 1);
  renderEditorImages();
}

async function addImageFiles(files) {
  const images = files.filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
  if (!images.length) return files.length && toast("Only photos can be added (no videos)", "error");
  const room = MAX_IMAGES - edImages.length;
  if (room <= 0) return toast(`Max ${MAX_IMAGES} images per post`, "error");
  if (images.length > room) toast(`Only the first ${room} added (max ${MAX_IMAGES})`, "error");
  const slots = images.slice(0, room).map((file) => {
    const slot = { key: `p${++pendingKey}`, pending: true, processing: true, name: file.name };
    edImages.push(slot);
    return [file, slot];
  });
  renderEditorImages();
  for (const [file, slot] of slots) {
    try {
      Object.assign(slot, await prepareImage(file), { processing: false });
      slot.url = URL.createObjectURL(slot.blob);
    } catch (err) {
      const i = edImages.indexOf(slot);
      if (i >= 0) edImages.splice(i, 1);
      toast(err.message, "error");
    }
    renderEditorImages();
  }
}

async function decodeImage(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
}

function encodeImage(source, maxEdge, quality, type = "image/jpeg") {
  const w = source.width;
  const h = source.height;
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (type === "image/jpeg") {
    ctx.fillStyle = "#fff"; // transparent PNGs get a white background
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve({ blob: b, width: canvas.width, height: canvas.height }) : reject(new Error("Couldn't process image"))), type, quality)
  );
}

/** Resize/compress a photo in the browser so it fits the free database storage. */
async function prepareImage(file) {
  let source;
  try {
    source = await decodeImage(file);
  } catch {
    throw new Error(`Can't read “${file.name}”. Try a JPG or PNG (iPhone HEIC photos: share/export as JPG first).`);
  }
  const thumb = (await encodeImage(source, THUMB_EDGE, 0.78)).blob;
  const small = Math.max(source.width, source.height) <= IMG_MAX_EDGE;
  // Keep the original file untouched when it's already small enough (best quality).
  if (small && file.size <= IMG_MAX_BYTES && ["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return { blob: file, thumb, width: source.width, height: source.height };
  }
  for (const edge of [IMG_MAX_EDGE, 1600, 1280]) {
    for (const q of [0.88, 0.8, 0.7]) {
      const out = await encodeImage(source, edge, q);
      if (out.blob.size <= IMG_MAX_BYTES) return { blob: out.blob, thumb, width: out.width, height: out.height };
    }
  }
  throw new Error(`“${file.name}” is too large even after resizing`);
}

// Paste images (e.g. screenshots) and drag & drop onto the editor.
editor.addEventListener("paste", (e) => {
  const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith("image/"));
  if (files.length) {
    e.preventDefault();
    addImageFiles(files);
  }
});
editor.addEventListener("dragover", (e) => {
  if ([...(e.dataTransfer?.types || [])].includes("Files")) {
    e.preventDefault();
    editor.classList.add("dragging");
  }
});
editor.addEventListener("dragleave", (e) => {
  if (e.target === editor || !editor.contains(e.relatedTarget)) editor.classList.remove("dragging");
});
editor.addEventListener("drop", (e) => {
  editor.classList.remove("dragging");
  if (e.dataTransfer?.files?.length) {
    e.preventDefault();
    addImageFiles([...e.dataTransfer.files]);
  }
});

/* ---------- lightbox ---------- */

function openLightbox(i) {
  const img = edImages[i];
  if (!img) return;
  lightboxIndex = i;
  $("#lb-img").src = imgSrc(img, false);
  $("#lb-label").textContent = `Image ${i + 1} of ${edImages.length}${i === 0 ? " · cover" : ""}${img.pending ? " · not saved yet" : ""}`;
  const dl = $("#lb-download");
  dl.href = img.pending ? img.url : `/api/images/${img.id}?download=1`;
  dl.setAttribute("download", img.pending ? img.name || "image.jpg" : "");
  $('[data-lb="left"]').disabled = i === 0;
  $('[data-lb="right"]').disabled = i === edImages.length - 1;
  $("#lightbox").hidden = false;
}

function closeLightbox() {
  lightboxIndex = -1;
  const lb = $("#lightbox");
  if (lb) {
    lb.hidden = true;
    $("#lb-img").removeAttribute("src");
  }
}

$("#lightbox").addEventListener("click", (e) => {
  const b = e.target.closest("[data-lb]");
  if (!b) {
    if (e.target.id === "lightbox") closeLightbox();
    return;
  }
  const i = lightboxIndex;
  const act = b.dataset.lb;
  if (act === "close") return closeLightbox();
  if (act === "remove") {
    closeLightbox();
    return removeImage(i);
  }
  const j = act === "left" ? i - 1 : i + 1;
  if (j < 0 || j >= edImages.length) return;
  [edImages[i], edImages[j]] = [edImages[j], edImages[i]];
  renderEditorImages();
  openLightbox(j);
});

form.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const action = b.dataset.action;
  if (action === "close") closeEditor();
  if (action === "copy") {
    if (ed.caption.value.trim()) copyText(ed.caption.value);
    else toast("Nothing to copy yet", "error");
  }
  if (action === "clear-date") {
    ed.date.value = "";
    ed.time.value = "";
    updateReminderPreview();
  }
  if (action === "delete" && state.editing) {
    if (!confirm("Delete this caption? This can't be undone.")) return;
    try {
      await api(`/api/posts/${state.editing.id}`, { method: "DELETE" });
      state.posts = state.posts.filter((p) => p.id !== state.editing.id);
      updateCounts();
      closeEditor(true);
      render();
      toast("Deleted");
    } catch (err) {
      toast(err.message, "error");
    }
  }
  if (action === "duplicate" && state.editing) {
    const copy = editorPayload();
    state.editing = null;
    $("#editor-title").textContent = "New caption (copy)";
    $("#delete-btn").hidden = true;
    $("#duplicate-btn").hidden = true;
    ed.title.value = copy.title ? `${copy.title} (copy)` : "";
    edStatus = copy.status === "posted" ? "draft" : copy.status;
    ed.date.value = "";
    ed.time.value = "";
    // Copy images as new uploads.
    const toCopy = edImages.filter((i) => !i.pending && i.id);
    edImages = edImages.filter((i) => i.pending);
    edRemovedImages = [];
    renderEditorChips();
    updateReminderPreview();
    state.editorSnapshot = "";
    toast("Duplicated — pick a new date and save");
    for (const img of toCopy) {
      const slot = { key: `p${++pendingKey}`, pending: true, processing: true, name: `image-${img.id}.jpg`, width: img.width, height: img.height };
      edImages.push(slot);
      renderEditorImages();
      try {
        const [full, th] = await Promise.all([fetch(`/api/images/${img.id}`), fetch(`/api/images/${img.id}?size=thumb`)]);
        slot.blob = await full.blob();
        slot.thumb = await th.blob();
        slot.url = URL.createObjectURL(slot.blob);
        slot.processing = false;
      } catch {
        edImages.splice(edImages.indexOf(slot), 1);
      }
      renderEditorImages();
    }
  }
});

editor.addEventListener("cancel", (e) => {
  e.preventDefault();
  if (lightboxIndex >= 0) return closeLightbox();
  closeEditor();
});
editor.addEventListener("click", (e) => {
  if (e.target === editor) closeEditor(); // click on backdrop
});
editor.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") form.requestSubmit();
});

document.addEventListener("keydown", (e) => {
  if (editor.open || $("#app").hidden) return;
  if (e.target.matches("input, textarea, select")) return;
  if (e.key === "n") {
    e.preventDefault();
    openEditor(null);
  }
  if (e.key === "/") {
    e.preventDefault();
    $("#search").focus();
  }
});

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

async function renderSettings(view) {
  const s = state.settings;
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  let zones = [];
  try {
    zones = Intl.supportedValuesOf("timeZone");
  } catch {
    zones = [s.timezone, browserTz];
  }
  if (!zones.includes(s.timezone)) zones.unshift(s.timezone);
  const hours = Array.from({ length: 24 }, (_, h) => h);
  const hourLabel = (h) => new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: "numeric" });

  view.innerHTML = `
  <div class="settings">
    <section class="panel" id="tg-panel">
      <h2>🔔 Telegram reminders</h2>
      <p class="muted">Get a message before each post — with the caption ready to copy.</p>
      <div id="tg-body" class="muted">Checking…</div>
    </section>

    <section class="panel">
      <h2>🎨 Theme</h2>
      <p class="muted">Pick a look. It's saved on this device, so each phone or computer can have its own.</p>
      <div class="theme-grid" id="theme-grid" role="radiogroup" aria-label="Theme">
        ${THEMES.map(
          (t) => `<button type="button" class="theme-card" role="radio" data-theme-id="${t.id}" aria-checked="${currentTheme() === t.id}">
            <span class="tc-in"><span class="tp ${t.preview}" aria-hidden="true"><i></i><i></i><em></em></span>
            <b>${esc(t.name)}</b><small>${esc(t.desc)}</small></span>
          </button>`
        ).join("")}
      </div>
    </section>

    <section class="panel">
      <h2>⏰ When should I remind you?</h2>
      <div class="check-grid" id="offsets">
        ${REMINDER_CHOICES.map(
          ([m, label]) => `<label class="check"><input type="checkbox" value="${m}" ${s.reminder_offsets.includes(m) ? "checked" : ""}/> ${label}</label>`
        ).join("")}
      </div>
      <div class="custom-row">
        <span class="label">Custom times</span>
        <div class="rem-chips" id="custom-offsets"></div>
        ${adderHTML("settings")}
        <span class="muted small">Reminders are checked every 5 minutes, so they can arrive up to ~5 min late. You can also set custom times on a single post.</span>
      </div>
      <div class="settings-grid">
        <label class="field"><span>Morning summary of today's posts</span>
          <select id="digest-hour">
            <option value="-1" ${s.digest_hour === -1 ? "selected" : ""}>Off</option>
            ${hours.map((h) => `<option value="${h}" ${s.digest_hour === h ? "selected" : ""}>${hourLabel(h)}</option>`).join("")}
          </select>
        </label>
        <label class="field"><span>Time zone for reminders</span>
          <select id="timezone">${zones.map((z) => `<option ${z === s.timezone ? "selected" : ""}>${esc(z)}</option>`).join("")}</select>
        </label>
      </div>
      ${browserTz && browserTz !== s.timezone ? `<p class="small" style="color:var(--warn)">Your device is set to <b>${esc(browserTz)}</b>. <button class="link-btn" id="use-browser-tz">Use that</button></p>` : ""}
      <div class="row">
        <label class="check"><input type="checkbox" id="nudge" ${s.nudge_unposted ? "checked" : ""}/> Ask “did you post it?” 2h after the time</label>
        <label class="check"><input type="checkbox" id="digest-empty" ${s.digest_when_empty ? "checked" : ""}/> Send the summary even on empty days</label>
      </div>
    </section>

    <section class="panel">
      <h2>🎬 Content types</h2>
      <p class="muted">The kinds of content you post. Shown as colored tags.</p>
      <div class="tag-editor" data-list="content_types"></div>
    </section>

    <section class="panel">
      <h2>📱 Platforms</h2>
      <p class="muted">Where you post. Caption length warnings are shown for Instagram, TikTok, X, Threads, etc.</p>
      <div class="tag-editor" data-list="platforms"></div>
    </section>

    <section class="panel">
      <h2>✨ Personalize</h2>
      <div class="settings-grid">
        <label class="field"><span>Website name</span><input id="app-name" maxlength="60" value="${esc(s.app_name)}" /></label>
      </div>
    </section>

    <section class="panel">
      <h2>📦 Photo storage</h2>
      <p class="muted">The free database holds about 500 MB — roughly 400–800 photos. Captions take almost no space.</p>
      <div id="storage-body" class="muted">Checking…</div>
    </section>

    <section class="panel">
      <h2>💾 Your data</h2>
      <p class="muted">Download a backup of every caption (images aren't included — download them from each post).</p>
      <div class="row">
        <button class="btn btn-ghost" id="export-json">Download backup (JSON)</button>
        <button class="btn btn-ghost" id="export-csv">Download spreadsheet (CSV)</button>
        <span class="spacer"></span>
        <button class="btn btn-danger-ghost" id="logout">Log out</button>
      </div>
    </section>
  </div>`;

  renderTagEditors();
  bindSettings();
  renderTelegram();
  renderStorage();
}

const fmtMB = (b) => `${(b / 1024 / 1024).toFixed(b < 10 * 1024 * 1024 ? 1 : 0)} MB`;

async function renderStorage() {
  const box = $("#storage-body");
  if (!box) return;
  let st;
  try {
    st = await api("/api/storage?days=30");
  } catch (err) {
    box.textContent = err.message;
    return;
  }
  if (!$("#storage-body")) return;
  const pct = Math.min(100, (st.used / st.limit) * 100);
  const color = pct > 90 ? "var(--danger)" : pct > 75 ? "var(--warn)" : "var(--ok)";
  box.innerHTML = `
    <div class="meter"><span style="width:${pct.toFixed(1)}%;background:${color}"></span></div>
    <p class="small" style="margin:8px 0 0;color:var(--text)"><b>${fmtMB(st.used)}</b> of ${fmtMB(st.limit)} used · ${st.images} photo${st.images === 1 ? "" : "s"}${
      pct > 75 ? ` · <b style="color:${color}">getting full</b>` : ""
    }</p>
    <div class="row">
      <button class="btn btn-ghost" id="storage-clean" ${st.oldPosted.images ? "" : "disabled"}>
        Remove photos from posts posted 30+ days ago${st.oldPosted.images ? ` (${st.oldPosted.images}, ~${fmtMB(st.oldPosted.bytes)})` : ""}
      </button>
    </div>
    <p class="small" style="margin:8px 0 0">Captions stay — only the photos are removed. Tip: download any you want to keep first.</p>`;
  $("#storage-clean")?.addEventListener("click", async () => {
    if (!confirm(`Remove ${st.oldPosted.images} photo(s) from posts that were posted more than 30 days ago? Captions are kept.`)) return;
    try {
      const r = await api("/api/storage/cleanup", { method: "POST", body: { days: 30 } });
      toast(`Removed ${r.deleted} photo(s)`);
      await loadPosts();
      renderStorage();
    } catch (err) {
      toast(err.message, "error");
    }
  });
}

async function saveSettings(patch, msg = "Settings saved") {
  try {
    const { settings } = await api("/api/settings", { method: "PUT", body: patch });
    state.settings = settings;
    applyBranding();
    toast(msg);
    return true;
  } catch (err) {
    toast(err.message, "error");
    return false;
  }
}

function renderTagEditors() {
  for (const box of $$(".tag-editor")) {
    const key = box.dataset.list;
    const list = state.settings[key];
    box.innerHTML =
      list
        .map(
          (t, i) =>
            `<span class="tag" style="--chip-color:${key === "content_types" ? typeColor(t) : "var(--muted)"}">${
              key === "content_types" ? '<span class="dot"></span>' : ""
            }${esc(t)}<button type="button" aria-label="Remove ${esc(t)}" data-remove="${i}">×</button></span>`
        )
        .join("") + `<input type="text" maxlength="40" placeholder="+ Add ${key === "platforms" ? "platform" : "type"} and press Enter" />`;
  }
}

function bindSettings() {
  for (const box of $$(".tag-editor")) {
    const key = box.dataset.list;
    box.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-remove]");
      if (!b) return;
      const list = state.settings[key].filter((_, i) => i !== Number(b.dataset.remove));
      if (await saveSettings({ [key]: list }, "Removed")) renderTagEditors();
    });
    box.addEventListener("keydown", async (e) => {
      if (e.target.tagName !== "INPUT" || e.key !== "Enter") return;
      e.preventDefault();
      const v = e.target.value.trim();
      if (!v) return;
      if (state.settings[key].some((x) => x.toLowerCase() === v.toLowerCase())) return toast("Already in the list", "error");
      if (await saveSettings({ [key]: [...state.settings[key], v] }, "Added")) {
        renderTagEditors();
        $(`.tag-editor[data-list="${key}"] input`).focus();
      }
    });
  }

  const presetValues = REMINDER_CHOICES.map(([m]) => m);
  const customOffsets = () => state.settings.reminder_offsets.filter((m) => !presetValues.includes(m));
  const renderCustom = () => {
    const list = customOffsets();
    $("#custom-offsets").innerHTML = list.length
      ? list.map((m) => `<span class="rem-chip">${esc(offsetLabel(m))}<button type="button" data-custom-remove="${m}" aria-label="Remove">×</button></span>`).join("")
      : `<span class="muted small">None yet — e.g. 45 minutes or 2 hours before.</span>`;
  };
  renderCustom();
  const saveOffsets = async (offsets) => {
    const ok = await saveSettings({ reminder_offsets: offsets }, offsets.length ? "Reminder times saved" : "Reminders turned off");
    if (!ok) return;
    renderCustom();
    $$("#offsets input").forEach((i) => (i.checked = state.settings.reminder_offsets.includes(Number(i.value))));
  };
  $("#offsets").addEventListener("change", (e) => {
    const offsets = [...$$("#offsets input:checked").map((i) => Number(i.value)), ...customOffsets()];
    if (offsets.length > MAX_REMINDERS) {
      e.target.checked = false;
      return toast(`Max ${MAX_REMINDERS} reminders`, "error");
    }
    saveOffsets(offsets);
  });
  $("#custom-offsets").addEventListener("click", (e) => {
    const b = e.target.closest("[data-custom-remove]");
    if (b) saveOffsets(state.settings.reminder_offsets.filter((m) => m !== Number(b.dataset.customRemove)));
  });
  const adder = $('[data-adder="settings"]');
  adder.addEventListener("click", (e) => {
    if (!e.target.closest("[data-add]")) return;
    const min = readAdder(adder, state.settings.reminder_offsets);
    if (min !== null) saveOffsets([...state.settings.reminder_offsets, min]);
  });
  adder.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.matches("input")) {
      e.preventDefault();
      $("[data-add]", adder).click();
    }
  });
  $("#digest-hour").addEventListener("change", (e) => saveSettings({ digest_hour: Number(e.target.value) }));
  $("#timezone").addEventListener("change", (e) => saveSettings({ timezone: e.target.value }).then(() => render()));
  $("#use-browser-tz")?.addEventListener("click", () =>
    saveSettings({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }).then(() => render())
  );
  $("#nudge").addEventListener("change", (e) => saveSettings({ nudge_unposted: e.target.checked }));
  $("#digest-empty").addEventListener("change", (e) => saveSettings({ digest_when_empty: e.target.checked }));
  $("#app-name").addEventListener("change", (e) => saveSettings({ app_name: e.target.value }));
  $("#theme-grid").addEventListener("click", (e) => {
    const card = e.target.closest("[data-theme-id]");
    if (!card || card.dataset.themeId === currentTheme()) return;
    setTheme(card.dataset.themeId);
    $$("#theme-grid [data-theme-id]").forEach((c) => c.setAttribute("aria-checked", String(c.dataset.themeId === currentTheme())));
    renderTagEditors(); // content-type colors follow the theme
    renderTypeFilter();
    toast(`Theme: ${THEMES.find((t) => t.id === currentTheme()).name}`);
  });

  $("#export-json").addEventListener("click", () => {
    download(`captions-${dayKey(new Date())}.json`, JSON.stringify({ exported_at: new Date().toISOString(), posts: state.posts }, null, 2), "application/json");
  });
  $("#export-csv").addEventListener("click", () => {
    const cols = ["id", "title", "caption", "content_type", "platforms", "scheduled_at", "status", "notes", "created_at"];
    const cell = (v) => `"${String(Array.isArray(v) ? v.join(", ") : v ?? "").replace(/"/g, '""')}"`;
    const rows = [cols.join(","), ...state.posts.map((p) => cols.map((c) => cell(c === "scheduled_at" && p[c] ? new Date(p[c]).toLocaleString() : p[c])).join(","))];
    download(`captions-${dayKey(new Date())}.csv`, "\ufeff" + rows.join("\n"), "text/csv");
  });
  $("#logout").addEventListener("click", async () => {
    await api("/api/logout", { method: "POST" }).catch(() => {});
    location.hash = "";
    showLogin();
  });
}

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function renderTelegram() {
  const body = $("#tg-body");
  if (!body) return;
  let st;
  try {
    st = await api("/api/telegram/status");
  } catch (err) {
    body.textContent = err.message;
    return;
  }
  if (!$("#tg-body")) return; // navigated away

  if (st.previewMode) {
    body.innerHTML = `<span class="pill-status off">Off on this test copy</span>
      <p class="small" style="margin:10px 0 0">This is a test preview of the website. Telegram is switched off here so it can't disturb your real bot or send real reminders. Everything else works normally, with its own separate test data.</p>`;
    return;
  }

  if (!st.tokenSet) {
    body.innerHTML = `<span class="pill-status off">Not set up yet</span>
      <ol class="steps">
        <li>In Telegram, open <a href="https://t.me/BotFather" target="_blank" rel="noopener">@BotFather</a>, send <code>/newbot</code> and follow the steps. Copy the token it gives you.</li>
        <li>In the Cloudflare dashboard → your Worker → <b>Settings → Variables and Secrets</b>, add a secret named <code>TELEGRAM_BOT_TOKEN</code> with that token. (Or run <code>npx wrangler secret put TELEGRAM_BOT_TOKEN</code>.)</li>
        <li>Come back here and refresh.</li>
      </ol>`;
    return;
  }

  if (st.connected) {
    body.innerHTML = `<span class="pill-status on">● Connected${st.botUsername ? ` to @${esc(st.botUsername)}` : ""}</span>
      <p class="small" style="margin:10px 0 0">In Telegram you can also send <code>/today</code>, <code>/week</code> or <code>/next</code> to your bot.</p>
      <div class="row">
        <button class="btn btn-primary" id="tg-test">Send a test message</button>
        <button class="btn btn-ghost" id="tg-setup">Re-connect bot</button>
        <button class="btn btn-ghost" id="tg-run">Check reminders now</button>
        <button class="btn btn-danger-ghost" id="tg-disconnect">Disconnect</button>
      </div>`;
  } else {
    body.innerHTML = `<span class="pill-status off">Bot token found — one more step</span>
      <ol class="steps">
        <li>${st.webhookReady ? "✅ Bot connected to this website." : `Click <b>Connect bot</b> below.`}</li>
        <li>Then tap <b>Open Telegram</b> and press <b>Start</b> in the chat with your bot. That's it!</li>
      </ol>
      ${st.https ? "" : `<p class="small" style="color:var(--warn)">You're on a non-https address (local preview). Telegram can only connect to the deployed https site.</p>`}
      <div class="row">
        <button class="btn ${st.webhookReady ? "btn-ghost" : "btn-primary"}" id="tg-setup">${st.webhookReady ? "Re-connect bot" : "Connect bot"}</button>
        ${st.link ? `<a class="btn btn-primary" href="${esc(st.link)}" target="_blank" rel="noopener">Open Telegram ↗</a>` : ""}
        <button class="btn btn-ghost" id="tg-refresh">I pressed Start — check</button>
      </div>`;
  }

  $("#tg-setup")?.addEventListener("click", async (e) => {
    e.target.disabled = true;
    try {
      const r = await api("/api/telegram/setup", { method: "POST" });
      toast(`Bot @${r.botUsername} connected`);
      if (!st.connected && r.link) window.open(r.link, "_blank", "noopener");
      renderTelegram();
    } catch (err) {
      toast(err.message, "error");
      e.target.disabled = false;
    }
  });
  $("#tg-refresh")?.addEventListener("click", async () => {
    const { settings } = await api("/api/settings");
    state.settings = settings;
    renderTelegram();
  });
  $("#tg-test")?.addEventListener("click", async (e) => {
    e.target.disabled = true;
    try {
      await api("/api/telegram/test", { method: "POST" });
      toast("Test sent — check Telegram 📨");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      e.target.disabled = false;
    }
  });
  $("#tg-run")?.addEventListener("click", async (e) => {
    e.target.disabled = true;
    try {
      const r = await api("/api/run-reminders", { method: "POST" });
      toast(r.errors.length ? r.errors[0] : r.reminders || r.nudges ? `Sent ${r.reminders + r.nudges} reminder(s)` : "No reminders due right now", r.errors.length ? "error" : "");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      e.target.disabled = false;
    }
  });
  $("#tg-disconnect")?.addEventListener("click", async () => {
    if (!confirm("Stop sending reminders to this Telegram chat?")) return;
    await api("/api/telegram/disconnect", { method: "POST" });
    renderTelegram();
  });
}

boot();
