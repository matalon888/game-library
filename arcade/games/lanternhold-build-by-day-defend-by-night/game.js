// Lanternhold — build by day, defend by night. AGENTPARK original: code, models, music and sound are our own.
// Day: spend gold on walls, archer towers, farmsteads, barracks and spires on the glowing plots around the Hall.
// Night: ride the lantern knight (drag anywhere / WASD) and hold the Hall against waves of slime raiders.
import { THREE, createStage, createUI, loop, burst, confetti, tone, note, buzz, store, clamp, lerp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { bake, vcMat } from './merge.js';

const NAME = 'Lanternhold: Build by Day, Defend by Night';
const S = store('lanternhold');
const FL = flow('lanternhold');
const $ = s => document.querySelector(s);

// ================================================================ stage
const stage = createStage({ fov: 46, shadows: true, shadowSize: 17 });
const { scene, camera, sun, hemi } = stage;
const ui = createUI({ title: 'LANTERN<br>HOLD', hint: 'Tap to begin', hand: '🏮', score: false });
const D = daily('lanternhold', ui, { name: NAME });
const B = board({ game: 'lanternhold', label: 'Nights survived', limits: { maxRun: 60, maxPerSec: 0.25 }, corner: 'tl' });
{ const w = ui.els.win; w.classList.add('dim'); w.querySelector('p').firstChild.textContent = 'NIGHT '; w.querySelector('h1').textContent = 'SURVIVED!'; w.querySelector('.hint').textContent = 'Tap for dawn'; }
const startInfo = document.createElement('p'); startInfo.style.cssText = 'font-size:17px;opacity:.95'; ui.els.start.querySelector('h1').after(startInfo);
const sub2 = document.createElement('p'); sub2.textContent = 'Build by day · defend by night'; sub2.style.cssText = 'font-size:18px'; ui.els.start.querySelector('h1').after(sub2);
const newBtn = document.createElement('button'); newBtn.className = 'hc-btn'; newBtn.textContent = 'New run'; newBtn.style.cssText = 'font-size:16px;padding:7px 20px;margin-top:6px;background:rgba(0,0,0,.25)';
newBtn.addEventListener('pointerdown', e => e.stopPropagation()); newBtn.hidden = true;
startInfo.after(newBtn);

// ================================================================ helpers + models
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (a, b, h, s = 7) => new THREE.CylinderGeometry(a, b, h, s);
const cone = (r, h, s = 6) => new THREE.ConeGeometry(r, h, s);
const sph = (r, w = 9, h = 7) => new THREE.SphereGeometry(r, w, h);
const P = (geo, color, pos = [0, 0, 0], rot, scl) => ({ geo, color, pos, rot, scl });
const VM = vcMat({ flatShading: true, roughness: 0.75 });
const mk = (geo, shadow = true) => { const m = new THREE.Mesh(geo, VM); m.castShadow = shadow; m.receiveShadow = true; return m; };
const Q4 = Math.PI / 4;
const STONE = '#d3cabb', STONED = '#aba293', WOOD = '#a06e48', WOODD = '#6e4a30', PLASTER = '#f3e8d2', ROOF = '#d4644a', GOLD = '#f2c14e';

const MODELS = {
  hall: () => bake([
    P(box(3.8, .5, 3.8), STONED, [0, .25, 0]), P(box(2.9, 1.8, 2.9), PLASTER, [0, 1.4, 0]),
    P(box(3.05, .17, 3.05), WOODD, [0, .62, 0]), P(box(3.05, .17, 3.05), WOODD, [0, 2.3, 0]),
    P(cone(2.5, 1.8, 4), ROOF, [0, 3.25, 0], [0, Q4, 0]),
    P(cyl(.4, .48, 1.4, 6), PLASTER, [0, 4.4, 0]), P(box(.3, .34, .06), '#ffd27a', [0, 4.55, .42]),
    P(cone(.6, 1, 6), ROOF, [0, 5.55, 0]), P(cyl(.035, .035, 1.1, 4), WOODD, [0, 6.4, 0]), P(box(.62, .36, .04), '#5b84c4', [.33, 6.72, 0]),
    P(box(.8, 1.15, .12), '#5b3a26', [0, 1.08, 1.47]), P(box(1.3, .14, .6), STONED, [0, .07, 2.05]),
    P(box(.42, .42, .08), '#ffd27a', [-.9, 1.65, 1.47]), P(box(.42, .42, .08), '#ffd27a', [.9, 1.65, 1.47]),
    P(box(.08, .42, .42), '#ffd27a', [1.47, 1.65, 0]), P(box(.08, .42, .42), '#ffd27a', [-1.47, 1.65, 0]),
    P(cyl(.07, .07, 1.2, 5), WOODD, [1.7, .6, 1.7]), P(sph(.16), '#ffb347', [1.7, 1.25, 1.7]),
    P(cyl(.07, .07, 1.2, 5), WOODD, [-1.7, .6, 1.7]), P(sph(.16), '#ffb347', [-1.7, 1.25, 1.7]),
  ]),
  wall: l => {
    const p = [];
    if (l === 1) { for (let i = -2; i <= 2; i++) p.push(P(cyl(.21, .24, 1.4, 6), WOOD, [i * .62, .7, 0]), P(cone(.23, .36, 6), WOODD, [i * .62, 1.58, 0]));
      p.push(P(box(3.1, .14, .12), WOODD, [0, .95, .2]), P(box(3.1, .14, .12), WOODD, [0, .45, .2])); }
    else { const h = l === 2 ? 1.3 : 1.8; p.push(P(box(3.5, .22, 1.05), STONED, [0, .11, 0]), P(box(3.2, h, .82), STONE, [0, h / 2 + .1, 0]));
      for (const x of [-1.2, -.4, .4, 1.2]) p.push(P(box(.46, .36, .88), STONE, [x, h + .28, 0]));
      if (l === 3) for (const x of [-1.65, 1.65]) p.push(P(cyl(.55, .62, 2.6, 8), STONE, [x, 1.3, 0]), P(cone(.68, .8, 8), '#5b84c4', [x, 3, 0]));
      if (l === 3) p.push(P(box(.6, .8, .04), '#d4644a', [0, 1.2, .45])); }
    return bake(p);
  },
  archer: l => {
    const h = 1.9 + .45 * (l - 1), p = [];
    if (l === 1) for (const [x, z] of [[-.45, -.45], [.45, -.45], [-.45, .45], [.45, .45]]) p.push(P(cyl(.08, .1, h, 5), WOOD, [x, h / 2, z]));
    else p.push(P(cyl(.62, .78, h, 8), STONE, [0, h / 2, 0]), P(box(.3, .45, .06), '#5b3a26', [0, .3, .72]));
    p.push(P(box(1.45, .2, 1.45), WOODD, [0, h + .1, 0]));
    for (const [x, z, w, d] of [[0, .7, 1.45, .08], [0, -.7, 1.45, .08], [.7, 0, .08, 1.45], [-.7, 0, .08, 1.45]]) p.push(P(box(w, .36, d), WOOD, [x, h + .38, z]));
    p.push(P(cyl(.16, .2, .45, 6), '#4f9a6b', [0, h + .45, 0]), P(sph(.15), '#ffd7ba', [0, h + .8, 0]), P(cone(.2, .22, 6), '#4f9a6b', [0, h + .98, 0]));
    for (const [x, z] of [[-.62, -.62], [.62, -.62], [-.62, .62], [.62, .62]]) p.push(P(cyl(.04, .04, .75, 4), WOODD, [x, h + .55, z]));
    p.push(P(cone(1.15, .95, 4), '#5b84c4', [0, h + 1.38, 0], [0, Q4, 0]));
    if (l === 3) p.push(P(cyl(.03, .03, .8, 4), WOODD, [0, h + 2.1, 0]), P(box(.45, .28, .03), GOLD, [.24, h + 2.35, 0]));
    return bake(p);
  },
  house: l => {
    const p = [P(box(1.5, .95, 1.15), PLASTER, [0, .48, 0]), P(cone(1.15, .8, 4), ROOF, [0, 1.35, 0], [0, Q4, 0], [1, 1, .85]),
      P(box(.3, .55, .06), '#5b3a26', [0, .28, .6]), P(box(.28, .28, .05), '#ffd27a', [.45, .6, .6])];
    const field = (x, z) => { p.push(P(box(1.3, .1, 1.1), '#8a6a3e', [x, .05, z])); for (let i = 0; i < 4; i++) p.push(P(box(1.2, .22, .14), '#efc95a', [x, .2, z - .4 + i * .27])); };
    field(1.55, 0); if (l >= 2) { p.push(P(box(.22, .5, .22), STONED, [-.4, 1.5, 0])); field(1.55, 1.25); }
    if (l >= 3) { field(-1.5, .6); p.push(P(cyl(.5, .55, .9, 8), '#c98b4a', [-1.35, .45, -.8]), P(cone(.62, .5, 8), ROOF, [-1.35, 1.15, -.8])); }
    return bake(p);
  },
  barracks: l => {
    const p = [P(box(2.1, .95, 1.25), '#e2d3b6', [0, .48, 0]), P(cone(1.35, .85, 4), '#8e3b46', [0, 1.38, 0], [0, Q4, 0], [1.25, 1, .78]),
      P(cyl(.28, .28, .06, 10), GOLD, [0, .62, .66], [Math.PI / 2, 0, 0]), P(box(.06, .3, .02), '#8e3b46', [0, .62, .7])];
    for (let i = 0; i < l + 1; i++) p.push(P(cyl(.025, .025, 1.3, 4), WOODD, [-1.2 + i * .18, .65, .75], [.15, 0, 0]), P(cone(.05, .16, 4), '#dfe3ea', [-1.2 + i * .18, 1.35, .85]));
    if (l >= 2) p.push(P(cyl(.03, .03, 1.2, 4), WOODD, [1.15, 1.2, .5]), P(box(.45, .3, .03), '#8e3b46', [1.39, 1.6, .5]));
    if (l >= 3) p.push(P(box(.9, .6, .9), STONE, [1.4, .3, -.3]), P(cone(.7, .5, 4), '#8e3b46', [1.4, .85, -.3], [0, Q4, 0]));
    return bake(p);
  },
  mage: l => {
    const h = 2.3 + .4 * (l - 1);
    return bake([P(cyl(.65, .8, .5, 6), STONED, [0, .25, 0]), P(cyl(.3, .5, h, 6), '#8a76d6', [0, .5 + h / 2, 0]),
      P(box(.2, .3, .05), '#ffe9a8', [0, .5 + h * .6, .38]), P(cone(.5, 1, 6), '#4b3c8f', [0, h + 1, 0]), P(sph(.1), GOLD, [0, h + 1.55, 0])]);
  },
  ballista: l => {
    const p = [P(cyl(.95, 1.05, .5, 8), WOOD, [0, .25, 0]), P(box(.25, .5, .25), WOODD, [0, .75, 0]),
      P(box(.18, .16, 1.6), WOOD, [0, 1.05, .1]), P(box(2 + .2 * l, .12, .14), WOODD, [0, 1.08, .55], [0, 0, 0]),
      P(box(.05, .05, 1.5), '#ddd', [0, 1.18, .2]), P(cone(.09, .25, 4), '#9aa3b5', [0, 1.18, 1], [Math.PI / 2, 0, 0])];
    if (l >= 2) p.push(P(box(.15, .7, .15), STONE, [-.7, .6, -.5]), P(box(.15, .7, .15), STONE, [.7, .6, -.5]));
    if (l >= 3) p.push(P(cyl(.03, .03, .9, 4), WOODD, [0, 1.6, -.6]), P(box(.4, .26, .03), GOLD, [.21, 1.9, -.6]));
    return bake(p);
  },
};
const MCACHE = {};
const model = (t, l = 1) => (MCACHE[t + l] = MCACHE[t + l] || MODELS[t](l));

// ================================================================ building types
const BT = {
  wall: { n: 'Wall', ic: '🧱', cost: [8, 12, 18], hp: [150, 280, 450], r: 1.45, d: 'Blocks the road. Raiders must break it first.' },
  archer: { n: 'Archer Tower', ic: '🏹', cost: [14, 18, 26], hp: [80, 120, 170], range: [6.5, 7.3, 8.2], dmg: [7, 10, 14], rate: [1.1, 1.45, 1.85], r: .9, d: 'Shoots raiders and fliers in range.' },
  house: { n: 'Farmstead', ic: '🌾', cost: [10, 14, 20], hp: [50, 80, 110], inc: [3, 5, 8], r: .9, d: 'Earns gold every dawn.' },
  barracks: { n: 'Barracks', ic: '🛡️', cost: [18, 22, 30], hp: [90, 130, 170], units: [2, 3, 4], r: 1.05, d: 'Spearmen hold the nearest road at night.' },
  mage: { n: 'Mage Spire', ic: '🔮', cost: [26, 30, 38], hp: [70, 100, 140], range: [6, 6.6, 7.2], dmg: [12, 18, 26], rate: [.6, .75, .9], splash: 1.8, unlock: 3, r: .9, d: 'Splash bolts pop whole clumps.' },
  ballista: { n: 'Ballista', ic: '🎯', cost: [32, 36, 44], hp: [90, 130, 170], range: [10, 11, 12], dmg: [34, 50, 70], rate: [.38, .45, .55], unlock: 6, r: 1.0, d: 'Huge bolts for brutes and bosses.' },
};
const PERKS = [
  ['blade', '⚔️', 'Sharp Blade', 'Your knight hits 50% harder.'], ['mount', '🐐', 'Swift Hooves', 'Ride 25% faster.'],
  ['bolt', '🏮', 'Lantern Bolt', 'Your lantern shoots light bolts.'], ['rally', '📯', 'Rally Horn', 'Spearmen +60% HP, +1 per barracks.'],
  ['tax', '🌾', 'Good Harvest', 'Farmsteads earn 50% more.'], ['arrows', '🪶', 'Fletchers', 'Towers shoot 25% faster.'],
  ['stone', '⛏️', 'Masons', 'Walls have 50% more HP.'], ['hero', '❤️', 'Stout Heart', 'Knight +60% HP, back up faster.'],
];

// ================================================================ world
const ISL = 21;
const top = new THREE.Mesh(new THREE.CircleGeometry(ISL, 30), new THREE.MeshStandardMaterial({ color: '#95c47c', roughness: .95, flatShading: true }));
top.rotation.x = -Math.PI / 2; top.receiveShadow = true; scene.add(top);
const cliff = new THREE.Mesh(new THREE.CylinderGeometry(ISL, ISL - 2.5, 4, 30, 1, true), new THREE.MeshStandardMaterial({ color: '#c9a27e', roughness: .9, flatShading: true }));
cliff.position.y = -2; scene.add(cliff);
const water = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#79b4cf', roughness: .6 }));
water.rotation.x = -Math.PI / 2; water.position.y = -1.3; scene.add(water);
const shore = new THREE.Mesh(new THREE.RingGeometry(ISL - .3, ISL + 2.2, 40), new THREE.MeshBasicMaterial({ color: '#d6ecf2', transparent: true, opacity: .5 }));
shore.rotation.x = -Math.PI / 2; shore.position.y = -1.25; scene.add(shore);

const treeGeo = bake([P(cyl(.12, .16, .7, 5), '#8a5a3c', [0, .35, 0]), P(cone(.75, 1.5, 6), '#4f9a6b', [0, 1.3, 0]), P(cone(.58, 1.1, 6), '#62b07c', [0, 1.95, 0])]);
const pineGeo = bake([P(cyl(.1, .14, .6, 5), '#8a5a3c', [0, .3, 0]), P(sph(.7, 7, 5), '#7cbf6a', [0, 1.1, 0]), P(sph(.5, 7, 5), '#8fd07a', [.25, 1.55, .1])]);
const rockGeo = bake([P(new THREE.DodecahedronGeometry(.55), '#b3adbf', [0, .2, 0], 0, [1, .65, 1]), P(new THREE.DodecahedronGeometry(.3), '#c9c3d4', [.45, .1, .2])]);
const flowerGeo = bake([P(cyl(.02, .02, .3, 3), '#4f9a6b', [0, .15, 0]), P(sph(.09, 5, 4), '#ffffff', [0, .32, 0]), P(cyl(.02, .02, .25, 3), '#4f9a6b', [.15, .12, .1]), P(sph(.08, 5, 4), '#ffd166', [.15, .27, .1])]);
const trees = new THREE.InstancedMesh(treeGeo, VM, 70), bushes = new THREE.InstancedMesh(pineGeo, VM, 40), rocks = new THREE.InstancedMesh(rockGeo, VM, 26), flowers = new THREE.InstancedMesh(flowerGeo, VM, 60);
for (const m of [trees, bushes, rocks]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }
scene.add(flowers);
const roadMat = new THREE.MeshStandardMaterial({ color: '#dcc293', roughness: 1 });
const roadGeo = new THREE.PlaneGeometry(2.3, 17.5, 1, 1); roadGeo.rotateX(-Math.PI / 2);
const roads = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(roadGeo, roadMat); m.receiveShadow = true; m.position.y = .015; scene.add(m); return m; });
const beamMat = new THREE.MeshBasicMaterial({ color: '#ff4d5e', transparent: true, opacity: .32, blending: THREE.AdditiveBlending, depthWrite: false });
const beams = [0, 1, 2, 3].map(() => { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.CylinderGeometry(.55, .9, 9, 12, 1, true), beamMat); c.position.y = 4.5; g.add(c);
  const f = new THREE.Mesh(bake([P(cyl(.06, .06, 2.2, 5), WOODD, [0, 1.1, 0]), P(box(.9, .6, .04), '#ff4d5e', [.46, 1.85, 0]), P(sph(.12), '#fff', [.46, 1.85, .03])]), VM); f.castShadow = true; g.add(f); scene.add(g); return g; });

