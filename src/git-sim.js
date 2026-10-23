/**
 * Small in-browser Git simulator for the workshop at /github/.
 * Teaching subset: init, status, add, commit, log, branch, switch/checkout,
 * merge (fast-forward, clean merge, conflict), remote, push, fetch, pull, clone,
 * plus a tiny `gh` for fork / pull request. No network.
 */

const HOME = "/home/ada";
const GIT_COMMANDS = [
  "init",
  "status",
  "add",
  "commit",
  "log",
  "branch",
  "switch",
  "checkout",
  "merge",
  "remote",
  "push",
  "pull",
  "fetch",
  "clone",
  "help",
  "show",
  "diff",
];

export function tokenize(line) {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match;
  while ((match = re.exec(line))) out.push(match[1] ?? match[2] ?? match[3]);
  return out;
}

function L(lang, es, en) {
  return lang === "en" ? en : es;
}

function ok(code, lines, type = "out") {
  const list = (Array.isArray(lines) ? lines : [lines]).filter((line) => line != null && line !== "");
  return { ok: true, code, lines: list.map((text) => ({ text, type })) };
}

function fail(code, lines) {
  const list = (Array.isArray(lines) ? lines : [lines]).filter(Boolean);
  return { ok: false, code, lines: list.map((text) => ({ text, type: "err" })) };
}

function freshState() {
  return {
    seq: 1,
    cwd: HOME,
    nodes: { [HOME]: dirNode() },
    remotes: {},
    github: { upstreamUrl: null, forkUrl: null, pr: null, requiredPattern: null },
    flags: {},
  };
}

function dirNode() {
  return { type: "dir", files: {}, repo: null };
}

function emptyRepo() {
  return {
    commits: {},
    branches: {},
    head: "main",
    unborn: true,
    index: {},
    conflict: null,
    mergeHead: null,
    preMerge: null,
    remotes: {},
    remoteRefs: {},
    upstream: {},
  };
}

function bareRepo() {
  return { commits: {}, branches: {}, head: "main" };
}

function nextId(state) {
  const id = state.seq.toString(16).padStart(7, "0");
  state.seq += 1;
  return id;
}

function dirname(path) {
  const index = path.lastIndexOf("/");
  return index <= 0 ? "/" : path.slice(0, index);
}

function basename(path) {
  return path.slice(path.lastIndexOf("/") + 1);
}

function resolvePath(cwd, rel) {
  let input = rel || "";
  if (input === "~" || input.startsWith("~/")) input = HOME + input.slice(1);
  const raw = !input ? cwd : input.startsWith("/") ? input : `${cwd}/${input}`;
  const parts = [];
  for (const part of raw.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  let abs = `/${parts.join("/")}`;
  if (abs !== HOME && !abs.startsWith(`${HOME}/`)) abs = HOME;
  return abs;
}

function displayPath(path) {
  if (path === HOME) return "~";
  if (path.startsWith(`${HOME}/`)) return `~/${path.slice(HOME.length + 1)}`;
  return path;
}

function ensureDir(state, path) {
  const abs = path === HOME || path.startsWith(`${HOME}/`) ? path : HOME;
  const parts = abs.split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current += `/${part}`;
    if (!state.nodes[current]) state.nodes[current] = dirNode();
  }
  return state.nodes[abs];
}

function cwdNode(state) {
  return state.nodes[state.cwd] || null;
}

function currentRepo(state) {
  return cwdNode(state)?.repo || null;
}

function treesEqual(a = {}, b = {}) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) if (a[key] !== b[key]) return false;
  return true;
}

function headCommit(repo) {
  if (!repo || repo.unborn) return null;
  const id = repo.branches[repo.head];
  return id ? repo.commits[id] || null : null;
}

function headTree(repo) {
  return headCommit(repo)?.tree || {};
}

export function isAncestor(repo, ancestor, commit) {
  if (!repo || !ancestor || !commit) return false;
  const seen = new Set();
  const stack = [commit];
  while (stack.length) {
    const id = stack.pop();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (id === ancestor) return true;
    const entry = repo.commits[id];
    if (!entry) continue;
    for (const parent of entry.parents) stack.push(parent);
  }
  return false;
}

function mergeBase(repo, a, b) {
  const depth = new Map();
  const walk = (id) => {
    const stack = [{ id, d: 0 }];
    while (stack.length) {
      const item = stack.pop();
      if (!item.id || depth.has(item.id) || !repo.commits[item.id]) continue;
      depth.set(item.id, item.d);
      for (const parent of repo.commits[item.id].parents) stack.push({ id: parent, d: item.d + 1 });
    }
  };
  walk(a);
  let best = null;
  let bestDepth = Infinity;
  const stack = [b];
  const seen = new Set();
  while (stack.length) {
    const id = stack.pop();
    if (!id || seen.has(id) || !repo.commits[id]) continue;
    seen.add(id);
    if (depth.has(id) && depth.get(id) < bestDepth) {
      best = id;
      bestDepth = depth.get(id);
    }
    for (const parent of repo.commits[id].parents) stack.push(parent);
  }
  return best;
}

function copyReachable(fromRepo, toRepo, id) {
  const stack = [id];
  const seen = new Set();
  while (stack.length) {
    const current = stack.pop();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    const entry = fromRepo.commits[current];
    if (!entry) continue;
    if (!toRepo.commits[current]) {
      toRepo.commits[current] = {
        id: entry.id,
        parents: [...entry.parents],
        message: entry.message,
        tree: { ...entry.tree },
      };
    }
    for (const parent of entry.parents) stack.push(parent);
  }
}

function checkoutTree(node, repo, tree) {
  node.files = { ...tree };
  repo.index = { ...tree };
}

function isDirty(node, repo) {
  if (repo.conflict?.paths?.length) return true;
  if (!treesEqual(node.files, repo.index)) return true;
  if (!treesEqual(repo.index, headTree(repo))) return true;
  return false;
}

function resolveRev(repo, name) {
  if (!repo || !name) return null;
  if (name === "HEAD") return repo.unborn ? null : repo.branches[repo.head] || null;
  if (repo.branches[name]) return repo.branches[name];
  if (repo.remoteRefs[name]) return repo.remoteRefs[name];
  if (repo.commits[name]) return name;
  const matches = Object.keys(repo.commits).filter((id) => id.startsWith(name) && name.length >= 4);
  return matches.length === 1 ? matches[0] : null;
}

function levenshtein(a, b) {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j += 1) rows[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
    }
  }
  return rows[a.length][b.length];
}

function suggest(word, options) {
  let best = null;
  let bestDistance = 3;
  for (const option of options) {
    const distance = levenshtein(word, option);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = option;
    }
  }
  return bestDistance <= 2 ? best : null;
}

