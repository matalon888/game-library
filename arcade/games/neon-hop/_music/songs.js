// songs.js — shared song book for the hc-games music games. Our own code, MIT.
// Only public-domain compositions (melodies written out by hand from the scores) and original tunes composed for this arcade.
// Each song is a compact score string that is parsed into a NOTE ARRAY: [startUnit, midi, durUnits].
//   unit  = subdivisions per beat (1 = quarter notes, 2 = eighths, 4 = sixteenths)
//   meter = beats per bar, bpm = beats per minute
//   mel   = "E5/2 D#5 r/2 ..." note name + octave, optional /duration in units (default 1); "r" = rest; "|" = bar line
//   chords = one entry per bar; "F.C" splits a bar in halves. Drives the bass, pad and drum arrangement.
//   style  = accompaniment groove: 'gentle' | 'pop' | 'waltz' | 'march' | 'drive'

const RAW = [
  { id: 'twinkle', title: 'Twinkle Twinkle', composer: 'Traditional', bpm: 100, unit: 1, meter: 4, style: 'gentle',
    mel: 'C5 C5 G5 G5 | A5 A5 G5/2 | F5 F5 E5 E5 | D5 D5 C5/2 | G5 G5 F5 F5 | E5 E5 D5/2 | G5 G5 F5 F5 | E5 E5 D5/2 | C5 C5 G5 G5 | A5 A5 G5/2 | F5 F5 E5 E5 | D5 D5 C5/2',
    chords: 'C | F.C | F.C | G.C | C.F | C.G | C.F | C.G | C | F.C | F.C | G.C' },
  { id: 'ode', title: 'Ode to Joy', composer: 'Beethoven', bpm: 116, unit: 2, meter: 4, style: 'pop',
    mel: 'E5/2 E5/2 F5/2 G5/2 | G5/2 F5/2 E5/2 D5/2 | C5/2 C5/2 D5/2 E5/2 | E5/3 D5 D5/4 | E5/2 E5/2 F5/2 G5/2 | G5/2 F5/2 E5/2 D5/2 | C5/2 C5/2 D5/2 E5/2 | D5/3 C5 C5/4 |' +
         'D5/2 D5/2 E5/2 C5/2 | D5/2 E5 F5 E5/2 C5/2 | D5/2 E5 F5 E5/2 D5/2 | C5/2 D5/2 G4/4 | E5/2 E5/2 F5/2 G5/2 | G5/2 F5/2 E5/2 D5/2 | C5/2 C5/2 D5/2 E5/2 | D5/3 C5 C5/4',
    chords: 'C | G | C | C.G | C | G | C | G.C | G | G.C | G.C | C.G | C | G | C | G.C' },
  { id: 'minuet', title: 'Minuet in G', composer: 'Petzold', bpm: 126, unit: 2, meter: 3, style: 'waltz',
    mel: 'D5/2 G4 A4 B4 C5 | D5/2 G4/2 G4/2 | E5/2 C5 D5 E5 F#5 | G5/2 G4/2 G4/2 | C5/2 D5 C5 B4 A4 | B4/2 C5 B4 A4 G4 | F#4/2 G4 A4 B4 G4 | A4/6 |' +
         'D5/2 G4 A4 B4 C5 | D5/2 G4/2 G4/2 | E5/2 C5 D5 E5 F#5 | G5/2 G4/2 G4/2 | C5/2 D5 C5 B4 A4 | B4/2 C5 B4 A4 G4 | A4/2 B4 A4 G4 F#4 | G4/6',
    chords: 'G | G | C | G | C | G | D | D | G | G | C | G | C | G | D | G' },
  { id: 'saints', title: 'When the Saints', composer: 'Traditional', bpm: 132, unit: 1, meter: 4, style: 'march',
    mel: 'r C5 E5 F5 | G5/4 | r C5 E5 F5 | G5/4 | r C5 E5 F5 | G5/2 E5/2 | C5/2 E5/2 | D5/4 | r E5 E5 D5 | C5/3 C5 | E5/2 G5/2 | G5 F5/3 | r E5 F5 G5 | E5/2 C5/2 | D5/2 D5/2 | C5/4',
    chords: 'C | C | C | C | C | C | C | G | C | C | F | F | C | C | G | C' },
  { id: 'canon', title: 'Canon in D', composer: 'Pachelbel', bpm: 84, unit: 2, meter: 4, style: 'gentle',
    mel: 'F#5/4 E5/4 | D5/4 C#5/4 | B4/4 A4/4 | B4/4 C#5/4 |' +
         'D5 F#5 A5 G5 F#5 D5 F#5 E5 | D5 B4 D5 A5 G5 B5 A5 G5 | F#5 D5 E5 C#6 D6 F#6 A6/2 | G6 E6 F#6 D6 C#6 E6 A5/2 |' +
         'F#6/2 A6/2 E6/2 A6/2 | D6/2 F#6/2 C#6/2 E6/2 | B5/2 D6/2 A5/2 D6/2 | B5/2 C#6/2 D6/4',
    chords: 'D.A | Bm.F#m | G.D | G.A | D.A | Bm.F#m | G.D | G.A | D.A | Bm.F#m | G.D | G.D' },
  { id: 'elise', title: 'Für Elise', composer: 'Beethoven', bpm: 132, unit: 2, meter: 3, style: 'waltz',
    mel: 'r/4 E5 D#5 | E5 D#5 E5 B4 D5 C5 | A4/2 r C4 E4 A4 | B4/2 r E4 G#4 B4 | C5/2 r E4 E5 D#5 | E5 D#5 E5 B4 D5 C5 | A4/2 r C4 E4 A4 | B4/2 r E4 C5 B4 | A4/4 E5 D#5 |' +
         'E5 D#5 E5 B4 D5 C5 | A4/2 r C4 E4 A4 | B4/2 r E4 G#4 B4 | C5/2 r E4 E5 D#5 | E5 D#5 E5 B4 D5 C5 | A4/2 r C4 E4 A4 | B4/2 r E4 C5 B4 | A4/6',
    chords: 'Am | Am | Am | E | Am | Am | Am | E | Am | Am | Am | E | Am | Am | Am | E | Am' },
  { id: 'cancan', title: 'Galop (Can-Can)', composer: 'Offenbach', bpm: 136, unit: 2, meter: 2, style: 'drive',
    mel: 'C5/2 D5 F5 | E5 D5 G5/2 | G5/2 G5 A5 | E5 F5 D5/2 | D5/2 D5 F5 | E5 D5 C5 C6 | B5 A5 G5 F5 | E5 D5 C5/2 |' +
         'C5/2 D5 F5 | E5 D5 G5/2 | G5/2 G5 A5 | E5 F5 D5/2 | D5/2 D5 F5 | E5 D5 C5 G5 | D5 E5 C5/2 | C6/4',
    chords: 'C | C | G | G | G | C | G | C | C | C | G | G | G | C | G | C' },
  { id: 'mountain', title: 'Hall of the Mountain King', composer: 'Grieg', bpm: 120, unit: 2, meter: 4, style: 'drive',
    mel: 'B4 C#5 D5 E5 F#5 D5 F#5/2 | F5 C#5 F5/2 E5 C5 E5/2 | B4 C#5 D5 E5 F#5 D5 F#5 B5 | A5 F#5 D5 F#5 A5/4 |' +
         'B4 C#5 D5 E5 F#5 D5 F#5/2 | F5 C#5 F5/2 E5 C5 E5/2 | B4 C#5 D5 E5 F#5 D5 F#5 B5 | A5 F#5 D5 F#5 B5/4 |' +
         'E5 F#5 G5 A5 B5 G5 B5/2 | A#5 F#5 A#5/2 A5 F5 A5/2 | E5 F#5 G5 A5 B5 G5 B5 E6 | D6 B5 G5 B5 D6/4',
    chords: 'Bm | C#.C | Bm | D | Bm | C#.C | Bm | Bm | Em | F#.F | Em | G' },
  { id: 'turkish', title: 'Rondo alla Turca', composer: 'Mozart', bpm: 116, unit: 4, meter: 2, style: 'march',
    mel: 'B4 A4 G#4 A4 C5/4 | D5 C5 B4 C5 E5/4 | F5 E5 D#5 E5 B5 A5 G#5 A5 | B5 A5 G#5 A5 C6/4 | A5/2 C6/2 B5/2 A5/2 | G#5/2 A5/2 B5/2 A5/2 | G#5/2 A5/2 B5/2 A5/2 | G#5/2 F#5/2 E5/4 |' +
         'B4 A4 G#4 A4 C5/4 | D5 C5 B4 C5 E5/4 | F5 E5 D#5 E5 B5 A5 G#5 A5 | B5 A5 G#5 A5 C6/4 | A5/2 C6/2 B5/2 A5/2 | G#5/2 E5/2 F#5/2 G#5/2 | A5/4 E5/4 | A4/8',
    chords: 'Am | Am | E.Am | Am | Am | E | E.Am | E | Am | Am | E.Am | Am | Am | E | Am.E | Am' },
  // ---- originals composed for this arcade
  { id: 'neon', title: 'Neon Drift', composer: 'Original', bpm: 118, unit: 2, meter: 4, style: 'pop',
    mel: 'A4/2 C5 E5 A5/2 G5 E5 | F5/2 E5 C5 A4/2 C5/2 | G4/2 C5 E5 G5/2 E5 C5 | D5/2 B4 G4 D5/4 | A5/2 G5 A5 C6/2 B5 A5 | A5/2 G5 F5 E5/2 C5/2 | E5 G5 E5 C5 D5/2 E5/2 | D5/2 E5 D5 B4/4 |' +
         'A4/2 C5 E5 A5/2 G5 E5 | F5/2 E5 C5 A4/2 C5/2 | G4/2 C5 E5 G5/2 E5 C5 | D5/2 B4 G4 D5/4 | A5 A5 G5 A5 C6/2 D6/2 | C6/2 A5 F5 C6/2 A5/2 | G5 E5 G5 C6 B5/2 G5/2 | A5/8',
    chords: 'Am | F | C | G | Am | F | C | G | Am | F | C | G | Am | F | C | Am' },
  { id: 'starlight', title: 'Starlight Run', composer: 'Original', bpm: 124, unit: 2, meter: 4, style: 'drive',
    mel: 'E5/2 G5/2 C6/2 G5/2 | D5 G5 B5/2 A5 G5 D5/2 | C5 E5 A5/2 G5 E5 C5/2 | F5/2 A5/2 G5/2 F5 E5 | E5 G5 C6 G5 E5 G5 C6/2 | B5/2 A5 G5 D6/4 | C6 B5 A5 E5 A5/2 G5 E5 | F5/2 A5/2 G5/4 |' +
         'E5/2 G5/2 C6/2 G5/2 | D5 G5 B5/2 A5 G5 D5/2 | C5 E5 A5/2 G5 E5 C5/2 | F5/2 A5/2 G5/2 F5 E5 | E5 G5 C6 G5 E5 G5 C6/2 | D6/2 C6 B5 G5/4 | A5 C6 A5 F5 G5/2 B5/2 | C6/8',
    chords: 'C | G | Am | F | C | G | Am | F.G | C | G | Am | F | C | G | F.G | C' },
];

