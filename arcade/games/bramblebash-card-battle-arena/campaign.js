// Bramblebash campaign (deep v2): 30 hand-made duels in 3 worlds. Every duel has a purpose line, an opponent with its own deck,
// and (from world 1 on) a twist. Original names and content.
// Twists (all in game.js): acorn = a golden acorn appears on a bridge, first troop to reach it wins +3 sap; honey = sticky puddles
// slow every troop; hive = the CPU Hearth drips a free bee swarm; storm = sap flows 1.5x for both; fixed = you play a given deck;
// rush = short clock; boss = bigger Hearth. Ranges: cpuHp/myHp scale tower health, delay = seconds the CPU waits, think = CPU speed
// (lower = faster), cpuRegen = CPU sap speed.
export const WORLDS = [
  { name: 'Mossy Meadow', from: 1, to: 10, col: '#6cc551', icon: '🌿', blurb: 'Learn to drop, cross and crush' },
  { name: 'Bramble Woods', from: 11, to: 20, col: '#3f9d6a', icon: '🍄', blurb: 'Puddles, hives and bridge fights' },
  { name: 'Thornpeak', from: 21, to: 30, col: '#8a6bd1', icon: '⛰️', blurb: 'Fast clocks, set decks, bosses' },
];
export const STICKERS = ['🐞', '🐝', '🦔', '🐸', '🐿️', '🐻', '🦋', '🍄', '🌰', '👑'];
const SQ = 'squirrels', KN = 'knight', BR = 'brute', BE = 'bees', AR = 'archers', FR = 'frog', CA = 'cannon', VO = 'volley', MO = 'mole',
  SN = 'snare', HE = 'heal', BA = 'badger', BO = 'boulder', MT = 'moth', BEAR = 'bear';
