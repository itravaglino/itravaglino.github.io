import { gsap } from "../vendor/gsap/index.js";
import { ScrollTrigger } from "../vendor/gsap/ScrollTrigger.js";
import Lenis from "../vendor/lenis.mjs";

gsap.registerPlugin(ScrollTrigger);

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine = window.matchMedia("(pointer: fine)").matches;

let heroTween;
let trackTween;
let waveTween;
let lenis;

function wideScreen() {
  return window.matchMedia("(min-width: 900px)").matches;
}

function setupName(replay) {
  const h1 = document.getElementById("nombre");
  if (!h1 || reduce) return;
  const word = h1.textContent.replace(/\s+/g, "");
  h1.setAttribute("aria-label", word);
  h1.replaceChildren();
  const line = document.createElement("span");
  line.className = "name-line";
  line.setAttribute("aria-hidden", "true");
  for (const ch of word) {
    const outer = document.createElement("span");
    outer.className = "name-ch";
    const inner = document.createElement("span");
    inner.textContent = ch;
    outer.appendChild(inner);
    line.appendChild(outer);
  }
  h1.appendChild(line);
  const chars = line.querySelectorAll(".name-ch > span");
  gsap.fromTo(
    chars,
    { yPercent: 110 },
    {
      yPercent: 0,
      duration: replay ? 0.7 : 1.15,
      ease: "expo.out",
      stagger: 0.042,
      onComplete: () => buildHeroScrub(chars),
    }
  );
}

function buildHeroScrub(chars) {
  heroTween?.scrollTrigger?.kill();
  heroTween?.kill();
  const wave = document.querySelector(".wave-path");
  const pin = wideScreen();
  const tl = gsap.timeline({
    scrollTrigger: {
      id: "hero-scrub",
      trigger: ".hero",
      start: "top top",
      end: pin ? "+=75%" : "bottom top",
      pin,
      scrub: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  });
  tl.fromTo("#nombre", { fontWeight: 800 }, { fontWeight: 500, ease: "none", immediateRender: false }, 0);
  tl.to(chars, { scale: 0.84, ease: "none", stagger: 0.008 }, 0);
  if (pin) tl.to(".hero-copy", { y: 52, ease: "none" }, 0);
  heroTween = tl;
  if (wave) {
    const length = wave.getTotalLength();
    waveTween?.scrollTrigger?.kill();
    waveTween?.kill();
    waveTween = gsap.fromTo(
      wave,
      { strokeDashoffset: length * 0.72 },
      {
        strokeDashoffset: 0,
        ease: "none",
        immediateRender: false,
        scrollTrigger: {
          trigger: ".wave-band",
          start: "top 90%",
          end: "bottom 40%",
          scrub: true,
        },
      }
    );
  }
}

function setupTrack() {
  trackTween?.scrollTrigger?.kill();
  trackTween?.kill();
  trackTween = null;
  const track = document.querySelector(".work-track");
  const pin = document.querySelector(".work-pin");
  if (!track || !pin || !wideScreen()) {
    gsap.set(track, { clearProps: "transform" });
    return;
  }
  trackTween = gsap.to(track, {
    x: () => -(track.scrollWidth - window.innerWidth),
    ease: "none",
    scrollTrigger: {
      id: "work-track",
      trigger: pin,
      start: "top top",
      end: () => "+=" + Math.max(track.scrollWidth - window.innerWidth, 0),
      pin: true,
      scrub: 0.65,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  });
  const st = trackTween.scrollTrigger;
  pin.querySelectorAll("a").forEach((link) => {
    if (link.dataset.trackFocus) return;
    link.dataset.trackFocus = "1";
    link.addEventListener("focus", () => {
      const panel = link.closest(".panel");
      if (!panel || !st) return;
      const panels = [...track.children];
      const index = panels.indexOf(panel);
      if (index < 0) return;
      const y = st.start + ((st.end - st.start) * index) / Math.max(panels.length - 1, 1);
      if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
      else window.scrollTo(0, y);
    });
  });
}

function setupCursor() {
  if (!fine) return;
  const cursor = document.querySelector(".cursor");
  if (!cursor) return;
  document.body.classList.add("has-cursor");
  const xTo = gsap.quickTo(cursor, "x", { duration: 0.4, ease: "power3.out" });
  const yTo = gsap.quickTo(cursor, "y", { duration: 0.4, ease: "power3.out" });
  window.addEventListener(
    "pointermove",
    (event) => {
      xTo(event.clientX);
      yTo(event.clientY);
    },
    { passive: true }
  );
  document.querySelectorAll("a, button").forEach((el) => {
    el.addEventListener("pointerenter", () => cursor.classList.add("is-hot"));
    el.addEventListener("pointerleave", () => cursor.classList.remove("is-hot"));
  });
}

function setupReveals() {
  const masks = document.querySelectorAll(".mask-line");
  const seen = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        seen.unobserve(entry.target);
      });
    },
    { threshold: 0.35 }
  );
  masks.forEach((el) => seen.observe(el));

  const steps = [...document.querySelectorAll(".steps li")];
  const stepWatch = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      steps.forEach((li, index) => {
        li.style.setProperty("--i", String(index));
        li.classList.add("is-in");
      });
      stepWatch.disconnect();
    },
    { threshold: 0.3 }
  );
  const list = document.querySelector(".steps");
  if (list) stepWatch.observe(list);
}

export function initMotion() {
  if (!document.body.classList.contains("page-home")) return;
  if (reduce) return;

  document.body.classList.add("motion");
  const wave = document.querySelector(".wave-path");
  if (wave) {
    const length = wave.getTotalLength();
    wave.style.strokeDasharray = String(length);
    wave.style.strokeDashoffset = String(length * 0.72);
  }
  lenis = new Lenis({
    duration: wideScreen() ? 1.05 : 0.75,
    smoothWheel: true,
    anchors: true,
    autoRaf: false,
  });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);

  setupName(false);
  setupReveals();
  setupCursor();
  setupTrack();

  document.addEventListener("it-lang", () => {
    setupName(true);
    ScrollTrigger.refresh();
  });

  document.fonts?.ready?.then(() => ScrollTrigger.refresh());
}
