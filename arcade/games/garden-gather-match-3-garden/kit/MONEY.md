# kit/money.js: free-to-play money for AGENTPARK games

One file (CSS is injected by the JS). Coins, lives, opt-in reward videos, capped break ads, one shared store in three
art styles. Demo with a button for every call: `kit/money-demo.html` (add `?style=B`, `?manual=1` under Playwright).

## Wire it (5 minutes)
```js
import { money } from '../kit/money.js';
const M = money({ game: 'mochi-match', style: 'B' });          // 'A' Hero Lab 3D · 'B' Kawaii Pop · 'C' Storybook Garden

M.onChange(s => hud(s.coins, s.lives));                        // s = { coins, lives:{n,max,nextAt,unlimited?}, adFree, pass, passUntil }
addEventListener('ap:ad', e => e.detail.phase === 'start' ? pauseMusic() : resumeMusic());   // or money({ onAdStart, onAdEnd }) / M.onAd(fn)

// level start
if (!M.useLife()) return showOutOfLives();                      // false = no lives: offer M.rewarded('lives') or M.shop()
// fail screen: ONE offer
if (await M.rewarded('moves')) { moves += 5; resume(); }
// win screen
M.add(coinsWon, 'win');
if (await M.rewarded('double')) M.add(coinsWon, 'double');
await M.breakAd('level-end', { level });                        // then show the next level (the kit may show nothing: fine)
// boosters / hints
if (M.spend(100, 'hint')) showHint(); else M.shop();
```

## API
| call | returns | notes |
|---|---|---|
| `money({ game, style, onAdStart?, onAdEnd? })` | `M` | one instance per game slug (a second call returns the same one) |
| `M.coins()` / `M.add(n, reason)` / `M.spend(n, reason)` | number / new balance / bool | wallet `ap_wallet` is shared by all games; each game keeps its own ledger. New wallets start with 100 coins. |
| `M.onChange(fn)` | unsubscribe fn | fires on every change, including other tabs; also `window` event `ap:money` |
| `await M.rewarded(placement, { what?, title? })` | bool | `hint` `moves` `revive` `double` `lives` (others fall back to "Free bonus"). Sheet says exactly what you get → ad → `true` only if earned. `lives` refills lives itself; every other reward the game applies. `what` overrides the "you get" line (e.g. `'240 coins instead of 120'`). |
| `await M.breakAd(placement, { level? })` | bool (shown) | natural breaks only. Pass `{ level }` or let `'level-end'` calls count levels. |
| `M.level(n)` | level | tell the kit the current level if you call `breakAd` with other placements (`'menu'`) |
| `M.shop()` | Promise (resolves when closed) | the one store sheet |
| `await M.buy(sku)` | bool | `coins_s` `coins_m` `coins_l` `remove_ads` `season_pass` `starter_pack` |
| `M.adFree()` / `M.hasPass()` | bool | adFree = remove_ads, or Season pass, or the iOS app says the session is ad-free |
| `M.lives()` / `M.useLife()` / `M.refillLives()` | `{n,max,nextAt}` / bool / lives | 5 max, +1 every 20 min. Pass or starter-pack day: `{ unlimited: true }`, `useLife()` always true |
| `M.onAd(fn)` | unsubscribe | `fn('start'|'end', { type, placement })` |
| `M.toast(text)`, `M.skus`, `M.rewards` | | small themed toast; the catalog |
| `M.debug()` / `M.reset()` | state / state | QA: coins, ledgers, purchases, ad counters, `ads.last.reason`, `ads.nextBreakBlockedBy`, env (embed, inApp, bot, provider, pay). `window.__money[slug]` has every instance. |

Additions beyond BATCH12.md (all optional): `rewarded(p, { what, title })`, `breakAd(p, { level })`, `M.level()`,
`M.onAd()`, `money({ onAdStart, onAdEnd })`, `M.toast`, `M.skus`, `M.reset`. `M.shop()` returns a promise.

## The catalog (test prices; a payment provider may override with `AP_PAY.prices`)
| sku | gives | price |
|---|---|---|
| `coins_s` | 250 coins | $0.99 |
| `coins_m` | 1,500 coins (Popular) | $4.99 |
| `coins_l` | 4,000 coins (Best value) | $9.99 |
| `remove_ads` | no break ads in this game, for good; reward videos stay opt-in | $2.99 |
| `season_pass` | 30 days: no break ads, rewards without watching, unlimited lives, +100 coins/day | $4.99 |
| `starter_pack` | once only: 1,000 coins + full lives + 24 h unlimited lives | $1.99 |