// plots
const plotRing = new THREE.InstancedMesh(new THREE.CylinderGeometry(.78, .78, .06, 24), new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#a57b18', emissiveIntensity: .6, roughness: .4 }), 24);
const plotCoin = new THREE.InstancedMesh(new THREE.CylinderGeometry(.3, .3, .08, 16), new THREE.MeshStandardMaterial({ color: '#ffd76a', emissive: '#7a5400', emissiveIntensity: .5, metalness: .3, roughness: .3 }), 24);
plotCoin.castShadow = true; scene.add(plotRing, plotCoin);
plotRing.frustumCulled = plotCoin.frustumCulled = false;

// hall
const hallMesh = mk(model('hall')); scene.add(hallMesh);
const hallGlow = new THREE.PointLight('#ffb35c', 0, 13, 1.3); hallGlow.position.set(0, 3.2, 3.2); scene.add(hallGlow);
const hall = { x: 0, z: 0, r: 2.0, hp: 300, max: 300, alive: true, hall: true, type: 'hall', mesh: hallMesh, hitT: 0 };

// fireflies
const ffN = 50, ffGeo = new THREE.BufferGeometry(), ffPos = new Float32Array(ffN * 3), ffSeed = [];
for (let i = 0; i < ffN; i++) { const a = Math.random() * 6.28, r = 3 + Math.random() * 16; ffSeed.push([Math.cos(a) * r, Math.sin(a) * r, Math.random() * 6]); }
ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
const ffMat = new THREE.PointsMaterial({ color: '#fff3a0', size: .22, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
const fireflies = new THREE.Points(ffGeo, ffMat); scene.add(fireflies);

// ================================================================ hero: a lantern knight on a round goat
const hero = { x: 0, z: 3.2, vx: 0, vz: 0, face: 0, hp: 100, max: 100, alive: true, cd: 0, bcd: 0, swing: 0, resp: 0, mx: null, mz: null };
const heroG = new THREE.Group(); scene.add(heroG);
const heroBody = mk(bake([
  P(sph(.58, 10, 8), '#f4ecdc', [0, .78, 0], 0, [1, .85, 1.22]), P(sph(.34, 9, 7), '#f4ecdc', [0, 1.05, .72]),
  P(sph(.18, 7, 5), '#e8c7b0', [0, .98, 1.02]), P(sph(.05, 5, 4), '#2b2236', [-.15, 1.15, .98]), P(sph(.05, 5, 4), '#2b2236', [.15, 1.15, .98]),
  P(new THREE.TorusGeometry(.14, .05, 5, 8, Math.PI * 1.4), '#8a6a4a', [-.27, 1.3, .62], [0, Math.PI / 2, 0]), P(new THREE.TorusGeometry(.14, .05, 5, 8, Math.PI * 1.4), '#8a6a4a', [.27, 1.3, .62], [0, Math.PI / 2, 0]),
  P(box(.08, .2, .14), '#f4ecdc', [-.33, 1.1, .7], [0, 0, .7]), P(box(.08, .2, .14), '#f4ecdc', [.33, 1.1, .7], [0, 0, -.7]),
  ...[[-.3, -.42], [.3, -.42], [-.3, .42], [.3, .42]].map(([x, z]) => P(cyl(.1, .09, .42, 6), '#6b4a3a', [x, .22, z])),
  P(sph(.12, 6, 5), '#f4ecdc', [0, .95, -.68]), P(box(.95, .12, .7), '#5b84c4', [0, 1.25, -.05]),
]));
const rider = mk(bake([
  P(cyl(.24, .3, .62, 8), '#3f6fd1', [0, 1.62, -.05]), P(box(.5, .14, .4), GOLD, [0, 1.42, -.05]), P(sph(.21, 9, 7), '#ffd7ba', [0, 2.1, -.05]),
  P(sph(.24, 9, 6), '#c7ccd6', [0, 2.17, -.08], 0, [1, .85, 1.05]), P(box(.08, .32, .34), '#e8505b', [0, 2.42, -.12]),
  P(box(.3, .06, .05), '#2b2236', [0, 2.1, .16]),
]));
const sword = new THREE.Group(); sword.position.set(.3, 1.75, 0);
sword.add(mk(bake([P(box(.09, .9, .04), '#eef1f6', [0, .55, 0]), P(box(.28, .06, .08), GOLD, [0, .1, 0]), P(cyl(.03, .03, .2, 4), WOODD, [0, 0, 0])])));
const lantern = new THREE.Group(); lantern.position.set(-.38, 1.7, .25);
lantern.add(mk(bake([P(cyl(.025, .025, .55, 4), WOODD, [0, .1, 0], [.4, 0, 0])])));
const lampCore = new THREE.Mesh(new THREE.BoxGeometry(.2, .26, .2), new THREE.MeshBasicMaterial({ color: '#ffe08a' })); lampCore.position.set(0, .3, .2); lantern.add(lampCore);
const lampLight = new THREE.PointLight('#ffc070', 0, 9, 1.2); lampLight.position.set(0, .4, .25); lantern.add(lampLight);
heroG.add(heroBody, rider, sword, lantern);
const swoosh = new THREE.Mesh(new THREE.RingGeometry(1.4, 2.0, 24, 1, 0, Math.PI * 1.2), new THREE.MeshBasicMaterial({ color: '#fff7d6', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
swoosh.rotation.x = -Math.PI / 2; swoosh.position.y = .9; scene.add(swoosh);

// ================================================================ raiders (instanced, one draw call per kind)
const eyes = (y, z, sx = .18, r = .12) => [P(sph(r, 7, 5), '#fff6a8', [-sx, y, z]), P(sph(r, 7, 5), '#fff6a8', [sx, y, z]), P(sph(r * .5, 5, 4), '#26143a', [-sx, y, z + r * .8]), P(sph(r * .5, 5, 4), '#26143a', [sx, y, z + r * .8])];
const EK = {
  grub: { hp: 22, spd: 1.5, dps: 6, rad: .55, bounty: 1, cap: 90, geo: bake([P(sph(.5, 10, 8), '#8a5ee0', [0, .42, 0], 0, [1, .82, 1]), P(sph(.3, 8, 6), '#a68ae8', [0, .3, .25]), ...eyes(.58, .36), P(cone(.08, .22, 5), '#f0d6a0', [-.25, .84, 0], [0, 0, .3]), P(cone(.08, .22, 5), '#f0d6a0', [.25, .84, 0], [0, 0, -.3])]) },
  runner: { hp: 13, spd: 2.8, dps: 4, rad: .45, bounty: 1, cap: 60, geo: bake([P(sph(.38, 9, 7), '#45d0c0', [0, .36, 0], 0, [.9, .8, 1.2]), ...eyes(.48, .3, .13, .09), P(cone(.08, .45, 4), '#2e8a82', [-.18, .78, -.05], [-.4, 0, .35]), P(cone(.08, .45, 4), '#2e8a82', [.18, .78, -.05], [-.4, 0, -.35])]) },
  brute: { hp: 75, spd: 1.05, dps: 14, rad: .95, bounty: 3, cap: 40, geo: bake([P(sph(.8, 11, 8), '#c2475f', [0, .72, 0], 0, [1, .9, 1]), P(sph(.45, 8, 6), '#e3798a', [0, .55, .45]), ...eyes(.95, .62, .26, .15), P(cone(.14, .4, 5), '#f0d6a0', [-.45, 1.4, 0], [0, 0, .5]), P(cone(.14, .4, 5), '#f0d6a0', [.45, 1.4, 0], [0, 0, -.5]), P(cyl(.08, .16, 1.1, 6), WOOD, [.8, .9, .3], [.6, 0, -.3])]) },
  flyer: { hp: 18, spd: 2.0, dps: 6, rad: .5, bounty: 2, cap: 40, fly: true, geo: bake([P(sph(.36, 9, 7), '#9a62e0', [0, 0, 0]), ...eyes(.08, .27, .13, .1), P(box(.75, .05, .4), '#5a3a9c', [-.5, .08, 0], [0, 0, .35]), P(box(.75, .05, .4), '#5a3a9c', [.5, .08, 0], [0, 0, -.35]), P(cone(.08, .2, 4), '#5a3a9c', [0, -.35, 0], [Math.PI, 0, 0])]) },
  boss: { hp: 650, spd: .75, dps: 34, rad: 1.4, bounty: 25, cap: 3, boss: true, geo: bake([P(sph(1.4, 14, 10), '#4f3290', [0, 1.3, 0], 0, [1, .92, 1]), P(sph(.8, 10, 8), '#8466cc', [0, 1, .75]), ...eyes(1.75, 1.05, .45, .26), ...[0, 1, 2, 3, 4].map(i => P(cone(.16, .5, 5), GOLD, [Math.cos(i * 1.26) * .6, 2.6, Math.sin(i * 1.26) * .6 - .1])), P(cyl(.65, .7, .2, 10), GOLD, [0, 2.45, -.1])]) },
};
const EM = vcMat({ flatShading: true, roughness: .6, emissive: '#3b1d5c', emissiveIntensity: .55 });
for (const k in EK) { const e = EK[k]; e.im = new THREE.InstancedMesh(e.geo, EM, e.cap); e.im.castShadow = true; e.im.frustumCulled = false; e.im.count = 0; scene.add(e.im); }
const allyIM = new THREE.InstancedMesh(bake([P(cyl(.17, .22, .55, 7), '#3f6fd1', [0, .45, 0]), P(box(.36, .1, .3), GOLD, [0, .3, 0]), P(sph(.16, 8, 6), '#ffd7ba', [0, .86, 0]), P(cone(.19, .24, 7), '#c7ccd6', [0, 1.02, 0]),
  P(cyl(.025, .025, 1.4, 4), WOODD, [.26, .7, .1], [.25, 0, 0]), P(cone(.06, .2, 4), '#e6e9ef', [.26, 1.42, .28], [.25, 0, 0]), P(cyl(.18, .18, .05, 8), '#e8505b', [-.22, .5, .05], [0, 0, Math.PI / 2])]), VM, 40);
allyIM.castShadow = true; allyIM.frustumCulled = false; allyIM.count = 0; scene.add(allyIM);
const arrowIM = new THREE.InstancedMesh(bake([P(box(.05, .05, .75), '#8a5a3c', [0, 0, 0]), P(cone(.07, .18, 4), '#e6e9ef', [0, 0, .45], [Math.PI / 2, 0, 0]), P(box(.14, .02, .14), '#fff', [0, 0, -.33])]), VM, 160);
arrowIM.frustumCulled = false; arrowIM.count = 0; scene.add(arrowIM);
const boltIM = new THREE.InstancedMesh(new THREE.SphereGeometry(.22, 10, 8), new THREE.MeshBasicMaterial({ color: '#d7b8ff' }), 60);
boltIM.frustumCulled = false; boltIM.count = 0; scene.add(boltIM);

// ================================================================ audio: synth music loops + sfx
let muted = S.get('mute', false), mOn = false, mStep = 0;
const T = (...a) => { if (!muted) tone(...a); };
const N = (...a) => { if (!muted) note(...a); };
const CH = [[48, 55, 60, 64, 67, 72], [45, 52, 57, 60, 64, 69], [41, 48, 53, 57, 60, 65], [43, 50, 55, 59, 62, 67]];
const ARP = [1, 3, 2, 4, 3, 5, 4, 2];
const MEL = [76, 0, 74, 72, 0, 74, 76, 79, 81, 0, 79, 76, 74, 0, 72, 0, 72, 0, 69, 72, 74, 0, 72, 69, 67, 0, 69, 72, 74, 0, 0, 0];
const NB = [33, 33, 0, 36, 33, 0, 31, 0, 33, 33, 0, 36, 38, 0, 36, 31];
setInterval(() => {
  if (!mOn || muted || document.hidden) return;
  const s = mStep++;
  if (phase === 'night' && state === 'play') {
    const i = s % 16;
    if (i % 4 === 0) tone(72, .22, 'sine', .26, .45);
    if (i === 10 || i === 14) tone(64, .16, 'sine', .14, .5);
    if (i % 2 === 1) tone(2400, .025, 'square', .015, .8);
    if (NB[i]) note(NB[i] + 12, .28, .085);
    if (s % 32 === 20) note(81, .9, .035);
    if (s % 64 === 52) note(80, .9, .035);
  } else {
    const bar = (s >> 3) % 4, i = s % 8, c = CH[bar];
    note(c[ARP[i]], .7, .045);
    if (i === 0) note(c[0] - 12, 1.4, .06);
    const m = MEL[s % 32]; if (m && (s >> 5) % 2 === 1) note(m, .5, .05);
  }
}, 160);

// ================================================================ run state
let state = 'ready', phase = 'day', speed = 1, best = S.get('best', 0);
let run = null, W = null;                 // run = saved progress, W = this run's world layout
let buildings = [], enemies = [], allies = [], shots = [], queue = [], nightT = 0, nightTotal = 0, nightKilled = 0, nightKills = 0;
let fk = 1, shake = 0, nightness = 0, hint = '', beatenShown = false, perkPending = false, lastHallHit = 0;
const survived = () => (run ? run.night - 1 : 0);
const has = p => run && run.perks.includes(p);

function newRun(seed) {
  run = { seed: seed || (Math.random() * 1e9) | 0, night: 1, gold: 30, builds: {}, perks: [], ms: 0, daily: !!D.seed };
  setupWorld();
}
function saveRun() { if (run) S.set('run', run); }

function setupWorld() {
  const r = rng(run.seed), base = r() * Math.PI * 2;
  const angles = [0, 1, 2, 3].map(i => base + i * Math.PI / 2 + (r() - .5) * .5);
  const plots = [];
  angles.forEach((a, i) => {
    plots.push({ a, r: 8.3, kind: 'wall', road: i });
    plots.push({ a: a + .44, r: 6.0, kind: 'any', road: i }, { a: a - .44, r: 6.0, kind: 'any', road: i });
    plots.push({ a: a + (i % 2 ? .3 : -.3) + (r() - .5) * .08, r: 11.2, kind: 'any', road: i });
    plots.push({ a: a + Math.PI / 4 + (r() - .5) * .2, r: 3.9 + r() * .4, kind: 'any', road: i });
  });
  plots.forEach((p, i) => { p.i = i; p.x = Math.cos(p.a) * p.r; p.z = Math.sin(p.a) * p.r; });
  W = { angles, plots };
  roads.forEach((m, i) => { const a = angles[i]; m.position.set(Math.cos(a) * 11.6, .015, Math.sin(a) * 11.6); m.rotation.y = Math.PI / 2 - a; });
  // scenery away from roads and plots
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const free = (x, z, pad) => { const a = Math.atan2(z, x), d = Math.hypot(x, z);
    for (const ra of angles) { let da = Math.abs(((a - ra) % 6.283 + 9.425) % 6.283 - 3.1416); if (da * d < 1.9 + pad) return false; }
    for (const p of plots) if (Math.hypot(p.x - x, p.z - z) < 1.8 + pad) return false; return d > 3.4 + pad; };
  const scatter = (im, n, rmin, rmax, smin, smax, pad) => { let k = 0;
    for (let t = 0; t < n * 12 && k < n; t++) { const a = r() * 6.283, d = rmin + r() * (rmax - rmin), x = Math.cos(a) * d, z = Math.sin(a) * d; if (!free(x, z, pad)) continue;
      const s = smin + r() * (smax - smin); m4.compose(new THREE.Vector3(x, 0, z), q.setFromAxisAngle(up, r() * 6.28), new THREE.Vector3(s, s * (.85 + r() * .3), s)); im.setMatrixAt(k++, m4); }
    im.count = k; im.instanceMatrix.needsUpdate = true; };
  scatter(trees, 70, 12.5, 20, .8, 1.35, .6); scatter(bushes, 40, 6, 19.5, .6, 1.0, .3); scatter(rocks, 26, 5, 20, .6, 1.3, .3); scatter(flowers, 60, 3.5, 19, .8, 1.4, 0);
  for (const b of buildings) scene.remove(b.mesh);
  buildings = [];
  for (const k in run.builds) { const { type, lvl } = run.builds[k]; placeBuilding(W.plots[+k], type, lvl); }
}
function placeBuilding(p, type, lvl) {
  const t = BT[type];
  let mult = type === 'wall' && has('stone') ? 1.5 : 1;
  const b = { p, type, lvl, x: p.x, z: p.z, r: t.r, max: t.hp[lvl - 1] * mult, hp: 0, alive: true, cd: Math.random(), hitT: 0, mesh: mk(model(type, lvl)) };
  b.hp = b.max;
  b.mesh.position.set(p.x, 0, p.z);
  b.mesh.rotation.y = type === 'wall' ? -p.a - Math.PI / 2 : Math.atan2(-p.x, -p.z);
  if (type === 'mage') { const c = new THREE.Mesh(new THREE.OctahedronGeometry(.32), new THREE.MeshBasicMaterial({ color: '#d9c2ff' })); c.position.y = 3.3 + .4 * (lvl - 1) + 1.2; b.mesh.add(c); b.crystal = c; }
  p.b = b; buildings.push(b); scene.add(b.mesh);
  return b;
}
function build(p, type) {
  const cur = p.b, lvl = cur ? cur.lvl + 1 : 1, t = BT[cur ? cur.type : type], cost = t.cost[lvl - 1];
  if (cost === undefined || run.gold < cost || phase !== 'day') return false;
  run.gold -= cost; bumpGold();
  if (cur) { scene.remove(cur.mesh); buildings.splice(buildings.indexOf(cur), 1); type = cur.type; }
  const b = placeBuilding(p, type, lvl);
  run.builds[p.i] = { type, lvl };
  b.mesh.scale.set(1, .01, 1); b.pop = 0;
  burst(scene, new THREE.Vector3(p.x, .5, p.z), ['#f2c14e', '#fff', '#d3cabb'], 14, { speed: .1, up: .12, size: .8 });
  T(520, .07, 'triangle', .14, 1.3); setTimeout(() => T(780, .1, 'triangle', .12, 1.2), 70); buzz(12);
  saveRun(); return true;
}

// ================================================================ phases
function enterDay() {
  phase = 'day'; state = 'play';
  hall.max = 300 + 25 * (run.night - 1); hall.hp = hall.max; hall.alive = true;
  for (const b of buildings) { b.max = BT[b.type].hp[b.lvl - 1] * (b.type === 'wall' && has('stone') ? 1.5 : 1); b.hp = b.max; if (!b.alive) { b.alive = true; b.mesh.visible = true; b.mesh.scale.set(1, .01, 1); b.pop = 0; } }
  enemies = []; allies = []; shots = []; queue = [];
  hero.max = 100 * (has('hero') ? 1.6 : 1); hero.hp = hero.max; hero.alive = true; heroG.visible = true; hero.resp = 0;
  const ar = nightRoads(run.night);
  beams.forEach((g, i) => { g.visible = ar.includes(i); const a = W.angles[i]; g.position.set(Math.cos(a) * 18.5, 0, Math.sin(a) * 18.5); });
  $('#nightBtn').hidden = false; $('#nightBtn small').textContent = `Night ${run.night} · raiders from ${ar.length} road${ar.length > 1 ? 's' : ''}`;
  $('#bossbar').hidden = true;
  ui.levels(run.night); ui.progress(0);
  hint = run.night === 1 ? 'Tap a glowing coin to build' : `Day ${run.night} · build, then start the night`;
  ui.sub(hint); setBg(false); saveRun();
}
function nightRoads(n) {
  const r = rng(run.seed * 13 + n * 7919), ids = [0, 1, 2, 3];
  for (let i = 3; i > 0; i--) { const j = (r() * (i + 1)) | 0; [ids[i], ids[j]] = [ids[j], ids[i]]; }
  return ids.slice(0, Math.min(4, 1 + Math.floor(n / 2)));
}
function startNight() {
  if (phase !== 'day' || state !== 'play') return;
  closeSheet();
  phase = 'night'; fk = FL.k(); nightT = 0; nightKilled = 0; nightKills = 0;
  const n = run.night, r = rng(run.seed * 31 + n * 104729), ar = nightRoads(n);
  const total = Math.round((5 + 3.6 * n) * fk), dur = 6 + n * 2.4, hpm = (1 + .17 * (n - 1)) * fk;
  queue = [];
  for (let i = 0; i < total; i++) {
    let k = 'grub'; const x = r();
    if (n >= 5 && x < .16) k = 'flyer'; else if (n >= 3 && x < .32) k = 'brute'; else if (n >= 2 && x < .52) k = 'runner';
    const per = ar.length * 3, packs = Math.ceil(total / per);
    queue.push({ k, road: ar[i % ar.length], t: (Math.floor(i / per) / Math.max(1, packs - 1)) * dur + r() * .9, hpm });
  }
  if (n % 5 === 0) for (let i = 0; i < Math.floor(n / 10) + 1; i++) queue.push({ k: 'boss', road: ar[i % ar.length], t: dur * .6 + i * 3, hpm });
  queue.sort((a, b) => a.t - b.t); nightTotal = queue.length;
  // spearmen march out
  allies = [];
  for (const b of buildings) if (b.type === 'barracks' && b.alive) {
    let ri = 0, bd = 1e9; W.angles.forEach((a, i) => { const d = Math.hypot(Math.cos(a) * 9.6 - b.x, Math.sin(a) * 9.6 - b.z); if (ar.includes(i) && d < bd) { bd = d; ri = i; } });
    const a = W.angles[ri], cnt = BT.barracks.units[b.lvl - 1] + (has('rally') ? 1 : 0);
    for (let j = 0; j < cnt; j++) { const t = (j - (cnt - 1) / 2) * .75, rx = Math.cos(a) * 9.8 - Math.sin(a) * t, rz = Math.sin(a) * 9.8 + Math.cos(a) * t;
      const mh = 45 * (has('rally') ? 1.6 : 1); allies.push({ x: b.x, z: b.z, rx, rz, hp: mh, max: mh, alive: true, cd: 0, face: 0, ph: Math.random() * 6 }); }
  }
  $('#nightBtn').hidden = true; beams.forEach(g => g.visible = false);
  ui.sub(''); ui.pop(n % 5 === 0 ? 'BOSS NIGHT!' : 'NIGHT ' + n, n % 5 === 0 ? '#ff9de2' : '#ffe08a', 44, 26);
  T(200, .5, 'sawtooth', .08, .5); setTimeout(() => T(150, .7, 'sawtooth', .08, .5), 200); buzz([30, 40, 30]);
  setBg(true);
}
function endNight() {
  phase = 'dawn';
  const n = run.night, houses = buildings.filter(b => b.type === 'house').reduce((a, b) => a + BT.house.inc[b.lvl - 1], 0);
  const inc = Math.round(5 + n + houses * (has('tax') ? 1.5 : 1));
  run.gold += inc; run.night++;
  const sv = survived(); if (sv > best) { best = sv; S.set('best', best); }
  FL.level(true); B.submit(sv, { ms: run.ms });
  if (!beatenShown && D.beaten(sv)) { beatenShown = true; ui.pop('BEATEN!', '#ffe08a', 44); confetti(scene, new THREE.Vector3(hall.x, 4, hall.z), 50); }
  perkPending = sv % 3 === 0;
  saveRun();
  D.won(sv, 'held my hold for');
  state = 'won'; ui.win(sv, `+${inc} gold at dawn · ${nightKills} raiders popped`);
  confetti(scene, new THREE.Vector3(0, 5, 0), 70); playWin(); buzz([20, 40, 60]);
}
function playWin() { [67, 72, 76, 79, 84].forEach((m, i) => setTimeout(() => N(m, .5, .12), i * 110)); }
function loseRun() {
  if (state !== 'play') return;
  state = 'lost'; phase = 'dawn';
  const sv = survived();
  FL.level(false, nightTotal ? nightKilled / nightTotal : 0);
  B.submit(sv, { ms: run.ms });
  S.set('run', null);
  ui.lose('HALL FALLEN', `You held ${sv} night${sv === 1 ? '' : 's'} · best ${best}`);
  T(160, .6, 'sawtooth', .12, .4); setTimeout(() => T(100, .9, 'sawtooth', .12, .4), 250); buzz([80, 60, 120]);
  burst(scene, new THREE.Vector3(0, 2, 0), ['#d4644a', '#f3e8d2', '#aba293'], 40, { speed: .2, up: .2, size: 1.4 });
  hallMesh.visible = false;
}
function setBg(night) {
  const s = document.body.style;
  s.setProperty('--bg1', night ? '#1b1f45' : '#f2b98f'); s.setProperty('--bg2', night ? '#3d3266' : '#9fc6dc'); s.setProperty('--ui', night ? '#8f7cff' : '#e58a4f');
}

// ================================================================ sheet (build menu, perk choice)
const sheet = $('#sheet'), shOpts = sheet.querySelector('.opts');
['pointerdown', 'pointerup', 'touchstart'].forEach(t => sheet.addEventListener(t, e => e.stopPropagation()));
sheet.addEventListener('pointerdown', e => { if (e.target === sheet && !perkPending) closeSheet(); });
sheet.querySelector('.sh-x').addEventListener('click', () => closeSheet());
let sheetPlot = null;
function closeSheet() { if (perkPending && sheet.dataset.perk) return; sheet.hidden = true; sheetPlot = null; sheet.dataset.perk = ''; }
function openPlot(p) {
  if (phase !== 'day' || state !== 'play') return;
  sheetPlot = p; sheet.dataset.perk = ''; sheet.hidden = false; sheet.querySelector('.sh-x').hidden = false;
  sheet.querySelector('.sh-h span').textContent = `🪙 ${run.gold}`;
  const opt = (ic, n, d, cost, ok, fn, wide) => { const b = document.createElement('button'); b.className = 'opt' + (wide ? ' wide' : ''); b.disabled = !ok;
    b.innerHTML = `<em>${ic}</em><div><b>${n}</b><br><small>${d}</small></div><span class="c">${cost}</span>`; if (!wide) b.innerHTML = `<em>${ic}</em><b>${n}</b><small>${d}</small><span class="c">${cost}</span>`;
    b.onclick = () => { if (fn()) closeSheet(); }; shOpts.appendChild(b); };
  shOpts.innerHTML = '';
  if (p.b) {
    const b = p.b, t = BT[b.type], nc = t.cost[b.lvl];
    sheet.querySelector('.sh-h b').textContent = `${t.n} · Lv ${b.lvl}`;
    const stat = b.type === 'wall' ? `HP ${t.hp[b.lvl - 1]} → ${t.hp[b.lvl] || '—'}` : b.type === 'house' ? `+${t.inc[b.lvl - 1]} → +${t.inc[b.lvl] || '—'} gold each dawn` : b.type === 'barracks' ? `${t.units[b.lvl - 1]} → ${t.units[b.lvl] || '—'} spearmen` : `Damage ${t.dmg[b.lvl - 1]} → ${t.dmg[b.lvl] || '—'}`;
    if (nc !== undefined) opt('⬆️', 'Upgrade', stat, '🪙 ' + nc, run.gold >= nc, () => build(p, b.type), true);
    else opt(t.ic, 'Fully upgraded', t.d, 'MAX', false, () => false, true);
  } else {
    sheet.querySelector('.sh-h b').textContent = p.kind === 'wall' ? 'Road plot' : 'Build plot';
    const types = p.kind === 'wall' ? ['wall'] : ['archer', 'house', 'barracks', 'mage', 'ballista'];
    for (const k of types) { const t = BT[k], lock = t.unlock && best < t.unlock && survived() < t.unlock;
      opt(t.ic, t.n, lock ? `Unlocks after night ${t.unlock}` : t.d, lock ? '🔒' : '🪙 ' + t.cost[0], !lock && run.gold >= t.cost[0], () => build(p, k), k === 'wall'); }
  }
  T(600, .04, 'sine', .08, 1.2);
}
function openPerks() {
  sheet.hidden = false; sheet.dataset.perk = '1'; sheet.querySelector('.sh-x').hidden = true;
  sheet.querySelector('.sh-h b').textContent = 'Choose a blessing'; sheet.querySelector('.sh-h span').textContent = `Night ${survived()} held!`;
  shOpts.innerHTML = '';
  const r = rng(run.seed * 7 + run.night), pool = PERKS.filter(p => !run.perks.includes(p[0]));
  for (let i = pool.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [pool[i], pool[j]] = [pool[j], pool[i]]; }
  for (const [id, ic, n, d] of pool.slice(0, 3)) { const b = document.createElement('button'); b.className = 'opt wide'; b.innerHTML = `<em>${ic}</em><div><b>${n}</b><br><small>${d}</small></div>`;
    b.onclick = () => pickPerk(id); shOpts.appendChild(b); }
  if (!pool.length) pickPerk(null);
}
function pickPerk(id) {
  if (id) run.perks.push(id);
  perkPending = false; sheet.dataset.perk = ''; sheet.hidden = true;
  if (id === 'stone') for (const b of buildings) if (b.type === 'wall') { b.max *= 1.5; b.hp = b.max; }
  if (id) { ui.pop(PERKS.find(p => p[0] === id)[2] + '!', '#ffe08a', 34, 30); playWin(); }
  enterDay();
}

// ================================================================ HUD + buttons
const goldPill = ui.els.pill; goldPill.style.top = 'calc(50px + env(safe-area-inset-top))'; goldPill.style.background = 'rgba(30,20,50,.35)';
function bumpGold() { ui.pill(`🪙 ${run.gold}`); goldPill.classList.remove('gold-bump'); void goldPill.offsetWidth; goldPill.classList.add('gold-bump'); }
const nb = $('#nightBtn'), spdB = $('#spd'), muteB = $('#mute');
for (const b of [nb, spdB, muteB]) b.addEventListener('pointerdown', e => e.stopPropagation());
nb.addEventListener('click', e => { e.stopPropagation(); startNight(); });
const setSpeed = v => { speed = v; spdB.textContent = speed + '×'; };
spdB.addEventListener('click', e => { e.stopPropagation(); setSpeed(speed % 3 + 1); T(700, .04, 'square', .05, 1); });
const paintMute = () => muteB.textContent = muted ? '🔇' : '🔊'; paintMute();
muteB.addEventListener('click', e => { e.stopPropagation(); muted = !muted; S.set('mute', muted); paintMute(); });

// ================================================================ input: drag = joystick, tap = ride there / open plot
const joy = $('#joy'), knob = joy.querySelector('i');
let ptr = null, joyV = { x: 0, z: 0 };
const keys = {};
addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; if ((e.key === 'Enter' || e.key === 'n') && phase === 'day') startNight(); });
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
addEventListener('pointerdown', e => { if (state !== 'play') return; ptr = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false }; });
addEventListener('pointermove', e => {
  if (!ptr) return; const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y;
  if (!ptr.moved && Math.hypot(dx, dy) > 12) { ptr.moved = true; joy.hidden = false; joy.style.left = ptr.x + 'px'; joy.style.top = ptr.y + 'px'; hero.mx = null; }
  if (ptr.moved) { const l = Math.hypot(dx, dy), k = Math.min(1, l / 52), nx = dx / (l || 1), ny = dy / (l || 1);
    joyV = { x: nx * k, z: ny * k }; knob.style.transform = `translate(${nx * k * 34}px,${ny * k * 34}px)`; }
});
const ray = new THREE.Raycaster(), groundPl = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), tmpV = new THREE.Vector3();
function groundAt(x, y) { ray.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1), camera); return ray.ray.intersectPlane(groundPl, tmpV) ? tmpV.clone() : null; }
addEventListener('pointerup', e => {
  if (!ptr) return; const p = ptr; ptr = null; joy.hidden = true; joyV = { x: 0, z: 0 };
  if (p.moved || state !== 'play') return;
  const g = groundAt(e.clientX, e.clientY); if (!g) return;
  if (phase === 'day') { let bp = null, bd = 1.7; for (const pl of W.plots) { const d = Math.hypot(pl.x - g.x, pl.z - g.z); if (d < bd) { bd = d; bp = pl; } } if (bp) return openPlot(bp); }
  hero.mx = g.x; hero.mz = g.z;
});
addEventListener('pointercancel', () => { ptr = null; joy.hidden = true; joyV = { x: 0, z: 0 }; });

