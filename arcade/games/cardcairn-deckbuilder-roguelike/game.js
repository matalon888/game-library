// Cardcairn — original deckbuilder roguelike. Tumble the badger climbs three acts of a mountain:
// pick a path on the map, fight cartoon monsters with a deck of cards, collect relics, beat a boss per act.
import { createUI, store, sfx, tone, note, buzz } from './kit/hc.js';
import { flow } from './kit/flow.js';
import { daily } from './kit/daily.js';
import { board } from './kit/board.js';
import { CARDS, REL, EN, ACTS } from './data.js';
import { heroSVG, foeSVG } from './art.js';

const NAME = 'Cardcairn: Deckbuilder Roguelike';
const S = store('cardcairn');
const F = flow('cardcairn');
const ui = createUI({ title: 'CARD<br>CAIRN', hint: 'Tap to climb', hand: '', progress: false, score: false });
const D = daily('cardcairn', ui, { name: NAME });
const B = board({ game: 'cardcairn', label: 'Floors cleared', limits: { maxRun: 90, maxPerSec: 1 }, mode: 'best', corner: 'tl' });
const FAST = !!navigator.webdriver;                        // automated QA runs: shorter animations
const sleep = ms => new Promise(r => setTimeout(r, ms * (FAST ? 0.4 : 1)));
const $ = (s, el = document) => el.querySelector(s);
const mk = (cls, html = '', parent = document.body, tag = 'div') => { const d = document.createElement(tag); d.className = cls; d.innerHTML = html; parent.appendChild(d); return d; };
const ROWS = 15, COLS = 7, SAVEK = D.isDaily ? 'run_d' + D.seed : 'run';
const STK = { str: ['💪', 'Strength: +dmg per hit'], dex: ['🍃', 'Dexterity: +Block per card'], vu: ['💔', 'Vulnerable: takes 50% more'], wk: ['🥀', 'Weak: deals 25% less'], ps: ['🧪', 'Poison: loses HP each turn'], th: ['🌵', 'Thorns: hurts attackers'] };

let state = 'ready', run = null, C = null, P = null, busy = false, scr = 'none', botFn = null, best = S.get('best', 0);

// ---------------------------------------------------------------- rng (state saved with the run)
function rand() { let t = (run.rs = (run.rs + 0x6D2B79F5) | 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const ri = (a, b) => a + Math.floor(rand() * (b - a + 1));
const pick = a => a[Math.floor(rand() * a.length)];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------------------------------------------------------------- background (sky, peaks, ground) per act
const cv = $('#bg'), cx = cv.getContext('2d');
function paintBg() {
  const A = ACTS[run ? run.act : 1], dpr = Math.min(devicePixelRatio, 2), W = innerWidth, H = innerHeight;
  cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  let g = cx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, A.sky[0]); g.addColorStop(0.6, A.sky[1]); cx.fillStyle = g; cx.fillRect(0, 0, W, H);
  let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  if (run && run.act === 3) { cx.fillStyle = '#fff'; for (let i = 0; i < 70; i++) { cx.globalAlpha = 0.3 + r() * 0.7; cx.fillRect(r() * W, r() * H * 0.5, 2, 2); } cx.globalAlpha = 1;
    cx.fillStyle = '#fff8dc'; cx.beginPath(); cx.arc(W * 0.78, H * 0.14, 34, 0, 7); cx.fill(); cx.fillStyle = A.sky[0]; cx.beginPath(); cx.arc(W * 0.78 + 14, H * 0.14 - 8, 30, 0, 7); cx.fill(); }
  else { cx.fillStyle = 'rgba(255,255,240,.75)'; cx.beginPath(); cx.arc(W * 0.24, H * 0.16, 42, 0, 7); cx.fill(); cx.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 5; i++) { const x = r() * W, y = 60 + r() * H * 0.25; cx.beginPath(); cx.ellipse(x, y, 50 + r() * 40, 12, 0, 0, 7); cx.fill(); } }
  A.hills.forEach((c, li) => {
    cx.fillStyle = c; cx.beginPath(); const base = H * (0.42 + li * 0.1); cx.moveTo(0, H);
    for (let x = 0; x <= W + 40; x += 40 + r() * 50) cx.lineTo(x, base - r() * (110 - li * 25) - (li === 0 && x > W * 0.4 && x < W * 0.7 ? 80 : 0));
    cx.lineTo(W, H); cx.fill();
    if (li === 0) { cx.fillStyle = 'rgba(255,255,255,.5)'; }
  });
  g = cx.createLinearGradient(0, H * 0.62, 0, H); g.addColorStop(0, A.ground[0]); g.addColorStop(1, A.ground[1]); cx.fillStyle = g;
  cx.beginPath(); cx.moveTo(0, H * 0.66); cx.quadraticCurveTo(W * 0.5, H * 0.6, W, H * 0.66); cx.lineTo(W, H); cx.lineTo(0, H); cx.fill();
  cx.fillStyle = 'rgba(0,0,0,.12)'; for (let i = 0; i < 26; i++) { cx.beginPath(); cx.ellipse(r() * W, H * 0.68 + r() * H * 0.3, 6 + r() * 14, 3 + r() * 5, 0, 0, 7); cx.fill(); }
  document.body.style.setProperty('--bg1', A.sky[0]); document.body.style.setProperty('--bg2', A.sky[1]);
}
addEventListener('resize', () => { paintBg(); if (scr === 'map') renderMap(); if (scr === 'combat') renderHand(); });

// ---------------------------------------------------------------- HUD
const hud = mk('hud', `<span class="chip hp" data-hp></span><span class="chip" data-pb></span><span class="chip fl" data-fl></span><button class="hbtn" data-deck>🂠</button><button class="hbtn" data-mu>🎵</button>`);
const relRow = mk('relics');
hud.addEventListener('pointerdown', e => e.stopPropagation()); relRow.addEventListener('pointerdown', e => e.stopPropagation());
$('[data-deck]', hud).onclick = () => { if (!busy && !$('.ov')) deckView(); };
let musicOn = S.get('music', 1);
const muBtn = $('[data-mu]', hud); const paintMu = () => muBtn.style.opacity = musicOn ? 1 : 0.4; paintMu();
muBtn.onclick = () => { musicOn = musicOn ? 0 : 1; S.set('music', musicOn); paintMu(); };
let tipT;
function tip(text) { document.querySelectorAll('.tip').forEach(t => t.remove()); const t = mk('tip', text); clearTimeout(tipT); tipT = setTimeout(() => t.remove(), 2200); }
function paintHud() {
  if (!run) return;
  const hp = P ? P.hp : run.hp;
  $('[data-hp]', hud).textContent = `❤️ ${Math.max(0, hp)}/${run.maxHp}`;
  $('[data-pb]', hud).textContent = `🪨 ${run.peb}`;
  $('[data-fl]', hud).textContent = `⛰️ ${(run.act - 1) * ROWS + Math.max(0, run.row) + 1}`;
  $('[data-deck]', hud).textContent = `🂠 ${run.deck.length}`;
  relRow.innerHTML = '';
  run.relics.forEach(id => { const b = mk('relic', REL[id].i, relRow); b.onclick = () => tip(`<b>${REL[id].n}</b> · ${REL[id].d}`); });
}
const showHud = on => { hud.classList.toggle('on', on); relRow.classList.toggle('on', on); };

