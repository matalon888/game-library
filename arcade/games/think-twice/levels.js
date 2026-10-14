// Think Twice! — 30 original trick puzzles. Scene is 360 x 440 (SVG units).
// Each level: q (question; {id:text} = interactive word), hint, setup(S), bot (scripted solution steps for the checker).
import { pip, pipHead, star, cloud, sun, shadow, ground, table, btn, coin, SKIN, HAIR } from './art.js';
import { sfx, tone, buzz } from './kit/hc.js';

const INK = '#2b2b2b';
const pop = () => { tone(900, 0.06, 'square', 0.08, 0.3); tone(200, 0.12, 'sawtooth', 0.05, 0.4); };

// ---------------------------------------------------------------- shared helpers
function options(S, labels, correct, y = 392, o = {}) {
  const w = o.w || 70, gap = o.gap || 14, total = labels.length * w + (labels.length - 1) * gap, map = {};
  labels.forEach((l, i) => {
    const g = S.obj(btn(l, w, o.h || 56, o.fill || '#ffd84d', o.fs || 30), 180 - total / 2 + w / 2 + i * (w + gap), y);
    S.interact(g, { tap: () => {
      g.set({ s: .9 }); g.to({ s: 1 }, 220, S.easeBack);
      if (l === correct) { o.onRight ? o.onRight(g) : S.win(g._t.x, g._t.y - 80); } else S.wrong(g._t.x, g._t.y - 70, o.why && o.why[l]);
    } });
    map[l] = g;
  });
  S.opts = map; return map;
}
const ball = {
  beach: (r) => `<circle r="${r}" fill="#fff" class="ink"/><path d="M0 ${-r} Q${-r * .55} 0 0 ${r} Q${-r * 1.05} 0 0 ${-r}Z" fill="#ff5d6c"/><path d="M0 ${-r} Q${r * .55} 0 0 ${r} Q${r * 1.05} 0 0 ${-r}Z" fill="#3fa9f5"/>
    <circle r="${r}" fill="none" class="ink"/><path d="M0 ${-r} Q${-r * .55} 0 0 ${r} M0 ${-r} Q${r * .55} 0 0 ${r}" fill="none" class="thin"/><circle r="${r * .18}" cy="${-r * .1}" fill="#ffd84d" class="thin"/>`,
  tennis: (r) => `<circle r="${r}" fill="#d9ef4a" class="ink"/><path d="M${-r * .9} ${-r * .4} Q0 ${-r * .1} ${-r * .4} ${r * .9} M${r * .9} ${r * .4} Q0 ${r * .1} ${r * .4} ${-r * .9}" fill="none" stroke="#fff" stroke-width="3"/>`,
  basket: (r) => `<circle r="${r}" fill="#ff8a3d" class="ink"/><path d="M${-r} 0 H${r} M0 ${-r} V${r} M${-r * .7} ${-r * .7} Q${-r * .2} 0 ${-r * .7} ${r * .7} M${r * .7} ${-r * .7} Q${r * .2} 0 ${r * .7} ${r * .7}" fill="none" class="thin"/>`,
  marble: (r) => `<circle r="${r}" fill="#7fd0ff" class="ink"/><circle cx="${-r * .35}" cy="${-r * .35}" r="${r * .3}" fill="#fff" opacity=".8"/>`,
};
const balloonArt = (c) => `<path d="M0 34 Q-8 60 4 80 Q12 96 2 116" fill="none" stroke="${INK}" stroke-width="2"/><path d="M-6 38 L6 38 L0 31Z" fill="${c}" class="thin"/>
  <ellipse rx="27" ry="33" fill="${c}" class="ink"/><ellipse cx="-10" cy="-12" rx="6" ry="10" fill="#fff" opacity=".55" transform="rotate(20 -10 -12)"/>`;
function burstAt(S, x, y, col) {
  const g = S.obj(`<g>${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = i * Math.PI / 4; return `<path d="M${Math.cos(a) * 14} ${Math.sin(a) * 14} L${Math.cos(a) * 30} ${Math.sin(a) * 30}" stroke="${col}" stroke-width="5" stroke-linecap="round"/>`; }).join('')}</g>`, x, y, { parent: S.fx, s: .5 });
  g.to({ s: 1.4 }, 300).then(() => g.remove());
}
const head = (flip, s = 1) => pipHead('happy', flip, s);