// ================================================================ simulation
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function spawn(q) {
  const t = EK[q.k], a = W.angles[q.road], lat = (Math.random() - .5) * 1.6, R = 19.5;
  const hp = Math.round(t.hp * q.hpm);
  enemies.push({ k: q.k, t, x: Math.cos(a) * R - Math.sin(a) * lat, z: Math.sin(a) * R + Math.cos(a) * lat, y: t.fly ? 2.6 : 0, hp, max: hp, alive: true, cd: 0, hitT: 0, face: a + Math.PI, ph: Math.random() * 6, atk: 0 });
  if (t.boss) { $('#bossbar').hidden = false; ui.pop('GRUMBLORD!', '#ff9de2', 40, 26); T(90, .8, 'sawtooth', .14, .6); shake = .6; }
}
function hurt(e, dmg) {
  if (!e.alive) return; e.hp -= dmg; e.hitT = .12;
  if (e.hp <= 0) {
    e.alive = false; nightKilled++; nightKills++; run.gold += e.t.bounty; bumpGold();
    const p = new THREE.Vector3(e.x, e.y + .5, e.z);
    burst(scene, p, ['#ffd166', '#c9a0ff', '#ffffff', e.t.boss ? '#ff9de2' : '#a68ae8'], e.t.boss ? 40 : 9, { speed: .12, up: .1, size: e.t.boss ? 1.4 : .7, shape: 'sphere', life: .8 });
    T(e.t.boss ? 300 : 700 + Math.random() * 300, .09, 'triangle', .09, 1.6);
    if (e.t.boss) { $('#bossbar').hidden = true; confetti(scene, p, 60); shake = .7; buzz([40, 30, 60]); }
  }
}
function damageStruct(s, dmg) {
  if (!s.alive) return; s.hp -= dmg; s.hitT = .15;
  if (s.hall) { if (performance.now() - lastHallHit > 220) { lastHallHit = performance.now(); shake = Math.min(.5, shake + .18); T(140, .08, 'square', .06, .6); buzz(15); } if (s.hp <= 0) { s.hp = 0; loseRun(); } return; }
  if (s.hp <= 0) { s.alive = false; s.mesh.visible = false; burst(scene, new THREE.Vector3(s.x, 1, s.z), ['#aba293', '#a06e48', '#f3e8d2'], 22, { speed: .14, up: .15, size: 1.1 }); T(110, .25, 'square', .1, .5); shake = Math.min(.6, shake + .3); }
}
function structs(fly) { const out = []; for (const b of buildings) if (b.alive && !(fly && b.type === 'wall')) out.push(b); if (hall.alive) out.push(hall); return out; }

