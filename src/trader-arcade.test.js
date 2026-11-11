import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { lessonKey, pickLevels, scoreLevel, scoreRun, simulateLevel, WINDOWS } from "./trader-arcade.js";

function ramp(n, step) {
  const closes = [];
  let price = 100;
  for (let i = 0; i < n; i += 1) {
    closes.push(price);
    price *= 1 + step;
  }
  return closes;
}

test("a shorter window pays more for the same return", () => {
  const month = scoreLevel({ ret: 0.1, benchRet: 0, maxDD: 0.05, days: 21, streak: 0 });
  const years = scoreLevel({ ret: 0.1, benchRet: 0, maxDD: 0.05, days: 1260, streak: 0 });
  assert.ok(month.points > years.points * 10);
  assert.equal(month.beat, true);
  const streaked = scoreLevel({ ret: 0.1, benchRet: 0, maxDD: 0.05, days: 21, streak: 2 });
  assert.equal(streaked.multiplier, 1.5);
  assert.equal(streaked.points, Math.round(month.base * 1.5));
  assert.equal(streaked.nextStreak, 3);
  assert.equal(scoreLevel({ ret: -0.2, benchRet: 0.1, maxDD: 0.3, days: 21, streak: 3 }).nextStreak, 0);
  assert.equal(scoreRun([20000, 20000]), 30000);
  assert.equal(scoreRun([-9000, -9000, -9000]), -20000);
});

test("buy and hold tracks the real closes, a dip sits out a climb, leverage magnifies", () => {
  const closes = ramp(160, 0.002);
  const level = { closes, start: 60, days: 40, companions: [] };
  const held = simulateLevel(level, ["hold"]);
  const manual = closes[99] / closes[59] - 1;
  assert.ok(Math.abs(held.ret - manual) < 1e-9);
  assert.ok(Math.abs(held.benchRet - manual) < 1e-9);
  const dip = simulateLevel(level, ["dip"]);
  assert.ok(Math.abs(dip.ret) < 0.01);
  const lever = simulateLevel(level, ["lev"]);
  assert.ok(lever.ret > held.ret * 1.8);
});

test("a stop fills above a crash close and loses less than holding", () => {
  const closes = ramp(80, 0.001);
  const last = closes[closes.length - 1];
  closes.push(last * 0.7);
  const level = { closes, start: 60, days: closes.length - 60, companions: [] };
  const held = simulateLevel(level, ["hold"]);
  const stopped = simulateLevel(level, ["stop"]);
  assert.ok(stopped.ret > held.ret);
  assert.ok(stopped.maxDD < held.maxDD);
  assert.equal(lessonKey(["stop"], stopped), "stop-save");
});

test("the daily levels are real windows and stay inside the file", () => {
  const doc = JSON.parse(readFileSync(new URL("../public/data/market.json", import.meta.url), "utf8"));
  const first = pickLevels(doc.symbols, "daily:2026-11-11");
  const again = pickLevels(doc.symbols, "daily:2026-11-11");
  assert.deepEqual(first.map((level) => [level.symbol, level.startDate, level.endDate]), again.map((level) => [level.symbol, level.startDate, level.endDate]));
  assert.deepEqual(first.map((level) => level.days), WINDOWS.map((window) => window.days));
  for (const level of first) {
    assert.equal(level.endDate > level.startDate, true);
    assert.ok(level.closes[level.start] > 0);
    assert.ok(level.closes[level.start + level.days - 1] > 0);
    const sim = simulateLevel(level, ["hold", "trend", "stop"]);
    assert.equal(sim.equity.length, level.days + 1);
    assert.ok(Number.isFinite(sim.ret));
  }
  assert.notEqual(pickLevels(doc.symbols, "daily:2026-11-12")[0].startDate, first[0].startDate);
});
