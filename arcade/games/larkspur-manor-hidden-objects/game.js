// Larkspur Manor: Hidden Objects (style C · Storybook Garden). Untimed hidden-object scenes in painted manor rooms.
import { money } from './kit/money.js';
import { board } from './kit/board.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { OBJ, ROOMS, ROOM_IDS } from './data.js';
import { CHAPTERS, STORY_SCENES, DECOR, BLOOMS, VISITS, DAILY_LINES, STAMPS } from './story.js';

const SLUG = 'larkspur-manor', NAME = 'Larkspur Manor: Hidden Objects';
const Q = new URLSearchParams(location.search);
const $ = s => document.querySelector(s);
const M = money({ game: SLUG, style: 'C' });
const B = board({ game: 'larkspur-manor', label: 'Stars from scenes', mode: 'sum', limits: { maxRun: 3, maxPerSec: 0.6 }, corner: 'tl' });
const F = flow('larkspur');
const D = daily('larkspur', null, { name: NAME });

// ---------------------------------------------------------------- save
const KEY = 'larkspur_save';
const DEF = { lvl: 1, stars: 0, spent: 0, decor: [], blooms: [], wins: 0, extra: 0, curios: {}, hints: 3, big: false, timer: false, sound: true, music: true,
  sceneStars: {}, dly: { last: 0, n: 0, fz: '', done: 0, stars: 0 } };
let S = (() => { try { return { ...DEF, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) { return { ...DEF }; } })();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
const starsAvail = () => S.stars - S.spent;
const stampCount = () => Math.min(STAMPS.length, Math.min(S.lvl - 1, STORY_SCENES) + Math.floor(S.extra / 2));

// ---------------------------------------------------------------- utils
const rng = seed => { let a = seed >>> 0 || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
const shuffle = (a, r) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const ymd = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const dayNo = (d = new Date()) => Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
const weekKey = (d = new Date()) => { const t = dayNo(d); return 'w' + Math.floor((t + 3) / 7); };   // Monday-based weeks
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const IMG = {};
const img = src => IMG[src] || (IMG[src] = new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }));
const objSrc = id => `assets/obj/ho-${id}.webp`;
const roomSrc = (id, o) => `assets/rooms/room-${id}${o === 'W' ? '-wide' : ''}.webp`;
let toastT;
function toast(t, ms = 2600) { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), ms); }

// ---------------------------------------------------------------- audio: soft harp plucks + a slow music box loop
let AC, master, musicBus, rev;
function ac() {
  try {
    if (!AC) {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain(); master.gain.value = 0.9; master.connect(AC.destination);
      musicBus = AC.createGain(); musicBus.gain.value = S.music ? 1 : 0; musicBus.connect(master);
      rev = AC.createConvolver(); const len = AC.sampleRate * 2.6, buf = AC.createBuffer(2, len, AC.sampleRate);
      for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
      rev.buffer = buf; const rg = AC.createGain(); rg.gain.value = 0.32; rev.connect(rg); rg.connect(master);
    }
    if (AC.state === 'suspended' && !adOn) AC.resume();
  } catch (e) { return null; }
  return AC;
}
function pluck(midi, at = 0, vol = 0.1, dur = 1.8, bus = null) {
  const a = ac(); if (!a) return;
  if (!bus && !S.sound) return;
  const t = a.currentTime + at, f = 440 * Math.pow(2, (midi - 69) / 12);
  const g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(Math.min(12000, f * 7), t); lp.frequency.exponentialRampToValueAtTime(Math.max(300, f * 1.4), t + dur * 0.7);
  for (const [m, type, v] of [[1, 'triangle', 1], [2, 'sine', 0.22], [3.01, 'sine', 0.07]]) {
    const o = a.createOscillator(), og = a.createGain(); o.type = type; o.frequency.value = f * m; og.gain.value = v; o.connect(og); og.connect(g); o.start(t); o.stop(t + dur + 0.05);
  }
  g.connect(lp); lp.connect(bus || master); lp.connect(rev);
}
const sfx = {
  tap: () => pluck(84, 0, 0.035, 0.5),
  find: i => { const sc = [72, 74, 77, 79, 81, 84, 86, 89, 91, 93, 96]; pluck(sc[i % sc.length], 0, 0.11, 1.6); pluck(sc[i % sc.length] + 7, 0.09, 0.06, 1.4); },
  miss: () => pluck(50, 0, 0.05, 0.6),
  win: () => [65, 69, 72, 77, 81, 84].forEach((m, i) => pluck(m, i * 0.13, 0.1, 2.2)),
  page: () => { pluck(79, 0, 0.05, 0.9); pluck(84, 0.08, 0.04, 0.9); },
  coin: () => { pluck(88, 0, 0.05, 0.5); pluck(93, 0.07, 0.05, 0.7); },
};
// music: I-vi-IV-V in F, slow arpeggios like a music box, very quiet
const CHORDS = [[53, 60, 65, 69, 72], [50, 57, 62, 65, 69], [46, 53, 58, 62, 65], [48, 55, 60, 64, 67]];
let musicStep = 0, musicNext = 0, musicTimer = null, adOn = false;
function musicTick() {
  if (!AC || !S.music || adOn || document.hidden) return;
  const beat = 0.62;
  if (musicNext < AC.currentTime) musicNext = AC.currentTime + 0.1;
  while (musicNext < AC.currentTime + 1.2) {
    const ch = CHORDS[Math.floor(musicStep / 8) % 4], i = musicStep % 8, at = musicNext - AC.currentTime;
    if (i === 0) pluck(ch[0] - 12, at, 0.05, 3.2, musicBus);
    const pat = [1, 2, 3, 4, 3, 2, 3, 1];
    pluck(ch[pat[i]] + 12, at, i === 0 ? 0.03 : 0.022, 2.4, musicBus);
    if (i === 4 && Math.random() < 0.5) pluck(ch[4] + 12 + (Math.random() < 0.5 ? 2 : 0), at + beat / 2, 0.018, 2, musicBus);
    musicStep++; musicNext += beat;
  }
}
function startMusic() { ac(); if (!musicTimer) musicTimer = setInterval(musicTick, 300); }
addEventListener('ap:ad', e => { adOn = e.detail && e.detail.phase === 'start'; if (adOn && AC) AC.suspend().catch(() => {}); else if (AC) AC.resume().catch(() => {}); });
document.addEventListener('visibilitychange', () => { if (!AC) return; if (document.hidden) AC.suspend().catch(() => {}); else if (!adOn) AC.resume().catch(() => {}); });
addEventListener('pointerdown', () => startMusic(), { once: true });

// ---------------------------------------------------------------- state
let state = 'ready', mode = 'story';     // mode: story | replay | daily
let L = null;            // current level
const view = { o: 'P', w: 0, h: 0, dpr: 1 };
const cam = { s: 1, x: 0, y: 0 }, camT = { s: 1, x: 0, y: 0 };
let comp = null, compDirty = true, roomImg = null, fx = [], lens = null, dirty = true, playStart = 0, timeLeft = 0, botWait = 0;

