// Lapwise — a 3D grand prix where every live AI agent session is a race car. Original RIFFCADE game, all art in code.
// Agents drive: successful tool results are throttle, tokens are fuel, failures spin the car, passed tests fire the
// turbo, commits set purple sectors, deploys open the rear wing (DRS), "done" parks the car in its garage.
// The player is the race engineer (boost token, tyres, pit calls) and also drives their own car against the team.
import { THREE, createStage, loop, tone, burst, confetti, input, glossy, mat, rounded, stickman, clamp, lerp } from './kit/hc.js';
import { agents, toast } from './kit/agents.js';
import { board, flag } from './kit/board.js';
import { TRACKS, W, LANES, PIT, buildLine, buildVenue, frameAt, newFrame, pitS, disposeGroup, signTex } from './track.js';

const GAME = 'agent-racing', NAME = 'Lapwise';
const stage = createStage({ fov: 55, shadows: true, shadowSize: 34 });
const { scene, camera, renderer, sun, hemi } = stage;
camera.far = 1400; camera.updateProjectionMatrix();
scene.fog = new THREE.Fog('#cdeeff', 180, 620);
const isPhone = () => innerWidth / innerHeight < 0.8;

// ---------------------------------------------------------------- save
const day = (t = Date.now()) => new Date(t).toLocaleDateString('en-CA');
const freshProfile = () => ({ season: 1, raceInSeason: 0, races: 0, wins: 0, podiums: 0, titles: 0, standings: {}, lastChamp: '', career: { ok: 0, fail: 0, tests: 0, commits: 0, deploys: 0, tokens: 0 },
  livery: 'rookie', track: 'harbor', tyre: 'M', laps: 3, today: { day: day(), pts: 0, races: 0, best: 0 }, lastPodium: [] });
const PKEY = demo => 'lapwise_' + (demo ? 'demo' : 'v1');
let profDemo = null;
function loadProfile(demo) { try { const p = JSON.parse(localStorage.getItem(PKEY(demo))); if (p && p.career) return { ...freshProfile(), ...p }; } catch (e) {} return freshProfile(); }
let P = loadProfile(false);
const saveP = () => { try { localStorage.setItem(PKEY(isDemo()), JSON.stringify(P)); } catch (e) {} };
const rollToday = () => { if (P.today.day !== day()) P.today = { day: day(), pts: 0, races: 0, best: 0 }; };

const LIVERIES = [
  { id: 'rookie', name: 'Rookie', c1: '#ffffff', c2: '#ff3b5c', txt: '', need: () => true },
  { id: 'stripe', name: 'Blue Stripe', c1: '#2f6bff', c2: '#ffffff', txt: 'Finish 1 race', need: p => p.races >= 1 },
  { id: 'sunset', name: 'Sunset', c1: '#ff8a1f', c2: '#ff3b8f', txt: 'Your first podium', need: p => p.podiums >= 1 },
  { id: 'mint', name: 'Mint', c1: '#18c98b', c2: '#14213d', txt: 'Finish 5 races', need: p => p.races >= 5 },
  { id: 'neon', name: 'Neon', c1: '#1a1a26', c2: '#8bff3a', txt: '25 passed test runs', need: p => p.career.tests >= 25 },
  { id: 'chrome', name: 'Chrome', c1: '#dfe4ee', c2: '#2b2d42', chrome: true, txt: 'Win a race', need: p => p.wins >= 1 },
  { id: 'gold', name: 'Gold', c1: '#ffc531', c2: '#2b2d42', chrome: true, txt: 'Win a season, or 5 races', need: p => p.titles >= 1 || p.wins >= 5 },
];
const TYRES = { S: { name: 'Soft', mult: 1.08, rate: 1.7, spin: 1.3, col: '#ff3b5c', about: 'Fastest, wears out in about a lap. Pit once.' },
  M: { name: 'Medium', mult: 1.0, rate: 1.0, spin: 1.0, col: '#ffd23f', about: 'Balanced.' },
  H: { name: 'Hard', mult: 0.95, rate: 0.5, spin: 0.7, col: '#f4f4f4', about: 'Slower, lasts all race, softer spins.' } };
const AG_COL = ['#ff3b5c', '#2f7bff', '#ffcf1a', '#18c98b', '#9b5cff', '#ff8a1f', '#19c3e6', '#ff5fb7', '#8bd400', '#b07cff', '#ff6b3d'];
const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1], PER_SEASON = 6;
const unlockedTrack = t => P.races >= t.need, unlockedLivery = l => l.need(P);

// ---------------------------------------------------------------- DOM
document.body.insertAdjacentHTML('beforeend', `
<div id="lines"></div>
<div id="hud">
  <div id="tower"><div class="th"><b>LAP <span id="lapN">1</span>/<span id="lapT">3</span></b><span id="trk" class="tn"></span></div><div id="duelBox" hidden></div><div id="rows"></div></div>
  <div id="btns"><button id="bBoard" title="World leaderboard">🏆</button><button id="bCam" title="Camera (C)">🎥</button><button id="bToday" title="Today">📅</button><button id="bGarage" title="Garage">🔧</button><button id="bShare" title="Share">📤</button><button id="bConnect" title="Connect your agents">🔌</button></div>
  <div id="lightsHud"><i></i><i></i><i></i><i></i><i></i></div>
  <div id="ticker"></div>
  <div id="banner" hidden></div>
  <div id="wait" hidden><b>Waiting for your agents…</b><span>Start Claude Code or Codex in any project. Each session rolls onto the grid as it works. Meanwhile, practise: ◀ ▶ to steer.</span></div>
  <div id="speedo"><b id="kmh">0</b><small>KM/H</small><div id="ypos">P–</div><div class="rate">TEAM <span id="rate">–</span></div></div>
  <div id="eng"><div id="engName">Tap a car to engineer it</div><div id="engInfo"></div><div class="eb"><button id="bBoost">⚡ BOOST <span id="tok">1</span></button><button id="bPit">BOX BOX</button></div></div>
  <button id="sL" class="steer">◀</button><button id="sR" class="steer">▶</button>
</div>
<section id="setup" class="panel" hidden></section>
<section id="results" class="panel" hidden></section>
<section id="garage" class="panel" hidden></section>
<section id="todayP" class="panel" hidden></section>`);
const $ = id => document.getElementById(id);
const css = document.createElement('style');
css.textContent = `
[hidden].bd-wrap{display:none!important}
body{margin:0;overflow:hidden;font-family:'Saira Condensed',system-ui,sans-serif;color:#fff;background:linear-gradient(180deg,var(--s1,#6fc3ff),var(--s2,#e4f6ff));touch-action:none;user-select:none;-webkit-user-select:none}
.hc-canvas{position:fixed;inset:0;width:100%;height:100%;display:block}
button{font-family:inherit;cursor:pointer}
#hud{position:fixed;inset:0;pointer-events:none;z-index:5}
#hud button{pointer-events:auto}
.glass{background:rgba(14,16,32,.78);border:1px solid rgba(255,255,255,.12);border-radius:12px;box-shadow:0 6px 20px rgba(0,0,0,.25)}
#tower{position:absolute;left:10px;top:10px;width:250px;background:rgba(14,16,32,.82);border-radius:12px;overflow:hidden;pointer-events:auto;box-shadow:0 6px 20px rgba(0,0,0,.28)}
#tower .th{display:flex;justify-content:space-between;align-items:center;padding:7px 10px;background:#ff3b5c;font:16px 'Russo One',sans-serif}
#tower .th span{font:600 14px 'Saira Condensed';opacity:.92}
.row{display:grid;grid-template-columns:22px 5px 1fr 42px 46px;gap:6px;align-items:center;padding:3px 8px;font-weight:700;font-size:15px;line-height:1.25;border-top:1px solid rgba(255,255,255,.06);cursor:pointer;transition:background .2s}
.row .p{font-family:'Russo One';font-size:13px;text-align:right;opacity:.85}.row .c{height:16px;border-radius:2px}
.row .n{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.row .g{font-size:13px;text-align:right;opacity:.8;font-variant-numeric:tabular-nums}
.row .st{font-size:11px;text-align:center;border-radius:4px;padding:0 3px;font-weight:800;letter-spacing:.5px}
#tower.duel{width:292px}
.row.you{background:rgba(255,210,63,.18)}.row.rv{background:linear-gradient(90deg,color-mix(in srgb,var(--rc) 34%,transparent),transparent 85%)}
#duelBox{padding:6px 9px 7px;background:linear-gradient(90deg,rgba(255,210,63,.22),color-mix(in srgb,var(--rc,#888) 40%,transparent));border-top:1px solid rgba(255,255,255,.08);font-weight:700}
#duelBox .vs{display:flex;align-items:center;gap:6px;font:15px 'Russo One'}#duelBox .vs .t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:0}#duelBox .vs .t.them{flex-shrink:1;min-width:0}#duelBox .vs .n{font-size:19px}#duelBox .vs .x{opacity:.7;font-size:11px;white-space:nowrap}
#duelBox .vs .them{margin-left:auto;text-align:right}#duelBox .vs .w{color:#9cf28a}
#duelBox .st{font-size:13px;opacity:.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#duelBox .st i{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:4px;background:var(--rc)}
#duelBox .fd{font-size:13px;color:#ffe9a8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-height:16px}#duelBox .fd.bad{color:#ff9d9d}
.duelres{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0 2px;padding:8px 12px;border-radius:12px;background:linear-gradient(90deg,rgba(255,210,63,.18),color-mix(in srgb,var(--rc) 35%,transparent));font:17px 'Russo One'}
.duelres span{font-size:13px;opacity:.8;width:100%}.duelres .w{color:#9cf28a}.duelres i{opacity:.6;font-style:normal}.duelres small{font:700 13px 'Saira Condensed';opacity:.7;margin-left:auto}.row.sel{outline:2px solid #ffd23f;outline-offset:-2px}.row.purple{background:rgba(160,80,255,.55)}
.row .fuel{grid-column:3/6;height:3px;border-radius:2px;background:rgba(255,255,255,.12);margin-top:-1px}.row .fuel i{display:block;height:100%;border-radius:2px;background:#5cf2a0}
#btns{position:absolute;right:10px;top:10px;display:flex;gap:6px}
#btns button{width:42px;height:42px;border-radius:12px;border:1px solid rgba(255,255,255,.15);background:rgba(14,16,32,.78);color:#fff;font-size:19px}
#lightsHud{position:absolute;left:50%;top:14%;transform:translateX(-50%);display:none;gap:10px;padding:10px 14px;background:rgba(14,16,32,.85);border-radius:14px}
#lightsHud i{width:34px;height:34px;border-radius:50%;background:#3a1d24;display:block;box-shadow:inset 0 -3px 0 rgba(0,0,0,.4)}#lightsHud i.on{background:#ff2a3d;box-shadow:0 0 18px #ff2a3d}
#lightsHud.go i{background:#3cff7a;box-shadow:0 0 18px #3cff7a}
#ticker{position:absolute;left:0;right:0;top:24%;text-align:center;font:clamp(26px,5vw,52px) 'Russo One',sans-serif;letter-spacing:1px;text-shadow:0 4px 0 rgba(0,0,0,.35),0 0 24px rgba(0,0,0,.25);opacity:0;transform:scale(.7)}
#ticker.on{animation:tk 1.6s ease-out forwards}#ticker small{display:block;font:700 clamp(15px,2.4vw,22px) 'Saira Condensed';letter-spacing:2px;opacity:.95}
@keyframes tk{0%{opacity:0;transform:scale(.6)}12%{opacity:1;transform:scale(1.12)}22%{transform:scale(1)}80%{opacity:1}100%{opacity:0;transform:translateY(-30px)}}
#banner{position:absolute;left:50%;top:14px;transform:translateX(-50%);padding:9px 16px;border-radius:999px;background:rgba(255,210,63,.95);color:#1b1408;font-weight:800;font-size:17px;white-space:nowrap;animation:bob 1s ease-in-out infinite;pointer-events:auto;cursor:pointer;max-width:92vw;overflow:hidden;text-overflow:ellipsis}
@keyframes bob{50%{transform:translate(-50%,-4px)}}
#wait{position:absolute;left:50%;top:30%;transform:translateX(-50%);width:min(440px,88vw);text-align:center;padding:16px;background:rgba(14,16,32,.82);border-radius:16px}
#wait b{display:block;font:24px 'Russo One';margin-bottom:6px;color:#ffd23f;animation:bob2 1.4s ease-in-out infinite}#wait span{font-size:16px;opacity:.9}
@keyframes bob2{50%{opacity:.55}}
#speedo{position:absolute;right:12px;bottom:60px;width:128px;text-align:center;padding:8px 6px;background:rgba(14,16,32,.82);border-radius:16px}
#speedo b{display:block;font:40px/1 'Russo One';font-variant-numeric:tabular-nums}#speedo small{font-weight:800;letter-spacing:2px;opacity:.7}
#ypos{font:22px 'Russo One';color:#ffd23f}#speedo .rate{font-size:13px;font-weight:800;opacity:.85}
#eng{position:absolute;left:50%;bottom:56px;transform:translateX(-50%);width:min(380px,calc(100vw - 180px));padding:8px 12px;background:rgba(14,16,32,.82);border-radius:14px;pointer-events:auto}
#engName{font:17px 'Russo One';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#engInfo{font-size:14px;opacity:.85;min-height:18px}
#eng .eb{display:flex;gap:8px;margin-top:6px}#eng .eb button{flex:1;border:0;border-radius:10px;padding:9px 6px;font:16px 'Russo One';color:#1b1408;background:#ffd23f;box-shadow:0 3px 0 rgba(0,0,0,.3)}
#eng .eb button:disabled{opacity:.35}#bPit{background:#ff3b5c!important;color:#fff!important}
.steer{position:absolute;bottom:60px;width:64px;height:64px;border-radius:50%;border:0;background:rgba(14,16,32,.75);color:#fff;font-size:26px;box-shadow:0 4px 0 rgba(0,0,0,.3)}
#sL{left:12px}#sR{left:84px}.steer:active{transform:translateY(3px);background:#ffd23f;color:#1b1408}
#lines{position:fixed;inset:0;pointer-events:none;z-index:3;opacity:0;background:repeating-conic-gradient(from 0deg at 50% 52%,rgba(255,255,255,.55) 0 .6deg,transparent .6deg 7deg);-webkit-mask:radial-gradient(circle at 50% 52%,transparent 34%,#000 75%);mask:radial-gradient(circle at 50% 52%,transparent 34%,#000 75%)}
.panel{position:fixed;z-index:20;background:rgba(14,16,32,.93);border:1px solid rgba(255,255,255,.14);border-radius:18px;padding:16px;color:#fff;box-shadow:0 20px 60px rgba(0,0,0,.45);overflow:auto;max-height:calc(100% - 40px)}
.panel h2{margin:0;font:26px 'Russo One';color:#ffd23f}.panel h3{margin:12px 0 6px;font:15px 'Russo One';letter-spacing:1px;opacity:.85}
.panel .sub{margin:2px 0 6px;font-size:16px;opacity:.85}
.chips{display:flex;flex-wrap:wrap;gap:6px}.chip{border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:#fff;border-radius:10px;padding:6px 10px;font-weight:700;font-size:15px;display:flex;align-items:center;gap:6px}
.chip[aria-pressed=true]{background:#ffd23f;color:#1b1408;border-color:#ffd23f}.chip:disabled{opacity:.42;cursor:not-allowed}.chip .sw{width:16px;height:16px;border-radius:4px;border:2px solid rgba(0,0,0,.25)}
.big{width:100%;margin-top:12px;border:0;border-radius:14px;padding:13px;font:21px 'Russo One';color:#1b1408;background:#ffd23f;box-shadow:0 4px 0 rgba(0,0,0,.35)}
.ghost{border:1px solid rgba(255,255,255,.2);background:transparent;color:#fff;border-radius:12px;padding:10px;font-weight:800;font-size:16px}
#setup{right:16px;top:50%;transform:translateY(-50%);width:360px}
#results{right:16px;top:50%;transform:translateY(-50%);width:min(600px,calc(100% - 24px));max-height:calc(100% - 70px);margin-top:-20px}
@media (max-width:700px){#results{left:10px;right:10px;top:auto;bottom:50px;transform:none;width:auto;max-height:58%;margin:0}}
#garage,#todayP{left:50%;top:50%;transform:translate(-50%,-50%);width:min(520px,calc(100% - 24px))}
.x{float:right;background:none;border:0;color:#bbb;font-size:22px}
.tbl{width:100%;border-collapse:collapse;font-size:16px;font-weight:700}.tbl td{padding:4px 4px;border-top:1px solid rgba(255,255,255,.08)}.tbl td.r{text-align:right;font-variant-numeric:tabular-nums}
.tbl .sw{display:inline-block;width:10px;height:14px;border-radius:2px;margin-right:6px;vertical-align:-2px}
.cols{display:grid;grid-template-columns:1.25fr 1fr;gap:14px}.cols h3{margin-top:4px}@media (max-width:560px){.cols{grid-template-columns:1fr}}
.pod{display:flex;align-items:flex-end;justify-content:center;gap:8px;margin:10px 0 4px}.pod div{flex:1;max-width:150px;text-align:center;font-weight:800;font-size:15px}
.pod i{display:block;border-radius:8px 8px 0 0;margin-top:4px;font:20px/1 'Russo One';font-style:normal;padding-top:6px;color:#1b1408}
.stat{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.stat div{background:rgba(255,255,255,.06);border-radius:12px;padding:8px;text-align:center}.stat b{display:block;font:24px 'Russo One';color:#ffd23f}
.unl{margin-top:8px;padding:8px 10px;border-radius:10px;background:rgba(92,242,160,.15);color:#9dffc8;font-weight:800}
.rk{display:inline-block;margin-left:6px;padding:1px 8px;border-radius:999px;background:rgba(255,255,255,.1);font-size:15px}
@media (max-width:700px){
 #tower{width:164px;top:8px;left:8px}.row{grid-template-columns:16px 4px 1fr 36px;font-size:13px;padding:2px 6px;gap:4px}.row .g{display:none}.row .st{font-size:10px}
 #tower .th{font-size:13px;padding:5px 8px}#tower .th .tn{display:none}
 #duelBox{padding:4px 6px}#duelBox .vs{font-size:12px;gap:4px}#duelBox .vs .n{font-size:15px}#duelBox .st,#duelBox .fd{font-size:11px}
 #lightsHud{top:230px;gap:7px;padding:8px 10px}#lightsHud i{width:26px;height:26px}
 #btns{display:grid;grid-template-columns:repeat(3,38px);gap:5px;right:8px;top:8px}#btns button{width:38px;height:38px;font-size:17px}
 #speedo{right:8px;top:96px;bottom:auto;width:96px;padding:5px}#speedo b{font-size:28px}#ypos{font-size:18px}
 .steer{width:66px;height:66px;bottom:170px}#sL{left:10px}#sR{left:auto;right:10px}
 #eng{bottom:52px;width:calc(100vw - 20px)}#eng .eb button{padding:8px 4px;font-size:15px}#engInfo{font-size:13px}
 #banner{top:auto;bottom:205px;font-size:14px;max-width:230px}
 #setup{left:10px;right:10px;top:auto;bottom:10px;transform:none;width:auto;max-height:62%}
 #ticker{top:30%}
}`;
document.head.appendChild(css);

