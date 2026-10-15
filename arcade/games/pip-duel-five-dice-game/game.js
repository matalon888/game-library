// Pip Duel — original five-dice duel (public-domain Yacht / Yatzy rules). Roll up to 3 times, hold dice, fill 13 boxes, beat the rival.
// Honest casino: every die face comes from crypto.getRandomValues; the rival uses the same dice and never sees yours early.
// Flow only changes how often the rival plays its best hold / box (its skill), never the dice.
import { THREE, createStage, createUI, loop, mat, glossy, rounded, burst, confetti, sfx, tone, buzz, store, clamp } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';

const V3 = THREE.Vector3, Q = THREE.Quaternion;
const S = createStage({ fov: 60, shadowSize: 5 });
const { scene, camera, sun, hemi, renderer } = S;
sun.position.set(3, 12, 6); sun.intensity = 1.5; hemi.intensity = 1.2;
const ui = createUI({ title: 'PIP<br>DUEL', hint: 'Roll · hold · score 13 boxes', hand: '🎲', score: false });
const NAME = 'Pip Duel: Five Dice Game';
const D = daily('pipduel', ui, { name: NAME });
const save = store('pipduel');
const F = flow('pipduel', { hard: 0.3, ease: 0.4 });
const B = board({ game: 'pip-duel', label: 'Matches won', limits: { maxRun: 1, maxPerSec: 0.1 }, mode: 'sum' });

// ---------------------------------------------------------------- fair dice (crypto, rejection-sampled)
const U8 = new Uint8Array(1), U32 = new Uint32Array(1);
function d6() { do { crypto.getRandomValues(U8); } while (U8[0] >= 252); return (U8[0] % 6) + 1; }   // 252 = 42*6 → exactly 1/6 each
const crand = () => { crypto.getRandomValues(U32); return U32[0] / 4294967296; };

// ---------------------------------------------------------------- rules
const CATS = ['Ones', 'Twos', 'Threes', 'Fours', 'Fives', 'Sixes', '3 Kind', '4 Kind', 'Full House', 'Sm Straight', 'Lg Straight', 'Five Alike', 'Chance'];
const GLYPH = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const FIVE = 11;
function counts(d) { const c = [0, 0, 0, 0, 0, 0, 0]; for (const v of d) c[v]++; return c; }
function scoresFor(c) {                       // all 13 box scores for a counts array
  let sum = 0, mx = 0, pair = false, three = false;
  for (let v = 1; v <= 6; v++) { sum += c[v] * v; if (c[v] > mx) mx = c[v]; if (c[v] === 2) pair = true; if (c[v] === 3) three = true; }
  const has = (a, b) => { for (let v = a; v <= b; v++) if (!c[v]) return false; return true; };
  const ss = has(1, 4) || has(2, 5) || has(3, 6), ls = has(1, 5) || has(2, 6);
  return [c[1], c[2] * 2, c[3] * 3, c[4] * 4, c[5] * 5, c[6] * 6, mx >= 3 ? sum : 0, mx >= 4 ? sum : 0, pair && three ? 25 : 0, ss ? 30 : 0, ls ? 40 : 0, mx === 5 ? 50 : 0, sum];
}
const upper = (sh) => sh.slice(0, 6).reduce((a, b) => a + (b || 0), 0);
const total = (sh) => sh.reduce((a, b) => a + (b || 0), 0) + (upper(sh) >= 63 ? 35 : 0);

// rival brain: utility = box score minus what that box usually earns ("par"), with a nudge toward the upper bonus
const PAR = [2.1, 4.2, 6.3, 8.4, 10.5, 12.6, 15, 8, 16, 19, 13, 11, 22];
function util(sh, cat, s) {
  let u = s - PAR[cat];
  if (cat < 6) { const up = upper(sh); if (up < 63) { if (s >= 3 * (cat + 1)) u += 4; if (up + s >= 63) u += 18; } }
  return u;
}
function bestBox(sh, c) { const sc = scoresFor(c); let b = -1, bu = -1e9; for (let i = 0; i < 13; i++) if (sh[i] === null) { const u = util(sh, i, sc[i]); if (u > bu) { bu = u; b = i; } } return { cat: b, u: bu, s: sc[b] }; }
// exact expected value of each of the 32 hold masks (one reroll lookahead, every outcome enumerated — no randomness)
function bestHold(sh, dice) {
  let best = { mask: 31, ev: bestBox(sh, counts(dice)).u };
  for (let mask = 0; mask < 31; mask++) {
    const kept = [0, 0, 0, 0, 0, 0, 0]; let k = 0;
    for (let i = 0; i < 5; i++) if (mask >> i & 1) { kept[dice[i]]++; k++; }
    const n = 5 - k, tot = Math.pow(6, n); let acc = 0;
    for (let o = 0; o < tot; o++) {
      const c = kept.slice(); let x = o; for (let j = 0; j < n; j++) { c[x % 6 + 1]++; x = Math.floor(x / 6); }
      acc += bestBox(sh, c).u;
    }
    const ev = acc / tot; if (ev > best.ev + 0.05) best = { mask, ev };
  }
  return best;
}
// the "sloppy" rival: keeps its most common face and takes the biggest raw score
function sloppyHold(dice) { const c = counts(dice); let f = 6; for (let v = 6; v >= 1; v--) if (c[v] > c[f]) f = v; let m = 0; dice.forEach((v, i) => { if (v === f) m |= 1 << i; }); return m; }
function sloppyBox(sh, c) { const sc = scoresFor(c); let b = -1; for (let i = 0; i < 13; i++) if (sh[i] === null && (b < 0 || sc[i] > sc[b])) b = i; return b; }

