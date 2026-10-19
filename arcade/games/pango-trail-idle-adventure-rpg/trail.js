// trail.js — the rules of Pango Trail, pure and seeded (no DOM), so runs can be simulated and balanced in Node.
export function rng(seed) { seed = Math.floor(seed) % 2147483647 || 1; return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }

export const SKILLS = {
  claws: { n: 'Sharp Claws', i: '🗡️', max: 4, d: () => '+15% attack' },
  scales: { n: 'Thick Scales', i: '🛡️', max: 4, d: () => '+20% max HP' },
  shell: { n: 'Hard Shell', i: '🐚', max: 4, d: () => '+3 defence' },
  crit: { n: 'Keen Eye', i: '🎯', max: 3, d: () => '+10% critical hit chance' },
  dodge: { n: 'Quick Feet', i: '💨', max: 3, d: () => '+7% dodge chance' },
  twin: { n: 'Twin Swipe', i: '✌️', max: 3, d: () => '+18% chance to strike twice' },
  fire: { n: 'Ember Breath', i: '🔥', max: 3, d: () => '+22% chance of a fire puff for 80% attack' },
  spark: { n: 'Spark Tail', i: '⚡', max: 3, d: () => 'Every 3rd hit zaps for a bonus 150% attack (+50% per level)' },
  thorns: { n: 'Prickle Coat', i: '🌵', max: 3, d: () => 'Reflect 25% of damage taken' },
  sip: { n: 'Dew Sip', i: '💧', max: 3, d: () => 'Heal 10% of damage dealt' },
  curl: { n: 'Curl Up', i: '🌀', max: 3, d: () => 'Block one more hit at the start of each battle' },
  berry: { n: 'Berry Pouch', i: '🫐', max: 3, d: () => 'Heal 12% max HP after each battle' },
  rage: { n: 'Grumble', i: '😤', max: 3, d: () => '+5% attack for every hit taken this battle' },
  wind: { n: 'Second Wind', i: '🍃', max: 1, d: () => 'Once a battle, survive a fatal hit and heal 25%' },
};
export const ENEMIES = [
  { k: 'blob', n: 'Mudblob' }, { k: 'beetle', n: 'Thorn Beetle' }, { k: 'shroom', n: 'Grumpcap' }, { k: 'crab', n: 'Pebble Crab' }, { k: 'wasp', n: 'Buzzbee' }, { k: 'bat', n: 'Dusk Flap' },
];
export const BOSSES = [
  { k: 'bramble', n: 'The Bramble King' }, { k: 'toad', n: 'Old Stone Toad' }, { k: 'moth', n: 'The Storm Moth' }, { k: 'yeti', n: 'Ember Yeti' },
];
export const CHAPTERS = ['Clover Meadow', 'Sunbaked Canyon', 'Frostfern Pass', 'Glowcap Woods'];
export const BOSS_EVERY = 10;
export const T = { GROW: 1.09, EN_HP: 45, EN_ATK: 12, BOSS_HP: 80, BOSS_ATK: 8, REGEN: 0.05, LV_ATK: 4, LV_HP: 18 };
let { GROW, EN_HP, EN_ATK, BOSS_HP, BOSS_ATK, REGEN, LV_ATK, LV_HP } = T;
export function tune(o) { Object.assign(T, o); ({ GROW, EN_HP, EN_ATK, BOSS_HP, BOSS_ATK, REGEN, LV_ATK, LV_HP } = T); }

export function newRun(seed, fk = 1) {
  return { R: rng(seed), day: 0, lvl: 1, xp: 0, base: { hp: 120, atk: 14, def: 2 }, gear: { hp: 0, atk: 0, def: 0 }, sk: {}, hp: 120, fk, alive: true, bossesDown: 0, bonusAtk: 0 };
}
const L = (r, k) => r.sk[k] || 0;
export function stats(r) {
  const maxHp = Math.round((r.base.hp + r.gear.hp) * (1 + 0.2 * L(r, 'scales')));
  const atk = Math.round((r.base.atk + r.gear.atk) * (1 + 0.15 * L(r, 'claws') + r.bonusAtk));
  return { maxHp, atk, def: r.base.def + r.gear.def + 3 * L(r, 'shell'), crit: 0.05 + 0.1 * L(r, 'crit'), dodge: 0.07 * L(r, 'dodge') };
}
export const xpNeed = r => 10 + r.lvl * 7;

