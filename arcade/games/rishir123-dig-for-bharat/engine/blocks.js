/* ============================================================
   Block registry and the procedural texture atlas.

   Sixteen-pixel tiles drawn onto one canvas, sampled with
   NEAREST filtering — the whole look depends on not smoothing
   them. Nothing is downloaded; every texture here is generated.
   ============================================================ */
import * as THREE from "three";
import { t } from "./i18n.js";

export const TILE = 16, ATLAS_COLS = 8, ATLAS_PX = TILE * ATLAS_COLS;

/* tile ids in the atlas */
export const T = {
  grass_top: 0, grass_side: 1, dirt: 2, silt: 3, clay: 4, gravel: 5, sand: 6, stone: 7,
  bedrock: 8, water: 9, log_side: 10, log_top: 11, leaves: 12, brick: 13, ash: 14, salt: 15,
  mudbrick: 16, charcoal: 17, burnt: 18, chips: 19, slag: 20, plaster: 21, laterite: 22, scrub: 23,
  granite: 24, sherd: 25, marker: 26, loam: 27, peat: 28, rubble: 29, silt2: 30, wet: 31
};

/* block ids */
export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, SILT: 3, CLAY: 4, GRAVEL: 5, SAND: 6, STONE: 7, BEDROCK: 8,
  WATER: 9, LOG: 10, LEAVES: 11, BRICK: 12, ASH: 13, SALT: 14, MUDBRICK: 15, CHARCOAL: 16,
  BURNT: 17, CHIPS: 18, SLAG: 19, PLASTER: 20, LATERITE: 21, SCRUB: 22, GRANITE: 23,
  SHERD: 24, LOAM: 25, PEAT: 26, RUBBLE: 27
};

/* name, faces, hardness, opaque, liquid, and the acoustic material —
   what it sounds like under a tool, which is not the same question as
   what it looks like */
const D = (key, top, side, bottom, hard, opts = {}) =>
  ({ key, top, side, bottom, hard, mat: "soil", opaque: opts.liquid ? false : true, ...opts });

export const BLOCKS = [
  null,                                                             // AIR
  D("block.grass",      T.grass_top, T.grass_side, T.dirt, 1, { mat: "soil" }),
  D("block.dirt",            T.dirt,      T.dirt,       T.dirt, 1, { mat: "soil" }),
  D("block.silt",             T.silt,      T.silt,       T.silt, 2, { mat: "soil" }),
  D("block.clay",        T.clay,      T.clay,       T.clay, 3, { mat: "clay" }),
  D("block.gravel",       T.gravel,    T.gravel,     T.gravel, 3, { mat: "gravel" }),
  D("block.sand",       T.sand,      T.sand,       T.sand, 1, { mat: "sand" }),
  D("block.stone",       T.stone,     T.stone,      T.stone, 4, { mat: "stone" }),
  D("block.bedrock",               T.bedrock,   T.bedrock,    T.bedrock, 99, { mat: "stone", unbreakable: true }),
  D("block.water",                 T.water,     T.water,      T.water, 99, { mat: "water", liquid: true, unbreakable: true }),
  D("block.log",        T.log_top,   T.log_side,   T.log_top, 2, { mat: "wood" }),
  D("block.leaves",                T.leaves,    T.leaves,     T.leaves, 1, { mat: "foliage" }),
  D("block.brick",           T.brick,     T.brick,      T.brick, 3, { mat: "brick" }),
  D("block.ash",  T.ash,       T.ash,        T.ash, 1, { mat: "ash" }),
  D("block.salt",            T.salt,      T.salt,       T.salt, 1, { mat: "gravel" }),
  D("block.mudbrick",             T.mudbrick,  T.mudbrick,   T.mudbrick, 2, { mat: "clay" }),
  D("block.charcoal",         T.charcoal,  T.charcoal,   T.charcoal, 1, { mat: "ash" }),
  D("block.burnt",   T.burnt,     T.burnt,      T.burnt, 2, { mat: "clay" }),
  D("block.chips",       T.chips,     T.chips,      T.chips, 2, { mat: "gravel" }),
  D("block.slag",             T.slag,      T.slag,       T.slag, 3, { mat: "metal" }),
  D("block.plaster",          T.plaster,   T.plaster,    T.plaster, 2, { mat: "brick" }),
  D("block.laterite",              T.laterite,  T.laterite,   T.laterite, 3, { mat: "stone" }),
  D("block.scrub",           T.scrub,     T.scrub,      T.scrub, 1, { mat: "foliage" }),
  D("block.granite",               T.granite,   T.granite,    T.granite, 4, { mat: "stone" }),
  D("block.sherd",       T.sherd,     T.sherd,      T.sherd, 1, { mat: "brick" }),
  D("block.loam",             T.loam,      T.loam,       T.loam, 2, { mat: "soil" }),
  D("block.peat",            T.peat,      T.peat,       T.peat, 2, { mat: "soil" }),
  D("block.rubble",          T.rubble,    T.rubble,     T.rubble, 2, { mat: "brick" })
];

