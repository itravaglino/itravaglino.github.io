/** Deterministic scoring for /trader/. Prices and decisions are inputs; nothing here is random. */

import { annualizedVol, pickPuzzle } from "./trader-metrics.js";

export const SCORE = {
  pnlScale: 1000,
  directionBonus: 150,
  stopHitBonus: 80,
  stopHeldBonus: 40,
  noStopMae: 0.08,
  noStopPenalty: 40,
  hintCost: 120,
  timeLimitSec: 20,
  timeBonus: 50,
  streakStep: 0.05,
  streakCap: 5,
  rounds: 5,
  steps: 4,
  stepLen: 5,
  dailyMin: -20000,
  dailyMax: 30000,
  portfolioMin: -100000,
  portfolioMax: 100000,
  rebalanceWide: 0.1,
  rebalanceTight: 0.05,
  rebalanceBonus: 30,
  rebalancePenalty: 10,
  drawdownWeight: 500,
};

export const EQUITY = ["SPY", "QQQ", "KO", "MSFT"];

export const MONTH_EVENTS = [
  { id: "dotcom-peak", month: "2000-03" },
  { id: "sep11", month: "2001-09" },
  { id: "bear-stearns", month: "2008-03" },
  { id: "lehman", month: "2008-09" },
  { id: "gfc-bottom", month: "2009-03" },
  { id: "us-downgrade", month: "2011-08" },
  { id: "covid-feb", month: "2020-02" },
  { id: "covid-mar", month: "2020-03" },
  { id: "fed-hike-2022", month: "2022-03" },
];

export function sessionPicks(symbols, seedKey) {
  const used = new Set();
  const picks = [];
  for (let i = 0; i < SCORE.rounds; i += 1) {
    let extra = 0;
    let pick = pickPuzzle(symbols, `${seedKey}:${i}`);
    while (used.has(`${pick.symbol}:${pick.start}`) && extra < 6) {
      extra += 1;
      pick = pickPuzzle(symbols, `${seedKey}:${i}:${extra}`);
    }
    used.add(`${pick.symbol}:${pick.start}`);
    picks.push(pick);
  }
  return picks;
}

export function eventForMonth(month) {
  return MONTH_EVENTS.find((event) => event.month === month) || null;
}

export function sma(values, period) {
  return values.map((_, index) => {
    if (index + 1 < period) return null;
    let sum = 0;
    for (let i = index + 1 - period; i <= index; i += 1) sum += values[i];
    return sum / period;
  });
}

export function rsi(values, period = 14) {
  const out = values.map(() => null);
  if (values.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i += 1) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  gain /= period;
  loss /= period;
  const write = (index) => {
    if (loss === 0) out[index] = 100;
    else {
      const rs = gain / loss;
      out[index] = 100 - 100 / (1 + rs);
    }
  };
  write(period);
  for (let i = period + 1; i < values.length; i += 1) {
    const diff = values[i] - values[i - 1];
    const up = diff > 0 ? diff : 0;
    const down = diff < 0 ? -diff : 0;
    gain = (gain * (period - 1) + up) / period;
    loss = (loss * (period - 1) + down) / period;
    write(i);
  }
  return out;
}

export function visibleHint(prior) {
  const ret = prior[prior.length - 1] / prior[0] - 1;
  const vol = annualizedVol(prior) || 0;
  let id = "flat";
  if (ret > 0.08) id = "up";
  else if (ret < -0.08) id = "down";
  if (vol >= 0.35) id = `${id}-wild`;
  return { id, ret, vol };
}

export function freshPosition() {
  return {
    side: 0,
    size: 0,
    entry: null,
    stop: null,
    take: null,
    pnl: 0,
    mae: 0,
    stopSet: false,
    stoppedOut: false,
  };
}

function clonePosition(state) {
  return { ...state };
}

function realize(state, exitPrice, units = state.size) {
  state.pnl += state.side * (exitPrice / state.entry - 1) * units;
}

function setLevels(state, decision) {
  if (state.side === 0 || state.entry == null) {
    state.stop = null;
    state.take = null;
    return;
  }
  if (decision.stopPct > 0) {
    state.stop = state.entry * (1 - state.side * decision.stopPct);
    state.stopSet = true;
  } else if (decision.stopPct === 0) state.stop = null;
  if (decision.takePct > 0) state.take = state.entry * (1 + state.side * decision.takePct);
  else if (decision.takePct === 0) state.take = null;
}

function openAt(state, side, price, decision) {
  state.side = side;
  state.size = decision.size;
  state.entry = price;
  setLevels(state, decision);
}

/**
 * Apply one decision at `price`, then walk the next closes.
 * A stop and a target on the same close: the stop fills.
 * The fill price is the stop or target. MAE still uses the daily close, including a gap through the stop.
 */
