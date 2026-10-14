# CLAUDE.md

Bu dosya, Claude Code'a (claude.ai/code) bu repoda çalışırken rehberlik eder.

## Proje tanımı

**ChargeFishing** — telefondan oynanan, web-tabanlı interaktif olta oyunu. Oyunun çekirdek mekaniği şarj kablosunun fiziksel takılıp çıkarılmasına ve telefonun eğim sensörüne bağlıdır:

- Telefon şarja takılınca → olta atılır
- Telefon eğilince (sağ/sol) → kanca yatayda hareket eder
- Şarjdan çıkarılınca → olta çekilir; o anda kancada balık varsa puan kazanılır

Stack: **Vanilla JS + HTML5 Canvas**, build adımı yok (native ES modules). Hedef platform: **Android Chrome** (PWA olarak kurulabilir). iOS Safari desteklenmez — Battery Status API yok.

## Hard rules

Sen senior bir web geliştiricisin, bu kodu insan inceliyor — buna göre yaz.

1. **Sahte sensör verisi prod'a girmesin.** "Fake charging" veya "fake gamma" yalnızca `?debug=1`/`?fakeCharging=1` query flag arkasında olabilir. Battery API yoksa otomatik aktive olan tap-to-toggle fallback hariç (bu kasıtlı, devre dışı bırakılamaz).
2. **Magic number yok.** Tüm zamanlamalar, hızlar, eşikler, balık türleri `src/config.js`'te toplanır. Feature kodunda `setTimeout(..., 5000)` veya `if (gamma > 30)` görünmesin.
3. **Sensör izolasyonu.** Battery API ve DeviceOrientation API yalnızca `src/sensors/*` modüllerinden okunur. `game.js`, `render/*`, `entities/*` bu API'leri **direkt** çağıramaz — sensör modüllerinin sunduğu callback/subscribe arayüzünü kullanır.
4. **Tek render loop.** Tüm Canvas çizimi `src/render/renderer.js` içindeki tek `requestAnimationFrame` döngüsünden akar. Paralel `rAF` veya `setInterval` tabanlı çizim açılmaz. Entiteler `update(dt)` + `draw(ctx)` kontratını uygular.
5. **State machine zorla.** Geçişler yalnızca `src/game.js`'teki `transition(next)` fonksiyonundan geçer. Module'ler direkt state field'ı set edemez. Geçersiz geçiş (örn. `IDLE → HOOKED`) hata fırlatır.
6. **Kullanıcıya gösterilen tüm metinler `src/i18n.js`'ten gelir.** Hardcoded Türkçe/İngilizce string olmaz. Yeni metin eklerken hem `tr` hem `en` sözlüğüne aynı anahtarla yaz.
7. **Tüm kod yorumları İngilizce.** Markdown dokümantasyon Türkçe olabilir ama `.js`/`.css`/`.html` içindeki yorumlar İngilizce.
8. **Scope disiplini.** İstenenden fazlasına dokunma. Drive-by refactor yok, anlamadığın kodu silme.
9. **Sıkıcı çözümleri tercih et.** 100 satır yetiyorsa 1000 yazma.

## Secure-context ve platform kuralları

1. **HTTPS zorunlu.** `navigator.getBattery()`, `DeviceOrientation`, `WakeLock` ve `screen.orientation.lock()` hepsi **secure context** ister. `file://` veya HTTP üzerinden mobile'da çalışmaz.
2. **Yerel test için iki yol:**
   - `mkcert` + `npx http-server -S -C cert.pem -K key.pem` → bilgisayarın yerel IP'sinden HTTPS
   - `ngrok http 8080` → public HTTPS tunnel (daha kolay ama internet gerekir)
3. **iOS Safari desteklenmez.** Battery API yok. Bunu start ekranında tespit edip kullanıcıyı bilgilendir (`'getBattery' in navigator` false ise).
4. **Permissions:** Android Chrome'da DeviceOrientation izin istemez. Battery API izin istemez. WakeLock kullanıcı etkileşimi gerektirir → ilk dokunmada `request('screen')` çağrılır.
5. **Audio gesture:** `AudioContext` user gesture olmadan başlatılamaz. Start butonu hem oyunu hem audio'yu başlatır.
6. **Portrait kilit:** `screen.orientation.lock('portrait')` denenir, başaramazsa CSS rotation hint gösterilir.

