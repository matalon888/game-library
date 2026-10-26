import {
  BOARD,
  ORB_TYPES,
  SHOT_SPEED,
  cellsWithinRadius,
  cellKey,
  cellPosition,
  difficultyAt,
  findCluster,
  findDetached,
  gameOverCopy,
  makeInitialField,
  neighbors,
  powerChargeFor,
  scoreFor,
  seededRandom,
  shouldAdvanceDescent,
} from "./core.js";
import { createAmbientMusic } from "./music.js";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d", { alpha: false });
const ui = {
  score: document.querySelector("#score"),
  best: document.querySelector("#best"),
  phase: document.querySelector("#phase"),
  danger: document.querySelector("#danger-fill"),
  combo: document.querySelector("#combo"),
  startScreen: document.querySelector("#start-screen"),
  pauseScreen: document.querySelector("#pause-screen"),
  gameOver: document.querySelector("#game-over"),
  finalScore: document.querySelector("#final-score"),
  resultKicker: document.querySelector("#result-kicker"),
  resultNote: document.querySelector("#result-note"),
  start: document.querySelector("#start"),
  restart: document.querySelector("#restart"),
  pause: document.querySelector("#pause"),
  resume: document.querySelector("#resume"),
  mute: document.querySelector("#mute"),
  motion: document.querySelector("#motion"),
  bloomPower: document.querySelector("#bloom-power"),
  frostPower: document.querySelector("#frost-power"),
  nextSwap: document.querySelector("#next-swap"),
};

const POWER = Object.freeze({ bloom: 12, frost: 20 });
const SHOT = Object.freeze({ speed: SHOT_SPEED, step: 4, wall: BOARD.radius + 15, collision: BOARD.radius * 1.92 });

const colors = {
  flame: "#ff6a45",
  tide: "#39dce5",
  starlight: "#ffd34f",
  dream: "#b96cff",
  leaf: "#76de50",
  frost: "#65b9ff",
};

const assetPaths = {
  background: "../assets/runtime/moonbloom-garden-bg.webp",
  launcher: "../assets/runtime/lyra-launcher.webp",
  recoil: "../assets/runtime/lyra-recoil.webp",
  ...Object.fromEntries(ORB_TYPES.map((type) => [type, `../assets/runtime/orbs/orb-${type}.webp`])),
};

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = new URL(source, import.meta.url);
  });
}

const images = Object.fromEntries(await Promise.all(
  Object.entries(assetPaths).map(async ([key, source]) => [key, await loadImage(source)]),
));

function readStorage(key, fallback = null) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

function writeStorage(key, value) {
  try { localStorage.setItem(key, String(value)); } catch { /* Private browsing fallback: keep run-local state. */ }
}

let audioContext = null;
let ambientMusic = null;
let muted = readStorage("moonbloom-muted") === "true";
let reducedMotion = readStorage("moonbloom-motion") === "reduced";

function initAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    ambientMusic = createAmbientMusic(audioContext, audioContext.destination);
  }
  if (audioContext.state === "suspended") audioContext.resume();
  syncMusic();
}

function syncMusic() {
  const shouldPlay = Boolean(ambientMusic) && !muted && !document.hidden && state.mode === "playing";
  ambientMusic?.setActive(shouldPlay);
  canvas.dataset.music = muted ? "muted" : shouldPlay ? "playing" : "paused";
}

function updateAudioControl() {
  ui.mute.setAttribute("aria-pressed", String(muted));
  ui.mute.setAttribute("aria-label", muted ? "Bật âm thanh và nhạc nền" : "Tắt âm thanh và nhạc nền");
  ui.mute.textContent = muted ? "×" : "♫";
}

function tone(frequency, duration = 0.1, type = "sine", volume = 0.045, delay = 0) {
  if (muted || !audioContext) return;
  const now = audioContext.currentTime + delay;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency * 1.08), now + duration);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

function sound(name) {
  if (name === "shoot") tone(270, 0.11, "triangle", 0.04);
  if (name === "impact") tone(130, 0.07, "sine", 0.03);
  if (name === "match") [660, 825, 990].forEach((note, index) => tone(note, 0.18, "sine", 0.035, index * 0.045));
  if (name === "drop") tone(220, 0.24, "triangle", 0.045);
  if (name === "warning") tone(95, 0.28, "sawtooth", 0.025);
  if (name === "over") [320, 250, 180].forEach((note, index) => tone(note, 0.3, "triangle", 0.035, index * 0.12));
  if (name === "ready") [520, 780].forEach((note, index) => tone(note, 0.22, "sine", 0.035, index * 0.08));
  if (name === "bloom") [180, 440, 880].forEach((note, index) => tone(note, 0.28, "triangle", 0.045, index * 0.04));
  if (name === "freeze") [920, 690, 460].forEach((note, index) => tone(note, 0.32, "sine", 0.035, index * 0.06));
  if (name === "swap") [420, 610].forEach((note, index) => tone(note, 0.15, "triangle", 0.034, index * 0.055));
}