export const LEVELS = [
// 1 ---------------------------------------------------------------
{ q: 'Tap the biggest ball.', hint: 'Look at the <b>bottom</b> of the page. Some balls are too big to fit!',
  setup(S) {
    const big = S.obj(`<circle r="560" fill="#ff8a3d" class="ink"/><path d="M0 -560 V560 M-560 0 H560" stroke="${INK}" stroke-width="4" fill="none"/>
      <path d="M-330 -452 Q-120 -300 -230 0 M330 -452 Q120 -300 230 0" stroke="${INK}" stroke-width="4" fill="none"/><ellipse cx="-160" cy="-520" rx="70" ry="14" fill="#ffb27a" opacity=".7"/>`, 180, 905);
    S.big = big; S.interact(big, { tap: () => S.win(180, 300) });
    const bs = [['tennis', 26, 76, 150], ['beach', 46, 208, 118], ['basket', 34, 290, 232], ['marble', 13, 128, 262]];
    for (const [k, r, x, y] of bs) { const g = S.obj(shadow(r * .9, 5, r + 12) + ball[k](r), x, y); S.interact(g, { tap: () => S.wrong(x, y) }); g.to({ y: y - 6 }, 900 + r * 10, S.easeInOut); }
  },
  bot: [(S) => S.botTap(S.big)] },
// 2 ---------------------------------------------------------------
{ q: 'Tap the number {seven:7}.', hint: 'Read the question really carefully…',
  setup(S) {
    const nums = [1, 2, 3, 4, 5, 6, 8, 9, 1, 4], cols = ['#ffd84d', '#7fe3ec', '#ff8a9a', '#8fe3a8', '#c7a6ff'];
    nums.forEach((n, i) => {
      const x = 60 + (i % 3) * 120 + ((i * 37) % 30) - 15, y = 60 + Math.floor(i / 3) * 95 + ((i * 53) % 24);
      const g = S.obj(`<circle r="34" fill="${cols[i % 5]}" class="ink"/><text y="15" text-anchor="middle" font-family="Baloo 2" font-weight="800" font-size="44" fill="${INK}">${n}</text>`, x, y, { r: ((i * 29) % 30) - 15 });
      S.interact(g, { tap: () => S.wrong(g._t.x, g._t.y, 'That\'s a ' + n + '!') });
    });
    S.tapWord('seven', (s) => { s.style.color = '#2db36b'; S.win(180, 160); });
  },
  bot: [(S) => S.word('seven')._tap(S.word('seven'))] },
// 3 ---------------------------------------------------------------
{ q: 'Pop all the ball{o1:o:balloon}{o2:o:balloon}ns!', hint: 'Two more balloons are hiding in the <b>question</b>.',
  setup(S) {
    let left = 6; const done = () => { left--; if (left === 0) S.win(180, 200); else if (left === 2) S.say('Hmm… 2 more somewhere!', 180, 60, 1500); };
    S.balloons = [['#ff5d6c', 80, 150], ['#3fa9f5', 170, 110], ['#ffd84d', 255, 165], ['#8fe3a8', 140, 245]].map(([c, x, y], i) => {
      const g = S.obj(balloonArt(c), x, y); g.to({ y: y - 10 }, 1100 + i * 170, S.easeInOut);
      S.tick(() => { if (!g._popped) g.set({ r: Math.sin(performance.now() / 600 + i) * 4 }); });
      S.interact(g, { tap: () => { if (g._popped) return; g._popped = true; pop(); buzz(25); burstAt(S, g._t.x, g._t.y, c); g.remove(); done(); } });
      return g;
    });
    for (const id of ['o1', 'o2']) S.tapWord(id, (s) => { if (s.classList.contains('popped')) return; s.classList.add('popped'); pop(); buzz(25); done(); });
  },
  bot: [(S) => S.botTap(S.balloons[0]), (S) => S.botTap(S.balloons[1]), (S) => S.botTap(S.balloons[2]), (S) => S.botTap(S.balloons[3]),
    (S) => S.word('o1')._tap(S.word('o1')), (S) => S.word('o2')._tap(S.word('o2'))] },
// 4 ---------------------------------------------------------------
{ q: 'Wake him up!', hint: 'Nothing wakes you up like <b>morning sunlight</b>.',
  setup(S) {
    S.obj(`<rect x="-82" y="-66" width="164" height="132" rx="6" fill="#bde8ff" class="ink"/>${'<g transform="translate(30,-14)">' + sun(22) + '</g>'}<g transform="translate(-40,30)">${cloud(.45)}</g>
      <path d="M0 -66 V66 M-82 0 H82" stroke="#fff" stroke-width="8"/><path d="M0 -66 V66 M-82 0 H82" class="thin" fill="none"/><rect x="-82" y="-66" width="164" height="132" rx="6" fill="none" class="ink"/>
      <path d="M-104 -74 H104" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>`, 180, 118);
    const beam = S.obj(`<path d="M-80 -50 L80 -50 L150 230 L-170 230Z" fill="#fff2a8" opacity=".55"/>`, 180, 170, { s: 1 }); beam.style.opacity = 0; S.beam = beam;
    const curtain = (dir) => `<path d="M-40 -84 H40 V64 Q20 76 0 64 Q-20 76 -40 64Z" fill="#ff8a9a" class="ink"/><path d="M-20 -80 V62 M0 -80 V60 M20 -80 V62" stroke="#e86a7c" stroke-width="3"/><circle cx="${dir * -34}" cy="-84" r="6" fill="#ffd84d" class="thin"/>`;
    let opened = false;
    const mk = (x, dir) => { const g = S.obj(curtain(dir), x, 126); S.interact(g, { drag: { axis: 'x', clamp: (nx, ny) => [Math.max(dir < 0 ? x - 100 : x, Math.min(dir < 0 ? x : x + 100, nx)), ny],
      drop: (g) => { if (!opened && Math.abs(g._t.x - x) > 45) { opened = true; wake(); } return true; } } }); return g; };
    // bed + sleeper
    S.obj(`<rect x="-130" y="-6" width="260" height="56" rx="10" fill="#b98a5e" class="ink"/><rect x="-140" y="-56" width="22" height="120" rx="8" fill="#9c6e44" class="ink"/><rect x="118" y="-24" width="22" height="88" rx="8" fill="#9c6e44" class="ink"/>
      <rect x="-118" y="-30" width="62" height="30" rx="14" fill="#fff" class="ink"/>`, 180, 340);
    const p = S.pip('sleep', 206, 314, .58, { r: -90 }); S._pip = p;
    S.obj(`<path d="M-34 -26 Q30 -40 116 -22 L118 26 L-36 26Z" fill="#7fb8ff" class="ink"/><path d="M-6 -30 L-4 24 M10 -33 L12 24 M50 -32 L52 24 M88 -28 L90 24" stroke="#5f9be6" stroke-width="3"/>`, 180, 336);
    S.curL = mk(138, -1); S.curR = mk(222, 1);
    const z = S.obj(`<text class="hand" font-size="30" fill="#7f8fa6">z<tspan font-size="22" dy="-12">z</tspan><tspan font-size="16" dy="-10">z</tspan></text>`, 92, 236);
    S.tick(() => { const t = performance.now() / 700; z.set({ y: 236 - (t % 1) * 16, s: .8 + (t % 1) * .3 }); z.style.opacity = opened ? 0 : 1 - (t % 1) * .6; });
    const clock = S.obj(`<circle r="20" fill="#ffd84d" class="ink"/><circle r="13" fill="#fff" class="thin"/><path d="M0 -8 V0 L6 3" class="thin" fill="none"/><path d="M-14 -16 l-6 -6 M14 -16 l6 -6" class="ink"/>`, 316, 286);
    S.interact(clock, { tap: () => { S.say('RIIING! …still asleep', 260, 246); tone(1500, .05, 'square', .05, 1); clock.set({ r: 12 }); clock.to({ r: 0 }, 300, S.easeBack); } });
    S.interact(p, { tap: () => S.nope('Zzz… 5 more minutes', 140, 230) });
    async function wake() { sfx.coin(); beam.style.transition = 'opacity .5s'; beam.style.opacity = 1; await S.wait(450); p.mood('wow'); await S.wait(450); p.mood('happy'); S.win(180, 230); }
  },
  bot: [(S) => S.botDrag(S.curL, 50, 126)] },
// 5 ---------------------------------------------------------------
{ q: 'How many stars are there?', hint: 'Something in the sky can be <b>moved</b>.',
  setup(S) {
    S.obj(`<rect x="0" y="0" width="330" height="310" rx="18" fill="#28305c" class="ink"/><circle cx="60" cy="250" r="2" fill="#fff" opacity=".5"/><circle cx="280" cy="270" r="2" fill="#fff" opacity=".5"/><circle cx="150" cy="40" r="1.6" fill="#fff" opacity=".5"/>`, 15, 10);
    const pts = [[60, 60], [140, 110], [80, 190], [190, 230], [300, 210], [130, 285], [252, 92]];
    pts.forEach(([x, y], i) => { const g = S.obj(star(15), x, y); S.tick(() => g.set({ s: 1 + Math.sin(performance.now() / 300 + i * 1.7) * .08 })); });
    const moon = S.obj(`<circle r="46" fill="#fff3c4" class="ink"/><circle cx="-14" cy="-10" r="9" fill="#f3e2a4"/><circle cx="16" cy="12" r="6" fill="#f3e2a4"/><circle cx="8" cy="-22" r="4" fill="#f3e2a4"/>`, 252, 92);
    S.moon = moon; S.interact(moon, { drag: { clamp: (x, y) => [Math.max(30, Math.min(330, x)), Math.max(30, Math.min(300, y))], drop: () => true } });
    options(S, ['5', '6', '7', '8'], '7', 384);
  },
  bot: [(S) => S.botDrag(S.moon, 250, 270), (S) => S.botTap(S.opts['7'])] },
// 6 ---------------------------------------------------------------
{ q: 'Turn his {frown:frown} upside down.', hint: 'Take it literally. Turn the <b>mouth</b> itself.',
  setup(S) {
    const h = S.obj(pipHead('none', false, 2.3), 180, 250);
    // face drawn separately so the mouth is its own piece
    const eyes = S.obj(`<g class="e"><ellipse cx="-27" cy="-8" rx="8" ry="11" fill="${INK}"/><ellipse cx="27" cy="-8" rx="8" ry="11" fill="${INK}"/><path d="M-44 -34 l20 8 M44 -34 l-20 8" stroke="${INK}" stroke-width="6" stroke-linecap="round"/></g>`, 180, 250);
    const mouth = S.obj(`<rect x="-34" y="-20" width="68" height="34" fill="transparent"/><path d="M-26 8 Q0 -16 26 8" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>`, 180, 302);
    S.mouth = mouth; let done = false;
    S.interact(h, { tap: (g, p) => S.nope('Hmph.', p.x, p.y - 30) });
    S.interact(mouth, { tap: async () => {
      if (done) return; done = true; await mouth.to({ r: 180, s: 1.3 }, 420, S.easeBack);
      eyes.querySelector('.e').innerHTML = `<path d="M-40 -6 q13 -16 26 0 M14 -6 q13 -16 26 0" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><ellipse cx="-46" cy="20" rx="13" ry="7" fill="#ff9f9f"/><ellipse cx="46" cy="20" rx="13" ry="7" fill="#ff9f9f"/>`;
      S.win(180, 120);
    } });
  },
  bot: [(S) => S.botTap(S.mouth)] },
// 7 ---------------------------------------------------------------
{ q: 'Which line is longer?', hint: 'Don\'t trust your eyes. <b>Measure</b>.',
  setup(S) {
    S.obj(`<path d="M80 110 H280 M80 110 l24 -22 M80 110 l24 22 M280 110 l-24 -22 M280 110 l-24 22" stroke="#3fa9f5" stroke-width="8" stroke-linecap="round" fill="none"/>
      <text x="40" y="120" class="hand" font-size="32" fill="${INK}">A</text>`, 0, 0);
    S.obj(`<path d="M80 240 H280 M80 240 l-24 -22 M80 240 l-24 22 M280 240 l24 -22 M280 240 l24 22" stroke="#ff5d6c" stroke-width="8" stroke-linecap="round" fill="none"/>
      <text x="22" y="250" class="hand" font-size="32" fill="${INK}">B</text>`, 0, 0);
    const guides = S.obj(`<path d="M80 70 V285 M280 70 V285" stroke="#2db36b" stroke-width="3" stroke-dasharray="7 6"/>`, 0, 0); guides.style.opacity = 0;
    options(S, ['A', 'B', 'Same'], 'Same', 380, { w: 92, onRight: async (g) => { guides.style.transition = 'opacity .3s'; guides.style.opacity = 1; sfx.coin(); await S.wait(500); S.win(180, 175); } });
  },
  bot: [(S) => S.botTap(S.opts.Same)] },
// 8 ---------------------------------------------------------------
{ q: 'It\'s too {dark:dark}. Find the key.', hint: 'Get rid of the darkness… it\'s in the <b>question</b>.',
  setup(S) {
    S.obj(`<rect x="-60" y="300" width="480" height="260" fill="#e8c9a0" class="ink"/><rect x="60" y="40" width="90" height="70" rx="6" fill="#bde8ff" class="ink"/><path d="M105 40 V110 M60 75 H150" class="thin"/>
      <rect x="200" y="60" width="110" height="10" rx="3" fill="#b98a5e" class="ink"/><rect x="214" y="30" width="16" height="30" fill="#ff8a9a" class="thin"/><rect x="234" y="24" width="14" height="36" fill="#7fe3ec" class="thin"/><rect x="252" y="36" width="20" height="24" fill="#ffd84d" class="thin"/>
      <path d="M40 300 V200 Q40 180 60 180 H200 Q220 180 220 200 V300Z" fill="#8f7ad8" class="ink"/><rect x="30" y="236" width="200" height="60" rx="14" fill="#a893f0" class="ink"/><rect x="24" y="226" width="30" height="76" rx="12" fill="#8f7ad8" class="ink"/><rect x="206" y="226" width="30" height="76" rx="12" fill="#8f7ad8" class="ink"/>
      <path d="M290 300 V180" stroke="${INK}" stroke-width="5"/><path d="M262 180 L318 180 L304 140 L276 140Z" fill="#ffd84d" class="ink"/><ellipse cx="290" cy="302" rx="24" ry="6" fill="#555"/>`, 0, 0);
    const key = S.obj(`<circle cx="-14" r="11" fill="#ffc83d" class="ink"/><circle cx="-14" r="4" fill="#a893f0" class="thin"/><path d="M-3 0 H22 M14 0 V8 M20 0 V6" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M-3 0 H22 M14 0 V8 M20 0 V6" stroke="#ffc83d" stroke-width="4" stroke-linecap="round"/>`, 150, 230, { r: -12 });
    S.key = key; S.interact(key, { tap: () => S.win(150, 180) });
    const dark = S.obj(`<rect x="-60" y="-120" width="480" height="680" fill="#12142b" opacity=".95"/><circle cx="120" cy="200" r="3" fill="#fff" opacity=".7"/><circle cx="134" cy="200" r="3" fill="#fff" opacity=".7"/>`, 0, 0);
    S.interact(dark, { tap: (g, p) => S.nope('Too dark to see!', p.x, p.y - 20) });
    S.dragWord('dark', { drop: (p) => {
      const t = S.obj(`<text text-anchor="middle" class="hand" font-size="34" fill="#fff">dark</text>`, p.x, p.y, { parent: S.fx });
      t.to({ y: 520, r: 50 }, 900, S.easeIn).then(() => t.remove());
      dark.style.transition = 'opacity .6s'; dark.style.opacity = 0; setTimeout(() => dark.remove(), 620); sfx.coin(); buzz(20); return true;
    } });
  },
  bot: [(S) => S.botWord('dark', 180, 200), (S) => S.wait(700), (S) => S.botTap(S.key)] },
// 9 ---------------------------------------------------------------
{ q: 'Help him cross the river.', hint: 'The river is just a drawing. <b>Drag it away</b>.',
  setup(S) {
    S.obj(`<rect x="-60" y="-120" width="480" height="680" fill="#bfe6a0"/><rect x="128" y="-120" width="104" height="680" fill="#f1d9a6"/><path d="M128 -120 V560 M232 -120 V560" stroke="${INK}" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round"/>
      <circle cx="50" cy="80" r="16" fill="#8fd16b" class="ink"/><circle cx="300" cy="60" r="20" fill="#8fd16b" class="ink"/><circle cx="320" cy="390" r="14" fill="#8fd16b" class="ink"/>`, 0, 0);
    S.obj(`<path d="M0 0 V-80" stroke="${INK}" stroke-width="5"/><path d="M0 -80 L46 -66 L0 -52Z" fill="#ff5d6c" class="ink"/>`, 300, 330);
    const river = S.obj(`<rect x="-54" y="-360" width="108" height="720" fill="#5ec2f2" stroke="${INK}" stroke-width="3"/>${[-200, -120, -40, 40, 120, 200].map((y, i) => `<path d="M${-30 + (i % 2) * 18} ${y} q8 -7 16 0 t16 0" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`).join('')}`, 180, 220);
    S.river = river;
    const p = S.pip('neutral', 66, 360, .62); S._pip = p;
    const log = S.obj(`<rect x="-28" y="-9" width="56" height="18" rx="9" fill="#b98a5e" class="ink"/><ellipse cx="28" rx="5" ry="9" fill="#e3b98a" class="thin"/>`, 70, 410);
    S.interact(log, { drag: { drop: (g) => { if (g._t.x > 120 && g._t.x < 240 && river.parentNode) { S.nope('Too short!', g._t.x, g._t.y - 40); g.to({ s: .1 }, 300).then(() => { g.set({ x: 70, y: 410 }); g.to({ s: 1 }, 300); }); return true; } return true; } } });
    let gone = false;
    S.interact(river, { drag: { front: false, drop: async (g) => {
      if (gone) return true; const dx = g._t.x - 180, dy = g._t.y - 220;
      if (Math.hypot(dx, dy) < 60) return false;
      gone = true; sfx.coin(); await g.to({ x: 180 + dx * 4, y: 220 + dy * 4 }, 400, S.easeIn); g.remove();
      p.mood('happy'); await p.to({ x: 262 }, 1300, S.easeInOut); S.win(180, 180); return true;
    } } });
    S.interact(p, { tap: () => S.nope('I can\'t swim!', 66, 230) });
  },
  bot: [(S) => S.botDrag(S.river, 180, 400)] },
// 10 --------------------------------------------------------------
{ q: 'How many holes does this shirt have?', hint: 'Count <b>every</b> opening: neck, sleeves, bottom… and the tear.',
  setup(S) {
    S.obj(`<path d="M-60 -110 Q-30 -96 0 -96 Q30 -96 60 -110 L130 -70 L102 -14 L72 -30 L72 120 L-72 120 L-72 -30 L-102 -14 L-130 -70Z" fill="#ffd84d" class="ink"/>
      <path d="M-28 -101 Q0 -70 28 -101" fill="#fff6c9" class="ink"/><path d="M-72 60 H72" stroke="#ffb300" stroke-width="10" opacity=".5"/>
      <path d="M22 10 l9 -6 l7 7 l9 -3 l-2 10 l7 8 l-11 2 l-4 9 l-7 -7 l-10 3 l1 -10 l-7 -6Z" fill="#fffefb" class="ink"/>`, 180, 190);
    options(S, ['1', '3', '4', '5'], '5', 384);
  },
  bot: [(S) => S.botTap(S.opts['5'])] },
// 11 --------------------------------------------------------------
{ q: 'Light the candle.', hint: 'A match only lights when you <b>strike it on the box</b>.',
  setup(S) {
    S.obj(table(180, 300, 320, 140), 0, 0);
    S.obj(`<rect x="-50" y="-30" width="100" height="44" rx="5" fill="#3fa9f5" class="ink"/><rect x="-50" y="14" width="100" height="16" fill="#7a4a2a" class="ink"/><path d="M-44 22 h88" stroke="#a46a40" stroke-width="3" stroke-dasharray="3 3"/>
      <circle cx="0" cy="-8" r="12" fill="#ff5d6c" class="thin"/><path d="M-5 -14 q5 -10 9 2 q4 -6 2 6 q-6 8 -11 -8z" fill="#ffd84d"/>`, 90, 270);
    const candle = S.obj(`<rect x="-20" y="-80" width="40" height="80" rx="6" fill="#fff" class="ink"/><path d="M-20 -62 q10 8 20 0 q10 -6 20 4" fill="none" stroke="#ffd0d6" stroke-width="5"/><path d="M0 -80 V-94" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
      <g class="fl" opacity="0"><path d="M0 -94 q-14 -16 0 -40 q14 24 0 40z" fill="#ffb300" class="thin"/><path d="M0 -98 q-6 -8 0 -20 q6 12 0 20z" fill="#fff6a8"/></g><ellipse cy="0" rx="34" ry="5" fill="rgba(0,0,0,.08)"/>`, 262, 300);
    const match = S.obj(`<rect x="-32" y="-3.5" width="62" height="7" rx="3" fill="#f6d39a" class="thin"/><ellipse cx="32" rx="8" ry="6.5" fill="#d7263d" class="thin"/><g class="mf" opacity="0"><path d="M36 -4 q-4 -16 10 -30 q6 18 -4 30z" fill="#ffb300" class="thin"/></g>`, 96, 236, { r: -10 });
    S.match = match; let lit = false;
    const head = () => ({ x: match._t.x + 32, y: match._t.y });
    S.interact(match, { drag: {
      move: () => { const h = head(); if (!lit && h.x > 40 && h.x < 140 && h.y > 276 && h.y < 306) { lit = true; match.querySelector('.mf').setAttribute('opacity', 1); tone(1800, .18, 'sawtooth', .05, .3); buzz(20); S.good(h.x, h.y); } },
      drop: (g) => { g.set({ r: 0 }); const h = head(); if (Math.hypot(h.x - 262, h.y - 194) < 46) { if (!lit) { S.nope('It\'s not lit…', 262, 150); return false; } candle.querySelector('.fl').setAttribute('opacity', 1); g.to({ x: 330, y: 300, r: 30 }, 400); S.win(262, 160); return true; } return true; } } });
    S.tick(() => { const f = candle.querySelector('.fl'); f.setAttribute('transform', `scale(${1 + Math.sin(performance.now() / 90) * .05},1)`); });
  },
  bot: [(S) => S.botDrag(S.match, [56, 292], [100, 292], [228, 192])] },
// 12 --------------------------------------------------------------
{ q: 'Make 6 bigger than 8.', hint: 'What does a 6 look like <b>upside down</b>?',
  setup(S) {
    const tile = (n, fill) => `<rect x="-52" y="-62" width="104" height="124" rx="18" fill="rgba(0,0,0,.15)" transform="translate(0,6)"/><rect x="-52" y="-62" width="104" height="124" rx="18" fill="${fill}" class="ink"/><text y="34" text-anchor="middle" font-family="Baloo 2" font-weight="800" font-size="96" fill="${INK}">${n}</text>`;
    const six = S.obj(tile(6, '#7fe3ec'), 90, 200), eight = S.obj(tile(8, '#ff8a9a'), 270, 200);
    const sign = S.obj(`<text y="20" text-anchor="middle" font-family="Baloo 2" font-weight="800" font-size="70" fill="${INK}">&lt;</text>`, 180, 200);
    S.six = six; let done = false;
    S.interact(six, { tap: async () => { if (done) return; done = true; tone(500, .1, 'triangle', .1, 1.6); await six.to({ r: 180 }, 500, S.easeBack); sign.querySelector('text').textContent = '>'; sign.set({ s: 1.4 }); sign.to({ s: 1 }, 300, S.easeBack); S.win(180, 340); } });
    S.interact(eight, { tap: async () => { tone(400, .1, 'triangle', .1, 1.2); await eight.to({ r: eight._t.r + 180 }, 500, S.easeBack); S.nope('Still an 8!', 270, 100); } });
    S.interact(sign, { tap: () => S.nope('Nice try!', 180, 130) });
  },
  bot: [(S) => S.botTap(S.six)] },
// 13 --------------------------------------------------------------
{ q: 'Get the cookie!', hint: 'The lid is stuck. Maybe the jar could take a little <b>fall</b>…',
  setup(S) {
    S.obj(`<path d="M-10 420 H370" stroke="${INK}" stroke-width="3"/><rect x="-60" y="420" width="480" height="140" fill="#e8c9a0"/>`, 0, 0);
    S.obj(table(250, 290, 200, 130), 0, 0);
    const p = S.pip('sad', 74, 420, .7); S._pip = p;
    const jar = S.obj(`<path d="M-44 -96 h88 v10 q14 8 14 30 v40 q0 16 -16 16 h-84 q-16 0 -16 -16 v-40 q0 -22 14 -30z" fill="#dff4ff" class="ink" opacity=".95"/>
      <rect x="-48" y="-112" width="96" height="20" rx="6" fill="#ff8a9a" class="ink"/>
      <g><circle cx="-20" cy="-28" r="16" fill="#d9a066" class="ink"/><circle cx="16" cy="-24" r="16" fill="#d9a066" class="ink"/><circle cx="-2" cy="-52" r="16" fill="#d9a066" class="ink"/>
      <circle cx="-24" cy="-30" r="2.5" fill="#6b4226"/><circle cx="-14" cy="-22" r="2.5" fill="#6b4226"/><circle cx="12" cy="-28" r="2.5" fill="#6b4226"/><circle cx="20" cy="-18" r="2.5" fill="#6b4226"/><circle cx="-4" cy="-56" r="2.5" fill="#6b4226"/><circle cx="4" cy="-48" r="2.5" fill="#6b4226"/></g>
      <path d="M-30 -80 v40" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".8"/>`, 260, 290);
    S.jar = jar; let broke = false;
    S.interact(jar, { tap: () => { S.nope('The lid is stuck!', 260, 150); tone(220, .06, 'square', .06, 1); jar.set({ r: -6 }); jar.to({ r: 0 }, 400, S.easeBack); },
      drag: { drop: async (g) => {
        if (broke) return true;
        if (g._t.x > 150 && g._t.x < 350 && g._t.y < 320) { g.to({ y: 290 }, 200); return true; }
        broke = true; await g.to({ y: 420, r: 14 }, 380, S.easeIn); sfx.smash(); buzz([40, 20, 60]); burstAt(S, g._t.x, 400, '#7fd0ff');
        g.remove(); for (let i = 0; i < 5; i++) { const sh = S.obj(`<path d="M0 0 l14 -6 l-4 14z" fill="#dff4ff" class="thin"/>`, jar._t.x, 412); sh.to({ x: jar._t.x + (i - 2) * 30, y: 414 - (i % 2) * 6, r: i * 70 }, 400); }
        const c = S.obj(`<circle r="16" fill="#d9a066" class="ink"/><circle cx="-5" cy="-4" r="2.5" fill="#6b4226"/><circle cx="5" cy="5" r="2.5" fill="#6b4226"/>`, jar._t.x, 404);
        await c.to({ x: 112, y: 330 }, 500, S.easeOut); p.mood('eat'); S.win(180, 200); return true;
      } } });
  },
  bot: [(S) => S.botDrag(S.jar, 130, 300)] },
// 14 --------------------------------------------------------------
{ q: 'Silence the alarm!', hint: 'Can\'t switch it off? <b>Muffle</b> it.',
  setup(S) {
    S.obj(table(180, 250, 220, 190), 0, 0);
    const clock = S.obj(`<path d="M-30 30 l-10 16 M30 30 l10 16" class="ink"/><circle r="44" fill="#ff5d6c" class="ink"/><circle r="34" fill="#fff" class="ink"/><path d="M0 -22 V0 L14 8" fill="none" class="ink"/>
      <circle cx="-36" cy="-36" r="16" fill="#ffd84d" class="ink"/><circle cx="36" cy="-36" r="16" fill="#ffd84d" class="ink"/><g class="rng"><path d="M-70 -20 l-14 -8 M-74 4 h-16 M70 -20 l14 -8 M74 4 h16" class="ink"/></g>`, 180, 202);
    S.clock = clock; let quiet = false, loud = 1;
    S.tick(() => { if (!quiet) clock.set({ r: Math.sin(performance.now() / 30) * 4 * loud }); });
    S.every(520, () => { if (!quiet) { tone(1600, .05, 'square', .035 * loud, 1); setTimeout(() => tone(1600, .05, 'square', .035 * loud, 1), 90); } });
    S.interact(clock, { tap: () => { loud = Math.min(2.4, loud + .5); S.nope('RIIIING!!', 180, 120); } });
    const p = S.pip('sad', 300, 430, .58); S._pip = p;
    const pillow = S.obj(`<path d="M-58 -26 Q0 -40 58 -26 Q70 0 58 26 Q0 40 -58 26 Q-70 0 -58 -26Z" fill="#fff" class="ink"/><path d="M-40 -10 q10 6 20 0 M10 8 q10 6 20 0" fill="none" stroke="#c9d8ef" stroke-width="3"/>`, 76, 380, { r: -8 });
    S.pillow = pillow;
    S.interact(pillow, { drag: { drop: async (g) => {
      if (Math.hypot(g._t.x - 180, g._t.y - 202) > 70) return true;
      quiet = true; clock.set({ r: 0 }); clock.querySelector('.rng').style.display = 'none'; await g.to({ x: 180, y: 196, r: 0, s: 1.2 }, 250, S.easeBack);
      S.say('…mmf', 180, 140, 900); p.mood('happy'); await S.wait(500); S.win(180, 160); return true;
    } } });
  },
  bot: [(S) => S.botDrag(S.pillow, 180, 200)] },
// 15 --------------------------------------------------------------
{ q: 'Tap the oldest coin.', hint: 'Someone in 300 B.C. couldn\'t know it was <b>"before Christ"</b>.',
  setup(S) {
    const cs = [['1984', 100, 110, '#e0e0e0'], ['300 B.C.', 260, 110, '#f6c544'], ['1712', 100, 270, '#e3a35a'], ['1955', 260, 270, '#f6c544']];
    S.coins = {};
    cs.forEach(([l, x, y, c], i) => {
      const g = S.obj(shadow(52, 8, 64) + coin(l, 58, c), x, y); S.coins[l] = g;
      S.tick(() => g.set({ sx: .9 + Math.abs(Math.cos(performance.now() / 900 + i)) * .1 }));
      S.interact(g, { tap: () => l === '1712' ? S.win(x, y) : S.wrong(x, y, l === '300 B.C.' ? 'It\'s a fake!' : null) });
    });
  },
  bot: [(S) => S.botTap(S.coins['1712'])] },
// 16 --------------------------------------------------------------
{ q: 'Unlock the phone. The code is on this page!', hint: 'Look at the very <b>top</b> of the page.',
  setup(S) {
    S.obj(`<rect x="-112" y="-206" width="224" height="414" rx="30" fill="#2b2b2b"/><rect x="-102" y="-190" width="204" height="382" rx="20" fill="#e9f3ff"/><rect x="-26" y="-200" width="52" height="8" rx="4" fill="#555"/>
      <text y="-140" text-anchor="middle" font-family="Baloo 2" font-weight="800" font-size="22" fill="${INK}">Enter code</text>
      <rect x="-56" y="-124" width="48" height="56" rx="10" fill="#fff" class="thin"/><rect x="8" y="-124" width="48" height="56" rx="10" fill="#fff" class="thin"/>
      <text class="d0" x="-32" y="-82" text-anchor="middle" font-family="Baloo 2" font-weight="800" font-size="36" fill="${INK}"></text><text class="d1" x="32" y="-82" text-anchor="middle" font-family="Baloo 2" font-weight="800" font-size="36" fill="${INK}"></text>`, 180, 214);
    const ph = S.root.lastChild, code = String(S.level).padStart(2, '0'); let typed = '';
    S.keys = {};
    '1234567890'.split('').forEach((d, i) => {
      const col = d === '0' ? 1 : i % 3, row = d === '0' ? 3 : Math.floor(i / 3);
      const g = S.obj(`<circle r="25" fill="#fff" class="ink"/><text y="10" text-anchor="middle" font-family="Baloo 2" font-weight="800" font-size="28" fill="${INK}">${d}</text>`, 116 + col * 64, 194 + row * 60);
      S.keys[d] = g;
      S.interact(g, { tap: () => {
        g.set({ s: .85 }); g.to({ s: 1 }, 200, S.easeBack); if (typed.length >= 2) return;
        typed += d; ph.querySelector('.d' + (typed.length - 1)).textContent = d;
        if (typed.length === 2) setTimeout(() => {
          if (typed === code) { ph.querySelector('rect:nth-child(2)').setAttribute('fill', '#b8f5c9'); S.win(180, 120); }
          else { S.wrong(180, 120, 'Wrong code'); typed = ''; ph.querySelector('.d0').textContent = ''; ph.querySelector('.d1').textContent = ''; }
        }, 220);
      } });
    });
  },
  bot: [(S) => S.botTap(S.keys[String(S.level).padStart(2, '0')[0]]), (S) => S.botTap(S.keys[String(S.level).padStart(2, '0')[1]])] },
// 17 --------------------------------------------------------------
{ q: 'Pick an apple.', hint: 'Too high to reach? Give the tree a good <b>shake</b>.',
  setup(S) {
    S.obj(ground(410), 0, 0);
    S.obj(`<path d="M-18 0 Q-14 -90 -10 -170 L10 -170 Q14 -90 18 0Z" fill="#a8723f" class="ink"/><path d="M-4 -60 q-4 -20 -2 -40" stroke="#7d5129" stroke-width="3" fill="none"/>`, 180, 412);
    const crown = S.obj(`<circle cx="-62" cy="10" r="56" fill="#6cc45a" class="ink"/><circle cx="62" cy="10" r="56" fill="#6cc45a" class="ink"/><circle cx="0" cy="-30" r="72" fill="#7fd36a" class="ink"/><circle cx="-10" cy="30" r="52" fill="#7fd36a"/>
      <path d="M-40 -50 q8 -6 16 0 M30 -20 q8 -6 16 0 M-70 20 q8 -6 16 0" stroke="#4fa43f" stroke-width="3" fill="none"/>`, 180, 210);
    const apples = [[-40, -20], [34, -54], [56, 30], [-66, 40]].map(([x, y]) => S.obj(`<path d="M0 -14 q2 -8 8 -10" stroke="${INK}" stroke-width="3" fill="none"/><circle r="15" fill="#ff4f5e" class="ink"/><circle cx="-5" cy="-5" r="4" fill="#fff" opacity=".6"/>`, 180 + x, 210 + y));
    const p = S.pip('sad', 66, 420, .62); S._pip = p; S.crown = crown;
    for (const a of apples) S.interact(a, { tap: () => S.nope('Too high!', 120, 90) });
    let shakes = 0, dir = 0, lastX = 180, fallen = false;
    const move = (g) => {
      const x = g._t.x, d = Math.sign(x - lastX); g.set({ r: (x - 180) / 5 });
      apples.forEach((a, i) => { if (!a._fall) a.set({ x: a.home.x + (x - 180) * 1.05, y: a.home.y + Math.abs(x - 180) * .1 }); });
      if (Math.abs(x - lastX) > 2) { if (d && dir && d !== dir && Math.abs(x - 180) > 14) { shakes++; tone(260 + shakes * 40, .06, 'triangle', .1, .8); buzz(15); } if (d) dir = d; lastX = x; }
      if (shakes >= 3 && !fallen) { fallen = true; drop(); }
    };
    async function drop() {
      apples.forEach((a, i) => { a._fall = true; setTimeout(() => { a.to({ y: 396 - (i % 2) * 8, x: a._t.x + (i - 1.5) * 12, r: 90 * i }, 520, S.easeIn).then(() => { tone(180, .08, 'sine', .14, .6); a.to({ y: a._t.y - 14 }, 150).then(() => a.to({ y: a._t.y + 14 }, 150, S.easeIn)); }); }, i * 120); });
      await S.wait(900); p.mood('happy'); S.win(180, 180);
    }
    S.interact(crown, { drag: { front: false, axis: 'x', clamp: (x, y) => [Math.max(120, Math.min(240, x)), y], move,
      drop: (g) => { g.to({ x: 180, r: 0 }, 300, S.easeBack).then(() => { lastX = 180; dir = 0; }); apples.forEach((a) => !a._fall && a.to({ x: a.home.x, y: a.home.y }, 300, S.easeBack)); return true; } } });
  },
  bot: [(S) => S.botDrag(S.crown, [220, 210], [140, 210], [220, 210], [140, 210], [220, 210], [180, 210])] },
// 18 --------------------------------------------------------------
{ q: 'Tap the lightbulb.', hint: '', hintTap: (S) => { S.win(70, 400); return true; },
  setup(S) {
    S.obj(`<rect x="-60" y="330" width="480" height="230" fill="#e8c9a0" class="ink"/>`, 0, 0);
    const items = [
      [`<path d="M0 0 V-120" stroke="${INK}" stroke-width="5"/><ellipse cy="2" rx="30" ry="7" fill="#555"/><path d="M-36 -120 L36 -120 L22 -170 L-22 -170Z" fill="#7fe3ec" class="ink"/><rect x="-6" y="-124" width="12" height="10" fill="#999" class="thin"/>`, 80, 334, 'No bulb in this lamp!'],
      [`<rect x="-16" y="-70" width="32" height="70" rx="5" fill="#fff" class="ink"/><path d="M0 -70 V-80" class="ink"/><path d="M0 -80 q-12 -14 0 -34 q12 20 0 34z" fill="#ffb300" class="thin"/>`, 196, 334, 'That\'s a candle.'],
      [`<rect x="-40" y="-14" width="70" height="28" rx="8" fill="#ff5d6c" class="ink"/><path d="M30 -18 L52 -28 L52 28 L30 18Z" fill="#ccc" class="ink"/><circle cx="-14" r="5" fill="#fff" class="thin"/>`, 290, 316, 'A flashlight. Close!'],
      [`<rect x="-56" y="-44" width="112" height="88" rx="6" fill="#d79a5c" class="ink"/><rect x="-46" y="-34" width="92" height="68" fill="#bde8ff" class="thin"/><g transform="translate(0,0) scale(.6)">${sun(26)}</g>`, 180, 110, 'Just a picture of the sun.'],
    ];
    for (const [art, x, y, why] of items) { const g = S.obj(art, x, y); S.interact(g, { tap: () => S.wrong(x, Math.min(y - 60, 300), why) }); }
  },
  bot: [() => document.getElementById('bHint').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))] },
