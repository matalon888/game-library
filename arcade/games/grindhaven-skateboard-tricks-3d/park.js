// park.js — Grindhaven skateparks, built in code. Each park is a list of elements (quarter pipes, kickers, funboxes,
// ledges, stair sets, rails, a bowl). One height function drives the physics; the same numbers build the meshes.
import { THREE, mat } from './kit/hc.js';

const toLocal = (e, x, z) => { const dx = x - e.x, dz = z - e.z, c = Math.cos(e.r), s = Math.sin(e.r); return [dx * c - dz * s, dx * s + dz * c]; };
const toWorld = (e, lx, lz) => { const c = Math.cos(e.r), s = Math.sin(e.r); return [e.x + lx * c + lz * s, e.z - lx * s + lz * c]; };
const NEG = -Infinity;
const PI = Math.PI;

// ---------------------------------------------------------------- park layouts
// r: yaw of the element; local +z is the direction a ramp rises toward (quarter pipe, kicker) or the stairs descend.
export const PARKS = [
  { id: 'plaza', name: 'Sunlot Plaza', B: 28, spawn: [0, 16, PI], sky: ['#7cc8ff', '#ffe7c2'], ground: '#d9d4cc', accent: ['#ff5d8f', '#2ec4b6', '#ffd23f', '#7b5cff'],
    els: [
      { t: 'qp', x: 0, z: -22, r: PI, w: 18, R: 3.3, deck: 2.2, c: 0 },
      { t: 'qp', x: -22, z: -6, r: -PI / 2, w: 14, R: 3.0, deck: 2.2, c: 1 },
      { t: 'qp', x: 22, z: -6, r: PI / 2, w: 14, R: 3.0, deck: 2.2, c: 2 },
      { t: 'fun', x: 0, z: -7, r: 0, w: 3.2, L: 4, s: 2.4, h: 0.62, c: 3, name: 'funbox' },
      { t: 'kick', x: -11, z: 6, r: PI, w: 2.4, len: 2.4, h: 0.85, c: 0 },
      { t: 'kick', x: 13, z: -14, r: PI / 2, w: 2.4, len: 2.2, h: 0.8, c: 1 },
      { t: 'rail', x: 9, z: -6, r: 0, L: 10, h: 0.55, name: 'long' },
      { t: 'rail', x: -13, z: -14, r: PI / 2, L: 7, h: 0.5, name: 'rail2' },
      { t: 'box', x: -9, z: -4, r: 0, w: 0.9, L: 6, h: 0.42, c: 2, name: 'ledge' },
      { t: 'box', x: -3, z: 8, r: PI / 2, w: 2.2, L: 4.5, h: 0.22, c: 3, name: 'pad' },
      { t: 'plaza', x: 14, z: 12, r: PI, w: 5.5, ramp: 3.2, plat: 5, steps: 5, tread: 0.55, h: 1.05, c: 1, name: 'stairs' },
    ] },
  { id: 'bowl', name: 'Driftwood Bowl', B: 28, spawn: [2, 18, PI], sky: ['#ffb38a', '#fff1c9'], ground: '#ddd2c4', accent: ['#ff8c42', '#3a86ff', '#52b788', '#ff4d6d'],
    els: [
      { t: 'bowl', x: -9, z: -9, rb: 4.2, depth: 2.5, name: 'bowl' },
      { t: 'qp', x: 13, z: -8, r: PI, w: 10, R: 2.8, deck: 2.4, c: 1 },
      { t: 'qp', x: 13, z: 1, r: 0, w: 10, R: 2.8, deck: 2.4, c: 1 },
      { t: 'qp', x: -22, z: 12, r: -PI / 2, w: 10, R: 3.0, deck: 2.2, c: 2 },
      { t: 'fun', x: -6, z: 13, r: PI / 2, w: 3.2, L: 4, s: 2.4, h: 0.62, c: 3, name: 'funbox' },
      { t: 'rail', x: 4, z: 13, r: 0, L: 9, h: 0.55, name: 'long' },
      { t: 'box', x: 10, z: 15, r: 0, w: 0.9, L: 6, h: 0.42, c: 0, name: 'ledge' },
      { t: 'kick', x: -14, z: 22, r: -PI / 2, w: 2.4, len: 2.4, h: 0.85, c: 0 },
      { t: 'kick', x: 20, z: 20, r: PI, w: 2.4, len: 2.2, h: 0.8, c: 3 },
    ] },
];

