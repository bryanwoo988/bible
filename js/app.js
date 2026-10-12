import { BOOKS, parseRef, toTrad } from "./books.js";
import { t, applyI18n, setUiLang, uiLang, isEn, intros, UI_LANGS, LOCALE } from "./i18n.js";
import { state, persist, vkey, parseKey, recordHistory, exportBackup, importBackup } from "./store.js";
import {
  BUILTIN, allVersions, hasVersion, versionMeta, getChapter, loadImported,
  prefetchVersion, importVersion, removeVersion, guessMeta,
} from "./versions.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const COLORS = ["yellow", "green", "blue", "pink", "orange"];
const ICON = {
  note: '<svg viewBox="0 0 24 24"><path d="M4 20h4l10-10-4-4L4 16z"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
};

const trad = () => uiLang() === "zht" || (uiLang() === "zhs" && state.settings.zh === "cuvt");
const zhBookName = (b) => (trad() || state.settings.zh === "cuvt" ? BOOKS[b].zht : BOOKS[b].zh);
// Book name in the interface language; the "other" name is shown as a subtitle.
const bookName = (b) => (isEn() ? BOOKS[b].en : zhBookName(b));
const otherBookName = (b) => (isEn() ? zhBookName(b) : BOOKS[b].en);
const refText = (b, c, v) => `${bookName(b)} ${c}${v ? ":" + v : ""}`;
const otherRef = (b, c, v) => `${otherBookName(b)} ${c}${v ? ":" + v : ""}`;
const shortRef = (b, c, v) => {
  const abbr = isEn() ? BOOKS[b].enAbbr + " " : trad() ? toTrad(BOOKS[b].abbr) : BOOKS[b].abbr;
  return `${abbr}${c}${v ? ":" + v : ""}`;
};
const sampleZh = () => (trad() ? "神愛世人，甚至將他的獨生子賜給他們。" : "神爱世人，甚至将他的独生子赐给他们。");
const SAMPLE_EN = "For God so loved the world that he gave his one and only Son.";
const chapterTitle = (b, c) => t(b === 18 ? "psalmTitle" : "chapterTitle", { book: zhBookName(b), c });

/* ============================================================
   Reader
   ============================================================ */

const reader = $("#reader");
const chapterEl = $("#chapter");
let rendered = null; // { b, c }
let selection = new Set(); // verse numbers
let markMode = "hl";
let markColor = "yellow";
let suppressScrollSave = false;

const activeTab = () => state.tabs[state.activeTab];

function englishVersion() {
  const id = state.settings.en;
  if (id && hasVersion(id)) return id;
  const first = allVersions().find((v) => v.lang === "en");
  return first ? first.id : null;
}

async function render({ scrollTo, flash } = {}) {
  const tab = activeTab();
  const { b, c } = tab;
  const book = BOOKS[b];
  $("#ref-label").textContent = `${bookName(b)} ${c}`;
  updateVersionLabels();
  document.title = `${bookName(b)} ${c} · ${t("app.title")}`;
  $("#btn-prev").disabled = b === 0 && c === 1;
  $("#btn-next").disabled = b === 65 && c === book.chapters;
  renderTabs();
  clearSelection();
  hideQuick();

  const enId = englishVersion();
  renderBanner(enId);
  if (!rendered || rendered.b !== b || rendered.c !== c) chapterEl.innerHTML = `<div class="loading">${t("loading")}</div>`;

  let zh, en;
  try {
    [zh, en] = await Promise.all([
      getChapter(state.settings.zh, b, c),
      enId ? getChapter(enId, b, c).catch(() => null) : null,
    ]);
  } catch (e) {
    chapterEl.innerHTML = `<div class="empty-state">${t("loadError")}<br><button class="btn" id="retry">${t("retry")}</button></div>`;
    $("#retry").onclick = () => render({ scrollTo, flash });
    return;
  }
  // Another navigation may have happened while loading.
  if (activeTab() !== tab || tab.b !== b || tab.c !== c) return;

  const count = Math.max(zh?.length || 0, en?.length || 0);
  const zhTitle = `<div class="zh">${esc(chapterTitle(b, c))}</div>`;
  const enTitle = `<div class="en">${esc(book.en)} ${c}</div>`;
  const html = [`<header class="chapter-title${isEn() ? " en-first" : ""}">${isEn() ? enTitle + zhTitle : zhTitle + enTitle}</header>`];
  for (let v = 1; v <= count; v++) html.push(verseHTML(b, c, v, zh?.[v - 1], en ? en[v - 1] : undefined));
  html.push(`<div class="chapter-end">
    ${b || c > 1 ? `<button data-go="prev">${t("prevChapter")}</button>` : ""}
    ${b < 65 || c < book.chapters ? `<button data-go="next">${t("nextChapter")}</button>` : ""}
  </div>`);
  chapterEl.innerHTML = html.join("");
  rendered = { b, c };

  suppressScrollSave = true;
  const target = scrollTo ?? tab.v ?? 1;
  const el = target > 1 ? chapterEl.querySelector(`.v[data-v="${target}"]`) : null;
  if (el) el.scrollIntoView({ block: "start" });
  else window.scrollTo(0, 0);
  if (flash && el) el.classList.add("flash");
  requestAnimationFrame(() => (suppressScrollSave = false));
  recordHistory(b, c, target || 1);
}

function verseHTML(b, c, v, zh, en) {
  const k = vkey(b, c, v);
  const mark = state.marks[k] || {};
  const note = state.notes[k];
  const attrs = [mark.hl ? `data-hl="${mark.hl}"` : "", mark.ul ? `data-ul="${mark.ul}"` : ""].join(" ");
  const zhHtml = zh
    ? `<span class="t">${markedHTML(b, c, v, "zh", zh)}</span>`
    : zh === "" ? `<span class="empty">${t("merged")}</span>` : "";
  const enHtml = en === undefined ? "" : en
    ? `<span class="t">${markedHTML(b, c, v, "en", en)}</span>`
    : `<span class="empty">${en === "" ? "(Not in the earliest manuscripts)" : ""}</span>`;
  // The note badge sits on both lines; CSS shows it on the visible one.
  const badge = note ? `<span class="badges"><button class="badge" data-note="${v}" aria-label="${t("act.note")}">${ICON.note}</button></span>` : "";
  return `<div class="v" data-v="${v}" ${attrs}>
    ${state.bookmarks[k] ? `<span class="bm-ribbon" aria-label="${t("act.bookmark")}"></span>` : ""}
    <span class="vn">${v}</span>
    <p class="zh">${zhHtml}${badge}</p>
    ${enHtml ? `<p class="en">${enHtml}${badge}</p>` : ""}
    ${note ? `<div class="note-preview" data-note="${v}">${esc(note.text)}</div>` : ""}
  </div>`;
}

/* ---------- Marks on part of a verse ---------- */

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
// Offsets are only valid for the text they were made on; 简体/繁體 和合本 line up.
const verFamily = (lang) => {
  const id = lang === "zh" ? state.settings.zh : englishVersion();
  return id === "cuvt" ? "cuv" : id;
};

/** Verse text as HTML with highlight/underline/note spans for any partial marks. */
function markedHTML(b, c, v, lang, text) {
  const fam = verFamily(lang);
  const list = Object.values(state.ranges)
    .filter((r) => r.b === b && r.c === c && r.v === v && r.lang === lang && r.ver === fam && r.s < r.e && r.e <= text.length)
    .sort((a, z) => a.t - z.t);
  if (!list.length) return esc(text);
  const cuts = [...new Set([0, text.length, ...list.flatMap((r) => [r.s, r.e])])].sort((a, z) => a - z);
  let out = "";
  for (let i = 0; i < cuts.length - 1; i++) {
    const from = cuts[i], to = cuts[i + 1];
    const piece = esc(text.slice(from, to));
    const on = list.filter((r) => r.s <= from && r.e >= to);
    if (!on.length) out += piece;
    else {
      const hl = on.findLast((r) => r.hl)?.hl;
      const ul = on.findLast((r) => r.ul)?.ul;
      const noted = on.some((r) => state.rnotes[r.g]);
      out += `<span class="r"${hl ? ` data-rh="${hl}"` : ""}${ul ? ` data-ru="${ul}"` : ""}${noted ? " data-rn" : ""}>${piece}</span>`;
    }
    for (const r of list) {
      if (r.e === to && r.last && state.rnotes[r.g]) out += `<button class="rnote" data-rnote="${r.g}" aria-label="${t("act.note")}">${ICON.note}</button>`;
    }
  }
  return out;
}

/** Pieces of the reader's current text selection, one per verse line. */
function selectionPieces() {
  const sel = getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return [];
  const range = sel.getRangeAt(0);
  if (!chapterEl.contains(range.commonAncestorContainer)) return [];
  const offsetIn = (root, node, off) => {
    const r = document.createRange();
    r.setStart(root, 0);
    r.setEnd(node, off);
    return r.toString().length;
  };
  const { b, c } = activeTab();
  const pieces = [];
  for (const tEl of chapterEl.querySelectorAll(".v .t")) {
    if (!range.intersectsNode(tEl) || !tEl.offsetParent) continue;
    const len = tEl.textContent.length;
    const s = tEl.contains(range.startContainer) ? offsetIn(tEl, range.startContainer, range.startOffset) : 0;
    const e = tEl.contains(range.endContainer) ? offsetIn(tEl, range.endContainer, range.endOffset) : len;
    const q = tEl.textContent.slice(s, e);
    if (e > s && q.trim()) pieces.push({ b, c, v: Number(tEl.closest(".v").dataset.v), lang: tEl.closest(".zh") ? "zh" : "en", s, e, q });
  }
  return pieces;
}

const groupPieces = (g) =>
  Object.entries(state.ranges)
    .filter(([, r]) => r.g === g)
    .map(([id, r]) => ({ id, ...r }))
    .sort((a, z) => a.b - z.b || a.c - z.c || a.v - z.v || (a.lang === z.lang ? 0 : a.lang === "zh" ? -1 : 1) || a.s - z.s);
const groupQuote = (g) => groupPieces(g).map((p) => p.q).join(" … ");

function addPieces(pieces, props) {
  const g = newId();
  const now = Date.now();
  pieces.forEach((p, i) => {
    state.ranges[newId()] = { ...p, ver: verFamily(p.lang), ...props, g, last: i === pieces.length - 1, t: now + i };
  });
  return g;
}