// 19 --------------------------------------------------------------
{ q: 'How many squares are there?', hint: 'Don\'t forget the <b>big one</b> around them all.',
  setup(S) {
    S.obj(`<rect x="-110" y="-110" width="220" height="220" rx="4" fill="#fff6c9" class="ink" stroke-width="6"/><path d="M0 -110 V110 M-110 0 H110" stroke="${INK}" stroke-width="6"/>
      <rect x="-100" y="-100" width="90" height="90" fill="#ff8a9a" opacity=".5"/><rect x="10" y="10" width="90" height="90" fill="#7fe3ec" opacity=".5"/>`, 180, 180);
    options(S, ['4', '5', '8', '9'], '5', 386);
  },
  bot: [(S) => S.botTap(S.opts['5'])] },
// 20 --------------------------------------------------------------
{ q: '{stop:Stop} the car before it falls!', hint: 'The rock is too heavy. Use the <b>first word</b> of the question.',
  setup(S) {
    S.obj(`<rect x="-60" y="-120" width="480" height="680" fill="#d7f0ff"/><path d="M-60 330 H286 L270 560 H-60Z" fill="#bfe6a0" class="ink"/><path d="M-10 344 H282" stroke="#888" stroke-width="10"/><path d="M0 344 H280" stroke="#fff" stroke-width="2" stroke-dasharray="14 12"/>
      <path d="M286 330 L300 560 H420 V420 Q340 400 320 420Z" fill="#5ec2f2" class="ink"/><path d="M310 410 q8 -6 16 0 M330 430 q8 -6 16 0" stroke="#fff" stroke-width="3" fill="none"/>`, 0, 0);
    const rock = S.obj(`<path d="M-50 0 Q-60 -40 -30 -60 Q0 -80 30 -60 Q60 -40 50 0Z" fill="#9aa0a8" class="ink"/><path d="M-20 -40 q10 -8 20 0" stroke="#7a8088" stroke-width="3" fill="none"/>`, 90, 252);
    S.interact(rock, { tap: () => { S.nope('Too heavy!', 90, 160); rock.set({ r: 4 }); rock.to({ r: 0 }, 300, S.easeBack); } });
    S.obj(`<path d="M-50 2 Q-60 -30 -20 -40 L60 -40 Q80 -30 80 2Z" fill="#a0d06a" class="ink"/>`, 90, 254);
    const car = S.obj(`<path d="M-46 -12 V-30 Q-44 -40 -30 -40 L-18 -58 H22 L36 -40 Q48 -38 48 -26 V-12Z" fill="#ff5d6c" class="ink"/><path d="M-12 -52 H18 L28 -40 H-20Z" fill="#bde8ff" class="thin"/>
      <circle cx="-26" cy="-10" r="11" fill="#444" class="ink"/><circle cx="28" cy="-10" r="11" fill="#444" class="ink"/><circle cx="-26" cy="-10" r="4" fill="#ccc"/><circle cx="28" cy="-10" r="4" fill="#ccc"/>`, 44, 340);
    let stopAt = null, falling = false, t0 = performance.now(), sign = null;
    S.tick((dt) => {
      if (falling || performance.now() - t0 < 1200) return;
      const front = car._t.x + 48;
      if (stopAt !== null && front >= stopAt - 6) return;
      car.set({ x: car._t.x + .55 * dt });
      if (car._t.x + 10 > 286) { falling = true; car.to({ y: 470, r: 70 }, 700, S.easeIn).then(() => { burstAt(S, 300, 420, '#5ec2f2'); S.lose('OH NO!', 'The car fell off the cliff.'); }); }
    });
    S.dragWord('stop', { drop: (p) => {
      const x = Math.max(60, Math.min(282, p.x)); if (x < car._t.x + 56) { S.nope('Put it in front of the car!', car._t.x + 40, 260); return false; }
      sign = S.obj(`<path d="M0 0 V-74" stroke="${INK}" stroke-width="5"/><path d="M-26 -126 L-12 -140 H12 L26 -126 V-102 L12 -88 H-12 L-26 -102Z" fill="#ff4458" class="ink" transform="translate(0,20)"/><text y="-90" text-anchor="middle" font-family="Baloo 2" font-weight="800" font-size="15" fill="#fff">STOP</text>`, x, 330, { s: .2 });
      sign.to({ s: 1 }, 300, S.easeBack); stopAt = x; tone(700, .25, 'sawtooth', .05, .5);
      S.later(900, () => S.win(180, 200)); return true;
    } });
  },
  bot: [(S) => S.botWord('stop', 250, 320)] },
