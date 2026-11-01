// Pose Rush v2 levels. One beat per token, run in order; '+' = close to the previous beat (a cluster: slow-mo chains).
//  kH/kM/kL/kS  kick/punch target at head/chest/belly/shin     kW  swaying target (time it, or drag to follow)
//  gH  high bullet (lean back)     gL  low bullet (hop: feet up)     bL  rolling barrel (hop)
//  sXYZ  shielded thug, one target per letter (H M L S), guard breaks between     BXYZ..  boss: big shielded thug
export const WORLDS = [
  { name: 'Sunny Street', grass: '#6fd25a', road: '#8d93a3', walk: '#e3e6ee', houses: ['#ffd6a5', '#bde0fe', '#ffc8dd', '#fdffb6', '#caffbf', '#e0c3fc'], roofs: ['#3d5a80', '#ef476f', '#2a9d8f', '#7b5cff'], bg: ['#14cfff', '#c4f5ff'], ui: '#ff7a1a', bulletK: 1, startD: 3.6, swayW: 2.4 },
  { name: 'Rooftop Dusk', grass: '#e8a56e', road: '#a8857a', walk: '#f1d9c6', houses: ['#f4a261', '#e76f51', '#ffb4a2', '#e5989b', '#ffcdb2', '#b5838d'], roofs: ['#6d597a', '#355070', '#b56576', '#3d405b'], bg: ['#ff9a5a', '#ffe0b8'], ui: '#e8467c', bulletK: 1.1, startD: 3.4, swayW: 3.0 },
  { name: 'Neon Night', grass: '#2b2f5e', road: '#3b4070', walk: '#59609b', houses: ['#ff3dac', '#00e5ff', '#9d4dff', '#ffe14d', '#3dff9e', '#ff6a3d'], roofs: ['#22223b', '#2d1b69', '#0b1d51', '#40124a'], bg: ['#2a1b6e', '#6a4bd6'], ui: '#00d4ff', bulletK: 1.2, startD: 3.2, swayW: 3.6 },
];
// w = world index, p = purpose, b = beats, boss = boss level
export const LEVELS = [
  // ---- World 1: Sunny Street (1-12)
  { w: 0, p: 'one big win: kick two thugs with one tap each (cannot lose)', b: 'kM kM' },
  { w: 0, p: 'high and low targets: head, then belly', b: 'kH kL kM' },
  { w: 0, p: 'first bullet: tap to lean back', b: 'kM gH kM' },
  { w: 0, p: 'bullet between kicks, keep the rhythm', b: 'kL gH kH kM' },
  { w: 0, p: 'first cluster: two thugs back to back', b: 'kM +kM kH' },
  { w: 0, p: 'first barrel: tap to hop over it', b: 'kM bL kH' },
  { w: 0, p: 'low bullet, then high bullet (hop, lean)', b: 'gL kM gH kL' },
  { w: 0, p: 'first shielded thug: two hits, guard breaks', b: 'sHL kM' },
  { w: 0, p: 'HARD: shield, cluster, bullets', b: 'kM +kL gL gH sMH' },
  { w: 0, p: 'breather: a flashy chain of five', b: 'kH +kM +kH +kM +kH' },
  { w: 0, p: 'barrel, bullets, shield in a row', b: 'bL gH kM sML gL' },
  { w: 0, p: 'BOSS: Big Mike, four-hit guard', b: 'kM gL BMHLM' },
  // ---- World 2: Rooftop Dusk (13-24)
  { w: 1, p: 'swaying target: time your tap', b: 'kW kM' },
  { w: 1, p: 'sway between static targets', b: 'kM kW gH' },
  { w: 1, p: 'two swaying thugs close together', b: 'kW +kW kH' },
  { w: 1, p: 'low bullet, sway, shield', b: 'gL kW sHM' },
  { w: 1, p: 'bullets around a sway', b: 'kW gH kL gL' },
  { w: 1, p: 'shield into sway', b: 'sMH +kW kM' },
  { w: 1, p: 'first bullet pair: lean, then hop', b: 'gH +gL kW kM' },
  { w: 1, p: 'HARD: sway, pair, long shield', b: 'kW gL +gH sHLM kW' },
  { w: 1, p: 'breather: a flashy chain of five', b: 'kM +kM +kM +kH +kH' },
  { w: 1, p: 'barrel into shield into bullet', b: 'bL kW sMHM gH' },
  { w: 1, p: 'swaying cluster and a bullet pair', b: 'kW +kW +kW gH +gL' },
  { w: 1, p: 'BOSS: Rooftop Rita, four-hit guard with sway', b: 'kW gH gL BMHLM' },
  // ---- World 3: Neon Night (25-36)
  { w: 2, p: 'night run: faster bullets, short windows', b: 'kM gH kW gL' },
  { w: 2, p: 'barrel then bullet pair', b: 'bL gH +gL kM' },
  { w: 2, p: 'shield with sway between', b: 'sHM kW +kW gL' },
  { w: 2, p: 'five beats, no pause', b: 'kH gL kW gH sML' },
  { w: 2, p: 'HARD: bullet pairs both ways', b: 'gH +gL kW gL +gH kM' },
  { w: 2, p: 'breather: a flashy chain of six', b: 'kH +kM +kL +kM +kH +kM' },
  { w: 2, p: 'barrels and shield', b: 'bL +bL sHLH kW gH' },
  { w: 2, p: 'swaying cluster, then guard', b: 'kW +kW +kW sMLH gL' },
  { w: 2, p: 'HARD: everything at once', b: 'gL kW +gH sHMLH bL kW' },
  { w: 2, p: 'breather: a flashy chain of seven', b: 'kM +kH +kM +kL +kM +kH +kM' },
  { w: 2, p: 'the long night: nine beats', b: 'kW gH gL kM sHLM bL +gH kW kM' },
  { w: 2, p: 'FINAL BOSS: Shadow Sam, five-hit guard', b: 'gL kW +gH BHMLMH' },
];
export const HT = { H: 1.68, M: 1.3, L: 1.0, S: 0.55 };
export function parse(str) {
  return str.trim().split(/\s+/).map(tk => {
    const close = tk[0] === '+'; if (close) tk = tk.slice(1);
    const t = tk[0], rest = tk.slice(1);
    if (t === 'k') return rest === 'W' ? { t: 'sway', hs: [1.3], close } : { t: 'kick', hs: [HT[rest]], close };
    if (t === 'g') return { t: 'gun', low: rest === 'L', close };
    if (t === 'b') return { t: 'barrel', close };
    if (t === 's') return { t: 'shield', hs: [...rest].map(c => HT[c]), close };
    if (t === 'B') return { t: 'shield', boss: true, hs: [...rest].map(c => HT[c]), close };
    throw new Error('bad token ' + tk);
  });
}
// daily gauntlet: seeded by date, built from tokens every player has met in worlds 1-2
export function dailyBeats(seed) {
  let s = seed % 2147483647 || 1; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const pool = ['kH', 'kM', 'kL', 'kW', 'kS', 'gH', 'gL', 'bL', 'sHL', 'sML', 'sHMH', '+kM', '+kW', '+gL', '+gH'];
  const out = []; const n = 7 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) { let tk = pool[Math.floor(r() * pool.length)]; if (i === 0 && tk[0] === '+') tk = tk.slice(1); out.push(tk); }
  return out.join(' ');
}
