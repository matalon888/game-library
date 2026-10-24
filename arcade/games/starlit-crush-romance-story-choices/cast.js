// Starlit Crush — the cast: rigged chibi-kawaii characters (assets/chars/k01–k07, Y-up, metres) that act out the script.
// Clips from the library (idle, walk, cheer, jump, wave, strut; mascots idle/walk/cheer/jump) + procedural acting on top:
// talking = small head/torso beats while the line types; emotions = eased head/spine offsets; and because the faces are
// baked into the texture, every emotion also pops an anime "emote" sticker above the head (heart, sweat drop, !, ?, …).
// Outfits: the player's jacket/skirt is recoloured in a canvas (hue band 205–298°, hair/skin/eyes untouched) and
// kawaii accessories (bow, heart clip, heart shades, cat-ear phones) are parented to the head bone.
let THREE, LOADER;
const CACHE = {};
export function initCast(T, GL) { THREE = T; LOADER = new GL(); }
const EMO = {   // head pitch (+ = down), head roll, spine pitch (+ = forward)
  '': [0, 0, 0], happy: [-0.12, 0.08, -0.04], laugh: [-0.22, 0.05, -0.08], sad: [0.3, 0.06, 0.1], angry: [0.1, 0, 0.14],
  shock: [-0.2, 0, -0.12], think: [0.05, 0.22, 0.02], shy: [0.24, 0.18, 0.05], love: [-0.08, 0.16, -0.03], cheer: [-0.1, 0, 0], jump: [-0.1, 0, 0], wave: [-0.08, 0.06, 0],
};
const EMO_ICON = { happy: 'sparkle', laugh: 'note', sad: 'tear', angry: 'anger', shock: 'bang', think: 'q', shy: 'blush', love: 'heart', cheer: 'sparkle', jump: 'bang', wave: 'note' };
const CLIP_OF = { cheer: 'cheer', jump: 'jump', wave: 'wave' };

function loadGLB(url) { return CACHE[url] || (CACHE[url] = LOADER.loadAsync(url)); }