function helpLines(lang, topic) {
  const topics = {
    init: L(lang, "`git init` crea un repositorio vacío en esta carpeta.", "`git init` creates an empty repository in this folder."),
    status: L(lang, "`git status` compara trabajo, index y último commit.", "`git status` compares the work tree, index, and last commit."),
    add: L(lang, '`git add <archivo>` copia el archivo al index. `git add .` prepara todo.', "`git add <file>` copies a file into the index. `git add .` stages everything."),
    commit: L(lang, 'Ejemplo: git commit -m "mensaje". El mensaje va entre comillas.', 'Example: git commit -m "message". Quote the message.'),
    log: L(lang, "`git log` lista commits desde HEAD. `git log --oneline` es la versión corta.", "`git log` lists commits from HEAD. `git log --oneline` is the short form."),
    branch: L(lang, "`git branch` lista ramas. `git branch nombre` crea una rama sin cambiarte de lugar.", "`git branch` lists branches. `git branch name` creates one without switching."),
    switch: L(lang, "`git switch nombre` mueve HEAD. `git switch -c nombre` la crea y entra.", "`git switch name` moves HEAD. `git switch -c name` creates it and enters."),
    checkout: L(lang, "`git checkout nombre` y `git checkout -b nombre` hacen lo mismo que switch en este taller.", "`git checkout name` and `git checkout -b name` match switch in this workshop."),
    merge: L(lang, "`git merge rama` integra esa rama. Si hay conflicto, editá, `git add` y `git commit`. `git merge --abort` vuelve atrás.", "`git merge branch` integrates that branch. On a conflict: edit, `git add`, `git commit`. `git merge --abort` goes back."),
    remote: L(lang, "`git remote add origin <url>` nombra otra copia. `git remote -v` la muestra.", "`git remote add origin <url>` names another copy. `git remote -v` shows it."),
    push: L(lang, "`git push -u origin main` sube la rama y recuerda el vínculo.", "`git push -u origin main` uploads the branch and remembers the link."),
    pull: L(lang, "`git pull` baja lo que hay en origin y lo integra (fetch + merge).", "`git pull` downloads origin and integrates it (fetch + merge)."),
    fetch: L(lang, "`git fetch` baja commits nuevos sin cambiar tus archivos.", "`git fetch` downloads new commits without changing your files."),
    clone: L(lang, "`git clone <url> [carpeta]` copia un remoto a una carpeta nueva.", "`git clone <url> [folder]` copies a remote into a new folder."),
    show: L(lang, "`git show HEAD` muestra el último commit.", "`git show HEAD` shows the latest commit."),
    diff: L(lang, "`git diff` muestra lo que cambió y todavía no preparaste.", "`git diff` shows changes you have not staged."),
    fork: L(lang, "`gh repo fork` copia el repositorio upstream a tu cuenta y lo clona.", "`gh repo fork` copies the upstream repository to your account and clones it."),
    pr: L(lang, '`gh pr create --title "Título"` abre un pull request. `gh pr merge` lo fusiona cuando la revisión está resuelta.', '`gh pr create --title "Title"` opens a pull request. `gh pr merge` merges it once review is addressed.'),
  };
  if (topic && topics[topic]) return [topics[topic]];
  return [
    L(
      lang,
      "Comandos de shell: help, pwd, ls, cd, cat, clear.",
      "Shell commands: help, pwd, ls, cd, cat, clear."
    ),
    L(
      lang,
      "Git: init, status, add, commit, log, branch, switch, checkout, merge, remote, push, fetch, pull, clone, diff, show.",
      "Git: init, status, add, commit, log, branch, switch, checkout, merge, remote, push, fetch, pull, clone, diff, show."
    ),
    L(lang, "GitHub: gh repo fork, gh pr create, gh pr merge.", "GitHub: gh repo fork, gh pr create, gh pr merge."),
    L(lang, "Probá `git help <comando>`, por ejemplo `git help commit`.", "Try `git help <command>`, for example `git help commit`."),
    L(
      lang,
      "En una terminal real Git responde en inglés. Acá las explicaciones siguen el idioma del sitio.",
      "Real Git answers in English. Here, explanations follow the site language."
    ),
  ];
}

function requireRepo(state, lang) {
  const node = cwdNode(state);
  if (!node) return fail("no-dir", L(lang, "fatal: esta carpeta no existe.", "fatal: this folder does not exist."));
  if (!node.repo) {
    return fail(
      "not-a-repo",
      L(
        lang,
        "fatal: no es un repositorio git. Creá uno con `git init`.",
        "fatal: not a git repository. Create one with `git init`."
      )
    );
  }
  return null;
}

function fileStatus(repo, files, name) {
  const work = files[name];
  const staged = repo ? repo.index[name] : undefined;
  const head = repo ? headTree(repo)[name] : undefined;
  if (repo?.conflict?.paths?.includes(name)) return "conflict";
  if (!repo) return "untracked";
  const inWork = work !== undefined;
  const inIndex = staged !== undefined;
  const inHead = head !== undefined;
  if (inIndex && inWork && work !== staged && staged !== head) return "partial";
  if (inIndex && inWork && work !== staged) return "modified";
  if (staged !== head) return "staged";
  if (inWork && !inIndex && !inHead) return "untracked";
  return "clean";
}

function collectFileNames(node, repo) {
  const names = new Set(Object.keys(node?.files || {}));
  if (repo) {
    for (const name of Object.keys(repo.index)) names.add(name);
    for (const name of Object.keys(headTree(repo))) names.add(name);
  }
  return [...names].sort();
}

function hasMarkers(content) {
  return typeof content === "string" && content.includes("<<<<<<<");
}

function conflictText(ours = "", theirs = "", branch) {
  const left = ours.endsWith("\n") || ours === "" ? ours : `${ours}\n`;
  const right = theirs.endsWith("\n") || theirs === "" ? theirs : `${theirs}\n`;
  return `<<<<<<< HEAD\n${left}=======\n${right}>>>>>>> ${branch}\n`;
}

function validRemoteUrl(url) {
  return /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(?:\.git)?$/.test(url);
}

function repoNameFromUrl(url) {
  return url.replace(/\.git$/, "").split("/").pop() || "repo";
}

function shortUrl(url) {
  if (!url) return "";
  return url.replace("https://github.com/", "").replace(/\.git$/, "");
}

function childrenOf(state, dir) {
  const prefix = `${dir}/`;
  return Object.keys(state.nodes)
    .filter((path) => path.startsWith(prefix) && !path.slice(prefix.length).includes("/"))
    .map((path) => path.slice(prefix.length))
    .sort();
}

function ensureBare(state, url) {
  if (!state.remotes[url]) state.remotes[url] = bareRepo();
  return state.remotes[url];
}

function addPaths(repo, node, names, lang) {
  const added = [];
  for (const name of names) {
    if (node.files[name] === undefined) {
      return fail(
        "pathspec",
        L(lang, `fatal: '${name}' no coincide con ningún archivo.`, `fatal: pathspec '${name}' did not match any files.`)
      );
    }
    if (hasMarkers(node.files[name])) {
      return fail(
        "markers",
        L(
          lang,
          `error: ${name} todavía tiene marcas de conflicto (<<<<<<<). Resolvé el archivo en el editor y volvé a hacer git add.`,
          `error: ${name} still has conflict markers (<<<<<<<). Resolve it in the editor, then git add again.`
        )
      );
    }
    repo.index[name] = node.files[name];
    added.push(name);
  }
  if (repo.conflict) {
    repo.conflict.paths = repo.conflict.paths.filter((path) => !added.includes(path));
    if (!repo.conflict.paths.length) repo.conflict = null;
  }
  return ok("add", L(lang, added.length ? `preparado: ${added.join(", ")}` : "nada para preparar", added.length ? `staged: ${added.join(", ")}` : "nothing to stage"), "ok");
}

