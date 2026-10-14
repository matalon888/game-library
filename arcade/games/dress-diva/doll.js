// doll.js — stylised 3D fashion doll (original design) + wardrobe item builders that attach to its "bones".
import { THREE } from './kit/hc.js';
import { canvasTex } from './geo.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.02, ...o });

// ---------------------------------------------------------------- fabric textures (cached)
const texCache = {};
export function fabric(kind, color, accent = '#ffffff') {
  const key = kind + color + accent; if (texCache[key]) return texCache[key];
  const t = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    if (kind === 'stripes') { g.fillStyle = accent; for (let y = 0; y < h; y += 32) g.fillRect(0, y, w, 13); }
    if (kind === 'dots') { g.fillStyle = accent; for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 32) { g.beginPath(); g.arc(x + (y / 32 % 2) * 16 + 8, y + 8, 6, 0, 7); g.fill(); } }
    if (kind === 'floral') { for (let i = 0; i < 9; i++) { const x = (i * 47) % w, y = (i * 71) % h; g.fillStyle = [accent, '#ffffff', '#ff8fab'][i % 3]; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + Math.cos(k * 1.256) * 7, y + Math.sin(k * 1.256) * 7, 5, 0, 7); g.fill(); } g.fillStyle = '#ffd166'; g.beginPath(); g.arc(x, y, 3.5, 0, 7); g.fill(); } }
    if (kind === 'sequin') { for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 8) { const v = Math.random(); g.fillStyle = v > 0.8 ? 'rgba(255,255,255,.85)' : v < 0.3 ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.15)'; g.beginPath(); g.arc(x + 4 + (y % 16 ? 4 : 0), y + 4, 3.4, 0, 7); g.fill(); } }
    if (kind === 'denim') { for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.12})`; g.fillRect(Math.random() * w, Math.random() * h, 6, 1); } g.strokeStyle = 'rgba(255,220,150,.5)'; g.setLineDash([4, 3]); g.lineWidth = 2; g.beginPath(); g.moveTo(64, 0); g.lineTo(64, h); g.stroke(); }
    if (kind === 'knit') { g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 3; for (let x = 0; x < w; x += 16) for (let y = 0; y < h; y += 12) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 8, y + 10); g.lineTo(x + 16, y); g.stroke(); } }
    if (kind === 'plaid') { g.fillStyle = 'rgba(80,40,30,.25)'; for (let i = 0; i < w; i += 32) { g.fillRect(i, 0, 10, h); g.fillRect(0, i, w, 10); } g.fillStyle = 'rgba(255,255,255,.25)'; for (let i = 16; i < w; i += 32) { g.fillRect(i, 0, 2, h); g.fillRect(0, i, w, 2); } }
    if (kind === 'fur') { for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.3})`; g.fillRect(Math.random() * w, Math.random() * h, 1.5, 4); } }
  }, true);
  t.repeat.set(kind === 'stripes' ? 1 : 3, kind === 'stripes' ? 4 : 3);
  return (texCache[key] = t);
}
export function cloth(color, pattern = 'solid', accent, o = {}) {
  const m = new THREE.MeshStandardMaterial({ color: pattern === 'solid' ? color : '#ffffff', roughness: pattern === 'sequin' ? 0.25 : 0.7, metalness: pattern === 'sequin' ? 0.55 : 0.02, side: THREE.DoubleSide, ...o });
  if (pattern !== 'solid') m.map = fabric(pattern, color, accent);
  if (pattern === 'sequin') { m.emissive = new THREE.Color(color).multiplyScalar(0.18); }
  return m;
}

// ---------------------------------------------------------------- body
const TORSO = [[0.0, 0.205], [0.12, 0.185], [0.3, 0.158], [0.42, 0.165], [0.56, 0.2], [0.66, 0.212], [0.76, 0.2], [0.86, 0.17], [0.93, 0.12], [0.97, 0.06], [0.98, 0.0]];
function lathe(prof, ya, yb, grow = 0, add = 0, seg = 36) {
  const pts = [];
  for (const [y, r] of prof) if (y >= ya - 1e-6 && y <= yb + 1e-6) pts.push(new THREE.Vector2(r * (1 + grow) + add, y));
  return new THREE.LatheGeometry(pts, seg);
}
const torsoR = y => { for (let i = 1; i < TORSO.length; i++) if (y <= TORSO[i][0]) { const [y0, r0] = TORSO[i - 1], [y1, r1] = TORSO[i]; return r0 + (r1 - r0) * (y - y0) / (y1 - y0); } return 0; };

