// Ringbreaker levels: rooms joined by sliding blast doors, built from code. Each mission = rooms with props,
// enemies and one objective per room (clear, hack, defend, boss, reach, escape).
import { THREE } from './kit/cine.js';
import { Builder, propsKit, sbox, signTex } from './world.js';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------- missions
// room: w (x), l (z), h, cx, open [{side,at,len,y0,y1,kind}], props(K, rnd), en [[type,x,z]], obj, spawns [[x,z]]
// z is relative to the room centre, negative = towards the exit door.
export const MISSIONS = [
  { id: 1, name: 'HANGAR BAY', sub: 'Retake the docking deck', par: 120,
    theme: { wall: '#eef3f8', floor: '#dfe8f2', dark: '#2f6bff', trim: '#ffb21a', accent: 0x22d3ee, warn: 0xff5a2a, light: 0xd6f0ff, li: 14, fog: 0xcfe6ff, hemi: [0xd8ecff, 0x9a8a7a, 1.15], sun: [0xfff1dc, 2.6], exposure: 1.08,
      space: { earthPos: [620, -40, -160], earthR: 380, sunDir: [0.35, 0.85, 0.4], ringPos: [900, 300, -1200], ringRot: [0.2, 0.9, 0.3] } },
    rooms: [
      { w: 26, l: 30, h: 11, open: [{ side: 'r', at: 1, len: 20, y0: 0.5, y1: 9.2, kind: 'bay' }], obj: { type: 'clear', text: 'Clear the docking deck' },
        en: [['drone', -2, -9], ['drone', 6, -6], ['walker', -6, -11], ['walker', 7, -12], ['drone', 1, -13]],
        props(K) {
          K.dropship(-5.5, 0, 0.25); K.stack(6.5, 5, 0.3); K.crate(3, -5, 1.3, 0.4); K.crate(4.4, -5.6, 1.1, 0.1); K.longCrate(-8.5, 10.5, Math.PI / 2); K.barrier(5, -10, 4); K.barrier(-4, -10.5, 3.5, 0.15);
          K.crate(-10.5, -6, 1.3); K.crate(-10.5, -7.4, 1.2, 0.3); K.crate(10.5, 11, 1.4, 0.2);
          K.canister(8.5, -2); K.canister(-11, -12); K.canister(2.5, 6.5); K.canister(9.3, -2.6);
          K.console(11.2, 8, -Math.PI / 2); K.console(11.2, -8, -Math.PI / 2, 'screen2');
          K.sign('HANGAR 03', 'DOCKING DECK  //  AUTHORISED CREW', -12.9, 6.5, 2, Math.PI / 2, 5); K.sign('LIFT ▸', 'CONTROL DECK', 0, 7, -14.9, 0, 3.4, '#22d3ee');
          K.beacon(-12.6, 8.5, -12); K.beacon(12.6, 9.6, -14); K.vent(-12.7, 0.4, 3, 1, 0.3, 0); K.vent(-12.7, 0.4, -3, 1, 0.3, 0); K.vent(4, 10.6, -2, 0, -1, 0, 0.6);
          K.pipeRun(-12.6, 14, -12.6, -14, 9.6, 0.2, 'copper'); K.pipeRun(-12.5, 14, -12.5, -14, 9.1, 0.12);
          K.sag(-12.7, 8, 10, -8, 10.8, 10); K.sag(-12.7, 8, -4, -6, 10.8, -4, 1.2); K.sag(3, 10.8, -10, 12.7, 9, -10, 1.0);
          K.locker(-12.2, -2, Math.PI / 2); K.rack(-12.2, -9, Math.PI / 2);
        } },
      { w: 16, l: 16, h: 6, obj: { type: 'hack', at: [0, -3.6], time: 6, text: 'Hack the lift console' }, en: [['drone', -4, -4]],
        spawns: [[-6, -6], [6, -6], [6, 2]], waves: ['drone', 'walker', 'drone'],
        props(K) { K.console(0, -5.6, 0); K.locker(-7.6, 0, Math.PI / 2); K.locker(7.6, 2, -Math.PI / 2); K.rack(-7.4, -5, Math.PI / 2); K.rack(7.4, -5, -Math.PI / 2); K.barrier(-3.5, 1, 2.5, 0.3); K.barrier(3.5, 0, 2.5, -0.3);
          K.canister(-6, 5); K.sign('LIFT CONTROL', 'DECK 2  //  SECTOR C', 0, 4.2, 7.9, Math.PI, 4.4); K.pipeRun(-7.6, 7, -7.6, -7, 5.3); K.pipeRun(7.6, 7, 7.6, -7, 5.3, 0.16, 'copper'); K.beacon(-7.6, 4.8, -7); K.vent(7.7, 0.4, 5, -1, 0.3, 0); } },
      { w: 9, l: 9, h: 6, obj: { type: 'reach', at: [0, -1], text: 'Board the lift' }, lift: true,
        props(K) { K.rack(-3.8, 3, Math.PI / 2); K.rack(3.8, 3, -Math.PI / 2); K.sign('LIFT A', 'TO COMMAND DECK', 0, 4.3, -4.4, 0, 3); } },
    ] },
  { id: 2, name: 'REACTOR CORE', sub: 'Keep the core from melting down', par: 170,
    theme: { wall: '#ffe9cf', floor: '#f3e3cf', dark: '#e8533a', trim: '#ffd23a', accent: 0xff8a1a, warn: 0xff3a2a, light: 0xffd6a0, li: 16, fog: 0xffe2c4, hemi: [0xffe6cc, 0x9a6a4a, 1.1], sun: [0xffe6c0, 2.5], exposure: 1.06, alarm: true,
      space: { earthPos: [-500, 300, -500], earthR: 300, sunDir: [0.3, 0.85, -0.4] } },
    rooms: [
      { w: 12, l: 22, h: 6, obj: { type: 'clear', text: 'Push through the coolant corridor' }, en: [['walker', -3, -6], ['walker', 3, -9], ['drone', 0, -8], ['walker', 0, -10]],
        props(K) { K.barrier(-3, 3, 3, 0.2); K.barrier(3.2, -2, 3, -0.2); K.barrier(-2.8, -6.5, 3); K.crate(4.6, 5, 1.2); K.crate(-4.8, -2, 1.2, 0.5);
          K.canister(5, -6); K.canister(-5, 8); K.pipeRun(-5.7, 11, -5.7, -11, 5.2, 0.25, 'copper'); K.pipeRun(-5.7, 11, -5.7, -11, 4.5, 0.15); K.pipeRun(5.7, 11, 5.7, -11, 5.0, 0.3);
          K.vent(-5.8, 1.2, 0, 1, 0, 0); K.vent(5.8, 0.5, 6, -1, 0.2, 0); K.vent(0, 5.7, -4, 0, -1, 0, 0.8); K.beacon(-5.7, 4.2, 9); K.beacon(5.7, 4.2, -9);
          K.sign('COOLANT LOOP B', 'PRESSURE CRITICAL', -5.9, 3.2, 5, Math.PI / 2, 4, '#ff6a3a'); } },
      { w: 30, l: 30, h: 16, obj: { type: 'defend', at: [-8, -7], r: 4, time: 32, text: 'Hold the coolant valve' }, en: [['walker', 8, -9], ['drone', 0, -12]],
        spawns: [[-13, -13], [13, -13], [13, 8], [-13, 8], [0, -14]], waves: ['walker', 'drone', 'walker', 'drone', 'walker', 'walker', 'drone', 'walker'],
        props(K) { K.reactor(0, 0, 16); K.console(-8, -10.4, 0, 'screen2'); K.barrier(-11, -4, 3, 1.2); K.barrier(-4.5, -9.5, 3, -0.6); K.barrier(7, -6, 3.5, 0.5); K.barrier(9, 6, 3, -0.4);
          K.stack(-10, 9, 0.2); K.crate(11, -11, 1.3); K.crate(-12, -12, 1.2, 0.3); K.canister(5, 9); K.canister(-6, 4); K.canister(12, 0); K.canister(-13, 0);
          K.vent(-14.8, 1, -6, 1, 0.2, 0); K.vent(14.8, 1, 4, -1, 0.2, 0); K.vent(4, 15.7, 4, 0, -1, 0, 0.6); K.vent(-4, 15.7, -4, 0, -1, 0, 0.6);
          K.beacon(-14.7, 8, -14); K.beacon(14.7, 8, -14); K.beacon(14.7, 8, 14); K.beacon(-14.7, 8, 14);
          K.sign('REACTOR CORE', 'RADIATION ZONE  //  NO ENTRY', 0, 9, 14.9, Math.PI, 6, '#ff6a3a'); K.pipeRun(-14.7, 14, -14.7, -14, 12, 0.35, 'copper'); K.pipeRun(14.7, 14, 14.7, -14, 12, 0.35, 'copper');
          for (const s of [-1, 1]) K.sag(s * 14.7, 13, -10, s * 3.4, 14, -2, 1.5, 0.08); } },
      { w: 10, l: 10, h: 6, obj: { type: 'reach', at: [0, -2], text: 'Reach the maintenance shaft' }, lift: true, props(K) { K.rack(-4.2, 2, Math.PI / 2); K.canister(4, 3); } },
    ] },
  { id: 3, name: 'HYDROPONICS', sub: 'Take back the greenhouse', par: 170,
    theme: { wall: '#eafbe8', floor: '#e3efd9', dark: '#1fae6b', trim: '#ffcf3a', accent: 0x4dff9a, warn: 0xffc21a, light: 0xe0ffe0, li: 12, fog: 0xd8ffe2, hemi: [0xe0ffe6, 0x7a8a5a, 1.15], sun: [0xfff4d6, 2.7], exposure: 1.08,
      space: { earthPos: [-200, 900, -600], earthR: 420, sunDir: [-0.3, 0.85, -0.3] } },
    rooms: [
      { w: 24, l: 28, h: 8, glassRoof: true, obj: { type: 'clear', text: 'Clear the greenhouse' }, en: [['walker', -6, -9], ['walker', 6, -10], ['walker', 0, -12], ['drone', -3, -6], ['drone', 4, -4], ['walker', 9, -4]],
        props(K) { K.planter(-7, 1, 9); K.planter(0, 3, 7); K.planter(7, 0, 9); K.planter(-4, -8, 5, Math.PI / 2); K.planter(5, -9, 5, Math.PI / 2);
          for (const x of [-7, 0, 7]) K.growLamp(x, 1, 8, 4.5); K.canister(-10.5, -11); K.canister(10.5, 8); K.crate(-10.5, 9, 1.2); K.crate(3.6, 9.5, 1.1, 0.4);
          K.vent(-11.8, 0.5, -3, 1, 0.3, 0); K.vent(11.8, 0.5, 3, -1, 0.3, 0); K.sign('HYDROPONICS', 'BAY 2  //  OXYGEN FARM', -11.9, 4.5, 4, Math.PI / 2, 5, '#4dff9a');
          K.pipeRun(-11.7, 13, -11.7, -13, 0.4, 0.12); K.pipeRun(11.7, 13, 11.7, -13, 0.4, 0.12); K.pipeRun(-11.7, 13, -11.7, -13, 0.7, 0.08, 'copper'); } },
      { w: 18, l: 18, h: 6, obj: { type: 'hack', at: [0, -4.8], time: 7, text: 'Restart the irrigation pumps' }, en: [['walker', 5, -6], ['drone', -4, -5]],
        spawns: [[-7, -7], [7, -7], [-7, 4], [7, 4]], waves: ['walker', 'drone', 'walker', 'walker'],
        props(K) { K.console(0, -6.6, 0, 'screen2'); K.planter(-6, 1, 6); K.planter(6, 1, 6); K.barrier(0, 0, 3); K.canister(-8, -7); K.canister(8, 6);
          for (const x of [-4, 4]) K.pipeRun(x, 8.5, x, -8.5, 5.4, 0.2, 'copper'); K.vent(0, 5.7, 3, 0, -1, 0, 0.7); K.sign('PUMP STATION', 'IRRIGATION', 0, 4, 8.9, Math.PI, 4, '#4dff9a'); } },
      { w: 10, l: 10, h: 6, obj: { type: 'reach', at: [0, -2], text: 'Head for the cryo labs' }, lift: true, props(K) { K.planter(-3.5, 0, 4); } },
    ] },
  { id: 4, name: 'CRYO LABS', sub: 'Shielded heavies hold the labs', par: 220,
    theme: { wall: '#eaf6ff', floor: '#e0eef9', dark: '#5a6cff', trim: '#ff6fa8', accent: 0x7fd6ff, warn: 0xff4a6a, light: 0xe8f4ff, li: 12, fog: 0xdff3ff, hemi: [0xe6f6ff, 0x8090a8, 1.15], sun: [0xf4f8ff, 2.5], exposure: 1.08,
      space: { earthPos: [600, 200, 300], earthR: 300, sunDir: [0.45, 0.8, 0.3] } },
    rooms: [
      { w: 18, l: 24, h: 6, open: [{ side: 'l', at: 0, len: 6, y0: 1.2, y1: 4.2, kind: 'window' }], obj: { type: 'clear', text: 'Break through the pod hall' }, en: [['heavy', 0, -9], ['walker', -5, -6], ['walker', 5, -8]],
        props(K) { for (let i = 0; i < 4; i++) { K.cryoPod(-6.5, 6 - i * 4, Math.PI / 2); K.cryoPod(6.5, 6 - i * 4, -Math.PI / 2); } K.barrier(0, 2, 3); K.barrier(-2, -4, 2.5, 0.3); K.canister(3, 6); K.canister(-3, -9);
          K.vent(-8.8, 0.4, 9, 1, 0.1, 0); K.vent(8.8, 0.4, -9, -1, 0.1, 0); K.sign('CRYO LAB 1', 'SUSPENDED ANIMATION', 8.9, 4.2, 4, -Math.PI / 2, 4, '#7fd6ff'); K.pipeRun(-8.7, 11, -8.7, -11, 5.3, 0.15); K.pipeRun(8.7, 11, 8.7, -11, 5.3, 0.15); } },
      { w: 22, l: 22, h: 7, obj: { type: 'hack', at: [0, -5.8], time: 8, text: 'Override the lab lockdown' }, en: [['walker', -6, -6], ['drone', 6, -5]],
        spawns: [[-9, -9], [9, -9], [-9, 2], [9, 2]], waves: ['walker', 'drone', 'heavy', 'walker', 'drone'],
        props(K) { K.console(0, -7.6, 0); K.cryoPod(-9.5, -4, Math.PI / 2); K.cryoPod(9.5, -4, -Math.PI / 2); K.cryoPod(-9.5, 0, Math.PI / 2); K.cryoPod(9.5, 0, -Math.PI / 2);
          K.longCrate(-4, 1, 0.2); K.longCrate(4.5, -1, -0.3); K.shelf(-6, 8, 0); K.shelf(6, 8, 0); K.canister(-7, -9); K.canister(7, 5); K.beacon(-10.8, 5.5, -10); K.beacon(10.8, 5.5, -10);
          K.vent(0, 6.7, 0, 0, -1, 0, 0.8); K.sign('CRYO LAB 2', 'LOCKDOWN ACTIVE', 0, 5, 10.9, Math.PI, 4.4, '#ff4a6a'); } },
      { w: 14, l: 18, h: 6, obj: { type: 'clear', text: 'Destroy the heavy escort' }, en: [['heavy', -3, -5], ['heavy', 3, -7], ['drone', 0, -4], ['drone', -4, -2]],
        props(K) { K.barrier(-3, 2, 3, 0.2); K.barrier(3, 0, 3, -0.2); K.crate(-5.5, -6, 1.3); K.crate(5.5, -3, 1.2); K.canister(0, -1); K.canister(-5.5, 5); K.rack(-6.4, 7, Math.PI / 2); K.rack(6.4, 7, -Math.PI / 2); } },
      { w: 9, l: 9, h: 6, obj: { type: 'reach', at: [0, -1], text: 'Take the lift to the command deck' }, lift: true, props() {} },
    ] },
  { id: 5, name: 'COMMAND DECK', sub: 'Restore the station uplink', par: 200,
    theme: { wall: '#eef0ff', floor: '#dde2f5', dark: '#3a3fa8', trim: '#ffc23a', accent: 0x6f8bff, warn: 0xff2a4a, light: 0xd8deff, li: 14, fog: 0xd8dcff, hemi: [0xe0e4ff, 0x80708a, 1.1], sun: [0xfff0dc, 2.5], exposure: 1.08, alarm: true,
      space: { earthPos: [0, -260, -700], earthR: 520, sunDir: [-0.4, 0.8, -0.45], ringPos: [-700, 220, -900], ringRot: [0.5, -0.5, 0.2] } },
    rooms: [
      { w: 14, l: 18, h: 5, obj: { type: 'clear', text: 'Secure the bridge access' }, en: [['walker', -4, -5], ['walker', 4, -6], ['drone', 0, -6], ['drone', 3, -3]],
        props(K) { K.barrier(-3, 1, 2.5, 0.3); K.barrier(3, -1, 2.5, -0.3); K.locker(-6.6, 4, Math.PI / 2); K.locker(6.6, -4, -Math.PI / 2); K.canister(-5, -6); K.canister(5, 6); K.crate(4.5, 4, 1.2, 0.3);
          K.sign('BRIDGE', 'COMMAND CREW ONLY', 0, 3.6, 8.9, Math.PI, 3.4, '#6f8bff'); K.beacon(-6.8, 4, -8); } },
      { w: 30, l: 24, h: 9, open: [{ side: 'l', at: 0, len: 18, y0: 1.0, y1: 7.5, kind: 'window' }, { side: 'r', at: 0, len: 18, y0: 1.0, y1: 7.5, kind: 'window' }, { side: 'f', at: 0, len: 10, y0: 4.4, y1: 8, kind: 'window' }],
        obj: { type: 'defend', at: [0, 0], r: 4.2, time: 36, text: 'Hold the uplink while it syncs' }, en: [['walker', -9, -8], ['drone', 8, -6]],
        spawns: [[-13, -10], [13, -10], [-13, 9], [13, 9]], waves: ['walker', 'drone', 'heavy', 'walker', 'drone', 'walker', 'walker', 'drone'],
        props(K) { K.holoTable(0, 0); for (let i = 0; i < 5; i++) { const a = -0.9 + i * 0.45; K.console(Math.sin(a) * 7.5, -Math.cos(a) * 7.5 - 1, a + Math.PI, i % 2 ? 'screen2' : 'screen'); }
          K.barrier(-8, 5, 3, 0.4); K.barrier(8, 5, 3, -0.4); K.longCrate(-11, -4, Math.PI / 2); K.longCrate(11, -4, Math.PI / 2); K.canister(-12, 3); K.canister(12, 3); K.canister(-5, -10); K.canister(6, -10);
          K.pillar(-8, -10.5, 9, 1); K.pillar(8, -10.5, 9, 1); K.sign('UPLINK', 'STATION COMMAND // RING 1', 0, 7.6, 11.9, Math.PI, 4, '#6f8bff'); K.beacon(-14.6, 8.4, 11); K.beacon(14.6, 8.4, 11); } },
      { w: 10, l: 10, h: 6, obj: { type: 'reach', at: [0, -2], text: 'Exit to the outer hull' }, lift: true, props(K) { K.locker(-4.4, 0, Math.PI / 2); K.sign('AIRLOCK', 'EVA SUIT REQUIRED', 0, 3.8, -4.9, 0, 3, '#ff2a4a'); } },
    ] },
  { id: 6, name: 'OUTER HULL', sub: 'Kill the Warden. Reach the escape pod.', par: 260, hull: true,
    theme: { wall: '#f2f4f8', floor: '#e8ecf2', dark: '#ff6a2a', trim: '#2f6bff', accent: 0x22d3ee, warn: 0xff3a2a, light: 0xffffff, li: 0, fog: 0x8fa8e8, fogNear: 60, fogFar: 400, hemi: [0xbfd4ff, 0x6a7090, 1.0], sun: [0xffffff, 3.0], exposure: 1.05,
      space: { earthPos: [-260, -380, -1000], earthR: 760, sunDir: [0.55, 0.7, 0.45], ringPos: [420, 260, -650], ringRot: [1.0, 0.5, 0.3] } },
    rooms: [
      { w: 26, l: 30, h: 0, obj: { type: 'clear', text: 'Clear the antenna array' }, en: [['drone', -5, -8], ['drone', 5, -10], ['drone', 0, -13], ['walker', -7, -12], ['walker', 7, -6], ['drone', 9, -12]],
        props(K) { K.antenna(-8, 4, 9); K.antenna(9, -3, 7); K.antenna(-3, -12, 6); for (let i = 0; i < 4; i++) { K.solar(-10, 10 - i * 4.5, 0); K.solar(10.5, 12 - i * 5, 0); }
          K.stack(3, 4, 0.4); K.crate(-4, -2, 1.3, 0.2); K.barrier(4, -8, 3.5, 0.3); K.barrier(-6, -6, 3, -0.2); K.canister(6, 0); K.canister(-9, -10); } },
      { w: 40, l: 40, h: 0, obj: { type: 'boss', text: 'Destroy the WARDEN' }, en: [['boss', 0, -10]],
        props(K) { K.antenna(-16, -16, 10); K.antenna(16, -15, 8); K.barrier(-8, 4, 4, 0.2); K.barrier(8, 3, 4, -0.2); K.barrier(0, -4, 4); K.stack(-12, -6, 0.3); K.stack(12, -8, -0.4); K.longCrate(-5, 12, 0.3); K.longCrate(6, 11, -0.3);
          K.canister(-14, 6); K.canister(14, 6); K.canister(-3, -14); K.canister(4, -15); for (let i = 0; i < 3; i++) { K.solar(-17, 14 - i * 5); K.solar(17, 14 - i * 5); } } },
      { w: 14, l: 24, h: 0, obj: { type: 'escape', at: [0, -9], time: 30, text: 'Reach the escape pod' }, en: [['drone', -4, -6], ['drone', 4, -8]],
        spawns: [[-5, -10], [5, -10]], waves: ['drone', 'drone', 'drone'], pod: true,
        props(K) { K.antenna(-5.5, 6, 6); K.barrier(-2, 2, 3, 0.2); K.barrier(3, -3, 3, -0.2); K.canister(5, 5); K.solar(5.5, 8); } },
    ] },
];

