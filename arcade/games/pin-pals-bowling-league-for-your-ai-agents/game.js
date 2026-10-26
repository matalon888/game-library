// Pin Pals: Bowling League for Your AI Agents. Original RIFFCADE game, all art drawn in code.
// Every live Claude Code / Codex agent bowls on its own lane: a finished task cycle is one ball, and the share of
// tool results that worked decides the pins. The player bowls on lane 1 with real aim, power and hook.
import { THREE, createStage, loop, tone, note, burst, confetti, clamp, lerp } from './kit/hc.js';
import { agents, toast } from './kit/agents.js';
import { demo } from './kit/demo.js';
import { board, flag } from './kit/board.js';
import { L, HALF, BR, PIT, status, frames, total, runningTotal, rng, outcome, pickFall, isSplit, bits, makeRack, Deck, throwBall, scriptBall } from './bowl.js';
import { createWorld, makeBowler, makeTag, makeTurkey, ballMaterial, ballSwatch, BALLS, THEMES, SLOT_X, PITCH, STANCE } from './world.js';

const GAME = 'agent-bowling', CYCLE = 6, LIVE = 30 * 60e3;
const COLORS = ['#ff5d8f', '#3ab7ff', '#7bd94b', '#b26bff', '#ff8c2b', '#21d4c6', '#ff4dd2', '#ffd23f'];
const $ = id => document.getElementById(id);
const todayKey = (t = Date.now()) => new Date(t).toLocaleDateString('en-CA');
const weekKey = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toLocaleDateString('en-CA'); };
const midnight = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return +d; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const isNight = () => { const h = new Date().getHours(); return h >= 19 || h < 6; };

// ================================================================== save
const SAVE = 'pinpals_v1';
const freshSave = () => ({
  v: 1, player: { games: 0, pins: 0, high: 0, strikes: 0, spares: 0, run: 0 }, bowlers: {}, week: { id: weekKey(), rows: {} }, lastWeek: null,
  trophies: {}, balls: { house: 1 }, themes: { auto: 1, classic: 1 }, sel: { ball: 'house', theme: 'auto' }, game: [], ag: {}, days: {},
  counts: { agentStrikes: 0, testBalls: 0, perfect: 0, commits: 0 }, playDays: [],
});
let S = freshSave();
try { const s = JSON.parse(localStorage.getItem(SAVE)); if (s && s.v === 1) S = { ...freshSave(), ...s }; } catch (e) {}
const save = () => { try { localStorage.setItem(SAVE, JSON.stringify(S)); } catch (e) {} };
function rollWeek() {
  if (S.week.id === weekKey()) return;
  const rows = standings(S.week.rows);
  S.lastWeek = { id: S.week.id, top: rows.slice(0, 3).map(r => ({ name: r.name, pts: r.pts })) };
  if (rows.length > 1 && rows[0].key === '★') award('champ');
  S.week = { id: weekKey(), rows: {} };
}
for (const [id, g] of Object.entries(S.ag)) if (Date.now() - (g.t || 0) > 3 * 864e5) delete S.ag[id];   // forget old sessions
for (const d of Object.keys(S.days)) if (Date.now() - Date.parse(d) > 40 * 864e5) delete S.days[d];
// demo team state lives in memory only
let D = null;
const demoState = () => ({ bowlers: {}, week: { rows: {} }, ag: {} });
const AG = () => (A && A.demo ? D || (D = demoState()) : S);

// ================================================================== stage + world
const stage = createStage({ fov: 46, shadows: true, clear: '#241a33' });
stage.autoRender = false;
const { scene, camera, renderer } = stage;
renderer.localClippingEnabled = false;
const W = createWorld(stage);
const themeNow = () => S.sel.theme === 'auto' ? (isNight() ? 'cosmic' : 'classic') : S.sel.theme;
W.setTheme(themeNow());
setInterval(() => W.setTheme(themeNow()), 60e3);

// ================================================================== lanes at runtime
const lanes = W.lanes.map((w, i) => ({
  i, w, X: SLOT_X[i], owner: null, bowler: null, tag: null, subs: new Map(), queue: [], phase: 'idle', pt: 0,
  rack: 1023, deck: null, pv: w.pins.map(() => ({ x: 0, z: 0, y: 0, vy: 0, tilt: 0, dx: 0, dz: 1, gone: false })), disp: [], lastGame: null,
  rec: null, waving: false, sweepReset: false, ballState: 'rack', big: null, sparkle: false,
}));
const P = lanes[0];   // the player's lane (lane 1)
function resetPins(ln, mask = 1023, drop = false) {
  ln.rack = mask;
  ln.pv.forEach((v, i) => { const on = !!(mask & (1 << i)); Object.assign(v, { x: 0, z: 0, y: drop && on ? 0.9 + i * 0.03 : 0, vy: 0, tilt: 0, gone: !on, started: false, pit: false }); });
  ln.deck = null;
}
function drawPins(ln, dt) {
  const d = ln.deck;
  ln.w.pins.forEach((m, i) => {
    const v = ln.pv[i];
    if (d) { const p = d.pins[i]; if (p.stand) { v.x = p.x - ln.w.pins[i].userData.sx; v.z = p.z - ln.w.pins[i].userData.sz; if (p.down && v.tilt === 0 && !v.started) { v.started = true; v.vy = p.hop * 1.6; const s = Math.hypot(p.vx, p.vz) || 1; v.dx = p.vx / s; v.dz = p.vz / s; } if (p.out) v.pit = true; } }
    if (v.started) { v.tilt = Math.min(Math.PI / 2, v.tilt + 0.09 * dt * (1 + Math.abs(v.vy))); }
    if (v.vy || v.y > 0) { v.y += v.vy * 0.016 * dt; v.vy -= 9.8 * 0.016 * dt; if (v.y < 0 && !v.pit) { v.y = 0; v.vy = Math.abs(v.vy) > 0.6 ? -v.vy * 0.35 : 0; } }
    if (v.pit) { v.y = Math.max(-0.8, v.y - 0.03 * dt); if (v.y <= -0.8) v.gone = true; }
    m.visible = !v.gone;
    m.position.set(m.userData.sx + v.x, v.y + Math.sin(v.tilt) * 0.06, m.userData.sz + v.z);
    if (v.tilt > 0) { m.quaternion.setFromAxisAngle(tmpV.set(v.dz, 0, -v.dx).normalize(), v.tilt); } else m.quaternion.identity();
  });
}
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();
W.lanes.forEach(w => w.pins.forEach(m => { m.userData.sx = m.position.x; m.userData.sz = m.position.z; }));

// ---- bowlers
function handPos(b, out) {
  const s = b.scale.x, th = b.armR.rotation.x, ry = b.rotation.y;
  const lx = 0.3 * s, ly = 1.2 * s - 0.5 * s * Math.cos(th), lz = -0.5 * s * Math.sin(th);
  out.set(lx * Math.cos(ry) + lz * Math.sin(ry), ly, -lx * Math.sin(ry) + lz * Math.cos(ry)).add(b.position);
  return out;
}
function setOwner(ln, owner) {
  if (ln.bowler) { ln.w.g.remove(ln.bowler); ln.bowler = null; }
  for (const s of ln.subs.values()) ln.w.g.remove(s.mesh); ln.subs.clear();
  ln.owner = owner; ln.queue = []; ln.phase = 'idle'; ln.waving = false;
  if (!owner) { ln.w.ball.material = ballMaterial(null, '#7d7396'); W.setNeon(ln.i, '#6a4cff'); ln.w.ball.visible = true; ln.w.ball.position.set(PITCH / 2, 0.41, 1.75); drawScreen(ln); return; }
  const b = makeBowler(owner.color, owner.seed); b.position.set(-0.28, 0, STANCE); ln.w.g.add(b); ln.bowler = b;
  const tag = makeTag(owner.name, owner.color); tag.position.set(0, 2.05, 0); b.add(tag); ln.tag = tag;
  W.setNeon(ln.i, owner.color);
  ln.w.ball.material = ln === P ? ballMaterial(S.sel.ball) : ballMaterial(null, owner.color);
  ln.ballState = 'hand';
  drawScreen(ln);
}

// ---- screens
function drawScreen(ln) {
  const sc = ln.w.screen;
  if (!ln.owner) {
    const anyAgents = lanes.some(l => l !== P && !l.rival && l.owner);
    sc.draw({ label: 'OPEN LANE', color: '#4a3f6b', lane: ln.i + 1, idle: anyAgents ? 'OPEN LANE' : 'WAITING FOR AGENTS', sub: anyAgents ? 'room for one more agent' : 'start a Claude Code or Codex session' });
    return;
  }
  const r = ln.disp;
  sc.draw({ label: ln.owner.name, color: ln.owner.color, lane: ln.i + 1, fr: frames(r), totalNow: runningTotal(r), big: ln.big, sub: ln.rival ? rvStatus(true) : ln.lastGame != null ? 'last game ' + ln.lastGame : ln === P ? 'best ' + (S.player.high || 0) : '' });
}

// ================================================================== sound
let lastCrash = 0;
const snd = {
  roll: q => tone(70, 0.5, 'sawtooth', 0.04 * q, 0.7),
  crash: (n, q = 1) => { const now = performance.now(); if (now - lastCrash < 120) return; lastCrash = now; tone(95, 0.18, 'square', 0.06 * q, 0.5); for (let k = 0; k < Math.min(6, 1 + n / 2); k++) setTimeout(() => tone(500 + Math.random() * 900, 0.05, 'triangle', 0.05 * q, 0.7), k * 22); },
  strike: q => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.1 * q, 1), i * 90)),
  spare: q => [659, 880].forEach((f, i) => setTimeout(() => tone(f, 0.14, 'triangle', 0.09 * q, 1), i * 90)),
  gutter: q => tone(300, 0.35, 'sine', 0.07 * q, 0.4),
  ping: () => { note(84, 0.25, 0.08); setTimeout(() => note(88, 0.35, 0.08), 120); },
  gobble: () => [0, 70, 140, 210].forEach((d, i) => setTimeout(() => tone(380 - i * 25, 0.06, 'square', 0.05, 1.4), d)),
  pop: () => tone(160 + Math.random() * 120, 0.12, 'square', 0.05, 0.4),
};