export function drawFace(ctx, skin, lip = '#d0857a', shadow = '#c49a86', eye = '#5a3b2a', blush = 0.35) {
  const W = 1024, H = 512, cx = 256, ey = 262;
  ctx.fillStyle = skin; ctx.fillRect(0, 0, W, H);
  const shade = (a) => { ctx.fillStyle = `rgba(160,80,60,${a})`; };
  for (const s of [-1, 1]) {
    const x = cx + s * 46;
    // eyeshadow
    const gs = ctx.createRadialGradient(x, ey - 8, 4, x, ey - 8, 34); gs.addColorStop(0, shadow); gs.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.85; ctx.fillStyle = gs; ctx.beginPath(); ctx.ellipse(x, ey - 10, 34, 22, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    // eye white (almond)
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(x - 24, ey); ctx.quadraticCurveTo(x, ey - 24, x + 24, ey - 2); ctx.quadraticCurveTo(x, ey + 17, x - 24, ey); ctx.fill();
    // iris + pupil + highlights
    ctx.save(); ctx.clip();
    const gi = ctx.createRadialGradient(x, ey - 4, 2, x, ey - 4, 15); gi.addColorStop(0, '#1b0f0a'); gi.addColorStop(0.35, eye); gi.addColorStop(1, '#1e120c');
    ctx.fillStyle = gi; ctx.beginPath(); ctx.arc(x + s * 1, ey - 4, 14.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#0c0606'; ctx.beginPath(); ctx.arc(x + s * 1, ey - 4, 6.5, 0, 7); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x + 5, ey - 10, 4, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(x - 5, ey + 1, 2, 0, 7); ctx.fill();
    // lash line with a little wing
    ctx.strokeStyle = '#1a0f0c'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - s * 25, ey + 1); ctx.quadraticCurveTo(x, ey - 26, x + s * 27, ey - 7); ctx.lineTo(x + s * 34, ey - 14); ctx.stroke();
    ctx.lineWidth = 2.5; for (let k = 0; k < 4; k++) { const t = 0.45 + k * 0.17, lx = x - s * 25 + (s * 52) * t, ly = ey - 20 * Math.sin(t * Math.PI) + 2; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + s * 5, ly - 8); ctx.stroke(); }
    // brow
    ctx.strokeStyle = 'rgba(60,35,25,.85)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x - s * 22, ey - 36); ctx.quadraticCurveTo(x + s * 4, ey - 50, x + s * 28, ey - 40); ctx.stroke();
    // blush
    const gb = ctx.createRadialGradient(x + s * 12, ey + 46, 2, x + s * 12, ey + 46, 30); gb.addColorStop(0, `rgba(255,110,130,${blush})`); gb.addColorStop(1, 'rgba(255,110,130,0)');
    ctx.fillStyle = gb; ctx.beginPath(); ctx.arc(x + s * 12, ey + 46, 30, 0, 7); ctx.fill();
  }
  // nose
  shade(0.28); ctx.beginPath(); ctx.ellipse(cx, ey + 38, 7, 4, 0, 0, 7); ctx.fill();
  // lips
  const ly = ey + 74;
  ctx.fillStyle = lip; ctx.beginPath(); ctx.moveTo(cx - 25, ly); ctx.quadraticCurveTo(cx - 12, ly - 13, cx, ly - 6); ctx.quadraticCurveTo(cx + 12, ly - 13, cx + 25, ly); ctx.quadraticCurveTo(cx, ly + 20, cx - 25, ly); ctx.fill();
  ctx.strokeStyle = 'rgba(80,20,20,.45)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - 23, ly); ctx.quadraticCurveTo(cx, ly + 4, cx + 23, ly); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.ellipse(cx - 6, ly + 7, 6, 2.5, 0, 0, 7); ctx.fill();
}

