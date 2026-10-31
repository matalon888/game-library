// Rack Attack v2 (studio lane 20, 2026-10-29) — the same top-down 3D pool, now a tour: 36 hand-made tables in 3 worlds.
// Trick tables (pot everything inside a shot limit, stars for fewer shots) and duels against nine rivals (the v1 8-ball match),
// table gimmicks that arrive one world at a time (posts, order rule, corked pockets, ice, bumpers, mud), a level map, a cue case
// unlocked by stars, a rival collection. Physics is phys.js (shared with the QA solver); levels are levels.js. Plan: DESIGN.md.
import { THREE, createStage, createUI, input, loop, mat, glossy, rounded, burst, confetti, sfx, tone, note, buzz, store, lerp, clamp, rng } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { canvasTex } from './geo.js';
import { W, L, R, XB, ZB, POCKETS, HEAD, FOOT, CG, SG, H, makeWorld, cloneWorld, step, moving, strike, runShot, resolveTrick, spotFor, open } from './phys.js';
import { LEVELS, WORLDS, RIVALS } from './levels.js';
import PARS from './pars.js';

const S = createStage({ fov: 30, shadowSize: 7 });
const { scene, camera, sun, hemi } = S;
sun.intensity = 1.25; hemi.intensity = 1.25;
const sty = document.createElement('style'); sty.textContent = 'body>.hc-card:not(.hc-hidden):not(.dim){padding-top:calc(84px + env(safe-area-inset-top))}body>.hc-card:not(.hc-hidden):not(.dim) h1{display:none}body>.hc-card:not(.hc-hidden):not(.dim) .hint{font-size:17px}'; document.head.appendChild(sty);
const ui = createUI({ title: 'RACK<br>ATTACK', hint: 'Touch to aim · pull the cue to shoot', hand: '🎱', score: false, progress: false });
const save = store('rackattack2');
const F = flow('rackattack');
const B = board({ game: 'rack-attack', label: 'Wins vs CPU', limits: { maxRun: 2, maxPerSec: 0.1 }, mode: 'sum' });
let fk = 1;
document.body.style.setProperty('--bg1', '#3b4f8f'); document.body.style.setProperty('--bg2', '#1d2547'); document.body.style.setProperty('--ui', '#ffb627');
const NL = LEVELS.length;
LEVELS.forEach((lv, i) => { const p = PARS[i + 1]; if (p) { lv.par = p.par; lv.path = p.path; lv.hard = p.slack <= 0.75; } lv.i = i + 1; lv.world = Math.floor(i / 12); });

// ---------------------------------------------------------------- saved progress
const starsOf = () => { const a = save.get('stars', []); while (a.length < NL) a.push(0); return a; };
const totalStars = () => starsOf().reduce((s, x) => s + x, 0);
const unlocked = i => i === 1 || starsOf()[i - 2] > 0;
const nextOpen = () => { const s = starsOf(); for (let i = 0; i < NL; i++) if (!s[i]) return i + 1; return NL; };
const CUES = [
  ['House Cue', '#e8c79a', '#2b1d14', '#ffb627', '#4aa3ff', 0], ['Cherry', '#e86a6a', '#5a1020', '#ffd23f', '#ffffff', 6], ['Mint', '#8fe8c4', '#124a3a', '#ffffff', '#3ab795', 12],
  ['Bubblegum', '#ff9ccf', '#6a1f55', '#ffe066', '#7b5cff', 20], ['Midnight', '#3b4f8f', '#12142e', '#9be7ff', '#ffffff', 30], ['Gold Rush', '#ffd23f', '#6a4a00', '#ffffff', '#ff8c1a', 42],
  ['Ghost', '#f2f4ff', '#8a90b0', '#c9d2ff', '#9be7ff', 54], ['Lava', '#ff7a3a', '#3a0f00', '#ffd23f', '#ff3b3b', 66], ['Neon', '#39ff88', '#10102a', '#ff4dd8', '#ffffff', 78],
  ['Ice Blade', '#bfefff', '#1d4a7a', '#ffffff', '#4aa3ff', 90], ['Royal', '#7b4dff', '#2a1050', '#ffd23f', '#ffffff', 100], ['Rainbow', '#ff5d8f', '#1a1a3a', '#ffd23f', '#3ab795', 108],
].map(([name, shaft, butt, band, tip, need]) => ({ name, shaft, butt, band, tip, need }));
const cueSkin = () => CUES[Math.min(save.get('cue', 0), CUES.length - 1)];

