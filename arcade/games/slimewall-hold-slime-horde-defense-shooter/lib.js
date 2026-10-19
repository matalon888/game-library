// lib.js — shared helpers for our action games (own code): merged vertex-coloured props, twin-stick controls,
// instanced bullets, billboard health bars, floating numbers, minimap, code-composed music, camera shake, toy robots.
import { THREE, tone, note, mat } from './kit/hc.js';

// ---------------------------------------------------------------- geometry
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), SV = new THREE.Vector3();
/** a coloured, transformed, non-indexed copy of geo: part(geo, '#f00', {x,y,z, rx,ry,rz, s, sx,sy,sz}) */
export function part(geo, color, o = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  const s = o.s ?? 1;
  M4.compose(V.set(o.x || 0, o.y || 0, o.z || 0), Q.setFromEuler(E.set(o.rx || 0, o.ry || 0, o.rz || 0, o.order || 'XYZ')), SV.set((o.sx ?? 1) * s, (o.sy ?? 1) * s, (o.sz ?? 1) * s));
  g.applyMatrix4(M4);
  const c = new THREE.Color(color), n = g.attributes.position.count, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}
/** merge parts made with part() into one BufferGeometry (one draw call) */
export function merge(parts) {
  let n = 0; for (const g of parts) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
  for (const g of parts) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; g.dispose(); }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); m.setAttribute('color', new THREE.BufferAttribute(col, 3));
  m.computeBoundingSphere(); m.computeBoundingBox(); return m;
}
export const vmat = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.05, ...o });
export function canvasTex(w, h, draw, repeat = false) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
export const G = {
  box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 14), sph: new THREE.SphereGeometry(1, 16, 12),
  cone: new THREE.ConeGeometry(1, 1, 12), ico: new THREE.IcosahedronGeometry(1, 0), dod: new THREE.DodecahedronGeometry(1, 0),
};

