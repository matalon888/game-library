// The three puzzle boards as glossy 3D tiles on a breakfast tray. They hang in front of the camera (camera space), so
// they stay put while the nook breathes behind them. Layout comes from a pixel rectangle the DOM reserves.
import { THREE, rounded } from './kit/hc.js';

const PI = Math.PI, V3 = THREE.Vector3, D = 6;
const easeBack = t => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const easeIO = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export const COL = {
  tile: '#e6d3b6', typed: '#fffaf3', ink: '#3b2a26',
  correct: '#24863f', present: '#d48300', absent: '#6c645c',
  correctHC: '#d9600f', presentHC: '#1f6fc0',
  REG: ['#f0687d', '#f4b72c', '#4dbf7c', '#5e8ff0', '#9b70e6', '#f4883f', '#9cc63f', '#2fbdb6'],
};

// ---------------------------------------------------------------- glyph textures (white on transparent; tinted by material colour)
const glyphs = new Map();
export function glyph(text, { weight = 800, scale = 0.72, font = 'Nunito' } = {}) {
  const key = text + weight + scale + font; if (glyphs.has(key)) return glyphs.get(key);
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  let size = 256 * scale; x.font = `${weight} ${size}px ${font}, system-ui, sans-serif`;
  const w = x.measureText(text).width; if (w > 230) { size *= 230 / w; x.font = `${weight} ${size}px ${font}, system-ui, sans-serif`; }
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128, 138);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; glyphs.set(key, t); return t;
}
export const clearGlyphs = () => { for (const t of glyphs.values()) t.dispose(); glyphs.clear(); };

function shadowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 6, 32, 32, 32); g.addColorStop(0, 'rgba(90,50,30,.55)'); g.addColorStop(1, 'rgba(90,50,30,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t;
}
const glossy = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.75, ...o });

export function createBoards(S) {
  const { cam } = S;
  const root = new THREE.Group(); cam.add(root); root.visible = false;
  const light = new THREE.DirectionalLight('#fff4e4', 1.35); light.position.set(-2, 3, 2); light.target.position.set(0, 0, -D); cam.add(light, light.target);
  const tweens = [];
  const anim = (dur, fn, delay = 0) => new Promise(res => tweens.push({ t: -delay, dur, fn, res }));
  const shTex = shadowTex();

  // tray
  const trayG = new THREE.Group(); root.add(trayG);
  const trayRim = new THREE.Mesh(rounded(1, 1, 0.2, 0.1), glossy('#d08a4a', { roughness: 0.35, clearcoat: 0.8 }));
  const trayTop = new THREE.Mesh(rounded(1, 1, 0.2, 0.06), new THREE.MeshPhysicalMaterial({ color: '#fbeedb', roughness: 0.6, clearcoat: 0.3, clearcoatRoughness: 0.4 }));
  trayG.add(trayRim, trayTop);
  const dim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#fbe7cc', transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false }));
  dim.renderOrder = -1; cam.add(dim); dim.visible = false;

  let rect = null, kind = null, B = null;
  /** px rect → camera-space rect at distance D */
  function wr(r) {
    const vh = 2 * D * Math.tan(cam.fov * PI / 360), s = vh / innerHeight;
    return { cx: (r.x + r.w / 2 - innerWidth / 2) * s, cy: -(r.y + r.h / 2 - innerHeight / 2) * s, w: r.w * s, h: r.h * s, s };
  }
  // the tray is rebuilt at its real size (scaling a rounded box would stretch its corners); pad/rim in world units
  let trayKey = '';
  function layoutTray(w, h, cx, cy, pad, rim) {
    const key = [w, h, pad, rim].map(v => v.toFixed(3)).join();
    if (key !== trayKey) {
      trayKey = key; const r1 = Math.min(pad * 0.9, 0.14), r2 = Math.min(rim * 0.9, 0.12);
      trayTop.geometry.dispose(); trayRim.geometry.dispose();
      trayTop.geometry = rounded(w + pad * 2 - r1 * 1.8, h + pad * 2 - r1 * 1.8, 0.16, r1);
      trayRim.geometry = rounded(w + (pad + rim) * 2 - r2 * 1.8, h + (pad + rim) * 2 - r2 * 1.8, 0.24, r2);
    }
    trayG.position.set(cx, cy, -D - 0.22); trayRim.position.z = -0.06; trayTop.position.z = 0.02;
    trayRim.scale.set(1, 1, 1); trayTop.scale.set(1, 1, 1);
    const vh = 2 * (D + 0.7) * Math.tan(cam.fov * PI / 360); dim.scale.set(vh * cam.aspect * 1.2, vh * 1.2, 1); dim.position.set(0, 0, -D - 0.7);
  }
  /** shrink a px rect to the part the tiles may use (the tray's pad + rim sit around it) */
  const PADPX = 12, RIMPX = 9;
  const inner = W => { const m = (PADPX + RIMPX + 3) * W.s; return { ...W, w: W.w - 2 * m, h: W.h - 2 * m, pad: PADPX * W.s, rim: RIMPX * W.s }; };

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function hit(px, py, list) {
    ndc.set(px / innerWidth * 2 - 1, -(py / innerHeight) * 2 + 1); cam.updateMatrixWorld(true); ray.setFromCamera(ndc, cam);
    const h = ray.intersectObjects(list, false)[0]; return h ? h.object : null;
  }

  function makeTile(w, h, d, color, r = 0.14) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(rounded(w, h, d, Math.min(r, w * 0.2)), glossy(color)); g.add(body);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.86, h * 0.86), new THREE.MeshBasicMaterial({ transparent: true, color: COL.ink, toneMapped: false, depthWrite: false }));
    gl.position.z = d / 2 + 0.005; gl.visible = false; g.add(gl);
    const shd = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.5, h * 1.5), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, opacity: 0.4, depthWrite: false }));
    shd.position.set(w * 0.05, -h * 0.08, -d / 2 - 0.02); g.add(shd);
    body.userData.tile = g; g.userData = { body, gl, shd, w, h, d };
    return g;
  }
  // the composer tone-maps everything (ACES), so pure white glyphs would come out grey: push light inks above 1
