// Cubeburrow world: seeded island terrain (biomes, trees, caves, crystals) + chunk mesher with merged, culled faces,
// per-vertex ambient occlusion and warm lamp light. Pure JS (no three.js) so it can be tested in node.
export const CS = 16, NC = 7, W = CS * NC, H = 48, SEA = 13;
export const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, SAND = 4, SNOW = 5, LOG = 6, LEAVES = 7, PLANKS = 8, GLASS = 9, BRICK = 10,
  COBBLE = 11, LAMP = 12, WATER = 13, CRYSTAL = 14, CLAY = 15, CACTUS = 16, BEDROCK = 17, SNOWG = 18, SKY = 19, SUNT = 20;

export const BLOCKS = [];
const def = (id, name, t, o = {}) => (BLOCKS[id] = { id, name, top: t[0], bot: t[1] ?? t[0], side: t[2] ?? t[0], hard: 0.35, drop: id, solid: true, kind: 'opaque', glow: 0, col: '#888', ...o });
def(AIR, 'Air', [0], { solid: false, kind: 'air' });
def(GRASS, 'Grass', [0, 2, 1], { hard: 0.3, drop: DIRT, col: '#6cc24a' });
def(DIRT, 'Dirt', [2], { hard: 0.3, col: '#8b5a2b' });
def(STONE, 'Stone', [3], { hard: 0.6, drop: COBBLE, col: '#9a9aa6' });
def(SAND, 'Sand', [4], { hard: 0.25, col: '#f2d98c' });
def(SNOW, 'Snow', [5], { hard: 0.25, col: '#f4f8ff' });
def(LOG, 'Log', [8, 8, 7], { hard: 0.45, col: '#7a4f2a' });
def(LEAVES, 'Leaves', [9], { hard: 0.12, col: '#3f9f45' });
def(PLANKS, 'Planks', [10], { hard: 0.35, col: '#c99a5a' });
def(GLASS, 'Glass', [11], { hard: 0.18, kind: 'glass', col: '#bfe9ff' });
def(BRICK, 'Brick', [12], { hard: 0.5, col: '#c4553f' });
def(COBBLE, 'Cobble', [13], { hard: 0.55, col: '#8a8a94' });
def(LAMP, 'Lamp', [14], { hard: 0.25, glow: 1, col: '#ffd36b' });
def(WATER, 'Water', [15], { hard: Infinity, solid: false, kind: 'water', col: '#3f8ef0' });
def(CRYSTAL, 'Crystal', [16], { hard: 0.7, glow: 1, col: '#6ff2ff' });
def(CLAY, 'Clay', [17], { hard: 0.35, col: '#d9774a' });
def(CACTUS, 'Cactus', [19, 19, 18], { hard: 0.25, col: '#4caf50' });
def(BEDROCK, 'Bedrock', [20], { hard: Infinity, col: '#333' });
def(SNOWG, 'Snowy grass', [5, 2, 6], { hard: 0.3, drop: SNOW, col: '#f4f8ff' });
def(SKY, 'Sky tile', [21], { hard: 0.35, col: '#5fb8ff' });
def(SUNT, 'Sun tile', [22], { hard: 0.35, col: '#ffd23f' });
export const PLACEABLE = [PLANKS, DIRT, COBBLE, BRICK, GLASS, LAMP, SKY, SUNT, CLAY, LOG, LEAVES, SAND, SNOW, CRYSTAL, CACTUS];

// ---------------------------------------------------------------- noise
function hash(x, y, z, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1440662683) ^ Math.imul(s | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; h = Math.imul(h, 2246822519); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
const sm = t => t * t * (3 - 2 * t);
function noise2(x, z, s) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = sm(x - ix), fz = sm(z - iz);
  const a = hash(ix, 0, iz, s), b = hash(ix + 1, 0, iz, s), c = hash(ix, 0, iz + 1, s), d = hash(ix + 1, 0, iz + 1, s);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}
function noise3(x, y, z, s) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = sm(x - ix), fy = sm(y - iy), fz = sm(z - iz);
  const l = (a, b, t) => a + (b - a) * t;
  const p = (dy) => l(l(hash(ix, iy + dy, iz, s), hash(ix + 1, iy + dy, iz, s), fx), l(hash(ix, iy + dy, iz + 1, s), hash(ix + 1, iy + dy, iz + 1, s), fx), fz);
  return l(p(0), p(1), fy);
}
function fbm2(x, z, s, oct = 4) { let v = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { v += noise2(x * f, z * f, s + i * 101) * a; n += a; a *= 0.5; f *= 2; } return v / n; }

