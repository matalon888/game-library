// Tidewing HUD (canvas 2D over the 3D view) + touch / mouse / keyboard controls.
import * as THREE from './kit/three.module.min.js';

const GREEN = '#9dffc8', AMBER = '#ffb347', RED = '#ff4a3d', V = new THREE.Vector3(), V2 = new THREE.Vector3();

export class HUD {
  constructor() {
    this.c = document.createElement('canvas'); this.c.id = 'hud'; document.body.appendChild(this.c); this.x = this.c.getContext('2d'); const x = this.x, ft = x.fillText.bind(x); x.fillText = (t, a, b) => { x.save(); x.shadowBlur = 0; x.lineWidth = 3.5; x.lineJoin = 'round'; x.strokeStyle = 'rgba(29,22,51,.8)'; x.strokeText(t, a, b); x.restore(); ft(t, a, b); };
    this.msgs = []; this.big = null; this.hitT = 0; this.dmgT = 0; this.resize();
  }
  resize() { const d = Math.min(devicePixelRatio, 2); this.dpr = d; this.w = innerWidth; this.h = innerHeight; this.c.width = this.w * d; this.c.height = this.h * d; this.phone = this.w < 700; }
  msg(text, color = GREEN, at = null) { this.msgs.push({ text, color, t: 1.6, at }); if (this.msgs.length > 4) this.msgs.shift(); }
  banner(title, sub, t = 2.6, color = GREEN) { this.big = { title, sub, t, T: t, color }; }
  proj(p, cam) { V.copy(p).project(cam); return { x: (V.x * 0.5 + 0.5) * this.w, y: (-V.y * 0.5 + 0.5) * this.h, z: V.z, behind: V.z > 1 }; }
  draw(G, dt) {
    const x = this.x, w = this.w, h = this.h, cam = G.cam, ph = this.phone; x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); x.clearRect(0, 0, w, h);
    if (!G.running) { this.drawBanner(x, dt); return; }
    const P = G.player, col = GREEN; x.lineWidth = 1.6; x.font = `600 ${ph ? 11 : 13}px "Chakra Petch", system-ui`; x.textBaseline = 'middle';
    x.shadowColor = 'rgba(29,22,51,.8)'; x.shadowBlur = 3;
    // ---- pitch ladder + flight path marker
    const fwd = V2.copy(P.fwd); const fp = this.proj(V.copy(P.pos).addScaledVector(fwd, 1500), cam);
    if (!fp.behind) this.fpm(x, fp.x, fp.y, col);
    const hf = new THREE.Vector3(P.fwd.x, 0, P.fwd.z); if (hf.lengthSq() < 1e-4) hf.set(0, 0, 1); hf.normalize(); const rt = new THREE.Vector3().crossVectors(hf, new THREE.Vector3(0, 1, 0)).normalize();
    x.strokeStyle = 'rgba(134,255,190,.55)'; x.fillStyle = 'rgba(134,255,190,.75)'; x.font = `600 ${ph ? 9 : 11}px "Chakra Petch", system-ui`;
    if (!ph || G.camMode === 'cockpit') for (let a = -60; a <= 60; a += 10) {
      const r = a * Math.PI / 180, c = new THREE.Vector3().copy(hf).multiplyScalar(Math.cos(r)).add(new THREE.Vector3(0, Math.sin(r), 0)).multiplyScalar(3000).add(cam.position);
      const A = this.proj(V2.copy(c).addScaledVector(rt, -220), cam), B = this.proj(V2.copy(c).addScaledVector(rt, -90), cam), C = this.proj(V2.copy(c).addScaledVector(rt, 90), cam), D = this.proj(V2.copy(c).addScaledVector(rt, 220), cam);
      if (A.behind || D.behind || Math.abs((A.y + D.y) / 2 - h / 2) > h * 0.36 || Math.abs((A.x + D.x) / 2 - w / 2) > w * 0.6) continue;
      x.setLineDash(a < 0 ? [6, 5] : []); x.beginPath(); x.moveTo(A.x, A.y); x.lineTo(B.x, B.y); x.moveTo(C.x, C.y); x.lineTo(D.x, D.y); x.stroke(); x.setLineDash([]);
      if (a) { x.fillText(String(a), D.x + 6, D.y); }
    }
    // ---- speed / altitude boxes
    x.font = `700 ${ph ? 15 : 18}px "Chakra Petch", system-ui`; const sy = h * (ph ? 0.43 : 0.5), sx = ph ? 52 : w / 2 - 230, ax = ph ? w - 52 : w / 2 + 230;
    this.box(x, sx, sy, Math.round(P.speed * 3.6), 'SPEED', col); this.box(x, ax, sy, Math.round(P.alt), 'ALT', P.alt < 250 ? RED : col);
    x.font = `600 ${ph ? 10 : 12}px "Chakra Petch", system-ui`; x.fillStyle = P.g > 6 ? AMBER : col; x.textAlign = 'center'; x.fillText(`${P.g.toFixed(1)} G`, sx, sy + (ph ? 26 : 30)); x.textAlign = 'left';
    // ---- targets
    let lockT = G.lockTarget, lockF = G.lockProg;
    for (const e of G.targets) {
      if (!e.alive) continue; const p = this.proj(e.pos, cam), d = e.pos.distanceTo(P.pos);
      const onScreen = !p.behind && p.x > 0 && p.x < w && p.y > 0 && p.y < h;
      const c = e === lockT && lockF >= 1 ? RED : e.objective ? AMBER : GREEN;
      if (onScreen) {
        const s = Math.max(9, Math.min(30, 2600 / (d + 60) * (e.size || 1)));
        x.strokeStyle = c; x.fillStyle = c; x.lineWidth = 1.8; this.bracket(x, p.x, p.y, s);
        if (e === lockT) { const r = s + 4 + (1 - Math.min(1, lockF)) * 40; x.save(); x.translate(p.x, p.y); x.rotate(Math.PI / 4 + (lockF < 1 ? G.t * 3 : 0)); x.strokeRect(-r / 1.41, -r / 1.41, r * 1.41, r * 1.41); x.restore(); }
        x.font = `600 ${ph ? 9 : 11}px "Chakra Petch", system-ui`; x.textAlign = 'center';
        if (e.objective) x.fillText('TGT', p.x, p.y - s - 9);
        if (d < 6000 || e === lockT) x.fillText(`${(d / 1000).toFixed(1)}`, p.x, p.y + s + 9);
        if (e.hp < e.maxHp && e.maxHp > 60) { x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(p.x - s, p.y + s + 16, s * 2, 3); x.fillStyle = c; x.fillRect(p.x - s, p.y + s + 16, s * 2 * e.hp / e.maxHp, 3); }
        x.textAlign = 'left';
      }
    }
    // offscreen arrow to the nearest objective (or the lock)
    const ft = lockT || G.nearestObjective;
    if (ft && ft.alive) { const p = this.proj(ft.pos, cam); const on = !p.behind && p.x > 30 && p.x < w - 30 && p.y > 60 && p.y < h - 60; if (!on) this.edgeArrow(x, p, AMBER, `${(ft.pos.distanceTo(P.pos) / 1000).toFixed(1)}`); }
    // gun pipper
    if (G.pipper) { const p = this.proj(G.pipper, cam); if (!p.behind) { x.strokeStyle = G.pipperHot ? RED : col; x.lineWidth = 1.6; x.beginPath(); x.arc(p.x, p.y, 13, 0, 7); x.stroke(); x.beginPath(); x.arc(p.x, p.y, 1.8, 0, 7); x.fillStyle = x.strokeStyle; x.fill(); } }
    // incoming missiles
    if (G.threats.length) {
      const blink = (G.t * 4) % 1 < 0.6; for (const m of G.threats) { const p = this.proj(m.pos, cam); if (!p.behind && p.x > 0 && p.x < w && p.y > 0 && p.y < h) { x.strokeStyle = RED; x.lineWidth = 2; x.beginPath(); x.arc(p.x, p.y, 10, 0, 7); x.stroke(); } else this.edgeArrow(x, p, RED, ''); }
      if (blink) { x.font = `800 ${ph ? 18 : 22}px "Chakra Petch", system-ui`; x.fillStyle = RED; x.textAlign = 'center'; x.fillText(G.threatClose ? 'MISSILE  MISSILE' : 'MISSILE ALERT', w / 2, h * (ph ? 0.3 : 0.27)); x.textAlign = 'left'; }
    }
    if (P.alt < 160 && P.fwd.y < 0.05 && (G.t * 3) % 1 < 0.6) { x.font = `800 ${ph ? 18 : 22}px "Chakra Petch", system-ui`; x.fillStyle = RED; x.textAlign = 'center'; x.fillText('PULL UP', w / 2, h * 0.62); x.textAlign = 'left'; }
    if (G.outOfArea) { x.font = `700 ${ph ? 14 : 17}px "Chakra Petch", system-ui`; x.fillStyle = AMBER; x.textAlign = 'center'; x.fillText('RETURN TO THE COMBAT AREA', w / 2, h * 0.66); x.textAlign = 'left'; }
    // ---- top: mission + objective + score
    x.textAlign = 'center'; x.fillStyle = col; x.font = `700 ${ph ? 12 : 14}px "Chakra Petch", system-ui`;
    const ty = ph ? 74 : 26; x.fillText(G.objText, w / 2, ty);
    x.font = `600 ${ph ? 10 : 12}px "Chakra Petch", system-ui`; x.fillStyle = 'rgba(134,255,190,.8)'; x.fillText(`${G.missionLabel}   ${fmtT(G.time)}`, w / 2, ty + (ph ? 16 : 19));
    x.textAlign = 'right'; x.font = `700 ${ph ? 16 : 20}px "Chakra Petch", system-ui`; x.fillStyle = '#fff'; x.fillText(G.score.toLocaleString(), w - 14, ph ? 26 : 26);
    x.font = `600 ${ph ? 9 : 11}px "Chakra Petch", system-ui`; x.fillStyle = 'rgba(255,255,255,.7)'; x.fillText('SCORE', w - 14, ph ? 42 : 44); x.textAlign = 'left';
    // ---- weapons + damage
    const wx = ph ? 14 : 22, wy = ph ? h - 214 : h - 96;
    x.font = `700 ${ph ? 12 : 15}px "Chakra Petch", system-ui`; x.fillStyle = col;
    x.fillText(`MSL ${P.msl}`, wx, wy); x.fillText(`FLR ${'◆'.repeat(P.flares)}${'◇'.repeat(3 - P.flares)}`, wx, wy + (ph ? 18 : 22));
    x.fillText('GUN', wx, wy + (ph ? 36 : 44)); x.strokeStyle = col; x.strokeRect(wx + (ph ? 34 : 42), wy + (ph ? 31 : 38), 70, 8); x.fillStyle = P.overheat > 0 ? RED : P.heat > 0.7 ? AMBER : col; x.fillRect(wx + (ph ? 34 : 42), wy + (ph ? 31 : 38), 70 * Math.min(1, P.heat), 8);
    x.fillStyle = P.hp < 35 ? RED : P.hp < 65 ? AMBER : col; x.fillText(`DMG ${Math.round(100 - P.hp)}%`, wx, wy + (ph ? 54 : 66));
    // ---- radar
    this.radar(x, G, ph ? w - 62 : w - 110, ph ? 112 : h - 110, ph ? 48 : 88);
    // ---- messages
    x.textAlign = 'center';
    this.msgs = this.msgs.filter(m => (m.t -= dt) > 0);
    this.msgs.forEach((m, i) => { x.globalAlpha = Math.min(1, m.t * 2); x.font = `800 ${ph ? 15 : 18}px "Chakra Petch", system-ui`; x.fillStyle = m.color; x.fillText(m.text, w / 2, h * (ph ? 0.36 : 0.34) + i * (ph ? 20 : 24)); });
    x.globalAlpha = 1; x.textAlign = 'left';
    if (this.hitT > 0) { this.hitT -= dt; const c = w / 2, cy = h / 2; x.strokeStyle = '#fff'; x.lineWidth = 2; for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { x.beginPath(); x.moveTo(c + a * 8, cy + b * 8); x.lineTo(c + a * 16, cy + b * 16); x.stroke(); } }
    this.drawBanner(x, dt);
    x.shadowBlur = 0;
  }
  drawBanner(x, dt) {
    const b = this.big; if (!b) return; b.t -= dt; if (b.t <= 0) { this.big = null; return; }
    const a = Math.min(1, b.t * 2, (b.T - b.t) * 3), w = this.w, h = this.h, ph = this.phone; x.globalAlpha = a; x.textAlign = 'center';
    x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, h * 0.2 - 34, w, ph ? 70 : 80);
    x.font = `800 ${ph ? 24 : 34}px "Chakra Petch", system-ui`; x.fillStyle = b.color; x.fillText(b.title, w / 2, h * 0.2 - 6);
    x.font = `600 ${ph ? 12 : 15}px "Chakra Petch", system-ui`; x.fillStyle = '#fff'; x.fillText(b.sub, w / 2, h * 0.2 + 20); x.globalAlpha = 1; x.textAlign = 'left';
  }
  fpm(x, cx, cy, c) { x.strokeStyle = c; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, 7, 0, 7); x.moveTo(cx - 7, cy); x.lineTo(cx - 19, cy); x.moveTo(cx + 7, cy); x.lineTo(cx + 19, cy); x.moveTo(cx, cy - 7); x.lineTo(cx, cy - 13); x.stroke(); }
  box(x, cx, cy, v, label, c) { x.strokeStyle = c; x.lineWidth = 1.5; const bw = this.phone ? 64 : 82, bh = this.phone ? 24 : 30; x.strokeRect(cx - bw / 2, cy - bh / 2, bw, bh); x.fillStyle = c; x.textAlign = 'center'; x.fillText(String(v), cx, cy + 1); x.font = `600 ${this.phone ? 9 : 11}px "Chakra Petch", system-ui`; x.fillText(label, cx, cy - bh / 2 - 8); x.textAlign = 'left'; x.font = `700 ${this.phone ? 15 : 18}px "Chakra Petch", system-ui`; }
  bracket(x, cx, cy, s) { const k = s * 0.45; x.beginPath(); for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { x.moveTo(cx + a * s, cy + b * s - b * k); x.lineTo(cx + a * s, cy + b * s); x.lineTo(cx + a * s - a * k, cy + b * s); } x.stroke(); }
  edgeArrow(x, p, c, label) {
    const w = this.w, h = this.h; let dx = p.x - w / 2, dy = p.y - h / 2; if (p.behind) { dx = -dx; dy = -dy; if (Math.abs(dx) + Math.abs(dy) < 1) dy = 1; }
    const a = Math.atan2(dy, dx), r = Math.min(w, h) * 0.36, ex = w / 2 + Math.cos(a) * r * (w > h ? 1.3 : 1), ey = h / 2 + Math.sin(a) * r * (w > h ? 1 : 1.3);
    x.save(); x.translate(ex, ey); x.rotate(a); x.fillStyle = c; x.beginPath(); x.moveTo(14, 0); x.lineTo(-6, -9); x.lineTo(-2, 0); x.lineTo(-6, 9); x.closePath(); x.fill(); x.restore();
    if (label) { x.fillStyle = c; x.textAlign = 'center'; x.font = `600 11px "Chakra Petch", system-ui`; x.fillText(label, ex - Math.cos(a) * 22, ey - Math.sin(a) * 22); x.textAlign = 'left'; }
  }
  radar(x, G, cx, cy, R) {
    const P = G.player, range = 7000, hd = Math.atan2(P.fwd.x, P.fwd.z);
    x.save(); x.shadowBlur = 0; x.fillStyle = 'rgba(6,20,16,.45)'; x.strokeStyle = 'rgba(134,255,190,.55)'; x.lineWidth = 1.2; x.beginPath(); x.arc(cx, cy, R, 0, 7); x.fill(); x.stroke();
    x.beginPath(); x.arc(cx, cy, R / 2, 0, 7); x.stroke(); x.beginPath(); x.moveTo(cx, cy - R); x.lineTo(cx, cy + R); x.moveTo(cx - R, cy); x.lineTo(cx + R, cy); x.globalAlpha = 0.3; x.stroke(); x.globalAlpha = 1;
    const pt = (p) => { const dx = p.x - P.pos.x, dz = p.z - P.pos.z, c = Math.cos(-hd), s = Math.sin(-hd); const rx = dx * c + dz * s, rz = -dx * s + dz * c; let px = -rx / range * R, py = -rz / range * R; const l = Math.hypot(px, py); if (l > R - 3) { px *= (R - 3) / l; py *= (R - 3) / l; } return [cx + px, cy + py]; };
    x.fillStyle = 'rgba(134,255,190,.15)'; for (const I of G.world.islands) { const [a, b] = pt({ x: I.x, z: I.z }); x.beginPath(); x.arc(a, b, Math.max(2, I.r / range * R * 0.7), 0, 7); x.fill(); }
    for (const e of G.targets) { if (!e.alive) continue; const [a, b] = pt(e.pos); x.fillStyle = e.objective ? AMBER : '#ff7a6a'; if (e.ground) x.fillRect(a - 2.5, b - 2.5, 5, 5); else { x.beginPath(); x.moveTo(a, b - 4); x.lineTo(a + 3.5, b + 3); x.lineTo(a - 3.5, b + 3); x.fill(); } }
    for (const m of G.threats) { const [a, b] = pt(m.pos); x.fillStyle = RED; x.fillRect(a - 1.5, b - 1.5, 3, 3); }
    x.fillStyle = GREEN; x.beginPath(); x.moveTo(cx, cy - 6); x.lineTo(cx + 4.5, cy + 5); x.lineTo(cx - 4.5, cy + 5); x.fill();
    x.restore();
  }
}
const fmtT = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

