import { BOOKS, parseRef, toTrad } from "./books.js";
import { INTRO } from "./intro.js";
import { state, persist, vkey, parseKey, recordHistory, exportBackup, importBackup } from "./store.js";
import {
  BUILTIN, allVersions, hasVersion, versionMeta, getChapter, loadImported,
  prefetchVersion, importVersion, removeVersion, guessMeta,
} from "./versions.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const COLORS = ["yellow", "green", "blue", "pink", "orange"];
const COLOR_NAMES = { yellow: "黄", green: "绿", blue: "蓝", pink: "粉", orange: "橙" };
const ICON = {
  note: '<svg viewBox="0 0 24 24"><path d="M4 20h4l10-10-4-4L4 16z"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
};

const trad = () => state.settings.zh === "cuvt";
const bookName = (b) => (trad() ? BOOKS[b].zht : BOOKS[b].zh);
const refText = (b, c, v) => `${bookName(b)} ${c}${v ? ":" + v : ""}`;
const shortRef = (b, c, v) => `${trad() ? toTrad(BOOKS[b].abbr) : BOOKS[b].abbr}${c}${v ? ":" + v : ""}`;

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
  document.title = `${bookName(b)} ${c} · 圣经`;
  $("#btn-prev").disabled = b === 0 && c === 1;
  $("#btn-next").disabled = b === 65 && c === book.chapters;
  renderTabs();
  clearSelection();

  const enId = englishVersion();
  renderBanner(enId);
  if (!rendered || rendered.b !== b || rendered.c !== c) chapterEl.innerHTML = '<div class="loading">载入中…</div>';

  let zh, en;
  try {
    [zh, en] = await Promise.all([
      getChapter(state.settings.zh, b, c),
      enId ? getChapter(enId, b, c).catch(() => null) : null,
    ]);
  } catch (e) {
    chapterEl.innerHTML = `<div class="empty-state">无法载入经文，请检查网络后重试。<br><button class="btn" id="retry">重试</button></div>`;
    $("#retry").onclick = () => render({ scrollTo, flash });
    return;
  }
  // Another navigation may have happened while loading.
  if (activeTab() !== tab || tab.b !== b || tab.c !== c) return;

  const count = Math.max(zh?.length || 0, en?.length || 0);
  const html = [`<header class="chapter-title"><div class="zh">${esc(bookName(b))} 第 ${c} ${b === 18 ? "篇" : "章"}</div><div class="en">${esc(book.en)} ${c}</div></header>`];
  for (let v = 1; v <= count; v++) html.push(verseHTML(b, c, v, zh?.[v - 1], en ? en[v - 1] : undefined));
  html.push(`<div class="chapter-end">
    ${b || c > 1 ? `<button data-go="prev">‹ 上一章</button>` : ""}
    ${b < 65 || c < book.chapters ? `<button data-go="next">下一章 ›</button>` : ""}
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
    ? `<span class="t">${esc(zh)}</span>`
    : zh === "" ? `<span class="empty">${trad() ? "（併入上節）" : "（并入上节）"}</span>` : "";
  const enHtml = en === undefined ? "" : en
    ? `<span class="t">${esc(en)}</span>`
    : `<span class="empty">${en === "" ? "(Not in the earliest manuscripts)" : ""}</span>`;
  return `<div class="v" data-v="${v}" ${attrs}>
    ${state.bookmarks[k] ? '<span class="bm-ribbon" aria-label="书签"></span>' : ""}
    <span class="vn">${v}</span>
    <p class="zh">${zhHtml}${note ? `<span class="badges"><button class="badge" data-note="${v}" aria-label="笔记">${ICON.note}</button></span>` : ""}</p>
    ${enHtml ? `<p class="en">${enHtml}</p>` : ""}
    ${note ? `<div class="note-preview" data-note="${v}">${esc(note.text)}</div>` : ""}
  </div>`;
}

function renderBanner(enId) {
  const el = $("#banner");
  if (enId || localStorage.getItem("bible.hideEnBanner")) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = `<div class="banner"><span>尚未加入英文译本。导入 NIV 等 JSON 文件后即可中英对照。</span><button id="banner-import">导入</button></div>`;
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
  const noteBtn = e.target.closest("[data-note]");
  if (noteBtn) return openNote(Number(noteBtn.dataset.note));
  const verse = e.target.closest(".v");
  if (verse) toggleSelect(Number(verse.dataset.v));
});

// Swipe left/right to change chapter.
let touch = null;
reader.addEventListener("touchstart", (e) => {
  if (e.touches.length !== 1) return (touch = null);
  touch = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
}, { passive: true });
reader.addEventListener("touchend", (e) => {
  if (!touch || selection.size) return;
  const dx = e.changedTouches[0].clientX - touch.x;
  const dy = e.changedTouches[0].clientY - touch.y;
  const fast = Date.now() - touch.t < 600;
  touch = null;
  if (fast && Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 2) step(dx < 0 ? 1 : -1);
}, { passive: true });

document.addEventListener("keydown", (e) => {
  if (e.target.closest("input, textarea, select") || !$("#sheet").hidden) return;
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
    .map((t, i) => `<button class="tab${i === state.activeTab ? " active" : ""}" data-tab="${i}">
        <span>${esc(shortRef(t.b, t.c, i === state.activeTab ? null : t.v > 1 ? t.v : null))}</span>
        ${state.tabs.length > 1 ? `<span class="x" data-close="${i}" role="button" aria-label="关闭分页">${ICON.x}</span>` : ""}
      </button>`)
    .join("") + `<button class="tab-add" id="tab-add" aria-label="新分页">${ICON.plus}新分页</button>`;
  const active = strip.querySelector(".tab.active");
  active?.scrollIntoView({ inline: "nearest", block: "nearest" });
}

$("#tabstrip").addEventListener("click", (e) => {
  const close = e.target.closest("[data-close]");
  if (close) {
    const i = Number(close.dataset.close);
    state.tabs.splice(i, 1);
    if (state.activeTab >= i && state.activeTab > 0) state.activeTab--;
    persist("tabs", "activeTab");
    return render();
  }
  if (e.target.closest("#tab-add")) return openNavigator({ newTab: true });
  const tab = e.target.closest("[data-tab]");
  if (!tab) return;
  const i = Number(tab.dataset.tab);
  if (i === state.activeTab) return openNavigator();
  ttsStop();
  state.activeTab = i;
  persist("activeTab");
  render();
});

/* ============================================================
   Verse selection, highlight, underline, bookmark, copy
   ============================================================ */

const actionbar = $("#actionbar");
$("#colors").innerHTML = COLORS.map((c) => `<button data-c="${c}" aria-label="${COLOR_NAMES[c]}色"></button>`).join("");

function toggleSelect(v) {
  if (selection.has(v)) selection.delete(v);
  else selection.add(v);
  chapterEl.querySelector(`.v[data-v="${v}"]`)?.classList.toggle("sel", selection.has(v));
  updateActionbar();
}

function clearSelection() {
  selection.clear();
  $$(".v.sel", chapterEl).forEach((el) => el.classList.remove("sel"));
  updateActionbar();
}

function selectedKeys() {
  const { b, c } = activeTab();
  return [...selection].sort((a, z) => a - z).map((v) => vkey(b, c, v));
}

function updateActionbar() {
  const on = selection.size > 0;
  actionbar.hidden = !on;
  document.body.classList.toggle("selecting", on);
  if (!on) return;
  const keys = selectedKeys();
  const allBookmarked = keys.every((k) => state.bookmarks[k]);
  const bm = $('[data-act="bookmark"]', actionbar);
  bm.classList.toggle("on", allBookmarked);
  bm.querySelector("span").textContent = allBookmarked ? "取消书签" : "书签";
  const current = keys.length === 1 ? state.marks[keys[0]]?.[markMode] : null;
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

actionbar.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const keys = selectedKeys();
  const verses = [...selection].sort((a, z) => a - z);
  switch (btn.dataset.act) {
    case "note":
      openNote(verses[0]);
      break;
    case "bookmark": {
      const add = !keys.every((k) => state.bookmarks[k]);
      for (const k of keys) add ? (state.bookmarks[k] = Date.now()) : delete state.bookmarks[k];
      persist("bookmarks");
      verses.forEach(rerenderVerse);
      toast(add ? "已加入书签" : "已取消书签");
      clearSelection();
      break;
    }
    case "read":
      clearSelection();
      ttsStart(verses[0]);
      break;
    case "copy": {
      const text = copyText(verses);
      try {
        await navigator.clipboard.writeText(text);
        toast("已复制");
      } catch {
        toast("无法复制");
      }
      clearSelection();
      break;
    }
    case "clear":
      for (const k of keys) delete state.marks[k];
      persist("marks");
      verses.forEach(rerenderVerse);
      clearSelection();
      break;
    case "done":
      clearSelection();
  }
});

function copyText(verses) {
  const { b, c } = activeTab();
  const lines = [];
  for (const v of verses) {
    const el = chapterEl.querySelector(`.v[data-v="${v}"]`);
    const zh = el?.querySelector(".zh .t")?.textContent || "";
    const en = el?.querySelector(".en .t")?.textContent || "";
    lines.push(`${v} ${zh}${en ? "\n" + en : ""}`);
  }
  const first = verses[0], last = verses[verses.length - 1];
  const range = first === last ? `${first}` : `${first}-${last}`;
  const enName = versionMeta(englishVersion())?.short;
  return `${lines.join("\n")}\n— ${bookName(b)} ${c}:${range} / ${BOOKS[b].en} ${c}:${range}${enName ? ` (${enName})` : ""}`;
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
const MALE = /Li-?mu|Yu-?shu|Eddy|Grandpa|Reed|Rocko|Daniel|Alex|Aaron|Arthur|Gordon|Rishi|Tom|Oliver|Evan|Nathan|Kangkang|Yunxi|Yunyang|Yunjian|Danny|David|Mark|Guy|Eric|Ryan|Liam|Fred|Male/i;
const FEMALE = /Tingting|Ting-Ting|Meijia|Mei-Jia|Sinji|Lili|Shanshan|Flo|Grandma|Sandy|Shelley|Samantha|Karen|Moira|Tessa|Veena|Fiona|Victoria|Allison|Ava|Susan|Zoe|Nicky|Kate|Serena|Xiaoxiao|Huihui|Yaoyao|Hanhan|Tracy|Zira|Aria|Jenny|Female|Google 普通话|Google 國語|Google 粵語|Google US English/i;

function voiceGender(v) {
  if (MALE.test(v.name) && !/Female/i.test(v.name)) return "男声";
  if (FEMALE.test(v.name)) return "女声";
  return "";
}

function voiceRegion(v) {
  if (/^(zh[-_]HK|yue)/i.test(v.lang)) return "粤语";
  if (/^zh[-_]TW/i.test(v.lang)) return "国语·台湾";
  if (/^(zh|cmn)/i.test(v.lang)) return "普通话";
  if (/^en[-_]GB/i.test(v.lang)) return "UK";
  if (/^en[-_]AU/i.test(v.lang)) return "AU";
  if (/^en[-_]US/i.test(v.lang)) return "US";
  return v.lang;
}

/** Voices usable for a language, best first. */
function listVoices(lang) {
  const re = lang === "en" ? /^en/i : /^(zh|cmn|yue)/i;
  const all = synth ? synth.getVoices().filter((v) => re.test(v.lang) && !NOVELTY_VOICE.test(v.name)) : [];
  const rank = (v) => (NICE_VOICE.test(v.name) ? 0 : 1) + (lang === "en" ? (/^en[-_]US/i.test(v.lang) ? 0 : 2) : /^(zh[-_]HK|yue)/i.test(v.lang) ? 4 : /^zh[-_]TW/i.test(v.lang) ? 2 : 0);
  return all.sort((a, z) => rank(a) - rank(z) || a.name.localeCompare(z.name));
}

function pickVoice(lang) {
  const uri = lang === "en" ? state.settings.ttsEnVoice : state.settings.ttsZhVoice;
  const voices = listVoices(lang);
  return (uri && voices.find((v) => v.voiceURI === uri)) || voices[0] || null;
}

function utter(text, lang) {
  const u = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(lang);
  if (voice) u.voice = voice;
  u.lang = voice?.lang || (lang === "en" ? "en-US" : "zh-CN");
  u.rate = state.settings.ttsRate;
  return u;
}

function ttsParts(v) {
  const el = chapterEl.querySelector(`.v[data-v="${v}"]`);
  if (!el) return null;
  const mode = state.settings.ttsContent;
  const parts = [];
  const zh = el.querySelector(".zh .t")?.textContent.replace(/（注：[^）]*）/g, "");
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
  const u = utter(text, lang);
  const token = ++tts.token;
  const next = () => {
    if (token !== tts.token || !tts.playing) return;
    tts.part++;
    ttsSpeak();
  };
  u.onend = next;
  u.onerror = (e) => {
    if (e.error !== "interrupted" && e.error !== "canceled") next();
  };
  synth.speak(u);
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
  $("#pl-speed").textContent = `语速 ${state.settings.ttsRate}×`;
  const play = $("#pl-play");
  play.innerHTML = tts.playing ? PAUSE_ICON : PLAY_ICON;
  play.setAttribute("aria-label", tts.playing ? "暂停" : "继续");
}

async function keepAwake(on) {
  try {
    if (on && !tts.wake && navigator.wakeLock) tts.wake = await navigator.wakeLock.request("screen");
    if (!on && tts.wake) { await tts.wake.release(); tts.wake = null; }
  } catch {}
}

function ttsStart(v) {
  if (!synth) return toast("这个浏览器不支持朗读");
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

function ttsJump(delta) {
  const count = chapterEl.querySelectorAll(".v").length;
  tts.v = Math.min(Math.max(1, tts.v + delta), count);
  tts.part = 0;
  tts.token++;
  synth.cancel();
  if (tts.playing) ttsSpeak();
  else markReading();
}

$("#btn-tts").onclick = () => (tts.on ? ttsStop() : ttsStart());
$("#pl-play").onclick = () => (tts.playing ? ttsPause() : ttsResume());
$("#pl-stop").onclick = ttsStop;
$("#pl-prev").onclick = () => ttsJump(-1);
$("#pl-next").onclick = () => ttsJump(1);
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
    sel.innerHTML = voices.length
      ? `<option value="">自动（推荐）</option>` + voices.map((v) => {
          const tags = [voiceRegion(v), voiceGender(v)].filter(Boolean).join(" · ");
          return `<option value="${esc(v.voiceURI)}" ${v.voiceURI === cur ? "selected" : ""}>${esc(v.name.replace(/\s*\(.*\)$/, ""))}${tags ? " · " + esc(tags) : ""}</option>`;
        }).join("")
      : `<option value="">（这部设备没有${lang === "en" ? "英文" : "中文"}语音）</option>`;
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

/* ---------- Navigator: book → chapter → verse ---------- */

function openNavigator({ newTab = false } = {}) {
  const tab = activeTab();
  const body = openSheet(newTab ? "在新分页打开" : "选择经文", "", { tall: true });
  let pick = { b: null, c: null };

  const draw = () => {
    let html = `<form class="search" id="nav-search">
        ${ICON.search}
        <input id="nav-q" type="search" placeholder="输入经文，如 约3:16、罗8、John 3:16" autocomplete="off" enterkeyhint="go">
        <button class="go" type="submit">前往</button>
      </form>`;
    if (pick.b === null) {
      html += `<div class="nav-section">旧约 Old Testament</div><div class="grid">${bookButtons(0, 39, tab.b)}</div>
        <div class="nav-section">新约 New Testament</div><div class="grid">${bookButtons(39, 66, tab.b)}</div>`;
    } else if (pick.c === null) {
      const book = BOOKS[pick.b];
      html += `<div class="nav-crumb"><button data-back="book">‹ 全部书卷</button><strong>${esc(bookName(pick.b))}</strong><span class="hint">${esc(book.en)}</span></div>
        <div class="grid nums">${range(book.chapters).map((c) => `<button data-c="${c}" class="${pick.b === tab.b && c === tab.c ? "cur" : ""}">${c}</button>`).join("")}</div>`;
    } else {
      const n = (async () => (await getChapter(state.settings.zh, pick.b, pick.c))?.length || 0)();
      html += `<div class="nav-crumb"><button data-back="chapter">‹ ${esc(bookName(pick.b))}</button><strong>第 ${pick.c} ${pick.b === 18 ? "篇" : "章"}</strong>
        <button data-v="1" style="margin-left:auto">读整章</button></div>
        <div class="grid nums" id="verse-grid"><div class="hint">载入中…</div></div>`;
      n.then((count) => {
        const g = $("#verse-grid", body);
        if (g) g.innerHTML = range(count).map((v) => `<button data-v="${v}">${v}</button>`).join("");
      });
    }
    body.innerHTML = html;
    $("#nav-search", body).onsubmit = (e) => {
      e.preventDefault();
      const r = parseRef($("#nav-q", body).value);
      if (!r) return toast("找不到这段经文");
      closeSheet();
      go(r.book, r.chapter, r.verse, { flash: true, newTab });
    };
    body.scrollTop = 0;
    if (pick.b === null && !matchMedia("(pointer: coarse)").matches) $("#nav-q", body).focus({ preventScroll: true });
  };

  body.onclick = (e) => {
    const t = e.target.closest("button");
    if (!t || t.closest("form")) return;
    if (t.dataset.back === "book") pick = { b: null, c: null };
    else if (t.dataset.back === "chapter") pick.c = null;
    else if (t.dataset.b) {
      pick.b = Number(t.dataset.b);
      if (BOOKS[pick.b].chapters === 1) pick.c = 1;
    } else if (t.dataset.c) pick.c = Number(t.dataset.c);
    else if (t.dataset.v) {
      closeSheet();
      return go(pick.b, pick.c, Number(t.dataset.v), { flash: t.dataset.v !== "1" || false, newTab });
    } else return;
    draw();
    $("#sheet-body").scrollTop = 0;
  };
  draw();
}

const range = (n) => Array.from({ length: n }, (_, i) => i + 1);
const bookButtons = (from, to, cur) =>
  BOOKS.slice(from, to)
    .map((b) => `<button data-b="${b.i}" class="${b.i === cur ? "cur" : ""}">${esc(trad() ? b.zht.replace(/[書記]$/, "") : b.zh.replace(/[书记]$/, ""))}<small>${esc(b.enAbbr)}</small></button>`)
    .join("");

$("#btn-ref").onclick = () => openNavigator();

/* ---------- Note editor ---------- */

function openNote(v) {
  const { b, c } = activeTab();
  const k = vkey(b, c, v);
  const existing = state.notes[k];
  const verseEl = chapterEl.querySelector(`.v[data-v="${v}"]`);
  const zh = verseEl?.querySelector(".zh .t")?.textContent || "";
  const en = verseEl?.querySelector(".en .t")?.textContent || "";
  const body = openSheet("笔记", `
    <div class="note-ref">${esc(refText(b, c, v))} · ${esc(BOOKS[b].en)} ${c}:${v}</div>
    <div class="note-verse">${esc(zh)}${en ? `<div class="hint" style="margin-top:4px">${esc(en)}</div>` : ""}</div>
    <textarea class="note-input" id="note-text" placeholder="写下你的领受、默想或讲道笔记…">${esc(existing?.text || "")}</textarea>
    <div class="note-actions">
      ${existing ? '<button class="btn danger" id="note-del">删除</button>' : ""}
      <button class="btn" id="note-cancel">取消</button>
      <button class="btn primary" id="note-save">保存</button>
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
    toast(text ? "笔记已保存" : "笔记已删除");
  };
  const del = $("#note-del", body);
  if (del) del.onclick = () => {
    delete state.notes[k];
    persist("notes");
    closeSheet();
    rerenderVerse(v);
    clearSelection();
    toast("笔记已删除");
  };
}

