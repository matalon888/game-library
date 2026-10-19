// Embersite HUD + menus (DOM) and a 2D overlay canvas: crosshair, world markers, detection meters, damage arcs,
// hit markers, compass strip, rotating minimap, scope + binocular reticles, touch controls.
import { THREE } from './kit/cine.js';
import { SIZE, HALF, LZS, BASE, RELAY, PYLONS, DAM_X, DAM_Z, ROADS } from './world.js';
import { RARITY } from './models.js';
const V3 = THREE.Vector3;

const CSS = `
:root{--blue:#2f86ff;--ink:#141a33;--yel:#ffd23a;--org:#ff7a22;--red:#ff3b5c;--grn:#5dff8a;--pur:#a34dff}
body{background:#7fc8ff!important;font-family:Rubik,system-ui,sans-serif}
.es *{box-sizing:border-box}
.es{position:fixed;inset:0;pointer-events:none;z-index:6;color:#fff;font-family:Rubik,system-ui,sans-serif;-webkit-user-select:none;user-select:none}
.es .lil{font-family:'Lilita One',Rubik,sans-serif;letter-spacing:.5px}
.es .out{text-shadow:0 2px 0 rgba(20,26,51,.85),0 0 1px #141a33,1px 1px 0 #141a33,-1px -1px 0 #141a33,1px -1px 0 #141a33,-1px 1px 0 #141a33}
.es canvas.ov{position:absolute;inset:0;width:100%;height:100%}
.es .top{position:absolute;top:calc(8px + env(safe-area-inset-top));left:60px;right:122px;display:flex;flex-direction:column;align-items:center;gap:4px}
.es .compass{width:100%;max-width:340px;height:30px;border-radius:8px;background:linear-gradient(180deg,rgba(20,26,51,.55),rgba(20,26,51,.25))}
.es .obj{display:flex;align-items:center;gap:8px;background:rgba(20,26,51,.62);border-radius:12px;padding:5px 10px 5px 6px;width:100%;max-width:420px;border:2px solid rgba(255,255,255,.18)}
.es .obj .tm{font-family:'Lilita One';font-size:22px;background:var(--yel);color:var(--ink);border-radius:8px;padding:1px 8px;min-width:64px;text-align:center}
.es .obj .tm.warn{background:var(--red);color:#fff;animation:esp .5s infinite alternate}
.es .obj .tx{font-weight:700;font-size:12px;line-height:1.15;min-width:0;overflow:hidden}.es .obj .tx span{display:block}.es .obj .tx b{display:block;font-family:'Lilita One';font-weight:400;font-size:15px;color:var(--yel)}
@keyframes esp{to{transform:scale(1.08)}}
.es .mini{position:absolute;top:calc(8px + env(safe-area-inset-top));right:8px;width:104px;height:104px;border-radius:50%;border:3px solid #fff;box-shadow:0 3px 0 rgba(20,26,51,.5),0 0 0 2px #141a33;background:#4c8c3a}
.es .vitals{position:absolute;left:12px;bottom:calc(14px + env(safe-area-inset-bottom));width:min(210px,44vw)}
.es .bar{height:14px;border-radius:7px;background:rgba(20,26,51,.6);border:2px solid #141a33;overflow:hidden;margin-top:4px;position:relative}
.es .bar i{position:absolute;left:0;top:0;bottom:0;border-radius:5px;transition:width .15s}
.es .bar.hp i{background:linear-gradient(180deg,#8cff7a,#2fc94a)} .es .bar.ar i{background:linear-gradient(180deg,#7ad8ff,#2f86ff)}
.es .bar.ar b{position:absolute;top:0;bottom:0;width:2px;background:#141a33}
.es .vitals .lb{font-family:'Lilita One';font-size:13px;display:flex;justify-content:space-between}
.es .weap{position:absolute;right:12px;bottom:calc(14px + env(safe-area-inset-bottom));text-align:right;pointer-events:auto}
.es .weap .am{font-family:'Lilita One';font-size:30px;line-height:1}.es .weap .am small{font-size:18px;opacity:.85}
.es .weap .nm{font-family:'Lilita One';font-size:14px;color:var(--yel)} .es .weap .sub{font-size:11px;font-weight:700;opacity:.9}
.es .weap .nades{font-family:'Lilita One';font-size:14px;margin-top:2px}
.es .feed{position:absolute;right:12px;top:40%;display:flex;flex-direction:column;align-items:flex-end;gap:4px}
.es .feed div{font-family:'Lilita One';font-size:15px;background:rgba(20,26,51,.55);padding:2px 9px;border-radius:8px;animation:esin .25s ease-out}
.es .feed div b{color:var(--yel);margin-left:6px}
@keyframes esin{from{transform:translateX(30px);opacity:0}}
.es .banner{position:absolute;left:0;right:0;top:24%;text-align:center;font-family:'Lilita One';font-size:clamp(26px,7vw,46px);opacity:0;transition:opacity .25s,transform .25s;transform:scale(.8)}
.es .banner.on{opacity:1;transform:scale(1)} .es .banner small{display:block;font-family:Rubik;font-weight:700;font-size:15px;margin-top:2px}
.es .radio{position:absolute;left:50%;transform:translateX(-50%);top:calc(122px + env(safe-area-inset-top));width:min(92vw,460px);background:rgba(20,26,51,.72);border-radius:12px;padding:7px 12px;font-size:14px;font-weight:700;opacity:0;transition:opacity .3s;border-left:5px solid var(--yel)}
.es .radio.on{opacity:1} .es .radio b{font-family:'Lilita One';font-weight:400;color:var(--yel);margin-right:6px}
.es .loot{position:absolute;left:50%;top:58%;transform:translate(-50%,0) scale(.7);opacity:0;transition:all .25s;padding:8px 18px;border-radius:12px;font-family:'Lilita One';font-size:20px;text-align:center;border:3px solid #fff}
.es .loot.on{opacity:1;transform:translate(-50%,0) scale(1)} .es .loot small{display:block;font-size:12px;letter-spacing:2px}
.es .prompt{position:absolute;left:50%;top:56%;transform:translateX(-50%);display:none;align-items:center;gap:8px;background:rgba(20,26,51,.7);border-radius:12px;padding:6px 14px;font-family:'Lilita One';font-size:16px}
.es .prompt.on{display:flex} .es .prompt kbd{background:#fff;color:var(--ink);border-radius:6px;padding:0 7px;font-family:'Lilita One'}
.es .vig{position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(255,0,40,0) 55%,rgba(255,20,60,.55) 100%);opacity:0;transition:opacity .2s}
.es .scope,.es .binoc{position:absolute;inset:0;display:none} .es .scope.on,.es .binoc.on{display:block}
.es .rng{position:absolute;left:50%;top:calc(50% + min(42vw,38vh));transform:translateX(-50%);font-family:'Lilita One';font-size:16px;color:#b8ff9a;text-shadow:0 0 6px #000}
.es .binoc .rng{top:calc(50% + min(30vw,30vh));color:#ffe9a8}
.es .tbtn{position:absolute;pointer-events:auto;border-radius:50%;display:grid;place-items:center;font-family:'Lilita One';font-size:13px;color:#fff;background:rgba(20,26,51,.3);border:3px solid rgba(255,255,255,.75);box-shadow:0 3px 0 rgba(20,26,51,.45);touch-action:none}
.es .tbtn.on{background:rgba(255,210,58,.85);color:var(--ink)} .es .tbtn svg{width:58%;height:58%}
.es .tbtn.fire{background:rgba(255,59,92,.55)} .es .tbtn.fire.on{background:rgba(255,59,92,.95);color:#fff}
.es .stick{position:absolute;width:120px;height:120px;border-radius:50%;border:3px solid rgba(255,255,255,.6);background:rgba(20,26,51,.25);display:none;transform:translate(-50%,-50%)}
.es .stick i{position:absolute;left:50%;top:50%;width:52px;height:52px;margin:-26px;border-radius:50%;background:rgba(255,255,255,.85)}
.es .keys{position:absolute;left:12px;bottom:calc(112px + env(safe-area-inset-bottom));transition:opacity 1s;font-size:11px;font-weight:700;opacity:.85;line-height:1.5}
.es .keys{text-shadow:0 1px 2px #141a33}.es .keys kbd{text-shadow:none;background:rgba(255,255,255,.92);color:#141a33;border-radius:4px;padding:0 4px;font-family:Rubik;font-weight:900}
.es .lock{position:absolute;left:50%;top:44%;transform:translateX(-50%);font-family:'Lilita One';font-size:20px;background:rgba(20,26,51,.7);padding:8px 16px;border-radius:12px;display:none}
/* menu */
.esm{position:fixed;inset:0;z-index:20;display:flex;flex-direction:column;color:#fff;font-family:Rubik,system-ui,sans-serif;pointer-events:auto;background:linear-gradient(180deg,rgba(20,40,110,.0) 30%,rgba(16,22,60,.55) 100%)}
.esm .logo{margin:calc(64px + env(safe-area-inset-top)) 0 0 18px}
.esm .logo h1{margin:0;font-family:'Lilita One';font-weight:400;font-size:clamp(46px,14vw,92px);line-height:.88;color:#fff;-webkit-text-stroke:3px #141a33;text-shadow:0 6px 0 #141a33,0 10px 20px rgba(0,0,0,.25);transform:rotate(-3deg);transform-origin:left}
.esm .logo h1 span{color:var(--yel)}
.esm .logo p{margin:10px 0 0 4px;font-family:'Lilita One';font-size:clamp(14px,4vw,20px);letter-spacing:1px;background:var(--blue);display:inline-block;padding:3px 12px;border-radius:8px;border:3px solid #141a33;transform:rotate(-3deg)}
.esm .streak{margin:10px 0 0 22px;font-family:'Lilita One';font-size:15px}
.esm .list{margin-top:auto;padding:0 12px calc(16px + env(safe-area-inset-bottom));display:grid;gap:7px;max-width:560px;width:100%}
.esm .card{display:grid;grid-template-columns:42px 1fr auto;align-items:center;gap:10px;padding:7px 12px 7px 7px;border-radius:14px;background:rgba(255,255,255,.95);color:var(--ink);border:3px solid #141a33;box-shadow:0 4px 0 #141a33;cursor:pointer;transition:transform .1s}
.esm .card:active{transform:translateY(3px);box-shadow:0 1px 0 #141a33}
.esm .card .n{width:42px;height:42px;border-radius:10px;display:grid;place-items:center;font-family:'Lilita One';font-size:22px;color:#fff;background:var(--blue);border:2px solid #141a33}
.esm .card.daily .n{background:var(--org)} .esm .card.locked{opacity:.8;filter:grayscale(.5);padding:3px 12px 3px 7px;grid-template-columns:30px 1fr auto}.esm .card.locked .n{width:30px;height:30px;font-size:15px}.esm .card.locked small{display:none}.esm .card.locked b{font-size:15px}
.esm .card b{font-family:'Lilita One';font-weight:400;font-size:18px;display:block;line-height:1.05} .esm .card small{font-size:11.5px;font-weight:700;color:#4a5578}
.esm .card .sc{font-family:'Lilita One';font-size:15px;text-align:right;color:#2f86ff} .esm .card .sc small{display:block;font-family:Rubik;font-size:10px;color:#7a84a0}
.esm .card.sel{background:#fff6cf;outline:3px solid var(--yel)}
.esm .tap{text-align:center;font-family:'Lilita One';font-size:16px;margin:2px 0 4px;animation:esp .8s infinite alternate}
@media (max-width:600px){.es .radio{left:12px;right:74px;width:auto;transform:none}}
@media (min-width:900px){.esm{flex-direction:row;align-items:flex-end;justify-content:space-between}.esm .logo{margin:auto 0 auto 56px}.esm .list{margin:0 40px 40px 0;width:440px}}
.esr{position:fixed;inset:0;z-index:21;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:calc(90px + env(safe-area-inset-top)) 18px 20px;background:rgba(14,20,52,.62);color:#fff;font-family:Rubik;pointer-events:auto;text-align:center;opacity:0;transition:opacity .4s}
.esr.on{opacity:1}
.esr h2{margin:0;font-family:'Lilita One';font-weight:400;font-size:clamp(40px,12vw,76px);line-height:.95;-webkit-text-stroke:2px #141a33;text-shadow:0 5px 0 #141a33}
.esr .sub{font-family:'Lilita One';font-size:17px;color:var(--yel);margin:8px 0 14px}
.esr .rows{width:min(360px,90vw);background:rgba(255,255,255,.95);color:var(--ink);border-radius:14px;border:3px solid #141a33;box-shadow:0 5px 0 #141a33;padding:8px 14px}
.esr .rows div{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed #c9cfe0;font-weight:700;font-size:14px}.esr .rows div:last-child{border:0;font-family:'Lilita One';font-size:22px;font-weight:400;color:#2f86ff}
.esr .best{margin-top:10px;font-family:'Lilita One';font-size:16px}
.esr .hc-btn{margin-top:12px;font-family:'Lilita One';background:var(--yel);color:var(--ink);border:3px solid #141a33;box-shadow:0 4px 0 #141a33}
.esr .cont{margin-top:auto;margin-bottom:8vh;font-family:'Lilita One';font-size:20px;animation:esp .8s infinite alternate}
.hc-card,.hc-top,.hc-score,.hc-sub{display:none!important}
`;
const IC = {
  aim: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4"><circle cx="12" cy="12" r="7"/><path d="M12 1v6M12 17v6M1 12h6M17 12h6"/></svg>',
  reload: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"><path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 3v5h-5"/></svg>',
  jump: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round"><path d="M5 14l7-7 7 7"/><path d="M12 7v13"/></svg>',
  crouch: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round"><path d="M5 10l7 7 7-7"/><path d="M4 21h16"/></svg>',
  binoc: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2"><circle cx="7" cy="15" r="4.5"/><circle cx="17" cy="15" r="4.5"/><path d="M9 8h6M7 10.5V6h3M17 10.5V6h-3"/></svg>',
};

