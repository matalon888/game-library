// Smash Dummy v2 meta: level map (3 worlds, stars), dummy skins unlocked by stars, a daily bonus level, win / lose cards.
import { tone, note } from './kit/hc.js';
export const SKINS = [
  { id: 'wood', name: 'Woody', need: 0, body: '#f5a742', joint: '#c8742a', hat: null },
  { id: 'cap', name: 'Cap Dummy', need: 6, body: '#f5a742', joint: '#c8742a', hat: 'cap' },
  { id: 'mint', name: 'Minty', need: 14, body: '#6fe0b4', joint: '#2c9a74', hat: null },
  { id: 'tophat', name: 'Sir Smash', need: 24, body: '#f5a742', joint: '#c8742a', hat: 'tophat' },
  { id: 'gold', name: 'Golden Boy', need: 38, body: '#ffd23f', joint: '#c9971a', hat: null },
  { id: 'crown', name: 'King Crash', need: 52, body: '#ffd23f', joint: '#c9971a', hat: 'crown' },
  { id: 'robot', name: 'Bolt Bot', need: 68, body: '#9fb3c8', joint: '#5c6f85', hat: 'antenna' },
  { id: 'pink', name: 'Pinky', need: 84, body: '#ff7fb3', joint: '#c94b84', hat: 'band' },
];
const CSS = `
.sd{position:fixed;inset:0;z-index:20;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'Baloo 2',system-ui,sans-serif;color:#33465e;-webkit-user-select:none;user-select:none;touch-action:manipulation}
.sd.hide{display:none}
.sd-card{position:relative;background:rgba(255,255,255,.93);border-radius:26px;padding:18px 22px 16px;width:min(86vw,340px);text-align:center;box-shadow:0 14px 40px rgba(30,50,90,.28);animation:sdin .28s cubic-bezier(.2,1.4,.4,1)}
@keyframes sdin{0%{transform:scale(.7);opacity:0}100%{transform:scale(1);opacity:1}}
.sd-bg{position:absolute;inset:0;background:rgba(40,60,90,.28)}
.sd h1{margin:2px 0 0;font-size:40px;line-height:1;color:var(--sdc,#ff8a1f);text-shadow:0 4px 0 rgba(120,60,0,.15)}
.sd .w{font-weight:800;font-size:13px;letter-spacing:1px;color:#7d8fa6}
.sd .st{font-size:58px;line-height:1.05;letter-spacing:4px;margin:4px 0 0}
.sd .st b{display:inline-block;transition:transform .35s cubic-bezier(.2,1.6,.4,1),color .1s}
.sd .st b.on{animation:sdpop .45s cubic-bezier(.2,1.8,.4,1)}
@keyframes sdpop{0%{transform:scale(.2) rotate(-40deg)}100%{transform:scale(1) rotate(0)}}
.sd p{margin:4px 0;font-weight:800;font-size:18px}
.sd .nb{color:#ff3d6e;font-size:15px;animation:sdb .5s infinite alternate}
@keyframes sdb{to{transform:scale(1.15)}}
.sd .bar{height:12px;border-radius:7px;background:#dfe7f1;margin:6px 4px 2px;overflow:hidden}
.sd .bar i{display:block;height:100%;background:linear-gradient(90deg,#ffb400,#ff8a1f);border-radius:7px;transition:width .6s}
.sd .un{font-size:14px;font-weight:800;color:#6c7f97;margin:0}
.sd button{font:inherit;font-weight:800;border:0;border-radius:18px;padding:11px 22px;font-size:22px;color:#fff;background:var(--sdc,#ff8a1f);box-shadow:0 5px 0 rgba(0,0,0,.2);cursor:pointer;margin:8px 4px 0}
.sd button.sm{font-size:16px;padding:7px 14px;background:#7d93ad;box-shadow:0 4px 0 rgba(0,0,0,.18)}
.sd button:active{transform:translateY(3px);box-shadow:0 2px 0 rgba(0,0,0,.2)}
.sdmap{background:linear-gradient(#f3f8fe,#d5e6f6);justify-content:flex-start;overflow-y:auto;padding:calc(14px + env(safe-area-inset-top)) 12px 30px}
.sdmap .top{display:flex;align-items:center;justify-content:space-between;width:min(94vw,420px);margin-bottom:6px}
.sdmap .top b{font-size:24px}
.sdmap .wn{width:min(94vw,420px);margin:10px 0 4px;font-weight:800;font-size:15px;letter-spacing:1px;color:var(--c)}
.sdmap .gr{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;width:min(94vw,420px)}
.sdmap .lv{aspect-ratio:1;border-radius:16px;background:#fff;box-shadow:0 4px 0 rgba(30,50,90,.16);display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:800;font-size:20px;position:relative;cursor:pointer;line-height:1}
.sdmap .lv small{font-size:11px;color:#ffb400;letter-spacing:0;min-height:12px}
.sdmap .lv.lock{background:#e4eaf2;color:#a9b6c7;box-shadow:none;cursor:default}
.sdmap .lv.cur{outline:4px solid var(--c);animation:sdb .6s infinite alternate}
.sdmap .lv.boss{background:#fff1e0}
.sdmap .lv .dy{position:absolute;top:-7px;right:-4px;background:#ff3d6e;color:#fff;font-size:10px;border-radius:8px;padding:2px 5px}
.sdmap .sk{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;width:min(94vw,420px);margin-top:6px}
.sdmap .sk div{width:62px;padding:6px 2px;border-radius:14px;background:#fff;font-size:11px;font-weight:800;text-align:center;box-shadow:0 3px 0 rgba(30,50,90,.14);cursor:pointer}
.sdmap .sk div i{display:block;width:26px;height:26px;border-radius:50%;margin:0 auto 3px}
.sdmap .sk div.lock{opacity:.45;cursor:default}
.sdmap .sk div.eq{outline:3px solid #ff8a1f}
.sdstars{position:fixed;left:50%;top:calc(150px + env(safe-area-inset-top));transform:translateX(-50%);z-index:6;pointer-events:none;font-size:26px;font-weight:800;letter-spacing:6px;color:rgba(80,100,130,.28);text-shadow:none;font-family:'Baloo 2',system-ui}
.sdstars b{display:inline-block;transition:color .15s}
.sd .st b,.sdstars b,.sdmap .s{filter:grayscale(1) opacity(.45) drop-shadow(0 1px 2px rgba(0,0,0,.35))}.sd .st b.on,.sdstars b.on,.sdmap .s.on{filter:none}
.sdstars b.on{color:#ffc61a;text-shadow:0 3px 0 #c98a00;animation:sdpop .45s cubic-bezier(.2,1.8,.4,1)}
.sdbtn{position:fixed;z-index:7;font:800 18px 'Baloo 2',system-ui;border:0;border-radius:16px;padding:7px 14px;color:#fff;background:#7d93ad;box-shadow:0 4px 0 rgba(0,0,0,.18);cursor:pointer}
.sdbtn.go{background:#18b26b;font-size:22px;left:50%;transform:translateX(-50%);bottom:calc(26px + env(safe-area-inset-bottom));animation:sdb .5s infinite alternate}
.sdbtn.map{left:12px;bottom:calc(16px + env(safe-area-inset-bottom))}
.sdcombo{position:fixed;right:14px;top:calc(200px + env(safe-area-inset-top));z-index:6;pointer-events:none;font:800 38px 'Baloo 2',system-ui;color:#ff3d6e;-webkit-text-stroke:1.5px #fff;opacity:0;transition:opacity .2s}
.sdcombo.on{opacity:1}
.sdcombo.fever{color:#ffd23f;font-size:46px;animation:sdfev .35s infinite alternate}@keyframes sdfev{to{transform:scale(1.12) rotate(-3deg);filter:drop-shadow(0 0 10px #ff3d6e)}}
.sdcombo.bump{animation:sdpop .3s}
.sdban{position:fixed;left:0;right:0;top:34%;text-align:center;z-index:8;pointer-events:none;font:800 20px 'Baloo 2',system-ui;color:#33465e;opacity:0}
.sdban.on{animation:sdban 2.2s ease-out}
@keyframes sdban{0%{opacity:0;transform:translateY(10px)}12%{opacity:1;transform:none}80%{opacity:1}100%{opacity:0}}
`;
const el = (h, cls = '') => { const d = document.createElement('div'); d.className = cls; d.innerHTML = h; return d; };
export function createMeta({ LEVELS, WORLDS, save, onPlay, onSkin }) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const N = LEVELS.length;
  let stars = save.get('st2', {}), bests = save.get('bst2', {}), skin = save.get('skin2', 'wood'), bonus = save.get('bonus2', 0);
  const todayKey = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
  const api = {
    stars: l => stars[l] || 0, best: l => bests[l] || 0,
    total() { let s = bonus; for (const k in stars) s += stars[k]; return s; },
    reached() { let m = 0; for (const k in stars) if (stars[k] > 0) m = Math.max(m, +k); return Math.min(N, m + 1); },
    skinId: () => skin,
    skin() { return SKINS.find(s => s.id === skin) || SKINS[0]; },
    setSkin(id) { const s = SKINS.find(k => k.id === id); if (s && api.total() >= s.need) { skin = id; save.set('skin2', id); onSkin && onSkin(s); } },
    nextSkin() { const t = api.total(); return SKINS.find(s => s.need > t) || null; },
    daily() { const d = todayKey(); const r = Math.max(3, api.reached()); const n = 1 + ((d * 2654435761) >>> 0) % r; const done = save.get('daily2', 0) === d; return { level: Math.min(n, N), done }; },
    // record a finished round; returns what changed
    record(level, dmg, s) {
      const before = api.total(), prevStars = stars[level] || 0, prevBest = bests[level] || 0;
      const isNewBest = dmg > prevBest; if (isNewBest) { bests[level] = dmg; save.set('bst2', bests); }
      if (s > prevStars) { stars[level] = s; save.set('st2', stars); }
      let dailyBonus = 0; const dl = api.daily();
      if (s > 0 && dl.level === level && !dl.done) { dailyBonus = 3; bonus += 3; save.set('bonus2', bonus); save.set('daily2', todayKey()); }
      const after = api.total(), unlocked = SKINS.filter(k => k.need > before && k.need <= after);
      return { isNewBest, prevStars, gained: after - before, unlocked, dailyBonus };
    },
  };
  // ---- in-round HUD: three star pips, combo counter, bank button, map button, banner
  const pips = el('<b>⭐</b><b>⭐</b><b>⭐</b>', 'sdstars');
  const combo = el('', 'sdcombo'), ban = el('', 'sdban');
  const go = document.createElement('button'); go.className = 'sdbtn go'; go.textContent = 'BANK IT'; go.style.display = 'none';
  const mapBtn = document.createElement('button'); mapBtn.className = 'sdbtn map'; mapBtn.textContent = 'MAP';
  document.body.append(pips, combo, ban, go, mapBtn);
  mapBtn.addEventListener('pointerdown', e => { e.stopPropagation(); api.openMap(); });
  go.addEventListener('pointerdown', e => { e.stopPropagation(); go.onbank && go.onbank(); });
  api.hud = {
    stars(n) { [...pips.children].forEach((b, i) => { const on = i < n; if (on && !b.classList.contains('on')) { b.classList.add('on'); note(72 + i * 4, 0.3, 0.16); } if (!on) b.classList.remove('on'); }); },
    combo(n, x) { if (n < 2) { combo.classList.remove('on'); return; } combo.classList.toggle('fever', n >= 5); combo.textContent = (n >= 5 ? 'FEVER ' : '') + '×' + x.toFixed(1) + ' COMBO ' + n; combo.classList.add('on'); combo.classList.remove('bump'); void combo.offsetWidth; combo.classList.add('bump'); },
    bank(show, fn) { go.style.display = show ? '' : 'none'; go.onbank = fn; },
    banner(t, color) { ban.textContent = t; ban.style.color = color || '#33465e'; ban.classList.remove('on'); void ban.offsetWidth; ban.classList.add('on'); },
    visible(v) { pips.style.display = mapBtn.style.display = v ? '' : 'none'; if (!v) { go.style.display = 'none'; combo.classList.remove('on'); } },
  };
  // ---- level map
  const map = el('', 'sd sdmap hide'); document.body.appendChild(map);
  api.openMap = (cur) => {
    const reach = api.reached(), t = api.total(), nx = api.nextSkin(), dl = api.daily();
    let h = `<div class="top"><b>⭐ ${t}</b><span class="un">${nx ? `next dummy at ${nx.need} stars (${nx.need - t} to go)` : 'all dummies unlocked'}</span><button class="sm" data-x>×</button></div>`;
    for (let w = 0; w < WORLDS.length; w++) {
      h += `<div class="wn" style="--c:${WORLDS[w].ui}">${WORLDS[w].name}</div><div class="gr" style="--c:${WORLDS[w].ui}">`;
      LEVELS.forEach((lv, i) => { if (lv.w !== w) return; const n = i + 1, s = api.stars(n), lock = n > reach;
        h += `<div class="lv ${lock ? 'lock' : ''} ${n === cur ? 'cur' : ''} ${/BOSS/.test(lv.why) ? 'boss' : ''}" data-l="${n}">${lock ? '🔒' : n}<small>${lock ? '' : '<span class="s on">⭐</span>'.repeat(s) + '<span class="s">⭐</span>'.repeat(3 - s)}</small>${dl.level === n && !dl.done && !lock ? '<span class="dy">+3</span>' : ''}</div>`; });
      h += '</div>';
    }
    h += '<div class="wn" style="--c:#33465e">DUMMIES</div><div class="sk">';
    for (const s of SKINS) h += `<div class="${t < s.need ? 'lock' : ''} ${s.id === skin ? 'eq' : ''}" data-s="${s.id}"><i style="background:${t < s.need ? '#c8d2df' : s.body}"></i>${t < s.need ? s.need + ' stars' : s.name}</div>`;
    map.innerHTML = h + '</div>'; map.classList.remove('hide');
    map.querySelector('[data-x]').onpointerdown = e => { e.stopPropagation(); map.classList.add('hide'); };
    map.querySelectorAll('.lv:not(.lock)').forEach(b => b.onpointerdown = e => { e.stopPropagation(); map.classList.add('hide'); onPlay(+b.dataset.l); });
    map.querySelectorAll('.sk div:not(.lock)').forEach(b => b.onpointerdown = e => { e.stopPropagation(); api.setSkin(b.dataset.s); api.openMap(cur); tone(660, 0.1, 'sine', 0.12, 1.3); });
    const c = map.querySelector('.cur') || map.querySelector('.lv:not(.lock):last-of-type'); c && c.scrollIntoView({ block: 'center' });
  };
  api.mapOpen = () => !map.classList.contains('hide');
  // ---- cards
  let card = null;
  const show = (html, color) => { api.hideCard(); card = el(`<div class="sd-bg"></div>${html}`, 'sd'); card.style.setProperty('--sdc', color); document.body.appendChild(card); return card; };
  api.hideCard = () => { if (card) { card.remove(); card = null; } };
  api.win = ({ level, dmg, s, r, color, worldName, onNext, onRetry }) => {
    const nx = api.nextSkin(), t = api.total(), prev = SKINS.filter(k => k.need <= t - r.gained).pop();
    const c = show(`<div class="sd-card"><div class="w">LEVEL ${level} · ${worldName}</div><div class="st"><b>⭐</b><b>⭐</b><b>⭐</b></div>
      <h1>${s >= 3 ? 'PERFECT!' : s === 2 ? 'SMASHED!' : 'BROKEN!'}</h1><p>${dmg} damage ${r.isNewBest && r.prevStars ? '<span class="nb">NEW BEST</span>' : ''}</p>
      ${r.dailyBonus ? '<p class="nb">DAILY BONUS +3 STARS</p>' : ''}
      ${r.unlocked.length ? `<p class="nb">NEW DUMMY: ${r.unlocked.map(k => k.name).join(', ')}!</p>` : ''}
      ${nx ? `<div class="bar"><i style="width:${Math.max(0, Math.min(100, (t - (prev ? prev.need : 0)) / (nx.need - (prev ? prev.need : 0)) * 100))}%"></i></div><p class="un">${t} stars · ${nx.name} at ${nx.need}</p>` : '<p class="un">' + t + ' stars</p>'}
      <button data-n>${level >= LEVELS.length ? 'THE END · REPLAY' : 'NEXT »'}</button><br>${s < 3 ? '<button class="sm" data-r>RETRY FOR ' + (s + 1) + ' STAR' + (s ? 'S' : '') + '</button>' : '<button class="sm" data-r>RETRY</button>'}<button class="sm" data-m>MAP</button></div>`, color);
    const bs = c.querySelectorAll('.st b'); for (let i = 0; i < s; i++) setTimeout(() => { if (!card) return; bs[i].classList.add('on'); note(76 + i * 4, 0.35, 0.18); }, 350 + i * 330);
    c.querySelector('[data-n]').onpointerdown = e => { e.stopPropagation(); api.hideCard(); onNext(); };
    c.querySelector('[data-r]').onpointerdown = e => { e.stopPropagation(); api.hideCard(); onRetry(); };
    c.querySelector('[data-m]').onpointerdown = e => { e.stopPropagation(); api.hideCard(); api.openMap(level + 1); };
  };
  api.lose = ({ level, dmg, goal, color, onRetry }) => {
    const left = Math.max(1, goal - dmg), pct = Math.round(dmg / goal * 100);
    const c = show(`<div class="sd-card"><div class="w">LEVEL ${level}</div><h1>${pct >= 70 ? 'SO CLOSE!' : 'NOT BROKEN'}</h1><p>${pct >= 70 ? 'only ' + left + ' damage from a star' : left + ' more damage'}</p>
      <div class="bar"><i style="width:${pct}%"></i></div><p class="un">${dmg} / ${goal}</p><p class="un">TIP: ${(LEVELS[level - 1] || {}).why || 'hit things at full speed'}</p>${(() => { const nx = api.nextSkin(), t = api.total(); return nx ? `<p class="un">${Math.max(1, nx.need - t)} stars to ${nx.name}</p>` : ''; })()}<button data-r>RETRY</button><br><button class="sm" data-m>MAP</button></div>`, color);
    c.addEventListener('pointerdown', () => { api.hideCard(); onRetry(); });
    c.querySelector('[data-m]').onpointerdown = e => { e.stopPropagation(); api.hideCard(); api.openMap(level); };
  };
  return api;
}