// ---------------------------------------------------------------------------------------------- emote sprites
const EM = {};
function emoteTex(kind) {
  if (EM[kind]) return EM[kind];
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.lineJoin = 'round'; x.lineCap = 'round';
  const heart = (cx, cy, s, fill) => { x.beginPath(); x.moveTo(cx, cy + s * 0.9); x.bezierCurveTo(cx - s * 1.5, cy - s * 0.1, cx - s * 0.9, cy - s * 1.25, cx, cy - s * 0.45); x.bezierCurveTo(cx + s * 0.9, cy - s * 1.25, cx + s * 1.5, cy - s * 0.1, cx, cy + s * 0.9); x.closePath(); x.lineWidth = 10; x.strokeStyle = '#fff'; x.stroke(); x.fillStyle = fill; x.fill(); };
  if (kind === 'heart') { heart(64, 66, 36, '#ff4f9a'); x.fillStyle = 'rgba(255,255,255,.75)'; x.beginPath(); x.ellipse(48, 46, 9, 6, -0.6, 0, 7); x.fill(); }
  else if (kind === 'blush') { heart(40, 50, 18, '#ff7eb6'); heart(88, 72, 22, '#ff4f9a'); }
  else if (kind === 'sweat') { x.beginPath(); x.moveTo(64, 14); x.bezierCurveTo(30, 66, 34, 112, 64, 112); x.bezierCurveTo(94, 112, 98, 66, 64, 14); x.lineWidth = 9; x.strokeStyle = '#fff'; x.stroke(); x.fillStyle = '#7fd3ff'; x.fill(); x.fillStyle = 'rgba(255,255,255,.8)'; x.beginPath(); x.ellipse(54, 82, 7, 12, 0.3, 0, 7); x.fill(); }
  else if (kind === 'tear') { for (const [cx, s] of [[44, 0.7], [84, 1]]) { x.save(); x.translate(cx, 20); x.scale(s, s); x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(-26, 44, -22, 80, 0, 80); x.bezierCurveTo(22, 80, 26, 44, 0, 0); x.lineWidth = 9; x.strokeStyle = '#fff'; x.stroke(); x.fillStyle = '#8fc8ff'; x.fill(); x.restore(); } }
  else if (kind === 'anger') { x.strokeStyle = '#fff'; x.lineWidth = 26; const d = () => { for (const [a, b, c2, d2] of [[30, 50, 50, 50], [50, 30, 50, 50], [78, 50, 98, 50], [78, 30, 78, 50], [30, 78, 50, 78], [50, 98, 50, 78], [78, 78, 98, 78], [78, 98, 78, 78]]) { x.beginPath(); x.moveTo(a, b); x.lineTo(c2, d2); x.stroke(); } }; d(); x.strokeStyle = '#ff4d6d'; x.lineWidth = 12; d(); }
  else if (kind === 'bang' || kind === 'q') {
    x.font = '900 104px "Fredoka", "Baloo 2", system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 16; x.strokeStyle = '#fff'; x.strokeText(kind === 'bang' ? '!' : '?', 64, 70); x.fillStyle = kind === 'bang' ? '#ff4f9a' : '#8a63ff'; x.fillText(kind === 'bang' ? '!' : '?', 64, 70);
  } else if (kind === 'note') {
    x.lineWidth = 10; x.strokeStyle = '#fff';
    const n = (cx, cy, col) => { x.beginPath(); x.ellipse(cx, cy, 15, 11, -0.4, 0, 7); x.stroke(); x.fillStyle = col; x.fill(); x.fillRect(cx + 10, cy - 52, 7, 52); };
    n(42, 92, '#8a63ff'); n(86, 76, '#ff4f9a'); x.fillStyle = '#ff4f9a'; x.fillRect(52, 36, 44, 9);
  } else { // sparkle
    const star = (cx, cy, r, col) => { x.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * 0.28 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); x.lineWidth = 9; x.strokeStyle = '#fff'; x.stroke(); x.fillStyle = col; x.fill(); };
    star(52, 60, 40, '#ffd23f'); star(96, 30, 20, '#ff9fd0'); star(98, 96, 14, '#8ee6d1');
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return (EM[kind] = t);
}

// ---------------------------------------------------------------------------------------------- outfits: canvas recolour
const RECOL = {};
function recolour(srcTex, key, look) {
  if (!look || look.hue == null) return srcTex;
  if (RECOL[key]) return RECOL[key];
  const img = srcTex.image, w = img.width, h = img.height;
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, w, h), p = d.data;
  const T = look.hue, SA = look.sat ?? 1, LI = look.lit ?? 1;
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i] / 255, g = p[i + 1] / 255, b = p[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dd = mx - mn;
    if (dd < 0.06) continue;
    const s = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn);
    let hh = mx === r ? ((g - b) / dd) % 6 : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4; hh *= 60; if (hh < 0) hh += 360;
    if (hh < 205 || hh > 298 || s < 0.1) continue;
    const nh = ((T + (hh - 255) * 0.35) % 360 + 360) % 360, ns = Math.min(1, s * SA);
    let nl = LI >= 1 ? l + (1 - l) * (LI - 1) : l * LI; nl = Math.min(0.97, Math.max(0.03, nl));
    const C = (1 - Math.abs(2 * nl - 1)) * ns, X = C * (1 - Math.abs((nh / 60) % 2 - 1)), m = nl - C / 2;
    const [rr, gg, bb] = nh < 60 ? [C, X, 0] : nh < 120 ? [X, C, 0] : nh < 180 ? [0, C, X] : nh < 240 ? [0, X, C] : nh < 300 ? [X, 0, C] : [C, 0, X];
    p[i] = (rr + m) * 255; p[i + 1] = (gg + m) * 255; p[i + 2] = (bb + m) * 255;
  }
  x.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c); t.flipY = srcTex.flipY; t.colorSpace = THREE.SRGBColorSpace; t.wrapS = srcTex.wrapS; t.wrapT = srcTex.wrapT; t.anisotropy = 4;
  return (RECOL[key] = t);
}

