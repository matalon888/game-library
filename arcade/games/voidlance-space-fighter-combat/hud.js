// Voidlance HUD (DOM/SVG overlay) + phone controls (floating stick, fire / missile / boost / power buttons).
const h = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };
const ARC = (r, a0, a1) => { const p = a => [50 + r * Math.cos(a), 50 + r * Math.sin(a)]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 0 1 ${x1.toFixed(2)},${y1.toFixed(2)}`; };
const D = Math.PI / 180;

export function createHUD() {
  const root = h(`<div id="hud" class="off">
    <div class="ret"><svg viewBox="0 0 100 100">
      <path d="${ARC(44, 140 * D, 220 * D)}" stroke="rgba(127,240,255,.18)" stroke-width="3.2" fill="none"/>
      <path data-sh d="${ARC(44, 140 * D, 220 * D)}" stroke="#7ff0ff" stroke-width="3.2" fill="none" pathLength="1" stroke-dasharray="1 1"/>
      <path d="${ARC(44, -40 * D, 40 * D)}" stroke="rgba(255,179,71,.18)" stroke-width="3.2" fill="none"/>
      <path data-hu d="${ARC(44, 40 * D, -40 * D).replace(' 0 0 1 ', ' 0 0 0 ')}" stroke="#ffb347" stroke-width="3.2" fill="none" pathLength="1" stroke-dasharray="1 1"/>
      <path d="${ARC(38, 60 * D, 120 * D)}" stroke="rgba(255,255,255,.12)" stroke-width="2" fill="none"/>
      <path data-ht d="${ARC(38, 60 * D, 120 * D)}" stroke="#ff6a4a" stroke-width="2" fill="none" pathLength="1" stroke-dasharray="0 1"/>
      <path d="${ARC(38, 240 * D, 300 * D)}" stroke="rgba(127,240,255,.12)" stroke-width="2" fill="none"/>
      <path data-bo d="${ARC(38, 240 * D, 300 * D)}" stroke="#bff8ff" stroke-width="2" fill="none" pathLength="1" stroke-dasharray="1 1"/>
      <circle cx="50" cy="50" r="1.6" fill="#7ff0ff"/>
      <path d="M50 38 V44 M50 56 V62 M38 50 H44 M56 50 H62" stroke="#7ff0ff" stroke-width="1.4"/>
      <text x="2" y="52" font-size="5.5" fill="#7ff0ff" font-family="Lilita One" text-anchor="start">SHD</text>
      <text x="98" y="52" font-size="5.5" fill="#ffb347" font-family="Lilita One" text-anchor="end">HULL</text>
    </svg></div>
    <div class="spd"></div>
    <div class="obj"><small>OBJECTIVE</small><span></span><div class="bar"><i></i></div></div>
    <div class="sc"><small>SCORE</small><span>0</span><div class="combo"></div></div>
    <canvas class="radar" width="200" height="200"></canvas>
    <div class="comms"></div>
    <div class="big"></div>
    <div class="kill"></div>
    <div class="hm"></div>
    <div class="lead" style="display:none"></div>
    <div class="lock" style="display:none"><b>LOCK</b></div>
    <div class="cursor" style="display:none"></div>
  </div>`);
  const dmg = h('<div class="dmg"></div>'), shd = h('<div class="shd"></div>');
  document.body.append(root, dmg, shd);
  const $ = s => root.querySelector(s);
  const sh = $('[data-sh]'), hu = $('[data-hu]'), ht = $('[data-ht]'), bo = $('[data-bo]'), spd = $('.spd'), obj = $('.obj span'), objT = $('.obj small'), objBar = $('.obj .bar i');
  const scN = $('.sc span'), combo = $('.sc .combo'), radar = $('.radar'), comms = $('.comms'), big = $('.big'), kill = $('.kill'), hm = $('.hm'), lead = $('.lead'), lock = $('.lock'), cursor = $('.cursor');
  const boxes = [], arrows = [];
  let commsT = 0, bigT = 0, last = {};
  const set = (k, v, fn) => { if (last[k] !== v) { last[k] = v; fn(v); } };
  return {
    root, radarCtx: radar.getContext('2d'), radarEl: radar,
    show(on) { root.classList.toggle('off', !on); },
    reticle(s, hl, heat, boost, over) {
      set('s', s.toFixed(3), v => sh.setAttribute('stroke-dasharray', `${v} 1`));
      set('h', hl.toFixed(3), v => hu.setAttribute('stroke-dasharray', `${v} 1`));
      set('t', heat.toFixed(3), v => ht.setAttribute('stroke-dasharray', `${v} 1`));
      set('b', boost.toFixed(3), v => bo.setAttribute('stroke-dasharray', `${v} 1`));
      set('o', over, v => ht.setAttribute('stroke', v ? '#ff2a2a' : '#ff6a4a'));
    },
    speed(t) { set('spd', t, v => (spd.textContent = v)); },
    objective(title, text, p) { set('ot', title, v => (objT.textContent = v)); set('ox', text, v => (obj.textContent = v)); set('op', p, v => (objBar.style.width = Math.round(v * 100) + '%')); },
    score(n, c) { set('sc', n, v => (scN.textContent = v.toLocaleString())); set('cb', c, v => (combo.textContent = v > 1 ? `CHAIN ×${v}` : '')); },
    targets(list) {
      while (boxes.length < list.length) { const b = h('<div class="tb"><div class="hp"><i></i></div><div class="lab"></div></div>'); root.appendChild(b); boxes.push(b); }
      boxes.forEach((b, i) => {
        const t = list[i]; if (!t) { if (b.style.display !== 'none') b.style.display = 'none'; return; }
        b.style.display = ''; b.style.transform = `translate(${t.x.toFixed(1)}px,${t.y.toFixed(1)}px) translate(-50%,-50%)`;
        const cls = 'tb ' + t.kind + (t.cur ? ' cur' : ''); if (b.className !== cls) b.className = cls;
        if (t.size) { b.style.width = b.style.height = t.size + 'px'; } else if (b.style.width) b.style.width = b.style.height = '';
        const lab = t.label || ''; if (b._l !== lab) { b._l = lab; b.lastChild.textContent = lab; }
        const hpw = t.hp == null ? '' : Math.round(t.hp * 100) + '%'; if (b._h !== hpw) { b._h = hpw; b.firstChild.style.display = t.hp == null ? 'none' : ''; b.firstChild.firstChild.style.width = hpw; }
      });
    },
    arrows(list) {
      while (arrows.length < list.length) { const a = h('<div class="arr"></div>'); root.appendChild(a); arrows.push(a); }
      arrows.forEach((a, i) => { const t = list[i]; if (!t) { a.style.display = 'none'; return; } a.style.display = ''; a.className = 'arr ' + (t.kind || ''); a.style.transform = `translate(${(t.x - 9).toFixed(1)}px,${(t.y - 9).toFixed(1)}px) rotate(${t.a.toFixed(3)}rad)`; });
    },
    lead(x, y, on) { lead.style.display = on ? '' : 'none'; if (on) { lead.style.left = x + 'px'; lead.style.top = y + 'px'; } },
    lock(x, y, st, p = 0) {
      lock.style.display = st ? '' : 'none'; if (!st) return;
      lock.style.left = x + 'px'; lock.style.top = y + 'px'; lock.classList.toggle('on', st === 2);
      const s = st === 2 ? 0.6 : 1.6 - p; lock.style.transform = `translate(-50%,-50%) scale(${s.toFixed(3)})`; lock.firstChild.textContent = st === 2 ? 'LOCKED' : 'LOCKING';
    },
    cursor(x, y, on) { cursor.style.display = on ? '' : 'none'; if (on) { cursor.style.left = x + 'px'; cursor.style.top = y + 'px'; } },
    comms(who, text, dur = 4) { comms.innerHTML = `<b>${who}</b>${text}`; comms.classList.add('on'); commsT = dur; },
    big(text, sub = '', dur = 2.2, warn = false) { big.innerHTML = text + (sub ? `<small>${sub}</small>` : ''); big.classList.toggle('warn', warn); big.classList.add('on'); bigT = dur; },
    kill(text) { kill.textContent = text; kill.classList.remove('on'); void kill.offsetWidth; kill.classList.add('on'); },
    hit(k) { hm.classList.toggle('k', !!k); hm.classList.remove('on'); void hm.offsetWidth; hm.classList.add('on'); },
    dmg(a) { set('dm', a.toFixed(2), v => (dmg.style.opacity = v)); },
    shd(a) { set('sd', a.toFixed(2), v => (shd.style.opacity = v)); },
    tick(dt) { if (commsT > 0 && (commsT -= dt) <= 0) comms.classList.remove('on'); if (bigT > 0 && (bigT -= dt) <= 0) big.classList.remove('on'); },
    clear() { comms.classList.remove('on'); big.classList.remove('on'); commsT = bigT = 0; this.targets([]); this.arrows([]); this.lead(0, 0, false); this.lock(0, 0, 0); },
  };
}

// phone controls: returns a live input object { sx, sy, fire, boost, msl (edge count), pwr (edge count), active }
export function createPad() {
  const pad = h(`<div id="pad" class="off"><div class="zone"></div><div class="stick idle"><i></i></div>
    <div class="btn fire">FIRE</div><div class="btn msl">MSL<em></em></div><div class="btn bst">BOOST</div><div class="btn pwr">PWR<em>BAL</em></div></div>`);
  document.body.appendChild(pad);
  const st = { sx: 0, sy: 0, fire: false, boost: false, msl: 0, pwr: 0, used: false };
  const zone = pad.querySelector('.zone'), stick = pad.querySelector('.stick'), knob = stick.firstChild, R = 52;
  let sid = null, ox = 0, oy = 0;
  const home = () => { const r = zone.getBoundingClientRect(); ox = r.left + 96; oy = r.bottom - 130; stick.style.left = ox + 'px'; stick.style.top = oy + 'px'; knob.style.transform = ''; stick.classList.add('idle'); };
  zone.addEventListener('pointerdown', e => { e.preventDefault(); if (sid !== null) return; sid = e.pointerId; st.used = true; ox = e.clientX; oy = e.clientY; stick.style.left = ox + 'px'; stick.style.top = oy + 'px'; stick.classList.remove('idle'); try { zone.setPointerCapture(sid); } catch (er) {} });
  zone.addEventListener('pointermove', e => {
    if (e.pointerId !== sid) return; let dx = e.clientX - ox, dy = e.clientY - oy; const l = Math.hypot(dx, dy);
    if (l > R) { ox += dx * (1 - R / l) * 0.35; oy += dy * (1 - R / l) * 0.35; dx = dx * R / l; dy = dy * R / l; stick.style.left = ox + 'px'; stick.style.top = oy + 'px'; }
    knob.style.transform = `translate(${dx}px,${dy}px)`; st.sx = dx / R; st.sy = dy / R;
  });
  const up = e => { if (e.pointerId !== sid) return; sid = null; st.sx = st.sy = 0; home(); };
  zone.addEventListener('pointerup', up); zone.addEventListener('pointercancel', up);
  const btn = (sel, down, upf) => {
    const b = pad.querySelector(sel);
    b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); st.used = true; b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch (er) {} down(); });
    const u = e => { b.classList.remove('on'); upf && upf(); }; b.addEventListener('pointerup', u); b.addEventListener('pointercancel', u);
    return b;
  };
  btn('.fire', () => (st.fire = true), () => (st.fire = false));
  const msl = btn('.msl', () => st.msl++);
  btn('.bst', () => (st.boost = true), () => (st.boost = false));
  const pwr = btn('.pwr', () => st.pwr++);
  addEventListener('resize', home);
  return {
    st, el: pad,
    show(on) { pad.classList.toggle('off', !on); if (on) home(); if (!on) { st.fire = st.boost = false; st.sx = st.sy = 0; } },
    setMsl(n, ready) { const t = String(n); if (msl._n !== t) { msl._n = t; msl.lastChild.textContent = '×' + n; } msl.classList.toggle('ready', !!ready); },
    setPwr(t) { if (pwr._t !== t) { pwr._t = t; pwr.lastChild.textContent = t; } },
  };
}