// ---------------------------------------------------------------- DOM
const css = document.createElement('style'); css.textContent = `
.ra-top{position:fixed;top:calc(52px + env(safe-area-inset-top));left:8px;right:8px;display:flex;justify-content:space-between;align-items:center;z-index:7;pointer-events:none;gap:8px}
.ra-top button{pointer-events:auto;width:40px;height:40px;border-radius:14px;border:2px solid rgba(255,255,255,.25);background:rgba(10,14,32,.65);color:#fff;font-size:20px;font-weight:800;font-family:inherit}
.ra-top button:active{transform:scale(.92)}
.ra-top .mid{flex:1;text-align:center;font-weight:800;font-size:15px;line-height:1.1;text-shadow:0 2px 0 rgba(0,0,0,.35)}
.ra-top .mid small{display:block;font-size:11px;opacity:.7;letter-spacing:1px}
.ra-hint{position:fixed;right:10px;top:calc(100px + env(safe-area-inset-top));z-index:7;width:44px;height:44px;border-radius:50%;border:2px solid #ffd23f;background:rgba(10,14,32,.7);font-size:22px;display:none;font-family:inherit}
.ra-hint b{position:absolute;right:-4px;bottom:-4px;background:#ffd23f;color:#1a2040;border-radius:9px;font-size:11px;padding:0 5px}
.ra-info{position:fixed;top:calc(98px + env(safe-area-inset-top));left:8px;right:60px;display:flex;flex-direction:column;align-items:flex-start;gap:5px;z-index:6;pointer-events:none}
.ra-shots{display:flex;gap:4px}
.ra-shots i{width:16px;height:16px;border-radius:50%;background:#ffd23f;border:2px solid #fff6;transition:all .25s}
.ra-shots i.s2{background:#bfc7d9}.ra-shots i.s1{background:#d98a4a}
.ra-shots i.used{opacity:.22;transform:scale(.7)}
.ra-chips{display:flex;gap:3px;flex-wrap:wrap}
.ra-chips b{width:18px;height:18px;border-radius:50%;font-size:10px;line-height:18px;text-align:center;color:#fff;border:1.5px solid #fff8;font-weight:800;text-shadow:0 1px 0 #0006}
.ra-chips b.next{box-shadow:0 0 0 2px #ffd23f,0 0 10px #ffd23f}
.ra-chips b.st{background-image:linear-gradient(#fff 0 22%,transparent 22% 78%,#fff 78%)!important;color:#111;text-shadow:none}
.ra-streak{font-weight:800;font-size:13px;color:#ffd23f;opacity:0;transition:opacity .2s,transform .2s;text-shadow:0 2px 0 #000a}
.ra-streak.on{opacity:1;transform:scale(1.1)}
.ra-hud{position:fixed;top:calc(98px + env(safe-area-inset-top));left:8px;right:8px;display:none;justify-content:space-between;align-items:center;z-index:6;pointer-events:none}
.ra-p{display:flex;align-items:center;gap:6px;background:rgba(10,14,32,.6);border-radius:14px;padding:4px 8px;border:2px solid transparent;transition:all .25s;min-width:140px;position:relative}
.ra-p.r{flex-direction:row-reverse}
.ra-p.on{border-color:#ffb627;box-shadow:0 0 14px rgba(255,182,39,.55);transform:scale(1.04)}
.ra-av{width:30px;height:30px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font-size:19px}
.ra-nm{font-weight:800;font-size:13px;line-height:1.05}
.ra-pips{display:flex;gap:2px;margin-top:2px}
.ra-pips b{width:11px;height:11px;border-radius:50%;background:rgba(255,255,255,.18);position:relative;overflow:hidden}
.ra-pips b.st::after{content:'';position:absolute;left:0;right:0;top:3px;height:5px;background:#fff}
.ra-pips b.gone{opacity:.25}
.ra-say{position:absolute;top:100%;margin-top:4px;right:0;background:#fff;color:#1a2040;font-weight:800;font-size:12px;border-radius:10px;padding:3px 8px;white-space:nowrap;opacity:0;transition:opacity .2s}
.ra-say.on{opacity:1}
.ra-vs{font-weight:800;font-size:15px;opacity:.8}
.ra-pow{position:fixed;left:16px;right:16px;bottom:calc(14px + env(safe-area-inset-bottom));height:56px;z-index:6;pointer-events:none;background:rgba(10,14,32,.55);border-radius:18px;overflow:hidden;border:2px solid rgba(255,255,255,.15)}
.ra-pow i{position:absolute;left:0;top:0;bottom:0;width:0;background:linear-gradient(90deg,#3ddc84,#ffd23f 60%,#ff4d6d)}
.ra-pow .cue{position:absolute;top:24px;height:8px;width:120%;left:22%;border-radius:4px;box-shadow:0 2px 0 rgba(0,0,0,.35);transition:transform .05s}
.ra-pow span{position:absolute;left:0;right:0;top:15px;text-align:center;font-weight:800;font-size:16px;opacity:.85;letter-spacing:1px}
.ra-pow u{position:absolute;top:0;bottom:0;width:3px;background:#ffd23f;display:none;box-shadow:0 0 8px #ffd23f}
.ra-hand{position:fixed;bottom:calc(8px + env(safe-area-inset-bottom));right:22%;font-size:38px;z-index:8;pointer-events:none;display:none;animation:ra-pull 1.4s ease-in-out infinite}
@keyframes ra-pull{0%{transform:translateX(60px);opacity:0}15%{opacity:1}70%{transform:translateX(-90px);opacity:1}100%{transform:translateX(-90px);opacity:0}}
.ra-turn{position:fixed;left:0;right:0;top:calc(148px + env(safe-area-inset-top));text-align:center;z-index:6;pointer-events:none;font-weight:800;font-size:15px;opacity:.95;text-shadow:0 2px 0 #0008}
.ra-tip{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(84px + env(safe-area-inset-bottom));z-index:6;pointer-events:none;background:rgba(255,210,63,.95);color:#1a2040;font-weight:800;font-size:13px;border-radius:12px;padding:5px 12px;opacity:0;transition:opacity .3s;white-space:nowrap}
.ra-tip.on{opacity:1}
.hc-pop{-webkit-text-stroke:6px #1a2040;paint-order:stroke fill}
.ra-ov{position:fixed;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;background:rgba(12,16,40,.78);opacity:0;pointer-events:none;transition:opacity .25s}
.ra-ov.on{opacity:1;pointer-events:auto}
.ra-card{background:linear-gradient(#2c3a78,#1d2650);border:3px solid #ffb627;border-radius:22px;padding:16px 18px;width:min(340px,88vw);text-align:center;box-shadow:0 10px 40px #000a;transform:scale(.9);transition:transform .25s}
.ra-ov.on .ra-card{transform:scale(1)}
.ra-rt{font-weight:800;font-size:30px;letter-spacing:1px;color:#ffd23f;text-shadow:0 3px 0 #0006}
.ra-stars{display:flex;justify-content:center;gap:6px;margin:6px 0}
.ra-stars b{line-height:0;color:#ffffff30;transition:all .3s;transform:scale(.6)}
.ra-stars b.on{color:#ffd23f;transform:scale(1);text-shadow:0 0 14px #ffd23f}
.ra-rl{font-weight:700;font-size:14px;line-height:1.5;min-height:42px}
.ra-rl .ck{display:inline-block;width:12px;height:12px;border-radius:50%;border:2px solid #fff6;margin-right:7px;vertical-align:-1px}.ra-rl .ck.on{background:#7dffb0;border-color:#7dffb0}
.ra-rl .ok{color:#7dffb0}.ra-rl .no{opacity:.55}
.ra-next{margin:8px 0;height:18px;border-radius:9px;background:#0006;position:relative;overflow:hidden}
.ra-next i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#ffd23f,#ff8c1a);width:0;transition:width .8s}
.ra-next span{position:absolute;left:0;right:0;top:0;line-height:18px;font-size:11px;font-weight:800}
.ra-btns{display:flex;gap:8px;margin-top:10px}
.ra-btns button{flex:1;height:46px;border-radius:14px;border:0;font-family:inherit;font-weight:800;font-size:15px;background:#4a5aa8;color:#fff}
.ra-btns button.big{font-size:20px;flex:2.2;background:linear-gradient(#ffd23f,#ff9f1a);color:#1a2040;box-shadow:0 4px 0 #b36b00}
.ra-btns button:active{transform:translateY(2px)}
.ra-map>*{width:100%;max-width:520px;margin-left:auto;margin-right:auto}
.ra-map{background:linear-gradient(#232d5e,#141a3a);flex-direction:column;justify-content:flex-start;align-items:stretch;overflow-y:auto;padding:calc(56px + env(safe-area-inset-top)) 14px 24px}
.ra-mh{display:flex;align-items:center;justify-content:space-between;font-weight:800;font-size:22px}
.ra-mh button{height:40px;min-width:40px;border-radius:12px;border:2px solid #fff3;background:#0005;color:#fff;font-size:18px;font-weight:800;font-family:inherit;padding:0 10px}
.ra-rv{display:flex;gap:6px;margin:8px 0;justify-content:center;flex-wrap:wrap}
.ra-rv span{width:34px;height:34px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;filter:grayscale(1) brightness(.35);border:2px solid #fff3}
.ra-rv span.on{filter:none;border-color:#ffd23f}
.ra-w{margin:12px 0 4px;font-weight:800;font-size:17px;display:flex;justify-content:space-between;align-items:baseline}
.ra-w small{font-size:12px;opacity:.7;font-weight:700}
.ra-g{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.ra-nd{position:relative;height:66px;border-radius:16px;border:2px solid #fff4;background:#2c3a78;color:#fff;font-family:inherit;font-weight:800;font-size:21px;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1}
.ra-nd small{font-size:11px;letter-spacing:1px;margin-top:3px;color:#ffd23f;min-height:12px}
.ra-nd em{position:absolute;top:2px;right:5px;font-size:11px;font-style:normal;opacity:.8}
.ra-nd.d{border-color:#ff8c8c}
.ra-nd.lock{opacity:.4;filter:grayscale(.8)}
.ra-nd.cur{border-color:#ffd23f;animation:ra-pulse 1s ease-in-out infinite;background:#4a5aa8}
@keyframes ra-pulse{50%{transform:scale(1.07);box-shadow:0 0 16px #ffd23f}}
.ra-daily{margin:8px 0 0;height:40px;border-radius:14px;border:2px solid #ffd23f;background:linear-gradient(#4a5aa8,#34428a);color:#fff;font-family:inherit;font-weight:800;font-size:14px}
.ra-daily.done{opacity:.6;border-color:#7dffb0}
.ra-cues{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}
.ra-cq{border-radius:14px;border:2px solid #fff3;background:#2c3a78;padding:8px 4px;font-size:11px;font-weight:800;text-align:center;font-family:inherit;color:#fff}
.ra-cq i{display:block;height:8px;border-radius:4px;margin:6px 4px}
.ra-cq.sel{border-color:#ffd23f;box-shadow:0 0 12px #ffd23f88}
.ra-cq.lock{opacity:.45}
`; document.head.appendChild(css);
const HT = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); const e = d.firstElementChild; document.body.appendChild(e); return e; };
const topEl = HT(`<div class="ra-top"><button data-map aria-label="levels"><svg width="22" height="22" viewBox="0 0 22 22"><path d="M3 5h16M3 11h16M3 17h16" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg></button><div class="mid"></div><button data-retry aria-label="retry"><svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M18 11a7 7 0 1 1-2.2-5.1" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M17 1v6h-6" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>`);
const infoEl = HT(`<div class="ra-info"><div class="ra-shots"></div><div class="ra-chips"></div><div class="ra-streak"></div></div>`);
const hintBtn = HT(`<button class="ra-hint"><svg width="22" height="26" viewBox="0 0 22 26"><path d="M11 2a7 7 0 0 0-4 12.7V18h8v-3.3A7 7 0 0 0 11 2z" fill="#ffd23f"/><rect x="7" y="20" width="8" height="3" rx="1.5" fill="#ffd23f"/></svg><b>3</b></button>`);
const hud = HT(`<div class="ra-hud"><div class="ra-p" data-p="0"><div class="ra-av">😎</div><div><div class="ra-nm">YOU</div><div class="ra-pips"></div></div></div><div class="ra-vs">VS</div><div class="ra-p r" data-p="1"><div class="ra-av" data-av>🤖</div><div style="text-align:right"><div class="ra-nm" data-nm>REX</div><div class="ra-pips"></div></div><div class="ra-say"></div></div></div>`);
const pow = HT('<div class="ra-pow"><i></i><u></u><div class="cue"></div><span>◀ PULL TO SHOOT</span></div>');
const handEl = HT('<div class="ra-hand"><svg width="44" height="44" viewBox="0 0 44 44"><circle cx="22" cy="22" r="16" fill="#fff" opacity=".9"/><circle cx="22" cy="22" r="9" fill="#ffb627"/></svg></div>');
const turnEl = HT('<div class="ra-turn"></div>');
const tipEl = HT('<div class="ra-tip"></div>');
const resEl = HT(`<div class="ra-ov"><div class="ra-card"><div class="ra-rt"></div><div class="ra-stars"><b><svg width="52" height="52" viewBox="0 0 24 24"><path d="M12 2l3 7 7.5.6-5.7 4.9 1.8 7.4L12 18l-6.6 3.9 1.8-7.4L1.5 9.6 9 9z" fill="currentColor"/></svg></b><b><svg width="52" height="52" viewBox="0 0 24 24"><path d="M12 2l3 7 7.5.6-5.7 4.9 1.8 7.4L12 18l-6.6 3.9 1.8-7.4L1.5 9.6 9 9z" fill="currentColor"/></svg></b><b><svg width="52" height="52" viewBox="0 0 24 24"><path d="M12 2l3 7 7.5.6-5.7 4.9 1.8 7.4L12 18l-6.6 3.9 1.8-7.4L1.5 9.6 9 9z" fill="currentColor"/></svg></b></div><div class="ra-rl"></div><div class="ra-next"><i></i><span></span></div><div class="ra-btns"><button data-a="retry">REPLAY</button><button data-a="next" class="big">NEXT<svg width="16" height="16" viewBox="0 0 16 16" style="margin-left:6px;vertical-align:-1px"><path d="M3 1l11 7-11 7z" fill="#1a2040"/></svg></button><button data-a="map">MAP</button></div></div></div>`);
const mapEl = HT(`<div class="ra-ov ra-map"><div class="ra-mh"><span>TOUR</span><span data-stars>★ 0</span><span><button data-cues>CUES</button> <button data-x>X</button></span></div><button class="ra-daily"></button><div class="ra-rv"></div><div class="ra-body"></div></div>`);
const cueEl = HT(`<div class="ra-ov ra-map"><div class="ra-mh"><span>CUE CASE</span><span data-need></span><button data-x>X</button></div><div class="ra-cues"></div></div>`);
const $ = (el, q) => el.querySelector(q);
const STAR_PATH = 'M12 2l3 7 7.5.6-5.7 4.9 1.8 7.4L12 18l-6.6 3.9 1.8-7.4L1.5 9.6 9 9z';
const starSvg = (on, px = 14) => `<svg width="${px}" height="${px}" viewBox="0 0 24 24" style="vertical-align:-2px"><path d="${STAR_PATH}" fill="${on ? '#ffd23f' : '#ffffff40'}"/></svg>`;
const cueGfx = $(pow, '.cue');
function paintCue() { const c = cueSkin(); cueGfx.style.background = `linear-gradient(90deg,${c.butt} 0 8%,${c.shaft} 8% 70%,#f6f1e6 70% 98%,${c.tip} 98%)`; stickMats.shaft.color.set(c.shaft); stickMats.butt.color.set(c.butt); stickMats.band.color.set(c.band); stickMats.tip.color.set(c.tip); }

