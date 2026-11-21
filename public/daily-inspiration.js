import { FALLBACK_SEED, getDailyReference, getVerseSeed, localDateKey, millisecondsUntilMidnight } from "./daily-verses.js";

const GREETINGS = {
  auto: { label: "A MOMENT OF GRACE", title: "A little light for your day.", ornament: "✧" },
  rose: { label: "A MOMENT OF GRACE", title: "A little light for your day.", ornament: "✧" },
  "rose-dark": { label: "A QUIET MOMENT", title: "Rest in a little grace.", ornament: "☾" },
  matcha: { label: "A SIP OF STILLNESS", title: "Pause, breathe, be still.", ornament: "❦" },
  bookish: { label: "THE DAILY READING", title: "A little light for this chapter.", ornament: "❧" },
  cyber: { label: "DAILY SIGNAL / 01", title: "Faith in the noise.", ornament: "+" },
  christmas: { label: "THE HOLIDAY STUDIO", title: "A little merry, a little grace.", ornament: "✧" },
};

export function greetingForTheme(theme) {
  return GREETINGS[theme] || GREETINGS.auto;
}

export function salutation(date) {
  const hour = date.getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

// getTheme is read on each refresh: switching looks never changes today's verse.
// Dependencies are injectable so midnight/resume behavior can be tested without a browser.
export function initDailyInspiration(getTheme, { root = document, host = window, now = () => new Date() } = {}) {
  const card = root.querySelector("#daily-inspiration");
  if (!card) return { refresh() {}, destroy() {} };
  const find = (id) => root.querySelector(`#${id}`);
  let seed = FALLBACK_SEED;
  try { seed = getVerseSeed(host.localStorage); } catch { /* Storage may be disabled entirely. */ }
  let timer;
  let requestTimer;
  let requestId = 0;
  let requestController;
  let pending;
  let inFlight = false;
  let loadedReference;
  let currentReference;
  let retryAt = 0;
  let stopped = false;

  async function loadVerse(reference) {
    const id = ++requestId;
    requestController?.abort();
    host.clearTimeout(requestTimer);
    const controller = new AbortController();
    requestController = controller;
    inFlight = true;
    loadedReference = undefined;
    find("daily-reading").hidden = true;
    find("daily-copyright").hidden = true;
    find("daily-retry").hidden = true;
    const status = find("daily-status");
    status.hidden = false;
    status.textContent = `Loading today's ESV verse · ${reference}…`;
    const timeout = host.setTimeout(() => controller.abort(), 12000);
    requestTimer = timeout;
    try {
      const response = await host.fetch(`/api/verse?reference=${encodeURIComponent(reference)}`, {
        credentials: "same-origin", signal: controller.signal,
      });
      const data = await response.json();
      if (stopped || id !== requestId) return;
      if (!response.ok) {
        const message = response.status === 401 ? "Sign in again to load today's ESV verse." : data?.error;
        throw Object.assign(new Error(message || "Today's ESV verse is temporarily unavailable."), { code: data?.code });
      }
      if (data?.reference !== reference || data.translation !== "ESV" || typeof data.text !== "string" || !data.text.trim()) {
        throw new Error("The ESV service returned an unreadable passage.");
      }
      find("daily-verse-text").textContent = data.text;
      find("daily-verse-reference").textContent = reference;
      find("daily-reading").hidden = false;
      find("daily-copyright").hidden = false;
      status.hidden = true;
      loadedReference = reference;
      retryAt = 0;
    } catch (err) {
      if (stopped || id !== requestId) return;
      status.textContent = `${reference} · ${err.name === "AbortError" ? "The ESV request timed out. Please try again." : err.message || "Today's ESV verse could not be loaded."}`;
      find("daily-retry").hidden = false;
      retryAt = now().getTime() + (err.code === "esv_not_configured" ? 300000 : 60000);
    } finally {
      host.clearTimeout(timeout);
      if (id === requestId) inFlight = false;
    }
  }

  function refresh() {
    if (stopped) return;
    const date = now();
    const greeting = greetingForTheme(getTheme());
    const reference = getDailyReference(date, seed);
    find("daily-salutation").textContent = salutation(date);
    find("daily-label").textContent = greeting.label;
    find("daily-title").textContent = greeting.title;
    find("daily-ornament").textContent = greeting.ornament;
    const time = find("daily-date");
    time.dateTime = localDateKey(date);
    time.textContent = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(date);
    if (reference !== currentReference || (!inFlight && loadedReference !== reference && date.getTime() >= retryAt)) {
      currentReference = reference;
      pending = loadVerse(reference);
    }
    card.hidden = false;
    host.clearTimeout(timer);
    timer = host.setTimeout(refresh, millisecondsUntilMidnight(date));
    return pending;
  }

  function onVisible() {
    if (!root.hidden) refresh();
  }
  function retry() { retryAt = 0; refresh(); }
  find("daily-retry").addEventListener("click", retry);
  root.addEventListener("visibilitychange", onVisible);
  host.addEventListener("focus", refresh);
  host.addEventListener("pageshow", refresh);
  refresh();
  return {
    refresh,
    destroy() {
      stopped = true;
      requestId++;
      requestController?.abort();
      host.clearTimeout(requestTimer);
      host.clearTimeout(timer);
      find("daily-retry").removeEventListener("click", retry);
      root.removeEventListener("visibilitychange", onVisible);
      host.removeEventListener("focus", refresh);
      host.removeEventListener("pageshow", refresh);
    },
  };
}
