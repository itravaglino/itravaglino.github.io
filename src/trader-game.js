import { initI18n, getLang } from "./i18n.js";
import { initTheme } from "./theme.js";
import { copy, fill, formatMoney, formatPct } from "./trader-copy.js";
import {
  CONCEPTS,
  HORIZON,
  START_CASH,
  applyMonth,
  annualizedVolMonthly,
  cagr,
  classifyLesson,
  conceptsUnlocked,
  cordobaDate,
  histogram,
  lastCloseByMonth,
  maxDrawdown,
  monthlyReturns,
  nextMonth,
  pickPuzzle,
  pickStartMonth,
  previousDate,
  puzzleSlice,
  shareCells,
  sharpe,
  tradePnl,
  unpackSeries,
} from "./trader-metrics.js";

const STORE = "it-trader";
const ASSETS = ["SPY", "QQQ", "GLD", "TLT", "KO", "MSFT"];
const TIMELINE = [
  { id: "dotcom", from: "2000-03", to: "2002-10" },
  { id: "gfc", from: "2008-09", to: "2009-03" },
  { id: "covid", from: "2020-02", to: "2020-03" },
  { id: "rebound", from: "2020-04", to: "2020-08" },
  { id: "rates", from: "2022-01", to: "2022-10" },
];
const BARS = ["< −20", "−20 – −10", "−10 – −3", "−3 – 3", "3 – 10", "10 – 20", "> 20"];

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const root = document.getElementById("trader-root");
const learnDialog = document.getElementById("learn-dialog");

let lang = getLang();
let pack = null;
let loadError = "";
let mode = "daily";
let choice = "buy";
let size = 1;
let reveal = 0;
let busy = false;
let practiceKey = "";
let run = null;
const months = {};

initI18n();
initTheme();
lang = getLang();

function text() {
  return copy[lang] || copy.en;
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORE)) || {};
  } catch {
    return {};
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORE, JSON.stringify(state));
  } catch {
    /* private mode */
  }
}

function today() {
  return cordobaDate();
}

function dailyKey() {
  return `daily:${today()}`;
}

function currentPuzzle() {
  if (!pack) return null;
  if (mode === "practice") {
    if (!practiceKey) practiceKey = `practice:${today()}:1`;
    const pick = pickPuzzle(pack.symbols, practiceKey);
    const slice = puzzleSlice(pack.symbols[pick.symbol], pick.start);
    slice.symbol = pick.symbol;
    return slice;
  }
  const pick = pickPuzzle(pack.symbols, dailyKey());
  const slice = puzzleSlice(pack.symbols[pick.symbol], pick.start);
  slice.symbol = pick.symbol;
  return slice;
}

function todayResult() {
  const state = loadState();
  return (state.results || []).find((row) => row.date === today()) || null;
}

function recordDaily(pnl, action, playedSize) {
  const state = loadState();
  const date = today();
  state.results = state.results || [];
  if (state.results.some((row) => row.date === date)) return state;
  const prev = previousDate(date);
  state.streak = state.lastPlayed === prev ? (state.streak || 0) + 1 : 1;
  state.lastPlayed = date;
  state.results.push({ date, pnl, action, size: playedSize });
  if (!state.learnStart) state.learnStart = date;
  saveState(state);
  return state;
}

function ensureLearn() {
  const state = loadState();
  if (!state.learnStart) {
    state.learnStart = today();
    saveState(state);
  }
  return state;
}

