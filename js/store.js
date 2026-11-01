// Persistent state: small things in localStorage, imported Bible versions in IndexedDB.
import { t } from "./i18n.js";

const PREFIX = "bible.";

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.warn("save failed", key, e);
  }
}

export const COLORS = ["yellow", "green", "blue", "pink", "orange"];

export const DEFAULT_SETTINGS = {
  fontSize: 19, theme: "system", lightTheme: "classic", darkTheme: "midnight", zh: "cuv", en: null,
  ttsContent: "both", ttsZhVoice: "", ttsEnVoice: "", ttsRate: 0.9, textMode: "both", listen: true,
};

export const state = {
  settings: { ...DEFAULT_SETTINGS, ...load("settings", {}) },
  tabs: load("tabs", null),
  activeTab: load("activeTab", 0),
  marks: load("marks", {}), // "b.c.v" -> { hl?: color, ul?: color } (whole verse)
  // Marks on part of a verse: id -> { b, c, v, lang: "zh"|"en", s, e (char offsets),
  // hl?, ul?, g (group: one selection may span verses), q (the marked text), last?, t }
  ranges: load("ranges", {}),
  rnotes: load("rnotes", {}), // group id -> { text, t } (note on a text selection)
  notes: load("notes", {}), // "b.c.v" -> { text, t }
  bookmarks: load("bookmarks", {}), // "b.c.v" -> t
  history: load("history", []), // [{ b, c, v, t }] newest first
};

const validTab = (t) => t && Number.isInteger(t.b) && t.b >= 0 && t.b < 66 && Number.isInteger(t.c) && t.c >= 1;
if (Array.isArray(state.tabs)) state.tabs = state.tabs.filter(validTab);
if (!Array.isArray(state.tabs) || !state.tabs.length) {
  state.tabs = [{ b: 42, c: 3, v: 1 }];
  state.activeTab = 0;
}
state.activeTab = Math.min(Math.max(0, state.activeTab), state.tabs.length - 1);

export function persist(...keys) {
  for (const k of keys) save(k, state[k]);
}

export const vkey = (b, c, v) => `${b}.${c}.${v}`;
export const parseKey = (k) => {
  const [b, c, v] = k.split(".").map(Number);
  return { b, c, v };
};

/* ---------- History ---------- */
const MERGE_MS = 30 * 60 * 1000;
const MAX_HISTORY = 1000;

export function recordHistory(b, c, v) {
  const now = Date.now();
  const last = state.history[0];
  if (last && last.b === b && last.c === c && now - last.t < MERGE_MS) {
    last.v = v;
    last.t = now;
  } else {
    state.history.unshift({ b, c, v, t: now });
    if (state.history.length > MAX_HISTORY) state.history.length = MAX_HISTORY;
  }
  persist("history");
}

/* ---------- IndexedDB for imported versions ---------- */
let dbPromise;
function db() {
  dbPromise ||= new Promise((resolve, reject) => {
    const req = indexedDB.open("bible", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("versions", { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode, fn) {
  return db().then(
    (d) =>
      new Promise((resolve, reject) => {
        const txn = d.transaction("versions", mode);
        const req = fn(txn.objectStore("versions"));
        txn.oncomplete = () => resolve(req && req.result);
        txn.onerror = () => reject(txn.error);
      }),
  );
}

export const idb = {
  put: (v) => tx("readwrite", (s) => s.put(v)),
  get: (id) => tx("readonly", (s) => s.get(id)),
  del: (id) => tx("readwrite", (s) => s.delete(id)),
  list: () => tx("readonly", (s) => s.getAll()),
};

/* ---------- Backup ---------- */
export function exportBackup() {
  return {
    app: "bible-pwa",
    version: 1,
    exported: new Date().toISOString(),
    marks: state.marks,
    ranges: state.ranges,
    rnotes: state.rnotes,
    notes: state.notes,
    bookmarks: state.bookmarks,
    history: state.history,
    tabs: state.tabs,
    settings: state.settings,
  };
}

/* A backup file is only trusted as far as these checks go: its values end up in
   the page's HTML, and a bad book number would break the lists. */
const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);
const nat = (n, max = Infinity) => Number.isInteger(n) && n >= 1 && n <= max;
const okPlace = (b, c, v) => Number.isInteger(b) && b >= 0 && b < 66 && nat(c, 150) && nat(v, 200);
const okKey = (k) => /^\d+\.\d+\.\d+$/.test(k) && okPlace(...k.split(".").map(Number));
const okId = (id) => typeof id === "string" && /^[\w-]{1,40}$/.test(id);
const okColor = (c) => c === undefined || COLORS.includes(c);
const okTime = (n) => Number.isFinite(n) && n >= 0;
const okNote = (n) => isObj(n) && typeof n.text === "string" && okTime(n.t);
const okMark = (m) => isObj(m) && okColor(m.hl) && okColor(m.ul) && (m.hl || m.ul) && (m.t === undefined || okTime(m.t));
const okRange = (r) => isObj(r) && okPlace(r.b, r.c, r.v) && (r.lang === "zh" || r.lang === "en") &&
  Number.isInteger(r.s) && Number.isInteger(r.e) && r.s >= 0 && r.s < r.e && typeof r.q === "string" &&
  okId(r.ver) && okId(r.g) && okColor(r.hl) && okColor(r.ul) && okTime(r.t);

/** The entries of obj whose key and value pass the checks. */
function valid(obj, okK, okV) {
  if (!isObj(obj)) return {};
  return Object.fromEntries(Object.entries(obj).filter(([k, v]) => okK(k) && okV(v)));
}

export function importBackup(data) {
  if (!data || data.app !== "bible-pwa") throw new Error(t("err.notBackup"));
  Object.assign(state.marks, valid(data.marks, okKey, okMark));
  Object.assign(state.notes, valid(data.notes, okKey, okNote));
  Object.assign(state.ranges, valid(data.ranges, okId, okRange));
  Object.assign(state.rnotes, valid(data.rnotes, okId, okNote));
  Object.assign(state.bookmarks, valid(data.bookmarks, okKey, okTime));
  const seen = new Set(state.history.map((h) => h.t));
  const history = Array.isArray(data.history) ? data.history.filter((h) => isObj(h) && okPlace(h.b, h.c, h.v) && okTime(h.t)) : [];
  state.history = [...state.history, ...history.filter((h) => !seen.has(h.t))]
    .sort((a, b) => b.t - a.t)
    .slice(0, MAX_HISTORY);
  persist("marks", "ranges", "rnotes", "notes", "bookmarks", "history");
}
