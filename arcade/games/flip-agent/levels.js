// Flip Agent v2 — 30 hand-made missions in 3 worlds. Plan and numbers: DESIGN.md.
// A mission is a row of rooftops; each STAGE is one gap + the landing roof with its goons.
//   g: goons, one string per goon: 'slot' or 'slot:k' with k = s (riot shield: only the head is open) | b (boss: 2-3 hits)
//      slots (x from the landing edge a, y on the landing roof T): far 2.2 · far2 3.4 · crate 3.6 (on a crate) ·
//      girder (floating beam over the gap) · below (beam under the gap) · high (beam on the take-off side)
//   h: hostages, [goon index, side] (side +1 = further from the agent) · b: barrels [dx from a] · pl: steel plates [{dx from the far end, h}]
//   dy: landing roof height change · gap: gap width (default 4.6) · hp: boss hits (default 2)
// trick = the third star: spare n bullets left · head n headshots · boom n goons blown up · ric n ricochet kills · multi n goons in one flip
export const WORLDS = [
  { name: 'Rooftop Run', icon: '🏙️', color: '#3a86ff', note: 'goons, hostages, barrels, steel' },
  { name: 'Neon Docks', icon: '🌃', color: '#ff5d8f', note: 'riot shields, chain blasts, tight ammo' },
  { name: 'Skyline Heist', icon: '🏢', color: '#7b5cff', note: 'bosses, long runs, no room to waste' },
];
const S = (g, o = {}) => ({ g, ...o });
export const LEVELS = [
  // ---------------------------------------------------------------- world 1: Rooftop Run
  { n: 'First Flip', p: 'one goon, one tap: cannot be lost', th: 0, trick: { t: 'spare', n: 3 }, st: [S(['far'])] },
  { n: 'Two Roofs', p: 'two flips in a row; learn to wait for green', th: 0, trick: { t: 'head', n: 1 }, st: [S(['far']), S(['far2'], { dy: 0.8 })] },
  { n: 'Spare the Pink One', p: 'introduce hostages: never shoot pink', th: 0, trick: { t: 'spare', n: 3 }, st: [S(['far'], { h: [[0, 1]] }), S(['far', 'far2'], { dy: -0.8 })] },
  { n: 'Eyes Up', p: 'introduce goons on beams in the air', th: 0, trick: { t: 'multi', n: 2 }, st: [S(['girder']), S(['girder', 'far'], { dy: -1 })] },
  { n: 'Light the Fuse', p: 'introduce red barrels: one shot, a blast', th: 0, trick: { t: 'boom', n: 2 }, st: [S(['far'], { b: [1.0] }), S(['far', 'far2'], { b: [0.9], dy: -1 })] },
  { n: 'Under the Bridge', p: 'introduce goons hanging below the gap', th: 3, trick: { t: 'head', n: 2 }, st: [S(['below']), S(['below', 'far'], { dy: 0.8 })] },
  { n: 'Bounce It', p: 'introduce steel plates: bank the bullet', th: 3, trick: { t: 'ric', n: 1 }, st: [S(['far2'], { pl: [{ dx: 2.4, h: 3.2 }] }), S(['far', 'girder'], { dy: 1 })] },
  { n: 'Crate Escort', p: 'crates and a hostage together', th: 3, trick: { t: 'spare', n: 3 }, st: [S(['crate', 'far'], { h: [[0, 1]] }), S(['girder', 'far2'], { h: [[1, 1]], dy: 1 }), S(['far'], { dy: -0.8 })] },
  { n: 'Rooftop Rush', p: 'HARD: four roofs, every element so far', th: 3, hard: 1, trick: { t: 'multi', n: 2 }, st: [S(['far', 'girder'], { h: [[0, 1]] }), S(['below', 'far2'], { b: [1.0], dy: 1 }), S(['girder', 'crate'], { dy: -1.4, h: [[1, 1]] }), S(['far', 'far2', 'girder'], { pl: [{ dx: 1.4, h: 3.4 }] })] },
  { n: 'Fireworks', p: 'breather: barrels everywhere, big blasts', th: 3, trick: { t: 'boom', n: 3 }, st: [S(['far', 'far2'], { b: [1.2] }), S(['far', 'far2', 'girder'], { b: [1.0], dy: -1 }), S(['far', 'far2'], { b: [1.0] })] },
  // ---------------------------------------------------------------- world 2: Neon Docks
  { n: 'Riot Shield', p: 'introduce shields: only the head is open', th: 2, trick: { t: 'head', n: 2 }, st: [S(['far:s']), S(['far:s', 'far2'], { dy: 0.8 })] },
  { n: 'Chain Reaction', p: 'barrels set off barrels', th: 2, trick: { t: 'boom', n: 3 }, st: [S(['far', 'far2'], { b: [0.8, 3.9] }), S(['far', 'girder'], { b: [1.0, 2.6], dy: -1 }), S(['far2'], { b: [1.2] })] },
  { n: 'Hostage Alley', p: 'a barrel beside a hostage: aim away from the blast', th: 2, trick: { t: 'spare', n: 2 }, st: [S(['far', 'far2'], { h: [[1, 1]], b: [0.9] }), S(['crate', 'far'], { h: [[0, 1]], dy: -1 }), S(['girder', 'far2'], { h: [[1, 1]], dy: 0.8 })] },
  { n: 'Shield Wall', p: 'two shields on one roof, then a girder', th: 2, trick: { t: 'multi', n: 2 }, st: [S(['far:s', 'far2:s']), S(['girder', 'far:s'], { dy: 1 }), S(['far:s', 'below'], { dy: -1 })] },
  { n: 'Dockside Dash', p: 'HARD: shields, hostage and a barrel in four hops', th: 2, hard: 1, trick: { t: 'head', n: 3 }, st: [S(['far:s', 'girder'], { h: [[1, 1]] }), S(['crate:s', 'far2'], { b: [0.9], dy: 1 }), S(['below:s', 'far'], { dy: -1.2 }), S(['far:s', 'far2', 'girder'], { h: [[1, 1]], pl: [{ dx: 1.2, h: 3.4 }] })] },
  { n: 'Neon Party', p: 'breather: shields and barrels, huge blasts', th: 1, trick: { t: 'boom', n: 4 }, st: [S(['far:s', 'far2'], { b: [0.7, 3.8] }), S(['far', 'far2:s'], { b: [1.0, 3.6], dy: -1 }), S(['far', 'far2', 'girder'], { b: [1.2] })] },
  { n: 'Steel Rain', p: 'steel plates over the roof: ricochets win', th: 1, trick: { t: 'ric', n: 2 }, st: [S(['far2', 'far'], { pl: [{ dx: 2.4, h: 3.4 }] }), S(['crate:s', 'far2'], { pl: [{ dx: 1.0, h: 3.4 }], dy: 1 }), S(['far', 'girder'], { pl: [{ dx: 1.6, h: 3.4 }], dy: -1.4 })] },
  { n: 'Last Bullets', p: 'tight ammo: every shot has to count', th: 1, slack: 1, trick: { t: 'spare', n: 1 }, st: [S(['far', 'girder']), S(['far:s', 'below'], { dy: 1 }), S(['far', 'far2', 'girder'], { b: [1.0], dy: -1 })] },
  { n: 'Harbour Heights', p: 'big drops and climbs between roofs', th: 1, trick: { t: 'multi', n: 3 }, st: [S(['far', 'girder'], { dy: 1.6 }), S(['far:s', 'far2'], { dy: -2, b: [1.0] }), S(['below', 'far:s', 'girder'], { dy: 1.4, h: [[1, 1]] }), S(['far', 'far2', 'crate'], { dy: -1 })] },
  { n: 'The Big Boss', p: 'HARD: the first boss takes two hits', th: 2, hard: 1, trick: { t: 'head', n: 2 }, st: [S(['far', 'girder']), S(['far:s', 'below']), S(['far2:b', 'far'], { h: [[1, 1]] , dy: 0.8 })] },
  // ---------------------------------------------------------------- world 3: Skyline Heist
  { n: 'Skyline', p: 'breather: a big boss and a barrel to help', th: 0, trick: { t: 'boom', n: 2 }, st: [S(['far', 'far2'], { b: [1.0] }), S(['far:b'], { b: [0.6], dy: -1 }), S(['far', 'far2', 'girder'], { dy: 0.8 })] },
  { n: 'Escort Duty', p: 'boss with a hostage right beside him', th: 0, trick: { t: 'spare', n: 2 }, st: [S(['girder', 'far'], { h: [[1, 1]] }), S(['far:b', 'crate'], { h: [[0, 1]], dy: 1 }), S(['far:s', 'far2'], { dy: -1 })] },
  { n: 'Glass Tower', p: 'shields on beams: head shots over the gap', th: 0, trick: { t: 'head', n: 3 }, st: [S(['far:s', 'girder']), S(['far:s', 'below'], { dy: 1 }), S(['far:s', 'far2:s', 'girder'], { dy: -1.4 })] },
  { n: 'Long Haul', p: 'five roofs: pace your bullets', th: 3, trick: { t: 'spare', n: 2 }, st: [S(['far', 'girder']), S(['far:s', 'far2'], { dy: 1 }), S(['below', 'far'], { b: [1.0], dy: -1 }), S(['far:b'], { dy: 1 }), S(['far', 'far2:s', 'girder'], { dy: -1 })] },
  { n: 'Heist Night', p: 'HARD: shield, boss, hostage and plates', th: 1, hard: 1, trick: { t: 'ric', n: 2 }, st: [S(['far:s', 'girder'], { h: [[1, 1]], pl: [{ dx: 1.6, h: 3.4 }] }), S(['far:b', 'far2'], { dy: 1 }), S(['crate:s', 'below'], { h: [[0, 1]], dy: -1.2 }), S(['far:s', 'far2:s', 'girder'], { b: [1.0], pl: [{ dx: 1.0, h: 3.4 }], dy: 1.2 })] },
  { n: 'Fireworks Finale', p: 'breather: a whole row of barrels', th: 2, trick: { t: 'boom', n: 5 }, st: [S(['far', 'far2', 'girder'], { b: [0.8, 3.9] }), S(['far:s', 'far2', 'crate'], { b: [0.9, 2.6, 4.8], dy: -1 }), S(['far:b', 'far2'], { b: [0.8, 2.4] })] },
  { n: 'Mirror Maze', p: 'steel everywhere: bounce your way in', th: 2, trick: { t: 'ric', n: 3 }, st: [S(['far2:s', 'far'], { pl: [{ dx: 2.6, h: 3.4 }] }), S(['girder', 'below'], { pl: [{ dx: 1.4, h: 3.4 }], dy: 1 }), S(['far:s', 'crate'], { pl: [{ dx: 1.2, h: 3.4 }], dy: -1 }), S(['far:b'], { pl: [{ dx: 2.0, h: 3.4 }], dy: 1 })] },
  { n: 'No Room to Waste', p: 'tight ammo with a boss and shields', th: 3, slack: 1, trick: { t: 'spare', n: 1 }, st: [S(['far:s', 'girder']), S(['far:b'], { dy: 1 }), S(['below', 'far:s', 'girder'], { dy: -1 })] },
  { n: 'Rooftop Gauntlet', p: 'HARD: five roofs, bosses, shields, hostages', th: 1, hard: 1, trick: { t: 'multi', n: 3 }, st: [S(['far:s', 'far2'], { b: [1.0], h: [[1, 1]] }), S(['girder', 'far:s'], { dy: 1.2 }), S(['below', 'far:b'], { h: [[0, 1]], dy: -1.4 }), S(['far', 'far2:s', 'girder'], { b: [0.8], pl: [{ dx: 1.2, h: 3.4 }], dy: 1 }), S(['far:s', 'far2:s', 'crate'], { dy: -1 })] },
  { n: "Mr. Big's Penthouse", p: 'final boss: three hits, shields around him', th: 2, hard: 1, hp: 3, trick: { t: 'head', n: 3 }, st: [S(['far:s', 'girder', 'below']), S(['far:s', 'far2:s', 'girder'], { dy: 1, b: [1.0] }), S(['far:b', 'far2:s'], { dy: -0.8, h: [[0, -1]] })] },
];
export const SUITS = [
  { n: 'Classic', c: '#24242c', tie: '#e8333a', at: 0 }, { n: 'Navy', c: '#1d3a7a', tie: '#ffd23f', at: 3 },
  { n: 'Crimson', c: '#a8202c', tie: '#ffffff', at: 9 }, { n: 'Arctic', c: '#dfe9f2', tie: '#2f7bff', at: 18 },
  { n: 'Jungle', c: '#2f6b3a', tie: '#ffd23f', at: 30 }, { n: 'Neon', c: '#6a2cff', tie: '#3dff7a', at: 45 },
  { n: 'Rose Gold', c: '#d98a7a', tie: '#2b2b33', at: 62 }, { n: 'Gold', c: '#e8b92f', tie: '#16161c', at: 80 },
];
export const worldOf = (lv) => Math.min(2, Math.floor((lv - 1) / 10));
export const goonsOf = (lv) => LEVELS[lv - 1].st.reduce((n, s) => n + s.g.length, 0);
export const hitsOf = (lv) => { const L = LEVELS[lv - 1]; return L.st.reduce((n, s) => n + s.g.reduce((m, g) => m + (g.endsWith(':b') ? (L.hp || 2) : 1), 0), 0); };
export const slackOf = (lv) => LEVELS[lv - 1].slack ?? [3, 2, 2][worldOf(lv)];
export const TRICK_TXT = { spare: n => `${n} bullets to spare`, head: n => n === 1 ? 'a headshot' : `${n} headshots`, boom: n => `${n} goons by blast`, ric: n => n === 1 ? 'a ricochet kill' : `${n} ricochet kills`, multi: n => `${n} goons in one flip` };
