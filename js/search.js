// Keyword search over the text of a version, with highlighted matches.
import { getBook } from "./versions.js";

const CJK = /[㐀-鿿豈-﫿]/;
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const hasCjk = (s) => CJK.test(s);

/** Search words: split on spaces and commas; a verse must contain all of them. */
export function searchTerms(query) {
  const terms = [...new Set(query.trim().split(/[\s,，、;；]+/).filter(Boolean))];
  // A single Latin letter matches nearly every verse; wait for more.
  return terms.filter((w) => hasCjk(w) || w.length >= 2);
}

/** Case-insensitive regex for any of the terms, longest first. */
export function termsRegex(terms) {
  if (!terms.length) return null;
  return new RegExp([...terms].sort((a, z) => z.length - a.length).map(escRe).join("|"), "gi");
}

/** Text as HTML with every match wrapped in <mark>. */
export function highlightHTML(text, re) {
  if (!re) return escHtml(text);
  re.lastIndex = 0;
  let out = "", last = 0;
  for (const m of text.matchAll(re)) {
    out += escHtml(text.slice(last, m.index)) + `<mark>${escHtml(m[0])}</mark>`;
    last = m.index + m[0].length;
  }
  return out + escHtml(text.slice(last));
}

/** Wrap matches inside the text nodes of el with <mark class="kw"> (text content is unchanged). */
export function highlightDOM(el, re) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const text = node.nodeValue;
    re.lastIndex = 0;
    const matches = [...text.matchAll(re)];
    if (!matches.length) continue;
    const frag = document.createDocumentFragment();
    let last = 0;
    for (const m of matches) {
      frag.append(text.slice(last, m.index));
      const mark = document.createElement("mark");
      mark.className = "kw";
      mark.textContent = m[0];
      frag.append(mark);
      last = m.index + m[0].length;
    }
    frag.append(text.slice(last));
    node.replaceWith(frag);
  }
}

/**
 * Every verse of a version containing all the terms, in Bible order:
 * [{ b, c, v, text }]. Loads all 66 books (cached after the first search).
 */
export async function searchVersion(id, terms, onProgress) {
  const lower = terms.map((w) => w.toLowerCase());
  let done = 0;
  const books = await Promise.all(Array.from({ length: 66 }, (_, b) =>
    getBook(id, b).then((x) => {
      onProgress?.(++done / 66);
      return x;
    })));
  const hits = [];
  books.forEach((chapters, b) => {
    chapters?.forEach((verses, ci) => {
      verses.forEach((text, vi) => {
        if (!text) return;
        const l = text.toLowerCase();
        if (lower.every((w) => l.includes(w))) hits.push({ b, c: ci + 1, v: vi + 1, text });
      });
    });
  });
  return hits;
}
