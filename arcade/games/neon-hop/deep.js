// Neon Hop v2 — meta and screens: level map (3 worlds), stars, ball collection, gem chests, Daily Jam streak, result card.
import { LEVELS, WORLDS, dailySpec } from './levels.js';

export const SKINS = [
  { id: 'pearl', name: 'Pearl', c: '#ffffff', e: '#ffffff', need: 0 }, { id: 'coral', name: 'Coral', c: '#ff7a7a', e: '#ff4a5a', need: 3 },
  { id: 'aqua', name: 'Aqua', c: '#6ff3ff', e: '#22c8ff', need: 6 }, { id: 'lime', name: 'Lime', c: '#b6ff4d', e: '#7fe01a', need: 10 },
  { id: 'gold', name: 'Gold', c: '#ffd84d', e: '#ffb300', need: 15 }, { id: 'violet', name: 'Violet', c: '#c79bff', e: '#8f4dff', need: 21 },
  { id: 'sunset', name: 'Sunset', c: '#ff9f5a', e: '#ff3b8f', need: 28 }, { id: 'ember', name: 'Ember', c: '#ff5a2a', e: '#ff1a00', need: 36 },
  { id: 'mint', name: 'Mint', c: '#8affd0', e: '#18c98b', need: 45 }, { id: 'rose', name: 'Rosegold', c: '#ffc2b0', e: '#e58a7a', need: 55 },
  { id: 'ice', name: 'Ice', c: '#e4faff', e: '#7fd8ff', need: 66 }, { id: 'prism', name: 'Prism', c: '#ffffff', e: '#ffffff', need: 80, prism: true },
];
export const TRAILS = [
  { id: 'plain', name: 'Glow', c: null }, { id: 'pink', name: 'Bubblegum', c: '#ff7ac8' }, { id: 'lemon', name: 'Lemon', c: '#fff06a' },
  { id: 'mintt', name: 'Spearmint', c: '#6affc0' }, { id: 'fire', name: 'Fire', c: '#ff7a2a' }, { id: 'rainbow', name: 'Rainbow', c: null, prism: true },
];
const CHEST_EVERY = 30;
export const dayNum = (d = new Date()) => Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400000);

