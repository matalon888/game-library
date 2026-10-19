// My heroes: the player's Hero Lab characters, usable in any AGENTPARK game.
//   • saved on the device (localStorage `agp.heroes`) and synced to the score server under the same anonymous id as the
//     leaderboards (board.js `board_client`), so they follow the player; only the hero config is sent (character, gear,
//     colours, a nickname), never anything else. Works offline; the server copy wins when it is newer.
//   • demo and automated runs (navigator.webdriver without ?lbapi=) never touch the network.
//
// Usage in a game:
//   import { heroBar, selectedHero, loadHero } from '../kit/heroes.js';
//   heroBar({ parent: startCardEl, onPick: h => rebuildPlayer() });      // inline strip on the start card
//   heroBar({ corner: 'tr', onPick: ... });                              // or a small floating button + sheet
//   if (selectedHero()) { const h = await loadHero(THREE, GLTFLoader, { height: 1 }); scene.add(h.object); h.play('run'); }
//   each frame: h.mixer.update(dt)            → see README in herolab/ for the full API
import { createParts } from './heroparts.js';
import { charById, CLIPS } from './herocatalog.js';

export const LAB_SLUG = 'hero-lab-build-your-agentpark-hero';
export const MAX_HEROES = 12;
const KEY = 'agp.heroes', LEGACY = 'agp.hero', SLOTS = ['head', 'face', 'back', 'hand', 'offhand'];
const Q = new URLSearchParams(location.search);
const API = Q.get('lbapi') || 'https://mcp.riffcade.com';
const QUIET = Q.has('demo') || (navigator.webdriver && !Q.get('lbapi'));
const ONCE = ['jump', 'slide', 'cheer', 'fall'];

// ------------------------------------------------------------ where things live
const PUB = /^(.*\/arcade\/)games\/([^/]+)\//.exec(location.pathname);          // published: /arcade/games/<slug>/
const LOCAL = /^(127\.0\.0\.1|localhost)$/.test(location.hostname);
const LOCAL_LAB = 'http://127.0.0.1:8797/herolab/';
const safeSlug = s => (typeof s === 'string' && /^[a-z0-9_-]{1,80}$/.test(s) ? s : null);
/** this game's id: its arcade slug when published, its folder locally */
export function currentGame() { return PUB ? PUB[2] : safeSlug(location.pathname.split('/').filter(Boolean)[0]) || null; }
/** base URL of the Hero Lab assets (…/assets/), overridable with ?heroassets= */
export function heroAssets() {
  const o = Q.get('heroassets'); if (o) return o.replace(/\/?$/, '/');
  if (PUB) return `${location.origin}${PUB[1]}games/${LAB_SLUG}/assets/`;
  if (LOCAL) return LOCAL_LAB + 'assets/';
  return `https://agentpark.co/arcade/games/${LAB_SLUG}/assets/`;
}
const carry = () => ['lbapi', 'heroassets'].filter(k => Q.get(k)).map(k => `&${k}=${encodeURIComponent(Q.get(k))}`).join('');
// a frame we may not navigate the top window from (the arcade player runs games in a sandboxed iframe)
function frameOnly() {
  if (window.top === window) return false;
  let fe = null; try { fe = window.frameElement; } catch (e) {}
  if (!fe) return true;
  const sb = fe.sandbox; return !!(fe.hasAttribute('sandbox') && !(sb.contains('allow-top-navigation') || sb.contains('allow-top-navigation-by-user-activation')));
}
function go(topUrl, frameUrl) {
  try { window.parent !== window && window.parent.postMessage({ agentpark: 'nav', href: topUrl }, '*'); } catch (e) {}
  if (frameOnly()) location.href = frameUrl; else window.top.location.href = topUrl;
}
/** the Hero Lab URL (top-level page), coming back to `back` */
export function heroLabUrl(back = currentGame()) {
  const b = safeSlug(back) ? `&back=${back}` : '';
  if (PUB) return `${PUB[1]}play.html?g=${LAB_SLUG}${b}${carry()}`;
  return `${LOCAL ? LOCAL_LAB : '/herolab/'}index.html?x=1${b}${carry()}`.replace('?x=1&', '?').replace('?x=1', '');
}
/** open Hero Lab in this tab; it shows "▶ Play as <name>" that comes back here */
export function openHeroLab(back = currentGame()) {
  const b = safeSlug(back) ? `?back=${back}` : '';
  const frameUrl = PUB ? `${PUB[1]}games/${LAB_SLUG}/index.html${b}` : `${LOCAL ? LOCAL_LAB : '/herolab/'}index.html${b}`;
  go(heroLabUrl(back), frameUrl + (b ? carry() : carry().replace('&', '?')));
}
/** the game Hero Lab was opened from (?back=, also read from the arcade player's URL), or null */
export function backGame() {
  let b = safeSlug(Q.get('back'));
  if (!b) try { b = safeSlug(new URLSearchParams(window.parent.location.search).get('back')); } catch (e) {}
  return b && b !== currentGame() && b !== LAB_SLUG && b !== 'herolab' ? b : null;
}
/** go back to that game */
export function returnToGame(back = backGame()) {
  if (!safeSlug(back)) return;
  const c = carry();
  if (PUB) go(`${PUB[1]}play.html?g=${back}${c}`, `${PUB[1]}games/${back}/index.html${c.replace('&', '?')}`);
  else { const u = `${LOCAL ? 'http://127.0.0.1:8797/' : '/'}${back}/index.html${c.replace('&', '?')}`; go(u, u); }
}

