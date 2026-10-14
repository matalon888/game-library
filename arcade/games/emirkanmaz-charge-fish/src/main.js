import { CANVAS, DEBUG, TIMING } from './config.js';
import { initBattery, subscribeCharging, isUsingFallback, setListenerEnabled } from './sensors/battery.js';
import {
  initOrientation, readGamma, readRawGamma, calibrate,
  ensureOrientationPermission, isOrientationPermitted,
  isOrientationPermissionRequired,
} from './sensors/orientation.js';
import * as Game from './game.js';
import * as Mode from './modes/mode.js';
import { MODE, modeTicker, formatTime } from './modes/mode.js';
import * as Settings from './settings.js';
import * as Upgrades from './upgrades.js';
import * as Quests from './quests.js';
import './achievements.js';
import { startRenderer, addDrawable } from './render/renderer.js';
import { sky, water } from './render/scene.js';
import { rod } from './render/rod.js';
import { ui } from './render/ui.js';
import { depthMeter } from './render/depthMeter.js';
import { particleSystem } from './render/particles.js';
import { timerOverlay } from './render/timer.js';
import { comboOverlay } from './render/comboOverlay.js';
import { toastOverlay, pushToast } from './render/toast.js';
import { weather, starsLayer, rainLayer } from './render/weather.js';
import { fishSpawner } from './entities/fishSpawner.js';
import { catchSystem } from './catch.js';
import { initAudio } from './audio/audio.js';
import { wireEvents } from './events.js';
import { t, getLocale } from './i18n.js';
import { UPGRADES } from './upgrades.js';
import { QUESTS } from './quests.js';

// --- Element refs ---
const canvas = document.getElementById('game-canvas');
const modeScreen = document.getElementById('mode-screen');
const calibrationScreen = document.getElementById('calibration-screen');
const gameoverScreen = document.getElementById('gameover-screen');
const settingsScreen = document.getElementById('settings-screen');
const upgradesScreen = document.getElementById('upgrades-screen');
const compatWarning = document.getElementById('compat-warning');
const debugOverlay = document.getElementById('debug-overlay');
const calibrateButton = document.getElementById('calibrate-button');
const backButton = document.getElementById('back-button');
const gammaDot = document.getElementById('gamma-dot');
const installButton = document.getElementById('install-button');