// ---------------------------------------------------------------- HUD css + DOM helpers
export function hudCSS(accent = '#ffcf3a') {
  if (document.getElementById('ax-css')) return;
  const s = document.createElement('style'); s.id = 'ax-css'; s.textContent = `
:root{--ax:${accent}}
.ax-glass{background:rgba(14,20,36,.62);border:1px solid rgba(255,255,255,.14);border-radius:14px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);box-shadow:0 4px 14px rgba(0,0,0,.25)}
.ax-stick{position:fixed;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;border:2px solid rgba(255,255,255,.45);background:radial-gradient(circle,rgba(255,255,255,.12),rgba(255,255,255,.04));pointer-events:none;z-index:7;opacity:0;transition:opacity .15s}
.ax-stick.on{opacity:1}.ax-stick.ghost{opacity:.35}
.ax-stick i{position:absolute;left:50%;top:50%;width:52px;height:52px;margin:-26px 0 0 -26px;border-radius:50%;background:rgba(255,255,255,.85);box-shadow:0 3px 10px rgba(0,0,0,.3)}
.ax-stick.aim i{background:var(--ax)}
.ax-stick b{position:absolute;left:0;right:0;top:100%;margin-top:6px;text-align:center;font:800 12px/1 system-ui,sans-serif;letter-spacing:.06em;color:rgba(255,255,255,.85);text-shadow:0 1px 3px rgba(0,0,0,.6)}
.ax-btn{position:fixed;z-index:8;border-radius:50%;display:grid;place-items:center;font:800 13px/1.05 system-ui,sans-serif;color:#fff;text-align:center;background:rgba(14,20,36,.6);border:2px solid rgba(255,255,255,.35);touch-action:none;cursor:pointer;user-select:none;-webkit-user-select:none}
.ax-btn .cd{position:absolute;inset:-2px;border-radius:50%;background:conic-gradient(rgba(0,0,0,.55) var(--p,0%),transparent 0);pointer-events:none}
.ax-btn.ready{border-color:var(--ax);box-shadow:0 0 18px var(--ax)}
.ax-float{position:fixed;left:0;top:0;z-index:6;pointer-events:none;font:900 18px/1 'Baloo 2',system-ui,sans-serif;color:#fff;-webkit-text-stroke:4px rgba(10,14,30,.85);paint-order:stroke fill;white-space:nowrap;will-change:transform}
.ax-mini{position:fixed;z-index:6;pointer-events:none;border-radius:14px;border:2px solid rgba(255,255,255,.35);box-shadow:0 4px 14px rgba(0,0,0,.3)}
.ax-feed{position:fixed;z-index:6;pointer-events:none;display:flex;flex-direction:column;gap:4px;align-items:flex-end;font:800 13px/1.2 system-ui,sans-serif}
.ax-feed div{background:rgba(14,20,36,.6);border-radius:8px;padding:3px 8px;animation:axfeed 3.4s forwards}
@keyframes axfeed{0%{opacity:0;transform:translateX(20px)}8%{opacity:1;transform:none}85%{opacity:1}100%{opacity:0}}
.ax-banner{position:fixed;left:0;right:0;top:36%;text-align:center;z-index:9;pointer-events:none;font:900 46px/1 'Baloo 2',system-ui,sans-serif;color:#fff;-webkit-text-stroke:7px rgba(10,14,30,.85);paint-order:stroke fill;opacity:0;transform:scale(.6);transition:opacity .2s,transform .25s cubic-bezier(.2,1.6,.4,1)}
.ax-banner.on{opacity:1;transform:none}.ax-banner small{display:block;font-size:20px;-webkit-text-stroke:4px rgba(10,14,30,.85);margin-top:6px}
.ax-vign{position:fixed;inset:0;pointer-events:none;z-index:4;box-shadow:inset 0 0 0 0 rgba(255,30,60,0);transition:box-shadow .25s}
.ax-chips{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:360px;margin:4px auto 0}
.ax-chip{pointer-events:auto;font:800 14px/1 system-ui,sans-serif;color:#fff;background:rgba(14,20,36,.55);border:2px solid rgba(255,255,255,.3);border-radius:22px;padding:9px 13px;cursor:pointer}
.ax-chip[aria-pressed=true]{background:var(--ax);color:#1a1300;border-color:#fff}
.ax-chip[disabled]{opacity:.45}
.ax-chip small{display:block;font-size:10px;opacity:.8;margin-top:2px}
.hc-card p{text-shadow:0 2px 4px rgba(0,0,0,.45)!important}
.hc-card h1{text-shadow:0 6px 0 rgba(10,14,40,.45)!important}
.hc-pop{-webkit-text-stroke:6px rgba(10,14,30,.85);paint-order:stroke fill}
`; document.head.appendChild(s);
}
export function H(html, parent = document.body) { const d = document.createElement('div'); d.innerHTML = html.trim(); const e = d.firstElementChild; parent.appendChild(e); return e; }
/** a round on-screen button: btn('FOAM<br>BOMB', {right:20,bottom:200,size:70}, fn) → el with .cool(p 0..1) */
export function btn(label, pos, fn) {
  const size = pos.size || 64, e = H(`<div class="ax-btn"><span>${label}</span><div class="cd"></div></div>`);
  Object.assign(e.style, { width: size + 'px', height: size + 'px' });
  for (const k of ['left', 'right', 'top', 'bottom']) if (pos[k] != null) e.style[k] = typeof pos[k] === 'number' ? `calc(${pos[k]}px + env(safe-area-inset-${k}))` : pos[k];
  e.addEventListener('pointerdown', ev => { ev.stopPropagation(); ev.preventDefault(); fn && fn(); });
  e.cool = p => { e.querySelector('.cd').style.setProperty('--p', Math.round(clamp01(p) * 100) + '%'); e.classList.toggle('ready', p <= 0); };
  return e;
}
const clamp01 = v => Math.max(0, Math.min(1, v));
export function banner() {
  const e = H('<div class="ax-banner"></div>'); let t = 0;
  return (text, sub = '', ms = 1400) => { e.innerHTML = text + (sub ? `<small>${sub}</small>` : ''); e.classList.add('on'); clearTimeout(t); t = setTimeout(() => e.classList.remove('on'), ms); };
}
export function feed(pos = { right: 12, top: 120 }) {
  const e = H('<div class="ax-feed"></div>');
  for (const k in pos) e.style[k] = `calc(${pos[k]}px + env(safe-area-inset-${k}))`;
  return (html) => { const d = document.createElement('div'); d.innerHTML = html; e.prepend(d); while (e.children.length > 4) e.lastChild.remove(); setTimeout(() => d.remove(), 3400); };
}
export function vignette() { const e = H('<div class="ax-vign"></div>'); return (a) => { e.style.boxShadow = `inset 0 0 ${80 + a * 60}px ${a * 50}px rgba(255,30,60,${a * 0.55})`; }; }

