// hc.js — shared hyper-casual kit (ES module). Our own code, MIT. Used by every game in hc-games/.
// Gives each game: a three.js stage with soft light + shadows, pastel palettes, juice (sound, haptics, popups, flash,
// particles, confetti), a standard UI (level progress, score, start / win / lose cards), input helpers, and storage.
import * as THREE from './three.module.min.js';
export { THREE };

// ---------------------------------------------------------------- GPU memory guard (qa/perf_fixes.py)
// Games rebuild levels by removing old meshes, and three.js keeps their GPU buffers until dispose(). An object removed
// from its parent and still detached ~2 s later frees the geometries and textures under it that NOTHING still needs:
// never one a rendered scene still uses (shared geometries, cached materials' maps, background / environment), never
// one marked keep() / userData.shared, and never again one it freed once and then saw back on screen (a game-level
// cache reused across levels). Materials are never disposed here: they hold no GPU memory of their own, and disposing
// the last material of a kind deletes its shader program, so the next level / burst recompiled it (a freeze on phones).
if (!THREE.Object3D.prototype.__apFree) {
  const P = THREE.Object3D.prototype, rem = P.remove, S = THREE.Scene.prototype, obr = S.onBeforeRender;
  const pending = new Map(), KEEP = P.__apKeep = new WeakSet(), freed = new WeakSet(), scenes = new Set(), seen = new WeakSet();
  const ref = typeof WeakRef === 'function' ? s => new WeakRef(s) : s => ({ deref: () => s });
  const track = s => { if (s && s.isScene && !seen.has(s)) { seen.add(s); scenes.add(ref(s)); } };
  // every scene three renders (WebGLRenderer.render is a per-instance function, so hook the scene's render callback)
  S.onBeforeRender = function () { track(this); return obr.apply(this, arguments); };
  let timer = 0;
  const texOf = (m, f, uniforms) => {
    for (const k in m) { const v = m[k]; if (v && v.isTexture) f(v); }
    if (uniforms && m.uniforms) for (const k in m.uniforms) for (const v of [].concat(m.uniforms[k] && m.uniforms[k].value)) if (v && v.isTexture) f(v);
  };
  const inUse = () => {   // everything a live scene (rendered, or one an object was removed from) still references
    const s = new Set(), mat = m => { if (m && !s.has(m)) { s.add(m); texOf(m, t => s.add(t), 1); } };
    for (const w of scenes) {
      const sc = w.deref(); if (!sc) { scenes.delete(w); continue; }
      for (const t of [sc.background, sc.environment]) if (t && t.isTexture) s.add(t);
      mat(sc.overrideMaterial);
      sc.traverse(x => { if (x.geometry) s.add(x.geometry); [].concat(x.material || []).forEach(mat); mat(x.customDepthMaterial); mat(x.customDistanceMaterial); });
    }
    for (const r of s) if (freed.has(r)) KEEP.add(r);   // freed once and back on screen: a shared cache, keep it from now on
    return s;
  };
  const free = (o, used) => o.traverse(x => {
    if (x.userData && x.userData.shared) return;
    const g = x.geometry;
    if (g && g.dispose && !used.has(g) && !KEEP.has(g)) { g.dispose(); freed.add(g); }
    if (x.isInstancedMesh && !KEEP.has(x)) x.dispose();   // its instance buffers (three re-uploads them if it comes back)
    for (const m of [].concat(x.material || [])) if (m && !used.has(m) && !KEEP.has(m))
      texOf(m, t => { if (!t.isRenderTargetTexture && !used.has(t) && !KEEP.has(t)) { t.dispose(); freed.add(t); } });
  });
  const sweep = () => {
    timer = 0; const now = performance.now(), due = [];
    for (const [o, t] of pending) if (now - t >= 1900) { pending.delete(o); if (!o.parent) due.push(o); }
    if (due.length && scenes.size) { const used = inUse(); for (const o of due) free(o, used); }
    if (pending.size) timer = setTimeout(sweep, 1000);
  };
  P.remove = function (...objs) {
    let r = this; while (r.parent) r = r.parent; track(r);
    for (const o of objs) if (o && o.parent === this && !KEEP.has(o)) { pending.set(o, performance.now()); if (!timer) timer = setTimeout(sweep, 2000); }
    return rem.apply(this, objs);
  };
  P.__apFree = 1;
}
// end GPU memory guard
/** keep(...things): the GPU memory guard never frees these (geometries, materials, textures, or whole objects). */
export function keep(...xs) { const K = THREE.Object3D.prototype.__apKeep; if (K) for (const x of xs) if (x) K.add(x); return xs[0]; }

