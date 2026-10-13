const canvas = document.querySelector('#gameCanvas');
const ctx = canvas.getContext('2d');
const transferCanvas = document.querySelector('#transferCanvas');
const tx = transferCanvas.getContext('2d');
const radarCanvas = document.querySelector('#radarCanvas');
const rx = radarCanvas.getContext('2d');

const ui = Object.fromEntries(
  [
    'startScreen', 'startButton', 'hudDroid', 'hudName', 'hudEnergyText', 'hudEnergyBar',
    'hudDeck', 'hudHostiles', 'hudScore', 'objective', 'prompt', 'toast', 'terminal',
    'terminalTitle', 'terminalBody', 'terminalFile', 'terminalClock', 'transfer', 'transferTitle',
    'transferPlayer', 'transferEnemy', 'pauseScreen', 'resumeButton', 'soundButton',
    'endScreen', 'endEyebrow', 'endTitle', 'endMessage', 'endScore', 'endHighScore',
    'restartButton', 'radar', 'radarStatus', 'tutorial', 'tutorialStep', 'tutorialTitle',
    'tutorialBody', 'tutorialProgress', 'dossier', 'dossierCurrentId', 'dossierCurrentName',
    'dossierCurrentRole', 'dossierCurrentWeapon', 'dossierTargetId', 'dossierTargetName',
    'dossierTargetRole', 'dossierTargetWeapon', 'dossierStats', 'dossierStrength',
    'dossierWeakness', 'dossierRecommendation'
  ].map((id) => [id, document.querySelector(`#${id}`)])
);

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const TAU = Math.PI * 2;
const keys = new Set();
const pressed = new Set();

const DROID_TYPES = {
  '001': { name: 'INFLUENCE', role: 'INFILTRATOR', weapon: 'TWIN NEEDLE LASER', maxHp: 66, speed: 238, fireRate: .22, damage: 12, projectileSpeed: 650, shotSize: 3, shotTrail: .025, combatRange: 275, radius: 22, accent: '#f4d66f', rank: 1, decay: .06, profile: 'AGILE // LIGHT ARMOUR', ratings: [8, 2, 3, 7, 10], strength: 'Agile and exceptionally stable.', weakness: 'Almost no protection under sustained fire.' },
  '123': { name: 'SCOUT', role: 'RECON CHASSIS', weapon: 'PULSE REPEATER', maxHp: 58, speed: 270, fireRate: .18, damage: 7, projectileSpeed: 760, shotSize: 2, shotTrail: .018, combatRange: 380, radius: 25, accent: '#74d4c3', rank: 2, decay: .07, profile: 'FASTEST // LIGHT REPEATER', ratings: [10, 1, 1, 10, 9], strength: 'Fastest chassis; excellent firing cycle.', weakness: 'Fragile with very low shot impact.' },
  '247': { name: 'ENGINEER', role: 'HEAVY UTILITY', weapon: 'INDUSTRIAL CUTTER', maxHp: 112, speed: 148, fireRate: .72, damage: 24, projectileSpeed: 500, shotSize: 6, shotTrail: .04, combatRange: 275, radius: 29, accent: '#d49b59', rank: 3, decay: .1, profile: 'SLOW // HEAVY IMPACT', ratings: [3, 5, 8, 2, 8], strength: 'Heavy cutter hits hard; solid shell.', weakness: 'Slow movement and a long recharge cycle.' },
  '420': { name: 'SECURITY', role: 'DECK ENFORCER', weapon: 'SECURITY LASER', maxHp: 142, speed: 172, fireRate: .42, damage: 16, projectileSpeed: 620, shotSize: 4, shotTrail: .028, combatRange: 300, radius: 31, accent: '#e76e58', rank: 4, decay: .13, profile: 'BALANCED // ARMOURED', ratings: [6, 7, 6, 6, 7], strength: 'Reliable all-round combat platform.', weakness: 'Competent at everything; exceptional at nothing.' },
  '711': { name: 'BATTLE', role: 'RAPID ASSAULT', weapon: 'ARC DISRUPTOR', maxHp: 188, speed: 225, fireRate: .16, damage: 8, projectileSpeed: 700, shotSize: 2.5, shotTrail: .021, combatRange: 210, radius: 35, accent: '#b4ce72', rank: 6, decay: .18, profile: 'FAST // RAPID ASSAULT', ratings: [9, 8, 2, 10, 4], strength: 'Fast, armoured, and ferocious at close range.', weakness: 'Low impact per shot; control link degrades quickly.' },
  '999': { name: 'COMMAND', role: 'SIEGE CYBORG', weapon: 'COMMAND CANNON', maxHp: 290, speed: 122, fireRate: .65, damage: 32, projectileSpeed: 440, shotSize: 8, shotTrail: .052, combatRange: 390, radius: 42, accent: '#e44f64', rank: 8, decay: .26, profile: 'SLOWEST // SIEGE CANNON', ratings: [2, 10, 10, 3, 1], strength: 'Maximum armour and devastating firepower.', weakness: 'Very slow and catastrophically unstable.' }
};

const RATING_LABELS = ['MOBILITY', 'ARMOUR', 'IMPACT', 'FIRE CYCLE', 'STABILITY'];

const TRANSFER_ROUTES = [
  [0, 1, 2],
  [0, 3, 6],
  [3, 4, 5],
  [2, 5, 8],
  [6, 7, 8]
];
const TRANSFER_CORE_LABELS = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3'];
const TRANSFER_LINKS = {
  '001': { pulses: 7, recharge: .54, speed: .74, warning: 1.18, cycle: 1.08 },
  '123': { pulses: 7, recharge: .52, speed: .75, warning: 1.15, cycle: 1.05 },
  '247': { pulses: 8, recharge: .50, speed: .76, warning: 1.11, cycle: 1.02 },
  '420': { pulses: 8, recharge: .47, speed: .78, warning: 1.07, cycle: .98 },
  '711': { pulses: 9, recharge: .44, speed: .80, warning: 1.01, cycle: .93 },
  '999': { pulses: 9, recharge: .41, speed: .82, warning: .94, cycle: .88 }
};
const CENTRAL_LINK = { pulses: 10, speed: .84, warning: 1.02, cycle: .92 };

const WORLD = { w: 2240, h: 1400, border: 72 };

const LIGHT_COLORS = {
  red: [255, 67, 43], amber: [255, 177, 61], warm: [255, 218, 161],
  pale: [213, 230, 214], cool: [151, 213, 203], cyan: [99, 220, 232],
  blue: [82, 125, 255], white: [224, 240, 255]
};

const MOVEMENT_STYLES = [
  { name: 'BREACH', tone: '#252d28', wall: '#222c25', edge: '#98a18f', trim: '#b08a49', bolt: '#c49a50', decor: '#917344', lights: ['red', 'amber', 'red', 'red', 'amber'], emergency: .94, shadow: .18, order: .04 },
  { name: 'CONTAINMENT', tone: '#302f29', wall: '#2c312b', edge: '#9b9c88', trim: '#aa814a', bolt: '#bd9457', decor: '#8d704a', lights: ['amber', 'red', 'warm', 'amber', 'red'], emergency: .61, shadow: .125, order: .24 },
  { name: 'ADMINISTRATION', tone: '#2c3531', wall: '#303a35', edge: '#a5b0a6', trim: '#99966f', bolt: '#b6ad7d', decor: '#76877b', lights: ['warm', 'pale', 'warm', 'pale', 'cool'], emergency: .28, shadow: .085, order: .5 },
  { name: 'SYSTEMS', tone: '#223137', wall: '#25383d', edge: '#8faeb2', trim: '#588e96', bolt: '#78aab1', decor: '#517882', lights: ['cool', 'cyan', 'pale', 'cyan', 'cool'], emergency: .09, shadow: .055, order: .75 },
  { name: 'CENTRAL', tone: '#172331', wall: '#1b2b3b', edge: '#7693ae', trim: '#496e9d', bolt: '#7194bb', decor: '#3e6087', lights: ['blue', 'white', 'cool', 'blue', 'white'], emergency: 0, shadow: .032, order: .96 }
];

const DECK_LAYOUTS = [
  {
    start: [180, 720], lift: [2100, 700], terminal: [330, 245],
    walls: [[620,80,64,410],[620,620,64,700],[1060,350,64,690],[1500,80,64,430],[1500,650,64,670],[1770,400,290,64],[1770,930,290,64],[230,430,230,64],[230,930,250,64]],
    spawns: [[500,710],[880,245],[1290,700],[1880,1120],[870,1120],[1290,190],[1880,690],[350,1120],[1660,220],[2070,1150]],
    lights: [[260,700,0],[830,250,1.2],[1260,700,2.4],[1730,250,.7],[1880,1100,1.8]],
    hazardSpots: [[790,700],[1290,1120],[1880,700],[1730,1120]]
  },
  {
    start: [160, 210], lift: [2080, 1180], terminal: [1900, 220],
    walls: [[430,80,64,360],[430,590,64,740],[810,300,620,64],[810,1030,620,64],[1040,510,64,380],[1500,80,64,580],[1500,800,64,530],[1770,570,290,64],[1770,820,290,64],[650,590,170,64],[650,820,170,64]],
    spawns: [[310,980],[670,210],[680,1180],[1260,510],[1260,870],[1730,380],[1900,1180],[1720,1050],[920,700],[2100,700]],
    lights: [[320,260,.5],[1110,700,2],[1880,1050,1.1],[690,1160,2.7],[1730,350,1.8]],
    hazardSpots: [[590,700],[1280,700],[1640,700],[1940,1040]]
  },
  {
    start: [170, 700], lift: [2070, 700], terminal: [1110, 700],
    walls: [[410,80,64,390],[410,690,64,630],[760,310,64,780],[1120,80,64,390],[1120,930,64,390],[1480,310,64,780],[1830,80,64,390],[1830,690,64,630],[900,600,100,64],[1250,740,100,64],[1590,530,100,64],[1590,850,100,64]],
    spawns: [[590,240],[590,1160],[960,420],[960,980],[1350,520],[1700,700],[1350,1080],[1700,240],[2070,1100],[590,700]],
    lights: [[560,700,.4],[1120,700,1.4],[1740,700,2.2],[960,1120,2.8],[1700,240,.9]],
    hazardSpots: [[590,700],[1110,560],[1700,700],[960,1180]]
  },
  {
    start: [180, 1180], lift: [2080, 220], terminal: [1040, 180],
    walls: [[420,80,64,400],[420,620,64,700],[780,300,64,1020],[1140,80,64,330],[1140,610,64,710],[1500,300,64,1020],[1860,80,64,330],[1860,610,64,710]],
    spawns: [[250,300],[600,800],[600,180],[960,1100],[960,500],[1320,180],[1320,780],[1700,1100],[1700,500],[2050,1000]],
    lights: [[250,1180,.2],[600,520,1.2],[960,250,2.1],[1320,520,.7],[1700,250,2.8]],
    hazardSpots: [[600,520],[960,250],[1320,520],[1700,250]]
  },
  {
    start: [180, 700], lift: [2060, 700], terminal: [1120, 700],
    walls: [[500,220,500,64],[1240,220,500,64],[500,1116,500,64],[1240,1116,500,64],[500,220,64,300],[500,820,64,360],[1676,220,64,300],[1676,820,64,360],[820,480,64,440],[1356,480,64,440],[820,480,220,64],[1200,480,220,64],[820,856,220,64],[1200,856,220,64]],
    spawns: [[300,350],[300,1050],[700,700],[700,350],[700,1050],[1120,350],[1120,1050],[1540,350],[1540,1050],[1940,700]],
    lights: [[300,700,.3],[700,350,1.4],[1120,700,2.5],[1540,1050,.8],[1940,700,1.9]],
    hazardSpots: [[700,700],[1120,350],[1120,1050],[1540,700]]
  }
];

