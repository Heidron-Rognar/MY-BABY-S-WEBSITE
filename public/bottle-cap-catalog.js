// Original fictional soda labels inspired by these worlds; not official merchandise.
// Five distinct flavors/illustrations per collection. No popularity ranking implied.
export const CAP_COLLECTIONS = Object.freeze([
  { id: "stranger-things", name: "Stranger Things", label: "MIDNIGHT CLUB", art: "bicycle", color: "#a93644", ink: "#fff0d1", drinks: ["Cherry Signal", "Arcade Grape", "Upside Orange", "Starlight Cream", "Midnight Cola"] },
  { id: "fallout", name: "Fallout", label: "ATOMIC POP", art: "atom", color: "#276d80", ink: "#fff1c4", drinks: ["Atomic Cherry", "Wasteland Lime", "Desert Sarsaparilla", "Bunker Cream", "Quantum Berry"] },
  { id: "cyberpunk", name: "Cyberpunk", label: "NEON FIZZ", art: "city", color: "#d0ac30", ink: "#253f54", drinks: ["Neon Yuzu", "Afterhours Plum", "Chrome Cola", "Electric Melon", "Pixel Peach"] },
  { id: "witcher", name: "The Witcher", label: "SILVER ORCHARD", art: "wolf", color: "#3f665f", ink: "#f8e6c2", drinks: ["Silver Apple", "Wild Elderflower", "Moonberry Tonic", "Forest Pear", "Bard's Ginger"] },
  { id: "crimson-desert", name: "Crimson Desert", label: "DUNE & CLOVER", art: "mountain", color: "#a65b42", ink: "#fff0cf", drinks: ["Crimson Orange", "Oasis Apricot", "Dusty Cherry", "Clover Cream", "Frontier Fig"] },
  { id: "arcane", name: "Arcane", label: "TWIN CITY SODA", art: "crystal", color: "#706292", ink: "#fff0cc", drinks: ["Violet Spark", "Clockwork Citrus", "Undercity Lime", "Crystal Cream", "Copperberry"] },
  { id: "last-of-us", name: "The Last of Us", label: "FERN & FIZZ", art: "fern", color: "#647949", ink: "#fff2cc", drinks: ["Wild Strawberry", "Fernwood Lemon", "Orchard Survivor", "Rainy Day Rootbeer", "Firefly Peach"] },
  { id: "wednesday", name: "Wednesday", label: "ODD LITTLE SODA", art: "raven", color: "#61516f", ink: "#f8e7da", drinks: ["Black Cherry", "Moonlit Grape", "Velvet Vanilla", "Gothic Blackberry", "Stormy Citrus"] },
  { id: "one-piece", name: "One Piece", label: "SUNNY SEAS", art: "ship", color: "#ba6741", ink: "#fff3cb", drinks: ["Treasure Tangerine", "Ocean Blueberry", "Sunshine Pineapple", "Captain's Cola", "Island Coconut"] },
  { id: "mandalorian", name: "The Mandalorian", label: "LITTLE ORBIT", art: "planet", color: "#577c79", ink: "#fff0d2", drinks: ["Little Green Lime", "Stardust Cream", "Desert Peach", "Comet Cola", "Moon Melon"] },
].map((collection) => Object.freeze({ ...collection, drinks: Object.freeze(collection.drinks) })));
export const BOTTLE_CAP_STYLES = Object.freeze(CAP_COLLECTIONS.flatMap((c) => c.drinks.map((drink, variant) => Object.freeze({
  id: `cap-${c.id}-${variant + 1}`, kind: "cap", name: `${drink} · ${c.name}`, title: drink,
  collection: c.name, collectionId: c.id, label: c.label, color: c.color, ink: c.ink, art: c.art, variant,
}))));