function stepNight(s) {
  nightT += s;
  while (queue.length && queue[0].t <= nightT) spawn(queue.shift());
  const ground = structs(false), air = structs(true);
  // raiders
  for (const e of enemies) {
    if (!e.alive) continue; const t = e.t; e.cd -= s; e.hitT -= s; e.ph += s * (t.fly ? 10 : 7);
    let tgt = null;
    if (!t.fly) {
      if (hero.alive && dist(e, hero) < t.rad + .75) tgt = hero;
      else for (const a of allies) if (a.alive && dist(e, a) < t.rad + .6) { tgt = a; break; }
    }
    const list = t.fly ? air : ground;
    if (!tgt) for (const st of list) if (dist(e, st) < st.r + t.rad + .1) { tgt = st; break; }
    if (tgt) {
      e.atk = Math.max(0, e.atk - s); e.face = Math.atan2(tgt.x - e.x, tgt.z - e.z);
      if (e.cd <= 0) { e.cd = .8; e.atk = .25; const d = t.dps * .8;
        if (tgt === hero) { hero.hp -= d; heroHitT = .15; T(260, .05, 'square', .05, .6); if (hero.hp <= 0) heroDown(); }
        else if (tgt.rx !== undefined) { tgt.hp -= d; if (tgt.hp <= 0) { tgt.alive = false; burst(scene, new THREE.Vector3(tgt.x, .6, tgt.z), ['#3f6fd1', '#f2c14e', '#fff'], 8, { size: .6 }); } }
        else damageStruct(tgt, d); }
      continue;
    }
    // move: fliers seek the nearest building, walkers follow the road to the Hall (or turn on a building next to them)
    let gx = 0, gz = 0;
    if (t.fly) { let bd = 1e9; for (const st of air) { const d = dist(e, st); if (d < bd) { bd = d; gx = st.x; gz = st.z; } } }
    else { for (const st of ground) if (!st.hall && st.type !== 'wall' && dist(e, st) < st.r + 1.7) { gx = st.x; gz = st.z; break; } }
    let dx = gx - e.x, dz = gz - e.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    if (!t.fly) for (const o of enemies) { if (o === e || !o.alive || o.t.fly) continue; const ox = e.x - o.x, oz = e.z - o.z, d = Math.hypot(ox, oz), m = t.rad + o.t.rad * .8; if (d < m && d > .001) { dx += ox / d * (m - d) * 2; dz += oz / d * (m - d) * 2; } }
    const sp = t.spd * s; e.x += dx * sp; e.z += dz * sp;
    e.face = Math.atan2(dx, dz);
  }
  enemies = enemies.filter(e => e.alive);
  // spearmen
  for (const a of allies) {
    if (!a.alive) continue; a.cd -= s; a.ph += s * 8;
    let tg = null, bd = 4.2; for (const e of enemies) { if (e.t.fly) continue; const d = Math.hypot(e.x - a.rx, e.z - a.rz); const d2 = dist(e, a); if (d < bd) { bd = d; tg = e; } if (d2 < .9 + e.t.rad) { tg = e; break; } }
    const gx = tg ? tg.x : a.rx, gz = tg ? tg.z : a.rz, d = Math.hypot(gx - a.x, gz - a.z);
    if (tg && d < tg.t.rad + .75) { a.face = Math.atan2(gx - a.x, gz - a.z); if (a.cd <= 0) { a.cd = .75; hurt(tg, 7); a.poke = .2; } }
    else if (d > .1) { const sp = Math.min(d, 3.2 * s); a.x += (gx - a.x) / d * sp; a.z += (gz - a.z) / d * sp; a.face = Math.atan2(gx - a.x, gz - a.z); }
  }
  allies = allies.filter(a => a.alive);
  // towers
  for (const b of buildings) {
    if (!b.alive) continue; const t = BT[b.type]; if (!t.range) continue;
    b.cd -= s * (has('arrows') && b.type === 'archer' ? 1.25 : 1); if (b.cd > 0) continue;
    const R = t.range[b.lvl - 1]; let tg = null, bd = R;
    for (const e of enemies) { const d = dist(e, b); if (d < bd) { bd = d; tg = e; } }
    if (!tg) { b.cd = .1; continue; }
    b.cd = 1 / t.rate[b.lvl - 1];
    const hy = b.type === 'archer' ? 2.6 + .45 * (b.lvl - 1) : b.type === 'mage' ? 3.6 + .4 * b.lvl : 1.2;
    shots.push({ k: b.type, x: b.x, y: hy, z: b.z, tg, tx: tg.x, ty: tg.y + .5, tz: tg.z, spd: b.type === 'mage' ? 11 : 20, dmg: t.dmg[b.lvl - 1], splash: t.splash || 0 });
    if (b.type === 'archer') T(1200, .04, 'triangle', .04, .6); else if (b.type === 'mage') T(900, .12, 'sine', .06, .5); else T(220, .12, 'square', .07, .5);
  }
  stepShots(s);
  if (!queue.length && !enemies.length && state === 'play') endNight();
  ui.progress(nightTotal ? nightKilled / nightTotal : 0);
  const boss = enemies.find(e => e.t.boss); if (boss) $('#bossbar i').style.width = (boss.hp / boss.max * 100) + '%';
}
function stepShots(s) {
  for (const p of shots) {
    if (p.tg && p.tg.alive) { p.tx = p.tg.x; p.ty = p.tg.y + .5; p.tz = p.tg.z; }
    const dx = p.tx - p.x, dy = p.ty - p.y, dz = p.tz - p.z, d = Math.hypot(dx, dy, dz), st = p.spd * s;
    p.dx = dx / (d || 1); p.dy = dy / (d || 1); p.dz = dz / (d || 1);
    if (d <= st + .05) {
      p.dead = true;
      if (p.splash) { for (const e of enemies) if (Math.hypot(e.x - p.tx, e.z - p.tz) < p.splash) hurt(e, p.dmg); burst(scene, new THREE.Vector3(p.tx, p.ty, p.tz), ['#d7b8ff', '#fff'], 8, { speed: .1, size: .6, shape: 'sphere', life: .6 }); }
      else if (p.tg && p.tg.alive) hurt(p.tg, p.dmg);
    } else { p.x += p.dx * st; p.y += p.dy * st; p.z += p.dz * st; }
  }
  shots = shots.filter(p => !p.dead);
}
let heroHitT = 0;
function heroDown() {
  hero.alive = false; hero.hp = 0; heroG.visible = false; hero.resp = has('hero') ? 3 : 5;
  burst(scene, new THREE.Vector3(hero.x, 1, hero.z), ['#3f6fd1', '#f4ecdc', '#ffe08a'], 16, { size: .8 }); T(200, .4, 'triangle', .1, .4); buzz(60);
}
function stepHero(s, rs) {
  if (!hero.alive) { hero.resp -= s; $('#resp').hidden = false; $('#resp').textContent = `Back in ${Math.ceil(hero.resp)}…`;
    if (hero.resp <= 0) { hero.alive = true; hero.hp = hero.max; hero.x = 0; hero.z = 3.2; heroG.visible = true; $('#resp').hidden = true; } return; }
  $('#resp').hidden = true;
  let ix = joyV.x + ((keys.d || keys.arrowright) ? 1 : 0) - ((keys.a || keys.arrowleft) ? 1 : 0), iz = joyV.z + ((keys.s || keys.arrowdown) ? 1 : 0) - ((keys.w || keys.arrowup) ? 1 : 0);
  if (Math.hypot(ix, iz) > .1) hero.mx = null;
  else if (hero.mx !== null) { const dx = hero.mx - hero.x, dz = hero.mz - hero.z, d = Math.hypot(dx, dz); if (d < .3) hero.mx = null; else { ix = dx / d; iz = dz / d; } }
  const il = Math.hypot(ix, iz); if (il > 1) { ix /= il; iz /= il; }
  const sp = 6.2 * (has('mount') ? 1.25 : 1);
  hero.vx = lerp(hero.vx, ix * sp, Math.min(1, rs * 12)); hero.vz = lerp(hero.vz, iz * sp, Math.min(1, rs * 12));
  hero.x += hero.vx * s; hero.z += hero.vz * s;
  for (const st of structs(false)) { const d = dist(hero, st), m = st.r + .55; if (d < m && d > .001) { hero.x = st.x + (hero.x - st.x) / d * m; hero.z = st.z + (hero.z - st.z) / d * m; } }
  const hd = Math.hypot(hero.x, hero.z); if (hd > 18.8) { hero.x *= 18.8 / hd; hero.z *= 18.8 / hd; }
  if (Math.hypot(hero.vx, hero.vz) > .4) hero.face = Math.atan2(hero.vx, hero.vz);
  if (phase !== 'night') { hero.hp = hero.max; return; }
  // auto attack
  hero.cd -= s; hero.bcd -= s;
  const near = enemies.filter(e => Math.hypot(e.x - hero.x, e.z - hero.z) < 2.1 + e.t.rad * .5);
  if (hero.cd <= 0 && near.length) {
    hero.cd = .55; hero.swing = .28; const dmg = 13 * (has('blade') ? 1.5 : 1);
    near.sort((a, b) => dist(a, hero) - dist(b, hero)).slice(0, 4).forEach(e => { hurt(e, dmg); if (!e.t.boss) { const d = dist(e, hero) || 1; e.x += (e.x - hero.x) / d * .35; e.z += (e.z - hero.z) / d * .35; } });
    hero.face = Math.atan2(near[0].x - hero.x, near[0].z - hero.z);
    swoosh.position.set(hero.x, .9, hero.z); swoosh.rotation.z = -hero.face - Math.PI * .1 + Math.PI / 2; swoosh.material.opacity = .7;
    T(330 + Math.random() * 60, .07, 'sawtooth', .06, 1.8); buzz(8);
  }
  if (has('bolt') && hero.bcd <= 0) { let tg = null, bd = 6.5; for (const e of enemies) { const d = dist(e, hero); if (d < bd) { bd = d; tg = e; } }
    if (tg) { hero.bcd = 1; shots.push({ k: 'bolt', x: hero.x, y: 2, z: hero.z, tg, tx: tg.x, ty: 1, tz: tg.z, spd: 14, dmg: 11, splash: 0 }); T(1100, .08, 'sine', .05, .6); } }
  if (!enemies.some(e => dist(e, hero) < 4)) hero.hp = Math.min(hero.max, hero.hp + 7 * s);
}