// ---------------------------------------------------------------- themes + rivals
const THEMES = [
  { bg: ['#b8f2e6', '#e3f6ff'], felt: '#15806f', rim: '#fff4e6', trim: '#ffcf56', ui: '#2a9d8f', table: '#9fe3d3' },
  { bg: ['#ffd1dc', '#ffe9b8'], felt: '#b0305f', rim: '#fff4e6', trim: '#ffcf56', ui: '#ff5d8f', table: '#ffc2d1' },
  { bg: ['#d7c8ff', '#ffd6f5'], felt: '#4b3bb5', rim: '#fff8ff', trim: '#ffd166', ui: '#7b5cff', table: '#cbb8ff' },
  { bg: ['#c9f0ff', '#e8fff4'], felt: '#155e9a', rim: '#ffffff', trim: '#ffcf56', ui: '#0582ca', table: '#a9dcf5' },
  { bg: ['#ffe0b3', '#fff6d6'], felt: '#1e7a52', rim: '#fff6e8', trim: '#ff8c42', ui: '#ff8c42', table: '#ffd59a' },
];
const RIVALS = [['Lucky Lou', '🦊', '#ff8c42'], ['Dot', '🐼', '#3a86ff'], ['Max Pips', '🐯', '#ff4d6d'], ['Rolla', '🦉', '#7b5cff'], ['Sly Sam', '🐸', '#2a9d8f'], ['Queenie', '🐱', '#e0679b']];
let TH = THEMES[0], rival = RIVALS[0];

// ---------------------------------------------------------------- chips
const START = 1000;
let level = save.get('level', 1), chips = save.get('chips', START), best = save.get('best', 0);
const ante = (L) => Math.min(600, 150 + 50 * (L - 1));
const target = (L) => START + 150 * L;
const fmt = (n) => n.toLocaleString('en-US');