// --- Canvas sizing ---
function resizeCanvas() {
  const dpr = CANVAS.TARGET_DPR;
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function checkCompatibility() {
  const issues = [];
  if (!window.isSecureContext) issues.push(t('compatHttps'));
  if (!('getBattery' in navigator) && !DEBUG.fakeCharging) issues.push(t('compatBattery'));
  if (typeof DeviceOrientationEvent === 'undefined' && !DEBUG.manualGamma) issues.push(t('compatOrientation'));
  // iOS doesn't fall into the above check — DeviceOrientationEvent exists,
  // it just needs permission. We'll surface a denial message later if the
  // user rejects the prompt.
  return issues;
}

function showCompat(issues) {
  if (issues.length === 0) return;
  compatWarning.textContent = issues.join(' ');
  compatWarning.classList.remove('hidden');
}

// --- i18n text application ---
function applyAllText() {
  document.documentElement.lang = getLocale();
  document.title = t('title');

  document.getElementById('game-title').textContent = t('title');
  document.getElementById('mode-intro').textContent = t('modeSelectIntro');
  document.getElementById('mode-free-title').textContent = t('modeFreeTitle');
  document.getElementById('mode-free-desc').textContent = t('modeFreeDesc');
  document.getElementById('mode-survival-title').textContent = t('modeSurvivalTitle');
  document.getElementById('mode-survival-desc').textContent = t('modeSurvivalDesc');
  document.getElementById('settings-button').textContent = t('settingsButton');
  document.getElementById('upgrades-button').textContent = t('upgradesButton');
  installButton.textContent = t('installButton');

  document.getElementById('calib-title').textContent = t('calibTitle');
  document.getElementById('calib-body').textContent = t('calibBody');
  document.getElementById('calib-left-label').textContent = t('calibLeft');
  document.getElementById('calib-right-label').textContent = t('calibRight');
  document.getElementById('calib-start-button').textContent = t('calibStart');

  document.getElementById('over-title').textContent = t('overTitle');
  document.getElementById('over-survived-label').textContent = t('overSurvivedLabel');
  document.getElementById('over-score-label').textContent = t('overScoreLabel');
  document.getElementById('over-catches-label').textContent = t('overCatchesLabel');
  document.getElementById('over-again-button').textContent = t('overAgain');
  document.getElementById('over-back-button').textContent = t('overBack');
  document.getElementById('over-share-button').textContent = t('overShare');

  document.getElementById('settings-title').textContent = t('settingsTitle');
  document.getElementById('settings-sound-label').textContent = t('settingsSound');
  document.getElementById('settings-haptic-label').textContent = t('settingsHaptic');
  document.getElementById('settings-cb-label').textContent = t('settingsColorBlind');
  document.getElementById('settings-sens-label').textContent = t('settingsSensitivity');
  document.getElementById('settings-close-button').textContent = t('settingsClose');

  document.getElementById('upg-title').textContent = t('upgTitle');
  document.getElementById('upg-close-button').textContent = t('upgClose');

  backButton.textContent = t('backToMenu');
  calibrateButton.textContent = t('recenter');
}

// --- Screen visibility ---
const Screens = {
  MODE: 'mode', CALIBRATION: 'calibration', GAME: 'game', GAMEOVER: 'gameover',
  SETTINGS: 'settings', UPGRADES: 'upgrades',
};
let currentScreen = Screens.MODE;
let returnFromOverlayTo = Screens.MODE;

function showScreen(name) {
  currentScreen = name;
  modeScreen.classList.toggle('hidden', name !== Screens.MODE);
  calibrationScreen.classList.toggle('hidden', name !== Screens.CALIBRATION);
  gameoverScreen.classList.toggle('hidden', name !== Screens.GAMEOVER);
  settingsScreen.classList.toggle('hidden', name !== Screens.SETTINGS);
  upgradesScreen.classList.toggle('hidden', name !== Screens.UPGRADES);

  const showIngameControls = name === Screens.GAME;
  backButton.classList.toggle('hidden', !showIngameControls);
  calibrateButton.classList.toggle('hidden', !showIngameControls);

  // Tap-charge listener only active in GAME (and only matters if fallback).
  setListenerEnabled(name === Screens.GAME);
}

// --- One-time setup that survives across rounds ---
let bootstrapped = false;
let rendererStarted = false;

async function bootstrapSensorsAndAudio() {
  if (bootstrapped) return;
  bootstrapped = true;
  // Audio first: AudioContext.resume() must be called inside the user
  // gesture that triggered us. Awaiting it before subsequent async ops
  // keeps iOS happy.
  await initAudio();
  try { await initBattery(); } catch (err) { console.error('Battery init failed:', err); }
  initOrientation();
  wireCharging();
  wireEvents();
}

// iOS-only flag: surface a one-line warning if the orientation permission
// was rejected so the user knows tilt won't work but tap fallback will.
function maybeShowPermissionWarning() {
  if (isOrientationPermissionRequired() && !isOrientationPermitted()) {
    compatWarning.textContent = t('iosPermissionDenied');
    compatWarning.classList.remove('hidden');
  }
}

function wireCharging() {
  let firstCall = true;
  subscribeCharging((charging) => {
    if (firstCall) { firstCall = false; return; }
    if (!Mode.getMode() || Mode.isOver()) return;
    if (currentScreen !== Screens.GAME) return;
    const state = Game.getState();
    if (charging && state === Game.State.IDLE) {
      Game.transition(Game.State.CASTING);
      setTimeout(() => {
        if (Game.getState() === Game.State.CASTING) Game.transition(Game.State.FISHING);
      }, TIMING.CAST_ANIMATION_MS);
    } else if (!charging && (state === Game.State.FISHING || state === Game.State.HOOKED)) {
      Game.transition(Game.State.REELING);
      const reelMs = TIMING.REEL_ANIMATION_MS * (1 - Math.min(0.6, Upgrades.getEffect('reel')));
      setTimeout(() => {
        if (Game.getState() === Game.State.REELING) Game.transition(Game.State.IDLE);
      }, reelMs);
    }
  });
}

// --- Calibration screen live gamma loop ---
let gammaLoopActive = false;
function startGammaLoop() {
  if (gammaLoopActive) return;
  gammaLoopActive = true;
  const tick = () => {
    if (!gammaLoopActive) return;
    if (currentScreen === Screens.CALIBRATION) {
      const g = readRawGamma();
      const pct = 50 + g * 50;
      gammaDot.style.left = `${Math.max(4, Math.min(96, pct))}%`;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function stopGammaLoop() { gammaLoopActive = false; }

// --- Renderer + drawables (added once) ---
function ensureRendererRunning() {
  if (rendererStarted) return;
  rendererStarted = true;
  addDrawable(modeTicker);
  addDrawable(sky);
  addDrawable(starsLayer);
  addDrawable(water);
  addDrawable(weather);
  addDrawable(fishSpawner);
  addDrawable(depthMeter);
  addDrawable(rod);
  addDrawable(catchSystem);
  addDrawable(rainLayer);
  addDrawable(particleSystem);
  addDrawable(timerOverlay);
  addDrawable(comboOverlay);
  addDrawable(ui);
  addDrawable(toastOverlay);
  startRenderer(canvas);
}

// --- Screen transitions ---
async function goToCalibration(mode) {
  await bootstrapSensorsAndAudio();
  Game.resetState();
  Mode.setMode(mode);
  showScreen(Screens.CALIBRATION);
  startGammaLoop();
}

function goToGame() {
  calibrate();
  stopGammaLoop();
  ensureRendererRunning();
  showScreen(Screens.GAME);
}

function goToMenu() {
  Game.resetState();
  Mode.clearMode();
  stopGammaLoop();
  refreshQuestCard();
  showScreen(Screens.MODE);
}

function goToGameOver() {
  const st = Mode.getStatus();
  const survived = st?.survivedMs ?? 0;
  document.getElementById('over-survived-value').textContent = formatTime(survived);
  document.getElementById('over-score-value').textContent = String(Game.getScore());
  document.getElementById('over-catches-value').textContent = String(st?.catches ?? 0);
  showScreen(Screens.GAMEOVER);
}

// --- Mode lifecycle subscription ---
Mode.subscribe((mode, status) => {
  if (mode === MODE.SURVIVAL && status?.isOver) {
    goToGameOver();
  }
});

// --- Quest card refresh ---
const questCard = document.getElementById('quest-card');
const questHeader = document.getElementById('quest-header');
const questTitle = document.getElementById('quest-title');
const questReward = document.getElementById('quest-reward');
const questFill = document.getElementById('quest-progress-fill');
const questStatus = document.getElementById('quest-status');

function refreshQuestCard() {
  const quest = Quests.getQuest();
  const progress = Quests.getProgress();
  questCard.classList.remove('hidden');
  questCard.classList.toggle('completed', progress.completed);
  questHeader.textContent = t('questHeader');
  questTitle.textContent = t(quest.titleKey);
  questReward.textContent = `+${quest.reward} ${t('questReward')}`;
  const pct = Math.min(100, (progress.progress / progress.target) * 100);
  questFill.style.width = `${pct}%`;
  questStatus.textContent = progress.completed
    ? t('questCompleted', { n: quest.reward })
    : `${progress.progress} / ${progress.target}`;
}

Quests.onQuestEvent((event) => {
  refreshQuestCard();
  if (event.kind === 'complete') {
    pushToast({
      title: t(event.quest.titleKey),
      body: t('questCompleteToast', { n: event.quest.reward }),
    });
  }
});

// --- Settings overlay wiring ---
const settingsSound = document.getElementById('settings-sound-toggle');
const settingsHaptic = document.getElementById('settings-haptic-toggle');
const settingsCb = document.getElementById('settings-cb-toggle');
const settingsSens = document.getElementById('settings-sens-slider');
const settingsSensValue = document.getElementById('settings-sens-value');

function syncSettingsUi() {
  const s = Settings.get();
  settingsSound.checked = s.soundOn;
  settingsHaptic.checked = s.hapticOn;
  settingsCb.checked = s.colorBlind;
  settingsSens.value = s.tiltSensitivity;
  settingsSensValue.textContent = s.tiltSensitivity.toFixed(1) + '×';
}

settingsSound.addEventListener('change', () => Settings.set('soundOn', settingsSound.checked));
settingsHaptic.addEventListener('change', () => Settings.set('hapticOn', settingsHaptic.checked));
settingsCb.addEventListener('change', () => Settings.set('colorBlind', settingsCb.checked));
settingsSens.addEventListener('input', () => {
  Settings.set('tiltSensitivity', parseFloat(settingsSens.value));
  settingsSensValue.textContent = parseFloat(settingsSens.value).toFixed(1) + '×';
});
Settings.subscribe(syncSettingsUi);

// --- Upgrades overlay ---
const upgList = document.getElementById('upg-list');
const upgCoins = document.getElementById('upg-coins');

function renderUpgrades() {
  upgCoins.textContent = `${t('upgCoins')}: ${Upgrades.getCoins()}`;
  upgList.innerHTML = '';
  for (const def of UPGRADES) {
    const lvl = Upgrades.getLevel(def.id);
    const maxed = lvl >= def.maxLevel;
    const cost = maxed ? '—' : def.costs[lvl];
    const canBuy = Upgrades.canAfford(def.id);

    const card = document.createElement('div');
    card.className = 'upg-card';

    const title = document.createElement('div');
    title.className = 'upg-card-title';
    title.textContent = t(def.titleKey);
    card.appendChild(title);

    const lvlEl = document.createElement('div');
    lvlEl.className = 'upg-card-level';
    lvlEl.textContent = `${t('upgLevel')} ${lvl}/${def.maxLevel}${maxed ? ' (' + t('upgMax') + ')' : ''}`;
    card.appendChild(lvlEl);

    const desc = document.createElement('div');
    desc.className = 'upg-card-desc';
    desc.textContent = t(def.descKey);
    card.appendChild(desc);

    const actions = document.createElement('div');
    actions.className = 'upg-card-actions';
    if (!maxed) {
      const costEl = document.createElement('span');
      costEl.className = 'upg-cost';
      costEl.textContent = `${cost}`;
      actions.appendChild(costEl);
      const buy = document.createElement('button');
      buy.className = 'upg-buy';
      buy.textContent = t('upgBuy');
      buy.disabled = !canBuy;
      buy.addEventListener('click', (e) => {
        e.stopPropagation();
        if (Upgrades.purchase(def.id)) renderUpgrades();
      });
      actions.appendChild(buy);
    }
    card.appendChild(actions);
    upgList.appendChild(card);
  }
}

Upgrades.subscribe(() => {
  if (currentScreen === Screens.UPGRADES) renderUpgrades();
});

// --- Share button ---
async function handleShare() {
  const st = Mode.getStatus();
  const survived = st?.survivedMs ? formatTime(st.survivedMs) : '—';
  const text = t('shareText', { time: survived, score: Game.getScore() });
  const url = window.location.href.split('?')[0];
  if (navigator.share) {
    try { await navigator.share({ title: t('title'), text, url }); } catch {}
  } else if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(`${text} ${url}`); } catch {}
  }
}

// --- PWA install prompt ---
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  installButton.classList.remove('hidden');
});
installButton.addEventListener('click', async (e) => {
  e.stopPropagation();
  if (!deferredInstallPrompt) return;
  installButton.classList.add('hidden');
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
});