// ---------------------------------------------------------------- per element profile helpers
function prep(e) {
  if (e.t === 'qp') { const th = 72 * PI / 180; e.um = e.R * Math.sin(th); e.H = e.R * (1 - Math.cos(th)); }
  if (e.t === 'bowl') { const th = 78 * PI / 180; e.Rc = e.depth / (1 - Math.cos(th)); e.T = e.Rc * Math.sin(th); e.rr = e.rb + e.T; }
  return e;
}
function heightOf(e, x, z) {
  if (e.t === 'bowl') {
    const d = Math.hypot(x - e.x, z - e.z);
    if (d <= e.rb) return -e.depth;
    if (d <= e.rr) { const s = d - e.rb; return -e.depth + e.Rc - Math.sqrt(Math.max(0, e.Rc * e.Rc - s * s)); }
    return NEG;
  }
  if (e.t === 'rail') return NEG;
  const [lx, lz] = toLocal(e, x, z);
  switch (e.t) {
    case 'qp': if (Math.abs(lx) > e.w / 2 || lz < 0 || lz > e.um + e.deck) return NEG;
      return lz <= e.um ? e.R - Math.sqrt(e.R * e.R - lz * lz) : e.H;
    case 'kick': if (Math.abs(lx) > e.w / 2 || lz < 0 || lz > e.len) return NEG; return e.h * Math.pow(lz / e.len, 1.5);
    case 'fun': { if (Math.abs(lx) > e.w / 2) return NEG; const a = Math.abs(lz); if (a <= e.L / 2) return e.h; if (a <= e.L / 2 + e.s) return e.h * (1 - (a - e.L / 2) / e.s); return NEG; }
    case 'box': if (Math.abs(lx) > e.w / 2 || Math.abs(lz) > e.L / 2) return NEG; return e.h;
    case 'plaza': {
      if (Math.abs(lx) > e.w / 2) return NEG;
      if (lz < -e.plat - e.ramp) return NEG;
      if (lz < -e.plat) return e.h * (lz + e.plat + e.ramp) / e.ramp;
      if (lz <= 0) return e.h;
      const k = Math.floor(lz / e.tread); if (k >= e.steps) return NEG;
      return e.h * (e.steps - 1 - k) / e.steps;
    }
  }
  return NEG;
}

// ---------------------------------------------------------------- textures (all drawn in code)
function canvasTex(w, h, draw, rep = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const concreteTex = (base) => canvasTex(256, 256, (x, w, h) => {
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 1400; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.05})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  x.strokeStyle = 'rgba(0,0,0,.13)'; x.lineWidth = 3; x.strokeRect(0, 0, w, h);
});
const plyTex = (base) => canvasTex(128, 128, (x, w, h) => {
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  x.strokeStyle = 'rgba(120,70,20,.10)'; x.lineWidth = 1;
  for (let i = 0; i < 26; i++) { x.beginPath(); const y = Math.random() * h; x.moveTo(0, y); x.bezierCurveTo(w * 0.3, y + 4, w * 0.6, y - 4, w, y + 2); x.stroke(); }
  x.strokeStyle = 'rgba(0,0,0,.12)'; x.lineWidth = 2; x.strokeRect(0, 0, w, h);
});
// side panels: bright colour with simple original shapes (stars, bolts, dots) — park "paint", no lettering
const panelTex = (col, k) => canvasTex(256, 128, (x, w, h) => {
  x.fillStyle = col; x.fillRect(0, 0, w, h);
  const cols = ['#ffffff', '#ffd23f', '#2b2d42', '#ff5d8f', '#3ab795'];
  for (let i = 0; i < 6; i++) {
    x.fillStyle = cols[(i + k) % cols.length]; x.globalAlpha = 0.55; const cx = 20 + Math.random() * (w - 40), cy = 20 + Math.random() * (h - 40), r = 10 + Math.random() * 18;
    x.beginPath();
    if ((i + k) % 3 === 0) { for (let j = 0; j < 10; j++) { const a = j * PI / 5 - PI / 2, rr = j % 2 ? r * 0.45 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } }
    else if ((i + k) % 3 === 1) x.arc(cx, cy, r * 0.7, 0, PI * 2);
    else { x.moveTo(cx - r * 0.3, cy - r); x.lineTo(cx + r * 0.4, cy - r * 0.1); x.lineTo(cx, cy); x.lineTo(cx + r * 0.3, cy + r); x.lineTo(cx - r * 0.4, cy + r * 0.1); x.lineTo(cx, cy); }
    x.closePath(); x.fill();
  }
  x.globalAlpha = 1; x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(0, 0, w, 6);
});
const chainTex = () => canvasTex(64, 64, (x, w, h) => {
  x.clearRect(0, 0, w, h); x.strokeStyle = 'rgba(200,210,220,.95)'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(0, 0); x.lineTo(w, h); x.moveTo(w, 0); x.lineTo(0, h); x.stroke();
});

