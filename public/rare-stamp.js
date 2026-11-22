// Rare one-of-a-kind stamp + special embroidered patch: Tubby cat deliveries + plain posted counter.
// Tubby enters ONLY at exactly 13 (rare stamp) or exactly 30 (Badog Patrol patch), and only until unlocked.
import {
  RARE_STAMP_ID,
  RARE_STAMP_MESSAGE,
  RARE_STAMP_DATE_LABEL,
  RARE_UNLOCK_KEY,
  RARE_UNLOCKED_AT_KEY,
  BADOG_PATROL_ID,
  BADOG_PATROL_MESSAGE,
  BADOG_UNLOCK_KEY,
  BADOG_UNLOCKED_AT_KEY,
  postedCaptionCount,
  isRareStampGoal,
  isBadogPatrolGoal,
  isRareStampUnlocked,
  isBadogPatrolUnlocked,
} from "./stamp-catalog.js";
import { stampImageUrl } from "./stamp-art.js";
import { tubbyCatSvg } from "./rare-stamp-art.js";

const esc = (v) =>
  String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export { isRareStampUnlocked, isBadogPatrolUnlocked };

export function initRareStamp({ getPosts, onUnlock } = {}) {
  const reducedMotion = () =>
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  function count() {
    return postedCaptionCount(typeof getPosts === "function" ? getPosts() : []);
  }

  // ---- the two Tubby deliveries ----
  const deliveries = [
    {
      key: RARE_UNLOCK_KEY,
      unlockedAtKey: RARE_UNLOCKED_AT_KEY,
      goal: isRareStampGoal,
      isUnlocked: () => isRareStampUnlocked(),
      title: "Congratulations! You've unlocked a rare Stamp",
      sub: "✨ One of a kind ✨",
      image: stampImageUrl(RARE_STAMP_ID),
      alt: "Henlo My Love rare stamp — couple selfie with dog and boy scout, house with balloons",
      badge: `<div class="rare-immigration-badge" aria-hidden="true"><small>HENLO MY LOVE</small><b>${esc(RARE_STAMP_DATE_LABEL)}</b><span>ADMITTED WITH LOVE</span></div>`,
      message: RARE_STAMP_MESSAGE,
      dateLine: `Immigration stamp · ${esc(RARE_STAMP_DATE_LABEL)} · November 22, 2026`,
    },
    {
      key: BADOG_UNLOCK_KEY,
      unlockedAtKey: BADOG_UNLOCKED_AT_KEY,
      goal: isBadogPatrolGoal,
      isUnlocked: () => isBadogPatrolUnlocked(),
      title: "Tubby brought you a special patch!",
      sub: "✨ Special embroidered patch ✨",
      image: stampImageUrl(BADOG_PATROL_ID),
      alt: "Badog Patrol special embroidered patch — pug and pomeranian with Badog Patrol lettering",
      badge: `<div class="rare-immigration-badge badog-badge" aria-hidden="true"><small>BADOG PATROL</small><b>30 POSTED</b><span>TUBBY DELIVERY</span></div>`,
      message: BADOG_PATROL_MESSAGE,
      dateLine: `Special embroidered patch · delivered at 30 posted captions`,
    },
  ];

  function setUnlocked(delivery) {
    try {
      localStorage.setItem(delivery.key, "1");
      localStorage.setItem(delivery.unlockedAtKey, new Date().toISOString());
    } catch {}
  }

  // ---- counter widget (small plain section on the right) ----
  let counter = document.querySelector(".posted-counter");
  if (!counter) {
    counter = document.createElement("button");
    counter.type = "button";
    counter.className = "posted-counter";
    counter.setAttribute("aria-label", "Posted captions");
    counter.innerHTML = `
      <span class="pc-label">Posted captions</span>
      <span class="pc-count"><span class="pc-num">0</span></span>`;
    counter.addEventListener("click", () => {
      location.hash = "#posted";
    });
    document.body.append(counter);
  }

  // ---- Tubby cat (walks across the screen until clicked) ----
  let cat = document.querySelector(".tubby-cat");
  if (!cat) {
    cat = document.createElement("button");
    cat.type = "button";
    cat.className = "tubby-cat";
    cat.setAttribute("aria-label", "Tubby cat — open your delivery");
    cat.innerHTML = `<span class="tubby-cat-inner">${tubbyCatSvg()}</span>`;
    cat.hidden = true;
    cat.addEventListener("click", openDelivery);
    document.body.append(cat);
  }

  // ---- unlock windows (one per delivery, word-per-word reveal) ----
  const dialogs = new Map();
  let wordTimer = null;
  function buildDialog(delivery) {
    const dialog = document.createElement("dialog");
    dialog.className = "rare-stamp-dialog";
    dialog.setAttribute("aria-labelledby", `rare-stamp-title-${delivery.key}`);
    const words = delivery.message.split(/\s+/).filter(Boolean);
    dialog.innerHTML = `
      <div class="rare-dialog-inner">
        <p class="rare-dialog-sub">${delivery.sub}</p>
        <h2 id="rare-stamp-title-${delivery.key}">${esc(delivery.title)}</h2>
        <div class="rare-stamp-wrap">
          <img src="${delivery.image}" alt="${esc(delivery.alt)}" />
          ${delivery.badge}
        </div>
        <p class="rare-message" aria-label="${esc(delivery.message)}">
          ${words.map((w) => `<span class="w" aria-hidden="true">${esc(w)}</span>`).join(" ")}
        </p>
        <p class="rare-dialog-date">${esc(delivery.dateLine)}</p>
        <div class="rare-dialog-actions">
          <button type="button" class="btn btn-ghost btn-sm rare-show-all">Show all words</button>
          <button type="button" class="btn btn-primary rare-close">Keep it forever 💖</button>
        </div>
      </div>`;
    document.body.append(dialog);
    dialog.querySelector(".rare-close").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) dialog.close();
    });
    dialog.querySelector(".rare-show-all").addEventListener("click", () => revealAllWords(dialog));
    dialogs.set(delivery.key, dialog);
  }
  for (const delivery of deliveries) buildDialog(delivery);

  function revealAllWords(root) {
    if (wordTimer) {
      clearInterval(wordTimer);
      wordTimer = null;
    }
    root.querySelectorAll(".rare-message .w").forEach((el) => el.classList.add("on"));
  }
  function startWordReveal(root) {
    const spans = [...root.querySelectorAll(".rare-message .w")];
    spans.forEach((el) => el.classList.remove("on"));
    if (wordTimer) clearInterval(wordTimer);
    if (reducedMotion()) {
      revealAllWords(root);
      return;
    }
    let i = 0;
    wordTimer = setInterval(() => {
      if (i >= spans.length) {
        clearInterval(wordTimer);
        wordTimer = null;
        return;
      }
      spans[i++].classList.add("on");
    }, 170);
  }

  function activeDelivery() {
    const n = count();
    // The delivery matching the current exact count; the later milestone wins at 30.
    return deliveries.find((d) => !d.isUnlocked() && d.goal(n)) || null;
  }

  function openDelivery() {
    const delivery = activeDelivery();
    if (!delivery) return;
    setUnlocked(delivery);
    refresh();
    const dialog = dialogs.get(delivery.key);
    if (dialog && typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();
    else if (dialog) dialog.setAttribute("open", "");
    startWordReveal(dialog);
    try {
      onUnlock?.(delivery);
    } catch {}
  }

  function paintCounter(root, n) {
    if (!root) return;
    const num = root.querySelector(".pc-num");
    if (num) num.textContent = String(n);
    root.setAttribute("aria-label", `Posted captions: ${n}`);
  }

  function refresh() {
    const n = count();
    const appHidden = document.querySelector("#app")?.hidden;
    paintCounter(counter, n);
    // Tubby enters ONLY at exactly 13 or exactly 30, and only while a delivery is still pending.
    const showCat = !appHidden && deliveries.some((d) => !d.isUnlocked() && d.goal(n));
    if (cat) cat.hidden = !showCat;
    if (counter) counter.hidden = Boolean(appHidden);
  }

  function hideAll() {
    if (cat) cat.hidden = true;
    if (counter) counter.hidden = true;
    for (const dialog of dialogs.values()) if (dialog?.open) dialog.close();
  }

  window.addEventListener("focus", refresh);
  window.addEventListener("pageshow", refresh);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh();
  });

  refresh();
  return { refresh, hideAll, openDelivery, count };
}
