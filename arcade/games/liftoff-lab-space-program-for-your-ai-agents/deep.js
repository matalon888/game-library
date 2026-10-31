// Liftoff Lab v2 "Mission Control" (studio, lane 43, 2026-10-31). A flown layer on top of v1: 30 authored missions in 3 worlds,
// stars, a mission map, chests with mission patches + rocket paints, a daily mission with a streak. Works with or without
// connected agents (agents that launched today only give the daily one spare hull). The rules live in sim.js (also run by qa/bot.mjs).
import { tone, buzz } from './kit/hc.js';
import { MISSIONS, WORLDS } from './missions.js';
import { newRun, step, boost, stars as starsOf, gatesLeft, itemPos, flareOn, flareWarn, LANE, RR, BOOST_T } from './sim.js';

const ST = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z"/></svg>';
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ymd = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const hash = s => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };

// ---------------------------------------------------------------- save
const KEY = 'liftoff_lab_deep';
const PATCHES = ['🚀', '🌙', '🪐', '⭐', '☄️', '🛰️', '👽', '🌍', '🔭', '🧑‍🚀', '🌌', '💫', '🔥', '❄️', '🌀', '⚡', '🍀', '🐙', '🦊', '🍩', '🎈', '🧲', '🌈', '🏆'];
const PAINTS = [['Classic', '#f6f2ea', '#ef4b3c'], ['Sunny', '#ffe27a', '#ff8c42'], ['Mint', '#b8f5df', '#06b58a'], ['Sky', '#bfe0ff', '#3a86ff'], ['Plum', '#e6d4ff', '#8f5bff'], ['Rose', '#ffd0ea', '#ff4fa3'], ['Midnight', '#5d6478', '#3cf0ff']];
const PAINT_AT = [0, 3, 6, 9, 13, 17, 21];
const CHEST_PTS = 6;
function load() {
  let s = null; try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  s = Object.assign({ st: [], pat: [], gold: [], opened: 0, paint: 0, daily: { date: '', done: false, stars: 0 }, streak: { last: '', n: 0 }, sats: 0, tries: 0, hints: {} }, s || {});
  while (s.st.length < MISSIONS.length) s.st.push(0);
  return s;
}
let D = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) {} };
const points = () => MISSIONS.reduce((a, m, i) => a + D.st[i] * (m.hard ? 2 : 1), 0) + (D.bonus || 0);
const chestsEarned = () => Math.floor(points() / CHEST_PTS);
const totalStars = () => D.st.reduce((a, b) => a + b, 0);
const unlocked = i => i === 0 || D.st[i - 1] > 0;
const nextIdx = () => { for (let i = 0; i < MISSIONS.length; i++) if (!D.st[i]) return i; return -1; };
const agentsToday = () => { try { const j = JSON.parse(localStorage.getItem('liftoff_lab_v1')); return j && j.today && j.today.date === ymd() ? (j.today.launches || []).length : 0; } catch (e) { return 0; } };

// ---------------------------------------------------------------- dom
const root = document.createElement('div'); root.id = 'mx'; root.hidden = true;
root.innerHTML = `<canvas id="mxc"></canvas><button id="mxPause" hidden aria-label="map"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M6 6l12 12M18 6L6 18" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg></button><button id="mxBoost" hidden><b>⚡</b><span></span></button>
<section id="mxMap" hidden></section><section id="mxCard" hidden></section><div id="mxSplash" hidden></div>`;
document.body.appendChild(root);
const cv = $('mxc'), g = cv.getContext('2d');
const nav = document.querySelector('nav'), bM = document.createElement('button'); bM.id = 'bMission'; bM.textContent = '🚀 Missions'; bM.style.background = '#ff7a2f';
nav.prepend(bM);
let W = 0, H = 0, dpr = 1, U = 30;
function resize() { dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; U = Math.min(W / 11.4, H / 17); }
addEventListener('resize', resize); resize();

// ---------------------------------------------------------------- sound
const snd = {
  gate: c => tone(520 * Math.pow(1.0595, Math.min(c, 14)), 0.13, 'triangle', 0.09, 1.02),
  perfect: c => { tone(1040 * Math.pow(1.0595, Math.min(c, 14)), 0.1, 'sine', 0.05, 1); },
  miss: () => tone(160, 0.18, 'square', 0.05, 0.6),
  hit: () => { tone(90, 0.3, 'sawtooth', 0.12, 0.5); tone(220, 0.12, 'square', 0.07, 0.4); buzz(45); },
  smash: () => { tone(300, 0.1, 'square', 0.07, 0.4); tone(700, 0.08, 'triangle', 0.06, 1.4); },
  boost: () => { tone(220, 0.35, 'sawtooth', 0.07, 3); },
  can: () => [660, 880, 1100].forEach((f, i) => setTimeout(() => tone(f, 0.1, 'triangle', 0.07, 1), i * 60)),
  sat: () => { tone(1046, 0.1, 'sine', 0.07, 1); setTimeout(() => tone(1568, 0.14, 'sine', 0.06, 1), 80); },
  near: () => tone(900, 0.05, 'sine', 0.06, 1.5),
  star: k => tone(660 * Math.pow(1.26, k), 0.22, 'triangle', 0.1, 1.05),
  win: () => [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.08, 1), i * 90)),
  lose: () => [330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.2, 'triangle', 0.07, 0.9), i * 130)),
  tick: () => tone(660, 0.06, 'sine', 0.06, 1), go: () => tone(990, 0.16, 'triangle', 0.09, 1.2),
};

// ---------------------------------------------------------------- state
let open = false, raf = 0, last = 0, T = 0;
let mode = 'map';                    // map | count | fly | end
let cur = null, curIdx = 0, curM = null, daily = false, countT = 0;
let hitstop = 0, slow = 0, shake = 0, flash = 0, flashC = '#fff', hullFlash = 0, endT = 0;
let parts = [], pops = [], stk = [];   // particles, popups, trail
const touch = { id: null, x0: 0, tx0: 0, t0: 0, moved: 0 };
let keys = 0;

const mirror = rows => rows.map(r => r.trim().split(/\s+/).map(tk => tk === '-' ? tk : tk[0] === 'f' ? 'f' + (tk[1] === 'L' ? 'R' : 'L') : tk[0] + String(-(+tk.slice(1)) || 0)).join(' '));
function dailyPick() { const n = Math.max(1, MISSIONS.findIndex((m, i) => !D.st[i]) < 0 ? MISSIONS.length : MISSIONS.findIndex((m, i) => !D.st[i]) + 1); return hash('liftoff' + ymd()) % n; }
function missionFor(idx, isDaily) {
  const m = MISSIONS[idx];
  if (!isDaily) return m;
  return { ...m, name: 'Daily: ' + m.name, rows: mirror(m.rows), sp: (m.sp || 1) + 0.04 };
}