// ---------------------------------------------------------------- controls (twin-stick touch + WASD/mouse)
// ctl.mx/my: move (-1..1, y up = forward); ctl.ax/ay: aim stick (screen space, y up); ctl.aiming; ctl.fire; ctl.look: yaw/pitch drag accumulators (look mode)
// ctl.mouse: last mouse {x,y} when a mouse is used. Desktop: WASD/arrows move, mouse aims, hold left button to fire, Space = ctl.onKey(' ').
export function controls({ mode = 'stick', labels = ['MOVE', 'AIM'], lockOnClick = false, canvas = null } = {}) {
  const ctl = { mx: 0, my: 0, ax: 0, ay: 0, aiming: false, fire: false, lookX: 0, lookY: 0, mouse: null, enabled: false, touch: false, keys: {}, onKey: null, bot: 0 };
  const L = H(`<div class="ax-stick"><i></i><b>${labels[0]}</b></div>`), R = H(`<div class="ax-stick aim"><i></i><b>${labels[1]}</b></div>`);
  const ptrs = new Map(), RAD = 50;
  const place = (el, x, y) => { el.style.left = x + 'px'; el.style.top = y + 'px'; };
  const knob = (el, dx, dy) => { el.firstChild.style.transform = `translate(${dx}px,${dy}px)`; };
  function ghosts() {
    const show = ctl.enabled && ctl.touch;
    for (const [el, side] of [[L, 0], [R, 1]]) {
      if ([...ptrs.values()].some(p => p.side === side)) continue;
      el.classList.remove('on'); el.classList.toggle('ghost', show); knob(el, 0, 0);
      place(el, side ? innerWidth - 90 : 90, innerHeight - 130);
    }
  }
  ctl.refresh = ghosts;
  addEventListener('resize', ghosts);
  addEventListener('pointerdown', e => {
    if (!ctl.enabled) return;
    if (e.pointerType === 'mouse') {
      ctl.touch = false; ctl.mouse = { x: e.clientX, y: e.clientY };
      if (e.button === 0) { ctl.fire = true; ctl.aiming = true; }
      if (lockOnClick && canvas && document.pointerLockElement !== canvas) { try { canvas.requestPointerLock(); } catch (er) {} }
      return;
    }
    ctl.touch = true;
    const side = e.clientX > innerWidth / 2 ? 1 : 0;
    if ([...ptrs.values()].some(p => p.side === side)) return;
    ptrs.set(e.pointerId, { side, x0: e.clientX, y0: e.clientY, lx: e.clientX, ly: e.clientY });
    const el = side ? R : L; place(el, e.clientX, e.clientY); el.classList.add('on'); el.classList.remove('ghost');
    if (side) { ctl.aiming = mode === 'stick' ? false : true; if (mode === 'look') ctl.fire = false; }
  });
  addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse') {
      ctl.mouse = { x: e.clientX, y: e.clientY };
      if (mode === 'look' && ctl.enabled && document.pointerLockElement) { ctl.lookX += e.movementX; ctl.lookY += e.movementY; }
      else if (mode === 'look' && ctl.enabled && e.buttons & 1) { ctl.lookX += e.movementX * 1.2; ctl.lookY += e.movementY * 1.2; }
      return;
    }
    const p = ptrs.get(e.pointerId); if (!p) return;
    let dx = e.clientX - p.x0, dy = e.clientY - p.y0; const d = Math.hypot(dx, dy);
    if (d > RAD) { const k = RAD / d; if (p.side === 0 || mode === 'stick') { p.x0 += dx - dx * k; p.y0 += dy - dy * k; } dx *= k; dy *= k; }
    const el = p.side ? R : L;
    if (p.side === 0) { ctl.mx = dx / RAD; ctl.my = -dy / RAD; knob(el, dx, dy); place(el, p.x0, p.y0); }
    else if (mode === 'stick') { if (d > 8) { ctl.ax = dx / RAD; ctl.ay = -dy / RAD; ctl.aiming = true; ctl.fire = true; } knob(el, dx, dy); place(el, p.x0, p.y0); }
    else { ctl.lookX += (e.clientX - p.lx) * 1.4; ctl.lookY += (e.clientY - p.ly) * 1.4; knob(el, Math.max(-RAD, Math.min(RAD, e.clientX - p.x0)), Math.max(-RAD, Math.min(RAD, e.clientY - p.y0))); }
    p.lx = e.clientX; p.ly = e.clientY;
  });
  const up = e => {
    if (e.pointerType === 'mouse') { if (e.button === 0) ctl.fire = false; return; }
    const p = ptrs.get(e.pointerId); if (!p) return; ptrs.delete(e.pointerId);
    if (p.side === 0) { ctl.mx = 0; ctl.my = 0; } else { ctl.aiming = false; ctl.fire = false; if (ctl.onRelease) ctl.onRelease(); }
    ghosts();
  };
  addEventListener('pointerup', up); addEventListener('pointercancel', up);
  const K = ctl.keys;
  addEventListener('keydown', e => { K[e.code] = 1; if (ctl.onKey && ctl.enabled && !e.repeat) ctl.onKey(e.code); if (/Arrow|Space/.test(e.code)) e.preventDefault(); });
  addEventListener('keyup', e => { K[e.code] = 0; });
  addEventListener('blur', () => { for (const k in K) K[k] = 0; ctl.fire = false; });
  /** call every frame: merges keyboard into mx/my (unless the bot drives) */
  ctl.poll = () => {
    if (performance.now() < ctl.bot) return;
    const kx = (K.KeyD || K.ArrowRight ? 1 : 0) - (K.KeyA || K.ArrowLeft ? 1 : 0), ky = (K.KeyW || K.ArrowUp ? 1 : 0) - (K.KeyS || K.ArrowDown ? 1 : 0);
    if (kx || ky) { const d = Math.hypot(kx, ky); ctl.mx = kx / d; ctl.my = ky / d; ctl.kb = true; }
    else if (ctl.kb) { ctl.mx = 0; ctl.my = 0; ctl.kb = false; }
  };
  ctl.reset = () => { ptrs.clear(); ctl.mx = ctl.my = ctl.ax = ctl.ay = 0; ctl.aiming = ctl.fire = false; ctl.lookX = ctl.lookY = 0; ghosts(); };
  ctl.drive = (o) => { Object.assign(ctl, o); ctl.bot = performance.now() + 450; };
  return ctl;
}