## Komutlar

| Aksiyon | Komut |
|---|---|
| Yerel HTTPS sunucusu (mkcert ile cert üret) | `mkcert localhost 192.168.x.x` |
| Yerel sunucu çalıştır | `npx http-server . -S -C cert.pem -K key.pem -p 8080` |
| Alternatif: public HTTPS tunnel | `ngrok http 8080` |
| Telefonda aç | Aynı Wi-Fi'da `https://<bilgisayar-ip>:8080` veya ngrok URL'i |
| Lighthouse PWA audit | Chrome DevTools → Lighthouse → Mobile + PWA |

Build adımı yok. Native ES modules `<script type="module">` ile yüklenir.

## Mimari

### Dosya yapısı

```
ChargeFishing/
├── index.html, styles.css, manifest.json, service-worker.js
├── src/
│   ├── main.js              # Entry; init, start button, ana döngü başlatma
│   ├── game.js              # State machine + skor
│   ├── config.js            # Tüm sabitler
│   ├── storage.js           # localStorage (highscore, settings)
│   ├── sensors/
│   │   ├── battery.js       # getBattery + chargingchange wrapper
│   │   ├── orientation.js   # deviceorientation, gamma normalize
│   │   └── wakelock.js      # Screen wake lock
│   ├── render/
│   │   ├── renderer.js      # rAF döngüsü, canvas sizing (DPR)
│   │   ├── scene.js         # Gökyüzü, su, dalga
│   │   ├── rod.js           # Olta + ip + kanca çizimi
│   │   └── ui.js            # Skor, ipuçları, start ekranı
│   ├── entities/
│   │   ├── fish.js          # Tek balık
│   │   ├── fishSpawner.js   # Populasyon yönetimi
│   │   └── fishTypes.js     # Tür tanımları
│   └── audio/
│       ├── audio.js         # AudioContext + sound player
│       └── sounds.js        # Ses referansları
└── assets/sounds/, assets/icons/
```

### State machine sözleşmesi

```
IDLE      → CASTING   (battery: charging=true)
CASTING   → FISHING   (cast animasyonu biter)
FISHING   → HOOKED    (kanca bir balığın bbox'ı ile çakışır)
FISHING   → REELING   (battery: charging=false; boş çekim)
HOOKED    → REELING   (battery: charging=false; balıklı çekim → skor +)
HOOKED    → FISHING   (HOOKED timeout aşıldı; balık kaçtı)
REELING   → IDLE      (reel animasyonu biter)
```

**Hangi state'te hangi sensör/sistem aktif:**

| State | Battery dinleniyor | Orientation dinleniyor | Fish AI çalışıyor | Wake lock |
|---|---|---|---|---|
| IDLE | ✅ (charging=true bekler) | ❌ | ❌ | ❌ |
| CASTING | ❌ | ❌ | ❌ | ✅ |
| FISHING | ✅ (charging=false bekler) | ✅ | ✅ | ✅ |
| HOOKED | ✅ (charging=false bekler) | ✅ | ✅ (takılı balık dışında) | ✅ |
| REELING | ❌ | ❌ | ❌ | ✅ |

## Konvansiyonlar

1. **Config-driven sabitler.** Hız, mesafe, süre, eşik → `src/config.js`. Yeni bir sabit eklerken `DEFAULT_` prefix'i veya semantik grup adı (`FISH.SPAWN_RATE`, `GAMMA.RANGE`) kullan.
2. **Module isimlendirme.** Kebab-case dosya yok; camelCase dosya isimleri (`fishSpawner.js`). Default export tek class/factory ise OK, aksi halde named export.
3. **Entity kontratı.** Her entity şu interface'i uygular: `update(dtMs)` + `draw(ctx)` + (opsiyonel) `getBoundingBox()`. Bunun dışında entity başka modülün state'ine dokunmaz.
4. **Sensör abonelik kontratı.** Sensör modülleri `subscribe(callback) → unsubscribe` döndürür. Pull-style `getCurrentValue()` da olabilir ama push-style tercih edilir.
5. **Asset yolu.** Tüm asset'ler `assets/` altında, relative URL ile. PWA cache stratejisi için sabit yapı önemli.
6. **i18n yok (ilk aşamada).** Tüm metinler Türkçe, doğrudan koda gömülü. İleride i18n gerekirse `src/i18n.js` eklenir.

