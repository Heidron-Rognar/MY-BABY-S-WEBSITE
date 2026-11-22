// Original botanical engravings with layered, debossed wax relief. All coordinates local.
const leaf = '<path d="M0 0Q-15-18-7-27Q8-22 0 0Zm0 0  -5-21"/>';
function sprig(x, y, rotation, scale = 1) {
  return `<g transform="translate(${x} ${y}) rotate(${rotation}) scale(${scale})"><path d="M0 0Q-4-27 0-58"/>${[-15, -29, -43].map((v, i) => `<g transform="translate(0 ${v}) rotate(${i % 2 ? 48 : -48}) scale(.52)">${leaf}</g>`).join('')}</g>`;
}
function flower(x, y, radius = 12, petals = 8) {
  return `<g transform="translate(${x} ${y})">${Array.from({ length: petals }, (_, i) => `<ellipse cx="0" cy="-${radius * .62}" rx="${radius * .3}" ry="${radius * .55}" transform="rotate(${i * 360 / petals})"/>`).join('')}<circle r="${radius * .26}"/><circle r="${radius * .1}"/></g>`;
}
const botanicals = `${sprig(89, 151, -32, .95)}${sprig(110, 151, 28, 1.05)}<path d="M98 150Q80 110 73 73m26 78Q103 98 112 64m-12 87Q122 110 133 91M96 149Q61 113 53 98"/>${flower(73, 70, 13)}${flower(112, 61, 11, 6)}${flower(135, 88, 9, 7)}${flower(52, 96, 7, 5)}${sprig(98, 149, -6, .7)}`;
const motifs = {
  laurel: `${botanicals}<path d="M82 151q18 7 37-1M88 154l-4 7m24-7 7 6"/>`,
  rose: `<path d="M100 153V97m0 36q-24-27-39-14 8 20 39 14m0 9q28-31 42-19-12 20-42 19m-32-20 24 8m44-3-27 11"/><path d="M100 55Q79 39 73 64q-28-4-23 21-13 19 12 32 5 23 29 10 23 13 36-9 25-4 15-28 12-22-13-27-6-25-29-8ZM100 62Q77 57 70 81q-3 25 22 33 30 12 39-16 7-25-20-28-22-11-29 12-4 20 18 21 20-2 16-18-4-13-16-6-11 7 1 14M56 82q12-7 18 0m55-16-9 12M76 68q6 4 9 12m25-21-4 12M56 96q10-3 17 6m40 12 12 5m-42-1 4-8M93 63q3 6 0 12m29 9q-5 5-3 13M68 112l12-9"/>${sprig(74, 152, -25, .65)}${sprig(124, 152, 24, .6)}`,
  sun: `<circle cx="100" cy="91" r="26"/><circle cx="100" cy="91" r="22"/>${Array.from({length: 16}, (_, i) => `<path transform="rotate(${i * 22.5} 100 91)" d="M100 58q-4-7 0-15q4 8 0 15Z"/>`).join('')}<path d="M88 89q4-4 8 0m8 0q4-4 8 0m-17 12q5 4 10 0M100 89l-2 7h4"/>${sprig(82, 154, -45, .65)}${sprig(118, 154, 45, .65)}`,
  moon: `<path d="M111 48a45 45 0 1 0 32 67 39 39 0 0 1-32-67Z"/><path d="M73 73q-14 25 4 43m-5-33 6 2m-9 7 5 1m1 10 6-2M127 58v15m-7-7h14m8 19v10m-5-5h10M115 107v12m-6-6h12"/>${sprig(91, 153, -31, .7)}${flower(115, 140, 8, 5)}`,
  shell: `<path d="m80 133-12 4 2-16q-34-23-20-45 8-10 19-4-4-25 16-23 14-23 29 0 22-3 17 23 12-6 20 4 14 23-20 45l2 16-13-4-11 10H91Z"/><path d="M100 127V57m-9 68L80 60m2 60L63 80m48 45 10-65m-1 60 19-40M78 133q22-13 44 0M76 100l6 8m44-8-6 8m-35 19q15-8 30 0"/><path d="M62 149q38 12 77-1"/><circle cx="62" cy="139" r="2"/><circle cx="142" cy="133" r="3"/>${sprig(55, 149, -23, .55)}`,
  bee: `<ellipse cx="100" cy="106" rx="15" ry="28"/><path d="M87 92h26m-28 11h30m-29 11h28m-24 10h20M94 76l-8-13m20 13 8-13M100 134v6"/><circle cx="100" cy="78" r="9"/><path d="M85 96Q48 54 49 85q2 27 36 22m30-11q37-42 36-11-2 27-36 22M58 80l25 19m-21-8 19 10m61-21-25 19m21-8-19 10"/>${sprig(68, 153, -31, .72)}${sprig(132, 153, 31, .72)}${flower(72, 135, 6, 5)}${flower(128, 135, 6, 5)}`,
  butterfly: `<path d="M99 86Q66 41 50 65q-16 25 28 40-43 5-26 28 21 24 47-14m2-33q33-45 49-21 16 25-28 40 43 5 26 28-21 24-47-14M100 85v46m-4-48-9-17m17 17 9-17M80 81Q63 64 59 78q-1 12 22 18m38-15q17-17 21-3 1 12-22 18M82 115q-20-6-19 7t21-1m34-6q20-6 19 7t-21-1M95 100 69 75m26 31-30-4m40-2 26-25m-26 31 30-4M66 72l-5 5m7 10-6 2m72-17 5 5m-7 10 6 2m-68 41 2-4m58 4-2-4"/>${sprig(84, 157, -35, .5)}${sprig(116, 157, 35, .5)}`,
  heart: `<path d="M100 132 68 101Q44 74 67 61q22-12 33 11 12-23 34-11 23 13-1 40Z"/><path d="M74 72q-11 2-10 14m9 16 25 23"/>${sprig(80, 153, -33, .85)}${sprig(120, 153, 33, .85)}${flower(100, 148, 8, 6)}`,
  compass: `<circle cx="100" cy="100" r="43"/><circle cx="100" cy="100" r="37"/><path d="m100 63 9 28 28 9-28 9-9 28-9-28-28-9 28-9Z"/><path d="m100 69-3 28-28 3m31 31 3-28 28-3M100 51v-9m0 107v9M51 100h-9m107 0h9M67 67l-7-7m73 73 7 7m-7-73 7-7m-73 73-7 7"/><circle cx="100" cy="100" r="4"/>`,
  monogram: `<text x="100" y="119" text-anchor="middle" font-family="Georgia,serif" font-size="48" font-style="italic" stroke-width=".6" fill="currentColor">CS</text>${sprig(78, 152, -29, 1.25)}${sprig(122, 152, 29, 1.25)}${flower(100, 54, 9, 6)}<path d="M81 149q19 12 38 0"/>`,
};
export function waxSvg(style) {
  const edge = 'M99 13C113 9 127 20 138 19S160 26 165 39s18 20 17 33 11 24 5 37-3 27-14 35-12 27-28 30-23 15-38 11-28 6-40-3-28-7-35-21S14 141 17 126 8 102 14 88s-1-29 11-38 13-25 29-27S82 10 99 13Z';
  const engraving = motifs[style.art];
  const rimMarks = Array.from({length: 28}, (_, i) => `<path transform="rotate(${i * 360 / 28} 100 100)" d="M100 29l1-6"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs>
    <radialGradient id="wax-body" cx="32%" cy="22%" r="83%"><stop stop-color="#fff" stop-opacity=".42"/><stop offset=".27" stop-color="${style.color}"/><stop offset=".7" stop-color="${style.color}"/><stop offset="1" stop-color="#160e12" stop-opacity=".82"/></radialGradient>
    <linearGradient id="wax-well" x1="0" y1="0" x2=".6" y2="1"><stop stop-color="#1b1017" stop-opacity=".28"/><stop offset=".5" stop-color="${style.color}"/><stop offset="1" stop-color="#fff5da" stop-opacity=".24"/></linearGradient>
    <filter id="wax-grain"><feTurbulence type="fractalNoise" baseFrequency=".38" numOctaves="2" seed="8"/><feColorMatrix type="saturate" values="0"/><feComposite in2="SourceGraphic" operator="in"/><feBlend in="SourceGraphic" mode="soft-light"/></filter><g id="engraving">${engraving}</g>
  </defs><path d="${edge}" transform="translate(0 2)" fill="#25151c" opacity=".32"/><path d="${edge}" fill="${style.color}"/><path d="${edge}" fill="url(#wax-body)"/>
  <g fill="none" stroke-linecap="round"><path d="M31 72Q30 38 62 33m70-6q25 4 32 29" stroke="#fff6e4" opacity=".28" stroke-width="2.2"/><path d="M166 133q-12 36-46 38m-79-14-13-19" stroke="#28131e" opacity=".25" stroke-width="3"/>
  <circle cx="100" cy="101" r="72" stroke="#26131c" stroke-opacity=".24" stroke-width="5"/><circle cx="100" cy="99" r="72" stroke="#fff4da" stroke-opacity=".38" stroke-width="1.6"/></g>
  <circle cx="100" cy="100" r="69" fill="${style.color}"/><circle cx="100" cy="100" r="69" fill="url(#wax-well)"/>
  <circle cx="100" cy="100" r="66" fill="none" stroke="#fff5df" stroke-opacity=".22" stroke-width=".8"/>
  <g fill="none" stroke="#fff4dc" opacity=".16" stroke-width="1">${rimMarks}</g>
  <g fill="none" stroke="#fff2d6" color="#fff2d6" opacity=".6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" transform="translate(.9 1.2)"><use href="#engraving"/></g>
  <g fill="none" stroke="#251520" color="#251520" opacity=".58" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><use href="#engraving"/></g>
  <path d="${edge}" fill="${style.color}" opacity=".055" filter="url(#wax-grain)"/>
  <g fill="#fff9e7" opacity=".22"><circle cx="44" cy="57" r="1"/><circle cx="157" cy="125" r="1.1"/><circle cx="78" cy="165" r=".8"/></g></svg>`;
}
