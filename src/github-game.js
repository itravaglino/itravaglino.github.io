import { initI18n, getLang } from "./i18n.js";
import { createSim } from "./git-sim.js";
import { LEVELS, levelById, missionComplete, missionState, runCommand, uiText } from "./github-levels.js";

const STORAGE_KEY = "it-git-game";
const ONBOARD_KEY = "it-git-onboarded";
const SVG_NS = "http://www.w3.org/2000/svg";
const MISSION_ICONS = ["🌱", "✏️", "📜", "🌿", "🔀", "☁️", "🐙"];
const BRANCH_MAIN = "#ff6b6b";
const BRANCH_FEATURE = "#b6f25c";
const BRANCH_LOCAL = "#d7b0ff";
const BRANCH_ORIGIN = "#4cc9f0";

initI18n();

const sim = createSim();
let lang = getLang();
let completed = [];
let current = 1;
let celebrated = false;
let history = [];
let termLines = [];
let termVersion = 0;
let renderedTerm = -1;
let focusFile = "bitacora.txt";
let commandHistory = [];
let histIndex = 0;
let motionPrimed = false;
let wasDone = false;
let freshLocal = new Set();
let freshRemote = false;
let zoneMemory = { work: "", index: "", repo: "" };

const ui = () => uiText(lang);
const pick = (bag) => (lang === "en" ? bag.en : bag.es);
const level = () => levelById(current);
const ctx = () => ({ sim, history });

function isUnlocked(id) {
  if (id <= 1) return true;
  return completed.includes(id) || completed.includes(id - 1);
}

function loadProgress() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!data || data.v !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

function save() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        v: 1,
        completed,
        current,
        celebrated,
        snapLevel: current,
        snap: sim.snapshot(),
        history,
        terminal: termLines.slice(-160),
      })
    );
  } catch {
    /* private mode or full storage */
  }
}

function intro() {
  const item = level();
  return lang === "en" ? `Mission ${item.id}: ${item.title.en}` : `Misión ${item.id}: ${item.title.es}`;
}

function boot() {
  const saved = loadProgress();
  completed = Array.isArray(saved?.completed) ? saved.completed.filter((id) => LEVELS.some((item) => item.id === id)) : [];
  celebrated = Boolean(saved?.celebrated);
  const wanted = Number(saved?.current) || 1;
  current = LEVELS.some((item) => item.id === wanted) && isUnlocked(wanted) ? wanted : 1;
  let restored = false;
  if (saved?.snap && saved.snapLevel === current) {
    try {
      sim.restore(saved.snap);
      history = Array.isArray(saved.history) ? saved.history.map(String) : [];
      termLines = Array.isArray(saved.terminal) ? saved.terminal.slice(-160) : [];
      commandHistory = [...history];
      histIndex = commandHistory.length;
      restored = true;
    } catch {
      restored = false;
    }
  }
  if (!restored) {
    level().setup(sim);
    history = [];
    termLines = [{ type: "info", text: intro() }];
    commandHistory = [];
    histIndex = 0;
  }
  focusFile = level().focusFile;
  termVersion += 1;
}

function branchColor(labels) {
  const names = labels.filter((label) => label !== "HEAD" && !label.startsWith("origin/"));
  if (names.some((name) => name !== "main")) return BRANCH_FEATURE;
  if (labels.some((label) => String(label).startsWith("origin"))) return BRANCH_ORIGIN;
  if (names.includes("main")) return BRANCH_MAIN;
  return BRANCH_LOCAL;
}

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function celebrate(big) {
  if (reducedMotion()) return;
  const layer = document.getElementById("confetti");
  if (!layer) return;
  const colors = [BRANCH_MAIN, "#ffe14a", "#3ddec8", BRANCH_ORIGIN, BRANCH_LOCAL, BRANCH_FEATURE, "#ff9f1c"];
  const count = big ? 72 : 40;
  for (let index = 0; index < count; index += 1) {
    const bit = document.createElement("i");
    bit.className = "confetti-bit";
    bit.style.left = `${Math.random() * 100}%`;
    bit.style.background = colors[index % colors.length];
    bit.style.setProperty("--dx", `${(Math.random() - 0.5) * 280}px`);
    bit.style.animationDelay = `${Math.random() * 0.18}s`;
    bit.style.animationDuration = `${1.05 + Math.random() * 0.75}s`;
    layer.append(bit);
    window.setTimeout(() => bit.remove(), 2000);
  }
}

