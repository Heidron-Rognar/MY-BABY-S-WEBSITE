// A 100-reference rotation, not a bundled copy of licensed Bible text.
// ESV passages are fetched only by the authenticated server endpoint.
export const VERSE_REFERENCES = Object.freeze([
  "Psalm 23:1",
  "Psalm 46:1",
  "Psalm 56:3",
  "Psalm 34:8",
  "Psalm 37:5",
  "Psalm 46:10",
  "Psalm 90:12",
  "Psalm 118:24",
  "Psalm 119:105",
  "Psalm 121:2",
  "Psalm 145:18",
  "Proverbs 3:5",
  "Proverbs 3:6",
  "Proverbs 16:3",
  "Proverbs 17:17",
  "Isaiah 26:3",
  "Isaiah 40:31",
  "Matthew 5:8",
  "Matthew 5:9",
  "Matthew 6:21",
  "Matthew 11:28",
  "John 14:27",
  "John 15:12",
  "Romans 8:28",
  "Romans 12:12",
  "Romans 12:21",
  "Romans 15:13",
  "1 Corinthians 13:13",
  "1 Corinthians 16:14",
  "2 Corinthians 5:7",
  "Galatians 6:9",
  "Ephesians 4:32",
  "Philippians 4:4",
  "Philippians 4:6",
  "Philippians 4:13",
  "Colossians 3:14",
  "1 Thessalonians 5:16",
  "1 Thessalonians 5:17",
  "1 Thessalonians 5:18",
  "2 Timothy 1:7",
  "Hebrews 11:1",
  "Hebrews 13:8",
  "James 1:5",
  "James 1:17",
  "1 Peter 5:7",
  "1 John 4:19",
  "Genesis 1:27",
  "Exodus 14:14",
  "Numbers 6:24",
  "Numbers 6:25",
  "Numbers 6:26",
  "Deuteronomy 6:5",
  "Deuteronomy 31:6",
  "Joshua 1:9",
  "Ruth 2:12",
  "1 Samuel 16:7",
  "2 Samuel 22:31",
  "1 Chronicles 16:11",
  "2 Chronicles 7:14",
  "Nehemiah 8:10",
  "Luke 2:11",
  "Psalm 4:8",
  "Psalm 16:8",
  "Psalm 19:14",
  "Psalm 27:1",
  "Psalm 27:14",
  "Psalm 30:5",
  "Psalm 32:8",
  "Psalm 34:18",
  "Psalm 55:22",
  "Psalm 62:1",
  "Psalm 63:3",
  "Psalm 73:26",
  "Psalm 84:11",
  "Psalm 91:2",
  "Psalm 94:19",
  "Psalm 100:5",
  "Psalm 103:2",
  "Psalm 107:1",
  "Psalm 139:14",
  "Psalm 143:8",
  "Psalm 147:3",
  "Proverbs 4:23",
  "Proverbs 11:25",
  "Proverbs 15:1",
  "Proverbs 18:10",
  "Ecclesiastes 3:11",
  "Isaiah 40:29",
  "Isaiah 41:10",
  "Isaiah 43:2",
  "Jeremiah 17:7",
  "Jeremiah 29:11",
  "Jeremiah 31:3",
  "Lamentations 3:22",
  "Lamentations 3:23",
  "Micah 6:8",
  "Nahum 1:7",
  "Zephaniah 3:17",
  "Matthew 5:16",
  "John 16:33",
]);

export const VERSE_SEED_KEY = "cs-verse-seed";
export const FALLBACK_SEED = 0x43535631;

// Fall back to a fixed seed if storage is blocked/full so reloads still agree.
export function getVerseSeed(storage, random = () => globalThis.crypto.getRandomValues(new Uint32Array(1))[0]) {
  try {
    const saved = storage.getItem(VERSE_SEED_KEY);
    if (saved !== null && /^\d+$/.test(saved) && Number(saved) <= 0xffffffff) return Number(saved);
    const seed = random() >>> 0;
    storage.setItem(VERSE_SEED_KEY, String(seed));
    return seed;
  } catch {
    return FALLBACK_SEED;
  }
}

export function localDateKey(date) {
  if (Number.isNaN(date.getTime())) throw new RangeError("A valid date is required");
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Calendar-day arithmetic, not elapsed 24-hour periods: DST and local midnight
// must not change the verse twice in a day or leave it on yesterday's verse.
export function localDayNumber(date) {
  localDateKey(date);
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}

export function millisecondsUntilMidnight(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime() - date.getTime() + 100;
}

export function getDailyReference(date, seed) {
  // Seeded Fisher–Yates shuffle. Advance one place per local day, so verses
  // feel random but never repeat until this entire collection has been seen.
  const order = VERSE_REFERENCES.map((_, index) => index);
  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let n = Math.imul(state ^ (state >>> 15), state | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const day = localDayNumber(date);
  return VERSE_REFERENCES[order[((day % order.length) + order.length) % order.length]];
}