export function createDoll(skin = '#f1c7a5') {
  const root = new THREE.Group();
  const skinM = std(skin, { roughness: 0.6 });
  const bodyMeshes = [];
  const mk = (geo, m, parent, o = {}) => { const me = new THREE.Mesh(geo, m); Object.assign(me.position, { x: o.x || 0, y: o.y || 0, z: o.z || 0 }); if (o.s) me.scale.set(...o.s); if (o.r) me.rotation.set(...o.r); me.castShadow = true; me.receiveShadow = true; parent.add(me); return me; };
  const pelvis = new THREE.Group(); pelvis.position.y = 1.56; root.add(pelvis);
  const torso = new THREE.Group(); torso.position.y = 0.12; pelvis.add(torso);
  bodyMeshes.push(mk(new THREE.SphereGeometry(0.22, 24, 16), skinM, pelvis, { y: 0.06, s: [1.06, 0.82, 0.82] }));
  const tm = mk(lathe(TORSO, 0, 0.98), skinM, torso, { s: [1, 1, 0.74] }); bodyMeshes.push(tm);
  bodyMeshes.push(mk(new THREE.CylinderGeometry(0.06, 0.07, 0.22, 16), skinM, torso, { y: 1.02 }));
  const head = new THREE.Group(); head.position.y = 1.42; head.scale.setScalar(1.16); torso.add(head);
  const faceCanvas = document.createElement('canvas'); faceCanvas.width = 1024; faceCanvas.height = 512;
  const faceCtx = faceCanvas.getContext('2d'); drawFace(faceCtx, skin);
  const faceTex = new THREE.CanvasTexture(faceCanvas); faceTex.colorSpace = THREE.SRGBColorSpace; faceTex.anisotropy = 4;
  const headM = mk(new THREE.SphereGeometry(0.33, 48, 32), new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.6 }), head, { s: [0.94, 1.1, 0.96] }); bodyMeshes.push(headM);
  for (const s of [-1, 1]) bodyMeshes.push(mk(new THREE.SphereGeometry(0.06, 12, 10), skinM, head, { x: s * 0.31, y: -0.02, s: [0.5, 1, 0.8] }));
  const armU = [], armL = [], hand = [], legU = [], legL = [], foot = [];
  for (const [i, s] of [[0, -1], [1, 1]]) {
    const sh = new THREE.Group(); sh.position.set(s * 0.22, 0.86, 0); torso.add(sh); armU[i] = sh;
    bodyMeshes.push(mk(new THREE.SphereGeometry(0.075, 14, 10), skinM, sh));
    bodyMeshes.push(mk(new THREE.CylinderGeometry(0.07, 0.056, 0.5, 14), skinM, sh, { y: -0.27 }));
    const el = new THREE.Group(); el.position.y = -0.53; sh.add(el); armL[i] = el;
    bodyMeshes.push(mk(new THREE.SphereGeometry(0.056, 12, 8), skinM, el));
    bodyMeshes.push(mk(new THREE.CylinderGeometry(0.055, 0.042, 0.46, 14), skinM, el, { y: -0.23 }));
    const hd = new THREE.Group(); hd.position.y = -0.5; el.add(hd); hand[i] = hd;
    bodyMeshes.push(mk(new THREE.SphereGeometry(0.06, 14, 10), skinM, hd, { s: [0.7, 1.15, 0.5] }));
    sh.rotation.z = s * 0.12; el.rotation.x = -0.1;
    const hp = new THREE.Group(); hp.position.set(s * 0.115, -0.02, 0); pelvis.add(hp); legU[i] = hp;
    bodyMeshes.push(mk(new THREE.CylinderGeometry(0.128, 0.088, 0.74, 18), skinM, hp, { y: -0.37 }));
    const kn = new THREE.Group(); kn.position.y = -0.74; hp.add(kn); legL[i] = kn;
    bodyMeshes.push(mk(new THREE.SphereGeometry(0.088, 12, 10), skinM, kn));
    bodyMeshes.push(mk(new THREE.CylinderGeometry(0.086, 0.05, 0.7, 16), skinM, kn, { y: -0.35 }));
    const an = new THREE.Group(); an.position.y = -0.72; kn.add(an); foot[i] = an;
    const bare = mk(new THREE.CapsuleGeometry(0.05, 0.14, 4, 8), skinM, an, { y: -0.04, z: 0.06, r: [Math.PI / 2 - 0.2, 0, 0] }); bodyMeshes.push(bare); an.bare = bare;
  }
  const doll = { root, pelvis, torso, head, armU, armL, hand, legU, legL, foot, bodyMeshes, skinM, headM, faceCtx, faceTex, skin, items: {}, makeup: null };
  doll.setMakeup = (lip, shadow) => { drawFace(faceCtx, doll.skin, lip, shadow); faceTex.needsUpdate = true; };
  doll.setSkin = (c) => { doll.skin = c; skinM.color.set(c); doll.setMakeup(...(doll.makeup || ['#d0857a', '#c49a86'])); };
  doll.wear = (slot, item) => { (doll.items[slot] || []).forEach(m => m.parent && m.parent.remove(m)); doll.items[slot] = item ? buildItem(doll, item) : []; doll.refreshFeet(); };
  doll.refreshFeet = () => { const shod = (doll.items.shoes || []).length > 0; foot.forEach(f => f.bare.visible = !shod); };
  return doll;
}