function levelInfo(n, kind) {
  const R = rng(kind === 'daily' ? ymd() * 31 : kind === 'replay' ? (Date.now() % 1e9) : n * 7919 + 13);
  let room, clue = null, intro, title, sub, ch = null;
  if (kind === 'daily') {
    const seed = D.seed || ymd();
    room = ROOM_IDS[seed % ROOM_IDS.length]; title = 'Daily scene';
    intro = DAILY_LINES[seed % DAILY_LINES.length].replace('{room}', ROOMS[room].name.toLowerCase());
    sub = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  } else if (kind === 'replay') {
    const open = ROOM_IDS.filter((r, i) => CHAPTERS.findIndex(c => c.room === r) * 3 < Math.max(1, S.lvl - 1) || i === 0);
    room = open[Math.floor(R() * open.length)] || 'library'; title = 'A quiet visit';
    intro = VISITS[Math.floor(R() * VISITS.length)].replace('{room}', ROOMS[room].name.toLowerCase()); sub = 'Revisit · stars for the garden';
  } else if (n <= STORY_SCENES) {
    const ci = Math.floor((n - 1) / 3), si = (n - 1) % 3; ch = CHAPTERS[ci];
    room = ch.room; clue = ch.scenes[si].clue; intro = ch.scenes[si].intro; title = ch.title; sub = `Chapter ${ci + 1} · Scene ${si + 1} of 3`;
  } else {
    room = ROOM_IDS[(n * 5) % ROOM_IDS.length]; title = 'Seasons at Larkspur';
    intro = VISITS[n % VISITS.length].replace('{room}', ROOMS[room].name.toLowerCase()); sub = `Visit ${n - STORY_SCENES}`;
  }
  const hard = kind === 'story' && n > 5 && n % 6 === 0;
  const lmode = kind === 'daily' ? 'words' : n <= 5 && kind === 'story' ? 'pictures' : hard ? 'shadows' : 'words';
  let count = n <= 2 ? 5 : n <= 5 ? 6 : 7 + Math.min(3, Math.floor((n - 6) / 5));
  if (kind === 'daily') count = 8; else if (kind === 'replay') count = 7;
  else if (n > 5 && !hard) count = clamp(Math.round(count * F.k()), 6, 11);
  return { n, kind, room, clue, intro, title, sub, hard, mode: lmode, count, seed: Math.floor(R() * 1e9), ch };
}

// placement: every object rests on a painted surface, sized by perspective, never overlapping much
function placeAll(Lv) {
  const room = ROOMS[Lv.room], R = rng(Lv.seed);
  const last = (S.lastIds || {})[Lv.room] || [];
  const sh = shuffle(room.pool.filter(id => id !== Lv.clue), R);
  const pool = [...sh.filter(id => !last.includes(id)), ...sh.filter(id => last.includes(id))];   // fresh curios first
  if (Lv.clue) pool.unshift(Lv.clue);
  const placed = { P: [], W: [] }, ids = [];
  for (const id of pool) {
    if (ids.length >= Lv.count) break;
    const p = tryPlace(id, room.P, placed.P, R, Lv), w = p && tryPlace(id, room.W, placed.W, R, Lv);
    if (p && w) { placed.P.push(p); placed.W.push(w); ids.push(id); }
  }
  return { ids, P: placed.P, W: placed.W };
}
function tryPlace(id, surfs, others, R, Lv) {
  const [, cm, sw, sh] = OBJ[id];
  const fit = surfs.filter(s => s[5] >= cm);
  if (!fit.length) return null;
  for (let tries = 0; tries < 40; tries++) {
    const s = fit[Math.floor(R() * fit.length)], t = R();
    let x = lerp(s[0], s[2], t), y = lerp(s[1], s[3], t);
    const k = s[4], minPx = Lv.hard ? 44 : 54, comfort = Lv.hard ? 1.05 : 1.25;
    const size = Math.min(260, Math.max(minPx, cm / 10 * k) * comfort);
    const sc = size / Math.max(sw, sh), w = sw * sc, h = sh * sc;
    const rim = s[6] || null;
    if (rim && y - rim > h * 0.45) y = rim + h * 0.42;
    const box = { x0: x - w / 2, y0: y - h, x1: x + w / 2, y1: rim ? Math.min(y, rim) : y };
    let bad = false;
    for (const o of others) {
      const ix = Math.max(0, Math.min(box.x1, o.box.x1) - Math.max(box.x0, o.box.x0)), iy = Math.max(0, Math.min(box.y1, o.box.y1) - Math.max(box.y0, o.box.y0));
      const a1 = (box.x1 - box.x0) * (box.y1 - box.y0), a2 = (o.box.x1 - o.box.x0) * (o.box.y1 - o.box.y0);
      if (ix * iy > 0.08 * Math.min(a1, a2) || Math.hypot(x - o.x, y - o.y) < Math.min(w, o.w) * 0.55) { bad = true; break; }
    }
    if (bad) continue;
    const tall = h > w * 1.3;
    return { id, x, y, w, h, rim, box, flip: R() < 0.5, rot: (R() - 0.5) * (tall ? 0.08 : 0.22), found: false };
  }
  return null;
}

// tint a cut-out to the room's light so it sits in the painting (less saturated, warm cast, softer contrast)
const tintCache = new Map();
function tinted(im, id, light) {
  const k = id + light.join(); if (tintCache.has(k)) return tintCache.get(k);
  const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0);
  try {
    const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      if (!p[i + 3]) continue;
      const l = p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11;
      for (let ch = 0; ch < 3; ch++) { const v = l + (p[i + ch] - l) * 0.84; p[i + ch] = Math.min(255, v * light[ch] * 0.95 + 9); }
    }
    x.putImageData(d, 0, 0);
  } catch (e) {}
  tintCache.set(k, c); return c;
}