// --- Service worker registration ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./service-worker.js')
      .catch((err) => console.warn('[sw] register failed:', err));
  });
}

// --- Button wiring ---
function wireButtons() {
  document.getElementById('mode-free-button').addEventListener('click', async (e) => {
    e.stopPropagation();
    // iOS: must request orientation permission inside the user gesture.
    // No-op on Android / desktop.
    await ensureOrientationPermission();
    maybeShowPermissionWarning();
    goToCalibration(MODE.FREE);
  });
  document.getElementById('mode-survival-button').addEventListener('click', async (e) => {
    e.stopPropagation();
    await ensureOrientationPermission();
    maybeShowPermissionWarning();
    goToCalibration(MODE.SURVIVAL);
  });
  document.getElementById('calib-start-button').addEventListener('click', (e) => {
    e.stopPropagation(); goToGame();
  });
  document.getElementById('over-again-button').addEventListener('click', (e) => {
    e.stopPropagation();
    const mode = Mode.getMode();
    Game.resetState();
    Mode.setMode(mode);
    showScreen(Screens.GAME);
  });
  document.getElementById('over-back-button').addEventListener('click', (e) => {
    e.stopPropagation(); goToMenu();
  });
  document.getElementById('over-share-button').addEventListener('click', (e) => {
    e.stopPropagation(); handleShare();
  });
  backButton.addEventListener('click', (e) => {
    e.stopPropagation(); goToMenu();
  });
  calibrateButton.addEventListener('click', (e) => {
    e.stopPropagation();
    calibrate();
    calibrateButton.style.background = 'rgba(244, 184, 96, 0.85)';
    calibrateButton.style.color = '#0a3a5a';
    setTimeout(() => {
      calibrateButton.style.background = '';
      calibrateButton.style.color = '';
    }, 250);
  });
  document.getElementById('settings-button').addEventListener('click', (e) => {
    e.stopPropagation();
    returnFromOverlayTo = currentScreen;
    syncSettingsUi();
    showScreen(Screens.SETTINGS);
  });
  document.getElementById('settings-close-button').addEventListener('click', (e) => {
    e.stopPropagation();
    showScreen(returnFromOverlayTo);
  });
  document.getElementById('upgrades-button').addEventListener('click', (e) => {
    e.stopPropagation();
    returnFromOverlayTo = currentScreen;
    renderUpgrades();
    showScreen(Screens.UPGRADES);
  });
  document.getElementById('upg-close-button').addEventListener('click', (e) => {
    e.stopPropagation();
    showScreen(returnFromOverlayTo);
  });
}