// ---------------------------------------------------------------- textures / small helpers
function tagCanvas(text, color, icon = '', sub = '') {
  // sub: a second line (the rival's flag + player name); the whole tag is then filled in the team colour
  const H = sub ? 116 : 84, c = document.createElement('canvas'); c.width = 320; c.height = H; const g = c.getContext('2d');
  g.font = '700 44px "Saira Condensed",system-ui'; const t = (icon ? icon + ' ' : '') + text;
  let w = g.measureText(t).width + 40; if (sub) { g.font = '700 26px "Saira Condensed",system-ui'; w = Math.max(w, g.measureText(sub).width + 36); } w = Math.min(310, w);
  const bh = sub ? 94 : 62;
  g.fillStyle = 'rgba(14,16,32,.86)'; g.beginPath(); g.roundRect((320 - w) / 2, 6, w, bh, 16); g.fill();
  if (sub) { g.fillStyle = color; g.beginPath(); g.roundRect((320 - w) / 2 + 4, 10, w - 8, 52, 12); g.fill(); }
  else { g.fillStyle = color; g.fillRect((320 - w) / 2 + 10, 14, 7, 46); }
  g.font = '700 44px "Saira Condensed",system-ui';
  const dark = sub && lum(color) > 0.55;
  g.fillStyle = dark ? '#14182a' : '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 160 + (sub ? 0 : 5), sub ? 37 : 39, 280);
  if (sub) { g.font = '700 26px "Saira Condensed",system-ui'; g.fillStyle = '#fff'; g.fillText(sub, 160, 80, 290); }
  g.fillStyle = 'rgba(14,16,32,.86)'; g.beginPath(); g.moveTo(150, bh + 6); g.lineTo(170, bh + 6); g.lineTo(160, bh + 18); g.fill();
  return c;
}
function lum(hex) { const n = parseInt(String(hex).slice(1), 16); return ((n >> 16 & 255) * 0.299 + (n >> 8 & 255) * 0.587 + (n & 255) * 0.114) / 255; }
function makeTag(text, color, sub = '') {
  const tex = new THREE.CanvasTexture(tagCanvas(text, color, '', sub)); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.userData.sub = sub;
  const fit = () => { const h = s.userData.sub ? 116 : 84; s.scale.set(3.8, 3.8 * h / 320, 1); s.position.y = 2.8 + (h - 84) / 320 * 1.9; };
  fit(); s.renderOrder = 10; s.userData.redraw = (t, c, i) => { tex.image = tagCanvas(t, c, i, s.userData.sub); tex.needsUpdate = true; fit(); }; return s;
}
const smokeTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 2, 32, 32, 30); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t; })();