// ---------------------------------------------------------------- rendering
const cv = $('#cv'), ctx = cv.getContext('2d');
const objImgs = {};
function objs() { return L ? L[view.o] : []; }
function buildComp() {
  if (!roomImg) return;
  if (!comp) comp = document.createElement('canvas');
  if (comp.width !== roomImg.naturalWidth) { comp.width = roomImg.naturalWidth; comp.height = roomImg.naturalHeight; }
  const x = comp.getContext('2d');
  x.drawImage(roomImg, 0, 0);
  const light = ROOMS[L.room].light;
  for (const o of [...objs()].sort((a, b) => a.y - b.y)) {
    if (o.found || o.flying) continue;
    const im = objImgs[o.id]; if (!im) continue;
    const t = tinted(im, o.id, light);
    x.save(); x.translate(o.x, o.y);
    // contact shadow
    const g = x.createRadialGradient(0, 0, 0, 0, 0, o.w * 0.48);
    g.addColorStop(0, 'rgba(35,22,10,.42)'); g.addColorStop(1, 'rgba(35,22,10,0)');
    x.save(); x.scale(1, 0.2); x.fillStyle = g; x.beginPath(); x.arc(0, -4, o.w * 0.48, 0, 7); x.fill(); x.restore();
    x.rotate(o.rot); if (o.flip) x.scale(-1, 1);
    x.shadowColor = 'rgba(40,25,10,.38)'; x.shadowBlur = 5; x.shadowOffsetY = 2; x.shadowOffsetX = 1;
    x.drawImage(t, -o.w / 2, -o.h, o.w, o.h);
    x.restore();
    if (o.rim) {   // paint the room back over the part below the front edge
      x.save(); x.beginPath(); x.rect(o.x - o.w, o.rim, o.w * 2, o.h + 20); x.clip(); x.drawImage(roomImg, 0, 0); x.restore();
    }
  }
  compDirty = false;
}
function resize() {
  const land = innerWidth / innerHeight > 1.05 && innerWidth >= 700;
  document.body.classList.toggle('landscape', land);
  const r = $('#scene').getBoundingClientRect();
  view.w = r.width; view.h = r.height; view.dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.round(view.w * view.dpr); cv.height = Math.round(view.h * view.dpr);
  const o = view.w / view.h < 1.05 ? 'P' : 'W';
  if (L && o !== view.o) { view.o = o; loadRoom(); } else view.o = o;
  fitCam(true); dirty = true; drawHub();
}
function fitScale() { const rw = roomImg ? roomImg.naturalWidth : (view.o === 'P' ? 1024 : 1536), rh = roomImg ? roomImg.naturalHeight : (view.o === 'P' ? 1536 : 1024); return { s: Math.max(view.w / rw, view.h / rh), rw, rh }; }
function clampCam(c) {
  const { s: s0, rw, rh } = fitScale();
  c.s = clamp(c.s, s0, s0 * 3.5);
  c.x = clamp(c.x, view.w - rw * c.s, 0); c.y = clamp(c.y, view.h - rh * c.s, 0);
  return c;
}
function fitCam(snap) {
  const { s, rw, rh } = fitScale();
  camT.s = s; camT.x = (view.w - rw * s) / 2; camT.y = (view.h - rh * s) * 0.45;
  clampCam(camT); if (snap) Object.assign(cam, camT);
}
const toRoom = (sx, sy) => ({ x: (sx - cam.x) / cam.s, y: (sy - cam.y) / cam.s });
const toScreen = (rx, ry) => ({ x: rx * cam.s + cam.x, y: ry * cam.s + cam.y });

