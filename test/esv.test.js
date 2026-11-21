import test from "node:test";
import assert from "node:assert/strict";
import { getEsvVerse } from "../src/esv.js";
import worker from "../src/worker.js";

const env = { ESV_API_KEY: "test-only-not-a-real-key" };
// Intentionally invented text, not an ESV Scripture quotation.
const fixtureText = "Test-only provider fixture line one.\nTest-only provider fixture line two. (ESV)";
const provider = () => Response.json({ passages: [`  ${fixtureText}\n`] });
const neverFetch = () => { throw new Error("Unexpected network request"); };

function fakeCache() {
  const stored = new Map();
  return {
    stored,
    async match(key) { return stored.get(key.url)?.clone(); },
    async put(key, response) { stored.set(key.url, response.clone()); },
  };
}

test("ESV endpoint rejects references outside the fixed 100-verse pool without fetching", async () => {
  for (const reference of [null, "", "Genesis 1", "John 1:1-50", "https://evil.test", "Psalm 23:1; Genesis 1:1"]) {
    const result = await getEsvVerse(reference, env, { fetcher: neverFetch });
    assert.equal(result.status, 400);
    assert.equal(result.body.code, "invalid_reference");
  }
});

test("a missing ESV secret returns setup instructions, never bundled or cached scripture", async () => {
  const result = await getEsvVerse("Psalm 23:1", {}, {
    fetcher: neverFetch,
    cache: { match() { assert.fail("Do not serve cached text after the key is removed"); } },
  });
  assert.equal(result.status, 503);
  assert.equal(result.body.code, "esv_not_configured");
  assert.match(result.body.error, /ESV_API_KEY/);
  assert.equal(result.body.text, undefined);
});

test("ESV requests send the secret only in the server header and preserve returned wording and notice", async () => {
  const result = await getEsvVerse("Psalm 23:1", env, {
    cache: undefined,
    fetcher: async (url, options) => {
      const target = new URL(url);
      assert.equal(target.origin, "https://api.esv.org");
      assert.equal(target.pathname, "/v3/passage/text/");
      assert.equal(target.searchParams.get("q"), "Psalm 23:1");
      assert.equal(target.searchParams.get("include-headings"), "false");
      assert.equal(target.searchParams.get("include-footnotes"), "false");
      assert.equal(target.searchParams.get("include-short-copyright"), "true");
      assert.ok(!url.includes(env.ESV_API_KEY));
      assert.equal(options.headers.Authorization, `Token ${env.ESV_API_KEY}`);
      assert.equal(options.redirect, "error");
      assert.ok(options.signal instanceof AbortSignal);
      return provider();
    },
  });
  assert.deepEqual(result, { status: 200, body: { reference: "Psalm 23:1", translation: "ESV", text: fixtureText } });
  assert.ok(!JSON.stringify(result).includes(env.ESV_API_KEY));
});

test("the shared cache reuses a passage for seven days, then refreshes it", async () => {
  const cache = fakeCache();
  let time = Date.now();
  let calls = 0;
  const options = { cache, now: () => time, fetcher: async () => { calls++; return provider(); } };
  const first = await getEsvVerse("Psalm 23:1", env, options);
  assert.equal(calls, 1);
  assert.equal(cache.stored.size, 1);
  assert.ok(![...cache.stored.keys()][0].includes(env.ESV_API_KEY));
  time += 6 * 86400000;
  assert.deepEqual(await getEsvVerse("Psalm 23:1", env, options), first);
  assert.equal(calls, 1);
  time += 86400000;
  assert.deepEqual(await getEsvVerse("Psalm 23:1", env, options), first);
  assert.equal(calls, 2);
});

test("a corrupt or unavailable cache does not stop a valid provider response", async () => {
  for (const cache of [
    { async match() { return new Response("not JSON"); }, async put() { throw new Error("Full"); } },
    { async match() { throw new Error("Unavailable"); } },
    { async match() { return Response.json({ reference: "Wrong 1:1", translation: "KJV", text: "wrong" }); } },
  ]) {
    const result = await getEsvVerse("Psalm 23:1", env, { cache, fetcher: async () => provider() });
    assert.equal(result.status, 200);
    assert.equal(result.body.text, fixtureText);
  }
});

test("provider failures, throttling, timeout, or invalid payloads never expose credentials or cached errors", async () => {
  const responses = [
    () => new Response(env.ESV_API_KEY, { status: 401 }),
    () => new Response(env.ESV_API_KEY, { status: 429 }),
    () => new Response(env.ESV_API_KEY, { status: 500 }),
    () => new Response("not JSON"),
    () => Response.json({ passages: [] }),
    () => Response.json({ passages: [""] }),
    () => Response.json({ passages: ["a", "b"] }),
    () => Response.json({ passages: ["x".repeat(8001)] }),
    () => { throw new Error(`Timeout or network failure: ${env.ESV_API_KEY}`); },
  ];
  for (const response of responses) {
    const cache = fakeCache();
    const result = await getEsvVerse("Psalm 23:1", env, { cache, fetcher: async () => response() });
    assert.ok(result.status >= 500);
    assert.ok(!JSON.stringify(result).includes(env.ESV_API_KEY));
    assert.equal(result.body.text, undefined);
    assert.equal(cache.stored.size, 0);
  }
});

test("the Worker verse endpoint requires login and bypasses unrelated database work", async () => {
  const appEnv = { APP_PASSWORD: "test-only-password" };
  const url = "https://example.test/api/verse?reference=Psalm%2023%3A1";
  const denied = await worker.fetch(new Request(url), appEnv);
  assert.equal(denied.status, 401);
  const login = await worker.fetch(new Request("https://example.test/api/login", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: appEnv.APP_PASSWORD }),
  }), appEnv);
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const response = await worker.fetch(new Request(url, { headers: { cookie } }), appEnv);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "esv_not_configured");
  assert.equal(response.headers.get("cache-control"), "no-store");
  // No DB or ASSETS binding was supplied; this route needs neither.
});