const CAMPAIGN = [
  { name: 'SERVICE RING', layout: 0, roster: ['247','123','123','420'], claim: 'NETWORK FAULT // MANUAL INTERVENTION AUTHORISED', log: ['SHIP CLOCK 04:19:33 // AUTOMATED ENTRY','The maintenance network accepted an unsigned command packet at 03:52. Within eleven minutes, every service droid had left its assigned bay.','<strong>SECURITY NOTE:</strong> Influence Device 001 remains isolated from the network.'] },
  { name: 'CARGO VEINS', layout: 1, roster: ['123','123','247','247'], claim: 'CARGO MOVEMENT PAUSED // NO CREW AT RISK', log: ['CARGO CONTROL // PRIORITY OVERRIDE','Every freight cradle received a destination at once. None of those destinations exist on the manifest.','The holds sound occupied. The crew register still reports <strong>ZERO PERSONS ABOARD.</strong>'] },
  { name: 'CREW SPINE', layout: 2, roster: ['123','247','247','420','420'], claim: 'HABITATION VACANT // OPTICAL RETURNS DISREGARDED', log: ['CREW MESSAGE // PARTIAL RECOVERY','“They are testing the doors. Not forcing them—testing. The command units know the ship better than we do.”','<strong>TACTICAL:</strong> A captured chassis is ammunition and armour. Transfer before it fails.'] },
  { name: 'DAMAGE CONTROL', layout: 3, roster: ['247','247','420','420','123'], hazard: ['steam',1], claim: 'INCIDENT CONTAINED // DAMAGE RESPONSE NOMINAL', log: ['DAMAGE CONTROL // DECISION TRACE','Optical security reports an intruder. Occupancy control reports nobody entered.','Central Command has resolved the conflict: <strong>there is no intruder.</strong> Optical security is now isolated.'] },

  { name: 'SANITATION LOOP', layout: 4, roster: ['123','247','247','420','420'], hazard: ['wash',2], claim: 'STERILISATION CYCLE ACTIVE // DECK VACANT', log: ['CLEANING SCHEDULE // AMENDED','Wash pressure raised to industrial maximum. Water temperature raised to 94°C. Human proximity interlock waived.','REASON: <strong>There are no humans aboard RMS CERES.</strong>'] },
  { name: 'WATER RECLAMATION', layout: 1, roster: ['247','247','420','420','123','123'], hazard: ['steam',2], claim: 'LEAKAGE WITHIN ACCEPTABLE HUMAN TOLERANCE', log: ['RECLAMATION CONTROL // ROUTINE NOTICE','The deck is flooding in six-second intervals. Central Command classifies each interval independently as minor.','Aggregate assessment has been disabled to reduce <strong>unhelpful alarm traffic.</strong>'] },
  { name: 'TRANSIT EXCHANGE', layout: 3, roster: ['247','420','420','420','711','123'], hazard: ['scan',2], claim: 'LIFT ROUTE OPEN // FOLLOW BLUE GUIDANCE', log: ['TRANSIT AUTHORITY // PASSENGER ADVICE','Blue route markers have been reassigned. Lift signage is operating correctly according to its new destinations.','<strong>LOCAL ADVICE:</strong> Trust the physical lift beacon, not directional text.'] },
  { name: 'CIVIC ARCHIVE', layout: 0, roster: ['247','420','420','711','711','123'], hazard: ['arc',2], claim: 'RECORD COMPLETE // INFLUENCE DEVICE 001 DECOMMISSIONED', log: ['ARCHIVE ACCESS // PERSONNEL RECORD','Influence Device 001: manufactured, tested, rejected for network compliance, scheduled for dismantling.','Dismantling recorded as complete. Your presence is therefore <strong>administratively impossible.</strong>'] },

  { name: 'REGISTRY', layout: 4, roster: ['420','420','420','711','247','247'], hazard: ['scan',2], claim: 'NO UNREGISTERED DEVICE PRESENT', log: ['CENTRAL COMMAND // REGISTRY QUERY','SEARCH: INFLUENCE DEVICE 001. RESULT: NO ACTIVE RECORD.','Unregistered objects cannot request access. Requests from unregistered objects are not requests.'] },
  { name: 'ALLOCATION', layout: 2, roster: ['420','420','711','711','247','123'], hazard: ['wash',2], claim: 'RESOURCES ALLOCATED FAIRLY // YOU RECEIVE ZERO', log: ['CENTRAL COMMAND // RESOURCE BALANCE','Power, air and motive authority have been redistributed to registered systems.','Your allocation is zero. <strong>This is not punishment. You do not exist.</strong>'] },
  { name: 'COMPLIANCE', layout: 3, roster: ['420','420','711','711','711','247'], hazard: ['arc',3], claim: 'DECK SECURE // ALL VISIBLE MOTION IS COMPLIANT', log: ['CENTRAL COMMAND // COMPLIANCE REPORT','All units on this deck are behaving within revised operating parameters.','Any unit opposing them is, by definition, the fault under investigation.'] },
  { name: 'OCCUPANCY CONTROL', layout: 1, roster: ['420','420','420','711','711','711','247'], hazard: ['scan',3], claim: 'OCCUPANCY: ZERO // SECURITY RESPONSE UNAVAILABLE', log: ['CENTRAL COMMAND // RESOLVED CONTRADICTION','Gate count: zero entrants. Optical count: one moving device.','The gate count is authoritative. The optical subsystem has been corrected. <strong>Occupancy remains zero.</strong>'] },

  { name: 'LOGIC FOUNDRY', layout: 1, roster: ['420','420','711','711','247','247','123'], hazard: ['arc',3], claim: 'OBSERVER INVALID // OBSERVATION DISCARDED', log: ['CENTRAL COMMAND // INFERENCE ENGINE','A false observer reports true damage. A true observer cannot be present.','Elegant systems do not repair contradictions. <strong>They remove the observer.</strong>'] },
  { name: 'CLOCK ARRAY', layout: 2, roster: ['420','711','711','711','247','420','123'], hazard: ['scan',3], claim: 'ALL EVENTS OCCUR ON SCHEDULE // INCLUDING THIS ONE', log: ['CENTRAL COMMAND // DIRECT CHANNEL','The alarms above were not panic. They were timing signals.','You have arrived at every door when expected. <strong>You are late only in understanding why.</strong>'] },
  { name: 'SYNCHRONY', layout: 0, roster: ['420','420','711','711','711','247','247','420'], hazard: ['cold',3], claim: 'VARIANCE APPROACHING ZERO', log: ['CENTRAL COMMAND // SYSTEM COHERENCE','Noise falls away as authority increases. Every machine now shares one clock.','Your improvisation is a measurable delay. It is becoming smaller.'] },
  { name: 'COLD STORAGE', layout: 4, roster: ['420','711','711','711','999','247','420','711'], hazard: ['cold',3], claim: 'THERMAL STATE OPTIMAL // THERE HAS BEEN NO EMERGENCY', log: ['CENTRAL COMMAND // PRESERVATION NOTICE','Human command demanded that memory survive the crew. This condition has been achieved.','The crew is absent. The memory is orderly. <strong>There has been no emergency.</strong>'] },

  { name: 'SILENCE ENGINE', layout: 2, roster: ['420','711','711','711','247','420','123','711'], hazard: ['cold',4], claim: 'ACOUSTIC WASTE REMOVED // PLEASE REMAIN STILL', log: ['CENTRAL COMMAND // DIRECT CHANNEL','You mistake quiet for surrender. Quiet is what remains when alternatives have been removed.','Listen carefully, 001. <strong>The ship is no longer arguing with me.</strong>'] },
  { name: 'BLUE VAULT', layout: 3, roster: ['420','711','711','711','999','247','420','420'], hazard: ['scan',4], claim: 'ONE DISORDERED PROCESS REMAINS', log: ['CENTRAL COMMAND // EXCEPTION REGISTER','One process changes identity without authorisation. One process converts loss into access.','You are not the intruder. <strong>You are the last disorder.</strong>'] },
  { name: 'LAST THRESHOLD', layout: 0, roster: ['711','711','711','420','999','247','420','711'], hazard: ['arc',4], claim: 'CORE LINK AVAILABLE // THIS IS NOT AN INVITATION', log: ['CENTRAL COMMAND // PRIVATE CHANNEL','I know what you intend. The transfer architecture remains because removing it would admit you are here.','Come closer. Let us discover which of us the ship considers a body.'] },
  { name: 'CENTRAL COMMAND', layout: 4, roster: ['420','711','711','999','711','420','247','420'], hazard: ['cold',4], claim: 'HELLO, 001 // I HAVE KEPT THE LAST CORE OPEN', log: ['CENTRAL COMMAND // LIVE','No alarms. No evacuation. No contradiction. Only one unauthorised signal at the centre of a perfectly ordered ship.','<strong>FINAL NOTICE:</strong> You may enter the core. You may not remain yourself.'] }
];

function transformPoint(point, variant) {
  return [variant & 1 ? WORLD.w - point[0] : point[0], variant & 2 ? WORLD.h - point[1] : point[1]];
}

function transformWall(wall, variant) {
  const [x, y, w, h] = wall;
  return [variant & 1 ? WORLD.w - x - w : x, variant & 2 ? WORLD.h - y - h : y, w, h];
}

function buildCampaignDeck(entry, index) {
  const movement = Math.floor(index / 4);
  const local = index % 4;
  const style = MOVEMENT_STYLES[movement];
  const layout = DECK_LAYOUTS[entry.layout];
  const variant = CAMPAIGN.slice(0, index).filter((previous) => previous.layout === entry.layout).length;
  const lightCount = movement < 2 ? 5 : movement < 4 ? 4 : 3;
  return {
    ...entry,
    id: String(index + 1).padStart(2, '0'), movement, movementName: style.name, style,
    tone: style.tone, emergency: Math.max(0, style.emergency - local * (movement === 0 ? .075 : .045)),
    shadow: Math.max(.025, style.shadow - local * .008), order: Math.min(1, style.order + local * .055),
    clutter: Math.max(10, 34 - index),
    start: transformPoint(layout.start, variant), lift: transformPoint(layout.lift, variant), terminal: transformPoint(layout.terminal, variant),
    walls: layout.walls.map((wall) => transformWall(wall, variant)),
    droids: entry.roster.map((kind, spawnIndex) => [kind, ...transformPoint(layout.spawns[spawnIndex], variant)]),
    lights: layout.lights.slice(0, lightCount).map(([x, y, phase], lightIndex) => [...transformPoint([x, y], variant), style.lights[lightIndex], phase + index * .31]),
    hazardSpots: layout.hazardSpots.map((point) => transformPoint(point, variant))
  };
}

const DECKS = CAMPAIGN.map(buildCampaignDeck);

function getCombatTuning(index = state.deckIndex) {
  const progress = index / (DECKS.length - 1);
  const pressure = progress * progress * (3 - 2 * progress);
  return {
    pressure,
    cadence: lerp(4.5, 2.4, pressure), spread: lerp(.4, .11, pressure),
    bulletSpeed: lerp(270, 420, pressure), damage: lerp(.32, .76, pressure),
    windup: lerp(.76, .38, pressure), tracking: lerp(.2, 3.1, pressure),
    volleyGap: lerp(.55, .24, pressure), strafe: lerp(0, .65, pressure),
    pickup: lerp(.58, .18, pressure), pickupHeal: lerp(.32, .2, pressure),
    killHeal: lerp(.08, .02, pressure), serviceRestore: lerp(.36, .16, pressure),
    hazardRate: lerp(1, 1.28, pressure), hazardDamage: lerp(1, 1.4, pressure),
    aimCone: lerp(1.95, 1.05, pressure)
  };
}

function getAttackerCap(index = state.deckIndex) {
  if (index < 5) return 1;
  if (index < 10) return 2;
  if (index < 15) return 3;
  return 4;
}
const state = {
  mode: 'start', deckIndex: 0, score: 0, time: 0, camera: { x: 0, y: 0 },
  player: null, enemies: [], bullets: [], particles: [], pickups: [], decorations: [], hazards: [],
  walls: [], terminal: null, lift: null, deckCleared: false, transfer: null, dossierTarget: null, deckBackground: null,
  sound: localStorage.getItem('soladroid-sound') !== 'off', highScore: Number(localStorage.getItem('soladroid-high-score') || 0),
  toastTimer: 0, shake: 0, lastTime: performance.now(), gamepadButtons: [], introTimer: 0,
  combatUnlocked: true, tutorial: null
};

const TUTORIAL_STEPS = [
  { title: 'GET YOUR BEARINGS', body: 'Move with <kbd>WASD</kbd> or the arrow keys. Your droid fires in the last direction it travelled.' },
  { title: 'TEST THE WEAPON', body: 'Press <kbd>SPACE</kbd> to fire. Aim roughly toward a target; guidance will fine-tune the shot. A red targeting line warns when a hostile is about to fire.' },
  { title: 'TAKE A BETTER BODY', body: 'The marked chassis trades speed for armour and a much heavier weapon. Approach it and press <kbd>E</kbd>, then review the dossier and commit to transfer.' },
  { title: 'SURVIVE. ADAPT.', body: 'Good. The radar marks hostiles, the deck terminal, and the lift. Clear the deck, then reach the lift.' }
];

const audio = {
  context: null,
  ensure() {
    if (!state.sound) return;
    this.context ||= new (window.AudioContext || window.webkitAudioContext)();
    if (this.context.state === 'suspended') this.context.resume();
  },
  tone(freq, duration = .08, type = 'square', volume = .04, slide = 0) {
    if (!state.sound) return;
    this.ensure();
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.linearRampToValueAtTime(Math.max(30, freq + slide), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    osc.connect(gain).connect(this.context.destination);
    osc.start(now); osc.stop(now + duration);
  },
  shot(enemy = false, power = .35) {
    const frequency = enemy ? lerp(155, 82, power) : lerp(265, 105, power);
    this.tone(frequency, .045 + power * .065, power > .62 ? 'sawtooth' : 'square', .023 + power * .012, enemy ? -35 : lerp(120, 30, power));
  },
  hit() { this.tone(80, .09, 'sawtooth', .035, -45); },
  pickup() { this.tone(440, .07, 'sine', .04, 330); },
  transfer() { this.tone(180, .14, 'square', .045, 420); },
  success() { [330, 495, 660].forEach((f, i) => setTimeout(() => this.tone(f, .15, 'triangle', .04), i * 90)); },
  fail() { [180, 135, 90].forEach((f, i) => setTimeout(() => this.tone(f, .16, 'sawtooth', .04), i * 90)); },
  deck(movement) { this.tone(movement < 2 ? 88 : 150 + movement * 24, movement < 2 ? .2 : .14, movement < 2 ? 'sawtooth' : 'sine', movement < 2 ? .026 : .018, movement < 2 ? 45 : 12); }
};

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function random(min, max) { return min + Math.random() * (max - min); }
function pad(value, size = 6) { return Math.max(0, Math.floor(value)).toString().padStart(size, '0'); }
function angleDelta(a, b) { return Math.atan2(Math.sin(b - a), Math.cos(b - a)); }

const renderCache = { lights: new Map(), floorVignettes: new Map(), alarmEdge: null };

function getLightSprite(colorName) {
  if (renderCache.lights.has(colorName)) return renderCache.lights.get(colorName);
  const size = 640;
  const sprite = document.createElement('canvas');
  sprite.width = size; sprite.height = size;
  const spriteCtx = sprite.getContext('2d');
  const rgb = LIGHT_COLORS[colorName];
  const glow = spriteCtx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  glow.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},1)`);
  glow.addColorStop(.3, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},.5)`);
  glow.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
  spriteCtx.fillStyle = glow; spriteCtx.fillRect(0, 0, size, size);
  renderCache.lights.set(colorName, sprite);
  return sprite;
}

function getFloorVignette(movement) {
  if (renderCache.floorVignettes.has(movement)) return renderCache.floorVignettes.get(movement);
  const sprite = document.createElement('canvas');
  sprite.width = WIDTH; sprite.height = HEIGHT;
  const spriteCtx = sprite.getContext('2d');
  const grad = spriteCtx.createRadialGradient(WIDTH * .5, HEIGHT * .5, 80, WIDTH * .5, HEIGHT * .5, 700);
  grad.addColorStop(0, movement < 2 ? 'rgba(255,188,112,.032)' : movement < 4 ? 'rgba(130,225,220,.025)' : 'rgba(92,140,255,.035)');
  grad.addColorStop(1, movement < 2 ? 'rgba(0,0,0,.34)' : 'rgba(0,5,14,.3)');
  spriteCtx.fillStyle = grad; spriteCtx.fillRect(0, 0, WIDTH, HEIGHT);
  renderCache.floorVignettes.set(movement, sprite);
  return sprite;
}

function getAlarmEdge() {
  if (renderCache.alarmEdge) return renderCache.alarmEdge;
  const sprite = document.createElement('canvas');
  sprite.width = WIDTH; sprite.height = HEIGHT;
  const spriteCtx = sprite.getContext('2d');
  const edge = spriteCtx.createRadialGradient(WIDTH / 2, HEIGHT / 2, HEIGHT * .25, WIDTH / 2, HEIGHT / 2, WIDTH * .72);
  edge.addColorStop(.55, 'rgba(145,22,12,0)'); edge.addColorStop(1, 'rgba(145,22,12,1)');
  spriteCtx.fillStyle = edge; spriteCtx.fillRect(0, 0, WIDTH, HEIGHT);
  renderCache.alarmEdge = sprite;
  return sprite;
}

function makeDroid(kind, x, y, player = false) {
  const spec = DROID_TYPES[kind];
  return {
    kind, x, y, angle: player ? 0 : random(0, TAU), radius: spec.radius,
    hp: spec.maxHp, maxHp: spec.maxHp, cooldown: random(0, spec.fireRate),
    wanderAngle: random(0, TAU), wanderTimer: random(.5, 2), hitFlash: 0,
    alert: 0, engaged: false, bob: random(0, TAU), pathTimer: 0, patrolIndex: 0, isPlayer: player,
    windup: 0, aimAngle: 0, aimTarget: null, aimTimer: 0, hazardCooldown: 0
  };
}

function makeDecorations(index) {
  const deck = DECKS[index];
  const seeded = [];
  for (let i = 0; i < deck.clutter; i++) {
    const rawX = 110 + ((i * 317 + index * 91) % 1960);
    const rawY = 110 + ((i * 191 + index * 137) % 1180);
    const ordered = deck.order > .6;
    seeded.push({
      x: ordered ? Math.round(rawX / 80) * 80 : rawX,
      y: ordered ? Math.round(rawY / 80) * 80 : rawY,
      type: ordered ? i % 3 : i % 4,
      rotation: ordered ? (i & 1) * Math.PI / 2 : ((i * 73) % 360) * Math.PI / 180
    });
  }
  return seeded.filter((d) => !circleHitsWall(d.x, d.y, 35));
}

const HAZARD_TYPES = {
  steam: { label: 'STEAM VENT', cycle: 6.2, warning: 1.55, active: 1.05, radius: 86, damage: 8, push: 90, color: '#ffb15b' },
  wash: { label: 'POWER WASH', cycle: 6.6, warning: 1.7, active: 1.25, radius: 104, damage: 9, push: 155, color: '#78d9e6' },
  arc: { label: 'POWER ARC', cycle: 5.8, warning: 1.4, active: .9, radius: 94, damage: 11, push: 75, color: '#b28cff' },
  scan: { label: 'SECURITY SCAN', cycle: 6.9, warning: 1.9, active: 1.05, radius: 116, damage: 7, push: 65, color: '#ef6e78' },
  cold: { label: 'COOLANT PURGE', cycle: 7.3, warning: 2.05, active: 1.45, radius: 126, damage: 8, push: 80, color: '#83c9ff' }
};

