// levels.js — Fling Feud deep v2: 36 hand-made duels in 3 worlds (+ a seeded generator for the Daily Duel and bonus brawls).
// Fields: n name · foe cast index 1-5 (rosa, valka, bolt-9, dusty, maestro) · hp rival hit points · d arena width · amp/dy/seed hills ·
// wind push (+ right, - left) · wall {fx,h} · bal {fx,h} balloon (x1.5 damage when your throw passes it) · shield (body hits clang) ·
// slots rival steps through these x offsets after each of its throws · volley rival throws twice (weaker) · err aim error (rad) ·
// fdmg rival damage x · par throws for 3 stars (QA checks it is par = fewest head-hit throws + 1) · hard red frame · why purpose.
import { rngOf, makeCtx, bestShot, WEAPONS, damage } from './sim.js';
export const WORLDS = [
  { name: 'Sunset Yard', theme: 0, tag: 'hills, fences, balloons' },
  { name: 'Neon Docks', theme: 1, tag: 'wind and shields' },
  { name: 'Midnight Peaks', theme: 2, tag: 'everything, higher' },
];
const L = (n, foe, hp, d, o) => { const v = { n, foe, hp, d, amp: 0.5, dy: 0, wind: 0, wall: null, bal: null, shield: false, slots: null, volley: 1, err: 0.2, fdmg: 0.5, hard: false, why: '', ...o }; v.par = parMin(hp) + 1; return v; };
export const LEVELS = [
  // ---- World 1: Sunset Yard (core duel, hills, fences, balloons)
  L('Warm-up', 1, 50, 14, { seed: 11, amp: 0.3, err: 0.5, fdmg: 0.2, why: 'introduce the throw: one headshot wins, tap anywhere to throw' }),
  L('Two Taps', 1, 75, 15, { seed: 12, amp: 0.4, err: 0.4, fdmg: 0.25, why: 'first decision: body, body or one clean head' }),
  L('Spar', 2, 100, 17, { seed: 13, amp: 0.6, dy: 0.5, err: 0.22, fdmg: 0.5, why: 'first level you can lose: drag back to set power and angle' }),
  L('Shuffle', 1, 100, 17, { seed: 14, slots: [0, -2, 1.5], err: 0.32, fdmg: 0.3, why: 'introduce the rival stepping: your last shot is no longer right' }),
  L('The Fence', 2, 100, 18, { seed: 15, wall: { fx: 0.5, h: 3.6 }, err: 0.3, fdmg: 0.35, why: 'introduce walls: a flat throw hits the fence, lob it' }),
  L('Tall Fence', 3, 110, 19, { seed: 16, wall: { fx: 0.5, h: 5.5 }, err: 0.28, fdmg: 0.35, why: 'practise lobbing over a taller wall' }),
  L('Pop It!', 1, 100, 17, { seed: 17, bal: { fx: 0.5, h: 4.2 }, why: 'introduce balloons: fly through it for x1.5 damage' }),
  L('Fence & Balloon', 4, 125, 19, { seed: 18, wall: { fx: 0.35, h: 3.8 }, bal: { fx: 0.62, h: 5.6 }, why: 'twist: the lob that clears the fence can also pop the balloon' }),
  L("Rosa's Kitchen", 1, 160, 20, { seed: 19, slots: [0, -2.5, 2], wall: { fx: 0.5, h: 4 }, bal: { fx: 0.7, h: 5 }, err: 0.12, fdmg: 0.7, hard: true, why: 'HARD: stepping rival, fence and balloon together' }),
  L('Hill Party', 5, 90, 16, { seed: 20, amp: 1.2, err: 0.3, fdmg: 0.3, why: 'breather: easy and bouncy after the hard one' }),
  L('Combo Rush', 3, 175, 18, { seed: 21, err: 0.18, fdmg: 0.55, why: 'combos: hits in a row add up to +50% damage, a miss resets it' }),
  L("Valka's Hill", 2, 190, 22, { seed: 22, dy: 3, amp: 1.4, slots: [0, 2, -1.5], bal: { fx: 0.55, h: 5.5 }, err: 0.1, fdmg: 0.75, hard: true, why: 'HARD: uphill duel on a moving rival, balloon on the arc' }),
  // ---- World 2: Neon Docks (wind, shields, volleys)
  L('Breeze', 3, 100, 18, { seed: 31, wind: 0.5, why: 'introduce wind: read the flag, aim into it' }),
  L('Headwind', 4, 110, 20, { seed: 32, wind: -1.0, amp: 0.7, why: 'practise: the wind pushes the other way now' }),
  L('Tailwind Lob', 5, 120, 21, { seed: 33, wind: 1.4, wall: { fx: 0.5, h: 4.5 }, why: 'twist: lob a wall with the wind behind you' }),
  L('Gale', 3, 160, 22, { seed: 34, wind: -1.8, slots: [0, -2, 2], err: 0.11, fdmg: 0.75, hard: true, why: 'HARD: strong headwind on a rival who keeps stepping' }),
  L('Shield Up', 2, 120, 17, { seed: 35, shield: true, why: 'introduce shields: body hits clang, aim for the head' }),
  L('Shield & Breeze', 1, 130, 19, { seed: 36, shield: true, wind: 0.8, fdmg: 0.55, why: 'practise: headshots in a crosswind' }),
  L('Moving Shield', 4, 140, 20, { seed: 37, shield: true, slots: [0, -2, 2], wind: -0.6, fdmg: 0.55, why: 'twist: a shielded rival that keeps stepping' }),
  L('Dock Party', 5, 100, 16, { seed: 38, amp: 1.5, wind: 0.4, bal: { fx: 0.5, h: 4.5 }, err: 0.3, fdmg: 0.3, why: 'breather: pop the balloon and enjoy' }),
  L('Double Trouble', 3, 120, 18, { seed: 39, volley: 2, err: 0.22, fdmg: 0.35, why: 'introduce volleys: the rival throws twice (each hit lighter)' }),
  L('Double Fence', 2, 140, 20, { seed: 40, volley: 2, wall: { fx: 0.5, h: 4.2 }, wind: 0.6, fdmg: 0.4, why: 'practise: the fence also shields you from the second throw' }),
  L('Shielded Duo', 5, 150, 21, { seed: 41, volley: 2, shield: true, wind: -0.8, fdmg: 0.4, why: 'twist: shield, volley and wind in one duel' }),
  L('Bolt-9 Prime', 3, 200, 22, { seed: 42, volley: 2, shield: true, wind: 1.2, slots: [0, -2, 1.5], bal: { fx: 0.55, h: 5.5 }, err: 0.1, fdmg: 0.5, hard: true, why: 'HARD boss: every World 2 idea at once' }),
  // ---- World 3: Midnight Peaks (long, steep, everything)
  L('Long Shot', 4, 130, 25, { seed: 51, amp: 1, wind: 0.3, err: 0.16, fdmg: 0.55, why: 'a long throw: power up and read the arc' }),
  L('Steep Peak', 2, 140, 21, { seed: 52, dy: 4, amp: 1.8, wind: -0.5, err: 0.16, fdmg: 0.55, why: 'throwing uphill over a peak' }),
  L('Balloon Gale', 5, 150, 22, { seed: 53, wind: 1.6, bal: { fx: 0.55, h: 4.5 }, err: 0.16, fdmg: 0.55, why: 'steer the balloon through a strong tailwind' }),
  L('Wall of Night', 1, 150, 22, { seed: 54, wall: { fx: 0.45, h: 6 }, shield: true, wind: 0.6, err: 0.16, fdmg: 0.55, why: 'a very tall wall and a shield: lob the head' }),
  L('Hopper', 3, 160, 22, { seed: 55, slots: [0, -3, 2.5, -1], shield: true, wind: -1.2, err: 0.15, fdmg: 0.6, why: 'a shielded rival who hops, in a headwind' }),
  L("Dusty's Stand", 4, 200, 24, { seed: 56, volley: 2, wall: { fx: 0.5, h: 4.5 }, bal: { fx: 0.68, h: 5.8 }, wind: 1.4, err: 0.1, fdmg: 0.5, hard: true, why: 'HARD: volley, fence, balloon and wind' }),
  L('Crossfire', 5, 160, 23, { seed: 57, volley: 2, wall: { fx: 0.5, h: 5 }, wind: -1, err: 0.15, fdmg: 0.45, why: 'volley behind a fence: use the cover' }),
  L('Moonlight', 1, 110, 18, { seed: 58, amp: 1.2, err: 0.3, fdmg: 0.3, why: 'breather: a calm easy duel before the last stretch' }),
  L('Triple Threat', 2, 210, 24, { seed: 59, shield: true, slots: [0, -2.5, 2], volley: 2, wind: 1.6, err: 0.1, fdmg: 0.5, hard: true, why: 'HARD: shield, stepping, volley and strong wind' }),
  L('Peak Wind', 3, 180, 23, { seed: 60, dy: -3, amp: 1.6, wind: -1.9, bal: { fx: 0.5, h: 5 }, err: 0.14, fdmg: 0.6, why: 'throwing downhill in a roaring headwind' }),
  L('Last Warm-up', 4, 200, 25, { seed: 61, shield: true, wall: { fx: 0.5, h: 4.5 }, wind: 1, slots: [0, 2, -2], err: 0.12, fdmg: 0.6, why: 'everything but the volley' }),
  L("Maestro's Finale", 5, 240, 25, { seed: 62, volley: 2, shield: true, wall: { fx: 0.5, h: 4.5 }, wind: 1.5, slots: [0, -2, 2], bal: { fx: 0.7, h: 6 }, err: 0.1, fdmg: 0.55, hard: true, why: 'HARD final boss: all of it, with a conductor' }),
];
export const worldOf = (lv) => Math.min(WORLDS.length, Math.ceil(lv / 12));
export const hardOf = (lv) => lv <= LEVELS.length && !!LEVELS[lv - 1].hard;
export const parOf = (lv) => lv <= LEVELS.length ? LEVELS[lv - 1].par : 3;
// fewest throws that win if every throw is a headshot (combo adds up to +50%)
export function parMin(hp) { let t = 0, d = 0, c = 0; while (d < hp && t < 20) { d += damage('head', WEAPONS.axe, c, false); c++; t++; } return t; }
const POS = (L) => { const slots = L.slots || [0]; return slots.map(s => makeCtx(L, L.d / 2 + s)); };
export { POS };
// Generated duels (Daily Duel, bonus brawls after level 36). Always checked: a head shot must exist at every rival spot.
export function genLevel(seed, tier = 1) {
  for (let tries = 0; tries < 12; tries++) {
    const r = rngOf(seed * 7919 + tries * 104729 + 3), pick = (a) => a[Math.floor(r() * a.length)];
    const d = Math.round(16 + r() * 8 + Math.min(3, tier * 0.3));
    const lv = L('Daily Duel', 1 + Math.floor(r() * 5), 110 + Math.floor(r() * 5) * 20 + Math.min(60, tier * 6), d, {
      seed: Math.floor(r() * 9000) + 100, amp: 0.4 + r() * 1.3, dy: (r() - 0.5) * 6, wind: r() < 0.65 ? (r() < 0.5 ? -1 : 1) * (0.4 + r() * 1.3) : 0,
      wall: r() < 0.4 ? { fx: 0.4 + r() * 0.2, h: 3.5 + r() * 2.2 } : null, bal: r() < 0.4 ? { fx: 0.45 + r() * 0.25, h: 4 + r() * 2 } : null,
      shield: r() < 0.3, slots: r() < 0.4 ? [0, -2 - r(), 1.5 + r()] : null, volley: r() < 0.3 ? 2 : 1, err: 0.09 + r() * 0.06, fdmg: 0.45 + r() * 0.2, why: 'generated' });
    if (POS(lv).every(c => bestShot(c, 'you') && bestShot(c, 'foe'))) return lv;
  }
  return L('Backyard', 1, 100, 17, { seed: 99, par: 3 });
}