// ---------------------------------------------------------------- music: a calm minor-key arpeggio composed in code
const PROG = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], PAT = [0, 1, 2, 1, 2, 1, 0, 2];
let mStep = 0;
setInterval(() => {
  if (!musicOn || state !== 'play' || document.hidden) return;
  const ch = PROG[Math.floor(mStep / 8) % 4], i = mStep % 8; mStep++;
  if (i === 0) note(ch[0] - 12, 1.6, 0.05);
  note(ch[PAT[i]] + (C && C.boss ? 0 : 12), 0.5, 0.028);
}, 310);

// ---------------------------------------------------------------- cards
const has = id => run && run.relics.includes(id);
function cd(c) { const d = CARDS[c.id], f = c.up ? { ...d.b, ...d.u } : d.b; return { ...d, f, cost: f.c != null ? f.c : d.c, up: !!c.up, name: d.n + (c.up ? '+' : '') }; }
const needsT = f => !f.all && (f.d != null || f.vu || f.wk || f.ps || f.sp === 'blkdmg' || f.sp === 'dblps' || f.sp === 'clrblk');
const g = (e, k) => (e && e.st[k]) || 0;
function dmgCalc(src, tgt, base) { let v = base + g(src, 'str'); if (g(src, 'wk')) v *= 0.75; if (tgt && g(tgt, 'vu')) v *= 1.5; return Math.max(0, Math.floor(v)); }
function desc(k) {
  const f = k.f, o = [], all = f.all ? ' to ALL' : '', n = (v, base) => v !== base ? `<em>${v}</em>` : v;
  if (f.sp === 'clrblk') o.push('Remove the Block of the target.');
  if (f.sp === 'blkdmg') o.push(`Deal damage equal to your <b>Block</b>${P ? ` (${n(dmgCalc(P, null, P.blk), P.blk)})` : ''}.`);
  else if (f.d != null) { const v = P ? dmgCalc(P, null, f.d) : f.d; o.push(`Deal ${n(v, f.d)} damage${f.x > 1 ? ` ${f.x} times` : ''}${all}.`); }
  if (f.sp === 'missing') o.push('+1 per 3 HP you are missing.');
  if (f.b) { const v = P ? f.b + g(P, 'dex') : f.b; o.push(`Gain ${n(v, f.b)} <b>Block</b>.`); }
  if (f.sp === 'blkatk') o.push(`+${f.b2} more if a foe plans to attack.`);
  if (f.sp === 'dblblk') o.push('Double your <b>Block</b>.');
  if (f.sp === 'dblps') o.push('Double the target\'s <b>Poison</b>.');
  if (f.vu) o.push(`Apply ${f.vu} <b>Vulnerable</b>${all}.`);
  if (f.wk) o.push(`Apply ${f.wk} <b>Weak</b>${all}.`);
  if (f.ps) o.push(`Apply ${f.ps} <b>Poison</b>${all}.`);
  if (f.st) o.push(`Gain ${f.st} <b>Strength</b>.`);
  if (f.dx) o.push(`Gain ${f.dx} <b>Dexterity</b>.`);
  if (f.th) o.push(`Gain ${f.th} <b>Thorns</b>.`);
  if (f.hl) o.push(`Heal ${f.hl} HP.`);
  if (f.sd) o.push(`Lose ${f.sd} HP.`);
  if (f.e) o.push(`Gain ${f.e} ⚡.`);
  if (f.dr) o.push(`Draw ${f.dr} card${f.dr > 1 ? 's' : ''}.`);
  if (f.pStr) o.push(`Each turn: +${f.pStr} <b>Strength</b>.`);
  if (f.pBlk) o.push(`Each turn: gain ${f.pBlk} <b>Block</b>.`);
  if (f.pDraw) o.push(`Draw ${f.pDraw} more card each turn.`);
  if (f.pPs) o.push(`Your Attacks apply ${f.pPs} <b>Poison</b>.`);
  if (f.pEn) o.push(`Each turn: +${f.pEn} ⚡.`);
  if (f.pAoe) o.push(`End of turn: deal ${f.pAoe} to ALL foes.`);
  if (f.ex) o.push('<b>Exhaust</b>.');
  return o.join(' ');
}
function cardEl(c, cls = '') {
  const k = cd(c), d = document.createElement('div');
  d.className = `card ${k.t} r-${k.r}${k.up ? ' up' : ''} ${cls}`;
  d.innerHTML = `<div class="in"><div class="nm">${k.name}</div><div class="ic">${k.i}</div><div class="ty">${k.t === 'A' ? 'ATTACK' : k.t === 'S' ? 'SKILL' : 'POWER'}</div><div class="ds"><span>${desc(k)}</span></div></div><div class="cost">${k.cost}</div><div class="gem"></div>`;
  return d;
}

