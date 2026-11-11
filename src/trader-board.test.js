import assert from "node:assert/strict";
import test from "node:test";
import { boardEnv, qualify, rpcUnavailable, sanitizeName, scoreInBounds } from "./trader-board.js";

test("names are trimmed, short, and lightly filtered", () => {
  assert.deepEqual(sanitizeName("  Ada Lovelace  "), { ok: true, name: "Ada Lovelace" });
  assert.equal(sanitizeName("this name is far too long").ok, false);
  assert.equal(sanitizeName("bad<script>").ok, false);
  assert.equal(sanitizeName("").ok, false);
  assert.equal(sanitizeName("shit").ok, false);
  assert.equal(sanitizeName("Ana-María").ok, true);
});

test("a score enters the top 10 only when it beats the tenth", () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({ score: 100 - i, created_at: `2026-01-${String(i + 1).padStart(2, "0")}` }));
  assert.equal(qualify(92, rows), true);
  assert.equal(qualify(91, rows), false);
  assert.equal(qualify(-10, rows.slice(0, 3)), true);
  assert.equal(scoreInBounds("daily", 30000), true);
  assert.equal(scoreInBounds("daily", 30001), false);
  assert.equal(scoreInBounds("portfolio", -100000), true);
  assert.equal(scoreInBounds("nope", 1), false);
});

test("the public Supabase project is configured", () => {
  const env = boardEnv();
  assert.equal(env.url, "https://uuyoxmmbhqlajcemlmlu.supabase.co");
  assert.equal(env.key.startsWith("sb_publishable_"), true);
  assert.equal(env.remote, true);
});

test("a missing leaderboard RPC is treated as not ready", () => {
  assert.equal(rpcUnavailable(404, { code: "PGRST202", message: "Could not find the function public.get_top10" }), true);
  assert.equal(rpcUnavailable(404, {}), true);
  assert.equal(rpcUnavailable(500, { message: "database error" }), false);
});
