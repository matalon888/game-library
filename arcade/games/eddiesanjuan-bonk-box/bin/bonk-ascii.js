#!/usr/bin/env node
/* Bonk Box, in the terminal.
 *
 * The toy is a stickman who gets a prop dropped on him and always gets back
 * up. This is that, in text, for the times you are in a terminal and not
 * looking at a window - which for most people is most of the time.
 *
 * Two paths, same beats. A terminal gets stop-motion on the ALTERNATE SCREEN,
 * so your scrollback is untouched and one line is added when it finishes.
 * Anything else - a pipe, CI, a captured command - gets it as a comic strip,
 * because a still pose is a picture of nothing happening.
 *
 * No dependencies. The only thing this writes is the quip deck, and the only
 * thing it can run is an optional background call to your own claude CLI for
 * more one-liners: a fixed generic prompt with nothing of yours in it.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const out = process.stdout;
/* Colour is for a terminal that asked for it. Piped output gets none, because
   escape codes in somebody's build log are litter. */
const COLOR = !process.env.NO_COLOR && Boolean(out.isTTY);
const c = (code, s) => (COLOR ? `\x1b[${code}m${s}\x1b[0m` : s);
const ink = (s) => c('37', s);
const pencil = (s) => c('90', s);
const marker = (s) => c('1;31', s);
const shine = (s) => c('33', s);

const HOME = os.homedir();
const CONFIG_DIR = path.join(HOME, '.config', 'bonk-box');

/* ---- the cast -----------------------------------------------------------
   Every pose is six columns wide so nothing slides sideways between frames.
   He squashes flat under the drop and unfolds again - that is the whole gag,
   which is why these are drawn rather than generated. */
const POSE = {
  // Three rows, feet on the last one.
  stand: ['  ()  ', ' /||\\ ', ' /  \\ '],
  brace: [' \\()/ ', '  ||  ', ' /  \\ '],
  knee: ['  ()  ', ' /|   ', ' / \\_ '],
  thumb: ['  ()b ', ' /||  ', ' /  \\ '],
  // Two rows, and one. Flattened is a single line on the floor, which is the
  // point of it - anything taller does not read as flattened.
  peel: ['  ()_ ', ' /|   '],
  ride: ['  \\o/ ', '   |  ', '  / \\ '],
  squash: ['.-oOo-.'],
  flat: [' _.o._ ']
};

/* Classic slapstick, with a lit top face and a darker front so each one reads
   as an object with a side to it rather than a flat block. */
const TOY = {
  anvil: {
    word: 'CLANG!',
    far: ['  ▄▄▄  ', ' ▐███▌ '],
    near: [' ▗▄▄▄▄▄▖ ', ' ▟▓▓▓▓▓▙ ', ' ▝▜███▛▘ ', '   ███   ', '▗▟█████▙▖'],
    rest: [' ▗▄▄▄▄▄▖ ', ' ▟▓▓▓▓▓▙ ', ' ▝▜███▛▘ '],
    debris: '·  ˙  ·',
    beat: 'and pancake.'
  },
  piano: {
    word: 'PLONK!',
    far: ['  ▄▄▄▄ ', ' ▐▓▓▓▌ '],
    near: [' ▗▄▄▄▄▄▄▖', ' ▟▓▓▓▓▓▓▙', ' ▐███████▌', '▐│││││││▌', ' ▝▀▀▀▀▀▀▘'],
    rest: [' ▗▄▄▄▄▄▄▖', ' ▟▓▓▓▓▓▓▙', '▐│││││││▌'],
    debris: '│ ˙ │  ·',
    beat: 'two keys got away.'
  },
  firework: {
    word: 'FWOOMP!',
    far: ['   ▲   ', '  ███  '],
    near: ['    ▲    ', '   ▟█▙   ', '   ▐█▌   ', '   ▐█▌   ', '  ▗▟█▙▖  '],
    rest: ['   ▲   ', '  ▟█▙  ', '  ▐█▌  '],
    debris: '✦ ˙ ✧  ·',
    beat: 'he rode it out of frame.'
  }
};

const MOTION = ['╲     ╱', ' ╲   ╱ '];