// ---------------------------------------------------------------- parsing
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function noteToMidi(n) {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(n); if (!m) throw new Error('bad note ' + n);
  return 12 * (+m[3] + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
function chordNotes(name) {           // 'F#m' -> { root: pitch class, third, fifth }
  const m = /^([A-G])(#|b)?(m|7|dim)?$/.exec(name); if (!m) throw new Error('bad chord ' + name);
  const root = (PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
  const minor = m[3] === 'm' || m[3] === 'dim';
  return { name, root, tones: [0, minor ? 3 : 4, m[3] === 'dim' ? 6 : 7].map(i => (root + i) % 12) };
}
function parse(raw) {
  const barLen = raw.unit * raw.meter, notes = [];   // NOTE ARRAY: [startUnit, midi, durUnits]
  let u = 0;
  raw.mel.split('|').forEach((bar, bi) => {
    const start = u;
    for (const tok of bar.trim().split(/\s+/).filter(Boolean)) {
      const [n, d] = tok.split('/'); const dur = d ? +d : 1;
      if (n !== 'r') notes.push([u, noteToMidi(n), dur]);
      u += dur;
    }
    if (u - start !== barLen && typeof console !== 'undefined') console.warn(`[songs] ${raw.id} bar ${bi + 1} has ${u - start} units, expected ${barLen}`);
  });
  const bars = raw.chords.split('|').map(s => s.trim().split('.').map(chordNotes));
  return { ...raw, barLen, notes, bars, nBars: bars.length };
}
export const SONGS = RAW.map(parse);
export const SONG = Object.fromEntries(SONGS.map(s => [s.id, s]));

// ---------------------------------------------------------------- level planning
/** pick a song + length for a level. order = list of song ids for this game. Level 1 is ~10 s, growing ~6 s per level up to ~50 s. */
export function levelPlan(level, order = SONGS.map(s => s.id)) {
  const L = Math.max(1, level), song = SONG[order[(L - 1) % order.length]], cycle = Math.floor((L - 1) / order.length);
  const tempo = Math.min(1.45, 1 + 0.03 * (L - 1) + 0.06 * cycle);
  const barSec = song.meter * 60 / (song.bpm * tempo);
  const target = Math.min(50, 9.5 + (L - 1) * 6.5);
  let bars = Math.max(4, Math.round(target / barSec / 4) * 4);
  if (song.nBars % 4 === 1 && bars >= song.nBars - 1) bars = Math.max(bars, song.nBars);   // songs with a pickup bar
  return { song, bars, tempo, cycle };
}

// ---------------------------------------------------------------- arrangement → absolute times (seconds)
/**
 * arrange(song, { bars, tempo, ramp, density }) → track
 *   track.melody: [{ t, dur, midi, i }]   every melody note with its time in seconds from the first downbeat
 *   track.beats:  [{ t, bar, beat, down }]  every beat (down = first beat of a bar)
 *   track.acc:    accompaniment events { t, kind: 'kick'|'snare'|'hat'|'bass'|'pad', midi?, dur?, vol? }
 *   track.length: seconds until the end of the last bar; track.barTimes: start time of each bar
 * The song loops if bars > song length. ramp = extra tempo added linearly across the track (0.1 = +10% by the end).
 */
export function arrange(song, { bars = song.nBars, tempo = 1, ramp = 0, density = 1 } = {}) {
  const barTimes = [], beats = [], melody = [], acc = [];
  let t = 0;
  const spb = (bar) => 60 / (song.bpm * tempo * (1 + ramp * bar / Math.max(1, bars)));
  for (let b = 0; b < bars; b++) {
    barTimes.push(t);
    const sb = spb(b), su = sb / song.unit, srcBar = b % song.nBars, lastBar = b === bars - 1;
    for (let k = 0; k < song.meter; k++) beats.push({ t: t + k * sb, bar: b, beat: k, down: k === 0 });
    // melody notes in this bar
    for (const [u, midi, d] of song.notes) {
      const bar = Math.floor(u / song.barLen); if (bar !== srcBar) continue;
      const off = u - bar * song.barLen;
      let dur = d * su; if (lastBar) dur = Math.max(dur, (song.barLen - off) * su);
      melody.push({ t: t + off * su, dur, midi, i: melody.length });
    }
    // accompaniment
    const chords = song.bars[srcBar], half = song.meter * sb / chords.length;
    chords.forEach((c, ci) => {
      const ct = t + ci * half, root = 36 + c.root;
      acc.push({ t: ct, kind: 'pad', midi: c.tones.map(pc => 55 + ((pc - 7 + 12) % 12)), dur: half * 0.98 });
      bassPattern(song.style, root, ct, half, sb, acc, density);
    });
    drumPattern(song.style, song.meter, t, sb, acc, density, lastBar);
    t += song.meter * sb;
  }
  const last = melody[melody.length - 1];
  return { song, melody, beats, acc, barTimes, length: Math.max(t, last ? last.t + last.dur : t), bars, tempo };
}
function bassPattern(style, root, t, len, sb, acc, density) {
  const push = (dt, m, d, v = 1) => { if (dt < len - 0.01) acc.push({ t: t + dt, kind: 'bass', midi: m, dur: d, vol: v }); };
  if (style === 'gentle') { push(0, root, len * 0.9); return; }
  if (style === 'waltz') { push(0, root, sb * 0.9); return; }
  if (style === 'march') { for (let k = 0; k * sb < len - 0.01; k++) push(k * sb, k % 2 ? root + 7 : root, sb * 0.7); return; }
  // pop / drive: eighth-note pulse with an octave pop
  const e = sb / 2;
  for (let k = 0; k * e < len - 0.01; k++) push(k * e, k % 4 === 3 && density > 0.5 ? root + 12 : root, e * 0.8, k % 2 ? 0.7 : 1);
}
function drumPattern(style, meter, t, sb, acc, density, lastBar) {
  const d = (dt, kind, vol = 1) => acc.push({ t: t + dt, kind, vol });
  if (lastBar) { d(0, 'kick'); d(0, 'crash', 0.8); return; }
  for (let k = 0; k < meter; k++) {
    const bt = k * sb;
    if (style === 'gentle') { if (k === 0) d(bt, 'kick', 0.8); if (k === 2 && meter === 4) d(bt, 'kick', 0.5); d(bt, 'hat', 0.35); if (density > 0.6) d(bt + sb / 2, 'hat', 0.2); continue; }
    if (style === 'waltz') { if (k === 0) d(bt, 'kick'); else d(bt, 'hat', 0.55); if (k === meter - 1 && density > 0.6) d(bt, 'snare', 0.35); continue; }
    if (style === 'march') { d(bt, k % 2 ? 'snare' : 'kick', 0.9); d(bt + sb / 2, 'hat', 0.4); continue; }
    // pop / drive
    if (k % 2 === 0 || style === 'drive') d(bt, 'kick'); else d(bt, 'snare');
    if (style === 'drive' && k % 2) d(bt, 'snare', 0.9);
    d(bt + sb / 2, 'hat', 0.55); if (density > 0.7) d(bt, 'hat', 0.25);
  }
}

/**
 * chart helper: merge melody notes into playable "hits" at least minGap apart.
 * Each hit = { t, dur (to next hit), midi, notes: [{ midi, dt, dur }] } — the first note is the hit, the rest ride along.
 */
export function hits(track, minGap = 0.22) {
  const out = [];
  for (const n of track.melody) {
    const prev = out[out.length - 1];
    if (prev && n.t - prev.t < minGap) { prev.notes.push({ midi: n.midi, dt: n.t - prev.t, dur: n.dur }); continue; }
    out.push({ t: n.t, midi: n.midi, noteDur: n.dur, notes: [{ midi: n.midi, dt: 0, dur: n.dur }] });
  }
  for (let i = 0; i < out.length; i++) out[i].dur = (out[i + 1] ? out[i + 1].t : track.length) - out[i].t;
  return out;
}
