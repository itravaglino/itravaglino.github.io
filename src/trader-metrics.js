/** Pure scoring, seeding, and series helpers for /trader/. Prices passed in are caller data. */

export const LOOKBACK = 120;
export const HORIZON = 20;
export const START_CASH = 10000;

const EVENTS = [
  { id: "dotcom", start: "2000-03-10", end: "2002-10-09", dir: -1, kinds: ["stock", "etf", "index"] },
  { id: "gfc", start: "2008-09-15", end: "2009-03-09", dir: -1, kinds: ["stock", "etf", "index"] },
  { id: "covid", start: "2020-02-19", end: "2020-03-23", dir: -1, kinds: ["stock", "etf", "index", "crypto"] },
  { id: "rates2022", start: "2022-01-03", end: "2022-10-14", dir: -1, symbols: ["TLT", "QQQ", "NVDA", "TSLA", "META", "AMZN", "NFLX", "GOOGL", "ADBE", "CRM"] },
];

export function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function cordobaDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Cordoba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function previousDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

export function unpackSeries(entry) {
  const y = Math.floor(entry.t0 / 10000);
  const m = Math.floor((entry.t0 % 10000) / 100);
  const d = entry.t0 % 100;
  let cursor = Date.UTC(y, m - 1, d);
  const dates = [];
  const closes = [];
  for (let i = 0; i < entry.c.length; i += 1) {
    cursor += entry.g[i] * 86400000;
    dates.push(new Date(cursor).toISOString().slice(0, 10));
    closes.push(entry.c[i]);
  }
  return { dates, closes, name: entry.name, kind: entry.kind };
}

export function windowCount(length) {
  const need = LOOKBACK + HORIZON;
  return length >= need ? length - need + 1 : 0;
}

export function pickPuzzle(symbols, seedKey) {
  const keys = Object.keys(symbols)
    .filter((key) => windowCount(symbols[key].c.length) > 0)
    .sort();
  if (!keys.length) throw new Error("no series");
  const rng = mulberry32(hashSeed(seedKey));
  const symbol = keys[Math.floor(rng() * keys.length)];
  const count = windowCount(symbols[symbol].c.length);
  const start = Math.floor(rng() * count);
  return { symbol, start };
}

export function puzzleSlice(entry, start) {
  const { dates, closes, name, kind } = unpackSeries(entry);
  const entryAt = start + LOOKBACK - 1;
  const exitAt = entryAt + HORIZON;
  if (exitAt >= closes.length) throw new Error("window past end");
  const warmStart = Math.max(0, start - 60);
  return {
    name,
    kind,
    warmup: closes.slice(warmStart, start),
    prior: closes.slice(start, entryAt + 1),
    forward: closes.slice(entryAt, exitAt + 1),
    priorStart: dates[start],
    decisionDate: dates[entryAt],
    exitDate: dates[exitAt],
    entry: closes[entryAt],
    exit: closes[exitAt],
  };
}

export function tradePnl(action, entry, exitPrice, size = 1) {
  if (!(entry > 0) || !(exitPrice > 0)) throw new Error("bad price");
  if (![1, 2, 3].includes(size)) throw new Error("bad size");
  const ret = exitPrice / entry - 1;
  if (action === "hold") return 0;
  if (action === "buy") return size * ret;
  if (action === "sell") return size * -ret;
  throw new Error("bad action");
}

export function annualizedVol(closes) {
  if (!closes || closes.length < 3) return null;
  const rets = [];
  for (let i = 1; i < closes.length; i += 1) rets.push(closes[i] / closes[i - 1] - 1);
  const mean = rets.reduce((sum, value) => sum + value, 0) / rets.length;
  const variance = rets.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252);
}

export function maxDayMove(closes) {
  let move = 0;
  for (let i = 1; i < closes.length; i += 1) {
    const day = closes[i] / closes[i - 1] - 1;
    if (Math.abs(day) > Math.abs(move)) move = day;
  }
  return move;
}

export function eventFor(kind, symbol, fromIso, toIso, forwardReturn) {
  for (const event of EVENTS) {
    if (event.symbols && !event.symbols.includes(symbol)) continue;
    if (event.kinds && !event.kinds.includes(kind)) continue;
    if (toIso < event.start || fromIso > event.end) continue;
    if (event.dir && Math.sign(forwardReturn) !== event.dir) continue;
    return event.id;
  }
  return null;
}

