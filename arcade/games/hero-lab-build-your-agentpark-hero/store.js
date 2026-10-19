// localStorage `agp.hero` = { char, items:{head,face,back,hand,offhand}, hue, sat, bri, name, tints?, lockSkin? }
export const KEY = 'agp.hero';
export const DEFAULT_HERO = { char: 'c01', items: { head: null, face: null, back: null, hand: null, offhand: null }, hue: 0, sat: 1, bri: 1, name: '', tints: {}, lockSkin: true };
export function readHero() {
  let h = null;
  try { h = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  const d = JSON.parse(JSON.stringify(DEFAULT_HERO));
  if (!h || typeof h !== 'object') return d;
  return { ...d, ...h, items: { ...d.items, ...(h.items || {}) }, tints: h.tints || {} };
}
export function writeHero(h) {
  const out = { char: h.char, items: { ...h.items }, hue: +h.hue || 0, sat: h.sat ?? 1, bri: h.bri ?? 1, name: h.name || '', tints: h.tints || {}, lockSkin: h.lockSkin !== false };
  try { localStorage.setItem(KEY, JSON.stringify(out)); } catch (e) {}
  return out;
}
