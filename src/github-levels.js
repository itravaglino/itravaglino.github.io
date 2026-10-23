import { isAncestor } from "./git-sim.js";

export const ORIGIN = "https://github.com/ada/bitacora.git";
export const UPSTREAM = "https://github.com/lab/bitacora.git";

export const TEXT = {
  seed: "Bitácora de laboratorio\nFecha: —\n",
  observation: "Bitácora de laboratorio\nFecha: —\nObservación: el cobre se oscurece.\n",
  base: "muestra: cobre\ntemperatura: 20\n",
  hot: "muestra: cobre\ntemperatura: 80\n",
  notes: "muestra: cobre\ntemperatura: 20\nnotas: ensayo estable\n",
  resolved: "muestra: cobre\ntemperatura: 80\nnotas: ensayo estable\n",
  upstream: "Bitácora\ntemperatura: 20\n",
  clarified: "Bitácora\ntemperatura: 20\nnota: medición de la mañana\n",
  withUnit: "Bitácora\ntemperatura: 20 °C\nnota: medición de la mañana\n",
};

function ran(history, pattern) {
  return history.some((line) => pattern.test(String(line).trim()));
}

function repoOf(sim) {
  return sim.currentRepo();
}

function clean(sim) {
  const model = sim.model();
  return model.hasRepo && !model.unborn && model.files.length > 0 && model.files.every((file) => file.status === "clean");
}

function hasMarker(text) {
  return typeof text === "string" && text.includes("<<<<<<<");
}

export function runCommand(sim, level, line, lang = "es") {
  const trimmed = String(line).trim();
  const result = sim.exec(trimmed, lang);
  const extra = level?.afterExec?.(sim, trimmed, result, lang) || [];
  return { ...result, lines: [...result.lines, ...extra] };
}

export function missionState(level, ctx) {
  return level.objectives.map((item) => ({ id: item.id, label: item.label, done: Boolean(item.test(ctx)) }));
}

export function missionComplete(level, ctx) {
  return level.objectives.every((item) => item.test(ctx));
}

const level1 = {
  id: 1,
  focusFile: "bitacora.txt",
  title: { es: "El repositorio", en: "The repository" },
  short: { es: "Repositorio", en: "Repository" },
  explain: {
    es: [
      "Un repositorio es una carpeta cuyo historial Git guarda en `.git`. Todavía no hay commits: solo el lugar donde van a vivir.",
      "Ada abre `~/taller` para una bitácora de laboratorio. El primer comando crea ese historial vacío.",
    ],
    en: [
      "A repository is a folder whose history Git stores in `.git`. There are no commits yet: only the place where they will live.",
      "Ada opens `~/taller` for a lab notebook. The first command creates that empty history.",
    ],
  },
  success: {
    es: "Listo: esta carpeta ya es un repositorio. `git status` puede mirar adentro. El siguiente paso es guardar una versión con un commit.",
    en: "Done: this folder is a repository. `git status` can look inside it. Next you will save a version with a commit.",
  },
  hints: {
    es: ["Estás en ~/taller.", "El comando es una sola palabra después de git.", "Escribí git init"],
    en: ["You are in ~/taller.", "The command is a single word after git.", "Type git init"],
  },
  chips: ["git init", "git status", "ls"],
  objectives: [
    {
      id: "init",
      label: { es: "Inicializar el repositorio con git init", en: "Initialize the repository with git init" },
      test: ({ sim, history }) => ran(history, /^git\s+init\b/) && Object.values(sim.query().nodes).some((node) => node.repo),
    },
  ],
  setup(sim) {
    sim.reset();
    sim.enter("taller");
  },
};