// ================================================================== popups + banners
const projV = new THREE.Vector3();
function popAt(ln, z, y, text, color = '#fff', size = 26) {
  projV.set(ln.X, y, z).project(camera);
  if (projV.z > 1) return;
  const x = (projV.x * 0.5 + 0.5) * innerWidth, yy = (-projV.y * 0.5 + 0.5) * innerHeight;
  if (x < -40 || x > innerWidth + 40) return;
  const d = document.createElement('div'); d.className = 'pop'; d.textContent = text; d.style.cssText = `left:${clamp(x, 70, innerWidth - 70)}px;top:${clamp(yy, 90, innerHeight - 150)}px;color:${color};font-size:${size}px`;
  $('pops').appendChild(d); setTimeout(() => d.remove(), 1500);
}
let bannerT = 0;
function banner(text, sub = '', color = '#ffd23f') {
  const b = $('banner'); b.innerHTML = `<b style="color:${color}">${text}</b>${sub ? `<small>${sub}</small>` : ''}`;
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove('show'), 1900);
}
let shake = 0;

// ================================================================== agents -> lanes
let colorI = 0;
function laneFor(lead, label, create = true) {
  let ln = lanes.find(l => l !== P && !l.rival && l.owner && l.owner.id === lead);
  if (ln || !create) return ln;
  ln = lanes.find(l => l !== P && !l.rival && !l.owner);
  if (!ln) { // evict the quietest agent
    ln = lanes.filter(l => l !== P && !l.rival).sort((a, b) => a.owner.last - b.owner.last)[0];
  }
  const same = lanes.filter(l => l.owner && l.owner.label === label).length;
  const g = AG().ag[lead];
  const owner = { id: lead, label, name: same ? `${label} #${same + 1}` : label, color: COLORS[colorI++ % COLORS.length], seed: (Math.random() * 1e6) | 0, last: Date.now() };
  setOwner(ln, owner);
  ln.disp = g ? g.rolls.slice() : []; ln.lastGame = g && g.lastGame != null ? g.lastGame : null;
  if (status(ln.disp).fresh) resetPins(ln); else resetPins(ln, 1023 & ~pickFall(1023, 10 - status(ln.disp).standing, Math.random));
  drawScreen(ln); lanes.forEach(l => !l.owner && drawScreen(l));
  updateIdle();
  return ln;
}
function freeLane(ln) { setOwner(ln, null); resetPins(ln); ln.disp = []; lanes.forEach(l => !l.owner && drawScreen(l)); updateIdle(); }

const freshCyc = () => ({ n: 0, ok: 0, test: 0, commit: 0, deploy: 0, dots: [] });
function gameOf(store, lead, label, t) {
  let g = store.ag[lead];
  if (!g) g = store.ag[lead] = { label, rolls: [], cyc: freshCyc(), t, run: 0, lastGame: null };
  g.t = Math.max(g.t || 0, t); return g;
}
function advance(g, e) {
  const c = g.cyc;
  if (e.kind === 'result') {
    c.n++; c.dots.push(e.ok ? 1 : -1);
    if (e.ok) { c.ok++; if (e.cat === 'test') c.test++; if (e.cat === 'commit') c.commit++; if (e.cat === 'deploy') c.deploy++; }
    if (c.n >= CYCLE) return bowlCycle(g, e.t);
  } else if (e.kind === 'done' && !e.parent && c.n) return bowlCycle(g, e.t);
  return null;
}
function bowlCycle(g, seed) {
  const st = status(g.rolls), c = g.cyc, o = outcome(c, st, rng(seed + g.rolls.length * 7919));
  g.rolls.push(o.pins); g.cyc = freshCyc();
  const after = status(g.rolls);
  const rec = { pins: o.pins, tag: o.tag, fresh: st.fresh, standing: st.standing, test: c.test > 0, commit: c.commit > 0, deploy: c.deploy > 0, rolls: g.rolls.slice(), over: after.over, score: after.over ? total(g.rolls) : null, ok: c.ok, n: c.n, seed };
  if (after.over) { g.lastGame = rec.score; g.rolls = []; }
  return rec;
}
function rowOf(rows, key, name) { return rows[key] || (rows[key] = { name, pts: 0, games: 0, pins: 0, high: 0 }); }
function league(store, label, rec, g) {
  const real = store === S, b = store.bowlers[label] || (store.bowlers[label] = { games: 0, pins: 0, high: 0, strikes: 0, bonus: 0 });
  const row = rowOf(store.week.rows, label, label);
  if (rec.tag === 'strike') { b.strikes++; g.run = (g.run || 0) + 1; if (real) { S.counts.agentStrikes++; if (S.counts.agentStrikes >= 10) award('agentStrikes'); if (g.run >= 3) award('agentTurkey'); } } else g.run = 0;
  if (rec.test && real) { S.counts.testBalls++; if (S.counts.testBalls >= 5) award('testBall'); }
  if (rec.commit) { b.bonus += 5; row.pts += 5; if (real) S.counts.commits++; }
  if (rec.deploy) { b.bonus += 10; row.pts += 10; if (real) { S.counts.perfect++; award('perfectFrame'); } }
  if (rec.over) {
    b.games++; b.pins += rec.score; b.high = Math.max(b.high, rec.score);
    row.games++; row.pins += rec.score; row.high = Math.max(row.high, rec.score); row.pts += Math.round(rec.score / 10);
    if (real) { const d = S.days[todayKey()] || (S.days[todayKey()] = { you: 0, games: 0, agents: {} }); d.agents[label] = Math.max(d.agents[label] || 0, rec.score); }
  }
}

// ---- today (recomputed from every event of today, so it is right after a reload too)
let T;
const freshToday = () => ({ date: todayKey(), results: 0, ok: 0, tests: 0, commits: 0, deploys: 0, dones: 0, labels: new Set(), sim: {}, frames: 0, strikes: 0, spares: 0, gutters: 0, best: {}, games: 0 });
T = freshToday();
function todayEvent(e) {
  if (e.t < midnight()) return;
  if (T.date !== todayKey()) T = freshToday();
  T.labels.add(e.label);
  if (e.kind === 'result') { T.results++; if (e.ok) { T.ok++; if (e.cat === 'test') T.tests++; if (e.cat === 'commit') T.commits++; if (e.cat === 'deploy') T.deploys++; } }
  if (e.kind === 'done') T.dones++;
  const lead = e.parent || e.agent, g = T.sim[lead] || (T.sim[lead] = { label: e.label, rolls: [], cyc: freshCyc() });
  const rec = advance(g, e);
  if (rec) { T.frames++; if (rec.tag === 'strike') T.strikes++; if (rec.tag === 'spare') T.spares++; if (rec.tag === 'gutter') T.gutters++; if (rec.over) { T.games++; T.best[e.label] = Math.max(T.best[e.label] || 0, rec.score); } }
}

// ---- the event handler
function onEvents(list, info) {
  B && B.onAgentEvents(list);
  const awayTally = {};
  const store = AG();
  for (const e of list) {
    todayEvent(e);
    const lead = e.parent || e.agent;
    // score: each event once, ever (demo events are always "counted" but live only in memory)
    let rec = null;
    if (e.counted && (e.kind === 'result' || e.kind === 'done')) {
      const g = gameOf(store, lead, e.label, e.t);
      rec = advance(g, e);
      if (rec) {
        league(store, e.label, rec, g);
        if (info.backfill) { const a = awayTally[e.label] || (awayTally[e.label] = { frames: 0, strikes: 0 }); a.frames++; if (rec.tag === 'strike') a.strikes++; }
      }
    }
    if (!e.live) continue;
    // on-screen: live agents take a lane
    const ln = laneFor(lead, e.label, !(e.kind === 'end'));
    if (!ln) continue;
    ln.owner.last = Math.max(ln.owner.last, e.t);
    if (info.backfill) { ln.waving = e.kind === 'done' && !e.parent; if (rec) { ln.disp = rec.over ? [] : rec.rolls.slice(); if (rec.over) ln.lastGame = rec.score; } continue; }
    if (e.parent) subEvent(ln, e);
    else {
      if (e.kind === 'done') { ln.waving = true; pingDone(ln); }
      else if (e.kind === 'tool' || e.kind === 'prompt') { ln.waving = false; dismissPing(ln.owner.id); }
    }
    if (rec) ln.queue.push(rec);
    if (e.kind === 'result' || e.kind === 'done') { const g = store.ag[lead]; if (g && ln.tag) ln.tag.draw(dotsOf(g.cyc)); }
  }
  if (info.backfill) {
    const parts = Object.entries(awayTally).map(([l, a]) => `${l} ${a.frames} frame${a.frames > 1 ? 's' : ''}${a.strikes ? ` (${a.strikes} X)` : ''}`);
    if (parts.length) toast('🎳 While you were away: ' + parts.slice(0, 4).join(', '), 7000);
    for (const ln of lanes) if (ln.owner && ln !== P && !ln.rival) { if (status(ln.disp).fresh) resetPins(ln); drawScreen(ln); const g = store.ag[ln.owner.id]; if (g && ln.tag) ln.tag.draw(dotsOf(g.cyc)); }
  }
  save(); hud(); submitBoard();
}
const dotsOf = c => Array.from({ length: CYCLE }, (_, i) => c.dots[i] || 0);
function subEvent(ln, e) {
  let s = ln.subs.get(e.agent);
  if (e.kind === 'end') { if (s) { s.leaving = 0; } return; }
  if (!s) {
    if (ln.subs.size >= 3) return;
    const k = ln.subs.size, m = makeBowler(ln.owner.color, (Math.random() * 1e6) | 0, 0.55);
    m.position.set(-0.72 + k * 0.3, 0, 2.25 + (k % 2) * 0.2); m.rotation.y = 0.3;
    ln.w.g.add(m); s = { mesh: m, hop: 0, leaving: -1, k }; ln.subs.set(e.agent, s);
  }
  if (e.kind === 'result' && e.ok) s.hop = Math.max(s.hop, 0.6);
}

