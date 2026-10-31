// Chilly Chute v2: 30 hand-made chutes in 3 worlds (studio, 2026-10-31). Original runs, designed for this game.
// A level is a list of hand-picked PHRASES (short authored obstacle runs); each phrase is rows "gap:abc" where gap = metres
// since the previous row and a, b, c are the left / middle / right lane.
//   .  empty            o  coin line ending at the row      O  coin arc (take a ramp or jump)   *  gem (3rd star)
//   S C R  block (snowman / crates / rock): change lane, or smash it while boosting
//   w f    low wall / fence: jump (or change lane)         G  log across the lane: jump
//   B      duck bar: duck in that lane                      ^  speed pad: boost (smashes everything for ~2 s)
//   /      ramp: big air + a flip                          M  snow roller sweeping across the chute: jump it or time it
//   b      rolling snowball coming up the chute: change lane
// A "~" after a phrase name mirrors it left-right. Every row leaves a way through (qa/check.mjs proves it), except wall rows
// directly after a full row of pads "^^^": those are smash walls (the boost is guaranteed, so they can't be missed).
export const WORLDS = [
  { name: 'Pine Pass', theme: 0, idea: 'lanes, jumps, limbo, ramps and speed pads' },
  { name: 'Frost Falls', theme: 3, idea: 'snow rollers that sweep the chute, chained pads' },
  { name: 'Glacier Gauntlet', theme: 4, idea: 'rolling snowballs, ice tunnels, no breathing room' },
];

export const PHRASES = {
  // ---- coins and breathers
  coins: ['14:o..', '9:.o.', '9:..o', '9:.o.'],
  weave: ['14:..o', '8:.o.', '8:o..', '8:.o.', '8:..o'],
  line: ['14:.o.', '8:.o.', '8:.o.'],
  // ---- blocks (lane changes)
  one: ['16:.S.'],
  side: ['16:S..'],
  pair: ['16:S.S'],
  stairs: ['15:S..', '12:.S.', '12:..S'],
  wedge: ['16:SS.', '15:.SS'],
  rocks: ['15:R.R', '12:.C.', '12:S.S'],
  gap: ['16:SSo'],
  // ---- jumps
  log: ['16:GGG', '10:o.o'],
  hop: ['16:fff', '12:.o.'],
  wall: ['16:w.w', '12:.w.'],
  walls3: ['16:fff', '14:www'],
  hopcoin: ['16:fff', '5:.O.', '5:.O.'],
  // ---- ducking
  bar: ['16:SSB', '12:o..'],
  limbo: ['16:SBS'],
  limbo2: ['16:BSS', '16:SSB'],
  barwall: ['16:BBS', '14:SBB'],
  // ---- speed pads and smash walls
  pad: ['16:.^.', '8:o.o'],
  padall: ['16:^^^', '9:...', '9:CCC', '10:o.o'],
  padgem: ['16:^^^', '9:S*S', '10:CCC', '9:o.o'],
  padlong: ['16:^^^', '9:SSS', '9:CCC', '9:RRR', '10:.o.'],
  // ---- ramps
  ramp: ['16:/..', '20:...', '8:.o.'],
  rampmid: ['16:./.', '20:...'],
  rampcoin: ['16:./.', '3:.O.', '4:.O.', '4:.O.', '4:.O.', '14:...'],
  rampgem: ['16:/..', '4:O..', '4:*..', '4:O..', '16:...'],
  // ---- gems in risky places
  gemjump: ['16:fff', '10:.*.'],
  gemside: ['16:S*S', '12:S.S'],
  gembar: ['16:SB*', '14:...'],
  // ---- mixed
  zig: ['15:S..', '12:.S.', '12:..S', '12:.S.', '12:S..'],
  jumpduck: ['16:GGG', '14:SSB'],
  duckjump: ['16:SBS', '14:fff'],
  mix1: ['16:S.S', '12:.w.', '13:B..', '13:.SS'],
  mix2: ['16:w.S', '13:.BS', '13:fff', '14:SS.'],
  slalom: ['14:S..', '11:.S.', '11:..S', '11:.S.', '11:S..', '11:.S.'],
  // ---- world 2: snow rollers (jump them or time the lane)
  roller: ['18:.M.'],
  roller2: ['18:.M.', '16:.M.'],
  rollerpad: ['18:^^^', '12:CCC', '14:.M.'],
  rollerblock: ['18:.M.', '14:S.S'],
  rollerjump: ['18:.M.', '15:fff'],
  rollerduck: ['18:.M.', '17:SSB'],
  rollercoin: ['18:.M.', '4:.o.', '4:.o.'],
  chainpad: ['16:.^.', '10:S.S', '10:^^^', '10:CCC', '9:RRR', '10:o.o'],
  // ---- world 3: snowballs and tunnels
  ball: ['18:.b.'],
  balls: ['18:b.b', '14:.b.'],
  ballrun: ['18:b..', '12:.b.', '12:..b'],
  tunnel: ['16:BBB', '12:o.o'],
  tunnels: ['16:BBB', '14:BBB'],
  tunneljump: ['16:BBB', '13:fff'],
  gauntlet: ['16:b.S', '12:.B.', '12:S.b', '12:fff'],
  frost: ['15:b.S', '13:.b.', '13:S.b', '13:.b.'],
};

