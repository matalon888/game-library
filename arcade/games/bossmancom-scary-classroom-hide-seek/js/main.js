import * as THREE from '../vendor/three.module.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Seeker } from './seeker.js';
import { GameAudio } from './audio.js';
import { MobileControls } from './mobile.js';
import { Minimap } from './minimap.js';

const ROUND_SECONDS = 180; // 3 minutes (starts after hide phase)
const HIDE_SECONDS = 30; // free time to find a spot before seeking

const canvas = document.getElementById('game-canvas');
const hud = document.getElementById('hud');
const timerEl = document.getElementById('timer');
const statusMsg = document.getElementById('status-msg');
const noiseFill = document.getElementById('noise-fill');
const overlay = document.getElementById('overlay');
const endOverlay = document.getElementById('end-overlay');
const endTitle = document.getElementById('end-title');
const endMsg = document.getElementById('end-msg');
const btnStart = document.getElementById('btn-start');
const btnRestart = document.getElementById('btn-restart');
const jumpscare = document.getElementById('jumpscare');
const hidePhaseEl = document.getElementById('hide-phase');
const hidePhaseCount = document.getElementById('hide-phase-count');
const hidePhaseLabel = document.getElementById('hide-phase-label');
const hideStateEl = document.getElementById('hide-state');
const lockerOverlay = document.getElementById('locker-overlay');
const minimapCanvas = document.getElementById('minimap');
const gameContainer = document.getElementById('game-container');

// —— Renderer ——
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x1a1c22);

// —— Scene / camera ——
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x1c1e26, 0.022);

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.08,
  80
);

// —— Systems ——
const audio = new GameAudio();
const world = new World(scene);
const player = new Player(camera, world, audio);
const seeker = new Seeker(scene, world);
const mobile = new MobileControls(player, gameContainer);
const minimap = new Minimap(minimapCanvas, world);

// Subtle dust particles
const dust = createDust();
scene.add(dust);

// Far fog for long hall
camera.far = 100;
camera.updateProjectionMatrix();

let running = false;
let timeLeft = ROUND_SECONDS;
let hideLeft = HIDE_SECONDS;
let seeking = false; // false during free hide phase
let statusTimer = 0;
let clock = new THREE.Clock();
let lastHideStateKey = '';

function createDust() {
  const count = 180;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 22;
    positions[i * 3 + 1] = Math.random() * 3.5;
    positions[i * 3 + 2] = -8 + Math.random() * 50;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0x888878,
    size: 0.04,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  return new THREE.Points(geo, mat);
}

function showStatus(text, duration = 2, danger = false) {
  statusMsg.textContent = text;
  statusMsg.classList.toggle('danger', danger);
  statusMsg.classList.add('show');
  statusTimer = duration;
}