export const isSolid = (id) => id !== B.AIR && id !== B.WATER;
/* you walk through scrub, you do not walk into it */
export const isPassable = (id) => id === B.SCRUB;
/* drawn as crossed billboards rather than cubes */
export const isCross = (id) => id === B.SCRUB;
export const isOpaque = (id) => id !== B.AIR && id !== B.WATER && id !== B.LEAVES && id !== B.SCRUB;
export const hardnessOf = (id) => (BLOCKS[id] ? BLOCKS[id].hard : 1);
export const nameOf = (id) => (BLOCKS[id] ? t(BLOCKS[id].key) : "");

/* ---------------------------------------------------------------
   Atlas painting. Each tile is a base colour plus a deterministic
   per-pixel jitter, which is exactly how the originals read: not
   noise for its own sake, but enough variance that a wall of one
   block does not look like a wall of one colour.
   --------------------------------------------------------------- */
function hash(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}
const mix = (a, b, t) => a + (b - a) * t;

function paint(ctx, tile, fn) {
  const ox = (tile % ATLAS_COLS) * TILE, oy = Math.floor(tile / ATLAS_COLS) * TILE;
  const img = ctx.createImageData(TILE, TILE);
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const c = fn(x, y);
      const i = (y * TILE + x) * 4;
      img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = c[3] === undefined ? 255 : c[3];
    }
  ctx.putImageData(img, ox, oy);
}
/* grainy fill: base rgb, amount of light/dark speckle, optional coarse blotches */
function grain(base, amt, seed, blotch = 0) {
  return (x, y) => {
    let n = hash(x, y, seed);
    if (blotch) n = mix(n, hash(Math.floor(x / 4), Math.floor(y / 4), seed + 7), blotch);
    const k = 1 + (n - 0.5) * amt;
    return [Math.min(255, base[0] * k), Math.min(255, base[1] * k), Math.min(255, base[2] * k)];
  };
}

