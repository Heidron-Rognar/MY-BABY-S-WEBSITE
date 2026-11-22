// Fictional soda labels and original pictograms. No franchise logos or external assets.
const icons = {
  bicycle: '<circle cx="75" cy="115" r="15"/><circle cx="127" cy="115" r="15"/><path d="m75 115 17-26 17 26H75l12-35m22 35 13-36m-7 0h12m-45 1h13m-3 9h26M61 73h10m64-5h9"/><path d="m104 64 4 8-9 6 14-1"/>',
  atom: '<ellipse cx="100" cy="101" rx="38" ry="14"/><ellipse cx="100" cy="101" rx="38" ry="14" transform="rotate(60 100 101)"/><ellipse cx="100" cy="101" rx="38" ry="14" transform="rotate(120 100 101)"/><circle cx="100" cy="101" r="8" fill="currentColor"/><circle cx="132" cy="94" r="4" fill="currentColor"/><path d="M96 99h1m7 0h1m-9 6q4 3 8 0" stroke="var(--paper)" stroke-width="1.5"/>',
  city: '<path d="M61 125V90h19v35m5 0V76h22v49m6 0V86h26v39M92 76V65m28 21V73m-55 25h10m-10 9h10m15-23h12m-12 10h12m-12 10h12m16-10h13m-13 10h13m-13 10h13M56 131h88"/><path d="m113 58-6 11h8l-3 10 13-15h-9l4-6"/>',
  wolf: '<path d="m74 67 19 15h14l19-15-2 33-9 20-15 13-15-13-9-20Zm2 22 13 7-9 4m44-11-13 7 9 4M91 110l9 6 9-6m-9 6v9M88 94l6 9m18-9-6 9"/><path d="M61 121l13-13m52 0 13 13M62 65l-4 12m80-12 4 12"/>',
  mountain: '<path d="m56 123 29-49 18 27 18-42 26 64ZM77 88l8 7 7-7m21-13 8 9 8-8M90 123l13-22m-42 29h79"/><circle cx="69" cy="68" r="8"/><path d="M99 68v-9m-5 5h10m34 24h8"/>',
  crystal: '<path d="m100 63 22 23-8 35-14 16-14-16-8-35Zm0 0L91 88l9 49 9-49Zm-22 23 13 2m18 0 13-2M65 96l-7 14 11 12 8-13Zm70-13-7 14 11 12 8-13Z"/><path d="M65 71v12m-6-6h12m66 42v10m-5-5h10"/>',
  fern: '<path d="M100 133Q89 100 104 66M98 119q-26 1-31-17 22-4 31 17m-2-19Q74 99 77 82q18 0 19 18m3-16Q83 73 94 62q14 8 5 22m-2 28q4-23 24-25 3 19-24 25m4-32q2-18 17-19 4 17-17 19M61 128q8 4 15 0m53-18v12m-6-6h12"/>',
  raven: '<path d="M84 121q-10-10-5-26 6-16 19-12 0-17 15-17 13 0 13 13l12 8-16 3q-4 26-23 30l-18 16 3-15Zm2-16q17 6 25-14m-9 30 5 12m-12-12 1 12m-6 0h23"/><circle cx="116" cy="77" r="2" fill="currentColor"/><path d="M68 77a11 11 0 0 1 1-20 13 13 0 1 0 6 24"/>',
  ship: '<path d="M59 113h82l-13 17H74Zm41 0V66m-4 8q-30 10-27 31h27Zm9 2q22 9 24 29h-24ZM60 138q10-7 20 0t20 0 20 0 20 0M102 66l18 4-18 7"/><circle cx="77" cy="122" r="2"/><circle cx="123" cy="122" r="2"/><path d="M65 66v12m-6-6h12m72 17h8"/>',
  planet: '<circle cx="100" cy="99" r="25"/><ellipse cx="100" cy="99" rx="43" ry="11" transform="rotate(-24 100 99)"/><path d="M91 84q-8 8-6 15m10 10q7 4 13 0M65 70v12m-6-6h12m75 38v10m-5-5h10"/><circle cx="133" cy="66" r="4"/><circle cx="67" cy="126" r="2"/>',
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
const palettes = [null, ['#647c61', '#fff0c5'], ['#a95869', '#fff0d1'], ['#e6d5a8', '#604a43'], ['#4e6a87', '#fff1cf']];
function capOutline() {
  const points = [];
  for (let i = 0; i < 84; i++) {
    const a = i * Math.PI / 42 - Math.PI / 2, r = i % 4 === 0 || i % 4 === 3 ? 96 : 90;
    points.push(`${(100 + Math.cos(a) * r).toFixed(2)},${(100 + Math.sin(a) * r).toFixed(2)}`);
  }
  return points.join(' ');
}
const badges = [
  '<path d="M94 150q-6-12 0-14 5-3 7 1 9-5 9 4 0 8-9 12Zm7-13 4-6"/>',
  '<path d="M91 148q0-13 10-14 13 0 11 10-1 10-12 10Zm5-3 10-5m-8 10 9-5"/>',
  '<path d="m90 147 11-14 11 14-11 7Z"/><path d="M96 146h10m-5-7v11"/>',
  '<path d="M93 152q-11-17 7-19 17 2 7 19Zm7-19v19m-7-15 7 7 7-7"/>',
  '<path d="M94 141q-10-9 0-12l7 9q9-14 14-6 4 6-8 10 10 7 3 13-7 5-10-7-8 11-13 4-3-6 7-11Z"/>',
];
export function bottleCapSvg(style) {
  const [color, paper] = palettes[style.variant] || [style.color, style.ink];
  const pleats = Array.from({ length: 21 }, (_, i) => `<path transform="rotate(${i * 360 / 21} 100 100)" d="m95 9 1 11m8-11-1 11"/>`).join('');
  const dots = Array.from({ length: 24 }, (_, i) => { const a = i * Math.PI / 12; return `<circle cx="${(100 + 72 * Math.cos(a)).toFixed(2)}" cy="${(100 + 72 * Math.sin(a)).toFixed(2)}" r=".8"/>`; }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" style="--paper:${paper}"><defs>
  <linearGradient id="metal" x2=".8" y2="1"><stop stop-color="#fff9df"/><stop offset=".28" stop-color="#a7a295"/><stop offset=".5" stop-color="#eee4cb"/><stop offset="1" stop-color="#77766e"/></linearGradient>
  <radialGradient id="enamel" cx="32%" cy="24%" r="80%"><stop stop-color="#fff" stop-opacity=".18"/><stop offset=".65" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#291f27" stop-opacity=".24"/></radialGradient>
  <path id="cap-top" d="M36 108a64 64 0 0 1 128 0"/><path id="cap-bottom" d="M49 150a65 65 0 0 0 102 0"/>
  </defs><polygon points="${capOutline()}" fill="url(#metal)" stroke="#5e594c" stroke-width=".6"/>
  <g fill="none" stroke="#554c42" stroke-width="1.2" opacity=".5">${pleats}</g>
  <circle cx="100" cy="100" r="82" fill="${color}" stroke="${paper}" stroke-width="1.5"/>
  <circle cx="100" cy="100" r="77" fill="none" stroke="${paper}" stroke-width="1"/>
  <g fill="${paper}" opacity=".7">${dots}</g>
  <circle cx="100" cy="100" r="55" fill="${paper}"/><circle cx="100" cy="100" r="51" fill="none" stroke="${color}" stroke-width=".8"/>
  <text fill="${paper}" font-family="Georgia,serif" font-size="11" font-weight="bold" letter-spacing="1.1"><textPath href="#cap-top" startOffset="50%" text-anchor="middle">${esc(style.label)}</textPath></text>
  <g fill="none" color="${color}" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" transform="translate(10 4) scale(.9)">${icons[style.art]}</g>
  <path d="M31 130q69-13 138 0v26q-69-10-138 0Z" fill="${color}" stroke="${paper}" stroke-width="1"/>
  <text x="100" y="145" fill="${paper}" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-weight="bold" font-size="${style.title.length > 16 ? 10 : 12}">${esc(style.title)}</text>
  <g transform="translate(45 78) scale(.55)" fill="none" stroke="${paper}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round">${badges[style.variant]}</g>
  <text fill="${paper}" font-family="Georgia,serif" font-size="6.5" letter-spacing=".8"><textPath href="#cap-bottom" startOffset="50%" text-anchor="middle">BOTTLED JOY • 250 ML</textPath></text>
  <g fill="${paper}" font-family="Georgia,serif" font-size="9" text-anchor="middle"><text x="37" y="105">✦</text><text x="163" y="105">✦</text></g>
  <circle cx="100" cy="100" r="82" fill="url(#enamel)"/>
  <g stroke="${paper}" stroke-width=".7" opacity=".3"><path d="m49 43 6-3m89 119 5-3M34 113l3-2m121-50 3 2m-87 110 9 1m45-143 4 2"/></g></svg>`;
}