// ---------------------------------------------------------------- world
export function createWorld() {
  const vox = new Uint8Array(W * W * H), heights = new Int16Array(W * W), biome = new Uint8Array(W * W);
  const I = (x, y, z) => (y * W + z) * W + x;
  const w = { vox, heights, biome, lamps: new Set(), seed: 1, spawn: [W / 2, 30, W / 2], peak: { x: 0, z: 0, h: 0 }, I };
  w.get = (x, y, z) => {
    if (y < 0) return BEDROCK; if (y >= H) return AIR;
    if (x < 0 || z < 0 || x >= W || z >= W) return y <= SEA ? WATER : AIR;
    return vox[I(x, y, z)];
  };
  w.set = (x, y, z, id) => {
    const i = I(x, y, z), was = vox[i]; vox[i] = id;
    if (was === LAMP) w.lamps.delete(i); if (id === LAMP) w.lamps.add(i);
  };
  w.inside = (x, y, z) => x >= 0 && z >= 0 && x < W && z < W && y >= 0 && y < H;
  w.gen = seed => gen(w, seed);
  w.chunk = (cx, cz) => mesh(w, cx, cz);
  return w;
}

function gen(w, seed) {
  const { vox, heights, biome, I } = w; vox.fill(0); w.lamps.clear(); w.seed = seed;
  const s = seed % 100000;
  let peak = { x: W / 2, z: W / 2, h: 0 };
  for (let z = 0; z < W; z++) for (let x = 0; x < W; x++) {
    const d = Math.hypot(x - W / 2 + 0.5, z - W / 2 + 0.5) / (W / 2);
    const fall = d < 0.62 ? 0 : Math.pow((d - 0.62) / 0.38, 1.5) * 18;
    const e = fbm2(x / 34, z / 34, s, 4);
    const r = 1 - Math.abs(noise2(x / 26, z / 26, s + 7) * 2 - 1), mt = fbm2(x / 50, z / 50, s + 3, 2);
    let h = 7 + e * 16 + Math.pow(r, 3) * Math.max(0, mt - 0.35) * 46 - fall;
    h = Math.max(2, Math.min(H - 8, Math.round(h)));
    const temp = fbm2(x / 30, z / 30, s + 11, 2), moist = fbm2(x / 24, z / 24, s + 19, 2);
    let b = 0;                                                        // 0 meadow, 1 forest, 2 desert, 3 snow
    if (h >= 29 || temp < 0.38) b = 3; else if (temp > 0.58 && moist < 0.52) b = 2; else if (moist > 0.53) b = 1;
    const beach = h <= SEA + 1 && b !== 3;
    heights[z * W + x] = h; biome[z * W + x] = b;
    if (h > peak.h && d < 0.8) peak = { x, z, h };
    for (let y = 0; y <= Math.max(h, SEA); y++) {
      let id;
      if (y === 0) id = BEDROCK;
      else if (y > h) id = WATER;
      else if (y < h - 3) id = STONE;
      else if (beach || b === 2) id = y >= h - 3 ? SAND : STONE;
      else if (y < h) id = DIRT;
      else id = b === 3 ? (h > 34 ? STONE : SNOWG) : (h < SEA ? DIRT : GRASS);
      if (b === 3 && y === h && h > 34) id = SNOWG;
      vox[I(x, y, z)] = id;
    }
  }
  // caves: worm tunnels + a few caverns, with crystals on the walls
  for (let z = 1; z < W - 1; z++) for (let x = 1; x < W - 1; x++) {
    const h = heights[z * W + x], mouth = noise2(x / 9, z / 9, s + 71) > 0.72;
    const top = Math.min(h - (mouth ? 0 : 4), H - 2);
    for (let y = 2; y <= top; y++) {
      const a = noise3(x / 13, y / 8, z / 13, s + 31), c = noise3(x / 13, y / 8, z / 13, s + 47);
      let cave = Math.abs(a - 0.5) < 0.05 && Math.abs(c - 0.5) < 0.07;
      if (!cave && y < h - 5) cave = noise3(x / 10, y / 6, z / 10, s + 53) > 0.74;
      if (cave) {
        const i = I(x, y, z); if (vox[i] === WATER) continue;
        if (y > SEA - 1 || !nearWater(w, x, y, z)) vox[i] = AIR;
      }
    }
  }
  for (let z = 1; z < W - 1; z++) for (let x = 1; x < W - 1; x++) {
    const h = heights[z * W + x];
    for (let y = 1; y < h - 1; y++) {
      const i = I(x, y, z); if (vox[i] !== STONE) continue;
      const open = vox[i + 1] === AIR || vox[i - 1] === AIR || vox[i + W] === AIR || vox[i - W] === AIR || vox[i + W * W] === AIR || vox[i - W * W] === AIR;
      const r = hash(x, y, z, s + 91);
      if ((open && r < 0.05) || r < 0.003) vox[i] = CRYSTAL;
    }
  }
  // trees and cacti
  for (let z = 3; z < W - 3; z++) for (let x = 3; x < W - 3; x++) {
    const h = heights[z * W + x], b = biome[z * W + x], top = vox[I(x, h, z)], r = hash(x, 5, z, s + 13);
    if (h + 8 >= H || h <= SEA) continue;
    if (b === 2 && top === SAND && r < 0.012) { const t = 2 + (r * 1000 | 0) % 2; for (let k = 1; k <= t; k++) vox[I(x, h + k, z)] = CACTUS; continue; }
    if (top !== GRASS && top !== SNOWG) continue;
    const dens = b === 1 ? 0.045 : b === 3 ? 0.018 : 0.008;
    if (r >= dens) continue;
    if (b === 3) {                                                     // pointy snow pine
      const t = 5 + (r * 997 | 0) % 2;
      for (let k = 1; k <= t; k++) vox[I(x, h + k, z)] = LOG;
      const rad = [2, 2, 1, 1, 0, 0];
      for (let k = 0; k < 6; k++) { const y = h + 2 + k, R = rad[k]; for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) { if (Math.abs(dx) + Math.abs(dz) > R + (R > 1 ? 1 : 0)) continue; const j = I(x + dx, y, z + dz); if (y < H && vox[j] === AIR) vox[j] = LEAVES; } }
      if (h + 8 < H) vox[I(x, h + 8, z)] = LEAVES;
    } else {
      const t = 4 + (r * 997 | 0) % 2;
      for (let k = 1; k <= t; k++) vox[I(x, h + k, z)] = LOG;
      for (let dy = -2; dy <= 1; dy++) { const R = dy >= 0 ? 1 : 2; for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
        if (R === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2 && hash(x + dx, dy, z + dz, s) < 0.6) continue;
        const y = h + t + dy, j = I(x + dx, y, z + dz); if (y < H && vox[j] === AIR) vox[j] = LEAVES; } }
      vox[I(x, h + t + 2, z)] = LEAVES;
    }
  }
  w.peak = peak;
  // spawn: nearest dry grass column to the middle
  let best = null;
  for (let rr = 0; rr < W / 2 && !best; rr++) for (let dz = -rr; dz <= rr && !best; dz++) for (let dx = -rr; dx <= rr; dx++) {
    const x = W / 2 + dx, z = W / 2 + dz, h = heights[z * W + x];
    if (h > SEA + 1 && h < 28 && vox[I(x, h + 1, z)] === AIR && vox[I(x, h + 2, z)] === AIR && vox[I(x, h, z)] !== WATER) { best = [x + 0.5, h + 1, z + 0.5]; break; }
  }
  w.spawn = best || [W / 2, 34, W / 2];
}
function nearWater(w, x, y, z) { const v = w.vox, I = w.I; return v[I(x + 1, y, z)] === WATER || v[I(x - 1, y, z)] === WATER || v[I(x, y, z + 1)] === WATER || v[I(x, y, z - 1)] === WATER || (y + 1 < H && v[I(x, y + 1, z)] === WATER); }