function noteMotion(model, done) {
  const localIds = new Set((model.localGraph?.nodes || []).map((node) => node.id));
  const remoteIds = new Set((model.remoteGraph?.nodes || []).map((node) => node.id));
  if (!motionPrimed) {
    motionPrimed = true;
    freshLocal = new Set();
    freshRemote = false;
    wasDone = done;
    noteMotion.local = localIds;
    noteMotion.remote = remoteIds;
    return;
  }
  freshLocal = new Set([...localIds].filter((id) => !noteMotion.local.has(id)));
  freshRemote = [...remoteIds].some((id) => !noteMotion.remote.has(id));
  if (done && !wasDone) celebrate(current === 7);
  noteMotion.local = localIds;
  noteMotion.remote = remoteIds;
  wasDone = done;
}

function resetMotion() {
  motionPrimed = false;
  wasDone = false;
  freshLocal = new Set();
  freshRemote = false;
}

function titleRow(titleId, tipId, tag = "h2") {
  const row = h("div", { className: "title-row" });
  const button = h("button", { type: "button", className: "tip-btn", id: `${tipId}-btn`, text: "ⓘ" });
  button.setAttribute("aria-controls", tipId);
  button.setAttribute("aria-expanded", "false");
  const pop = h("p", { id: tipId, className: "tip-pop", role: "tooltip" });
  pop.hidden = true;
  button.addEventListener("click", () => {
    const opening = pop.hidden;
    document.querySelectorAll(".tip-pop").forEach((node) => {
      node.hidden = true;
    });
    document.querySelectorAll(".tip-btn").forEach((node) => node.setAttribute("aria-expanded", "false"));
    pop.hidden = !opening;
    button.setAttribute("aria-expanded", opening ? "true" : "false");
  });
  row.append(h(tag, { id: titleId }), button, pop);
  return row;
}

function setTip(id, label, text) {
  const pop = document.getElementById(id);
  const button = document.getElementById(`${id}-btn`);
  if (!pop || !button) return;
  pop.textContent = text;
  button.setAttribute("aria-label", label);
}

function h(tag, props = {}) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null) continue;
    if (key === "className") node.className = value;
    else if (key === "text") node.textContent = value;
    else node.setAttribute(key, String(value));
  }
  return node;
}

