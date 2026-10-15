// Dress Diva — original dress-up + runway game. Style the client for the theme, walk the runway, beat the rival's score.
import { THREE, createStage, createUI, input, loop, mat, glossy, burst, confetti, sfx, tone, note, buzz, store, lerp, clamp, rng } from './kit/hc.js';
import { canvasTex } from './geo.js';
import { createDoll, buildItem, cloth } from './doll.js';
import { flow } from './kit/flow.js';
import { board } from './kit/board.js';
const B = board({ game: 'dress-diva', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 0.3 }, mode: 'sum' });   // world board: levels cleared today (RULES.md C)

const S = createStage({ fov: 30, shadowSize: 6 });
const { scene, camera, sun, hemi, renderer } = S;
hemi.intensity = 1.05; sun.intensity = 1.6; sun.position.set(3, 9, 7); sun.shadow.mapSize.set(1024, 1024);
const fill = new THREE.DirectionalLight('#ffe8f4', 0.55); fill.position.set(-5, 4, 6); scene.add(fill);
const ui = createUI({ title: 'DRESS<br>DIVA', hint: 'Style the look · walk the runway', hand: '👗', score: false });
const save = store('diva');
let level = save.get('level', 1);
const F = flow('diva');

// ---------------------------------------------------------------- catalogue
const T = (s) => s.split(' ');
const ITEMS = [
  // hair
  ['hair', 'Beach Waves', 'long', '#e8c27a', 'beach bright casual'], ['hair', 'Sleek Bob', 'bob', '#1d1a22', 'elegant dark edgy'], ['hair', 'High Pony', 'pony', '#6b3e26', 'sporty casual'],
  ['hair', 'Ballet Bun', 'bun', '#3b2416', 'elegant glam'], ['hair', 'Big Curls', 'curls', '#2a1a12', 'party glam warm'], ['hair', 'Candy Pony', 'pony', '#f7a8d0', 'pastel party bright'],
  ['hair', 'Silver Bob', 'bob', '#d9dde8', 'edgy metal cozy'], ['hair', 'Copper Waves', 'long', '#c4622d', 'warm cozy elegant'], ['hair', 'Lilac Curls', 'curls', '#c9a7ff', 'pastel party'],
  ['hair', 'Space Buns', 'twin', '#ff5d8f', 'party bright edgy'], ['hair', 'Midnight Waves', 'long', '#231a2e', 'dark glam elegant'],
  // tops (+ dresses)
  ['top', 'Neon Crop Tee', 'crop', '#ff3fa4', 'bright casual beach party'], ['top', 'Sailor Tank', 'tank', '#ffffff', 'beach casual', 'stripes', '#2b4c8c'],
  ['top', 'Silk Blouse', 'blouse', '#f3e2ff', 'elegant pastel'], ['top', 'Biker Jacket', 'jacket', '#1e1e24', 'edgy dark'],
  ['top', 'Cozy Knit', 'sweater', '#f3d9c4', 'cozy warm pastel', 'knit'], ['top', 'Track Zip', 'zip', '#3a86ff', 'sporty casual bright'],
  ['top', 'Gold Corset', 'corset', '#e8c25b', 'glam party metal', 'sequin'], ['top', 'Power Blazer', 'blazer', '#2b2d42', 'elegant dark'],
  ['top', 'Starlight Gown', 'gown', '#6a2cc0', 'elegant glam metal', 'sequin', null, true], ['top', 'Rose Gown', 'gown', '#ffb3c6', 'elegant pastel warm', 'solid', null, true],
  ['top', 'Sun Dress', 'sundress', '#ffd166', 'beach bright warm casual', 'floral', '#ff6b6b', true], ['top', 'Disco Mini', 'mini', '#c0c6d6', 'party glam metal', 'sequin', null, true],
  ['top', 'Little Black', 'mini', '#16161c', 'elegant dark glam', 'solid', null, true], ['top', 'Tulle Puff', 'puff', '#cdb4ff', 'pastel party', 'solid', null, true],
  ['top', 'Cherry Slip', 'slip', '#c1121f', 'glam party warm', 'solid', null, true],
  // bottoms
  ['bottom', 'Blue Jeans', 'jeans', '#4a6fa5', 'casual sporty edgy', 'denim'], ['bottom', 'Denim Shorts', 'shorts', '#7fa7d9', 'beach casual bright', 'denim'],
  ['bottom', 'Pleated Mini', 'miniskirt', '#ff5d8f', 'party bright'], ['bottom', 'Maxi Skirt', 'maxi', '#f4e1c1', 'elegant warm beach'],
  ['bottom', 'Leather Pants', 'pants', '#1b1b22', 'edgy dark glam'], ['bottom', 'Cargo Pants', 'wide', '#7a8b5a', 'sporty casual'],
  ['bottom', 'Tartan Midi', 'midi', '#c8b6a6', 'cozy elegant', 'plaid'], ['bottom', 'Lilac Flares', 'wide', '#c8b6ff', 'pastel party'],
  // shoes
  ['shoes', 'Red Stilettos', 'heels', '#e63946', 'glam elegant party'], ['shoes', 'Gold Heels', 'heels', '#e8c25b', 'glam metal'],
  ['shoes', 'Combat Boots', 'boots', '#222228', 'edgy dark'], ['shoes', 'Fluffy Boots', 'boots', '#f3e5d8', 'cozy pastel', 'fur'],
  ['shoes', 'Kicks', 'sneakers', '#ffffff', 'sporty casual', 'solid', '#3a86ff'], ['shoes', 'Flip Flops', 'sandals', '#ffd166', 'beach bright'],
  ['shoes', 'Ballet Flats', 'flats', '#ffc2d1', 'pastel elegant'], ['shoes', 'Pink Kicks', 'sneakers', '#ffd6e8', 'party casual bright', 'solid', '#ff3fa4'],
  // makeup (lip, shadow)
  ['makeup', 'Natural', '#c9786a', '#c8a089', 'casual cozy warm'], ['makeup', 'Red Carpet', '#b5121f', '#d4a373', 'glam elegant'],
  ['makeup', 'Pop Pastel', '#ff8fab', '#7fe3f5', 'pastel party bright'], ['makeup', 'Smoky Night', '#6a1b4d', '#4a3550', 'edgy dark glam'],
  ['makeup', 'Sunkissed', '#ff7f50', '#ffb36b', 'beach warm bright'], ['makeup', 'Gold Glam', '#c45b6e', '#e8c25b', 'glam metal party'],
  // accessories
  ['acc', 'Shades', 'glasses', '#111', 'beach edgy casual'], ['acc', 'Tiara', 'tiara', '#f2d16b', 'glam elegant metal'], ['acc', 'Gold Hoops', 'hoops', '#f2c94c', 'glam party metal'],
  ['acc', 'Sun Hat', 'hat', '#f4d58d', 'beach warm'], ['acc', 'Beanie', 'beanie', '#ff8fab', 'cozy casual sporty'], ['acc', 'Pearls', 'pearls', '#fff', 'elegant pastel'],
  ['acc', 'Mini Bag', 'bag', '#ff5d8f', 'party glam bright'], ['acc', 'Choker', 'choker', '#111', 'edgy dark'],
].map(([cat, name, kind, color, tags, pattern, accent, dress]) => cat === 'makeup'
  ? { cat, name, lip: kind, shadow: color, tags: T(tags) }
  : { cat, name, kind, color, tags: T(tags), pattern: pattern || 'solid', accent: accent || undefined, dress: !!dress });