// ---------------------------------------------------------------- instanced pools (bullets, debris)
const DUMMY = new THREE.Object3D(), UP = new THREE.Vector3(0, 0, 1);
export class Pool {
  constructor(scene, geo, material, max = 200, { colors = false } = {}) {
    this.mesh = new THREE.InstancedMesh(geo, material, max); this.mesh.frustumCulled = false; this.mesh.count = 0;
    if (colors) this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3).fill(1), 3);
    scene.add(this.mesh); this.items = []; this.max = max; this.c = new THREE.Color();
  }
  spawn(o) { if (this.items.length >= this.max) this.items.shift(); const b = { p: new THREE.Vector3(), v: new THREE.Vector3(), life: 1, s: 1, ...o }; this.items.push(b); return b; }
  clear() { this.items.length = 0; this.mesh.count = 0; }
  /** step(b, dt) returns false to remove */
  update(dt, step) {
    const it = this.items; let j = 0;
    for (let i = 0; i < it.length; i++) { const b = it[i]; if (step(b, dt) !== false) it[j++] = b; }
    it.length = j;
    for (let i = 0; i < j; i++) {
      const b = it[i]; DUMMY.position.copy(b.p);
      if (b.v.lengthSq() > 1e-6) DUMMY.quaternion.setFromUnitVectors(UP, V.copy(b.v).normalize()); else DUMMY.quaternion.identity();
      DUMMY.scale.setScalar(b.s); DUMMY.updateMatrix(); this.mesh.setMatrixAt(i, DUMMY.matrix);
      if (this.mesh.instanceColor && b.color) this.mesh.setColorAt(i, this.c.set(b.color));
    }
    this.mesh.count = j; this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- billboard health bars (2 draw calls total)
export function healthBars(scene, camera, max = 64) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const bg = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: '#141a2c', transparent: true, opacity: 0.75, depthWrite: false }), max);
  const fg = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: '#ffffff', depthWrite: false, transparent: true }), max);
  fg.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
  for (const m of [bg, fg]) { m.frustumCulled = false; m.count = 0; m.renderOrder = 5; scene.add(m); }
  fg.renderOrder = 6;
  let n = 0; const c = new THREE.Color(), right = new THREE.Vector3();
  return {
    begin() { n = 0; },
    add(pos, frac, color = '#3ddc84', w = 1.1) {
      if (n >= max) return; frac = clamp01(frac);
      right.set(1, 0, 0).applyQuaternion(camera.quaternion);
      DUMMY.quaternion.copy(camera.quaternion); DUMMY.position.copy(pos); DUMMY.scale.set(w + 0.08, 0.2, 1); DUMMY.updateMatrix(); bg.setMatrixAt(n, DUMMY.matrix);
      DUMMY.position.copy(pos).addScaledVector(right, -(w * (1 - frac)) / 2); DUMMY.scale.set(Math.max(0.001, w * frac), 0.12, 1); DUMMY.updateMatrix(); fg.setMatrixAt(n, DUMMY.matrix);
      fg.setColorAt(n, c.set(color)); n++;
    },
    end() { bg.count = fg.count = n; bg.instanceMatrix.needsUpdate = fg.instanceMatrix.needsUpdate = true; fg.instanceColor.needsUpdate = true; },
  };
}

