// Dust Descent v2 — 30 authored descents. Each level is a hand-picked run of 40 m trail segments (SEG, drawn by hand below)
// with a purpose line, a rival speed `rv`, and `goal` = the flow chain needed for the third star (with a 1st place).
// items: [type, ds, lat, extra]   b boost pad · k kicker · r rock · l log · m mud (hw,len) · i ice (hw,len) · c coin (h) · p portal
const arc = (ds, lat, n = 5) => Array.from({ length: n }, (_, i) => { const d = 4 + i * 3.4, t = d / 22; return ['c', ds + d, lat, { h: Math.max(1.4, 1.15 + 9.2 * t - 11 * t * t) }]; });
const line = (ds, lat, n = 5, st = 2.2) => Array.from({ length: n }, (_, i) => ['c', ds + i * st, lat]);
const sine = (ds, n = 8, amp = 2.6) => Array.from({ length: n }, (_, i) => ['c', ds + i * 4.2, amp * Math.sin(i * 0.95)]);
const ring = (ds, n = 4) => Array.from({ length: n }, (_, i) => ['c', ds + i * 9, i % 2 ? 2.6 : -2.6, { h: 7.2 }]);
export const SEG = {
  rest: [], pad: [['b', 10, 0]], padL: [['b', 10, -2.6]], padR: [['b', 10, 2.6]],
  weave: [['b', 6, -2.8], ['b', 20, 2.8], ['b', 34, -2.8]],
  kick: [['k', 8, 0], ...arc(8, 0)], kickL: [['k', 8, -2.2], ...arc(8, -2.2)], kickR: [['k', 8, 2.2], ...arc(8, 2.2)],
  twokick: [['k', 4, 0], ...arc(4, 0, 3), ['k', 30, 0], ...arc(30, 0, 3)],
  rockL: [['r', 14, -2]], rockR: [['r', 14, 2]], rockC: [['r', 14, 0]], rocks: [['r', 8, -2.2], ['r', 24, 2.2]],
  logC: [['l', 14, 0]], logL: [['l', 14, -2.6]], logR: [['l', 14, 2.6]],
  slalom: [['r', 6, -2], ['r', 16, 2], ['r', 26, -2], ['r', 36, 2]],
  gate: [['r', 18, -3.6], ['r', 18, 3.6], ...line(8, 0, 6, 2)],
  padGate: [['b', 6, 0], ['r', 22, -3.5], ['r', 22, 3.5]],
  jumpRock: [['k', 6, 0], ...arc(6, 0, 4), ['r', 32, 0]], jumpLog: [['k', 6, 0], ...arc(6, 0, 4), ['l', 33, 0]],
  padRock: [['b', 8, 0.6], ['r', 24, -1.8], ['r', 30, 2.2]],
  coinS: sine(4),
  mudL: [['m', 8, -2.4, { hw: 2.5, len: 4.5 }], ...line(6, 2.2, 4)], mudR: [['m', 8, 2.4, { hw: 2.5, len: 4.5 }], ...line(6, -2.2, 4)],
  mudAll: [['m', 8, 0, { hw: 5, len: 4.5 }], ['b', 24, 0]],
  mudRock: [['m', 6, 0, { hw: 5, len: 3.5 }], ['r', 24, -2.2], ['b', 30, 2.4]],
  mudKick: [['m', 4, 0, { hw: 5, len: 3 }], ['k', 22, 0], ...arc(22, 0, 4)],
  ice: [['i', 8, 0, { hw: 5, len: 5 }], ...line(6, 0, 6, 2.4)],
  iceRock: [['i', 4, 0, { hw: 5, len: 4.5 }], ['r', 22, -2.2], ['r', 32, 2.2]],
  icePad: [['i', 4, 0, { hw: 5, len: 4.5 }], ['b', 8, 2.4], ['b', 22, -2.4]],
  iceSlalom: [['i', 2, 0, { hw: 5, len: 9 }], ['r', 10, -2], ['r', 22, 2], ['b', 34, -2.4]],
  iceKick: [['i', 3, 0, { hw: 5, len: 4 }], ['k', 22, 0], ...arc(22, 0, 4)],
  iceMud: [['i', 3, 0, { hw: 5, len: 4 }], ['m', 22, 0, { hw: 5, len: 3.5 }], ['b', 34, 0]],
  portal: [['p', 8, 0]], glide: ring(4),
  landing: [['b', 8, 0]],
  chainRun: [['b', 6, 0], ['k', 16, 0], ...arc(16, 0, 3), ['b', 36, -2]],
  big: [['k', 4, 0], ...arc(4, 0, 4), ['b', 28, -2.4], ['b', 36, 2.4]],
};
const W1 = 'Red Mesa', W2 = 'Pine Gorge', W3 = 'Frostbite Pass';
export const WORLDS = [{ name: W1, icon: '🏜️' }, { name: W2, icon: '🌲' }, { name: W3, icon: '❄️' }];
// L(world, name, why, goal, rv, segs, extra)
const L = (name, why, goal, rv, segs, o = {}) => ({ name, why, goal, rv, segs, ...o });
export const LEVELS = [
  // ---- World 1: Red Mesa — pads, kickers, rocks, logs, coins, wingsuit
  L('First Run', 'Only pads and kickers: win it, loudly', 4, 0.86, ['pad', 'kick', 'weave', 'kick', 'padL', 'coinS', 'kick', 'pad', 'rest']),
  L('Trick Shot', 'First rock; tap in the air for a trick', 7, 0.90, ['pad', 'kick', 'rockL', 'kick', 'padR', 'rockR', 'kick', 'weave', 'rockC', 'kick', 'pad']),
  L('Log Jam', 'First log and the first lose: dodge or lose time', 7, 0.95, ['pad', 'logC', 'weave', 'kick', 'logL', 'padR', 'rocks', 'kick', 'logR', 'pad', 'kick']),
  L('Gold Rush', 'Coin lines: grab them to keep the flow alive', 9, 0.98, ['kick', 'coinS', 'pad', 'kick', 'coinS', 'weave', 'kick', 'coinS', 'rocks', 'kick', 'pad', 'coinS']),
  L('Zig Zag', 'Slalom: read the line before you steer', 9, 0.98, ['pad', 'slalom', 'padL', 'slalom', 'kick', 'rocks', 'weave', 'slalom', 'kick', 'pad']),
  L('Air Mail', 'Jump then dodge: land ready', 10, 1.02, ['kick', 'jumpRock', 'pad', 'jumpLog', 'weave', 'jumpRock', 'rocks', 'kick', 'jumpLog', 'pad', 'chainRun']),
  L('Bump In', 'Gate gaps: ram rivals from behind for a bump', 9, 1.03, ['padGate', 'gate', 'kick', 'padGate', 'rocks', 'gate', 'weave', 'padGate', 'kick', 'gate', 'pad']),
  L('Wingsuit', 'The portal: glide, grab the ring coins, land it', 6, 1.03, ['pad', 'kick', 'weave', 'portal', 'glide', 'glide', 'rocks', 'padRock', 'kick', 'logC', 'pad', 'kick']),
  L('Mesa Rush', 'Hard: everything so far, no gifts', 12, 1.09, ['padRock', 'slalom', 'kick', 'jumpRock', 'gate', 'logL', 'weave', 'jumpLog', 'slalom', 'padRock', 'kick', 'gate', 'logC', 'pad'], { hard: 1 }),
  L('Kestrel', 'BOSS: the mesa champion rides fast and clean', 10, 1.12, ['pad', 'kick', 'slalom', 'jumpRock', 'portal', 'glide', 'glide', 'gate', 'padRock', 'jumpLog', 'weave', 'slalom', 'kick', 'logC', 'chainRun', 'pad'], { boss: 'KESTREL' }),
  // ---- World 2: Pine Gorge — mud
  L('Mud Hole', 'Mud only: it slows you, steer round or boost out', 3, 0.96, ['pad', 'mudL', 'kick', 'mudR', 'weave', 'mudL', 'pad', 'kick', 'mudR', 'pad']),
  L('Slop Pads', 'Mud with pads inside it: use the boost to escape', 5, 0.99, ['pad', 'mudAll', 'kick', 'mudAll', 'weave', 'mudL', 'mudAll', 'kick', 'mudAll', 'pad', 'kick']),
  L('Rock Mud', 'Mud and rocks: no safe line, pick the cheapest', 4, 1.03, ['mudRock', 'rocks', 'mudL', 'kick', 'mudRock', 'logC', 'mudR', 'padRock', 'mudRock', 'kick', 'pad']),
  L('Pine Glide', 'Wingsuit over the pines, mud on landing', 6, 1.03, ['pad', 'mudL', 'kick', 'portal', 'glide', 'glide', 'mudAll', 'rocks', 'kick', 'mudR', 'weave', 'logC', 'pad']),
  L('Gorge Run', 'Hard: mud, kickers, logs back to back', 12, 1.09, ['mudKick', 'logL', 'mudAll', 'jumpRock', 'mudRock', 'gate', 'mudKick', 'slalom', 'mudAll', 'jumpLog', 'mudRock', 'kick', 'logC'], { hard: 1 }),
  L('Pine Party', 'Breather: pads, big air and coins everywhere', 12, 0.94, ['big', 'coinS', 'twokick', 'weave', 'big', 'coinS', 'twokick', 'chainRun', 'big', 'weave', 'kick', 'coinS', 'chainRun']),
  L('Mud Slide', 'Mud over a jump: kickers launch from the muck', 11, 1.05, ['mudKick', 'mudL', 'mudKick', 'rocks', 'mudRock', 'mudKick', 'logR', 'weave', 'mudKick', 'mudRock', 'pad', 'kick']),
  L('Trick Alley', 'A kicker every 40 m: a trick on each keeps you flying', 12, 1.03, ['twokick', 'rockL', 'twokick', 'twokick', 'logC', 'twokick', 'jumpRock', 'twokick', 'twokick', 'jumpLog', 'twokick', 'chainRun', 'pad']),
  L('Deep Gorge', 'Hard: mud walls, rocks, a wingsuit and a rival pack', 9, 1.11, ['mudRock', 'slalom', 'mudKick', 'portal', 'glide', 'glide', 'mudAll', 'gate', 'logL', 'mudRock', 'jumpLog', 'mudKick', 'slalom', 'mudAll', 'rocks', 'pad'], { hard: 1 }),
  L('Mako', 'BOSS: the gorge champion hates the mud less than you', 10, 1.14, ['kick', 'mudRock', 'jumpRock', 'mudKick', 'gate', 'portal', 'glide', 'glide', 'mudAll', 'slalom', 'jumpLog', 'mudRock', 'padRock', 'mudKick', 'logC', 'chainRun', 'pad'], { boss: 'MAKO' }),
  // ---- World 3: Frostbite Pass — ice
  L('Black Ice', 'Ice only: steer BEFORE the ice, then ride it out', 8, 0.98, ['pad', 'ice', 'kick', 'ice', 'weave', 'ice', 'pad', 'kick', 'ice', 'pad']),
  L('Slick Pads', 'Pads on ice: line up early, one nudge only', 8, 1.01, ['icePad', 'ice', 'kick', 'icePad', 'weave', 'ice', 'icePad', 'kick', 'icePad', 'pad', 'kick']),
  L('Ice Rocks', 'Ice then rocks: commit to a lane before you slide', 8, 1.05, ['iceRock', 'rocks', 'iceRock', 'kick', 'iceRock', 'logC', 'iceRock', 'padRock', 'iceRock', 'kick', 'pad']),
  L('Frozen Mud', 'Ice into mud: the sliding stops hard', 8, 1.07, ['iceMud', 'kick', 'iceMud', 'rocks', 'iceMud', 'weave', 'iceMud', 'iceRock', 'kick', 'iceMud', 'pad']),
  L('Glacier Glide', 'Wingsuit over the glacier, land on a slick', 6, 1.07, ['pad', 'ice', 'kick', 'portal', 'glide', 'glide', 'iceRock', 'icePad', 'kick', 'iceMud', 'weave', 'logC', 'pad']),
  L('Snow Day', 'Breather: pure speed, kickers and a wingsuit for fun', 7, 0.96, ['big', 'coinS', 'twokick', 'weave', 'portal', 'glide', 'glide', 'big', 'twokick', 'coinS', 'chainRun', 'weave', 'chainRun']),
  L('Gauntlet', 'Hard: every hazard in a row, rivals on your wheel', 12, 1.09, ['iceRock', 'slalom', 'mudKick', 'gate', 'iceSlalom', 'jumpRock', 'iceMud', 'logL', 'mudRock', 'jumpLog', 'iceRock', 'gate', 'iceKick', 'slalom'], { hard: 1 }),
  L('Ice Slalom', 'Slalom on a slick: tiny steers, early', 10, 1.09, ['iceSlalom', 'iceRock', 'iceSlalom', 'icePad', 'iceSlalom', 'kick', 'iceSlalom', 'iceRock', 'iceKick', 'iceSlalom', 'pad']),
  L('Whiteout', 'Hard: ice, mud and a glide with no breathers', 10, 1.15, ['iceRock', 'mudKick', 'iceSlalom', 'portal', 'glide', 'glide', 'iceMud', 'gate', 'logL', 'iceRock', 'jumpLog', 'iceKick', 'mudRock', 'iceSlalom', 'slalom', 'pad'], { hard: 1 }),
  L('Rook', 'BOSS: the pass champion. Every trick in the book', 10, 1.17, ['kick', 'iceRock', 'jumpRock', 'mudKick', 'gate', 'portal', 'glide', 'glide', 'iceSlalom', 'mudRock', 'iceMud', 'jumpLog', 'iceKick', 'slalom', 'padRock', 'iceRock', 'chainRun', 'kick', 'pad'], { boss: 'ROOK' }),
];
LEVELS.forEach((l, i) => { l.n = i + 1; l.world = Math.floor(i / 10); });
const SEGKEYS = Object.keys(SEG).filter(k => !['rest', 'portal', 'glide', 'landing'].includes(k));
/** compile a level to absolute items + length */
export function compile(def) {
  const items = [], s0 = 36; let s = s0;
  for (const name of def.segs) { for (const [t, ds, lat, x] of SEG[name]) items.push({ type: t, s: s + ds, lat, ...(x || {}) }); s += 40; }
  return { items, length: s + 60 };
}
/** seeded daily descent from the unlocked segments (same for everyone that day) */
export function daily(dayNo) {
  let seed = (dayNo * 7919 + 13) % 2147483647; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const w = dayNo % 3, pool = SEGKEYS.filter(k => w === 0 ? !/^(mud|ice)/.test(k) : w === 1 ? !/^ice/.test(k) : true);
  const segs = ['pad', 'kick']; let hasPortal = false;
  for (let i = 0; i < 12; i++) {
    if (!hasPortal && i === 5) { segs.push('portal', 'glide', 'glide'); hasPortal = true; continue; }
    segs.push(pool[Math.floor(r() * pool.length)]);
    if (i % 3 === 2) segs.push(['kick', 'pad', 'chainRun'][Math.floor(r() * 3)]);
  }
  segs.push('pad');
  return { n: 0, name: 'Daily Descent', why: 'Same trail for everyone today', goal: 8, rv: 1.07, segs, world: w, seedKey: dayNo };
}
