import { initI18n, getLang } from "./i18n.js";
import { initTheme } from "./theme.js";
import { copy, fill, formatMoney, formatPct } from "./trader-copy.js";
import { fetchTop, qualify, sanitizeName, submitScore, boardEnv } from "./trader-board.js";
import {
  CONCEPTS,
  START_CASH,
  applyMonth,
  annualizedVolMonthly,
  cagr,
  classifyLesson,
  conceptsUnlocked,
  cordobaDate,
  lastCloseByMonth,
  maxDrawdown,
  monthlyReturns,
  nextMonth,
  pickStartMonth,
  previousDate,
  puzzleSlice,
  sharpe,
  unpackSeries,
} from "./trader-metrics.js";
import {
  applyRiskChoice,
  driftedWeights,
  eventForMonth,
  freshPosition,
  maxDrift,
  portfolioScore,
  rankBand,
  rsi,
  scoreRound,
  sessionPicks,
  sessionScore,
  sma,
  stepPosition,
  visibleHint,
} from "./trader-score.js";

const STORE = "it-trader";
const ASSETS = ["SPY", "QQQ", "GLD", "TLT", "KO", "MSFT"];
const TIMELINE = [
  { id: "dotcom", from: "2000-03", to: "2002-10" },
  { id: "gfc", from: "2008-09", to: "2009-03" },
  { id: "covid", from: "2020-02", to: "2020-03" },
  { id: "rebound", from: "2020-04", to: "2020-08" },
  { id: "rates", from: "2022-01", to: "2022-10" },
];
const SCORE_BARS = ["< 0", "0–199", "200–499", "500–999", "≥ 1000"];

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const root = document.getElementById("trader-root");
const learnDialog = document.getElementById("learn-dialog");

let lang = getLang();
let pack = null;
let loadError = "";
let mode = "daily";
let busy = false;
let practiceKey = "";
let session = null;
let run = null;
let boardTab = "daily";
let boardRows = [];
let boardNote = "";
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

function ensureLearn() {
  const state = loadState();
  if (!state.learnStart) {
    state.learnStart = today();
    saveState(state);
  }
  return state;
}

function paintChart(canvas, slice, shown, extras = {}) {
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
  const count = Math.max(0, Math.min(20, Math.round(shown)));
  const values = slice.prior.concat(slice.forward.slice(1, 1 + count));
  const levels = (extras.levels || []).map((item) => item.price).filter((price) => price > 0);
  let min = Math.min(...values, ...levels);
  let max = Math.max(...values, ...levels);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const pad = 18;
  const xAt = (index) => pad + ((width - pad * 2) * index) / Math.max(values.length - 1, 1);
  const yAt = (value) => pad + ((max - value) / (max - min)) * (height - pad * 2);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, yAt(slice.forward[0]));
  ctx.lineTo(width - pad, yAt(slice.forward[0]));
  ctx.stroke();
  const split = slice.prior.length - 1;
  const strokeLine = (series, color, widthPx) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = widthPx;
    ctx.beginPath();
    let moved = false;
    series.forEach((value, index) => {
      if (value == null) return;
      const x = xAt(index);
      const y = yAt(value);
      if (!moved) {
        ctx.moveTo(x, y);
        moved = true;
      } else ctx.lineTo(x, y);
    });
    if (moved) ctx.stroke();
  };
  strokeLine(values.map((value, index) => (index <= split ? value : null)), ink, 2.25);
  if (count > 0) strokeLine(values.map((value, index) => (index >= split ? value : null)), plate, 2.25);
  for (const overlay of extras.overlays || []) strokeLine(overlay.values, overlay.color, 1.4);
  for (const level of extras.levels || []) {
    ctx.strokeStyle = level.color;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pad, yAt(level.price));
    ctx.lineTo(width - pad, yAt(level.price));
    ctx.stroke();
    ctx.setLineDash([]);
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
    else if (key === "checked") node.checked = Boolean(value);
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

function scoreBuckets(values) {
  const counts = [0, 0, 0, 0, 0];
  for (const value of values) {
    if (value < 0) counts[0] += 1;
    else if (value < 200) counts[1] += 1;
    else if (value < 500) counts[2] += 1;
    else if (value < 1000) counts[3] += 1;
    else counts[4] += 1;
  }
  return counts;
}