/** Re-render the verses of the current chapter that these pieces touch. */
function refreshPieces(pieces) {
  const { b, c } = activeTab();
  [...new Set(pieces.filter((p) => p.b === b && p.c === c).map((p) => p.v))].forEach(rerenderVerse);
}

function renderBanner(enId) {
  const el = $("#banner");
  if (enId || localStorage.getItem("bible.hideEnBanner")) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = `<div class="banner"><span>${t("banner.noEnglish")}</span><button id="banner-import">${t("import")}</button></div>`;
  $("#banner-import").onclick = () => openSettings(true);
}

function rerenderVerse(v) {
  const { b, c } = activeTab();
  const old = chapterEl.querySelector(`.v[data-v="${v}"]`);
  if (!old) return;
  const zh = old.querySelector(".zh .t, .zh .empty");
  const en = old.querySelector(".en .t, .en .empty");
  const zhText = zh?.classList.contains("t") ? zh.textContent : zh ? "" : undefined;
  const enText = en ? (en.classList.contains("t") ? en.textContent : "") : undefined;
  const tmp = document.createElement("div");
  tmp.innerHTML = verseHTML(b, c, v, zhText, enText);
  const fresh = tmp.firstElementChild;
  if (selection.has(v)) fresh.classList.add("sel");
  old.replaceWith(fresh);
}

/* ---------- Navigation ---------- */

function go(b, c, v = null, { flash = false, newTab = false, fromTts = false } = {}) {
  if (!fromTts) ttsStop();
  if (newTab) {
    state.tabs.push({ b, c, v: v || 1 });
    state.activeTab = state.tabs.length - 1;
  } else {
    Object.assign(activeTab(), { b, c, v: v || 1 });
  }
  persist("tabs", "activeTab");
  return render({ scrollTo: v || 1, flash: flash && !!v });
}

function step(dir) {
  let { b, c } = activeTab();
  c += dir;
  if (c < 1) {
    if (b === 0) return;
    b -= 1;
    c = BOOKS[b].chapters;
  } else if (c > BOOKS[b].chapters) {
    if (b === 65) return;
    b += 1;
    c = 1;
  }
  go(b, c);
}

$("#btn-prev").onclick = () => step(-1);
$("#btn-next").onclick = () => step(1);
chapterEl.addEventListener("click", (e) => {
  const goBtn = e.target.closest("[data-go]");
  if (goBtn) return step(goBtn.dataset.go === "next" ? 1 : -1);
  const rnote = e.target.closest("[data-rnote]");
  if (rnote) return openRangeNote({ g: rnote.dataset.rnote });
  const noteBtn = e.target.closest("[data-note]");
  if (noteBtn) return openNote(Number(noteBtn.dataset.note));
  const verse = e.target.closest(".v");
  if (!verse) return;
  // A tap while text is selected just dismisses the selection.
  if (textPieces.length || !getSelection().isCollapsed) {
    clearSelection();
    return;
  }
  const v = Number(verse.dataset.v);
  if (selection.size || !state.settings.listen) toggleSelect(v); // marking: tap adds/removes verses
  else if (tts.on) {
    // While listening, tapping a verse continues reading from there.
    ttsJump(0, v);
    if (!tts.playing) ttsResume();
  } else if (focusV === v) hideQuick();
  else showQuick(v);
});

/* ---------- Tap = listen (when read-aloud mode is on); long-press = select text ---------- */

const quickbar = $("#quickbar");
let focusV = null;

function showQuick(v) {
  hideQuick();
  focusV = v;
  chapterEl.querySelector(`.v[data-v="${v}"]`)?.classList.add("focus");
  $("#qb-label").textContent = t("qb.listen", { v });
  quickbar.hidden = false;
  document.body.classList.add("quick");
}

function hideQuick() {
  focusV = null;
  $$(".v.focus", chapterEl).forEach((el) => el.classList.remove("focus"));
  quickbar.hidden = true;
  document.body.classList.remove("quick");
}

$("#qb-play").onclick = () => {
  const v = focusV;
  hideQuick();
  ttsStart(v);
};
$("#qb-mark").onclick = () => {
  const v = focusV;
  hideQuick();
  toggleSelect(v);
};
$("#qb-close").onclick = hideQuick;

// Long-pressing text uses the phone's own text selection; we follow it here.
let textPieces = [];
let toolbarTouch = 0;
let selTimer;
document.addEventListener("selectionchange", () => {
  clearTimeout(selTimer);
  selTimer = setTimeout(() => {
    const pieces = selectionPieces();
    if (pieces.length) {
      textPieces = pieces;
      if (selection.size) {
        selection.clear();
        $$(".v.sel", chapterEl).forEach((el) => el.classList.remove("sel"));
      }
      hideQuick();
      updateActionbar();
    } else if (textPieces.length && Date.now() - toolbarTouch > 800) {
      // Tapping the toolbar can collapse the selection on phones; keep the pieces then.
      textPieces = [];
      updateActionbar();
    }
  }, 120);
});

// Swipe left/right to change chapter.
let touch = null;
reader.addEventListener("touchstart", (e) => {
  if (e.touches.length !== 1) return (touch = null);
  touch = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
}, { passive: true });
reader.addEventListener("touchend", (e) => {
  if (!touch || selection.size || !getSelection().isCollapsed) return;
  const dx = e.changedTouches[0].clientX - touch.x;
  const dy = e.changedTouches[0].clientY - touch.y;
  const fast = Date.now() - touch.t < 600;
  touch = null;
  if (fast && Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 2) step(dx < 0 ? 1 : -1);
}, { passive: true });

document.addEventListener("keydown", (e) => {
  if (e.target.closest("input, textarea, select") || !$("#sheet").hidden || !page.hidden) return;
  if (e.key === "ArrowLeft") step(-1);
  if (e.key === "ArrowRight") step(1);
});

// Remember the top visible verse for the current tab and the reading history.
let scrollTimer;
window.addEventListener("scroll", () => {
  if (suppressScrollSave) return;
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    const v = topVisibleVerse();
    const tab = activeTab();
    if (!v || !rendered || rendered.b !== tab.b || rendered.c !== tab.c) return;
    tab.v = v;
    persist("tabs");
    recordHistory(tab.b, tab.c, v);
  }, 400);
}, { passive: true });

function firstFullyVisibleVerse() {
  const top = $(".tabstrip").getBoundingClientRect().bottom - 8;
  for (const el of chapterEl.querySelectorAll(".v")) {
    if (el.getBoundingClientRect().top >= top) return Number(el.dataset.v);
  }
  return topVisibleVerse();
}

function topVisibleVerse() {
  const top = $(".tabstrip").getBoundingClientRect().bottom + 4;
  for (const el of chapterEl.querySelectorAll(".v")) {
    if (el.getBoundingClientRect().bottom > top) return Number(el.dataset.v);
  }
  return null;
}

/* ============================================================
   Tabs (multiple passages open at once)
   ============================================================ */

function renderTabs() {
  const strip = $("#tabstrip");
  strip.innerHTML = state.tabs
    .map((tab, i) => `<button class="tab${i === state.activeTab ? " active" : ""}" data-tab="${i}">
        <span class="tab-label">${esc(refText(tab.b, tab.c, i === state.activeTab ? null : tab.v > 1 ? tab.v : null))}</span>
        ${state.tabs.length > 1 ? `<span class="x" data-close="${i}" role="button" aria-label="${t("tab.close")}">${ICON.x}</span>` : ""}
      </button>`)
    .join("") + `<button class="tab-add" id="tab-add">${ICON.plus}${t("tab.new")}</button>`;
  const active = strip.querySelector(".tab.active");
  active?.scrollIntoView({ inline: "nearest", block: "nearest" });
}

/* ---------- Reorder tabs by dragging (long-press on touch screens) ---------- */

const strip = $("#tabstrip");
const GAP = 6;
let drag = null;
let justDragged = false;

strip.addEventListener("pointerdown", (e) => {
  const el = e.target.closest(".tab");
  if (!el || e.target.closest("[data-close]") || e.button > 0 || state.tabs.length < 2) return;
  drag = { el, from: Number(el.dataset.tab), to: Number(el.dataset.tab), x0: e.clientX, y0: e.clientY, id: e.pointerId, active: false, mouse: e.pointerType === "mouse" };
  if (!drag.mouse) drag.timer = setTimeout(startDrag, 350);
});

function startDrag() {
  if (!drag) return;
  drag.active = true;
  drag.tabs = $$(".tab", strip);
  drag.rects = drag.tabs.map((t) => t.getBoundingClientRect());
  drag.el.classList.add("dragging");
  strip.classList.add("sorting");
  try { drag.el.setPointerCapture(drag.id); } catch {}
  navigator.vibrate?.(15);
}

strip.addEventListener("pointermove", (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x0;
  if (!drag.active) {
    const moved = Math.hypot(dx, e.clientY - drag.y0) > 8;
    if (moved && drag.mouse) startDrag();
    else if (moved) cancelDrag(); // a swipe: let the strip scroll
    if (!drag?.active) return;
  }
  drag.el.style.transform = `translateX(${dx}px) scale(1.06)`;
  // Where would the dragged tab land?
  const r = drag.rects[drag.from];
  const center = r.left + r.width / 2 + dx;
  let to = drag.from;
  drag.rects.forEach((rr, k) => {
    const mid = rr.left + rr.width / 2;
    if (k < drag.from && center < mid) to = Math.min(to, k);
    if (k > drag.from && center > mid) to = Math.max(to, k);
  });
  drag.to = to;
  const shift = r.width + GAP;
  drag.tabs.forEach((t, k) => {
    if (k === drag.from) return;
    const off = drag.from < k && k <= to ? -shift : to <= k && k < drag.from ? shift : 0;
    t.style.transform = off ? `translateX(${off}px)` : "";
  });
  // Scroll the strip when dragging near its edges.
  const sr = strip.getBoundingClientRect();
  if (e.clientX < sr.left + 30) strip.scrollLeft -= 8;
  else if (e.clientX > sr.right - 30) strip.scrollLeft += 8;
});

// Stop the page/strip from scrolling while a tab is being dragged.
strip.addEventListener("touchmove", (e) => { if (drag?.active) e.preventDefault(); }, { passive: false });
strip.addEventListener("contextmenu", (e) => { if (e.target.closest(".tab")) e.preventDefault(); });

function cancelDrag() {
  if (!drag) return;
  clearTimeout(drag.timer);
  drag.tabs?.forEach((t) => (t.style.transform = ""));
  drag.el.classList.remove("dragging");
  strip.classList.remove("sorting");
  drag = null;
}