/* ---- the quip deck ------------------------------------------------------
   A shuffled deck rather than a random pick, so you never see the same line
   twice running and you get through the whole set before any of it repeats. */

function poolLines() {
  const lines = [];
  const add = (file) => {
    try {
      for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
        const s = raw.trim();
        if (s && !s.startsWith('#')) lines.push(s);
      }
    } catch (e) {
      /* not there is fine */
    }
  };
  add(path.join(__dirname, 'quips.txt'));
  add(path.join(CONFIG_DIR, 'quips-learned.txt'));
  return lines;
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

const DECK_FILE = path.join(CONFIG_DIR, 'quip-deck.json');

function takeQuip() {
  const pool = poolLines();
  if (!pool.length) return { quip: 'he is fine.', left: 0 };
  let remaining = [];
  try {
    const saved = JSON.parse(fs.readFileSync(DECK_FILE, 'utf8'));
    if (Array.isArray(saved.remaining)) {
      remaining = saved.remaining.filter((q) => pool.indexOf(q) !== -1);
    }
  } catch (e) {
    /* first run, or somebody edited it into nonsense */
  }
  // An empty deck means he has been through every line: shuffle the lot again.
  if (!remaining.length) remaining = shuffle(pool.slice());
  const quip = remaining.pop() || 'he is fine.';
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(DECK_FILE, JSON.stringify({ v: 1, remaining: remaining }) + '\n');
  } catch (e) {
    /* a deck we cannot save just means the next one is random too */
  }
  return { quip: quip, left: remaining.length };
}

/* ---- more quips, quietly, later -----------------------------------------
   The toy's only inference feature. It runs AFTER the drawing is done, fully
   detached, and nothing ever waits for it. The prompt is a fixed string with
   nothing of yours in it: no prompt text, no paths, no session, no counts.
   Turn it off with "quipRefill": "off".

   Throttled hard on purpose - only when the deck is nearly out, and at most
   once a day. A toy that spends tokens every time you poke it is a toy you
   uninstall. */
function maybeRefill(left) {
  try {
    let mode = 'auto';
    try {
      const cfg = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'config.json'), 'utf8'));
      if (typeof cfg.quipRefill === 'string') mode = cfg.quipRefill;
    } catch (e) {
      /* no config means auto */
    }
    if (mode === 'off' || left > 8) return;

    const stamp = path.join(CONFIG_DIR, 'last-quip-refill');
    const today = new Date().toISOString().slice(0, 10);
    try {
      if (fs.readFileSync(stamp, 'utf8').trim() === today) return;
    } catch (e) {
      /* never refilled */
    }

    // `claude` is a shell function on some setups, so look for the binary.
    const cli = [
      path.join(HOME, '.local/bin/claude'),
      '/opt/homebrew/bin/claude',
      '/usr/local/bin/claude'
    ].filter((p) => {
      try {
        fs.accessSync(p, fs.constants.X_OK);
        return true;
      } catch (e) {
        return false;
      }
    })[0];
    if (!cli) return;

    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(stamp, today + '\n');

    const prompt =
      'Write 12 one-line deadpan captions for a cartoon stickman who has just ' +
      'been flattened by a falling anvil in a slapstick physics toy. He is an ' +
      'AI coding agent and he is always fine. Register: dry status-update ' +
      'excuses, for example "he says the tests were flaky." or "recovery is in ' +
      'scope." Rules: third person, lower case, under 60 characters each, no ' +
      'violence or injury words at all, gentle and funny. Output ONLY the ' +
      'lines, one per line, no numbering, no quotes, no preamble.';

    const learned = path.join(CONFIG_DIR, 'quips-learned.txt');
    const spawn = require('child_process').spawn;
    const child = spawn(
      '/bin/sh',
      [
        '-c',
        // Only plausible one-liners get through, so a chatty answer or an
        // error page cannot end up in the deck.
        '"' + cli + '" -p ' + JSON.stringify(prompt) + ' --model haiku 2>/dev/null | ' +
          "awk 'NF && length($0) < 70 && $0 !~ /^[#0-9]/' >> " + JSON.stringify(learned)
      ],
      { detached: true, stdio: 'ignore' }
    );
    child.unref();
  } catch (e) {
    /* the deck works perfectly well without this */
  }
}

