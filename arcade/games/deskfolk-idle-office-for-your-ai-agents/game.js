// Deskfolk — an idle pixel office for your AI agents. Original RIFFCADE game: all art is drawn in code below.
// Every Claude Code / Codex session the player runs becomes a worker at a desk; subagents pull up a stool.
// Tool calls and tokens (read live from the player's own log folder, see feed.js) earn coins that grow the office.
import { supported, watcher, saved, permitted, demo } from './feed.js';

// ------------------------------------------------------------------ save
const KEY = 'deskfolk_v1';
const today = () => new Date().toLocaleDateString('en-CA');
const fresh = () => ({ coins: 0, owned: {}, life: { tools: 0, tokens: 0 }, ach: {}, lastT: {}, day: newDay() });
const newDay = () => ({ date: today(), tools: 0, tokens: 0, toolCounts: {}, hours: Array(24).fill(0), agents: {}, peak: 0 });
let S = fresh();
try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.day) S = { ...fresh(), ...s }; } catch (e) {}
const save = () => { if (!demoMode) try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
const rollDay = () => { if (S.day.date !== today()) S.day = newDay(); };

// ------------------------------------------------------------------ canvas
const cv = document.getElementById('c'), cx = cv.getContext('2d');
const W = 256, H = 174;
let scale = 4, ox = 0, oy = 0, dpr = 1;
function fit() {
  dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  const top = 56 * dpr;
  scale = Math.max(1, Math.min(cv.width / W, (cv.height - top) / H));
  ox = (cv.width - W * scale) / 2; oy = top + (cv.height - top - H * scale) / 2;
}
addEventListener('resize', fit); fit();
const r = (x, y, w, h, c) => { cx.fillStyle = c; cx.fillRect(Math.round(x), Math.round(y), w, h); };
const text = (s, x, y, c = '#f6f0e3', size = 5, align = 'center') => { cx.font = `${size}px Silkscreen, monospace`; cx.textAlign = align; cx.fillStyle = c; cx.fillText(s, x, y); };

// ------------------------------------------------------------------ the office
const SEATS = [];
for (const y of [84, 136]) for (const x of [42, 98, 158, 214]) SEATS.push({ x, y, who: null });
const DOOR = { x: 12, y: 54 };
const SPOTS = { coffee: { x: 234, y: 60 }, window: { x: 128, y: 58 }, couch: [{ x: 120, y: 166 }, { x: 136, y: 166 }, { x: 152, y: 166 }] };
const ITEMS = [
  { id: 'plant', name: 'Potted plants', ic: '🪴', price: 30, about: 'A bit of green in every corner.' },
  { id: 'rug', name: 'Big rug', ic: '🟪', price: 80, about: 'Ties the room together.' },
  { id: 'coffee', name: 'Coffee machine', ic: '☕', price: 150, about: 'Idle agents go for a coffee instead of staring out the window.' },
  { id: 'lights', name: 'String lights', ic: '✨', price: 250, about: 'Warm lights along the ceiling.' },
  { id: 'shelf', name: 'Bookshelf', ic: '📚', price: 400, about: 'For the docs nobody reads.' },
  { id: 'couch', name: 'Nap couch', ic: '🛋️', price: 600, about: 'Long-idle agents nap on the couch, not on their keyboard.' },
  { id: 'arcade', name: 'Arcade cabinet', ic: '🕹️', price: 900, about: 'Glows in the corner.' },
  { id: 'cat', name: 'Office cat', ic: '🐈', price: 1200, about: 'Wanders around and sits on warm laptops.' },
  { id: 'aquarium', name: 'Aquarium', ic: '🐠', price: 1800, about: 'Very calming. Very wet.' },
  { id: 'neon', name: 'Neon sign', ic: '💡', price: 2500, about: 'SHIP IT, in pink.' },
  { id: 'disco', name: 'Disco ball', ic: '🪩', price: 4000, about: 'Spins when three or more agents are busy.' },
  { id: 'gold', name: 'Golden desks', ic: '🏆', price: 7000, about: 'Every desk, gold. You earned it.' },
];
const has = id => !!S.owned[id];

// ------------------------------------------------------------------ agents
const PAL = {
  skin: ['#f2c9a0', '#e0a77c', '#c58a5c', '#8d5a3b', '#f7d7b8'],
  hair: ['#2b2135', '#5a3a22', '#d9a441', '#a33d2a', '#e8e1d0', '#3b5bbf', '#1c1c1c'],
  shirt: ['#e86a5f', '#4fa3e0', '#6cc58a', '#f0b84a', '#a37de8', '#ef8fb6', '#4cc9c0', '#f2f2f2'],
};
const hash = s => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const pick = (a, h, k) => a[(h >>> k) % a.length];
const agents = new Map();
const now = () => Date.now();
const ACT = t => {
  t = (t || '').toLowerCase();
  if (/edit|write|patch|notebook|apply/.test(t)) return 'type';
  if (/read|grep|glob|ls|view|search_files|find/.test(t)) return 'read';
  if (/bash|shell|exec|run|terminal|js|python/.test(t)) return 'term';
  if (/web|fetch|browse|search|chrome|navigate/.test(t)) return 'web';
  if (/agent|task|spawn|delegate/.test(t)) return 'boss';
  return 'type';
};
// "mcp__claude-in-chrome__computer" → "computer"; long names trimmed
const toolName = t => String(t || '').replace(/^mcp__[^_]+(?:_[^_]+)*?__/, '').replace(/^mcp__/, '').slice(0, 14);
const GLOW = { type: '#7fd6ff', read: '#9cf28a', term: '#ffd866', web: '#6fe3d3', boss: '#ff9db3', think: '#c9a6ff', idle: '#3a3550' };

function agentFor(e) {
  let a = agents.get(e.agent);
  if (a) return a;
  const h = hash(e.agent);
  a = {
    id: e.agent, label: e.label || 'agent', src: e.src, parent: e.parent || null, h,
    pal: { skin: pick(PAL.skin, h, 0), hair: pick(PAL.hair, h, 3), shirt: e.src === 'codex' ? pick(['#4cc9c0', '#2fa6a0', '#7be0d6'], h, 5) : pick(PAL.shirt, h, 5) },
    x: DOOR.x, y: DOOR.y, tx: DOOR.x, ty: DOOR.y, seat: null, mode: 'enter', act: 'think', tool: '', toolAt: 0, lastEvt: e.t, born: now(), step: 0, blink: 0, stool: 0,
  };
  if (a.parent) {
    let p = agents.get(a.parent);
    if (!p) p = agentFor({ agent: a.parent, label: a.label, src: a.src, t: e.t });
    const n = [...agents.values()].filter(x => x.parent === p.id).length;
    a.stool = n; a.boss = p;
  }
  agents.set(a.id, a);
  return a;
}
function seatOf(a) {
  if (a.parent) {
    const b = a.boss; if (!b || !b.seat) return null;
    const side = a.stool % 2 ? -1 : 1, row = (a.stool / 2) | 0;
    return { x: b.seat.x + side * (20 + row * 8), y: b.seat.y + 2 };
  }
  if (!a.seat) { const s = SEATS.find(s => !s.who); if (s) { s.who = a.id; a.seat = s; } }
  return a.seat;
}
function release(a) { if (a.seat) a.seat.who = null; a.seat = null; agents.delete(a.id); }

// ------------------------------------------------------------------ events → game
let demoMode = false;
const pops = [];
function onEvents(list, info = {}) {
  rollDay();
  const live = !info.demo;
  // each real event counts once, ever: only events newer than what the previous batches already counted
  // (several tool calls and the token count of one message share a timestamp, so the mark moves after the batch)
  const mark = { ...S.lastT };
  for (const e of list) {
    const fresh = now() - e.t < 30 * 60e3;
    const counted = info.demo ? true : e.t > (mark[e.src] || 0);
    if (live && counted) S.lastT[e.src] = Math.max(S.lastT[e.src] || 0, e.t);
    const st = info.demo ? demoDay : S.day;
    if (counted && new Date(e.t).toLocaleDateString('en-CA') === st.date) {
      if (e.kind === 'tool') {
        st.tools++; st.toolCounts[e.tool] = (st.toolCounts[e.tool] || 0) + 1; st.hours[new Date(e.t).getHours()]++;
        st.agents[e.label] = (st.agents[e.label] || 0) + 1;
        if (live) { S.life.tools++; S.coins += 1; }
        else demoCoins += 1;
        if (live && new Date(e.t).getHours() < 5) award('owl');
      }
      if (e.kind === 'tokens') {
        st.tokens += e.tokens;
        if (live) { S.life.tokens += e.tokens; const before = Math.floor((S.life.tokens - e.tokens) / 1000); S.coins += Math.floor(S.life.tokens / 1000) - before; }
      }
    }
    // the office shows only who is working right now
    if (!fresh || e.kind === 'prompt') continue;
    const a = agentFor(e);
    if (e.kind === 'end') { if (a.parent) a.mode = 'leave'; continue; }
    a.lastEvt = Math.max(a.lastEvt, e.t);
    if (e.kind === 'tool') { a.act = ACT(e.tool); a.tool = e.tool; a.toolAt = now(); if (!info.backfill && counted) pops.push({ x: 0, y: 0, a, t: now(), s: '+1' }); }
    else if (e.kind === 'think') { if (now() - a.toolAt > 4000) a.act = 'think'; a.waiting = false; }
    else if (e.kind === 'done') { a.waiting = true; a.act = 'think'; if (!info.backfill && !a.parent) toast(`✋ ${a.label}: your agent finished and is waiting for you`); }
    if (e.kind === 'tool') a.waiting = false;
    if (a.mode === 'idle' || a.mode === 'sleep' || a.mode === 'toIdle') a.mode = 'back';
  }
  const working = [...agents.values()].filter(a => !a.parent && a.mode !== 'leave');
  const st = info.demo ? demoDay : S.day;
  st.peak = Math.max(st.peak, working.length);
  if (live) {
    if (S.life.tools >= 1) award('first');
    if (S.day.tools >= 100) award('t100');
    if (S.day.tools >= 1000) award('t1000');
    if (working.length >= 3) award('three');
    if (SEATS.every(s => s.who)) award('full');
    if ([...agents.values()].filter(a => a.parent).length >= 5) award('swarm');
    save();
  }
  hud();
}
let demoCoins = 0, demoDay = newDay();

// ------------------------------------------------------------------ achievements
const ACH = {
  first: 'First coin: your agent ran a tool.', t100: '100 tool calls today.', t1000: '1,000 tool calls today. Busy office!',
  three: 'Three agents at work at once.', swarm: 'Subagent swarm: five interns on stools.', full: 'Every desk taken.',
  owl: 'Night owl: your agents work after midnight.', shop: 'First purchase. The office grows.',
};
function award(k) { if (S.ach[k]) return; S.ach[k] = Date.now(); toast('🏅 ' + ACH[k]); }
function toast(s) {
  const d = document.createElement('div'); d.className = 'toast'; d.textContent = s;
  document.getElementById('toasts').appendChild(d); setTimeout(() => d.remove(), 5200);
}

// ------------------------------------------------------------------ simulation
function update(dt) {
  const t = now();
  for (const a of [...agents.values()]) {
    const quiet = t - a.lastEvt;
    // where should they be?
    if (a.mode === 'leave' || (!a.parent && quiet > 30 * 60e3) || (a.parent && quiet > 3 * 60e3) || (a.parent && !agents.has(a.parent))) {
      a.mode = 'leave'; a.tx = DOOR.x; a.ty = DOOR.y;
      if (Math.hypot(a.x - DOOR.x, a.y - DOOR.y) < 2) { release(a); continue; }
    } else {
      const seat = seatOf(a);
      if (!seat) { a.tx = DOOR.x + 14; a.ty = DOOR.y + 4; }                 // office full: wait by the door
      else if (quiet > 60e3 && !(a.waiting && quiet < 10 * 60e3) && !a.parent && (a.mode === 'work' || a.mode === 'back' || a.mode === 'enter')) {   // a raised hand stays at the desk for 10 min
        a.mode = 'toIdle'; const s = has('coffee') ? SPOTS.coffee : SPOTS.window; a.tx = s.x + ((a.h % 9) - 4) * 3; a.ty = s.y + (a.h % 5);
      } else if (a.mode === 'idle' && quiet > 6 * 60e3) {
        if (has('couch')) { const c = SPOTS.couch[a.h % 3]; a.tx = c.x; a.ty = c.y; } else { a.tx = seat.x; a.ty = seat.y - 4; }
        a.mode = 'sleep';
      } else if (a.mode === 'enter' || a.mode === 'back' || a.mode === 'work') { a.tx = seat.x; a.ty = seat.y - 4; if (a.mode !== 'work' && Math.hypot(a.x - a.tx, a.y - a.ty) < 1) a.mode = 'work'; }
      if (a.mode === 'toIdle' && Math.hypot(a.x - a.tx, a.y - a.ty) < 1) a.mode = 'idle';
    }
    const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy), sp = 38 * dt;
    if (d > 0.5) { a.x += dx / d * Math.min(sp, d); a.y += dy / d * Math.min(sp, d); a.step += dt * 8; a.walking = true; } else { a.x = a.tx; a.y = a.ty; a.walking = false; }
    if (Math.random() < dt * 0.4) a.blink = 0.15; a.blink = Math.max(0, a.blink - dt);
  }
  for (let i = pops.length - 1; i >= 0; i--) if (t - pops[i].t > 1100) pops.splice(i, 1);
  if (has('cat')) cat.update(dt);
}
const cat = {
  x: 60, y: 140, tx: 60, ty: 140, wait: 2, step: 0,
  update(dt) {
    const d = Math.hypot(this.tx - this.x, this.ty - this.y);
    if (d < 1) { this.wait -= dt; if (this.wait < 0) { const busy = [...agents.values()].filter(a => a.mode === 'work' && a.seat); const s = busy.length && Math.random() < 0.5 ? busy[(Math.random() * busy.length) | 0].seat : null; this.tx = s ? s.x + 9 : 20 + Math.random() * 216; this.ty = s ? s.y - 1 : 60 + Math.random() * 106; this.wait = 3 + Math.random() * 6; } }
    else { const sp = 16 * dt; this.x += (this.tx - this.x) / d * Math.min(sp, d); this.y += (this.ty - this.y) / d * Math.min(sp, d); this.step += dt * 6; }
  },
};