const THEMES = [
  { name: 'Beach Party', icon: '🌴', tags: ['beach', 'bright', 'casual'], bg: ['#a8e6ff', '#fff3c4'] },
  { name: 'Gala Night', icon: '✨', tags: ['elegant', 'glam', 'metal'], bg: ['#d7c8ff', '#ffd6f5'] },
  { name: 'Street Style', icon: '🛹', tags: ['sporty', 'edgy', 'casual'], bg: ['#c9f0ff', '#e8fff4'] },
  { name: 'Winter Chic', icon: '❄️', tags: ['cozy', 'elegant', 'pastel'], bg: ['#d8ecff', '#fdf0ff'] },
  { name: 'Pop Concert', icon: '🎤', tags: ['party', 'bright', 'edgy'], bg: ['#ffd1dc', '#ffe9b8'] },
  { name: 'Garden Wedding', icon: '🌸', tags: ['elegant', 'pastel', 'warm'], bg: ['#ffe5ec', '#d8f3dc'] },
  { name: 'Rock Gig', icon: '🎸', tags: ['edgy', 'dark', 'glam'], bg: ['#e0d4ff', '#ffd6e0'] },
];
const CLIENTS = [['Ava', '#f1c7a5'], ['Zuri', '#8d5a3c'], ['Mei', '#f5d3b8'], ['Lola', '#c98e66'], ['Noor', '#d9a37f'], ['Kiki', '#6b4430'], ['Isla', '#fadcc8']];
const RIVALS = ['Bella', 'Coco', 'Jade', 'Roxy', 'Nina', 'Tess', 'Vee'];
const STEPS = [{ cat: 'hair', name: 'Hair', icon: '💇‍♀️' }, { cat: 'top', name: 'Top & Dress', icon: '👗' }, { cat: 'bottom', name: 'Bottom', icon: '👖' }, { cat: 'shoes', name: 'Shoes', icon: '👠' }, { cat: 'makeup', name: 'Makeup', icon: '💄' }, { cat: 'acc', name: 'Accessory', icon: '💍' }];
const affinity = (it, th) => Math.min(2, it.tags.filter(t => th.tags.includes(t)).length);

// ---------------------------------------------------------------- studio set
const studio = new THREE.Group(); scene.add(studio);
const wallTex = canvasTex(512, 512, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffe3ef'); gr.addColorStop(1, '#fff6fa'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,170,200,.35)'; g.lineWidth = 6; for (let x = 32; x < w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } });
const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 });
const backWall = new THREE.Mesh(new THREE.PlaneGeometry(16, 10), wallMat); backWall.position.set(0, 4, -3.2); backWall.receiveShadow = true; studio.add(backWall);
const floorM = new THREE.Mesh(new THREE.CircleGeometry(12, 48), new THREE.MeshStandardMaterial({ color: '#f6e9f0', roughness: 0.35, metalness: 0.05 })); floorM.rotation.x = -Math.PI / 2; floorM.receiveShadow = true; studio.add(floorM);
const podium = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.18, 0.22, 48), glossy('#ffffff')); podium.position.y = 0.11; podium.receiveShadow = true; podium.castShadow = true; studio.add(podium);
const podRing = new THREE.Mesh(new THREE.TorusGeometry(1.14, 0.035, 8, 60), glossy('#f2c94c', { metalness: 0.8, roughness: 0.25 })); podRing.rotation.x = Math.PI / 2; podRing.position.y = 0.2; studio.add(podRing);
// round vanity mirror with bulbs (left) and a clothes rail (right)
const mirror = new THREE.Group(); mirror.position.set(-2.6, 2.6, -3.1); studio.add(mirror);
mirror.add(new THREE.Mesh(new THREE.CircleGeometry(1.05, 48), glossy('#e9f6ff', { roughness: 0.05, metalness: 0.6 })));
const mframe = new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.07, 10, 48), glossy('#f2c94c', { metalness: 0.75, roughness: 0.25 })); mirror.add(mframe);
for (let i = 0; i < 12; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: '#fff6d6' })); const a = i / 12 * Math.PI * 2; b.position.set(Math.cos(a) * 1.08, Math.sin(a) * 1.08, 0.06); mirror.add(b); }
const rail = new THREE.Group(); rail.position.set(2.5, 0, -2.4); studio.add(rail);
const railM = glossy('#f2c94c', { metalness: 0.8, roughness: 0.25 });
for (const x of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.6, 10), railM); p.position.set(x * 1.0, 1.3, 0); rail.add(p); }
const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.1, 10), railM); bar.rotation.z = Math.PI / 2; bar.position.y = 2.55; rail.add(bar);
['#ff8fab', '#cdb4ff', '#ffd166', '#9bf6ff', '#ffffff', '#ff5d8f'].forEach((c, i) => { const gm = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0.02, 0), new THREE.Vector2(0.16, -0.05), new THREE.Vector2(0.2, -0.5), new THREE.Vector2(0.3, -1.1), new THREE.Vector2(0.02, -1.12)], 16), mat(c)); gm.scale.z = 0.35; gm.position.set(-0.8 + i * 0.32, 2.5, 0); gm.castShadow = true; rail.add(gm); });
const plant = new THREE.Group(); plant.position.set(-3.6, 0, -1.8); studio.add(plant);
const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.25, 0.6, 20), glossy('#ffffff')); pot.position.y = 0.3; plant.add(pot);
for (let i = 0; i < 9; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), mat(i % 2 ? '#5bbf7a' : '#46a866')); l.scale.set(0.5, 1.6, 0.25); const a = i / 9 * Math.PI * 2; l.position.set(Math.cos(a) * 0.18, 1.0 + (i % 3) * 0.12, Math.sin(a) * 0.18); l.rotation.set(Math.sin(a) * 0.6, a, Math.cos(a) * 0.6); plant.add(l); }

