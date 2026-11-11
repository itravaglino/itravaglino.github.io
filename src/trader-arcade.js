/** Fast stack-and-race mode. Every price comes from the caller. Nothing here is random. */

import { sma } from "./trader-score.js";
import { annualizedVol, hashSeed, mulberry32, unpackSeries } from "./trader-metrics.js";

export const WINDOWS = [
  { id: "5y", days: 1260 },
  { id: "2y", days: 504 },
  { id: "1y", days: 252 },
  { id: "6m", days: 126 },
  { id: "1m", days: 21 },
];

export const CARD_IDS = ["hold", "trend", "dip", "stop", "take", "lev", "mix", "cash"];

const STOP = 0.08;
const TAKE = 0.15;
const COOL = 10;
const VOL_CUT = 0.4;
const WARM = 60;
const COMPANIONS = ["SPY", "QQQ", "GLD", "TLT", "AAPL", "MSFT", "KO", "JNJ", "XOM", "WMT"];

export function scoreLevel({ ret, benchRet, maxDD, days, streak }) {
  const years = days / 252;
  const speed = ret / years;
  const risk = 1 + Math.max(0, maxDD);
  const base = Math.round((speed / risk) * 400);
  const beat = ret > benchRet + 1e-9;
  const prior = Math.max(0, streak || 0);
  const multiplier = 1 + 0.25 * Math.min(prior, 4);
  let points = base;
  if (beat) {
    if (points > 0) points = Math.round(points * multiplier);
    else points += 150;
  }
  points = Math.max(-8000, Math.min(8000, points));
  return {
    points,
    base,
    beat,
    multiplier: beat && base > 0 ? multiplier : 1,
    nextStreak: beat ? Math.min(prior + 1, 5) : 0,
  };
}

export function scoreRun(points) {
  const total = points.reduce((sum, value) => sum + value, 0);
  return Math.max(-20000, Math.min(30000, total));
}

function signalWant(cards, closes, s20, s50, idx) {
  let want = true;
  if (cards.includes("trend")) want = s20[idx] != null && s50[idx] != null && s20[idx] > s50[idx];
  if (cards.includes("dip")) want = want && s20[idx] != null && closes[idx] < s20[idx];
  if (cards.includes("cash") && idx >= 21) {
    const vol = annualizedVol(closes.slice(idx - 20, idx + 1));
    if (vol != null && vol >= VOL_CUT) return { want: false, hot: true };
  }
  return { want, hot: false };
}

export function simulateLevel(level, cards) {
  const list = Array.isArray(cards) ? cards : [];
  const { closes, start, days } = level;
  const companions = list.includes("mix") ? level.companions || [] : [];
  const s20 = sma(closes, 20);
  const s50 = sma(closes, 50);
  const useStop = list.includes("stop");
  const useTake = list.includes("take");
  const useLev = list.includes("lev");
  const equity = [1];
  const bench = [1];
  let exposure = 0;
  let entry = null;
  let cool = 0;
  const first = signalWant(list, closes, s20, s50, start - 1);
  if (first.want) {
    exposure = useLev ? 2 : 1;
    entry = closes[start - 1];
  }
  let peak = 1;
  let benchPeak = 1;
  let maxDD = 0;
  let benchDD = 0;
  let stopped = false;
  let took = false;
  let highVolDays = first.hot ? 1 : 0;

  for (let i = 0; i < days; i += 1) {
    const idx = start + i;
    const prev = closes[idx - 1];
    const price = closes[idx];
    const assetRet = price / prev - 1;
    const parts = [assetRet];
    for (const companion of companions) {
      if (companion.rets[i] != null) parts.push(companion.rets[i]);
    }
    let basket = parts.reduce((sum, value) => sum + value, 0) / parts.length;
    if (exposure > 0 && entry != null && useStop && price <= entry * (1 - STOP)) {
      basket = (parts.length === 1 ? entry * (1 - STOP) / prev - 1 : blendFill(entry * (1 - STOP) / prev - 1, parts));
      stopped = true;
    } else if (exposure > 0 && entry != null && useTake && price >= entry * (1 + TAKE)) {
      basket = (parts.length === 1 ? entry * (1 + TAKE) / prev - 1 : blendFill(entry * (1 + TAKE) / prev - 1, parts));
      took = true;
    }
    const applied = exposure > 0 ? Math.max(-0.95, exposure * basket) : 0;
    const nextEq = equity[equity.length - 1] * (1 + applied);
    const nextBench = bench[bench.length - 1] * (1 + assetRet);
    equity.push(nextEq);
    bench.push(nextBench);
    peak = Math.max(peak, nextEq);
    benchPeak = Math.max(benchPeak, nextBench);
    maxDD = Math.max(maxDD, (peak - nextEq) / peak);
    benchDD = Math.max(benchDD, (benchPeak - nextBench) / benchPeak);

    let nextWant = false;
    let hot = false;
    if (stopped || took) cool = COOL;
    if (cool > 0) {
      cool -= 1;
      nextWant = false;
    } else {
      const next = signalWant(list, closes, s20, s50, idx);
      nextWant = next.want;
      hot = next.hot;
      if (hot) highVolDays += 1;
    }
    const nextExposure = nextWant ? (useLev ? 2 : 1) : 0;
    if (exposure === 0 && nextExposure > 0) entry = price;
    if (nextExposure === 0) entry = null;
    if (stopped || took) {
      entry = null;
    }
    exposure = nextExposure;
    stopped = false;
    took = false;
  }

  return {
    equity,
    bench,
    ret: equity[equity.length - 1] - 1,
    benchRet: bench[bench.length - 1] - 1,
    maxDD,
    benchDD,
    days,
    highVolDays,
    stopped: equity.length > 0 && list.includes("stop") && maxDD + 1e-9 < benchDD,
    took: list.includes("take") && equity[equity.length - 1] < bench[bench.length - 1],
  };
}

