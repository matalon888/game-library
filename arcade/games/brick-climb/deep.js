// Brick Climb v2 ("deep") — same game as v1: grab bricks of your colour, lay them as stair steps, climb to the top before the rivals.
// v2 adds: 30 authored climbs in 3 worlds (levels.js), hazards (gold, bombs, sweeper bars, closed lanes, ice), rival personalities,
// pick-up streaks + FEVER, 3-star goals, a level map, brick colours from chests, a Daily Climb and a day streak.
import { THREE, createStage, createUI, input, loop, burst, confetti, sfx, tone, note, buzz, applyPalette, mat, glossy, rounded, stickman, store, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { demo } from './kit/demo.js';
import { GLTFLoader } from './kit/addons/loaders/GLTFLoader.js';
import { heroBar, selectedHero, loadHero, onHeroesChange } from './kit/heroes.js';
import { LEVELS, WORLDS, PAR, daily } from './levels.js';

import { board } from './kit/board.js';
const WB = board({ game: 'brick-climb', label: 'Levels cleared', limits: { maxRun: 1, maxPerSec: 0.2 }, mode: 'sum' });
const ST = store('brickclimb'), SV = store('bc2');
let best = ST.get('best', 0);
const F = flow('brickclimb'); let fk = 1;
const { scene, camera, followLight, renderer } = createStage({ fov: 48, shadowSize: 16 });
const ui = createUI({ title: 'BRICK<br>CLIMB', hint: 'Tap where to run · or drag', hand: '👆', score: false });
let QUIET = false;                                  // QA runs without sound, DOM or particles
const snd = (n, ...a) => { if (!QUIET) sfx[n](...a); }, nt = (...a) => { if (!QUIET) note(...a); }, bz = a => { if (!QUIET) buzz(a); };
const pop = (...a) => { if (!QUIET) ui.pop(...a); }, fl = a => { if (!QUIET) ui.flash(a); }, tn = (...a) => { if (!QUIET) tone(...a); };

// ---------------------------------------------------------------- constants
const FW = 13, FD = 13, BL = 10, RISE = 4.2, LW = 1.8, LANES = [-4.3, 0, 4.3];
const COLORS = ['#2f80ff', '#ff3d6e', '#22c55e', '#ffb000'];
const NAMES = ['YOU', 'RED', 'GREEN', 'GOLD'];
const SPEED = 6.4 / 60;
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const SKINS = [['Cobalt', '#2f80ff'], ['Sky', '#35c4ff'], ['Indigo', '#4f46e5'], ['Violet', '#8b5cf6'], ['Aqua', '#12b5c4'], ['Ink', '#2b2d42'], ['Snow', '#e6edf7'], ['Plum', '#8a3fa0'], ['Navy', '#1e3a8a'], ['Ice', '#9fd4ff'], ['Orchid', '#cf6bea'], ['Neon', '#6d28d9']];
const GOLD_C = '#ffd23f', BOMB_C = '#2b2d3a';

const BLOCK_G = rounded(0.74, 0.26, 0.4, 0.06);
const GOLDB_G = rounded(0.9, 0.34, 0.52, 0.08);
const BOMB_G = new THREE.SphereGeometry(0.42, 16, 12); BOMB_G.translate(0, 0.3, 0);
const STACK_G = rounded(0.66, 0.2, 0.38, 0.05);
const POST_G = new THREE.CylinderGeometry(0.2, 0.24, 1.1, 14); POST_G.translate(0, 0.55, 0);
const KNOB_G = new THREE.SphereGeometry(0.27, 16, 12);
const blockMats = [...COLORS.map(c => mat(c, { roughness: 0.35 })), new THREE.MeshStandardMaterial({ color: GOLD_C, roughness: 0.25, metalness: 0.5, emissive: '#c98a00', emissiveIntensity: 0.55 }), new THREE.MeshStandardMaterial({ color: BOMB_C, roughness: 0.4, emissive: '#ff2d2d', emissiveIntensity: 0.25 })];
const white = mat('#ffffff', { roughness: 0.6 });

// ---------------------------------------------------------------- save: stars per level, brick colours, streak, daily
const dayNo = () => { const d = new Date(); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); };
const DAY0 = Math.floor(Date.UTC(2026, 10, 1) / 864e5);
const starsOf = () => SV.get('stars', {});
const totalStars = () => Object.values(starsOf()).reduce((a, b) => a + b, 0);
const unlockedTo = () => { const s = starsOf(); let n = 1; while (s[n] && n <= 30) n++; return n; };
const owned = () => SV.get('skins', [0]);
function touchDay() { const t = dayNo(), last = SV.get('last', 0); if (last === t) return; SV.set('streak', last === t - 1 ? SV.get('streak', 0) + 1 : 1); SV.set('last', t); }
const streakDays = () => { const t = dayNo(), last = SV.get('last', 0); return last === t || last === t - 1 ? SV.get('streak', 0) : 0; };
function giveSkin(n = 1) { const have = owned(), left = SKINS.map((_, i) => i).filter(i => !have.includes(i)), got = []; for (let k = 0; k < n && left.length; k++) { const i = left.splice(Math.floor(Math.random() * left.length), 1)[0]; have.push(i); got.push(i); } SV.set('skins', have); return got; }
function setSkin(i) { const c = SKINS[i] ? SKINS[i][1] : SKINS[0][1]; COLORS[0] = c; blockMats[0].color.set(c); myRing.material.color.set(c); pillEl.querySelector('b').style.background = c; }

// ---------------------------------------------------------------- my hero (Hero Lab): replaces YOUR stickman's look; runner, stack, bumps, AI unchanged
const MY_SCALE = 1.12;
let my = null, myTok = 0, myClip = '', myShown = '';
const myRing = (() => { const g = new THREE.RingGeometry(0.42, 0.62, 40); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: COLORS[0], transparent: true, opacity: 0.9, depthWrite: false })); m.position.y = 0.04; m.renderOrder = 1; return m; })();
async function useHero() {
  const hc = selectedHero(), tok = ++myTok; myShown = JSON.stringify(hc);
  if (my) { my.dispose(); my = null; }
  attachHero();
  if (!hc) return;
  try {
    const n = await loadHero(THREE, GLTFLoader, { hero: { ...hc, items: { ...hc.items, back: null } }, height: 1.65, quality: 'game', clip: 'idle' });
    if (tok !== myTok) { n.dispose(); return; }
    my = n; myClip = ''; attachHero();
  } catch (e) { console.warn('hero', e); }
}
function attachHero() {
  if (!player) return;
  const g = player.g;
  for (const o of g.children) if (o !== player.stackMesh && o !== myRing && (!my || o !== my.object)) o.visible = !my;
  if (my) { g.add(my.object, myRing); } else { myRing.parent?.remove(myRing); }
}
function heroTick(s) {
  if (!my || !player) return;
  const ch = player, sp = Math.hypot(ch.vx, ch.vz) / SPEED;
  const want = state === 'won' ? 'cheer' : state === 'lost' ? 'fall' : ch.stun > 0 ? 'fall' : state === 'play' && sp > 0.08 ? 'run' : 'idle';
  if (want !== myClip) { my.play(want, { fade: want === 'fall' ? 0.1 : 0.22, once: want === 'cheer' ? false : undefined }); myClip = want; }
  if (my.actions.run) my.actions.run.timeScale = clamp(sp * 1.15, 0.6, 1.25);
  my.mixer.update(s);
  const sm = ch.stackMesh; sm.rotation.x = state === 'lost' ? lerp(sm.rotation.x, -1.35, Math.min(1, 6 * s)) : 0;
}