## Caps the kit enforces (games can't break them)
- **One sheet or ad on screen at a time.** A call while another is open resolves `false` and shows nothing.
- **Reward videos:** always opt-in; the sheet names the reward before anything plays; "No thanks" / Esc / × = `false`.
  Season pass or the app's ad-free session: the reward is given without a video.
- **Break ads** (`breakAd`) show nothing when any of these is true (see `M.debug().ads.last.reason`):
  `?embed=chat` · the iOS app · adFree (remove_ads / pass / app) · the site's `RIFFCADE.ADS_FORCED` is not `true`
  (Daniel's "no forced ads" promise, today on agentpark.co) · level < 4 · < 3 min since any ad · < 3 levels since the last
  break · a sheet is open · the tab is hidden · no ad network and not a test host (placeholders only on localhost /
  `?adtest` / `?demo` / webdriver).
- **Never mid-level:** call `breakAd` only between levels or on a menu. Never more than one offer per screen (game rule).
- **Bots:** `navigator.webdriver` or `?demo` → sheets auto-answer and ads finish in < 1 s. `?manual=1` turns that off.
- Sheets: phone-first bottom sheet, tap targets ≥ 48 px (≥ 56 px in style C, body text ≥ 20 px), Esc closes, Tab stays
  inside, focus returns, `prefers-reduced-motion` turns animation off. Taps/keys on a sheet never reach the game.
- **Audio:** during any ad the kit suspends every `AudioContext` the page made and pauses playing `<audio>/<video>`,
  fires `ap:ad` / `ap:adstart` / `ap:adend` and `onAdStart/onAdEnd`. Games should also pause their own loop/music.

## The iOS app (AGENTPARK, 3:00 ad-free timer)
The app loads games directly in a WKWebView and runs its own between-game ads and timer, so inside it the kit **never
shows break ads**. It detects the app by `window.AP_APP`, `?app=ios`, an `AgentPark` user agent, or a bare iOS WKWebView.
To make reward videos free once the session is ad-free, the app can inject (WKUserScript, document start)
`window.AP_APP = { inApp: true, adFree: <bool> }` and, when the timer hits, run
`dispatchEvent(new CustomEvent('ap:app', { detail: { adFree: true } }))`. Nothing in the app needs to change today.

## Plugging in a real ad network
Provider order: `window.AP_ADS` → Google H5 Games Ads (`window.adBreak`, own frame or same-origin parent) → the site's
`RiffAds` (only when `RIFFCADE.ADS_ENABLED`) → the test placeholder.
- **Google H5 Games Ads / AdSense for Games** (recommended; built for HTML5 games, has `reward` + `next`): put the
  AdSense tag with `data-ad-frequency-hint="180s"` (+ `data-adbreak-test="on"` while testing) and
  `window.adsbygoogle = window.adsbygoogle || []; var adBreak = adConfig = function(o){ adsbygoogle.push(o); }`
  on the game page (or on play.html; the kit calls the parent's `adBreak` when the game is in a same-origin iframe).
  The kit calls `adConfig({ sound:'on', preloadAdBreaks:'on' })` once, `adBreak({ type:'reward', … })` for rewards
  (granted only on `adViewed`) and `adBreak({ type:'next', … })` for breaks. No fill → `false`, a toast, nothing else.
- **Anything else** (Ad Manager rewarded, Ezoic `rewardedBreak`, AppLovin in the app): set
  ```js
  window.AP_ADS = {
    rewarded: async (placement, { game }) => ({ completed: true|false }),   // or true/false
    interstitial: async (placement, { game }) => true|false,               // shown?
  };
  ```
  The kit still shows its own opt-in sheet first and keeps every cap above.

## Plugging in payments (Stripe Checkout)
Set `window.AP_PAY` on the page (or same-origin parent) and the test confirm sheet is skipped:
```js
window.AP_PAY = {
  prices: { coins_s: '€1.09' },                                   // optional local prices shown in the store
  buy: async (sku, { game, price, title, coins }) => {            // open Checkout, resolve when paid
    const r = await fetch('https://mcp.riffcade.com/api/pay/session', { method: 'POST', body: JSON.stringify({ sku, game }) });
    // redirect / popup to Stripe Checkout, poll the webhook-confirmed order, then:
    return { ok: true, receipt: 'cs_…' };
  },
};
```
Grant only after the server sees Stripe's `checkout.session.completed` webhook. Purchases are recorded with `test:false`.
Note: coins are client-side (localStorage); for real money, mirror purchases server-side by install/user id so they
survive a cleared browser (and so `restore` can be added).

## Storage
`ap_wallet` = `{ coins, ledger[≤100] }` shared · `ap_money_<slug>` = lives, purchases, adFree, passUntil, starter,
ad counters, ledger[≤50]. All access is try/catch: blocked storage just means nothing persists.