export function createHUD(G) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const root = document.createElement('div'); root.className = 'es'; root.innerHTML = `
    <canvas class="ov"></canvas>
    <div class="vig"></div>
    <div class="scope"><canvas class="ov"></canvas><div class="rng out">---</div></div>
    <div class="binoc"><canvas class="ov"></canvas><div class="rng out">---</div></div>
    <div class="top"><canvas class="compass"></canvas><div class="obj"><div class="tm">7:00</div><div class="tx out"><b>CONTRACT</b><span>Objective</span></div></div></div>
    <canvas class="mini"></canvas>
    <div class="feed"></div>
    <div class="banner out"></div>
    <div class="radio out"></div>
    <div class="loot out"></div>
    <div class="prompt out"><kbd>E</kbd><span></span><canvas width="44" height="44" style="width:22px;height:22px"></canvas></div>
    <div class="vitals out"><div class="lb"><span>ARMOR</span><span data-ar>0</span></div><div class="bar ar"><i></i><b style="left:33.3%"></b><b style="left:66.6%"></b></div><div class="lb" style="margin-top:4px"><span>HEALTH</span><span data-hp>100</span></div><div class="bar hp"><i></i></div></div>
    <div class="weap out"><div class="nm">K4 CARBINE</div><div class="am">30 <small>/ 120</small></div><div class="sub"></div><div class="nades"></div></div>
    <div class="keys"></div>
    <div class="lock">Click to aim · Esc to free the mouse</div>
    <div class="stick"><i></i></div>`;
  document.body.appendChild(root);
  const $ = s => root.querySelector(s);
  const H = { root, el: { ov: $('canvas.ov'), compass: $('.compass'), mini: $('.mini'), obj: $('.obj'), tm: $('.tm'), tx: $('.obj .tx'), feed: $('.feed'), banner: $('.banner'), radio: $('.radio'), loot: $('.loot'), prompt: $('.prompt'), vig: $('.vig'), scope: $('.scope'), binoc: $('.binoc'), vitals: $('.vitals'), weap: $('.weap'), keys: $('.keys'), stick: $('.stick'), lock: $('.lock') } };
  const E = H.el, ctx = E.ov.getContext('2d'), cctx = E.compass.getContext('2d'), mctx = E.mini.getContext('2d');
  let W = 0, Hh = 0, DPR = 1;
  H.resize = () => { DPR = Math.min(2, devicePixelRatio); W = innerWidth; Hh = innerHeight; for (const c of [E.ov, E.scope.querySelector('canvas'), E.binoc.querySelector('canvas')]) { c.width = W * DPR; c.height = Hh * DPR; }
    E.compass.width = E.compass.clientWidth * DPR || 300; E.compass.height = 30 * DPR; E.mini.width = E.mini.height = 104 * DPR; drawScope(); drawBinoc(); };
  // ---------------------------------------------------------------- touch controls
  const TOUCH = G.touch;
  const btns = {};
  const mk = (id, html, css, cls = '') => { const b = document.createElement('div'); b.className = 'tbtn ' + cls; b.innerHTML = html; b.dataset.btn = id; Object.assign(b.style, css); root.appendChild(b); btns[id] = b; return b; };
  if (TOUCH) {
    const B = 'calc(%s + env(safe-area-inset-bottom))';
    mk('fire', '<svg viewBox="0 0 24 24" fill="#fff"><circle cx="12" cy="12" r="5"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5" stroke="#fff" stroke-width="2.5"/></svg>', { right: '20px', bottom: B.replace('%s', '118px'), width: '84px', height: '84px' }, 'fire');
    mk('ads', IC.aim, { right: '116px', bottom: B.replace('%s', '124px'), width: '56px', height: '56px' });
    mk('jump', IC.jump, { right: '30px', bottom: B.replace('%s', '214px'), width: '52px', height: '52px' });
    mk('reload', IC.reload, { right: '100px', bottom: B.replace('%s', '196px'), width: '46px', height: '46px' });
    mk('crouch', IC.crouch, { right: '182px', bottom: B.replace('%s', '104px'), width: '46px', height: '46px' });
    mk('frag', '<span>FRAG</span>', { right: '22px', bottom: B.replace('%s', '280px'), width: '46px', height: '46px', fontSize: '11px' });
    mk('smoke', '<span>SMOKE</span>', { right: '78px', bottom: B.replace('%s', '256px'), width: '46px', height: '46px', fontSize: '10px' });
    mk('binoc', IC.binoc, { right: '14px', top: 'calc(124px + env(safe-area-inset-top))', width: '50px', height: '50px' });
    mk('use', '<span>USE</span>', { right: '20px', bottom: B.replace('%s', '340px'), width: '64px', height: '64px', display: 'none', fontSize: '16px', background: 'rgba(255,210,58,.8)', color: '#141a33' });
    E.weap.style.right = '12px';
    E.vitals.style.bottom = 'calc(14px + env(safe-area-inset-bottom))';
  } else {
    E.keys.innerHTML = '<kbd>WASD</kbd> move · <kbd>Shift</kbd> sprint · <kbd>Space</kbd> jump · <kbd>C</kbd> crouch<br><kbd>LMB</kbd> fire · <kbd>RMB</kbd> aim/scope · <kbd>R</kbd> reload · <kbd>1-3</kbd> weapons<br><kbd>G</kbd> frag · <kbd>X</kbd> smoke · <kbd>B</kbd> binoculars + <kbd>LMB</kbd> mark · <kbd>E</kbd> use';
  }
  H.btns = btns;
  H.showTouch = on => { for (const b of Object.values(btns)) if (b.dataset.btn !== 'use') b.style.visibility = on ? 'visible' : 'hidden'; };
  H.useBtn = on => { if (btns.use) btns.use.style.display = on ? 'grid' : 'none'; };
  H.press = (id, on) => btns[id] && btns[id].classList.toggle('on', on);

  // ---------------------------------------------------------------- simple setters
  H.objective = (title, text) => { E.tx.innerHTML = `<b>${title}</b><span>${text}</span>`; };
  H.timer = (s) => { s = Math.max(0, s); E.tm.textContent = Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'); E.tm.classList.toggle('warn', s < 30); };
  H.vitals = (hp, ar) => { E.vitals.querySelector('.hp i').style.width = hp + '%'; E.vitals.querySelector('.ar i').style.width = ar / 150 * 100 + '%'; E.vitals.querySelector('[data-hp]').textContent = Math.ceil(hp); E.vitals.querySelector('[data-ar]').textContent = Math.ceil(ar); };
  H.weapon = (w, s, nades) => { E.weap.querySelector('.nm').textContent = w.name + (s.ap ? ' · AP' : ''); E.weap.querySelector('.am').innerHTML = `${s.ammo} <small>/ ${s.reserve}</small>`; E.weap.querySelector('.sub').textContent = w.sub + (s.optic ? ' · ' + s.optic : ''); E.weap.querySelector('.nades').innerHTML = `💣 ${nades.frag} &nbsp; ☁️ ${nades.smoke}`; };
  H.feed = (txt, pts, color = '#fff') => { const d = document.createElement('div'); d.innerHTML = `<span style="color:${color}">${txt}</span>${pts ? `<b>+${pts}</b>` : ''}`; E.feed.prepend(d); while (E.feed.children.length > 5) E.feed.lastChild.remove(); setTimeout(() => d.remove(), 4200); };
  let bt = 0; H.banner = (txt, sub = '', color = '#fff', dur = 2.4) => { E.banner.innerHTML = `<span style="color:${color}">${txt}</span>${sub ? `<small>${sub}</small>` : ''}`; E.banner.classList.add('on'); clearTimeout(bt); bt = setTimeout(() => E.banner.classList.remove('on'), dur * 1000); };
  let rt = 0; H.radio = (who, txt, dur = 4.5) => { E.radio.innerHTML = `<b>${who}</b>${txt}`; E.radio.classList.add('on'); clearTimeout(rt); rt = setTimeout(() => E.radio.classList.remove('on'), dur * 1000); G.audio.radio(); };
  let lt = 0; H.loot = (r, txt) => { const R = RARITY[r]; E.loot.innerHTML = `<small>${R.n}</small>${txt}`; E.loot.style.background = R.c; E.loot.classList.add('on'); clearTimeout(lt); lt = setTimeout(() => E.loot.classList.remove('on'), 1800); };
  const pctx = E.prompt.querySelector('canvas').getContext('2d');
  H.prompt = (txt, p = 0) => { if (!txt) { E.prompt.classList.remove('on'); H.useBtn(false); return; } E.prompt.classList.add('on'); E.prompt.querySelector('span').textContent = txt; E.prompt.querySelector('kbd').style.display = TOUCH ? 'none' : ''; H.useBtn(true);
    pctx.clearRect(0, 0, 44, 44); pctx.lineWidth = 6; pctx.strokeStyle = 'rgba(255,255,255,.25)'; pctx.beginPath(); pctx.arc(22, 22, 17, 0, 7); pctx.stroke(); pctx.strokeStyle = '#ffd23a'; pctx.beginPath(); pctx.arc(22, 22, 17, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); pctx.stroke(); };
  H.hud = on => { for (const k of ['obj', 'vitals', 'weap', 'feed', 'compass', 'mini', 'keys']) E[k].style.visibility = on ? 'visible' : 'hidden'; E.ov.style.visibility = on ? 'visible' : 'hidden'; H.showTouch(on); };

  // ---------------------------------------------------------------- scope + binocular reticles
  function drawScope() {
    const c = E.scope.querySelector('canvas'), x = c.getContext('2d'), w = c.width, h = c.height, r = Math.min(w * .46, h * .42), cx = w / 2, cy = h / 2;
    x.clearRect(0, 0, w, h); x.fillStyle = '#05070c'; x.beginPath(); x.rect(0, 0, w, h); x.arc(cx, cy, r, 0, 7, true); x.fill();
    const g = x.createRadialGradient(cx, cy, r * .75, cx, cy, r); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.85)'); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
    x.strokeStyle = '#141414'; x.lineWidth = 6 * DPR; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke();
    // mil reticle: px per mil from the scoped vertical fov
    const fov = (G.scopeFov || 8) * Math.PI / 180, ppm = (h / 2) / Math.tan(fov / 2) * .001;
    x.strokeStyle = '#0b0b0b'; x.lineWidth = 2 * DPR; x.beginPath(); x.moveTo(cx - r, cy); x.lineTo(cx - 6 * DPR, cy); x.moveTo(cx + 6 * DPR, cy); x.lineTo(cx + r, cy); x.moveTo(cx, cy - r); x.lineTo(cx, cy - 6 * DPR); x.moveTo(cx, cy + 6 * DPR); x.lineTo(cx, cy + r); x.stroke();
    x.lineWidth = 5 * DPR; x.beginPath(); x.moveTo(cx - r, cy); x.lineTo(cx - r * .62, cy); x.moveTo(cx + r * .62, cy); x.lineTo(cx + r, cy); x.moveTo(cx, cy + r * .62); x.lineTo(cx, cy + r); x.stroke();
    x.fillStyle = '#0b0b0b'; x.font = `700 ${10 * DPR}px Rubik`; x.textAlign = 'left';
    for (let m = 1; m <= 10; m++) { const y = cy + m * ppm, L = (m % 5 ? 5 : 10) * DPR; if (y > cy + r * .6) break; x.fillRect(cx - L / 2, y - DPR * .6, L, DPR * 1.6); if (m % 2 === 0) x.fillText(m, cx + L / 2 + 3 * DPR, y + 4 * DPR); }
    for (let m = 1; m <= 10; m++) for (const s of [-1, 1]) { const xx = cx + s * m * ppm, L = (m % 5 ? 5 : 10) * DPR; if (Math.abs(xx - cx) > r * .6) break; x.fillRect(xx - DPR * .6, cy - L / 2, DPR * 1.6, L); }
    x.fillStyle = '#ff2d55'; x.beginPath(); x.arc(cx, cy, 2.2 * DPR, 0, 7); x.fill();
  }
  function drawBinoc() {
    const c = E.binoc.querySelector('canvas'), x = c.getContext('2d'), w = c.width, h = c.height, r = Math.min(w * .3, h * .3), cy = h / 2, o = r * .78;
    x.clearRect(0, 0, w, h); x.fillStyle = 'rgba(8,12,24,.92)'; x.beginPath(); x.rect(0, 0, w, h); x.arc(w / 2 - o, cy, r, 0, 7, true); x.fill();
    x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.arc(w / 2 + o, cy, r, 0, 7); x.fill(); x.globalCompositeOperation = 'source-over';
    x.strokeStyle = 'rgba(255,233,168,.85)'; x.lineWidth = 2 * DPR; x.beginPath(); x.moveTo(w / 2 - 30 * DPR, cy); x.lineTo(w / 2 - 8 * DPR, cy); x.moveTo(w / 2 + 8 * DPR, cy); x.lineTo(w / 2 + 30 * DPR, cy); x.moveTo(w / 2, cy - 30 * DPR); x.lineTo(w / 2, cy - 8 * DPR); x.stroke();
    x.strokeRect(w / 2 - 40 * DPR, cy - 26 * DPR, 80 * DPR, 52 * DPR);
  }
  H.scope = on => E.scope.classList.toggle('on', on);
  H.binoc = on => E.binoc.classList.toggle('on', on);
  H.range = (el, txt) => { (el === 'scope' ? E.scope : E.binoc).querySelector('.rng').textContent = txt; };

  // ---------------------------------------------------------------- minimap base image
  const mapImg = document.createElement('canvas'); mapImg.width = mapImg.height = 512;
  {
    const x = mapImg.getContext('2d'), img = x.createImageData(512, 512), wd = G.world, s = SIZE / 512;
    for (let j = 0; j < 512; j++) for (let i = 0; i < 512; i++) {
      const wx = -HALF + i * s, wz = -HALF + j * s, h = wd.h(wx, wz), k = (j * 512 + i) * 4, sh = Math.max(-.4, Math.min(.4, (wd.h(wx - 2, wz - 2) - h) * .12));
      let r, g, b;
      if (wd.depth(wx, wz) > 0) { r = 70; g = 170; b = 220; }
      else { const t = Math.min(1, Math.max(0, h / 60)); r = 92 + t * 60; g = 160 + t * 30; b = 70 + t * 40; }
      const l = 1 + sh; img.data[k] = r * l; img.data[k + 1] = g * l; img.data[k + 2] = b * l; img.data[k + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    const P = (wx, wz) => [(wx + HALF) / s, (wz + HALF) / s];
    x.strokeStyle = '#e9cf95'; x.lineWidth = 4; x.lineCap = 'round'; for (const R of ROADS) { x.beginPath(); R.forEach(([a, b], i) => i ? x.lineTo(...P(a, b)) : x.moveTo(...P(a, b))); x.stroke(); }
    x.fillStyle = '#d6d0c2'; const [bx, bz] = P(BASE.x - 46, BASE.z - 46); x.fillRect(bx, bz, 92 / s, 92 / s);
    x.fillStyle = '#c9c2b0'; const [dx, dz] = P(DAM_X - 84, DAM_Z - 4); x.fillRect(dx, dz, 168 / s, 8 / s);
    x.fillStyle = '#b5ae9e'; const [rx, rz] = P(RELAY.x - 9, RELAY.z - 7); x.fillRect(rx, rz, 18 / s, 14 / s);
  }
  H.mapImg = mapImg;
  const toScr = new V3();
  // project a world point to screen; returns {x,y,on,behind}
  function proj(p) { toScr.copy(p).project(G.camera); const behind = toScr.z > 1; let x = (toScr.x * .5 + .5) * W, y = (-toScr.y * .5 + .5) * Hh; if (behind) { x = W - x; y = Hh - y; } return { x, y, behind, on: !behind && x > 0 && x < W && y > 0 && y < Hh }; }
  H.proj = proj;
  const hitM = { t: 0, kill: false }, dmgArcs = [];
  H.hit = (kill, crit) => { hitM.t = .22; hitM.kill = kill; hitM.crit = crit; };
  H.damage = (from) => { dmgArcs.push({ from: from.clone(), t: 1.2 }); };

  // ---------------------------------------------------------------- per-frame 2D overlay
  H.draw = (dt) => {
    const x = ctx; x.setTransform(DPR, 0, 0, DPR, 0, 0); x.clearRect(0, 0, W, Hh);
    const P = G.player, cam = G.camera, cx = W / 2, cy = Hh / 2;
    if (G.state !== 'play') return;
    const yaw = P.yaw;
    // markers: objective, LZ, marked enemies, crates nearby
    const marker = (p, color, label, shape = 'dia', always = true, size = 9) => {
      const s = proj(p); let { x: mx, y: my } = s; const m = 26;
      if (!s.on) { if (!always) return; const ax = mx - cx, ay = my - cy, k = Math.min((cx - m) / Math.abs(ax || 1e-3), (cy - m - 60) / Math.abs(ay || 1e-3)); if (s.behind || k < 1) { mx = cx + ax * Math.min(1, k); my = cy + ay * Math.min(1, k); } }
      x.save(); x.translate(mx, my); x.lineWidth = 3; x.strokeStyle = '#141a33'; x.fillStyle = color;
      x.beginPath(); if (shape === 'dia') { x.moveTo(0, -size); x.lineTo(size, 0); x.lineTo(0, size); x.lineTo(-size, 0); } else if (shape === 'tri') { x.moveTo(0, size); x.lineTo(size, -size * .7); x.lineTo(-size, -size * .7); } else x.arc(0, 0, size * .7, 0, 7);
      x.closePath(); x.stroke(); x.fill();
      if (label) { x.font = "13px 'Lilita One'"; x.textAlign = 'center'; x.lineWidth = 4; x.strokeText(label, 0, -size - 6); x.fillStyle = '#fff'; x.fillText(label, 0, -size - 6); }
      x.restore();
    };
    for (const o of G.markers()) marker(o.p, o.color, o.label, o.shape, o.always !== false, o.size);
    // detection meters around the crosshair (Ghost-Recon style)
    for (const e of G.enemies.list) {
      if (!e.alive || e.aw < .04) continue; const d = e.p.distanceTo(P.p); if (d > 200) continue;
      const a = Math.atan2(e.p.x - P.p.x, e.p.z - P.p.z), rel = -(a - Math.atan2(-Math.sin(yaw), -Math.cos(yaw)));
      const ang = rel - Math.PI / 2, R = 72, col = e.state === 'combat' ? '#ff3b5c' : e.aw > .5 ? '#ff9a22' : '#ffffff';
      x.lineCap = 'round'; x.lineWidth = 8; x.strokeStyle = 'rgba(20,26,51,.6)'; x.beginPath(); x.arc(cx, cy, R, ang - .2, ang + .2); x.stroke();
      x.lineWidth = 5; x.strokeStyle = col; x.beginPath(); x.arc(cx, cy, R, ang - .2, ang - .2 + .4 * Math.min(1, e.aw)); x.stroke();
      if (e.state !== 'combat' && e.aw > .3) { x.font = "18px 'Lilita One'"; x.fillStyle = col; x.textAlign = 'center'; x.fillText(e.aw > .6 ? '!' : '?', cx + Math.cos(ang) * (R + 16), cy + Math.sin(ang) * (R + 16) + 6); }
    }
    // damage direction
    for (let i = dmgArcs.length - 1; i >= 0; i--) { const d = dmgArcs[i]; d.t -= dt; if (d.t <= 0) { dmgArcs.splice(i, 1); continue; }
      const a = Math.atan2(d.from.x - P.p.x, d.from.z - P.p.z), rel = -(a - Math.atan2(-Math.sin(yaw), -Math.cos(yaw))), ang = rel - Math.PI / 2;
      x.lineWidth = 12; x.strokeStyle = `rgba(255,40,70,${Math.min(1, d.t)})`; x.beginPath(); x.arc(cx, cy, 120, ang - .35, ang + .35); x.stroke(); }
    // crosshair
    if (!G.scoped && !G.binoc) {
      const sp = 6 + G.spreadPx * (1 - G.ads * .9); x.strokeStyle = '#141a33'; x.lineWidth = 4; x.lineCap = 'round';
      const lines = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      if (G.ads < .7) for (const [a, b] of lines) { x.beginPath(); x.moveTo(cx + a * sp, cy + b * sp); x.lineTo(cx + a * (sp + 9), cy + b * (sp + 9)); x.stroke(); }
      x.strokeStyle = '#fff'; x.lineWidth = 2; if (G.ads < .7) for (const [a, b] of lines) { x.beginPath(); x.moveTo(cx + a * sp, cy + b * sp); x.lineTo(cx + a * (sp + 9), cy + b * (sp + 9)); x.stroke(); }
      x.fillStyle = '#fff'; x.beginPath(); x.arc(cx, cy, 1.8, 0, 7); x.fill();
    }
    if (hitM.t > 0) { hitM.t -= dt; const s = 7 + (1 - hitM.t / .22) * 5, c = hitM.kill ? '#ff3b5c' : hitM.crit ? '#ffd23a' : '#fff'; x.lineWidth = hitM.kill ? 4 : 3; x.strokeStyle = c;
      for (const [a, b] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { x.beginPath(); x.moveTo(cx + a * s, cy + b * s); x.lineTo(cx + a * (s + 8), cy + b * (s + 8)); x.stroke(); } }
    drawCompass(); drawMini();
  };
  function drawCompass() {
    const c = cctx, w = E.compass.width, h = E.compass.height, P = G.player; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h);
    const heading = ((-P.yaw * 180 / Math.PI) % 360 + 360) % 360, ppd = w / 120;   // 120° visible
    c.font = `${13 * DPR}px 'Lilita One'`; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let d = Math.floor((heading - 60) / 15) * 15; d <= heading + 60; d += 15) {
      const xx = w / 2 + (d - heading) * ppd, n = ((d % 360) + 360) % 360, lab = { 0: 'N', 90: 'E', 180: 'S', 270: 'W', 45: 'NE', 135: 'SE', 225: 'SW', 315: 'NW' }[n];
      c.fillStyle = lab ? (lab === 'N' ? '#ffd23a' : '#fff') : 'rgba(255,255,255,.6)';
      if (lab) c.fillText(lab, xx, h * .45); else c.fillRect(xx - DPR / 2, h * .3, DPR, h * .3);
    }
    for (const o of G.markers()) { if (!o.compass) continue; const a = Math.atan2(o.p.x - P.p.x, -(o.p.z - P.p.z)) * 180 / Math.PI; let dd = ((a - heading + 540) % 360) - 180; if (Math.abs(dd) > 60) dd = Math.sign(dd) * 60;
      const xx = w / 2 + dd * ppd; c.fillStyle = o.color; c.strokeStyle = '#141a33'; c.lineWidth = 2 * DPR; c.beginPath(); c.moveTo(xx, h - 2 * DPR); c.lineTo(xx + 5 * DPR, h - 9 * DPR); c.lineTo(xx, h - 16 * DPR); c.lineTo(xx - 5 * DPR, h - 9 * DPR); c.closePath(); c.stroke(); c.fill(); }
    c.fillStyle = '#ffd23a'; c.beginPath(); c.moveTo(w / 2 - 6 * DPR, 0); c.lineTo(w / 2 + 6 * DPR, 0); c.lineTo(w / 2, 6 * DPR); c.fill();
  }
  function drawMini() {
    const c = mctx, s = E.mini.width, P = G.player, view = 220, k = s / view, sc = SIZE / 512;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, s, s); c.save(); c.beginPath(); c.arc(s / 2, s / 2, s / 2, 0, 7); c.clip();
    c.translate(s / 2, s / 2); c.rotate(P.yaw);
    const px = (P.p.x + HALF) / sc, pz = (P.p.z + HALF) / sc; c.drawImage(mapImg, -px * sc * k, -pz * sc * k, 512 * sc * k, 512 * sc * k);
    const dot = (p, col, r = 3.2) => { c.fillStyle = col; c.strokeStyle = '#141a33'; c.lineWidth = 1.5 * DPR; c.beginPath(); c.arc((p.x - P.p.x) * k, (p.z - P.p.z) * k, r * DPR, 0, 7); c.fill(); c.stroke(); };
    for (const o of G.markers()) if (o.mini) dot(o.p, o.color, o.mini);
    for (const e of G.enemies.list) if (e.alive && (e.marked || (e.state === 'combat' && G.time - e.lastSeen < 2 && e.p.distanceTo(P.p) < 60))) dot(e.p, '#ff3b5c', 2.6);
    c.restore();
    c.save(); c.translate(s / 2, s / 2); c.fillStyle = '#ffd23a'; c.strokeStyle = '#141a33'; c.lineWidth = 2 * DPR; c.beginPath(); c.moveTo(0, -8 * DPR); c.lineTo(6 * DPR, 6 * DPR); c.lineTo(0, 3 * DPR); c.lineTo(-6 * DPR, 6 * DPR); c.closePath(); c.fill(); c.stroke(); c.restore();
  }
  // ---------------------------------------------------------------- menu + results
  const menu = document.createElement('div'); menu.className = 'esm'; document.body.appendChild(menu);
  H.menu = (cards, streak, onPick) => {
    menu.innerHTML = `<div class="logo"><h1>EMBER<span>SITE</span></h1><p>TACTICAL EXTRACTION SHOOTER</p>${streak > 1 ? `<div class="streak out">🔥 ${streak}-day streak</div>` : ''}</div>
      <div class="list"><div class="tap out">TAP A CONTRACT TO DROP IN</div>${cards.map((c, i) => `<div class="card ${c.cls}" data-i="${i}"><div class="n">${c.icon}</div><div><b>${c.name}</b><small>${c.sub}</small></div><div class="sc">${c.score}<small>${c.scoreLabel}</small></div></div>`).join('')}</div>`;
    menu.style.display = 'flex';
    menu.onpointerdown = e => { e.stopPropagation(); const card = e.target.closest('.card'); onPick(card ? +card.dataset.i : -1); };
  };
  H.hideMenu = () => { menu.style.display = 'none'; };
  const res = document.createElement('div'); res.className = 'esr'; res.style.display = 'none'; document.body.appendChild(res);
  H.result = (o, share, onTap) => {
    res.innerHTML = `<h2 style="color:${o.color}">${o.title}</h2><div class="sub">${o.sub}</div><div class="rows">${o.rows.map(([a, b]) => `<div><span>${a}</span><span>${b}</span></div>`).join('')}</div><div class="best">${o.best}</div><div class="cont">Tap to continue</div>`;
    if (share && o.win) { share.style.display = ''; res.querySelector('.best').after(share); }
    res.style.display = 'flex'; requestAnimationFrame(() => res.classList.add('on'));
    res.onpointerdown = e => { if (e.target.closest('.hc-btn')) return; e.stopPropagation(); res.classList.remove('on'); res.style.display = 'none'; onTap(); };
  };
  addEventListener('resize', H.resize); H.resize();
  return H;
}