// ---------------------------------------------------------------- the table (static parts)
const COLORS = { 1: '#ffc61a', 2: '#2f6bff', 3: '#ff3b3b', 4: '#7b4dff', 5: '#ff8c1a', 6: '#16a85a', 7: '#a3243b', 8: '#16161c' };
const colOf = n => COLORS[n > 8 ? n - 8 : n];
const groupOf = n => n === 8 ? 'eight' : n < 8 ? 'solid' : 'stripe';
const FELTS = [['#36d1c4', '#13867f', '#1aa197'], ['#4ab0f0', '#1e5f9e', '#2a7fc0'], ['#a77cf0', '#53288f', '#7a4fc4'], ['#f07c9c', '#8f2853', '#c44f7a'], ['#e8c24a', '#8a6a13', '#c49a2a']];
const feltTexs = FELTS.map(([c0, c1]) => canvasTex(256, 512, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, h * 0.62); gr.addColorStop(0, c0); gr.addColorStop(1, c1);
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 4000; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.03)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, h * 0.75); g.lineTo(w, h * 0.75); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.35)'; for (const y of [0.25, 0.75]) { g.beginPath(); g.arc(w / 2, h * y, 3, 0, 7); g.fill(); }
}));
const feltMat = new THREE.MeshStandardMaterial({ map: feltTexs[0], roughness: 0.95 });
const cushMat = mat(FELTS[0][2], { roughness: 0.8 });
const trim = glossy('#ffb627', { metalness: 0.4, roughness: 0.3 });
{
  const f = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.5, L + 0.5), feltMat);
  f.rotation.x = -Math.PI / 2; f.receiveShadow = true; scene.add(f);
  const wood = glossy('#8b4a2b', { roughness: 0.35 });
  const add = (geo, m, x, y, z, ry = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = true; o.receiveShadow = true; scene.add(o); return o; };
  const cl = L / 2 - CG - SG, cw = 0.2;
  for (const s of [-1, 1]) {
    for (const zs of [-1, 1]) add(rounded(cw, 0.2, cl, 0.06), cushMat, s * (W / 2 + cw / 2 - 0.02), 0.1, zs * (SG + cl / 2));
    add(rounded(W - 2 * CG, 0.2, cw, 0.06), cushMat, 0, 0.1, s * (L / 2 + cw / 2 - 0.02));
  }
  const fw = 0.55, fh = 0.32;
  for (const s of [-1, 1]) {
    add(rounded(fw, fh, L + 0.4 + fw * 2, 0.12), wood, s * (W / 2 + 0.2 + fw / 2), fh / 2, 0);
    add(rounded(W + 0.4, fh, fw, 0.12), wood, 0, fh / 2, s * (L / 2 + 0.2 + fw / 2));
  }
  for (const s of [-1, 1]) for (let i = 1; i < 4; i++) add(new THREE.SphereGeometry(0.05, 8, 6), trim, -W / 2 + i * W / 4, fh, s * (L / 2 + 0.2 + fw / 2));
  for (const s of [-1, 1]) for (const z of [-3 * L / 8, -L / 8, L / 8, 3 * L / 8]) add(new THREE.SphereGeometry(0.05, 8, 6), trim, s * (W / 2 + 0.2 + fw / 2), fh, z);
  const hole = new THREE.MeshBasicMaterial({ color: '#07080c' });
  for (const p of POCKETS) {
    add(new THREE.CylinderGeometry(p.r + 0.02, p.r + 0.02, 0.02, 28), hole, p.x, 0.205, p.z);
    const rim = add(new THREE.TorusGeometry(p.r + 0.06, 0.06, 8, 28, Math.PI * 1.2), trim, p.x, 0.3, p.z);
    rim.rotation.x = -Math.PI / 2; rim.rotation.z = Math.atan2(-p.z, -p.x) + Math.PI - Math.PI * 0.6 + Math.PI;
  }
  const base = add(rounded(W + 2.0, 0.6, L + 2.0, 0.3), mat('#121733'), 0, -0.62, 0); base.castShadow = false;
}

// ---------------------------------------------------------------- balls
function ballTex(n) {
  return canvasTex(256, 128, (g, w, h) => {
    const c = n === 0 ? '#fbf7ee' : colOf(n);
    g.fillStyle = n > 8 ? '#fbf7ee' : c; g.fillRect(0, 0, w, h);
    if (n > 8) { g.fillStyle = c; g.fillRect(0, h * 0.27, w, h * 0.46); }
    if (n === 0) { g.fillStyle = '#ff4d6d'; for (const u of [0.25, 0.75]) { g.beginPath(); g.arc(w * u, h / 2, 6, 0, 7); g.fill(); } return; }
    for (const u of [0.25, 0.75]) {
      g.fillStyle = '#fbf7ee'; g.beginPath(); g.ellipse(w * u, h / 2, 17, 20, 0, 0, 7); g.fill();
      g.fillStyle = '#16161c'; g.font = '800 24px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), w * u, h / 2 + 1);
    }
  });
}
const ballGeo = new THREE.SphereGeometry(R, 28, 18);
const TEX = {}; for (let n = 0; n <= 15; n++) TEX[n] = ballTex(n);
let views = new Map();         // ball number -> { m, sink, pocket }
let world = null;
function makeViews() {
  for (const v of views.values()) { scene.remove(v.m); v.m.material.dispose(); } views = new Map();
  for (const b of world.balls) {
    const m = new THREE.Mesh(ballGeo, new THREE.MeshStandardMaterial({ map: TEX[b.n], roughness: 0.18, metalness: 0.02 }));
    m.castShadow = true; m.position.set(b.x, R + 0.005, b.z);
    m.quaternion.setFromEuler(b.n === 0 ? new THREE.Euler(0, Math.random() * 6, 0) : new THREE.Euler(Math.PI / 2 + (Math.random() - 0.5) * 0.6, 0, Math.random() * 6));
    scene.add(m); views.set(b.n, { m, sink: 0, pocket: null, b });
  }
}

// ---------------------------------------------------------------- table gimmicks (posts, bumpers, corks, ice, mud)
let feat = new THREE.Group(); scene.add(feat);
const postMat = glossy('#cfd6ee', { metalness: 0.3 }), bumpMat = glossy('#ff4d6d', { metalness: 0.2 }), corkMat = glossy('#c58a4a', { roughness: 0.6 });
const zoneMats = { ice: new THREE.MeshBasicMaterial({ color: '#bff3ff', transparent: true, opacity: 0.5, depthWrite: false }), mud: new THREE.MeshBasicMaterial({ color: '#5a3a1a', transparent: true, opacity: 0.55, depthWrite: false }) };
let postViews = [];
function buildFeatures() {
  scene.remove(feat); feat = new THREE.Group(); scene.add(feat); postViews = [];
  for (const z of world.zones) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(z.w, z.h), zoneMats[z.kind]); m.rotation.x = -Math.PI / 2; m.position.set(z.x, 0.004, z.z); m.renderOrder = 1; feat.add(m);
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(z.w, 0.05), new THREE.MeshBasicMaterial({ color: z.kind === 'ice' ? '#ffffff' : '#9a6a3a', transparent: true, opacity: 0.7 })); edge.rotation.x = -Math.PI / 2;
    for (const s of [-1, 1]) { const e = edge.clone(); e.position.set(z.x, 0.006, z.z + s * z.h / 2); feat.add(e); }
  }
  for (const p of world.posts) {
    let m;
    if (p.kind === 'cork') {
      m = new THREE.Mesh(new THREE.CylinderGeometry(p.r - 0.04, p.r, 0.34, 24), corkMat); m.position.set(p.x, 0.17, p.z);
      const cap = new THREE.Mesh(new THREE.CircleGeometry(p.r - 0.1, 24), mat('#9a6330')); cap.rotation.x = -Math.PI / 2; cap.position.y = 0.175; m.add(cap);
    } else if (p.kind === 'bumper') {
      m = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r + 0.04, 0.44, 24), bumpMat); m.position.set(p.x, 0.22, p.z);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(p.r * 0.95, 0.04, 8, 24), trim); ring.rotation.x = Math.PI / 2; ring.position.y = 0.2; m.add(ring);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(p.r * 0.55, p.r * 0.7, 0.08, 20), mat('#fff3b0')); top.position.y = 0.25; m.add(top);
    } else {
      m = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r, 0.44, 24), postMat); m.position.set(p.x, 0.22, p.z);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(p.r * 0.9, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), postMat); cap.position.y = 0.22; m.add(cap);
    }
    m.castShadow = true; feat.add(m); postViews.push({ p, m, pulse: 0, y: m.position.y });
  }
}

// ---------------------------------------------------------------- cue stick + guides
const stick = new THREE.Group(); scene.add(stick);
const stickMats = { shaft: glossy('#e8c79a'), butt: glossy('#2b1d14'), band: glossy('#ffb627', { metalness: 0.5 }), tip: mat('#4aa3ff') };
{
  const s = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.065, 5.2, 14), stickMats.shaft); s.rotation.x = Math.PI / 2; s.position.z = 2.6 + R + 0.05; s.castShadow = true;
  const butt = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.072, 1.4, 14), stickMats.butt); butt.rotation.x = Math.PI / 2; butt.position.z = 4.6 + R; butt.castShadow = true;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.061, 0.061, 0.12, 14), stickMats.band); band.rotation.x = Math.PI / 2; band.position.z = 3.85 + R;
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.06, 12), stickMats.tip); tip.rotation.x = Math.PI / 2; tip.position.z = R + 0.08;
  const ferr = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.037, 0.14, 12), mat('#f6f1e6')); ferr.rotation.x = Math.PI / 2; ferr.position.z = R + 0.17;
  stick.add(s, butt, band, tip, ferr); stick.position.y = R + 0.12;
}
paintCue();
const lineMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false });
const lineMat2 = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, depthWrite: false });
const seg = (m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(1, 0.01, 1), m); o.renderOrder = 3; scene.add(o); return o; };
const guide = seg(lineMat), objLine = seg(lineMat), cueLine = seg(lineMat2), bounceLine = seg(lineMat2);
const ghost = new THREE.Mesh(new THREE.RingGeometry(R - 0.03, R, 32), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, depthWrite: false })); ghost.rotation.x = -Math.PI / 2; ghost.renderOrder = 3; scene.add(ghost);
const ghostFill = new THREE.Mesh(new THREE.CircleGeometry(R - 0.03, 32), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.18, depthWrite: false })); ghostFill.rotation.x = -Math.PI / 2; scene.add(ghostFill);
function setSeg(o, x0, z0, x1, z1, w = 0.03) { const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz); o.position.set((x0 + x1) / 2, 0.215, (z0 + z1) / 2); o.scale.set(w, 1, Math.max(0.001, len)); o.rotation.y = Math.atan2(dx, dz); o.visible = len > 0.01; }