function renderBars(values) {
  const t = text();
  const box = el("div", { class: "bars" });
  if (!values.length) {
    box.append(el("p", { class: "note", text: t.emptyStats }));
    return box;
  }
  const counts = scoreBuckets(values);
  const max = Math.max(...counts, 1);
  counts.forEach((count, index) => {
    const fillBar = el("i");
    fillBar.style.width = `${(count / max) * 100}%`;
    box.append(el("div", { class: "bar" }, [SCORE_BARS[index], el("span", {}, [fillBar]), String(count)]));
  });
  return box;
}

function activeSlice() {
  const pick = session.picks[session.round];
  const slice = puzzleSlice(pack.symbols[pick.symbol], pick.start);
  slice.symbol = pick.symbol;
  return slice;
}

function blankSession(key, kind) {
  return {
    kind,
    key,
    date: today(),
    picks: sessionPicks(pack.symbols, key),
    round: 0,
    shown: 0,
    phase: "entry",
    position: freshPosition(),
    size: 1,
    action: "buy",
    stopOn: false,
    stopPct: 8,
    takeOn: false,
    takePct: 12,
    hints: 0,
    hint: null,
    startedAt: Date.now(),
    bankedSec: 0,
    winStreak: 0,
    scores: [],
    breakdown: null,
    total: 0,
    done: false,
    indicators: { sma20: false, sma50: false, rsi: false },
  };
}

function persistSession() {
  if (!session || session.kind !== "daily") return;
  const state = loadState();
  state.dailySession = session;
  saveState(state);
}

function ensureSession() {
  if (!pack) return null;
  if (mode === "practice") {
    if (!session || session.kind !== "practice" || session.key !== practiceKey) {
      if (!practiceKey) practiceKey = `practice:${today()}:1`;
      session = blankSession(practiceKey, "practice");
    }
    return session;
  }
  const saved = loadState().dailySession;
  if (saved?.date === today() && saved.done) {
    session = saved;
    return session;
  }
  if (session?.kind === "daily" && session.date === today()) return session;
  if (saved?.date === today() && saved.picks) {
    session = saved;
    return session;
  }
  session = blankSession(`daily:${today()}`, "daily");
  persistSession();
  return session;
}

function decisionFrom(action) {
  return {
    action,
    size: session.size,
    stopPct: session.stopOn ? session.stopPct / 100 : 0,
    takePct: session.takeOn ? session.takePct / 100 : 0,
  };
}

function levelPrices(slice) {
  const anchor = session.position.entry || slice.forward[Math.min(session.shown, 20)];
  const side = session.position.side || (session.action === "sell" ? -1 : session.action === "buy" ? 1 : 0);
  if (!side || !anchor) return [];
  const levels = [];
  if (session.stopOn) levels.push({ price: anchor * (1 - side * (session.stopPct / 100)), color: "#d6402e" });
  if (session.takeOn) levels.push({ price: anchor * (1 + side * (session.takePct / 100)), color: "#1e4d8c" });
  return levels;
}

function overlayValues(slice, period) {
  const count = Math.max(0, Math.min(20, Math.round(session.shown)));
  const all = slice.warmup.concat(slice.prior, slice.forward.slice(1, 1 + count));
  const avg = sma(all, period);
  return avg.slice(all.length - (slice.prior.length + count));
}

function redrawChart() {
  const canvas = document.getElementById("trade-chart");
  if (!canvas || !session) return;
  const slice = activeSlice();
  const overlays = [];
  if (session.indicators.sma20) overlays.push({ values: overlayValues(slice, 20), color: "#8a5a2a" });
  if (session.indicators.sma50) overlays.push({ values: overlayValues(slice, 50), color: "#3d6b4f" });
  paintChart(canvas, slice, session.shown, { overlays, levels: levelPrices(slice) });
  const rsiNode = document.getElementById("rsi-readout");
  if (rsiNode) {
    if (!session.indicators.rsi) rsiNode.textContent = "";
    else {
      const count = Math.max(0, Math.min(20, Math.round(session.shown)));
      const all = slice.warmup.concat(slice.prior, slice.forward.slice(1, 1 + count));
      const values = rsi(all, 14);
      const last = [...values].reverse().find((value) => value != null);
      rsiNode.textContent = last == null ? "" : `RSI ${last.toFixed(0)}`;
    }
  }
}

