import { initI18n } from "./i18n.js";

document.documentElement.classList.add("js");
initI18n();

const printBtn = document.querySelector("[data-print]");
if (printBtn) {
  printBtn.addEventListener("click", () => window.print());
}
