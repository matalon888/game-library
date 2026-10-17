// AGENTPARK club queue: an animated pixel scene for go.html. A dark street at night, our residents (club-sprites.js) queue on
// the pavement behind a velvet rope, and the keeper sweeps his flashlight down the line, checks the first one ("NAME?"), and
// either lifts the rope ("YOU'RE IN": they walk through the glowing door) or doesn't ("NOT TONIGHT": back of the line).
// It's hard to get in. Drawn on a 160x100 canvas scaled up with crisp pixels. ClubScene(canvas) starts it.
(function () {
  const W = 160, H = 100, FLOOR = 86;
  const FONT = {
    A: '010101111101101', G: '011100101101011', E: '111100110100111', N: '110101101101101', T: '111010010010010',
    P: '110101110100100', R: '110101110101101', K: '101101110101101', M: '101111101101101', '?': '111001010000010',
    Y: '101101010010010', O: '111101101101111', U: '101101101101111', "'": '010010000000000', I: '111010010010111',
    H: '101101111101101', V: '101101101101010', B: '110101110101110', S: '011100010001110', L: '100100100100111', '!': '010010010000010', ' ': '000000000000000',
  };
  function text(c, s, x, y, col) {
    c.fillStyle = col;
    [...s].forEach((ch, i) => { const g = FONT[ch] || FONT[' ']; for (let k = 0; k < 15; k++) if (g[k] === '1') c.fillRect(x + i * 4 + (k % 3), y + ((k / 3) | 0), 1, 1); });
  }
  const tw = s => s.length * 4 - 1;

  window.ClubScene = function (cv) {
    const S = window.CLUB_SPRITES; if (!S || !cv) return;
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
    const img = {}; for (const k in S) { img[k] = new Image(); img[k].src = S[k].src; }
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // a brick wall, drawn once
    const wall = document.createElement('canvas'); wall.width = W; wall.height = H;
    (function () {
      const w = wall.getContext('2d');
      w.fillStyle = '#07060f'; w.fillRect(0, 0, W, H);
      w.fillStyle = '#161124'; w.fillRect(0, 6, W, FLOOR - 6);
      w.fillStyle = '#0e0b18';
      for (let y = 6; y < FLOOR; y += 5) { w.fillRect(0, y, W, 1); for (let x = (y / 5) % 2 ? 0 : 6; x < W; x += 12) w.fillRect(x, y, 1, 5); }
      w.fillStyle = '#0b0a14'; w.fillRect(0, FLOOR, W, H - FLOOR);
      w.fillStyle = '#211b30'; w.fillRect(0, FLOOR, W, 1);
      w.fillStyle = '#100d1a'; for (let x = 0; x < W; x += 16) w.fillRect(x, FLOOR + 1, 1, H - FLOOR);
      // the door and its frame
      w.fillStyle = '#2b2340'; w.fillRect(126, 42, 30, FLOOR - 42);
      w.fillStyle = '#0a0812'; w.fillRect(129, 45, 24, FLOOR - 45);
      w.fillStyle = '#d9a441'; w.fillRect(149, 66, 2, 2);
      // a lamp
      w.fillStyle = '#2b2340'; w.fillRect(8, 6, 1, 20); w.fillRect(4, 26, 9, 2);
    })();

    const CAST = ['fox-kick', 'frog-skate', 'hedgehog-gamer', 'penguin-skates', 'robot-dunk', 'bunny-scooter', 'cat-binoculars',
      'octopus-juggle', 'owl-icecream', 'raccoon-padel', 'kid-agent-laptop', 'hippo-cheer'].filter(k => S[k]);
    const slotX = i => 70 - i * 18;    // where the i-th in line stands (centre)
    let line = CAST.slice(0, 6).map((k, i) => ({ k, x: slotX(i), tx: slotX(i), out: 0, flip: false })), next = 6;
    let phase = 'sweep', t0 = 0, cycle = 0, beam = slotX(3), bubble = '', walker = null, ropeOpen = false, doorGlow = 0;

    function setPhase(p, now) { phase = p; t0 = now; }
    function step(now) {
      const t = now - t0;
      if (phase === 'sweep') { beam = slotX(3) + (slotX(0) - slotX(3)) * Math.min(1, t / 2200); bubble = ''; if (t > 2400) setPhase('check', now); }
      else if (phase === 'check') { beam = slotX(0) + Math.round(Math.sin(t / 140)); bubble = t > 200 ? 'NAME?' : ''; if (t > 1500) { cycle++; setPhase(cycle % 3 === 0 ? 'no' : 'yes', now); } }
      else if (phase === 'yes') {
        bubble = "YOU'RE IN"; ropeOpen = true;
        if (!walker) { walker = line.shift(); walker.tx = 141; }
        doorGlow = Math.min(1, doorGlow + 0.08);
        if (walker.x >= 140) { walker.out = Math.min(1, walker.out + 0.12); }
        if (t > 2000) { walker.k = CAST[next++ % CAST.length]; line.push(walker); walker.x = -16; walker.out = 0; walker.flip = false; walker = null; ropeOpen = false; setPhase('shuffle', now); }
      } else if (phase === 'no') {
        bubble = 'NOT TONIGHT';
        if (t > 900 && !walker) { walker = line.shift(); walker.tx = -20; walker.flip = true; }
        if (t > 2300) { walker.k = CAST[next++ % CAST.length]; line.push(walker); walker.x = -16; walker.flip = false; walker = null; setPhase('shuffle', now); }
      } else if (phase === 'shuffle') {
        bubble = ''; doorGlow = Math.max(0, doorGlow - 0.06);
        if (t > 1300) setPhase('sweep', now);
      }
      line.forEach((p, i) => { p.tx = slotX(i); });
      // keep 7 in line: anyone past the 7th waits off screen
      [...line, ...(walker ? [walker] : [])].forEach(p => { const d = p.tx - p.x; if (Math.abs(d) > 0.5) p.x += Math.sign(d) * Math.min(Math.abs(d), p === walker ? 1.6 : 1.1); else p.x = p.tx; });
    }

    function draw(now) {
      c.drawImage(wall, 0, 0);
      // neon sign: AGENTPARK, with the odd flicker
      const flick = Math.sin(now / 97) > 0.97 ? 0.35 : 1;
      c.globalAlpha = 0.25 * flick; c.fillStyle = '#ff3fcf'; c.fillRect(119, 29, 41, 11); c.globalAlpha = flick;
      text(c, 'AGENTPARK', 122, 32, '#ff7be3'); c.globalAlpha = 1;
      text(c, 'VIP', 136, 50, doorGlow > 0.5 ? '#7a4a10' : '#5a4b80');
      // door light spills onto the pavement when it opens
      if (doorGlow > 0) {
        c.globalAlpha = doorGlow; c.fillStyle = '#ffcf6a'; c.fillRect(129, 45, 24, FLOOR - 45);
        c.globalAlpha = doorGlow * 0.25; c.beginPath(); c.moveTo(129, FLOOR); c.lineTo(153, FLOOR); c.lineTo(164, H); c.lineTo(116, H); c.fill(); c.globalAlpha = 1;
      }
      // the queue (dim), the one in the beam lit
      const bob = (p, i) => Math.abs(p.x - p.tx) > 0.5 ? (Math.floor(now / 120 + i) % 2) : (Math.floor(now / 700 + i * 1.7) % 5 === 0 ? 1 : 0);
      const all = line.map((p, i) => [p, i]).concat(walker ? [[walker, 9]] : []);
      all.forEach(([p, i]) => {
        const s = S[p.k], im = img[p.k]; if (!im.complete) return;
        const x = Math.round(p.x - s.w / 2), y = FLOOR - s.h - bob(p, i);
        c.save(); c.globalAlpha = 1 - p.out;
        if (p.flip) { c.translate(x + s.w, y); c.scale(-1, 1); c.drawImage(im, 0, 0); } else c.drawImage(im, x, y);
        c.restore();
      });
      // night: everything outside the light goes dark
      c.fillStyle = 'rgba(4,3,12,.5)'; c.fillRect(0, 6, 126, H - 6);
      // the lamp's pool
      c.fillStyle = 'rgba(255,214,140,.07)'; c.beginPath(); c.moveTo(4, 28); c.lineTo(13, 28); c.lineTo(28, H); c.lineTo(-10, H); c.fill();
      c.fillStyle = '#ffd98c'; c.fillRect(6, 28, 5, 1);
      // velvet rope: two brass posts, a red rope (hangs loose when lifted)
      c.fillStyle = '#d9a441'; c.fillRect(84, 72, 2, 14); c.fillRect(98, 72, 2, 14); c.fillRect(83, 71, 4, 2); c.fillRect(97, 71, 4, 2);
      c.fillStyle = '#c0163a';
      if (!ropeOpen) for (let x = 86; x < 98; x++) c.fillRect(x, 74 + Math.round(Math.sin((x - 86) / 12 * Math.PI) * 3), 1, 1);
      else for (let y = 74; y < 84; y++) c.fillRect(87 + (y % 2), y, 1, 1);
      // the keeper, between the rope and the door
      const kk = ropeOpen ? 'keeper-yes' : 'keeper', ks = S[kk], kim = img[kk];
      const kx = 100, ky = FLOOR - ks.h;
      if (kim.complete) c.drawImage(kim, kx, ky);
      // flashlight: a cone from his hand to the face being checked, and a lit circle on it
      if (phase === 'sweep' || phase === 'check') {
        const hx = kx + 3, hy = ky + 16, fx = Math.round(beam), fy = FLOOR - 18;
        c.fillStyle = 'rgba(255,240,170,.18)'; c.beginPath(); c.moveTo(hx, hy); c.lineTo(fx, fy - 9); c.lineTo(fx, fy + 9); c.fill();
        c.fillStyle = 'rgba(255,240,170,.22)'; c.beginPath(); c.arc(fx, fy, 8, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#fff3b0'; c.fillRect(hx - 1, hy - 1, 2, 2);
      }
      // speech bubble over the keeper
      if (bubble) {
        const bw = tw(bubble) + 6, bx = Math.min(W - bw - 2, kx + 16 - (bw >> 1)), by = ky - 12;
        c.fillStyle = '#0a0812'; c.fillRect(bx - 1, by - 1, bw + 2, 11);
        c.fillStyle = bubble === 'NOT TONIGHT' ? '#ff5470' : bubble === "YOU'RE IN" ? '#7dffa8' : '#fff7e0';
        c.fillRect(bx, by, bw, 9); c.fillRect(kx + 14, by + 9, 2, 2);
        text(c, bubble, bx + 3, by + 2, '#120e1c');
      }
      // a few stars
      c.fillStyle = '#4b4270'; [[30, 2], [70, 4], [104, 1], [140, 3], [154, 2]].forEach(([x, y], i) => { if ((Math.floor(now / 900) + i) % 4) c.fillRect(x, y, 1, 1); });
    }

    let last = 0;
    function frame(now) {
      if (!t0) t0 = now;
      if (now - last > 80) { step(now); draw(now); last = now; }   // ~12 fps: it should feel like a pixel game
      if (!reduce) requestAnimationFrame(frame);
    }
    const start = () => requestAnimationFrame(frame);
    if (img.keeper.complete) start(); else img.keeper.onload = start;
  };
})();