/* ---------- Library: bookmarks, notes, marks, history ---------- */

let libTab = "bookmarks";

function openLibrary() {
  const body = openSheet("我的", "", { tall: true });
  const draw = () => {
    body.innerHTML = `<div class="seg full" id="lib-seg">
        ${[["bookmarks", "书签"], ["notes", "笔记"], ["marks", "画线"], ["history", "历史"]]
          .map(([id, label]) => `<button data-lib="${id}" class="${libTab === id ? "on" : ""}">${label}</button>`).join("")}
      </div><div id="lib-list"></div>`;
    $("#lib-seg", body).onclick = (e) => {
      const t = e.target.closest("[data-lib]");
      if (!t) return;
      libTab = t.dataset.lib;
      draw();
    };
    const list = $("#lib-list", body);
    ({ bookmarks: drawBookmarks, notes: drawNotes, marks: drawMarks, history: drawHistory })[libTab](list);
  };
  body.onclick = (e) => {
    const del = e.target.closest("[data-del]");
    if (del) {
      e.stopPropagation();
      const [kind, k] = del.dataset.del.split("|");
      if (kind === "bm") delete state.bookmarks[k];
      if (kind === "note" && confirm("删除这条笔记？")) delete state.notes[k];
      if (kind === "mark") delete state.marks[k];
      persist("bookmarks", "notes", "marks");
      draw();
      if (rendered) render({ scrollTo: topVisibleVerse() || activeTab().v });
      return;
    }
    const open = e.target.closest("[data-open]");
    if (open) {
      const { b, c, v } = parseKey(open.dataset.open);
      closeSheet();
      go(b, c, v, { flash: true });
    }
  };
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
  const keys = sortedKeys(state.bookmarks, (t) => t);
  if (!keys.length) return (list.innerHTML = emptyState("还没有书签。<br>点选经节后按「书签」即可加入。"));
  list.innerHTML = `<ul class="list">${keys.map((k) => {
    const { b, c, v } = parseKey(k);
    return `<li><div class="row"><button class="main" data-open="${k}" style="text-align:left">
        <div class="ref">${esc(refText(b, c, v))}</div><div class="sub" data-snippet="${k}"></div></button>
        <button class="del" data-del="bm|${k}" aria-label="删除">${ICON.trash}</button></div></li>`;
  }).join("")}</ul>`;
  fillSnippets(list);
}