// ---------------------------------------------------------------- map
function genMap() {
  const nodes = {}, get = (r, c) => nodes[r * COLS + c] || (nodes[r * COLS + c] = { id: r * COLS + c, r, c, t: null, nx: [], jx: (rand() - 0.5) * 16, jy: (rand() - 0.5) * 12 });
  const starts = []; while (starts.length < 6) starts.push(starts.length < 2 ? [1, 5][starts.length] + ri(-1, 1) : ri(0, COLS - 1));
  const boss = get(ROWS - 1, 3); boss.jx = boss.jy = 0;
  for (const s of starts) { let c = s; for (let r = 0; r < ROWS - 2; r++) { const n = get(r, c), nc = Math.max(0, Math.min(COLS - 1, c + ri(-1, 1))); const m = get(r + 1, nc); if (!n.nx.includes(m.id)) n.nx.push(m.id); c = nc; } }
  for (const n of Object.values(nodes)) {
    if (n.r === ROWS - 2) n.nx = [boss.id];
    n.t = n.r === 0 ? 'F' : n.r === ROWS - 1 ? 'B' : n.r === ROWS - 2 ? 'R' : n.r === 7 ? 'T' : null;
    if (!n.t) { const w = [['F', 46], ['M', 22], ['E', n.r >= 4 ? 13 : 0], ['R', n.r >= 5 && n.r !== 12 ? 10 : 0], ['S', n.r >= 3 ? 9 : 0]]; let x = rand() * w.reduce((a, b) => a + b[1], 0); for (const [t, v] of w) { if ((x -= v) < 0) { n.t = t; break; } } n.t = n.t || 'F'; }
  }
  return nodes;
}
const ICON = { F: '⚔️', E: '👾', R: '🔥', S: '🛍️', M: '❓', T: '🎁' };
const avail = () => run.cur == null ? Object.values(run.map).filter(n => n.r === 0) : run.map[run.cur].nx.map(i => run.map[i]);
const mapWrap = mk('scr', '<div class="mapwrap"><div class="map"></div></div>');
function renderMap() {
  const mp = $('.map', mapWrap), W = Math.min(innerWidth - 20, 520), RH = innerHeight > 700 ? 76 : 66, H = ROWS * RH + 110;
  mp.style.height = H + 'px';
  const pos = n => [34 + n.c * (W - 68) / (COLS - 1) + n.jx, 70 + (ROWS - 1 - n.r) * RH + n.jy];
  const av = new Set(avail().map(n => n.id)), path = new Set(run.path);
  let lines = '';
  for (const n of Object.values(run.map)) for (const id of n.nx) { const [x1, y1] = pos(n), [x2, y2] = pos(run.map[id]), walked = path.has(n.id) && (path.has(id) || av.has(id) && n.id === run.cur);
    lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${walked ? '#e63973' : '#8a6d4c'}" stroke-width="${walked ? 4 : 2.5}" stroke-dasharray="${walked ? '0' : '2 7'}" stroke-linecap="round" opacity="${walked ? 0.9 : 0.6}"/>`; }
  mp.innerHTML = `<svg width="${W}" height="${H}">${lines}</svg><div class="maptitle">Act ${run.act} · ${ACTS[run.act].name}</div><div class="legend">⚔️ fight · 👾 elite · ❓ mystery · 🛍️ shop · 🔥 rest · 🎁 treasure</div>`;
  for (const n of Object.values(run.map)) {
    const [x, y] = pos(n), b = mk('node' + (n.t === 'B' ? ' boss' : '') + (path.has(n.id) ? ' done' : '') + (n.id === run.cur ? ' cur' : '') + (av.has(n.id) ? ' av' : ''), n.t === 'B' ? foeSVG(EN[ACTS[run.act].boss[0]]) : ICON[n.t], mp);
    b.style.left = x + 'px'; b.style.top = y + 'px'; b.dataset.id = n.id;
    if (av.has(n.id)) b.onclick = () => enterNode(n);
  }
  const wrap = $('.mapwrap', mapWrap), target = run.cur == null ? H : pos(run.map[run.cur])[1];
  requestAnimationFrame(() => { wrap.scrollTop = target - wrap.clientHeight * 0.65; });
}
function show(which) {
  scr = which; mapWrap.classList.toggle('on', which === 'map'); combatEl.classList.toggle('on', which === 'combat');
}
function showMap() {
  closeOv(); show('map'); showHud(true); paintHud(); renderMap(); save();
  botFn = () => { const ns = avail(), h = run.hp / run.maxHp;
    const sc = n => ({ R: h < 0.5 ? 12 : 1, E: h > 0.8 ? 7 : h > 0.6 ? 3 : 0, F: 5, M: 4, S: run.peb >= 90 ? 6 : 1, T: 9, B: 10 })[n.t] + Math.random();
    enterNode(ns.sort((a, b) => sc(b) - sc(a))[0]); };
}
function enterNode(n) {
  if (busy || state !== 'play') return;
  run.cur = n.id; run.row = n.r; run.path.push(n.id); sfx.tap(); paintHud();
  const A = ACTS[run.act];
  if (n.t === 'F') startCombat(run.fights < 3 ? pick(A.easy) : pick(A.normal), 'F');
  else if (n.t === 'E') startCombat(pick(A.elite), 'E');
  else if (n.t === 'B') startCombat(A.boss, 'B');
  else if (n.t === 'R') restSite();
  else if (n.t === 'S') shop();
  else if (n.t === 'T') treasure();
  else if (n.t === 'M') { if (rand() < 0.22) startCombat(pick(A.normal), 'F'); else mystery(); }
}
function nodeDone() {
  run.score++; if (run.score > best) { best = run.score; S.set('best', best); }
  if (!beatShown && D.beaten(run.score)) { beatShown = true; ui.pop('BEATEN!', '#fff', 40, 30); sparkle(innerWidth / 2, innerHeight * 0.3, 40); }
  showMap();
}
let beatShown = false;

// ---------------------------------------------------------------- run lifecycle
function newRun() {
  const seed = D.seed || (Date.now() % 1e9);
  run = { seed, rs: seed * 7 + 11, daily: !!D.seed, act: 1, row: -1, cur: null, path: [], hp: 72, maxHp: 72, peb: 99, relics: [], score: 0, ms: 0, fights: 0, removeCost: 75,
    deck: [...Array(5).fill('toss'), ...Array(4).fill('guard'), 'flash'].map(id => ({ id, up: 0 })) };
  run.relics.push(pick(['acorn', 'cushion', 'bell', 'honey', 'owl']));
  run.map = genMap(); beatShown = false;
  B.start(); t0 = performance.now();
  paintBg(); state = 'play'; showMap();
  banner(`Act 1`, ACTS[1].name);
}
let t0 = performance.now();
function save() { if (!run || state !== 'play') return; run.ms += performance.now() - t0; t0 = performance.now(); S.set(SAVEK, run); }
function endRun(won) {
  if (run.ended) return; run.ended = true;
  run.ms += performance.now() - t0; t0 = performance.now();
  S.set(SAVEK, null);
  F.level(won, run.score / (ROWS * 3));
  B.submit(run.score, { ms: run.ms });
  if (run.score > best) { best = run.score; S.set('best', best); }
  showHud(false); closeOv();
  if (won) { state = 'won'; D.won(run.score, 'cleared floors'); sfx.win(); ui.win('', `${run.score} floors · ${run.deck.length} cards · best ${best}`); }
  else { state = 'lost'; sfx.fail(); ui.lose('KNOCKED OUT', `Act ${run.act} · ${run.score} floors cleared · best ${best}`); }
}
function banner(big, small) { const b = mk('banner', `<b>${big}</b><span>${small}</span>`); setTimeout(() => b.remove(), 1900); }

// ---------------------------------------------------------------- combat DOM
const combatEl = mk('scr', `<div class="field"><div class="ent hero"><div class="art"></div><div class="hpw"><div class="bar"><i></i><b></b></div><div class="blk"></div></div><div class="sts"></div></div><div class="foes"></div></div>
  <div class="hint2"></div><div class="ctl"><div><div class="energy">3</div><div class="piles"></div></div><button class="endb">End turn</button></div><div class="hand"></div>`);
const heroEl = $('.hero', combatEl), foesEl = $('.foes', combatEl), handEl = $('.hand', combatEl), enEl = $('.energy', combatEl), pilesEl = $('.piles', combatEl), endBtn = $('.endb', combatEl), hint2 = $('.hint2', combatEl);
$('.art', heroEl).innerHTML = heroSVG();
endBtn.addEventListener('pointerdown', e => e.stopPropagation());
endBtn.onclick = () => endTurn();
const alive = () => C ? C.foes.filter(e => !e.dead) : [];

function startCombat(ids, kind) {
  closeOv(); show('combat'); showHud(true);
  if (kind !== 'B') run.fights++;
  const k = F.k();
  C = { foes: [], kind, boss: kind === 'B', turn: 0, draw: shuffle(run.deck.map((c, i) => ({ ...c, uid: i }))), hand: [], disc: [], exh: [], pTurn: false, sel: -1, played: 0, uid: 0 };
  P = { hp: run.hp, maxHp: run.maxHp, blk: 0, st: {}, en: 0, pw: {}, el: heroEl };
  if (has('acorn')) P.st.str = 1; if (has('collar')) P.st.th = 3; if (has('boots')) P.st.dex = 1; if (has('crown')) { P.st.str = g(P, 'str') + 2; P.st.dex = g(P, 'dex') + 2; }
  foesEl.innerHTML = '';
  ids.forEach(id => addFoe(id, k));
  if (has('moth')) C.foes.forEach(e => e.st.vu = 1);
  sizeFoes(); updAll();
  if (C.boss) banner(EN[ids[0]].n, 'BOSS'); else if (kind === 'E') banner('Elite!', EN[ids[0]].n);
  botFn = botCombat;
  playerTurn(true);
}
function addFoe(id, k = 1) {
  const d = EN[id], hp = Math.round(ri(d.hp[0], d.hp[1]) * k);
  const e = { id, def: d, hp, maxHp: hp, blk: 0, st: {}, dead: false, uid: ++C.uid, mi: d.boss || d.elite ? 0 : ri(0, d.moves.length - 1), last: -1 };
  if (d.th) e.st.th = d.th;
  e.intent = d.moves[e.mi];
  e.el = mk('ent foe', `<div class="intent"></div><div class="art">${foeSVG(d)}</div><div class="ename">${d.n}</div><div class="hpw"><div class="bar"><i></i><b></b></div><div class="blk"></div></div><div class="sts"></div>`, foesEl);
  $('.art', e.el).style.animationDelay = (-Math.random() * 2) + 's';
  e.el.addEventListener('pointerup', ev => { if (C && C.sel >= 0 && !e.dead) { ev.stopPropagation(); playCard(C.sel, e); } });
  C.foes.push(e); return e;
}
function sizeFoes() {
  const live = alive(), wide = innerWidth >= 820, avail = (Math.min(innerWidth, 980) - (wide ? 200 : Math.min(innerWidth * 0.36, 160)) - 20);
  const tot = live.reduce((a, e) => a + (e.def.size || 1), 0), unit = Math.min(wide ? 150 : 124, avail / Math.max(tot, 1.2));
  live.forEach(e => e.el.style.setProperty('--sz', Math.round(unit * (e.def.size || 1)) + 'px'));
}
function updEnt(e) {
  const el = e.el; $('.bar i', el).style.width = Math.max(0, e.hp / e.maxHp * 100) + '%'; $('.bar b', el).textContent = `${Math.max(0, e.hp)}/${e.maxHp}`;
  const bk = $('.blk', el); if (e.blk > 0) { if (bk.textContent !== String(e.blk)) { bk.classList.remove('on'); void bk.offsetWidth; } bk.textContent = e.blk; bk.classList.add('on'); } else bk.classList.remove('on');
  $('.sts', el).innerHTML = Object.entries(e.st).filter(([k, v]) => v > 0 && STK[k]).map(([k, v]) => `<span title="${STK[k][1]}">${STK[k][0]}${v}</span>`).join('');
  if (e !== P && !e.dead) { const m = e.intent, it = $('.intent', el); let s = '';
    if (m.a) s += `⚔️ ${dmgCalc(e, P, m.a)}${m.h > 1 ? '×' + m.h : ''}`;
    if (m.b) s += (s ? ' ' : '') + '🛡️'; if (m.s) s += (s ? ' ' : '') + '💪'; if (m.wk || m.vu || m.ps) s += (s ? ' ' : '') + '🌀'; if (m.sum) s += '✨'; if (m.hl) s += '💚';
    it.textContent = s; it.classList.toggle('atk', !!m.a); }
}
function updAll() {
  if (!C) return; updEnt(P); C.foes.forEach(e => !e.dead && updEnt(e));
  enEl.textContent = `${P.en}/${baseEnergy()}`; enEl.classList.toggle('zero', P.en <= 0);
  pilesEl.innerHTML = `🂠 ${C.draw.length} · ♻️ ${C.disc.length}`;
  endBtn.classList.toggle('off', !C.pTurn || busy);
  endBtn.classList.toggle('glow', C.pTurn && !busy && !C.hand.some(c => cd(c).cost <= P.en));
  paintHud();
}
const baseEnergy = () => 3 + (has('sunstone') ? 1 : 0) + (P.pw.pEn || 0);

// hand: fanned cards; tap to select (enlarged), tap again or tap a foe to play; drag up to play
function renderHand(fresh = []) {
  if (!C) return;
  handEl.innerHTML = '';
  const n = C.hand.length, W = handEl.clientWidth || innerWidth, cw = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cw')) || 86;
  const step = n > 1 ? Math.min(cw + 6, (W - 40 - cw) / (n - 1)) : 0, x0 = (W - (cw + step * (n - 1))) / 2;
  C.hand.forEach((c, i) => {
    const k = cd(c), el = cardEl(c, (k.cost > P.en || !C.pTurn ? 'cant' : '') + (fresh.includes(c) ? ' drawn' : '')), mid = i - (n - 1) / 2;
    el.style.left = (i === C.sel ? Math.max(cw * 0.21 + 4, Math.min(W - cw * 1.21 - 4, x0 + i * step)) : x0 + i * step) + 'px'; el.style.zIndex = 10 + i; el.style.animationDelay = (fresh.indexOf(c) * 0.06) + 's';
    const base = `rotate(${mid * 3.5}deg) translateY(${Math.abs(mid) * Math.abs(mid) * 2.2}px)`;
    el.dataset.base = base; el.style.transform = i === C.sel ? `translateY(-${cw * 0.55}px) scale(1.42)` : base;
    if (i === C.sel) el.classList.add('sel');
    let sx = 0, sy = 0, drag = false;
    el.addEventListener('pointerdown', ev => { ev.stopPropagation(); sx = ev.clientX; sy = ev.clientY; drag = true; try { el.setPointerCapture(ev.pointerId); } catch (e) {} });
    el.addEventListener('pointermove', ev => { if (!drag) return; const dy = ev.clientY - sy, dx = ev.clientX - sx; if (dy < -14) el.style.transform = `translate(${dx}px,${dy}px) scale(1.2)`; });
    el.addEventListener('pointerup', ev => {
      if (!drag) return; drag = false; ev.stopPropagation(); const dy = ev.clientY - sy;
      if (dy < -70) { // dragged up: play on the foe under the finger (or the only/first foe)
        const under = document.elementsFromPoint(ev.clientX, ev.clientY).map(x => x.closest && x.closest('.foe')).find(Boolean);
        const tgt = alive().find(f => f.el === under) || null;
        if (needsT(k.f) && !tgt && alive().length > 1) { C.sel = i; renderHand(); hint('Tap a monster to aim'); return; }
        playCard(i, tgt);
      } else if (C.sel === i) { if (needsT(k.f) && alive().length > 1) hint('Tap a monster to aim'); else playCard(i, null); }
      else { C.sel = i; sfx.tap(); renderHand(); hint(k.cost > P.en ? 'Not enough energy' : needsT(k.f) && alive().length > 1 ? 'Tap a monster to aim · or drag the card' : 'Tap again to play'); }
    });
    handEl.appendChild(el);
  });
  C.foes.forEach(e => e.el.classList.toggle('target', C.sel >= 0 && !e.dead && needsT(cd(C.hand[C.sel] || { id: 'toss' }).f)));
}
function hint(t) { hint2.textContent = t; clearTimeout(hint.t); hint.t = setTimeout(() => hint2.textContent = '', 1800); }
combatEl.addEventListener('pointerup', ev => { if (C && C.sel >= 0 && !ev.target.closest('.card') && !ev.target.closest('.foe')) { C.sel = -1; renderHand(); } });

// ---------------------------------------------------------------- effects / juice
function center(el) { const r = (el.querySelector('.art') || el).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height * 0.4]; }
function num(el, text, color = '#fff', size = 30) { const [x, y] = center(el), d = mk('num', text); d.style.left = x + (Math.random() - 0.5) * 30 + 'px'; d.style.top = y - 10 + 'px'; d.style.color = color; d.style.fontSize = size + 'px'; setTimeout(() => d.remove(), 820); }
function sparkle(x, y, n = 18, cols = ['#ffd166', '#ff5d8f', '#7fffd4', '#fff', '#b79cff']) {
  for (let i = 0; i < n; i++) { const s = mk('spk'), a = Math.random() * 6.28, r = 40 + Math.random() * 90; s.style.left = x + 'px'; s.style.top = y + 'px'; s.style.background = cols[i % cols.length];
    s.style.setProperty('--dx', Math.cos(a) * r + 'px'); s.style.setProperty('--dy', Math.sin(a) * r - 30 + 'px'); if (i % 3 === 0) s.style.borderRadius = '50%'; setTimeout(() => s.remove(), 720); }
}
function shake() { combatEl.classList.remove('shake'); void combatEl.offsetWidth; combatEl.classList.add('shake'); }
function hitAnim(e) { e.el.classList.remove('hit'); void e.el.offsetWidth; e.el.classList.add('hit'); }
function applyDmg(t, v, src = null) {
  const ab = Math.min(t.blk, v); t.blk -= ab; const loss = v - ab; t.hp -= loss;
  hitAnim(t);
  if (loss > 0) num(t.el, '-' + loss, t === P ? '#ff8fa3' : '#fff', 26 + Math.min(20, loss)); else num(t.el, '🛡️' + ab, '#9be7ff', 24);
  if (t === P) { if (loss > 0) { shake(); buzz(loss > 10 ? 60 : 25); if (loss >= 12) ui.flash(0.35); } tone(150, 0.12, 'square', 0.08, 0.6); }
  else { tone(loss > 12 ? 120 : 200, 0.1, 'square', 0.09, 0.5); if (loss >= 15) { shake(); sfx.smash(); } }
  if (src && t.st.th && src !== t && v > 0) { const th = t.st.th; src.hp -= th; hitAnim(src); num(src.el, '🌵-' + th, '#c7f9cc', 22); }
  return loss;
}
function loseHp(t, v, icon = '') { t.hp -= v; hitAnim(t); num(t.el, icon + '-' + v, t === P ? '#ff8fa3' : '#d0ffb0', 24); if (t === P) shake(); }
function gainBlk(t, v) { if (v <= 0) return; t.blk += v; num(t.el, '+' + v + '🛡️', '#9be7ff', 22); tone(660, 0.08, 'triangle', 0.1, 1.3); }
function addSt(t, k, v) { t.st[k] = g(t, k) + v; }
function checkDeaths() {
  for (const e of C.foes) {
    if (e.dead) continue;
    if (e.hp <= 0) { e.dead = true; e.el.classList.add('ko'); const [x, y] = center(e.el); sparkle(x, y, 22); [72, 76, 79, 84].forEach((m, i) => setTimeout(() => note(m, 0.25, 0.1), i * 50)); setTimeout(() => { e.el.style.display = 'none'; sizeFoes(); }, 480); }
    else if (e.def.half && !e.halfDone && e.hp <= e.maxHp / 2) { e.halfDone = true; banner('Splits!', e.def.n); e.def.half.forEach(id => { if (alive().length < 4) { const s = addFoe(id); updEnt(s); } }); sizeFoes(); }
  }
}