function commitRepo(state, repo, node, message, lang) {
  if (repo.conflict?.paths?.length) {
    return fail(
      "unmerged",
      L(
        lang,
        "error: hay conflictos sin resolver. Editá el archivo, `git add` y después `git commit`.",
        "error: unresolved conflicts remain. Edit the file, `git add`, then `git commit`."
      )
    );
  }
  if (!message) {
    return fail(
      "no-message",
      L(
        lang,
        'error: falta el mensaje. En este taller no se abre un editor: git commit -m "mensaje".',
        'error: missing message. This workshop does not open an editor: git commit -m "message".'
      )
    );
  }
  const tree = { ...repo.index };
  const parent = repo.unborn ? null : repo.branches[repo.head];
  if (!repo.mergeHead && treesEqual(tree, headTree(repo))) {
    const dirtyWork = !treesEqual(node.files, repo.index);
    return fail(
      "nothing-to-commit",
      dirtyWork
        ? L(lang, "nada para hacer commit: hay cambios sin `git add`.", "nothing to commit: changes are not staged. Run `git add`.")
        : L(lang, "nada para hacer commit, el árbol de trabajo está limpio.", "nothing to commit, working tree clean.")
    );
  }
  const parents = [];
  if (parent) parents.push(parent);
  if (repo.mergeHead && repo.mergeHead !== parent) parents.push(repo.mergeHead);
  const id = nextId(state);
  repo.commits[id] = { id, parents, message, tree };
  const branch = repo.head || "main";
  repo.branches[branch] = id;
  repo.head = branch;
  repo.unborn = false;
  repo.mergeHead = null;
  repo.preMerge = null;
  repo.index = { ...tree };
  return ok(
    "commit",
    L(lang, `[${branch} ${id}] ${message}`, `[${branch} ${id}] ${message}`),
    "ok"
  );
}

function decorate(repo, id) {
  const names = [];
  if (!repo.unborn && repo.branches[repo.head] === id) names.push(`HEAD -> ${repo.head}`);
  for (const [name, hash] of Object.entries(repo.branches)) {
    if (hash === id && name !== repo.head) names.push(name);
  }
  for (const [name, hash] of Object.entries(repo.remoteRefs || {})) {
    if (hash === id) names.push(name);
  }
  return names;
}

function logLines(repo, lang, { oneline, all, graph, start }) {
  if (repo.unborn) {
    return fail(
      "no-commits",
      L(lang, "fatal: todavía no hay commits en esta rama.", "fatal: your current branch does not have any commits yet.")
    );
  }
  const starts = new Set();
  if (start) starts.add(start);
  else starts.add(repo.branches[repo.head]);
  if (all) {
    for (const hash of Object.values(repo.branches)) if (hash) starts.add(hash);
    for (const hash of Object.values(repo.remoteRefs)) if (hash) starts.add(hash);
  }
  const seen = new Set();
  const ordered = [];
  const stack = [...starts];
  while (stack.length) {
    const id = stack.pop();
    if (!id || seen.has(id) || !repo.commits[id]) continue;
    seen.add(id);
    ordered.push(id);
    for (const parent of repo.commits[id].parents) stack.push(parent);
  }
  const depth = new Map();
  const depthOf = (id) => {
    if (depth.has(id)) return depth.get(id);
    const entry = repo.commits[id];
    const value = entry.parents.length ? Math.max(...entry.parents.map((parent) => depthOf(parent))) + 1 : 0;
    depth.set(id, value);
    return value;
  };
  for (const id of ordered) depthOf(id);
  ordered.sort((a, b) => depth.get(b) - depth.get(a) || (a === repo.branches[repo.head] ? -1 : 1));
  const lines = [];
  for (const id of ordered) {
    const entry = repo.commits[id];
    const labels = decorate(repo, id);
    const suffix = labels.length ? ` (${labels.join(", ")})` : "";
    if (oneline) lines.push(`${graph ? "* " : ""}${id}${suffix} ${entry.message}`);
    else {
      lines.push(`commit ${id}${suffix}`);
      if (entry.parents.length > 1) lines.push(`Merge: ${entry.parents.map((parent) => parent.slice(0, 7)).join(" ")}`);
      lines.push(`    ${entry.message}`);
      lines.push("");
    }
  }
  return ok("log", lines);
}

function switchBranch(state, repo, node, name, create, lang) {
  if (!name || name.startsWith("-")) {
    return fail("usage-switch", L(lang, "uso: git switch <rama>  |  git switch -c <rama>", "usage: git switch <branch>  |  git switch -c <branch>"));
  }
  if (repo.conflict || repo.mergeHead) {
    return fail("merging", L(lang, "error: terminá el merge (o `git merge --abort`) antes de cambiar de rama.", "error: finish the merge (or `git merge --abort`) before switching."));
  }
  if (repo.unborn) {
    return fail("unborn", L(lang, "fatal: todavía no hay commits. Hacé el primero en main.", "fatal: no commits yet. Make the first one on main."));
  }
  if (create) {
    if (repo.branches[name]) return fail("exists", L(lang, `fatal: la rama '${name}' ya existe.`, `fatal: branch '${name}' already exists.`));
    repo.branches[name] = repo.branches[repo.head];
  } else if (!repo.branches[name]) {
    const known = Object.keys(repo.branches).join(", ") || "main";
    return fail(
      "missing-branch",
      L(
        lang,
        `fatal: no existe la rama '${name}'. Ramas: ${known}. Creala con git switch -c ${name}.`,
        `fatal: branch '${name}' does not exist. Branches: ${known}. Create it with git switch -c ${name}.`
      )
    );
  }
  const target = repo.branches[name];
  const targetTree = repo.commits[target].tree;
  if (!treesEqual(headTree(repo), targetTree) && isDirty(node, repo)) {
    return fail(
      "local-changes",
      L(
        lang,
        "error: tenés cambios sin commit. Hacé `git add` y `git commit` antes de cambiar de rama.",
        "error: you have uncommitted changes. `git add` and `git commit` before switching branches."
      )
    );
  }
  if (!treesEqual(headTree(repo), targetTree)) checkoutTree(node, repo, targetTree);
  repo.head = name;
  return ok("switch", L(lang, `cambiado a la rama '${name}'`, `switched to branch '${name}'`), "ok");
}

function applyMergeResult(state, repo, node, branchName, otherId, lang) {
  const headId = repo.branches[repo.head];
  if (otherId === headId || isAncestor(repo, otherId, headId)) {
    return ok("up-to-date", L(lang, `Ya está actualizado con '${branchName}'.`, `Already up to date with '${branchName}'.`));
  }
  if (isAncestor(repo, headId, otherId)) {
    repo.branches[repo.head] = otherId;
    checkoutTree(node, repo, repo.commits[otherId].tree);
    return ok("ff", L(lang, `Fast-forward a ${otherId}.`, `Fast-forward to ${otherId}.`), "ok");
  }
  const baseId = mergeBase(repo, headId, otherId);
  const baseTree = baseId ? repo.commits[baseId].tree : {};
  const oursTree = repo.commits[headId].tree;
  const theirsTree = repo.commits[otherId].tree;
  const names = new Set([...Object.keys(baseTree), ...Object.keys(oursTree), ...Object.keys(theirsTree)]);
  const result = {};
  const conflicts = [];
  for (const name of names) {
    const base = baseTree[name];
    const ours = oursTree[name];
    const theirs = theirsTree[name];
    if (ours === theirs) {
      if (ours !== undefined) result[name] = ours;
    } else if (ours === base) {
      if (theirs !== undefined) result[name] = theirs;
    } else if (theirs === base) {
      if (ours !== undefined) result[name] = ours;
    } else {
      conflicts.push(name);
      result[name] = conflictText(ours || "", theirs || "", branchName);
    }
  }
  repo.preMerge = { files: { ...node.files }, index: { ...repo.index }, head: repo.head };
  if (conflicts.length) {
    node.files = result;
    repo.conflict = { paths: conflicts, branch: branchName };
    repo.mergeHead = otherId;
    return fail(
      "conflict",
      [
        L(lang, `conflicto de merge en: ${conflicts.join(", ")}`, `merge conflict in: ${conflicts.join(", ")}`),
        L(
          lang,
          "Abrí el archivo, quedate con lo que corresponda, borra las marcas <<<<<<< ======= >>>>>>> y después: git add <archivo> && git commit -m \"mensaje\".",
          "Open the file, keep what should remain, delete the <<<<<<< ======= >>>>>>> markers, then: git add <file> && git commit -m \"message\"."
        ),
      ]
    );
  }
  repo.index = result;
  node.files = { ...result };
  repo.mergeHead = otherId;
  const message = L(lang, `Merge branch '${branchName}'`, `Merge branch '${branchName}'`);
  return commitRepo(state, repo, node, message, lang);
}