const level2 = {
  id: 2,
  focusFile: "bitacora.txt",
  title: { es: "El primer commit", en: "The first commit" },
  short: { es: "Commit", en: "Commit" },
  explain: {
    es: [
      "Git no guarda cada tecla. Hay tres zonas: el directorio de trabajo (lo que editás), el área de preparación o index (lo que va a entrar) y el repositorio (commits ya sellados).",
      "Cambiá `bitacora.txt` en el editor. `git status` muestra la diferencia, `git add` copia el archivo al index y `git commit -m` guarda esa foto con un mensaje.",
    ],
    en: [
      "Git does not save every keystroke. There are three zones: the working tree (what you edit), the staging area or index (what will be saved), and the repository (commits already sealed).",
      "Change `bitacora.txt` in the editor. `git status` shows the difference, `git add` copies the file into the index, and `git commit -m` stores that snapshot with a message.",
    ],
  },
  success: {
    es: "Ese commit es una foto completa del index, con autor, mensaje y un padre (acá, ninguno: es el primero). El trabajo quedó limpio.",
    en: "That commit is a full snapshot of the index, with a message and a parent (none, this time: it is the first). The work tree is clean.",
  },
  hints: {
    es: [
      "Si el archivo no cambió, el commit no tiene nada nuevo que guardar.",
      "El orden habitual es status, add, commit.",
      'git add bitacora.txt y después git commit -m "Registro la primera observación"',
    ],
    en: [
      "If the file did not change, the commit has nothing new to store.",
      "The usual order is status, add, commit.",
      'git add bitacora.txt then git commit -m "Record the first observation"',
    ],
  },
  chips: ["git status", "git add bitacora.txt", 'git commit -m "Registro la primera observación"'],
  objectives: [
    {
      id: "edit",
      label: { es: "Modificar bitacora.txt en el editor", en: "Edit bitacora.txt in the editor" },
      test: ({ sim }) => {
        const text = sim.read("bitacora.txt");
        return typeof text === "string" && text.trim().length > 0 && text !== TEXT.seed;
      },
    },
    {
      id: "status",
      label: { es: "Mirar el estado con git status", en: "Look at the state with git status" },
      test: ({ history }) => ran(history, /^git\s+status\b/),
    },
    {
      id: "add",
      label: { es: "Preparar el archivo con git add", en: "Stage the file with git add" },
      test: ({ history }) => ran(history, /^git\s+add\b/),
    },
    {
      id: "commit",
      label: { es: "Crear un commit que incluya tu cambio", en: "Create a commit that includes your change" },
      test: ({ sim }) => {
        const repo = repoOf(sim);
        if (!repo || repo.unborn) return false;
        const text = repo.commits[repo.branches[repo.head]]?.tree?.["bitacora.txt"];
        return text && text !== TEXT.seed && clean(sim);
      },
    },
  ],
  setup(sim) {
    sim.reset();
    sim.enter("taller");
    sim.write("bitacora.txt", TEXT.seed);
    sim.exec("git init");
  },
};

const level3 = {
  id: 3,
  focusFile: "bitacora.txt",
  title: { es: "La historia", en: "History" },
  short: { es: "Historia", en: "History" },
  explain: {
    es: [
      "Cada commit apunta a una instantánea y a su commit padre. `git log` recorre esa cadena desde HEAD hacia atrás.",
      "`--oneline` es la misma historia, en una línea por commit. El grafo de la derecha dibuja esos mismos enlaces.",
    ],
    en: [
      "Each commit points at a snapshot and at its parent commit. `git log` walks that chain from HEAD backwards.",
      "`--oneline` is the same history, one line per commit. The graph on the side draws those same links.",
    ],
  },
  success: {
    es: "HEAD es el extremo de la rama. Los padres quedan hacia arriba en el grafo: el commit de abajo no conoce al de arriba, el de arriba sí recuerda al de abajo.",
    en: "HEAD is the tip of the branch. Parents sit above it in the graph: a commit does not know its children, only its parents.",
  },
  hints: {
    es: ["No hace falta crear nada nuevo.", "git log muestra mensaje e identificador.", "Después probá git log --oneline"],
    en: ["You do not need to create anything new.", "git log shows the message and the id.", "Then try git log --oneline"],
  },
  chips: ["git log", "git log --oneline", "git show HEAD"],
  objectives: [
    {
      id: "log",
      label: { es: "Leer la historia con git log", en: "Read the history with git log" },
      test: ({ history }) => ran(history, /^git\s+log\b/),
    },
    {
      id: "oneline",
      label: { es: "Ver la versión corta con git log --oneline", en: "See the short form with git log --oneline" },
      test: ({ history }) => ran(history, /^git\s+log\b.*--oneline/),
    },
  ],
  setup(sim) {
    sim.reset();
    sim.enter("taller");
    sim.write("bitacora.txt", "Día 1\n");
    sim.exec("git init");
    sim.exec("git add bitacora.txt");
    sim.exec('git commit -m "Día 1"');
    sim.write("bitacora.txt", "Día 1\nDía 2\n");
    sim.exec("git add bitacora.txt");
    sim.exec('git commit -m "Día 2"');
    sim.write("bitacora.txt", "Día 1\nDía 2\nDía 3\n");
    sim.exec("git add bitacora.txt");
    sim.exec('git commit -m "Día 3"');
  },
};