// ---------------------------------------------------------------- runway set (placed away from the studio)
const RX = 80;
const runway = new THREE.Group(); runway.position.x = RX; scene.add(runway);
const rwFloor = new THREE.Mesh(new THREE.PlaneGeometry(40, 50), new THREE.MeshStandardMaterial({ color: '#3a2352', roughness: 0.6 })); rwFloor.rotation.x = -Math.PI / 2; rwFloor.receiveShadow = true; runway.add(rwFloor);
const walk = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.3, 22), new THREE.MeshStandardMaterial({ color: '#fff4fa', roughness: 0.12, metalness: 0.15 })); walk.position.set(0, 0.15, -6); walk.receiveShadow = true; runway.add(walk);
for (const s of [-1, 1]) { const strip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 22), new THREE.MeshBasicMaterial({ color: '#ff5dbd' })); strip.position.set(s * 1.32, 0.3, -6); runway.add(strip); }
const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff3c4' }), 44);
for (let i = 0; i < 44; i++) { const o = new THREE.Object3D(); o.position.set((i % 2 ? 1 : -1) * 1.4, 0.32, -16.5 + Math.floor(i / 2) * 1.0); o.updateMatrix(); bulbs.setMatrixAt(i, o.matrix); } runway.add(bulbs);
const back = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), new THREE.MeshBasicMaterial({ map: canvasTex(512, 300, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#7b2cbf'); gr.addColorStop(0.5, '#ff4fa3'); gr.addColorStop(1, '#ffb347'); g.fillStyle = gr; g.fillRect(0, 0, w, h); for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.5})`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 0, 7); g.fill(); }
  const star = (x, y, R, r) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); };
  g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 7; star(w / 2, h / 2 - 20, 92, 40); g.stroke(); g.fillStyle = 'rgba(255,255,255,.18)'; g.fill();
  g.fillStyle = 'rgba(255,255,255,.95)'; g.font = '800 26px sans-serif'; g.textAlign = 'center'; g.fillText('F A S H I O N   W E E K', w / 2, h - 46); }) }));
back.position.set(0, 4.6, -19); back.scale.setScalar(1.25); runway.add(back);
const arch = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.12, 10, 40, Math.PI), new THREE.MeshBasicMaterial({ color: '#ffd6f0' })); arch.position.set(0, 0.3, -16.8); runway.add(arch);
// audience: instanced seated silhouettes
const crowdN = 64, crowdB = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.28, 0.4, 4, 8), mat('#5b3b7a'), crowdN), crowdH = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 12, 8), mat('#6d4a8f'), crowdN);
const crowdPos = [];
for (let i = 0; i < crowdN; i++) { const side = i % 2 ? 1 : -1, row = Math.floor(i / 32), k = Math.floor(i / 2) % 16; const p = new THREE.Vector3(side * (2.4 + row * 1.0), 0.6 + row * 0.35, -15 + k * 1.15); crowdPos.push(p); const o = new THREE.Object3D(); o.position.copy(p); o.updateMatrix(); crowdB.setMatrixAt(i, o.matrix); o.position.y += 0.6; o.updateMatrix(); crowdH.setMatrixAt(i, o.matrix); }
runway.add(crowdB, crowdH);
const flashes = [];
for (let i = 0; i < 10; i++) { const f = new THREE.Mesh(new THREE.CircleGeometry(0.35, 12), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })); runway.add(f); flashes.push(f); }
const spot = new THREE.Mesh(new THREE.ConeGeometry(1.8, 9, 32, 1, true), new THREE.MeshBasicMaterial({ color: '#fff0fa', transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide })); spot.position.set(0, 4.5, 0); runway.add(spot);

// ---------------------------------------------------------------- the client (doll)
const doll = createDoll('#f1c7a5'); doll.root.position.y = 0.22; studio.add(doll.root);
const rivalDoll = createDoll('#e8b48f'); rivalDoll.root.visible = false; runway.add(rivalDoll.root); let rivalPop = 1;
const blob = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.12, depthWrite: false })); blob.rotation.x = -Math.PI / 2; blob.position.y = 0.225; studio.add(blob);

