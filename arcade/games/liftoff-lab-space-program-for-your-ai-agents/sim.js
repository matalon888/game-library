// Mission Control sim (pure, no DOM): one mission = rows of tokens flown bottom to top. Used by deep.js and by qa/bot.mjs.
// Row tokens: gN gate at x=N | rN rock | dN smashable debris (boost smashes it) | mN moving rock around N | cN fuel can |
// sN satellite | wN gravity well | fL/fR flare beam on that side | ~N wind (drift) | - empty. N in -4..4 (halves ok: 1.5).
export const LANE = 5, RS = 11, Y0 = 14, SPEED = 8, BOOST_SPEED = 15, BOOST_T = 0.9, STEER = 10, RR = 0.45;

export function parse(m) {
  const items = [], winds = [];
  m.rows.forEach((row, i) => {
    const y = Y0 + i * RS;
    for (const tk of row.trim().split(/\s+/)) {
      if (tk === '-') continue;
      if (tk[0] === '~') { winds.push({ y0: y - RS / 2, y1: y + RS / 2, w: +tk.slice(1) }); continue; }
      const k = tk[0], v = tk.slice(1);
      if (k === 'f') items.push({ k: 'f', y, side: v === 'L' ? -1 : 1, per: m.fper || 2.4, ph: (i % 2) * 0.5 + (v === 'L' ? 0 : 0.5), row: i });
      else {
        const x = +v;
        const it = { k, x, y, row: i };
        if (k === 'g') it.w = m.gw || 3.4;
        if (k === 'r') it.r = 0.85;
        if (k === 'd') it.r = 0.6;
        if (k === 'm') { it.r = 0.75; it.ax = x; it.amp = 2.2; it.per = 2.8 + (i % 3) * 0.4; it.ph = i * 0.37; }
        if (k === 'w') it.r = 0.55;
        items.push(it);
      }
    }
  });
  if (m.idx % 3 === 1 && !m.hard) { // golden ring: one narrow optional bonus ring, 2/3 of the way up (missing it costs nothing)
    const gs = items.filter(i => i.k === 'g'), gi = gs[Math.min(gs.length - 1, Math.floor(gs.length * 0.66))];
    if (gi) { gi.gold = 1; gi.w = Math.min(gi.w, 2.4); }
  }
  const len = Y0 + m.rows.length * RS + 4;
  return { items, winds, len, gates: items.filter(i => i.k === 'g' && !i.gold).length };
}

export function newRun(m) {
  const p = parse(m);
  return {
    m, p, t: 0, x: 0, y: 0, tx: 0, vx: 0, hull: 3, fuel: 3, boostT: 0, inv: 0, passed: 0, missed: 0, combo: 0, bestCombo: 0,
    sats: 0, hits: 0, smashed: 0, status: 'fly', why: '', ev: [], fuelUsed: 0, near: 0, done: new Set(), lastY: 0,
    sp: m.sp || 1,
  };
}

const itemPos = (it, t) => it.k === 'm' ? it.ax + Math.sin(t / it.per * 6.283 + it.ph) * it.amp : it.x;
export const flareOn = (it, t) => ((t / it.per + it.ph) % 1) < 0.5;
export const flareWarn = (it, t) => { const f = (t / it.per + it.ph) % 1; return f > 0.38 && f < 0.5 || f > 0.88; };
export { itemPos };

export function boost(r) {
  if (r.status !== 'fly' || r.fuel < 1 || r.boostT > 0) return false;
  r.fuel--; r.fuelUsed++; r.boostT = BOOST_T; r.ev.push({ e: 'boost' }); return true;
}

