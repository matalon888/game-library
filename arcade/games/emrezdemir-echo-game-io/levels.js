// Hücre kodları:
//   .  boş zemin
//   #  duvar
//   P  oyuncu başlangıç
//   G  hedef
//   Q  quantum tile (her turda duvar↔zemin)
//   B  itilebilir kutu
//   X  devriye düşmanı (oscillating; ölümcül temas)
//   a-z plaka
//   A-Z kapı   (plaka 'a' aktifken kapı 'A' açılır)
//   1-9 portal (aynı rakamlı iki portal birbirine ışınlar)
//   ^v<>  lazer yayıcı
//
// Seviye attribute'ları:
//   fragile: ['a']      → 'a' plakası tek kullanımlık; basıldığı anda 'A' kapısı kalıcı açılır
//   patrols: [{x, y, dx, dy}] → 'X' başlangıç yönü override (varsayılan: ilk boş komşu)
//
// İsim ve intro alanları iki dilli: { tr: "...", en: "..." }
// game.js içindeki levelText() helper'ı mevcut dile göre seçer.

let LEVELS = [
  {
    name:  { tr: "İLK YANKI",       en: "FIRST ECHO" },
    intro: {
      tr: "① Plakaya (◯ a) yürü.  ② [R] bas — yankın oluşur.  ③ Sen başa dönersin, yankı plakada beklerken sen kapıdan ✦'e geçersin.  Tek başına geçemezsin — yankın lazım.",
      en: "① Walk to plate (◯ a).  ② Press [R] — your echo is born.  ③ You return to start; while the echo holds the plate, you walk through the door to ✦.  You can't solo it — you need your echo.",
    },
    moves: 14,
    grid: [
      "#######",
      "#P..a.#",
      "#.#####",
      "#.A..G#",
      "#######",
    ],
  },

  {
    name:  { tr: "ÇİFT DOLAŞIK",    en: "TWIN ENTANGLED" },
    intro: { tr: "İki plaka, iki kapı. Üç zaman çizgisi gerek.",
             en: "Two plates, two doors. You need three timelines." },
    moves: 18,
    grid: [
      "##########",
      "#P.a..c..#",
      "#........#",
      "####A#####",
      "#........#",
      "#####C####",
      "#........#",
      "#.......G#",
      "##########",
    ],
  },

  {
    name:  { tr: "ÜÇ EŞZAMANLI",    en: "THREE SIMULTANEOUS" },
    intro: { tr: "Üç plaka aynı anda aktif olmalı. Sen artı iki yankı.",
             en: "Three plates active simultaneously. You plus two echoes." },
    moves: 24,
    grid: [
      "###########",
      "#P..a..c..#",
      "#.........#",
      "#####A#####",
      "#....d....#",
      "#####C#####",
      "#.........#",
      "#####D#####",
      "#........G#",
      "###########",
    ],
  },

  {
    name:  { tr: "KÖPRÜ",           en: "BRIDGE" },
    intro: { tr: "Eşli portallar. Aynı rakam birbirine bağlı.",
             en: "Paired portals. Same digit links them." },
    moves: 16,
    grid: [
      "#########",
      "#P......#",
      "##.####1#",
      "#..a....#",
      "#########",
      "#1....AG#",
      "#########",
    ],
  },

  {
    name:  { tr: "IŞIN",            en: "BEAM" },
    intro: { tr: "Lazer ölümcül. Plaka aktifken yayıcı kapanır.",
             en: "The laser is lethal. Holding the plate disables the emitter." },
    moves: 16,
    grid: [
      "#########",
      "#P......#",
      "##.######",
      "#a......#",
      "##.######",
      "#>.....G#",
      "#########",
    ],
    lasers: [{ x: 1, y: 5, plate: "a" }],
  },

  {
    name:  { tr: "ÇÖKÜŞ",           en: "COLLAPSE" },
    intro: { tr: "Portal seni karşı koridora ışınlar. Yankın plakayı uzaktan tutarken, sen koridorun sonundaki kapıdan G'ye çıkarsın.",
             en: "The portal drops you into the far corridor. Echo holds the plate from afar while you exit through the door at the end." },
    moves: 24,
    grid: [
      "###########",
      "#P.......1#",
      "###########",
      "#1...a...A#",
      "#########.#",
      "#........G#",
      "###########",
    ],
  },

  {
    name:  { tr: "KUANTUM GEÇİT",   en: "QUANTUM GATE" },
    intro: { tr: "Q hücreleri her HAMLENDE bir DUVAR ↔ ZEMİN flip eder. Q duvarken içeri giremezsin. Sırayla 3 Q geçmek için bazen DUVARA ÇARPIP bir tur beklemen lazım — çarpma da hamle sayar. Ritmi yakala.",
             en: "Q cells flip between WALL ↔ FLOOR each MOVE. You can't enter Q while it's a wall. To cross 3 Qs in a row, sometimes you must BUMP A WALL to skip a turn — the bump still counts as a move. Read the rhythm." },
    moves: 16,
    grid: [
      "###########",
      "#P.QQQ...G#",
      "###########",
    ],
  },

  {
    name:  { tr: "KARGO",           en: "CARGO" },
    intro: { tr: "Kutuyu iterek plakaya yerleştir. Kutular lazer ışınını da bloklar.",
             en: "Push the box onto the plate. Boxes also block laser beams." },
    moves: 16,
    grid: [
      "#######",
      "#P.B.a#",
      "####A##",
      "#G....#",
      "#######",
    ],
  },

  {
    name:  { tr: "DALGALANMA",      en: "FLUCTUATION" },
    intro: { tr: "Tek dikey geçit iki kuantum hücresinden geçiyor. Yankın plaka 'a'yı tutarken lazer söner; sen Q'ların ritmini iki kez sayıp G'ye iniyorsun.",
             en: "The only vertical corridor passes through two quantum cells. While your echo holds plate 'a', the laser is silent; you read the Q rhythm twice on the way down to G." },
    moves: 22,
    grid: [
      "#########",
      "#P.....a#",
      "####Q####",
      "#.......#",
      "####Q####",
      "#>.....G#",
      "#########",
    ],
    lasers: [{ x: 1, y: 5, plate: "a" }],
  },

  {
    name:  { tr: "DEVRİYE",         en: "SENTRY" },
    intro: { tr: "Kırmızı devriye X koridoru tarıyor. Kapı A tek giriş; G'ye varmak için devriyenin yürüdüğü koridoru aşmak zorundasın. Yankın plakayı tutar, sen X'in ritmini sayıp süzülürsün.",
             en: "Red sentry X paces the corridor. Door A is the only entry; the only path to G crosses the sentry's lane. Echo holds the plate while you read X's rhythm." },
    moves: 28,
    grid: [
      "##########",
      "#P.....a.#",
      "####A#####",
      "#.X......#",
      "########.#",
      "#G.......#",
      "##########",
    ],
  },

  {
    name:  { tr: "KIRILGAN PLAKA",  en: "FRAGILE PLATE" },
    intro: { tr: "Turuncu plaka tek kullanımlık. Bir kez dokunulduğunda eşli kapı kalıcı açılır — sonsuza dek. Yanlış an'da basma.",
             en: "Orange plate is one-shot. Touch it once and the paired door latches open forever. Don't waste it." },
    moves: 22,
    grid: [
      "#########",
      "#P......#",
      "#.######",
      "#a....A.",
      "######.#",
      "#......G",
      "#########",
    ].map(s => s.padEnd(9, "#").slice(0, 9)),
    fragile: ["a"],
  },

  // -------- Lv12-23: Üst Seviye Bulmacalar --------

  {
    name:  { tr: "KÖR NOKTA",       en: "BLIND SPOT" },
    intro: { tr: "Portal seni lazerin yanına atar. Tek koridor, tek plaka — yankın plakada beklerken sen ışın koridorundan G'ye yürürsün.",
             en: "The portal drops you next to the laser. One corridor, one plate — echo holds the plate while you cross the beam corridor to G." },
    moves: 22,
    grid: [
      "###########",
      "#P......a.#",
      "#####1#####",
      "#.........#",
      "#>.......G#",
      "#####1#####",
      "###########",
    ],
    lasers: [{ x: 1, y: 4, plate: "a" }],
  },

  {
    name:  { tr: "KUTU ÇIKMAZ",     en: "BOX DEADLOCK" },
    intro: { tr: "Kutu plaka 'a'yı tutar, A kapısı açılır. AMA lazer hâlâ G'yi tarıyor. Yankın plaka 'c'yi tutmadan ışın koridorundan geçemezsin.",
             en: "The crate holds plate 'a' — door A opens. BUT the laser still sweeps through G. Your echo must hold plate 'c' to silence the beam." },
    moves: 28,
    grid: [
      "##########",
      "#P.B....a#",
      "#####Q####",
      "#c.......#",
      "#######.##",
      "#>.....AG#",
      "##########",
    ],
    lasers: [{ x: 1, y: 5, plate: "c" }],
  },

  {
    name:  { tr: "ÇİFT MÜHÜR",      en: "DOUBLE SEAL" },
    intro: { tr: "İki plaka aynı anda aktif olmalı — iki yankı + sen. Plakalar koridorun farklı uçlarında, kapı dar. Senkronize ol.",
             en: "Two plates active at once — two echoes + you. The plates are at opposite ends, the door is narrow. Synchronize." },
    moves: 30,
    grid: [
      "###########",
      "#P.......c#",
      "###.###.###",
      "#a.......##",
      "#####A#####",
      "#####C#####",
      "#........G#",
      "###########",
    ],
  },

  {
    name:  { tr: "RİTM ANI",        en: "RHYTHM BEAT" },
    intro: { tr: "Üç sıralı kuantum hücre, sonunda plaka. Devriye seni alt koridorda bekler. Saymayı bil: yanlış adım = ölüm.",
             en: "Three quantum cells in a row, plate at the end. The sentry waits in the lower corridor. Count: a wrong step = death." },
    moves: 22,
    grid: [
      "###########",
      "#P.Q.Q.Q.a#",
      "########A##",
      "#......X.G#",
      "###########",
    ],
  },

  {
    name:  { tr: "ÜÇ AŞAMA",        en: "THREE STAGES" },
    intro: { tr: "Üç aşama: kapı (plaka a), lazer (plaka c), portal (G aşağıda). İki yankıyı sırayla yerleştir, son atışta sen portal kuyusundan G'ye iniyorsun.",
             en: "Three stages: door (plate a), laser (plate c), portal well (G below). Place two echoes in sequence; on the final run, you drop through the portal well to G." },
    moves: 32,
    grid: [
      "###########",
      "#P..a.....#",
      "####A######",
      "#1.......c#",
      "###########",
      "#>.......1#",
      "#########.#",
      "#........G#",
      "###########",
    ],
    lasers: [{ x: 1, y: 5, plate: "c" }],
  },

  {
    name:  { tr: "PERDE",           en: "CURTAIN" },
    intro: { tr: "Bir turuncu plaka (kırılgan, tek dokunuşla kapı kalıcı açılır) ve bir normal plaka (yankın tutmadan kapanır). İkisini doğru sırayla kullan.",
             en: "One orange plate (fragile — single touch latches the door forever) and one regular plate (closes when echo lets go). Use them in the right order." },
    moves: 26,
    grid: [
      "###########",
      "#P......a.#",
      "####A######",
      "#....c....#",
      "#####.#####",
      "#####C#####",
      "#........G#",
      "###########",
    ],
    fragile: ["a"],
  },

  {
    name:  { tr: "ÇUKUR",           en: "THE PIT" },
    intro: { tr: "İki portal çifti seni yukarı-aşağı atar. Kapı A ilk koridoru kilitler. Portal kuyusu yegane geçit — yankın olmadan plakayı tutamazsın.",
             en: "Two portal pairs throw you up and down. Door A locks the first corridor and the portal well is the only way through — you need your echo on the plate." },
    moves: 28,
    grid: [
      "###########",
      "#P..a.....#",
      "####A######",
      "#1.......2#",
      "###########",
      "#2.......1#",
      "####.######",
      "#........G#",
      "###########",
    ],
  },

  {
    name:  { tr: "DALGALI ÇIKIŞ",   en: "WAVED EXIT" },
    intro: { tr: "İki lazer farklı plakalardan beslenir. Yatay ışın koridoru kestiğinde aşağıdaki dikey ışın yolunu açar. İki yankı, iki ritim.",
             en: "Two lasers, each fed by a different plate. The horizontal beam cuts your path, the vertical one waits below. Two echoes, two rhythms." },
    moves: 30,
    grid: [
      "###########",
      "#P....a..c#",
      "########.##",
      "#>........#",
      "##.########",
      "#....v....#",
      "#........G#",
      "###########",
    ],
    lasers: [
      { x: 1, y: 3, plate: "a" },
      { x: 5, y: 5, plate: "c" },
    ],
  },

  {
    name:  { tr: "NEFES PAYI",      en: "BREATH MARGIN" },
    intro: { tr: "Sıkı hamle bütçesi, dar koridor, devriyenin keskin paçası. Üç yıldız istiyorsan mükemmel hattı çiz.",
             en: "Tight move budget, narrow corridor, sentry sweeping the lane. Want three stars? Find the perfect line." },
    moves: 20,
    grid: [
      "##########",
      "#P.a....A#",
      "########.#",
      "#......XG#",
      "##########",
    ],
  },

  {
    name:  { tr: "SİS",             en: "MIST" },
    intro: { tr: "Kuantum geçit, portal sıçraması, lazer koridoru — üçü birden. Yankın plaka 'a'yı tutarken lazer söner; sen Q'yu zamanlayıp portala ulaşır, ışın dehlizine düşersin.",
             en: "Quantum gate, portal jump, laser hall — all at once. Echo holds plate 'a' to silence the laser; you time Q to reach the portal and drop into the beam corridor." },
    moves: 26,
    grid: [
      "###########",
      "#P..Q....1#",
      "####a######",
      "#.........#",
      "###########",
      "#>1......G#",
      "###########",
    ],
    lasers: [{ x: 1, y: 5, plate: "a" }],
  },

  {
    name:  { tr: "DEHLİZ",          en: "GAUNTLET" },
    intro: { tr: "Uzun dehliz, üç tehdit. İki plaka — biri kapıyı, diğeri hem kapıyı hem lazeri kontrol eder. Bir devriye, bir lazer. Yankıları doğru sırada yerleştir.",
             en: "Long gauntlet, three threats. Two plates — one for a door, the other for door + laser. A sentry, a laser. Place echoes in the right order." },
    moves: 36,
    grid: [
      "#############",
      "#P.....a...c#",
      "###########.#",
      "#.X.........#",
      "#######A#####",
      "#>..........#",
      "#######C#####",
      "#..........G#",
      "#############",
    ],
    lasers: [{ x: 1, y: 5, plate: "c" }],
  },

  {
    name:  { tr: "SONSUZ DÖNGÜ",    en: "INFINITE LOOP" },
    intro: { tr: "SON SINAV. Üç kapı, üç plaka (biri kırılgan), portal, kuantum, lazer, devriye. Mükemmel koreografi olmadan geçemezsin.",
             en: "FINAL EXAM. Three doors, three plates (one fragile), portal, quantum, laser, sentry. You will not pass without perfect choreography." },
    moves: 56,
    grid: [
      "##############",
      "#P..........a#",
      "######A#######",
      "#.X..........#",
      "######c#######",
      "#>.....Q.d...#",
      "#######C######",
      "#......1.....#",
      "##############",
      "#1.........D.#",
      "###########.##",
      "#...........G#",
      "##############",
    ],
    lasers: [{ x: 1, y: 5, plate: "c" }],
    fragile: ["d"],
  },
];

// El yapımı seviyeler — 23 dolu dolu bölüm. Generator devre dışı (artifact arşivde, gerekirse aç).
const HAND_LEVELS = LEVELS.slice();
const TOTAL_LEVELS = HAND_LEVELS.length;

// Helper: belirli bir seviye/saha için aktif dildeki metni getir.
function levelText(lvl, field) {
  const v = lvl && lvl[field];
  if (typeof v === "string") return v;
  if (v && typeof v === "object") return v[I18n.get()] || v.tr || "";
  return "";
}
