// What changed in each version, newest first. Every update adds an entry here
// (and bumps VERSION in sw.js); after an update the app shows the new entries
// once, and Settings → "What's new" lists them all (whatsnew.js).
export const RELEASES = [
  {
    v: "1.5.2", date: "2026-10-23",
    notes: {
      zh: [
        "修好：部分 Android 手机朗读时没有声音、经文一节节飞快跳过。现在会先换用手机自己的声音再试；还是没声音就停下来，并说明怎样设定手机",
        "朗读开始前会等手机的声音列表准备好，第一次按朗读更可靠",
      ],
      zht: [
        "修好：部分 Android 手機朗讀時沒有聲音、經文一節節飛快跳過。現在會先換用手機自己的聲音再試；還是沒聲音就停下來，並說明怎樣設定手機",
        "朗讀開始前會等手機的聲音列表準備好，第一次按朗讀更可靠",
      ],
      en: [
        "Fixed: on some Android phones read-aloud made no sound and raced through the verses. It now retries with the phone's own voice, and if there is still no sound it stops and explains how to set up the phone",
        "Read-aloud now waits for the phone's voice list before starting, so the first tap on Listen works more reliably",
      ],
    },
  },
  {
    v: "1.5.1", date: "2026-10-23",
    notes: {
      zh: ["点正在看的分页不会再跳到章数页，按住拖动排列分页时不怕误触；要换章请点上面的书名或底部的「内容」"],
      zht: ["點正在看的分頁不會再跳到章數頁，按住拖動排列分頁時不怕誤觸；要換章請點上面的書名或底部的「內容」"],
      en: ["Tapping the tab you are reading no longer opens the chapter numbers, so reordering tabs is safe from mis-taps; to change chapter, tap the book name at the top or \u201cBible\u201d at the bottom"],
    },
  },
  {
    v: "1.5.0", date: "2026-10-23",
    notes: {
      zh: [
        "读经时点上面的书名（如「诗篇 23」）、当前分页或底部的「内容」，会直接打开这卷书的章数，一按就能换到别的章（例如从诗篇 23 篇到第 1 篇），不必再去旧约里找诗篇",
        "要换别的书卷，在章数页按左上角「内容」或再按一次底部的「内容」",
        "修好：用经文出处（如「诗23」）跳过去后，下次回到「内容」页，书卷列表不会再被旧的搜索字挡住",
      ],
      zht: [
        "讀經時點上面的書名（如「詩篇 23」）、目前分頁或底部的「內容」，會直接開啟這卷書的章數，一按就能換到別的章（例如從詩篇 23 篇到第 1 篇），不必再去舊約裡找詩篇",
        "要換別的書卷，在章數頁按左上角「內容」或再按一次底部的「內容」",
        "修好：用經文出處（如「詩23」）跳過去後，下次回到「內容」頁，書卷列表不會再被舊的搜尋字擋住",
      ],
      en: [
        "While reading, tapping the book name at the top (such as \u201cPsalms 23\u201d), the current tab or \u201cBible\u201d at the bottom now opens that book's chapter numbers, so you can jump from Psalm 23 to Psalm 1 in one tap",
        "To pick another book, tap \u201cBooks\u201d at the top left of the chapter page, or tap \u201cBible\u201d at the bottom again",
        "Fixed: after jumping to a reference (such as \u201cPs 23\u201d), the book list is no longer hidden by the old search the next time",
      ],
    },
  },
  {
    v: "1.4.0", date: "2026-10-18",
    notes: {
      zh: [
        "设置 → 外观里新增 4 种浅色主题（经典、纸张、薄荷、薰衣草）和 4 种深色主题（午夜、纯黑 OLED、石板、葡萄）",
        "「跟随系统」时，手机为浅色就用你选的浅色主题，为深色就用你选的深色主题",
      ],
      zht: [
        "設定 → 外觀裡新增 4 種淺色主題（經典、紙張、薄荷、薰衣草）和 4 種深色主題（午夜、純黑 OLED、石板、葡萄）",
        "「跟隨系統」時，手機為淺色就用你選的淺色主題，為深色就用你選的深色主題",
      ],
      en: [
        "Settings → Appearance now offers four light themes (Classic, Paper, Mint, Lavender) and four dark themes (Midnight, OLED Black, Slate, Grape)",
        "In Follow system mode the app uses your chosen light theme when your phone is light and your dark theme when it is dark",
      ],
    },
  },
  {
    v: "1.3.0", date: "2026-10-18",
    notes: {
      zh: [
        "「内容」页的搜索框可以搜关键字了：输入「神爱世人」或「love」，马上列出所有含这些字的经文，关键字会标亮",
        "搜索结果上方按书卷分类，点一卷书（如「诗篇 52」）就只看那卷，更快找到要的章节",
        "点结果打开经文，那一章里的关键字也会标出来；多个字用空格隔开，会找同时含有这些字的经文",
      ],
      zht: [
        "「內容」頁的搜尋框可以搜關鍵字了：輸入「神愛世人」或「love」，馬上列出所有含這些字的經文，關鍵字會標亮",
        "搜尋結果上方按書卷分類，點一卷書（如「詩篇 52」）就只看那卷，更快找到要的章節",
        "點結果開啟經文，那一章裡的關鍵字也會標出來；多個字用空格隔開，會找同時含有這些字的經文",
      ],
      en: [
        "The search box on the book list now finds words: type \u201cfaith\u201d or \u201c神爱世人\u201d to list every verse that contains them, with the words highlighted",
        "Above the results, tap a book (such as \u201cPsalms 52\u201d) to see only that book and get to the right chapter faster",
        "Opening a result marks the words in that chapter too; separate several words with spaces to find verses that contain all of them",
      ],
    },
  },
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