// ================================================================ render sync
const dum = new THREE.Object3D(), Z = new THREE.Vector3(0, 0, 1), qv = new THREE.Quaternion(), dv = new THREE.Vector3();
function syncRender(time, rdt) {
  const cnt = {}; for (const k in EK) cnt[k] = 0;
  for (const e of enemies) {
    const t = e.t, im = t.im, i = cnt[e.k]++; if (i >= t.cap) continue; const SC = t.boss ? 1 : 1.3;
    const bob = Math.abs(Math.sin(e.ph)), sq = e.hitT > 0 ? 1.25 : 1, at = e.atk > 0 ? Math.sin(e.atk / .25 * Math.PI) * .25 : 0;
    dum.position.set(e.x + Math.sin(e.face) * at, t.fly ? e.y + Math.sin(e.ph * .5) * .25 : bob * .12, e.z + Math.cos(e.face) * at);
    dum.rotation.set(0, e.face, 0);
    dum.scale.set(SC * sq * (1 + bob * .06), SC * sq * (1 - bob * .08), SC * sq * (1 + bob * .06));
    dum.updateMatrix(); im.setMatrixAt(i, dum.matrix);
  }
  for (const k in EK) { EK[k].im.count = Math.min(cnt[k], EK[k].cap); EK[k].im.instanceMatrix.needsUpdate = true; }
  let ai = 0;
  for (const a of allies) { const bob = Math.abs(Math.sin(a.ph)) * .08; a.poke = Math.max(0, (a.poke || 0) - rdt);
    dum.position.set(a.x + Math.sin(a.face) * a.poke, bob, a.z + Math.cos(a.face) * a.poke); dum.rotation.set(0, a.face, 0); dum.scale.setScalar(1); dum.updateMatrix(); allyIM.setMatrixAt(ai++, dum.matrix); }
  allyIM.count = ai; allyIM.instanceMatrix.needsUpdate = true;
  let ri = 0, bi = 0;
  for (const p of shots) {
    if (p.k === 'mage' || p.k === 'bolt') { dum.position.set(p.x, p.y, p.z); dum.rotation.set(0, 0, 0); dum.scale.setScalar(p.k === 'bolt' ? .8 : 1 + Math.sin(time * 30) * .15); dum.updateMatrix(); boltIM.setMatrixAt(bi++, dum.matrix); }
    else { dum.position.set(p.x, p.y, p.z); dv.set(p.dx || 0, p.dy || 0, p.dz || 1).normalize(); dum.quaternion.copy(qv.setFromUnitVectors(Z, dv)); dum.scale.setScalar(p.k === 'ballista' ? 2.2 : 1); dum.updateMatrix(); if (ri < 160) arrowIM.setMatrixAt(ri++, dum.matrix); }
  }
  arrowIM.count = ri; boltIM.count = bi; arrowIM.instanceMatrix.needsUpdate = boltIM.instanceMatrix.needsUpdate = true;
  dum.quaternion.identity();
  // plots
  let pi = 0; const show = phase === 'day' && state === 'play' || state === 'ready';
  if (W) for (const p of W.plots) { if (p.b || !show) continue;
    const pulse = 1 + Math.sin(time * 3 + p.i) * .06;
    dum.position.set(p.x, .03, p.z); dum.rotation.set(0, 0, 0); dum.scale.set(pulse, 1, pulse); dum.updateMatrix(); plotRing.setMatrixAt(pi, dum.matrix);
    plotRing.setColorAt(pi, p.kind === 'wall' ? CW : CG);
    dum.position.set(p.x, .75 + Math.sin(time * 2.5 + p.i) * .12, p.z); dum.rotation.set(Math.PI / 2, 0, time * 2 + p.i); dum.scale.setScalar(1); dum.updateMatrix(); plotCoin.setMatrixAt(pi, dum.matrix); pi++; }
  plotRing.count = plotCoin.count = pi; plotRing.instanceMatrix.needsUpdate = plotCoin.instanceMatrix.needsUpdate = true; if (plotRing.instanceColor) plotRing.instanceColor.needsUpdate = true;
  // buildings: grow-in pop + hit wobble
  for (const b of buildings) {
    if (b.pop !== undefined && b.pop < 1) { b.pop = Math.min(1, b.pop + rdt * 3.5); const k = b.pop, e = 1 + Math.sin(k * Math.PI) * .25; b.mesh.scale.set(1 / Math.sqrt(e) + (1 - k) * .2, Math.max(.01, k * e), 1 / Math.sqrt(e) + (1 - k) * .2); if (k >= 1) b.mesh.scale.set(1, 1, 1); }
    if (b.hitT > 0) { b.hitT -= rdt; b.mesh.position.x = b.x + (Math.random() - .5) * .12; } else b.mesh.position.x = b.x;
    if (b.crystal) { b.crystal.rotation.y = time * 2; b.crystal.position.y = 3.3 + .4 * (b.lvl - 1) + 1.2 + Math.sin(time * 2.5) * .12; }
  }
  if (hall.hitT > 0) { hall.hitT -= rdt; hallMesh.scale.set(1.03, .97, 1.03); } else hallMesh.scale.set(1, 1, 1);
  // hero
  const mv = Math.hypot(hero.vx, hero.vz);
  heroG.position.set(hero.x, Math.abs(Math.sin(time * 11)) * Math.min(1, mv / 4) * .22, hero.z);
  heroG.rotation.y = lerpAngle(heroG.rotation.y, hero.face, Math.min(1, rdt * 14));
  heroBody.rotation.x = Math.min(1, mv / 6) * .12;
  hero.swing = Math.max(0, hero.swing - rdt);
  sword.rotation.set(hero.swing > 0 ? -1.6 + (1 - hero.swing / .28) * 3 : -.3, 0, hero.swing > 0 ? -.6 : -.2);
  lantern.rotation.z = Math.sin(time * 5) * .15;
  swoosh.material.opacity = Math.max(0, swoosh.material.opacity - rdt * 4); swoosh.position.x = hero.x; swoosh.position.z = hero.z;
  if (heroHitT > 0) { heroHitT -= rdt; heroG.scale.setScalar(1.1); } else heroG.scale.setScalar(1);
  // beams pulse
  beamMat.opacity = .22 + Math.sin(time * 4) * .1;
}
const CW = new THREE.Color('#dfe6ff'), CG = new THREE.Color('#ffe9a6');
const lerpAngle = (a, b, t) => { let d = ((b - a) % 6.2832 + 9.4248) % 6.2832 - 3.1416; return a + d * t; };