// ---------------------------------------------------------------- turns
function drawCards(n) {
  const got = [];
  for (let i = 0; i < n && C.hand.length < 10; i++) { if (!C.draw.length) { if (!C.disc.length) break; C.draw = shuffle(C.disc); C.disc = []; } got.push(C.draw.pop()); }
  C.hand.push(...got); if (got.length) tone(880, 0.05, 'sine', 0.05, 1.2); return got;
}
async function playerTurn(first = false) {
  C.turn++; C.played = 0; C.firstAtk = true; C.sel = -1;
  P.blk = has('shell') ? Math.min(P.blk, 6) : 0;
  if (first && has('cushion')) gainBlk(P, 8);
  if (g(P, 'ps')) { loseHp(P, P.st.ps, '🧪'); P.st.ps--; if (P.hp <= 0) return defeat(); }
  if (P.pw.pStr) addSt(P, 'str', P.pw.pStr);
  if (P.pw.pBlk) gainBlk(P, P.pw.pBlk);
  P.en = baseEnergy() + (first && has('owl') ? 1 : 0) + (C.turn === 3 && has('hourglass') ? 2 : 0);
  const got = drawCards(5 + (P.pw.pDraw || 0) + (has('backpack') ? 1 : 0) + (first && has('bell') ? 2 : 0));
  C.pTurn = true; busy = false; updAll(); renderHand(got);
  if (C.turn === 1 && !S.get('tut', 0)) { hint('Tap a card, then tap again to play it'); S.set('tut', 1); }
}
async function playCard(i, tgt) {
  if (busy || !C || !C.pTurn) return false;
  const c = C.hand[i]; if (!c) return false; const k = cd(c), f = k.f;
  if (k.cost > P.en) { hint('Not enough energy'); tone(160, 0.1, 'square', 0.06, 0.8); return false; }
  if (needsT(f) && (!tgt || tgt.dead)) { const l = alive(); if (l.length === 1) tgt = l[0]; else if (!tgt) { C.sel = i; renderHand(); return false; } }
  busy = true; P.en -= k.cost; C.sel = -1;
  // fly the card toward its target
  const src = handEl.children[i];
  if (src) { const r = src.getBoundingClientRect(), fl = cardEl(c, 'fly'); fl.style.left = r.left + 'px'; fl.style.top = r.top + 'px'; fl.style.bottom = 'auto'; document.body.appendChild(fl);
    const [tx, ty] = center(f.all || !tgt ? (k.t === 'A' ? foesEl : heroEl) : tgt.el); requestAnimationFrame(() => { fl.style.transform = `translate(${tx - r.left - r.width / 2}px,${ty - r.top - r.height / 2}px) scale(.35) rotate(${k.t === 'A' ? 25 : -10}deg)`; fl.style.opacity = '0.2'; }); setTimeout(() => fl.remove(), 260); }
  C.hand.splice(i, 1); renderHand(); updAll();
  if (k.t === 'A') { tone(300, 0.08, 'sawtooth', 0.07, 1.6); heroEl.classList.add('lunge'); setTimeout(() => heroEl.classList.remove('lunge'), 160); }
  else if (k.t === 'S') { note(72, 0.2, 0.1); note(79, 0.25, 0.07); } else { [67, 71, 74, 79].forEach((m, j) => setTimeout(() => note(m, 0.3, 0.1), j * 70)); }
  await sleep(170);
  await resolve(k, tgt);
  if (k.t === 'P' || f.ex) C.exh.push(c); else C.disc.push(c);
  if (k.t === 'P' && has('whistle')) gainBlk(P, 5);
  C.played++; if (has('quill') && C.played % 4 === 0) drawCards(1);
  checkDeaths(); if (P.hp <= 0) return defeat();
  busy = false; updAll(); renderHand();
  if (!alive().length) await victory();
  return true;
}
async function resolve(k, tgt) {
  const f = k.f, targets = () => f.all ? alive() : (tgt && !tgt.dead ? [tgt] : []);
  if (f.sp === 'clrblk' && tgt) { if (tgt.blk) num(tgt.el, 'Shattered!', '#9be7ff', 22); tgt.blk = 0; }
  if (f.d != null || f.sp === 'blkdmg') {
    const base = f.sp === 'blkdmg' ? P.blk : f.d + (f.sp === 'missing' ? Math.floor((P.maxHp - P.hp) / 3) : 0);
    for (let h = 0; h < (f.x || 1); h++) { for (const t of targets()) applyDmg(t, dmgCalc(P, t, base), P); updAll(); checkDeaths(); if (P.hp <= 0) return; if ((f.x || 1) > 1) await sleep(110); }
    let ps = P.pw.pPs || 0; if (C.firstAtk && has('nettle')) ps += 2; C.firstAtk = false;
    if (ps) for (const t of targets()) addSt(t, 'ps', ps);
  }
  if (f.b) gainBlk(P, f.b + g(P, 'dex'));
  if (f.sp === 'blkatk' && alive().some(e => e.intent.a)) gainBlk(P, f.b2 + g(P, 'dex'));
  if (f.sp === 'dblblk') gainBlk(P, P.blk);
  if (f.sp === 'dblps' && tgt) { tgt.st.ps = g(tgt, 'ps') * 2; num(tgt.el, '🧪×2', '#d0ffb0', 24); }
  for (const s of ['vu', 'wk', 'ps']) if (f[s]) for (const t of targets()) { addSt(t, s, f[s]); num(t.el, STK[s][0] + f[s], '#fff', 22); }
  if (f.st) addSt(P, 'str', f.st); if (f.dx) addSt(P, 'dex', f.dx); if (f.th) addSt(P, 'th', f.th);
  if (f.hl) { P.hp = Math.min(P.maxHp, P.hp + f.hl); num(heroEl, '+' + f.hl, '#b9fbc0', 26); note(84, 0.3, 0.08); }
  if (f.sd) loseHp(P, f.sd);
  if (f.e) P.en += f.e;
  if (f.dr) renderHand(drawCards(f.dr));
  for (const p of ['pStr', 'pBlk', 'pDraw', 'pPs', 'pEn', 'pAoe']) if (f[p]) P.pw[p] = (P.pw[p] || 0) + f[p];
  if (k.t === 'P') { const [x, y] = center(heroEl); sparkle(x, y, 14, ['#b79cff', '#fff', '#ffd166']); }
  updAll();
}
async function endTurn() {
  if (!C || !C.pTurn || busy) return;
  busy = true; C.pTurn = false; C.sel = -1;
  C.disc.push(...C.hand); C.hand = []; renderHand(); updAll(); sfx.tap();
  if (P.pw.pAoe) { for (const e of alive()) applyDmg(e, P.pw.pAoe); checkDeaths(); }
  for (const s of ['vu', 'wk']) if (g(P, s)) P.st[s]--;
  updAll();
  if (!alive().length) return victory();
  await sleep(300);
  for (const e of alive()) {
    if (!C) return;
    e.blk = 0;
    if (g(e, 'ps')) { loseHp(e, e.st.ps, '🧪'); e.st.ps--; checkDeaths(); updAll(); if (e.dead) { await sleep(250); continue; } }
    await doMove(e);
    if (P.hp <= 0) return defeat();
    for (const s of ['vu', 'wk']) if (g(e, s)) e.st[s]--;
    checkDeaths(); updAll();
    await sleep(260);
  }
  if (!alive().length) return victory();
  for (const e of alive()) nextIntent(e);
  playerTurn();
}
async function doMove(e) {
  const m = e.intent;
  e.el.classList.add('lunge'); setTimeout(() => e.el.classList.remove('lunge'), 180);
  if (m.a) for (let h = 0; h < (m.h || 1); h++) { applyDmg(P, dmgCalc(e, P, m.a), e); updAll(); checkDeaths(); if (P.hp <= 0 || e.dead) return; await sleep(m.h > 1 ? 150 : 120); }
  if (m.b) { gainBlk(e, m.b); }
  if (m.s) { addSt(e, 'str', m.s); num(e.el, '💪+' + m.s, '#ffd166', 22); tone(220, 0.2, 'sawtooth', 0.06, 1.5); }
  for (const s of ['wk', 'vu', 'ps']) if (m[s]) { addSt(P, s, m[s]); num(heroEl, STK[s][0] + m[s], '#fff', 22); }
  if (m.hl) { e.hp = Math.min(e.maxHp, e.hp + m.hl); num(e.el, '+' + m.hl, '#b9fbc0', 26); }
  if (m.sum) { for (const id of m.sum) if (alive().length < 4) { const s = addFoe(id); updEnt(s); } sizeFoes(); sparkle(...center(foesEl), 12); }
  updAll();
}
function nextIntent(e) {
  const ms = e.def.moves;
  if (e.def.ai === 'cycle') e.mi = (e.mi + 1) % ms.length;
  else { let i; do { i = ri(0, ms.length - 1); } while (ms.length > 1 && i === e.mi && i === e.last); e.last = e.mi; e.mi = i; }
  e.intent = ms[e.mi]; updEnt(e);
}
async function victory() {
  if (!C || C.won) return; C.won = true; busy = true; C.pTurn = false;
  await sleep(550);
  run.hp = Math.max(1, P.hp); if (has('honey')) run.hp = Math.min(run.maxHp, run.hp + 5);
  const kind = C.kind; C = null; P = null; busy = false; handEl.innerHTML = '';
  rewards(kind);
}
function defeat() {
  if (!C) return; busy = true; C.pTurn = false; heroEl.classList.add('ko'); run.hp = 0; P.hp = 0; updAll();
  setTimeout(() => { heroEl.classList.remove('ko'); C = null; P = null; busy = false; endRun(false); }, 900);
}