function paintChart(canvas, prior, forward, progress) {
  const width = canvas.clientWidth || 320;
  const height = canvas.clientHeight || 240;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  const styles = getComputedStyle(document.documentElement);
  const ink = styles.getPropertyValue("--ink").trim() || "#1a2330";
  const plate = styles.getPropertyValue("--plate").trim() || "#1e4d8c";
  const mark = styles.getPropertyValue("--mark").trim() || "#d6402e";
  const line = styles.getPropertyValue("--line").trim() || "#c5d0dc";
  const bg = styles.getPropertyValue("--bg").trim() || "#e8edf2";
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  const shown = Math.max(1, Math.round((forward.length - 1) * progress));
  const future = progress > 0 ? forward.slice(0, shown + 1) : [forward[0]];
  const values = prior.slice(0, -1).concat(future);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const pad = 16;
  const xAt = (index) => pad + ((width - pad * 2) * index) / Math.max(values.length - 1, 1);
  const yAt = (value) => pad + ((max - value) / (max - min)) * (height - pad * 2);
  ctx.strokeStyle = line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, yAt(forward[0]));
  ctx.lineTo(width - pad, yAt(forward[0]));
  ctx.stroke();
  const split = prior.length - 1;
  ctx.lineWidth = 2.25;
  ctx.strokeStyle = ink;
  ctx.beginPath();
  for (let i = 0; i <= split && i < values.length; i += 1) {
    const x = xAt(i);
    const y = yAt(values[i]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  if (progress > 0 && values.length > split) {
    ctx.strokeStyle = plate;
    ctx.beginPath();
    ctx.moveTo(xAt(split), yAt(values[split]));
    for (let i = split + 1; i < values.length; i += 1) ctx.lineTo(xAt(i), yAt(values[i]));
    ctx.stroke();
  }
  ctx.strokeStyle = mark;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(xAt(split), pad);
  ctx.lineTo(xAt(split), height - pad);
  ctx.stroke();
}

function paintCurves(host, yours, bench) {
  const width = host.clientWidth || 320;
  const height = host.clientHeight || 240;
  const styles = getComputedStyle(document.documentElement);
  const ink = styles.getPropertyValue("--ink").trim() || "#1a2330";
  const plate = styles.getPropertyValue("--plate").trim() || "#1e4d8c";
  const line = styles.getPropertyValue("--line").trim() || "#c5d0dc";
  const all = yours.concat(bench);
  let min = Math.min(...all);
  let max = Math.max(...all);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const pad = 16;
  const xAt = (index, list) => pad + ((width - pad * 2) * index) / Math.max(list.length - 1, 1);
  const yAt = (value) => pad + ((max - value) / (max - min)) * (height - pad * 2);
  const path = (list) => list.map((value, index) => `${index ? "L" : "M"}${xAt(index, list).toFixed(1)},${yAt(value).toFixed(1)}`).join(" ");
  host.innerHTML = "";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "curve");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  const axis = document.createElementNS("http://www.w3.org/2000/svg", "path");
  axis.setAttribute("d", `M${pad},${yAt(START_CASH)} H${width - pad}`);
  axis.setAttribute("fill", "none");
  axis.setAttribute("stroke", line);
  const you = document.createElementNS("http://www.w3.org/2000/svg", "path");
  you.setAttribute("d", path(yours));
  you.setAttribute("fill", "none");
  you.setAttribute("stroke", ink);
  you.setAttribute("stroke-width", "2.4");
  const spx = document.createElementNS("http://www.w3.org/2000/svg", "path");
  spx.setAttribute("d", path(bench));
  spx.setAttribute("fill", "none");
  spx.setAttribute("stroke", plate);
  spx.setAttribute("stroke-width", "2.4");
  svg.append(axis, spx, you);
  host.append(svg);
}

function lessonText(slice) {
  const t = text();
  const lesson = classifyLesson(slice);
  const body = fill(t.lessons[lesson.id], {
    prior: formatPct(lesson.priorRet),
    fwd: formatPct(lesson.fwd),
    vol: formatPct(lesson.vol || 0),
    day: formatPct(lesson.day),
  });
  const extra = lesson.event ? t.events[lesson.event] : "";
  return { body, extra, lesson };
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "disabled") node.disabled = Boolean(value);
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

function renderBars(values) {
  const t = text();
  const box = el("div", { class: "bars" });
  if (!values.length) {
    box.append(el("p", { class: "note", text: t.emptyStats }));
    return box;
  }
  const counts = histogram(values);
  const max = Math.max(...counts, 1);
  counts.forEach((count, index) => {
    const fillBar = el("i");
    fillBar.style.width = `${(count / max) * 100}%`;
    box.append(el("div", { class: "bar" }, [BARS[index], el("span", {}, [fillBar]), String(count)]));
  });
  return box;
}

