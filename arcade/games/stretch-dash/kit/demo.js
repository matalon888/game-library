// The first seconds play themselves (Daniel 2026-10-26: "this is how all games work"; under-1-minute players left within
// 10 s of a still screen). While nobody has touched the game, a few moves are made for the player so the screen moves and
// shows what to do; the first real touch or key press ends it for good. No dependencies, so any game can import it.
//   import { demo } from './kit/demo.js';
//   demo(n => makeOneMove(), { ready: () => state === 'play' && level === 1 });   // discrete moves: step(n) runs `max` times
//   const D = demo(null, { ready: () => state === 'play' && level === 1 });          // continuous: in the loop, if (D.on) steer...
// ready(): the game is on a playable screen where a demo move makes sense (first level, no card or menu up, nothing animating).
// wait: idle ms on that screen before the first move; every: ms between moves; max: moves at most; ms: how long D.on lasts.
// step(n) returning false ends the demo early (e.g. nothing sensible to do).
let touched = false;
for (const ev of ['pointerdown', 'touchstart', 'keydown']) addEventListener(ev, e => { if (e.isTrusted) touched = true; }, { capture: true, passive: true });

export function demo(step, { ready = () => true, wait = 2000, every = 1300, max = 3, ms = 4500 } = {}) {
  let since = 0, n = 0, t0 = 0, done = false;
  const tick = () => {
    if (done) return;
    if (touched || (step && n >= max) || (t0 && performance.now() - t0 > ms + wait)) { done = true; return clearInterval(id); }
    let ok = false; try { ok = !document.hidden && ready(); } catch (e) {}
    if (!ok) { since = 0; return; }
    const now = performance.now(); if (!since) since = now; if (!t0) t0 = now;
    if (!step || now - since < wait) return;
    since = now - wait + every; n++;
    let r; try { r = step(n); } catch (e) { r = false; }
    if (r === false) { done = true; clearInterval(id); }
  };
  const id = setInterval(tick, 100);
  return {
    // continuous demos: true while the demo is playing (idle `wait` ms on a ready screen, then for `ms`, until a real touch)
    get on() { if (done || touched || !since) return false; const a = performance.now() - since; return a >= wait && performance.now() - t0 <= ms + wait; },
    get touched() { return touched; },
    stop() { done = true; clearInterval(id); },
  };
}
// synthetic input helpers for demos that drive the game's own pointer handlers (isTrusted is false, so they never end the demo)
export function fakeTap(el, x, y) { for (const type of ['pointerdown', 'pointerup']) el.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 7, isPrimary: true, pointerType: 'touch' })); el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y })); }
export function fakeDrag(el, x0, y0, x1, y1, ms = 350, steps = 10) {
  const opt = (x, y) => ({ bubbles: true, clientX: x, clientY: y, pointerId: 7, isPrimary: true, pointerType: 'touch', buttons: 1 });
  el.dispatchEvent(new PointerEvent('pointerdown', opt(x0, y0)));
  for (let i = 1; i <= steps; i++) setTimeout(() => {
    const x = x0 + (x1 - x0) * i / steps, y = y0 + (y1 - y0) * i / steps;
    el.dispatchEvent(new PointerEvent('pointermove', opt(x, y)));
    if (i === steps) el.dispatchEvent(new PointerEvent('pointerup', opt(x1, y1)));
  }, ms * i / steps);
}