// ------------------------------------------------------------------ drawing
let T = 0;
function sky() {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  if (h < 5 || h >= 21) return ['#141436', '#26265a', 'night'];
  if (h < 7) return ['#f2a07b', '#7f8fd6', 'dawn'];
  if (h < 18) return ['#7ec8f2', '#bfe6fb', 'day'];
  return ['#f08a5d', '#6a5acd', 'dusk'];
}
function drawRoom() {
  // wall
  r(0, 0, W, 50, '#3d3657'); r(0, 46, W, 4, '#2c2742');
  for (let x = 0; x < W; x += 16) r(x, 0, 1, 46, '#443d60');
  // floor planks
  for (let y = 50; y < H; y += 6) { r(0, y, W, 6, (y / 6) % 2 ? '#7a5a43' : '#80604a'); for (let x = ((y / 6) % 3) * 20; x < W; x += 60) r(x, y, 1, 6, '#6b4e3a'); }
  // door
  r(4, 18, 18, 30, '#5b3f2c'); r(6, 20, 14, 28, '#77543a'); r(17, 33, 2, 2, '#e9c46a');
  // window (real time of day)
  const [a, b, k] = sky();
  r(98, 8, 60, 32, '#2a2440'); r(100, 10, 56, 28, b); r(100, 10, 56, 12, a);
  if (k === 'night') { for (let i = 0; i < 9; i++) r(102 + (i * 23) % 52, 12 + (i * 7) % 16, 1, 1, '#fff'); r(144, 14, 5, 5, '#f4f1c9'); }
  else if (k === 'day') { r(140, 14, 7, 7, '#ffe680'); r(108, 26, 12, 3, '#fff'); r(112, 24, 8, 2, '#fff'); }
  else r(120, 28, 14, 7, '#ffcf7a');
  // skyline
  for (let i = 0; i < 7; i++) { const h = 6 + (i * 37) % 11; r(100 + i * 8, 38 - h, 7, h, k === 'night' ? '#1d1d3a' : '#5b6aa0'); if (k === 'night') r(102 + i * 8, 38 - h + 2, 1, 1, '#ffd866'); }
  r(127, 10, 2, 28, '#2a2440'); r(100, 23, 56, 1, '#2a2440');
  // real clock
  const d = new Date(); r(82, 12, 12, 12, '#2a2440'); r(83, 13, 10, 10, '#f6f0e3');
  const hand = (v, len, c) => { const ang = v * Math.PI * 2 - Math.PI / 2; for (let i = 0; i < len; i++) r(88 + Math.cos(ang) * i, 18 + Math.sin(ang) * i, 1, 1, c); };
  hand((d.getHours() % 12) / 12 + d.getMinutes() / 720, 3, '#2a2440'); hand(d.getMinutes() / 60, 4, '#2a2440'); r(88, 18, 1, 1, '#c0392b');
  // poster + whiteboard (always there)
  if (!has('aquarium')) { r(56, 14, 18, 22, '#f6f0e3'); r(58, 16, 14, 9, '#4fa3e0'); r(62, 19, 6, 6, '#ffd866'); text('SHIP', 65, 31, '#2a2440', 4); }
  r(162, 26, 32, 18, '#d9d6e6'); r(163, 27, 30, 16, '#f6f4fb'); r(166, 31, 12, 1, '#4fa3e0'); r(166, 34, 18, 1, '#e86a5f'); r(166, 37, 9, 1, '#6cc58a'); r(184, 30, 5, 5, '#ffd866');
  // shop items on the wall / floor
  if (has('rug')) { r(70, 100, 116, 22, '#6d3f8f'); r(73, 103, 110, 16, '#8e55b8'); for (let x = 76; x < 180; x += 8) r(x, 110, 4, 2, '#f0b84a'); }
  if (has('shelf')) { r(26, 10, 22, 36, '#5b3f2c'); for (let s = 0; s < 3; s++) { r(27, 20 + s * 10, 20, 1, '#3b2a1e'); for (let i = 0; i < 6; i++) r(28 + i * 3, 13 + s * 10, 2, 7 - (i % 3), ['#e86a5f', '#4fa3e0', '#f0b84a', '#6cc58a', '#a37de8'][(i + s) % 5]); } }
  if (has('aquarium')) { r(52, 22, 26, 18, '#1e3b5a'); r(53, 23, 24, 16, '#3fa7d6'); r(53, 35, 24, 4, '#e0c58a'); for (let i = 0; i < 3; i++) { const fx = 54 + ((T * (6 + i * 3) + i * 9) % 20), fy = 26 + i * 3; r(fx, fy, 3, 2, ['#ff8a3d', '#ffd23f', '#ff6fa8'][i]); r(fx - 1, fy, 1, 2, '#fff8'); } r(52, 40, 26, 6, '#5b3f2c'); }
  if (has('neon')) { const on = Math.sin(T * 3) > -0.92; text('SHIP IT', 178, 18, on ? '#ff6fb5' : '#7a3a5a', 7); if (on) { cx.globalAlpha = 0.18; r(160, 10, 36, 10, '#ff6fb5'); cx.globalAlpha = 1; } }
  if (has('arcade')) { r(200, 18, 14, 30, '#2b2f77'); r(202, 21, 10, 8, Math.sin(T * 7) > 0 ? '#6fe3d3' : '#ff6fb5'); r(203, 32, 2, 2, '#e86a5f'); r(207, 32, 4, 1, '#f0b84a'); }
  if (has('coffee')) { r(222, 28, 30, 4, '#8a5a36'); r(222, 32, 30, 16, '#6b4430'); r(230, 16, 12, 12, '#d0d0d8'); r(232, 18, 8, 4, '#2a2440'); r(234, 25, 4, 3, '#fff'); if (Math.sin(T * 2) > 0) { r(235, 12, 1, 2, '#fff8'); r(237, 10, 1, 2, '#fff6'); } }
  if (has('lights')) for (let x = 4; x < W; x += 8) r(x, 2 + (x % 16 ? 1 : 0), 2, 2, ['#ffd866', '#ff6fb5', '#6fe3d3', '#9cf28a'][((x / 8) + Math.floor(T * 2)) % 4]);
  if (has('disco')) { r(127, 0, 1, 6, '#888'); r(124, 6, 7, 7, '#d8d8e8'); for (let i = 0; i < 4; i++) r(125 + (i % 2) * 3, 7 + (i >> 1) * 3, 2, 2, '#9ab'); }
}
function drawDisco() {
  if (!has('disco')) return;
  const busy = [...agents.values()].filter(a => a.mode === 'work').length;
  if (busy < 3) return;
  cx.globalAlpha = 0.22;
  for (let i = 0; i < 14; i++) { const a = T * 0.8 + i * 0.9; r(128 + Math.cos(a) * (30 + i * 6), 105 + Math.sin(a * 1.3) * 40, 3, 2, ['#ff6fb5', '#6fe3d3', '#ffd866', '#9cf28a'][i % 4]); }
  cx.globalAlpha = 1;
}
function person(a, x, y, pose, small) {
  const p = a.pal, s = small ? 0 : 1;
  // y = feet line; pose: walk | stand | sit (hidden legs) | sleep
  const bob = pose === 'sit' && a.act === 'type' && now() - a.toolAt < 6000 ? (Math.sin(T * 14 + a.h) > 0 ? 1 : 0) : 0;
  const hy = y - 14 + (pose === 'sit' ? 2 + bob : 0) + (small ? 3 : 0);
  // hair back + face
  r(x - 4, hy, 8, 3, p.hair); r(x - 4, hy + 3, 1, 2, p.hair); r(x + 3, hy + 3, 1, 2, p.hair);
  r(x - 3, hy + 3, 6, 4, p.skin);
  if (pose === 'sleep') { r(x - 2, hy + 4, 2, 1, '#2228'); r(x + 1, hy + 4, 2, 1, '#2228'); }
  else if (a.blink > 0) { r(x - 2, hy + 4, 1, 1, p.skin); }
  else { r(x - 2, hy + 4, 1, 1, '#221'); r(x + 1, hy + 4, 1, 1, '#221'); }
  if (a.parent) r(x - 4, hy - 1, 8, 2, a.boss ? a.boss.pal.shirt : '#fff');   // intern cap in their lead's colour
  // body
  r(x - 4, hy + 7, 8, 4 + s, p.shirt); r(x - 5, hy + 7, 1, 3, p.shirt); r(x + 4, hy + 7, 1, 3, p.shirt);
  r(x - 5, hy + 10, 1, 1, p.skin); r(x + 4, hy + 10, 1, 1, p.skin);
  if (pose === 'walk' || pose === 'stand') {
    const k = pose === 'walk' ? (Math.floor(a.step) % 2) : 0;
    r(x - 3, hy + 11 + s, 2, 3 - k, '#3b3550'); r(x + 1, hy + 11 + s, 2, 2 + k, '#3b3550');
  }
}
function desk(seat, a) {
  const x = seat.x, y = seat.y, gold = has('gold');
  // chair behind the worker
  r(x - 6, y - 21, 12, 13, '#3b3550'); r(x - 5, y - 20, 10, 10, '#4a4466');
  const asleep = a && a.mode === 'sleep' && Math.hypot(a.x - x, a.y - (y - 4)) < 2;
  if (a) person(a, x, y - 6, asleep ? 'sleep' : 'sit');
  // desk
  r(x - 18, y - 2, 36, 4, gold ? '#f0c24a' : '#a8744a'); r(x - 18, y + 2, 36, 9, gold ? '#c99a2e' : '#8a5a36');
  r(x - 16, y + 11, 2, 4, '#5b3f2c'); r(x + 14, y + 11, 2, 4, '#5b3f2c');
  // laptop (lid seen from behind), screen glow by activity
  const act = a && a.mode === 'work' ? (now() - a.toolAt < 8000 ? a.act : a.act === 'think' ? 'think' : 'idle') : 'idle';
  r(x - 6, y - 7, 12, 6, '#cfd0dc'); r(x - 1, y - 5, 2, 2, '#b4b5c4');
  r(x - 6, y - 2, 12, 1, GLOW[act]);
  const k = [0, 2, 1, 3, 3, 1, 0, 2][SEATS.indexOf(seat)];  // a little clutter, different on every desk
  if (k === 0) { r(x + 10, y - 5, 4, 4, '#f6f0e3'); r(x + 14, y - 4, 1, 2, '#f6f0e3'); r(x + 11, y - 4, 2, 1, '#6b3f2a'); }
  else if (k === 1) { r(x - 15, y - 5, 4, 3, '#b5654a'); r(x - 15, y - 9, 2, 4, '#5fb56d'); r(x - 13, y - 8, 2, 3, '#4f9d5d'); }
  else if (k === 2) { r(x + 9, y - 4, 7, 1, '#f6f0e3'); r(x + 9, y - 3, 7, 1, '#e0dccf'); r(x + 10, y - 5, 6, 1, '#f6f0e3'); }
  else { r(x - 14, y - 5, 3, 4, '#e86a5f'); r(x - 14, y - 6, 3, 1, '#f6f0e3'); }
  if (act !== 'idle') { cx.globalAlpha = 0.25; r(x - 8, y - 11, 16, 2, GLOW[act]); cx.globalAlpha = 1; }
  if (a) {
    // name plate + current tool
    text(a.label.slice(0, 12), x, y + 8.5, '#f6e7d0', 3.8);
    if (a.mode === 'work' && a.waiting) hand(x, y - 30);
    else if (a.mode === 'work' && now() - a.toolAt < 8000) bubble(x, y - 31, a.act, a.act === 'think' ? '' : a.tool);
    else if (a.mode === 'work' && a.act === 'think') bubble(x, y - 31, 'think');
    if (asleep) zz(x + 5, y - 24);
  }
}
const ICON = {
  type: ['.......', '#######', '#.#.#.#', '#######', '.#####.'],
  read: ['.###...', '#...#..', '#...#..', '.###...', '....##.'],
  term: ['#......', '.#.....', '#..###.', '.......', '.......'],
  web: ['.###...', '#.#.#..', '#####..', '#.#.#..', '.###...'],
  boss: ['..#....', '.###...', '..#....', '.#.#...', '#...#..'],
  think: ['.......', '.......', '#.#.#..', '.......', '.......'],
};
function bubble(x, y, act, tool) {
  const ic = ICON[act] || ICON.type, w = 11;
  r(x - w / 2, y, w, 8, '#f6f0e3'); r(x - 1, y + 8, 2, 2, '#f6f0e3');
  ic.forEach((row, j) => [...row].forEach((c, i) => { if (c === '#') r(x - 3 + i, y + 1 + j, 1, 1, act === 'think' ? '#7a5cc8' : '#2a2440'); }));
  if (tool) text(toolName(tool).slice(0, 10), x, y - 2, GLOW[act] || '#fff', 3.6);
}
function hand(x, y) {   // finished, waiting for you: a raised hand that bounces
  const k = Math.sin(T * 6) > 0 ? 1 : 0;
  r(x + 5, y + 2 - k, 3, 5, '#f2c9a0'); r(x + 4, y + 1 - k, 1, 3, '#f2c9a0'); r(x + 8, y + 2 - k, 1, 2, '#f2c9a0'); r(x + 6, y + 7 - k, 1, 4, '#f2c9a0');
  text('!', x - 2, y + 6, '#ffcf5a', 7);
}
function zz(x, y) { const k = Math.floor(T * 2) % 3; text('z', x, y - k, '#c9a6ff', 4); if (k > 0) text('Z', x + 3, y - 3 - k, '#c9a6ff', 5); }
function drawPlants() { if (!has('plant')) return; for (const [x, y] of [[250, 172], [8, 172], [248, 62]]) { r(x - 4, y - 6, 8, 6, '#b5654a'); r(x - 5, y - 13, 3, 7, '#4f9d5d'); r(x - 1, y - 16, 3, 10, '#5fb56d'); r(x + 3, y - 12, 3, 6, '#4f9d5d'); } }
function drawCouch() { if (!has('couch')) return; r(108, 160, 56, 6, '#c0504d'); r(106, 154, 60, 6, '#a8403e'); r(104, 154, 4, 14, '#8f3533'); r(164, 154, 4, 14, '#8f3533'); }
function drawCat() {
  if (!has('cat')) return; const x = cat.x, y = cat.y, k = Math.floor(cat.step) % 2;
  r(x - 4, y - 4, 7, 3, '#f0a04b'); r(x + 2, y - 6, 3, 3, '#f0a04b'); r(x + 2, y - 7, 1, 1, '#f0a04b'); r(x + 4, y - 7, 1, 1, '#f0a04b');
  r(x - 3, y - 1, 1, 1 + k, '#d0803b'); r(x + 1, y - 1, 1, 2 - k, '#d0803b'); r(x - 6, y - 6 + k, 2, 1, '#f0a04b');
}
function frame() {
  cx.setTransform(1, 0, 0, 1, 0, 0); cx.fillStyle = '#1d1a2b'; cx.fillRect(0, 0, cv.width, cv.height);
  cx.setTransform(scale, 0, 0, scale, ox, oy); cx.imageSmoothingEnabled = false;
  drawRoom(); drawDisco(); drawCouch();
  // draw by depth: desks (with their seated worker), walkers, interns, cat
  const items = [];
  for (const s of SEATS) { const a = s.who && agents.get(s.who); const seated = a && Math.hypot(a.x - s.x, a.y - (s.y - 4)) < 2; items.push({ y: s.y, f: () => desk(s, seated ? a : null) }); }
  for (const a of agents.values()) {
    const seated = a.seat && Math.hypot(a.x - a.seat.x, a.y - (a.seat.y - 4)) < 2;
    if (seated && !a.parent) continue;
    const onStool = a.parent && !a.walking && a.mode !== 'leave';
    items.push({ y: a.y + (onStool ? 3 : 0), f: () => {
      if (onStool) { r(a.x - 3, a.y - 3, 6, 3, '#4a4466'); person(a, a.x, a.y - 1, 'sit', true); if (now() - a.toolAt < 8000) bubble(a.x, a.y - 24, a.act, ''); }
      else if (a.mode === 'sleep' && has('couch') && !a.walking) { person(a, a.x, a.y - 4, 'sleep'); zz(a.x + 4, a.y - 18); }
      else { person(a, a.x, a.y, a.walking ? 'walk' : 'stand'); if (a.mode === 'idle' && has('coffee')) r(a.x + 4, a.y - 7, 2, 3, '#fff'); }
    } });
  }
  if (has('cat')) items.push({ y: cat.y, f: drawCat });
  items.sort((a, b) => a.y - b.y).forEach(i => i.f());
  drawPlants();
  // coin pops
  for (const p of pops) { const k = (now() - p.t) / 1100, a = p.a; const sx = a.seat && !a.parent ? a.seat.x : a.x, sy = a.seat && !a.parent ? a.seat.y - 30 : a.y - 30; cx.globalAlpha = 1 - k; text(p.s, sx + 9, sy - k * 10, '#ffcf5a', 5); cx.globalAlpha = 1; }
  const waiting = [...agents.values()].filter(a => !a.parent && !a.seat).length;
  if (waiting) text(`+${waiting} waiting for a desk`, 40, 70, '#ffcf5a', 4);
  if (!agents.size && !demoMode && connected.length) text('Waiting for your agents to start working…', W / 2, 104, '#b9b2c8', 5);
}
let last = performance.now();
function loop(t) { const dt = Math.min(0.1, (t - last) / 1000); last = t; T += dt; update(dt); frame(); requestAnimationFrame(loop); }
requestAnimationFrame(loop);