// ------------------------------------------------------------ local store
const DEFAULT = () => ({ char: 'c01', items: { head: null, face: null, back: null, hand: null, offhand: null }, hue: 0, sat: 1, bri: 1, name: '', tints: {}, lockSkin: true });
const num = (v, lo, hi, d) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : d);
/** a hero in its tidy local shape */
export function normHero(h) {
  const d = DEFAULT(); if (!h || typeof h !== 'object') return d;
  const items = {}; for (const s of SLOTS) items[s] = typeof h.items?.[s] === 'string' && /^[a-z0-9_+-]{1,24}$/.test(h.items[s]) ? h.items[s] : null;
  const tints = {}; for (const s of SLOTS) { const t = h.tints?.[s]; if (t && typeof t === 'object') tints[s] = { hue: num(t.hue, 0, 1, 0), sat: num(t.sat, 0, 2, 1), bri: num(t.bri, 0.4, 1.6, 1) }; }
  const out = { char: /^[cp]\d\d$/.test(h.char) ? h.char : d.char, items, hue: num(h.hue, 0, 1, 0), sat: num(h.sat, 0, 2, 1), bri: num(h.bri, 0.5, 1.5, 1),
    name: String(h.name || '').replace(/[\u0000-\u001f\u007f<>]/g, '').slice(0, 16), tints, lockSkin: h.lockSkin !== false };
  if (typeof h.thumb === 'string' && h.thumb.startsWith('data:image/') && h.thumb.length < 40000) out.thumb = h.thumb;
  return out;
}
const toWire = h => { const w = { id: h.char, items: { ...h.items }, hue: +h.hue.toFixed(3), sat: +h.sat.toFixed(3), bri: +h.bri.toFixed(3), name: h.name };
  if (Object.keys(h.tints || {}).length) w.tints = h.tints; if (h.lockSkin === false) w.lock = false; return w; };
const fromWire = w => normHero({ ...w, char: w.id, lockSkin: w.lock !== false });
const sig = h => JSON.stringify({ ...toWire(h), name: '' });     // look of a hero (thumbnails are kept per look)