// ---------------------------------------------------------------- mesher
// face table: normal n, in-plane axes u,v (u×v = n), base corner
const FACES = [
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0], b: [1, 0, 1], s: 0.8, k: 'side' },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], b: [0, 0, 0], s: 0.8, k: 'side' },
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1], b: [0, 1, 1], s: 1.0, k: 'top' },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], b: [0, 0, 0], s: 0.5, k: 'bot' },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], b: [0, 0, 1], s: 0.9, k: 'side' },
  { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0], b: [1, 0, 0], s: 0.68, k: 'side' },
];
const AO = [0.42, 0.62, 0.82, 1];
export const tileUV = t => { const cx = t % 8, cy = Math.floor(t / 8), e = 0.0006; return [cx / 8 + e, 1 - (cy + 1) / 4 + e, (cx + 1) / 8 - e, 1 - cy / 4 - e]; };
const occ = id => id !== AIR && id !== WATER && id !== GLASS;
function newBuf() { return { pos: [], uv: [], sh: [], li: [], idx: [], n: 0 }; }
function quad(B, x, y, z, f, tile, shades, lights, yTop = 1) {
  const [u0, v0, u1, v1] = tileUV(tile), { u, v, b } = f, n = B.n;
  for (let c = 0; c < 4; c++) {
    const a = c === 1 || c === 2 ? 1 : 0, bb = c >= 2 ? 1 : 0;
    let px = x + b[0] + u[0] * a + v[0] * bb, py = y + b[1] + u[1] * a + v[1] * bb, pz = z + b[2] + u[2] * a + v[2] * bb;
    if (py > y + 0.5 && yTop !== 1) py = y + yTop;
    B.pos.push(px, py, pz); B.uv.push(a ? u1 : u0, bb ? v1 : v0); B.sh.push(shades[c]); B.li.push(lights[c]);
  }
  if (shades[0] + shades[2] < shades[1] + shades[3]) B.idx.push(n + 1, n + 2, n + 3, n + 1, n + 3, n); else B.idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
  B.n += 4;
}
function finish(B) {
  return { pos: new Float32Array(B.pos), uv: new Float32Array(B.uv), sh: new Float32Array(B.sh), li: new Float32Array(B.li), idx: B.n > 16000 ? new Uint32Array(B.idx) : new Uint16Array(B.idx), n: B.n };
}
function mesh(w, cx, cz) {
  const O = newBuf(), Wt = newBuf(), get = w.get, x0 = cx * CS, z0 = cz * CS;
  const lamps = []; for (const i of w.lamps) { const x = i % W, z = Math.floor(i / W) % W, y = Math.floor(i / (W * W)); if (x > x0 - 9 && x < x0 + CS + 9 && z > z0 - 9 && z < z0 + CS + 9) lamps.push([x + 0.5, y + 0.5, z + 0.5]); }
  const sh = [0, 0, 0, 0], li = [0, 0, 0, 0];
  for (let y = 0; y < H; y++) for (let z = z0; z < z0 + CS; z++) for (let x = x0; x < x0 + CS; x++) {
    const id = w.vox[w.I(x, y, z)]; if (id === AIR) continue;
    const B = BLOCKS[id], water = id === WATER, glass = id === GLASS;
    for (const f of FACES) {
      const nx = x + f.n[0], ny = y + f.n[1], nz = z + f.n[2], nb = get(nx, ny, nz);
      if (water) { if (nb !== AIR && nb !== GLASS) continue; }
      else if (glass) { if (nb !== AIR && nb !== WATER) continue; }
      else if (nb !== AIR && nb !== WATER && nb !== GLASS) continue;
      if (water && f.n[1] === -1) continue;
      const tile = f.k === 'top' ? B.top : f.k === 'bot' ? B.bot : B.side;
      for (let c = 0; c < 4; c++) {
        const a = c === 1 || c === 2 ? 1 : 0, bb = c >= 2 ? 1 : 0;
        const du = a ? 1 : -1, dv = bb ? 1 : -1;
        const s1 = occ(get(nx + f.u[0] * du, ny + f.u[1] * du, nz + f.u[2] * du)) ? 1 : 0;
        const s2 = occ(get(nx + f.v[0] * dv, ny + f.v[1] * dv, nz + f.v[2] * dv)) ? 1 : 0;
        const cc = occ(get(nx + f.u[0] * du + f.v[0] * dv, ny + f.u[1] * du + f.v[1] * dv, nz + f.u[2] * du + f.v[2] * dv)) ? 1 : 0;
        const ao = water ? 3 : s1 && s2 ? 0 : 3 - s1 - s2 - cc;
        sh[c] = AO[ao] * f.s;
        if (B.glow) li[c] = 2;
        else if (lamps.length) {
          const px = x + f.b[0] + f.u[0] * a + f.v[0] * bb + f.n[0] * 0.3, py = y + f.b[1] + f.u[1] * a + f.v[1] * bb + f.n[1] * 0.3, pz = z + f.b[2] + f.u[2] * a + f.v[2] * bb + f.n[2] * 0.3;
          let L = 0; for (const p of lamps) { const d = Math.hypot(px - p[0], py - p[1], pz - p[2]); if (d < 8) L = Math.max(L, 1 - d / 8); }
          li[c] = L;
        } else li[c] = 0;
      }
      const yTop = water && get(x, y + 1, z) !== WATER ? 0.88 : 1;
      quad(water ? Wt : O, x, y, z, f, tile, sh, li, yTop);
    }
  }
  return { o: finish(O), w: finish(Wt) };
}
/** a lone block (for the held-block view model) */
export function blockMesh(id) {
  const O = newBuf(), B = BLOCKS[id];
  for (const f of FACES) { const s = f.s; quad(O, -0.5, -0.5, -0.5, f, f.k === 'top' ? B.top : f.k === 'bot' ? B.bot : B.side, [s, s, s, s], B.glow ? [2, 2, 2, 2] : [0, 0, 0, 0]); }
  return finish(O);
}