// ------------------------------------------------------------------ HUD + panels
const $ = id => document.getElementById(id);
const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'k' : n.toLocaleString();
const level = () => 1 + Math.floor(Math.sqrt(S.life.tools / 40));
function hud() {
  const d = demoMode ? demoDay : S.day;
  $('coins').textContent = fmt(demoMode ? demoCoins : S.coins);
  $('tools').textContent = fmt(d.tools); $('tokens').textContent = fmt(d.tokens);
  $('agents').textContent = [...agents.values()].filter(a => !a.parent && a.mode !== 'leave').length;
  $('lvl').textContent = 'Lv ' + level();
  if (!$('shop').hidden) shopRender();
}
function shopRender() {
  $('shopList').innerHTML = (demoMode ? '<p class="fine warn">Demo coins can\'t buy anything. Connect your agents to earn real coins.</p>' : '') + ITEMS.map(it => `
    <div class="item"><div class="ic">${it.ic}</div><div><b>${it.name}</b><small>${it.about}</small></div>
    ${has(it.id) ? '<button class="owned" disabled>Owned</button>' : `<button class="big" data-buy="${it.id}" ${demoMode || S.coins < it.price ? 'disabled' : ''}>🪙 ${fmt(it.price)}</button>`}</div>`).join('');
}
$('shopList').addEventListener('click', e => {
  const b = e.target.closest('[data-buy]'); if (!b) return;
  const it = ITEMS.find(i => i.id === b.dataset.buy);
  if (!it || has(it.id) || S.coins < it.price) return;
  S.coins -= it.price; S.owned[it.id] = Date.now(); award('shop'); save(); hud(); toast(`${it.ic} ${it.name} added to the office`);
});
function todayRender() {
  const d = demoMode ? demoDay : S.day;
  const top = Object.entries(d.toolCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const mx = top.length ? top[0][1] : 1, hm = Math.max(1, ...d.hours);
  const busiest = Object.entries(d.agents).sort((a, b) => b[1] - a[1])[0];
  $('todayBody').innerHTML = `
    <div class="kpis"><div><b>${fmt(d.tools)}</b><small>tool calls</small></div><div><b>${fmt(d.tokens)}</b><small>tokens</small></div>
    <div><b>${d.peak}</b><small>agents at once (peak)</small></div><div><b>${busiest ? busiest[0] : '—'}</b><small>busiest project</small></div></div>
    <div class="bars">${top.map(([k, v]) => `<div><span>${toolName(k)}</span><i style="width:${(v / mx * 100).toFixed(0)}%"></i><span>${v}</span></div>`).join('') || '<p class="fine">No tool calls yet today.</p>'}</div>
    <div class="hours" title="Tool calls by hour">${d.hours.map(v => `<i style="height:${(v / hm * 100).toFixed(0)}%"></i>`).join('')}</div>`;
}
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => b.closest('.card').hidden = true);
$('bShop').onclick = () => { $('today').hidden = true; $('start').hidden = true; $('shop').hidden = !$('shop').hidden; shopRender(); };
$('bToday').onclick = () => { $('shop').hidden = true; $('start').hidden = true; $('today').hidden = !$('today').hidden; todayRender(); };
$('bConnect').onclick = () => { $('shop').hidden = $('today').hidden = true; $('start').hidden = false; };
$('demoConnect').onclick = e => { e.preventDefault(); $('start').hidden = false; };

