// Mochi Match sticker album: 4 pages × 6 kawaii stickers. One drops on every win (new ones first), duplicates turn
// into coins, a full page pays coins + a booster once.
export const PAGES = [
  { name: 'Sweet Treats', color: '#ffd6ea', tape: '#ff8fc6', ids: ['t01', 't02', 't05', 't08', 'g09', 'g08'] },
  { name: 'Fluffy Friends', color: '#dff3ff', tape: '#6cc8ff', ids: ['p01', 'p02', 'p03', 'p04', 'p05', 'p06'] },
  { name: 'Glam Kit', color: '#efe3ff', tape: '#b48cff', ids: ['w05', 'w07', 'w09', 't04', 'g02', 'b01'] },
  { name: 'Dreamy Days', color: '#fff2c9', tape: '#ffc93c', ids: ['r04', 'r05', 'x05', 't09', 't03', 'g14'] },
];
export const NAMES = { t01: 'Boba Bean', t02: 'Mochi Mo', t05: 'Donut Dot', t08: 'Swirly', g09: 'Cupcake Cutie', g08: 'Macaron Mac',
  p01: 'Kitty Kiki', p02: 'Pup Pudding', p03: 'Hammy', p04: 'Bun Bun', p05: 'Axo Pink', p06: 'Corgi Loaf',
  w05: 'Heart Bag', w07: 'Cat Phones', w09: 'Heart Shades', t04: 'Polish Pop', g02: 'Lippy', b01: 'Satin Bow',
  r04: 'Love Note', r05: 'Rose Posy', x05: 'Rainbow', t09: 'Lolli', t03: 'Berry', g14: 'Bunny Charm' };
export const ALL = PAGES.flatMap(p => p.ids);
export const PAGE_REWARD = { coins: 150, boost: 'rainbow' };

/** pick the sticker for a win: a missing one 80% of the time while any are missing (rng = seeded or Math.random) */
export function dropSticker(owned, r = Math.random) {
  const missing = ALL.filter(id => !owned[id]);
  // fill pages in order: prefer the first page that isn't complete
  const page = PAGES.find(p => p.ids.some(id => !owned[id]));
  if (missing.length && (r() < 0.8 || missing.length === ALL.length)) { const pool = page.ids.filter(id => !owned[id]); return { id: pool[(r() * pool.length) | 0], fresh: true }; }
  const id = ALL[(r() * ALL.length) | 0]; return { id, fresh: !owned[id] };
}
export const pageDone = (p, owned) => p.ids.every(id => owned[id]);

export function openAlbum({ owned, claimed, onClaim, onClose, start = 0 }) {
  let pg = Math.max(0, Math.min(PAGES.length - 1, start));
  const el = document.createElement('div'); el.className = 'mm-album mm';
  const total = ALL.filter(id => owned[id]).length;
  const draw = () => {
    const p = PAGES[pg], done = pageDone(p, owned), got = claimed.includes(pg);
    el.innerHTML = `<div class="mm-maptop"><button class="mm-round mm-back" aria-label="Back">‹</button><h2>Sticker Album</h2><span class="mm-mapstars">${total}/${ALL.length}</span></div>
      <div class="mm-tabs">${PAGES.map((q, i) => `<button class="${i === pg ? 'on' : ''}" data-p="${i}" style="--c:${q.tape}">${q.name}<small>${q.ids.filter(id => owned[id]).length}/6</small></button>`).join('')}</div>
      <div class="mm-page" style="--pc:${p.color};--tc:${p.tape}"><i class="tape t1"></i><i class="tape t2"></i>
        <div class="mm-stk">${p.ids.map((id, i) => `<div class="mm-st ${owned[id] ? 'have' : ''}" style="--r:${(i % 3 - 1) * 5 + (i > 2 ? 3 : -2)}deg"><img src="assets/thumbs/${id}.webp" alt="${NAMES[id]}">${owned[id] > 1 ? `<em>×${owned[id]}</em>` : ''}<span>${owned[id] ? NAMES[id] : '???'}</span></div>`).join('')}</div>
        <div class="mm-pagefoot">${done ? (got ? '<b>Page complete ✓</b>' : `<button class="mm-jelly mm-claim">Claim <img src="assets/thumbs/x02.webp" alt="coins">${PAGE_REWARD.coins} + <img src="assets/thumbs/m08.webp" alt="Rainbow ball"></button>`) : `<span>Win levels to collect stickers · full page = ${PAGE_REWARD.coins} coins + a Rainbow ball</span>`}</div>
      </div>`;
    el.querySelector('.mm-back').onclick = close;
    el.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { pg = +b.dataset.p; draw(); });
    const c = el.querySelector('.mm-claim'); if (c) c.onclick = () => { onClaim(pg); draw(); };
  };
  const close = () => { el.remove(); onClose && onClose(); };
  draw(); document.body.appendChild(el);
  return { close, el };
}