const state = {
  mode: "menu",
  bubbles: [],
  projectile: null,
  particles: [],
  falling: [],
  trails: [],
  topRow: 0,
  fieldOffset: 0,
  currentType: "leaf",
  nextType: "tide",
  aimAngle: -Math.PI / 2,
  aiming: false,
  resolving: false,
  score: 0,
  best: Number(readStorage("moonbloom-best", "0")),
  combo: 0,
  lastMatchAt: -10,
  bestCombo: Number(readStorage("moonbloom-best-combo", "0")),
  elapsed: 0,
  lastTime: performance.now(),
  random: seededRandom(Date.now()),
  shake: 0,
  flash: 0,
  warningCooldown: 0,
  bloomCharge: 0,
  frostCharge: 0,
  armedPower: null,
  freezeTime: 0,
  swapPulse: 0,
  recoil: 0,
  shotFlash: 0,
  qaLossPending: new URLSearchParams(location.search).get("qa") === "loss",
  qaPowerPending: new URLSearchParams(location.search).get("qa") === "power",
  qaScorePending: new URLSearchParams(location.search).get("qa") === "score",
};

ui.best.textContent = state.best.toLocaleString("vi-VN");
updateAudioControl();
ui.motion.setAttribute("aria-pressed", String(reducedMotion));

function show(element, visible) {
  element.classList.toggle("overlay--visible", visible);
  element.setAttribute("aria-hidden", String(!visible));
}

function randomType() {
  const active = difficultyAt(state.elapsed).activeColors;
  return ORB_TYPES[Math.floor(state.random() * active)];
}

function randomTypeExcept(excludedType) {
  let type = randomType();
  for (let attempt = 0; attempt < 6 && type === excludedType; attempt += 1) type = randomType();
  if (type === excludedType) {
    const active = difficultyAt(state.elapsed).activeColors;
    const index = ORB_TYPES.indexOf(excludedType);
    type = ORB_TYPES[(index + 1) % active];
  }
  return type;
}

function bubblePosition(bubble) {
  return cellPosition(bubble.row, bubble.col, state.fieldOffset, state.topRow);
}

function resetGame() {
  const seed = Math.floor(Date.now() % 2147483647);
  state.random = seededRandom(seed);
  state.bubbles = makeInitialField(state.random, 6, 4).map((bubble) => ({ ...bubble, scale: 0 }));
  // A readable opening: the first straight shot completes this pair and
  // demonstrates the core reward before endless pressure ramps up.
  for (const bubble of state.bubbles) {
    if (bubble.row === 5 && (bubble.col === 3 || bubble.col === 4)) bubble.type = "tide";
  }
  if (state.qaLossPending) {
    state.bubbles.push({ row: 15, col: 4, type: "flame", scale: 1 });
    state.qaLossPending = false;
  }
  state.elapsed = 0;
  state.projectile = null;
  state.particles = [];
  state.falling = [];
  state.trails = [];
  state.topRow = 0;
  state.fieldOffset = 0;
  state.currentType = "tide";
  state.nextType = randomTypeExcept(state.currentType);
  state.aimAngle = -Math.PI / 2;
  state.resolving = false;
  state.score = state.qaScorePending ? 10000 : 0;
  state.qaScorePending = false;
  state.combo = 0;
  state.lastMatchAt = -10;
  state.bloomCharge = state.qaPowerPending ? POWER.bloom : 0;
  state.frostCharge = state.qaPowerPending ? POWER.frost : 0;
  state.qaPowerPending = false;
  state.armedPower = null;
  state.freezeTime = 0;
  state.swapPulse = 0;
  state.recoil = 0;
  state.shotFlash = 0;
  state.shake = 0;
  state.flash = 0;
  state.warningCooldown = 0;
  state.mode = "playing";
  delete canvas.dataset.aimCell;
  delete canvas.dataset.attachedCell;
  show(ui.startScreen, false);
  show(ui.pauseScreen, false);
  show(ui.gameOver, false);
  updateHud();
  syncMusic();
}

function setPaused(paused) {
  if (state.mode !== "playing" && state.mode !== "paused") return;
  state.mode = paused ? "paused" : "playing";
  show(ui.pauseScreen, paused);
  ui.pause.textContent = paused ? "▶" : "Ⅱ";
  syncMusic();
}