// share card: the office + today's numbers, as a PNG
$('bShare').onclick = async () => {
  const d = demoMode ? demoDay : S.day, out = document.createElement('canvas'); out.width = 1200; out.height = 630;
  const o = out.getContext('2d'); o.fillStyle = '#1d1a2b'; o.fillRect(0, 0, 1200, 630);
  const sw = W * scale, sh = H * scale, k = Math.min(1200 / sw, 470 / sh);
  o.imageSmoothingEnabled = false; o.drawImage(cv, ox, oy, sw, sh, (1200 - sw * k) / 2, 0, sw * k, sh * k);
  o.fillStyle = '#ffcf5a'; o.font = '44px Silkscreen, monospace'; o.fillText('MY AI AGENTS TODAY', 40, 530);
  o.fillStyle = '#f6f0e3'; o.font = '30px "Space Grotesk", sans-serif';
  const topTool = Object.entries(d.toolCounts).sort((a, b) => b[1] - a[1])[0];
  o.fillText(`${d.tools.toLocaleString()} tool calls · ${fmt(d.tokens)} tokens · ${d.peak} at once${topTool ? ' · top tool ' + toolName(topTool[0]) : ''}`, 40, 578);
  o.fillStyle = '#b9b2c8'; o.font = '22px "Space Grotesk", sans-serif'; o.fillText('Deskfolk · riffcade.com', 40, 612);
  const blob = await new Promise(res => out.toBlob(res, 'image/png'));
  const file = new File([blob], 'deskfolk-today.png', { type: 'image/png' });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) return await navigator.share({ files: [file], title: 'My AI agents today', text: 'My AI agents today, on Deskfolk', url: location.href.split('?')[0] }); } catch (e) { return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'deskfolk-today.png'; a.click();
};

