# Charge Fish — Paylaşma & Deployment Rehberi

Oyun **tamamen statik** (HTML/CSS/JS, sunucu kodu yok). Herhangi bir HTTPS sunucusu yeterli. Aşağıda en kolay yoldan en kapsamlısına seçenekler.

---

## Yayınlama yolları

### 🥇 1. Hostinger / shared hosting subdirectory (en hızlı, kendi domain)

**URL örneği:** `https://emirkanmaz.com/charge-fish/`

```bash
# Paketi üret
zip -r charge-fish.zip index.html styles.css src/ icons/ \
  manifest.webmanifest service-worker.js .htaccess \
  -x "*.DS_Store" "*/.*"
```

Hostinger hPanel → **File Manager** → `public_html/` → New Folder `charge-fish` → Upload `charge-fish.zip` → sağ tık **Extract** → ZIP'i sil.

`.htaccess` zaten ZIP'in içinde — WordPress rewrite'larını es geçer, CSP/HSTS/güvenlik header'larını koyar.

**Avantaj:** ücretsiz (zaten ödüyorsun), kendi domain'in, HTTPS hazır (Let's Encrypt).
**Dezavantaj:** her güncellemede manuel zip + upload.

---

### 🥈 2. Subdomain (daha temiz görünüm)

**URL örneği:** `https://oyun.emirkanmaz.com/`

Hostinger hPanel → **Domains → Subdomains** → "Create Subdomain" → `oyun`.

