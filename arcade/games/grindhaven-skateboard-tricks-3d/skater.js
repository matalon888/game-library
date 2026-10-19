// skater.js — "Pip", Grindhaven's original cartoon skater (big helmet, hoodie, baggy pants) and a board with
// swappable deck graphics. Everything is three.js primitives. The rider stands sideways on the board, chest to +x.
import { THREE, mat, rounded } from './kit/hc.js';

export const DECKS = [
  { id: 'plain', name: 'Maple', need: 0, a: '#f4c27a', b: '#e0a95c', style: 'grain' },
  { id: 'sun', name: 'Sunburst', need: 2, a: '#ff8c42', b: '#ffd23f', style: 'sun' },
  { id: 'wave', name: 'Tide', need: 4, a: '#2ec4b6', b: '#e6fffb', style: 'wave' },
  { id: 'check', name: 'Checker', need: 6, a: '#2b2d42', b: '#ffffff', style: 'check' },
  { id: 'bolt', name: 'Zap', need: 8, a: '#7b5cff', b: '#ffd23f', style: 'bolt' },
  { id: 'stars', name: 'Night Stars', need: 10, a: '#1b263b', b: '#ffd23f', style: 'stars' },
  { id: 'candy', name: 'Candy', need: 12, a: '#ff5d8f', b: '#ffffff', style: 'stripe' },
  { id: 'gold', name: 'Gold Leaf', need: 15, a: '#ffcf3a', b: '#b8860b', style: 'grain' },
];
export const OUTFITS = [
  { hoodie: '#ff5d8f', pants: '#3d405b', helmet: '#ffd23f', shoe: '#ffffff' },
  { hoodie: '#2ec4b6', pants: '#2b2d42', helmet: '#ff5d8f', shoe: '#ffd23f' },
  { hoodie: '#ffd23f', pants: '#3a86ff', helmet: '#7b5cff', shoe: '#ffffff' },
];