export function buildAtlas() {
  const cv = document.createElement("canvas");
  cv.width = cv.height = ATLAS_PX;
  const ctx = cv.getContext("2d");

  paint(ctx, T.dirt,     grain([134, 106, 74], 0.34, 1, 0.5));
  paint(ctx, T.silt,     grain([146, 138, 118], 0.26, 2, 0.4));
  paint(ctx, T.silt2,    grain([132, 126, 108], 0.26, 22, 0.4));
  paint(ctx, T.clay,     grain([158, 118, 86], 0.22, 3, 0.6));
  paint(ctx, T.gravel,   grain([132, 122, 108], 0.55, 4));
  paint(ctx, T.sand,     grain([206, 184, 138], 0.20, 5, 0.3));
  paint(ctx, T.stone,    grain([124, 118, 108], 0.30, 6, 0.5));
  paint(ctx, T.bedrock,  grain([74, 70, 68], 0.60, 7));
  paint(ctx, T.granite,  grain([158, 142, 130], 0.42, 8, 0.35));
  paint(ctx, T.laterite, grain([158, 84, 52], 0.30, 9, 0.5));
  paint(ctx, T.mudbrick, grain([176, 142, 100], 0.18, 10, 0.6));
  paint(ctx, T.plaster,  grain([206, 196, 172], 0.14, 11, 0.4));
  paint(ctx, T.salt,     grain([222, 218, 206], 0.22, 12, 0.5));
  paint(ctx, T.ash,      grain([84, 78, 74], 0.42, 13, 0.4));
  paint(ctx, T.charcoal, grain([44, 40, 38], 0.55, 14));
  paint(ctx, T.burnt,    grain([142, 84, 58], 0.40, 15, 0.55));
  paint(ctx, T.slag,     grain([70, 66, 66], 0.60, 16, 0.3));
  paint(ctx, T.chips,    grain([186, 176, 160], 0.62, 17));
  paint(ctx, T.loam,     grain([98, 78, 58], 0.32, 18, 0.5));
  paint(ctx, T.peat,     grain([88, 84, 66], 0.34, 19, 0.5));
  paint(ctx, T.rubble,   grain([160, 108, 82], 0.55, 20, 0.3));
  paint(ctx, T.wet,      grain([106, 96, 78], 0.28, 21, 0.5));

  /* grass: dry stubble over dirt, with a fringe on the side face */
  const gt = grain([148, 143, 92], 0.34, 30, 0.5);
  paint(ctx, T.grass_top, gt);
  const dside = grain([134, 106, 74], 0.34, 1, 0.5);
  paint(ctx, T.grass_side, (x, y) => {
    const lip = 3 + Math.floor(hash(x, 0, 31) * 2.6);
    if (y < lip) return gt(x, y + 12);
    if (y === lip) return mix3(gt(x, y), dside(x, y), 0.5);
    return dside(x, y);
  });

  /* fired brick: courses with a mortar line, offset every other row */
  paint(ctx, T.brick, (x, y) => {
    const row = Math.floor(y / 4);
    const off = (row % 2) * 4;
    const mortar = y % 4 === 0 || (x + off) % 8 === 0;
    const base = mortar ? [176, 158, 132] : [162, 84, 58];
    const k = 1 + (hash(x, y, 40) - 0.5) * (mortar ? 0.18 : 0.30);
    return [base[0] * k, base[1] * k, base[2] * k];
  });

  /* pottery scatter: sherds of two fabrics on soil */
  const sbase = grain([128, 102, 72], 0.30, 41, 0.5);
  paint(ctx, T.sherd, (x, y) => {
    const s = hash(Math.floor(x / 3), Math.floor(y / 3), 42);
    if (s > 0.80) return [168, 88, 60];
    if (s > 0.70) return [92, 84, 80];
    return sbase(x, y);
  });

  /* timber */
  paint(ctx, T.log_side, (x, y) => {
    const streak = hash(x, 0, 50);
    const k = 0.82 + streak * 0.34 + (hash(x, y, 51) - 0.5) * 0.14;
    return [96 * k, 68 * k, 44 * k];
  });
  paint(ctx, T.log_top, (x, y) => {
    const d = Math.hypot(x - 7.5, y - 7.5);
    const ring = Math.sin(d * 2.1) * 0.5 + 0.5;
    const k = 0.80 + ring * 0.30 + (hash(x, y, 52) - 0.5) * 0.10;
    return [128 * k, 96 * k, 62 * k];
  });
  /* canopy: dense, with gaps punched so it does not read as a solid cube */
  paint(ctx, T.leaves, (x, y) => {
    const n = hash(x, y, 60), m = hash(Math.floor(x / 2), Math.floor(y / 2), 61);
    if (m > 0.86) return [38, 46, 30];
    const k = 0.68 + n * 0.62;
    return [72 * k, 88 * k, 44 * k];
  });
  /* a tuft, not a cube: transparent above each blade, so the cutout
     material can punch it out */
  paint(ctx, T.scrub, (x, y) => {
    const bh = 3 + Math.floor(hash(x, 0, 70) * 12);
    if (y < TILE - bh) return [0, 0, 0, 0];
    const k = 0.78 + hash(x, y, 71) * 0.45;
    return [116 * k, 112 * k, 60 * k, 255];
  });
  /* water: flat with a faint ripple, drawn translucent */
  paint(ctx, T.water, (x, y) => {
    const w = Math.sin((x + y * 0.6) * 0.9) * 0.5 + 0.5;
    const k = 0.86 + w * 0.22 + (hash(x, y, 80) - 0.5) * 0.08;
    return [54 * k, 104 * k, 128 * k, 205];
  });
  /* a survey marker peg colour, used for the flagged squares */
  paint(ctx, T.marker, (x, y) => {
    const band = Math.floor(y / 4) % 2;
    return band ? [232, 169, 60] : [42, 34, 24];
  });

  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.flipY = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 1;
  return tex;
}
function mix3(a, b, t) { return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)]; }