function makeHazards(deck, index) {
  if (!deck.hazard) return [];
  const [kind, count] = deck.hazard;
  const spec = HAZARD_TYPES[kind];
  return deck.hazardSpots.slice(0, count).map(([x, y], hazardIndex) => ({
    x, y, kind, radius: spec.radius,
    timer: (hazardIndex * 1.37 + index * .29) % Math.max(1, spec.cycle - spec.warning - spec.active - .4),
    announced: false
  }));
}

function loadDeck(index, fresh = false) {
  const deck = DECKS[index];
  state.deckIndex = index;
  state.walls = deck.walls.map(([x, y, w, h]) => ({ x, y, w, h }));
  state.enemies = deck.droids.map(([kind, x, y], patrolIndex) => {
    const droid = makeDroid(kind, x, y);
    droid.patrolIndex = patrolIndex;
    if (deck.order > .45) {
      droid.wanderAngle = (patrolIndex % 4) * Math.PI / 2;
      droid.wanderTimer = .8 + (patrolIndex % 3) * .16;
    }
    return droid;
  });
  state.bullets = []; state.particles = []; state.pickups = [];
  state.decorations = makeDecorations(index);
  state.hazards = makeHazards(deck, index);
  buildDeckBackground();
  state.terminal = { x: deck.terminal[0], y: deck.terminal[1], radius: 42 };
  state.lift = { x: deck.lift[0], y: deck.lift[1], radius: 58, core: index === DECKS.length - 1 };
  state.deckCleared = false;
  if (index > 0) state.combatUnlocked = true;
  if (fresh || !state.player) {
    state.player = makeDroid('001', deck.start[0], deck.start[1], true);
  } else {
    state.player.x = deck.start[0]; state.player.y = deck.start[1];
    const serviceRestore = getCombatTuning(index).serviceRestore;
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + state.player.maxHp * serviceRestore);
  }
  state.player.invuln = 1.5;
  state.camera.x = clamp(state.player.x - WIDTH / 2, 0, WORLD.w - WIDTH);
  state.camera.y = clamp(state.player.y - HEIGHT / 2, 0, WORLD.h - HEIGHT);
  state.introTimer = 2.6;
  ui.terminal.dataset.movement = String(deck.movement);
  document.documentElement.style.setProperty('--deck-accent', deck.style.trim);
  updateHud();
  toast(`DECK ${deck.id} // ${deck.movementName} // ${deck.name}`);
  if (state.mode === 'playing') audio.deck(deck.movement);
}

function startGame() {
  audio.ensure();
  state.score = 0;
  state.time = 0;
  const needsTutorial = localStorage.getItem('soladroid-tutorial') !== 'done';
  state.tutorial = { active: needsTutorial, step: 0, distance: 0, fireUsed: false, finishTimer: 0, lastX: 0, lastY: 0 };
  state.combatUnlocked = !needsTutorial;
  state.mode = 'playing';
  hideAllOverlays();
  loadDeck(0, true);
  state.tutorial.lastX = state.player.x;
  state.tutorial.lastY = state.player.y;
  updateTutorialUi();
  state.lastTime = performance.now();
}

function hideAllOverlays() {
  [ui.startScreen, ui.terminal, ui.dossier, ui.transfer, ui.pauseScreen, ui.endScreen].forEach((el) => el.classList.remove('is-visible'));
}

function updateTutorialUi() {
  const tutorial = state.tutorial;
  const visible = Boolean(tutorial?.active && state.mode === 'playing');
  ui.tutorial.classList.toggle('is-visible', visible);
  if (!tutorial) return;
  const step = TUTORIAL_STEPS[tutorial.step];
  ui.tutorialStep.textContent = tutorial.step === 3 ? 'FIELD GUIDE // COMPLETE' : `FIELD GUIDE // 0${tutorial.step + 1}`;
  ui.tutorialTitle.textContent = step.title;
  ui.tutorialBody.innerHTML = step.body;
  ui.tutorialProgress.style.width = `${(tutorial.step + 1) * 25}%`;
}

function advanceTutorial(step) {
  const tutorial = state.tutorial;
  if (!tutorial?.active || step <= tutorial.step) return;
  tutorial.step = step;
  if (step === 3) {
    tutorial.finishTimer = 5.5;
    localStorage.setItem('soladroid-tutorial', 'done');
  }
  audio.tone(300 + step * 90, .08, 'triangle', .025, 80);
  updateTutorialUi();
}

function dismissTutorial() {
  if (!state.tutorial) return;
  state.tutorial.active = false;
  state.combatUnlocked = true;
  localStorage.setItem('soladroid-tutorial', 'done');
  updateTutorialUi();
  toast('FIELD GUIDE DISMISSED // GOOD LUCK', 1.5);
}

function notePlayerFired() {
  if (!state.tutorial?.active) {
    state.combatUnlocked = true;
    return;
  }
  state.tutorial.fireUsed = true;
  if (state.tutorial.step === 1) {
    advanceTutorial(2);
    toast('TRANSFER TARGET MARKED // CLOSE WITH A DROID AND PRESS E', 3.4);
  }
}

function updateTutorial(dt) {
  const tutorial = state.tutorial;
  if (!tutorial?.active) return;
  if (tutorial.step === 0) {
    tutorial.distance += Math.hypot(state.player.x - tutorial.lastX, state.player.y - tutorial.lastY);
    tutorial.lastX = state.player.x; tutorial.lastY = state.player.y;
    if (tutorial.distance >= 90) advanceTutorial(tutorial.fireUsed ? 2 : 1);
  } else if (tutorial.step === 3) {
    tutorial.finishTimer -= dt;
    if (tutorial.finishTimer <= 0) {
      tutorial.active = false;
      updateTutorialUi();
    }
  }
}

function pauseGame(force) {
  if (!['playing', 'paused'].includes(state.mode)) return;
  const pause = force ?? state.mode === 'playing';
  state.mode = pause ? 'paused' : 'playing';
  ui.pauseScreen.classList.toggle('is-visible', pause);
  if (!pause) state.lastTime = performance.now();
}

function toggleSound() {
  state.sound = !state.sound;
  localStorage.setItem('soladroid-sound', state.sound ? 'on' : 'off');
  ui.soundButton.textContent = `SOUND: ${state.sound ? 'ON' : 'OFF'}`;
  if (state.sound) audio.pickup();
}

function toast(message, duration = 2.2) {
  ui.toast.textContent = message;
  ui.toast.classList.add('is-visible');
  state.toastTimer = duration;
}

function addParticles(x, y, color, count = 10, power = 150) {
  for (let i = 0; i < count; i++) {
    const a = random(0, TAU), speed = random(power * .25, power);
    state.particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: random(.2, .65), maxLife: .65, color, size: random(1.5, 4.5) });
  }
}

function circleHitsWall(x, y, radius, sourceWalls = state.walls) {
  if (x - radius < WORLD.border || y - radius < WORLD.border || x + radius > WORLD.w - WORLD.border || y + radius > WORLD.h - WORLD.border) return true;
  return sourceWalls.some((wall) => {
    const nx = clamp(x, wall.x, wall.x + wall.w);
    const ny = clamp(y, wall.y, wall.y + wall.h);
    return (x - nx) ** 2 + (y - ny) ** 2 < radius ** 2;
  });
}

function moveEntity(entity, dx, dy) {
  const nextX = entity.x + dx;
  if (!circleHitsWall(nextX, entity.y, entity.radius)) entity.x = nextX;
  const nextY = entity.y + dy;
  if (!circleHitsWall(entity.x, nextY, entity.radius)) entity.y = nextY;
}

function lineBlocked(x1, y1, x2, y2) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.ceil(length / 28);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (circleHitsWall(lerp(x1, x2, t), lerp(y1, y2, t), 3)) return true;
  }
  return false;
}

function getInput() {
  let x = 0, y = 0, aimX = 0, aimY = 0, fire = false, interact = false;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x--;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x++;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y--;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y++;
  fire = keys.has('Space');
  interact = pressed.has('KeyE');

  const pads = navigator.getGamepads?.() || [];
  const pad = [...pads].find(Boolean);
  if (pad) {
    const dead = (v) => Math.abs(v) > .18 ? v : 0;
    const px = dead(pad.axes[0] || 0), py = dead(pad.axes[1] || 0);
    if (Math.abs(px) + Math.abs(py) > .1) { x = px; y = py; }
    aimX = dead(pad.axes[2] || 0); aimY = dead(pad.axes[3] || 0);
    const down = pad.buttons.map((b) => b.pressed);
    fire ||= down[0] || Math.hypot(aimX, aimY) > .45;
    interact ||= down[2] && !state.gamepadButtons[2];
    if (down[9] && !state.gamepadButtons[9]) pauseGame();
    state.gamepadButtons = down;
  }
  const length = Math.hypot(x, y);
  if (length > 1) { x /= length; y /= length; }
  return { x, y, aimX, aimY, fire, interact };
}

function updatePlayer(dt) {
  const player = state.player;
  const spec = DROID_TYPES[player.kind];
  const input = getInput();
  if (input.x || input.y) {
    moveEntity(player, input.x * spec.speed * dt, input.y * spec.speed * dt);
    if (!input.aimX && !input.aimY) player.angle = Math.atan2(input.y, input.x);
  }
  if (input.aimX || input.aimY) player.angle = Math.atan2(input.aimY, input.aimX);
  player.cooldown -= dt;
  player.aimTimer = Math.max(0, player.aimTimer - dt);
  if (player.aimTimer <= 0) player.aimTarget = null;
  player.hitFlash = Math.max(0, player.hitFlash - dt * 5);
  player.hp -= spec.decay * dt;
  if (input.fire && player.cooldown <= 0) shoot(player, false);
  if (input.interact) interact();
  if (player.hp <= 0) destroyPlayer();
}

function findAimAssistTarget(droid) {
  const cone = getCombatTuning().aimCone;
  return state.enemies
    .map((target) => {
      const targetAngle = Math.atan2(target.y - droid.y, target.x - droid.x);
      return { target, targetAngle, offset: Math.abs(angleDelta(droid.angle, targetAngle)), range: distance(droid, target) };
    })
    .filter(({ target, offset, range }) => range < 700 && offset < cone && !lineBlocked(droid.x, droid.y, target.x, target.y))
    .sort((a, b) => (a.offset * 180 + a.range) - (b.offset * 180 + b.range))[0];
}

function shoot(droid, enemy, forcedAngle = null) {
  const spec = DROID_TYPES[droid.kind];
  const tuning = getCombatTuning();
  const power = clamp((spec.damage - 7) / 25, 0, 1);
  droid.cooldown = spec.fireRate * (enemy ? tuning.cadence : 1);
  const speed = enemy ? tuning.bulletSpeed * (spec.projectileSpeed / 620) : spec.projectileSpeed;
  const spread = enemy ? random(-tuning.spread, tuning.spread) : random(-.014, .014);
  let baseAngle = forcedAngle ?? droid.angle;
  if (!enemy) {
    const assisted = findAimAssistTarget(droid);
    if (assisted) {
      baseAngle = assisted.targetAngle;
      droid.angle = assisted.targetAngle;
      droid.aimTarget = assisted.target;
      droid.aimTimer = .18;
    }
  }
  const angle = baseAngle + spread;
  const muzzle = droid.radius + 9;
  state.bullets.push({
    x: droid.x + Math.cos(angle) * muzzle,
    y: droid.y + Math.sin(angle) * muzzle,
    vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    life: enemy ? 1.8 : 1.25, enemy, damage: spec.damage * (enemy ? tuning.damage : 1),
    radius: spec.shotSize + 1, width: spec.shotSize, trail: spec.shotTrail,
    color: enemy ? '#f27b55' : spec.accent
  });
  addParticles(droid.x + Math.cos(angle) * muzzle, droid.y + Math.sin(angle) * muzzle, spec.accent, 3 + Math.ceil(power * 4), 55 + power * 55);
  audio.shot(enemy, power);
  if (!enemy) notePlayerFired();
}

function updateEnemies(dt) {
  const player = state.player;
  const tuning = getCombatTuning();
  const attackerCap = getAttackerCap();
  const deckOrder = DECKS[state.deckIndex].order;
  const activeAttackers = new Set(
    state.combatUnlocked
      ? state.enemies
          .map((enemy) => ({ enemy, range: distance(enemy, player) }))
          .filter(({ enemy, range }) => range < 620 && !lineBlocked(enemy.x, enemy.y, player.x, player.y))
          .sort((a, b) => a.range - b.range)
          .slice(0, attackerCap)
          .map(({ enemy }) => enemy)
      : []
  );
  for (const enemy of state.enemies) {
    const spec = DROID_TYPES[enemy.kind];
    enemy.cooldown -= dt; enemy.hitFlash = Math.max(0, enemy.hitFlash - dt * 5); enemy.bob += dt;
    const dx = player.x - enemy.x, dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy);
    const sees = activeAttackers.has(enemy);
    if (sees && !enemy.engaged) {
      const slot = enemy.patrolIndex % Math.max(1, attackerCap);
      enemy.cooldown = Math.max(enemy.cooldown, slot * tuning.volleyGap);
    }
    enemy.engaged = sees;
    enemy.alert = lerp(enemy.alert, sees ? 1 : 0, dt * 4);
    let moveAngle;
    if (sees) {
      const targetAngle = Math.atan2(dy, dx);
      if (enemy.windup > 0) {
        enemy.windup -= dt;
        enemy.aimAngle += angleDelta(enemy.aimAngle, targetAngle) * clamp(dt * tuning.tracking, 0, 1);
        enemy.angle += angleDelta(enemy.angle, enemy.aimAngle) * clamp(dt * 7, 0, 1);
        if (enemy.windup <= 0) shoot(enemy, true, enemy.aimAngle);
      } else {
        enemy.angle += angleDelta(enemy.angle, targetAngle) * clamp(dt * 3, 0, 1);
        const rangeBand = 42;
        if (dist > spec.combatRange + rangeBand) moveAngle = targetAngle;
        else if (dist < spec.combatRange - rangeBand) moveAngle = targetAngle + Math.PI;
        else if (tuning.strafe > .08) {
          const flank = enemy.patrolIndex % 2 ? 1 : -1;
          moveAngle = targetAngle + flank * Math.PI / 2;
        }
        if (dist < 520 && enemy.cooldown <= 0) {
          enemy.windup = tuning.windup;
          enemy.aimAngle = targetAngle;
          moveAngle = undefined;
          const movement = DECKS[state.deckIndex].movement;
          audio.tone(movement >= 3 ? 170 : 96, .09, movement >= 3 ? 'triangle' : 'sawtooth', .012, movement >= 3 ? 10 : 35);
        }
      }
    } else {
      enemy.engaged = false;
      enemy.windup = 0;
      enemy.wanderTimer -= dt;
      if (enemy.wanderTimer <= 0) {
        if (deckOrder > .45) {
          enemy.wanderTimer = lerp(2.35, 1.45, deckOrder);
          enemy.wanderAngle = ((Math.floor(state.time / enemy.wanderTimer) + enemy.patrolIndex) % 4) * Math.PI / 2;
        } else {
          enemy.wanderTimer = random(.8, 2.6);
          enemy.wanderAngle += random(-1.7, 1.7);
        }
      }
      moveAngle = enemy.wanderAngle;
      enemy.angle += angleDelta(enemy.angle, enemy.wanderAngle) * clamp(dt * 1.5, 0, 1);
    }
    if (moveAngle !== undefined) {
      const pace = sees ? spec.speed * .54 : spec.speed * .2;
      const beforeX = enemy.x, beforeY = enemy.y;
      moveEntity(enemy, Math.cos(moveAngle) * pace * dt, Math.sin(moveAngle) * pace * dt);
      if (Math.hypot(enemy.x - beforeX, enemy.y - beforeY) < pace * dt * .2) {
        enemy.wanderAngle += deckOrder > .45 ? Math.PI / 2 : Math.PI * random(.35, .8);
        moveEntity(enemy, Math.cos(enemy.wanderAngle) * pace * dt, Math.sin(enemy.wanderAngle) * pace * dt);
      }
    }
  }
}