function drawNotes(list) {
  const keys = sortedKeys(state.notes, (n) => n.t);
  if (!keys.length) return (list.innerHTML = emptyState("还没有笔记。<br>点选经节后按「笔记」即可记录。"));
  list.innerHTML = `<ul class="list">${keys.map((k) => {
    const { b, c, v } = parseKey(k);
    const n = state.notes[k];
    return `<li><div class="row"><button class="main" data-open="${k}" style="text-align:left">
        <div class="ref">${esc(refText(b, c, v))} <span class="hint">· ${fmtDate(n.t)}</span></div>
        <div class="sub note">${esc(n.text)}</div></button>
        <button class="del" data-del="note|${k}" aria-label="删除">${ICON.trash}</button></div></li>`;
  }).join("")}</ul>`;
}

function drawMarks(list) {
  const keys = sortedKeys(state.marks, (m) => m.t || 0);
  if (!keys.length) return (list.innerHTML = emptyState("还没有画线。<br>点选经节后选择颜色即可标记。"));
  list.innerHTML = `<ul class="list">${keys.map((k) => {
    const { b, c, v } = parseKey(k);
    const m = state.marks[k];
    const color = m.hl || m.ul;
    const style = m.hl ? `background:var(--hl-${m.hl})` : `border:2px solid var(--ul-${m.ul})`;
    return `<li><div class="row"><span class="dot" style="${style}" title="${COLOR_NAMES[color] || ""}"></span>
        <button class="main" data-open="${k}" style="text-align:left">
        <div class="ref">${esc(refText(b, c, v))}${m.ul ? ' <span class="hint">· 下划线</span>' : ""}</div><div class="sub" data-snippet="${k}"></div></button>
        <button class="del" data-del="mark|${k}" aria-label="删除">${ICON.trash}</button></div></li>`;
  }).join("")}</ul>`;
  fillSnippets(list);
}

