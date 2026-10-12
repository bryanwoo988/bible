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

export const DEFAULT_SETTINGS = {
  fontSize: 19, theme: "system", zh: "cuv", en: null,
  ttsContent: "both", ttsZhVoice: "", ttsEnVoice: "", ttsRate: 0.9,
};

export const state = {
  settings: { ...DEFAULT_SETTINGS, ...load("settings", {}) },
  tabs: load("tabs", null),
  activeTab: load("activeTab", 0),
  marks: load("marks", {}), // "b.c.v" -> { hl?: color, ul?: color }
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
    notes: state.notes,
    bookmarks: state.bookmarks,
    history: state.history,
    tabs: state.tabs,
    settings: state.settings,
  };
}

export function importBackup(data) {
  if (!data || data.app !== "bible-pwa") throw new Error(t("err.notBackup"));
  Object.assign(state.marks, data.marks || {});
  Object.assign(state.notes, data.notes || {});
  Object.assign(state.bookmarks, data.bookmarks || {});
  const seen = new Set(state.history.map((h) => h.t));
  state.history = [...state.history, ...(data.history || []).filter((h) => !seen.has(h.t))]
    .sort((a, b) => b.t - a.t)
    .slice(0, MAX_HISTORY);
  persist("marks", "notes", "bookmarks", "history");
}
