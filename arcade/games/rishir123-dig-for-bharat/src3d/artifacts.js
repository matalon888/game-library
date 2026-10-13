/* ============================================================
   The finds, as objects rather than drawings. Each one is built
   from primitives at roughly its real size (a bangle is 8 cm,
   a pillar base is not), in a material that matches what the
   catalogue says it is made of.
   ============================================================ */
import * as THREE from "three";

const M = {
  terracotta: { color: 0xb1613a, roughness: 0.93, metalness: 0.0 },
  clay:       { color: 0x9a7350, roughness: 0.96, metalness: 0.0 },
  stone:      { color: 0x8e8578, roughness: 0.95, metalness: 0.0 },
  sandstone:  { color: 0xb09468, roughness: 0.42, metalness: 0.0 },
  steatite:   { color: 0x76736a, roughness: 0.55, metalness: 0.05 },
  chert:      { color: 0x5f5d59, roughness: 0.66, metalness: 0.02 },
  copper:     { color: 0xa9663a, roughness: 0.40, metalness: 0.92 },
  patina:     { color: 0x4c8f79, roughness: 0.62, metalness: 0.55 },
  bronze:     { color: 0x8a6a3c, roughness: 0.36, metalness: 0.95 },
  gold:       { color: 0xe0ac4c, roughness: 0.22, metalness: 1.0 },
  silver:     { color: 0xbdbab1, roughness: 0.31, metalness: 1.0 },
  iron:       { color: 0x4f4a45, roughness: 0.58, metalness: 0.80 },
  carnelian:  { color: 0xa8391f, roughness: 0.24, metalness: 0.0 },
  shell:      { color: 0xd8cdb4, roughness: 0.45, metalness: 0.0 },
  celadon:    { color: 0x7d9c88, roughness: 0.22, metalness: 0.0 },
  charcoal:   { color: 0x241d18, roughness: 1.0,  metalness: 0.0 },
  leaf:       { color: 0x5d4a2c, roughness: 0.88, metalness: 0.0 },
  stucco:     { color: 0xbfb096, roughness: 0.86, metalness: 0.0 }
};
const cache = {};
function mat(k) {
  if (!cache[k]) cache[k] = new THREE.MeshStandardMaterial(M[k]);
  return cache[k];
}
const mesh = (geo, k) => new THREE.Mesh(geo, mat(k));

/* a wheel-thrown profile, revolved */
function lathe(points, k, seg = 24) {
  const pts = points.map((p) => new THREE.Vector2(p[0], p[1]));
  return mesh(new THREE.LatheGeometry(pts, seg), k);
}
/* a curved shell of a larger vessel — what a sherd actually is */
function sherdOf(r, k) {
  const g = new THREE.SphereGeometry(r, 18, 12, 0.6, 1.5, 0.7, 0.8);
  const m = mesh(g, k); m.material = mat(k).clone(); m.material.side = THREE.DoubleSide;
  return m;
}
function lump(r, k, seed = 2) {
  const g = new THREE.IcosahedronGeometry(r, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const f = 0.72 + ((Math.sin(i * 12.9898 + seed) * 43758.5453) % 1 + 1) % 1 * 0.5;
    p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * 0.8, p.getZ(i) * f);
  }
  g.computeVertexNormals();
  return mesh(g, k);
}

