// cat.js — our own round chibi kitten built from primitives. Faces +z, feet at y=0, ~2.4 units tall.
// cat.update(dt, t) animates idle/blink/cheer/sad; cat.cheer(strength), cat.sad(), cat.party(on)
import { THREE } from './kit/hc.js';
import { part, merge } from './geo.js';

const SPH = new THREE.SphereGeometry(1, 28, 20), CONE = new THREE.ConeGeometry(1, 1, 18), CYL = new THREE.CylinderGeometry(1, 1, 1, 22);
const TOR = new THREE.TorusGeometry(1, 0.22, 8, 18, Math.PI);

export function makeCat(o = {}) {
  const fur = o.fur || '#f6a24a', stripe = o.stripe || '#e2792a', belly = o.belly || '#fff4e4', inner = o.inner || '#ffb0c4',
    iris = o.iris || '#3b2a20', cheek = o.cheek || '#ff8fb0', mask = o.mask || null;
  const vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.02 });
  const gloss = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.15, metalness: 0.05 });
  const g = new THREE.Group(), rig = new THREE.Group(); g.add(rig);

  // body + belly + feet + tail
  const tailParts = [];
  for (let i = 0; i < 9; i++) { const k = i / 8, a = k * 2.2; tailParts.push(part(SPH, i > 6 ? (o.tailTip || stripe) : fur, { x: 0.45 + Math.sin(a) * 0.35, y: 0.3 + k * 0.95, z: -0.42 - Math.sin(k * 3) * 0.12, s: 0.13 - k * 0.02 })); }
  const body = new THREE.Mesh(merge([
    part(SPH, fur, { y: 0.62, sx: 0.62, sy: 0.6, sz: 0.55 }),
    part(SPH, belly, { y: 0.58, z: 0.22, sx: 0.42, sy: 0.44, sz: 0.36 }),
    part(SPH, belly, { x: -0.27, y: 0.12, z: 0.3, sx: 0.2, sy: 0.13, sz: 0.24 }),
    part(SPH, belly, { x: 0.27, y: 0.12, z: 0.3, sx: 0.2, sy: 0.13, sz: 0.24 }),
    part(SPH, stripe, { y: 0.95, z: -0.2, sx: 0.45, sy: 0.07, sz: 0.4, rx: 0.3 }),
    ...tailParts,
    ...(o.collar ? [part(new THREE.TorusGeometry(0.42, 0.06, 8, 24), o.collar, { y: 1.08, rx: Math.PI / 2 + 0.15 }), part(SPH, '#ffd23f', { y: 1.0, z: 0.42, s: 0.08 })] : []),
  ]), vc);
  body.castShadow = true; rig.add(body);

  // head (static parts merged) — big chibi head
  const head = new THREE.Group(); head.position.y = 1.45; rig.add(head);
  const hp = [
    part(SPH, fur, { sx: 0.78, sy: 0.66, sz: 0.68 }),
    part(SPH, belly, { y: -0.2, z: 0.5, sx: 0.3, sy: 0.19, sz: 0.16 }),
    part(CONE, fur, { x: -0.48, y: 0.5, z: -0.02, sx: 0.26, sy: 0.46, sz: 0.2, rz: 0.42 }),
    part(CONE, fur, { x: 0.48, y: 0.5, z: -0.02, sx: 0.26, sy: 0.46, sz: 0.2, rz: -0.42 }),
    part(CONE, inner, { x: -0.46, y: 0.47, z: 0.06, sx: 0.15, sy: 0.3, sz: 0.1, rz: 0.42 }),
    part(CONE, inner, { x: 0.46, y: 0.47, z: 0.06, sx: 0.15, sy: 0.3, sz: 0.1, rz: -0.42 }),
    part(SPH, '#ff7aa2', { y: -0.11, z: 0.66, sx: 0.075, sy: 0.055, sz: 0.05 }),
    part(TOR, '#5a3a30', { x: -0.055, y: -0.2, z: 0.655, s: 0.055, rz: Math.PI }),
    part(TOR, '#5a3a30', { x: 0.055, y: -0.2, z: 0.655, s: 0.055, rz: Math.PI }),
    part(SPH, cheek, { x: -0.42, y: -0.15, z: 0.5, sx: 0.12, sy: 0.07, sz: 0.06 }),
    part(SPH, cheek, { x: 0.42, y: -0.15, z: 0.5, sx: 0.12, sy: 0.07, sz: 0.06 }),
    part(SPH, stripe, { y: 0.55, z: 0.12, sx: 0.08, sy: 0.12, sz: 0.1 }),
    part(SPH, stripe, { x: -0.18, y: 0.52, z: 0.16, sx: 0.06, sy: 0.1, sz: 0.08, rz: 0.3 }),
    part(SPH, stripe, { x: 0.18, y: 0.52, z: 0.16, sx: 0.06, sy: 0.1, sz: 0.08, rz: -0.3 }),
  ];
  if (mask) hp.push(part(SPH, mask, { y: -0.1, z: 0.42, sx: 0.42, sy: 0.32, sz: 0.24 }));
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) hp.push(part(CYL, '#ffffff', { x: s * 0.62, y: -0.14 + (i - 1) * 0.06, z: 0.48, sx: 0.008, sy: 0.3, sz: 0.008, rz: Math.PI / 2 + s * (i - 1) * 0.15 }));
  const headMesh = new THREE.Mesh(merge(hp), vc); headMesh.castShadow = true; head.add(headMesh);
  // eyes (separate so they can blink / squint)
  const eyes = new THREE.Group(); head.add(eyes);
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(merge([
      part(SPH, iris, { sx: 0.16, sy: 0.19, sz: 0.09 }),
      part(SPH, o.eyeRing || '#6b4a2a', { z: -0.01, sx: 0.175, sy: 0.205, sz: 0.085 }),
      part(SPH, '#ffffff', { x: 0.05 * s + 0.02, y: 0.07, z: 0.075, s: 0.06 }),
      part(SPH, '#ffffff', { x: -0.04 * s, y: -0.07, z: 0.08, s: 0.028 }),
    ]), gloss);
    e.position.set(s * 0.25, 0.03, 0.6); eyes.add(e);
  }
  // happy closed eyes (^ ^), shown while cheering
  const happy = new THREE.Mesh(merge([part(TOR, iris, { x: -0.25, y: 0.0, z: 0.64, s: 0.1 }), part(TOR, iris, { x: 0.25, y: 0.0, z: 0.64, s: 0.1 })]), vc);
  happy.visible = false; head.add(happy);
  // hat / accessory
  if (o.hat === 'straw') {
    const hat = new THREE.Mesh(merge([
      part(CYL, '#f3d27c', { sx: 0.62, sy: 0.04, sz: 0.62 }), part(CYL, '#f0c862', { y: 0.12, sx: 0.32, sy: 0.24, sz: 0.32 }),
      part(CYL, '#ff5d8f', { y: 0.04, sx: 0.335, sy: 0.07, sz: 0.335 }), part(SPH, '#ff5d8f', { x: 0.3, y: 0.08, z: 0.14, s: 0.08 }),
      part(SPH, '#ffd23f', { x: 0.3, y: 0.08, z: 0.2, s: 0.04 }),
    ]), vc);
    hat.position.set(0.12, 0.6, -0.05); hat.rotation.set(-0.15, 0, -0.22); hat.castShadow = true; head.add(hat);
  } else if (o.hat === 'bow') {
    const bow = new THREE.Mesh(merge([part(CONE, o.bowColor || '#ff5d8f', { x: -0.12, sx: 0.12, sy: 0.2, sz: 0.08, rz: Math.PI / 2 }), part(CONE, o.bowColor || '#ff5d8f', { x: 0.12, sx: 0.12, sy: 0.2, sz: 0.08, rz: -Math.PI / 2 }), part(SPH, '#ffffff', { s: 0.07 })]), vc);
    bow.position.set(-0.34, 0.5, 0.25); bow.rotation.z = 0.4; head.add(bow);
  } else if (o.hat === 'leaf') {
    const lf = new THREE.Mesh(merge([part(SPH, '#4cc36a', { sx: 0.1, sy: 0.04, sz: 0.24, rx: 0.4 }), part(SPH, '#ff6fa5', { x: 0.1, y: 0.03, z: 0.05, s: 0.08 }), part(SPH, '#ffd23f', { x: 0.1, y: 0.06, z: 0.08, s: 0.035 })]), vc);
    lf.position.set(0.32, 0.5, 0.2); lf.rotation.z = -0.5; head.add(lf);
  }
  // arms (pivot at shoulder) with paw
  const arms = [];
  for (const s of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(s * 0.46, 0.92, 0.12); rig.add(piv);
    const a = new THREE.Mesh(merge([part(new THREE.CapsuleGeometry(0.12, 0.3, 4, 10), fur, { y: -0.2 }), part(SPH, belly, { y: -0.42, s: 0.14 }), part(SPH, inner, { y: -0.47, z: 0.08, s: 0.06 })]), vc);
    a.castShadow = true; piv.add(a); piv.rotation.z = s * 0.25; arms.push(piv);
  }
  let cheerT = 0, sadT = 0, party = false, blinkT = 2 + Math.random() * 2, jump = 0, vy = 0, phase = Math.random() * 6;
  g.cheer = (k = 1) => { cheerT = Math.max(cheerT, 0.6 + 0.6 * k); if (jump <= 0.001) vy = 0.05 + 0.04 * k; };
  g.sad = () => { sadT = 2.5; party = false; };
  g.party = (on = true) => { party = on; if (on) sadT = 0; };
  g.reset = () => { cheerT = 0; sadT = 0; party = false; };
  g.update = (dt, t) => {
    const sec = dt / 60; t += phase;
    cheerT = Math.max(0, cheerT - sec); sadT = Math.max(0, sadT - sec);
    if (party && jump <= 0.001 && vy === 0) vy = 0.07;
    // hop physics (units of cat height)
    if (vy !== 0 || jump > 0) { vy -= 0.006 * dt; jump += vy * dt; if (jump <= 0) { jump = 0; vy = 0; } }
    const c = cheerT > 0 || party, sq = jump > 0 ? 1 + vy * 2 : 1 + Math.sin(t * 2.4) * 0.015;
    rig.position.y = jump; rig.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    head.rotation.z = c ? Math.sin(t * 9) * 0.12 : sadT > 0 ? 0.18 : Math.sin(t * 1.3) * 0.05;
    head.rotation.x = sadT > 0 ? 0.25 : 0;
    head.position.y = 1.45 + (sadT > 0 ? -0.08 : 0);
    arms.forEach((a, i) => { const s = i ? 1 : -1; a.rotation.z = c ? s * (2.4 + Math.sin(t * 14 + i * 3) * 0.35) : sadT > 0 ? s * 0.05 : s * (0.25 + Math.sin(t * 2 + i) * 0.05); });
    blinkT -= sec; const bl = blinkT < 0.12 && blinkT > 0 ? 0.15 : 1; if (blinkT < 0) blinkT = 2 + Math.random() * 3;
    eyes.visible = !c; happy.visible = c;
    eyes.scale.y = sadT > 0 ? 0.6 : bl;
  };
  return g;
}
