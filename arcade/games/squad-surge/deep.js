// Squad Surge v2 meta: stars per track (survivors vs par), the world map, squad colours unlocked by stars, the Daily Surge and its streak.
import { store } from './kit/hc.js';
import { daily } from './kit/daily.js';

export const SKINS = [
  { n: 'Sunny', c: '#ffd60a', at: 0 }, { n: 'Cherry', c: '#ff4d5e', at: 6 }, { n: 'Mint', c: '#2fd6a0', at: 14 },
  { n: 'Grape', c: '#9b6bff', at: 24 }, { n: 'Ink', c: '#3a3f63', at: 36 }, { n: 'Rainbow', c: '#ff9f1c', at: 50, rainbow: true },
];
const dayOf = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();

export function deepMeta(H) {
  const { ui, LEVELS, WORLDS, INTRO } = H, DS = store('squadsurge2'), N = LEVELS.length;
  const D = daily('squadsurge', ui, { name: 'Squad Surge' });
  const stars = DS.get('stars', {}) || {};
  const total = () => Object.values(stars).reduce((a, b) => a + b, 0) + DS.get('bonus', 0);
  const frontier = () => { let n = 1; while (stars[n]) n++; return n; };
  const hardOf = n => !!(LEVELS[n - 1] && LEVELS[n - 1].hard);
  const nextSkin = () => SKINS.find(s => s.at > total());
  const equip = i => { const s = SKINS[i] || SKINS[0]; H.setSquad(s.c, !!s.rainbow); };
  equip(DS.get('skin', 0));
  const tomorrow = () => `Tomorrow: a new Daily Surge · ${D.streak > 1 ? D.streak + '-day streak' : 'day 1'}`;
  const starsFor = (n, par) => n >= par[1] ? 3 : n >= par[0] ? 2 : 1;

  const st = document.createElement('style');
  st.textContent = `.ss-hud{position:fixed;bottom:calc(16px + env(safe-area-inset-bottom));left:64px;right:12px;text-align:center;z-index:5;pointer-events:none;font-weight:800;text-shadow:0 2px 0 rgba(0,0,0,.25);color:#fff}
.ss-map .st,.ss-b .st,.ss-skin .st{color:#ffd23f;vertical-align:-2px}.st{display:inline-block;width:1em;height:1em;background:currentColor;clip-path:polygon(50% 0,62% 35%,98% 36%,69% 58%,80% 92%,50% 72%,20% 92%,31% 58%,2% 36%,38% 35%)}.ss-hud .st{vertical-align:-2px}.ss-win .hc-btn{font-size:14px!important;padding:6px 16px!important;margin:0!important;background:rgba(0,0,0,.25)!important;box-shadow:none!important;order:9}.ss-win .hint{display:none}.ss-nx{margin-top:10px;font:inherit;font-weight:800;font-size:30px;border:0;border-radius:30px;padding:12px 56px;background:#fff;color:#333;box-shadow:0 6px 0 rgba(0,0,0,.22);cursor:pointer;animation:ssn 1s ease-in-out infinite}.ss-hud i{font-style:normal;color:#ffd23f}.ss-hud i.off{color:rgba(255,255,255,.45)}.ss-hud .n{font-size:13px;opacity:.95}.ss-hb{display:inline-block;background:#e8453c;border-radius:9px;padding:0 7px;margin-left:5px;font-size:11px;vertical-align:1px}
.hc-card:not(.hc-hidden)~.ss-hud{opacity:0}
.ss-hard{position:fixed;inset:0;pointer-events:none;z-index:3;box-shadow:inset 0 0 0 6px rgba(232,69,60,.85),inset 0 0 40px rgba(232,69,60,.45)}
.ss-mb{position:fixed;left:10px;bottom:calc(14px + env(safe-area-inset-bottom));width:48px;height:48px;border-radius:50%;border:0;z-index:12;font-size:22px;background:rgba(0,0,0,.3);color:#fff;box-shadow:0 3px 0 rgba(0,0,0,.2);cursor:pointer}
.ss-tm{font-size:16px!important;opacity:.95}.ss-ws{font-size:44px;letter-spacing:6px;line-height:1}.ss-ws i{font-style:normal;color:rgba(255,255,255,.3);display:inline-block;width:1em;height:1em;transform:scale(.4);transition:transform .25s cubic-bezier(.3,1.8,.5,1),color .1s}
.ss-ws i.on{color:#ffd23f;transform:scale(1)}.ss-ws i.dim{transform:scale(.8)}
.ss-map{position:fixed;inset:0;z-index:30;display:flex;flex-direction:column;align-items:center;padding:calc(16px + env(safe-area-inset-top)) 14px calc(18px + env(safe-area-inset-bottom));overflow-y:auto;color:#fff;font-family:"Baloo 2",system-ui,sans-serif;background:linear-gradient(180deg,var(--m1),var(--m2))}
.ss-map h2{margin:4px 0 0;font-size:30px;line-height:1;text-shadow:0 4px 0 rgba(0,0,0,.25)}.ss-map .tot{font-size:17px;font-weight:800;margin:4px 0 6px}
.ss-tabs{display:flex;gap:8px;margin:4px 0 10px}.ss-tabs button{font:inherit;font-weight:800;font-size:15px;border:0;border-radius:18px;padding:6px 12px;background:rgba(0,0,0,.22);color:#fff;cursor:pointer}
.ss-tabs button.on{background:#fff;color:#333}.ss-tabs button.lock{opacity:.45}
.ss-grid{display:grid;grid-template-columns:repeat(4,62px);gap:12px 16px;justify-content:center;margin:4px 0 12px}
.ss-node{position:relative;width:62px;height:62px;border-radius:50%;border:0;font:inherit;font-weight:800;font-size:23px;color:#fff;background:var(--ui);box-shadow:0 5px 0 rgba(0,0,0,.25);cursor:pointer}
.ss-node.hard{background:#e8453c;box-shadow:0 5px 0 #8f241e,0 0 0 3px #ffd23f}.ss-node.lock{background:rgba(0,0,0,.25);box-shadow:none;color:rgba(255,255,255,.5);cursor:default}
.ss-node.next{animation:ssn 1s ease-in-out infinite}@keyframes ssn{50%{transform:scale(1.12)}}
.ss-node b{position:absolute;left:0;right:0;bottom:-16px;font-size:12px;letter-spacing:1px;color:#ffd23f;text-shadow:0 2px 0 rgba(0,0,0,.35)}.ss-node b i{font-style:normal}.ss-node b i.off{color:rgba(255,255,255,.35)}
.ss-sk{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;max-width:360px;margin:12px 0 4px}
.ss-skin{width:54px;border:0;background:none;font:inherit;color:#fff;font-weight:800;font-size:11px;cursor:pointer;padding:0}.ss-skin span{display:block;width:42px;height:42px;margin:0 auto 2px;border-radius:50%;box-shadow:0 4px 0 rgba(0,0,0,.25);border:3px solid transparent}
.ss-skin.on span{border-color:#fff}.ss-skin.lock{opacity:.5;cursor:default}
.ss-row{display:flex;gap:10px;justify-content:center;margin-top:8px}.ss-b{font:inherit;font-weight:800;font-size:19px;border:0;border-radius:22px;padding:10px 20px;background:rgba(0,0,0,.3);color:#fff;cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.2)}
.ss-b.go{background:#fff;color:#333}`;
  document.head.appendChild(st);
  const hud = Object.assign(document.createElement('div'), { className: 'ss-hud' }), hardEl = Object.assign(document.createElement('div'), { className: 'ss-hard hc-hidden' });
  const mb = Object.assign(document.createElement('button'), { className: 'ss-mb', textContent: '🗺️', type: 'button', ariaLabel: 'Levels' });
  mb.addEventListener('pointerdown', e => e.stopPropagation());
  document.body.append(hud, hardEl, mb);
  const winC = ui.els.win, loseC = ui.els.lose;
  const mk = (card, cls) => { const e = Object.assign(document.createElement('p'), { className: cls }); card.querySelector('[data-x]').after(e); return e; };
  const wStars = Object.assign(document.createElement('div'), { className: 'ss-ws' }); winC.querySelector('h1').after(wStars);
  const wTm = mk(winC, 'ss-tm'), lTm = mk(loseC, 'ss-tm');
  winC.classList.add('ss-win'); const nxB = Object.assign(document.createElement('button'), { className: 'ss-nx', type: 'button', textContent: 'Next ›' }); winC.querySelector('.ss-tm').after(nxB);
  const bestN = DS.get('bestn', {}) || {};

  const row = n => Array.from({ length: 3 }, (_, i) => `<i class="st ${i < n ? '' : 'off'}"></i>`).join('');
  let curL = null, lastKey = '', mapEl = null, prev = 'play', mapWorld = 1;
  const api = {
    dayNo: () => dayOf(), frontier, stars, total,
    onLevel(L) {
      curL = L; lastKey = ''; const lv = H.getLevel(), isD = !!L.daily;
      hardEl.classList.toggle('hc-hidden', !L.hard);
      ui.els.top.querySelector('[data-a]').textContent = isD ? 'D' : lv; ui.els.top.querySelector('[data-b]').textContent = isD ? '' : lv + 1;
      if (!isD && INTRO[lv] && !stars[lv]) setTimeout(() => { if (H.state() === 'play') ui.pop(INTRO[lv], '#ffffff', 26, 40); }, 700);
      else if (L.hard) setTimeout(() => { if (H.state() === 'play') ui.pop('HARD TRACK!', '#ff6a5c', 34, 40); }, 700);
      api.tick(1);
    },
    tick(n) {
      if (!curL) return; const s = starsFor(n, curL.par), key = s + '|' + curL.n + '|' + !!curL.daily;
      if (key === lastKey) return; lastKey = key; const lv = H.getLevel();
      hud.innerHTML = `<div class="n">${curL.daily ? 'Daily Surge' : 'Track ' + lv}${curL.hard ? '<span class="ss-hb">HARD</span>' : ''} · <i class="st"></i> ${s} · ${curL.par[0]}/${curL.par[1]} for <i class="st"></i>2/<i class="st"></i>3</div>`;
    },
    won(o) {
      const s = o.daily ? 3 : starsFor(o.n, o.par), before = total(), lv = o.level;
      let nb = '', chest = 0, chestIn = 0;
      if (o.daily) { if (DS.get('dailyDone', 0) !== dayOf()) { DS.set('dailyDone', dayOf()); DS.set('bonus', DS.get('bonus', 0) + 3); nb = '+3 stars daily bonus'; } else nb = 'Daily done today'; }
      else { const old = stars[lv] || 0; if (old === 0 && o.hard) DS.set('bonus', DS.get('bonus', 0) + 1); if (s > old) { stars[lv] = s; DS.set('stars', stars); } if (old === 0) { const c = DS.get('chestN', 0) + 1; if (c >= 3) { const g = 1 + Math.floor(Math.random() * 3); DS.set('chestN', 0); DS.set('bonus', DS.get('bonus', 0) + g); chest = g; } else { DS.set('chestN', c); chestIn = 3 - c; } } }
      const now = total(), gain = now - before, sk = SKINS.find(k => k.at > before && k.at <= now);
      D.won(o.daily ? 'daily' : lv, o.daily ? 'cleared the' : 'reached track');
      const pb = o.daily ? 0 : (bestN[lv] || 0), nb2 = !o.daily && o.n > pb; if (nb2) { bestN[lv] = o.n; DS.set('bestn', bestN); }
      ui.win(lv, o.daily ? `${o.n} survivors` : `${o.n} survivors · par ${o.par[1]}${pb ? (nb2 ? ' · NEW BEST!' : ' · best ' + pb) : ''}`);
      winC.querySelector('p').innerHTML = o.daily ? 'DAILY SURGE<span data-l hidden></span>' : `TRACK <span data-l>${lv}</span>`;
      wStars.innerHTML = row(0); [...wStars.children].forEach((e, i) => { e.className = 'st'; setTimeout(() => { if (i < s) { e.className = 'st on'; H.tone(600 + i * 200, 0.12, 'triangle', 0.14, 1.3); } else e.className = 'st dim'; }, 700 + i * 260); });
      const nx = nextSkin();
      if (chest) { setTimeout(() => { H.tone(880, 0.12, 'triangle', 0.16, 1.4); H.tone(1320, 0.2, 'triangle', 0.14, 1.4); }, 1500); } wTm.innerHTML = [chest ? `🎁 BOSS CHEST: +${chest} stars!` : '', sk ? `NEW SQUAD COLOUR: ${sk.n}! (map)` : '', nb || (gain > 0 ? `+${gain} stars` : s < 3 ? `${o.par[s - 1]} survivors for ${s + 1} stars` : o.clean ? 'Flawless run!' : ''), chestIn ? `🎁 chest in ${chestIn} new track${chestIn > 1 ? 's' : ''}` : '', nx ? `${nx.at - now} stars to ${nx.n}` : '', tomorrow()].filter(Boolean).join('<br>');
    },
    lost(phase, hp, hpMax, prog, log = {}, bossN = 0) {
      const boss = phase === 'boss', pct = boss ? 1 - hp / hpMax : 0, close = boss && pct > 0.4;
      const NM = { saw: 'saws', posts: 'spiked posts', spinner: 'the spinner', pad: 'spike pads', patrol: 'the rival patrol', rivals: 'the rival gang', gates: 'a bad gate', boss: boss && curL && curL.boss.kind !== 'club' ? 'the boss ring and club' : 'the boss swats' };
      const top = Object.entries(log).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => `${v} to ${NM[k] || k}`).join(' · ');
      const bestN = DS.get('bestn', {}) || {}, pb = bestN[H.getLevel()] || 0;
      ui.lose(close ? 'SO CLOSE!' : 'SQUAD WIPED!', boss ? `The boss had ${Math.ceil(hp)} HP left (${Math.round(hp / hpMax * 100)}%)` : phase === 'clash' ? 'The rival gang beat you: bring more buddies' : `${Math.round(Math.max(0, prog) * 100)}% of the track`);
      const need = boss ? Math.max(1, Math.ceil(hp / 1.1 / 3)) : 0;
      const frac = boss ? Math.round(pct * 100) : Math.round(Math.max(0, prog) * 100);
      const bar = `<div style="margin:6px auto;width:70%;height:10px;border-radius:6px;background:#0005;overflow:hidden"><i style="display:block;height:100%;width:${frac}%;background:${frac >= 70 ? '#ffd23d' : '#7fe0ff'}"></i></div>${boss ? 'BOSS ' + frac + '% DOWN' : frac + '% OF TRACK'}${frac >= 70 ? ' · ONE MORE!' : ''}`;
      lTm.innerHTML = [bar, top ? 'Lost ' + top : '', boss ? `You reached the boss with ${bossN}: ${need > 0 ? 'about ' + need + ' more buddies would win' : 'one more try'}` : phase === 'clash' ? 'Pick the gates that add buddies' : 'Look for the gap, then slip through'].filter(Boolean).join('<br>');
    },
    next() { return curL && curL.daily ? frontier() : H.getLevel() + 1; },
    openMap(w) {
      if (!mapEl) { mapEl = document.createElement('div'); mapEl.className = 'ss-map'; mapEl.addEventListener('pointerdown', e => e.stopPropagation()); document.body.appendChild(mapEl); }
      const fr = frontier(); mapWorld = w || Math.min(WORLDS.length, Math.ceil(Math.min(fr, N) / 12));
      const W = WORLDS[mapWorld - 1]; mapEl.style.setProperty('--m1', W.bg[0]); mapEl.style.setProperty('--m2', W.bg[1]); mapEl.style.setProperty('--ui', W.ui);
      const nx = nextSkin(), cur = DS.get('skin', 0);
      let h = `<h2>SQUAD SURGE</h2><div class="tot"><i class="st"></i> ${total()}${nx ? ` · ${nx.at - total()} <i class="st"></i> to ${nx.n}` : ''}</div><div class="ss-tabs">`;
      WORLDS.forEach((w2, i) => { const ok = fr >= i * 12 + 1; h += `<button data-w="${i + 1}" class="${i + 1 === mapWorld ? 'on' : ''} ${ok ? '' : 'lock'}">${w2.icon} ${ok ? w2.name : '🔒'}</button>`; });
      h += '</div><div class="ss-grid">';
      for (let k = 1; k <= 12; k++) { const n = (mapWorld - 1) * 12 + k, s = stars[n] || 0, ok = n <= fr;
        h += `<button class="ss-node ${hardOf(n) ? 'hard' : ''} ${ok ? '' : 'lock'} ${n === fr ? 'next' : ''}" data-l="${ok ? n : 0}">${ok ? n : '🔒'}${s ? `<b>${row(s)}</b>` : ''}</button>`; }
      h += '</div>';
      const dd = DS.get('dailyDone', 0) === dayOf();
      h += `<button class="ss-b" data-d="1">📅 Daily Surge ${dd ? '✓' : '+3 <i class="st"></i>'} · ${D.streak > 1 ? D.streak + '-day streak' : 'day 1'}</button><div class="ss-sk">`;
      SKINS.forEach((s, i) => { const ok = total() >= s.at; h += `<button class="ss-skin ${i === cur ? 'on' : ''} ${ok ? '' : 'lock'}" data-s="${ok ? i : ''}"><span style="background:${s.rainbow ? 'conic-gradient(#ff4d5e,#ffd60a,#2fd6a0,#4fb6ff,#9b6bff,#ff4d5e)' : s.c}"></span>${ok ? s.n : s.at + '<i class="st"></i>'}</button>`; });
      h += `</div><div class="ss-row"><button class="ss-b" data-x="1">Back</button><button class="ss-b go" data-p="1">Play ${fr <= N ? 'track ' + fr : 'on'}</button></div>`;
      mapEl.innerHTML = h; mapEl.classList.remove('hc-hidden');
      mapEl.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { const x = +b.dataset.w; if (fr >= (x - 1) * 12 + 1) { H.sfx.tap(); api.openMap(x); } });
      mapEl.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { const n = +b.dataset.l; if (n) { api.closeMap(true); H.playLevel(n); } });
      mapEl.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { if (b.dataset.s === '') return; DS.set('skin', +b.dataset.s); equip(+b.dataset.s); H.tone(900, 0.08, 'triangle', 0.1, 1.3); api.openMap(mapWorld); });
      mapEl.querySelector('[data-d]').onclick = () => { api.closeMap(true); H.playLevel('daily'); };
      mapEl.querySelector('[data-p]').onclick = () => { api.closeMap(true); H.playLevel(fr); };
      mapEl.querySelector('[data-x]').onclick = () => api.closeMap(false);
    },
    closeMap(started) {
      if (!mapEl || mapEl.classList.contains('hc-hidden')) return; mapEl.classList.add('hc-hidden');
      if (!started && H.state() === 'map') H.setState(prev);
    },
  };
  mb.addEventListener('click', () => { const s = H.state(); if (s === 'map') return; prev = s; if (s === 'play') H.setState('map'); api.openMap(); });
  return api;
}
