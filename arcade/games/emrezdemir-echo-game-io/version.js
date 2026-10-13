// Single source of truth for the project version.
// Update this object on every release and add a matching entry to CHANGELOG.md.
// The `changes` field is bilingual: { tr: [...], en: [...] }.

const VERSION = {
  number: "1.15.6",
  codename: "FAVICON",
  date: "2026-05-17",
  build: "monolith",

  history: [
    {
      v: "1.15.6",
      date: "2026-05-17",
      codename: "FAVICON",
      changes: {
        tr: [
          "Inline SVG favicon eklendi (data URI); tarayıcının varsayılan /favicon.ico isteği bastırılıyor",
          "Diamond simgesi: oyun paletinde mor gövde + cyan kontur ve merkez nokta",
          "Harici favicon dosyası gerektirmiyor; ek HTTP isteği yok",
        ],
        en: [
          "Added an inline SVG favicon via data URI; the browser's default /favicon.ico request is suppressed",
          "Diamond glyph: purple body with cyan outline and centre dot, matching the game palette",
          "No external favicon file required; no extra HTTP request",
        ],
      },
    },
    {
      v: "1.15.5",
      date: "2026-05-17",
      codename: "TRAILING_SLASH",
      changes: {
        tr: [
          "Sub-path düzeltmesi document.write yerine location.replace ile yeniden yazıldı; trailing slash yoksa sayfa /path/ formatına yönlendiriliyor",
          "Yönlendirme sonrası tarayıcı doğru base ile yeni request atıyor; CSP veya parser zamanlaması <base> enjeksiyonunu engellese de çalışıyor",
        ],
        en: [
          "Reworked the sub-path fix from document.write to location.replace; without a trailing slash the page now redirects to the /path/ form",
          "After the redirect the browser issues new requests with the correct base, regardless of CSP or parser timing on document.write",
        ],
      },
    },
    {
      v: "1.15.4",
      date: "2026-05-17",
      codename: "BASEPATH",
      changes: {
        tr: [
          "Statik <base href=\"./\"> kaldırıldı; trailing slash yokken parent dizine çözülüyordu",
          "Senkron <script> ile path sonunda slash yoksa ve uzantı yoksa <base href=\"<path>/\"> dinamik enjekte ediliyor",
          "https://hbnf.net/time-echo (slash'sız) erişiminde asset'ler artık /time-echo/ altından isteniyor",
        ],
        en: [
          "Removed the static <base href=\"./\">; without a trailing slash it resolved to the parent directory",
          "A synchronous head script injects <base href=\"<path>/\"> when the URL has no trailing slash and no file extension",
          "Accessing https://hbnf.net/time-echo (no slash) now resolves assets under /time-echo/ instead of the host root",
        ],
      },
    },
    {
      v: "1.15.3",
      date: "2026-05-17",
      codename: "SUBPATH",
      changes: {
        tr: [
          "index.html'e <base href=\"./\"> eklendi; tüm relatif path'ler doküman dizinine göre çözülüyor (sub-path deploy desteği)",
          "Editör paylaşım URL'si location.href tabanında üretiliyor; sub-path ve query string'de bozulmuyor",
          "https://hbnf.net/time-echo/ gibi alt yollarda kurulum sunucu rewrite'ı olmadan çalışıyor",
        ],
        en: [
          "Added <base href=\"./\"> to index.html so every relative path resolves against the document directory (sub-path deployment support)",
          "Editor share URL is built from location.href, surviving sub-paths and query strings",
          "Deployment under sub-paths such as https://hbnf.net/time-echo/ works without server-side rewrites",
        ],
      },
    },
    {
      v: "1.15.2",
      date: "2026-05-17",
      codename: "FIT",
      changes: {
        tr: [
          "Sprite kaynak PNG'lerinde karakter bounding box'u tanımlandı; çevredeki şeffaf padding artık çizilmiyor",
          "Tüm animasyonlar için per-anim bbox: idle/run/hurt dikey, dead yatay duruş",
          "Karakter cell'i tam dolduruyor (yükseklik cell, en aspect'e göre) — orantısızlık giderildi",
          "Aspect oranı korunuyor; ayaklar cell tabanında kalıyor",
        ],
        en: [
          "Source PNG sprites now declare a per-animation bounding box; the transparent padding is no longer drawn",
          "Per-anim bbox: idle/run/hurt are tall, dead is wide",
          "The character now fills the cell (height to cell, width by aspect) — the proportions match the grid",
          "Aspect ratio preserved; feet remain anchored at the cell bottom",
        ],
      },
    },
    {
      v: "1.15.1",
      date: "2026-05-17",
      codename: "CONTAIN",
      changes: {
        tr: [
          "Karakter çizim boyutu cell sınırı içine alındı; sprite frame artık bir hücreden büyük değil",
          "Oyuncu cell × 1.30 → cell × 1.0",
          "Yankı cell × 1.20 → cell × 0.95",
        ],
        en: [
          "Character draw size constrained to the cell; the sprite frame no longer exceeds one tile",
          "Player cell x 1.30 -> cell x 1.0",
          "Echo cell x 1.20 -> cell x 0.95",
        ],
      },
    },
    {
      v: "1.15.0",
      date: "2026-05-17",
      codename: "INNER_VOICE",
      changes: {
        tr: [
          "Yeni bark.js modülü: karakterin başında küçük düşünce balonu",
          "1-2 kelimelik kısa replikler (şüphe, pişmanlık, soru, korku, panik, felsefe)",
          "Tetikleyiciler: hareket (%6), duvara çarpma (%18), echo kaydı (%55), uzun bekleme",
          "Ölüm anında panik repliği (zorunlu tetikleme)",
          "İki dilli (TR/EN), i18n diline göre seçiliyor",
          "Cooldown 2.5sn, ekran süresi 2.2sn, 400ms fade",
        ],
        en: [
          "New bark.js module: small thought bubble above the character",
          "1-2 word lines (doubt, regret, question, fear, panic, philosophy)",
          "Triggers: movement (6%), wall bump (18%), echo record (55%), long idle",
          "Death forces a panic line (no cooldown)",
          "Bilingual (TR/EN), selected by current i18n language",
          "2.5s cooldown, 2.2s display, 400ms fade",
        ],
      },
    },
    {
      v: "1.14.2",
      date: "2026-05-17",
      codename: "STAND",
      changes: {
        tr: [
          "Karakter artık cell tabanından anchor'lanıyor (ayaklar hücre zemininde); duvar üstüne kayma sorunu giderildi",
          "Sprite.draw cell parametresi alıyor; ayak oranı FOOT_RATIO=0.85 ile hizalama yapılıyor",
          "Çizim boyutları makul seviyeye çekildi: oyuncu cell × 1.30, yankı cell × 1.20",
        ],
        en: [
          "Character now anchors at the bottom of the grid cell (feet on the tile floor); overflow into the wall below is resolved",
          "Sprite.draw accepts a cell parameter; foot alignment uses FOOT_RATIO=0.85",
          "Draw sizes tuned: player cell x 1.30, echo cell x 1.20",
        ],
      },
    },
    {
      v: "1.14.1",
      date: "2026-05-17",
      codename: "SCALE",
      changes: {
        tr: [
          "Karakter sprite boyutu artırıldı; PNG karelerin etrafındaki şeffaf çerçeveden dolayı oluşan orantısızlık düzeltildi",
          "Oyuncu çizim boyutu cell × 0.92 → cell × 1.85",
          "Yankı çizim boyutu cell × 0.85 → cell × 1.70",
        ],
        en: [
          "Increased character sprite draw size to correct the scale mismatch caused by the transparent padding in the PNG frames",
          "Player draw size cell x 0.92 -> cell x 1.85",
          "Echo draw size cell x 0.85 -> cell x 1.70",
        ],
      },
    },
    {
      v: "1.14.0",
      date: "2026-05-17",
      codename: "ATMOSPHERE",
      changes: {
        tr: [
          "Yeni effects.js modülü: PNG efekt animasyonu oynatma motoru",
          "Portal teleport noktalarında PNG portal efekti (effects/5 Other/Portal1.png)",
          "Lazer ve devriye ölümlerinde kıvılcım efekti (effects/3 Sparks/1.png)",
          "Tüm seviyelerde level_music.mp3 sürekli loop ile çalıyor (procedural chiptune kaldırıldı)",
          "Portal ışınlanma sesi teleport.mp3 ile değişti (eski synth tone kaldırıldı)",
          "deploy.ps1 effects.js ve effects/ klasörünü pakete dahil ediyor",
        ],
        en: [
          "New effects.js module: PNG effect animation playback engine",
          "Portal teleport endpoints play the PNG portal animation (effects/5 Other/Portal1.png)",
          "Laser and sentry deaths trigger the sparks animation (effects/3 Sparks/1.png)",
          "All levels loop level_music.mp3 (procedural chiptune replaced)",
          "Portal teleport sound switched to teleport.mp3 (synth tone replaced)",
          "deploy.ps1 packages effects.js and the effects/ folder",
        ],
      },
    },
    {
      v: "1.13.0",
      date: "2026-05-17",
      codename: "FIGURE",
      changes: {
        tr: [
          "Karakter sprite'ı PNG tabanlı animasyon sistemine geçti (char/City_men_3 spritesheet'leri)",
          "Yeni sprite.js modülü; 128×128 spritesheet'leri Idle, Run, Hurt, Dead için yatay strip olarak çözüyor",
          "Idle (durağan), Run (hareket halinde, tüm yönler için), Hurt (kısa) ve Dead (ölünce) animasyonları aktif",
          "Echo karakteri aynı sprite'ı hue-rotate filtresiyle mor tonlu render ediyor",
          "drawAstronaut API'si korundu; çağrı yerleri moving flag'ı ile genişletildi",
          "deploy.ps1 sprite.js ve char/ klasörünü pakete dahil ediyor",
        ],
        en: [
          "Character sprite migrated to PNG-based animation (char/City_men_3 spritesheets)",
          "New sprite.js module resolves 128x128 horizontal strips for Idle, Run, Hurt, Dead",
          "Idle (stationary), Run (movement, all directions), Hurt (brief) and Dead animations are active",
          "Echo character uses the same sprite tinted with a hue-rotate filter",
          "drawAstronaut API preserved; call sites extended with a moving flag",
          "deploy.ps1 packages sprite.js and the char/ folder",
        ],
      },
    },
    {
      v: "1.12.2",
      date: "2026-05-17",
      codename: "CRITICAL_PATH",
      changes: {
        tr: [
          "Lv10 Devriye: X devriyesi dekoratiftı, yeniden tasarlandı; oyuncu G'ye varmak için X'in koridorunu aşmak zorunda",
          "Lv18 Çukur: portallar dekoratifti, row 4 ve row 6 kapatıldı; portal kuyusu tek geçit",
          "Lv21 Sis: portal dekoratifti, yeniden tasarlandı; portal artık G'ye tek erişim",
          "Lv23 Sonsuz Döngü: kuantum hücresi dekoratifti, (4,5)'ten (7,5)'e taşındı; oyuncu c plakasından C kapısına giderken Q'dan geçmek zorunda",
        ],
        en: [
          "Lv10 Devriye: sentry was decorative, redesigned so the player must cross the sentry lane to reach G",
          "Lv18 Çukur: portals were decorative; rows 4 and 6 sealed so the portal well is the only passage",
          "Lv21 Sis: portal was decorative; redesigned so the portal is the only access to G",
          "Lv23 Sonsuz Döngü: quantum tile was decorative; moved from (4,5) to (7,5) so the player must cross it from plate c to door C",
        ],
      },
    },
    {
      v: "1.12.1",
      date: "2026-05-17",
      codename: "CHANNEL",
      changes: {
        tr: [
          "Lv9 Dalgalanma yeniden tasarlandı; quantum tile'lar dekoratif değil tek dikey geçit haline getirildi",
          "Sağ koridor bypass'ı kapatıldı; oyuncu artık iki quantum tile'ı geçmek zorunda",
          "Hamle bütçesi 20 → 22",
        ],
        en: [
          "Lv9 Dalgalanma redesigned; quantum tiles are now the only vertical corridor",
          "Right-corridor bypass closed; the player must cross two quantum tiles",
          "Move budget 20 → 22",
        ],
      },
    },
    {
      v: "1.12.0",
      date: "2026-05-17",
      codename: "REBALANCE",
      changes: {
        tr: [
          "Lv6, Lv13, Lv16, Lv17 ve Lv18 yeniden tasarlandı; orta-ileri seviyelerde echo mekaniği zorunlu hale getirildi",
          "Lv6: üç mekanikli aşırı yükleme yerine portal + kapı kompozisyonu",
          "Lv13: kutu A kapısını açıyor, lazer ikinci plakayı zorunlu kılıyor (hamle bütçesi 18 → 28)",
          "Lv16: Lv3 kopyası yerine kapı + lazer + portal kuyusu sıralaması",
          "Lv17: çift kırılgan plaka kombinasyonu yerine bir kırılgan + bir normal plaka",
          "Lv18: üç portal çiftinden ikiye düşürüldü (hamle 28 → 26)",
          "Tüm seviye giriş metinleri echo gereksinimini netleştirecek şekilde yeniden yazıldı",
        ],
        en: [
          "Redesigned levels 6, 13, 16, 17, and 18 to enforce the echo mechanic in mid-to-late game",
          "Level 6: replaced triple-mechanic overload with portal + door composition",
          "Level 13: crate opens door A while laser requires a second plate (move budget 18 → 28)",
          "Level 16: replaced Lv3 duplicate with door + laser + portal-well sequence",
          "Level 17: replaced dual-fragile composition with one fragile + one regular plate",
          "Level 18: reduced from three portal pairs to two (move budget 28 → 26)",
          "Rewrote all level introduction strings to clearly state why each level requires an echo",
        ],
      },
    },
    {
      v: "1.11.3",
      date: "2026-05-17",
      codename: "FLUID",
      changes: {
        tr: [
          "Level select layout düzeltmesi: uzun içerikli ekranlar için align-items: flex-start; üst satırlar artık erişilebilir",
          "Level list grid: repeat(auto-fill, minmax(220px, 1fr)); max-width 920px → 1280px",
          "Mini-map yüksekliği 72px → 56px",
          "Tek sayfa durumunda pager gizlendi",
          "Editör action bar üç sütunlu grid; beş buton iki satıra yayıldı",
        ],
        en: [
          "Level select layout fix: align-items: flex-start on tall screens; top rows now reachable",
          "Level list grid: repeat(auto-fill, minmax(220px, 1fr)); max-width 920px → 1280px",
          "Mini-map height 72px → 56px",
          "Single-page pager hidden",
          "Editor action bar uses a three-column grid; five buttons wrap onto two rows",
        ],
      },
    },
    {
      v: "1.11.2",
      date: "2026-05-17",
      codename: "PROSE",
      changes: {
        tr: [
          "README.md yeniden yazıldı; status badge'lar, içindekiler, tutarlı bölüm hiyerarşisi",
          "AI-Native Development bölümü eklendi (workflow, memory bank, sync protokolü)",
          "Eski 1987 prosedürel seviye ve sürüm referansları temizlendi",
        ],
        en: [
          "Rewrote README.md with status badges, table of contents, consistent section hierarchy",
          "Added AI-Native Development section (workflow, memory bank, sync protocol)",
          "Removed stale references to procedural levels and older version codenames",
        ],
      },
    },
    {
      v: "1.11.1",
      date: "2026-05-17",
      codename: "CLEAN_SLATE",
      changes: {
        tr: [
          "localStorage anahtarı timeEcho.progress.v1 → timeEcho.progress.v2; eski cleared indexleri geçersizleştirildi",
        ],
        en: [
          "Save key timeEcho.progress.v1 → timeEcho.progress.v2; old cleared indices invalidated",
        ],
      },
    },
    {
      v: "1.11.0",
      date: "2026-05-17",
      codename: "CRAFTED",
      changes: {
        tr: [
          "Prosedürel seviye üreticisi devre dışı bırakıldı; TOTAL_LEVELS = HAND_LEVELS.length",
          "12 yeni el yapımı seviye eklendi (Lv12 - Lv23)",
          "Lv23 Sonsuz Döngü tüm mekanikleri tek 13×14 gridde birleştiriyor",
          "LEVELS_PER_PAGE 12 → 24; 23 seviye tek sayfada gösteriliyor",
          "LEVELS Proxy kaldırıldı; doğrudan array",
          "isPlateCell artık v karakterini emitter olarak işliyor",
        ],
        en: [
          "Disabled procedural level generator; TOTAL_LEVELS = HAND_LEVELS.length",
          "Added 12 new hand-crafted levels (Lv12 - Lv23)",
          "Lv23 Sonsuz Döngü combines all mechanics in a single 13×14 grid",
          "LEVELS_PER_PAGE 12 → 24; 23 levels fit on a single page",
          "Removed LEVELS Proxy; direct array",
          "isPlateCell now treats 'v' as an emitter character",
        ],
      },
    },
    {
      v: "1.10.1",
      date: "2026-05-17",
      codename: "PATROL",
      changes: {
        tr: [
          "Lv9 Dalgalanma: row 4 grid string'i .slice(0,9) ile yanlış kırpılıyordu; doğrudan '#.#####.#' olarak yazıldı",
          "Lv10 Devriye: 10×6 gride yeniden tasarlandı; kapı A tek dikey geçit, devriye G yolunu kesiyor (hamle 22 → 28)",
          "_audit_hand.js eklendi; hand-crafted seviyeleri için 7 aşamalı BFS denetimi",
        ],
        en: [
          "Lv9 Dalgalanma: row 4 grid string was truncated by .slice(0,9); written directly as '#.#####.#'",
          "Lv10 Devriye: redesigned to a 10×6 grid; door A is the only vertical passage, sentry blocks the path to G (moves 22 → 28)",
          "Added _audit_hand.js; seven-stage BFS audit for hand-crafted levels",
        ],
      },
    },
    {
      v: "1.10.0",
      date: "2026-05-16",
      codename: "WALKER",
      changes: {
        tr: [
          "Karakter sprite'ı yandan görünüm pixel-art bir karaktere geçti",
          "Yürüyüş cycle: bacaklar zıt fazda, kollar karşı salınım, hafif bob hareketi",
          "Facing flip ile yatay yön değişimi",
          "Ön ve arka uzuvlar için ayrı gölgeleme",
          "drawAstronaut fonksiyon adı çağrı uyumluluğu için korundu",
        ],
        en: [
          "Switched character sprite to a side-view pixel-art figure",
          "Walk cycle: opposite-phase legs, counter-swinging arms, subtle bob",
          "Horizontal flip for facing direction",
          "Separate shading for front and back limbs",
          "Function name drawAstronaut retained for call-site compatibility",
        ],
      },
    },
    {
      v: "1.9.9",
      date: "2026-05-15",
      codename: "RHYTHM",
      changes: {
        tr: [
          "Replay sonrası orijinal kazanma overlay'i geri yüklendi; ara dialog kaldırıldı",
          "Lv7 Kuantum Geçit: tek koridor, üç ardışık Q hücresi, alternatif yol yok",
        ],
        en: [
          "Replay end now restores the original win overlay; intermediate dialog removed",
          "Lv7 Kuantum Geçit: single corridor, three consecutive Q cells, no alternative path",
        ],
      },
    },
    {
      v: "1.9.8",
      date: "2026-05-14",
      codename: "STAGE",
      changes: {
        tr: [
          "Title screen MP3'ü artık yalnızca başlık ekranında çalıyor; diğer ekranlar prosedürel chiptune kullanıyor",
        ],
        en: [
          "Title-screen MP3 now plays only on the title screen; other screens use the procedural chiptune engine",
        ],
      },
    },
    {
      v: "1.9.7",
      date: "2026-05-13",
      codename: "LASER",
      changes: {
        tr: [
          "Lv6 Çöküş ikinci iterasyon: portal (9,1) ↔ (2,5) oyuncuyu lazer koridoruna düşürüyor",
          "Plaka a hem A kapısını açıyor hem lazeri söndürüyor",
        ],
        en: [
          "Lv6 Çöküş second iteration: portal (9,1) ↔ (2,5) drops the player into the laser corridor",
          "Plate a opens door A and silences the laser",
        ],
      },
    },
    {
      v: "1.9.6",
      date: "2026-05-13",
      codename: "POCKET",
      changes: {
        tr: [
          "Mobil layout iyileştirmeleri: viewport-fit=cover, safe-area-inset padding, 100dvh",
          "Logo CSS animasyonu için inline transform kaldırıldı",
          "900px altında hover yerine :active geri bildirim",
        ],
        en: [
          "Mobile layout improvements: viewport-fit=cover, safe-area-inset padding, 100dvh",
          "Removed inline transforms that conflicted with logo CSS animation",
          "Below 900px viewport, hover replaced with :active tap feedback",
        ],
      },
    },
    {
      v: "1.9.5",
      date: "2026-05-12",
      codename: "AUDIT",
      changes: {
        tr: [
          "Generator için 7 aşamalı denetim hattı eklendi (P/G sayımı, kapı-plaka eşleşmesi, portal çifti, plaka erişimi, doors-closed solo-pass)",
          "Denetimden geçemeyen seviyeler otomatik yeniden üretiliyor",
        ],
        en: [
          "Added a seven-stage audit pipeline for the generator (P/G count, door-plate pairing, portal pairs, plate reachability, doors-closed solo-pass)",
          "Levels failing the audit are regenerated automatically",
        ],
      },
    },
    {
      v: "1.9.4",
      date: "2026-05-12",
      codename: "WELL",
      changes: {
        tr: [
          "Lv6 Çöküş yeniden tasarlandı: portal zorunlu geçiş haline getirildi",
          "Yetim plaka kaldırıldı (hamle bütçesi 32 → 28)",
        ],
        en: [
          "Lv6 Çöküş redesigned: portal made mandatory",
          "Orphan plate removed (move budget 32 → 28)",
        ],
      },
    },
    {
      v: "1.9.3",
      date: "2026-05-11",
      codename: "WORMHOLE",
      changes: {
        tr: [
          "Portal teleport efekti: her iki uçta parçacık patlaması",
          "Prosedürel spectrum fallback (analyser kullanılamayan ortamlarda)",
          "Ghost replay düzeltmesi: _replaying flag ile busy guard'ı atlanıyor",
          "Replay sonrası orijinal kazanma overlay'ine dönüş",
        ],
        en: [
          "Portal teleport effect: particle burst at both endpoints",
          "Procedural spectrum fallback for environments without an audio analyser",
          "Ghost replay fix: _replaying flag bypasses the tick busy guard",
          "Return to original win overlay after replay",
        ],
      },
    },
    {
      v: "1.9.2",
      date: "2026-05-10",
      codename: "SPECTRUM",
      changes: {
        tr: [
          "Web Audio AnalyserNode ile başlık ekranı için bant frekans verisi",
          "TitleFX bass / mid / treble enerjisinden yıldız, nebula, logo ve spektrum çubuğu modüle ediyor",
          "THIRD_PARTY.md eklendi",
        ],
        en: [
          "Bandwise frequency data from Web Audio AnalyserNode on the title screen",
          "TitleFX modulates stars, nebula, logo, and spectrum bars from bass / mid / treble energy",
          "Added THIRD_PARTY.md",
        ],
      },
    },
    {
      v: "1.9.1",
      date: "2026-05-09",
      codename: "DRONE",
      changes: {
        tr: [
          "Müzik dark ambient drone'a yeniden yazıldı (lead ve arpeggio katmanları çıkarıldı)",
          "Q tile gerçek zamanlı pulse ile vurgulandı",
          "TitleFX modülü: parallax yıldızlar, sürüklenen echo silüetleri, nebula, logo glitch, buton hover",
        ],
        en: [
          "Music rewritten as a dark ambient drone (lead and arpeggio layers removed)",
          "Q tiles highlighted with a real-time pulse",
          "TitleFX module: parallax stars, drifting echo silhouettes, nebula, logo glitch, button hover",
        ],
      },
    },
    {
      v: "1.9.0",
      date: "2026-05-08",
      codename: "GLOW",
      changes: {
        tr: [
          "WebGL2 post-processing hattı: bloom, CRT distort, chromatic aberration, scanline, vignette, grain",
          "Canvas2D çizim korundu; yalnızca final composite shader hattından geçiyor",
        ],
        en: [
          "WebGL2 post-processing pipeline: bloom, CRT distortion, chromatic aberration, scanline, vignette, grain",
          "Canvas2D rendering preserved; only the final composite passes through the shader stages",
        ],
      },
    },
    {
      v: "1.8.0",
      date: "2026-05-05",
      codename: "SENTRY",
      changes: {
        tr: [
          "Devriye X: koridorda ileri-geri yürüyen, temasta öldüren düşman",
          "Kırılgan plaka: tek dokunuşla eşli kapıyı kalıcı açan plaka",
          "Beş biome rengi",
          "Milestone seviyelerinde hikaye fragmanları",
          "B harf çakışması düzeltildi: generator kapı atarken B, G, P, Q, X harflerini atlıyor",
        ],
        en: [
          "Sentry X: patrolling enemy lethal on contact",
          "Fragile plate: latches the matched door open permanently after a single touch",
          "Five biome color palettes",
          "Story fragments at milestone levels",
          "Fixed B letter conflict: generator now skips B, G, P, Q, X when assigning doors",
        ],
      },
    },
    {
      v: "1.7.1",
      date: "2026-05-01",
      codename: "POLISH",
      changes: {
        tr: [
          "Bazı prosedürel seviyelerde spawn hatası düzeltildi",
          "Level select UI küçük düzeltmeleri",
          "Hikaye fragmanları seviye geçişlerine yerleştirildi",
        ],
        en: [
          "Fixed spawn bug on certain procedural levels",
          "Minor level select UI corrections",
          "Story fragments interleaved with level transitions",
        ],
      },
    },
    {
      v: "1.7.0",
      date: "2026-04-29",
      codename: "QUANTUM",
      changes: {
        tr: [
          "Kuantum tile Q: her hamlede duvar ve zemin arasında geçiş",
          "İtilebilir kutu B: plakaları aktive eder ve lazer ışınını bloklar",
          "Çapraz hareket: Q, E, X, C tuşları ve mobil 3×3 D-pad",
          "120 ms ease-in-out hücreden hücreye tween",
          "Parallax yıldız ve nebula arka planı",
          "Yıldız puanı (1 - 3) echo ve hamle oranından",
          "Kazanan run için ghost replay",
          "Speed-run timer",
          "Kullanıcı seviye galerisi (localStorage)",
          "Prosedürel pixel-art tile cache",
          "Generator ile toplam seviye sayısı 1987'ye yükseltildi",
        ],
        en: [
          "Quantum tile Q: flips between wall and floor on each move",
          "Pushable crate B: activates plates and blocks laser beams",
          "Diagonal movement: Q, E, X, C keys and mobile 3×3 D-pad",
          "120 ms ease-in-out cell-to-cell tween",
          "Parallax star and nebula background",
          "Star scoring (1 - 3) from echo and move ratio",
          "Ghost replay of the winning run",
          "Speed-run timer",
          "Custom level gallery (localStorage)",
          "Procedural pixel-art tile cache",
          "Total level count raised to 1987 via the generator",
        ],
      },
    },
    {
      v: "1.6.1",
      date: "2026-04-25",
      codename: "TUNE",
      changes: {
        tr: [
          "Müzik motoru daha gergin bir atmosfere ayarlandı",
        ],
        en: [
          "Music engine retuned for a more tense atmosphere",
        ],
      },
    },
    {
      v: "1.6.0",
      date: "2026-04-24",
      codename: "BEAT",
      changes: {
        tr: [
          "Programatik step sequencer müzik motoru eklendi (menu ve oyun parçaları)",
        ],
        en: [
          "Added programmatic step-sequencer music engine (menu and game tracks)",
        ],
      },
    },
    {
      v: "1.5.0",
      date: "2026-04-23",
      codename: "TOAST",
      changes: {
        tr: [
          "Toast bildirim sistemi: R / Z / N / mute / dil aksiyonları için kısa süreli bildirimler",
          "HUD KAYIT sayacı: kaydedilmemiş hamleler kırmızı ve pulse",
        ],
        en: [
          "Toast notification system: short-lived messages for R / Z / N / mute / language actions",
          "HUD KAYIT counter: pending moves shown in red with pulse",
        ],
      },
    },
    {
      v: "1.4.2",
      date: "2026-04-22",
      codename: "SOLO",
      changes: {
        tr: [
          "Lv1 yeniden tasarlandı: plaka ve kapı mesafesi 5 hücreye çıkarıldı; solo bypass kapatıldı",
        ],
        en: [
          "Lv1 redesigned: plate and door spacing increased to 5 cells; solo bypass closed",
        ],
      },
    },
    {
      v: "1.4.1",
      date: "2026-04-22",
      codename: "I18N",
      changes: {
        tr: [
          "Sürüm geçmişi ekranı aktif dile göre çözülüyor (TR ve EN)",
        ],
        en: [
          "Version history screen resolves entries according to the active language (TR and EN)",
        ],
      },
    },
    {
      v: "1.4.0",
      date: "2026-04-21",
      codename: "LANG",
      changes: {
        tr: [
          "İki dilli arayüz: tüm UI metni, seviye girişleri ve sürüm geçmişi Türkçe ve İngilizce",
        ],
        en: [
          "Bilingual interface: all UI strings, level intros, and version history in Turkish and English",
        ],
      },
    },
    {
      v: "1.3.0",
      date: "2026-04-20",
      codename: "DEPLOY",
      changes: {
        tr: [
          "deploy.ps1 statik hosting için zip arşivi üretiyor",
        ],
        en: [
          "deploy.ps1 produces a zip archive for static hosting",
        ],
      },
    },
    {
      v: "1.2.0",
      date: "2026-04-19",
      codename: "BEAM",
      changes: {
        tr: [
          "Lazer emitter ve plaka destekli beam mekaniği",
          "Beam hesaplama post-snapshot ile çalışıyor; portal teleport sonrası pozisyonu yansıtıyor",
        ],
        en: [
          "Laser emitter and plate-driven beam mechanic",
          "Beam computation runs against the post-snapshot so it reflects positions after portal teleport",
        ],
      },
    },
    {
      v: "1.1.0",
      date: "2026-04-18",
      codename: "BRIDGE",
      changes: {
        tr: [
          "Portal çiftleri: aynı rakamlı iki portal hareket sonrası birbirine ışınlar",
          "6 seviye: İlk Yankı, Çift Dolaşık, Üç Eşzamanlı, Köprü, Işın, Çöküş",
          "Başlık menüsü, level select, kalıcı ilerleme",
          "Level editör ve URL hash paylaşımı",
          "Death, win ve out-of-sync overlay'leri, mute tuşu",
        ],
        en: [
          "Portal pairs: same-digit portals teleport between each other after movement",
          "6 levels: First Echo, Twin Entangled, Three Simultaneous, Bridge, Beam, Collapse",
          "Title menu, level select, persistent progress",
          "Level editor and URL hash sharing",
          "Death, win, and out-of-sync overlays, mute key",
        ],
      },
    },
    {
      v: "1.0.0",
      date: "2026-04-15",
      codename: "MVP",
      changes: {
        tr: [
          "Çekirdek echo motoru (R kaydet, Z geri al, N sıfırla)",
          "Plaka ve kapı sistemi (a/A, b/B, c/C)",
          "3 seviye, sıra-bazlı hareket",
          "CRT scanline, mor-mavi neon palet, monospace tipografi",
        ],
        en: [
          "Core echo engine (R record, Z undo, N reset)",
          "Plate and door system (a/A, b/B, c/C)",
          "3 levels, turn-based movement",
          "CRT scanline, purple-blue neon palette, monospace typography",
        ],
      },
    },
  ],
};
