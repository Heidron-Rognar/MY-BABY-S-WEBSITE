// 100 postage + 100 wax + 50 retro caps + 20 embroidered patches.
import { PATCH_STYLES } from "./patch-catalog.js";
import { BRIGHT_YEARS_STYLES } from "./bright-years-catalog.js";
import { PEARL_WAX_STYLES } from "./pearl-wax-catalog.js";
import { BOTTLE_CAP_STYLES } from "./bottle-cap-catalog.js";
const destinations = [
  ["paris", "Paris", "France", "#426d86"], ["london", "London", "England", "#944e50"],
  ["rome", "Rome", "Italy", "#a16a43"], ["kyoto", "Kyoto", "Japan", "#976582"],
  ["new-york", "New York", "USA", "#49786e"], ["sydney", "Sydney", "Australia", "#487d98"],
  ["agra", "Agra", "India", "#a27651"], ["giza", "Giza", "Egypt", "#9a7a3d"],
  ["athens", "Athens", "Greece", "#5c7f9b"], ["istanbul", "Istanbul", "Türkiye", "#697f75"],
  ["amsterdam", "Amsterdam", "Netherlands", "#936445"], ["venice", "Venice", "Italy", "#477e80"],
  ["san-francisco", "San Francisco", "USA", "#a05747"], ["rio", "Rio de Janeiro", "Brazil", "#66856a"],
  ["beijing", "Beijing", "China", "#906050"], ["seoul", "Seoul", "South Korea", "#637a93"],
  ["bangkok", "Bangkok", "Thailand", "#927747"], ["singapore", "Singapore", "Singapore", "#4e8181"],
  ["dubai", "Dubai", "UAE", "#7d6e91"], ["pisa", "Pisa", "Italy", "#977a57"],
  ["prague", "Prague", "Czechia", "#80526b"], ["budapest", "Budapest", "Hungary", "#947858"],
  ["moscow", "Moscow", "Russia", "#955855"], ["copenhagen", "Copenhagen", "Denmark", "#5b7c88"],
  ["lisbon", "Lisbon", "Portugal", "#98734b"], ["barcelona", "Barcelona", "Spain", "#a16f61"],
  ["edinburgh", "Edinburgh", "Scotland", "#6a7760"], ["dublin", "Dublin", "Ireland", "#567b69"],
  ["vienna", "Vienna", "Austria", "#8a7195"], ["brussels", "Brussels", "Belgium", "#847252"],
  ["stockholm", "Stockholm", "Sweden", "#6c8398"], ["helsinki", "Helsinki", "Finland", "#5a7e7e"],
  ["oslo", "Oslo", "Norway", "#5d7784"], ["reykjavik", "Reykjavík", "Iceland", "#7d7699"],
  ["toronto", "Toronto", "Canada", "#8f5b69"], ["seattle", "Seattle", "USA", "#4c7a76"],
  ["mexico-city", "Mexico City", "Mexico", "#9c7651"], ["havana", "Havana", "Cuba", "#5f8a89"],
  ["cusco", "Cusco", "Peru", "#75805b"], ["santiago", "Santiago", "Chile", "#7c7891"],
  ["buenos-aires", "Buenos Aires", "Argentina", "#7e727c"], ["cape-town", "Cape Town", "South Africa", "#6d836c"],
  ["marrakesh", "Marrakesh", "Morocco", "#a06c56"], ["petra", "Petra", "Jordan", "#a57470"],
  ["hoi-an", "Hội An", "Vietnam", "#9b824a"], ["bali", "Bali", "Indonesia", "#6c8062"],
  ["kuala-lumpur", "Kuala Lumpur", "Malaysia", "#687995"], ["manila", "Manila", "Philippines", "#976f58"],
  ["bohol", "Bohol", "Philippines", "#758655"], ["palawan", "Palawan", "Philippines", "#4d8681"],
];
const emblems = [["laurel", "Laurel"], ["rose", "Rose"], ["sun", "Sun"], ["moon", "Crescent"], ["shell", "Seashell"], ["bee", "Honeybee"], ["butterfly", "Butterfly"], ["heart", "Heart"], ["compass", "Compass"], ["monogram", "Studio monogram"]];
const waxes = [["cranberry", "Cranberry", "#883c4d"], ["sea-glass", "Sea Glass", "#427d77"], ["antique-gold", "Antique Gold", "#a17c35"], ["lavender", "Lavender", "#807094"], ["pearl", "Pearl", "#c3aa91"]];
export const STAMP_STYLES = Object.freeze([
  ...destinations.map(([art, name, country, color]) => Object.freeze({ id: `post-${art}`, kind: "postage", name: `${name} · ${country}`, title: name, country, color, art })),
  ...waxes.flatMap(([wax, name, color]) => emblems.map(([art, label]) => Object.freeze({ id: `wax-${wax}-${art}`, kind: "wax", name: `${name} · ${label}`, title: label, color, art }))),
  ...BOTTLE_CAP_STYLES,
  ...PEARL_WAX_STYLES,
  ...BRIGHT_YEARS_STYLES,
  ...PATCH_STYLES,
]);
export const STAMP_IDS = new Set(STAMP_STYLES.map((s) => s.id));
export const DEFAULT_STAMP_PREFERENCES = Object.freeze({ enabled: true, style: "post-paris" });
export const DEFAULT_STAMP_PLACEMENT = Object.freeze({ x: .82, y: .7, rotation: -8, style: null });
export const stampStyle = (id) => STAMP_STYLES.find((s) => s.id === id) || STAMP_STYLES[0];