// ---------------------------------------------------------------- aim prediction (first contact only: skill stays)
function predict(ox, oz, dx, dz) {
  let best = { t: Infinity, ball: null };
  for (const b of world.balls) {
    if (b.in || b === world.cue) continue;
    const fx = b.x - ox, fz = b.z - oz, tca = fx * dx + fz * dz; if (tca < 0) continue;
    const d2 = fx * fx + fz * fz - tca * tca, rr = 4 * R * R; if (d2 > rr) continue;
    const t = tca - Math.sqrt(rr - d2); if (t < best.t) best = { t, ball: b };
  }
  for (const p of world.posts) {
    const fx = p.x - ox, fz = p.z - oz, tca = fx * dx + fz * dz; if (tca < 0) continue;
    const d2 = fx * fx + fz * fz - tca * tca, rr = (p.r + R) * (p.r + R); if (d2 > rr) continue;
    const t = tca - Math.sqrt(rr - d2); if (t < best.t) best = { t, ball: null, post: p, nx: (ox + dx * t - p.x), nz: (oz + dz * t - p.z) };
  }
  let tw = Infinity, nx = 0, nz = 0;
  if (dx) { const t = ((dx > 0 ? XB : -XB) - ox) / dx; if (t < tw) { tw = t; nx = 1; nz = 0; } }
  if (dz) { const t = ((dz > 0 ? ZB : -ZB) - oz) / dz; if (t < tw) { tw = t; nx = 0; nz = 1; } }
  if (tw < best.t) return { t: tw, ball: null, wall: { nx, nz } };
  return best;
}

// ---------------------------------------------------------------- match state
let state = 'ready', phase = 'aim', cur = nextOpen(), spec = null, turn = 0, groups = [null, null], aim = -Math.PI / 2, power = 0, pulling = false, pullX = 0;
let lastWhy = '', failCount = {}, dailyMode = false, aiGen = null, aiPlan = null, aiT = 0, strikeT = 0, pendingShot = null, shotsUsed = 0, limit = 0, par = 0, streak = 0, fouls = 0, rivalPots = 0, totalGroup = 3, hintPow = 0, slow = 0, shake = 0, timeScale = 1, ranOnce = 0;
const aiErr = () => Math.max(0.006, (RIVALS[spec.rival]?.err || 0.06) / fk);
const rivalName = () => spec && spec.rival || 'REX';
function say(t) { turnEl.textContent = t; }
function tip(t, ms = 3200) { tipEl.textContent = t; tipEl.classList.add('on'); clearTimeout(tip.t); tip.t = setTimeout(() => tipEl.classList.remove('on'), ms); }
function pop(t, c = '#fff', size = 36, top = 34) { ui.pop(t, c, size, top); }
const TIPS = { order: 'POT THEM IN ORDER: 1 · 2 · 3', cork: 'CORKED POCKET: CLOSED', ice: 'ICE: BALLS GLIDE FAR', mud: 'MUD: HIT HARDER', bumper: 'BUMPER: KICKS BALLS BACK', post: 'POSTS BOUNCE BALLS', eight: 'THE 8 GOES LAST' };
function featTips(lv) {
  const out = []; if (lv.order) out.push('order'); if (lv.corks && lv.corks.length) out.push('cork'); if (lv.zones) for (const z of lv.zones) out.push(z[4]);
  if (lv.posts) for (const p of lv.posts) out.push(p[3] || 'post'); if (lv.balls && lv.balls.some(b => b[0] === 8) && !lv.order) out.push('eight');
  return [...new Set(out)];
}

function duelSpec(lv) {
  const g = lv.g, r = rng(lv.i * 71 + 3), sol = [], str = []; for (let i = 1; i <= g; i++) { sol.push(i); str.push(8 + i); }
  const pool = [...sol, ...str].sort(() => r() - 0.5), total = pool.length + 1, pos = [];
  for (let row = 0; pos.length < total; row++) for (let k = 0; k <= row && pos.length < total; k++) pos.push({ x: (k - row / 2) * R * 2.02, z: FOOT.z - row * R * 1.75 });
  const eightIdx = total >= 6 ? 4 : total - 1; let pi = 0;
  return { ...lv, balls: pos.map((p, i) => [i === eightIdx ? 8 : pool[pi++], p.x + (r() - 0.5) * 0.004, p.z]), cue: [HEAD.x, HEAD.z] };
}

function startLevel(i, daily = false) {
  cur = clamp(i, 1, NL); const lv = LEVELS[cur - 1]; fk = F.k();
  spec = lv.type === 'duel' ? duelSpec(lv) : lv; world = makeWorld(spec);
  world.on = fx; makeViews(); buildFeatures();
  const wi = lv.world; const fsv = save.get('felt', -1), fi = fsv >= 3 ? fsv : wi; feltMat.map = feltTexs[fi]; cushMat.color.set(FELTS[fi][2]);
  turn = 0; groups = [null, null]; phase = 'aim'; power = 0; shotsUsed = 0; streak = 0; fouls = 0; rivalPots = 0; aiGen = null; aiPlan = null; hintPow = 0; timeScale = 1; slow = 0;
  par = lv.par || 2; dailyMode = daily && lv.type === 'trick'; limit = lv.type === 'trick' ? (dailyMode ? par : par + (cur < 3 ? 4 : cur === 10 ? 4 : 2)) : 0;
  const duel = lv.type === 'duel';
  infoEl.style.display = duel ? 'none' : 'flex'; hud.style.display = duel ? 'flex' : 'none';
  $(topEl, '.mid').innerHTML = `${dailyMode ? 'DAILY · ' : ''}${cur} · ${lv.name.toUpperCase()}<small>${dailyMode ? 'PAR OR BETTER · NO SPARE SHOTS' : WORLDS[wi].name + (lv.i % 12 === 0 ? ' · BOSS' : lv.hard ? ' · HARD' : '')}</small>`;
  if (duel) {
    totalGroup = lv.g; const rv = RIVALS[lv.rival]; $(hud, '[data-nm]').textContent = lv.rival; $(hud, '[data-av]').textContent = rv.e; say('YOUR BREAK!'); aim = -Math.PI / 2;
    ui.levels(cur);
  } else {
    const t = world.balls.filter(b => b !== world.cue).sort((a, b) => Math.hypot(a.x - world.cue.x, a.z - world.cue.z) - Math.hypot(b.x - world.cue.x, b.z - world.cue.z))[0];
    aim = t ? Math.atan2(t.z - world.cue.z, t.x - world.cue.x) : -Math.PI / 2; say(lv.order ? 'IN ORDER!' : '');
  }
  const seen = save.get('seen', []); for (const k of featTips(lv)) if (!seen.includes(k)) { seen.push(k); save.set('seen', seen); tip(TIPS[k], 4200); break; }
  hintBtn.style.display = !duel && (lv.path && lv.path.length) ? 'block' : 'none';
  lastWhy = '';
  if (!duel && failCount[cur] >= 2 && lv.path && lv.path.length) { const h = lv.path[0]; aim = h.a; snapped = true; hintPow = h.p; tip('FREE HINT: PULL TO THE GOLD LINE', 4500); }
  refreshHud(); resEl.classList.remove('on'); handEl.style.display = cur === 1 ? 'block' : 'none';
}

// ---------------------------------------------------------------- HUD refresh
const remaining = gr => world.balls.filter(b => !b.in && groupOf(b.n) === gr).length;
function refreshHud() {
  const lv = LEVELS[cur - 1];
  if (lv.type === 'trick') {
    const sh = $(infoEl, '.ra-shots'); let h = '';
    for (let k = 0; k < limit; k++) h += `<i class="${k < par ? '' : k === par ? 's2' : 's1'} ${k < shotsUsed ? 'used' : ''}"></i>`;
    sh.innerHTML = h;
    const left = world.balls.filter(b => b !== world.cue && !b.in).map(b => b.n).sort((a, b) => a - b);
    $(infoEl, '.ra-chips').innerHTML = left.map((n, k) => `<b class="${n > 8 ? 'st' : ''} ${(lv.order && k === 0) ? 'next' : ''}" style="background:${colOf(n)}">${n}</b>`).join('');
    const st = $(infoEl, '.ra-streak'); st.textContent = streak >= 2 ? `🔥 STREAK ${streak}` : ''; st.classList.toggle('on', streak >= 2);
    hintBtn.querySelector('b').textContent = save.get('hints', 3); hintBtn.style.opacity = shotsUsed === 0 && save.get('hints', 3) > 0 ? 1 : 0.35;
  } else {
    for (let p = 0; p < 2; p++) {
      const el = $(hud, `[data-p="${p}"]`); el.classList.toggle('on', turn === p && state === 'play');
      const gr = groups[p], pips = $(el, '.ra-pips');
      if (!gr) { pips.innerHTML = Array.from({ length: totalGroup }, () => '<b></b>').join(''); continue; }
      const nums = []; for (let i = 1; i <= totalGroup; i++) nums.push(gr === 'solid' ? i : 8 + i);
      pips.innerHTML = nums.map(n => { const b = world.balls.find(x => x.n === n); return `<b class="${n > 8 ? 'st' : ''} ${b && b.in ? 'gone' : ''}" style="background:${colOf(n)}"></b>`; }).join('');
    }
  }
}