function finishRound() {
  const scored = scoreRound({
    pnl: session.position.pnl,
    mae: session.position.mae,
    stopSet: session.position.stopSet,
    stoppedOut: session.position.stoppedOut,
    hints: session.hints,
    elapsedSec: session.bankedSec,
    winStreak: session.winStreak,
  });
  session.breakdown = scored;
  session.scores.push(scored.total);
  session.winStreak = scored.total > 0 ? session.winStreak + 1 : 0;
  session.phase = "breakdown";
}

function advance(action) {
  if (busy || !session) return;
  const slice = activeSlice();
  const start = Math.round(session.shown);
  const end = Math.min(20, start + 5);
  const bars = slice.forward.slice(start + 1, end + 1);
  if (session.phase === "entry") session.bankedSec = (Date.now() - session.startedAt) / 1000;
  const stepped = stepPosition(session.position, slice.forward[start], bars, decisionFrom(action));
  session.position = stepped.state;
  session.lastReason = stepped.reason;
  const land = () => {
    session.shown = end;
    if (end >= 20) finishRound();
    else {
      session.phase = "step";
      session.action = session.position.side !== 0 ? "hold" : "flat";
    }
    busy = false;
    persistSession();
    render();
  };
  if (reduceMotion) {
    land();
    return;
  }
  busy = true;
  const started = performance.now();
  const tick = (now) => {
    const raw = Math.min(1, (now - started) / 720);
    session.shown = start + (end - start) * (raw * raw * (3 - 2 * raw));
    redrawChart();
    if (raw < 1) requestAnimationFrame(tick);
    else land();
  };
  requestAnimationFrame(tick);
}

function nextChart() {
  if (session.round < 4) {
    session.round += 1;
    session.shown = 0;
    session.position = freshPosition();
    session.hints = 0;
    session.hint = null;
    session.phase = "entry";
    session.startedAt = Date.now();
    session.bankedSec = 0;
    session.breakdown = null;
    session.action = "buy";
    persistSession();
    render();
    return;
  }
  session.total = sessionScore(session.scores);
  session.done = true;
  session.phase = "done";
  if (session.kind === "daily") {
    const state = loadState();
    const date = today();
    if (state.lastPlayed !== date) {
      state.streak = state.lastPlayed === previousDate(date) ? (state.streak || 0) + 1 : 1;
      state.lastPlayed = date;
      state.results = state.results || [];
      state.results.push({ date, score: session.total, pnl: session.total / 1000 });
    }
    if (!state.learnStart) state.learnStart = date;
    state.dailySession = session;
    saveState(state);
    maybeEnterBoard("daily", session.total, { rounds: session.scores });
  }
  render();
}

function useHint() {
  if (!session || session.hints || session.phase === "done" || session.phase === "breakdown") return;
  const slice = activeSlice();
  const hint = visibleHint(slice.prior);
  session.hints = 1;
  session.hint = hint;
  persistSession();
  render();
}

function toggleIndicator(key) {
  session.indicators[key] = !session.indicators[key];
  persistSession();
  render();
}

function rangeControl(label, value, onInput) {
  const output = el("output", { text: `${value}%` });
  const input = el("input", { type: "range", min: "2", max: "30", step: "1", value: String(value), "aria-label": label });
  input.addEventListener("input", () => {
    output.textContent = `${input.value}%`;
    onInput(Number(input.value));
  });
  return el("label", { class: "range" }, [label, input, output]);
}