function frame(t) {
  requestAnimationFrame(frame);
  if (state === 'play' && S.timer && L && !L.done) {
    const left = Math.max(0, timeLeft - (performance.now() - playStart) / 1000);
    const txt = `⏱ ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
    if ($('#timer').textContent !== txt) $('#timer').textContent = txt;
    if (left <= 0) lose();
  }
  if (!roomImg || !L) return;
  const k = RM ? 1 : 0.2;
  for (const p of ['s', 'x', 'y']) { const d = camT[p] - cam[p]; if (Math.abs(d) > (p === 's' ? 1e-4 : 0.05)) { cam[p] += d * k; dirty = true; } else cam[p] = camT[p]; }
  if (compDirty) { buildComp(); dirty = true; }
  if (fx.length || lens) dirty = true;
  if (!dirty) return;
  dirty = false;
  const d = view.dpr;
  ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(comp, cam.x, cam.y, comp.width * cam.s, comp.height * cam.s);
  ctx.save(); ctx.translate(cam.x, cam.y); ctx.scale(cam.s, cam.s);
  const now = performance.now();
  fx = fx.filter(f => now - f.t0 < f.life);
  for (const f of fx) {
    const a = (now - f.t0) / f.life;
    if (f.kind === 'ring') {
      ctx.strokeStyle = `rgba(255,236,170,${(1 - a) * 0.9})`; ctx.lineWidth = (6 * (1 - a) + 1) / cam.s;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.6 + a * 0.9), 0, 7); ctx.stroke();
    } else if (f.kind === 'miss') {
      ctx.strokeStyle = `rgba(250,246,236,${(1 - a) * 0.8})`; ctx.lineWidth = 3 / cam.s;
      ctx.beginPath(); ctx.arc(f.x, f.y, (10 + a * 22) / cam.s, 0, 7); ctx.stroke();
    } else if (f.kind === 'spark') {
      const x = f.x + f.vx * a * 60, y = f.y + f.vy * a * 60 + a * a * 30, r = f.r * (1 - a) / cam.s;
      ctx.fillStyle = f.c; ctx.globalAlpha = 1 - a; star4(x, y, r); ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
  if (lens) drawLens(now);
}
function star4(x, y, r) { ctx.beginPath(); ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r); ctx.fill(); }
function drawLens(now) {
  const o = lens.o, a = (now - lens.t0) / 1000;
  if (o.found || a > 6) { lens = null; return; }
  if (a < 0) return;
  const c = toScreen(o.x, o.y - o.h / 2), size = Math.max(o.w, o.h) * cam.s;
  const R = clamp(size * 0.95 + 14, 44, 96) * (1 + Math.sin(a * 4) * 0.04) * clamp(a * 4, 0.05, 1);
  const mag = 1.5;
  ctx.save();
  ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, 7); ctx.clip();
  ctx.translate(c.x, c.y); ctx.scale(mag, mag); ctx.translate(-c.x, -c.y);
  ctx.drawImage(comp, cam.x, cam.y, comp.width * cam.s, comp.height * cam.s);
  ctx.restore();
  ctx.save();
  const g = ctx.createRadialGradient(c.x - R * 0.3, c.y - R * 0.3, R * 0.1, c.x, c.y, R);
  g.addColorStop(0, 'rgba(255,255,255,.28)'); g.addColorStop(0.6, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,240,200,.25)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, 7); ctx.fill();
  // handle
  const hx = c.x + R * 0.72, hy = c.y + R * 0.72;
  ctx.lineCap = 'round'; ctx.strokeStyle = '#5a3418'; ctx.lineWidth = 13; ctx.beginPath(); ctx.moveTo(hx + 6, hy + 6); ctx.lineTo(hx + R * 0.62, hy + R * 0.62); ctx.stroke();
  ctx.strokeStyle = '#8a5a2e'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(hx + 8, hy + 8); ctx.lineTo(hx + R * 0.6, hy + R * 0.6); ctx.stroke();
  // gold rim
  ctx.strokeStyle = '#8a6420'; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, 7); ctx.stroke();
  ctx.strokeStyle = '#e8c870'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(c.x, c.y, Math.max(1, R - 1), 0, 7); ctx.stroke();
  ctx.restore();
}
function sparkle(x, y, r, n = 14) {
  const cols = ['#fff6d0', '#ffe08a', '#f7c6cf', '#ffffff'];
  for (let i = 0; i < n; i++) { const a = Math.random() * 7, v = 0.4 + Math.random() * 0.9; fx.push({ kind: 'spark', x, y, vx: Math.cos(a) * v * r / 40, vy: Math.sin(a) * v * r / 40 - 0.3, r: 6 + Math.random() * 7, c: cols[i % 4], t0: performance.now(), life: 700 + Math.random() * 500 }); }
  fx.push({ kind: 'ring', x, y, r, t0: performance.now(), life: 650 });
}

// ---------------------------------------------------------------- input: tap to find, drag to pan, pinch / wheel to zoom
const ptrs = new Map(); let gest = null;
cv.addEventListener('pointerdown', e => {
  cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 1) gest = { kind: 'tap', x0: e.clientX, y0: e.clientY, cx: camT.x, cy: camT.y, t: performance.now() };
  else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; gest = { kind: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), s0: camT.s, cx: camT.x, cy: camT.y, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; }
});
cv.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId) || !gest) return; ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const r = cv.getBoundingClientRect();
  if (gest.kind === 'pinch' && ptrs.size >= 2) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const s = gest.s0 * d / gest.d0, px = gest.mx - r.left, py = gest.my - r.top;
    const rx = (px - gest.cx) / gest.s0, ry = (py - gest.cy) / gest.s0;
    camT.s = s; camT.x = px - rx * s + (mx - gest.mx); camT.y = py - ry * s + (my - gest.my); clampCam(camT); Object.assign(cam, camT); dirty = true;
  } else if (gest.kind === 'tap' || gest.kind === 'drag') {
    const dx = e.clientX - gest.x0, dy = e.clientY - gest.y0;
    if (gest.kind === 'tap' && Math.hypot(dx, dy) > 9) { gest.kind = 'drag'; cv.classList.add('drag'); }
    if (gest.kind === 'drag') { camT.x = gest.cx + dx; camT.y = gest.cy + dy; clampCam(camT); Object.assign(cam, camT); dirty = true; }
  }
});
const endPtr = e => {
  if (!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId);
  if (gest && gest.kind === 'tap' && ptrs.size === 0 && e.type === 'pointerup') { const r = cv.getBoundingClientRect(); tapAt(e.clientX - r.left, e.clientY - r.top); }
  if (ptrs.size === 0) { gest = null; cv.classList.remove('drag'); }
  else if (gest && gest.kind === 'pinch') gest = { kind: 'drag', x0: [...ptrs.values()][0].x, y0: [...ptrs.values()][0].y, cx: camT.x, cy: camT.y };
};
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0016)); }, { passive: false });
function zoomAt(px, py, f) {
  const rx = (px - camT.x) / camT.s, ry = (py - camT.y) / camT.s;
  camT.s *= f; clampCam(camT); camT.x = px - rx * camT.s; camT.y = py - ry * camT.s; clampCam(camT); dirty = true;
}
$('#zoomIn').onclick = () => { sfx.tap(); zoomAt(view.w / 2, view.h / 2, 1.5); };
$('#zoomOut').onclick = () => { sfx.tap(); zoomAt(view.w / 2, view.h / 2, 1 / 1.5); };

let missTimes = [], calmUntil = 0;
function tapAt(sx, sy) {
  if (state !== 'play' || !L || L.done) return;
  const p = toRoom(sx, sy), tol = 18 / cam.s;
  let best = null, bd = Infinity;
  for (const o of objs()) {
    if (o.found) continue;
    const b = o.box, dx = Math.max(b.x0 - p.x, 0, p.x - b.x1), dy = Math.max(b.y0 - p.y, 0, p.y - b.y1), d = Math.hypot(dx, dy);
    if (d <= tol && d < bd) { bd = d; best = o; }
  }
  if (best) return found(best);
  const now = performance.now();
  fx.push({ kind: 'miss', x: p.x, y: p.y, t0: now, life: 500 }); sfx.miss();
  if (now < calmUntil) return;
  missTimes = missTimes.filter(t => now - t < 3000); missTimes.push(now);
  if (missTimes.length >= 4) { calmUntil = now + 2500; missTimes = []; toast('No hurry at all. Take a slow look around.'); return; }
  L.misses++; L.marks.push(null);
}
function found(o) {
  const n = L.ids.length - L.left.length;
  for (const k of ['P', 'W']) { const q = L[k].find(x => x.id === o.id); if (q) q.found = true; }
  L.left = L.left.filter(id => id !== o.id);
  L.marks.push(L.usedHintOn === o.id ? 'h' : L.missSince ? 'm' : 'g'); L.missSince = 0;
  S.curios[o.id] = 1;
  compDirty = true; if (lens && lens.o.id === o.id) lens = null;
  sparkle(o.x, o.y - o.h / 2, Math.max(o.w, o.h) * 0.6);
  sfx.find(n); try { navigator.vibrate && navigator.vibrate(12); } catch (e) {}
  flyToList(o);
  updateList();
  if (o.id === L.clue) setTimeout(() => toast('A clue for Iris\'s story!'), 300);
  if (!L.left.length) { L.done = true; setTimeout(win, 1100); }
}
function flyToList(o) {
  const it = document.querySelector(`.it[data-id="${o.id}"]`); if (!it) return;
  const r = cv.getBoundingClientRect(), a = toScreen(o.x, o.y - o.h / 2), w = o.w * cam.s, h = o.h * cam.s;
  const im = document.createElement('img'); im.className = 'fly'; im.src = objSrc(o.id);
  im.style.left = (r.left + a.x - w / 2) + 'px'; im.style.top = (r.top + a.y - h / 2) + 'px'; im.style.width = w + 'px'; im.style.height = h + 'px';
  document.body.appendChild(im);
  const t = it.getBoundingClientRect(), tx = t.left + 24 - (r.left + a.x), ty = t.top + t.height / 2 - (r.top + a.y), sc = 40 / Math.max(w, h, 1);
  im.animate([{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(0,-24px) scale(1.5)`, offset: 0.3 }, { transform: `translate(${tx}px,${ty}px) scale(${sc})`, opacity: 0.6 }],
    { duration: RM ? 10 : 850, easing: 'cubic-bezier(.4,0,.3,1)' }).onfinish = () => { im.remove(); it.classList.add('flash'); setTimeout(() => it.classList.remove('flash'), 500); };
}

// ---------------------------------------------------------------- hint magnifier
function hintCost() { return 40; }
async function useHint() {
  if (state !== 'play' || !L || L.done) return;
  const target = objs().find(o => !o.found && o.id === L.left[0]) || objs().find(o => !o.found);
  if (!target) return;
  if (S.hints > 0) S.hints--;
  else if (M.coins() >= hintCost()) { M.spend(hintCost(), 'hint'); sfx.coin(); }
  else { const ok = await M.rewarded('hint', { what: 'The magnifier shows you one object' }); if (!ok) return; }
  save(); updateHintBadge(); showHint(target);
}
function showHint(o) {
  L.usedHintOn = o.id; L.hints++;
  const { s: s0 } = fitScale(); const s = Math.max(camT.s, s0 * 1.5);
  camT.s = s; camT.x = view.w / 2 - o.x * s; camT.y = view.h / 2 - (o.y - o.h / 2) * s; clampCam(camT);
  lens = { o, t0: performance.now() + 250 }; sfx.page();
}
$('#hintBtn').onclick = () => { sfx.tap(); useHint(); };
function updateHintBadge() {
  const b = $('#hintBadge');
  if (S.hints > 0) { b.textContent = S.hints; b.classList.remove('coin'); } else { b.textContent = M.coins() >= hintCost() ? hintCost() : '▶'; b.classList.add('coin'); }
}