// ---- "your agent is waiting for you"
function pingDone(ln) {
  const id = ln.owner.id; dismissPing(id);
  const d = document.createElement('button'); d.className = 'ping'; d.dataset.id = id;
  d.innerHTML = `<span style="background:${ln.owner.color}"></span>✋ <b>${esc(ln.owner.name)}</b> is waiting for you`;
  d.onclick = () => d.remove(); $('pings').prepend(d);
  while ($('pings').children.length > 4) $('pings').lastChild.remove();
  setTimeout(() => d.remove(), 45e3); snd.ping();
  popAt(ln, STANCE, 2.6, '✋ ready!', ln.owner.color, 22);
}
function dismissPing(id) { const d = $('pings').querySelector(`[data-id="${CSS.escape(id)}"]`); if (d) d.remove(); }

// ================================================================== bowling animation (shared by agents and the player)
function startRoll(ln, rec) {
  ln.rec = rec; ln.big = null; ln.waving = false;
  if (rec.fresh && ln.rack !== 1023) { ln.sweepReset = true; ln.phase = 'sweep'; ln.pt = 0; ln.afterSweep = 'approach'; return; }
  if (!rec.fresh && bits(ln.rack) !== rec.standing) resetPins(ln, 1023 & ~pickFall(1023, 10 - rec.standing, Math.random));
  ln.phase = 'approach'; ln.pt = 0;
}
function release(ln) {
  const rec = ln.rec, R = rng(rec.seed || Date.now());
  const pins = makeRack(ln.rack);
  if (ln === P) ln.deck = new Deck(pins, rec.ball);
  else { const fall = pickFall(ln.rack, rec.pins, R); ln.deck = new Deck(pins, scriptBall(ln.rack, fall, R), { fall, R }); ln.deck.ball.x += 0; }
  ln.deck.ball.z = 0.25;
  ln.pv.forEach(v => { v.started = false; v.pit = false; });
  ln.phase = 'rolling'; ln.pt = 0; ln.ballState = 'lane'; ln.sparkle = rec.test;
  snd.roll(ln === P ? 1 : 0.35);
}
function settle(ln) {
  const rec = ln.rec, fell = ln.deck.fallen(), standingBefore = ln.rack, n = bits(fell);
  ln.rack = standingBefore & ~fell;
  const q = ln === P ? 1 : 0.35;
  let tag = rec.fresh ? (n === 10 ? 'strike' : n === 0 ? 'gutter' : 'open') : (ln.rack === 0 ? 'spare' : n === 0 ? 'gutter' : 'open');
  if (ln === P) { rec.pins = n; playerScored(rec, tag); }
  const split = rec.fresh && tag === 'open' && isSplit(ln.rack);
  const col = ln.owner ? ln.owner.color : '#fff', top = ln === P ? null : ln;
  if (tag === 'strike') {
    snd.strike(q); W.flash(ln === P ? 1 : 0.5);
    confetti(scene, new THREE.Vector3(ln.X, 0.6, -L - 0.3), ln === P ? 90 : 40);
    if (ln === P) { shake = 0.25; banner('STRIKE!', S.player.run >= 3 ? `${S.player.run} in a row` : ''); }
    else popAt(ln, -L * 0.45, 1.2, ln.rival ? `${rec.who} STRIKE!` : rec.test ? 'TEST STRIKE!' : 'STRIKE!', '#ffd23f', 30);
    ln.big = { text: 'STRIKE!', color: '#ffd23f' };
    for (const s of ln.subs.values()) s.hop = 1;
  } else if (tag === 'spare') {
    snd.spare(q); burst(scene, new THREE.Vector3(ln.X, 0.5, -L - 0.3), ['#7dff8a', '#ffffff'], ln === P ? 40 : 20, { speed: 0.08, up: 0.1, size: 0.5 });
    if (ln === P) banner('SPARE!', '', '#7dff8a'); else popAt(ln, -L * 0.45, 1.2, 'SPARE!', '#7dff8a', 26);
    ln.big = { text: 'SPARE', color: '#7dff8a' };
    for (const s of ln.subs.values()) s.hop = 0.7;
  } else if (tag === 'gutter') {
    snd.gutter(q); if (ln === P) banner(rec.fresh ? 'GUTTER BALL' : 'MISS', '', '#ff8a8a'); else popAt(ln, -L * 0.3, 1, rec.fresh ? 'GUTTER' : 'MISS', '#ff8a8a', 22);
    ln.big = { text: rec.fresh ? 'GUTTER' : 'MISS', color: '#ff8a8a' };
  } else {
    if (split) { if (ln === P) banner('SPLIT!', `${n} pins`, '#ff9d3a'); else popAt(ln, -L * 0.45, 1.1, 'SPLIT!', '#ff9d3a', 24); ln.big = { text: 'SPLIT ' + n, color: '#ff9d3a' }; }
    else { if (ln === P) banner(String(n), n === 1 ? 'pin' : 'pins', '#ffffff'); else popAt(ln, -L * 0.4, 1, String(n), '#fff', 24); ln.big = { text: n + (n === 1 ? ' PIN' : ' PINS'), color: '#fff' }; }
  }
  if (ln !== P) {
    if (rec.commit) turkeyBonus(ln);
    if (rec.deploy) perfectFrame(ln, rec);
    ln.disp = rec.rolls.slice();
    if (ln.rival) rivalSettled(ln, rec, tag, n);
    if (rec.over) { ln.lastGame = rec.score; ln.big = { text: 'GAME ' + rec.score, color: '#ffd23f' }; popAt(ln, -4, 2, `${ln.owner.name}: ${rec.score}`, ln.owner.color, 24); }
  }
  ln.reaction = tag; drawScreen(ln);
  ln.phase = 'react'; ln.pt = 0; ln.sparkle = false;
}

// ---- big moments
const turkeys = [];
function turkeyBonus(ln) {
  const t = makeTurkey(); t.position.set(ln.X + 0.25, 0, 0.9); t.rotation.y = Math.PI; scene.add(t); turkeys.push({ m: t, t: 0, ln });
  snd.gobble(); popAt(ln, 0.9, 1.3, 'TURKEY BONUS +5', '#ff9d3a', 22);
  if (ln.tag) ln.tag.draw(dotsOf(freshCyc()));
}
const rockets = [];
function perfectFrame(ln, rec) {
  for (let k = 0; k < 4; k++) rockets.push({ x: ln.X + (k - 1.5) * 0.4, y: 0.2, z: -L + 1.5 - k * 0.5, vy: 0.11 + k * 0.012, ln, delay: k * 14, c: COLORS[(k * 3) % COLORS.length] });
  popAt(ln, -6, 2.2, 'PERFECT FRAME! +10', '#7de8ff', 26); W.flash(0.8);
  if (ln.rival && RV) banner('PERFECT FRAME', `${RV.flag} ${RV.name}'s ${rec && rec.who || 'agent'} deployed`, '#7de8ff');
  else if (!A.demo || ln === P) banner('PERFECT FRAME', `${ln.owner ? ln.owner.name : ''} deployed`, '#7de8ff');
}