export function step(r, dt) {
  if (r.status !== 'fly') return;
  r.t += dt; r.ev.length = 0;
  const boosting = r.boostT > 0;
  const spd = (boosting ? BOOST_SPEED : SPEED) * r.sp;
  r.boostT = Math.max(0, r.boostT - dt); r.inv = Math.max(0, r.inv - dt);
  // lateral
  const steer = STEER * (boosting ? 0.7 : 1);
  const want = Math.max(-steer, Math.min(steer, (r.tx - r.x) * 14));
  let drift = 0;
  if (!boosting) for (const w of r.p.winds) if (r.y >= w.y0 && r.y < w.y1) drift += w.w;
  for (const it of r.p.items) if (it.k === 'w' && Math.abs(it.y - r.y) < 3.6) {
    const dx = it.x - r.x, dy = it.y - r.y, d = Math.hypot(dx, dy);
    if (d < 3.6) { const s = 6.5 * (1 - d / 3.6); drift += Math.sign(dx || 1) * s * Math.min(1, Math.abs(dx) / 0.8); }
  }
  r.vx = want + drift;
  const py = r.y;
  r.x = Math.max(-LANE + 0.5, Math.min(LANE - 0.5, r.x + r.vx * dt));
  r.y += spd * dt;
  // items
  for (const it of r.p.items) {
    if (r.done.has(it)) continue;
    if (it.k === 'g') {
      if (py < it.y && r.y >= it.y) {
        r.done.add(it);
        const off = Math.abs(r.x - it.x);
        if (it.gold) { if (off <= it.w / 2) { r.golds = (r.golds || 0) + 1; r.fuel = 3; r.combo += 3; r.bestCombo = Math.max(r.bestCombo, r.combo); r.ev.push({ e: 'gold', it }); } else r.ev.push({ e: 'goldmiss', it }); continue; }
        if (off <= it.w / 2) { r.passed++; r.combo++; r.bestCombo = Math.max(r.bestCombo, r.combo); r.ev.push({ e: 'gate', combo: r.combo, perfect: off < 0.35, it, close: off > it.w / 2 - 0.3 }); }
        else { r.missed++; r.combo = 0; r.ev.push({ e: 'miss', it }); }
      }
    } else if (it.k === 'r' || it.k === 'd' || it.k === 'm') {
      const ix = itemPos(it, r.t), d = Math.hypot(ix - r.x, it.y - r.y);
      if (d < it.r + RR) {
        if (boosting) { r.done.add(it); r.smashed++; r.ev.push({ e: 'smash', it, x: ix }); }
        else if (r.inv <= 0) { hit(r, it, ix, it.y, it.k === 'd' ? 'debris' : it.k === 'm' ? 'a sweeper rock' : 'a rock'); r.done.add(it); }
      } else if (d < it.r + RR + 0.45 && !it.nearDone && r.y > it.y - 0.2 && py <= it.y + 0.2) { it.nearDone = 1; r.near++; r.ev.push({ e: 'near', it, x: ix }); }
    } else if (it.k === 'c') {
      if (Math.hypot(it.x - r.x, it.y - r.y) < 1.0) { r.done.add(it); if (r.fuel < 3) r.fuel++; r.ev.push({ e: 'can', it }); }
    } else if (it.k === 's') {
      if (Math.hypot(it.x - r.x, it.y - r.y) < 1.1) { r.done.add(it); r.sats++; r.ev.push({ e: 'sat', it }); }
    } else if (it.k === 'w') {
      if (Math.hypot(it.x - r.x, it.y - r.y) < it.r + RR && r.inv <= 0) { hit(r, it, it.x, it.y, 'a gravity well'); r.done.add(it); }
    } else if (it.k === 'f') {
      if (Math.abs(it.y - r.y) < 0.55 && flareOn(it, r.t) && r.x * it.side > -1.0 && r.inv <= 0) { hit(r, it, r.x, it.y, 'a solar flare'); r.done.add(it); }
    }
  }
  if (r.hull <= 0) { r.status = 'lose'; r.ev.push({ e: 'lose' }); }
  else if (r.y >= r.p.len) { r.status = 'win'; r.ev.push({ e: 'win' }); }
  r.lastY = py;
}

function hit(r, it, x, y, why) {
  r.hull--; r.hits++; r.inv = 1.3; r.combo = 0; r.why = why; r.ev.push({ e: 'hit', it, x, y });
}

