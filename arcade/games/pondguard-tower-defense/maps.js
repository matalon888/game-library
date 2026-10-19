// Pondguard maps (built in code) and the 40-round slime schedule.
export const MAPS = [
  { name: 'Lily Loop', diff: 'Easy', lives: 150, pts: [[-3.2, -9.4], [-3.2, -5.6], [3.2, -5.6], [3.2, -1.6], [-3.2, -1.6], [-3.2, 2.4], [3.2, 2.4], [3.2, 5.9], [0.4, 7.35], [-0.6, 7.45]], pond: [-1.6, 7.6, 1.35] },
  { name: 'Mossy Switchback', diff: 'Medium', lives: 100, pts: [[3.6, -9.4], [3.6, -4.6], [-3.4, -4.6], [-3.4, 0.9], [3.4, 0.9], [3.4, 5.9], [1.0, 7.4], [0.2, 7.45]], pond: [-0.9, 7.6, 1.35] },
  { name: 'Reed Rush', diff: 'Hard', lives: 60, pts: [[0, -9.4], [0, -5.4], [3.3, -3.2], [3.3, -0.2], [-3.3, 1.6], [-3.3, 4.6], [0, 5.8], [0, 6.9]], pond: [0, 7.7, 1.35] },
];
// unlock: a map opens when you reach this round on the previous map
export const UNLOCK = [0, 12, 15];
export const STEP = 0.1;

/** polyline with rounded corners (quadratic arcs), sampled every STEP world units → { x[], z[], a[] (heading), len } */
export function buildPath(pts, r = 1.15) {
  const raw = [];
  const push = (x, z) => raw.push([x, z]);
  push(...pts[0]);
  for (let i = 1; i < pts.length - 1; i++) {
    const [ax, az] = pts[i - 1], [px, pz] = pts[i], [bx, bz] = pts[i + 1];
    const la = Math.hypot(ax - px, az - pz), lb = Math.hypot(bx - px, bz - pz), rr = Math.min(r, la * 0.48, lb * 0.48);
    const p0 = [px + (ax - px) / la * rr, pz + (az - pz) / la * rr], p2 = [px + (bx - px) / lb * rr, pz + (bz - pz) / lb * rr];
    for (let t = 0; t <= 1.0001; t += 0.1) { const u = 1 - t; push(u * u * p0[0] + 2 * u * t * px + t * t * p2[0], u * u * p0[1] + 2 * u * t * pz + t * t * p2[1]); }
  }
  push(...pts[pts.length - 1]);
  // resample evenly
  const x = [], z = [], a = [];
  let carry = 0; x.push(raw[0][0]); z.push(raw[0][1]);
  for (let i = 1; i < raw.length; i++) {
    const [x0, z0] = raw[i - 1], [x1, z1] = raw[i], L = Math.hypot(x1 - x0, z1 - z0); if (L < 1e-6) continue;
    let d = STEP - carry;
    while (d <= L) { x.push(x0 + (x1 - x0) * d / L); z.push(z0 + (z1 - z0) * d / L); d += STEP; }
    carry = L - (d - STEP);
  }
  for (let i = 0; i < x.length; i++) { const j = Math.min(x.length - 1, i + 1), k = Math.max(0, j - 1); a.push(Math.atan2(x[j] - x[k], z[j] - z[k])); }
  return { x, z, a, len: (x.length - 1) * STEP };
}

// slime tiers: 1 red … 5 pink pop layer by layer; 6 purple splits into 2 pinks; 7 rainbow splits into 2 purples
export const TIER_COL = [null, '#ff4d5e', '#3fa7ff', '#4fd16b', '#ffd23f', '#ff7ac8', '#8e5cff', '#ffffff'];
export const TIER_SPD = [0, 1.9, 2.5, 3.0, 3.7, 4.0, 3.0, 3.2];
export const TIER_SIZE = [0, 0.56, 0.6, 0.64, 0.66, 0.68, 0.74, 0.8];
export const rbe = (t) => t <= 5 ? t : t === 6 ? 1 + 2 * 5 : 1 + 2 * 11;
export const BULK_HP = 220, GIANT_HP = 2600, BULK_RBE = BULK_HP + 4 * rbe(7), GIANT_RBE = GIANT_HP + 3 * BULK_RBE;

/** the spawns of round r (1..40): [{ t: seconds after round start, tier, shell, bulk: 0|1|2 }]. `rand` = seeded rng, `k` = flow knob */
export function roundSpawns(r, rand, k = 1) {
  const out = []; let t = 0;
  let budget = (14 + r * 5 + r * r * 0.9 + Math.max(0, r - 24) ** 2 * 2.6) * k;
  const cap = Math.min(7, 1 + Math.floor((r + 2) / 6));
  const dur = 7 + r * 0.4;
  const bulks = r === 40 ? 0 : r >= 24 && (r % 5 === 0 || r >= 33) ? 1 + Math.floor((r - 24) / 6) : 0;
  if (r === 40) { out.push({ t: dur * 0.55, tier: 0, shell: false, bulk: 2 }); budget *= 0.5; }
  for (let i = 0; i < bulks; i++) { out.push({ t: dur * (0.35 + 0.5 * i / Math.max(1, bulks)), tier: 0, shell: false, bulk: 1 }); budget -= BULK_RBE * 0.5; }
  budget = Math.max(budget, 10);
  const groups = [];
  while (budget > 0) {
    const tier = Math.max(1, cap - (rand() < 0.3 ? 1 : 0) - (rand() < 0.12 ? 1 : 0));
    const shell = r >= 17 && tier >= 2 && rand() < 0.22;
    const cost = rbe(tier) + (shell ? 4 : 0);
    const n = Math.max(1, Math.min(Math.ceil(budget / cost), 4 + Math.floor(rand() * 10)));
    groups.push({ tier, shell, n }); budget -= n * cost;
  }
  const total = groups.reduce((s, g) => s + g.n, 0), gap = Math.max(0.09, dur / Math.max(1, total));
  for (const g of groups) { for (let i = 0; i < g.n; i++) { out.push({ t, tier: g.tier, shell: g.shell, bulk: 0 }); t += gap; } t += gap * 2; }
  return out.sort((a, b) => a.t - b.t);
}