export function classifyLesson(slice) {
  const priorRet = slice.prior[slice.prior.length - 1] / slice.prior[0] - 1;
  const fwd = slice.exit / slice.entry - 1;
  const vol = annualizedVol(slice.forward);
  const day = maxDayMove(slice.forward);
  let id = "path";
  if (Math.abs(day) >= 0.08) id = "shock";
  else if (vol != null && vol >= 0.45) id = "wild";
  else if (vol != null && vol < 0.12) id = "quiet";
  else if (priorRet * fwd < 0 && Math.abs(priorRet) > 0.05 && Math.abs(fwd) > 0.03) id = "reversion";
  else if (priorRet * fwd > 0 && Math.abs(priorRet) > 0.06 && Math.abs(fwd) > 0.02) id = "trend";
  return {
    id,
    priorRet,
    fwd,
    vol,
    day,
    event: eventFor(slice.kind, slice.symbol, slice.decisionDate, slice.exitDate, fwd),
  };
}

export function cagr(startValue, endValue, years) {
  if (!(startValue > 0) || !(endValue > 0) || !(years > 0)) return null;
  return (endValue / startValue) ** (1 / years) - 1;
}

export function maxDrawdown(values) {
  if (!values.length) return null;
  let peak = values[0];
  let worst = 0;
  for (const value of values) {
    if (value > peak) peak = value;
    const drop = peak > 0 ? (value - peak) / peak : 0;
    if (drop < worst) worst = drop;
  }
  return worst;
}

export function monthlyReturns(values) {
  const out = [];
  for (let i = 1; i < values.length; i += 1) out.push(values[i] / values[i - 1] - 1);
  return out;
}

export function annualizedVolMonthly(returns) {
  if (!returns || returns.length < 2) return null;
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(12);
}

export function sharpe(returns, rfAnnual = 0) {
  if (!returns || returns.length < 2) return null;
  const rf = (1 + rfAnnual) ** (1 / 12) - 1;
  const excess = returns.map((value) => value - rf);
  const mean = excess.reduce((sum, value) => sum + value, 0) / excess.length;
  const variance = excess.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (excess.length - 1);
  const sd = Math.sqrt(variance);
  if (sd === 0) return null;
  return (mean / sd) * Math.sqrt(12);
}

export function applyMonth(value, weights, returns) {
  let growth = 0;
  let used = 0;
  for (const [key, weight] of Object.entries(weights)) {
    if (weight < 0) throw new Error("bad weight");
    used += weight;
    const ret = key === "CASH" ? 0 : returns[key];
    if (weight > 0 && !Number.isFinite(ret)) throw new Error("missing return");
    growth += weight * (1 + (ret || 0));
  }
  if (Math.abs(used - 1) > 1e-6) throw new Error("weights must sum to 1");
  return value * growth;
}

export function lastCloseByMonth(dates, closes) {
  const out = new Map();
  for (let i = 0; i < dates.length; i += 1) out.set(dates[i].slice(0, 7), closes[i]);
  return out;
}

export function nextMonth(yyyymm) {
  let y = Number(yyyymm.slice(0, 4));
  let m = Number(yyyymm.slice(5, 7)) + 1;
  if (m === 13) {
    m = 1;
    y += 1;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function pickStartMonth(months, seedKey) {
  const pool = months.filter((month) => month >= "1999-01" && month <= "2020-12");
  if (!pool.length) throw new Error("no months");
  const rng = mulberry32(hashSeed(seedKey));
  return pool[Math.floor(rng() * pool.length)];
}

export function shareCells(forward) {
  const steps = forward.length - 1;
  const buckets = 4;
  const cells = [];
  for (let i = 0; i < buckets; i += 1) {
    const from = Math.round((steps * i) / buckets);
    const to = Math.round((steps * (i + 1)) / buckets);
    const move = forward[to] / forward[from] - 1;
    cells.push(move > 0.002 ? "up" : move < -0.002 ? "down" : "flat");
  }
  return cells;
}

export function histogram(values) {
  const edges = [-Infinity, -0.2, -0.1, -0.03, 0.03, 0.1, 0.2, Infinity];
  const counts = Array(edges.length - 1).fill(0);
  for (const value of values) {
    for (let i = 0; i < counts.length; i += 1) {
      if (value >= edges[i] && value < edges[i + 1]) {
        counts[i] += 1;
        break;
      }
    }
  }
  return counts;
}

export const CONCEPTS = [
  "long",
  "short",
  "hold",
  "size",
  "return",
  "trend",
  "reversion",
  "volatility",
  "drawdown",
  "cagr",
  "sharpe",
  "benchmark",
  "rebalance",
  "survivorship",
];

export function conceptsUnlocked(learnStart, today) {
  if (!learnStart) return 1;
  const start = Date.parse(`${learnStart}T00:00:00Z`);
  const end = Date.parse(`${today}T00:00:00Z`);
  const days = Math.floor((end - start) / 86400000) + 1;
  return Math.max(1, Math.min(CONCEPTS.length, days));
}
