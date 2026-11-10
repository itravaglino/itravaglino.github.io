function staticField() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const narrow = window.matchMedia("(max-width: 760px)").matches;
  const save = navigator.connection && navigator.connection.saveData;
  return reduce || coarse || narrow || save;
}

function mountField(canvas) {
  if (!canvas || staticField()) {
    if (canvas) canvas.dataset.static = "true";
    return;
  }
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) {
    canvas.dataset.static = "true";
    return;
  }

  const pointer = { x: 0, y: 0, on: false };
  let width = 0;
  let height = 0;
  let dpr = 1;
  let running = true;
  let looping = false;
  const count = 96;
  const parts = Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    life: Math.random(),
  }));

  const resize = () => {
    const rect = canvas.parentElement.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const onMove = (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
    pointer.on = true;
  };
  const onLeave = () => {
    pointer.on = false;
  };

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerleave", onLeave);
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    running = !document.hidden && visible;
    if (running) start();
  });
  let visible = true;
  const view = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    running = visible && !document.hidden;
    if (running) start();
  });
  view.observe(canvas);
  resize();

  function start() {
    if (looping) return;
    looping = true;
    requestAnimationFrame(tick);
  }

  function tick(now) {
    if (!running) {
      looping = false;
      return;
    }
    requestAnimationFrame(tick);
    const t = now * 0.00015 + window.scrollY * 0.0004;
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,0.14)";
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineWidth = 1.15;
    for (const p of parts) {
      const px = p.x * width;
      const py = p.y * height;
      let vx = Math.sin(py * 0.008 + t) * Math.cos(px * 0.005 + t);
      let vy = Math.cos(px * 0.006 - t) * Math.sin(py * 0.007);
      if (pointer.on) {
        const dx = pointer.x - px;
        const dy = pointer.y - py;
        const d2 = dx * dx + dy * dy;
        if (d2 < 180 * 180) {
          const pull = (1 - Math.sqrt(d2) / 180) * 1.4;
          vx += (dx / 80) * pull;
          vy += (dy / 80) * pull;
        }
      }
      const nx = px + vx * 1.35;
      const ny = py + vy * 1.35;
      const hue = 180 + (px / width) * 50;
      ctx.strokeStyle = `hsla(${hue}, 92%, 74%, 0.8)`;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      p.x = nx / width;
      p.y = ny / height;
      if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) {
        p.x = Math.random();
        p.y = Math.random();
      }
    }
  }
  start();
}

function mountMagnetic() {
  if (staticField()) return;
  document.querySelectorAll("[data-magnetic]").forEach((node) => {
    node.addEventListener("pointermove", (event) => {
      const rect = node.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const x = Math.max(-8, Math.min(8, dx * 0.18));
      const y = Math.max(-8, Math.min(8, dy * 0.28));
      node.style.transform = `translate(${x}px, ${y}px)`;
    });
    node.addEventListener("pointerleave", () => {
      node.style.transform = "";
    });
  });
}

function mountPalette() {
  const dialog = document.getElementById("palette");
  const input = document.getElementById("palette-input");
  const list = document.getElementById("palette-list");
  const hint = document.getElementById("palette-hint");
  const empty = document.getElementById("palette-empty");
  const openers = document.querySelectorAll("[data-palette-open]");
  if (!dialog || !input || !list) return;

  const options = () => [...list.querySelectorAll("[role='option']")];
  options().forEach((node, index) => {
    if (!node.id) node.id = `palette-opt-${index}`;
  });
  let active = 0;

  const syncCopy = () => {
    if (hint) input.placeholder = hint.textContent;
    const kbd = document.querySelector(".palette-launch kbd");
    if (kbd) kbd.textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K";
  };

  const visible = () => options().filter((node) => !node.hidden);

  const paint = () => {
    const query = input.value.trim().toLowerCase();
    options().forEach((node) => {
      const text = node.textContent.toLowerCase();
      node.hidden = query.length > 0 && !text.includes(query);
      node.classList.remove("is-active");
    });
    const shown = visible();
    if (!shown.length) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    active = Math.min(active, shown.length - 1);
    shown[active].classList.add("is-active");
    input.setAttribute("aria-activedescendant", shown[active].id || "");
  };

  const open = () => {
    syncCopy();
    input.value = "";
    active = 0;
    paint();
    dialog.showModal();
    input.focus();
  };

  openers.forEach((node) => node.addEventListener("click", open));
  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if ((event.metaKey || event.ctrlKey) && key === "k") {
      event.preventDefault();
      if (dialog.open) dialog.close();
      else open();
    }
  });
  input.addEventListener("input", () => {
    active = 0;
    paint();
  });
  input.addEventListener("keydown", (event) => {
    const shown = visible();
    if (event.key === "ArrowDown") {
      event.preventDefault();
      active = (active + 1) % Math.max(shown.length, 1);
      paint();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      active = (active - 1 + shown.length) % Math.max(shown.length, 1);
      paint();
    } else if (event.key === "Enter" && shown[active]) {
      event.preventDefault();
      shown[active].click();
      dialog.close();
    }
  });
  list.addEventListener("click", (event) => {
    if (event.target.closest("a")) dialog.close();
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  document.addEventListener("it-lang", syncCopy);
  syncCopy();
}

export function initHome() {
  if (!document.body.classList.contains("page-home")) return;
  mountField(document.getElementById("field"));
  mountMagnetic();
  mountPalette();
}