// ---------------------------------------------------------------- css + dom bits
const css = document.createElement('style'); css.textContent = `
.joy{position:fixed;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;background:rgba(255,255,255,.28);border:4px solid rgba(255,255,255,.7);z-index:7;pointer-events:none;display:none}
.joy i{position:absolute;left:50%;top:50%;width:52px;height:52px;margin:-26px 0 0 -26px;border-radius:50%;background:#fff;box-shadow:0 4px 0 rgba(0,0,0,.15)}
.stackpill{position:fixed;left:50%;transform:translateX(-50%);top:calc(92px + env(safe-area-inset-top));z-index:6;display:flex;align-items:center;gap:6px;background:rgba(0,0,0,.2);color:#fff;border-radius:16px;padding:2px 12px 2px 8px;font-weight:800;font-size:20px;pointer-events:none;font-family:"Baloo 2",system-ui}
.stackpill b{width:18px;height:12px;border-radius:3px;display:inline-block;box-shadow:0 2px 0 rgba(0,0,0,.2)}
.stackpill small{font-size:14px;opacity:.85}.stackpill.ok{background:rgba(34,160,80,.75)}.stackpill.bump{animation:bcb .18s}
@keyframes bcb{50%{transform:translateX(-50%) scale(1.18)}}
.bc-st{position:fixed;left:50%;transform:translateX(-50%);top:calc(126px + env(safe-area-inset-top));z-index:6;display:flex;align-items:center;gap:6px;font:800 16px "Baloo 2",system-ui;color:#fff;background:rgba(20,22,34,.6);border-radius:10px;padding:0 10px;opacity:0;transition:opacity .2s;pointer-events:none}
.bc-st.on{opacity:1}.bc-st .fb{width:64px;height:7px;border-radius:4px;background:rgba(255,255,255,.28);overflow:hidden}.bc-st .fb i{display:block;height:100%;width:0;background:#ffd23f}
.bc-st.fev{background:linear-gradient(90deg,#ff5d8f,#ffb703);animation:bcf .4s infinite alternate}@keyframes bcf{to{transform:translateX(-50%) scale(1.1)}}
.hc-sub.hc-sub{top:calc(56px + env(safe-area-inset-top));font-size:22px;font-weight:800;letter-spacing:1px;text-shadow:0 2px 0 rgba(0,0,0,.35),0 0 10px rgba(0,0,0,.25)}
.bc-ban{position:fixed;left:0;right:0;top:calc(250px + env(safe-area-inset-top));text-align:center;font-family:"Baloo 2",system-ui;color:#fff;z-index:6;pointer-events:none;animation:bcban 3.8s forwards;text-shadow:0 2px 0 rgba(0,40,80,.6),0 0 10px rgba(0,40,80,.5)}
.bc-ban b{display:block;font-size:30px;line-height:1;-webkit-text-stroke:1.5px #0d4f80;paint-order:stroke fill}.bc-ban span{display:block;font-size:15px;font-weight:700;margin-top:3px;padding:0 14px}.bc-ban em{display:inline-block;font-style:normal;font-size:14px;font-weight:800;margin-top:3px;background:rgba(20,22,34,.6);border-radius:10px;padding:0 10px}
@keyframes bcban{0%{opacity:0;transform:translateY(-14px)}8%{opacity:1;transform:none}80%{opacity:1}100%{opacity:0}}
.bc-ban.boss b{color:#ff8fa3}
.bc-ov{position:fixed;inset:0;z-index:20;display:flex;flex-direction:column;align-items:center;background:linear-gradient(180deg,#bfe9ff,#e8fff4 70%,#d6f5e6);color:#0b3b66;font-family:"Baloo 2",system-ui;overflow:hidden}
.bc-ov.card{background:rgba(10,40,70,.4);justify-content:center;padding:20px}
.bc-head{display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;padding:calc(14px + env(safe-area-inset-top)) 10px 6px 58px;width:100%;box-sizing:border-box}
.bc-chip{background:#fff;border-radius:18px;padding:3px 12px;font-weight:800;font-size:17px;box-shadow:0 3px 0 #b4dcf2;border:0;color:#0b3b66;font-family:inherit}
button.bc-chip{cursor:pointer}
.bc-scroll{flex:1;overflow-y:auto;width:100%;max-width:460px;padding:6px 14px calc(110px + env(safe-area-inset-bottom));-webkit-overflow-scrolling:touch}
.bc-w{margin:8px 0 4px;font-weight:800;font-size:21px;display:flex;justify-content:space-between;align-items:baseline}.bc-w small{font-size:14px;opacity:.7}
.bc-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px 8px;padding:6px 0 20px}
.bc-node{position:relative;aspect-ratio:1;border-radius:50%;border:0;background:#5ab0f0;color:#fff;font:800 20px "Baloo 2",system-ui;box-shadow:0 4px 0 #2a7ab8;cursor:pointer;display:flex;align-items:center;justify-content:center}
.bc-node.lock{background:#cfdde8;box-shadow:0 4px 0 #aebfcc;color:#8aa0b2;cursor:default}.bc-node.done{background:#4cc58a;box-shadow:0 4px 0 #2e9a63}
.bc-node.boss{background:#ff8fa3;box-shadow:0 4px 0 #e0607c}.bc-node.boss.lock{background:#cfdde8;box-shadow:0 4px 0 #aebfcc}.bc-node.hard{outline:3px solid #ff5d5d;outline-offset:-3px}
.bc-node.next{animation:bcp 1s ease-in-out infinite;background:#ffb347;box-shadow:0 4px 0 #e0902a,0 0 0 4px #fff,0 0 18px 4px #ffd27a}
.bc-node i{position:absolute;bottom:-17px;left:0;right:0;font-style:normal;font-size:11px;line-height:1}
@keyframes bcp{50%{transform:scale(1.12)}}
.bc-foot{position:fixed;bottom:0;left:0;right:0;display:flex;gap:10px;justify-content:center;padding:10px 12px calc(14px + env(safe-area-inset-bottom));background:linear-gradient(transparent,#d6f5e6 45%)}
.bc-btn{white-space:nowrap;font:800 19px "Baloo 2",system-ui;color:#fff;background:#3cc46a;border:0;border-radius:40px;padding:11px 26px;box-shadow:0 5px 0 #2a9a50;cursor:pointer}.bc-btn.alt{background:#4f8cff;box-shadow:0 5px 0 #2f62c4}
.bc-btn:active{transform:translateY(3px);box-shadow:0 2px 0 rgba(0,0,0,.2)}
.bc-box{background:#fffdf5;border-radius:28px;padding:20px 20px 16px;width:min(92vw,360px);text-align:center;box-shadow:0 10px 0 rgba(10,60,100,.25);animation:bcin .35s cubic-bezier(.3,1.5,.5,1)}
@keyframes bcin{from{transform:scale(.7);opacity:0}}
.bc-box h2{margin:0;font-size:38px;color:#e8552e;line-height:1}.bc-box p{margin:4px 0;font-weight:700;font-size:17px}.bc-box small{opacity:.7}
.bc-stars{font-size:46px;letter-spacing:4px;margin:6px 0 0;height:56px}.bc-stars span{display:inline-block;opacity:.25;filter:grayscale(1)}.bc-stars span.on{opacity:1;filter:none;animation:bcst .3s cubic-bezier(.3,1.8,.5,1)}
@keyframes bcst{from{transform:scale(0) rotate(-90deg)}}
.bc-why{display:flex;justify-content:center;gap:14px;font-size:12px;font-weight:800;opacity:.75;margin:0 0 4px}
.bc-row2{display:flex;gap:10px;justify-content:center;margin-top:12px}
.bc-sw{display:inline-block;width:58px;height:58px;border-radius:14px;border:4px solid #fff;box-shadow:0 3px 0 rgba(0,0,0,.2);margin:0 auto}
.bc-skins{display:grid;grid-template-columns:repeat(4,1fr);gap:12px 8px;padding:10px 0}.bc-sk{display:flex;flex-direction:column;align-items:center;font-weight:800;font-size:12px;border:0;background:none;color:#0b3b66;font-family:inherit}
.bc-sk.q .bc-sw{background:#cfdde8!important;display:flex;align-items:center;justify-content:center;font-size:22px;color:#8aa0b2}.bc-sk.eq .bc-sw{border-color:#3cc46a}
.hc-top{top:calc(14px + env(safe-area-inset-top))!important}`;
document.head.appendChild(css);
const el = (cls, html) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html || ''; document.body.appendChild(d); return d; };
const joyEl = el('joy', '<i></i>');
const pillEl = el('stackpill', `<b style="background:${COLORS[0]}"></b><span>0</span><small></small>`);
const stEl = el('bc-st', '<span>x0</span><div class="fb"><i></i></div>');
const pillN = pillEl.querySelector('span'), pillS = pillEl.querySelector('small');

// ---------------------------------------------------------------- level state
let def = LEVELS[0], mode = 'level', world, state = 'ready', score = 0, nF, S, stepD, stepH, blocks, steps, chars, player, builtMesh, ghostMesh, blockMeshes, finishCount, winT = 0, camT = new THREE.Vector3(), R;
let sweepers = [], gates = [], raceT = 0, shake = 0, hs = 0, streak = 0, streakT = 0, bestStreak = 0, fever = 0, smashed = 0, hurt = 0, goldGot = 0, lastRes = null, cardAt = 0;
const zc = k => -k * (FD + BL);
const zStart = k => zc(k) - FD / 2;
const isIce = k => def.ice.includes(k);
const gateLane = k => (def.block && def.block[k] !== undefined) ? def.block[k] : -1;