// ---------------------------------------------------------------- controls
export class Controls {
  constructor(onCam) {
    this.stick = { x: 0, y: 0 }; this.gun = false; this.boost = false; this.brake = false; this.mslQ = 0; this.flrQ = 0; this.keys = {}; this.mouse = { x: 0, y: 0 };
    this.touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window; this.enabled = false;
    const root = this.root = document.createElement('div'); root.id = 'ctl'; root.className = this.touch ? 'touch' : 'desk';
    root.innerHTML = this.touch ? `<div class="zone"><div class="base"><div class="knob"></div></div><span class="lbl">STEER</span></div>
      <button class="b gun" data-b="gun">GUN</button><button class="b msl" data-b="msl">MSL</button><button class="b flr" data-b="flr">FLARE</button>
      <button class="b boost" data-b="boost">BOOST</button><button class="b brake" data-b="brake">BRAKE</button><button class="b cam" data-b="cam">CAM</button>`
      : `<div class="keys"><b>Mouse</b> steer · <b>Click</b> gun · <b>Right-click / E</b> missile · <b>Q</b> flare · <b>Shift</b> boost · <b>Ctrl / X</b> brake · <b>C</b> camera · <b>WASD</b> steer</div>`;
    document.body.appendChild(root);
    if (this.touch) {
      const zone = root.querySelector('.zone'), base = root.querySelector('.base'), knob = root.querySelector('.knob'); let id = null, ox = 0, oy = 0; const R = 56;
      const home = () => { base.style.left = ''; base.style.top = ''; knob.style.transform = ''; base.classList.remove('on'); };
      zone.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); id = e.pointerId; const r = zone.getBoundingClientRect(); ox = e.clientX; oy = e.clientY; base.style.left = (ox - r.left) + 'px'; base.style.top = (oy - r.top) + 'px'; base.classList.add('on'); zone.setPointerCapture(id); });
      zone.addEventListener('pointermove', e => { if (e.pointerId !== id) return; let dx = e.clientX - ox, dy = e.clientY - oy; const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; } this.stick.x = dx / R; this.stick.y = -dy / R; knob.style.transform = `translate(${dx}px,${dy}px)`; });
      const up = e => { if (e.pointerId !== id) return; id = null; this.stick.x = this.stick.y = 0; home(); }; zone.addEventListener('pointerup', up); zone.addEventListener('pointercancel', up);
      for (const b of root.querySelectorAll('.b')) {
        const k = b.dataset.b;
        b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); b.classList.add('on'); if (k === 'gun') this.gun = true; if (k === 'boost') this.boost = true; if (k === 'brake') this.brake = true; if (k === 'msl') this.mslQ++; if (k === 'flr') this.flrQ++; if (k === 'cam') onCam(); try { navigator.vibrate && navigator.vibrate(8); } catch (er) {} });
        const off = () => { b.classList.remove('on'); if (k === 'gun') this.gun = false; if (k === 'boost') this.boost = false; if (k === 'brake') this.brake = false; };
        b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
      }
    }
    addEventListener('keydown', e => { if (!this.enabled) return; const k = e.key.toLowerCase(); this.keys[k] = true; if (k === 'e') this.mslQ++; if (k === 'q' || k === 'f') this.flrQ++; if (k === 'c') onCam(); if (k === ' ') { this.gun = true; e.preventDefault(); } if (k === 'shift') this.boost = true; if (k === 'control' || k === 'x') this.brake = true; });
    addEventListener('keyup', e => { const k = e.key.toLowerCase(); this.keys[k] = false; if (k === ' ') this.gun = false; if (k === 'shift') this.boost = false; if (k === 'control' || k === 'x') this.brake = false; });
    if (!this.touch) {
      addEventListener('mousedown', e => { if (!this.enabled || e.target.closest('.bd-trophy,.bd-wrap,.hc-card,#menu')) return; if (document.pointerLockElement !== document.body) { try { document.body.requestPointerLock(); } catch (er) {} } if (e.button === 0) this.gun = true; if (e.button === 2) this.mslQ++; });
      addEventListener('mouseup', e => { if (e.button === 0) this.gun = false; });
      addEventListener('contextmenu', e => e.preventDefault());
      addEventListener('mousemove', e => { if (!this.enabled || document.pointerLockElement !== document.body) return; this.mouse.x = Math.max(-1, Math.min(1, this.mouse.x + e.movementX * 0.0045)); this.mouse.y = Math.max(-1, Math.min(1, this.mouse.y - e.movementY * 0.0045)); });
    }
  }
  show(on) { this.root.style.display = on ? '' : 'none'; this.enabled = on; if (!on) { this.gun = this.boost = this.brake = false; this.stick.x = this.stick.y = 0; if (document.pointerLockElement) try { document.exitPointerLock(); } catch (e) {} } }
  read(dt) {
    const k = this.keys; let sx = this.stick.x, sy = this.stick.y;
    this.mouse.x *= Math.max(0, 1 - dt * 1.6); this.mouse.y *= Math.max(0, 1 - dt * 1.6);
    sx += this.mouse.x; sy += this.mouse.y;
    if (k.a || k.arrowleft) sx -= 1; if (k.d || k.arrowright) sx += 1; if (k.w || k.arrowup) sy += 1; if (k.s || k.arrowdown) sy -= 1;
    return { x: Math.max(-1, Math.min(1, sx)), y: Math.max(-1, Math.min(1, sy)) };
  }
}