function renderDaily() {
  const t = text();
  const slice = currentPuzzle();
  const saved = mode === "daily" ? todayResult() : null;
  const state = loadState();
  const done = Boolean(saved) || (mode === "practice" && reveal >= 1);
  const show = done ? 1 : reveal;
  const pnl = saved ? saved.pnl : done ? tradePnl(choice, slice.entry, slice.exit, size) : null;
  const wrap = el("div", { class: "desk" });
  const left = el("div");
  const canvas = el("canvas", { id: "trade-chart", role: "img", "aria-label": done ? `${slice.symbol} ${slice.decisionDate}` : t.hidden });
  left.append(el("div", { class: "chart-wrap" }, [canvas]));
  const meta = el("div", { class: "meta" });
  meta.append(el("span", {}, [el("strong", { text: t.streak }), ` ${state.streak || 0}`]));
  meta.append(el("span", { text: mode === "practice" ? t.practiceNote : `${HORIZON} sessions` }));
  left.append(meta);
  if (!done) {
    const choices = el("div", { class: "row choice", role: "group", "aria-label": t.decide });
    for (const action of ["buy", "sell", "hold"]) {
      choices.append(el("button", {
        type: "button",
        "data-act": action,
        "aria-pressed": choice === action ? "true" : "false",
        text: t[action],
        onClick: () => {
          choice = action;
          render();
        },
      }));
    }
    left.append(el("p", { text: t.decide }));
    left.append(choices);
    const sizes = el("div", { class: "row sizes", role: "group", "aria-label": t.size });
    for (const value of [1, 2, 3]) {
      sizes.append(el("button", {
        type: "button",
        "aria-pressed": size === value ? "true" : "false",
        text: `×${value}`,
        onClick: () => {
          size = value;
          render();
        },
      }));
    }
    left.append(el("p", { class: "fine", text: t.sizeHint }));
    left.append(sizes);
    left.append(el("button", {
      type: "button",
      class: "go",
      text: t.reveal,
      onClick: () => commitTrade(slice),
    }));
  } else {
    const tone = pnl > 0.0005 ? "up" : pnl < -0.0005 ? "down" : "";
    const told = lessonText(slice);
    left.append(el("p", { class: `pnl ${tone}`, text: formatPct(pnl) }));
    left.append(el("p", { class: "meta" }, [
      el("span", {}, [el("strong", { text: t.ticker }), ` ${slice.symbol}`]),
      el("span", {}, [el("strong", { text: slice.name })]),
      el("span", {}, [`${slice.decisionDate} → ${slice.exitDate}`]),
    ]));
    const card = el("div", { class: "lesson" }, [el("h2", { text: t.lesson }), el("p", { text: told.body })]);
    if (told.extra) card.append(el("p", { text: told.extra }));
    left.append(card);
    const actions = el("div", { class: "row" });
    actions.append(el("button", { type: "button", class: "ghost", text: t.share, onClick: () => share(slice, pnl, saved?.size || size) }));
    if (mode === "practice") {
      actions.append(el("button", {
        type: "button",
        class: "go",
        text: t.again,
        onClick: () => {
          practiceKey = `practice:${today()}:${Date.now()}`;
          reveal = 0;
          render();
        },
      }));
    }
    left.append(actions);
    const live = document.getElementById("live");
    if (live) live.textContent = `${t.pnl} ${formatPct(pnl)} ${slice.symbol}`;
  }
  const side = el("div", {}, [el("h2", { text: t.stats }), renderBars((state.results || []).map((row) => row.pnl))]);
  wrap.append(left, side);
  root.append(wrap);
  requestAnimationFrame(() => paintChart(canvas, slice.prior, slice.forward, show));
}

function commitTrade(slice) {
  if (busy) return;
  busy = true;
  const finish = () => {
    reveal = mode === "practice" ? 1 : 0;
    if (mode === "daily") recordDaily(tradePnl(choice, slice.entry, slice.exit, size), choice, size);
    busy = false;
    render();
  };
  if (reduceMotion) {
    finish();
    return;
  }
  const canvas = document.getElementById("trade-chart");
  const started = performance.now();
  const tick = (now) => {
    const raw = Math.min(1, (now - started) / 1100);
    const eased = raw * raw * (3 - 2 * raw);
    if (canvas) paintChart(canvas, slice.prior, slice.forward, eased);
    if (raw < 1) requestAnimationFrame(tick);
    else finish();
  };
  requestAnimationFrame(tick);
}

async function share(slice, pnl, playedSize) {
  const cells = shareCells(slice.forward).map((cell) => (cell === "up" ? "🟩" : cell === "down" ? "🟥" : "⬜")).join("");
  const message = `Daily Trade ${today()}\n${cells}\n${formatPct(pnl)} · ×${playedSize}\ntravaglino.me/trader/`;
  try {
    await navigator.clipboard.writeText(message);
    const live = document.getElementById("live");
    if (live) live.textContent = text().copied;
  } catch {
    /* clipboard blocked */
  }
}

function assetReady(symbol, month) {
  const map = months[symbol];
  if (!map) return false;
  return map.has(month) && map.has(nextMonth(month));
}

function timelineNote(month) {
  return TIMELINE.find((event) => month >= event.from && month <= event.to) || null;
}

