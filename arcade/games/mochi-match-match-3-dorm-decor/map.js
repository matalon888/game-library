// Mochi Match saga map: a scrolling candy trail of levels in themed neighbourhoods (15 levels each), stars under
// every cleared level, the player's bubble on the current one, short "HARD" levels marked in grape.
import { isHard } from './levels.js';

export const EPISODES = [
  { name: 'Mochi Lane', a: '#ffd6ee', b: '#ffb3dc', deco: ['t02', 'g08', 'g13', 'f01'] },
  { name: 'Boba Bay', a: '#d9f2ff', b: '#a8dcff', deco: ['t01', 'c02', 'p05', 'x05'] },
  { name: 'Strawberry Hill', a: '#ffe1e8', b: '#ffb6c6', deco: ['t03', 'g11', 't06', 'g09'] },
  { name: 'Cotton Cloud Park', a: '#efe4ff', b: '#d2bdff', deco: ['m06', 'p04', 'c05', 'r01'] },
  { name: 'Sprinkle Street', a: '#fff4cc', b: '#ffe08e', deco: ['t05', 's02', 'g12', 'c04'] },
  { name: 'Mint Meadow', a: '#dafbef', b: '#a5efd5', deco: ['m04', 'c03', 'h07', 't08'] },
  { name: 'Starlight Arcade', a: '#e4dcff', b: '#b8a6ff', deco: ['m03', 'w07', 'x04', 'k07'] },
  { name: 'Peach Plaza', a: '#ffe8d9', b: '#ffc8a6', deco: ['t07', 'f08', 'p06', 'w05'] },
];
export const episodeOf = n => EPISODES[Math.floor((n - 1) / 15) % EPISODES.length];

const STEP = 96, PAD = 140;
const xOf = n => 50 + Math.sin(n * 0.85) * 26 + Math.sin(n * 0.31) * 6;   // % of width

export function openMap({ level, best, onPick, onClose, avatar }) {
  const last = Math.max(level + 18, 30), H = PAD * 2 + (last - 1) * STEP;
  const yOf = n => H - PAD - (n - 1) * STEP;
  const el = document.createElement('div'); el.className = 'mm-map mm';
  let bands = '', nodes = '', deco = '', pts = [];
  for (let e = 0; e * 15 < last; e++) {
    const ep = EPISODES[e % EPISODES.length], top = (e + 1) * 15 >= last ? 0 : yOf(e * 15 + 15) - STEP / 2, bot = e === 0 ? H : yOf(e * 15 + 1) + STEP / 2;
    bands += `<div class="mm-band" style="top:${top}px;height:${bot - top}px;background:linear-gradient(0deg,${ep.a},${ep.b})"></div>`;
    { const yr = yOf(e * 15 + 1) + STEP / 2 - (e ? 0 : STEP), xr = xOf(e * 15 + (e ? 0.5 : 0.5)) > 50 ? 30 : 70; bands += `<div class="mm-ribbon" style="top:${yr - 20}px;left:${xr}%"><span>${ep.name}</span></div>`; }
    ep.deco.forEach((id, i) => { const n = e * 15 + 3 + i * 3.4; if (n > last) return; const side = xOf(n) > 50 ? 12 + (i % 2) * 6 : 76 - (i % 2) * 6;
      deco += `<img class="mm-deco" src="assets/thumbs/${id}.webp" alt="" style="left:${side}%;top:${yOf(n) - 40}px;animation-delay:${-i * 0.7}s">`; });
  }
  for (let n = 1; n <= last; n++) {
    const x = xOf(n), y = yOf(n), s = best[n] || 0, cls = n < level ? 'done' : n === level ? 'cur' : 'lock';
    pts.push([x, y]);
    nodes += `<button class="mm-node ${cls}${isHard(n) ? ' hard' : ''}" data-n="${n}" style="left:${x}%;top:${y}px" ${cls === 'lock' ? 'tabindex="-1"' : ''}>
      <b>${n}</b>${isHard(n) && cls !== 'done' ? '<em>HARD</em>' : ''}${cls === 'done' ? `<i>${[0, 1, 2].map(k => `<s class="${k < s ? 'on' : ''}">★</s>`).join('')}</i>` : ''}
      ${cls === 'cur' ? `<span class="mm-me"><img src="${avatar}" alt=""></span>` : ''}</button>`;
  }
  const W = 1000, path = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${(x * W / 100).toFixed(1)} ${y}`).join(' ');
  el.innerHTML = `<div class="mm-maptop"><button class="mm-round mm-back" aria-label="Back">‹</button><h2>Level Map</h2><span class="mm-mapstars">★ ${Object.values(best).reduce((a, b) => a + b, 0)}</span></div>
    <div class="mm-scroll"><div class="mm-trail" style="height:${H}px">${bands}
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:${H}px"><path d="${path}" class="p1"/><path d="${path}" class="p2"/></svg>
      ${deco}${nodes}</div></div>`;
  document.body.appendChild(el);
  const sc = el.querySelector('.mm-scroll');
  requestAnimationFrame(() => { sc.scrollTop = yOf(level) - sc.clientHeight * 0.62; });
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 250); onClose && onClose(); };
  el.querySelector('.mm-back').onclick = close;
  el.querySelectorAll('.mm-node').forEach(b => b.onclick = () => { const n = +b.dataset.n; if (n > level) { b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); return; } el.remove(); onPick(n); });
  return { close, el };
}