const inkColor = (m, c) => { m.color.set(c); const l = m.color.r * 0.3 + m.color.g * 0.59 + m.color.b * 0.11; if (l > 0.8) m.color.multiplyScalar(2.1); };
const setGlyph = (t, text, color = COL.ink, o) => { const gl = t.userData.gl; if (!text) { gl.visible = false; return; } gl.material.map = glyph(text, o); inkColor(gl.material, color); gl.material.needsUpdate = true; gl.visible = true; };

  function clear() {
    if (B && B.group) { root.remove(B.group); B.group.traverse(o => { if (o.isMesh && o.material && o.material.dispose && !o.userData.keepMat) o.material.dispose(); }); }
    B = null; kind = null; tweens.length = 0;
  }

  // ---------------------------------------------------------------- word board: 6 rows × 5
  function word(rows = 6) {
    clear(); kind = 'word';
    const group = new THREE.Group(); root.add(group);
    const tiles = [...Array(rows)].map(() => [...Array(5)].map(() => { const t = makeTile(1, 1, 0.34, COL.tile, 0.16); t.userData.body.scale.z = 0.55; group.add(t); return t; }));
    B = { group, tiles, size: 1, hc: false };
    return {
      layout(r) {
        rect = r; const W = inner(wr(r)), gap = 0.12, s = Math.min(W.w / (5 + gap * 4), W.h / (rows + gap * (rows - 1)));
        B.size = s;
        for (let y = 0; y < rows; y++) for (let x = 0; x < 5; x++) { const t = tiles[y][x]; t.scale.setScalar(s); t.position.set(W.cx + (x - 2) * s * (1 + gap), W.cy + ((rows - 1) / 2 - y) * s * (1 + gap), -D); t.userData.home = t.position.clone(); }
        layoutTray(s * (5 + gap * 4), s * (rows + gap * (rows - 1)), W.cx, W.cy, W.pad, W.rim);
      },
      type(y, x, ch) {
        const t = tiles[y][x]; setGlyph(t, ch ? ch.toUpperCase() : '', COL.ink);
        t.userData.body.material.color.set(ch ? COL.typed : COL.tile); t.userData.body.scale.z = ch ? 1 : 0.55;
        if (ch) anim(0.14, k => { const s = 1 + Math.sin(k * PI) * 0.12; t.scale.setScalar(B.size * s); t.position.z = -D + Math.sin(k * PI) * 0.15; });
      },
      async reveal(y, marks, letters, fast = false) {
        const cols = [COL.absent, B.hc ? COL.presentHC : COL.present, B.hc ? COL.correctHC : COL.correct];
        const ps = marks.map((m, x) => {
          const t = tiles[y][x];
          if (fast) { t.userData.body.scale.z = 1; t.userData.body.material.color.set(cols[m]); setGlyph(t, letters[x].toUpperCase(), '#ffffff'); return Promise.resolve(); }
          let swapped = false;
          return anim(0.42, k => {
            t.rotation.x = k < 0.5 ? easeIO(k * 2) * PI / 2 : (1 - easeIO((k - 0.5) * 2)) * PI / 2;
            if (k >= 0.5 && !swapped) { swapped = true; t.userData.body.scale.z = 1; t.userData.body.material.color.set(cols[m]); setGlyph(t, letters[x].toUpperCase(), '#ffffff'); S.onFlip && S.onFlip(m, x); }
          }, x * 0.26).then(() => { t.rotation.x = 0; });
        });
        await Promise.all(ps);
      },
      shake(y) { return anim(0.45, k => { for (let x = 0; x < 5; x++) tiles[y][x].position.x = tiles[y][x].userData.home.x + Math.sin(k * PI * 6) * (1 - k) * B.size * 0.22; }); },
      dance(y) { return Promise.all(tiles[y].map((t, x) => anim(0.5, k => { t.position.y = t.userData.home.y + Math.sin(k * PI) * B.size * 0.45; t.position.z = -D + Math.sin(k * PI) * 0.4; }, x * 0.09))); },
      hint(y, x, ch) { const t = tiles[y][x]; setGlyph(t, ch.toUpperCase(), B.hc ? COL.correctHC : COL.correct); t.userData.body.material.color.set('#eaf7ec'); anim(0.4, k => t.scale.setScalar(B.size * (1 + Math.sin(k * PI) * 0.18))); },
      setHC(v) { B.hc = v; },
      get group() { return group; },
    };
  }

  // ---------------------------------------------------------------- logic board ("Sunny Side")
  let eggProto = null;
  function egg() {
    if (!eggProto) {
      const white = new THREE.SphereGeometry(0.5, 32, 12); const p = white.attributes.position, v = new V3();
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const a = Math.atan2(v.z, v.x), w = 1 + 0.09 * Math.sin(a * 5 + 1) + 0.05 * Math.sin(a * 9); p.setXYZ(i, v.x * w, v.y * 0.16, v.z * w * 0.92); }
      white.computeVertexNormals(); white.rotateX(PI / 2);
      const yolk = new THREE.SphereGeometry(0.22, 24, 16); yolk.scale(1, 1, 0.62); yolk.translate(0.03, 0.04, 0.09);
      eggProto = { white, yolk, wm: glossy('#fffdf8', { roughness: 0.3 }), ym: glossy('#ffb21f', { roughness: 0.12, emissive: '#ff8a00', emissiveIntensity: 0.18 }) };
      eggProto.wm.userData.keep = true; eggProto.ym.userData.keep = true;
    }
    const g = new THREE.Group(); const w = new THREE.Mesh(eggProto.white, eggProto.wm), y = new THREE.Mesh(eggProto.yolk, eggProto.ym);
    w.userData.keepMat = y.userData.keepMat = true; g.add(w, y); return g;
  }
  function logic(N, reg) {
    clear(); kind = 'logic';
    const group = new THREE.Group(); root.add(group);
    const tiles = [], eggs = [], bars = [];
    for (let y = 0; y < N; y++) { tiles.push([]); eggs.push([]); for (let x = 0; x < N; x++) { const t = makeTile(1, 1, 0.3, COL.REG[reg[y][x] % 8], 0.1); t.userData.y = y; t.userData.x = x; group.add(t); tiles[y].push(t); eggs[y].push(null); } }
    const barMat = new THREE.MeshStandardMaterial({ color: '#5a3b33', roughness: 0.5 });
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (x < N - 1 && reg[y][x] !== reg[y][x + 1]) bars.push({ v: true, y, x });
      if (y < N - 1 && reg[y][x] !== reg[y + 1][x]) bars.push({ v: false, y, x });
    }
    const barMeshes = bars.map(b => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), barMat); group.add(m); return { ...b, m }; });
    B = { group, tiles, eggs, N, size: 1 };
    const api = {
      layout(r) {
        rect = r; const W = inner(wr(r)), gap = 0.07, s = Math.min(W.w, W.h) / (N + gap * (N - 1)); B.size = s;
        const pitch = s * (1 + gap), o = (N - 1) / 2;
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const t = tiles[y][x]; t.scale.set(s, s, s * 0.9); t.position.set(W.cx + (x - o) * pitch, W.cy + (o - y) * pitch, -D); t.userData.home = t.position.clone(); const e = eggs[y][x]; if (e) e.position.set(t.position.x, t.position.y, -D + s * 0.2); }
        for (const b of barMeshes) {
          const th = s * gap * 1.4;
          if (b.v) { b.m.scale.set(th, pitch + th * 0.5, s * 0.34); b.m.position.set(W.cx + (b.x - o + 0.5) * pitch, W.cy + (o - b.y) * pitch, -D + 0.02); }
          else { b.m.scale.set(pitch + th * 0.5, th, s * 0.34); b.m.position.set(W.cx + (b.x - o) * pitch, W.cy + (o - b.y - 0.5) * pitch, -D + 0.02); }
        }
        layoutTray(pitch * N - s * gap, pitch * N - s * gap, W.cx, W.cy, W.pad, W.rim);
      },
      set(y, x, st, quiet = false) {   // st: 0 empty, 1 ×, 2 egg
        const t = tiles[y][x];
        setGlyph(t, st === 1 ? '×' : '', '#6b4a40', { weight: 700, scale: 0.6 });
        if (st === 1) t.userData.gl.material.opacity = 0.55;
        if (st === 2 && !eggs[y][x]) {
          const e = egg(); e.position.set(t.position.x, t.position.y, -D + B.size * 0.2); group.add(e); eggs[y][x] = e;
          if (quiet) e.scale.setScalar(B.size * 1.02); else anim(0.35, k => { e.scale.setScalar(B.size * 1.02 * Math.max(0.01, easeBack(k))); e.rotation.z = (1 - k) * 0.8; });
        }
        if (st !== 2 && eggs[y][x]) { const e = eggs[y][x]; eggs[y][x] = null; anim(0.16, k => e.scale.setScalar(B.size * 1.02 * (1 - k))).then(() => group.remove(e)); }
        if (!quiet) anim(0.16, k => { t.position.z = -D - Math.sin(k * PI) * 0.12; });
      },
      conflicts(set) {   // set of "y,x" whose eggs break a rule: tint them red
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
          const m = tiles[y][x].userData.body.material, bad = set.has(y + ',' + x);
          m.emissive.set(bad ? '#ff2a2a' : '#000000'); m.emissiveIntensity = bad ? 0.35 : 0;
        }
      },
      flashRow(cells) { cells.forEach(([y, x], i) => { const t = tiles[y][x]; anim(0.4, k => { t.position.z = -D + Math.sin(k * PI) * 0.25; }, i * 0.04); }); },
      async celebrate() {
        const all = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const t = tiles[y][x], d = (y + x) * 0.04; all.push(anim(0.5, k => { t.position.z = -D + Math.sin(k * PI) * 0.5; t.rotation.y = Math.sin(k * PI) * 0.3; }, d)); }
        await Promise.all(all);
      },
      pick(px, py) { const o = hit(px, py, tiles.flat().map(t => t.userData.body)); return o ? { y: o.userData.tile.userData.y, x: o.userData.tile.userData.x } : null; },
      get group() { return group; },
    };
    return api;
  }

  // ---------------------------------------------------------------- number board ("Perfect Blend"): six round tiles
  let puckGeo = null;
  function puck() {
    if (!puckGeo) {
      const R = 0.5, d = 0.32, b = 0.1, pts = [new THREE.Vector2(0, -d / 2)];
      for (let i = 0; i <= 6; i++) { const a = -PI / 2 + i / 6 * PI / 2; pts.push(new THREE.Vector2(R - b + Math.cos(a) * b, -d / 2 + b + Math.sin(a) * b)); }
      for (let i = 0; i <= 6; i++) { const a = i / 6 * PI / 2; pts.push(new THREE.Vector2(R - b + Math.cos(a) * b, d / 2 - b + Math.sin(a) * b)); }
      pts.push(new THREE.Vector2(0, d / 2));
      puckGeo = new THREE.LatheGeometry(pts, 48); puckGeo.rotateX(PI / 2);
    }
    const g = new THREE.Group(); const body = new THREE.Mesh(puckGeo, glossy('#fff6ea')); g.add(body);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.82), new THREE.MeshBasicMaterial({ transparent: true, color: COL.ink, toneMapped: false, depthWrite: false })); gl.position.z = 0.165; g.add(gl);
    const shd = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, opacity: 0.4, depthWrite: false })); shd.position.set(0.05, -0.08, -0.18); g.add(shd);
    body.userData.tile = g; g.userData = { body, gl, shd };
    return g;
  }
  function number() {
    clear(); kind = 'number';
    const group = new THREE.Group(); root.add(group);
    const slots = [...Array(6)].map((_, i) => { const t = puck(); t.userData.i = i; group.add(t); return t; });
    B = { group, slots, size: 1, home: [] };
    const paint = (t, v, sel, used) => {
      t.visible = !used;
      t.userData.body.material.color.set(sel ? '#ffcf5a' : '#fff6ea');
      t.userData.body.material.emissive.set(sel ? '#ff9a00' : '#000000'); t.userData.body.material.emissiveIntensity = sel ? 0.12 : 0;
      setGlyph(t, String(v), sel ? '#5b3410' : COL.ink, { scale: String(v).length > 2 ? 0.5 : 0.62 });
    };
    return {
      layout(r) {
        rect = r; const W = inner(wr(r)), s = Math.min(W.w / 3.4, W.h / 2.2); B.size = s;
        for (let i = 0; i < 6; i++) { const t = slots[i], cx = W.cx + ((i % 3) - 1) * s * 1.18, cy = W.cy + (i < 3 ? 0.56 : -0.56) * s * 1.05; t.scale.setScalar(s); t.position.set(cx, cy, -D); B.home[i] = new V3(cx, cy, -D); }
        layoutTray(s * 3.36, s * 2.16, W.cx, W.cy, W.pad, W.rim);
      },
      show(vals, sel = -1) { vals.forEach((v, i) => paint(slots[i], v, i === sel, v == null)); },
      pop(i) { const t = slots[i]; return anim(0.3, k => { t.scale.setScalar(B.size * Math.max(0.01, easeBack(k))); t.position.z = -D + Math.sin(k * PI) * 0.3; }); },
      lift(i, on) { const t = slots[i]; anim(0.16, k => { t.position.z = -D + (on ? k : 1 - k) * 0.35; }); },
      async merge(a, b) {   // tile a flies into tile b
        const ta = slots[a], from = ta.position.clone(), to = B.home[b].clone();
        await anim(0.26, k => { ta.position.lerpVectors(from, to, easeIO(k)); ta.position.z = -D + Math.sin(k * PI) * 0.6; ta.scale.setScalar(B.size * (1 - k * 0.4)); });
        ta.position.copy(B.home[a]); ta.scale.setScalar(B.size);
      },
      wobble(i) { const t = slots[i]; return anim(0.35, k => { t.rotation.z = Math.sin(k * PI * 5) * (1 - k) * 0.25; }); },
      async celebrate(i) { const t = slots[i]; await anim(0.7, k => { t.rotation.y = easeIO(k) * PI * 2; t.position.z = -D + Math.sin(k * PI) * 0.8; t.scale.setScalar(B.size * (1 + Math.sin(k * PI) * 0.35)); }); },
      pick(px, py) { const o = hit(px, py, slots.filter(t => t.visible).map(t => t.userData.body)); return o ? o.userData.tile.userData.i : -1; },
      screenOf(i) { const p = slots[i].getWorldPosition(new V3()).project(cam); return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight }; },
      get group() { return group; },
    };
  }

  function update(dt) {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i]; tw.t += dt; if (tw.t < 0) continue; const k = Math.min(1, tw.t / tw.dur); tw.fn(k);
      if (k >= 1) { tweens.splice(i, 1); tw.res(); }
    }
  }
  function show(on) { root.visible = on; dim.visible = on; }
  return { word, logic, number, clear, update, show, root, get kind() { return kind; } };
}
