// casino.js — shared table kit for the honest-casino games (blackjack, roulette, video-poker, holdem).
// Identical copy lives in each game folder. Our own code + art, MIT.
// Fairness: every shuffle / spin / draw uses crypto.getRandomValues with rejection sampling (no modulo bias).
// Nothing in here knows who the player is or how they have been doing.
import { THREE } from './kit/hc.js';

// ---------------------------------------------------------------- fair randomness
const U32 = new Uint32Array(1);
/** uniform integer in [0, n) from the browser's cryptographic RNG */
export function srand(n) {
  const lim = Math.floor(0x100000000 / n) * n;
  for (;;) { crypto.getRandomValues(U32); if (U32[0] < lim) return U32[0] % n; }
}
/** uniform float in [0, 1) from the cryptographic RNG */
export const sfloat = () => srand(0x40000000) / 0x40000000;
/** Fisher–Yates shuffle in place, crypto-backed */
export function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = srand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---------------------------------------------------------------- tweens (promise based, scaled by SPEED)
const TW = [];
export let SPEED = 1;
export const setSpeed = s => { SPEED = s; };
export const ease = { lin: k => k, out: k => 1 - Math.pow(1 - k, 3), inOut: k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2, back: k => { const c = 1.7; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); } };
export function tween(dur, fn, e = ease.inOut) { return new Promise(res => TW.push({ t: 0, dur: Math.max(1e-4, dur), fn, e, res })); }
export const wait = s => tween(s, () => {});
export function updateTweens(dtSec) {
  for (let i = TW.length - 1; i >= 0; i--) {
    const w = TW[i]; if (!w) continue; w.t += dtSec * SPEED; const k = Math.min(1, w.t / w.dur);
    w.fn(w.e(k)); if (k >= 1) { TW.splice(i, 1); w.res(); }
  }
}
const lerp = (a, b, t) => a + (b - a) * t;
/** fly an object to a position with an arc; optional target rotation (Euler-like {x,y,z}) */
export function fly(obj, to, { dur = 0.38, lift = 0.35, rot = null, e = ease.inOut } = {}) {
  const p0 = obj.position.clone(), r0 = obj.rotation.clone(), tv = to.clone ? to.clone() : new THREE.Vector3(to.x, to.y, to.z);
  return tween(dur, k => {
    obj.position.lerpVectors(p0, tv, k); obj.position.y += Math.sin(k * Math.PI) * lift;
    if (rot) obj.rotation.set(lerp(r0.x, rot.x ?? r0.x, k), lerp(r0.y, rot.y ?? r0.y, k), lerp(r0.z, rot.z ?? r0.z, k));
  }, e);
}