// ---------------------------------------------------------------- palettes (pastel bg + one bold accent family)
export const PALETTES = [
  { bg: ['#ffd1dc', '#ffe9b8'], a: '#ff5d8f', b: '#ffd23f', c: '#2b2d42', ground: '#fff4e6', ui: '#ff5d8f' },
  { bg: ['#b8f2e6', '#e3f6ff'], a: '#3ab795', b: '#ff6b6b', c: '#3d3a4b', ground: '#ffffff', ui: '#2a9d8f' },
  { bg: ['#d7c8ff', '#ffd6f5'], a: '#7b5cff', b: '#ffd166', c: '#22223b', ground: '#fff8ff', ui: '#7b5cff' },
  { bg: ['#ffe0b3', '#fff6d6'], a: '#ff8c42', b: '#3a86ff', c: '#3a2e39', ground: '#ffffff', ui: '#ff8c42' },
  { bg: ['#c9f0ff', '#e8fff4'], a: '#00a6fb', b: '#ff4d6d', c: '#1b263b', ground: '#ffffff', ui: '#0582ca' },
  { bg: ['#ffe5ec', '#d8f3dc'], a: '#52b788', b: '#ff006e', c: '#2d3142', ground: '#fffdf7', ui: '#52b788' },
];
export const palette = (level) => PALETTES[(Math.max(1, level) - 1) % PALETTES.length];
export function applyPalette(p) {
  const s = document.body.style;
  s.setProperty('--bg1', p.bg[0]); s.setProperty('--bg2', p.bg[1]); s.setProperty('--ui', p.ui);
}

// ---------------------------------------------------------------- stage
let STAGE = null;   // the loop renders the most recently created stage automatically
export function createStage({ fov = 45, shadows = true, shadowSize = 12, clear = null } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: clear === null });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;   // keep pastels bright (ACES greys them out)
  if (shadows) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
  if (clear !== null) renderer.setClearColor(clear);
  renderer.domElement.className = 'hc-canvas';
  document.body.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 500);
  const hemi = new THREE.HemisphereLight(0xffffff, 0xffe8f0, 1.15);
  const sun = new THREE.DirectionalLight(0xffffff, 1.7);
  sun.position.set(6, 14, 8);
  if (shadows) {
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004;
    Object.assign(sun.shadow.camera, { left: -shadowSize, right: shadowSize, top: shadowSize, bottom: -shadowSize, near: 0.5, far: 80 });
  }
  scene.add(hemi, sun, sun.target);
  const baseFov = fov;
  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.fov = camera.aspect < 0.7 ? baseFov * 1.12 : baseFov;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();
  /** keep the shadow camera centred on a point (call each frame with the player position) */
  function followLight(p) { sun.position.set(p.x + 6, p.y + 14, p.z + 8); sun.target.position.copy(p); }
  STAGE = { THREE, renderer, scene, camera, sun, hemi, resize, followLight, autoRender: true };
  return STAGE;
}

