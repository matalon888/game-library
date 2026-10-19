// hero.js: load the player's Hero Lab hero (localStorage `agp.hero`) into any three.js game.
//   import { loadHero } from '../herolab/hero.js';
//   const h = await loadHero(THREE, GLTFLoader, { height: 1 });
//   scene.add(h.object); h.play('run'); ... each frame: h.mixer.update(dt)
// See README.md for the full API.
import { createParts } from './parts.js';
import { readHero, DEFAULT_HERO } from './store.js';
import { charById } from './catalog.js';

const BASE = new URL('./', import.meta.url).href;
let readyCache = null;
async function manifest() {
  if (!readyCache) readyCache = fetch(BASE + 'assets/manifest.json').then(r => r.json()).catch(() => ({ chars: ['c01'], items: [] }));
  return readyCache;
}

export async function loadHero(THREE, GLTFLoader, opts = {}) {
  const P = createParts(THREE, GLTFLoader, BASE);
  const man = await manifest();
  const hero = opts.hero || readHero();
  const charId = man.chars.includes(hero.char) ? hero.char : (man.chars[0] || DEFAULT_HERO.char);
  const ch = await P.loadCharacter(charId, { colors: { hue: hero.hue, sat: hero.sat, bri: hero.bri, lock: hero.lockSkin === false ? 0 : 1 } });
  ch.root.position.y = -ch.M.minY;
  for (const slot of ['head', 'face', 'back', 'hand', 'offhand']) {
    const id = hero.items?.[slot]; if (!id) continue;
    try { const b = await P.buildItem(id, ch.M); if (!b || (b.def.glb && !man.items.includes(id))) continue; P.mount(ch, b.def.slot, b.obj, b.def); P.tint(b.obj, hero.tints?.[slot] || {}); } catch (e) { /* missing item: skip */ }
  }
  const object = new THREE.Group(); object.name = 'agp-hero'; object.add(ch.root);
  if (opts.height) object.scale.setScalar(opts.height / ch.M.height);
  const mixer = new THREE.AnimationMixer(ch.root), actions = {};
  for (const [n, c] of Object.entries(ch.clips)) actions[n] = mixer.clipAction(c);
  let cur = null;
  function play(name, { fade = 0.2, once } = {}) {
    const next = actions[name]; if (!next || next === cur) return next;
    const one = once ?? ['jump', 'slide', 'cheer', 'fall'].includes(name);
    next.reset(); next.setLoop(one ? THREE.LoopOnce : THREE.LoopRepeat, one ? 1 : Infinity); next.clampWhenFinished = one; next.play();
    if (cur) cur.crossFadeTo(next, fade, false);
    cur = next; return next;
  }
  play(opts.clip || 'idle');
  return {
    object, mixer, play, actions,
    clips: Object.keys(actions),
    hero: { ...hero, char: charId }, name: hero.name || charById(charId)?.name || 'Hero',
    height: ch.M.height * (opts.height ? opts.height / ch.M.height : 1),
    dispose() { mixer.stopAllAction(); object.parent?.remove(object); object.traverse(o => { o.geometry?.dispose(); [].concat(o.material || []).forEach(m => { for (const k in m) if (m[k]?.isTexture) m[k].dispose(); m.dispose(); }); }); },
  };
}

export { readHero };
