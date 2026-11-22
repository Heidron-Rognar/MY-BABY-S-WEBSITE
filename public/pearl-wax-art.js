// Sculpted pale wax, raised monochrome reliefs. Original storybook pictograms.
const stars = '<path d="M66 58v10m-5-5h10m64 65v10m-5-5h10M132 55v7m-3-3h6"/>';
function bloom(x, y, r = 9) {
  return `<g transform="translate(${x} ${y})">${Array.from({ length: 6 }, (_, i) => `<ellipse cx="0" cy="-${r * .6}" rx="${r * .32}" ry="${r * .6}" transform="rotate(${i * 60})"/>`).join('')}<circle r="${r * .25}"/></g>`;
}
function sprig(x, y, a = 0, scale = 1) {
  return `<g transform="translate(${x} ${y}) rotate(${a}) scale(${scale})"><path d="M0 0Q-5-25 0-55"/>${[-12, -25, -38].map((v, i) => `<path transform="translate(0 ${v}) scale(${i % 2 ? -1 : 1} 1)" d="M0 0q-20-2-15-15Q1-15 0 0Zm0 0-10-10"/>`).join('')}</g>`;
}
const rose = '<path d="M100 72q-13-15-23 0-19-1-17 18-12 13 4 24 0 19 19 16 16 13 27-2 21 1 20-20 12-17-6-26-6-18-24-10Zm-18 11q17-14 28 2 14 17-4 27-18 10-27-8-9-16 3-21Zm9 5q15-4 12 10-14 10-16-3"/>';
const motifs = {
  owl: `<path d="M72 82 69 60l20 12h22l20-12-3 22q14 35-7 53-21 13-42 0-21-18-7-53Z"/><circle cx="86" cy="90" r="12"/><circle cx="114" cy="90" r="12"/><circle cx="86" cy="90" r="3"/><circle cx="114" cy="90" r="3"/><path d="m96 103 4 7 4-7M76 108l10 17m38-17-10 17m-22-6 8 7 8-7M84 140v7m8-7v7m16-7v7m8-7v7M61 151h78"/>`,
  'winged-key': '<circle cx="101" cy="87" r="12"/><circle cx="101" cy="87" r="5"/><path d="M101 99v44m0-7h14v-7h-7M88 84Q57 53 51 73q-3 20 32 26m-23-22 23 12m31-5q31-31 37-11 3 20-32 26m23-22-23 12"/>',
  castle: `<path d="M62 142V91h22v51m32 0V91h22v51M58 91l15-28 15 28m24 0 15-28 15 28M84 142V80h32v62M79 80l21-30 21 30M100 50V39l14 5-14 5M94 142v-21q6-11 12 0v21M68 107h10m44 0h10M96 94h8m-8 13h8M53 149h94"/>${stars}`,
  wand: `<path d="m66 143 61-69 7 7-61 69Zm15-18 7 6m-1-13 8 6M129 58V44m-7 7h14m-30 8-8-8m44 44 11 2m-46-15-12 2m44-18 11-7M69 85v14m-7-7h14"/>`,
  glasses: '<circle cx="77" cy="106" r="23"/><circle cx="125" cy="106" r="23"/><path d="M100 102q1-4 3 0M54 103l-9-4m103 4 9-4M108 48 91 68h16L93 85M64 98q3-8 10-8m39 8q3-8 10-8M75 144q25 7 50 0"/>',
  'winged-ball': '<circle cx="100" cy="109" r="20"/><path d="M83 99Q68 64 47 67q2 28 34 43m-25-34 21 23m-17-8 19 12m39-4q15-35 36-32-2 28-34 43m25-34-21 23m17-8-19 12M90 98q10-8 20 0m-25 8h30m-25 10q10 8 20 0"/>',
  potion: `<path d="M87 54h26v12H87Zm4 12v20q-30 23-26 47 35 19 70 0 4-24-26-47V66M68 116q32-10 64 0M86 132h28M95 99v12m-6-6h12"/><circle cx="120" cy="68" r="3"/><circle cx="77" cy="75" r="4"/>${stars}`,
  hat: '<path d="M78 113q10-21 13-47l22-13-2 31 17 36M55 126q44-27 90 3-43 25-90-3ZM83 107q19-9 36 3m-23-17 8-3m-7 16 15 2M75 131q28-6 53 1"/>',
  stag: `<path d="M87 100q13-13 26 0l-4 25-9 12-9-12Zm5-6L78 73m30 21 14-21M78 73 64 67V53m14 20-1-21m-8 17-13 7m66-3 14-6V53m-14 20 1-21m8 17 13 7M93 111h1m12 0h1m-10 14h6M100 137v13"/>${sprig(80, 151, -28, .6)}${sprig(120, 151, 28, .6)}`,
  phoenix: `<path d="M100 87q-6-22 8-25l9 8-13 4M98 86Q74 53 57 63q5 30 35 44m-32-34 29 21m-21-7 21 15m13-16q24-33 41-23-5 30-35 44m32-34-29 21m21-7-21 15M92 101q-9 18 8 29 17-11 8-29M96 126q-23 18-19 29m23-25v26m4-30q23 18 19 29"/>`,
  trunk: '<rect x="55" y="83" width="90" height="55" rx="8"/><path d="M55 102h90M75 83v55m50-55v55M89 83v-9q11-8 22 0v9m-19 19v13h16v-13M61 88h8m62 0h8M60 132h9m62 0h8"/><path d="m67 68 9-13 13 9-9 13Z"/>',
  train: '<path d="M65 127V84h54v43Zm2-43V66h35v18m-26-18v18m13-18v18m30 43h22V98h-22m11 0V81h9v17M60 133h88M58 143h93M77 137v10m19-10v10m20-10v10m20-10v10M80 102h22m-22 9h22"/><circle cx="77" cy="127" r="9"/><circle cx="111" cy="127" r="9"/><path d="M132 72q-18-7-3-15-15-4-18 2"/>',
  candles: `${[[-25, 18], [0, -3], [25, 12]].map(([x, y]) => `<g transform="translate(${x} ${y})"><path d="M92 88h16v44H92Zm0 9q8-7 8 4v9m0-30q-14-12 0-26 14 14 0 26Z"/></g>`).join('')}${stars}`,
  book: `<path d="M100 86Q77 72 55 81v54q23-9 45 5 22-14 45-5V81q-22-9-45 5Zm0 0v54M65 96q12-3 25 3m-25 8q12-3 25 3m-25 8q12-3 25 3m20-22q13-6 25-3m-25 14q13-6 25-3m-25 14q13-6 25-3"/>${stars}`,
  quill: '<path d="M72 144q17-48 54-83-30-6-45 15-15 20-9 45m11-20 4-20m-6 30 24-9M73 133h-9v11h28v-11H73m-4 11v10h28v-10M85 111l35-42m-26 20h11"/>',
  mandrake: `<path d="M76 113h48l-6 34H82Zm-3-9h54v9H73ZM94 103q-20-12-9-28h29q12 16-8 28M91 87h1m16 0h1m-11 9q4-4 8 0M99 75q-24-13-17-30 22 1 17 30Zm4 0q-1-29 24-28 6 17-24 28Z"/>`,
  dragon: '<path d="M91 88q-6-19 8-27l17 10-12 7 4 14q18 7 16 25-2 15-22 16-25 0-30-20-4 25-18 20 10-3 8-19 2-19 18-18M91 91 69 66l-4 31 17 10m26-14 23-23 5 31-15 9M86 125l-4 17h13m18-14 6 14h10M103 68h1m14 13 12 2"/>',
  broom: `<path d="m68 139 65-67M75 132l-20-3-11 26 26-12 5-11Zm-7 4-17 13m10-14-6 10m10-7-3 5M132 50a15 15 0 1 0 19 20 18 18 0 0 1-19-20Z"/>${stars}`,
  swan: `${rose}<path d="M65 122q-22-15-10-29 10-12 17-3l7 5-12 3q-18 19 8 24m-14 1q25-13 48 3-5 21-33 14-12-4-15-17Zm18 2 18 8M51 148q24-7 49 0t49 0"/>`,
  cauldron: `<path d="M65 91h70l-6 39q-29 22-58 0Zm-4-9h78v9H61Zm13 53-3 12m55-12 3 12M65 100q-21-2-11 17m81-17q21-2 11 17M82 69q-8-7 0-14m18 18q8-11-1-21m21 17q-7-8 2-16"/>${stars}`,
  hourglass: '<path d="M78 63h44m-44 74h44M82 66q-2 26 18 34-20 8-18 34m36-68q2 26-18 34 20 8 18 34M88 78h24l-12 17Zm-2 52 14-17 14 17ZM72 58h56v7H72Zm0 78h56v7H72Z"/><circle cx="100" cy="100" r="52"/>',
  lion: `<path d="M82 71q18-15 36 0l15 9-1 28-15 25H83l-15-25-1-28Zm-1 14q19-15 38 0v21l-19 20-19-20Zm4 5h7m16 0h7m-19 13h8l-4 6Zm4 6v7m-9-1q9 7 18 0M79 72l5 12m37-12-5 12"/>${sprig(75, 154, -28, .6)}${sprig(125, 154, 28, .6)}`,
  serpent: `<path d="M84 127q-29-17-6-28l39-15q20-8 6-20-19-14-34 2l-12-2 5 12 14-2m-7 30q-21 9-3 18l30 5q22 7 1 17-16 6-30 0"/><circle cx="96" cy="65" r="1.5"/>${sprig(135, 143, 22, .8)}`,
  badger: `<path d="M66 110q-9-30 18-34l30 2q27 2 21 25l-12 24H79Zm13-23 9 30m32-30-9 30M89 78l-3-13-10 7m35 7 3-14 10 7M94 116h12l-6 7Zm-19 10-4 12m54-12 4 12"/>${bloom(65, 140, 7)}${bloom(138, 131, 6)}`,
  eagle: `<path d="M95 85q3-19 15-15l10 8-15 2-2 13M95 90Q74 63 48 75l35 37m24-22q21-27 47-15l-35 37M61 82l26 18m-14-2 17 10m49-26-26 18m14-2-17 10M88 106l12 23 12-23M92 123l-5 18 13-7 13 7-5-18"/>${stars}`,
  bicycle: `<circle cx="69" cy="119" r="21"/><circle cx="135" cy="119" r="21"/><path d="m69 119 21-33 22 33H69l15-46m28 46 16-49m-9 0h15m-55 3h14m-3 13h32"/>${bloom(133, 69, 7)}${sprig(114, 80, -35, .42)}`,
  'pressed-flower': `<rect x="67" y="50" width="66" height="102" rx="4"/><path d="M100 137V86m0 34q-23-19-26-7 5 13 26 7m0-12q22-22 25-10-1 15-25 10M77 142h46"/>${bloom(100, 77, 15)}`,
  cipher: '<path d="M59 75h82v62H59ZM59 75l41 31 41-31M64 131l24-25m48 25-24-25M77 58h9m9 0h9m9 0h9M77 65v-13m18 0 9 13m9 0 9-13M89 119h22"/>',
  magnifier: `<circle cx="97" cy="91" r="33"/><circle cx="97" cy="91" r="27"/><path d="m121 116 24 25-8 8-24-25"/><g transform="translate(32 25) scale(.65)">${rose}</g>`,
  chess: '<path d="M73 140h54v9H73Zm6-8 9-42h24l9 42Zm5-49-11-23 17 10 10-23 10 23 17-10-11 23ZM85 102h30m-33 18h36M91 139v-7m18 7v-7"/><circle cx="100" cy="44" r="3"/>',
  lantern: `${sprig(65, 145, -22, .65)}<path d="M86 66q0-22 14-22t14 22M76 76l24-15 24 15Zm7 0v54h34V76M78 130h44v8H78Zm22-48v35m-9-18h18M85 117h30"/>`,
  teacup: `<path d="M64 92h63l-7 34q-25 18-49 0Zm63 5q31-9 17 14-5 8-20 7M57 140q42 14 84 0M79 79q-9-11 0-19m17 19q10-11 0-19m17 19q-9-11 0-19"/>${bloom(94, 111, 8)}`,
  butterfly: `<path d="M99 88Q67 53 54 68q-12 23 28 36-41 3-25 25 18 20 42-12m2-29q32-35 45-20 12 23-28 36 41 3 25 25-18 20-42-12M100 86v47m-4-49-8-15m16 15 8-15M92 97 64 78m28 25-27 1m43-7 28-19m-28 25 27 1M79 118l-9 5m51-5 9 5"/>${sprig(89, 154, -30, .5)}${sprig(112, 154, 30, .5)}`,
  violets: `<path d="M100 147Q71 117 73 91m27 56q8-37 30-55m-30 55V77m-13 56q-24 0-22-17 19-7 22 17m23-4q1-24 20-19 4 18-20 19"/>${bloom(73, 83, 12)}${bloom(101, 66, 13)}${bloom(133, 85, 10)}`,
  watch: '<circle cx="100" cy="105" r="37"/><circle cx="100" cy="105" r="31"/><path d="M100 80v25l14 9m-14-40v4m0 54v4m-31-31h4m54 0h4M91 68V58h18v10m-17-10q-12-17 5-20 18-2 14 13m-1-3 18 7"/>',
  key: `${sprig(76, 151, -27, .8)}<path d="M110 93v52m0-7h19v-9h-10m-9-36q-22-1-18-18 1-13 13-10 5-14 16-6 12 8 1 18 12 14-12 16Z"/><circle cx="109" cy="77" r="5"/>`,
  letter: `<path d="M58 77h84v62H58Zm0 0 42 32 42-32m-84 62 30-31m54 31-30-31M99 78V65m1 11q-26-1-22-15 6-8 22 15 16-23 22-15 4 14-22 15m0 0-14 14m14-14 14 14"/>`,
  notebook: `<rect x="68" y="54" width="67" height="93" rx="5"/><path d="M79 54v93M61 67h14m-14 16h14m-14 16h14m-14 16h14m-14 16h14M91 77h30m-30 11h23m-23 11h30m-30 11h19m-19 11h24"/>`,
  lily: `<path d="M86 150q12-51 15-90m-4 35q-22-29-26-8m29-10q24-27 28-6m-33 45q24-25 28-5M83 138q-27-17-29-55 35 10 29 55Zm11 2q7-31 31-40-1 29-31 40Z"/><path d="M64 87q7-6 14 0v10l-4-2-3 4-3-4-4 2Zm57-16q7-6 14 0v10l-4-2-3 4-3-4-4 2Zm-5 40q7-6 14 0v10l-4-2-3 4-3-4-4 2Z"/>`,
  door: `<path d="M70 147V83q0-35 30-35t30 35v64Zm8 0V84q0-27 22-27t22 27v63M85 88h30v23H85Zm0 31h30v20H85Z"/><circle cx="115" cy="115" r="2"/>${sprig(62, 143, -15, .7)}`,
  sparrow: `<path d="M77 115q-2-23 19-25 0-19 16-18 12 0 15 13l12 6-15 5q-5 25-27 26l-25 14 5-21Zm9-8q13 8 25-7m-15 23-2 13m12-15 2 15M64 142h77"/><circle cx="116" cy="83" r="2"/>${sprig(138, 141, 32, .7)}`,
  bonnet: `<path d="M73 105q0-44 27-44t27 44M56 118q44-29 88 0-42 19-88 0Zm17-12q27-11 54 0M97 119q-16 14-24-1 12-12 24 1Zm5 0q16 14 24-1-12-12-24 1Zm-5 3-8 27m14-27 12 26"/>${bloom(117, 92, 7)}`,
  parasol: `<path d="M55 99q45-79 90 0-15-11-30 0-15-11-30 0-15-11-30 0Zm45-43V44m0 12Q81 77 85 99m15-43q19 21 15 43m-15 0v38q-13 15-17-1M60 105l-3 6m83-6 3 6"/>`,
  rooftops: `<path d="M54 144V99l18-16 19 16v45m0 0V79l20-17 20 17v65m0 0v-34l17-13v47M64 101h14v15H64Zm36-15h15v14h-15Zm0 24h15v14h-15ZM67 83V70h9v13m28-15V54h9v10M49 150h104"/>`,
  'fern-letter': `<path d="M56 98h88v44H56Zm0 0 44 27 44-27M61 137l24-16m54 16-24-16"/>${sprig(98, 102, -20, .9)}${sprig(104, 101, 24, .8)}`,
  daisies: `${bloom(76, 77, 14)}${bloom(124, 91, 14)}${bloom(91, 122, 13)}<path d="M77 92q-1 38 22 58m24-44q-11 27-24 44m-8-15 8 15m-17-40q-22-13-22 3 10 13 22-3m31 19q24-14 24 2-10 13-24-2"/>`,
  locket: `<path d="M91 66q-8-18 9-18t9 18M83 63q-28-9-32 6m66-6q28-9 32 6"/><ellipse cx="100" cy="106" rx="31" ry="41"/><ellipse cx="100" cy="106" rx="26" ry="36"/><path d="M100 124 84 108q-11-15 2-19 10-3 14 7 5-10 15-7 12 4 1 19Z"/>`,
  scissors: `<circle cx="78" cy="124" r="13"/><circle cx="122" cy="124" r="13"/><path d="M86 114 121 56q8 15-4 34l-17 23-17-23q-12-19-4-34l35 58"/><circle cx="100" cy="104" r="3"/><path d="M76 143q24 12 48 0"/>`,
  compass: `<circle cx="100" cy="96" r="36"/><circle cx="100" cy="96" r="30"/><path d="m112 74-7 27-27 17 17-27Zm-12-13v9m0 52v9M65 96h9m52 0h9"/>${bloom(100, 146, 9)}${sprig(80, 154, -38, .6)}${sprig(121, 154, 38, .6)}`,
  ink: `<path d="M66 114h36v31H66Zm4 0v-9h28v9m-19 13h10m-15 10h20M106 135q-1-44 32-76-30-4-38 25-3 18 6 38m2-21 14-11m-16 19 9-26"/>${bloom(65, 89, 7)}`,
};
function edgePath(variant) {
  // Smooth hand-poured variation, not a jagged metal/stamp edge.
  const shapes = [
    'M100 12C147 8 185 49 187 95S152 185 105 187 13 153 13 107 46 13 100 12Z',
    'M99 13C142 7 184 42 186 91S161 181 113 186 22 163 15 117 43 18 99 13Z',
    'M101 13C152 15 185 43 187 99S148 188 96 186 12 150 14 98 48 10 101 13Z',
    'M100 13C145 11 181 45 185 94S157 183 106 187 16 159 13 110 48 8 100 13Z',
    'M99 14C151 8 187 52 185 102S149 186 100 187 10 148 15 96 48 15 99 14Z',
  ];
  return shapes[variant];
}
export function pearlWaxSvg(style) {
  const edge = edgePath(style.rim);
  const motif = motifs[style.art];
  const border = style.rim === 4 ? `<g fill="none" stroke="${style.color}" stroke-width="1.3" filter="url(#raised)">${Array.from({ length: 36 }, (_, i) => `<ellipse cx="100" cy="35" rx="2.2" ry="3.5" transform="rotate(${i * 10} 100 100)"/>`).join('')}</g>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs>
  <radialGradient id="pearl-body" cx="31%" cy="21%" r="84%"><stop stop-color="#fffefa"/><stop offset=".36" stop-color="${style.color}"/><stop offset=".76" stop-color="${style.color}"/><stop offset="1" stop-color="#b7b9b0"/></radialGradient>
  <linearGradient id="pearl-well" x1="0" y1="0" x2=".65" y2="1"><stop stop-color="#a5a69e" stop-opacity=".28"/><stop offset=".4" stop-color="${style.color}"/><stop offset="1" stop-color="#fffdf5"/></linearGradient>
  <linearGradient id="pearl-rim" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#fff"/><stop offset=".46" stop-color="${style.color}"/><stop offset="1" stop-color="#b5b7ad"/></linearGradient>
  <filter id="raised" x="-25%" y="-25%" width="150%" height="155%" color-interpolation-filters="sRGB"><feDropShadow dx="1.1" dy="1.6" stdDeviation=".65" flood-color="#85867f" flood-opacity=".65"/><feDropShadow dx="-.8" dy="-1" stdDeviation=".4" flood-color="#fffefa" flood-opacity="1"/></filter>
  </defs><path d="${edge}" fill="#9c9d95" opacity=".3" transform="translate(0 1.5)"/><path d="${edge}" fill="url(#pearl-body)"/>
  <circle cx="100" cy="100" r="74" fill="url(#pearl-well)" stroke="url(#pearl-rim)" stroke-width="7"/>
  <circle cx="100" cy="100" r="70" fill="none" stroke="#fffef8" stroke-opacity=".55" stroke-width="1"/>
  <path d="M28 101q-1-55 51-71" fill="none" stroke="#fff" stroke-opacity=".65" stroke-width="2.2" stroke-linecap="round"/>
  ${border}<g fill="none" stroke="${style.color}" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round" filter="url(#raised)">${motif}</g>
  <path d="M137 174q23-9 34-32" fill="none" stroke="#fffef8" stroke-opacity=".45" stroke-width="1.5" stroke-linecap="round"/></svg>`;
}
