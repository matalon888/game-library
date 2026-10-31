// Boxbound v2 — the notebook: page map (3 worlds x 10 pages), stars, pen collection, Daily Page streak, result card.
import { LEVELS, WORLDS } from './levels.js';
import { model, solve } from './solve.js';

export const PENS = [
  { id: 'blue', name: 'Blue', c: '#3f7fd8', need: 0 }, { id: 'teal', name: 'Teal', c: '#1fa6a0', need: 3 }, { id: 'green', name: 'Green', c: '#3aa75a', need: 6 },
  { id: 'purple', name: 'Purple', c: '#7d55d4', need: 10 }, { id: 'pink', name: 'Pink', c: '#e0559a', need: 15 }, { id: 'orange', name: 'Orange', c: '#ee8a2a', need: 21 },
  { id: 'navy', name: 'Navy', c: '#22307a', need: 28 }, { id: 'ruby', name: 'Ruby', c: '#c4254a', need: 36 }, { id: 'lime', name: 'Lime', c: '#7fb81f', need: 45 },
  { id: 'sky', name: 'Sky', c: '#33b8f0', need: 55 }, { id: 'ink', name: 'Ink', c: '#1b1f33', need: 66 }, { id: 'gold', name: 'Gold', c: '#d9a21b', need: 80 },
];
export const dayNum = (d = new Date()) => Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400000);
const STAR = '<i class="sh"></i>';

