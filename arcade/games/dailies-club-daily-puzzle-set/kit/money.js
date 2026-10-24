// money.js: the shared free-to-play kit for AGENTPARK's HTML5 games (coins, lives, reward videos, break ads, one store).
// Interface: BATCH12.md "Money". Wiring, caps and how to plug a real ad network / payment provider: kit/MONEY.md.
//
//   import { money } from '../kit/money.js';
//   const M = money({ game: 'mochi-match', style: 'B' });
//   M.coins(); M.add(50, 'win'); M.spend(100, 'hint') /* → bool */; M.onChange(s => hud(s.coins))
//   await M.rewarded('moves')      // opt-in sheet says what you get → ad → true only if the reward was earned
//   await M.breakAd('level-end')   // natural breaks only; the kit applies every cap and may show nothing (→ false)
//   M.shop(); await M.buy('coins_m'); M.adFree(); M.hasPass(); M.lives(); M.useLife(); M.refillLives()
//
// Rules the kit enforces so games can't get them wrong:
//   • one sheet / ad on screen at a time (a second call while one is open resolves false / does nothing)
//   • reward videos are always opt-in and always say exactly what you get before anything plays
//   • break ads: none before level 4, ≥ 3 min after any ad, ≥ 3 levels apart, never when ad-free / Season pass,
//     never in ?embed=chat, never in the iOS app (the app owns its ads and its ad-free timer), never when the site says
//     "no forced ads" (RIFFCADE.ADS_FORCED !== true), and never as an unpaid placeholder on a live host
//   • navigator.webdriver or ?demo: every sheet and ad completes on its own in < 1 s (add ?manual=1 to keep them open)

const Q = new URLSearchParams(location.search);
const PAR = (() => { try { return parent !== window && parent.document ? parent : null; } catch (e) { return null; } })();
const pq = (() => { try { return PAR ? new URLSearchParams(PAR.location.search) : null; } catch (e) { return null; } })();
const EMBED = Q.get('embed') === 'chat' || !!(pq && pq.get('embed') === 'chat');
const BOT = (!!navigator.webdriver || Q.has('demo')) && !Q.has('manual');
const LOCAL = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)$/.test(location.hostname) || location.protocol === 'file:';
const ADTEST = LOCAL || Q.has('adtest') || Q.has('demo') || !!navigator.webdriver;   // placeholder break ads allowed
const UA = navigator.userAgent || '';
// the AGENTPARK iOS app: native sets window.AP_APP = { inApp: true, adFree } (or loads ?app=ios); a bare WKWebView has no "Safari" token
const IOS_WEBVIEW = /iP(hone|ad|od)/.test(UA) && /AppleWebKit/.test(UA) && !/Safari\//.test(UA);
const app = () => window.AP_APP || (PAR && PAR.AP_APP) || null;
const IN_APP = () => !!(app() || Q.get('app') === 'ios' || /AgentPark/i.test(UA) || IOS_WEBVIEW);
const siteCfg = () => window.RIFFCADE || (PAR && PAR.RIFFCADE) || null;
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const MIN = 60e3, REGEN = 20 * MIN, MAX_LIVES = 5, BREAK_GAP = 3 * MIN, BREAK_LEVELS = 3, BREAK_FROM = 4, DAY = 24 * 60 * MIN;
const WALLET = 'ap_wallet', WELCOME = 100;

const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};

// ---------------------------------------------------------------- catalog
export const SKUS = {
  coins_s:      { kind: 'coins', coins: 250,  price: '$0.99', title: 'Pouch of coins' },
  coins_m:      { kind: 'coins', coins: 1500, price: '$4.99', title: 'Chest of coins', tag: 'Popular' },
  coins_l:      { kind: 'coins', coins: 4000, price: '$9.99', title: 'Vault of coins', tag: 'Best value' },
  remove_ads:   { kind: 'remove_ads', price: '$2.99', title: 'Remove ads', line: 'No ads between levels in this game, for good. Reward videos stay optional.' },
  season_pass:  { kind: 'pass', days: 30, price: '$4.99', title: 'Season pass', line: '30 days: no break ads, rewards without videos, unlimited lives, +100 coins a day.' },
  starter_pack: { kind: 'starter', coins: 1000, price: '$1.99', title: 'Starter pack', once: true, line: '1,000 coins + full lives + 24 hours of unlimited lives. Once only.' },
};
const REWARDS = {   // what each reward video gives: the opt-in sheet says this before anything plays
  hint:   { icon: 'bulb',  title: 'Free hint',      get: '1 hint, on us' },
  moves:  { icon: '+5',    title: '+5 moves',       get: '5 extra moves to finish this level' },
  revive: { icon: 'heart', title: 'Second chance',  get: 'Keep playing right where you were' },
  double: { icon: '×2',    title: 'Double coins',   get: 'Twice the coins from this win' },
  lives:  { icon: 'heart', title: 'Full lives',     get: `Lives refilled to ${MAX_LIVES} right now` },
};
const TITLES = { A: 'Shop', B: 'Treat Shop', C: 'The Shop' };

// ---------------------------------------------------------------- audio: suspend every AudioContext + media element during ads
const CTXS = new Set();
for (const n of ['AudioContext', 'webkitAudioContext']) {
  const Orig = window[n];
  if (!Orig || Orig.__apm) continue;
  const Wrapped = class extends Orig { constructor(...a) { super(...a); CTXS.add(this); } };
  Wrapped.__apm = 1;
  try { window[n] = Wrapped; } catch (e) {}
}
let muted = null;
function mute(on) {
  if (on && !muted) {
    muted = { ctx: [], media: [] };
    for (const c of CTXS) if (c.state === 'running') { muted.ctx.push(c); c.suspend().catch(() => {}); }
    document.querySelectorAll('audio,video').forEach(m => { if (!m.paused) { muted.media.push(m); m.pause(); } });
  } else if (!on && muted) {
    for (const c of muted.ctx) c.resume().catch(() => {});
    for (const m of muted.media) m.play().catch(() => {});
    muted = null;
  }
}

