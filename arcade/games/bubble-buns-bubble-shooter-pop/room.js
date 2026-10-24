// Bubble Buns meta: the Bun Burrow — three kawaii rooms restored with stars. Each room is a code-built corner (heart
// wallpaper, checker floor, a window with a pastel sky, fairy lights) filled with kawaii library furniture; rescued critters
// hop around the floor.
import { THREE } from './kit/hc.js';
import { piece } from './assets.js';
import { wallpaperTex, floorTex } from './art.js';

const PI = Math.PI;
export const ROOM_W = 8, ROOM_D = 6;

export const ROOMS = [
  { id: 'bed', name: 'Bunny Bedroom', wall: ['#ffc2dc', '#ffffff', '#ffadd0'], floor: ['#e8c8ff', '#d9b2fb'], sky: ['#9fd8ff', '#ffd6f0'], tasks: [
    { id: 'boxes', name: 'Unpack the boxes', cost: 1, icon: '📦' },
    { id: 'rug', name: 'Cloud rug', item: 'h05', cost: 1, at: [0.3, 0.6], size: 2.8 },
    { id: 'bed', name: 'Strawberry bed', item: 'h01', cost: 2, at: [-2.2, -1.5], size: 2.9, rot: 0.35 },
    { id: 'lamp', name: 'Mushroom lamp', item: 'h06', cost: 1, at: [-3.3, 0.5], size: 1.2, rot: 0.6 },
    { id: 'bean', name: 'Heart beanbag', item: 'h02', cost: 2, at: [2.3, 0.4], size: 1.6, rot: -0.6 },
    { id: 'plant', name: 'Happy succulent', item: 'h07', cost: 1, at: [3.2, -2.2], size: 0.95 },
    { id: 'shelf', name: 'Wall shelf', item: 'h08', cost: 2, at: [1.2, -2.85], size: 1.7, y: 1.55 },
    { id: 'plush', name: 'Giant bunny plush', item: 'g17', cost: 3, at: [0.9, -1.7], size: 1.6, rot: 0.1 },
  ] },
  { id: 'cafe', name: 'Bun Café', wall: ['#b9efdc', '#ffffff', '#a2e6cf'], floor: ['#ffe3a6', '#ffd17e'], sky: ['#ffd1e6', '#fff1c4'], tasks: [
    { id: 'boxes', name: 'Sweep up the café', cost: 1, icon: '🧹' },
    { id: 'counter', name: 'Kitty café counter', item: 'h09', cost: 2, at: [-1.6, -2.0], size: 2.6, rot: 0.15 },
    { id: 'table', name: 'Picnic table', item: 'h10', cost: 2, at: [1.6, 0.6], size: 2.4, rot: -0.3 },
    { id: 'cake', name: 'Cake display', item: 'h11', cost: 2, at: [-3.2, 0.2], size: 1.3, rot: 0.7 },
    { id: 'tea', name: 'Teapot', item: 'f09', cost: 1, at: [-1.0, -1.75], size: 0.55, y: 1.28 },
    { id: 'boba', name: 'Boba bar', item: 't01', cost: 1, at: [1.6, 0.6], size: 0.5, y: 1.2 },
    { id: 'tree', name: 'Blossom tree', item: 'r01', cost: 3, at: [3.1, -1.9], size: 2.4 },
    { id: 'cattree', name: 'Cat tree', item: 'h12', cost: 2, at: [-0.2, -2.4], size: 2.0 },
  ] },
  { id: 'study', name: 'Dreamy Study', wall: ['#d8c6ff', '#ffffff', '#c8b0ff'], floor: ['#ffc9de', '#ffb3cf'], sky: ['#b7a6ff', '#ffc7e8'], tasks: [
    { id: 'boxes', name: 'Unpack the boxes', cost: 1, icon: '📦' },
    { id: 'desk', name: 'Cozy desk', item: 'h03', cost: 2, at: [-1.8, -1.9], size: 2.4, rot: 0.2 },
    { id: 'vanity', name: 'Glow vanity', item: 'h04', cost: 2, at: [1.9, -2.1], size: 1.9, rot: -0.15 },
    { id: 'pillow', name: 'Cat-loaf pillow', item: 'g16', cost: 1, at: [0.4, 0.8], size: 1.1, rot: -0.3 },
    { id: 'bear', name: 'Starry bear', item: 'g15', cost: 2, at: [-3.1, 0.4], size: 1.3, rot: 0.8 },
    { id: 'pom', name: 'Pom-pom friend', item: 'g13', cost: 1, at: [3.1, 0.3], size: 0.9, rot: -0.7 },
    { id: 'beanbag', name: 'Plush pile', item: 'g18', cost: 2, at: [1.6, 1.2], size: 1.9, rot: -0.4 },
    { id: 'chest', name: 'Treasure chest', item: 'x01', cost: 3, at: [-1.0, 1.4], size: 1.1, rot: 0.3 },
  ] },
];

