// =====================================================================
// TIME ECHO — full client-side game.
// Modules: Screens, Save, TitleFX, Game.
// =====================================================================

// ---------- TitleFX ----------
// Ana menü ekranının arka plan animasyonu: parallax stars, drifting echo
// silhouettes, slow nebula pulse, müziğe smooth spektral tepki.
const TitleFX = (() => {
  const cvs = document.getElementById("titleCanvas");
  if (!cvs) return { render: () => {}, resize: () => {} };
  const c = cvs.getContext("2d");
  let stars = [];
  let echoes = [];
  let shootingTimer = 0;
  let shootings = [];
  let w = 0, h = 0;

  // Smooth audio-reactive enerji — lerp ile yumuşatılır
  const energy = { bass: 0, mid: 0, treble: 0, overall: 0 };
  const ENERGY_LERP = 0.18;
  function updateEnergy() {
    if (typeof Music === "undefined" || !Music.getEnergy) return;
    const e = Music.getEnergy();
    energy.bass    += (e.bass    - energy.bass)    * ENERGY_LERP;
    energy.mid     += (e.mid     - energy.mid)     * ENERGY_LERP;
    energy.treble  += (e.treble  - energy.treble)  * ENERGY_LERP;
    energy.overall += (e.overall - energy.overall) * ENERGY_LERP;
  }

  // Logo DOM elementi — bass darbesinde text-shadow glow boost.
  // (Inline transform kullanmıyoruz; CSS keyframe animasyonları ile çakışmasın.)
  const logoEl = document.querySelector(".big-title");
  function reactLogo() {
    if (!logoEl) return;
    const glow = 24 + energy.bass * 40;     // 24..64 px shadow
    const glow2 = 48 + energy.mid * 56;     // 48..104 px shadow
    logoEl.style.textShadow =
      `0 0 ${glow.toFixed(0)}px rgba(138,125,255,${(0.55 + energy.bass * 0.40).toFixed(2)}),` +
      `0 0 ${glow2.toFixed(0)}px rgba(90,215,255,${(0.30 + energy.mid * 0.40).toFixed(2)})`;
  }

  function resize() {
    // Viewport'a doğrudan bağla — parent flex layout sürprizlerinden kaçın.
    const cw = window.innerWidth;
    const ch = window.innerHeight;
    if (cw === w && ch === h) return;
    w = cw; h = ch;
    cvs.width = w; cvs.height = h;
    initStars();
  }

  function initStars() {
    stars = [];
    // Yoğunluğu ekran alanına göre ölçekle — büyük ekranda da seyrek hissettirme
    const area = w * h;
    const starCount = Math.max(140, Math.min(520, Math.floor(area / 5200)));
    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.4 + Math.random() * 1.6,
        speed: 0.03 + Math.random() * 0.12,
        twinkle: Math.random() * Math.PI * 2,
        layer: Math.random() < 0.3 ? 2 : Math.random() < 0.6 ? 1 : 0,
      });
    }
    echoes = [];
    const echoCount = Math.max(4, Math.min(10, Math.floor(w / 320)));
    for (let i = 0; i < echoCount; i++) {
      echoes.push(spawnEcho(true));
    }
  }

  function spawnEcho(initial) {
    const dir = Math.random() < 0.5 ? -1 : 1;
    return {
      x: initial ? Math.random() * w : (dir > 0 ? -60 : w + 60),
      y: Math.random() * h,
      vx: dir * (0.15 + Math.random() * 0.35),
      vy: -0.05 + Math.random() * 0.1,
      size: 18 + Math.random() * 30,
      alpha: 0,
      maxAlpha: 0.10 + Math.random() * 0.18,
      life: 0,
      maxLife: 800 + Math.random() * 600,
      hue: Math.random() < 0.5 ? "echo" : "player",
    };
  }

  function drawEchoSilhouette(cx, cy, size, alpha, hue) {
    const PAL = hue === "echo"
      ? { body: "#8a7dff", helmet: "#d8d0ff", visor: "#3a2570" }
      : { body: "#5ad7ff", helmet: "#e8f2ff", visor: "#1a3a55" };
    c.save();
    c.globalAlpha = alpha;
    // Body (trapezoid blur)
    c.fillStyle = PAL.body;
    c.beginPath();
    c.ellipse(cx, cy + size * 0.12, size * 0.32, size * 0.42, 0, 0, Math.PI * 2);
    c.fill();
    // Helmet
    c.fillStyle = PAL.helmet;
    c.beginPath();
    c.arc(cx, cy - size * 0.30, size * 0.22, 0, Math.PI * 2);
    c.fill();
    // Visor
    c.fillStyle = PAL.visor;
    c.fillRect(cx - size * 0.18, cy - size * 0.32, size * 0.36, size * 0.16);
    // Halo glow
    c.shadowColor = PAL.body;
    c.shadowBlur = size * 0.6;
    c.fillStyle = "rgba(255,255,255,0.05)";
    c.beginPath();
    c.arc(cx, cy, size * 0.45, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  function spawnShooting() {
    const fromLeft = Math.random() < 0.5;
    shootings.push({
      x: fromLeft ? -30 : w + 30,
      y: Math.random() * h * 0.6,
      vx: fromLeft ? (4 + Math.random() * 3) : -(4 + Math.random() * 3),
      vy: 1 + Math.random() * 2,
      life: 800,
      maxLife: 800,
    });
  }

  let lastT = 0;
  function render(now) {
    if (!w || !h) resize();
    const dt = lastT ? Math.min(60, now - lastT) : 16;
    lastT = now;

    // Audio-reactive enerji güncelle
    updateEnergy();
    reactLogo();
    const driftBoost = 1 + energy.overall * 0.9;     // yıldız hızı boost
    const starBoost = 1 + energy.bass * 1.3;         // yıldız parlaklık boost
    const nebulaBoost = 1 + energy.mid * 0.85;       // nebula yoğunluk boost

    c.fillStyle = "rgba(7,8,13,0.85)";
    c.fillRect(0, 0, w, h);

    // Yıldızlar — parallax drift (bass'a göre hızlanır + parlar)
    for (const s of stars) {
      s.x -= s.speed * (s.layer + 1) * 0.4 * driftBoost;
      if (s.x < -2) s.x = w + 2;
      const alpha = 0.4 + 0.55 * Math.sin(now * 0.0012 * (s.speed * 10) + s.twinkle);
      const colors = ["#c9d6ff", "#8a7dff", "#5ad7ff"];
      c.globalAlpha = Math.min(1, alpha * (0.5 + s.layer * 0.2) * starBoost);
      c.fillStyle = colors[s.layer];
      c.beginPath();
      c.arc(s.x, s.y, s.r * (1 + energy.bass * 0.4), 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;

    // Nebula — büyük yumuşak gradientler (mid'e göre parlar)
    const ng1Stop = (0.10 * nebulaBoost).toFixed(3);
    const ng1 = c.createRadialGradient(w * 0.25, h * 0.35, 0, w * 0.25, h * 0.35, w * 0.5);
    ng1.addColorStop(0, `rgba(138,125,255,${ng1Stop})`);
    ng1.addColorStop(0.5, "rgba(90,90,200,0.04)");
    ng1.addColorStop(1, "rgba(0,0,0,0)");
    c.globalAlpha = 0.6 + 0.3 * Math.sin(now * 0.00015);
    c.fillStyle = ng1;
    c.fillRect(0, 0, w, h);
    const ng2Stop = (0.08 * nebulaBoost).toFixed(3);
    const ng2 = c.createRadialGradient(w * 0.78, h * 0.7, 0, w * 0.78, h * 0.7, w * 0.55);
    ng2.addColorStop(0, `rgba(90,215,255,${ng2Stop})`);
    ng2.addColorStop(0.6, "rgba(20,80,140,0.03)");
    ng2.addColorStop(1, "rgba(0,0,0,0)");
    c.globalAlpha = 0.6 + 0.3 * Math.sin(now * 0.00018 + 1.5);
    c.fillStyle = ng2;
    c.fillRect(0, 0, w, h);
    c.globalAlpha = 1;

    // Drifting echo silhouettes
    for (let i = echoes.length - 1; i >= 0; i--) {
      const e = echoes[i];
      e.x += e.vx * dt * 0.06;
      e.y += e.vy * dt * 0.06;
      e.life += dt;
      // Fade in/out
      const lifeT = e.life / e.maxLife;
      if (lifeT < 0.2) e.alpha = (lifeT / 0.2) * e.maxAlpha;
      else if (lifeT > 0.8) e.alpha = ((1 - lifeT) / 0.2) * e.maxAlpha;
      else e.alpha = e.maxAlpha;
      if (lifeT >= 1 || e.x < -100 || e.x > w + 100) {
        echoes[i] = spawnEcho(false);
        continue;
      }
      drawEchoSilhouette(e.x, e.y, e.size, e.alpha, e.hue);
    }

    // Shooting stars
    shootingTimer -= dt;
    if (shootingTimer <= 0) {
      shootingTimer = 3500 + Math.random() * 5000;
      spawnShooting();
    }
    for (let i = shootings.length - 1; i >= 0; i--) {
      const s = shootings[i];
      s.x += s.vx;
      s.y += s.vy;
      s.life -= dt;
      if (s.life <= 0) { shootings.splice(i, 1); continue; }
      const a = s.life / s.maxLife;
      c.strokeStyle = `rgba(200,220,255,${a * 0.9})`;
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(s.x, s.y);
      c.lineTo(s.x - s.vx * 6, s.y - s.vy * 6);
      c.stroke();
      c.fillStyle = `rgba(255,255,255,${a})`;
      c.beginPath();
      c.arc(s.x, s.y, 1.5, 0, Math.PI * 2);
      c.fill();
    }

    // Spectrum overlay — alt kenarda yumuşak frequency bars (soluk, dekoratif)
    drawSpectrumOverlay();
  }

  function drawSpectrumOverlay() {
    if (typeof Music === "undefined" || !Music.getSpectrum) return;
    const data = Music.getSpectrum();
    if (!data) return;
    const bins = data.length;
    const barCount = Math.min(64, bins);
    const step = Math.floor(bins / barCount);
    const barW = w / barCount;
    const baseY = h - 4;
    const maxBarH = Math.min(180, h * 0.20);

    c.save();
    c.globalCompositeOperation = "screen";
    for (let i = 0; i < barCount; i++) {
      let v = 0;
      for (let j = 0; j < step; j++) v += data[i * step + j];
      v /= (step * 255);
      const bh = v * maxBarH;
      const cx = i * barW;
      // Frequency'e göre renk: bass mor, mid mavi, treble cyan
      const t = i / barCount;
      let r, g, b;
      if (t < 0.3) { r = 138; g = 125; b = 255; }
      else if (t < 0.65) { r = 90; g = 160; b = 255; }
      else { r = 90; g = 215; b = 255; }
      const grad = c.createLinearGradient(0, baseY, 0, baseY - bh);
      grad.addColorStop(0, `rgba(${r},${g},${b},0.45)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      c.fillStyle = grad;
      c.fillRect(cx + 1, baseY - bh, barW - 2, bh);
    }
    c.restore();
  }

  window.addEventListener("resize", () => { w = 0; });
  return { render, resize };
})();

// ---------- Screens ----------
const Screens = (() => {
  function show(name) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    const el = document.getElementById("screen" + name[0].toUpperCase() + name.slice(1));
    if (el) el.classList.add("active");
    // Müzik track seçimi: SADECE title'da 'menu' (voyage MP3), diğer her ekranda 'game'
    // (procedural chiptune — bölümler arası ambiance devam etsin).
    if (typeof Music !== "undefined") {
      Music.play(name === "title" ? "menu" : "game");
    }
  }
  return { show };
})();

// ---------- Save (localStorage progress) ----------
const Save = (() => {
  // v2: 1987 → 23 hand-crafted geçişinde eski indexler artık farklı seviyelere
  // denk geldiği için key bump'lanıyor. Eski save invalid.
  const KEY = "timeEcho.progress.v2";
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || { cleared: [] }; }
    catch (e) { return { cleared: [] }; }
  }
  function save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); }
    catch (e) {}
  }
  function isCleared(idx) { return load().cleared.includes(idx); }
  function maxUnlocked() {
    const cleared = load().cleared;
    if (cleared.length === 0) return 0;
    let max = 0;
    for (const v of cleared) if (v > max) max = v;
    return Math.min(LEVELS.length - 1, max + 1);
  }
  function markCleared(idx, stars) {
    const d = load();
    if (!d.cleared.includes(idx)) d.cleared.push(idx);
    // Yıldız puanı (en iyi skor saklanır)
    if (!d.stars) d.stars = {};
    const prev = d.stars[idx] || 0;
    if (stars > prev) d.stars[idx] = stars;
    save(d);
  }
  function getStars(idx) {
    const d = load();
    return (d.stars && d.stars[idx]) || 0;
  }
  function reset() { save({ cleared: [] }); }
  return { load, isCleared, maxUnlocked, markCleared, getStars, reset };
})();

// ---------- Game ----------
const Game = (() => {
  const canvas = document.getElementById("board");

  // ---- WebGL2 post-FX hattı (varsa) ----
  // ctx: prosedürel çizim için Canvas2D context. WebGL aktifse offscreen canvas'a
  // çizilir, sonra WebGLFX shader pass'lerinden geçirilip ana canvas'a yazılır.
  let useWebGL = false;
  let offCanvas = null;
  let ctx;
  if (typeof WebGLFX !== "undefined") {
    offCanvas = document.createElement("canvas");
    offCanvas.width = canvas.width;
    offCanvas.height = canvas.height;
    if (WebGLFX.init(canvas)) {
      useWebGL = true;
      ctx = offCanvas.getContext("2d");
    }
  }
  if (!useWebGL) {
    ctx = canvas.getContext("2d");
  }

  // Preload PNG asset engines
  if (typeof Sprite !== "undefined") Sprite.init();
  if (typeof Effects !== "undefined") Effects.init();

  const movesEl = document.getElementById("movesLeft");
  const echoEl = document.getElementById("echoCount");
  const levelNumEl = document.getElementById("levelNum");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayBody = document.getElementById("overlayBody");
  const overlayBtn = document.getElementById("overlayBtn");
  const overlayBtn2 = document.getElementById("overlayBtn2");

  const COLORS = {
    bgCell: "#0d1020",
    grid: "#1a1f3a",
    wall: "#2a2f55",
    wallEdge: "#3d4480",
    plate: "#4a3d8a",
    plateOn: "#8a7dff",
    doorClosed: "#3a2855",
    doorOpen: "#1a3a55",
    goal: "#ffd97d",
    goalGlow: "rgba(255,217,125,0.5)",
    player: "#5ad7ff",
    playerGlow: "rgba(90,215,255,0.6)",
    echo: "#8a7dff",
    echoGlow: "rgba(138,125,255,0.4)",
    echoDead: "#3a3550",
    portal: "#7dffb6",
    portalGlow: "rgba(125,255,182,0.5)",
    laserEmit: "#ff7da8",
    laserBeam: "rgba(255,125,168,0.85)",
    laserOff: "#4a3050",
  };

  // ---------- Level parsing ----------
  function parseLevel(def) {
    const grid = def.grid;
    const h = grid.length;
    const w = Math.max(...grid.map(r => r.length));
    const walls = new Set();
    const plates = new Map();
    const doors = new Map();
    const portals = new Map();   // id ('1'..'9') -> [{x,y}, {x,y}]
    const emitters = [];         // {x,y,dir,plate?}
    const quantumTiles = [];     // {x, y} — her turda duvar↔zemin
    const boxes = [];            // {x, y} — itilebilir kutular
    const patrols = [];          // {x, y, initDir:[dx,dy]} — devriye düşmanı
    let start = null;
    let goal = null;

    const dirOf = { ">": [1, 0], "<": [-1, 0], "^": [0, -1], "v": [0, 1] };

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        const c = grid[y][x];
        if (c === "#") walls.add(`${x},${y}`);
        else if (c === "P") start = { x, y };
        else if (c === "G") goal = { x, y };
        else if (c === "Q") quantumTiles.push({ x, y });
        else if (c === "B") boxes.push({ x, y });
        else if (c === "X") patrols.push({ x, y, initDir: null });
        else if (c >= "a" && c <= "z") plates.set(c, { x, y });
        else if (c >= "A" && c <= "Z") doors.set(c, { x, y });
        else if (c >= "1" && c <= "9") {
          if (!portals.has(c)) portals.set(c, []);
          portals.get(c).push({ x, y });
        } else if (dirOf[c]) {
          emitters.push({ x, y, dir: dirOf[c] });
        }
      }
    }
    // Apply level.lasers (plate associations)
    if (def.lasers) {
      def.lasers.forEach(l => {
        const e = emitters.find(em => em.x === l.x && em.y === l.y);
        if (e) e.plate = l.plate;
      });
    }
    // Patrol başlangıç yönü: önce def.patrols ile override, yoksa
    // yatay/dikey komşulardan boş olan tarafa doğru başlat.
    patrols.forEach(p => {
      const override = def.patrols && def.patrols.find(d => d.x === p.x && d.y === p.y);
      if (override && override.dx != null && override.dy != null) {
        p.initDir = [override.dx, override.dy];
        return;
      }
      const tries = [[1,0],[-1,0],[0,1],[0,-1]];
      for (const [dx,dy] of tries) {
        const nx = p.x + dx, ny = p.y + dy;
        const k = `${nx},${ny}`;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (walls.has(k)) continue;
        p.initDir = [dx, dy];
        return;
      }
      p.initDir = [1, 0];
    });
    // Kırılgan plakalar — def.fragile: ['a', 'b'] listesi, paired uppercase door bir kez basılınca permanent açılır
    const fragile = new Set(def.fragile || []);
    return { def, w, h, walls, plates, doors, portals, emitters, quantumTiles, boxes, patrols, fragile, start, goal };
  }

  // ---------- State ----------
  let level = null;
  let levelIdx = 0;
  let isCustom = false;
  let customLevel = null;
  let player = null;
  let movesLeft = 0;
  let currentMoves = [];
  let echoes = [];                  // [{moves: [{dx,dy},...]}]
  let echoState = [];               // per-echo: {pos:{x,y}, dead:false}
  let turn = 0;
  let won = false;
  let busy = false;
  let beams = [];                   // current beam cells (post-tick), for render
  let quantumWalls = new Set();     // şu an duvar olan quantum tile'lar
  let boxState = [];                // [{x, y}] — itilebilir kutuların anlık pozisyonları
  let patrolState = [];             // [{x, y, dir:[dx,dy], dead}] — devriye anlık durumu
  let latchedDoors = new Set();     // 'A','B'... kırılgan plakaya basılmış permanent açık kapılar
  let speedRunStart = 0;            // speed-run timer başlangıcı
  let speedRunTime = 0;             // toplam geçen süre (ms)
  let _lastWinReplay = null;        // ghost replay: son kazanan run verileri

  // ---------- Visual FX state (experimental) ----------
  const TWEEN_MS = 120;             // cell-to-cell kayma süresi (ms)
  const fx = {
    particles: [],                  // {x, y, vx, vy, life, maxLife, color, size}
    shakeUntil: 0,
    shakeMag: 0,
    playerLastMoveAt: 0,
    playerFacing: 1,                // -1 left, 1 right
    echoLastMoveAt: [],
    echoFacing: [],
    // Smooth move tween state
    playerTween: null,              // {fromX, fromY, toX, toY, start}
    echoTween: [],                  // [{fromX, fromY, toX, toY, start}]
    boxTween: [],                   // [{idx, fromX, fromY, toX, toY, start}]
  };
  function spawnParticles(cx, cy, count, opts) {
    const { color = "#8a7dff", spread = 1, speed = 2, life = 700, size = 2 } = opts || {};
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (0.4 + Math.random() * 0.6) * speed;
      fx.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(a) * v * spread,
        vy: Math.sin(a) * v * spread - 0.3,
        life: life,
        maxLife: life,
        color,
        size: size + Math.random() * 1.5,
      });
    }
  }
  function shake(mag, dur) {
    fx.shakeUntil = performance.now() + dur;
    fx.shakeMag = Math.max(fx.shakeMag, mag);
  }

  function activeEntities() {
    const list = [];
    if (player) list.push({ ...player, kind: "player", alive: !player.dead });
    echoState.forEach((e, i) => list.push({ ...e.pos, kind: "echo", idx: i, alive: !e.dead }));
    return list;
  }

  function liveEntities() { return activeEntities().filter(e => e.alive); }

  function resetRun() {
    player = { ...level.start, dead: false };
    movesLeft = level.def.moves;
    currentMoves = [];
    echoState = echoes.map(() => ({ pos: { ...level.start }, dead: false }));
    turn = 0;
    won = false;
    busy = false;
    // Quantum tiles: çift turda duvar, tek turda zemin (başlangıçta duvar)
    quantumWalls = new Set();
    level.quantumTiles.forEach(q => quantumWalls.add(`${q.x},${q.y}`));
    // Kutuları orijinal pozisyonlarına döndür
    boxState = level.boxes.map(b => ({ x: b.x, y: b.y }));
    // Devriyeleri başlat
    patrolState = level.patrols.map(p => ({
      x: p.x, y: p.y, dir: [p.initDir[0], p.initDir[1]], dead: false,
    }));
    // Kırılgan plaka latching sıfırla
    latchedDoors = new Set();
    // Speed-run timer
    speedRunStart = performance.now();
    speedRunTime = 0;
    // Tween state temizle — yoksa eski pozisyonda render olur
    fx.playerTween = null;
    fx.echoTween = [];
    fx.boxTween = [];
    fx.echoLastMoveAt = [];
    fx.echoFacing = [];
    if (typeof Effects !== "undefined") Effects.clear();
    if (typeof Bark !== "undefined") Bark.clear();
    hideOverlay();
    computeBeams();
    updateHUD();
  }

  function loadLevel(idx) {
    isCustom = false;
    customLevel = null;
    levelIdx = ((idx % LEVELS.length) + LEVELS.length) % LEVELS.length;
    level = parseLevel(LEVELS[levelIdx]);
    echoes = [];
    levelNumEl.textContent = String(levelIdx + 1);
    Screens.show("game");
    resetRun();
    showIntro();
  }

  function playCustom(def) {
    isCustom = true;
    customLevel = def;
    level = parseLevel(def);
    echoes = [];
    levelNumEl.textContent = I18n.t("ed.customLabel");
    Screens.show("game");
    resetRun();
    showIntro();
  }

  // ---------- Door / Laser state ----------
  function isPlateActive(plateId, entities) {
    const plate = level.plates.get(plateId);
    if (!plate) return false;
    // Varlık VEYA kutu plaka üzerindeyse aktif
    if (entities.some(e => e.alive && e.x === plate.x && e.y === plate.y)) return true;
    if (boxState.some(b => b.x === plate.x && b.y === plate.y)) return true;
    return false;
  }

  function isDoorOpen(doorId, entities) {
    // Kırılgan plaka bir kez aktive olduysa kapı permanent açık
    if (latchedDoors.has(doorId)) return true;
    return isPlateActive(doorId.toLowerCase(), entities);
  }

  function isLaserOn(emitter, entities) {
    if (!emitter.plate) return true;
    return !isPlateActive(emitter.plate, entities);
  }

  function computeBeamsFromEntities(entities) {
    const cells = new Set();
    const beamList = [];
    for (const e of level.emitters) {
      if (!isLaserOn(e, entities)) continue;
      let x = e.x + e.dir[0], y = e.y + e.dir[1];
      while (x >= 0 && y >= 0 && x < level.w && y < level.h) {
        if (level.walls.has(`${x},${y}`)) break;
        if (quantumWalls.has(`${x},${y}`)) break;
        // Closed doors block beam
        let blocked = false;
        for (const [doorId, pos] of level.doors) {
          if (pos.x === x && pos.y === y && !isDoorOpen(doorId, entities)) {
            blocked = true;
            break;
          }
        }
        if (blocked) break;
        // Kutular beam'i bloklar
        if (boxState.some(b => b.x === x && b.y === y)) break;
        cells.add(`${x},${y}`);
        beamList.push({ x, y });
        x += e.dir[0];
        y += e.dir[1];
      }
    }
    return { cells, list: beamList };
  }

  function computeBeams() {
    const result = computeBeamsFromEntities(liveEntities());
    beams = result.list;
    return result;
  }

  function isBlocked(x, y, entities) {
    if (x < 0 || y < 0 || x >= level.w || y >= level.h) return true;
    if (level.walls.has(`${x},${y}`)) return true;
    // Quantum tile şu an duvarsa bloklar
    if (quantumWalls.has(`${x},${y}`)) return true;
    for (const [doorId, pos] of level.doors) {
      if (pos.x === x && pos.y === y && !isDoorOpen(doorId, entities)) return true;
    }
    // Emitters are solid
    for (const e of level.emitters) {
      if (e.x === x && e.y === y) return true;
    }
    // Kutular — echo'lar için blok (sadece oyuncu iter)
    for (const b of boxState) {
      if (b.x === x && b.y === y) return true;
    }
    return false;
  }

  // Kutu itme: oyuncu (dx,dy) yönünde kutuya yürüyorsa, kutu da aynı yönde itilir
  function tryPushBox(bx, by, dx, dy, entities) {
    const box = boxState.find(b => b.x === bx && b.y === by);
    if (!box) return false;
    const nx = bx + dx, ny = by + dy;
    // Kutu arkasındaki hücre: duvar/kapı/emitter/başka kutu varsa itemez
    if (nx < 0 || ny < 0 || nx >= level.w || ny >= level.h) return false;
    if (level.walls.has(`${nx},${ny}`)) return false;
    if (quantumWalls.has(`${nx},${ny}`)) return false;
    for (const [doorId, pos] of level.doors) {
      if (pos.x === nx && pos.y === ny && !isDoorOpen(doorId, entities)) return false;
    }
    for (const e of level.emitters) { if (e.x === nx && e.y === ny) return false; }
    for (const b of boxState) { if (b.x === nx && b.y === ny) return false; }
    for (const p of patrolState) { if (!p.dead && p.x === nx && p.y === ny) return false; }
    box.x = nx;
    box.y = ny;
    return true;
  }

  function portalPair(x, y) {
    for (const [id, pair] of level.portals) {
      const i = pair.findIndex(p => p.x === x && p.y === y);
      if (i !== -1 && pair.length === 2) return pair[1 - i];
    }
    return null;
  }

  // ---------- Tick ----------
  function tick(dx, dy) {
    // Replay sırasında busy=true ama tick yine de işlemeli
    if ((busy && !_replaying) || won || movesLeft <= 0) return;
    if (player.dead) return;

    const preEntities = liveEntities();

    // 0. Quantum tile geçişi — her turda duvar↔zemin
    if (level.quantumTiles.length > 0) {
      level.quantumTiles.forEach(q => {
        const k = `${q.x},${q.y}`;
        if (quantumWalls.has(k)) quantumWalls.delete(k);
        else quantumWalls.add(k);
      });
    }

    // 1. Move player (try) — kutu varsa itmeyi dene
    const px = player.x + dx;
    const py = player.y + dy;
    let moved = false;
    const oldPx = player.x, oldPy = player.y;
    const boxAtTarget = boxState.find(b => b.x === px && b.y === py);
    if (boxAtTarget) {
      const bOldX = boxAtTarget.x, bOldY = boxAtTarget.y;
      if (tryPushBox(px, py, dx, dy, preEntities)) {
        player.x = px;
        player.y = py;
        moved = true;
        Audio.move();
        // Box tween
        const bIdx = boxState.indexOf(boxAtTarget);
        fx.boxTween[bIdx] = { fromX: bOldX, fromY: bOldY, toX: boxAtTarget.x, toY: boxAtTarget.y, start: performance.now() };
      }
    } else if (!isBlocked(px, py, preEntities)) {
      player.x = px;
      player.y = py;
      moved = true;
    }
    currentMoves.push({ dx, dy });
    if (moved) {
      if (!boxAtTarget) Audio.move();
      fx.playerLastMoveAt = performance.now();
      if (dx !== 0) fx.playerFacing = dx > 0 ? 1 : -1;
      // Player tween
      fx.playerTween = { fromX: oldPx, fromY: oldPy, toX: player.x, toY: player.y, start: performance.now() };
      if (typeof Bark !== "undefined") Bark.maybe("general", 0.06);
    } else {
      Audio.bump();
      shake(2, 120);
      if (typeof Bark !== "undefined") Bark.maybe("general", 0.18);
    }

    // 2. Move echoes
    echoState.forEach((es, i) => {
      if (es.dead) return;
      const mv = echoes[i].moves[turn];
      if (!mv) return;
      const nx = es.pos.x + mv.dx;
      const ny = es.pos.y + mv.dy;
      const oldX = es.pos.x, oldY = es.pos.y;
      if (!isBlocked(nx, ny, preEntities)) {
        es.pos = { x: nx, y: ny };
        fx.echoLastMoveAt[i] = performance.now();
        if (mv.dx !== 0) fx.echoFacing[i] = mv.dx > 0 ? 1 : -1;
        // Echo tween
        fx.echoTween[i] = { fromX: oldX, fromY: oldY, toX: nx, toY: ny, start: performance.now() };
      }
    });

    // 2.5. Move patrols — duvar/kapı/emitter/kutu/diğer patrol ile blocklanırsa yön ters çevir
    patrolState.forEach((p, i) => {
      if (p.dead) return;
      const tryDirs = [p.dir, [-p.dir[0], -p.dir[1]]];
      const oldX = p.x, oldY = p.y;
      for (const d of tryDirs) {
        const nx = p.x + d[0], ny = p.y + d[1];
        if (nx < 0 || ny < 0 || nx >= level.w || ny >= level.h) continue;
        if (level.walls.has(`${nx},${ny}`)) continue;
        if (quantumWalls.has(`${nx},${ny}`)) continue;
        let blocked = false;
        for (const [doorId, pos] of level.doors) {
          if (pos.x === nx && pos.y === ny && !isDoorOpen(doorId, preEntities)) { blocked = true; break; }
        }
        if (blocked) continue;
        if (level.emitters.some(e => e.x === nx && e.y === ny)) continue;
        if (boxState.some(b => b.x === nx && b.y === ny)) continue;
        if (patrolState.some((q, qi) => qi !== i && !q.dead && q.x === nx && q.y === ny)) continue;
        // Yön kabul
        p.dir = [d[0], d[1]];
        p.x = nx; p.y = ny;
        fx.patrolTween = fx.patrolTween || [];
        fx.patrolTween[i] = { fromX: oldX, fromY: oldY, toX: nx, toY: ny, start: performance.now() };
        break;
      }
    });

    // 3. Resolve teleports (player + echoes) — her iki uçta parçacık patlaması
    fx._teleportBursts = fx._teleportBursts || [];
    const pTarget = portalPair(player.x, player.y);
    if (pTarget) {
      const sx = player.x, sy = player.y;
      player.x = pTarget.x;
      player.y = pTarget.y;
      if (typeof Music !== "undefined" && Music.playTeleportSfx) Music.playTeleportSfx();
      else Audio.teleport();
      shake(3, 160);
      fx._teleportBursts.push({ x: sx, y: sy, t: performance.now(), kind: "out" });
      fx._teleportBursts.push({ x: pTarget.x, y: pTarget.y, t: performance.now(), kind: "in" });
      if (typeof Effects !== "undefined") {
        Effects.spawn("portal", sx, sy);
        Effects.spawn("portal", pTarget.x, pTarget.y);
      }
      // Tween'i yeni konuma snap et — render eski tween'i takip etmesin
      fx.playerTween = null;
    }
    echoState.forEach((es, i) => {
      if (es.dead) return;
      const t = portalPair(es.pos.x, es.pos.y);
      if (t) {
        const sx = es.pos.x, sy = es.pos.y;
        es.pos = { x: t.x, y: t.y };
        fx._teleportBursts.push({ x: sx, y: sy, t: performance.now(), kind: "out" });
        fx._teleportBursts.push({ x: t.x, y: t.y, t: performance.now(), kind: "in" });
        if (typeof Effects !== "undefined") {
          Effects.spawn("portal", sx, sy);
          Effects.spawn("portal", t.x, t.y);
        }
        fx.echoTween[i] = null;
      }
    });

    turn++;
    movesLeft--;

    // 4. Compute post-tick door/plate state -> compute beams -> damage
    const postEntities = liveEntities();
    const beamData = computeBeamsFromEntities(postEntities);
    let zapped = false;

    if (beamData.cells.has(`${player.x},${player.y}`)) {
      player.dead = true;
      zapped = true;
    }
    echoState.forEach(es => {
      if (es.dead) return;
      if (beamData.cells.has(`${es.pos.x},${es.pos.y}`)) {
        es.dead = true;
        zapped = true;
      }
    });

    if (zapped) {
      Audio.laser();
      shake(6, 200);
      // Echo'lar için ölüm kıvılcımı: post-tick'te dead olanları yakala
      echoState.forEach((es, i) => {
        if (es.dead && !es._burstFired) {
          es._burstFired = true;
          fx._echoDeathBursts = fx._echoDeathBursts || [];
          fx._echoDeathBursts.push({ x: es.pos.x, y: es.pos.y, t: performance.now() });
          if (typeof Effects !== "undefined") Effects.spawn("sparks", es.pos.x, es.pos.y);
        }
      });
      if (player.dead) {
        if (typeof Effects !== "undefined") Effects.spawn("sparks", player.x, player.y);
        if (typeof Bark !== "undefined") Bark.force("death");
      }
    }

    // 4.5. Devriye hasarı — aynı hücreyi paylaşan canlı varlık ölür
    let patrolHit = false;
    patrolState.forEach(p => {
      if (p.dead) return;
      if (!player.dead && player.x === p.x && player.y === p.y) {
        player.dead = true;
        patrolHit = true;
      }
      echoState.forEach((es, i) => {
        if (es.dead) return;
        if (es.pos.x === p.x && es.pos.y === p.y) {
          es.dead = true;
          patrolHit = true;
          fx._echoDeathBursts = fx._echoDeathBursts || [];
          fx._echoDeathBursts.push({ x: es.pos.x, y: es.pos.y, t: performance.now() });
        }
      });
    });
    if (patrolHit) {
      Audio.death();
      shake(10, 320);
      if (typeof Effects !== "undefined") {
        if (player.dead) Effects.spawn("sparks", player.x, player.y);
        echoState.forEach(es => {
          if (es.dead && !es._patrolBurstFired) {
            es._patrolBurstFired = true;
            Effects.spawn("sparks", es.pos.x, es.pos.y);
          }
        });
      }
      if (player.dead && typeof Bark !== "undefined") Bark.force("death");
    }

    // 4.6. Kırılgan plaka latching — fragile listedeki plaka üzerinde canlı varlık varsa kapı sonsuza açık
    if (level.fragile && level.fragile.size > 0) {
      const all = liveEntities();
      level.fragile.forEach(letter => {
        const plate = level.plates.get(letter);
        if (!plate) return;
        const doorId = letter.toUpperCase();
        if (latchedDoors.has(doorId)) return;
        const touched = all.some(e => e.x === plate.x && e.y === plate.y) ||
                        boxState.some(b => b.x === plate.x && b.y === plate.y);
        if (touched) {
          latchedDoors.add(doorId);
          fx._latchBurstAt = { x: plate.x, y: plate.y, t: performance.now() };
          if (typeof Music !== "undefined" && Music.playSting) Music.playSting("latch");
        }
      });
    }

    // 5. Plate-on sound (best effort: detect any plate that became active)
    // (Skip — too noisy; plate state inferred visually.)

    // Re-compute beams for next render
    beams = computeBeamsFromEntities(liveEntities()).list;

    if (player.dead) {
      Audio.death();
      shake(14, 500);
      // Render coords for particle burst — will be projected to canvas in render via x/y as cell coords
      fx._deathBurstAt = { x: player.x, y: player.y, t: performance.now() };
      updateHUD();
      setTimeout(() => showAnnihilated(), 250);
      return;
    }

    // 6. Goal check
    if (player.x === level.goal.x && player.y === level.goal.y) {
      won = true;
      Audio.win();
      updateHUD();
      setTimeout(() => showWin(), 250);
      return;
    }

    if (movesLeft <= 0) {
      updateHUD();
      setTimeout(() => showOutOfSync(), 200);
      return;
    }

    updateHUD();
  }

  // ---------- Echo control ----------
  function recordEcho() {
    if (busy || won) return;
    if (currentMoves.length === 0) {
      toast(I18n.t("toast.noMoves"), "warn");
      return;
    }
    echoes.push({ moves: currentMoves.slice() });
    Audio.record();
    // Zaman tozu — oyuncunun bulunduğu hücreden parçacık fışkırması
    fx._recordBurstAt = { x: player.x, y: player.y, t: performance.now() };
    const n = echoes.length;
    toast(I18n.t("toast.recorded", n), "success");
    if (typeof Bark !== "undefined") Bark.maybe("record", 0.55);
    resetRun();
  }
  function undoEcho() {
    if (busy) return;
    if (echoes.length === 0) {
      toast(I18n.t("toast.noEcho"), "warn");
      return;
    }
    echoes.pop();
    Audio.undo();
    toast(I18n.t("toast.undone"), "warn");
    resetRun();
  }
  function fullReset() {
    echoes = [];
    Audio.undo();
    toast(I18n.t("toast.reset"), "danger");
    resetRun();
  }

  // ---------- Overlay ----------
  function showOverlay({ title, body, btnText, action, secondText, secondAction, fail }) {
    busy = true;
    overlayTitle.textContent = title;
    overlayBody.textContent = body;
    overlayBtn.textContent = btnText;
    overlay.querySelector(".overlay-card").classList.toggle("fail", !!fail);
    overlay.classList.remove("hidden");
    overlayBtn.onclick = () => {
      Audio.click();
      busy = false;
      hideOverlay();
      action && action();
    };
    if (secondText) {
      overlayBtn2.textContent = secondText;
      overlayBtn2.style.display = "";
      overlayBtn2.onclick = () => {
        Audio.click();
        busy = false;
        hideOverlay();
        secondAction && secondAction();
      };
    } else {
      overlayBtn2.style.display = "none";
    }
  }
  function hideOverlay() {
    overlay.classList.add("hidden");
    busy = false;
  }
  function showIntro() {
    showOverlay({
      title: levelText(level.def, "name"),
      body: levelText(level.def, "intro"),
      btnText: I18n.t("ov.start"),
      action: () => {},
      secondText: I18n.t("ov.menu"),
      secondAction: () => Screens.show("title"),
    });
  }
  function calcStars() {
    // 3 yıldız: minimum echo ile, hamlelerin %60'ından azıyla
    // 2 yıldız: minimum+1 echo veya hamlelerin %80'ından azıyla
    // 1 yıldız: her zaman (kazandıysan en az 1)
    const totalMoves = level.def.moves;
    const usedMoves = totalMoves - movesLeft;
    const echoCount = echoes.length;
    const moveRatio = usedMoves / totalMoves;
    if (echoCount <= 1 && moveRatio < 0.6) return 3;
    if (echoCount <= 2 && moveRatio < 0.8) return 2;
    return 1;
  }

  function starText(n) {
    return "★".repeat(n) + "☆".repeat(3 - n);
  }

  // ---------- Ghost Replay ----------
  let _replayTimer = null;
  let _replaying = false;
  function playGhostReplay() {
    if (!_lastWinReplay) return;
    const rep = _lastWinReplay;
    // Seviyeyi yeniden yükle
    level = parseLevel(LEVELS[rep.levelIdx]);
    echoes = rep.echoes.map(e => ({ moves: e.moves.slice() }));
    resetRun();
    hideOverlay();
    busy = true;
    _replaying = true;
    let step = 0;
    const allMoves = rep.finalMoves;
    _replayTimer = setInterval(() => {
      // Replay biterse veya oyuncu hedefe ulaşırsa (won) erken kapat
      if (step >= allMoves.length || won || (player && player.dead)) {
        clearInterval(_replayTimer);
        _replayTimer = null;
        _replaying = false;
        busy = false;
        setTimeout(() => {
          // Replay bitince win overlay'ine geri dön — user tekrar izleyebilir veya devam edebilir
          showWinOverlay(_lastWinStars);
        }, 500);
        return;
      }
      const m = allMoves[step++];
      tick(m.dx, m.dy);
    }, 400);
  }

  // showWin: ilk kazanma anında side-effect'lerle (save, replay capture, fanfare) çağrılır.
  // showWinOverlay: tekrar tekrar (replay sonrası) çağrılabilir; sadece overlay'i kurar.
  let _lastWinStars = 0;
  function showWin() {
    const stars = calcStars();
    _lastWinStars = stars;
    if (!isCustom) Save.markCleared(levelIdx, stars);
    if (!isCustom) {
      _lastWinReplay = {
        levelIdx,
        echoes: echoes.map(e => ({ moves: e.moves.slice() })),
        finalMoves: currentMoves.slice(),
      };
    }
    // Win partikülü + fanfare (sadece ilk kazanmada, replay tekrarında değil)
    fx._winBurstAt = { x: level.goal.x, y: level.goal.y, gold: stars >= 3 };
    if (typeof Music !== "undefined" && Music.playSting) {
      Music.playSting(stars >= 3 ? "win3" : "win");
    }
    speedRunTime = performance.now() - speedRunStart;
    showWinOverlay(stars);
  }

  function showWinOverlay(stars) {
    if (isCustom) {
      showOverlay({
        title: I18n.t("ov.stabilized"),
        body: starText(stars) + "\n" + I18n.t("ov.custom.win"),
        btnText: I18n.t("ov.toEditor"),
        action: () => Screens.show("editor"),
      });
      return;
    }
    const isLast = levelIdx === LEVELS.length - 1;
    const timeStr = formatTime(speedRunTime);
    showOverlay({
      title: I18n.t("ov.stabilized") + "  " + starText(stars),
      body: (isLast ? I18n.t("ov.stabilized.last") : I18n.t("ov.stabilized.body"))
            + "\n" + I18n.t("ov.stars", stars) + "  ·  " + timeStr,
      btnText: isLast ? I18n.t("ov.outro") : I18n.t("ov.continue"),
      action: () => {
        const storyEntry = (typeof getLevelStory === "function")
          ? getLevelStory(levelIdx, isLast)
          : (isLast ? STORY.outro : STORY.afterLevel[levelIdx]);
        if (isLast) showStory(storyEntry, () => Screens.show("title"));
        else showStory(storyEntry, () => loadLevel(levelIdx + 1));
      },
      secondText: I18n.t("ov.replay"),
      secondAction: () => playGhostReplay(),
    });
  }
  function showAnnihilated() {
    showOverlay({
      title: I18n.t("ov.annihilated"),
      body: I18n.t("ov.annihilated.body"),
      btnText: I18n.t("ov.retry"),
      action: () => resetRun(),
      secondText: I18n.t("ov.clearEchoes"),
      secondAction: () => fullReset(),
      fail: true,
    });
  }
  function showOutOfSync() {
    showOverlay({
      title: I18n.t("ov.outOfSync"),
      body: I18n.t("ov.outOfSync.body"),
      btnText: I18n.t("ov.newEcho"),
      action: () => recordEcho(),
      secondText: I18n.t("ov.reset"),
      secondAction: () => fullReset(),
      fail: true,
    });
  }

  function flash(text) {
    const orig = document.querySelector(".hud .title").textContent;
    document.querySelector(".hud .title").textContent = "// " + text;
    setTimeout(() => {
      document.querySelector(".hud .title").textContent = orig;
    }, 700);
  }

  function updateHUD() {
    movesEl.textContent = String(movesLeft);
    echoEl.textContent = String(echoes.length);
    const recEl = document.getElementById("recCount");
    if (recEl) {
      recEl.textContent = String(currentMoves.length);
      if (currentMoves.length > 0) recEl.classList.add("rec-active");
      else recEl.classList.remove("rec-active");
    }
  }

  // ---------- Time format helper ----------
  function formatTime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    const frac = Math.floor((ms % 1000) / 100);
    return `${m}:${String(sec).padStart(2, "0")}.${frac}`;
  }

  // ---------- Tween helper ----------
  function tweenPos(tw, now, cellX, cellY, ox, oy, cell) {
    if (!tw) return { x: ox + cellX * cell, y: oy + cellY * cell };
    const t = Math.min(1, (now - tw.start) / TWEEN_MS);
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // easeInOutQuad
    const rx = tw.fromX + (tw.toX - tw.fromX) * ease;
    const ry = tw.fromY + (tw.toY - tw.fromY) * ease;
    return { x: ox + rx * cell, y: oy + ry * cell };
  }

  // ---------- Toast ----------
  let _toastTimer = null;
  function toast(text, kind = "info", durMs = 1400) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = text;
    el.className = "toast show " + kind;
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => {
      el.classList.remove("show");
      el.classList.add("hidden");
    }, durMs);
  }

  // ---------- Biome theme (her ~400 seviyede farklı palet) ----------
  const BIOMES = {
    lab:        { name: "lab",        wallA: "#2a2f55", wallB: "#3d4480", rivet: "#4a5088", floorA: "#0d1020", floorDot: "rgba(26,31,58,0.8)",  stars: ["#c9d6ff","#8a7dff","#5ad7ff"], nebula1: "rgba(138,125,255,0.04)", nebula2: "rgba(90,215,255,0.018)" },
    ruin:       { name: "ruin",       wallA: "#553a2a", wallB: "#805140", rivet: "#a8744a", floorA: "#1a1308", floorDot: "rgba(58,40,18,0.8)",  stars: ["#ffe6c9","#ffba7d","#ff8a5a"], nebula1: "rgba(255,180,125,0.04)", nebula2: "rgba(255,140,90,0.018)" },
    voidB:      { name: "void",       wallA: "#3a1f55", wallB: "#5a2580", rivet: "#7a3aa8", floorA: "#0a0420", floorDot: "rgba(58,30,90,0.8)",  stars: ["#e0c9ff","#bb7dff","#7d5aff"], nebula1: "rgba(180,125,255,0.05)", nebula2: "rgba(140,90,255,0.022)" },
    signal:     { name: "signal",     wallA: "#1f553a", wallB: "#258055", rivet: "#3aa86d", floorA: "#04200a", floorDot: "rgba(20,80,40,0.8)",  stars: ["#c9ffd6","#7dffba","#5aff8a"], nebula1: "rgba(125,255,180,0.04)", nebula2: "rgba(90,255,140,0.02)" },
    corruption: { name: "corruption", wallA: "#551f1f", wallB: "#802525", rivet: "#a83a3a", floorA: "#1a0606", floorDot: "rgba(80,20,20,0.8)",  stars: ["#ffc9c9","#ff7d7d","#ff5a5a"], nebula1: "rgba(255,90,90,0.04)",  nebula2: "rgba(255,50,50,0.022)" },
  };
  function getBiome(idx) {
    if (idx == null || idx < 0)  return BIOMES.lab;
    if (idx < 400)  return BIOMES.lab;
    if (idx < 800)  return BIOMES.ruin;
    if (idx < 1200) return BIOMES.voidB;
    if (idx < 1600) return BIOMES.signal;
    return BIOMES.corruption;
  }

  // ---------- Pixel-art tile cache ----------
  const _tileCache = {};
  function getTile(key, size, drawFn) {
    const ckey = key + "_" + size;
    if (_tileCache[ckey]) return _tileCache[ckey];
    const c = document.createElement("canvas");
    c.width = size; c.height = size;
    const tctx = c.getContext("2d");
    drawFn(tctx, size);
    _tileCache[ckey] = c;
    return c;
  }

  function wallTile(tctx, s, pal) {
    pal = pal || BIOMES.lab;
    // Brick/panel texture
    tctx.fillStyle = pal.wallA;
    tctx.fillRect(0, 0, s, s);
    // Panel lines
    tctx.strokeStyle = pal.wallB;
    tctx.lineWidth = 1;
    // Horizontal seams
    tctx.beginPath();
    tctx.moveTo(0, Math.floor(s * 0.33));
    tctx.lineTo(s, Math.floor(s * 0.33));
    tctx.moveTo(0, Math.floor(s * 0.66));
    tctx.lineTo(s, Math.floor(s * 0.66));
    tctx.stroke();
    // Vertical seams (offset)
    tctx.beginPath();
    tctx.moveTo(Math.floor(s * 0.5), 0);
    tctx.lineTo(Math.floor(s * 0.5), Math.floor(s * 0.33));
    tctx.moveTo(Math.floor(s * 0.25), Math.floor(s * 0.33));
    tctx.lineTo(Math.floor(s * 0.25), Math.floor(s * 0.66));
    tctx.moveTo(Math.floor(s * 0.75), Math.floor(s * 0.33));
    tctx.lineTo(Math.floor(s * 0.75), Math.floor(s * 0.66));
    tctx.moveTo(Math.floor(s * 0.5), Math.floor(s * 0.66));
    tctx.lineTo(Math.floor(s * 0.5), s);
    tctx.stroke();
    // Corner rivets
    tctx.fillStyle = pal.rivet;
    const r = Math.max(1, Math.floor(s * 0.04));
    [[2,2],[s-3,2],[2,s-3],[s-3,s-3]].forEach(([x,y]) => tctx.fillRect(x,y,r,r));
    // Top highlight
    tctx.fillStyle = "rgba(255,255,255,0.04)";
    tctx.fillRect(0, 0, s, 2);
  }

  function floorTile(tctx, s, pal) {
    pal = pal || BIOMES.lab;
    tctx.fillStyle = pal.floorA;
    tctx.fillRect(0, 0, s, s);
    // Subtle grid dots
    tctx.fillStyle = pal.floorDot;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const x = Math.floor(s * (0.25 + i * 0.25));
        const y = Math.floor(s * (0.25 + j * 0.25));
        tctx.fillRect(x, y, 1, 1);
      }
    }
  }

  // ---------- Render ----------
  let _lastRenderAt = 0;
  function render() {
    if (!level) return;
    const now = performance.now();
    const dt = _lastRenderAt ? Math.min(50, now - _lastRenderAt) : 16;
    _lastRenderAt = now;

    const W = canvas.width;
    const H = canvas.height;
    const cell = Math.min(W / level.w, H / level.h);
    let ox = (W - cell * level.w) / 2;
    let oy = (H - cell * level.h) / 2;

    // Camera shake
    if (now < fx.shakeUntil) {
      const remain = (fx.shakeUntil - now) / 500;
      const m = fx.shakeMag * remain;
      ox += (Math.random() - 0.5) * m * 2;
      oy += (Math.random() - 0.5) * m * 2;
    } else {
      fx.shakeMag = 0;
    }

    ctx.fillStyle = "#07080d";
    ctx.fillRect(0, 0, W, H);

    // Aktif biome paleti (özel seviye veya geçersiz idx → lab)
    const biome = isCustom ? BIOMES.lab : getBiome(levelIdx);

    // Parallax yıldız/nebula arka planı (biome renkleriyle)
    drawStarfield(W, H, now, biome);

    // Cells
    for (let y = 0; y < level.h; y++) {
      for (let x = 0; x < level.w; x++) {
        const cx = ox + x * cell;
        const cy = oy + y * cell;
        const k = `${x},${y}`;
        const cs = Math.round(cell);
        if (level.walls.has(k) || quantumWalls.has(k)) {
          if (quantumWalls.has(k)) {
            // Q SOLID state — duvar; gerçek zamanlı nabız (alpha + glow)
            const pulse = 0.7 + 0.3 * Math.sin(now / 380);
            // Floor base + parlayan üst kat
            ctx.fillStyle = "#160830";
            ctx.fillRect(cx, cy, cell, cell);
            ctx.save();
            ctx.globalAlpha = pulse;
            ctx.fillStyle = "#5a2db8";
            ctx.fillRect(cx + 2, cy + 2, cell - 4, cell - 4);
            // İç parıltı
            const qg = ctx.createRadialGradient(
              cx + cell/2, cy + cell/2, 0,
              cx + cell/2, cy + cell/2, cell * 0.55
            );
            qg.addColorStop(0, "rgba(180,140,255,0.9)");
            qg.addColorStop(0.6, "rgba(120,80,220,0.4)");
            qg.addColorStop(1, "rgba(60,30,140,0)");
            ctx.fillStyle = qg;
            ctx.fillRect(cx, cy, cell, cell);
            ctx.restore();
            // Çerçeve
            ctx.strokeStyle = "#b48aff";
            ctx.lineWidth = 2;
            ctx.strokeRect(cx + 1.5, cy + 1.5, cell - 3, cell - 3);
            // Q simgesi — parlak, bold
            ctx.shadowColor = "#c9a8ff";
            ctx.shadowBlur = 8;
            ctx.fillStyle = "#fff";
            ctx.font = `bold ${Math.floor(cell * 0.42)}px monospace`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("Q", cx + cell / 2, cy + cell / 2 + 1);
            ctx.shadowBlur = 0;
          } else {
            ctx.drawImage(getTile("wall_" + biome.name, cs, (t, s) => wallTile(t, s, biome)), cx, cy, cell, cell);
          }
        } else {
          const isQuantumOpen = level.quantumTiles.some(q => q.x === x && q.y === y) && !quantumWalls.has(k);
          if (isQuantumOpen) {
            // Q VOID state — geçilebilir; soluk dotted outline + hayalet Q
            ctx.drawImage(getTile("floor_" + biome.name, cs, (t, s) => floorTile(t, s, biome)), cx, cy, cell, cell);
            const pulse2 = 0.25 + 0.18 * Math.sin(now / 380 + Math.PI); // SOLID ile zıt fazda
            ctx.save();
            ctx.globalAlpha = pulse2;
            // Dashed rect — "şu an açık" hissi
            ctx.strokeStyle = "#7a5dff";
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.strokeRect(cx + 2, cy + 2, cell - 4, cell - 4);
            ctx.setLineDash([]);
            ctx.restore();
            // Hayalet Q
            ctx.fillStyle = "rgba(180,140,255,0.30)";
            ctx.font = `${Math.floor(cell * 0.35)}px monospace`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("Q", cx + cell / 2, cy + cell / 2 + 1);
          } else {
            ctx.drawImage(getTile("floor_" + biome.name, cs, (t, s) => floorTile(t, s, biome)), cx, cy, cell, cell);
          }
        }
      }
    }

    const entities = liveEntities();

    // Plates
    for (const [id, pos] of level.plates) {
      const cx = ox + pos.x * cell;
      const cy = oy + pos.y * cell;
      const isFragile = level.fragile && level.fragile.has(id);
      const isLatched = latchedDoors.has(id.toUpperCase());
      const active = isPlateActive(id, entities) || isLatched;
      // Kırılgan plaka: çatlak desen + farklı renk paleti (kırmızımsı)
      if (isFragile) {
        ctx.fillStyle = isLatched ? "#3a1f3a" : (active ? "#ff9d5a" : "#7a3a1f");
      } else {
        ctx.fillStyle = active ? COLORS.plateOn : COLORS.plate;
      }
      const pad = cell * 0.18;
      ctx.beginPath();
      ctx.arc(cx + cell / 2, cy + cell / 2, cell / 2 - pad, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = active ? "#fff" : COLORS.wallEdge;
      if (isFragile && !isLatched) ctx.strokeStyle = "#ffb37d";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Kırılgan: çatlak çizgileri
      if (isFragile) {
        ctx.strokeStyle = isLatched ? "rgba(255,180,255,0.6)" : "rgba(255,120,80,0.7)";
        ctx.lineWidth = 1;
        const mx = cx + cell / 2, my = cy + cell / 2, rr = cell / 2 - pad;
        ctx.beginPath();
        ctx.moveTo(mx - rr * 0.5, my - rr * 0.2);
        ctx.lineTo(mx + rr * 0.3, my + rr * 0.1);
        ctx.lineTo(mx + rr * 0.1, my + rr * 0.5);
        ctx.moveTo(mx - rr * 0.2, my + rr * 0.3);
        ctx.lineTo(mx + rr * 0.4, my + rr * 0.4);
        ctx.stroke();
      }
      ctx.font = `${Math.floor(cell * 0.3)}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = active ? "#fff" : "#9aa6c8";
      if (isFragile && !isLatched) ctx.fillStyle = "#ffe0c0";
      ctx.fillText(isLatched ? "✕" : id, cx + cell / 2, cy + cell / 2 + 1);
    }

    // Portals
    const t = performance.now() / 400;
    for (const [id, pair] of level.portals) {
      pair.forEach((pos, i) => {
        const cx = ox + pos.x * cell + cell / 2;
        const cy = oy + pos.y * cell + cell / 2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(t + i * Math.PI);
        ctx.shadowColor = COLORS.portalGlow;
        ctx.shadowBlur = 12;
        ctx.strokeStyle = COLORS.portal;
        ctx.lineWidth = 2;
        for (let r = cell * 0.18; r < cell * 0.42; r += cell * 0.08) {
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 1.5);
          ctx.stroke();
        }
        ctx.restore();
        ctx.shadowBlur = 0;
        ctx.fillStyle = COLORS.portal;
        ctx.font = `${Math.floor(cell * 0.3)}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(id, cx, cy + 1);
      });
    }

    // Doors
    for (const [id, pos] of level.doors) {
      const cx = ox + pos.x * cell;
      const cy = oy + pos.y * cell;
      const open = isDoorOpen(id, entities);
      if (open) {
        ctx.fillStyle = COLORS.doorOpen;
        ctx.fillRect(cx + cell * 0.1, cy + cell * 0.1, cell * 0.8, cell * 0.8);
        ctx.strokeStyle = "#5ad7ff";
        ctx.lineWidth = 1;
        ctx.strokeRect(cx + cell * 0.1 + 0.5, cy + cell * 0.1 + 0.5, cell * 0.8 - 1, cell * 0.8 - 1);
      } else {
        ctx.fillStyle = COLORS.doorClosed;
        ctx.fillRect(cx, cy, cell, cell);
        ctx.strokeStyle = "#6a4d9a";
        ctx.lineWidth = 2;
        for (let i = 1; i < 4; i++) {
          const yy = cy + (cell * i) / 4;
          ctx.beginPath();
          ctx.moveTo(cx + cell * 0.1, yy);
          ctx.lineTo(cx + cell * 0.9, yy);
          ctx.stroke();
        }
      }
      ctx.fillStyle = open ? "#9aa6c8" : "#c9b6ff";
      ctx.font = `${Math.floor(cell * 0.28)}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(id, cx + cell / 2, cy + cell / 2 + 1);
    }

    // Lasers — emitters and beams
    for (const e of level.emitters) {
      const cx = ox + e.x * cell;
      const cy = oy + e.y * cell;
      const on = isLaserOn(e, entities);
      ctx.fillStyle = on ? COLORS.laserEmit : COLORS.laserOff;
      ctx.fillRect(cx + cell * 0.15, cy + cell * 0.15, cell * 0.7, cell * 0.7);
      ctx.fillStyle = "#fff";
      ctx.font = `${Math.floor(cell * 0.5)}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      let arrow = "?";
      if (e.dir[0] === 1) arrow = "▶";
      else if (e.dir[0] === -1) arrow = "◀";
      else if (e.dir[1] === 1) arrow = "▼";
      else if (e.dir[1] === -1) arrow = "▲";
      ctx.fillStyle = on ? "#fff" : "#888";
      ctx.fillText(arrow, cx + cell / 2, cy + cell / 2 + 1);
    }
    // Beam cells
    ctx.fillStyle = COLORS.laserBeam;
    const flicker = 0.7 + 0.3 * Math.sin(performance.now() / 60);
    ctx.globalAlpha = flicker;
    for (const b of beams) {
      const cx = ox + b.x * cell;
      const cy = oy + b.y * cell;
      ctx.fillRect(cx + cell * 0.35, cy + cell * 0.35, cell * 0.3, cell * 0.3);
      // streak
      ctx.fillRect(cx + cell * 0.05, cy + cell * 0.45, cell * 0.9, cell * 0.1);
    }
    ctx.globalAlpha = 1;

    // Goal
    {
      const cx = ox + level.goal.x * cell;
      const cy = oy + level.goal.y * cell;
      const tt = performance.now() / 600;
      const r = cell * (0.30 + 0.04 * Math.sin(tt));
      ctx.shadowColor = COLORS.goalGlow;
      ctx.shadowBlur = 14;
      ctx.fillStyle = COLORS.goal;
      drawStar(cx + cell / 2, cy + cell / 2, 4, r, r * 0.5);
      ctx.shadowBlur = 0;
    }

    // Kutular (itilebilir) — smooth tween
    boxState.forEach((box, bi) => {
      const tw = fx.boxTween[bi];
      const bp = tweenPos(tw, now, box.x, box.y, ox, oy, cell);
      const bx = bp.x, by = bp.y;
      const pad = cell * 0.12;
      ctx.fillStyle = "#8a6d3a";
      roundRect(bx + pad, by + pad, cell - pad * 2, cell - pad * 2, 3);
      ctx.strokeStyle = "#c9a85a";
      ctx.lineWidth = 1.5;
      roundRectPath(bx + pad, by + pad, cell - pad * 2, cell - pad * 2, 3);
      ctx.stroke();
      ctx.strokeStyle = "#5a4a2a";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx + pad + 3, by + pad + 3);
      ctx.lineTo(bx + cell - pad - 3, by + cell - pad - 3);
      ctx.moveTo(bx + cell - pad - 3, by + pad + 3);
      ctx.lineTo(bx + pad + 3, by + cell - pad - 3);
      ctx.stroke();
    });

    // Patrols — devriye droidleri (kırmızı, salınan göz)
    patrolState.forEach((p, pi) => {
      if (p.dead) return;
      const tw = fx.patrolTween && fx.patrolTween[pi];
      const pp = tweenPos(tw, now, p.x, p.y, ox, oy, cell);
      const px = pp.x + cell / 2;
      const py = pp.y + cell / 2;
      const r = cell * 0.30;
      const pulse = 0.85 + 0.15 * Math.sin(now / 200);
      // Glow
      ctx.shadowColor = "rgba(255,90,90,0.9)";
      ctx.shadowBlur = 12 * pulse;
      // Body — disk
      ctx.fillStyle = "#1a0a14";
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#ff5a5a";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Iç çekirdek
      ctx.fillStyle = "#ff5a5a";
      ctx.beginPath();
      ctx.arc(px, py, r * 0.42 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(px, py, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
      // Yön göstergesi — küçük üçgen
      const dx = p.dir[0], dy = p.dir[1];
      ctx.fillStyle = "#ffb0b0";
      ctx.beginPath();
      ctx.moveTo(px + dx * r * 0.85, py + dy * r * 0.85);
      ctx.lineTo(px + (dx * 0.55 - dy * 0.25) * r, py + (dy * 0.55 + dx * 0.25) * r);
      ctx.lineTo(px + (dx * 0.55 + dy * 0.25) * r, py + (dy * 0.55 - dx * 0.25) * r);
      ctx.closePath();
      ctx.fill();
    });

    // Echoes (humanoid, translucent) — smooth tween
    echoState.forEach((es, i) => {
      const tw = fx.echoTween[i];
      const ep = tweenPos(tw, now, es.pos.x, es.pos.y, ox, oy, cell);
      const cx = ep.x + cell / 2;
      const cy = ep.y + cell / 2;
      const facing = fx.echoFacing[i] || 1;
      const lastMove = fx.echoLastMoveAt[i] || 0;
      const sinceMove = now - lastMove;
      const moving = sinceMove < 280;
      const walkPhase = moving ? (sinceMove / 280) : 0;
      drawAstronaut(cx, cy, cell * 0.95, {
        theme: "echo",
        alpha: es.dead ? 0.5 : 0.85,
        walkPhase,
        facing,
        dead: es.dead,
        moving,
        cell,
      });
    });

    // Player astronot (full opacity) — smooth tween
    if (player) {
      const tw = fx.playerTween;
      const pp = tweenPos(tw, now, player.x, player.y, ox, oy, cell);
      const cx = pp.x + cell / 2;
      const cy = pp.y + cell / 2;
      const sinceMove = now - fx.playerLastMoveAt;
      const moving = sinceMove < 280;
      const walkPhase = moving ? (sinceMove / 280) : 0;
      if (!player.dead && !moving && sinceMove > 5000 && typeof Bark !== "undefined") {
        Bark.maybe("idle", 0.002);
      }
      drawAstronaut(cx, cy, cell * 1.0, {
        theme: "player",
        alpha: 1,
        walkPhase,
        facing: fx.playerFacing,
        dead: !!player.dead,
        moving,
        cell,
      });
      if (typeof Bark !== "undefined" && Bark.isActive()) {
        // Bubble sits just above the sprite's head (feet anchored at cell bottom).
        Bark.draw(ctx, cx, cy - cell * 0.55);
      }
    }

    // Particles (procedural)
    updateAndDrawParticles(dt, ox, oy, cell);

    // PNG effects (top layer)
    if (typeof Effects !== "undefined") Effects.draw(ctx, ox, oy, cell);
  }

  function drawDiamond(cx, cy, r) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
    ctx.fill();
  }

  // ---------- Humanoid sprite (experimental) ----------
  // Procedural insan figürü: kafa, gövde, kol, bacak — yürüyüş animasyonu.
  // size: tam boy piksel · facing: 1 sağ, -1 sol · walkPhase: 0..1+ (sin için)
  function drawHumanoid(cx, cy, size, opts) {
    // drawAstronaut için ince bir kabuk — eski API uyumluluğu.
    const theme = (opts && opts.color === "#8a7dff") || (opts && opts.color === "#3a3550")
                  ? "echo" : "player";
    drawAstronaut(cx, cy, size, { ...opts, theme });
  }

  // Sprite engine'e delegasyon. API korunur (theme, alpha, walkPhase, facing,
  // dead, moving, hurt, deadProgress, hurtProgress, cell).
  function drawAstronaut(cx, cy, size, opts) {
    if (typeof Sprite === "undefined") return;
    Sprite.init();
    Sprite.draw(ctx, cx, cy, size, opts.theme || "player", {
      alpha: opts.alpha != null ? opts.alpha : 1,
      facing: opts.facing != null ? opts.facing : 1,
      walkPhase: opts.walkPhase || 0,
      moving: !!opts.moving,
      dead: !!opts.dead,
      hurt: !!opts.hurt,
      deadProgress: opts.deadProgress != null ? opts.deadProgress : 1,
      hurtProgress: opts.hurtProgress != null ? opts.hurtProgress : 0,
      cell: opts.cell != null ? opts.cell : size,
    });
  }

  // ---------- Starfield (parallax background) ----------
  const _stars = [];
  let _starsInit = false;
  function initStars(W, H) {
    _stars.length = 0;
    for (let i = 0; i < 120; i++) {
      _stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 0.3 + Math.random() * 1.2,
        speed: 0.02 + Math.random() * 0.08,
        twinkle: Math.random() * Math.PI * 2,
        layer: Math.random() < 0.3 ? 2 : Math.random() < 0.6 ? 1 : 0,
      });
    }
    _starsInit = true;
  }
  function drawStarfield(W, H, now, biome) {
    if (!_starsInit || _stars.length === 0) initStars(W, H);
    const pal = biome || BIOMES.lab;
    for (const s of _stars) {
      // Parallax drift
      s.x -= s.speed * (s.layer + 1) * 0.3;
      if (s.x < -2) s.x = W + 2;
      // Twinkle
      const alpha = 0.3 + 0.5 * Math.sin(now * 0.001 * (s.speed * 10) + s.twinkle);
      ctx.globalAlpha = alpha * (0.4 + s.layer * 0.2);
      ctx.fillStyle = pal.stars[s.layer];
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Nebula — biome'a göre tint
    const ng = ctx.createRadialGradient(W * 0.3, H * 0.4, 0, W * 0.3, H * 0.4, W * 0.5);
    ng.addColorStop(0, pal.nebula1);
    ng.addColorStop(0.5, pal.nebula2);
    ng.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = 0.7 + 0.3 * Math.sin(now * 0.0003);
    ctx.fillStyle = ng;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  // Yardımcı: yuvarlatılmış dikdörtgen (fill + path)
  function roundRect(x, y, w, h, r) {
    if (w < 2 || h < 2) { ctx.fillRect(x, y, w, h); return; }
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
    ctx.fill();
  }
  function roundRectPath(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
  }

  // ---------- Particles render ----------
  function updateAndDrawParticles(dt, ox, oy, cell) {
    // _recordBurstAt vb. olayları gerçek partiküllere çevir
    if (fx._recordBurstAt) {
      const { x, y } = fx._recordBurstAt;
      spawnParticles(ox + x * cell + cell / 2, oy + y * cell + cell / 2, 28,
        { color: "#8a7dff", speed: 3, life: 800, size: 2.5, spread: 1.2 });
      spawnParticles(ox + x * cell + cell / 2, oy + y * cell + cell / 2, 14,
        { color: "#5ad7ff", speed: 2, life: 1000, size: 2, spread: 0.7 });
      fx._recordBurstAt = null;
    }
    if (fx._deathBurstAt) {
      const { x, y } = fx._deathBurstAt;
      spawnParticles(ox + x * cell + cell / 2, oy + y * cell + cell / 2, 36,
        { color: "#ff7da8", speed: 5, life: 900, size: 3, spread: 1.6 });
      spawnParticles(ox + x * cell + cell / 2, oy + y * cell + cell / 2, 20,
        { color: "#ffd97d", speed: 3, life: 700, size: 2, spread: 1 });
      fx._deathBurstAt = null;
    }
    if (fx._echoDeathBursts) {
      fx._echoDeathBursts.forEach(b => {
        spawnParticles(ox + b.x * cell + cell / 2, oy + b.y * cell + cell / 2, 22,
          { color: "#ff7da8", speed: 3, life: 700, size: 2.2, spread: 1.2 });
      });
      fx._echoDeathBursts = null;
    }
    if (fx._latchBurstAt) {
      const { x, y } = fx._latchBurstAt;
      spawnParticles(ox + x * cell + cell / 2, oy + y * cell + cell / 2, 22,
        { color: "#ff9d5a", speed: 4, life: 600, size: 2.4, spread: 1.4 });
      spawnParticles(ox + x * cell + cell / 2, oy + y * cell + cell / 2, 10,
        { color: "#ffd97d", speed: 2, life: 800, size: 1.8, spread: 0.8 });
      fx._latchBurstAt = null;
    }
    if (fx._teleportBursts && fx._teleportBursts.length > 0) {
      fx._teleportBursts.forEach(b => {
        const px = ox + b.x * cell + cell / 2;
        const py = oy + b.y * cell + cell / 2;
        if (b.kind === "out") {
          // Çıkış: dışa doğru implosion — yüksek hız, çok parçacık
          spawnParticles(px, py, 30,
            { color: "#7dffb6", speed: 5, life: 700, size: 2.4, spread: 1.6 });
          spawnParticles(px, py, 18,
            { color: "#5ad7ff", speed: 3, life: 550, size: 2, spread: 1.2 });
        } else {
          // Giriş: spiral burst — daha yumuşak, mor + cyan halo
          spawnParticles(px, py, 36,
            { color: "#8a7dff", speed: 4.5, life: 900, size: 2.6, spread: 1.4 });
          spawnParticles(px, py, 16,
            { color: "#7dffb6", speed: 2.5, life: 800, size: 2, spread: 0.9 });
          spawnParticles(px, py, 10,
            { color: "#fff", speed: 1.5, life: 500, size: 1.6, spread: 0.6 });
        }
      });
      fx._teleportBursts = null;
    }
    if (fx._winBurstAt) {
      const { x, y, gold } = fx._winBurstAt;
      spawnParticles(ox + x * cell + cell / 2, oy + y * cell + cell / 2,
        gold ? 50 : 28,
        { color: gold ? "#ffe57d" : "#7dffb6", speed: gold ? 4.5 : 3, life: 1100, size: 2.5, spread: 1.4 });
      if (gold) {
        spawnParticles(ox + x * cell + cell / 2, oy + y * cell + cell / 2, 22,
          { color: "#fffbe0", speed: 2.5, life: 900, size: 1.8, spread: 0.9 });
      }
      fx._winBurstAt = null;
    }

    // Güncelle + çiz
    for (let i = fx.particles.length - 1; i >= 0; i--) {
      const p = fx.particles[i];
      p.x += p.vx * dt * 0.06;
      p.y += p.vy * dt * 0.06;
      p.vy += 0.04 * dt * 0.06;       // hafif yer çekimi
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.life -= dt;
      if (p.life <= 0) { fx.particles.splice(i, 1); continue; }
      const a = p.life / p.maxLife;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }
  function drawDiamondStroke(cx, cy, r) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
    ctx.stroke();
  }
  function drawStar(cx, cy, points, outer, inner) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = (Math.PI / points) * i - Math.PI / 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  // ---------- Input ----------
  const KEYS = {
    ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
    W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0],
    // Çapraz hareket (8 yön)
    q: [-1, -1], Q: [-1, -1],   // sol-üst
    e: [1, -1],  E: [1, -1],    // sağ-üst
    x: [-1, 1],  X: [-1, 1],    // sol-alt (Z zaten echo undo)
    c: [1, 1],   C: [1, 1],     // sağ-alt
  };

  function isGameScreenActive() {
    return document.getElementById("screenGame").classList.contains("active");
  }

  window.addEventListener("keydown", (e) => {
    if (!isGameScreenActive()) return;
    if (e.key === "r" || e.key === "R") { e.preventDefault(); recordEcho(); return; }
    if (e.key === "z" || e.key === "Z") { e.preventDefault(); undoEcho(); return; }
    if (e.key === "n" || e.key === "N") { e.preventDefault(); fullReset(); return; }
    if (e.key === "m" || e.key === "M") { e.preventDefault(); toggleMute(); return; }
    if (e.key === "Escape") { e.preventDefault(); Screens.show("title"); return; }
    if (e.key === "Enter" && !overlay.classList.contains("hidden")) {
      e.preventDefault(); overlayBtn.click(); return;
    }
    const dir = KEYS[e.key];
    if (dir) { e.preventDefault(); tick(dir[0], dir[1]); }
  });

  // ---------- Touch input (mobil) ----------
  const TOUCH_DIRS = {
    up:    [0, -1],
    down:  [0, 1],
    left:  [-1, 0],
    right: [1, 0],
    upleft:    [-1, -1],
    upright:   [1, -1],
    downleft:  [-1, 1],
    downright: [1, 1],
  };
  function bindTouchControls() {
    document.querySelectorAll("[data-touch]").forEach(btn => {
      const act = btn.dataset.touch;
      const fire = (e) => {
        e.preventDefault();
        if (TOUCH_DIRS[act]) tick(TOUCH_DIRS[act][0], TOUCH_DIRS[act][1]);
        else if (act === "r") recordEcho();
        else if (act === "z") undoEcho();
        else if (act === "n") fullReset();
      };
      // pointerdown her iki platform için yeterli
      btn.addEventListener("pointerdown", fire);
    });

    // Canvas üzerinde swipe ile hareket
    let sx = 0, sy = 0, swiping = false;
    const SWIPE = 24;
    canvas.addEventListener("touchstart", (e) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      sx = t.clientX; sy = t.clientY; swiping = true;
    }, { passive: true });
    canvas.addEventListener("touchend", (e) => {
      if (!swiping) return;
      swiping = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (Math.abs(dx) < SWIPE && Math.abs(dy) < SWIPE) return;
      // Çapraz swipe: her iki eksen de eşik üstündeyse çapraz
      const adx = Math.abs(dx), ady = Math.abs(dy);
      const ratio = Math.min(adx, ady) / Math.max(adx, ady);
      if (ratio > 0.4) {
        tick(dx > 0 ? 1 : -1, dy > 0 ? 1 : -1);
      } else if (adx > ady) {
        tick(dx > 0 ? 1 : -1, 0);
      } else {
        tick(0, dy > 0 ? 1 : -1);
      }
    });
    // Fareyle de swipe'a izin ver (tablet/dokunmatik laptop)
    canvas.addEventListener("touchmove", (e) => {
      if (swiping) e.preventDefault();
    }, { passive: false });
  }

  function toggleMute() {
    const m = !Audio.isMuted();
    Audio.setMuted(m);
    if (typeof Music !== "undefined") Music.setMuted(m);
    updateMuteLabel();
    toast(I18n.t(m ? "flash.muted" : "flash.unmuted"), "info");
  }
  function updateMuteLabel() {
    const btn = document.getElementById("btnMute");
    if (btn) btn.textContent = I18n.t(Audio.isMuted() ? "menu.sound.off" : "menu.sound.on");
  }
  function toggleLang() {
    I18n.toggle();
    updateMuteLabel();
    // Aktif overlay'ı tazele
    if (level && document.getElementById("screenGame").classList.contains("active") && busy) {
      // tek satır intro overlay'ı yeniden çizmek için
      hideOverlay();
      showIntro();
    }
    // Seviye numarası etiketi
    if (level) {
      levelNumEl.textContent = isCustom ? I18n.t("ed.customLabel") : String(levelIdx + 1);
    }
    // Listeleri yeniden kur
    if (document.getElementById("screenSelect").classList.contains("active")) buildLevelList();
    if (document.getElementById("screenVersion").classList.contains("active")) buildVersionList();
    toast(I18n.t("flash.lang"), "info");
  }

  // ---------- Animation loop ----------
  function loop() {
    const now = performance.now();
    if (isGameScreenActive()) {
      render();
      // WebGL aktifse offscreen sahneyi shader hattından geçir
      if (useWebGL && typeof WebGLFX !== "undefined" && WebGLFX.isReady() && offCanvas) {
        WebGLFX.composite(offCanvas, now);
      }
      // Speed-run timer güncelle
      if (!won && !busy && player && !player.dead) {
        const elapsed = now - speedRunStart;
        const el = document.getElementById("timerDisplay");
        if (el) el.textContent = formatTime(elapsed);
      }
    }
    // Title screen aktifse arka plan animasyonunu çiz
    if (document.getElementById("screenTitle").classList.contains("active") && typeof TitleFX !== "undefined") {
      TitleFX.render(now);
    }
    if (document.getElementById("screenEditor").classList.contains("active")) Editor.render();
    requestAnimationFrame(loop);
  }

  // ---------- Story ----------
  function showStory(entry, after) {
    if (!entry) { after && after(); return; }
    document.getElementById("storyTitle").textContent = entry.title;
    document.getElementById("storyBody").textContent = entry.lines.join("\n");
    Screens.show("story");
    document.getElementById("storyContinue").onclick = () => {
      Audio.click();
      after && after();
    };
  }

  function playTutorialThen(done) {
    const pages = STORY.tutorial || [];
    let i = 0;
    const next = () => {
      if (i >= pages.length) { done && done(); return; }
      showStory(pages[i++], next);
    };
    next();
  }

  // ---------- Boot / Menu ----------
  function buildVersionList() {
    const list = document.getElementById("versionList");
    list.innerHTML = "";
    VERSION.history.forEach((entry, i) => {
      const block = document.createElement("div");
      block.className = "version-block" + (i === 0 ? " current" : "");
      const lang = I18n.get();
      const changes = (entry.changes && entry.changes[lang]) || entry.changes.tr || entry.changes;
      const items = (Array.isArray(changes) ? changes : []).map(c => `<li>${escapeHtml(c)}</li>`).join("");
      block.innerHTML = `
        <div class="vh">
          <span class="vnum">v${entry.v}${i === 0 ? I18n.t("ver.current") : ""}</span>
          <span class="vmeta">${entry.date}</span>
        </div>
        <div class="vcode">"${escapeHtml(entry.codename)}"</div>
        <ul>${items}</ul>
      `;
      list.appendChild(block);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  // ---------- Level Select ----------
  // 23 seviye tek sayfaya sığar — sayfalama bırakıldı ama API uyumlu.
  const LEVELS_PER_PAGE = 24;
  let selectPage = 0;
  const totalPages = () => Math.max(1, Math.ceil(LEVELS.length / LEVELS_PER_PAGE));

  // Mini-map: seviye grid'ini küçük canvas'a çizer
  function renderMiniMap(cvs, gridDef) {
    const grid = gridDef.grid;
    if (!grid || !grid.length) return;
    const h = grid.length;
    const w = Math.max(...grid.map(r => r.length));
    const cw = cvs.width, ch = cvs.height;
    const cs = Math.min(Math.floor(cw / w), Math.floor(ch / h));
    const ox = Math.floor((cw - cs * w) / 2);
    const oy = Math.floor((ch - cs * h) / 2);
    const mc = cvs.getContext("2d");
    mc.fillStyle = "#07080d";
    mc.fillRect(0, 0, cw, ch);
    const fragSet = new Set(gridDef.fragile || []);
    const MAP = {
      "#": "#2a2f55", ".": "#0d1020", "P": "#5ad7ff", "G": "#ffd97d",
      "Q": "#7a5dff", "B": "#c9a85a", "X": "#ff5a5a",
    };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < (grid[y] || "").length; x++) {
        const c = grid[y][x];
        let col = MAP[c];
        if (!col) {
          if (c >= "a" && c <= "z") col = fragSet.has(c) ? "#ff9d5a" : "#4a3d8a";
          else if (c >= "A" && c <= "Z") col = fragSet.has(c.toLowerCase()) ? "#7a3a1f" : "#3a2855";
          else if (c >= "1" && c <= "9") col = "#7dffb6";
          else if ("^v<>".includes(c)) col = "#ff7da8";
          else col = "#0d1020";
        }
        mc.fillStyle = col;
        mc.fillRect(ox + x * cs, oy + y * cs, cs, cs);
      }
    }
  }

  function buildLevelList() {
    const list = document.getElementById("levelList");
    list.innerHTML = "";
    const unlocked = Save.maxUnlocked();

    const handCount = (typeof HAND_LEVELS !== "undefined") ? HAND_LEVELS.length : 6;
    const start = selectPage * LEVELS_PER_PAGE;
    const end = Math.min(LEVELS.length, start + LEVELS_PER_PAGE);

    for (let i = start; i < end; i++) {
      const lv = LEVELS[i];
      if (!lv) continue;
      const card = document.createElement("button");
      card.className = "level-card";
      if (Save.isCleared(i)) card.classList.add("cleared");
      if (i > unlocked) card.classList.add("locked");
      if (i >= handCount) card.classList.add("generated");
      const numLine = I18n.t("select.levelLine",
        String(i + 1).padStart(4, "0"), lv.moves);
      const tag = i < handCount ? I18n.t("select.handMade") : I18n.t("select.generated");
      const stars = Save.getStars(i);
      const starStr = stars > 0 ? "★".repeat(stars) + "☆".repeat(3 - stars) : "☆☆☆";
      // Mini-map canvas
      const cvs = document.createElement("canvas");
      cvs.className = "level-preview";
      cvs.width = 200; cvs.height = 56;
      renderMiniMap(cvs, lv);
      // Card content
      const info = document.createElement("div");
      info.className = "level-info";
      info.innerHTML =
        `<span class="num">${escapeHtml(numLine)}</span>` +
        `<span class="lname">${escapeHtml(levelText(lv, "name"))}</span>` +
        `<div class="level-stars">${starStr}</div>` +
        `<span class="tag">${escapeHtml(tag)}</span>`;
      card.appendChild(cvs);
      card.appendChild(info);
      card.onclick = () => {
        if (i > unlocked) { Audio.bump(); return; }
        Audio.click();
        loadLevel(i);
      };
      list.appendChild(card);
    }

    // Sayfa bilgisi — tek sayfa varsa sadece seviye sayısı
    const info = document.getElementById("selPageInfo");
    if (info) {
      info.textContent = totalPages() > 1
        ? I18n.t("select.pageInfo", selectPage + 1, totalPages(), LEVELS.length)
        : `${LEVELS.length} SEVİYE`;
    }

    // Pager: tek sayfa varsa gizle
    const pager = document.querySelector(".pager");
    if (pager) pager.style.display = totalPages() > 1 ? "" : "none";

    // Pager input
    const jumpEl = document.getElementById("selPageJump");
    if (jumpEl) {
      jumpEl.value = selectPage + 1;
      jumpEl.max = totalPages();
    }

    // Buton durumları
    const btnFirst = document.getElementById("selFirst");
    const btnPrev  = document.getElementById("selPrev");
    const btnNext  = document.getElementById("selNext");
    const btnLast  = document.getElementById("selLast");
    if (btnFirst) btnFirst.disabled = selectPage === 0;
    if (btnPrev)  btnPrev.disabled  = selectPage === 0;
    if (btnNext)  btnNext.disabled  = selectPage >= totalPages() - 1;
    if (btnLast)  btnLast.disabled  = selectPage >= totalPages() - 1;
  }

  function bindLevelSelectPager() {
    const setPage = (p) => {
      selectPage = Math.max(0, Math.min(totalPages() - 1, p));
      Audio.click();
      buildLevelList();
    };
    document.getElementById("selFirst").onclick = () => setPage(0);
    document.getElementById("selPrev").onclick  = () => setPage(selectPage - 1);
    document.getElementById("selNext").onclick  = () => setPage(selectPage + 1);
    document.getElementById("selLast").onclick  = () => setPage(totalPages() - 1);
    document.getElementById("selPageJump").onchange = (e) => {
      const p = parseInt(e.target.value, 10) - 1;
      if (!isNaN(p)) setPage(p);
    };
    document.getElementById("selJumpUnlocked").onclick = () => {
      // Kaldığın yerden devam: bir sonraki kilitsiz seviyeyi doğrudan başlat
      const target = Save.maxUnlocked();
      Audio.click();
      loadLevel(target);
    };
  }

  function bindMenu() {
    document.querySelectorAll('[data-act]').forEach(btn => {
      const act = btn.dataset.act;
      btn.addEventListener("click", () => {
        Audio.click();
        if (act === "start") {
          showStory(STORY.intro, () => playTutorialThen(() => loadLevel(0)));
        } else if (act === "tutorial") {
          playTutorialThen(() => loadLevel(0));
        } else if (act === "select") {
          buildLevelList();
          Screens.show("select");
        } else if (act === "editor") {
          Editor.open();
          Screens.show("editor");
        } else if (act === "version") {
          buildVersionList();
          Screens.show("version");
        } else if (act === "mute") {
          toggleMute();
        } else if (act === "lang") {
          toggleLang();
        } else if (act === "title") {
          Screens.show("title");
        } else if (act === "menu") {
          Screens.show("title");
        }
      });
    });
  }

  // ---------- URL hash share import ----------
  function tryHashImport() {
    const m = location.hash.match(/l=([A-Za-z0-9+/=_-]+)/);
    if (!m) return false;
    const lvl = Editor.decodeLevel(m[1]);
    if (lvl) {
      Screens.show("game");
      playCustom(lvl);
      return true;
    }
    return false;
  }

  // ---------- Init ----------
  function applyVersionLabels() {
    const v = `v${VERSION.number}`;
    const titleEl = document.getElementById("titleVersion");
    if (titleEl) titleEl.textContent = `${v} · ${VERSION.codename} · ${VERSION.build} build`;
    const hudEl = document.getElementById("hudVersion");
    if (hudEl) hudEl.textContent = v;
  }

  function init() {
    I18n.apply();
    applyVersionLabels();
    updateMuteLabel();
    bindMenu();
    bindLevelSelectPager();
    bindTouchControls();
    loop();
    if (!tryHashImport()) {
      Screens.show("title");
    }
    // Tarayıcı müziği ilk kullanıcı etkileşiminden önce başlatmaz —
    // ilk tıklamada/tuşta mevcut track'i yeniden tetikle.
    const kickstart = () => {
      if (typeof Music !== "undefined") {
        const onTitle = document.getElementById("screenTitle").classList.contains("active");
        Music.play(onTitle ? "menu" : "game");
      }
      window.removeEventListener("pointerdown", kickstart);
      window.removeEventListener("keydown", kickstart);
    };
    window.addEventListener("pointerdown", kickstart);
    window.addEventListener("keydown", kickstart);
  }

  return { loadLevel, playCustom, render, init };
})();

window.addEventListener("DOMContentLoaded", () => Game.init());