// ---------------------------------------------------------------- level flow
async function loadRoom() {
  if (!L) return;
  $('#loading').classList.remove('off');
  const o = view.o, im = await img(roomSrc(L.room, o));
  if (view.o !== o) return;
  roomImg = im; comp = null; compDirty = true; fitCam(true); dirty = true;
  $('#loading').classList.add('off');
}
async function startLevel(kind = 'story') {
  mode = kind;
  const n = kind === 'story' ? S.lvl : S.lvl;
  const info = levelInfo(n, kind);
  const pl = placeAll(info);
  L = { ...info, ids: pl.ids, P: pl.P, W: pl.W, left: [...pl.ids], misses: 0, marks: [], hints: 0, usedHintOn: null, missSince: 0, done: false };
  L.count = L.ids.length;
  S.lastIds = { ...(S.lastIds || {}), [L.room]: L.ids }; save();
  $('#roomName').textContent = ROOMS[L.room].name; $('#roomSub').textContent = L.sub;
  $('#panel').className = 'paper mode-' + L.mode;
  buildList(); updateHintBadge();
  roomImg = null; resize();
  await Promise.all(L.ids.map(id => img(objSrc(id)).then(i => { objImgs[id] = i; })));
  await loadRoom();
  document.body.classList.add('playing'); hideHub();
  showIntro();
}
function buildList() {
  const el = $('#list'); el.innerHTML = '';
  const order = [...L.ids].sort((a, b) => (a === L.clue ? -1 : b === L.clue ? 1 : OBJ[a][0].localeCompare(OBJ[b][0])));
  for (const id of order) {
    const d = document.createElement('div'); d.className = 'it' + (id === L.clue ? ' clue' : ''); d.dataset.id = id;
    d.innerHTML = `<img src="${objSrc(id)}" alt=""><span>${L.mode === 'shadows' ? '' : OBJ[id][0]}</span>`;
    if (L.mode === 'shadows') d.setAttribute('aria-label', 'Find this shape');
    el.appendChild(d);
  }
  updateList();
}
function updateList() {
  for (const d of document.querySelectorAll('.it')) d.classList.toggle('found', !L.left.includes(d.dataset.id));
  const n = L.ids.length - L.left.length;
  $('#cnt').textContent = `${n} / ${L.ids.length} found`;
  $('#cntSub').textContent = L.mode === 'shadows' ? 'Match the shapes' : n === 0 ? 'Pinch to zoom' : !L.left.length ? 'All found!' : L.left.length === 1 ? 'Just one more' : 'Lovely, keep looking';
}
function showIntro() {
  state = 'ready';
  const clue = L.clue ? `<img class="clueimg" src="${objSrc(L.clue)}" alt=""><h3>Look for the ${OBJ[L.clue][0].toLowerCase()}: it is part of the story</h3>` : '';
  const how = L.mode === 'shadows' ? '<p><i>A trickier room: the list shows only shapes.</i></p>' : L.n <= 2 && L.kind === 'story' ? '<p><i>Tap each object on the list when you spot it. There is no timer.</i></p>' : '';
  card(`<div class="ribbon ${L.kind === 'daily' ? 'navy' : ''}">${L.title}</div><h3>${L.sub}</h3><p>${L.intro}</p>${clue}${how}
    <button class="btn" data-primary data-go>Begin</button><button class="btn ivory" data-home>Back to the manor</button>`, {
    go: () => { closeCard(); beginPlay(); }, home: () => { closeCard(); goHub(); } });
}
function beginPlay() {
  state = 'play'; playStart = performance.now(); timeLeft = 300 + 20 * L.ids.length;
  document.body.classList.toggle('timed', !!S.timer);
  M.level(L.n); B.start();
  dirty = true; sfx.page();
}
async function win() {
  if (state !== 'play') return;
  state = 'won';
  const ms = performance.now() - playStart;
  const stars = L.misses <= 3 ? 3 : L.misses <= 8 ? 2 : 1;
  F.level(true);
  const coins = 15 + stars * 5 + (L.kind === 'daily' ? 20 : 0);
  M.add(coins, 'win'); S.stars += stars; S.wins++;
  let stampNew = null; const before = stampCount();
  if (L.kind === 'story') { S.sceneStars[L.n] = Math.max(S.sceneStars[L.n] || 0, stars); S.lvl++; S.hints = Math.min(9, S.hints + 1); }
  else S.extra++;
  if (L.kind === 'daily') dailyWin(stars);
  const after = stampCount(); if (after > before) stampNew = STAMPS[after - 1];
  save();
  B.submit(stars, { ms });
  sfx.win(); petals();
  const st = [1, 2, 3].map(i => `<img src="assets/ui/${i <= stars ? 'star-full' : 'star-empty'}.webp" alt="">`).join('');
  const sc = L.ch && L.clue ? L.ch.scenes.find(s => s.clue === L.clue) : null;
  const story = sc ? `<img class="clueimg" src="${objSrc(L.clue)}" alt=""><p>${sc.found}</p>` : `<p>${L.misses <= 3 ? 'Beautifully done. Not a thing out of place.' : 'All found. The room looks lovely again.'}</p>`;
  const share = L.kind === 'daily' ? `<button class="btn sage" data-share><img src="assets/ui/i-share.webp" alt="">Share today's result</button>` : '';
  const dbl = !M.hasPass() ? `<button class="btn ivory" data-dbl><img src="assets/ui/i-play.webp" alt="">Double coins (short video)</button>` : '';
  let coinsShown = coins;
  card(`<div class="ribbon">${L.kind === 'daily' ? 'Daily scene complete' : sc ? 'Clue found' : 'Room tidied'}</div>
    <div class="stars">${st}</div>${story}
    <div class="reward"><span><img src="assets/ui/coin.webp" alt="" style="vertical-align:middle"> +<b data-cw>${coins}</b></span><span><img src="assets/ui/star-full.webp" alt="" style="vertical-align:middle"> +${stars}</span>
    ${stampNew ? `<img class="stamp" src="assets/stamps/stamp-${stampNew}.webp" alt="New stamp">` : ''}</div>
    ${stampNew ? '<h3>A new stamp for your album</h3>' : ''}<button class="btn" data-primary data-next>Continue</button>${share}${dbl}`, {
    next: () => next(),
    dbl: async (b) => { b.disabled = true; if (await M.rewarded('double', { what: `${coins * 2} coins instead of ${coins}` })) { M.add(coins, 'double'); coinsShown = coins * 2; const e = document.querySelector('[data-cw]'); if (e) e.textContent = coinsShown; sfx.coin(); b.remove(); } else b.disabled = false; },
    share: () => shareDaily(stars),
  }, true);
  document.querySelectorAll('.stars img').forEach((im, i) => setTimeout(() => { im.classList.add('on'); if (i < stars) pluck(77 + i * 4, 0, 0.08, 1.2); }, 450 + i * 260));
}
async function next() {
  closeCard();
  const wasStory = L.kind === 'story', n = S.lvl - 1;
  await M.breakAd('level-end', { level: L.n });
  if (wasStory && n % 3 === 0 && n <= STORY_SCENES) return chapterEnd(Math.floor((n - 1) / 3));
  if (wasStory && !gateBlocked()) return startLevel('story');
  goHub();
}
function chapterEnd(ci) {
  const ch = CHAPTERS[ci]; state = 'ready';
  card(`<div class="ribbon sage">Chapter ${ci + 1} complete</div><h2>${ch.title}</h2><img class="div" src="assets/ui/divider.webp" alt="">
    <p><i>${ch.end}</i></p><img src="assets/ui/wax-seal.webp" alt="" style="width:76px"><button class="btn" data-primary data-go>Back to the manor</button>`, { go: () => { closeCard(); goHub(); } });
}
function lose() {
  if (state !== 'play') return;
  state = 'lost'; L.done = true; F.level(false, (L.ids.length - L.left.length) / L.ids.length);
  card(`<div class="ribbon navy">Time for tea</div><p>The relaxed timer ran out. You found ${L.ids.length - L.left.length} of ${L.ids.length}.</p>
    <div data-slot style="min-height:70px"></div><button class="btn" data-primary data-retry>Try the room again</button>
    <button class="btn ivory" data-off>Turn the timer off</button>`, {
    retry: () => { closeCard(); startLevel(mode); },
    off: () => { S.timer = false; save(); document.body.classList.remove('timed'); closeCard(); L.done = false; state = 'play'; },
  });
  // one offer, never in the first 1.2 s
  setTimeout(() => {
    const slot = document.querySelector('[data-slot]'); if (!slot || state !== 'lost') return;
    slot.innerHTML = `<button class="btn rose"><img src="assets/ui/i-play.webp" alt="">2 more minutes (short video)</button>`;
    slot.firstChild.onclick = async () => { if (await M.rewarded('moves', { what: '2 more minutes to finish this room', title: 'More time' })) { closeCard(); L.done = false; state = 'play'; timeLeft += 120; } };
  }, 1300);
}
function petals() {
  if (RM) return;
  const cols = ['#f3c3cc', '#e9a3b2', '#fbe3e8', '#c9d9b8', '#f6e2a8'];
  for (let i = 0; i < 26; i++) {
    const p = document.createElement('div'); const s = 10 + Math.random() * 12;
    p.style.cssText = `position:fixed;z-index:26;left:${Math.random() * 100}vw;top:-20px;width:${s}px;height:${s * 0.7}px;border-radius:60% 0 60% 0;background:${cols[i % 5]};pointer-events:none;opacity:.9`;
    document.body.appendChild(p);
    p.animate([{ transform: `translate(0,0) rotate(0deg)` }, { transform: `translate(${(Math.random() - 0.5) * 160}px,${innerHeight + 40}px) rotate(${Math.random() * 720}deg)` }], { duration: 2600 + Math.random() * 1800, delay: Math.random() * 600, easing: 'ease-in' }).onfinish = () => p.remove();
  }
}

