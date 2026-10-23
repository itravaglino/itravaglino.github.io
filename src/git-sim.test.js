import assert from "node:assert/strict";
import test from "node:test";
import { createSim, isAncestor } from "./git-sim.js";
import { LEVELS, ORIGIN, TEXT, missionComplete, runCommand } from "./github-levels.js";

function play(level, steps, lang = "es") {
  const sim = createSim();
  level.setup(sim);
  const history = [];
  for (const step of steps) {
    if (typeof step === "function") step(sim);
    else {
      history.push(step);
      runCommand(sim, level, step, lang);
    }
  }
  return { sim, history };
}

test("git status outside a repo explains init", () => {
  const sim = createSim();
  const result = sim.exec("git status", "es");
  assert.equal(result.ok, false);
  assert.equal(result.code, "not-a-repo");
  assert.match(result.lines[0].text, /git init/);
});

test("unknown commands suggest a close match", () => {
  const sim = createSim();
  sim.enter("taller");
  const missing = sim.exec("comit", "en");
  assert.equal(missing.code, "unknown");
  assert.match(missing.lines[0].text, /git/);
  sim.exec("git init");
  const git = sim.exec("git comit -m hi", "en");
  assert.equal(git.code, "unknown-command");
  assert.match(git.lines[0].text, /commit/);
});

test("help lists workshop commands in both languages", () => {
  const sim = createSim();
  const es = sim.exec("help", "es");
  const en = sim.exec("git help commit", "en");
  assert.equal(es.ok, true);
  assert.match(es.lines.map((line) => line.text).join("\n"), /git init|init/);
  assert.match(en.lines[0].text, /commit -m/);
});

test("init, add and commit snapshot the index", () => {
  const sim = createSim();
  sim.enter("taller");
  sim.write("bitacora.txt", "hola\n");
  assert.equal(sim.exec("git init").code, "init");
  assert.equal(sim.exec("git commit -m \"vacío\"").code, "nothing-to-commit");
  assert.equal(sim.exec("git add bitacora.txt").ok, true);
  sim.write("bitacora.txt", "hola\nmas\n");
  const committed = sim.exec('git commit -m "primero"');
  assert.equal(committed.ok, true);
  const status = sim.exec("git status");
  assert.match(status.lines.map((line) => line.text).join("\n"), /modificado|modified|no están preparados|not staged/i);
  sim.exec("git add bitacora.txt");
  sim.exec('git commit -m "segundo"');
  const repo = sim.currentRepo();
  assert.equal(Object.keys(repo.commits).length, 2);
  assert.equal(repo.commits[repo.branches.main].parents.length, 1);
});

test("branches diverge and a conflicting merge can be resolved", () => {
  const sim = createSim();
  const level = LEVELS.find((item) => item.id === 5);
  level.setup(sim);
  const conflict = sim.exec("git merge ensayo");
  assert.equal(conflict.ok, false);
  assert.equal(conflict.code, "conflict");
  assert.match(sim.read("bitacora.txt"), /<<<<<<< HEAD/);
  assert.equal(sim.exec('git commit -m "pronto"').code, "unmerged");
  sim.write("bitacora.txt", TEXT.resolved);
  assert.equal(sim.exec("git add bitacora.txt").ok, true);
  const merged = sim.exec('git commit -m "Integro el ensayo"');
  assert.equal(merged.ok, true);
  const repo = sim.currentRepo();
  const tip = repo.commits[repo.branches.main];
  assert.equal(tip.parents.length, 2);
  assert.match(tip.tree["bitacora.txt"], /temperatura: 80/);
  assert.doesNotMatch(tip.tree["bitacora.txt"], /<<<<<<</);
});

test("clean merge of different files is a two-parent commit", () => {
  const sim = createSim();
  sim.enter("taller");
  sim.write("a.txt", "a\n");
  sim.exec("git init");
  sim.exec("git add a.txt");
  sim.exec('git commit -m "base"');
  sim.exec("git switch -c lado");
  sim.write("b.txt", "b\n");
  sim.exec("git add b.txt");
  sim.exec('git commit -m "lado"');
  sim.exec("git switch main");
  sim.write("a.txt", "a\ncambio\n");
  sim.exec("git add a.txt");
  sim.exec('git commit -m "main"');
  const merged = sim.exec("git merge lado");
  assert.equal(merged.ok, true);
  const repo = sim.currentRepo();
  const tip = repo.commits[repo.branches.main];
  assert.equal(tip.parents.length, 2);
  assert.equal(tip.tree["b.txt"], "b\n");
  assert.match(tip.tree["a.txt"], /cambio/);
});

test("refuses to switch branches when local changes would be overwritten", () => {
  const sim = createSim();
  sim.enter("taller");
  sim.write("a.txt", "a\n");
  sim.exec("git init");
  sim.exec("git add a.txt");
  sim.exec('git commit -m "base"');
  sim.exec("git branch otra");
  sim.exec("git switch otra");
  sim.write("a.txt", "otra\n");
  sim.exec("git add a.txt");
  sim.exec('git commit -m "otra"');
  sim.exec("git switch main");
  sim.write("a.txt", "sucio\n");
  const blocked = sim.exec("git checkout otra");
  assert.equal(blocked.code, "local-changes");
  assert.equal(sim.currentRepo().head, "main");
});