export const HOLDOUT = {
  id: 0, name: 'HOLDOUT', sub: 'Cargo Ring // endless waves', par: 999, holdout: true,
  theme: { wall: '#fff0f6', floor: '#efe4ec', dark: '#d6337a', trim: '#36d1ff', accent: 0xff3a6e, warn: 0xffa21a, light: 0xffd9e6, li: 14, fog: 0xffe0ee, hemi: [0xffe6f0, 0x8a6a7a, 1.12], sun: [0xfff0e0, 2.6], exposure: 1.08, alarm: true,
    space: { earthPos: [520, -100, 100], earthR: 360, sunDir: [0.3, 0.85, 0.35] } },
  rooms: [{ w: 32, l: 32, h: 10, open: [{ side: 'r', at: 0, len: 16, y0: 0.5, y1: 8.2, kind: 'bay' }], obj: { type: 'waves', text: 'Survive' },
    spawns: [[-14, -14], [0, -15], [14, -14], [-14, 0], [-14, 14], [14, 14], [0, 15]],
    props(K, rnd) {
      const spots = [[-6, -6], [6, -6], [-6, 6], [6, 6], [0, -10], [0, 10], [-10, 0], [10, 0], [-11, -11], [11, -11], [-11, 11], [11, 11]];
      for (const [x, z] of spots) { const r = rnd(); if (r < 0.3) K.crate(x, z, 1.3, rnd() * 3); else if (r < 0.55) K.barrier(x, z, 3, rnd() * 3); else if (r < 0.75) K.stack(x, z, rnd() * 3); else if (r < 0.9) K.longCrate(x, z, rnd() * 3); }
      K.pillar(-4, 0, 10, 1.2); K.pillar(4, 0, 10, 1.2); K.canister(-8, 3); K.canister(8, -3); K.canister(2, 12); K.canister(-3, -12); K.canister(12, 5);
      K.sign('CARGO RING', 'HOLD THE LINE', -15.9, 6, 0, Math.PI / 2, 5, '#ff3a6e'); K.beacon(-15.6, 7, -14); K.beacon(-15.6, 7, 14);
      K.vent(-15.8, 0.5, -6, 1, 0.3, 0); K.vent(-15.8, 0.5, 6, 1, 0.3, 0); K.vent(0, 9.7, 6, 0, -1, 0, 0.6);
      K.pipeRun(-15.7, 15, -15.7, -15, 8.5, 0.25, 'copper'); K.sag(-15.7, 8, -8, -6, 9.8, -8, 1.2); K.sag(-15.7, 8, 8, -6, 9.8, 8, 1.2);
    } }],
};