// ---------------------------------------------------------------- daily streak (+1 free freeze a week) and spoiler-free share
function dailyWin(stars) {
  const d = S.dly, t = dayNo();
  if (d.done === t) { d.stars = Math.max(d.stars, stars); return; }
  const gap = t - d.last;
  if (gap === 1) d.n++;
  else if (gap === 2 && d.fz !== weekKey()) { d.n++; d.fz = weekKey(); setTimeout(() => toast('Your weekly streak freeze kept your streak safe.'), 1500); }
  else d.n = 1;
  d.last = t; d.done = t; d.stars = stars;
}
async function shareDaily(stars) {
  const grid = L.marks.filter(Boolean).map(m => m === 'g' ? '🌸' : m === 'm' ? '🌿' : '🔍').join('');
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const text = `Larkspur Manor · Daily ${date}\n${'⭐'.repeat(stars)} ${L.ids.length}/${L.ids.length} found\n${grid}\n🔥 ${S.dly.n}-day streak`;
  const u = new URL(location.href); u.search = '?daily=1';
  try { if (navigator.share) { await navigator.share({ title: NAME, text, url: u.href }); return; } } catch (e) { return; }
  try { await navigator.clipboard.writeText(text + '\n' + u.href); toast('Copied. Paste it to a friend.'); } catch (e) { toast(text, 4000); }
}

// ---------------------------------------------------------------- cards and sheets
let cardH = null;
function card(html, handlers = {}, keepBackdrop = false) {
  const ov = $('#ov'), c = $('#ovc');
  c.innerHTML = `<img class="cr a" src="assets/ui/corner-roses.webp" alt=""><img class="cr b" src="assets/ui/corner-roses.webp" alt="">` + html;
  cardH = handlers;
  for (const [k, fn] of Object.entries(handlers)) { const b = c.querySelector(`[data-${k}]`); if (b) b.onclick = e => { e.stopPropagation(); sfx.tap(); fn(b); }; }
  ov.classList.add('on'); c.scrollTop = 0;
}
function closeCard() { $('#ov').classList.remove('on'); cardH = null; }
// tapping the backdrop of a result card continues (the checker taps the middle of the screen)
$('#ov').addEventListener('click', e => { if (!e.target.closest('button') && cardH && (state === 'won' || state === 'lost')) { const b = $('#ovc [data-primary]'); b && b.click(); } });

function sheet(html, onReady) {
  const c = $('#shc');
  c.innerHTML = `<img class="cr a" src="assets/ui/corner-roses.webp" alt=""><button class="ibtn" data-x style="position:absolute;right:10px;top:10px;z-index:2" aria-label="Close"><img src="assets/ui/i-close.webp" alt=""></button>` + html;
  c.querySelector('[data-x]').onclick = () => { sfx.tap(); closeSheet(); };
  $('#sh').classList.add('on'); c.scrollTop = 0; onReady && onReady(c);
}
function closeSheet() { $('#sh').classList.remove('on'); drawHub(); renderHub(); }
$('#sh').addEventListener('click', e => { if (e.target.id === 'sh') closeSheet(); });
addEventListener('keydown', e => { if (e.key === 'Escape' && $('#sh').classList.contains('on')) closeSheet(); });

