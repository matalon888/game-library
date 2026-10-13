/* ============================================================
   The voxel world: terrain, strata, landmarks, and the mesher.

   128 x 128 blocks, 64 tall, one metre to a block. Every column
   carries the same five archaeological layers under whatever is
   growing on top of it, so the site is not a pit in a plain —
   it is the ground itself, everywhere.

   Meshing is per chunk, faces only where a block meets air, with
   per-vertex ambient occlusion and a skylight term baked into
   vertex colour. That combination is the entire look; there is
   no dynamic light on the terrain at all.
   ============================================================ */
import * as THREE from "three";
import { B, BLOCKS, isOpaque, isSolid, isCross, buildAtlas } from "./blocks.js";
import { t } from "./i18n.js";
import { buildCity } from "./city.js";

export const WX = 128, WZ = 128, WY = 64, CH = 16;
export const CHUNKS_X = WX / CH, CHUNKS_Z = WZ / CH;
export const SEA = 15;
export const STRATA_THICK = 1;          // one block per layer: the deepest find is 5 m, not 9

const idx = (x, y, z) => (y * WZ + z) * WX + x;
const hidx = (x, z) => z * WX + x;

/* ---------------- noise ---------------- */
function hash2(x, z, s) {
  let h = (x * 1836311903) ^ (z * 2971215073) ^ (s * 4294967291);
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const smooth = (t) => t * t * (3 - 2 * t);
function vnoise(x, z, s) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = smooth(xf), v = smooth(zf);
  const a = hash2(xi, zi, s), b = hash2(xi + 1, zi, s);
  const c = hash2(xi, zi + 1, s), d = hash2(xi + 1, zi + 1, s);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
function fbm(x, z, s, oct = 4, lac = 2.0, gain = 0.5) {
  let f = 1, a = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) { sum += a * vnoise(x * f, z * f, s + i * 31); norm += a; f *= lac; a *= gain; }
  return sum / norm;
}

/* ---------------- landmark vocabulary ----------------
   Each of these is built out of ordinary blocks, so a clue can
   describe it in words and the player can recognise it on the
   skyline rather than follow a marker. */
export const LANDMARKS = {
  tree:     { key: "landmark.tree" },
  grove:     { key: "landmark.grove" },
  cairn:     { key: "landmark.cairn" },
  burnt:     { key: "landmark.burnt" },
  hollow:     { key: "landmark.hollow" },
  scatter:     { key: "landmark.scatter" },
  platform:     { key: "landmark.platform" },
  wallline:     { key: "landmark.wallline" },
  outcrop:     { key: "landmark.outcrop" },
  channel:     { key: "landmark.channel" },
  stump:     { key: "landmark.stump" },
  chips:     { key: "landmark.chips" },
  slagheap:     { key: "landmark.slagheap" },
  saltpan:     { key: "landmark.saltpan" },
  postrow:     { key: "landmark.postrow" },
  ashfloor:     { key: "landmark.ashfloor" }
};

export class World {
  constructor(site, cfg, seed) {
    this.site = site;
    this.cfg = cfg;
    this.seed = seed;
    this.blocks = new Uint8Array(WX * WY * WZ);   // the active view
    this.nowBlocks = this.blocks;                 // buried remains, diggable
    this.thenBlocks = null;                       // the city as it stood
    this.view = "now";
    this.cityLabels = [];
    this.height = new Int16Array(WX * WZ);     // topmost solid, land only
    this.surface = new Int16Array(WX * WZ);    // ground level ignoring props
    this.finds = new Map();                    // "x,y,z" -> find index
    this.landmarks = [];
    this.dirty = new Set();
  }

