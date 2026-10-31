// Glow Keys DEEP v2 (studio 2026-10-31) — see DESIGN.md. Original piano-tiles rhythm game. Tap the dark tiles as they reach the glow line; each tile plays the next
// note of a public-domain melody. Long tiles must be held. Miss a tile or tap empty space and the song stops.
import { THREE, createStage, createUI, store, loop, buzz, rng, clamp } from './kit/hc.js';
import { arrange, hits, SONG } from './_music/songs.js';
import { createPlayer, synth } from './_music/conductor.js';
import { glowSprite, glowTex, sparks, ease } from './_music/fx.js';
import { flow } from './kit/flow.js';
import { board } from './kit/board.js';
import { demo } from './kit/demo.js';
import { LEVELS, WORLDS, SKINS, levelOf, worldOf, dailyOf } from './levels.js';
const B = board({ game: 'glow-keys', label: 'Levels cleared', limits: { maxRun: 2, maxPerSec: 0.1 }, mode: 'sum' });   // world board: levels cleared today (RULES.md C)

const ORDER = ['twinkle', 'ode', 'minuet', 'saints', 'canon', 'elise', 'cancan', 'neon', 'mountain', 'starlight', 'turkish'];
const THEMES = [   // background gradient (top, middle, bottom) + glow colour of hits
  { top: '#140c3f', mid: '#5b34e0', bot: '#ff76d6', glow: '#9fe8ff' },
  { top: '#03163d', mid: '#1767e8', bot: '#4ff0ff', glow: '#ffffff' },
  { top: '#2a0838', mid: '#c2306b', bot: '#ffb36b', glow: '#ffe7a8' },
  { top: '#03241f', mid: '#11907a', bot: '#b6ffd9', glow: '#e9fff5' },
  { top: '#120a35', mid: '#4b22c9', bot: '#38e1ff', glow: '#c6f6ff' },
  { top: '#33061f', mid: '#e0336f', bot: '#ffd1e8', glow: '#fff0f7' },
];
const H = 10, JY = -2.9, TOP = H / 2;   // world: visible height is always 10 units; judge line ~21% from the bottom

const S = store('glowkeys2');
const dayNum = () => { const d = new Date(); return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5); };
let P = Object.assign({ stars: {}, gems: 0, skin: 'night', last: 0, streak: 0, daily: 0, dailyBest: 0 }, S.get('prog', {}));   // stars: {level: 1-3}
const saveP = () => S.set('prog', P);
const totalStars = () => Object.values(P.stars).reduce((a, b) => a + b, 0);
const firstOpen = () => { for (let i = 1; i <= LEVELS.length; i++) if (!P.stars[i]) return i; return LEVELS.length + 1; };
{ const t = dayNum(); if (P.last !== t) { P.streak = P.last === t - 1 ? P.streak + 1 : 1; P.last = t; saveP(); } }
let level = Math.min(+new URLSearchParams(location.search).get('level') || firstOpen(), 999), best = S.get('best', 0), isDaily = false, cur = null;
const skin = () => SKINS.find(k => k.id === P.skin) || SKINS[0];
const F = flow('glowkeys');
const stage = createStage({ fov: 40, shadows: false });
const { scene, camera } = stage;
stage.hemi.intensity = 0.55; stage.sun.intensity = 1.0; stage.sun.position.set(-3, 6, 10);
const ui = createUI({ title: 'GLOW<br>KEYS', hint: 'Tap the dark tiles', hand: '👆' });
const songLine = document.createElement('p'); songLine.className = 'song'; ui.els.start.insertBefore(songLine, ui.els.start.querySelector('.hint'));
const startLine = document.createElement('p'); startLine.className = 'song'; ui.els.start.insertBefore(startLine, songLine);
const startRow = document.createElement('div'); startRow.className = 'gk-startrow'; ui.els.start.appendChild(startRow);
startRow.append(btn2('☰ Map', () => openMap()));
function btn2(label, fn) { const b = document.createElement('button'); b.className = 'gk-btn sec'; b.textContent = label; b.addEventListener('pointerdown', e => { e.stopPropagation(); fn(); }); return b; }
const songFoot = Object.assign(document.createElement('div'), { className: 'gk-song' }); document.body.appendChild(songFoot);
const starEls = [1, 2, 3].map(k => { const s = Object.assign(document.createElement('div'), { className: 'gk-star', textContent: '★' }); s.style.left = (k * 33.33) + '%'; ui.els.top.querySelector('.hc-bar').appendChild(s); return s; });
const player = createPlayer();
const fx = sparks(scene, 140);