// ---- per-frame lane update
const SUB = 4;
function poseIdle(b, t, ln) {
  b.armR.rotation.set(0, 0, 0); b.armL.rotation.set(0, 0, 0); b.legL.rotation.x = b.legR.rotation.x = 0; b.body.position.y = 0.95;
  if (ln.waving) { b.armR.rotation.z = 2.6 + Math.sin(t * 9) * 0.35; b.rotation.y = lerp(b.rotation.y, Math.PI * 0.85, 0.1); }
  else { b.armR.rotation.x = -0.9; b.armR.rotation.z = 0.15; b.rotation.y = lerp(b.rotation.y, 0, 0.15); b.body.position.y = 0.95 + Math.sin(t * 2 + ln.i) * 0.01; }
}
function updateLane(ln, dt, t) {
  const b = ln.bowler, w = ln.w, ball = w.ball, sec = dt / 60;
  ln.pt += sec;
  if (ln !== P && ln.owner && ln.phase === 'idle') {
    while (ln.queue.length > 2) { const r = ln.queue.shift(); ln.disp = r.rolls.slice(); if (r.over) { ln.lastGame = r.score; } if (r.commit || r.deploy) { if (r.deploy) perfectFrame(ln, r); } drawScreen(ln); }
    if (ln.queue.length) (ln.rival ? rivalStart : startRoll)(ln, ln.queue.shift());
  }
  // bowler
  if (b) {
    const baseX = ln === P ? aimX - 0.25 : -0.28;
    if (ln.phase === 'idle' || ln.phase === 'ready') { b.position.x = lerp(b.position.x, baseX, 0.2); b.position.z = lerp(b.position.z, STANCE, 0.2); poseIdle(b, t, ln); }
    else if (ln.phase === 'approach') {
      const T = ln === P ? 0.55 : 0.9, u = Math.min(1, ln.pt / T);
      b.rotation.y = 0; b.position.z = lerp(STANCE, 0.42, u); b.position.x = baseX;
      b.run(t, 0.7); b.armR.rotation.z = 0.1;
      b.armR.rotation.x = u < 0.65 ? lerp(-0.9, -2.1, u / 0.65) : lerp(-2.1, 1.1, (u - 0.65) / 0.35);
      b.armL.rotation.z = -0.6;
      if (u >= 1) release(ln);
    } else if (ln.phase === 'rolling') {
      b.legL.rotation.x = 0.6; b.legR.rotation.x = -0.5; b.armR.rotation.x = lerp(b.armR.rotation.x, 1.9, 0.12); b.armL.rotation.z = -1.0; b.body.position.y = 0.9;
    } else if (ln.phase === 'react') {
      const r = ln.reaction, k = ln.pt;
      b.legL.rotation.x = b.legR.rotation.x = 0; b.body.position.y = 0.95;
      if (r === 'strike') { b.position.y = Math.abs(Math.sin(k * 9)) * 0.28; b.armR.rotation.set(0, 0, 2.7); b.armL.rotation.set(0, 0, -2.7); }
      else if (r === 'spare') { b.position.y = Math.abs(Math.sin(k * 7)) * 0.12; b.armR.rotation.set(0, 0, 2.2 + Math.sin(k * 16) * 0.3); b.armL.rotation.set(0, 0, 0); }
      else if (r === 'gutter') { b.position.y = 0; b.armR.rotation.set(-0.4, 0, 2.9); b.armL.rotation.set(-0.4, 0, -2.9); b.body.position.y = 0.9; }
      else { b.position.y = 0; b.armR.rotation.set(0, 0, 0.6 + Math.sin(k * 5) * 0.1); b.armL.rotation.set(0, 0, -0.6); }
    } else if (ln.phase === 'sweep' || ln.phase === 'return') {
      b.position.y = 0; b.armR.rotation.set(0, 0, 0); b.armL.rotation.set(0, 0, 0);
      if (b.position.z < STANCE - 0.05) { b.rotation.y = lerp(b.rotation.y, Math.PI, 0.2); b.position.z = Math.min(STANCE, b.position.z + 0.035 * dt); b.position.x = lerp(b.position.x, baseX, 0.1); b.run(t, 0.6); }
      else { b.rotation.y = lerp(b.rotation.y, 0, 0.2); b.legL.rotation.x = b.legR.rotation.x = 0; }
    }
  }
  // subagents: hop, cheer, leave
  for (const [id, s] of ln.subs) {
    const m = s.mesh;
    if (s.leaving >= 0) { s.leaving += sec; m.position.x += 0.04 * dt; m.rotation.y = -Math.PI / 2; m.run(t, 0.8); if (s.leaving > 1.5) { ln.w.g.remove(m); ln.subs.delete(id); } continue; }
    if (s.hop > 0) { s.hop -= sec; m.position.y = Math.abs(Math.sin(t * 10 + s.k)) * 0.18; m.armR.rotation.z = 2.6; m.armL.rotation.z = -2.6; }
    else { m.position.y = 0; m.armR.rotation.z = 0.2 + Math.sin(t * 3 + s.k) * 0.1; m.armL.rotation.z = -0.2; }
  }
  // the ball
  if (ln.phase === 'rolling' && ln.deck) {
    const d = ln.deck, h = sec / SUB; let z0 = d.ball.z;
    for (let k = 0; k < SUB; k++) d.step(h);
    for (const ev of d.events) { if (ev.type === 'pin') snd.crash(bits(d.fallen()), ln === P ? 1 : 0.3); }
    d.events.length = 0;
    if (!d.ball.gone) {
      ball.visible = true; ball.position.set(d.ball.x, d.ball.gutter ? BR - 0.08 : BR, d.ball.z); ball.rotation.x -= (d.ball.z - z0) / BR;
      if (ln.sparkle && Math.random() < 0.7) burst(scene, new THREE.Vector3(ln.X + d.ball.x, 0.12, d.ball.z), ['#ffd23f', '#ffffff', '#7dff8a'], 2, { speed: 0.01, up: 0.015, size: 0.35, gravity: 0.0005, shape: 'sphere' });
    } else ball.visible = false;
    if (d.done) settle(ln);
  } else if (ln.phase === 'react') {
    ball.visible = false;
    if (ln.pt > (ln === P ? 1.0 : 1.1)) {
      const st = ln === P ? status(S.game) : status(ln.rec.rolls);
      const over = ln === P ? playerOver : ln.rec.over;
      ln.sweepReset = over || st.fresh; ln.phase = 'sweep'; ln.pt = 0; ln.afterSweep = 'return';
    }
  } else if (ln.phase === 'sweep') {
    const u = ln.pt / 0.9, sw = w.sweep; sw.visible = true;
    if (u < 0.25) { sw.position.set(0, lerp(1.4, 0.1, u / 0.25), -L + 0.6); }
    else if (u < 0.65) {
      sw.position.set(0, 0.1, lerp(-L + 0.6, PIT, (u - 0.25) / 0.4));
      ln.pv.forEach((v, i) => {
        if (v.gone) return;
        if (ln.rack & (1 << i)) { if (ln.sweepReset && u > 0.3) v.gone = true; return; }   // standing pins get lifted out on a reset
        const pz = w.pins[i].userData.sz + v.z; if (pz > sw.position.z - 0.06) v.z = sw.position.z - 0.06 - w.pins[i].userData.sz;
        if (sw.position.z < PIT + 0.1) v.gone = true;
      });
    } else if (!ln.swept) {
      ln.swept = true;
      if (ln.sweepReset) resetPins(ln, 1023, true); else { ln.pv.forEach((v, i) => { if (!(ln.rack & (1 << i))) v.gone = true; }); ln.deck = null; }
    } else sw.position.set(0, lerp(0.1, 1.4, (u - 0.65) / 0.35), -L + 0.6);
    if (u >= 1) { sw.visible = false; ln.swept = false; ln.phase = ln.afterSweep || 'return'; ln.pt = 0; if (ln.phase === 'return') { ln.ballState = 'return'; } }
  } else if (ln.phase === 'return') {
    // the ball comes back up the return; a subagent hands it over if there is one
    const sub = [...ln.subs.values()].find(s => s.leaving < 0);
    const mouth = tmpV.set(PITCH / 2, 0.41, 1.05), rest = tmpV2.set(PITCH / 2, 0.41, 1.75);
    const u = ln.pt;
    ball.visible = true;
    if (u < 0.5) ball.position.lerpVectors(mouth, rest, u / 0.5);
    else if (b) {
      const hp = handPos(b, new THREE.Vector3()), k = Math.min(1, (u - 0.5) / 0.45);
      if (sub && k < 1) { const sp = sub.mesh.position; const mid = new THREE.Vector3(sp.x - 0.15, 1.0, sp.z - 0.1); ball.position.lerpVectors(k < 0.4 ? rest : mid, k < 0.4 ? mid : hp, k < 0.4 ? k / 0.4 : (k - 0.4) / 0.6); ball.position.y += Math.sin(k * Math.PI) * 0.4; if (k > 0.3) sub.hop = Math.max(sub.hop, 0.2); }
      else ball.position.lerpVectors(rest, hp, k);
    }
    if (u > 1.0) { ln.phase = ln === P ? 'ready' : 'idle'; ln.pt = 0; ln.ballState = 'hand'; ln.big = null; if (ln === P && playerOver) endGame(); drawScreen(ln); }
  } else if (b && (ln.phase === 'idle' || ln.phase === 'ready' || ln.phase === 'approach')) {
    ball.visible = true; handPos(b, ball.position); ball.position.y = Math.max(ball.position.y, BR);
  } else if (!b) {
    ball.visible = true; ball.position.set(PITCH / 2, 0.41, 1.75);
  }
  // the pinsetter drops new pins in with a bounce
  ln.pv.forEach(v => { if (!v.started && v.y > 0 && !v.vy) v.vy = -0.01; });
  drawPins(ln, dt);
}

// ================================================================== the player
let aimX = 0.06, playerOver = false, newTrophies = [];
P.owner = { id: '★', label: 'YOU', name: 'YOU', color: '#ffd23f', seed: 3, last: Infinity };
setOwner(P, P.owner); P.phase = 'ready'; P.disp = S.game.slice();
{ const st = status(S.game); if (st.over) { S.game = []; P.disp = []; } else if (!st.fresh) resetPins(P, 1023 & ~pickFall(1023, 10 - st.standing, Math.random)); }
drawScreen(P);
const guide = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 3.2), new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.55, depthWrite: false }));
guide.rotation.x = -Math.PI / 2; guide.position.set(0, 0.006, -1.4); P.w.g.add(guide);
const chevrons = [];
for (let k = 0; k < 4; k++) { const c = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0.1), new THREE.Vector2(-0.07, -0.03), new THREE.Vector2(0, 0.02), new THREE.Vector2(0.07, -0.03)])), guide.material); c.rotation.x = -Math.PI / 2; P.w.g.add(c); chevrons.push(c); }

function playerThrow(slope, power, spin) {
  if (P.phase !== 'ready' || panelOpen()) return;
  const st = status(S.game);
  const ball = throwBall(aimX, slope, power, spin);
  startRoll(P, { fresh: st.fresh, standing: st.standing, ball, seed: Date.now() });
  $('hint').classList.add('gone'); markPlayDay();
  const hook = Math.round(Math.abs(spin) * 100);
  $('meter').innerHTML = `POWER <b>${Math.round(power * 100)}</b>${hook > 8 ? ` · HOOK <b>${spin < 0 ? '◀' : '▶'} ${hook}</b>` : ''}`; $('meter').classList.add('show'); setTimeout(() => $('meter').classList.remove('show'), 1800);
}
function playerScored(rec, tag) {
  const st = status(S.game);
  // the deck decides the pins; a ball after a "fresh" status always starts a new rack
  S.game.push(rec.pins);
  P.disp = S.game.slice();
  const p = S.player;
  if (tag === 'strike') { p.strikes++; p.run = (p.run || 0) + 1; award('strike1'); if (p.run >= 3) award('turkey'); }
  else if (st.fresh) p.run = 0;
  if (tag === 'spare') { p.spares++; if (p.spares >= 5) award('spares5'); }
  const after = status(S.game);
  playerOver = after.over;
  save(); hud();
}
function markPlayDay() { const d = todayKey(); if (!S.playDays.includes(d)) { S.playDays.push(d); S.playDays = S.playDays.slice(-60); if (S.playDays.length >= 3) award('regular'); save(); } }
function endGame() {
  const score = total(S.game), p = S.player, fr = frames(S.game);
  p.games++; p.pins += score; const best = score > p.high; p.high = Math.max(p.high, score);
  const row = rowOf(S.week.rows, '★', 'YOU'); row.games++; row.pins += score; row.high = Math.max(row.high, score); row.pts += Math.round(score / 10);
  const d = S.days[todayKey()] || (S.days[todayKey()] = { you: 0, games: 0, agents: {} }); d.you = Math.max(d.you, score); d.games++;
  if (score >= 100) award('s100'); if (score >= 150) award('s150'); if (score >= 200) award('s200');
  if (p.games >= 10) award('games10');
  if (fr.every(f => f.marks.includes('X') || f.marks.includes('/'))) award('clean');
  if (themeNow() === 'cosmic') award('nightOwl');
  const agentBest = Math.max(0, ...Object.values(A.demo ? T.best : d.agents));
  if (!A.demo && Object.keys(d.agents).length && score > agentBest) award('beatAgents');
  const lastRolls = S.game.slice();
  S.game = []; playerOver = false; P.lastGame = score; P.disp = [];
  save(); submitBoard(); showEnd(score, lastRolls, best); hud();
}

// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): before your first ball, until the first
// real touch, the bowler lines up by sliding left and right across the lane for about 3.5 s (no ball is thrown), then re-centres
const DM = demo(null, { ready: () => P.phase === 'ready' && !panelOpen() && !S.game.length, wait: 1500, ms: 3500 });
let demoWas = false, demoT0 = 0;
function demoAim() {
  if (DM.on) { if (!demoWas) { demoWas = true; demoT0 = performance.now(); } aimX = 0.06 + Math.sin((performance.now() - demoT0) / 1000 * 2.4) * 0.3; }
  else if (demoWas) { demoWas = false; if (!DM.touched) aimX = 0.06; }
}
// ---- input: drag sideways to line up, flick up to bowl (curve the flick to hook)
let gest = null;
const canvas = renderer.domElement;
function lanePx() { const a = new THREE.Vector3(-0.5, 0, 0.5).project(camera), b = new THREE.Vector3(0.5, 0, 0.5).project(camera); return Math.max(40, (b.x - a.x) * 0.5 * innerWidth); }
canvas.addEventListener('pointerdown', e => { if (panelOpen()) return; gest = { pts: [{ x: e.clientX, y: e.clientY, t: performance.now() }], mode: null, ax: aimX }; canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => {
  if (!gest) return; const p0 = gest.pts[0], dx = e.clientX - p0.x, dy = e.clientY - p0.y;
  gest.pts.push({ x: e.clientX, y: e.clientY, t: performance.now() });
  if (!gest.mode) { if (dy < -22 && Math.abs(dy) > Math.abs(dx) * 0.8) gest.mode = 'throw'; else if (Math.abs(dx) > 10) gest.mode = 'aim'; }
  if (gest.mode === 'aim' && P.phase === 'ready') aimX = clamp(gest.ax + dx / lanePx(), -0.42, 0.42);
});
canvas.addEventListener('pointerup', e => {
  if (!gest) return; const g = gest; gest = null;
  if (g.mode !== 'throw') return;
  const pts = g.pts, a = pts[0], z = pts[pts.length - 1], cdx = z.x - a.x, cdy = z.y - a.y, len = Math.hypot(cdx, cdy);
  if (cdy > -40) return;
  // speed of the last part of the flick
  let k = pts.length - 1; while (k > 0 && z.t - pts[k].t < 110) k--;
  const sp = Math.hypot(z.x - pts[k].x, z.y - pts[k].y) / Math.max(16, z.t - pts[k].t);
  const power = clamp((sp - 0.35) / 2.2, 0, 1);
  // bow of the path: positive = bulges to the right of the straight chord
  let bow = 0; for (const p of pts) { const c = ((p.x - a.x) * cdy - (p.y - a.y) * cdx) / len; if (Math.abs(c) > Math.abs(bow)) bow = c; }
  const curv = clamp(-bow / len, -0.35, 0.35);
  const spin = clamp(-curv * 3.2, -1, 1), slope = clamp(cdx / -cdy, -0.6, 0.6) * 0.05 + curv * 0.05;
  playerThrow(slope, power, spin);
});
addEventListener('keydown', e => {
  if (panelOpen()) { if (e.key === 'Escape') closePanels(); return; }
  if (e.key === 'ArrowLeft') aimX = clamp(aimX - 0.03, -0.42, 0.42);
  if (e.key === 'ArrowRight') aimX = clamp(aimX + 0.03, -0.42, 0.42);
  if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); playerThrow(-aimX * 0.012 + 0.006, 0.75, -0.45); }
});

// ================================================================== trophies + unlocks
const TROPHIES = [
  { id: 'strike1', ic: '🎳', name: 'First Strike', desc: 'Bowl your first strike.', ball: 'cherry' },
  { id: 'spares5', ic: '🧹', name: 'Spare Parts', desc: 'Pick up 5 spares.', ball: 'mint' },
  { id: 'turkey', ic: '🦃', name: 'Turkey Shoot', desc: 'Three strikes in a row.', ball: 'galaxy' },
  { id: 's100', ic: '💯', name: '100 Club', desc: 'Score 100 in a game.', theme: 'candy' },
  { id: 's150', ic: '🥉', name: '150 Club', desc: 'Score 150 in a game.', ball: 'aqua' },
  { id: 's200', ic: '🥇', name: '200 Club', desc: 'Score 200 in a game.', ball: 'gold' },
  { id: 'clean', ic: '✨', name: 'Clean Game', desc: 'A game with no open frames.', theme: 'retro' },
  { id: 'nightOwl', ic: '🌙', name: 'Night Owl', desc: 'Finish a game on cosmic night lanes (after 7 pm).', theme: 'cosmic' },
  { id: 'beatAgents', ic: '🧑‍🏫', name: 'Coach Beats the Team', desc: "Beat every agent's best game of the day.", ball: 'ember' },
  { id: 'agentStrikes', ic: '⚡', name: 'Strike Factory', desc: 'Your agents bowl 10 strikes.' },
  { id: 'agentTurkey', ic: '🤖', name: 'Robo Turkey', desc: 'An agent bowls three strikes in a row.' },
  { id: 'testBall', ic: '🧪', name: 'Green Suite', desc: 'Passing tests give your agents 5 strike balls.' },
  { id: 'perfectFrame', ic: '🎆', name: 'Ship It', desc: 'A deploy lights up a perfect frame.', ball: 'confetti' },
  { id: 'games10', ic: '🏅', name: 'League Regular', desc: 'Finish 10 games.' },
  { id: 'regular', ic: '📅', name: 'Bowling Night', desc: 'Bowl on 3 different days.' },
  { id: 'champ', ic: '🏆', name: 'League Champion', desc: 'Finish a week top of your league.' },
];
function award(id) {
  if (S.trophies[id]) return; const tr = TROPHIES.find(x => x.id === id); if (!tr) return;
  S.trophies[id] = Date.now();
  let extra = '';
  if (tr.ball) { S.balls[tr.ball] = 1; extra = ` · new ball: ${BALLS[tr.ball].name}`; }
  if (tr.theme) { S.themes[tr.theme] = 1; extra = ` · new lanes: ${THEMES[tr.theme].name}`; }
  newTrophies.push(tr); toast(`${tr.ic} Trophy: ${tr.name}${extra}`, 5000); save();
}

// ================================================================== HUD
function hud() {
  const st = status(S.game);
  // the player's scorecard
  const fr = frames(S.game);
  $('sheet').innerHTML = `<div class="who"><i style="background:#ffd23f"></i>YOU</div>` + fr.map((f, i) => `<div class="fr ${i === st.frame && !st.over ? 'cur' : ''}"><span class="n">${i + 1}</span><span class="m">${f.marks.map(m => `<em class="${m === 'X' ? 'x' : m === '/' ? 's' : ''}">${m || ''}</em>`).join('')}</span><span class="c">${f.cum ?? ''}</span></div>`).join('') + `<div class="tot"><span class="n">TOTAL</span><b>${runningTotal(S.game)}</b></div>`;
  // today strip
  const agentsOn = lanes.filter(l => l !== P && !l.rival && l.owner).length;
  $('today').innerHTML = `<span title="Agents on the lanes">🎳 <b>${agentsOn}</b> bowling</span><span title="Agent frames today">🧾 <b>${T.frames}</b> frame${T.frames === 1 ? '' : 's'}</span><span title="Agent strikes today">⚡ <b>${T.strikes}</b> X</span><span title="Tests passed today">🧪 <b>${T.tests}</b></span><span title="Commits today">🦃 <b>${T.commits}</b></span><span title="Deploys today">🎆 <b>${T.deploys}</b></span>`;
  const p = B && B.profile(), rank = (() => { try { return JSON.parse(localStorage.getItem('board_rank_' + GAME)); } catch (e) { return null; } })();
  $('bBoard').innerHTML = p && rank && !A.demo ? `🏆 ${flag(p.country)} #${rank}` : '🏆';
}
function updateIdle() {
  const none = !lanes.some(l => l !== P && !l.rival && l.owner);
  $('idle').hidden = !none;
}