function mergeCommand(state, repo, node, branchName, lang) {
  if (branchName === "--abort") {
    if (!repo.preMerge && !repo.conflict && !repo.mergeHead) {
      return fail("no-merge", L(lang, "fatal: no hay un merge en curso.", "fatal: there is no merge to abort."));
    }
    if (repo.preMerge) {
      node.files = { ...repo.preMerge.files };
      repo.index = { ...repo.preMerge.index };
      repo.head = repo.preMerge.head;
    }
    repo.preMerge = null;
    repo.conflict = null;
    repo.mergeHead = null;
    return ok("abort", L(lang, "Merge cancelado. Volviste al estado anterior.", "Merge aborted. You are back to the previous state."), "ok");
  }
  if (repo.unborn) return fail("unborn", L(lang, "fatal: todavía no hay commits.", "fatal: no commits yet."));
  if (repo.conflict || repo.mergeHead) {
    return fail("merging", L(lang, "error: ya hay un merge en curso.", "error: a merge is already in progress."));
  }
  if (isDirty(node, repo)) {
    return fail(
      "local-changes",
      L(lang, "error: commit o descartá los cambios locales antes de merge.", "error: commit your local changes before merging.")
    );
  }
  const otherId = resolveRev(repo, branchName);
  if (!otherId) {
    return fail(
      "missing-branch",
      L(lang, `fatal: '${branchName}' no es una rama ni una referencia conocida.`, `fatal: '${branchName}' is not a known branch or ref.`)
    );
  }
  return applyMergeResult(state, repo, node, branchName, otherId, lang);
}

function fetchRemote(state, repo, remoteName, lang) {
  const url = repo.remotes[remoteName];
  if (!url) {
    return fail(
      "no-remote",
      L(lang, `fatal: '${remoteName}' no existe. Agregalo con git remote add ${remoteName} <url>.`, `fatal: '${remoteName}' does not exist. Add it with git remote add ${remoteName} <url>.`)
    );
  }
  const bare = state.remotes[url];
  if (!bare || !Object.keys(bare.branches).length) {
    return ok("fetch-empty", L(lang, `${remoteName} no tiene commits todavía.`, `${remoteName} has no commits yet.`));
  }
  const lines = [];
  for (const [branch, hash] of Object.entries(bare.branches)) {
    copyReachable(bare, repo, hash);
    const ref = `${remoteName}/${branch}`;
    const previous = repo.remoteRefs[ref];
    repo.remoteRefs[ref] = hash;
    if (previous === hash) {
      lines.push(L(lang, `${ref} ya estaba en ${hash}`, `${ref} already at ${hash}`));
    } else lines.push(`${ref} → ${hash}`);
  }
  return ok("fetch", lines.length ? lines : L(lang, "fetch listo.", "fetch complete."));
}

function pushBranch(state, repo, remoteName, branchName, setUpstream, lang) {
  if (repo.unborn) return fail("unborn", L(lang, "fatal: no hay commits para empujar.", "fatal: no commits to push."));
  if (!repo.branches[branchName]) {
    return fail("missing-branch", L(lang, `fatal: no existe la rama local '${branchName}'.`, `fatal: local branch '${branchName}' does not exist.`));
  }
  const url = repo.remotes[remoteName];
  if (!url) {
    return fail(
      "no-remote",
      L(
        lang,
        `fatal: el remoto '${remoteName}' no está configurado. Ejemplo: git remote add origin https://github.com/ada/bitacora.git`,
        `fatal: remote '${remoteName}' is not configured. Example: git remote add origin https://github.com/ada/bitacora.git`
      )
    );
  }
  const bare = ensureBare(state, url);
  const localHash = repo.branches[branchName];
  const remoteHash = bare.branches[branchName];
  if (remoteHash && remoteHash !== localHash && !isAncestor(repo, remoteHash, localHash)) {
    return fail(
      "non-ff",
      L(
        lang,
        `error: el push fue rechazado (no es fast-forward). ${remoteName}/${branchName} tiene commits que no están en tu rama. Probá git pull y después git push.`,
        `error: push rejected (non-fast-forward). ${remoteName}/${branchName} has commits your branch lacks. Try git pull, then git push.`
      )
    );
  }
  copyReachable(repo, bare, localHash);
  bare.branches[branchName] = localHash;
  if (!bare.head) bare.head = branchName;
  repo.remoteRefs[`${remoteName}/${branchName}`] = localHash;
  if (setUpstream) repo.upstream[branchName] = { remote: remoteName, branch: branchName };
  return ok(
    "push",
    L(
      lang,
      setUpstream ? `${branchName} → ${remoteName}/${branchName} (vínculo guardado)` : `${branchName} → ${remoteName}/${branchName}`,
      setUpstream ? `${branchName} → ${remoteName}/${branchName} (upstream set)` : `${branchName} → ${remoteName}/${branchName}`
    ),
    "ok"
  );
}

function pullBranch(state, repo, node, remoteName, branchName, lang) {
  const fetched = fetchRemote(state, repo, remoteName, lang);
  if (!fetched.ok && fetched.code !== "fetch-empty") return fetched;
  const ref = `${remoteName}/${branchName}`;
  if (!repo.remoteRefs[ref]) {
    return fail("no-remote-branch", L(lang, `fatal: ${ref} no existe todavía. ¿Hiciste push?`, `fatal: ${ref} does not exist yet. Have you pushed?`));
  }
  const merged = mergeCommand(state, repo, node, ref, lang);
  return {
    ...merged,
    lines: [...fetched.lines, ...merged.lines],
  };
}

function cloneRepo(state, url, dirName, lang) {
  if (!validRemoteUrl(url)) {
    return fail("bad-url", L(lang, "fatal: la URL tiene que ser https://github.com/cuenta/repo.git", "fatal: URL must look like https://github.com/account/repo.git"));
  }
  const bare = state.remotes[url];
  if (!bare || !bare.branches[bare.head || "main"]) {
    return fail(
      "empty-remote",
      L(
        lang,
        "fatal: no se puede clonar: ese remoto no existe o todavía no tiene commits. Si es el tuyo, primero git push.",
        "fatal: cannot clone: that remote does not exist or has no commits yet. If it is yours, git push first."
      )
    );
  }
  const folder = dirName || repoNameFromUrl(url);
  if (folder.includes("/") || folder === "." || folder === "..") {
    return fail("bad-path", L(lang, "fatal: nombre de carpeta inválido.", "fatal: invalid folder name."));
  }
  const abs = `${HOME}/${folder}`;
  if (state.nodes[abs]) {
    return fail("dest-exists", L(lang, `fatal: la carpeta ${displayPath(abs)} ya existe.`, `fatal: destination ${displayPath(abs)} already exists.`));
  }
  const headName = bare.branches[bare.head] ? bare.head : "main";
  const headHash = bare.branches[headName];
  const repo = emptyRepo();
  copyReachable(bare, repo, headHash);
  for (const [branch, hash] of Object.entries(bare.branches)) {
    copyReachable(bare, repo, hash);
    repo.branches[branch] = hash;
    repo.remoteRefs[`origin/${branch}`] = hash;
  }
  repo.unborn = false;
  repo.head = headName;
  repo.remotes.origin = url;
  repo.upstream[headName] = { remote: "origin", branch: headName };
  repo.index = { ...(repo.commits[headHash]?.tree || {}) };
  const node = dirNode();
  node.repo = repo;
  node.files = { ...repo.index };
  state.nodes[abs] = node;
  return ok("clone", L(lang, `Clonado en ${displayPath(abs)} (${headName}).`, `Cloned into ${displayPath(abs)} (${headName}).`), "ok");
}