test("push, teammate commit, non-ff rejection, pull and clone", () => {
  const sim = createSim();
  const level = LEVELS.find((item) => item.id === 6);
  level.setup(sim);
  assert.equal(sim.exec(`git remote add origin ${ORIGIN}`).ok, true);
  assert.equal(sim.exec("git push -u origin main").ok, true);
  assert.equal(sim.noteFromTeammate(ORIGIN), true);
  sim.write("bitacora.txt", `${TEXT.seed}local\n`);
  sim.exec("git add bitacora.txt");
  sim.exec('git commit -m "local"');
  const rejected = sim.exec("git push");
  assert.equal(rejected.code, "non-ff");
  const repo = sim.currentRepo();
  const localTip = repo.branches.main;
  assert.equal(isAncestor(repo, repo.commits[localTip].parents[0], localTip), true);
  const pulled = sim.exec("git pull");
  assert.equal(pulled.ok, true, pulled.lines.map((line) => line.text).join("\n"));
  assert.match(sim.read("nota-ada.txt"), /tarde/);
  assert.match(sim.read("bitacora.txt"), /local/);
  const cloned = sim.exec(`git clone ${ORIGIN} copia`);
  assert.equal(cloned.ok, true);
  sim.exec("cd copia");
  assert.match(sim.read("nota-ada.txt") || "", /tarde/);
});

test("fast-forward pull after a teammate commit", () => {
  const { sim } = play(LEVELS.find((item) => item.id === 6), [
    `git remote add origin ${ORIGIN}`,
    "git push -u origin main",
    "git pull",
    `git clone ${ORIGIN} copia`,
  ]);
  assert.match(sim.read("bitacora.txt"), /Bitácora/);
  sim.exec("cd copia");
  assert.equal(sim.currentRepo().remotes.origin, ORIGIN);
});

test("fork, review and merge update upstream", () => {
  const level = LEVELS.find((item) => item.id === 7);
  const { sim, history } = play(level, [
    "gh repo fork",
    "git switch -c mejora",
    (current) => current.write("bitacora.txt", TEXT.clarified),
    "git add bitacora.txt",
    'git commit -m "Anoto la mañana"',
    "git push -u origin mejora",
    'gh pr create --title "Unidad de temperatura"',
    (current) => current.write("bitacora.txt", TEXT.withUnit),
    "git add bitacora.txt",
    'git commit -m "Agrego la unidad"',
    "git push",
    "gh pr merge",
  ]);
  assert.equal(missionComplete(level, { sim, history }), true);
  const upstream = sim.bare("https://github.com/lab/bitacora.git");
  assert.match(upstream.commits[upstream.branches.main].tree["bitacora.txt"], /°C/);
  const early = createSim();
  level.setup(early);
  early.exec("gh repo fork");
  early.exec("git switch -c mejora");
  early.write("bitacora.txt", TEXT.clarified);
  early.exec("git add bitacora.txt");
  early.exec('git commit -m "sin unidad"');
  early.exec("git push -u origin mejora");
  early.exec('gh pr create --title "Pronto"');
  const blocked = early.exec("gh pr merge");
  assert.equal(blocked.code, "review");
});

test("snapshot restore round-trips a repository", () => {
  const sim = createSim();
  sim.enter("taller");
  sim.exec("git init");
  sim.write("bitacora.txt", "uno\n");
  sim.exec("git add bitacora.txt");
  sim.exec('git commit -m "uno"');
  const snap = sim.snapshot();
  sim.write("bitacora.txt", "dos\n");
  sim.exec("git add bitacora.txt");
  sim.exec('git commit -m "dos"');
  assert.equal(sim.currentRepo() && Object.keys(sim.currentRepo().commits).length, 2);
  sim.restore(snap);
  assert.equal(Object.keys(sim.currentRepo().commits).length, 1);
  assert.equal(sim.read("bitacora.txt"), "uno\n");
});

test("every mission can be completed with the taught commands", () => {
  const scripts = {
    1: ["git init"],
    2: [(sim) => sim.write("bitacora.txt", TEXT.observation), "git status", "git add bitacora.txt", 'git commit -m "Registro la primera observación"'],
    3: ["git log", "git log --oneline"],
    4: ["git switch -c ensayo", (sim) => sim.write("bitacora.txt", TEXT.hot), "git add bitacora.txt", 'git commit -m "Subo la temperatura"'],
    5: ["git merge ensayo", (sim) => sim.write("bitacora.txt", TEXT.resolved), "git add bitacora.txt", 'git commit -m "Integro el ensayo"'],
    6: [`git remote add origin ${ORIGIN}`, "git push -u origin main", "git fetch", "git pull", `git clone ${ORIGIN} copia`],
    7: [
      "gh repo fork",
      "git branch mejora",
      "git checkout mejora",
      (sim) => sim.write("bitacora.txt", TEXT.clarified),
      "git add .",
      'git commit -m "Anoto la mañana"',
      "git push -u origin mejora",
      'gh pr create --title "Unidad de temperatura"',
      (sim) => sim.write("bitacora.txt", TEXT.withUnit),
      "git add bitacora.txt",
      'git commit -m "Agrego la unidad"',
      "git push",
      "gh pr merge",
    ],
  };
  for (const level of LEVELS) {
    const { sim, history } = play(level, scripts[level.id]);
    assert.equal(missionComplete(level, { sim, history }), true, `level ${level.id}`);
    const model = sim.model();
    assert.ok(model.localGraph);
    if (level.id >= 6) assert.equal(model.remoteGraph.empty, false);
  }
});

test("english errors stay in english", () => {
  const sim = createSim();
  const result = sim.exec("git merge", "en");
  assert.match(result.lines[0].text, /not a git repository/);
});
