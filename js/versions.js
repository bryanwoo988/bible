// Bible text sources: built-in versions (static files under data/) and
// versions the user imports on their own device (stored in IndexedDB).
import { idb } from "./store.js";

export const BUILTIN = [
  { id: "cuv", name: "和合本（简体）", short: "和合本", lang: "zh" },
  { id: "cuvt", name: "和合本（繁體）", short: "和合本繁", lang: "zh" },
  {
    id: "niv", name: "NIV (New International Version)", short: "NIV", lang: "en",
    notice: "Scripture quotations taken from The Holy Bible, New International Version® NIV®. Copyright © 1973, 1978, 1984, 2011 by Biblica, Inc.™ Used by permission. All rights reserved worldwide.",
  },
];

const imported = new Map(); // id -> { id, name, short, lang, books }
const bookCache = new Map(); // "ver/book" -> chapters[][]

export async function loadImported() {
  try {
    for (const v of await idb.list()) imported.set(v.id, v);
  } catch (e) {
    console.warn("IndexedDB unavailable", e);
  }
}

export function allVersions() {
  return [...BUILTIN, ...[...imported.values()].map(({ books, ...meta }) => meta)];
}

export const hasVersion = (id) => BUILTIN.some((v) => v.id === id) || imported.has(id);
export const versionMeta = (id) => allVersions().find((v) => v.id === id);

/** Chapters of a book as arrays of verse strings, or null if unavailable. */
export async function getBook(id, book) {
  if (!id) return null;
  const imp = imported.get(id);
  if (imp) return imp.books[book] || null;
  if (!BUILTIN.some((v) => v.id === id)) return null;
  const key = `${id}/${book}`;
  if (!bookCache.has(key)) {
    bookCache.set(
      key,
      fetch(`data/${id}/${book + 1}.json`).then((r) => {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      }).catch((e) => {
        bookCache.delete(key);
        throw e;
      }),
    );
  }
  return bookCache.get(key);
}

export async function getChapter(id, book, chapter) {
  const b = await getBook(id, book);
  return b ? b[chapter - 1] || [] : null;
}

/** Warm the HTTP/service-worker cache with every book of a built-in version. */
export async function prefetchVersion(id) {
  if (!BUILTIN.some((v) => v.id === id)) return;
  for (let b = 0; b < 66; b++) {
    try {
      await getBook(id, b);
    } catch {
      return;
    }
  }
}

/* ---------- Import ---------- */

// Verses some modern translations (NIV, ESV, CSB…) move to footnotes. Files from
// github.com/thiagobodruk/bible simply drop them, which shifts every following
// verse number; re-insert a blank so numbering lines up with 和合本.
// [book index, chapter, verse, full verse count of that chapter]
const OMITTED = [
  [39, 17, 21, 27], [39, 18, 11, 35], [39, 23, 14, 39],
  [40, 7, 16, 37], [40, 9, 44, 50], [40, 9, 46, 50], [40, 11, 26, 33], [40, 15, 28, 47],
  [41, 17, 36, 37], [41, 23, 17, 56],
  [42, 5, 4, 47],
  [43, 8, 37, 40], [43, 15, 34, 41], [43, 24, 7, 27], [43, 28, 29, 31],
  [44, 16, 24, 27],
];

function normaliseBooks(json) {
  let books;
  if (Array.isArray(json) && json.length === 66 && Array.isArray(json[0]?.chapters)) {
    books = json.map((b) => b.chapters); // thiagobodruk format
  } else if (Array.isArray(json?.books) && json.books.length === 66) {
    books = json.books; // this app's format
  } else if (Array.isArray(json) && json.length === 66 && Array.isArray(json[0])) {
    books = json;
  } else {
    throw new Error("无法识别的文件格式（需要 66 卷书的 JSON）");
  }
  books = books.map((chs) => chs.map((vs) => vs.map((v) => (typeof v === "string" ? v.trim() : String(v ?? "")))));
  for (const [b, c, v, full] of OMITTED) {
    const ch = books[b]?.[c - 1];
    if (ch && ch.length < full) ch.splice(v - 1, 0, "");
  }
  return books;
}

export function guessMeta(filename) {
  const base = filename.replace(/\.json$/i, "");
  const m = base.match(/^([a-z]{2})[_-](.+)$/i);
  const lang = m ? (m[1].toLowerCase() === "zh" ? "zh" : "en") : /[一-鿿]/.test(base) ? "zh" : "en";
  const short = (m ? m[2] : base).toUpperCase().slice(0, 12);
  return { lang, short };
}

export async function importVersion(file, { name, short, lang }) {
  const text = await file.text();
  const books = normaliseBooks(JSON.parse(text.replace(/^﻿/, "")));
  const id = "u_" + short.toLowerCase().replace(/[^a-z0-9]+/g, "") + "_" + lang;
  const v = { id, name: name || short, short, lang, books };
  await idb.put(v);
  imported.set(id, v);
  return v;
}

export async function removeVersion(id) {
  await idb.del(id);
  imported.delete(id);
}