// ---------------------------------------------------------------- look: studio reflections, felt, labels
export function studio(stage, { warm = 1 } = {}) {
  const { renderer, scene, hemi, sun } = stage;
  const pm = new THREE.PMREMGenerator(renderer), env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial({ color: 0x1c1712, side: THREE.BackSide })));
  const panel = (w, h, x, y, z, c) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c[0], c[1], c[2]), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m); };
  panel(5, 3, 0, 4.9, 2.5, [4.2, 3.9 * warm, 3.4]); panel(3, 2, -4.9, 2, 2, [2, 1.8, 1.6]); panel(3, 2, 4.9, 2.5, -1, [1.4, 1.4, 1.7]); panel(5, 1.2, 0, 2.6, -4.9, [1.1, 1, 0.9]);
  scene.environment = pm.fromScene(env, 0.035).texture;
  hemi.intensity = 0.55; hemi.color.set('#fff3e0'); hemi.groundColor.set('#3a2a20');
  sun.intensity = 1.55; sun.color.set('#fff1dc');
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
  return scene.environment;
}
export function canvasTex(w, h, draw, aniso = 8) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); draw(x, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t;
}
/** a felt cloth: radial gradient, fibre noise, vignette; `print(ctx, W, H)` adds table printing */
export function feltTexture(W, H, c1, c2, print) {
  return canvasTex(W, H, (x) => {
    const g = x.createRadialGradient(W / 2, H * 0.48, 10, W / 2, H * 0.5, Math.max(W, H) * 0.62);
    g.addColorStop(0, c1); g.addColorStop(1, c2); x.fillStyle = g; x.fillRect(0, 0, W, H);
    let s = 1234567; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < W * H / 40; i++) { x.fillStyle = r() < .5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.05)'; x.fillRect(r() * W, r() * H, 1 + r() * 2, 1); }
    print && print(x, W, H);
  });
}
export function goldText(x, text, px, y, size, { font = 'Georgia, "Times New Roman", serif', weight = 'bold', color = 'rgba(244,206,120,.85)', track = 2 } = {}) {
  x.save(); x.font = `${weight} ${size}px ${font}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = color;
  if ('letterSpacing' in x) x.letterSpacing = track + 'px'; x.fillText(text, px, y); x.restore();
}
/** text along an arc (centre cx,cy, radius R, centred at angle a0 (rad, 0 = down)) */
export function arcText(x, text, cx, cy, R, size, color = 'rgba(244,206,120,.85)', font = 'bold {s}px Georgia, serif') {
  x.save(); x.font = font.replace('{s}', size); x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle';
  const widths = [...text].map(ch => x.measureText(ch).width + 2), tot = widths.reduce((a, b) => a + b, 0);
  let a = Math.PI / 2 + tot / R / 2;
  [...text].forEach((ch, i) => { const w = widths[i]; a -= w / R / 2; x.save(); x.translate(cx + Math.cos(a) * R, cy + Math.sin(a) * R); x.rotate(a - Math.PI / 2); x.fillText(ch, 0, 0); x.restore(); a -= w / R / 2; });
  x.restore();
}
/** billboard pill label (sprite) with .set(text, bg, fg) */
export function label(w = 0.9, h = 0.34) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96; const x = c.getContext('2d');
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
  sp.scale.set(w, h, 1); sp.renderOrder = 10;
  sp.set = (text, bg = 'rgba(16,14,20,.82)', fg = '#fff') => {
    x.clearRect(0, 0, 256, 96); if (!text) { sp.visible = false; return; } sp.visible = true;
    x.font = '800 54px "Baloo 2", system-ui, sans-serif'; const tw = Math.min(236, x.measureText(text).width + 44), x0 = 128 - tw / 2;
    x.fillStyle = 'rgba(0,0,0,.25)'; rr(x, x0, 12, tw, 76, 38); x.fill();
    x.fillStyle = bg; rr(x, x0, 6, tw, 76, 38); x.fill();
    x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128, 47, 220); t.needsUpdate = true;
  };
  sp.set(''); return sp;
}
export function rr(x, X, Y, W, H, R) { x.beginPath(); x.moveTo(X + R, Y); x.arcTo(X + W, Y, X + W, Y + H, R); x.arcTo(X + W, Y + H, X, Y + H, R); x.arcTo(X, Y + H, X, Y, R); x.arcTo(X, Y, X + W, Y, R); x.closePath(); }

// ---------------------------------------------------------------- cards (original art: our own pips, faces and back)
export const RED = '#c8243a', INK = '#1c1b24';
export const RANK_TXT = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
export const rankTxt = r => RANK_TXT[r] || String(r);
export const SUIT_CH = ['♠', '♥', '♦', '♣'];
export const isRed = s => s === 1 || s === 2;
export function suitPath(x, s, cx, cy, size) {
  x.save(); x.translate(cx, cy); x.scale(size / 100, size / 100); x.beginPath();
  if (s === 1) { x.moveTo(0, 46); x.bezierCurveTo(-58, 4, -54, -46, -25, -46); x.bezierCurveTo(-10, -46, 0, -36, 0, -22); x.bezierCurveTo(0, -36, 10, -46, 25, -46); x.bezierCurveTo(54, -46, 58, 4, 0, 46); }
  else if (s === 2) { x.moveTo(0, -50); x.quadraticCurveTo(14, -22, 38, 0); x.quadraticCurveTo(14, 22, 0, 50); x.quadraticCurveTo(-14, 22, -38, 0); x.quadraticCurveTo(-14, -22, 0, -50); }
  else if (s === 0) { x.moveTo(0, -50); x.bezierCurveTo(-12, -28, -56, -8, -50, 16); x.bezierCurveTo(-45, 38, -16, 40, -6, 22); x.lineTo(-16, 50); x.lineTo(16, 50); x.lineTo(6, 22); x.bezierCurveTo(16, 40, 45, 38, 50, 16); x.bezierCurveTo(56, -8, 12, -28, 0, -50); }
  else { x.arc(0, -22, 22, 0, Math.PI * 2); x.moveTo(-2, 12); x.arc(-24, 12, 22, 0, Math.PI * 2); x.moveTo(46, 12); x.arc(24, 12, 22, 0, Math.PI * 2); x.moveTo(0, 0); x.lineTo(-15, 50); x.lineTo(15, 50); x.closePath(); }
  x.fill(); x.restore();
}
const PIPS = { 2: [[.5, .18], [.5, .82]], 3: [[.5, .18], [.5, .5], [.5, .82]], 4: [[.28, .18], [.72, .18], [.28, .82], [.72, .82]] };
PIPS[5] = [...PIPS[4], [.5, .5]]; PIPS[6] = [...PIPS[4], [.28, .5], [.72, .5]]; PIPS[7] = [...PIPS[6], [.5, .34]]; PIPS[8] = [...PIPS[7], [.5, .66]];
PIPS[9] = [...PIPS[4], [.28, .39], [.72, .39], [.28, .61], [.72, .61], [.5, .5]]; PIPS[10] = [...PIPS[4], [.28, .39], [.72, .39], [.28, .61], [.72, .61], [.5, .29], [.5, .71]];
export const CW = 0.64, CH = 0.9;      // card size in world units
const TW_ = 256, TH_ = 360;
function cardFace(x, card) {
  const { r, s } = card, col = isRed(s) ? RED : INK;
  const g = x.createLinearGradient(0, 0, 0, TH_); g.addColorStop(0, '#fffdf8'); g.addColorStop(1, '#f3eee4');
  x.fillStyle = g; rr(x, 2, 2, TW_ - 4, TH_ - 4, 22); x.fill();
  x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 2; x.stroke();
  const idx = () => {
    x.fillStyle = col; x.font = `bold ${r === 10 ? 50 : 56}px Georgia, "Times New Roman", serif`; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    x.fillText(rankTxt(r), 34, 64); suitPath(x, s, 34, 92, 34);
  };
  idx(); x.save(); x.translate(TW_, TH_); x.rotate(Math.PI); idx(); x.restore();
  const ax = 46, ay = 34, aw = TW_ - 92, ah = TH_ - 68;
  x.fillStyle = col;
  if (r <= 10) {
    for (const [px, py] of PIPS[r]) { x.save(); x.translate(ax + px * aw, ay + py * ah); if (py > .55) x.rotate(Math.PI); suitPath(x, s, 0, 0, 40); x.restore(); }
  } else if (r === 14) {
    suitPath(x, s, TW_ / 2, TH_ / 2, s === 0 ? 120 : 96);
    if (s === 0) { x.strokeStyle = '#d9b45a'; x.lineWidth = 3; x.beginPath(); x.arc(TW_ / 2, TH_ / 2, 78, 0, Math.PI * 2); x.stroke(); }
  } else {
    // original court cards: framed panel, two-tone band, a geometric emblem, the letter and a suit pip
    const tint = isRed(s) ? ['#f6d6d9', '#c8243a', '#7e1426'] : ['#d9dcef', '#2f3a72', '#141a3a'];
    x.fillStyle = tint[0]; rr(x, ax, ay, aw, ah, 10); x.fill();
    x.strokeStyle = tint[1]; x.lineWidth = 4; x.stroke();
    x.save(); rr(x, ax, ay, aw, ah, 10); x.clip();
    x.fillStyle = tint[1]; x.globalAlpha = .9; x.beginPath(); x.moveTo(ax, ay + ah * .5 - 22); x.lineTo(ax + aw, ay + ah * .5 + 22); x.lineTo(ax + aw, ay + ah * .5 + 44); x.lineTo(ax, ay + ah * .5); x.fill();
    x.globalAlpha = 1; x.fillStyle = '#e7b94a';
    // emblem: crown (K), star (Q), shield (J)
    const cx = TW_ / 2, cy = ay + ah * .27;
    x.beginPath();
    if (r === 13) { x.moveTo(cx - 40, cy + 22); x.lineTo(cx - 44, cy - 18); x.lineTo(cx - 20, cy); x.lineTo(cx, cy - 28); x.lineTo(cx + 20, cy); x.lineTo(cx + 44, cy - 18); x.lineTo(cx + 40, cy + 22); }
    else if (r === 12) { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, R = i % 2 ? 16 : 36; x.lineTo(cx + Math.cos(a) * R, cy + 4 + Math.sin(a) * R); } }
    else { x.moveTo(cx - 30, cy - 26); x.lineTo(cx + 30, cy - 26); x.lineTo(cx + 30, cy + 4); x.quadraticCurveTo(cx + 26, cy + 26, cx, cy + 34); x.quadraticCurveTo(cx - 26, cy + 26, cx - 30, cy + 4); }
    x.closePath(); x.fill(); x.strokeStyle = tint[2]; x.lineWidth = 3; x.stroke();
    x.restore();
    x.fillStyle = tint[2]; x.font = 'bold 96px Georgia, "Times New Roman", serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(rankTxt(r), TW_ / 2, ay + ah * .66);
    x.fillStyle = col; suitPath(x, s, TW_ / 2, ay + ah * .88, 30);
  }
}
const FACE_CACHE = new Map(), BACK_CACHE = new Map();
const cardShapeAlpha = (x) => { x.globalCompositeOperation = 'destination-in'; x.fillStyle = '#000'; rr(x, 2, 2, TW_ - 4, TH_ - 4, 22); x.fill(); x.globalCompositeOperation = 'source-over'; };
export function faceTex(card) {
  const k = card.r * 4 + card.s; if (!FACE_CACHE.has(k)) FACE_CACHE.set(k, canvasTex(TW_, TH_, x => { cardFace(x, card); cardShapeAlpha(x); }));
  return FACE_CACHE.get(k);
}
export function backTex(color = '#8c1c2c', mark = 'A') {
  const k = color + mark; if (BACK_CACHE.has(k)) return BACK_CACHE.get(k);
  const t = canvasTex(TW_, TH_, x => {
    x.fillStyle = '#fbf7ef'; rr(x, 2, 2, TW_ - 4, TH_ - 4, 22); x.fill();
    x.fillStyle = color; rr(x, 16, 16, TW_ - 32, TH_ - 32, 14); x.fill();
    x.save(); rr(x, 16, 16, TW_ - 32, TH_ - 32, 14); x.clip();
    x.strokeStyle = 'rgba(255,255,255,.22)'; x.lineWidth = 3;
    for (let i = -TH_; i < TW_ + TH_; i += 22) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + TH_, TH_); x.stroke(); x.beginPath(); x.moveTo(i, TH_); x.lineTo(i + TH_, 0); x.stroke(); }
    x.restore();
    x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 3; rr(x, 26, 26, TW_ - 52, TH_ - 52, 10); x.stroke();
    // centre medallion: rotation-symmetric (reads the same face-down either way), brand initial in two mirrored corners
    x.fillStyle = '#fbf7ef'; x.beginPath(); x.arc(TW_ / 2, TH_ / 2, 46, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#e1b860'; x.lineWidth = 4; x.beginPath(); x.arc(TW_ / 2, TH_ / 2, 38, 0, Math.PI * 2); x.stroke();
    x.fillStyle = color; suitPath(x, 2, TW_ / 2, TH_ / 2, 50);
    x.fillStyle = 'rgba(255,255,255,.85)'; x.font = 'bold 30px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(mark, 52, 58); x.save(); x.translate(TW_ - 52, TH_ - 58); x.rotate(Math.PI); x.fillText(mark, 0, 0); x.restore();
    cardShapeAlpha(x);
  });
  BACK_CACHE.set(k, t); return t;
}
const CARD_PLANE = new THREE.PlaneGeometry(CW, CH);
/** a card lying flat on the table (face up when rotation.z = 0, face down when rotation.z = PI). .setCard(card) */
export function cardMesh(card, back = '#8c1c2c', mark = 'A') {
  const g = new THREE.Group();
  const fm = new THREE.MeshPhysicalMaterial({ map: card ? faceTex(card) : null, transparent: false, alphaTest: 0.5, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.35 });
  const bm = new THREE.MeshPhysicalMaterial({ map: backTex(back, mark), alphaTest: 0.5, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.3 });
  const f = new THREE.Mesh(CARD_PLANE, fm); f.rotation.x = -Math.PI / 2; f.position.y = 0.002; f.castShadow = true; f.receiveShadow = true;
  const b = new THREE.Mesh(CARD_PLANE, bm); b.rotation.x = Math.PI / 2; b.position.y = -0.002; b.castShadow = true;
  g.add(f, b); g.front = f; g.card = card;
  g.setCard = c => { g.card = c; fm.map = c ? faceTex(c) : null; fm.needsUpdate = true; };
  g.dispose = () => { fm.dispose(); bm.dispose(); };
  return g;
}
export function makeDeck(n = 1) { const d = []; for (let k = 0; k < n; k++) for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) d.push({ r, s }); return d; }
export const cardName = c => rankTxt(c.r) + SUIT_CH[c.s];

// ---------------------------------------------------------------- chips (original design: edge inserts, inlay, value)
export const DENOMS = [
  { v: 1, c: '#e9e6df', e: '#2f6fd6', t: '#2f3a72' }, { v: 5, c: '#d42b3a', e: '#ffffff', t: '#7e1426' }, { v: 25, c: '#1d9a5b', e: '#ffffff', t: '#0e5a34' },
  { v: 100, c: '#25232c', e: '#f1d27a', t: '#25232c' }, { v: 500, c: '#7a3fd8', e: '#ffffff', t: '#45208a' }, { v: 1000, c: '#e3a62a', e: '#7a1f1f', t: '#7a4b0a' },
  { v: 5000, c: '#f06a2a', e: '#ffffff', t: '#8a3510' }, { v: 25000, c: '#14a5b5', e: '#ffffff', t: '#0b5e68' }, { v: 100000, c: '#e8507e', e: '#ffffff', t: '#8a1f45' },
];
export const denom = v => DENOMS.find(d => d.v === v) || DENOMS[0];
export const fmt = n => { n = Math.round(n); if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 ? 2 : 0).replace(/\.?0+$/, '') + 'M'; return n.toLocaleString('en-US'); };
const shortV = v => v >= 1000 ? (v / 1000) + 'K' : String(v);
export function chipTopCanvas(d, S = 256) {
  const c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), m = S / 2;
  x.fillStyle = d.c; x.beginPath(); x.arc(m, m, m, 0, Math.PI * 2); x.fill();
  for (let i = 0; i < 6; i++) { x.save(); x.translate(m, m); x.rotate(i * Math.PI / 3); x.fillStyle = d.e; rr(x, -S * .07, -m + 2, S * .14, S * .16, 6); x.fill(); x.restore(); }
  x.strokeStyle = 'rgba(255,255,255,.75)'; x.setLineDash([S * .035, S * .03]); x.lineWidth = S * .025; x.beginPath(); x.arc(m, m, m * .7, 0, Math.PI * 2); x.stroke(); x.setLineDash([]);
  const g = x.createRadialGradient(m, m * .9, 2, m, m, m * .56); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#ece6d8');
  x.fillStyle = g; x.beginPath(); x.arc(m, m, m * .56, 0, Math.PI * 2); x.fill();
  x.strokeStyle = d.c; x.lineWidth = S * .02; x.beginPath(); x.arc(m, m, m * .5, 0, Math.PI * 2); x.stroke();
  const s = shortV(d.v); x.fillStyle = d.t; x.font = `800 ${s.length > 3 ? S * .2 : S * .26}px "Baloo 2", system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(s, m, m + S * .02);
  return c;
}
const CHIP_MATS = new Map();
export const CHIP_R = 0.2, CHIP_H = 0.05;
// one geometry + one material per denomination: caps and edge share a single atlas texture (1 draw call per chip)
export const CHIP_GEO = (() => {
  const g = new THREE.CylinderGeometry(CHIP_R, CHIP_R, CHIP_H, 40, 1), uv = g.attributes.uv;
  const seen = new Set();
  g.groups.forEach((gr, gi) => {
    for (let i = gr.start; i < gr.start + gr.count; i++) {
      const vi = g.index.getX(i); if (seen.has(vi)) continue; seen.add(vi);
      const u = uv.getX(vi), v = uv.getY(vi);
      if (gi === 0) uv.setXY(vi, u, 0.05 + v * 0.1); else uv.setXY(vi, u, 0.2 + v * 0.8);
    }
  });
  g.clearGroups(); return g;
})();
export function chipMat(v) {
  const d = denom(v); if (CHIP_MATS.has(d.v)) return CHIP_MATS.get(d.v);
  const top = chipTopCanvas(d), t = canvasTex(256, 320, (x) => {
    x.drawImage(top, 0, 0, 256, 256);
    x.fillStyle = d.c; x.fillRect(0, 256, 256, 64); x.fillStyle = d.e; for (let i = 0; i < 6; i++) x.fillRect(i * 256 / 6 + 256 / 24, 256, 256 / 18, 64);
  });
  const m = new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.16 });
  CHIP_MATS.set(d.v, m); return m;
}
export function chipMesh(v) { const m = new THREE.Mesh(CHIP_GEO, chipMat(v)); m.castShadow = true; m.receiveShadow = true; m.userData.v = v; return m; }
/** decorative rack/tray: rows of chip columns using one InstancedMesh per value. cols: [{v, n, x, z}] */
export function chipRack(cols) {
  const g = new THREE.Group(), byV = {};
  for (const c of cols) (byV[c.v] = byV[c.v] || []).push(c);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), S = new THREE.Vector3(1, 1, 1);
  for (const v in byV) {
    const list = byV[v], total = list.reduce((a, c) => a + c.n, 0), im = new THREE.InstancedMesh(CHIP_GEO, chipMat(+v), total); let k = 0;
    for (const c of list) for (let i = 0; i < c.n; i++) { Q.setFromAxisAngle(Y, (i * 1.37 + c.x) % 6.28); M.compose(new THREE.Vector3(c.x, CHIP_H / 2 + i * CHIP_H * 1.02, c.z), Q, S); im.setMatrixAt(k++, M); }
    im.castShadow = true; im.receiveShadow = true; g.add(im);
  }
  return g;
}
/** split an amount into chip values (largest first), at most `cap` chips */
export function breakdown(amount, cap = 14) {
  const out = []; let a = Math.round(amount);
  for (let i = DENOMS.length - 1; i >= 0 && out.length < cap; i--) { const v = DENOMS[i].v; while (a >= v && out.length < cap) { out.push(v); a -= v; } }
  return out;
}
/** a neat stack (or two side-by-side stacks when tall) for an amount; group.amount */
export function chipStack(amount, { cap = 14, col = 7 } = {}) {
  const g = new THREE.Group(), vals = breakdown(amount, cap).reverse(); g.amount = amount;
  vals.forEach((v, i) => { const m = chipMesh(v), c = Math.floor(i / col), h = i % col; m.position.set(c * (CHIP_R * 2.05) - (vals.length > col ? CHIP_R : 0), CHIP_H / 2 + h * CHIP_H * 1.02, 0); m.rotation.y = (i * 1.37) % 6.28; g.add(m); });
  return g;
}

