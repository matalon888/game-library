/* A scripted playthrough, advanced one frame at a time so the main
   process can grab each frame. Time comes from the frame counter, not
   the clock, so the footage is smooth however slow capture is. */
(() => {
  const DT = 1 / 30;
  let d = null, p = null, w = null, f = 0;
  const keys = (o) => { p.keys = Object.assign(Object.create(null), o || {}); };

  window.__film = {
    async setup() {
      const t0 = Date.now();
      while (!window.__dig && Date.now() - t0 < 40000) await new Promise(r => setTimeout(r, 100));
      d = window.__dig;
      d.menu.hide();
      await d.openSite(0);
      w = d.world(); p = d.player();
      document.getElementById("loading").hidden = true;
      /* stand at the datum looking out over the site */
      const lm = w.landmarks[0];
      p.pos.set(64.5, w.heightAt(64, 64) + 1.4, 68.5);
      p.prev.copy(p.pos); p.vx = p.vy = p.vz = 0;
      p.yaw = Math.atan2(-(lm.x - p.pos.x), -(lm.z - p.pos.z)) - 0.9;
      p.pitch = -0.08;
      p.locked = true;
      for (let i = 0; i < 30; i++) d.stepLogic(DT);
      d.menu.show("title");                 // open on the title card
      d.draw();
      return { landmark: lm.type, depth: d.G.site.finds[0].dig.depth };
    },

    tick() {
      const lm = w.landmarks[0], target = d.G.site.finds[0];

      if (f === 75) { d.menu.hide(); }
      /* 75-165: slow pan across the site */
      if (f > 75 && f < 165) { p.yaw += 0.010; keys({}); }
      /* 165-350: walk to the red ground */
      else if (f >= 165 && f < 350) {
        const dx = lm.x + 0.5 - p.pos.x, dz = lm.z + 0.5 - p.pos.z;
        const dist = Math.hypot(dx, dz);
        const want = Math.atan2(-dx, -dz);
        let diff = ((want - p.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        p.yaw += Math.max(-0.05, Math.min(0.05, diff));
        keys(dist > 2.4 ? { KeyW: true } : {});
        if (dist <= 2.4) p.pitch += (-0.9 - p.pitch) * 0.06;
      }
      /* 350-380: settle, centre on the square, look down */
      else if (f >= 350 && f < 380) {
        keys({});
        p.pos.x += (Math.floor(p.pos.x) + 0.5 - p.pos.x) * 0.2;
        p.pos.z += (Math.floor(p.pos.z) + 0.5 - p.pos.z) * 0.2;
        p.pitch += (-1.45 - p.pitch) * 0.15;
      }
      /* 380-560: dig, and fall into the cut */
      else if (f >= 380 && f < 560) {
        keys({});
        if (f === 380) d.setDigging(true);
        if (d.findObjs.has(0)) d.setDigging(false);
      }
      /* 560-640: brush it out */
      else if (f >= 560 && f < 640) {
        d.setDigging(false);
        if (f === 560) d.setTool("brush");
        const o = d.findObjs.get(0);
        if (o && !o.lifted) {
          const ox = o.group.position.x - d.camera.position.x;
          const oy = o.group.position.y - d.camera.position.y;
          const oz = o.group.position.z - d.camera.position.z;
          const wy = Math.atan2(-ox, -oz);
          let diff = ((wy - p.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          p.yaw += diff * 0.25;
          p.pitch += (Math.atan2(oy, Math.hypot(ox, oz)) - p.pitch) * 0.25;
          if (f > 575) { d.updateTarget(); d.clickUse(); }
        }
      }
      /* 640-700: hold on the find card, then climb out */
      else if (f >= 700 && f < 730) { keys({ Space: true }); p.pitch += (-0.1 - p.pitch) * 0.1; }
      /* 730: the city stands up */
      else if (f === 730) { keys({}); d.toggleView(); }
      /* 735-1000: rise and look over it */
      else if (f > 735 && f < 1000) {
        if (f === 740) p.flying = true;
        keys(f < 860 ? { Space: true } : {});
        p.yaw += 0.006;
        p.pitch += (-0.55 - p.pitch) * 0.03;
      }
      else keys({});

      d.step(DT);
      f++;
      return f;
    }
  };
})();