function renderDaily() {
  const t = text();
  const state = loadState();
  ensureSession();
  const slice = activeSlice();
  const wrap = el("div", { class: "desk" });
  const left = el("div");
  const canvas = el("canvas", {
    id: "trade-chart",
    role: "img",
    "aria-label": session.phase === "done" || session.phase === "breakdown" ? `${slice.symbol}` : t.hidden,
  });
  left.append(el("div", { class: "chart-wrap" }, [canvas]));
  const meta = el("div", { class: "meta" });
  meta.append(el("span", {}, [el("strong", { text: t.round }), ` ${session.round + 1}/5`]));
  meta.append(el("span", {}, [el("strong", { text: t.step }), ` ${Math.min(4, Math.round(session.shown / 5))}/4`]));
  meta.append(el("span", {}, [el("strong", { text: t.streak }), ` ${state.streak || 0}`]));
  left.append(meta);
  if (session.hint) {
    left.append(el("p", { class: "lesson", text: fill(t.hints[session.hint.id], { ret: formatPct(session.hint.ret), vol: formatPct(session.hint.vol) }) }));
  }
  const tools = el("div", { class: "row", role: "group", "aria-label": t.indicators });
  for (const key of ["sma20", "sma50", "rsi"]) {
    tools.append(el("button", {
      type: "button",
      "aria-pressed": session.indicators[key] ? "true" : "false",
      text: t[key],
      onClick: () => toggleIndicator(key),
    }));
  }
  tools.append(el("button", { type: "button", disabled: true, title: t.volumeOff, text: "Vol" }));
  tools.append(el("span", { id: "rsi-readout", class: "figure" }));
  left.append(tools);

  if (session.phase === "entry" || session.phase === "step") {
    const open = session.position.side !== 0;
    const actions = open ? ["hold", "add", "reduce", "close"] : ["buy", "sell", "flat"];
    const labels = { hold: t.holdPos, add: t.add, reduce: t.reduce, close: t.closePos, buy: t.buy, sell: t.sell, flat: t.flat };
    const choices = el("div", { class: "row choice", role: "group", "aria-label": t.decide });
    for (const action of actions) {
      choices.append(el("button", {
        type: "button",
        "data-act": action,
        "aria-pressed": session.action === action ? "true" : "false",
        text: labels[action],
        onClick: () => {
          session.action = action;
          render();
        },
      }));
    }
    left.append(choices);
    if (!open) {
      const sizes = el("div", { class: "row sizes", role: "group", "aria-label": t.size });
      for (const value of [1, 2, 3]) {
        sizes.append(el("button", {
          type: "button",
          "aria-pressed": session.size === value ? "true" : "false",
          text: `×${value}`,
          onClick: () => {
            session.size = value;
            render();
          },
        }));
      }
      left.append(sizes);
    }
    const checks = el("div", { class: "row" });
    checks.append(el("label", { class: "check" }, [
      el("input", {
        type: "checkbox",
        checked: session.stopOn,
        onChange: (event) => {
          session.stopOn = event.target.checked;
          render();
        },
      }),
      t.stop,
    ]));
    checks.append(el("label", { class: "check" }, [
      el("input", {
        type: "checkbox",
        checked: session.takeOn,
        onChange: (event) => {
          session.takeOn = event.target.checked;
          render();
        },
      }),
      t.target,
    ]));
    left.append(checks);
    if (session.stopOn) {
      left.append(rangeControl(t.stop, session.stopPct, (value) => {
        session.stopPct = value;
        const out = document.querySelector(".range output");
        if (out) out.textContent = `${value}%`;
        redrawChart();
      }));
    }
    if (session.takeOn) {
      left.append(rangeControl(t.target, session.takePct, (value) => {
        session.takePct = value;
        redrawChart();
      }));
    }
    left.append(el("p", { class: "fine", text: t.levels }));
    const row = el("div", { class: "row" });
    row.append(el("button", {
      type: "button",
      class: "go",
      text: session.phase === "entry" ? t.reveal : t.nextFive,
      onClick: () => advance(open ? session.action : session.action),
    }));
    row.append(el("button", { type: "button", class: "ghost", disabled: session.hints > 0, text: t.hint, onClick: useHint }));
    row.append(el("button", { type: "button", class: "ghost", text: t.scoring, onClick: openScoring }));
    left.append(row);
  } else if (session.phase === "breakdown") {
    left.append(renderBreakdown(session.breakdown));
    const told = lessonText(slice);
    left.append(el("p", { class: "meta" }, [
      el("span", {}, [el("strong", { text: t.ticker }), ` ${slice.symbol}`]),
      el("span", {}, [slice.name]),
      el("span", {}, [`${slice.decisionDate} → ${slice.exitDate}`]),
    ]));
    left.append(el("p", { class: "lesson", text: told.body }));
    if (told.extra) left.append(el("p", { class: "lesson", text: told.extra }));
    left.append(el("button", {
      type: "button",
      class: "go",
      text: session.round < 4 ? t.nextRound : t.finishSession,
      onClick: nextChart,
    }));
  } else {
    left.append(el("p", { class: "pnl", text: String(session.total) }));
    left.append(el("p", { class: "fine", text: t.sessionTotal }));
    left.append(el("p", { class: "meta", text: session.scores.map((score, index) => `${index + 1}: ${score}`).join("   ") }));
    const row = el("div", { class: "row" });
    row.append(el("button", { type: "button", class: "ghost", text: t.share, onClick: shareSession }));
    if (session.kind === "practice") {
      row.append(el("button", {
        type: "button",
        class: "go",
        text: t.again,
        onClick: () => {
          practiceKey = `practice:${today()}:${Date.now()}`;
          session = null;
          render();
        },
      }));
    }
    left.append(row);
  }
  const side = el("div", {}, [
    el("h2", { text: t.stats }),
    renderBars((state.results || []).map((row) => row.score ?? Math.round((row.pnl || 0) * 1000))),
  ]);
  wrap.append(left, side);
  root.append(wrap);
  requestAnimationFrame(redrawChart);
}