export function stepPosition(state, price, bars, decision) {
  const next = clonePosition(state);
  const action = decision.action;
  if (!["buy", "sell", "flat", "hold", "add", "reduce", "close"].includes(action)) throw new Error("bad action");
  if (decision.size != null && ![1, 2, 3].includes(decision.size)) throw new Error("bad size");

  if (action === "close" || action === "flat") {
    if (next.side !== 0) realize(next, price);
    next.side = 0;
    next.size = 0;
    next.entry = null;
    next.stop = null;
    next.take = null;
  } else if (action === "hold") {
    if (next.side !== 0) setLevels(next, decision);
  } else if (action === "add") {
    if (next.side !== 0 && next.size < 3) {
      next.entry = (next.entry * next.size + price) / (next.size + 1);
      next.size += 1;
      setLevels(next, decision);
    }
  } else if (action === "reduce") {
    if (next.side !== 0 && next.size > 1) {
      realize(next, price, 1);
      next.size -= 1;
      setLevels(next, decision);
    } else if (next.side !== 0 && next.size === 1) {
      realize(next, price, 1);
      next.side = 0;
      next.size = 0;
      next.entry = null;
      next.stop = null;
      next.take = null;
    }
  } else if (action === "buy" || action === "sell") {
    const side = action === "buy" ? 1 : -1;
    if (next.side !== 0 && next.side !== side) realize(next, price);
    if (next.side === 0 || next.side !== side) openAt(next, side, price, decision);
    else setLevels(next, decision);
  }

  let reason = next.side === 0 ? "flat" : "open";
  for (const close of bars) {
    if (next.side === 0) break;
    const adverse = next.side === 1 ? (next.entry - close) / next.entry : (close - next.entry) / next.entry;
    if (adverse > next.mae) next.mae = adverse;
    const stopHit = next.stop != null && (next.side === 1 ? close <= next.stop : close >= next.stop);
    const takeHit = next.take != null && (next.side === 1 ? close >= next.take : close <= next.take);
    if (stopHit) {
      realize(next, next.stop);
      next.side = 0;
      next.size = 0;
      next.entry = null;
      next.stop = null;
      next.take = null;
      next.stoppedOut = true;
      reason = "stop";
      break;
    }
    if (takeHit) {
      realize(next, next.take);
      next.side = 0;
      next.size = 0;
      next.entry = null;
      next.stop = null;
      next.take = null;
      reason = "take";
      break;
    }
  }
  if (next.side !== 0 && bars.length) {
    const mark = bars[bars.length - 1];
    realize(next, mark);
    next.entry = mark;
    reason = "mark";
  }
  return { state: next, reason };
}

export function scoreRound({ pnl, mae, stopSet, stoppedOut, hints = 0, elapsedSec = 999, winStreak = 0 }) {
  const safeMae = Math.max(0, mae || 0);
  const pnlPoints = Math.round((pnl / (1 + safeMae)) * SCORE.pnlScale);
  const directionBonus = pnl > 0 ? SCORE.directionBonus : 0;
  let discipline = 0;
  if (stoppedOut) discipline = SCORE.stopHitBonus;
  else if (stopSet) discipline = SCORE.stopHeldBonus;
  else if (safeMae > SCORE.noStopMae) discipline = -SCORE.noStopPenalty;
  const hintPenalty = Math.max(0, hints) * SCORE.hintCost;
  const timeBonus = elapsedSec <= SCORE.timeLimitSec ? SCORE.timeBonus : 0;
  const subtotal = pnlPoints + directionBonus + discipline + timeBonus - hintPenalty;
  const streak = Math.max(0, Math.min(SCORE.streakCap, winStreak));
  const multiplier = subtotal > 0 ? 1 + SCORE.streakStep * streak : 1;
  const total = Math.round(subtotal * multiplier);
  return { pnlPoints, directionBonus, discipline, timeBonus, hintPenalty, multiplier, subtotal, total };
}

export function sessionScore(roundTotals) {
  return roundTotals.reduce((sum, value) => sum + value, 0);
}

export function driftedWeights(weights, returns) {
  const keys = Object.keys(weights);
  let sum = 0;
  const values = {};
  for (const key of keys) {
    const growth = key === "CASH" ? 1 : 1 + (returns[key] || 0);
    values[key] = weights[key] * growth;
    sum += values[key];
  }
  const out = {};
  for (const key of keys) out[key] = sum > 0 ? values[key] / sum : 0;
  return out;
}

export function maxDrift(actual, targets) {
  const keys = new Set([...Object.keys(actual), ...Object.keys(targets)]);
  let drift = 0;
  for (const key of keys) drift = Math.max(drift, Math.abs((actual[key] || 0) - (targets[key] || 0)));
  return drift;
}

export function applyRiskChoice(weights, choice) {
  const next = { ...weights };
  if (choice === "hold") return next;
  if (choice === "cut") {
    const equity = EQUITY.reduce((sum, key) => sum + (next[key] || 0), 0);
    const move = Math.min(0.2, equity);
    if (move <= 0) return next;
    for (const key of EQUITY) {
      const part = equity > 0 ? ((next[key] || 0) / equity) * move : 0;
      next[key] = (next[key] || 0) - part;
    }
    next.CASH = (next.CASH || 0) + move;
    return next;
  }
  if (choice === "add") {
    const move = Math.min(0.1, next.CASH || 0);
    next.CASH = (next.CASH || 0) - move;
    next.SPY = (next.SPY || 0) + move;
    return next;
  }
  throw new Error("bad choice");
}

export function portfolioScore({ excessReturn, vol = 0, maxDrawdown = 0, rebalanceEvents = [] }) {
  const risk = excessReturn / (1 + Math.max(0, vol || 0));
  let rebalance = 0;
  for (const event of rebalanceEvents) {
    if (event.didRebalance && event.drift >= SCORE.rebalanceWide) rebalance += SCORE.rebalanceBonus;
    else if (event.didRebalance && event.drift < SCORE.rebalanceTight) rebalance -= SCORE.rebalancePenalty;
  }
  return Math.round(risk * SCORE.pnlScale - Math.abs(maxDrawdown || 0) * SCORE.drawdownWeight + rebalance);
}

export function rankBand(score) {
  if (score >= 500) return "high";
  if (score >= 100) return "ahead";
  if (score >= -100) return "close";
  return "behind";
}