let S = null;
function load() {
  if (S) return S;
  try { S = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { S = null; }
  if (!S || !Array.isArray(S.heroes)) {
    S = { heroes: [], selected: -1, at: 0, dirty: false, edited: 0 };
    // the lab used to keep one hero in `agp.hero`: it becomes the first slot
    try { const old = JSON.parse(localStorage.getItem(LEGACY) || 'null'); if (old && old.char) { S.heroes = [normHero(old)]; S.selected = 0; S.dirty = true; S.edited = Date.now(); } } catch (e) {}
  }
  S.heroes = S.heroes.slice(0, MAX_HEROES).map(normHero);
  if (!(S.selected >= -1 && S.selected < S.heroes.length)) S.selected = S.heroes.length ? 0 : -1;
  return S;
}
function persist(changed = true) {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
  // keep the single-hero key in step for older readers
  try { const h = S.heroes[S.selected]; if (h) { const { thumb, ...rest } = h; localStorage.setItem(LEGACY, JSON.stringify(rest)); } } catch (e) {}
  if (changed) { try { dispatchEvent(new CustomEvent('agp-heroes', { detail: snapshot() })); } catch (e) {} }
}
const snapshot = () => ({ heroes: myHeroes(), selected: S.selected });
function touch() { S.dirty = true; S.edited = Date.now(); persist(); queueSync(); }

/** the saved heroes (copies), newest edits included */
export function myHeroes() { load(); kick(); return S.heroes.map(h => JSON.parse(JSON.stringify(h))); }
/** index of the hero the player picked (-1 = play with the game's own character) */
export function selectedIndex() { load(); return S.selected; }
/** the picked hero, or null when the player hasn't picked one */
export function selectedHero() { load(); kick(); const h = S.heroes[S.selected]; return h ? JSON.parse(JSON.stringify(h)) : null; }
/** pick hero i (-1 = none) */
export function select(i) { load(); i = Number.isInteger(i) && i >= 0 && i < S.heroes.length ? i : -1; if (i === S.selected) return; S.selected = i; touch(); }
/** add (index null) or replace a hero; returns its index, or -1 when the 12 slots are full */
export function saveHero(hero, index = null) {
  load(); const h = normHero(hero);
  if (index === null || index < 0 || index >= S.heroes.length) { if (S.heroes.length >= MAX_HEROES) return -1; S.heroes.push(h); index = S.heroes.length - 1; }
  else S.heroes[index] = h;
  S.selected = index; touch(); return index;
}
/** remove hero i */
export function deleteHero(i) {
  load(); if (!(i >= 0 && i < S.heroes.length)) return;
  S.heroes.splice(i, 1);
  if (S.selected === i) S.selected = S.heroes.length ? Math.min(i, S.heroes.length - 1) : -1; else if (S.selected > i) S.selected--;
  touch();
}
/** listen for changes (this tab, other tabs, server sync); returns an unsubscribe function */
export function onHeroesChange(fn) {
  const a = e => fn(e.detail || snapshot()), b = e => { if (e.key === KEY) { S = null; load(); fn(snapshot()); } };
  addEventListener('agp-heroes', a); addEventListener('storage', b);
  return () => { removeEventListener('agp-heroes', a); removeEventListener('storage', b); };
}

// ------------------------------------------------------------ server sync (same anonymous id as the leaderboards)
export function clientId() {
  let c = null; try { c = JSON.parse(localStorage.getItem('board_client') || 'null'); } catch (e) {}
  if (typeof c !== 'string' || c.length < 8) {
    c = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()).replace(/-/g, '');
    try { localStorage.setItem('board_client', JSON.stringify(c)); } catch (e) {}
  }
  return c;
}
let syncing = null, syncTimer = 0, kicked = false;
function kick() { if (!kicked) { kicked = true; setTimeout(() => syncHeroes(), 0); } }
function queueSync() { if (QUIET) return; clearTimeout(syncTimer); syncTimer = setTimeout(() => syncHeroes(), 700); }
addEventListener('online', () => queueSync());
/** pull/push with the server now; resolves to the heroes (never throws) */
export function syncHeroes() {
  load();
  if (QUIET) return Promise.resolve(myHeroes());
  if (syncing) return syncing;
  syncing = (async () => {
    const c = clientId();
    let srv = null;
    try { const r = await fetch(`${API}/api/heroes?client=${c}`, { cache: 'no-store' }); if (r.ok) srv = await r.json(); } catch (e) { return; }
    if (!srv) return;
    const newerThere = srv.at > S.at && (!S.dirty || srv.at > S.edited);
    if (newerThere) { adopt(srv); return; }
    if (!S.dirty && srv.at === S.at) return;
    if (!S.dirty && !S.heroes.length) return;
    try {
      const r = await fetch(`${API}/api/heroes`, { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ client: c, heroes: S.heroes.map(toWire), selected: S.selected }) });
      const j = await r.json().catch(() => null);
      if (r.ok && j && j.ok) adopt(j, true);
      else if (r.status === 400 || r.status === 413) { S.dirty = false; persist(false); }   // the server won't take it: stop retrying
    } catch (e) {}
  })().finally(() => { syncing = null; });
  return syncing.then(() => myHeroes());
}
function adopt(srv, mine = false) {
  const thumbs = new Map(S.heroes.filter(h => h.thumb).map(h => [sig(h), h.thumb]));
  const before = JSON.stringify([S.heroes.map(toWire), S.selected]);
  S.heroes = (srv.heroes || []).slice(0, MAX_HEROES).map(fromWire).map(h => (thumbs.has(sig(h)) ? { ...h, thumb: thumbs.get(sig(h)) } : h));
  S.selected = Number.isInteger(srv.selected) && srv.selected < S.heroes.length ? srv.selected : (S.heroes.length ? 0 : -1);
  S.at = srv.at || Date.now(); S.dirty = false;
  persist(!mine && before !== JSON.stringify([S.heroes.map(toWire), S.selected]));
}