  get(x, y, z) {
    if (x < 0 || y < 0 || z < 0 || x >= WX || y >= WY || z >= WZ) return B.AIR;
    return this.blocks[idx(x, y, z)];
  }
  set(x, y, z, id) {
    if (x < 0 || y < 0 || z < 0 || x >= WX || y >= WY || z >= WZ) return;
    this.blocks[idx(x, y, z)] = id;
  }
  /* write into the standing city only */
  setThen(x, y, z, id) {
    if (!this.thenBlocks) return;
    if (x < 0 || y < 0 || z < 0 || x >= WX || y >= WY || z >= WZ) return;
    this.thenBlocks[idx(x, y, z)] = id;
  }
  /* Write into the dig world only, at a depth below whatever the ground
     is HERE. Anchoring to the city's terrace instead leaves foundations
     standing in mid-air wherever the mound falls away. */
  setBuried(x, z, depth, id) {
    if (x < 0 || z < 0 || x >= WX || z >= WZ) return;
    const y = this.surfaceAt(x, z) - depth;
    if (y < 1 || y >= WY) return;
    if (depth < 1) return;                       // never above ground
    this.nowBlocks[idx(x, y, z)] = id;
  }

  /* Build the city from the same terrain, then keep both. The dig world
     already holds its buried walls, written by the builder as it went. */
  buildThenWorld() {
    this.thenBlocks = new Uint8Array(this.nowBlocks);
    const out = buildCity(this, this.site.id);
    this.cityLabels = out.labels;
    this.cityBase = out.base;
    return out.anchors;
  }

  setView(v) {
    if (v === this.view) return;
    if (v === "then" && !this.thenBlocks) return;
    this.view = v;
    this.blocks = v === "then" ? this.thenBlocks : this.nowBlocks;
    this._recomputeHeights();
    for (let i = 0; i < CHUNKS_X * CHUNKS_Z; i++) this.dirty.add(i);
  }

  heightAt(x, z) {
    if (x < 0 || z < 0 || x >= WX || z >= WZ) return SEA;
    return this.height[hidx(x, z)];
  }
  surfaceAt(x, z) {
    if (x < 0 || z < 0 || x >= WX || z >= WZ) return SEA;
    return this.surface[hidx(x, z)];
  }
  /* depth in metres below the original ground surface */
  depthAt(x, y, z) { return this.surfaceAt(x, z) - y; }
  layerAt(x, y, z) {
    const d = this.depthAt(x, y, z);
    if (d < 0) return -1;
    return Math.min(4, Math.floor(d / STRATA_THICK));
  }

  /* ================= generation ================= */
  generate() {
    const cfg = this.cfg, s = this.seed;
    const cx = WX / 2, cz = WZ / 2;

    /* --- height field: a plain, a tell, a watercourse --- */
    for (let z = 0; z < WZ; z++)
      for (let x = 0; x < WX; x++) {
        const roll = fbm(x / 46, z / 46, s, 4) * cfg.relief;
        const fine = fbm(x / 13, z / 13, s + 91, 3) * 1.6;
        let h = cfg.base + roll + fine;

        /* the mound the site sits on */
        const dm = Math.hypot(x - cx, z - cz) / cfg.moundR;
        if (dm < 1) h += cfg.mound * Math.pow(Math.cos(dm * Math.PI / 2), 1.7);

        /* a meandering channel, cut before anything is placed in it */
        if (cfg.river) {
          const bend = (vnoise(z / 38, 0, s + 7) - 0.5) * 34;
          const dist = Math.abs(x - (cfg.riverX + bend));
          if (dist < cfg.riverW) {
            const t = 1 - dist / cfg.riverW;
            h -= (cfg.riverDepth + 2) * Math.pow(t, 0.8);
          }
        }
        /* ease the outer rim to a constant height so the distant plain
           can carry on from it without a visible step */
        const edge = Math.min(x, z, WX - 1 - x, WZ - 1 - z);
        if (edge < 16) h = cfg.base + (h - cfg.base) * smooth(edge / 16);

        this.surface[hidx(x, z)] = Math.max(3, Math.round(h));
      }

    /* --- fill the column: strata under whatever is on top --- */
    for (let z = 0; z < WZ; z++)
      for (let x = 0; x < WX; x++) {
        const top = this.surface[hidx(x, z)];
        for (let y = 0; y <= top; y++) {
          const d = top - y;
          let id;
          if (y <= 1) id = B.BEDROCK;
          else if (d >= STRATA_THICK * 5) id = B.STONE;
          else id = cfg.strata[Math.floor(d / STRATA_THICK)];
          this.blocks[idx(x, y, z)] = id;
        }
        /* skin: turf, sand or salt, unless it is under water */
        if (top >= SEA) this.blocks[idx(x, top, z)] = cfg.skin;
        for (let y = top + 1; y <= SEA; y++) this.blocks[idx(x, y, z)] = B.WATER;
      }

    /* --- vegetation --- */
    this._scatterPlants();

    /* --- the city as it stood, then the six landmarks on top of it --- */
    const anchors = this.buildThenWorld();
    this._placeLandmarks(anchors);

    this._recomputeHeights();
    return this.landmarks;
  }

