import { translations } from "./content.js";

const STORAGE_KEY = "it-lang";
const DEFAULT_LANG = "en";

export function resolveStoredLang(stored) {
  if (stored === "en" || stored === "es") return stored;
  return DEFAULT_LANG;
}

function lookup(obj, path) {
  return path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

export function getLang() {
  try {
    return resolveStoredLang(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_LANG;
  }
}

export function setLang(lang) {
  const next = lang === "en" ? "en" : "es";
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* private mode */
  }
  applyLang(next);
}

export function applyLang(lang) {
  const dict = translations[lang] || translations.es;
  document.documentElement.lang = lang;
  document.documentElement.dataset.lang = lang;

  const page = document.documentElement.dataset.page;
  const titleKey = page === "cv" ? "cv.docTitle" : page === "github" ? "game.docTitle" : "meta.title";
  const title = lookup(dict, titleKey);
  if (title) document.title = title;

  const description = lookup(dict, page === "github" ? "game.docDescription" : "meta.description");
  const descEl = document.querySelector('meta[name="description"]');
  if (descEl && description) descEl.setAttribute("content", description);

  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle && title) ogTitle.setAttribute("content", title);

  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc && description) ogDesc.setAttribute("content", description);

  const ogLocale = document.querySelector('meta[property="og:locale"]');
  if (ogLocale) ogLocale.setAttribute("content", lang === "en" ? "en_US" : "es_AR");

  const jobTitle = lookup(dict, "meta.jobTitle");
  const ld = document.querySelector('script[type="application/ld+json"]');
  if (ld && jobTitle) {
    try {
      const data = JSON.parse(ld.textContent);
      if (data && typeof data === "object") {
        data.jobTitle = jobTitle;
        ld.textContent = JSON.stringify(data, null, 2);
      }
    } catch {
      /* leave the static job title */
    }
  }

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const value = lookup(dict, el.dataset.i18n);
    if (typeof value === "string") el.textContent = value;
  });

  document.querySelectorAll("[data-i18n-html]").forEach((el) => {
    const value = lookup(dict, el.dataset.i18nHtml);
    if (typeof value === "string") el.innerHTML = value;
  });

  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const value = lookup(dict, el.dataset.i18nAria);
    if (typeof value === "string") el.setAttribute("aria-label", value);
  });

  document.querySelectorAll("[data-lang-switch]").forEach((btn) => {
    const isCurrent = btn.getAttribute("data-lang-switch") === lang;
    btn.setAttribute("aria-pressed", isCurrent ? "true" : "false");
  });

  document.dispatchEvent(new CustomEvent("it-lang", { detail: { lang } }));
}

export function initI18n() {
  applyLang(getLang());

  document.querySelectorAll("[data-lang-switch]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setLang(btn.getAttribute("data-lang-switch"));
    });
  });

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY && (event.newValue === "en" || event.newValue === "es")) {
      applyLang(event.newValue);
    }
  });
}