function startMission(idx, isDaily = false) {
  curIdx = idx; daily = isDaily; curM = missionFor(idx, isDaily);
  cur = newRun(curM);
  const bonus = isDaily && agentsToday() > 0 ? 1 : 0;
  cur.hull = cur.hullMax = 3 + bonus; cur.bonusHull = bonus;
  parts = []; pops = []; stk = []; hitstop = 0; slow = 0; shake = 0; flash = 0; hullFlash = 0;
  mode = 'count'; countT = 0.9; cur.tx = 0; cur.shown = 0;
  hide('mxMap'); hide('mxCard'); $('mxPause').hidden = false; $('mxBoost').hidden = false; updateBoostBtn();
  D.tries++; save(); snd.tick();
}
const hide = id => { $(id).hidden = true; };
const show = id => { $(id).hidden = false; };

// ---------------------------------------------------------------- opening and closing the overlay
function openMx(toMap = true) {
  if (open) { if (toMap) goMap(); return; }
  open = true; root.hidden = false; if (window.__ls) window.__ls.autoRender = false;
  if (toMap) goMap();
  last = performance.now(); if (!raf) raf = requestAnimationFrame(frame);
}
function closeMx() { open = false; root.hidden = true; mode = 'map'; if (window.__ls) window.__ls.autoRender = true; }
bM.onclick = () => openMx(true);
$('mxPause').onclick = () => { snd.tick(); goMap(); };

// ---------------------------------------------------------------- input
const worldPerPx = () => 1.15 / U;
cv.addEventListener('pointerdown', e => {
  if (mode !== 'fly' && mode !== 'count') return;
  if (touch.id != null) return;
  touch.id = e.pointerId; touch.x0 = e.clientX; touch.tx0 = cur.tx; touch.t0 = performance.now(); touch.moved = 0;
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
});
cv.addEventListener('pointermove', e => {
  if (e.pointerId !== touch.id || !cur) return;
  const dx = e.clientX - touch.x0; D.hints.steer = 1; touch.moved = Math.max(touch.moved, Math.abs(dx));
  cur.tx = clamp(touch.tx0 + dx * worldPerPx(), -LANE + 0.5, LANE - 0.5);
});
const upH = e => {
  if (e.pointerId !== touch.id) return; touch.id = null;
  if (mode === 'fly' && touch.moved < 10 && performance.now() - touch.t0 < 240) doBoost();
};
cv.addEventListener('pointerup', upH); cv.addEventListener('pointercancel', upH);
$('mxBoost').addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); doBoost(); });
addEventListener('keydown', e => {
  if (!open) return;
  if (e.key === 'ArrowLeft' || e.key === 'a') keys = -1; else if (e.key === 'ArrowRight' || e.key === 'd') keys = 1;
  else if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); if (mode === 'fly') doBoost(); else if (mode === 'end') $('mxPrimary') && $('mxPrimary').click(); }
});
addEventListener('keyup', e => { if ((e.key === 'ArrowLeft' || e.key === 'a') && keys < 0) keys = 0; if ((e.key === 'ArrowRight' || e.key === 'd') && keys > 0) keys = 0; });
function doBoost() { if (mode !== 'fly') return; if (boost(cur)) { D.hints.boost = 1; snd.boost(); shake = Math.max(shake, 0.12); } else if (cur.fuel < 1) { pop(cur.x, cur.y + 1.5, 'no fuel', '#ff8a7a', 0.7); } }
function updateBoostBtn() { const b = $('mxBoost'); if (!cur) return; b.querySelector('span').textContent = '●'.repeat(cur.fuel) + '○'.repeat(3 - cur.fuel); b.classList.toggle('on', cur.boostT > 0); b.classList.toggle('empty', cur.fuel < 1); }

// ---------------------------------------------------------------- fx
function burst(x, y, n, col, sp = 4, life = 0.6, size = 5) {
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = sp * (0.3 + Math.random()); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: life * (0.6 + Math.random() * 0.6), ml: life, c: Array.isArray(col) ? col[i % col.length] : col, s: size * (0.6 + Math.random() * 0.7) }); }
}
function ring(x, y, col, r = 2.2) { parts.push({ ring: 1, x, y, vx: 0, vy: 0, l: 0.5, ml: 0.5, c: col, s: r }); }
function pop(x, y, text, color = '#fff', life = 1.0, size = 20) { pops.push({ x, y, text, c: color, l: life, ml: life, size }); }
function handle(e) {
  const r = cur;
  switch (e.e) {
    case 'gold': {
      const it = e.it; (r._gp = r._gp || new Set()).add(it); snd.perfect(14); snd.win();
      burst(it.x, it.y, 46, ['#ffe066', '#fff', '#ffb000'], 6, 0.9, 5); ring(it.x, it.y, '#ffe066', 3.4); ring(it.x, it.y, '#fff', 2);
      flash = 0.35; flashC = '#ffe066'; shake = Math.max(shake, 0.25); pop(it.x, it.y + 1.2, 'GOLDEN RING! +3', '#ffe066', 1.4, 30); pop(it.x, it.y + 0.2, 'fuel full', '#fff', 1, 16);
      break;
    }
    case 'goldmiss': { const it = e.it; (r._gp = r._gp || new Set()); pop(it.x, it.y + 1, 'so close!', '#ffe066', 0.8, 18); break; }
    case 'gate': {
      const it = e.it; (r._gp = r._gp || new Set()).add(it); snd.gate(e.combo); if (e.perfect) snd.perfect(e.combo);
      burst(it.x, it.y, 8 + Math.min(e.combo, 10) * 2, ['#ffd23f', '#fff', '#3cf0c0'], 3 + e.combo * 0.25, 0.6, 4);
      ring(it.x, it.y, e.perfect ? '#3cf0c0' : '#ffd23f', 2.4);
      if (e.perfect) pop(it.x, it.y + 1, e.combo >= 3 ? 'PERFECT x' + e.combo : 'PERFECT', '#3cf0c0', 0.9, 20 + Math.min(e.combo, 10));
      else if (e.combo >= 3) pop(it.x, it.y + 1, 'x' + e.combo, '#ffd23f', 0.8, 18 + Math.min(e.combo, 10));
      if (e.combo === 5 || e.combo === 10 || e.combo === 15) { flash = 0.25; flashC = '#ffd23f'; shake = Math.max(shake, 0.18); pop(0, r.y + 5, e.combo === 5 ? 'ON FIRE!' : e.combo === 10 ? 'UNSTOPPABLE!' : 'LEGEND!', '#ff7a2f', 1.2, 34); }
      if (e.close) pop(it.x + (r.x > it.x ? 1 : -1) * it.w / 2, it.y + 0.6, 'close!', '#fff', 0.6, 14);
      break;
    }
    case 'miss': snd.miss(); pop(e.it.x, e.it.y + 1, 'missed', '#ff8a7a', 0.9, 18); break;
    case 'hit': snd.hit(); hitstop = 0.09; shake = 0.55; flash = 0.3; flashC = '#ff4d3d'; hullFlash = 0.6; burst(e.x, e.y, 22, ['#ff7a2f', '#ffd23f', '#9aa0b4'], 6, 0.7, 6); pop(r.x, r.y + 1.5, r.hull > 0 ? 'ouch!' : 'boom!', '#ff6a5a', 0.9, 24); break;
    case 'smash': snd.smash(); shake = Math.max(shake, 0.15); burst(e.x, e.it.y, 14, ['#c59a64', '#8a6a44', '#ffd9a6'], 5, 0.6, 5); pop(e.x, e.it.y + 1, 'SMASH', '#ffd23f', 0.7, 18); break;
    case 'near': snd.near(); slow = 0.2; pop(e.x, e.it.y + 1.4, 'close call', '#fff', 0.7, 14); break;
    case 'can': snd.can(); burst(e.it.x, e.it.y, 12, '#7be37b', 4, 0.5, 4); pop(e.it.x, e.it.y + 1, '+fuel', '#7be37b', 0.8, 18); break;
    case 'sat': snd.sat(); D.sats++; burst(e.it.x, e.it.y, 12, ['#9be8ff', '#fff'], 4, 0.5, 4); pop(e.it.x, e.it.y + 1, 'snapshot!', '#9be8ff', 0.9, 18); break;
    case 'win': endMission(true); break;
    case 'lose': endMission(false); break;
  }
}

