// What changed in each version, newest first. Every update adds an entry here
// (and bumps VERSION in sw.js); after an update the app shows the new entries
// once, and Settings → "What's new" lists them all (whatsnew.js).
export const RELEASES = [
  {
    v: "1.2.0", date: "2026-10-13",
    notes: {
      zh: [
        "「设定」里新增二维码和「分享 App 链接」按钮，别人扫一下就能打开",
        "「设定」显示版本号和这一版的更新日期、时间",
        "App 开着的时候如果有新版本，会出现提示，可以选择「立即更新」或「稍后」",
      ],
      zht: [
        "「設定」裡新增二維碼和「分享 App 連結」按鈕，別人掃一下就能開啟",
        "「設定」顯示版本號和這一版的更新日期、時間",
        "App 開著的時候如果有新版本，會出現提示，可以選擇「立即更新」或「稍後」",
      ],
      en: [
        "Settings now has a QR code and a \u201cShare the app link\u201d button, so others can open the app with one scan",
        "Settings shows the version and the date and time of this update",
        "If a new version comes out while the app is open, a bar offers \u201cUpdate now\u201d or \u201cLater\u201d",
      ],
    },
  },
  {
    v: "1.1.0", date: "2026-10-13",
    notes: {
      zh: ["App 更新后会自动弹出「更新了什么」：版本号、日期和改动内容；在「设定」最下面可以随时查看全部更新记录"],
      zht: ["App 更新後會自動彈出「更新了什麼」：版本號、日期和改動內容；在「設定」最下面可以隨時查看全部更新記錄"],
      en: ["After an update the app now shows what changed: the version, the date and what is new; the full list is at the bottom of Settings"],
    },
  },
  {
    v: "1.0.1", date: "2026-10-12",
    notes: {
      zh: [
        "修好：打开圣经会把同一个网站上其他 App（植物生理学等）的离线资料删掉；已下载的经文会保留，不必重新下载",
        "搜索支持「约翰福音第3章16节」「诗篇第23篇」这种写法",
        "恢复备份时可以再次选择同一个备份文件",
      ],
      zht: [
        "修好：打開聖經會把同一個網站上其他 App（植物生理學等）的離線資料刪掉；已下載的經文會保留，不必重新下載",
        "搜尋支援「約翰福音第3章16節」「詩篇第23篇」這種寫法",
        "還原備份時可以再次選擇同一個備份檔案",
      ],
      en: [
        "Fixed: opening the Bible deleted the offline copies of the other apps on the same site (Plant Physiology…); downloaded text is kept, not downloaded again",
        "Search understands references written like 约翰福音第3章16节 and 诗篇第23篇",
        "Restoring a backup works when the same backup file is picked again",
      ],
    },
  },
  {
    v: "1.0.0", date: "2026-10-12",
    notes: {
      zh: ["第一版：和合本（简体 / 繁體）与 NIV 中英对照，朗读、画线、笔记、书签、阅读历史、多分页，可离线使用"],
      zht: ["第一版：和合本（簡體 / 繁體）與 NIV 中英對照，朗讀、畫線、筆記、書籤、閱讀歷史、多分頁，可離線使用"],
      en: ["First release: Chinese Union Version (simplified / traditional) side by side with the NIV, read-aloud, highlights, notes, bookmarks, reading history and tabs, usable offline"],
    },
  },
];
export const APP_VERSION = RELEASES[0].v;
