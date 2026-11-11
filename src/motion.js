import { gsap } from "../vendor/gsap/index.js";
import { ScrollTrigger } from "../vendor/gsap/ScrollTrigger.js";
import Lenis from "../vendor/lenis.mjs";

gsap.registerPlugin(ScrollTrigger);

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let heroTween;
let waveTween;
let lenis;
const scrubTweens = [];

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
      scrub: 0.9,
      invalidateOnRefresh: true,
    },
  });
  tl.fromTo(
    "#nombre",
    { fontWeight: 800 },
    { fontWeight: 500, duration: 1, ease: "none", immediateRender: false },
    0
  );
  tl.to(chars, { scale: 0.84, duration: 1, ease: "none" }, 0);
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
          start: "top 88%",
          end: "bottom 55%",
          scrub: 0.9,
          invalidateOnRefresh: true,
        },
      }
    );
  }
}

function track(tween) {
  scrubTweens.push(tween);
  return tween;
}

function clearScrubs() {
  scrubTweens.forEach((tween) => {
    tween.scrollTrigger?.kill();
    tween.kill();
  });
  scrubTweens.length = 0;
}

function setupScrubs() {
  clearScrubs();
  document.querySelectorAll(".mask-line").forEach((mask) => {
    if (mask.closest(".hero")) return;
    const heading = mask.querySelector("h2, .section-title");
    if (!heading) return;
    track(
      gsap.fromTo(
        heading,
        { yPercent: 110 },
        {
          yPercent: 0,
          ease: "none",
          immediateRender: true,
          scrollTrigger: {
            trigger: mask,
            start: "top 92%",
            end: "top 58%",
            scrub: 0.9,
            invalidateOnRefresh: true,
          },
        }
      )
    );
  });

  document.querySelectorAll(".steps li").forEach((item) => {
    track(
      gsap.fromTo(
        item,
        { y: 28 },
        {
          y: 0,
          ease: "none",
          immediateRender: true,
          scrollTrigger: {
            trigger: item,
            start: "top 96%",
            end: "top 72%",
            scrub: 0.9,
            invalidateOnRefresh: true,
          },
        }
      )
    );
  });

  document.querySelectorAll(".panel-inner").forEach((inner) => {
    track(
      gsap.fromTo(
        inner,
        { y: 22 },
        {
          y: 0,
          ease: "none",
          immediateRender: true,
          scrollTrigger: {
            trigger: inner,
            start: "top bottom",
            end: "top 42%",
            scrub: 1,
            invalidateOnRefresh: true,
          },
        }
      )
    );
  });
}

export function initMotion() {
  if (!document.body.classList.contains("page-home")) return;
  if (reduce) return;

  document.documentElement.classList.add("motion");
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
  setupScrubs();

  const refresh = () => ScrollTrigger.refresh();
  document.addEventListener("it-lang", () => setupName(true));
  document.fonts?.ready?.then(() => {
    refresh();
    requestAnimationFrame(refresh);
  });
  window.addEventListener("load", refresh, { once: true });
}