function buildLevel(d) {
  def = d; if (world) scene.remove(world);
  world = new THREE.Group(); scene.add(world);
  const W = WORLDS[d.world]; applyPalette({ bg: W.bg, ui: W.ui });
  ui.levels(d.n || '★'); ui.els.top.querySelector('[data-b]').textContent = d.n ? d.n + 1 : '🏁'; ui.progress(0);
  R = rng((d.n || d.seed) * 7919 + 3); fk = F.k();
  nF = d.nF; S = d.S; stepD = BL / S; stepH = RISE / S;
  finishCount = 0; winT = 0; raceT = 0; streak = 0; streakT = 0; bestStreak = 0; fever = 0; smashed = 0; hurt = 0; goldGot = 0; shake = 0; hs = 0; lastHunt = 0;
  sweepers = []; gates = [];

  const water = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: W.water, roughness: 0.25, metalness: 0.1 }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, -7, -40); water.receiveShadow = true; world.add(water);

  const floorMat = mat('#ffffff', { roughness: 0.7, map: tileTex(W.ground) });
  const iceMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.12, metalness: 0.25, map: tileTex('#cfeaff') });
  const sideMat = mat(W.side, { roughness: 0.8 });
  for (let k = 0; k <= nF; k++) {
    const last = k === nF, dd = last ? 8 : FD;
    const f = new THREE.Mesh(new THREE.BoxGeometry(FW, 0.5, dd), last ? glossy('#ffd23f', { metalness: 0.25 }) : (isIce(k) ? iceMat : floorMat));
    f.position.set(0, k * RISE - 0.25, last ? zStart(k - 1) - BL - dd / 2 : zc(k)); f.receiveShadow = true; world.add(f);
    const base = new THREE.Mesh(new THREE.BoxGeometry(FW - 0.6, 2.4, dd - 0.6), sideMat);
    base.position.set(0, k * RISE - 1.6, f.position.z); world.add(base);
    if (last) {
      const pod = new THREE.Group(); pod.position.set(0, k * RISE, f.position.z);
      [[0, 1.0, '#ffffff'], [-1.7, 0.65, '#e8f0ff'], [1.7, 0.4, '#fff1e8']].forEach(([x, h, c]) => {
        const b = new THREE.Mesh(rounded(1.6, h, 1.6, 0.12), mat(c)); b.position.set(x, h / 2, -1.2); b.castShadow = b.receiveShadow = true; pod.add(b);
      });
      for (const x of [-FW / 2 + 0.6, FW / 2 - 0.6]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.2, 8), white); pole.position.set(x, 1.6, 2.6); pod.add(pole);
        const flag = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.04), mat(COLORS[0])); flag.position.set(x + (x < 0 ? 0.55 : -0.55), 2.85, 2.6); pod.add(flag);
      }
      const arch = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.22, 10, 40, Math.PI), mat('#ffffff')); arch.position.set(0, 0, 3.6); pod.add(arch);
      world.add(pod);
    }
  }

  // bridges
  const nL = LANES.length, total = nF * nL * S;
  ghostMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(LW, 1, stepD * 0.98), new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, roughness: 0.6 }), total);
  builtMesh = new THREE.InstancedMesh(rounded(LW - 0.04, 1, stepD * 0.96, 0.05), mat('#ffffff', { roughness: 0.4 }), total);
  builtMesh.castShadow = true; builtMesh.receiveShadow = true;
  const posts = new THREE.InstancedMesh(POST_G, white, nF * nL * 4), knobs = new THREE.InstancedMesh(KNOB_G, white, nF * nL * 4);
  posts.castShadow = true; knobs.castShadow = true;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
  steps = []; let pi = 0;
  const slope = Math.atan2(RISE, BL), len = Math.hypot(RISE, BL);
  for (let k = 0; k < nF; k++) {
    steps[k] = [];
    for (let L = 0; L < nL; L++) {
      const x = LANES[L], z0 = zStart(k), y0 = k * RISE;
      steps[k][L] = new Array(S).fill(-1).map(() => ({ o: -1, pop: 0 }));
      for (let j = 0; j < S; j++) {
        const i = (k * nL + L) * S + j;
        m4.compose(v.set(x, y0 + (j + 0.5) * stepH, z0 - (j + 0.5) * stepD), q.identity(), sc.set(1, stepH, 1)); ghostMesh.setMatrixAt(i, m4);
        builtMesh.setColorAt(i, new THREE.Color('#ffffff'));
      }
      const slab = new THREE.Mesh(new THREE.BoxGeometry(LW + 0.5, 0.35, len), white);
      slab.position.set(x, y0 + RISE / 2 - 0.35, z0 - BL / 2); slab.rotation.x = slope; slab.castShadow = true; slab.receiveShadow = true; world.add(slab);
      for (const s of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.55, len), white);
        rail.position.set(x + s * (LW / 2 + 0.12), y0 + RISE / 2 + 0.3, z0 - BL / 2); rail.rotation.x = slope; rail.castShadow = true; world.add(rail);
        for (const [pz, py] of [[z0 + 0.1, y0], [z0 - BL - 0.1, y0 + RISE]]) {
          m4.compose(v.set(x + s * (LW / 2 + 0.12), py, pz), q.identity(), sc.set(1, 1, 1)); posts.setMatrixAt(pi, m4);
          m4.compose(v.set(x + s * (LW / 2 + 0.12), py + 1.2, pz), q.identity(), sc.set(1, 1, 1)); knobs.setMatrixAt(pi, m4); pi++;
        }
      }
    }
  }
  world.add(ghostMesh, builtMesh, posts, knobs);

  // closed lanes: a striped barrier across the bridge foot
  for (let k = 0; k < nF; k++) { const L = gateLane(k); if (L < 0) continue;
    const g = new THREE.Group(); g.position.set(LANES[L], k * RISE, zStart(k) + 0.1);
    const bar = new THREE.Mesh(rounded(LW + 0.5, 0.5, 0.4, 0.08), mat('#ff4d5a')); bar.position.y = 0.95; bar.castShadow = true;
    const bar2 = new THREE.Mesh(rounded(LW + 0.5, 0.32, 0.42, 0.06), mat('#ffffff')); bar2.position.y = 0.55;
    const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.1, 0.16), white), l2 = l1.clone(); l1.position.set(-LW / 2 - 0.1, 0.55, 0); l2.position.set(LW / 2 + 0.1, 0.55, 0);
    g.add(bar, bar2, l1, l2); world.add(g); gates.push({ k, L, g }); }

  // bricks on each floor
  blocks = [];
  const cols = d.bx || 6, rows = d.bx || 6;
  for (let k = 0; k < nF; k++) {
    const bag = []; for (let i = 0; i < cols * rows; i++) bag.push(i % 4);
    for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = -FW / 2 + 1.4 + c * ((FW - 2.8) / (cols - 1)) + (R() - 0.5) * 0.5;
      const z = zc(k) + FD / 2 - 2.6 - r * ((FD - 4.6) / (rows - 1)) + (R() - 0.5) * 0.5;
      blocks.push({ k, x, z, c: bag[r * cols + c], alive: false, active: false, respawn: 0, pop: 0, rot: R() < 0.5 ? 0 : Math.PI / 2 });
    }
    // neutral pickups: gold (+4) and bombs (half your stack), placed where they tempt
    const place = (c, n) => { for (let i = 0; i < n; i++) { let x = 0, z = 0; for (let t = 0; t < 14; t++) {
      x = (R() - 0.5) * (FW - 3.4); z = zc(k) + FD / 2 - 4 - R() * (FD - 7.5);
      if (!blocks.some(b => b.k === k && b.c >= 4 && Math.hypot(b.x - x, b.z - z) < 1.8)) break; }
      blocks.push({ k, x, z, c, alive: false, active: false, respawn: 0, pop: 0, rot: R() * 3 }); } };
    place(4, d.gold); place(5, d.bomb);
  }
  blockMeshes = blockMats.map((m, ci) => { const g = ci === 4 ? GOLDB_G : ci === 5 ? BOMB_G : BLOCK_G; const n = blocks.filter(b => b.c === ci).length; const mm = new THREE.InstancedMesh(g, m, Math.max(1, n)); mm.count = n; mm.castShadow = true; world.add(mm); return mm; });

  // sweeper bars: a pole with a spinning bar and a pale disc showing where it reaches
  for (const s of d.sweep) {
    const g = new THREE.Group(); g.position.set(s.x, s.f * RISE, zc(s.f) + s.z);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(s.r, 32), new THREE.MeshBasicMaterial({ color: '#ff4d6d', transparent: true, opacity: 0.14, depthWrite: false })); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.03; g.add(disc);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.9, 14), mat('#3b3f58')); pole.position.y = 0.45; pole.castShadow = true; g.add(pole);
    const arm = new THREE.Group(); arm.position.y = 0.55;
    const bar = new THREE.Mesh(rounded(s.r * 2, 0.34, 0.36, 0.1), mat('#ff4d6d')); bar.castShadow = true; arm.add(bar);
    for (const e of [-1, 1]) { const cap = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), mat('#ffffff')); cap.position.x = e * s.r; arm.add(cap); }
    g.add(arm); world.add(g); sweepers.push({ ...s, g, arm, ang: R() * 6, wx: s.x, wz: zc(s.f) + s.z });
  }

  // runners
  chars = [];
  const startX = [-1.6, -4.8, 1.6, 4.8];
  for (let ci = 0; ci < 4; ci++) {
    const big = d.bossCi === ci, g = stickman(COLORS[ci], COLORS[ci], big ? 1.5 : 1.12);
    g.head.material = g.body.material;
    const stackMesh = new THREE.InstancedMesh(STACK_G, blockMats[ci], 64); stackMesh.count = 0; stackMesh.castShadow = true; g.add(stackMesh);
    const off = ci > d.rv;
    const ch = { ci, g, stackMesh, stack: ci > 0 && !off ? d.pre : 0, x: startX[ci], z: zc(0) + FD / 2 - 1.1, y: 0, floor: 0, lane: -1, p: 0, vx: 0, vz: 0, face: Math.PI, lean: 0, stun: 0,
      blocked: false, mode: 'collect', want: 0, aLane: 0, done: false, pop: 0, speed: ci === 0 ? SPEED : SPEED * Math.min(1.03, d.rs * fk), think: 0, tgt: null, cool: 0, wc: 0, off, ai: ci > 0 ? d.ai[ci - 1] : 'player' };
    g.position.set(ch.x, 0, ch.z); g.rotation.y = Math.PI; g.visible = !off; world.add(g);
    chars.push(ch);
  }
  player = chars[0]; attachHero();
  for (const ch of chars) { activateFloor(0, ch.ci); pickWant(ch); }
  activateFloor(0, 4); activateFloor(0, 5);
  pillN.textContent = 0; pillS.textContent = ''; stEl.classList.remove('on', 'fev');
  camT.set(player.x, player.y, player.z); placeCamera(1);
}
let lastHunt = 0;