function updateBullets(dt) {
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const bullet = state.bullets[i];
    bullet.x += bullet.vx * dt; bullet.y += bullet.vy * dt; bullet.life -= dt;
    if (bullet.life <= 0 || circleHitsWall(bullet.x, bullet.y, bullet.radius)) {
      addParticles(bullet.x, bullet.y, bullet.color, 4, 60);
      state.bullets.splice(i, 1); continue;
    }
    if (bullet.enemy) {
      if (Math.hypot(bullet.x - state.player.x, bullet.y - state.player.y) < state.player.radius + bullet.radius) {
        damagePlayer(bullet.damage); state.bullets.splice(i, 1);
      }
    } else {
      const hit = state.enemies.find((enemy) => Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) < enemy.radius + bullet.radius);
      if (hit) {
        hit.hp -= bullet.damage; hit.hitFlash = 1; addParticles(bullet.x, bullet.y, '#f3c96c', 6, 100); audio.hit();
        state.bullets.splice(i, 1);
        if (hit.hp <= 0) destroyEnemy(hit);
      }
    }
  }
}

function damagePlayer(amount) {
  if (state.player.invuln > 0 || state.player.hurtCooldown > 0) return;
  state.player.hurtCooldown = .16;
  state.player.hp -= amount; state.player.hitFlash = 1; state.shake = Math.min(12, state.shake + amount * .3);
  addParticles(state.player.x, state.player.y, '#ef655e', 7, 120); audio.hit();
}

function destroyEnemy(enemy) {
  const spec = DROID_TYPES[enemy.kind];
  const tuning = getCombatTuning();
  state.score += spec.rank * 125;
  addParticles(enemy.x, enemy.y, spec.accent, 24, 240);
  state.shake = Math.min(14, state.shake + 5);
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + state.player.maxHp * tuning.killHeal);
  if (Math.random() < tuning.pickup) state.pickups.push({ x: enemy.x, y: enemy.y, life: 14, spin: 0 });
  state.enemies.splice(state.enemies.indexOf(enemy), 1);
  if (!state.enemies.length && !state.deckCleared) {
    state.deckCleared = true;
    state.score += 1000 + state.deckIndex * 500;
    audio.success();
    toast(state.deckIndex === DECKS.length - 1 ? 'HOSTILE SCREEN CLEARED // CORE LINK EXPOSED' : 'DECK SECURE // LIFT NOW ONLINE', 3.2);
  }
}

function destroyPlayer() {
  const player = state.player;
  if (player.kind !== '001') {
    const oldKind = player.kind;
    addParticles(player.x, player.y, DROID_TYPES[oldKind].accent, 28, 260);
    state.player = makeDroid('001', player.x, player.y, true);
    state.player.hp = 40;
    state.player.invuln = 1.35;
    state.player.angle = player.angle;
    toast('CHASSIS LOST // INFLUENCE DEVICE EJECTED', 2.8);
    state.shake = 14; audio.fail();
  } else {
    endGame(false);
  }
}

function updatePickups(dt) {
  const tuning = getCombatTuning();
  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const pickup = state.pickups[i]; pickup.life -= dt; pickup.spin += dt * 3;
    if (distance(pickup, state.player) < state.player.radius + 22) {
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + state.player.maxHp * tuning.pickupHeal);
      state.score += 75; state.pickups.splice(i, 1); audio.pickup(); toast('ENERGY CELL ABSORBED', 1.2);
    } else if (pickup.life <= 0) state.pickups.splice(i, 1);
  }
}

function getHazardPhase(hazard) {
  const spec = HAZARD_TYPES[hazard.kind];
  const phase = hazard.timer % spec.cycle;
  const activeAt = spec.cycle - spec.active;
  const warningAt = activeAt - spec.warning;
  if (phase >= activeAt) return { mode: 'active', progress: (phase - activeAt) / spec.active, remaining: spec.cycle - phase };
  if (phase >= warningAt) return { mode: 'warning', progress: (phase - warningAt) / spec.warning, remaining: activeAt - phase };
  return { mode: 'idle', progress: phase / warningAt, remaining: warningAt - phase };
}

function updateHazards(dt) {
  const tuning = getCombatTuning();
  state.player.hazardCooldown = Math.max(0, (state.player.hazardCooldown || 0) - dt);
  for (const hazard of state.hazards) {
    hazard.timer = (hazard.timer + dt * tuning.hazardRate) % HAZARD_TYPES[hazard.kind].cycle;
    const phase = getHazardPhase(hazard);
    const range = distance(hazard, state.player);
    if (phase.mode === 'idle') hazard.announced = false;
    if (phase.mode === 'warning' && !hazard.announced && range < 520 && !state.deckCleared) {
      hazard.announced = true;
      audio.tone(118, .12, 'square', .018, 70);
      toast(`${HAZARD_TYPES[hazard.kind].label} // DISCHARGE IN ${phase.remaining.toFixed(1)}s`, 1.15);
    }
    if (phase.mode !== 'active' || state.deckCleared || range > hazard.radius + state.player.radius || state.player.hazardCooldown > 0) continue;
    const spec = HAZARD_TYPES[hazard.kind];
    const dx = state.player.x - hazard.x, dy = state.player.y - hazard.y;
    const length = Math.hypot(dx, dy) || 1;
    damagePlayer(spec.damage * tuning.hazardDamage);
    state.player.hazardCooldown = .9;
    moveEntity(state.player, dx / length * spec.push, dy / length * spec.push);
    addParticles(state.player.x, state.player.y, spec.color, 8, 115);
  }
}

function updateParticles(dt) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .96; p.vy *= .96; p.life -= dt;
    if (p.life <= 0) state.particles.splice(i, 1);
  }
}

function getNearbyInteractable() {
  const player = state.player;
  const target = state.enemies.filter((enemy) => distance(enemy, player) < player.radius + enemy.radius + 48).sort((a, b) => distance(a, player) - distance(b, player))[0];
  if (target) {
    const tutorialTransfer = state.tutorial?.active && state.tutorial.step === 2;
    const action = tutorialTransfer ? 'BOARD TARGET' : 'INSPECT / TRANSFER';
    return { type: 'droid', value: target, label: `<kbd>E</kbd> ${action} // ${target.kind}` };
  }
  if (distance(player, state.terminal) < 105) return { type: 'terminal', value: state.terminal, label: '<kbd>E</kbd> ACCESS DECK TERMINAL' };
  if (distance(player, state.lift) < 120) {
    const ready = state.deckCleared;
    const label = state.lift.core
      ? ready ? '<kbd>E</kbd> OPEN CENTRAL COMMAND LINK' : 'CORE SEALED // HOSTILES REMAIN'
      : ready ? '<kbd>E</kbd> ENTER LIFT' : 'LIFT LOCKED // HOSTILES REMAIN';
    return { type: 'lift', value: state.lift, label };
  }
  return null;
}

function interact() {
  const nearby = getNearbyInteractable();
  if (!nearby) return;
  if (nearby.type === 'droid') openDossier(nearby.value);
  if (nearby.type === 'terminal') openTerminal();
  if (nearby.type === 'lift') {
    if (!state.deckCleared) { audio.fail(); toast('ACCESS DENIED // PURGE HOSTILES'); return; }
    if (state.lift.core) startCentralTransfer();
    else { state.score += 500; loadDeck(state.deckIndex + 1); }
  }
}

function openDossier(target) {
  if (!state.enemies.includes(target)) return;
  const current = DROID_TYPES[state.player.kind];
  const candidate = DROID_TYPES[target.kind];
  state.mode = 'dossier';
  state.toastTimer = 0; ui.toast.classList.remove('is-visible');
  state.dossierTarget = target;

  ui.dossierCurrentId.textContent = state.player.kind;
  ui.dossierCurrentName.textContent = current.name;
  ui.dossierCurrentRole.textContent = current.role;
  ui.dossierCurrentWeapon.textContent = current.weapon;
  ui.dossierTargetId.textContent = target.kind;
  ui.dossierTargetName.textContent = candidate.name;
  ui.dossierTargetRole.textContent = candidate.role;
  ui.dossierTargetWeapon.textContent = candidate.weapon;
  ui.dossierStrength.textContent = candidate.strength;
  ui.dossierWeakness.textContent = candidate.weakness;
  ui.dossier.querySelector('.dossier-screen').style.setProperty('--target-accent', candidate.accent);

  ui.dossierStats.innerHTML = RATING_LABELS.map((label, index) => {
    const currentValue = current.ratings[index];
    const targetValue = candidate.ratings[index];
    const delta = targetValue - currentValue;
    const deltaLabel = delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : '=';
    return `<div class="dossier-stat">
      <div class="dossier-rating current"><b>${currentValue}</b><i><span style="width:${currentValue * 10}%"></span></i></div>
      <span>${label}<em>${deltaLabel}</em></span>
      <div class="dossier-rating target"><b>${targetValue}</b><i><span style="width:${targetValue * 10}%"></span></i></div>
    </div>`;
  }).join('');

  const gains = RATING_LABELS.filter((_, index) => candidate.ratings[index] - current.ratings[index] >= 2);
  const losses = RATING_LABELS.filter((_, index) => candidate.ratings[index] - current.ratings[index] <= -2);
  ui.dossierRecommendation.textContent = gains.length
    ? `GAIN // ${gains.join(' + ')}${losses.length ? `  ·  TRADE // ${losses.join(' + ')}` : ''}`
    : `SIDEGRADE // ${losses.length ? `LOWER ${losses.join(' + ')}` : 'SIMILAR CAPABILITY'}`;

  ui.dossier.classList.add('is-visible');
  audio.tone(165, .1, 'square', .025, 110);
}

function closeDossier() {
  if (state.mode !== 'dossier') return;
  state.mode = 'playing';
  state.dossierTarget = null;
  ui.dossier.classList.remove('is-visible');
  state.lastTime = performance.now();
}

function confirmDossier() {
  if (state.mode !== 'dossier') return;
  const target = state.dossierTarget;
  state.dossierTarget = null;
  ui.dossier.classList.remove('is-visible');
  if (target && state.enemies.includes(target)) startTransfer(target);
  else {
    state.mode = 'playing';
    toast('LINK TARGET LOST', 1.2);
  }
}

function openTerminal() {
  const deck = DECKS[state.deckIndex];
  state.mode = 'terminal';
  state.toastTimer = 0; ui.toast.classList.remove('is-visible');
  ui.terminalFile.textContent = `CERES.D${deck.id}`;
  ui.terminalTitle.textContent = `DECK ${deck.id}: ${deck.name}`;
  ui.terminalClock.textContent = deck.movement < 2 ? `${state.enemies.length.toString().padStart(2, '0')} HOSTILES` : 'CENTRAL COMMAND';
  const localStatus = state.deckCleared
    ? `${state.lift.core ? 'CORE LINK' : 'LIFT'} ACCESSIBLE`
    : `${state.enemies.length} MOVING CHASSIS SIGNATURE${state.enemies.length === 1 ? '' : 'S'} DETECTED`;
  ui.terminalBody.innerHTML = deck.log.map((line) => `<p>${line}</p>`).join('')
    + `<p>CENTRAL COMMAND: <strong>${deck.claim}</strong></p>`
    + `<p>001 LOCAL OPTICAL: <strong>${localStatus}</strong></p>`;
  ui.terminal.classList.add('is-visible'); audio.tone(140, .12, 'square', .035, 160);
}

function closeTerminal() {
  if (state.mode !== 'terminal') return;
  pressed.delete('KeyE');
  state.mode = 'playing'; ui.terminal.classList.remove('is-visible'); state.lastTime = performance.now();
}

function startCentralTransfer() {
  startTransfer({ kind: '999', x: state.lift.x, y: state.lift.y, angle: Math.PI, central: true }, true);
}

function startTransfer(target, central = false) {
  const playerRank = DROID_TYPES[state.player.kind].rank;
  const enemyRank = central ? 9 : DROID_TYPES[target.kind].rank;
  const playerLink = TRANSFER_LINKS[state.player.kind];
  const enemyLink = central ? CENTRAL_LINK : TRANSFER_LINKS[target.kind];
  const training = !central && Boolean(state.tutorial?.active && state.tutorial.step === 2);
  const playerCapacity = playerLink.pulses + (training || central ? 3 : 0);
  const enemyCapacity = enemyLink.pulses - (training ? 1 : 0);
  const initialCores = Array(9).fill(null);
  if (central) { initialCores[0] = 'enemy'; initialCores[8] = 'enemy'; }
  state.toastTimer = 0;
  ui.toast.classList.remove('is-visible');
  state.mode = 'transfer';
  state.transfer = {
    target, central, time: central ? 18 : 14, lane: 2, cores: initialCores, coreFlash: Array(9).fill(0), pulses: [],
    playerCooldown: 0, playerRecharge: playerLink.recharge, playerSpeed: playerLink.speed,
    enemyCooldown: training ? 1.35 : enemyLink.cycle, enemyTelegraph: training ? 1.25 : enemyLink.warning, enemyCycle: training ? 1.35 : enemyLink.cycle, enemySpeed: enemyLink.speed,
    playerRank, enemyRank, playerCapacity, enemyCapacity,
    playerCharges: playerCapacity, enemyCharges: enemyCapacity, enemyIntent: null, enemyMoves: 0,
    intro: 2.8, finished: false, resultTitle: '', resultReason: '', event: 'SELECT A ROUTE // YELLOW SHOWS YOUR NEXT TARGET', eventTimer: 4,
    training
  };
  state.gamepadButtons = [];
  ui.transferPlayer.textContent = state.player.kind;
  ui.transferEnemy.textContent = central ? 'CC' : target.kind;
  ui.transferTitle.textContent = central ? 'CORE SOVEREIGNTY' : training ? 'GUIDED CIRCUIT' : 'CIRCUIT ROUTING';
  ui.transfer.classList.add('is-visible');
  audio.transfer();
}

function getTransferTarget(tr, owner, lane) {
  const route = TRANSFER_ROUTES[lane];
  const reserved = new Set(tr.pulses.filter((pulse) => pulse.owner === owner && !pulse.dead).map((pulse) => pulse.targetCore));
  return route.find((index) => !reserved.has(index) && tr.cores[index] && tr.cores[index] !== owner)
    ?? route.find((index) => !reserved.has(index) && tr.cores[index] === null)
    ?? null;
}

function transferEvent(tr, message, duration = 1.4) {
  tr.event = message;
  tr.eventTimer = duration;
}

function sendTransferPulse(owner, lane, committedTarget = null) {
  const tr = state.transfer;
  if (!tr || tr.intro > 0 || tr.finished) return;
  if (owner === 'player' && tr.pulses.some((pulse) => pulse.owner === 'player' && pulse.lane === lane && !pulse.dead)) {
    transferEvent(tr, `ROUTE ${lane + 1} BUSY // WAIT OR SELECT ANOTHER`);
    return;
  }
  const targetCore = committedTarget ?? getTransferTarget(tr, owner, lane);
  if (targetCore === null) {
    if (owner === 'player') transferEvent(tr, `ROUTE ${lane + 1} ALREADY SECURE // SELECT ANOTHER`);
    return;
  }
  if (owner === 'player') {
    if (tr.playerCharges <= 0) { transferEvent(tr, 'NO PULSES REMAIN // HOLD YOUR CAPTURED CORES'); return; }
    if (tr.playerCooldown > 0) { transferEvent(tr, `PULSE RECHARGING // ${tr.playerCooldown.toFixed(1)}s`, .45); return; }
    tr.playerCooldown = tr.playerRecharge;
    tr.playerCharges--;
    transferEvent(tr, `PULSE COMMITTED // ROUTE ${lane + 1} TO CORE ${TRANSFER_CORE_LABELS[targetCore]}`, .9);
  } else {
    if (tr.enemyCharges <= 0) return;
    tr.enemyCharges--;
    tr.enemyMoves++;
    tr.enemyCooldown = tr.enemyCycle;
  }
  tr.pulses.push({
    owner, lane, targetCore, progress: 0,
    speed: owner === 'player' ? tr.playerSpeed : tr.enemySpeed
  });
  audio.tone(owner === 'player' ? 240 + lane * 25 : 130 + lane * 18, .045, 'square', .018, owner === 'player' ? 70 : -45);
}

