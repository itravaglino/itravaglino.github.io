import { gsap } from "../vendor/gsap/index.js";
import { ScrollTrigger } from "../vendor/gsap/ScrollTrigger.js";
import Lenis from "../vendor/lenis.mjs";

gsap.registerPlugin(ScrollTrigger);

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  heroTween?.scrollTrigger?.kill();
  heroTween?.kill();
  heroTween = null;
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
      onComplete: () => {
        buildHeroScrub(chars);
        ScrollTrigger.refresh();
      },
    }
  );
}

function buildHeroScrub(chars) {
  heroTween?.scrollTrigger?.kill();
  heroTween?.kill();
  const wave = document.querySelector(".wave-path");
  const tl = gsap.timeline({
    scrollTrigger: {
      id: "hero-scrub",
      trigger: ".hero",
      start: "top top",
      end: "+=70%",
      scrub: 0.8,
      invalidateOnRefresh: true,
    },
  });
  tl.fromTo(
    "#nombre",
    { fontWeight: 800 },
    { fontWeight: 500, duration: 1, ease: "power1.inOut", immediateRender: false },
    0
  );
  tl.to(chars, { scale: 0.84, duration: 1, ease: "power1.inOut" }, 0);
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
        ease: "power1.inOut",
        immediateRender: false,
        scrollTrigger: {
          trigger: ".wave-band",
          start: "top 88%",
          end: "bottom 55%",
          scrub: 0.8,
          invalidateOnRefresh: true,
        },
      }
    );
  }
}

function workDistance(track) {
  const travel = Math.max(track.scrollWidth - window.innerWidth, 0);
  const panels = track.querySelectorAll(":scope > .panel").length || 1;
  const cap = (panels / 1.5) * window.innerHeight;
  return Math.min(travel, cap);
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
    ease: "power1.out",
    scrollTrigger: {
      id: "work-track",
      trigger: pin,
      start: "top top",
      end: () => "+=" + workDistance(track),
      pin: true,
      pinSpacing: true,
      scrub: 0.85,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  });
  pin.querySelectorAll("a").forEach((link) => {
    if (link.dataset.trackFocus) return;
    link.dataset.trackFocus = "1";
    link.addEventListener("focus", () => {
      const st = ScrollTrigger.getById("work-track");
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
    lerp: 0.1,
    wheelMultiplier: 1,
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
  setupTrack();

  const refresh = () => ScrollTrigger.refresh();
  document.addEventListener("it-lang", () => setupName(true));
  document.fonts?.ready?.then(() => {
    refresh();
    requestAnimationFrame(refresh);
  });
  window.addEventListener("load", refresh, { once: true });
  let resizeFrame = 0;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      setupTrack();
      refresh();
    });
  });
}