  _scatterPlants() {
    const cfg = this.cfg, s = this.seed;
    for (let z = 2; z < WZ - 2; z++)
      for (let x = 2; x < WX - 2; x++) {
        const top = this.surface[hidx(x, z)];
        if (top < SEA + 1) continue;
        const density = fbm(x / 30, z / 30, s + 401, 2);
        const r = hash2(x, z, s + 55);
        if (r < cfg.trees * density * 0.02) this._tree(x, top + 1, z, 4 + Math.floor(hash2(x, z, s + 5) * 3));
        else if (r < cfg.scrub * density * 0.06) this.set(x, top + 1, z, B.SCRUB);
      }
  }

  _tree(x, y, z, h) {
    if (this.get(x, y - 1, z) === B.WATER) return;
    for (let i = 0; i < h; i++) this.set(x, y + i, z, B.LOG);
    const top = y + h;
    for (let dy = -2; dy <= 1; dy++)
      for (let dz = -2; dz <= 2; dz++)
        for (let dx = -2; dx <= 2; dx++) {
          const r = Math.hypot(dx, dy * 1.4, dz);
          if (r > 2.5) continue;
          if (hash2(x + dx * 7, z + dz * 13 + dy, 99) < 0.16) continue;
          if (this.get(x + dx, top + dy, z + dz) === B.AIR) this.set(x + dx, top + dy, z + dz, B.LEAVES);
        }
  }

  /* Landmarks sit on a ring around the mound so they are all within
     a couple of minutes' walk, and each one is visibly different. */
  _placeLandmarks(anchors) {
    const cx = WX / 2, cz = WZ / 2;
    const specs = this.cfg.landmarks;
    specs.forEach((spec, i) => {
      const a = anchors && anchors[i];
      const ang = (i / specs.length) * Math.PI * 2 + this.seed * 0.7;
      const rad = spec.radius || (20 + (i % 3) * 9);
      let x = a ? a.x : Math.round(cx + Math.cos(ang) * rad);
      let z = a ? a.z : Math.round(cz + Math.sin(ang) * rad);
      x = Math.max(8, Math.min(WX - 9, x));
      z = Math.max(8, Math.min(WZ - 9, z));
      const y = this.surface[hidx(x, z)];
      this._buildLandmark(spec.type, x, y, z);
      this.landmarks.push({
        type: spec.type, key: LANDMARKS[spec.type].key,
        get label() { return t(this.key); },
        x, z, y, find: i
      });
      /* the find goes straight down beneath it, at its own layer */
      const f = this.site.finds[i];
      const layer = Math.min(4, Math.floor(f.r / 2));
      const fy = y - (layer * STRATA_THICK + 1);
      this.finds.set(x + "," + fy + "," + z, i);
      f.dig = { x, y: fy, z, layer, depth: y - fy };
    });
  }

