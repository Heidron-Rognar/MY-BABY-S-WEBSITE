import { FALLBACK_SEED, getDailyVerse, getVerseSeed, localDateKey, millisecondsUntilMidnight } from "./daily-verses.js";

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
  let stopped = false;

  function refresh() {
    if (stopped) return;
    const date = now();
    const greeting = greetingForTheme(getTheme());
    const verse = getDailyVerse(date, seed);
    find("daily-salutation").textContent = salutation(date);
    find("daily-label").textContent = greeting.label;
    find("daily-title").textContent = greeting.title;
    find("daily-ornament").textContent = greeting.ornament;
    const time = find("daily-date");
    time.dateTime = localDateKey(date);
    time.textContent = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(date);
    find("daily-verse-text").textContent = verse.text;
    find("daily-verse-reference").textContent = verse.reference;
    card.hidden = false;
    host.clearTimeout(timer);
    timer = host.setTimeout(refresh, millisecondsUntilMidnight(date));
  }

  function onVisible() {
    if (!root.hidden) refresh();
  }
  root.addEventListener("visibilitychange", onVisible);
  host.addEventListener("focus", refresh);
  host.addEventListener("pageshow", refresh);
  refresh();
  return {
    refresh,
    destroy() {
      stopped = true;
      host.clearTimeout(timer);
      root.removeEventListener("visibilitychange", onVisible);
      host.removeEventListener("focus", refresh);
      host.removeEventListener("pageshow", refresh);
    },
  };
}