function pm(color, o = {}) { return new THREE.MeshPhysicalMaterial({ color, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2, ...o }); }

export async function buildRoom(def) {
  const g = new THREE.Group(), items = {}, apply = {};
  // floor + walls
  const ft = floorTex(...def.floor); ft.repeat.set(4, 3);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, 0.3, ROOM_D), pm('#ffffff', { map: ft, clearcoat: 0.8, roughness: 0.3 })); floor.position.y = -0.15; floor.receiveShadow = true; g.add(floor);
  const wt = wallpaperTex(...def.wall); wt.repeat.set(4, 2);
  const wallM = new THREE.MeshStandardMaterial({ color: '#ffffff', map: wt, roughness: 0.85 });
  const back = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, 5, 0.25), wallM); back.position.set(0, 2.5, -ROOM_D / 2 - 0.12); back.receiveShadow = true; g.add(back);
  const wt2 = wt.clone(); wt2.repeat.set(3, 2); wt2.needsUpdate = true;
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.25, 5, ROOM_D), new THREE.MeshStandardMaterial({ color: '#ffffff', map: wt2, roughness: 0.85 })); left.position.set(-ROOM_W / 2 - 0.12, 2.5, 0); left.receiveShadow = true; g.add(left);
  // wainscot + skirting in a deeper tone
  const trim = pm(new THREE.Color(def.wall[2]).lerp(new THREE.Color('#ffffff'), 0.25), { clearcoat: 1, roughness: 0.25 });
  const wb = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, 1.1, 0.12), trim); wb.position.set(0, 0.55, -ROOM_D / 2 + 0.02); g.add(wb);
  const wl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, ROOM_D), trim); wl.position.set(-ROOM_W / 2 + 0.02, 0.55, 0); g.add(wl);
  const capM = pm('#ffffff', { clearcoat: 1, roughness: 0.2 });
  const cb = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, ROOM_W, 4, 8), capM); cb.rotation.z = PI / 2; cb.position.set(0, 1.12, -ROOM_D / 2 + 0.1); g.add(cb);
  const cl = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, ROOM_D, 4, 8), capM); cl.rotation.x = PI / 2; cl.position.set(-ROOM_W / 2 + 0.1, 1.12, 0); g.add(cl);
  // window (left wall) with a pastel sky, clouds and a heart-shaped frame top
  { const win = new THREE.Group(); win.position.set(-ROOM_W / 2 + 0.03, 2.55, 0.4); win.rotation.y = PI / 2; g.add(win);
    const c = document.createElement('canvas'); c.width = 128; c.height = 256; const x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, def.sky[0]); gr.addColorStop(1, def.sky[1]); x.fillStyle = gr; x.fillRect(0, 0, 128, 256);
    x.fillStyle = 'rgba(255,255,255,.9)'; for (const [cx, cy, r] of [[30, 90, 18], [50, 84, 22], [72, 92, 16], [86, 170, 14], [104, 166, 18], [118, 174, 12]]) { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); }
    const st = new THREE.CanvasTexture(c); st.colorSpace = THREE.SRGBColorSpace;
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.0), new THREE.MeshBasicMaterial({ map: st, toneMapped: false })); win.add(glass);
    const fr = pm('#ffffff', { clearcoat: 1, roughness: 0.2 });
    for (const [w, h, px, py] of [[2.1, 0.14, 0, 1.05], [2.1, 0.14, 0, -1.05], [0.14, 2.2, 1.0, 0], [0.14, 2.2, -1.0, 0], [0.08, 2.0, 0, 0], [1.9, 0.08, 0, 0.1]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), fr); b.position.set(px, py, 0.05); win.add(b); }
    const sill = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.4), fr); sill.position.set(0, -1.12, 0.2); win.add(sill);
    // curtains
    const cm = pm('#ffb3d6', { sheen: 1, sheenColor: new THREE.Color('#ffffff'), roughness: 0.6, clearcoat: 0 });
    for (const sx of [-1, 1]) { const cur = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.9, 6, 12), cm); cur.scale.z = 0.4; cur.position.set(sx * 1.25, 0.05, 0.18); win.add(cur); } }
  // fairy lights along the back wall
  { const n = 15, bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 10, 8), new THREE.MeshBasicMaterial({ toneMapped: false }), n), m4 = new THREE.Matrix4(), cols = ['#fff3a8', '#ffb3d9', '#b9f0ff', '#d9c2ff'];
    bulbs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    const pts = []; for (let i = 0; i < n; i++) { const t = i / (n - 1), x = -ROOM_W / 2 + 0.3 + t * (ROOM_W - 0.6), y = 4.3 - Math.sin(t * PI * 3) ** 2 * 0.4; pts.push(new THREE.Vector3(x, y, -ROOM_D / 2 + 0.06)); m4.makeTranslation(x, y - 0.06, -ROOM_D / 2 + 0.1); bulbs.setMatrixAt(i, m4); bulbs.setColorAt(i, new THREE.Color(cols[i % 4]).multiplyScalar(1.6)); }
    const wire = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.012, 4), new THREE.MeshBasicMaterial({ color: '#9b7fb3' })); g.add(bulbs, wire); }
  // clutter: taped moving boxes (or dust bunnies in the café) until the first task
  const clutter = new THREE.Group(); g.add(clutter);
  { const box = pm('#e8c39a', { clearcoat: 0.2, roughness: 0.7 }), tape = pm('#ffb3d6', { clearcoat: 0.5 });
    for (const [x, z, s, r] of [[-1.3, 0.2, 1.0, 0.3], [-0.4, -0.6, 0.8, -0.2], [-1.0, -0.4, 0.7, 0.6], [1.2, -0.8, 0.9, -0.4], [0.6, 1.0, 0.6, 0.2]]) {
      const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = r; b.scale.setScalar(s);
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 0.8, 0.9), box); m.position.y = 0.4; m.castShadow = true; b.add(m);
      const tp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.92), tape); tp.position.y = 0.81; b.add(tp); clutter.add(b);
    } }
  apply.clutter = done => { clutter.visible = !done; };
  // furniture (hidden until bought)
  await Promise.all(def.tasks.filter(t => t.item).map(async t => {
    const p = await piece(t.item, 'base'); const m = new THREE.Mesh(p.geo, p.mat); m.castShadow = true; m.receiveShadow = true;
    m.scale.setScalar(t.size); m.position.set(t.at[0], t.y || 0, t.at[1]); m.rotation.y = t.rot || 0; m.visible = false; m.userData.base = m.scale.clone(); m.userData.y = t.y || 0;
    g.add(m); items[t.id] = m;
  }));
  return { group: g, items, apply, clutter };
}

