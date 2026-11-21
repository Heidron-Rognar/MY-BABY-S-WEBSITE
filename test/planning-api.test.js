import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";

// Small D1 double for API control-flow tests; browser checks exercise real SQLite.
function fixture(overrides = {}) {
  const db = {
    row: { id: 7, title: "Launch", caption: "Caption", content_type: "Showcase", platforms: '["Instagram"]', status: "ready", notes: "Notes", reminder_offsets: '[60,0]', scheduled_at: "2026-11-25T10:35:00.000Z", updated_at: "2026-11-21T10:00:00.000Z", archived_at: null, ...overrides },
    settings: new Map([["content_types_version", "2"]]), updates: 0, loseRace: false,
    async batch(statements) { return Promise.all(statements.map((s) => s.run())); },
    prepare(sql) {
      return {
        values: [],
        bind(...values) { this.values = values; return this; },
        async all() {
          if (sql.startsWith("PRAGMA")) return { results: ["reminder_offsets", "archived_at"].map((name) => ({ name })) };
          if (sql === "SELECT key, value FROM settings") return { results: [...db.settings].map(([key, value]) => ({ key, value })) };
          if (sql.includes("FROM images")) return { results: [] };
          throw new Error(`Unexpected all: ${sql}`);
        },
        async first() {
          if (sql.startsWith("SELECT value FROM settings")) return { value: "2" };
          if (sql === "SELECT * FROM posts WHERE id = ?") return db.row && this.values[0] === db.row.id ? { ...db.row } : null;
          if (sql.startsWith("UPDATE posts SET scheduled_at = ?")) {
            db.updates++;
            assert.match(sql, /WHERE id = \? AND updated_at = \? AND status != 'posted' AND archived_at IS NULL/);
            const [scheduled_at, updated_at, id, expected] = this.values;
            if (db.loseRace || !db.row || db.row.id !== id || db.row.updated_at !== expected) return null;
            db.row = { ...db.row, scheduled_at, updated_at };
            return { ...db.row };
          }
          throw new Error(`Unexpected first: ${sql}`);
        },
        async run() {
          if (sql.startsWith("INSERT INTO settings")) db.settings.set(this.values[0], this.values[1]);
          else if (!/^(CREATE|ALTER)/.test(sql)) throw new Error(`Unexpected run: ${sql}`);
          return { success: true };
        },
      };
    },
  };
  return { DB: db, APP_PASSWORD: "test-only-password" };
}

async function login(env) {
  const response = await worker.fetch(new Request("https://studio.test/api/login", { method: "POST", body: JSON.stringify({ password: env.APP_PASSWORD }) }), env);
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie").split(";")[0];
}
async function call(env, cookie, path, body, method = "POST") {
  return worker.fetch(new Request(`https://studio.test${path}`, { method, headers: { cookie, "content-type": "application/json" }, body: JSON.stringify(body) }), env);
}
const move = (extra = {}) => ({ scheduled_at: "2026-11-27T10:35:00.000Z", expected_updated_at: "2026-11-21T10:00:00.000Z", ...extra });

test("calendar move API requires authentication", async () => {
  const env = fixture();
  const response = await call(env, "", "/api/posts/7/reschedule", move());
  assert.equal(response.status, 401);
  assert.equal(env.DB.updates, 0);
});

test("calendar move updates only the schedule and returns existing reminder, text, and platform data", async () => {
  const env = fixture(); const cookie = await login(env);
  const response = await call(env, cookie, "/api/posts/7/reschedule", move({ title: "Ignored malicious change", reminder_offsets: [] }));
  assert.equal(response.status, 200);
  const { post } = await response.json();
  assert.equal(post.scheduled_at, "2026-11-27T10:35:00.000Z");
  assert.equal(post.title, "Launch"); assert.equal(post.caption, "Caption"); assert.equal(post.notes, "Notes");
  assert.deepEqual(post.platforms, ["Instagram"]); assert.deepEqual(post.reminder_offsets, [60, 0]);
  assert.equal(post.status, "ready"); assert.notEqual(post.updated_at, move().expected_updated_at);
});

test("calendar move rejects stale, posted, archived, unscheduled, invalid, and missing captions", async () => {
  for (const [overrides, body, expected] of [
    [{ status: "posted" }, move(), 409], [{ archived_at: "2026-11-20" }, move(), 409],
    [{ scheduled_at: null }, move(), 409], [{}, move({ expected_updated_at: "stale" }), 409],
    [{}, move({ scheduled_at: "bad" }), 400], [{}, move({ scheduled_at: null }), 400],
  ]) {
    const env = fixture(overrides); const cookie = await login(env);
    assert.equal((await call(env, cookie, "/api/posts/7/reschedule", body)).status, expected);
    assert.equal(env.DB.updates, 0);
  }
  const env = fixture(); const cookie = await login(env); env.DB.row = null;
  assert.equal((await call(env, cookie, "/api/posts/7/reschedule", move())).status, 404);
});

test("a concurrent change between reading and writing returns conflict, not a silent overwrite", async () => {
  const env = fixture(); env.DB.loseRace = true; const cookie = await login(env);
  assert.equal((await call(env, cookie, "/api/posts/7/reschedule", move())).status, 409);
  assert.equal(env.DB.row.scheduled_at, "2026-11-25T10:35:00.000Z");
});

test("templates persist through authenticated settings, with forbidden scheduling fields stripped", async () => {
  const env = fixture(); const cookie = await login(env);
  assert.equal((await call(env, "", "/api/settings", { caption_templates: [] }, "PUT")).status, 401);
  const response = await call(env, cookie, "/api/settings", { caption_templates: [{ name: "Reusable", caption: "A caption", status: "posted", scheduled_at: "2026-12-01", images: [1] }] }, "PUT");
  assert.equal(response.status, 200);
  const settings = (await response.json()).settings;
  assert.equal(settings.caption_templates.length, 1);
  assert.equal(settings.caption_templates[0].scheduled_at, undefined);
  assert.equal(settings.caption_templates[0].status, undefined);
  assert.equal(settings.caption_templates[0].images, undefined);
  assert.deepEqual(JSON.parse(env.DB.settings.get("caption_templates")), settings.caption_templates);
  const later = await worker.fetch(new Request("https://studio.test/api/settings", { headers: { cookie } }), env);
  assert.deepEqual((await later.json()).settings.caption_templates, settings.caption_templates);
});

test("title-icon settings persist emoji/image choices and reject invalid updates without losing the saved icon", async () => {
  const env = fixture(); const cookie = await login(env);
  let response = await call(env, cookie, "/api/settings", { brand_icon: { mode: "emoji", value: "🐚" } }, "PUT");
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).settings.brand_icon, { mode: "emoji", value: "🐚" });
  response = await call(env, cookie, "/api/settings", { brand_icon: { mode: "image", value: "https://example.com/untrusted.svg" } }, "PUT");
  assert.equal(response.status, 400);
  assert.deepEqual(JSON.parse(env.DB.settings.get("brand_icon")), { mode: "emoji", value: "🐚" });
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
  response = await call(env, cookie, "/api/settings", { brand_icon: { mode: "image", value: png } }, "PUT");
  assert.equal(response.status, 200);
  const later = await worker.fetch(new Request("https://studio.test/api/settings", { headers: { cookie } }), env);
  assert.deepEqual((await later.json()).settings.brand_icon, { mode: "image", value: png });
  response = await call(env, cookie, "/api/settings", { brand_icon: { mode: "theme" } }, "PUT");
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).settings.brand_icon, { mode: "theme" });
});