function tileTex(base) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const col = new THREE.Color(base), dark = col.clone().multiplyScalar(0.93);
  x.fillStyle = '#' + col.getHexString(); x.fillRect(0, 0, 128, 128);
  x.fillStyle = '#' + dark.getHexString(); x.fillRect(0, 0, 64, 64); x.fillRect(64, 64, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(FW / 4, FD / 4); t.anisotropy = 4;
  return t;
}
function activateFloor(k, ci) {
  for (const b of blocks) if (b.k === k && b.c === ci && !b.active) { b.active = true; b.alive = true; b.pop = 1 + Math.random() * 0.6; }
}

// ---------------------------------------------------------------- input: floating joystick
let joy = { x: 0, y: 0 }, botJoy = null, down = false, goal = null;
const fRay = new THREE.Raycaster(), fPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), fHit = new THREE.Vector3();
function floorAt(x, y) { fPlane.constant = -player.y; fRay.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1), camera); return fRay.ray.intersectPlane(fPlane, fHit) ? { x: fHit.x, z: fHit.z, t: performance.now() + 4000 } : null; }
input({
  onDown(e, st) { if (state !== 'play') return; down = true; botJoy = null; joyEl.style.display = 'block'; joyEl.style.left = st.x + 'px'; joyEl.style.top = st.y + 'px'; joy.x = joy.y = 0; },
  onMove(dx, dy, e, st) {
    if (!down) return; let jx = st.lx - st.x, jy = st.ly - st.y; const l = Math.hypot(jx, jy), m = 48;
    if (l > m) { jx *= m / l; jy *= m / l; }
    joy.x = jx / m; joy.y = jy / m; joyEl.firstChild.style.transform = `translate(${jx}px,${jy}px)`;
  },
  onUp(e, st) { if (down && st && Math.hypot(e.clientX - st.x, e.clientY - st.y) < 12) goal = floorAt(e.clientX, e.clientY); down = false; joy.x = joy.y = 0; joyEl.style.display = 'none'; joyEl.firstChild.style.transform = ''; },
});

// the first seconds play themselves on level 1 until the first real touch (under-1-minute players left within 10 s of a still screen)
const D = demo(null, { ready: () => state === 'play' && def.n === 1 && mode === 'level' && player.floor === 0 && player.lane < 0, ms: 4500 });
function demoDir() { let bestB = null, bd = 1e9;
  for (const b of blocks) if (b.k === player.floor && b.c === player.ci && b.alive) { const d = Math.hypot(b.x - player.x, b.z - player.z); if (d < bd) { bd = d; bestB = b; } }
  return bestB ? { x: bestB.x - player.x, z: bestB.z - player.z } : { x: 0, z: 0 }; }

// ---------------------------------------------------------------- AI (also drives the QA bot)
function laneNeed(ch, k, L) { if (gateLane(k) === L) return 999; let n = 0; for (const s of steps[k][L]) if (s.o !== ch.ci) n++; return n; }
function bombNear(b) { for (const o of blocks) if (o.c === 5 && o.k === b.k && o.alive && Math.hypot(o.x - b.x, o.z - b.z) < 1.5) return true; return false; }
function brain(ch) {
  if (ch.floor >= nF) return { x: -ch.x * 0.3, z: (zStart(nF - 1) - BL - 4.5 - ch.z) * 0.3 };
  const k = ch.floor;
  if (ch !== player && ch.lane < 0 && player.floor === k && player.lane < 0 && player.stun <= 0) {   // hunters chase a smaller stack; everyone runs from a much bigger one
    const dx = player.x - ch.x, dz = player.z - ch.z, d = Math.hypot(dx, dz);
    if (ch.ai === 'hunt' && ch.stack >= player.stack + def.kt && player.stack > 0 && d < 9) { if (d < 6 && raceT - lastHunt > 7 && !QUIET) { lastHunt = raceT; ui.sub(NAMES[ch.ci] + ' IS COMING!'); rankTxt = ''; } return { x: dx, z: dz }; }
    if (player.stack >= ch.stack + def.kt && ch.stack > 0 && d < 4.2) return { x: -dx, z: -dz };
  }
  if (ch.mode === 'collect' && ch.lane < 0) { if (ch.stack >= ch.want && ch.stack > 0) ch.mode = 'climb'; }
  if (ch.mode === 'climb') {
    if (ch.lane >= 0) {
      if (ch.blocked && ch.stack === 0) { ch.mode = 'collect'; pickWant(ch); }
      else return { x: (LANES[ch.lane] - ch.x) * 2, z: -1 };
    } else return { x: LANES[ch.aLane] - ch.x, z: (zStart(k) - 1.2 - ch.z) };
  }
  let bestB = null, bd = 1e9;
  for (const b of blocks) {
    if (b.k !== k || !b.alive) continue;
    const mine = b.c === ch.ci, gold = b.c === 4 && (ch === player || ch.ai === 'hoard');
    if (!mine && !gold) continue;
    if (ch === player && bombNear(b)) continue;
    const d = Math.hypot(b.x - ch.x, b.z - ch.z) + (ch === player ? 0 : (b.x * 0.13 * ch.ci) % 1.2) - (gold ? 2 : 0);
    if (d < bd) { bd = d; bestB = b; }
  }
  if (ch.lane >= 0) return { x: 0, z: 1 };
  if (!bestB) return { x: -ch.x, z: zc(k) - ch.z };
  return { x: bestB.x - ch.x, z: bestB.z - ch.z };
}
function pickWant(ch) {
  const k = ch.floor;
  let bl = 0, bn = 1e9;
  for (let L = 0; L < LANES.length; L++) { const n = laneNeed(ch, k, L) + (ch === player ? 0 : R() * 3) + Math.abs(LANES[L] - ch.x) * 0.15; if (n < bn) { bn = n; bl = L; } }
  ch.aLane = bl;
  const need = laneNeed(ch, k, bl);
  if (ch === player) ch.want = need;
  else if (ch.ai === 'rush') ch.want = Math.max(3, Math.floor(need * 0.62));
  else if (ch.ai === 'hoard') ch.want = need + 4 + Math.floor(R() * 4);
  else ch.want = Math.max(3, need + Math.floor(R() * 4) - 2);
}
function stepsLeft() {                                // how many more bricks the player's current route needs
  const p = player; if (p.floor >= nF) return 0;
  if (p.lane >= 0) { let n = 0; const j0 = Math.floor((p.p + 0.25) / stepD); for (let s = Math.max(0, j0); s < S; s++) if (steps[p.floor][p.lane][s].o !== p.ci) n++; return n; }
  let bn = 999; for (let L = 0; L < LANES.length; L++) bn = Math.min(bn, laneNeed(p, p.floor, L)); return bn;
}

// ---------------------------------------------------------------- simulation
function moveChar(ch, dir, dt) {
  if (ch.stun > 0) { ch.stun -= dt; ch.vx *= 0.8; ch.vz *= 0.8; }
  else {
    let l = Math.hypot(dir.x, dir.z);
    const tx = l > 0.05 ? dir.x / Math.max(l, 1) : 0, tz = l > 0.05 ? dir.z / Math.max(l, 1) : 0;
    const a = (ch.lane < 0 && ch.floor < nF && isIce(ch.floor) ? 0.065 : 0.25) * dt;
    ch.vx = lerp(ch.vx, tx * ch.speed, a); ch.vz = lerp(ch.vz, tz * ch.speed, a);
  }
  let nx = ch.x + ch.vx * dt, nz = ch.z + ch.vz * dt;
  const k = ch.floor;
  ch.blocked = false;
  if (ch.floor >= nF) {
    const zf = zStart(nF - 1) - BL; nx = clamp(nx, -FW / 2 + 0.4, FW / 2 - 0.4); nz = clamp(nz, zf - 7.6, zf - 0.2);
  } else if (ch.lane < 0) {
    nx = clamp(nx, -FW / 2 + 0.35, FW / 2 - 0.35);
    nz = Math.min(nz, zc(k) + FD / 2 - 0.35);
    if (nz < zStart(k) + 0.1) {
      const L = LANES.findIndex(x => Math.abs(nx - x) < LW / 2 - 0.15);
      if (L >= 0 && ch.vz < 0 && gateLane(k) !== L) { ch.lane = L; ch.p = 0; }
      else { nz = zStart(k) + 0.1; if (L >= 0 && gateLane(k) === L && ch === player && !ch.gw) { ch.gw = 1; pop('CLOSED!', '#fff', 30, 30); bz(15); setTimeout(() => ch.gw = 0, 900); } }
    }
  }
  if (ch.lane >= 0 && ch.floor < nF) {
    const lx = LANES[ch.lane]; nx = clamp(nx, lx - LW / 2 + 0.3, lx + LW / 2 - 0.3);
    let p = zStart(k) - nz;
    if (p < -0.05) { ch.lane = -1; }
    else {
      const prevJ = Math.floor((ch.p + 0.25) / stepD), j = Math.min(S - 1, Math.floor((p + 0.25) / stepD));
      for (let s = Math.max(0, prevJ); s <= j; s++) {
        const st = steps[k][ch.lane][s];
        if (st.o === ch.ci) continue;
        if (ch.stack > 0) placeStep(ch, k, ch.lane, s);
        else { p = Math.min(p, s * stepD - 0.26); ch.blocked = true; if (ch === player && !ch.warned) { ch.warned = true; pop('NEED BRICKS!', '#fff', 30, 30); bz(15); } break; }
      }
      if (!ch.blocked) ch.warned = false;
      ch.p = p; nz = zStart(k) - p;
      if (p > BL) { arrive(ch, k + 1); }
    }
  }
  ch.x = nx; ch.z = nz;
  let ty = ch.floor * RISE;
  if (ch.lane >= 0 && ch.floor < nF) ty = ch.floor * RISE + Math.min(S, Math.max(0, Math.floor(ch.p / stepD) + 1)) * stepH;
  ch.y = lerp(ch.y, ty, 0.35 * dt);
}