// --- Debug overlay ---
function startDebugLoop() {
  if (!DEBUG.enabled) return;
  debugOverlay.classList.remove('hidden');
  const tick = () => {
    const snap = Game.getSnapshot();
    const status = Mode.getStatus();
    debugOverlay.textContent = [
      `screen: ${currentScreen}  mode: ${Mode.getMode() ?? '-'}`,
      `state: ${snap.state}  score: ${snap.score}  coins: ${Upgrades.getCoins()}`,
      `time: ${status?.timeRemainingMs != null ? Math.ceil(status.timeRemainingMs) + 'ms' : '-'}`,
      `gamma: ${readGamma().toFixed(2)}  raw: ${readRawGamma().toFixed(2)}`,
      `tap: ${isUsingFallback() ? 'on' : 'off'}`,
    ].join('\n');
    requestAnimationFrame(tick);
  };
  tick();
}

// --- Boot ---
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', resizeCanvas);
resizeCanvas();

applyAllText();
showCompat(checkCompatibility());
wireButtons();
syncSettingsUi();
refreshQuestCard();

fishSpawner.seedAmbient(window.innerWidth, window.innerHeight);
ensureRendererRunning();
showScreen(Screens.MODE);

if (DEBUG.enabled) {
  window.__game = Game;
  window.__mode = Mode;
  window.__settings = Settings;
  window.__upgrades = Upgrades;
  startDebugLoop();
}