// ---------------------------------------------------------------- sound (synth only)
let AC;
const ac = () => { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) {} return AC; };
let nseed = 99;
function noiseBuf(a) { const b = a.createBuffer(1, a.sampleRate * 0.3, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) { nseed = (nseed * 16807) % 2147483647; d[i] = nseed / 1073741823.5 - 1; } return b; }
let NB;
export function noise(dur = 0.06, vol = 0.2, freq = 3000, q = 1, delay = 0) {
  const a = ac(); if (!a) return; try {
    NB = NB || noiseBuf(a); const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(), n = a.currentTime + delay;
    s.buffer = NB; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, n); g.gain.exponentialRampToValueAtTime(0.001, n + dur);
    s.connect(f); f.connect(g); g.connect(a.destination); s.start(n, (nseed % 97) / 1000); s.stop(n + dur + 0.02);
  } catch (e) {}
}
export function ping(f = 1200, dur = 0.12, vol = 0.06, type = 'sine', delay = 0) {
  const a = ac(); if (!a) return; try {
    const o = a.createOscillator(), g = a.createGain(), n = a.currentTime + delay; o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(vol, n); g.gain.exponentialRampToValueAtTime(0.001, n + dur); o.connect(g); g.connect(a.destination); o.start(n); o.stop(n + dur + 0.02);
  } catch (e) {}
}
export const csfx = {
  card: () => noise(0.07, 0.35, 2600, 0.7),
  flip: () => { noise(0.05, 0.25, 3800, 1); },
  chip: (n = 1) => { for (let i = 0; i < Math.min(n, 4); i++) { noise(0.035, 0.28, 5200, 3, i * 0.045); ping(2900 + i * 90, 0.05, 0.035, 'triangle', i * 0.045); } },
  tick: () => { noise(0.02, 0.18, 6000, 4); },
  win: () => [659, 784, 988, 1319].forEach((f, i) => ping(f, 0.22, 0.07, 'triangle', i * 0.09)),
  big: () => [523, 659, 784, 1046, 1319, 1568].forEach((f, i) => ping(f, 0.3, 0.08, 'triangle', i * 0.08)),
  lose: () => { ping(330, 0.18, 0.06, 'triangle'); ping(262, 0.3, 0.06, 'triangle', 0.14); },
  push: () => ping(520, 0.12, 0.05, 'triangle'),
  button: () => ping(700, 0.05, 0.05, 'triangle'),
};