/* ---- the page ------------------------------------------------------------ */

const W = 38;
const H = 11;
/* The line his feet stand on, and the floor just under it where shadows go. */
const GROUND = H - 2;
const FLOOR = H - 1;

const blank = () => Array.from({ length: H }, () => Array(W).fill(' '));

function place(g, art, x, y) {
  art.forEach((row, r) => {
    const gy = y + r;
    if (gy < 0 || gy >= H) return;
    for (let i = 0; i < row.length; i++) {
      const gx = x + i;
      if (gx < 0 || gx >= W) continue;
      if (row[i] !== ' ') g[gy][gx] = row[i];
    }
  });
}

/* A blob under whatever is in the air, tightening as it comes down, so the
   drop reads as heading at him rather than sliding across a flat picture. */
function shadow(g, x, width, near) {
  const ch = near > 0.66 ? '▄' : near > 0.33 ? '▃' : '▁';
  for (let i = 0; i < width; i++) {
    const gx = x + i;
    if (gx >= 0 && gx < W) g[FLOOR][gx] = ch;
  }
}

/* The animation wants every panel the same height so nothing jumps between
   frames. A comic strip wants the opposite - six full-height panels is mostly
   empty sky and eighty lines of somebody's transcript - so the strip crops
   each panel to what is actually drawn in it. */
function crop(g) {
  const used = g.map((row) => row.some((ch) => ch !== ' '));
  let top = used.indexOf(true);
  let bottom = used.lastIndexOf(true);
  if (top < 0) return g.slice(0, 1);
  return g.slice(top, bottom + 1);
}

function frame(g, caption) {
  const top = pencil(' ╭' + '─'.repeat(W) + '╮');
  const bot = pencil(' ╰' + '─'.repeat(W) + '╯');
  const body = g.map((row) => pencil(' │') + ink(row.join('')) + pencil('│'));
  return ['', top].concat(body, [bot, caption ? '  ' + caption : '']).join('\n');
}

/* ---- the beat sheet ------------------------------------------------------ */

function beats(toy, quip) {
  const manX = 15;
  const manY = GROUND - 2; // three-row poses, feet on GROUND
  const list = [];
  // Frames carry a name so the comic strip can pick beats rather than
  // positions - the firework has two of its own and everything after it would
  // otherwise shift under a hard-coded index.
  const push = (fn, cap, tag) => {
    const g = blank();
    fn(g);
    list.push({ grid: g, art: frame(g, cap), cap: cap, tag: tag || '' });
  };

  // Standing about, minding his own business.
  push((g) => place(g, POSE.stand, manX, manY), pencil('your agent'), 'stand');

  // High and small, then closer and bigger. The shadow tightens as it comes.
  push((g) => {
    place(g, toy.far, manX, 0);
    place(g, POSE.stand, manX, manY);
    shadow(g, manX + 1, 5, 0.2);
  }, '', 'far');
  push((g) => {
    place(g, toy.near, manX - 1, 1);
    place(g, POSE.brace, manX, manY);
    shadow(g, manX, 7, 0.6);
  }, '', 'near');
  push((g) => {
    place(g, toy.near, manX - 1, GROUND - 7);
    place(g, POSE.brace, manX, manY);
    shadow(g, manX, 9, 1);
  }, '', 'incoming');

  // Underneath it. He is a pancake.
  push((g) => {
    place(g, MOTION, manX - 8, GROUND - 5);
    place(g, MOTION, manX + 10, GROUND - 5);
    place(g, toy.near, manX - 1, GROUND - 5);
    place(g, POSE.squash, manX, GROUND);
    place(g, [toy.debris], manX + 10, GROUND);
  }, marker(toy.word) + '  ' + pencil(toy.beat), 'impact');
  push((g) => {
    place(g, toy.near, manX - 1, GROUND - 5);
    place(g, POSE.squash, manX, GROUND);
  }, '');

  // The firework does not flatten him so much as take him with it. He goes up
  // out of the top of the frame and comes back down, which is the one bit of
  // choreography that is properly its own.
  if (toy === TOY.firework) {
    push((g) => {
      place(g, POSE.ride, manX, 0);
      place(g, toy.near, manX - 1, 3);
      place(g, MOTION, manX - 6, 6);
      place(g, MOTION, manX + 8, 6);
    }, pencil('...up he goes'), 'ride');
    push((g) => {
      place(g, [toy.debris], manX + 1, 1);
      place(g, POSE.flat, manX, GROUND);
    }, pencil('...and back down'), 'land');
  }

  // It settles off to one side and leaves him there.
  push((g) => {
    place(g, toy.rest, manX + 7, GROUND - 2);
    place(g, POSE.flat, manX, GROUND);
    place(g, [shine('✦') + '   ' + shine('✧')], manX, GROUND - 1);
  }, '');
  push((g) => {
    place(g, toy.rest, manX + 7, GROUND - 2);
    place(g, POSE.flat, manX, GROUND);
    place(g, [shine('✧') + ' ' + shine('·') + ' ' + shine('✦')], manX + 1, GROUND - 1);
  }, pencil('...'), 'stars');

  // Peeling himself off the floor.
  push((g) => {
    place(g, toy.rest, manX + 7, GROUND - 2);
    place(g, POSE.peel, manX, GROUND - 1);
  }, '');
  push((g) => {
    place(g, toy.rest, manX + 7, GROUND - 2);
    place(g, POSE.knee, manX, manY);
  }, '', 'knee');
  push((g) => {
    place(g, toy.rest, manX + 7, GROUND - 2);
    place(g, POSE.stand, manX, manY);
  }, '');

  // Fine. Always fine.
  for (let i = 0; i < 3; i++) {
    push((g) => {
      place(g, toy.rest, manX + 7, GROUND - 2);
      place(g, POSE.thumb, manX, manY);
    }, quip, 'thumb');
  }
  return list;
}