// ---------------------------------------------------------------- thumbnails (second tiny renderer)
const TR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); TR.setSize(150, 150); TR.setPixelRatio(1); TR.outputColorSpace = THREE.SRGBColorSpace;
const tScene = new THREE.Scene(); tScene.add(new THREE.HemisphereLight('#ffffff', '#ffe0ee', 1.4)); const tSun = new THREE.DirectionalLight('#ffffff', 1.6); tSun.position.set(2, 3, 4); tScene.add(tSun);
const tCam = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
const mannequin = createDoll('#f1c7a5'); tScene.add(mannequin.root);
mannequin.bodyMeshes.forEach(m => { m.visible = false; });
const thumbCache = new Map();
function thumb(it) {
  if (thumbCache.has(it)) return thumbCache.get(it);
  let url;
  if (it.cat === 'makeup') {
    const c = document.createElement('canvas'); c.width = c.height = 150; const g = c.getContext('2d');
    g.fillStyle = it.shadow; g.beginPath(); g.ellipse(52, 56, 34, 22, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(44, 48, 12, 6, 0, 0, 7); g.fill();
    g.fillStyle = it.lip; g.beginPath(); g.moveTo(55, 104); g.quadraticCurveTo(80, 82, 98, 96); g.quadraticCurveTo(116, 82, 140, 104); g.quadraticCurveTo(98, 140, 55, 104); g.fill();
    g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.ellipse(90, 112, 10, 4, 0, 0, 7); g.fill();
    url = c.toDataURL();
  } else {
    const meshes = buildItem(mannequin, it);
    if (it.cat === 'hair') { mannequin.headM.visible = true; mannequin.headM.material = new THREE.MeshStandardMaterial({ color: '#f1c7a5' }); }
    if (it.cat === 'shoes') mannequin.foot.forEach(f => f.bare.visible = false);
    mannequin.root.updateMatrixWorld(true);
    const box = new THREE.Box3(); meshes.forEach(m => box.expandByObject(m)); if (it.cat === 'hair') box.expandByObject(mannequin.headM);
    if (it.cat === 'shoes') { box.makeEmpty(); meshes.filter(m => m.parent === mannequin.foot[1] || m.parent === mannequin.legL[1]).forEach(m => box.expandByObject(m)); mannequin.root.traverse(o => { if (o.isMesh && meshes.includes(o)) o.visible = o.parent === mannequin.foot[1] || o.parent === mannequin.legL[1]; }); }
    const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3()), r = Math.max(sz.x, sz.y, sz.z) * 0.62 + 0.02;
    const dir = it.cat === 'shoes' ? new THREE.Vector3(1, 0.5, 0.8) : new THREE.Vector3(0.35, 0.12, 1);
    tCam.position.copy(c).addScaledVector(dir.normalize(), r / Math.tan(15 * Math.PI / 180)); tCam.lookAt(c);
    TR.render(tScene, tCam); url = TR.domElement.toDataURL();
    meshes.forEach(m => m.parent && m.parent.remove(m)); mannequin.headM.visible = false;
  }
  thumbCache.set(it, url); return url;
}