const level4 = {
  id: 4,
  focusFile: "bitacora.txt",
  title: { es: "Ramas", en: "Branches" },
  short: { es: "Ramas", en: "Branches" },
  explain: {
    es: [
      "Una rama es un nombre que apunta a un commit. `main` es solo el nombre por defecto, no una carpeta distinta.",
      "Creá `ensayo`, entrá con `git switch` (o `git checkout`) y hacé un commit ahí. `main` se queda donde estaba.",
    ],
    en: [
      "A branch is a name that points at a commit. `main` is only the default name, not a different folder.",
      "Create `ensayo`, enter it with `git switch` (or `git checkout`), and commit there. `main` stays where it was.",
    ],
  },
  success: {
    es: "HEAD sigue a la rama actual. El commit nuevo avanzó `ensayo`; `main` sigue en el commit anterior. Por eso las ramas divergen.",
    en: "HEAD follows the current branch. The new commit moved `ensayo`; `main` is still on the earlier commit. That is how branches diverge.",
  },
  hints: {
    es: [
      "git branch ensayo crea el nombre. git switch ensayo entra.",
      "También vale git switch -c ensayo, que hace las dos cosas.",
      "En la rama, cambiá el archivo, git add bitacora.txt y git commit -m \"Subo la temperatura\".",
    ],
    en: [
      "git branch ensayo creates the name. git switch ensayo enters it.",
      "git switch -c ensayo does both.",
      "On that branch, change the file, git add bitacora.txt and git commit -m \"Raise the temperature\".",
    ],
  },
  chips: ["git branch", "git switch -c ensayo", "git branch ensayo", "git switch ensayo"],
  objectives: [
    {
      id: "branch",
      label: { es: "Crear una rama (git branch o switch -c)", en: "Create a branch (git branch or switch -c)" },
      test: ({ sim, history }) => {
        const repo = repoOf(sim);
        const created = repo && Object.keys(repo.branches).some((name) => name !== "main");
        const typed = ran(history, /^git\s+(branch\s+\S+|switch\s+-c\s+\S+|checkout\s+-b\s+\S+)/);
        return Boolean(created && typed);
      },
    },
    {
      id: "switch",
      label: { es: "Mover HEAD con git switch o git checkout", en: "Move HEAD with git switch or git checkout" },
      test: ({ sim, history }) => {
        const repo = repoOf(sim);
        return Boolean(repo && !repo.unborn && repo.head !== "main" && ran(history, /^git\s+(switch|checkout)\b/));
      },
    },
    {
      id: "ahead",
      label: { es: "Hacer un commit en esa rama, no en main", en: "Commit on that branch, not on main" },
      test: ({ sim }) => {
        const repo = repoOf(sim);
        if (!repo || repo.unborn || repo.head === "main") return false;
        const tip = repo.branches[repo.head];
        const main = repo.branches.main;
        return tip !== main && isAncestor(repo, main, tip);
      },
    },
  ],
  setup(sim) {
    sim.reset();
    sim.enter("taller");
    sim.write("bitacora.txt", TEXT.base);
    sim.exec("git init");
    sim.exec("git add bitacora.txt");
    sim.exec('git commit -m "Inicio de la bitácora"');
  },
};

