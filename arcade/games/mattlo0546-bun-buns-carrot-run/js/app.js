/**
 * Page glue: boots the game engine and wires up the title menu, the
 * Character Maker, settings (bring-your-own Gemini key) and touch controls.
 */
import S from './engine/state.js';
import { initLegacyGame, startGameDirectly, resetToTitle } from './engine/main.js';
import { setInputEnabled, pressKey, releaseKey } from './engine/input.js';
import { isMuted, setMuted, startMusic } from './engine/audio.js';
import { resetProgress } from './engine/progress.js';
import * as gemini from './maker/gemini.js';
import { pickKeyColor, detectKeyColor, loadImage } from './maker/key-color.js';
import { sliceGridSpritesheet, packFrames } from './maker/slice-grid.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

const canvas = $('game-canvas');

// =========================
//   Title menu & in-game buttons
// =========================

$('btn-play').onclick = () => { startGameDirectly(); canvas.focus(); };
$('btn-create').onclick = () => openPanel('maker');
$('btn-settings').onclick = () => openPanel('settings');
$('btn-home').onclick = () => resetToTitle();
$('btn-reset-hero').onclick = () => { clearHero(); store.del(SAVED_HERO); };

function syncMuteButton() { $('btn-mute').textContent = isMuted() ? '🔇' : '🔊'; }
function toggleMute() {
  setMuted(!isMuted());
  if (!isMuted() && S.state !== 'title') startMusic(S.level);
  store.set('bb.muted', isMuted() ? '1' : '0');
  syncMuteButton();
}
if (store.get('bb.muted') === '1') setMuted(true);
syncMuteButton();
$('btn-mute').onclick = toggleMute;

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else $('stage').requestFullscreen?.().catch(() => {});
}
$('btn-fullscreen').onclick = toggleFullscreen;

document.addEventListener('keydown', (e) => {
  if (openPanelId) { if (e.key === 'Escape') closePanel(); return; }
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'KeyF') toggleFullscreen();
});

// Buttons shouldn't keep focus, or Space would "click" them instead of jumping
document.querySelectorAll('#menu button, #game-buttons button').forEach((b) => b.addEventListener('click', () => b.blur()));

// Touch controls → simulated key presses
document.querySelectorAll('.touch-btn').forEach((btn) => {
  const code = btn.dataset.key;
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); btn.setPointerCapture?.(e.pointerId); btn.classList.add('held'); pressKey(code); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    btn.addEventListener(ev, () => { btn.classList.remove('held'); releaseKey(code); });
  }
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
});

// =========================
//   Panels
// =========================

let openPanelId = null;
function openPanel(id) {
  closePanel();
  openPanelId = id;
  $(id).hidden = false;
  document.body.classList.add('panel-open');
  setInputEnabled(false); // typing in forms mustn't move the hero
  if (id === 'settings') fillSettings();
  if (id === 'maker') refreshKeyNotice();
  $(id).querySelector('input[type=text], input[type=password]')?.focus();
}
function closePanel() {
  if (!openPanelId) return;
  $(openPanelId).hidden = true;
  openPanelId = null;
  document.body.classList.remove('panel-open');
  setInputEnabled(true);
  canvas.focus();
}
for (const id of ['maker', 'settings']) {
  $(id).addEventListener('click', (e) => { if (e.target === $(id) && !busy) closePanel(); });
}

// =========================
//   Settings (bring your own key)
// =========================

for (const m of gemini.MODELS) $('in-model').add(new Option(m.label, m.id));