// ---------------------------------------------------------------- overlays: rewards, shop, rest, events, deck
function ov(html, bot, keep = false) { if (!keep) closeOv(); const o = mk('ov', html); o.addEventListener('pointerdown', e => e.stopPropagation()); botFn = bot; return o; }
function closeOv() { document.querySelectorAll('.ov').forEach(o => o.remove()); }
function rollCard(kind) {
  const x = rand(), r = kind === 'B' ? 'r' : kind === 'E' ? (x < 0.12 ? 'r' : x < 0.55 ? 'u' : 'c') : (x < 0.05 ? 'r' : x < 0.36 ? 'u' : 'c');
  const pool = Object.values(CARDS).filter(c => c.r === r);
  return { id: pick(pool).id, up: rand() < [0, 0, 0.12, 0.28][run.act] ? 1 : 0 };
}
function cardChoices(kind, n) { const out = []; let guard = 0; while (out.length < n && guard++ < 50) { const c = rollCard(kind); if (!out.some(o => o.id === c.id)) out.push(c); } return out; }
const relicPool = boss => Object.keys(REL).filter(id => !!REL[id].boss === !!boss && !run.relics.includes(id));
function gainRelic(id) {
  run.relics.push(id); const R = REL[id]; sfx.coin();
  if (id === 'kettle') { run.maxHp += 12; run.hp += 12; }
  if (id === 'bough') { run.maxHp += 10; run.hp = run.maxHp; }
  if (id === 'anvil') shuffle(run.deck.filter(c => !c.up)).slice(0, 4).forEach(c => c.up = 1);
  paintHud(); tip(`${R.i} <b>${R.n}</b> · ${R.d}`);
}
function rewards(kind) {
  let peb = kind === 'B' ? ri(70, 85) : kind === 'E' ? ri(28, 36) : ri(11, 19); if (has('lucky')) peb = Math.round(peb * 1.3);
  run.peb += peb; sfx.coin();
  let relic = null; if (kind === 'E') { const p = relicPool(false); if (p.length) { relic = pick(p); gainRelic(relic); } }
  const choices = cardChoices(kind, has('compass') ? 4 : 3);
  const o = ov(`<h2>${kind === 'B' ? 'Boss defeated!' : kind === 'E' ? 'Elite beaten!' : 'Victory!'}</h2><p>+${peb} 🪨 pebbles${relic ? ` · ${REL[relic].i} ${REL[relic].n}` : ''}</p><p style="opacity:.8">Add a card to your deck</p><div class="row" data-c></div><button class="hc-btn ghost" data-skip>Skip</button>`, () => {
    const order = { r: 0, u: 1, c: 2, s: 3 }; let bi = 0; choices.forEach((c, i) => { if (order[CARDS[c.id].r] < order[CARDS[choices[bi].id].r]) bi = i; }); take(bi); });
  const row = $('[data-c]', o);
  const after = () => { paintHud(); if (kind === 'B') bossRelic(); else nodeDone(); };
  const take = i => { const c = choices[i]; run.deck.push({ id: c.id, up: c.up }); note(76, 0.2, 0.1); note(83, 0.3, 0.08); after(); };
  choices.forEach((c, i) => { const el = cardEl(c, 'static'); el.onclick = () => take(i); row.appendChild(el); });
  $('[data-skip]', o).onclick = after;
}
function bossRelic() {
  const opts = shuffle(relicPool(true)).slice(0, 3);
  if (!opts.length || run.act === 3) return nextAct();
  const o = ov(`<h2>Boss treasure</h2><p>Pick one relic</p><div class="row" data-r></div>`, () => takeR(0));
  const takeR = i => { gainRelic(opts[i]); nextAct(); };
  opts.forEach((id, i) => { const b = mk('relbig', `<div>${REL[id].i}</div>${REL[id].n}<small style="display:block;font-weight:600;font-size:11px;opacity:.7;margin-top:3px">${REL[id].d}</small>`, $('[data-r]', o), 'button'); b.style.width = '104px'; b.style.border = '0'; b.style.font = 'inherit'; b.onclick = () => takeR(i); });
}
function nextAct() {
  run.score++; if (run.score > best) { best = run.score; S.set('best', best); }
  if (run.act >= 3) return endRun(true);
  run.act++; run.row = -1; run.cur = null; run.path = []; run.fights = 0; run.map = genMap();
  run.hp = Math.min(run.maxHp, run.hp + Math.round((run.maxHp - run.hp) * 0.75));
  paintBg(); showMap(); banner(`Act ${run.act}`, ACTS[run.act].name);
}
function restSite() {
  const heal = Math.round(run.maxHp * (has('starmap') ? 0.5 : 0.3)), up = run.deck.filter(c => !c.up);
  const o = ov(`<div class="big">🔥</div><h2>Campfire</h2><p>Tumble warms paws by the fire.</p><button class="opt" data-a>😴 Rest<small>Heal ${heal} HP</small></button><button class="opt ${up.length ? '' : 'off'}" data-b>🔨 Sharpen<small>Upgrade a card</small></button>`,
    () => { if (run.hp / run.maxHp < 0.65 || !up.length) $('[data-a]', o).click(); else $('[data-b]', o).click(); });
  $('[data-a]', o).onclick = () => { run.hp = Math.min(run.maxHp, run.hp + heal); note(72, 0.4, 0.1); note(79, 0.5, 0.08); nodeDone(); };
  $('[data-b]', o).onclick = () => deckPick('Upgrade a card', c => !c.up, c => { c.up = 1; sfx.win(); nodeDone(); }, () => restSite(), true);
}
function treasure() {
  const p = relicPool(false), id = p.length ? pick(p) : null, peb = ri(25, 45);
  const o = ov(`<div class="big">🎁</div><h2>Treasure!</h2><p>${id ? `${REL[id].i} <b>${REL[id].n}</b><br><small>${REL[id].d}</small>` : ''}<br>+${peb} 🪨</p><button class="hc-btn" data-a>Take it</button>`, () => $('[data-a]', o).click());
  $('[data-a]', o).onclick = () => { if (id) gainRelic(id); run.peb += peb; nodeDone(); };
}
function shop() {
  const items = cardChoices('F', 3).concat(cardChoices('E', 2)).map(c => ({ c, price: { c: 48, u: 74, r: 145, s: 40 }[CARDS[c.id].r] + ri(-6, 8) + (c.up ? 20 : 0) }));
  const rels = shuffle(relicPool(false)).slice(0, 2).map(id => ({ id, price: ri(140, 190) }));
  let removed = false;
  const o = ov(`<h2>🛍️ Mole's Shop</h2><p>“Pebbles only, friend.” You have <b data-pb>${run.peb}</b> 🪨</p><div class="grid" data-c></div><div class="row" data-r></div><button class="opt" data-rm>✂️ Remove a card<small data-rmc>${run.removeCost} 🪨</small></button><button class="hc-btn" data-x>Leave</button>`,
    () => { const it = items.find(x => !x.sold && x.price <= run.peb); if (it && run.deck.length < 22) it.el.click(); else $('[data-x]', o).click(); });
  const refresh = () => { $('[data-pb]', o).textContent = run.peb; items.concat(rels).forEach(x => x.el.classList.toggle('poor', x.price > run.peb)); $('[data-rm]', o).classList.toggle('off', removed || run.removeCost > run.peb); paintHud(); };
  items.forEach(x => { x.el = mk('shopi', '', $('[data-c]', o)); x.el.appendChild(cardEl(x.c, 'static')); mk('price', `${x.price} 🪨`, x.el, 'span');
    x.el.onclick = () => { if (x.price > run.peb) return tone(160, 0.1, 'square', 0.06); run.peb -= x.price; x.sold = 1; x.el.classList.add('sold'); run.deck.push({ id: x.c.id, up: x.c.up }); sfx.coin(); refresh(); }; });
  rels.forEach(x => { x.el = mk('shopi', `<div class="relbig"><div>${REL[x.id].i}</div>${REL[x.id].n}</div><span class="price">${x.price} 🪨</span>`, $('[data-r]', o));
    x.el.onclick = () => { if (x.price > run.peb) return tip(`<b>${REL[x.id].n}</b> · ${REL[x.id].d}`); run.peb -= x.price; x.sold = 1; x.el.classList.add('sold'); gainRelic(x.id); refresh(); }; });
  $('[data-rm]', o).onclick = () => { const cost = run.removeCost; o.style.display = 'none'; deckPick('Remove a card', () => true, c => { run.deck.splice(run.deck.indexOf(c), 1); run.peb -= cost; run.removeCost += 25; removed = true; o.style.display = ''; refresh(); }, () => { o.style.display = ''; }, false); };
  $('[data-x]', o).onclick = () => nodeDone();
  refresh();
}
const EVENTS = [
  { icon: '⛲', t: 'Wishing Pond', p: 'Coins glitter under the water. A frog winks at you.', o: [
    ['Toss 30 pebbles', 'Gain a random relic', () => run.peb >= 30, () => { run.peb -= 30; const p = relicPool(false); if (p.length) gainRelic(pick(p)); }],
    ['Wave and walk on', '', () => true, () => {}]] },
  { icon: '🗿', t: 'Mossy Shrine', p: 'An old cairn hums softly. It asks for a little effort.', o: [
    ['Climb it', 'Lose 7 HP, upgrade 2 random cards', () => run.hp > 8, () => { run.hp -= 7; shuffle(run.deck.filter(c => !c.up)).slice(0, 2).forEach(c => c.up = 1); }],
    ['Leave', '', () => true, () => {}]] },
  { icon: '🎒', t: 'Lost Peddler', p: 'A sleepy raccoon has too much in his cart.', o: [
    ['Take a free card', 'A random uncommon card', () => true, () => { const pool = Object.values(CARDS).filter(c => c.r === 'u'); run.deck.push({ id: pick(pool).id, up: 0 }); }],
    ['Lighten your pack', 'Remove a Pebble Toss', () => run.deck.some(c => c.id === 'toss'), () => { run.deck.splice(run.deck.findIndex(c => c.id === 'toss'), 1); }]] },
  { icon: '♨️', t: 'Hot Spring', p: 'Steam curls over a warm mountain pool.', o: [
    ['Soak', () => `Heal ${Math.round(run.maxHp * 0.25)} HP`, () => true, () => { run.hp = Math.min(run.maxHp, run.hp + Math.round(run.maxHp * 0.25)); }],
    ['Fill your flask', '+6 max HP', () => true, () => { run.maxHp += 6; run.hp += 6; }]] },
  { icon: '🪺', t: 'Bird Nest', p: 'Something shiny sits in a nest on a cliff ledge.', o: [
    ['Reach for it', '+45 pebbles, lose 5 HP', () => run.hp > 6, () => { run.peb += 45; run.hp -= 5; }],
    ['Leave the birds be', 'Heal 5 HP', () => true, () => { run.hp = Math.min(run.maxHp, run.hp + 5); }]] },
  { icon: '🍄', t: 'Giggling Mushrooms', p: 'A ring of mushrooms giggles. One offers a riddle.', o: [
    ['Answer the riddle', 'Upgrade a card of your choice', () => run.deck.some(c => !c.up), 'up'],
    ['Eat a cap', 'Gain 1 random rare card, lose 4 HP', () => run.hp > 5, () => { const pool = Object.values(CARDS).filter(c => c.r === 'r'); run.deck.push({ id: pick(pool).id, up: 0 }); run.hp -= 4; }]] },
];
function mystery() {
  const ev = pick(EVENTS);
  const o = ov(`<div class="big">${ev.icon}</div><h2>${ev.t}</h2><p>${ev.p}</p><div class="row" data-o style="flex-direction:column;align-items:center"></div>`, () => {
    const bs = [...o.querySelectorAll('.opt:not(.off)')]; (bs.length > 1 && run.hp / run.maxHp > 0.5 ? bs[0] : bs[bs.length - 1]).click(); });
  ev.o.forEach(([t, sub, ok, fn]) => { const b = mk('opt' + (ok() ? '' : ' off'), `${t}${sub ? `<small>${typeof sub === 'function' ? sub() : sub}</small>` : ''}`, $('[data-o]', o), 'button');
    b.onclick = () => { if (fn === 'up') return deckPick('Upgrade a card', c => !c.up, c => { c.up = 1; sfx.win(); nodeDone(); }, null, true); fn(); sfx.coin(); nodeDone(); }; });
}
function deckPick(title, filter, onPick, onCancel, preview) {
  const list = run.deck.filter(filter), prevBot = botFn;
  const o = ov(`<h2>${title}</h2><div class="grid" data-g></div>${onCancel ? '<button class="hc-btn ghost" data-x>Back</button>' : ''}`, () => {
    const pr = { r: 0, u: 1, c: 2, s: 3 }; const best = [...list].sort((a, b) => (CARDS[a.id].t === 'A' ? 0 : 1) - (CARDS[b.id].t === 'A' ? 0 : 1) || pr[CARDS[a.id].r] - pr[CARDS[b.id].r])[0];
    const worst = list.find(c => c.id === 'toss') || list.find(c => c.id === 'guard') || list[0];
    choose(title.startsWith('Remove') ? worst : best); }, true);
  const choose = c => { o.remove(); botFn = prevBot; onPick(c); };
  list.forEach(c => { const el = cardEl(preview ? { id: c.id, up: 1 } : c, 'static'); el.onclick = () => choose(c); $('[data-g]', o).appendChild(el); });
  if (onCancel) $('[data-x]', o).onclick = () => { o.remove(); botFn = prevBot; onCancel(); };
}
function deckView() {
  const prevBot = botFn;
  const o = ov(`<h2>Your deck · ${run.deck.length}</h2><div class="grid" data-g></div><button class="hc-btn" data-x>Close</button>`, () => $('[data-x]', o).click(), true);
  [...run.deck].sort((a, b) => a.id < b.id ? -1 : 1).forEach(c => $('[data-g]', o).appendChild(cardEl(c, 'static')));
  $('[data-x]', o).onclick = () => { o.remove(); botFn = prevBot; };
}

