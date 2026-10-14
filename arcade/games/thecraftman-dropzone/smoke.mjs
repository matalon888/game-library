// Runtime smoke test for Stormfall Royale.
// Usage: node smoke.mjs
// Loads the real game scripts under a stub DOM/canvas, simulates input,
// and drives a full simulated match to verify: boot -> menu -> countdown ->
// play -> bots fight -> storm shrinks -> match ends, with zero exceptions.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?:\s+id="([^"]*)")?>([\s\S]*?)<\/script>/g)]
  .map((m) => ({ id: m[1] || 'main', code: m[2] }));
const src = scripts.map((s) => s.code).join('\n;\n');

// ---------- stub canvas 2d context ----------
function makeCtx() {
  const noop = () => {};
  return new Proxy({}, {
    get(t, k) {
      if (k === 'createPattern') return () => ({});
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => ({ addColorStop: noop });
      if (k === 'measureText') return () => ({ width: 10 });
      if (typeof k === 'string') return t[k] !== undefined ? t[k] : noop;
      return noop;
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

// ---------- stub DOM ----------
class ClassList {
  constructor(initial) { this.s = new Set(initial || []); }
  add(c) { this.s.add(c); }
  remove(c) { this.s.delete(c); }
  toggle(c, force) {
    if (force === undefined) { this.s.has(c) ? this.s.delete(c) : this.s.add(c); }
    else if (force) this.s.add(c); else this.s.delete(c);
  }
  contains(c) { return this.s.has(c); }
}

function makeEl(id, initialClasses) {
  const el = {
    id, style: {}, textContent: '', _innerHTML: '', children: [], parentNode: null,
    get innerHTML() { return this._innerHTML; },
    set innerHTML(v) {
      this._innerHTML = v;
      if (v === '') { for (const c of this.children) c.parentNode = null; this.children.length = 0; }
    },
    classList: new ClassList(initialClasses),
    handlers: {},
    addEventListener(type, fn) { (this.handlers[type] = this.handlers[type] || []).push(fn); },
    prepend(child) { this.children.unshift(child); child.parentNode = this; },
    removeChild(child) {
      const i = this.children.indexOf(child);
      if (i >= 0) this.children.splice(i, 1);
      child.parentNode = null;
    },
    get lastChild() { return this.children.length ? this.children[this.children.length - 1] : null; },
    click() { (this.handlers.click || []).forEach((f) => f({})); },
  };
  return el;
}

function makeCanvas(id) {
  const el = makeEl(id);
  el.width = 300; el.height = 300;
  el.getContext = () => makeCtx();
  return el;
}

const HIDDEN_AT_BOOT = ['end', 'prompt', 'toast', 'centerText', 'stormNotice'];
const els = {};
for (const id of ['aliveNum', 'killsNum', 'stormK', 'stormV', 'stormPill', 'hpFill', 'hpNum', 'shFill', 'shNum',
  'ammoNum', 'matsNum', 'slot1', 'slot2', 'gunName', 'gunSub', 'killfeed', 'prompt', 'toast',
  'centerText', 'stormNotice', 'menu', 'end', 'endTitle', 'endStats', 'btnPlay', 'btnAgain']) {
  els[id] = makeEl(id, HIDDEN_AT_BOOT.includes(id) ? ['hidden'] : []);
}
els.c = makeCanvas('c');
els.mm = makeCanvas('mm');

const documentStub = {
  getElementById: (id) => els[id] || null,
  createElement: (tag) => (tag === 'canvas' ? makeCanvas('') : makeEl('')),
};

let rafQ = [];
const windowStub = {
  innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
  handlers: {},
  addEventListener(type, fn) { (this.handlers[type] = this.handlers[type] || []).push(fn); },
  AudioContext: undefined, webkitAudioContext: undefined,
};
const raf = (cb) => { rafQ.push(cb); return rafQ.length; };

function fireWindow(type, ev) {
  ev.preventDefault = ev.preventDefault || (() => {});
  (windowStub.handlers[type] || []).forEach((f) => f(ev));
}
function fireCanvas(type, ev) {
  ev.preventDefault = ev.preventDefault || (() => {});
  (els.c.handlers[type] || []).forEach((f) => f(ev));
}

// ---------- load the game ----------
let pass = 0, fail = 0;
function t(name, cond) {
  if (cond) { pass++; console.log('  ok: ' + name); }
  else { fail++; console.error('  FAIL: ' + name); }
}

try {
  new Function('window', 'document', 'requestAnimationFrame', 'module', src)(
    windowStub, documentStub, raf, undefined
  );
  t('game boots without throwing', true);
} catch (e) {
  t('game boots without throwing (' + e.message + ')', false);
  console.error(e);
  process.exit(1);
}

// ---------- drive frames ----------
let now = 0;
let frameErr = null;
function step(ms) {
  now += ms;
  const q = rafQ; rafQ = [];
  for (const cb of q) {
    try { cb(now); } catch (e) { if (!frameErr) frameErr = e; }
  }
}

// Menu is showing; world rendered behind it.
step(16); step(16);
t('menu visible at boot', !els.menu.classList.contains('hidden'));
t('alive counter initialized to 24', els.aliveNum.textContent === '24' || els.aliveNum.textContent === 24);

// Start the match with Enter.
fireWindow('keydown', { key: 'Enter' });
step(16);
t('menu hidden after Enter', els.menu.classList.contains('hidden'));
t('countdown showing', !els.centerText.classList.contains('hidden'));

// R during the countdown must restart cleanly (menu stays hidden, countdown restarts).
fireWindow('keydown', { key: 'r' });
fireWindow('keyup', { key: 'r' });
step(16);
t('R during countdown restarts into a fresh countdown', els.menu.classList.contains('hidden') && !els.centerText.classList.contains('hidden'));

// Blur must release held keys (no auto-run after refocus).
fireWindow('keydown', { key: 'w' });
fireWindow('blur', {});

// Run out the 3s countdown (dt is clamped to 50ms per frame).
for (let i = 0; i < 80; i++) step(50);
t('countdown finished', els.centerText.classList.contains('hidden'));

// Hold movement + attack, poke every keybinding once.
fireWindow('keydown', { key: 'w' });
fireWindow('keydown', { key: 'd' });
fireCanvas('mousemove', { clientX: 900, clientY: 200 });
fireCanvas('mousedown', { button: 0 });   // swing pickaxe repeatedly
fireWindow('keydown', { key: ' ' });      // Space also fires/swings
fireWindow('keydown', { key: 'q' });      // build attempt (no mats -> toast path)
fireWindow('keydown', { key: 'e' });      // swap attempt (no gun nearby)
fireWindow('keydown', { key: '2' });      // no gun -> ignored
fireWindow('keydown', { key: '1' });
fireWindow('keydown', { key: 'm' });      // mute toggle
fireWindow('keydown', { key: 'm' });
fireWindow('keydown', { key: 'p' });      // pause
step(50); step(50);
const aliveWhilePaused = els.aliveNum.textContent;
for (let i = 0; i < 20; i++) step(50);
t('pause freezes the sim', els.aliveNum.textContent === aliveWhilePaused);
fireWindow('keydown', { key: 'p' });      // unpause

// Simulate up to 400s of match. Idle-ish player should eventually die to
// the storm, or win if bots die faster; either way the match must END.
let sawFewerAlive = false, sawHpDrop = false, ended = false, endAt = 0;
for (let i = 0; i < 8000; i++) {
  step(50);
  const alive = Number(els.aliveNum.textContent);
  if (alive < 24) sawFewerAlive = true;
  if (Number(els.hpNum.textContent) < 100) sawHpDrop = true;
  if (!els.end.classList.contains('hidden')) { ended = true; endAt = i * 0.05; break; }
}
t('no exception during ' + (ended ? endAt.toFixed(0) : 400) + 's of simulated match', frameErr === null);
if (frameErr) console.error(frameErr);
t('bots eliminated each other (alive dropped below 24)', sawFewerAlive);
t('player took damage at some point', sawHpDrop);
t('match reached an end screen', ended);
t('end screen names a placement or victory', /#\d+|Champion/i.test(els.endTitle.textContent + els.endTitle.innerHTML + els.endStats.innerHTML));

// Restart from the end screen and confirm a fresh match starts.
fireWindow('keydown', { key: 'r' });
step(16);
t('restart hides end screen', els.end.classList.contains('hidden'));
t('restart resets alive counter to 24', Number(els.aliveNum.textContent) === 24);
t('restart resets kill feed', els.killfeed.children.length === 0);
for (let i = 0; i < 100; i++) step(50);
t('restarted match runs without exception', frameErr === null);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