function build() {
  const root = document.getElementById("game-root");
  const map = h("ol", { className: "level-map" });
  const pr = h("section", { className: "panel pr-panel", id: "pr-panel" });
  pr.hidden = true;
  const mission = h("section", { className: "panel mission", "aria-labelledby": "mission-title" });
  const tools = h("div", { className: "stack" });
  const viz = h("div", { className: "stack" });
  const shell = h("div", { className: "game-shell" });
  shell.append(mission, tools, viz);
  const finale = h("dialog", { id: "finale", "aria-labelledby": "finale-title" });
  const onboard = h("dialog", { id: "onboard", "aria-labelledby": "onboard-title" });
  const quest = h("section", { className: "quest", "aria-labelledby": "quest-label" });
  const bar = h("div", { id: "quest-bar", className: "quest-bar", role: "progressbar" });
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", String(LEVELS.length));
  bar.append(h("span", { id: "quest-fill" }));
  quest.append(titleRow("quest-label", "tip-map", "p"), bar, map);
  const confetti = h("div", { id: "confetti", className: "confetti-layer", "aria-hidden": "true" });
  root.append(quest, pr, shell, finale, onboard, confetti);

  mission.append(
    titleRow("mission-title", "tip-mission"),
    h("div", { id: "mission-copy" }),
    titleRow("objective-label", "tip-steps", "h3"),
    h("ul", { id: "objectives", className: "objectives" }),
    h("details", { className: "hints", id: "hints" }),
    h("div", { id: "success", className: "success-banner", role: "status" }),
    h("div", { className: "mission-actions", id: "mission-actions" }),
    h("details", { className: "reset-all", id: "reset-all" })
  );
  document.getElementById("success").hidden = true;

  const editorPanel = h("section", { className: "panel", "aria-labelledby": "editor-title" });
  const termPanel = h("section", { className: "panel", "aria-labelledby": "term-title" });
  tools.append(editorPanel, termPanel);
  editorPanel.append(
    titleRow("editor-title", "tip-editor"),
    h("p", { id: "path-note", className: "path-note" }),
    h("div", { id: "file-tabs", className: "file-tabs" }),
    h("label", { className: "sr-only", id: "editor-label", for: "file-editor" }),
    h("textarea", {
      id: "file-editor",
      className: "editor",
      spellcheck: "false",
      autocapitalize: "off",
      autocorrect: "off",
    }),
    h("p", { id: "conflict-note", className: "conflict-note" })
  );
  termPanel.append(
    titleRow("term-title", "tip-terminal"),
    h("div", { id: "term-out", tabindex: "0" }),
    h("div", { id: "term-status", className: "sr-only", "aria-live": "polite" }),
    h("form", { id: "term-form", className: "term-form", autocomplete: "off" }),
    h("p", { id: "chip-lead", className: "chip-lead" }),
    h("div", { id: "chips", className: "chips" })
  );
  const form = document.getElementById("term-form");
  form.append(h("span", { id: "prompt", className: "prompt", "aria-hidden": "true" }), h("input", { id: "term-input" }));
  document.getElementById("term-out").className = "term-out";

  const graphPanel = h("section", { className: "panel", "aria-labelledby": "graph-title" });
  const zonePanel = h("section", { className: "panel", "aria-labelledby": "zone-title" });
  viz.append(graphPanel, zonePanel);
  graphPanel.append(titleRow("graph-title", "tip-graph"), h("ul", { id: "branch-legend", className: "branch-legend" }), h("div", { id: "graph-split", className: "graph-split" }));
  zonePanel.append(titleRow("zone-title", "tip-zones"), h("p", { id: "zone-help", className: "zone-help" }), h("div", { id: "zones", className: "zones" }));

  document.getElementById("hints").append(h("summary"), h("ol"));
  document.getElementById("reset-all").append(h("summary"), h("button", { type: "button", className: "btn btn-ghost", id: "erase" }));
  finale.append(h("h2", { id: "finale-title" }), h("p", { id: "finale-body", className: "finale-copy" }), h("ol", { id: "finale-list" }), h("p", { id: "finale-replay", className: "finale-copy" }), h("button", { type: "button", className: "btn btn-next", id: "finale-close" }));
  onboard.append(h("p", { id: "onboard-kicker", className: "onboard-kicker" }), h("h2", { id: "onboard-title" }), h("ol", { id: "onboard-steps", className: "onboard-steps" }), h("button", { type: "button", className: "btn btn-next", id: "onboard-go" }));

  const editor = document.getElementById("file-editor");
  editor.addEventListener("input", () => {
    sim.write(focusFile, editor.value);
    paint({ skipEditor: true });
    save();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const raw = document.getElementById("term-input").value;
    document.getElementById("term-input").value = "";
    const lines = raw.split(/\n/).map((line) => line.trim()).filter(Boolean);
    for (const line of lines) runLine(line);
    if (!lines.length) paint();
  });
  document.getElementById("term-input").addEventListener("keydown", (event) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    if (event.key === "ArrowUp" && histIndex > 0) histIndex -= 1;
    if (event.key === "ArrowDown") histIndex = Math.min(commandHistory.length, histIndex + 1);
    document.getElementById("term-input").value = commandHistory[histIndex] || "";
  });
  document.getElementById("erase").addEventListener("click", () => {
    completed = [];
    celebrated = false;
    startLevel(1);
    termLines.push({ type: "info", text: ui().allReset });
    termVersion += 1;
    paint();
    save();
  });
  document.getElementById("finale-close").addEventListener("click", () => finale.close());
  finale.addEventListener("close", () => {
    celebrated = true;
    save();
  });
  document.getElementById("onboard-go").addEventListener("click", () => {
    try {
      localStorage.setItem(ONBOARD_KEY, "1");
    } catch {
      /* private mode */
    }
    onboard.close();
  });
  onboard.addEventListener("close", () => {
    try {
      localStorage.setItem(ONBOARD_KEY, "1");
    } catch {
      /* private mode */
    }
  });
  return { map, pr, editor, finale, onboard };
}

