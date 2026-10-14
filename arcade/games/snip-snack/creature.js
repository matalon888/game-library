// creature.js — "Pip", a round sleepy pastel hedgehog in a nightcap, napping on a pillow. Original design.
import { THREE, mat, glossy, rounded } from './kit/hc.js';

function capTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#7fb0ff'; g.fillRect(0, 0, 64, 128); g.fillStyle = '#ffffff';
  for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) { g.beginPath(); g.arc(x * 16 + (y % 2) * 8 + 4, y * 16 + 8, 3.2, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function makeHedgehog() {
  const root = new THREE.Group(), g = new THREE.Group(); root.add(g);
  const BODY = mat('#d4b5f0', { roughness: 0.55 }), SPIKE = mat('#9c78d4', { roughness: 0.5 }), FACE = mat('#fff1df', { roughness: 0.6 }), DARK = glossy('#3a2a44');
  const pillow = new THREE.Mesh(rounded(3.1, 0.6, 1.9, 0.28), mat('#9fd8f7', { roughness: 0.75 })); pillow.position.y = -1.32; pillow.castShadow = pillow.receiveShadow = true; root.add(pillow);
  const trim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 8, 18), mat('#ffffff')); trim.position.set(-1.25, -1.05, 0.95); root.add(trim);
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 26), BODY); body.scale.set(1.15, 0.98, 0.95); body.castShadow = true; g.add(body);
  // spikes: soft cones over back + top, instanced
  const pts = [], N = 260;
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, rr = Math.sqrt(1 - y * y), th = i * 2.39996;
    const p = new THREE.Vector3(Math.cos(th) * rr, y, Math.sin(th) * rr);
    if (p.y > -0.35 && (p.z < 0.2 || p.y > 0.62 && p.z < 0.5) && !(p.y > 0.6 && Math.abs(p.x) > 0.45 && p.z > 0.0)) pts.push(p);
  }
  const spikes = new THREE.InstancedMesh(new THREE.ConeGeometry(0.15, 0.52, 7), SPIKE, pts.length); spikes.castShadow = true;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  pts.forEach((p, i) => {
    const n = p.clone().add(new THREE.Vector3(0, 0.25, -0.55)).normalize();
    q.setFromUnitVectors(up, n);
    const pos = new THREE.Vector3(p.x * 1.15, p.y * 0.98, p.z * 0.95).multiplyScalar(0.93).addScaledVector(n, 0.2);
    m4.compose(pos, q, new THREE.Vector3(1, 0.85 + ((i * 37) % 10) / 30, 1)); spikes.setMatrixAt(i, m4);
  });
  g.add(spikes);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.66, 30, 20), FACE); face.scale.set(1.2, 0.95, 0.6); face.position.set(0, -0.12, 0.6); g.add(face);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), DARK); nose.position.set(0, 0.0, 1.0); g.add(nose);
  const ears = []; for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), BODY); e.scale.set(1, 1, 0.6); e.position.set(s * 0.62, 0.72, 0.42); g.add(e);
    const ei = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), mat('#ffb8cf')); ei.position.set(s * 0.62, 0.72, 0.52); ei.scale.set(1, 1, 0.5); g.add(ei); ears.push(e); }
  for (const s of [-1, 1]) { const ch = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), mat('#ffb3c9', { transparent: true, opacity: 0.85 })); ch.scale.set(1.2, 0.7, 0.3); ch.position.set(s * 0.56, -0.2, 0.86); g.add(ch); }
  // eyes: closed (sleepy arcs) and open (big shiny)
  const eyes = { closed: [], open: [], pupils: [] };
  for (const s of [-1, 1]) {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 8, 16, Math.PI), DARK); arc.rotation.z = Math.PI; arc.position.set(s * 0.33, 0.22, 0.95); g.add(arc); eyes.closed.push(arc);
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 14), glossy('#ffffff')); w.scale.set(1, 1.15, 0.6); w.position.set(s * 0.33, 0.24, 0.9); g.add(w); eyes.open.push(w);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), DARK); p.position.set(s * 0.33, 0.22, 1.02); p.scale.set(1, 1.1, 0.6); g.add(p); eyes.pupils.push(p);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.6 })); hl.position.set(0.04, 0.05, 0.08); p.add(hl);
  }
  // mouth
  const mouth = new THREE.Group(); mouth.position.set(0, -0.32, 0.93); g.add(mouth);
  const mIn = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 14), mat('#7a2440')); mIn.scale.set(1.25, 1, 0.35); mouth.add(mIn);
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), mat('#ff7f9e')); tongue.position.set(0, -0.12, 0.05); tongue.scale.set(1.3, 0.6, 0.5); mouth.add(tongue);
  // nightcap (droopy)
  let api_tip;
  const cap = new THREE.Group(); cap.position.set(0.2, 0.86, 0.05); cap.rotation.z = -0.35; g.add(cap);
  const CAPM = mat('#ffffff', { map: capTexture(), side: THREE.DoubleSide });
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.46, 0.6, 24, 1, true), CAPM); cone.position.y = 0.26; cone.castShadow = true; cap.add(cone);
  const tip = new THREE.Group(); tip.position.y = 0.55; tip.rotation.z = -1.1; cap.add(tip);
  const cone2 = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.75, 20, 1, true), CAPM); cone2.position.y = 0.36; cone2.castShadow = true; tip.add(cone2);
  const knee = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 10), CAPM); tip.add(knee);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.1, 10, 26), mat('#ffffff')); band.rotation.x = Math.PI / 2; band.position.y = -0.04; cap.add(band);
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), mat('#ffffff')); pom.position.y = 0.76; tip.add(pom); api_tip = tip;
  for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), BODY); f.scale.set(1.2, 0.7, 1); f.position.set(s * 0.45, -0.9, 0.55); g.add(f); }

  let open = 0, mOpen = 0, chomp = 0, sad = 0, squash = 0;
  const api = {
    root, g, cap,
    /** look: candy offset (world units, relative to mouth); near: 0..1 how hungry-excited */
    update(t, dt, look, near, eyesOpen) {
      open += ((eyesOpen ? 1 : 0) - open) * Math.min(1, dt * 10);
      mOpen += (near - mOpen) * Math.min(1, dt * 12);
      chomp = Math.max(0, chomp - dt * 2.2); squash = Math.max(0, squash - dt * 3);
      const breathe = Math.sin(t * 2.2) * 0.03 * (1 - open * 0.5);
      for (const e of eyes.closed) e.visible = open < 0.5;
      for (const e of eyes.open) { e.visible = open >= 0.5; e.scale.y = 1.15 * (sad ? 0.6 : 1); }
      for (let i = 0; i < 2; i++) { const p = eyes.pupils[i]; p.visible = open >= 0.5; p.position.x = (i ? 0.33 : -0.33) + Math.max(-0.07, Math.min(0.07, look.x * 0.03)); p.position.y = 0.22 + Math.max(-0.06, Math.min(0.08, look.y * 0.02)); }
      let mo = 0.12 + mOpen * 1.0; if (chomp > 0) mo = chomp > 0.7 ? 1.3 : 0.12 + Math.abs(Math.sin(chomp * 14)) * 0.5;
      if (sad) mo = 0.15;
      mouth.scale.set(1 + mOpen * 0.2, mo, 1);
      const sq = Math.sin(squash * 9) * squash * 0.18;
      g.scale.set(1 + breathe * 0.6 + sq, 1 - breathe * 0.3 + breathe - sq + mOpen * 0.04, 1 + sq * 0.5);
      g.position.y = sad ? -0.12 : 0;
      g.rotation.y += (Math.max(-0.35, Math.min(0.35, look.x * 0.1)) - g.rotation.y) * Math.min(1, dt * 5);
      g.rotation.z = Math.sin(t * 1.1) * 0.03 * (1 - open);
      cap.rotation.z = -0.35 + Math.sin(t * 2.2) * 0.06 - open * 0.15; api_tip.rotation.z = -1.1 + Math.sin(t * 2.2 + 0.8) * 0.15 + open * 0.3;
      for (const e of ears) e.scale.y = 1 + mOpen * 0.3;
    },
    chomp() { chomp = 1; squash = 1; },
    setSad(v) { sad = v ? 1 : 0; },
    reset() { chomp = 0; sad = 0; squash = 0; open = 0; mOpen = 0; },
  };
  return api;
}
