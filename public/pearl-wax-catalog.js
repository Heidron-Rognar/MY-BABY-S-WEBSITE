// Fifty original story-inspired reliefs, not official crests/logos or licensed merchandise.
const magical = [
  ["owl-post", "Owl Post", "owl"], ["winged-key", "Winged Key", "winged-key"],
  ["midnight-castle", "Midnight Castle", "castle"], ["wand-sparks", "Wand & Starlight", "wand"],
  ["lightning-glasses", "Lightning & Spectacles", "glasses"], ["golden-flight", "Golden Flight", "winged-ball"],
  ["potion-bottle", "Little Potion", "potion"], ["sorting-night", "Sorting Night", "hat"],
  ["moonlit-stag", "Moonlit Stag", "stag"], ["phoenix-feather", "Phoenix Feather", "phoenix"],
  ["school-trunk", "School Trunk", "trunk"], ["steam-express", "Steam Express", "train"],
  ["floating-candles", "Floating Candles", "candles"], ["enchanted-book", "Enchanted Book", "book"],
  ["quill-letter", "Quill & Letter", "quill"], ["greenhouse-magic", "Greenhouse Magic", "mandrake"],
  ["tiny-dragon", "Tiny Dragon", "dragon"], ["broom-moon", "Broom & Moon", "broom"],
  ["lake-swan", "Enchanted Lake", "swan"], ["starry-cauldron", "Starry Cauldron", "cauldron"],
  ["time-hourglass", "Turning Time", "hourglass"], ["lion-garden", "Lion in the Garden", "lion"],
  ["serpent-ivy", "Serpent & Ivy", "serpent"], ["badger-blossom", "Badger & Blossoms", "badger"],
  ["eagle-sky", "Eagle & Constellations", "eagle"],
];
const mysteries = [
  ["bicycle-blooms", "Bicycle & Blooms", "bicycle"], ["pressed-flower", "Pressed Flower Clue", "pressed-flower"],
  ["cipher-letter", "Cipher Letter", "cipher"], ["magnifying-rose", "Magnifying Rose", "magnifier"],
  ["chess-queen", "A Queen's Move", "chess"], ["london-lantern", "London Lantern", "lantern"],
  ["tea-clue", "Tea & a Clue", "teacup"], ["butterfly-secret", "Butterfly Secret", "butterfly"],
  ["violet-bouquet", "Violet Bouquet", "violets"], ["pocket-watch", "The Eleventh Hour", "watch"],
  ["secret-key", "Key to the Mystery", "key"], ["ribbon-letter", "Ribbon-tied Letter", "letter"],
  ["detective-notebook", "Detective's Notebook", "notebook"], ["lily-valley", "Lily of the Valley", "lily"],
  ["victorian-door", "The Hidden Door", "door"], ["garden-sparrow", "Garden Sparrow", "sparrow"],
  ["ribbon-hat", "The Clever Disguise", "bonnet"], ["parasol-stroll", "Parasol Stroll", "parasol"],
  ["city-rooftops", "London Rooftops", "rooftops"], ["fern-envelope", "A Fern in the Post", "fern-letter"],
  ["daisy-chain", "Daisy Chain", "daisies"], ["locket-secret", "Locket Secret", "locket"],
  ["ribbon-shears", "A Cut Above", "scissors"], ["rose-compass", "Find Your Own Way", "compass"],
  ["ink-investigation", "Ink & Investigation", "ink"],
];
const finishes = [
  ["Ivory", "#eee8dd"], ["Pearl", "#e5e8e4"], ["Blush", "#ece0dd"],
  ["Moonstone", "#dfe7e7"], ["Champagne", "#eae3d1"],
];
export const PEARL_WAX_STYLES = Object.freeze([
  ...magical.map((entry, i) => [entry, i, "Harry Potter", "harry-potter"]),
  ...mysteries.map((entry, i) => [entry, i, "Enola Holmes", "enola-holmes"]),
].map(([[id, title, art], i, collection, collectionId]) => Object.freeze({
  id: `pearl-${collectionId}-${id}`, kind: "wax", finish: "pearl", collection, collectionId,
  name: `${title} · ${collection} · ${finishes[i % 5][0]}`, title, art,
  color: finishes[i % 5][1], rim: i % 5,
})));