export function enemyFor(r, day) {
  const boss = day % BOSS_EVERY === 0;
  const g = Math.pow(GROW, day - 1) * r.fk;
  if (boss) { const b = BOSSES[(day / BOSS_EVERY - 1) % BOSSES.length]; return { ...b, boss: true, hp: Math.round(BOSS_HP * g), atk: Math.round(BOSS_ATK * g), def: Math.round(2 + day * 0.25), xp: 40 + day * 2 }; }
  const e = ENEMIES[Math.floor(r.R() * ENEMIES.length)], v = 0.85 + r.R() * 0.3;
  return { ...e, hp: Math.round(EN_HP * g * v), atk: Math.round(EN_ATK * g * (1.15 - (v - 0.85))), def: Math.round(day * 0.15), xp: 8 + day };
}

/** decide what today brings: battle | skill | event | chest | rest */
export function rollDay(r) {
  r.day++;
  const d = r.day;
  if (d % BOSS_EVERY === 0) return { type: 'battle', enemy: enemyFor(r, d) };
  if (d === 1) return { type: 'battle', enemy: enemyFor(r, d) };
  if (d % BOSS_EVERY === BOSS_EVERY - 1) return { type: 'rest', camp: true };
  const x = r.R();
  if (x < 0.42) return { type: 'battle', enemy: enemyFor(r, d) };
  if (x < 0.56) return { type: 'skill', opts: skillOpts(r) };
  if (x < 0.76) return { type: 'event', ev: EVENTS[Math.floor(r.R() * EVENTS.length)] };
  if (x < 0.9) return { type: 'chest', gear: gearFor(r) };
  return { type: 'rest' };
}
export function gearFor(r) {
  const k = ['atk', 'def', 'hp'][Math.floor(r.R() * 3)], s = 1 + r.day * 0.12;
  const v = k === 'atk' ? Math.round(3 * s) : k === 'def' ? Math.max(1, Math.round(1 * s)) : Math.round(18 * s);
  const names = { atk: ['Acorn Spear', 'Thorn Dagger', 'Flint Claw', 'Crystal Tooth'], def: ['Bark Vest', 'Snail Shield', 'Leaf Cloak', 'Stone Shell'], hp: ['Honey Jar', 'Clover Charm', 'Moss Pillow', 'Sun Seed'] }[k];
  return { k, v, n: names[Math.floor(r.R() * names.length)] };
}
export function applyGear(r, g) { const before = stats(r).maxHp; r.gear[g.k] += g.v; const after = stats(r).maxHp; r.hp = Math.min(after, r.hp + Math.max(0, after - before)); }
export function skillOpts(r) {
  const pool = Object.keys(SKILLS).filter(k => L(r, k) < SKILLS[k].max), out = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(r.R() * pool.length), 1)[0]);
  return out;
}
export function learn(r, k) { const before = stats(r).maxHp; r.sk[k] = L(r, k) + 1; const after = stats(r).maxHp; r.hp = Math.min(after, r.hp + Math.max(0, after - before)); }
export function heal(r, f) { const m = stats(r).maxHp, h = Math.round(m * f); const before = r.hp; r.hp = Math.min(m, r.hp + h); return r.hp - before; }

// events: text + two choices; each choice resolves to a result line
export const EVENTS = [
  { t: 'A mossy well glitters in the grass.', a: ['Drink deep', r => `+${heal(r, 0.35)} HP. Cool and sweet.`], b: ['Toss a pebble', r => r.R() < 0.5 ? (r.bonusAtk += 0.06, 'A wish comes true: +6% attack!') : 'Plip. Nothing happens.'] },
  { t: 'A travelling snail offers a trade.', a: ['Trade 15% HP for a lesson', r => { r.hp = Math.max(1, Math.round(r.hp - stats(r).maxHp * 0.15)); return 'skill'; }], b: ['Wave goodbye', r => `+${heal(r, 0.08)} HP from a friendly chat.`] },
  { t: 'Wild berries on a thorny bush.', a: ['Eat a handful', r => r.R() < 0.7 ? `Delicious! +${heal(r, 0.28)} HP.` : (r.hp = Math.max(1, Math.round(r.hp - stats(r).maxHp * 0.1)), 'Sour! −10% HP.')], b: ['Pack them for later', r => { r.gear.hp += 10 + r.day; r.hp += 10 + r.day; return `+${10 + r.day} max HP.`; }] },
  { t: 'A sleepy owl guards a rope bridge.', a: ['Tiptoe past', r => r.R() < 0.6 ? (r.xp += 10 + r.day, `Sneaky! +${10 + r.day} XP.`) : (r.hp = Math.max(1, Math.round(r.hp - stats(r).maxHp * 0.12)), 'The owl hoots. You trip! −12% HP.')], b: ['Take the long way', r => `A calm walk. +${heal(r, 0.12)} HP.`] },
  { t: 'An old stump has a door in it.', a: ['Knock', r => { const g = gearFor(r); applyGear(r, g); return `A mole hands you a ${g.n}: +${g.v} ${g.k.toUpperCase()}.`; }], b: ['Nap on the step', r => `Zzz. +${heal(r, 0.22)} HP.`] },
  { t: 'Fireflies spell out a riddle.', a: ['Answer "the moon"', r => r.R() < 0.55 ? (r.base.atk += 3, 'Right! +3 ATK.') : 'They blink and fly away.'], b: ['Answer "a pebble"', r => r.R() < 0.55 ? (r.base.def += 2, 'Right! +2 DEF.') : 'They giggle and fly away.'] },
];