/** standard materials: soft plastic look used by every game */
export const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.05, ...o });
export const glossy = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.2, metalness: 0.1, ...o });
export function rounded(w, h, d, r = 0.08) {           // rounded box (bevelled extrude) for chunky toy-like props
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: d - r * 2, bevelEnabled: true, bevelThickness: r, bevelSize: r * 0.9, bevelSegments: 3, curveSegments: 6 });
  g.translate(0, 0, -(d - r * 2) / 2); return g;
}
/** a simple stylised human (capsule body + sphere head) used for runners, crowds, NPCs. Returns a Group with .body .head .armL .armR .legL .legR */
export function stickman(color = '#3a86ff', skin = '#ffd7ba', scale = 1) {
  const g = new THREE.Group(), m = mat(color), sk = mat(skin);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.42, 6, 12), m); body.position.y = 0.95; body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 14), sk); head.position.y = 1.5; head.castShadow = true;
  const limb = (x, y, len, mm) => { const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, len, 4, 8), mm); const piv = new THREE.Group(); piv.position.set(x, y, 0); l.position.y = -len / 2 - 0.04; l.castShadow = true; piv.add(l); g.add(piv); return piv; };
  g.add(body, head);
  g.armL = limb(-0.3, 1.2, 0.36, m); g.armR = limb(0.3, 1.2, 0.36, m); g.legL = limb(-0.11, 0.66, 0.42, m); g.legR = limb(0.11, 0.66, 0.42, m);
  g.body = body; g.head = head; g.scale.setScalar(scale);
  /** run cycle: call with time */
  g.run = (t, amt = 1) => { const s = Math.sin(t * 12) * 0.8 * amt; g.armL.rotation.x = s; g.armR.rotation.x = -s; g.legL.rotation.x = -s; g.legR.rotation.x = s; body.position.y = 0.95 + Math.abs(Math.sin(t * 12)) * 0.05 * amt; };
  return g;
}

// ---------------------------------------------------------------- juice
let actx;
// iOS rejects resume() while another app holds the audio device: catch it (it surfaced as an error in every game).
// The context starts on the first touch, so the first sound effect doesn't stall a frame creating it.
const AUDIO_RESUME = () => { if (actx && actx.state === 'suspended') actx.resume().catch(() => {}); };
try { addEventListener('pointerdown', () => { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); AUDIO_RESUME(); } catch (e) {} }, { once: true, capture: true }); } catch (e) {}
export function tone(f = 440, t = 0.08, type = 'sine', vol = 0.16, slide = 0.6) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    AUDIO_RESUME();
    const o = actx.createOscillator(), g = actx.createGain(), n = actx.currentTime;
    o.type = type; o.frequency.setValueAtTime(f, n); if (slide !== 1) o.frequency.exponentialRampToValueAtTime(f * slide, n + t);
    g.gain.setValueAtTime(vol, n); g.gain.exponentialRampToValueAtTime(0.001, n + t);
    o.connect(g); g.connect(actx.destination); o.start(n); o.stop(n + t + 0.02);
  } catch (e) {}
}
export const sfx = {
  tap: () => tone(520, 0.05, 'sine', 0.12, 0.8),
  pick: (i = 0) => tone(500 + i * 60, 0.07, 'triangle', 0.13, 1.2),
  bounce: () => tone(380, 0.07, 'sine', 0.12, 0.7),
  smash: () => { tone(110, 0.22, 'square', 0.13, 0.5); tone(70, 0.3, 'sawtooth', 0.08, 0.5); },
  fail: () => { tone(220, 0.18, 'square', 0.1, 0.6); setTimeout(() => tone(150, 0.3, 'square', 0.1, 0.5), 140); },
  win: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.14, 1), i * 110)),
  coin: () => { tone(988, 0.06, 'square', 0.07, 1); setTimeout(() => tone(1318, 0.12, 'square', 0.07, 1), 60); },
};
/** play a note by MIDI number with a soft piano-ish envelope (for rhythm games) */
export function note(midi, dur = 0.35, vol = 0.18) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const f = 440 * Math.pow(2, (midi - 69) / 12), n = actx.currentTime, g = actx.createGain();
    g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(vol, n + 0.01); g.gain.exponentialRampToValueAtTime(0.001, n + dur);
    for (const [mult, type, v] of [[1, 'triangle', 1], [2, 'sine', 0.35], [3, 'sine', 0.12]]) {
      const o = actx.createOscillator(), og = actx.createGain(); o.type = type; o.frequency.value = f * mult; og.gain.value = v;
      o.connect(og); og.connect(g); o.start(n); o.stop(n + dur + 0.05);
    }
    g.connect(actx.destination);
  } catch (e) {}
}
export const buzz = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };

// ---------------------------------------------------------------- particles (pooled-ish, cheap)
const PART = keep(new THREE.BoxGeometry(0.18, 0.18, 0.18));
const SPH = keep(new THREE.SphereGeometry(0.1, 8, 6));
const live = [];
// particle materials are pooled, not disposed: disposing the last one deleted the shader program and the next burst
// compiled it again mid-play
const MATS = [];
const partMat = c => { const m = MATS.pop() || new THREE.MeshStandardMaterial({ transparent: true, roughness: 0.4 }); m.color.set(c); m.opacity = 1; return m; };
export function burst(scene, pos, color = '#ffd23f', n = 18, { speed = 0.12, up = 0.1, size = 1, shape = 'box', gravity = 0.006, life = 1 } = {}) {
  for (let i = 0; i < n; i++) {
    const m = keep(new THREE.Mesh(shape === 'sphere' ? SPH : PART, partMat(Array.isArray(color) ? color[i % color.length] : color)));
    m.position.copy(pos); m.scale.setScalar(size * (0.6 + Math.random() * 0.8));
    const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI;
    live.push({ m, v: new THREE.Vector3(Math.cos(a) * Math.sin(b) * speed, up + Math.random() * up, Math.sin(a) * Math.sin(b) * speed), spin: (Math.random() - 0.5) * 0.4, life, g: gravity, scene });
    scene.add(m);
  }
}
export const confetti = (scene, pos, n = 60) => burst(scene, pos, ['#ff5d8f', '#ffd23f', '#3ab795', '#3a86ff', '#7b5cff', '#ffffff'], n, { speed: 0.18, up: 0.2, size: 0.7, gravity: 0.005 });
export function updateParticles(dt = 1) {
  for (const p of live) {
    p.v.y -= p.g * dt; p.m.position.addScaledVector(p.v, dt); p.m.rotation.x += p.spin * dt; p.m.rotation.y += p.spin * dt;
    p.life -= 0.02 * dt; p.m.material.opacity = Math.max(0, p.life);
  }
  for (let i = live.length - 1; i >= 0; i--) if (live[i].life <= 0) { live[i].scene.remove(live[i].m); const mt = live[i].m.material; if (MATS.length < 600) MATS.push(mt); else mt.dispose(); live.splice(i, 1); }
}