// ---------------------------------------------------------------- update
function frame(ts) {
  raf = 0; if (!open) return;
  const dt = Math.min(0.05, (ts - last) / 1000); last = ts; T += dt;
  update(dt); draw();
  raf = requestAnimationFrame(frame);
}
function update(dt) {
  for (const p of parts) { p.l -= dt; if (!p.ring) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= 3 * dt; } }
  parts = parts.filter(p => p.l > 0);
  for (const p of pops) p.l -= dt; pops = pops.filter(p => p.l > 0);
  shake = Math.max(0, shake - dt * 1.6); flash = Math.max(0, flash - dt); hullFlash = Math.max(0, hullFlash - dt);
  if (!cur) return;
  if (mode === 'count') {
    countT -= dt; const n = Math.ceil(countT / 0.3);
    if (n !== cur.shown && n > 0) { cur.shown = n; snd.tick(); }
    if (countT <= 0) { mode = 'fly'; snd.go(); burst(cur.x, cur.y - 0.8, 16, ['#ffd23f', '#ff7a2f', '#fff'], 4, 0.6, 6); }
    return;
  }
  if (mode === 'fly' || mode === 'end') {
    if (keys && mode === 'fly') cur.tx = clamp(cur.tx + keys * 10 * dt, -LANE + 0.5, LANE - 0.5);
    if (hitstop > 0) { hitstop -= dt; return; }
    if (mode === 'fly') {
      slow = Math.max(0, slow - dt);
      let rem = dt * (slow > 0 ? 0.45 : 1);
      while (rem > 0 && mode === 'fly') { const s = Math.min(rem, 1 / 60); step(cur, s); rem -= s; for (const e of cur.ev.slice()) handle(e); }
      // exhaust + trail
      if (mode === 'fly') {
        const b = cur.boostT > 0;
        stk.push({ x: cur.x + (Math.random() - 0.5) * 0.25, y: cur.y - 1.2, l: b ? 0.5 : 0.35, ml: b ? 0.5 : 0.35, s: b ? 0.55 : 0.32 });
        if (stk.length > 60) stk.shift();
      }
      updateBoostBtn();
    } else if (mode === 'end') { cur.y += 6 * dt; if (cur.status === 'win') cur.x += (0 - cur.x) * dt * 3; }
  }
  for (const t of stk) t.l -= dt; stk = stk.filter(t => t.l > 0);
}

// ---------------------------------------------------------------- end of a mission
function endMission(win) {
  mode = 'end'; endT = T; $('mxBoost').hidden = true; $('mxPause').hidden = true;
  if (win) {
    snd.win(); flash = 0.4; flashC = '#fff';
    const s = starsOf(cur), before = chestsEarned(), old = D.st[curIdx];
    if (!daily) { D.st[curIdx] = Math.max(old, s); }
    let dmsg = '';
    if (daily) {
      if (!(D.daily.date === ymd() && D.daily.done)) {
        D.daily = { date: ymd(), done: true, stars: s };
        const y = new Date(); y.setDate(y.getDate() - 1);
        D.streak.n = D.streak.last === ymd(y) ? D.streak.n + 1 : 1; D.streak.last = ymd();
        D.bonus = (D.bonus || 0) + 2; dmsg = 'daily done';
      }
    }
    save();
    for (let i = 0; i < 40; i++) setTimeout(() => burst((Math.random() - 0.5) * 8, cur.y + 2 + Math.random() * 6, 6, ['#ff5d5d', '#ffd23f', '#3cf0c0', '#3a86ff', '#ff6fc8'], 5, 1.2, 5), i * 25);
    setTimeout(() => resultCard(true, s, old, before, dmsg), 900);
  } else {
    snd.lose(); const left = gatesLeft(cur);
    setTimeout(() => resultCard(false, 0, 0, 0, ''), 450);
  }
}