// ---------------------------------------------------------------- poker hand evaluation (5–7 cards)
const B5 = [50625, 3375, 225, 15, 1];
const P = (cat, ks) => { let v = cat * 759375; ks.forEach((k, i) => { v += k * B5[i]; }); return v; };
export const HAND_NAMES = ['High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush'];
const stTop = m => { if (m & (1 << 14)) m |= 2; for (let t = 14; t >= 5; t--) { const need = 0x1f << (t - 4); if ((m & need) === need) return t; } return 0; };
/** returns a comparable integer; higher is better. cat = Math.floor(v / 759375) */
export function evalHand(cards) {
  const rc = new Array(15).fill(0), sc = [0, 0, 0, 0], sm = [0, 0, 0, 0]; let mask = 0;
  for (const c of cards) { rc[c.r]++; sc[c.s]++; sm[c.s] |= 1 << c.r; mask |= 1 << c.r; }
  let fs = -1;
  for (let s = 0; s < 4; s++) if (sc[s] >= 5) { const t = stTop(sm[s]); if (t) return P(8, [t]); fs = s; }
  const quads = [], trips = [], pairs = [], singles = [];
  for (let r = 14; r >= 2; r--) { if (rc[r] === 4) quads.push(r); else if (rc[r] === 3) trips.push(r); else if (rc[r] === 2) pairs.push(r); else if (rc[r] === 1) singles.push(r); }
  const kick = (ex, n) => { const o = []; for (let r = 14; r >= 2 && o.length < n; r--) if (rc[r] && !ex.includes(r)) o.push(r); return o; };
  if (quads.length) return P(7, [quads[0], ...kick([quads[0]], 1)]);
  if (trips.length && (trips.length > 1 || pairs.length)) return P(6, [trips[0], Math.max(trips[1] || 0, pairs[0] || 0)]);
  if (fs >= 0) { const o = []; for (let r = 14; r >= 2 && o.length < 5; r--) if (sm[fs] & (1 << r)) o.push(r); return P(5, o); }
  const st = stTop(mask); if (st) return P(4, [st]);
  if (trips.length) return P(3, [trips[0], ...kick([trips[0]], 2)]);
  if (pairs.length >= 2) return P(2, [pairs[0], pairs[1], ...kick([pairs[0], pairs[1]], 1)]);
  if (pairs.length) return P(1, [pairs[0], ...kick([pairs[0]], 3)]);
  return P(0, kick([], 5));
}
export const handCat = v => Math.floor(v / 759375);
export const handKey = (v, i) => Math.floor(v / B5[i]) % 15;     // i-th kicker (0 = primary)