const BUILD = {
  bangle: () => {
    const g = new THREE.Group();
    g.add(mesh(new THREE.TorusGeometry(0.075, 0.014, 10, 28), "terracotta"));
    const half = mesh(new THREE.TorusGeometry(0.072, 0.013, 10, 20, Math.PI * 1.1), "terracotta");
    half.position.set(0.02, 0.004, 0.05); half.rotation.set(0.4, 0.6, 1.2);
    g.add(half); g.children[0].rotation.x = Math.PI / 2;
    return g;
  },
  hook: () => {
    const g = new THREE.Group();
    const shank = mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.11, 8), "copper");
    shank.position.y = 0.05; g.add(shank);
    const bend = mesh(new THREE.TorusGeometry(0.028, 0.005, 8, 16, Math.PI * 1.35), "copper");
    bend.rotation.set(Math.PI / 2, 0, 0.6); g.add(bend);
    return g;
  },
  weight: () => {
    const g = new THREE.Group();
    const a = mesh(new THREE.BoxGeometry(0.07, 0.07, 0.07), "chert"); g.add(a);
    const b = mesh(new THREE.BoxGeometry(0.045, 0.045, 0.045), "chert");
    b.position.set(0.085, -0.012, 0.03); b.rotation.y = 0.5; g.add(b);
    return g;
  },
  brick: () => {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const b = mesh(new THREE.BoxGeometry(0.28, 0.07, 0.14), "terracotta");
      b.position.set(i % 2 ? 0.03 : -0.03, -0.075 * i, i * 0.02);
      b.rotation.y = (i - 1) * 0.06; g.add(b);
    }
    return g;
  },
  seal: () => {
    const g = new THREE.Group();
    const s = mesh(new THREE.BoxGeometry(0.075, 0.018, 0.075), "steatite"); g.add(s);
    const boss = mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.016, 12), "steatite");
    boss.position.y = 0.017; g.add(boss);
    for (let i = 0; i < 5; i++) {                       // a line of signs, incised
      const sign = mesh(new THREE.BoxGeometry(0.007, 0.004, 0.011), "chert");
      sign.position.set(-0.026 + i * 0.013, -0.009, -0.024); g.add(sign);
    }
    return g;
  },
  burial: () => {
    const g = new THREE.Group();
    const pot = lathe([[0.001, 0], [0.06, 0.005], [0.10, 0.05], [0.105, 0.12],
                       [0.075, 0.19], [0.058, 0.215], [0.062, 0.225], [0.001, 0.226]], "terracotta");
    g.add(pot);
    const small = lathe([[0.001, 0], [0.04, 0.004], [0.06, 0.04], [0.045, 0.075], [0.001, 0.078]], "terracotta");
    small.position.set(0.15, 0, 0.06); g.add(small);
    return g;
  },
  bead: () => {
    const g = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const long = i % 3 === 0;
      const b = mesh(long ? new THREE.CylinderGeometry(0.011, 0.011, 0.07, 10)
                          : new THREE.SphereGeometry(0.013, 12, 8), "carnelian");
      b.position.set(-0.07 + i * 0.028, 0.012, Math.sin(i) * 0.02);
      b.rotation.z = Math.PI / 2 + Math.sin(i * 2) * 0.3; g.add(b);
    }
    return g;
  },
  drill: () => {
    const g = new THREE.Group();
    const bit = mesh(new THREE.ConeGeometry(0.011, 0.10, 10), "chert");
    bit.rotation.z = Math.PI; bit.position.y = 0.05; g.add(bit);
    const stub = mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.03, 10), "chert");
    stub.position.y = 0.11; g.add(stub);
    return g;
  },
  game: () => {
    const g = new THREE.Group();
    const die = mesh(new THREE.BoxGeometry(0.038, 0.038, 0.038), "terracotta");
    die.rotation.set(0.3, 0.6, 0.1); g.add(die);
    for (let i = 0; i < 3; i++) {
      const p = lathe([[0.001, 0], [0.022, 0.004], [0.014, 0.03], [0.018, 0.045], [0.001, 0.048]], "terracotta", 14);
      p.position.set(0.06 + (i % 2) * 0.05, -0.019, -0.05 + i * 0.045); g.add(p);
    }
    return g;
  },
  grain: () => {
    const g = lump(0.075, "clay", 5);
    for (let i = 0; i < 7; i++) {                        // husk impressions
      const h = mesh(new THREE.CapsuleGeometry(0.003, 0.016, 3, 6), "leaf");
      h.position.set((i - 3) * 0.017, 0.05 + Math.sin(i) * 0.01, Math.cos(i * 2) * 0.03);
      h.rotation.set(1.2, i, 0.4); g.add(h);
    }
    return g;
  },
  sherd: () => {
    const g = new THREE.Group();
    const a = sherdOf(0.10, "steatite"); a.rotation.set(0.9, 0.3, 0.2); g.add(a);
    const b = sherdOf(0.075, "steatite"); b.position.set(0.11, -0.02, 0.05);
    b.rotation.set(1.6, 1.1, 0); g.add(b);
    return g;
  },
  coin: () => {
    const g = new THREE.Group();
    const pot = lathe([[0.001, 0], [0.07, 0.004], [0.085, 0.05], [0.06, 0.10], [0.048, 0.105], [0.001, 0.106]], "terracotta");
    g.add(pot);
    for (let i = 0; i < 9; i++) {
      const c = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.0035, 14), "gold");
      c.position.set(Math.cos(i * 2.4) * 0.03, 0.105 + i * 0.004, Math.sin(i * 2.4) * 0.03);
      c.rotation.set(Math.sin(i) * 0.25, i, Math.cos(i) * 0.2); g.add(c);
    }
    return g;
  },
  chisel: () => {
    const g = new THREE.Group();
    const b = mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.13, 8), "iron");
    b.position.y = 0.06; g.add(b);
    const tip = mesh(new THREE.ConeGeometry(0.012, 0.03, 8), "iron");
    tip.rotation.x = Math.PI; g.add(tip);
    return g;
  },
  flake: () => {
    const f = lump(0.06, "sandstone", 9);
    f.scale.set(1.2, 0.32, 1);
    return f;
  },
  edict: () => {
    const g = new THREE.Group();
    const slab = mesh(new THREE.BoxGeometry(0.20, 0.055, 0.30), "sandstone");
    slab.rotation.z = 0.05; g.add(slab);
    for (let r = 0; r < 4; r++)                          // four lines of Brahmi
      for (let i = 0; i < 7; i++) {
        const ch = mesh(new THREE.BoxGeometry(0.008, 0.006, 0.004), "stone");
        ch.position.set(-0.075 + i * 0.025, 0.028, -0.10 + r * 0.06); g.add(ch);
      }
    return g;
  },
  pillar: () => {
    const g = new THREE.Group();
    const base = mesh(new THREE.BoxGeometry(0.32, 0.09, 0.32), "sandstone"); g.add(base);
    const drum = mesh(new THREE.CylinderGeometry(0.10, 0.115, 0.42, 16), "sandstone");
    drum.position.y = 0.25; g.add(drum);
    const band = mesh(new THREE.CylinderGeometry(0.118, 0.118, 0.035, 16), "sandstone");
    band.position.y = 0.10; g.add(band);
    return g;
  },
  head: () => {
    const g = new THREE.Group();
    const h = mesh(new THREE.SphereGeometry(0.085, 20, 16), "stucco");
    h.scale.set(0.9, 1.15, 0.95); g.add(h);
    const knot = mesh(new THREE.SphereGeometry(0.032, 12, 10), "stucco");
    knot.position.y = 0.088; g.add(knot);
    for (const s of [-1, 1]) {
      const ear = mesh(new THREE.SphereGeometry(0.016, 8, 8), "stucco");
      ear.scale.set(0.5, 1.5, 0.4); ear.position.set(s * 0.077, -0.01, 0); g.add(ear);
    }
    return g;
  },
  bronze: () => {
    const g = new THREE.Group();
    const ring = mesh(new THREE.TorusGeometry(0.10, 0.010, 10, 30), "patina"); g.add(ring);
    const body = mesh(new THREE.CylinderGeometry(0.014, 0.020, 0.10, 10), "bronze"); g.add(body);
    const head = mesh(new THREE.SphereGeometry(0.021, 12, 10), "bronze");
    head.position.y = 0.065; g.add(head);
    for (const s of [-1, 1]) {
      const arm = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.085, 8), "bronze");
      arm.position.set(s * 0.035, 0.028, 0); arm.rotation.z = s * 1.05; g.add(arm);
    }
    const base = mesh(new THREE.CylinderGeometry(0.045, 0.052, 0.022, 14), "bronze");
    base.position.y = -0.058; g.add(base);
    return g;
  },
  plate: () => {
    const g = new THREE.Group();
    const p = mesh(new THREE.BoxGeometry(0.24, 0.006, 0.17), "patina");
    p.rotation.z = 0.03; g.add(p);
    for (let r = 0; r < 5; r++) {
      const line = mesh(new THREE.BoxGeometry(0.19, 0.002, 0.004), "copper");
      line.position.set(0, 0.004, -0.055 + r * 0.028); g.add(line);
    }
    const ring = mesh(new THREE.TorusGeometry(0.022, 0.005, 8, 16), "copper");
    ring.position.set(-0.135, 0, 0); ring.rotation.y = Math.PI / 2; g.add(ring);
    return g;
  },
  lamp: () => {
    const l = lathe([[0.001, 0], [0.055, 0.002], [0.062, 0.018], [0.05, 0.032],
                     [0.046, 0.030], [0.052, 0.014], [0.001, 0.012]], "terracotta");
    const g = new THREE.Group(); g.add(l);
    const spout = mesh(new THREE.ConeGeometry(0.018, 0.035, 8), "terracotta");
    spout.rotation.set(0, 0, -Math.PI / 2); spout.position.set(0.07, 0.016, 0); g.add(spout);
    const soot = mesh(new THREE.SphereGeometry(0.010, 8, 6), "charcoal");
    soot.position.set(0.086, 0.018, 0); soot.scale.set(1, 0.6, 1); g.add(soot);
    return g;
  },
  manus: () => {
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const leaf = mesh(new THREE.BoxGeometry(0.30, 0.0035, 0.055), i < 2 ? "charcoal" : "leaf");
      leaf.position.set(Math.sin(i) * 0.012, i * 0.005, i * 0.004);
      leaf.rotation.y = (i - 2) * 0.03; g.add(leaf);
    }
    const hole = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.03, 8), "charcoal");
    hole.position.y = 0.012; g.add(hole);
    return g;
  },
  flame: () => {
    const g = new THREE.Group();
    const beam = mesh(new THREE.BoxGeometry(0.34, 0.06, 0.07), "charcoal");
    beam.rotation.set(0.1, 0.2, 0.05); g.add(beam);
    for (let i = 0; i < 5; i++) {
      const c = lump(0.028, "charcoal", i * 3 + 1);
      c.position.set(-0.12 + i * 0.07, -0.03, Math.sin(i * 2) * 0.06); g.add(c);
    }
    return g;
  },
  slag: () => {
    const g = new THREE.Group();
    const a = lump(0.075, "iron", 4); a.scale.y = 0.6; g.add(a);
    const b = lump(0.042, "iron", 11); b.position.set(0.09, -0.012, 0.04); g.add(b);
    return g;
  },
  wheel: () => {
    const g = new THREE.Group();
    const rim = mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.055, 22), "sandstone");
    rim.rotation.x = Math.PI / 2; g.add(rim);
    const hub = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.075, 14), "sandstone");
    hub.rotation.x = Math.PI / 2; g.add(hub);
    for (let i = 0; i < 8; i++) {
      const s = mesh(new THREE.BoxGeometry(0.028, 0.15, 0.045), "sandstone");
      s.position.set(Math.cos(i * 0.785) * 0.10, Math.sin(i * 0.785) * 0.10, 0);
      s.rotation.z = i * 0.785 + Math.PI / 2; g.add(s);
    }
    return g;
  }
};

export function buildFind(key) {
  const g = (BUILD[key] || BUILD.weight)();
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
export const findMaterials = () => cache;