function updateHud() {
  const difficulty = difficultyAt(state.elapsed, state.score);
  canvas.dataset.descentSpeed = difficulty.descentSpeed.toFixed(2);
  ui.score.textContent = state.score.toLocaleString("vi-VN");
  ui.best.textContent = Math.max(state.score, state.best).toLocaleString("vi-VN");
  ui.phase.textContent = state.freezeTime > 0 ? `SƯƠNG ${Math.ceil(state.freezeTime)}s` : `ĐÊM ${difficulty.phase}`;
  let lowest = BOARD.top;
  for (const bubble of state.bubbles) lowest = Math.max(lowest, bubblePosition(bubble).y + BOARD.radius);
  const danger = Math.max(0, Math.min(1, (lowest - 430) / (BOARD.dangerY - 430)));
  ui.danger.style.width = `${danger * 100}%`;
  if (danger > 0.8 && state.warningCooldown <= 0) {
    sound("warning");
    state.warningCooldown = 2.5;
  }
  updatePowerHud();
  updateNextSwapHud();
}

const orbNames = Object.freeze({
  flame: "Lửa",
  tide: "Thủy triều",
  starlight: "Ánh sao",
  dream: "Giấc mơ",
  leaf: "Mầm lá",
  frost: "Băng sương",
});

function updateNextSwapHud() {
  const available = state.mode === "playing" && !state.projectile && !state.resolving;
  ui.nextSwap.disabled = !available;
  ui.nextSwap.setAttribute("aria-label", `Đổi bóng ${orbNames[state.currentType]} với bóng tiếp theo ${orbNames[state.nextType]}`);
}

function swapNextBall() {
  if (state.mode !== "playing" || state.projectile || state.resolving) return;
  initAudio();
  [state.currentType, state.nextType] = [state.nextType, state.currentType];
  state.swapPulse = reducedMotion ? 0.18 : 0.7;
  state.flash = reducedMotion ? 0 : Math.max(state.flash, 0.12);
  sound("swap");
  updateNextSwapHud();
}

function updatePowerButton(button, name, charge, maximum, armed = false) {
  const ready = charge >= maximum;
  const percent = Math.min(1, charge / maximum);
  button.style.setProperty("--charge", `${percent * 360}deg`);
  button.disabled = !ready || armed;
  button.setAttribute("aria-pressed", String(armed || ready));
  button.setAttribute("aria-label", `${name}, ${armed ? "đã kích hoạt cho phát kế tiếp" : ready ? "đã sẵn sàng" : `đang nạp ${Math.floor(charge)} trên ${maximum}`}`);
  button.querySelector("strong").textContent = armed ? "PHÁT KẾ" : ready ? "SẴN SÀNG" : `${Math.floor(charge)}/${maximum}`;
}

function updatePowerHud() {
  updatePowerButton(ui.bloomPower, "Trăng Nở", state.bloomCharge, POWER.bloom, state.armedPower === "bloom");
  updatePowerButton(ui.frostPower, "Sương Ngưng", state.frostCharge, POWER.frost, state.freezeTime > 0);
}

function callout(text, duration = 850) {
  ui.combo.textContent = text;
  ui.combo.classList.add("combo--show");
  clearTimeout(callout.timer);
  callout.timer = setTimeout(() => ui.combo.classList.remove("combo--show"), duration);
}

function addPowerCharge(matchCount, detachedCount) {
  const gain = powerChargeFor(matchCount, detachedCount);
  const bloomWasReady = state.bloomCharge >= POWER.bloom;
  const frostWasReady = state.frostCharge >= POWER.frost;
  state.bloomCharge = Math.min(POWER.bloom, state.bloomCharge + gain);
  state.frostCharge = Math.min(POWER.frost, state.frostCharge + gain);
  if ((!bloomWasReady && state.bloomCharge >= POWER.bloom) || (!frostWasReady && state.frostCharge >= POWER.frost)) sound("ready");
}

function activateBloom() {
  if (state.mode !== "playing" || state.bloomCharge < POWER.bloom || state.armedPower) return;
  state.bloomCharge = 0;
  state.armedPower = "bloom";
  callout("TRĂNG NỞ · PHÁT KẾ");
  sound("ready");
  updatePowerHud();
}

function activateFrost() {
  if (state.mode !== "playing" || state.frostCharge < POWER.frost || state.freezeTime > 0) return;
  state.frostCharge = 0;
  state.freezeTime = 8;
  state.fieldOffset = Math.max(-24, state.fieldOffset - 24);
  state.flash = reducedMotion ? 0 : 0.8;
  callout("SƯƠNG NGƯNG · 8 GIÂY");
  sound("freeze");
  updatePowerHud();
}