function renderBreakdown(scored) {
  const t = text();
  const rows = [
    ["pnl", scored.pnlPoints],
    ["direction", scored.directionBonus],
    ["discipline", scored.discipline],
    ["time", scored.timeBonus],
    ["hint", -scored.hintPenalty],
    ["streak", scored.multiplier],
    ["total", scored.total],
  ];
  const list = el("ol", { class: "breakdown" });
  rows.forEach((row, index) => {
    const value = row[0] === "streak" ? `×${row[1].toFixed(2)}` : String(row[1]);
    const item = el("li", {}, [el("span", { text: t.parts[row[0]] }), el("strong", { text: value })]);
    if (!reduceMotion) item.style.animationDelay = `${index * 70}ms`;
    list.append(item);
  });
  return el("div", {}, [el("h2", { text: t.breakdown }), list]);
}

function shareSession() {
  const lines = (session.scores || []).map((score) => (score > 0 ? "🟩" : score < 0 ? "🟥" : "⬜")).join("");
  const message = `Daily Trade ${today()}\n${lines}\n${session.total}\ntravaglino.me/trader/`;
  navigator.clipboard?.writeText(message).then(() => {
    const live = document.getElementById("live");
    if (live) live.textContent = text().copied;
  }).catch(() => {});
}

function openScoring() {
  const t = text();
  const dialog = document.getElementById("score-dialog");
  dialog.replaceChildren(
    el("h2", { id: "score-title", text: t.scoring }),
    el("p", { text: t.scoringBody }),
    el("button", { type: "button", class: "go", text: t.close, onClick: () => dialog.close() })
  );
  if (!dialog.open) dialog.showModal();
}

function askName() {
  const t = text();
  const dialog = document.getElementById("name-dialog");
  return new Promise((resolve) => {
    const input = el("input", { id: "board-name", maxlength: "20", autocomplete: "nickname", "aria-describedby": "name-help" });
    const error = el("p", { class: "fine", id: "name-error" });
    dialog.replaceChildren(
      el("h2", { id: "name-title", text: t.nameTitle }),
      el("label", { for: "board-name", text: t.nameLabel }),
      input,
      el("p", { class: "fine", id: "name-help", text: t.nameHelp }),
      error,
      el("div", { class: "row" }, [
        el("button", {
          type: "button",
          class: "go",
          text: t.submit,
          onClick: () => {
            const cleaned = sanitizeName(input.value);
            if (!cleaned.ok) {
              error.textContent = t.nameError;
              return;
            }
            dialog.close();
            resolve(cleaned.name);
          },
        }),
        el("button", {
          type: "button",
          class: "ghost",
          text: t.skip,
          onClick: () => {
            dialog.close();
            resolve("");
          },
        }),
      ])
    );
    dialog.showModal();
    input.focus();
  });
}