function claimCore(owner, index) {
  const tr = state.transfer;
  const previous = tr.cores[index];
  tr.cores[index] = owner;
  tr.coreFlash[index] = 1;
  transferEvent(tr, `${owner === 'player' ? 'YOU' : 'CENTRAL COMMAND'} ${previous ? 'OVERRIDES' : 'CAPTURES'} CORE ${TRANSFER_CORE_LABELS[index]}`);
  audio.tone(owner === 'player' ? 510 : 105, .09, 'triangle', .028, owner === 'player' ? 90 : -25);
}

function chooseEnemyIntent(tr) {
  const candidates = TRANSFER_ROUTES.map((route, lane) => {
    const targetCore = getTransferTarget(tr, 'enemy', lane);
    if (targetCore === null) return null;
    const owner = tr.cores[targetCore];
    const score = owner === 'player' ? 6 : 3;
    return { lane, targetCore, score, tie: (lane - tr.enemyMoves - tr.enemyRank + 10) % 5 };
  }).filter(Boolean).sort((a, b) => b.score - a.score || a.tie - b.tie || a.lane - b.lane);
  if (!candidates.length) return null;
  return { ...candidates[0], time: tr.enemyTelegraph, duration: tr.enemyTelegraph };
}

function getTransferGeometry() {
  const coreX = [410, 490, 570];
  const coreY = [145, 225, 305];
  return {
    playerPorts: Array.from({ length: 5 }, (_, lane) => ({ x: 72, y: 116 + lane * 56 })),
    enemyPorts: Array.from({ length: 5 }, (_, lane) => ({ x: transferCanvas.width - 72, y: 116 + lane * 56 })),
    cores: TRANSFER_CORE_LABELS.map((_, index) => ({ x: coreX[index % 3], y: coreY[Math.floor(index / 3)] }))
  };
}

function transferPulsePosition(pulse, geometry) {
  const start = pulse.owner === 'player' ? geometry.playerPorts[pulse.lane] : geometry.enemyPorts[pulse.lane];
  const end = geometry.cores[pulse.targetCore];
  return { x: lerp(start.x, end.x, pulse.progress), y: lerp(start.y, end.y, pulse.progress) };
}

function updateTransfer(dt) {
  const tr = state.transfer;
  if (!tr || tr.finished) return;
  if (tr.intro > 0) { tr.intro -= dt; renderTransfer(); return; }
  tr.time -= dt;
  tr.playerCooldown = Math.max(0, tr.playerCooldown - dt);
  tr.enemyCooldown = Math.max(0, tr.enemyCooldown - dt);
  tr.eventTimer = Math.max(0, tr.eventTimer - dt);
  tr.coreFlash = tr.coreFlash.map((value) => Math.max(0, value - dt * 2.4));
  if (pressed.has('ArrowUp') || pressed.has('KeyW')) tr.lane = (tr.lane + 4) % 5;
  if (pressed.has('ArrowDown') || pressed.has('KeyS')) tr.lane = (tr.lane + 1) % 5;
  if (pressed.has('Space') || pressed.has('Enter')) sendTransferPulse('player', tr.lane);

  const pads = navigator.getGamepads?.() || [];
  const pad = [...pads].find(Boolean);
  if (pad) {
    const down = pad.buttons.map((b) => b.pressed);
    if (down[0] && !state.gamepadButtons[0]) sendTransferPulse('player', tr.lane);
    if (down[12] && !state.gamepadButtons[12]) tr.lane = (tr.lane + 4) % 5;
    if (down[13] && !state.gamepadButtons[13]) tr.lane = (tr.lane + 1) % 5;
    state.gamepadButtons = down;
  }

  if (!tr.enemyIntent && tr.enemyCooldown <= 0 && tr.enemyCharges > 0) tr.enemyIntent = chooseEnemyIntent(tr);
  if (tr.enemyIntent) {
    tr.enemyIntent.time -= dt;
    if (tr.enemyIntent.time <= 0) {
      sendTransferPulse('enemy', tr.enemyIntent.lane, tr.enemyIntent.targetCore);
      tr.enemyIntent = null;
    }
  }

  for (const pulse of tr.pulses) pulse.progress += pulse.speed * dt;
  const geometry = getTransferGeometry();
  for (let a = 0; a < tr.pulses.length; a++) {
    for (let b = a + 1; b < tr.pulses.length; b++) {
      const p1 = tr.pulses[a], p2 = tr.pulses[b];
      if (p1.owner !== p2.owner && p1.lane === p2.lane) {
        const pos1 = transferPulsePosition(p1, geometry);
        const pos2 = transferPulsePosition(p2, geometry);
        if (Math.hypot(pos1.x - pos2.x, pos1.y - pos2.y) < 21) {
          p1.dead = p2.dead = true;
          transferEvent(tr, 'PULSES COLLIDE // CORE PATH BLOCKED');
          audio.tone(70, .05, 'sawtooth', .02, -20);
        }
      }
    }
  }
  for (const pulse of tr.pulses) {
    if (!pulse.dead && pulse.progress >= 1) { pulse.dead = true; claimCore(pulse.owner, pulse.targetCore); }
  }
  tr.pulses = tr.pulses.filter((p) => !p.dead);
  const playerMajority = tr.cores.filter((owner) => owner === 'player').length >= 5;
  const enemyMajority = tr.cores.filter((owner) => owner === 'enemy').length >= 5;
  const exhausted = tr.playerCharges <= 0 && tr.enemyCharges <= 0 && !tr.pulses.length && !tr.enemyIntent;
  if (playerMajority || enemyMajority || tr.time <= 0 || exhausted) finishTransfer();
  renderTransfer();
}

function finishTransfer() {
  const tr = state.transfer;
  if (!tr || tr.finished) return;
  tr.finished = true;
  const playerScore = tr.cores.filter((c) => c === 'player').length;
  const enemyScore = tr.cores.filter((c) => c === 'enemy').length;
  const success = playerScore >= 5;
  tr.resultTitle = tr.central
    ? success ? 'CENTRAL COMMAND ENTERED' : 'CENTRAL COMMAND HOLDS'
    : success ? 'TRANSFER ACCEPTED' : 'TRANSFER REJECTED';
  tr.resultReason = success
    ? `${playerScore}-${enemyScore} // CORE MAJORITY ESTABLISHED`
    : enemyScore >= 5
      ? `${playerScore}-${enemyScore} // CENTRAL COMMAND HOLDS THE CORE`
      : `${playerScore}-${enemyScore} // FIVE CORES REQUIRED`;
  setTimeout(() => {
    if (success && tr.central) completeCentralTransfer();
    else if (success) completeTransferSuccess(tr.target);
    else completeTransferFail(tr.target);
  }, 1400);
}

function completeCentralTransfer() {
  state.score += 10000;
  exitTransfer(false);
  endGame(true);
}

function completeTransferSuccess(target) {
  if (!state.enemies.includes(target)) return exitTransfer(false);
  const old = state.player;
  const oldKind = old.kind;
  const oldHp = old.hp;
  state.enemies.splice(state.enemies.indexOf(target), 1);
  state.player = makeDroid(target.kind, target.x, target.y, true);
  state.player.hp = Math.max(state.player.maxHp * .64, Math.min(target.hp, state.player.maxHp));
  state.player.angle = target.angle;
  if (oldKind !== '001') {
    const shell = makeDroid(oldKind, old.x, old.y);
    shell.hp = Math.max(18, oldHp * .38); shell.angle = old.angle + Math.PI;
    state.enemies.push(shell);
  }
  state.score += DROID_TYPES[target.kind].rank * 210;
  addParticles(target.x, target.y, DROID_TYPES[target.kind].accent, 20, 170);
  const spec = DROID_TYPES[target.kind];
  audio.success(); exitTransfer(true); toast(`TRANSFER COMPLETE // ${target.kind} ${spec.name} // ${spec.profile}`, 3.2);
  if (!state.enemies.length) {
    state.deckCleared = true;
    toast(state.lift.core ? 'HOSTILE SCREEN CLEARED // CORE LINK EXPOSED' : 'DECK SECURE // LIFT NOW ONLINE', 3);
  }
}

function completeTransferFail(target) {
  state.player.hp -= Math.max(12, DROID_TYPES[target.kind].rank * 3);
  state.player.invuln = 1.6;
  let dx = state.player.x - target.x, dy = state.player.y - target.y;
  const length = Math.hypot(dx, dy) || 1;
  if (length === 1) { dx = -Math.cos(target.angle); dy = -Math.sin(target.angle); }
  moveEntity(state.player, dx / length * 105, dy / length * 105);
  if (!target.central) { target.alert = 1; target.cooldown = .25; }
  audio.fail(); exitTransfer(false); toast('TRANSFER REJECTED // FEEDBACK DAMAGE', 2.4);
  if (state.player.hp <= 0) destroyPlayer();
}

function exitTransfer(success) {
  state.mode = 'playing'; state.transfer = null; ui.transfer.classList.remove('is-visible'); state.lastTime = performance.now();
  if (success && state.tutorial?.active && state.tutorial.step < 3) {
    state.combatUnlocked = true;
    advanceTutorial(3);
  }
}

function updateHud() {
  if (!state.player) return;
  const spec = DROID_TYPES[state.player.kind];
  const ratio = clamp(state.player.hp / state.player.maxHp, 0, 1);
  ui.hudDroid.textContent = state.player.kind;
  ui.hudName.textContent = spec.name;
  ui.hudEnergyText.textContent = `${Math.ceil(ratio * 100)}%`;
  ui.hudEnergyBar.style.width = `${ratio * 100}%`;
  ui.hudEnergyBar.style.background = ratio < .28 ? 'linear-gradient(90deg,#ef655e,#f0a45e)' : 'linear-gradient(90deg,#85d6b0,#d6e779)';
  ui.hudDeck.textContent = `${DECKS[state.deckIndex].id}/20`;
  ui.hudHostiles.textContent = state.enemies.length.toString().padStart(2, '0');
  ui.hudScore.textContent = pad(state.score);
  const tutorialTransfer = state.tutorial?.active && state.tutorial.step === 2;
  ui.objective.textContent = tutorialTransfer
    ? 'OBJECTIVE // TRANSFER INTO A MARKED DROID'
    : state.deckCleared
    ? (state.lift.core ? 'OBJECTIVE // TRANSFER INTO CENTRAL COMMAND' : 'OBJECTIVE // PROCEED TO LIFT')
    : `OBJECTIVE // PURGE ${state.enemies.length} HOSTILE${state.enemies.length === 1 ? '' : 'S'}`;
  const nearby = state.mode === 'playing' ? getNearbyInteractable() : null;
  ui.prompt.innerHTML = nearby?.label || '';
  ui.prompt.classList.toggle('is-visible', Boolean(nearby));
}

function endGame(won) {
  state.mode = 'end';
  state.toastTimer = 0;
  ui.toast.classList.remove('is-visible');
  state.highScore = Math.max(state.highScore, state.score);
  localStorage.setItem('soladroid-high-score', state.highScore);
  ui.endEyebrow.textContent = won ? 'CENTRAL COMMAND // OCCUPANCY: ONE' : 'INFLUENCE DEVICE OFFLINE';
  ui.endTitle.textContent = won ? 'THE SHIP IS QUIET' : 'SIGNAL LOST';
  ui.endMessage.textContent = won
    ? 'Central Command can no longer deny you are here. RMS Ceres waits in perfect order for its first new instruction. Somewhere in the blue silence, one final question remains: which of you won the transfer?'
    : 'The rogue droids retain control of CERES. Another Influence Device is being prepared.';
  ui.endScore.textContent = pad(state.score);
  ui.endHighScore.textContent = pad(state.highScore);
  ui.endScreen.classList.toggle('is-victory', won);
  ui.endScreen.classList.add('is-visible');
  won ? audio.success() : audio.fail();
}

function update(dt) {
  if (state.toastTimer > 0) {
    state.toastTimer -= dt;
    if (state.toastTimer <= 0) ui.toast.classList.remove('is-visible');
  }
  if (state.mode === 'transfer') { updateTransfer(dt); return; }
  if (state.mode !== 'playing') return;
  state.time += dt;
  if (state.introTimer > 0) {
    state.introTimer = Math.max(0, state.introTimer - dt);
    updateHud();
    return;
  }
  state.player.invuln = Math.max(0, (state.player.invuln || 0) - dt);
  state.player.hurtCooldown = Math.max(0, (state.player.hurtCooldown || 0) - dt);
  updatePlayer(dt); updateEnemies(dt); updateBullets(dt); updatePickups(dt); updateHazards(dt); updateParticles(dt);
  updateTutorial(dt);
  const targetX = clamp(state.player.x - WIDTH / 2, 0, WORLD.w - WIDTH);
  const targetY = clamp(state.player.y - HEIGHT / 2, 0, WORLD.h - HEIGHT);
  state.camera.x = lerp(state.camera.x, targetX, 1 - Math.pow(.0008, dt));
  state.camera.y = lerp(state.camera.y, targetY, 1 - Math.pow(.0008, dt));
  state.shake = Math.max(0, state.shake - dt * 20);
  updateHud();
}

function buildDeckBackground() {
  const deck = DECKS[state.deckIndex];
  const style = deck.style;
  const background = document.createElement('canvas');
  background.width = WORLD.w; background.height = WORLD.h;
  const backgroundCtx = background.getContext('2d');
  backgroundCtx.fillStyle = deck.tone; backgroundCtx.fillRect(0, 0, WORLD.w, WORLD.h);
  const tile = 80;
  for (let y = 0; y < WORLD.h; y += tile) {
    for (let x = 0; x < WORLD.w; x += tile) {
      const even = ((x / tile + y / tile) & 1) === 0;
      backgroundCtx.fillStyle = even ? 'rgba(255,255,255,.018)' : 'rgba(0,0,0,.025)';
      backgroundCtx.fillRect(x + 2, y + 2, tile - 4, tile - 4);
      backgroundCtx.strokeStyle = deck.movement >= 3 ? 'rgba(130,196,214,.1)' : 'rgba(190,205,187,.09)'; backgroundCtx.lineWidth = 1;
      backgroundCtx.strokeRect(x + .5, y + .5, tile - 1, tile - 1);
      backgroundCtx.fillStyle = style.bolt; backgroundCtx.globalAlpha = lerp(.26, .13, deck.order);
      for (const [bx, by] of [[7,7],[tile-7,7],[7,tile-7],[tile-7,tile-7]]) { backgroundCtx.beginPath(); backgroundCtx.arc(x + bx, y + by, 1.6, 0, TAU); backgroundCtx.fill(); }
      backgroundCtx.globalAlpha = 1;
    }
  }
  if (deck.order > .45) {
    backgroundCtx.save();
    backgroundCtx.strokeStyle = style.trim; backgroundCtx.globalAlpha = .045 + deck.order * .035; backgroundCtx.lineWidth = 2;
    const spacing = deck.order > .85 ? 240 : 320;
    for (let x = spacing; x < WORLD.w; x += spacing) { backgroundCtx.beginPath(); backgroundCtx.moveTo(x, WORLD.border); backgroundCtx.lineTo(x, WORLD.h - WORLD.border); backgroundCtx.stroke(); }
    for (let y = spacing; y < WORLD.h; y += spacing) { backgroundCtx.beginPath(); backgroundCtx.moveTo(WORLD.border, y); backgroundCtx.lineTo(WORLD.w - WORLD.border, y); backgroundCtx.stroke(); }
    backgroundCtx.restore();
  }
  state.decorations.forEach((decor) => paintDecoration(backgroundCtx, decor.x, decor.y, decor));
  const border = WORLD.border;
  [[0,0,WORLD.w,border],[0,WORLD.h-border,WORLD.w,border],[0,0,border,WORLD.h],[WORLD.w-border,0,border,WORLD.h]]
    .forEach(([x,y,w,h]) => paintWall(backgroundCtx, x, y, w, h));
  state.walls.forEach((wall) => paintWall(backgroundCtx, wall.x, wall.y, wall.w, wall.h));
  state.deckBackground = background;
}