const level5 = {
  id: 5,
  focusFile: "bitacora.txt",
  title: { es: "Merge y conflicto", en: "Merge and conflict" },
  short: { es: "Merge", en: "Merge" },
  explain: {
    es: [
      "`main` anotó «ensayo estable» y la rama `ensayo` subió la temperatura a 80. Las dos cambiaron el mismo archivo desde el ancestro común.",
      "`git merge ensayo` no puede elegir solo. Deja marcas `<<<<<<<`. Conservá la temperatura nueva y la nota, borrá las marcas, prepará el archivo y hacé el commit de merge.",
    ],
    en: [
      "`main` recorded “stable run” and branch `ensayo` raised the temperature to 80. Both changed the same file since the common ancestor.",
      "`git merge ensayo` cannot choose alone. It leaves `<<<<<<<` markers. Keep the new temperature and the note, delete the markers, stage the file, and make the merge commit.",
    ],
  },
  success: {
    es: "El commit de merge tiene dos padres: las dos puntas que se unieron. La instantánea es la que armaste vos al resolver el conflicto.",
    en: "The merge commit has two parents: the two tips that joined. The snapshot is the one you built when you resolved the conflict.",
  },
  hints: {
    es: [
      "Estás en main. git merge ensayo abre el conflicto.",
      "El archivo resuelto tiene que incluir temperatura: 80 y notas: ensayo estable, sin <<<<<<<.",
      'git add bitacora.txt y git commit -m "Integro el ensayo"',
    ],
    en: [
      "You are on main. git merge ensayo opens the conflict.",
      "The resolved file must include temperatura: 80 and notas: ensayo estable, with no <<<<<<<.",
      'git add bitacora.txt and git commit -m "Merge the experiment"',
    ],
  },
  chips: ["git merge ensayo", "git status", "git add bitacora.txt", 'git commit -m "Integro el ensayo"', "git merge --abort"],
  objectives: [
    {
      id: "merge",
      label: { es: "Lanzar git merge ensayo", en: "Run git merge ensayo" },
      test: ({ sim, history }) => {
        const repo = repoOf(sim);
        const started = Boolean(repo && (repo.mergeHead || repo.conflict || Object.values(repo.commits).some((commit) => commit.parents.length > 1)));
        return started && ran(history, /^git\s+merge\s+ensayo\b/);
      },
    },
    {
      id: "resolve",
      label: { es: "Resolver el archivo: temperatura 80 y la nota, sin marcas", en: "Resolve the file: temperature 80 and the note, no markers" },
      test: ({ sim }) => {
        const text = sim.read("bitacora.txt") || "";
        return text.includes("temperatura: 80") && text.includes("notas: ensayo estable") && !hasMarker(text);
      },
    },
    {
      id: "commit",
      label: { es: "Cerrar el merge con git add y git commit", en: "Finish the merge with git add and git commit" },
      test: ({ sim }) => {
        const repo = repoOf(sim);
        if (!repo || repo.unborn || repo.conflict || repo.mergeHead) return false;
        const tip = repo.commits[repo.branches.main];
        const text = tip?.tree?.["bitacora.txt"] || "";
        return Boolean(tip && tip.parents.length > 1 && text.includes("temperatura: 80") && text.includes("notas: ensayo estable") && !hasMarker(text));
      },
    },
  ],
  setup(sim) {
    sim.reset();
    sim.enter("taller");
    sim.write("bitacora.txt", TEXT.base);
    sim.exec("git init");
    sim.exec("git add bitacora.txt");
    sim.exec('git commit -m "Inicio"');
    sim.exec("git switch -c ensayo");
    sim.write("bitacora.txt", TEXT.hot);
    sim.exec("git add bitacora.txt");
    sim.exec('git commit -m "Subo la temperatura"');
    sim.exec("git switch main");
    sim.write("bitacora.txt", TEXT.notes);
    sim.exec("git add bitacora.txt");
    sim.exec('git commit -m "Dejo una nota"');
  },
};