function spawnRow() {
  state.topRow -= 1;
  const count = BOARD.cols - (Math.abs(state.topRow) % 2);
  const active = difficultyAt(state.elapsed).activeColors;
  for (let col = 0; col < count; col += 1) {
    state.bubbles.push({
      row: state.topRow,
      col,
      type: ORB_TYPES[Math.floor(state.random() * active)],
      scale: reducedMotion ? 1 : 0,
    });
  }
  state.flash = reducedMotion ? 0 : 0.32;
}

function fire() {
  if (state.mode !== "playing" || state.projectile || state.resolving) return;
  initAudio();
  state.projectile = {
    x: BOARD.shooterX,
    y: BOARD.shooterY - 26,
    vx: Math.cos(state.aimAngle) * SHOT.speed,
    vy: Math.sin(state.aimAngle) * SHOT.speed,
    type: state.currentType,
    power: state.armedPower,
    rotation: 0,
  };
  state.recoil = reducedMotion ? 0.35 : 1;
  state.shotFlash = reducedMotion ? 0.22 : 1;
  ui.nextSwap.disabled = true;
  state.armedPower = null;
  state.currentType = state.nextType;
  state.nextType = randomTypeExcept(state.currentType);
  sound("shoot");
  updatePowerHud();
}

function nearestOpenCellAt(point, hit = null) {
  const occupied = new Set(state.bubbles.map((bubble) => cellKey(bubble.row, bubble.col)));
  let candidates;
  if (hit) {
    candidates = neighbors(hit.row, hit.col);
  } else {
    const row = state.topRow;
    const offset = row % 2 ? BOARD.xStep / 2 : 0;
    const col = Math.max(0, Math.min(BOARD.cols - 1, Math.round((point.x - BOARD.left - offset) / BOARD.xStep)));
    candidates = [{ row, col }];
  }
  candidates = candidates.filter((cell) => !occupied.has(cellKey(cell.row, cell.col)));
  candidates.sort((a, b) => {
    const pa = cellPosition(a.row, a.col, state.fieldOffset, state.topRow);
    const pb = cellPosition(b.row, b.col, state.fieldOffset, state.topRow);
    return Math.hypot(pa.x - point.x, pa.y - point.y) - Math.hypot(pb.x - point.x, pb.y - point.y);
  });
  return candidates[0] || null;
}

function nearestOpenCell(hit = null) {
  return nearestOpenCellAt(state.projectile, hit);
}

function advanceShot(shot, distance) {
  const scale = distance / SHOT.speed;
  shot.x += shot.vx * scale;
  shot.y += shot.vy * scale;
  let bounced = false;
  if (shot.x <= SHOT.wall && shot.vx < 0) {
    shot.x = SHOT.wall;
    shot.vx *= -1;
    bounced = true;
  } else if (shot.x >= BOARD.width - SHOT.wall && shot.vx > 0) {
    shot.x = BOARD.width - SHOT.wall;
    shot.vx *= -1;
    bounced = true;
  }
  if (shot.y <= BOARD.top + state.fieldOffset + BOARD.radius) return { ceiling: true, hit: null, bounced };
  const hit = state.bubbles.find((bubble) => {
    const position = bubblePosition(bubble);
    return Math.hypot(shot.x - position.x, shot.y - position.y) <= SHOT.collision;
  });
  return { ceiling: false, hit: hit || null, bounced };
}

function burst(position, type, count = 14) {
  const amount = reducedMotion ? Math.min(5, count) : count;
  for (let index = 0; index < amount; index += 1) {
    const angle = state.random() * Math.PI * 2;
    const speed = 60 + state.random() * 190;
    state.particles.push({
      x: position.x,
      y: position.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 45,
      life: 0.45 + state.random() * 0.45,
      maxLife: 0.9,
      radius: 2 + state.random() * 4,
      color: colors[type],
    });
  }
}