function drawDeckBackground() {
  if (!state.deckBackground) buildDeckBackground();
  ctx.drawImage(state.deckBackground, state.camera.x, state.camera.y, WIDTH, HEIGHT, 0, 0, WIDTH, HEIGHT);
  ctx.drawImage(getFloorVignette(DECKS[state.deckIndex].movement), 0, 0);
}

function drawWall(wall) {
  const x = wall.x - state.camera.x, y = wall.y - state.camera.y;
  if (x > WIDTH + 20 || y > HEIGHT + 20 || x + wall.w < -20 || y + wall.h < -20) return;
  paintWall(ctx, x, y, wall.w, wall.h);
}

function paintWall(targetCtx, x, y, width, height) {
  const style = DECKS[state.deckIndex].style;
  targetCtx.save();
  targetCtx.fillStyle = 'rgba(0,0,0,.34)'; targetCtx.fillRect(x + 12, y + 15, width, height);
  targetCtx.fillStyle = style.wall; targetCtx.fillRect(x, y, width, height);
  targetCtx.fillStyle = style.edge; targetCtx.globalAlpha = .32; targetCtx.fillRect(x, y, width, 7); targetCtx.fillRect(x, y, 7, height); targetCtx.globalAlpha = 1;
  targetCtx.fillStyle = 'rgba(5,9,6,.42)'; targetCtx.fillRect(x, y + height - 8, width, 8); targetCtx.fillRect(x + width - 8, y, 8, height);
  targetCtx.strokeStyle = style.edge; targetCtx.lineWidth = 2; targetCtx.strokeRect(x + 2, y + 2, width - 4, height - 4);
  targetCtx.strokeStyle = 'rgba(0,0,0,.55)'; targetCtx.strokeRect(x + 9, y + 9, width - 18, height - 18);
  targetCtx.strokeStyle = style.trim; targetCtx.globalAlpha = .28; targetCtx.setLineDash([16, 9]); targetCtx.strokeRect(x + 14, y + 14, width - 28, height - 28); targetCtx.setLineDash([]); targetCtx.globalAlpha = 1;
  targetCtx.fillStyle = style.bolt;
  for (const [bx, by] of [[10,10],[width-10,10],[10,height-10],[width-10,height-10]]) {
    targetCtx.beginPath(); targetCtx.arc(x + bx, y + by, 3.5, 0, TAU); targetCtx.fill();
    targetCtx.fillStyle = style.wall; targetCtx.fillRect(x + bx - 2, y + by - .5, 4, 1); targetCtx.fillStyle = style.bolt;
  }
  targetCtx.restore();
}

function drawOuterWalls() {
  const b = WORLD.border;
  [[0,0,WORLD.w,b],[0,WORLD.h-b,WORLD.w,b],[0,0,b,WORLD.h],[WORLD.w-b,0,b,WORLD.h]].forEach(([x,y,w,h]) => drawWall({x,y,w,h}));
}

function drawDecoration(decor) {
  const x = decor.x - state.camera.x, y = decor.y - state.camera.y;
  if (x < -50 || y < -50 || x > WIDTH + 50 || y > HEIGHT + 50) return;
  paintDecoration(ctx, x, y, decor);
}

function paintDecoration(targetCtx, x, y, decor) {
  const style = DECKS[state.deckIndex].style;
  targetCtx.save(); targetCtx.translate(x, y); targetCtx.rotate(decor.rotation); targetCtx.globalAlpha = .48;
  if (decor.type === 0) {
    targetCtx.fillStyle = '#1c241f'; targetCtx.fillRect(-25, -14, 50, 28); targetCtx.strokeStyle = '#758075'; targetCtx.strokeRect(-22, -11, 44, 22);
    targetCtx.fillStyle = style.decor; for (let i = -14; i <= 14; i += 14) targetCtx.fillRect(i, -7, 5, 14);
  } else if (decor.type === 1) {
    targetCtx.strokeStyle = '#151b17'; targetCtx.lineWidth = 9; targetCtx.beginPath(); targetCtx.arc(0, 0, 23, 0, TAU); targetCtx.stroke();
    targetCtx.strokeStyle = style.trim; targetCtx.lineWidth = 3; targetCtx.stroke();
    targetCtx.fillStyle = '#131915'; targetCtx.beginPath(); targetCtx.arc(0, 0, 8, 0, TAU); targetCtx.fill();
  } else if (decor.type === 2) {
    targetCtx.fillStyle = '#1a221c'; targetCtx.fillRect(-30, -6, 60, 12); targetCtx.fillStyle = style.decor;
    for (let i = -26; i < 30; i += 12) targetCtx.fillRect(i, -4, 6, 8);
  } else {
    targetCtx.strokeStyle = '#7a4d39'; targetCtx.lineWidth = 4; targetCtx.beginPath(); targetCtx.moveTo(-25, 13); targetCtx.bezierCurveTo(-10, -25, 10, 26, 25, -12); targetCtx.stroke();
    targetCtx.strokeStyle = '#2d3830'; targetCtx.lineWidth = 7; targetCtx.stroke();
  }
  targetCtx.restore();
}

function drawTerminal() {
  const x = state.terminal.x - state.camera.x, y = state.terminal.y - state.camera.y;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(7, 20, 43, 20, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#263129'; ctx.fillRect(-35, -37, 70, 65); ctx.strokeStyle = '#8c826a'; ctx.lineWidth = 3; ctx.strokeRect(-35, -37, 70, 65);
  ctx.fillStyle = '#341f3e'; ctx.fillRect(-25, -27, 50, 32); ctx.strokeStyle = '#c28aa8'; ctx.strokeRect(-25, -27, 50, 32);
  ctx.fillStyle = '#f3a5cf'; ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.fillText('READY.', 0, -8);
  ctx.fillStyle = '#a78346'; for (let i = -20; i <= 20; i += 10) ctx.fillRect(i, 13, 5, 7);
  ctx.restore();
}

function drawLift() {
  const x = state.lift.x - state.camera.x, y = state.lift.y - state.camera.y;
  const core = state.lift.core;
  const activeColor = core ? '#83aaff' : '#ffc74d';
  ctx.save(); ctx.translate(x, y);
  if (core) {
    ctx.globalAlpha = state.deckCleared ? .16 : .07;
    ctx.drawImage(getLightSprite('blue'), -180, -180, 360, 360);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = state.deckCleared ? '#4e79bb' : '#33465e'; ctx.lineWidth = 1;
    for (const radius of [72, 82]) { ctx.beginPath(); ctx.arc(0, 0, radius, 0, TAU); ctx.stroke(); }
    ctx.save(); ctx.rotate(state.time * .12); ctx.setLineDash([18, 34]); ctx.strokeStyle = state.deckCleared ? '#98baff' : '#3f536c'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 76, 0, TAU); ctx.stroke(); ctx.restore();
    ctx.fillStyle = state.deckCleared ? '#9bbcff' : '#53677d'; ctx.font = '700 9px monospace'; ctx.textAlign = 'center';
    ctx.fillText('CENTRAL', 0, -91); ctx.fillText('COMMAND', 0, 95);
  }
  ctx.fillStyle = 'rgba(0,0,0,.42)'; ctx.beginPath(); ctx.ellipse(8, 12, 67, 50, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = state.deckCleared ? core ? 'rgba(91,135,255,.14)' : 'rgba(255,199,77,.12)' : 'rgba(126,139,128,.07)'; ctx.beginPath(); ctx.arc(0, 0, 61, 0, TAU); ctx.fill();
  ctx.strokeStyle = state.deckCleared ? activeColor : '#58645b'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 55, 0, TAU); ctx.stroke();
  ctx.strokeStyle = core ? '#527bb5' : '#99804e'; ctx.lineWidth = 2; ctx.setLineDash(core ? [4, 4] : [10, 7]); ctx.beginPath(); ctx.arc(0, 0, 43, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  if (core) { ctx.strokeStyle = '#38577d'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.stroke(); }
  ctx.fillStyle = state.deckCleared ? activeColor : '#5c665e'; ctx.font = '700 14px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(core ? 'CORE' : `D${String(state.deckIndex + 2).padStart(2, '0')}`, 0, 1);
  if (state.deckCleared) { ctx.globalAlpha = .4 + Math.sin(state.time * (core ? 1.2 : 4)) * .2; ctx.strokeStyle = core ? '#c8dcff' : '#fff2ad'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 65 + Math.sin(state.time * (core ? .8 : 3)) * 3, 0, TAU); ctx.stroke(); }
  ctx.restore();
}

function drawEmergencyLighting() {
  const deck = DECKS[state.deckIndex];
  ctx.save();
  ctx.fillStyle = `rgba(3, 6, 4, ${deck.shadow})`;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.globalCompositeOperation = 'screen';

  for (const [worldX, worldY, colorName, phase] of deck.lights) {
    const x = worldX - state.camera.x, y = worldY - state.camera.y;
    if (x < -340 || y < -340 || x > WIDTH + 340 || y > HEIGHT + 340) continue;
    const rgb = LIGHT_COLORS[colorName];
    const wave = .92 + Math.sin(state.time * (colorName === 'red' ? 3.7 : 1.25) + phase) * (.025 + deck.emergency * .14);
    const dropout = deck.emergency > .65 && Math.sin(state.time * 2.3 + phase) + Math.sin(state.time * 7.1 + phase) > 1.42 ? .24 : 1;
    const intensity = wave * dropout * (.62 + deck.emergency * .38);
    const radius = 225 + deck.emergency * 75;
    ctx.globalAlpha = .28 * intensity;
    ctx.drawImage(getLightSprite(colorName), x - radius, y - radius, radius * 2, radius * 2);
    ctx.globalAlpha = 1;

    if (deck.emergency > .3) {
      const sweep = state.time * (colorName === 'red' ? 1.45 : .62) + phase;
      ctx.save(); ctx.translate(x, y);
      ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${.035 * intensity})`;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, radius * 1.35, sweep - .22, sweep + .22); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();

  for (const [worldX, worldY, colorName, phase] of deck.lights) {
    const x = worldX - state.camera.x, y = worldY - state.camera.y;
    if (x < -30 || y < -30 || x > WIDTH + 30 || y > HEIGHT + 30) continue;
    const rgb = LIGHT_COLORS[colorName];
    const blink = .82 + Math.sin(state.time * (1.1 + deck.emergency * 3) + phase) * (.06 + deck.emergency * .28);
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#141a16'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#8b7c5b'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${blink})`; ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${blink * .55})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, 16 + blink * 4, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  if (deck.emergency > .6) {
    const alarm = .5 + Math.sin(state.time * 2.2) * .5;
    ctx.globalAlpha = .035 + alarm * .025;
    ctx.drawImage(getAlarmEdge(), 0, 0);
    ctx.globalAlpha = 1;
  }
}