// ---------------------------------------------------------------------------------------------- actors
export async function makeActor(id, cfg) {
  const g = await loadGLB(`./assets/chars/${cfg.char}.glb`);
  const root = g.scene; // one instance per character: each GLB is used once
  const o = new THREE.Group(); o.name = 'actor-' + id; o.add(root);
  const mats = [];
  root.traverse(m => {
    if (m.isMesh) {
      m.frustumCulled = false; m.castShadow = true; m.receiveShadow = false;
      const mm = m.material.clone(); mm.roughness = Math.min(mm.roughness ?? 0.6, 0.55); mm.metalness = 0; mm.envMapIntensity = 0.7;
      // lift the baked darks a touch so faces read in every set (more for the darker-skinned model, whose face texture is dim)
      if (mm.map) { mm.emissiveMap = mm.map; mm.emissive = new THREE.Color('#ffffff'); mm.emissiveIntensity = cfg.char === 'k03' ? 0.22 : 0.1; }
      m.material = mm; mats.push(mm);
    }
  });
  const mixer = new THREE.AnimationMixer(root);
  const clips = {}; for (const c of g.animations) clips[c.name] = mixer.clipAction(c);
  const bone = n => root.getObjectByName(n);
  const em = new THREE.Sprite(new THREE.SpriteMaterial({ map: emoteTex('heart'), transparent: true, depthWrite: false, depthTest: false }));
  em.visible = false; em.renderOrder = 20; o.add(em);
  const A = {
    id, o, cfg, mixer, clips, mats, baseMap: mats[0] && mats[0].map, hips: bone('Hips'), head: bone('Head'), headEnd: bone('head_end'), headFront: bone('headfront'), spine: bone('Spine02'),
    emo: '', e: [0, 0, 0], talk: 0, talkT: 0, nod: 0, present: false, hop: 0, clip: 'idle', clipT: 0, breathe: Math.random() * 6, alpha: 0,
    em, emT: 0, acc: [], target: null,
  };
  play(A, 'idle', 0);
  return A;
}
export function play(A, name, fade = 0.25) {
  const a = A.clips[name] || A.clips.idle; if (!a) return;
  const prev = A.cur; A.cur = a;
  a.reset(); a.enabled = true; a.setEffectiveWeight(1);
  if (name !== 'idle' && name !== 'walk' && name !== 'strut') { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } else a.setLoop(THREE.LoopRepeat, Infinity);
  a.play(); if (prev && prev !== a) { if (fade > 0) prev.crossFadeTo(a, fade, false); else prev.stop(); }
  A.clip = name; A.clipT = name === 'idle' || name === 'walk' ? 0 : Math.max(0.6, a.getClip().duration - 0.35);
}
export function emote(A, kind, dur = 1.6) {
  if (!kind) return;
  A.em.material.map = emoteTex(kind); A.em.material.needsUpdate = true; A.emT = dur; A.emMax = dur; A.em.visible = true;
}
export function setEmo(A, emo) {
  A.emo = emo in EMO ? emo : '';
  if (CLIP_OF[emo] && A.clips[CLIP_OF[emo]]) play(A, CLIP_OF[emo], 0.2);
  if (emo === 'shock') A.hop = 1;
  if (emo === 'laugh') A.laughT = 1.2;
  if (EMO_ICON[emo]) emote(A, EMO_ICON[emo]);
}
export function setFade(A, a) {
  A.alpha = a;
  for (const m of A.mats) { const t = a < 0.999; if (m.transparent !== t) { m.transparent = t; m.needsUpdate = true; } m.opacity = a; m.depthWrite = !t || a > 0.6; }
  A.o.visible = a > 0.01;
}
// outfits for the player: recoloured texture + accessories (prototypes from the prop library, normalised to 1 unit)
export function dress(A, look, PROTO) {
  const tex = recolour(A.baseMap, A.cfg.char + ':' + look.id, look);
  for (const m of A.mats) { m.map = tex; if (m.emissiveMap) m.emissiveMap = tex; m.needsUpdate = true; }
  for (const a of A.acc) a.parent && a.parent.remove(a); A.acc = [];
  if (!A.head || !look.acc || !look.acc.length) return;
  // attach in bind-ish pose: actor at origin, facing +Z, so the head bone's world matrix is meaningful
  const keepP = A.o.position.clone(), keepR = A.o.rotation.y; A.o.position.set(0, 0, 0); A.o.rotation.y = 0; A.o.updateMatrixWorld(true);
  const top = new THREE.Vector3(), front = new THREE.Vector3(), hp = new THREE.Vector3();
  (A.headEnd || A.head).getWorldPosition(top); (A.headFront || A.head).getWorldPosition(front); A.head.getWorldPosition(hp);
  const H = A.cfg.h;
  for (const id of look.acc) {
    const src = PROTO[id]; if (!src) continue;
    const p = src.clone(); const holder = new THREE.Group(); holder.add(p);
    let size = 0.2, pos = top.clone(), rot = [0, 0, 0];
    if (id === 'b01') { size = H * 0.26; pos = top.clone().add(new THREE.Vector3(H * 0.1, -H * 0.03, H * 0.02)); rot = [0.2, 0, -0.35]; }
    if (id === 'b02') { size = H * 0.13; pos = top.clone().lerp(front, 0.45).add(new THREE.Vector3(H * 0.13, 0, H * 0.06)); rot = [0, 0.3, -0.3]; }
    if (id === 'w09') { size = H * 0.25; pos = front.clone().add(new THREE.Vector3(0, H * 0.02, H * 0.03)); rot = [0, 0, 0]; }
    if (id === 'w07') { size = H * 0.42; pos = top.clone().lerp(hp, 0.62).add(new THREE.Vector3(0, -H * 0.06, -H * 0.01)); rot = [0, 0, 0]; }
    p.scale.setScalar(size); p.position.y = -size * (id === 'w09' ? 0.5 : id === 'w07' ? 0.55 : 0.45); p.rotation.set(...rot);
    holder.position.copy(pos); holder.updateMatrixWorld(true);
    // re-express holder's world transform in the head bone's space
    const inv = new THREE.Matrix4().copy(A.head.matrixWorld).invert();
    const local = inv.multiply(holder.matrixWorld); local.decompose(holder.position, holder.quaternion, holder.scale);
    p.traverse(m => { if (m.isMesh) { m.castShadow = false; m.material = m.material.clone(); A.mats.push(m.material); } });
    A.head.add(holder); A.acc.push(holder);
  }
  A.o.position.copy(keepP); A.o.rotation.y = keepR; A.o.updateMatrixWorld(true);
  setFade(A, A.alpha);
}