// ---------------------------------------------------------------- UI
const css = document.createElement('style'); css.textContent = `
.dd-theme{position:fixed;top:calc(56px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:6;background:#fff;color:#4a2a5e;border-radius:18px;padding:6px 14px 8px;box-shadow:0 5px 0 rgba(90,40,110,.18);text-align:center;min-width:220px;pointer-events:none}
.dd-theme .who{font-size:13px;font-weight:600;opacity:.75;line-height:1}
.dd-theme .nm{font-size:22px;font-weight:800;line-height:1.15}
.dd-theme .tags{display:flex;gap:5px;justify-content:center;margin-top:2px}
.dd-theme .tags i{font-style:normal;font-size:12px;font-weight:800;background:#ffe0ef;color:#d43f8d;border-radius:10px;padding:0 8px}
.dd-glow{position:fixed;right:12px;top:calc(170px + env(safe-area-inset-top));width:30px;height:200px;z-index:6;pointer-events:none;display:flex;flex-direction:column;align-items:center;gap:4px}
.dd-glow .b{flex:1;width:16px;border-radius:10px;background:rgba(255,255,255,.7);position:relative;overflow:hidden;box-shadow:inset 0 2px 0 rgba(0,0,0,.06)}
.dd-glow .b i{position:absolute;left:0;right:0;bottom:0;height:0;border-radius:10px;background:linear-gradient(0deg,#ff5d8f,#ffb3d9,#fff1a8);transition:height .35s}
.dd-glow span{font-size:20px}
.dd-panel{position:fixed;left:0;right:0;bottom:0;z-index:7;background:rgba(255,255,255,.92);border-radius:26px 26px 0 0;padding:10px 0 calc(12px + env(safe-area-inset-bottom));box-shadow:0 -6px 20px rgba(120,40,100,.12);color:#4a2a5e;transition:transform .35s}
.dd-panel.off{transform:translateY(110%)}
.dd-step{display:flex;align-items:center;justify-content:space-between;padding:0 16px 6px;font-weight:800;font-size:18px}
.dd-step .dots{display:flex;gap:4px}.dd-step .dots i{width:9px;height:9px;border-radius:50%;background:#eadff0}.dd-step .dots i.on{background:#ff5d8f}
.dd-tiles{display:flex;gap:8px;overflow-x:auto;padding:4px 14px 8px;scrollbar-width:none}
.dd-tiles::-webkit-scrollbar{display:none}
.dd-tile{flex:0 0 76px;height:96px;border-radius:16px;background:#f7eff8;border:3px solid transparent;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding-top:2px;position:relative;font-size:10.5px;font-weight:800;line-height:1.05;text-align:center;cursor:pointer;transition:transform .12s}
.dd-tile img{width:66px;height:66px;object-fit:contain;pointer-events:none}
.dd-tile.sel{border-color:#ff5d8f;background:#fff0f6;transform:translateY(-3px)}
.dd-tile .fb{position:absolute;top:-8px;right:-6px;font-size:16px}
.dd-next{display:block;margin:2px auto 0;width:calc(100% - 28px);font:inherit;font-weight:800;font-size:21px;color:#fff;border:0;border-radius:30px;padding:10px;background:linear-gradient(90deg,#ff5d8f,#c86bff);box-shadow:0 5px 0 rgba(120,30,90,.25);cursor:pointer}
.dd-next:active{transform:translateY(3px);box-shadow:0 2px 0 rgba(120,30,90,.25)}
.dd-vs{position:fixed;inset:0;z-index:8;display:flex;flex-direction:column;align-items:center;gap:14px;padding-top:calc(58px + env(safe-area-inset-top));pointer-events:none}
.dd-vs .row{display:flex;align-items:center;justify-content:space-between;width:min(360px,94vw)}
.dd-vs .side{display:flex;flex-direction:column;align-items:center;width:110px}
.dd-vs .tubes{display:flex;gap:8px;margin-top:4px}
.dd-vs.off{display:none}
.dd-vs .name{font-weight:800;font-size:16px;background:#fff;color:#4a2a5e;border-radius:12px;padding:0 10px}
.dd-vs .num{font-weight:800;font-size:40px;line-height:1;text-shadow:0 4px 0 rgba(0,0,0,.2)}
.dd-vs .tube{width:22px;height:230px;border-radius:14px;background:rgba(255,255,255,.35);position:relative;overflow:hidden;border:3px solid rgba(255,255,255,.8)}
.dd-vs .tube i{position:absolute;left:0;right:0;bottom:0;height:0;transition:height 1.6s cubic-bezier(.2,.8,.2,1)}
.dd-vs .tube.me i{background:linear-gradient(0deg,#3ddc84,#b8ffd8)}.dd-vs .tube.riv i{background:linear-gradient(0deg,#4aa3ff,#c4e4ff)}
.dd-vs .badge{width:58px;height:58px;border-radius:50%;background:linear-gradient(135deg,#3ddc84,#4aa3ff);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:22px;box-shadow:0 5px 0 rgba(0,0,0,.18)}
.dd-judges{position:fixed;left:0;right:0;bottom:calc(60px + env(safe-area-inset-bottom));display:flex;justify-content:center;gap:12px;z-index:8;pointer-events:none}
.dd-judges.off{display:none}
.dd-judges div{width:70px;height:78px;border-radius:14px;background:#fff;color:#4a2a5e;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:800;font-size:30px;box-shadow:0 5px 0 rgba(0,0,0,.2);transform:scale(0);transition:transform .3s cubic-bezier(.3,1.6,.5,1)}
.dd-judges div small{font-size:12px;opacity:.7}
.dd-judges div.in{transform:scale(1)}
.hc-pop{-webkit-text-stroke:6px #c2367f;paint-order:stroke fill;text-shadow:0 5px 0 rgba(120,20,80,.3)!important}
.hc-card h1{text-shadow:0 5px 0 rgba(150,40,110,.3)!important}
`; document.head.appendChild(css);
const H = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); const e = d.firstElementChild; document.body.appendChild(e); return e; };
const themeEl = H('<div class="dd-theme"><div class="who"></div><div class="nm"></div><div class="tags"></div></div>');
const glowEl = H('<div class="dd-glow"><span>✨</span><div class="b"><i></i></div></div>');
const panel = H('<div class="dd-panel off"><div class="dd-step"><span class="t"></span><span class="dots"></span></div><div class="dd-tiles"></div><button class="dd-next">NEXT ➜</button></div>');
const vsEl = H('<div class="dd-vs off"><div class="row"><div class="side me"><span class="name">YOU</span><span class="num">0.0</span></div><div class="badge">VS</div><div class="side riv"><span class="name">RIVAL</span><span class="num">0.0</span></div></div><div class="tubes"><div class="tube me"><i></i></div><div class="tube riv"><i></i></div></div></div>');
const judgesEl = H('<div class="dd-judges off"><div></div><div></div><div></div></div>');
const tilesEl = panel.querySelector('.dd-tiles'), nextBtn = panel.querySelector('.dd-next');
panel.addEventListener('pointerdown', e => e.stopPropagation());
nextBtn.addEventListener('click', () => next());