// ---------------------------------------------------------------- cards
const stars3 = (s, big) => `<div class="mxStars${big ? ' xl' : ''}">${[0, 1, 2].map(i => `<i class="${i < s ? 'on' : ''}" style="animation-delay:${0.35 + i * 0.4}s">${ST}</i>`).join('')}</div>`;
function resultCard(win, s, old, before, dmsg) {
  if (!open || mode !== 'end') return;
  const c = $('mxCard'); const m = curM, i = curIdx;
  const hardTag = m.hard ? '<em class="hard">HARD · pays double</em>' : '';
  let html = '';
  if (win) {
    for (let k = 0; k < s; k++) setTimeout(() => open && snd.star(k), 350 + k * 400);
    const after = chestsEarned(), newChest = after > before;
    const nxt = daily ? -1 : (i + 1 < MISSIONS.length ? i + 1 : -1);
    const w = WORLDS[m.world];
    const worldDone = !daily && i === 9 || i === 19 || i === 29;
    const pts = points() % CHEST_PTS, avail = chestsEarned() - D.opened;
    const hint = s < 3 ? (cur.hits ? 'no hits = 2 stars' : cur.missed ? 'every ring = 3 stars' : 'finish with a boost charge left = 3 stars') : 'Perfect run!';
    html = `<div class="mxBox win"><h2>${worldDone ? '🌍 ' + w.name + ' cleared!' : 'LIFTOFF!'}</h2><p class="sub">${esc(m.name)} ${hardTag}</p>${stars3(s, true)}
      <div class="mxStat"><span>🎯 ${cur.passed}/${cur.p.gates}</span><span>❤ ${cur.hull}/${cur.hullMax}</span><span>⚡ ${cur.fuel}</span>${cur.sats ? `<span>📡 ${cur.sats}</span>` : ''}<span>🔥 x${cur.bestCombo}</span></div>
      ${s > old && !daily && old > 0 ? '<p class="newbest">new best!</p>' : ''}<p class="hint">${hint}</p>
      <div class="mxChestBar"><div style="width:${(pts / CHEST_PTS) * 100}%"></div><span>🎁 ${avail > 0 ? avail + ' ready!' : (CHEST_PTS - pts) + ' stars to next chest'}</span></div>
      ${dmsg ? `<p class="hint">🔥 daily streak ${D.streak.n} · back tomorrow</p>` : ''}
      <div class="mxBtns">${avail > 0 ? '<button id="mxChest" class="gold">Open chest 🎁</button>' : ''}
      ${nxt >= 0 ? `<button id="mxPrimary" class="go">Next: ${esc(MISSIONS[nxt].name)} ▶</button>` : '<button id="mxPrimary" class="go">Map</button>'}
      <div class="row"><button id="mxRetry">${s < 3 ? 'Go for ' + (s + 1) + ' stars' : 'Again'}</button><button id="mxMapBtn">Map</button></div></div></div>`;
  } else {
    const left = gatesLeft(cur), pct = Math.round(clamp(cur.y / cur.p.len, 0, 1) * 100);
    html = `<div class="mxBox lose"><h2>SO CLOSE!</h2><p class="sub">${esc(m.name)} ${hardTag}</p>
      <p class="why">${pct}% there · ${left > 0 ? left + ' ring' + (left > 1 ? 's' : '') + ' left' : 'almost home'}</p><p class="hint">Hit by ${cur.why || 'space junk'}. ${cur.fuel > 0 && /rock|debris/.test(cur.why) ? '⚡ boost smashes rocks!' : cur.fuel < 1 ? 'Grab the green cans for fuel.' : 'You have more hull next time: steer early.'}</p>
      <div class="mxBtns"><button id="mxPrimary" class="go">Retry</button><div class="row"><button id="mxMapBtn">Map</button></div></div></div>`;
  }
  c.innerHTML = html; show('mxCard');
  $('mxPrimary').onclick = () => { if (win && !daily && i + 1 < MISSIONS.length) startMission(i + 1); else if (win) goMap(); else startMission(i, daily); };
  const rb = $('mxRetry'); if (rb) rb.onclick = () => startMission(i, daily);
  const mb = $('mxMapBtn'); if (mb) mb.onclick = goMap;
  const ch = $('mxChest'); if (ch) ch.onclick = () => chestReveal();
}
const esc = s => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

function chestReveal() {
  const have = new Set(D.pat), left = PATCHES.map((p, i) => i).filter(i => !have.has(i));
  if (chestsEarned() <= D.opened) return;
  D.opened++;
  let id = -1, gold = false;
  if (left.length) { id = left[Math.floor(Math.random() * left.length)]; D.pat.push(id); gold = Math.random() < 0.12; if (gold) D.gold.push(id); }
  save(); snd.win();
  const n = D.pat.length, np = PAINT_AT.filter(a => n >= a).length, newPaint = PAINT_AT.includes(n) && n > 0;
  const c = $('mxCard');
  c.innerHTML = `<div class="mxBox chest"><h2>${gold ? '✨ GOLDEN PATCH!' : 'New patch!'}</h2><div class="patch big${gold ? ' gold' : ''}">${id >= 0 ? PATCHES[id] : '⭐'}</div>
    <p class="sub">${n}/24 collected${newPaint ? ' · new rocket paint: ' + PAINTS[np - 1][0] : ''}</p>
    <div class="mxBtns"><button id="mxBack" class="go">OK</button></div></div>`;
  burst(0, cur ? cur.y + 3 : 0, 30, ['#ffd23f', '#fff', '#ff6fc8'], 6, 1, 6);
  $('mxBack').onclick = () => { if (mode === 'end') resultCard(true, starsOf(cur), D.st[curIdx], chestsEarned(), ''); else goMap(); };
}