// ================================================================ HUD sync
const hb = $('#hallbar i'), hhp = $('#herohp'), hhpi = hhp.querySelector('i');
function syncHUD() {
  hb.style.width = (hall.hp / hall.max * 100) + '%';
  if (run) ui.pill(`🪙 ${run.gold}`);
  const show = state === 'play' && hero.alive && (phase === 'night' && hero.hp < hero.max);
  hhp.hidden = !show;
  if (show) { tmpV.set(hero.x, 2.9, hero.z).project(camera); hhp.style.left = ((tmpV.x + 1) / 2 * innerWidth) + 'px'; hhp.style.top = ((1 - tmpV.y) / 2 * innerHeight) + 'px'; hhpi.style.width = (hero.hp / hero.max * 100) + '%'; }
  if (state !== 'play') $('#resp').hidden = true;
}

// ================================================================ lighting + camera
const DAY = { hs: new THREE.Color('#fff1dc'), hg: new THREE.Color('#b8a58e'), hi: 1.25, sc: new THREE.Color('#ffd9a8'), si: 1.75, wc: new THREE.Color('#7fb8d2') };
const NIGHT = { hs: new THREE.Color('#8a92d8'), hg: new THREE.Color('#2d2a50'), hi: .8, sc: new THREE.Color('#a9bcff'), si: .75, wc: new THREE.Color('#2e3a6e') };
const camT = new THREE.Vector3(0, 0, 2);
function stepLook(rdt, time) {
  const tn = phase === 'night' && state === 'play' || (state === 'lost') ? 1 : 0;
  nightness = lerp(nightness, tn, Math.min(1, rdt * 1.4));
  hemi.color.copy(DAY.hs).lerp(NIGHT.hs, nightness); hemi.groundColor.copy(DAY.hg).lerp(NIGHT.hg, nightness); hemi.intensity = lerp(DAY.hi, NIGHT.hi, nightness);
  sun.color.copy(DAY.sc).lerp(NIGHT.sc, nightness); sun.intensity = lerp(DAY.si, NIGHT.si, nightness);
  water.material.color.copy(DAY.wc).lerp(NIGHT.wc, nightness);
  lampLight.intensity = 2 + nightness * 14; hallGlow.intensity = nightness * 12 + 1; lampCore.material.color.setHSL(.12, 1, .6 + Math.sin(time * 9) * .05);
  ffMat.opacity = nightness * .9;
  for (let i = 0; i < ffN; i++) { const s = ffSeed[i]; ffPos[i * 3] = s[0] + Math.sin(time * .7 + s[2]) * .8; ffPos[i * 3 + 1] = .8 + Math.sin(time * 1.3 + s[2] * 2) * .5; ffPos[i * 3 + 2] = s[1] + Math.cos(time * .6 + s[2]) * .8; }
  ffGeo.attributes.position.needsUpdate = true;
  const tx = state === 'ready' ? 0 : hero.x * .6, tz = state === "ready" ? 1 : hero.z * .6 + .8;
  camT.x = lerp(camT.x, tx, Math.min(1, rdt * 3)); camT.z = lerp(camT.z, tz, Math.min(1, rdt * 3));
  const asp = innerWidth / innerHeight, zoom = (1 + nightness * .12) * (asp > 1 ? .78 : 1) * (state === 'ready' ? 1.08 : 1);
  shake = Math.max(0, shake - rdt * 1.6);
  camera.position.set(camT.x + (Math.random() - .5) * shake, 21 * zoom, camT.z + 15 * zoom + (Math.random() - .5) * shake);
  camera.lookAt(camT.x, 0, camT.z);
  stage.followLight(new THREE.Vector3(camT.x, 0, camT.z - 2));
}