// 21 --------------------------------------------------------------
{ q: 'Fill the glass with water.', hint: 'Clouds are full of water. <b>Drag</b> one!',
  setup(S) {
    S.obj(table(200, 330, 260, 110), 0, 0);
    const glass = S.obj(`<g class="w"></g><path d="M-30 -86 L-24 0 H24 L30 -86" fill="rgba(220,240,255,.6)" class="ink"/><path d="M-20 -70 V-14" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`, 200, 330);
    const can = S.obj(`<path d="M-30 0 V-52 H30 V0Z" fill="#8fe3a8" class="ink"/><path d="M30 -40 L62 -64" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M30 -40 L62 -64" stroke="#8fe3a8" stroke-width="4" stroke-linecap="round"/><path d="M-20 -52 Q0 -80 20 -52" fill="none" class="ink"/>`, 300, 330, { s: .9 });
    S.interact(can, { tap: () => S.nope('It\'s empty!', 300, 230) });
    const cl = S.obj(cloud(.9, '#f2f7ff'), 90, 80); S.cloud = cl; let done = false;
    S.tick(() => { if (!done && !cl._held) cl.set({ y: cl._t.y + Math.sin(performance.now() / 500) * .1 }); });
    S.interact(cl, { drag: { start: (g) => g._held = true, drop: async (g) => {
      g._held = false; if (done || Math.abs(g._t.x - 200) > 60 || g._t.y > 260) return true;
      done = true; await g.to({ x: 200, y: Math.min(g._t.y, 150) }, 250); g.set({}); g.querySelector('path').setAttribute('fill', '#c9d3e6');
      const rain = S.obj('', 0, 0);
      for (let i = 0; i < 18; i++) { const d = S.obj(`<path d="M0 0 v12" stroke="#3fa9f5" stroke-width="4" stroke-linecap="round"/>`, 172 + (i % 6) * 11, g._t.y + 20, { parent: rain }); S.later(i * 70, () => d.to({ y: 300 }, 450, S.easeIn).then(() => d.remove())); }
      const w = glass.querySelector('.w');
      await S.tween(1500, (k) => { const h = 80 * k; w.innerHTML = `<path d="M${-24 - h * .07} ${-h} L-24 0 H24 L${24 + h * .07} ${-h}Z" fill="#5ec2f2"/>`; });
      S.win(200, 200); return true;
    } } });
  },
  bot: [(S) => S.botDrag(S.cloud, 200, 130)] },