// ---------------------------------------------------------------- level state
let state = 'ready', phase = 'style', theme, client, rival, opts = [], step = 0, picks = {}, rivalScore = 0, myScore = 0, phaseT = 0, spin = 0, spinV = 0, sparkleT = 0;
function setupLevel() {
  const r = rng(level * 977 + 13);
  theme = THEMES[(level - 1) % THEMES.length];
  client = CLIENTS[(level - 1) % CLIENTS.length]; rival = RIVALS[(level + 2) % RIVALS.length];
  document.body.style.setProperty('--bg1', theme.bg[0]); document.body.style.setProperty('--bg2', theme.bg[1]); document.body.style.setProperty('--ui', '#ff5d8f');
  doll.setSkin(client[1]); doll.makeup = null; doll.setMakeup('#d0857a', '#c49a86');
  for (const k of Object.keys(doll.items)) doll.wear(k, null);
  // default plain outfit so the client is never "undressed"
  doll.wear('top', BASIC.top); doll.wear('bottom', BASIC.bottom); doll.wear('hair', BASIC.hair);
  // options: per step pick a mix, always including >=1 great match (harder levels: fewer great ones, more decoys)
  opts = STEPS.map(st => {
    const pool = ITEMS.filter(i => i.cat === st.cat).sort(() => r() - 0.5);
    const great = pool.filter(i => affinity(i, theme) === 2), rest = pool.filter(i => affinity(i, theme) < 2);
    const n = st.cat === 'makeup' ? 4 : 5, pick = [];
    pick.push(...great.slice(0, level > 4 ? 1 : 2));
    if (!pick.length) pick.push(...pool.sort((a, b) => affinity(b, theme) - affinity(a, theme)).slice(0, 1));
    for (const i of rest) if (pick.length < n && !pick.includes(i)) pick.push(i);
    return pick.slice(0, n).sort(() => r() - 0.5);
  });
  step = 0; picks = {}; phase = 'style';
  rivalDoll.root.visible = false; rivalDoll.setSkin(CLIENTS[(level + 3) % CLIENTS.length][1]);
  for (const st of STEPS) { const pool = ITEMS.filter(i => i.cat === st.cat && affinity(i, theme) >= 1); const it = pool[Math.floor(r() * pool.length)] || ITEMS.find(i => i.cat === st.cat); if (st.cat === 'makeup') { rivalDoll.makeup = [it.lip, it.shadow]; rivalDoll.setMakeup(it.lip, it.shadow); } else if (!(st.cat === 'bottom' && rivalDoll.dress)) { rivalDoll.wear(st.cat, it); if (st.cat === 'top') rivalDoll.dress = it.dress; } }
  if (rivalDoll.dress) rivalDoll.wear('bottom', null);
  rivalDoll.root.position.set(1.15, 0.3, 0.5); rivalDoll.root.rotation.y = -0.25;
  rivalScore = Math.min(9.5, (6.4 + level * 0.32 + r() * 0.25) * F.k());
  themeEl.querySelector('.who').textContent = `${client[0]} needs a look for`;
  themeEl.querySelector('.nm').textContent = `${theme.icon} ${theme.name}`;
  themeEl.querySelector('.tags').innerHTML = theme.tags.map(t => `<i>${t}</i>`).join('');
  themeEl.style.display = ''; glowEl.style.display = '';
  ui.levels(level); ui.progress(0);
  doll.root.position.set(0, 0.22, 0); studio.add(doll.root); doll.root.rotation.y = 0;
  vsEl.classList.add('off'); judgesEl.classList.add('off');
  renderStep(); updateGlow();
}
const BASIC = { top: { cat: 'top', kind: 'tank', color: '#f2eee9', tags: [], pattern: 'solid' }, bottom: { cat: 'bottom', kind: 'shorts', color: '#d9d2c9', tags: [], pattern: 'solid' }, hair: { cat: 'hair', kind: 'bun', color: '#4a3020', tags: [] } };
function stepSkipped(i) { return STEPS[i].cat === 'bottom' && picks.top && picks.top.dress; }
function renderStep() {
  const st = STEPS[step];
  panel.querySelector('.t').textContent = `${st.icon} ${st.name}`;
  panel.querySelector('.dots').innerHTML = STEPS.map((_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('');
  tilesEl.innerHTML = '';
  opts[step].forEach((it, i) => {
    const t = document.createElement('div'); t.className = 'dd-tile' + (picks[st.cat] === it ? ' sel' : '');
    t.innerHTML = `<img src="${thumb(it)}"><span>${it.name}</span><span class="fb"></span>`;
    t.addEventListener('pointerdown', e => { e.stopPropagation(); choose(i); });
    tilesEl.appendChild(t);
  });
  const last = nextStepIndex(step) >= STEPS.length;
  nextBtn.textContent = last ? 'WALK THE RUNWAY ✨' : 'NEXT ➜';
  nextBtn.style.opacity = picks[st.cat] ? 1 : 0.55;
  ui.progress(step / STEPS.length);
}
function nextStepIndex(i) { let n = i + 1; while (n < STEPS.length && stepSkipped(n)) n++; return n; }
function choose(i) {
  if (state !== 'play' || phase !== 'style') return;
  const st = STEPS[step], it = opts[step][i];
  picks[st.cat] = it;
  if (st.cat === 'makeup') { doll.makeup = [it.lip, it.shadow]; doll.setMakeup(it.lip, it.shadow); }
  else {
    doll.wear(st.cat, it);
    if (st.cat === 'top') doll.wear('bottom', it.dress ? null : (picks.bottom || BASIC.bottom));
  }
  if (st.cat === 'acc' || st.cat === 'hair') { /* head items */ }
  spinV = 1; sparkleT = 1;
  const a = affinity(it, theme);
  [...tilesEl.children].forEach((t, k) => { t.classList.toggle('sel', k === i); t.querySelector('.fb').textContent = ''; });
  tilesEl.children[i].querySelector('.fb').textContent = a === 2 ? '💖' : a === 1 ? '👍' : '😕';
  ui.pop(a === 2 ? 'PERFECT!' : a === 1 ? 'NICE' : 'HMM...', a === 2 ? '#ffffff' : a === 1 ? '#ffe3f1' : '#e9e1f0', a === 2 ? 40 : 30, 42);
  if (a === 2) { sfx.win(); buzz(15); burst(scene, new THREE.Vector3(0, 2.4, 0.4), ['#ff5d8f', '#ffd166', '#ffffff', '#cdb4ff'], 22, { speed: 0.07, up: 0.07, size: 0.45, gravity: 0.002 }); }
  else if (a === 1) { sfx.pick(3); buzz(8); burst(scene, new THREE.Vector3(0, 2.4, 0.4), ['#ffd6e8', '#ffffff'], 10, { speed: 0.05, up: 0.05, size: 0.35, gravity: 0.002 }); }
  else { tone(260, 0.12, 'triangle', 0.08, 0.8); }
  nextBtn.style.opacity = 1;
  updateGlow();
}
function styleSum() { let s = 0, max = 0; STEPS.forEach((st, i) => { if (stepSkipped(i)) return; max += 2; const p = picks[st.cat]; if (p) s += affinity(p, theme) * (st.cat === 'top' && p.dress ? 1 : 1); }); if (picks.top && picks.top.dress) { s += affinity(picks.top, theme); max += 2; } return [s, max]; }
function updateGlow() { const [s, m] = styleSum(); glowEl.querySelector('i').style.height = (s / 12 * 100) + '%'; }
function next() {
  if (state !== 'play' || phase !== 'style') return;
  const st = STEPS[step];
  if (!picks[st.cat]) { nextBtn.animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], { duration: 200 }); tone(200, 0.08, 'square', 0.05); return; }
  sfx.tap();
  const n = nextStepIndex(step);
  if (n >= STEPS.length) return startRunway();
  step = n; renderStep();
  panel.querySelector('.dd-tiles').scrollLeft = 0;
}
// swipe on the model cycles the current options
input({ onSwipe: (dir) => { if (state !== 'play' || phase !== 'style' || (dir !== 'left' && dir !== 'right')) return; const st = STEPS[step], list = opts[step]; const cur = list.indexOf(picks[st.cat]); choose(((cur < 0 ? -1 : cur) + (dir === 'left' ? 1 : -1) + list.length) % list.length); } });