// ---------------------------------------------------------------- car model
function makeCar(c1, c2, { chrome = false, neon = false, scale = 1 } = {}) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const M1 = glossy(c1, chrome ? { metalness: 0.85, roughness: 0.18 } : {}), M2 = glossy(c2, neon ? { emissive: c2, emissiveIntensity: 0.7 } : {}), dark = mat('#1d1f2b'), rim = mat('#c9ced9');
  const add = (geo, m, x, y, z, parent = body) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
  add(rounded(1.3, 0.5, 3.4, 0.2), M1, 0, 0.52, 0.1);
  add(rounded(0.74, 0.32, 1.9, 0.14), M1, 0, 0.42, 2.35);
  add(rounded(2.1, 0.42, 1.7, 0.18), M1, 0, 0.44, -0.35);
  add(rounded(0.95, 0.62, 1.5, 0.22), M1, 0, 0.74, -1.35);
  add(new THREE.BoxGeometry(2.5, 0.09, 0.6), M2, 0, 0.22, 3.2);
  for (const x of [-1.22, 1.22]) add(new THREE.BoxGeometry(0.08, 0.3, 0.6), M2, x, 0.32, 3.2);
  for (const x of [-0.98, 0.98]) add(new THREE.BoxGeometry(0.08, 0.7, 0.8), M2, x, 1.0, -2.25);
  add(new THREE.BoxGeometry(2.0, 0.09, 0.62), M2, 0, 1.28, -2.3);
  const flapPiv = new THREE.Group(); flapPiv.position.set(0, 1.12, -2.0); body.add(flapPiv);
  const flap = add(new THREE.BoxGeometry(1.9, 0.06, 0.34), M2, 0, 0, -0.17, flapPiv);
  add(new THREE.BoxGeometry(0.36, 0.03, 3.6), M2, 0, 0.785, 0.1);
  add(new THREE.SphereGeometry(0.26, 16, 12), M2, 0, 0.98, 0.25);
  add(new THREE.BoxGeometry(0.4, 0.12, 0.08), dark, 0, 1.0, 0.5);
  const wheels = [];
  for (const [x, z, r] of [[1.1, 1.45, 0.42], [-1.1, 1.45, 0.42], [1.14, -1.35, 0.48], [-1.14, -1.35, 0.48]]) {
    const w = new THREE.Group(); w.position.set(x, r, z); body.add(w);
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.5, 18), dark); tyre.rotation.z = Math.PI / 2; tyre.castShadow = true; w.add(tyre);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.52, 6), rim); hub.rotation.z = Math.PI / 2; w.add(hub); wheels.push(w);
  }
  const fg = new THREE.ConeGeometry(0.26, 1.4, 10); fg.translate(0, 0.7, 0);
  const flame = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color: '#ff9a1f', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  flame.rotation.x = -Math.PI / 2; flame.position.set(0, 0.72, -2.1); flame.scale.setScalar(0.001); body.add(flame);
  const flame2 = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); flame2.scale.set(0.55, 0.6, 0.55); flame.add(flame2);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 6.4), new THREE.MeshBasicMaterial({ color: c2, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.rotation.x = -Math.PI / 2; glow.position.set(0, 0.06, -1); g.add(glow);
  g.scale.setScalar(scale);
  return { g, body, wheels, flap: flapPiv, flame, glow, M1, M2 };
}

// ---------------------------------------------------------------- track
let TR = null, VEN = null, theme = TRACKS[0], podium = null;
const F = newFrame(), F2 = newFrame(), _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
function loadTrack(id) {
  theme = TRACKS.find(t => t.id === id) || TRACKS[0];
  if (VEN) { scene.remove(VEN.group); disposeGroup(VEN.group); }
  if (podium) { scene.remove(podium); podium = null; }
  TR = buildLine(theme); VEN = buildVenue(TR, theme); scene.add(VEN.group);
  document.body.style.setProperty('--s1', theme.sky[0]); document.body.style.setProperty('--s2', theme.sky[1]);
  scene.fog.color.set(theme.fog);
  hemi.intensity = theme.night ? 0.55 : 1.15; hemi.color.set(theme.night ? '#8fa0ff' : '#ffffff'); hemi.groundColor.set(theme.night ? '#20203a' : '#ffe8f0');
  sun.intensity = theme.night ? 0.75 : 1.7; sun.color.set(theme.night ? '#c9d4ff' : '#ffffff');
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', theme.sky[0]);
  $('trk').textContent = theme.name;
  oils.forEach(o => scene.remove(o.mesh)); oils.length = 0; pads.forEach(o => scene.remove(o.mesh)); pads.length = 0;
}
function place(obj, s, lat, lift = 0, yaw = 0) {
  frameAt(TR, s, F);
  obj.position.copy(F.p).addScaledVector(F.s, lat).addScaledVector(F.u, lift);
  _m.makeBasis(_v.copy(F.s).negate(), F.u, F.t); obj.quaternion.setFromRotationMatrix(_m);
  if (yaw) obj.rotateY(yaw);
}

// ---------------------------------------------------------------- racers
const racers = [], partners = new Map(), byId = new Map();
const oils = [], pads = [], smoke = [];
let selected = null, boostTokens = 1, teamRes = [], colorI = 0;
function newRacer({ id, name, color, c2 = '#ffffff', you = false, liv = null, sub = '' }) {
  const car = makeCar(color, c2, liv || {}); scene.add(car.g);
  const tag = makeTag(name, color, sub); car.g.add(tag);
  const r = { id, name, color, you, car, tag, dist: 0, lat: 0, laneI: 1, v: 0, act: 0.6, fuel: 0.7, wear: 0, damage: 0, spinT: 0, spinA: 0, boostT: 0, turboT: 0, drsT: 0, padT: 0, purpleT: 0,
    mode: 'race', pitCall: false, forced: false, waiting: false, stopT: 0, slot: 0, finished: false, finishPos: 0, bonus: 0, q: [], qT: 0, lastT: Date.now(), partners: 0, crew: null, ok: 0, fail: 0, wob: 0, draft: 0, tagState: '' };
  racers.push(r); byId.set(id, r); assignSlots(); return r;
}
function removeRacer(r) {
  scene.remove(r.car.g); if (r.crew) scene.remove(r.crew); const i = racers.indexOf(r); if (i >= 0) racers.splice(i, 1); byId.delete(r.id);
  for (const [k, p] of partners) if (p.parent === r) { scene.remove(p.car.g); partners.delete(k); }
  if (selected === r) selected = null; assignSlots();
}
function assignSlots() {
  let k = 0; for (const r of racers) { r.slot = r.you ? PIT.slots - 1 : Math.min(PIT.slots - 2, k++); }
  if (VEN) VEN.garages.forEach((g, i) => { const r = racers.find(x => x.slot === i); g.door.material.color.set(r ? r.color : '#c9cfdc'); });
}
let you = null;
function buildYou() {
  const L = LIVERIES.find(l => l.id === P.livery && unlockedLivery(l)) || LIVERIES[0];
  const old = you; if (old) { scene.remove(old.car.g); racers.splice(racers.indexOf(old), 1); byId.delete('you'); }
  you = newRacer({ id: 'you', name: 'YOU', color: L.c1, c2: L.c2, you: true, liv: { chrome: L.chrome, neon: L.id === 'neon' } });
  you.tag.userData.redraw('YOU', L.c2 === '#ffffff' ? '#ffd23f' : L.c2);
  if (old) Object.assign(you, { dist: old.dist, lat: old.lat, laneI: old.laneI, v: old.v, mode: old.mode, finished: old.finished, wear: old.wear, damage: old.damage });
  else { you.laneI = 1; you.lat = LANES[1]; }
}

// label → display name (two sessions in one project folder become "api" and "api 2")
function nameFor(label) { let n = label || 'agent', k = 2; const taken = new Set(racers.map(r => r.name)); while (taken.has(n)) n = (label || 'agent').slice(0, 13) + ' ' + k++; return n; }
function racerFor(e) {
  if (e.parent) {
    let lead = byId.get(e.parent); if (!lead) lead = racerFor({ ...e, agent: e.parent, parent: null });
    let p = partners.get(e.agent);
    if (!p && e.kind !== 'end') {
      const car = makeCar(lead.color, '#ffffff', { scale: 0.72 }); car.M1.color.offsetHSL(0, -0.1, 0.12); scene.add(car.g);
      const n = [...partners.values()].filter(x => x.parent === lead).length;
      p = { id: e.agent, parent: lead, car, idx: n, lat: lead.lat, fade: 1, leaving: false, wob: 0 }; partners.set(e.agent, p);
      if (inRace()) ticker(`${lead.name} +1 DRAFTING PARTNER`, 'a subagent tucks into the slipstream', lead.color, 0.7);
    }
    return p ? { partner: p, lead } : { lead };
  }
  let r = byId.get(e.agent);
  if (!r) {
    r = newRacer({ id: e.agent, name: nameFor(e.label), color: AG_COL[colorI++ % AG_COL.length] });
    r.src = e.src;
    if (state === 'race') { const back = Math.min(...racers.filter(x => x !== r).map(x => x.dist)); r.dist = (isFinite(back) ? back : 0) - 12; r.laneI = (Math.random() * 4) | 0; r.lat = LANES[r.laneI]; }
    else if (state === 'grid') { gridUp(); renderSetup(); }
    else if (state === 'lights') gridUp();
    else if (state === 'practice') r.dist = you ? you.dist - 30 : 0;
  }
  return { lead: r };
}

// ---------------------------------------------------------------- stats (today + career)
const todayS = { tools: 0, ok: 0, fail: 0, tests: 0, commits: 0, deploys: 0, tokens: 0, agents: new Set(), dones: 0 };
let midnight = new Date().setHours(0, 0, 0, 0);
function tallyToday(e) {
  if (e.t < midnight) return;
  todayS.agents.add(e.parent || e.agent);
  if (e.kind === 'tool') todayS.tools++;
  else if (e.kind === 'tokens') todayS.tokens += e.tokens || 0;
  else if (e.kind === 'done') todayS.dones++;
  else if (e.kind === 'result') { if (e.ok) { todayS.ok++; if (e.cat === 'test') todayS.tests++; if (e.cat === 'commit') todayS.commits++; if (e.cat === 'deploy') todayS.deploys++; } else todayS.fail++; }
}
function tallyCareer(e) {
  const c = P.career;
  if (e.kind === 'tokens') c.tokens += e.tokens || 0;
  if (e.kind !== 'result') return;
  if (e.ok) { c.ok++; if (e.cat === 'test') c.tests++; if (e.cat === 'commit') c.commits++; if (e.cat === 'deploy') c.deploys++; } else c.fail++;
}
const isDemo = () => !!(A && A.demo);
const inRace = () => state === 'race' || state === 'practice';

// ---------------------------------------------------------------- events -> racing
function onBatch(list, info) {
  B && B.onAgentEvents(list);
  if (!!info.demo !== (profDemo === true)) switchProfile(!!info.demo);
  let careerTouched = false;
  if (info.backfill) {
    // summarise today; put only the sessions active in the last 30 min on track, no replays
    const lastKind = new Map(), recentOk = new Map();
    for (const e of list) {
      tallyToday(e); if (e.counted) { tallyCareer(e); careerTouched = true; }
      if (!e.live) continue;
      const k = e.parent || e.agent; if (!lastKind.has(k) || e.kind !== 'tokens') lastKind.set(e.parent ? e.agent : k, e);
      if (e.kind === 'result' && e.ok && Date.now() - e.t < 120e3) recentOk.set(k, (recentOk.get(k) || 0) + 1);
    }
    for (const [k, e] of lastKind) {
      if (e.parent && (e.kind === 'end')) continue;
      const got = racerFor(e); const r = got.lead; r.lastT = e.t; r.act = Math.min(3, 0.6 + (recentOk.get(r.id) || 0) * 0.3);
      if (!e.parent && e.kind === 'done') { r.waiting = true; r.pitCall = true; }
    }
    if (todayS.tools) toast(`Today so far: ${todayS.tools} tool calls, ${todayS.tests} test runs passed, ${todayS.commits} commits, ${todayS.deploys} deploys.`, 6000);
  } else {
    for (const e of list) {
      tallyToday(e);
      if (e.counted && !info.demo) { tallyCareer(e); careerTouched = true; }
      if (info.demo) tallyCareer(e);
      if (!e.live) continue;
      const got = racerFor(e); got.lead.lastT = Date.now();
      got.lead.q.push({ e, partner: got.partner || null });
    }
  }
  if (careerTouched || info.demo) saveP();
  if (state === 'practice' && agentRacers().length) toGrid();
}
function switchProfile(demo) {
  profDemo = demo; P = loadProfile(demo); rollToday();
  for (const r of [...racers]) if (!r.you) removeRacer(r);
  for (const k of Object.keys(todayS)) todayS[k] = k === 'agents' ? new Set() : 0;
  if (TR && P.track !== theme.id) loadTrack(P.track);
  buildYou(); toPracticeOrGrid();
}
const agentRacers = () => racers.filter(r => !r.you);
const ownRacers = () => racers.filter(r => !r.you && !r.rival);
// how a car is named in commentary / standings: the rival's cars carry the rival's flag + name
const nm = r => r.rival && RV ? `${RV.flag} ${RV.name}'s ${r.name}` : r.name;
const short = (t, n) => t.length > n ? t.slice(0, n - 1) + '…' : t;
const rowName = r => r.rival && RV ? (isPhone() ? `${RV.flag} ${r.name}` : `${RV.flag} ${short(RV.name, 10)} · ${r.name}`) : r.name;

function applyEvent(r, e, partner) {
  const racing = state === 'race' || state === 'practice';
  if (partner) {
    if (e.kind === 'result') { if (e.ok) { r.act += 0.35; if (racing) sparkle(partner.car.g.position, r.color, 4); } else partner.wob = 0.6; teamRes.push(e.ok); }
    if (e.kind === 'tokens') r.fuel = Math.min(1, r.fuel + (e.tokens || 0) / 9000);
    if (e.kind === 'end') { partner.leaving = true; }
    return;
  }
  switch (e.kind) {
    case 'prompt': wake(r); break;
    case 'tool': wake(r); r.act += 0.12; break;
    case 'think': r.act += 0.08; break;
    case 'tokens': r.fuel = Math.min(1, r.fuel + (e.tokens || 0) / 5000); break;
    case 'done':
      if (!r.waiting) { r.waiting = true; r.pitCall = true; tone(988, 0.12, 'sine', 0.06, 1); setTimeout(() => tone(1318, 0.18, 'sine', 0.06, 1), 120); }
      break;
    case 'result':
      if (!r.rival) { teamRes.push(e.ok); if (teamRes.length > 40) teamRes.shift(); }
      if (e.ok) { r.ok++; r.act += 1; if (racing) r.v += 1.5; }
      else r.fail++;
      if (!racing) break;
      if (r.rival) { rivalMove(r, e); break; }
      if (!e.ok) spinOut(r, e.cat === 'test');
      else if (e.cat === 'test') turbo(r);
      else if (e.cat === 'commit') purple(r);
      else if (e.cat === 'deploy') drs(r);
      break;
  }
}
function wake(r) { if (!r.waiting) return; r.waiting = false; if (!r.forced && r.damage === 0) r.pitCall = false; if (r.mode === 'stopped') r.stopT = Math.min(r.stopT, 0.8); }

// ---------------------------------------------------------------- big moments
let cut = null, cutCool = 0, shake = 0, slow = 1, slowCam = false, crowdHype = 0;
function ticker(t, sub, color = '#fff', size = 1) {
  const el = $('ticker'); el.innerHTML = `<span style="color:${color}">${t}</span>${sub ? `<small>${sub}</small>` : ''}`; el.style.fontSize = size < 1 ? 'clamp(20px,3.6vw,36px)' : '';
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
}
function sparkle(pos, color, n = 10) { burst(scene, _v.copy(pos).setY(pos.y + 0.8), [color, '#ffffff', '#ffd23f'], n, { speed: 0.14, up: 0.08, size: 0.45, gravity: 0.008 }); }
function puff(pos, color = '#ffffff', n = 3, big = 1) {
  for (let i = 0; i < n; i++) {
    if (smoke.length > 160) { const o = smoke.shift(); scene.remove(o.s); }
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color, transparent: true, opacity: 0.7, depthWrite: false }));
    s.position.copy(pos).add(_v2.set((Math.random() - 0.5) * 1.2, 0.4 + Math.random() * 0.5, (Math.random() - 0.5) * 1.2)); s.scale.setScalar(1.2 * big);
    scene.add(s); smoke.push({ s, life: 1, g: 1.8 * big, vy: 0.6 + Math.random() * 0.8 });
  }
}
function camCut(r, why) { if (cutCool > 0 || camMode !== 'chase' || state !== 'race') return; cut = { r, t: 2.6 }; cutCool = 7; }
function spinOut(r, big) {
  const ty = TYRES[P.tyre];
  r.spinT = 1.0 * (big ? 1.3 : 1) * ty.spin; r.spinA = 0; r.v *= big ? 0.2 : 0.35; r.damage = Math.min(5, r.damage + 1);
  puff(r.car.g.position, '#e8e8f0', 10, 1.2); burst(scene, _v.copy(r.car.g.position).setY(r.car.g.position.y + 0.6), ['#ffd23f', '#ff8a1f', '#ffffff'], 14, { speed: 0.2, up: 0.1, size: 0.35, gravity: 0.01 });
  tone(140, 0.25, 'sawtooth', 0.05, 0.4);
  if (oils.length < 7) addOil(r.dist, r.lat);
  if (r.damage >= 4 && !r.pitCall) { r.pitCall = true; r.forced = true; ticker(`${nm(r)}: BOX BOX`, 'car damaged, forced pit stop', '#ff3b5c'); }
  else if (r === selected || distTo(r) < 70) ticker(`${nm(r)} SPINS`, 'tool failed', r.color, 0.7);
  if (distTo(r) < 40) shake = Math.max(shake, 0.5);
}
function turbo(r) {
  r.turboT = 3; r.v += 6; crowdHype = 2.5; tone(330, 0.35, 'sawtooth', 0.04, 2.6);
  ticker(`${nm(r)} TURBO`, 'tests passed', tcol(r), r.rival ? 0.8 : 1); camCut(r); shake = Math.max(shake, 0.35);
  if (you && pads.length < 4 && state === 'race') addPad(you.dist + 50 + Math.random() * 30, LANES[(Math.random() * 4) | 0]);
}
function purple(r) { r.purpleT = 2.5; if (state === 'race' && r.bonus < 3) r.bonus++; r.v += 3; tone(784, 0.1, 'triangle', 0.06, 1); setTimeout(() => tone(1175, 0.18, 'triangle', 0.06, 1), 90); ticker(`${nm(r)} PURPLE SECTOR`, 'commit · +1 bonus point', '#c08bff', 0.8); }
function drs(r) { r.drsT = 5; r.v += 4; crowdHype = 3; tone(200, 0.6, 'sawtooth', 0.04, 3.2); ticker(`${nm(r)} DRS OPEN`, 'deployed · overtaking boost', '#5cd2ff', r.rival ? 0.8 : 1); camCut(r); }
const tcol = r => r.rival && r.color === SIM_COL ? '#e8ecf4' : r.color;
// the rival's agents: their finished steps drive their cars. Deploy = big boost, tests = turbo, commit = purple sector,
// failure = a wobble that costs speed (no oil, no damage: that's for your own team's crashes)
function rivalMove(r, e) {
  if (!e.ok) {
    r.wobT = 1.1; r.v *= 0.55; puff(r.car.g.position, '#e8e8f0', 5, 0.9); tone(150, 0.18, 'sawtooth', 0.03, 0.5);
    if (r === selected || distTo(r) < 60) ticker(`${nm(r)} WOBBLES`, 'their step failed', tcol(r), 0.65);
    return;
  }
  if (e.cat === 'test') turbo(r);
  else if (e.cat === 'commit') purple(r);
  else if (e.cat === 'deploy') { drs(r); r.boostT = 3; r.v += 4; }
}
const distTo = r => (you ? r.car.g.position.distanceTo(you.car.g.position) : 99);
function addOil(dist, lat) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(1.4, 18), new THREE.MeshStandardMaterial({ color: '#15151c', roughness: 0.15, metalness: 0.4, transparent: true, opacity: 0.85 }));
  place(m, dist, lat, 0.09); m.rotateX(-Math.PI / 2); m.scale.set(1, 1.6, 1); scene.add(m); oils.push({ dist, lat, mesh: m, t: 22 });
}
const chevTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#19c3e6'; g.fillRect(0, 0, 64, 128); g.strokeStyle = '#ffffff'; g.lineWidth = 9; for (const y of [30, 70, 110]) { g.beginPath(); g.moveTo(8, y); g.lineTo(32, y - 22); g.lineTo(56, y); g.stroke(); } return new THREE.CanvasTexture(c); })();
function addPad(dist, lat) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 4.2), new THREE.MeshBasicMaterial({ map: chevTex, transparent: true, opacity: 0.95 }));
  place(m, dist, lat, 0.1); m.rotateX(-Math.PI / 2); m.rotateZ(Math.PI); scene.add(m); pads.push({ dist, lat, mesh: m });
}

