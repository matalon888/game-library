// trick.js — a four-seat trick-taking card table (shared by copy between our Hearts and Spades games): your fanned hand
// at the bottom, three computer players around the table, a trick in the middle, a message line, an action button and a
// score sheet between hands. It only draws and animates; the game rules live in game.js. Our own code, MIT.
import { css } from './calm.js';
import { cardEl, SUITS } from './cards.js';

export function trickTable({ names, colors, initials, theme, onCard }) {
  css(`
#seats .seat{position:absolute;z-index:6;display:flex;align-items:center;gap:8px;pointer-events:none;transition:transform .3s}
#seats .av{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;color:#fff;box-shadow:0 4px 12px rgba(0,0,0,.3),inset 0 -3px 0 rgba(0,0,0,.18);border:2px solid rgba(255,255,255,.85);position:relative;flex:none}
#seats .av i{position:absolute;inset:-6px;border-radius:50%;border:3px solid ${theme.trim};opacity:0;transition:opacity .25s}
#seats .seat.turn .av i{opacity:1;animation:tpulse 1s ease-in-out infinite}
@keyframes tpulse{50%{transform:scale(1.08)}}
#seats .nm{color:#fff;font-size:13px;font-weight:700;line-height:1.15;text-shadow:0 1px 4px rgba(0,0,0,.35);white-space:nowrap}
#seats .nm b{display:block;font-size:17px;font-variant-numeric:tabular-nums}
#seats .nm small{font-weight:700;font-size:12px;color:${theme.trim};margin-left:4px}
#seats .fan{position:absolute;height:34px;width:60px;pointer-events:none}
#seats .fan span{position:absolute;top:0;width:24px;height:34px;border-radius:4px;background:linear-gradient(150deg,${theme.back[0]},${theme.back[1]});border:1.5px solid rgba(255,255,255,.85);box-shadow:0 1px 3px rgba(0,0,0,.3)}
#seats .badge{position:absolute;z-index:7;background:rgba(0,0,0,.35);color:#fff;font-size:12px;font-weight:800;border-radius:10px;padding:2px 8px;letter-spacing:.5px;white-space:nowrap;pointer-events:none}
#tmsg{position:fixed;left:0;right:0;z-index:7;text-align:center;color:#fff;font-weight:700;font-size:16px;text-shadow:0 1px 6px rgba(0,0,0,.4);pointer-events:none;transition:opacity .2s}
#tbtn{position:fixed;left:50%;transform:translateX(-50%);z-index:8;display:none}
#tinfo{position:fixed;left:0;right:0;top:calc(18px + env(safe-area-inset-top));z-index:5;text-align:center;color:#fff;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:750;opacity:.65;pointer-events:none}
#sheet{position:fixed;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;background:rgba(8,6,14,.5);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
#sheet[hidden]{display:none}
#sheet .box{background:linear-gradient(180deg,#fffdf8,#f1ebe0);color:#2a2230;border-radius:22px;padding:18px 18px 16px;width:min(340px,calc(100% - 32px));box-shadow:0 20px 50px rgba(0,0,0,.4);text-align:center}
#sheet h2{margin:0 0 4px;font-family:ui-serif,Georgia,serif;font-size:26px}
#sheet p{margin:0 0 10px;font-size:14px;opacity:.75}
#sheet table{width:100%;border-collapse:collapse;font-size:16px;margin-bottom:12px}
#sheet td{padding:7px 4px;border-top:1px solid rgba(0,0,0,.07);text-align:right;font-variant-numeric:tabular-nums}
#sheet td:first-child{text-align:left;font-weight:700}
#sheet tr.me td{color:${theme.accentDark}}
#sheet .dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:7px;vertical-align:0}
#sheet .hc-btn{font-size:17px;padding:10px 28px}
#sheet th{font-size:11px;letter-spacing:1px;text-transform:uppercase;opacity:.55;text-align:right;padding:0 4px 4px;font-weight:700}
#sheet th:first-child{text-align:left}
.cd.trk{transition:transform .32s cubic-bezier(.25,.9,.3,1.04),opacity .3s}
.cd.up .fr{box-shadow:0 0 0 3px ${theme.trim},0 8px 18px rgba(0,0,0,.35)}
.cd.fresh .fr{box-shadow:0 0 0 3px #9fe3b0,0 6px 14px rgba(0,0,0,.3)}
`);
  const seatsEl = document.createElement('div'); seatsEl.id = 'seats'; document.body.appendChild(seatsEl);
  const table = document.createElement('div'); table.id = 'table'; document.body.appendChild(table);
  const msg = document.createElement('div'); msg.id = 'tmsg'; document.body.appendChild(msg);
  const info = document.createElement('div'); info.id = 'tinfo'; document.body.appendChild(info);
  const btn = document.createElement('button'); btn.id = 'tbtn'; btn.className = 'hc-btn'; document.body.appendChild(btn);
  btn.addEventListener('pointerdown', e => e.stopPropagation());
  let btnFn = null; btn.addEventListener('click', e => { e.stopPropagation(); btnFn && btnFn(); });
  const sheet = document.createElement('div'); sheet.id = 'sheet'; sheet.hidden = true; sheet.innerHTML = '<div class="box"></div>'; document.body.appendChild(sheet);
  sheet.addEventListener('pointerdown', e => e.stopPropagation());
  let sheetFn = null; sheet.addEventListener('click', () => { if (sheetFn) { const f = sheetFn; sheetFn = null; sheet.hidden = true; f(); } });

  const seats = [0, 1, 2, 3].map(s => {
    const d = document.createElement('div'); d.className = 'seat';
    d.innerHTML = `<div class="av" style="background:${colors[s]}">${initials[s]}<i></i></div><div class="nm">${names[s]}<b data-sc>0</b></div>`;
    seatsEl.appendChild(d);
    const fan = document.createElement('div'); fan.className = 'fan'; seatsEl.appendChild(fan);
    const badge = document.createElement('div'); badge.className = 'badge'; badge.style.display = 'none'; seatsEl.appendChild(badge);
    return { el: d, fan, badge, sc: d.querySelector('[data-sc]'), n: 0 };
  });
  const els = [];
  for (let id = 0; id < 52; id++) {
    const e = cardEl(table, (id / 13) | 0, id % 13 + 1, { lefty: true }); e.style.visibility = 'hidden'; els.push(e);
    e.addEventListener('pointerdown', ev => { ev.preventDefault(); ev.stopPropagation(); onCard && onCard(id); });
  }
  const G = { W: 390, H: 844, cw: 62, ch: 88, tw: 56, th: 80, handY: 700, cx: 195, cy: 380, seatXY: [] };
  let hand = [], handOpts = {};
  function layout() {
    const W = innerWidth, H = innerHeight; G.W = W; G.H = H;
    G.cw = Math.min(92, Math.max(54, (Math.min(W, 720) - 16) / 6)); G.ch = G.cw * 1.42;
    G.tw = Math.min(76, G.cw * 0.92); G.th = G.tw * 1.42;
    G.handY = H - G.ch - Math.max(14, H * 0.02) - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sab')) || 0);
    G.cx = W / 2; G.cy = Math.min(H * 0.39, (G.handY - 110 + 150) / 2);
    const side = Math.min(W * 0.5 - 40, 260), midY = G.cy - 6;
    G.seatXY = [[G.cx, G.handY - 20], [G.cx - side, midY], [G.cx, 118], [G.cx + side, midY]];
    // seat labels
    const put = (el, x, y) => { el.style.left = x + 'px'; el.style.top = y + 'px'; };
    put(seats[0].el, 12, G.handY - 66); put(seats[2].el, G.cx - 70, 64);
    put(seats[1].el, 10, midY - 22); put(seats[3].el, W - 10 - 120, midY - 22);
    seats[3].el.style.flexDirection = 'row-reverse'; seats[3].el.style.width = '120px'; seats[3].el.querySelector('.nm').style.textAlign = 'right';
    put(seats[1].fan, 14, midY + 30); put(seats[3].fan, W - 14 - 60, midY + 30); put(seats[2].fan, G.cx + 44, 70);
    seats[0].fan.style.display = 'none';
    put(seats[0].badge, 12, G.handY - 88); put(seats[1].badge, 14, midY - 50); put(seats[3].badge, W - 14 - 90, midY - 50); put(seats[2].badge, G.cx - 70, 40);
    seats[3].badge.style.left = ''; seats[3].badge.style.right = '14px';
    msg.style.top = G.handY - 104 + 'px';
    btn.style.top = G.handY - 170 + 'px';
    table.style.setProperty('--cw', G.cw + 'px'); table.style.setProperty('--ch', G.ch + 'px');
    renderHand(); placeTrick();
  }
  // hand: ids sorted; legal = Set of playable ids (others dimmed) or null; sel = Set of raised ids; fresh = Set
  function setHand(ids, o = {}) { hand = ids.slice(); handOpts = o; renderHand(); }
  function renderHand() {
    const n = hand.length; if (!n) return;
    const avail = Math.min(G.W, 760) - 16, step = n > 1 ? Math.min(G.cw * 0.62, (avail - G.cw) / (n - 1)) : 0;
    const x0 = (G.W - (G.cw + step * (n - 1))) / 2;
    hand.forEach((id, k) => {
      const e = els[id]; e.style.visibility = ''; e.classList.remove('down', 'trk');
      e.style.width = G.cw + 'px'; e.style.height = G.ch + 'px'; e.style.setProperty('--cw', G.cw + 'px');
      const up = handOpts.sel && handOpts.sel.has(id), lift = up ? -22 : (handOpts.legal && handOpts.legal.has(id) && handOpts.lift ? -8 : 0);
      e.style.transform = `translate(${x0 + k * step}px,${G.handY + lift}px)`; e.style.zIndex = 100 + k;
      e.classList.toggle('dim', !!handOpts.legal && !handOpts.legal.has(id));
      e.classList.toggle('up', !!up); e.classList.toggle('fresh', !!(handOpts.fresh && handOpts.fresh.has(id)));
    });
  }
  // trick slots: where each seat's card lands
  const slot = (s) => {
    const dx = G.tw * 0.62, dy = G.th * 0.38;
    return [[G.cx - G.tw / 2, G.cy - G.th / 2 + dy], [G.cx - G.tw / 2 - dx, G.cy - G.th / 2], [G.cx - G.tw / 2, G.cy - G.th / 2 - dy], [G.cx - G.tw / 2 + dx, G.cy - G.th / 2]][s];
  };
  let trick = [];   // [{seat, id}]
  function placeTrick() {
    trick.forEach(({ seat, id }, k) => { const e = els[id], [x, y] = slot(seat); e.style.transform = `translate(${x}px,${y}px) rotate(${(seat - 1.5) * 3}deg)`; e.style.zIndex = 300 + k; });
  }
  function sizeTrickCard(e) { e.style.width = G.tw + 'px'; e.style.height = G.th + 'px'; e.style.setProperty('--cw', G.tw + 'px'); }
  // a card goes from a seat to the middle. From your hand it slides from where it was; from a computer it flips out of its avatar.
  function play(seat, id) {
    const e = els[id]; e.classList.remove('dim', 'up', 'fresh');
    if (seat !== 0) {
      const [sx, sy] = G.seatXY[seat]; e.classList.add('drag', 'down'); sizeTrickCard(e); e.style.visibility = '';
      e.style.transform = `translate(${sx - G.tw / 2}px,${sy - G.th / 2}px) scale(.6)`; void e.offsetWidth; e.classList.remove('drag');
      requestAnimationFrame(() => e.classList.remove('down'));
    } else sizeTrickCard(e);
    e.classList.add('trk'); trick.push({ seat, id }); placeTrick();
  }
  function sweep(winner, ms = 380) {
    const [x, y] = G.seatXY[winner], ids = trick.map(t => t.id); trick = [];
    ids.forEach(id => { const e = els[id]; e.style.transform = `translate(${x - G.tw / 2}px,${y - G.th / 2}px) scale(.35)`; e.style.opacity = 0; });
    setTimeout(() => ids.forEach(id => { const e = els[id]; e.style.visibility = 'hidden'; e.style.opacity = 1; e.classList.remove('trk'); }), ms);
  }
  function clearAll() { trick = []; els.forEach(e => { e.style.visibility = 'hidden'; e.classList.remove('trk', 'dim', 'up', 'fresh', 'glow'); }); hand = []; }
  function fan(seat, n) {
    const f = seats[seat].fan; seats[seat].n = n; let h = '';
    const k = Math.min(n, 13), step = seat === 2 ? 3.2 : 2.6;
    for (let q = 0; q < k; q++) h += `<span style="left:${q * step}px;transform:rotate(${(q - k / 2) * 2}deg)"></span>`;
    f.innerHTML = h;
  }
  return {
    G, els, layout, setHand, play, sweep, clearAll, fan,
    get trick() { return trick; },
    seatXY: (s) => G.seatXY[s],
    score(seat, text, extra = '') { seats[seat].sc.innerHTML = `${text}${extra ? `<small>${extra}</small>` : ''}`; },
    badge(seat, text) { const b = seats[seat].badge; b.textContent = text || ''; b.style.display = text ? '' : 'none'; },
    turn(seat) { seats.forEach((s, i) => s.el.classList.toggle('turn', i === seat)); },
    msg(t) { msg.textContent = t || ''; },
    info(t) { info.textContent = t || ''; },
    button(label, fn) { btnFn = fn; if (!label) { btn.style.display = 'none'; return; } btn.textContent = label; btn.style.display = 'block'; },
    sheet(html, fn) { sheet.querySelector('.box').innerHTML = html; sheet.hidden = false; sheetFn = fn; },
    get sheetOpen() { return !sheet.hidden; },
    closeSheet() { if (sheetFn) { const f = sheetFn; sheetFn = null; sheet.hidden = true; f(); } else sheet.hidden = true; },
    SUITS,
  };
}