function statusLines(state, repo, node, lang) {
  const lines = [];
  const branch = repo.head;
  if (repo.conflict || repo.mergeHead) {
    lines.push(L(lang, `En la rama ${branch}. Tenés un merge a medio resolver.`, `On branch ${branch}. A merge is in progress.`));
  } else if (repo.unborn) {
    lines.push(L(lang, `En la rama ${branch}. Aún no hay commits.`, `On branch ${branch}. No commits yet.`));
  } else {
    lines.push(L(lang, `En la rama ${branch}.`, `On branch ${branch}.`));
  }
  const originUrl = repo.remotes.origin;
  const bare = originUrl ? state.remotes[originUrl] : null;
  if (bare?.branches?.main && repo.remoteRefs["origin/main"] !== bare.branches.main) {
    lines.push(L(lang, "origin tiene commits que todavía no bajaste. Probá `git pull` (o `git fetch` y después merge).", "origin has commits you have not downloaded. Try `git pull` (or `git fetch`, then merge)."));
  }
  const names = collectFileNames(node, repo);
  const staged = [];
  const unstaged = [];
  const untracked = [];
  const conflicts = [];
  for (const name of names) {
    const status = fileStatus(repo, node.files, name);
    if (status === "conflict") conflicts.push(name);
    else if (status === "staged") staged.push(name);
    else if (status === "partial") {
      staged.push(name);
      unstaged.push(name);
    } else if (status === "modified") unstaged.push(name);
    else if (status === "untracked") untracked.push(name);
  }
  if (conflicts.length) {
    lines.push(L(lang, "Rutas sin fusionar:", "Unmerged paths:"));
    for (const name of conflicts) lines.push(`  ${L(lang, "ambos modificados", "both modified")}: ${name}`);
  }
  if (staged.length) {
    lines.push(L(lang, "Cambios para hacer commit:", "Changes to be committed:"));
    for (const name of staged) lines.push(`  ${L(lang, "preparado", "staged")}: ${name}`);
  }
  if (unstaged.length) {
    lines.push(L(lang, "Cambios que no están preparados:", "Changes not staged for commit:"));
    for (const name of unstaged) lines.push(`  ${L(lang, "modificado", "modified")}: ${name}`);
  }
  if (untracked.length) {
    lines.push(L(lang, "Archivos sin seguimiento:", "Untracked files:"));
    for (const name of untracked) lines.push(`  ${name}`);
  }
  if (!conflicts.length && !staged.length && !unstaged.length && !untracked.length) {
    lines.push(L(lang, "nada para hacer commit, el árbol de trabajo está limpio.", "nothing to commit, working tree clean."));
  }
  return ok("status", lines);
}