// ---------------------------------------------------------------- race flow
let state = 'boot', raceT = 0, finishT = 0, lightsT = 0, lightsN = 0, autoT = 0, finishers = 0, lastLeaderLap = 0, flagDone = false, results = null;
function toPracticeOrGrid() { if (agentRacers().length) toGrid(); else toPractice(); }
function toPractice() { state = 'practice'; hideAll(); you.mode = 'race'; $('wait').hidden = isDemo(); }
function hideAll() { for (const id of ['setup', 'results', 'garage', 'todayP']) $(id).hidden = true; $('lightsHud').style.display = 'none'; }
function toGrid() {
  state = 'grid'; hideAll(); $('wait').hidden = true; slow = 1; slowCam = false; cut = null;
  if (podium) { scene.remove(podium); podium = null; }
  oils.forEach(o => scene.remove(o.mesh)); oils.length = 0; pads.forEach(o => scene.remove(o.mesh)); pads.length = 0;
  for (const r of racers) Object.assign(r, { finished: false, finishPos: 0, bonus: 0, wear: 0, damage: 0, forced: false, spinT: 0, boostT: 0, turboT: 0, drsT: 0, padT: 0, v: 0, mode: r.waiting ? 'stopped' : 'race', pitCall: r.waiting, stopT: r.waiting ? 1e9 : 0 });
  for (const r of racers) if (r.waiting) { r.dist = pitS(TR, garageR(r)); r.lat = TR.inside * (W / 2 + 10); showCrew(r, true); }
  gridUp(); renderSetup(); autoT = 12; boostTokens = 1;
}
function gridUp() {
  const order = [...agentRacers()].sort((a, b) => b.act - a.act).concat([you]);
  order.forEach((r, i) => { if (r.mode === 'stopped') return; r.dist = -6 - i * 7; r.laneI = i % 2 ? 2 : 1; r.lat = LANES[r.laneI]; r.v = 0; });
}
function lightsOut() {
  if (!agentRacers().length) return;
  rollToday(); saveP(); state = 'lights'; hideAll(); lightsT = 0; lightsN = 0; $('lightsHud').style.display = 'flex'; $('lightsHud').classList.remove('go');
  [...$('lightsHud').children].forEach(i => i.classList.remove('on')); VEN.lights.forEach(l => { l.material.emissive.set('#000000'); l.material.color.set('#331111'); });
}
function go() {
  state = 'race'; raceT = 0; finishT = 0; finishers = 0; lastLeaderLap = 0; flagDone = false; boostTokens = 1;
  $('lightsHud').classList.add('go'); setTimeout(() => { $('lightsHud').style.display = 'none'; }, 900);
  VEN.lights.forEach(l => { l.material.emissive.set('#000000'); l.material.color.set('#113311'); });
  tone(880, 0.35, 'square', 0.06, 1); ticker('LIGHTS OUT', 'and away we go', '#3cff7a');
  for (const r of racers) if (!r.you) r.v = 3 + r.act;
}
function order() {
  const parked = r => state !== 'race' && r.mode === 'stopped' ? 1 : 0;
  return [...racers].sort((a, b) => (parked(a) - parked(b)) || (b.finished - a.finished) || (a.finished ? a.finishPos - b.finishPos : b.dist - a.dist));
}
function endRace() {
  state = 'results'; slow = 1; slowCam = false; cut = null;
  const ord = order().filter(r => r.dist > 0 || r.finished);
  const res = ord.map((r, i) => ({ name: r.rival && RV ? `${RV.flag} ${RV.name} · ${r.name}` : r.name, rival: !!r.rival, color: r.color, you: r.you, pos: i + 1, pts: (POINTS[i] || 0) + r.bonus, bonus: r.bonus, laps: Math.min(P.laps, Math.floor(Math.max(0, r.dist) / TR.L)), dnf: !r.finished }));
  const before = new Set(LIVERIES.filter(unlockedLivery).map(l => l.id).concat(TRACKS.filter(unlockedTrack).map(t => t.id)));
  P.races++; P.raceInSeason++; rollToday(); P.today.races++;
  const me = res.find(x => x.you);
  for (const x of res) if (!x.rival) P.standings[x.name] = (P.standings[x.name] || 0) + x.pts;   // the rival's cars race, but don't join your season table
  const duel = RV && res.some(x => x.rival) ? { me: res.filter(x => !x.rival).reduce((a, x) => a + x.pts, 0), them: res.filter(x => x.rival).reduce((a, x) => a + x.pts, 0), name: RV.name, flag: RV.flag, color: RV.color, sim: RV.sim } : null;
  if (me) { if (me.pos === 1) P.wins++; if (me.pos <= 3) P.podiums++; P.today.pts += me.pts; P.today.best = P.today.best ? Math.min(P.today.best, me.pos) : me.pos; }
  P.lastPodium = res.slice(0, 3).map(x => ({ name: x.name, color: x.color }));
  let champ = null;
  if (P.raceInSeason >= PER_SEASON) {
    champ = Object.entries(P.standings).sort((a, b) => b[1] - a[1])[0];
    P.lastChamp = champ ? champ[0] : ''; if (champ && champ[0] === 'YOU') P.titles++;
  }
  const standingsNow = Object.entries(P.standings).sort((a, b) => b[1] - a[1]);
  if (champ) { P.season++; P.raceInSeason = 0; P.standings = {}; }
  const after = LIVERIES.filter(unlockedLivery).map(l => l.id).concat(TRACKS.filter(unlockedTrack).map(t => t.id));
  const fresh = after.filter(x => !before.has(x)).map(id => (LIVERIES.find(l => l.id === id) || {}).name ? `livery ${LIVERIES.find(l => l.id === id).name}` : `track ${TRACKS.find(t => t.id === id).name}`);
  saveP();
  if (!isDemo() && B) B.submit(P.today.pts);
  results = { res, standingsNow, champ, fresh, duel, season: champ ? P.season - 1 : P.season, race: champ ? PER_SEASON : P.raceInSeason };
  if (duel) setTimeout(() => ticker(duel.me >= duel.them ? 'YOUR TEAM WINS THE DUEL RACE' : `${duel.flag} ${duel.name.toUpperCase()}'S TEAM TAKES IT`, `${duel.me} – ${duel.them} team points`, duel.me >= duel.them ? '#ffd23f' : duel.color === SIM_COL ? '#e8ecf4' : duel.color, 0.8), 700);
  buildPodium(res.slice(0, 3));
  setTimeout(renderResults, 1300);
  [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.06, 1), i * 110));
}

// ---------------------------------------------------------------- 3D podium
function buildPodium(top) {
  if (podium) scene.remove(podium);
  podium = new THREE.Group();
  const f = frameAt(TR, pitS(TR, 90), newFrame());
  const far = []; for (let i = 0; i < TR.NS; i += 3) far.push(TR.P[i]);
  let base = null;
  for (let off = 60; off < 200 && !base; off += 8) for (const sg of [-TR.inside, TR.inside]) {
    const c = f.p.clone().addScaledVector(f.s, sg * off); if (far.every(p => (p.x - c.x) ** 2 + (p.z - c.z) ** 2 > 40 * 40)) { base = c; break; }
  }
  base = base || TR.centre.clone(); base.y = 0;
  podium.position.copy(base);
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(11, 12, 0.6, 40), mat('#2b2d42')); plat.position.y = 0.3; plat.receiveShadow = true; podium.add(plat);
  [[0, 3.0, '#ffd23f', 1], [-6.4, 2.1, '#dfe4ee', 2], [6.4, 1.5, '#e0965a', 3]].forEach(([x, h, col, n], i) => {
    const blk = new THREE.Mesh(rounded(6, h, 6, 0.3), mat(col)); blk.position.set(x, 0.6 + h / 2, 0); blk.castShadow = blk.receiveShadow = true; podium.add(blk);
    const num = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.5), new THREE.MeshBasicMaterial({ map: signTex(String(n), col, '#1b1408', 128, 64), transparent: true })); num.position.set(x, 0.6 + h / 2, 3.02); podium.add(num);
    const t = top[i]; if (!t) return;
    const car = makeCar(t.color, '#ffffff', { scale: 0.9 }); car.g.position.set(x, 0.6 + h, -0.2); car.g.rotation.y = 0.5 - i * 0.5; podium.add(car.g);
    const man = stickman(t.color, '#ffd7ba', 1.1); man.position.set(x + 1.6, 0.6 + h, 1.8); man.userData.jump = i; podium.add(man);
    const tag = makeTag(t.name, t.color); tag.position.set(x, 0.6 + h + 3.4, 0); tag.scale.set(6, 1.55, 1); podium.add(tag);
  });
  scene.add(podium); confetti(scene, base.clone().setY(8), 90);
}