// speed: base chute speed in m/s (the tuner factor still applies on top); chain/pads decide the rest.
export const LEVELS = [
  // ============================== WORLD 1: PINE PASS (core verb: lanes, jump, duck; pads and ramps)
  { n: 'First Slide', w: 1, sp: 17, why: 'nothing can hurt you: coins, pads, and a crate wall you smash', seq: ['coins', 'weave', 'padall', 'coins', 'padall'], seq2: ['weave','padall'] },
  { n: 'Hop Along', w: 1, sp: 17.5, why: 'introduce the jump: logs you can only hop', seq: ['coins', 'log', 'weave', 'log', 'hop', 'padall'], seq2: ['log','hop','padall'] },
  { n: 'Dodge', w: 1, sp: 18, why: 'first level you can lose: blocks, change lane; chain stunts for a SURGE', seq: ['one', 'pair', 'stairs', 'weave', 'wedge', 'pair~', 'padgem'], seq2: ['stairs~','one','wedge~','pair','weave','stairs','padgem'] },
  { n: 'Wall Walk', w: 1, sp: 18.5, why: 'low walls: jump or go around', seq: ['wall', 'hop', 'one', 'wall~', 'stairs~', 'hopcoin', 'padall'], seq2: ['wall~','hopcoin','wall','stairs','hop','one~','wall','padall'] },
  { n: 'Limbo', w: 1, sp: 19, why: 'introduce the duck bar', seq: ['bar', 'limbo', 'coins', 'bar~', 'one', 'limbo2', 'padgem'], seq2: ['limbo2','coins','bar','limbo','one','bar~','limbo2','padgem'] },
  { n: 'Big Air', w: 1, sp: 19, why: 'introduce ramps: air, a flip and a coin arc', seq: ['ramp', 'one', 'rampcoin', 'stairs', 'rampmid', 'wall', 'rampcoin'], seq2: ['rampmid','stairs~','ramp','wall','rampcoin','one','rampgem','pad'] },
  { n: 'Gem Hunt', w: 1, sp: 19.5, why: 'gems sit in risky spots: the 3rd star', seq: ['gemjump', 'rampgem', 'gemside', 'padgem', 'gembar', 'wedge~', 'gemjump'], seq2: ['gembar','gemside','rampgem','padgem','gemjump','wedge','gemside','pad'] },
  { n: 'Switchback', w: 1, sp: 20, why: 'hard lane work: zigzags that never repeat', seq: ['zig', 'wedge', 'zig~', 'rocks', 'slalom', 'limbo', 'pad'], seq2: ['wedge~','rocks','zig','slalom','limbo2','zig~','wedge','padall'] },
  { n: 'Combo Run', w: 1, sp: 20, why: 'jump into duck into jump: chain 5 for a SURGE', seq: ['jumpduck', 'duckjump', 'mix1', 'pad', 'jumpduck~', 'mix2', 'rampcoin', 'padall'], seq2: ['mix1','jumpduck','rampcoin','duckjump','mix2','pad','mix1','jumpduck~','padall'] },
  { n: 'Pine Pass Boss', w: 1, sp: 21, hard: 1, why: 'HARD: every trick in a row, the longest run so far', seq: ['slalom', 'mix2', 'limbo2', 'rampgem', 'walls3', 'mix1', 'barwall', 'padgem', 'zig~', 'jumpduck', 'rampcoin', 'padlong'], seq2: ['slalom','duckjump','mix2','rampcoin','barwall','walls3','zig','limbo2','mix1','jumpduck','padgem','zig~','rampgem','mix2','padlong'] },
  // ============================== WORLD 2: FROST FALLS (snow rollers sweep the chute; chained pads)
  { n: 'Roller Intro', w: 2, sp: 20.5, why: 'a roller sweeps across: jump it or time the lane', seq: ['coins', 'roller', 'weave', 'roller', 'roller', 'padall'], seq2: ['coins','roller','one','roller','rollerblock','padall','roller','padall'] },
  { n: 'Roll & Hop', w: 2, sp: 21, why: 'rollers with a low wall behind: jump twice', seq: ['roller', 'rollerjump', 'weave', 'rollerjump', 'hopcoin', 'padgem'], seq2: ['rollerjump','weave','rollerblock','hopcoin','rollerjump','roller','rollercoin','padgem'] },
  { n: 'Chain Pads', w: 2, sp: 21.5, why: 'pads in a row: smash a whole street of crates', seq: ['pad', 'chainpad', 'one', 'roller', 'chainpad', 'coins', 'padlong'], seq2: ['padgem','roller','chainpad','rollerblock','pair','chainpad','roller2','padlong'] },
  { n: 'Under the Roller', w: 2, sp: 22, why: 'duck after a roller: look ahead', seq: ['rollerduck', 'limbo', 'rollerduck', 'barwall', 'rollercoin', 'padgem'], seq2: ['barwall','rollerduck','limbo2','rollercoin','rollerduck','limbo','roller2','padgem'] },
  { n: 'Slush Slalom', w: 2, sp: 22, why: 'slalom with a roller in the middle of it', seq: ['slalom', 'rollerblock', 'zig~', 'roller', 'wedge', 'rollerblock', 'pad'], seq2: ['rollerblock','zig','roller2','slalom','rollerblock','wedge~','rollerjump','padall'] },
  { n: 'Air Falls', w: 2, sp: 22, why: 'ramps over rollers: stay in the air, rack up the chain', seq: ['rampcoin', 'rollercoin', 'rampgem', 'roller2', 'rampcoin', 'rollerjump', 'padall'], seq2: ['rampgem','roller2','rampcoin','rollerblock','ramp','rollercoin','rollerjump','pad'] },
  { n: 'Frozen Gems', w: 2, sp: 22.5, why: 'gems behind rollers and bars: risk for the 3rd star', seq: ['gemjump', 'rollerblock', 'gembar', 'rampgem', 'gemside', 'roller2', 'padgem', 'gemjump'], seq2: ['gembar','roller2','gemjump','rampgem','rollerblock','gemside','rollerjump','padgem','gembar'] },
  { n: 'Double Time', w: 2, sp: 23, why: 'two rollers back to back and walls that need a jump right away', seq: ['roller2', 'rollerjump', 'mix2', 'roller2', 'duckjump', 'jumpduck', 'pad'], seq2: ['rollerduck','mix1','roller2','duckjump','rollerblock','jumpduck','roller2','mix2','pad'] },
  { n: 'Cold Snap', w: 2, sp: 23, why: 'everything from this world at once, no coins to rest on', seq: ['rollerduck', 'rollerblock', 'zig', 'rollerjump', 'walls3', 'mix1', 'roller2', 'padgem', 'barwall'], seq2: ['rollerblock','mix2','rollerduck','zig~','roller2','walls3','rollerjump','barwall','padall'] },
  { n: 'Frost Falls Boss', w: 2, sp: 24, hard: 1, why: 'HARD: rollers, pads and ramps, one long breath', seq: ['roller2', 'rollerpad', 'mix2', 'rampgem', 'rollerduck', 'slalom', 'rollerjump', 'chainpad', 'barwall', 'rollerblock', 'rampcoin', 'padlong'], seq2: ['barwall','rollerblock','mix1','roller2','zig','rollerjump','duckjump','rollerduck','chainpad','rampgem','roller2','slalom','padlong'] },
  // ============================== WORLD 3: GLACIER GAUNTLET (snowballs roll at you, ice tunnels, little breathing room)
  { n: 'Snowball!', w: 3, sp: 23, why: 'a snowball rolls up the chute: move out of its lane', seq: ['coins', 'ball', 'weave', 'ball', 'balls', 'padall'], seq2: ['ball','one','ball','weave','balls','ball','padall','balls'] },
  { n: 'Tunnel Time', w: 3, sp: 23.5, why: 'ice tunnels cover every lane: just duck', seq: ['tunnel', 'ball', 'tunnel', 'weave', 'tunnels', 'padgem'], seq2: ['tunnel','ballrun','tunnel','ball','tunnels','weave','tunnel','padgem'] },
  { n: 'Ball Run', w: 3, sp: 24, why: 'three balls in three lanes, one after the other', seq: ['ballrun', 'one', 'ballrun', 'tunnel', 'ballrun', 'pad'], seq2: ['ball','ballrun','ball','pair','ballrun','tunnel','balls','pad'] },
  { n: 'Duck & Dive', w: 3, sp: 24, why: 'tunnels then a jump: land and duck again', seq: ['tunneljump', 'ball', 'tunneljump', 'barwall', 'tunnel', 'rampcoin', 'padall'], seq2: ['tunneljump','ballrun','barwall','tunnel','rampcoin','ball','tunneljump','padgem'] },
  { n: 'Glacier Run', w: 3, sp: 24.5, why: 'rolling balls with blocks in the free lanes', seq: ['gauntlet', 'balls', 'frost', 'zig', 'gauntlet~', 'padgem'], seq2: ['frost','gauntlet~','balls','zig~','frost','gauntlet','tunnel','padall'] },
  { n: 'Roller Derby', w: 3, sp: 25, why: 'snow rollers and snowballs together', seq: ['rollerblock', 'balls', 'rollerduck', 'ball', 'rollerjump', 'balls', 'pad'], seq2: ['balls','rollerjump','ball','rollerduck','rollerblock','balls','roller2','pad'] },
  { n: 'Gem Gorge', w: 3, sp: 25, why: 'gems under balls and bars, tunnels between', seq: ['gemjump', 'balls', 'gembar', 'tunnel', 'rampgem', 'frost', 'padgem', 'gemside'], seq2: ['gemjump','frost','gembar','tunneljump','rampgem','balls','gemside','padgem'] },
  { n: 'No Breath', w: 3, sp: 25.5, why: 'half the gaps you are used to', seq: ['frost', 'gauntlet', 'tunneljump', 'rollerjump', 'frost', 'barwall', 'mix2', 'padall'], seq2: ['gauntlet','frost','tunnels','mix2','rollerduck','frost','rollerjump','ballrun','padall'] },
  { n: 'Ice Maze', w: 3, sp: 26, why: 'the longest hand-made run of rolling traps', seq: ['ballrun', 'rollerblock', 'tunnels', 'gauntlet~', 'frost', 'rollerduck', 'walls3', 'ballrun', 'chainpad', 'padgem'], seq2: ['rollerjump','frost','balls','tunnels','gauntlet~','mix1','rollerblock','walls3','frost','padgem'] },
  { n: 'Glacier Boss', w: 3, sp: 27, hard: 1, why: 'HARD: all three worlds in one run, then the finish', seq: ['slalom', 'rollerpad', 'tunneljump', 'frost', 'rampgem', 'gauntlet', 'rollerduck', 'balls', 'barwall', 'chainpad', 'frost', 'tunnels', 'rampcoin', 'padlong'], seq2: ['slalom','gauntlet','rollerpad','frost','tunneljump','rampgem','ballrun','barwall','rollerjump','chainpad','tunnels','frost','gauntlet~','padlong'] },
];