// ------------------------------------------------------------ hero bar (start card strip, or a small button + sheet)
const CSS = `
.agph-bar{--agph-acc:#c6ff3d;font:600 13px/1.2 Rubik,system-ui,-apple-system,sans-serif;color:#fff;background:linear-gradient(180deg,rgba(33,29,88,.94),rgba(22,19,61,.96));border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:10px 10px 8px;box-shadow:0 10px 30px rgba(10,6,40,.35);max-width:100%;box-sizing:border-box;text-align:left;user-select:none;-webkit-user-select:none}
.agph-hd{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin:0 4px 8px}
.agph-hd b{font:400 17px/1 'Lilita One',Rubik,system-ui,sans-serif;letter-spacing:.3px}
.agph-hd small{color:#a9a4d8;font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.agph-row{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x proximity;padding:2px 2px 4px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.agph-row::-webkit-scrollbar{display:none}
.agph-t{flex:0 0 auto;width:68px;scroll-snap-align:start;border:0;padding:0;background:none;color:inherit;font:inherit;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;-webkit-tap-highlight-color:transparent}
.agph-t i{position:relative;display:block;width:64px;height:64px;border-radius:18px;background:radial-gradient(80% 70% at 50% 35%,#efeaff,#b9b0f2 70%,#8f84e0);overflow:hidden;box-shadow:0 3px 0 rgba(0,0,0,.35);transition:transform .14s}
.agph-t i img{position:absolute;inset:2px;width:60px;height:60px;object-fit:contain;filter:drop-shadow(0 3px 3px rgba(0,0,0,.25))}
.agph-t span{max-width:68px;font-size:11px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#d9d5ff}
.agph-t:active i{transform:scale(.93)}
.agph-t.agph-on i{box-shadow:0 0 0 3px var(--agph-acc),0 3px 0 rgba(0,0,0,.35)}
.agph-t.agph-on i::after{content:'✓';position:absolute;right:3px;top:3px;width:18px;height:18px;border-radius:50%;background:var(--agph-acc);color:#1b3300;font:900 11px/18px system-ui;text-align:center}
.agph-t.agph-on span{color:#fff}
.agph-t.agph-none i{background:#2d2873;display:grid;place-items:center;font-size:26px;font-style:normal}
.agph-t.agph-add i{background:transparent;border:2px dashed rgba(255,255,255,.35);box-shadow:none;display:grid;place-items:center;font:400 30px/1 system-ui;font-style:normal;color:#fff;box-sizing:border-box}
.agph-empty{display:flex;align-items:center;gap:12px;padding:2px 4px 4px}
.agph-empty p{margin:0;color:#c9c4f2;font-size:12.5px;line-height:1.35;flex:1}
.agph-cta{flex:0 0 auto;border:0;cursor:pointer;height:42px;padding:0 16px;border-radius:14px;background:linear-gradient(180deg,#d8ff63,#9be22d);color:#1b3300;font:900 14px/1 Rubik,system-ui,sans-serif;box-shadow:0 3px 0 #5f9a12}
.agph-fab{position:fixed;z-index:60;width:52px;height:52px;border-radius:17px;border:0;padding:0;cursor:pointer;background:radial-gradient(80% 70% at 50% 35%,#efeaff,#b9b0f2 70%,#8f84e0);box-shadow:0 0 0 2px #fff,0 6px 16px rgba(10,6,40,.4);overflow:hidden;display:grid;place-items:center;font-size:24px}
.agph-fab img{width:48px;height:48px;object-fit:contain}
.agph-fab.tl{left:calc(10px + env(safe-area-inset-left));top:calc(10px + env(safe-area-inset-top))}.agph-fab.tr{right:calc(10px + env(safe-area-inset-right));top:calc(10px + env(safe-area-inset-top))}
.agph-fab.bl{left:calc(10px + env(safe-area-inset-left));bottom:calc(10px + env(safe-area-inset-bottom))}.agph-fab.br{right:calc(10px + env(safe-area-inset-right));bottom:calc(10px + env(safe-area-inset-bottom))}
.agph-sheet{position:fixed;inset:0;z-index:61;background:rgba(12,9,40,.5);display:flex;align-items:flex-end;justify-content:center;animation:agphf .2s}
.agph-sheet[hidden]{display:none}
.agph-sheet .agph-bar{width:min(560px,100%);border-radius:24px 24px 0 0;padding:14px 12px calc(14px + env(safe-area-inset-bottom));animation:agphu .28s cubic-bezier(.2,1,.3,1)}
@keyframes agphf{from{opacity:0}} @keyframes agphu{from{transform:translateY(40%)}}
@media (min-width:700px){.agph-sheet{align-items:center}.agph-sheet .agph-bar{border-radius:24px}}`;
function css() { if (document.getElementById('agph-css')) return; const s = document.createElement('style'); s.id = 'agph-css'; s.textContent = CSS; document.head.appendChild(s); }
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/** thumbnail URL for a hero: its own snapshot from the lab, else the character's studio portrait */
export function heroThumb(h) { return h?.thumb || `${heroAssets()}thumbs/${h?.char || 'c01'}.webp`; }
export const heroName = h => (h && (h.name || charById(h.char)?.name)) || 'Hero';

