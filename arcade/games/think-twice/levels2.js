// Think Twice! — deep v2 extras: world 4 "Plot Twist" (levels 31-40) and the one-line purpose of all 40 levels.
// Scene is 360 x 440 (SVG units). Same level shape as levels.js: q, hint, setup(S), bot (scripted solution for the checker).
import { star, shadow, btn } from './art.js';
import { sfx, tone, buzz } from './kit/hc.js';

const INK = '#2b2b2b';
const fnt = 'font-family="Baloo 2,sans-serif" font-weight="800"';
function options(S, labels, correct, y = 392, o = {}) {
  const w = o.w || 70, gap = o.gap || 14, total = labels.length * w + (labels.length - 1) * gap, map = {};
  labels.forEach((l, i) => {
    const g = S.obj(btn(l, w, o.h || 56, o.fill || '#ffd84d', o.fs || 30), 180 - total / 2 + w / 2 + i * (w + gap), y);
    S.interact(g, { tap: () => {
      g.set({ s: .9 }); g.to({ s: 1 }, 220, S.easeBack);
      if (l === correct) S.win(g._t.x, g._t.y - 80); else S.wrong(g._t.x, g._t.y - 70, o.why && o.why[l]);
    } });
    map[l] = g;
  });
  S.opts = map; return map;
}
const doorArt = (w = 130, h = 230, label = 'PULL') => `<rect x="${-w / 2 - 8}" y="${-h / 2 - 8}" width="${w + 16}" height="${h + 8}" rx="6" fill="#8a6038" class="ink"/>
  <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="4" fill="#d9a066" class="ink"/><rect x="${-w / 2 + 14}" y="${-h / 2 + 16}" width="${w - 28}" height="${h * .36}" rx="4" fill="#c58a50" class="thin"/>
  <rect x="${-w / 2 + 14}" y="${-h / 2 + h * .36 + 34}" width="${w - 28}" height="${h * .36}" rx="4" fill="#c58a50" class="thin"/>
  <rect x="${-30}" y="${-h / 2 + 4}" width="60" height="22" rx="5" fill="#fff" class="thin"/><text y="${-h / 2 + 21}" text-anchor="middle" ${fnt} font-size="17" fill="${INK}">${label}</text>`;
const handle = () => `<rect x="-6" y="-26" width="12" height="52" rx="6" fill="#ffd84d" class="ink"/><circle r="10" fill="#ffd84d" class="ink"/>`;
const elephant = () => `<ellipse cx="0" cy="-34" rx="44" ry="32" fill="#9fb0c4" class="ink"/><circle cx="-38" cy="-52" r="24" fill="#9fb0c4" class="ink"/><ellipse cx="-18" cy="-54" rx="14" ry="20" fill="#b9c8da" class="ink"/>
  <path d="M-52 -46 Q-72 -20 -64 -2" fill="none" stroke="${INK}" stroke-width="14" stroke-linecap="round"/><path d="M-52 -46 Q-72 -20 -64 -2" fill="none" stroke="#9fb0c4" stroke-width="8" stroke-linecap="round"/>
  <circle cx="-46" cy="-58" r="3" fill="${INK}"/><path d="M-26 -8 V0 M20 -8 V0" stroke="${INK}" stroke-width="14" stroke-linecap="round"/><path d="M-26 -8 V0 M20 -8 V0" stroke="#9fb0c4" stroke-width="8" stroke-linecap="round"/>`;
const WORLDS = [['Desk Doodles', '#ffd84d'], ['Kitchen Table', '#7fe3ec'], ['Rainy Town', '#ff8a9a'], ['Plot Twist', '#c7a6ff']];

