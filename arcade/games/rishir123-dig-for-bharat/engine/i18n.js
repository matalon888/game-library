/* ============================================================
   Language.

   Every word a player reads lives in lang/<code>.json, not in the
   code. Strings are whole sentences with named slots — never built
   by adding fragments together, because word order is not the same
   in Hindi or Tamil as it is in English, and "anomal" + "ies" is
   only a word in one language.
   ============================================================ */

export const LANGUAGES = [
  { code: "en", name: "English",  native: "English", font: "Baloo 2",         status: "complete" },
  { code: "hi", name: "Hindi",    native: "हिन्दी",   font: "Baloo 2",         status: "draft" },
  { code: "bn", name: "Bengali",  native: "বাংলা",    font: "Baloo Da 2",      status: "draft" },
  { code: "te", name: "Telugu",   native: "తెలుగు",   font: "Baloo Tammudu 2", status: "draft" },
  { code: "mr", name: "Marathi",  native: "मराठी",    font: "Baloo 2",         status: "draft" },
  { code: "ta", name: "Tamil",    native: "தமிழ்",    font: "Baloo Thambi 2",  status: "draft" }
];

const FONT_URL = {
  "Baloo 2":         "Baloo+2:wght@400;600;800",
  "Baloo Da 2":      "Baloo+Da+2:wght@400;600;800",
  "Baloo Tammudu 2": "Baloo+Tammudu+2:wght@400;600;800",
  "Baloo Thambi 2":  "Baloo+Thambi+2:wght@400;600;800"
};

let strings = {};      // the chosen language
let english = {};      // always loaded, used when a key is missing
let current = "en";
const listeners = new Set();

export const langInfo = (code) => LANGUAGES.find((l) => l.code === code) || LANGUAGES[0];
export const currentLang = () => current;
export const onLanguageChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

async function fetchLang(code) {
  const res = await fetch("lang/" + code + ".json");
  if (!res.ok) throw new Error("missing language file: " + code);
  return res.json();
}

export async function initI18n(code) {
  english = await fetchLang("en");
  await setLanguage(code || "en", true);
}

export async function setLanguage(code, quiet) {
  const info = langInfo(code);
  strings = info.code === "en" ? english : await fetchLang(info.code);
  current = info.code;
  applyFont(info.font);
  document.documentElement.lang = info.code;
  document.documentElement.dataset.script = info.font.replace(/\s+/g, "-").toLowerCase();
  if (!quiet) for (const fn of listeners) fn(info);
  return info;
}

/* one stylesheet link, swapped when the language changes */
function applyFont(family) {
  const spec = FONT_URL[family] || FONT_URL["Baloo 2"];
  let link = document.getElementById("langFont");
  if (!link) {
    link = document.createElement("link");
    link.id = "langFont";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  const href = "https://fonts.googleapis.com/css2?family=" + spec + "&display=swap";
  if (link.href !== href) link.href = href;
  document.documentElement.style.setProperty("--f-ui", '"' + family + '", "Baloo 2", system-ui, sans-serif');
}

/* t("toast.lifted", { name: "…", era: "…" })
   Slots are named, so a translator can move them anywhere in the
   sentence. A missing key falls back to English, then to the key
   itself, so nothing ever renders as blank. */
export function t(key, params) {
  let s = strings[key];
  if (s === undefined) s = english[key];
  if (s === undefined) return key;
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, name) =>
    (params[name] === undefined ? m : String(params[name])));
}

/* for counted things: t2("survey.found", n, {…}) picks .one or .many */
export function tn(key, n, params) {
  const p = Object.assign({ n }, params);
  return t(key + (n === 1 ? ".one" : ".many"), p);
}

/* Fills every element carrying data-i18n. Attributes can be localised too:
   data-i18n-title="key" sets the tooltip. */
export function applyStatic(root) {
  const r = root || document;
  r.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  r.querySelectorAll("[data-i18n-title]").forEach((el) => { el.title = t(el.dataset.i18nTitle); });
}

export function hasKey(key) { return strings[key] !== undefined || english[key] !== undefined; }
export function allKeys() { return Object.keys(english); }