// ---------------------------------------------------------------- physics events (sound, juice)
let lastSnd = 0, potsThisShot = 0;
const canSnd = () => { const t = performance.now(); if (t - lastSnd < 22) return false; lastSnd = t; return true; };
const rings = [], ringGeo = new THREE.RingGeometry(0.8, 1, 32);
function ring(p) {
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.3, p.z); m.renderOrder = 5; scene.add(m); rings.push({ m, t: 0 });
}
const fx = {
  rail(b) { const s = Math.hypot(b.vx, b.vz); if (s > 0.5 && canSnd()) tone(150 + Math.random() * 30, 0.05, 'sine', Math.min(0.12, s * 0.012), 0.7); },
  hit(a, c, rv) { if (rv > 0.3 && canSnd()) { tone(1000 + Math.random() * 300 + rv * 14, 0.04, 'sine', Math.min(0.17, rv * 0.02), 0.9); if (rv > 4) shake = Math.max(shake, Math.min(0.05, rv * 0.004)); } },
  post(b, p, sp) {
    const v = postViews.find(x => x.p === p); if (v) v.pulse = 1;
    if (!canSnd()) return;
    if (p.kind === 'bumper') { tone(480 + Math.random() * 60, 0.12, 'square', 0.1, 1.8); burst(scene, new THREE.Vector3(p.x, 0.4, p.z), ['#ff4d6d', '#ffd23f', '#ffffff'], 6, { speed: 0.05, up: 0.04, size: 0.25, shape: 'sphere' }); shake = Math.max(shake, 0.03); }
    else tone(p.kind === 'cork' ? 120 : 260, 0.06, 'triangle', Math.min(0.14, sp * 0.02), 0.7);
  },
  pot(b, p) {
    const v = views.get(b.n); if (v) { v.sink = 0.001; v.pocket = p; }
    potsThisShot++;
    burst(scene, new THREE.Vector3(p.x, 0.35, p.z), b.n === 0 ? ['#ffffff'] : [colOf(b.n), '#ffffff', '#ffd23f'], 14 + potsThisShot * 4, { speed: 0.05 + potsThisShot * 0.01, up: 0.06, size: 0.35, shape: 'sphere' });
    if (b.n === 0) { tone(180, 0.2, 'triangle', 0.12, 0.5); } else { note(64 + potsThisShot * 3 + streak, 0.25, 0.16); tone(330, 0.12, 'sine', 0.12, 0.6); }
    buzz(12); shake = Math.max(shake, 0.04);
    if (b.n !== 0) { ring(p); if (streak >= 1 || potsThisShot >= 2) flashHit(0.18 + Math.min(0.3, potsThisShot * 0.08)); if (spec.type === 'trick' && timeScale === 1) { timeScale = 0.45; slow = 0.22; } }
    // the last ball drops in slow motion
    if (b.n !== 0 && (b.n === 8 ? spec.type === 'duel' : world.balls.every(x => x === world.cue || x.in))) { timeScale = 0.28; slow = 0.9; shake = 0.07; }
  },
};

// ---------------------------------------------------------------- shots
function shoot(angle, pw) {
  if (phase !== 'aim' && phase !== 'ai') return;
  aim = angle; snapped = false; pendingShot = { angle, pw }; strikeT = 0; phase = 'strike'; handEl.style.display = 'none';
}
function doStrike() {
  const { angle, pw } = pendingShot;
  const rec = strike(world, angle, pw); rec.by = turn; rec.pw = pw;
  rec.clearedBefore = spec.type === 'duel' && groups[turn] ? remaining(groups[turn]) === 0 : false;
  world.rec = rec; potsThisShot = 0; rollSteps = 0; simAcc = 0; phase = 'roll'; tone(260, 0.06, 'square', 0.1 * pw + 0.05, 0.5); buzz(10 + pw * 20); shake = Math.max(shake, 0.02 + pw * 0.05);
}
function afterRoll() {
  const rec = world.rec; world.rec = null;
  for (const b of world.balls) { b.vx = b.vz = 0; }
  if (spec.type === 'trick') endTrick(rec); else endDuel(rec);
  for (const [n, v] of views) { const b = v.b; if (!b.in && v.sink) { v.sink = 0; v.m.visible = true; v.m.scale.setScalar(1); } }
}
function nearMiss() {
  for (const b of world.balls) { if (b.in || b === world.cue) continue; for (let i = 0; i < POCKETS.length; i++) if (open(world, i)) { const p = POCKETS[i]; if (Math.hypot(b.x - p.x, b.z - p.z) < p.r + 0.4) return true; } }
  return false;
}
function endTrick(rec) {
  const r = resolveTrick({ ...world, rec }, spec); shotsUsed++;
  const left = world.balls.filter(b => b !== world.cue && !b.in).length;
  if (r.scratch) { lastWhy = 'SCRATCH: keep the white ball out of pockets'; streak = 0; pop('SCRATCH!', '#ff4d6d', 38, 36); sfx.fail(); }
  else if (r.bad.length) { lastWhy = spec.order ? `ORDER: ${r.bad[0]} went in before its turn` : 'The 8 goes in LAST'; streak = 0; pop(spec.order ? `ORDER! ${r.bad[0]} IS NOT NEXT` : 'THE 8 GOES LAST!', '#ff4d6d', 28, 36); sfx.fail(); }
  else if (r.good) {
    streak++; sfx.coin();
    const t = r.good >= 3 ? 'TRIPLE POT!' : r.good === 2 ? 'DOUBLE POT!' : r.bank ? 'BANK SHOT!' : streak >= 4 ? 'UNSTOPPABLE!' : streak >= 3 ? `${streak} IN A ROW!` : ['NICE POT!', 'CLEAN!', 'SWEET!'][Math.floor(Math.random() * 3)];
    pop(t, r.good >= 2 || r.bank ? '#ffd23f' : '#ffffff', r.good >= 2 ? 44 : 36, 34);
    if (rec.pw >= 0.3 && rec.pw <= 0.72 && !r.bank) setTimeout(() => { if (state === 'play') pop('PERFECT POWER', '#9be7ff', 22, 46); }, 250);
    if (shotsUsed <= par && !r.cleared) setTimeout(() => { if (state === 'play') pop('ON PAR', '#7dffb0', 24, 44); }, 450);
    if (r.good >= 2 || streak >= 3) { confetti(scene, new THREE.Vector3(0, 1.5, 0), 40); flashHit(0.35); }
  } else { streak = 0; if (nearMiss()) pop('SO CLOSE!', '#ffb627', 34, 36); else sfx.fail(); }
  refreshHud();
  if (r.cleared) return win(par);
  if (shotsUsed >= limit) return lose(left, left === 1 ? `SO CLOSE: 1 ball left! ${lastWhy}` : `${left} balls left${lastWhy ? ' · ' + lastWhy : ''}`);
  phase = 'aim'; power = 0;
  const t = world.balls.filter(b => b !== world.cue && !b.in).sort((a, b) => Math.hypot(a.x - world.cue.x, a.z - world.cue.z) - Math.hypot(b.x - world.cue.x, b.z - world.cue.z))[0];
  if (t) aim = Math.atan2(t.z - world.cue.z, t.x - world.cue.x);
  hintBtn.style.opacity = 0.35;
}
function flashHit(a) { ui.flash(a); }
function starsForTrick() { return shotsUsed <= par ? 3 : shotsUsed <= par + 1 ? 2 : 1; }

// ---- duel (v1 rules)
const LOG = [];
function endDuel(s) {
  const me = s.by, other = 1 - me; let gr = groups[me]; LOG.push({ by: me, first: s.first, potted: s.potted.slice(), pw: +(s.pw || 0).toFixed(2), grp: groups.join(), cb: s.clearedBefore, left: world.balls.filter(b => !b.in).map(b => b.n).join('.') });
  const cueIn = s.potted.includes(0), eightIn = s.potted.includes(8);
  let foul = cueIn || s.first === null;
  if (!foul && s.first !== null) {
    if (gr && !s.clearedBefore && groupOf(s.first) !== gr) foul = true;
    if (gr && s.clearedBefore && s.first !== 8) foul = true;
    if (!gr && s.first === 8) foul = true;
  }
  const rname = rivalName();
  if (eightIn) return finishDuel(!foul && s.clearedBefore ? me : other, foul || !s.clearedBefore ? (me === 0 ? 'The 8 goes LAST: clear your balls first' : `${rname} sank the 8 early`) : '');
  const pottedNon = s.potted.filter(n => n !== 0 && n !== 8);
  if (!gr && !foul && pottedNon.length) { gr = groups[me] = groupOf(pottedNon[0]); groups[other] = gr === 'solid' ? 'stripe' : 'solid'; pop(gr === 'solid' ? 'SOLIDS!' : 'STRIPES!', '#ffd23f', 34, 30); }
  const good = !foul && gr && pottedNon.some(n => groupOf(n) === gr);
  if (me === 0) {
    const mine = pottedNon.filter(n => groupOf(n) === groups[0]).length;
    if (good) { streak++; if (mine) pop(mine >= 2 ? 'DOUBLE POT!' : streak > 1 ? `${streak} IN A ROW!` : ['NICE POT!', 'CLEAN!', 'SWEET!'][Math.floor(Math.random() * 3)], mine >= 2 ? '#ffd23f' : '#ffffff', 36, 34); sfx.coin(); } else streak = 0;
    if (!good && !foul && nearMiss()) pop('SO CLOSE!', '#ffb627', 34, 36);
    if (foul) fouls++;
  } else { rivalPots += pottedNon.length; chat(good ? 0 : 1, good); }
  if (cueIn) { const c = world.cue; c.in = false; const [x, z] = spotFor(world, c, HEAD.x, HEAD.z); c.x = x; c.z = z; c.vx = c.vz = 0; const v = views.get(0); v.sink = 0; v.m.visible = true; v.m.scale.setScalar(1); }
  if (foul) { pop(cueIn ? 'SCRATCH!' : 'FOUL!', '#ff4d6d', 38, 40); if (me === 0) sfx.fail(); }
  if (!good) turn = other;
  phase = turn === 0 ? 'aim' : 'ai'; aiT = 0; aiPlan = null; aiGen = null; power = 0;
  say(turn === 0 ? (foul && me === 1 ? 'FOUL — YOUR SHOT' : 'YOUR TURN') : `${rname}'S TURN`);
  if (turn === 0) aim = Math.atan2(nearestTarget() ? nearestTarget().z - world.cue.z : -1, nearestTarget() ? nearestTarget().x - world.cue.x : 0);
  refreshHud();
}
function nearestTarget() {
  const gr = groups[0], cleared = gr && remaining(gr) === 0;
  return world.balls.filter(b => !b.in && b !== world.cue && (cleared ? b.n === 8 : gr ? groupOf(b.n) === gr : b.n !== 8)).sort((a, c) => Math.hypot(a.x - world.cue.x, a.z - world.cue.z) - Math.hypot(c.x - world.cue.x, c.z - world.cue.z))[0];
}
function chat(kind, good) {
  const rv = RIVALS[rivalName()], el = $(hud, '.ra-say'); if (!rv) return;
  el.textContent = good ? rv.talk[1 + (Math.random() < 0.5 ? 1 : 0)] : ['Hmm.', 'Argh!', 'Lucky you.'][Math.floor(Math.random() * 3)]; el.classList.add('on'); clearTimeout(chat.t); chat.t = setTimeout(() => el.classList.remove('on'), 1700);
}
function finishDuel(winner, line) {
  if (phase !== 'over') { F.level(winner === 0, Math.min(1, 0.5)); if (winner === 0) B.submit(1); }
  phase = 'over';
  if (winner === 0) win(0); else lose(0, line || `${rivalName()} cleared the table`);
}

