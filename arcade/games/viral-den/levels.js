// Viral Den v2: 30 hand-made videos in 3 worlds. A chart is one character per eighth note (spaces and | are only for
// reading; one bar = 8 steps). Clips slide along the timeline into the REC ring; tap as they land.
//   x tap clip      g golden clip (×3, a coin on PERFECT)    h long take (hold) with = for each extra step held
//   o troll comment (don't tap: let it pass)                 u swipe-up clip (tap and flick up)
//   p lag clip (fades out before the ring: keep the beat)    c collab guest note (plays itself; then echo it back)
//   ! trend spike: from here the tempo is ×1.25              ~ back to the normal tempo
//   . rest
// goal = share of a perfect run's followers needed to clear (1 star); 2 stars at 0.66, 3 stars at 0.86 (STARS in deep.js).
export const WORLDS = [
  { name: 'Bedroom Vlogs', icon: '🛏️', from: 1 },
  { name: 'Loft Streams', icon: '🎙️', from: 11 },
  { name: 'Studio Hits', icon: '🎬', from: 21 },
];

export const LEVELS = [
  // ---------------------------------------------------------------- world 1: Bedroom Vlogs (taps, rests, viral, doubles, golden)
  // 1 · intro: eight slow claps on the beat; can't fail (goal 25 %), ~12 s, the demo films the first two
  { title: "Hi, I'm Kai!", bpm: 80, goal: 0.08, chart: 'x.x.x.x. | x.x.x.x. | x.x.x.x. | x.x.x.x.' },
  // 2 · rests: the first "don't tap" moment (a beat of silence in every bar)
  { title: 'Morning routine', bpm: 88, goal: 0.28, chart: 'x.x.x... | x.x.x... | x.x.x.x. | x...x... | x.x.x... | x.x.x... | x.x.x.x. | x.x.x.x.' },
  // 3 · first one you can lose: a groove with an off-beat clip in each bar (flubs break the take)
  { title: 'Room tour', bpm: 92, goal: 0.3, chart: 'x.x..x.. | x.x..x.. | x...x.x. | x.x.x... | x.x..x.. | x.x..x.. | x...x.x. | x.x.x.x.' },
  // 4 · HYPE → VIRAL: a long steady run that fills the meter, then the beat drop pays x5
  { title: 'Trying the trend', bpm: 96, goal: 0.33, chart: 'x.x.x.x. | x.x.x.x. | x.x.x.x. | x.x.x.x. | x.x.x.x. | x.x.x.x. | x.x.x.x. | x.x.x.x. | x.x.x.x. | x.x.x.x.' },
  // 5 · practise: rests and off-beats together, a little faster
  { title: 'Desk setup', bpm: 104, goal: 0.3, chart: 'x.x.x... | ..x.x.x. | x...x..x | ..x.x... | x.x.x.x. | x...x..x | ..x...x. | x.x.x.x. | x.x.x... | x.x.x.x.' },
  // 6 · introduce double clips: two quick eighths, always on the same spot in the bar first
  { title: 'Cat reacts to…', bpm: 90, goal: 0.3, chart: 'x...xx.. | x...xx.. | x...xx.. | x.x.x... | x...xx.. | x...xx.. | xx..xx.. | x.x.x.x.' },
  // 7 · HARD: doubles on moving spots + syncopation at 108
  { title: 'Speed-cleaning', bpm: 108, goal: 0.54, hard: true, chart: 'x.xx.x.. | xx..x.x. | x.x.xx.. | ..xx..x. | x.xx.x.. | xx..x.x. | x..xx.x. | xx.xx... | x.x.xx.x | ..xx.x.. | x.xx..xx | x.x.x.x.' },
  // 8 · breather + introduce golden clips: slow, flashy, gold every bar
  { title: 'Unboxing… a sock?', bpm: 88, goal: 0.18, chart: 'g...x... | x.x.g... | g...x... | x.x.g... | x.x.x.x. | g.g.g... | x...g... | g.g.g.g.' },
  // 9 · practise: golden clips inside doubles (a gold on the second of a pair)
  { title: 'Snack taste test', bpm: 98, goal: 0.3, chart: 'x...xg.. | x...xg.. | x.x.g... | xx..x... | x...xg.. | xg..xg.. | x.x.x.x. | g.xx.g.. | x...xg.. | g.g.g.g.' },
  // 10 · HARD world finale: everything so far at 112
  { title: 'Late-night Q&A', bpm: 112, goal: 0.58, hard: true, chart: 'x.x.x.x. | x.xx.x.. | xx..xg.. | ..x.x.x. | x.xx..x. | g...xx.. | x.x..xx. | xx.x.x.. | x.x.xg.. | ..xx..x. | xx.xx.x. | g.x.g.x. | xx.x.xx. | g.g.g.g.' },

  // ---------------------------------------------------------------- world 2: Loft Streams (long takes, trolls, syncopation, spikes)
  // 11 · introduce long takes: hold the clip to the end of its bar, nothing else around it
  { title: 'Live: first stream', bpm: 90, goal: 0.4, chart: 'h===.... | h===.... | x.x.x.x. | h===.... | h===.... | x.x.h=== | ........ | h=====.. | x.x.x.x.' },
  // 12 · practise: takes between taps (let go in time for the next clip)
  { title: 'Plant care tips', bpm: 96, goal: 0.42, chart: 'x.x.h==. | x.x.h==. | h=..x.x. | h=..x.x. | x.h===.. | x.x.x.x. | h==.x.x. | x.h==.x. | x.x.h===' },
  // 13 · twist: takes + doubles + golden (hold, release, double)
  { title: 'Thrift haul', bpm: 100, goal: 0.38, chart: 'h==.xx.. | h==.xx.. | g...h==. | xx..g... | h==.xx.. | x.xx.g.. | h===..xx | g.h==.g. | xx.xx.g. | h=====..' },
  // 14 · introduce trolls: a 💀 comment in the rests; don't tap it, let it pass (😎)
  { title: 'Reading comments', bpm: 92, goal: 0.36, chart: 'x.x.o... | x.x.o... | x.o.x... | x.x.x.x. | x.x.o... | o...x.x. | x.o.x.o. | x.x.x.x.' },
  // 15 · practise: trolls on the off-beat between clips (read before you tap)
  { title: 'Hot take Tuesday', bpm: 100, goal: 0.4, chart: 'xox.x.x. | x.xox... | xoxox... | x.x.x.x. | x.xo.xx. | oxox.x.. | x.xo.x.o | xx.xo... | xoxox.x. | x.x.x.x.' },
  // 16 · HARD: takes + trolls + doubles at 110
  { title: 'Drama explained', bpm: 110, goal: 0.5, hard: true, chart: 'h==.xox. | xx.oh==. | x.xo.xx. | h==.oxx. | xox.h==. | g.oxx.o. | h==.xx.o | xoxoxx.. | h==.gox. | xx.oh==. | xoxoxox. | g.g.h===' },
  // 17 · breather: golden shower with long takes, slow and loud
  { title: 'Fan mail day', bpm: 88, goal: 0.3, chart: 'g.g.h==. | g.g.h==. | g...g... | h=====.. | g.g.g.g. | h==.g.g. | g.g.g.g.' },
  // 18 · introduce the trend spike: same groove, then the tempo jumps ×1.25 halfway
  { title: 'Trend alert!', bpm: 96, goal: 0.33, chart: 'x.x.x.x. | x.xx.x.. | x.x.x.x. | x.xx.x.. | !x.x.x.x. | x.xx.x.. | x.x.x.x. | x.xx.x.. | x.x.x.x.' },
  // 19 · practise: spike + trolls, back to normal at the end (~)
  { title: 'Reacting live', bpm: 100, goal: 0.36, chart: 'x.x.o.x. | xx.ox... | x.x.o.x. | h==.x.o. | !xox.x.x. | x.xox... | xoxox.x. | h==.xo.. | ~x.x.x.x. | g.g.g.g.' },
  // 20 · HARD world finale: takes, trolls, doubles, golden, two spikes
  { title: '24-hour stream', bpm: 108, goal: 0.62, hard: true, chart: 'x.xox.x. | h==.xx.o | xoxg.x.. | h==.oxx. | !xox.xxo. | x.xog.o. | h==.xox. | ~xx.ox.x. | h==.g.o. | !xoxoxx.. | x.xoh==. | ~g.g.g.g.' },

  // ---------------------------------------------------------------- world 3: Studio Hits (swipe-ups, lag clips, collab echo)
  // 21 · introduce swipe-ups: flick up to post, alone on the beat
  { title: 'Studio day one', bpm: 88, goal: 0.3, chart: 'u...u... | x.x.u... | u...u... | x.x.u... | x.x.x.x. | u.u.u... | x.x.x.u. | u...u...' },
  // 22 · practise: swipe after a long take (let go, then flick)
  { title: 'Glow-up edit', bpm: 96, goal: 0.42, chart: 'h==.u... | x.x.u... | h==.u.x. | xx..u... | h==.u... | x.u.x.u. | xx.xu... | h==.u.u. | x.x.u.u.' },
  // 23 · twist: swipes between trolls (only the arrows want a flick)
  { title: 'Ratio battle', bpm: 100, goal: 0.42, chart: 'u.o.x.x. | xou.x... | u.o.u.o. | x.x.x.x. | xox.u.o. | u.xox.u. | xxo.u... | u.u.o.u. | x.xou.x. | g.g.u.u.' },
  // 24 · introduce lag clips: they fade before the ring; the beat stays steady so you can count it
  { title: 'Bad wifi vlog', bpm: 90, goal: 0.33, chart: 'x.x.p.p. | x.x.p.p. | x.x.x.x. | p.p.p.p. | x.p.x.p. | x.x.p.p. | p.p.p.p. | x.x.x.x.' },
  // 25 · practise: lag doubles and lag on the off-beat
  { title: 'Train vlog', bpm: 98, goal: 0.36, chart: 'x.x.pp.. | x.x.pp.. | x.p..p.. | x.x.x.x. | x.pp.x.. | p.p.pp.. | x..px.p. | x.x.x.x. | pp..pp.. | g.g.g.g.' },
  // 26 · HARD: swipes + lag + a spike + trolls
  { title: 'Midnight premiere', bpm: 106, goal: 0.5, hard: true, chart: 'x.p.u.o. | xx.pu... | h==.p.u. | xop.x.u. | !x.p.u.o. | xxopu... | p.p.u.u. | h==.xop. | ~u.xpu.o. | g.p.g.u.' },
  // 27 · breather + introduce the collab echo: a guest plays four notes (purple), you play them back as lag clips
  { title: 'Collab with Mo', bpm: 90, goal: 0.3, chart: 'c.c.c.c. | p.p.p.p. | c.c.c... | p.p.p... | x.x.x.x. | c.c.cc.. | p.p.pp.. | g.g.g.g.' },
  // 28 · practise: syncopated echoes
  { title: 'Duet challenge', bpm: 96, goal: 0.36, chart: 'c.cc.c.. | p.pp.p.. | c..c.cc. | p..p.pp. | x.x.x.x. | cc.c.c.. | pp.p.p.. | c.c.cc.c | p.p.pp.p | g.g.g.g.' },
  // 29 · everything: echo, swipe, takes, trolls
  { title: 'Award show prep', bpm: 104, goal: 0.46, chart: 'x.xou.x. | c.c.cc.. | p.p.pp.. | h==.u.o. | xox.xx.u | c.cc.c.. | p.pp.p.. | !xoxu.xx. | h==.u.o. | ~g.g.u.g.' },
  // 30 · HARD finale medley: one bar of every idea, two spikes, a golden ending
  { title: 'The million party', bpm: 110, goal: 0.5, hard: true, chart: 'x.x.x.x. | x.xx.xx. | g.g.g... | h==.x.x. | xoxox.x. | u.xou.x. | c.c.cc.. | p.p.pp.. | !x.xx.u.. | h==.xox. | xpxpu.o. | ~c.cc.c.. | p.pp.p.. | !xxoxu.x. | ~g.g.g.g. | h=====..' },
];