// n, opp, name, why (purpose), deck, ai (0 easy..2 hard), think (x), delay, cpuHp, sap0, t, mods, g3 (third star), hand (cards in your first hand), tip (coach)
const L = (n, opp, name, why, deck, ai, o = {}) => ({ n, opp, name, why, deck, ai, think: 1, delay: 0, cpuHp: 1, myHp: 1, sap0: 5, t: 180, g3: 'hearth', ...o });
export const LEVELS = [
  // ---- world 1: Mossy Meadow
  L(1, '🐛 Pip', 'First Drop', 'Drag a card onto your side. Crack a tower.', [SQ, KN, SQ, KN, SQ, KN, SQ, KN], 0, { think: 2.2, delay: 25, cpuHp: 0.5, sap0: 10, t: 100, open: [KN], hand: [KN, SQ, AR, BE], tip: '👆 Drag a card onto your half', g3: 'fast:70' }),
  L(2, '🐛 Pip', 'Two Lanes', 'Two towers, two lanes: pick one and push.', [SQ, KN, AR, SQ, KN, AR, SQ, KN], 0, { think: 1.9, delay: 6, cpuHp: 0.6, sap0: 8, t: 110, open: [SQ, KN], hand: [KN, AR, BE, SQ], tip: '⛳ Push the lane the CPU leaves open', g3: 'fast:80' }),
  L(3, '🐌 Tilly', 'Pinecone Pop', 'Spells land anywhere. Hit a clump.', [SQ, SQ, KN, AR, SQ, KN, FR, SQ], 0, { think: 1.7, delay: 8, cpuHp: 0.7, sap0: 7, t: 130, hand: [VO, KN, SQ, AR], tip: '🌲 Spells can land anywhere: blast the crowd', g3: 'hearth' }),
  L(4, '🐌 Tilly', 'Fly By', 'Bees ignore the creek line. Go over.', [KN, KN, SQ, AR, KN, SQ, AR, FR], 0, { think: 1.5, delay: 8, cpuHp: 0.8, sap0: 6, hand: [BE, SQ, KN, VO], tip: '🐝 Bees are fast and fly: great for finishing', g3: 'fast:120' }),
  L(5, '🐞 Dot', 'Golden Acorn', 'A golden acorn rolls onto a bridge: grab it first.', [KN, SQ, AR, BE, FR, KN, SQ, VO], 1, { think: 1.5, delay: 5, cpuHp: 0.85, mods: ['acorn'], tip: '🌰 Send a troop over the golden acorn: +3 sap' }),
  L(6, '🐞 Dot', 'Heavy Footsteps', 'A Beetle Brute walks slowly but hits like a log.', [BR, SQ, SQ, AR, KN, SQ, VO, KN], 1, { think: 1.4, delay: 3, cpuHp: 0.95, hand: [AR, KN, FR, SQ], tip: '🛡 Brutes only hit buildings: ignore them, hit the lane' }),
  L(7, '🦗 Cricket Kate', 'Wing Patrol', 'Air raids. Archers and Moths love the sky.', [BE, BE, AR, SQ, KN, VO, FR, SQ], 1, { think: 1.4, mods: ['acorn'], cpuHp: 1, hand: [AR, CA, KN, FR] }),
  L(8, '🦗 Cricket Kate', 'Mushroom Wall', 'Put a Mushroom Cannon in the way. Defence wins.', [BR, KN, KN, SQ, FR, KN, BE, SQ], 1, { think: 1.25, cpuHp: 1, hand: [CA, KN, SQ, VO], tip: '🍄 A cannon stands 30 s: drop it on the lane they push' }),
  L(9, '🦔 Hedge', 'Two Front Push', 'He attacks both lanes. Hold one, push one.', [KN, SQ, SQ, FR, BE, AR, KN, VO], 1, { think: 1.2, cpuHp: 1, mods: ['acorn'] }),
  L(10, '👑 Old Mossback', 'BOSS: The Old Stump', 'Boss: a huge Hearth and a bear. Take it down.', [BEAR, KN, SQ, AR, VO, BE, FR, CA], 1, { think: 1.15, cpuHp: 1.15, delay: 2, mods: ['boss'], t: 200 }),
  // ---- world 2: Bramble Woods
  L(11, '🐸 Bog', 'Sticky Puddles', 'Honey puddles slow everyone. Plan around them.', [FR, FR, KN, SQ, AR, VO, BE, KN], 1, { think: 1.2, mods: ['honey'], tip: '🍯 Puddles slow all troops (yours too)' }),
  L(12, '🐸 Bog', 'Frog Chorus', 'Bomb frogs hit the crowd. Spread your troops.', [FR, FR, FR, SQ, KN, AR, SN, BE], 1, { think: 1.15, mods: ['honey'], hand: [SQ, KN, BE, VO] }),
  L(13, '🐝 Queen Bzz', 'The Hive', 'The enemy Hearth drips bees. Finish it fast.', [BE, BE, AR, AR, KN, SQ, VO, MT], 1, { think: 1.1, mods: ['hive'], cpuHp: 1, g3: 'fast:150', tip: '🐝 The enemy hive spawns bees: keep archers back' }),
  L(14, '🐝 Queen Bzz', 'Archers Wanted', 'Swarms beat knights. Spells and archers win.', [BE, BE, BE, SQ, SQ, AR, VO, SN], 1, { think: 1.1, mods: ['hive'], hand: [AR, VO, KN, BR] }),
  L(15, '🦊 Rusty', 'Fast Hands', 'He plays quickly. Keep your sap spent.', [SQ, KN, BA, FR, BE, VO, SQ, AR], 1, { think: 0.9, mods: ['acorn'] }),
  L(16, '🦊 Rusty', 'Badger Charge', 'Badgers hit twice after a run. Kite them with a cannon.', [BA, BA, SQ, AR, KN, FR, SN, BO], 1, { think: 0.95, hand: [CA, KN, AR, SQ] }),
  L(17, '🦉 Hoot', 'Night Shift', 'Sap flows 1.5x. Everything happens faster.', [KN, SQ, BE, AR, FR, VO, BA, MT], 1, { think: 0.95, mods: ['storm'], t: 150 }),
  L(18, '🦉 Hoot', 'Moth Watch', 'Flying ranged moths: archers are your friends.', [MT, MT, BE, AR, KN, VO, SN, CA], 1, { think: 0.9, mods: ['storm', 'honey'], t: 150 }),
  L(19, '🐗 Tusk', 'Mud Slide', 'A bear in the mud. Boulders and snares help.', [BEAR, BA, SQ, SQ, FR, AR, VO, BE], 1, { think: 0.95, mods: ['honey', 'acorn'] }),
  L(20, '👑 Queen Thorn', 'BOSS: The Thorn Court', 'Boss: a hive Hearth, a bear, and fast hands.', [BEAR, BE, BE, MT, AR, VO, KN, SN], 1, { think: 0.85, cpuHp: 1.2, mods: ['boss', 'hive'], t: 210, cpuRegen: 1.1 }),
  // ---- world 3: Thornpeak
  L(21, '🐐 Kid', 'Short Clock', 'Only 2 minutes. Be aggressive.', [KN, SQ, BE, AR, FR, VO, BA, SQ], 2, { think: 0.8, t: 120, mods: ['acorn'], g3: 'fast:90' }),
  L(22, '🐐 Kid', 'Squirrel Day', 'Your deck is squirrels and spells only. Swarm him.', [SQ, KN, SQ, FR, BE, VO, SQ, AR], 2, { think: 0.8, t: 150, mods: ['fixed'], fixed: [SQ, SQ, SQ, BE, SN, BO, VO, HE] }),
  L(23, '🦅 Talon', 'Sky High', 'Fliers everywhere. Your set deck has archers.', [BE, MT, MT, BE, AR, VO, KN, SN], 2, { think: 0.8, mods: ['fixed'], fixed: [AR, AR, CA, KN, VO, SQ, FR, BR] }),
  L(24, '🦅 Talon', 'Wind Storm', 'Fast sap, short clock, big pushes.', [BA, BEAR, SQ, BE, AR, VO, FR, KN], 2, { think: 0.75, mods: ['storm'], t: 130 }),
  L(25, '🐺 Fang', 'Wolf Pack', 'Many fast troops: spells and cannons.', [SQ, SQ, BA, BA, BE, BE, KN, VO], 2, { think: 0.75, mods: ['acorn', 'honey'], hand: [CA, VO, FR, AR] }),
  L(26, '🐺 Fang', 'No Left Tower', 'Your left tower is already gone. Hold the right.', [BA, KN, FR, BE, AR, VO, SQ, MT], 2, { think: 0.8, mods: ['noleft'], myHp: 1, tip: '⚠ You start a tower down: defend, then counter' }),
  L(27, '🦌 Antler', 'Bear Hug', 'Two bears and a Hearth that bites back.', [BEAR, BEAR, BE, BE, VO, SQ, AR, HE], 2, { think: 0.8, t: 210, cpuHp: 1.1, mods: ['hive'] }),
  L(28, '🦌 Antler', 'Honey Storm', 'Puddles, double sap, no mercy.', [MT, BA, FR, SQ, BE, VO, SN, KN], 2, { think: 0.7, mods: ['honey', 'storm'], t: 150 }),
  L(29, '🐻 Grizzle', 'Set Deck Duel', 'Win with the cards you are given.', [BEAR, BA, FR, BE, AR, VO, MT, KN], 2, { think: 0.7, mods: ['fixed', 'acorn'], fixed: [KN, SQ, BE, AR, FR, VO, CA, MO], cpuRegen: 1.1 }),
  L(30, '👑 The Briar King', 'FINAL BOSS: Briar Throne', 'Everything at once. Break the throne.', [BEAR, BA, MT, BE, FR, VO, SN, AR], 2, { think: 0.65, cpuHp: 1.3, mods: ['boss', 'hive', 'acorn', 'honey'], t: 240, cpuRegen: 1.15 }),
];
// cards earned by first clear of a level
export const REWARDS = { 3: 'mole', 6: 'snare', 9: 'heal', 13: 'badger', 16: 'boulder', 19: 'moth', 22: 'bear' };
// third-star text
export const g3Text = g => g === 'hearth' ? 'Knock out the Hearth' : 'Win in under ' + Math.floor(+g.split(':')[1] / 60) + ':' + String(+g.split(':')[1] % 60).padStart(2, '0');