// ---------------------------------------------------------------- map
function goMap() {
  mode = 'map'; cur = null; hide('mxCard'); $('mxBoost').hidden = true; $('mxPause').hidden = true;
  const dn = dailyPick(), dDone = D.daily.date === ymd() && D.daily.done, nx = nextIdx(), pts = points() % CHEST_PTS, avail = chestsEarned() - D.opened;
  const y = new Date(); y.setDate(y.getDate() - 1);
  const sn = D.streak.last === ymd() || D.streak.last === ymd(y) ? D.streak.n : 0;
  let html = `<header><div class="mxTitle">MISSION CONTROL</div><div class="mxTop"><span>${ST} ${totalStars()}/${MISSIONS.length * 3}</span><span>🧩 ${D.pat.length}/24</span><button id="mxPad" title="launch pad">🏗 Pad</button></div></header>
  <div class="mxActs"><button id="mxDaily" class="${dDone ? 'done' : 'hot'}">${dDone ? '✔ Daily done' : '🔥 Daily mission'} <small>${sn ? 'streak ' + sn : 'start a streak'}</small></button>
  <button id="mxPatch" class="${avail ? 'hot' : ''}">${avail ? '🎁 ' + avail + ' chest' + (avail > 1 ? 's' : '') + '!' : '🧩 Patches'} <small>${avail ? 'open' : (CHEST_PTS - pts) + ' to chest'}</small></button></div>
  <div class="mxScroll">`;
  WORLDS.forEach((w, wi) => {
    const ws = MISSIONS.reduce((a, m, i) => a + (m.world === wi ? D.st[i] : 0), 0);
    html += `<h3 style="--c:${w.chip}"><b>${w.name}</b><span>${w.blurb}</span><em>${ST} ${ws}/30</em></h3><div class="mxPath">`;
    MISSIONS.forEach((m, i) => {
      if (m.world !== wi) return;
      const k = i % 10, lock = !unlocked(i), isN = i === nx;
      const off = [0, 1, 2, 1, 0, -1, -2, -1, 0, 1][k] * 26;
      html += `<button class="node${lock ? ' lock' : ''}${isN ? ' next' : ''}${m.hard ? ' hardn' : ''}" data-i="${i}" style="--o:${off}px;--c:${w.chip}"><span class="n">${lock ? '🔒' : i + 1}</span><span class="nm">${esc(m.name)}</span><span class="s">${lock ? '' : [0, 1, 2].map(j => `<i class="${j < D.st[i] ? 'on' : ''}">${ST}</i>`).join('')}</span>${m.hard ? '<u>HARD</u>' : ''}</button>`;
    });
    html += `</div>`;
  });
  html += `<p class="mxEnd">${nx < 0 ? 'Every world cleared! Replay for 3★ and new patches.' : 'Next up: ' + esc(MISSIONS[nx].name)}</p></div>`;
  const mp = $('mxMap'); mp.innerHTML = html; show('mxMap');
  mp.querySelectorAll('.node:not(.lock)').forEach(b => b.onclick = () => brief(+b.dataset.i));
  mp.querySelectorAll('.node.lock').forEach(b => b.onclick = () => { snd.miss(); });
  $('mxPad').onclick = () => closeMx();
  $('mxDaily').onclick = () => { if (!dDone) { snd.tick(); startMission(dn, true); } else brief(dn); };
  $('mxPatch').onclick = () => patchPanel();
  const nn = mp.querySelector('.node.next'); if (nn) nn.scrollIntoView({ block: 'center' });
}
function brief(i) {
  const m = MISSIONS[i], c = $('mxCard');
  c.innerHTML = `<div class="mxBox brief"><h2>${i + 1}. ${esc(m.name)}</h2>${m.hard ? '<em class="hard">HARD · pays double</em>' : ''}<p class="purpose">${esc(m.purpose)}</p>${stars3(D.st[i], false)}
    <p class="hint">1 star: arrive · 2: no hits · 3: every ring + a charge left</p><div class="mxBtns"><button id="mxPrimary" class="go">GO ▶</button><div class="row"><button id="mxBackM">Back</button></div></div></div>`;
  show('mxCard'); hide('mxMap');
  $('mxPrimary').onclick = () => startMission(i); $('mxBackM').onclick = goMap;
}
function patchPanel() {
  const c = $('mxCard'), avail = chestsEarned() - D.opened, have = new Set(D.pat), n = D.pat.length;
  c.innerHTML = `<div class="mxBox patches"><h2>Mission patches ${n}/24</h2>
    <div class="pgrid">${PATCHES.map((p, i) => have.has(i) ? `<div class="patch${D.gold.includes(i) ? ' gold' : ''}">${p}</div>` : '<div class="patch empty">?</div>').join('')}</div>
    <p class="sub">Rocket paint</p><div class="paints">${PAINTS.map((p, i) => { const ok = n >= PAINT_AT[i]; return `<button class="paint${D.paint === i ? ' sel' : ''}${ok ? '' : ' lk'}" data-i="${i}" style="background:linear-gradient(90deg,${p[1]} 50%,${p[2]} 50%)" title="${ok ? p[0] : n + '/' + PAINT_AT[i] + ' patches'}">${ok ? '' : '🔒'}</button>`; }).join('')}</div>
    <div class="mxBtns">${avail > 0 ? '<button id="mxChest" class="gold">Open chest 🎁</button>' : `<p class="hint">Next chest in ${CHEST_PTS - points() % CHEST_PTS} stars (hard missions pay double)</p>`}<button id="mxBackM" class="go">Back</button></div></div>`;
  show('mxCard'); hide('mxMap');
  c.querySelectorAll('.paint:not(.lk)').forEach(b => b.onclick = () => { D.paint = +b.dataset.i; save(); snd.tick(); patchPanel(); });
  $('mxBackM').onclick = goMap; const ch = $('mxChest'); if (ch) ch.onclick = () => { chestReveal(); };
}