// ---------------------------------------------------------------- panels
function chip(label, on, dis, data, sw = '') { return `<button class="chip" aria-pressed="${on}" ${dis ? 'disabled' : ''} ${data}>${sw ? `<span class="sw" style="background:${sw}"></span>` : ''}${label}</button>`; }
function renderSetup() {
  const el = $('setup'); el.hidden = false;
  const tr = TRACKS.map(t => chip(unlockedTrack(t) ? t.name : '🔒 ' + t.name, t.id === P.track, !unlockedTrack(t), `data-track="${t.id}" title="${t.needTxt}"`)).join('');
  const ty = Object.entries(TYRES).map(([k, t]) => chip(t.name, k === P.tyre, false, `data-tyre="${k}"`, t.col)).join('');
  const lp = [3, 5].map(n => chip(n + ' laps', n === P.laps, false, `data-laps="${n}"`)).join('');
  const lv = LIVERIES.map(l => chip(unlockedLivery(l) ? l.name : '🔒', l.id === P.livery, !unlockedLivery(l), `data-liv="${l.id}" title="${l.txt}"`, l.c1)).join('');
  el.innerHTML = `<h2>RACE ${P.raceInSeason + 1} · SEASON ${P.season}</h2><p class="sub">${ownRacers().length} agent car${ownRacers().length === 1 ? '' : 's'} on the grid${isDemo() ? ' (demo team)' : ''}. You are their race engineer, and you drive car YOU.</p>
    ${RV ? `<p class="sub" style="color:${RV.sim ? '#e8ecf4' : RV.color}">⚔️ Duel: ${RV.flag} <b>${esc(RV.name)}</b>'s team lines up with ${racers.filter(r => r.rival).length} car${racers.filter(r => r.rival).length === 1 ? '' : 's'}: ${racers.filter(r => r.rival).map(r => esc(r.name)).join(', ')}${RV.sim ? ' (simulated rival)' : !RV.online ? ' (offline)' : ''}.</p>` : ''}
    <h3>TRACK</h3><div class="chips">${tr}</div><h3>TYRE STRATEGY</h3><div class="chips">${ty}</div><p class="sub" style="font-size:14px">${TYRES[P.tyre].about}</p>
    <h3>DISTANCE</h3><div class="chips">${lp}</div><h3>YOUR LIVERY</h3><div class="chips">${lv}</div>
    <button class="big" id="bGo">LIGHTS OUT <span id="auto"></span></button>`;
  el.onclick = ev => {
    const b = ev.target.closest('button'); if (!b || b.disabled) return; autoT = 20;
    if (b.dataset.track && b.dataset.track !== P.track) { P.track = b.dataset.track; loadTrack(P.track); assignSlots(); gridUp(); }
    if (b.dataset.tyre) P.tyre = b.dataset.tyre;
    if (b.dataset.laps) P.laps = +b.dataset.laps;
    if (b.dataset.liv) { P.livery = b.dataset.liv; buildYou(); gridUp(); }
    if (b.id === 'bGo') { saveP(); lightsOut(); return; }
    saveP(); renderSetup();
  };
}
function rankLine() { const p = B && B.profile(); if (!p || isDemo()) return ''; let rk = null; try { rk = JSON.parse(localStorage.getItem('board_rank_' + GAME)); } catch (e) {} return `${flag(p.country)} ${p.name}${rk ? ` · #${rk} today` : ''}`; }
function renderResults() {
  if (state !== 'results' || !results) return;
  const { res, standingsNow, champ, fresh, season, race, duel } = results, el = $('results'); el.hidden = false;
  const me = res.find(x => x.you), pod = [res[1], res[0], res[2]];
  const hs = [40, 56, 30];
  el.innerHTML = `<button class="x" id="rx">✕</button><h2>🏁 CHEQUERED FLAG</h2><p class="sub">${theme.name} · race ${race} of ${PER_SEASON}, season ${season}${me ? ` · you finished <b>P${me.pos}</b> (+${me.pts} pts)` : ''}${rankLine() ? `<span class="rk">${rankLine()}</span>` : ''}</p>
    ${duel ? `<div class="duelres" style="--rc:${duel.color}"><span>⚔️ TEAM BATTLE</span><b class="${duel.me >= duel.them ? 'w' : ''}">YOUR TEAM ${duel.me}</b><i>–</i><b class="${duel.them > duel.me ? 'w' : ''}">${duel.them} ${duel.flag} ${esc(duel.name)}</b>${duel.sim ? '<small>simulated rival</small>' : ''}</div>` : ''}
    <div class="pod">${pod.map((x, i) => x ? `<div><span style="color:${x.color}">●</span> ${esc(x.name)}<i style="height:${hs[i]}px;background:${['#dfe4ee', '#ffd23f', '#e0965a'][i]}">${[2, 1, 3][i]}</i></div>` : '<div></div>').join('')}</div>
    <div class="cols"><div><h3>RESULT</h3><table class="tbl">${res.map(x => `<tr${x.you ? ' style="color:#ffd23f"' : ''}><td class="r">${x.pos}</td><td><span class="sw" style="background:${x.color}"></span>${esc(x.name)}${x.dnf ? ' <small style="opacity:.6">(not classified)</small>' : ''}</td><td class="r">${x.bonus ? `<small style="color:#c08bff">+${x.bonus} purple</small> ` : ''}+${x.pts}</td></tr>`).join('')}</table></div>
    <div>${champ ? `<div class="unl">🏆 SEASON ${season} CHAMPION: ${champ[0]} (${champ[1]} pts)</div>` : ''}
    <h3>CHAMPIONSHIP${champ ? ' (FINAL)' : ''}</h3><table class="tbl">${standingsNow.slice(0, 6).map(([n, p], i) => `<tr${n === 'YOU' ? ' style="color:#ffd23f"' : ''}><td class="r">${i + 1}</td><td>${n}</td><td class="r">${p}</td></tr>`).join('')}</table></div></div>
    ${fresh.length ? `<div class="unl">Unlocked: ${fresh.join(', ')}</div>` : ''}
    <div style="display:flex;gap:8px"><button class="ghost" id="rShare" style="flex:1;margin-top:12px">📤 Share</button><button class="ghost" id="rBoard" style="flex:1;margin-top:12px">🏆 World board</button></div>
    <button class="big" id="rNext">NEXT RACE</button>`;
  $('rx').onclick = () => { el.hidden = true; };
  $('rShare').onclick = share; $('rBoard').onclick = () => B.open();
  $('rNext').onclick = () => toPracticeOrGrid();
  autoT = 25;
}
function renderGarage() {
  const el = $('garage'); el.hidden = false;
  const st = Object.entries(P.standings).sort((a, b) => b[1] - a[1]);
  el.innerHTML = `<button class="x" data-c>✕</button><h2>🔧 GARAGE</h2><p class="sub">Season ${P.season}, race ${P.raceInSeason} of ${PER_SEASON}${P.lastChamp ? ` · last champion: ${P.lastChamp}` : ''}</p>
    <h3>CHAMPIONSHIP</h3>${st.length ? `<table class="tbl">${st.map(([n, p], i) => `<tr${n === 'YOU' ? ' style="color:#ffd23f"' : ''}><td class="r">${i + 1}</td><td>${n}</td><td class="r">${p}</td></tr>`).join('')}</table>` : '<p class="sub">No points yet this season.</p>'}
    <h3>YOUR RECORD</h3><div class="stat"><div><b>${P.races}</b>races</div><div><b>${P.wins}</b>wins</div><div><b>${P.podiums}</b>podiums</div><div><b>${P.titles}</b>titles</div><div><b>${P.career.tests}</b>tests passed</div><div><b>${P.career.deploys}</b>deploys</div></div>
    <h3>LIVERIES</h3><div class="chips">${LIVERIES.map(l => chip((unlockedLivery(l) ? '' : '🔒 ') + l.name + (unlockedLivery(l) ? '' : ` · ${l.txt}`), l.id === P.livery, !unlockedLivery(l), `data-liv="${l.id}"`, l.c1)).join('')}</div>
    <h3>TRACKS</h3><div class="chips">${TRACKS.map(t => chip((unlockedTrack(t) ? '' : '🔒 ') + t.name + (unlockedTrack(t) ? '' : ` · ${t.needTxt}`), t.id === P.track, !unlockedTrack(t), '')).join('')}</div>`;
  el.onclick = ev => { const b = ev.target.closest('button'); if (!b) return; if (b.dataset.c !== undefined) { el.hidden = true; return; } if (b.dataset.liv && !b.disabled) { P.livery = b.dataset.liv; saveP(); buildYou(); if (state === 'grid') { gridUp(); renderSetup(); } renderGarage(); } };
}
function renderToday() {
  const el = $('todayP'); el.hidden = false; rollToday();
  const s = todayS;
  el.innerHTML = `<button class="x" data-c>✕</button><h2>📅 TODAY</h2><p class="sub">${isDemo() ? 'Demo team. Connect your agents to race your real day.' : 'What your agents did today, and how your team raced.'}${rankLine() ? `<span class="rk">${rankLine()}</span>` : ''}</p>
    <div class="stat"><div><b>${s.tools}</b>tool calls</div><div><b>${s.ok}</b>worked</div><div><b>${s.fail}</b>spins</div><div><b>${s.tests}</b>tests passed</div><div><b>${s.commits}</b>commits</div><div><b>${s.deploys}</b>deploys</div>
    <div><b>${fmtK(s.tokens)}</b>tokens</div><div><b>${s.agents.size}</b>agents</div><div><b>${P.today.pts}</b>your points</div></div>
    <p class="sub" style="margin-top:10px">Races today: ${P.today.races}${P.today.best ? ` · best finish P${P.today.best}` : ''}</p>
    <button class="big" id="tShare">📤 SHARE MY AGENTS' DAY</button>`;
  el.onclick = ev => { const b = ev.target.closest('button'); if (!b) return; if (b.dataset.c !== undefined) el.hidden = true; if (b.id === 'tShare') share(); };
}
const fmtK = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n);