const level6 = {
  id: 6,
  focusFile: "bitacora.txt",
  title: { es: "El remoto", en: "The remote" },
  short: { es: "Remoto", en: "Remote" },
  explain: {
    es: [
      "`origin` es otra copia del repositorio, con su propio historial. `git remote add` le pone nombre y URL. `git push` sube commits. El panel de la derecha es esa copia.",
      "Después del primer push, Leo agrega un commit en origin. `git fetch` lo baja sin tocarte los archivos; `git pull` es fetch más merge. `git clone` arma una carpeta nueva a partir del remoto.",
    ],
    en: [
      "`origin` is another copy of the repository, with its own history. `git remote add` gives it a name and a URL. `git push` uploads commits. The panel on the right is that copy.",
      "After the first push, Leo adds a commit on origin. `git fetch` downloads it without touching your files; `git pull` is fetch plus merge. `git clone` builds a new folder from the remote.",
    ],
  },
  success: {
    es: "Tu main, origin y la carpeta clonada pueden apuntar a los mismos commits. No son la misma carpeta: son copias que se sincronizan con push, fetch y pull.",
    en: "Your main, origin, and the cloned folder can point at the same commits. They are not the same folder: they are copies kept in sync with push, fetch, and pull.",
  },
  hints: {
    es: [
      `La URL de este taller es ${ORIGIN}`,
      "git push -u origin main sube main y recuerda el vínculo. Después git pull trae la nota de Leo.",
      `git clone ${ORIGIN} copia`,
    ],
    en: [
      `This workshop's URL is ${ORIGIN}`,
      "git push -u origin main uploads main and remembers the link. Then git pull brings Leo's note.",
      `git clone ${ORIGIN} copia`,
    ],
  },
  chips: [`git remote add origin ${ORIGIN}`, "git push -u origin main", "git fetch", "git pull", `git clone ${ORIGIN} copia`],
  objectives: [
    {
      id: "remote",
      label: { es: "Agregar origin con git remote add", en: "Add origin with git remote add" },
      test: ({ sim }) => (repoOf(sim)?.remotes?.origin || null) === ORIGIN,
    },
    {
      id: "push",
      label: { es: "Subir main con git push", en: "Upload main with git push" },
      test: ({ sim }) => {
        const bare = sim.bare(ORIGIN);
        return Boolean(bare && Object.keys(bare.commits).length > 0);
      },
    },
    {
      id: "pull",
      label: { es: "Traer el commit de Leo con git pull (o fetch y merge)", en: "Bring Leo's commit with git pull (or fetch and merge)" },
      test: ({ sim }) => {
        const repo = repoOf(sim);
        if (!repo || repo.unborn) return false;
        const text = repo.commits[repo.branches[repo.head]]?.tree?.["nota-ada.txt"];
        return Boolean(text && text.includes("tarde"));
      },
    },
    {
      id: "clone",
      label: { es: "Clonar origin en una carpeta nueva", en: "Clone origin into a new folder" },
      test: ({ sim }) =>
        Object.entries(sim.query().nodes).some(([path, node]) => {
          if (path.endsWith("/taller") || !node.repo || node.repo.unborn) return false;
          return node.repo.remotes.origin === ORIGIN;
        }),
    },
  ],
  afterExec(sim, line, result, lang) {
    if (!result.ok || !/^git\s+push\b/.test(line)) return [];
    if (!sim.noteFromTeammate(ORIGIN)) return [];
    return [
      {
        type: "info",
        text:
          lang === "en"
            ? "Leo pushed a commit to origin (nota-ada.txt). Your local main does not have it yet."
            : "Leo empujó un commit a origin (nota-ada.txt). Tu main local todavía no lo tiene.",
      },
    ];
  },
  setup(sim) {
    sim.reset();
    sim.enter("taller");
    sim.write("bitacora.txt", TEXT.seed);
    sim.exec("git init");
    sim.exec("git add bitacora.txt");
    sim.exec('git commit -m "Bitácora inicial"');
  },
};

