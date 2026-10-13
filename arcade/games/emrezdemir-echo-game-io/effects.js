// PNG effect playback. One-shot animations rendered at grid positions.
// Sheets are horizontal strips with uniform frame width.

const Effects = (() => {
  const SHEETS = {
    portal: { src: "effects/5 Other/Portal1.png", frames: 6, fw: 96, fh: 96, fps: 16 },
    sparks: { src: "effects/3 Sparks/1.png",      frames: 4, fw: 48, fh: 48, fps: 18 },
    smoke:  { src: "effects/1 Smoke/1.png",       frames: 4, fw: 48, fh: 48, fps: 14 },
  };

  const images = {};
  const loaded = {};
  const instances = [];
  let initialised = false;

  function init() {
    if (initialised) return;
    initialised = true;
    for (const [key, def] of Object.entries(SHEETS)) {
      const img = new Image();
      loaded[key] = false;
      img.onload = () => { loaded[key] = true; };
      img.onerror = () => { loaded[key] = false; };
      img.src = def.src;
      images[key] = img;
    }
  }

  function spawn(name, gridX, gridY, opts) {
    const def = SHEETS[name];
    if (!def) return;
    opts = opts || {};
    instances.push({
      name,
      gx: gridX,
      gy: gridY,
      sizeFactor: opts.sizeFactor || 1.4,
      start: performance.now(),
      duration: opts.duration || (def.frames * 1000 / def.fps),
      alpha: opts.alpha != null ? opts.alpha : 1,
      tint: opts.tint || null,
    });
  }

  function draw(ctx, ox, oy, cell) {
    if (instances.length === 0) return;
    const now = performance.now();
    for (let i = instances.length - 1; i >= 0; i--) {
      const inst = instances[i];
      const def = SHEETS[inst.name];
      const elapsed = now - inst.start;
      if (elapsed >= inst.duration) {
        instances.splice(i, 1);
        continue;
      }
      if (!loaded[inst.name]) continue;

      const progress = elapsed / inst.duration;
      const frameIdx = Math.min(Math.floor(progress * def.frames), def.frames - 1);
      const sx = frameIdx * def.fw;

      const cx = ox + inst.gx * cell + cell / 2;
      const cy = oy + inst.gy * cell + cell / 2;
      const target = cell * inst.sizeFactor;
      const aspect = def.fw / def.fh;
      const dw = aspect >= 1 ? target : target * aspect;
      const dh = aspect >= 1 ? target / aspect : target;

      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = inst.alpha;
      if (inst.tint) ctx.filter = inst.tint;
      ctx.drawImage(images[inst.name], sx, 0, def.fw, def.fh,
                    cx - dw / 2, cy - dh / 2, dw, dh);
      ctx.restore();
    }
  }

  function clear() {
    instances.length = 0;
  }

  return { init, spawn, draw, clear };
})();