// ---------------------------------------------------------------- build
export function graffiti(B, cell, x, y, z, ry, size = 1.6, rx = 0) {
  const g = new THREE.PlaneGeometry(size, size), uv = g.attributes.uv, col = cell % 4, row = Math.floor(cell / 4);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (col + uv.getX(i)) / 4, 1 - (row + 1 - uv.getY(i)) / 2);
  B.add('graffiti', g, x, y, z, rx, ry, rx ? 0 : (Math.random() - 0.5) * 0.25);
}
const DOOR_W = 3.2, DOOR_H = 3.6, T = 0.5;
export function buildLevel(def, mats, rnd) {
  const th = def.theme, group = new THREE.Group(), B = new Builder(mats);
  mats.wall.color.set(th.wall); mats.floor.color.set(th.floor); mats.ceil.color.set(th.wall); mats.dark.color.set(th.dark); mats.trim.color.set(th.trim);
  mats.glowA.color.set(th.accent).multiplyScalar(2.2); mats.glowB.color.set(th.warn).multiplyScalar(2.2);
  mats.holo.color.set(th.accent).multiplyScalar(1.4);
  const dyn = { canisters: [], vents: [], beacons: [], signs: [], reactor: null, holo: null };
  const rooms = [], doors = [], lights = [];
  let zc = 0;
  def.rooms.forEach((r, i) => { const cx = r.cx || 0, z0 = zc, z1 = zc - r.l; rooms.push({ i, def: r, cx, cz: (z0 + z1) / 2, x0: cx - r.w / 2, x1: cx + r.w / 2, z0, z1, w: r.w, l: r.l, h: r.h }); zc = z1; });
  const hull = !!def.hull;

  for (const R of rooms) {
    let { cx, cz, w, l, h, x0, x1, z0, z1 } = R; const r = R.def, next = rooms[R.i + 1];
    // floor
    if (hull) { B.box('floor', w, 0.6, l, cx, -0.3, cz, 0, null, 4); for (let z = z0 - 2; z > z1; z -= 4) B.box('dark', w, 0.04, 0.12, cx, 0.01, z); for (let x = x0 + 4; x < x1; x += 4) B.box('dark', 0.12, 0.04, l, x, 0.01, cz); B.box('dark', w + 1, 1.6, l, cx, -1.4, cz); }
    else B.box('floor', w, 0.3, l, cx, -0.15, cz, 0, null, 4);
    for (const s of [-1, 1]) B.box('trim', 0.25, 0.02, l - 1, cx + s * (w / 2 - 1.4), 0.01, cz);
    if (next) graffiti(B, 1, (r.doorX ?? cx), 0.02, z1 + 3.2, Math.PI / 2, 2.6, -Math.PI / 2);
    if (w > 15) { graffiti(B, 2, cx + w * 0.22, 0.02, cz + l * 0.18, Math.random() * 6, 3.2, -Math.PI / 2); B.add('trim', new THREE.RingGeometry(2.6, 2.85, 40), cx - w * 0.2, 0.012, cz - l * 0.05, -Math.PI / 2); }
    // ceiling
    if (h > 0) {
      if (!r.solidRoof) { B.box('glass', w, 0.1, l, cx, h, cz); for (let x = x0 + 3; x < x1; x += 3) B.box('trim', 0.22, 0.4, l, x, h, cz); for (let z = z0 - 4; z > z1; z -= 4) B.box('dark', w, 0.55, 0.35, cx, h, z); B.box('dark', w, 0.7, 0.6, cx, h, z0 - 0.3); B.box('dark', w, 0.7, 0.6, cx, h, z1 + 0.3); }
      else {
        B.box('ceil', w, 0.3, l, cx, h + 0.15, cz, 0, null, 4);
        for (let z = z0 - 2; z > z1 + 1; z -= 4) { B.box('dark', w, 0.35, 0.35, cx, h - 0.17, z); }
        for (let x = x0 + 3.5; x < x1 - 1; x += 7) for (let z = z0 - 4; z > z1 + 1; z -= 4) { B.box('glowW', 1.8, 0.06, 0.6, x, h - 0.04, z); B.box('trim', 2.0, 0.1, 0.8, x, h - 0.0, z); }
      }
    }
    // lights (pool assigns real point lights near the player)
    if (!hull) for (let x = x0 + Math.min(w / 2, 5); x < x1 - 0.1; x += Math.max(7, w / Math.max(1, Math.round(w / 9)))) for (let z = z0 - Math.min(l / 2, 5); z > z1 + 0.1; z -= 9)
      lights.push({ p: new THREE.Vector3(x, Math.max(2.5, (h || 6) - 1), z), c: th.light, i: th.li });
    // walls
    const opens = r.open || [];
    const wall = (side) => {
      // side walls run along z; 'f' = front wall along x
      const ops = opens.filter(o => o.side === side);
      if (side === 'l' || side === 'r') {
        const x = side === 'l' ? x0 - T / 2 : x1 + T / 2, inward = side === 'l' ? 1 : -1, segs = [];
        let cur = z0; const sorted = ops.map(o => ({ ...o, a: cz + o.at + o.len / 2, b: cz + o.at - o.len / 2 })).sort((a, b) => b.a - a.a);
        for (const o of sorted) { if (cur > o.a) segs.push([cur, o.a]); hullOrWallOpening(o, x, inward, 'z'); cur = o.b; }
        if (cur > z1) segs.push([cur, z1]);
        for (const [a, b] of segs) solid('z', x, inward, a, b);
      }
    };
    const solid = (axis, c, inward, a, b) => {
      const len = Math.abs(a - b), mid = (a + b) / 2; if (len < 0.05) return;
      if (hull) { // railing instead of walls
        if (axis === 'z') { B.box('trim', 0.12, 0.12, len, c, 1.1, mid); B.box('trim', 0.1, 0.1, len, c, 0.55, mid); for (let s = Math.min(a, b); s <= Math.max(a, b); s += 2.5) B.box('dark', 0.15, 1.15, 0.15, c, 0.57, s); B.box('glowA', 0.03, 0.03, len, c + inward * 0.08, 1.18, mid); B.col(c - 0.3, c + 0.3, Math.min(a, b), Math.max(a, b), 0, 1.2); }
        else { B.box('trim', len, 0.12, 0.12, mid, 1.1, c); B.box('trim', len, 0.1, 0.1, mid, 0.55, c); for (let s = Math.min(a, b); s <= Math.max(a, b); s += 2.5) B.box('dark', 0.15, 1.15, 0.15, s, 0.57, c); B.box('glowA', len, 0.03, 0.03, mid, 1.18, c + inward * 0.08); B.col(Math.min(a, b), Math.max(a, b), c - 0.3, c + 0.3, 0, 1.2); }
        return;
      }
      const H = h;
      if (axis === 'z') {
        B.box('wall', T, H, len, c, H / 2, mid, 0, null, 4); B.col(c - T / 2, c + T / 2, Math.min(a, b), Math.max(a, b), 0, H);
        const ix = c + inward * (T / 2);
        B.box('trim', 0.2, 0.3, len, ix + inward * 0.1, 0.15, mid); B.box('trim', 0.08, 0.32, len, ix + inward * 0.04, 1.1, mid);
        const ly = Math.min(H - 0.8, 3.4); B.box('glowA', 0.06, 0.08, len - 0.4, ix + inward * 0.06, ly, mid);
        B.box('dark', 0.25, 0.25, len, ix + inward * 0.12, ly + 0.25, mid);
        for (let s = Math.max(a, b) - 2; s > Math.min(a, b) + 0.6; s -= 4) { B.box('dark', 0.35, H, 0.5, ix + inward * 0.17, H / 2, s); B.box('trim', 0.4, 0.5, 0.6, ix + inward * 0.2, 1.4, s); }
        if (H > 5) B.box('pipe', 0.2, 0.2, len, ix + inward * 0.3, H - 0.7, mid);
        for (let s = Math.max(a, b) - 4; s > Math.min(a, b) + 1.5; s -= 4) if (Math.random() < 0.45) graffiti(B, (Math.random() * 8) | 0, ix + inward * 0.03, 0.9 + Math.random() * 1.4, s, inward > 0 ? Math.PI / 2 : -Math.PI / 2, 1.3 + Math.random() * 0.9);
      } else {
        B.box('wall', len, H, T, mid, H / 2, c, 0, null, 4); B.col(Math.min(a, b), Math.max(a, b), c - T / 2, c + T / 2, 0, H);
        const iz = c + inward * (T / 2);
        B.box('trim', len, 0.3, 0.2, mid, 0.15, iz + inward * 0.1); B.box('trim', len, 0.32, 0.08, mid, 1.1, iz + inward * 0.04);
        const ly = Math.min(H - 0.8, 3.4); if (len > 1) B.box('glowA', len - 0.4, 0.08, 0.06, mid, ly, iz + inward * 0.06);
        for (let s = Math.min(a, b) + 2; s < Math.max(a, b) - 0.6; s += 4) B.box('dark', 0.5, H, 0.35, s, H / 2, iz + inward * 0.17);
        for (let s = Math.min(a, b) + 4; s < Math.max(a, b) - 1.5; s += 4) if (Math.random() < 0.4) graffiti(B, (Math.random() * 8) | 0, s, 0.9 + Math.random() * 1.4, iz + inward * 0.03, inward > 0 ? 0 : Math.PI, 1.3 + Math.random() * 0.9);
      }
    };
    function hullOrWallOpening(o, c, inward, axis) {
      const a = o.a, b = o.b, len = Math.abs(a - b), mid = (a + b) / 2, H = h;
      if (hull) return;
      if (axis === 'z') {
        if (o.y0 > 0) { B.box('wall', T, o.y0, len, c, o.y0 / 2, mid, 0, null, 4); B.box('hazard', 0.06, 0.2, len, c + inward * 0.26, o.y0 - 0.1, mid, 0, null, 1); }
        B.box('wall', T, H - o.y1, len, c, (H + o.y1) / 2, mid, 0, null, 4);
        B.box('trim', 0.6, 0.3, len, c, o.y1 + 0.15, mid); B.box('trim', 0.6, 0.3, len, c, o.y0 - 0.0, mid);
        B.box('glowA', 0.05, 0.05, len, c + inward * 0.3, o.y1, mid);
        for (const z of [a, b]) B.box('trim', 0.7, o.y1 - o.y0 + 0.3, 0.6, c, (o.y0 + o.y1) / 2, z);
        if (o.kind === 'bay') { B.add('field', new THREE.PlaneGeometry(len, o.y1 - o.y0), c, (o.y0 + o.y1) / 2, mid, 0, Math.PI / 2); B.col(c - 0.4, c + 0.4, Math.min(a, b), Math.max(a, b), 0, H); }
        else { B.add('glass', new THREE.PlaneGeometry(len, o.y1 - o.y0), c, (o.y0 + o.y1) / 2, mid, 0, Math.PI / 2); for (let s = Math.min(a, b) + 3; s < Math.max(a, b) - 0.5; s += 3) B.box('trim', 0.3, o.y1 - o.y0, 0.18, c, (o.y0 + o.y1) / 2, s); B.col(c - T / 2, c + T / 2, Math.min(a, b), Math.max(a, b), 0, H); }
      } else {
        if (o.y0 > 0) B.box('wall', len, o.y0, T, mid, o.y0 / 2, c, 0, null, 4);
        B.box('wall', len, H - o.y1, T, mid, (H + o.y1) / 2, c, 0, null, 4);
        B.box('trim', len, 0.3, 0.6, mid, o.y1 + 0.15, c); B.box('trim', len, 0.3, 0.6, mid, o.y0, c);
        B.add('glass', new THREE.PlaneGeometry(len, o.y1 - o.y0), mid, (o.y0 + o.y1) / 2, c);
        for (let s = Math.min(a, b) + 2.5; s < Math.max(a, b) - 0.5; s += 2.5) B.box('trim', 0.18, o.y1 - o.y0, 0.3, s, (o.y0 + o.y1) / 2, c);
        B.col(Math.min(a, b), Math.max(a, b), c - T / 2, c + T / 2, 0, H);
      }
    }
    wall('l'); wall('r');
    if (R.i === 0) solid('x', z0 + T / 2, -1, x0 - T, x1 + T);
    // front wall with the door
    const fz = z1 - T / 2, fx0 = next ? Math.min(x0, next.x0) - T : x0 - T, fx1 = next ? Math.max(x1, next.x1) + T : x1 + T;
    const H = next ? Math.max(h, next.h) : h;
    if (next) {
      const dx = r.doorX ?? (Math.max(x0, next.x0) + Math.min(x1, next.x1)) / 2;
      const fo = opens.find(o => o.side === 'f');
      const svH = h; h = H;
      solid('x', fz, 1, fx0, dx - DOOR_W / 2); solid('x', fz, 1, dx + DOOR_W / 2, fx1);
      h = svH;
      if (!hull) {
        if (H > DOOR_H) B.box('wall', DOOR_W, H - DOOR_H, T, dx, (H + DOOR_H) / 2, fz, 0, null, 4);
        if (fo) { // big window above/around the door in the front wall
          const wy0 = Math.max(fo.y0, DOOR_H + 0.4), wy1 = Math.min(fo.y1, H - 0.4);
          if (wy1 > wy0 + 0.5) { B.add('glass', new THREE.PlaneGeometry(fo.len, wy1 - wy0), dx, (wy0 + wy1) / 2, fz + 0.3); B.box('trim', fo.len, 0.25, 0.6, dx, wy0, fz); B.box('trim', fo.len, 0.25, 0.6, dx, wy1, fz); }
        }
        // frame
        for (const s of [-1, 1]) { B.box('trim', 0.5, DOOR_H + 0.4, 0.9, dx + s * (DOOR_W / 2 + 0.2), (DOOR_H + 0.4) / 2, fz); B.box('hazard', 0.08, DOOR_H, 0.92, dx + s * (DOOR_W / 2 + 0.47), DOOR_H / 2, fz, 0, null, 1); }
        B.box('trim', DOOR_W + 0.9, 0.5, 0.9, dx, DOOR_H + 0.2, fz);
      }
      B.box('hazard', DOOR_W, 0.02, 1.2, dx, 0.011, fz + 1.0, 0, null, 1); B.box('hazard', DOOR_W, 0.02, 1.2, dx, 0.011, fz - 1.0, 0, null, 1);
      const dcol = B.col(dx - DOOR_W / 2, dx + DOOR_W / 2, fz - T / 2, fz + T / 2, 0, hull ? 3 : DOOR_H);
      doors.push({ x: dx, z: fz, col: dcol, room: R.i, open: 0, target: 0, field: hull });
    } else {
      const svH = h; h = H; solid('x', fz, 1, fx0, fx1); h = svH;
    }
    // props
    const K = propsKit(B, mats, dyn, cx, cz);
    r.props && r.props(K, rnd);
    // lift / escape pod pads
    if (r.lift || r.pod) { const [ax, az] = r.obj.at; B.cyl('trim', 2.2, 0.12, cx + ax, 0.06, cz + az, 0, 0, 0, 32); B.cyl('dark', 1.9, 0.14, cx + ax, 0.07, cz + az, 0, 0, 0, 32); B.add('glowA', new THREE.TorusGeometry(2.05, 0.04, 6, 48), cx + ax, 0.15, cz + az, Math.PI / 2); }
    if (r.pod) { const [ax, az] = r.obj.at; B.add('paint', new THREE.CapsuleGeometry(1.2, 1.6, 8, 16), cx + ax, 2.2, cz + az - 2.6, 0, 0, 0, 1, 1, 1, 0xd0d4da); B.add('glowB', new THREE.TorusGeometry(1.22, 0.05, 6, 32), cx + ax, 2.2, cz + az - 2.6, Math.PI / 2); B.add('glass', new THREE.SphereGeometry(0.8, 16, 10), cx + ax, 2.6, cz + az - 1.6); B.col(cx + ax - 1.2, cx + ax + 1.2, cz + az - 3.8, cz + az - 1.4, 0, 4); }
  }
  B.finish(group);
  group.traverse(o => { if (o.isMesh) o.matrixAutoUpdate = false, o.updateMatrix(); });

  // dynamic: door panels
  const doorObjs = [];
  const dmat = mats.paint;
  for (const d of doors) {
    const g = new THREE.Group(); g.position.set(d.x, 0, d.z); group.add(g);
    const halves = [];
    if (d.field) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(DOOR_W + 1.2, 3), mats.field); f.position.y = 1.5; g.add(f); halves.push(f);
      for (const s of [-1, 1]) { const p = new THREE.Mesh(sbox(0.5, 3.4, 0.6), mats.trim); p.position.set(s * (DOOR_W / 2 + 0.85), 1.7, 0); g.add(p); }
    } else for (const s of [-1, 1]) {
      const hg = new THREE.Group(); hg.position.x = s * DOOR_W / 4; g.add(hg);
      const geoBody = sbox(DOOR_W / 2, DOOR_H, 0.3), body = new THREE.Mesh(geoBody, mats.wall); body.position.y = DOOR_H / 2; body.castShadow = true; hg.add(body);
      const stripe = new THREE.Mesh(sbox(DOOR_W / 2 - 0.1, 0.35, 0.34, 1), mats.hazard); stripe.position.y = 1.0; hg.add(stripe);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.08, DOOR_H - 0.6, 0.36), mats.glowA); lamp.position.set(-s * (DOOR_W / 4 - 0.06), DOOR_H / 2, 0); hg.add(lamp);
      halves.push(hg); hg.userData.s = s;
    }
    const status = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.95), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.3, 0.2), toneMapped: false }));
    status.position.set(0, hull ? 3.6 : DOOR_H + 0.45, 0); g.add(status);
    doorObjs.push(Object.assign(d, { g, halves, status }));
  }
  // signs
  for (const s of dyn.signs) { const m = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.w / 4), new THREE.MeshBasicMaterial({ map: signTex(s.text, s.sub, s.col), color: new THREE.Color(1.4, 1.4, 1.4), toneMapped: false })); m.position.set(s.x, s.y, s.z); m.rotation.y = s.ry; group.add(m); }
  // cover points per room (around low colliders)
  for (const R of rooms) {
    R.cover = [];
    for (const c of B.cols) {
      if (c.y1 > 3 || c.y1 < 0.8) continue; const mx = (c.x0 + c.x1) / 2, mz = (c.z0 + c.z1) / 2;
      if (mx < R.x0 || mx > R.x1 || mz > R.z0 || mz < R.z1) continue;
      for (const [ox, oz] of [[c.x0 - 0.8, mz], [c.x1 + 0.8, mz], [mx, c.z0 - 0.8], [mx, c.z1 + 0.8]]) if (ox > R.x0 + 0.8 && ox < R.x1 - 0.8 && oz < R.z0 - 0.8 && oz > R.z1 + 0.8) R.cover.push({ x: ox, z: oz, c, taken: null });
    }
  }
  return { group, cols: B.cols, rooms, doors: doorObjs, lights, dyn, hull, def };
}
