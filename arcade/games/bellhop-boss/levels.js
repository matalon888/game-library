// Bellhop Boss deep v2 — 30 hand-made hotels in 3 worlds (plan: DESIGN.md).
// A hotel = what is for sale (pads, in the order they are best bought: each room pad adds the next room), who checks in
// (mix weights: t tourist, r rusher ⚡, v VIP 👑 (needs a free Suite), c critic 🧐 (walkout = 2 bad reviews)), how fast
// they come (gap s), how long they wait (pat s), and what the 3rd star asks (par s, no walkouts).
//   pads: [kind, cost]  kind: room | suite | recep | maid | speed | kitchen | cook
//   svc: chance a sleeping guest orders room service (needs the kitchen pad bought first)
//   brk: chance a room breaks after checkout (🔧 fix it by standing in it)
//   waves: [[second, count, kind]] coach arrivals
//   bills: bills a tourist pays (1 bill = $5); safe: nobody walks out (first levels)
export const WORLDS = [
  { name: 'Seaside Inns', icon: '🏖️', out: '#9fe0a0', sky: '#bde8ff' },
  { name: 'Mountain Lodges', icon: '🏔️', out: '#e6f2fb', sky: '#cfe4f7' },
  { name: 'Grand City', icon: '🌆', out: '#8a93a6', sky: '#8fa6d6' },
];
export const LEVELS = [
  // ---- World 1 · Seaside Inns: walk, check in, clean, hire, serve rushers, room service, the first coach
  { name: 'Sunny Inn', why: 'intro: check in a guest, scoop the cash, buy room 2 (cannot lose)', safe: true, bills: 2, gap: 3.2, pat: 90, par: 45,
    pads: [['room', 5], ['recep', 20]], mix: { t: 1 } },
  { name: 'Sunny Inn II', why: 'dirty rooms: stand in a messy room to clean it; hire a housekeeper (cannot lose)', safe: true, bills: 3, gap: 3.6, pat: 60, par: 60,
    pads: [['room', 15], ['recep', 35], ['room', 35], ['maid', 45]], mix: { t: 1 } },
  { name: 'Pier Inn', why: 'first busy lobby: guests can walk out, so keep the desk covered', bills: 3, gap: 2.4, pat: 40, par: 60,
    pads: [['room', 15], ['recep', 30], ['room', 35], ['maid', 45], ['speed', 45]], mix: { t: 1 } },
  { name: 'Surf Hostel', why: 'introduce rushers ⚡: they pay double if you check them in fast', bills: 3, gap: 2.1, pat: 26, par: 50,
    pads: [['room', 20], ['recep', 35], ['room', 40], ['maid', 50], ['room', 60]], mix: { t: 4, r: 3 } },
  { name: 'Dune Motel', why: 'practise rushers: a busier desk, one housekeeper to share the work', bills: 3, gap: 1.9, pat: 24, par: 70,
    pads: [['room', 15], ['room', 30], ['recep', 40], ['maid', 55], ['room', 65], ['speed', 50]], mix: { t: 3, r: 3 } },
  { name: 'Bay Lodge', why: 'introduce room service 🍽️: grab a tray at the kitchen, carry it up for a tip', bills: 3, gap: 2.3, pat: 26, par: 125, svc: 0.23,
    pads: [['room', 20], ['kitchen', 35], ['recep', 45], ['room', 55], ['maid', 65], ['room', 80]], mix: { t: 3, r: 2 } },
  { name: 'Lagoon Lodge', why: 'practise room service with rushers: serve, clean, deliver, buy', bills: 4, gap: 3.1, pat: 37, par: 115, svc: 0.27,
    pads: [['room', 25], ['kitchen', 35], ['recep', 35], ['room', 45], ['maid', 45], ['room', 70], ['room', 80]], mix: { t: 3, r: 3 } },
  { name: 'Palm Court', why: 'twist: the first tour coach 🚌 drops a crowd, so be ready at the desk', bills: 4, gap: 3.1, pat: 38, par: 160, svc: 0.18,
    pads: [['room', 15], ['kitchen', 35], ['recep', 45], ['room', 50], ['maid', 70], ['room', 75], ['speed', 70]], mix: { t: 3, r: 2 }, waves: [[28, 5, 't'], [62, 5, 'r']] },
  { name: 'Grand Seaside', hard: true, why: 'HARD: everything at once, two coaches and a thin lobby', bills: 4, gap: 2.9, pat: 35, par: 220, svc: 0.3,
    pads: [['room', 15], ['kitchen', 30], ['recep', 40], ['room', 50], ['maid', 70], ['room', 80], ['room', 95], ['cook', 90]], mix: { t: 3, r: 3 }, waves: [[24, 4, 'r'], [58, 5, 't']] },
  { name: 'Sunset Suites', why: 'breather: pay day, big tips, a flashy finish to the first world', bills: 6, gap: 2.2, pat: 48, par: 140, svc: 0.3,
    pads: [['room', 30], ['kitchen', 30], ['recep', 30], ['room', 30], ['maid', 45], ['room', 60], ['cook', 60]], mix: { t: 3, r: 2 } },
  // ---- World 2 · Mountain Lodges: VIPs and suites, repairs, bigger coaches
  { name: 'Pine Cabin', why: 'introduce VIPs 👑 and the Suite: they only come when a suite is free, and pay 4x', bills: 3, gap: 2.4, pat: 34, par: 80,
    pads: [['room', 30], ['suite', 55], ['recep', 55], ['maid', 80], ['room', 80]], mix: { t: 4, v: 2 } },
  { name: 'Cedar Cabin', why: 'practise suites: keep one clean for the next VIP', bills: 3, gap: 2.2, pat: 31, par: 150,
    pads: [['room', 25], ['suite', 45], ['recep', 45], ['room', 60], ['maid', 70], ['suite', 90]], mix: { t: 4, r: 2, v: 2 } },
  { name: 'Frost Chalet', why: 'VIPs order room service: a suite tray pays a big tip', bills: 4, gap: 3.5, pat: 38, par: 245, svc: 0.22,
    pads: [['room', 25], ['suite', 45], ['kitchen', 40], ['recep', 55], ['room', 70], ['maid', 75], ['cook', 85]], mix: { t: 3, r: 2, v: 3 } },
  { name: 'Ski Lift Lodge', why: 'a coach full of skiers meets the VIP suite: plan the rooms', bills: 4, gap: 2.7, pat: 34, par: 175, svc: 0.17,
    pads: [['room', 25], ['suite', 45], ['kitchen', 40], ['recep', 55], ['room', 70], ['maid', 80], ['room', 95]], mix: { t: 3, r: 2, v: 2 }, waves: [[26, 5, 't'], [64, 4, 'v']] },
  { name: 'Fireside Lodge', why: 'introduce repairs 🔧: some rooms break when a guest leaves; stand in them to fix', bills: 4, gap: 2.4, pat: 34, par: 205, brk: 0.3,
    pads: [['room', 20], ['suite', 45], ['recep', 55], ['room', 70], ['maid', 80], ['room', 100], ['speed', 70]], mix: { t: 4, r: 2, v: 2 } },
  { name: 'Glacier Inn', why: 'repairs while rushers queue: decide what to leave waiting', bills: 4, gap: 3.4, pat: 39, par: 205, brk: 0.26, svc: 0.18,
    pads: [['room', 25], ['suite', 50], ['kitchen', 40], ['recep', 65], ['room', 85], ['maid', 95], ['room', 115]], mix: { t: 3, r: 3, v: 2 } },
  { name: 'Snowdrift B&B', why: 'twist: two coaches of rushers and a full house, so staff early', bills: 5, gap: 2.9, pat: 32, par: 190, brk: 0.2,
    pads: [['room', 15], ['suite', 40], ['recep', 45], ['maid', 55], ['room', 70], ['suite', 95], ['room', 110], ['speed', 70]], mix: { t: 2, r: 3, v: 2 }, waves: [[30, 5, 'r'], [70, 5, 'r']] },
  { name: 'Alpine Spa', why: 'a long shopping list: staff everywhere, then room service for the VIPs', bills: 5, gap: 3.3, pat: 37, par: 275, brk: 0.2, svc: 0.25,
    pads: [['room', 15], ['suite', 30], ['kitchen', 30], ['recep', 45], ['room', 65], ['maid', 70], ['suite', 90], ['cook', 80], ['room', 100]], mix: { t: 3, r: 2, v: 3 } },
  { name: 'Summit Hotel', hard: true, why: 'HARD: repairs, coaches, VIPs and room service on thin patience', bills: 5, gap: 3.3, pat: 35, par: 290, brk: 0.3, svc: 0.21,
    pads: [['room', 15], ['suite', 35], ['kitchen', 35], ['recep', 55], ['room', 75], ['maid', 90], ['suite', 110], ['room', 120], ['cook', 95]], mix: { t: 2, r: 3, v: 3 }, waves: [[26, 4, 'r'], [62, 4, 'v'], [100, 4, 't']] },
  { name: 'Cozy Hearth', why: 'breather: warm and generous, big tips and an easy lobby', bills: 7, gap: 2.2, pat: 48, par: 245, svc: 0.42,
    pads: [['room', 20], ['suite', 25], ['kitchen', 25], ['recep', 40], ['room', 60], ['maid', 65], ['cook', 65]], mix: { t: 3, r: 1, v: 3 } },
  // ---- World 3 · Grand City: critics, big towers, everything
  { name: 'Skyline Inn', why: 'introduce critics 🧐: a walkout costs two bad reviews, but a happy one pays 3x', bills: 4, gap: 2.4, pat: 34, par: 100,
    pads: [['room', 40], ['recep', 85], ['room', 115], ['maid', 125], ['room', 155]], mix: { t: 4, r: 2, c: 2 } },
  { name: 'Metro Hotel', why: 'critics with rushers: serve the 🧐 first, always', bills: 4, gap: 2.1, pat: 30, par: 100,
    pads: [['room', 30], ['recep', 65], ['room', 90], ['maid', 110], ['room', 130], ['room', 155]], mix: { t: 3, r: 3, c: 2 } },
  { name: 'Harbor Tower', why: 'critics, VIPs and a suite: the lobby gets crowded with big tippers', bills: 5, gap: 3.6, pat: 41, par: 275, svc: 0.18,
    pads: [['room', 35], ['suite', 65], ['kitchen', 50], ['recep', 90], ['room', 115], ['maid', 135], ['room', 160]], mix: { t: 3, r: 2, v: 2, c: 2 } },
  { name: 'Opera Suites', why: 'a coach of critics on opening night: have the rooms ready', bills: 5, gap: 3.6, pat: 41, par: 240, svc: 0.21,
    pads: [['room', 30], ['suite', 55], ['kitchen', 40], ['recep', 70], ['room', 90], ['maid', 105], ['suite', 135], ['room', 150]], mix: { t: 3, r: 2, v: 2, c: 1 }, waves: [[34, 4, 'c'], [86, 4, 'c']] },
  { name: 'Neon Plaza', why: 'repairs return in the city: breakages and critics at the same time', bills: 5, gap: 2.4, pat: 32, par: 165, brk: 0.3, svc: 0.24,
    pads: [['room', 30], ['recep', 65], ['kitchen', 45], ['room', 90], ['maid', 105], ['room', 130], ['speed', 90], ['room', 160]], mix: { t: 3, r: 3, c: 2 } },
  { name: 'Midtown Grand', why: 'twist: coaches of rushers while the critic waits, so staff up before the first one', bills: 5, gap: 3.5, pat: 39, par: 285, brk: 0.19, svc: 0.22,
    pads: [['room', 25], ['suite', 50], ['recep', 65], ['kitchen', 45], ['room', 90], ['maid', 110], ['suite', 135], ['room', 155], ['cook', 110]], mix: { t: 2, r: 3, v: 2, c: 2 }, waves: [[28, 5, 'r'], [74, 5, 'r']] },
  { name: 'Clocktower Hotel', why: 'a tall tower, a short temper: nine rooms and everything on at once', bills: 6, gap: 4.0, pat: 44, par: 340, brk: 0.19, svc: 0.22,
    pads: [['room', 20], ['suite', 50], ['kitchen', 35], ['recep', 55], ['room', 75], ['maid', 90], ['room', 105], ['suite', 130], ['room', 145], ['cook', 105]], mix: { t: 2, r: 3, v: 2, c: 2 }, waves: [[30, 4, 'c'], [80, 5, 'r']] },
  { name: 'Penthouse Tower', why: 'the last test before the Palace: stay calm, staff early, keep the critics happy', bills: 6, gap: 3.6, pat: 41, par: 360, brk: 0.22, svc: 0.22,
    pads: [['room', 20], ['suite', 45], ['kitchen', 35], ['recep', 60], ['room', 80], ['maid', 100], ['suite', 125], ['room', 145], ['room', 155], ['cook', 110]], mix: { t: 2, r: 3, v: 3, c: 3 }, waves: [[26, 4, 'r'], [66, 4, 'c'], [110, 5, 'v']] },
  { name: 'Grand Palace', hard: true, why: 'HARD: the whole tour in one hotel: coaches, critics, VIPs, repairs, room service', bills: 6, gap: 3.3, pat: 40, par: 390, brk: 0.22, svc: 0.22,
    pads: [['room', 20], ['suite', 45], ['kitchen', 35], ['recep', 65], ['room', 90], ['maid', 110], ['suite', 140], ['room', 160], ['room', 175], ['cook', 125]], mix: { t: 2, r: 3, v: 3, c: 3 }, waves: [[24, 4, 'r'], [62, 5, 'c'], [102, 5, 'v'], [140, 6, 'r']] },
  { name: 'Grand Finale', why: 'victory lap: golden pay day on the top of the city', bills: 8, gap: 2.4, pat: 48, par: 400, svc: 0.32,
    pads: [['room', 25], ['suite', 40], ['kitchen', 25], ['recep', 60], ['room', 75], ['maid', 95], ['cook', 95], ['room', 105]], mix: { t: 3, r: 2, v: 3, c: 1 } },
];
// after the 30 hotels: "bonus hotels", built from the last world's rules, a little more crowded each time
export function bonusLevel(n) {
  const k = n - LEVELS.length;
  return { name: 'Bonus Hotel ' + k, why: 'bonus: the full tour, a notch busier', bonus: true, bills: 6, gap: Math.max(1.5, 2.0 - k * 0.04), pat: Math.max(18, 24 - k * 0.3), par: 190 + k * 3, brk: 0.25, svc: 0.3,
    pads: [['room', 25], ['suite', 50], ['kitchen', 35], ['recep', 60], ['room', 85], ['maid', 105], ['suite', 130], ['room', 150], ['room', 165], ['cook', 120]], mix: { t: 2, r: 3, v: 3, c: 3 }, waves: [[26, 6, 'r'], [66, 7, 'c'], [108, 7, 'v']] };
}
export const levelOf = n => (n <= LEVELS.length ? LEVELS[n - 1] : bonusLevel(n));
export const worldOf = n => Math.min(2, Math.floor((n - 1) / 10));

// Humans are slower than the greedy bot that set these: the 3rd-star time is the bot's pace x1.8 (critic 11-01: 2:11 vs 0:45 par).
for (const L of LEVELS) L.par = Math.round(L.par * 1.8 / 5) * 5;
for (let i = 2; i < 7; i++) LEVELS[i].pat = Math.round(LEVELS[i].pat * 1.4);   // critic: Pier Inn drained 3 hearts in 40 s
