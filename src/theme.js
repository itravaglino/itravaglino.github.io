const THEME_KEY = "it-theme";

function isDark() {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === "light") return false;
  return true;
}

function syncThemeButton() {
  const button = document.querySelector("[data-theme-toggle]");
  if (button) button.setAttribute("aria-pressed", isDark() ? "true" : "false");
  const meta = document.querySelector('meta[name="theme-color"]:not([media])');
  if (meta) meta.setAttribute("content", isDark() ? "#07080c" : "#f3f5f8");
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