function endDrag(e) {
  if (!drag || (e && e.pointerId !== drag.id)) return;
  const { active, from, to } = drag;
  cancelDrag();
  if (!active) return;
  justDragged = true;
  setTimeout(() => (justDragged = false), 50);
  if (from === to) return;
  const current = activeTab();
  const [moved] = state.tabs.splice(from, 1);
  state.tabs.splice(to, 0, moved);
  state.activeTab = state.tabs.indexOf(current);
  persist("tabs", "activeTab");
  renderTabs();
}
strip.addEventListener("pointerup", endDrag);
strip.addEventListener("pointercancel", () => cancelDrag());

$("#tabstrip").addEventListener("click", (e) => {
  if (justDragged) return;
  const close = e.target.closest("[data-close]");
  if (close) {
    const i = Number(close.dataset.close);
    const tab = state.tabs[i];
    if (!confirm(t("confirm.closeTab", { ref: refText(tab.b, tab.c, tab.v > 1 ? tab.v : null) }))) return;
    state.tabs.splice(i, 1);
    if (state.activeTab >= i && state.activeTab > 0) state.activeTab--;
    persist("tabs", "activeTab");
    return render();
  }
  if (e.target.closest("#tab-add")) return openBooks({ newTab: true });
  const tab = e.target.closest("[data-tab]");
  if (!tab) return;
  const i = Number(tab.dataset.tab);
  if (i === state.activeTab) return openBooks({ newTab: false });
  ttsStop();
  state.activeTab = i;
  persist("activeTab");
  render();
});

/* ============================================================
   Verse selection, highlight, underline, bookmark, copy
   ============================================================ */

const actionbar = $("#actionbar");
const renderColors = () =>
  ($("#colors").innerHTML = COLORS.map((c) => `<button data-c="${c}" aria-label="${t("color." + c)}"></button>`).join(""));
renderColors();

function toggleSelect(v) {
  if (selection.has(v)) selection.delete(v);
  else selection.add(v);
  chapterEl.querySelector(`.v[data-v="${v}"]`)?.classList.toggle("sel", selection.has(v));
  updateActionbar();
}

function clearSelection() {
  selection.clear();
  $$(".v.sel", chapterEl).forEach((el) => el.classList.remove("sel"));
  if (textPieces.length) {
    textPieces = [];
    const sel = getSelection();
    if (sel && !sel.isCollapsed && chapterEl.contains(sel.anchorNode)) sel.removeAllRanges();
  }
  updateActionbar();
}

/** Verses the action bar acts on: selected verses, or those touched by selected text. */
function selectedVerses() {
  const vs = textPieces.length ? textPieces.map((p) => p.v) : [...selection];
  return [...new Set(vs)].sort((a, z) => a - z);
}

function selectedKeys() {
  const { b, c } = activeTab();
  return selectedVerses().map((v) => vkey(b, c, v));
}

function updateActionbar() {
  const on = selection.size > 0 || textPieces.length > 0;
  actionbar.hidden = !on;
  document.body.classList.toggle("selecting", on);
  if (!on) return;
  const keys = selectedKeys();
  const allBookmarked = keys.every((k) => state.bookmarks[k]);
  const bm = $('[data-act="bookmark"]', actionbar);
  bm.classList.toggle("on", allBookmarked);
  bm.querySelector("[data-bm-label]").textContent = t(allBookmarked ? "act.unbookmark" : "act.bookmark");
  const current = !textPieces.length && keys.length === 1 ? state.marks[keys[0]]?.[markMode] : null;
  $$("#colors button").forEach((btn) => btn.classList.toggle("on", btn.dataset.c === current));
}

$("#mark-mode").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-mode]");
  if (!btn) return;
  markMode = btn.dataset.mode;
  $$("#mark-mode button").forEach((b) => b.classList.toggle("on", b === btn));
  updateActionbar();
});

$("#colors").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-c]");
  if (!btn) return;
  markColor = btn.dataset.c;
  if (textPieces.length) return markText(markMode, markColor);
  const keys = selectedKeys();
  // Tapping the color a single verse already has removes it.
  const remove = keys.every((k) => state.marks[k]?.[markMode] === markColor);
  for (const k of keys) {
    const m = { ...(state.marks[k] || {}) };
    if (remove) delete m[markMode];
    else m[markMode] = markColor;
    if (m.hl || m.ul) state.marks[k] = { ...m, t: Date.now() };
    else delete state.marks[k];
  }
  persist("marks");
  [...selection].forEach(rerenderVerse);
  clearSelection();
});

// Keep the text selection alive while the toolbar is being used.
actionbar.addEventListener("pointerdown", () => (toolbarTouch = Date.now()));
actionbar.addEventListener("mousedown", (e) => e.preventDefault());

function markText(mode, color) {
  const pieces = textPieces;
  const same = (r, p) => r.b === p.b && r.c === p.c && r.v === p.v && r.lang === p.lang && r.s === p.s && r.e === p.e;
  const matches = pieces.map((p) => Object.entries(state.ranges).find(([, r]) => same(r, p) && r[mode] === color));
  if (matches.every(Boolean)) {
    // The exact same text already has this colour: tapping again removes it.
    for (const [id, r] of matches) {
      delete r[mode];
      if (!r.hl && !r.ul && !state.rnotes[r.g]) delete state.ranges[id];
    }
  } else addPieces(pieces, { [mode]: color });
  persist("ranges");
  clearSelection();
  refreshPieces(pieces);
}

function clearText() {
  const pieces = textPieces;
  for (const [id, r] of Object.entries(state.ranges)) {
    const hit = pieces.some((p) => r.b === p.b && r.c === p.c && r.v === p.v && r.lang === p.lang && r.s < p.e && r.e > p.s);
    if (!hit) continue;
    delete r.hl;
    delete r.ul;
    if (!state.rnotes[r.g]) delete state.ranges[id];
  }
  persist("ranges");
  clearSelection();
  refreshPieces(pieces);
}

actionbar.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const keys = selectedKeys();
  const verses = selectedVerses();
  const pieces = textPieces;
  switch (btn.dataset.act) {
    case "note":
      if (pieces.length) openRangeNote({ pieces });
      else openNote(verses[0]);
      break;
    case "bookmark": {
      const add = !keys.every((k) => state.bookmarks[k]);
      for (const k of keys) add ? (state.bookmarks[k] = Date.now()) : delete state.bookmarks[k];
      persist("bookmarks");
      verses.forEach(rerenderVerse);
      toast(t(add ? "toast.bookmarked" : "toast.unbookmarked"));
      clearSelection();
      break;
    }
    case "read":
      clearSelection();
      ttsStart(verses[0]);
      break;
    case "copy": {
      const text = pieces.length ? copySelection(pieces) : copyText(verses);
      try {
        await navigator.clipboard.writeText(text);
        toast(t("toast.copied"));
      } catch {
        toast(t("toast.copyFailed"));
      }
      clearSelection();
      break;
    }
    case "clear":
      if (pieces.length) {
        clearText();
        break;
      }
      for (const k of keys) delete state.marks[k];
      persist("marks");
      verses.forEach(rerenderVerse);
      clearSelection();
      break;
    case "done":
      clearSelection();
  }
});

function copySelection(pieces) {
  const { b, c } = activeTab();
  const vs = [...new Set(pieces.map((p) => p.v))];
  const range = vs.length === 1 ? `${vs[0]}` : `${vs[0]}-${vs[vs.length - 1]}`;
  return `${getSelection().toString().trim() || pieces.map((p) => p.q).join(" ")}\n— ${zhBookName(b)} ${c}:${range} / ${BOOKS[b].en} ${c}:${range}`;
}

function copyText(verses) {
  const { b, c } = activeTab();
  const lines = [];
  for (const v of verses) {
    const el = chapterEl.querySelector(`.v[data-v="${v}"]`);
    const mode = state.settings.textMode;
    const zh = mode === "en" ? "" : el?.querySelector(".zh .t")?.textContent || "";
    const en = mode === "zh" ? "" : el?.querySelector(".en .t")?.textContent || "";
    lines.push(`${v} ${[zh, en].filter(Boolean).join("\n")}`);
  }
  const first = verses[0], last = verses[verses.length - 1];
  const range = first === last ? `${first}` : `${first}-${last}`;
  const enName = versionMeta(englishVersion())?.short;
  return `${lines.join("\n")}\n— ${zhBookName(b)} ${c}:${range} / ${BOOKS[b].en} ${c}:${range}${enName ? ` (${enName})` : ""}`;
}

/* ============================================================
   Read aloud (speech synthesis)
   ============================================================ */

const synth = window.speechSynthesis;
const tts = { on: false, playing: false, v: 1, part: 0, token: 0, wake: null };
const RATES = [0.6, 0.75, 0.9, 1, 1.15, 1.3];
const PLAY_ICON = '<svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z"/></svg>';
const PAUSE_ICON = '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';

const NICE_VOICE = /Siri|Premium|Enhanced|Samantha|Tingting|Ting-Ting|Meijia|Mei-Jia|Sinji|Google|Microsoft/i;
// Sound-effect voices bundled with macOS/iOS that make no sense for Scripture.
const NOVELTY_VOICE = /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Junior|Ralph|Fred|Kathy)\b/i;
const MALE = /Li-?mu|Aasing|Yunxia|Yunhao|Yunze|Yunfeng|Zhiwei|WanLung|YunJhe|Eddy|Grandpa|Reed|Rocko|Daniel|Alex|Aaron|Arthur|Gordon|Rishi|Tom|Oliver|Evan|Nathan|Kangkang|Yunxi|Yunyang|Yunjian|Danny|David|Mark|Guy|Eric|Ryan|Liam|Fred|Male/i;
const FEMALE = /Yu-?shu|Lilian|HiuGaai|HiuMaan|HsiaoChen|HsiaoYu|Xiaoyi|Xiaohan|Xiaomo|Tingting|Ting-Ting|Meijia|Mei-Jia|Sinji|Lili|Shanshan|Flo|Grandma|Sandy|Shelley|Samantha|Karen|Moira|Tessa|Veena|Fiona|Victoria|Allison|Ava|Susan|Zoe|Nicky|Kate|Serena|Xiaoxiao|Huihui|Yaoyao|Hanhan|Tracy|Zira|Aria|Jenny|Female|Google 普通话|Google 國語|Google 粵語|Google US English/i;