function albumSheet() {
  const n = stampCount(), got = Object.keys(S.curios).length, all = Object.keys(OBJ);
  sheet(`<div class="ribbon navy">Iris's Album</div><h3>${n} of ${STAMPS.length} stamps · one for each story scene, then one every two visits</h3>
    <div class="grid">${STAMPS.map((s, i) => `<img class="${i < n ? '' : 'lock'}" src="assets/stamps/stamp-${s}.webp" alt="${i < n ? s : 'Locked stamp'}">`).join('')}</div>
    <img class="div" src="assets/ui/divider.webp" alt=""><h2>Curio cabinet</h2><h3>${got} of ${all.length} curios found</h3>
    <div class="grid curios">${all.map(id => `<img class="${S.curios[id] ? 'got' : ''}" src="${objSrc(id)}" alt="${S.curios[id] ? OBJ[id][0] : 'Not found yet'}" title="${S.curios[id] ? OBJ[id][0] : '?'}">`).join('')}</div>`);
}
function gardenSheet() {
  const a = starsAvail();
  const need = gateDecor();
  const rows = DECOR.map(d => {
    const own = S.decor.includes(d.id), req = need && need.id === d.id;
    return `<div class="shop-row ${own ? 'done' : ''}"><img src="assets/decor/${d.id}.webp" alt=""><div><b>${d.name}</b><small>${own ? 'Restored' : req ? 'Opens the next chapter' : `${d.cost} stars`}</small></div>
      <button class="btn ${req ? 'rose' : ''}" data-d="${d.id}" ${own || a < d.cost ? 'disabled' : ''}>${own ? '✓' : `★ ${d.cost}`}</button></div>`;
  }).join('');
  const brows = BLOOMS.map(b => {
    const own = S.blooms.includes(b.id);
    return `<div class="shop-row ${own ? 'done' : ''}"><img src="assets/plants/${b.id}-bloom.webp" alt=""><div><b>${b.name}</b><small>${own ? 'In bloom' : 'Plant along the lawn'}</small></div>
      <button class="btn ivory" data-b="${b.id}" ${own ? 'disabled' : ''}>${own ? '✓' : `<img src="assets/ui/coin.webp" alt="" style="width:26px;height:26px">${b.cost}`}</button></div>`;
  }).join('');
  sheet(`<div class="ribbon sage">Restore the Garden</div><h3>You have ★ ${a} to spend. Every scene earns up to three.</h3>${rows}
    <img class="div" src="assets/ui/divider.webp" alt=""><h2>Flower borders</h2><h3>Planted with coins</h3>${brows}`, c => {
    c.querySelectorAll('[data-d]').forEach(b => b.onclick = () => restore(b.dataset.d));
    c.querySelectorAll('[data-b]').forEach(b => b.onclick = () => plant(b.dataset.b));
  });
}
function restore(id) {
  const d = DECOR.find(x => x.id === id); if (!d || S.decor.includes(id) || starsAvail() < d.cost) return;
  S.spent += d.cost; S.decor.push(id); save(); sfx.win();
  hubAnim = { id: 'd:' + id, t0: performance.now() };
  closeSheet(); toast(`The ${d.name.toLowerCase()} is restored.`);
}
function plant(id) {
  const b = BLOOMS.find(x => x.id === id); if (!b || S.blooms.includes(id)) return;
  if (!M.spend(b.cost, 'decor')) { closeSheet(); M.shop(); return; }
  S.blooms.push(id); save(); sfx.coin(); hubAnim = { id: 'b:' + id, t0: performance.now() }; closeSheet(); toast(`${b.name} planted.`);
}
function settingsSheet() {
  const row = (k, t, s) => `<div class="tog"><div>${t}<small>${s}</small></div><button class="sw ${S[k] ? 'on' : ''}" data-k="${k}" role="switch" aria-checked="${!!S[k]}" aria-label="${t}"></button></div>`;
  sheet(`<div class="ribbon navy">Settings</div>
    ${row('big', 'Larger text', 'Bigger words on every list and card')}
    ${row('timer', 'Relaxed timer', 'Off by default. A gentle clock for each room')}
    ${row('sound', 'Sound effects', 'Soft harp notes when you find things')}
    ${row('music', 'Music', 'A quiet music box tune')}
    <button class="btn ivory" data-shop><img src="assets/ui/i-shop.webp" alt="">The Shop</button>
    <button class="btn ivory" data-board><img src="assets/ui/i-trophy.webp" alt="">World board</button>`, c => {
    c.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
      const k = b.dataset.k; S[k] = !S[k]; save(); b.classList.toggle('on', S[k]); b.setAttribute('aria-checked', S[k]); applySettings(); sfx.tap();
    });
    c.querySelector('[data-shop]').onclick = () => { closeSheet(); M.shop(); };
    c.querySelector('[data-board]').onclick = () => { closeSheet(); B.open(); };
  });
}
function applySettings() {
  document.body.classList.toggle('big', !!S.big);
  if (musicBus) musicBus.gain.value = S.music ? 1 : 0;
  if (state === 'play') document.body.classList.toggle('timed', !!S.timer);
  setTimeout(resize, 30);
}

