import { VERSE_REFERENCES } from "../public/daily-verses.js";

const ALLOWED_REFERENCES = new Set(VERSE_REFERENCES);
const CACHE_SECONDS = 7 * 24 * 60 * 60;
const failure = (status, code, error) => ({ status, body: { code, error } });

function validVerse(data, reference) {
  return data?.reference === reference && data.translation === "ESV" &&
    typeof data.text === "string" && data.text.trim().length > 0 && data.text.length < 8000;
}

// Called only after session authentication. The allowlist bounds both API usage
// and stored text to 100 single verses; the key is never returned to the client.
export async function getEsvVerse(reference, env, {
  fetcher = globalThis.fetch,
  cache = globalThis.caches?.default,
  now = () => Date.now(),
} = {}) {
  if (!ALLOWED_REFERENCES.has(reference)) return failure(400, "invalid_reference", "Choose a reference from the daily reading pool.");
  if (!env.ESV_API_KEY) return failure(503, "esv_not_configured", "ESV setup needed: add the ESV_API_KEY Worker secret. See README → Daily ESV verses.");

  // This is a cache key, not a network destination. No user data or key in it.
  const cacheKey = new Request(`https://caption-studio.internal/esv/v1/${encodeURIComponent(reference)}`);
  try {
    const cached = await cache?.match(cacheKey);
    if (cached) {
      const data = await cached.json();
      const age = now() - data.fetchedAt;
      if (validVerse(data, reference) && Number.isFinite(age) && age >= 0 && age < CACHE_SECONDS * 1000) {
        const { fetchedAt, ...verse } = data;
        return { status: 200, body: verse };
      }
    }
  } catch { /* Cache failure must not break the reading. */ }

  const url = new URL("https://api.esv.org/v3/passage/text/");
  const params = {
    q: reference,
    "include-passage-references": "false",
    "include-verse-numbers": "false",
    "include-first-verse-numbers": "false",
    "include-footnotes": "false",
    "include-footnote-body": "false",
    "include-headings": "false",
    "include-short-copyright": "true",
    "include-copyright": "false",
    "indent-paragraphs": "0",
    "indent-poetry": "false",
    "line-length": "0",
  };
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  try {
    const response = await fetcher(url.toString(), {
      headers: { Authorization: `Token ${env.ESV_API_KEY}`, Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 429) return failure(503, "esv_rate_limited", "ESV is busy right now. Please try again shortly.");
    if (!response.ok) return failure(503, "esv_unavailable", "Today's ESV verse is temporarily unavailable. Please try again later.");
    const data = await response.json();
    if (!Array.isArray(data.passages) || data.passages.length !== 1 || typeof data.passages[0] !== "string") {
      return failure(502, "esv_invalid_response", "The ESV service returned an unreadable passage. Please try again later.");
    }
    // Preserve the supplied words and (ESV) notice; only trim outer whitespace.
    const verse = { reference, translation: "ESV", text: data.passages[0].trim() };
    if (!validVerse(verse, reference)) return failure(502, "esv_invalid_response", "The ESV service returned an empty or invalid passage.");
    try {
      await cache?.put(cacheKey, new Response(JSON.stringify({ ...verse, fetchedAt: now() }), {
        headers: { "content-type": "application/json", "cache-control": `public, max-age=${CACHE_SECONDS}` },
      }));
    } catch { /* Serve the passage even when caching is unavailable. */ }
    return { status: 200, body: verse };
  } catch {
    // Do not expose upstream error bodies, request headers, or credentials.
    return failure(503, "esv_unavailable", "Today's ESV verse could not be loaded. Please try again later.");
  }
}
