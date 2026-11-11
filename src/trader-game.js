import { initI18n, getLang } from "./i18n.js";
import { initTheme } from "./theme.js";
import { copy, formatMoney, formatPct } from "./trader-copy.js";
import { fetchTop, qualify, sanitizeName, submitScore, boardEnv } from "./trader-board.js";
import { CARD_IDS, lessonKey, pickLevels, scoreLevel, scoreRun, simulateLevel } from "./trader-arcade.js";
import {
  CONCEPTS,
  START_CASH,
  applyMonth,
  annualizedVolMonthly,
  cagr,
  conceptsUnlocked,
  cordobaDate,
  lastCloseByMonth,
  maxDrawdown,
  monthlyReturns,
  nextMonth,
  pickStartMonth,
  sharpe,
  unpackSeries,
} from "./trader-metrics.js";
import {
  applyRiskChoice,
  driftedWeights,
  eventForMonth,
  maxDrift,
  portfolioScore,
  rankBand,
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
const RACE_MS = 5200;

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const root = document.getElementById("trader-root");
const learnDialog = document.getElementById("learn-dialog");

let lang = getLang();
let pack = null;
let loadError = "";
let mode = "arcade";
let run = null;
let boardTab = "daily";
let boardRows = [];
let boardNote = "";
let arcade = null;
let raceFrame = 0;
let raceToken = 0;
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

function stopRace() {
  if (raceFrame) cancelAnimationFrame(raceFrame);
  raceFrame = 0;
}

function paintRace(canvas, you, bench, shown) {
  const width = canvas.clientWidth || 320;
  const height = canvas.clientHeight || 220;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  const styles = getComputedStyle(document.documentElement);
  const ink = styles.getPropertyValue("--ink").trim() || "#1a2330";
  const plate = styles.getPropertyValue("--plate").trim() || "#1e4d8c";
  const line = styles.getPropertyValue("--line").trim() || "#c5d0dc";
  const bg = styles.getPropertyValue("--bg").trim() || "#e8edf2";
  const count = Math.max(2, Math.min(you.length, shown));
  const sliceYou = you.slice(0, count);
  const sliceBench = bench.slice(0, count);
  let min = Math.min(...sliceYou, ...sliceBench);
  let max = Math.max(...sliceYou, ...sliceBench);
  if (min === max) {
    min -= 0.05;
    max += 0.05;
  }
  const pad = 16;
  const xAt = (index) => pad + ((width - pad * 2) * index) / Math.max(you.length - 1, 1);
  const yAt = (value) => pad + ((max - value) / (max - min)) * (height - pad * 2);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, yAt(1));
  ctx.lineTo(width - pad, yAt(1));
  ctx.stroke();
  const stroke = (series, color, widthPx) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = widthPx;
    ctx.beginPath();
    series.forEach((value, index) => {
      const x = xAt(index);
      const y = yAt(value);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };
  stroke(sliceBench, ink, 2);
  stroke(sliceYou, plate, 2.6);
}

function freshArcade() {
  stopRace();
  arcade = {
    phase: "start",
    levels: pickLevels(pack.symbols, `daily:${today()}`),
    level: 0,
    cards: [],
    draft: [],
    results: [],
    streak: 0,
    total: 0,
    startedAt: 0,
    elapsed: 0,
    asked: false,
    current: null,
  };
}

function clockText() {
  const ms = arcade?.phase === "end" ? arcade.elapsed : arcade?.startedAt ? Date.now() - arcade.startedAt : 0;
  const sec = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

function monthSpan(level) {
  return `${level.startDate.slice(0, 7)} → ${level.endDate.slice(0, 7)}`;
}

function commitAndRun() {
  arcade.cards = arcade.draft.slice();
  arcade.current = simulateLevel(arcade.levels[arcade.level], arcade.cards);
  const scored = scoreLevel({
    ret: arcade.current.ret,
    benchRet: arcade.current.benchRet,
    maxDD: arcade.current.maxDD,
    days: arcade.current.days,
    streak: arcade.streak,
  });
  arcade.pending = { ...scored, lesson: lessonKey(arcade.cards, arcade.current) };
  arcade.phase = "race";
  render();
}

function finishLevel() {
  if (!arcade || arcade.phase !== "race") return;
  const scored = arcade.pending;
  arcade.results.push(scored.points);
  arcade.streak = scored.nextStreak;
  arcade.total = scoreRun(arcade.results);
  arcade.phase = "reveal";
  const live = document.getElementById("live");
  const level = arcade.levels[arcade.level];
  const a = text().arcade;
  if (live) live.textContent = `${level.symbol}. ${a.lessons[scored.lesson]} ${scored.points}`;
  render();
}

function startRace() {
  stopRace();
  const token = ++raceToken;
  const sim = arcade.current;
  if (!sim) return;
  const canvas = document.getElementById("race-chart");
  const youNode = document.getElementById("race-you");
  const benchNode = document.getElementById("race-bench");
  if (!canvas) return;
  const drawAt = (count) => {
    paintRace(canvas, sim.equity, sim.bench, count);
    const i = Math.max(0, count - 1);
    if (youNode) youNode.textContent = formatPct(sim.equity[i] - 1);
    if (benchNode) benchNode.textContent = formatPct(sim.bench[i] - 1);
  };
  if (reduceMotion) {
    drawAt(sim.equity.length);
    finishLevel();
    return;
  }
  const started = performance.now();
  const step = (now) => {
    if (token !== raceToken || arcade.phase !== "race") return;
    const raw = Math.min(1, (now - started) / RACE_MS);
    const eased = raw * raw * (3 - 2 * raw);
    const count = Math.max(2, Math.round(1 + eased * (sim.equity.length - 1)));
    drawAt(count);
    if (raw < 1) raceFrame = requestAnimationFrame(step);
    else {
      const num = document.getElementById("race-you");
      if (num) num.classList.add(sim.ret >= sim.benchRet ? "flash-up" : "flash-down");
      setTimeout(() => {
        if (token === raceToken) finishLevel();
      }, 700);
    }
  };
  raceFrame = requestAnimationFrame(step);
}

function nextAfterReveal() {
  if (arcade.level >= 4) {
    arcade.phase = "end";
    arcade.elapsed = arcade.startedAt ? Date.now() - arcade.startedAt : 0;
    const state = loadState();
    if (!state.best || arcade.total > state.best.score) {
      state.best = { score: arcade.total, date: today() };
    }
    if (!state.learnStart) state.learnStart = today();
    saveState(state);
    render();
    if (!arcade.asked) {
      arcade.asked = true;
      maybeEnterBoard("daily", arcade.total, {
        levels: arcade.results,
        cards: arcade.cards,
      });
    }
    return;
  }
  arcade.level += 1;
  arcade.draft = arcade.cards.slice();
  arcade.phase = "stack";
  render();
}

function shareRun() {
  const a = text().arcade;
  const lines = arcade.levels.map((level, index) => `${a.windows[level.id]} ${arcade.results[index]}`).join(" · ");
  const message = `Stack ${today()}\n${lines}\n${arcade.total}\ntravaglino.me/trader/`;
  navigator.clipboard?.writeText(message).then(() => {
    const live = document.getElementById("live");
    if (live) live.textContent = a.copied;
  }).catch(() => {});
}

function renderStackChips(a) {
  const chips = el("div", { class: "stack", role: "list", "aria-label": a.emptyStack });
  const ids = arcade.draft.length ? arcade.draft : ["hold"];
  ids.forEach((id) => {
    const label = id === "hold" && !arcade.draft.length ? a.emptyStack : a.cards[id][0];
    chips.append(el("span", { class: arcade.draft.length ? "chip" : "chip ghost", role: "listitem", text: label }));
  });
  return chips;
}

function renderArcade() {
  const t = text();
  const a = t.arcade;
  if (!arcade) freshArcade();
  const host = el("div", { class: "arcade" });
  const hud = el("div", { class: "hud" });
  const pips = el("div", { class: "pips", role: "img", "aria-label": `${a.level} ${arcade.level + 1}/5` });
  for (let i = 0; i < 5; i += 1) {
    const pip = el("i", { class: i < arcade.level ? "on" : i === arcade.level && arcade.phase !== "start" ? "now" : "" });
    pips.append(pip);
  }
  hud.append(pips);
  hud.append(el("span", { class: "clock", id: "clock", text: arcade.phase === "start" ? "0:00" : clockText() }));
  host.append(hud);

  if (arcade.phase === "start") {
    host.append(el("button", { type: "button", class: "play", id: "act", text: a.play, onClick: () => {
      arcade.phase = "stack";
      arcade.startedAt = Date.now();
      render();
    } }));
  } else if (arcade.phase === "stack") {
    const level = arcade.levels[arcade.level];
    host.append(el("p", { class: "window", text: `${arcade.level + 1}/5 · ${a.windows[level.id]}` }));
    host.append(renderStackChips(a));
    host.append(el("p", { class: "hint", text: arcade.level === 0 ? a.hintStack : a.hintChange }));
    const grid = el("div", { class: "cards", role: "group", "aria-label": a.hintStack });
    CARD_IDS.forEach((id, index) => {
      const on = arcade.draft.includes(id);
      grid.append(el("button", {
        type: "button",
        class: "card",
        "aria-pressed": on ? "true" : "false",
        "data-card": id,
        onClick: () => tapCard(id),
      }, [
        el("strong", { text: a.cards[id][0] }),
        el("small", { text: `${index + 1} · ${a.cards[id][1]}` }),
      ]));
    });
    host.append(grid);
    host.append(el("button", { type: "button", class: "play", id: "act", text: a.run, onClick: commitAndRun }));
  } else if (arcade.phase === "race" || arcade.phase === "reveal") {
    const level = arcade.levels[arcade.level];
    const sim = arcade.current;
    host.append(el("p", { class: "window", text: arcade.phase === "reveal" ? `${level.symbol} · ${monthSpan(level)}` : a.windows[level.id] }));
    const nums = el("div", { class: "race-nums" });
    nums.append(el("p", {}, [el("span", { text: a.you }), el("strong", { id: "race-you", class: "race-num", text: formatPct(0) })]));
    nums.append(el("p", {}, [el("span", { text: a.hold }), el("strong", { id: "race-bench", text: formatPct(0) })]));
    host.append(nums);
    if (arcade.phase === "reveal") {
      const scored = arcade.pending;
      host.append(el("p", { class: scored.beat ? "lesson win" : "lesson lose", text: a.lessons[scored.lesson] }));
      host.append(el("p", { class: "meta" }, [
        el("span", {}, [el("strong", { text: String(scored.points) })]),
        el("span", { text: scored.beat ? a.beat : a.missed }),
        el("span", {}, [`${a.streak} ×${scored.multiplier.toFixed(2)}`]),
      ]));
      host.append(el("button", {
        type: "button",
        class: "play",
        id: "act",
        text: a.next,
        onClick: nextAfterReveal,
      }));
    } else host.append(el("p", { class: "hint", text: a.hintRace }));
    host.append(el("div", { class: "chart-wrap race-chart" }, [
      el("canvas", { id: "race-chart", role: "img", "aria-label": a.hintRace }),
    ]));
    if (arcade.phase === "reveal") {
      requestAnimationFrame(() => {
        const canvas = document.getElementById("race-chart");
        if (canvas && sim) paintRace(canvas, sim.equity, sim.bench, sim.equity.length);
        const youNode = document.getElementById("race-you");
        const benchNode = document.getElementById("race-bench");
        if (youNode) youNode.textContent = formatPct(sim.ret);
        if (benchNode) benchNode.textContent = formatPct(sim.benchRet);
      });
    }
  } else {
    const bestIndex = arcade.results.reduce((best, value, index) => (value > arcade.results[best] ? index : best), 0);
    const bestLevel = arcade.levels[bestIndex];
    host.append(el("p", { class: "hint", text: a.hintPlay }));
    host.append(el("p", { class: `race-num end-score ${arcade.total >= 0 ? "up" : "down"}`, text: String(arcade.total) }));
    host.append(el("p", { class: "meta" }, [
      el("span", {}, [`${a.best} · ${a.windows[bestLevel.id]} ${arcade.results[bestIndex]}`]),
      el("span", {}, [`${a.clock} ${clockText()}`]),
    ]));
    const row = el("div", { class: "row" });
    row.append(el("button", { type: "button", class: "ghost", text: a.share, onClick: shareRun }));
    row.append(el("button", { type: "button", class: "play", id: "act", text: a.again, onClick: () => { arcade = null; freshArcade(); render(); } }));
    host.append(row);
  }

  const tools = el("div", { class: "quiet" });
  tools.append(el("button", { type: "button", class: "text-btn", text: t.scoring, onClick: openScoring }));
  tools.append(el("button", { type: "button", class: "text-btn", text: t.learn, onClick: renderLearn }));
  tools.append(el("button", { type: "button", class: "text-btn", text: t.portfolio, onClick: () => { mode = "portfolio"; render(); } }));
  host.append(tools);
  root.append(host);
}

function tapCard(id) {
  if (!arcade || arcade.phase !== "stack") return;
  if (arcade.level === 0) {
    if (arcade.draft.includes(id)) arcade.draft = arcade.draft.filter((card) => card !== id);
    else if (arcade.draft.length < 4) arcade.draft = arcade.draft.concat(id);
  } else {
    const base = arcade.cards;
    const next = base.includes(id) ? base.filter((card) => card !== id) : base.length < 4 ? base.concat(id) : base.slice(1).concat(id);
    arcade.draft = next.join("|") === arcade.draft.join("|") ? base.slice() : next;
  }
  render();
}

function openScoring() {
  const t = text();
  const dialog = document.getElementById("score-dialog");
  dialog.replaceChildren(
    el("h2", { id: "score-title", text: t.scoring }),
    el("p", { text: t.scoringBody }),
    el("button", { type: "button", class: "play", text: t.close, onClick: () => dialog.close() })
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
          class: "play",
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
      class: "ghost",
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
  maybeEnterBoard("portfolio", run.score, { months: run.values.length - 1 });
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
  host.append(el("button", { type: "button", class: "text-btn", text: t.arcade.play, onClick: () => { mode = "arcade"; render(); } }));
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
        el("button", { type: "button", text: "−", "aria-label": `${symbol} −10`, disabled: !ready || !run.weights[symbol], onClick: () => shiftWeight(symbol, -10) }),
        el("output", { text: `${run.weights[symbol] || 0}%` }),
        el("button", { type: "button", text: "+", "aria-label": `${symbol} +10`, disabled: !ready || used >= 100, onClick: () => shiftWeight(symbol, 10) }),
      ]));
    }
    alloc.append(el("div", {}, [el("span", { text: t.cash }), el("span"), el("output", { text: `${100 - used}%` }), el("span")]));
    host.append(alloc);
    const row = el("div", { class: "row" });
    row.append(el("button", { type: "button", class: "play", text: t.next, onClick: () => { stepRun(); render(); } }));
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
    host.append(el("button", { type: "button", class: "play", text: t.newRun, onClick: () => { run = null; freshRun(); render(); } }));
  }
  root.append(host);
  requestAnimationFrame(() => {
    const box = document.getElementById("port-chart");
    if (box) paintCurves(box, run.values, run.bench);
  });
}