function formatTime(sec) {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

function updateTimerUI() {
  timerEl.textContent = formatTime(timeLeft);
  timerEl.classList.toggle('urgent', seeking && timeLeft <= 30);
  timerEl.classList.toggle('dimmed', !seeking);
}

function updateHidePhaseUI() {
  if (!seeking && hideLeft > 0) {
    hidePhaseEl.classList.remove('hidden', 'over');
    hidePhaseEl.classList.toggle('urgent', hideLeft <= 10);
    hidePhaseLabel.textContent = 'Time to hide';
    hidePhaseCount.textContent = String(Math.ceil(hideLeft));
  } else {
    hidePhaseEl.classList.add('hidden');
  }
}

function updateHideStateUI() {
  const near = world.nearestInteractable(player.position, 1.85);
  let key;
  let text;
  let cls;

  if (player.insideSpot) {
    const kind = player.insideSpot.type === 'cabinet' ? 'CABINET' : 'LOCKER';
    key = `in-${kind}`;
    text = `HIDDEN · IN ${kind}`;
    cls = 'hidden';
    lockerOverlay.classList.remove('hidden');
  } else {
    lockerOverlay.classList.add('hidden');
    if (near) {
      const kind = near.type === 'cabinet' ? 'Cabinet' : 'Locker';
      key = `near-${near.type}`;
      text = `NEAR ${kind.toUpperCase()} · E / ACTION`;
      cls = 'near';
    } else if (player.isCrouching && player.cover >= 0.4) {
      key = 'crouch-cover';
      text = 'CROUCHING · PARTLY HIDDEN';
      cls = 'crouch';
    } else if (player.isCrouching) {
      key = 'crouch';
      text = 'CROUCHING · EXPOSED';
      cls = 'crouch';
    } else if (player.isSneaking) {
      key = 'sneak';
      text = 'SNEAKING · QUIET';
      cls = 'sneak';
    } else {
      key = 'out';
      text = 'OUTSIDE · EXPOSED';
      cls = 'outside';
    }
  }

  if (key !== lastHideStateKey) {
    lastHideStateKey = key;
    hideStateEl.textContent = text;
    hideStateEl.className = cls;
  }
}

function beginSeeking() {
  seeking = true;
  hideLeft = 0;
  hidePhaseEl.classList.add('hidden');
  seeker.mesh.visible = true;
  seeker.reset();
  // Park seeker at far end of long locker hall
  seeker.position.set(0, 0, (world.hallEndZ || 40) - 4);
  seeker.yaw = Math.PI; // face toward classroom
  seeker.syncMesh();
  showStatus("It's coming!", 2.5, true);
  updateTimerUI();
}

let starting = false;

/** Fully synchronous start path — never await before enabling play */
function startGame(ev) {
  if (ev) {
    // Don't preventDefault on click — some desktops drop the action
    if (ev.type === 'touchend' || ev.type === 'pointerup') {
      ev.preventDefault?.();
    }
    ev.stopPropagation?.();
  }
  if (running || starting) return;
  starting = true;

  try {
    // Kick audio in background (must not block start — resume can hang)
    Promise.resolve()
      .then(() => audio.init())
      .then(() => audio.resume())
      .catch((err) => console.warn('Audio init skipped:', err));

    overlay.classList.add('hidden');
    endOverlay.classList.add('hidden');
    jumpscare.classList.remove('flash');
    lockerOverlay.classList.add('hidden');
    hud.classList.remove('hidden');

    player.reset(new THREE.Vector3(2, 0, 4));
    seeker.reset();
    seeker.mesh.visible = false;
    seeker.position.set(0, -50, 0);
    seeker.syncMesh();

    timeLeft = ROUND_SECONDS;
    hideLeft = HIDE_SECONDS;
    seeking = false;
    lastHideStateKey = '';
    running = true;
    player.enable();
    mobile.setGameplayActive(true);

    updateTimerUI();
    updateHidePhaseUI();
    updateHideStateUI();
    showStatus('Hide! 30 seconds', 3);

    // Desktop pointer lock only when not using on-screen controls
    if (!mobile.active) {
      try {
        canvas.requestPointerLock?.();
      } catch (_) {}
    }
  } catch (err) {
    console.error('startGame failed:', err);
    running = false;
    overlay.classList.remove('hidden');
    showLoadError(String(err?.message || err));
  } finally {
    starting = false;
  }
}

function endRound(won) {
  running = false;
  starting = false;
  player.disable();
  mobile.setGameplayActive(false);
  document.exitPointerLock?.();
  lockerOverlay.classList.add('hidden');
  hidePhaseEl.classList.add('hidden');

  if (won) {
    audio.winChime();
    endTitle.textContent = 'SURVIVED';
    endTitle.classList.remove('danger');
    endMsg.textContent =
      'The bell never rang, but the night did. You lasted the full round.';
    endOverlay.classList.remove('hidden');
  } else {
    audio.foundSting();
    jumpscare.classList.add('flash');
    showStatus('Found!', 1.5, true);
    setTimeout(() => {
      endTitle.textContent = 'FOUND';
      endTitle.classList.add('danger');
      endMsg.textContent =
        'It saw you. The fluorescent lights buzz like teeth. Try again — stay lower, quieter.';
      endOverlay.classList.remove('hidden');
    }, 700);
  }
}

function showLoadError(msg) {
  let el = document.getElementById('load-error');
  if (!el) {
    el = document.createElement('div');
    el.id = 'load-error';
    el.style.cssText =
      'position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;padding:12px 14px;background:#3a1515;color:#f0c0c0;border:1px solid #a44;font:13px/1.4 system-ui;border-radius:8px';
    document.body.appendChild(el);
  }
  el.textContent = 'Could not start: ' + msg;
}

function bindStart(el) {
  if (!el) return;
  // Multiple event types — desktop mouse + touch screens
  const go = (e) => startGame(e);
  el.addEventListener('click', go);
  el.addEventListener('mousedown', (e) => {
    if (e.button === 0) startGame(e);
  });
  el.addEventListener('touchend', go, { passive: false });
  el.addEventListener('keydown', (e) => {
    if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      startGame(e);
    }
  });
}