// ---- results
function win(parArg) {
  phase = 'over'; state = 'over'; const lv = LEVELS[cur - 1], duel = lv.type === 'duel';
  const ok = []; let stars;
  if (duel) { ok.push(['Won the match', true], ['No fouls', fouls === 0], [`${rivalName()} potted 1 or none`, rivalPots <= 1]); stars = ok.filter(x => x[1]).length; }
  else { stars = starsForTrick(); ok.push([`${shotsUsed} shot${shotsUsed > 1 ? 's' : ''} · par ${par}`, true]); }
  let dstreak = null; if (dailyMode && shotsUsed <= par) dstreak = dailyWin();
  if (dstreak) ok.push([`DAILY DONE · streak ${dstreak} · +1 hint`, true]);
  const prev = starsOf(), before = totalStars(); if (stars > prev[cur - 1]) { prev[cur - 1] = stars; save.set('stars', prev); }
  const after = totalStars();
  if (duel) { const beat = save.get('beat', []); if (!beat.includes(lv.rival)) { beat.push(lv.rival); save.set('beat', beat); } if (lv.i % 12 === 0) save.set('hints', save.get('hints', 3) + 2); }
  failCount[cur] = 0; const clears = save.get('clears', 0) + 1; save.set('clears', clears);
  if (clears % 5 === 0) { const r = [['+2 HINTS', () => save.set('hints', save.get('hints', 3) + 2)], ['+1 HINT', () => save.set('hints', save.get('hints', 3) + 1)], ['GOLDEN CUE SPARKLE', () => save.set('spark', 1)], ['NEW FELT COLOUR', () => save.set('felt', save.get('felt', 2) >= 4 ? 3 : save.get('felt', 2) + 1)]][Math.floor(Math.random() * 4)]; r[1](); ok.push(['CHEST ' + r[0], true]); }
  else ok.push([`chest in ${5 - clears % 5} clears`, true]);
  sfx.win(); buzz([20, 40, 20]); confetti(scene, new THREE.Vector3(0, 1.5, 0), 90); pop(duel ? '8-BALL!' : stars === 3 ? 'PERFECT!' : 'CLEARED!', '#ffd23f', 52, 30);
  setTimeout(() => showResult(true, stars, ok, before, after, lv), 1000);
}
function lose(left, line) {
  phase = 'over'; state = 'over'; sfx.fail(); failCount[cur] = (failCount[cur] || 0) + 1;
  const lv = LEVELS[cur - 1];
  setTimeout(() => showResult(false, 0, [[line || (left === 1 ? 'SO CLOSE: 1 ball left!' : `${left} balls left`), false]], 0, 0, lv), 650);
}
function showResult(won, stars, lines, before, after, lv) {
  $(resEl, '.ra-rt').textContent = won ? (lv.type === 'duel' ? 'MATCH WON!' : stars === 3 ? 'PERFECT!' : 'CLEARED!') : (lv.type === 'duel' ? 'MATCH LOST' : 'OUT OF SHOTS');
  $(resEl, '.ra-rl').innerHTML = lines.map(([t, k]) => `<div class="${k ? 'ok' : 'no'}">${won ? `<i class="ck ${k ? 'on' : ''}"></i>` : ''}${t}</div>`).join('');
  const sts = resEl.querySelectorAll('.ra-stars b'); sts.forEach(s => s.classList.remove('on'));
  resEl.querySelector('.ra-stars').style.display = won ? 'flex' : 'none';
  const nx = CUES.find(c => c.need > after), bar = $(resEl, '.ra-next i'), lab = $(resEl, '.ra-next span');
  if (won && nx) { const base = [...CUES].reverse().find(c => c.need <= before)?.need || 0; bar.style.width = clamp((before - base) / (nx.need - base), 0, 1) * 100 + '%'; lab.textContent = `${nx.need - after} more stars → ${nx.name.toUpperCase()} cue`; setTimeout(() => bar.style.width = clamp((after - base) / (nx.need - base), 0, 1) * 100 + '%', 300); }
  else { bar.style.width = '0'; lab.textContent = won ? 'ALL CUES UNLOCKED' : `${LEVELS[cur - 1].type === 'trick' ? 'par ' + par + ' shots · limit ' + limit : ''}`; }
  const newCue = CUES.filter(c => c.need > before && c.need <= after);
  if (newCue.length) { lab.textContent = `NEW CUE: ${newCue[newCue.length - 1].name.toUpperCase()}!`; bar.style.width = '100%'; save.set('cue', CUES.indexOf(newCue[newCue.length - 1])); paintCue(); }
  $(resEl, '[data-a="next"]').style.display = won && cur < NL ? 'block' : 'none';
  $(resEl, '[data-a="retry"]').textContent = won ? 'REPLAY' : 'RETRY'; $(resEl, '[data-a="retry"]').style.flex = won ? '1' : '2.2';
  resEl.classList.add('on');
  if (won) for (let k = 0; k < stars; k++) setTimeout(() => { sts[k].classList.add('on'); note(72 + k * 4, 0.3, 0.18); buzz(15); }, 250 + k * 280);
  timeScale = 1;
}
resEl.addEventListener('pointerdown', e => {
  const a = e.target.closest('[data-a]'); if (!a) return; e.stopPropagation();
  const w = a.dataset.a; resEl.classList.remove('on');
  if (w === 'next') go(cur + 1); else if (w === 'retry') go(cur, dailyMode); else openMap();
});

// ---------------------------------------------------------------- daily table: a table you already unlocked, par or better, once a day
const dayNum = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 6e4) / 864e5);
function dailyPick() {
  const pool = LEVELS.filter(l => l.type === 'trick' && l.i > 1 && unlocked(l.i) && l.par >= 2);
  if (!pool.length) return null; const d = dayNum(); return pool[(d * 7 + (d % 5)) % pool.length].i;
}
const dailyDone = () => save.get('dday', -1) === dayNum();
const dailyStreak = () => (save.get('dday', -1) >= dayNum() - 1 ? save.get('dstreak', 0) : 0);
function dailyWin() { const d = dayNum(); if (save.get('dday', -1) === d) return null; const st = save.get('dday', -1) === d - 1 ? save.get('dstreak', 0) + 1 : 1; save.set('dday', d); save.set('dstreak', st); save.set('hints', save.get('hints', 3) + 1); return st; }