// ---------------------------------------------------------------- styles
const CSS = `
.apm-root{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:flex-end;justify-content:center;touch-action:none;
  -webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;font-family:var(--f);color:var(--ink)}
.apm-root h2,.apm-root p,.apm-root b{text-transform:none;opacity:1;letter-spacing:normal}
.apm-back{position:absolute;inset:0;background:var(--scrim);animation:apm-fade .2s ease-out both}
.apm-sheet{position:relative;width:min(440px,100%);max-height:calc(100% - 24px - env(safe-area-inset-top));display:flex;flex-direction:column;
  background:var(--card);border-radius:var(--r) var(--r) 0 0;box-shadow:var(--sh);padding:18px 16px calc(16px + env(safe-area-inset-bottom));
  animation:apm-up .32s cubic-bezier(.2,1.25,.4,1) both;outline:none}
@media (min-height:700px) and (min-width:500px){.apm-root{align-items:center}.apm-sheet{border-radius:var(--r)}}
.apm-x{position:absolute;top:8px;right:8px;width:var(--tap);height:var(--tap);border:0;border-radius:50%;background:var(--xbg);color:var(--ink);
  font:700 22px/1 var(--f);cursor:pointer;display:grid;place-items:center;z-index:2}
.apm-head{display:flex;align-items:center;gap:10px;padding-right:calc(var(--tap) + 4px);min-height:var(--tap)}
.apm-h{margin:0;font:var(--hw) var(--hs)/1.05 var(--fh);color:var(--hc);letter-spacing:var(--hl)}
.apm-bal{margin-left:auto;display:inline-flex;align-items:center;gap:6px;padding:4px 12px 4px 5px;border-radius:99px;background:var(--pill);font:800 var(--bs)/1 var(--f);color:var(--ink)}
.apm-scroll{overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch;margin:12px -4px 0;padding:10px 4px 2px;display:flex;flex-direction:column;gap:10px}
.apm-scroll>*{flex:none}
.apm-coin{display:inline-block;width:1.25em;height:1.25em;flex:none;vertical-align:-.25em}
.apm-tile{position:relative;border:0;cursor:pointer;color:var(--ink);background:var(--tile);border-radius:var(--tr);box-shadow:var(--tsh);
  font:inherit;min-height:var(--tap);text-align:center}
.apm-tile:active{transform:translateY(2px) scale(.99)}
.apm-packs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.apm-pack{display:flex;flex-direction:column;align-items:center;gap:4px;padding:16px 4px 10px}
.apm-pack .apm-pile{height:46px;display:flex;align-items:flex-end;justify-content:center}
.apm-pack .apm-pile svg{width:30px;height:30px;margin:0 -7px}
.apm-pack .apm-mid{display:flex;flex-direction:column;align-items:center;gap:2px}
.apm-pack b{font:800 var(--ns)/1 var(--fh);color:var(--hc)}
.apm-pack small{font-size:var(--ss);opacity:.8}
.apm-price{display:block;min-width:84%;padding:9px 6px;border-radius:99px;background:var(--btn);color:var(--btnc);font:800 var(--ps)/1 var(--f);box-shadow:var(--bsh)}
.apm-tag{position:absolute;top:-8px;left:50%;transform:translateX(-50%);white-space:nowrap;padding:3px 9px;border-radius:99px;background:var(--tagbg);color:var(--tagc);font:800 var(--tg)/1.2 var(--f)}
.apm-row{display:flex;align-items:center;gap:12px;padding:12px;text-align:left}
.apm-row .apm-ic{width:56px;height:56px;flex:none;display:grid;place-items:center;border-radius:var(--ir);background:var(--icbg);color:var(--icc);font:800 22px/1 var(--fh)}
.apm-row .apm-ic svg{width:32px;height:32px}
.apm-row .apm-t{flex:1;min-width:0}.apm-row .apm-t b{display:block;font:800 var(--ns)/1.1 var(--fh);color:var(--hc)}
.apm-row .apm-t span{display:block;font-size:var(--ss);line-height:1.3;opacity:.85;margin-top:3px}
.apm-row .apm-price{min-width:0;width:auto;padding:12px 14px;flex:none}
.apm-row.apm-own{cursor:default;opacity:.75}.apm-row.apm-own .apm-price{background:var(--ownbg);color:var(--ownc);box-shadow:none}
.apm-hero{padding:14px;text-align:left;background:var(--hero);display:flex;gap:12px;align-items:center}
.apm-hero .apm-ic{width:64px;height:64px}
.apm-foot{margin:12px 0 0;text-align:center;font-size:var(--fs);opacity:.75}
.apm-big{display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;padding:6px 4px 0}
.apm-big .apm-ic{width:88px;height:88px;border-radius:50%;display:grid;place-items:center;background:var(--icbg);color:var(--icc);font:800 34px/1 var(--fh);box-shadow:var(--tsh)}
.apm-big .apm-ic svg{width:48px;height:48px}
.apm-big .apm-pile{display:flex;align-items:center}.apm-big .apm-pile svg{width:36px;height:36px;margin:0 -7px}
.apm-big h2{margin:4px 0 0;font:var(--hw) calc(var(--hs) * 1.1)/1.05 var(--fh);color:var(--hc);letter-spacing:var(--hl)}
.apm-big p{margin:0;font-size:var(--bs);line-height:1.35;max-width:30ch}
.apm-acts{display:grid;gap:8px;margin-top:16px}
.apm-b{border:0;cursor:pointer;min-height:var(--tap);border-radius:var(--br);padding:12px 18px;font:800 var(--bts)/1.1 var(--f);display:flex;align-items:center;justify-content:center;gap:8px}
.apm-b1{background:var(--btn);color:var(--btnc);box-shadow:var(--bsh)}
.apm-b1:active{transform:translateY(3px);box-shadow:none}
.apm-b2{background:transparent;color:var(--ink);opacity:.8;font-weight:700}
.apm-test{display:inline-block;margin:0 auto 4px;padding:6px 12px;border-radius:8px;background:var(--testbg);color:var(--testc);font:800 var(--ss)/1.2 var(--f);letter-spacing:.02em}
.apm-was{text-decoration:line-through;opacity:.6;margin-right:6px}
.apm-b:focus-visible,.apm-tile:focus-visible,.apm-x:focus-visible{outline:3px solid var(--focus);outline-offset:2px}
/* ad layer (placeholder) */
.apm-ad{position:fixed;inset:0;z-index:2147483001;background:#0d0d12;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;
  font:600 16px/1.3 system-ui,sans-serif;touch-action:none;animation:apm-fade .15s both}
.apm-ad .apm-lbl{position:absolute;top:calc(12px + env(safe-area-inset-top));left:12px;padding:5px 10px;border-radius:6px;background:#ffd23f;color:#111;font:800 13px/1 system-ui,sans-serif;letter-spacing:.04em}
.apm-ad .apm-cr{width:min(320px,84vw);aspect-ratio:1.2;border-radius:18px;border:2px dashed rgba(255,255,255,.35);display:grid;place-items:center;text-align:center;padding:16px;color:rgba(255,255,255,.75);font-size:18px}
.apm-ad .apm-ring{width:64px;height:64px}
.apm-ad .apm-ring circle{fill:none;stroke-width:6}.apm-ad .apm-ring .bg{stroke:rgba(255,255,255,.15)}.apm-ad .apm-ring .fg{stroke:#ffd23f;stroke-linecap:round;transform:rotate(-90deg);transform-origin:50% 50%}
.apm-ad .apm-ring text{fill:#fff;font:800 22px system-ui,sans-serif}
.apm-ad button{min-height:48px;min-width:48px;border:0;border-radius:99px;padding:12px 22px;font:800 17px/1 system-ui,sans-serif;cursor:pointer}
.apm-ad .apm-go{background:#ffd23f;color:#111}.apm-ad .apm-go[disabled]{opacity:.35;cursor:default}
.apm-ad .apm-skip{position:absolute;top:calc(6px + env(safe-area-inset-top));right:8px;background:rgba(255,255,255,.12);color:#fff;font-size:15px}
.apm-toast{position:fixed;left:50%;top:calc(16px + env(safe-area-inset-top));transform:translateX(-50%);z-index:2147483002;max-width:calc(100% - 32px);
  padding:12px 18px;border-radius:99px;background:var(--toast,#1e1b33);color:#fff;font:800 17px/1.2 var(--f,system-ui);box-shadow:0 8px 24px rgba(0,0,0,.25);
  pointer-events:none;animation:apm-pop .3s cubic-bezier(.2,1.4,.4,1) both;text-align:center}
.apm-spark{position:absolute;pointer-events:none;color:var(--spark);font-size:18px;animation:apm-tw 1.8s ease-in-out infinite}
@keyframes apm-fade{from{opacity:0}}@keyframes apm-up{from{transform:translateY(100%)}}
@keyframes apm-pop{from{opacity:0;transform:translate(-50%,-12px) scale(.9)}}
@keyframes apm-tw{0%,100%{opacity:.25;transform:scale(.7) rotate(0)}50%{opacity:1;transform:scale(1.15) rotate(20deg)}}
@keyframes apm-jelly{0%,100%{transform:scale(1,1)}40%{transform:scale(1.04,.96)}70%{transform:scale(.98,1.03)}}

/* A · Hero Lab 3D: glossy warm gradients, chunky 3D buttons */
.apm-A{--f:'Baloo 2',system-ui,sans-serif;--fh:'Baloo 2',system-ui,sans-serif;--ink:#4a2a12;--hc:#7a3410;--scrim:rgba(40,16,4,.55);
  --card:linear-gradient(180deg,#fff8e8 0%,#ffe6b8 100%);--r:28px;--sh:0 -10px 40px rgba(60,20,0,.35),inset 0 2px 0 #fff;
  --tap:48px;--xbg:rgba(122,52,16,.12);--hw:800;--hs:30px;--hl:.01em;--bs:17px;--ss:13.5px;--ns:19px;--ps:17px;--tg:12px;--fs:13px;--bts:20px;
  --pill:linear-gradient(180deg,#fff,#ffeccc);--tile:linear-gradient(180deg,#fffdf6,#ffefcf);--tr:20px;
  --tsh:0 4px 0 #e2a85a,0 8px 16px rgba(120,60,0,.18),inset 0 2px 0 #fff;
  --btn:linear-gradient(180deg,#8ee86a 0%,#46c03a 55%,#2f9e2a 100%);--btnc:#fff;--bsh:0 4px 0 #23781f,inset 0 2px 0 rgba(255,255,255,.55);--br:18px;
  --tagbg:linear-gradient(180deg,#ff7a59,#e8452c);--tagc:#fff;--ir:16px;--icbg:linear-gradient(180deg,#ffd76a,#ffab2e);--icc:#7a3410;
  --hero:linear-gradient(135deg,#ffdf8a,#ff9f6a);--ownbg:#e9dcc4;--ownc:#7a5a3a;--testbg:#ffe1d6;--testc:#a22d10;--focus:#2f7bff;--toast:#7a3410;--spark:#fff}
.apm-A .apm-h,.apm-A .apm-big h2{text-shadow:0 2px 0 #fff}
.apm-A .apm-b1,.apm-A .apm-price{text-shadow:0 2px 0 rgba(0,0,0,.18)}
.apm-A .apm-sheet::before{content:'';position:absolute;left:0;right:0;top:0;height:6px;border-radius:28px 28px 0 0;background:linear-gradient(90deg,#ff8a3d,#ffd23f,#ff8a3d)}

/* B · Kawaii Pop: pastel jelly, sparkles, bouncy */
.apm-B{--f:'Baloo 2',system-ui,sans-serif;--fh:'Baloo 2',system-ui,sans-serif;--ink:#5a3a78;--hc:#d23a8c;--scrim:rgba(80,40,120,.45);
  --card:linear-gradient(180deg,#fff0fb 0%,#efe2ff 100%);--r:32px;--sh:0 -8px 40px rgba(150,60,200,.35),inset 0 0 0 3px #fff;
  --tap:48px;--xbg:#fff;--hw:800;--hs:30px;--hl:.01em;--bs:17px;--ss:13.5px;--ns:19px;--ps:17px;--tg:12px;--fs:13px;--bts:20px;
  --pill:#fff;--tile:linear-gradient(180deg,#ffffff,#fde6f6);--tr:24px;--tsh:0 0 0 3px #fff,0 6px 14px rgba(200,90,180,.25),inset 0 -5px 0 rgba(220,140,220,.25);
  --btn:linear-gradient(180deg,#ff9ccc 0%,#ff5fa8 60%,#f0408f 100%);--btnc:#fff;--bsh:0 4px 0 #c42c76,inset 0 3px 0 rgba(255,255,255,.6),0 6px 16px rgba(255,95,168,.4);--br:99px;
  --tagbg:linear-gradient(180deg,#b6f5d6,#6fe0b0);--tagc:#1f6a4e;--ir:22px;--icbg:linear-gradient(180deg,#fff7c2,#ffd6f0);--icc:#d23a8c;
  --hero:linear-gradient(135deg,#d9c6ff,#ffc4e4 60%,#fff2b8);--ownbg:#e6dcf2;--ownc:#8a72a8;--testbg:#fff4b8;--testc:#8a5a00;--focus:#7b5cff;--toast:#d23a8c;--spark:#ffd23f}
.apm-B .apm-h,.apm-B .apm-big h2{text-shadow:0 2px 0 #fff,0 0 12px rgba(255,255,255,.9)}
.apm-B .apm-b1,.apm-B .apm-price{position:relative;overflow:hidden}
.apm-B .apm-b1::after,.apm-B .apm-price::after{content:'';position:absolute;left:12%;right:12%;top:4px;height:38%;border-radius:99px;background:rgba(255,255,255,.4);pointer-events:none}
.apm-B .apm-big .apm-ic{animation:apm-jelly 2.4s ease-in-out infinite}

/* C · Storybook Garden: cream paper, serif, sage / dusty rose / navy / gold leaf, big text */
.apm-C{--f:'Lora',Georgia,serif;--fh:'Cormorant Garamond','Lora',Georgia,serif;--ink:#22304a;--hc:#22304a;--scrim:rgba(34,48,74,.5);
  --card:#fbf6ea;--r:22px;--sh:0 -6px 30px rgba(34,48,74,.3),inset 0 0 0 1px #e7dcc2;
  --tap:56px;--xbg:#efe6d2;--hw:700;--hs:34px;--hl:.01em;--bs:20px;--ss:20px;--ns:24px;--ps:20px;--tg:16px;--fs:18px;--bts:22px;
  --pill:#fffdf6;--tile:#fffdf6;--tr:14px;--tsh:0 0 0 1.5px #c9ab6a,0 3px 8px rgba(34,48,74,.08);
  --btn:#22304a;--btnc:#fbf6ea;--bsh:0 0 0 2px #c9ab6a inset,0 3px 0 #141d2e;--br:14px;
  --tagbg:#c98b8b;--tagc:#fff;--ir:50%;--icbg:#e6eedf;--icc:#4f6b4a;--hero:linear-gradient(135deg,#f4e3df,#e6eedf);
  --ownbg:#e6eedf;--ownc:#4f6b4a;--testbg:#f4e3df;--testc:#7a3b3b;--focus:#b8934a;--toast:#22304a;--spark:#c9ab6a}
.apm-C .apm-sheet{background-image:radial-gradient(rgba(201,171,106,.08) 1px,transparent 1px);background-size:6px 6px}
.apm-C .apm-sheet::before{content:'';position:absolute;inset:8px;border:1px solid #d9c79c;border-radius:16px;pointer-events:none}
.apm-C .apm-h,.apm-C .apm-big h2,.apm-C .apm-row .apm-t b,.apm-C .apm-pack b{font-weight:700}
.apm-C .apm-packs{grid-template-columns:1fr}
.apm-C .apm-pack{flex-direction:row;padding:10px 12px;gap:12px;text-align:left}
.apm-C .apm-pack .apm-pile{width:56px;height:56px;align-items:center}
.apm-C .apm-pack .apm-mid{flex:1;display:flex;flex-direction:column;align-items:flex-start;gap:0}
.apm-C .apm-pack b{font-size:28px;font-variant-numeric:lining-nums}
.apm-C .apm-pack .apm-price{min-width:0;width:auto;padding:14px 16px}
.apm-C .apm-tag{left:auto;right:12px;transform:none}
.apm-C .apm-b1:active{transform:translateY(2px)}

@media (prefers-reduced-motion:reduce){.apm-root *,.apm-back,.apm-sheet,.apm-toast,.apm-ad{animation:none!important;transition:none!important}.apm-spark{display:none}}
`;
let cssDone = false;
function injectCSS() {
  if (cssDone || document.getElementById('apm-css')) return; cssDone = true;
  const s = document.createElement('style'); s.id = 'apm-css'; s.textContent = CSS; document.head.appendChild(s);
  const f = document.createElement('link'); f.rel = 'stylesheet';
  f.href = 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Cormorant+Garamond:wght@600;700&family=Lora:wght@400;600;700&display=swap';
  document.head.appendChild(f);
}