function placeStep(ch, k, L, s) {
  const st = steps[k][L][s], stolen = st.o >= 0;
  st.o = ch.ci; st.pop = 1; ch.stack--; ch.pop = 0.6;
  if (QUIET) return;
  builtMesh.setColorAt((k * LANES.length + L) * S + s, new THREE.Color(COLORS[ch.ci])); builtMesh.instanceColor.needsUpdate = true;
  if (ch === player) {
    score++; ui.score(score);
    const n = s % 7, o = Math.floor(s / 7);
    note(67 + MAJOR[n] + o * 12, 0.25, 0.13); buzz(6);
    burst(world, new THREE.Vector3(LANES[L], k * RISE + (s + 1) * stepH, zStart(k) - (s + 0.5) * stepD), [COLORS[0], '#ffffff'], stolen ? 10 : 5, { speed: 0.06, up: 0.06, size: 0.6 });
    if (stolen) { ui.pop('STOLEN!', '#fff', 28, 30); shake = Math.max(shake, 0.12); }
  }
}

function arrive(ch, k) {
  ch.lane = -1; ch.floor = k; ch.mode = 'collect'; ch.p = 0;
  if (k >= nF) {
    finishCount++; ch.done = true;
    if (ch === player && finishCount === 1) return win();
    if (ch !== player && finishCount === 1 && state === 'play') return lose(ch);
    return;
  }
  ch.z = zc(k) + FD / 2 - 0.4;
  activateFloor(k, ch.ci); if (ch === player) { activateFloor(k, 4); activateFloor(k, 5); } pickWant(ch);
  if (ch === player) { snd('coin'); pop('FLOOR ' + (k + 1) + '!', '#fff', 40, 26); fl(0.25); bz(20); }
}

function knock(a, b) {   // a has the bigger stack; b drops its bricks
  const lost = b.stack; b.stack = 0; b.stun = 55; b.mode = 'collect'; pickWant(b);
  if (b === player) { hurt++; fever = 0; streak = 0; }
  if (a === player) smashed++;
  const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
  b.vx = dx / l * 0.22; b.vz = dz / l * 0.22;
  if (QUIET) return;
  burst(world, new THREE.Vector3(b.x, b.y + 1.2, b.z), COLORS[b.ci], Math.min(24, 6 + lost), { speed: 0.16, up: 0.14, size: 1.3, gravity: 0.01 });
  if (b === player) { ui.pop('KNOCKED!', '#ff3d6e', 38, 26); sfx.fail(); buzz([30, 30, 50]); ui.flash(0.3); shake = 0.5; hs = 6; }
  else if (a === player) { ui.pop(smashed > 1 ? 'SMASH x' + smashed + '!' : 'SMASH!', '#ffd23f', 42, 26); sfx.smash(); buzz(25); shake = 0.55; hs = 7; ui.flash(0.25); }
  else { sfx.smash(); }
}
function whack(ch, sw) {   // a sweeper bar sends the stack flying
  const lost = ch.stack; ch.stack = 0; ch.stun = 45; ch.wc = 70; ch.mode = 'collect'; pickWant(ch);
  const dx = ch.x - sw.wx, dz = ch.z - sw.wz, l = Math.hypot(dx, dz) || 1; ch.vx = dx / l * 0.2; ch.vz = dz / l * 0.2;
  if (ch === player) { hurt++; fever = 0; streak = 0; }
  if (QUIET) return;
  burst(world, new THREE.Vector3(ch.x, ch.y + 1, ch.z), COLORS[ch.ci], Math.min(24, 6 + lost), { speed: 0.16, up: 0.16, size: 1.2, gravity: 0.01 });
  if (ch === player) { ui.pop('WHACK!', '#ff3d6e', 40, 26); sfx.fail(); buzz([40, 30, 60]); ui.flash(0.3); shake = 0.55; hs = 6; } else sfx.smash();
}
function boom(ch, b) {
  const lost = Math.ceil(ch.stack / 2); ch.stack -= lost; ch.stun = 30; ch.wc = 40;
  const dx = ch.x - b.x, dz = ch.z - b.z, l = Math.hypot(dx, dz) || 1; ch.vx = dx / l * 0.18; ch.vz = dz / l * 0.18;
  if (ch === player) { hurt++; fever = 0; streak = 0; }
  if (QUIET) return;
  burst(world, new THREE.Vector3(b.x, b.k * RISE + 0.6, b.z), ['#ff7a1a', '#ffd23f', '#2b2d3a'], 22, { speed: 0.2, up: 0.2, size: 1.4, gravity: 0.01 });
  if (ch === player) { ui.pop(lost ? 'BOOM! -' + lost : 'BOOM!', '#ff9a3d', 40, 26); sfx.fail(); buzz([40, 30, 60]); ui.flash(0.4); shake = 0.7; hs = 6; } else sfx.smash();
}

function pickBrick(ch, b) {
  b.alive = false;
  if (b.c < 4) {
    const add = ch === player && fever > 0 ? 2 : 1; ch.stack = Math.min(60, ch.stack + add); ch.pop = 1; b.respawn = 200 + Math.random() * 120;
    if (ch === player) {
      streak++; streakT = 0; bestStreak = Math.max(bestStreak, streak);
      if (!QUIET) { shake = Math.max(shake, 0.05 + Math.min(streak, 12) * 0.012); ch.pop = 1.5 + Math.min(streak, 12) * 0.05; sfx.pick(streak % 10); buzz(5); pillEl.classList.remove('bump'); void pillEl.offsetWidth; pillEl.classList.add('bump');
        burst(world, new THREE.Vector3(b.x, b.k * RISE + 0.4, b.z), COLORS[0], 4, { speed: 0.05, up: 0.07, size: 0.5 });
        if (streak === 5) ui.pop('x5 STREAK!', '#fff', 34, 24); else if (streak === 8) ui.pop('x8 ON FIRE!', '#ffd23f', 38, 24); else if (streak === 15) ui.pop('UNSTOPPABLE!', '#ff8fa3', 44, 24); }
      if (!QUIET && ch === player && (streak === 5 || streak === 8)) { shake = Math.max(shake, 0.25); ui.flash(0.15); }
      if (streak >= 10 && fever <= 0) { fever = 300; if (!QUIET) { ui.pop('FEVER! DOUBLE BRICKS', '#ff5d8f', 40, 24); sfx.win(); ui.flash(0.4); shake = 0.3; } }
    }
  } else if (b.c === 4) {
    ch.stack = Math.min(60, ch.stack + 4); ch.pop = 1; b.respawn = 900;
    if (ch === player) { goldGot++; streak++; streakT = 0; bestStreak = Math.max(bestStreak, streak); if (!QUIET) { sfx.coin(); buzz(12); ui.pop('GOLD +4', GOLD_C, 40, 26); burst(world, new THREE.Vector3(b.x, b.k * RISE + 0.6, b.z), [GOLD_C, '#ffffff'], 14, { speed: 0.1, up: 0.12, size: 0.8 }); } }
  } else boom(ch, b), b.respawn = 800;
}

function stats() { return { won: state === 'won', t: raceT, goldGot, bestStreak, smashed, hurt }; }
function goalMet(g) { return g.t === 'streak' ? bestStreak >= g.n : g.t === 'smash' ? smashed >= g.n : g.t === 'gold' ? goldGot >= g.n : hurt === 0; }
function goalProg(g) { return g.t === 'streak' ? `${Math.min(bestStreak, g.n)}/${g.n}` : g.t === 'smash' ? `${Math.min(smashed, g.n)}/${g.n}` : g.t === 'gold' ? `${Math.min(goldGot, g.n)}/${g.n}` : hurt ? `hit ${hurt}×` : 'clean'; }
const parOf = d => PAR[d.n] || d.par;