// ---------------------------------------------------------------- runway
let beatT = 0, beatN = 0;
const MEL = [76, 79, 83, 79, 76, 74, 76, 71, 72, 76, 79, 76, 74, 71, 72, 74];   // original groove
function startRunway() {
  phase = 'walk'; phaseT = 0; beatT = 0; beatN = 0;
  panel.classList.add('off'); themeEl.style.display = 'none'; glowEl.style.display = 'none';
  ui.flash(0.9); sfx.tap();
  runway.add(doll.root); doll.root.position.set(0, 0.3, -15); doll.root.rotation.y = 0;
  document.body.style.setProperty('--bg1', '#2a1740'); document.body.style.setProperty('--bg2', '#5b2a6e');
  ui.progress(1);
  const [s, m] = styleSum(); const q = s / Math.max(1, m);
  myScore = clamp(5.2 + q * 4.6 + (Math.random() - 0.5) * 0.2, 1, 9.9);
}
function judge() {
  phase = 'judge'; phaseT = 0;
  vsEl.classList.remove('off'); vsEl.querySelector('.side.riv .name').textContent = rival.toUpperCase();
  judgesEl.classList.remove('off');
  const js = [0, 1, 2].map(i => clamp(myScore + (i - 1) * 0.3 * (Math.random() - 0.3), 1, 10));
  [...judgesEl.children].forEach((d, i) => { d.classList.remove('in'); d.innerHTML = `${js[i].toFixed(1)}<small>${['👩‍🎤', '🧑‍🎨', '👨‍💼'][i]}</small>`; setTimeout(() => { d.classList.add('in'); note(72 + i * 4, 0.25, 0.14); buzz(10); }, 300 + i * 380); });
  const tm = vsEl.querySelector('.tube.me i'), tr = vsEl.querySelector('.tube.riv i');
  tm.style.height = '0%'; tr.style.height = '0%';
  setTimeout(() => { tm.style.height = (myScore * 10) + '%'; tr.style.height = (rivalScore * 10) + '%'; }, 1400);
  const count = (el, v) => { const t0 = performance.now(); const f = () => { const k = Math.min(1, (performance.now() - t0) / 1500); el.textContent = (v * k).toFixed(1); if (k < 1) requestAnimationFrame(f); }; f(); };
  vsEl.querySelectorAll('.num').forEach(n => n.textContent = '0.0');
  setTimeout(() => { count(vsEl.querySelector('.side.me .num'), myScore); count(vsEl.querySelector('.side.riv .num'), rivalScore); }, 1400);
  rivalDoll.root.visible = true; rivalDoll.root.scale.setScalar(0.01); rivalPop = 0;
  setTimeout(() => {
    if (myScore >= rivalScore) {
      if (state === 'play') B.submit(1); state = 'won'; F.level(true); save.set('level', level + 1); sfx.win(); buzz([20, 40, 20]); ui.flash(0.6);
      for (let i = 0; i < 3; i++) setTimeout(() => confetti(scene, new THREE.Vector3(RX, 3.5, 1.5), 70), i * 170);
      ui.win(level, `${myScore.toFixed(1)} vs ${rivalScore.toFixed(1)} — the crowd loves it!`);
    } else {
      state = 'lost'; F.level(false, clamp((myScore - 5.2) / Math.max(0.1, rivalScore - 5.2), 0, 1)); sfx.fail(); buzz([40, 30, 60]);
      ui.lose('SO LAST SEASON', `${myScore.toFixed(1)} vs ${rivalScore.toFixed(1)} — match the ${theme.name} vibe!`);
    }
    setTimeout(() => { vsEl.classList.add('off'); judgesEl.classList.add('off'); }, 700);
  }, 3300);
}

ui.onTap(w => { B.start();
  if (w === 'win') level++;
  setupLevel(); state = 'play'; panel.classList.remove('off');
});