// ---- panels
const panelOpen = () => !$('panel').hidden || !$('end').hidden || !A || !document.querySelector('.ag-card').hidden || !(document.querySelector('.bd-wrap') || { hidden: true }).hidden;
function closePanels() { $('panel').hidden = true; }
function standings(rows) {
  return Object.entries(rows).map(([key, r]) => ({ key, ...r, avg: r.games ? Math.round(r.pins / r.games) : 0 })).sort((a, b) => b.pts - a.pts || b.avg - a.avg);
}
function openLeague() {
  const store = AG(), rows = { ...store.week.rows, '★': S.week.rows['★'] || { name: 'YOU', pts: 0, games: 0, pins: 0, high: 0 } };
  const list = standings(rows), colorOf = name => (lanes.find(l => l.owner && l.owner.label === name) || {}).owner?.color || '#8e88a0';
  const allTime = Object.entries(store.bowlers).map(([n, b]) => ({ n, ...b, avg: b.games ? Math.round(b.pins / b.games) : 0 })).sort((a, b) => b.avg - a.avg);
  $('panel').innerHTML = `<header><h2>League · week of ${S.week.id.slice(5)}</h2><button class="x" data-close>✕</button></header>
    <p class="fine">Points: game score ÷ 10, +5 for every commit (turkey bonus), +10 for every deploy (perfect frame). ${A.demo ? 'Demo team scores are not saved.' : ''}</p>
    <table><tr><th>#</th><th>Bowler</th><th>Pts</th><th>Games</th><th>Avg</th><th>High</th></tr>
    ${list.map((r, i) => `<tr class="${r.key === '★' ? 'me' : ''}"><td>${i + 1}</td><td><i class="dot" style="background:${r.key === '★' ? '#ffd23f' : colorOf(r.name)}"></i>${esc(r.name)}</td><td><b>${r.pts}</b></td><td>${r.games}</td><td>${r.avg}</td><td>${r.high}</td></tr>`).join('')}</table>
    ${list.length < 2 ? '<p class="fine">Your agents join the league as soon as they finish a game (10 frames of task cycles).</p>' : ''}
    <h3>All time</h3>
    <table><tr><th>Bowler</th><th>Games</th><th>Avg</th><th>High</th><th>X</th></tr>
    <tr class="me"><td><i class="dot" style="background:#ffd23f"></i>YOU</td><td>${S.player.games}</td><td>${S.player.games ? Math.round(S.player.pins / S.player.games) : 0}</td><td>${S.player.high}</td><td>${S.player.strikes}</td></tr>
    ${allTime.slice(0, 12).map(b => `<tr><td><i class="dot" style="background:${colorOf(b.n)}"></i>${esc(b.n)}</td><td>${b.games}</td><td>${b.avg}</td><td>${b.high}</td><td>${b.strikes}</td></tr>`).join('')}</table>
    ${S.lastWeek ? `<p class="fine">Last week: ${S.lastWeek.top.map((r, i) => `${['🥇', '🥈', '🥉'][i]} ${esc(r.name)} ${r.pts}`).join(' · ')}</p>` : ''}`;
  $('panel').hidden = false;
}
function openLocker() {
  const sel = S.sel;
  $('panel').innerHTML = `<header><h2>Locker</h2><button class="x" data-close>✕</button></header>
    <h3>Balls</h3><div class="grid">${Object.entries(BALLS).map(([k, b]) => { const own = S.balls[k], tr = TROPHIES.find(t => t.ball === k); return `<button class="item ${sel.ball === k ? 'on' : ''}" data-ball="${k}" ${own ? '' : 'disabled'}><span class="sw" style="background:${ballSwatch(k)}"></span><b>${b.name}</b><small>${own ? (sel.ball === k ? 'in hand' : 'tap to use') : '🔒 ' + (tr ? tr.name : '')}</small></button>`; }).join('')}</div>
    <h3>Lanes</h3><div class="grid">${[['auto', '🕖 By the clock', 'Classic by day, cosmic after 7 pm']].concat(Object.entries(THEMES).map(([k, t]) => [k, t.name, ''])).map(([k, name, about]) => { const own = S.themes[k], tr = TROPHIES.find(t => t.theme === k); return `<button class="item ${sel.theme === k ? 'on' : ''}" data-theme="${k}" ${own ? '' : 'disabled'}><span class="sw" style="background:${k === 'auto' ? 'linear-gradient(90deg,#e9c48f 50%,#2a1257 50%)' : `linear-gradient(135deg,${THEMES[k].wood[0]},${THEMES[k].bg})`}"></span><b>${name}</b><small>${own ? about || (sel.theme === k ? 'on' : 'tap to use') : '🔒 ' + (tr ? tr.name : '')}</small></button>`; }).join('')}</div>
    <h3>Trophies <small>${Object.keys(S.trophies).length}/${TROPHIES.length}</small></h3>
    <div class="trophies">${TROPHIES.map(t => `<div class="tr ${S.trophies[t.id] ? 'got' : ''}"><span>${t.ic}</span><b>${t.name}</b><small>${t.desc}${t.ball ? ` Unlocks ${BALLS[t.ball].name}.` : t.theme ? ` Unlocks ${THEMES[t.theme].name}.` : ''}</small></div>`).join('')}</div>`;
  $('panel').hidden = false;
}
$('panel').addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.close !== undefined) return closePanels();
  if (t.dataset.ball) { S.sel.ball = t.dataset.ball; P.w.ball.material = ballMaterial(S.sel.ball); save(); openLocker(); }
  if (t.dataset.theme) { S.sel.theme = t.dataset.theme; W.setTheme(themeNow()); save(); openLocker(); }
});
$('bLeague').onclick = openLeague; $('bLocker').onclick = openLocker;
$('bConnect').onclick = () => A.open();
$('bShare').onclick = () => share();
$('bBoard').onclick = () => B.open();
for (const el of ['top', 'panel', 'end', 'pings', 'sheetWrap']) $(el).addEventListener('pointerdown', e => e.stopPropagation());

