// I18n — basit anahtar/değer sözlüğü, iki dil: tr / en.
// Kullanıcı dil seçimi localStorage'da saklanır.
// HTML elementlerinde data-i18n="key" → textContent otomatik çevrilir.
// Dinamik metin için: I18n.t("key", ...args).

const I18n = (() => {
  const KEY = "timeEcho.lang";
  let lang = localStorage.getItem(KEY);
  if (!lang) lang = (navigator.language || "tr").toLowerCase().startsWith("tr") ? "tr" : "en";
  if (lang !== "tr" && lang !== "en") lang = "tr";

  const D = {
    // ---- TITLE / MENU ----
    "menu.tagline":      { tr: "terk edilmiş bir uzay istasyonu · zaman yankıları · senin geçmişin sana yardım edecek",
                           en: "an abandoned space station · time echoes · your past will save you" },
    "menu.start":        { tr: "YENİ DÖNGÜ",          en: "NEW LOOP" },
    "menu.tutorial":     { tr: "NASIL OYNANIR?",      en: "HOW TO PLAY?" },
    "menu.select":       { tr: "SEVİYE SEÇ",          en: "LEVEL SELECT" },
    "menu.editor":       { tr: "EDİTÖR",              en: "EDITOR" },
    "menu.version":      { tr: "SÜRÜM GEÇMİŞİ",       en: "VERSION HISTORY" },
    "menu.sound.on":     { tr: "SES: AÇIK",           en: "SOUND: ON" },
    "menu.sound.off":    { tr: "SES: KAPALI",         en: "SOUND: OFF" },
    "menu.lang":         { tr: "DİL: TR",             en: "LANG: EN" },

    // ---- HUD / GAME ----
    "hud.moves":         { tr: "HAMLE",               en: "MOVES" },
    "hud.rec":           { tr: "KAYIT",               en: "REC" },
    "hud.echo":          { tr: "ECHO",                en: "ECHO" },
    "hud.level":         { tr: "SEVİYE",              en: "LEVEL" },
    "hud.timer":         { tr: "SÜRE",                en: "TIME" },
    "hud.menu":          { tr: "MENÜ",                en: "MENU" },
    "hud.back":          { tr: "‹ MENÜ",              en: "‹ MENU" },

    // ---- TOASTS ----
    "toast.recorded":    { tr: "ECHO #{0} KAYDEDİLDİ", en: "ECHO #{0} RECORDED" },
    "toast.undone":      { tr: "SON YANKI SİLİNDİ",    en: "LAST ECHO UNDONE" },
    "toast.reset":       { tr: "SEVİYE SIFIRLANDI",    en: "LEVEL RESET" },
    "toast.bumped":      { tr: "DUVAR / KAPALI KAPI",  en: "BLOCKED" },
    "toast.noMoves":     { tr: "BOŞ KAYIT YOK",        en: "NOTHING TO RECORD" },
    "toast.noEcho":      { tr: "GERİ ALINACAK YANKI YOK", en: "NO ECHO TO UNDO" },

    // ---- LEGEND ----
    "legend.you":        { tr: "◆ sen",               en: "◆ you" },
    "legend.echo":       { tr: "◇ echo",              en: "◇ echo" },
    "legend.goal":       { tr: "✦ hedef",             en: "✦ goal" },
    "legend.plate":      { tr: "○ plaka",             en: "○ plate" },
    "legend.door":       { tr: "▤ kapı",              en: "▤ door" },
    "legend.portal":     { tr: "◉ portal",            en: "◉ portal" },
    "legend.laser":      { tr: "► lazer",             en: "► laser" },
    "legend.quantum":    { tr: "◈ quantum",            en: "◈ quantum" },
    "legend.box":        { tr: "☐ kutu",              en: "☐ box" },
    "legend.patrol":     { tr: "● devriye",           en: "● sentry" },
    "legend.fragile":    { tr: "◐ kırılgan plaka",    en: "◐ fragile plate" },
    "legend.wall":       { tr: "■ duvar",             en: "■ wall" },
    "legend.keys":       { tr: "[OK / WASD] hareket · [Q/E/X/C] çapraz · [R] echo kaydet · [Z] son echo'yu sil · [N] sıfırla · [M] sustur",
                           en: "[ARROWS / WASD] move · [Q/E/X/C] diagonal · [R] record echo · [Z] undo last echo · [N] reset · [M] mute" },

    // ---- LEVEL SELECT ----
    "select.title":      { tr: "// SEVİYE SEÇ",       en: "// LEVEL SELECT" },
    "select.levelLine":  { tr: "SEVİYE {0} · {1} HAMLE", en: "LEVEL {0} · {1} MOVES" },
    "select.continue":   { tr: "DEVAM ET",            en: "CONTINUE" },
    "select.pageInfo":   { tr: "SAYFA {0} / {1} · {2} SEVİYE",
                           en: "PAGE {0} / {1} · {2} LEVELS" },
    "select.generated":  { tr: "ÜRETİLEN",            en: "GENERATED" },
    "select.handMade":   { tr: "EL YAPIMI",           en: "HAND-MADE" },

    // ---- VERSION SCREEN ----
    "ver.title":         { tr: "// SÜRÜM GEÇMİŞİ",    en: "// VERSION HISTORY" },
    "ver.current":       { tr: " · GÜNCEL",           en: " · CURRENT" },

    // ---- OVERLAY BUTTONS ----
    "ov.start":          { tr: "BAŞLAT",              en: "START" },
    "ov.continue":       { tr: "DEVAM",               en: "CONTINUE" },
    "ov.next":           { tr: "SONRAKİ",             en: "NEXT" },
    "ov.menu":           { tr: "MENÜ",                en: "MENU" },
    "ov.retry":          { tr: "TEKRAR",              en: "RETRY" },
    "ov.clearEchoes":    { tr: "YANKILARI SİL",       en: "CLEAR ECHOES" },
    "ov.reset":          { tr: "SIFIRLA",             en: "RESET" },
    "ov.newEcho":        { tr: "YENİ YANKI [R]",      en: "NEW ECHO [R]" },
    "ov.outro":          { tr: "OUTRO",               en: "OUTRO" },
    "ov.toMenu":         { tr: "BAŞA DÖN",            en: "BACK TO MENU" },
    "ov.replay":         { tr: "TEKRAR İZLE",         en: "REPLAY" },
    "ov.replayDone":     { tr: "TEKRAR BİTTİ",       en: "REPLAY DONE" },
    "ov.toEditor":       { tr: "EDİTÖRE DÖN",         en: "BACK TO EDITOR" },

    // ---- OVERLAY TITLES / BODIES ----
    "ov.stabilized":     { tr: "STABILIZED",          en: "STABILIZED" },
    "ov.stabilized.body":{ tr: "Zaman çizgisi sabitlendi.", en: "Timeline stabilized." },
    "ov.stars":          { tr: "{0} YILDIZ", en: "{0} STARS" },
    "ov.stabilized.last":{ tr: "Tüm zaman çizgileri stabil. Başa dön?", en: "All timelines stable. Return to start?" },
    "ov.custom.win":     { tr: "Özel seviye tamamlandı.", en: "Custom level completed." },
    "ov.annihilated":    { tr: "ANNIHILATED",         en: "ANNIHILATED" },
    "ov.annihilated.body":{ tr: "Lazer seni eritti. Tekrar dene.", en: "The laser dissolved you. Try again." },
    "ov.outOfSync":      { tr: "OUT OF SYNC",         en: "OUT OF SYNC" },
    "ov.outOfSync.body": { tr: "Hamleler tükendi. Yankıların sırada.", en: "Moves exhausted. Your echoes are next." },

    // ---- FLASH MESSAGES ----
    "flash.noMoves":     { tr: "BOŞ KAYIT YOK",       en: "NO MOVES TO RECORD" },
    "flash.noEcho":      { tr: "YANKI YOK",           en: "NO ECHO TO UNDO" },
    "flash.muted":       { tr: "SES KAPALI",          en: "SOUND MUTED" },
    "flash.unmuted":     { tr: "SES AÇIK",            en: "SOUND ON" },
    "flash.lang":        { tr: "DİL: TÜRKÇE",         en: "LANG: ENGLISH" },

    // ---- EDITOR ----
    "ed.title":          { tr: "// EDİTÖR",           en: "// EDITOR" },
    "ed.name":           { tr: "AD",                  en: "NAME" },
    "ed.intro":          { tr: "GİRİŞ METNİ",         en: "INTRO TEXT" },
    "ed.width":          { tr: "EN",                  en: "WIDTH" },
    "ed.height":         { tr: "BOY",                 en: "HEIGHT" },
    "ed.moves":          { tr: "HAMLE",               en: "MOVES" },
    "ed.brush":          { tr: "FIRÇA",               en: "BRUSH" },
    "ed.clear":          { tr: "TEMİZLE",             en: "CLEAR" },
    "ed.test":           { tr: "TEST",                en: "TEST" },
    "ed.share":          { tr: "PAYLAŞ",              en: "SHARE" },
    "ed.shareBox":       { tr: "paylaşım bağlantısı burada görünecek", en: "share link will appear here" },
    "ed.linkCopied":     { tr: "BAĞLANTI KOPYALANDI", en: "LINK COPIED" },
    "ed.help":           { tr: "sol-tık: yerleştir · sağ-tık: sil<br>sürükleyerek boyayabilirsin<br>P/G yalnızca bir tane olabilir<br>lazerler için bağlama kod düzeyinde tanımlanır",
                           en: "left-click: place · right-click: erase<br>drag to paint<br>only one P/G allowed<br>laser bindings are defined in code" },
    "ed.defaultName":    { tr: "ÖZEL SEVİYE",         en: "CUSTOM LEVEL" },
    "ed.defaultIntro":   { tr: "Kendi yankı düzeneğin.", en: "Your own echo contraption." },
    "ed.customLabel":    { tr: "ÖZEL",                en: "CUSTOM" },
    "ed.shared":         { tr: "PAYLAŞILAN",          en: "SHARED" },
    "ed.save":           { tr: "KAYDET",              en: "SAVE" },
    "ed.gallery":        { tr: "GALERİ",              en: "GALLERY" },
    "ed.galEmpty":       { tr: "Kaydedilmiş seviye yok.", en: "No saved levels." },
    "ed.galTitle":       { tr: "// GALERİ",           en: "// GALLERY" },
    "ed.galLoad":        { tr: "YÜKLE",               en: "LOAD" },
    "ed.galDel":         { tr: "SİL",                 en: "DELETE" },
    "ed.saved":          { tr: "KAYDEDİLDİ",          en: "SAVED" },
    "ed.deleted":        { tr: "SİLİNDİ",             en: "DELETED" },

    // ---- EDITOR TOOLS ----
    "tool.floor":        { tr: "ZEMİN",               en: "FLOOR" },
    "tool.wall":         { tr: "DUVAR",               en: "WALL" },
    "tool.start":        { tr: "BAŞLANGIÇ",           en: "START" },
    "tool.goal":         { tr: "HEDEF",               en: "GOAL" },
    "tool.plate":        { tr: "PLAKA",               en: "PLATE" },
    "tool.door":         { tr: "KAPI",                en: "DOOR" },
    "tool.portal":       { tr: "PORTAL",              en: "PORTAL" },
    "tool.laser":        { tr: "LAZER",               en: "LASER" },
    "tool.quantum":      { tr: "QUANTUM",             en: "QUANTUM" },
    "tool.box":          { tr: "KUTU",                en: "BOX" },
  };

  function t(key, ...args) {
    const entry = D[key];
    let s = (entry && (entry[lang] || entry.tr)) || key;
    if (args.length) s = s.replace(/\{(\d+)\}/g, (_, i) => args[i]);
    return s;
  }

  function set(l) {
    if (l !== "tr" && l !== "en") return;
    lang = l;
    try { localStorage.setItem(KEY, l); } catch (e) {}
    apply();
  }
  function toggle() { set(lang === "tr" ? "en" : "tr"); }
  function get() { return lang; }

  // DOM'da data-i18n="key" olan tüm elementlerin textContent'ini günceller.
  // data-i18n-html="key" ise innerHTML olarak yazar (HTML entity'leri saklamak için).
  function apply() {
    document.querySelectorAll("[data-i18n]").forEach(el => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-html]").forEach(el => {
      el.innerHTML = t(el.dataset.i18nHtml);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    document.documentElement.lang = lang;
    // Dış kodun yeniden render etmesi için event yay
    document.dispatchEvent(new CustomEvent("i18n:changed", { detail: { lang } }));
  }

  return { t, set, toggle, get, apply };
})();
