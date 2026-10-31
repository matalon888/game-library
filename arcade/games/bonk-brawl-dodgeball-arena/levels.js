// Bonk Brawl v2 — 30 hand-made arenas in 3 worlds + outfits. Original content.
// Rival codes: g grunt · d dodger (sidesteps your throw) · t tank (2 hits) · s shield (front blocked, drops after it throws)
// · f sprinter · c curver (curved throws) · B boss (see BOSS).  Rival entry: [code, x, z]  (x -2.7..2.7, z -3.0..-6.0).
// Level fields: n name · w world 0-2 · why purpose of the level · r rivals · iv seconds between a rival's throws (before flow k)
// · bs ball speed · pil pillars [x, z, radius] · cv conveyors [z0, z1, push x] · gold [x,z] golden ball on the floor
// · heart [x,z] a heart that drops in after 6 s · balls loose balls at the start (default 1) · hearts (default 3)
// · soft rival aims wide on purpose (level 1: can't be lost) · wc how many rivals may wind up at once (default 1)
// · trick the 3rd star: bank (a KO off the glass) · catch (catch a ball) · fast (clear in par s) · flawless (no hit)
//   combo (2 KOs within 3 s) · pierce (2 KOs with one golden ball) · dodge (3 close calls)  · par seconds for fast.
export const WORLDS = [
  { name: 'REC CENTER', icon: '🏀', col: '#5aa0ff' },
  { name: 'NEON RINK', icon: '💜', col: '#c06bff' },
  { name: 'SKY DOME', icon: '☁️', col: '#2ec4b6' },
];
export const BOSS = {
  10: { hp: 6, volley: 2, shield: 0, curve: 0, name: 'COACH WHISTLE' },
  20: { hp: 8, volley: 3, shield: 1, curve: 1, name: 'CAPTAIN CURVE' },
  30: { hp: 10, volley: 3, shield: 1, curve: 1, name: 'KING BONK', minions: 1 },
};
export const TRICK = {
  bank: ['BANK SHOT', 'KO off the glass', '🔶'], catch: ['CATCH', 'catch a throw', '🧤'], fast: ['SPEED', 'clear fast', '⚡'],
  flawless: ['FLAWLESS', 'no hits', '💎'], combo: ['COMBO', '2 KOs in 3 s', '🔥'], pierce: ['PIERCE', '2 KOs, 1 gold ball', '🌟'], dodge: ['CLOSE CALLS', '3 near misses', '💨'],
};
const P = (x, z, r = 0.55) => [x, z, r];
export const LEVELS = [
  // ---- world 1: Rec Center — run, grab, throw, read the ring
  { n: 'First Bonk', w: 0, why: 'one slow rival; grab the ball, let go, bonk. Cannot be lost', r: [['g', 0, -4.4]], iv: 5, bs: 6, soft: 1, trick: 'fast', par: 25 },
  { n: 'Two Is Company', w: 0, why: 'two rivals; first ring to step out of', r: [['g', -1.7, -4.2], ['g', 1.7, -4.8]], iv: 4, bs: 7.5, trick: 'flawless' },
  { n: 'Watch The Ring', w: 0, why: 'first level you can lose: leave the red ring before the ball lands', r: [['g', -1.9, -4.4], ['g', 0, -5.4], ['g', 1.9, -4.4]], iv: 3.2, bs: 8.5, trick: 'dodge' },
  { n: 'Sidestep', w: 0, why: 'introduce the dodger: throw while it winds up, not while it runs', r: [['d', 0, -4.6], ['g', 1.9, -4.0]], iv: 3.6, bs: 8.5, trick: 'flawless' },
  { n: 'Heavy Hitter', w: 0, why: 'introduce the tank: two hits', r: [['t', 0, -4.8], ['g', -1.9, -4.0], ['g', 1.9, -4.0]], iv: 3.4, bs: 8.8, trick: 'combo', balls: 2 },
  { n: 'Take Cover', w: 0, why: 'introduce pillars: balls bounce off, you can hide', r: [['g', -1.6, -4.4], ['g', 1.6, -4.4], ['d', 0, -5.6]], iv: 2.9, bs: 9.5, pil: [P(0, 0.2), P(-2.2, -1.6, 0.5)], trick: 'fast', par: 40 },
  { n: 'Crossfire', w: 0, why: 'three throwers at once: pick which to bonk first', r: [['g', -2.2, -4.2], ['d', 0, -5.4], ['g', 2.2, -4.2]], iv: 2.6, bs: 9.8, wc: 2, trick: 'flawless' },
  { n: 'Heart Break', w: 0, why: 'first heart pickup; a tank and a dodger to pay for it', r: [['t', 1.4, -4.6], ['d', -1.6, -4.2], ['g', 0, -5.6]], iv: 2.8, bs: 9.8, heart: [-1.5, 3.2], trick: 'combo' },
  { n: 'Double Trouble', w: 0, why: 'twin tanks behind pillars: test of patience', r: [['t', -1.7, -4.6], ['t', 1.7, -4.6], ['g', 0, -5.6]], iv: 2.6, bs: 10, pil: [P(-1.2, -0.5), P(1.2, -0.5)], balls: 2, trick: 'flawless' },
  { n: 'Coach Whistle', w: 0, why: 'BOSS: two-ball volleys; every hit makes him angrier', r: [['B', 0, -5]], iv: 3.4, bs: 9, pil: [P(-2.1, 1.2, 0.5), P(2.1, 1.2, 0.5)], heart: [0, 3.8], balls: 2, trick: 'flawless' },
  // ---- world 2: Neon Rink — shields, banks, curves, catches
  { n: 'Shield Up', w: 1, why: 'introduce the shield: hit when it drops after a throw', r: [['s', 0, -4.8]], iv: 3.2, bs: 9, trick: 'fast', par: 35 },
  { n: 'Bank On It', w: 1, why: 'a pillar hides the shield: the throw banks off the glass by itself', r: [['s', 0, -4.8], ['g', 2, -4.2]], iv: 3.2, bs: 9.5, pil: [P(0, -2.6, 0.9)], trick: 'bank' },
  { n: 'Curveball', w: 1, why: 'introduce curvers: the ring marks where the ball lands, not how it gets there', r: [['c', -1.6, -4.4], ['c', 1.6, -4.8]], iv: 3.2, bs: 9.5, trick: 'dodge' },
  { n: 'Catch!', w: 1, why: 'introduce the catch: tap just before a ball hits you', r: [['g', -1.8, -4.4], ['c', 0, -5.2], ['g', 1.8, -4.4]], iv: 2.4, bs: 8.8, trick: 'catch', balls: 0 },
  { n: 'Speedy', w: 1, why: 'introduce sprinters: hard to lead, fast to wind up', r: [['f', -1.5, -4.2], ['f', 1.5, -4.8]], iv: 2.8, bs: 10, trick: 'combo' },
  { n: 'Gold Rush', w: 1, why: 'a golden ball pierces everything in a line', r: [['g', 0, -3.6], ['t', 0, -4.8], ['g', 0, -6.0]], iv: 3, bs: 9.5, gold: [0, 2.5], trick: 'pierce', balls: 1 },
  { n: 'Wallflowers', w: 1, why: 'two shields and two pillars: bank or wait for the drop', r: [['s', -1.8, -4.6], ['s', 1.8, -4.6]], iv: 2.8, bs: 10, pil: [P(-1.8, -1.6, 0.8), P(1.8, -1.6, 0.8)], trick: 'bank' },
  { n: 'Mixed Bag', w: 1, why: 'curver, dodger and shield together: read each one', r: [['c', -2, -4.2], ['d', 0, -5.4], ['s', 2, -4.2]], iv: 2.6, bs: 10, wc: 2, heart: [0, 3.5], trick: 'flawless' },
  { n: 'Pillar Maze', w: 1, why: 'four rivals, three pillars: find the safe lane', r: [['d', -2, -4.2], ['c', 2, -4.2], ['t', 0, -5.2], ['g', 0, -3.4]], iv: 2.4, bs: 10.5, pil: [P(-1.4, -0.4), P(1.4, -0.4), P(0, 1.8, 0.5)], wc: 2, trick: 'fast', par: 55 },
  { n: 'Captain Curve', w: 1, why: 'BOSS: three curving balls, shield between volleys', r: [['B', 0, -5]], iv: 3.4, bs: 9.5, pil: [P(-1.8, 0.4, 0.55), P(1.8, 0.4, 0.55)], heart: [0, 3.8], gold: [0, 2.6], balls: 2, trick: 'bank' },
  // ---- world 3: Sky Dome — conveyor belts, crowds, pressure
  { n: 'Belt Up', w: 2, why: 'introduce the conveyor: it carries you, plan your lane', r: [['g', -1.8, -4.4], ['g', 1.8, -4.4], ['d', 0, -5.4]], iv: 2.8, bs: 10, cv: [[0.6, 2.8, 2.2]], trick: 'fast', par: 40 },
  { n: 'Against The Flow', w: 2, why: 'two belts in opposite directions with a shield and a tank', r: [['s', -1.6, -4.4], ['t', 1.6, -4.8]], iv: 2.6, bs: 10.5, cv: [[-0.4, 1.4, -2.6], [1.8, 3.6, 2.6]], trick: 'bank' },
  { n: 'Twin Belts', w: 2, why: 'a belt toward the wall, curvers on the far side', r: [['c', -2, -4.2], ['c', 2, -4.2], ['g', 0, -5.4]], iv: 2.4, bs: 10.5, cv: [[0.2, 2.4, 3]], pil: [P(0, -1.4, 0.5)], trick: 'dodge' },
  { n: 'Big Team', w: 2, why: 'five rivals: pick them off one at a time', r: [['g', -2.4, -4], ['d', -1.2, -5.2], ['t', 0, -4.2], ['d', 1.2, -5.2], ['g', 2.4, -4]], iv: 2.6, bs: 10.5, wc: 2, heart: [0, 3.6], trick: 'combo', balls: 2 },
  { n: 'Gold Belt', w: 2, why: 'gold ball and a belt: line up the pierce while the floor moves you', r: [['s', -1.5, -3.7], ['g', -1.5, -5], ['t', 1.5, -4.4]], iv: 2.8, bs: 10.5, cv: [[1, 3, -2.2]], gold: [0, 3], trick: 'pierce' },
  { n: 'Fortress', w: 2, why: 'three shields behind pillars: bank shots or perfect timing', r: [['s', -2, -4.2], ['s', 0, -5.4], ['s', 2, -4.2]], iv: 2.6, bs: 10.5, pil: [P(-1.1, -1.8, 0.7), P(1.1, -1.8, 0.7)], wc: 2, trick: 'bank' },
  { n: 'Speed Demons', w: 2, why: 'sprinters and curvers: nowhere to stand still', r: [['f', -2, -4.2], ['f', 2, -4.2], ['c', 0, -5.4], ['c', 0, -3.6]], iv: 2.2, bs: 11, wc: 2, heart: [0, 3.5], trick: 'flawless' },
  { n: 'Everything Bagel', w: 2, why: 'every rival type, belts and pillars', r: [['s', -2.1, -4.3], ['d', 0, -5.6], ['c', 2.1, -4.3], ['t', 0, -3.6], ['f', 1, -5.6]], iv: 2.4, bs: 11, wc: 2, cv: [[1.4, 3.4, 1.8]], pil: [P(-1.2, -0.8), P(1.2, -0.8)], balls: 2, trick: 'fast', par: 75 },
  { n: 'Last Stand', w: 2, why: 'two hearts only, a gold ball and a heart that drops in late', r: [['s', -1.8, -4.4], ['t', 1.8, -4.4], ['c', 0, -5.6], ['d', 0, -3.6]], iv: 2.4, bs: 11, hearts: 2, wc: 2, gold: [0, 3.2], heart: [0, 3.6], pil: [P(0, -0.8, 0.6)], trick: 'combo' },
  { n: 'King Bonk', w: 2, why: 'FINAL BOSS: shield, three-ball volleys, two minions, belts', r: [['B', 0, -5.2], ['g', -2.2, -3.6], ['g', 2.2, -3.6]], iv: 3, bs: 10.5, cv: [[1.4, 3, 1.6]], pil: [P(-1.6, -0.4, 0.55), P(1.6, -0.4, 0.55)], heart: [0, 3.8], gold: [0, 2.6], balls: 2, trick: 'flawless' },
];
// after level 30 (and the daily): arenas built from the same rival types. Pure function of the seed (rng)
export function genLevel(n, R) {
  const k = Math.min(1, (n - 30) / 40), cnt = 3 + Math.floor(R() * 3) + (k > 0.5 ? 1 : 0);
  const codes = ['g', 'd', 't', 's', 'f', 'c'], r = [];
  for (let i = 0; i < cnt; i++) r.push([codes[Math.floor(R() * codes.length)], -2.4 + (4.8 * i) / (cnt - 1) + (R() - 0.5) * 0.5, -3.4 - R() * 2.4]);
  const pil = [], np = Math.floor(R() * 3); for (let i = 0; i < np; i++) pil.push(P((R() - 0.5) * 4, -1.5 + R() * 3, 0.5 + R() * 0.3));
  const cv = R() < 0.4 ? [[0.4 + R() * 1.5, 2.6 + R() * 1, (R() < 0.5 ? -1 : 1) * (1.6 + R())]] : [];
  const tricks = ['flawless', 'combo', 'dodge', 'bank', 'fast'];
  return { n: 'Arena ' + n, w: 2, why: 'generated', r, iv: 2.7 - k * 0.5, bs: 10 + k * 1.5, pil, cv, wc: cnt > 4 ? 2 : 1, heart: R() < 0.5 ? [0, 3.6] : null, gold: R() < 0.3 ? [0, 3] : null, trick: tricks[Math.floor(R() * tricks.length)], par: 20 + cnt * 12, balls: 1 + Math.floor(R() * 2) };
}
// closet: 12 outfits, unlocked from chests (one per 6 stars). hat: pom crown party prop ears top halo horns sprout cap visor star
export const OUTFITS = [
  { n: 'Teal Pom', c: '#2ec4b6', a: '#ffd23f', hat: 'pom' },
  { n: 'Berry Crown', c: '#ff5d8f', a: '#ffd23f', hat: 'crown' },
  { n: 'Party Pop', c: '#ffd23f', a: '#7b5cff', hat: 'party' },
  { n: 'Prop Pilot', c: '#3a86ff', a: '#ffffff', hat: 'prop' },
  { n: 'Bunny Boy', c: '#ffffff', a: '#ff8fab', hat: 'ears' },
  { n: 'Top Dog', c: '#2b2d42', a: '#ffd23f', hat: 'top' },
  { n: 'Halo Hero', c: '#a66bff', a: '#fff36b', hat: 'halo' },
  { n: 'Little Devil', c: '#ff4b5c', a: '#2b2d42', hat: 'horns' },
  { n: 'Sprout', c: '#52b788', a: '#ffd166', hat: 'sprout' },
  { n: 'Ball Cap', c: '#ff8c42', a: '#3a86ff', hat: 'cap' },
  { n: 'Cool Visor', c: '#00a6fb', a: '#ff5d8f', hat: 'visor' },
  { n: 'Star Power', c: '#7b5cff', a: '#ffd23f', hat: 'star' },
];