function fillSettings() {
  $('in-key').value = gemini.getApiKey();
  $('in-remember').checked = gemini.isKeyRemembered();
  $('in-model').value = gemini.getModel();
  $('settings-status').textContent = '';
}
$('btn-settings-save').onclick = () => {
  gemini.setApiKey($('in-key').value, $('in-remember').checked);
  gemini.setModel($('in-model').value);
  $('settings-status').textContent = gemini.getApiKey()
    ? ($('in-remember').checked ? 'Saved in this browser.' : 'Saved for this visit only.')
    : 'No key set.';
  if (returnToMaker) { returnToMaker = false; setTimeout(() => openPanel('maker'), 400); }
};
$('btn-forget').onclick = () => {
  gemini.setApiKey('', false);
  $('in-key').value = '';
  $('in-remember').checked = false;
  $('settings-status').textContent = 'Key removed from this browser.';
};
$('btn-reset-progress').onclick = () => {
  resetProgress();
  $('settings-status').textContent = 'World progress reset. Only World 1 is unlocked now.';
};

// =========================
//   Character Maker
// =========================

const SAVED_HERO = 'bb.customHero.v1';
let busy = false;
let returnToMaker = false;
let lastSheet = null;   // raw generated sheet (data URL), for "Save sheet"
let lastCells = null;   // 25 keyed-out frames
let abort = null;
const uploads = { hero: null, powerup: null };

function refreshKeyNotice() { $('key-notice').hidden = !!gemini.getApiKey(); }
$('btn-open-key').onclick = () => { returnToMaker = true; openPanel('settings'); };
$('btn-maker-close').onclick = () => { abort?.abort(); setBusy(false); closePanel(); };

function showError(msg) { $('maker-error').textContent = msg || ''; $('maker-error').hidden = !msg; }
function setBusy(on, label = 'Working…') {
  busy = on;
  $('maker-progress').hidden = !on;
  $('progress-label').textContent = label;
  for (const id of ['btn-generate', 'btn-use', 'btn-download', 'in-hero', 'in-powerup', 'in-sheet']) $(id).disabled = on;
}

// Upload slots (click or drag & drop)
for (const slot of ['hero', 'powerup']) {
  const drop = $(`drop-${slot}`);
  const input = $(`in-${slot}`);
  const setFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    uploads[slot] = await downscaleImage(await fileToDataUrl(file));
    const img = drop.querySelector('img');
    img.src = uploads[slot];
    img.hidden = false;
    drop.querySelector('.drop-empty').hidden = true;
  };
  input.onchange = () => setFile(input.files[0]);
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('dragover'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('dragover'); setFile(e.dataTransfer.files[0]); });
}

$('btn-generate').onclick = async () => {
  showError('');
  const heroText = $('in-hero-text').value.trim();
  const powerupText = $('in-powerup-text').value.trim();
  if (!gemini.getApiKey()) { refreshKeyNotice(); showError('Add your Gemini API key first. It’s only used in this browser.'); return; }
  if (!uploads.hero && !heroText) { showError('Give your hero a photo or a description.'); return; }
  if (!uploads.powerup && !powerupText) { showError('Give your power-up a photo or a description.'); return; }

  abort = new AbortController();
  try {
    setBusy(true, 'Choosing a background colour that won’t clash…');
    const refs = [uploads.hero, uploads.powerup].filter(Boolean);
    const keyColor = refs.length ? await pickKeyColor(refs) : { hex: '#FF00FF', name: 'pure magenta', r: 255, g: 0, b: 255 };

    setBusy(true, 'Gemini is drawing your sprites… (usually 20–40s)');
    const sheet = await gemini.generateSpritesheet({
      apiKey: gemini.getApiKey(),
      model: gemini.getModel(),
      heroImage: uploads.hero,
      powerupImage: uploads.powerup,
      heroText,
      powerupText,
      keyColor,
      signal: abort.signal,
    });

    setBusy(true, 'Cutting frames out of the sheet…');
    await showSheet(sheet, keyColor);
    $('btn-generate').textContent = '🎲 Re-roll';
  } catch (err) {
    if (err.name !== 'AbortError') showError(err.message || 'Something went wrong.');
  } finally {
    setBusy(false);
  }
};