// ---------------------------------------------------------------- map + cues
function go(i, daily = false) { ui.hideStart(); startLevel(i, daily); state = 'play'; B.start(); mapEl.classList.remove('on'); cueEl.classList.remove('on'); }
function openMap() {
  const s = starsOf(), beat = save.get('beat', []), nextI = nextOpen();
  $(mapEl, '[data-stars]').innerHTML = `${starSvg(true, 18)} ${totalStars()}/${NL * 3}`;
  const dp = dailyPick(), db = $(mapEl, '.ra-daily'); db.style.display = dp ? 'block' : 'none';
  db.innerHTML = dailyDone() ? `DAILY TABLE · DONE · streak ${dailyStreak()}` : `DAILY TABLE · par or better · streak ${dailyStreak()}`; db.className = 'ra-daily' + (dailyDone() ? ' done' : '');
  $(mapEl, '.ra-rv').innerHTML = Object.entries(RIVALS).map(([n, r]) => `<span class="${beat.includes(n) ? 'on' : ''}" title="${n}">${r.e}</span>`).join('');
  let h = '';
  WORLDS.forEach((w, wi) => {
    const ws = s.slice(wi * 12, wi * 12 + 12).reduce((a, b) => a + b, 0);
    h += `<div class="ra-w"><span>${w.name}</span><small>${w.blurb} · ${starSvg(true, 12)} ${ws}/36</small></div><div class="ra-g">`;
    for (let k = 0; k < 12; k++) {
      const i = wi * 12 + k + 1, lv = LEVELS[i - 1], lk = !unlocked(i), st = s[i - 1];
      h += `<button class="ra-nd ${lk ? 'lock' : ''} ${i === nextI ? 'cur' : ''} ${lv.type === 'duel' || lv.hard ? 'd' : ''}" data-i="${i}" ${lk ? 'disabled' : ''}><em>${lv.type === 'duel' ? (k === 11 ? '👑' : '⚔') : '🎱'}</em>${i}<small>${lk ? '' : starSvg(st > 0, 13) + starSvg(st > 1, 13) + starSvg(st > 2, 13)}</small></button>`;
    }
    h += '</div>';
  });
  $(mapEl, '.ra-body').innerHTML = h; mapEl.classList.add('on'); state = state === 'play' ? 'map' : state;
  const cur_ = $(mapEl, '.cur'); if (cur_) cur_.scrollIntoView({ block: 'center' });
}
mapEl.addEventListener('pointerdown', e => {
  e.stopPropagation(); const t = e.target;
  if (t.closest('[data-x]')) { mapEl.classList.remove('on'); if (state === 'map') state = 'play'; }
  else if (t.closest('[data-cues]')) openCues();
  else if (t.closest('.ra-daily')) { const d = dailyPick(); if (d) go(d, true); }
  else { const n = t.closest('.ra-nd'); if (n && !n.disabled) go(+n.dataset.i); }
});
function openCues() {
  const ts = totalStars(), nx = CUES.find(c => c.need > ts);
  $(cueEl, '[data-need]').textContent = nx ? `${ts} stars · next at ${nx.need}` : 'all unlocked';
  $(cueEl, '.ra-cues').innerHTML = CUES.map((c, i) => `<button class="ra-cq ${save.get('cue', 0) === i ? 'sel' : ''} ${c.need > ts ? 'lock' : ''}" data-c="${i}">${c.name}<i style="background:linear-gradient(90deg,${c.butt} 0 12%,${c.shaft} 12% 80%,${c.tip} 80%)"></i>${c.need > ts ? starSvg(false, 11) + ' ' + c.need : 'OK'}</button>`).join('');
  cueEl.classList.add('on');
}
cueEl.addEventListener('pointerdown', e => {
  e.stopPropagation(); const t = e.target;
  if (t.closest('[data-x]')) cueEl.classList.remove('on');
  else { const b = t.closest('.ra-cq'); if (b && !b.classList.contains('lock')) { save.set('cue', +b.dataset.c); paintCue(); openCues(); sfx.coin(); } }
});
topEl.addEventListener('pointerdown', e => {
  const b = e.target.closest('button'); if (!b) return; e.stopPropagation();
  if (b.dataset.map !== undefined) { if (state === 'play' || state === 'over') openMap(); } else if (b.dataset.retry !== undefined) { if (state === 'play' || state === 'over') go(cur, dailyMode); }
});
hintBtn.addEventListener('pointerdown', e => {
  e.stopPropagation(); const lv = LEVELS[cur - 1]; if (state !== 'play' || phase !== 'aim' || shotsUsed > 0 || !lv.path) return;
  const n = save.get('hints', 3); if (n <= 0) return; save.set('hints', n - 1); const h = lv.path[0]; aim = h.a; snapped = true; hintPow = h.p; refreshHud(); tip('PULL THE CUE TO THE GOLD LINE', 3500); sfx.coin();
});

// ---------------------------------------------------------------- shot planning (rival AI + QA bot)
function segBlocked(x0, z0, x1, z1, skip) {
  const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz); if (len < 1e-6) return false;
  for (const b of world.balls) {
    if (b.in || skip.includes(b)) continue;
    const t = clamp(((b.x - x0) * dx + (b.z - z0) * dz) / (len * len), 0, 1);
    if (Math.hypot(b.x - (x0 + dx * t), b.z - (z0 + dz * t)) < 2 * R + 0.01) return true;
  }
  for (const p of world.posts) {
    const t = clamp(((p.x - x0) * dx + (p.z - z0) * dz) / (len * len), 0, 1);
    if (Math.hypot(p.x - (x0 + dx * t), p.z - (z0 + dz * t)) < p.r + R + 0.01) return true;
  }
  return false;
}
function targetsOf(who) { const gr = groups[who], cleared = gr && remaining(gr) === 0; return world.balls.filter(b => !b.in && b !== world.cue && (cleared ? b.n === 8 : gr ? groupOf(b.n) === gr : b.n !== 8)); }
function candidates(who) {
  const out = [], cue = world.cue;
  for (const b of targetsOf(who)) for (let i = 0; i < POCKETS.length; i++) {
    if (!open(world, i)) continue; const p = POCKETS[i];
    const px = p.x - Math.sign(p.x) * 0.12, pz = p.z - Math.sign(p.z) * (Math.abs(p.z) > 1 ? 0.12 : 0);
    const ox = px - b.x, oz = pz - b.z, od = Math.hypot(ox, oz), ux = ox / od, uz = oz / od;
    const gx = b.x - ux * 2 * R, gz = b.z - uz * 2 * R, cx = gx - cue.x, cz = gz - cue.z, cd = Math.hypot(cx, cz);
    const cos = (cx * ux + cz * uz) / cd; if (cos < 0.25) continue;
    if (Math.abs(gx) > XB || Math.abs(gz) > ZB) continue;
    if (segBlocked(cue.x, cue.z, gx, gz, [cue, b]) || segBlocked(b.x, b.z, px, pz, [cue, b])) continue;
    out.push({ score: cos * cos / (0.6 + cd * 0.35 + od), angle: Math.atan2(cz, cx), pw: clamp((0.18 + od * 0.08 + cd * 0.045) / Math.max(0.45, cos), 0.25, 0.95), b });
  }
  return out.sort((a, c) => c.score - a.score);
}
function simulate(angle, pw) { const c = cloneWorld(world); const rec = strike(c, angle, pw); runShot(c); return rec; }
function judge(who, r) {
  const gr = groups[who], cleared = gr && remaining(gr) === 0;
  if (r.potted.includes(0) || r.first === null) return -1;
  if (gr && !cleared && groupOf(r.first) !== gr) return -1;
  if (cleared) return r.potted.includes(8) ? 10 : -1;
  if (r.potted.includes(8)) return -5;
  if (!gr && r.first === 8) return -1;
  return r.potted.filter(n => n !== 8 && (gr ? groupOf(n) === gr : true)).length;
}
function* planGen(who) {
  const cs = candidates(who).slice(0, 5); let best = null;
  plan: for (const c of cs) for (const k of [1, 0.85, 1.2]) {
    if (aiT > 1.6 && best) break plan;
    const pw = clamp(c.pw * k, 0.15, 1), sc = judge(who, simulate(c.angle, pw)); yield;
    if (sc > 0 && (!best || sc > best.sc)) best = { angle: c.angle, pw, sc };
    if (best && best.sc >= 1) return best;
  }
  if (best) return best;
  const tg = targetsOf(who).sort((a, c) => Math.hypot(a.x - world.cue.x, a.z - world.cue.z) - Math.hypot(c.x - world.cue.x, c.z - world.cue.z))[0] || world.balls.find(x => !x.in && x !== world.cue);
  return { angle: Math.atan2(tg.z - world.cue.z, tg.x - world.cue.x), pw: 0.5, safety: true };
}

// ---------------------------------------------------------------- input
const raycaster = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -R), hit = new THREE.Vector3();
let snapped = false;
// soft aim assist (same for everybody): within 0.7° of a clean pot line on the ball you are aiming at, the aim locks on
function snapAim(a) {
  const cue = world.cue, pr = predict(cue.x, cue.z, Math.cos(a), Math.sin(a)); snapped = false;
  if (!pr.ball) return a;
  let best = null;
  for (let i = 0; i < POCKETS.length; i++) {
    if (!open(world, i)) continue; const p = POCKETS[i], b = pr.ball;
    const px = p.x - Math.sign(p.x) * 0.1, pz = p.z - Math.sign(p.z) * (Math.abs(p.z) > 1 ? 0.1 : 0), ox = px - b.x, oz = pz - b.z, od = Math.hypot(ox, oz);
    const gx = b.x - ox / od * 2 * R, gz = b.z - oz / od * 2 * R, ang = Math.atan2(gz - cue.z, gx - cue.x);
    let d = ang - a; d = Math.atan2(Math.sin(d), Math.cos(d));
    if (Math.abs(d) < 0.012 && (!best || Math.abs(d) < Math.abs(best.d)) && !segBlocked(cue.x, cue.z, gx, gz, [cue, b]) && !segBlocked(b.x, b.z, px, pz, [cue, b])) best = { d, ang };
  }
  if (best) { snapped = true; return best.ang; }
  return a;
}
function aimAt(e) {
  raycaster.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
  if (raycaster.ray.intersectPlane(plane, hit)) { const dx = hit.x - world.cue.x, dz = hit.z - world.cue.z; if (Math.hypot(dx, dz) > 0.05) aim = snapAim(Math.atan2(dz, dx)); }
}
const inPow = e => e.clientY > innerHeight - 90;
input({
  onDown: (e) => { if (state !== 'play' || phase !== 'aim') return; if (inPow(e)) { pulling = true; pullX = e.clientX; power = 0; handEl.style.display = 'none'; } else aimAt(e); },
  onMove: (dx, dy, e) => { if (state !== 'play' || phase !== 'aim') return; if (pulling) power = clamp((pullX - e.clientX) / (innerWidth * 0.62), 0, 1); else aimAt(e); },
  onUp: () => { if (pulling) { pulling = false; hintPow = 0; if (power > 0.04 && phase === 'aim' && state === 'play') shoot(aim, power); else power = 0; } },
});
ui.onTap(() => { go(cur); });
const D = demo(null, { ready: () => cur === 1 && state === 'play' && phase === 'aim' && shotsUsed === 0 && !pulling, wait: 1500, ms: 5000 });
let demoOn = false, demoAimBase = 0;
function demoAim(t) {
  if (D.on && cur === 1 && state === 'play' && phase === 'aim' && !pulling) {
    if (!demoOn) { demoOn = true; D.t0 = t; demoAimBase = aim; }
    const a = t - D.t0; aim = demoAimBase + Math.sin(a * 2.4) * 0.3 * Math.max(0, 1 - a / 2.2); power = a > 1.6 ? 0.55 * (0.5 - 0.5 * Math.cos((a - 1.6) * 2.6)) : 0;
  } else if (demoOn) { demoOn = false; if (!pulling) power = 0; if (!D.touched) aim = demoAimBase; }
}

