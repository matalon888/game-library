// The meta: Nana Rose's larder. Three painted shelves in the calm middle of the pantry painting; every item you
// restore with stars goes back on its shelf with one line of her story. Chapter 1 = shelves 1–3 (15 items).
import { A, $, fx, audio, wait } from './sb.js';

export const LARDER = [
  { id: 'teapot', name: 'Nana\'s Teapot', src: 'pantry/teapot', cost: 2, line: 'The teapot is home. Nana always said jam waits for no one, but tea does.' },
  { id: 'jar-strawberry', name: 'Strawberry Jam', src: 'pantry/jar-strawberry', cost: 2, line: 'Her first jar every June, from the patch by the gate.' },
  { id: 'biscuit-tin', name: 'Biscuit Tin', src: 'pantry/biscuit-tin', cost: 3, line: 'Still smells of shortbread. Some things keep.' },
  { id: 'jar-apricot', name: 'Apricot Jam', src: 'pantry/jar-apricot', cost: 3, line: 'Apricots from the wall tree, the summer it finally fruited.' },
  { id: 'basket', name: 'Picnic Basket', src: 'pantry/basket', cost: 3, line: 'Gingham lining, mended twice, never retired.' },
  { id: 'jar-blueberry', name: 'Blueberry Jam', src: 'pantry/jar-blueberry', cost: 4, line: 'Picked on the moor, half of them eaten on the way home.' },
  { id: 'vase-bouquet', name: 'Kitchen Posy', src: 'items/vase-bouquet', cost: 4, line: 'A jug of whatever was blooming. There was always something.' },
  { id: 'jar-lemon', name: 'Lemon Curd', src: 'pantry/jar-lemon', cost: 4, line: 'For Sunday pancakes, strictly one spoon each. Strictly.' },
  { id: 'flour-sack', name: 'Flour Sack', src: 'pantry/flour-sack', cost: 5, line: 'Scones on Tuesdays, bread on Fridays, flour on everything.' },
  { id: 'jar-plum', name: 'Plum Jam', src: 'pantry/jar-plum', cost: 5, line: 'Victoria plums, and the wasps who wanted them too.' },
  { id: 'trug', name: 'Garden Trug', src: 'items/trug', cost: 5, line: 'Every jar started in this trug.' },
  { id: 'jar-lime', name: 'Lime Marmalade', src: 'pantry/jar-lime', cost: 6, line: 'Grandpa\'s favourite. She pretended it was hers.' },
  { id: 'jar-rhubarb', name: 'Rhubarb Jam', src: 'pantry/jar-rhubarb', cost: 6, line: 'Forced in the dark under an old bucket, sweet as anything.' },
  { id: 'garden-hat', name: 'Straw Hat', src: 'items/garden-hat', cost: 6, line: 'Her hat, on its hook again. The larder looks like itself.' },
  { id: 'jar-honey', name: 'Heather Honey', src: 'pantry/jar-honey', cost: 7, line: 'From the hives at the end of the lane. The last jar is full.' },
];
export const SHELVES = 3, PER = 5;

export function larderScene(host) {
  const el = $('<div class="ps-larder"></div>'); host.appendChild(el);
  let done = [], ghost = null, box = { x: 0, y: 0, w: 300, h: 300 };
  function render() {
    el.innerHTML = '';
    Object.assign(el.style, { left: box.x + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h + 'px' });
    const rowH = box.h / SHELVES, slot = box.w / PER;
    for (let r = 0; r < SHELVES; r++) {
      const sh = document.createElement('img'); sh.src = A('pantry/shelf'); sh.alt = ''; sh.className = 'ps-shelf';
      Object.assign(sh.style, { left: '-4%', width: '108%', top: (r + 1) * rowH - rowH * 0.22 + 'px', height: rowH * 0.3 + 'px' }); el.appendChild(sh);
    }
    LARDER.forEach((it, i) => {
      if (!done.includes(it.id) && it.id !== ghost) return;
      const r = Math.floor(i / PER), c = i % PER, im = document.createElement('img');
      im.src = A(it.src); im.alt = it.name; im.dataset.id = it.id; im.className = 'ps-item' + (it.id === ghost && !done.includes(it.id) ? ' ps-ghost' : '');
      const w = slot * 0.96, mh = rowH * 0.8;
      Object.assign(im.style, { left: c * slot + slot / 2 + 'px', top: (r + 1) * rowH - rowH * 0.15 + 'px', maxWidth: w + 'px', maxHeight: mh + 'px' });
      el.appendChild(im);
    });
  }
  return {
    el,
    layout(b) { box = b; render(); },
    set(d, g = null) { done = d.slice(); ghost = g; render(); },
    spot(id) { const i = LARDER.findIndex(x => x.id === id), rowH = box.h / SHELVES, slot = box.w / PER; return { x: box.x + (i % PER) * slot + slot / 2, y: box.y + (Math.floor(i / PER) + 1) * rowH - rowH * 0.45 }; },
    async place(id) {
      if (!done.includes(id)) done.push(id); ghost = null; render();
      const im = el.querySelector(`[data-id="${id}"]`); if (!im) return;
      im.animate([{ transform: 'translate(-50%,-100%) scale(.2)', opacity: 0 }, { transform: 'translate(-50%,-100%) scale(1.2)', opacity: 1, offset: .65 }, { transform: 'translate(-50%,-100%) scale(1)' }], { duration: 650, easing: 'cubic-bezier(.2,1.2,.4,1)' });
      await wait(60); const r = im.getBoundingClientRect();
      audio.gliss(); fx.burst(r.left + r.width / 2, r.top + r.height / 2, 24, { speed: 5 });
    },
  };
}
