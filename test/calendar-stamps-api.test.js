import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";

function fixture() {
  const rows = new Map(), settings = new Map();
  const db = { loseRace: false,
    prepare(sql) { return { values: [], bind(...values) { this.values = values; return this; },
      async run() {
        if (sql.startsWith("INSERT INTO settings")) settings.set(this.values[0], this.values[1]);
        else assert.match(sql, /^(CREATE|ALTER)/);
        return { success: true };
      },
      async all() {
        if (sql.startsWith("PRAGMA")) return { results: ["reminder_offsets", "archived_at", "restore_key", "restore_token"].map((name) => ({ name })) };
        if (sql === "SELECT key, value FROM settings") return { results: [...settings].map(([key, value]) => ({ key, value })) };
        if (sql.includes("FROM calendar_stamps")) return { results: [...rows.values()].filter((r) => r.day >= this.values[0] && r.day <= this.values[1]) };
        throw Error(`Unexpected query: ${sql}`);
      },
      async first() {
        if (sql.startsWith("SELECT value FROM settings")) return { value: "2" };
        if (sql === "SELECT * FROM calendar_stamps WHERE day = ?") return rows.get(this.values[0]) || null;
        if (sql.startsWith("INSERT INTO calendar_stamps")) {
          assert.match(sql, /WHERE calendar_stamps.updated_at = \? RETURNING/);
          const [day, x, y, rotation, style, updated_at, expected] = this.values;
          if (db.loseRace || (rows.has(day) && rows.get(day).updated_at !== expected)) return null;
          const row = { day, x, y, rotation, style, updated_at }; rows.set(day, row); return row;
        }
        throw Error(`Unexpected query: ${sql}`);
      },
    }; },
    async batch(statements) { return Promise.all(statements.map((s) => s.run())); },
  };
  return { DB: db, APP_PASSWORD: "test-only-password" };
}
async function login(env) {
  const response = await worker.fetch(new Request("https://studio.test/api/login", { method: "POST", body: JSON.stringify({ password: env.APP_PASSWORD }) }), env);
  assert.equal(response.status, 200); return response.headers.get("set-cookie").split(";")[0];
}
const call = (env, cookie, path, body) => worker.fetch(new Request(`https://studio.test${path}`, { headers: { cookie, "content-type": "application/json" }, ...(body ? { method: "PUT", body: JSON.stringify(body) } : {}) }), env);
const placement = (extra = {}) => ({ x: .2, y: .8, rotation: -8, style: "post-manila", expected_updated_at: null, ...extra });

test("stamp routes require authentication before database access", async () => {
  const env = fixture();
  assert.equal((await call(env, "", "/api/calendar-stamps?start=2026-11-01&end=2026-12-05")).status, 401);
  assert.equal((await call(env, "", "/api/calendar-stamps/2026-11-12", placement())).status, 401);
});

test("placements persist independently by local day, with compare-and-swap stale-tab protection", async () => {
  const env = fixture(), cookie = await login(env);
  const first = await call(env, cookie, "/api/calendar-stamps/2026-11-12", placement()); assert.equal(first.status, 200);
  const saved = (await first.json()).stamp;
  assert.equal((await call(env, cookie, "/api/calendar-stamps/2026-11-13", placement({ x: .7 }))).status, 200);
  assert.equal((await call(env, cookie, "/api/calendar-stamps/2026-11-12", placement({ x: .9 }))).status, 409);
  const update = await call(env, cookie, "/api/calendar-stamps/2026-11-12", placement({ x: .9, expected_updated_at: saved.updated_at }));
  assert.equal(update.status, 200);
  const rows = (await (await call(env, cookie, "/api/calendar-stamps?start=2026-11-01&end=2026-11-30")).json()).stamps;
  assert.equal(rows.length, 2); assert.equal(rows.find((r) => r.day === "2026-11-12").x, .9); assert.equal(rows.find((r) => r.day === "2026-11-13").x, .7);
});