// ---------------------------------------------------------------- loop
const camTarget = new THREE.Vector3(0, 0, 0.05);
let simAcc = 0, rollTick = 0, rollSteps = 0;
loop((dtRaw, t) => {
  const real = Math.min(dtRaw / 60, 1 / 30);
  if (slow > 0) { slow -= real; if (slow <= 0) timeScale = 1; }
  const aspect = innerWidth / innerHeight, needW = (W + 1.5) / 0.9, vt = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const dist = Math.max(needW / 2 / (vt * aspect), (L + 2.2 + 3.2) / 2 / vt);
  const sx = shake > 0.002 ? (Math.random() - 0.5) * shake : 0, sz = shake > 0.002 ? (Math.random() - 0.5) * shake : 0; shake *= 0.86;
  camera.position.set(sx, dist * 0.996, dist * 0.09 + 0.3 + sz); camera.lookAt(camTarget);
  demoAim(t);
  for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.t += real * 2.2; r.m.scale.setScalar(0.1 + r.t * 0.9); r.m.material.opacity = Math.max(0, 1 - r.t); if (r.t >= 1) { scene.remove(r.m); r.m.material.dispose(); rings.splice(i, 1); } }
  if (state === 'play' || state === 'over') {
    if (phase === 'roll') {
      simAcc += real * 2.4 * timeScale * (spec.type === 'duel' && timeScale === 1 ? (turn === 1 ? 2.2 : 1.4) : 1);
      if (streak >= 2 && (rollTick++ & 3) === 0) burst(scene, new THREE.Vector3(world.cue.x, 0.3, world.cue.z), ['#ffd23f', '#ffffff', '#ff8c1a'], 2, { speed: 0.012, up: 0.012, size: 0.16, shape: 'sphere', life: 0.7 });
      // same stepping and rest check as phys.runShot, so the solver's paths replay exactly
      let fin = false;
      while (simAcc > H && !fin) { step(world, H); simAcc -= H; rollSteps++; if (rollSteps % 60 === 0 && !moving(world)) fin = true; else if (rollSteps >= 14400) fin = true; }
      if (fin) afterRoll();
    } else if (phase === 'strike') {
      strikeT += real; if (strikeT > 0.09) doStrike();
    } else if (phase === 'ai' && state === 'play') {
      aiT += real;
      if (!aiPlan) {
        if (!aiGen) aiGen = planGen(1);
        const t0 = performance.now(); let r;
        do { r = aiGen.next(); } while (!r.done && performance.now() - t0 < 14);
        if (r.done) { aiPlan = r.value; const e = aiErr(); aiPlan.angle += (Math.random() + Math.random() - 1) * e * (aiPlan.safety ? 0.5 : 1.4); aiPlan.pw = clamp(aiPlan.pw * (1 + (Math.random() - 0.5) * 2 * (RIVALS[rivalName()].pw || 0.1)), 0.12, 1); aiPlan.from = aim; aiPlan.t0 = aiT; aiGen = null; }
      } else {
        const a = aiT - aiPlan.t0, k = clamp((a - 0.05) / 0.3, 0, 1), e = k * k * (3 - 2 * k);
        let d = aiPlan.angle - aiPlan.from; d = Math.atan2(Math.sin(d), Math.cos(d)); aim = aiPlan.from + d * e;
        power = clamp((a - 0.4) / 0.2, 0, 1) * aiPlan.pw;
        if (a > 0.62) shoot(aiPlan.angle, aiPlan.pw);
      }
    }
  }
  for (const v of views.values()) {
    const b = v.b;
    if (b.in) {
      if (v.sink > 0 && v.sink < 1) { v.sink += real * 3.5; const p = v.pocket; b.x = lerp(b.x, p.x, 0.25); b.z = lerp(b.z, p.z, 0.25); v.m.position.set(b.x, R - v.sink * 0.5, b.z); v.m.scale.setScalar(Math.max(0.01, 1 - v.sink * 0.6)); if (v.sink >= 1) v.m.visible = false; }
      continue;
    }
    const dx = b.x - v.m.position.x, dz = b.z - v.m.position.z, dd = Math.hypot(dx, dz);
    if (dd > 1e-5 && dd < 1) { const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(dz / dd, 0, -dx / dd), dd / R); v.m.quaternion.premultiply(q); }
    v.m.position.set(b.x, R + 0.005, b.z); v.m.visible = true; v.m.scale.setScalar(1);
  }
  for (const pv of postViews) if (pv.pulse > 0.01) { pv.pulse *= 0.86; pv.m.scale.set(1 + pv.pulse * 0.18, 1, 1 + pv.pulse * 0.18); } else pv.m.scale.set(1, 1, 1);
  const showAim = state === 'play' && world && (phase === 'aim' || phase === 'ai' || phase === 'strike') && !world.cue.in;
  stick.visible = showAim;
  const dx = Math.cos(aim), dz = Math.sin(aim);
  if (showAim) {
    const cue = world.cue, pull = phase === 'strike' ? lerp(power * 1.1, -0.05, clamp(strikeT / 0.09, 0, 1)) : power * 1.1 + Math.sin(t * 3) * 0.015;
    stick.position.set(cue.x - dx * pull, R + 0.12, cue.z - dz * pull); stick.rotation.y = Math.atan2(-dx, -dz); stick.rotation.x = 0; stick.rotateX(-0.06);
  }
  const showGuide = showAim && (phase === 'aim' || (phase === 'ai' && aiPlan));
  guide.visible = objLine.visible = cueLine.visible = bounceLine.visible = ghost.visible = ghostFill.visible = false;
  if (showGuide) {
    const cue = world.cue, pr = predict(cue.x, cue.z, dx, dz), t1 = Math.min(pr.t, 14);
    const gx = cue.x + dx * t1, gz = cue.z + dz * t1;
    setSeg(guide, cue.x + dx * R, cue.z + dz * R, gx - dx * R, gz - dz * R);
    ghost.visible = ghostFill.visible = true; ghost.position.set(gx, 0.22, gz); ghostFill.position.set(gx, 0.215, gz);
    ghost.material.color.set(snapped ? '#7dffb0' : '#ffffff'); lineMat.color.set(snapped ? '#c8ffe0' : '#ffffff');
    if (pr.ball) {
      const nx = (pr.ball.x - gx) / (2 * R), nz = (pr.ball.z - gz) / (2 * R), cosA = dx * nx + dz * nz;
      let wl = 9; if (nx) wl = Math.min(wl, ((nx > 0 ? XB : -XB) - pr.ball.x) / nx); if (nz) wl = Math.min(wl, ((nz > 0 ? ZB : -ZB) - pr.ball.z) / nz);
      const ol = clamp(Math.max(0.5, wl) * (0.45 + 0.55 * cosA), 0.5, 3.2);
      setSeg(objLine, pr.ball.x + nx * R, pr.ball.z + nz * R, pr.ball.x + nx * (R + ol), pr.ball.z + nz * (R + ol));
      let tx = dx - cosA * nx, tz = dz - cosA * nz; const tl = Math.hypot(tx, tz);
      if (tl > 0.05) { tx /= tl; tz /= tl; setSeg(cueLine, gx, gz, gx + tx * 0.9 * tl, gz + tz * 0.9 * tl, 0.02); }
      if (spec.type === 'duel') {
        const legal = !groups[turn] ? pr.ball.n !== 8 : (remaining(groups[turn]) === 0 ? pr.ball.n === 8 : groupOf(pr.ball.n) === groups[turn]);
        ghost.material.color.set(legal ? (snapped ? '#7dffb0' : '#ffffff') : '#ff4d6d'); lineMat.color.set(legal ? (snapped ? '#c8ffe0' : '#ffffff') : '#ff8fa3');
      }
    } else if (pr.wall) {
      const rx = pr.wall.nx ? -dx : dx, rz = pr.wall.nz ? -dz : dz;
      setSeg(bounceLine, gx, gz, gx + rx * 1.4, gz + rz * 1.4, 0.02);
    } else if (pr.post) {
      const nl = Math.hypot(pr.nx, pr.nz) || 1, nx = pr.nx / nl, nz = pr.nz / nl, dn = dx * nx + dz * nz; setSeg(bounceLine, gx, gz, gx + (dx - 2 * dn * nx) * 1.2, gz + (dz - 2 * dn * nz) * 1.2, 0.02);
    }
  }
  pow.firstElementChild.style.width = (power * 100) + '%';
  const u = $(pow, 'u'); u.style.display = hintPow && phase === 'aim' ? 'block' : 'none'; u.style.left = (hintPow * 62 * innerWidth / 100 / (innerWidth - 36) * 100) + '%';
  $(pow, '.cue').style.transform = `translateX(${-power * 90}px)`;
  pow.style.opacity = state === 'play' && phase === 'aim' ? 1 : 0.35;
  S.followLight(new THREE.Vector3(0, 0, 0)); sun.position.set(2.5, 16, 4);
});

startLevel(cur); state = 'ready'; ui.start();

// ---------------------------------------------------------------- test hooks
window.__game = {
  get state() { return state; }, get level() { return cur; }, get score() { return totalStars(); }, get phase() { return phase; },
  get dbg() { return { phase, turn, groups, shotsUsed, limit, par, balls: world.balls.map(b => [b.n, +b.x.toFixed(2), +b.z.toFixed(2), b.in]) }; },
  go, shoot, openMap, startLevel, LEVELS, PARS, LOG,
  get world() { return world; },
  bot() {
    // trick: replay the solver's path; duel: the rival planner for the player
    if (state !== 'play' || turn !== 0 || phase !== 'aim') return;
    const lv = LEVELS[cur - 1];
    if (lv.type === 'trick') { const p = lv.path && lv.path[shotsUsed]; if (p) shoot(p.a, p.p); return; }
    const g = planGen(0); let r; do { r = g.next(); } while (!r.done); shoot(r.value.angle, r.value.pw);
  },
};