const els = build();

function startLevel(id) {
  if (!isUnlocked(id)) return;
  resetMotion();
  current = id;
  focusFile = level().focusFile;
  level().setup(sim);
  history = [];
  commandHistory = [];
  histIndex = 0;
  termLines = [{ type: "info", text: intro() }];
  termVersion += 1;
  syncEditor(true);
  paint();
  save();
}

function runLine(line) {
  history.push(line);
  commandHistory.push(line);
  histIndex = commandHistory.length;
  const before = sim.model();
  termLines.push({ type: "cmd", text: `${before.prompt} ${line}` });
  const result = runCommand(sim, level(), line, lang);
  if (result.code === "clear") termLines = [];
  else termLines.push(...result.lines);
  if (termLines.length > 160) termLines = termLines.slice(-160);
  termVersion += 1;
  const last = result.lines[result.lines.length - 1];
  document.getElementById("term-status").textContent = last ? last.text : line;
  syncEditor(true);
  const done = safeComplete();
  if (done && !completed.includes(current)) completed.push(current);
  paint();
  save();
  if (current === 7 && done && !celebrated && !els.finale.open) els.finale.showModal();
}

function safeComplete() {
  try {
    return missionComplete(level(), ctx());
  } catch {
    return false;
  }
}

function safeState() {
  try {
    return missionState(level(), ctx());
  } catch {
    return level().objectives.map((item) => ({ id: item.id, label: item.label, done: false }));
  }
}

function syncEditor(force) {
  const value = sim.read(focusFile);
  const text = value == null ? "" : value;
  const editor = els.editor;
  editor.placeholder = value == null ? ui().placeholder : "";
  if (force || document.activeElement !== editor) {
    if (editor.value !== text) editor.value = text;
  }
}

function renderTerminal() {
  if (renderedTerm === termVersion) return;
  const out = document.getElementById("term-out");
  const top = out.scrollTop;
  const stick = out.scrollHeight - top - out.clientHeight < 48;
  out.replaceChildren();
  for (const line of termLines) {
    const row = h("p", { className: `term-line ${line.type || "out"}`, text: line.text });
    out.append(row);
  }
  out.scrollTop = stick ? out.scrollHeight : top;
  renderedTerm = termVersion;
}