// ---------------------------------------------------------------- HUD / sheet DOM
const css = document.createElement('style'); css.textContent = `
.pd-hud{position:fixed;top:calc(56px + env(safe-area-inset-top));left:10px;right:10px;display:flex;justify-content:space-between;align-items:stretch;gap:8px;z-index:6;pointer-events:none}
.pd-box{flex:1;max-width:130px;background:rgba(255,255,255,.94);color:#2b2d42;border-radius:16px;padding:4px 10px 5px;box-shadow:0 4px 0 rgba(0,0,0,.12);transition:transform .2s,box-shadow .2s;display:flex;flex-direction:column}
.pd-box.on{transform:scale(1.06);box-shadow:0 0 0 4px var(--ui),0 4px 0 rgba(0,0,0,.12)}
.pd-box.r.on{box-shadow:0 0 0 4px var(--riv,#ff8c42),0 4px 0 rgba(0,0,0,.12)}
.pd-box .n{font-size:12px;font-weight:800;opacity:.6;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pd-box .s{font-size:32px;font-weight:800;line-height:1}
.pd-box.r{text-align:right}
.pd-mid{align-self:center;text-align:center;font-weight:800;font-size:12px;line-height:1.05;color:#2b2d42;display:flex;flex-direction:column;align-items:center;gap:3px}
.pd-mid b{display:block;font-size:22px}
.pd-chip{display:inline-flex;align-items:center;gap:4px;background:#2b2d42;color:#ffd23f;border-radius:14px;padding:1px 9px 0;font-size:14px;text-shadow:none;box-shadow:0 3px 0 rgba(0,0,0,.15)}
.pd-chip i{width:11px;height:11px;border-radius:50%;background:#ffd23f;box-shadow:inset 0 0 0 2px #e09f00,inset 0 0 0 3.5px #fff3b0}
.pd-q{position:fixed;top:calc(14px + env(safe-area-inset-top));left:10px;z-index:11;width:34px;height:34px;border-radius:50%;border:0;background:rgba(255,255,255,.85);color:var(--ui);font:inherit;font-weight:800;font-size:13px;box-shadow:0 3px 0 rgba(0,0,0,.12);cursor:pointer;padding:0}
.pd-bot{position:fixed;left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom));z-index:6;display:flex;flex-direction:column;gap:8px;max-width:480px;margin:0 auto}
.pd-roll{font:inherit;font-weight:800;font-size:24px;color:#fff;background:var(--ui);border:0;border-radius:40px;height:54px;box-shadow:0 5px 0 rgba(0,0,0,.2);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:12px;transition:filter .2s,background .3s;text-shadow:0 2px 0 rgba(0,0,0,.15)}
.pd-roll:active{transform:translateY(3px);box-shadow:0 2px 0 rgba(0,0,0,.2)}
.pd-roll.off{filter:saturate(.35) brightness(1.05);cursor:default}
.pd-roll.go{animation:pdgo 1s ease-in-out infinite}
@keyframes pdgo{50%{transform:scale(1.04)}}
.pd-roll .dots{display:flex;gap:6px}.pd-roll .dots i{width:11px;height:11px;border-radius:50%;background:#fff}.pd-roll .dots i.u{background:rgba(255,255,255,.3)}
.pd-sheet{background:rgba(255,255,255,.95);color:#2b2d42;border-radius:18px;padding:6px 6px 5px;display:grid;grid-template-columns:1fr 1fr;gap:4px 8px;box-shadow:0 5px 0 rgba(0,0,0,.12)}
.pd-col{display:flex;flex-direction:column;gap:1px}
.pd-r{display:grid;grid-template-columns:1fr 36px 36px;align-items:center;height:28px;border-radius:9px;font-weight:800;font-size:15px;padding-left:5px;transition:background .2s}
.pd-r.h{height:17px;font-size:11px;opacity:.55}
.pd-r .n{font-size:13px;white-space:nowrap;overflow:hidden}
.pd-r .n g{font-size:17px;vertical-align:-1px;margin-right:2px;font-style:normal}
.pd-r span{text-align:center}
.pd-r .n{text-align:left}
body.ready .pd-bot{opacity:0;pointer-events:none}
.pd-bot{transition:opacity .4s}
.pd-r .a{opacity:.75}
.pd-r .y.p{color:var(--ui);opacity:.55;font-weight:700}
.pd-r .y.p.z{opacity:.3}
.pd-r.can{cursor:pointer;background:rgba(0,0,0,.035)}
.pd-r.can.b .y{background:var(--ui);color:#fff;opacity:1;border-radius:8px;box-shadow:0 2px 0 rgba(0,0,0,.15)}
.pd-r.bonus .n,.pd-r.bonus span{font-size:11px;opacity:.7;letter-spacing:-.2px}
.pd-r.just{animation:pdjust .6s ease-out}
@keyframes pdjust{0%{background:var(--ui);transform:scale(1.06)}100%{background:transparent;transform:scale(1)}}
.pd-r.aj{animation:pdaj .7s ease-out}
@keyframes pdaj{0%{background:var(--riv,#ff8c42);transform:scale(1.06)}100%{background:transparent;transform:scale(1)}}
.pd-foot{position:absolute;left:0;right:0;bottom:calc(14px + env(safe-area-inset-bottom));font-size:14px!important;opacity:.9}
.pd-info{font-size:17px!important;opacity:.95}
.pd-modal{position:fixed;inset:0;z-index:20;background:rgba(20,20,35,.45);display:flex;align-items:center;justify-content:center;padding:16px}
.pd-modal .in{background:#fff;color:#2b2d42;border-radius:22px;max-width:380px;width:100%;max-height:88vh;overflow:auto;padding:16px 18px 18px;font-size:14px;line-height:1.35;box-shadow:0 8px 0 rgba(0,0,0,.15)}
.pd-modal h2{margin:0 0 6px;font-size:22px;color:var(--ui)}
.pd-modal table{width:100%;border-collapse:collapse;margin:6px 0 10px}
.pd-modal td{padding:3px 2px;border-bottom:1px solid #eee}.pd-modal td:last-child{text-align:right;font-weight:800}
.pd-modal p{margin:6px 0}
.pd-modal .x{margin-top:8px;width:100%}
.hc-pop{-webkit-text-stroke:6px rgba(43,45,66,.75);paint-order:stroke fill}
.hc-card h1{-webkit-text-stroke:3px rgba(43,45,66,.2);paint-order:stroke fill}
.hc-card.dim{background:rgba(20,20,35,.35)}
`; document.head.appendChild(css);
const H = (h, parent = document.body) => { const d = document.createElement('div'); d.innerHTML = h.trim(); const e = d.firstElementChild; parent.appendChild(e); return e; };
const hud = H(`<div class="pd-hud"><div class="pd-box" data-y><span class="n">🎲 YOU</span><span class="s">0</span></div><div class="pd-mid">ROUND<b>1/13</b><span class="pd-chip"><i></i><em style="font-style:normal">1,000</em></span></div><div class="pd-box r" data-r><span class="n">RIVAL</span><span class="s">0</span></div></div>`);
const boxY = hud.querySelector('[data-y]'), boxR = hud.querySelector('[data-r]'), roundEl = hud.querySelector('.pd-mid b'), chipEl = hud.querySelector('.pd-chip em');
const qBtn = H('<button class="pd-q" aria-label="Odds and rules">ODDS</button>');
const bot = H('<div class="pd-bot"><button class="pd-roll"><span class="t">ROLL</span><span class="dots"><i></i><i></i><i></i></span></button><div class="pd-sheet"><div class="pd-col" data-c="0"></div><div class="pd-col" data-c="1"></div></div></div>');
const rollBtn = bot.querySelector('.pd-roll'), rollTxt = rollBtn.querySelector('.t'), dotsEl = rollBtn.querySelectorAll('.dots i');
const cols = bot.querySelectorAll('.pd-col');
const rows = [];
for (let c = 0; c < 2; c++) {
  H(`<div class="pd-r h"><span class="n"></span><span>YOU</span><span data-ra>RIV</span></div>`, cols[c]);
  for (let idx = c * 6; idx < (c ? 13 : 6); idx++) {
    const label = idx < 6 ? `<g>${GLYPH[idx]}</g>${CATS[idx]}` : CATS[idx];
    const r = H(`<div class="pd-r" data-i="${idx}"><span class="n">${label}</span><span class="y"></span><span class="a"></span></div>`, cols[c]);
    r.addEventListener('click', () => pickBox(idx));
    rows[idx] = r;
  }
  if (!c) rows.bonus = H(`<div class="pd-r bonus"><span class="n">Bonus 63+ → 35</span><span class="y"></span><span class="a"></span></div>`, cols[0]);
}
rollBtn.addEventListener('pointerdown', e => e.stopPropagation());
rollBtn.addEventListener('click', () => playerRoll());