function voiceGender(v) {
  if (MALE.test(v.name) && !/Female/i.test(v.name)) return t("voice.male");
  if (FEMALE.test(v.name)) return t("voice.female");
  return "";
}

function voiceRegion(v) {
  if (/^(zh[-_]HK|yue)/i.test(v.lang)) return t("voice.cantonese");
  if (/^zh[-_]TW/i.test(v.lang)) return t("voice.taiwan");
  if (/^(zh|cmn)/i.test(v.lang)) return t("voice.mandarin");
  if (/^en[-_]GB/i.test(v.lang)) return "UK";
  if (/^en[-_]AU/i.test(v.lang)) return "AU";
  if (/^en[-_]US/i.test(v.lang)) return "US";
  return v.lang;
}

/** Voices usable for a language, best first. */
function listVoices(lang) {
  const re = lang === "en" ? /^en/i : /^(zh|cmn|yue)/i;
  const raw = synth ? synth.getVoices().filter((v) => re.test(v.lang) && !NOVELTY_VOICE.test(v.name)) : [];
  // Some devices list the same voice several times (e.g. compact and enhanced
  // copies); keep one per name + language, preferring the higher quality one.
  const quality = (v) => (/premium/i.test(v.voiceURI + v.name) ? 2 : /enhanced/i.test(v.voiceURI + v.name) ? 1 : 0);
  const byKey = new Map();
  for (const v of raw) {
    const key = `${v.name.replace(/\s*\(.*\)$/, "").toLowerCase()}|${v.lang.replace("_", "-").toLowerCase()}`;
    const prev = byKey.get(key);
    if (!prev || quality(v) > quality(prev)) byKey.set(key, v);
  }
  const all = [...byKey.values()];
  const rank = (v) => (NICE_VOICE.test(v.name) ? 0 : 1) + (lang === "en" ? (/^en[-_]US/i.test(v.lang) ? 0 : 2) : /^(zh[-_]HK|yue)/i.test(v.lang) ? 4 : /^zh[-_]TW/i.test(v.lang) ? 2 : 0);
  return all.sort((a, z) => rank(a) - rank(z) || a.name.localeCompare(z.name));
}

function pickVoice(lang) {
  const uri = lang === "en" ? state.settings.ttsEnVoice : state.settings.ttsZhVoice;
  const voices = listVoices(lang);
  return (uri && voices.find((v) => v.voiceURI === uri)) || voices[0] || null;
}

function utter(text, lang, { noVoice = false } = {}) {
  const u = new SpeechSynthesisUtterance(text);
  // After a failed attempt, let the phone pick its own Chinese voice by language.
  const voice = noVoice || (lang === "zh" && tts.zhNoVoice) ? null : pickVoice(lang);
  if (voice) u.voice = voice;
  u.lang = voice?.lang || (lang === "en" ? "en-US" : "zh-CN");
  u.rate = state.settings.ttsRate;
  return u;
}

function ttsParts(v) {
  const el = chapterEl.querySelector(`.v[data-v="${v}"]`);
  if (!el) return null;
  // When only one language is shown, read only that language.
  const mode = state.settings.textMode !== "both" ? state.settings.textMode : state.settings.ttsContent;
  const parts = [];
  const zh = el.querySelector(".zh .t")?.textContent.replace(/（[注註]：[^）]*）/g, "");
  const en = el.querySelector(".en .t")?.textContent;
  if (zh && mode !== "en") parts.push(["zh", zh]);
  if (en && mode !== "zh") parts.push(["en", en]);
  return parts;
}

async function ttsSpeak() {
  if (!tts.on || !tts.playing) return;
  const parts = ttsParts(tts.v);
  if (parts === null) {
    // End of chapter: continue with the next one.
    const { b, c } = activeTab();
    if (b === 65 && c === BOOKS[b].chapters) return ttsStop();
    const next = c < BOOKS[b].chapters ? [b, c + 1] : [b + 1, 1];
    tts.v = 1;
    tts.part = 0;
    await go(next[0], next[1], 1, { fromTts: true });
    return ttsSpeak();
  }
  if (tts.part >= parts.length) {
    tts.v++;
    tts.part = 0;
    return ttsSpeak();
  }
  if (tts.part === 0) markReading();
  const [lang, text] = parts[tts.part];
  speakPart(text, lang);
}

/**
 * Speak one line. Some Android phones have no Chinese voice data: the engine then
 * fails, or "finishes" instantly without a sound. Retry once letting the phone
 * choose a voice by language, and if that also fails, explain how to fix it.
 */
function speakPart(text, lang, retried = false) {
  const u = utter(text, lang);
  const token = ++tts.token;
  const started = Date.now();
  const next = () => {
    if (token !== tts.token || !tts.playing) return;
    tts.part++;
    ttsSpeak();
  };
  const failed = () => {
    if (token !== tts.token || !tts.playing) return;
    if (lang === "zh" && !retried && !tts.zhNoVoice) {
      tts.zhNoVoice = true;
      return speakPart(text, lang, true);
    }
    if (lang === "zh") warnNoChinese();
    next();
  };
  u.onend = () => {
    const tooQuick = lang === "zh" && text.length > 4 && Date.now() - started < Math.min(500, text.length * 50);
    if (tooQuick) failed();
    else next();
  };
  u.onerror = (e) => {
    if (e.error === "interrupted" || e.error === "canceled") return;
    failed();
  };
  synth.speak(u);
}

function warnNoChinese() {
  if (tts.warnedZh) return;
  tts.warnedZh = true;
  const body = openSheet(t("tts.noZhTitle"), `<p style="line-height:1.7;font-size:16px;margin:4px 0 16px">${t("tts.noZhBody")}</p>
    <div class="note-actions"><button class="btn primary" id="nozh-ok">OK</button></div>`);
  $("#nozh-ok", body).onclick = closeSheet;
}

function markReading() {
  $$(".v.reading", chapterEl).forEach((el) => el.classList.remove("reading"));
  const el = chapterEl.querySelector(`.v[data-v="${tts.v}"]`);
  if (!el) return;
  el.classList.add("reading");
  suppressScrollSave = true;
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  setTimeout(() => (suppressScrollSave = false), 800);
  const tab = activeTab();
  tab.v = tts.v;
  persist("tabs");
  updatePlayer();
}

function updatePlayer() {
  const { b, c } = activeTab();
  $("#player").hidden = !tts.on;
  document.body.classList.toggle("playing", tts.on);
  $("#pl-ref").textContent = `${bookName(b)} ${c}:${tts.v}`;
  const total = chapterEl.querySelectorAll(".v").length || 1;
  const bar = $("#pl-bar");
  bar.max = total;
  if (!bar.dragging) bar.value = tts.v;
  bar.style.setProperty("--p", `${total > 1 ? ((bar.value - 1) / (total - 1)) * 100 : 100}%`);
  $("#pl-pos").textContent = t("pl.verse", { v: bar.value });
  $("#pl-total").textContent = t("pl.total", { n: total });
  $("#pl-speed").textContent = t("pl.speed", { r: state.settings.ttsRate });
  const play = $("#pl-play");
  play.innerHTML = tts.playing ? PAUSE_ICON : PLAY_ICON;
  play.setAttribute("aria-label", t(tts.playing ? "pl.pause" : "pl.resume"));
}

async function keepAwake(on) {
  try {
    if (on && !tts.wake && navigator.wakeLock) tts.wake = await navigator.wakeLock.request("screen");
    if (!on && tts.wake) { await tts.wake.release(); tts.wake = null; }
  } catch {}
}

function ttsStart(v) {
  if (!synth) return toast(t("tts.unsupported"));
  synth.cancel();
  Object.assign(tts, { on: true, playing: true, v: v || firstFullyVisibleVerse() || 1, part: 0 });
  keepAwake(true);
  updatePlayer();
  ttsSpeak();
}

function ttsPause() {
  tts.playing = false;
  tts.token++;
  synth?.cancel();
  keepAwake(false);
  updatePlayer();
}

function ttsResume() {
  tts.playing = true;
  tts.part = 0;
  keepAwake(true);
  updatePlayer();
  ttsSpeak();
}

function ttsStop() {
  if (!tts.on) return;
  tts.on = tts.playing = false;
  tts.token++;
  synth?.cancel();
  keepAwake(false);
  $$(".v.reading", chapterEl).forEach((el) => el.classList.remove("reading"));
  updatePlayer();
}

function ttsJump(delta, absolute = null) {
  const count = chapterEl.querySelectorAll(".v").length;
  tts.v = Math.min(Math.max(1, absolute ?? tts.v + delta), count);
  tts.part = 0;
  tts.token++;
  synth.cancel();
  if (tts.playing) ttsSpeak();
  else markReading();
}

// The header button switches read-aloud mode on/off. When off, tapping a verse
// selects it for highlighting, notes and copying instead of offering to read it.
function updateListenButton() {
  const on = state.settings.listen;
  const btn = $("#btn-tts");
  btn.classList.toggle("off", !on);
  btn.setAttribute("aria-pressed", String(on));
  $(".lbl", btn).textContent = t(on ? "listen.on" : "listen.off");
}
$("#btn-tts").onclick = () => {
  state.settings.listen = !state.settings.listen;
  persist("settings");
  if (!state.settings.listen) ttsStop();
  hideQuick();
  clearSelection();
  updateListenButton();
  toast(t(state.settings.listen ? "listen.onToast" : "listen.offToast"));
};
$("#pl-play").onclick = () => (tts.playing ? ttsPause() : ttsResume());
$("#pl-stop").onclick = ttsStop;
$("#pl-prev").onclick = () => ttsJump(-1);
$("#pl-next").onclick = () => ttsJump(1);
// Progress bar: drag to preview the verse number, release to jump there.
const plBar = $("#pl-bar");
plBar.addEventListener("input", () => {
  plBar.dragging = true;
  updatePlayer();
});
plBar.addEventListener("change", () => {
  plBar.dragging = false;
  ttsJump(0, Number(plBar.value));
});
$("#pl-speed").onclick = () => {
  const i = RATES.indexOf(state.settings.ttsRate);
  state.settings.ttsRate = RATES[(i + 1) % RATES.length];
  persist("settings");
  updatePlayer();
  if (tts.playing) {
    tts.token++;
    synth.cancel();
    ttsSpeak();
  }
};
synth?.getVoices();
synth?.addEventListener?.("voiceschanged", () => {
  const body = $("#sheet-body");
  if (!sheet.hidden && $("#voice-zh", body)) fillVoiceSelects(body);
});