  _buildLandmark(type, x, y, z) {
    const set = (dx, dy, dz, id) => this.set(x + dx, y + dy, z + dz, id);
    const disc = (r, id, dy = 0) => {
      for (let dz = -r; dz <= r; dz++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.hypot(dx, dz) > r + 0.3) continue;
          const sy = this.surface[hidx(Math.max(0, Math.min(WX - 1, x + dx)), Math.max(0, Math.min(WZ - 1, z + dz)))];
          this.set(x + dx, sy + dy, z + dz, id);
        }
    };
    switch (type) {
      case "tree": this._tree(x, y + 1, z, 7); break;
      case "grove":
        for (const [ox, oz, h] of [[0, 0, 6], [3, 2, 5], [-2, 3, 5], [2, -3, 4]])
          this._tree(x + ox, this.surface[hidx(x + ox, z + oz)] + 1, z + oz, h);
        break;
      case "cairn":
        for (let dy = 0; dy < 4; dy++) {
          const r = dy < 2 ? 1 : 0;
          for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) set(dx, dy + 1, dz, B.GRANITE);
        }
        break;
      case "burnt": disc(4, B.BURNT); disc(2, B.ASH); break;
      case "hollow":
        for (let dz = -6; dz <= 6; dz++)
          for (let dx = -6; dx <= 6; dx++) {
            const r = Math.hypot(dx, dz);
            if (r > 6) continue;
            const cut = Math.round(2.2 * Math.cos(r / 6 * Math.PI / 2));
            const sy = this.surfaceAt(x + dx, z + dz);
            for (let dy = 0; dy < cut; dy++) this.set(x + dx, sy - dy, z + dz, B.AIR);
          }
        break;
      case "scatter": disc(4, B.SHERD); break;
      case "platform":
        for (let dz = -3; dz <= 3; dz++) for (let dx = -4; dx <= 4; dx++) {
          set(dx, 1, dz, B.MUDBRICK);
          if (Math.abs(dx) === 4 || Math.abs(dz) === 3) set(dx, 2, dz, B.MUDBRICK);
        }
        break;
      case "wallline":
        for (let d = -5; d <= 5; d++) { set(d, 1, 0, B.BRICK); set(d, 1, 1, B.BRICK); if (d % 3 === 0) set(d, 2, 0, B.BRICK); }
        break;
      case "outcrop":
        for (const [ox, oz, h] of [[0, 0, 3], [2, 1, 2], [-2, 2, 2], [1, -2, 1]])
          for (let dy = 0; dy < h; dy++)
            for (let dz = 0; dz <= (h > 2 ? 1 : 0); dz++) for (let dx = 0; dx <= 1; dx++)
              set(ox + dx, dy + 1, oz + dz, B.GRANITE);
        break;
      case "channel":
        for (let d = -8; d <= 8; d++)
          for (let w = -1; w <= 1; w++) {
            const sy = this.surfaceAt(x + d, z + w);
            for (let dy = 0; dy < 2; dy++) this.set(x + d, sy - dy, z + w, B.AIR);
          }
        break;
      case "stump":
        set(0, 1, 0, B.GRANITE); set(0, 2, 0, B.GRANITE); set(1, 1, 0, B.GRANITE);
        set(0, 1, 1, B.RUBBLE); set(-1, 1, 0, B.RUBBLE);
        break;
      case "chips": disc(3, B.CHIPS); break;
      case "slagheap":
        for (let dy = 0; dy < 3; dy++) {
          const r = 3 - dy;
          for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++)
            if (Math.hypot(dx, dz) <= r) set(dx, dy + 1, dz, B.SLAG);
        }
        break;
      case "saltpan": disc(5, B.SALT); break;
      case "postrow":
        for (let i = -2; i <= 2; i++) {
          const px = x + i * 4;
          const sy = this.surfaceAt(px, z);
          for (let dy = 1; dy <= 2 + (i % 2); dy++) this.set(px, sy + dy, z, B.GRANITE);
        }
        break;
      case "ashfloor": disc(4, B.CHARCOAL); disc(6, B.ASH, 0); disc(3, B.CHARCOAL); break;
    }
  }

  _recomputeHeights() {
    for (let z = 0; z < WZ; z++)
      for (let x = 0; x < WX; x++) {
        let h = 0;
        for (let y = WY - 1; y >= 0; y--) {
          const b = this.blocks[idx(x, y, z)];
          if (b !== B.AIR && b !== B.WATER && b !== B.SCRUB) { h = y; break; }
        }
        this.height[hidx(x, z)] = h;
      }
  }

  /* skylight: full above the local surface, falling off with depth.
     A shaft dug straight down stays lit, exactly as it should — light
     comes down it — while an undercut wall goes dark. */
  lightAt(x, y, z) {
    if (x < 0 || z < 0 || x >= WX || z >= WZ) return 1;
    const h = this.height[hidx(x, z)];
    if (y > h) return 1;
    return Math.max(0.26, 1 - 0.115 * (h - y));
  }

  /* ================= digging ================= */
  breakBlock(x, y, z) {
    const id = this.get(x, y, z);
    if (id === B.AIR || (BLOCKS[id] && BLOCKS[id].unbreakable)) return null;
    this.set(x, y, z, B.AIR);
    const col = hidx(x, z);
    if (this.height[col] === y) {
      let h = 0;
      for (let yy = y; yy >= 0; yy--) {
        const b = this.blocks[idx(x, yy, z)];
        if (b !== B.AIR && b !== B.WATER) { h = yy; break; }
      }
      this.height[col] = h;
    }
    this._touch(x, z);
    return id;
  }
  /* Mark the chunk this block lives in, and a neighbour ONLY when the
     block sits on a chunk seam — the faces across that seam are the
     only ones another chunk can be holding. Remeshing all nine
     neighbours on every break, which is what this used to do, is
     nine times the work for no visible difference. */
  _touch(x, z) {
    const cx = Math.floor(x / CH), cz = Math.floor(z / CH);
    const add = (a, b) => {
      if (a >= 0 && b >= 0 && a < CHUNKS_X && b < CHUNKS_Z) this.dirty.add(b * CHUNKS_X + a);
    };
    add(cx, cz);
    const lx = x - cx * CH, lz = z - cz * CH;
    if (lx === 0) add(cx - 1, cz);
    if (lx === CH - 1) add(cx + 1, cz);
    if (lz === 0) add(cx, cz - 1);
    if (lz === CH - 1) add(cx, cz + 1);
  }

  /* ================= raycast ================= */
  raycast(origin, dir, maxDist) {
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const sx = Math.sign(dir.x), sy = Math.sign(dir.y), sz = Math.sign(dir.z);
    const INF = Infinity;
    const nx = (sx > 0 ? x + 1 - origin.x : origin.x - x);
    const ny = (sy > 0 ? y + 1 - origin.y : origin.y - y);
    const nz = (sz > 0 ? z + 1 - origin.z : origin.z - z);
    let tMaxX = sx === 0 ? INF : nx / Math.abs(dir.x);
    let tMaxY = sy === 0 ? INF : ny / Math.abs(dir.y);
    let tMaxZ = sz === 0 ? INF : nz / Math.abs(dir.z);
    const tDX = sx === 0 ? INF : Math.abs(1 / dir.x);
    const tDY = sy === 0 ? INF : Math.abs(1 / dir.y);
    const tDZ = sz === 0 ? INF : Math.abs(1 / dir.z);
    let t = 0, nrm = [0, 1, 0];
    for (let g = 0; g < 400; g++) {
      if (t > maxDist) return null;
      const b = this.get(x, y, z);
      if (b !== B.AIR && b !== B.WATER) return { x, y, z, id: b, t, n: nrm };
      if (tMaxX <= tMaxY && tMaxX <= tMaxZ) { x += sx; t = tMaxX; tMaxX += tDX; nrm = [-sx, 0, 0]; }
      else if (tMaxY <= tMaxZ) { y += sy; t = tMaxY; tMaxY += tDY; nrm = [0, -sy, 0]; }
      else { z += sz; t = tMaxZ; tMaxZ += tDZ; nrm = [0, 0, -sz]; }
      if (y < 0 || y >= WY) return null;
    }
    return null;
  }
}