// start card: stakes line + honest footer
const infoP = document.createElement('p'); infoP.className = 'pd-info'; ui.els.start.querySelector('.hint').before(infoP);
ui.els.win.classList.add('dim'); ui.els.start.classList.add('dim');
const foot = document.createElement('p'); foot.className = 'pd-foot'; foot.textContent = 'Free play · no real money'; ui.els.start.appendChild(foot);

// odds / rules panel
let modal = null;
function openOdds() {
  if (modal) return;
  modal = H(`<div class="pd-modal"><div class="in"><h2>Odds &amp; rules</h2>
<p><b>Fair dice.</b> Every face 1–6 has exactly a 1 in 6 chance, drawn with <code>crypto.getRandomValues</code> (rejection-sampled, no bias). The rival uses the same dice, never sees your dice early and never gets better rolls. Only its skill adapts: it plays its best move more often when you've been winning.</p>
<p><b>Turn:</b> up to 3 rolls, tap dice to hold. Then fill one empty box (a 0 if it doesn't fit). 13 rounds each, highest total wins.</p>
<table>
<tr><td>Ones … Sixes</td><td>sum of that face</td></tr>
<tr><td>Upper bonus (63+)</td><td>+35</td></tr>
<tr><td>3 Kind / 4 Kind</td><td>sum of all dice</td></tr>
<tr><td>Full House (3 + 2)</td><td>25</td></tr>
<tr><td>Small Straight (4 in a row)</td><td>30</td></tr>
<tr><td>Large Straight (5 in a row)</td><td>40</td></tr>
<tr><td>Five Alike</td><td>50</td></tr>
<tr><td>Chance</td><td>sum of all dice</td></tr>
</table>
<p><b>Real odds:</b> Five Alike on one roll 1 in 1,296 (0.08%); within a turn chasing it ≈ 4.6%. Large Straight on one roll 240 / 7,776 (3.1%).</p>
<p><b>Stakes:</b> both players ante <b>● ${fmt(ante(level))}</b>; the winner takes the pot, a tie returns the antes. Level ${level} clears at <b>● ${fmt(target(level))}</b>. Out of chips? You get a fresh ● ${fmt(START)} stack. Chips are free play only — no real money, nothing to buy, no ads.</p>
<button class="hc-btn x">Got it</button></div></div>`);
  modal.addEventListener('pointerdown', e => e.stopPropagation());
  modal.addEventListener('click', e => { if (e.target === modal || e.target.classList.contains('x')) { modal.remove(); modal = null; } });
}
qBtn.addEventListener('pointerdown', e => e.stopPropagation());
qBtn.addEventListener('click', openOdds);

// ---------------------------------------------------------------- 3D: table, felt tray, dice
const DIE = 1.1;
const table = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.16, color: '#2b2d42' })); table.rotation.x = -Math.PI / 2; table.position.y = -0.32; table.receiveShadow = true; scene.add(table);
const TW = 5.7, TD = 4.1;
const felt = new THREE.Mesh(rounded(TW, TD, 0.3, 0.14), mat('#15806f', { roughness: 1 })); felt.rotation.x = -Math.PI / 2; felt.position.y = -0.15; felt.receiveShadow = true; scene.add(felt);
const rimMat = glossy('#fff4e6', { roughness: 0.35 }), trimMat = glossy('#ffcf56', { metalness: 0.45, roughness: 0.25 });
const rimG = new THREE.Group(); scene.add(rimG);
for (const [w, d, x, z] of [[TW + 0.9, 0.45, 0, -(TD / 2 + 0.22)], [TW + 0.9, 0.45, 0, TD / 2 + 0.22], [0.45, TD + 0.0, -(TW / 2 + 0.22), 0], [0.45, TD + 0.0, TW / 2 + 0.22, 0]]) {
  const m = new THREE.Mesh(rounded(w, d, 0.62, 0.18), rimMat); m.rotation.x = -Math.PI / 2; m.position.set(x, 0, z); m.castShadow = true; m.receiveShadow = true; rimG.add(m);
  const t = new THREE.Mesh(new THREE.BoxGeometry(w > d ? w - 0.3 : 0.08, 0.05, w > d ? 0.08 : d - 0.3), trimMat); t.position.set(x + (w > d ? 0 : (x < 0 ? 0.12 : -0.12)), 0.32, z + (w > d ? (z < 0 ? 0.12 : -0.12) : 0)); rimG.add(t);
}
// decorative chip stacks (free play chips) on the table behind the tray
const chipGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.13, 28);
const chipMats = ['#ff4d6d', '#ffffff', '#3a86ff', '#ffd23f', '#2b2d42'].map(c => glossy(c, { roughness: 0.3 }));
const stacks = new THREE.Group(); scene.add(stacks);
[[-3.0, -3.0, 7, 0], [-2.1, -3.25, 4, 2], [2.4, -3.1, 6, 3], [3.25, -2.75, 3, 1]].forEach(([x, z, n, c0]) => {
  for (let i = 0; i < n; i++) { const m = new THREE.Mesh(chipGeo, chipMats[(c0 + (i % 2 ? 1 : 0)) % chipMats.length]); m.position.set(x + (Math.random() - 0.5) * 0.04, -0.25 + i * 0.135, z); m.castShadow = true; stacks.add(m); }
});