function git(state, args, lang) {
  if (!args.length || args[0] === "help" || args[0] === "--help" || args[0] === "-h") {
    const topic = args[0] === "help" ? args[1] : null;
    if (topic && !helpLines(lang, topic).length) {
      return fail("bad-help", L(lang, `No hay ayuda para '${topic}'.`, `No help for '${topic}'.`));
    }
    return ok("help", helpLines(lang, topic));
  }
  const sub = args[0];
  const rest = args.slice(1);
  if (!GIT_COMMANDS.includes(sub)) {
    const guess = suggest(sub, GIT_COMMANDS);
    return fail(
      "unknown-command",
      guess
        ? L(lang, `git: '${sub}' no es un comando. ¿Quisiste decir '${guess}'? Probá git help.`, `git: '${sub}' is not a command. Did you mean '${guess}'? Try git help.`)
        : L(lang, `git: '${sub}' no es un comando de este taller. Escribí help.`, `git: '${sub}' is not a command in this workshop. Type help.`)
    );
  }
  if (sub === "help") return ok("help", helpLines(lang, rest[0]));
  if (sub === "init") {
    const node = cwdNode(state);
    if (!node) return fail("no-dir", L(lang, "fatal: carpeta inválida.", "fatal: invalid folder."));
    if (node.repo) {
      return ok("reinit", L(lang, `Repositorio ya inicializado en ${displayPath(state.cwd)}/.git/`, `Reinitialized existing Git repository in ${displayPath(state.cwd)}/.git/`), "ok");
    }
    node.repo = emptyRepo();
    return ok("init", L(lang, `Repositorio Git vacío inicializado en ${displayPath(state.cwd)}/.git/`, `Initialized empty Git repository in ${displayPath(state.cwd)}/.git/`), "ok");
  }
  if (sub === "clone") {
    if (!rest[0]) return fail("usage-clone", L(lang, "uso: git clone <url> [carpeta]", "usage: git clone <url> [folder]"));
    return cloneRepo(state, rest[0], rest[1], lang);
  }

  const blocked = requireRepo(state, lang);
  if (blocked) return blocked;
  const node = cwdNode(state);
  const repo = node.repo;

  if (sub === "status") return statusLines(state, repo, node, lang);
  if (sub === "add") {
    if (!rest.length) {
      return fail("usage-add", L(lang, "uso: git add <archivo>  |  git add .", "usage: git add <file>  |  git add ."));
    }
    const names = rest.includes(".") ? Object.keys(node.files) : rest;
    if (!names.length) return ok("add", L(lang, "nada para preparar", "nothing to stage"));
    return addPaths(repo, node, names, lang);
  }
  if (sub === "commit") {
    let message = null;
    const extra = [];
    for (let i = 0; i < rest.length; i += 1) {
      if (rest[i] === "-m" || rest[i] === "--message") {
        message = rest[i + 1] ?? "";
        i += 1;
      } else extra.push(rest[i]);
    }
    if (extra.length) {
      return fail(
        "usage-commit",
        L(lang, 'error: el mensaje tiene que ir junto y entre comillas. Ejemplo: git commit -m "primera nota"', 'error: keep the message in one quoted argument. Example: git commit -m "first note"')
      );
    }
    return commitRepo(state, repo, node, message, lang);
  }
  if (sub === "log") {
    const flags = new Set(rest.filter((token) => token.startsWith("-")));
    const startName = rest.find((token) => !token.startsWith("-"));
    let start = null;
    if (startName) {
      start = resolveRev(repo, startName);
      if (!start) return fail("bad-rev", L(lang, `fatal: revisión desconocida '${startName}'.`, `fatal: unknown revision '${startName}'.`));
    }
    return logLines(repo, lang, {
      oneline: flags.has("--oneline"),
      all: flags.has("--all"),
      graph: flags.has("--graph") || flags.has("--oneline"),
      start,
    });
  }
  if (sub === "branch") {
    if (rest.includes("-a") || rest.length === 0) {
      if (repo.unborn) return ok("branch", L(lang, "todavía no hay commits ni ramas.", "no commits yet, no branches."));
      const lines = Object.keys(repo.branches)
        .sort()
        .map((name) => `${name === repo.head ? "* " : "  "}${name}`);
      if (rest.includes("-a")) {
        for (const name of Object.keys(repo.remoteRefs).sort()) lines.push(`  remotes/${name}`);
      }
      return ok("branch", lines);
    }
    const name = rest[0];
    if (repo.unborn) return fail("unborn", L(lang, "fatal: hace falta un commit antes de crear ramas.", "fatal: you need a commit before creating branches."));
    if (repo.branches[name]) return fail("exists", L(lang, `fatal: la rama '${name}' ya existe.`, `fatal: branch '${name}' already exists.`));
    repo.branches[name] = repo.branches[repo.head];
    return ok("branch", L(lang, `rama '${name}' creada en ${repo.branches[name]}`, `branch '${name}' created at ${repo.branches[name]}`), "ok");
  }
  if (sub === "switch") {
    const create = rest[0] === "-c" || rest[0] === "-C";
    const name = create ? rest[1] : rest[0];
    return switchBranch(state, repo, node, name, create, lang);
  }
  if (sub === "checkout") {
    const create = rest[0] === "-b" || rest[0] === "-B";
    const name = create ? rest[1] : rest[0];
    return switchBranch(state, repo, node, name, create, lang);
  }
  if (sub === "merge") {
    if (!rest[0]) return fail("usage-merge", L(lang, "uso: git merge <rama>  |  git merge --abort", "usage: git merge <branch>  |  git merge --abort"));
    return mergeCommand(state, repo, node, rest[0], lang);
  }
  if (sub === "remote") {
    if (rest[0] === "-v" || rest.length === 0) {
      const lines = [];
      for (const [name, url] of Object.entries(repo.remotes)) {
        lines.push(rest[0] === "-v" ? `${name}\t${url} (fetch)` : name);
        if (rest[0] === "-v") lines.push(`${name}\t${url} (push)`);
      }
      return ok("remote", lines.length ? lines : L(lang, "no hay remotos. Ejemplo: git remote add origin <url>", "no remotes yet. Example: git remote add origin <url>"));
    }
    if (rest[0] !== "add" || !rest[1] || !rest[2]) {
      return fail("usage-remote", L(lang, "uso: git remote add <nombre> <url>", "usage: git remote add <name> <url>"));
    }
    const [, name, url] = rest;
    if (repo.remotes[name]) return fail("remote-exists", L(lang, `fatal: el remoto '${name}' ya existe.`, `fatal: remote '${name}' already exists.`));
    if (!validRemoteUrl(url)) {
      return fail("bad-url", L(lang, "fatal: usá una URL https://github.com/cuenta/repo.git", "fatal: use a URL like https://github.com/account/repo.git"));
    }
    repo.remotes[name] = url;
    ensureBare(state, url);
    return ok("remote-add", L(lang, `remoto '${name}' → ${shortUrl(url)}`, `remote '${name}' → ${shortUrl(url)}`), "ok");
  }
  if (sub === "fetch") {
    const remoteName = rest[0] || "origin";
    return fetchRemote(state, repo, remoteName, lang);
  }
  if (sub === "push") {
    let setUpstream = false;
    const positional = [];
    for (const token of rest) {
      if (token === "-u" || token === "--set-upstream") setUpstream = true;
      else positional.push(token);
    }
    let remoteName = positional[0];
    let branchName = positional[1];
    if (!remoteName) {
      const track = repo.upstream[repo.head];
      if (!track) {
        return fail(
          "no-upstream",
          L(
            lang,
            "fatal: no hay destino configurado. Ejemplo: git push -u origin main",
            "fatal: no configured push destination. Example: git push -u origin main"
          )
        );
      }
      remoteName = track.remote;
      branchName = track.branch;
    }
    if (!branchName || branchName === "HEAD") branchName = repo.head;
    return pushBranch(state, repo, remoteName, branchName, setUpstream, lang);
  }
  if (sub === "pull") {
    const remoteName = rest[0] || repo.upstream[repo.head]?.remote || "origin";
    const branchName = rest[1] || repo.upstream[repo.head]?.branch || repo.head;
    return pullBranch(state, repo, node, remoteName, branchName, lang);
  }
  if (sub === "diff") {
    const lines = [];
    const names = collectFileNames(node, repo);
    for (const name of names) {
      const work = node.files[name];
      const staged = repo.index[name];
      const head = headTree(repo)[name];
      const from = staged !== undefined ? staged : head;
      if (work === from) continue;
      lines.push(`--- ${name}`);
      lines.push(`+++ ${name}`);
      const left = (from || "").split("\n");
      const right = (work || "").split("\n");
      for (const line of left) if (!right.includes(line) && line !== "") lines.push(`-${line}`);
      for (const line of right) if (!left.includes(line) && line !== "") lines.push(`+${line}`);
    }
    return ok("diff", lines.length ? lines : L(lang, "sin diferencias entre el trabajo y lo preparado / el último commit.", "no differences between the work tree and the index / last commit."));
  }
  if (sub === "show") {
    const id = resolveRev(repo, rest[0] || "HEAD");
    if (!id) return fail("bad-rev", L(lang, "fatal: no hay un commit para mostrar.", "fatal: no commit to show."));
    const entry = repo.commits[id];
    const lines = [`commit ${id}`, entry.message, ""];
    for (const [name, content] of Object.entries(entry.tree)) {
      lines.push(`archivo ${name}`);
      lines.push(content.trimEnd());
    }
    return ok("show", lines);
  }
  return fail("unknown-command", L(lang, "comando no implementado.", "command not implemented."));
}