function removeResolvedBubbles(primary, label, recharge = true) {
  const keys = new Set(primary.map((item) => cellKey(item.row, item.col)));
  for (const item of primary) burst(bubblePosition(item), item.type, 12);
  let remaining = state.bubbles.filter((item) => !keys.has(cellKey(item.row, item.col)));
  const detached = findDetached(remaining, state.topRow);
  const detachedKeys = new Set(detached.map((item) => cellKey(item.row, item.col)));
  for (const item of detached) {
    const pos = bubblePosition(item);
    state.falling.push({ ...item, x: pos.x, y: pos.y, vy: 40 + state.random() * 70, rotation: 0, spin: (state.random() - 0.5) * 5 });
  }
  remaining = remaining.filter((item) => !detachedKeys.has(cellKey(item.row, item.col)));
  state.bubbles = remaining;
  state.combo = state.elapsed - state.lastMatchAt < 3.4 ? state.combo + 1 : 1;
  state.bestCombo = Math.max(state.bestCombo, state.combo);
  state.lastMatchAt = state.elapsed;
  state.score += scoreFor(primary.length, detached.length, state.combo);
  if (recharge) addPowerCharge(primary.length, detached.length);
  state.shake = reducedMotion ? 0 : Math.min(11, 4 + detached.length * 0.5);
  state.flash = reducedMotion ? 0 : 0.45;
  callout(label || (state.combo > 1 ? `COMBO ×${state.combo}` : detached.length ? `THẢ RƠI +${detached.length}` : "NỞ RỘ!"));
  sound(detached.length ? "drop" : "match");
}

function attachProjectile(hit = null) {
  const cell = nearestOpenCell(hit);
  if (!cell) {
    finishGame();
    return;
  }
  const projectilePower = state.projectile.power;
  canvas.dataset.attachedCell = cellKey(cell.row, cell.col);
  const bubble = { ...cell, type: state.projectile.type, scale: reducedMotion ? 1 : 0.2 };
  state.bubbles.push(bubble);
  const position = bubblePosition(bubble);
  burst(position, bubble.type, 5);
  state.projectile = null;
  state.resolving = true;
  sound("impact");

  if (projectilePower === "bloom") {
    const bloom = cellsWithinRadius(state.bubbles, bubble, 1);
    removeResolvedBubbles(bloom, `TRĂNG NỞ · ${bloom.length} LINH CẦU`, false);
    sound("bloom");
  } else {
    const cluster = findCluster(state.bubbles, bubble);
    if (cluster.length >= 3) removeResolvedBubbles(cluster);
    else state.combo = 0;
  }
  state.resolving = false;
  updateHud();
}

function finishGame() {
  if (state.mode === "over") return;
  state.mode = "over";
  state.projectile = null;
  const isBest = state.score > state.best;
  if (isBest) {
    state.best = state.score;
    writeStorage("moonbloom-best", state.best);
  }
  writeStorage("moonbloom-best-combo", state.bestCombo);
  writeStorage("moonbloom-runs", Number(readStorage("moonbloom-runs", "0")) + 1);
  ui.finalScore.textContent = state.score.toLocaleString("vi-VN");
  const resultCopy = gameOverCopy(isBest);
  ui.resultKicker.textContent = resultCopy.kicker;
  ui.resultNote.textContent = resultCopy.note;
  show(ui.gameOver, true);
  updateHud();
  syncMusic();
  sound("over");
}

function updateProjectile(dt) {
  const projectile = state.projectile;
  if (!projectile) return;
  projectile.rotation += dt * 4;
  let remaining = SHOT.speed * dt;
  while (remaining > 0 && state.projectile === projectile) {
    const distance = Math.min(SHOT.step, remaining);
    const collision = advanceShot(projectile, distance);
    remaining -= distance;
    if (collision.bounced) sound("impact");
    if (collision.ceiling || collision.hit) {
      attachProjectile(collision.hit);
      break;
    }
  }
  if (state.projectile === projectile && !reducedMotion) state.trails.push({ x: projectile.x, y: projectile.y, type: projectile.type, life: 0.25 });
  if (projectile.y > BOARD.height + 80) state.projectile = null;
}

function updateEffects(dt) {
  for (const bubble of state.bubbles) bubble.scale = Math.min(1, (bubble.scale ?? 1) + dt * 7);
  state.particles = state.particles.filter((particle) => {
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 240 * dt;
    return particle.life > 0;
  });
  state.falling = state.falling.filter((bubble) => {
    bubble.vy += 560 * dt;
    bubble.y += bubble.vy * dt;
    bubble.rotation += bubble.spin * dt;
    return bubble.y < BOARD.height + 90;
  });
  state.trails = state.trails.filter((trail) => (trail.life -= dt) > 0);
  state.shake = Math.max(0, state.shake - dt * 22);
  state.flash = Math.max(0, state.flash - dt * 2.4);
  state.warningCooldown = Math.max(0, state.warningCooldown - dt);
  state.swapPulse = Math.max(0, state.swapPulse - dt * 2.8);
  state.recoil = Math.max(0, state.recoil - dt * 4.8);
  state.shotFlash = Math.max(0, state.shotFlash - dt * 8);
}

