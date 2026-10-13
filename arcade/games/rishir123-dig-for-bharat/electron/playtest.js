/* A full season, played through the real input path: walk with the
   physics, hold the button to dig, brush what comes up. Reports what
   a player would actually experience — distances, times, stamina. */
new Promise((resolve) => {
  const DT = 1 / 60;
  const log = [];
  let asked = false;
  const t0 = Date.now();

  const poll = setInterval(() => {
    const d = window.__dig;
    if (!d) { if (Date.now() - t0 > 40000) { clearInterval(poll); resolve({ error: "never booted" }); } return; }
    if (!asked) { asked = true; d.menu.hide(); d.openSite(0); return; }
    if (!d.world() || !d.player() || !d.mesher()) {
      if (Date.now() - t0 > 60000) { clearInterval(poll); resolve({ error: "world never built" }); }
      return;
    }
    clearInterval(poll);
    try { resolve(play(d)); } catch (e) { resolve({ error: e.message, stack: String(e.stack).slice(0, 400) }); }
  }, 200);

  function keys(p, o) { p.keys = Object.assign(Object.create(null), o); }

  /* climb out of a shaft by jumping and setting spoil underfoot */
  function climbOut(d, budget) {
    const p = d.player();
    let t = 0, placed = 0, tries = 0;
    const stepN = (n) => { for (let k = 0; k < n && t < budget; k++) { d.stepLogic(DT); t += DT; } };
    while (t < budget && tries++ < 40) {
      const drop = d.world().surfaceAt(Math.floor(p.pos.x), Math.floor(p.pos.z)) - p.pos.y;
      if (drop <= 1.2) break;
      p.pitch = -1.5;
      /* hold the jump across at least one physics tick — the model runs at
         20 Hz, so a key tapped for a single 60 Hz frame is never seen */
      keys(p, { Space: true });
      stepN(5);
      keys(p, {});
      for (let k = 0; k < 30 && !p.grounded && t < budget; k++) {
        d.updateTarget();
        if (d.placeBlock() === "placed") placed++;
        d.stepLogic(DT); t += DT;
      }
      stepN(8);
    }
    keys(p, {});
    return { t: +t.toFixed(1), placed };
  }

  /* walk to a point, jumping when progress stalls (a full block needs one) */
  function walkTo(d, tx, tz, budget) {
    const p = d.player();
    let t = 0, stuck = 0, last = Infinity, jumps = 0;
    while (t < budget) {
      const dx = tx - p.pos.x, dz = tz - p.pos.z;
      const dist = Math.hypot(dx, dz);
      /* stop beside the landmark, not on it — a cairn and a tree trunk are solid */
      if (dist < 2.5) { keys(p, {}); return { ok: true, t: +t.toFixed(1), jumps }; }
      p.yaw = Math.atan2(-dx, -dz);
      const k = { KeyW: true, ShiftLeft: true };
      /* hold the jump across a physics tick — the model runs at 20 Hz, so a
         key set for one 60 Hz frame is invisible two times in three */
      if (Math.abs(last - dist) < 0.004) { stuck += DT; } else stuck = 0;
      last = dist;
      if (stuck > 0.15) k.Space = true;
      keys(p, k);
      d.stepLogic(DT);
      t += DT;
      if (stuck > 0.15) {
        jumps++;
        for (let h = 0; h < 8 && t < budget; h++) { d.stepLogic(DT); t += DT; }
        stuck = 0;
      }
    }
    keys(p, {});
    return { ok: false, t: +t.toFixed(1), jumps, short: +Math.hypot(tx - p.pos.x, tz - p.pos.z).toFixed(1) };
  }

  /* stand still, look down, hold the button until something appears */
  function digHere(d, wantIndex, budget) {
    const p = d.player();
    keys(p, {});
    p.vx = 0; p.vz = 0;
    /* stand in the middle of the square. Off-centre, the 0.6-wide player
       straddles two columns, never drops into the shaft, and the floor
       walks out of reach — a human notices and steps in; this does not. */
    p.pos.x = Math.floor(p.pos.x) + 0.5;
    p.pos.z = Math.floor(p.pos.z) + 0.5;
    p.prev.copy(p.pos);
    p.pitch = -1.5;
    const before = d.G.stamina;
    let t = 0;
    d.setDigging(true);
    while (t < budget && !d.findObjs.has(wantIndex) && d.G.found.indexOf(wantIndex) < 0) {
      d.stepLogic(DT); t += DT;
    }
    d.setDigging(false);
    return { t: +t.toFixed(1), stamina: before - d.G.stamina, exposed: d.findObjs.has(wantIndex) };
  }

  function lift(d, tool, idx) {
    const p = d.player();
    d.setTool(tool);
    for (let i = 0; i < 90; i++) {
      d.stepLogic(DT);
      const o = d.findObjs.get(idx);
      if (o && !o.lifted) {                            // look at it, as a player would
        const dx = o.group.position.x - d.camera.position.x;
        const dy = o.group.position.y - d.camera.position.y;
        const dz = o.group.position.z - d.camera.position.z;
        p.yaw = Math.atan2(-dx, -dz);
        p.pitch = Math.atan2(dy, Math.hypot(dx, dz));
      }
      d.updateTarget();
      d.clickUse();
      if (d.G.found.indexOf(idx) >= 0) break;
    }
    return d.G.found.length;
  }

  function play(d) {
    const w = d.world(), p = d.player(), G = d.G;
    p.locked = true;
    const spawn = { x: p.pos.x, z: p.pos.z };

    /* what can you actually see from where you start? */
    const sightings = w.landmarks.map((lm, i) => ({
      clue: i + 1, type: lm.type,
      dist: +Math.hypot(lm.x - spawn.x, lm.z - spawn.z).toFixed(0),
      depth: G.site.finds[i].dig.depth
    }));

    const rounds = [];
    let wall = 0;
    for (let i = 0; i < 6; i++) {
      const lm = w.landmarks[i], f = G.site.finds[i];
      const before = G.stamina;
      const out = climbOut(d, 60);
      const walk = walkTo(d, lm.x + 0.5, lm.z + 0.5, 60);
      d.setTool(f.fragile ? "trowel" : "trowel");
      const dig = digHere(d, i, 22);
      const got = dig.exposed ? lift(d, f.fragile ? "dental" : "brush", i) : G.found.length;
      wall += walk.t + dig.t;
      rounds.push({
        clue: i + 1, landmark: lm.type, walked: walk.t + "s" + (walk.ok ? "" : " STUCK " + walk.short + "m short"),
        jumps: walk.jumps, climbedOut: out.placed, dug: dig.t + "s", staminaUsed: before - G.stamina,
        lifted: G.found.indexOf(i) >= 0, totalFound: G.found.length
      });
      if (G.found.indexOf(i) < 0) rounds[rounds.length - 1].failed = true;
    }

    /* the side systems */
    const spoilBefore = (() => { let n = 0; for (const v of d.spoil.values()) n += v; return n; })();
    climbOut(d, 40);
    const nearDatum = walkTo(d, 64 + 5, 64 + 1, 60);
    d.useStation();
    const spoilAfter = (() => { let n = 0; for (const v of d.spoil.values()) n += v; return n; })();

    return {
      site: G.site.name,
      raga: d.audio.ragaLabel ? d.audio.ragaLabel() : "",
      sightings,
      rounds,
      finished: G.found.length + " / 6",
      keystone: G.keystone,
      merit: G.merit,
      staminaLeft: G.stamina,
      staminaBudget: G.staminaMax,
      spoilCollected: spoilBefore,
      sieveWorked: spoilAfter < spoilBefore,
      walkedToDatum: nearDatum.ok,
      simulatedMinutes: +(wall / 60).toFixed(1)
    };
  }
});
