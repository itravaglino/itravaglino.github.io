const THEME_KEY = "it-theme";

function prefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function isDark() {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === "dark" || explicit === "light") return explicit === "dark";
  return prefersDark();
}

function syncThemeButton() {
  const button = document.querySelector("[data-theme-toggle]");
  if (!button) return;
  button.setAttribute("aria-pressed", isDark() ? "true" : "false");
}

export function initTheme() {
  const button = document.querySelector("[data-theme-toggle]");
  if (button) {
    button.addEventListener("click", () => {
      const next = isDark() ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        /* private mode */
      }
      syncThemeButton();
    });
  }

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (!document.documentElement.dataset.theme) syncThemeButton();
  };
  if (typeof media.addEventListener === "function") media.addEventListener("change", onChange);
  syncThemeButton();
}