function update(dt) {
  updateEffects(dt);
  if (state.mode !== "playing") return;
  state.elapsed += dt;
  state.freezeTime = Math.max(0, state.freezeTime - dt);
  const difficulty = difficultyAt(state.elapsed, state.score);
  if (shouldAdvanceDescent({ resolving: state.resolving, freezeTime: state.freezeTime })) {
    state.fieldOffset += difficulty.descentSpeed * dt;
    if (state.fieldOffset >= BOARD.rowHeight) {
      state.fieldOffset -= BOARD.rowHeight;
      spawnRow();
    }
  }
  updateProjectile(dt);
  let lost = false;
  for (const bubble of state.bubbles) {
    if (bubblePosition(bubble).y + BOARD.radius >= BOARD.dangerY) {
      lost = true;
      break;
    }
  }
  if (lost) finishGame();
  updateHud();
}

function drawOrb(type, x, y, radius = BOARD.radius, rotation = 0, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.drawImage(images[type], -radius, -radius, radius * 2, radius * 2);
  ctx.restore();
}

function drawBackground() {
  ctx.drawImage(images.background, 0, 0, BOARD.width, BOARD.height);
  const gradient = ctx.createLinearGradient(0, 0, 0, BOARD.height);
  gradient.addColorStop(0, "rgba(2, 11, 35, .26)");
  gradient.addColorStop(0.55, "rgba(4, 20, 50, .08)");
  gradient.addColorStop(1, "rgba(2, 8, 24, .2)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, BOARD.width, BOARD.height);
}

function drawAimGuide() {
  if (state.mode !== "playing" || state.projectile) return;
  const preview = {
    x: BOARD.shooterX,
    y: BOARD.shooterY - 26,
    vx: Math.cos(state.aimAngle) * SHOT.speed,
    vy: Math.sin(state.aimAngle) * SHOT.speed,
  };
  const path = [{ x: preview.x, y: preview.y }];
  let collision = { hit: null, ceiling: false };
  for (let index = 0; index < 360; index += 1) {
    collision = advanceShot(preview, SHOT.step);
    path.push({ x: preview.x, y: preview.y });
    if (collision.ceiling || collision.hit) break;
  }

  const landingCell = nearestOpenCellAt(preview, collision.hit);
  const landing = landingCell ? cellPosition(landingCell.row, landingCell.col, state.fieldOffset, state.topRow) : { x: preview.x, y: preview.y };
  if (landingCell) canvas.dataset.aimCell = cellKey(landingCell.row, landingCell.col);
  const previous = path[Math.max(0, path.length - 2)];
  const direction = Math.atan2(landing.y - previous.y, landing.x - previous.x);
  path[path.length - 1] = landing;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  for (const point of path.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(4, 15, 39, .7)";
  ctx.lineWidth = 11;
  ctx.stroke();

  ctx.strokeStyle = "rgba(115, 229, 255, .65)";
  ctx.lineWidth = 5;
  ctx.shadowColor = "#68e9ff";
  ctx.shadowBlur = 14;
  ctx.stroke();

  ctx.setLineDash([3, 15]);
  ctx.lineDashOffset = reducedMotion ? 0 : -state.elapsed * 28;
  ctx.strokeStyle = "rgba(255, 252, 211, .98)";
  ctx.lineWidth = 3;
  ctx.shadowColor = "#fff4a8";
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.translate(landing.x, landing.y);
  ctx.globalAlpha = 0.48 + Math.sin(state.elapsed * 5) * 0.08;
  drawOrb(state.currentType, 0, 0, BOARD.radius * 0.92, state.elapsed * 0.25, 0.72);
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(0, 0, BOARD.radius + 4, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255, 246, 170, .9)";
  ctx.lineWidth = 2;
  ctx.shadowColor = "#7ceaff";
  ctx.shadowBlur = 14;
  ctx.stroke();

  ctx.rotate(direction);
  ctx.translate(-BOARD.radius - 12, 0);
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(-8, -9);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-8, 9);
  ctx.closePath();
  ctx.fillStyle = "#fff3a6";
  ctx.shadowColor = "#79e8ff";
  ctx.shadowBlur = 18;
  ctx.fill();
  ctx.strokeStyle = "rgba(17, 58, 99, .95)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawDangerLine() {
  const pulse = 0.55 + Math.sin(state.elapsed * 5) * 0.12;
  ctx.save();
  ctx.setLineDash([8, 10]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = `rgba(255, 100, 117, ${pulse})`;
  ctx.shadowColor = "#ff6475";
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(25, BOARD.dangerY);
  ctx.lineTo(515, BOARD.dangerY);
  ctx.stroke();
  ctx.restore();
}

function drawLauncher() {
  const breathe = reducedMotion ? 0 : Math.sin(state.elapsed * 2.25);
  const sway = reducedMotion ? 0 : Math.sin(state.elapsed * 1.35) * 0.018;
  const aimLean = reducedMotion ? 0 : Math.cos(state.aimAngle) * 0.035;
  const recoilEase = state.recoil * state.recoil;
  const idleScaleY = 1 + breathe * 0.012;
  const idleScaleX = 1 - breathe * 0.006;
  const characterImage = state.recoil > 0.38 ? images.recoil : images.launcher;
  ctx.save();
  ctx.translate(BOARD.shooterX - Math.cos(state.aimAngle) * recoilEase * 9, BOARD.shooterY + 55 + breathe * 1.6 + recoilEase * 6);
  ctx.rotate(sway + aimLean - Math.cos(state.aimAngle) * recoilEase * 0.05);
  ctx.scale(idleScaleX * (1 + recoilEase * 0.025), idleScaleY * (1 - recoilEase * 0.04));
  const recoilWidth = 172;
  const recoilHeight = characterImage === images.recoil ? 220 : 218;
  ctx.drawImage(characterImage, -recoilWidth / 2, -155, recoilWidth, recoilHeight);
  ctx.restore();

  ctx.save();
  ctx.translate(BOARD.shooterX, BOARD.shooterY - 2);
  ctx.rotate(state.aimAngle + Math.PI / 2);
  const glow = ctx.createRadialGradient(0, -20, 2, 0, -20, 44);
  glow.addColorStop(0, "rgba(255,255,230,.65)");
  glow.addColorStop(1, "rgba(102,210,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(-48, -68, 96, 96);
  if (state.shotFlash > 0) {
    const flash = state.shotFlash;
    const flare = ctx.createRadialGradient(0, -70, 1, 0, -70, 36 + flash * 22);
    flare.addColorStop(0, `rgba(255, 255, 225, ${flash})`);
    flare.addColorStop(0.3, `rgba(112, 235, 255, ${flash * .8})`);
    flare.addColorStop(1, "rgba(112, 235, 255, 0)");
    ctx.fillStyle = flare;
    ctx.fillRect(-64, -134, 128, 128);
    ctx.strokeStyle = `rgba(255, 242, 142, ${flash})`;
    ctx.lineWidth = 3;
    for (let ray = 0; ray < 6; ray += 1) {
      const angle = ray * Math.PI / 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 8, -70 + Math.sin(angle) * 8);
      ctx.lineTo(Math.cos(angle) * (28 + flash * 16), -70 + Math.sin(angle) * (28 + flash * 16));
      ctx.stroke();
    }
  }
  ctx.restore();

  if (!state.projectile) drawOrb(state.currentType, BOARD.shooterX, BOARD.shooterY - 32 + recoilEase * 7, 25, state.elapsed * 0.4);
  if (state.armedPower === "bloom") {
    ctx.beginPath();
    ctx.arc(BOARD.shooterX, BOARD.shooterY - 32, 34 + Math.sin(state.elapsed * 7) * 3, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 224, 103, .9)";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#ffe36b";
    ctx.shadowBlur = 18;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.fillStyle = "rgba(8, 22, 52, .82)";
  ctx.beginPath();
  ctx.arc(464, 854, 31, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 226, 160, .75)";
  ctx.lineWidth = 2;
  ctx.stroke();
  if (state.swapPulse > 0) {
    ctx.beginPath();
    ctx.arc(464, 854, 34 + state.swapPulse * 8, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(134, 238, 255, ${Math.min(1, state.swapPulse * 1.8)})`;
    ctx.lineWidth = 3;
    ctx.shadowColor = "#75eaff";
    ctx.shadowBlur = 18;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.fillStyle = "#b7cceb";
  ctx.font = "800 10px 'Moonbloom UI'";
  ctx.textAlign = "center";
  ctx.fillText("TIẾP", 464, 820);
  drawOrb(state.nextType, 464, 854, 22, -state.elapsed * 0.35);
}

function render() {
  ctx.save();
  const shakeX = state.shake ? (state.random() - 0.5) * state.shake : 0;
  const shakeY = state.shake ? (state.random() - 0.5) * state.shake : 0;
  ctx.translate(shakeX, shakeY);
  drawBackground();
  drawDangerLine();

  for (const trail of state.trails) {
    const alpha = Math.max(0, trail.life / 0.25);
    ctx.beginPath();
    ctx.arc(trail.x, trail.y, 4 * alpha, 0, Math.PI * 2);
    ctx.fillStyle = colors[trail.type] + Math.round(alpha * 160).toString(16).padStart(2, "0");
    ctx.fill();
  }

  for (const bubble of state.bubbles) {
    const position = bubblePosition(bubble);
    const scale = bubble.scale ?? 1;
    drawOrb(bubble.type, position.x, position.y, BOARD.radius * scale, reducedMotion ? 0 : Math.sin(state.elapsed * 1.5 + bubble.col) * 0.02);
  }

  for (const bubble of state.falling) drawOrb(bubble.type, bubble.x, bubble.y, BOARD.radius, bubble.rotation, Math.max(0, 1 - (bubble.y - BOARD.dangerY) / 260));
  for (const particle of state.particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  drawAimGuide();
  drawLauncher();
  if (state.projectile) {
    if (state.projectile.power === "bloom") {
      ctx.beginPath();
      ctx.arc(state.projectile.x, state.projectile.y, BOARD.radius + 8, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 225, 100, .28)";
      ctx.fill();
    }
    drawOrb(state.projectile.type, state.projectile.x, state.projectile.y, BOARD.radius, state.projectile.rotation);
  }
  if (state.flash > 0) {
    ctx.fillStyle = `rgba(210, 240, 255, ${state.flash * 0.22})`;
    ctx.fillRect(0, 0, BOARD.width, BOARD.height);
  }
  ctx.restore();
}

function loop(now) {
  const dt = Math.min(0.033, (now - state.lastTime) / 1000 || 0);
  state.lastTime = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (BOARD.width / rect.width),
    y: (event.clientY - rect.top) * (BOARD.height / rect.height),
  };
}

function setAimFromPoint(point) {
  let angle = Math.atan2(point.y - BOARD.shooterY, point.x - BOARD.shooterX);
  if (angle > -0.16) angle = -0.16;
  if (angle < -Math.PI + 0.16) angle = -Math.PI + 0.16;
  state.aimAngle = angle;
}

canvas.addEventListener("pointerdown", (event) => {
  if (state.mode !== "playing") return;
  canvas.setPointerCapture(event.pointerId);
  state.aiming = true;
  setAimFromPoint(pointerPosition(event));
});

canvas.addEventListener("pointermove", (event) => {
  if (!state.aiming || state.mode !== "playing") return;
  setAimFromPoint(pointerPosition(event));
});

canvas.addEventListener("pointerup", (event) => {
  if (!state.aiming) return;
  state.aiming = false;
  setAimFromPoint(pointerPosition(event));
  fire();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") state.aimAngle = Math.max(-Math.PI + 0.16, state.aimAngle - 0.075);
  if (event.key === "ArrowRight") state.aimAngle = Math.min(-0.16, state.aimAngle + 0.075);
  if (event.code === "Space") {
    event.preventDefault();
    fire();
  }
  if (event.key.toLowerCase() === "p" || event.key === "Escape") setPaused(state.mode === "playing");
  if (event.key.toLowerCase() === "q") activateBloom();
  if (event.key.toLowerCase() === "e") activateFrost();
  if (event.key.toLowerCase() === "r") swapNextBall();
});

ui.start.addEventListener("click", () => { initAudio(); resetGame(); });
window.__game = window.__game || {}; // AGENTPARK: open straight into play
window.__game.autostart = () => { if (state.mode === "playing") return true; ui.start.click(); window.__game.state = 'play'; return true; };
ui.restart.addEventListener("click", () => { initAudio(); resetGame(); });
ui.pause.addEventListener("click", () => setPaused(state.mode === "playing"));
ui.resume.addEventListener("click", () => setPaused(false));
ui.mute.addEventListener("click", () => {
  muted = !muted;
  writeStorage("moonbloom-muted", muted);
  updateAudioControl();
  if (!muted) { initAudio(); tone(660, 0.12); }
  syncMusic();
});
ui.motion.addEventListener("click", () => {
  reducedMotion = !reducedMotion;
  writeStorage("moonbloom-motion", reducedMotion ? "reduced" : "full");
  ui.motion.setAttribute("aria-pressed", String(reducedMotion));
});
ui.bloomPower.addEventListener("click", activateBloom);
ui.frostPower.addEventListener("click", activateFrost);
ui.nextSwap.addEventListener("click", swapNextBall);
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state.mode === "playing") setPaused(true);
  else syncMusic();
});

updatePowerHud();
updateNextSwapHud();
syncMusic();
requestAnimationFrame(loop);