/* ================= meshing ================= */
/* u x v = n, so the winding comes out anticlockwise from outside.
   `swap` marks the faces whose u axis runs vertically, which would
   otherwise rotate the texture ninety degrees. */
const FACES = [
  { n: [1, 0, 0],  u: [0, 1, 0], v: [0, 0, 1], shade: 0.62, swap: true },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], shade: 0.62, swap: false },
  { n: [0, 1, 0],  u: [0, 0, 1], v: [1, 0, 0], shade: 1.00, swap: false },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], shade: 0.45, swap: false },
  { n: [0, 0, 1],  u: [1, 0, 0], v: [0, 1, 0], shade: 0.80, swap: false },
  { n: [0, 0, -1], u: [0, 1, 0], v: [1, 0, 0], shade: 0.80, swap: true }
];
const ATLAS_N = 8;

export class Mesher {
  constructor(world) {
    this.world = world;
    this.atlas = buildAtlas();
    /* Unlit on purpose: the shading is already in the vertex colours
       (face direction x ambient occlusion x skylight). A scene light on
       top of that would shade everything twice. */
    this.matOpaque = new THREE.MeshBasicMaterial({ map: this.atlas, vertexColors: true, fog: true });
    this.matWater = new THREE.MeshBasicMaterial({
      map: this.atlas, vertexColors: true, fog: true,
      transparent: true, opacity: 0.76, depthWrite: false
    });
    /* crossed billboards for scrub — alpha-tested so the gaps between
       blades are actually gaps */
    this.matCross = new THREE.MeshBasicMaterial({
      map: this.atlas, vertexColors: true, fog: true,
      alphaTest: 0.5, side: THREE.DoubleSide
    });
    this.group = new THREE.Group();
    this.chunks = new Array(CHUNKS_X * CHUNKS_Z).fill(null);
  }