// ---------------------------------------------------------------- share card (1200×630)
async function share() {
  renderer.render(scene, camera);
  const c = document.createElement('canvas'); c.width = 1200; c.height = 630; const g = c.getContext('2d');
  const sw = renderer.domElement.width, sh = renderer.domElement.height, sc = Math.max(1200 / sw, 630 / sh);
  g.fillStyle = '#10121f'; g.fillRect(0, 0, 1200, 630);
  g.drawImage(renderer.domElement, (1200 - sw * sc) / 2, (630 - sh * sc) / 2, sw * sc, sh * sc);
  const gr = g.createLinearGradient(380, 0, 1200, 0); gr.addColorStop(0, 'rgba(14,16,32,0)'); gr.addColorStop(0.35, 'rgba(14,16,32,.88)'); gr.addColorStop(1, 'rgba(14,16,32,.95)');
  g.fillStyle = gr; g.fillRect(0, 0, 1200, 630);
  g.fillStyle = '#ff3b5c'; g.fillRect(0, 0, 1200, 10);
  g.textAlign = 'left'; g.fillStyle = '#ffd23f'; g.font = '64px "Russo One",sans-serif'; g.fillText('LAPWISE', 640, 92);
  g.fillStyle = '#fff'; g.font = '700 30px "Saira Condensed",sans-serif'; g.fillText('MY AI AGENTS TODAY', 642, 132);
  const p = B && B.profile(); let rk = null; try { rk = JSON.parse(localStorage.getItem('board_rank_' + GAME)); } catch (e) {}
  if (p && !isDemo()) { g.font = '700 30px "Saira Condensed",system-ui'; g.fillStyle = '#9dffc8'; g.fillText(`${flag(p.country)} ${p.name}${rk ? `  ·  #${rk} in the world today` : ''}`, 642, 170); }
  const s = todayS, stats = [[s.tools, 'tool calls'], [s.tests, 'tests passed'], [s.commits, 'commits'], [s.deploys, 'deploys'], [fmtK(s.tokens), 'tokens'], [P.today.pts, 'race points']];
  stats.forEach(([v, l], i) => { const x = 642 + (i % 3) * 182, y = 240 + Math.floor(i / 3) * 104; g.fillStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.roundRect(x, y - 52, 168, 90, 14); g.fill(); g.fillStyle = '#ffd23f'; g.font = '44px "Russo One"'; g.fillText(String(v), x + 14, y); g.fillStyle = '#dcdcea'; g.font = '700 22px "Saira Condensed"'; g.fillText(l, x + 14, y + 28); });
  let pod = (results && results.res.slice(0, 3)) || (P.lastPodium && P.lastPodium.length ? P.lastPodium : null), head = `LAST RACE · ${theme.name.toUpperCase()}`;
  if (!pod) { pod = order().slice(0, 3); head = `ON TRACK NOW · ${theme.name.toUpperCase()}`; }
  g.fillStyle = '#fff'; g.font = '700 26px "Saira Condensed"'; g.fillText(head, 642, 470);
  pod.forEach((x, i) => { g.fillStyle = x.color; g.fillRect(642, 488 + i * 38, 10, 28); g.fillStyle = '#fff'; g.font = '700 28px "Saira Condensed"'; g.fillText(`P${i + 1}  ${x.name}`, 664, 512 + i * 38); });
  g.fillStyle = 'rgba(255,255,255,.6)'; g.font = '700 22px "Saira Condensed"'; g.textAlign = 'right'; g.fillText('riffcade.com', 1170, 608);
  const blob = await new Promise(res => c.toBlob(res, 'image/png'));
  const file = new File([blob], 'lapwise-my-agents-today.png', { type: 'image/png' });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) return await navigator.share({ files: [file], title: 'My AI agents today', text: 'My AI agents raced today on Lapwise', url: location.href.split('?')[0] }); } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
window.__share = share;

// ---------------------------------------------------------------- input
let camMode = 'chase';
function steer(d) { if (!you || you.mode !== 'race' || !(state === 'race' || state === 'practice')) return; you.laneI = clamp(you.laneI + d, 0, 3); tone(600 + d * 40, 0.04, 'sine', 0.04, 1.2); }
function boostSel() {
  const r = selected && !selected.rival ? selected : you; if (!r || boostTokens < 1 || state !== 'race') return;
  boostTokens--; r.boostT = 4; r.v += 4; ticker(`ENGINEER BOOST → ${r.name}`, 'one token per lap', '#ffd23f', 0.8); tone(440, 0.3, 'sawtooth', 0.05, 2);
}
function pitSel() { const r = selected && !selected.rival ? selected : you; if (!r || state !== 'race' || r.pitCall || r.mode !== 'race') return; r.pitCall = true; ticker(`${r.name}: BOX BOX`, 'pit call: new tyres, repairs', '#ff3b5c', 0.8); tone(520, 0.08, 'square', 0.05, 1); setTimeout(() => tone(520, 0.08, 'square', 0.05, 1), 140); }
$('sL').onpointerdown = e => { e.stopPropagation(); steer(-1); };
$('sR').onpointerdown = e => { e.stopPropagation(); steer(1); };
$('bBoost').onclick = boostSel; $('bPit').onclick = pitSel;
$('bCam').onclick = () => { camMode = { chase: 'tv', tv: 'heli', heli: 'chase' }[camMode]; toast('Camera: ' + { chase: 'chase cam', tv: 'TV cam', heli: 'helicopter' }[camMode], 1500); };
$('bToday').onclick = renderToday; $('bGarage').onclick = renderGarage; $('bShare').onclick = share; $('bConnect').onclick = () => A.open(); $('bBoard').onclick = () => B.open();
$('banner').onclick = () => { const r = racers.find(x => x.waiting && !x.you && !x.rival); if (r) { selected = r; cut = { r, t: 3 }; } };
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') steer(-1);
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') steer(1);
  if (e.key === ' ') { e.preventDefault(); boostSel(); }
  if (e.key === 'p' || e.key === 'P') pitSel();
  if (e.key === 'c' || e.key === 'C') $('bCam').onclick();
  if (e.key === 'Enter' && state === 'grid') lightsOut();
});
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
input({
  onTap(e) {
    if (e.target !== renderer.domElement) return;
    ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(racers.map(r => r.car.g), true);
    if (hits.length) { let o = hits[0].object; const r = racers.find(r => { let x = o; while (x) { if (x === r.car.g) return true; x = x.parent; } return false; }); if (r) { selected = r; tone(700, 0.05, 'sine', 0.05, 1.2); } }
    else {
      // tapping screen edges steers on phones
      if (e.clientX < innerWidth * 0.3) steer(-1); else if (e.clientX > innerWidth * 0.7) steer(1);
    }
  },
  onSwipe(dir, dx, dy) { if (dir === 'left') steer(-1); if (dir === 'right') steer(1); },
});
$('rows').addEventListener('pointerdown', e => { const row = e.target.closest('.row'); if (row) { selected = byId.get(row.dataset.id) || null; tone(700, 0.05, 'sine', 0.05, 1.2); } });

// ---------------------------------------------------------------- simulation
function engineTarget(r) {
  // a rival car always has a little pace (their team is "on track" even between events); offline = slow default play
  const act = r.rival ? Math.max(r.act, r.offline ? 0.12 : 0.3) : r.act;
  return (9 + 6.4 * Math.min(act, 4.2)) * (0.85 + 0.2 * (r.rival ? 0.7 : r.fuel));
}
function tyreF(r) { const t = TYRES[P.tyre]; return t.mult * (1 - 0.35 * clamp(r.wear - 0.4, 0, 1)); }
function teamRate() { return teamRes.length ? teamRes.filter(Boolean).length / teamRes.length : 0.85; }
const pitR = s => (((s + PIT.before) % TR.L) + TR.L) % TR.L;
const garageR = r => PIT.garage0 + r.slot * PIT.slot;

function updateRacer(r, sec) {
  // event queue: spread bursts so every tool result is visible
  r.qT -= sec;
  while (r.q.length && r.qT <= 0) { const { e, partner } = r.q.shift(); applyEvent(r, e, partner); r.qT += 0.14; }
  if (r.qT < 0) r.qT = 0;
  r.act *= Math.exp(-sec / 7);
  for (const k of ['boostT', 'turboT', 'drsT', 'padT', 'purpleT', 'wobT']) r[k] = Math.max(0, (r[k] || 0) - sec);
  const moving = state === 'race' || state === 'practice' || (state === 'results');
  if (!moving) { place(r.car.g, r.dist, r.lat, 0); idleRev(r, sec); return; }
  if (state === 'race' || state === 'practice') r.fuel = Math.max(0, r.fuel - 0.012 * sec);
  // target speed
  let tgt;
  if (r.you) {
    const ag = ownRacers(); const base = ag.length ? ag.reduce((a, x) => a + engineTarget(x), 0) / ag.length : 17;
    tgt = Math.max(11, base) * (0.92 + 0.36 * teamRate());
  } else tgt = engineTarget(r) * (1 + 0.06 * r.partners);
  tgt *= tyreF(r) * (1 - 0.07 * r.damage);
  if (r.boostT > 0) tgt *= 1.4; if (r.turboT > 0) tgt *= 1.35; if (r.drsT > 0) tgt *= 1.28; if (r.padT > 0) tgt *= 1.45; if (r.draft > 0) tgt *= 1.12; if (r.wobT > 0) tgt *= 0.6;
  if (r.finished || state === 'results') tgt = Math.min(tgt, 12);
  // pit lane
  const pr = pitR(r.dist);
  if (r.mode === 'race' && r.pitCall && state !== 'grid' && pr < 4 && r.prevPr > TR.L - 20) { r.mode = 'pitIn'; }
  if (r.mode === 'pitIn') { tgt = Math.min(tgt, 18); if (pr >= garageR(r) - 0.5) { r.mode = 'stopped'; r.v = 0; r.stopT = r.waiting ? 1e9 : r.forced ? 4.5 : 2.6; showCrew(r, true); } }
  if (r.mode === 'stopped') { tgt = 0; r.v = 0; r.stopT -= sec; if (r.waiting) r.stopT = Math.max(r.stopT, 0.5); if (r.stopT <= 0) { r.mode = 'pitOut'; r.wear = 0; r.damage = 0; r.forced = false; r.pitCall = false; showCrew(r, false); if (state === 'race') ticker(`${nm(r)} OUT`, 'fresh tyres', tcol(r), 0.6); } }
  if (r.mode === 'pitOut') { tgt = Math.min(tgt, 18); if (pr >= PIT.outR - 1 || pr < garageR(r) - 5) r.mode = 'race'; }
  r.prevPr = pr;
  // spin
  if (r.spinT > 0) { r.spinT -= sec; r.spinA += sec * 9; tgt = 2; if (Math.random() < 0.5) puff(r.car.g.position, '#e8e8f0', 1); if (r.spinT <= 0) r.spinA = 0; }
  r.v += (tgt - r.v) * Math.min(1, sec * (tgt < r.v ? 1.6 : 0.9));
  if (r.mode === 'stopped') r.v = 0;
  // traffic: never drive through the car ahead; AI changes lane to pass
  r.draft = 0;
  if (r.mode === 'race' && state !== 'results') {
    let ahead = null, gap = 1e9, drafter = null;
    for (const o of racers) {
      if (o === r || o.mode !== 'race') continue;
      const d = (((o.dist - r.dist) % TR.L) + TR.L) % TR.L;
      if (d > 0 && d < 30 && Math.abs(o.lat - r.lat) < 2.2 && d < gap) { gap = d; ahead = o; }
      if (d > 4 && d < 18 && Math.abs(o.lat - r.lat) < 1.6) drafter = o;
    }
    if (drafter) r.draft = 1;
    if (ahead && gap < 5.2) {
      if (r.v > ahead.v) { const closing = r.v - ahead.v; r.v = ahead.v * 0.97; if (r.you && closing > 3) { shake = 0.4; sparkle(r.car.g.position, '#ffd23f', 12); tone(160, 0.12, 'square', 0.05, 0.6); r.damage = Math.min(4, r.damage + (closing > 12 ? 1 : 0)); } }
    }
    if (!r.you && ahead && gap < 14 && engineTarget(r) >= ahead.v * 0.95) {
      const tryL = [r.laneI - 1, r.laneI + 1].filter(i => i >= 0 && i < 4).sort(() => Math.random() - 0.5);
      for (const li of tryL) { const free = racers.every(o => o === r || Math.abs(o.lat - LANES[li]) > 2 || Math.abs((((o.dist - r.dist) % TR.L) + TR.L) % TR.L) > 9 && Math.abs((((r.dist - o.dist) % TR.L) + TR.L) % TR.L) > 6); if (free) { r.laneI = li; break; } }
    }
  }
  r.dist += r.v * sec;
  // lateral position
  let lt = LANES[r.laneI];
  const pin = TR.inside * (W / 2 + 10);
  if (r.mode === 'pitIn') { const e = clamp(pr / 30, 0, 1); lt = lerp(lt, pin, e * e * (3 - 2 * e)); }
  if (r.mode === 'stopped') lt = pin;
  if (r.mode === 'pitOut') { const e = clamp((PIT.outR - pr) / 30, 0, 1); lt = lerp(lt, pin, e * e * (3 - 2 * e)); }
  r.lat += (lt - r.lat) * Math.min(1, sec * (r.mode === 'race' ? 4 : 6));
  // finish
  if (state === 'race' && !r.finished && r.dist >= P.laps * TR.L) {
    r.finished = true; r.finishPos = ++finishers;
    if (finishers === 1) { finishT = 0; flagDone = true; confetti(scene, r.car.g.position.clone().setY(r.car.g.position.y + 3), 70); ticker(`${nm(r)} WINS!`, theme.name, tcol(r)); shake = 0.6; tone(1046, 0.3, 'triangle', 0.07, 1); setTimeout(() => { slow = 1; slowCam = false; }, 1400); }
  }
  // pose
  const yaw = r.spinT > 0 ? r.spinA : (lt - r.lat) * -0.08 + (r.wobT > 0 ? Math.sin(r.wobT * 22) * 0.35 * r.wobT : 0);
  place(r.car.g, r.dist, r.lat, 0, yaw);
  // visuals
  for (const w of r.car.wheels) w.children[0].rotation.x = w.children[1].rotation.x += r.v * sec / 0.45;
  const fl = Math.max(r.turboT > 0 ? 1.3 : 0, r.padT > 0 ? 1.1 : 0, r.boostT > 0 ? 1 : 0, r.drsT > 0 ? 0.6 : 0);
  r.car.flame.scale.setScalar(Math.max(0.001, fl * (0.8 + Math.random() * 0.45)));
  r.car.flap.rotation.x = lerp(r.car.flap.rotation.x, r.drsT > 0 ? -0.9 : 0, 0.2);
  r.car.glow.material.opacity = lerp(r.car.glow.material.opacity, r.purpleT > 0 ? 0.7 : r.drsT > 0 ? 0.45 : r.boostT > 0 ? 0.5 : 0, 0.15);
  if (r.purpleT > 0) r.car.glow.material.color.set('#b45cff'); else if (r.drsT > 0) r.car.glow.material.color.set('#5cd2ff'); else r.car.glow.material.color.set('#ffd23f');
  r.car.body.position.y = Math.sin(performance.now() / 70 + r.dist) * 0.025 * Math.min(1, r.v / 10);
  if (r.damage >= 2 && Math.random() < 0.06 * r.damage) puff(_v.copy(r.car.g.position).setY(r.car.g.position.y + 0.8), '#5a5a66', 1, 0.8);
  if (Math.abs(F.k) > 0.02 && r.v > 18 && Math.random() < 0.08) puff(r.car.g.position, '#ffffff', 1, 0.6);
  // tag icon
  const st = (r.waiting ? '✋' : r.mode !== 'race' ? '🔧' : r.drsT > 0 ? '💨' : r.turboT > 0 ? '🔥' : r.wobT > 0 ? '💫' : '') + (r.rival ? '|' + r.tag.userData.sub : '');
  if (st !== r.tagState) { r.tagState = st; r.tag.userData.redraw(r.name, r.you ? '#ffd23f' : r.color, st.split('|')[0]); }
  r.tag.material.opacity = r === selected || r.you ? 1 : 0.92;
}
function idleRev(r, sec) {
  r.car.flame.scale.setScalar(state === 'lights' && Math.random() < 0.15 ? 0.4 : 0.001);
  r.car.body.position.y = state === 'lights' ? Math.sin(performance.now() / 30 + r.dist) * 0.03 : 0;
  const st = (r.waiting ? '✋' : '') + (r.rival ? '|' + r.tag.userData.sub : '');
  if (st !== r.tagState) { r.tagState = st; r.tag.userData.redraw(r.name, r.you ? '#ffd23f' : r.color, st.split('|')[0]); }
}
function showCrew(r, on) {
  if (r.crew) { scene.remove(r.crew); r.crew = null; }
  if (!on) return;
  const g = new THREE.Group(); const pr = garageR(r), s = pitS(TR, pr);
  for (let i = 0; i < 3; i++) { const m = stickman(r.color, '#ffd7ba', 1); g.add(m); m.userData.i = i; m.userData.s = s + (i - 1) * 2.6; }
  g.userData.r = r; r.crew = g; scene.add(g);
}
function updatePartners(sec) {
  const count = new Map();
  for (const [k, p] of partners) {
    const lead = p.parent; if (!byId.has(lead.id)) { scene.remove(p.car.g); partners.delete(k); continue; }
    if (p.leaving) { p.fade -= sec * 0.8; p.lat += sec * 3 * Math.sign(p.lat - lead.lat || 1); if (p.fade <= 0) { scene.remove(p.car.g); partners.delete(k); continue; } }
    else count.set(lead, (count.get(lead) || 0) + 1);
    p.wob = Math.max(0, p.wob - sec);
    p.lat += (lead.lat + (p.idx % 2 ? 0.5 : -0.5) * (p.leaving ? 3 : 0.2) - p.lat) * Math.min(1, sec * 3);
    const back = 5 + p.idx * 4.2 + (p.leaving ? (1 - p.fade) * 12 : 0);
    place(p.car.g, lead.dist - back, p.lat, 0, p.wob > 0 ? Math.sin(p.wob * 30) * 0.3 : 0);
    p.car.g.scale.setScalar(0.72 * Math.max(0.05, p.fade));
    for (const w of p.car.wheels) w.children[0].rotation.x += lead.v * sec / 0.4;
  }
  for (const r of racers) r.partners = count.get(r) || 0;
}

