// One-of-a-kind rare stamp artwork + pixel Tubby cat.
// Original vector illustrations; trusted local SVG, never user-provided markup.
const esc = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);

export function rareStampSvg(style, day = "") {
  const color = style?.color || "#7a3ea8";
  let holes = "";
  for (let x = 16; x < 180; x += 16) holes += `<circle cx="${x}" cy="6" r="4"/><circle cx="${x}" cy="204" r="4"/>`;
  for (let y = 20; y < 204; y += 16) holes += `<circle cx="6" cy="${y}" r="4"/><circle cx="174" cy="${y}" r="4"/>`;
  // House with balloons (top-right of the scene), couple selfie, dog, boy scout.
  const balloons = `
    <g stroke="#5b3a2a" stroke-width="1">
      <ellipse cx="122" cy="52" rx="7" ry="8" fill="#e2557c"/><ellipse cx="136" cy="47" rx="7" ry="8" fill="#f5c400"/>
      <ellipse cx="149" cy="54" rx="7" ry="8" fill="#2fb3a3"/><ellipse cx="130" cy="62" rx="6" ry="7" fill="#ff9d6e"/>
      <ellipse cx="144" cy="66" rx="6" ry="7" fill="#9b7bff"/>
    </g>
    <g fill="none" stroke="#5b3a2a" stroke-width=".8">
      <path d="M122 60q-2 10 6 18M136 55q0 12-2 22M149 62q-3 8-6 15M130 69q2 6 4 10M144 73q-2 4-3 7"/>
    </g>
    <g stroke="#5b3a2a" stroke-width="1.2" stroke-linejoin="round">
      <rect x="118" y="82" width="34" height="26" fill="#f7d6a0"/>
      <path d="M114 82l21-13 21 13z" fill="#c94f4f"/>
      <rect x="131" y="92" width="8" height="16" fill="#8a5a3b"/>
      <rect x="121" y="88" width="7" height="7" fill="#bfe8ff"/>
      <rect x="143" y="88" width="7" height="7" fill="#bfe8ff"/>
      <rect x="146" y="70" width="5" height="10" fill="#a9744f"/>
    </g>`;
  const couple = `
    <g stroke="#3a2a24" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M46 132q16-20 32 0l0 14-32 0z" fill="#4a7fb5"/>
      <path d="M70 132q16-20 32 0l0 14-32 0z" fill="#e2557c"/>
      <circle cx="62" cy="102" r="11" fill="#ffd9b3"/>
      <path d="M51 100q2-13 11-13t11 13q-5-4-11-4t-11 4z" fill="#4a3428"/>
      <circle cx="58" cy="102" r="3.4" fill="none"/><circle cx="67" cy="102" r="3.4" fill="none"/><path d="M61 102h2"/>
      <path d="M58 109q4 3 8 0" fill="none"/>
      <circle cx="86" cy="100" r="11" fill="#ffe0c2"/>
      <path d="M75 99q0-13 11-13t11 13q-2 10 1 16-3 2-5-1-1-8-7-8t-7 8q-2 3-5 1 3-6 1-16z" fill="#6b3f2a"/>
      <circle cx="82" cy="100" r="1.4" fill="#3a2a24" stroke="none"/><circle cx="90" cy="100" r="1.4" fill="#3a2a24" stroke="none"/>
      <path d="M82 107q4 3 8 0" fill="none"/>
      <rect x="73" y="80" width="13" height="19" rx="2" fill="#22252a"/>
      <rect x="75" y="82" width="9" height="13" rx="1" fill="#bfe8ff"/>
      <path d="M86 112q6-8 2-14" fill="none"/>
    </g>
    <path d="M74 88c-2-3-7-1-5 2 1 2 5 4 5 4s4-2 5-4c2-3-3-5-5-2z" fill="#ff6ec7" stroke="#c94f8a" stroke-width=".7"/>`;
  const dogAndScout = `
    <g stroke="#3a2a24" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round">
      <ellipse cx="110" cy="128" rx="10" ry="7" fill="#d9a05b"/>
      <circle cx="102" cy="120" r="7" fill="#e8b878"/>
      <path d="M96 116q-4 1-3 7 1 4 5 3zM107 115q4 0 4 6-1 4-5 3z" fill="#8a5a3b"/>
      <circle cx="100" cy="120" r="1.2" fill="#3a2a24" stroke="none"/>
      <path d="M97 124q3 2 6 0" fill="none"/>
      <path d="M103 126h5" stroke="#e2557c" stroke-width="2.4"/>
      <path d="M119 124q5-3 7 1" fill="none"/>
      <circle cx="138" cy="108" r="7" fill="#ffd9b3"/>
      <path d="M130 106q8-3 16 0l-2 3q-6-2-12 0z" fill="#8a6d3b"/>
      <path d="M132 115l6 8 6-8z" fill="#e2557c"/>
      <path d="M130 122h16l2 12-20 0z" fill="#d9c27a"/>
      <path d="M132 124l10 8" stroke="#8a5a3b" stroke-width="2.6"/>
      <circle cx="136" cy="127" r="1.4" fill="#e2557c" stroke="none"/><circle cx="140" cy="130" r="1.4" fill="#2fb3a3" stroke="none"/>
      <path d="M133 134v8M143 134v8" stroke="#5b6b4a" stroke-width="3"/>
    </g>`;
  const sparkles = `
    <g fill="#ffd166" stroke="#c98a12" stroke-width=".6">
      <path d="M38 58l1.6 4 4 1.6-4 1.6L38 69l-1.6-3.8-4-1.6 4-1.6z"/>
      <path d="M154 92l1.3 3.2 3.2 1.3-3.2 1.3L154 101l-1.3-3.2-3.2-1.3 3.2-1.3z"/>
      <path d="M48 118l1.2 3 3 1.2-3 1.2L48 126l-1.2-2.6-3-1.2 3-1.2z"/>
    </g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 210"><defs>
    <mask id="rare-paper"><rect x="6" y="6" width="168" height="198" fill="white"/><g fill="black">${holes}</g></mask>
    <linearGradient id="rare-sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#bfe8ff"/><stop offset=".62" stop-color="#ffe9c9"/><stop offset="1" stop-color="#ffd9e8"/></linearGradient>
    <clipPath id="rare-scene"><rect x="21" y="38" width="138" height="112"/></clipPath>
  </defs><g mask="url(#rare-paper)">
    <rect x="6" y="6" width="168" height="198" fill="#fff8ec"/>
    <rect x="14" y="14" width="152" height="182" fill="none" stroke="${color}" stroke-width="2"/>
    <rect x="21" y="38" width="138" height="112" fill="url(#rare-sky)" stroke="${color}" stroke-opacity=".45"/>
    <g clip-path="url(#rare-scene)">
      <circle cx="42" cy="54" r="10" fill="#ffd166" stroke="#c98a12" stroke-width=".8"/>
      <g fill="#ffffff" opacity=".85"><ellipse cx="62" cy="50" rx="12" ry="5"/><ellipse cx="112" cy="46" rx="10" ry="4"/><ellipse cx="52" cy="66" rx="9" ry="4"/></g>
      ${balloons}
      <path d="M21 132q69-16 138 0l0 18-138 0z" fill="#8ec98a"/>
      <path d="M21 140q69-10 138 0l0 10-138 0z" fill="#6db56d"/>
      ${couple}${dogAndScout}${sparkles}
    </g>
    <text x="90" y="29" text-anchor="middle" font-family="Georgia,serif" font-size="10" letter-spacing="2" fill="${color}">HENLO MY LOVE</text>
    <text x="90" y="167" text-anchor="middle" font-family="Georgia,serif" font-weight="bold" font-size="13" letter-spacing=".7" fill="${color}">UP, UP &amp; AWAY</text>
    <text x="90" y="183" text-anchor="middle" font-family="Georgia,serif" font-size="8" letter-spacing="1.3" fill="${color}">ONE OF A KIND · RARE</text>
    <g transform="rotate(-16 132 58)" fill="none" stroke="#2b4acb" stroke-opacity=".88" stroke-width="1.3">
      <circle cx="132" cy="58" r="26"/><circle cx="132" cy="58" r="21.5"/>
      <path d="M104 68q14-7 28 0t28 0M103 74q14-7 29 0t29 0" stroke-width="1"/>
      <text x="132" y="51" text-anchor="middle" font-family="Georgia,serif" font-size="5.5" letter-spacing="1" fill="#2b4acb" stroke="none">HENLO MY LOVE</text>
      <text x="132" y="61" text-anchor="middle" font-family="Georgia,serif" font-weight="bold" font-size="7.5" fill="#2b4acb" stroke="none">22 NOV 2026</text>
      <text x="132" y="69" text-anchor="middle" font-family="Georgia,serif" font-size="5" letter-spacing="1" fill="#2b4acb" stroke="none">ADMITTED WITH LOVE</text>
    </g>
    <text x="90" y="196" text-anchor="middle" font-family="Georgia,serif" font-size="6" letter-spacing="1.4" fill="${color}">13 POSTED · UNLOCKED WITH LOVE</text>
  </g></svg>`;
}