function rngf(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
/** today's page: same for everyone, found with the same rules as the authored pages (solver-checked) */
export function dailyPage(day) {
  const n = 4, m = model(n), nb = 16;
  for (let seed = 1; seed < 500; seed++) {
    const r = rngf(day * 9301 + seed * 7919), d = new Array(m.E).fill(0), claimed = [];
    while (claimed.length < 4) { const b = Math.floor(r() * nb); if (!claimed.includes(b)) claimed.push(b); }
    let left = m.E; for (const b of claimed) for (const e of m.boxEdges[b]) if (!d[e]) { d[e] = 1; left--; }
    const sides = (b) => m.boxEdges[b].reduce((a, e) => a + d[e], 0);
    let ok = true;
    while (left > 13) {
      const cand = []; for (let e = 0; e < m.E; e++) if (!d[e]) { const wst = Math.max(0, ...m.edgeBoxes[e].filter(b => !claimed.includes(b)).map(b => sides(b) + 1)); if (wst <= 2) cand.push(e); }
      if (!cand.length) { ok = false; break; }
      const e = cand[Math.floor(r() * cand.length)]; d[e] = 1; left--;
    }
    if (!ok) continue;
    const gold = []; while (gold.length < 1 + (day % 2)) { const b = Math.floor(r() * nb); if (!gold.includes(b) && !claimed.includes(b)) gold.push(b); }
    const w = new Array(nb).fill(1); claimed.forEach(b => w[b] = 0); gold.forEach(b => w[b] = 2);
    const res = solve(m, d, w); if (!res || res.value < 2) continue;
    const vals = [...res.firsts.values()]; if (vals.filter(v => v >= res.value).length / vals.length > 0.4) continue;
    const V = res.value;
    return { n, claimed: claimed.sort((a, b) => a - b), pre: [2, 2], edges: d.map((x, i) => x ? i : -1).filter(i => i >= 0), gold: gold.sort((a, b) => a - b), cpu: 1, cpuFirst: false, opt: V, stars: [1, Math.min(Math.max(2, Math.round(V * 0.6)), V), V], why: 'Today\'s page: the same for everyone.', daily: true };
  }
  return { ...LEVELS[6], why: 'Today\'s page.', daily: true };
}

const GOALS = [
  { id: 'wins', t: 'Win 3 pages', n: 3 }, { id: 'chain', t: 'Take a chain of 3 boxes', n: 1 }, { id: 'gold', t: 'Win a page with gold boxes', n: 1 },
  { id: 'stars', t: 'Earn 4 stars', n: 4 }, { id: 'nohint', t: 'Win 2 pages with no hint or undo', n: 2 }, { id: 'wins5', t: 'Win 5 pages', n: 5 },
];
export function createDeep(S, hooks) {
  const get = (k, d) => S.get('bxd_' + k, d), set = (k, v) => S.set('bxd_' + k, v);
  const css = document.createElement('style');
  css.textContent = `
#bx{position:fixed;inset:0;z-index:40;display:none;font-family:ui-rounded,'Baloo 2',-apple-system,system-ui,sans-serif;color:#2f3550;background:rgba(251,250,244,.96);overflow:auto;-webkit-overflow-scrolling:touch}
#bx.on{display:block}#bx *{box-sizing:border-box}
#bx .in{max-width:460px;margin:0 auto;padding:16px 14px 40px}
#bx h2{margin:0;font-size:26px;font-weight:800}
#bx .bar{display:flex;gap:8px;align-items:center;margin:0 0 8px}#bx .sp{flex:1}
#bx .pill{background:#fff;border-radius:999px;padding:4px 12px;font-weight:800;font-size:16px;white-space:nowrap;box-shadow:0 2px 8px rgba(40,40,80,.1)}
#bx .btn{border:0;border-radius:16px;padding:12px 20px;font:800 19px inherit;color:#fff;background:#4f6fd6;box-shadow:0 4px 0 #34479a;cursor:pointer}
#bx .btn:active{transform:translateY(3px);box-shadow:0 1px 0 #34479a}#bx .btn.g{background:#fff;color:#2f3550;box-shadow:0 3px 0 #cfd0dc;font-size:16px}
#bx .tabs{display:flex;gap:6px;margin:8px 0}#bx .tab{flex:1;border:2px solid #d9dae6;background:#fff;color:#2f3550;border-radius:12px;padding:6px 2px;font:800 14px inherit;cursor:pointer;line-height:1.1}
#bx .tab[aria-pressed=true]{background:var(--w);border-color:var(--w);color:#fff}#bx .tab small{display:block;font-weight:600;opacity:.85;font-size:11px}
#bx .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:9px;margin-top:8px}
#bx .nd{position:relative;aspect-ratio:1;border-radius:16px;border:0;background:#fff;box-shadow:0 2px 8px rgba(40,40,80,.1);color:#2f3550;font:800 22px inherit;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0}
#bx .nd.done{background:var(--w);color:#fff}#bx .nd.next{background:#fff;border:3px solid var(--w);animation:bxp 1s ease-in-out infinite}
#bx .nd.lock{opacity:.35;cursor:default}#bx .nd.gold::after{content:'';position:absolute;top:5px;right:5px;width:9px;height:9px;border-radius:2px;background:#e0a020}
#bx .nd small{font-size:10px;letter-spacing:-1px;line-height:1;margin-top:1px}
@keyframes bxp{50%{transform:scale(1.08)}}
#bx .why{margin-top:12px;font-size:14px;opacity:.85;min-height:20px;text-align:center}
#bx .card{text-align:center;padding-top:70px}#bx .stars{font-size:54px;letter-spacing:6px;margin:6px 0;filter:drop-shadow(0 0 12px #ffd84d)}
#bx .stars .sg{font-style:normal;display:inline-block;opacity:.2;transform:scale(.6);transition:all .35s cubic-bezier(.3,1.8,.5,1);color:#e0a020}#bx .stars .sg.on{opacity:1;transform:scale(1)}
#bx .big{font-size:38px;font-weight:800;line-height:1.05}#bx .row{display:flex;gap:10px;justify-content:center;margin:16px 0}
#bx .meta{background:#fff;border-radius:14px;padding:9px 12px;margin:8px auto;max-width:360px;font-size:15px;text-align:left;box-shadow:0 2px 8px rgba(40,40,80,.08)}
#bx .meter{height:10px;border-radius:6px;background:#e4e5ef;overflow:hidden;margin-top:5px}#bx .meter i{display:block;height:100%;background:#e0a020;border-radius:6px}
#bx .sk{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}#bx .sk button{border:2px solid transparent;border-radius:14px;background:#fff;color:#2f3550;font:700 12px inherit;padding:8px 2px;cursor:pointer}
#bx .sk button[aria-pressed=true]{border-color:#2f3550}#bx .sk button.lk{opacity:.4}#bx .sk b{display:block;width:30px;height:7px;border-radius:4px;margin:8px auto 8px}
#du-toast{white-space:normal!important;max-width:310px;text-align:center;line-height:1.25}
#bx .sh{display:inline-block;width:.95em;height:.95em;background:currentColor;vertical-align:-.1em;clip-path:polygon(50% 0,62% 36%,100% 38%,70% 60%,80% 96%,50% 74%,20% 96%,30% 60%,0 38%,38% 36%)}
#bx .stars .sh{width:1em;height:1em}#bx .nd small .sh{width:9px;height:9px;margin:0 1px}
#bxMap{position:fixed;left:8px;bottom:36px;z-index:12;border:0;border-radius:12px;padding:5px 9px;font:800 12px ui-rounded,system-ui;color:#2f3550;background:rgba(255,255,255,.9);box-shadow:0 2px 8px rgba(40,40,80,.15);cursor:pointer;display:none}
#bxGoal{position:fixed;left:0;right:0;bottom:calc(86px + env(safe-area-inset-bottom));text-align:center;z-index:5;pointer-events:none;font:800 12px ui-rounded,system-ui;letter-spacing:2px;color:#2f3550;opacity:.7;display:none}
`;
  document.head.appendChild(css);
  const bx = document.createElement('div'); bx.id = 'bx'; document.body.appendChild(bx);
  const goalEl = document.createElement('div'); goalEl.id = 'bxGoal'; document.body.appendChild(goalEl);
  bx.addEventListener('pointerdown', e => e.stopPropagation());
  const mapBtn = document.createElement('button'); mapBtn.id = 'bxMap'; mapBtn.textContent = '☰ PAGES'; document.body.appendChild(mapBtn);
  mapBtn.addEventListener('pointerdown', e => e.stopPropagation());
  mapBtn.onclick = () => { hooks.abandon(); D.map(); };

  const D = {
    cur: null, world: 0,
    /** three goals for today (same for everyone); finishing all three gives a bonus star */
    get goals() {
      const t = dayNum(), g = get('goals', null);
      if (g && g.day === t) return g;
      const r = rngf(t * 2654435 + 17), pool = GOALS.slice(), pick = [];
      while (pick.length < 3) pick.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
      const ng = { day: t, list: pick.map(p => ({ id: p.id, t: p.t, n: p.n, v: 0 })), paid: false }; set('goals', ng); return ng;
    },
    progress(info, stars, sp) {
      const g = D.goals; let bonus = 0;
      for (const q of g.list) {
        const was = q.v >= q.n;
        if (q.id === 'wins' || q.id === 'wins5') q.v += info.won ? 1 : 0;
        else if (q.id === 'chain') q.v = Math.max(q.v, info.maxRun >= 3 ? 1 : 0);
        else if (q.id === 'gold') q.v += info.won && sp.gold.length ? 1 : 0;
        else if (q.id === 'stars') q.v += stars;
        else if (q.id === 'nohint') q.v += info.won && !info.assisted ? 1 : 0;
        q.v = Math.min(q.n, q.v);
      }
      let done = g.list.every(q => q.v >= q.n);
      if (done && !g.paid) { g.paid = true; set('dstars', get('dstars', 0) + 1); bonus = 1; }
      set('goals', g); return bonus;
    },
    get stars() { return get('stars', {}); },
    get best() { return get('best', {}); },
    get total() { return Object.values(D.stars).reduce((a, b) => a + b, 0) + get('dstars', 0); },
    get top() { let n = 0; while (D.stars[n] && n < LEVELS.length) n++; return n; },
    get pen() { return PENS.find(p => p.id === get('pen', 'blue')) || PENS[0]; },
    get streak() { const d = get('dlast', -9), s = get('streak', 0), t = dayNum(); return d === t || d === t - 1 ? s : 0; },
    get dailyDone() { return get('dlast', -9) === dayNum(); },
    penFor(total) { return PENS.filter(p => p.need <= total); },
    open() { bx.classList.add('on'); mapBtn.style.display = 'none'; goalEl.style.display = 'none'; },
    close() { bx.classList.remove('on'); mapBtn.style.display = 'block'; },
    spec() { return D.cur.spec; },
    play(i) {
      D.cur = i === 'daily' ? { index: 'daily', spec: dailyPage(dayNum()) } : { index: i, spec: LEVELS[i] };
      D.close(); hooks.start(D.cur);
    },
    again() { D.close(); hooks.start(D.cur); },
    next() { const i = D.cur.index; if (typeof i === 'number' && i + 1 < LEVELS.length) D.play(i + 1); else D.map(); },
    map() {
      D.open(); if (D.cur && typeof D.cur.index === 'number') D.world = Math.floor(D.cur.index / 10); else D.world = Math.min(2, Math.floor(Math.min(D.top, 29) / 10));
      const st = D.stars, top = D.top, wo = D.world, w = WORLDS[wo];
      const wStars = (k) => { let s = 0; for (let i = k * 10; i < k * 10 + 10; i++) s += st[i] || 0; return s; };
      const nextPen = PENS.find(p => p.need > D.total);
      let h = `<div class="in" style="--w:${w.c}"><div class="bar"><h2>Boxbound</h2><span class="sp"></span><span class="pill">${STAR} ${D.total}</span></div>`;
      h += `<div class="tabs">${WORLDS.map((x, k) => `<button class="tab" style="--w:${x.c}" aria-pressed="${k === wo}" data-w="${k}">${x.name}<small>${wStars(k)}/30 ${STAR}</small></button>`).join('')}</div>`;
      h += `<div class="grid">`;
      for (let k = 0; k < 10; k++) {
        const i = wo * 10 + k, s = st[i] || 0, lock = i > top, nx = i === top;
        h += `<button class="nd ${s ? 'done' : ''} ${nx ? 'next' : ''} ${lock ? 'lock' : ''} ${LEVELS[i].gold.length ? 'gold' : ''}" data-i="${i}">${i + 1}<small>${s ? STAR.repeat(s) : (lock ? '' : '·')}</small></button>`;
      }
      h += `</div><div class="why">${w.sub}</div>`;
      const dd = D.dailyDone, sk = D.streak;
      h += `<div class="meta" style="display:flex;align-items:center;gap:10px"><div style="flex:1"><b>Daily Page</b><br><span style="opacity:.75;font-size:13px">${dd ? 'Done today. New page tomorrow' : 'Same page for everyone today'}${sk ? ` · ${sk}-day streak` : ''}</span></div><button class="btn g" data-d="1" style="padding:8px 14px">${dd ? 'Again' : 'Play'}</button></div>`;
      h += `<div class="meta"><b>Today's goals</b>${D.goals.paid ? ' · all done' : ' · finish all 3 for +1 ' + STAR}${D.goals.list.map(q => `<div style="margin-top:4px;${q.v >= q.n ? 'opacity:.55' : ''}">${q.v >= q.n ? '✓ ' : ''}${q.t}${q.n > 1 ? ` · ${q.v}/${q.n}` : ''}</div>`).join('')}</div>`;
      if (nextPen) h += `<div class="meta">Next pen: <b>${nextPen.name}</b> at ${nextPen.need} ${STAR} <div class="meter"><i style="width:${Math.min(100, D.total / nextPen.need * 100)}%"></i></div></div>`;
      h += `<h3 style="margin:16px 0 4px;font-size:13px;letter-spacing:2px;opacity:.7">PENS</h3><div class="sk">${PENS.map(p => `<button class="${p.need > D.total ? 'lk' : ''}" aria-pressed="${D.pen.id === p.id}" data-p="${p.id}"><b style="background:${p.c}"></b>${p.need > D.total ? p.need + ' ' + STAR : p.name}</button>`).join('')}</div></div>`;
      bx.innerHTML = h;
      bx.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { D.cur = null; D.world = +b.dataset.w; D.cur = { index: D.world * 10 }; D.mapW(D.world); });
      bx.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const i = +b.dataset.i; if (i > top) { hooks.err(); return; } D.play(i); });
      bx.querySelector('[data-d]').onclick = () => D.play('daily');
      bx.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { const p = PENS.find(x => x.id === b.dataset.p); if (p.need > D.total) { hooks.err(); return; } set('pen', p.id); hooks.pen(); D.map(); });
    },
    mapW(k) { D.cur = { index: k * 10 }; D.map(); },
    /** result card. info: { won, mine, cpu, margin } */
    result(info) {
      const sp = D.cur.spec, daily = D.cur.index === 'daily', before = D.total;
      let stars = 0;
      if (info.won) { stars = 1; if (info.margin >= sp.stars[1]) stars = 2; if (info.margin >= sp.stars[2] && !info.assisted) stars = 3; }
      let rec = '';
      if (!daily) {
        const st = { ...D.stars }, i = D.cur.index;
        if ((st[i] || 0) < stars) { st[i] = stars; set('stars', st); }
        const bs = { ...D.best }; if (info.won && (bs[i] ?? -99) < info.margin) { bs[i] = info.margin; set('best', bs); rec = (bs[i] === info.margin && (D.best[i] !== undefined)) ? '' : ''; }
      } else if (info.won && !D.dailyDone) {
        const t = dayNum(), s = get('dlast', -9) === t - 1 ? get('streak', 0) + 1 : 1;
        set('dlast', t); set('streak', s); set('dstars', get('dstars', 0) + 2);
      }
      const gb = D.progress(info, stars, sp);
      const total = D.total, newPens = PENS.filter(p => p.need > before && p.need <= total);
      const cu = D.cur.index, nxt = (typeof cu === 'number' && cu + 1 < LEVELS.length);
      const need = !info.won ? sp.stars[0] - info.margin : stars < 3 ? (stars < 2 ? sp.stars[1] : sp.stars[2]) - info.margin : 0;
      let line;
      if (info.won) line = stars === 3 ? 'Perfect page!' : `Win by ${info.margin} · ${stars === 1 ? '2' : '3'}${STAR} needs +${need > 0 ? need : 1} more`;
      else if (info.margin === 0) line = 'A draw: one box short';
      else line = Math.abs(info.margin) <= 2 ? `SO CLOSE: lost by ${Math.abs(info.margin)}` : `Lost by ${Math.abs(info.margin)}`;
      const pg = typeof cu === 'number' ? `Page ${cu + 1}` : 'Daily Page';
      const tom = daily ? `Tomorrow: a new Daily Page${D.streak ? ` · keep your ${D.streak}-day streak` : ''}` : (D.dailyDone ? `Tomorrow: Daily Page · streak ${D.streak}` : 'Daily Page is waiting');
      const nextPen = PENS.find(p => p.need > total);
      D.open();
      bx.innerHTML = `<div class="in card"><div class="why" style="margin:0">${pg}</div><div class="big">${info.won ? 'Page done!' : (info.margin === 0 ? 'Draw' : 'Not yet')}</div>
<div class="stars">${[0, 1, 2].map(k => `<span class="sg" data-s="${k}"><i class="sh"></i></span>`).join('')}</div>
<div class="why" style="font-size:19px;font-weight:800;opacity:1">${info.mine} – ${info.cpu} · ${line}</div>
${!info.won && sp.why ? `<div class="meta">Idea: ${sp.why}</div>` : ''}
${sp.stars[2] > 0 && info.won && stars < 3 ? `<div class="meta">${STAR}${STAR}${STAR} needs a win by ${sp.stars[2]}${info.assisted ? ' with no hint or undo' : ''}</div>` : ''}
${newPens.length ? `<div class="meta">New pen: <b>${newPens.map(p => p.name).join(', ')}</b> <span style="display:inline-block;width:34px;height:7px;border-radius:4px;background:${newPens[0].c};vertical-align:middle"></span></div>` : (nextPen ? `<div class="meta">Next pen: <b>${nextPen.name}</b> at ${nextPen.need} ${STAR}<div class="meter"><i style="width:${Math.min(100, total / nextPen.need * 100)}%"></i></div></div>` : '')}
<div class="meta">Today: ${D.goals.list.map(q => `<span style="${q.v >= q.n ? 'opacity:.5;text-decoration:line-through' : ''}">${q.t}${q.n > 1 ? ` ${q.v}/${q.n}` : ''}</span>`).join(' · ')}${gb ? ` <b>All done: +1 ${STAR}</b>` : ''}</div>
<div class="meta" style="opacity:.85">${tom}</div>
<div class="row">${info.won && nxt && D.stars[cu + 1] === undefined ? `<button class="btn" data-a="next">Next page</button><button class="btn g" data-a="again">Again</button>` : info.won ? `<button class="btn" data-a="${nxt ? 'next' : 'map'}">${nxt ? 'Next page' : 'Pages'}</button><button class="btn g" data-a="again">Again</button>` : `<button class="btn" data-a="again">Try again</button>`}<button class="btn g" data-a="map">Pages</button></div></div>`;
      { const sb = bx.querySelector('.stars'); if (sb) sb.onclick = () => bx.querySelectorAll('[data-s]').forEach(el => { if (+el.dataset.s < stars) el.classList.add('on'); }); }
      bx.querySelectorAll('[data-s]').forEach(el => { if (+el.dataset.s < stars) setTimeout(() => { el.classList.add('on'); hooks.star(+el.dataset.s); }, 350 + 330 * +el.dataset.s); });
      bx.querySelectorAll('[data-a]').forEach(b => b.onclick = () => ({ next: D.next, again: D.again, map: D.map })[b.dataset.a]());
      return stars;
    },
    goal(t) { goalEl.textContent = t; goalEl.style.display = t ? 'block' : 'none'; },
  };
  return D;
}