test("invalid ranges and unsafe placement values are rejected without changing stored data", async () => {
  const env = fixture(), cookie = await login(env);
  for (const query of ["start=2026-02-30&end=2026-03-02", "start=2026-11-20&end=2026-11-01", "start=2026-01-01&end=2026-12-31", "start=bad&end=bad"]) {
    assert.equal((await call(env, cookie, `/api/calendar-stamps?${query}`)).status, 400);
  }
  for (const patch of [{ x: -1 }, { y: 3 }, { rotation: 180 }, { style: "not-a-stamp" }]) assert.equal((await call(env, cookie, "/api/calendar-stamps/2026-11-12", placement(patch))).status, 400);
  assert.equal((await call(env, cookie, "/api/calendar-stamps/2026-02-30", placement())).status, 400);
  const rows = await (await call(env, cookie, "/api/calendar-stamps?start=2026-11-01&end=2026-11-30")).json(); assert.deepEqual(rows.stamps, []);
});

test("a write race returns conflict rather than overwriting another device's stamp", async () => {
  const env = fixture(), cookie = await login(env); env.DB.loseRace = true;
  assert.equal((await call(env, cookie, "/api/calendar-stamps/2026-11-12", placement())).status, 409);
});

test("stamp opt-out/default style preferences sync and invalid choices are rejected", async () => {
  const env = fixture(), cookie = await login(env);
  const response = await call(env, cookie, "/api/settings", { completion_stamps: { enabled: false, style: "wax-pearl-shell" } });
  assert.equal(response.status, 200); assert.deepEqual((await response.json()).settings.completion_stamps, { enabled: false, style: "wax-pearl-shell" });
  assert.equal((await call(env, cookie, "/api/settings", { completion_stamps: { enabled: true, style: "bad" } })).status, 400);
});

test("retro caps persist per day without changing another day's wax or the default", async () => {
  const env = fixture(), cookie = await login(env);
  const waxResponse = await call(env, cookie, "/api/calendar-stamps/2026-11-12", placement({ style: "wax-pearl-rose" }));
  assert.equal(waxResponse.status, 200); const wax = (await waxResponse.json()).stamp;
  const capResponse = await call(env, cookie, "/api/calendar-stamps/2026-11-13", placement({ style: "cap-fallout-1" }));
  assert.equal(capResponse.status, 200); const cap = (await capResponse.json()).stamp;
  const changed = await call(env, cookie, "/api/calendar-stamps/2026-11-13", placement({ style: "cap-crimson-desert-5", expected_updated_at: cap.updated_at }));
  assert.equal(changed.status, 200);
  const rows = (await (await call(env, cookie, "/api/calendar-stamps?start=2026-11-01&end=2026-11-30")).json()).stamps;
  assert.deepEqual(rows.find((r) => r.day === wax.day), wax);
  assert.equal(rows.find((r) => r.day === cap.day).style, "cap-crimson-desert-5");
  const settings = (await (await call(env, cookie, "/api/settings")).json()).settings;
  assert.equal(settings.completion_stamps.style, "post-paris");
});

test("pearly storybook styles persist independently without overwriting another day", async () => {
  const env = fixture(), cookie = await login(env);
  const first = await call(env, cookie, "/api/calendar-stamps/2026-11-12", placement({ style: "pearl-harry-potter-owl-post" }));
  assert.equal(first.status, 200); const saved = (await first.json()).stamp;
  const second = await call(env, cookie, "/api/calendar-stamps/2026-11-13", placement({ style: "pearl-enola-holmes-bicycle-blooms" }));
  assert.equal(second.status, 200);
  const rows = (await (await call(env, cookie, "/api/calendar-stamps?start=2026-11-01&end=2026-11-30")).json()).stamps;
  assert.deepEqual(rows.find((r) => r.day === saved.day), saved);
  assert.equal(rows.find((r) => r.day === "2026-11-13").style, "pearl-enola-holmes-bicycle-blooms");
});
