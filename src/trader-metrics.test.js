import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  applyMonth,
  cagr,
  classifyLesson,
  conceptsUnlocked,
  cordobaDate,
  hashSeed,
  histogram,
  lastCloseByMonth,
  maxDrawdown,
  pickPuzzle,
  pickStartMonth,
  previousDate,
  sharpe,
  tradePnl,
  unpackSeries,
  windowCount,
} from "./trader-metrics.js";

test("buy, short, and hold score from the two real closes only", () => {
  assert.ok(Math.abs(tradePnl("buy", 100, 110, 1) - 0.1) < 1e-12);
  assert.ok(Math.abs(tradePnl("buy", 100, 110, 2) - 0.2) < 1e-12);
  assert.ok(Math.abs(tradePnl("sell", 100, 110, 1) + 0.1) < 1e-12);
  assert.ok(Math.abs(tradePnl("sell", 50, 40, 3) - 0.6) < 1e-12);
  assert.equal(tradePnl("hold", 50, 80, 3), 0);
  assert.throws(() => tradePnl("buy", 10, 12, 4));
  assert.throws(() => tradePnl("fold", 10, 12, 1));
});

test("the daily seed is stable and stays inside the series", () => {
  const symbols = {
    BBB: { c: Array.from({ length: 200 }, (_, i) => 50 + i) },
    AAA: { c: Array.from({ length: 220 }, (_, i) => 100 + i * 0.5) },
  };
  const first = pickPuzzle(symbols, "daily:2026-11-11");
  const again = pickPuzzle(symbols, "daily:2026-11-11");
  assert.deepEqual(first, again);
  assert.ok(windowCount(symbols[first.symbol].c.length) > first.start);
  assert.notDeepEqual(first, pickPuzzle(symbols, "daily:2026-11-12"));
  assert.equal(hashSeed("daily:2026-11-11"), hashSeed("daily:2026-11-11"));
});

test("Córdoba date uses America/Argentina/Cordoba", () => {
  assert.equal(cordobaDate(new Date("2026-11-11T01:30:00Z")), "2026-11-10");
  assert.equal(cordobaDate(new Date("2026-11-11T15:00:00Z")), "2026-11-11");
  assert.equal(previousDate("2026-03-01"), "2026-02-28");
});

test("CAGR, drawdown, and Sharpe match the definitions", () => {
  assert.ok(Math.abs(cagr(100, 121, 2) - 0.1) < 1e-12);
  assert.equal(cagr(100, 50, 0), null);
  assert.equal(maxDrawdown([100, 120, 90, 110]), (90 - 120) / 120);
  assert.equal(maxDrawdown([10, 11, 12]), 0);
  const flat = sharpe([0.01, 0.01, 0.01]);
  assert.equal(flat, null);
  const mixed = sharpe([0.02, -0.01, 0.03, 0]);
  assert.ok(mixed > 0);
  const negative = sharpe([-0.02, -0.01, -0.03]);
  assert.ok(negative < 0);
});

test("a month step uses only the supplied returns", () => {
  const next = applyMonth(10000, { SPY: 0.5, CASH: 0.5 }, { SPY: 0.1 });
  assert.equal(next, 10500);
  assert.throws(() => applyMonth(10000, { SPY: 0.5, CASH: 0.4 }, { SPY: 0.1 }));
});

test("month map keeps the last close, and start months stay in 1999-2020", () => {
  const map = lastCloseByMonth(["1999-01-04", "1999-01-29", "1999-02-26"], [10, 12, 11]);
  assert.equal(map.get("1999-01"), 12);
  assert.equal(map.get("1999-02"), 11);
  const months = ["1998-12", "1999-01", "2010-06", "2020-12", "2021-01"];
  const picked = pickStartMonth(months, "run-1");
  assert.ok(picked >= "1999-01" && picked <= "2020-12");
  assert.equal(picked, pickStartMonth(months, "run-1"));
});

test("a rising window is not labeled as a crash", () => {
  const prior = Array.from({ length: 120 }, () => 100);
  const forward = [100, 101, 102, 103, 104];
  const lesson = classifyLesson({
    symbol: "SPY",
    kind: "etf",
    prior,
    forward,
    entry: 100,
    exit: 104,
    decisionDate: "2008-10-01",
    exitDate: "2008-11-01",
  });
  assert.equal(lesson.event, null);
});

test("one glossary concept unlocks per Córdoba day", () => {
  assert.equal(conceptsUnlocked(null, "2026-11-11"), 1);
  assert.equal(conceptsUnlocked("2026-11-11", "2026-11-11"), 1);
  assert.equal(conceptsUnlocked("2026-11-11", "2026-11-13"), 3);
});

test("histogram counts every result once", () => {
  assert.deepEqual(histogram([-0.5, -0.1, 0, 0.04, 0.25]), [1, 0, 1, 1, 1, 0, 1]);
});

test("bundled Yahoo series are ordered and strictly positive", () => {
  const doc = JSON.parse(fs.readFileSync(new URL("../data/market.json", import.meta.url), "utf8"));
  assert.equal(doc.source, "Yahoo Finance");
  assert.equal(doc.field, "adjclose");
  assert.ok(Object.keys(doc.symbols).length >= 50);
  for (const symbol of ["AAPL", "MSFT", "SPY", "QQQ", "GLD", "TLT", "^GSPC", "BTC-USD"]) {
    const series = unpackSeries(doc.symbols[symbol]);
    assert.equal(series.dates.length, series.closes.length);
    assert.ok(series.closes.length > 200, symbol);
    assert.ok(series.closes.every((price) => price > 0), symbol);
    for (let i = 1; i < series.dates.length; i += 1) {
      assert.ok(series.dates[i] > series.dates[i - 1], symbol);
    }
  }
  const apple = unpackSeries(doc.symbols.AAPL);
  assert.equal(apple.dates[0], "1990-01-02");
});