function win() {
  state = 'won'; F.level(true); winT = 0; score += 20 * (def.n || 5);
  const quick = raceT <= parOf(def), ok = goalMet(def.goal), n = 1 + (quick ? 1 : 0) + (ok ? 1 : 0);
  lastRes = { ...stats(), n, quick, ok, par: parOf(def) };
  if (QUIET) return;
  ui.score(score); best = Math.max(best, score); ST.set('best', best);
  sfx.win(); buzz([20, 40, 20]); ui.flash(0.6); shake = 0.2;
  const p = new THREE.Vector3(player.x, player.y + 2, player.z);
  confetti(world, p, 90); setTimeout(() => confetti(world, p, 70), 300);
  finishRun(true);
}
function lose(ch) {
  state = 'lost'; F.level(false, (player.floor + (player.lane >= 0 ? player.p / BL : 0)) / nF); winT = 0;
  lastRes = { ...stats(), stk: player.stack, who: ch.ci, left: stepsLeft() + (nF - 1 - player.floor) * S };
  if (QUIET) return;
  sfx.fail(); buzz([40, 30, 60]); finishRun(false);
}

// ---------------------------------------------------------------- render helpers
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), SC = new THREE.Vector3(), E = new THREE.Euler();
function updateMeshes(t, dt) {
  const counts = [0, 0, 0, 0, 0, 0];
  for (const b of blocks) {
    const mesh = blockMeshes[b.c], i = counts[b.c]++;
    let s = b.alive ? 1 : 0;
    if (b.alive && b.pop > 0) { b.pop = Math.max(0, b.pop - 0.05 * dt); s = b.pop > 1 ? 0 : 1 - Math.sin(b.pop * Math.PI) * 0.4 - b.pop * 0.6; s = Math.max(0, s); }
    let y = b.k * RISE + 0.1, rot = b.rot;
    if (b.c === 4) { rot = t * 2.5 + b.rot; y += 0.25 + Math.sin(t * 3 + b.x) * 0.08; s *= 1.05; }
    else if (b.c === 5) s *= 1 + Math.sin(t * 7 + b.x) * 0.1;
    M.compose(V.set(b.x, y, b.z), Q.setFromEuler(E.set(0, rot, 0)), SC.setScalar(s)); mesh.setMatrixAt(i, M);
  }
  for (const m of blockMeshes) m.instanceMatrix.needsUpdate = true;
  for (let k = 0; k < nF; k++) for (let L = 0; L < LANES.length; L++) for (let s = 0; s < S; s++) {
    const st = steps[k][L][s], i = (k * LANES.length + L) * S + s;
    if (st.pop > 0) st.pop = Math.max(0, st.pop - 0.08 * dt);
    const sc = st.o < 0 ? 0 : 1 + Math.sin(st.pop * Math.PI) * 0.35;
    M.compose(V.set(LANES[L], k * RISE + (s + 0.5) * stepH + st.pop * 0.25, zStart(k) - (s + 0.5) * stepD), Q.identity(), SC.set(sc, stepH * sc, sc)); builtMesh.setMatrixAt(i, M);
  }
  builtMesh.instanceMatrix.needsUpdate = true;
  for (const sw of sweepers) sw.arm.rotation.y = sw.ang;
  for (const ch of chars) {
    if (ch.off) continue;
    const g = ch.g, sp = Math.hypot(ch.vx, ch.vz) / SPEED;
    g.position.set(ch.x, ch.y, ch.z);
    if (sp > 0.08 && ch.stun <= 0) { const f = Math.atan2(ch.vx, ch.vz); let d = f - ch.face; d = Math.atan2(Math.sin(d), Math.cos(d)); ch.lean = lerp(ch.lean, -d * 0.6, 0.15); ch.face += d * 0.25 * dt; }
    else ch.lean = lerp(ch.lean, 0, 0.1);
    g.rotation.y = ch.face;
    const mine = my && ch === player;
    g.rotation.x = ch.stun > 0 && !mine ? lerp(g.rotation.x, -1.35, 0.3) : lerp(g.rotation.x, ch.stack > 0 ? 0.06 : 0, 0.2);
    if (ch.done && state !== 'play') { g.run(t * 0.5, 0); g.armL.rotation.z = -2.6 - Math.sin(t * 10) * 0.3; g.armR.rotation.z = 2.6 + Math.sin(t * 10) * 0.3; if (!mine) g.position.y += Math.abs(Math.sin(t * 8)) * 0.4; }
    else {
      g.armL.rotation.z = g.armR.rotation.z = 0;
      g.run(t, Math.min(1, sp));
      if (ch.stack > 0) { g.armL.rotation.x = -1.3 + Math.sin(t * 12) * 0.1; g.armR.rotation.x = -1.3 - Math.sin(t * 12) * 0.1; }
    }
    ch.pop = Math.max(0, ch.pop - 0.06 * dt);
    const n = Math.min(64, ch.stack); ch.stackMesh.count = n;
    const fev = ch === player && fever > 0;
    for (let i = 0; i < n; i++) {
      const top = i === n - 1 ? 1 + ch.pop * 0.5 : 1, sway = ch.lean * i * i * 0.004 + Math.sin(t * 6 + i * 0.3) * 0.004 * i * Math.min(1, sp);
      M.compose(V.set(sway, 0.62 + i * 0.205, -0.42 - Math.min(0.25, i * i * 0.0008) * Math.min(1, sp)), Q.setFromEuler(E.set(0, 0, sway * 0.4)), SC.setScalar(top * (fev ? 1 + Math.sin(t * 20 + i) * 0.06 : 1))); ch.stackMesh.setMatrixAt(i, M);
    }
    ch.stackMesh.instanceMatrix.needsUpdate = true;
  }
}

function placeCamera(a) {
  const p = player;
  camT.lerp(V.set(p.x * 0.75, p.y, p.z), a);
  const sx = shake > 0.02 ? (Math.random() - 0.5) * shake : 0, sy = shake > 0.02 ? (Math.random() - 0.5) * shake : 0;
  if (state === 'won') {
    winT += 0.012;
    camera.position.set(camT.x + Math.sin(winT) * 7, camT.y + 6, camT.z + Math.cos(winT) * 7); camera.lookAt(camT.x, camT.y + 1.5, camT.z);
  } else {
    camera.position.set(camT.x + sx, camT.y + 9.2 + sy, camT.z + 7.6); camera.lookAt(camT.x, camT.y + 0.4, camT.z - 2.4);
  }
  followLight(V.set(p.x, p.y, p.z - 3));
}

let rankTxt = '';
function rankOf() {
  const prog = ch => ch.floor + (ch.lane >= 0 ? ch.p / BL : 0) + ch.stack * 0.004;
  const me = prog(player); let r = 1; for (const ch of chars) if (ch !== player && !ch.off && prog(ch) > me) r++;
  return r;
}

// one simulation tick (dt in 60 fps frames); the QA runs call this directly without drawing
function simStep(dt) {
  raceT += dt / 60; streakT += dt;
  if (streak > 0 && streakT > 95) { if (streak >= 5 && !QUIET) ui.pop('STREAK x' + streak, '#fff', 26, 24); streak = 0; }
  if (fever > 0) { fever -= dt; if (fever <= 0 && !QUIET) ui.pop('FEVER OVER', '#fff', 26, 24); }
  for (const sw of sweepers) sw.ang += sw.w * dt;
  for (const b of blocks) if (!b.alive) { b.respawn -= dt; if (b.active && b.respawn <= 0) { b.alive = true; b.pop = 1; } }
  for (const ch of chars) {
    if (ch.off) continue;
    let dir;
    if (ch === player) {
      if (down) dir = { x: joy.x, z: joy.y };
      else if (D.on && !QUIET) dir = demoDir();
      else if (botJoy) dir = botJoy;
      else if (goal && performance.now() < goal.t && Math.hypot(goal.x - ch.x, goal.z - ch.z) > 0.3) dir = { x: (goal.x - ch.x) * 2, z: (goal.z - ch.z) * 2 };
      else dir = { x: 0, z: 0 };
    } else {
      ch.think -= dt; if (ch.think <= 0 || !ch.tgt) { ch.think = 6 + Math.random() * 8; ch.tgt = brain(ch); }
      dir = ch.tgt;
    }
    moveChar(ch, dir, dt);
    if (state !== 'play') break;
    ch.wc = Math.max(0, ch.wc - dt);
    if (ch.lane < 0 && ch.floor < nF) {
      for (const b of blocks) {
        if (!b.alive || b.k !== ch.floor) continue;
        if (b.c < 4 && b.c !== ch.ci) continue;
        if (b.c === 5 && ch.wc > 0) continue;
        if (Math.abs(b.x - ch.x) < 0.75 && Math.abs(b.z - ch.z) < 0.75) pickBrick(ch, b);
      }
      for (const sw of sweepers) {
        if (sw.f !== ch.floor || ch.wc > 0 || ch.stun > 0) continue;
        const ex = Math.cos(sw.ang) * sw.r, ez = Math.sin(sw.ang) * sw.r;   // bar runs from (wx-ex, wz-ez) to (wx+ex, wz+ez)
        const px = ch.x - sw.wx, pz = ch.z - sw.wz, t = clamp((px * ex + pz * ez) / (ex * ex + ez * ez), -1, 1);
        if (Math.hypot(px - ex * t, pz - ez * t) < 0.62) whack(ch, sw);
      }
    }
  }
  if (state !== 'play') return;
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    const a = chars[i], b = chars[j];
    if (a.off || b.off || a.floor !== b.floor || a.floor >= nF || a.stun > 0 || b.stun > 0) continue;
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
    if (d < 0.75 && d > 0.001) {
      const push = (0.75 - d) / 2; a.x -= dx / d * push; a.z -= dz / d * push; b.x += dx / d * push; b.z += dz / d * push;
      if (a.lane < 0 && b.lane < 0 && a.cool <= 0 && b.cool <= 0 && a.stack !== b.stack) {
        const [big, small] = a.stack > b.stack ? [a, b] : [b, a];
        if (small.stack > 0 && big.stack >= small.stack + def.kt) { knock(big, small); a.cool = b.cool = 90; }
      }
    }
  }
  for (const ch of chars) ch.cool = Math.max(0, ch.cool - dt);
}