const level7 = {
  id: 7,
  focusFile: "bitacora.txt",
  title: { es: "Flujo de GitHub", en: "GitHub flow" },
  short: { es: "Pull request", en: "Pull request" },
  explain: {
    es: [
      "En el repositorio de otra persona no se empuja a `main` directo. Se hace un fork (tu copia), una rama, un push y un pull request para pedir la integración.",
      "Leo revisa y pide la unidad en la temperatura. Eso es otro commit en la misma rama y otro push. Recién ahí el PR se puede fusionar.",
    ],
    en: [
      "You do not push straight to someone else's `main`. You fork (your copy), branch, push, and open a pull request to ask for the integration.",
      "Leo reviews and asks for the temperature unit. That is another commit on the same branch and another push. Only then can the PR be merged.",
    ],
  },
  success: {
    es: "El pull request no copia archivos a mano: es una conversación sobre una rama ya pusheada. Al fusionarlo, `main` de lab/bitacora pasa a incluir tus commits.",
    en: "A pull request does not copy files by hand: it is a conversation about a branch you already pushed. Merging it moves lab/bitacora `main` forward to include your commits.",
  },
  hints: {
    es: [
      "gh repo fork clona tu copia en ~/bitacora.",
      "git switch -c mejora, editá, commit, git push -u origin mejora y gh pr create --title \"Unidad de temperatura\".",
      "Sumá °C, hacé otro commit, git push y gh pr merge.",
    ],
    en: [
      "gh repo fork clones your copy into ~/bitacora.",
      "git switch -c mejora, edit, commit, git push -u origin mejora and gh pr create --title \"Temperature unit\".",
      "Add °C, commit again, git push and gh pr merge.",
    ],
  },
  chips: ["gh repo fork", "git switch -c mejora", "git push -u origin mejora", 'gh pr create --title "Unidad de temperatura"', "gh pr merge"],
  objectives: [
    {
      id: "fork",
      label: { es: "Hacer un fork y entrar al clon", en: "Fork and enter the clone" },
      test: ({ sim }) => {
        const github = sim.query().github;
        const repo = repoOf(sim);
        return Boolean(github.forkUrl && repo && repo.remotes.origin === github.forkUrl);
      },
    },
    {
      id: "branch",
      label: { es: "Crear una rama de trabajo y commitear ahí", en: "Create a feature branch and commit on it" },
      test: ({ sim }) => {
        const repo = repoOf(sim);
        if (!repo || repo.unborn || repo.head === "main") return false;
        return isAncestor(repo, repo.branches.main, repo.branches[repo.head]) && repo.branches[repo.head] !== repo.branches.main;
      },
    },
    {
      id: "pr",
      label: { es: "Abrir un pull request de esa rama", en: "Open a pull request from that branch" },
      test: ({ sim }) => {
        const pr = sim.query().github.pr;
        return Boolean(pr && (pr.state === "open" || pr.state === "merged"));
      },
    },
    {
      id: "review",
      label: { es: "Subir el cambio que pidió Leo (°C) a origin", en: "Push the change Leo asked for (°C) to origin" },
      test: ({ sim }) => Boolean(sim.model().github.pr?.snippetOk),
    },
    {
      id: "merge",
      label: { es: "Fusionar el pull request en upstream", en: "Merge the pull request into upstream" },
      test: ({ sim }) => {
        const github = sim.query().github;
        const upstream = sim.bare(UPSTREAM);
        const tip = upstream?.branches?.main;
        const text = tip ? upstream.commits[tip]?.tree?.["bitacora.txt"] || "" : "";
        return github.pr?.state === "merged" && /°C|ºC/.test(text);
      },
    },
  ],
  setup(sim) {
    sim.reset();
    sim.home();
    sim.seedUpstream({
      url: UPSTREAM,
      files: { "bitacora.txt": TEXT.upstream },
      message: "Bitácora inicial",
    });
    sim.setMergeRule("°C|ºC");
  },
};

export const LEVELS = [level1, level2, level3, level4, level5, level6, level7];

export function levelById(id) {
  return LEVELS.find((level) => level.id === id) || LEVELS[0];
}

