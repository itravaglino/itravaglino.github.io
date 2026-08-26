import "./fonts.css";
import "./styles.css";
import { initI18n } from "./i18n.js";

document.documentElement.classList.add("js");
initI18n();

const reveal = () => {
  const nodes = document.querySelectorAll("[data-reveal]");
  if (!nodes.length) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    nodes.forEach((el) => el.classList.add("is-in"));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
  );

  nodes.forEach((el) => io.observe(el));
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", reveal, { once: true });
} else {
  reveal();
}