function fillVoiceSelects(body) {
  for (const [id, lang, key] of [["#voice-zh", "zh", "ttsZhVoice"], ["#voice-en", "en", "ttsEnVoice"]]) {
    const sel = $(id, body);
    const voices = listVoices(lang);
    const cur = state.settings[key];
    // Skip entries whose label would look identical to one already listed.
    const seen = new Set();
    const options = [];
    for (const v of voices) {
      const tags = [voiceRegion(v), voiceGender(v)].filter(Boolean).join(" · ");
      const label = `${v.name.replace(/\s*\(.*\)$/, "")}${tags ? " · " + tags : ""}`;
      if (seen.has(label) && v.voiceURI !== cur) continue;
      seen.add(label);
      options.push(`<option value="${esc(v.voiceURI)}" ${v.voiceURI === cur ? "selected" : ""}>${esc(label)}</option>`);
    }
    sel.innerHTML = options.length
      ? `<option value="">${t("voice.auto")}</option>` + options.join("")
      : `<option value="">${t(lang === "en" ? "voice.noneEn" : "voice.noneZh")}</option>`;
  }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && tts.playing) keepAwake(true);
});

/* ============================================================
   Sheets
   ============================================================ */

const sheet = $("#sheet");
const scrim = $("#scrim");
let onSheetClose = null;

function openSheet(title, html, { tall = false, onClose = null } = {}) {
  $("#sheet-title").textContent = title;
  $("#sheet-body").onclick = null; // drop the previous sheet's handler
  $("#sheet-body").innerHTML = html;
  $("#sheet-body").scrollTop = 0;
  sheet.classList.toggle("tall", tall);
  sheet.hidden = false;
  scrim.hidden = false;
  onSheetClose = onClose;
  return $("#sheet-body");
}

function closeSheet() {
  sheet.hidden = true;
  scrim.hidden = true;
  const cb = onSheetClose;
  onSheetClose = null;
  cb?.();
}

scrim.onclick = closeSheet;
$("#sheet-close").onclick = closeSheet;
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !sheet.hidden) closeSheet();
});

let toastTimer;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 1800);
}

/* ============================================================
   Full-screen pages (bottom navigation)
   ============================================================ */

const page = $("#page");
let view = "reader"; // reader | books | chapters | notes | bookmarks | history | settings
let bibleView = "reader"; // last place inside the Bible tab
const NAV_OF = { reader: "bible", books: "bible", chapters: "bible", notes: "notes", bookmarks: "bookmarks", history: "history", settings: "settings" };
const CHEVRON = '<svg viewBox="0 0 24 24" class="chev-r"><path d="M9 6l6 6-6 6"/></svg>';

function openPage(name, title, html, { back = null, actions = "" } = {}) {
  view = name;
  if (NAV_OF[name] === "bible") bibleView = name;
  if (!sheet.hidden) closeSheet();
  clearSelection();
  hideQuick();
  $("#page-title").textContent = title;
  const backBtn = $("#page-back");
  backBtn.hidden = !back;
  backBtn.onclick = back?.onClick || null;
  $("#page-back-label").textContent = back?.label || "";
  $("#page-actions").innerHTML = actions;
  const body = $("#page-body");
  body.onclick = null;
  body.innerHTML = html;
  body.scrollTop = 0;
  page.hidden = false;
  updateNav();
  return body;
}

function showReader() {
  view = bibleView = "reader";
  page.hidden = true;
  updateNav();
}

function updateNav() {
  $$("#bottomnav button").forEach((b) => b.classList.toggle("on", b.dataset.nav === NAV_OF[view]));
}

$("#bottomnav").onclick = (e) => {
  const btn = e.target.closest("[data-nav]");
  if (!btn) return;
  if (!sheet.hidden) closeSheet();
  switch (btn.dataset.nav) {
    case "bible":
      // Like iOS tab bars: tapping the active tab goes back to its first screen.
      if (view === "reader" || view === "chapters") openBooks();
      else if (view === "books") $("#page-body").scrollTop = 0;
      else if (bibleView === "reader") showReader();
      else openBooks();
      break;
    case "notes": openNotesPage(); break;
    case "bookmarks": openBookmarksPage(); break;
    case "history": openHistoryPage(); break;
    case "settings": openSettings(); break;
  }
};
$("#page-actions").addEventListener("click", (e) => {
  if (e.target.closest("[data-version]")) openVersionSheet();
  const intro = e.target.closest("[data-intro]");
  if (intro) openIntro(Number(intro.dataset.intro));
});

/* ---------- Book list and chapter numbers ---------- */

let booksTestament = null;
let pendingNewTab = false;

const versionPill = () =>
  `<button class="ver-pill" data-version><svg viewBox="0 0 24 24"><path d="M3 5h8M7 3v2M5 5c0 4 3 7 6 8M9 5c0 3-2 7-6 9"/><path d="M13 21l4-10 4 10M14.5 17.5h5"/></svg><span>${esc(versionLabel())}</span></button>`;

/** Open a passage chosen from a page, in the current tab or a new one. */
function goFromPage(b, c, v = null) {
  const newTab = pendingNewTab;
  pendingNewTab = false;
  showReader();
  go(b, c, v, { flash: !!v && v > 1, newTab });
}

function openBooks({ newTab = pendingNewTab, title = null } = {}) {
  pendingNewTab = newTab;
  const tab = activeTab();
  booksTestament ||= BOOKS[tab.b].nt ? "nt" : "ot";
  const body = openPage("books", title || t(newTab ? "nav.titleNewTab" : "books.title"), "", {
    actions: versionPill(),
    back: newTab ? { label: t("cancel"), onClick: () => { pendingNewTab = false; showReader(); } } : null,
  });
  const draw = () => {
    const recent = recentPassages(6);
    const books = booksTestament === "ot" ? BOOKS.slice(0, 39) : BOOKS.slice(39);
    body.innerHTML = `
      <form class="search" id="nav-search">
        ${ICON.search}
        <input id="nav-q" type="search" placeholder="${t("nav.placeholder")}" autocomplete="off" enterkeyhint="go">
        <button class="go" type="submit">${t("nav.go")}</button>
      </form>
      ${!newTab && state.settings.onboarded && state.history.length ? `<button class="continue-card" data-continue>
          <span><span class="k">${t("books.continue")}</span><span class="r" style="display:block">${esc(refText(tab.b, tab.c, tab.v > 1 ? tab.v : null))}</span></span>
          <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>` : ""}
      ${recent.length ? `<div class="nav-section section-row"><span>${t("nav.recent")}</span><button class="link-btn" data-clear-recent>${t("nav.clearRecent")}</button></div>
        <div class="recent">${recent.map((h) => `<button data-recent="${vkey(h.b, h.c, h.v)}">${esc(refText(h.b, h.c, h.v > 1 ? h.v : null))}</button>`).join("")}</div>` : ""}
      <div class="testament-tabs">
        <button data-test="ot" class="${booksTestament === "ot" ? "on" : ""}">${t("nav.ot")}</button>
        <button data-test="nt" class="${booksTestament === "nt" ? "on" : ""}">${t("nav.nt")}</button>
      </div>
      <div class="book-list">${books.map((bk, i) => `<button class="book-row${bk.i === tab.b ? " cur" : ""}" data-b="${bk.i}">
          <span class="num">${i + 1}</span>
          <span class="info"><span class="name">${esc(bookName(bk.i))}</span>
            <span class="meta">${esc(otherBookName(bk.i))} · ${t(bk.i === 18 ? "intro.psalms" : "intro.chapters", { n: bk.chapters })}</span></span>
          ${CHEVRON}</button>`).join("")}</div>`;
    $("#nav-search", body).onsubmit = (e) => {
      e.preventDefault();
      const r = parseRef($("#nav-q", body).value);
      if (!r) return toast(t("nav.notFound"));
      goFromPage(r.book, r.chapter, r.verse);
    };
  };
  body.onclick = (e) => {
    const el = e.target.closest("button");
    if (!el || el.closest("form")) return;
    if (el.dataset.continue !== undefined) return showReader();
    if (el.dataset.clearRecent !== undefined) {
      state.settings.recentClearedAt = Date.now();
      persist("settings");
      return draw();
    }
    if (el.dataset.recent) {
      const { b, c, v } = parseKey(el.dataset.recent);
      return goFromPage(b, c, v);
    }
    if (el.dataset.test) {
      booksTestament = el.dataset.test;
      const top = $(".testament-tabs", body).offsetTop - 8;
      draw();
      body.scrollTop = Math.min(body.scrollTop, top);
      return;
    }
    if (el.dataset.b) {
      const b = Number(el.dataset.b);
      if (BOOKS[b].chapters === 1) return goFromPage(b, 1);
      openChapters(b);
    }
  };
  draw();
}

function openChapters(b) {
  const tab = activeTab();
  const book = BOOKS[b];
  const body = openPage("chapters", bookName(b), `
    <p class="hint" style="margin:2px 2px 14px">${esc(otherBookName(b))} · ${t(b === 18 ? "intro.psalms" : "intro.chapters", { n: book.chapters })}</p>
    <div class="chapter-grid">${range(book.chapters).map((c) =>
      `<button data-c="${c}" class="${!pendingNewTab && b === tab.b && c === tab.c ? "cur" : ""}">${c}</button>`).join("")}</div>`, {
    back: { label: t("books.back"), onClick: () => openBooks() },
    actions: `<button class="page-intro-btn" data-intro="${b}"><svg viewBox="0 0 24 24"><path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H11v17H5.5A1.5 1.5 0 0 1 4 18.5zM20 4.5A1.5 1.5 0 0 0 18.5 3H13v17h5.5a1.5 1.5 0 0 0 1.5-1.5z"/></svg>${t("nav.intro")}</button>`,
  });
  body.onclick = (e) => {
    const el = e.target.closest("[data-c]");
    if (el) goFromPage(b, Number(el.dataset.c));
  };
}

/* ---------- Version & display sheet ---------- */

function versionLabel() {
  const s = state.settings;
  const zh = versionMeta(s.zh)?.short;
  const en = versionMeta(englishVersion())?.short;
  if (s.textMode === "zh") return zh;
  if (s.textMode === "en") return en || zh;
  return [zh, en].filter(Boolean).join(" · ");
}

function updateVersionLabels() {
  const label = versionLabel() || "";
  $("#ver-label").textContent = label;
  $$("[data-version] span").forEach((el) => (el.textContent = label));
}