// ---------------------------------------------------------------- icons
const coinSVG = (face) => `<svg class="apm-coin" viewBox="0 0 32 32" aria-hidden="true"><defs><radialGradient id="apmg" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff6b8"/><stop offset=".5" stop-color="#ffcf3a"/><stop offset="1" stop-color="#e09a1c"/></radialGradient></defs>
<circle cx="16" cy="16" r="15" fill="url(#apmg)" stroke="#b97710" stroke-width="1.5"/><circle cx="16" cy="16" r="10.5" fill="none" stroke="#c98a14" stroke-width="1.4" opacity=".7"/>
${face ? '<circle cx="12.5" cy="15" r="1.6" fill="#6a3a08"/><circle cx="19.5" cy="15" r="1.6" fill="#6a3a08"/><path d="M13.5 18.5q2.5 2.4 5 0" stroke="#6a3a08" stroke-width="1.4" fill="none" stroke-linecap="round"/><circle cx="10.5" cy="18" r="1.3" fill="#ff8fb6" opacity=".8"/><circle cx="21.5" cy="18" r="1.3" fill="#ff8fb6" opacity=".8"/>'
  : '<path d="M16 9.5l1.9 4 4.3.5-3.2 2.9.9 4.3-3.9-2.2-3.9 2.2.9-4.3-3.2-2.9 4.3-.5z" fill="#fff3b0" opacity=".9"/>'}</svg>`;
