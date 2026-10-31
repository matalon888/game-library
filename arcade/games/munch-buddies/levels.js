// Munch Buddies v2: 30 authored stages in 3 worlds (+ Encore generator and a Daily Duet).
// Fields: song, tempo, len (seconds), gap (min seconds between snacks), bomb (0-1 chance), long (hold treats allowed),
//         twin (chance a snack gets a partner on the other lane at the same beat: two thumbs), gold (golden snacks, +5),
//         trap (chance of a bomb just before a snack in the same lane: don't tap early), fog (snacks vanish near the mouth),
//         ramp (tempo rise across the song), hearts, par (perfect rate for the 3rd star), boss, why (the purpose line).
export const WORLDS = [
  { name: 'Pantry', icon: '🥫', from: 1, to: 10 },
  { name: 'Cake Shop', icon: '🧁', from: 11, to: 20 },
  { name: 'Night Market', icon: '🏮', from: 21, to: 30 },
];
const L = (o) => { const d = { tempo: 1, gap: 0.32, bomb: 0, long: false, twin: 0, gold: 0, trap: 0, fog: false, ramp: 0.05, hearts: 3, par: 0.55, ...o }; if (o.hearts == null && d.len > 28) d.hearts = 5; return d; };
export const LEVELS = [
  // ---- World 1: Pantry (the verb: tap on the beat; then hold; then don't touch bombs)
  L({ song: 'twinkle', len: 12, gap: 0.4, hearts: 9, par: 0.3, why: 'intro: tap the kitten when the snack arrives; cannot be lost' }),
  L({ song: 'ode', len: 16, gap: 0.36, hearts: 9, gold: 1, par: 0.4, why: 'two kittens take turns, and the first golden snack appears; still very forgiving' }),
  L({ song: 'saints', len: 20, bomb: 0.1, hearts: 6, par: 0.45, why: 'first bombs: the only thing to learn is "do not tap the bomb"' }),
  L({ song: 'twinkle', tempo: 1.1, len: 24, long: true, gold: 1, par: 0.5, why: 'introduce hold: long chocolate treats, plus one golden snack to chase' }),
  L({ song: 'minuet', len: 24, long: true, bomb: 0.06, par: 0.5, why: 'practise hold with a few bombs in a waltz' }),
  L({ song: 'canon', len: 28, long: true, bomb: 0.12, twin: 0.1, par: 0.55, why: 'twist: a few twin snacks, and a bomb can sit on the other lane while you hold' }),
  L({ song: 'ode', tempo: 1.12, len: 28, bomb: 0.14, par: 0.55, why: 'faster Ode, bombs and quick alternation' }),
  L({ song: 'cancan', tempo: 0.95, len: 30, long: true, bomb: 0.12, par: 0.55, why: 'busy galop: hold, tap, avoid' }),
  L({ song: 'elise', len: 32, long: true, bomb: 0.16, par: 0.6, why: 'hard-ish: waltz with long treats and more bombs' }),
  L({ song: 'mountain', len: 40, long: true, bomb: 0.18, ramp: 0.2, par: 0.6, boss: true, why: 'BOSS: Mountain King speeds up; everything from world 1' }),
  // ---- World 2: Cake Shop (twin snacks, golden snacks, bomb traps)
  L({ song: 'twinkle', tempo: 1.2, len: 22, twin: 0.14, hearts: 4, par: 0.5, why: 'breather + introduce twins: two snacks at once, one thumb each side' }),
  L({ song: 'ode', tempo: 1.1, len: 26, twin: 0.16, bomb: 0.08, par: 0.55, why: 'practise twins with a few bombs' }),
  L({ song: 'neon', len: 28, twin: 0.14, gold: 2, par: 0.55, why: 'introduce golden snacks: worth 5, never skip them' }),
  L({ song: 'saints', tempo: 1.15, len: 28, gold: 2, twin: 0.12, bomb: 0.12, par: 0.55, why: 'gold under pressure: bombs and twins together' }),
  L({ song: 'minuet', tempo: 1.1, len: 30, twin: 0.2, long: true, bomb: 0.12, gold: 2, par: 0.6, why: 'twins while holding: use both thumbs' }),
  L({ song: 'starlight', len: 32, trap: 0.14, bomb: 0.08, gold: 2, par: 0.55, why: 'introduce traps: a bomb just before a snack in the same lane, wait for the beat' }),
  L({ song: 'canon', tempo: 1.2, len: 30, trap: 0.12, long: true, twin: 0.12, par: 0.6, why: 'traps + holds + twins in a calm piece' }),
  L({ song: 'cancan', tempo: 1.05, len: 34, trap: 0.1, twin: 0.14, bomb: 0.14, gold: 3, par: 0.6, why: 'busy: three golden snacks to chase' }),
  L({ song: 'elise', tempo: 1.12, len: 34, trap: 0.14, twin: 0.16, long: true, bomb: 0.16, gold: 3, par: 0.65, why: 'hard: every world-2 element at once' }),
  L({ song: 'turkish', len: 44, trap: 0.14, twin: 0.18, long: true, bomb: 0.16, gold: 3, ramp: 0.15, par: 0.65, boss: true, why: 'BOSS: Rondo alla Turca, relentless pace' }),
  // ---- World 3: Night Market (fog, rush, everything)
  L({ song: 'twinkle', tempo: 1.25, len: 24, fog: true, hearts: 4, par: 0.5, why: 'breather + introduce fog: snacks vanish just before the mouth, trust the beat' }),
  L({ song: 'ode', tempo: 1.2, len: 28, fog: true, bomb: 0.1, par: 0.55, why: 'practise fog with bombs you can still see early' }),
  L({ song: 'neon', tempo: 1.1, len: 30, fog: true, twin: 0.14, gold: 2, par: 0.55, why: 'fog + twins + gold' }),
  L({ song: 'saints', tempo: 1.25, len: 32, ramp: 0.22, bomb: 0.12, twin: 0.12, par: 0.55, why: 'introduce rush: the tempo climbs all song' }),
  L({ song: 'minuet', tempo: 1.2, len: 32, fog: true, long: true, trap: 0.12, par: 0.6, why: 'foggy waltz with traps and holds' }),
  L({ song: 'starlight', tempo: 1.1, len: 34, fog: true, twin: 0.16, trap: 0.12, gold: 3, par: 0.6, why: 'twist: fog + twins + traps + gold' }),
  L({ song: 'canon', tempo: 1.35, len: 34, ramp: 0.15, long: true, twin: 0.16, bomb: 0.1, par: 0.65, why: 'canon rush: a calm tune at a sprint' }),
  L({ song: 'cancan', tempo: 1.15, len: 36, fog: true, ramp: 0.15, bomb: 0.16, trap: 0.1, par: 0.65, why: 'hard: fog + rush + bombs' }),
  L({ song: 'turkish', tempo: 1.1, len: 40, fog: true, twin: 0.16, long: true, bomb: 0.14, trap: 0.12, gold: 3, ramp: 0.12, par: 0.65, why: 'hard: the full kit before the finale' }),
  L({ song: 'mountain', tempo: 1.15, len: 52, fog: true, twin: 0.14, long: true, bomb: 0.16, trap: 0.12, gold: 4, ramp: 0.22, par: 0.65, boss: true, why: 'FINALE: Mountain King at full speed, fog and all' }),
];
const SONG_ORDER = ['twinkle', 'ode', 'saints', 'minuet', 'canon', 'cancan', 'neon', 'elise', 'starlight', 'mountain', 'turkish'];
/** Encore (after level 30): the unlocked elements in rotation, a bit faster every lap. */
export function encore(n) {
  const k = n - 30, r = (k * 7) % SONG_ORDER.length;
  return L({ song: SONG_ORDER[r], tempo: Math.min(1.45, 1.1 + 0.02 * k), len: Math.min(50, 34 + k), long: k % 2 === 0, bomb: 0.14, twin: 0.14, gold: 2, trap: k % 3 === 0 ? 0.12 : 0, fog: k % 4 === 3, ramp: 0.12, par: 0.65, why: 'encore' });
}
/** Daily Duet: one song for everybody today (same chart for every player). */
export function daily(dayStr) {
  let h = 7; for (const c of dayStr) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return L({ song: SONG_ORDER[h % SONG_ORDER.length], tempo: 1.1 + (h % 4) * 0.05, len: 36, long: true, bomb: 0.12, twin: 0.12, gold: 2, trap: 0.1, fog: h % 3 === 0, ramp: 0.1, par: 0.6, why: 'daily', seed: h });
}
export const defFor = (n) => LEVELS[n - 1] || encore(n);
export const worldOf = (n) => Math.min(2, Math.floor((n - 1) / 10));