loop((dt, t) => {
  if (!world) return;
  if (hs > 0) { hs -= dt; dt *= 0.08; }
  if (state === 'play') {
    simStep(dt);
    if (state === 'play') {
      ui.progress((player.floor + (player.lane >= 0 ? player.p / BL : 0)) / nF);
      const need = stepsLeft();
      pillN.textContent = player.stack; pillS.textContent = need > 0 ? '/ ' + need : '';
      pillEl.classList.toggle('ok', player.stack >= need && need > 0);
      stEl.classList.toggle('on', streak >= 3 || fever > 0); stEl.classList.toggle('fev', fever > 0);
      stEl.firstChild.textContent = fever > 0 ? 'FEVER' : 'x' + streak; stEl.querySelector('i').style.width = fever > 0 ? (fever / 3) + '%' : Math.max(0, 100 - streakT / 0.95) + '%';
      const r = rankOf(), txt = ['1ST', '2ND', '3RD', '4TH'][r - 1] + ' PLACE';
      if (txt !== rankTxt) { rankTxt = txt; ui.sub(txt); }
    }
  }
  shake *= Math.pow(0.88, dt);
  updateMeshes(t, dt);
  heroTick(dt / 60);
  placeCamera(state === 'won' ? 0.05 : 0.12 * dt);
});

// ---------------------------------------------------------------- flow: start, finish, cards, map, garage
let mapEl = null, cardEl = null, garEl = null, banEl = null;
const closeCard = () => { if (cardEl) { cardEl.remove(); cardEl = null; } };
const closeMap = () => { if (mapEl) { mapEl.remove(); mapEl = null; } };
const closeGarage = () => { if (garEl) { garEl.remove(); garEl = null; } };
const ord = n => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');
const DD = () => { const d = daily(dayNo()); d.name = 'Daily Climb #' + (dayNo() - DAY0 + 1); return d; };
function tomorrowLine() { const sk = Math.max(1, streakDays()); return `Tomorrow: Daily Climb #${dayNo() - DAY0 + 2} · 🔥 day ${sk + (SV.get('last', 0) === dayNo() ? 1 : 0)}`; }