async function maybeEnterBoard(boardMode, score, details) {
  const day = today();
  const board = await fetchTop(boardMode, day);
  if (!qualify(score, board.rows || [])) return;
  const name = await askName();
  if (!name) return;
  const result = await submitScore({ mode: boardMode, day, name, score, details });
  const live = document.getElementById("live");
  if (live) {
    if (result?.ok && result.pending) live.textContent = text().savedLocal;
    else if (result?.ok) live.textContent = text().saved;
    else live.textContent = text().notSaved;
  }
  await loadBoard();
  render();
}

async function loadBoard() {
  const board = await fetchTop(boardTab, today());
  boardRows = board.rows || [];
  const t = text();
  if (board.pending) boardNote = t.pendingRpc;
  else if (!boardEnv().remote) boardNote = t.localNote;
  else if (board.failed) boardNote = t.remoteFail;
  else boardNote = "";
}

function renderBoard() {
  const t = text();
  const box = el("section", { class: "board" });
  box.append(el("h2", { text: t.board }));
  const tabs = el("div", { class: "row", role: "group", "aria-label": t.board });
  for (const id of ["daily", "portfolio"]) {
    tabs.append(el("button", {
      type: "button",
      "aria-pressed": boardTab === id ? "true" : "false",
      text: id === "daily" ? t.todayBoard : t.allTime,
      onClick: () => {
        boardTab = id;
        loadBoard().then(render);
      },
    }));
  }
  box.append(tabs);
  if (boardNote) box.append(el("p", { class: "fine", text: boardNote }));
  if (!boardRows.length) box.append(el("p", { class: "note", text: t.emptyBoard }));
  else {
    const list = el("ol", { class: "board-list" });
    boardRows.forEach((row) => {
      list.append(el("li", {}, [el("span", { text: row.name }), el("strong", { text: String(row.score) })]));
    });
    box.append(list);
  }
  root.append(box);
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
    actual: { SPY: 0.4, QQQ: 0, GLD: 0, TLT: 0, KO: 0, MSFT: 0, CASH: 0.6 },
    rebalanceEvents: [],
    doRebalance: false,
    riskChoice: "hold",
    seen: [],
    done: false,
    score: null,
    band: null,
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

function targetFractions() {
  const fractions = { CASH: 0 };
  let used = 0;
  for (const symbol of ASSETS) {
    const weight = assetReady(symbol, run.month) ? (run.weights[symbol] || 0) / 100 : 0;
    fractions[symbol] = weight;
    used += weight;
  }
  fractions.CASH = Math.max(0, 1 - used);
  const scale = used > 1 ? 1 / used : 1;
  if (used > 1) {
    for (const symbol of ASSETS) fractions[symbol] *= scale;
    fractions.CASH = 0;
  }
  return fractions;
}

function stepRun() {
  normalizeWeights();
  const targets = targetFractions();
  const actual = run.actual || { ...targets };
  const drift = maxDrift(actual, targets);
  run.rebalanceEvents.push({ drift, didRebalance: Boolean(run.doRebalance) });
  let mix = run.doRebalance ? { ...targets } : { ...actual };
  const upcoming = nextMonth(run.month);
  if (eventForMonth(upcoming)) mix = applyRiskChoice(mix, run.riskChoice || "hold");
  const returns = {};
  for (const symbol of ASSETS) {
    if (mix[symbol] > 0) returns[symbol] = months[symbol].get(upcoming) / months[symbol].get(run.month) - 1;
  }
  const benchRet = months["^GSPC"].get(upcoming) / months["^GSPC"].get(run.month) - 1;
  run.values.push(applyMonth(run.values.at(-1), mix, returns));
  run.bench.push(run.bench.at(-1) * (1 + benchRet));
  run.actual = driftedWeights(mix, returns);
  run.month = upcoming;
  run.doRebalance = false;
  run.riskChoice = "hold";
  const note = timelineNote(upcoming);
  if (note && !run.seen.includes(note.id)) run.seen.push(note.id);
  if (!assetReady("^GSPC", run.month) || !assetReady("SPY", run.month)) finishRun();
  const state = loadState();
  state.portfolio = run;
  saveState(state);
}

function finishRun() {
  const returns = monthlyReturns(run.values);
  const excess = run.values.at(-1) / START_CASH - run.bench.at(-1) / START_CASH;
  run.score = portfolioScore({
    excessReturn: excess,
    vol: annualizedVolMonthly(returns) || 0,
    maxDrawdown: maxDrawdown(run.values),
    rebalanceEvents: run.rebalanceEvents,
  });
  run.band = rankBand(run.score);
  run.done = true;
  const state = loadState();
  state.portfolio = run;
  saveState(state);
  maybeEnterBoard("portfolio", run.score, { months: run.values.length - 1, start: run.values.length ? run.month : "" });
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
  const upcomingEvent = eventForMonth(nextMonth(run.month));
  if (!run.done && upcomingEvent) {
    host.append(el("p", { class: "lesson" }, [el("strong", { text: t.prompt }), " ", t.monthEvents[upcomingEvent.id]]));
    const risk = el("div", { class: "row choice", role: "group", "aria-label": t.prompt });
    for (const choice of ["cut", "hold", "add"]) {
      const label = choice === "cut" ? t.cut : choice === "add" ? t.addRisk : t.holdRisk;
      const value = choice === "hold" ? "hold" : choice;
      risk.append(el("button", {
        type: "button",
        "aria-pressed": (run.riskChoice || "hold") === value ? "true" : "false",
        text: label,
        onClick: () => {
          run.riskChoice = value;
          render();
        },
      }));
    }
    host.append(risk);
  } else if (!run.done) host.append(el("p", { class: "fine", text: t.noEvent }));
  if (!run.done && run.actual) {
    const targets = targetFractions();
    const drift = maxDrift(run.actual, targets);
    host.append(el("p", { class: "meta" }, [el("strong", { text: t.drift }), ` ${formatPct(drift)}`]));
    host.append(el("label", { class: "check" }, [
      el("input", {
        type: "checkbox",
        checked: Boolean(run.doRebalance),
        onChange: (event) => {
          run.doRebalance = event.target.checked;
          const state = loadState();
          state.portfolio = run;
          saveState(state);
        },
      }),
      t.rebalance,
    ]));
  }
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
    if (run.values.length > 2) row.append(el("button", { type: "button", class: "ghost", text: t.finish, onClick: () => { finishRun(); render(); } }));
    row.append(el("button", { type: "button", class: "ghost", text: t.newRun, onClick: () => { run = null; freshRun(); render(); } }));
    host.append(row);
  } else {
    host.append(el("h2", { text: t.report }));
    host.append(reportCard());
    if (run.score != null) {
      host.append(el("p", { class: "pnl", text: String(run.score) }));
      const bandKey = run.band === "close" ? "closeRank" : run.band;
      host.append(el("p", { class: "lesson", text: `${t.rank}: ${t[bandKey] || run.band}` }));
    }
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
        if (id === "practice") session = null;
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
  renderBoard();
  root.append(el("p", { class: "fine", text: t.disclaimer }));
  root.append(el("p", { class: "fine", text: `${t.source} ${pack.fetched}.` }));
}

document.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.target.closest("input, textarea, dialog")) return;
  if (!session || mode === "portfolio") return;
  if (session.phase !== "entry" && session.phase !== "step") return;
  const key = event.key.toLowerCase();
  const open = session.position.side !== 0;
  if (!open && key === "b") session.action = "buy";
  else if (!open && key === "s") session.action = "sell";
  else if (!open && key === "h") session.action = "flat";
  else if (open && key === "h") session.action = "hold";
  else return;
  render();
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
    loadBoard().then(render);
  })
  .catch((error) => {
    loadError = `${text().loadError} (${error.message})`;
    render();
  });

render();