// ================================================================ loop
let lastT = 0;
loop((dt, time) => {
  const rdt = Math.min(.05, dt / 60);
  if (state === 'play') {
    run.ms += rdt * 1000;
    const steps = speed, s = rdt;
    for (let i = 0; i < steps; i++) { stepHero(s, rdt); if (phase === 'night' && state === 'play') stepNight(s); }
  }
  syncRender(time, rdt); syncHUD(); stepLook(rdt, time);
});

// ================================================================ cards
function refreshStart() {
  const saved = S.get('run', null);
  if (saved && saved.night > 1) { startInfo.textContent = `Continue · Day ${saved.night} · 🪙 ${saved.gold}`; newBtn.hidden = false; }
  else { startInfo.textContent = best ? `Best: ${best} night${best === 1 ? '' : 's'}` : ''; newBtn.hidden = true; }
}
newBtn.addEventListener('click', e => { e.stopPropagation(); S.set('run', null); newRun(D.seed); refreshStart(); T(500, .05, 'sine', .1, 1.2); });
function boot() {
  const saved = S.get('run', null);
  if (saved && (!D.seed || saved.seed === D.seed)) { run = Object.assign({ perks: [], builds: {}, ms: 0 }, saved); setupWorld(); }
  else newRun(D.seed);
  phase = 'day'; ui.levels(run.night); refreshStart();
  const ar = nightRoads(run.night); beams.forEach((g, i) => { g.visible = ar.includes(i); const a = W.angles[i]; g.position.set(Math.cos(a) * 18.5, 0, Math.sin(a) * 18.5); });
}
boot();
ui.onTap(w => {
  mOn = true;
  if (w === 'start') { B.start(); enterDay(); }
  else if (w === 'win') { if (perkPending) { state = 'play'; phase = 'day'; openPerks(); } else enterDay(); }
  else if (w === 'lose') { hallMesh.visible = true; newRun(D.seed); beatenShown = false; hero.x = 0; hero.z = 3.2; B.start(); enterDay(); }
});