## Yeni balık türü eklerken minimum checklist

1. `src/entities/fishTypes.js`'e tür tanımı ekle: `{ id, name, size, speed, points, color, rarity }`
2. `src/config.js`'teki `FISH.SPAWN_WEIGHTS`'a ağırlık ekle (toplam 100'e normalize edilir)
3. Eğer özel davranış varsa (örn. ürkek kaçar, yem yer) `fish.js`'te `behavior` switch'ine case ekle
4. Telefonda test et: spawn oluyor mu, doğru hız/renk, takılınca doğru puan

## Debug

- `?debug=1` query → ekranda state, charging, gamma değerleri overlay
- `?state=FISHING` → başlangıç state'ini zorla (debug flag de gerekir)
- `?fakeCharging=1` → battery API yerine ekran dokunmasını charging toggle olarak kullan (masaüstü test için)
- `?gamma=manual` → klavye sol/sağ ok ile gamma simülasyonu
- Console: `window.__game.transition('FISHING')` ile manuel geçiş (yalnız debug mode'da expose edilir)

## Tap-to-toggle fallback

Battery API mevcut değilse (iOS Safari, Firefox, masaüstü Chrome'un eski sürümleri vs.) `src/sensors/battery.js` otomatik olarak ekran dokunma fallback'ine düşer. UI bunu algılar (`isUsingFallback()`) ve ipuçlarını "Şarja tak" yerine "Ekrana dokun" varyantına döndürür. Calibrate ve Start butonları event filter'lı, yanlışlıkla toggle tetiklemez.

## i18n

- `src/i18n.js` — tr/en sözlüğü + `t(key)` helper
- Locale resolution: `?lang=tr|en` > `navigator.language` > `'en'`
- HTML `lang` attribute runtime'da set edilir (`document.documentElement.lang`)
- Yeni string eklerken iki dilde de tanımla, key'i camelCase yap

## Production deployment (Hostinger / shared hosting)

- `.htaccess` dosyası `index.html` ile aynı klasörde olmalı:
  - WordPress rewrite isolation (`RewriteEngine Off`)
  - CSP: `script-src 'self'`, no inline/remote scripts
  - Permissions-Policy: gyroscope/accelerometer self-only, kalan tüm hassas API'ler kapalı
  - `.pem`/`.key`/`.md`/`.py`/`.zip` uzantılı dosyalar bloklu
  - HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff
- Build artifact: `charge-fishing.zip` (proje kökünden `zip -r` ile üretilir)
- Dağıtım dosyaları sadece: `index.html`, `styles.css`, `src/`, `.htaccess`. `serve.py`/`cert.pem`/`key.pem` dev-only, YÜKLENMEZ.

## Bilinen kısıtlar

- **iOS Safari Battery API yok** → tap fallback otomatik aktif. Eğim sensörü `DeviceOrientationEvent.requestPermission()` ile mod butonuna basıldığı anda (user gesture içinde) istenir; kullanıcı reddederse compat-warning gösterilir ve oyun tap modda oynanır.
- **HTTPS olmayan ortamda hiç çalışmaz.** Yerel HTTP'de tüm sensörler sessizce başarısız olur.
- **WakeLock kararlılığı:** Bazı Android sürümlerinde tab arka plana alınınca lock düşer; `visibilitychange` listener re-acquire eder.
- **chargingchange flakiness:** Bazı Samsung cihazlarda fast-charging modundayken event geç tetiklenebilir (1-2s). HOOKED timeout (6s) bu gecikmeyi telafi edecek kadar uzun.
- **Audio autoplay:** İlk start butonuna kadar ses çalmaz; bu bilinçli bir kısıtlama (Web Audio user gesture gereksinimi).

## Output template

Değişiklik sonrası özet:

```
CHANGES MADE:
- [dosya]: [ne ve neden]
LEFT ALONE:
- [dosya]: [neden]
CONCERNS:
- [risk]
```