// ---------------------------------------------------------------- camera
const camPos = new THREE.Vector3(0, 30, 60), camLook = new THREE.Vector3();
let orbit = 0;
function updateCamera(sec, realSec) {
  let pos = _v.set(0, 0, 0), look = _v2.set(0, 0, 0), k = 1 - Math.exp(-realSec * 5);
  const ph = isPhone();
  if (state === 'results' && podium) {
    orbit += realSec * 0.18; const c = podium.position, R = ph ? 30 : 24;
    pos.set(c.x + Math.cos(orbit) * R, ph ? 9 : 7, c.z + Math.sin(orbit) * R);
    // keep the podium on the free side of the screen (results card sits right on desktop, bottom on phones)
    look.set(c.x, ph ? -1 : 3.2, c.z); if (!ph) { look.x += Math.sin(orbit) * 9; look.z -= Math.cos(orbit) * 9; } k = 1 - Math.exp(-realSec * 2);
  } else if (state === 'grid' || state === 'lights' || state === 'boot') {
    orbit += realSec * 0.12;
    const f = frameAt(TR, -10 + Math.sin(orbit) * 12, F2);
    pos.copy(f.p).addScaledVector(f.s, -TR.inside * (ph ? 4 : 9)).addScaledVector(f.u, ph ? 16 : 11);
    const g = frameAt(TR, ph ? -30 : -22, newFrame()); look.copy(g.p).setY(g.p.y + 1); k = 1 - Math.exp(-realSec * 2.5);
  } else {
    let focus = you, mode = camMode;
    if (cut) { focus = cut.r; mode = 'tv'; }
    if (slowCam) { const lead = order()[0]; focus = lead; mode = 'finish'; }
    if (!focus || !byId.has(focus.id)) focus = you;
    const fp = focus.car.g.position;
    if (mode === 'chase') {
      const back = ph ? 13 : 10.5, up = ph ? 6.2 : 4.4;
      const f = frameAt(TR, focus.dist - back, F2); pos.copy(f.p).addScaledVector(f.s, focus.lat * 0.75).addScaledVector(f.u, up); pos.y += 0.5;
      const g = frameAt(TR, focus.dist + 12, newFrame()); look.copy(g.p).addScaledVector(g.s, focus.lat * 0.6).addScaledVector(g.u, 1.2);
      k = 1 - Math.exp(-realSec * 9);
    } else if (mode === 'tv') {
      let best = null, bd = 1e9; for (const c of VEN.cams) { const d = c.distanceToSquared(fp); if (d < bd) { bd = d; best = c; } }
      pos.copy(best); look.copy(fp); k = camPos.distanceToSquared(best) > 400 ? 1 : 1 - Math.exp(-realSec * 6);
    } else if (mode === 'heli') {
      const f = frameAt(TR, focus.dist - 22, F2); pos.copy(f.p).add(_v.set(0, 0, 0)).addScaledVector(f.u, 30); look.copy(fp);
      k = 1 - Math.exp(-realSec * 4);
    } else if (mode === 'finish') {
      const f = frameAt(TR, P.laps * TR.L + 18, F2); pos.copy(f.p).addScaledVector(f.s, -TR.inside * (W / 2 - 1)).addScaledVector(f.u, 2.4); look.copy(fp).setY(fp.y + 0.8); k = 1;
    }
  }
  camPos.lerp(pos, k); camLook.lerp(look, Math.min(1, k * 1.3));
  camera.position.copy(camPos);
  if (shake > 0) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; shake = Math.max(0, shake - realSec * 1.6); }
  camera.lookAt(camLook);
  const tf = you && state === 'race' ? you.car.g.position : camLook; stage.followLight(tf);
}

// ---------------------------------------------------------------- HUD
let hudT = 0, lastBanner = '';
function updateHud(realSec) {
  hudT -= realSec; if (hudT > 0) return; hudT = 0.2;
  const ord = order(), lead = ord[0];
  const lap = lead && state === 'race' ? clamp(Math.floor(Math.max(0, lead.dist) / TR.L) + 1, 1, P.laps) : 1;
  $('lapN').textContent = state === 'practice' ? '–' : lap; $('lapT').textContent = state === 'practice' ? 'PRACTICE' : P.laps;
  if (state === 'race' && lap > lastLeaderLap) { if (lastLeaderLap > 0) { boostTokens = 1; if (lap === P.laps) ticker('FINAL LAP', 'boost token refreshed', '#fff', 0.8); else ticker(`LAP ${lap}`, 'boost token refreshed', '#fff', 0.7); } lastLeaderLap = lap; }
  const avgV = Math.max(8, racers.reduce((a, r) => a + r.v, 0) / racers.length);
  const ph = isPhone(); let show = ord;
  if (ph && ord.length > 7) { show = ord.slice(0, 6); if (!show.includes(you)) show.push(you); }
  $('rows').innerHTML = show.map(r => {
    const pos = ord.indexOf(r) + 1;
    const gapS = r === lead ? (state === 'race' ? 'LEADER' : '') : r.finished ? 'FIN' : `+${Math.max(0, (lead.dist - r.dist) / avgV).toFixed(1)}`;
    const stt = r.waiting ? ['✋', '#ffd23f', '#1b1408'] : r.mode !== 'race' ? ['PIT', '#ff3b5c', '#fff'] : r.spinT > 0 ? ['SPIN', '#ff8a1f', '#fff'] : r.wobT > 0 ? ['WOBBLE', '#ff8a1f', '#fff'] : r.offline ? ['OFF', '#4a4f66', '#cfd3e0'] : r.drsT > 0 ? ['DRS', '#5cd2ff', '#06202a'] : r.turboT > 0 ? ['TURBO', '#ff8a1f', '#fff'] : r.damage >= 2 ? ['DMG', '#7a2030', '#fff'] : r.partners ? ['+' + r.partners, '#2b2d42', '#fff'] : ['', 'transparent', '#fff'];
    return `<div class="row${r.you ? ' you' : ''}${r.rival ? ' rv' : ''}${r === selected ? ' sel' : ''}${r.purpleT > 0 ? ' purple' : ''}" data-id="${r.id}"${r.rival ? ` style="--rc:${r.color}"` : ''}><span class="p">${pos}</span><span class="c" style="background:${r.color}"></span><span class="n">${esc(rowName(r))}</span><span class="g">${gapS}</span><span class="st" style="background:${stt[1]};color:${stt[2]}">${stt[0]}</span>${r.you || r.rival ? '' : `<span class="fuel"><i style="width:${Math.round(r.fuel * 100)}%"></i></span>`}</div>`;
  }).join('');
  $('kmh').textContent = you ? Math.round(you.v * 7) : 0;
  $('ypos').textContent = state === 'race' || state === 'results' ? 'P' + (ord.indexOf(you) + 1) : state === 'practice' ? 'PRACTICE' : 'GRID';
  $('rate').textContent = Math.round(teamRate() * 100) + '%';
  duelHud();
  const sel = selected && byId.has(selected.id) ? selected : you;
  $('engName').innerHTML = `<span style="color:${sel.color === '#ffffff' ? '#ffd23f' : sel.color}">●</span> ${esc(nm(sel))}${sel === you ? ' (your car)' : sel.rival ? ' <small style="opacity:.7">(rival · ' + (sel.src === 'codex' ? 'Codex' : 'Claude Code') + ')</small>' : ''}`;
  const t = TYRES[P.tyre], wear = Math.round(clamp(1 - Math.max(0, sel.wear - 0.4) * 0.6, 0, 1) * 100);
  $('engInfo').textContent = `${t.name} tyres ${wear}% · damage ${'■'.repeat(sel.damage)}${'□'.repeat(Math.max(0, 4 - sel.damage))}${sel.you || sel.rival ? '' : ` · fuel ${Math.round(sel.fuel * 100)}%`}${sel.pitCall ? ' · boxing' : ''}${sel.rival ? ' · boost/pit only for your team' : ''}`;
  $('tok').textContent = boostTokens; $('bBoost').disabled = boostTokens < 1 || state !== 'race';
  $('bPit').disabled = state !== 'race' || sel.pitCall || sel.mode !== 'race' || (sel.damage === 0 && sel.wear < 0.5);
  const showEng = state === 'race' || state === 'practice';
  $('eng').style.display = showEng ? '' : 'none'; $('sL').style.display = $('sR').style.display = showEng ? '' : 'none';
  $('speedo').style.display = state === 'results' ? 'none' : '';
  const w = racers.filter(r => r.waiting && !r.you && !r.rival);
  const bt = w.length ? `✋ ${w.map(r => r.name).slice(0, 2).join(', ')}${w.length > 2 ? ` +${w.length - 2}` : ''} ${w.length > 1 ? 'are' : 'is'} in the pit, waiting for you` : '';
  if (bt !== lastBanner) { lastBanner = bt; $('banner').hidden = !bt || state === 'results'; $('banner').textContent = bt; }
  $('wait').hidden = !(state === 'practice' && !isDemo());
  const cardOpen = !!document.querySelector('.ag-card:not([hidden])');
  $('setup').style.visibility = cardOpen ? 'hidden' : '';
  if (state === 'grid') { const a = $('auto'); if (a) a.textContent = autoT > 0 && autoT < 11 ? `· ${Math.ceil(autoT)}` : ''; }
}

