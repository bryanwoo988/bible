// 66 books: [简体名, 繁體名, 简称, English name, English abbreviation, chapters, extra search aliases]
export const BOOKS = [
  ["创世记", "創世記", "创", "Genesis", "Gen", 50, "gn ge"],
  ["出埃及记", "出埃及記", "出", "Exodus", "Exod", 40, "ex exo"],
  ["利未记", "利未記", "利", "Leviticus", "Lev", 27, "lv le"],
  ["民数记", "民數記", "民", "Numbers", "Num", 36, "nm nu"],
  ["申命记", "申命記", "申", "Deuteronomy", "Deut", 34, "dt de"],
  ["约书亚记", "約書亞記", "书", "Joshua", "Josh", 24, "js jos"],
  ["士师记", "士師記", "士", "Judges", "Judg", 21, "jdg jg"],
  ["路得记", "路得記", "得", "Ruth", "Ruth", 4, "rt ru"],
  ["撒母耳记上", "撒母耳記上", "撒上", "1 Samuel", "1 Sam", 31, "1sa 1s"],
  ["撒母耳记下", "撒母耳記下", "撒下", "2 Samuel", "2 Sam", 24, "2sa 2s"],
  ["列王纪上", "列王紀上", "王上", "1 Kings", "1 Kgs", 22, "1ki 1k"],
  ["列王纪下", "列王紀下", "王下", "2 Kings", "2 Kgs", 25, "2ki 2k"],
  ["历代志上", "歷代志上", "代上", "1 Chronicles", "1 Chr", 29, "1ch"],
  ["历代志下", "歷代志下", "代下", "2 Chronicles", "2 Chr", 36, "2ch"],
  ["以斯拉记", "以斯拉記", "拉", "Ezra", "Ezra", 10, "ezr"],
  ["尼希米记", "尼希米記", "尼", "Nehemiah", "Neh", 13, "ne"],
  ["以斯帖记", "以斯帖記", "斯", "Esther", "Esth", 10, "est es"],
  ["约伯记", "約伯記", "伯", "Job", "Job", 42, "jb"],
  ["诗篇", "詩篇", "诗", "Psalms", "Ps", 150, "psa psalm pss"],
  ["箴言", "箴言", "箴", "Proverbs", "Prov", 31, "pr pro prv"],
  ["传道书", "傳道書", "传", "Ecclesiastes", "Eccl", 12, "ec ecc qoh"],
  ["雅歌", "雅歌", "歌", "Song of Songs", "Song", 8, "so sos sng song of solomon"],
  ["以赛亚书", "以賽亞書", "赛", "Isaiah", "Isa", 66, "is"],
  ["耶利米书", "耶利米書", "耶", "Jeremiah", "Jer", 52, "je jr"],
  ["耶利米哀歌", "耶利米哀歌", "哀", "Lamentations", "Lam", 5, "la"],
  ["以西结书", "以西結書", "结", "Ezekiel", "Ezek", 48, "eze ezk"],
  ["但以理书", "但以理書", "但", "Daniel", "Dan", 12, "dn da"],
  ["何西阿书", "何西阿書", "何", "Hosea", "Hos", 14, "ho"],
  ["约珥书", "約珥書", "珥", "Joel", "Joel", 3, "jl joe"],
  ["阿摩司书", "阿摩司書", "摩", "Amos", "Amos", 9, "am"],
  ["俄巴底亚书", "俄巴底亞書", "俄", "Obadiah", "Obad", 1, "ob oba"],
  ["约拿书", "約拿書", "拿", "Jonah", "Jonah", 4, "jon jnh"],
  ["弥迦书", "彌迦書", "弥", "Micah", "Mic", 7, "mi"],
  ["那鸿书", "那鴻書", "鸿", "Nahum", "Nah", 3, "na"],
  ["哈巴谷书", "哈巴谷書", "哈", "Habakkuk", "Hab", 3, "hb"],
  ["西番雅书", "西番雅書", "番", "Zephaniah", "Zeph", 3, "zep zp"],
  ["哈该书", "哈該書", "该", "Haggai", "Hag", 2, "hg"],
  ["撒迦利亚书", "撒迦利亞書", "亚", "Zechariah", "Zech", 14, "zec zc"],
  ["玛拉基书", "瑪拉基書", "玛", "Malachi", "Mal", 4, "ml"],
  ["马太福音", "馬太福音", "太", "Matthew", "Matt", 28, "mt mat"],
  ["马可福音", "馬可福音", "可", "Mark", "Mark", 16, "mk mc mr mrk"],
  ["路加福音", "路加福音", "路", "Luke", "Luke", 24, "lk lu luk"],
  ["约翰福音", "約翰福音", "约", "John", "John", 21, "jn jo jhn"],
  ["使徒行传", "使徒行傳", "徒", "Acts", "Acts", 28, "ac act"],
  ["罗马书", "羅馬書", "罗", "Romans", "Rom", 16, "ro rm"],
  ["哥林多前书", "哥林多前書", "林前", "1 Corinthians", "1 Cor", 16, "1co"],
  ["哥林多后书", "哥林多後書", "林后", "2 Corinthians", "2 Cor", 13, "2co"],
  ["加拉太书", "加拉太書", "加", "Galatians", "Gal", 6, "ga"],
  ["以弗所书", "以弗所書", "弗", "Ephesians", "Eph", 6, "ep"],
  ["腓立比书", "腓立比書", "腓", "Philippians", "Phil", 4, "php pp"],
  ["歌罗西书", "歌羅西書", "西", "Colossians", "Col", 4, "co"],
  ["帖撒罗尼迦前书", "帖撒羅尼迦前書", "帖前", "1 Thessalonians", "1 Thess", 5, "1th"],
  ["帖撒罗尼迦后书", "帖撒羅尼迦後書", "帖后", "2 Thessalonians", "2 Thess", 3, "2th"],
  ["提摩太前书", "提摩太前書", "提前", "1 Timothy", "1 Tim", 6, "1ti"],
  ["提摩太后书", "提摩太後書", "提后", "2 Timothy", "2 Tim", 4, "2ti"],
  ["提多书", "提多書", "多", "Titus", "Titus", 3, "tt tit"],
  ["腓利门书", "腓利門書", "门", "Philemon", "Phlm", 1, "phm flm"],
  ["希伯来书", "希伯來書", "来", "Hebrews", "Heb", 13, "he hb"],
  ["雅各书", "雅各書", "雅", "James", "Jas", 5, "jm ja"],
  ["彼得前书", "彼得前書", "彼前", "1 Peter", "1 Pet", 5, "1pe 1p"],
  ["彼得后书", "彼得後書", "彼后", "2 Peter", "2 Pet", 3, "2pe 2p"],
  ["约翰一书", "約翰一書", "约一", "1 John", "1 John", 5, "1jn 1jo 约壹"],
  ["约翰二书", "約翰二書", "约二", "2 John", "2 John", 1, "2jn 2jo 约贰"],
  ["约翰三书", "約翰三書", "约三", "3 John", "3 John", 1, "3jn 3jo 约叁"],
  ["犹大书", "猶大書", "犹", "Jude", "Jude", 1, "jd jud"],
  ["启示录", "啟示錄", "启", "Revelation", "Rev", 22, "re rv apocalypse"],
].map(([zh, zht, abbr, en, enAbbr, chapters, aliases], i) => ({
  i, zh, zht, abbr, en, enAbbr, chapters, aliases: aliases.split(" "),
  nt: i >= 39,
}));