const ICONS = {
  bulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.2 0 3.6 1.2 5.3 3.1 1.7-1.9 3.1-3.1 5.3-3.1 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"/></svg>',
  noads: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="3"/><path d="M7.5 15l1.6-6 1.6 6M8 13.2h2.2M13 9h1.6a3 3 0 0 1 0 6H13z"/><path d="M3 3l18 18" stroke-width="2.4"/></svg>',
  pass: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2.5a2.5 2.5 0 0 0 0 5V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2.5a2.5 2.5 0 0 0 0-5z" opacity=".3"/><path d="M12 7.5l1.4 2.9 3.2.4-2.3 2.2.6 3.1L12 14.6l-2.9 1.5.6-3.1-2.3-2.2 3.2-.4z"/></svg>',
  gift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="9" width="18" height="12" rx="2"/><path d="M3 13h18M12 9v12M12 9c-1.5-3-5-4.5-6-2.5S8.5 9 12 9zm0 0c1.5-3 5-4.5 6-2.5S15.5 9 12 9z"/></svg>',
};
const icon = (k, style) => k === 'coin' ? coinSVG(style === 'B') : ICONS[k] || `<span>${k}</span>`;
const pile = (n, style) => Array.from({ length: n }, () => coinSVG(style === 'B')).join('');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = n => Number(n).toLocaleString('en-US');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------- one sheet at a time (shared by every money() in the page)
let lock = null;          // what owns the screen: 'sheet' | 'ad' | 'flow'
let sheetEl = null;
function toast(text, style = 'A', ms = 2200) {
  injectCSS();
  document.querySelectorAll('.apm-toast').forEach(t => t.remove());
  const t = document.createElement('div'); t.className = `apm-toast apm-${style}`; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite');
  t.innerHTML = text; document.body.appendChild(t); setTimeout(() => t.remove(), ms);
}
const swallow = e => e.stopPropagation();
// sheet(style, html, { label, dismiss, onAct, auto }) → resolves with the act of the tapped [data-act], or `dismiss` (Esc, ×, backdrop)
function sheet(style, html, { label = 'Dialog', dismiss = null, onAct = a => a, auto = null } = {}) {
  injectCSS();
  return new Promise(resolve => {
    const prevFocus = document.activeElement;
    const root = document.createElement('div');
    root.className = `apm-root apm-${style}`;
    root.innerHTML = `<div class="apm-back" data-act="__dismiss"></div><div class="apm-sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}" tabindex="-1">
      <button class="apm-x" data-act="__dismiss" aria-label="Close">×</button>${html}</div>`;
    if (style === 'B' && !RM()) {   // a few twinkles on the kawaii sheet
      const sh = root.querySelector('.apm-sheet');
      [[3, 10], [94, 38], [4, 58], [95, 84], [3, 92]].forEach(([x, y], i) => { const s = document.createElement('span'); s.className = 'apm-spark'; s.textContent = i % 2 ? '✦' : '✧'; s.style.left = x + '%'; s.style.top = y + '%'; s.style.animationDelay = i * .35 + 's'; sh.appendChild(s); });
    }
    // the game never sees taps, drags or keys meant for the sheet
    ['pointerdown', 'pointerup', 'pointermove', 'touchstart', 'touchmove', 'touchend', 'mousedown', 'mouseup', 'click', 'wheel'].forEach(t => root.addEventListener(t, swallow));
    let done = false;
    const close = v => {
      if (done) return; done = true;
      removeEventListener('keydown', key, true); root.remove(); sheetEl = null;
      try { prevFocus && prevFocus.focus && prevFocus.focus({ preventScroll: true }); } catch (e) {}
      resolve(v);
    };
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
      const a = b.dataset.act;
      if (a === '__dismiss') return close(dismiss);
      const r = onAct(a, b); if (r !== undefined) close(r);
    });
    const key = e => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); return close(dismiss); }
      if (e.key === 'Tab') {   // keep focus inside the sheet
        const f = [...root.querySelectorAll('button:not([disabled])')]; if (!f.length) return;
        const i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    };
    addEventListener('keydown', key, true);
    document.body.appendChild(root); sheetEl = root;
    const first = root.querySelector('[data-primary]') || root.querySelector('.apm-sheet');
    try { first.focus({ preventScroll: true }); } catch (e) {}
    if (auto !== null && BOT) setTimeout(() => close(auto), 250);   // bots never stall on a sheet
  });
}

