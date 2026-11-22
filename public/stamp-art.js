import { patchSvg } from "./patch-art.js";
import { BRIGHT_YEARS_ART } from "./bright-years-art.js";
import { pearlWaxSvg } from "./pearl-wax-art.js";
import { waxSvg } from "./wax-art.js";
import { bottleCapSvg } from "./bottle-cap-art.js";
import { stampStyle, validStampDay } from "./stamp-catalog.js";
// Original, lightweight line engravings; trusted local SVG, never user-provided markup.
const art = {
  paris: '<path d="M90 12 72 105m18-93 18 93M82 48h16M77 72h26M68 105h44M59 115h62M65 105q25-36 50 0M87 12h6M90 3v9"/>',
  london: '<path d="M69 116V35h42v81M73 35l17-23 17 23M82 12h16M86 12V4m8 8V4M63 116h54M73 79h34M73 87h34M78 95v15m12-15v15m12-15v15"/><circle cx="90" cy="55" r="13"/><path d="M90 45v10l7 4"/>',
  rome: '<path d="M25 110V57q63-37 130-13v66zM25 77q65-30 130-13M25 93q63-20 130-11M38 67V56m20 4V47m22 7V41m22 9V39m22 9V39m20 10V41"/><path d="M37 107V89q6-8 12-2v20m12 0V83q7-8 13-2v26m13 0V78q7-8 13-2v31m13 0V76q7-7 13 0v31m13 0V77q6-6 11 0v30"/>',
  kyoto: '<path d="M44 111h92M56 111V91h68v20M48 91q42-16 84 0M62 83V67h56v16M52 67q38-14 76 0M69 59V44h42v15M59 44q31-13 62 0M79 37V23h22v14M70 23q20-13 40 0M90 12V3M82 110V97h16v13"/>',
  'new-york': '<path d="M64 117h52l-7-16H71zM77 101l4-41h20l4 41M81 60l-9-20m8 8L67 26l-7 3 7 24M62 24V10m-5 0h10M85 43h14l4 16M85 34q5-14 12 0v9H85zM85 26l-4-8m10 6v-9m7 12 7-7M97 66l15-11 6 7-17 18"/>',
  sydney: '<path d="M20 108h140M31 101 67 49l-2 52M70 101l33-80 9 80M116 101l25-50 13 50M27 112h128M42 100l26-28m7 28 28-50m15 50 24-26"/>',
  agra: '<path d="M35 112h110M52 112V65h76v47M57 65q-4-22 33-39 37 17 33 39zM90 26V14M82 14h16M78 112V89q12-19 24 0v23M35 111V53m110 58V53M29 53h12m98 0h12M33 53V30h4v23m106 0V30h4v23M58 83h11m42 0h11M58 99h11m42 0h11"/>',
  giza: '<path d="m15 112 58-85 48 85zm58-85 11 85M91 112l39-64 38 64m-38-64 9 64M10 118h160"/><circle cx="144" cy="25" r="11"/>',
  athens: '<path d="m28 48 62-29 62 29zM24 55h132M25 111h130M19 119h142M38 57v51m20-51v51m21-51v51m22-51v51m21-51v51m20-51v51M33 61h14m6 0h14m6 0h14m7 0h14m7 0h14m7 0h14"/>',
  istanbul: '<path d="M42 112V67h96v45M54 67q1-27 36-35 35 8 36 35M90 32V18m-3-3q-7-9 3-12M25 112V37m130 75V37M19 37l6-18 6 18m118 0 6-18 6 18M70 112V87q20-24 40 0v25M42 82h22m52 0h22M31 118h118"/>',
  amsterdam: '<path d="M22 111V53h37v58M24 53l16-25 17 25M65 111V40h38v71M65 40l19-24 19 24M111 111V55h38v56M111 55l19-27 19 27M16 117h140M34 64h10m-10 14h10m-10 14h10M79 53h10m-10 14h10m-10 14h10M124 67h10m-10 15h10m-10 15h10"/>',
  venice: '<path d="M24 118h132M28 112V70h55v42M34 70V35h43v35M28 35h55L56 9zM91 112V58h52v54M87 58q29-37 60 0M100 112V83q17-18 34 0v29M43 50h22M50 79v26m-13-26v26m26-26v26M19 125q18-10 36 0t36 0 36 0 36 0"/>',
  'san-francisco': '<path d="M15 103h150M48 113V32h12v81m60 0V32h12v81M44 32h20m52 0h20M54 34q36 68 72 0M15 89q24 3 39-55m72 0q14 58 39 55M27 85v18m12-33v33m34-37v37m17-31v31m17-37v37m36-33v33m12-18v18M48 49h12m60 0h12"/>',
  rio: '<path d="M30 119 62 97l24-30h8l24 30 32 22M87 67V47L48 38l3-9 39 8 39-8 3 9-39 9v20M82 28q8-14 16 0v9H82zM45 120h90"/>',
  beijing: '<path d="M20 115 40 77l22 7 21-32 24 12 28-38 25 12M25 119l23-27 22 6 20-28 25 12 29-37 22 9M76 60V37h22v24M72 37l15-12 15 12M130 35V13h22v22M126 13l15-10 15 10M39 86l6 10m15-6 5 10m40-29 5 11m39-32 5 10"/>',
  seoul: '<path d="M21 110h138M34 107V72h112v35M27 72q63-15 126 0M52 65V43h76v22M44 43q46-16 92 0M72 35V20h36v15M63 20q27-9 54 0M90 12V4M49 84v21m21-21v21m20-21v21m20-21v21m20-21v21"/>',
  bangkok: '<path d="M22 115h136M38 112V85h29v27m46 0V85h29v27M31 85l21-34 22 34m32 0 22-34 21 34M76 112V49h28v63M68 49l22-35 22 35M90 14V3M82 64h16m-16 15h16m-16 15h16"/>',
  singapore: '<path d="M28 113V48h20v65m26 0V48h20v65m26 0V48h20v65M18 40q68 22 137-8l-6 16q-67 28-125 7zM17 119h140M56 113h12m31 0h13"/>',
  dubai: '<path d="M71 117V86h8V58h6V30h5V6m0 24h5v28h6v28h8v31M63 117h54M78 96h24m-19-19h14m-10-29h6M35 117V78h17v39m81 0V69h17v48"/>',
  pisa: '<g transform="rotate(9 90 74)"><path d="M62 115V33h56v82M59 33q31-23 62 0M57 115h67M62 46h56M62 62h56M62 78h56M62 94h56M72 36v75m12-75v75m12-75v75m12-75v75M75 115v-13h30v13"/></g>',
  prague: '<path d="M26 117V71h128v46M27 72l16-24 16 24M38 48V25h10v23M65 117V48h50v69M61 48l17-25 12 13 12-13 17 25M82 23V9h16v14M125 72l15-24 15 24M135 48V25h10v23M79 117V86q11-21 22 0v31"/>',
  budapest: '<path d="M19 114h142M27 109V78h126v31M56 78V61h68v17M64 61q5-29 26-36 21 7 26 36M90 25V10M31 78l12-25 12 25m70 0 13-25 12 25M36 91v16m13-16v16m18-16v16m15-16v16m15-16v16m15-16v16m18-16v16m13-16v16"/>',
  moscow: '<path d="M42 117V63h24v54M78 117V39h24v78M114 117V70h24v47M40 63q-9-17 14-32 22 16 14 32M76 39q-12-17 14-34 26 17 14 34M112 70q-9-17 14-29 23 13 14 29M49 30V18m41-14V0m36 40V28M30 120h120"/>',
  copenhagen: '<path d="M20 111V57h33v54M20 57l16-24 17 24M57 111V46h33v65M57 46l16-25 17 25M96 111V60h32v51M96 60l16-23 16 23M134 111V51h28v60M134 51l14-18 14 18M17 118h148M29 71h12m24-10h14m25 15h14m22-10h12M29 88h12m24-10h14m25 15h14m22-10h12"/>',
  lisbon: '<path d="M40 100V40q50-24 100 0v60zM40 64h100M51 47h29v17m19-17h29v17M54 104v12m72-12v12M35 100h110M49 85h13m56 0h13M56 30l28-18h16l22 18M34 121h114M88 42v55M95 42v55"/>',
  barcelona: '<path d="M34 117V59l8-22 8 22v58M59 117V41l8-29 8 29v76M84 117V32l7-31 7 31v85M108 117V41l8-29 8 29v76M133 117V59l8-22 8 22v58M27 118h129M77 117V90q13-18 27 0v27M39 75h6m18-20h7m18-8h6m18 8h7m18 20h7"/>',
  edinburgh: '<path d="M20 120 39 99h109l18 21M37 99V55h30v44M37 55V45h8v10h7V45h8v10h7M69 99V70h42v29M109 99V42h31v57M109 42V31h9v11h6V31h8v11h8M47 76h9m61-13h13M82 99V83h16v16"/>',
  dublin: '<path d="M42 116V27h96v89M39 27l51-17 51 17M59 42h19v31H59zm43 0h19v31h-19zM75 116V90q15-22 30 0v26M40 83h100M29 120h122M49 34v82m82-82v82"/>',
  vienna: '<path d="M20 117h140M29 110V65h122v45M65 65V41h50v24M65 41q3-25 25-29 22 4 25 29M90 12V3M41 79v29m20-29v29m20-29v29m20-29v29m20-29v29m20-29v29M28 65l19-16 18 16m50 0 18-16 18 16"/>',
  brussels: '<g><path d="M90 20 49 45l15 44h52l15-44zM90 20v69M49 45h82M64 89l-22 27m74-27 22 27M90 89v28"/><circle cx="90" cy="20" r="11"/><circle cx="49" cy="45" r="11"/><circle cx="131" cy="45" r="11"/><circle cx="64" cy="89" r="11"/><circle cx="116" cy="89" r="11"/><circle cx="90" cy="60" r="11"/><circle cx="42" cy="116" r="9"/><circle cx="138" cy="116" r="9"/><circle cx="90" cy="117" r="9"/></g>',
  stockholm: '<path d="M25 117V65h102v52M127 117V30h26v87M123 30l17-19 17 19M140 11V2M36 80h10m8 0h10m8 0h10m8 0h10m8 0h10M36 97h10m8 0h10m8 0h10m8 0h10m8 0h10M133 46h14m-14 16h14M18 123h144"/>',
  helsinki: '<path d="M25 116h130M36 107V69h108v38M66 69V40h48v29M65 40q0-25 25-25t25 25M90 15V4M32 69l17-18 17 18m48 0 17-18 17 18M51 77v28m19-28v28m20-28v28m20-28v28m19-28v28M27 120h126"/>',
  oslo: '<path d="M24 113V60h132v53M30 60V31h43v29m34 0V31h43v29M40 44h22m57 0h22M37 73h9m10 0h9m10 0h9m10 0h9m10 0h9m10 0h9m-104 17h9m10 0h9m10 0h9m10 0h9m10 0h9m10 0h9M75 113V97h29v16M18 120h144"/>',
  reykjavik: '<path d="M34 118V92l8-8V72l8-8V51l8-9V26h64v16l8 9v13l8 8v12l8 8v26M75 118V39l15-29 15 29v79M86 7h8M90 0v10M84 118V96q6-12 12 0v22M66 39v79m48-79v79M24 122h132"/>',
  toronto: '<path d="M80 117 86 61h8l7 56M90 61V6M73 48h34l-5 9H78zM82 39h16l9 9M28 117V81h22v36m74 0V69h23v48M21 122h138M83 80h14"/>',
  seattle: '<path d="m67 119 17-57h12l17 57M89 62v57M48 43q42-23 84 0l-8 12H56zM58 39h64M84 26h12v7M90 26V7M76 53h28M20 122h140"/>',
  'mexico-city': '<path d="M27 118V65h126v53M21 65l69-26 69 26M43 65V37h22v28m50 0V37h22v28M39 37l15-25 15 25m42 0 15-25 15 25M90 39V24M75 118V92q15-22 30 0v26M38 82h20m64 0h20M19 123h142"/>',
  havana: '<path d="M28 118V71h124v47M59 71V44h62v27M63 44q0-29 27-35 27 6 27 35M90 9V0M37 82v34m18-34v34m18-34v34m18-34v34m18-34v34m18-34v34m18-34v34M22 123h136"/>',
  cusco: '<path d="M15 96 55 30l34 40 25-59 51 85M35 110V85h29v25m9 0V76h30v34m9 0V89h28v21M26 116h130M37 98h24m15-9h24m15 12h22M47 85V74h17m27 2V64h12M19 124h140"/>',
  santiago: '<path d="M15 97 50 49l28 27 38-60 50 81M82 118V69h20v49M86 69V35h12v34M92 35V4M28 118V92h25v26m75 0V86h25v32M18 123h143"/>',
  'buenos-aires': '<path d="M79 119V47l11-37 11 37v72M79 47h22M86 37h8M72 119h36M22 119V83h37v36m62 0V77h37v42M15 125h150M27 96h27m73-7h25M31 107h18m81-7h19"/>',
  'cape-town': '<path d="M15 111 41 53h77l30 58M41 53l14-8h63l11 26M15 119h150M33 109l18-35 18 35m32 0 14-29 20 29"/><path d="m136 45 11-20 13 25M39 31h26m-20-8h18"/>',
  marrakesh: '<path d="M31 119V65h53v54M88 119V28h45v91M84 28h53M91 17h39v11M99 17V5h23v12M47 119V94q11-18 22 0v25M98 46h25m-25 18h25m-25 18h25M22 124h126M37 65l21-12 21 12"/>',
  petra: '<path d="M28 118h124M40 110V65h100v45M32 65l58-30 58 30M52 65v43m23-43v43m30-43v43m23-43v43M54 34V18h72v16M65 34q25-31 50 0M83 109V83h15v26M21 123h138"/>',
  'hoi-an': '<path d="M18 105h144M29 104V65h122v39M21 65l20-19h98l20 19M42 46V35h96v11M40 72v31m20-31v31m20-31v31m20-31v31m20-31v31m20-31v31M23 116q15-9 30 0t30 0 30 0 30 0M55 26h70"/>',
  bali: '<path d="M24 119h132M35 112V64h38v48m34 0V64h38v48M29 64l11-14h28l11 14m22 0 11-14h28l11 14M41 49V33h26v16m46 0V33h26v16M46 33V18h16v15m56 0V18h16v15M51 18V5m78 13V5M82 117l8-15 8 15"/>',
  'kuala-lumpur': '<path d="M43 118V53h34v65m26 0V53h34v65M47 53V37h26v16m34 0V37h26v16M52 37V22h16v15m44 0V22h16v15M60 22V4m60 18V4M77 76h26v10H77M40 63h40m20 0h40M40 97h40m20 0h40M28 123h124"/>',
  manila: '<path d="M25 117h130M38 112V72h71v40M31 72l42-22 43 22M118 112V39h28v73M114 39l18-23 18 23M132 16V3m-7 6h14M51 112V94q10-13 20 0v18m11 0V94q9-13 18 0v18M124 51h16m-16 17h16m-16 17h16"/>',
  bohol: '<path d="M13 112q24-88 50 0m-7 0q26-111 54 0m-12 0q32-94 65 0M12 119h153"/><path d="M125 27h27m-21-7h22M25 38h27"/>',
  palawan: '<path d="M19 102 37 40l17 18 20-40 21 84M94 102l17-50 21 17 16-43 18 76M15 111q19-12 38 0t38 0 38 0 38 0M15 122q19-12 38 0t38 0 38 0 38 0"/><circle cx="112" cy="20" r="9"/>',
};
const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
const cache = new Map();
export function stampSvg(styleId, day = "") {
  const style = stampStyle(styleId);
  const date = validStampDay(day) ? day.slice(8) + "." + day.slice(5, 7) + "." + day.slice(0, 4) : "WELL DONE";
  if (style.kind === "patch") return patchSvg(style);
  if (style.finish === "pearl") return pearlWaxSvg(style);
  if (style.kind === "wax") return waxSvg(style);
  if (style.kind === "cap") return bottleCapSvg(style);
  let holes = "";
  for (let x = 16; x < 180; x += 16) holes += `<circle cx="${x}" cy="6" r="4"/><circle cx="${x}" cy="204" r="4"/>`;
  for (let y = 20; y < 204; y += 16) holes += `<circle cx="6" cy="${y}" r="4"/><circle cx="174" cy="${y}" r="4"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 210"><defs><mask id="paper"><rect x="6" y="6" width="168" height="198" fill="white"/><g fill="black">${holes}</g></mask><pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse"><path d="m0 5 5-5" stroke="${style.color}" stroke-opacity=".08" stroke-width=".6"/></pattern></defs><g mask="url(#paper)"><rect x="6" y="6" width="168" height="198" fill="#faf2df"/><rect x="14" y="14" width="152" height="182" fill="none" stroke="${style.color}" stroke-width="2"/><rect x="21" y="38" width="138" height="112" fill="url(#hatch)" stroke="${style.color}" stroke-opacity=".4"/><text x="90" y="29" text-anchor="middle" font-family="Georgia,serif" font-size="10" letter-spacing="2" fill="${style.color}">${esc(style.header || "STUDIO POST")}</text><g transform="translate(18 42) scale(.8)" fill="none" stroke="${style.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${style.collectionId === "bright-years" ? BRIGHT_YEARS_ART[style.art] : art[style.art]}</g><text x="90" y="167" text-anchor="middle" font-family="Georgia,serif" font-weight="bold" font-size="${style.title.length > 12 ? 11 : 14}" letter-spacing=".7" fill="${style.color}">${esc(style.title.toUpperCase())}</text><text x="90" y="183" text-anchor="middle" font-family="Georgia,serif" font-size="8" letter-spacing="1.3" fill="${style.color}">${esc(style.country.toUpperCase())}</text><g transform="rotate(-16 130 57)" fill="none" stroke="#4f4940" stroke-opacity=".6" stroke-width="1.2"><circle cx="131" cy="57" r="25"/><circle cx="131" cy="57" r="21"/><path d="M105 66q14-7 29 0t29 0M104 72q14-7 29 0t29 0"/><text x="131" y="51" text-anchor="middle" font-family="Georgia,serif" font-size="6" fill="#4f4940" stroke="none">COMPLETE</text><text x="131" y="59" text-anchor="middle" font-family="Georgia,serif" font-size="6" fill="#4f4940" stroke="none">${esc(date)}</text></g><text x="90" y="196" text-anchor="middle" font-family="Georgia,serif" font-size="6" letter-spacing="1.4" fill="${style.color}">A LITTLE WELL DONE</text></g></svg>`;
}
export function stampImageUrl(styleId, day = "") {
  const key = `${styleId}|${day}`;
  if (!cache.has(key)) {
    if (cache.size >= 300) cache.delete(cache.keys().next().value);
    cache.set(key, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(stampSvg(styleId, day))}`);
  }
  return cache.get(key);
}