function showEnd(score, rolls, best) {
  const agentScores = Object.entries(A.demo ? T.best : (S.days[todayKey()] || { agents: {} }).agents).sort((a, b) => b[1] - a[1]);
  const p = B.profile(); let rank = null; try { rank = JSON.parse(localStorage.getItem('board_rank_' + GAME)); } catch (e) {}
  const wk = standings({ ...AG().week.rows, '★': S.week.rows['★'] }), pos = wk.findIndex(r => r.key === '★') + 1;
  $('end').innerHTML = `<h2>GAME OVER</h2><div class="score">${score}</div>${best ? '<p class="nb">NEW PERSONAL BEST</p>' : ''}
    ${p && rank && !A.demo ? `<p class="flagrank">${flag(p.country)} #${rank} today on the world board</p>` : ''}
    <p>League this week: <b>#${pos}</b> of ${wk.length}</p>
    ${agentScores.length ? `<div class="vs">${agentScores.slice(0, 5).map(([l, s]) => `<span class="${score > s ? 'win' : 'lose'}">${score > s ? 'beat' : 'lost to'} <b>${esc(l)}</b> ${s}</span>`).join('')}</div>` : '<p class="fine">None of your agents finished a game today yet.</p>'}
    ${newTrophies.length ? `<div class="newt">${newTrophies.map(t => `<span>${t.ic} ${t.name}</span>`).join('')}</div>` : ''}
    <div class="btns"><button class="big" id="eAgain">Bowl again</button><button id="eShare">Share</button><button id="eBoard">🏆 World board</button></div>`;
  newTrophies = [];
  $('end').hidden = false;
  $('eAgain').onclick = () => { $('end').hidden = true; resetPins(P); drawScreen(P); hud(); };
  $('eShare').onclick = () => share(score);
  $('eBoard').onclick = () => B.open();
  snd.strike(0.8); confetti(scene, new THREE.Vector3(0, 1.5, -2), 80);
}

// ---- world board: daily score = your best game today + your best agent's game today
let boardBest = 0;
function teamScore() { const d = S.days[todayKey()]; if (!d) return 0; return (d.you || 0) + Math.max(0, ...Object.values(d.agents || {})); }
function submitBoard() { if (!B || A.demo) return; const s = teamScore(); if (s > boardBest) { boardBest = s; B.submit(s); } }

// ---- share card (1200 x 630)
function makeCard(lastScore) {
  W.render(camera);
  const src = renderer.domElement, out = document.createElement('canvas'); out.width = 1200; out.height = 630;
  const o = out.getContext('2d');
  const g = o.createLinearGradient(0, 0, 1200, 630); g.addColorStop(0, '#1a1030'); g.addColorStop(1, '#3a1450'); o.fillStyle = g; o.fillRect(0, 0, 1200, 630);
  const sw = src.width, sh = src.height, tw = 720, th = 630, k = Math.max(tw / sw, th / sh);
  o.save(); o.beginPath(); o.rect(0, 0, tw, th); o.clip(); o.drawImage(src, (tw - sw * k) / 2, (th - sh * k) / 2, sw * k, sh * k); o.restore();
  o.fillStyle = 'rgba(0,0,0,.25)'; o.fillRect(tw - 4, 0, 4, 630);
  const F = s => `${s}px Bungee, 'Baloo 2', sans-serif`;
  o.fillStyle = '#ffd23f'; o.font = F(46); o.fillText('PIN PALS', 760, 78);
  o.fillStyle = '#f6f0e3'; o.font = F(20); o.fillText('MY AGENTS TODAY', 760, 116);
  const lines = [['Frames bowled', T.frames], ['Strikes', T.strikes], ['Spares', T.spares], ['Tests passed', T.tests], ['Commits (turkey bonus)', T.commits], ['Deploys (perfect frames)', T.deploys]];
  o.font = F(22); lines.forEach(([a, b], i) => { o.fillStyle = 'rgba(255,255,255,.75)'; o.font = "600 22px 'Baloo 2', system-ui, sans-serif"; o.fillText(a, 760, 170 + i * 44); o.fillStyle = '#fff'; o.font = F(26); o.textAlign = 'right'; o.fillText(String(b), 1160, 172 + i * 44); o.textAlign = 'left'; });
  const best = Object.entries(T.best).sort((a, b) => b[1] - a[1])[0];
  const d = S.days[todayKey()], mine = lastScore || (d && d.you) || 0;
  o.fillStyle = '#ffd23f'; o.font = F(24);
  o.fillText(mine ? `MY BEST GAME: ${mine}` : 'MY AGENTS BOWL FOR ME', 760, 464);
  if (best) { o.fillStyle = '#7de8ff'; o.font = F(18); o.fillText(`TOP AGENT GAME: ${best[1]}`, 760, 498); }
  const p = B.profile(); let rank = null; try { rank = JSON.parse(localStorage.getItem('board_rank_' + GAME)); } catch (e) {}
  if (p && !A.demo) { o.fillStyle = '#fff'; o.font = "700 30px system-ui, sans-serif"; o.fillText(`${flag(p.country)} ${p.name}${rank ? '  #' + rank + ' today' : ''}`, 760, 552); }
  o.fillStyle = 'rgba(255,255,255,.55)'; o.font = "600 18px 'Baloo 2', system-ui, sans-serif"; o.fillText('agentpark.co · bowling league for your AI agents', 760, 600);
  return out;
}
async function share(lastScore) {
  const out = makeCard(lastScore);
  const blob = await new Promise(res => out.toBlob(res, 'image/png'));
  const file = new File([blob], 'pin-pals.png', { type: 'image/png' });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) return await navigator.share({ files: [file], title: 'My AI agents bowled today', text: 'My AI agents bowled today on Pin Pals', url: location.href.split('?')[0] }); } catch (e) { return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'pin-pals.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ================================================================== camera
const cam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), tp: new THREE.Vector3(), tl: new THREE.Vector3() };
function baseCam() {
  const a = innerWidth / innerHeight;
  if (a < 0.8) { cam.tp.set(0, 4.2, 8.2); cam.tl.set(0, 0.2, -5.6); camera.fov = 60; }
  else { cam.tp.set(0, 3.2, 7.4); cam.tl.set(0, 0.0, -5.6); camera.fov = 46; }
  camera.updateProjectionMatrix();
  for (const ln of W.lanes) ln.screen.position.y = a < 0.8 ? 3.1 : 2.55;
}
baseCam(); cam.pos.copy(cam.tp); cam.look.copy(cam.tl);
addEventListener('resize', () => { baseCam(); });

// ================================================================== the rival's team, live (duels)
// In a live duel lane 2, right next to yours, belongs to the rival. Their agents are a real team on the bench there,
// each with its callsign tag, in the rival's colour (silver robots + "simulated" for the house bot). Every finished
// step one of their agents makes is one ball by that agent: tests / commits / deploys are big strike chances, a failure
// is a gutter or a miss. Their team game sits on the lane screen and on a second row of the score sheet, under yours.
const SIM_COL = '#dfe4ec', RV_MAX = 5, RL = lanes[1];
let RV = null, rvKey = '', rvRolls = [], rvLast = null, rvFeed = null, rvIdleT = 0, rvPins = { me: 0, them: 0 };
const bench = new Map();                        // k -> { mesh, tag, a, i }
const robotMat = new THREE.MeshStandardMaterial({ color: '#cfd5df', metalness: 0.55, roughness: 0.28 });
function makeRivalBowler(color, seed, sim) {
  const b = makeBowler(color, seed, 0.8);
  if (sim) {
    b.traverse(o => { if (o.isMesh) o.material = robotMat; });
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22), robotMat); ant.position.y = 1.78; b.add(ant);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), new THREE.MeshBasicMaterial({ color: '#ff5d6d' })); bulb.position.y = 1.9; b.add(bulb);
  }
  return b;
}
function rivalTag(color) {
  const c = document.createElement('canvas'); c.width = 360; c.height = 128; const x = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  spr.scale.set(0.9, 0.32, 1); spr.renderOrder = 11;
  const dark = (() => { const n = parseInt(color.slice(1), 16); return ((n >> 16 & 255) * 0.299 + (n >> 8 & 255) * 0.587 + (n & 255) * 0.114) / 255 > 0.6; })();
  spr.draw = (name, sub, icon = '') => {
    x.clearRect(0, 0, 360, 128);
    const F = "'Bungee', 'Baloo 2', system-ui, sans-serif", t = (icon ? icon + ' ' : '') + name;
    x.font = `34px ${F}`; let w = x.measureText(t).width + 44; x.font = "800 26px 'Baloo 2', system-ui, sans-serif"; w = Math.min(350, Math.max(w, x.measureText(sub).width + 30));
    x.fillStyle = 'rgba(15,10,30,.88)'; x.beginPath(); x.roundRect(180 - w / 2, 4, w, 112, 22); x.fill();
    x.fillStyle = color; x.beginPath(); x.roundRect(180 - w / 2 + 5, 9, w - 10, 56, 18); x.fill();
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = `34px ${F}`; x.fillStyle = dark ? '#1a1030' : '#ffffff'; x.fillText(t, 180, 39, w - 24);
    x.font = "800 26px 'Baloo 2', system-ui, sans-serif"; x.fillStyle = '#f6f0e3'; x.fillText(sub, 180, 92, w - 20);
    tex.needsUpdate = true;
  };
  return spr;
}
const rvCol = () => RV && (RV.sim ? SIM_COL : RV.color);
function rvStatus(short) {
  if (!RV) return '';
  const ags = RV.agents || [], w = ags.filter(a => a.state === 'working').length, wt = ags.filter(a => a.state === 'waiting').length;
  if (RV.sim) return short ? 'simulated rival' : `${ags.length} agents · simulated rival`;
  if (!RV.online) return short ? 'offline' : '😴 offline · slow default play';
  return short ? `${w} of ${ags.length} working` : `🟢 ${w} of ${ags.length} working${wt ? ` · ✋ ${wt} waiting` : ''}`;
}
function clearRival() {
  for (const b of bench.values()) RL.w.g.remove(b.mesh); bench.clear();
  RL.bowler = null; RL.rival = false; RV = null; rvKey = ''; rvFeed = null;
  freeLane(RL); $('duel').hidden = true; $('rsheet').hidden = true; hud();
}
function syncRival() {
  const r = B && B.rival();
  if (!r) { if (RV) clearRival(); return; }
  const col = r.sim ? SIM_COL : r.color, fresh = rvKey !== r.key;
  if (fresh) {
    if (RV || RL.rival) { for (const b of bench.values()) RL.w.g.remove(b.mesh); bench.clear(); }
    if (RL.owner && !RL.rival) freeLane(RL);       // one of your agents had this lane: it moves over on its next step
    rvKey = r.key; rvRolls = []; rvLast = null; rvPins = { me: 0, them: 0 };
    RL.rival = true;
    setOwner(RL, { id: '⚔', label: r.name, name: `${r.flag} ${r.name.toUpperCase()}'S TEAM`, color: col, seed: 7, last: Infinity });
    if (RL.bowler) RL.w.g.remove(RL.bowler); RL.bowler = null; RL.tag = null;
    RL.disp = []; resetPins(RL);
    toast(`⚔️ ${r.flag} ${r.name}'s team is on lane 2${r.sim ? ' (simulated rival)' : ''}. Every step their agents finish is a ball.`, 6000);
  }
  RV = r;
  let roster = (r.agents || []).slice(0, RV_MAX);
  if (!roster.length) roster = [{ k: '_crew', name: r.name.slice(0, 10), src: 'claude', state: 'idle' }];
  const keep = new Set(roster.map(a => a.k));
  for (const [k, b] of bench) if (!keep.has(k)) { RL.w.g.remove(b.mesh); if (RL.bowler === b.mesh) RL.bowler = null; bench.delete(k); }
  roster.forEach((a, i) => {
    let b = bench.get(a.k);
    if (!b) {
      const m = makeRivalBowler(col, [...a.k].reduce((h, c) => h * 31 + c.charCodeAt(0), 7) >>> 0, r.sim);
      const tag = rivalTag(col); m.add(tag);
      b = { mesh: m, tag, a, i, st: '' }; m.position.set(0, 0, 2.5); RL.w.g.add(m); bench.set(a.k, b);
    }
    b.a = a; b.i = i;
    const icon = !r.sim && !r.online ? '😴' : a.state === 'waiting' ? '✋' : '';
    const sub = `${r.flag} ${r.name.slice(0, 12)} · ${a.src === 'codex' ? 'Codex' : 'Claude'}${r.sim ? ' · sim' : ''}`;
    const st = a.name + icon + sub; if (st !== b.st) { b.st = st; b.tag.draw(a.name, sub, icon); }
  });
  RL.owner.name = `${r.flag} ${r.name.toUpperCase()}'S TEAM`; RL.owner.color = col;
  if (!RL.bowler && RL.phase === 'idle') { const f = bench.values().next().value; if (f) RL.bowler = f.mesh; }
  { const cur = [...bench.values()].find(b => b.mesh === RL.bowler); RL.waving = !!cur && cur.a.state === 'waiting' && RL.phase === 'idle'; }
  drawScreen(RL); duelHud();
}
// one rival event = one ball by that agent
function rvBall(e) {
  const st = status(rvRolls), R = Math.random, cat = e.cat || 'other', ok = !!e.ok, big = ok && (cat === 'test' || cat === 'commit' || cat === 'deploy');
  let pins;
  if (st.fresh) {
    if (!ok) pins = R() < 0.45 ? 0 : 1 + ((R() * 5) | 0);
    else if (big) pins = R() < ({ deploy: 0.95, test: 0.85, commit: 0.75 })[cat] ? 10 : 9;
    else pins = R() < 0.35 ? 10 : 7 + ((R() * 3) | 0);
  } else {
    const s = st.standing;
    if (!ok) pins = R() < 0.6 ? 0 : Math.min(s, 1);
    else if (big) pins = s;
    else pins = R() < 0.65 ? s : Math.max(0, s - 1 - ((R() * 2) | 0));
  }
  rvRolls.push(pins);
  const after = status(rvRolls), a = e.agent || {};
  const rec = { pins, fresh: st.fresh, standing: st.standing, test: ok && cat === 'test', commit: ok && cat === 'commit', deploy: ok && cat === 'deploy', cat, ok,
    rolls: rvRolls.slice(), over: after.over, score: after.over ? total(rvRolls) : null, seed: (Date.now() + R() * 1e6) | 0, k: a.k, who: a.name || 'Agent' };
  if (after.over) { rvLast = rec.score; rvRolls = []; }
  rvPins.them += pins;
  return rec;
}
const VERB = { test: 'passes tests', commit: 'commits', deploy: 'deploys', edit: 'edits', run: 'runs a step', read: 'reads code', web: 'searches', delegate: 'sends a helper' };
function onRivalEvents(list, r) {
  syncRival(); if (!RV) return;
  for (const e of list) {
    const rec = rvBall(e); rec.what = e.ok ? VERB[e.cat] || 'finishes a step' : 'hits an error';
    RL.queue.push(rec);
  }
  rvIdleT = 0; duelHud();
}
function rivalStart(ln, rec) {
  const b = bench.get(rec.k) || bench.values().next().value;
  if (!b) return startRoll(ln, rec);
  ln.bowler = b.mesh; ln.rvRec = rec; ln.phase = 'stepup'; ln.pt = 0; ln.waving = false;
  rvFeed = { t: Date.now(), ok: rec.ok, txt: `${RV.flag} ${RV.name}'s ${rec.who} ${rec.what}…` }; duelHud();
}
function rivalSettled(ln, rec, tag, n) {
  const res = tag === 'strike' ? 'STRIKE!' : tag === 'spare' ? 'spare!' : tag === 'gutter' ? (rec.fresh ? 'gutter ball' : 'misses') : `${n} pin${n === 1 ? '' : 's'}`;
  rvFeed = { t: Date.now(), ok: rec.ok && tag !== 'gutter', txt: `${RV ? RV.flag + ' ' + RV.name + "'s " : ''}${rec.who} ${rec.what}, ${res}` };
  if (tag === 'strike' || rec.deploy) popAt(ln, STANCE, 2.3, `${rec.who} ${rec.deploy ? '🚀' : rec.commit ? '📦' : rec.test ? '🧪' : ''}`, rvCol(), 20);
  if (rec.over) rvFeed.txt += ` · team game ${rec.score}`;
  duelHud(); hud();
}
function rivalUpdate(dt, t) {
  if (!RL.rival || !RV) return;
  const sec = dt / 60, n = bench.size, off = !RV.sim && !RV.online;
  // slow default play while they're offline, so their lane is never frozen
  rvIdleT += sec;
  if (off && rvIdleT > 22 && RL.phase === 'idle' && !RL.queue.length && n) {
    rvIdleT = 0; const b = [...bench.values()][(Math.random() * n) | 0];
    const rec = rvBall({ agent: { k: b.a.k, name: b.a.name }, cat: 'other', ok: Math.random() < 0.8 }); rec.what = 'bowls a lazy ball'; RL.queue.push(rec);
  }
  let k = 0;
  for (const b of bench.values()) {
    const m = b.mesh;
    // the thrower stands full size; the bench is a smaller row behind (like your own agents' helpers)
    const sc = lerp(m.scale.x, m === RL.bowler ? 0.86 : 0.6, 0.12); m.scale.setScalar(sc); b.tag.scale.set(0.9 * 0.8 / sc, 0.32 * 0.8 / sc, 1);
    if (m === RL.bowler && RL.phase !== 'idle' && RL.phase !== 'stepup') continue;   // the thrower is posed by updateLane
    if (m === RL.bowler && RL.phase === 'idle') { continue; }
    if (m === RL.bowler && RL.phase === 'stepup') {
      const u = Math.min(1, RL.pt / 0.75);
      m.position.x = lerp(m.position.x, -0.28, 0.16); m.position.z = lerp(m.position.z, STANCE, 0.16); m.position.y = 0;
      m.rotation.y = lerp(m.rotation.y, 0, 0.2); m.run(t, 0.6);
      RL.w.ball.visible = true; RL.w.ball.position.set(PITCH / 2, 0.41, 1.75);
      if (u >= 1) { m.position.set(-0.28, 0, STANCE); startRoll(RL, RL.rvRec); }
      continue;
    }
    // bench: a row behind the line, staggered so the tags don't cover each other
    const slots = Math.max(1, n - (RL.bowler ? 1 : 0)), i = k++;
    const tx = slots === 1 ? 0.35 : -0.72 + i * (1.44 / (slots - 1)), tz = 2.3 + (i % 2) * 0.28;
    const moving = Math.abs(m.position.x - tx) + Math.abs(m.position.z - tz) > 0.05;
    m.position.x = lerp(m.position.x, tx, 0.08); m.position.z = lerp(m.position.z, tz, 0.08);
    b.tag.position.y = 2.2 + (i % 2) * 0.5;
    m.armR.rotation.set(0, 0, 0); m.armL.rotation.set(0, 0, 0); m.legL.rotation.x = m.legR.rotation.x = 0; m.body.position.y = 0.95;
    if (moving) { m.run(t, 0.5); m.rotation.y = lerp(m.rotation.y, Math.PI, 0.15); }
    else if (off) { m.rotation.y = lerp(m.rotation.y, 0, 0.1); m.body.position.y = 0.86; m.armR.rotation.z = 0.15; m.armL.rotation.z = -0.15; m.position.y = 0; }
    else if (b.a.state === 'waiting') { m.rotation.y = lerp(m.rotation.y, Math.PI * 0.85, 0.1); m.armR.rotation.z = 2.6 + Math.sin(t * 9 + i) * 0.35; m.position.y = 0; }
    else {
      m.rotation.y = lerp(m.rotation.y, 0, 0.1);
      const cheer = RL.phase === 'react' && (RL.reaction === 'strike' || RL.reaction === 'spare');
      m.position.y = cheer ? Math.abs(Math.sin(t * 9 + i)) * 0.16 : 0;
      if (cheer) { m.armR.rotation.z = 2.6; m.armL.rotation.z = -2.6; } else m.body.position.y = 0.95 + Math.sin(t * 2 + i) * 0.012;
    }
  }
  if (RL.bowler) { const cur = [...bench.values()].find(b => b.mesh === RL.bowler); if (cur) cur.tag.position.y = 2.1; }
}
function duelHud() {
  const el = $('duel'), rs = $('rsheet');
  if (!RV) { el.hidden = true; rs.hidden = true; return; }
  const col = rvCol(), me = RV.myScore, th = RV.score, fd = rvFeed && Date.now() - rvFeed.t < 15e3 ? rvFeed : null;
  el.hidden = false; el.style.setProperty('--rc', col);
  el.innerHTML = `<div class="vs"><b class="${me >= th ? 'w' : ''}">YOU ${me}</b><span>⚔️ duel pts</span><b class="${th > me ? 'w' : ''}">${th} ${RV.flag} ${esc(RV.name)}</b></div>
    <div class="st">Lane 2 · ${esc(rvStatus(false))}</div><div class="fd ${fd && !fd.ok ? 'bad' : ''}">${fd ? esc(fd.txt) : RV.sim || RV.online ? 'their agents are warming up…' : 'waiting for them to come back online'}</div>`;
  const fr = frames(RL.disp), st = status(RL.disp);
  rs.hidden = false; rs.style.setProperty('--rc', col);
  rs.innerHTML = `<div class="who"><i style="background:${col}"></i>${RV.flag} ${esc(RV.name.slice(0, 9).toUpperCase())}${RV.sim ? '<small>sim</small>' : ''}</div>` + fr.map((f, i) => `<div class="fr ${i === st.frame && !st.over ? 'cur' : ''}"><span class="m">${f.marks.map(m => `<em class="${m === 'X' ? 'x' : m === '/' ? 's' : ''}">${m || ''}</em>`).join('')}</span><span class="c">${f.cum ?? ''}</span></div>`).join('') + `<div class="tot"><span class="n">${RV.flag} ${esc(RV.name.slice(0, 8))}</span><b>${runningTotal(RL.disp)}</b></div>`;
}
setInterval(syncRival, 1500);
setInterval(() => RV && duelHud(), 1000);