function openVersionSheet() {
  const s = state.settings;
  const versions = allVersions();
  const enId = englishVersion();
  const radios = (group, items, cur) =>
    `<div class="radio-list" data-group="${group}">${items.map(([v, label]) => `<button data-v="${esc(v)}" class="${v === cur ? "on" : ""}">${esc(label)}</button>`).join("")}</div>`;
  const body = openSheet(t("ver.sheet"), `
    <div class="set-title">${t("set.display")}</div>
    ${radios("textMode", ["both", "zh", "en"].map((v) => [v, t("display." + v)]), s.textMode)}
    <div class="set-title">${t("ver.zh")}</div>
    ${radios("zh", versions.filter((v) => v.lang === "zh").map((v) => [v.id, v.name]), s.zh)}
    <div class="set-title">${t("ver.en")}</div>
    ${radios("en", versions.filter((v) => v.lang === "en").map((v) => [v.id, v.name]), enId)}`);
  body.onclick = (e) => {
    const btn = e.target.closest("[data-v]");
    if (!btn) return;
    const group = btn.closest("[data-group]").dataset.group;
    s[group] = btn.dataset.v;
    persist("settings");
    $$(`[data-group="${group}"] button`, body).forEach((x) => x.classList.toggle("on", x === btn));
    applySettings();
    if (group !== "textMode") render({ scrollTo: topVisibleVerse() || activeTab().v });
    if (group === "zh") prefetchVersion(s.zh);
  };
}