/**
 * heroBar({ onPick, parent, corner, title, allowNone, noneLabel })
 *   parent: element → an inline strip inside it (the game's start card). Otherwise a small button at `corner`
 *   ('tl' | 'tr' | 'bl' | 'br', default 'tr') that opens the strip as a sheet.
 *   onPick(hero | null, index) runs when the player picks (null = the game's own character).
 *   returns { el, open(), close(), refresh(), destroy() }
 */
export function heroBar({ onPick, parent, corner = 'tr', title = 'Play as', allowNone = true, noneLabel = 'Classic', noneIcon = '🎮' } = {}) {
  css(); load(); kick();
  const bar = document.createElement('div'); bar.className = 'agph-bar';
  let fab = null, sheet = null;
  function render() {
    const hs = S.heroes, sel = S.selected;
    if (!hs.length) {
      bar.innerHTML = `<div class="agph-hd"><b>Your hero</b><small>Hero Lab</small></div>
        <div class="agph-empty"><p>Build a character once, play it in every game.</p><button class="agph-cta" data-add>＋ Make a hero</button></div>`;
    } else {
      bar.innerHTML = `<div class="agph-hd"><b>${esc(title)}</b><small>${sel >= 0 ? esc(heroName(hs[sel])) : esc(noneLabel)}</small></div><div class="agph-row">
        ${allowNone ? `<button class="agph-t agph-none ${sel < 0 ? 'agph-on' : ''}" data-i="-1"><i>${noneIcon}</i><span>${esc(noneLabel)}</span></button>` : ''}
        ${hs.map((h, i) => `<button class="agph-t ${sel === i ? 'agph-on' : ''}" data-i="${i}" title="${esc(heroName(h))}"><i><img alt="" loading="lazy" src="${esc(heroThumb(h))}" onerror="this.onerror=null;this.src='${esc(heroAssets())}thumbs/${h.char}.webp'"></i><span>${esc(heroName(h))}</span></button>`).join('')}
        ${hs.length < MAX_HEROES ? `<button class="agph-t agph-add" data-add><i>＋</i><span>New hero</span></button>` : ''}</div>`;
      const on = bar.querySelector('.agph-t.agph-on'); if (on) requestAnimationFrame(() => { const r = bar.querySelector('.agph-row'); if (r) r.scrollLeft = Math.max(0, on.offsetLeft - r.offsetLeft - 40); });
    }
    if (fab) { const h = hs[sel]; fab.innerHTML = h ? `<img alt="" src="${esc(heroThumb(h))}">` : '🦸'; fab.title = h ? `Playing as ${heroName(h)}` : 'Pick your hero'; }
  }
  bar.addEventListener('click', e => {
    const t = e.target.closest('[data-i],[data-add]'); if (!t) return;
    e.stopPropagation();
    if (t.hasAttribute('data-add')) { openHeroLab(); return; }
    const i = +t.dataset.i; select(i); render();
    try { onPick && onPick(selectedHero(), selectedIndex()); } catch (err) { console.warn(err); }
    if (sheet) setTimeout(close, 180);
  });
  // taps on the strip must not start the game behind it
  ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown'].forEach(ev => bar.addEventListener(ev, e => e.stopPropagation()));
  const open = () => { if (sheet) { render(); sheet.hidden = false; } }, close = () => { if (sheet) sheet.hidden = true; };
  if (parent) parent.appendChild(bar);
  else {
    fab = document.createElement('button'); fab.className = 'agph-fab ' + (['tl', 'tr', 'bl', 'br'].includes(corner) ? corner : 'tr'); fab.setAttribute('aria-label', 'Pick your hero');
    sheet = document.createElement('div'); sheet.className = 'agph-sheet'; sheet.hidden = true; sheet.appendChild(bar);
    fab.addEventListener('click', e => { e.stopPropagation(); open(); });
    ['pointerdown', 'touchstart', 'mousedown'].forEach(ev => fab.addEventListener(ev, e => e.stopPropagation()));
    sheet.addEventListener('click', e => { if (e.target === sheet) close(); });
    document.body.append(fab, sheet);
  }
  const off = onHeroesChange(() => render());
  render();
  return { el: parent ? bar : fab, bar, open, close, refresh: render, destroy() { off(); bar.remove(); fab?.remove(); sheet?.remove(); } };
}