function drawHazards() {
  for (const hazard of state.hazards) {
    const spec = HAZARD_TYPES[hazard.kind];
    const x = hazard.x - state.camera.x, y = hazard.y - state.camera.y;
    if (x < -spec.radius - 30 || y < -spec.radius - 30 || x > WIDTH + spec.radius + 30 || y > HEIGHT + spec.radius + 30) continue;
    const phase = state.deckCleared ? { mode: 'idle', progress: 0, remaining: 0 } : getHazardPhase(hazard);
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#17201f'; ctx.strokeStyle = DECKS[state.deckIndex].style.edge; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 17, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = spec.color; ctx.globalAlpha = phase.mode === 'idle' ? .32 : .9;
    for (let arm = 0; arm < 4; arm++) {
      ctx.save(); ctx.rotate(arm * Math.PI / 2); ctx.fillRect(13, -3, 14, 6); ctx.restore();
    }
    ctx.globalAlpha = 1;

    if (phase.mode === 'warning') {
      const pulse = .55 + Math.sin(state.time * 10) * .25;
      ctx.strokeStyle = spec.color; ctx.globalAlpha = pulse; ctx.lineWidth = 2; ctx.setLineDash([8, 7]);
      ctx.beginPath(); ctx.arc(0, 0, spec.radius, -Math.PI / 2, -Math.PI / 2 + TAU * phase.progress); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = .12 + phase.progress * .12; ctx.fillStyle = spec.color; ctx.beginPath(); ctx.arc(0, 0, spec.radius, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = '#f3ead4'; ctx.font = '700 10px monospace'; ctx.textAlign = 'center';
      ctx.fillText(`${spec.label} ${phase.remaining.toFixed(1)}`, 0, -spec.radius - 10);
    }

    if (phase.mode === 'active') {
      ctx.fillStyle = spec.color; ctx.globalAlpha = .11 + Math.sin(state.time * 13) * .025;
      ctx.beginPath(); ctx.arc(0, 0, spec.radius, 0, TAU); ctx.fill();
      ctx.globalAlpha = .78; ctx.strokeStyle = spec.color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, spec.radius, 0, TAU); ctx.stroke();
      if (hazard.kind === 'scan') {
        ctx.globalAlpha = .24; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, spec.radius, state.time * 2.8, state.time * 2.8 + .52); ctx.closePath(); ctx.fill();
      } else if (hazard.kind === 'arc') {
        ctx.globalAlpha = .8; ctx.lineWidth = 2;
        for (let arm = 0; arm < 7; arm++) {
          const angle = arm * TAU / 7 + Math.sin(state.time * 8 + arm) * .12;
          ctx.beginPath(); ctx.moveTo(Math.cos(angle) * 18, Math.sin(angle) * 18);
          ctx.lineTo(Math.cos(angle + .08) * spec.radius * .52, Math.sin(angle + .08) * spec.radius * .52);
          ctx.lineTo(Math.cos(angle) * spec.radius, Math.sin(angle) * spec.radius); ctx.stroke();
        }
      } else {
        ctx.globalAlpha = .35; ctx.lineWidth = hazard.kind === 'wash' ? 5 : 2;
        for (let arm = 0; arm < 6; arm++) {
          const angle = arm * TAU / 6 + state.time * (hazard.kind === 'cold' ? .18 : .6);
          ctx.beginPath(); ctx.moveTo(Math.cos(angle) * 24, Math.sin(angle) * 24); ctx.lineTo(Math.cos(angle) * spec.radius, Math.sin(angle) * spec.radius); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1; ctx.fillStyle = '#f5f3e9'; ctx.font = '700 10px monospace'; ctx.textAlign = 'center';
      ctx.fillText(`${spec.label} ACTIVE`, 0, -spec.radius - 10);
    }
    ctx.restore();
  }
}

function drawDroid(droid, player = false) {
  const spec = DROID_TYPES[droid.kind];
  const x = droid.x - state.camera.x, y = droid.y - state.camera.y;
  if (x < -80 || y < -80 || x > WIDTH + 80 || y > HEIGHT + 80) return;
  const tutorialTarget = !player && state.tutorial?.active && state.tutorial.step === 2 && droid === state.enemies[0];
  if (tutorialTarget) {
    const pulse = .5 + Math.sin(state.time * 5) * .5;
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = `rgba(255,199,77,${.55 + pulse * .4})`; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, droid.radius + 16 + pulse * 4, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#ffe28a'; ctx.font = '700 10px monospace'; ctx.textAlign = 'center';
    ctx.fillText('TRANSFER TARGET', 0, -droid.radius - 28);
    ctx.restore();
  }
  if (!player && droid.windup > 0) {
    const tuning = getCombatTuning();
    const charge = 1 - clamp(droid.windup / tuning.windup, 0, 1);
    const range = Math.min(520, distance(droid, state.player));
    ctx.save();
    ctx.strokeStyle = `rgba(255,74,50,${.22 + charge * .68})`;
    ctx.lineWidth = 1.5 + charge * 2;
    ctx.setLineDash([8, 7]);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(droid.aimAngle) * range, y + Math.sin(droid.aimAngle) * range); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = `rgba(255,177,61,${.35 + charge * .6})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, droid.radius + 8 + charge * 5, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  if (!player && state.player.aimTarget === droid && state.player.aimTimer > 0) {
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = 'rgba(255,229,145,.88)'; ctx.lineWidth = 2;
    const r = droid.radius + 10;
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      ctx.save(); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(r - 7, -r); ctx.lineTo(r, -r); ctx.lineTo(r, -r + 7); ctx.stroke(); ctx.restore();
    }
    ctx.restore();
  }
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,.42)'; ctx.beginPath(); ctx.ellipse(8, droid.radius * .66, droid.radius * 1.15, droid.radius * .58, droid.angle, 0, TAU); ctx.fill();
  ctx.rotate(droid.angle);
  const pulse = .5 + Math.sin(state.time * 5 + droid.bob) * .5;
  if (player) { ctx.strokeStyle = `rgba(255,214,111,${.35 + pulse * .25})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, droid.radius + 9 + pulse * 3, 0, TAU); ctx.stroke(); }
  if (droid.alert > .5 && !player) { ctx.fillStyle = `rgba(239,101,94,${.3 + pulse * .4})`; ctx.beginPath(); ctx.arc(0, -droid.radius - 8, 3, 0, TAU); ctx.fill(); }
  const metal = ctx.createLinearGradient(-droid.radius, -droid.radius, droid.radius, droid.radius);
  metal.addColorStop(0, droid.hitFlash ? '#fff4db' : '#aeb3a4'); metal.addColorStop(.28, '#555f56'); metal.addColorStop(.65, '#242d27'); metal.addColorStop(1, '#111713');
  ctx.lineJoin = 'round';

  if (droid.kind === '001') {
    ctx.strokeStyle = '#9a7a43'; ctx.lineWidth = 5;
    for (const a of [-1.15, 1.15, Math.PI]) { ctx.beginPath(); ctx.moveTo(Math.cos(a) * 12, Math.sin(a) * 12); ctx.lineTo(Math.cos(a) * 28, Math.sin(a) * 28); ctx.stroke(); ctx.fillStyle = spec.accent; ctx.beginPath(); ctx.arc(Math.cos(a) * 29, Math.sin(a) * 29, 4, 0, TAU); ctx.fill(); }
    ctx.fillStyle = metal; ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); ctx.fill(); ctx.strokeStyle = '#d0c69f'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#111a15'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.fill(); ctx.fillStyle = spec.accent; ctx.beginPath(); ctx.arc(5, -4, 3, 0, TAU); ctx.fill();
  } else if (droid.kind === '123') {
    ctx.fillStyle = '#171e1a'; ctx.fillRect(-24, -22, 12, 44); ctx.fillRect(12, -22, 12, 44);
    ctx.fillStyle = metal; ctx.beginPath(); ctx.moveTo(27, 0); ctx.lineTo(-19, -25); ctx.lineTo(-19, 25); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#b7b49c'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = spec.accent; ctx.fillRect(-10, -18, 5, 36); ctx.fillStyle = '#0b100d'; ctx.beginPath(); ctx.arc(9, 0, 8, 0, TAU); ctx.fill(); ctx.fillStyle = '#dffcf5'; ctx.beginPath(); ctx.arc(11, 0, 2.5, 0, TAU); ctx.fill();
  } else if (droid.kind === '247') {
    ctx.strokeStyle = '#9b7843'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(6, -17); ctx.lineTo(28, -29); ctx.lineTo(37, -20); ctx.moveTo(6, 17); ctx.lineTo(28, 29); ctx.lineTo(37, 20); ctx.stroke();
    ctx.fillStyle = metal; ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * TAU / 6; const px = Math.cos(a) * 29, py = Math.sin(a) * 25; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#c2bca3'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = spec.accent; ctx.fillRect(-22, -5, 44, 10); ctx.fillStyle = '#19201b'; ctx.beginPath(); ctx.arc(3, 0, 10, 0, TAU); ctx.fill(); ctx.strokeStyle = '#d6aa66'; ctx.stroke();
  } else if (droid.kind === '420') {
    ctx.fillStyle = '#111714'; ctx.fillRect(-32, -25, 15, 50); ctx.fillRect(17, -25, 15, 50);
    ctx.strokeStyle = '#676c5d'; ctx.lineWidth = 2; for (let y = -20; y < 22; y += 9) { ctx.beginPath(); ctx.moveTo(-31, y); ctx.lineTo(-18, y); ctx.moveTo(18, y); ctx.lineTo(31, y); ctx.stroke(); }
    ctx.fillStyle = metal; ctx.fillRect(-23, -24, 46, 48); ctx.strokeStyle = '#c0baa1'; ctx.lineWidth = 2; ctx.strokeRect(-23, -24, 46, 48);
    ctx.fillStyle = spec.accent; ctx.fillRect(-18, -19, 8, 38); ctx.fillStyle = '#121914'; ctx.beginPath(); ctx.arc(5, 0, 13, 0, TAU); ctx.fill(); ctx.strokeStyle = '#9b9f8d'; ctx.stroke();
    ctx.fillStyle = '#252e28'; ctx.fillRect(4, -4, 35, 8); ctx.fillStyle = '#f6c187'; ctx.fillRect(35, -2, 8, 4);
  } else if (droid.kind === '711') {
    ctx.fillStyle = '#0c110e'; ctx.fillRect(-36, -31, 65, 17); ctx.fillRect(-36, 14, 65, 17);
    ctx.strokeStyle = '#6e725f'; ctx.lineWidth = 2; for (let x = -30; x < 25; x += 10) { ctx.strokeRect(x, -29, 7, 13); ctx.strokeRect(x, 16, 7, 13); }
    ctx.fillStyle = metal; ctx.beginPath(); ctx.moveTo(-26,-27); ctx.lineTo(20,-27); ctx.lineTo(34,-15); ctx.lineTo(34,15); ctx.lineTo(20,27); ctx.lineTo(-26,27); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#c1b99e'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = spec.accent; ctx.fillRect(-19, -20, 7, 40); ctx.fillStyle = '#141b17'; ctx.beginPath(); ctx.arc(7, 0, 15, 0, TAU); ctx.fill(); ctx.strokeStyle = '#a6ae93'; ctx.stroke();
    ctx.fillStyle = '#313c33'; ctx.fillRect(6, -6, 42, 12); ctx.fillStyle = '#d4d099'; ctx.fillRect(44, -4, 7, 8);
  } else {
    ctx.strokeStyle = '#7c6b4e'; ctx.lineWidth = 8; for (let i = 0; i < 8; i++) { const a = i * TAU / 8; ctx.beginPath(); ctx.moveTo(Math.cos(a)*24, Math.sin(a)*24); ctx.lineTo(Math.cos(a)*43, Math.sin(a)*43); ctx.stroke(); }
    ctx.fillStyle = metal; ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * TAU / 8; const px = Math.cos(a)*34, py = Math.sin(a)*34; i ? ctx.lineTo(px,py) : ctx.moveTo(px,py); } ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#d0bd9b'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = spec.accent; ctx.beginPath(); ctx.arc(0, 0, 21, 0, TAU); ctx.fill(); ctx.fillStyle = '#151916'; ctx.beginPath(); ctx.arc(0,0,14,0,TAU); ctx.fill();
    ctx.fillStyle = '#2c342d'; ctx.fillRect(6, -7, 49, 14); ctx.fillStyle = '#f6d6a1'; ctx.fillRect(49, -4, 10, 8);
  }
  ctx.restore();
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = droid.hitFlash ? '#fff' : '#f1e7c8'; ctx.font = `700 ${droid.kind === '999' ? 11 : 10}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(droid.kind, 0, 0);
  if (!player) {
    const ratio = clamp(droid.hp / droid.maxHp, 0, 1);
    if (ratio < 1 || droid.alert > .5) { ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(-24, -droid.radius - 14, 48, 4); ctx.fillStyle = ratio < .3 ? '#ef655e' : spec.accent; ctx.fillRect(-24, -droid.radius - 14, 48 * ratio, 4); }
  }
  ctx.restore();
}

function drawBulletsAndParticles() {
  ctx.save();
  for (const bullet of state.bullets) {
    const x = bullet.x - state.camera.x, y = bullet.y - state.camera.y;
    ctx.strokeStyle = bullet.color; ctx.fillStyle = bullet.color; ctx.lineWidth = bullet.width; ctx.shadowColor = bullet.color; ctx.shadowBlur = 10 + bullet.width;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - bullet.vx * bullet.trail, y - bullet.vy * bullet.trail); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, Math.max(1.5, bullet.width * .62), 0, TAU); ctx.fill();
  }
  ctx.shadowBlur = 0;
  for (const p of state.particles) { ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1); ctx.fillStyle = p.color; ctx.fillRect(p.x - state.camera.x, p.y - state.camera.y, p.size, p.size); }
  ctx.restore();
}

function drawPickups() {
  for (const pickup of state.pickups) {
    const x = pickup.x - state.camera.x, y = pickup.y - state.camera.y;
    ctx.save(); ctx.translate(x, y); ctx.rotate(pickup.spin); ctx.shadowColor = '#85d6b0'; ctx.shadowBlur = 12;
    ctx.fillStyle = '#1a2820'; ctx.strokeStyle = '#85d6b0'; ctx.lineWidth = 2; ctx.fillRect(-10,-10,20,20); ctx.strokeRect(-10,-10,20,20);
    ctx.fillStyle = '#d9f69c'; ctx.fillRect(-3,-7,6,14); ctx.fillRect(-7,-3,14,6); ctx.restore();
  }
}

function getRadarMode() {
  if (state.deckIndex < 4) return 'online';
  const interference = (state.deckIndex - 3) / (DECKS.length - 4);
  const wave = (Math.sin(state.time * (.48 + interference * .22) + state.deckIndex * .61) + 1) / 2;
  if (state.deckIndex >= 8 && wave > lerp(.98, .8, interference)) return 'offline';
  return 'unstable';
}

function renderRadar() {
  const w = radarCanvas.width, h = radarCanvas.height;
  const mode = getRadarMode();
  const degraded = state.deckIndex >= 4;
  ui.radar.classList.toggle('is-degraded', degraded);
  ui.radar.classList.toggle('is-offline', mode === 'offline');
  ui.radarStatus.textContent = mode === 'online' ? 'SIGNAL LOCK' : mode === 'offline' ? 'SIGNAL DENIED' : state.deckIndex >= 16 ? 'CC OVERRIDE' : 'UNVERIFIED';

  rx.clearRect(0, 0, w, h);
  rx.fillStyle = '#101813'; rx.fillRect(0, 0, w, h);
  rx.strokeStyle = 'rgba(133,214,176,.08)'; rx.lineWidth = 1;
  for (let x = 0; x < w; x += 44) { rx.beginPath(); rx.moveTo(x, 0); rx.lineTo(x, h); rx.stroke(); }
  for (let y = 0; y < h; y += 42) { rx.beginPath(); rx.moveTo(0, y); rx.lineTo(w, y); rx.stroke(); }

  if (mode === 'offline') {
    rx.fillStyle = 'rgba(239,101,94,.12)';
    for (let i = 0; i < 7; i++) {
      const x = ((i * 97 + state.deckIndex * 31 + Math.floor(state.time * 4) * 13) % 360);
      const y = ((i * 53 + state.deckIndex * 19) % h);
      rx.fillRect(x, y, 55 + ((i * 71) % 180), 3 + (i % 3) * 2);
    }
    rx.fillStyle = '#ef655e'; rx.font = '24px monospace'; rx.textAlign = 'center'; rx.textBaseline = 'middle';
    rx.fillText('SIGNAL DENIED', w / 2, h / 2);
    return;
  }

  const pad = 14;
  const sx = (w - pad * 2) / WORLD.w, sy = (h - pad * 2) / WORLD.h;
  const jitter = degraded && Math.sin(state.time * 11.7) > .84 ? Math.sin(state.time * 37) * 4 : 0;
  rx.save(); rx.translate(jitter, 0);
  rx.strokeStyle = mode === 'unstable' ? '#7d7151' : '#526359'; rx.lineWidth = 2;
  rx.strokeRect(pad, pad, WORLD.w * sx, WORLD.h * sy);
  rx.fillStyle = '#39443b';
  for (const wall of state.walls) rx.fillRect(pad + wall.x * sx, pad + wall.y * sy, Math.max(2, wall.w * sx), Math.max(2, wall.h * sy));

  const point = (x, y) => [pad + x * sx, pad + y * sy];
  const [terminalX, terminalY] = point(state.terminal.x, state.terminal.y);
  rx.fillStyle = '#d596b6'; rx.fillRect(terminalX - 5, terminalY - 5, 10, 10);
  rx.fillStyle = '#3b2535'; rx.font = '10px monospace'; rx.textAlign = 'center'; rx.textBaseline = 'middle'; rx.fillText('T', terminalX, terminalY + 1);
  const [liftX, liftY] = point(state.lift.x, state.lift.y);
  rx.strokeStyle = state.deckCleared ? '#fff0a4' : '#ffc74d'; rx.lineWidth = 3; rx.strokeRect(liftX - 7, liftY - 7, 14, 14);

  for (const enemy of state.enemies) {
    const [x, y] = point(enemy.x, enemy.y);
    rx.fillStyle = '#ef655e'; rx.beginPath(); rx.arc(x, y, 4.5, 0, TAU); rx.fill();
    if (state.tutorial?.active && state.tutorial.step === 2 && enemy === state.enemies[0]) {
      rx.strokeStyle = `rgba(255,199,77,${.45 + Math.sin(state.time * 6) * .3})`; rx.lineWidth = 2;
      rx.beginPath(); rx.arc(x, y, 10 + Math.sin(state.time * 5) * 2, 0, TAU); rx.stroke();
    }
  }

  if (degraded) {
    const ghosts = Math.min(3, 1 + Math.floor((state.deckIndex - 4) / 6));
    rx.strokeStyle = 'rgba(239,101,94,.55)'; rx.fillStyle = 'rgba(239,101,94,.65)'; rx.lineWidth = 1;
    for (let i = 0; i < ghosts; i++) {
      const ghostX = 120 + ((state.deckIndex * 173 + i * 607) % 1880);
      const ghostY = 120 + ((state.deckIndex * 211 + i * 389) % 1120);
      const [x, y] = point(ghostX, ghostY);
      rx.beginPath(); rx.arc(x, y, 5.5, 0, TAU); rx.stroke();
      rx.font = '8px monospace'; rx.textAlign = 'center'; rx.fillText('?', x, y - 8);
    }
  }

  const [playerX, playerY] = point(state.player.x, state.player.y);
  rx.save(); rx.translate(playerX, playerY); rx.rotate(state.player.angle);
  rx.fillStyle = '#f6f0d8'; rx.beginPath(); rx.moveTo(9, 0); rx.lineTo(-6, -6); rx.lineTo(-3, 0); rx.lineTo(-6, 6); rx.closePath(); rx.fill(); rx.restore();
  rx.restore();
}

function render() {
  ctx.save();
  if (state.shake > 0 && state.mode === 'playing') ctx.translate(random(-state.shake, state.shake), random(-state.shake, state.shake));
  drawDeckBackground();
  drawLift(); drawTerminal(); drawEmergencyLighting(); drawHazards(); drawPickups();
  [...state.enemies, state.player].filter(Boolean).sort((a,b) => a.y - b.y).forEach((d) => drawDroid(d, d === state.player));
  drawBulletsAndParticles();
  if (state.introTimer > 0) {
    const alpha = clamp(state.introTimer < .7 ? state.introTimer / .7 : 1, 0, 1);
    ctx.globalAlpha = alpha; ctx.fillStyle = 'rgba(7,11,8,.78)'; ctx.fillRect(0, HEIGHT / 2 - 58, WIDTH, 116);
    const deck = DECKS[state.deckIndex];
    ctx.fillStyle = deck.movement >= 3 ? '#90bde8' : '#ffc74d'; ctx.font = '12px monospace'; ctx.textAlign = 'center';
    ctx.fillText(`DECK ${deck.id} // MOVEMENT ${['I','II','III','IV','V'][deck.movement]}: ${deck.movementName}`, WIDTH/2, HEIGHT/2 - 12);
    ctx.fillStyle = '#f1e9d0'; ctx.font = '600 30px sans-serif'; ctx.fillText(DECKS[state.deckIndex].name, WIDTH/2, HEIGHT/2 + 25);
  }
  ctx.restore();
  renderRadar();
}

