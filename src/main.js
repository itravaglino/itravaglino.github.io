import { initI18n } from "./i18n.js";
import { initTheme } from "./theme.js";
import { initMotion } from "./motion.js";

document.documentElement.classList.add("js");
initI18n();
initTheme();
initMotion();
