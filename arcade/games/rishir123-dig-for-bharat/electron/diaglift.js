/* Two focused checks: can you get out of a shaft you dug, and does the
   season still complete when the walking is taken out of the equation. */
new Promise((resolve) => {
  const DT = 1 / 60;
  let asked = false; const t0 = Date.now();
  const poll = setInterval(() => {
    const d = window.__dig;
    if (!d) { if (Date.now() - t0 > 40000) { clearInterval(poll); resolve({ error: "no boot" }); } return; }
    if (!asked) { asked = true; d.menu.hide(); d.openSite(0); return; }
    if (!d.world() || !d.player() || !d.mesher()) return;
    clearInterval(poll);
    try { resolve(run(d)); } catch (e) { resolve({ error: e.message, stack: String(e.stack).slice(0, 300) }); }
  }, 200);

  const keys = (p, o) => { p.keys = Object.assign(Object.create(null), o); };

  function run(d) {
    const w = d.world(), p = d.player(), G = d.G;
    p.locked = true;
    const out = {};

    /* ---- 1. scramble out of a five-deep shaft ---- */
    const sx = 64, sz = 70, sy = w.heightAt(sx, sz);
    for (let k = 0; k < 5; k++) w.breakBlock(sx, sy - k, sz);
    d.mesher().flushDirty();
    p.pos.set(sx + 0.5, sy - 4, sz + 0.5); p.prev.copy(p.pos);
    p.vx = p.vy = p.vz = 0; p.yaw = 0; p.pitch = 0;
    for (let i = 0; i < 20; i++) d.stepLogic(DT);
    const startY = p.pos.y;
    keys(p, { KeyW: true, Space: true });          // press into the wall and hold jump
    let t = 0;
    while (t < 12 && p.pos.y < sy) { d.stepLogic(DT); t += DT; }
    keys(p, {});
    out.scramble = {
      shaftDepth: 5, startY: +startY.toFixed(1), endY: +p.pos.y.toFixed(1),
      rimY: sy, climbed: +(p.pos.y - startY).toFixed(1),
      seconds: +t.toFixed(1), escaped: p.pos.y >= sy - 0.5
    };

    /* ---- 2. all six finds, placed at each landmark ---- */
    const perClue = [];
    for (let i = 0; i < 6; i++) {
      const lm = w.landmarks[i], f = G.site.finds[i];
      p.pos.set(lm.x + 0.5, w.heightAt(lm.x, lm.z) + 1.4, lm.z + 0.5);
      p.prev.copy(p.pos); p.vx = p.vy = p.vz = 0;
      p.yaw = 0; p.pitch = -1.5;
      for (let k = 0; k < 20; k++) d.stepLogic(DT);
      const before = G.stamina;
      d.setTool(f.fragile ? "trowel" : "pick");
      d.setDigging(true);
      let tt = 0;
      while (tt < 30 && !d.findObjs.has(i)) { d.stepLogic(DT); tt += DT; }
      d.setDigging(false);
      let lifted = false;
      if (d.findObjs.has(i)) {
        d.setTool(f.fragile ? "dental" : "brush");
        for (let k = 0; k < 90; k++) {
          const o = d.findObjs.get(i);
          if (o && !o.lifted) {
            const dx = o.group.position.x - d.camera.position.x;
            const dy = o.group.position.y - d.camera.position.y;
            const dz = o.group.position.z - d.camera.position.z;
            p.yaw = Math.atan2(-dx, -dz);
            p.pitch = Math.atan2(dy, Math.hypot(dx, dz));
          }
          d.stepLogic(DT); d.updateTarget(); d.clickUse();
          if (G.found.indexOf(i) >= 0) { lifted = true; break; }
        }
      }
      perClue.push({ clue: i + 1, landmark: lm.type, depth: f.dig.depth,
                     digSeconds: +tt.toFixed(1), stamina: before - G.stamina, lifted });
    }
    out.season = perClue;
    out.finished = G.found.length + " / 6";
    out.keystone = G.keystone;
    out.merit = G.merit;
    out.staminaLeft = G.stamina;
    out.staminaBudget = G.staminaMax;
    out.clueChainAdvanced = G.solved.length;
    return out;
  }
});
