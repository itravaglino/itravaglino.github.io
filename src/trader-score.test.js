import assert from "node:assert/strict";
import test from "node:test";
import {
  SCORE,
  applyRiskChoice,
  driftedWeights,
  eventForMonth,
  freshPosition,
  portfolioScore,
  rankBand,
  rsi,
  scoreRound,
  sessionScore,
  sma,
  stepPosition,
  visibleHint,
} from "./trader-score.js";

test("a stop fills at the stop and the gap still counts as adverse", () => {
  const bars = [80];
  const opened = stepPosition(freshPosition(), 100, [], { action: "buy", size: 1, stopPct: 0.05, takePct: 0 });
  const stepped = stepPosition(opened.state, 100, bars, { action: "hold", size: 1, stopPct: null, takePct: null });
  assert.equal(stepped.reason, "stop");
  assert.ok(Math.abs(stepped.state.pnl + 0.05) < 1e-12);
  assert.ok(Math.abs(stepped.state.mae - 0.2) < 1e-12);
  assert.equal(stepped.state.stoppedOut, true);
});

test("stop wins when the same close also crosses the target", () => {
  const opened = stepPosition(freshPosition(), 100, [], { action: "buy", size: 1, stopPct: 0.05, takePct: 0.05 });
  const stepped = stepPosition(opened.state, 100, [110], { action: "hold", size: 1, stopPct: null, takePct: null });
  assert.equal(stepped.reason, "take");
  const both = stepPosition(opened.state, 100, [70], { action: "hold", size: 1, stopPct: null, takePct: null });
  assert.equal(both.reason, "stop");
  assert.ok(both.state.pnl < 0);
});

test("adding blends the entry and a flat step scores zero", () => {
  const opened = stepPosition(freshPosition(), 100, [], { action: "buy", size: 1, stopPct: 0, takePct: 0 });
  const added = stepPosition(opened.state, 110, [], { action: "add", size: 1, stopPct: 0, takePct: 0 });
  assert.equal(added.state.size, 2);
  assert.ok(Math.abs(added.state.entry - 105) < 1e-12);
  const flat = stepPosition(freshPosition(), 100, [110, 120, 130, 140, 150], { action: "flat", size: 1, stopPct: 0, takePct: 0 });
  assert.equal(flat.state.pnl, 0);
});

test("round score matches the documented pieces", () => {
  const scored = scoreRound({ pnl: 0.1, mae: 0, stopSet: false, stoppedOut: false, hints: 0, elapsedSec: 10, winStreak: 0 });
  assert.equal(scored.pnlPoints, 100);
  assert.equal(scored.directionBonus, SCORE.directionBonus);
  assert.equal(scored.timeBonus, SCORE.timeBonus);
  assert.equal(scored.hintPenalty, 0);
  assert.equal(scored.discipline, 0);
  assert.equal(scored.total, 100 + 150 + 50);
  const hinted = scoreRound({ pnl: 0.1, mae: 0.1, stopSet: false, stoppedOut: false, hints: 1, elapsedSec: 40, winStreak: 2 });
  assert.equal(hinted.pnlPoints, Math.round((0.1 / 1.1) * 1000));
  assert.equal(hinted.discipline, -SCORE.noStopPenalty);
  assert.equal(hinted.hintPenalty, SCORE.hintCost);
  assert.equal(hinted.timeBonus, 0);
  assert.equal(hinted.multiplier, 1 + SCORE.streakStep * 2);
  assert.equal(hinted.total, Math.round(hinted.subtotal * hinted.multiplier));
  const stopped = scoreRound({ pnl: -0.05, mae: 0.2, stopSet: true, stoppedOut: true, hints: 0, elapsedSec: 5, winStreak: 4 });
  assert.equal(stopped.discipline, SCORE.stopHitBonus);
  assert.equal(stopped.multiplier, 1.2);
  assert.equal(sessionScore([scored.total, stopped.total]), scored.total + stopped.total);
});

test("SMA, RSI, and the hint ignore the future", () => {
  assert.deepEqual(sma([1, 2, 3, 4], 2).slice(1), [1.5, 2.5, 3.5]);
  const series = [10, 11, 12, 13, 14, 15, 16, 15, 14, 13, 12, 11, 10, 9, 8];
  const values = rsi(series, 14);
  assert.equal(values[13], null);
  assert.ok(values[14] > 0 && values[14] < 100);
  const hint = visibleHint(Array.from({ length: 30 }, (_, i) => 100 + i));
  assert.equal(hint.id.startsWith("up"), true);
  assert.ok(hint.ret > 0);
});

test("portfolio drift, risk shift, and rank use only the inputs", () => {
  const drifted = driftedWeights({ SPY: 0.5, CASH: 0.5 }, { SPY: 1 });
  assert.ok(Math.abs(drifted.SPY - 2 / 3) < 1e-12);
  assert.ok(Math.abs(drifted.CASH - 1 / 3) < 1e-12);
  const cut = applyRiskChoice({ SPY: 0.4, QQQ: 0.1, CASH: 0.5 }, "cut");
  assert.ok(Math.abs(cut.SPY - 0.24) < 1e-12);
  assert.ok(Math.abs(cut.CASH - 0.7) < 1e-12);
  const score = portfolioScore({
    excessReturn: 0.2,
    vol: 0,
    maxDrawdown: -0.1,
    rebalanceEvents: [{ drift: 0.12, didRebalance: true }, { drift: 0.01, didRebalance: true }],
  });
  assert.equal(score, Math.round(200 - 50 + 30 - 10));
  assert.equal(rankBand(score), "ahead");
  assert.equal(rankBand(0), "close");
  assert.equal(eventForMonth("2008-09").id, "lehman");
  assert.equal(eventForMonth("2014-06"), null);
});