export function stars(r) {
  if (r.status !== 'win') return 0;
  let s = 1;
  if (r.hits === 0) s = 2;
  if (r.hits === 0 && r.missed === 0 && r.fuel >= (r.m.par == null ? 1 : r.m.par)) s = 3;
  return s;
}
export const gatesLeft = r => r.p.gates - r.passed - r.missed;

// ---- bot: plans safe x for the next row. skill: {lag, noise}
export function botAim(r, rng = Math.random, o = {}) {
  const lead = (o.lag || 0) * SPEED;
  const items = r.p.items;
  const rowY = Y0 - 1;
  // next row with y > r.y - 0.9
  let row = Math.max(0, Math.ceil((r.y + lead - Y0 - 1.4) / RS));
  const y = Y0 + row * RS;
  const eta = (y - r.y) / (SPEED * r.sp);
  const t = r.t + eta;
  const here = items.filter(i => i.row === row && !r.done.has(i));
  let gx = null, gw = 99;
  const bad = [];
  for (const it of here) {
    if (it.k === 'g') { gx = it.x; gw = it.w; }
    else if (it.k === 'r' || it.k === 'd' || it.k === 'm') {
      if (it.k === 'd' && (r.boostT > 0.4 || (o.smash && r.fuel >= 2))) continue;
      const x = itemPos(it, t); bad.push([x - it.r - RR - 0.15, x + it.r + RR + 0.15]);
    } else if (it.k === 'w') bad.push([it.x - 1.6, it.x + 1.6]);
    else if (it.k === 'f') { const on = flareOn(it, t) || flareOn(it, t - 0.25) || flareOn(it, t + 0.25); if (on) bad.push(it.side < 0 ? [-9, 1.15] : [-1.15, 9]); }
  }
  // want: gate centre, else nearest can/sat in next 2 rows, else stay
  let want = gx != null ? gx : r.x;
  if (gx == null) for (const it of items) if ((it.k === 'c' || it.k === 's') && !r.done.has(it) && it.row >= row && it.row <= row + 1) { want = it.x; break; }
  let best = null, bc = 1e9;
  for (let x = -LANE + 0.6; x <= LANE - 0.6; x += 0.1) {
    if (bad.some(b => x > b[0] && x < b[1])) continue;
    if (gx != null && Math.abs(x - gx) > gw / 2 - 0.25) continue;
    const c = Math.abs(x - want) + 0.02 * Math.abs(x - r.x);
    if (c < bc) { bc = c; best = x; }
  }
  if (best == null) { // gate blocked by hazard: give up the gate, avoid the hazard
    for (let x = -LANE + 0.6; x <= LANE - 0.6; x += 0.1) { if (bad.some(b => x > b[0] && x < b[1])) continue; const c = Math.abs(x - want); if (c < bc) { bc = c; best = x; } }
  }
  if (best == null) best = want;
  return best + (o.noise ? (rng() - 0.5) * 2 * o.noise : 0);
}

// run a whole mission with the bot. o: {lag, noise, boosts: use boost to smash when about to hit}
export function botRun(m, o = {}, seed = 1) {
  let s = seed; const rng = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const r = newRun(m); const dt = 1 / 60;
  let steps = 0, thinkT = 0, aim = 0;
  while (r.status === 'fly' && steps++ < 60 * 120) {
    thinkT -= dt;
    if (thinkT <= 0) { aim = botAim(r, rng, o); thinkT = 0.1 + (o.lag || 0); r.tx = aim; }
    if (o.smash) { // boost into dense rock rows when a hazard is unavoidable ahead
      for (const it of r.p.items) if ((it.k === 'r' || it.k === 'd' || it.k === 'm') && !r.done.has(it) && it.y - r.y > 0.6 && it.y - r.y < 2.2 && Math.abs(itemPos(it, r.t) - r.x) < it.r + 1.1 && r.fuel > (o.keep || 1)) { boost(r); break; }
    }
    step(r, dt);
  }
  return r;
}