// Pixel Tubby cat: 18x16 pixel grid, generated as crisp rects (no external image).
const TUBBY_MAP = [
  "..................",
  "....OO......OO....",
  "...OOOO....OOOO...",
  "...OOOOOOOOOOOO...",
  "..OOOOOOOOOOOOOO..",
  "..OOOKOOOOOOKOOO..",
  "..OOOOOOOOOOOOOO..",
  "..OOOOOOOPPOOOOOO..",
  "..OCCCCCCCCCCCCO..",
  ".OOOOOOOOOOOOOOOO.",
  ".OOOODDOOOOODDOOOO",
  ".OOOOOOOOOOOOOOOO.",
  "..OOOOOOOOOOOOOO..",
  "...OOO..OOO..OOO..",
  "...OOO..OOO..OOO..",
  "..................",
];
const TUBBY_COLORS = { O: "#f2a65a", D: "#c97a2e", C: "#ffe8c2", K: "#33241f", P: "#ff9db1" };

export function tubbyCatSvg() {
  let rects = "";
  TUBBY_MAP.forEach((rawRow, y) => {
    const row = rawRow.padEnd(18, ".").slice(0, 18);
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === ".") continue;
      const isLeg = y >= 13;
      const legClass = isLeg ? (x < 9 ? ' class="tubby-leg tubby-leg-a"' : ' class="tubby-leg tubby-leg-b"') : "";
      rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${TUBBY_COLORS[ch] || "#f2a65a"}"${legClass}/>`;
    }
  });
  // Blush + tail tip + whiskers (kept inside the pixel grid language).
  rects += `<rect x="3" y="7" width="1" height="1" fill="#ff9db1"/><rect x="14" y="7" width="1" height="1" fill="#ff9db1"/>`;
  rects += `<g class="tubby-tail"><rect x="17" y="9" width="1" height="1" fill="#c97a2e"/><rect x="17" y="10" width="1" height="1" fill="#f2a65a"/></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 16" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${rects}</svg>`;
}
