import { initI18n } from "./i18n.js";
import { initTheme } from "./theme.js";

document.documentElement.classList.add("js");
initI18n();
initTheme();

const printBtn = document.querySelector("[data-print]");
if (printBtn) {
  printBtn.addEventListener("click", () => window.print());
}