let QA, QB, QC, AX, AY, AZ, TMP, TMP2;
export function tickActor(A, dt, t, camera) {
  if (!QA) { QA = new THREE.Quaternion(); QB = new THREE.Quaternion(); QC = new THREE.Quaternion(); TMP2 = new THREE.Vector3(); AX = new THREE.Vector3(1, 0, 0); AY = new THREE.Vector3(0, 1, 0); AZ = new THREE.Vector3(0, 0, 1); TMP = new THREE.Vector3(); }
  if (!A.o.visible) return;
  if (A.clipT > 0) { A.clipT -= dt; if (A.clipT <= 0) play(A, 'idle', 0.35); }
  // undo last frame's procedural offsets first: bones without a track in the playing clip would otherwise accumulate them
  if (A.qh) { A.head.quaternion.multiply(A.qh.invert()); A.qh = null; }
  if (A.qs) { A.spine.quaternion.multiply(A.qs.invert()); A.qs = null; }
  A.mixer.update(dt);
  // the library's idle clip swings the hips through ~90° of yaw (a look-around idle): counter-rotate the rig so the body
  // keeps facing where the staging says, leaving a little sway for life
  if (A.hips) {
    const root = A.o.children[0]; root.rotation.y = 0; A.o.updateMatrixWorld(true);
    A.hips.getWorldQuaternion(QB); A.o.getWorldQuaternion(QA); QA.invert().multiply(QB);
    TMP.set(0, 0, 1).applyQuaternion(QA); const rel = Math.atan2(TMP.x, TMP.z);
    A.relS = A.relS == null ? rel : A.relS + (rel - A.relS) * Math.min(1, dt * 12);
    root.rotation.y = -A.relS * 0.88;
  }
  // the idle also turns the head ~90° side to side: keep the face within ±0.22 rad of where the body points
  if (A.head && A.headFront) {
    A.o.updateMatrixWorld(true);
    A.headFront.getWorldPosition(TMP); A.head.getWorldPosition(TMP2); TMP.sub(TMP2);
    A.o.getWorldQuaternion(QA); TMP.applyQuaternion(QA.invert());
    const yr = Math.atan2(TMP.x, TMP.z), want = Math.max(-0.22, Math.min(0.22, yr)), dlt = want - yr;
    if (Math.abs(dlt) > 0.001) { A.head.parent.getWorldQuaternion(QB); QA.setFromAxisAngle(AY, dlt); QC.copy(QB).invert().multiply(QA).multiply(QB); A.head.quaternion.premultiply(QC); }
  }
  const tgt = EMO[A.emo] || EMO[''], k = 1 - Math.exp(-dt * 5);
  for (let i = 0; i < 3; i++) A.e[i] += (tgt[i] - A.e[i]) * k;
  A.talk += ((A.talkT > 0 ? 1 : 0) - A.talk) * (1 - Math.exp(-dt * 8)); A.talkT = Math.max(0, A.talkT - dt);
  A.hop = Math.max(0, A.hop - dt * 3); A.laughT = Math.max(0, (A.laughT || 0) - dt); A.nod = Math.max(0, A.nod - dt * 2.2);
  const talkP = A.talk * (Math.sin(t * 7.3 + A.breathe) * 0.05 + Math.sin(t * 3.1) * 0.03);
  const laughP = A.laughT > 0 ? Math.abs(Math.sin(t * 14)) * 0.07 * A.laughT : 0;
  const nodP = Math.sin((1 - A.nod) * Math.PI * 2) * 0.14 * A.nod;
  if (A.head) {
    QA.setFromAxisAngle(AX, A.e[0] + talkP - laughP + nodP - A.hop * 0.15);
    QB.setFromAxisAngle(AZ, A.e[1] + A.talk * Math.sin(t * 2.3) * 0.05 + Math.sin(t * 0.9 + A.breathe) * 0.025); QA.multiply(QB);
    A.head.quaternion.multiply(QA); A.qh = QA.clone();
  }
  if (A.spine) { QA.setFromAxisAngle(AX, A.e[2] + A.talk * Math.sin(t * 3.7) * 0.025 - A.hop * 0.12 + laughP * 0.6); A.spine.quaternion.multiply(QA); A.qs = QA.clone(); }
  // a little bounce: kawaii characters hop on shock/cheer
  A.o.children[0].position.y = Math.sin(Math.min(1, A.hop) * Math.PI) * 0.06;
  // emote sticker: pops in with a squash, floats, fades
  if (A.emT > 0) {
    A.emT -= dt; const k2 = 1 - A.emT / A.emMax;
    const pop = k2 < 0.18 ? k2 / 0.18 * 1.25 : k2 < 0.3 ? 1.25 - (k2 - 0.18) / 0.12 * 0.25 : 1;
    const s = A.cfg.h * 0.2 * pop; A.em.scale.set(s, s, 1);
    A.em.position.set(A.cfg.h * 0.24, A.cfg.h * 1.02 + k2 * 0.06, 0.05);
    A.em.material.opacity = Math.min(1, A.emT * 3) * Math.min(1, A.alpha * 1.5);
    if (A.emT <= 0) A.em.visible = false;
  }
}
