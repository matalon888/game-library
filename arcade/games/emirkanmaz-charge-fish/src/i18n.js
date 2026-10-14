// Locale detection + string lookup. Locale resolution order:
//   1. ?lang=tr / ?lang=en  (URL override for testing)
//   2. navigator.language    (device locale)
//   3. fallback: 'en'

const STRINGS = {
  tr: {
    title: 'Şarjlı Balıkçı',
    tagline: 'Şarja tak. Eğ. Çek.',
    taglineTap: 'Dokun. Eğ. Tekrar dokun.',
    bestPrefix: 'en iyi',
    depthShallow: 'SIĞ',
    depthDeep: 'DERİN',

    compatHttps: 'HTTPS gerekli (secure context).',
    compatBattery: 'Şarj algılama yok — ekrana dokunarak oynayabilirsin.',
    compatOrientation: 'Hareket sensörü desteklenmiyor.',
    iosPermissionDenied: 'Hareket sensörü reddedildi — dokunarak oynayabilirsin.',

    // Mode selection
    modeSelectTitle: 'Bir mod seç',
    modeSelectIntro: 'Telefonu eğerek oynayacağın bir balık tutma oyunu.',
    modeFreeTitle: 'Serbest Mod',
    modeFreeDesc: 'Süre yok, sınır yok. İstediğin kadar balık tut.',
    modeSurvivalTitle: 'Hayatta Kalma',
    modeSurvivalDesc: '30 saniyeyle başla. Her yakalanan balık +4 saniye kazandırır. Süre biterse oyun biter.',
    settingsButton: '⚙ Ayarlar',
    upgradesButton: '🪝 Geliştirmeler',
    installButton: '⤓ Ana ekrana ekle',
    questHeader: 'Bugünün Görevi',
    questReward: 'ödül',
    questCompleted: 'Tamamlandı! +{n} puan',

    // Calibration / onboarding
    calibTitle: 'Telefonunu rahat tutuşuna getir',
    calibBody: 'Oturarak, ayakta, yatarken — nasıl rahat oynayacaksan o duruşa geç. Aşağıdaki gösterge ortada olduğunda yön doğru ayarlanmış demektir. Sağa/sola eğince gösterge kayar.',
    calibStart: 'Bu duruşu kaydet ve başla',
    calibLeft: 'sol',
    calibRight: 'sağ',

    // In-game UI
    backToMenu: '← Menü',
    recenter: '🧭 Yönü Sıfırla',
    survivalTimeLeft: 'kalan süre',

    // Game over
    overTitle: 'Süre doldu!',
    overSurvivedLabel: 'Hayatta kaldığın süre',
    overScoreLabel: 'Skor',
    overCatchesLabel: 'Yakaladığın balık',
    overAgain: 'Tekrar oyna',
    overBack: 'Ana menü',
    overShare: '📤 Paylaş',
    shareText: 'Şarjlı Balıkçı\'da {time} hayatta kaldım, skorum {score}! 🎣',

    // State hints
    hintIdleCharge: 'Şarja tak',
    hintIdleTap: 'Oynamak için ekrana dokun',
    hintFishingCharge: 'Telefonu eğ ve bekle',
    hintFishingTap: 'Telefonu eğ ve bekle (çekmek için dokun)',
    hintHookedCharge: 'Çek! Şarjı çıkar!',
    hintHookedTap: 'Çek! Ekrana dokun!',

    // Settings overlay
    settingsTitle: 'Ayarlar',
    settingsSound: 'Ses',
    settingsHaptic: 'Titreşim',
    settingsColorBlind: 'Renk körü desteği',
    settingsSensitivity: 'Eğim hassasiyeti',
    settingsClose: 'Kapat',

    // Upgrades overlay
    upgTitle: 'Geliştirmeler',
    upgCoins: 'Para',
    upgLevel: 'Seviye',
    upgMax: 'Maks',
    upgBuy: 'Satın al',
    upgClose: 'Kapat',
    upgHitboxTitle: 'Geniş Kanca',
    upgHitboxDesc: 'Balıkları yakalama alanı büyür.',
    upgReelTitle: 'Hızlı Çekim',
    upgReelDesc: 'Olta çekme animasyonu hızlanır.',
    upgSpawnTitle: 'Bereketli Sular',
    upgSpawnDesc: 'Balıklar daha sık ortaya çıkar.',
    upgMagnetTitle: 'Mıknatıs',
    upgMagnetDesc: 'Yakın balıklar kancaya doğru çekilir.',

    // Quests
    questCatch10Title: '10 balık yakala',
    questCatch20Title: '20 balık yakala',
    questGolden1Title: 'Altın balık yakala',
    questScore50Title: 'Tek turda 50 puan topla',
    questCompleteToast: 'Görev tamamlandı! +{n}',

    // Achievements
    achFirstCatchTitle: 'İlk Yakalama',
    achFirstCatchDesc: 'İlk balığını yakaladın.',
    achTenTitle: 'Acemi Balıkçı',
    achTenDesc: 'Toplam 10 balık yakaladın.',
    achFiftyTitle: 'Usta Balıkçı',
    achFiftyDesc: 'Toplam 50 balık yakaladın.',
    achGoldenTitle: 'Altın Yakaladım',
    achGoldenDesc: 'İlk altın balığını yakaladın.',
    achCombo5Title: '5\'li Combo',
    achCombo5Desc: 'Üst üste 5 balık yakaladın.',
    achCombo10Title: '10\'lu Combo',
    achCombo10Desc: 'Üst üste 10 balık yakaladın.',
    achSurvived60Title: 'Bir Dakika!',
    achSurvived60Desc: 'Hayatta kalma modunda 1 dakikayı geçtin.',
    achScore100Title: 'Yüzlük',
    achScore100Desc: '100 puana ulaştın.',
  },
  en: {
    title: 'Charge Fish',
    tagline: 'Plug in. Tilt. Reel out.',
    taglineTap: 'Tap. Tilt. Tap again.',
    bestPrefix: 'best',
    depthShallow: 'SHALLOW',
    depthDeep: 'DEEP',

    compatHttps: 'HTTPS required (secure context).',
    compatBattery: 'Charge detection unavailable — tap the screen to play.',
    compatOrientation: 'Motion sensor unavailable.',
    iosPermissionDenied: 'Motion sensor denied — tap to play instead.',

    modeSelectTitle: 'Choose a mode',
    modeSelectIntro: 'A fishing game played by tilting your phone.',
    modeFreeTitle: 'Free Play',
    modeFreeDesc: 'No timer, no limits. Catch as many fish as you want.',
    modeSurvivalTitle: 'Survival',
    modeSurvivalDesc: 'Starts with 30 seconds. Each catch adds +4 seconds. If the timer runs out, the game ends.',
    settingsButton: '⚙ Settings',
    upgradesButton: '🪝 Upgrades',
    installButton: '⤓ Install app',
    questHeader: 'Today’s quest',
    questReward: 'reward',
    questCompleted: 'Completed! +{n} pts',

    calibTitle: 'Get comfortable with your phone',
    calibBody: 'Sitting, standing, lying down — pick whatever posture feels right. When the indicator below sits in the middle, your neutral tilt is set. Tilting left or right will move it.',
    calibStart: 'Save this posture and start',
    calibLeft: 'left',
    calibRight: 'right',

    backToMenu: '← Menu',
    recenter: '🧭 Recenter',
    survivalTimeLeft: 'time left',

    overTitle: 'Time’s up!',
    overSurvivedLabel: 'You survived',
    overScoreLabel: 'Score',
    overCatchesLabel: 'Fish caught',
    overAgain: 'Play again',
    overBack: 'Main menu',
    overShare: '📤 Share',
    shareText: 'I survived {time} in Charge Fish and scored {score}! 🎣',

    hintIdleCharge: 'Plug in the charger',
    hintIdleTap: 'Tap the screen to cast',
    hintFishingCharge: 'Tilt your phone and wait',
    hintFishingTap: 'Tilt and wait (tap to reel in)',
    hintHookedCharge: 'Reel in! Unplug the charger!',
    hintHookedTap: 'Reel in! Tap now!',

    settingsTitle: 'Settings',
    settingsSound: 'Sound',
    settingsHaptic: 'Haptic',
    settingsColorBlind: 'Color-blind mode',
    settingsSensitivity: 'Tilt sensitivity',
    settingsClose: 'Close',

    upgTitle: 'Upgrades',
    upgCoins: 'Coins',
    upgLevel: 'Level',
    upgMax: 'Max',
    upgBuy: 'Buy',
    upgClose: 'Close',
    upgHitboxTitle: 'Wider Hook',
    upgHitboxDesc: 'Larger catch zone around the hook.',
    upgReelTitle: 'Quick Reel',
    upgReelDesc: 'Reel-in animation finishes faster.',
    upgSpawnTitle: 'Plenty of Fish',
    upgSpawnDesc: 'Fish appear more often.',
    upgMagnetTitle: 'Magnet',
    upgMagnetDesc: 'Nearby fish get pulled toward the hook.',

    questCatch10Title: 'Catch 10 fish',
    questCatch20Title: 'Catch 20 fish',
    questGolden1Title: 'Catch a goldfish',
    questScore50Title: 'Score 50 in one round',
    questCompleteToast: 'Quest complete! +{n}',

    achFirstCatchTitle: 'First Catch',
    achFirstCatchDesc: 'You caught your first fish.',
    achTenTitle: 'Apprentice Angler',
    achTenDesc: 'Total of 10 fish caught.',
    achFiftyTitle: 'Master Angler',
    achFiftyDesc: 'Total of 50 fish caught.',
    achGoldenTitle: 'Golden Touch',
    achGoldenDesc: 'You caught your first goldfish.',
    achCombo5Title: '5x Combo',
    achCombo5Desc: 'Caught five fish in a row.',
    achCombo10Title: '10x Combo',
    achCombo10Desc: 'Caught ten fish in a row.',
    achSurvived60Title: 'One Minute!',
    achSurvived60Desc: 'Survived over 1 minute in survival mode.',
    achScore100Title: 'Century',
    achScore100Desc: 'Reached a score of 100.',
  },
};

function detectLocale() {
  const params = new URLSearchParams(window.location.search);
  const override = params.get('lang');
  if (override === 'tr' || override === 'en') return override;
  const lang = (navigator.language || 'en').toLowerCase();
  return lang.startsWith('tr') ? 'tr' : 'en';
}

const locale = detectLocale();
const dict = STRINGS[locale] ?? STRINGS.en;

export function t(key, vars) {
  let s = dict[key] ?? STRINGS.en[key] ?? key;
  if (vars && typeof s === 'string') {
    for (const [k, v] of Object.entries(vars)) {
      s = s.split('{' + k + '}').join(String(v));
    }
  }
  return s;
}

export function getLocale() {
  return locale;
}