// 22 --------------------------------------------------------------
{ q: 'Find the hidden coin.', hint: 'Look <b>under</b> things. Plants are good at hiding stuff.',
  setup(S) {
    S.obj(`<rect x="-60" y="300" width="480" height="260" fill="#e8c9a0" class="ink"/><rect x="-60" y="-120" width="480" height="420" fill="#fff8ec"/>`, 0, 0);
    const c = S.obj(coin('', 18), 282, 318); S.coin = c; S.interact(c, { tap: () => S.win(282, 260) });
    S.obj(`<path d="M50 300 V214 Q50 196 68 196 H190 Q208 196 208 214 V300Z" fill="#ff8a9a" class="ink"/><rect x="40" y="250" width="178" height="50" rx="12" fill="#ffa3b0" class="ink"/>`, 0, 0);
    const cush = S.obj(`<rect x="-34" y="-24" width="68" height="48" rx="16" fill="#ffd84d" class="ink"/><path d="M-20 -10 l40 20 M20 -10 l-40 20" stroke="#e6b800" stroke-width="2"/>`, 100, 238, { r: -8 });
    const frame = S.obj(`<rect x="-46" y="-36" width="92" height="72" rx="4" fill="#b98a5e" class="ink"/><rect x="-36" y="-26" width="72" height="52" fill="#bde8ff" class="thin"/><path d="M-36 20 L-10 -6 L8 12 L18 2 L36 20Z" fill="#8fd16b" class="thin"/>`, 270, 110);
    const rug = S.obj(`<ellipse rx="96" ry="26" fill="#7fe3ec" class="ink"/><ellipse rx="70" ry="16" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="8 6"/>`, 130, 380);
    const pot = S.obj(`<path d="M-26 0 L-32 -46 H32 L26 0Z" fill="#e2733b" class="ink"/><rect x="-36" y="-56" width="72" height="14" rx="4" fill="#f08a4b" class="ink"/>
      <path d="M0 -56 Q-30 -100 -40 -130 Q-10 -110 0 -60 Q8 -120 30 -140 Q24 -100 4 -58" fill="#6cc45a" class="ink"/>`, 282, 332);
    S.pot = pot;
    for (const g of [cush, frame, rug, pot]) S.interact(g, { drag: { drop: (g) => { if (g !== pot) S.say('Nothing here…', g._t.x, g._t.y - 50, 900); return true; } } });
  },
  bot: [(S) => S.botDrag(S.pot, 200, 400), (S) => S.botTap(S.coin)] },