// ------------------------------------------------------------------ connecting
const connected = [];
window.deskfolkConnect = h => connect(h, false);   // used by the automated QA run
let demoRun = null;
function startDemo() {
  if (demoRun || connected.length) return;
  demoMode = true; demoCoins = 0; demoDay = newDay(); $('demoTag').hidden = false; demoRun = demo(onEvents); hud();
}
function stopDemo() {
  if (!demoRun) return; demoRun.stop(); demoRun = null; demoMode = false; $('demoTag').hidden = true;
  for (const a of [...agents.values()]) if (a.id.startsWith('d:')) release(a);
  hud();
}
async function connect(handle, ask) {
  if (!(await permitted(handle, ask))) return false;
  const w = watcher(handle, onEvents);
  try {
    const src = await w.start();
    stopDemo(); connected.push(w); await saved.add(handle).catch(() => {});
    $('start').hidden = true; toast(`Connected to ${src === 'codex' ? 'Codex' : 'Claude Code'}. Your agents will show up as they work.`);
    hud(); return true;
  } catch (e) { toast('⚠️ ' + e.message); return false; }
}
document.querySelectorAll('[data-src]').forEach(b => b.onclick = async () => {
  if (!supported) return;
  try {
    const h = await showDirectoryPicker({ id: 'deskfolk-' + b.dataset.src, mode: 'read' });
    await connect(h, true);
  } catch (e) { if (e.name !== 'AbortError') toast('⚠️ ' + (e.message || 'Could not open that folder')); }
});
$('bDemo').onclick = () => { $('start').hidden = true; startDemo(); };
if (!supported) { $('noFs').hidden = false; document.querySelectorAll('[data-src]').forEach(b => b.disabled = true); }