function drawHistory(list) {
  if (!state.history.length) return (list.innerHTML = emptyState("还没有阅读记录。"));
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
      <span class="sub" style="display:block">${esc(BOOKS[h.b].en)} ${h.c}:${h.v}</span></span></button></li>`;
  }
  html += `</ul><div style="text-align:center;margin-top:18px"><button class="btn danger" id="clear-history">清除全部历史</button></div>`;
  list.innerHTML = html;
  $("#clear-history", list).onclick = (e) => {
    e.stopPropagation();
    if (!confirm("确定清除全部阅读历史？")) return;
    state.history = [];
    persist("history");
    drawHistory(list);
  };
}

const WEEK = ["日", "一", "二", "三", "四", "五", "六"];
function fmtDay(t) {
  const d = new Date(t);
  const today = new Date();
  const yest = new Date(Date.now() - 864e5);
  const same = (a, z) => a.toDateString() === z.toDateString();
  const label = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${WEEK[d.getDay()]}`;
  if (same(d, today)) return `今天 · ${label}`;
  if (same(d, yest)) return `昨天 · ${label}`;
  return label;
}
const pad = (n) => String(n).padStart(2, "0");
const fmtTime = (t) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fmtDate = (t) => { const d = new Date(t); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${fmtTime(t)}`; };

$("#btn-library").onclick = openLibrary;

/* ---------- Book introduction (导读) ---------- */

async function openIntro() {
  const { b } = activeTab();
  const book = BOOKS[b];
  const intro = INTRO[b];
  const [kc, kv] = intro.key.split(":").map(Number);
  const body = openSheet("导读 · Introduction", `<div class="intro">
    <h3>${esc(bookName(b))}</h3>
    <div class="en-title">${esc(book.en)} · ${book.nt ? "新约 New Testament" : "旧约 Old Testament"} · ${book.chapters} ${b === 18 ? "篇" : "章"}</div>
    <dl class="facts">
      <dt>作者</dt><dd>${esc(intro.zh.author)}<span class="e">${esc(intro.en.author)}</span></dd>
      <dt>年代</dt><dd>${esc(intro.zh.date)}<span class="e">${esc(intro.en.date)}</span></dd>
      <dt>主题</dt><dd>${esc(intro.zh.theme)}<span class="e">${esc(intro.en.theme)}</span></dd>
    </dl>
    <h4>概要 SUMMARY</h4>
    <p>${esc(intro.zh.summary)}</p>
    <p class="e">${esc(intro.en.summary)}</p>
    <h4>钥节 KEY VERSE</h4>
    <button class="keyverse" data-go="${kc}:${kv}" style="text-align:left;width:100%">
      <div class="r">${esc(refText(b, kc, kv))} · ${esc(book.enAbbr)} ${kc}:${kv}</div>
      <div id="kv-zh">…</div><div id="kv-en" class="hint" style="font-family:Georgia,serif;margin-top:4px"></div>
    </button>
    <h4>大纲 OUTLINE</h4>
    <div class="outline">${intro.outline.map(([c, zh, en]) => `<button data-go="${c}:1">
        <span class="c">${b === 18 ? "第" + c + "篇" : c + " 章"}</span><span>${esc(zh)}<span class="e">${esc(en)}</span></span></button>`).join("")}</div>
  </div>`, { tall: true });
  body.onclick = (e) => {
    const t = e.target.closest("[data-go]");
    if (!t) return;
    const [c, v] = t.dataset.go.split(":").map(Number);
    closeSheet();
    go(b, c, v, { flash: v > 1 });
  };
  const enId = englishVersion();
  const [zh, en] = await Promise.all([
    getChapter(state.settings.zh, b, kc).catch(() => null),
    enId ? getChapter(enId, b, kc).catch(() => null) : null,
  ]);
  if ($("#kv-zh", body)) $("#kv-zh", body).textContent = zh?.[kv - 1] || "";
  if ($("#kv-en", body)) $("#kv-en", body).textContent = en?.[kv - 1] || "";
}

$("#btn-intro").onclick = openIntro;

/* ---------- Settings ---------- */

function applySettings() {
  const s = state.settings;
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
  const body = openSheet("设置", `
    <div class="set-title">字体大小 FONT SIZE</div>
    <div class="set-group">
      <div class="set-row"><div class="font-row"><span class="a1">A</span>
        <input type="range" id="fs" min="14" max="32" step="1" value="${s.fontSize}" aria-label="字体大小">
        <span class="a2">A</span></div><strong id="fs-val" style="min-width:34px;text-align:right">${s.fontSize}</strong></div>
      <div class="font-preview"><div class="zh">神爱世人，甚至将他的独生子赐给他们。</div>
        <div class="en">For God so loved the world that he gave his one and only Son.</div></div>
    </div>

    <div class="set-title">外观 APPEARANCE</div>
    <div class="set-group"><div class="set-row">
      <div class="seg full" id="theme" style="flex:1">
        ${[["system", "跟随系统"], ["light", "浅色"], ["dark", "深色"]].map(([v, l]) => `<button data-theme="${v}" class="${s.theme === v ? "on" : ""}">${l}</button>`).join("")}
      </div></div></div>

    <div class="set-title">朗读 READ ALOUD</div>
    <div class="set-group">
      <div class="set-row"><span class="lbl" style="white-space:nowrap">朗读内容</span>
        <div class="seg" id="tts-content">${[["both", "中英"], ["zh", "中文"], ["en", "英文"]].map(([v, l]) => `<button data-v="${v}" class="${s.ttsContent === v ? "on" : ""}">${l}</button>`).join("")}</div></div>
      <div class="set-row"><label for="voice-zh" style="white-space:nowrap">中文声音</label>
        <div class="voice-pick"><select id="voice-zh"></select><button class="btn" data-preview="zh" aria-label="试听中文声音">▶</button></div></div>
      <div class="set-row"><label for="voice-en" style="white-space:nowrap">英文声音</label>
        <div class="voice-pick"><select id="voice-en"></select><button class="btn" data-preview="en" aria-label="试听英文声音">▶</button></div></div>
      <div class="set-row"><span class="lbl" style="white-space:nowrap">语速</span>
        <div class="seg" id="tts-rate">${RATES.map((r) => `<button data-v="${r}" class="${s.ttsRate === r ? "on" : ""}">${r}</button>`).join("")}</div></div>
      <div class="set-row"><span class="lbl hint" style="font-size:13px;line-height:1.6">想要更多声音（男声、粤语、高品质）？<br>
        iPhone/iPad：设置 → 辅助功能 → 朗读内容 → 声音，下载后回来这里选择。<br>
        Android：设置 → 文字转语音输出，安装语音数据。</span></div>
    </div>

    <div class="set-title">译本 VERSIONS</div>
    <div class="set-group">
      <div class="set-row"><label for="ver-zh">中文</label>
        <select id="ver-zh">${zhOpts.map((v) => `<option value="${v.id}" ${v.id === s.zh ? "selected" : ""}>${esc(v.name)}</option>`).join("")}</select></div>
      <div class="set-row"><label for="ver-en">English</label>
        <select id="ver-en">${enOpts.length ? enOpts.map((v) => `<option value="${v.id}" ${v.id === enId ? "selected" : ""}>${esc(v.name)}</option>`).join("") : '<option value="">（未导入）</option>'}</select></div>
      ${imported.map((v) => `<div class="set-row"><div class="lbl">${esc(v.name)}<small>已导入 · 只保存在这部设备</small></div>
        <button class="btn danger" data-remove="${v.id}">移除</button></div>`).join("")}
      <div class="set-row"><div class="lbl">导入译本<small>选择 JSON 文件（例如 en_niv.json）</small></div>
        <button class="btn primary" id="import-btn">导入…</button></div>
    </div>
    <div id="import-form"></div>

    <div class="set-title">数据 DATA</div>
    <div class="set-group">
      <div class="set-row"><div class="lbl">备份<small>导出书签、笔记、画线和历史</small></div><button class="btn" id="backup-export">导出</button></div>
      <div class="set-row"><div class="lbl">还原<small>从备份文件导入</small></div><button class="btn" id="backup-import">导入…</button></div>
    </div>
    <p class="about">经文：《和合本》(1919) 属公有领域。导入的译本只保存在你自己的设备上，不会上传。<br>
      ${BUILTIN.filter((v) => v.notice).map((v) => esc(v.notice) + "<br>").join("")}
      小贴士：点顶部的经文名称快速跳转；按「新分页」可同时打开多处经文，在不同章节之间一键切换。</p>
    <input type="file" id="file-version" accept=".json,application/json" hidden>
    <input type="file" id="file-backup" accept=".json,application/json" hidden>`, { tall: true });

  const fs = $("#fs", body);
  fs.oninput = () => {
    s.fontSize = Number(fs.value);
    $("#fs-val", body).textContent = s.fontSize;
    applySettings();
    persist("settings");
  };
  $("#theme", body).onclick = (e) => {
    const t = e.target.closest("[data-theme]");
    if (!t) return;
    s.theme = t.dataset.theme;
    $$("#theme button", body).forEach((x) => x.classList.toggle("on", x === t));
    applySettings();
    persist("settings");
  };
  const segPick = (id, key, cast = String) => ($(id, body).onclick = (e) => {
    const t = e.target.closest("[data-v]");
    if (!t) return;
    s[key] = cast(t.dataset.v);
    $$(`${id} button`, body).forEach((x) => x.classList.toggle("on", x === t));
    persist("settings");
    updatePlayer();
  });
  segPick("#tts-content", "ttsContent");
  fillVoiceSelects(body);
  $("#voice-zh", body).onchange = (e) => { s.ttsZhVoice = e.target.value; persist("settings"); preview("zh"); };
  $("#voice-en", body).onchange = (e) => { s.ttsEnVoice = e.target.value; persist("settings"); preview("en"); };
  const preview = (lang) => {
    if (!synth) return toast("这个浏览器不支持朗读");
    if (tts.on) ttsStop();
    synth.cancel();
    synth.speak(utter(lang === "en" ? "For God so loved the world that he gave his one and only Son." : "神爱世人，甚至将他的独生子赐给他们。", lang));
  };
  $$("[data-preview]", body).forEach((b) => (b.onclick = () => preview(b.dataset.preview)));
  segPick("#tts-rate", "ttsRate", Number);
  $("#ver-zh", body).onchange = (e) => { s.zh = e.target.value; persist("settings"); render(); prefetchVersion(s.zh); };
  $("#ver-en", body).onchange = (e) => { s.en = e.target.value || null; persist("settings"); render(); };
  $$("[data-remove]", body).forEach((btn) => (btn.onclick = async () => {
    if (!confirm("从这部设备移除这个译本？")) return;
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
      <div class="field">名称<input id="imp-name" value="${esc(meta.short)}"></div>
      <div class="field">语言<select id="imp-lang"><option value="en" ${meta.lang === "en" ? "selected" : ""}>English</option><option value="zh" ${meta.lang === "zh" ? "selected" : ""}>中文</option></select></div>
      <div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn" id="imp-cancel">取消</button><button class="btn primary" id="imp-ok">导入</button></div>
    </div>`;
    form.scrollIntoView({ behavior: "smooth", block: "center" });
    $("#imp-cancel", form).onclick = () => { form.innerHTML = ""; fileVersion.value = ""; };
    $("#imp-ok", form).onclick = async () => {
      const name = $("#imp-name", form).value.trim() || meta.short;
      const lang = $("#imp-lang", form).value;
      $("#imp-ok", form).disabled = true;
      $("#imp-ok", form).textContent = "导入中…";
      try {
        const v = await importVersion(file, { name, short: name.slice(0, 12), lang });
        if (lang === "en") s.en = v.id;
        else s.zh = v.id;
        persist("settings");
        toast(`已导入 ${name}`);
        render();
        openSettings();
      } catch (err) {
        alert("导入失败：" + err.message);
        $("#imp-ok", form).disabled = false;
        $("#imp-ok", form).textContent = "导入";
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
      toast("已还原备份");
      render();
    } catch (err) {
      alert("还原失败：" + err.message);
    }
  };
  if (focusImport) setTimeout(() => $("#import-btn", body).scrollIntoView({ block: "center" }), 50);
}

$("#btn-settings").onclick = () => openSettings();
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applySettings);

/* ============================================================
   Start
   ============================================================ */

(async function start() {
  applySettings();
  await loadImported();
  if (!hasVersion(state.settings.zh)) state.settings.zh = "cuv";
  // Allow deep links like #约3:16 or #John3:16
  const hash = decodeURIComponent(location.hash.slice(1));
  const r = hash && parseRef(hash);
  if (r) Object.assign(activeTab(), { b: r.book, c: r.chapter, v: r.verse || 1 });
  await render({ flash: !!r?.verse });
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
