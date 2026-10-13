/* Injected into the running game by `npm run selftest`.
   A plain file rather than a string inside main.cjs, so there is no
   escaping layer to get wrong. Evaluates to a Promise of a report. */
new Promise((resolve) => {
  const started = Date.now();
  let asked = false;
  const poll = setInterval(() => {
    const d = window.__dig;
    if (!d) {
      if (Date.now() - started > 40000) { clearInterval(poll); resolve({ error: "game never booted" }); }
      return;
    }
    /* the game opens on the title menu now, so start a season first */
    if (!asked) { asked = true; d.menu.hide(); d.openSite(0); return; }
    if (!d.world() || !d.player() || !d.mesher()) {
      if (Date.now() - started > 60000) { clearInterval(poll); resolve({ error: "timeout building world" }); }
      return;
    }
    clearInterval(poll);
    try {
      const w = d.world(), p = d.player(), DT = 1 / 60;
      const step = d.stepLogic || d.step;   // logic-only when available
      const physics = d.physicsSelfTest();
      const lm = w.landmarks[0], f = d.G.site.finds[0];

      p.locked = true;
      p.pos.set(lm.x + 0.5, w.heightAt(lm.x, lm.z) + 1.4, lm.z + 0.5);
      p.prev.copy(p.pos);
      p.vx = p.vy = p.vz = 0;
      p.yaw = 0.6; p.pitch = -1.5;
      for (let i = 0; i < 20; i++) step(DT);

      /* hold the button and let the mining loop run, exactly as a player would */
      const mark = (m) => { try { console.log("SELFTEST " + m); } catch (e) {} };
      mark("world ready, digging at " + lm.type);
      d.setDigging(true);
      let frames = 0, brushedAt = 0;
      while (d.G.found.length === 0 && frames++ < 1600) {
        step(DT);
        d.updateTarget();
        d.updateMining(DT);
        if (d.G.tool !== "brush" && frames > 900) {
          d.setDigging(false); d.setTool("brush"); brushedAt = frames;
        }
        if (d.G.tool === "brush") { d.updateTarget(); d.clickUse(); }
      }
      d.setDigging(false);
      mark("dig loop done after " + frames + " frames, found=" + d.G.found.length);

      let spoil = 0;
      for (const v of d.spoil.values()) spoil += v;

      /* Backfill. Needs genuinely flat ground: aiming down a shaft you
         are standing in places into your own head (refused on purpose),
         and aiming over a slope hits nothing within reach. So find three
         level blocks in a row first, then aim at the middle one. */
      let gx = -1, gy = -1, gz = -1;
      outer:
      for (let sx = 20; sx < 108 && gx < 0; sx++)
        for (let sz = 22; sz < 108; sz++) {
          const h = w.heightAt(sx, sz);
          if (h !== w.heightAt(sx, sz - 1) || h !== w.heightAt(sx, sz - 2)) continue;
          if (w.get(sx, h + 1, sz) !== 0 || w.get(sx, h + 1, sz - 1) !== 0) continue;   // no scrub or trunk
          if (w.get(sx, h + 2, sz - 1) !== 0) continue;
          gx = sx; gy = h; gz = sz; break outer;
        }

      let placeReason = "no flat ground found", backfilled = 0, placed = spoil, diag = null;
      if (gx >= 0) {
        p.pos.set(gx + 0.5, gy + 1.02, gz + 0.5); p.prev.copy(p.pos);
        p.vx = p.vy = p.vz = 0;
        p.pitch = -0.9; p.yaw = 0.0;                 // ~1.3 blocks ahead, one column over
        d.setTool("trowel");
        for (let i = 0; i < 12; i++) step(DT);
        d.updateTarget();
        placeReason = d.placeBlock();
        placed = 0;
        for (const v of d.spoil.values()) placed += v;
        backfilled = spoil - placed;
        diag = { standOn: [gx, gy, gz], playerY: +p.pos.y.toFixed(2) };
      }

      /* then / now: the city must differ from the buried world, and
         digging must be refused while you are standing in it */
      const wNow = [];
      for (let i = 0; i < 4000; i++) wNow.push(w.blocks[i * 97 % w.blocks.length]);
      d.toggleView();
      const inThen = w.view === "then";
      let diff = 0;
      for (let i = 0; i < 4000; i++) if (w.blocks[i * 97 % w.blocks.length] !== wNow[i]) diff++;
      const stamBefore = d.G.stamina;
      d.setDigging(true);
      for (let i = 0; i < 60; i++) { step(DT); d.updateTarget(); d.updateMining(DT); }
      d.setDigging(false);
      const digRefused = d.G.stamina === stamBefore;
      d.toggleView();
      const backToNow = w.view === "now";

      resolve({
        thenNow: { entered: inThen, blocksDiffer: diff, digRefused, backToNow,
                   labels: (w.cityLabels || []).length },
        chunkMeshes: d.mesher().group.children.length,
        landmarks: w.landmarks.map((l) => l.type).join(","),
        physics: physics,
        clue1Target: f.dig,
        found: d.G.found.length,
        solved: d.G.solved,
        merit: d.G.merit,
        stamina: d.G.stamina,
        spoilAfterDigging: spoil,
        spoilAfterBackfill: placed,
        backfillPlacedBlocks: backfilled,
        backfillReason: placeReason,
        backfillDiag: diag,
        spoilKindsHeld: [...d.spoil.entries()].filter(function (e) { return e[1] > 0; }).length,
        tools: Object.keys(d.G).length ? undefined : undefined,
        stations: d.world().stations ? d.world().stations.map(function (t) { return t.kind; }).join(",") : "none",
        framesToFind: frames,
        brushedAtFrame: brushedAt
      });
    } catch (e) {
      resolve({ error: String(e && e.message), where: String(e && e.stack).slice(0, 300) });
    }
  }, 250);
});
