// Beatbuds deep v2 — the Band Tour: 30 gigs in 3 worlds. Every gig: slots (buds on stage), takes (placements you get, 0 = no limit),
// star (the spotlight bud: its sound counts double, -1 none), lock (sounds out of order), chips (goals = 1 star), bonus (gold goals,
// with the chips = 2 stars), hidden (the secret set: on stage with everything above = 3 stars), clue (riddle), why (what it teaches).
// Chip kinds: see dlogic.js. qa/verify.mjs proves every gig can reach 3 stars within its takes.
export const WORLDS = [
  { n: 'Garage', e: '🎸', c: '#ff8a3d', sky: ['#3a2370', '#1b1240'] },
  { n: 'Street Fair', e: '🎡', c: '#2ec27e', sky: ['#14507a', '#0f1f4a'] },
  { n: 'Arena', e: '🏟️', c: '#ff5fa2', sky: ['#5a1a6a', '#1c0d3a'] },
];
const G = (w, n, slots, takes, star, lock, chips, bonus, hidden, clue, why, hard) => ({ w, n, slots, takes, star, lock, chips, bonus, hidden, clue, why, hard: !!hard });
export const LEVELS = [
  // ---- world 1 · Garage: the verb, then one new goal kind every gig
  G(0, 'Soundcheck', 3, 0, -1, [], [['cat', 0, 1]], [['cat', 3, 1]], ['thump', 'ooh'], 'a heartbeat and a ghost', 'tap any beat: the first win in seconds'),
  G(0, 'Two Chords', 3, 0, -1, [], [['cat', 0, 1], ['cat', 2, 1]], [['cat', 3, 1]], ['bap', 'bells', 'la'], 'snap, shine, sing', 'a beat and a melody: two goals'),
  G(0, 'Quiet Please', 4, 0, -1, [], [['cat', 0, 1], ['bancat', 3]], [['feel', 6]], ['shaker', 'bells', 'pad'], 'rain on a window: shaken, ringing, floating', 'a banned kind: no voices'),
  G(0, 'Pick Two', 4, 0, -1, [], [['cat', 2, 2], ['cat', 0, 1]], [['hype', 5]], ['floor', 'arp', 'marimba'], 'a four-count, a sparkle, a wooden knock', 'two of one kind'),
  G(0, 'Hype Up', 4, 0, -1, [], [['hype', 8]], [['feel', 3]], ['bap', 'riser', 'hey'], 'punch it, launch it, shout it', 'the hype meter: loud sounds fill it'),
  G(0, 'Soft Landing', 4, 0, -1, [], [['feel', 8]], [['cat', 2, 2]], ['pad', 'bells', 'ooh'], 'warm clouds and a ghost choir', 'the feel meter: warm sounds fill it'),
  G(0, 'One Of Each', 4, 0, -1, [], [['cat', 0, 1], ['cat', 1, 1], ['cat', 2, 1], ['cat', 3, 1]], [['hype', 5]], ['mouth', 'bleeps', 'whistle', 'doo'], 'a mouth, a robot, a bird, a top hat', 'all four kinds at once'),
  G(0, 'No Drums Day', 5, 0, -1, [], [['bancat', 0], ['hype', 6]], [['cat', 1, 2]], ['wobble', 'riser', 'hey'], 'wobble, whoosh, shout', 'a banned kind AND a meter'),
  G(0, 'Bass Line', 5, 0, -1, [], [['id', 'bass'], ['cat', 3, 2]], [['bancat', 2]], ['bass', 'doo', 'hey'], 'low and long, a hat and a holler', 'a named sound you must use'),
  G(0, 'Garage Gig', 6, 0, -1, [], [['hype', 9], ['feel', 6], ['cat', 0, 1]], [['bancat', 1]], ['floor', 'marimba', 'la', 'hey'], 'dance floor, wood, a song, a shout', 'HARD: both meters at once', true),
  // ---- world 2 · Street Fair: takes (every placement counts), out-of-order sounds, hype caps
  G(1, 'Parade Warm-up', 5, 0, -1, [], [['cat', 2, 2], ['cat', 3, 1]], [['hype', 5]], ['marimba', 'whistle', 'hey'], 'a march: wood, bird, shout', 'breather: easy and loud'),
  G(1, 'Broken Amp', 4, 0, -1, ['bass', 'wobble'], [['cat', 1, 1], ['hype', 6]], [['cat', 3, 1]], ['claps', 'bap', 'hey'], 'hands, a snap, a shout', 'out-of-order sounds are greyed'),
  G(1, 'Take Five', 4, 8, -1, [], [['cat', 0, 1], ['cat', 2, 1], ['cat', 3, 1]], [['feel', 6]], ['shaker', 'arp', 'hum'], 'shake, sparkle, hum', 'takes: every placement counts'),
  G(1, 'Lullaby Market', 5, 9, -1, [], [['cool', 4], ['feel', 9]], [['bancat', 0]], ['pad', 'bells', 'ooh', 'hum'], 'a cloud, a chime, two ghosts', 'a hype cap: keep it calm'),
  G(1, 'Stall Rush', 5, 7, -1, [], [['hype', 11]], [['cat', 3, 1]], ['bap', 'wobble', 'riser', 'hey'], 'the loudest four', 'few takes: no wasted moves'),
  G(1, 'Duet Night', 3, 5, -1, [], [['cat', 3, 2], ['feel', 6]], [['cat', 0, 1]], ['la', 'ooh', 'mouth'], 'two voices and a beatboxer', 'three buds only'),
  G(1, 'One Man Band', 3, 5, -1, [], [['bancat', 3], ['hype', 6], ['feel', 3]], [['cat', 2, 1]], ['floor', 'marimba', 'bass'], 'no singing: dance, wood, low', 'three buds, both meters'),
  G(1, 'Tin Roof', 6, 10, -1, [], [['cat', 0, 2], ['cat', 1, 2], ['feel', 5]], [['cat', 2, 1]], ['shaker', 'mouth', 'claps', 'bleeps', 'whistle'], 'rattle and clap, beep and bird', 'big band, plenty of takes'),
  G(1, 'Crowd Surfer', 5, 8, -1, [], [['hype', 8], ['feel', 6]], [['id', 'whistle']], ['floor', 'marimba', 'hey', 'la'], 'dance, wood, shout, sing', 'balance hype and feel'),
  G(1, 'Fair Finale', 5, 7, -1, [], [['hype', 8], ['feel', 8], ['bancat', 1]], [['cat', 0, 1]], ['floor', 'hey', 'marimba', 'la'], 'dance, shout, wood, song', 'HARD: both meters, no effects, few takes', true),
  // ---- world 3 · Arena: the spotlight bud counts double (where you put a sound now matters), exact counts
  G(2, 'Spotlight', 4, 0, 0, [], [['hype', 10]], [['feel', 4]], ['bap', 'hey', 'marimba'], 'put your loudest in the light', 'the gold bud counts double'),
  G(2, 'Pick Your Star', 4, 8, 1, [], [['feel', 12]], [['cat', 2, 2]], ['pad', 'bells', 'la'], 'clouds, chimes, a song', 'which sound deserves the light?'),
  G(2, 'Front Man', 4, 6, 2, [], [['exact', 0, 1], ['hype', 9], ['feel', 5]], [['cat', 3, 1]], ['floor', 'hey', 'marimba'], 'one drummer, a shouter, wood', 'exactly one beat'),
  G(2, 'Loud And Soft', 5, 8, 0, [], [['hype', 12], ['feel', 9]], [['cat', 3, 1]], ['floor', 'hey', 'marimba', 'la'], 'both meters, doubled', 'the double lets you trade'),
  G(2, 'Exactly Two', 5, 8, 4, [], [['exact', 3, 2], ['exact', 2, 1], ['hype', 8]], [['cat', 1, 1]], ['hey', 'doo', 'marimba'], 'two singers, one tune', 'exact counts: not one more'),
  G(2, 'Backing Band', 5, 7, 3, [], [['bancat', 3], ['feel', 8], ['hype', 8]], [['cat', 2, 2]], ['floor', 'marimba', 'bells', 'bass'], 'no singing: just the band', 'no voices, both meters, tight takes'),
  G(2, 'Whisper Hall', 4, 6, 1, [], [['cool', 3], ['feel', 14]], [['cat', 3, 2]], ['pad', 'ooh', 'la'], 'barely louder than breath', 'a hype cap with the double'),
  G(2, 'Power Trio', 3, 5, 0, [], [['hype', 10], ['feel', 5]], [['cat', 2, 1]], ['floor', 'marimba', 'hey'], 'only three in the light', 'three buds, one doubled'),
  G(2, 'Full House', 7, 11, 3, [], [['cat', 0, 1], ['cat', 1, 1], ['cat', 2, 1], ['cat', 3, 1], ['hype', 14], ['feel', 12]], [['fill']], ['floor', 'riser', 'marimba', 'la'], 'seven buds, every kind', 'all seven buds, every kind'),
  G(2, 'Arena Night', 6, 8, 5, [], [['exact', 0, 2], ['hype', 13], ['feel', 9]], [['bancat', 1]], ['floor', 'bap', 'marimba', 'la'], 'two drummers and the whole crowd', 'HARD: the last gig of the tour', true),
];