// drag a folder onto the page
addEventListener('dragover', e => { e.preventDefault(); $('drop').hidden = false; });
addEventListener('dragleave', e => { if (!e.relatedTarget) $('drop').hidden = true; });
addEventListener('drop', async e => {
  e.preventDefault(); $('drop').hidden = true;
  const it = e.dataTransfer.items && e.dataTransfer.items[0];
  if (it && it.getAsFileSystemHandle) { const h = await it.getAsFileSystemHandle(); if (h && h.kind === 'directory') return connect(h, true); }
  toast('⚠️ Drop the folder itself (.claude or .codex), in Chrome or Edge.');
});

// returning players: reconnect what they connected before (a click is needed if the browser asks again)
(async () => {
  hud();
  let list = [];
  try { list = supported ? await saved.list() : []; } catch (e) {}
  let any = false;
  for (const h of list) if (await connect(h, false)) any = true;
  if (any) return;
  if (list.length) {
    const b = document.createElement('button'); b.className = 'big'; b.textContent = 'Reconnect my agents';
    b.onclick = async () => { for (const h of list) await connect(h, true); };
    document.querySelector('#start .btns').prepend(b);
  }
  startDemo();                                  // the office behind the start card is the demo, so it's never empty
  if (new URLSearchParams(location.search).has('demo')) $('start').hidden = true;
})();