// Traditional forms of the simplified abbreviations (for search input)
const TRAD_ABBR = { 书: "書", 数: "數", 记: "記", 诗: "詩", 传: "傳", 赛: "賽", 结: "結", 鸿: "鴻", 该: "該", 亚: "亞", 玛: "瑪", 约: "約", 罗: "羅", 后: "後", 门: "門", 来: "來", 犹: "猶", 启: "啟", 弥: "彌" };
export const toTrad = (s) => [...s].map((c) => TRAD_ABBR[c] || c).join("");

const norm = (s) => s.toLowerCase().replace(/[\s.]/g, "");

// Lookup keys sorted longest first so "约翰一书" wins over "约".
const KEYS = [];
for (const b of BOOKS) {
  const keys = new Set([b.zh, b.zht, b.abbr, toTrad(b.abbr), b.en, b.enAbbr, ...b.aliases]);
  if (b.zh.endsWith("书") || b.zh.endsWith("记")) keys.add(b.zh.slice(0, -1));
  if (b.zht.endsWith("書") || b.zht.endsWith("記")) keys.add(b.zht.slice(0, -1));
  for (const k of keys) KEYS.push([norm(k), b.i]);
}
KEYS.sort((a, b) => b[0].length - a[0].length);

/** Parse "约3:16", "John 3 16", "罗 8", "ps23" → {book, chapter, verse} or null. */
export function parseRef(input) {
  const s = norm(input).replace(/[：:，,章节篇]/g, " ").replace(/\s+/g, " ");
  const compact = s.replace(/ /g, "");
  for (const [key, book] of KEYS) {
    if (!key || !compact.startsWith(key)) continue;
    const rest = compact.slice(key.length);
    if (rest && !/^\d/.test(rest)) continue;
    // Recover chapter/verse split from the original spacing/punctuation.
    const nums = input.toLowerCase().replace(/^\D+/, "").split(/[^\d]+/).filter(Boolean).map(Number);
    let numbers = nums;
    if (/^\d/.test(key)) numbers = nums.slice(1); // "1 John 3:16" — drop the book's own digit
    const max = BOOKS[book].chapters;
    let chapter = numbers[0] || 1;
    let verse = numbers[1] || null;
    if (max === 1 && numbers.length === 1) { verse = chapter; chapter = 1; }
    if (chapter > max) return null;
    return { book, chapter, verse };
  }
  return null;
}