// Re-use a sheet you saved earlier (or drew yourself). No API key needed.
$('in-sheet').onchange = async () => {
  const file = $('in-sheet').files[0];
  $('in-sheet').value = '';
  if (!file) return;
  showError('');
  try {
    setBusy(true, 'Cutting frames out of the sheet…');
    const sheet = await fileToDataUrl(file);
    await showSheet(sheet, await detectKeyColor(sheet));
  } catch (err) {
    showError(err.message || 'Could not read that sheet.');
  } finally {
    setBusy(false);
  }
};

async function showSheet(sheet, keyColor) {
  lastSheet = sheet;
  lastCells = await sliceGridSpritesheet(sheet, 5, 5, keyColor);
  const packed = packFrames(lastCells);
  animatePreview($('pv-hero'), [...packed.player.idle.slice(0, 1), ...packed.player.walk]);
  animatePreview($('pv-powered'), packed.playerPowered.walk);
  animatePreview($('pv-item'), packed.powerup);
  $('previews').hidden = false;
  $('btn-use').hidden = false;
  $('btn-download').hidden = false;
}

const previewTimers = new Map();
function animatePreview(img, frames) {
  clearInterval(previewTimers.get(img));
  let i = 0;
  img.src = frames[0];
  previewTimers.set(img, setInterval(() => { img.src = frames[++i % frames.length]; }, 160));
}

$('btn-download').onclick = () => {
  if (!lastSheet) return;
  const a = document.createElement('a');
  a.href = lastSheet;
  a.download = `${slug($('in-title').value) || 'my-hero'}-sheet.png`;
  a.click();
};

$('btn-use').onclick = async () => {
  if (!lastCells) return;
  const title = $('in-title').value.trim();
  await applyHero(lastCells, title);
  // Remember the hero for next time (frames are small; skip silently if storage is full)
  store.set(SAVED_HERO, JSON.stringify({ title, cells: lastCells }));
  closePanel();
  resetToTitle();
};

// =========================
//   Applying a custom hero to the engine
// =========================

async function applyHero(cells, title) {
  const packed = packFrames(cells);
  const load = (urls) => Promise.all(urls.map(loadImage));
  const [idle, walk, jump, pIdle, pWalk, pJump, powerup] = await Promise.all([
    load(packed.player.idle), load(packed.player.walk), load(packed.player.jump),
    load(packed.playerPowered.idle), load(packed.playerPowered.walk), load(packed.playerPowered.jump),
    load(packed.powerup),
  ]);
  S.customSprites.player = { idle, walk, jump };
  S.customSprites.playerPowered = { idle: pIdle, walk: pWalk, jump: pJump };
  S.customSprites.powerup = powerup;
  S.customSprites.enemy = null;
  S.customTitle = title || null;
  $('custom-name').textContent = title || 'your hero';
  $('custom-badge').hidden = false;
}

function clearHero() {
  S.customSprites.player = S.customSprites.playerPowered = S.customSprites.powerup = S.customSprites.enemy = null;
  S.customTitle = null;
  $('custom-badge').hidden = true;
}

async function restoreSavedHero() {
  try {
    const saved = JSON.parse(store.get(SAVED_HERO) || 'null');
    if (saved?.cells?.length === 25) await applyHero(saved.cells, saved.title);
  } catch {
    store.del(SAVED_HERO);
  }
}

// =========================
//   Helpers
// =========================

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Could not read that file.'));
    r.readAsDataURL(file);
  });
}

/** Shrink uploads to ≤512px JPEG: cheaper, faster requests and plenty of detail for 8-bit sprites. */
async function downscaleImage(dataUrl, maxDim = 512) {
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * scale));
  c.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; // flatten transparency for JPEG
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}

function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

// =========================
//   Boot
// =========================

await initLegacyGame(canvas);
await restoreSavedHero();

// Keep page chrome in sync with the engine's state machine
let lastState = null;
(function syncChrome() {
  if (S.state !== lastState) {
    lastState = S.state;
    document.body.classList.toggle('on-title', S.state === 'title');
  }
  requestAnimationFrame(syncChrome);
})();