// ---------------------------------------------------------------- hub: the manor lawn, restored piece by piece
const hubc = $('#hubc'), hx = hubc.getContext('2d');
let hubImg = null, hubAnim = null;
const decorImgs = {};
function gateDecor() {   // the restoration that opens the next chapter, if the story is waiting on one
  const done = S.lvl - 1;
  if (done < 3 || done % 3 !== 0 || done > STORY_SCENES) return null;
  const d = CHAPTERS[done / 3 - 1].decor;
  return S.decor.includes(d) ? null : DECOR.find(x => x.id === d);
}
const gateBlocked = () => !!gateDecor();
async function drawHub() {
  if ($('#hub').classList.contains('off')) return;
  const W = innerWidth, H = innerHeight, d = Math.min(2, devicePixelRatio || 1), o = W / H < 1.05 ? 'P' : 'W';
  const src = o === 'P' ? 'assets/larkspur-manor.webp' : 'assets/larkspur-manor-wide.webp';
  hubImg = await img(src); if (!hubImg) return;
  hubc.width = W * d; hubc.height = H * d;
  const iw = hubImg.naturalWidth, ih = hubImg.naturalHeight, s = Math.max(W / iw, H / ih), ox = (W - iw * s) / 2, oy = (H - ih * s) * (o === 'P' ? 0.75 : 0.6);
  hx.setTransform(d, 0, 0, d, 0, 0); hx.drawImage(hubImg, ox, oy, iw * s, ih * s);
  const items = [...BLOOMS.filter(b => S.blooms.includes(b.id)).map(b => ({ k: 'b:' + b.id, src: `assets/plants/${b.id}-bloom.webp`, p: b[o] })),
    ...DECOR.filter(x => S.decor.includes(x.id)).map(x => ({ k: 'd:' + x.id, src: `assets/decor/${x.id}.webp`, p: x[o] }))].sort((a, b) => a.p[1] - b.p[1]);
  for (const it of items) {
    const im = decorImgs[it.src] || (decorImgs[it.src] = await img(it.src)); if (!im) continue;
    const h = it.p[2] * s, w = h * im.naturalWidth / im.naturalHeight, x = ox + it.p[0] * s, y = oy + it.p[1] * s;
    let a = 1, sc = 1;
    if (hubAnim && hubAnim.id === it.k) { const t = clamp((performance.now() - hubAnim.t0) / 900, 0, 1); a = t; sc = 0.6 + 0.4 * (1 - Math.pow(1 - t, 3)) + Math.sin(t * Math.PI) * 0.08; if (t < 1) requestAnimationFrame(drawHub); else hubAnim = null; }
    hx.save(); hx.globalAlpha = a;
    const g = hx.createRadialGradient(x, y, 0, x, y, w * 0.5); g.addColorStop(0, 'rgba(40,50,20,.35)'); g.addColorStop(1, 'rgba(40,50,20,0)');
    hx.save(); hx.translate(x, y); hx.scale(1, 0.22); hx.fillStyle = g; hx.beginPath(); hx.arc(0, 0, w * 0.5, 0, 7); hx.fill(); hx.restore();
    hx.drawImage(im, x - w / 2 * sc, y - h * sc, w * sc, h * sc); hx.restore();
  }
}
function renderHub() {
  $('#hub [data-stars]').textContent = starsAvail();
  const el = $('#chap'), done = S.lvl - 1, need = gateDecor();
  const ci = Math.min(CHAPTERS.length - 1, Math.floor(done / 3)), ch = CHAPTERS[ci];
  let body;
  if (need) {
    const prev = CHAPTERS[done / 3 - 1], a = starsAvail();
    body = `<div class="ribbon sage">Chapter ${done / 3} complete</div><p><i>${prev.end}</i></p>
      <button class="btn rose" data-primary data-restore ${a < need.cost ? 'disabled' : ''}><img src="assets/ui/star-full.webp" alt="">Restore it · ${need.cost} stars</button>
      ${a < need.cost ? `<h3 style="margin-top:8px">You need ${need.cost - a} more star${need.cost - a > 1 ? 's' : ''}. A quiet visit to any room earns up to three.</h3><button class="btn" data-primary data-replay>Revisit a room</button>` : ''}`;
  } else if (done < STORY_SCENES) {
    const si = done % 3;
    const dots = [0, 1, 2].map(i => { const st = S.sceneStars[ci * 3 + i + 1] || 0; return `<span class="${i === si ? 'cur' : ''}">${[1, 2, 3].map(k => `<img src="assets/ui/${k <= st ? 'star-full' : 'star-empty'}.webp" alt="">`).join('')}</span>`; }).join('');
    body = `<div class="ribbon">Chapter ${ci + 1}</div><h2>${ch.title}</h2><h3>The ${ROOMS[ch.room].name}</h3><div class="dots">${dots}</div>
      <button class="btn" data-primary data-play><img src="assets/ui/i-play.webp" alt="">${done === 0 ? 'Begin the story' : 'Continue the story'}</button>`;
  } else {
    body = `<div class="ribbon">Seasons at Larkspur</div><h3>The story is told. The manor still has plenty to find.</h3>
      <button class="btn" data-primary data-play><img src="assets/ui/i-play.webp" alt="">Visit ${done - STORY_SCENES + 1}</button>`;
  }
  el.innerHTML = `<img class="cr a" src="assets/ui/corner-roses.webp" alt="">` + body;
  const on = (k, fn) => { const b = el.querySelector(`[data-${k}]`); if (b) b.onclick = () => { sfx.tap(); fn(); }; };
  on('play', () => startLevel('story')); on('replay', () => startLevel('replay'));
  on('restore', () => restore(need.id));
  const dd = S.dly.done === dayNo();
  $('#navDaily').innerHTML = `<img src="assets/ui/i-${dd ? 'check' : 'calendar'}.webp" alt="">${S.dly.n > 1 && S.dly.last >= dayNo() - 1 ? `Day ${S.dly.n}` : 'Daily'}${dd ? '' : '<span class="dot" style="top:4px"></span>'}`;
}
function goHub() {
  state = 'ready'; L = null; lens = null; fx = [];
  document.body.classList.remove('playing', 'timed');
  $('#hub').classList.remove('off'); renderHub(); drawHub();
}
function hideHub() { $('#hub').classList.add('off'); }
$('#navAlbum').onclick = () => { sfx.tap(); albumSheet(); };
$('#navGarden').onclick = () => { sfx.tap(); gardenSheet(); };
$('#navSet').onclick = () => { sfx.tap(); settingsSheet(); };
$('#navDaily').onclick = () => {
  sfx.tap();
  if (S.dly.done === dayNo()) return toast(`Today's scene is done (${'★'.repeat(S.dly.stars)}). A new one opens tomorrow.`);
  startLevel('daily');
};
$('#homeBtn').onclick = () => {
  sfx.tap();
  if (state !== 'play') return goHub();
  card(`<div class="ribbon navy">Leave this room?</div><p>Your finds here will not be kept, but there is no penalty.</p><div class="row2"><button class="btn ivory" data-stay>Stay</button><button class="btn" data-leave>Leave</button></div>`,
    { stay: () => closeCard(), leave: () => { closeCard(); goHub(); } });
};
for (const id of ['#coinPill', '#hubCoins']) $(id).onclick = () => { sfx.tap(); M.shop(); };
M.onChange(s => { document.querySelectorAll('[data-coins]').forEach(e => e.textContent = s.coins.toLocaleString()); updateHintBadge(); });
document.querySelectorAll('[data-coins]').forEach(e => e.textContent = M.coins().toLocaleString());

// ---------------------------------------------------------------- boot
addEventListener('resize', () => { clearTimeout(resize.t); resize.t = setTimeout(resize, 60); });
applySettings();
resize();
requestAnimationFrame(frame);
if (D.isDaily && S.dly.done !== dayNo()) startLevel('daily'); else goHub();
// warm the cache for the first room while the hub is up
img(roomSrc(levelInfo(S.lvl, 'story').room, innerWidth / innerHeight < 1.05 ? 'P' : 'W'));

// ---------------------------------------------------------------- test hooks
window.__game = {
  get state() { return state; },
  get level() { return S.lvl; },
  get score() { return S.stars; },
  bot() {
    const now = performance.now(); if (now < botWait) return;
    if (state === 'ready') {
      if ($('#sh').classList.contains('on')) { closeSheet(); botWait = now + 500; return; }
      const b = $('#ov').classList.contains('on') ? $('#ovc [data-primary]:not([disabled])') : !$('#hub').classList.contains('off') ? $('#chap [data-primary]:not([disabled])') : null;
      if (b) { b.click(); botWait = now + 1200; }
      return;
    }
    if (state !== 'play' || !L || L.done || !roomImg) return;
    const o = objs().find(x => !x.found); if (!o) return;
    let p = toScreen(o.x, (o.box.y0 + o.box.y1) / 2);
    if (p.x < 10 || p.y < 10 || p.x > view.w - 10 || p.y > view.h - 10) { camT.x = view.w / 2 - o.x * camT.s; camT.y = view.h / 2 - o.y * camT.s; clampCam(camT); Object.assign(cam, camT); dirty = true; p = toScreen(o.x, (o.box.y0 + o.box.y1) / 2); }
    tapAt(p.x, p.y);
    botWait = now + 1500 + Math.random() * 600;
  },
  // QA: ?spots=1 draws every surface and fills each with sample objects
  L: () => L,
  expire() { timeLeft = (performance.now() - playStart) / 1000; },   // QA: run the relaxed timer out
};
if (Q.has('spots')) import('./qa-spots.js').then(m => m.default({ ROOMS, OBJ, img, objSrc, roomSrc, tinted }));