// ---------------------------------------------------------------- DOM UI (action bar, chip buttons, odds panel, footer)
const CSS = `
.cz-bar{position:fixed;left:0;right:0;bottom:calc(18px + env(safe-area-inset-bottom));display:flex;gap:10px;justify-content:center;align-items:center;z-index:7;padding:0 14px;transition:transform .25s,opacity .25s}
.cz-bar.off{transform:translateY(30px);opacity:0;pointer-events:none}
.cz-bar.row2{bottom:calc(92px + env(safe-area-inset-bottom))}
.cz-b{flex:1;max-width:132px;min-width:0;height:58px;border-radius:20px;font:800 19px/1 'Baloo 2',system-ui,sans-serif;color:#fff;border:0;cursor:pointer;
  background:linear-gradient(180deg,#ffcf5a,#f19a1b);box-shadow:inset 0 2px 0 rgba(255,255,255,.55),0 5px 0 #a35f07,0 12px 18px rgba(0,0,0,.4);text-shadow:0 2px 0 rgba(0,0,0,.25);letter-spacing:.3px}
.cz-b small{display:block;font-size:12px;font-weight:600;opacity:.9;margin-top:2px}
.cz-b:active{transform:translateY(3px);box-shadow:inset 0 2px 0 rgba(255,255,255,.55),0 2px 0 #a35f07,0 6px 10px rgba(0,0,0,.4)}
.cz-b.red{background:linear-gradient(180deg,#ff6f7d,#d8283c);box-shadow:inset 0 2px 0 rgba(255,255,255,.45),0 5px 0 #8b1222,0 12px 18px rgba(0,0,0,.4)}
.cz-b.green{background:linear-gradient(180deg,#5fe3a1,#18a55e);box-shadow:inset 0 2px 0 rgba(255,255,255,.45),0 5px 0 #0b6a3a,0 12px 18px rgba(0,0,0,.4)}
.cz-b.blue{background:linear-gradient(180deg,#6fb6ff,#2f6fd6);box-shadow:inset 0 2px 0 rgba(255,255,255,.45),0 5px 0 #1a4590,0 12px 18px rgba(0,0,0,.4)}
.cz-b.dark{background:linear-gradient(180deg,#4a4658,#2a2734);box-shadow:inset 0 2px 0 rgba(255,255,255,.2),0 5px 0 #15131b,0 12px 18px rgba(0,0,0,.4)}
.cz-b[disabled]{filter:grayscale(.85) brightness(.75);opacity:.45;pointer-events:none}
.cz-chipb{width:58px;height:58px;flex:0 0 58px;border-radius:50%;border:0;padding:0;cursor:pointer;background-size:cover;box-shadow:0 4px 0 rgba(0,0,0,.45),0 10px 14px rgba(0,0,0,.35);transition:transform .15s;position:relative}
.cz-chipb::after{content:'';position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 34% 28%,rgba(255,255,255,.55),rgba(255,255,255,0) 42%)}
.cz-chipb.sel{transform:translateY(-8px) scale(1.08);box-shadow:0 0 0 3px #ffe08a,0 10px 0 rgba(0,0,0,.35),0 16px 22px rgba(0,0,0,.35)}
.cz-chipb[disabled]{filter:grayscale(.75) brightness(.55);pointer-events:none}
.cz-odds{position:fixed;top:calc(64px + env(safe-area-inset-top));left:12px;z-index:12;font:800 14px 'Baloo 2',system-ui;color:#fff;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.25);border-radius:14px;padding:4px 12px;cursor:pointer;backdrop-filter:blur(6px)}
.cz-panel{position:fixed;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;background:rgba(6,8,12,.6);backdrop-filter:blur(4px);padding:18px}
.cz-panel>div{max-width:380px;width:100%;max-height:84vh;overflow:auto;background:linear-gradient(180deg,#fffaf0,#f3ead6);color:#2a2230;border-radius:22px;padding:18px 18px 14px;font:500 14px/1.38 system-ui,sans-serif;box-shadow:0 20px 50px rgba(0,0,0,.5);touch-action:pan-y}
.cz-panel h2{margin:0 0 6px;font:800 24px/1.1 'Baloo 2',system-ui}
.cz-panel h3{margin:12px 0 4px;font:800 15px/1.1 'Baloo 2',system-ui;color:#7a4b0a;text-transform:uppercase;letter-spacing:.6px}
.cz-panel table{width:100%;border-collapse:collapse;font-size:13.5px}.cz-panel td{padding:3px 4px;border-bottom:1px solid rgba(0,0,0,.08)}.cz-panel td:last-child{text-align:right;font-weight:700}
.cz-panel p{margin:4px 0}.cz-panel .edge{background:#2a2230;color:#ffe08a;border-radius:12px;padding:8px 10px;margin:10px 0 4px;font-weight:700}
.cz-panel button{margin-top:12px;width:100%;height:46px;border:0;border-radius:14px;background:#2a2230;color:#fff;font:800 17px 'Baloo 2',system-ui;cursor:pointer}
.cz-free{position:absolute;left:0;right:0;bottom:calc(18px + env(safe-area-inset-bottom));font-size:14px!important;font-weight:600;opacity:.8;letter-spacing:.4px}
.cz-tag{font-size:17px!important;opacity:.92;max-width:320px}
.cz-msg{position:fixed;left:50%;top:var(--msg-top,44%);transform:translate(-50%,-50%);z-index:6;pointer-events:none;font:800 30px 'Baloo 2',system-ui;color:#fff;text-shadow:0 3px 0 rgba(0,0,0,.35),0 0 24px rgba(0,0,0,.4);opacity:0;transition:opacity .25s,transform .25s;white-space:nowrap}
.cz-msg.on{opacity:1;transform:translate(-50%,-50%) scale(1.04)}
.hc-score{font-size:42px!important}
.hc-sub{font-size:14px!important}
.hc-card h1{font-size:clamp(40px,12vw,68px)!important}
`;
export function installCSS() { if (document.getElementById('cz-css')) return; const s = document.createElement('style'); s.id = 'cz-css'; s.textContent = CSS; document.head.appendChild(s); }
export function h(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; }
/** a bottom bar of buttons. defs: [{id, text, cls, sub}] -> {el, b:{id: button}, show(on)} */
export function bar(defs, { row2 = false } = {}) {
  installCSS();
  const el = h(`<div class="cz-bar off ${row2 ? 'row2' : ''}"></div>`), b = {};
  for (const d of defs) {
    const btn = h(`<button class="cz-b ${d.cls || ''}">${d.text}${d.sub ? `<small>${d.sub}</small>` : ''}</button>`);
    btn.addEventListener('pointerdown', e => e.stopPropagation());
    btn.addEventListener('click', e => { e.stopPropagation(); csfx.button(); d.on && d.on(); });
    b[d.id] = btn; el.appendChild(btn);
  }
  document.body.appendChild(el);
  return { el, b, show(on) { el.classList.toggle('off', !on); }, text(id, t, sub) { b[id].innerHTML = t + (sub ? `<small>${sub}</small>` : ''); }, enable(id, on) { b[id].disabled = !on; } };
}
/** a row of chip-selector buttons; onPick(v) */
export function chipBar(values, onPick, { row2 = true } = {}) {
  installCSS();
  const el = h(`<div class="cz-bar off ${row2 ? 'row2' : ''}"></div>`), btns = {};
  let sel = values[0];
  const set = (vals) => {
    el.innerHTML = ''; for (const k in btns) delete btns[k];
    for (const v of vals) {
      const b = h(`<button class="cz-chipb" aria-label="${v}"></button>`); b.style.backgroundImage = `url(${chipTopCanvas(denom(v), 128).toDataURL()})`;
      b.addEventListener('pointerdown', e => e.stopPropagation());
      b.addEventListener('click', e => { e.stopPropagation(); onPick(v); });
      btns[v] = b; el.appendChild(b);
    }
  };
  set(values);
  document.body.appendChild(el);
  return {
    el, btns, set, show(on) { el.classList.toggle('off', !on); },
    select(v) { sel = v; for (const k in btns) btns[k].classList.toggle('sel', +k === v); }, get sel() { return sel; },
    limit(max) { for (const k in btns) btns[k].disabled = +k > max; },
  };
}
/** the "Odds" pill + modal: tells the truth about rules, payouts and house edge */
export function oddsPanel(html, onOpen) {
  installCSS();
  const btn = h(`<button class="cz-odds">Odds</button>`), panel = h(`<div class="cz-panel hc-hidden"><div>${html}<button>Got it</button></div></div>`);
  const close = () => panel.classList.add('hc-hidden');
  btn.addEventListener('pointerdown', e => e.stopPropagation());
  btn.addEventListener('click', e => { e.stopPropagation(); panel.classList.remove('hc-hidden'); onOpen && onOpen(); });
  panel.addEventListener('pointerdown', e => { e.stopPropagation(); if (e.target === panel || e.target.tagName === 'BUTTON') close(); });
  document.body.append(btn, panel);
  return { btn, panel, close, set(html2) { panel.firstElementChild.innerHTML = html2 + '<button>Got it</button>'; } };
}
/** start-card tagline + the honest footer */
export function startExtras(ui, tagline) {
  installCSS();
  const st = ui.els.start;
  if (tagline) st.querySelector('.hint').before(h(`<p class="cz-tag">${tagline}</p>`));
  st.appendChild(h(`<p class="cz-free">Free play · no real money</p>`));
}
export function message() {
  installCSS(); const el = h(`<div class="cz-msg"></div>`); document.body.appendChild(el); let to;
  return (t, ms = 1100, color = '#fff') => { el.textContent = t; el.style.color = color; el.classList.add('on'); clearTimeout(to); to = setTimeout(() => el.classList.remove('on'), ms / SPEED); };
}
/** dark casino backdrop behind the canvas */
export function backdrop(c1 = '#20323a', c2 = '#07090c') {
  const s = document.body.style; s.setProperty('--bg1', c1); s.setProperty('--bg2', c2);
  s.background = `radial-gradient(120% 70% at 50% 30%, ${c1}, ${c2})`;
}