// ---------------------------------------------------------------- wardrobe builders
function add(list, parent, geo, m, o = {}) {
  const me = new THREE.Mesh(geo, m); me.position.set(o.x || 0, o.y || 0, o.z || 0); if (o.s) me.scale.set(...o.s); if (o.r) me.rotation.set(...o.r);
  me.castShadow = true; me.receiveShadow = true; parent.add(me); list.push(me); return me;
}
const SH = 0.012;                // clothing offset over skin
function sleeves(L, d, m, long, puff = false) {
  for (let i = 0; i < 2; i++) {
    add(L, d.armU[i], new THREE.SphereGeometry(puff ? 0.12 : 0.088, 14, 10), m);
    add(L, d.armU[i], new THREE.CylinderGeometry(0.082, long ? 0.07 : 0.078, long ? 0.52 : 0.2, 14, 1, true), m, { y: long ? -0.27 : -0.1 });
    if (long) { add(L, d.armL[i], new THREE.SphereGeometry(0.07, 12, 8), m); add(L, d.armL[i], new THREE.CylinderGeometry(0.068, 0.062, 0.4, 14, 1, true), m, { y: -0.2 }); }
  }
}
function legWear(L, d, m, len /* 0..1 of leg */, wide = 0) {
  for (let i = 0; i < 2; i++) {
    add(L, d.legU[i], new THREE.CylinderGeometry(0.142 + wide * 0.3, 0.103 + wide * 0.5, 0.75, 18, 1, true), m, { y: -0.37 });
    if (len > 0.5) add(L, d.legL[i], new THREE.CylinderGeometry(0.103 + wide * 0.5, 0.074 + wide * (len > 0.9 ? 1.1 : 0.6), 0.66, 16, 1, true), m, { y: -0.33 });
    if (len > 0.5) add(L, d.legL[i], new THREE.SphereGeometry(0.104 + wide * 0.5, 12, 10), m);
  }
  add(L, d.pelvis, new THREE.SphereGeometry(0.232, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62), m, { y: 0.07, s: [1.08, 0.95, 0.86], r: [Math.PI, 0, 0] });
  add(L, d.pelvis, new THREE.CylinderGeometry(0.205 * 1.05, 0.24, 0.16, 28, 1, true), m, { y: 0.12, s: [1, 1, 0.82] });
}
function skirt(L, d, m, len, flare, tiers = 1) {
  for (let k = 0; k < tiers; k++) {
    const top = 0.18 - k * len / tiers * 0.85, l = len - k * len / tiers * 0.85, pts = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(0.215 + (flare - 0.215) * Math.pow(t, 0.8) + (k ? 0.03 * k : 0), top - l * t)); }
    add(L, d.pelvis, new THREE.LatheGeometry(pts, 40), m, { s: [1, 1, 0.86] });
  }
  add(L, d.pelvis, new THREE.CylinderGeometry(0.22, 0.23, 0.12, 28, 1, true), m, { y: 0.15, s: [1, 1, 0.84] });
}
function bodice(L, d, m, ya, yb) { add(L, d.torso, lathe(TORSO, ya, yb, 0.06, SH), m, { s: [1, 1, 0.76] }); }