// ---------------------------------------------------------------- build
export function buildPark(def, scene) {
  const els = def.els.map(e => prep({ ...e }));
  const bowls = els.filter(e => e.t === 'bowl'), raised = els.filter(e => e.t !== 'bowl' && e.t !== 'rail');
  const B = def.B;
  function h(x, z) {
    for (const b of bowls) { const v = heightOf(b, x, z); if (v !== NEG) return v; }
    let m = 0; for (const e of raised) { const v = heightOf(e, x, z); if (v > m) m = v; } return m;
  }
  /** which named element (funbox, stairs, bowl...) is under x,z */
  function over(x, z) { for (const e of els) if (e.name && e.t !== 'rail' && heightOf(e, x, z) !== NEG) return e.name; return ''; }
  // grind segments in world space
  const segs = [];
  const seg = (e, lx0, lz0, y0, lx1, lz1, y1, kind, name) => {
    const [ax, az] = toWorld(e, lx0, lz0), [bx, bz] = toWorld(e, lx1, lz1);
    const a = new THREE.Vector3(ax, y0, az), b = new THREE.Vector3(bx, y1, bz), d = b.clone().sub(a), L = d.length(); d.normalize();
    segs.push({ a, b, d, L, kind, name: name || e.name || kind });
  };

  const g = new THREE.Group(); scene.add(g);
  const add = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
  const ACC = def.accent;
  const steel = new THREE.MeshStandardMaterial({ color: '#cfd6df', roughness: 0.25, metalness: 0.75 });
  const yellowSteel = new THREE.MeshStandardMaterial({ color: '#ffcf3a', roughness: 0.35, metalness: 0.35 });
  const ply = new THREE.MeshStandardMaterial({ map: plyTex('#f2d3a2'), roughness: 0.6 });
  const crete = new THREE.MeshStandardMaterial({ map: concreteTex('#cfcac3'), roughness: 0.8 });
  const panels = ACC.map((c, i) => { const t = panelTex(c, i); t.repeat.set(0.3, 0.45); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }); });

  // ground: concrete slab with holes for bowls, grass beyond the fence
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), mat('#86d46b')); grass.rotation.x = -PI / 2; grass.position.y = -0.03; grass.receiveShadow = true; g.add(grass);
  const shp = new THREE.Shape(); const E = B + 1.5; shp.moveTo(-E, -E); shp.lineTo(E, -E); shp.lineTo(E, E); shp.lineTo(-E, E); shp.closePath();
  for (const b of bowls) { const hole = new THREE.Path(); hole.absarc(b.x, -b.z, b.rr, 0, PI * 2, true); shp.holes.push(hole); }
  const gt = concreteTex(def.ground); gt.repeat.set(0.25, 0.25);
  const ground = new THREE.Mesh(new THREE.ShapeGeometry(shp, 48), new THREE.MeshStandardMaterial({ map: gt, roughness: 0.85 }));
  ground.geometry.rotateX(-PI / 2); ground.receiveShadow = true; g.add(ground);
  // painted floor lines (decor)
  const lineM = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35 });
  for (const [x, z, w, d] of [[0, 2, 0.12, 22], [-B + 3, 0, 0.12, 2 * B - 6], [B - 3, 0, 0.12, 2 * B - 6]]) { const l = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lineM); l.rotation.x = -PI / 2; l.position.set(x, 0.01, z); g.add(l); }

  const extr = (shape, w, mats, e) => {
    const geo = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false, curveSegments: 18 });
    geo.rotateY(-PI / 2); geo.translate(w / 2, 0, 0);
    const o = add(geo, mats); o.position.set(e.x, 0, e.z); o.rotation.y = e.r; return o;
  };
  const inEl = (e, o) => { const [x, z] = toWorld(e, o.position.x, o.position.z); o.position.x = x; o.position.z = z; o.rotation.order = 'YXZ'; o.rotation.y += e.r; o.castShadow = true; return o; };
  const bar = (len, rad, m) => new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, len, 10), m);

  for (const e of els) {
    const side = panels[(e.c || 0) % panels.length];
    if (e.t === 'qp') {
      const s = new THREE.Shape(); s.moveTo(0, 0);
      for (let i = 1; i <= 24; i++) { const lz = e.um * i / 24; s.lineTo(lz, e.R - Math.sqrt(e.R * e.R - lz * lz)); }
      s.lineTo(e.um + e.deck, e.H); s.lineTo(e.um + e.deck, 0); s.closePath();
      extr(s, e.w, [side, ply], e);
      const cop = bar(e.w, 0.07, steel); cop.rotation.z = PI / 2; cop.position.set(0, e.H + 0.02, e.um); cop.castShadow = true; g.add(inEl(e, cop));
      // deck railing at the back
      const rl = bar(e.w, 0.04, yellowSteel); rl.rotation.z = PI / 2; rl.position.set(0, e.H + 0.9, e.um + e.deck - 0.1); g.add(inEl(e, rl));
      for (let i = 0; i <= 4; i++) { const p = bar(0.9, 0.035, yellowSteel); p.position.set(-e.w / 2 + 0.1 + i * (e.w - 0.2) / 4, e.H + 0.45, e.um + e.deck - 0.1); g.add(inEl(e, p)); }
    } else if (e.t === 'kick') {
      const s = new THREE.Shape(); s.moveTo(0, 0);
      for (let i = 1; i <= 12; i++) { const lz = e.len * i / 12; s.lineTo(lz, e.h * Math.pow(lz / e.len, 1.5)); }
      s.lineTo(e.len, 0); s.closePath(); extr(s, e.w, [side, ply], e);
      const cop = bar(e.w, 0.05, steel); cop.rotation.z = PI / 2; cop.position.set(0, e.h, e.len - 0.03); g.add(inEl(e, cop));
    } else if (e.t === 'fun') {
      const s = new THREE.Shape(); s.moveTo(-e.L / 2 - e.s, 0); s.lineTo(-e.L / 2, e.h); s.lineTo(e.L / 2, e.h); s.lineTo(e.L / 2 + e.s, 0); s.closePath();
      extr(s, e.w, [side, crete], e);
      for (const sx of [-1, 1]) { const ed = bar(e.L, 0.045, steel); ed.rotation.x = PI / 2; ed.position.set(sx * (e.w / 2 - 0.03), e.h + 0.01, 0); g.add(inEl(e, ed));
        seg(e, sx * (e.w / 2 - 0.05), -e.L / 2, e.h, sx * (e.w / 2 - 0.05), e.L / 2, e.h, 'ledge', 'funbox'); }
    } else if (e.t === 'box') {
      const o = add(new THREE.BoxGeometry(e.w, e.h, e.L), [side, side, crete, crete, side, side]); o.position.set(0, e.h / 2, 0); inEl(e, o);
      for (const sx of [-1, 1]) { const ed = bar(e.L, 0.04, steel); ed.rotation.x = PI / 2; ed.position.set(sx * (e.w / 2 - 0.02), e.h, 0); g.add(inEl(e, ed));
        seg(e, sx * (e.w / 2 - 0.04), -e.L / 2, e.h, sx * (e.w / 2 - 0.04), e.L / 2, e.h, 'ledge'); }
    } else if (e.t === 'plaza') {
      const s = new THREE.Shape(); s.moveTo(-e.plat - e.ramp, 0); s.lineTo(-e.plat, e.h); s.lineTo(0, e.h);
      for (let k = 0; k < e.steps; k++) { const y = e.h * (e.steps - 1 - k) / e.steps; s.lineTo(k * e.tread, y); s.lineTo((k + 1) * e.tread, y); }
      s.lineTo(e.steps * e.tread, 0); s.closePath(); extr(s, e.w, [side, crete], e);
      const run = e.steps * e.tread, top = 0.8;
      for (const sx of [-1, 1]) {
        const lx = sx * (e.w / 2 - 0.35), y0 = e.h + top, y1 = top - e.h / e.steps * 0.5, L = Math.hypot(run, y0 - y1);
        const hr = bar(L, 0.045, yellowSteel); hr.rotation.x = PI / 2 + Math.atan2(y0 - y1, run); hr.position.set(lx, (y0 + y1) / 2, run / 2); g.add(inEl(e, hr));
        for (const f of [0.08, 0.5, 0.92]) { const lz = run * f, ty = y0 + (y1 - y0) * f, fy = heightOf(e, ...toWorld(e, lx, lz)); const p = bar(ty - fy, 0.035, yellowSteel); p.position.set(lx, (ty + fy) / 2, lz); g.add(inEl(e, p)); }
        seg(e, lx, 0, y0, lx, run, y1, 'rail', 'handrail');
      }
    } else if (e.t === 'rail') {
      const r = bar(e.L, 0.05, steel); r.rotation.x = PI / 2; r.position.set(0, e.h, 0); g.add(inEl(e, r));
      for (const f of [-0.42, 0, 0.42]) { const p = bar(e.h, 0.04, yellowSteel); p.position.set(0, e.h / 2, e.L * f); g.add(inEl(e, p)); }
      for (const f of [-0.42, 0.42]) { const ft = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.25), yellowSteel); ft.position.set(0, 0.025, e.L * f); g.add(inEl(e, ft)); }
      seg(e, 0, -e.L / 2, e.h, 0, e.L / 2, e.h, 'rail');
    } else if (e.t === 'bowl') {
      const pts = [new THREE.Vector2(0.001, -e.depth)];
      for (let i = 0; i <= 24; i++) { const s = e.T * i / 24; pts.push(new THREE.Vector2(e.rb + s, -e.depth + e.Rc - Math.sqrt(Math.max(0, e.Rc * e.Rc - s * s)))); }
      const bt = concreteTex('#bfe3f2'); bt.repeat.set(6, 2);
      const lathe = new THREE.Mesh(new THREE.LatheGeometry(pts, 64), new THREE.MeshStandardMaterial({ map: bt, roughness: 0.7, side: THREE.DoubleSide }));
      lathe.position.set(e.x, 0, e.z); lathe.receiveShadow = true; g.add(lathe);
      const cop = new THREE.Mesh(new THREE.TorusGeometry(e.rr, 0.09, 8, 72), steel); cop.rotation.x = PI / 2; cop.position.set(e.x, 0.02, e.z); g.add(cop);
      const tile = new THREE.Mesh(new THREE.TorusGeometry(e.rr - 0.05, 0.12, 4, 72), mat('#3a86ff')); tile.rotation.x = PI / 2; tile.position.set(e.x, -0.2, e.z); tile.scale.z = 0.6; g.add(tile);
    }
  }

  // fence + scenery
  const fenceM = new THREE.MeshStandardMaterial({ map: chainTex(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.4 });
  fenceM.map.repeat.set(2 * E / 0.5, 5);
  for (const [x, z, r] of [[0, -E, 0], [0, E, 0], [-E, 0, PI / 2], [E, 0, PI / 2]]) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(2 * E, 2.4), fenceM); f.position.set(x, 1.2, z); f.rotation.y = r; g.add(f);
    const top = bar(2 * E, 0.05, steel); top.rotation.z = PI / 2; top.rotation.y = r; top.position.set(x, 2.4, z); g.add(top);
  }
  const postG = new THREE.CylinderGeometry(0.06, 0.06, 2.5, 6); postG.translate(0, 1.25, 0);
  const posts = new THREE.InstancedMesh(postG, steel, 64); let pc = 0; const M4 = new THREE.Matrix4();
  for (let i = -E; i <= E + 0.01; i += 2 * E / 8) for (const [x, z] of [[i, -E], [i, E], [-E, i], [E, i]]) if (pc < 64) { M4.makeTranslation(x, 0, z); posts.setMatrixAt(pc++, M4); }
  posts.count = pc; g.add(posts);
  // city blocks + trees outside
  const rnd = (() => { let s = def.id === 'plaza' ? 7 : 19; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const bG = new THREE.BoxGeometry(1, 1, 1); bG.translate(0, 0.5, 0);
  const blds = new THREE.InstancedMesh(bG, new THREE.MeshStandardMaterial({ roughness: 0.7 }), 60); let bc = 0; const col = new THREE.Color();
  const bcols = ['#ffb5a7', '#a0d8ff', '#ffe08a', '#c8b6ff', '#9ee6c7', '#ffc6e0'];
  for (let i = 0; i < 60; i++) {
    const a = rnd() * PI * 2, d = B + 42 + rnd() * 60, x = Math.cos(a) * d, z = Math.sin(a) * d;
    const w = 8 + rnd() * 12, hh = 7 + rnd() * 22, dd = 8 + rnd() * 12;
    M4.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * PI), new THREE.Vector3(w, hh, dd));
    blds.setMatrixAt(bc, M4); blds.setColorAt(bc++, col.set(bcols[i % bcols.length]));
  }
  blds.count = bc; blds.castShadow = false; g.add(blds);
  const trunkG = new THREE.CylinderGeometry(0.18, 0.26, 2, 6); trunkG.translate(0, 1, 0);
  const crownG = new THREE.IcosahedronGeometry(1.5, 0); crownG.translate(0, 3.1, 0);
  const trunks = new THREE.InstancedMesh(trunkG, mat('#9c6b3f'), 50), crowns = new THREE.InstancedMesh(crownG, new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true }), 50);
  let tc = 0;
  for (let i = 0; i < 50; i++) {
    const side = i % 4, f = rnd() * 2 - 1, off = E + 3 + rnd() * 9;
    const x = side < 2 ? f * (E + 8) : (side === 2 ? -off : off), z = side < 2 ? (side === 0 ? -off : off) : f * (E + 8);
    const s = 0.8 + rnd() * 0.7;
    M4.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s)); trunks.setMatrixAt(tc, M4); crowns.setMatrixAt(tc, M4);
    crowns.setColorAt(tc++, col.set(['#5cc45a', '#4fb85a', '#7fd65c', '#3fae6a'][i % 4]));
  }
  trunks.count = crowns.count = tc; crowns.castShadow = true; g.add(trunks, crowns);
  // benches + lamp posts along the fence (decor)
  for (const [x, z, r] of [[-8, B - 1.2, 0], [6, B - 1.2, 0], [B - 1.2, 20, PI / 2]]) {
    const bn = add(new THREE.BoxGeometry(2.2, 0.12, 0.6), mat(ACC[1])); bn.position.set(x, 0.45, z); bn.rotation.y = r;
    const lg = add(new THREE.BoxGeometry(2.0, 0.42, 0.45), mat('#6b6f80')); lg.position.set(x, 0.21, z); lg.rotation.y = r;
  }
  return { def, els, segs, h, over, B, group: g, dispose() { scene.remove(g); } };
}