  tileOf(id, face) {
    const b = BLOCKS[id];
    if (!b) return 0;
    if (face === 2) return b.top;
    if (face === 3) return b.bottom;
    return b.side;
  }

  buildChunk(ci) {
    const w = this.world;
    const cx = (ci % CHUNKS_X) * CH, cz = Math.floor(ci / CHUNKS_X) * CH;
    const pos = [], uv = [], col = [], ind = [];
    const wpos = [], wuv = [], wcol = [], wind = [];
    const xpos = [], xuv = [], xcol = [], xind = [];

    let top = 0;
    for (let z = cz; z < cz + CH; z++)
      for (let x = cx; x < cx + CH; x++) top = Math.max(top, w.heightAt(x, z));
    top = Math.min(WY - 1, Math.max(top, SEA) + 1);

    for (let y = 0; y <= top; y++)
      for (let z = cz; z < cz + CH; z++)
        for (let x = cx; x < cx + CH; x++) {
          const id = w.get(x, y, z);
          if (id === B.AIR) continue;

          if (isCross(id)) {                       /* two crossed quads */
            const tile = BLOCKS[id].side;
            const tx = tile % ATLAS_N, ty = Math.floor(tile / ATLAS_N);
            const l = w.lightAt(x, y, z) * 0.94;
            const a = 0.06, b2 = 0.94;
            const quads = [
              [[a, a], [b2, b2]],
              [[b2, a], [a, b2]]
            ];
            for (const [p0, p1] of quads) {
              const base = xpos.length / 3;
              const corners = [[p0, 0], [p1, 0], [p1, 1], [p0, 1]];
              corners.forEach(([pt, up], c) => {
                xpos.push(x + pt[0], y + up, z + pt[1]);
                const du = (c === 1 || c === 2) ? 1 : 0;
                xuv.push((tx + du) / ATLAS_N, (ty + 1 - up) / ATLAS_N);
                xcol.push(l, l, l);
              });
              xind.push(base, base + 1, base + 2, base, base + 2, base + 3);
            }
            continue;
          }

          const liquid = id === B.WATER;
          const P = liquid ? wpos : pos, U = liquid ? wuv : uv,
                C = liquid ? wcol : col, I = liquid ? wind : ind;

          for (let f = 0; f < 6; f++) {
            const F = FACES[f];
            const ax = x + F.n[0], ay = y + F.n[1], az = z + F.n[2];
            const nb = w.get(ax, ay, az);
            if (liquid) { if (nb !== B.AIR) continue; }
            else if (isOpaque(nb)) continue;
            else if (nb === id) continue;

            const tile = this.tileOf(id, f);
            const tx = tile % ATLAS_N, ty = Math.floor(tile / ATLAS_N);
            const light = w.lightAt(ax, ay, az) * F.shade;
            const base = I.length ? P.length / 3 : P.length / 3;
            const ao = [];

            for (let c = 0; c < 4; c++) {
              const du = c === 1 || c === 2 ? 1 : 0;
              const dv = c === 2 || c === 3 ? 1 : 0;
              const su = du * 2 - 1, sv = dv * 2 - 1;
              /* the three neighbours that shade this corner */
              const s1 = isOpaque(w.get(ax + F.u[0] * su, ay + F.u[1] * su, az + F.u[2] * su));
              const s2 = isOpaque(w.get(ax + F.v[0] * sv, ay + F.v[1] * sv, az + F.v[2] * sv));
              const cn = isOpaque(w.get(ax + F.u[0] * su + F.v[0] * sv,
                                       ay + F.u[1] * su + F.v[1] * sv,
                                       az + F.u[2] * su + F.v[2] * sv));
              const occ = (s1 && s2) ? 0 : 3 - (s1 + s2 + cn);
              ao.push(0.52 + occ * 0.16);

              P.push(
                x + 0.5 + F.n[0] * 0.5 + (du - 0.5) * F.u[0] + (dv - 0.5) * F.v[0],
                y + 0.5 + F.n[1] * 0.5 + (du - 0.5) * F.u[1] + (dv - 0.5) * F.v[1],
                z + 0.5 + F.n[2] * 0.5 + (du - 0.5) * F.u[2] + (dv - 0.5) * F.v[2]
              );
              const uu = F.swap ? dv : du, vv = F.swap ? du : dv;
              U.push((tx + uu) / ATLAS_N, (ty + 1 - vv) / ATLAS_N);
              const l = light * ao[c];
              C.push(l, l, l);
            }
            /* flip the split so the ambient occlusion gradient stays smooth */
            if (ao[0] + ao[2] > ao[1] + ao[3])
              I.push(base, base + 1, base + 2, base, base + 2, base + 3);
            else
              I.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
          }
        }

    const old = this.chunks[ci];
    if (old) {
      this.group.remove(old.solid, old.water, old.cross);
      old.solid.geometry.dispose(); old.water.geometry.dispose(); old.cross.geometry.dispose();
    }

    const make = (P, U, C, I, mat) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
      g.setAttribute("color", new THREE.Float32BufferAttribute(C, 3));
      g.setIndex(I);
      const m = new THREE.Mesh(g, mat);
      m.matrixAutoUpdate = false;
      return m;
    };
    const solid = make(pos, uv, col, ind, this.matOpaque);
    const water = make(wpos, wuv, wcol, wind, this.matWater);
    const cross = make(xpos, xuv, xcol, xind, this.matCross);
    water.renderOrder = 1;
    this.chunks[ci] = { solid, water, cross };
    this.group.add(solid, water, cross);
  }

  buildAll(onProgress) {
    const total = CHUNKS_X * CHUNKS_Z;
    for (let i = 0; i < total; i++) { this.buildChunk(i); if (onProgress) onProgress(i + 1, total); }
  }
  flushDirty() {
    if (!this.world.dirty.size) return;
    for (const ci of this.world.dirty) this.buildChunk(ci);
    this.world.dirty.clear();
  }
}