/** rescued critters hopping around the room floor */
export function critterHerd(parent) {
  const list = [];
  return {
    set(species, P) {
      for (const c of list) parent.remove(c.m); list.length = 0;
      species.forEach((sp, i) => {
        const p = P[sp]; const m = new THREE.Mesh(p.geo, p.mat); m.castShadow = true; const s = 0.55 + Math.random() * 0.15; m.scale.setScalar(s);
        const a = i / Math.max(1, species.length) * PI * 2, x = Math.cos(a) * 1.8, z = 0.8 + Math.sin(a) * 1.2;
        m.position.set(x, 0, z); parent.add(m);
        list.push({ m, s, x, z, tx: x, tz: z, t: Math.random() * 3, hop: Math.random() * 6, wait: Math.random() * 2 });
      });
    },
    update(dt, T) {
      for (const c of list) {
        c.wait -= dt;
        if (c.wait <= 0) { c.tx = -3.2 + Math.random() * 6.6; c.tz = -0.6 + Math.random() * 3.2; c.wait = 2 + Math.random() * 3; }
        const dx = c.tx - c.x, dz = c.tz - c.z, d = Math.hypot(dx, dz);
        if (d > 0.05) { const sp = Math.min(d, dt * 1.1); c.x += dx / d * sp; c.z += dz / d * sp; c.hop += dt * 9; c.m.rotation.y += (Math.atan2(dx, dz) - c.m.rotation.y) * Math.min(1, dt * 6); }
        else { c.hop = 0; c.m.rotation.y += (0.4 - c.m.rotation.y) * Math.min(1, dt * 2); }
        const h = Math.abs(Math.sin(c.hop)) * 0.35; c.m.position.set(c.x, h, c.z);
        const sq = d > 0.05 ? 1 + (0.35 - h) * 0.25 : 1 + Math.sin(T * 3 + c.t) * 0.03;
        c.m.scale.set(c.s * sq, c.s / sq, c.s * sq);
      }
    },
    get count() { return list.length; },
  };
}