// 23 --------------------------------------------------------------
{ q: 'Which one is the heaviest?', hint: 'Read the <b>labels</b>, not the pictures.',
  setup(S) {
    const tag = (t) => `<rect x="-58" y="58" width="116" height="34" rx="8" fill="#fff" class="ink"/><text y="82" text-anchor="middle" class="hand" font-size="21" fill="${INK}">${t}</text>`;
    const items = [
      [`<path d="M-40 40 Q-50 0 -20 -30 Q0 -50 30 -26 Q56 0 44 40Z" fill="#fff" class="ink"/><path d="M-20 20 q10 -40 30 -50 M0 30 q4 -30 26 -40" stroke="#ccc" stroke-width="3" fill="none"/>` + tag('1 kg feathers'), 70, 180, 'Same as iron!'],
      [`<path d="M-44 40 L-30 -10 H30 L44 40Z" fill="#8a96a8" class="ink"/><path d="M-30 -10 L-20 -20 H38 L30 -10" fill="#b3bdcc" class="ink"/>` + tag('1 kg iron'), 290, 180, 'Same as feathers!'],
      [`<path d="M-40 50 L-34 -40 H34 L40 50Z" fill="#ff5d6c" class="ink"/><path d="M-18 -40 V50 M18 -40 V50" stroke="#fff" stroke-width="8"/><circle cx="-14" cy="-48" r="12" fill="#fff6c9" class="thin"/><circle cx="8" cy="-52" r="13" fill="#fff6c9" class="thin"/><circle cx="24" cy="-44" r="10" fill="#fff6c9" class="thin"/>` + tag('2 kg popcorn'), 180, 300, null],
    ];
    S.items = items.map(([a, x, y, why]) => { const g = S.obj(a, x, y); S.interact(g, { tap: () => why ? S.wrong(x, y - 40, why) : S.win(x, y - 70) }); return g; });
  },
  bot: [(S) => S.botTap(S.items[2])] },