Üretilen `public_html/oyun/` klasörüne ZIP'i upload + extract. `.htaccess`'e gerek **yok** (subdomain WP'den izole). Otomatik HTTPS sertifikası 5-10 dakikada gelir.

**Avantaj:** root gibi davranır (`/`), URL şık.

---

### 🥉 3. Vercel / Netlify (push-to-deploy)

GitHub repo → Vercel veya Netlify hesabına bağla → otomatik deploy. Her `git push` 30 saniyede yayınlanır.

```bash
git init && git add . && git commit -m "Initial commit"
gh repo create charge-fish --public --source=. --push
```

- **Vercel:** [vercel.com](https://vercel.com) → "Import Project" → repo seç → Deploy. URL: `charge-fish.vercel.app`
- **Netlify:** [netlify.com](https://netlify.com) → "Add new site" → Import from Git → Deploy. URL: `charge-fish.netlify.app`

Custom domain: ikisi de Hostinger DNS'inde CNAME ile bağlanabilir.

**Avantaj:** otomatik HTTPS, push-to-deploy, ücretsiz, CDN, preview URL'leri.

---

### 4. GitHub Pages

```bash
gh repo create charge-fish --public --source=. --push
```

Repo settings → **Pages** → Source: `main` branch, `/ (root)` → Save. 1-2 dakika sonra `https://<username>.github.io/charge-fish/`.

---

### 5. itch.io (web oyun community)

[itch.io](https://itch.io/game/new) → "Create new project" → Kind: **HTML** → ZIP yükle → "This file will be played in the browser" işaretle.

itch.io kendi sayfa şablonunda oyununu sunar (yorumlar, oy, takipçi). Web oyun community'sine doğal kanal.

---

### 6. Cloudflare Pages (CDN hız)

[pages.cloudflare.com](https://pages.cloudflare.com) → GitHub repo bağla → otomatik deploy. Ücretsiz, global CDN üzerinden.

---

## Yayınladıktan sonra: paylaşma yolları

### 📱 URL'i kısalt + QR kod

QR kod ile telefondan açma süresi 2 saniyeye iner — en güçlü kanal.

- **QR generator:** [qr-code-generator.com](https://www.qr-code-generator.com/) veya:
  ```bash
  brew install qrencode
  qrencode -o charge-fish-qr.png "https://emirkanmaz.com/charge-fish/"
  ```
- QR'i Instagram story'sine, masaüstü duvar kâğıdına, sticker'a koy.

### 🔗 URL kısaltma (opsiyonel)

[is.gd](https://is.gd) veya [tinyurl.com](https://tinyurl.com) ile `https://emirkanmaz.com/charge-fish/` → `is.gd/cfish` benzeri kısa link.

### 📲 PWA olarak yükleme (kullanıcıya öner)

Android Chrome'da oyuna girdiğinde **"⤓ Ana ekrana ekle"** butonu görünür (kodda zaten var). Bir kez tıklayınca uygulama çekmecesinde simge olur, çevrimdışı çalışır, URL bar yok.

Paylaşım mesajında belirt: **"Aç → 'Ana ekrana ekle' de, uygulama gibi yüklensin."**

### 📢 Sosyal medya

- **Instagram Story:** QR kod + 15-30 sn gameplay reel. Story'ye link sticker
- **TikTok:** Şarj kablosu mekaniği viral potansiyeli yüksek — gerçek kabloyu takıp/çekme + ekran kaydı
- **Twitter/X:** Kısa GIF + URL. Hashtag: `#indiedev #webgame #pwa #yapay`
- **LinkedIn:** "Web platformu nereye geldi" tonuyla — Battery API + DeviceOrientation kullanımı geliştiriciler ilgisini çeker
- **WhatsApp grupları:** Direkt URL + "telefonda aç" notu
- **Discord topluluklar:** indie game, webdev kanalları

### 🎬 GIF / video kayıt

- **Mac + telefon:** QuickTime → Yeni Ekran Kaydı → "iPhone/Android cihaz" seç (USB ile bağla)
- **Android only:** Built-in Screen Recorder veya `scrcpy`
- **GIF dönüştürme:** [ezgif.com/video-to-gif](https://ezgif.com/video-to-gif)

### 📰 Topluluk paylaşımları

- **r/webgames** (Reddit) — web oyun spesifik
- **r/AndroidApps** — Battery API kullanımı ilgi çekecek
- **r/PWA** — PWA olarak öne çıkar
- **Hacker News** "Show HN: Charge Fish — a fishing game played via your charge cable"
- **Product Hunt** — daha cilalı bir launch için (bir hafta önceden teaser)
- **Türkçe için: Eksisozluk, donanimhaber, webtekno** — yerel yayım

### 🔄 Güncellemeleri yayınlama

Yeni sürüm yüklediğinde **`service-worker.js`** ilk satırındaki `CACHE_NAME`'i bumpla:

```js
const CACHE_NAME = 'chargefish-v1';  // → 'chargefish-v2', 'v3', ...
```

Yoksa kullanıcılar eski cache'i görür, güncellemeler 24-48 saat sonrasına kadar gelmez.

---

## Paylaşım checklist (ilk yayın öncesi)

- [ ] `LICENSE` dosyası ekle (MIT öneriyorum)
- [ ] `manifest.webmanifest`'te `description` doğru
- [ ] `index.html`'de `og:title`, `og:description`, `og:image` meta'lar (Twitter/WhatsApp önizleme için)
- [ ] Favicon hâlâ `icon-192.svg` — istersen `favicon.ico` ekle
- [ ] HTTPS kesin çalışıyor mu, cert geçerli mi?
- [ ] Service worker register oluyor mu? DevTools → Application → Service Workers
- [ ] iOS Safari'de test (Battery API yok, dokunma fallback çalışsın)
- [ ] Cellular data ile aç — yükleme boyutu kabul edilebilir mi (~50KB)
- [ ] Skor sıfırla → "Ana ekrana ekle" → tekrar aç → skor kalmış mı?
- [ ] Lighthouse PWA skoru ≥ 90 mı? Chrome DevTools → Lighthouse → Mobile + PWA

---

## Önerilen yayın akışı

1. **Hostinger subdirectory** ile başla (5 dakika, kendi domain)
2. QR kod üret + Instagram story'sine koy
3. Vercel/Netlify'a da kopya yükle (yedek + push-to-deploy hız)
4. Türkçe için: yerel forum/grup, **Şarjlı Balıkçı** adıyla paylaş
5. İngilizce için: r/webgames + Show HN, **Charge Fish** adıyla
6. Geri bildirim al, version bump et