function deckTexture(d) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d');
  x.fillStyle = d.a; x.fillRect(0, 0, 64, 256); x.fillStyle = d.b; x.strokeStyle = d.b;
  if (d.style === 'grain') { x.globalAlpha = 0.35; for (let i = 0; i < 18; i++) { x.lineWidth = 1 + Math.random() * 2; x.beginPath(); const xx = Math.random() * 64; x.moveTo(xx, 0); x.bezierCurveTo(xx + 6, 80, xx - 6, 170, xx + 3, 256); x.stroke(); } }
  if (d.style === 'sun') { x.beginPath(); x.arc(32, 128, 20, 0, 7); x.fill(); x.lineWidth = 5; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; x.beginPath(); x.moveTo(32 + Math.cos(a) * 26, 128 + Math.sin(a) * 26); x.lineTo(32 + Math.cos(a) * 60, 128 + Math.sin(a) * 60); x.stroke(); } }
  if (d.style === 'wave') { x.lineWidth = 7; for (let k = 0; k < 7; k++) { x.beginPath(); for (let y = 0; y <= 64; y += 4) x.lineTo(y, 20 + k * 36 + Math.sin(y / 10) * 7); x.stroke(); } }
  if (d.style === 'check') for (let i = 0; i < 4; i++) for (let k = 0; k < 16; k++) if ((i + k) % 2) x.fillRect(i * 16, k * 16, 16, 16);
  if (d.style === 'bolt') { x.beginPath(); x.moveTo(40, 30); x.lineTo(14, 140); x.lineTo(34, 140); x.lineTo(22, 230); x.lineTo(52, 110); x.lineTo(32, 110); x.closePath(); x.fill(); }
  if (d.style === 'stars') for (let i = 0; i < 14; i++) { const cx = 8 + Math.random() * 48, cy = 10 + Math.random() * 236, r = 3 + Math.random() * 6; x.beginPath(); for (let j = 0; j < 10; j++) { const a = j * Math.PI / 5, rr = j % 2 ? r * 0.45 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.fill(); }
  if (d.style === 'stripe') for (let k = -4; k < 20; k++) { x.save(); x.translate(0, k * 18); x.beginPath(); x.moveTo(0, 0); x.lineTo(64, 30); x.lineTo(64, 39); x.lineTo(0, 9); x.fill(); x.restore(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildSkater(deck = DECKS[0], outfit = OUTFITS[0]) {
  const root = new THREE.Group();
  // ---- board (centre at y=0 of boardPivot)
  const boardPivot = new THREE.Group(); boardPivot.position.y = 0.15; root.add(boardPivot);
  const griptape = mat('#2b2d42', { roughness: 0.95 });
  const deckGeo = rounded(0.27, 0.035, 0.96, 0.015);
  const deckMat = new THREE.MeshStandardMaterial({ map: deckTexture(deck), roughness: 0.55 });
  // the rounded() box is extruded along z: its UVs are odd, so map the graphic by a simple planar projection on the underside
  const deckM = new THREE.Mesh(deckGeo, [griptape, deckMat]); deckM.castShadow = true; boardPivot.add(deckM);
  const under = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.9), deckMat); under.rotation.x = Math.PI / 2; under.position.y = -0.019; boardPivot.add(under);
  for (const s of [-1, 1]) { const tail = new THREE.Mesh(rounded(0.27, 0.035, 0.18, 0.015), [griptape, deckMat]); tail.position.set(0, 0.03, s * 0.53); tail.rotation.x = -s * 0.32; tail.castShadow = true; boardPivot.add(tail); }
  const truckM = new THREE.MeshStandardMaterial({ color: '#c9d1db', metalness: 0.7, roughness: 0.3 });
  const wheelM = mat(deck.id === 'gold' ? '#fff3c4' : '#fff6e8', { roughness: 0.4 });
  const wheelG = new THREE.CylinderGeometry(0.048, 0.048, 0.045, 14); wheelG.rotateZ(Math.PI / 2);
  for (const s of [-1, 1]) {
    const tr = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.045, 0.06), truckM); tr.position.set(0, -0.05, s * 0.33); boardPivot.add(tr);
    for (const w of [-1, 1]) { const wh = new THREE.Mesh(wheelG, wheelM); wh.position.set(w * 0.13, -0.085, s * 0.33); wh.castShadow = true; boardPivot.add(wh); }
  }
  // ---- rider
  const body = new THREE.Group(); body.position.y = 0.18; root.add(body);
  const M = { hoodie: mat(outfit.hoodie), pants: mat(outfit.pants), skin: mat('#ffd2b0'), helmet: new THREE.MeshStandardMaterial({ color: outfit.helmet, roughness: 0.25, metalness: 0.1 }), shoe: mat(outfit.shoe), sole: mat('#2b2d42'), eye: mat('#ffffff'), pupil: mat('#1b1b2f') };
  const cap = (r, l, m) => { const o = new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 5, 10), m); o.castShadow = true; return o; };
  const legs = [];
  for (const [fz, side] of [[0.25, 1], [-0.22, -1]]) {
    const hip = new THREE.Group(); hip.position.set(0, 0.72, fz * 0.62); body.add(hip);
    const thigh = cap(0.085, 0.24, M.pants); thigh.position.y = -0.17; hip.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -0.34; hip.add(knee);
    const shin = cap(0.08, 0.24, M.pants); shin.position.y = -0.17; knee.add(shin);
    const ankle = new THREE.Group(); ankle.position.y = -0.34; knee.add(ankle);
    const shoe = new THREE.Mesh(rounded(0.13, 0.08, 0.24, 0.03), [M.shoe, M.shoe]); shoe.position.set(0.0, -0.01, 0); shoe.rotation.y = Math.PI / 2 * 0 ; shoe.castShadow = true; ankle.add(shoe);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.025, 0.25), M.sole); sole.position.y = -0.05; ankle.add(sole);
    legs.push({ hip, knee, ankle, fz: fz * 0.62, side });
  }
  const torso = new THREE.Group(); torso.position.y = 0.72; body.add(torso);
  const chest = cap(0.2, 0.26, M.hoodie); chest.position.y = 0.26; chest.scale.set(1, 1, 1.15); torso.add(chest);
  const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.22), mat('#ffffff', { transparent: true, opacity: 0.25 })); pocket.position.set(0.18, 0.16, 0); torso.add(pocket);
  const neck = new THREE.Group(); neck.position.y = 0.6; torso.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 22, 16), M.skin); head.position.y = 0.16; head.castShadow = true; neck.add(head);
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.235, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), M.helmet); helm.position.y = 0.19; helm.castShadow = true; neck.add(helm);
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 24, Math.PI), mat('#ffffff')); stripe.position.y = 0.2; stripe.rotation.y = Math.PI / 2; neck.add(stripe);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.3), M.helmet); brim.position.set(0.21, 0.24, 0); brim.rotation.z = -0.25; neck.add(brim);
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), M.eye); e.position.set(0.18, 0.15, s * 0.075); e.scale.set(0.6, 1.15, 1); neck.add(e);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), M.pupil); p.position.set(0.215, 0.15, s * 0.075); neck.add(p);
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 12, Math.PI), M.pupil); smile.position.set(0.2, 0.06, 0); smile.rotation.set(0, Math.PI / 2, Math.PI); neck.add(smile);
  const arms = [];
  for (const s of [1, -1]) {
    const sh = new THREE.Group(); sh.position.set(0, 0.42, s * 0.24); torso.add(sh);
    const up = cap(0.065, 0.2, M.hoodie); up.position.y = -0.14; sh.add(up);
    const el = new THREE.Group(); el.position.y = -0.28; sh.add(el);
    const lo = cap(0.058, 0.18, M.hoodie); lo.position.y = -0.12; el.add(lo);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), M.skin); hand.position.y = -0.26; el.add(hand);
    arms.push({ sh, el, s });
  }
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.18, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;

  // pose: crouch 0..1, lean -1..1 (into turns), arm swing, grab 0..1, push phase
  const A = 0.34;
  function legIK(L, hipY, footY) {
    const d = Math.max(0.2, Math.min(2 * A - 0.005, hipY - footY));
    const th = Math.acos(d / (2 * A));
    L.hip.position.y = hipY; L.hip.rotation.z = th; L.knee.rotation.z = -2 * th; L.ankle.rotation.z = th;
  }
  function pose(t, { crouch = 0.3, lean = 0, grab = 0, push = 0, tuck = 0, balance = 0, wobble = 0 } = {}) {
    const hipY = 0.7 - crouch * 0.26 - tuck * 0.12;
    legIK(legs[0], hipY, 0.06 + tuck * 0.12);
    // back leg pushes: swing out and down beside the board
    if (push > 0) { const ph = Math.sin(push * Math.PI * 2); legIK(legs[1], hipY, 0.06); legs[1].hip.rotation.x = 0; legs[1].hip.rotation.z = Math.acos(0.92) + ph * 0.6; legs[1].knee.rotation.z = -0.4; legs[1].hip.position.z = legs[1].fz - 0.05; }
    else { legIK(legs[1], hipY, 0.06 + tuck * 0.12); legs[1].hip.rotation.x = 0; legs[1].hip.position.z = legs[1].fz; }
    torso.position.y = hipY; torso.rotation.z = -0.15 - crouch * 0.35 - grab * 0.5; torso.rotation.x = lean * 0.35 + balance * 0.5;
    neck.rotation.z = 0.15 + crouch * 0.3 + grab * 0.3;
    for (const a of arms) {
      const sw = Math.sin(t * 2.2 + a.s) * 0.12 + wobble * Math.sin(t * 9 + a.s) * 0.35;
      a.sh.rotation.x = a.s * (1.15 + sw - grab * 0.4) + balance * 0.8; a.sh.rotation.z = -0.25 + grab * 1.5 * (a.s > 0 ? 1 : 0.2); a.el.rotation.x = a.s * 0.35;
    }
  }
  pose(0);
  return { root, boardPivot, body, shadow, pose, deckMat, setDeck(d) { deckMat.map = deckTexture(d); deckMat.needsUpdate = true; } };
}