// 24 --------------------------------------------------------------
{ q: 'What does the tiny note say?', hint: 'Use the <b>magnifying glass</b>.',
  setup(S) {
    const note = `<g><rect x="-44" y="-44" width="88" height="88" fill="#fff38a" class="thin" transform="rotate(-4)"/><text x="-36" y="-26" font-family="Patrick Hand,cursive" font-size="4.2" fill="${INK}">dear diary,</text>
      <text x="-36" y="-14" font-family="Patrick Hand,cursive" font-size="4.2" fill="${INK}">the secret word is</text><text x="-30" y="2" font-family="Baloo 2" font-weight="800" font-size="7" fill="#d7263d">BANANA</text>
      <text x="-36" y="16" font-family="Patrick Hand,cursive" font-size="4.2" fill="${INK}">don't tell anyone!!</text><path d="M-36 26 h40 M-36 32 h56" stroke="#999" stroke-width=".8"/></g>`;
    S.obj(note, 180, 150);
    const clip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath'); clip.id = 'lens'; clip.innerHTML = '<circle r="40" cx="290" cy="300"/>'; S.defs.appendChild(clip);
    const zoom = S.obj(`<g clip-path="url(#lens)"><circle cx="290" cy="300" r="40" fill="#fff"/><g class="z">${note.replace('<g>', '<g transform="translate(180,150)">')}</g></g>`, 0, 0);
    const mag = S.obj(`<path d="M28 28 L62 62" stroke="${INK}" stroke-width="16" stroke-linecap="round"/><path d="M30 30 L60 60" stroke="#b97a40" stroke-width="9" stroke-linecap="round"/><circle r="42" fill="rgba(200,235,255,.25)" stroke="${INK}" stroke-width="9"/><circle r="42" fill="none" stroke="#9aa0a8" stroke-width="4"/><path d="M-24 -14 q6 -14 20 -18" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/>`, 290, 300);
    S.mag = mag;
    const upd = () => { const { x, y } = mag._t, c = clip.firstChild; c.setAttribute('cx', x); c.setAttribute('cy', y); zoom.querySelector('circle').setAttribute('cx', x); zoom.querySelector('circle').setAttribute('cy', y); zoom.querySelector('.z').setAttribute('transform', `translate(${x},${y}) scale(3.4) translate(${-x},${-y})`); };
    upd(); S.interact(mag, { drag: { move: upd, drop: () => (upd(), true) } });
    options(S, ['APPLE', 'BANANA', 'CHERRY'], 'BANANA', 396, { w: 100, gap: 10, fs: 21, h: 50 });
  },
  bot: [(S) => S.botDrag(S.mag, 172, 152), (S) => S.wait(500), (S) => S.botTap(S.opts.BANANA)] },
// 25 --------------------------------------------------------------
{ q: 'Which glass fills first?', hint: 'Follow every pipe. Look for <b>plugs and gaps</b>.',
  setup(S) {
    const pipe = (d) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="16" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#b3bdcc" stroke-width="10" stroke-linejoin="round"/>`;
    const A = 'M70 92 V320', B = 'M180 92 V150 H240 V215 H120 V270 H180 V320', C1 = 'M290 92 V232', C2 = 'M290 254 V320';
    S.obj(`<rect x="110" y="20" width="140" height="56" rx="10" fill="#5ec2f2" class="ink"/><path d="M120 34 h120" stroke="#fff" stroke-width="3" opacity=".6"/>` + pipe('M70 92 V80 H290 V92') + pipe(A) + pipe(B) + pipe(C1) + pipe(C2) +
      `<rect x="56" y="192" width="28" height="20" rx="4" fill="#ff4458" class="ink"/><path d="M280 236 l20 -6 M280 250 l20 6" stroke="${INK}" stroke-width="3"/>`, 0, 0);
    const flow = S.obj(`<path d="M180 80 V92 ${B.slice(9)}" fill="none" stroke="#3fa9f5" stroke-width="7" stroke-linejoin="round" stroke-dasharray="600" stroke-dashoffset="600"/>`, 0, 0);
    S.glasses = {};
    [['A', 70], ['B', 180], ['C', 290]].forEach(([l, x]) => {
      const g = S.obj(`<g class="w"></g><path d="M-30 -66 L-24 0 H24 L30 -66" fill="rgba(220,240,255,.6)" class="ink"/><text y="40" text-anchor="middle" font-family="Baloo 2" font-weight="800" font-size="28" fill="${INK}">${l}</text>`, x, 392);
      S.glasses[l] = g;
      S.interact(g, { tap: async () => {
        if (l !== 'B') return S.wrong(x, 300);
        const p = flow.querySelector('path'); await S.tween(700, (k) => p.setAttribute('stroke-dashoffset', 600 * (1 - k)), (k) => k);
        await S.tween(500, (k) => g.querySelector('.w').innerHTML = `<path d="M${-24 - k * 4} ${-60 * k} L-24 0 H24 L${24 + k * 4} ${-60 * k}Z" fill="#5ec2f2"/>`);
        S.win(180, 200);
      } });
    });
  },
  bot: [(S) => S.botTap(S.glasses.B)] },
// 26 --------------------------------------------------------------
{ q: 'Balance the scale.', hint: 'Find <b>two</b> weights that add up to 9.',
  setup(S) {
    S.obj(`<path d="M-30 120 L0 0 L30 120Z" fill="#b98a5e" class="ink"/><rect x="-60" y="116" width="120" height="14" rx="6" fill="#9c6e44" class="ink"/>`, 180, 210);
    const beam = S.obj(`<rect x="-130" y="-7" width="260" height="14" rx="7" fill="#9c6e44" class="ink"/><circle r="9" fill="#ffd84d" class="ink"/>`, 180, 210);
    const panArt = `<path d="M-40 -70 L0 -110 L40 -70" fill="none" stroke="${INK}" stroke-width="2.5"/><path d="M-50 -70 H50 Q44 -54 0 -54 Q-44 -54 -50 -70Z" fill="#c9d3e6" class="ink"/>`;
    const panL = S.obj(panArt, 50, 320), panR = S.obj(panArt, 310, 320);
    const wArt = (n, c) => `<path d="M-22 0 L-17 -36 H17 L22 0Z" fill="${c}" class="ink"/><path d="M-9 -36 Q-9 -48 0 -48 Q9 -48 9 -36" fill="none" class="ink"/><text y="-9" text-anchor="middle" font-family="Baloo 2" font-weight="800" font-size="20" fill="#fff">${n}</text>`;
    const nine = S.obj(wArt(9, '#555'), 50, 320);
    S.ws = {}; const onPan = []; let ang = 0, done = false;
    [[2, 60], [4, 140], [5, 220], [6, 300]].forEach(([n, x]) => {
      const g = S.obj(wArt(n, '#7b5cff'), x, 428); g.n = n; S.ws[n] = g;
      S.interact(g, { drag: { start: (g) => { const i = onPan.indexOf(g); if (i >= 0) onPan.splice(i, 1); }, drop: (g) => {
        if (Math.hypot(g._t.x - panR._t.x, g._t.y - (panR._t.y - 60)) < 70 && onPan.length < 3) { onPan.push(g); tone(300 + n * 40, .08, 'triangle', .12, 1); return true; }
        g.to({ x: g.home.x, y: g.home.y }, 260); return true;
      } } });
    });
    S.tick((dt) => {
      const sum = onPan.reduce((a, g) => a + g.n, 0), target = Math.max(-14, Math.min(14, -(9 - sum) * 2.6));
      ang += (target - ang) * .08 * dt; beam.set({ r: ang });
      const rad = ang * Math.PI / 180, lx = 180 - Math.cos(rad) * 130, ly = 210 - Math.sin(rad) * 130 + 110, rx = 180 + Math.cos(rad) * 130, ry = 210 + Math.sin(rad) * 130 + 110;
      panL.set({ x: lx, y: ly }); panR.set({ x: rx, y: ry }); nine.set({ x: lx, y: ly - 56 });
      onPan.forEach((g, i) => g.set({ x: rx + (i - (onPan.length - 1) / 2) * 32, y: ry - 56 }));
      if (!done && sum === 9 && Math.abs(ang) < .6) { done = true; S.win(180, 140); }
      if (!done && sum > 9 && !S._over) { S._over = true; S.nope('Too heavy!', 300, 120); setTimeout(() => S._over = false, 1500); }
    });
  },
  bot: [(S) => S.botDrag(S.ws[4], 310, 262), (S) => S.botDrag(S.ws[5], 310, 262)] },
