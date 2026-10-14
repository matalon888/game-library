# Charge Fish 🎣⚡

> 🇹🇷 **[Türkçe sürüm için tıkla ↓](#tr)**

A minimal web fishing game where you **plug your phone in** to cast the rod, **unplug** to reel it back, and **tilt** left/right to aim. Vanilla JS + HTML5 Canvas. Installable as a PWA, works offline.

> "Plug in. Tilt. Reel out."

## How to play

| Action | Effect |
|---|---|
| Plug your phone into a charger | The rod casts into the water |
| Tilt your phone left/right | The hook moves horizontally |
| A fish enters the hook area | It gets caught, the line shakes |
| Unplug the charger | The rod reels in, the fish is caught |

If the Battery API isn't supported (iOS Safari, Firefox, etc.), tapping the screen toggles the charge state — the game stays playable on every device.

## Modes

- **Free Play** — no timer, no limits
- **Survival** — start with 30 seconds, each catch adds +4s, ends when the timer runs out

## Features

- 🎯 Smooth tilt control with calibration (DeviceOrientation)
- 🔋 Charge cable mechanic (Battery Status API) + tap fallback
- 📏 Depth selector — pick how deep to cast at the moment you plug in
- ⏱ Survival timer + combo multipliers (3:2×, 5:3×, 10:5×)
- 🪝 4 upgrades: wider hook, quick reel, plenty of fish, magnet
- 🏆 8 achievements, daily quest
- 🌙 Real-time day/night based on local clock, random rain episodes
- 🎨 Color-blind mode (patterns on fish)
- 🔊 Synth sound + haptic feedback (toggle in settings)
- 🌍 Auto Turkish / English (by device locale)
- 📲 PWA — install to home screen, play offline

## Platform support

| Platform | Charge | Tilt | Notes |
|---|---|---|---|
| Android Chrome | ✅ Native | ✅ | Recommended |
| Android Firefox | ⚠️ Tap | ✅ | No Battery API, fallback kicks in |
| iOS Safari | ⚠️ Tap | ✅ With prompt | Asks for motion permission once, tap fallback for charge |
| Desktop Chrome | ⚠️ Tap | ❌ | `?gamma=manual` for keyboard sim |

## Local test (HTTPS required)

Sensor APIs need a secure context:

```bash
# Self-signed cert (once)
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem \
  -days 365 -nodes -subj "/CN=192.168.1.x" \
  -addext "subjectAltName=IP:192.168.1.x,DNS:localhost"

# Start the server
python3 serve.py
```

Open `https://<computer-ip>:8443` from a phone on the same Wi-Fi → bypass the cert warning with **Advanced → Proceed**.

## Deployment

All-static files in a single folder, deployable to any HTTPS host. See **[DEPLOY.md](./DEPLOY.md)** for detailed options.

Quick path (Hostinger / shared hosting):
1. Build the package:
   ```bash
   zip -r charge-fish.zip index.html styles.css src/ icons/ \
     manifest.webmanifest service-worker.js .htaccess LICENSE \
     -x "*.DS_Store" "*/.*"
   ```
2. cPanel/File Manager → upload to `public_html/charge-fish/` → extract
3. Live at `https://example.com/charge-fish/`

## Debug flags

| Flag | Effect |
|---|---|
| `?debug=1` | On-screen state/charge/gamma/coins overlay |
| `?state=FISHING` | Force initial state |
| `?fakeCharging=1` | Tap instead of charge cable (desktop) |
| `?gamma=manual` | Arrow keys simulate tilt |
| `?lang=tr` / `?lang=en` | Force language |

## Architecture

```
src/
├── main.js              # Entry, UI flow orchestrator
├── game.js              # State machine (IDLE/CASTING/FISHING/HOOKED/REELING)
├── config.js            # All tunables
├── i18n.js              # tr/en strings (TR: "Şarjlı Balıkçı", EN: "Charge Fish")
├── settings.js          # Sound/haptic/colorblind/sensitivity
├── storage.js           # Highscore + lifetime stats
├── combo.js             # Streak multipliers
├── achievements.js      # 8 badges
├── quests.js            # Daily quest
├── upgrades.js          # 4 purchasable upgrades
├── haptic.js            # Vibration wrapper
├── catch.js             # Collision detection
├── events.js            # State → audio/particle/storage bridge
├── modes/mode.js        # Free / Survival
├── sensors/             # battery, orientation, wakelock
├── audio/audio.js       # Web Audio synth
├── render/              # Single rAF loop + drawables
└── entities/            # Fish, spawner, types
```

Engineering guide for humans/AI: **[CLAUDE.md](./CLAUDE.md)**.

## Tech stack

- Vanilla JavaScript (ES modules)
- HTML5 Canvas
- Web APIs: Battery Status, DeviceOrientation, WakeLock, Web Audio, Vibration, Web Share, Service Worker
- No build step — native modules

## License

[MIT](./LICENSE) — © 2026 Emirkan Kanmaz. Use, modify, sell, just keep the copyright line.

---

<a id="tr"></a>

# Şarjlı Balıkçı 🎣⚡

> 🇬🇧 **[Click for English ↑](#charge-fish-)**

Telefonu **şarja takarak** olta atan, **şarjdan çıkararak** çeken, **eğerek** balığa nişan alan minimal bir web oyunu. Vanilla JS + HTML5 Canvas. PWA olarak ana ekrana eklenebilir, çevrimdışı çalışır.

> "Şarja tak. Eğ. Çek."

## Oynanış

| Aksiyon | Etki |
|---|---|
| Telefonu şarja tak | Olta suya atılır |
| Telefonu sağa/sola eğ | Kanca yatayda hareket eder |
| Balığa denk gelir | Oltada takılır, ip titrer |
| Şarj kablosunu çek | Olta çekilir, balık yakalanır |

Şarj API'si desteklenmiyorsa (iOS Safari, Firefox vs.) ekrana dokunmak charging toggle eder — oyun her şartta oynanır.

## Modlar

- **Serbest** — süre yok, sınır yok
- **Hayatta Kalma** — 30 saniyeyle başla, her yakalama +4 saniye, süre bitince oyun biter

## Özellikler

- 🎯 Eğim sensörü (DeviceOrientation) ile pürüzsüz kontrol + kalibrasyon
- 🔋 Şarj kablosu mekaniği (Battery Status API) + dokunma fallback
- 📏 Derinlik ayarı — şarja takarken hangi derinliğe atacağını seç
- ⏱ Hayatta kalma timer + combo multiplier sistemi (3:2x, 5:3x, 10:5x)
- 🪝 4 upgrade: geniş kanca, hızlı çekim, bereketli sular, mıknatıs
- 🏆 8 achievement, günlük görev
- 🌙 Gerçek saate bağlı gece/gündüz, rastgele yağmur
- 🎨 Renk körlüğü modu (balıklarda pattern)
- 🔊 Synth ses + haptic feedback (ayarlardan kapatılır)
- 🌍 Türkçe / İngilizce otomatik (cihaz diline göre)
- 📲 PWA — ana ekrana ekle, çevrimdışı oyna

## Platform desteği

| Platform | Şarj | Eğim | Notlar |
|---|---|---|---|
| Android Chrome | ✅ Native | ✅ | Önerilen |
| Android Firefox | ⚠️ Dokunma | ✅ | Battery API yok, fallback aktif |
| iOS Safari | ⚠️ Dokunma | ✅ İzinle | Hareket sensörü izni sorulur, şarj için dokunma fallback |
| Masaüstü Chrome | ⚠️ Dokunma | ❌ | `?gamma=manual` ile klavye simülasyonu |

## Yerel test (HTTPS gerekli)

Sensör API'leri secure context ister:

```bash
# Self-signed cert (bir kez)
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem \
  -days 365 -nodes -subj "/CN=192.168.1.x" \
  -addext "subjectAltName=IP:192.168.1.x,DNS:localhost"

# Sunucuyu başlat
python3 serve.py
```

Aynı Wi-Fi'daki telefondan `https://<bilgisayar-ip>:8443` aç → cert uyarısını **Advanced → Proceed** ile geç.

## Yayınlama

Tüm statik dosyalar tek klasörde, herhangi bir HTTPS sunucusuna yüklenebilir. Detaylı paylaşım rehberi: **[DEPLOY.md](./DEPLOY.md)**.

Hızlı yol (Hostinger/shared hosting):
1. `charge-fish.zip` paketini oluştur:
   ```bash
   zip -r charge-fish.zip index.html styles.css src/ icons/ \
     manifest.webmanifest service-worker.js .htaccess LICENSE \
     -x "*.DS_Store" "*/.*"
   ```
2. cPanel/File Manager → `public_html/charge-fish/` → upload + extract
3. `https://example.com/charge-fish/` üzerinden açılır

## Debug flag'leri

| Flag | Etki |
|---|---|
| `?debug=1` | Ekrana state/charging/gamma/coins overlay |
| `?state=FISHING` | Başlangıç state'ini zorla |
| `?fakeCharging=1` | Battery yerine dokunma toggle |
| `?gamma=manual` | Sol/sağ ok ile gamma simülasyonu |
| `?lang=tr` / `?lang=en` | Dil zorla |

## Mimari

```
src/
├── main.js              # Entry, UI flow orchestrator
├── game.js              # State machine (IDLE/CASTING/FISHING/HOOKED/REELING)
├── config.js            # Tüm sabitler
├── i18n.js              # tr/en sözlük (TR: "Şarjlı Balıkçı", EN: "Charge Fish")
├── settings.js          # Sound/haptic/colorblind/sensitivity
├── storage.js           # Highscore + lifetime stats
├── combo.js             # Streak multiplier
├── achievements.js      # 8 badge
├── quests.js            # Daily quest
├── upgrades.js          # 4 satın alınabilir upgrade
├── haptic.js            # Vibration wrapper
├── catch.js             # Collision detection
├── events.js            # State → audio/particle/storage bridge
├── modes/mode.js        # Free / Survival
├── sensors/             # battery, orientation, wakelock
├── audio/audio.js       # Web Audio synth
├── render/              # Tek rAF loop + drawables
└── entities/            # Fish, fish spawner, types
```

İnsan/AI çalışan rehberi: **[CLAUDE.md](./CLAUDE.md)**.

## Tech stack

- Vanilla JavaScript (ES modules)
- HTML5 Canvas
- Web APIs: Battery Status, DeviceOrientation, WakeLock, Web Audio, Vibration, Web Share, Service Worker
- Build adımı yok — native modules

## Lisans

[MIT](./LICENSE) — © 2026 Emirkan Kanmaz. Kullan, değiştir, kendi projende sat, sadece copyright satırını koru.