// ---------------------------------------------------------------- UI
const CSS = `
*{box-sizing:border-box}
html,body{margin:0;height:100%;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;font-family:'Baloo 2',system-ui,sans-serif;color:#fff}
body{background:linear-gradient(180deg,var(--bg1,#ffd1dc),var(--bg2,#ffe9b8));transition:background .6s}
.hc-canvas{position:fixed;inset:0;width:100%;height:100%;display:block}
.hc-top{position:fixed;top:calc(14px + env(safe-area-inset-top));left:0;right:0;display:flex;justify-content:center;pointer-events:none;z-index:5}
.hc-prog{display:flex;align-items:center;gap:8px}
.hc-lvl{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:17px;background:var(--ui,#ff5d8f);box-shadow:0 3px 0 rgba(0,0,0,.15)}
.hc-lvl.next{background:rgba(255,255,255,.6);color:var(--ui,#ff5d8f)}
.hc-bar{width:min(200px,48vw);height:12px;border-radius:8px;background:rgba(255,255,255,.6);overflow:hidden}
.hc-bar i{display:block;height:100%;width:0;background:var(--ui,#ff5d8f);border-radius:8px;transition:width .2s}
.hc-score{position:fixed;top:calc(56px + env(safe-area-inset-top));left:0;right:0;text-align:center;font-weight:800;font-size:50px;line-height:1;text-shadow:0 4px 0 rgba(0,0,0,.14);pointer-events:none;z-index:5}
.hc-sub{position:fixed;top:calc(106px + env(safe-area-inset-top));left:0;right:0;text-align:center;font-weight:600;font-size:15px;opacity:.9;pointer-events:none;z-index:5;text-shadow:0 2px 0 rgba(0,0,0,.1)}
.hc-pill{position:fixed;top:calc(14px + env(safe-area-inset-top));right:12px;z-index:6;background:rgba(0,0,0,.18);border-radius:16px;padding:2px 12px;font-weight:800;font-size:18px;pointer-events:none}
.hc-pop{position:fixed;left:50%;font-weight:800;pointer-events:none;z-index:6;white-space:nowrap;text-shadow:0 3px 0 rgba(0,0,0,.16);animation:hcup .9s ease-out forwards}
@keyframes hcup{0%{opacity:0;transform:translate(-50%,10px) scale(.6)}20%{opacity:1;transform:translate(-50%,0) scale(1.15)}100%{opacity:0;transform:translate(-50%,-60px) scale(1)}}
.hc-card{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:calc(150px + env(safe-area-inset-top)) 20px calc(40px + env(safe-area-inset-bottom));gap:10px;z-index:10;text-align:center}
.hc-card h1{margin:0;font-size:clamp(42px,13vw,74px);line-height:.92;font-weight:800;text-shadow:0 6px 0 rgba(0,0,0,.14)}
.hc-card p{margin:0;font-size:20px;font-weight:600;text-shadow:0 2px 0 rgba(0,0,0,.12)}
.hc-card .hint{margin-top:auto;margin-bottom:12vh;font-size:22px;animation:hcpulse 1.2s ease-in-out infinite}
.hc-card .hand{font-size:44px;animation:hcswipe 1.6s ease-in-out infinite}
.hc-card.dim{background:rgba(0,0,0,.18)}
@keyframes hcpulse{50%{transform:scale(1.08)}}
@keyframes hcswipe{0%,100%{transform:translateX(-40px)}50%{transform:translateX(40px)}}
.hc-hidden{display:none!important}
.hc-flash{position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:4;transition:opacity .3s}
.hc-btn{pointer-events:auto;font:inherit;font-weight:800;font-size:22px;color:#fff;background:var(--ui,#ff5d8f);border:0;border-radius:40px;padding:12px 34px;box-shadow:0 5px 0 rgba(0,0,0,.18);cursor:pointer}
.hc-btn:active{transform:translateY(3px);box-shadow:0 2px 0 rgba(0,0,0,.18)}
.hc-card .hc-play{margin-top:auto;margin-bottom:12vh;font-size:28px;padding:16px 64px;background:#3cc46a;box-shadow:0 6px 0 #2a9a50;animation:hcpulse 1.6s ease-in-out infinite}
`;
function el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; }

/**
 * createUI({ title, hint, hand, progress, score, sub })
 *   ui.start()/ui.hideStart(), ui.win(level, extra), ui.lose(title, line), ui.progress(0..1), ui.levels(n), ui.score(n), ui.sub(text), ui.pill(text)
 *   ui.pop(text, color, size, topPercent), ui.flash(alpha), ui.onTap(fn) — tap anywhere on a card continues
 */
