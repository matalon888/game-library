// The painted rooms (art wave 1): a framed "before" painting of the room, with the "after" painting (same camera) revealed
// spot by spot as makeover tasks finish (rooms.js PAINTED spots), all of it when the room is restored. Also paints the
// scene background (the room, soft and washed) behind the match board. Only the current room's two images load.
const A = './assets/paint/';
const imgs = new Map();
function img(src) {
  if (!imgs.has(src)) imgs.set(src, new Promise(ok => { const i = new Image(); i.decoding = 'async'; i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; }));
  return imgs.get(src);
}
export const pics = name => Promise.all([img(`${A}${name}-before.webp`), img(`${A}${name}-after.webp`)]);

export function createPaint() {
  const box = document.createElement('div'); box.className = 'bh-paint bh-hidden';
  const cv = document.createElement('canvas'); box.appendChild(cv); document.body.appendChild(box);
  const g = cv.getContext('2d'), mask = document.createElement('canvas'), mg = mask.getContext('2d');
  let P = null, before = null, after = null, done = [], grow = {}, full = 0, cw = 0, ch = 0, raf = 0;

  function draw() {
    if (!before || !cw) return;
    g.drawImage(before, 0, 0, cw, ch);
    mg.globalCompositeOperation = 'source-over'; mg.clearRect(0, 0, cw, ch);
    if (full >= 1) { mg.fillStyle = '#000'; mg.fillRect(0, 0, cw, ch); }
    else {
      const all = done.map(id => [id, 1]).concat(Object.entries(grow));
      for (const [id, k0] of all) for (const [x, y, r] of P.spots[id] || []) {
        const k = Math.max(0, k0), R = Math.max(1, r * cw * k), cx = x * cw, cy = y * ch, gr = mg.createRadialGradient(cx, cy, 0, cx, cy, R);
        gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.62, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        mg.fillStyle = gr; mg.fillRect(cx - R, cy - R, R * 2, R * 2);
      }
      if (full > 0) { mg.fillStyle = '#000'; mg.globalAlpha = full; mg.fillRect(0, 0, cw, ch); mg.globalAlpha = 1; }
    }
    mg.globalCompositeOperation = 'source-in'; mg.drawImage(after, 0, 0, cw, ch);
    g.drawImage(mask, 0, 0);
  }
  const tween = (dur, fn) => new Promise(ok => { const t0 = performance.now(); const step = now => { const k = Math.min(1, (now - t0) / dur); fn(k); draw(); if (k < 1) raf = requestAnimationFrame(step); else ok(); }; raf = requestAnimationFrame(step); });
  const easeBack = t => { const c = 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

  return {
    box,
    // which room, which tasks are done, restored or not
    async set(def, doneIds, restored) {
      P = def.paint; done = doneIds.slice(); grow = {}; full = restored ? 1 : 0;
      [before, after] = await pics(P.img); draw();
    },
    // the frame sits in the free space between the top HUD and the bottom panel (3:4, centred)
    layout(top, bot) {
      const fw = innerWidth - 24, fh = innerHeight - top - bot, w = Math.floor(Math.min(fw, fh * 0.75)), h = Math.floor(w / 0.75);
      Object.assign(box.style, { width: w + 'px', height: h + 'px', left: Math.round((innerWidth - w) / 2) + 'px', top: Math.round(top + (fh - h) / 2) + 'px' });
      const dpr = Math.min(2, devicePixelRatio || 1); cw = cv.width = mask.width = Math.round(w * dpr); ch = cv.height = mask.height = Math.round(h * dpr); draw();
    },
    show(on) { box.classList.toggle('bh-hidden', !on); },
    rect: () => box.getBoundingClientRect(),
    // one task: its spots open up from nothing with a little overshoot
    async reveal(id) { grow[id] = 0; await tween(900, k => { grow[id] = easeBack(k); }); delete grow[id]; done.push(id); draw(); },
    async revealAll() { await tween(1400, k => { full = k * k; }); full = 1; draw(); },
    // where on screen a task's first spot is (sparkles, the task icon crop)
    spotXY(id) { const s = (P && P.spots[id] || [])[0], r = box.getBoundingClientRect(); return s ? [r.left + s[0] * r.width, r.top + s[1] * r.height] : [r.left + r.width / 2, r.top + r.height / 2]; },
    // the scene background behind the match board: the room as it is now, cover-fit, soft and washed
    paintBg(c, x) {
      if (!before || !cw) return false;
      const W = c.width, H = c.height, s = Math.max(W / cv.width, H / cv.height), w = cv.width * s, h = cv.height * s;
      x.filter = 'blur(1px) saturate(1.1)'; x.drawImage(cv, (W - w) / 2, (H - h) / 2, w, h); x.filter = 'none';
      x.fillStyle = 'rgba(255,236,244,.18)'; x.fillRect(0, 0, W, H);
      return true;
    },
  };
}

// a task's icon: the "after" painting cropped around its first spot
export function spotIcon(P, id, px = 46) {
  const s = (P.spots[id] || [])[0]; if (!s) return '';
  const bw = px / (2 * s[2]), bh = bw * 4 / 3;
  return `<span class="bh-spot" style="background-image:url(./assets/paint/${P.img}-after.webp);background-size:${bw.toFixed(1)}px ${bh.toFixed(1)}px;background-position:${(px / 2 - s[0] * bw).toFixed(1)}px ${(px / 2 - s[1] * bh).toFixed(1)}px"></span>`;
}