function freshRun() {
  const pool = [...months.SPY.keys()].filter((month) => assetReady("SPY", month) && assetReady("^GSPC", month));
  const seed = `run:${today()}:${Date.now()}`;
  const month = pickStartMonth(pool, seed);
  run = {
    seed,
    month,
    values: [START_CASH],
    bench: [START_CASH],
    weights: { SPY: 40, QQQ: 0, GLD: 0, TLT: 0, KO: 0, MSFT: 0 },
    seen: [],
    done: false,
  };
  const state = loadState();
  state.portfolio = run;
  if (!state.learnStart) state.learnStart = today();
  saveState(state);
}

function normalizeWeights() {
  let used = 0;
  for (const symbol of ASSETS) {
    if (!assetReady(symbol, run.month)) run.weights[symbol] = 0;
    used += run.weights[symbol] || 0;
  }
  if (used > 100) {
    const scale = 100 / used;
    for (const symbol of ASSETS) run.weights[symbol] = Math.floor((run.weights[symbol] * scale) / 10) * 10;
  }
}

function stepRun() {
  normalizeWeights();
  const fractions = { CASH: 0 };
  let used = 0;
  const returns = {};
  for (const symbol of ASSETS) {
    const weight = (run.weights[symbol] || 0) / 100;
    fractions[symbol] = weight;
    used += weight;
    if (weight > 0) returns[symbol] = months[symbol].get(nextMonth(run.month)) / months[symbol].get(run.month) - 1;
  }
  fractions.CASH = 1 - used;
  const benchRet = months["^GSPC"].get(nextMonth(run.month)) / months["^GSPC"].get(run.month) - 1;
  const arrived = nextMonth(run.month);
  run.values.push(applyMonth(run.values.at(-1), fractions, returns));
  run.bench.push(run.bench.at(-1) * (1 + benchRet));
  run.month = arrived;
  const note = timelineNote(arrived);
  if (note && !run.seen.includes(note.id)) run.seen.push(note.id);
  if (!assetReady("^GSPC", run.month) || !assetReady("SPY", run.month)) run.done = true;
  const state = loadState();
  state.portfolio = run;
  saveState(state);
}

function reportCard() {
  const t = text();
  const rets = monthlyReturns(run.values);
  const years = rets.length / 12;
  const stats = {
    cagr: cagr(run.values[0], run.values.at(-1), years),
    drawdown: maxDrawdown(run.values),
    vol: annualizedVolMonthly(rets),
    sharpe: sharpe(rets, 0),
  };
  const grid = el("div", { class: "report" });
  for (const key of ["cagr", "drawdown", "vol", "sharpe"]) {
    grid.append(el("article", {}, [
      el("button", { type: "button", class: "tip", text: t.labels[key], title: t.tips[key] }),
      el("p", { text: formatPct(stats[key]) }),
    ]));
  }
  return grid;
}

function renderPortfolio() {
  const t = text();
  if (!run) freshRun();
  normalizeWeights();
  const host = el("div");
  const curve = el("div", { class: "chart-wrap", id: "port-chart" });
  host.append(curve);
  host.append(el("p", { class: "meta" }, [
    el("span", {}, [el("strong", { text: t.start }), ` ${run.month}`]),
    el("span", {}, [el("strong", { text: t.months }), ` ${Math.max(0, run.values.length - 1)}`]),
    el("span", {}, [el("strong", { text: t.you }), ` ${formatMoney(run.values.at(-1))}`]),
    el("span", {}, [el("strong", { text: t.vs }), ` ${formatMoney(run.bench.at(-1))}`]),
  ]));
  const note = timelineNote(run.month);
  if (note) host.append(el("p", { class: "lesson" }, [el("strong", { text: t.event }), " ", t.timeline[note.id]]));
  if (!run.done) {
    host.append(el("h2", { text: t.weights }));
    const alloc = el("div", { class: "alloc" });
    let used = 0;
    for (const symbol of ASSETS) used += run.weights[symbol] || 0;
    for (const symbol of ASSETS) {
      const ready = assetReady(symbol, run.month);
      const name = pack.symbols[symbol].name;
      alloc.append(el("div", {}, [
        el("span", { text: ready ? `${symbol} · ${name}` : `${symbol} · ${t.unavailable}` }),
        el("button", {
          type: "button",
          text: "−",
          "aria-label": `${symbol} −10`,
          disabled: !ready || !run.weights[symbol],
          onClick: () => shiftWeight(symbol, -10),
        }),
        el("output", { text: `${run.weights[symbol] || 0}%` }),
        el("button", {
          type: "button",
          text: "+",
          "aria-label": `${symbol} +10`,
          disabled: !ready || used >= 100,
          onClick: () => shiftWeight(symbol, 10),
        }),
      ]));
    }
    alloc.append(el("div", {}, [el("span", { text: t.cash }), el("span"), el("output", { text: `${100 - used}%` }), el("span")]));
    host.append(alloc);
    const row = el("div", { class: "row" });
    row.append(el("button", { type: "button", class: "go", text: t.next, onClick: () => { stepRun(); render(); } }));
    if (run.values.length > 2) row.append(el("button", { type: "button", class: "ghost", text: t.finish, onClick: () => { run.done = true; render(); } }));
    row.append(el("button", { type: "button", class: "ghost", text: t.newRun, onClick: () => { run = null; freshRun(); render(); } }));
    host.append(row);
  } else {
    host.append(el("h2", { text: t.report }));
    host.append(reportCard());
    host.append(el("button", { type: "button", class: "go", text: t.newRun, onClick: () => { run = null; freshRun(); render(); } }));
  }
  root.append(host);
  requestAnimationFrame(() => {
    const box = document.getElementById("port-chart");
    if (box) {
      paintCurves(box, run.values, run.bench);
      box.querySelector("svg")?.setAttribute("aria-label", `${t.you} ${formatMoney(run.values.at(-1))}, ${t.vs} ${formatMoney(run.bench.at(-1))}`);
    }
  });
}

