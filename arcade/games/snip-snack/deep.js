// deep.js — Snip Snack v2 meta: level map (3 worlds), stars, a candy jar filled by chests, and the Daily Dessert (the
// reason to come back tomorrow). All DOM, no money, nothing to buy: candies are earned only by stars.
const KEY = 'snipsnack2_v1';
export const CANDIES = [
  { id: 'ruby', name: 'Ruby Swirl', a: '#ff3d6e', b: '#ff9bb7', bg: '#fff4f6' },
  { id: 'mint', name: 'Mint Twist', a: '#19b88a', b: '#8ff0cf', bg: '#f2fff9' },
  { id: 'grape', name: 'Grape Pop', a: '#7a4fd6', b: '#c3a6ff', bg: '#f7f2ff' },
  { id: 'sun', name: 'Sunny Stripe', a: '#ff9f1c', b: '#ffd98a', bg: '#fffaf0' },
  { id: 'sky', name: 'Sky Fizz', a: '#2f9bff', b: '#a6d8ff', bg: '#f1f9ff' },
  { id: 'cola', name: 'Cola Candy', a: '#6b3a1d', b: '#c98a55', bg: '#fff3e6' },
  { id: 'rainbow', name: 'Rainbow', a: '#ff3d6e', b: '#2f9bff', bg: '#ffe86b', multi: true },
  { id: 'gold', name: 'Golden Candy', a: '#d99a00', b: '#ffe27a', bg: '#fff9d6' },
];
export const CHEST_EVERY = 7;   // stars per chest: 8 chests = 56 stars = a little under 2 of 3 worlds fully starred
const todayKey = () => new Date().toLocaleDateString('en-CA');
const dayNum = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);

