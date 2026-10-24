// Mergie Dorm: the cast, the merge chains, the three rooms (restore tasks) and the story lines. Data only.

export const FRIENDS = {
  k01: { name: 'Mochi', likes: ['beauty', 'sweets', 'plush'], color: '#ff7eb6' },
  k02: { name: 'Bea', likes: ['beauty'], color: '#ff9e7a' },
  k03: { name: 'Juno', likes: ['plush'], color: '#45c9a0' },
  k04: { name: 'Kiki', likes: ['plush', 'sweets'], color: '#9b7bff' },
  k05: { name: 'Sunny', likes: ['sweets'], color: '#f5b400' },
};
export const FRIEND_IDS = Object.keys(FRIENDS);

export const CH = {
  beauty: ['g01', 'g02', 'g03', 'g04', 'g05', 'g06'],
  sweets: ['g07', 'g08', 'g09', 'g10', 'g11', 'g12'],
  plush: ['g13', 'g14', 'g15', 'g16', 'g17', 'g18'],
};
export const CHAIN_NAME = { beauty: 'Beauty', sweets: 'Sweets', plush: 'Plush' };
export const NAMES = {
  g01: 'Lip Balm', g02: 'Lipstick Duo', g03: 'Polish Pair', g04: 'Heart Perfume', g05: 'Glitter Palette', g06: 'Vanity Case',
  g07: 'Sugar Cube', g08: 'Macaron', g09: 'Cupcake', g10: 'Macaron Plate', g11: 'Shortcake', g12: 'Tiered Cake',
  g13: 'Pom-pom', g14: 'Bunny Charm', g15: 'Teddy', g16: 'Cat-loaf Pillow', g17: 'Big Bunny', g18: 'Plushie Pile',
  w05: 'Makeup Bag', f10: 'Mini Oven', m12: 'Plushie Box', x01: 'Surprise Chest',
};
// generators: one per chain
export const GENS = { w05: { chain: 'beauty', cell: [6, 1] }, f10: { chain: 'sweets', cell: [6, 3] }, m12: { chain: 'plush', cell: [6, 5] } };

// reactions when an order is filled (insider Gen Z dorm voice, kind not mean)
export const REACT = {
  k01: ['omg yes 💖', 'core memory unlocked', 'bestie!!', 'ok this is SO cute'],
  k02: ['slay 💅', 'ate. no crumbs.', 'the glow-up is real', '10/10 no notes'],
  k03: ['I will protect him with my life', 'emotional support plush ✓', 'he has a name now', 'obsessed'],
  k04: ['W', 'gg ez', 'brb, posting this', 'achievement unlocked'],
  k05: ['carbs = love', 'sugar rush activated', 'chef’s kiss', 'yum yum yum'],
};