function shiftWeight(symbol, delta) {
  const next = Math.max(0, (run.weights[symbol] || 0) + delta);
  let others = 0;
  for (const key of ASSETS) if (key !== symbol) others += run.weights[key] || 0;
  run.weights[symbol] = Math.min(next, 100 - others);
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
    el("button", { type: "button", class: "play", text: t.close, onClick: () => learnDialog.close() })
  );
  if (!learnDialog.open) learnDialog.showModal();
}

function render() {
  const t = text();
  stopRace();
  root.replaceChildren();
  if (loadError) {
    root.append(el("p", { class: "lesson", text: loadError }));
    return;
  }
  if (!pack) {
    root.append(el("p", { class: "hint", text: t.loading }));
    return;
  }
  if (mode === "portfolio") renderPortfolio();
  else renderArcade();
  root.append(el("p", { class: "fine", text: t.disclaimer }));
  renderBoard();
  if (arcade?.phase === "race") startRace();
  const clock = document.getElementById("clock");
  if (clock && arcade?.startedAt && arcade.phase !== "start") clock.textContent = clockText();
}

document.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.target.closest("input, textarea, dialog")) return;
  if (mode !== "arcade" || !arcade) return;
  if (event.key === "Enter") {
    event.preventDefault();
    document.getElementById("act")?.click();
    return;
  }
  if (arcade.phase !== "stack") return;
  const index = Number(event.key) - 1;
  if (index >= 0 && index < CARD_IDS.length) tapCard(CARD_IDS[index]);
});

document.addEventListener("it-lang", (event) => {
  lang = event.detail.lang;
  render();
});

setInterval(() => {
  const clock = document.getElementById("clock");
  if (clock && arcade?.startedAt && arcade.phase !== "start" && arcade.phase !== "end") clock.textContent = clockText();
}, 1000);

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
