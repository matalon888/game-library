// Puckslap — air hockey against a fair CPU. Drag your mallet in your half, smack the puck into the top goal.
// First to 7 wins. Easy / Normal / Hard CPU (it only sees where the puck is, a little late, like you do).
import { createUI, store, buzz, sfx, tone, note, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { css, arcadeCards, startCard, winCardText, canvas2d, particles, shaker, rr } from './arc.js';

const NAME = 'Puckslap: Air Hockey vs CPU';
const S = store('puckslap');
const F = flow('puckslap');
const DIFFS = ['Easy', 'Normal', 'Hard'];
const AI = [
  { speed: 420, react: 0.22, err: 70, attack: 0.6 },
  { speed: 660, react: 0.13, err: 44, attack: 0.8 },
  { speed: 980, react: 0.07, err: 22, attack: 1 },
];
let diff = S.get('diff', 0);

const ui = createUI({ title: 'PUCKSLAP', hint: 'Tap to face off', hand: '🏒', progress: false, score: false });
arcadeCards({ accent: '#ff4f6d', glass: 'rgba(12,18,40,.55)', glass2: 'rgba(12,18,40,.86)' });
const D = daily('puckslap', ui, { name: NAME });
startCard(ui, D, { kicker: 'Air hockey · first to 7', dailyBtn: false, chips: { items: DIFFS, get: () => diff, set: (i) => { diff = i; S.set('diff', i); } }, keys: 'Move the mouse to steer your mallet' });
winCardText(ui, 'YOU WIN!');
const B = board({ game: 'puckslap', label: 'Wins vs CPU (Hard counts 2)', limits: { maxRun: 2, maxPerSec: 0.1 }, mode: 'sum', corner: 'tl' });
css(`body{background:#101830}.hc-card p[data-x]{font-size:18px}`);

// ---------------------------------------------------------------- table geometry (logical units)
const TW = 360, TH = 700, GW = 146, CR = 44, PR = 17, MR = 29, WIN = 7;
const G0 = (TW - GW) / 2, G1 = (TW + GW) / 2;
const V = canvas2d(), g = V.g, P = particles(), SH = shaker();
let sc = 1, ox = 0, oy = 0, tableImg = null;
function layout() {
  const W = V.W, H = V.H, rail = 18;
  sc = Math.min((W - 24 - rail * 2) / TW, (H - 40 - rail * 2) / TH);
  ox = (W - TW * sc) / 2; oy = (H - TH * sc) / 2 + (W < H ? 8 : 0);
  tableImg = document.createElement('canvas'); tableImg.width = Math.round(TW * sc * V.dpr); tableImg.height = Math.round(TH * sc * V.dpr);
  const t = tableImg.getContext('2d'); t.scale(sc * V.dpr, sc * V.dpr);
  const sg = t.createLinearGradient(0, 0, TW, TH); sg.addColorStop(0, '#f4fbff'); sg.addColorStop(1, '#dcefff');
  t.fillStyle = sg; rr(t, 0, 0, TW, TH, CR); t.fill();
  t.fillStyle = 'rgba(70,110,170,.16)';
  for (let y = 14; y < TH; y += 18) for (let x = 14 + ((y / 18) % 2) * 9; x < TW - 8; x += 18) { t.beginPath(); t.arc(x, y, 1.2, 0, 7); t.fill(); }
  t.strokeStyle = '#ff5d73'; t.lineWidth = 4; t.beginPath(); t.moveTo(0, TH / 2); t.lineTo(TW, TH / 2); t.stroke();
  t.lineWidth = 3; t.beginPath(); t.arc(TW / 2, TH / 2, 54, 0, 7); t.stroke();
  t.fillStyle = '#ff5d73'; t.beginPath(); t.arc(TW / 2, TH / 2, 7, 0, 7); t.fill();
  t.strokeStyle = '#4c8dff'; t.lineWidth = 3;
  for (const [y, s] of [[0, 1], [TH, -1]]) { t.beginPath(); t.arc(TW / 2, y, 82, s > 0 ? 0 : Math.PI, s > 0 ? Math.PI : Math.PI * 2); t.stroke();
    t.beginPath(); t.moveTo(0, y + s * TH * 0.25); t.lineTo(TW, y + s * TH * 0.25); t.globalAlpha = 0.5; t.stroke(); t.globalAlpha = 1; }
  // little original crest in the centre circle: a puck with a spark

}
V.onResize = layout; layout();
const toT = (x, y) => ({ x: (x - ox) / sc, y: (y - oy) / sc });

// ---------------------------------------------------------------- state
let state = 'ready', mine = 0, cpu = 0, pause = 0, recorded = false, t0 = 0, clock = 0, goalGlow = [0, 0], cpuR = rng(1);
const puck = { x: TW / 2, y: TH * 0.72, vx: 0, vy: 0, trail: [] };
const me = { x: TW / 2, y: TH - 70, vx: 0, vy: 0, tx: TW / 2, ty: TH - 70, max: 3200, hit: 0 };
const bot = { x: TW / 2, y: 70, vx: 0, vy: 0, tx: TW / 2, ty: 70, max: 800, hit: 0, phase: 'home', aimX: TW / 2 };
const hist = [];   // what the CPU "sees": puck positions over the last few tenths of a second
const ctl = { botUntil: 0, bx: 0, by: 0 };

function serve(toMe) {
  puck.x = TW / 2 + (Math.random() - 0.5) * 30; puck.y = toMe ? TH * 0.72 : TH * 0.28; puck.vx = puck.vy = 0; puck.trail = [];
  pause = 0.9; hist.length = 0;
}
function reset() {
  cpuR = rng(D.seed || (Date.now() % 100000) + 3);
  mine = cpu = 0; recorded = false; P.clear();
  me.x = me.tx = TW / 2; me.y = me.ty = TH - 70; bot.x = bot.tx = TW / 2; bot.y = bot.ty = 70; bot.phase = 'home';
  serve(Math.random() < 0.5);
}
ui.onTap(w => { reset(); state = 'play'; t0 = performance.now(); B.start(); tone(660, 0.1, 'triangle', 0.1, 1.4); });

// ---------------------------------------------------------------- input
function aimAt(cx, cy) { const p = toT(cx, cy); me.tx = p.x; me.ty = p.y; }
addEventListener('pointerdown', e => { if (state === 'play') aimAt(e.clientX, e.clientY); });
addEventListener('pointermove', e => { if (state === 'play' && (e.buttons || e.pointerType === 'mouse')) aimAt(e.clientX, e.clientY); });

// ---------------------------------------------------------------- physics
const clampM = (m, top) => {
  m.tx = Math.max(MR, Math.min(TW - MR, m.tx));
  m.ty = top ? Math.max(MR, Math.min(TH / 2 - MR * 0.35, m.ty)) : Math.max(TH / 2 + MR * 0.35, Math.min(TH - MR, m.ty));
};
function moveMallet(m, dt) {
  const dx = m.tx - m.x, dy = m.ty - m.y, d = Math.hypot(dx, dy), step = m.max * dt;
  const k = d > step ? step / d : 1;
  m.vx = dx * k / dt; m.vy = dy * k / dt; m.x += dx * k; m.y += dy * k;
}
function hitMallet(m, who) {
  const dx = puck.x - m.x, dy = puck.y - m.y, d = Math.hypot(dx, dy);
  if (d >= PR + MR || d < 1e-4) return;
  const nx = dx / d, ny = dy / d;
  puck.x = m.x + nx * (PR + MR); puck.y = m.y + ny * (PR + MR);
  const rvx = puck.vx - m.vx, rvy = puck.vy - m.vy, vn = rvx * nx + rvy * ny;
  if (vn < 0) {
    puck.vx -= 1.85 * vn * nx; puck.vy -= 1.85 * vn * ny;
    const sp = Math.hypot(puck.vx, puck.vy), mx = 1750; if (sp > mx) { puck.vx *= mx / sp; puck.vy *= mx / sp; }
    const imp = Math.min(1, -vn / 1400);
    if (m.hit <= 0) {
      m.hit = 0.08; tone(260 + imp * 500, 0.06, 'triangle', 0.08 + imp * 0.1, 0.6); buzz(who === 'me' ? 8 + imp * 20 : 0);
      P.burst(puck.x - nx * PR, puck.y - ny * PR, who === 'me' ? ['#ff8fa0', '#fff'] : ['#8fb8ff', '#fff'], 4 + Math.round(imp * 10), { speed: 120 + imp * 300, size: 2.2, kind: 'spark', life: 0.3 });
      SH.kick(imp * 5);
    }
  }
}
function walls() {
  const inMouth = puck.x > G0 + 2 && puck.x < G1 - 2;
  let hit = 0;
  if (puck.x < PR) { puck.x = PR; puck.vx = Math.abs(puck.vx) * 0.9; hit = Math.abs(puck.vx); }
  if (puck.x > TW - PR) { puck.x = TW - PR; puck.vx = -Math.abs(puck.vx) * 0.9; hit = Math.abs(puck.vx); }
  if (!inMouth) {
    if (puck.y < PR) { puck.y = PR; puck.vy = Math.abs(puck.vy) * 0.9; hit = Math.abs(puck.vy); }
    if (puck.y > TH - PR) { puck.y = TH - PR; puck.vy = -Math.abs(puck.vy) * 0.9; hit = Math.abs(puck.vy); }
  }
  // goal posts (the mouth corners) are round
  for (const [px, py] of [[G0, 0], [G1, 0], [G0, TH], [G1, TH]]) {
    const dx = puck.x - px, dy = puck.y - py, d = Math.hypot(dx, dy);
    if (d < PR && d > 1e-4) { const nx = dx / d, ny = dy / d, vn = puck.vx * nx + puck.vy * ny; puck.x = px + nx * PR; puck.y = py + ny * PR; if (vn < 0) { puck.vx -= 1.8 * vn * nx; puck.vy -= 1.8 * vn * ny; hit = -vn; } }
  }
  // rounded corners
  for (const [cx, cy] of [[CR, CR], [TW - CR, CR], [CR, TH - CR], [TW - CR, TH - CR]]) {
    const inX = cx < TW / 2 ? puck.x < cx : puck.x > cx, inY = cy < TH / 2 ? puck.y < cy : puck.y > cy;
    if (!inX || !inY) continue;
    const dx = puck.x - cx, dy = puck.y - cy, d = Math.hypot(dx, dy), lim = CR - PR;
    if (d > lim) { const nx = dx / d, ny = dy / d, vn = puck.vx * nx + puck.vy * ny; puck.x = cx + nx * lim; puck.y = cy + ny * lim; if (vn > 0) { puck.vx -= 1.85 * vn * nx; puck.vy -= 1.85 * vn * ny; hit = vn; } }
  }
  if (hit > 60) { tone(1100 + Math.random() * 200, 0.025, 'square', Math.min(0.06, hit / 20000), 0.5); }
}
function step(dt) {
  moveMallet(me, dt); moveMallet(bot, dt);
  puck.x += puck.vx * dt; puck.y += puck.vy * dt;
  walls(); hitMallet(me, 'me'); hitMallet(bot, 'cpu');
  if (puck.y < -PR * 1.2) goal(true);
  else if (puck.y > TH + PR * 1.2) goal(false);
}
function goal(forMe) {
  if (pause > 0) return;
  if (forMe) mine++; else cpu++;
  goalGlow[forMe ? 0 : 1] = 1;
  const gx = ox + TW / 2 * sc, gy = oy + (forMe ? 0 : TH) * sc;
  SH.kick(12); ui.flash(0.3);
  if (forMe) {
    ui.pop('GOAL!', '#ffd166', 54, 40); sfx.coin(); [72, 76, 79].forEach((n, i) => setTimeout(() => note(n, 0.3, 0.14), i * 70)); buzz([30, 40, 30]);
    P.burst(gx, gy + 10, ['#ff5d8f', '#ffd23f', '#3ab795', '#3a86ff', '#fff'], 60, { speed: 360, size: 5, g: 500, kind: 'conf', life: 1.4, dir: Math.PI / 2, spread: 2.4 });
  } else {
    ui.pop('CPU SCORES', '#9cc2ff', 34, 56); tone(240, 0.25, 'sine', 0.12, 0.6); buzz(60);
    P.burst(gx, gy - 10, ['#4c8dff', '#fff'], 30, { speed: 280, size: 3, kind: 'spark', life: 0.5, dir: -Math.PI / 2, spread: 2.4 });
  }
  if (mine >= WIN || cpu >= WIN) { endMatch(mine >= WIN); return; }
  if (mine === WIN - 1 && cpu === WIN - 1) setTimeout(() => ui.pop('SUDDEN DEATH', '#fff', 34, 46), 700);
  serve(!forMe);
}
function endMatch(won) {
  state = won ? 'won' : 'lost'; pause = 99;
  if (!recorded) { recorded = true; F.level(won, mine / WIN); if (won) B.submit(diff === 2 ? 2 : 1, { ms: performance.now() - t0 }); }
  const line = `${mine} : ${cpu} vs ${DIFFS[diff]} CPU`;
  if (won) {
    const w = S.get('wins' + diff, 0) + 1; S.set('wins' + diff, w);
    sfx.win(); P.burst(V.W / 2, V.H * 0.2, ['#ff5d8f', '#ffd23f', '#3ab795', '#3a86ff', '#7b5cff', '#fff'], 140, { speed: 520, size: 6, g: 420, kind: 'conf', life: 2.2 });
    D.won(mine); ui.win(line, `${w} win${w > 1 ? 's' : ''} vs ${DIFFS[diff]}${diff < 2 ? ' · try ' + DIFFS[diff + 1] + '!' : ''}`);
  } else { sfx.fail(); ui.lose('CPU WINS', line); }
}

// ---------------------------------------------------------------- the CPU (also drives the bottom mallet in bot runs)
function predictX(px, py, vx, vy, yLine) {
  if (Math.abs(vy) < 1) return px;
  let t = (yLine - py) / vy; if (t < 0) return px;
  let x = px + vx * t; const lo = PR, hi = TW - PR, span = hi - lo;
  x -= lo; x = ((x % (2 * span)) + 2 * span) % (2 * span); if (x > span) x = 2 * span - x; return x + lo;
}
function brain(m, top, p, R, seen) {
  // top = defends y=0 (the CPU). seen = the puck as this player sees it.
  const sgn = top ? 1 : -1, homeY = top ? 64 : TH - 64, half = top ? seen.y < TH / 2 : seen.y > TH / 2;
  const toward = top ? seen.vy < -40 : seen.vy > 40, sp = Math.hypot(seen.vx, seen.vy);
  const goalY = top ? TH + 40 : -40;
  if (half && (sp < 420 * p.attack || !toward) && Math.abs(seen.y - (top ? 0 : TH)) > 24) {
    // attack: line up behind the puck toward the far goal, then drive through it
    if (m.phase !== 'line' && m.phase !== 'strike') { const r = R(); m.aimX = TW / 2 + (R() - 0.5) * 2 * p.err + (r < 0.28 ? -TW * 1.05 : r < 0.56 ? TW * 1.05 : 0); }   // straight shot or a bank off a rail
    const ax = m.aimX;
    let dx = ax - seen.x, dy = goalY - seen.y; const L = Math.hypot(dx, dy); dx /= L; dy /= L;
    const bx = seen.x - dx * (PR + MR + 14), by = seen.y - dy * (PR + MR + 14);
    const behind = top ? m.y < seen.y - 6 : m.y > seen.y + 6;
    if (Math.hypot(m.x - bx, m.y - by) < 16 || (behind && m.phase === 'strike')) { m.phase = 'strike'; m.tx = seen.x + dx * 50; m.ty = seen.y + dy * 50; }
    else if (!(top ? m.y < seen.y - PR : m.y > seen.y + PR) && Math.abs(m.x - seen.x) < PR + MR + 8) {
      // on the wrong side of the puck: go around it, never through it
      m.phase = 'line'; m.tx = seen.x + (m.x < seen.x ? -1 : 1) * (PR + MR + 16); m.ty = seen.y + (top ? -1 : 1) * (PR + MR + 6);
    } else { m.phase = 'line'; m.tx = bx; m.ty = by; }
  } else if (toward) {
    if (m.phase !== 'guard') m.gerr = (R() - 0.5) * 2 * p.err;   // a read of the shot, fixed until the next one
    m.phase = 'guard';
    const lineY = top ? 84 : TH - 84, px = predictX(seen.x, seen.y, seen.vx, seen.vy, lineY);
    m.tx = Math.max(G0 - 20, Math.min(G1 + 20, px + m.gerr)); m.ty = lineY;
  } else { m.phase = 'home'; m.tx = TW / 2 + (seen.x - TW / 2) * 0.35; m.ty = homeY; }
}

// ---------------------------------------------------------------- loop
let last = performance.now();
function frame(t) {
  const dt = Math.min(0.033, (t - last) / 1000); last = t; clock += dt;
  P.update(dt); SH.update(dt); goalGlow = goalGlow.map(v => Math.max(0, v - dt * 1.5));
  if (state === 'play') {
    const fk = F.k(), p = AI[diff];
    bot.max = p.speed * fk;
    hist.push({ t: clock, x: puck.x, y: puck.y, vx: puck.vx, vy: puck.vy }); while (hist.length > 2 && hist[1].t < clock - p.react / fk) hist.shift();
    brain(bot, true, p, cpuR, hist[0] || puck);
    me.max = clock < ctl.botUntil ? 1600 : 3200;
    if (clock < ctl.botUntil) { botM.x = me.x; botM.y = me.y; brain(botM, false, botP, botR, puck); me.tx = botM.tx; me.ty = botM.ty; }
    clampM(me, false); clampM(bot, true);
    if (pause > 0) { pause -= dt; moveMallet(me, dt); moveMallet(bot, dt); }
    else {
      const n = 10; for (let i = 0; i < n; i++) step(dt / n);
      const f = Math.exp(-0.32 * dt); puck.vx *= f; puck.vy *= f;
    }
    me.hit -= dt; bot.hit -= dt;
  } else if (state === 'ready') { bot.x = TW / 2 + Math.sin(clock * 1.3) * 60; }
  puck.trail.push([puck.x, puck.y]); if (puck.trail.length > 10) puck.trail.shift();
  draw();
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- draw
function drawMallet(m, c1, c2) {
  g.fillStyle = 'rgba(20,30,60,.22)'; g.beginPath(); g.ellipse(m.x + 4, m.y + 6, MR, MR * 0.92, 0, 0, 7); g.fill();
  const gr = g.createRadialGradient(m.x - 9, m.y - 10, 3, m.x, m.y, MR); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
  g.fillStyle = gr; g.beginPath(); g.arc(m.x, m.y, MR, 0, 7); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 2; g.beginPath(); g.arc(m.x, m.y, MR - 5, 0, 7); g.stroke();
  const kg = g.createRadialGradient(m.x - 4, m.y - 5, 1, m.x, m.y, 13); kg.addColorStop(0, '#ffffff'); kg.addColorStop(1, c2);
  g.fillStyle = kg; g.beginPath(); g.arc(m.x, m.y, 12, 0, 7); g.fill();
}
function draw() {
  V.begin(); const W = V.W, H = V.H;
  const bg = g.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, Math.max(W, H) * 0.75); bg.addColorStop(0, '#24345f'); bg.addColorStop(1, '#0d1328');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.save(); g.translate(ox + SH.x, oy + SH.y); g.scale(sc, sc);
  // rails
  g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 30; g.shadowOffsetY = 10;
  const rg = g.createLinearGradient(0, -18, 0, TH + 18); rg.addColorStop(0, '#3a4b86'); rg.addColorStop(1, '#222d58');
  g.fillStyle = rg; rr(g, -18, -18, TW + 36, TH + 36, CR + 18); g.fill(); g.shadowColor = 'transparent';
  g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 2; rr(g, -15, -15, TW + 30, TH + 30, CR + 15); g.stroke();
  // goals (dark mouths that glow on a goal)
  for (const [y, i, col] of [[-18, 0, '255,209,102'], [TH, 1, '120,160,255']]) {
    g.fillStyle = '#0b0f20'; rr(g, G0, y, GW, 18, 6); g.fill();
    if (goalGlow[i] > 0) { g.fillStyle = `rgba(${col},${goalGlow[i]})`; rr(g, G0, y, GW, 18, 6); g.fill(); }
  }
  g.drawImage(tableImg, 0, 0, TW, TH);
  // score digits under the ice
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 110px "Baloo 2",system-ui';
  g.fillStyle = 'rgba(76,141,255,.18)'; g.fillText(cpu, TW / 2, TH * 0.25 + 6);
  g.fillStyle = 'rgba(255,79,109,.2)'; g.fillText(mine, TW / 2, TH * 0.75 + 6);
  g.font = '800 15px "Baloo 2",system-ui'; g.fillStyle = 'rgba(29,43,85,.45)';
  g.fillText(`CPU · ${DIFFS[diff].toUpperCase()}`, TW / 2, TH * 0.25 - 62); g.fillText('YOU', TW / 2, TH * 0.75 + 62);
  // puck trail
  const sp = Math.hypot(puck.vx, puck.vy), hot = Math.min(1, sp / 1200);
  puck.trail.forEach(([x, y], i) => { g.globalAlpha = (i / puck.trail.length) * 0.25 * hot; g.fillStyle = '#ff9f43'; g.beginPath(); g.arc(x, y, PR * (0.5 + i / 20), 0, 7); g.fill(); }); g.globalAlpha = 1;
  // puck
  g.fillStyle = 'rgba(20,30,60,.25)'; g.beginPath(); g.ellipse(puck.x + 3, puck.y + 4, PR, PR * 0.9, 0, 0, 7); g.fill();
  const pg = g.createRadialGradient(puck.x - 5, puck.y - 6, 1, puck.x, puck.y, PR); pg.addColorStop(0, '#4a4a6a'); pg.addColorStop(1, '#16152a');
  g.fillStyle = pg; g.beginPath(); g.arc(puck.x, puck.y, PR, 0, 7); g.fill();
  g.strokeStyle = `hsl(${40 - hot * 40},100%,${60 + hot * 10}%)`; g.lineWidth = 3; g.beginPath(); g.arc(puck.x, puck.y, PR - 3, 0, 7); g.stroke();
  drawMallet(bot, '#9cc2ff', '#2f6fe0');
  drawMallet(me, '#ffb1bd', '#e83a5a');
  if (pause > 0 && state === 'play') { g.globalAlpha = Math.min(1, pause * 3) * 0.8; g.strokeStyle = '#fff'; g.lineWidth = 2; g.setLineDash([5, 5]); g.beginPath(); g.arc(puck.x, puck.y, PR + 8 + Math.sin(clock * 12) * 2, 0, 7); g.stroke(); g.setLineDash([]); g.globalAlpha = 1; }
  g.restore();
  // scoreboard above the table
  if (oy > 70) {
    const cx = V.W / 2, cy = Math.max(34, oy / 2 - 4), w = 210, h = 44;
    g.fillStyle = 'rgba(8,12,30,.6)'; rr(g, cx - w / 2, cy - h / 2, w, h, 22); g.fill(); g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1.5; g.stroke();
    g.textBaseline = 'middle'; g.font = '800 15px "Baloo 2",system-ui';
    g.textAlign = 'left'; g.fillStyle = '#ff8fa0'; g.fillText('YOU', cx - w / 2 + 18, cy + 1);
    g.textAlign = 'right'; g.fillStyle = '#9cc2ff'; g.fillText('CPU', cx + w / 2 - 18, cy + 1);
    g.textAlign = 'center'; g.font = '800 26px "Baloo 2",system-ui'; g.fillStyle = '#fff'; g.fillText(`${mine} : ${cpu}`, cx, cy + 2);
  }
  P.draw(g);
}

reset(); ui.start(); requestAnimationFrame(frame);

// ---------------------------------------------------------------- test hooks
const botR = rng(99), botP = { speed: 900, react: 0, err: 40, attack: 0.85 }, botM = { x: 0, y: 0, phase: 'home', aimX: TW / 2 };
window.__game = {
  get state() { return state; }, get level() { return diff + 1; }, get score() { return mine; },
  get dbg() { return { mine, cpu, pause: +pause.toFixed(2), puck: [puck.x | 0, puck.y | 0, puck.vx | 0, puck.vy | 0], bot: [bot.phase, bot.x | 0, bot.y | 0, bot.tx | 0, bot.ty | 0], me: [me.x | 0, me.y | 0] }; },
  bot() {
    if (state !== 'play') return;
    ctl.botUntil = clock + 1.0;   // the bottom mallet follows the same fair brain as the CPU for the next moment
  },
};