/** Most recently read chapters, newest first, one entry per chapter. */
function recentPassages(n) {
  const seen = new Set();
  const out = [];
  const since = state.settings.recentClearedAt || 0;
  for (const h of state.history) {
    if (h.t <= since) break; // history is newest first
    const k = `${h.b}.${h.c}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(h);
    if (out.length === n) break;
  }
  return out;
}

const range = (n) => Array.from({ length: n }, (_, i) => i + 1);

$("#btn-ref").onclick = () => openBooks({ newTab: false });
$("#btn-version").onclick = () => openVersionSheet();

/* ---------- Note editor ---------- */

function openNote(v) {
  const { b, c } = activeTab();
  const k = vkey(b, c, v);
  const existing = state.notes[k];
  const verseEl = chapterEl.querySelector(`.v[data-v="${v}"]`);
  const zh = verseEl?.querySelector(".zh .t")?.textContent || "";
  const en = verseEl?.querySelector(".en .t")?.textContent || "";
  const body = openSheet(t("note.title"), `
    <div class="note-ref">${esc(refText(b, c, v))} · ${esc(otherRef(b, c, v))}</div>
    <div class="note-verse">${esc(zh)}${en ? `<div class="hint" style="margin-top:4px">${esc(en)}</div>` : ""}</div>
    <textarea class="note-input" id="note-text" placeholder="${t("note.placeholder")}">${esc(existing?.text || "")}</textarea>
    <div class="note-actions">
      ${existing ? `<button class="btn danger" id="note-del">${t("delete")}</button>` : ""}
      <button class="btn" id="note-cancel">${t("cancel")}</button>
      <button class="btn primary" id="note-save">${t("save")}</button>
    </div>`);
  const ta = $("#note-text", body);
  setTimeout(() => ta.focus(), 250);
  $("#note-cancel", body).onclick = closeSheet;
  $("#note-save", body).onclick = () => {
    const text = ta.value.trim();
    if (text) state.notes[k] = { text, t: Date.now() };
    else delete state.notes[k];
    persist("notes");
    closeSheet();
    rerenderVerse(v);
    clearSelection();
    toast(t(text ? "toast.noteSaved" : "toast.noteDeleted"));
  };
  const del = $("#note-del", body);
  if (del) del.onclick = () => {
    delete state.notes[k];
    persist("notes");
    closeSheet();
    rerenderVerse(v);
    clearSelection();
    toast(t("toast.noteDeleted"));
  };
}

/** Note attached to selected words (pieces) or to an existing group g. */
function openRangeNote({ g = null, pieces = null }) {
  const existing = g ? state.rnotes[g] : null;
  const parts = g ? groupPieces(g) : pieces;
  if (!parts?.length) return;
  const first = parts[0];
  const quote = parts.map((p) => p.q).join(" … ");
  const body = openSheet(t("note.title"), `
    <div class="note-ref">${esc(refText(first.b, first.c, first.v))} · ${esc(otherRef(first.b, first.c, first.v))}</div>
    <div class="note-quote">${esc(quote)}</div>
    <textarea class="note-input" id="note-text" placeholder="${t("note.placeholder")}">${esc(existing?.text || "")}</textarea>
    <div class="note-actions">
      ${existing ? `<button class="btn danger" id="note-del">${t("delete")}</button>` : ""}
      <button class="btn" id="note-cancel">${t("cancel")}</button>
      <button class="btn primary" id="note-save">${t("save")}</button>
    </div>`);
  const ta = $("#note-text", body);
  setTimeout(() => ta.focus(), 250);
  const done = (msg) => {
    persist("ranges", "rnotes");
    closeSheet();
    clearSelection();
    refreshPieces(parts);
    toast(t(msg));
  };
  $("#note-cancel", body).onclick = closeSheet;
  $("#note-save", body).onclick = () => {
    const text = ta.value.trim();
    if (!text) {
      if (g) deleteRangeNote(g);
      return done("toast.noteDeleted");
    }
    const id = g || addPieces(parts, {});
    state.rnotes[id] = { text, t: Date.now() };
    done("toast.noteSaved");
  };
  const del = $("#note-del", body);
  if (del) del.onclick = () => {
    deleteRangeNote(g);
    done("toast.noteDeleted");
  };
}

function deleteRangeNote(g) {
  delete state.rnotes[g];
  for (const [id, r] of Object.entries(state.ranges)) {
    if (r.g === g && !r.hl && !r.ul) delete state.ranges[id];
  }
}

/* ---------- Notes, bookmarks and history pages ---------- */

let notesTab = "notes";

/** Shared taps on list pages: open a passage, or delete a row. */
function listClicks(body, redraw) {
  body.onclick = (e) => {
    const del = e.target.closest("[data-del]");
    if (del) {
      e.stopPropagation();
      const [kind, k] = del.dataset.del.split("|");
      if (kind === "bm") delete state.bookmarks[k];
      if (kind === "note" && confirm(t("confirm.deleteNote"))) delete state.notes[k];
      if (kind === "rnote" && confirm(t("confirm.deleteNote"))) deleteRangeNote(k);
      if (kind === "mark") delete state.marks[k];
      if (kind === "rmark") {
        for (const p of groupPieces(k)) {
          delete state.ranges[p.id].hl;
          delete state.ranges[p.id].ul;
          if (!state.rnotes[k]) delete state.ranges[p.id];
        }
      }
      persist("bookmarks", "notes", "marks", "ranges", "rnotes");
      redraw();
      if (rendered) render({ scrollTo: topVisibleVerse() || activeTab().v });
      return;
    }
    const open = e.target.closest("[data-open]");
    if (open) {
      const { b, c, v } = parseKey(open.dataset.open);
      showReader();
      go(b, c, v, { flash: true });
    }
  };
}

function openNotesPage() {
  const body = openPage("notes", t("tab.notes"), "");
  const draw = () => {
    body.innerHTML = `<div class="seg full" id="notes-seg" style="margin-bottom:6px">
        ${["notes", "marks"].map((id) => `<button data-tab="${id}" class="${notesTab === id ? "on" : ""}">${t("lib." + id)}</button>`).join("")}
      </div><div id="lib-list"></div>`;
    $("#notes-seg", body).onclick = (e) => {
      const el = e.target.closest("[data-tab]");
      if (!el) return;
      notesTab = el.dataset.tab;
      draw();
    };
    (notesTab === "notes" ? drawNotes : drawMarks)($("#lib-list", body));
  };
  listClicks(body, draw);
  draw();
}

function openBookmarksPage() {
  const body = openPage("bookmarks", t("tab.bookmarks"), `<div id="lib-list"></div>`);
  const draw = () => drawBookmarks($("#lib-list", body));
  listClicks(body, draw);
  draw();
}

function openHistoryPage() {
  const body = openPage("history", t("tab.history"), `<div id="lib-list"></div>`);
  const draw = () => drawHistory($("#lib-list", body));
  listClicks(body, draw);
  draw();
}

function sortedKeys(obj, time) {
  return Object.keys(obj).sort((a, z) => time(obj[z]) - time(obj[a]));
}

async function fillSnippets(list) {
  const rows = $$("[data-snippet]", list);
  for (const el of rows) {
    const { b, c, v } = parseKey(el.dataset.snippet);
    try {
      const ch = await getChapter(state.settings.zh, b, c);
      el.textContent = ch?.[v - 1] || "";
    } catch {}
  }
}

function emptyState(text) {
  return `<div class="empty-state">${text}</div>`;
}

function drawBookmarks(list) {
  const keys = sortedKeys(state.bookmarks, (ts) => ts);
  if (!keys.length) return (list.innerHTML = emptyState(t("empty.bookmarks")));
  list.innerHTML = `<ul class="list">${keys.map((k) => {
    const { b, c, v } = parseKey(k);
    return `<li><div class="row"><button class="main" data-open="${k}" style="text-align:left">
        <div class="ref">${esc(refText(b, c, v))}</div><div class="sub" data-snippet="${k}"></div></button>
        <button class="del" data-del="bm|${k}" aria-label="${t("delete")}">${ICON.trash}</button></div></li>`;
  }).join("")}</ul>`;
  fillSnippets(list);
}

function drawNotes(list) {
  const items = [
    ...Object.entries(state.notes).map(([k, n]) => ({ k, del: `note|${k}`, ...n, ...parseKey(k) })),
    ...Object.entries(state.rnotes).map(([g, n]) => {
      const first = groupPieces(g)[0];
      return first && { k: vkey(first.b, first.c, first.v), del: `rnote|${g}`, quote: groupQuote(g), ...n, b: first.b, c: first.c, v: first.v };
    }).filter(Boolean),
  ].sort((a, z) => z.t - a.t);
  if (!items.length) return (list.innerHTML = emptyState(t("empty.notes")));
  list.innerHTML = `<ul class="list">${items.map((n) => `<li><div class="row"><button class="main" data-open="${n.k}" style="text-align:left">
        <div class="ref">${esc(refText(n.b, n.c, n.v))} <span class="hint">· ${fmtDate(n.t)}</span></div>
        ${n.quote ? `<div class="sub quote">${esc(n.quote)}</div>` : ""}
        <div class="sub note">${esc(n.text)}</div></button>
        <button class="del" data-del="${n.del}" aria-label="${t("delete")}">${ICON.trash}</button></div></li>`).join("")}</ul>`;
}

function drawMarks(list) {
  const groups = new Map();
  for (const r of Object.values(state.ranges)) {
    if (!r.hl && !r.ul) continue;
    if (!groups.has(r.g)) groups.set(r.g, r);
  }
  const items = [
    ...Object.entries(state.marks).map(([k, m]) => ({ k, del: `mark|${k}`, hl: m.hl, ul: m.ul, t: m.t || 0, snippet: true, ...parseKey(k) })),
    ...[...groups].map(([g, r]) => ({ k: vkey(r.b, r.c, r.v), del: `rmark|${g}`, hl: r.hl, ul: r.ul, t: r.t, quote: groupQuote(g), b: r.b, c: r.c, v: r.v })),
  ].sort((a, z) => z.t - a.t);
  if (!items.length) return (list.innerHTML = emptyState(t("empty.marks")));
  list.innerHTML = `<ul class="list">${items.map((m) => {
    const color = m.hl || m.ul;
    const style = m.hl ? `background:var(--hl-${m.hl})` : `border:2px solid var(--ul-${m.ul})`;
    return `<li><div class="row"><span class="dot" style="${style}" title="${color ? t("color." + color) : ""}"></span>
        <button class="main" data-open="${m.k}" style="text-align:left">
        <div class="ref">${esc(refText(m.b, m.c, m.v))}${m.ul && !m.hl ? ` <span class="hint">· ${t("lib.underline")}</span>` : ""}</div>
        ${m.quote ? `<div class="sub quote">${esc(m.quote)}</div>` : `<div class="sub" data-snippet="${m.k}"></div>`}</button>
        <button class="del" data-del="${m.del}" aria-label="${t("delete")}">${ICON.trash}</button></div></li>`;
  }).join("")}</ul>`;
  fillSnippets(list);
}

function drawHistory(list) {
  if (!state.history.length) return (list.innerHTML = emptyState(t("empty.history")));
  let html = "", day = "";
  for (const h of state.history.slice(0, 400)) {
    const d = fmtDay(h.t);
    if (d !== day) {
      if (day) html += "</ul>";
      html += `<div class="day">${d}</div><ul class="list">`;
      day = d;
    }
    html += `<li><button class="row" data-open="${vkey(h.b, h.c, h.v)}">
      <span class="time">${fmtTime(h.t)}</span>
      <span class="main"><span class="ref">${esc(refText(h.b, h.c, h.v))}</span>
      <span class="sub" style="display:block">${esc(otherRef(h.b, h.c, h.v))}</span></span></button></li>`;
  }
  html += `</ul><div style="text-align:center;margin-top:18px"><button class="btn danger" id="clear-history">${t("history.clear")}</button></div>`;
  list.innerHTML = html;
  $("#clear-history", list).onclick = (e) => {
    e.stopPropagation();
    if (!confirm(t("confirm.clearHistory"))) return;
    state.history = [];
    persist("history");
    drawHistory(list);
  };
}

function fmtDay(ts) {
  const d = new Date(ts);
  const today = new Date();
  const yest = new Date(Date.now() - 864e5);
  const same = (a, z) => a.toDateString() === z.toDateString();
  const label = new Intl.DateTimeFormat(LOCALE[uiLang()], { year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(d);
  if (same(d, today)) return `${t("today")} · ${label}`;
  if (same(d, yest)) return `${t("yesterday")} · ${label}`;
  return label;
}
const pad = (n) => String(n).padStart(2, "0");
const fmtTime = (ts) => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fmtDate = (ts) => { const d = new Date(ts); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${fmtTime(ts)}`; };


/* ---------- Book introduction (导读) ---------- */

async function openIntro(b = activeTab().b) {
  const book = BOOKS[b];
  const intro = intros()[b];
  const [kc, kv] = intro.key.split(":").map(Number);
  // Interface language first, the other language underneath.
  const pair = (zh, en) => (isEn() ? [en, zh] : [zh, en]);
  const fact = (label, zh, en) => {
    const [main, sub] = pair(zh, en);
    return `<dt>${t(label)}</dt><dd>${esc(main)}<span class="e">${esc(sub)}</span></dd>`;
  };
  const [sumMain, sumSub] = pair(intro.zh.summary, intro.en.summary);
  const body = openSheet(t("intro.title"), `<div class="intro">
    <h3>${esc(bookName(b))}</h3>
    <div class="en-title">${esc(otherBookName(b))} · ${t(book.nt ? "intro.nt" : "intro.ot")} · ${t(b === 18 ? "intro.psalms" : "intro.chapters", { n: book.chapters })}</div>
    <dl class="facts">
      ${fact("intro.author", intro.zh.author, intro.en.author)}
      ${fact("intro.date", intro.zh.date, intro.en.date)}
      ${fact("intro.theme", intro.zh.theme, intro.en.theme)}
    </dl>
    <h4>${t("intro.summary")}</h4>
    <p class="${isEn() ? "e-main" : ""}">${esc(sumMain)}</p>
    <p class="e">${esc(sumSub)}</p>
    <h4>${t("intro.key")}</h4>
    <button class="keyverse" data-go="${kc}:${kv}" style="text-align:left;width:100%">
      <div class="r">${esc(refText(b, kc, kv))} · ${esc(otherRef(b, kc, kv))}</div>
      <div id="kv-zh">…</div><div id="kv-en" class="hint" style="font-family:Georgia,serif;margin-top:4px"></div>
    </button>
    <h4>${t("intro.outline")}</h4>
    <div class="outline">${intro.outline.map(([c, zh, en]) => {
      const [main, sub] = pair(zh, en);
      return `<button data-go="${c}:1"><span class="c">${t(b === 18 ? "intro.psalm" : "intro.chapter", { c })}</span><span>${esc(main)}<span class="e">${esc(sub)}</span></span></button>`;
    }).join("")}</div>
  </div>`, { tall: true });
  body.onclick = (e) => {
    const el = e.target.closest("[data-go]");
    if (!el) return;
    const [c, v] = el.dataset.go.split(":").map(Number);
    closeSheet();
    goFromPage(b, c, v > 1 ? v : null);
  };
  const enId = englishVersion();
  const [zh, en] = await Promise.all([
    getChapter(state.settings.zh, b, kc).catch(() => null),
    enId ? getChapter(enId, b, kc).catch(() => null) : null,
  ]);
  if ($("#kv-zh", body)) $("#kv-zh", body).textContent = zh?.[kv - 1] || "";
  if ($("#kv-en", body)) $("#kv-en", body).textContent = en?.[kv - 1] || "";
}

$("#btn-intro").onclick = () => openIntro();

/* ---------- Settings ---------- */

function applySettings() {
  const s = state.settings;
  document.body.classList.toggle("text-zh", s.textMode === "zh");
  document.body.classList.toggle("text-en", s.textMode === "en");
  if (typeof updateVersionLabels === "function") updateVersionLabels();
  document.documentElement.style.setProperty("--fs", s.fontSize + "px");
  if (s.theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = s.theme;
  const dark = s.theme === "dark" || (s.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  $$('meta[name="theme-color"]').forEach((m) => {
    m.content = dark ? "#16171a" : "#faf8f3";
    m.removeAttribute("media");
  });
}

function openSettings(focusImport = false) {
  const s = state.settings;
  const versions = allVersions();
  const zhOpts = versions.filter((v) => v.lang === "zh");
  const enOpts = versions.filter((v) => v.lang === "en");
  const enId = englishVersion();
  const imported = versions.filter((v) => !BUILTIN.some((b) => b.id === v.id));
  const seg = (id, key, options) =>
    `<div class="seg" id="${id}">${options.map(([v, label]) => `<button data-v="${v}" class="${String(s[key]) === String(v) ? "on" : ""}">${label}</button>`).join("")}</div>`;
  const body = openPage("settings", t("set.title"), `
    <div class="set-title">界面语言 · LANGUAGE</div>
    <div class="set-group"><div class="set-row">
      <div class="seg full" id="ui-lang" style="flex:1">
        ${UI_LANGS.map(([v, label]) => `<button data-v="${v}" class="${uiLang() === v ? "on" : ""}">${label}</button>`).join("")}
      </div></div></div>

    <div class="set-title">${t("set.display")}</div>
    <div class="set-group"><div class="set-row">
      <div class="seg full" id="text-mode" style="flex:1">
        ${["both", "zh", "en"].map((v) => `<button data-v="${v}" class="${s.textMode === v ? "on" : ""}">${t("display." + v)}</button>`).join("")}
      </div></div></div>

    <div class="set-title">${t("set.font")}</div>
    <div class="set-group">
      <div class="set-row"><div class="font-row"><span class="a1">A</span>
        <input type="range" id="fs" min="14" max="32" step="1" value="${s.fontSize}" aria-label="${t("set.font")}">
        <span class="a2">A</span></div><strong id="fs-val" style="min-width:34px;text-align:right">${s.fontSize}</strong></div>
      <div class="font-preview"><div class="zh">${sampleZh()}</div>
        <div class="en">${SAMPLE_EN}</div></div>
    </div>

    <div class="set-title">${t("set.appearance")}</div>
    <div class="set-group"><div class="set-row">
      <div class="seg full" id="theme" style="flex:1">
        ${["system", "light", "dark"].map((v) => `<button data-theme="${v}" class="${s.theme === v ? "on" : ""}">${t("theme." + v)}</button>`).join("")}
      </div></div></div>

    <div class="set-title">${t("set.tts")}</div>
    <div class="set-group">
      <div class="set-row"><span class="lbl" style="white-space:nowrap">${t("tts.content")}</span>
        ${seg("tts-content", "ttsContent", [["both", t("tts.both")], ["zh", t("tts.zh")], ["en", t("tts.en")]])}</div>
      <div class="set-row"><label for="voice-zh" style="white-space:nowrap">${t("tts.zhVoice")}</label>
        <div class="voice-pick"><select id="voice-zh"></select><button class="btn" data-preview="zh" aria-label="${t("tts.previewZh")}">▶</button></div></div>
      <div class="set-row"><label for="voice-en" style="white-space:nowrap">${t("tts.enVoice")}</label>
        <div class="voice-pick"><select id="voice-en"></select><button class="btn" data-preview="en" aria-label="${t("tts.previewEn")}">▶</button></div></div>
      <div class="set-row"><span class="lbl" style="white-space:nowrap">${t("tts.rate")}</span>
        ${seg("tts-rate", "ttsRate", RATES.map((r) => [r, r]))}</div>
      <div class="set-row"><span class="lbl hint" style="font-size:13px;line-height:1.6">${t("tts.moreVoices")}</span></div>
    </div>

    <div class="set-title">${t("set.versions")}</div>
    <div class="set-group">
      <div class="set-row"><label for="ver-zh">${t("ver.zh")}</label>
        <select id="ver-zh">${zhOpts.map((v) => `<option value="${v.id}" ${v.id === s.zh ? "selected" : ""}>${esc(v.name)}</option>`).join("")}</select></div>
      <div class="set-row"><label for="ver-en">${t("ver.en")}</label>
        <select id="ver-en">${enOpts.length ? enOpts.map((v) => `<option value="${v.id}" ${v.id === enId ? "selected" : ""}>${esc(v.name)}</option>`).join("") : `<option value="">${t("ver.none")}</option>`}</select></div>
      ${imported.map((v) => `<div class="set-row"><div class="lbl">${esc(v.name)}<small>${t("ver.imported")}</small></div>
        <button class="btn danger" data-remove="${v.id}">${t("remove")}</button></div>`).join("")}
      <div class="set-row"><div class="lbl">${t("ver.import")}<small>${t("ver.importHint")}</small></div>
        <button class="btn primary" id="import-btn">${t("importMore")}</button></div>
    </div>
    <div id="import-form"></div>

    <div class="set-title">${t("set.data")}</div>
    <div class="set-group">
      <div class="set-row"><div class="lbl">${t("backup")}<small>${t("backup.hint")}</small></div><button class="btn" id="backup-export">${t("export")}</button></div>
      <div class="set-row"><div class="lbl">${t("restore")}<small>${t("restore.hint")}</small></div><button class="btn" id="backup-import">${t("importMore")}</button></div>
    </div>
    <p class="about">${t("about")}<br>
      ${BUILTIN.filter((v) => v.notice).map((v) => esc(v.notice) + "<br>").join("")}
      ${t("tip")}</p>
    <input type="file" id="file-version" accept=".json,application/json" hidden>
    <input type="file" id="file-backup" accept=".json,application/json" hidden>`);

  $("#ui-lang", body).onclick = (e) => {
    const el = e.target.closest("[data-v]");
    if (!el || el.dataset.v === uiLang()) return;
    s.ui = el.dataset.v;
    persist("settings");
    setUiLang(s.ui);
    applyI18n();
    renderColors();
    updateActionbar();
    updatePlayer();
    updateListenButton();
    render({ scrollTo: topVisibleVerse() || activeTab().v });
    const scroll = $("#page-body").scrollTop;
    openSettings();
    $("#page-body").scrollTop = scroll;
  };

  const fs = $("#fs", body);
  fs.oninput = () => {
    s.fontSize = Number(fs.value);
    $("#fs-val", body).textContent = s.fontSize;
    applySettings();
    persist("settings");
  };
  $("#theme", body).onclick = (e) => {
    const el = e.target.closest("[data-theme]");
    if (!el) return;
    s.theme = el.dataset.theme;
    $$("#theme button", body).forEach((x) => x.classList.toggle("on", x === el));
    applySettings();
    persist("settings");
  };
  const segPick = (id, key, cast = String) => ($(id, body).onclick = (e) => {
    const el = e.target.closest("[data-v]");
    if (!el) return;
    s[key] = cast(el.dataset.v);
    $$(`${id} button`, body).forEach((x) => x.classList.toggle("on", x === el));
    persist("settings");
    updatePlayer();
  });
  segPick("#tts-content", "ttsContent");
  segPick("#text-mode", "textMode");
  $("#text-mode", body).addEventListener("click", () => applySettings());
  fillVoiceSelects(body);
  $("#voice-zh", body).onchange = (e) => { s.ttsZhVoice = e.target.value; persist("settings"); preview("zh"); };
  $("#voice-en", body).onchange = (e) => { s.ttsEnVoice = e.target.value; persist("settings"); preview("en"); };
  const preview = (lang) => {
    if (!synth) return toast(t("tts.unsupported"));
    if (tts.on) ttsStop();
    synth.cancel();
    synth.speak(utter(lang === "en" ? SAMPLE_EN : sampleZh(), lang));
  };
  $$("[data-preview]", body).forEach((b) => (b.onclick = () => preview(b.dataset.preview)));
  segPick("#tts-rate", "ttsRate", Number);
  $("#ver-zh", body).onchange = (e) => { s.zh = e.target.value; persist("settings"); render(); prefetchVersion(s.zh); };
  $("#ver-en", body).onchange = (e) => { s.en = e.target.value || null; persist("settings"); render(); };
  $$("[data-remove]", body).forEach((btn) => (btn.onclick = async () => {
    if (!confirm(t("confirm.removeVersion"))) return;
    await removeVersion(btn.dataset.remove);
    if (s.en === btn.dataset.remove) s.en = null;
    if (s.zh === btn.dataset.remove) s.zh = "cuv";
    persist("settings");
    render();
    openSettings();
  }));

  const fileVersion = $("#file-version", body);
  $("#import-btn", body).onclick = () => fileVersion.click();
  fileVersion.onchange = () => {
    const file = fileVersion.files[0];
    if (!file) return;
    const meta = guessMeta(file.name);
    const form = $("#import-form", body);
    form.innerHTML = `<div class="set-group" style="padding:14px">
      <div class="field">${t("imp.name")}<input id="imp-name" value="${esc(meta.short)}"></div>
      <div class="field">${t("imp.lang")}<select id="imp-lang"><option value="en" ${meta.lang === "en" ? "selected" : ""}>English</option><option value="zh" ${meta.lang === "zh" ? "selected" : ""}>中文</option></select></div>
      <div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn" id="imp-cancel">${t("cancel")}</button><button class="btn primary" id="imp-ok">${t("import")}</button></div>
    </div>`;
    form.scrollIntoView({ behavior: "smooth", block: "center" });
    $("#imp-cancel", form).onclick = () => { form.innerHTML = ""; fileVersion.value = ""; };
    $("#imp-ok", form).onclick = async () => {
      const name = $("#imp-name", form).value.trim() || meta.short;
      const lang = $("#imp-lang", form).value;
      $("#imp-ok", form).disabled = true;
      $("#imp-ok", form).textContent = t("imp.importing");
      try {
        const v = await importVersion(file, { name, short: name.slice(0, 12), lang });
        if (lang === "en") s.en = v.id;
        else s.zh = v.id;
        persist("settings");
        toast(t("toast.imported", { name }));
        render();
        openSettings();
      } catch (err) {
        alert(t("err.import") + err.message);
        $("#imp-ok", form).disabled = false;
        $("#imp-ok", form).textContent = t("import");
      }
    };
  };

  $("#backup-export", body).onclick = () => {
    const blob = new Blob([JSON.stringify(exportBackup(), null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bible-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const fileBackup = $("#file-backup", body);
  $("#backup-import", body).onclick = () => fileBackup.click();
  fileBackup.onchange = async () => {
    try {
      importBackup(JSON.parse(await fileBackup.files[0].text()));
      toast(t("toast.restored"));
      render();
    } catch (err) {
      alert(t("err.restore") + err.message);
    }
  };
  if (focusImport) setTimeout(() => $("#import-btn", body).scrollIntoView({ block: "center" }), 50);
}

matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applySettings);

/* ============================================================
   First-run welcome: language, appearance, then where to start
   ============================================================ */

function showWelcome() {
  const el = $("#welcome");
  const s = state.settings;
  const draw = () => {
    el.innerHTML = `<div class="welcome-card">
      <img src="icons/logo.png" alt="" class="welcome-logo" width="112" height="112">
      <h1>${t("welcome.title")}</h1>
      <p class="welcome-sub">Holy Bible · 圣经 · 聖經</p>
      <div class="welcome-label">${t("welcome.lang")}</div>
      <div class="welcome-langs">${UI_LANGS.map(([v, label]) =>
        `<button data-lang="${v}" class="${uiLang() === v ? "on" : ""}">${label}</button>`).join("")}</div>
      <div class="welcome-label">${t("welcome.theme")}</div>
      <div class="seg full">${["light", "dark", "system"].map((v) =>
        `<button data-theme="${v}" class="${s.theme === v ? "on" : ""}">${t("theme." + v)}</button>`).join("")}</div>
      <button class="btn primary welcome-go" id="welcome-go">${t("welcome.continue")}</button>
    </div>`;
  };
  el.onclick = (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    if (btn.dataset.lang) {
      s.ui = btn.dataset.lang;
      setUiLang(s.ui);
      applyI18n();
      renderColors();
      render();
    } else if (btn.dataset.theme) {
      s.theme = btn.dataset.theme;
      applySettings();
    } else if (btn.id === "welcome-go") {
      s.onboarded = true;
      persist("settings");
      el.hidden = true;
      openBooks({ newTab: false, title: t("nav.start") });
      return;
    }
    persist("settings");
    draw();
  };
  draw();
  el.hidden = false;
}

/* ============================================================
   Start
   ============================================================ */

(async function start() {
  // Show the welcome screen to brand-new users only (no reading history yet).
  const firstRun = !state.settings.onboarded && !state.history.length;
  if (!firstRun) state.settings.onboarded = true;
  if (!state.settings.ui) state.settings.ui = "en";
  persist("settings");
  setUiLang(state.settings.ui);
  applyI18n();
  renderColors();
  applySettings();
  updateListenButton();
  updateNav();
  await loadImported();
  if (!hasVersion(state.settings.zh)) state.settings.zh = "cuv";
  // Allow deep links like #约3:16 or #John3:16
  const hash = decodeURIComponent(location.hash.slice(1));
  const r = hash && parseRef(hash);
  if (r) Object.assign(activeTab(), { b: r.book, c: r.chapter, v: r.verse || 1 });
  await render({ flash: !!r?.verse });
  if (firstRun && !r) {
    // The default page wasn't chosen by the user, so keep it out of history.
    state.history = [];
    persist("history");
    showWelcome();
  }
  window.addEventListener("hashchange", () => {
    const r = parseRef(decodeURIComponent(location.hash.slice(1)));
    if (r) go(r.book, r.chapter, r.verse, { flash: !!r.verse });
  });
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("SW", e));
  }
  // Make the default Chinese text available offline in the background.
  setTimeout(() => prefetchVersion(state.settings.zh), 3000);
})();