// ---------------------------------------------------------------- ad providers
// order: window.AP_ADS (site/app adapter) → Google H5 Games Ads (adBreak) → the site's RiffAds (only when RIFFCADE.ADS_ENABLED) → placeholder
const own = k => window[k] || (PAR && PAR[k]) || null;
function provider() {
  if (own('AP_ADS')) return 'AP_ADS';
  if (typeof window.adBreak === 'function' || (PAR && typeof PAR.adBreak === 'function')) return 'adBreak';
  const c = siteCfg(); if (PAR && PAR.RiffAds && c && c.ADS_ENABLED) return 'RiffAds';
  return 'placeholder';
}
let adConfigured = false;
function h5() {
  const w = typeof window.adBreak === 'function' ? window : PAR;
  if (!adConfigured && typeof w.adConfig === 'function') { adConfigured = true; try { w.adConfig({ sound: 'on', preloadAdBreaks: 'on' }); } catch (e) {} }
  return w;
}
// placeholder ad: 5 s countdown (bots: 0.3 s). reward: "Skip" any time (no reward); break: Continue after the countdown.
function placeholder(type) {
  injectCSS();
  return new Promise(resolve => {
    const secs = BOT ? 0.3 : 5, C = 2 * Math.PI * 27;
    const o = document.createElement('div'); o.className = 'apm-ad'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', 'Advertisement (test)');
    o.innerHTML = `<div class="apm-lbl">AD · TEST PLACEHOLDER</div>
      ${type === 'reward' ? '<button class="apm-skip" data-a="skip">Skip · no reward</button>' : ''}
      <div class="apm-cr">${type === 'reward' ? 'Reward video plays here' : 'Ad break plays here'}<br><small style="font-size:14px;opacity:.7">No ad network connected yet</small></div>
      <svg class="apm-ring" viewBox="0 0 64 64" aria-hidden="true"><circle class="bg" cx="32" cy="32" r="27"/><circle class="fg" cx="32" cy="32" r="27" stroke-dasharray="${C}" stroke-dashoffset="0"/><text x="32" y="40" text-anchor="middle">${Math.ceil(secs)}</text></svg>
      <button class="apm-go" data-a="go" disabled>${type === 'reward' ? 'Get my reward' : 'Continue'}</button>`;
    ['pointerdown', 'pointerup', 'pointermove', 'touchstart', 'touchmove', 'touchend', 'mousedown', 'mouseup', 'click', 'wheel'].forEach(t => o.addEventListener(t, swallow));
    document.body.appendChild(o);
    const fg = o.querySelector('.fg'), tx = o.querySelector('text'), go = o.querySelector('.apm-go'), t0 = performance.now();
    let finished = false, raf;
    const end = v => { if (finished) return; finished = true; cancelAnimationFrame(raf); removeEventListener('keydown', key, true); o.remove(); resolve(v); };
    const tick = () => {
      const p = Math.min(1, (performance.now() - t0) / (secs * 1000));
      fg.setAttribute('stroke-dashoffset', String(C * p)); tx.textContent = Math.max(0, Math.ceil(secs * (1 - p)));
      if (p < 1) { raf = requestAnimationFrame(tick); return; }
      go.disabled = false; tx.textContent = '✓';
      if (BOT) return end(true);
      go.focus({ preventScroll: true });
    };
    raf = requestAnimationFrame(tick);
    o.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; end(b.dataset.a === 'go'); });
    const key = e => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); if (type === 'reward') end(false); else if (!go.disabled) end(true); } };
    addEventListener('keydown', key, true);
  });
}