function gh(state, args, lang) {
  if (args[0] === "repo" && args[1] === "fork") {
    const upstream = state.github.upstreamUrl;
    if (!upstream || !state.remotes[upstream]) {
      return fail("no-upstream", L(lang, "fatal: en esta misión no hay un repositorio upstream para forkear.", "fatal: this mission has no upstream repository to fork."));
    }
    if (state.github.forkUrl) {
      const folder = repoNameFromUrl(upstream);
      const abs = `${HOME}/${folder}`;
      if (state.nodes[abs]) state.cwd = abs;
      return ok("fork-exists", L(lang, `Ya tenías el fork ${shortUrl(state.github.forkUrl)}. Estás en ${displayPath(state.cwd)}.`, `You already had the fork ${shortUrl(state.github.forkUrl)}. Now in ${displayPath(state.cwd)}.`), "ok");
    }
    const source = state.remotes[upstream];
    const forkUrl = `https://github.com/ada/${repoNameFromUrl(upstream)}.git`;
    const bare = bareRepo();
    for (const hash of Object.values(source.branches)) copyReachable(source, bare, hash);
    bare.branches = { ...source.branches };
    bare.head = source.head;
    state.remotes[forkUrl] = bare;
    state.github.forkUrl = forkUrl;
    const cloned = cloneRepo(state, forkUrl, repoNameFromUrl(forkUrl), lang);
    if (!cloned.ok) return cloned;
    const abs = `${HOME}/${repoNameFromUrl(forkUrl)}`;
    state.nodes[abs].repo.remotes.upstream = upstream;
    state.cwd = abs;
    return ok(
      "fork",
      [
        L(lang, `Fork creado: ${shortUrl(forkUrl)}`, `Fork created: ${shortUrl(forkUrl)}`),
        ...cloned.lines.map((line) => line.text),
        L(lang, "origin apunta a tu fork. upstream apunta al repositorio original.", "origin points at your fork. upstream points at the original repository."),
      ],
      "ok"
    );
  }
  if (args[0] === "pr" && args[1] === "create") {
    const repo = currentRepo(state);
    if (!repo) return requireRepo(state, lang);
    if (!state.github.forkUrl || repo.remotes.origin !== state.github.forkUrl) {
      return fail("no-fork", L(lang, "fatal: primero hacé el fork (`gh repo fork`).", "fatal: fork first (`gh repo fork`)."));
    }
    if (repo.unborn || repo.head === "main") {
      return fail("pr-on-main", L(lang, "error: abrí el pull request desde una rama de trabajo, no desde main. Ejemplo: git switch -c mejora", "error: open the pull request from a feature branch, not main. Example: git switch -c mejora"));
    }
    const bare = state.remotes[state.github.forkUrl];
    if (bare.branches[repo.head] !== repo.branches[repo.head]) {
      return fail("pr-not-pushed", L(lang, `error: la rama '${repo.head}' no está en origin. git push -u origin ${repo.head}`, `error: branch '${repo.head}' is not on origin. git push -u origin ${repo.head}`));
    }
    let title = L(lang, "Actualizar la bitácora", "Update the lab notebook");
    for (let i = 0; i < args.length; i += 1) {
      if (args[i] === "--title" || args[i] === "-t") title = args[i + 1] || title;
    }
    state.github.pr = { number: 1, title, branch: repo.head, state: "open" };
    return ok("pr-create", L(lang, `Pull request #1 abierto: ${title} (${repo.head} → main)`, `Pull request #1 opened: ${title} (${repo.head} → main)`), "ok");
  }
  if (args[0] === "pr" && args[1] === "merge") {
    const pr = state.github.pr;
    if (!pr || pr.state !== "open") return fail("no-pr", L(lang, "fatal: no hay un pull request abierto.", "fatal: there is no open pull request."));
    const fork = state.remotes[state.github.forkUrl];
    const upstream = state.remotes[state.github.upstreamUrl];
    const id = fork?.branches?.[pr.branch];
    if (!id) return fail("pr-not-pushed", L(lang, "error: la rama del PR no está en el fork.", "error: the PR branch is not on the fork."));
    const text = fork.commits[id]?.tree?.["bitacora.txt"] || "";
    if (state.github.requiredPattern && !new RegExp(state.github.requiredPattern).test(text)) {
      return fail(
        "review",
        L(
          lang,
          "error: Leo pidió un cambio antes de fusionar. La bitácora de la rama (ya pusheada) tiene que incluir la unidad °C. Hacé otro commit y git push.",
          "error: Leo asked for a change before merging. The pushed branch's notebook must include the °C unit. Make another commit and git push."
        )
      );
    }
    copyReachable(fork, upstream, id);
    const base = upstream.branches.main;
    if (base && !isAncestor(upstream, base, id)) {
      return fail("pr-diverged", L(lang, "error: upstream/main se movió y este taller no resuelve ese caso. Pedile a Leo que actualice.", "error: upstream/main moved in a way this workshop does not resolve."));
    }
    upstream.branches.main = id;
    pr.state = "merged";
    return ok("pr-merge", L(lang, `Pull request #${pr.number} fusionado en ${shortUrl(state.github.upstreamUrl)} main.`, `Pull request #${pr.number} merged into ${shortUrl(state.github.upstreamUrl)} main.`), "ok");
  }
  return fail(
    "unknown-gh",
    L(lang, "gh: en este taller existen `gh repo fork`, `gh pr create --title \"...\"` y `gh pr merge`.", "gh: this workshop supports `gh repo fork`, `gh pr create --title \"...\"` and `gh pr merge`.")
  );
}

function shell(state, bin, args, lang) {
  if (bin === "pwd") return ok("pwd", displayPath(state.cwd));
  if (bin === "ls") {
    const node = cwdNode(state);
    if (!node) return fail("no-dir", L(lang, "fatal: carpeta inválida.", "fatal: invalid folder."));
    const names = [...childrenOf(state, state.cwd).map((name) => `${name}/`), ...Object.keys(node.files).sort()];
    return ok("ls", names.length ? names : L(lang, "(carpeta vacía)", "(empty folder)"));
  }
  if (bin === "cd") {
    const target = resolvePath(state.cwd, args[0] || "~");
    const node = state.nodes[target];
    if (!node || node.type !== "dir") {
      return fail("cd", L(lang, `cd: no existe la carpeta ${displayPath(target)}`, `cd: folder ${displayPath(target)} does not exist`));
    }
    state.cwd = target;
    return ok("cd", displayPath(target));
  }
  if (bin === "cat") {
    if (!args[0]) return fail("cat", L(lang, "uso: cat <archivo>", "usage: cat <file>"));
    const abs = resolvePath(state.cwd, args[0]);
    const node = state.nodes[dirname(abs)];
    const name = basename(abs);
    if (!node || node.files[name] === undefined) return fail("cat", L(lang, `cat: ${args[0]}: no existe`, `cat: ${args[0]}: no such file`));
    return ok("cat", node.files[name].replace(/\n$/, ""));
  }
  if (bin === "mkdir") {
    if (!args[0]) return fail("mkdir", L(lang, "uso: mkdir <carpeta>", "usage: mkdir <folder>"));
    const abs = resolvePath(state.cwd, args[0]);
    if (state.nodes[abs]) return fail("mkdir", L(lang, "mkdir: ya existe", "mkdir: already exists"));
    ensureDir(state, abs);
    return ok("mkdir", displayPath(abs));
  }
  const gitGuess = suggest(bin, GIT_COMMANDS);
  if (gitGuess) {
    return fail(
      "unknown",
      L(
        lang,
        `orden no reconocida: ${bin}. ¿Quisiste decir \`git ${gitGuess}\`?`,
        `command not found: ${bin}. Did you mean \`git ${gitGuess}\`?`
      )
    );
  }
  const guess = suggest(bin, ["git", "help", "ls", "cd", "pwd", "cat", "clear", "gh"]);
  return fail(
    "unknown",
    guess
      ? L(lang, `orden no reconocida: ${bin}. ¿Quisiste decir '${guess}'? Escribí help.`, `command not found: ${bin}. Did you mean '${guess}'? Type help.`)
      : L(lang, `orden no reconocida: ${bin}. Escribí help para ver los comandos del taller.`, `command not found: ${bin}. Type help to see the workshop commands.`)
  );
}

function stripPrompt(line) {
  const match = line.match(/^(?:ada:)?~[^\s$]*(?:\s+\([^)]+\))?\$\s*(.*)$/);
  return match ? match[1] : line;
}

function exec(state, raw, lang) {
  const source = stripPrompt(String(raw ?? "").trim());
  if (!source || source.startsWith("#")) return ok("empty", []);
  const tokens = tokenize(source);
  if (!tokens.length) return ok("empty", []);
  const [bin, ...args] = tokens;
  if (bin === "help") return ok("help", helpLines(lang, args[0]));
  if (bin === "clear") return ok("clear", []);
  if (bin === "git") return git(state, args, lang);
  if (bin === "gh") return gh(state, args, lang);
  return shell(state, bin, args, lang);
}

function depthOf(commits, id, memo = new Map()) {
  if (memo.has(id)) return memo.get(id);
  const entry = commits[id];
  if (!entry) return 0;
  const depth = entry.parents.length ? Math.max(...entry.parents.map((parent) => depthOf(commits, parent, memo))) + 1 : 0;
  memo.set(id, depth);
  return depth;
}