// suits unlocked by stars (cosmetic only: tube, coat, hat)
export const SUITS = [
  { name: 'Candy', stars: 0, tube: '#ff3f8e', coat: '#ffb703', hat: '#e63946' },
  { name: 'Mint', stars: 6, tube: '#2ec27e', coat: '#ff6b6b', hat: '#3a86ff' },
  { name: 'Sunset', stars: 14, tube: '#ffb000', coat: '#7b5cff', hat: '#ff5d8f' },
  { name: 'Ocean', stars: 24, tube: '#00b4d8', coat: '#ff4d6d', hat: '#ffd166' },
  { name: 'Grape', stars: 36, tube: '#9b5de5', coat: '#00bbf9', hat: '#f15bb5' },
  { name: 'Lava', stars: 48, tube: '#ff4a1c', coat: '#2b2d42', hat: '#ffd23f' },
  { name: 'Ghost', stars: 60, tube: '#e8f4ff', coat: '#b9a7ff', hat: '#6c5ce7' },
  { name: 'Gold', stars: 75, tube: '#ffd23f', coat: '#ffffff', hat: '#e63946' },
];

// expand a level into rows: [{ d, row }] with absolute distance; also returns the length of the run
export function expand(lv) {
  const rows = []; let d = 30;
  let mid = 0;
  for (const name of lv.seq.concat(['|'], lv.seq2 || [])) {
    if (name === '|') { mid = d + 4; continue; }
    const mir = name.endsWith('~'), key = mir ? name.slice(0, -1) : name;
    const ph = PHRASES[key]; if (!ph) throw new Error('no phrase ' + key);
    for (const r of ph) { const [g, s] = r.split(':'); d += +g; rows.push({ d, row: mir ? [...s].reverse().join('') : s }); }
  }
  return { rows, length: d + 40, mid };
}