// 27 --------------------------------------------------------------
{ q: 'Turn off the sun.', hint: 'Where does the sun go every <b>evening</b>?',
  setup(S) {
    const sky = S.obj(`<rect x="-60" y="-120" width="480" height="680" fill="#9fdcff"/>`, 0, 0);
    const stars = S.obj([[50, 50], [120, 90], [300, 40], [220, 120], [80, 160], [320, 150]].map(([x, y]) => `<g transform="translate(${x},${y})">${star(8)}</g>`).join(''), 0, 0); stars.style.opacity = 0;
    const s = S.obj(sun(34), 260, 100); S.sun = s;
    S.obj(`<path d="M-10 300 Q80 260 170 300 T380 290 V560 H-10Z" fill="#8fd16b" class="ink"/><path d="M-10 350 Q120 320 220 352 T380 340 V560 H-10Z" fill="#6cc45a" class="ink"/>
      <path d="M70 300 V270 M60 280 L70 260 L80 280Z" stroke="${INK}" stroke-width="3" fill="#4fa43f"/><rect x="250" y="300" width="60" height="44" fill="#fff" class="ink"/><path d="M244 302 L280 270 L316 302Z" fill="#ff5d6c" class="ink"/><rect x="272" y="318" width="16" height="26" fill="#b98a5e" class="thin"/>`, 0, 0);
    let done = false;
    S.interact(s, { tap: () => S.nope('Ouch! Hot!', 260, 40), drag: { front: false, drop: async (g) => {
      if (done) return true; if (g._t.y < 290) return true;
      done = true; await g.to({ y: 400 }, 500, S.easeIn);
      await S.tween(800, (k) => { sky.firstChild.setAttribute('fill', `rgb(${159 - 120 * k | 0},${220 - 170 * k | 0},${255 - 160 * k | 0})`); stars.style.opacity = k; });
      S.win(180, 160); return true;
    } } });
  },
  bot: [(S) => S.botDrag(S.sun, 200, 360)] },
// 28 --------------------------------------------------------------
{ q: 'Get the ball out of the pipe.', hint: 'Balls <b>float</b>. Pour something in!',
  setup(S) {
    S.obj(`<path d="M-10 420 H370" stroke="${INK}" stroke-width="3"/>`, 0, 0);
    const water = S.obj(`<rect x="-26" y="0" width="52" height="0" fill="#5ec2f2"/>`, 180, 410);
    const ball2 = S.obj(ball.basket(20), 180, 388);
    S.obj(`<path d="M-34 -300 V10 H34 V-300" fill="none" stroke="${INK}" stroke-width="12" stroke-linejoin="round"/><path d="M-34 -300 V10 H34 V-300" fill="none" stroke="#d6dde8" stroke-width="6"/><path d="M-22 -280 V-10" stroke="#fff" stroke-width="4" opacity=".5"/>`, 180, 410);
    const p = S.pip('sad', 62, 420, .62); S._pip = p;
    S.interact(ball2, { tap: () => S.nope('Can\'t reach it!', 180, 250) });
    const bucket = S.obj(`<path d="M-28 -50 Q0 -80 28 -50" fill="none" class="ink"/><path d="M-30 -50 L-24 0 H24 L30 -50Z" fill="#8a96a8" class="ink"/><path d="M-30 -50 H30" stroke="#5ec2f2" stroke-width="7"/><path d="M-30 -50 H30" class="ink"/>`, 300, 418);
    S.bucket = bucket; let done = false;
    S.interact(bucket, { drag: { drop: async (g) => {
      if (done) return true; if (Math.hypot(g._t.x - 180, g._t.y - 100) > 80) return true;
      done = true; await g.to({ x: 222, y: 92, r: -70 }, 300);
      const stream = S.obj(`<rect x="-5" y="0" width="10" height="320" fill="#5ec2f2" opacity=".9"/>`, 180, 84); tone(200, .9, 'sine', .05, 2);
      const r = water.querySelector('rect');
      await S.tween(1500, (k) => { const h = 300 * k; r.setAttribute('y', -h); r.setAttribute('height', h); ball2.set({ y: Math.min(388, 410 - h + 6) }); });
      stream.remove(); g.to({ r: 0, x: 300, y: 418 }, 300);
      await ball2.to({ x: 110, y: 380 }, 600, S.easeOut); tone(300, .1, 'sine', .12, .7); p.mood('happy'); S.win(180, 180); return true;
    } } });
  },
  bot: [(S) => S.botDrag(S.bucket, 210, 100)] },
// 29 --------------------------------------------------------------
{ q: 'Find the one that is different.', hint: 'Look closely at the <b>hair</b>.',
  setup(S) {
    const odd = 7; S.heads = [];
    for (let i = 0; i < 12; i++) {
      const x = 70 + (i % 3) * 110, y = 64 + Math.floor(i / 3) * 102;
      const g = S.obj(head(i === odd, .95), x, y); S.heads.push(g);
      S.interact(g, { tap: () => i === odd ? S.win(x, y) : S.wrong(x, y) });
    }
  },
  bot: [(S) => S.botTap(S.heads[7])] },
// 30 --------------------------------------------------------------
{ q: 'Press the button to win!', hint: 'It\'s hiding behind someone. <b>Move him</b>!',
  setup(S) {
    const b = S.obj(`<ellipse cy="10" rx="58" ry="22" fill="#999" class="ink"/><path d="M-52 0 V10 A52 18 0 0 0 52 10 V0" fill="#c22" class="ink"/><ellipse rx="52" ry="18" fill="#ff4458" class="ink"/><text y="6" text-anchor="middle" font-family="Baloo 2" font-weight="800" font-size="20" fill="#fff">WIN</text>`, 180, 200);
    const p = S.pip('neutral', 270, 420, .8); S._pip = p; S.btn = b; S.pipG = p;
    let runs = 0, hidden = false, tired = false;
    const spots = [[80, 120], [290, 90], [100, 300]];
    S.interact(b, { tap: async () => {
      if (tired) { b.set({ sy: .6 }); b.to({ sy: 1 }, 200); S.win(b._t.x, b._t.y - 60); return; }
      if (hidden) return;
      if (runs < 3) { const [x, y] = spots[runs++]; tone(700, .1, 'triangle', .1, 1.5); S.say(['Nope!', 'Too slow!', 'Hehe!'][runs - 1], b._t.x, b._t.y - 50, 700); await b.to({ x, y }, 260, S.easeBack); if (runs === 3) S.later(500, hide); }
    } });
    async function hide() { hidden = true; S.say('I\'m hiding!', 230, 250, 900); await b.to({ x: 272, y: 340, s: .8 }, 400); p.parentNode.appendChild(p); }
    S.interact(p, { drag: { drop: async (g) => {
      if (!hidden || tired) return true; if (Math.hypot(g._t.x - 270, g._t.y - 420) < 60) return false;
      tired = true; b.front(); S.say('OK OK… you win.', 272, 290, 1400); S.tick(() => tired && S.alive && b.set({ r: Math.sin(performance.now() / 40) * 3 })); return true;
    } } });
  },
  bot: [(S) => S.botTap(S.btn), (S) => S.wait(400), (S) => S.botTap(S.btn), (S) => S.wait(400), (S) => S.botTap(S.btn), (S) => S.wait(1100), (S) => S.botDrag(S.pipG, 100, 420), (S) => S.wait(300), (S) => S.botTap(S.btn)] },
];