export function createUI({ title = 'GAME', hint = 'Tap to play', hand = '👆', progress = true, score = true, button = '' } = {}) {
  if (!document.getElementById('hc-css')) {
    const st = document.createElement('style'); st.id = 'hc-css'; st.textContent = CSS; document.head.appendChild(st);
    const f = document.createElement('link'); f.rel = 'stylesheet'; f.href = 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;800&display=swap'; document.head.appendChild(f);
  }
  const top = el(`<div class="hc-top ${progress ? '' : 'hc-hidden'}"><div class="hc-prog"><div class="hc-lvl" data-a>1</div><div class="hc-bar"><i></i></div><div class="hc-lvl next" data-b>2</div></div></div>`);
  const sc = el(`<div class="hc-score ${score ? '' : 'hc-hidden'}">0</div>`), sub = el(`<div class="hc-sub"></div>`), pill = el(`<div class="hc-pill hc-hidden"></div>`);
  const flash = el(`<div class="hc-flash"></div>`);
  // button: a big Play pill instead of the pulsing hint (2026-10-25: first screens with only "Tap to start" lost players in ~3 s)
  const start = el(button ? `<div class="hc-card"><h1>${title}</h1><button type="button" class="hc-btn hc-play">${button}</button></div>`
    : `<div class="hc-card"><h1>${title}</h1><div class="hint">${hand ? `<div class="hand">${hand}</div>` : ''}${hint}</div></div>`);
  const win = el(`<div class="hc-card hc-hidden"><p>LEVEL <span data-l>1</span></p><h1>CLEARED!</h1><p data-x></p><div class="hint">Tap to continue</div></div>`);
  const lose = el(`<div class="hc-card dim hc-hidden"><h1 data-t>OOPS!</h1><p data-x></p><div class="hint">Tap to retry</div></div>`);
  document.body.append(top, sc, sub, pill, flash, start, win, lose);
  let tapCb = null, lastPop;
  for (const c of [start, win, lose]) c.addEventListener('pointerdown', e => { e.stopPropagation(); const which = c === start ? 'start' : c === win ? 'win' : 'lose'; c.classList.add('hc-hidden'); tapCb && tapCb(which); });
  return {
    onTap(fn) { tapCb = fn; },
    start() { start.classList.remove('hc-hidden'); }, hideStart() { start.classList.add('hc-hidden'); },
    win(level, extra = '') { win.querySelector('[data-l]').textContent = level; win.querySelector('[data-x]').textContent = extra; setTimeout(() => win.classList.remove('hc-hidden'), 650); },
    lose(t = 'OOPS!', line = '') { lose.querySelector('[data-t]').textContent = t; lose.querySelector('[data-x]').textContent = line; setTimeout(() => lose.classList.remove('hc-hidden'), 650); },
    progress(p) { top.querySelector('i').style.width = Math.max(0, Math.min(1, p)) * 100 + '%'; },
    levels(n) { top.querySelector('[data-a]').textContent = n; top.querySelector('[data-b]').textContent = n + 1; },
    score(n) { sc.textContent = n; }, sub(t) { sub.textContent = t; }, pill(t) { pill.textContent = t; pill.classList.toggle('hc-hidden', !t); },
    pop(text, color = '#fff', size = 34, topPct = 19) {
      if (lastPop) lastPop.remove(); const d = lastPop = el(`<div class="hc-pop">${text}</div>`);
      d.style.color = color; d.style.fontSize = size + 'px'; d.style.top = topPct + '%'; document.body.appendChild(d); setTimeout(() => d.remove(), 950);
    },
    flash(a = 0.6) { flash.style.opacity = a; setTimeout(() => flash.style.opacity = 0, 90); },
    els: { top, sc, sub, pill, start, win, lose },
  };
}

// ---------------------------------------------------------------- input
/** pointer helper: drag deltas, swipe direction, tap, hold. Works for touch and mouse. */
export function input({ onDown, onMove, onUp, onSwipe, onTap } = {}) {
  let st = null;
  addEventListener('pointerdown', e => { st = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now() }; onDown && onDown(e, st); });
  addEventListener('pointermove', e => { if (!st) return; const dx = e.clientX - st.lx, dy = e.clientY - st.ly; st.lx = e.clientX; st.ly = e.clientY; onMove && onMove(dx, dy, e, st); });
  addEventListener('pointerup', e => {
    if (!st) return; const dx = e.clientX - st.x, dy = e.clientY - st.y, dt = performance.now() - st.t;
    if (Math.hypot(dx, dy) > 30 && dt < 500 && onSwipe) onSwipe(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'), dx, dy);
    else if (Math.hypot(dx, dy) < 12 && onTap) onTap(e);
    onUp && onUp(e, st); st = null;
  });
  return { get down() { return !!st; }, get state() { return st; } };
}

// ---------------------------------------------------------------- storage + loop
export function store(key) {
  return { get(k, d = 0) { const v = localStorage.getItem(key + '_' + k); return v === null ? d : JSON.parse(v); }, set(k, v) { localStorage.setItem(key + '_' + k, JSON.stringify(v)); } };
}
/** fixed-ish loop: fn(dt, tSeconds) where dt ≈ 1 at 60 fps (clamped). Renders the stage after fn unless stage.autoRender = false. */
export function loop(fn) { let last = performance.now(); const f = t => { const dt = Math.min(2.5, (t - last) / 16.67); last = t; fn(dt, t / 1000); updateParticles(dt); if (STAGE && STAGE.autoRender) STAGE.renderer.render(STAGE.scene, STAGE.camera); requestAnimationFrame(f); }; requestAnimationFrame(f); }
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function rng(seed) { seed = Math.floor(seed) % 2147483647 || 1; return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