bindStart(btnStart);
bindStart(btnRestart);

// Capture-phase fallback so nothing can swallow the Play click
document.addEventListener(
  'click',
  (e) => {
    const t = e.target;
    if (t && (t.id === 'btn-start' || t.id === 'btn-restart' || t.closest?.('#btn-start') || t.closest?.('#btn-restart'))) {
      startGame(e);
    }
  },
  true
);

window.__startHideGame = startGame;
window.__game = window.__game || {}; // AGENTPARK: open straight into play (the HTML Play button exists before this module loads)
window.__game.autostart = () => { if (running) return true; startGame(); if (!running) return false; window.__game.state = 'play'; return true; };

// If modules loaded, mark ready (for debugging)
document.body?.classList?.add('game-ready');

// Re-lock pointer on canvas click during play (desktop only)
canvas.addEventListener('click', () => {
  if (running && !document.pointerLockElement && !mobile.active) {
    canvas.requestPointerLock?.();
  }
});

document.addEventListener('pointerlockchange', () => {
  if (running && !document.pointerLockElement) {
    // Soft pause feel — keep running but no look; optional message
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// —— Main loop ——
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  world.update(dt, t);

  // Dust drift
  dust.rotation.y = t * 0.02;
  const pos = dust.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let y = pos.getY(i) + dt * 0.05;
    if (y > 3.5) y = 0.1;
    pos.setY(i, y);
  }
  pos.needsUpdate = true;

  if (running) {
    player.update(dt);
    updateHideStateUI();

    if (!seeking) {
      // Free hide phase — seeker inactive
      hideLeft -= dt;
      updateHidePhaseUI();
      audio.setBreathProximity(0);
      if (hideLeft <= 0) {
        beginSeeking();
      }
    } else {
      seeker.update(dt, player);

      // Noise → seeker investigation spikes
      if (player.noise > 0.55 && Math.random() < dt * 2) {
        seeker.notifyNoise(player.position, player.noise);
      }

      audio.setBreathProximity(seeker.proximityTo(player) * 0.9);

      // Survival timer only during seeking
      timeLeft -= dt;
      updateTimerUI();

      if (timeLeft <= 0) {
        endRound(true);
      } else if (seeker.caught) {
        endRound(false);
      }
    }

    const flick =
      world.flickerLights.reduce((a, f) => a + (f.light.intensity < 0.7 ? 1 : 0), 0) /
      Math.max(1, world.flickerLights.length);
    audio.setHumFlicker(flick);

    // HUD noise
    noiseFill.style.width = `${Math.round(player.noise * 100)}%`;

    // Minimap
    minimap.draw(player, seeker, seeking);
  }

  // Status message fade
  if (statusTimer > 0) {
    statusTimer -= dt;
    if (statusTimer <= 0) statusMsg.classList.remove('show');
  }

  renderer.render(scene, camera);
}

// Initial camera pose for title screen
player.reset(new THREE.Vector3(0, 0, 3));
player._applyCamera();
player.disable();
clock.start();
tick();

console.info(
  '%c HIDE %c single-player · no chat · no tracking ',
  'background:#1a1520;color:#c8c4b8;padding:4px 8px',
  'background:#1a3020;color:#8fd48a;padding:4px 8px',
  window.__HIDE_SAFETY__ || {}
);