export function buildItem(d, it) {
  const L = [], m = it.mat || (it.mat = cloth(it.color, it.pattern || 'solid', it.accent));
  const k = it.kind;
  // ---- hair
  if (it.cat === 'hair') {
    const hm = it.hmat || (it.hmat = new THREE.MeshStandardMaterial({ color: it.color, roughness: 0.42, metalness: 0.05, side: THREE.DoubleSide }));
    const h = d.head;
    const cap = (r = 0.355, th = 0.56, tilt = -0.42) => add(L, h, new THREE.SphereGeometry(r, 36, 20, 0, Math.PI * 2, 0, Math.PI * th), hm, { y: 0.05, z: -0.02, s: [0.98, 1.12, 1.02], r: [tilt, 0, 0] });
    if (k === 'long') {
      cap();
      add(L, h, new THREE.CapsuleGeometry(0.3, 0.8, 6, 18), hm, { y: -0.48, z: -0.15, s: [1.12, 1, 0.42] });
      for (const s of [-1, 1]) add(L, h, new THREE.CylinderGeometry(0.085, 0.03, 0.75, 10), hm, { x: s * 0.27, y: -0.4, z: 0.02, r: [0.1, 0, s * 0.1], s: [1, 1, 0.6] });
    } else if (k === 'bob') {
      cap(0.365, 0.6, -0.3);
      add(L, h, new THREE.CylinderGeometry(0.37, 0.4, 0.42, 36, 1, true, Math.PI * 0.3, Math.PI * 1.4), hm, { y: -0.13 });
      add(L, h, new THREE.CylinderGeometry(0.33, 0.37, 0.16, 30, 1, true, -Math.PI * 0.3, Math.PI * 0.6), hm, { y: 0.24, z: 0.01, r: [0.25, 0, 0] });
    } else if (k === 'pony' || k === 'bun' || k === 'twin') {
      cap(0.352, 0.62, -0.25);
      add(L, h, new THREE.SphereGeometry(0.34, 30, 16, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.3), hm, { y: 0.0, z: -0.04, s: [0.98, 1.1, 1.0] });
      if (k === 'pony') {
        const pv = new THREE.Group(); pv.position.set(0, 0.3, -0.26); h.add(pv); L.push(pv); pv.rotation.x = 0.35; d.pony = pv;
        add(L, pv, new THREE.TorusGeometry(0.06, 0.03, 8, 16), std('#ff5d8f'), { r: [Math.PI / 2, 0, 0] });
        add(L, pv, new THREE.CapsuleGeometry(0.1, 0.7, 6, 12), hm, { y: -0.42, z: -0.05, s: [1, 1, 0.8] });
        add(L, pv, new THREE.SphereGeometry(0.075, 10, 8), hm, { y: -0.85, z: -0.06 });
      } else if (k === 'bun') { add(L, h, new THREE.SphereGeometry(0.16, 20, 14), hm, { y: 0.42, z: -0.06 }); add(L, h, new THREE.TorusGeometry(0.12, 0.025, 8, 20), std('#ffd166', { metalness: 0.6, roughness: 0.3 }), { y: 0.33, z: -0.05, r: [Math.PI / 2, 0, 0] }); }
      else { for (const s of [-1, 1]) add(L, h, new THREE.SphereGeometry(0.14, 18, 12), hm, { x: s * 0.25, y: 0.33, z: -0.04 }); }
    } else if (k === 'curls') {
      cap(0.36, 0.6, -0.3);
      for (let i = 0; i < 46; i++) {
        const a = (i / 46) * Math.PI * 2 * 3.1, y = 0.42 - (i / 46) * 0.95, r = 0.36 + 0.08 * Math.sin(i * 1.7);
        const ang = Math.PI + Math.sin(a) * 1.75; // keep curls away from the face (front = +z)
        const x = Math.sin(ang) * r * (1 + (0.42 - y) * 0.25), z = Math.cos(ang) * r * 0.95 - 0.05;
        if (z > 0.18 && y < 0.2) continue;
        add(L, h, new THREE.SphereGeometry(0.1 + 0.035 * ((i * 7) % 3), 10, 8), hm, { x, y, z });
      }
    }
    return L;
  }
  // ---- tops & dresses
  if (it.cat === 'top') {
    if (k === 'crop') { bodice(L, d, m, 0.38, 0.98); sleeves(L, d, m, false); }
    if (k === 'tank') { bodice(L, d, m, 0.12, 0.86); for (const s of [-1, 1]) add(L, d.torso, new THREE.BoxGeometry(0.05, 0.16, 0.05), m, { x: s * 0.12, y: 0.9 }); }
    if (k === 'blouse') { bodice(L, d, m, 0.05, 0.98); sleeves(L, d, m, true, true); add(L, d.torso, new THREE.TorusGeometry(0.09, 0.03, 8, 20), m, { y: 0.95, r: [Math.PI / 2, 0, 0] }); }
    if (k === 'sweater') { bodice(L, d, m, 0.0, 0.98); sleeves(L, d, m, true); add(L, d.torso, new THREE.TorusGeometry(0.085, 0.05, 10, 22), m, { y: 0.98, r: [Math.PI / 2, 0, 0] }); add(L, d.torso, new THREE.CylinderGeometry(0.25, 0.235, 0.12, 28, 1, true), m, { y: 0.0, s: [1, 1, 0.8] }); }
    if (k === 'zip') { bodice(L, d, m, 0.0, 0.98); sleeves(L, d, m, true); add(L, d.torso, new THREE.TorusGeometry(0.16, 0.06, 10, 22, Math.PI * 1.3), m, { y: 0.95, z: -0.05, r: [Math.PI / 2 - 0.4, 0, Math.PI * 1.15] }); add(L, d.torso, new THREE.BoxGeometry(0.02, 0.85, 0.02), std('#ffffff'), { y: 0.47, z: 0.165 }); }
    if (k === 'jacket' || k === 'blazer') {
      add(L, d.torso, lathe(TORSO, 0.0, 0.98, 0.14, 0.02), m, { s: [1, 1, 0.8] }); sleeves(L, d, m, true);
      const inner = cloth(k === 'jacket' ? '#ffffff' : '#f6e6ff');
      add(L, d.torso, new THREE.BoxGeometry(0.14, 0.62, 0.02), inner, { y: 0.55, z: 0.178 });
      for (const s of [-1, 1]) add(L, d.torso, new THREE.BoxGeometry(0.07, 0.36, 0.02), m, { x: s * 0.08, y: 0.72, z: 0.185, r: [0, 0, s * 0.35] });
      if (k === 'jacket') add(L, d.torso, new THREE.BoxGeometry(0.015, 0.4, 0.015), std('#c0c0c8', { metalness: 0.8, roughness: 0.2 }), { x: 0.05, y: 0.35, z: 0.19 });
    }
    if (k === 'corset') { bodice(L, d, m, 0.05, 0.72); for (let y = 0.12; y < 0.68; y += 0.09) add(L, d.torso, new THREE.BoxGeometry(0.1, 0.012, 0.01), std('#ffffff'), { y, z: 0.17 - Math.abs(0.4 - y) * 0.05 }); }
    if (k === 'gown' || k === 'mini' || k === 'sundress' || k === 'puff' || k === 'slip') {
      bodice(L, d, m, 0.0, k === 'sundress' || k === 'slip' ? 0.8 : 0.74);
      if (k === 'sundress' || k === 'slip') for (const s of [-1, 1]) add(L, d.torso, new THREE.BoxGeometry(0.03, 0.2, 0.03), m, { x: s * 0.11, y: 0.88 });
      if (k === 'gown') { skirt(L, d, m, 1.62, 0.78); add(L, d.torso, new THREE.TorusGeometry(0.2, 0.03, 8, 30), m, { y: 0.73, s: [1, 1, 0.76], r: [Math.PI / 2, 0, 0] }); }
      if (k === 'mini') skirt(L, d, m, 0.42, 0.36);
      if (k === 'sundress') skirt(L, d, m, 0.95, 0.52);
      if (k === 'slip') skirt(L, d, m, 1.1, 0.34);
      if (k === 'puff') { skirt(L, d, m, 0.7, 0.62, 3); sleeves(L, d, m, false, true); }
    }
    return L;
  }
  if (it.cat === 'bottom') {
    if (k === 'jeans') legWear(L, d, m, 1);
    if (k === 'pants') legWear(L, d, m, 1);
    if (k === 'wide') legWear(L, d, m, 1, 0.06);
    if (k === 'shorts') legWear(L, d, m, 0.3);
    if (k === 'miniskirt') skirt(L, d, m, 0.4, 0.38);
    if (k === 'maxi') skirt(L, d, m, 1.45, 0.58);
    if (k === 'midi') skirt(L, d, m, 0.85, 0.42);
    return L;
  }
  if (it.cat === 'shoes') {
    const sm = it.mat;
    for (let i = 0; i < 2; i++) {
      const f = d.foot[i];
      if (k === 'heels' || k === 'flats' || k === 'sandals') {
        const heel = k === 'heels';
        add(L, f, new THREE.CapsuleGeometry(0.058, 0.15, 4, 10), sm, { y: heel ? -0.05 : -0.06, z: 0.07, r: [Math.PI / 2 - (heel ? 0.55 : 0.12), 0, 0], s: [1, 1, k === 'sandals' ? 0.55 : 1] });
        if (heel) add(L, f, new THREE.CylinderGeometry(0.018, 0.012, 0.15, 8), sm, { y: -0.1, z: -0.03 });
        if (k === 'sandals') { add(L, f, new THREE.CapsuleGeometry(0.052, 0.13, 4, 8), d.skinM, { y: -0.035, z: 0.07, r: [Math.PI / 2 - 0.12, 0, 0] }); add(L, f, new THREE.TorusGeometry(0.05, 0.012, 6, 14), sm, { y: -0.04, z: 0.06, r: [0.3, 0, 0] }); }
      } else if (k === 'boots') {
        add(L, d.legL[i], new THREE.CylinderGeometry(0.09, 0.075, 0.5, 16), sm, { y: -0.52 });
        add(L, f, new THREE.CapsuleGeometry(0.065, 0.14, 4, 10), sm, { y: -0.06, z: 0.06, r: [Math.PI / 2 - 0.15, 0, 0] });
        if (it.pattern === 'fur') add(L, d.legL[i], new THREE.TorusGeometry(0.095, 0.03, 8, 18), sm, { y: -0.28, r: [Math.PI / 2, 0, 0] });
      } else if (k === 'sneakers') {
        add(L, f, rounded2(0.13, 0.1, 0.28), sm, { y: -0.06, z: 0.06 });
        add(L, f, new THREE.BoxGeometry(0.14, 0.035, 0.29), std(it.accent || '#ff5d8f'), { y: -0.105, z: 0.06 });
        add(L, f, new THREE.BoxGeometry(0.135, 0.02, 0.1), std(it.accent || '#ff5d8f'), { y: -0.05, z: 0.08, r: [0, 0.6, 0] });
      }
    }
    return L;
  }
  if (it.cat === 'acc') {
    const h = d.head, metal = std(it.color, { metalness: 0.8, roughness: 0.22 });
    if (k === 'glasses') { const gm = std('#141018', { roughness: 0.1, metalness: 0.3 }); for (const s of [-1, 1]) add(L, h, new THREE.CylinderGeometry(0.085, 0.085, 0.03, 20), gm, { x: s * 0.11, y: 0.02, z: 0.32, r: [Math.PI / 2, 0, 0], s: [1.15, 1, 0.85] }); add(L, h, new THREE.BoxGeometry(0.08, 0.02, 0.02), gm, { y: 0.04, z: 0.335 }); for (const s of [-1, 1]) add(L, h, new THREE.BoxGeometry(0.02, 0.02, 0.3), gm, { x: s * 0.29, y: 0.04, z: 0.17 }); }
    if (k === 'tiara') { add(L, h, new THREE.TorusGeometry(0.3, 0.018, 8, 30, Math.PI), metal, { y: 0.27, z: 0.02, r: [-0.35, 0, 0] }); for (let i = 0; i < 5; i++) add(L, h, new THREE.OctahedronGeometry(i === 2 ? 0.06 : 0.035, 0), std('#9ee8ff', { metalness: 0.3, roughness: 0.05, emissive: '#3aa0c0', emissiveIntensity: 0.4 }), { x: Math.cos(Math.PI * (0.15 + i * 0.175)) * 0.3, y: 0.36 + Math.sin(Math.PI * (0.15 + i * 0.175)) * 0.1, z: 0.1 }); }
    if (k === 'hoops') for (const s of [-1, 1]) add(L, h, new THREE.TorusGeometry(0.07, 0.012, 8, 24), metal, { x: s * 0.31, y: -0.12, z: 0.0, r: [0, Math.PI / 2, 0] });
    if (k === 'hat') { const hm2 = cloth(it.color, 'solid'); add(L, h, new THREE.CylinderGeometry(0.5, 0.52, 0.02, 40), hm2, { y: 0.25, z: -0.02, r: [-0.18, 0, 0] }); add(L, h, new THREE.SphereGeometry(0.34, 30, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), hm2, { y: 0.24, z: -0.03, r: [-0.18, 0, 0], s: [1, 0.85, 1] }); add(L, h, new THREE.TorusGeometry(0.335, 0.03, 8, 30), std('#ff5d8f'), { y: 0.28, z: -0.03, r: [Math.PI / 2 - 0.18, 0, 0] }); }
    if (k === 'beanie') { const bm = cloth(it.color, 'knit'); add(L, h, new THREE.SphereGeometry(0.37, 30, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), bm, { y: 0.1, z: -0.03, r: [-0.3, 0, 0], s: [1, 1.15, 1] }); add(L, h, new THREE.TorusGeometry(0.35, 0.05, 8, 30), bm, { y: 0.12, z: -0.02, r: [Math.PI / 2 - 0.3, 0, 0] }); add(L, h, new THREE.SphereGeometry(0.1, 12, 10), std('#ffffff'), { y: 0.52, z: -0.16 }); }
    if (k === 'pearls') for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2; add(L, d.torso, new THREE.SphereGeometry(0.026, 8, 6), std('#fffaf0', { roughness: 0.15, metalness: 0.2 }), { x: Math.sin(a) * 0.13, y: 0.93 - Math.max(0, Math.cos(a)) * 0.1, z: Math.cos(a) * 0.12 }); }
    if (k === 'choker') add(L, d.torso, new THREE.TorusGeometry(0.07, 0.018, 8, 24), std('#16161c'), { y: 1.0, r: [Math.PI / 2, 0, 0] });
    if (k === 'bag') { const bm = std(it.color, { roughness: 0.35 }); add(L, d.hand[1], rounded2(0.24, 0.17, 0.08), bm, { y: -0.18, z: 0.0 }); add(L, d.hand[1], new THREE.TorusGeometry(0.08, 0.014, 6, 18, Math.PI), std('#ffd166', { metalness: 0.7, roughness: 0.25 }), { y: -0.09 }); }
    return L;
  }
  return L;
}
function rounded2(w, h, dd, r = 0.04) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: dd - r * 2, bevelEnabled: true, bevelThickness: r, bevelSize: r * 0.9, bevelSegments: 3 }); g.translate(0, 0, -(dd - r * 2) / 2);
  return g;
}