// rooms: each task = a restore step bought with stars. kind 'prop' places a kawaii GLB; others are built in code (dorm.js)
// pos [x, y, z] on the floor (y = 0) or the wall (z = -9.9); h = height in world units; ry = turn; who/line = the quip
export const ROOMS = [
  { key: 'room404', name: 'Room 404', sub: 'Your new dorm room', wall: ['#dcc6ff', '#c7a9ff', '#ff7fbf'], old: '#d9c0ad', pattern: 'hearts', floor: '#e8b59f',
    tasks: [
      { kind: 'paint', name: 'Paint the walls lilac', cost: 1, who: 'k02', line: 'Beige is a cry for help. Lilac it is.' },
      { kind: 'prop', id: 'h05', name: 'Roll out the cloud rug', cost: 1, pos: [0, 0, -7.3], h: 1.25, w: 4.4, who: 'k03', line: 'Finally, a floor I can lie on dramatically.' },
      { kind: 'prop', id: 'h01', name: 'Build the bunny bed', cost: 2, pos: [-4.5, 0, -8.1], h: 3.3, ry: 0.3, who: 'k01', line: 'Nap station: online.' },
      { kind: 'curtains', name: 'Hang heart curtains', cost: 2, who: 'k05', line: 'Natural light? In THIS economy?' },
      { kind: 'prop', id: 'h06', name: 'Mushroom lamp', cost: 2, pos: [-2.35, 0, -9.1], h: 1.7, who: 'k04', line: 'Cottagecore lighting for my 3 a.m. gaming.' },
      { kind: 'lights', name: 'String fairy lights', cost: 2, who: 'k05', line: 'Instant main-character energy.' },
      { kind: 'prop', id: 'h03', name: 'Study desk', cost: 3, pos: [4.3, 0, -8.6], h: 2.6, ry: -0.15, who: 'k04', line: 'A desk! For… studying. Allegedly.' },
      { kind: 'polaroids', name: 'Pin up our polaroids', cost: 2, who: 'k01', line: 'Five strangers, one wall of chaos. Love that for us.' },
      { kind: 'prop', id: 'h07', name: 'Adopt a succulent', cost: 2, pos: [4.5, 2.84, -8.9], h: 0.95, who: 'k02', line: 'Her name is Gloria. She is thriving. Unlike my sleep schedule.' },
      { kind: 'prop', id: 'h04', name: 'Glow-up vanity', cost: 3, pos: [6.6, 0, -6.6], h: 2.9, ry: -0.85, who: 'k02', line: 'Glow-up headquarters is open.' },
      { kind: 'prop', id: 'h02', name: 'Heart beanbag', cost: 3, pos: [-6.2, 0, -5.8], h: 1.8, ry: 0.75, who: 'k03', line: 'I live here now. Forward my mail.' },
      { kind: 'prop', id: 'h08', name: 'Plushie shelf', cost: 3, pos: [4.2, 3.3, -9.75], h: 2.0, wall: true, who: 'k01', line: 'Shelf done! Wait… who ate my cupcake?' },
    ] },
  { key: 'common', name: 'Common Room Café', sub: 'Party HQ (and a crime scene)', wall: ['#bff0df', '#9ee6cc', '#ff7fa8'], old: '#d4c4ad', pattern: 'berries', floor: '#e9c3a4',
    tasks: [
      { kind: 'paint', name: 'Paint it mint', cost: 2, who: 'k05', line: 'Mint walls = 20% more serotonin. Trust.' },
      { kind: 'prop', id: 'h09', name: 'Café counter', cost: 2, pos: [-4.4, 0, -8.4], h: 2.6, ry: 0.15, who: 'k05', line: 'Open for business. Payment in compliments.' },
      { kind: 'neon', name: 'Neon heart sign', cost: 2, who: 'k04', line: 'It hums. I hum back. We are friends now.' },
      { kind: 'prop', id: 'h10', name: 'Table for besties', cost: 3, pos: [4.3, 0, -7.8], h: 2.8, ry: -0.25, who: 'k01', line: 'Group chat, but in person. Revolutionary.' },
      { kind: 'bunting', name: 'Party bunting', cost: 2, who: 'k03', line: 'Triangles of joy. Very official.' },
      { kind: 'prop', id: 'h08', name: 'Snack shelf', cost: 3, pos: [4.2, 3.4, -9.75], h: 2.0, wall: true, who: 'k05', line: 'Clue #1: the macarons have… tiny bite marks?' },
      { kind: 'prop', id: 'h12', name: 'Cat tree (for no reason)', cost: 3, pos: [6.6, 0, -6.6], h: 3.6, ry: -0.6, who: 'k04', line: 'We don’t have a cat. Why did we buy this.' },
      { kind: 'prop', id: 'h05', name: 'Fluffy rug', cost: 2, pos: [0, 0, -7.3], h: 1.2, w: 4.4, who: 'k03', line: 'Rug status: fluffy. Mood status: also fluffy.' },
      { kind: 'prop', id: 'h07', name: 'Big succulent', cost: 2, pos: [3.1, 0, -9.1], h: 1.4, who: 'k02', line: 'Gloria has a sister now. Her name is Also Gloria.' },
      { kind: 'prop', id: 'h02', name: 'Beanbag corner', cost: 3, pos: [-6.2, 0, -5.8], h: 1.8, ry: 0.75, who: 'k01', line: 'Clue #2: paw prints. In frosting. On the beanbag.' },
    ] },
  { key: 'lounge', name: 'Starlight Lounge', sub: 'Sleepover stake-out', wall: ['#ffe39e', '#ffd07a', '#a985ff'], old: '#d6c2b0', pattern: 'stars', floor: '#e3b89c',
    tasks: [
      { kind: 'paint', name: 'Paint it butter yellow', cost: 2, who: 'k05', line: 'Butter yellow is a personality.' },
      { kind: 'stars', name: 'Hang the star lights', cost: 2, who: 'k04', line: 'Stars inside? Astronomy club is shaking.' },
      { kind: 'prop', id: 'h01', name: 'Sleepover bed', cost: 3, pos: [-4.5, 0, -8.1], h: 3.3, ry: 0.3, who: 'k01', line: 'Sleepover rule #1: nobody actually sleeps.' },
      { kind: 'prop', id: 'h03', name: 'Gaming desk', cost: 3, pos: [4.3, 0, -8.6], h: 2.6, ry: -0.15, who: 'k04', line: 'Stake-out command centre. Snacks as bait.' },
      { kind: 'disco', name: 'Mini disco ball', cost: 2, who: 'k03', line: 'For… investigating. Obviously.' },
      { kind: 'prop', id: 'h06', name: 'Twin mushroom lamp', cost: 2, pos: [-2.35, 0, -9.1], h: 1.7, who: 'k05', line: 'Clue #3: the snack bowl is purring.' },
      { kind: 'prop', id: 'h08', name: 'Book + plush shelf', cost: 3, pos: [4.2, 3.3, -9.75], h: 2.0, wall: true, who: 'k02', line: 'Organised by colour. Not by title. Never by title.' },
      { kind: 'prop', id: 'h04', name: 'Second vanity', cost: 3, pos: [6.6, 0, -6.6], h: 2.9, ry: -0.85, who: 'k02', line: 'Two vanities. Zero regrets.' },
      { kind: 'polaroids', name: 'New polaroid wall', cost: 2, who: 'k03', line: 'We look unhinged in every single one. Perfect.' },
      { kind: 'prop', id: 'h02', name: 'Stake-out beanbag', cost: 3, pos: [-6.2, 0, -5.8], h: 1.8, ry: 0.75, who: 'k01', line: 'Wait. Something fluffy is moving under the bed…' },
    ] },
];
export const TASK_TOTAL = ROOMS.reduce((a, r) => a + r.tasks.length, 0);
export function roomOf(done) {           // which room + task index for `done` tasks restored in total
  let k = done;
  for (let i = 0; i < ROOMS.length; i++) { if (k < ROOMS[i].tasks.length) return { room: i, task: k }; k -= ROOMS[i].tasks.length; }
  return { room: ROOMS.length - 1, task: ROOMS[ROOMS.length - 1].tasks.length };
}