// ---------------------------------------------------------------- background: gradient plane + bokeh + lanes
const bgMat = new THREE.ShaderMaterial({
  depthWrite: false,
  uniforms: { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, bot: { value: new THREE.Color() }, pulse: { value: 0 }, time: { value: 0 } },
  vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform float pulse; uniform float time; varying vec2 vU;
    void main(){ float y = vU.y; vec3 c = y > 0.45 ? mix(mid, top, smoothstep(0.45, 0.95, y)) : mix(bot, mid, smoothstep(0.05, 0.45, y));
      float w = 0.5 + 0.5 * sin(vU.x * 9.0 + time * 0.6 + y * 4.0); c += vec3(0.05, 0.03, 0.08) * w * (1.0 - y);
      float v = distance(vU, vec2(0.5, 0.42)); c *= 1.0 - 0.35 * smoothstep(0.35, 0.8, v); c += pulse * 0.07 * (1.0 - y * 0.6);
      gl_FragColor = vec4(c, 1.0); }`,
});
const bg = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), bgMat); bg.position.z = -4; bg.renderOrder = -5; scene.add(bg);
const bokeh = [];
for (let i = 0; i < 26; i++) {
  const s = glowSprite(['#ffffff', '#ff9be8', '#8fe9ff', '#ffe08a'][i % 4], 0.3 + Math.random() * 1.1, 'soft', 0.12 + Math.random() * 0.22);
  s.position.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 11, -3 + Math.random()); s.userData.v = 0.003 + Math.random() * 0.01; scene.add(s); bokeh.push(s);
}
const laneGroup = new THREE.Group(); scene.add(laneGroup);
const lineMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.16, depthWrite: false });
const judgeMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending });
const judge = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.05), judgeMat); judge.position.set(0, JY, -0.3); scene.add(judge);
const judgeGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('soft'), color: '#ffffff', transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }));
judgeGlow.position.set(0, JY, -0.35); scene.add(judgeGlow);
const beams = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: beamTex(), color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); m.position.z = -0.5; scene.add(m); return m; });
function beamTex() { const c = document.createElement('canvas'); c.width = 4; c.height = 128; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 128, 0, 0); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 128); return new THREE.CanvasTexture(c); }

// ---------------------------------------------------------------- layout (recomputed on resize)
let W = 6, laneW = 1.5, layoutKey = '';
function layout() {
  const D = (H / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  camera.position.set(0, 0, D); camera.lookAt(0, 0, 0);
  const visW = H * camera.aspect; W = Math.min(visW, 6.4); laneW = W / 4;
  const key = W.toFixed(3);
  if (key === layoutKey) return; layoutKey = key;
  laneGroup.clear();
  for (let i = 0; i <= 4; i++) { const l = new THREE.Mesh(new THREE.PlaneGeometry(i === 0 || i === 4 ? 0.04 : 0.025, H * 1.2), lineMat); l.position.set(-W / 2 + i * laneW, 0, -0.6); laneGroup.add(l); }
  judge.scale.x = W; judgeGlow.scale.set(W * 1.3, 0.9, 1);
  beams.forEach((b, i) => { b.scale.set(laneW, 7, 1); b.position.set(laneX(i), JY + 3.5, -0.5); });
  for (const t of tiles) if (t.mesh) { scene.remove(t.mesh); t.mesh = null; }
}
const laneX = (i) => -W / 2 + laneW * (i + 0.5);

// ---------------------------------------------------------------- tiles
const tileMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.15, emissive: '#04040e', emissiveIntensity: 1 });
const hitMatBase = new THREE.MeshBasicMaterial({ color: '#bfefff', transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending });
const rimMat = new THREE.MeshBasicMaterial({ color: '#8fe9ff', transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
const goldMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.3, color: '#ffd36a', emissive: '#a86f00', emissiveIntensity: 1.1 });
const missMat = new THREE.MeshBasicMaterial({ color: '#ff3b5c', transparent: true, opacity: 0.95 });
const lineGlowMat = new THREE.MeshBasicMaterial({ color: '#7fe3ff', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
function roundedRect(w, h, r, d, sk) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2; r = Math.min(r, h / 2 - 0.01, w / 2 - 0.01);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2, curveSegments: 5 });
  g.translate(0, 0, -d);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3), a = new THREE.Color(sk ? sk.a : '#252a66'), b = new THREE.Color(sk ? sk.b : '#020208'), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) { const k = clamp((pos.getY(i) - y) / h, 0, 1); c.copy(a).lerp(b, Math.pow(k, 0.6)); if (pos.getZ(i) > 0.02) c.multiplyScalar(1.25); col.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
function buildMesh(t) {
  const g = new THREE.Group(), w = laneW - 0.09, h = t.h - 0.07;
  const body = new THREE.Mesh(roundedRect(w, h, 0.14, 0.18, skin()), t.gold ? goldMat : t.ghost ? tileMat.clone() : tileMat);
  if (t.ghost) { body.material.transparent = true; }
  if (t.gold) { const st = glowSprite('#ffe27a', 0.9, 'soft', 0.9); st.position.set(0, 0, 0.14); g.add(st); } g.add(body); g.body = body;
  const rim = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.3, 0.05), rimMat); rim.position.set(0, -h / 2 + 0.07, 0.08); g.add(rim); g.rim = rim;
  if (t.long) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.05, h - 0.6), lineGlowMat); line.position.set(0, 0.15, 0.08); g.add(line);
    const dot = glowSprite('#9fefff', 0.55, 'hard', 0.95); dot.position.set(0, -h / 2 + 0.38, 0.1); g.add(dot);
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.06, 1), new THREE.MeshBasicMaterial({ color: '#8ff0ff', transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending }));
    fill.position.z = 0.1; fill.visible = false; g.add(fill); g.fill = fill;
    const head = glowSprite('#ffffff', 1.4, 'soft', 0.9); head.visible = false; head.position.z = 0.12; g.add(head); g.head = head;
  }
  g.position.set(laneX(t.lane), 0, 0); scene.add(g); t.mesh = g;
}

// ---------------------------------------------------------------- level
let state = 'ready', track, tiles = [], speed = 5, lookahead = 1.5, score = 0, combo = 0, stars = 0, doneCount = 0, theme, failInfo = null, endT = 0;
let hearts = 3, maxHearts = 3, gradeSum = 0, nPerfect = 0, nMiss = 0, goldGot = 0, goldAll = 0, fever = 0, shake = 0, lastWrong = -9, lossRun = 0, lossLevel = 0, bonusHeart = false;
const pointers = new Map();
const heartsEl = Object.assign(document.createElement('div'), { className: 'gk-hearts' }); document.body.appendChild(heartsEl);
const drawHearts = () => { heartsEl.innerHTML = Array.from({ length: maxHearts }, (_, i) => `<b class="${i < hearts ? 'on' : ''}">♥</b>`).join(''); };
function buildLevel() {
  for (const t of tiles) if (t.mesh) scene.remove(t.mesh);
  fx.clear(); failInfo = null; combo = 0; stars = 0; doneCount = 0; score = 0; gradeSum = 0; nPerfect = 0; nMiss = 0; goldGot = 0; fever = 0; shake = 0;
  cur = isDaily ? dailyOf(dayNum()) : levelOf(level);
  const song = SONG[cur.song], tempo = cur.tempo;
  const barSec = song.meter * 60 / (song.bpm * tempo);
  let bars = Math.max(4, Math.round(cur.sec / barSec / 4) * 4);
  if (song.nBars % 4 === 1 && bars >= song.nBars - 1) bars = Math.max(bars, song.nBars);
  track = arrange(song, { bars, tempo, ramp: 0.08, density: 0.6 });
  lookahead = clamp(cur.look / F.k(), 0.9, 2.1); speed = (TOP - JY) / lookahead;
  const minGap = Math.max(0.17, 1.05 / speed);
  const hs = hits(track, minGap), gaps = hs.map(h => h.dur).sort((a, b) => a - b), median = gaps[Math.floor(gaps.length / 2)] || 0.5;
  const r = rng((isDaily ? dayNum() : level) * 7919 + 3); let lane = Math.floor(r() * 4), prevMidi = hs[0] ? hs[0].midi : 60;
  const out = [];
  hs.forEach((h, i) => {
    const opts = [0, 1, 2, 3].filter(l => l !== lane), up = h.midi > prevMidi, down = h.midi < prevMidi;
    let pick = opts.filter(l => (up && l > lane) || (down && l < lane)); if (!pick.length || r() < 0.3) pick = opts;
    lane = pick[Math.floor(r() * pick.length)]; prevMidi = h.midi;
    const long = !!cur.long && h.notes.length === 1 && h.noteDur >= Math.max(0.55, median * 1.7) && h.dur >= h.noteDur * 0.9;
    const len = long ? Math.min(h.dur, h.noteDur) : Math.min(h.dur, median * 1.15);
    const t = { ...h, lane, long, len, h: Math.max(len * speed, 1.0), state: 'wait', mesh: null, prog: 0, fade: 0 };
    out.push(t);
    // a second tile on the same beat: play both (the partner is the low octave of the same note)
    if (!long && i >= 3 && i < hs.length - 1 && cur.dbl && r() < cur.dbl && (h.dur > 0.3 || true)) {
      const pl = [0, 1, 2, 3].filter(l => l !== lane)[Math.floor(r() * 3)];
      out.push({ ...t, lane: pl, midi: h.midi - 12, notes: [{ midi: h.midi - 12, dt: 0, dur: h.noteDur }], partner: true, vol: 0.17, state: 'wait', mesh: null, prog: 0, fade: 0 });
    }
  });
  tiles = out;
  // golden tiles spread evenly through the song; ghost tiles chosen by the same seed
  const plain = tiles.filter(t => !t.long && !t.partner);
  for (let k = 0; k < (cur.gold || 0); k++) { const t = plain[Math.floor(plain.length * (k + 1) / ((cur.gold || 0) + 1))]; if (t) t.gold = true; }
  goldAll = tiles.filter(t => t.gold).length;
  if (cur.ghost) plain.forEach((t, i) => { if (i >= 4 && !t.gold && r() < cur.ghost) t.ghost = true; });
  tiles.forEach((t, i) => { t.i = i; });
  endT = tiles.length ? tiles[tiles.length - 1].t + tiles[tiles.length - 1].len : track.length;
  maxHearts = cur.hearts + (bonusHeart && lossRun >= 3 && lossLevel === level ? 1 : 0); hearts = maxHearts; drawHearts();
  theme = THEMES[(isDaily ? 3 : WORLDS[worldOf(level)].theme + ((level - 1) % 11) % 2) % THEMES.length];
  bgMat.uniforms.top.value.set(theme.top); bgMat.uniforms.mid.value.set(theme.mid); bgMat.uniforms.bot.value.set(theme.bot);
  document.body.style.background = `linear-gradient(180deg,${theme.top},${theme.mid} 55%,${theme.bot})`;
  hitMatBase.color.set(theme.glow); rimMat.color.set(theme.glow);
  ui.levels(isDaily ? '♪' : level); ui.progress(0); ui.score(0); ui.sub(cur.hard ? 'BOSS LEVEL' : isDaily ? 'DAILY MELODY' : '');
  ui.pill('');
  starEls.forEach(s => s.classList.remove('on'));
  songLine.textContent = `♪ ${song.title} — ${song.composer}`; songFoot.textContent = songLine.textContent;
  startLine.textContent = isDaily ? 'Daily melody' : `${WORLDS[worldOf(level)].name} · level ${level}`;
  previewT = -lookahead * 0.55;
}
let previewT = -2;
function begin() {
  closeCards(); ui.hideStart(); ui.pill(''); state = 'play'; if (cur && /^introduce/i.test(cur.why)) setTimeout(() => state === 'play' && ui.pop('NEW: ' + cur.why.replace(/^introduce /i, '').split(':')[0], '#ffe27a', 30, 40), 900); player.start(track, { melody: false, lead: lookahead + 0.5, accVol: 0.85, drumVol: 0.8 });
}

// ---------------------------------------------------------------- hits
const WIN = { perfect: 0.11, great: 0.22 };
function judgeHit(t, now, pid) {
  const dt = now - t.t, ad = Math.abs(dt);
  combo++; doneCount++;
  const grade = ad < WIN.perfect ? 'PERFECT' : ad < WIN.great ? 'GREAT' : 'COOL';
  gradeSum += grade === 'PERFECT' ? 1 : grade === 'GREAT' ? 0.75 : 0.5; if (grade === 'PERFECT') nPerfect++;
  const mult = fever > 0 ? 2 : 1;
  score += (grade === 'PERFECT' ? 100 : grade === 'GREAT' ? 70 : 40) * mult + Math.min(combo, 30) * 2 + (t.gold ? 500 : 0);
  ui.score(score);
  const vol = t.vol || 0.26;
  t.notes.forEach((n, k) => k === 0 ? synth.piano(n.midi, player.at(now), t.long ? t.noteDur : Math.max(0.35, n.dur), vol)
    : synth.piano(n.midi, player.at(Math.max(now + 0.03, t.t + n.dt)), Math.max(0.3, n.dur), vol - 0.04));
  t.state = t.long ? 'held' : 'hit'; t.fade = 1; t.hitAt = now; t.pid = pid;
  if (t.mesh) { t.mesh.body.material = hitMatBase.clone(); t.mesh.rim.visible = false; }
  const y = clamp(JY + (t.t - now) * speed, JY - 0.5, TOP - 1);
  flashLane(t.lane, y, grade === 'PERFECT' ? 1 : 0.7);
  const col = grade === 'PERFECT' ? '#fff6a8' : grade === 'GREAT' ? '#9ff3ff' : '#ffb3f0';
  if (t.gold) {
    goldGot++; P.gems++; saveP(); ui.pop('✦ GOLD ✦', '#ffd84a', 44, 24); buzz(25);
    synth.chime(88, player.at(now) + 0.02, 0.16); synth.chime(95, player.at(now) + 0.09, 0.14);
    fx.emit(new THREE.Vector3(laneX(t.lane), y, 0.5), ['#ffd84a', '#fff3a0', '#ffffff'], 26, { speed: 0.15, size: 0.55, up: 0.04 });
  } else if (!t.partner) ui.pop(combo >= 5 ? `${grade} ×${combo}` : grade, col, grade === 'PERFECT' ? 32 : 28, 27);
  buzz(grade === 'PERFECT' ? 12 : 7);
  if (fever > 0) { fever--; if (fever === 0) { ui.pill(''); ui.pop('fever over', '#fff', 26, 30); } }
  if (combo > 0 && combo % 10 === 0) {   // every 10: bigger and louder (combo 10 < 20 < 30 ...)
    const k = Math.min(4, combo / 10);
    ui.flash(0.12 + 0.07 * k); shake = Math.max(shake, 0.05 * k);
    fx.emit(new THREE.Vector3(0, 1, 0.5), ['#fff', theme.glow, '#ffd84a'], 14 + k * 8, { speed: 0.1 + 0.02 * k, size: 0.5 });
    [76, 83, 88, 95].slice(0, k).forEach((m, j) => synth.chime(m, player.at(now) + 0.05 + j * 0.06, 0.1));
    if (combo >= 20 && fever === 0) { fever = 12; ui.pill('🔥 FEVER ×2'); ui.pop('FEVER!', '#ff9a3c', 56, 36); }
    else ui.pop(combo >= 30 ? 'UNSTOPPABLE' : `${combo} COMBO`, '#ffffff', 40, 36);
  }
  afterProgress();
}
function flashLane(lane, y, k) {
  const b = beams[lane]; b.material.opacity = (fever > 0 ? 0.6 : 0.42) * k; b.material.color.set(fever > 0 ? '#ffc46b' : theme.glow);
  const p = new THREE.Vector3(laneX(lane), y, 0.3);
  fx.emit(p, ['#ffffff', fever > 0 ? '#ffb347' : theme.glow, '#ffd6fb'], 10 + Math.round(k * 6) + (fever > 0 ? 6 : 0), { speed: 0.07, up: 0.03, size: 0.45, gravity: 0.0015 });
  const ring = glowSprite(theme.glow, 0.6, 'ring', 0.95); ring.position.copy(p); scene.add(ring); rings.push({ s: ring, life: 1, k });
  const core = glowSprite('#ffffff', 1.4 * k + 0.5, 'soft', 0.9); core.position.copy(p); scene.add(core); rings.push({ s: core, life: 0.7, k: 0, core: true });
}
const rings = [];
const starsNow = () => { const f = gradeSum / Math.max(1, tiles.length), lost = maxHearts - hearts; return f >= 0.8 && lost <= 1 ? 3 : f >= 0.62 ? 2 : 1; };
function afterProgress() {
  ui.progress(doneCount / tiles.length);
  const want = Math.floor(doneCount / tiles.length * 3 + 1e-6);
  while (stars < want) {   // the bar's three marks light up as the song goes by (passing a mark is not the star rating)
    starEls[stars].classList.add('on'); stars++;
    synth.chime(84 + stars * 4, player.at(player.time()) + 0.02, 0.14);
    fx.emit(new THREE.Vector3(0, 3.2, 0.5), ['#ffd84a', '#ffffff', '#fff3a0'], 18, { speed: 0.12, size: 0.5, up: 0.02 });
  }
}
function releaseHold(t, now) {
  if (t.state !== 'held') return;
  const p = clamp((now - t.t) / t.len, 0, 1); t.state = 'hit'; t.prog = p;
  if (p > 0.85) { score += 150; ui.score(score); ui.pop('HELD!', '#fff6a8', 32, 27); flashLane(t.lane, JY, 1); }
  else if (p < 0.5) { gradeSum -= 0.3; ui.pop('too soon', '#ffb3b3', 24, 27); }
}
function loseHeart(reason, t, lane, y) {
  if (state !== 'play') return;
  hearts--; combo = 0; nMiss++; fever = 0; ui.pill(''); drawHearts(); shake = 0.22;
  synth.fail(); buzz([30, 20, 40]); ui.flash(0.3);
  heartsEl.classList.remove('hit'); void heartsEl.offsetWidth; heartsEl.classList.add('hit');
  if (t) { t.state = 'missed'; t.fade = 1; doneCount++; if (t.mesh) { t.mesh.body.material = missMat.clone(); } }
  if (hearts <= 0) { fail(reason, t, lane, y); return; }
  ui.pop(hearts === 1 ? 'LAST HEART!' : reason, '#ff6a7e', 34, 27);
  if (!t && lane >= 0) { const m = new THREE.Mesh(roundedRect(laneW - 0.09, 1.2, 0.14, 0.12), missMat.clone()); m.position.set(laneX(lane), y, 0.05); scene.add(m); wrongMarks.push({ m, life: 1 }); }
  afterProgress();
}
const wrongMarks = [];
function fail(reason, t, lane, y) {
  if (state !== 'play') return;
  state = 'lost'; F.level(false, doneCount / Math.max(1, tiles.length)); player.stop(0.25); buzz([40, 30, 60]);
  failInfo = { t0: player.time(), tile: t, lane, y, k: 0 };
  if (t && t.mesh) t.mesh.body.material = missMat;
  best = Math.max(best, score); S.set('best', best);
  if (lossLevel === level) lossRun++; else { lossLevel = level; lossRun = 1; }
  bonusHeart = true;
  const pct = Math.round(doneCount / Math.max(1, tiles.length) * 100);
  const near = pct >= 70 ? `SO CLOSE · ${pct}%` : `${pct}% of the song`;
  setTimeout(() => showCard('lose', { title: reason === 'MISSED!' || reason === 'MISS' ? 'MISSED IT' : 'WRONG LANE', line: near, sub: lossRun >= 3 ? 'an extra ♥ is waiting' : `best ${best} pts`, pct }), 650);
}
function win() {
  if (state !== 'play') return;
  B.submit(1); state = 'won'; F.level(true); best = Math.max(best, score); S.set('best', best);
  const sr = starsNow(), prev = isDaily ? P.dailyBest : (P.stars[level] || 0), improved = sr > prev;
  const f = gradeSum / Math.max(1, tiles.length), newly = [];
  if (isDaily) { if (P.daily !== dayNum()) { P.daily = dayNum(); P.gems += 3; } P.dailyBest = Math.max(prev, sr); }
  else { P.stars[level] = Math.max(prev, sr); saveP(); }
  saveP();
  for (const k of SKINS) if (totalPts() >= k.need && !P.seen?.[k.id]) { (P.seen = P.seen || {})[k.id] = 1; if (k.need > 0) newly.push(k); }
  saveP();
  lossRun = 0; bonusHeart = false;
  for (let k = 0; k < 4; k++) fx.emit(new THREE.Vector3((k - 1.5) * 1.4, 1 + k * 0.4, 0.5), ['#ffd84a', '#ffffff', theme.glow, '#ff9be8'], 22, { speed: 0.16, size: 0.6, up: 0.05 });
  ui.flash(0.5); buzz([20, 40, 30]);
  [72, 76, 79, 84].forEach((m, k) => synth.chime(m, player.at(player.time()) + 0.05 + k * 0.09, 0.14));
  const need3 = sr < 3 ? (sr < 2 ? `${Math.round(f * 100)}% timing · ★★ at 62%` : `${Math.round(f * 100)}% timing · ★★★ at 80% and ≤1 ♥ lost`) : 'PERFECT RUN';
  if (!isDaily) level++;
  setTimeout(() => showCard('win', { stars: sr, line: `${score} pts`, sub: need3, gold: goldAll ? `✦ ${goldGot}/${goldAll}` : '', newly, improved }), 700);
}
const totalPts = () => totalStars() + Math.floor(P.gems / 10);

// ---------------------------------------------------------------- cards (win / lose / map)
const root = Object.assign(document.createElement('div'), { className: 'gk-root' }); document.body.appendChild(root);
const closeCards = () => { root.innerHTML = ''; root.className = 'gk-root'; };
const tomorrow = () => `Tomorrow: a new daily melody · 🔥 ${P.streak}-day streak`;
function btn(label, cls, fn) { const b = document.createElement('button'); b.className = 'gk-btn ' + cls; b.textContent = label; b.addEventListener('pointerdown', e => { e.stopPropagation(); fn(e); }); return b; }
function showCard(kind, d) {
  closeCards(); root.classList.add('on', kind);
  const c = document.createElement('div'); c.className = 'gk-card2'; root.appendChild(c);
  if (kind === 'win') {
    const nextLvl = isDaily ? level : level;   // level already advanced
    c.innerHTML = `<div class="k">${isDaily ? 'DAILY MELODY' : 'LEVEL ' + (level - 1)} · ${songLine.textContent.replace('♪ ', '')}</div><h2>${d.stars === 3 ? 'PERFECT!' : 'NICE!'}</h2><div class="st">${[1, 2, 3].map(i => `<i class="${i <= d.stars ? 'on' : ''}" style="animation-delay:${0.15 * i}s">★</i>`).join('')}</div><p class="big">${d.line} ${d.gold}</p><p>${d.sub}</p>${d.newly.map(k => `<p class="gold">NEW tile colour: ${k.name}</p>`).join('')}<p class="tm">${tomorrow()}</p>`;
    const row = document.createElement('div'); row.className = 'row'; c.appendChild(row);
    row.appendChild(btn(isDaily ? 'Map' : 'Next ▶', 'pri', () => { if (isDaily) { isDaily = false; level = firstOpen(); openMap(); return; } buildLevel(); begin(); }));
    row.appendChild(btn('↻', 'sec', () => { if (!isDaily) level--; buildLevel(); begin(); }));
    row.appendChild(btn('Map', 'sec', () => { isDaily = false; if (!isDaily) level = Math.min(level, firstOpen()); openMap(); }));
  } else {
    c.innerHTML = `<h2>${d.title}</h2><p class="big">${d.line}</p><div class="bar"><i style="width:${d.pct}%"></i></div><p>${d.sub}</p>`;
    const row = document.createElement('div'); row.className = 'row'; c.appendChild(row);
    row.appendChild(btn('Retry', 'pri', () => { buildLevel(); begin(); }));
    row.appendChild(btn('Map', 'sec', openMap));
  }
  root.addEventListener('pointerdown', e => e.stopPropagation(), { once: true });
}
function openMap() {
  closeCards(); ui.hideStart(); root.classList.add('on', 'map');
  const open = firstOpen(), w = document.createElement('div'); w.className = 'gk-map'; root.appendChild(w);
  const dn = dayNum(), done = P.daily === dn;
  w.innerHTML = `<div class="hd"><b>★ ${totalPts()}</b><b>✦ ${P.gems}</b><b>🔥 ${P.streak}</b></div>`;
  const dl = document.createElement('div'); dl.className = 'daily' + (done ? ' done' : ''); dl.innerHTML = `<span>♪ Daily melody</span><em>${SONG[dailyOf(dn).song].title}</em><u>${done ? '✓ played · back tomorrow' : 'new today'}</u>`;
  dl.addEventListener('pointerdown', e => { e.stopPropagation(); isDaily = true; buildLevel(); begin(); }); w.appendChild(dl);
  const sk = document.createElement('div'); sk.className = 'skins';
  const nxt = SKINS.find(k => totalPts() < k.need);
  SKINS.forEach(k => { const o = document.createElement('div'), ok = totalPts() >= k.need; o.className = 'sk' + (P.skin === k.id ? ' sel' : '') + (ok ? '' : ' lock'); o.style.background = `linear-gradient(${k.a},${k.b})`; o.innerHTML = ok ? '' : `★${k.need}`; o.addEventListener('pointerdown', e => { e.stopPropagation(); if (ok) { P.skin = k.id; saveP(); openMap(); } }); sk.appendChild(o); });
  w.appendChild(sk);
  if (nxt) { const n = document.createElement('p'); n.className = 'nx'; n.textContent = `${nxt.need - totalPts()} more ★ for ${nxt.name} tiles`; w.appendChild(n); }
  WORLDS.forEach((wd, wi) => {
    const sec = document.createElement('div'); sec.className = 'world'; sec.innerHTML = `<h3>${wd.name}<small>${wd.blurb}</small></h3>`; const g = document.createElement('div'); g.className = 'grid'; sec.appendChild(g);
    for (let i = wd.from; i <= wd.to; i++) {
      const lv = LEVELS[i - 1], n = document.createElement('div'), s = P.stars[i] || 0, locked = i > open;
      n.className = 'nd' + (locked ? ' lock' : '') + (i === open ? ' now' : '') + (lv.hard ? ' hard' : '');
      n.innerHTML = `<b>${locked ? '🔒' : i}</b><span>${[1, 2, 3].map(k => k <= s ? '★' : '☆').join('')}</span>`;
      if (!locked) n.addEventListener('pointerdown', e => { e.stopPropagation(); isDaily = false; level = i; buildLevel(); begin(); });
      g.appendChild(n);
    }
    w.appendChild(sec);
  });
  const x = btn('✕', 'x', () => { closeCards(); ui.start(); }); w.appendChild(x);
  const cur_ = w.querySelector('.now'); if (cur_) setTimeout(() => cur_.scrollIntoView({ block: 'center' }), 30);
}

// ---------------------------------------------------------------- input (multi-touch, one verb: tap / hold)
function laneAt(clientX) {
  const ppu = innerHeight / H, x0 = innerWidth / 2 - (W / 2) * ppu, l = Math.floor((clientX - x0) / (laneW * ppu));
  return l >= 0 && l < 4 ? l : -1;
}
function tryTap(lane, pid, clientY) {
  if (state !== 'play' || lane < 0) return;
  const now = player.time();
  if (now < -lookahead) return;
  let cand = null;
  for (const t of tiles) {
    if (t.state !== 'wait') continue;
    if (t.t - now > lookahead * 0.82) break;
    if (t.lane === lane) { cand = t; break; }
  }
  if (cand) { judgeHit(cand, now, pid); pointers.set(pid, cand); return; }
  // forgive double taps on a tile that was just played
  if (tiles.some(t => t.lane === lane && t.state !== 'wait' && now - t.hitAt < 0.25)) return;
  if (now - lastWrong < 0.35) return; lastWrong = now;
  loseHeart('WRONG LANE', null, lane, TOP - (clientY / innerHeight) * H);
}
addEventListener('pointerdown', e => tryTap(laneAt(e.clientX), e.pointerId, e.clientY));
const up = e => { const t = pointers.get(e.pointerId); pointers.delete(e.pointerId); if (t && state === 'play') releaseHold(t, player.time()); };
addEventListener('pointerup', up); addEventListener('pointercancel', up);

ui.onTap(which => { B.start();
  if (which === 'start') { begin(); return; }
  buildLevel(); begin();
});
if (P.last && Object.keys(P.stars).length) { /* returning player: start card shows where they are */ }

// ---------------------------------------------------------------- frame
let lastBeat = -1, pulse = 0, clock = 0;
let clickHdl = null;
// the first seconds play themselves (Oct 26: under-1-minute players left within 10 s): on song 1, until the first real touch,
// the first few tiles are played right on the glow line by the game's own bot, so the melody starts and shows the tap
const DN = demo(null, { ready: () => state === 'play' && level === 1 && !isDaily && !P.stars[1], wait: 300, ms: 3200 });
loop((dt) => {
  clock += dt / 60;
  layout(); fx.update(dt);
  if (shake > 0.002) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; shake *= Math.pow(0.88, dt); }
  for (let k = wrongMarks.length - 1; k >= 0; k--) { const w = wrongMarks[k]; w.life -= dt * 0.04; w.m.material.opacity = Math.max(0, w.life); if (w.life <= 0) { scene.remove(w.m); wrongMarks.splice(k, 1); } }
  if (DN.on) window.__game.bot();
  let now = state === 'ready' ? previewT : player.time();
  if (state === 'play' && now > -lookahead) {
    for (const t of tiles) {
      if (t.state === 'wait' && t.bot && now >= t.t - 0.012) { judgeHit(t, now, 'bot'); if (t.long) t.botHold = true; }
      if (t.state === 'held') {
        t.prog = clamp((now - t.t) / t.len, 0, 1);
        if (Math.random() < 0.5) fx.emit(new THREE.Vector3(laneX(t.lane), JY + 0.1, 0.3), ['#ffffff', theme.glow], 1, { speed: 0.03, up: 0.05, size: 0.4, gravity: 0 });
        if (t.prog >= 1) { if (t.botHold) t.botHold = false; releaseHold(t, now); }
      }
      if (t.state === 'wait' && now > t.t + (JY + TOP) / speed * 0.92) { loseHeart('MISSED!', t); if (state !== 'play') break; }
    }
    if (state === 'play' && doneCount >= tiles.length && now > endT + 0.25) win();
  }
  if (state === 'won') now = player.time();
  // fail: scroll back a little so the missed tile is in view, and blink it
  if (failInfo) {
    failInfo.k = Math.min(1, failInfo.k + dt / 40);
    let target = failInfo.t0;
    if (failInfo.tile) target = Math.min(failInfo.t0, failInfo.tile.t - 0.3 * lookahead);
    now = failInfo.t0 + (target - failInfo.t0) * ease.out(failInfo.k);
    const blink = Math.floor(clock * 8) % 2 ? 0.95 : 0.4;
    if (failInfo.tile && failInfo.tile.mesh) failInfo.tile.mesh.body.material.opacity = blink;
    if (failInfo.mesh) failInfo.mesh.material.opacity = blink;
  }
  // beat pulse
  if (track && state === 'play') { const b = track.beats.findLastIndex(b => b.t <= now); if (b !== lastBeat && b >= 0) { lastBeat = b; pulse = track.beats[b].down ? 1 : 0.55; } }
  pulse *= Math.pow(0.9, dt);
  bgMat.uniforms.pulse.value = pulse + (fever > 0 ? 0.35 : 0); bgMat.uniforms.time.value = clock;
  judgeMat.opacity = 0.22 + pulse * 0.3; judgeGlow.material.opacity = 0.12 + pulse * 0.18;
  lineMat.opacity = 0.13 + pulse * 0.08;
  for (const s of bokeh) { s.position.y += s.userData.v * dt; if (s.position.y > 6) s.position.y = -6; }
  for (const b of beams) b.material.opacity *= Math.pow(0.88, dt);
  for (let k = rings.length - 1; k >= 0; k--) { const r = rings[k]; r.life -= dt * (r.core ? 0.09 : 0.05); r.s.material.opacity = Math.max(0, r.life); r.s.scale.setScalar(r.core ? r.s.scale.x * Math.pow(1.03, dt) : 0.6 + (1 - r.life) * 2.6); if (r.life <= 0) { scene.remove(r.s); r.s.material.dispose(); rings.splice(k, 1); } }
  // tiles
  for (const t of tiles) {
    const yb = JY + (t.t - now) * speed;   // bottom edge
    const visible = yb < TOP + 0.5 && yb + t.h > -TOP - 2;
    if (!visible) { if (t.mesh && yb + t.h < -TOP - 2) { scene.remove(t.mesh); t.mesh = null; } continue; }
    if (!t.mesh) buildMesh(t);
    const m = t.mesh; m.position.y = yb + t.h / 2; m.position.x = laneX(t.lane);
    if (t.state === 'missed') { t.fade = Math.max(0.25, t.fade - dt * 0.02); m.body.material.opacity = 0.95 * t.fade; }
    if (t.ghost && t.state === 'wait') { m.body.material.opacity = clamp((m.position.y - (JY + 1.0)) / 3.2, 0.1, 1); }
    if (t.state === 'hit' && !t.long) { t.fade = Math.max(0, t.fade - dt * 0.045); m.body.material.opacity = 0.7 * t.fade; m.scale.set(1 + (1 - t.fade) * 0.08, 1, 1); }
    if (t.long && m.fill) {
      const show = t.state !== 'wait' && t.prog > 0; m.fill.visible = m.head.visible = show && t.state === 'held';
      if (t.state !== 'wait') { m.body.material.opacity = t.state === 'held' ? 0.35 : 0.25; }
      if (show) { const fh = Math.max(0.01, t.prog * (t.h - 0.1)); m.fill.scale.y = fh; m.fill.position.y = -t.h / 2 + fh / 2 + 0.03; m.head.position.y = -t.h / 2 + fh; m.fill.visible = true; }
    }
  }
});

// ---------------------------------------------------------------- boot
buildLevel(); layout(); ui.start();

window.__game = {
  get hearts() { return hearts; }, get stars() { return starsNow(); }, get tiles() { return tiles; }, P, openMap, setLevel(n) { isDaily = false; level = n; buildLevel(); }, daily() { isDaily = true; buildLevel(); },
  begin, buildLevel,
  get state() { return state; }, get level() { return level; }, get score() { return score; },
  bot() {   // play the next tiles exactly on the beat (and hold long tiles to the end)
    if (state !== 'play') return;
    const now = player.time();
    for (const t of tiles) { if (t.state === 'wait' && t.t - now < 0.5) t.bot = true; if (t.t - now > 0.5) break; }
  },
};