/* ---------------------------------------------------------------
   Destroy-stage overlay: ten frames of a crack spreading from the
   middle of a face, laid out in a strip. The mesh that draws it
   picks a frame with texture.offset, the way the original does.
   --------------------------------------------------------------- */
export function buildCrackTexture() {
  const N = 10;
  const cv = document.createElement("canvas");
  cv.width = TILE * N; cv.height = TILE;
  const ctx = cv.getContext("2d");
  ctx.clearRect(0, 0, cv.width, cv.height);

  /* grow six branches out from the centre, remembering when each
     pixel appeared so a frame can draw only what has cracked so far */
  const pix = [];
  for (let b = 0; b < 6; b++) {
    let x = 7.5, y = 7.5;
    const a = (b / 6) * Math.PI * 2 + hash(b, 0, 3) * 1.1;
    const dx = Math.cos(a), dy = Math.sin(a);
    for (let i = 0; i < 12; i++) {
      x += dx + (hash(b, i, 7) - 0.5) * 1.1;
      y += dy + (hash(b, i, 11) - 0.5) * 1.1;
      if (x < 0 || y < 0 || x > TILE - 1 || y > TILE - 1) break;
      pix.push({ x: Math.floor(x), y: Math.floor(y), t: i / 12, b });
      if (i > 3 && hash(b, i, 23) > 0.72) {           // a short offshoot
        const sx = Math.floor(x + (hash(b, i, 29) - 0.5) * 3);
        const sy = Math.floor(y + (hash(b, i, 31) - 0.5) * 3);
        if (sx >= 0 && sy >= 0 && sx < TILE && sy < TILE) pix.push({ x: sx, y: sy, t: i / 12, b });
      }
    }
  }

  for (let s = 0; s < N; s++) {
    const cut = (s + 1) / N;
    const img = ctx.createImageData(TILE, TILE);
    for (const p of pix) {
      if (p.t > cut) continue;
      const i = (p.y * TILE + p.x) * 4;
      img.data[i] = 8; img.data[i + 1] = 6; img.data[i + 2] = 4; img.data[i + 3] = 210;
      /* a lighter pixel below each crack reads as depth */
      if (p.y + 1 < TILE) {
        const j = ((p.y + 1) * TILE + p.x) * 4;
        if (img.data[j + 3] === 0) {
          img.data[j] = 190; img.data[j + 1] = 176; img.data[j + 2] = 150; img.data[j + 3] = 70;
        }
      }
    }
    ctx.putImageData(img, s * TILE, 0);
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(1 / N, 1);
  return { texture: tex, frames: N };
}