function shiftWeight(symbol, delta) {
  const next = Math.max(0, (run.weights[symbol] || 0) + delta);
  let others = 0;
  for (const key of ASSETS) if (key !== symbol) others += run.weights[key] || 0;
  run.weights[symbol] = Math.min(next, 100 - others);
  const state = loadState();
  state.portfolio = run;
  saveState(state);
  render();
}

function renderLearn() {
  const t = text();
  const state = ensureLearn();
  const open = conceptsUnlocked(state.learnStart, today());
  const list = el("div");
  CONCEPTS.forEach((id, index) => {
    const [title, body] = t.concepts[id];
    const item = el("article", { class: index < open ? "concept" : "concept locked" });
    item.append(el("h3", { text: index < open ? title : `${title} · ${t.locked}` }));
    if (index < open) item.append(el("p", { text: body }));
    list.append(item);
  });
  learnDialog.replaceChildren(
    el("h2", { id: "learn-title", text: t.glossary }),
    list,
    el("button", { type: "button", class: "go", text: t.close, onClick: () => learnDialog.close() })
  );
  if (!learnDialog.open) learnDialog.showModal();
}

function render() {
  const t = text();
  root.replaceChildren();
  const modes = el("div", { class: "modes", role: "tablist" });
  for (const id of ["daily", "practice", "portfolio"]) {
    modes.append(el("button", {
      type: "button",
      role: "tab",
      "aria-pressed": mode === id ? "true" : "false",
      text: t[id],
      onClick: () => {
        mode = id;
        if (id !== "practice") reveal = todayResult() ? 1 : 0;
        render();
      },
    }));
  }
  modes.append(el("button", { type: "button", text: t.learn, onClick: renderLearn }));
  root.append(modes);
  if (loadError) {
    root.append(el("p", { class: "lesson", text: loadError }));
    return;
  }
  if (!pack) {
    root.append(el("p", { text: t.loading }));
    return;
  }
  if (mode === "portfolio") renderPortfolio();
  else renderDaily();
  root.append(el("p", { class: "fine", text: t.disclaimer }));
  root.append(el("p", { class: "fine", text: `${t.source} ${pack.fetched}.` }));
}

document.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.target.closest("input, textarea, dialog")) return;
  const key = event.key.toLowerCase();
  if (mode === "portfolio") return;
  if (key === "b") choice = "buy";
  else if (key === "s") choice = "sell";
  else if (key === "h") choice = "hold";
  else return;
  if (!todayResult() || mode === "practice") {
    if (reveal < 1) render();
  }
});

document.addEventListener("it-lang", (event) => {
  lang = event.detail.lang;
  render();
});

const savedRun = loadState().portfolio;
if (savedRun?.values?.length) run = savedRun;

fetch("/data/market.json")
  .then((res) => {
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  })
  .then((doc) => {
    if (doc.source !== "Yahoo Finance" || !doc.symbols) throw new Error("unexpected file");
    pack = doc;
    for (const symbol of ["SPY", "QQQ", "GLD", "TLT", "KO", "MSFT", "^GSPC"]) {
      const series = unpackSeries(doc.symbols[symbol]);
      months[symbol] = lastCloseByMonth(series.dates, series.closes);
    }
    render();
  })
  .catch((error) => {
    loadError = `${text().loadError} (${error.message})`;
    render();
  });

render();