function pipTexture(v, pipCol = '#2b2d42') {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#fffdf8'; g.fillRect(0, 0, 256, 256);
  const P = { 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]], 5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]] }[v];
  for (const [i, j] of P) {
    const x = 128 + (i - 1) * 62, y = 128 + (j - 1) * 62, r = v === 1 ? 34 : 22;
    const grd = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
    const col = v === 1 ? '#ff3d6e' : pipCol;
    grd.addColorStop(0, v === 1 ? '#ff7a9a' : '#565a7a'); grd.addColorStop(1, col);
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 3; g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const TEX = [null, 1, 2, 3, 4, 5, 6].map(v => v && pipTexture(v));
// box material order: +X, -X, +Y, -Y, +Z, -Z  → faces 2,5,1,6,3,4 (opposite faces sum to 7)
const FACE_VAL = [2, 5, 1, 6, 3, 4];
const NORMALS = [new V3(1, 0, 0), new V3(-1, 0, 0), new V3(0, 1, 0), new V3(0, -1, 0), new V3(0, 0, 1), new V3(0, 0, -1)];
function roundedCube(s, r, seg = 7) {
  const g = new THREE.BoxGeometry(s, s, s, seg, seg, seg), p = g.attributes.position, n = g.attributes.normal, h = s / 2 - r, v = new V3(), c = new V3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); c.set(clamp(v.x, -h, h), clamp(v.y, -h, h), clamp(v.z, -h, h));
    const d = v.clone().sub(c).normalize(); v.copy(c).addScaledVector(d, r); p.setXYZ(i, v.x, v.y, v.z); n.setXYZ(i, d.x, d.y, d.z);
  }
  return g;
}
const DIE_GEO = roundedCube(DIE, 0.2);
const RING_GEO = new THREE.TorusGeometry(0.78, 0.07, 10, 40);
const SHADOW_TEX = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 4, 32, 32, 32); r.addColorStop(0, 'rgba(0,0,0,.35)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const SLOTS = [[-1.75, -0.95], [0, -1.05], [1.75, -0.95], [-0.9, 1.0], [0.9, 1.0]];
const REST = DIE / 2 - 0.15 + 0.15;   // felt top is at y = 0
const dice = [];
for (let i = 0; i < 5; i++) {
  const g = new THREE.Group();
  const mats = FACE_VAL.map(v => new THREE.MeshStandardMaterial({ map: TEX[v], roughness: 0.28, metalness: 0.02, emissive: '#ffb300', emissiveIntensity: 0 }));
  const m = new THREE.Mesh(DIE_GEO, mats); m.castShadow = true; m.receiveShadow = true; m.userData.die = i; g.add(m);
  const ring = new THREE.Mesh(RING_GEO, new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; scene.add(ring);
  scene.add(g);
  const d = { g, m, mats, ring, v: i + 1, held: false, lift: 0, sq: 0, anim: null, pos: new V3(SLOTS[i][0], REST, SLOTS[i][1]), q: new Q() };
  setFace(d, d.v, (i - 2) * 0.12);
  d.g.position.copy(d.pos); d.m.quaternion.copy(d.q);
  dice.push(d);
}
function faceQuat(v, yaw) {
  const q = new Q().setFromUnitVectors(NORMALS[FACE_VAL.indexOf(v)], new V3(0, 1, 0));
  return new Q().setFromAxisAngle(new V3(0, 1, 0), yaw).multiply(q);
}
function setFace(d, v, yaw) { d.v = v; d.q.copy(faceQuat(v, yaw)); }

// ---------------------------------------------------------------- camera (tray in the upper half, scorecard below)
function frame() {
  const W = innerWidth, Hh = innerHeight, portrait = W / Hh < 0.8;
  camera.fov = portrait ? 62 : 46;
  if (portrait) camera.setViewOffset(W, Hh, 0, Hh * 0.065, W, Hh); else camera.setViewOffset(W, Hh, 0, Hh * 0.17, W, Hh);
  camera.updateProjectionMatrix();
}
addEventListener('resize', frame); frame();
const CAM = new V3(0, 11.9, 4.7);

// ---------------------------------------------------------------- game state
let state = 'ready', phase = 'idle', round = 1, rollsLeft = 3, rolled = false, P = [], A = [], recorded = false, beatenShown = false, matchId = 0, fast = false, shake = 0, busted = false, botBusy = false;
const wait = (ms) => new Promise(r => setTimeout(r, fast ? ms * 0.06 : ms));
const anim = () => dice.some(d => d.anim);

function newMatch() {
  matchId++; B.start();
  TH = THEMES[(level - 1) % THEMES.length];
  const pick = D.seed ? D.seed : level * 7 + Math.floor(crand() * 3);
  rival = RIVALS[pick % RIVALS.length];
  document.body.style.setProperty('--bg1', TH.bg[0]); document.body.style.setProperty('--bg2', TH.bg[1]); document.body.style.setProperty('--ui', TH.ui); document.body.style.setProperty('--riv', rival[2]);
  felt.material.color.set(TH.felt); rimMat.color.set(TH.rim); trimMat.color.set(TH.trim);
  P = new Array(13).fill(null); A = new Array(13).fill(null); round = 1; recorded = false; beatenShown = false;
  boxR.querySelector('.n').textContent = rival[1] + ' ' + rival[0].toUpperCase();
  cols.forEach(c => c.querySelector('[data-ra]').textContent = rival[1]);
  ui.levels(level);
  infoP.innerHTML = `Ante ${fmt(ante(level))} chips · clear at ${fmt(target(level))}<br><span style="font-size:15px;opacity:.85">vs ${rival[1]} ${rival[0]}</span>`;
  startPlayerTurn();
}
function startPlayerTurn() {
  phase = 'you'; rollsLeft = 3; rolled = false;
  dice.forEach(d => setHeld(d, false));
  refresh();
}
function setHeld(d, h) { d.held = h; }
function refresh() {
  const you = total(P), riv = total(A);
  boxY.querySelector('.s').textContent = you; boxR.querySelector('.s').textContent = riv;
  boxY.classList.toggle('on', phase === 'you'); boxR.classList.toggle('on', phase === 'ai');
  roundEl.textContent = `${Math.min(13, round)}/13`; chipEl.textContent = fmt(chips);
  ui.progress(((round - 1) * 2 + (phase === 'ai' ? 1 : 0)) / 26);
  // roll button
  const canRoll = phase === 'you' && rollsLeft > 0 && !anim() && state === 'play';
  rollBtn.classList.toggle('off', !canRoll); rollBtn.classList.toggle('go', canRoll && !rolled);
  rollBtn.style.background = phase === 'ai' ? rival[2] : '';
  rollTxt.textContent = phase === 'end' ? 'GOOD GAME' : phase === 'ai' ? `${rival[0].toUpperCase()} ROLLING` : phase === 'you' && rollsLeft === 0 ? 'PICK A BOX' : rolled ? 'ROLL AGAIN' : 'ROLL';
  dotsEl.forEach((e, i) => e.classList.toggle('u', phase === 'you' ? i >= rollsLeft : true));
  // sheet
  const show = phase === 'you' && rolled && !anim();
  const sc = scoresFor(counts(dice.map(d => d.v)));
  let bestI = -1; if (show) bestI = bestBox(P, counts(dice.map(d => d.v))).cat;
  for (let i = 0; i < 13; i++) {
    const r = rows[i], y = r.children[1], a = r.children[2];
    if (P[i] !== null) { y.textContent = P[i]; y.className = 'y'; }
    else if (show) { y.textContent = sc[i]; y.className = 'y p' + (sc[i] ? '' : ' z'); }
    else { y.textContent = ''; y.className = 'y'; }
    a.textContent = A[i] === null ? '' : A[i];
    r.classList.toggle('can', show && P[i] === null); r.classList.toggle('b', show && i === bestI);
  }
  const bu = (sh) => { const u = upper(sh); return u >= 63 ? '+35' : `${u}/63`; };
  rows.bonus.children[1].textContent = bu(P); rows.bonus.children[2].textContent = bu(A);
}

// ---------------------------------------------------------------- rolling
let rollWaiters = [];
function rollDice(who) {
  const ms = fast ? 0.09 : 0.95;
  const free = dice.filter(d => !d.held);
  free.forEach((d, k) => {
    const v = d6();
    const i = dice.indexOf(d);
    const to = new V3(SLOTS[i][0] + (Math.random() - 0.5) * 0.3, REST, SLOTS[i][1] + (Math.random() - 0.5) * 0.3);
    const from = new V3(SLOTS[i][0] * 0.55 + (Math.random() - 0.5) * 0.8, REST + 2.2, 3.6 + Math.random() * 0.6);
    const yaw = (Math.random() - 0.5) * 0.5;
    const qf = faceQuat(v, yaw);
    const axis = new V3(-1, (Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.6).normalize();
    const turns = (fast ? 1.2 : 2) + Math.random() * 1.5;
    d.v = v; d.q.copy(qf);
    d.anim = { t: -k * (fast ? 0.01 : 0.05), dur: ms + Math.random() * (fast ? 0.03 : 0.12), from, to, qf, axis, ang: turns * Math.PI * 2, hits: 0 };
  });
  tone(180, 0.18, 'sawtooth', 0.05, 0.4);
  for (let i = 0; i < 4; i++) setTimeout(() => tone(1200 + Math.random() * 900, 0.025, 'square', 0.035, 0.7), i * 40 * (fast ? 0.4 : 1));
  buzz(10);
  refresh();
  return new Promise(r => rollWaiters.push(r));
}
const tmpQ = new Q();
function stepDice(dts) {
  let any = false;
  for (const d of dice) {
    if (d.anim) {
      const a = d.anim; a.t += dts; any = true;
      const k = clamp(a.t / a.dur, 0, 1), e = 1 - Math.pow(1 - k, 3);
      d.pos.set(a.from.x + (a.to.x - a.from.x) * e, 0, a.from.z + (a.to.z - a.from.z) * e);
      const h = (a.from.y - REST) * Math.pow(1 - k, 1.4) * Math.abs(Math.cos(2.5 * Math.PI * k));
      d.pos.y = REST + h;
      tmpQ.setFromAxisAngle(a.axis, -a.ang * (1 - e)); d.m.quaternion.copy(tmpQ).multiply(a.qf);
      const hitAt = [0.2, 0.6, 1][a.hits];
      if (hitAt !== undefined && k >= hitAt) {
        a.hits++; d.sq = a.hits === 3 ? 0.9 : 0.7;
        tone(900 + Math.random() * 1400, 0.03, 'square', a.hits === 3 ? 0.05 : 0.04, 0.6); if (a.hits === 1) shake = Math.max(shake, 0.35);
      }
      if (k >= 1) { d.anim = null; d.m.quaternion.copy(a.qf); d.pos.copy(a.to); }
    }
    d.lift += ((d.held ? 0.32 : 0) - d.lift) * Math.min(1, 0.25 * dts * 60);
    d.sq = Math.max(0, d.sq - dts * 4);
    d.g.position.set(d.pos.x, d.pos.y + d.lift, d.pos.z);
    const s = Math.sin(d.sq * Math.PI) * 0.22;
    d.g.scale.set(1 + s * 0.5, 1 - s, 1 + s * 0.5);
    const glow = d.held ? 0.28 + Math.sin(performance.now() / 180) * 0.06 : 0;
    for (const m of d.mats) m.emissiveIntensity += (glow - m.emissiveIntensity) * 0.3;
    d.ring.position.x = d.pos.x; d.ring.position.z = d.pos.z;
    d.ring.material.opacity += ((d.held ? 0.95 : 0) - d.ring.material.opacity) * 0.3;
    d.ring.scale.setScalar(1 + (d.held ? Math.sin(performance.now() / 200) * 0.04 : -0.2));
  }
  if (!any && rollWaiters.length) { const w = rollWaiters; rollWaiters = []; settled(); w.forEach(r => r()); }
}
function settled() {
  const c = counts(dice.map(d => d.v)), sc = scoresFor(c), mine = phase === 'you';
  const mid = new V3(0, 1, 0);
  if (sc[FIVE]) {
    ui.pop('FIVE ALIKE!', '#ffd23f', mine ? 54 : 40, 30); confetti(scene, mid, mine ? 90 : 40); ui.flash(0.5); sfx.win(); buzz([30, 40, 60]);
  } else if (sc[10]) { ui.pop(mine ? 'BIG STRAIGHT!' : 'STRAIGHT!', '#2ef0c2', 44, 30); burst(scene, mid, ['#2ef0c2', '#fff', TH.trim], 24, { speed: 0.12, up: 0.12, size: 0.5 }); sfx.coin(); }
  else if (sc[8] && mine) { ui.pop('FULL HOUSE!', '#ffd8e2', 40, 30); sfx.pick(5); }
  else if (Math.max(...c) === 4 && mine) { ui.pop('FOUR!', '#fff', 38, 30); sfx.pick(4); }
  refresh();
}

// ---------------------------------------------------------------- player actions
async function playerRoll() {
  if (state !== 'play' || phase !== 'you' || rollsLeft <= 0 || anim()) return false;
  rollsLeft--; const first = !rolled; rolled = true; sfx.tap();
  await rollDice('you');
  if (first && round === 1 && !fast) setTimeout(() => { if (phase === 'you' && rollsLeft > 0) ui.pop('Tap dice to hold', '#fff', 26, 52); }, 250);
  return true;
}
function toggleHold(i) {
  if (state !== 'play' || phase !== 'you' || !rolled || rollsLeft === 0 || anim()) return;
  const d = dice[i]; setHeld(d, !d.held); d.sq = 0.5;
  d.held ? sfx.pick(3) : tone(420, 0.06, 'sine', 0.1, 0.7); buzz(8);
}
function scoreBox(sh, i, who) {
  const c = counts(dice.map(d => d.v)), s = scoresFor(c)[i], upBefore = upper(sh);
  sh[i] = s;
  const r = rows[i]; r.classList.remove('just', 'aj'); void r.offsetWidth; r.classList.add(who === 'you' ? 'just' : 'aj');
  if (who === 'you') {
    const big = { 8: 'FULL HOUSE +25', 9: 'STRAIGHT +30', 10: 'BIG STRAIGHT +40', 11: 'FIVE ALIKE +50' }[i];
    if (s && big) { ui.pop(big, '#ffd23f', 40, 30); burst(scene, new V3(0, 1, 0), ['#ffd23f', '#fff', TH.ui], 26, { speed: 0.14, up: 0.14, size: 0.5 }); ui.flash(0.3); sfx.win(); }
    else if (s) { ui.pop('+' + s, '#fff', 36, 30); sfx.coin(); }
    else { ui.pop(CATS[i] + ' · 0', '#e0e0f0', 28, 30); tone(260, 0.12, 'triangle', 0.08, 0.7); }
    buzz(s ? 14 : 6);
    if (upBefore < 63 && upper(sh) >= 63) setTimeout(() => { ui.pop('BONUS +35!', '#2ef0c2', 46, 38); confetti(scene, new V3(0, 1, 0), 50); sfx.win(); }, 500);
    const tot = total(sh);
    if (!beatenShown && D.beaten(tot)) { beatenShown = true; setTimeout(() => { ui.pop('BEATEN!', '#ffd23f', 52, 40); confetti(scene, new V3(0, 1, 0), 70); }, 700); }
  } else {
    ui.pop(`${rival[1]} ${CATS[i]} ${s ? '+' + s : '0'}`, s >= 25 ? '#ffd8e2' : '#ffffff', 26, 30);
    tone(s ? 660 : 260, 0.08, 'triangle', 0.08, s ? 1.2 : 0.7);
  }
}
function pickBox(i) {
  if (state !== 'play' || phase !== 'you' || !rolled || anim() || P[i] !== null) return;
  scoreBox(P, i, 'you');
  dice.forEach(d => setHeld(d, false));
  phase = 'ai'; refresh();
  aiTurn(matchId);
}

// ---------------------------------------------------------------- rival turn (visible, quick)
function aiQuality() { const fk = F.k(); return clamp((0.55 + 0.05 * (level - 1)) * fk, 0.3, 0.97); }
async function aiTurn(id) {
  await wait(650); if (id !== matchId) return;
  let left = 3;
  while (left > 0) {
    if (left < 3) {
      const vals = dice.map(d => d.v), smart = crand() < aiQuality();
      let mask;
      if (smart) { const h = bestHold(A, vals); mask = h.mask; } else { mask = sloppyHold(vals); if (scoresFor(counts(vals))[FIVE] || scoresFor(counts(vals))[10]) mask = 31; }
      if (mask === 31) break;
      dice.forEach((d, i) => setHeld(d, !!(mask >> i & 1)));
      if (mask) { sfx.pick(2); await wait(420); if (id !== matchId) return; }
    }
    left--; await rollDice('ai'); if (id !== matchId) return;
    await wait(420); if (id !== matchId) return;
  }
  const c = counts(dice.map(d => d.v));
  const box = crand() < aiQuality() ? bestBox(A, c).cat : sloppyBox(A, c);
  scoreBox(A, box, 'ai');
  dice.forEach(d => setHeld(d, false));
  refresh();
  await wait(650); if (id !== matchId) return;
  round++;
  if (round > 13) endMatch(); else startPlayerTurn();
}

// ---------------------------------------------------------------- match end: chips move, level by chip target
function endMatch() {
  phase = 'end'; state = 'end'; refresh();
  const you = total(P), riv = total(A), a = ante(level);
  best = Math.max(best, you); save.set('best', best);
  const winH = ui.els.win.querySelector('h1'), winP = ui.els.win.querySelector('p');
  if (you > riv) {
    chips += a; save.set('chips', chips);
    if (!recorded) { recorded = true; F.level(true); }
    sfx.win(); buzz([20, 40, 20]); ui.flash(0.6); confetti(scene, new V3(0, 1.2, 0), 100);
    D.won(you); B.submit(1);                                // world board: matches won vs the rival today
    state = 'won';
    if (chips >= target(level)) {
      const lv = level; level++; save.set('level', level);
      winP.style.display = ''; winH.textContent = 'CLEARED!';
      ui.win(lv, `${you} – ${riv} · +${fmt(a)} chips`);
    } else {
      winP.style.display = 'none'; winH.textContent = 'YOU WIN!';
      ui.win(level, `${you} – ${riv} · +${fmt(a)} chips · ${fmt(target(level) - chips)} more to clear`);
    }
  } else {
    if (!recorded) { recorded = true; F.level(false, you === riv ? 0.5 : clamp(you / Math.max(1, riv), 0, 1)); }
    state = 'lost';
    if (you === riv) { ui.lose('PUSH!', `Tie ${you} – ${riv} · antes returned`); sfx.pick(1); return; }
    chips -= a; save.set('chips', chips); sfx.fail(); buzz([40, 30, 60]);
    if (chips < ante(level)) { busted = true; ui.lose('OUT OF CHIPS', `${you} – ${riv} · tap for a fresh ${fmt(START)} chips`); }
    else ui.lose(`${rival[0].toUpperCase()} WINS`, `${you} – ${riv} · −${fmt(a)} chips · ${fmt(chips)} left`);
  }
  refresh();
}

// ---------------------------------------------------------------- input: tap dice (raycast)
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
renderer.domElement.addEventListener('pointerdown', e => {
  if (modal) return;
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(dice.map(d => d.m))[0];
  if (hit) toggleHold(hit.object.userData.die);
  else if (state === 'play' && phase === 'you' && !rolled) playerRoll();
});
ui.onTap(() => {
  if (busted) { busted = false; chips = START; save.set('chips', chips); ui.pop(`Fresh stack: ${fmt(START)} chips`, '#ffd23f', 34, 40); }
  document.body.classList.remove('ready');
  if (state === 'ready') { state = 'play'; sfx.tap(); refresh(); return; }
  state = 'play'; newMatch();
});

// ---------------------------------------------------------------- loop
loop((dt, t) => {
  stepDice(dt / 60);
  shake = Math.max(0, shake - dt * 0.04);
  camera.position.set(CAM.x + Math.sin(t * 0.5) * 0.06 + (Math.random() - 0.5) * 0.06 * shake, CAM.y, CAM.z + (Math.random() - 0.5) * 0.04 * shake);
  camera.lookAt(0, 0, 0.35);
  if (state === 'ready') dice.forEach((d, i) => { d.g.position.y = d.pos.y + Math.abs(Math.sin(t * 2.4 + i * 0.7)) * 0.25; });
});

newMatch(); phase = 'you'; refresh();
ui.start(); document.body.classList.add('ready');

// ---------------------------------------------------------------- test hooks
// bot: plays one full turn through the same player actions (roll → hold the best mask → roll → score the best box)
async function botTurn() {
  const id = matchId;
  while (state === 'play' && phase === 'you' && id === matchId) {
    if (!rolled) { if (!(await playerRoll())) await wait(400); continue; }
    const vals = dice.map(d => d.v);
    if (rollsLeft > 0) {
      const h = bestHold(P, vals);
      if (h.mask !== 31) { dice.forEach((d, i) => { if (d.held !== !!(h.mask >> i & 1)) toggleHold(i); }); await wait(250); if (!(await playerRoll())) await wait(400); continue; }
    }
    await wait(250); pickBox(bestBox(P, counts(vals)).cat); return;
  }
}
window.__game = {
  get state() { return state === 'end' ? 'play' : state; }, get level() { return level; }, get score() { return total(P); },
  bot() {
    fast = true;
    if (state !== 'play' || phase !== 'you' || anim() || botBusy) return;
    botBusy = true; botTurn().finally(() => { botBusy = false; });
  },
};