export const PURPOSE = [
  'win by the obvious: the big one is off-screen', 'read the question word by word', 'the question is part of the page', 'drag the curtain: props move',
  'move the moon to change the count', 'turn the mouth itself', 'measure, never trust your eyes', 'delete a word from the question', 'a drawing can be dragged away', 'count every opening',
  'strike it on the box', 'flip the number', 'tip the jar over', 'muffle the sound', 'read the date literally', 'the clue is at the top of the page',
  'shake the tree', 'the hint button can be the answer', 'count the big square too', 'a question word stops the car', 'drag a cloud', 'look under plants',
  'read labels not pictures', 'use the magnifier', 'follow the pipes', 'two weights make nine', 'evening takes the sun', 'balls float',
  'spot the odd hair', 'BOSS: move him to reach the button',
  'patience: do nothing', 'read the sign: pull not push', 'a pattern in the first letters', 'delete "tiny" then use the box', 'timing: feel five seconds', 'breather: tickle',
  'add one line to fix the sum', 'count letters in the words', 'bait: the mouse follows cheese', 'BOSS: rug, key, door, pull'];
export { WORLDS };

export const NEW = [
// 31 --------------------------------------------------------------- patience
{ q: 'Whatever you do, do NOT press the button.', hint: 'The safest way to not press it is to <b>wait</b>.',
  setup(S) {
    S.obj(`<ellipse cy="12" rx="92" ry="22" fill="rgba(0,0,0,.14)"/><rect x="-86" y="-14" width="172" height="34" rx="14" fill="#8a8f99" class="ink"/>`, 180, 290);
    const b = S.obj(`<ellipse cy="8" rx="64" ry="24" fill="#b3202f" class="ink"/><path d="M-64 8 V-24 Q-64 -50 0 -50 Q64 -50 64 -24 V8Z" fill="#ff4458" class="ink"/><ellipse cx="-22" cy="-30" rx="18" ry="8" fill="#fff" opacity=".45"/>`, 180, 262);
    S.interact(b, { tap: () => { b.set({ sy: .8 }); b.to({ sy: 1 }, 260, S.easeBack); S.wrong(180, 220, 'It said DON\'T!'); } });
    S.tick(() => b.set({ sx: 1 + Math.sin(performance.now() / 120) * .015 }));
    const sw = S.pip('sad', 180, 410, .5); S.sweat = sw;
    S.later(2200, () => S.say('Tempting, right?', 180, 100, 1500));
    S.later(4200, () => S.say('…keep waiting…', 180, 100, 1200));
    S.later(6000, () => { S.say('Well done!', 180, 100, 900); S.win(180, 200); });
  },
  bot: [(S) => S.wait(7000)] },
// 32 --------------------------------------------------------------- pull, not push
{ q: 'Open the door.', hint: 'Read the sign on the door. It says <b>PULL</b>: drag the handle.',
  setup(S) {
    S.obj(`<rect x="-60" y="-60" width="480" height="560" fill="#f2e3cc"/><rect x="-60" y="360" width="480" height="140" fill="#cdae86" class="ink"/>`, 0, 0);
    const glow = S.obj(`<rect x="-65" y="-115" width="130" height="230" fill="#fff6c0"/><circle cx="0" cy="40" r="26" fill="#ffd84d" opacity=".0"/>`, 180, 232); glow.style.opacity = 0;
    const door = S.obj(doorArt(), 180, 232); S.door = door;
    S.interact(door, { tap: () => { door.set({ r: 0 }); S.wrong(180, 200, 'Push? Read the sign…'); } });
    const h = S.obj(handle(), 224, 240); S.handle = h;
    let open = false;
    S.interact(h, { drag: { drop: (g) => {
      if (open || Math.hypot(g._t.x - g.home.x, g._t.y - g.home.y) < 34) { if (!open) S.nope('Pull it toward you!', 180, 120); return false; }
      open = true; sfx.coin(); buzz(25); glow.style.transition = 'opacity .4s'; glow.style.opacity = 1;
      door.to({ sx: .22, x: 122 }, 500, S.easeOut); h.remove(); setTimeout(() => S.win(180, 232), 450); return true;
    } } });
  },
  bot: [(S) => S.botDrag(S.handle, 180, 300)] },
// 33 --------------------------------------------------------------- pattern of initials
{ q: 'What letter comes next?', hint: 'Say the numbers out loud: <b>One, Two, Three</b>…',
  setup(S) {
    S.obj(`<rect x="-150" y="-62" width="300" height="124" rx="10" fill="#fffdf0" class="ink" transform="rotate(-1.2)"/>`, 180, 140);
    const row = 'OTTFFSSE'.split('');
    row.forEach((c, i) => { const x = 62 + (i % 4) * 78, y = 108 + Math.floor(i / 4) * 56; const g = S.obj(`<text text-anchor="middle" y="16" ${fnt} font-size="52" fill="${['#e0485a', '#2f7fe0', '#2db36b', '#e08a1d'][i % 4]}">${c}</text>`, x, y, { r: (i % 3 - 1) * 4 }); g.to({ y: y - 3 }, 900 + i * 90, S.easeInOut); });
    options(S, ['N', 'T', 'E', 'S'], 'N', 368, { why: { T: 'Not Ten… count again', E: 'Eight is already there', S: 'Seven is already there' } });
  },
  bot: [(S) => S.botTap(S.opts['N'])] },
// 34 --------------------------------------------------------------- delete a word, then use the box
{ q: 'Fit the elephant in the {tiny:tiny} box.', hint: 'Make the box bigger: <b>drag a word</b> out of the question.',
  setup(S) {
    S.obj(`<path d="M-20 360 Q90 350 180 360 T380 360 V560 H-20Z" fill="#bfe6a0" class="ink"/>`, 0, 0);
    const box = S.obj(`<rect x="-30" y="-48" width="60" height="48" rx="4" fill="#c58a50" class="ink"/><path d="M-30 -30 H30" class="thin"/><rect x="-10" y="-48" width="20" height="14" fill="#e3b98a" class="thin"/>`, 262, 372); S.box = box;
    let grown = false;
    S.interact(box, { tap: () => S.nope(grown ? 'Now fits!' : 'Way too small!', 262, 280) });
    const el = S.obj(elephant(), 90, 392, { s: 1 }); S.el = el;
    S.interact(el, { drag: { drop: (g) => {
      const near = Math.hypot(g._t.x - 262, g._t.y - 372) < 110;
      if (!near) return true;
      if (!grown) { S.nope('He doesn\'t fit!', g._t.x, g._t.y - 90); return false; }
      g.to({ x: 262, y: 392 }, 250).then(() => { g.to({ s: .85 }, 200); S.win(262, 250); }); return true;
    } } });
    S.dragWord('tiny', { drop: (p) => {
      if (p.y < 30) return false; grown = true; sfx.coin(); buzz(20);
      box.to({ sx: 3, sy: 3 }, 600, S.easeBack); S.say('Bigger!', 262, 200, 900); return true;
    } });
  },
  bot: [(S) => S.botWord('tiny', 180, 200), (S) => S.wait(800), (S) => S.botDrag(S.el, 262, 392)] },
// 35 --------------------------------------------------------------- timing: five seconds
{ q: 'Stop the clock at exactly 5 seconds.', hint: 'The numbers vanish after 2 seconds. <b>Count in your head</b>: one-Mississippi…',
  setup(S) {
    let t0 = performance.now(); S.t0 = () => t0;
    S.obj(`<circle r="104" fill="#fffdf0" class="ink"/><circle r="92" fill="none" stroke="#e0485a" stroke-width="3" stroke-dasharray="3 12"/><rect x="-12" y="-128" width="24" height="22" rx="5" fill="#8a8f99" class="ink"/>`, 180, 168);
    const txt = S.obj(`<text text-anchor="middle" y="18" ${fnt} font-size="64" fill="${INK}">0.00</text>`, 180, 168), tx = txt.firstElementChild;
    const hand = S.obj(`<path d="M0 8 L0 -80" stroke="#e0485a" stroke-width="5" stroke-linecap="round"/><circle r="7" fill="#e0485a"/>`, 180, 168);
    S.tick(() => { const e = (performance.now() - t0) / 1000; tx.textContent = e < 2 ? e.toFixed(2) : '?.??'; hand.set({ r: (e % 5) / 5 * 360 }); });
    const b = S.obj(btn('STOP', 150, 62, '#ff8a9a', 34), 180, 372);
    S.interact(b, { tap: () => {
      const e = (performance.now() - t0) / 1000; b.set({ s: .92 }); b.to({ s: 1 }, 200, S.easeBack); tx.textContent = e.toFixed(2);
      if (Math.abs(e - 5) <= .4) { S.say(e.toFixed(2) + ' s', 180, 70, 900); S.win(180, 250); }
      else { S.wrong(180, 270, e.toFixed(2) + ' — ' + (e < 5 ? 'too early' : 'too late')); t0 = performance.now(); }
    } });
    S.b = b; S.elapsed = () => (performance.now() - t0) / 1000;
  },
  bot: [(S) => S.elapsed() < 4.97 ? false : S.botTap(S.b)] },
// 36 --------------------------------------------------------------- breather: tickle
{ q: 'Make him laugh.', hint: 'Grab the <b>feather</b> and find his ticklish spot.',
  setup(S) {
    S.obj(`<rect x="-60" y="330" width="480" height="200" fill="#e8c9a0" class="ink"/><rect x="220" y="150" width="100" height="120" rx="6" fill="#ffe27a" class="ink"/><text x="270" y="190" text-anchor="middle" class="hand" font-size="20" fill="${INK}">Knock</text><text x="270" y="214" text-anchor="middle" class="hand" font-size="20" fill="${INK}">knock…</text>`, 0, 0);
    const p = S.pip('neutral', 120, 410, 1); S._pip = p;
    const f = S.obj(`<path d="M0 22 Q-30 -4 -4 -42 Q6 -30 14 -24 Q26 -4 0 22Z" fill="#ff8a9a" class="ink"/><path d="M0 24 V-34" stroke="${INK}" stroke-width="3"/>`, 290, 320); S.feather = f;
    S.interact(f, { drag: { drop: (g) => {
      if (Math.hypot(g._t.x - 120, g._t.y - 400) > 85) return true;
      p.mood('happy'); sfx.coin(); buzz([20, 30, 20, 30, 20]);
      let n = 0; S.every(110, () => { n++; p.set({ r: (n % 2 ? 1 : -1) * 4 }); if (n === 3) S.say('HA HA HA!', 150, 190, 1000); if (n > 8) { S.win(120, 300); } });
      return true;
    } } });
    S.interact(p, { tap: () => S.nope('Straight face…', 120, 230) });
  },
  bot: [(S) => S.botDrag(S.feather, 120, 400), (S) => S.wait(1500)] },
// 37 --------------------------------------------------------------- add one line
{ q: 'Add ONE line to make it true.', hint: 'Turn the first <b>+</b> into a <b>4</b>: 545 + 5 = 550.',
  setup(S) {
    S.obj(`<rect x="-160" y="-52" width="320" height="104" rx="12" fill="#2f4a3f" class="ink"/>`, 180, 150);
    const cs = ['5', '+', '5', '+', '5', '=', '5', '5', '0'];
    cs.forEach((c, i) => S.obj(`<text text-anchor="middle" y="18" ${fnt} font-size="54" fill="#fffdf0">${c}</text>`, 44 + i * 34, 150));
    let done = false, line = null;
    const stick = S.obj(`<rect x="-4" y="-34" width="8" height="68" rx="4" fill="#fff" class="ink"/>`, 180, 330); S.stick = stick;
    S.interact(stick, { drag: { drop: (g) => {
      if (done) return true;
      const d = (i) => Math.hypot(g._t.x - (44 + i * 34), g._t.y - 150);
      if (d(1) < 38) { done = true; sfx.coin(); buzz(20); g.set({ x: 78, y: 138, s: .78 }); S.say('545 + 5 = 550!', 180, 60, 900); setTimeout(() => S.win(180, 240), 300); return true; }
      if (cs.some((c, i) => i !== 1 && d(i) < 30)) { S.wrong(g._t.x, g._t.y - 40, 'Not there…'); return false; }
      return false;
    } } });
  },
  bot: [(S) => S.botDrag(S.stick, 78, 150)] },
// 38 --------------------------------------------------------------- count the letters of the words
{ q: 'How many letters are in "the alphabet"?', hint: 'Not the whole alphabet: just the <b>two words</b> in quotes.',
  setup(S) {
    S.obj(`<rect x="-150" y="-60" width="300" height="120" rx="10" fill="#2f4a3f" class="ink"/><rect x="-150" y="52" width="300" height="12" rx="4" fill="#b98a5e" class="ink"/>`, 180, 150);
    S.obj(`<text text-anchor="middle" y="14" ${fnt} font-size="40" fill="#fffdf0" letter-spacing="3">THE ALPHABET</text>`, 180, 150);
    options(S, ['9', '11', '24', '26'], '11', 368, { why: { 26: 'That is the whole alphabet!' } });
  },
  bot: [(S) => S.botTap(S.opts['11'])] },
// 39 --------------------------------------------------------------- bait
{ q: 'Catch the mouse.', hint: 'Mice follow their <b>nose</b>. Put the cheese in the trap.',
  setup(S) {
    S.obj(`<path d="M-20 372 Q90 362 180 372 T380 372 V560 H-20Z" fill="#cdae86" class="ink"/>`, 0, 0);
    const trap = S.obj(`<rect x="-34" y="-8" width="68" height="14" rx="4" fill="#b98a5e" class="ink"/><path d="M-30 -8 Q0 -30 30 -8" fill="none" stroke="#8a8f99" stroke-width="6" stroke-linecap="round"/>`, 288, 388); S.trap = trap;
    const mouse = S.obj(`<ellipse rx="22" ry="14" fill="#c9ccd6" class="ink"/><circle cx="-18" cy="-8" r="8" fill="#c9ccd6" class="ink"/><circle cx="20" cy="-4" r="4" fill="#ff8a9a" class="thin"/><circle cx="-24" cy="-2" r="2.6" fill="${INK}"/><path d="M22 4 Q40 14 48 2" fill="none" stroke="${INK}" stroke-width="3"/>`, 70, 386); S.mouse = mouse;
    const cheese = S.obj(`<path d="M-22 10 L22 10 L22 -4 Q0 -22 -22 -4Z" fill="#ffd84d" class="ink"/><circle cx="-6" cy="2" r="3" fill="#e0a400"/><circle cx="10" cy="-2" r="2.4" fill="#e0a400"/>`, 150, 170); S.cheese = cheese;
    let held = false, baited = false, over = false;
    S.interact(mouse, { tap: () => { mouse.to({ x: Math.max(40, mouse._t.x - 50) }, 160); S.nope('Too quick!', mouse._t.x, 320); } });
    S.interact(cheese, { drag: { start: () => { held = true; baited = false; }, drop: (g) => {
      held = false;
      if (Math.hypot(g._t.x - 288, g._t.y - 378) < 46) { baited = true; g.set({ x: 288, y: 378 }); sfx.pick(2); }
      return true;
    } } });
    S.tick((dt) => {
      if (over || held || cheese._t.y < 300) return;
      const dx = cheese._t.x - mouse._t.x;
      if (Math.abs(dx) > 12) { mouse.set({ x: mouse._t.x + Math.sign(dx) * 2.6 * dt, sx: dx < 0 ? 1 : -1, y: 386 + Math.sin(performance.now() / 40) * 1.2 }); return; }
      over = true;
      if (baited) { sfx.fail(); trap.to({ s: 1.12 }, 120); buzz(40); mouse.to({ r: 90 }, 120); S.say('SNAP!', 288, 330, 900); setTimeout(() => S.win(288, 330), 350); }
      else { cheese.remove(); S.wrong(mouse._t.x, 340, 'Nom nom… too easy for him!'); mouse.to({ x: 70 }, 400); over = true; setTimeout(() => S.alive && S.say('Use the trap!', 200, 120, 1300), 900); }
    });
  },
  bot: [(S) => S.botDrag(S.cheese, 288, 378), (S) => S.wait(4200)] },
// 40 --------------------------------------------------------------- BOSS: escape
{ q: 'Escape the room!', hint: 'Look <b>under</b> the rug. Use the key on the lock. Then read the door.',
  setup(S) {
    S.obj(`<rect x="-60" y="-60" width="480" height="560" fill="#e6d3f0"/><rect x="-60" y="372" width="480" height="140" fill="#b9946a" class="ink"/>`, 0, 0);
    const glow = S.obj(`<rect x="-55" y="-95" width="110" height="190" fill="#fff6c0"/>`, 180, 252); glow.style.opacity = 0;
    const door = S.obj(doorArt(110, 190, 'PULL'), 180, 252); S.door = door;
    const lock = S.obj(`<rect x="-14" y="-12" width="28" height="30" rx="5" fill="#8a8f99" class="ink"/><path d="M-8 -12 V-20 Q0 -32 8 -20 V-12" fill="none" stroke="#8a8f99" stroke-width="6"/><circle cy="2" r="4" fill="${INK}"/>`, 226, 252); S.lock = lock;
    let unlocked = false, open = false;
    S.interact(door, { tap: () => { if (open) return; if (!unlocked) S.nope('Locked tight.', 180, 130); else S.wrong(180, 200, 'Push? Read the sign…'); } });
    const key = S.obj(`<circle cx="-12" r="9" fill="#ffc83d" class="ink"/><circle cx="-12" r="3" fill="#e6d3f0" class="thin"/><path d="M-3 0 H18 M12 0 V7" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M-3 0 H18 M12 0 V7" stroke="#ffc83d" stroke-width="4" stroke-linecap="round"/>`, 100, 420); key.style.opacity = 0; key._off = true; S.key = key;
    S.interact(key, { drag: { drop: (g) => {
      if (Math.hypot(g._t.x - 226, g._t.y - 252) < 56) { unlocked = true; sfx.coin(); buzz(20); lock.remove(); g.remove(); S.say('Click!', 226, 200, 800); return true; }
      return true;
    } } });
    const rug = S.obj(`<ellipse rx="64" ry="22" fill="#e0485a" class="ink"/><ellipse rx="44" ry="13" fill="none" stroke="#ffd84d" stroke-width="3" stroke-dasharray="4 6"/>`, 100, 420); S.rug = rug;
    S.interact(rug, { drag: { axis: 'x', clamp: (x, y) => [Math.max(60, Math.min(300, x)), y], drop: (g) => { if (Math.abs(g._t.x - 100) > 45 && key._off) { key._off = false; key.style.transition = 'opacity .3s'; key.style.opacity = 1; sfx.pick(3); } return true; } } });
    const h = S.obj(handle(), 214, 262, { s: .8 }); S.handle = h;
    S.interact(h, { drag: { drop: (g) => {
      if (open) return true;
      if (Math.hypot(g._t.x - g.home.x, g._t.y - g.home.y) < 34) return false;
      if (!unlocked) { S.nope('Locked!', 180, 130); return false; }
      open = true; sfx.coin(); buzz(25); glow.style.transition = 'opacity .4s'; glow.style.opacity = 1; door.to({ sx: .22, x: 130 }, 500, S.easeOut); h.remove(); setTimeout(() => S.win(180, 250), 450); return true;
    } } });
    S.pipG = S.pip('neutral', 300, 420, .55);
  },
  bot: [(S) => S.botDrag(S.rug, 240, 420), (S) => S.wait(500), (S) => S.botDrag(S.key, 226, 252), (S) => S.wait(300), (S) => S.botDrag(S.handle, 180, 330)] },
];
