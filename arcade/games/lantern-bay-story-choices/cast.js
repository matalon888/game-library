// Lantern Bay — the cast: Hero Lab characters (kit/heroes.js loadHero) that act out the scenes.
// The rigs have idle/run/sprint/jump/slide/cheer/fall clips; acting on top of them is procedural:
// talking = small head/torso beats while the line types; emotions = eased head/spine offsets (happy lifts the chin,
// sad drops it, think tilts, shock pulls back, angry leans in), cheer/jump play the real clips once.
import { loadHero, heroAssets } from './kit/heroes.js';

let THREE, GLTFLoader;
export const LOCAL_CHARS = ['p09', 'p05', 'p06', 'p14', 'p08', 'p04', 'p10'];
export const LOCAL_ASSETS = './assets/heroes/';
export function initCast(T, GL) { THREE = T; GLTFLoader = GL; }

const EMO = {   // head pitch (+ = down), head roll (tilt), spine pitch (+ = forward)
  '': [0, 0, 0], happy: [-0.1, 0.07, -0.03], laugh: [-0.22, 0.05, -0.08], sad: [0.32, 0.05, 0.12], angry: [0.1, 0, 0.16],
  shock: [-0.2, 0, -0.12], think: [0.06, 0.2, 0.02], shy: [0.24, 0.16, 0.05], cheer: [-0.1, 0, 0], jump: [-0.1, 0, 0],
};
const tmpQ = new Float32Array(0);

export async function makeActor(id, cfg, { hero = null, items = {}, hue, sat, bri } = {}) {
  const char = hero ? hero.char : cfg.char;
  const local = LOCAL_CHARS.includes(char) && (!hero || Object.values(hero.items || {}).every(x => !x || ['h02', 'f04', 'f01', 'w07', 'h05', 'h01'].includes(x) || x.startsWith('x_')));
  const h = hero ? { ...hero, items: { ...hero.items, ...items } } : { char, items: { head: null, face: null, back: null, hand: null, offhand: null, ...items }, hue: hue ?? 0, sat: sat ?? 1, bri: bri ?? 1, lockSkin: true };
  if (hue != null) { h.hue = hue; h.sat = sat ?? h.sat; h.bri = bri ?? h.bri; }
  const H = await loadHero(THREE, GLTFLoader, { hero: h, quality: 'game', height: cfg.h, assets: local ? LOCAL_ASSETS : heroAssets(), shadows: true });
  const o = H.object; o.name = 'actor-' + id;
  const bone = n => o.getObjectByName(n);
  const A = {
    id, H, o, cfg, head: bone('Head'), neck: bone('neck'), spine: bone('Spine02'), spine1: bone('Spine01'),
    emo: '', e: [0, 0, 0], talk: 0, talkT: 0, nod: 0, yaw: 0, yawT: 0, present: false, hop: 0, clip: 'idle', clipT: 0, breathe: Math.random() * 6,
    pos: new THREE.Vector3(), alpha: 0,
  };
  H.play('idle');
  // fade support: every material can go transparent while entering/leaving
  A.mats = []; o.traverse(m => { if (m.isMesh) for (const mm of [].concat(m.material)) A.mats.push(mm); });
  return A;
}

export function setEmo(A, emo) {
  A.emo = emo in EMO ? emo : '';
  if (emo === 'cheer' || emo === 'jump') { A.H.play(emo, { fade: 0.15 }); A.clip = emo; A.clipT = emo === 'cheer' ? 2.2 : 1.1; }
  if (emo === 'shock') A.hop = 1;
  if (emo === 'laugh') A.laughT = 1.2;
}
export function setFade(A, a) {
  A.alpha = a;
  for (const m of A.mats) { const t = a < 0.999; if (m.transparent !== t) { m.transparent = t; m.needsUpdate = true; } m.opacity = a; m.depthWrite = !t || a > 0.6; }
  A.o.visible = a > 0.01;
}
const qx = () => new THREE.Quaternion();
let QA, QB, AX, AY, AZ;
export function tickActor(A, dt, t) {
  if (!QA) { QA = qx(); QB = qx(); AX = new THREE.Vector3(1, 0, 0); AY = new THREE.Vector3(0, 1, 0); AZ = new THREE.Vector3(0, 0, 1); }
  if (!A.o.visible) return;
  if (A.clipT > 0) { A.clipT -= dt; if (A.clipT <= 0) { A.H.play('idle', { fade: 0.4 }); A.clip = 'idle'; } }
  A.H.mixer.update(dt);
  // ease the emotion offsets
  const tgt = EMO[A.emo] || EMO[''], k = 1 - Math.exp(-dt * 5);
  for (let i = 0; i < 3; i++) A.e[i] += (tgt[i] - A.e[i]) * k;
  A.talk += ((A.talkT > 0 ? 1 : 0) - A.talk) * (1 - Math.exp(-dt * 8)); A.talkT = Math.max(0, A.talkT - dt);
  A.hop = Math.max(0, A.hop - dt * 3); A.laughT = Math.max(0, (A.laughT || 0) - dt);
  A.nod = Math.max(0, A.nod - dt * 2.2);
  const talkP = A.talk * (Math.sin(t * 7.3 + A.breathe) * 0.045 + Math.sin(t * 3.1) * 0.03);
  const laughP = A.laughT > 0 ? Math.abs(Math.sin(t * 14)) * 0.06 * A.laughT : 0;
  const nodP = Math.sin((1 - A.nod) * Math.PI * 2) * 0.12 * A.nod;
  if (A.head) {
    QA.setFromAxisAngle(AX, A.e[0] + talkP - laughP + nodP - A.hop * 0.15);
    QB.setFromAxisAngle(AZ, A.e[1] + A.talk * Math.sin(t * 2.3) * 0.04); QA.multiply(QB);
    QB.setFromAxisAngle(AY, A.yaw); QA.multiply(QB);
    A.head.quaternion.multiply(QA);
  }
  if (A.spine) { QA.setFromAxisAngle(AX, A.e[2] + A.talk * Math.sin(t * 3.7) * 0.02 - A.hop * 0.12 + laughP * 0.6); A.spine.quaternion.multiply(QA); }
}