function renderGraph(host, graph, caption, emptyText, freshIds, fly) {
  const figure = h("figure", { className: `graph-card${fly ? " is-flying" : ""}` });
  figure.append(h("figcaption", { text: caption }));
  const scroll = h("div", { className: "graph-scroll" });
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  const empty = h("p", { className: "graph-empty", text: emptyText });
  if (!graph || graph.empty) {
    svg.setAttribute("viewBox", "0 0 10 10");
    empty.hidden = false;
  } else {
    empty.hidden = true;
    svg.setAttribute("viewBox", `0 0 ${graph.width} ${graph.height}`);
    for (const edge of graph.edges) {
      const path = document.createElementNS(SVG_NS, "path");
      const mid = (edge.y1 + edge.y2) / 2;
      const d = edge.x1 === edge.x2 ? `M ${edge.x1} ${edge.y1} L ${edge.x2} ${edge.y2}` : `M ${edge.x1} ${edge.y1} C ${edge.x1} ${mid}, ${edge.x2} ${mid}, ${edge.x2} ${edge.y2}`;
      path.setAttribute("d", d);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "rgba(255,248,239,0.62)");
      path.setAttribute("stroke-width", "2");
      svg.append(path);
    }
    for (const node of graph.nodes) {
      const tone = branchColor(node.labels);
      const circle = document.createElementNS(SVG_NS, "circle");
      circle.setAttribute("cx", String(node.x));
      circle.setAttribute("cy", String(node.y));
      circle.setAttribute("r", node.head ? "9" : "7");
      circle.setAttribute("fill", node.head ? tone : "#24183f");
      circle.setAttribute("stroke", tone);
      circle.setAttribute("stroke-width", "3");
      if (!node.pushed) circle.setAttribute("stroke-dasharray", "3 2");
      if (freshIds?.has(node.id) || (fly && freshIds?.has("*") && node.head)) circle.setAttribute("class", "pop");
      const title = document.createElementNS(SVG_NS, "title");
      title.textContent = `${node.id} ${node.message}`;
      circle.append(title);
      svg.append(circle);
      if (node.labels.length) {
        const label = document.createElementNS(SVG_NS, "text");
        label.setAttribute("x", String(node.x + 14));
        label.setAttribute("y", String(node.y - 6));
        label.setAttribute("fill", tone);
        label.setAttribute("font-size", "11");
        label.setAttribute("font-family", "IBM Plex Mono, ui-monospace, monospace");
        label.textContent = node.labels.join(" · ");
        svg.append(label);
      }
      const msg = document.createElementNS(SVG_NS, "text");
      msg.setAttribute("x", String(node.x + 14));
      msg.setAttribute("y", String(node.y + 12));
      msg.setAttribute("fill", "#fff8ef");
      msg.setAttribute("font-size", "12");
      msg.setAttribute("font-family", "IBM Plex Mono, ui-monospace, monospace");
      msg.textContent = `${node.id}  ${node.message}`.slice(0, 46);
      svg.append(msg);
    }
  }
  scroll.append(svg, empty);
  figure.append(scroll);
  if (graph && !graph.empty) {
    const list = h("ol", { className: "history-list" });
    const nodes = [...graph.nodes].sort((a, b) => b.y - a.y);
    for (const node of nodes) {
      const refs = node.labels.length ? ` (${node.labels.join(", ")})` : "";
      const pushed = node.pushed ? "" : ` · ${ui().unpushed}`;
      list.append(h("li", { text: `${node.id}${refs} ${node.message}${pushed}` }));
    }
    figure.append(list);
  }
  host.append(figure);
}

function zoneFiles(title, predicate, kind, icon, caption, flash) {
  const box = h("div", { className: `zone zone-${kind}${flash ? " flash" : ""}` });
  box.append(h("h3", { text: `${icon} ${title}` }), h("p", { className: "zone-caption", text: caption }));
  const model = sim.model();
  const files = model.files.filter(predicate);
  if (!files.length) box.append(h("p", { className: "muted", text: ui().emptyZone }));
  for (const file of files) {
    const pill = h("div", { className: "file-pill" });
    pill.append(h("strong", { text: file.name }), h("span", { text: ui().status[file.status] || file.status }));
    const preview = file.preview.split("\n").slice(0, 4).join("\n");
    if (preview) pill.append(h("code", { text: preview }));
    box.append(pill);
  }
  return box;
}