// ------------------------------------------------------------ 3D hero
const MAN = new Map();
function manifest(assets) {
  if (!MAN.has(assets)) MAN.set(assets, fetch(assets + 'manifest.json').then(r => r.json()).catch(() => ({ chars: ['c01'], items: [] })));
  return MAN.get(assets);
}
/**
 * loadHero(THREE, GLTFLoader, opts) → Promise<{ object, mixer, play(name, {fade, once}), actions, clips, hero, name, height, stats, dispose() }>
 *   opts.hero      a hero config (default: the selected one, else the lab's default)
 *   opts.quality   'game' (default: ≈12k-triangle body, gear merged → 2 draw calls) | 'full' (Hero Lab quality)
 *   opts.height    normalise the body height to this many world units (feet at y = 0)
 *   opts.face      extra yaw in radians (default 0: facing +Z)
 *   opts.clip      first clip (default 'idle'); opts.shadows (default true); opts.assets (default heroAssets())
 */
export async function loadHero(THREE, GLTFLoader, opts = {}) {
  const t0 = performance.now(), quality = opts.quality === 'full' ? 'full' : 'game', assets = opts.assets || heroAssets();
  const man = await manifest(assets), G = quality === 'game' ? man.game || { chars: [], items: [] } : { chars: [], items: [] };
  const hero = normHero(opts.hero || selectedHero() || DEFAULT());
  const charId = (man.chars || []).includes(hero.char) ? hero.char : (man.chars?.[0] || 'c01');
  const P = createParts(THREE, GLTFLoader, null, {
    assets,
    charUrl: id => `${assets}${G.chars.includes(id) ? 'game/' : ''}chars/${id}.glb`,
    itemUrl: id => `${assets}${G.items.includes(id) ? 'game/' : ''}items/${id}.glb`,
  });
  let ch;
  try { ch = await P.loadCharacter(charId, { colors: { hue: hero.hue, sat: hero.sat, bri: hero.bri, lock: hero.lockSkin === false ? 0 : 1 } }); }
  catch (e) { P.release(); throw e; }
  ch.root.position.y = -(opts.ground === 'rest' ? ch.M.minY : ch.M.idle?.minY ?? ch.M.minY);   // feet on y = 0 when standing
  for (const slot of SLOTS) {
    const id = hero.items[slot]; if (!id) continue;
    try { const b = await P.buildItem(id, ch.M); if (!b || (b.def.glb && !(man.items || []).includes(id))) continue; P.mount(ch, b.def.slot, b.obj, b.def); P.tint(b.obj, hero.tints?.[slot] || {}); } catch (e) { /* missing item: skip */ }
  }
  const gear = quality === 'game' && opts.merge !== false ? P.mergeGear(ch) : null;
  const shadows = opts.shadows !== false;
  ch.root.traverse(o => { if (o.isMesh) { o.castShadow = shadows; o.frustumCulled = false; } });
  const inner = new THREE.Group(); inner.add(ch.root); inner.rotation.y = opts.face || 0;
  const object = new THREE.Group(); object.name = 'agp-hero'; object.add(inner);
  const k = opts.height ? opts.height / ch.M.height : 1; inner.scale.setScalar(k);
  const mixer = new THREE.AnimationMixer(ch.root), actions = {};
  for (const [n, c] of Object.entries(ch.clips)) actions[n] = mixer.clipAction(c);
  let cur = null;
  function play(name, { fade = 0.2, once } = {}) {
    const next = actions[name]; if (!next) return null;
    const one = once ?? ONCE.includes(name);
    if (next === cur && !one) return next;
    next.reset(); next.enabled = true; next.setEffectiveWeight(1);
    next.setLoop(one ? THREE.LoopOnce : THREE.LoopRepeat, one ? 1 : Infinity); next.clampWhenFinished = one; next.play();
    if (cur && cur !== next) cur.crossFadeTo(next, fade, false);
    cur = next; return next;
  }
  play(opts.clip || 'idle');
  let tris = 0, draws = 0;
  ch.root.traverse(o => { if (o.isMesh && o.visible) { draws++; const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
  let gone = false;
  return {
    object, mixer, play, actions, clips: CLIPS.filter(c => actions[c]),
    hero: { ...hero, char: charId }, name: heroName({ ...hero, char: charId }), height: ch.M.height * k,
    stats: { quality, tris: Math.round(tris), draws, ms: Math.round(performance.now() - t0), merged: !!gear },
    dispose() {
      if (gone) return; gone = true;
      mixer.stopAllAction(); mixer.uncacheRoot(ch.root); object.parent?.remove(object);
      // this hero's own materials, gear and atlas; the shared files are freed when no hero on the page uses them
      ch.root.traverse(o => { if (!o.isMesh) return; [].concat(o.material || []).forEach(m => { if (!o.userData.shared && m.map?.isCanvasTexture) m.map.dispose(); m.dispose(); }); if (!o.isSkinnedMesh && !o.userData.shared) o.geometry?.dispose(); });
      gear?.userData.owned?.forEach(x => x.dispose());
      P.release();
    },
  };
}