// ---------------------------------------------------------------- bot (QA): plays a sensible strategy, one action per call
function botCombat() {
  if (!C || !C.pTurn || busy) return;
  const foes = alive(); if (!foes.length) return;
  const inc = foes.reduce((s, e) => s + (e.intent.a ? dmgCalc(e, P, e.intent.a) * (e.intent.h || 1) : 0), 0);
  const hand = C.hand.map((c, i) => ({ i, k: cd(c) })).filter(o => o.k.cost <= P.en && !(o.k.f.sd && P.hp <= o.k.f.sd + 4) && !(o.k.f.sp === 'blkdmg' && P.blk < 6) && !(o.k.f.sp === 'dblblk' && P.blk < 6));
  if (!hand.length) return endTurn();
  const low = [...foes].sort((a, b) => a.hp - b.hp)[0];
  const first = hand.find(o => o.k.t === 'P') || hand.find(o => (o.k.f.dr || o.k.f.e) && !o.k.f.d && o.k.cost <= 1);
  if (first) return playCard(first.i, low);
  if (inc - P.blk > 5) { const bl = hand.filter(o => o.k.f.b).sort((a, b) => b.k.f.b - a.k.f.b)[0]; if (bl) return playCard(bl.i, low); }
  const atk = hand.filter(o => o.k.f.d != null || o.k.f.sp === 'blkdmg').sort((a, b) => ((b.k.f.d || 0) * (b.k.f.x || 1) - (a.k.f.d || 0) * (a.k.f.x || 1)));
  if (atk.length) return playCard(atk[0].i, low);
  const rest = hand.find(o => !o.k.f.d); if (rest) return playCard(rest.i, low);
  endTurn();
}
window.__game = {
  get state() { return state; }, get level() { return run ? run.act : 1; }, get score() { return run ? run.score : 0; },
  bot() { if (state !== 'play' || busy) return; if (botFn) botFn(); },
};