function paint(options = {}) {
  const copy = ui();
  const item = level();
  const model = sim.model();
  const state = safeState();
  const done = state.every((entry) => entry.done);

  const doneCount = state.filter((entry) => entry.done).length;
  const stepNumber = done ? state.length : Math.min(state.length, doneCount + 1);
  const barValue = completed.filter((id) => id !== current).length + doneCount / state.length;
  const questLabel = copy.progressOf
    .replace("{current}", String(item.id))
    .replace("{total}", String(LEVELS.length))
    .replace("{step}", String(stepNumber))
    .replace("{steps}", String(state.length));
  document.getElementById("quest-label").textContent = `${MISSION_ICONS[item.id - 1] || "★"} ${questLabel}`;
  const questBar = document.getElementById("quest-bar");
  questBar.setAttribute("aria-valuenow", String(Math.round(barValue)));
  questBar.setAttribute("aria-valuetext", questLabel);
  document.getElementById("quest-fill").style.width = `${Math.min(100, (barValue / LEVELS.length) * 100)}%`;
  setTip("tip-map", copy.progress, copy.tipMap);

  els.map.replaceChildren();
  els.map.setAttribute("aria-label", copy.progress);
  for (const entry of LEVELS) {
    const open = isUnlocked(entry.id);
    const icon = MISSION_ICONS[entry.id - 1] || "★";
    const mark = completed.includes(entry.id) ? "✓ " : "";
    const button = h("button", {
      type: "button",
      text: `${mark}${icon} ${entry.id} ${pick(entry.short)}`,
      title: open ? pick(entry.title) : copy.locked,
    });
    if (!open) button.disabled = true;
    if (entry.id === current) button.setAttribute("aria-current", "step");
    if (completed.includes(entry.id)) button.classList.add("is-done");
    button.addEventListener("click", () => {
      if (entry.id !== current) startLevel(entry.id);
    });
    const li = h("li");
    li.append(button);
    els.map.append(li);
  }

  document.getElementById("mission-title").textContent = `${MISSION_ICONS[item.id - 1] || ""} ${item.id}. ${pick(item.title)}`;
  setTip("tip-mission", copy.objective, copy.tipMission);
  const missionCopy = document.getElementById("mission-copy");
  missionCopy.replaceChildren();
  for (const paragraph of pick(item.explain)) missionCopy.append(h("p", { text: paragraph }));
  document.getElementById("objective-label").textContent = copy.objective;
  setTip("tip-steps", copy.now, copy.tipSteps);
  const objectives = document.getElementById("objectives");
  objectives.replaceChildren();
  const nowIndex = state.findIndex((entry) => !entry.done);
  state.forEach((entry, index) => {
    const li = h("li");
    if (entry.done) li.classList.add("is-done");
    if (index === nowIndex) {
      li.classList.add("is-now");
      li.setAttribute("aria-current", "step");
    }
    const badge = h("span", { className: "step-num", "aria-hidden": "true", text: entry.done ? "✓" : String(index + 1) });
    const text = h("span", { text: pick(entry.label) });
    const status = entry.done ? copy.done : index === nowIndex ? copy.now : copy.pending;
    text.prepend(h("span", { className: "sr-only", text: `${status}. ` }));
    li.append(badge, text);
    objectives.append(li);
  });
  const hints = document.getElementById("hints");
  hints.querySelector("summary").textContent = copy.hints;
  const hintList = hints.querySelector("ol");
  hintList.replaceChildren();
  for (const hint of pick(item.hints)) hintList.append(h("li", { text: hint }));
  const success = document.getElementById("success");
  success.hidden = !done;
  success.replaceChildren();
  if (done) {
    success.append(h("p", { className: "success-kicker", text: `🎉 ${copy.nice}` }));
    success.append(h("p", { text: pick(item.success) }));
  }

  const actions = document.getElementById("mission-actions");
  actions.replaceChildren();
  if (done && current < LEVELS.length) {
    const upcoming = levelById(current + 1);
    const next = h("button", { type: "button", className: "btn btn-next", text: `${copy.next}: ${pick(upcoming.short)} →` });
    next.addEventListener("click", () => startLevel(current + 1));
    actions.append(next);
  }
  const reset = h("button", { type: "button", className: "btn btn-ghost", text: copy.reset });
  reset.addEventListener("click", () => startLevel(current));
  actions.append(reset);
  if (completed.includes(7)) {
    const diploma = h("button", { type: "button", className: "btn btn-ghost", text: copy.diploma });
    diploma.addEventListener("click", () => els.finale.showModal());
    actions.append(diploma);
  }
  const resetAll = document.getElementById("reset-all");
  resetAll.querySelector("summary").textContent = copy.resetAll;
  document.getElementById("erase").textContent = copy.resetAll;

  document.getElementById("editor-title").textContent = `✏️ ${copy.editor}`;
  setTip("tip-editor", copy.editor, copy.tipEditor);
  document.getElementById("editor-label").textContent = copy.fileLabel;
  document.getElementById("path-note").textContent = `${model.cwd}/${focusFile}`;
  const names = [...new Set([...model.files.map((file) => file.name), focusFile])];
  const tabs = document.getElementById("file-tabs");
  tabs.replaceChildren();
  for (const name of names) {
    const tab = h("button", { type: "button", text: name });
    tab.setAttribute("aria-pressed", name === focusFile ? "true" : "false");
    tab.addEventListener("click", () => {
      focusFile = name;
      syncEditor(true);
      paint();
    });
    tabs.append(tab);
  }
  const conflict = model.conflictPaths.includes(focusFile);
  els.editor.classList.toggle("is-conflict", conflict);
  els.editor.setAttribute("aria-invalid", conflict ? "true" : "false");
  els.editor.setAttribute("aria-describedby", "conflict-note");
  const conflictNote = document.getElementById("conflict-note");
  conflictNote.hidden = !conflict;
  conflictNote.textContent = conflict ? copy.conflict : "";
  if (!options.skipEditor) syncEditor(false);

  document.getElementById("term-title").textContent = `💻 ${copy.terminal}`;
  setTip("tip-terminal", copy.terminal, copy.tipTerminal);
  document.getElementById("chip-lead").textContent = copy.chipLead;
  const input = document.getElementById("term-input");
  input.setAttribute("aria-label", copy.command);
  input.placeholder = "git …";
  input.spellcheck = false;
  input.autocomplete = "off";
  input.autocapitalize = "off";
  document.getElementById("prompt").textContent = model.prompt;
  document.getElementById("term-out").setAttribute("aria-label", copy.terminal);
  renderTerminal();
  const chips = document.getElementById("chips");
  chips.replaceChildren();
  item.chips.forEach((command, index) => {
    const chip = h("button", { type: "button", text: command });
    const suggested = !done && index === nowIndex;
    if (suggested) chip.classList.add("is-next");
    chip.setAttribute("aria-label", `${suggested ? `${copy.now}. ` : ""}${copy.insert}: ${command}`);
    chip.addEventListener("click", () => {
      input.value = command;
      input.focus();
      document.getElementById("term-status").textContent = copy.pasted;
    });
    chips.append(chip);
  });

  document.getElementById("graph-title").textContent = `🗺️ ${copy.history}`;
  setTip("tip-graph", copy.graphHelp, copy.tipGraph);
  const legend = document.getElementById("branch-legend");
  legend.replaceChildren();
  for (const entry of [
    [BRANCH_MAIN, copy.legendMain],
    [BRANCH_FEATURE, copy.legendFeature],
    [BRANCH_LOCAL, copy.legendLocal],
    [BRANCH_ORIGIN, copy.legendOrigin],
  ]) {
    const li = h("li", { text: entry[1] });
    const swatch = h("i", { className: "swatch", "aria-hidden": "true" });
    swatch.style.background = entry[0];
    li.prepend(swatch);
    legend.append(li);
  }
  noteMotion(model, done);
  const split = document.getElementById("graph-split");
  split.replaceChildren();
  renderGraph(split, model.localGraph, `💻 ${copy.local}`, copy.noCommits, freshLocal, false);
  renderGraph(split, model.remoteGraph, `☁️ ${model.remoteLabel || copy.remote}`, model.remoteLabel ? copy.noCommits : copy.noRemote, freshRemote ? new Set(["*"]) : new Set(), freshRemote);

  const workSig = model.files.filter((file) => file.inWork).map((file) => `${file.name}:${file.status}`).join();
  const indexSig = model.files.filter((file) => file.inIndex).map((file) => `${file.name}:${file.status}`).join();
  const repoSig = model.files.filter((file) => file.inHead).map((file) => `${file.name}:${file.status}`).join();
  document.getElementById("zone-title").textContent = `🧰 ${copy.work} · ${copy.index} · ${copy.repo}`;
  setTip("tip-zones", copy.zoneHelp, copy.tipZones);
  document.getElementById("zone-help").textContent = copy.zoneHelp;
  const zones = document.getElementById("zones");
  zones.replaceChildren();
  zones.append(
    zoneFiles(copy.work, (file) => file.inWork, "work", "✏️", copy.tipWork, zoneMemory.work && zoneMemory.work !== workSig),
    zoneFiles(copy.index, (file) => file.inIndex, "index", "📥", copy.tipIndex, zoneMemory.index && zoneMemory.index !== indexSig),
    zoneFiles(copy.repo, (file) => file.inHead, "repo", "📦", copy.tipRepo, zoneMemory.repo && zoneMemory.repo !== repoSig)
  );
  zoneMemory = { work: workSig, index: indexSig, repo: repoSig };
  paintOnboard(copy);

  paintPullRequest(copy, model);
  paintFinale(copy);
}