export function createDeep(S, ORDER, SONG, play) {
  const get = (k, d) => S.get(k, d), set = (k, v) => S.set(k, v);
  const css = document.createElement('style');
  css.textContent = `
#dp{position:fixed;inset:0;z-index:30;display:none;font-family:'Baloo 2',system-ui,sans-serif;color:#fff;background:rgba(10,0,30,.82);backdrop-filter:blur(6px);overflow:auto;-webkit-overflow-scrolling:touch}
#dp.on{display:block}#dp *{box-sizing:border-box}
#dp .in{max-width:460px;margin:0 auto;padding:14px 14px 40px}
#dp h2{margin:0;font-size:26px;font-weight:800}#dp h3{margin:14px 0 6px;font-size:14px;letter-spacing:1px;opacity:.8}
#dp .bar{display:flex;gap:8px;align-items:center;margin:0 0 8px 54px}#dp .bar .sp{flex:1}
#dp .pill{background:rgba(255,255,255,.12);border-radius:999px;padding:4px 12px;font-weight:800;font-size:16px;white-space:nowrap}
#dp .btn{border:0;border-radius:16px;padding:12px 18px;font:800 20px 'Baloo 2';color:#2a0a3a;background:linear-gradient(180deg,#fff,#ffd1ec);box-shadow:0 4px 0 rgba(0,0,0,.35);cursor:pointer}
#dp .btn:active{transform:translateY(3px);box-shadow:0 1px 0 rgba(0,0,0,.35)}#dp .btn.g{background:rgba(255,255,255,.14);color:#fff;box-shadow:none;font-size:17px}
#dp .tabs{display:flex;gap:6px;margin:8px 0}#dp .tab{flex:1;border:2px solid rgba(255,255,255,.2);background:transparent;color:#fff;border-radius:12px;padding:6px 2px;font:800 14px 'Baloo 2';cursor:pointer;line-height:1.1}
#dp .tab[aria-pressed=true]{background:var(--w);border-color:var(--w);color:#2a0a3a}#dp .tab small{display:block;font-weight:600;opacity:.8;font-size:11px}
#dp .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:6px}
#dp .nd{position:relative;aspect-ratio:1;border-radius:18px;border:0;background:rgba(255,255,255,.12);color:#fff;font:800 24px 'Baloo 2';cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0}
#dp .nd.done{background:var(--w);color:#2a0a3a}#dp .nd.next{background:#fff;color:#2a0a3a;animation:dpp 1s ease-in-out infinite;box-shadow:0 0 20px var(--w)}
#dp .nd.lock{opacity:.35;cursor:default}#dp .nd.hard{outline:3px solid #ff3b5c;outline-offset:-3px}
#dp .nd small{font-size:11px;letter-spacing:-1px;line-height:1;margin-top:1px}#dp .nd .hb{position:absolute;top:-6px;right:-4px;background:#ff3b5c;color:#fff;font-size:10px;padding:1px 5px;border-radius:8px}
@keyframes dpp{50%{transform:scale(1.08)}}
#dp .why{margin-top:10px;font-size:14px;opacity:.85;min-height:20px;text-align:center}
#dp .card{text-align:center;padding-top:110px}#dp .stars{font-size:48px;letter-spacing:6px;margin:6px 0;filter:drop-shadow(0 0 14px #ffe66d)}
#dp .stars i{font-style:normal;display:inline-block;opacity:.25;transform:scale(.6);transition:all .35s cubic-bezier(.3,1.8,.5,1)}#dp .stars i.on{opacity:1;transform:scale(1)}
#dp .big{font-size:42px;font-weight:800;line-height:1}#dp .row{display:flex;gap:10px;justify-content:center;margin:14px 0}
#dp .meta{background:rgba(255,255,255,.1);border-radius:14px;padding:8px 12px;margin:8px auto;max-width:360px;font-size:15px;text-align:left}
#dp .meter{height:10px;border-radius:6px;background:rgba(255,255,255,.18);overflow:hidden;margin-top:5px}#dp .meter i{display:block;height:100%;background:#ffe66d;border-radius:6px}
#dp .sk{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}#dp .sk button{border:2px solid transparent;border-radius:14px;background:rgba(255,255,255,.1);color:#fff;font:700 12px 'Baloo 2';padding:8px 2px;cursor:pointer}
#dp .sk button[aria-pressed=true]{border-color:#ffe66d}#dp .sk button.lk{opacity:.4}#dp .sk b{display:block;width:34px;height:34px;border-radius:50%;margin:0 auto 4px}
#dpMap{position:fixed;left:10px;bottom:14px;z-index:12;border:0;border-radius:12px;padding:7px 12px;font:800 15px 'Baloo 2';color:#fff;background:rgba(255,255,255,.18);cursor:pointer}
#dpFever{position:fixed;left:0;right:0;bottom:17%;text-align:center;font:800 15px 'Baloo 2';letter-spacing:3px;color:#ffe66d;text-shadow:0 0 12px #ff4fa3;pointer-events:none;z-index:11;display:none}
`;
  document.head.appendChild(css);
  const dp = document.createElement('div'); dp.id = 'dp'; document.body.appendChild(dp);
  const mapBtn = document.createElement('button'); mapBtn.id = 'dpMap'; mapBtn.textContent = '☰ MAP'; document.body.appendChild(mapBtn);
  const feverEl = document.createElement('div'); feverEl.id = 'dpFever'; document.body.appendChild(feverEl);
  for (const el of [dp, mapBtn]) el.addEventListener('pointerdown', e => e.stopPropagation());

  const D = {
    get stars() { return get('dstars', {}); },
    get total() { return Object.values(D.stars).reduce((a, b) => a + b, 0); },
    get top() { let n = 0; while (D.stars[n] && n < 999) n++; return n; },       // index of the first uncleared level
    get gems() { return get('dgems', 0); },
    get skin() { return SKINS.find(s => s.id === get('dskin', 'pearl')) || SKINS[0]; },
    get trail() { return TRAILS.find(s => s.id === get('dtrail', 'plain')) || TRAILS[0]; },
    ownedTrails() { return get('dtrails', ['plain']); },
    spec(i) { return i === 'daily' ? dailySpec(dayNum(), ORDER) : null; },
    streak() { const last = get('dlast', 0), s = get('dstreak', 0); return last === dayNum() || last === dayNum() - 1 ? s : 0; },
    dailyDone() { return get('dlast', 0) === dayNum(); },
    feverText(t) { feverEl.style.display = t ? 'block' : 'none'; feverEl.textContent = t || ''; },
    // returns { newStars, unlockedSkin, chest }
    finish(i, stars, gemsGot, daily) {
      const out = { unlockedSkin: null, chest: null, dailyBonus: 0 };
      if (daily) {
        if (!D.dailyDone()) { const s = D.streak(); set('dstreak', (get('dlast', 0) === dayNum() - 1 ? s : 0) + 1); set('dlast', dayNum()); set('dgems', D.gems + 10); out.dailyBonus = 10; }
      } else { const st = D.stars; const before = D.total; st[i] = Math.max(st[i] || 0, stars); set('dstars', st);
        const nowT = D.total; out.unlockedSkin = SKINS.find(s => s.need > before && s.need <= nowT) || null; }
      const g0 = D.gems; set('dgems', g0 + gemsGot);
      if (Math.floor((g0 + gemsGot + out.dailyBonus) / CHEST_EVERY) > Math.floor(g0 / CHEST_EVERY) || (out.dailyBonus && Math.floor((g0 + out.dailyBonus) / CHEST_EVERY) > Math.floor(g0 / CHEST_EVERY))) {
        const own = D.ownedTrails(), left = TRAILS.filter(t => !own.includes(t.id));
        if (left.length) { const t = left[Math.floor(Math.random() * left.length)]; own.push(t.id); set('dtrails', own); set('dtrail', t.id); out.chest = t; }
      }
      if (out.unlockedSkin) set('dskin', out.unlockedSkin.id);
      return out;
    },
    hide() { dp.classList.remove('on'); mapBtn.style.display = ''; },
    show(html) { dp.innerHTML = '<div class="in">' + html + '</div>'; dp.classList.add('on'); mapBtn.style.display = 'none'; },
  };
  const starStr = n => '⭐'.repeat(n);
  const nextSkin = () => SKINS.find(s => s.need > D.total);
  function tomorrowLine() {
    const t = new Date(); t.setDate(t.getDate() + 1); const sp = dailySpec(dayNum(t), ORDER);
    const s = D.dailyDone() ? D.streak() + 1 : Math.max(1, D.streak() + 1);
    return `Tomorrow: Daily Jam “${SONG[sp.song].title}” · ${D.dailyDone() ? 'day ' + D.streak() + ' done, day ' + (D.streak() + 1) + ' waits' : 'keep your ' + s + '-day streak'}`;
  }
  D.tomorrowLine = tomorrowLine;
  let world = 0;
  D.openMap = (focus) => {
    if (focus !== undefined) world = Math.min(2, Math.floor(focus / 12));
    const top = D.top, st = D.stars, W = WORLDS[world], ns = nextSkin();
    let nodes = '';
    for (let k = 0; k < 12; k++) {
      const i = world * 12 + k, L = LEVELS[i] || null; if (!L) break;
      const s = st[i] || 0, cls = i < top ? 'done' : i === top ? 'next' : 'lock';
      nodes += `<button class="nd ${cls}${L.hard ? ' hard' : ''}" data-i="${i}" ${cls === 'lock' ? 'disabled' : ''}>${L.hard ? '<span class="hb">HARD</span>' : ''}${i + 1}<small>${i < top ? starStr(s) : ''}</small></button>`;
    }
    D.show(`<div class="bar"><h2>NEON HOP</h2><span class="sp"></span><span class="pill">⭐ ${D.total}</span><span class="pill">💎 ${D.gems}</span></div>
<div class="tabs" style="--w:${W.tile}">${WORLDS.map((w, k) => `<button class="tab" style="--w:${w.tile}" data-w="${k}" aria-pressed="${k === world}">${w.name}<small>${k * 12 + 1}–${k * 12 + 12}${top < k * 12 ? ' 🔒' : ''}</small></button>`).join('')}</div>
<div class="grid" style="--w:${W.tile}">${nodes}</div><div class="why" id="dpWhy">${W.blurb}</div>
<div class="meta">${ns ? `Next ball: <b>${ns.name}</b> — ${ns.need - D.total} ⭐ to go<div class="meter"><i style="width:${Math.min(100, (D.total - (SKINS[SKINS.indexOf(ns) - 1] || { need: 0 }).need) / (ns.need - (SKINS[SKINS.indexOf(ns) - 1] || { need: 0 }).need) * 100)}%"></i></div>` : 'All balls collected!'}</div>
<div class="meta">Gem chest: ${D.gems % CHEST_EVERY}/${CHEST_EVERY} 💎 · trails ${D.ownedTrails().length}/${TRAILS.length}<div class="meter"><i style="width:${D.gems % CHEST_EVERY / CHEST_EVERY * 100}%"></i></div></div>
<div class="row"><button class="btn" id="dpPlay">PLAY ${top + 1}</button><button class="btn g" id="dpDaily">${D.dailyDone() ? '✓' : '🎵'} Daily Jam${D.streak() ? ' 🔥' + D.streak() : ''}</button></div>
<div class="row"><button class="btn g" id="dpBalls">Balls</button><button class="btn g" id="dpClose">Close</button></div>
<div class="why">${tomorrowLine()}</div>`);
    dp.querySelectorAll('.tab').forEach(b => b.onclick = () => { world = +b.dataset.w; D.openMap(); });
    dp.querySelectorAll('.nd').forEach(b => { b.onmouseenter = () => { dp.querySelector('#dpWhy').textContent = LEVELS[+b.dataset.i].why; }; b.onclick = () => { D.hide(); play(+b.dataset.i); }; });
    dp.querySelector('#dpPlay').onclick = () => { D.hide(); play(top); };
    dp.querySelector('#dpDaily').onclick = () => { D.hide(); play('daily'); };
    dp.querySelector('#dpBalls').onclick = D.openBalls; dp.querySelector('#dpClose').onclick = D.hide;
  };
  D.openBalls = () => {
    D.show(`<div class="bar"><h2>BALLS</h2><span class="sp"></span><span class="pill">⭐ ${D.total}</span></div>
<div class="sk">${SKINS.map(s => `<button data-s="${s.id}" class="${D.total >= s.need ? '' : 'lk'}" aria-pressed="${D.skin.id === s.id}"><b style="background:${s.prism ? 'conic-gradient(#f55,#ff5,#5f5,#5ff,#55f,#f5f,#f55)' : s.c};box-shadow:0 0 12px ${s.e}"></b>${D.total >= s.need ? s.name : '⭐ ' + s.need}</button>`).join('')}</div>
<h3>TRAILS (from gem chests)</h3><div class="sk">${TRAILS.map(s => `<button data-t="${s.id}" class="${D.ownedTrails().includes(s.id) ? '' : 'lk'}" aria-pressed="${D.trail.id === s.id}"><b style="background:${s.prism ? 'conic-gradient(#f55,#ff5,#5f5,#5ff,#55f,#f5f,#f55)' : s.c || '#fff'}"></b>${D.ownedTrails().includes(s.id) ? s.name : '?'}</button>`).join('')}</div>
<div class="row"><button class="btn g" id="dpBack">Back</button></div>`);
    dp.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { const s = SKINS.find(x => x.id === b.dataset.s); if (D.total >= s.need) { set('dskin', s.id); D.applySkin && D.applySkin(); D.openBalls(); } });
    dp.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { if (D.ownedTrails().includes(b.dataset.t)) { set('dtrail', b.dataset.t); D.applySkin && D.applySkin(); D.openBalls(); } });
    dp.querySelector('#dpBack').onclick = () => D.openMap();
  };
  // result card: win (stars) or lose (near-miss line)
  D.result = (r) => {
    const ns = nextSkin(), again = `<button class="btn" id="dpAgain">${r.win ? 'NEXT' : 'RETRY'}</button>`;
    const retry = r.win ? `<button class="btn g" id="dpRetry">Replay</button>` : '';
    const extra = (r.win && r.out.unlockedSkin ? `<div class="meta">🎉 New ball: <b>${r.out.unlockedSkin.name}</b> (now equipped)</div>` : '')
      + (r.win && r.out.chest ? `<div class="meta">🎁 Chest! New trail: <b>${r.out.chest.name}</b></div>` : '')
      + (r.win && r.out.dailyBonus ? `<div class="meta">🔥 Daily Jam streak: ${D.streak()} · +10 💎</div>` : '');
    D.show(`<div class="card">${r.win ? `<div class="stars">${[0, 1, 2].map(k => `<i data-k="${k}">⭐</i>`).join('')}</div><div class="big">${r.title}</div>` : `<div class="big">${r.title}</div>`}
<p style="font-size:18px;margin:6px 0">${r.line}</p>
${r.win ? `<p style="opacity:.85;margin:2px 0">${r.score} pts · ${r.perfect}% perfect · ${r.gems} 💎</p>` : `<div class="meter" style="max-width:300px;margin:8px auto;height:14px"><i style="width:${r.pct}%;background:#ff4fa3"></i></div>`}
${extra}
${r.win && ns ? `<div class="meta">Next ball: <b>${ns.name}</b> · ${ns.need - D.total} ⭐ to go<div class="meter"><i style="width:${Math.min(100, D.total / ns.need * 100)}%"></i></div></div>` : ''}
<div class="row">${again}${retry}<button class="btn g" id="dpMapB">Map</button></div>
<div class="why">${tomorrowLine()}</div></div>`);
    if (r.win) r.stars && [...dp.querySelectorAll('.stars i')].forEach((el, k) => setTimeout(() => k < r.stars && el.classList.add('on'), 250 + k * 280));
    dp.querySelector('#dpAgain').onclick = () => { D.hide(); r.again(); };
    const rb = dp.querySelector('#dpRetry'); if (rb) rb.onclick = () => { D.hide(); r.retry(); };
    dp.querySelector('#dpMapB').onclick = () => D.openMap(typeof r.index === 'number' ? Math.min(r.index + (r.win ? 1 : 0), LEVELS.length - 1) : undefined);
  };
  mapBtn.onclick = () => D.openMap(Math.min(D.top, LEVELS.length - 1));
  return D;
}