// ---------------------------------------------------------------- the kit
const instances = {};
export function money({ game, style = 'A', onAdStart = null, onAdEnd = null } = {}) {
  if (!game) throw new Error('money({ game }) needs the game slug');
  style = ['A', 'B', 'C'].includes(style) ? style : 'A';
  if (instances[game]) { const m = instances[game]; m._style(style); if (onAdStart) m.onAd(p => p === 'start' && onAdStart()); if (onAdEnd) m.onAd(p => p === 'end' && onAdEnd()); return m; }

  const GK = 'ap_money_' + game;
  const fresh = () => ({ lives: { n: MAX_LIVES, at: Date.now() }, purchases: [], adFree: false, passUntil: 0, infUntil: 0, starter: false,
    ads: { level: 0, lastAdAt: 0, lastBreakLevel: -99, breaks: 0, rewarded: 0, last: null }, ledger: [], passDay: 0 });
  let S = Object.assign(fresh(), ls.get(GK, {}));
  S.ads = Object.assign(fresh().ads, S.ads || {});
  let W = ls.get(WALLET, null);
  if (!W || typeof W.coins !== 'number') { W = { coins: WELCOME, ledger: [{ g: game, n: WELCOME, r: 'welcome', t: Date.now() }] }; ls.set(WALLET, W); }
  const saveG = () => ls.set(GK, S);
  const saveW = () => ls.set(WALLET, W);
  const reloadW = () => { const w = ls.get(WALLET, null); if (w && typeof w.coins === 'number') W = w; };

  const subs = new Set(), adSubs = new Set();
  if (onAdStart) adSubs.add(p => p === 'start' && onAdStart());
  if (onAdEnd) adSubs.add(p => p === 'end' && onAdEnd());
  const emit = () => { const s = snap(); subs.forEach(f => { try { f(s); } catch (e) { console.error(e); } }); dispatchEvent(new CustomEvent('ap:money', { detail: s })); };
  addEventListener('storage', e => { if (e.key === WALLET || e.key === GK) { reloadW(); if (e.key === GK) S = Object.assign(fresh(), ls.get(GK, {})); emit(); } });

  function ledger(n, r) {
    const row = { g: game, n, r: String(r || ''), t: Date.now() };
    W.ledger = (W.ledger || []).concat(row).slice(-100); S.ledger = (S.ledger || []).concat({ n: row.n, r: row.r, t: row.t }).slice(-50);
  }
  function add(n, reason = 'reward') {
    n = Math.floor(+n) || 0; if (n <= 0) return W.coins;
    reloadW(); W.coins += n; ledger(n, reason); saveW(); saveG(); emit(); return W.coins;
  }
  function spend(n, reason = 'spend') {
    n = Math.floor(+n) || 0; if (n < 0) return false;
    reloadW(); if (W.coins < n) return false;
    W.coins -= n; ledger(-n, reason); saveW(); saveG(); emit(); return true;
  }

  // lives: 5 max, +1 every 20 min; Season pass / starter-pack hours = unlimited
  const unlimited = () => hasPass() || S.infUntil > Date.now();
  function regen() {
    const L = S.lives, now = Date.now();
    if (L.n >= MAX_LIVES) { L.n = MAX_LIVES; L.at = now; return; }
    const k = Math.floor((now - L.at) / REGEN);
    if (k > 0) { L.n = Math.min(MAX_LIVES, L.n + k); L.at = L.n >= MAX_LIVES ? now : L.at + k * REGEN; saveG(); }
  }
  function lives() {
    if (unlimited()) return { n: MAX_LIVES, max: MAX_LIVES, nextAt: null, unlimited: true };
    regen(); return { n: S.lives.n, max: MAX_LIVES, nextAt: S.lives.n < MAX_LIVES ? S.lives.at + REGEN : null };
  }
  function useLife() {
    if (unlimited()) return true;
    regen(); if (S.lives.n <= 0) return false;
    if (S.lives.n === MAX_LIVES) S.lives.at = Date.now();
    S.lives.n--; saveG(); emit(); return true;
  }
  function refillLives() { S.lives = { n: MAX_LIVES, at: Date.now() }; saveG(); emit(); return lives(); }
  setInterval(() => { if (!unlimited() && S.lives.n < MAX_LIVES) { const before = S.lives.n; regen(); if (S.lives.n !== before) emit(); } }, 15e3);

  const hasPass = () => S.passUntil > Date.now();
  const appAdFree = () => { const a = app(); return !!(a && a.adFree); };
  const adFree = () => !!(S.adFree || hasPass() || appAdFree());
  function snap() {
    return { coins: W.coins, lives: lives(), adFree: adFree(), pass: hasPass(), passUntil: S.passUntil || 0 };
  }
  // the Season pass gift: +100 coins once a day while it runs
  function passGift() { const d = Math.floor(Date.now() / DAY); if (hasPass() && S.passDay !== d) { S.passDay = d; add(100, 'pass-daily'); } }
  passGift();

  function adEvent(phase, type, placement) {
    if (phase === 'start') mute(true); else mute(false);
    dispatchEvent(new CustomEvent('ap:ad', { detail: { phase, type, placement, game } }));
    dispatchEvent(new Event(phase === 'start' ? 'ap:adstart' : 'ap:adend'));
    adSubs.forEach(f => { try { f(phase, { type, placement }); } catch (e) { console.error(e); } });
  }

  // play one ad of `type` ('reward' | 'next') → true if it completed (reward: earned; break: shown)
  async function playAd(type, placement) {
    const p = provider();
    lock = 'ad';
    let ok = false, started = false;
    const start = () => { if (!started) { started = true; adEvent('start', type, placement); } };
    try {
      if (p === 'AP_ADS') {
        const A = own('AP_ADS'); start();
        const r = await (type === 'reward' ? A.rewarded(placement, { game }) : (A.interstitial || A.breakAd).call(A, placement, { game }));
        ok = type === 'reward' ? !!(r === true || (r && (r.completed || r.rewarded))) : r !== false && !(r && r.shown === false);
      } else if (p === 'RiffAds') {
        start();
        const R = PAR.RiffAds; const r = type === 'reward' ? await R.showRewarded() : await R.showInterstitial();
        ok = type === 'reward' ? !!(r && r.completed) : true;
      } else if (p === 'adBreak') {
        ok = await new Promise(res => {
          let settled = false; const fin = v => { if (!settled) { settled = true; clearTimeout(guard); res(v); } };
          const guard = setTimeout(() => fin(false), 12e3);   // nothing came back: no fill
          let viewed = false;
          const o = { type, name: `${game}-${placement}`, beforeAd: start, afterAd: () => {},
            adBreakDone: info => fin(type === 'reward' ? viewed : !!(info && info.breakStatus === 'viewed')) };
          if (type === 'reward') Object.assign(o, { beforeReward: show => show(), adViewed: () => { viewed = true; }, adDismissed: () => { viewed = false; } });
          try { h5().adBreak(o); } catch (e) { fin(false); }
        });
      } else {
        start(); ok = await placeholder(type === 'reward' ? 'reward' : 'break');
      }
    } catch (e) { ok = false; }
    if (started) adEvent('end', type, placement);
    lock = null;
    S.ads.lastAdAt = Date.now(); saveG();
    return ok;
  }

  // ---------------------------------------------------------------- reward videos (opt-in)
  async function rewarded(placement = 'bonus', opts = {}) {
    if (lock) return false;
    const R = Object.assign({ icon: 'gift', title: 'Free bonus', get: 'A free bonus' }, REWARDS[placement] || {});
    const get = opts.what || R.get, title = opts.title || R.title;
    const free = hasPass() || appAdFree();   // pass / app ad-free session: the reward without the video
    lock = 'sheet';
    const yes = await sheet(style, `<div class="apm-big"><div class="apm-ic">${icon(R.icon, style)}</div><h2>${esc(title)}</h2>
      <p>${free ? `${esc(get)}. ${hasPass() ? 'Season pass perk: no video needed.' : 'You are ad-free right now: no video needed.'}`
        : `Watch a short video and you get: <b>${esc(get)}</b>.`}</p></div>
      <div class="apm-acts"><button class="apm-b apm-b1" data-act="yes" data-primary>${free ? 'Get it' : `▶ Watch · ${esc(title)}`}</button>
      <button class="apm-b apm-b2" data-act="no">No thanks</button></div>`, { label: title, dismiss: false, onAct: a => a === 'yes', auto: true });
    lock = null;
    S.ads.last = { kind: 'reward', placement, accepted: yes, t: Date.now() };
    if (!yes) { saveG(); return false; }
    let ok = free ? true : await playAd('reward', placement);
    if (ok) { S.ads.rewarded++; if (placement === 'lives') refillLives(); toast(`✓ ${esc(title)}`, style); }
    else toast(free ? 'Try again' : 'No reward this time · the video did not finish', style);
    S.ads.last.earned = ok; saveG(); emit();
    return ok;
  }

  // ---------------------------------------------------------------- break ads (natural breaks only; the kit applies every cap)
  function level(n) { if (Number.isFinite(+n) && +n > 0) { S.ads.level = Math.floor(+n); saveG(); } return S.ads.level; }
  function breakWhy(now) {
    const c = siteCfg();
    if (EMBED) return 'embed=chat';
    if (IN_APP()) return 'ios-app';
    if (adFree()) return hasPass() ? 'pass' : appAdFree() ? 'app-ad-free' : 'remove_ads';
    if (c && !c.ADS_FORCED) return 'site: no forced ads';
    if (S.ads.level < BREAK_FROM) return `level ${S.ads.level} < ${BREAK_FROM}`;
    if (now - S.ads.lastAdAt < BREAK_GAP) return `${Math.round((now - S.ads.lastAdAt) / 1000)}s since last ad < 180s`;
    if (S.ads.level - S.ads.lastBreakLevel < BREAK_LEVELS) return `${S.ads.level - S.ads.lastBreakLevel} levels since last break < ${BREAK_LEVELS}`;
    if (lock || sheetEl) return 'sheet open';
    if (document.hidden) return 'hidden';
    if (provider() === 'placeholder' && !ADTEST) return 'no ad network (placeholder only in test)';
    return '';
  }
  async function breakAd(placement = 'level-end', opts = {}) {
    if (opts.level) level(opts.level);
    else if (placement === 'level-end') { S.ads.level++; saveG(); }   // no level passed: count finished levels ourselves
    const now = Date.now(), why = breakWhy(now);
    S.ads.last = { kind: 'break', placement, level: S.ads.level, shown: false, reason: why || 'ok', t: now };
    if (why) { saveG(); return false; }
    const shown = await playAd('next', placement);
    if (shown) { S.ads.breaks++; S.ads.lastBreakLevel = S.ads.level; }
    S.ads.last.shown = shown; saveG();
    return shown;
  }

  // ---------------------------------------------------------------- store
  const pay = () => own('AP_PAY');
  const price = sku => { const p = pay(); return (p && p.prices && p.prices[sku]) || SKUS[sku].price; };
  const owned = sku => sku === 'remove_ads' ? S.adFree : sku === 'starter_pack' ? S.starter : false;
  function grant(sku, test) {
    const k = SKUS[sku];
    S.purchases = (S.purchases || []).concat({ sku, t: Date.now(), test, price: price(sku) }).slice(-100);
    if (k.kind === 'coins') add(k.coins, 'buy:' + sku);
    if (k.kind === 'remove_ads') S.adFree = true;
    if (k.kind === 'pass') { S.passUntil = Math.max(Date.now(), S.passUntil || 0) + k.days * DAY; passGift(); }
    if (k.kind === 'starter') { S.starter = true; add(k.coins, 'buy:starter_pack'); S.lives = { n: MAX_LIVES, at: Date.now() }; S.infUntil = Date.now() + DAY; }
    saveG(); emit();
  }
  const gets = sku => { const k = SKUS[sku]; return k.kind === 'coins' ? `${fmt(k.coins)} coins` : k.line; };
  const skuIcon = sku => { const k = SKUS[sku]; return k.kind === 'coins' ? `<span class="apm-pile">${pile(sku === 'coins_s' ? 1 : sku === 'coins_m' ? 2 : 3, style)}</span>` : icon({ remove_ads: 'noads', pass: 'pass', starter: 'gift' }[k.kind], style); };

  async function buyFlow(sku) {
    const k = SKUS[sku];
    if (!k) { console.warn('money: unknown sku', sku); return false; }
    if (owned(sku)) { toast(sku === 'remove_ads' ? 'Ads are already off ✓' : 'Already yours ✓', style); return false; }
    const P = pay();
    if (P && typeof P.buy === 'function') {   // real payments: the provider runs its own checkout
      let r = false; try { r = await P.buy(sku, { game, price: price(sku), title: k.title, coins: k.coins || 0 }); } catch (e) { r = false; }
      const ok = r === true || !!(r && (r.ok || r.paid));
      if (ok) { grant(sku, false); toast(`✓ ${esc(k.title)}`, style); }
      return ok;
    }
    const ok = await sheet(style, `<div class="apm-big"><span class="apm-test">Test purchase — no charge</span>
      <div class="apm-ic">${skuIcon(sku)}</div><h2>${esc(k.title)}</h2><p>${esc(gets(sku))}</p>
      <p><span class="apm-was">${esc(price(sku))}</span><b>$0.00 in test mode</b></p></div>
      <div class="apm-acts"><button class="apm-b apm-b1" data-act="yes" data-primary>Confirm test purchase</button>
      <button class="apm-b apm-b2" data-act="no">Cancel</button></div>`, { label: 'Test purchase, no charge', dismiss: false, onAct: a => a === 'yes', auto: true });
    if (ok) { grant(sku, true); toast(k.kind === 'coins' ? `+${fmt(k.coins)} ${coinSVG(style === 'B')}` : `✓ ${esc(k.title)}`, style); }
    return ok;
  }
  async function buy(sku) {
    if (lock) return false;
    lock = 'flow'; try { return await buyFlow(sku); } finally { lock = null; }
  }

  function shopHTML() {
    const bal = `<span class="apm-bal" aria-label="${W.coins} coins">${coinSVG(style === 'B')}${fmt(W.coins)}</span>`;
    const pack = sku => { const k = SKUS[sku]; return `<button class="apm-tile apm-pack" data-act="buy:${sku}" aria-label="${fmt(k.coins)} coins for ${esc(price(sku))}">
      ${k.tag ? `<span class="apm-tag">${k.tag}</span>` : ''}<span class="apm-pile">${pile(sku === 'coins_s' ? 1 : sku === 'coins_m' ? 2 : 3, style)}</span>
      <span class="apm-mid"><b>${fmt(k.coins)}</b><small>${esc(k.title)}</small></span><span class="apm-price">${esc(price(sku))}</span></button>`; };
    const row = (sku, ic, own_, ownTxt) => { const k = SKUS[sku]; return `<button class="apm-tile apm-row${own_ ? ' apm-own' : ''}" data-act="${own_ ? 'owned' : 'buy:' + sku}" ${own_ ? 'aria-disabled="true"' : ''}>
      <span class="apm-ic">${icon(ic, style)}</span><span class="apm-t"><b>${esc(k.title)}</b><span>${esc(k.line)}</span></span>
      <span class="apm-price">${own_ ? ownTxt : esc(price(sku))}</span></button>`; };
    const passLeft = hasPass() ? `${Math.ceil((S.passUntil - Date.now()) / DAY)} days left` : '';
    const starter = S.starter ? '' : `<button class="apm-tile apm-row apm-hero" data-act="buy:starter_pack"><span class="apm-tag">One time only</span>
      <span class="apm-ic">${icon('gift', style)}</span><span class="apm-t"><b>${esc(SKUS.starter_pack.title)}</b><span>${esc(SKUS.starter_pack.line)}</span></span>
      <span class="apm-price">${esc(price('starter_pack'))}</span></button>`;
    return `<div class="apm-head"><h2 class="apm-h">${TITLES[style]}</h2>${bal}</div>
      <div class="apm-scroll">${starter}<div class="apm-packs">${pack('coins_s')}${pack('coins_m')}${pack('coins_l')}</div>
      ${row('remove_ads', 'noads', S.adFree || hasPass(), S.adFree ? 'Owned ✓' : 'In pass ✓')}
      ${row('season_pass', 'pass', false, '')}${passLeft ? `<p class="apm-foot" style="margin:0">Season pass active · ${passLeft}</p>` : ''}</div>
      <p class="apm-foot">${pay() ? 'Secure checkout. Coins work in every AGENTPARK game.' : 'Test mode · purchases are free, nothing is charged. Coins work in every AGENTPARK game.'}</p>`;
  }
  async function shop() {
    if (lock) return false;
    lock = 'flow';
    try {
      for (;;) {
        reloadW();
        const a = await sheet(style, shopHTML(), { label: TITLES[style], dismiss: 'close', onAct: a => a === 'owned' ? undefined : a, auto: 'close' });
        if (!a || a === 'close') break;
        if (a.startsWith('buy:')) await buyFlow(a.slice(4));
        if (BOT) break;
      }
    } finally { lock = null; }
    return true;
  }

  // ---------------------------------------------------------------- QA
  function debug() {
    const now = Date.now();
    return {
      game, style, coins: W.coins, lives: lives(), adFree: adFree(), adFreeBy: S.adFree ? 'remove_ads' : hasPass() ? 'pass' : appAdFree() ? 'app' : null,
      pass: hasPass(), passUntil: S.passUntil || 0, starter: !!S.starter, unlimitedUntil: S.infUntil || 0,
      purchases: (S.purchases || []).slice(), ledger: (S.ledger || []).slice(-20), wallet: (W.ledger || []).slice(-20),
      ads: Object.assign({}, S.ads, { nextBreakBlockedBy: breakWhy(now) || null }),
      env: { embed: EMBED, inApp: IN_APP(), bot: BOT, local: LOCAL, adTest: ADTEST, provider: provider(), pay: pay() ? 'AP_PAY' : 'test', siteForced: siteCfg() ? !!siteCfg().ADS_FORCED : null },
      open: lock || (sheetEl ? 'sheet' : null),
    };
  }
  function reset() {   // QA only: wipe this game's state (the shared wallet back to the welcome coins)
    S = fresh(); saveG(); W = { coins: WELCOME, ledger: [{ g: game, n: WELCOME, r: 'welcome', t: Date.now() }] }; saveW(); emit(); return debug();
  }

  const M = {
    coins: () => (reloadW(), W.coins), add, spend,
    onChange(fn) { subs.add(fn); return () => subs.delete(fn); },
    onAd(fn) { adSubs.add(fn); return () => adSubs.delete(fn); },
    rewarded, breakAd, level, shop, buy,
    adFree, hasPass, lives, useLife, refillLives,
    skus: SKUS, rewards: REWARDS, toast: t => toast(esc(t), style), debug, reset,
    get style() { return style; }, _style(s) { if (['A', 'B', 'C'].includes(s)) style = s; },
  };
  // the iOS app can flip ad-free mid-session: window.dispatchEvent(new CustomEvent('ap:app', { detail: { adFree: true } }))
  addEventListener('ap:app', e => { window.AP_APP = Object.assign(window.AP_APP || { inApp: true }, e.detail || {}); emit(); });
  instances[game] = M;
  (window.__money = window.__money || {})[game] = M;
  return M;
}
export default money;