export function createDeep({ LEVELS, WORLDS, ui, sfx, tone, buzz, onPlay }) {
  let S = { st: {}, jar: ['ruby'], skin: 'ruby', chests: 0, bonus: 0, daily: '', streak: 0, lastDaily: '', best: {} };
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s) S = { ...S, ...s }; } catch (e) {}
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  const starsOf = n => S.st[n] || 0;
  const total = () => Object.values(S.st).reduce((a, b) => a + b, 0) + S.bonus;
  const unlockedTo = () => { let n = 1; while (n < LEVELS.length && starsOf(n) > 0) n++; return n; };
  const nextChestAt = () => (S.chests + 1) * CHEST_EVERY;
  const dailyLevel = () => 8 + dayNum() % 22;          // a v1-generated level number, the same for everybody that day
  const dailyDone = () => S.daily === todayKey();
  const streakNow = () => (S.lastDaily === todayKey() || S.lastDaily === new Date(Date.now() - 864e5).toLocaleDateString('en-CA')) ? S.streak : 0;

  const css = document.createElement('style');
  css.textContent = `
.sm{position:fixed;inset:0;z-index:30;display:flex;flex-direction:column;align-items:center;padding:calc(14px + env(safe-area-inset-top)) 14px 14px;overflow:auto;background:linear-gradient(180deg,#f7cf94,#d68f4c);font-family:'Baloo 2',system-ui,sans-serif;color:#6b3a1d;-webkit-user-select:none;user-select:none}
.sm.gone{display:none}
.st{display:inline-block;width:.95em;height:.95em;background:currentColor;vertical-align:-.12em;clip-path:polygon(50% 0,62% 34%,98% 36%,70% 58%,80% 92%,50% 72%,20% 92%,30% 58%,2% 36%,38% 34%)}
.tri{display:inline-block;width:0;height:0;border-left:.7em solid currentColor;border-top:.42em solid transparent;border-bottom:.42em solid transparent;margin-left:.15em;vertical-align:-.02em}
.sm .node b .st{width:11px;height:11px}
.sm h2{margin:2px 0 0;font-size:30px;color:#fff;text-shadow:0 4px 0 #c2456b;letter-spacing:1px}
.sm .why{font-size:13px;font-weight:800;opacity:.75;margin:0 0 6px}
.sm .tabs{display:flex;gap:8px;margin:6px 0}
.sm .tabs button{border:0;border-radius:14px;padding:6px 14px;font:800 15px inherit;font-family:inherit;background:rgba(255,255,255,.55);color:#6b3a1d}
.sm .tabs button.on{background:#ff6f91;color:#fff;box-shadow:0 3px 0 #c2456b}
.sm .tabs button.lock{opacity:.45}
.sm .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:9px;width:min(100%,380px);margin:8px 0}
.sm .node{position:relative;aspect-ratio:1;border:0;border-radius:16px;background:#fff7e8;box-shadow:0 4px 0 #b8743a;font:800 22px inherit;font-family:inherit;color:#6b3a1d;display:flex;align-items:center;justify-content:center;flex-direction:column;padding:0}
.sm .node.hard{background:#ffe0e0;box-shadow:0 4px 0 #c2456b;color:#c2263f}
.sm .node.lock{opacity:.4;box-shadow:none;background:#e8caa0}
.sm .node.next{animation:smp 1s infinite;background:#fff;box-shadow:0 4px 0 #ff6f91,0 0 0 3px #ff6f91}
.sm .node b{position:absolute;bottom:2px;font-size:11px;letter-spacing:-1px;color:#ffb000;text-shadow:0 1px 0 #b87a00}
.sm .node b i{font-style:normal;color:rgba(122,74,34,.3);text-shadow:none}
@keyframes smp{50%{transform:scale(1.08)}}
.sm .bar{width:min(100%,380px);height:16px;border-radius:9px;background:rgba(255,255,255,.55);overflow:hidden;margin:4px 0}
.sm .bar i{display:block;height:100%;background:linear-gradient(90deg,#ffd23f,#ff9f1c);border-radius:9px;transition:width .6s}
.sm .row{display:flex;justify-content:space-between;width:min(100%,380px);font-weight:800;font-size:15px}
.sm .jar{display:grid;grid-template-columns:repeat(8,1fr);gap:4px;width:min(100%,380px);margin:6px 0}
.sm .jar span{aspect-ratio:1;border-radius:50%;border:3px solid rgba(255,255,255,.6);display:flex;align-items:center;justify-content:center;font-weight:800;color:rgba(255,255,255,.7);background:rgba(120,60,20,.15);padding:0}
.sm .jar span.have{border-color:#fff;box-shadow:0 2px 0 rgba(0,0,0,.2)}
.sm .jar span.sel{outline:3px solid #ff6f91;outline-offset:1px}
.sm .go{border:0;border-radius:22px;padding:12px 40px;margin:8px 0;font:800 26px inherit;font-family:inherit;background:#ff6f91;color:#fff;box-shadow:0 5px 0 #c2456b}
.sm .daily{width:min(100%,380px);border:0;border-radius:18px;padding:9px 12px;margin:4px 0;font:800 17px inherit;font-family:inherit;display:flex;justify-content:space-between;align-items:center;background:#fff7e8;color:#6b3a1d;box-shadow:0 4px 0 #b8743a}
.sm .daily.ready{animation:smp 1.1s infinite;background:#fff;box-shadow:0 4px 0 #19b88a,0 0 0 3px #19b88a}
.sm .daily.done{opacity:.7;animation:none}
.sm .tip{font-size:12px;font-weight:800;opacity:.7;margin:2px 0 8px;text-align:center}
.sc-card{margin-top:10px;font-weight:800;font-size:16px;color:#fff;text-shadow:0 2px 0 rgba(140,70,20,.5);text-align:center;line-height:1.35}
.sc-card .meter{width:200px;height:12px;margin:5px auto;border-radius:7px;background:rgba(255,255,255,.4);overflow:hidden}
.sc-card .meter i{display:block;height:100%;background:linear-gradient(90deg,#ffd23f,#ff9f1c)}
.sc-btns{display:flex;gap:10px;justify-content:center;margin-top:12px}
.sc-btns button{border:0;border-radius:18px;padding:9px 18px;font:800 20px inherit;font-family:inherit;background:#fff;color:#6b3a1d;box-shadow:0 4px 0 rgba(140,70,20,.5)}
.sc-btns button.pri{background:#ff6f91;color:#fff;box-shadow:0 4px 0 #c2456b;padding:9px 26px}
.sc-hud{position:fixed;z-index:6;display:flex;gap:6px}
.sc-hud button{width:40px;height:40px;border:0;border-radius:50%;background:rgba(255,255,255,.7);box-shadow:0 3px 0 rgba(140,70,20,.4);font:800 20px inherit;color:#6b3a1d;padding:0}
.sc-hud.r{right:12px}.sc-hud.l{left:12px}
.sc-chest{position:fixed;inset:0;z-index:40;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(70,35,10,.6);color:#fff;font-family:'Baloo 2',system-ui,sans-serif;text-align:center}
.sc-chest .box{font-size:90px;animation:scshake .5s 2}
.sc-chest .cd{width:110px;height:110px;border-radius:50%;margin:10px auto;box-shadow:0 8px 24px rgba(0,0,0,.4);animation:scpop .6s}
.sc-chest h3{font-size:30px;margin:4px;text-shadow:0 3px 0 #c2456b}
@keyframes scshake{25%{transform:rotate(-12deg)}75%{transform:rotate(12deg)}}
@keyframes scpop{0%{transform:scale(0)}70%{transform:scale(1.25)}100%{transform:scale(1)}}`;
  document.head.appendChild(css);

  const sw = c => c.multi ? `conic-gradient(${c.a},${c.b},#19b88a,${c.a})` : `repeating-linear-gradient(60deg,${c.a} 0 6px,${c.b} 6px 12px)`;
  const ST = '<s class="st"></s>';
