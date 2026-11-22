// Spoiler-light thematic tributes to The Bright Years by Sarah Damoff.
// Motifs are original interpretations of family, Texas, memory, grace and renewal;
// not assertions that particular objects/scenes appear in the novel. No quotations.
const entries = [
  ["porch-light", "Porch Light"], ["open-door", "An Open Door"], ["kitchen-table", "Kitchen Table"],
  ["window-light", "Window Light"], ["garden-gate", "Garden Gate"], ["homeward-path", "Homeward Path"],
  ["two-mugs", "Two Mugs"], ["rocking-chair", "Rocking Chair"], ["quilt", "Patchwork Home"], ["house-key", "A Key Kept Safe"],
  ["family-tree", "Family Tree"], ["four-branches", "Four Generations"], ["nested-birds", "Close to Home"],
  ["joined-hands", "Holding On"], ["ribbon-knot", "Ties That Stay"], ["keepsake-box", "Kept with Love"],
  ["photo-album", "Family Album"], ["picture-frames", "Side by Side"], ["small-shoes", "Small Beginnings"], ["woven-basket", "Gathered Together"],
  ["texas-sky", "Texas Sky"], ["bluebonnets", "Bluebonnet Days"], ["live-oak", "Under the Oak"],
  ["prairie-road", "Prairie Road"], ["barn-swallow", "Evening Swallow"], ["sunflower", "Toward the Light"],
  ["rain-cloud", "After the Rain"], ["windmill", "Turning Seasons"], ["wildflower-field", "Wildflower Field"], ["sunset-hills", "A Warm Horizon"],
  ["folded-letter", "A Letter Home"], ["ink-bottle", "Words Kept Close"], ["pressed-flower", "Pressed in a Book"],
  ["pocket-watch", "The Years Between"], ["calendar", "Another Bright Day"], ["ribbon-bookmark", "A Place Remembered"],
  ["vinyl-record", "An Old Melody"], ["thread-spool", "Threads of Memory"], ["postbox", "Across the Miles"], ["paper-crane", "Something Tender"],
  ["mended-heart", "Room for Grace"], ["new-leaves", "Begin Again"], ["sunrise", "Morning Returns"],
  ["olive-branch", "A Gentle Peace"], ["bridge", "Finding a Way"], ["candle", "A Little Light"],
  ["open-book", "Still Unfolding"], ["butterfly", "Slowly Becoming"], ["watering-can", "Love Takes Tending"], ["dawn-window", "The Bright Years"],
];
const inks = ["#8c654e", "#6e8170", "#a16b70", "#627e91", "#a58b51"];
export const BRIGHT_YEARS_STYLES = Object.freeze(entries.map(([art, title], i) => Object.freeze({
  id: `post-bright-years-${art}`, kind: "postage", collectionId: "bright-years", collection: "The Bright Years",
  author: "Sarah Damoff", name: `${title} · The Bright Years · Sarah Damoff`, title,
  country: "Sarah Damoff", header: "THE BRIGHT YEARS", color: inks[Math.floor(i / 10)], art,
})));