function blendFill(primaryRet, parts) {
  const rest = parts.slice(1);
  const all = [primaryRet, ...rest];
  return all.reduce((sum, value) => sum + value, 0) / all.length;
}

export function lessonKey(cards, sim) {
  const list = cards || [];
  const beat = sim.ret > sim.benchRet + 1e-9;
  if (list.includes("lev") && sim.ret < 0 && sim.ret < sim.benchRet) return "lev-pain";
  if (list.includes("lev") && beat && sim.ret > 0) return "lev-win";
  if (list.includes("stop") && !beat && sim.benchRet > 0) return "stop-cut";
  if (list.includes("stop") && sim.maxDD + 0.02 < sim.benchDD) return "stop-save";
  if (list.includes("take") && sim.took && sim.benchRet > sim.ret) return "take-lock";
  if (list.includes("cash") && sim.highVolDays > 2 && beat) return "cash-out";
  if (list.includes("dip") && beat) return "dip-win";
  if (list.includes("dip") && !beat) return "dip-miss";
  if (list.includes("trend") && beat) return "trend-win";
  if (list.includes("trend") && !beat) return "trend-miss";
  if (list.includes("mix") && sim.maxDD + 0.005 < sim.benchDD) return "mix-smooth";
  if (list.includes("mix") && !beat) return "mix-miss";
  return beat ? "hold-win" : "hold-lose";
}

function companionReturns(dates, prevDate, series) {
  const map = new Map(series.dates.map((date, index) => [date, series.closes[index]]));
  if (!map.has(prevDate)) return null;
  let prev = map.get(prevDate);
  const rets = [];
  for (const date of dates) {
    const close = map.get(date);
    if (!(close > 0) || !(prev > 0)) return null;
    rets.push(close / prev - 1);
    prev = close;
  }
  return rets;
}

export function pickLevels(symbols, seedKey) {
  const book = {};
  for (const symbol of Object.keys(symbols).sort()) {
    book[symbol] = unpackSeries(symbols[symbol]);
  }
  const used = new Set();
  return WINDOWS.map((window) => {
    const rng = mulberry32(hashSeed(`${seedKey}:${window.id}`));
    const eligible = Object.keys(book)
      .filter((symbol) => book[symbol].closes.length >= window.days + WARM)
      .sort();
    if (!eligible.length) throw new Error(`no series for ${window.id}`);
    let symbol = eligible[Math.floor(rng() * eligible.length)];
    for (let attempt = 0; attempt < 6 && used.has(symbol); attempt += 1) {
      symbol = eligible[Math.floor(rng() * eligible.length)];
    }
    used.add(symbol);
    const series = book[symbol];
    const room = series.closes.length - window.days - WARM;
    const start = WARM + Math.floor(rng() * Math.max(room, 1));
    const end = start + window.days - 1;
    const dates = series.dates.slice(start, end + 1);
    const prevDate = series.dates[start - 1];
    const companions = [];
    const pool = COMPANIONS.filter((name) => name !== symbol && book[name]);
    const order = pool
      .map((name) => ({ name, roll: rng() }))
      .sort((a, b) => a.roll - b.roll || a.name.localeCompare(b.name));
    for (const item of order) {
      if (companions.length >= 2) break;
      const rets = companionReturns(dates, prevDate, book[item.name]);
      if (rets) companions.push({ symbol: item.name, rets });
    }
    return {
      id: window.id,
      days: window.days,
      symbol,
      name: series.name,
      startDate: series.dates[start],
      endDate: series.dates[end],
      closes: series.closes,
      start,
      companions,
    };
  });
}