const stars = n => `<b>${ST.repeat(n)}<i>${ST.repeat(3 - n)}</i></b>`;
  const el = document.createElement('div'); el.className = 'sm gone'; el.addEventListener('pointerdown', e => e.stopPropagation()); document.body.appendChild(el);
  let world = 1;
  function openMap(w) {
    world = w || WORLDS.findIndex(x => unlockedTo() <= x.to) + 1 || 1;
    const up = unlockedTo(), W = WORLDS[world - 1], first = W.from, n = total(), nc = nextChestAt(), prev = nc - CHEST_EVERY;
    let h = `<h2>${W.name}</h2><div class="why">${W.line}</div><div class="tabs">`;
    WORLDS.forEach((x, i) => { const open = up >= x.from; h += `<button data-w="${i + 1}" class="${i + 1 === world ? 'on' : ''} ${open ? '' : 'lock'}">${open ? '' : '🔒'}${i + 1}</button>`; });
    h += `</div><div class="grid">`;
    for (let lv = first; lv <= W.to; lv++) { const open = lv <= up, s = starsOf(lv), hard = LEVELS[lv - 1].hard;
      h += `<button class="node ${hard ? 'hard' : ''} ${open ? '' : 'lock'} ${lv === up ? 'next' : ''}" data-l="${open ? lv : ''}">${open ? lv : '🔒'}${open && s ? stars(s) : ''}</button>`; }
    const dd = dailyDone();
    h += `</div><div class="row"><span>${ST} ${n}</span><span>${S.jar.length < CANDIES.length ? `${nc - n} more ${ST} for a chest 🎁` : 'jar full!'}</span></div><div class="bar"><i style="width:${Math.max(0, Math.min(1, (n - prev) / CHEST_EVERY)) * 100}%"></i></div>`;
    h += `<div class="jar">${CANDIES.map(c => `<span data-c="${S.jar.includes(c.id) ? c.id : ''}" class="${S.jar.includes(c.id) ? 'have' : ''} ${S.skin === c.id ? 'sel' : ''}" style="${S.jar.includes(c.id) ? 'background:' + sw(c) : ''}">${S.jar.includes(c.id) ? '' : '?'}</span>`).join('')}</div>`;
    h += `<button class="daily ${dd ? 'done' : 'ready'}" data-d="1"><span>🍰 Daily Dessert</span><span>${dd ? 'done · new one tomorrow' : `+3 ${ST} · streak ${streakNow() + 1}`}</span></button>`;
    h += `<button class="go" data-l="${Math.min(up, LEVELS.length)}">PLAY<s class="tri"></s></button><div class="tip">Tap a candy to wear it · ${LEVELS.length} levels, then Pip's bonus rounds</div>`;
    el.innerHTML = h; el.classList.remove('gone');
    el.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { const x = +b.dataset.w; if (up >= WORLDS[x - 1].from) { sfx.tap && sfx.tap(); openMap(x); } });
    el.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { const lv = +b.dataset.l; if (lv) { sfx.tap && sfx.tap(); el.classList.add('gone'); onPlay(lv); } });
    el.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { if (b.dataset.c) { S.skin = b.dataset.c; persist(); tone(900, 0.08, 'triangle', 0.1, 1.3); onSkin && onSkin(); openMap(world); } });
    el.querySelector('[data-d]').onclick = () => { if (dd) { tone(300, 0.1, 'sine', 0.08, 0.8); return; } el.classList.add('gone'); onPlay('daily'); };
  }
  let onSkin = null;
  function closeMap() { el.classList.add('gone'); }

  /** record a cleared level; returns what the win card shows */
  function recordWin(lv, st) {
    const daily = lv === 'daily', before = total();
    if (daily) {
      if (!dailyDone()) { S.streak = streakNow() + 1; S.lastDaily = todayKey(); S.daily = todayKey(); S.bonus += 3; }
    } else if (st > starsOf(lv)) S.st[lv] = st;
    const now = total(); let chest = null;
    while (now >= nextChestAt() && S.jar.length < CANDIES.length) {
      const locked = CANDIES.filter(c => !S.jar.includes(c.id)); chest = locked[Math.floor(Math.random() * locked.length)];
      S.jar.push(chest.id); S.chests++; S.skin = chest.id;
    }
    persist();
    return { gained: now - before, total: now, toChest: S.jar.length >= CANDIES.length ? 0 : nextChestAt() - now, perChest: CHEST_EVERY, chest, streak: streakNow(), daily };
  }
  function showChest(c, done) {
    const d = document.createElement('div'); d.className = 'sc-chest'; d.innerHTML = `<div class="box">🎁</div>`; document.body.appendChild(d);
    tone(300, 0.2, 'square', 0.08, 0.5); buzz([30, 40, 30]);
    setTimeout(() => { d.innerHTML = `<h3>NEW CANDY!</h3><div class="cd" style="background:${sw(c)}"></div><h3>${c.name}</h3><div style="font-weight:800">${S.jar.length} / ${CANDIES.length} in the jar</div>`;
      [660, 880, 1100, 1320].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.12, 1.2), i * 90)); buzz([20, 30, 20, 30, 40]); }, 1100);
    setTimeout(() => { d.remove(); done && done(); }, 3300);
  }
  function tomorrow() {
    const sn = streakNow(); return dailyDone() ? `Tomorrow: a new Daily Dessert · ${sn} day streak` : `Daily Dessert waits: +3 stars · ${sn ? 'streak ' + sn + ' → ' + (sn + 1) : 'start a streak'}`;
  }
  return { S: () => S, openMap, closeMap, recordWin, showChest, tomorrow, starsOf, total, unlockedTo, dailyLevel, dailyDone, skin: () => CANDIES.find(c => c.id === S.skin) || CANDIES[0],
    set onSkin(f) { onSkin = f; }, nextChestAt, streakNow };
}
