// Viral Den deep v2 (studio, 2026-10-29): tap to film ON THE BEAT. 30 hand-made videos in 3 worlds (levels.js), clips slide
// along a timeline into the REC ring, every hit plays the next note of the video's tune. Stars per video, a channel map,
// the den makeover bought with cash from videos, fan mail every 10 stars. Charts and scoring live in chart.js.
import { THREE, sfx, tone, note, buzz, confetti, burst, store, rng } from './kit/hc.js';
import { demo } from './kit/demo.js';
import { LEVELS, WORLDS } from './levels.js';
import { parse, Take, WIN, levelOf, targets, starsOf, maxPts } from './chart.js';

export function deep(X) {
  const { kick, ui, WB, F, emote, hit, applyTiers, setTiers, setLevel, setTotal, stageFx, kai, scene, renderer, hypeEl, cashEl, fmt, CATS, MAXT } = X;
  const S = store('vden2');
  let unlocked = S.get('unlocked', 1), starsBy = S.get('stars', {}), cash = S.get('cash', 0), subs = S.get('subs', 0);
  let day = S.get('day', ''), dayStreak = S.get('streak', 0), bestPct = S.get('best', {});
  let tiers = S.get('tiers', [0, 0, 0, 0]), mail = S.get('mail', 0), plaques = S.get('plaques', 0);
  const save = () => { S.set('unlocked', unlocked); S.set('stars', starsBy); S.set('cash', Math.floor(cash)); S.set('subs', Math.floor(subs)); S.set('tiers', tiers); S.set('mail', mail); S.set('plaques', plaques); S.set('day', day); S.set('streak', dayStreak); S.set('best', bestPct); };
  const totalStars = () => Object.values(starsBy).reduce((a, b) => a + b, 0);
  const worldOf = n => n > 20 ? 2 : n > 10 ? 1 : 0;
  const fpp = n => 0.1 * Math.pow(1.12, n - 1);          // followers per point: bigger channels, bigger numbers
  const COST = [40, 90, 180, 320], LINE = [1, 1.1, 0.9, 1.2];
  const costOf = (c, t) => Math.round(COST[Math.min(t, 3)] * LINE[c] / 5) * 5;
  setTiers(tiers);

  // ---------------------------------------------------------------- styles + HUD
  const css = document.createElement('style'); css.textContent = `
body.vd2 .vd-cards,body.vd2 .vd-time,body.vd2 .vd-rate{display:none!important}
body.vd2 .vd-hype{bottom:calc(240px + env(safe-area-inset-bottom))}
.vd2-lane{position:fixed;left:0;right:0;bottom:calc(20px + env(safe-area-inset-bottom));height:210px;z-index:6;pointer-events:none}
.vd2-btn{position:fixed;top:calc(60px + env(safe-area-inset-top));right:12px;z-index:8;border:0;border-radius:20px;padding:4px 12px;font:800 18px 'Baloo 2',system-ui,sans-serif;color:#fff;background:rgba(40,20,70,.32);box-shadow:0 3px 0 rgba(0,0,0,.18);cursor:pointer}
.vd2-btn:active{transform:translateY(2px)}
.vd2-ticks{position:absolute;inset:0;pointer-events:none}.vd2-ticks b{position:absolute;top:50%;transform:translate(-50%,-50%);font-size:13px;color:rgba(255,255,255,.55);text-shadow:0 1px 0 rgba(0,0,0,.25)}.vd2-ticks b.on{color:#ffd23f}
.vd2-combo{position:fixed;right:16px;bottom:calc(270px + env(safe-area-inset-bottom));z-index:6;font:800 22px 'Baloo 2',system-ui,sans-serif;color:#fff;text-shadow:0 3px 0 rgba(0,0,0,.25);pointer-events:none;transition:transform .08s}
.vd2-combo:empty{display:none}
.vd2-ov{position:fixed;inset:0;z-index:20;display:flex;flex-direction:column;justify-content:flex-end;pointer-events:none;font-family:'Baloo 2',system-ui,sans-serif;color:#3d2c5e}
.vd2-sheet{pointer-events:auto;background:#fff;border-radius:26px 26px 0 0;box-shadow:0 -8px 30px rgba(40,20,70,.25);padding:14px 14px calc(16px + env(safe-area-inset-bottom));max-height:74vh;overflow-y:auto;transform:translateY(0);animation:vd2up .28s cubic-bezier(.2,1.3,.4,1)}
@keyframes vd2up{from{transform:translateY(100%)}}
.vd2-sheet h2{margin:0;font-size:26px;line-height:1.05;text-align:center}
.vd2-sheet .sub{text-align:center;font-weight:800;font-size:15px;color:#8a7aa8;margin:2px 0 6px}
.vd2-stars{text-align:center;font-size:52px;letter-spacing:8px;line-height:1;margin:4px 0}.vd2-stars i{font-style:normal;color:#e4dcef;display:inline-block;transform:scale(.4);transition:transform .25s cubic-bezier(.3,1.8,.5,1),color .1s}
.vd2-stars i.on{color:#ffc83d;transform:scale(1)}
.vd2-stars i{width:54px;height:54px;margin:0 5px;font-size:0;background:currentColor;clip-path:polygon(50% 0,62% 36%,98% 36%,69% 58%,80% 94%,50% 72%,20% 94%,31% 58%,2% 36%,38% 36%)}.vd2-stars i.dim{transform:scale(.85)}
.vd2-line{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin:4px 0 8px}.vd2-line span{background:#f3eefc;border-radius:12px;padding:2px 10px;font-weight:800;font-size:15px}
.vd2-strip{position:relative;height:16px;margin:6px 8px;background:rgba(0,0,0,.12);border-radius:8px}.vd2-strip b{position:absolute;top:2px;width:4px;height:12px;border-radius:2px;margin-left:-2px}
.vd2-near{text-align:center;font-weight:800;font-size:18px;color:#ff4d6d;margin:2px 0 6px}
.vd2-row{display:flex;gap:8px;margin-top:8px;position:sticky;bottom:calc(-16px - env(safe-area-inset-bottom));background:#fff;padding:8px 0 calc(16px + env(safe-area-inset-bottom));z-index:2}
.vd2-row button{flex:1;border:0;border-radius:18px;padding:10px 6px;font:800 22px 'Baloo 2',system-ui,sans-serif;cursor:pointer;box-shadow:0 5px 0 rgba(60,30,90,.25)}
.vd2-row button:active{transform:translateY(3px);box-shadow:0 2px 0 rgba(60,30,90,.25)}
.vd2-go{background:#2fb34a;color:#fff}.vd2-alt{background:#efe9f8;color:#5b4a7a;flex:0 0 64px!important}
.vd2-tabs{display:flex;gap:6px;margin:8px 0}.vd2-tabs button{flex:1;border:0;border-radius:14px;padding:5px 2px;font:800 14px 'Baloo 2',system-ui,sans-serif;background:#efe9f8;color:#8a7aa8;cursor:pointer}
.vd2-tabs button.on{background:#7b5cff;color:#fff}.vd2-tabs button:disabled{opacity:.45}
.vd2-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:7px}
.vd2-tile{border:0;border-radius:14px;background:#f3eefc;padding:5px 0 3px;font:800 19px 'Baloo 2',system-ui,sans-serif;color:#3d2c5e;cursor:pointer;position:relative;box-shadow:0 3px 0 rgba(60,30,90,.15)}
.vd2-tile small{display:block;font-size:11px;letter-spacing:1px;color:#ffc83d;line-height:1}.vd2-tile small i{font-style:normal;color:#ddd3ea}
.vd2-tile.hard{background:#ffe1e7;box-shadow:0 3px 0 #ff9fb2}.vd2-tile.hard::after{content:'HARD';position:absolute;top:-6px;left:50%;transform:translateX(-50%);font-size:8px;background:#ff4d6d;color:#fff;border-radius:6px;padding:0 4px}
.vd2-tile.next{background:#7b5cff;color:#fff;animation:vd2pulse 1s ease-in-out infinite}
.vd2-tile.lock{opacity:.4;cursor:default}
@keyframes vd2pulse{50%{transform:scale(1.08)}}
.vd2-den{display:flex;gap:7px;margin-top:6px}
.vd2-den button{flex:1;border:0;border-radius:16px;background:#fff;padding:5px 2px 6px;font-family:inherit;color:#3d2c5e;box-shadow:0 0 0 2px #efe9f8,0 4px 0 rgba(60,30,90,.18);cursor:pointer}
.vd2-den .ic{font-size:26px;line-height:1.05;display:block}.vd2-den .nm{font-weight:800;font-size:12px;display:block}
.vd2-den .dots{display:flex;justify-content:center;gap:3px;margin:2px 0}.vd2-den .dots i{width:6px;height:6px;border-radius:50%;background:#e4dcef}.vd2-den .dots i.on{background:#7b5cff}
.vd2-den .cost{display:block;font-weight:800;font-size:13px;border-radius:10px;background:#e9e4f2;color:#9b90b0}
.vd2-den .can .cost{background:#2fb34a;color:#fff}.vd2-den .max .cost{background:#ffd166;color:#7a5200}
.vd2-den .can{animation:vdbob 1s ease-in-out infinite}
.vd2-h{font-weight:800;font-size:15px;margin:10px 0 0;display:flex;justify-content:space-between;align-items:center}
.vd2-mail{height:10px;border-radius:6px;background:#efe9f8;overflow:hidden;flex:1;margin:0 8px}.vd2-mail i{display:block;height:100%;background:linear-gradient(90deg,#ffd166,#ff5d8f)}
.vd2-gift{text-align:center;font-weight:800;font-size:20px;color:#7b5cff;margin:2px 0;animation:vd2pulse .6s ease-in-out 3}
`; document.head.appendChild(css);
  document.body.classList.add('vd2');
  const H = h => { const d = document.createElement('div'); d.innerHTML = h.trim(); const e = d.firstElementChild; document.body.appendChild(e); return e; };
  const rd = X.renderer ? X.renderer.domElement : document.createElement('i');
  const lane = H('<canvas class="vd2-lane"></canvas>'), g = lane.getContext('2d');
  const mapBtn = H('<button class="vd2-btn" type="button">📺</button>');
  const comboEl = H('<div class="vd2-combo"></div>');
  const bar = ui.els.top.querySelector('.hc-bar'); bar.style.position = 'relative';
  const ticks = document.createElement('div'); ticks.className = 'vd2-ticks'; ticks.innerHTML = '<b>★</b><b>★</b><b>★</b>'; bar.appendChild(ticks);
  mapBtn.addEventListener('pointerdown', e => { e.stopPropagation(); if (state === 'play') abandon(); openMap(); });
  const setCash = () => { cashEl.lastChild.textContent = fmt(cash); };

  // ---------------------------------------------------------------- lane geometry + note sprites
  let W = 390, DPR = 1; const LH = 210, CY = 112, RX = 70, SPD = 250, R = 31;
  function resize() { DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; lane.width = W * DPR; lane.height = LH * DPR; lane.style.width = W + 'px'; }
  addEventListener('resize', resize); resize();
  const spr = {};
  function mk(type) {
    const c = document.createElement('canvas'), s = 2 * (R + 4); c.width = c.height = s * 2; const x = c.getContext('2d'); x.scale(2, 2);
    const col = { x: '#ff5d8f', h: '#ff5d8f', g: '#ffc83d', o: '#2b2140', u: '#3a86ff', p: '#00c2d1', c: '#7b5cff' }[type];
    x.fillStyle = 'rgba(0,0,0,.18)'; x.beginPath(); x.arc(s / 2, s / 2 + 3, R, 0, 7); x.fill();
    x.fillStyle = col; x.beginPath(); x.arc(s / 2, s / 2, R, 0, 7); x.fill();
    x.lineWidth = 3.5; x.strokeStyle = type === 'o' ? '#ff4d6d' : '#fff'; if (type === 'p') x.setLineDash([5, 4]); x.stroke(); x.setLineDash([]);
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff';
    const glyph = { x: '', h: '', g: '⭐', o: '💀', u: '⬆', p: '', c: '🎤' }[type];
    if (glyph) { x.font = (type === 'u' ? 'bold 24px' : '20px') + ' system-ui,sans-serif'; x.fillText(glyph, s / 2, s / 2 + 1); }
    else { x.beginPath(); x.arc(s / 2, s / 2, 6, 0, 7); x.fill(); }
    return c;
  }
  for (const t of 'xhgoupc') spr[t] = mk(t);

  // ---------------------------------------------------------------- melody: pentatonic walk per video; echoes repeat the guest
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19];
  // hand-written hooks (scale steps), two phrases per world: A A A B, so a clean run is a song you can hum
  const HOOKS = [[[3, 4, 5, 4, 3, 2, 3, 1], [3, 3, 4, 5, 6, 5, 4, 3]], [[5, 4, 3, 4, 2, 3, 1, 2], [2, 3, 4, 3, 5, 4, 6, 5]], [[2, 3, 5, 3, 6, 5, 3, 2], [5, 5, 6, 8, 6, 5, 3, 5]]];
  function melody(n, notes) {
    const r = rng(n * 131 + 7), base = [60, 62, 57][worldOf(n)]; let d = 3, buf = [], lastC = false, hi = 0;
    for (const nt of notes) {
      if (nt.type === 'c') { if (!lastC) buf = []; d = Math.max(0, Math.min(8, d + [-2, -1, 1, 2, 1][Math.floor(r() * 5)])); nt.midi = base + SCALE[d]; buf.push(nt.midi); lastC = true; continue; }
      lastC = false;
      if (nt.type === 'p' && buf.length) { nt.midi = buf.shift(); continue; }
      if (nt.type === 'o') { nt.midi = base - 12; continue; }
      const ph = HOOKS[worldOf(n)][Math.floor(hi / 8) % 4 === 3 ? 1 : 0], v = ph[hi % 8]; hi++;
      d = Math.max(0, Math.min(8, v + (r() < 0.12 ? 1 : 0)));
      nt.midi = base + SCALE[d];
    }
  }

  // ---------------------------------------------------------------- round state
  let state = 'ready', level = Math.min(unlocked, 9999), L = null, C = null, T = null, t0 = 0, pausedAt = 0, beatI = 0;
  let errs = [], pulse = 0, holding = null, swipe = null, labels = [], parts = [], ringK = 0, shake = 0, lastPerfectStreak = 0, auto = '', lastViral = false, firstHand = 0;
  let LEAD = 1.2;
  const PW = () => WIN.perfect * (level <= 3 ? 1.2 : 1), GW = () => WIN.good * (level <= 3 ? 1.15 : 1);
  const songT = (now = performance.now()) => (now - t0) / 1000 - LEAD;
  let flubT = [], lockTo = -9, level0 = 0, tries = 0, subTxt = '';
  const D = demo(null, { ready: () => state === 'play' && level === 1, wait: 200, ms: 3600 });

  function start(n) {
    closeOverlay();
    level = n; L = levelOf(n, n > LEVELS.length ? F.k() : 1); C = parse(L); melody(n, C.notes); T = new Take(L);
    C.notes.forEach(nt => { nt.done = false; nt.res = ''; });
    errs = []; flubT = []; lockTo = -9; holding = null; swipe = null; labels = []; parts = []; beatI = 0; lastViral = false; firstHand = 0;
    setLevel(n); applyTiers();
    const P = X.palette(n); document.body.style.setProperty('--bg1', P.bg[0]); document.body.style.setProperty('--bg2', P.bg[1]); document.body.style.setProperty('--ui', P.ui);
    ui.levels(n); ui.progress(0); ui.sub((L.hard ? '🔥 ' : '') + L.title); ui.score('0');
    const tg = targets(L), top = tg[2];
    [...ticks.children].forEach((b, i) => { b.style.left = Math.min(97, tg[i] / top * 100) + '%'; b.classList.remove('on'); });
    LEAD = (n === level0 && tries > 0) ? 0.6 : n === 1 ? 0.9 : 1.2; level0 = n; tries++;
    t0 = performance.now(); state = 'play'; WB.start();
    if (L.hard) ui.pop('HARD VIDEO!', '#ff4d6d', 40, 34); else ui.pop('🎬 ' + L.title, '#ffffff', 28, 34);
    hypeEl.classList.remove('viral'); comboEl.textContent = ''; stageFx(0, false);
    if (n === 1 && tries === 1) { try { note(67, 0.35, 0.18); sparks('#ffd23f', 14); buzz(12); emote('🎬', new THREE.Vector3(kai.position.x, 2.0, kai.position.z), 2); } catch (e) {} }
  }
  function abandon() { state = 'map'; holding = null; swipe = null; }

  // ---------------------------------------------------------------- input: judge against the clips
  const tappable = nt => !nt.done && 'xghupc'.includes(nt.type) && nt.type !== 'c';
  function nearest(t, ok, win) { let b = null; for (const nt of C.notes) { if (nt.t > t + win) break; if (ok(nt) && Math.abs(nt.t - t) <= win && (!b || nt.t < b.t)) b = nt; } return b; }
  function label(text, color, size = 20, x = RX) { labels = labels.filter(l => l.life < 0.55); labels.push({ text, color, size, x, y: CY - 34, life: 1 }); }
  function sparks(color, n = 10, x = RX) { if (parts.length > 70) return; for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = 1.5 + Math.random() * 3; parts.push({ x, y: CY, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, life: 1, color }); } }
  function scorePop(r) { if (r && r.pts) ui.score(fmt(T.pts * fpp(level))); }
  function onViral() {
    ui.pop('GOING VIRAL!', '#ffd166', 46, 40); sfx.win(); buzz([20, 30, 20]); ui.flash(0.8); kick(1.2); rd.animate([{ transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'ease-out' }); setTimeout(() => ui.flash(0.35), 180); [0, 1, 2].forEach(i => setTimeout(() => emote(['🔥', '💜', '🌟'][i], new THREE.Vector3(kai.position.x + (i - 1) * 0.8, 2.4, kai.position.z), 3), i * 90));
    confetti(scene, new THREE.Vector3(kai.position.x, 2.4, kai.position.z), 120); hypeEl.classList.add('viral'); lastViral = true; stageFx(T.combo, true);
  }
  function judge(nt, t, how) {
    const dt = Math.abs(t - nt.t), grade = how || (dt <= PW() ? 'perfect' : 'good');
    nt.done = true; nt.res = grade;
    const r = T.hit(nt, grade, songT());
    const pf = grade === 'perfect', gold = nt.type === 'g' && pf;
    note(nt.midi + (gold ? 12 : 0), pf ? 0.4 : 0.3, pf ? 0.2 : 0.13); if (gold) setTimeout(() => sfx.coin(), 40);
    const ms = Math.round((t - nt.t) * 1000); nt.err = how ? 0 : ms; if (!how) errs.push(ms);
    const msT = how ? '' : ` ${ms < 0 ? '−' : '+'}${Math.abs(ms)}ms`;
    label(pf ? (gold ? 'GOLDEN!' : 'PERFECT') + msT : (how ? 'GOOD' : t < nt.t ? 'EARLY' : 'LATE') + msT, pf ? '#ffd23f' : '#ffffff', pf ? 24 + Math.min(14, T.combo / 3) : 18);
    if (pf && (T.combo === 5 || T.combo === 15 || T.combo === 30 || T.combo === 50)) { ui.flash(0.35 + Math.min(0.4, T.combo / 100)); shake = Math.max(shake, 0.9); kick(1); }
    if (pf && T.combo % 6 === 0) { kick(0.5 + Math.min(0.5, T.combo / 60)); shake = Math.max(shake, 0.3); }
    sparks(pf ? (gold ? '#ffc83d' : '#ffffff') : '#ffd6e8', pf ? 14 : 7); ringK = pf ? 1 : 0.6;
    hit(T.mult(songT()), nt.type === 'h' ? 2 : -1);
    emote(gold ? '⭐' : ['❤️', '👍', '🔥', '😂', '💯'][Math.floor(Math.random() * (T.mult(songT()) >= 3 ? 5 : 3))], new THREE.Vector3(kai.position.x, 2.0, kai.position.z), T.viral(songT()) ? 2 : 1);
    buzz(pf ? 12 : 6); scorePop(r); if (r.viral) onViral(); streak();
  }
  function streak() {
    const c = T.combo; stageFx(c, T.viral(songT())); comboEl.textContent = c >= 4 ? c + ' combo' : ''; comboEl.style.transform = 'scale(1.25)'; setTimeout(() => comboEl.style.transform = '', 80);
    if (c >= 10 && c % 10 === 0) { const words = ['NICE!', 'ON FIRE!', 'UNSTOPPABLE!', 'LEGENDARY!']; ui.pop(`${c} COMBO · ${words[Math.min(3, c / 10 - 1)]}`, '#ffd166', 30 + Math.min(16, c / 2), 46); tone(660 + c * 8, 0.12, 'triangle', 0.1, 1.5); }
  }
  function bad(kind) {
    if (kind === 'miss') { T.miss(); label('MISS', '#cfc6dc', 18); }
    else if (kind === 'flub') { T.flub(); label('😬', '#fff', 24); shake = 1; kick(0.25); tone(160, 0.08, 'square', 0.05, 0.7); }
    else if (kind === 'fed') { T.trollFed(); label('😡 fed the troll', '#ff4d6d', 17); shake = 1.4; sfx.fail(); buzz([30, 20, 30]); emote('💢', new THREE.Vector3(kai.position.x, 2.0, kai.position.z), 2); }
    else if (kind === 'cut') { T.combo = 0; label('CUT!', '#ff9fb2', 18); tone(240, 0.1, 'triangle', 0.07, 0.6); }
    else if (kind === 'flick') { T.miss(); label('FLICK UP!', '#8fd3ff', 17); }
    comboEl.textContent = ''; stageFx(0, false);
  }
  function down(e) {
    if (state !== 'play' || holding || swipe) return;
    const t = songT(e.timeStamp || performance.now()); if (t < -GW() || t < lockTo) return;
    let nt = nearest(t, tappable, GW());
    if (!nt && level === 1 && tries <= 1) { const f = C.notes[0]; if (f && tappable(f) && Math.abs(f.t - t) <= GW() * 3) nt = f; }
    if (!nt) {
      const tr = nearest(t, n => !n.done && n.type === 'o', 0.16);
      if (tr) { tr.done = true; tr.res = 'fed'; return bad('fed'); }
      flubT = flubT.filter(x => t - x < 1.5); flubT.push(t); if (flubT.length >= 3) { lockTo = t + 0.5; label('SLOW DOWN', '#ff4d6d', 20); }
      const soon = nearest(t, tappable, 0.34); if (soon && soon.t > t && flubT.length < 3) { label('TOO EARLY', '#b9c4ff', 17); tone(300, 0.05, 'triangle', 0.04, 0.7); return; }
      return bad('flub');
    }
    if (nt.type === 'u') { swipe = { nt, t, y: e.clientY, id: e.pointerId }; return; }
    judge(nt, t);
    if (nt.type === 'h') holding = { nt, id: e.pointerId, tick: 1 };
  }
  function move(e) {
    if (!swipe || e.pointerId !== swipe.id) return;
    if (swipe.y - e.clientY > 9) { const s = swipe; swipe = null; judge(s.nt, s.t); sparks('#8fd3ff', 10); emote('🚀', new THREE.Vector3(kai.position.x, 2.0, kai.position.z), 1); }
  }
  function up(e) {
    if (swipe && e.pointerId === swipe.id && swipe.y - e.clientY > 9) move(e);
    if (swipe && e.pointerId === swipe.id) { swipe.nt.done = true; swipe.nt.res = 'miss'; swipe = null; bad('flick'); }
    if (holding && e.pointerId === holding.id) {
      const h = holding, t = songT(); holding = null; const step = (h.nt.end - h.nt.t) / h.nt.steps;
      if (t >= h.nt.end - step) take(h.nt, true); else { T.holdDone(false, t); bad('cut'); }
    }
  }
  function take(nt, full) { const r = T.holdDone(full, songT()); label('TAKE!', '#ffd23f', 20); sparks('#ffd23f', 12); note(nt.midi + 7, 0.35, 0.16); scorePop(r); if (r.viral) onViral(); streak(); }
  addEventListener('pointerdown', down); addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  document.addEventListener('visibilitychange', () => { if (state !== 'play') return; if (document.hidden) pausedAt = performance.now(); else if (pausedAt) { t0 += performance.now() - pausedAt; pausedAt = 0; } });

  // ---------------------------------------------------------------- per frame: misses, holds, backing beat, end
  function tick(sec) {
    if (state === 'play' && !document.hidden) {
      const t = songT();
      if (T.endViral(t)) { hypeEl.classList.remove('viral'); lastViral = false; stageFx(T.combo, false); }
      // backing beat: kick on quarters, a clap on 2 and 4, hats in VIRAL; a count-in click during the lead
      while (beatI < C.beats.length && C.beats[beatI].t <= t) {
        const b = C.beats[beatI], v = T.viral(t);
        const cb = T.combo;
        if (b.beat) { tone(95, 0.12, 'sine', b.down ? 0.24 : 0.16, 0.45); if ((beatI / 2) % 2 === 1) tone(320, 0.06, 'triangle', 0.05 + (cb >= 16 ? 0.06 : 0), 0.4); pulse = 1; if (b.down && cb >= 4) { hit(T.mult(t), -1); } }
        if (b.down && cb >= 6) tone([55, 62, 49, 58][(beatI >> 3) % 4], 0.5, 'sawtooth', 0.05, 0.6);
        if (cb >= 10 && !b.beat) tone(6000, 0.02, 'triangle', 0.025, 1);
        if (v) tone(5200, 0.025, 'triangle', 0.03, 1);
        beatI++;
      }
      pulse = Math.max(0, pulse - sec * 4); rd.style.transform = pulse > 0 ? `scale(${1 + pulse * (T.viral(t) ? 0.03 : 0.012)})` : '';
      // auto play: QA bot (__game.auto) and the level-1 demo hand
      const bot = auto || (D.on && T.misses >= 2 && T.perfects + T.goods === 0 ? 'perfect' : '');
      for (const nt of C.notes) {
        if (nt.t > t + 0.02) break;
        if (nt.done) continue;
        if (nt.type === 'c' && t >= nt.t) { nt.done = true; nt.res = 'auto'; note(nt.midi, 0.4, 0.15); label('🎤', '#d9ccff', 18); sparks('#b9a6ff', 8); emote('🎤', new THREE.Vector3(kai.position.x + 0.6, 2.0, kai.position.z), 1); continue; }
        if (nt.type === 'o') { if (t > nt.t + 0.16) { nt.done = true; nt.res = 'pass'; const r = T.trollPass(t); label('😎', '#fff', 22); scorePop(r); if (r.viral) onViral(); streak(); } continue; }
        if (bot && t >= nt.t) { const k = auto === 'mixed' ? (nt.i % 3 === 0 ? 'perfect' : nt.i % 7 === 6 ? 'miss' : 'good') : bot; if (k === 'miss') continue; judge(nt, nt.t, k); if (nt.type === 'h') holding = { nt, id: -9, tick: 1 }; continue; }
        if (t > nt.t + GW() * (level === 1 && nt.i < 2 && tries <= 1 ? 3 : 1)) { nt.done = true; nt.res = 'miss'; if (level === 1 && nt.i < 2 && tries <= 1 && nt.type !== 'h') { nt.done = false; nt.res = ''; judge(nt, nt.t, 'good'); } else bad('miss'); }
      }
      if (swipe && t > swipe.t + 0.4) { swipe.nt.done = true; swipe.nt.res = 'miss'; swipe = null; bad('flick'); }
      if (holding) {
        const h = holding.nt, step = (h.end - h.t) / h.steps;
        while (holding && holding.tick < h.steps && t >= h.t + step * holding.tick) { holding.tick++; const r = T.holdTick(t); scorePop(r); hit(T.mult(t), 2); note(h.midi + 12, 0.12, 0.06); if (r.viral) onViral(); }
        if (t >= h.end) { holding = null; take(h, true); }
      }
      const tg = targets(L); ui.progress(T.pts / tg[2]); { const sc = starsOf(L, T.pts), txt = (L.hard ? '🔥 ' : '') + L.title + (sc < 3 ? ' · ' + Math.round(100 * T.pts / tg[sc]) + '% to ' + (sc + 1) + '★' : ' · 3★!'); if (txt !== subTxt) { subTxt = txt; ui.sub(txt); } }
      [...ticks.children].forEach((b, i) => b.classList.toggle('on', T.pts >= tg[i]));
      hypeEl.querySelector('i').style.width = (T.viral(t) ? Math.max(0, (T.viralTo - t) / (8 * 60 / L.bpm)) * 100 : T.hype * 100) + '%';
      hypeEl.querySelector('.x').textContent = 'x' + T.mult(t);
      if (t > C.len + 0.5 && !holding && !swipe) finish();
    }
    draw();
  }

  // ---------------------------------------------------------------- draw the timeline
  function draw() {
    g.setTransform(DPR, 0, 0, DPR, 0, 0); g.clearRect(0, 0, W, LH);
    if (state !== 'play' || !C) return;
    const t = songT(), sx = shake > 0 ? (Math.random() - 0.5) * 8 * shake : 0; shake = Math.max(0, shake - 0.08);
    g.save(); g.translate(sx, 0);
    g.fillStyle = T.viral(t) ? `rgba(${123 + pulse * 60},92,255,.5)` : `rgba(${40 + pulse * 50},20,${70 + pulse * 40},${0.26 + pulse * 0.1})`; g.beginPath(); g.roundRect(10, CY - 52, W - 20, 104, 52); g.fill();
    // beat lines
    for (const b of C.beats) { if (!b.beat) continue; const x = RX + (b.t - t) * SPD; if (x < RX - 30) continue; if (x > W) break; g.fillStyle = b.down ? 'rgba(255,255,255,.45)' : 'rgba(255,255,255,.2)'; g.fillRect(x - 1, CY - 42, 2, 84); }
    // ring
    const k = ringK; ringK = Math.max(0, ringK - 0.07);
    g.lineWidth = 6; g.strokeStyle = '#fff'; g.beginPath(); g.arc(RX, CY, R + 7 + k * 10, 0, 7); g.stroke();
    g.fillStyle = `rgba(255,45,85,${0.35 + 0.3 * Math.abs(Math.sin(performance.now() / 300))})`; g.beginPath(); g.arc(RX, CY, 9, 0, 7); g.fill();
    // long takes first (their bars sit under the clips)
    for (const nt of C.notes) {
      if (nt.type !== 'h') continue; const x0 = RX + (nt.t - t) * SPD, x1 = RX + (nt.end - t) * SPD; if (x1 < RX - 40 || x0 > W + 40) continue;
      const live = holding && holding.nt === nt, a = Math.max(live ? RX : x0, -20);
      if (nt.res && !live && nt.done && t > nt.t + 0.1 && nt.res !== 'miss') continue;
      g.fillStyle = live ? 'rgba(255,210,63,.95)' : nt.res === 'miss' ? 'rgba(200,190,215,.5)' : 'rgba(255,93,143,.7)'; g.beginPath(); g.roundRect(a, CY - 13, Math.max(0, x1 - a), 26, 13); g.fill();
    }
    const vir = T.viral(t);
    for (const nt of C.notes) {
      const x = RX + (nt.t - t) * SPD; if (x > W + R) break; if (x < -R) continue;
      if (nt.done && nt.res !== 'miss' && !(nt.type === 'h' && holding && holding.nt === nt)) continue;
      let a = 1; if (nt.type === 'p' && !nt.done) a = Math.max(0, Math.min(1, (x - RX - 70) / 90));
      if (nt.res === 'miss') a = Math.max(0, 0.5 - (t - nt.t) * 1.5);
      if (a <= 0) continue; g.globalAlpha = a;
      const s = spr[vir && 'xp'.includes(nt.type) ? 'g' : nt.type], half = s.width / 4, hx = holding && holding.nt === nt ? RX : x;
      g.drawImage(s, hx - half, CY - half, half * 2, half * 2); g.globalAlpha = 1;
    }
    // first-video hand: a pulsing finger over the ring while a clip is close
    if (level === 1 && T.perfects + T.goods < 6) { const nx = C.notes.find(n => !n.done); if (nx && nx.t - t < 0.6 && nx.t - t > -0.1) { g.font = '30px system-ui,sans-serif'; g.textAlign = 'center'; g.fillText('👆', RX + 4, CY + 58 - Math.sin(performance.now() / 90) * 4); } }
    // labels + sparks
    for (let i = labels.length - 1; i >= 0; i--) { const l = labels[i]; l.life -= 0.035; l.y -= 0.7; if (l.life <= 0) { labels.splice(i, 1); continue; } g.globalAlpha = Math.min(1, l.life * 2); g.font = `800 ${l.size}px 'Baloo 2',system-ui,sans-serif`; g.textAlign = 'left'; g.fillStyle = 'rgba(0,0,0,.25)'; g.fillText(l.text, l.x + R + 12, l.y + 2); g.fillStyle = l.color; g.fillText(l.text, l.x + R + 10, l.y); }
    g.globalAlpha = 1;
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life -= 0.04; if (p.life <= 0) { parts.splice(i, 1); continue; } g.globalAlpha = p.life; g.fillStyle = p.color; g.fillRect(p.x - 3, p.y - 3, 6, 6); }
    g.globalAlpha = 1; g.restore();
  }

  // ---------------------------------------------------------------- end of a video: stars, cash, fan mail, the card
  let ov = null;
  function closeOverlay() { if (ov) { ov.remove(); ov = null; } }
  function sheet(html) { closeOverlay(); ov = H(`<div class="vd2-ov"><div class="vd2-sheet">${html}</div></div>`); ov.addEventListener('pointerdown', e => e.stopPropagation()); return ov; }
  function finish() {
    const tg = targets(L), st = starsOf(L, T.pts), won = st >= 1, prev = starsBy[level] || 0;
    state = 'end'; holding = null; swipe = null; hypeEl.classList.remove('viral'); comboEl.textContent = '';
    const gained = T.pts * fpp(level); subs += gained; setTotal(subs);
    let freeUp = -1, earned = 0, newStars = 0, gift = 0, giftBig = false;
    if (won) {
      newStars = Math.max(0, st - prev); starsBy[level] = Math.max(prev, st);
      earned = Math.round((8 + 30 * T.pts / maxPts(L)) * (1 + 0.4 * worldOf(level))) + 3 * T.golds + 15 * newStars;
      if (level >= unlocked) unlocked = level + 1;
      if (prev === 0 && (level === 2 || level === 5) && tiers[level === 2 ? 1 : 2] < 1) { freeUp = level === 2 ? 1 : 2; tiers[freeUp]++; setTiers(tiers); }
      F.level(true); WB.submit(1);
      while (Math.floor(totalStars() / 10) > mail) { mail++; const r = Math.random(); giftBig = giftBig || r < 0.12; gift += r < 0.12 ? 200 : 25 + Math.floor(Math.random() * 40); }
    } else { F.level(false, T.pts / tg[0]); earned = Math.round(4 + 10 * T.pts / tg[0]); }
    let daily = 0; const today = new Date().toISOString().slice(0, 10);
    if (won && day !== today) { dayStreak = (Date.parse(today) - Date.parse(day || '1970-01-01')) === 864e5 ? Math.min(7, dayStreak + 1) : 1; day = today; daily = 20 * dayStreak; }
    const pct = Math.round(100 * T.pts / maxPts(L)), oldBest = bestPct[level] || 0; if (pct > oldBest) bestPct[level] = pct;
    cash += earned + gift + daily;
    const plaque = [1e4, 1e5, 1e6].filter(v => subs >= v).length; const newPlaque = plaque > plaques; plaques = Math.max(plaques, plaque);
    save(); setCash(); if (freeUp >= 0) { applyTiers(freeUp); X.buyFx(freeUp); }
    const bias = errs.length >= 6 ? Math.round(errs.reduce((a, b) => a + b, 0) / errs.length) : 0;
    const dur = Math.max(1, C.notes[C.notes.length - 1].t + 0.5);
    const strip = `<div class="vd2-strip">${C.notes.filter(n => n.type !== 'o' && n.type !== 'c').map(n => `<b style="left:${Math.min(98, 100 * n.t / dur)}%;background:${n.res === 'perfect' ? '#ffd23f' : n.res === 'good' ? '#fff' : n.res === 'miss' ? '#ff4d6d' : '#5a4a78'}"></b>`).join('')}</div>`;
    const bars = [...new Set(C.notes.filter(n => n.res === 'miss').map(n => 1 + (C.beats.findIndex(b => b.t >= n.t - 1e-6) >> 3)))].slice(0, 4);
    const missTxt = bars.length ? `<div class="vd2-near" style="color:#ff4d6d;font-size:14px">missed at bar ${bars.join(', ')}</div>` : '';
    const nextStar = st < 3 ? tg[st] : 0, short = won ? 0 : Math.max(1, Math.round((1 - T.pts / tg[0]) * 100));
    const acc = Math.round(100 * T.perfects / Math.max(1, C.notes.filter(n => n.type !== 'o' && n.type !== 'c').length));
    const ts = totalStars(), toMail = 10 - ts % 10;
    sheet(`<h2>${won ? (L.hard ? 'HARD VIDEO DONE!' : 'VIDEO POSTED!') : 'TREND OVER'}</h2><div class="sub">${level} · ${L.title}</div>
      <div class="vd2-stars">${[0, 1, 2].map(() => '<i>★</i>').join('')}</div>
      ${won ? '' : `<div class="vd2-near">${short <= 20 ? 'SO CLOSE: ' : ''}${short}% short</div>`}
      ${freeUp >= 0 ? `<div class="vd2-gift">🎁 FREE ${CATS[freeUp].name.toUpperCase()} UPGRADE!</div>` : ''}
      <div class="vd2-line"><span class="cnt" data-v="${Math.floor(gained)}">👥 +0</span><span>🏅 ${pct >= 97 ? 'S RANK ' : ''}${pct}%${pct > oldBest ? ' NEW BEST' : oldBest ? ' · best ' + oldBest + '%' : ''}</span>${won ? `<span>🎯 ${acc}% perfect</span><span>🔥 ${T.best} combo</span><span>💵 +${earned}</span>` : ''}</div>
      ${daily ? `<div class="vd2-gift">📅 DAY ${dayStreak} STREAK +💵${daily}${dayStreak < 7 ? ' · come back tomorrow for ' + 20 * (dayStreak + 1) : ' · MAX'}</div>` : ''}
      ${gift ? `<div class="vd2-gift">📬 FAN MAIL${giftBig ? ': MEGA FAN!' : ''} +💵${gift}</div>` : ''}
      ${newPlaque ? `<div class="vd2-gift">${['', '🥈 10K', '🥇 100K', '💎 1M'][plaque]} PLAQUE!</div>` : ''}
      <div class="vd2-near" style="color:#8a7aa8;font-size:15px">${won ? (st < 3 ? `★ ${fmt(Math.ceil((nextStar - T.pts) * fpp(level)))} more followers for the next star` : `📬 ${toMail} ★ to fan mail`) : (T.fed ? `fed the troll ${T.fed}×: let 💀 pass` : T.flubs > 3 ? `${T.flubs} taps off the beat` : `${T.misses} clips missed`)}</div>
      ${strip}${missTxt}${bias ? `<div class="vd2-near" style="color:#8a7aa8;font-size:14px">you tap ${Math.abs(bias)} ms ${bias < 0 ? 'early' : 'late'} on average: ${Math.abs(bias) < 25 ? 'nice timing' : 'tap a hair ' + (bias < 0 ? 'later' : 'sooner')}</div>` : ''}
      ${won ? denHtml() : ''}
      <div class="vd2-row"><button class="vd2-alt" data-m>📺</button>${won ? '<button class="vd2-alt" data-r>↻</button><button class="vd2-go" data-n>NEXT ▶</button>' : '<button class="vd2-go" data-r>RETRY</button>'}</div>`);
    { const ce = ov.querySelector('.cnt'), tot = +ce.dataset.v, t1 = performance.now(), run = () => { const k = Math.min(1, (performance.now() - t1) / 700); ce.textContent = '👥 +' + fmt(tot * (1 - Math.pow(1 - k, 3))); if (k < 1 && ov && ov.contains(ce)) requestAnimationFrame(run); }; run(); }
    const stars = ov.querySelectorAll('.vd2-stars i');
    stars.forEach((s, i) => setTimeout(() => { if (i < st) { s.classList.add('on'); note(72 + i * 4, 0.3, 0.18); buzz(10); } else s.classList.add('dim'); }, 300 + i * 260));
    ov.querySelector('[data-m]').onclick = () => openMap();
    ov.querySelectorAll('[data-b]').forEach(b => b.onclick = () => buy(+b.dataset.b, true));
    ov.querySelector('[data-r]').onclick = () => start(level);
    const nb = ov.querySelector('[data-n]'); if (nb) nb.onclick = () => start(level + 1);
    if (won) { sfx.win(); for (let i = 0; i < 2 + st; i++) setTimeout(() => confetti(scene, new THREE.Vector3(kai.position.x, 2.6, kai.position.z), 50), i * 160); emote('🏆', new THREE.Vector3(kai.position.x, 2.4, kai.position.z), 3); }
    else { sfx.fail(); buzz([40, 30, 60]); emote('😵', new THREE.Vector3(kai.position.x, 2.2, kai.position.z), 2); }
  }

  const denTiles = () => CATS.map((c, i) => { const t = tiers[i], max = t >= MAXT, cost = costOf(i, t); return `<button data-b="${i}" class="${max ? 'max' : cash >= cost ? 'can' : ''}"><span class="ic">${c.icon}</span><span class="nm">${c.name}</span><span class="dots">${[0, 1, 2, 3].map(k => `<i class="${k < t ? 'on' : ''}"></i>`).join('')}</span><span class="cost">${max ? 'MAX' : '$' + cost}</span></button>`; }).join('');
  const denHtml = () => !CATS.some((c, i) => tiers[i] < MAXT && cash >= costOf(i, tiers[i])) ? `<div class="vd2-h">🛠️ Next upgrade: 💵 ${fmt(Math.min(...CATS.map((c, i) => tiers[i] < MAXT ? costOf(i, tiers[i]) : 1e9)) - cash)} to go</div>` : `<div class="vd2-h">🛠️ Your den · 💵 ${fmt(cash)}</div><div class="vd2-den">${denTiles()}</div>`;
  // ---------------------------------------------------------------- the channel map + den makeover (a bottom sheet: the room stays in view)
  let mapWorld = worldOf(Math.min(unlocked, 30));
  function openMap(w = mapWorld) {
    mapWorld = w; state = 'map'; const ts = totalStars();
    const worldOpen = i => unlocked > WORLDS[i].from - 1 || i === 0;
    const tiles = []; for (let n = WORLDS[w].from; n < WORLDS[w].from + 10; n++) {
      const Lv = LEVELS[n - 1], s = starsBy[n] || 0, open = n <= unlocked;
      tiles.push(`<button class="vd2-tile ${Lv.hard ? 'hard' : ''} ${n === unlocked ? 'next' : ''} ${open ? '' : 'lock'}" data-l="${n}">${open ? n : '🔒'}<small>${'★'.repeat(s)}<i>${'★'.repeat(3 - s)}</i></small></button>`);
    }
    const den = denTiles();
    sheet(`<h2>📺 Kai's channel</h2><div class="sub">👥 ${fmt(subs)} followers · ★ ${ts}/${LEVELS.length * 3} · 💵 ${fmt(cash)}</div>
      <div class="vd2-tabs">${WORLDS.map((W, i) => `<button data-w="${i}" class="${i === w ? 'on' : ''}" ${worldOpen(i) ? '' : 'disabled'}>${W.icon} ${worldOpen(i) ? W.name : '🔒'}</button>`).join('')}</div>
      <div class="vd2-grid">${tiles.join('')}</div>
      <div class="vd2-h">📬 Fan mail <div class="vd2-mail"><i style="width:${(ts % 10) * 10}%"></i></div> ${ts % 10}/10 ★</div>
      <div class="vd2-h">🛠️ Den makeover</div><div class="vd2-den">${den}</div>
      <div class="vd2-row"><button class="vd2-go" data-p>▶ ${unlocked > LEVELS.length ? 'BONUS ' : ''}VIDEO ${Math.min(unlocked, 9999)}</button></div>`);
    ov.querySelectorAll('[data-w]').forEach(b => b.onclick = () => openMap(+b.dataset.w));
    ov.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { const n = +b.dataset.l; if (n <= unlocked) start(n); });
    ov.querySelectorAll('[data-b]').forEach(b => b.onclick = () => buy(+b.dataset.b));
    ov.querySelector('[data-p]').onclick = () => start(unlocked);
  }
  function buy(i, inEnd) {
    const t = tiers[i], cost = costOf(i, t);
    if (t >= MAXT) return;
    if (cash < cost) { tone(180, 0.1, 'square', 0.06); ov && ov.querySelector(`[data-b="${i}"]`)?.animate([{ transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'none' }], { duration: 180 }); return; }
    cash -= cost; tiers[i]++; setTiers(tiers); save(); setCash(); applyTiers(i);
    X.buyFx(i); if (inEnd) { const d = ov.querySelector('.vd2-den'), h = d.previousElementSibling; d.innerHTML = denTiles(); h.innerHTML = `🛠️ Your den · 💵 ${fmt(cash)}`; d.querySelectorAll('[data-b]').forEach(b => b.onclick = () => buy(+b.dataset.b, true)); } else openMap(mapWorld);
  }

  // ---------------------------------------------------------------- wire up
  ui.onTap(w => { if (w === 'start') start(Math.min(unlocked, 9999)); });
  setCash(); setTotal(subs); applyTiers();
  return {
    tick,
    get state() { return state; }, get level() { return level; }, get score() { return T ? Math.floor(T.pts * fpp(level)) : 0; },
    get stars() { return starsBy; }, get take() { return T; }, get unlocked() { return unlocked; },
    set auto(v) { auto = v; }, get auto() { return auto; },
    get notes() { return C ? C.notes.map(n => ({ t: n.t, end: n.end, type: n.type, done: n.done, res: n.res })) : []; }, get songT() { return songT(); },
    play(n) { start(n); }, map() { openMap(); },
  };
}
