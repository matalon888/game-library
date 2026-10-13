/* LIGHTCONE · renderer — 2D raytraced look: visibility polygons per light,
   additive compositing, bloom pass, and light spill on wall edges.
   Off the plane, the seeker's light becomes a true 3D cone: a beam from
   the floating body down to an elliptical pool on the floor. */
(function () {
  window.HS = window.HS || {};

  const E = () => HS.engine;
  const TAU = Math.PI * 2;

  let W = 0, H = 0, TILE = 44;
  let ctx = null;
  let lightC = null, lctx = null;      // additive light accumulation
  let bloomC = null, bctx = null;      // quarter-res blur
  let floorC = null;                   // prerendered floor
  let vignetteC = null;
  let dangerC = null;                  // red edge pulse for the final seconds
  let edgeCache = { version: -1, edges: [] };
  let lastFxId = 0;                    // fx entries already turned into particles
  let prevT = 0;
  const emit = { hider: 0, seeker: 0, ambient: 0, decoy: 0 };
  const sprites = {};

  function glowSprite(r, g, b) {
    const k = r + ',' + g + ',' + b;
    if (sprites[k]) return sprites[k];
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const grad = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
    grad.addColorStop(0.35, `rgba(${r},${g},${b},0.45)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = grad;
    x.fillRect(0, 0, 64, 64);
    sprites[k] = c;
    return c;
  }

  function init(canvas) {
    const CFG = E().CFG;
    TILE = CFG.TILE;
    W = CFG.COLS * TILE;
    H = CFG.ROWS * TILE;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    lightC = document.createElement('canvas');
    lightC.width = W; lightC.height = H;
    lctx = lightC.getContext('2d');

    bloomC = document.createElement('canvas');
    bloomC.width = W / 4; bloomC.height = H / 4;
    bctx = bloomC.getContext('2d');

    // floor: grid + faint tile noise
    floorC = document.createElement('canvas');
    floorC.width = W; floorC.height = H;
    const f = floorC.getContext('2d');
    f.fillStyle = '#05070f';
    f.fillRect(0, 0, W, H);
    f.strokeStyle = 'rgba(90,110,160,0.06)';
    f.lineWidth = 1;
    for (let x = 0; x <= CFG.COLS; x++) {
      f.beginPath(); f.moveTo(x * TILE + 0.5, 0); f.lineTo(x * TILE + 0.5, H); f.stroke();
    }
    for (let y = 0; y <= CFG.ROWS; y++) {
      f.beginPath(); f.moveTo(0, y * TILE + 0.5); f.lineTo(W, y * TILE + 0.5); f.stroke();
    }
    for (let i = 0; i < 260; i++) {
      f.fillStyle = `rgba(120,150,220,${0.015 + Math.random() * 0.03})`;
      f.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
    }

    vignetteC = document.createElement('canvas');
    vignetteC.width = W; vignetteC.height = H;
    const v = vignetteC.getContext('2d');
    const vg = v.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    v.fillStyle = vg;
    v.fillRect(0, 0, W, H);

    dangerC = document.createElement('canvas');
    dangerC.width = W; dangerC.height = H;
    const dv = dangerC.getContext('2d');
    const dg = dv.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.9);
    dg.addColorStop(0, 'rgba(255,60,60,0)');
    dg.addColorStop(1, 'rgba(255,60,60,0.4)');
    dv.fillStyle = dg;
    dv.fillRect(0, 0, W, H);
  }

  function rebuildEdges(S, CFG) {
    const edges = [];
    const dirs = [
      [0, -1, 0, 0, 1, 0],  // top edge: (x,y)->(x+1,y), normal (0,-1)
      [0, 1, 0, 1, 1, 1],   // bottom
      [-1, 0, 0, 0, 0, 1],  // left
      [1, 0, 1, 0, 1, 1],   // right
    ];
    for (const k of S.wallSet) {
      const [x, y] = k.split(',').map(Number);
      for (const [nx, ny, ax, ay, bx, by] of dirs) {
        const ox = x + nx, oy = y + ny;
        if (ox < 0 || oy < 0 || ox >= CFG.COLS || oy >= CFG.ROWS) continue;
        if (S.wallSet.has(x + nx + ',' + (y + ny))) continue;
        edges.push({
          x1: x + ax, y1: y + ay, x2: x + bx, y2: y + by,
          mx: x + (ax + bx) / 2, my: y + (ay + by) / 2,
          nx, ny,
        });
      }
    }
    edgeCache = { version: S.wallsVersion, edges };
  }

  function coneAngles(facing, fov) {
    return [facing - fov / 2, facing + fov / 2];
  }

  const NO_WALLS = () => false; // light cast from beside the plane

  function drawPointLight(px, py, r, stops, solidFn) {
    const path = HS.light.lightPath(px, py, r, solidFn || E().solid, TILE);
    const g = lctx.createRadialGradient(px * TILE, py * TILE, 0, px * TILE, py * TILE, r * TILE);
    for (const [o, c] of stops) g.addColorStop(o, c);
    lctx.fillStyle = g;
    lctx.fill(path);
  }

  function drawConeLight(px, py, facing, fov, r, stops, rays, solidFn) {
    const [a0, a1] = coneAngles(facing, fov);
    const path = HS.light.lightPath(px, py, r, solidFn || E().solid, TILE, a0, a1, rays || 110);
    const g = lctx.createRadialGradient(px * TILE, py * TILE, 0, px * TILE, py * TILE, r * TILE);
    for (const [o, c] of stops) g.addColorStop(o, c);
    lctx.fillStyle = g;
    lctx.fill(path);
  }

  function draw(view) {
    if (!ctx) return;
    const eng = E();
    const S = eng.state;
    const CFG = eng.CFG;
    const t = S.t;
    const h = S.hider, sk = S.seeker;
    const inRound = S.phase === 'play' || S.phase === 'countdown' || S.phase === 'over';

    if (edgeCache.version !== S.wallsVersion) rebuildEdges(S, CFG);
    const dtp = Math.max(0, Math.min(0.05, t - prevT));
    prevT = t;

    // seeker render position (pounce arc handled here)
    let sfx = sk.fx, sfyy = sk.fy, pounceH = 0;
    if (sk.pounce) {
      const p = Math.min(1, (t - sk.pounce.t0) / sk.pounce.dur);
      sfx = sk.pounce.fromX + (sk.pounce.toX - sk.pounce.fromX) * p;
      sfyy = sk.pounce.fromY + (sk.pounce.toY - sk.pounce.fromY) * p;
      pounceH = Math.sin(Math.PI * p) * 24;
    }
    const stunned = t < sk.stunnedUntil;

    // ── light accumulation ──
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, W, H);
    lctx.globalCompositeOperation = 'lighter';

    const hz = h.fz || 0, szf = sk.fz || 0;
    if (inRound) {
      // hider glow — the liability (off-plane it detaches and dims)
      const pulse = 1 + Math.sin(t * 3.1) * 0.05;
      const hr = (h.dim ? CFG.DIM_RADIUS : CFG.GLOW_RADIUS) * pulse / (1 + 0.35 * Math.abs(hz));
      drawPointLight(h.x, h.y, hr, [
        [0, 'rgba(120,255,230,0.85)'],
        [0.3, 'rgba(70,220,195,0.35)'],
        [1, 'rgba(40,160,150,0)'],
      ], Math.abs(hz) > 0.2 ? NO_WALLS : undefined);

      // decoys — indistinguishable glow (by design)
      for (const d of S.decoys) {
        const fl = 1 + Math.sin(t * 3.1 + d.phase) * 0.05;
        drawPointLight(d.x, d.y, CFG.GLOW_RADIUS * fl, [
          [0, 'rgba(120,255,230,0.85)'],
          [0.3, 'rgba(70,220,195,0.35)'],
          [1, 'rgba(40,160,150,0)'],
        ]);
      }

      // seeker: small warm halo + hunting cone. on the plane the cone is a
      // wall-clipped 2D fan; off it, a genuine 3D cone (beam + floor pool)
      const coneAlpha = (stunned ? 0.28 : 1) * (szf < -0.2 ? 0.3 : 1);
      const bodyLift = (pounceH + Math.max(0, szf) * 14) / TILE;
      drawPointLight(sfx, sfyy - bodyLift, 1.9, [
        [0, `rgba(255,190,110,${0.5 * coneAlpha})`],
        [1, 'rgba(255,160,70,0)'],
      ], Math.abs(szf) > 0.2 ? NO_WALLS : undefined);
      if (szf > 0.15) {
        drawSkyCone(CFG, sfx, sfyy, szf, sk.facing, coneAlpha, pounceH);
      } else if (szf > -0.2) {
        drawConeLight(sfx, sfyy, sk.facing, CFG.VIEW_FOV, CFG.VIEW_RANGE, [
          [0, `rgba(255,185,95,${0.4 * coneAlpha})`],
          [0.45, `rgba(255,165,75,${0.16 * coneAlpha})`],
          [1, 'rgba(255,150,60,0)'],
        ], 110);
      }

      // scent trail — glowing history on the floor
      const spr = glowSprite(255, 79, 195);
      for (const n of S.scent) {
        const age = t - n.t;
        const s = Math.max(0, 1 - age / CFG.SCENT_LIFE) * (n.d || 1);
        if (s <= 0.02) continue;
        const size = (0.34 + 0.55 * s) * TILE;
        lctx.globalAlpha = Math.min(0.6, s * 0.55);
        lctx.drawImage(spr, n.x * TILE - size / 2, n.y * TILE - size / 2, size, size);
      }
      lctx.globalAlpha = 1;

      // the triangle traces — ignited runes with light strung between them,
      // brighter with every completed lap
      drawLightconeTrace(S, t, 'seeker', sfx, sfyy);
      drawLightconeTrace(S, t, 'hider', h.x, h.y);

      // unfound glyphs: almost nothing. a flicker you could swear you imagined
      if (!S.meta.seeker.unlocked) {
        for (const g of S.meta.glyphs) {
          if (g.found) continue;
          const fl = 0.05 + 0.05 * (0.5 + 0.5 * Math.sin(t * 6 + g.idx * 2.1));
          const gx = (g.x + 0.5) * TILE, gy = (g.y + 0.5) * TILE;
          lctx.globalAlpha = fl;
          lctx.strokeStyle = 'rgba(178,107,255,1)';
          lctx.lineWidth = 1;
          lctx.beginPath();
          lctx.moveTo(gx + 7, gy); lctx.lineTo(gx, gy + 7); lctx.lineTo(gx - 7, gy); lctx.lineTo(gx, gy - 7);
          lctx.closePath(); lctx.stroke();
          lctx.fillStyle = 'rgba(214,178,255,1)';
          lctx.fillRect(gx - 1, gy - 1, 2, 2);
        }
        lctx.globalAlpha = 1;
      }

      // sonar pings — expanding rings
      for (const p of S.pings) {
        const age = t - p.t0;
        const r = age * 7.5 * TILE;
        const a = Math.max(0, 1 - age / 1.6);
        lctx.strokeStyle = `rgba(255,180,84,${a * 0.7})`;
        lctx.lineWidth = 3;
        lctx.beginPath(); lctx.arc(p.x * TILE, p.y * TILE, r, 0, TAU); lctx.stroke();
        lctx.strokeStyle = `rgba(255,220,160,${a * 0.3})`;
        lctx.lineWidth = 8;
        lctx.beginPath(); lctx.arc(p.x * TILE, p.y * TILE, r * 0.92, 0, TAU); lctx.stroke();
      }

      // transient fx on the light layer
      for (const f of S.fx) {
        const p = Math.min(1, (t - f.t0) / f.dur);
        const a = 1 - p;
        if (f.type === 'ring' || f.type === 'shock') {
          const r = (f.type === 'shock' ? 2.6 : 1.4) * p * TILE;
          lctx.strokeStyle = hexA(f.color, a * 0.8);
          lctx.lineWidth = f.type === 'shock' ? 5 : 2.5;
          lctx.beginPath(); lctx.arc(f.x * TILE, f.y * TILE, Math.max(1, r), 0, TAU); lctx.stroke();
        } else if (f.type === 'scrub') {
          const r = f.r * p * TILE;
          lctx.fillStyle = hexA(f.color, a * 0.22);
          lctx.beginPath(); lctx.arc(f.x * TILE, f.y * TILE, Math.max(1, r), 0, TAU); lctx.fill();
        } else if (f.type === 'burst') {
          lctx.strokeStyle = hexA(f.color, a * 0.9);
          lctx.lineWidth = 2;
          for (let i = 0; i < 10; i++) {
            const ang = (i / 10) * TAU + f.t0;
            const r0 = 0.2 + p * 1.6, r2 = 0.5 + p * 2.2;
            lctx.beginPath();
            lctx.moveTo((f.x + Math.cos(ang) * r0) * TILE, (f.y + Math.sin(ang) * r0) * TILE);
            lctx.lineTo((f.x + Math.cos(ang) * r2) * TILE, (f.y + Math.sin(ang) * r2) * TILE);
            lctx.stroke();
          }
        } else if (f.type === 'scan') {
          if (szf <= 0.15) { // aloft, the sky cone itself is the scan
            drawConeLight(sfx, sfyy, sk.facing, CFG.VIEW_FOV, CFG.VIEW_RANGE, [
              [0, `rgba(255,220,150,${a * 0.35})`],
              [1, 'rgba(255,180,84,0)'],
            ], 70);
          }
        } else if (f.type === 'sniffFx') {
          for (let i = 0; i < 3; i++) {
            const r = (0.3 + p * 1.6 + i * 0.35) * TILE;
            lctx.strokeStyle = `rgba(255,79,195,${a * 0.4})`;
            lctx.lineWidth = 1.5;
            lctx.beginPath(); lctx.arc(f.x * TILE, f.y * TILE, r, 0, TAU); lctx.stroke();
          }
        } else if (f.type === 'flash') {
          drawPointLight(f.x, f.y, 3.5 * (0.4 + p), [
            [0, hexA(f.color, a * 0.5)],
            [1, hexA(f.color, 0)],
          ]);
        } else if (f.type === 'noiseBurst') {
          // staggered sound ripples — the shape of a mistake
          for (let i = 0; i < 3; i++) {
            const pp = p - i * 0.16;
            if (pp <= 0 || pp > 1) continue;
            const r = pp * 2.6 * TILE;
            lctx.strokeStyle = hexA(f.color, (1 - pp) * 0.55);
            lctx.lineWidth = 2;
            lctx.beginPath(); lctx.arc(f.x * TILE, f.y * TILE, r, 0, TAU); lctx.stroke();
          }
        } else if (f.type === 'build') {
          lctx.fillStyle = hexA(f.color, a * 0.3);
          lctx.fillRect((f.x - 0.5) * TILE, (f.y - 0.5) * TILE, TILE, TILE);
          lctx.strokeStyle = hexA(f.color, a * 0.9);
          lctx.lineWidth = 2;
          lctx.strokeRect((f.x - 0.5) * TILE + 1, (f.y - 0.5) * TILE + 1, TILE - 2, TILE - 2);
        } else if (f.type === 'goFlash' || f.type === 'winFlash') {
          lctx.fillStyle = hexA(f.color, a * a * (f.type === 'goFlash' ? 0.3 : 0.2));
          lctx.fillRect(0, 0, W, H);
        } else if (f.type === 'glyphFx' || f.type === 'rune') {
          const d0 = f.type === 'rune' ? 4 + p * 16 : 6 + p * 30;
          lctx.strokeStyle = hexA('#d2aaff', a);
          lctx.lineWidth = 2;
          lctx.save();
          lctx.translate(f.x * TILE, f.y * TILE);
          lctx.rotate(p * 2.5);
          lctx.beginPath();
          lctx.moveTo(d0, 0); lctx.lineTo(0, d0); lctx.lineTo(-d0, 0); lctx.lineTo(0, -d0);
          lctx.closePath(); lctx.stroke();
          lctx.restore();
        } else if (f.type === 'capture') {
          // the kill: white slam, then a red world, then three shockwaves
          const slam = p < 0.12 ? 1 - p / 0.12 : 0;
          if (slam > 0) {
            lctx.fillStyle = `rgba(255,255,255,${slam * 0.6})`;
            lctx.fillRect(0, 0, W, H);
          }
          lctx.fillStyle = `rgba(255,70,70,${a * a * 0.28})`;
          lctx.fillRect(0, 0, W, H);
          for (let i = 0; i < 3; i++) {
            const pp = p - i * 0.1;
            if (pp <= 0 || pp > 1) continue;
            const r = pp * 9 * TILE;
            lctx.strokeStyle = i === 0 ? `rgba(255,240,220,${(1 - pp) * 0.9})` : hexA(f.color, (1 - pp) * 0.7);
            lctx.lineWidth = 6 - i * 1.5;
            lctx.beginPath(); lctx.arc(f.x * TILE, f.y * TILE, r, 0, TAU); lctx.stroke();
          }
        } else if (f.type === 'floorFx') {
          // a slab condensing out of nothing, edges first
          const d0 = (1 - p * 0.4) * TILE * 0.55;
          lctx.strokeStyle = hexA('#d2aaff', a * 0.9);
          lctx.lineWidth = 2;
          lctx.strokeRect(f.x * TILE - d0, f.y * TILE - d0 - 10 * p, d0 * 2, d0 * 2);
          lctx.fillStyle = hexA('#b26bff', a * 0.25);
          lctx.fillRect(f.x * TILE - d0, f.y * TILE - d0 - 10 * p, d0 * 2, d0 * 2);
        } else if (f.type === 'unlock') {
          for (let i = 0; i < 3; i++) {
            const pp = p - i * 0.12;
            if (pp <= 0 || pp > 1) continue;
            lctx.strokeStyle = hexA('#b26bff', (1 - pp) * 0.8);
            lctx.lineWidth = 4 - i;
            lctx.beginPath(); lctx.arc(f.x * TILE, f.y * TILE, pp * 7 * TILE, 0, TAU); lctx.stroke();
          }
          lctx.fillStyle = hexA('#b26bff', a * a * 0.25);
          lctx.fillRect(0, 0, W, H);
        } else if (f.type === 'rewrite') {
          // self-modification: an amber ring, and lines of new code rising
          // out of the hunter as the old program is unwritten
          const rr = (0.6 + p * 1.8) * TILE;
          lctx.strokeStyle = hexA('#ffb454', a * 0.8);
          lctx.lineWidth = 2;
          lctx.beginPath(); lctx.arc(f.x * TILE, f.y * TILE, rr, 0, TAU); lctx.stroke();
          lctx.fillStyle = hexA('#ffd9a0', a * 0.75);
          for (let i = 0; i < 5; i++) {
            const ly = f.y * TILE - 10 - i * 7 - p * 26;
            const lw = 8 + ((f.id + i * 7) % 13);
            lctx.fillRect(f.x * TILE - lw / 2, ly, lw, 2.2);
          }
        }
      }
    }

    // ── particles (drawn additively so they glow and feed the bloom) ──
    for (const f of S.fx) {
      if (f.id > lastFxId) { lastFxId = f.id; fxParticles(f, S, sfx, sfyy); }
    }
    runEmitters(dtp, S, CFG, sfx, sfyy);
    HS.particles.update(dtp);
    HS.particles.draw(lctx, TILE, (r, g, b) => glowSprite(r, g, b));

    // ── bloom pass ──
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.clearRect(0, 0, bloomC.width, bloomC.height);
    bctx.filter = 'blur(5px)';
    bctx.drawImage(lightC, 0, 0, bloomC.width, bloomC.height);
    bctx.filter = 'none';

    // ── compose main frame ──
    ctx.save();
    if (S.shake > 0.01) {
      const m = S.shake * 7;
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(floorC, 0, 0);

    // walls — dark mass; light spills onto their edges below
    for (const k of S.wallSet) {
      const [x, y] = k.split(',').map(Number);
      ctx.fillStyle = '#10131f';
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x * TILE + 3, y * TILE + 3, TILE - 6, TILE - 6);
    }
    // player-built walls get a faint seam so the human recognizes their own work
    for (const w of S.playerWalls) {
      ctx.strokeStyle = 'rgba(93,242,214,0.14)';
      ctx.lineWidth = 1;
      ctx.strokeRect(w.x * TILE + 4.5, w.y * TILE + 4.5, TILE - 9, TILE - 9);
    }

    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(lightC, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.8;
    ctx.drawImage(bloomC, 0, 0, W, H);
    ctx.globalAlpha = 1;

    // ── light spill on wall edges ──
    if (inRound) {
      const lights = [
        { x: h.x, y: h.y, r: (h.dim ? CFG.DIM_RADIUS : CFG.GLOW_RADIUS) + 0.6, c: [110, 250, 225], gain: Math.abs(hz) > 0.2 ? 0.25 : 1 },
        { x: sfx, y: sfyy, r: CFG.VIEW_RANGE * 0.8, c: [255, 185, 100], gain: (stunned ? 0.3 : 0.85) * (Math.abs(szf) > 0.2 ? 0 : 1), cone: true, facing: sk.facing, fov: CFG.VIEW_FOV + 0.35 },
      ];
      for (const d of S.decoys) lights.push({ x: d.x, y: d.y, r: CFG.GLOW_RADIUS + 0.6, c: [110, 250, 225], gain: 1 });

      ctx.lineWidth = 2.5;
      for (const e of edgeCache.edges) {
        for (const L of lights) {
          const dx = L.x - e.mx, dy = L.y - e.my;
          const d = Math.hypot(dx, dy);
          if (d > L.r || d < 0.05) continue;
          const face = (dx * e.nx + dy * e.ny) / d;
          if (face <= 0.1) continue;
          if (L.cone) {
            const a = Math.atan2(-dy, -dx);
            let diff = a - L.facing;
            while (diff > Math.PI) diff -= TAU;
            while (diff < -Math.PI) diff += TAU;
            if (Math.abs(diff) > L.fov / 2) continue;
          }
          const ray = HS.light.castRay(L.x, L.y, Math.atan2(-dy, -dx), d, eng.solid);
          if (ray < d - 0.15) continue;
          const inten = face * Math.pow(1 - d / L.r, 1.5) * L.gain;
          if (inten < 0.02) continue;
          ctx.strokeStyle = `rgba(${L.c[0]},${L.c[1]},${L.c[2]},${Math.min(0.85, inten)})`;
          ctx.beginPath();
          ctx.moveTo(e.x1 * TILE, e.y1 * TILE);
          ctx.lineTo(e.x2 * TILE, e.y2 * TILE);
          ctx.stroke();
        }
      }
    }

    // ── entities ──
    if (inRound) {
      // decoy cores: identical to the hider, plus a human-only dashed hint
      for (const d of S.decoys) {
        drawCore(d.x, d.y, h.dim ? 5 : 6, '#eafffb', '#5df2d6');
        ctx.globalCompositeOperation = 'source-over';
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = 'rgba(200,210,232,0.28)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(d.x * TILE, d.y * TILE, 11, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalCompositeOperation = 'lighter';
      }

      // hider core + breathing aura (grows above the plane, shrinks beneath)
      const hScale = hz >= 0 ? 1 + 0.28 * hz : Math.max(0.55, 1 + 0.2 * hz);
      const hdy = h.y - hz * 0.28;
      if (hz > 0.1) { // detached shadow on the floor it left behind
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(h.x * TILE, h.y * TILE, 8 * (1 + 0.3 * hz), 4 * (1 + 0.3 * hz), 0, 0, TAU);
        ctx.fill();
      }
      if (Math.abs(hz) > 0.5) drawAltitudeStack(h.x, h.y, hz, [93, 242, 214]);
      if (hz < -0.1) ctx.globalAlpha = Math.max(0.35, 1 + 0.35 * hz);
      drawCore(h.x, hdy, (h.dim ? 4 : 6) * hScale, '#ffffff', '#5df2d6');
      const auraR = ((h.dim ? 8 : 11) + Math.sin(t * 2.6) * 2) * hScale;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(${Math.abs(hz) > 0.2 ? '178,107,255' : '93,242,214'},${h.dim ? 0.22 : 0.38})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(h.x * TILE, hdy * TILE, auraR, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;

      // seeker (z pulls it toward or away from the camera)
      ctx.globalCompositeOperation = 'source-over';
      const sScale = szf >= 0 ? 1 + 0.25 * szf : Math.max(0.55, 1 + 0.16 * szf);
      const zOff = szf * 14;
      const sx = sfx * TILE, sy = sfyy * TILE - pounceH - zOff;
      if (pounceH > 1 || szf > 0.1) { // shadow stays on the floor
        ctx.fillStyle = `rgba(0,0,0,${0.5 / (1 + Math.max(0, szf) * 0.5)})`;
        ctx.beginPath();
        ctx.ellipse(sfx * TILE, sfyy * TILE, 10 * sScale, 5 * sScale, 0, 0, TAU);
        ctx.fill();
      }
      if (Math.abs(szf) > 0.5) drawAltitudeStack(sfx, sfyy, szf, [255, 180, 84]);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(sk.facing);
      ctx.scale(sScale, sScale);
      const flick = (stunned ? 0.45 + Math.sin(t * 22) * 0.25 : 1)
        * (szf < -0.1 ? Math.max(0.3, 1 + 0.3 * szf) : 1);
      ctx.globalAlpha = flick;
      ctx.fillStyle = stunned ? '#8a6a45' : '#ffb454';
      ctx.strokeStyle = 'rgba(255,220,170,0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(12, 0); ctx.lineTo(-9, -8); ctx.lineTo(-4, 0); ctx.lineTo(-9, 8);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
      if (stunned) {
        ctx.strokeStyle = `rgba(255,93,93,${0.4 + Math.sin(t * 10) * 0.2})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(sx, sy, 15, 0, TAU); ctx.stroke();
      }

      // a running daemon shows as twin amber motes orbiting the hunter —
      // the body is executing a program it wrote for itself
      if (S.bot && !S.bot.halted && S.phase === 'play') {
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 2; i++) {
          const oa = t * 2.6 + i * Math.PI;
          const ox = sx + Math.cos(oa) * 19, oy = sy + Math.sin(oa) * 8 - 2;
          ctx.fillStyle = 'rgba(255,200,130,0.85)';
          ctx.beginPath(); ctx.arc(ox, oy, 2.1, 0, TAU); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(255,180,84,0.75)';
        ctx.font = '700 8px "Martian Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('⟐v' + S.bot.gen + (S.botMode === 'discover' ? ' ⌕' : ''), sx, sy - 18);
        ctx.textAlign = 'start';
      }

      // seeker vitals, drawn at the hunter itself — the human sees the
      // agent's budget; the agent never sees this
      if (S.phase === 'play') {
        const gx = sfx * TILE, gy = sfyy * TILE;
        const pw = 9, gap = 3;
        const x0 = gx - (CFG.AP_MAX * pw + (CFG.AP_MAX - 1) * gap) / 2;
        for (let i = 0; i < CFG.AP_MAX; i++) {
          const fill = Math.max(0, Math.min(1, sk.ap - i));
          ctx.fillStyle = 'rgba(10,12,20,0.75)';
          ctx.fillRect(x0 + i * (pw + gap), gy + 16, pw, 4);
          if (fill > 0) {
            ctx.fillStyle = `rgba(255,180,84,${0.35 + fill * 0.55})`;
            ctx.fillRect(x0 + i * (pw + gap), gy + 16, pw * fill, 4);
          }
        }
        // the auto-sonar's fuse: the human can see the next ping coming
        const pcd = S.nextSonarAt - t;
        if (pcd > 0 && pcd <= CFG.SONAR_PERIOD) {
          const prog = 1 - pcd / CFG.SONAR_PERIOD;
          ctx.strokeStyle = 'rgba(255,180,84,0.5)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(gx, gy, 17, -Math.PI / 2, -Math.PI / 2 + prog * TAU);
          ctx.stroke();
        }
        const stunLeft = sk.stunnedUntil - t;
        if (stunLeft > 0) {
          ctx.fillStyle = '#ff5d5d';
          ctx.font = '700 10px "Martian Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText('STUNNED ' + stunLeft.toFixed(1), gx, gy + 33);
          ctx.textAlign = 'start';
        }
      }

      // hovering slabs — floors hung above the world by an ascended hider.
      // translucent, so the human still sees what shelters beneath them
      for (const fl of S.floors) {
        const bob = Math.sin(t * 1.7 + fl.x * 1.3) * 1.5;
        const lift = 12 + bob;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(0,0,0,0.32)'; // the shade it casts
        ctx.fillRect(fl.x * TILE + 2, fl.y * TILE + 2, TILE - 4, TILE - 4);
        const sx0 = fl.x * TILE + 3, sy0 = fl.y * TILE + 3 - lift;
        ctx.fillStyle = 'rgba(178,107,255,0.16)';
        ctx.fillRect(sx0, sy0, TILE - 6, TILE - 6);
        ctx.strokeStyle = 'rgba(214,178,255,0.65)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(sx0, sy0, TILE - 6, TILE - 6);
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(178,107,255,${0.05 + 0.03 * Math.sin(t * 2.4 + fl.y)})`;
        ctx.fillRect(sx0, sy0, TILE - 6, TILE - 6);
      }
    }

    // ── placement ghost ──
    if (view && view.inCanvas && view.mode && S.phase === 'play') {
      const cx = view.cellX, cy = view.cellY;
      ctx.globalCompositeOperation = 'source-over';
      const ok = ghostValid(view.mode, cx, cy, S, CFG, eng);
      const col = ok ? 'rgba(93,242,214,0.75)' : 'rgba(255,93,93,0.75)';
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      if (view.mode === 'wall') {
        ctx.strokeRect(cx * TILE + 2, cy * TILE + 2, TILE - 4, TILE - 4);
        ctx.fillStyle = ok ? 'rgba(93,242,214,0.12)' : 'rgba(255,93,93,0.10)';
        ctx.fillRect(cx * TILE + 2, cy * TILE + 2, TILE - 4, TILE - 4);
      } else if (view.mode === 'floor') {
        ctx.strokeStyle = ok ? 'rgba(214,178,255,0.8)' : 'rgba(255,93,93,0.75)';
        ctx.strokeRect(cx * TILE + 3, cy * TILE + 3 - 12, TILE - 6, TILE - 6);
        ctx.fillStyle = ok ? 'rgba(178,107,255,0.12)' : 'rgba(255,93,93,0.10)';
        ctx.fillRect(cx * TILE + 3, cy * TILE + 3 - 12, TILE - 6, TILE - 6);
      } else if (view.mode === 'decoy') {
        ctx.beginPath(); ctx.arc((cx + 0.5) * TILE, (cy + 0.5) * TILE, TILE * 0.32, 0, TAU); ctx.stroke();
      } else if (view.mode === 'scrub') {
        ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.arc((cx + 0.5) * TILE, (cy + 0.5) * TILE, CFG.SCRUB_RADIUS * TILE, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // reality glitch — chromatic ghosts, strip tears, a violet wash
    const gl = S.meta.glitch;
    if (gl > 0.02) {
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.25 * gl;
      ctx.drawImage(lightC, 8 * gl, 0);
      ctx.drawImage(lightC, -8 * gl, 2 * gl);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      const tears = 1 + Math.floor(3 * gl);
      for (let i = 0; i < tears; i++) {
        const yy = Math.random() * (H - 12);
        const hh = 4 + Math.random() * 10;
        const off = (Math.random() - 0.5) * 60 * gl;
        ctx.drawImage(lightC, 0, yy, W, hh, off, yy, W, hh);
      }
      ctx.fillStyle = `rgba(178,107,255,${0.07 * gl})`;
      ctx.fillRect(0, 0, W, H);
    }

    // the capture tear-storm — reality rips red for a heartbeat
    const capFx = S.fx.find((f) => f.type === 'capture');
    if (capFx) {
      const cp = Math.min(1, (t - capFx.t0) / capFx.dur);
      const inten = 1 - cp;
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.4 * inten;
      ctx.drawImage(lightC, 12 * inten, 0);
      ctx.drawImage(lightC, -12 * inten, 4 * inten);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      const tears = 2 + Math.floor(5 * inten);
      for (let i = 0; i < tears; i++) {
        const yy = Math.random() * (H - 14);
        const hh = 5 + Math.random() * 12;
        const off = (Math.random() - 0.5) * 90 * inten;
        ctx.drawImage(lightC, 0, yy, W, hh, off, yy, W, hh);
      }
      ctx.fillStyle = `rgba(255,60,60,${0.14 * inten})`;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(vignetteC, 0, 0);

    // last 30 seconds: the edges of the world pulse red
    if (S.phase === 'play') {
      const left = S.roundEndsAt - t;
      if (left <= 30) {
        const urgency = 1 - left / 30;
        ctx.globalAlpha = (0.2 + 0.5 * urgency) * (0.65 + 0.35 * Math.sin(t * 5));
        ctx.drawImage(dangerC, 0, 0);
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }

  const rnd = (a, b) => a + Math.random() * (b - a);

  // ── the 3D cone: light from a body that is no longer on the plane ──
  // low altitude: an oblique ellipse thrown ahead of the flier. high
  // altitude: a wide, near-circular pool straight beneath it. a beam
  // connects the floating body to its own footprint.
  function drawSkyCone(CFG, sfx, sfyy, szf, facing, coneAlpha, pounceH) {
    const k = Math.min(1, szf / CFG.Z_MAX_SEEKER);
    const range = CFG.VIEW_RANGE + 3.5 * szf;
    const ahead = (1 - k) * range * 0.45;
    const px = sfx + Math.cos(facing) * ahead;
    const py = sfyy + Math.sin(facing) * ahead;
    const rx = range * (0.5 + 0.5 * k) * TILE;
    const squash = 0.55 + 0.45 * k; // oblique ellipse → circle overhead

    // floor pool (no wall clipping — the light arrives from above)
    lctx.save();
    lctx.translate(px * TILE, py * TILE);
    lctx.rotate(facing);
    lctx.scale(1, squash);
    const g = lctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, `rgba(255,195,110,${0.32 * coneAlpha})`);
    g.addColorStop(0.55, `rgba(255,175,85,${0.15 * coneAlpha})`);
    g.addColorStop(1, 'rgba(255,150,60,0)');
    lctx.fillStyle = g;
    lctx.beginPath(); lctx.arc(0, 0, rx, 0, TAU); lctx.fill();
    lctx.strokeStyle = `rgba(255,205,130,${0.2 * coneAlpha})`;
    lctx.lineWidth = 2;
    lctx.beginPath(); lctx.arc(0, 0, rx * 0.98, 0, TAU); lctx.stroke();
    lctx.restore();

    // the beam: apex at the floating body, opening onto the pool
    const ax = sfx * TILE, ay = sfyy * TILE - pounceH - szf * 14;
    const cxp = px * TILE, cyp = py * TILE;
    const ddx = cxp - ax, ddy = cyp - ay;
    const dd = Math.hypot(ddx, ddy) || 1;
    const nx = -ddy / dd, ny = ddx / dd;
    const halfW = rx * 0.88 * (0.8 + 0.2 * squash);
    const bg = lctx.createLinearGradient(ax, ay, cxp, cyp);
    bg.addColorStop(0, `rgba(255,215,150,${0.22 * coneAlpha})`);
    bg.addColorStop(1, `rgba(255,170,80,${0.03 * coneAlpha})`);
    lctx.fillStyle = bg;
    lctx.beginPath();
    lctx.moveTo(ax, ay);
    lctx.lineTo(cxp + nx * halfW, cyp + ny * halfW);
    lctx.lineTo(cxp - nx * halfW, cyp - ny * halfW);
    lctx.closePath();
    lctx.fill();
  }

  // ── the triangle trace: runes, drawn edges, and the live thread ──
  function strand(x1, y1, x2, y2, alpha, width) {
    lctx.globalAlpha = Math.min(1, alpha);
    lctx.strokeStyle = 'rgba(178,107,255,0.9)';
    lctx.lineWidth = 2 + width * 2;
    lctx.beginPath(); lctx.moveTo(x1, y1); lctx.lineTo(x2, y2); lctx.stroke();
    lctx.strokeStyle = 'rgba(235,220,255,0.95)';
    lctx.lineWidth = Math.max(1, width);
    lctx.beginPath(); lctx.moveTo(x1, y1); lctx.lineTo(x2, y2); lctx.stroke();
  }

  function drawLightconeTrace(S, t, who, ax, ay) {
    const m = S.meta[who];
    if (!m || m.unlocked || m.v < 0) return;
    const eng = E();
    const V = eng.lightcone(who).map(([x, y]) => [(x + 0.5) * TILE, (y + 0.5) * TILE]);
    const k = Math.min(1, (m.laps * 3 + (m.links % 3)) / (eng.CFG.TRI_REPS * 3));
    const rot = m.rot || 1;
    const shimmer = 0.75 + 0.25 * Math.sin(t * 6);
    const spr = glowSprite(178, 107, 255);

    // runes at every vertex reached in the current chain
    const litCount = Math.min(3, m.links + 1);
    for (let i = 0; i < litCount; i++) {
      const vi = ((m.v - rot * i) % 3 + 3) % 3;
      const [gx, gy] = V[vi];
      const a = (0.35 + 0.6 * k) * (i === 0 ? 1 : 0.75) * shimmer;
      const sz = (0.6 + 0.8 * k) * TILE;
      lctx.globalAlpha = a * 0.8;
      lctx.drawImage(spr, gx - sz / 2, gy - sz / 2, sz, sz);
      lctx.globalAlpha = a;
      lctx.strokeStyle = 'rgba(214,178,255,1)';
      lctx.lineWidth = 1.5;
      lctx.save();
      lctx.translate(gx, gy);
      lctx.rotate(t * 0.9 + vi);
      const d0 = 8 + 6 * k;
      lctx.beginPath();
      lctx.moveTo(d0, 0); lctx.lineTo(0, d0); lctx.lineTo(-d0, 0); lctx.lineTo(0, -d0);
      lctx.closePath(); lctx.stroke();
      lctx.restore();
    }

    // edges already walked — a line forms, then strengthens lap after lap
    const edges = Math.min(3, m.links);
    for (let j = 1; j <= edges; j++) {
      const a2 = ((m.v - rot * j) % 3 + 3) % 3;
      const b2 = ((m.v - rot * (j - 1)) % 3 + 3) % 3;
      strand(V[a2][0], V[a2][1], V[b2][0], V[b2][1], (0.3 + 0.7 * k) * shimmer, 1 + 3 * k);
    }

    // the live thread from the last vertex to whoever is drawing the shape
    strand(V[m.v][0], V[m.v][1], ax * TILE, ay * TILE, 0.18 + 0.3 * k, 1);
    lctx.globalAlpha = 1;
  }

  // one-shot particle payloads for engine fx events
  function fxParticles(f, S, sfx, sfyy) {
    const Pt = HS.particles;
    const radial = (n, opt) => {
      for (let i = 0; i < n; i++) {
        const a0 = Math.random() * TAU, sp = rnd(opt.sp0, opt.sp1);
        Pt.spawn(Object.assign({
          x: f.x, y: f.y,
          vx: Math.cos(a0) * sp, vy: Math.sin(a0) * sp,
          rot: a0, life: rnd(opt.l0, opt.l1),
        }, opt.p));
      }
    };
    switch (f.type) {
      case 'noiseBurst':
        if (f.kind === 'construction') {
          radial(14, { sp0: 1.5, sp1: 4, l0: 0.4, l1: 0.8, p: { size: rnd(4, 7), color: [150, 245, 225], alpha: 0.85, shape: 'shard', drag: 3.5, spin: rnd(-9, 9) } });
        } else if (f.kind === 'aerosol hiss') {
          radial(22, { sp0: 0.4, sp1: 1.6, l0: 0.8, l1: 1.6, p: { size: rnd(8, 14), color: [255, 79, 195], alpha: 0.32, shape: 'dot', drag: 1.2 } });
        } else { // rapid footsteps
          radial(12, { sp0: 2, sp1: 5, l0: 0.25, l1: 0.5, p: { size: 5, color: [190, 255, 240], alpha: 0.85, shape: 'streak', drag: 2 } });
        }
        break;
      case 'build': // matter assembling inward
        for (let i = 0; i < 18; i++) {
          const a0 = Math.random() * TAU, r0 = rnd(0.9, 1.5);
          const px = f.x + Math.cos(a0) * r0, py = f.y + Math.sin(a0) * r0;
          Pt.spawn({ x: px, y: py, vx: (f.x - px) * 3.2, vy: (f.y - py) * 3.2, life: rnd(0.3, 0.5), size: 5, color: [93, 242, 214], alpha: 0.8, shape: 'streak' });
        }
        break;
      case 'shock': // pounce impact: debris + dust
        radial(18, { sp0: 2.5, sp1: 6.5, l0: 0.3, l1: 0.7, p: { size: rnd(4, 6), color: [255, 190, 110], alpha: 0.85, shape: Math.random() < 0.5 ? 'streak' : 'dot', drag: 3 } });
        radial(8, { sp0: 0.5, sp1: 1.4, l0: 0.8, l1: 1.3, p: { size: rnd(9, 14), color: [200, 160, 110], alpha: 0.2, shape: 'dot', drag: 1 } });
        break;
      case 'burst': { // shatter (decoy, capture, escape)
        const c = f.color === '#5df2d6' ? [120, 255, 235] : [255, 190, 110];
        radial(20, { sp0: 2, sp1: 7, l0: 0.4, l1: 0.9, p: { size: rnd(4, 7), color: c, alpha: 0.9, shape: 'shard', drag: 2.8, spin: rnd(-10, 10) } });
        break;
      }
      case 'scrub':
        radial(26, { sp0: 1, sp1: 3.2, l0: 0.6, l1: 1.2, p: { size: rnd(8, 13), color: [255, 79, 195], alpha: 0.38, shape: 'dot', drag: 2.2 } });
        break;
      case 'flash': // sonar ping origin
        radial(12, { sp0: 1.5, sp1: 4, l0: 0.3, l1: 0.6, p: { size: 5, color: [255, 210, 140], alpha: 0.8, shape: 'dot', drag: 2 } });
        break;
      case 'sniffFx': // air drawn INTO the hunter's nose
        for (let i = 0; i < 10; i++) {
          const a0 = Math.random() * TAU, r0 = rnd(1.0, 1.7);
          const px = f.x + Math.cos(a0) * r0, py = f.y + Math.sin(a0) * r0;
          Pt.spawn({ x: px, y: py, vx: (f.x - px) * 2.2, vy: (f.y - py) * 2.2, life: rnd(0.35, 0.55), size: 5, color: [255, 120, 210], alpha: 0.55, shape: 'dot' });
        }
        break;
      case 'scan':
        for (let i = 0; i < 6; i++) {
          const a0 = S.seeker.facing + rnd(-0.5, 0.5), sp = rnd(3, 6);
          Pt.spawn({ x: sfx, y: sfyy, vx: Math.cos(a0) * sp, vy: Math.sin(a0) * sp, life: rnd(0.3, 0.5), size: 4, color: [255, 190, 110], alpha: 0.5, shape: 'dot', drag: 1 });
        }
        break;
      case 'ring':
        radial(8, { sp0: 1.5, sp1: 3, l0: 0.3, l1: 0.5, p: { size: 4, color: [120, 255, 235], alpha: 0.7, shape: 'dot', drag: 2 } });
        break;
      case 'goFlash':
        radial(30, { sp0: 2, sp1: 9, l0: 0.4, l1: 0.9, p: { size: 5, color: [220, 240, 255], alpha: 0.6, shape: 'streak', drag: 2 } });
        break;
      case 'glyphFx':
        radial(14, { sp0: 1.5, sp1: 4.5, l0: 0.4, l1: 0.9, p: { size: rnd(4, 6), color: [178, 107, 255], alpha: 0.85, shape: 'shard', drag: 2.5, spin: rnd(-9, 9) } });
        radial(8, { sp0: 0.4, sp1: 1.2, l0: 0.8, l1: 1.4, p: { size: rnd(8, 12), color: [214, 178, 255], alpha: 0.3, shape: 'dot', drag: 1 } });
        break;
      case 'rune': // a vertex igniting — quieter than a glyph
        radial(8, { sp0: 1, sp1: 3, l0: 0.3, l1: 0.7, p: { size: rnd(3, 5), color: [178, 107, 255], alpha: 0.7, shape: 'shard', drag: 2.5, spin: rnd(-7, 7) } });
        break;
      case 'unlock':
        radial(30, { sp0: 2, sp1: 8, l0: 0.5, l1: 1.1, p: { size: rnd(4, 7), color: [178, 107, 255], alpha: 0.9, shape: 'shard', drag: 2, spin: rnd(-12, 12) } });
        radial(20, { sp0: 3, sp1: 10, l0: 0.3, l1: 0.7, p: { size: 5, color: [235, 220, 255], alpha: 0.8, shape: 'streak', drag: 1.5 } });
        break;
      case 'capture': // the hider's light shatters
        radial(36, { sp0: 2, sp1: 9, l0: 0.5, l1: 1.3, p: { size: rnd(5, 8), color: [120, 255, 235], alpha: 0.95, shape: 'shard', drag: 2.2, spin: rnd(-12, 12) } });
        radial(24, { sp0: 3, sp1: 11, l0: 0.3, l1: 0.8, p: { size: 5, color: [255, 230, 200], alpha: 0.9, shape: 'streak', drag: 1.8 } });
        radial(14, { sp0: 0.4, sp1: 1.6, l0: 1.2, l1: 2.2, p: { size: rnd(9, 14), color: [255, 90, 90], alpha: 0.3, shape: 'dot', drag: 0.8 } });
        break;
      case 'floorFx': // motes drawn upward into the condensing slab
        for (let i = 0; i < 14; i++) {
          const a0 = Math.random() * TAU, r0 = rnd(0.6, 1.2);
          const px = f.x + Math.cos(a0) * r0, py = f.y + Math.sin(a0) * r0;
          Pt.spawn({ x: px, y: py, vx: (f.x - px) * 2.5, vy: (f.y - py) * 2.5 - 1.2, life: rnd(0.35, 0.6), size: 4, color: [178, 107, 255], alpha: 0.7, shape: 'streak' });
        }
        break;
      case 'rewrite': // the hunter swallows its next self
        for (let i = 0; i < 16; i++) {
          const a0 = Math.random() * TAU, r0 = rnd(1.0, 1.8);
          const px = f.x + Math.cos(a0) * r0, py = f.y + Math.sin(a0) * r0;
          Pt.spawn({ x: px, y: py, vx: (f.x - px) * 2.8, vy: (f.y - py) * 2.8, life: rnd(0.35, 0.6), size: rnd(3, 5), color: [255, 200, 130], alpha: 0.8, shape: 'streak' });
        }
        radial(8, { sp0: 0.5, sp1: 1.5, l0: 0.6, l1: 1.1, p: { size: rnd(6, 10), color: [255, 180, 84], alpha: 0.3, shape: 'dot', drag: 1.2 } });
        break;
    }
  }

  // continuous ambience & trails
  function runEmitters(dt, S, CFG, sfx, sfyy) {
    const Pt = HS.particles;

    // drifting arena dust, always alive
    emit.ambient += dt * 3;
    while (emit.ambient >= 1) {
      emit.ambient--;
      Pt.spawn({
        x: Math.random() * CFG.COLS, y: Math.random() * CFG.ROWS,
        vx: rnd(-0.12, 0.12), vy: rnd(-0.12, 0.12),
        life: rnd(5, 10), size: rnd(3, 6), color: [140, 170, 235], alpha: 0.09, shape: 'dot',
      });
    }
    if (S.phase !== 'play') return;

    const h = S.hider;
    const dashing = S.t < h.dashUntil;
    if (h.speedNow > 0.3) {
      emit.hider += dt * (dashing ? 70 : 22);
      const ml = Math.hypot(h.moveX, h.moveY) || 1;
      while (emit.hider >= 1) {
        emit.hider--;
        Pt.spawn({
          x: h.x + rnd(-0.14, 0.14), y: h.y + rnd(-0.14, 0.14),
          vx: (-h.moveX / ml) * rnd(0.6, 1.4) + rnd(-0.3, 0.3),
          vy: (-h.moveY / ml) * rnd(0.6, 1.4) + rnd(-0.3, 0.3),
          life: rnd(0.35, 0.8), size: dashing ? 7 : 5,
          color: dashing ? [190, 255, 240] : [93, 242, 214],
          alpha: dashing ? 0.75 : 0.4,
          shape: dashing && Math.random() < 0.5 ? 'streak' : 'dot', drag: 2.5,
        });
      }
    }

    // seeker sheds embers while it moves — driving, gliding, or mid-pounce
    const skMoving = S.seeker.pounce || S.seeker.drive
      || Math.hypot(S.seeker.fx - S.seeker.x, S.seeker.fy - S.seeker.y) > 0.05;
    if (skMoving) {
      emit.seeker += dt * 26;
      while (emit.seeker >= 1) {
        emit.seeker--;
        Pt.spawn({
          x: sfx + rnd(-0.15, 0.15), y: sfyy + rnd(-0.15, 0.15),
          vx: rnd(-0.4, 0.4), vy: rnd(-0.4, 0.4),
          life: rnd(0.4, 0.8), size: 5, color: [255, 180, 84], alpha: 0.55, shape: 'dot', drag: 2,
        });
      }
    }

    // decoys leak orbiting motes — same as nothing the agent can see
    emit.decoy += dt * 2.5 * S.decoys.length;
    while (emit.decoy >= 1 && S.decoys.length) {
      emit.decoy--;
      const d = S.decoys[(Math.random() * S.decoys.length) | 0];
      const a0 = Math.random() * TAU;
      Pt.spawn({
        x: d.x + Math.cos(a0) * 0.4, y: d.y + Math.sin(a0) * 0.4,
        vx: -Math.sin(a0) * 0.5, vy: Math.cos(a0) * 0.5,
        life: 1.2, size: 4, color: [93, 242, 214], alpha: 0.45, shape: 'dot', drag: 0.4,
      });
    }

    // the scent trail twinkles
    if (S.scent.length && Math.random() < dt * 10) {
      const n = S.scent[(Math.random() * S.scent.length) | 0];
      const s = Math.max(0, 1 - (S.t - n.t) / CFG.SCENT_LIFE);
      if (s > 0.25) {
        Pt.spawn({ x: n.x, y: n.y, vx: 0, vy: -0.18, life: 0.5, size: 4, color: [255, 150, 220], alpha: 0.7 * s, shape: 'dot' });
      }
    }

    // sparkles ride the sonar ring
    for (const pg of S.pings) {
      const age = S.t - pg.t0;
      if (age < 1.2 && Math.random() < dt * 45) {
        const a0 = Math.random() * TAU, r = age * 7.5;
        Pt.spawn({
          x: pg.x + Math.cos(a0) * r, y: pg.y + Math.sin(a0) * r,
          vx: Math.cos(a0) * 0.4, vy: Math.sin(a0) * 0.4,
          life: 0.35, size: 4, color: [255, 200, 120], alpha: 0.7, shape: 'dot',
        });
      }
    }
  }

  function ghostValid(mode, cx, cy, S, CFG, eng) {
    if (cx < 0 || cy < 0 || cx >= CFG.COLS || cy >= CFG.ROWS) return false;
    const sk = S.seeker, h = S.hider;
    if (mode === 'wall') {
      return !eng.solid(cx, cy)
        && !(cx === Math.floor(h.x) && cy === Math.floor(h.y))
        && Math.max(Math.abs(cx - sk.x), Math.abs(cy - sk.y)) >= 2
        && S.playerWalls.length < CFG.WALL_MAX
        && h.energy >= CFG.WALL_COST;
    }
    if (mode === 'decoy') {
      return !eng.solid(cx, cy)
        && Math.max(Math.abs(cx - sk.x), Math.abs(cy - sk.y)) >= 2
        && S.decoys.length < CFG.DECOY_MAX
        && h.energy >= CFG.DECOY_COST;
    }
    if (mode === 'scrub') {
      return Math.hypot(h.x - (cx + 0.5), h.y - (cy + 0.5)) <= CFG.SCRUB_REACH
        && h.energy >= CFG.SCRUB_COST;
    }
    if (mode === 'floor') {
      return S.meta.hider.unlocked
        && !eng.solid(cx, cy)
        && !S.floorSet.has(eng.key(cx, cy))
        && S.floors.length < CFG.FLOOR_MAX
        && h.energy >= CFG.FLOOR_COST;
    }
    return false;
  }

  // stacked rings on the floor, one per plane of altitude — the human can
  // count exactly how many worlds up (or down) an actor has gone
  function drawAltitudeStack(x, y, zf, c) {
    const lv = Math.round(Math.abs(zf));
    if (lv < 1) return;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 1; i <= lv; i++) {
      ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0.08, 0.3 - i * 0.06)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(x * TILE, y * TILE, 11 + i * 7, 5 + i * 3.2, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(214,178,255,0.85)';
    ctx.font = '700 9px "Martian Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText((zf > 0 ? 'z+' : 'z−') + lv, x * TILE, y * TILE + 18 + lv * 3.2 + 10);
    ctx.textAlign = 'start';
  }

  function drawCore(x, y, r, inner, outer) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = outer;
    ctx.beginPath(); ctx.arc(x * TILE, y * TILE, r + 3, 0, TAU); ctx.fill();
    ctx.fillStyle = inner;
    ctx.beginPath(); ctx.arc(x * TILE, y * TILE, r * 0.55, 0, TAU); ctx.fill();
  }

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
  }

  HS.render = { init, draw };
})();
