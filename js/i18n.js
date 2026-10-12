// Interface language: 简体中文 (zhs), 繁體中文 (zht) or English (en).
import zhs from "./strings/zhs.js";
import zht from "./strings/zht.js";
import en from "./strings/en.js";
import { INTRO as INTRO_ZHS } from "./intro.js";
import { INTRO as INTRO_ZHT } from "./intro-zht.js";

const STRINGS = { zhs, zht, en };
export const UI_LANGS = [
  ["zhs", "简体中文"],
  ["zht", "繁體中文"],
  ["en", "English"],
];
const HTML_LANG = { zhs: "zh-Hans", zht: "zh-Hant", en: "en" };
export const LOCALE = { zhs: "zh-CN", zht: "zh-TW", en: "en-US" };

let current = "zhs";

export function setUiLang(lang) {
  current = STRINGS[lang] ? lang : "zhs";
  document.documentElement.lang = HTML_LANG[current];
}

export const uiLang = () => current;
export const isEn = () => current === "en";
export const intros = () => (current === "zht" ? INTRO_ZHT : INTRO_ZHS);

/** Translate a key, filling {placeholders} from vars. */
export function t(key, vars) {
  let s = STRINGS[current][key] ?? zhs[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));
  return s;
}

/** Fill static markup: data-i18n (text), data-i18n-aria (aria-label + title). */
export function applyI18n(root = document) {
  for (const el of root.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll("[data-i18n-aria]")) {
    const label = t(el.dataset.i18nAria);
    el.setAttribute("aria-label", label);
    if (el.hasAttribute("title")) el.title = label;
  }
}