export function uiText(lang) {
  const en = lang === "en";
  return {
    objective: en ? "Objective" : "Objetivo",
    hints: en ? "Hints" : "Pistas",
    reset: en ? "Restart mission" : "Reiniciar misión",
    next: en ? "Next mission" : "Siguiente misión",
    editor: en ? "Editor" : "Editor",
    terminal: en ? "Terminal" : "Terminal",
    command: en ? "Command" : "Comando",
    history: en ? "History" : "Historial",
    local: en ? "Local" : "Local",
    remote: en ? "Remote" : "Remoto",
    noRemote: en ? "No origin yet. It will appear when you add a remote or fork." : "Todavía no hay origin. Aparece al agregar un remoto o al hacer fork.",
    noCommits: en ? "No commits yet." : "Todavía no hay commits.",
    work: en ? "Working tree" : "Trabajo",
    index: en ? "Staging" : "Preparación",
    repo: en ? "Repository (HEAD)" : "Repositorio (HEAD)",
    zoneHelp: en
      ? "Same files, three places. A commit snapshots the staging area, not every unsaved keystroke."
      : "Los mismos archivos, tres lugares. Un commit fotografía el área de preparación, no cada tecla sin guardar.",
    emptyZone: en ? "Empty" : "Vacío",
    conflict: en ? "This file has conflict markers. Keep the lines you want and delete <<<<<<<, ======= and >>>>>>>." : "Este archivo tiene marcas de conflicto. Quedate con las líneas que sirven y borra <<<<<<<, ======= y >>>>>>>.",
    placeholder: en ? "The folder is empty. You can start bitacora.txt here." : "La carpeta está vacía. Podés empezar bitacora.txt acá.",
    insert: en ? "Insert command" : "Insertar comando",
    progress: en ? "Missions" : "Misiones",
    locked: en ? "Finish the previous mission to unlock this one." : "Termina la misión anterior para desbloquear esta.",
    done: en ? "Done" : "Lista",
    pending: en ? "Pending" : "Pendiente",
    diploma: en ? "Open the completion note" : "Ver el cierre",
    resetAll: en ? "Erase all progress" : "Borrar todo el progreso",
    finaleTitle: en ? "Workshop complete" : "Taller completo",
    finaleBody: en
      ? "You walked the path from an empty folder to a merged pull request. The commands were a small Git, and the graph was the same idea: commits, parents, branches, and two copies."
      : "Recorriste el camino desde una carpeta vacía hasta un pull request fusionado. Los comandos eran un Git pequeño, y el grafo era la misma idea: commits, padres, ramas y dos copias.",
    finaleClose: en ? "Keep practicing" : "Seguir practicando",
    replay: en ? "You can replay any mission. Completed ones stay marked." : "Podés rehacer cualquier misión. Las completadas siguen marcadas.",
    prTitle: en ? "Pull request" : "Pull request",
    fork: en ? "Fork lab/bitacora" : "Fork de lab/bitacora",
    openPr: en ? "Open pull request" : "Abrir pull request",
    mergePr: en ? "Merge pull request" : "Fusionar pull request",
    upstream: en ? "Upstream" : "Upstream",
    reviewTitle: en ? "Review from Leo" : "Revisión de Leo",
    reviewWait: en
      ? "Open the pull request. Leo reviews the pushed branch, not the file you have only on your machine."
      : "Abrí el pull request. Leo revisa la rama que subiste, no el archivo que solo está en tu máquina.",
    reviewAsk: en
      ? "Leo: the temperature is missing its unit. Push a new commit on this branch so the notebook says 20 °C, then we can merge."
      : "Leo: a la temperatura le falta la unidad. Empujá otro commit en esta rama para que la bitácora diga 20 °C y recién ahí se fusiona.",
    reviewOk: en
      ? "Leo: the pushed branch includes °C. It can be merged into lab/bitacora."
      : "Leo: la rama pusheada ya incluye °C. Se puede fusionar en lab/bitacora.",
    reviewMerged: en ? "Merged into upstream main." : "Fusionado en main de upstream.",
    fileLabel: en ? "File contents" : "Contenido del archivo",
    graphHelp: en ? "Commit graph" : "Grafo de commits",
    restarted: en ? "Mission restarted." : "Misión reiniciada.",
    allReset: en ? "Progress erased. Back to the first mission." : "Progreso borrado. Volvés a la primera misión.",
    head: "HEAD",
    unpushed: en ? "not on origin" : "no está en origin",
    status: {
      conflict: en ? "conflict" : "conflicto",
      partial: en ? "staged and edited" : "preparado y editado",
      modified: en ? "modified" : "modificado",
      staged: en ? "staged" : "preparado",
      untracked: en ? "untracked" : "sin seguimiento",
      clean: en ? "matches HEAD" : "igual a HEAD",
    },
  };
}
