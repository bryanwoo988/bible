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

/* A backup is a file from outside the app, and its keys and colours end up
   inside HTML attributes (data-open, data-g, style). Only entries shaped
   exactly like the ones the app writes are taken; anything else is dropped,
   so a doctored file cannot run script on this origin, which every app on
   bryanwoo988.github.io shares. */
const KEY_RE = /^\d{1,2}\.\d{1,3}\.\d{1,3}$/;
const ID_RE = /^[a-z0-9]{1,32}$/;
const WORD_RE = /^[\w-]{1,40}$/;
const isNum = (n) => typeof n === "number" && Number.isFinite(n);
const isInt = (n) => Number.isInteger(n) && n >= 0;
const isWord = (s) => typeof s === "string" && WORD_RE.test(s);
const isObj = (o) => o && typeof o === "object" && !Array.isArray(o);

function pick(src, keyOk, clean) {
  const out = {};
  if (!isObj(src)) return out;
  for (const [k, v] of Object.entries(src)) {
    if (!keyOk(k)) continue;
    const c = clean(v);
    if (c !== undefined) out[k] = c;
  }
  return out;
}

const cleanNote = (n) => (isObj(n) && typeof n.text === "string" ? { text: n.text, t: isNum(n.t) ? n.t : 0 } : undefined);

function cleanMark(m) {
  if (!isObj(m)) return undefined;
  const out = {};
  if (isWord(m.hl)) out.hl = m.hl;
  if (isWord(m.ul)) out.ul = m.ul;
  if (!out.hl && !out.ul) return undefined;
  if (isNum(m.t)) out.t = m.t;
  return out;
}

function cleanRange(r) {
  if (!isObj(r) || !isInt(r.b) || !isInt(r.c) || !isInt(r.v) || !isInt(r.s) || !isInt(r.e)) return undefined;
  if ((r.lang !== "zh" && r.lang !== "en") || !isWord(r.ver) || typeof r.g !== "string" || !ID_RE.test(r.g)) return undefined;
  const out = { b: r.b, c: r.c, v: r.v, lang: r.lang, s: r.s, e: r.e, ver: r.ver, g: r.g,
    q: typeof r.q === "string" ? r.q : "", last: r.last === true, t: isNum(r.t) ? r.t : 0 };
  if (isWord(r.hl)) out.hl = r.hl;
  if (isWord(r.ul)) out.ul = r.ul;
  return out;
}

const validHistory = (h) => isObj(h) && isInt(h.b) && h.b < 66 && isInt(h.c) && isInt(h.v) && isNum(h.t);

export function importBackup(data) {
  if (!data || data.app !== "bible-pwa") throw new Error(t("err.notBackup"));
  const isKey = (k) => KEY_RE.test(k);
  const isId = (k) => ID_RE.test(k);
  Object.assign(state.marks, pick(data.marks, isKey, cleanMark));
  Object.assign(state.notes, pick(data.notes, isKey, cleanNote));
  Object.assign(state.ranges, pick(data.ranges, isId, cleanRange));
  Object.assign(state.rnotes, pick(data.rnotes, isId, cleanNote));
  Object.assign(state.bookmarks, pick(data.bookmarks, isKey, (v) => (isNum(v) ? v : undefined)));
  const seen = new Set(state.history.map((h) => h.t));
  const incoming = Array.isArray(data.history) ? data.history.filter(validHistory) : [];
  state.history = [...state.history, ...incoming.filter((h) => !seen.has(h.t)).map(({ b, c, v, t }) => ({ b, c, v, t }))]
    .sort((a, b) => b.t - a.t)
    .slice(0, MAX_HISTORY);
  persist("marks", "ranges", "rnotes", "notes", "bookmarks", "history");
}