export function validStampDay(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(0); date.setUTCFullYear(y, m - 1, d);
  return y >= 1 && y <= 9999 && date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
export function validateStampPreferences(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || typeof value.enabled !== "boolean" || !STAMP_IDS.has(value.style)) throw new Error("Choose a valid completion stamp and visibility setting");
  return { enabled: value.enabled, style: value.style };
}
export function normalizeStampPreferences(value) {
  try { return validateStampPreferences(value); } catch { return { ...DEFAULT_STAMP_PREFERENCES }; }
}
export function validateStampPlacement(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid stamp placement");
  for (const key of ["x", "y"]) if (typeof value[key] !== "number" || !Number.isFinite(value[key]) || value[key] < 0 || value[key] > 1) throw new Error("Stamp coordinates must stay within the day");
  if (typeof value.rotation !== "number" || !Number.isFinite(value.rotation) || value.rotation < -18 || value.rotation > 18) throw new Error("Stamp rotation must be between -18 and 18 degrees");
  if (value.style !== null && !STAMP_IDS.has(value.style)) throw new Error("Choose a valid stamp style");
  return { x: Math.round(value.x * 10000) / 10000, y: Math.round(value.y * 10000) / 10000, rotation: Math.round(value.rotation), style: value.style };
}
export function completedCaptionDays(posts) {
  const days = new Map();
  for (const post of posts) {
    if (!post.scheduled_at) continue;
    const date = new Date(post.scheduled_at);
    if (!Number.isFinite(date.getTime())) continue;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    if (!days.has(key)) days.set(key, { total: 0, posted: 0 });
    const day = days.get(key); day.total++;
    if (post.status === "posted") day.posted++;
  }
  return new Map([...days].filter(([, d]) => d.total > 0 && d.total === d.posted));
}
// Bound the entire rotated stamp, not only its unrotated corners.
export function stampBounds(width, height, bayWidth, bayHeight, rotation) {
  const angle = rotation * Math.PI / 180;
  const rw = Math.abs(width * Math.cos(angle)) + Math.abs(height * Math.sin(angle));
  const rh = Math.abs(height * Math.cos(angle)) + Math.abs(width * Math.sin(angle));
  return { left: (rw - width) / 2, top: (rh - height) / 2, travelX: Math.max(0, bayWidth - rw), travelY: Math.max(0, bayHeight - rh) };
}