// ================================================================ test hooks + bot
function botDay() {
  if (perkPending && sheet.dataset.perk) { const b = shOpts.querySelector('.opt'); if (b) b.click(); return; }
  if (!sheet.hidden) closeSheet();
  if (speed < 3) setSpeed(3);
  const ar = nightRoads(run.night), act = W.plots.filter(p => ar.includes(p.road));
  const tryB = (p, k) => p && build(p, k);
  const free = (arr) => arr.find(p => !p.b);
  // 1 walls on tonight's roads, 2 an archer per active road, 3 a farm, 4 barracks, 5 upgrades, 6 spires/ballistas, 7 more archers
  for (const p of act) if (p.kind === 'wall' && !p.b && tryB(p, 'wall')) return;
  for (const r of ar) { const ps = act.filter(p => p.road === r && p.kind === 'any' && p.r < 7); if (!ps.some(p => p.b && p.b.type === 'archer') && tryB(free(ps), 'archer')) return; }
  const inner = W.plots.filter(p => p.r < 5);
  if (buildings.filter(b => b.type === 'house').length < Math.min(3, run.night) && tryB(free(inner), 'house')) return;
  if (run.night >= 2 && !buildings.some(b => b.type === 'barracks') && tryB(free(inner), 'barracks')) return;
  for (const b of buildings) if ((b.type === 'wall' || b.type === 'archer') && ar.includes(b.p.road) && b.lvl < 2 && build(b.p, b.type)) return;
  if (best >= 3 || survived() >= 3) { const ps = act.filter(p => p.kind === 'any' && !p.b); if (buildings.filter(b => b.type === 'mage').length < 2 && tryB(ps[0], 'mage')) return; }
  if (best >= 6 || survived() >= 6) { const ps = act.filter(p => p.kind === 'any' && !p.b && p.r > 10); if (tryB(ps[0], 'ballista')) return; }
  for (const b of buildings) if (b.lvl < 3 && b.type !== 'house' && build(b.p, b.type)) return;
  if (tryB(free(W.plots.filter(p => p.kind === 'any' && p.r < 7)), 'archer')) return;
  startNight();
}
function botNight() {
  if (speed < 3) setSpeed(3);
  let tg = null, bd = 1e9;
  for (const e of enemies) { if (e.t.fly) continue; const d = Math.hypot(e.x, e.z) * .6 + dist(e, hero) * .4; if (d < bd) { bd = d; tg = e; } }
  if (tg) { hero.mx = tg.x; hero.mz = tg.z; } else { hero.mx = 0; hero.mz = 3.2; }
}
window.__game = {
  get state() { return state; }, get level() { return run ? run.night : 1; }, get score() { return survived(); },
  bot() { if (state !== 'play') return; if (phase === 'day') botDay(); else if (phase === 'night') botNight(); },
};