function paintPullRequest(copy, model) {
  const panel = els.pr;
  panel.replaceChildren();
  if (level().id !== 7) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  panel.setAttribute("aria-labelledby", "pr-title");
  const github = model.github;
  panel.append(h("h2", { id: "pr-title", text: copy.prTitle }));
  panel.append(h("p", { className: "pr-meta", text: github.upstreamSlug ? `${copy.upstream}: ${github.upstreamSlug}` : "" }));
  if (github.upstreamMessage) panel.append(h("p", { text: github.upstreamMessage }));
  const review = h("div", { className: "review" });
  review.append(h("p", { className: "pr-meta", text: copy.reviewTitle }));
  let reviewText = copy.reviewWait;
  if (github.pr?.state === "merged") reviewText = copy.reviewMerged;
  else if (github.pr?.snippetOk) reviewText = copy.reviewOk;
  else if (github.pr) reviewText = copy.reviewAsk;
  review.append(h("p", { text: reviewText }));
  panel.append(review);
  const actions = h("div", { className: "pr-actions" });
  const fork = h("button", { type: "button", className: "btn", text: copy.fork });
  const open = h("button", { type: "button", className: "btn", text: copy.openPr });
  const merge = h("button", { type: "button", className: "btn", text: copy.mergePr });
  fork.addEventListener("click", () => runLine("gh repo fork"));
  open.addEventListener("click", () => runLine(lang === "en" ? 'gh pr create --title "Temperature unit"' : 'gh pr create --title "Unidad de temperatura"'));
  merge.addEventListener("click", () => runLine("gh pr merge"));
  actions.append(fork, open, merge);
  panel.append(actions);
}