// ---------------------------------------------------------------- drawing
const lc = (a, b, t) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const A = p(a), B = p(b); return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')'; };
const STARS = Array.from({ length: 90 }, (_, i) => ({ x: ((i * 73) % 100) / 100, y: ((i * 41) % 100) / 100, s: 0.6 + (i % 5) * 0.5, f: 0.1 + (i % 4) * 0.08 }));
const CLOUDS = Array.from({ length: 7 }, (_, i) => ({ x: ((i * 37) % 100) / 100, y: ((i * 29) % 100) / 100, s: 1 + (i % 3) * 0.6 }));
const sx = wx => W / 2 + wx * U;
let baseY = 0; const sy = wy => baseY - (wy - (cur ? cur.y : 0)) * U;
function draw() {
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  baseY = H * 0.74;
  const wi = curM ? curM.world : 0, w = WORLDS[wi], prog = cur ? clamp(cur.y / cur.p.len, 0, 1) : 0;
  const top = lc(w.sky[0], '#02030c', wi === 0 ? prog * 0.85 : prog * 0.3), bot = lc(w.sky[1], w.sky[0], wi === 0 ? prog * 0.9 : prog * 0.4);
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, top); gr.addColorStop(1, bot); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  if (mode === 'map' || !cur) { drawStars(0.9, 0); return; }
  const sh = shake * 8; g.save(); if (sh) g.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
  drawStars(w.stars + prog * (wi === 0 ? 0.9 : 0.3), cur.y);
  if (wi === 0) for (const c of CLOUDS) { const cy = ((c.y * H * 1.4 + cur.y * U * 0.6) % (H * 1.4)); const yy = H * 1.2 - cy; g.fillStyle = `rgba(255,255,255,${0.55 * (1 - prog * 0.9)})`; blob(c.x * W, yy, 40 * c.s, 16 * c.s); }
  // speed streaks: near parallax layer, density and length scale with combo and boost
  { const cmb = Math.min(cur.combo || 0, 15), bo = cur.boostT > 0 ? 1 : 0, n = 10 + cmb + bo * 14, len = (14 + cmb * 3 + bo * 38);
    g.strokeStyle = bo ? 'rgba(160,240,255,.5)' : 'rgba(255,255,255,.22)'; g.lineWidth = 2;
    for (let k = 0; k < n; k++) { const xx = ((k * 83.7) % 100) / 100 * W, yy = ((k * 131 + (mode === 'fly' ? T : 0) * (380 + cmb * 30 + bo * 520)) % (H + 80)) - 40; g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx, yy + len); g.stroke(); } }
  // lane edges
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 0, sx(-LANE), H); g.fillRect(sx(LANE), 0, W, H);
  g.strokeStyle = 'rgba(255,255,255,.28)'; g.setLineDash([10, 12]); g.lineWidth = 2; g.lineDashOffset = -cur.y * U % 22; g.beginPath(); g.moveTo(sx(-LANE), 0); g.lineTo(sx(-LANE), H); g.moveTo(sx(LANE), 0); g.lineTo(sx(LANE), H); g.stroke(); g.setLineDash([]);
  // wind streaks
  for (const wd of cur.p.winds) { const y0 = sy(wd.y1), y1 = sy(wd.y0); if (y1 < 0 || y0 > H) continue; g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; for (let k = 0; k < 9; k++) { const yy = y0 + ((k * 53 + T * 140) % (y1 - y0 + 1)), xx = ((k * 97 + T * 60 * Math.sign(wd.w)) % (W + 80)); const x2 = ((xx % W) + W) % W; g.beginPath(); g.moveTo(x2, yy); g.lineTo(x2 + Math.sign(wd.w) * 34, yy); g.stroke(); } }
  // destination + finish
  const fy = sy(cur.p.len); if (fy > -8 * U) { drawPlanet(fy - 3 * U); g.fillStyle = 'rgba(255,255,255,.9)'; for (let k = 0; k < 22; k++) { g.fillStyle = (k + (curIdx & 1)) % 2 ? '#fff' : '#222'; g.fillRect(sx(-LANE) + k * (10 * U / 22), fy - 6, 10 * U / 22, 12); } }
  // trail
  for (const t of stk) { g.fillStyle = `rgba(255,${200 - (1 - t.l / t.ml) * 120 | 0},120,${t.l / t.ml * 0.5})`; g.beginPath(); g.arc(sx(t.x), sy(t.y), t.s * U * (0.6 + (1 - t.l / t.ml)), 0, 6.283); g.fill(); }
  // items
  for (const it of cur.p.items) {
    const y = sy(it.y); if (y < -3 * U || y > H + 3 * U) continue;
    const dn = cur.done.has(it);
    if (it.k === 'g') drawGate(it, y, dn);
    else if (it.k === 'r' && !dn) drawRock(it, sx(it.x), y, '#8b8fa3', '#b9bdd0');
    else if (it.k === 'd' && !dn) drawDebris(it, sx(it.x), y);
    else if (it.k === 'm' && !dn) { drawRock(it, sx(itemPos(it, cur.t)), y, '#a0705a', '#d49a7a'); }
    else if (it.k === 'c' && !dn) drawCan(sx(it.x), y);
    else if (it.k === 's' && !dn) drawSat(sx(it.x), y);
    else if (it.k === 'w') drawWell(it, sx(it.x), y, dn);
    else if (it.k === 'f') drawFlare(it, y);
  }
  // particles
  for (const p of parts) {
    const a = p.l / p.ml;
    if (p.ring) { g.strokeStyle = p.c; g.globalAlpha = a; g.lineWidth = 4 * a + 1; g.beginPath(); g.arc(sx(p.x), sy(p.y), (1 - a) * p.s * U + 6, 0, 6.283); g.stroke(); g.globalAlpha = 1; }
    else { g.globalAlpha = Math.min(1, a * 1.4); g.fillStyle = p.c; g.beginPath(); g.arc(sx(p.x), sy(p.y), p.s * (0.4 + a * 0.6), 0, 6.283); g.fill(); g.globalAlpha = 1; }
  }
  drawRocket();
  for (const p of pops) { const a = p.l / p.ml, rise = (1 - a) * 1.4; g.globalAlpha = Math.min(1, a * 2); g.font = `700 ${p.size}px Fredoka, system-ui`; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.45)'; const yy = sy(p.y + rise), xx = clamp(sx(p.x), 60, W - 60); g.strokeText(p.text, xx, yy); g.fillStyle = p.c; g.fillText(p.text, xx, yy); g.globalAlpha = 1; }
  g.restore();
  if (flash > 0) { g.globalAlpha = flash * 1.3; g.fillStyle = flashC; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
  drawHud();
}
function drawStars(f, off) {
  g.fillStyle = '#fff';
  for (const s of STARS) { const y = ((s.y * H + off * U * s.f * 0.5) % H); g.globalAlpha = Math.min(1, f) * (0.4 + 0.6 * ((s.x * 7 + T * 0.8 + s.y * 5) % 1)); g.fillRect(s.x * W, H - y, s.s, s.s); }
  g.globalAlpha = 1;
}
function blob(x, y, rx, ry) { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 6.283); g.ellipse(x - rx * 0.6, y + ry * 0.3, rx * 0.6, ry * 0.8, 0, 0, 6.283); g.ellipse(x + rx * 0.6, y + ry * 0.2, rx * 0.7, ry * 0.9, 0, 0, 6.283); g.fill(); }
function drawPlanet(y) {
  const hue = (curIdx * 47) % 360, r = 5.2 * U, x = sx(0);
  const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); gr.addColorStop(0, `hsl(${hue},70%,78%)`); gr.addColorStop(1, `hsl(${hue + 30},60%,42%)`);
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
  g.fillStyle = `hsla(${hue + 60},50%,85%,.35)`; g.beginPath(); g.ellipse(x + r * 0.2, y - r * 0.1, r * 0.5, r * 0.12, -0.2, 0, 6.283); g.fill();
  if (curIdx % 3 === 2) { g.strokeStyle = `hsla(${hue + 20},60%,80%,.8)`; g.lineWidth = 6; g.beginPath(); g.ellipse(x, y, r * 1.5, r * 0.3, -0.25, 0, 6.283); g.stroke(); }
}
function drawGate(it, y, done) {
  const l = sx(it.x - it.w / 2), r = sx(it.x + it.w / 2), passed = done && cur.passed > 0 && it.hitMark !== false;
  const state = !done ? 0 : (cur._gp && cur._gp.has(it) ? 1 : 2);
  const col = it.gold ? (state === 2 ? '#7a7f95' : '#ffe066') : state === 1 ? '#3cf0c0' : state === 2 ? '#7a7f95' : '#ffd23f';
  g.strokeStyle = col; g.globalAlpha = state === 0 ? 0.55 + 0.25 * Math.sin(T * 5 + it.row) : 0.4; g.lineWidth = it.gold ? 6 : 3; g.setLineDash([8, 8]); g.beginPath(); g.moveTo(l, y); g.lineTo(r, y); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
  for (const px of [l, r]) { g.fillStyle = '#3a3f5a'; g.fillRect(px - 5, y - 0.55 * U, 10, 1.1 * U); g.fillStyle = col; g.shadowColor = col; g.shadowBlur = state === 0 ? 14 : 4; g.beginPath(); g.arc(px, y - 0.55 * U, 9, 0, 6.283); g.fill(); g.shadowBlur = 0; }
}
function drawRock(it, x, y, c1, c2) {
  const r = it.r * U; if (!it._p) it._p = Array.from({ length: 9 }, (_, i) => 0.82 + ((it.row * 7 + i * 13 + Math.abs(it.x) * 5) % 10) / 28);
  g.fillStyle = c1; g.strokeStyle = c2; g.lineWidth = 3; g.beginPath();
  it._p.forEach((k, i) => { const a = i / 9 * 6.283 + (it.k === 'm' ? T * 0.8 : 0); const px = x + Math.cos(a) * r * k, py = y + Math.sin(a) * r * k; i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.arc(x + r * 0.25, y + r * 0.1, r * 0.25, 0, 6.283); g.fill(); g.beginPath(); g.arc(x - r * 0.3, y - r * 0.25, r * 0.16, 0, 6.283); g.fill();
}
function drawDebris(it, x, y) {
  const s = it.r * U; g.save(); g.translate(x, y); g.rotate(Math.sin(T + it.row) * 0.25);
  g.fillStyle = '#c59a64'; g.strokeStyle = '#7a5a34'; g.lineWidth = 3; g.fillRect(-s, -s * 0.8, s * 2, s * 1.6); g.strokeRect(-s, -s * 0.8, s * 2, s * 1.6);
  g.beginPath(); g.moveTo(-s, -s * 0.8); g.lineTo(s, s * 0.8); g.moveTo(s, -s * 0.8); g.lineTo(-s, s * 0.8); g.stroke(); g.restore();
}
function drawCan(x, y) {
  const s = 0.55 * U; g.save(); g.translate(x, y + Math.sin(T * 3 + x) * 3); g.fillStyle = '#7be37b'; g.strokeStyle = '#2e8a3e'; g.lineWidth = 3; g.beginPath(); g.roundRect(-s * 0.8, -s, s * 1.6, s * 2, 6); g.fill(); g.stroke();
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(2, -s * 0.6); g.lineTo(-s * 0.4, s * 0.1); g.lineTo(0, s * 0.1); g.lineTo(-2, s * 0.7); g.lineTo(s * 0.4, -s * 0.1); g.lineTo(0, -s * 0.1); g.closePath(); g.fill();
  g.shadowColor = '#7be37b'; g.shadowBlur = 12; g.strokeStyle = 'rgba(123,227,123,.5)'; g.beginPath(); g.arc(0, 0, s * 1.5, 0, 6.283); g.stroke(); g.restore();
}
function drawSat(x, y) {
  const s = 0.5 * U; g.save(); g.translate(x, y + Math.sin(T * 2 + x) * 4); g.rotate(Math.sin(T) * 0.2);
  g.fillStyle = '#4a7bd8'; g.fillRect(-s * 2.1, -s * 0.4, s * 1.4, s * 0.8); g.fillRect(s * 0.7, -s * 0.4, s * 1.4, s * 0.8);
  g.fillStyle = '#e8ecf5'; g.fillRect(-s * 0.7, -s * 0.7, s * 1.4, s * 1.4); g.fillStyle = ((T * 3) | 0) % 2 ? '#ff5d5d' : '#5a1a1a'; g.beginPath(); g.arc(0, 0, s * 0.25, 0, 6.283); g.fill(); g.restore();
}
function drawWell(it, x, y, done) {
  const R = 3.6 * U, c = '#a06bff'; g.save(); g.translate(x, y);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, R); gr.addColorStop(0, 'rgba(10,0,30,.95)'); gr.addColorStop(0.2, 'rgba(120,60,220,.55)'); gr.addColorStop(1, 'rgba(120,60,220,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R, 0, 6.283); g.fill();
  g.strokeStyle = c; g.lineWidth = 3; for (let k = 0; k < 3; k++) { g.globalAlpha = 0.7; g.beginPath(); for (let a = 0; a < 9; a += 0.4) { const rr = (0.5 + a * 0.28 + k * 0.5) * U * 0.6; const aa = a + T * 2.5 + k * 2.1; a ? g.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr) : g.moveTo(Math.cos(aa) * rr, Math.sin(aa) * rr); } g.stroke(); }
  g.globalAlpha = 1; g.fillStyle = '#05000f'; g.beginPath(); g.arc(0, 0, it.r * U, 0, 6.283); g.fill(); g.restore();
}
function drawFlare(it, y) {
  const on = flareOn(it, cur.t), warn = flareWarn(it, cur.t); const x0 = it.side < 0 ? sx(-LANE) : sx(-1.0), x1 = it.side < 0 ? sx(1.0) : sx(LANE);
  if (on) { const gr = g.createLinearGradient(0, y - 0.6 * U, 0, y + 0.6 * U); gr.addColorStop(0, 'rgba(255,90,40,0)'); gr.addColorStop(0.5, 'rgba(255,220,120,1)'); gr.addColorStop(1, 'rgba(255,90,40,0)'); g.fillStyle = gr; g.fillRect(x0, y - 0.7 * U, x1 - x0, 1.4 * U); }
  else { g.strokeStyle = warn ? `rgba(255,120,60,${0.5 + 0.5 * Math.sin(T * 30)})` : 'rgba(255,160,100,.25)'; g.lineWidth = warn ? 4 : 2; g.setLineDash([12, 10]); g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); g.setLineDash([]); }
  const ex = it.side < 0 ? x0 : x1; g.fillStyle = on ? '#ffd23f' : '#c0643a'; g.beginPath(); g.arc(ex, y, 10, 0, 6.283); g.fill();
}
function drawRocket() {
  const r = cur, x = sx(r.x), y = sy(r.y), lean = clamp(r.vx * 0.035, -0.35, 0.35), p = PAINTS[D.paint] || PAINTS[0];
  if (r.status === 'lose' && mode === 'end') return;
  if (r.inv > 0 && ((T * 16) | 0) % 2 && mode === 'fly') return;
  const b = r.boostT > 0, u = U; g.save(); g.translate(x, y); g.rotate(lean);
  const fl = (b ? 2.6 : 1.2) * u * (0.8 + 0.3 * Math.sin(T * 50)); // flame
  const fg = g.createLinearGradient(0, u * 0.8, 0, u * 0.8 + fl); fg.addColorStop(0, '#fff6c0'); fg.addColorStop(0.35, b ? '#3cf0ff' : '#ffd23f'); fg.addColorStop(1, 'rgba(255,90,40,0)');
  g.fillStyle = fg; g.beginPath(); g.moveTo(-0.28 * u, u * 0.8); g.quadraticCurveTo(0, u * 0.8 + fl * 1.2, 0.28 * u, u * 0.8); g.fill();
  if (b) { g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(k * 0.4 * u, -u * 1.2); g.lineTo(k * 0.4 * u, -u * 2.6 - Math.random() * u); g.stroke(); } g.shadowColor = '#3cf0ff'; g.shadowBlur = 24; }
  g.fillStyle = p[2]; g.beginPath(); g.moveTo(-0.38 * u, 0.3 * u); g.lineTo(-0.8 * u, 0.9 * u); g.lineTo(-0.3 * u, 0.7 * u); g.fill(); g.beginPath(); g.moveTo(0.38 * u, 0.3 * u); g.lineTo(0.8 * u, 0.9 * u); g.lineTo(0.3 * u, 0.7 * u); g.fill();
  g.fillStyle = p[1]; g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -1.15 * u); g.quadraticCurveTo(0.55 * u, -0.5 * u, 0.42 * u, 0.85 * u); g.lineTo(-0.42 * u, 0.85 * u); g.quadraticCurveTo(-0.55 * u, -0.5 * u, 0, -1.15 * u); g.fill(); g.stroke(); g.shadowBlur = 0;
  g.fillStyle = p[2]; g.beginPath(); g.moveTo(0, -1.15 * u); g.quadraticCurveTo(0.3 * u, -0.8 * u, 0.33 * u, -0.5 * u); g.lineTo(-0.33 * u, -0.5 * u); g.quadraticCurveTo(-0.3 * u, -0.8 * u, 0, -1.15 * u); g.fill();
  g.fillStyle = '#1c2a4f'; g.beginPath(); g.arc(0, -0.05 * u, 0.2 * u, 0, 6.283); g.fill(); g.fillStyle = '#7ad8ff'; g.beginPath(); g.arc(-0.04 * u, -0.1 * u, 0.1 * u, 0, 6.283); g.fill();
  g.restore();
}
function heart(x, y, s, on) { g.fillStyle = on ? '#ff4d6d' : 'rgba(255,255,255,.2)'; g.beginPath(); g.moveTo(x, y + s * 0.35); g.bezierCurveTo(x - s, y - s * 0.4, x - s * 0.3, y - s * 0.95, x, y - s * 0.3); g.bezierCurveTo(x + s * 0.3, y - s * 0.95, x + s, y - s * 0.4, x, y + s * 0.35); g.fill(); }
function drawHud() {
  const r = cur, top = 18; g.textAlign = 'left';
  for (let i = 0; i < r.hullMax; i++) heart(26 + i * 28, top + 16, 11 + (hullFlash > 0 && i === r.hull ? 4 : 0), i < r.hull);
  // progress bar
  const bw = Math.min(W - 200, 300), bx = (W - bw) / 2, by = top + 8; g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.roundRect(bx, by, bw, 10, 5); g.fill();
  g.fillStyle = '#ffd23f'; g.beginPath(); g.roundRect(bx, by, Math.max(10, bw * clamp(r.y / r.p.len, 0, 1)), 10, 5); g.fill();
  for (const it of r.p.items) if (it.k === 'g') { g.fillStyle = r.done.has(it) ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.4)'; g.fillRect(bx + bw * it.y / r.p.len - 1, by - 2, 2, 14); }
  g.font = '700 15px Fredoka, system-ui'; g.fillStyle = '#fff'; g.textAlign = 'right'; g.fillText(`🎯 ${r.passed}/${r.p.gates}`, W - 56, top + 20);
  g.textAlign = 'center'; g.font = '600 13px Fredoka, system-ui'; g.fillStyle = 'rgba(255,255,255,.75)'; g.fillText(curM.name, W / 2, top + 40);
  if (r.combo >= 2) { g.font = `700 ${22 + Math.min(r.combo, 12)}px Fredoka, system-ui`; g.fillStyle = '#ffd23f'; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.4)'; g.strokeText('x' + r.combo, W / 2, top + 76); g.fillText('x' + r.combo, W / 2, top + 76); }
  if (mode === 'count') { const n = Math.max(1, Math.ceil(countT / 0.3)); g.font = '700 110px Fredoka, system-ui'; g.fillStyle = '#fff'; g.lineWidth = 8; g.strokeStyle = '#ff6a2b'; g.strokeText(n === 1 && countT < 0.3 ? 'GO!' : String(n), W / 2, H * 0.4); g.fillText(n === 1 && countT < 0.3 ? 'GO!' : String(n), W / 2, H * 0.4); }
  g.font = '600 17px Fredoka, system-ui'; g.fillStyle = '#fff'; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.45)'; const hintT = curIdx === 0 && !daily && r.t < 5 ? '👆 drag to steer' : curIdx === 3 && !daily && !D.hints.boost && r.t < 7 ? 'tap ⚡ to smash the crates' : '';
  if (hintT && mode !== 'end') { g.strokeText(hintT, W / 2, H * 0.9); g.fillText(hintT, W / 2, H * 0.9); }
}

// ---------------------------------------------------------------- QA hook + boot
window.__mx = { get run() { return cur; }, get mode() { return mode; }, start: (i, d) => { openMx(false); startMission(i, !!d); }, openMap: () => openMx(true), save: () => D, reset: () => { D = load(); }, setStars: a => { D.st = a; save(); } };
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'fly') { /* keep running; a paused tab does not advance */ } });
const first = totalStars() === 0 && D.tries === 0;
setTimeout(() => { if (first) { openMx(false); startMission(0); } else openMx(true); }, 600);