/* ---- the terminal -------------------------------------------------------- */

const ALT_ON = '\x1b[?1049h';
const ALT_OFF = '\x1b[?1049l';
const HIDE = '\x1b[?25l';
const SHOW = '\x1b[?25h';
const CLEAR = '\x1b[H\x1b[2J';

let restored = false;
function restore() {
  if (restored) return;
  restored = true;
  out.write(SHOW + ALT_OFF);
}

function play(toy, quip, left) {
  const list = beats(toy, quip);
  out.write(ALT_ON + HIDE);
  // However this ends, the terminal goes back the way it was found.
  process.on('exit', restore);
  ['SIGINT', 'SIGTERM', 'SIGHUP'].forEach((sig) => {
    process.on(sig, () => {
      restore();
      process.exit(sig === 'SIGINT' ? 130 : 1);
    });
  });
  let i = 0;
  const tick = () => {
    if (i >= list.length) {
      restore();
      out.write('  ' + pencil(quip) + '\n');
      maybeRefill(left);
      return;
    }
    out.write(CLEAR + list[i].art + '\n');
    // Hold the impact a beat longer. It is the frame anybody remembers.
    const hold = i === 4 ? 340 : i === 0 ? 280 : 110;
    i++;
    setTimeout(tick, hold);
  };
  tick();
}

/* Piped, captured or in CI: the same beats, stacked as a strip. */
function strip(toy, quip, left) {
  const panels = beats(toy, quip);
  // Five beats, six for the firework, which earns one for going up.
  const want = ['stand', 'incoming', 'impact', 'ride', 'stars', 'thumb'];
  const chosen = [];
  want.forEach((tag) => {
    const hit = panels.filter((p) => p.tag === tag)[0];
    if (hit) chosen.push(frame(crop(hit.grid), hit.cap));
  });
  out.write(chosen.join('\n') + '\n');
  maybeRefill(left);
}

/* ---- go ------------------------------------------------------------------ */

const names = Object.keys(TOY);
// An optional toy name is for checking the art, not a documented flag.
const forced = (process.argv[2] || '').replace(/^--/, '');
const toy = TOY[forced] || TOY[names[Math.floor(Math.random() * names.length)]];
const picked = takeQuip();

if (out.isTTY) play(toy, picked.quip, picked.left);
else strip(toy, picked.quip, picked.left);