// chapter scenes: shown as story cards (portrait + speech bubble), tap to advance
export const STORY = {
  intro: [
    ['k01', 'Room 404 of Sugarcube Hall. The website literally said “room not found.”'],
    ['k02', 'It’s beige. Aggressively beige.'],
    ['k03', 'There’s also a box labelled “DO NOT OPEN (snacks)”. It’s empty.'],
    ['k04', 'Plan: merge cute stuff, fill our orders, earn ⭐, glow this place up.'],
    ['k05', 'And make it the cutest dorm on campus. Deal? Deal.'],
  ],
  room2: [
    ['k05', 'Room 404 is DONE. Welcome party in the Common Room tonight!'],
    ['k01', '… someone ate the welcome cupcakes. Again.'],
    ['k04', 'Third cupcake heist this week. I’m starting a group chat.'],
    ['k02', 'First we decorate. Then we investigate.'],
  ],
  room3: [
    ['k03', 'Update: the paw prints lead to the Starlight Lounge.'],
    ['k05', 'Sleepover stake-out! I’ll bring cupcakes as bait.'],
    ['k04', 'Purely for science. I’m eating one now. Also for science.'],
  ],
  ending: [
    ['k01', 'THE CUPCAKE THIEF… it’s a CAT?!'],
    ['k07', 'Mrrp. ♡'],
    ['k02', 'Her name is Lulu. She lives here now. Non-negotiable.'],
    ['k03', 'So THAT’s why we bought a cat tree. Fate.'],
    ['k05', 'Cutest dorm on campus: achieved. Keep merging for the world board! 💖'],
  ],
};
export const NAME_OF = id => id === 'k07' ? 'Lulu' : FRIENDS[id]?.name || '';