function begin(d, m = 'level') {
  closeMap(); closeCard(); closeGarage(); mode = m; if (m === 'daily') d = DD();
  if (!QUIET) touchDay();
  state = 'play'; buildLevel(d); ui.hideStart(); rankTxt = ''; botJoy = null; goal = null;
  if (banEl) banEl.remove();
  if (!QUIET) {
    banEl = el('bc-ban' + (d.boss ? ' boss' : ''), `<b>${d.boss ? 'BOSS · ' + d.boss : d.n ? 'LEVEL ' + d.n + ' · ' + d.name.toUpperCase() : d.name.toUpperCase()}</b><span>${d.why}</span><em>⭐⭐⭐ = win + under ${parOf(d)} s + ${d.goal.txt}</em>`);
    ui.pop('GO!', '#7dff6a', 64, 34); tone(660, 0.2, 'triangle', 0.14, 1); WB.start();
  }
}
function finishRun(won) {
  const r = lastRes; let first = false, prev = 0, chest = null, gift = null, pb = 0, newPB = false;
  if (mode === 'level' && won) {
    const BT = SV.get('bt', {}); pb = BT[def.n]; newPB = !pb || r.t < pb; if (newPB) { BT[def.n] = r.t; SV.set('bt', BT); }
    const S2 = starsOf(); prev = S2[def.n] || 0; first = !prev; if (r.n > prev) { S2[def.n] = r.n; SV.set('stars', S2); }
    if (first) WB.submit(1);
    const due = Math.floor(totalStars() / 6), had = SV.get('chests', 0);
    if (due > had) { SV.set('chests', due); chest = giveSkin(Math.random() < 0.08 ? 2 : 1); }
  }
  if (mode === 'daily' && won) {
    const b = SV.get('daily', {}); if (b.day !== dayNo() || r.t < b.t) SV.set('daily', { day: dayNo(), t: r.t });
    if (SV.get('gift', 0) !== dayNo()) { SV.set('gift', dayNo()); gift = giveSkin(1); }
  }
  Object.assign(r, { first, prev, chest, gift, pb, newPB });
  setTimeout(() => { if (state === 'won' || state === 'lost') resultCard(); }, won ? 1300 : 900);
}
function tipLine() {
  const r = lastRes;
  if (r.hurt >= 2 && def.sweep.length) return 'The red bar knocks your stack off: cross when it points away';
  if (r.hurt >= 2 && def.bomb) return 'Black bombs cost half your stack: walk round them';
  if (r.hurt >= 1) return 'Getting knocked off costs you everything: avoid bigger stacks';
  if (r.left > def.S * 0.7) return 'Get on the stairs sooner: the rival is faster than you think';
  return 'Pick up bricks in a row for a STREAK, then FEVER doubles every pick-up';
}
function resultCard() {
  closeCard(); const r = lastRes, wasBoss = !!def.boss, tot = totalStars();
  if (state === 'lost') {
    cardEl = el('bc-ov card', `<div class="bc-box"><h2 style="font-size:34px">${NAMES[r.who]} WON</h2>
      <p style="font-size:24px;color:#e8552e">${r.left <= 3 ? 'ONLY ' + Math.max(1, r.left) + ' STEP' + (r.left > 1 ? 'S' : '') + ' FROM THE TOP!' : r.left + ' steps from the top'}</p><p style="font-size:15px">${tipLine()}</p>
      <p style="font-size:14px;opacity:.85">${r.hurt ? 'You were knocked ' + r.hurt + '× on the way: dodge the red ones' : r.stk < 6 ? 'You carried only ' + r.stk + ' bricks: grab more before climbing' : 'Nearly! You had ' + r.stk + ' bricks: climb a touch sooner'}</p>
      ${wasBoss ? '<p style="font-size:14px;opacity:.75">Boss is fast: take every brick and watch for hunters</p>' : ''}
      <div class="bc-row2"><button class="bc-btn" data-a="retry">🔄 Again</button>${mode === 'level' ? '<button class="bc-btn alt" data-a="map">Map</button>' : ''}</div></div>`);
  } else {
    const gm = r.ok, why = [];
    if (!r.quick) why.push(`⏱ under ${r.par} s`); if (!gm) why.push(`🎯 ${def.goal.txt} (${goalProg(def.goal)})`);
    cardEl = el('bc-ov card', `<div class="bc-box"><p>${def.n ? 'LEVEL ' + def.n + ' · ' : ''}${def.name}${wasBoss ? ' · BOSS BEATEN!' : ''}</p><h2>1ST PLACE!</h2>
      ${mode === 'level' ? `<div class="bc-stars"><span>⭐</span><span>⭐</span><span>⭐</span></div><div class="bc-why"><span>🏁 win</span><span>⏱ ${r.quick ? '✔' : '≤' + r.par + 's'}</span><span>🎯 ${gm ? '✔' : '✘'}</span></div>` : ''}
      <p>⏱ ${r.t.toFixed(1)} s${r.newPB ? (r.pb ? ' · NEW BEST!' : '') : r.pb ? ' · best ' + r.pb.toFixed(1) : ''} · best streak x${r.bestStreak}${r.goldGot ? ' · 🟡' + r.goldGot : ''}</p>${mode === 'level' && why.length ? `<p style="color:#2a7ab8;font-size:15px">${why[why.length - 1]}</p>` : ''}
      ${r.chest ? `<div style="font-size:15px;margin-top:4px">🎁 CHEST!</div><div class="bc-sw" style="background:${SKINS[r.chest[0]][1]}"></div><p>New brick colour: ${r.chest.map(i => SKINS[i][0]).join(' + ')}${r.chest.length > 1 ? ' JACKPOT!' : ''}</p>` : mode === 'level' ? `<div style="margin:6px auto;width:200px;height:14px;border-radius:8px;background:#0003;overflow:hidden"><i style="display:block;height:100%;width:${(tot % 6) / 6 * 100}%;background:linear-gradient(90deg,#ffd23f,#ff9a3d)"></i></div><p style="font-size:${tot % 6 === 5 ? 20 : 15}px;font-weight:800;color:${tot % 6 === 5 ? '#e8552e' : '#2a7ab8'}">🎁 ${tot % 6}/6 ⭐${tot % 6 === 5 ? ' · 1 STAR FROM A CHEST!' : ''}</p>` : ''}
      ${r.gift && r.gift.length ? `<div style="font-size:15px;margin-top:4px">🎁 DAILY GIFT!</div><div class="bc-sw" style="background:${SKINS[r.gift[0]][1]}"></div><p>New brick colour: ${SKINS[r.gift[0]][0]}</p>` : ''}
      <p style="font-size:14px;opacity:.75">${tomorrowLine()}</p>
      <div class="bc-row2">${r.n < 3 && mode === 'level' ? '<button class="bc-btn alt" data-a="retry">🔄</button>' : ''}<button class="bc-btn" data-a="next">${mode === 'daily' ? 'Map' : 'Next ▶'}</button></div></div>`);
    if (mode === 'level') cardEl.querySelectorAll('.bc-stars span').forEach((sp, i) => { const lit = i === 0 || (i === 1 && r.quick) || (i === 2 && r.ok); if (lit) setTimeout(() => { sp.classList.add('on'); tone(600 + i * 160, 0.16, 'triangle', 0.12, 1.3); buzz(10); }, 60 + i * 190); });
  }
  if (state === 'won' && mode === 'level' && def.n && def.n % 10 && lastRes.n >= 2) { const nb = cardEl.querySelector('[data-a=next]'), me = cardEl; let c = 5; const iv = setInterval(() => { if (cardEl !== me) return clearInterval(iv); if (--c <= 0) { clearInterval(iv); nextLevel(); } else if (nb) nb.textContent = 'Next ▶ ' + c; }, 1000); me.addEventListener('pointerdown', () => clearInterval(iv)); }
  cardEl.addEventListener('pointerdown', e => { e.stopPropagation(); const a = e.target.closest('[data-a]'); if (!a) return; e.preventDefault(); const k = a.dataset.a;
    if (k === 'retry') begin(def, mode); else if (k === 'map') { closeCard(); openMap(); } else nextLevel(); });
}
function nextLevel() {
  closeCard(); if (mode === 'daily') return openMap();
  const n = def.n; if (n === 10 || n === 20 || n >= 30) return openMap();
  begin(LEVELS[n], 'level');
}
function openMap() {
  closeMap(); closeCard(); closeGarage(); state = 'map'; ui.hideStart(); if (banEl) banEl.remove();
  const st = starsOf(), up = unlockedTo(), dd = SV.get('daily', {}).day === dayNo();
  let html = `<div class="bc-head"><span class="bc-chip">⭐ ${totalStars()}</span><span class="bc-chip">🔥 ${Math.max(0, streakDays())}</span><button class="bc-chip" data-a="garage">🧱 ${owned().length}/${SKINS.length}</button><span class="bc-chip">🎁 ${6 - totalStars() % 6}⭐</span></div><div class="bc-scroll">`;
  WORLDS.forEach((w, wi) => {
    const lo = wi * 10 + 1, got = Array.from({ length: 10 }, (_, i) => st[lo + i] || 0).reduce((a, b) => a + b, 0);
    html += `<div class="bc-w"><span>${w.icon} ${w.name}</span><small>⭐ ${got}/30</small></div><div class="bc-grid">`;
    for (let i = 0; i < 10; i++) { const n = lo + i, s = st[n] || 0, lock = n > up, boss = i === 9, hard = LEVELS[n - 1].hard;
      html += `<button class="bc-node ${lock ? 'lock' : n === up ? 'next' : s ? 'done' : 'next'} ${boss ? 'boss' : ''} ${hard ? 'hard' : ''}" data-n="${n}">${lock ? '🔒' : boss ? '👑' : n}${s ? `<i>${[1, 2, 3].map(k => `<b style="font-weight:400;${k > s ? 'opacity:.3;filter:grayscale(1)' : ''}">⭐</b>`).join('')}</i>` : ''}</button>`; }
    html += '</div>';
  });
  html += `</div><div class="bc-foot"><button class="bc-btn alt" data-a="daily">${dd ? '✅ Daily Climb' : '🎁 Daily #' + (dayNo() - DAY0 + 1)}</button><button class="bc-btn" data-a="play">Play ▶</button></div>`;
  mapEl = el('bc-ov', html);
  const nx = mapEl.querySelector('.bc-node.next'); if (nx) setTimeout(() => nx.scrollIntoView({ block: 'center' }), 30);
  mapEl.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const a = b.dataset.a;
    if (b.dataset.n) { const n = +b.dataset.n; if (n <= up) { sfx.tap(); begin(LEVELS[n - 1], 'level'); } else { tone(200, 0.1, 'square', 0.05, 0.8); b.style.animation = 'bcp .2s 2'; } }
    else if (a === 'play') begin(LEVELS[Math.min(up, 30) - 1], 'level');
    else if (a === 'daily') begin(null, 'daily');
    else if (a === 'garage') openGarage();
  });
}
function openGarage() {
  closeGarage(); const have = owned(), eq = SV.get('skin', 0);
  let html = `<div class="bc-head"><button class="bc-chip" data-a="back">◀ Map</button><span class="bc-chip">🧱 Brick colours</span></div><div class="bc-scroll"><p style="text-align:center;font-weight:700;margin:4px 0">Stars open chests · every 6 ⭐ a new brick colour</p><div class="bc-skins">`;
  SKINS.forEach(([nm, col], i) => { const h = have.includes(i); html += `<button class="bc-sk ${h ? (i === eq ? 'eq' : '') : 'q'}" data-i="${i}"><span class="bc-sw" style="background:${col}">${h ? '' : '?'}</span>${h ? nm : '???'}</button>`; });
  html += '</div></div>'; garEl = el('bc-ov', html); garEl.style.zIndex = 21;
  garEl.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.a === 'back') return closeGarage(); const i = +b.dataset.i; if (have.includes(i)) { SV.set('skin', i); setSkin(i); sfx.pick(4); openGarage(); } });
}
ui.onTap(w => { if (w === 'start') { if (!starsOf()[1]) begin(LEVELS[0], 'level'); else openMap(); } });

setSkin(SV.get('skin', 0));
state = 'ready'; buildLevel(LEVELS[Math.max(0, Math.min(29, unlockedTo() - 1))]);
ui.start();
{ const hb = heroBar({ parent: ui.els.start, onPick: () => useHero() }); hb.el.style.width = 'min(360px,100%)'; ui.els.start.querySelector('.hint').before(hb.el); if (!starsOf()[1]) hb.el.style.display = 'none'; }
onHeroesChange(() => { if (JSON.stringify(selectedHero()) !== myShown) useHero(); });
useHero();

// QA hooks: run(n | def, {max}) plays a level headless with the bot (no sound, no DOM) and returns the result
function botMove() {
  if (player.mode === 'collect' && player.lane < 0 && player.want === 0) pickWant(player);
  if (player.mode === 'collect' && player.lane < 0) { pickWant(player); if (player.stack >= player.want) player.mode = 'climb'; }
  botJoy = brain(player);
  const bl = Math.hypot(botJoy.x, botJoy.z) || 1, ux = botJoy.x / bl * SPEED, uz = botJoy.z / bl * SPEED;
  if (botHold > 0) { botHold--; botJoy = botDodge; return; }
  for (const sw of sweepers) {                       // the bot waits out a sweeper bar like a careful player would
    if (sw.f !== player.floor || player.lane >= 0) continue;
    for (let tt = 0; tt <= 26; tt += 3) { const a = sw.ang + sw.w * tt, ex = Math.cos(a) * sw.r, ez = Math.sin(a) * sw.r;
      const px = player.x + ux * tt - sw.wx, pz = player.z + uz * tt - sw.wz, u = clamp((px * ex + pz * ez) / (ex * ex + ez * ez), -1, 1);
      if (Math.hypot(px - ex * u, pz - ez * u) < 1.05) { botDodge = { x: player.x - sw.wx, z: player.z - sw.wz }; botHold = 14; botJoy = botDodge; return; } }
  }
}
let botHold = 0, botDodge = null;
window.__game = {
  get state() { return state; }, get level() { return def.n; }, get score() { return score; }, LEVELS, get chars() { return chars; },
  bot() { if (state !== 'play') return; botMove(); }, go(n) { begin(n ? LEVELS[n - 1] : null, n ? 'level' : 'daily'); }, map() { openMap(); }, get stars() { return starsOf(); },
  run(n, o = {}) {
    QUIET = true; try {
      const d = typeof n === 'number' ? LEVELS[n - 1] : n; begin(d, "level");
      const idle = o.idle; let fr = 0; const MAX = 60 * (o.max || 160);
      while (state === 'play' && fr < MAX) { if (!idle) botMove(); else botJoy = { x: 0, z: 0 }; simStep(1); fr++; }
      const r = { n: d.n, state, t: +raceT.toFixed(1), stack: player.stack, floor: player.floor, ...stats(), rank: rankOf(), stars: lastRes && lastRes.n };
      return r;
    } finally { QUIET = false; }
  },
};