// ---------------------------------------------------------------- main loop
let pruneT = 0;
loop((dt, t) => {
  if (!TR) return;
  const realSec = dt / 60;
  if (state === 'race' && !flagDone) { const lead = order()[0]; if (lead && lead.dist > P.laps * TR.L - 26 && lead.dist < P.laps * TR.L) { slow = 0.3; slowCam = true; } }
  const sec = realSec * slow;
  cutCool = Math.max(0, cutCool - realSec); if (cut) { cut.t -= realSec; if (cut.t <= 0 || !byId.has(cut.r.id)) cut = null; }
  if (state === 'lights') {
    lightsT += realSec;
    const n = Math.min(5, Math.floor(lightsT / 0.7));
    if (n > lightsN) { lightsN = n; tone(440, 0.18, 'square', 0.05, 1); [...$('lightsHud').children].forEach((el, i) => el.classList.toggle('on', i < n)); VEN.lights.forEach((l, i) => { if (i < n) { l.material.color.set('#ff2a3d'); l.material.emissive.set('#ff1a2a'); } }); }
    if (lightsT > 3.5 + 0.6) go();
  }
  if (state === 'grid') { autoT -= realSec; if (autoT <= 0) lightsOut(); }
  if (state === 'results') { autoT -= realSec; if (autoT <= 0 && $('results').hidden === false) toPracticeOrGrid(); }
  for (const r of [...racers]) updateRacer(r, sec);
  updatePartners(sec);
  if (state === 'race') {
    raceT += sec;
    if (flagDone) finishT += realSec;
    const running = racers.filter(r => !r.finished && r.mode === 'race' && !r.waiting);
    if (flagDone && (!running.length || finishT > 20)) endRace();
    if (!agentRacers().length) toPracticeOrGrid();
  }
  // player hazards
  if (you && (state === 'race' || state === 'practice') && you.mode === 'race') {
    for (const o of oils) if (Math.abs(you.dist - o.dist) < 2.2 && Math.abs(you.lat - o.lat) < 1.9 && !o.hit) { o.hit = true; you.spinT = 0.7; you.v *= 0.55; shake = 0.5; puff(you.car.g.position, '#dddddd', 6); ticker('OIL!', 'a spun car left a slick', '#ff8a1f', 0.7); tone(180, 0.2, 'sawtooth', 0.05, 0.5); }
    for (const p of pads) if (Math.abs(you.dist - p.dist) < 2.6 && Math.abs(you.lat - p.lat) < 1.9 && !p.hit) { p.hit = true; you.padT = 2.4; you.v += 6; shake = 0.3; ticker('TURBO PAD', 'from your team\'s green tests', '#19c3e6', 0.7); tone(520, 0.3, 'sawtooth', 0.05, 2.2); }
  }
  for (let i = oils.length - 1; i >= 0; i--) { const o = oils[i]; o.t -= sec; o.mesh.material.opacity = Math.min(0.85, o.t / 3); if (o.t <= 0) { scene.remove(o.mesh); oils.splice(i, 1); } }
  for (let i = pads.length - 1; i >= 0; i--) { const p = pads[i]; p.mesh.material.opacity = 0.65 + Math.sin(t * 8) * 0.3; if (you.dist - p.dist > 40 || p.hit && you.dist - p.dist > 4) { scene.remove(p.mesh); pads.splice(i, 1); } }
  // smoke
  for (let i = smoke.length - 1; i >= 0; i--) { const o = smoke[i]; o.life -= sec * 0.9; o.s.position.y += o.vy * sec; o.s.scale.setScalar(o.s.scale.x + o.g * sec); o.s.material.opacity = Math.max(0, o.life * 0.6); if (o.life <= 0) { scene.remove(o.s); o.s.material.dispose(); smoke.splice(i, 1); } }
  // crowd + crews + podium people
  crowdHype = Math.max(0, crowdHype - realSec);
  const amp = 0.08 + crowdHype * 0.25, crowd = VEN.crowd;
  if ((t * 60 | 0) % 2 === 0) { VEN.crowdPos.forEach((c, i) => { _m.makeTranslation(c.w.x, c.w.y + Math.max(0, Math.sin(t * 9 + c.ph)) * amp, c.w.z); crowd.setMatrixAt(i, _m); }); crowd.instanceMatrix.needsUpdate = true; }
  for (const r of racers) if (r.crew) r.crew.children.forEach(m => { place(m, m.userData.s, TR.inside * (W / 2 + 12.6), 0, Math.PI); m.run(t * 0.3, 0.2); const wave = Math.sin(t * 10 + m.userData.i) * 0.6; m.armL.rotation.z = r.waiting ? -2.6 + wave * 0.4 : 0; m.armR.rotation.z = r.waiting ? 2.6 - wave * 0.4 : 0; m.position.y += r.waiting ? Math.abs(Math.sin(t * 7 + m.userData.i)) * 0.3 : 0; });
  if (podium) podium.children.forEach(o => { if (o.userData.jump !== undefined) { o.position.y = 0.6 + [3, 2.1, 1.5][o.userData.jump] + Math.abs(Math.sin(t * 6 + o.userData.jump)) * 0.8; o.armL.rotation.z = -2.6; o.armR.rotation.z = 2.6; } });
  // speed lines
  const sp = you ? you.v : 0, boosting = you && (you.padT > 0 || you.boostT > 0 || you.draft);
  $('lines').style.opacity = state === 'race' && camMode === 'chase' && !cut && !slowCam ? clamp((sp - 20) / 22, 0, 0.55) + (boosting ? 0.25 : 0) : 0;
  pruneT -= realSec;
  if (pruneT <= 0) { pruneT = 10; if (!isDemo()) for (const r of agentRacers()) if (Date.now() - r.lastT > 30 * 60e3) removeRacer(r); }
  updateCamera(sec, realSec);
  updateHud(realSec);
});

// ---------------------------------------------------------------- the rival's team, live (duels)
// In a live duel the rival's agents race as real cars: one per agent (max 5), callsign tags, in the rival's colour
// (silver + "simulated" for the house bot). Their finished steps (B.onRival) drive them like your agents drive yours.
const SIM_COL = '#dfe4ec', RIVAL_MAX = 5;
const esc = x => String(x).replace(/[<>&"]/g, '');
let RV = null, rvKey = '', rvFeed = [];
const rvSub = (a, r) => `${r.flag} ${r.name} · ${a.src === 'codex' ? 'Codex' : 'Claude Code'}${r.sim ? ' · SIM' : !r.online ? ' · OFFLINE' : ''}`;
function syncRival() {
  const r = B && B.rival();
  if (!r) { if (RV) { RV = null; rvKey = ''; rvFeed = []; for (const x of racers.filter(x => x.rival)) removeRacer(x); if (state === 'grid') renderSetup(); } return; }
  if (rvKey !== r.key) { for (const x of racers.filter(x => x.rival)) removeRacer(x); rvKey = r.key; rvFeed = []; }
  RV = r;
  const col = r.sim ? SIM_COL : r.color;
  let roster = (r.agents || []).slice(0, RIVAL_MAX);
  if (!roster.length) roster = [{ k: '_crew', name: r.name.slice(0, 10), src: 'claude', state: 'idle' }];   // their team still has a car on the grid
  const keep = new Set(roster.map(a => 'rv:' + a.k));
  let changed = false;
  for (const x of racers.filter(x => x.rival && !keep.has(x.id))) { removeRacer(x); changed = true; }
  for (const a of roster) {
    let x = byId.get('rv:' + a.k);
    if (!x) {
      x = newRacer({ id: 'rv:' + a.k, name: a.name, color: col, c2: r.sim ? '#59606f' : '#14182a', liv: {}, sub: rvSub(a, r) });
      Object.assign(x, { rival: true, rk: a.k, src: a.src, act: 1 });
      if (state === 'race') { const back = Math.min(...racers.filter(o => o !== x).map(o => o.dist)); x.dist = (isFinite(back) ? back : 0) - 12; x.laneI = (Math.random() * 4) | 0; x.lat = LANES[x.laneI]; }
      else if (state === 'practice') x.dist = you ? you.dist + 20 + Math.random() * 40 : 0;
      changed = true;
    }
    x.lastT = Date.now(); x.offline = !r.sim && !r.online; x.src = a.src;
    const sub = rvSub(a, r); if (sub !== x.tag.userData.sub) x.tag.userData.sub = sub;
    if (a.state === 'waiting' && !x.waiting) { x.waiting = true; x.pitCall = true; }
    else if (a.state !== 'waiting' && x.waiting) wake(x);
  }
  if (changed) { if (state === 'grid') { gridUp(); renderSetup(); } else if (state === 'lights') gridUp(); else if (state === 'practice' && agentRacers().length) toGrid(); }
}
function onRivalEvents(list, r) {
  syncRival();
  for (const e of list) {
    const x = byId.get('rv:' + (e.agent && e.agent.k)) || racers.find(o => o.rival);
    if (!x) continue;
    x.lastT = Date.now();
    x.q.push({ e: { kind: 'result', cat: e.cat || 'other', ok: !!e.ok, t: e.t }, partner: null });
    const what = !e.ok ? '✗ step failed → wobble' : { test: '🧪 tests pass → TURBO', commit: '📦 commits → purple sector', deploy: '🚀 deploys → DRS + boost', edit: '✏️ edit → throttle', run: '▶️ run → throttle', read: '🔍 reads → throttle' }[e.cat] || '✓ step → throttle';
    rvFeed.unshift({ t: Date.now(), ok: !!e.ok, txt: `${r.flag} ${r.name}'s ${x.name} ${what}` }); rvFeed.length = Math.min(rvFeed.length, 4);
  }
}
function duelHud() {
  const el = $('duelBox');
  $('tower').classList.toggle('duel', !!RV && !isPhone());
  if (!RV) { if (!el.hidden) el.hidden = true; return; }
  el.hidden = false; el.style.setProperty('--rc', RV.sim ? SIM_COL : RV.color);
  const ord = order(), inRaceNow = state === 'race' || state === 'results';
  let me = 0, th = 0;
  if (inRaceNow) ord.forEach((r, i) => { const p = (POINTS[i] || 0) + r.bonus; if (r.rival) th += p; else me += p; });
  else { me = RV.myScore; th = RV.score; }
  const ags = RV.agents || [], working = ags.filter(a => a.state === 'working').length, waiting = ags.filter(a => a.state === 'waiting').length;
  const st = RV.sim ? `${ags.length} agents · simulated rival` : RV.online ? `🟢 ${working} of ${ags.length} working${waiting ? ` · ✋ ${waiting} waiting` : ''}` : '😴 offline · cruising slowly';
  const fd = rvFeed[0] && Date.now() - rvFeed[0].t < 12e3 ? rvFeed[0] : null;
  el.innerHTML = `<div class="vs"><span class="t">YOU</span><span class="n ${me >= th ? 'w' : ''}">${me}</span><span class="x">${isPhone() ? '⚔️' : inRaceNow ? 'RACE PTS' : '⚡ DUEL'}</span><span class="n ${th > me ? 'w' : ''}">${th}</span><span class="t them">${RV.flag} ${esc(isPhone() ? short(RV.name, 7) : RV.name)}</span></div>
    <div class="st">${st}</div><div class="fd ${fd && !fd.ok ? 'bad' : ''}">${fd ? esc(fd.txt) : RV.online || RV.sim ? 'their agents are on track…' : 'waiting for them to come back online'}</div>`;
}
setInterval(syncRival, 1500);

// ---------------------------------------------------------------- connect + leaderboard
let B = null;
const A = agents({
  game: GAME, title: 'LAPWISE', tagline: 'A 3D grand prix where your AI agents are the cars.', accent: '#ffd23f', demoAgents: 5,
  about: 'Every Claude Code or Codex session is a race car. Working tool calls are throttle, tokens are fuel, failures spin it out, passing tests fire the turbo, commits set purple sectors and deploys open DRS. You are the race engineer, and you drive your own car against them.',
  onEvents: (list, info) => onBatch(list, info),
});
B = board({ game: GAME, label: 'Race points today', A });
B.onRival(onRivalEvents);
window.__B = B;
window.__A = A;
window.__G = { get state() { return state; }, get slowCam() { return slowCam; }, get L() { return TR.L; }, racers, get P() { return P; }, todayS, lightsOut, endRace, share, loadTrack: id => { P.track = id; loadTrack(id); assignSlots(); gridUp(); } };

// boot
rollToday();
loadTrack(P.track); buildYou(); assignSlots();
state = 'practice'; toPractice();
setTimeout(() => { if (state === 'boot') toPractice(); }, 100);