// ---------------------------------------------------------------- floating numbers (pooled DOM)
export function floaters(camera, n = 24) {
  const els = [], live = [], P = new THREE.Vector3();
  for (let i = 0; i < n; i++) { const e = H('<div class="ax-float" style="display:none"></div>'); els.push(e); }
  let k = 0;
  return {
    add(text, pos, color = '#fff', size = 20) { const e = els[k++ % n]; e.textContent = text; e.style.color = color; e.style.fontSize = size + 'px'; e.style.display = 'block'; const o = live.find(l => l.e === e); if (o) live.splice(live.indexOf(o), 1); live.push({ e, p: pos.clone(), t: 0, dx: (Math.random() - 0.5) * 30 }); },
    update(dt) {
      for (let i = live.length - 1; i >= 0; i--) {
        const l = live[i]; l.t += dt / 60;
        if (l.t > 0.9) { l.e.style.display = 'none'; live.splice(i, 1); continue; }
        P.copy(l.p); P.project(camera);
        if (P.z > 1) { l.e.style.display = 'none'; continue; }
        const x = (P.x * 0.5 + 0.5) * innerWidth + l.dx * l.t, y = (-P.y * 0.5 + 0.5) * innerHeight - l.t * 70, s = l.t < 0.12 ? 0.6 + l.t * 5 : 1.2 - l.t * 0.3;
        l.e.style.display = 'block'; l.e.style.opacity = l.t > 0.6 ? (0.9 - l.t) / 0.3 : 1;
        l.e.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%) scale(${s})`;
      }
    },
    clear() { for (const l of live) l.e.style.display = 'none'; live.length = 0; },
  };
}

// ---------------------------------------------------------------- minimap
export function minimap(size = 110, pos = { right: 10, top: 64 }) {
  const c = document.createElement('canvas'); c.className = 'ax-mini'; c.width = c.height = size * 2; c.style.width = c.style.height = size + 'px';
  for (const k in pos) c.style[k] = `calc(${pos[k]}px + env(safe-area-inset-${k}))`;
  document.body.appendChild(c); const g = c.getContext('2d'); g.scale(2, 2);
  return { el: c, g, size, show(v) { c.style.display = v ? 'block' : 'none'; } };
}

// ---------------------------------------------------------------- camera shake
export function shaker() {
  let a = 0; const o = new THREE.Vector3();
  return { kick(n) { a = Math.min(1.2, a + n); }, apply(cam, dt) { if (a <= 0.001) return; o.set((Math.random() - 0.5) * a, (Math.random() - 0.5) * a, (Math.random() - 0.5) * a * 0.5); cam.position.add(o); a *= Math.pow(0.86, dt); }, get amt() { return a; } };
}

// ---------------------------------------------------------------- music: a looping groove composed in code
// song = { bpm, bars: [[root, 'min'|'maj'], ...], lead: [midi or 0 per 8th...], drums: true }
let musicOn = true; try { musicOn = localStorage.getItem('ax_music') !== '0'; } catch (e) {}
export function music(song) {
  let timer = 0, step = 0, playing = false, intensity = 0.5;
  const dur = 60 / song.bpm / 2;   // eighth notes
  const tick = () => {
    if (!playing || !musicOn || document.visibilityState === 'hidden') return;
    const bar = song.bars[Math.floor(step / 8) % song.bars.length], root = bar[0], third = bar[1] === 'maj' ? 4 : 3, s8 = step % 8;
    if (s8 % 2 === 0) note(root - 24 + (s8 === 6 ? 7 : 0), dur * 1.6, 0.11);
    if (song.drums !== false) {
      if (s8 === 0 || s8 === 4 || (intensity > 0.7 && s8 === 7)) tone(130, 0.14, 'sine', 0.22, 0.35);
      if (s8 === 2 || s8 === 6) tone(1800, 0.05, 'square', 0.025 + intensity * 0.02, 0.5);
      if (intensity > 0.4) tone(6000 + Math.random() * 2000, 0.025, 'square', 0.012, 0.9);
    }
    if (s8 === 0 || (intensity > 0.6 && s8 === 4)) [0, third, 7].forEach(iv => note(root + iv, dur * 3.5, 0.035));
    const L = song.lead && song.lead[step % song.lead.length];
    if (L && intensity > 0.25) note(L, dur * 1.3, 0.06 + intensity * 0.03);
    step++;
  };
  return {
    start() { if (playing) return; playing = true; clearInterval(timer); timer = setInterval(tick, dur * 1000); },
    stop() { playing = false; clearInterval(timer); },
    set intensity(v) { intensity = v; }, get on() { return musicOn; },
    toggle() { musicOn = !musicOn; try { localStorage.setItem('ax_music', musicOn ? '1' : '0'); } catch (e) {} return musicOn; },
  };
}

// ---------------------------------------------------------------- toy robots (original designs, cartoon only)
// robot({ body, trim, visor, kind: 'bolt'|'tank'|'scout'|'heavy', s }) → Group with .torso .head .legs[2] .arm .muzzle .mat .walk(t, amt) .flash() .update(dt)
export function robot({ body = '#3a86ff', trim = '#ffd23f', visor = '#9ff3ff', kind = 'bolt', s = 1, gun = '#2b2d42' } = {}) {
  const g = new THREE.Group(), m = vmat({ emissive: new THREE.Color(0) });
  const torsoGeo = [], cap = (r, l) => new THREE.CapsuleGeometry(r, l, 4, 10);
  const wide = kind === 'heavy' ? 1.25 : kind === 'scout' ? 0.85 : 1;
  torsoGeo.push(part(new THREE.CylinderGeometry(0.42 * wide, 0.34 * wide, 0.7, 12), body, { y: 0 }));
  torsoGeo.push(part(G.cyl, trim, { y: 0.12, sx: 0.44 * wide, sz: 0.44 * wide, sy: 0.08 }));
  torsoGeo.push(part(G.sph, trim, { y: 0, z: 0.36 * wide, s: 0.11 }));
  torsoGeo.push(part(G.box, body, { y: -0.42, sx: 0.5 * wide, sy: 0.16, sz: 0.36 }));
  for (const sd of [-1, 1]) torsoGeo.push(part(G.sph, trim, { x: sd * 0.46 * wide, y: 0.22, s: 0.17 }));   // shoulders
  if (kind === 'heavy') torsoGeo.push(part(G.box, gun, { y: 0.1, z: -0.38, sx: 0.5, sy: 0.5, sz: 0.25 }));
  const torso = new THREE.Mesh(merge(torsoGeo), m); torso.position.y = 1.0; torso.castShadow = true; g.add(torso);
  const headGeo = [];
  if (kind === 'tank') { headGeo.push(part(G.box, body, { sx: 0.62, sy: 0.4, sz: 0.5 })); headGeo.push(part(G.box, visor, { z: 0.22, sx: 0.5, sy: 0.14, sz: 0.1 })); }
  else { headGeo.push(part(G.sph, body, { sx: 0.3, sy: 0.27, sz: 0.3 })); headGeo.push(part(G.box, visor, { z: 0.22, y: 0.02, sx: 0.4, sy: 0.12, sz: 0.14 })); }
  headGeo.push(part(G.cyl, trim, { y: 0.32, sx: 0.025, sz: 0.025, sy: 0.25 })); headGeo.push(part(G.sph, trim, { y: 0.46, s: 0.07 }));
  if (kind === 'scout') { headGeo.push(part(G.cone, trim, { x: -0.2, y: 0.25, s: 0.1, sy: 0.25, rz: 0.4 })); headGeo.push(part(G.cone, trim, { x: 0.2, y: 0.25, s: 0.1, sy: 0.25, rz: -0.4 })); }
  const head = new THREE.Mesh(merge(headGeo), m); head.position.y = 0.62; head.castShadow = true; torso.add(head);
  const legGeo = merge([part(cap(0.12, 0.36), gun, { y: -0.24 }), part(G.box, trim, { y: -0.52, z: 0.06, sx: 0.26, sy: 0.12, sz: 0.36 })]);
  const legs = [-1, 1].map(sd => { const p = new THREE.Group(); p.position.set(sd * 0.2 * wide, 0.62, 0); const l = new THREE.Mesh(legGeo, m); l.castShadow = true; p.add(l); g.add(p); return p; });
  // blaster arm (right) — chunky toy foam blaster
  const arm = new THREE.Group(); arm.position.set(0.52 * wide, 0.18, 0.05); torso.add(arm);
  const gunGeo = merge([part(cap(0.09, 0.28), body, { rx: Math.PI / 2, z: 0.1 }), part(G.box, gun, { z: 0.38, sx: 0.16, sy: 0.18, sz: 0.5 }), part(G.cyl, trim, { z: 0.68, rx: Math.PI / 2, sx: 0.08, sz: 0.08, sy: 0.14 }), part(G.box, trim, { y: 0.12, z: 0.32, sx: 0.06, sy: 0.08, sz: 0.24 })]);
  const gm = new THREE.Mesh(gunGeo, m); gm.castShadow = true; arm.add(gm);
  const muzzle = new THREE.Object3D(); muzzle.position.z = 0.78; arm.add(muzzle);
  const armL = new THREE.Mesh(merge([part(cap(0.09, 0.3), body, { y: -0.2 }), part(G.sph, trim, { y: -0.42, s: 0.11 })]), m); armL.position.set(-0.48 * wide, 0.2, 0); armL.rotation.x = -0.3; torso.add(armL);
  g.scale.setScalar(s);
  let fl = 0, rec = 0;
  Object.assign(g, {
    torso, head, legs, arm, muzzle, mat: m, armL,
    walk(t, amt = 1) { const a = Math.sin(t * 11) * 0.7 * amt; legs[0].rotation.x = a; legs[1].rotation.x = -a; armL.rotation.x = -0.3 - a * 0.6; torso.position.y = 1.0 + Math.abs(Math.cos(t * 11)) * 0.06 * amt; torso.rotation.z = Math.sin(t * 11) * 0.04 * amt; },
    flash(c = '#ffffff', n = 1) { fl = n; m.emissive.set(c); },
    recoil() { rec = 1; },
    update(dt) { if (fl > 0) { fl -= 0.12 * dt; m.emissiveIntensity = Math.max(0, fl) * 0.9; } arm.position.z = 0.05 - rec * 0.14; rec = Math.max(0, rec - 0.2 * dt); },
  });
  return g;
}

/** spark/confetti pop for a defeated robot or slime (cartoon) */
export const POP = ['#ffd23f', '#ffffff', '#ff8c42', '#9ff3ff'];