// ---------------------------------------------------------------- start card
{
  const st = ui.els.start, h1 = st.querySelector('h1');
  const box = document.createElement('div'); box.className = 'cc-start';
  const saved = S.get(SAVEK, null);
  box.innerHTML = `<p class="cc-tag">Deckbuilder roguelike · 64 cards · 3 acts</p><div class="heroart">${heroSVG()}</div>
    <div class="cc-btns">${saved ? '<button class="hc-btn" data-new style="background:#8e6cd8">New climb</button>' : ''}${D.isDaily ? '' : '<button class="hc-btn" data-day>☀️ Daily climb</button>'}</div>
    ${best ? `<p class="cc-tag">Best: ${best} floors</p>` : ''}`;
  (st.querySelector('p') || h1).after(box);
  box.querySelectorAll('button').forEach(b => b.addEventListener('pointerdown', e => e.stopPropagation()));
  const nb = box.querySelector('[data-new]'); if (nb) nb.onclick = e => { e.stopPropagation(); S.set(SAVEK, null); st.classList.add('hc-hidden'); newRun(); };
  const db = box.querySelector('[data-day]'); if (db) db.onclick = e => { e.stopPropagation(); const u = new URL(location.href); u.searchParams.set('daily', '1'); location.href = u.href; };
  st.querySelector('.hint').innerHTML = saved ? `Tap to continue · Act ${saved.act}, floor ${saved.score}` : 'Tap to start climbing';
  ui.els.win.querySelector('p').innerHTML = 'THE SUMMIT<span data-l hidden></span>'; ui.els.win.querySelector('h1').textContent = 'CONQUERED!';
  ui.els.lose.querySelector('.hint').textContent = 'Tap to climb again';
}
ui.onTap(which => {
  if (which === 'start') { const saved = S.get(SAVEK, null); if (saved && saved.map) { run = saved; state = 'play'; t0 = performance.now(); B.start(); paintBg(); showMap(); } else newRun(); }
  else newRun();
});
paintBg();