function buildGraph(repo, { remoteIds = null, bare = false } = {}) {
  if (!repo) return { width: 280, height: 120, nodes: [], edges: [], empty: true };
  const tips = [];
  const branchNames = Object.keys(repo.branches).sort((a, b) => (a === "main" ? -1 : b === "main" ? 1 : a.localeCompare(b)));
  for (const name of branchNames) {
    if (repo.branches[name]) tips.push({ name, hash: repo.branches[name], remote: false });
  }
  if (!bare) {
    for (const name of Object.keys(repo.remoteRefs || {}).sort()) {
      tips.push({ name, hash: repo.remoteRefs[name], remote: true });
    }
  }
  const ids = new Set();
  for (const tip of tips) {
    const stack = [tip.hash];
    while (stack.length) {
      const id = stack.pop();
      if (!id || ids.has(id) || !repo.commits[id]) continue;
      ids.add(id);
      for (const parent of repo.commits[id].parents) stack.push(parent);
    }
  }
  if (!ids.size) return { width: 280, height: 120, nodes: [], edges: [], empty: true };
  const laneOf = new Map();
  for (const id of ids) {
    const lane = tips.findIndex((tip) => tip.hash === id || isAncestor(repo, id, tip.hash));
    laneOf.set(id, lane === -1 ? 0 : lane);
  }
  const laneCount = Math.max(...laneOf.values()) + 1;
  const depths = new Map([...ids].map((id) => [id, depthOf(repo.commits, id)]));
  const maxDepth = Math.max(...depths.values());
  const laneGap = 168;
  const rowGap = 76;
  const nodes = [...ids].map((id) => {
    const labels = [];
    if (!bare && !repo.unborn && repo.branches[repo.head] === id) labels.push("HEAD");
    for (const name of branchNames) if (repo.branches[name] === id) labels.push(name);
    if (!bare) for (const [name, hash] of Object.entries(repo.remoteRefs || {})) if (hash === id) labels.push(name);
    if (bare) for (const name of branchNames) if (repo.branches[name] === id && !labels.includes(name)) labels.push(name);
    const head = !bare && !repo.unborn && repo.branches[repo.head] === id;
    return {
      id,
      message: repo.commits[id].message,
      parents: repo.commits[id].parents.filter((parent) => ids.has(parent)),
      x: 36 + laneOf.get(id) * laneGap,
      y: 32 + depths.get(id) * rowGap,
      labels,
      head,
      pushed: remoteIds ? remoteIds.has(id) : true,
    };
  });
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const edges = [];
  for (const node of nodes) {
    for (const parent of node.parents) {
      const from = byId.get(parent);
      if (!from) continue;
      edges.push({ x1: from.x, y1: from.y, x2: node.x, y2: node.y });
    }
  }
  return {
    width: Math.max(280, 36 + laneCount * laneGap + 24),
    height: 48 + (maxDepth + 1) * rowGap,
    nodes,
    edges,
    empty: false,
  };
}

function githubView(state) {
  const upstream = state.github.upstreamUrl ? state.remotes[state.github.upstreamUrl] : null;
  const fork = state.github.forkUrl ? state.remotes[state.github.forkUrl] : null;
  const pr = state.github.pr;
  let snippetOk = false;
  if (pr && fork?.branches?.[pr.branch]) {
    const text = fork.commits[fork.branches[pr.branch]]?.tree?.["bitacora.txt"] || "";
    snippetOk = state.github.requiredPattern ? new RegExp(state.github.requiredPattern).test(text) : true;
  }
  const tip = upstream?.branches?.main;
  return {
    upstreamUrl: state.github.upstreamUrl,
    forkUrl: state.github.forkUrl,
    upstreamSlug: shortUrl(state.github.upstreamUrl),
    forkSlug: shortUrl(state.github.forkUrl),
    upstreamMessage: tip ? upstream.commits[tip]?.message || "" : "",
    upstreamFile: tip ? upstream.commits[tip]?.tree?.["bitacora.txt"] || "" : "",
    pr: pr ? { ...pr, snippetOk } : null,
  };
}

function modelOf(state) {
  const node = cwdNode(state);
  const repo = node?.repo || null;
  const names = collectFileNames(node, repo);
  const files = names.map((name) => ({
    name,
    status: fileStatus(repo, node?.files || {}, name),
    inWork: node?.files?.[name] !== undefined,
    inIndex: repo ? repo.index[name] !== undefined : false,
    inHead: repo ? headTree(repo)[name] !== undefined : false,
    preview: (node?.files?.[name] ?? repo?.index?.[name] ?? headTree(repo)[name] ?? "").trim(),
  }));
  const originUrl = repo?.remotes?.origin || null;
  const bare = originUrl ? state.remotes[originUrl] : null;
  const remoteIds = bare ? new Set(Object.keys(bare.commits)) : null;
  const branch = repo ? repo.head : null;
  const merging = Boolean(repo?.conflict || repo?.mergeHead);
  const prompt = repo ? `ada:${displayPath(state.cwd)} (${branch}${merging ? "|MERGING" : ""})$` : `ada:${displayPath(state.cwd)}$`;
  return {
    cwd: displayPath(state.cwd),
    abs: state.cwd,
    prompt,
    hasRepo: Boolean(repo),
    unborn: Boolean(repo?.unborn),
    branch,
    merging,
    conflictPaths: repo?.conflict?.paths || [],
    files,
    remotes: repo ? Object.entries(repo.remotes).map(([name, url]) => ({ name, url, slug: shortUrl(url) })) : [],
    localGraph: buildGraph(repo, { remoteIds, bare: false }),
    remoteGraph: bare ? buildGraph(bare, { remoteIds: null, bare: true }) : null,
    remoteLabel: originUrl ? `origin · ${shortUrl(originUrl)}` : "",
    commitCount: repo ? Object.keys(repo.commits).length : 0,
    github: githubView(state),
  };
}

export function createSim() {
  let state = freshState();
  return {
    exec(line, lang = "es") {
      return exec(state, line, lang === "en" ? "en" : "es");
    },
    reset() {
      state = freshState();
    },
    snapshot() {
      return structuredClone(state);
    },
    restore(snapshot) {
      state = structuredClone(snapshot);
    },
    enter(name) {
      const abs = `${HOME}/${name}`;
      ensureDir(state, abs);
      state.cwd = abs;
    },
    home() {
      state.cwd = HOME;
    },
    write(rel, content) {
      const abs = resolvePath(state.cwd, rel);
      const dir = dirname(abs);
      if (!state.nodes[dir]) return false;
      state.nodes[dir].files[basename(abs)] = String(content);
      return true;
    },
    read(rel) {
      const abs = resolvePath(state.cwd, rel);
      const node = state.nodes[dirname(abs)];
      if (!node) return null;
      return node.files[basename(abs)] ?? null;
    },
    currentRepo() {
      return currentRepo(state);
    },
    bare(url) {
      return state.remotes[url] || null;
    },
    query() {
      return state;
    },
    model() {
      return modelOf(state);
    },
    setMergeRule(pattern) {
      state.github.requiredPattern = pattern;
    },
    seedUpstream({ url, files, message }) {
      const bare = bareRepo();
      const id = nextId(state);
      bare.commits[id] = { id, parents: [], message, tree: { ...files } };
      bare.branches.main = id;
      bare.head = "main";
      state.remotes[url] = bare;
      state.github.upstreamUrl = url;
      return id;
    },
    noteFromTeammate(url) {
      const bare = state.remotes[url];
      if (!bare?.branches?.main || state.flags.teammate) return false;
      const parent = bare.branches.main;
      const parentCommit = bare.commits[parent];
      if (!parentCommit) return false;
      const id = nextId(state);
      bare.commits[id] = {
        id,
        parents: [parent],
        message: "Nota de Leo",
        tree: { ...parentCommit.tree, "nota-ada.txt": "Medí de nuevo a la tarde.\n" },
      };
      bare.branches.main = id;
      state.flags.teammate = true;
      return true;
    },
  };
}