// ================================================================== loop
let lastSweepCheck = 0;
loop((dt, t) => {
  demoAim();
  for (const ln of lanes) updateLane(ln, dt, t);
  rivalUpdate(dt, t);
  // the player's aim guide
  const ready = P.phase === 'ready' && !panelOpen();
  guide.visible = ready; guide.position.x = aimX; chevrons.forEach((c, k) => { c.visible = ready; c.position.set(aimX, 0.007, -0.5 - ((k * 0.8 + t * 1.2) % 3.2)); });
  // camera follows the player's ball
  baseCam();
  if (P.phase === 'rolling' && P.deck && !P.deck.ball.gone) { const z = P.deck.ball.z, cz = Math.max(-L + 5, z + 4.6); cam.tp.set(aimX * 0.3, 2.9 + clamp(cz / 4, 0, 1) * 0.4, cz); cam.tl.set(P.deck.ball.x * 0.5, 0, Math.max(-L - 0.3, z - 4)); }
  else if (P.phase === 'rolling' || (P.phase === 'react' && P.pt < 0.7)) { cam.tp.set(0, 2.9, -L + 5.2); cam.tl.set(0, 0, -L - 0.3); }
  if (P.tag) P.tag.visible = P.phase === 'ready' || P.phase === 'idle';
  cam.pos.lerp(cam.tp, 0.06 * dt); cam.look.lerp(cam.tl, 0.08 * dt);
  camera.position.copy(cam.pos);
  if (shake > 0) { shake = Math.max(0, shake - 0.01 * dt); camera.position.x += (Math.random() - 0.5) * shake * 0.4; camera.position.y += (Math.random() - 0.5) * shake * 0.4; }
  camera.lookAt(cam.look);
  // turkeys + fireworks
  for (let i = turkeys.length - 1; i >= 0; i--) { const k = turkeys[i]; k.t += dt / 60; k.m.position.y = Math.abs(Math.sin(k.t * 8)) * 0.25 * Math.max(0, 1 - k.t / 2.5); k.m.rotation.y = Math.PI + Math.sin(k.t * 6) * 0.4; if (k.t > 1.8) k.m.position.x += 0.03 * dt; if (k.t > 3.2) { scene.remove(k.m); turkeys.splice(i, 1); } }
  for (let i = rockets.length - 1; i >= 0; i--) { const r = rockets[i]; if (r.delay > 0) { r.delay -= dt; continue; } r.y += r.vy * dt; r.vy -= 0.0025 * dt; if (Math.random() < 0.6) burst(scene, new THREE.Vector3(r.x, r.y, r.z), '#fff3b0', 1, { speed: 0.004, up: 0, size: 0.4, gravity: 0.001, shape: 'sphere' }); if (r.vy <= 0.01) { burst(scene, new THREE.Vector3(r.x, r.y, r.z), [r.c, '#ffffff', '#ffd23f'], 46, { speed: 0.09, up: 0.02, size: 0.55, gravity: 0.0015, shape: 'sphere' }); snd.pop(); rockets.splice(i, 1); } }
  // lanes go quiet after 30 min without events (real agents only)
  if (!A.demo && t - lastSweepCheck > 10) { lastSweepCheck = t; for (const ln of lanes) if (ln !== P && !ln.rival && ln.owner && Date.now() - ln.owner.last > LIVE && ln.phase === 'idle') freeLane(ln); }
  if (T.date !== todayKey()) { T = freshToday(); hud(); }
  W.update(dt, t);
  W.render(camera);
});

// ================================================================== connect
let wasDemo = null;
const A = agents({
  game: GAME, title: 'PIN PALS', tagline: 'A bowling league for your AI agents.', accent: '#ffd23f', demoAgents: 4,
  about: 'Every live Claude Code or Codex agent bowls on its own lane. Each task cycle is one ball: all tool calls OK is a strike, a few failures leave a split. Passing tests roll a guaranteed strike, commits earn a turkey bonus, deploys light a perfect frame. You bowl lane 1 against them.',
  onEvents(list, info) {
    if (wasDemo !== A.demo) { // switching demo <-> live: clear the lanes and the "today" numbers
      wasDemo = A.demo; D = null; T = freshToday();
      for (const ln of lanes) if (ln !== P && !ln.rival && ln.owner) freeLane(ln);
    }
    onEvents(list, info);
  },
  onConnect() { wasDemo = null; },
});
window.__A = A;
const B = board({ game: GAME, label: 'Team pins', A });
B.onRival(onRivalEvents);
window.__B = B;
window.__pp = { theme: () => W.themeKey, card: () => makeCard().toDataURL('image/png'), throw: (s, p, sp) => playerThrow(s, p, sp), aim: x => { aimX = x; }, state: () => ({ S, T, lanes: lanes.map(l => ({ owner: l.owner && l.owner.name, phase: l.phase, disp: l.disp, q: l.queue.length })) }) };
hud(); updateIdle();
document.fonts && document.fonts.ready.then(() => { lanes.forEach(drawScreen); W.themeKey = ''; W.setTheme(themeNow()); });
rollWeek(); save();