/** a full battle, decided up front with the run's seeded dice, returned as a list of beats for the animation */
export function battle(r, e) {
  const s = stats(r), out = [];
  let ehp = e.hp, hits = 0, taken = 0, block = L(r, 'curl'), wind = L(r, 'wind') > 0;
  const R = r.R;
  for (let turn = 0; turn < 80 && ehp > 0 && r.hp > 0; turn++) {
    // hero swings
    const swings = 1 + (R() < 0.18 * L(r, 'twin') ? 1 : 0);
    for (let w = 0; w < swings && ehp > 0; w++) {
      hits++;
      const atk = s.atk * (1 + 0.05 * L(r, 'rage') * taken);
      const crit = R() < s.crit;
      let dmg = Math.max(1, Math.round(atk * (0.9 + R() * 0.2) * (crit ? 1.8 : 1) - e.def));
      ehp -= dmg; out.push({ who: 'hero', kind: w ? 'twin' : crit ? 'crit' : 'hit', dmg, ehp: Math.max(0, ehp), hp: r.hp });
      if (L(r, 'sip')) { const h = Math.round(dmg * 0.1 * L(r, 'sip')); r.hp = Math.min(s.maxHp, r.hp + h); }
      if (ehp > 0 && L(r, 'spark') && hits % 3 === 0) { const z = Math.round(atk * (1 + 0.5 * L(r, 'spark'))); ehp -= z; out.push({ who: 'hero', kind: 'spark', dmg: z, ehp: Math.max(0, ehp), hp: r.hp }); }
      if (ehp > 0 && R() < 0.22 * L(r, 'fire')) { const f = Math.round(atk * 0.8); ehp -= f; out.push({ who: 'hero', kind: 'fire', dmg: f, ehp: Math.max(0, ehp), hp: r.hp }); }
    }
    if (ehp <= 0) break;
    // enemy swings
    if (block > 0) { block--; out.push({ who: 'enemy', kind: 'block', dmg: 0, ehp, hp: r.hp }); continue; }
    if (R() < s.dodge) { out.push({ who: 'enemy', kind: 'dodge', dmg: 0, ehp, hp: r.hp }); continue; }
    const dmg = Math.max(1, Math.round(e.atk * (0.9 + R() * 0.2) - s.def));
    r.hp -= dmg; taken++;
    if (r.hp <= 0 && wind) { wind = false; r.hp = 1; heal(r, 0.25); out.push({ who: 'enemy', kind: 'wind', dmg, ehp, hp: r.hp }); }
    else out.push({ who: 'enemy', kind: 'hit', dmg, ehp, hp: Math.max(0, r.hp) });
    if (L(r, 'thorns') && ehp > 0) { const t = Math.max(1, Math.round(dmg * 0.25 * L(r, 'thorns'))); ehp -= t; out.push({ who: 'hero', kind: 'thorns', dmg: t, ehp: Math.max(0, ehp), hp: Math.max(0, r.hp) }); }
  }
  const won = ehp <= 0 && r.hp > 0;
  if (!won) { r.hp = 0; r.alive = false; }
  return { beats: out, won };
}
/** after a won battle: xp, berry heal; returns number of level-ups */
export function afterBattle(r, e) {
  heal(r, REGEN + 0.12 * L(r, 'berry'));
  r.xp += e.xp; let ups = 0;
  while (r.xp >= xpNeed(r)) { r.xp -= xpNeed(r); r.lvl++; r.base.atk += LV_ATK; r.base.hp += LV_HP; r.hp += LV_HP; ups++; }
  if (e.boss) { r.bossesDown++; heal(r, 0.5); }
  return ups;
}
// a simple sensible pick order for the bot / simulation
export const PREF = ['claws', 'scales', 'twin', 'crit', 'shell', 'wind', 'berry', 'sip', 'spark', 'fire', 'curl', 'dodge', 'rage', 'thorns'];