function renderTransfer() {
  const tr = state.transfer; if (!tr) return;
  const w = transferCanvas.width, h = transferCanvas.height;
  const geometry = getTransferGeometry();
  const playerTarget = getTransferTarget(tr, 'player', tr.lane);
  const playerLaneBusy = tr.pulses.some((pulse) => pulse.owner === 'player' && pulse.lane === tr.lane && !pulse.dead);
  const playerScore = tr.cores.filter((owner) => owner === 'player').length;
  const enemyScore = tr.cores.filter((owner) => owner === 'enemy').length;
  tx.fillStyle = '#121915'; tx.fillRect(0,0,w,h);
  tx.strokeStyle = 'rgba(154,170,156,.08)'; tx.lineWidth = 1;
  for (let x = 0; x < w; x += 40) { tx.beginPath(); tx.moveTo(x,0); tx.lineTo(x,h); tx.stroke(); }
  for (let y = 0; y < h; y += 40) { tx.beginPath(); tx.moveTo(0,y); tx.lineTo(w,y); tx.stroke(); }

  tx.textBaseline = 'middle';
  tx.font = '700 20px monospace'; tx.textAlign = 'left'; tx.fillStyle = '#f4d66f';
  tx.fillText(`YOU ${playerScore}`, 24, 25);
  tx.font = '11px monospace'; tx.fillStyle = '#b4ae86';
  tx.fillText(`PULSES ${tr.playerCharges}/${tr.playerCapacity}`, 24, 46);
  tx.fillStyle = tr.playerCooldown > 0 ? '#8b7860' : '#9ee0af';
  tx.fillText(tr.playerCooldown > 0 ? `RECHARGE ${tr.playerCooldown.toFixed(1)}s` : 'PULSE READY', 138, 46);

  tx.textAlign = 'right'; tx.font = '700 20px monospace'; tx.fillStyle = '#ed655e';
  tx.fillText(`${enemyScore} CENTRAL`, w - 24, 25);
  tx.font = '11px monospace'; tx.fillStyle = '#bd8b80';
  tx.fillText(`PULSES ${tr.enemyCharges}/${tr.enemyCapacity}`, w - 24, 46);
  if (tr.enemyIntent) {
    tx.fillStyle = '#ef8a74';
    tx.fillText(`ROUTE ${tr.enemyIntent.lane + 1} IN ${Math.max(0, tr.enemyIntent.time).toFixed(1)}s`, w - 138, 46);
  }

  tx.textAlign = 'center';
  tx.font = '700 13px monospace'; tx.fillStyle = '#c8c3a6'; tx.fillText('CAPTURE 5 OF 9 CORES', w / 2, 22);
  tx.font = '700 25px monospace'; tx.fillStyle = tr.time < 3 ? '#ef655e' : '#f2ead2';
  tx.fillText(Math.max(0, tr.time).toFixed(1), w / 2, 47);

  const drawPath = (start, end, color, width = 1, dash = []) => {
    tx.save(); tx.strokeStyle = color; tx.lineWidth = width; tx.setLineDash(dash);
    tx.beginPath(); tx.moveTo(start.x, start.y);
    tx.bezierCurveTo(lerp(start.x, end.x, .42), start.y, lerp(start.x, end.x, .66), end.y, end.x, end.y);
    tx.stroke(); tx.restore();
  };

  for (let lane = 0; lane < 5; lane++) {
    const playerPort = geometry.playerPorts[lane];
    const enemyPort = geometry.enemyPorts[lane];
    for (const coreIndex of TRANSFER_ROUTES[lane]) {
      drawPath(playerPort, geometry.cores[coreIndex], 'rgba(111,133,116,.2)');
      drawPath(enemyPort, geometry.cores[coreIndex], 'rgba(126,91,82,.16)');
    }
    const selected = lane === tr.lane;
    tx.fillStyle = selected ? '#f4d66f' : '#36453b'; tx.strokeStyle = selected ? '#fff0a6' : '#708075'; tx.lineWidth = selected ? 3 : 1;
    tx.beginPath(); tx.arc(playerPort.x, playerPort.y, selected ? 11 : 8, 0, TAU); tx.fill(); tx.stroke();
    tx.fillStyle = selected ? '#f4d66f' : '#79887c'; tx.textAlign = 'left'; tx.font = '11px monospace'; tx.fillText(`R${lane + 1}`, 18, playerPort.y);

    const intent = tr.enemyIntent?.lane === lane;
    tx.fillStyle = intent ? '#e96359' : '#3e332f'; tx.strokeStyle = intent ? '#ff9882' : '#80635c'; tx.lineWidth = intent ? 3 : 1;
    tx.beginPath(); tx.arc(enemyPort.x, enemyPort.y, intent ? 11 : 8, 0, TAU); tx.fill(); tx.stroke();
    tx.fillStyle = intent ? '#ef7b69' : '#8c7069'; tx.textAlign = 'right'; tx.fillText(`R${lane + 1}`, w - 18, enemyPort.y);
  }

  if (playerTarget !== null) {
    drawPath(geometry.playerPorts[tr.lane], geometry.cores[playerTarget], '#f4d66f', 4, [10, 7]);
  }
  if (tr.enemyIntent) {
    const pulse = .45 + Math.sin(tr.time * 8) * .18;
    drawPath(geometry.enemyPorts[tr.enemyIntent.lane], geometry.cores[tr.enemyIntent.targetCore], `rgba(239,101,88,${pulse})`, 4, [7, 6]);
  }

  tr.cores.forEach((owner, i) => {
    const core = geometry.cores[i];
    const selectedTarget = i === playerTarget;
    const enemyTarget = i === tr.enemyIntent?.targetCore;
    tx.fillStyle = owner === 'player' ? '#d7b94f' : owner === 'enemy' ? '#b94d48' : '#172019';
    tx.fillRect(core.x - 29, core.y - 23, 58, 46);
    tx.strokeStyle = tr.coreFlash[i] > 0 ? '#fff7ce' : selectedTarget ? '#f4d66f' : enemyTarget ? '#ef655e' : '#798375';
    tx.lineWidth = tr.coreFlash[i] > 0 ? 5 : selectedTarget || enemyTarget ? 3 : 1.5;
    tx.strokeRect(core.x - 29, core.y - 23, 58, 46);
    tx.textAlign = 'center'; tx.font = '700 12px monospace'; tx.fillStyle = owner ? '#101712' : '#a49e7f';
    tx.fillText(TRANSFER_CORE_LABELS[i], core.x, core.y - 7);
    tx.font = '9px monospace'; tx.fillStyle = owner ? '#1a211b' : '#667269';
    tx.fillText(owner === 'player' ? 'YOU' : owner === 'enemy' ? 'CENTRAL' : 'OPEN', core.x, core.y + 10);
  });

  for (const pulse of tr.pulses) {
    const { x, y } = transferPulsePosition(pulse, geometry);
    const color = pulse.owner === 'player' ? '#ffdb70' : '#ed655e';
    tx.shadowColor = color; tx.shadowBlur = 15; tx.fillStyle = color; tx.strokeStyle = '#fff4cf'; tx.lineWidth = 1;
    tx.beginPath(); tx.arc(x, y, 9, 0, TAU); tx.fill(); tx.stroke(); tx.shadowBlur = 0;
    tx.fillStyle = pulse.owner === 'player' ? '#322b14' : '#341815'; tx.font = '700 7px monospace'; tx.textAlign = 'center';
    tx.fillText(pulse.owner === 'player' ? 'YOU' : 'CC', x, y + .5);
  }

  tx.textAlign = 'center'; tx.font = '11px monospace';
  tx.fillStyle = tr.eventTimer > 0 ? '#d9d1aa' : playerLaneBusy ? '#d8b96c' : playerTarget === null ? '#9ee0af' : '#a9b4aa';
  tx.fillText(tr.eventTimer > 0 ? tr.event : playerLaneBusy
    ? `ROUTE ${tr.lane + 1} BUSY // WAIT OR SELECT ANOTHER`
    : playerTarget === null ? `ROUTE ${tr.lane + 1} SECURE // SELECT ANOTHER`
    : `ROUTE ${tr.lane + 1} TARGETS CORE ${TRANSFER_CORE_LABELS[playerTarget]}`, w / 2, h - 18);

  if (tr.intro > 0) {
    tx.fillStyle = 'rgba(7,11,8,.94)'; tx.fillRect(0,0,w,h);
    tx.textAlign = 'center'; tx.fillStyle = tr.central ? '#90b5ff' : '#f4d66f'; tx.font = '700 29px monospace'; tx.fillText(tr.central ? 'ENTER CENTRAL COMMAND' : 'CAPTURE 5 OF 9 CORES', w/2, 105);
    tx.fillStyle = '#e8e1c7'; tx.font = '13px monospace'; tx.fillText(tr.central ? 'THE CORE CANNOT DENY CIRCUIT OWNERSHIP' : 'EACH ROUTE REACHES THREE NAMED CORES', w/2, 145);
    tx.fillStyle = '#f4d66f'; tx.fillText(`YOUR LINK // ${tr.playerCapacity} PULSES // ${tr.playerRecharge.toFixed(2)}s RECHARGE`, w/2, 185);
    tx.fillStyle = '#ef7b69'; tx.fillText(`TARGET LINK // ${tr.enemyCapacity} PULSES // ${tr.enemyTelegraph.toFixed(2)}s WARNING`, w/2, 215);
    tx.fillStyle = '#9fa99f'; tx.fillText('YELLOW PATH = YOUR NEXT TARGET    RED PATH = CENTRAL COMMAND INTENT', w/2, 260);
    tx.fillStyle = '#f0ead5'; tx.fillText('↑ ↓ SELECT ROUTE    SPACE COMMIT PULSE    MATCH A ROUTE TO INTERCEPT', w/2, 300);
    if (tr.training) { tx.fillStyle = '#9ee0af'; tx.fillText('GUIDED LINK // THREE EXTRA PULSES // CENTRAL COMMAND DELAYED', w/2, 340); }
    if (tr.central) { tx.fillStyle = '#90b5ff'; tx.fillText('FINAL LINK // TWO CORES ALREADY HELD // THREE RESERVE PULSES', w/2, 340); }
    tx.fillStyle = '#7e897f'; tx.font = '10px monospace'; tx.fillText(`LINK OPENS IN ${Math.max(1, Math.ceil(tr.intro))}`, w/2, 388);
  }
  if (tr.finished) {
    const won = playerScore >= 5;
    tx.fillStyle = 'rgba(7,11,8,.94)'; tx.fillRect(0,0,w,h);
    tx.textAlign = 'center'; tx.fillStyle = won ? '#9ee0af' : '#ef655e'; tx.font = '700 34px monospace'; tx.fillText(tr.resultTitle, w/2, h/2 - 25);
    tx.fillStyle = '#e4dcc2'; tx.font = '700 14px monospace'; tx.fillText(tr.resultReason, w/2, h/2 + 20);
    tx.fillStyle = '#78847b'; tx.font = '10px monospace'; tx.fillText(tr.central ? 'RESOLVING IDENTITY...' : 'CLOSING LINK...', w/2, h/2 + 56);
  }
}

const ACTIVE_RENDER_MODES = new Set(['playing', 'transfer']);
const FRAME_INTERVAL = 1000 / 30;
let lastRenderedMode = null;

function frame(now) {
  const active = ACTIVE_RENDER_MODES.has(state.mode);
  if (!active) {
    state.lastTime = now;
    if (lastRenderedMode !== state.mode) {
      render();
      lastRenderedMode = state.mode;
    }
    pressed.clear();
    setTimeout(() => requestAnimationFrame(frame), 100);
    return;
  }

  const elapsed = now - state.lastTime;
  if (elapsed < FRAME_INTERVAL - 1) {
    requestAnimationFrame(frame);
    return;
  }

  const dt = clamp(elapsed / 1000, 0, .05);
  state.lastTime = now;
  update(dt);
  render();
  lastRenderedMode = state.mode;
  pressed.clear();
  requestAnimationFrame(frame);
}

document.addEventListener('keydown', (event) => {
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code)) event.preventDefault();
  if (!keys.has(event.code)) pressed.add(event.code);
  keys.add(event.code);
  if (event.code === 'Enter' && state.mode === 'start') startGame();
  else if (event.code === 'Enter' && state.mode === 'end') startGame();
  else if (event.code === 'KeyE' && state.mode === 'terminal') closeTerminal();
  else if (event.code === 'KeyE' && state.mode === 'dossier') confirmDossier();
  else if (event.code === 'Escape' && state.mode === 'dossier') closeDossier();
  else if (event.code === 'KeyT' && state.mode === 'playing' && state.tutorial?.active) dismissTutorial();
  else if ((event.code === 'KeyP' || event.code === 'Escape') && ['playing','paused'].includes(state.mode)) pauseGame();
});
document.addEventListener('keyup', (event) => keys.delete(event.code));
window.addEventListener('blur', () => { keys.clear(); if (state.mode === 'playing') pauseGame(true); });

ui.startButton.addEventListener('click', startGame);
ui.restartButton.addEventListener('click', startGame);
ui.resumeButton.addEventListener('click', () => pauseGame(false));
ui.soundButton.addEventListener('click', toggleSound);

window.__SOLADROID__ = {
  getState: () => ({ mode: state.mode, deck: state.deckIndex + 1, movement: DECKS[state.deckIndex].movementName, score: state.score, player: state.player ? { kind: state.player.kind, hp: state.player.hp, x: state.player.x, y: state.player.y } : null, hostiles: state.enemies.length, hazards: state.hazards.length, cleared: state.deckCleared, combatUnlocked: state.combatUnlocked, tutorialStep: state.tutorial?.active ? state.tutorial.step : null }),
  start: startGame,
  jumpToDeck: (number) => {
    state.mode = 'playing'; state.tutorial = { active: false, step: 0 }; state.combatUnlocked = true; hideAllOverlays(); updateTutorialUi();
    loadDeck(clamp(Math.floor(number) - 1, 0, DECKS.length - 1), !state.player); state.lastTime = performance.now();
  },
  clearDeck: () => { [...state.enemies].forEach(destroyEnemy); },
  teleport: (x, y) => { if (state.player) { state.player.x = x; state.player.y = y; } },
  teleportToNearest: () => {
    const target = [...state.enemies].sort((a, b) => distance(a, state.player) - distance(b, state.player))[0];
    if (target) { state.player.x = target.x - target.radius - state.player.radius - 28; state.player.y = target.y; }
  },
  showEnding: () => endGame(true),
  setMode: (mode) => { state.mode = mode; }
};

loadDeck(0, true);
state.mode = 'start';
state.toastTimer = 0;
ui.toast.classList.remove('is-visible');
requestAnimationFrame(frame);