// ---------------------------------------------------------------- loop
function frameCam(t) {
  const a = camera.aspect;
  if (phase === 'style' || state === 'ready') {
    camera.fov = a < 0.7 ? 33 : 26; camera.updateProjectionMatrix();
    camera.position.set(0, 2.4, a < 0.7 ? 11.6 : 9.5); camera.lookAt(0, a < 0.7 ? 1.62 : 1.8, 0);
  } else {
    const p = doll.root.position, wz = p.z;
    camera.fov = a < 0.7 ? 36 : 30; camera.updateProjectionMatrix();
    if (phase === 'walk') { camera.position.set(RX + Math.sin(t * 0.6) * 0.5, 2.5, wz + 10.5 + Math.max(0, -wz) * 0.25); camera.lookAt(RX, 1.95, wz); }
    else { camera.position.lerp(new THREE.Vector3(RX, 2.4, phase === 'judge' ? 13.8 : 10.2), 0.06); camera.lookAt(RX, a < 0.7 ? (phase === 'judge' ? 1.45 : 1.25) : 1.8, 0.5); }
  }
}
loop((dt, t) => {
  const sec = dt / 60;
  phaseT += sec;
  const d = doll;
  // idle / try-on animation in the studio
  if (phase === 'style') {
    spin = spinV > 0 ? (1 - spinV) * Math.PI * 2 : 0; spinV = Math.max(0, spinV - sec * 1.6);
    d.root.rotation.y = spinV > 0 ? spin * (1 - spinV * 0) : Math.sin(t * 0.7) * 0.18;
    d.root.position.y = 0.22 + (spinV > 0 ? Math.sin(spinV * Math.PI) * 0.15 : 0);
    d.pelvis.rotation.z = Math.sin(t * 1.4) * 0.04; d.torso.rotation.z = -Math.sin(t * 1.4) * 0.05;
    d.legU[0].rotation.set(0, 0, -0.04 + Math.sin(t * 1.4) * 0.02); d.legU[1].rotation.set(0, 0, 0.04 + Math.sin(t * 1.4) * 0.02);
    d.legL[0].rotation.x = 0.05; d.legL[1].rotation.x = 0.12 + Math.max(0, Math.sin(t * 1.4)) * 0.1;
    d.armU[1].rotation.set(0, 0, 0.12 + Math.sin(t * 1.4) * 0.03); d.armL[1].rotation.x = -0.15;
    d.armU[0].rotation.set(0.1, 0, -0.5); d.armL[0].rotation.set(-1.5, 0, 0.4);   // hand on hip
    d.head.rotation.z = Math.sin(t * 1.1) * 0.06; d.head.rotation.y = Math.sin(t * 0.6) * 0.12;
    blob.visible = true;
  } else if (phase === 'walk') {
    // runway strut toward the camera with hip sway
    const sp = 2.9, w = t * 6.2;
    d.root.position.z = Math.min(0.5, d.root.position.z + sp * sec);
    const walking = d.root.position.z < 0.5;
    const k = walking ? 1 : 0;
    d.legU[0].rotation.x = Math.sin(w) * 0.42 * k; d.legU[1].rotation.x = -Math.sin(w) * 0.42 * k;
    d.legL[0].rotation.x = Math.max(0, -Math.cos(w)) * 0.6 * k + 0.05; d.legL[1].rotation.x = Math.max(0, Math.cos(w)) * 0.6 * k + 0.05;
    d.legU[0].rotation.z = -0.03; d.legU[1].rotation.z = 0.03;
    d.pelvis.rotation.z = Math.sin(w) * 0.09 * k; d.pelvis.rotation.y = Math.sin(w) * 0.12 * k; d.torso.rotation.z = -Math.sin(w) * 0.07 * k;
    d.root.position.y = 0.3 + Math.abs(Math.cos(w)) * 0.035 * k;
    d.armU[0].rotation.set(-Math.sin(w) * 0.35 * k, 0, -0.12); d.armU[1].rotation.set(Math.sin(w) * 0.35 * k, 0, 0.12);
    d.armL[0].rotation.set(-0.25, 0, 0); d.armL[1].rotation.set(-0.25, 0, 0);
    d.head.rotation.set(0, 0, 0);
    if (d.pony) d.pony.rotation.z = Math.sin(w) * 0.25;
    if (!walking) { // end pose: hand on hip, chin up
      d.armU[0].rotation.set(0.1, 0, -0.55); d.armL[0].rotation.set(-1.5, 0, 0.4); d.armU[1].rotation.set(0, 0, 0.12); d.pelvis.rotation.z = 0.08; d.torso.rotation.z = -0.06; d.head.rotation.set(-0.08, 0.15, 0.06);
      d.legU[1].rotation.set(0.1, 0, 0.12); d.legL[1].rotation.x = 0.25;
      if (!d.posed) { d.posed = true; ui.pop('SLAY!', '#ffffff', 52, 30); sfx.smash(); ui.flash(0.8); buzz(25); setTimeout(judge, 500); }
    } else d.posed = false;
    // beat + camera flashes from the crowd
    beatT += sec; if (beatT > 0.3) { beatT = 0; beatN++; tone(beatN % 2 ? 70 : 55, 0.12, 'sine', 0.22, 0.5); if (beatN % 2 === 0) note(MEL[(beatN / 2) % MEL.length], 0.28, 0.1); }
    blob.visible = false;
  }
  if (phase === 'judge') {
    d.root.position.x = lerp(d.root.position.x, -1.15, 0.08); d.root.rotation.y = lerp(d.root.rotation.y, 0.25, 0.08);
    rivalPop = Math.min(1, rivalPop + sec * 2.2); const x = rivalPop - 1; rivalDoll.root.scale.setScalar(Math.max(0.01, 1 + 2.7 * x * x * x + 1.7 * x * x));
    const r2 = rivalDoll; r2.armU[1].rotation.set(0.1, 0, 0.55); r2.armL[1].rotation.set(-1.5, 0, -0.4); r2.armU[0].rotation.set(0, 0, -0.12); r2.pelvis.rotation.z = -0.08; r2.torso.rotation.z = 0.06; r2.head.rotation.set(-0.05, -0.15, -0.06); r2.legU[0].rotation.set(0.1, 0, -0.12); r2.legL[0].rotation.x = 0.25;
  }
  if (phase === 'walk' || phase === 'judge') {
    for (const f of flashes) { f.material.opacity = Math.max(0, f.material.opacity - sec * 5); if (Math.random() < 0.025) { const p = crowdPos[Math.floor(Math.random() * crowdPos.length)]; f.position.set(p.x, p.y + 0.9, p.z + 0.3); f.lookAt(camera.position.clone().sub(runway.position)); f.material.opacity = 1; } }
    spot.position.z = doll.root.position.z; spot.position.y = 4.8;
  }
  // gentle sparkle around the doll after a pick
  sparkleT = Math.max(0, sparkleT - sec);
  frameCam(t);
  S.followLight(phase === 'style' ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(RX, 1, doll.root.position.z));
});

// warm up thumbnails for level start, then show the start card
setupLevel(); state = 'ready'; panel.classList.add('off'); ui.start();

// ---------------------------------------------------------------- test hooks
window.__game = {
  get state() { return state; }, get level() { return level; }, get score() { return Math.round(myScore * 10); },
  bot() {
    if (state !== 'play' || phase !== 'style') return;
    const st = STEPS[step], list = opts[step];
    let best = 0; list.forEach((it, i) => { if (affinity(it, theme) > affinity(list[best], theme)) best = i; });
    if (picks[st.cat] !== list[best]) choose(best); else next();
  },
};
