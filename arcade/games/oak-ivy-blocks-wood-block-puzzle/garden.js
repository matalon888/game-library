// The meta: restore Ivy Cottage garden with the stars you earn. Chapter 1 places garden pieces, chapter 2 plants the
// borders. Items sit on the painted scene in image coordinates (portrait 1024×1536 and wide 1536×1024 paintings),
// so they stay put on any screen. [x, y, w] = bottom-centre and width in painting pixels.
import { A, $, fx, audio, wait } from './sb.js';

export const GARDEN = [
  // chapter 1: garden pieces
  { id: 'rose-arch', name: 'Rose Arch', src: 'decor/rose-arch', cost: 2, p: [450, 575, 150], w: [640, 548, 125] },
  { id: 'bench', name: 'Garden Bench', src: 'decor/bench', cost: 2, p: [610, 655, 190], w: [790, 610, 160] },
  { id: 'birdhouse', name: 'Birdhouse', src: 'decor/birdhouse', cost: 3, p: [235, 660, 92], w: [345, 610, 72] },
  { id: 'trellis', name: 'Clematis Trellis', src: 'decor/trellis', cost: 3, p: [800, 610, 120], w: [935, 575, 100] },
  { id: 'fountain', name: 'Fountain', src: 'decor/fountain', cost: 3, p: [520, 880, 230], w: [660, 780, 200] },
  { id: 'sundial', name: 'Sundial', src: 'decor/sundial', cost: 4, p: [320, 770, 118], w: [455, 690, 105] },
  { id: 'beehive', name: 'Beehive', src: 'decor/beehive', cost: 4, p: [805, 790, 122], w: [985, 700, 98] },
  { id: 'birdbath', name: 'Birdbath', src: 'decor/birdbath', cost: 4, p: [255, 905, 128], w: [370, 800, 112] },
  { id: 'lantern', name: 'Lantern', src: 'decor/lantern', cost: 5, p: [710, 930, 66], w: [880, 820, 56] },
  { id: 'urn', name: 'Flower Urn', src: 'decor/urn', cost: 5, p: [850, 975, 128], w: [1020, 885, 105] },
  { id: 'wheelbarrow', name: 'Wheelbarrow', src: 'decor/wheelbarrow', cost: 5, p: [390, 1010, 180], w: [530, 905, 150] },
  { id: 'watering-can', name: 'Watering Can', src: 'decor/watering-can', cost: 6, p: [640, 1020, 110], w: [770, 935, 92] },
  // chapter 2: the borders in bloom
  { id: 'rose', name: 'Climbing Rose', src: 'plants/rose-bloom', cost: 5, p: [175, 790, 110], w: [215, 655, 92] },
  { id: 'lavender', name: 'Lavender', src: 'plants/lavender-bloom', cost: 5, p: [400, 700, 92], w: [520, 640, 80] },
  { id: 'hydrangea', name: 'Hydrangea', src: 'plants/hydrangea-bloom', cost: 5, p: [735, 700, 104], w: [1090, 640, 90] },
  { id: 'foxglove', name: 'Foxgloves', src: 'plants/foxglove-bloom', cost: 6, p: [895, 680, 78], w: [1200, 640, 66] },
  { id: 'peony', name: 'Peonies', src: 'plants/peony-bloom', cost: 6, p: [590, 770, 92], w: [1300, 650, 82] },
  { id: 'larkspur', name: 'Larkspur', src: 'plants/larkspur-bloom', cost: 6, p: [690, 590, 62], w: [1400, 650, 58] },
  { id: 'tulip', name: 'Tulips', src: 'plants/tulip-bloom', cost: 6, p: [470, 1110, 104], w: [560, 1010, 88] },
  { id: 'sunflower', name: 'Sunflowers', src: 'plants/sunflower-bloom', cost: 7, p: [150, 1040, 110], w: [300, 990, 92] },
  { id: 'sweet-pea', name: 'Sweet Peas', src: 'plants/sweet-pea-bloom', cost: 7, p: [560, 1140, 100], w: [880, 1010, 86] },
  { id: 'daisy', name: 'Daisies', src: 'plants/daisy-bloom', cost: 7, p: [300, 1150, 112], w: [420, 1015, 92] },
  { id: 'poppy', name: 'Poppies', src: 'plants/poppy-bloom', cost: 8, p: [700, 1120, 92], w: [1000, 1010, 80] },
  { id: 'dahlia', name: 'Dahlias', src: 'plants/dahlia-bloom', cost: 8, p: [830, 1150, 112], w: [1130, 1010, 92] },
];
export const CHAPTERS = [{ name: 'Ivy Cottage Garden', from: 0, to: 12 }, { name: 'The Borders in Bloom', from: 12, to: 24 }];
export const chapterOf = done => done.length < 12 ? 0 : 1;

export function gardenScene(host) {
  const layer = $('<div class="oi-garden"></div>'); host.appendChild(layer);
  let done = [], ghostId = null;
  function geom() {
    const W = innerWidth, H = innerHeight, wide = W / H >= 1, iw = wide ? 1536 : 1024, ih = wide ? 1024 : 1536;
    const s = Math.max(W / iw, H / ih), ox = (W - iw * s) / 2, oy = (H - ih * s) * 0.4;
    return { wide, s, ox, oy };
  }
  function pos(it, g) { const [x, y, w] = g.wide ? it.w : it.p; return { left: g.ox + x * g.s - w * g.s / 2, bottom: g.oy + y * g.s, w: w * g.s }; }
  function render() {
    const g = geom(); layer.innerHTML = '';
    // items further back (smaller y) first so the near ones overlap them
    const items = GARDEN.filter(it => done.includes(it.id) || it.id === ghostId).sort((a, b) => (g.wide ? a.w[1] - b.w[1] : a.p[1] - b.p[1]));
    for (const it of items) {
      const q = pos(it, g), im = document.createElement('img'); im.src = A(it.src); im.alt = it.name; im.dataset.id = it.id;
      im.style.cssText = `position:absolute;left:${q.left}px;top:${q.bottom}px;width:${q.w}px;transform:translateY(-100%);transform-origin:50% 100%`;
      if (it.id === ghostId && !done.includes(it.id)) im.className = 'oi-ghost';
      layer.appendChild(im);
    }
  }
  addEventListener('resize', () => render());
  return {
    layer,
    set(d, ghost = null) { done = d.slice(); ghostId = ghost; render(); },
    spot(id) { const it = GARDEN.find(i => i.id === id), g = geom(), q = pos(it, g); return { x: q.left + q.w / 2, y: q.bottom - q.w * 0.6 }; },
    async place(id) {
      if (!done.includes(id)) done.push(id); ghostId = null; render();
      const im = layer.querySelector(`[data-id="${id}"]`); if (!im) return;
      im.animate([{ transform: 'translateY(-100%) scale(0.2)', opacity: 0 }, { transform: 'translateY(-100%) scale(1.15)', opacity: 1, offset: 0.65 }, { transform: 'translateY(-100%) scale(1)' }], { duration: 650, easing: 'cubic-bezier(.2,1.2,.4,1)' });
      const r = im.getBoundingClientRect();
      audio.gliss(); fx.burst(r.left + r.width / 2, r.top + r.height * 0.6, 26, { speed: 5 }); await wait(250); fx.burst(r.left + r.width / 2, r.top + r.height * 0.3, 12, { kind: 'spark', speed: 4 });
    },
  };
}