function paintOnboard(copy) {
  document.getElementById("onboard-kicker").textContent = copy.onboardKicker;
  document.getElementById("onboard-title").textContent = copy.onboardTitle;
  document.getElementById("onboard-go").textContent = copy.onboardGo;
  const list = document.getElementById("onboard-steps");
  list.replaceChildren();
  for (const step of copy.onboardSteps) list.append(h("li", { text: step }));
}

function paintFinale(copy) {
  document.getElementById("finale-title").textContent = copy.finaleTitle;
  document.getElementById("finale-body").textContent = copy.finaleBody;
  document.getElementById("finale-replay").textContent = copy.replay;
  document.getElementById("finale-close").textContent = copy.finaleClose;
  const list = document.getElementById("finale-list");
  list.replaceChildren();
  for (const entry of LEVELS) list.append(h("li", { text: `${entry.id}. ${pick(entry.title)}` }));
}

document.addEventListener("it-lang", (event) => {
  const next = event.detail?.lang;
  if (next !== "es" && next !== "en") return;
  lang = next;
  paint();
});

function onboardSeen() {
  try {
    return localStorage.getItem(ONBOARD_KEY) === "1";
  } catch {
    return true;
  }
}

boot();
paint();
syncEditor(true);
save();
if (current === 7 && safeComplete() && !celebrated) els.finale.showModal();
else if (!onboardSeen()) els.onboard.showModal();
