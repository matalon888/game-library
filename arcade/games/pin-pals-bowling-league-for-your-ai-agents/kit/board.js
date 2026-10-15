// Board — world leaderboards with country flags for the "Connect your AI" games (shared across riffcade.com).
//   • every game has its own board (its own score), plus the shared AGENT POINTS board: what your agents actually
//     shipped today (successful steps, passed tests ×5, commits ×5, deploys ×10, minus failures), not raw tokens
//   • tabs: Today / This week / All time / Countries (a country's score is the sum of its players)
//   • one profile for all games: a nickname and a country flag (guessed from the browser, changeable)
//   • only the nickname, flag, scores and counts are sent; never project names, prompts or code; demo runs never submit
//
// Usage:
//   import { board } from '../kit/board.js';
//   const B = board({ game: 'agent-football', label: 'Goals', A });   // A = the agents() controller (for demo + agent points)
//   B.submit(score)            // whenever the score improves (debounced; the server keeps the best of the day)
//   B.open()                   // show the board (add a 🏆 button in your HUD)
import { toast } from './agents.js';

const API = new URLSearchParams(location.search).get('lbapi') || 'https://mcp.riffcade.com';
const POWER = '_power';
const REPLY = '_reply';
const CALL = 'Nova Atlas Echo Pixel Bolt Comet Orbit Rook Sage Spark Flint Vega Juno Iris Onyx Rex Zed Kiwi Taco Mochi Ziggy Luna Bram Odin'.split(' ');             // quick replies: times today you answered a waiting agent within 2 minutes
const ISO = 'AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PR PS PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VN VU WS XK YE ZA ZM ZW'.split(' ');
const TZ = { 'Europe/Lisbon': 'PT', 'Atlantic/Madeira': 'PT', 'Atlantic/Azores': 'PT', 'Europe/Dublin': 'IE', 'Europe/Brussels': 'BE', 'Europe/Zurich': 'CH', 'Europe/Vienna': 'AT', 'Europe/Stockholm': 'SE', 'Europe/Oslo': 'NO', 'Europe/Copenhagen': 'DK', 'Europe/Helsinki': 'FI', 'Europe/Athens': 'GR', 'Europe/Prague': 'CZ', 'Europe/Budapest': 'HU', 'Europe/Bucharest': 'RO', 'Europe/Moscow': 'RU', 'Asia/Bangkok': 'TH', 'Asia/Jakarta': 'ID', 'Asia/Manila': 'PH', 'Asia/Hong_Kong': 'HK', 'Asia/Taipei': 'TW', 'Asia/Karachi': 'PK', 'Asia/Dhaka': 'BD', 'Asia/Riyadh': 'SA', 'Africa/Cairo': 'EG', 'Africa/Nairobi': 'KE', 'America/Bogota': 'CO', 'America/Lima': 'PE', 'America/Santiago': 'CL', 'Australia/Melbourne': 'AU', 'Pacific/Auckland': 'NZ', 'America/Vancouver': 'CA', 'Europe/London': 'GB', 'Europe/Madrid': 'ES', 'Europe/Paris': 'FR', 'Europe/Berlin': 'DE', 'Europe/Rome': 'IT', 'Europe/Amsterdam': 'NL', 'Europe/Kyiv': 'UA', 'Europe/Warsaw': 'PL', 'Europe/Istanbul': 'TR', 'Asia/Jerusalem': 'IL', 'Asia/Tel_Aviv': 'IL', 'Asia/Kolkata': 'IN', 'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Shanghai': 'CN', 'Asia/Singapore': 'SG', 'Asia/Dubai': 'AE', 'Australia/Sydney': 'AU', 'America/Sao_Paulo': 'BR', 'America/Mexico_City': 'MX', 'America/Toronto': 'CA', 'America/Buenos_Aires': 'AR', 'Africa/Lagos': 'NG', 'Africa/Johannesburg': 'ZA' };
export const flag = cc => cc === 'XX' ? '🤖' : /^[A-Z]{2}$/.test(cc || '') ? String.fromCodePoint(...[...cc].map(c => 0x1f1e6 + c.charCodeAt(0) - 65)) : '🏳️';
const regionName = (() => { try { const d = new Intl.DisplayNames(['en'], { type: 'region' }); return cc => d.of(cc) || cc; } catch (e) { return cc => cc; } })();
function guessCountry() {
  // the time zone first (where you are), then the browser language (often en-US everywhere)
  try { const z = Intl.DateTimeFormat().resolvedOptions().timeZone; if (TZ[z]) return TZ[z]; if (/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage)|^Pacific\/Honolulu/.test(z)) return 'US'; } catch (e) {}
  for (const l of navigator.languages || [navigator.language]) { try { const r = new Intl.Locale(l).maximize().region; if (r && ISO.includes(r)) return r; } catch (e) {} }
  return 'US';
}
const store = {
  get(k, d) { try { const v = localStorage.getItem('board_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('board_' + k, JSON.stringify(v)); } catch (e) {} },
};
const client = (() => { let c = store.get('client', null); if (!c) { c = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()).replace(/-/g, ''); store.set('client', c); } return c; })();
export const profile = () => store.get('profile', null);   // { name, country }
const dayUTC = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'k' : (n || 0).toLocaleString();

const CSS = `
.bd-wrap{position:fixed;inset:0;background:rgba(10,8,20,.55);z-index:55;display:grid;place-items:center} .bd-wrap[hidden]{display:none!important}
.bd{width:min(560px,calc(100% - 24px));max-height:calc(100% - 40px);overflow:auto;background:rgba(18,16,30,.97);color:#f6f0e3;border:1px solid rgba(255,255,255,.14);border-radius:18px;padding:18px;font:15px/1.4 system-ui,-apple-system,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.5)}
.bd h2{margin:0 0 2px;font-size:22px;color:var(--ag-acc,#ffcf5a)} .bd .bd-sub{color:#b9b2c8;font-size:13px;margin:0 0 10px}
.bd .bd-x{float:right;background:none;border:0;color:#b9b2c8;font-size:20px;cursor:pointer}
.bd .bd-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0} .bd .bd-tabs button{font:inherit;font-size:13px;background:rgba(255,255,255,.07);color:#f6f0e3;border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:5px 11px;cursor:pointer}
.bd .bd-tabs button[aria-pressed=true]{background:var(--ag-acc,#ffcf5a);color:#1b1408;border-color:transparent;font-weight:700}
.bd .bd-row{display:grid;grid-template-columns:34px 28px 1fr auto 46px;gap:8px;align-items:center;padding:7px 4px;border-top:1px solid rgba(255,255,255,.07)}
.bd .bd-row.me{background:rgba(255,207,90,.12);border-radius:8px} .bd .bd-rank{color:#b9b2c8;font-weight:700;text-align:right} .bd .bd-flag{font-size:20px}
.bd .bd-row b{font-variant-numeric:tabular-nums} .bd .bd-rate{color:#9cf28a;font-size:12px;text-align:right}
.bd .bd-row:nth-child(-n+4) .bd-rank{color:var(--ag-acc,#ffcf5a)}
.bd .bd-me{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0;padding:10px;border-radius:12px;background:rgba(255,255,255,.05)}
.bd input,.bd select{font:inherit;background:rgba(255,255,255,.08);color:#f6f0e3;border:1px solid rgba(255,255,255,.18);border-radius:10px;padding:7px 10px}
.bd input{flex:1;min-width:120px} .bd select{max-width:200px} .bd .bd-save{background:var(--ag-acc,#ffcf5a);color:#1b1408;border:0;border-radius:10px;padding:8px 14px;font-weight:700;cursor:pointer}
.bd .bd-rev{display:inline-block;margin-left:4px;padding:0 6px;border-radius:999px;background:#5a3a12;color:#ffcf8a;font-size:11px;cursor:help}
.bd .bd-empty{color:#b9b2c8;padding:16px 4px} .bd .bd-fine{color:#8e88a0;font-size:12px;margin-top:10px}
.bd-chip{position:fixed;right:10px;top:50%;transform:translateY(-50%);z-index:45;display:grid;gap:6px;justify-items:end;font:13px/1.3 system-ui,-apple-system,sans-serif;pointer-events:none}
.bd-chip>*{pointer-events:auto;cursor:pointer;background:rgba(18,16,30,.88);color:#f6f0e3;border:1px solid rgba(255,255,255,.16);border-radius:14px;padding:7px 11px;box-shadow:0 6px 20px rgba(0,0,0,.35);backdrop-filter:blur(6px)}
.bd-chip .bd-me1 b{color:var(--ag-acc,#ffcf5a)} .bd-chip .bd-me1 small{color:#b9b2c8;display:block}
.bd-chip .bd-vs{display:grid;grid-template-columns:auto auto auto;gap:6px;align-items:center;border-color:var(--ag-acc,#ffcf5a)} .bd-chip .bd-vs .w{color:#9cf28a} .bd-chip .bd-vs small{grid-column:1/-1;text-align:center;color:#b9b2c8}
.bd-chip .bd-livec{font-size:12px;min-width:170px;display:grid;gap:2px} .bd-chip .bd-livec .t{font-weight:700;letter-spacing:.3px} .bd-chip .bd-livec .t i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#ff4d4d;margin-right:5px;animation:bdp 1.2s infinite}
.bd-chip .bd-livec .c{color:#f6f0e3} .bd-chip .bd-livec .r{color:#d8d2e4} .bd-chip .bd-livec small{color:#8e88a0} @keyframes bdp{50%{opacity:.25}}
.bd-chip .bd-rv{display:grid;gap:3px;min-width:200px;max-width:240px;border-width:2px} .bd-chip .bd-rv .hd{display:flex;align-items:center;gap:6px;font-size:14px} .bd-chip .bd-rv .hd .fl{font-size:18px} .bd-chip .bd-rv .hd i{margin-left:auto;width:12px;height:12px;border-radius:4px}
.bd-chip .bd-rv .st{color:#b9b2c8;font-size:12px} .bd-chip .bd-rv .sc{display:flex;gap:6px;align-items:center;font-size:14px} .bd-chip .bd-rv .sc .w{color:#9cf28a} .bd-chip .bd-rv .sc small{margin-left:auto;color:#8e88a0}
.bd-chip .bd-rv .ag{display:flex;flex-wrap:wrap;gap:4px} .bd-chip .bd-rv .ag span{background:rgba(255,255,255,.08);border-radius:999px;padding:1px 7px;font-size:11px} .bd-chip .bd-rv .ag i{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:4px;vertical-align:middle}
.bd-chip .bd-rv .fd{font-size:11.5px;color:#d8d2e4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis} .bd-chip .bd-rv .fd.bad{color:#ff9d9d} .bd-chip .bd-rv .fd small{color:#8e88a0}
@media (max-width:600px){.bd-chip{top:auto;bottom:calc(132px + env(safe-area-inset-bottom));transform:none;gap:4px} .bd-chip .bd-livec{display:none} .bd-chip .bd-rv{min-width:0;max-width:170px;padding:6px 9px} .bd-chip .bd-rv .ag,.bd-chip .bd-rv .fd:nth-of-type(n+2),.bd-chip .bd-rv .st{display:none} .bd-chip .bd-me1 small{display:none}}
.bd .bd-team{background:rgba(255,255,255,.05);border-radius:12px;padding:10px;margin:10px 0;border-left:4px solid var(--rc,#dfe4ec)} .bd .bd-team h3{margin:0 0 4px;font-size:15px} .bd .bd-team .row{display:flex;justify-content:space-between;gap:8px;font-size:13px;padding:3px 0;border-top:1px solid rgba(255,255,255,.06)} .bd .bd-team i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}
.bd-chip .bd-cta{background:var(--ag-acc,#ffcf5a);color:#1b1408;font-weight:700;border:0}
.bd .bd-duels{background:rgba(255,255,255,.05);border-radius:12px;padding:10px;margin:10px 0} .bd .bd-duels h3{margin:0 0 6px;font-size:15px}
.bd .bd-duel{display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-top:1px solid rgba(255,255,255,.07);font-size:14px}
.bd .bd-link{display:flex;gap:6px;margin-top:6px} .bd .bd-link input{flex:1;font-size:12px}
.bd .bd-vs-t{width:100%;border-collapse:collapse;font-size:13px;margin:4px 0} .bd .bd-vs-t th,.bd .bd-vs-t td{padding:3px 6px;text-align:right} .bd .bd-vs-t th:first-child,.bd .bd-vs-t td:first-child{text-align:left;color:#b9b2c8}
.bd .bd-vs-t td.w{color:#9cf28a;font-weight:700} .bd .bd-vs-t td.l{color:#ff8a8a} .bd .bd-vs-t tr.tot td{border-top:1px solid rgba(255,255,255,.14);font-weight:800;color:#f6f0e3}
.bd .bd-live{font-size:13px;color:#d8d2e4;margin:-4px 0 8px} .bd .bd-live i{display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff5d5d;margin-right:5px;animation:agp 1.2s infinite}`;

export function board({ game, label = 'Score', A = null }) {
  if (!document.getElementById('bd-css')) { const s = document.createElement('style'); s.id = 'bd-css'; s.textContent = CSS; document.head.appendChild(s); }
  let which = game, period = 'day', mine = false, pending = {}, timer = 0, lastSent = {};
  const live = () => !(A && A.demo) && profile();

  // ---- Agent points: what the agents got done today (UTC day), from every event this tab has seen
  const ship = { day: dayUTC(), score: 0, tools: 0, ok: 0, tokens: 0, steps: 0, tests: 0, commits: 0, deploys: 0, fails: 0 };
  // 🙋 replies: an agent finished its turn ('done') and you answered it ('prompt'); quick = within 2 minutes
  const reply = { day: dayUTC(), quick: 0, n: 0, times: [] }, waitSince = new Map();
  function onReply(e) {
    if (e.parent) return;
    if (e.kind === 'done') { waitSince.set(e.agent, e.t); return; }
    if (e.kind !== 'prompt' || !waitSince.has(e.agent)) return;
    const dt = e.t - waitSince.get(e.agent); waitSince.delete(e.agent);
    if (dt <= 0 || dt > 2 * 3600e3) return;
    if (dayUTC(e.t) !== reply.day) { if (dayUTC(e.t) < reply.day) return; Object.assign(reply, { day: dayUTC(e.t), quick: 0, n: 0, times: [] }); }
    reply.n++; reply.times.push(dt); if (dt <= 120e3) reply.quick++;
  }
  const median = a => { if (!a.length) return 0; const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; };
  const dur = ms => ms < 60e3 ? Math.round(ms / 1e3) + ' s' : Math.round(ms / 60e3) + ' min';
  function onAgentEvents(list) {
    if (A && A.demo) return;
    trackMine(list);
    const q0 = reply.quick;
    for (const e of list) onReply(e);
    if (reply.quick > q0 || (reply.quick && !lastSent[REPLY])) queue(REPLY, reply.quick, { tools: reply.n, ok: reply.quick });
    for (const e of list) {
      if (dayUTC(e.t) !== ship.day) { if (e.t < Date.now() - 864e5) continue; if (dayUTC(e.t) > ship.day) Object.assign(ship, { day: dayUTC(e.t), score: 0, tools: 0, ok: 0, tokens: 0, steps: 0, tests: 0, commits: 0, deploys: 0, fails: 0 }); else continue; }
      if (e.kind === 'tokens') ship.tokens += e.tokens || 0;
      if (e.kind !== 'result') continue;
      ship.tools++;
      if (!e.ok) { ship.fails++; ship.score = Math.max(0, ship.score - 1); continue; }
      ship.ok++; ship.score += e.cat === 'deploy' ? 10 : e.cat === 'test' || e.cat === 'commit' ? 5 : 1;
      if (e.cat === 'deploy') ship.deploys++; else if (e.cat === 'test') ship.tests++; else if (e.cat === 'commit') ship.commits++; else ship.steps++;
    }
    if (ship.tools) queue(POWER, ship.score, ship);
  }

  function queue(g, score, extra = {}) {
    if (!live()) return;
    if ((lastSent[g] || -1) >= score) return;
    pending[g] = { score, tools: extra.tools || 0, ok: extra.ok || 0, tokens: extra.tokens || 0, ...(g === POWER ? { detail: { steps: ship.steps, tests: ship.tests, commits: ship.commits, deploys: ship.deploys, fails: ship.fails } } : {}) };
    clearTimeout(timer); timer = setTimeout(flush, 4000);
  }
  async function flush() {
    const p = profile(); if (!p) return;
    for (const [g, v] of Object.entries(pending)) {
      delete pending[g];
      try {
        const r = await fetch(API + '/api/lb', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ game: g, client, name: p.name, country: p.country, ...v }) });
        const j = await r.json();
        if (r.ok) { const prev = store.get('rank_' + g, null); lastSent[g] = v.score; if (j.you && prev && j.you.rank < prev) toast(`🏆 You climbed to #${j.you.rank} on the ${g === POWER ? 'Agent points' : g === REPLY ? 'Fast replies' : label} board today`); if (j.you) store.set('rank_' + g, j.you.rank); }
      } catch (e) {}
    }
  }

  // ---- the panel
  const wrap = document.createElement('div'); wrap.className = 'bd-wrap'; wrap.hidden = true;
  wrap.innerHTML = '<div class="bd"></div>'; document.body.appendChild(wrap);
  wrap.addEventListener('pointerdown', e => { if (e.target === wrap) close(); });
  const el = wrap.firstChild;
  function close() { wrap.hidden = true; }
  let render = async function () {
    const p = profile(), cc = (p && p.country) || guessCountry();
    const tabs = (arr, cur, key) => arr.map(([v, t]) => `<button data-${key}="${v}" aria-pressed="${v === cur}">${t}</button>`).join('');
    el.innerHTML = `<button class="bd-x" aria-label="Close">✕</button><h2>🏆 World leaderboard</h2>
      <p class="bd-sub">${which === POWER ? `<b>⚡ Agent points: what your agents got done today</b>, in every RIFFCADE game. Tokens don't count, results do.${ship.tools ? `<br>You: ${breakdown()} = <b>${fmt(ship.score)}</b>` : ''}`
        : which === REPLY ? `<b>🙋 Fast replies: how often you answered a waiting agent within 2 minutes today.</b> An agent waiting on you ships nothing.${reply.n ? `<br>You: ${reply.quick} of ${reply.n} replies under 2 min · typical wait ${dur(median(reply.times))}` : ''}`
        : `${label} in this game, people's AI agents from all over the world.`}</p>
      <div class="bd-tabs">${tabs([[game, label], [POWER, '⚡ Agent points'], [REPLY, '🙋 Fast replies']], which, 'g')}</div>
      <div class="bd-tabs">${tabs([['day', 'Today'], ['week', 'This week'], ['all', 'All time'], ['nations', '🌍 Countries']], period, 'p')}
        <button data-mine aria-pressed="${mine}">${flag(cc)} My country</button></div>
      <div class="bd-me">${p ? `<span style="font-size:22px">${flag(p.country)}</span><b>${p.name}</b><button class="bd-tabs" data-edit style="margin-left:auto;background:none;border:0;color:#b9b2c8;cursor:pointer">Edit</button>`
        : `<input maxlength="18" placeholder="Your nickname" value=""><select>${ISO.map(c => `<option value="${c}" ${c === cc ? 'selected' : ''}>${flag(c)} ${regionName(c)}</option>`).join('')}</select><button class="bd-save">Join</button>`}</div>
      <div class="bd-list"><p class="bd-empty">Loading…</p></div>
      <p class="bd-fine">${A && A.demo ? 'Demo teams never post scores. Connect your agents to compete. ' : ''}Only your nickname, flag, scores and counts are shared. Never project names, prompts or code. Scores that can't be real are flagged "under review", never silently removed. Finished days and duels are frozen.</p>`;
    el.querySelector('.bd-x').onclick = close;
    el.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { which = b.dataset.g; render(); });
    el.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { period = b.dataset.p; render(); });
    const m = el.querySelector('[data-mine]'); if (m) m.onclick = () => { mine = !mine; render(); };
    const ed = el.querySelector('[data-edit]'); if (ed) ed.onclick = () => { store.set('profile', null); render(); };
    const sv = el.querySelector('.bd-save');
    if (sv) sv.onclick = () => {
      const name = el.querySelector('input').value.replace(/\s+/g, ' ').trim().slice(0, 18), country = el.querySelector('select').value;
      if (name.length < 2) { el.querySelector('input').focus(); return; }
      store.set('profile', { name, country }); lastSent = {};
      onAgentEvents([]); if (best[game] != null) queue(game, best[game]); flush().then(render); render();
    };
    // the list
    try {
      const q = new URLSearchParams({ game: which, period: period === 'nations' ? 'day' : period, client });
      if (mine && period !== 'nations') q.set('country', cc);
      const j = await (await fetch(API + '/api/lb?' + q)).json();
      const list = el.querySelector('.bd-list');
      if (period === 'nations') {
        list.innerHTML = j.countries && j.countries.length ? j.countries.map(n => `<div class="bd-row ${p && n.country === p.country ? 'me' : ''}"><span class="bd-rank">${n.rank}</span><span class="bd-flag">${flag(n.country)}</span><span>${regionName(n.country)} <small style="color:#8e88a0">· ${n.players} player${n.players > 1 ? 's' : ''}</small></span><b>${fmt(n.score)}</b><span></span></div>`).join('') : '<p class="bd-empty">No countries on the board yet today. Put yours first!</p>';
      } else {
        const rows = (j.top || []).map(r => `<div class="bd-row ${j.you && r.rank === j.you.rank && r.name === j.you.name ? 'me' : ''}"><span class="bd-rank">${r.rank}</span><span class="bd-flag" title="${regionName(r.country)}">${flag(r.country)}</span><span>${r.name.replace(/</g, '&lt;')}${r.review ? ` <small class="bd-rev" title="Flagged by the server: ${r.review}. Kept visible, ranked after checked scores, not counted for its country.">under review</small>` : ''}</span><b>${fmt(r.score)}</b><span class="bd-rate">${r.rate != null ? r.rate + '%' : ''}</span></div>`);
        if (j.you && !(j.top || []).some(r => r.rank === j.you.rank)) rows.push(`<div class="bd-row me"><span class="bd-rank">${j.you.rank}</span><span class="bd-flag">${flag(j.you.country)}</span><span>${j.you.name} (you)${j.you.review ? ' <small class="bd-rev">under review</small>' : ''}</span><b>${fmt(j.you.score)}</b><span class="bd-rate">${j.you.rate != null ? j.you.rate + '%' : ''}</span></div>`);
        list.innerHTML = rows.length ? rows.join('') : '<p class="bd-empty">Nobody on this board yet. Be the first!</p>';
      }
    } catch (e) { el.querySelector('.bd-list').innerHTML = '<p class="bd-empty">The leaderboard is offline right now.</p>'; }
  }
  const best = {};
  const breakdown = () => `✓ ${ship.steps} steps worked ×1 · 🧪 ${ship.tests} tests passed ×5 · 📦 ${ship.commits} commits ×5 · 🚀 ${ship.deploys} deploys ×10 · ✗ ${ship.fails} failures −1`;

  // ---------------------------------------------------------------- social: join sheet, rank chip, duels, live race
  const ADJ = 'Swift Brave Lucky Turbo Cosmic Sneaky Mighty Clever Rapid Sunny Neon Jolly'.split(' '), ANI = 'Otter Falcon Panda Fox Lynx Gecko Koala Orca Tiger Raven Moose Yak'.split(' ');
  const suggest = () => ADJ[(Math.random() * ADJ.length) | 0] + ANI[(Math.random() * ANI.length) | 0] + ((Math.random() * 90 + 10) | 0);
  const rnd = () => Math.random();
  function sheet(html, onOk) {                       // small modal: nickname + flag (prefilled), then onOk(profile)
    const w = document.createElement('div'); w.className = 'bd-wrap';
    const cc = guessCountry();
    w.innerHTML = `<div class="bd">${html}<div class="bd-me" style="margin-top:12px"><input maxlength="18" value="${suggest()}"><select>${ISO.map(c => `<option value="${c}" ${c === cc ? 'selected' : ''}>${flag(c)} ${regionName(c)}</option>`).join('')}</select></div>
      <div style="display:flex;gap:8px;justify-content:flex-end"><button class="bd-x" style="float:none;font-size:15px" data-no>Not now</button><button class="bd-save" data-ok>Let's go</button></div>
      <p class="bd-fine">Only your nickname, flag and scores are shared. Never project names, prompts or code.</p></div>`;
    document.body.appendChild(w);
    w.querySelector('[data-no]').onclick = () => w.remove();
    w.querySelector('[data-ok]').onclick = () => {
      const name = w.querySelector('input').value.replace(/\s+/g, ' ').trim().slice(0, 18), country = w.querySelector('select').value;
      if (name.length < 2) return w.querySelector('input').focus();
      store.set('profile', { name, country }); lastSent = {}; w.remove();
      onAgentEvents([]); if (best[game] != null) queue(game, best[game]); flush(); onOk && onOk({ name, country }); chip();
    };
  }
  // linking agents → one-tap join the world race
  addEventListener('riffcade-connected', () => { if (!profile() && !store.get('declined', false)) setTimeout(() => sheet(`<h2>🏁 Join the world race</h2><p class="bd-sub">Your agents are linked. Put them on the world leaderboard and in your country's team. Pick a nickname and your flag.</p>`, () => setTimeout(autoMatch, 1500)), 2500); });

  // duels
  let duels = [];
  const duelLink = id => `${location.origin}${location.pathname}?duel=${id}`;
  async function loadDuels() {
    if (!profile()) return;
    try { duels = await (await fetch(`${API}/api/duels?client=${client}`, { cache: 'no-store' })).json(); } catch (e) { return; }
    const seen = store.get('duels_done', []);
    for (const d of duels) if (d.status === 'over' && !seen.includes(d.id)) {
      const me = d[d.you], them = d[d.you === 'a' ? 'b' : 'a'];
      toast(me.score === them.score ? `⚔️ Duel with ${them.name} ${flag(them.country)}: a draw, ${me.score} each!` : me.score > them.score ? `🏆 You beat ${them.name} ${flag(them.country)} ${me.score}–${them.score}! Your agents shipped more.` : `⚔️ ${them.name} ${flag(them.country)} won the duel ${them.score}–${me.score}. Rematch?`, 8000);
      seen.push(d.id); store.set('duels_done', seen.slice(-50));
    }
    chip();
  }
  async function challenge(btn) {
    const go = async () => {
      const p = profile();
      try {
        const r = await fetch(`${API}/api/duel`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client, name: p.name, country: p.country, game: POWER }) });
        const d = await r.json(); if (!r.ok) return toast('⚠️ ' + (d.error || 'Could not create the duel'));
        const url = duelLink(d.id), text = `⚔️ ${p.name} ${flag(p.country)} challenges your AI agents: 24 hours, whose agents ship more? (tests, commits, deploys, not tokens)`;
        if (navigator.share) { try { await navigator.share({ title: 'AI agent duel', text, url }); } catch (e) {} }
        else { try { await navigator.clipboard.writeText(text + ' ' + url); toast('🔗 Challenge link copied: send it to a friend'); } catch (e) {} }
        loadDuels(); if (!wrap.hidden) render();
      } catch (e) { toast('⚠️ The duel server is offline right now'); }
    };
    profile() ? go() : sheet('<h2>⚔️ Challenge a friend</h2><p class="bd-sub">24 hours: whose AI agents ship more. Pick your nickname and flag first.</p>', go);
  }
  // ---- matchmaking: everyone in the race always has a rival. A real player who is also looking first; if nobody
  // turns up within ~15 s, a simulated rival (realistic nickname + flag, a pace close to yours, marked "sim" in the panel)
  let matching = false;
  async function autoMatch() {
    const p = profile();
    if (!p || matching || (A && A.demo) || !(A && A.connected && A.connected.length)) return;
    if (duels.some(d => d.status === 'live')) return;
    matching = true; chip();
    const t0 = Date.now();
    try {
      for (;;) {
        const r = await fetch(`${API}/api/match`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client, name: p.name, country: p.country }) });
        const d = await r.json(); if (!r.ok) break;
        if (d.status === 'live') { const th = d[d.you === 'a' ? 'b' : 'a']; toast(`⚔️ Your rival today: ${th.name} ${flag(th.country)}. 24 hours, whose agents ship more.`, 6000); break; }
        if (Date.now() - t0 > 15000) { await fetch(`${API}/api/duel/${d.id}/bot`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client }) }); continue; }
        await new Promise(res => setTimeout(res, 5000));
      }
    } catch (e) {}
    matching = false; await loadDuels();
  }
  addEventListener('riffcade-connected', () => setTimeout(autoMatch, 4000));
  setInterval(autoMatch, 60000);

  // no friend around: duel the house bot (it ships at about your usual pace, and never shows on the world board)
  async function botDuel(openId) {
    const go = async () => {
      const p = profile();
      try {
        let id = openId;
        if (!id) { const r = await fetch(`${API}/api/duel`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client, name: p.name, country: p.country, game: POWER }) }); const d = await r.json(); if (!r.ok) return toast('⚠️ ' + (d.error || 'Could not start the duel')); id = d.id; }
        const r2 = await fetch(`${API}/api/duel/${id}/bot`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client }) });
        const j = await r2.json(); if (!r2.ok) return toast('⚠️ ' + (j.error || 'The bot is busy'));
        toast('🤖 Duel on! 24 hours vs the House Bot. Ship more than it does.', 6000);
        await loadDuels(); if (!wrap.hidden) render();
      } catch (e) { toast('⚠️ The duel server is offline right now'); }
    };
    profile() ? go() : sheet('<h2>🤖 Duel the House Bot</h2><p class="bd-sub">24 hours: can your AI agents ship more than the bot? Pick your nickname and flag first.</p>', go);
  }
  // opened a challenge link (?duel=ID)
  const inviteId = new URLSearchParams(location.search).get('duel');
  if (inviteId && /^[A-Za-z0-9]{6,12}$/.test(inviteId)) (async () => {
    let d; try { const r = await fetch(`${API}/api/duel/${inviteId}`); d = r.ok ? await r.json() : null; } catch (e) {}
    if (!d) return toast('⚠️ That duel link has expired.');
    if (d.status !== 'open') { if (!duels.some(x => x.id === d.id)) toast(`⚔️ ${d.a.name} ${flag(d.a.country)} vs ${d.b ? d.b.name + ' ' + flag(d.b.country) : '…'}: ${d.a.score}–${d.b ? d.b.score : 0}`); return; }
    const accept = async () => {
      const p = profile();
      const r = await fetch(`${API}/api/duel/${inviteId}/join`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client, name: p.name, country: p.country }) });
      const j = await r.json(); if (!r.ok) return toast('⚠️ ' + (j.error || 'Could not join'));
      toast(`⚔️ Duel on! 24 hours vs ${d.a.name} ${flag(d.a.country)}. Link your agents and ship.`, 7000);
      loadDuels(); if (A && !A.connected.length) A.open();
    };
    const html = `<h2>⚔️ ${d.a.name} ${flag(d.a.country)} challenged you!</h2><p class="bd-sub">24 hours, whose AI agents ship more: steps that work, passed tests, commits and deploys. Tokens don't count. Accept, then link your agents.</p>`;
    if (profile()) { const w = document.createElement('div'); w.className = 'bd-wrap'; w.innerHTML = `<div class="bd">${html}<div style="display:flex;gap:8px;justify-content:flex-end"><button class="bd-x" style="float:none;font-size:15px" data-no>Not now</button><button class="bd-save" data-ok>Accept the duel</button></div></div>`; document.body.appendChild(w); w.querySelector('[data-no]').onclick = () => w.remove(); w.querySelector('[data-ok]').onclick = () => { w.remove(); accept(); }; }
    else sheet(html, accept);
  })();

  // the chip: my flag, rank and agent points, plus live duels (always on screen once you're in the race)
  const chipEl = document.createElement('div'); chipEl.className = 'bd-chip'; document.body.appendChild(chipEl);
  function chip() {
    const p = profile();
    const linked = A && A.connected && A.connected.length && !(A && A.demo);
    if (!p) chipEl.innerHTML = liveCard() + `<div class="bd-cta" data-join>🏁 ${linked ? 'Join the world race' : 'Race people worldwide'}</div><div data-open style="font-size:12px">🏆 World leaderboard</div>`;
    else {
      const rank = store.get('rank_' + POWER, null);
      let vs = duels.filter(d => d.status === 'live').slice(0, 2).map(d => { const me = d[d.you], th = d[d.you === 'a' ? 'b' : 'a']; const h = Math.max(0, Math.ceil((d.end - Date.now()) / 3600e3));
        return `<div class="bd-vs" data-open><b class="${me.score >= th.score ? 'w' : ''}">You ${me.score}</b><span>⚔️</span><b class="${th.score > me.score ? 'w' : ''}">${th.score} ${th.name} ${flag(th.country)}</b><small>${h} h left</small></div>`; }).join('');
      const open = duels.filter(d => d.status === 'open').length;
      if (riv) vs = rivalCard();
      chipEl.innerHTML = liveCard() + `<div class="bd-me1" data-open>${flag(p.country)} <b>${rank ? '#' + rank : '—'}</b> today<small title="${breakdown()}">⚡ ${fmt(ship.score)} agent points</small></div>${vs}${!vs ? (matching ? '<div>🔎 Finding you a rival…</div>' : linked ? '<div data-match>⚔️ Find a rival</div>' : '<div data-link>🔗 Link your agents to get a rival</div>') : ''}`;
    }
    chipEl.querySelectorAll('[data-open]').forEach(e => e.onclick = () => api.open(POWER));
    chipEl.querySelectorAll('[data-open-live]').forEach(e => e.onclick = () => { period = 'nations'; api.open(POWER); });   // the chip shows agent points: open that board
    const j = chipEl.querySelector('[data-join]'); if (j) j.onclick = () => linked ? sheet(`<h2>🏁 Join the world race</h2><p class="bd-sub">Put your agents on the world leaderboard and in your country's team, and get a rival.</p>`, () => setTimeout(autoMatch, 1500)) : A && A.open();
    const mt = chipEl.querySelector('[data-match]'); if (mt) mt.onclick = () => autoMatch();
    const lk = chipEl.querySelector('[data-link]'); if (lk) lk.onclick = () => A && A.open();
    const du = chipEl.querySelector('[data-duel]'); if (du) du.onclick = () => challenge();
    const bo = chipEl.querySelector('[data-bot]'); if (bo) bo.onclick = () => botDuel();
  }
  // 🌍 LIVE card: real people playing right now, their latest scores and the leading countries (polled every 20 s)
  let liveData = null;
  const GAMES = { _power: '⚡', 'agent-football': '⚽', 'agent-hoops': '🏀', 'agent-shooter': '🚀', 'agent-racing': '🏎️', 'agent-rockets': '🛰️', 'agent-dungeon': '⚔️', 'agent-summit': '🏔️', 'agent-bowling': '🎳', deskfolk: '🏢' };
  const ago = s => s < 60 ? 'now' : s < 3600 ? Math.round(s / 60) + 'm' : Math.round(s / 3600) + 'h';
  async function loadLive() { try { liveData = await (await fetch(`${API}/api/live`)).json(); chip(); } catch (e) {} }
  const liveCard = () => !liveData ? '' : `<div class="bd-livec" data-open-live><div class="t"><i></i>LIVE <b>${liveData.playingNow || 0}</b> playing now${liveData.duelsLive ? ` · ${liveData.duelsLive} duel${liveData.duelsLive > 1 ? 's' : ''}` : ''}</div>
    ${(liveData.countries || []).length ? `<div class="c">${liveData.countries.slice(0, 4).map(c => `${flag(c.country)} ${fmt(c.score)}`).join('  ')}</div>` : ''}
    ${(liveData.recent || []).slice(0, 3).map(r => `<div class="r">${flag(r.country)} ${String(r.name).replace(/</g, '').slice(0, 12)} <b>${GAMES[r.game] || '🎮'} ${fmt(r.score)}</b> <small>${ago(r.ago)}</small></div>`).join('')}</div>`;
  setInterval(loadLive, 20000); loadLive();
  addEventListener('riffcade-connected', chip);
  setInterval(() => { loadDuels(); }, 30000); loadDuels(); setTimeout(chip, 1500);
  setInterval(chip, 10000);

  // duels + live race inside the board panel
  const renderBase = render;
  render = async function () {
    await renderBase();
    const p = profile(), sub = el.querySelector('.bd-sub');
    try {
      const L = await (await fetch(`${API}/api/live`)).json();
      const lead = (L.countries || [])[0];
      sub.insertAdjacentHTML('afterend', `<p class="bd-live"><i></i>${L.agentsNow || 0} agents shipping right now · ${L.players || 0} players today${lead ? ` · ${flag(lead.country)} ${regionName(lead.country)} leads` : ''}</p>`);
    } catch (e) {}
    const box = document.createElement('div'); box.className = 'bd-duels';
    box.innerHTML = `<h3>⚔️ Duels · 24 h, whose agents ship more</h3>${duels.length ? duels.map(d => { const me = d[d.you], th = d[d.you === 'a' ? 'b' : 'a'];
      const tbl = th && me.detail && th.detail ? `<table class="bd-vs-t"><tr><th></th><th>You</th><th>${th.name.replace(/</g, '')} ${flag(th.country)}</th></tr>${[['✓ steps that worked', 'steps'], ['🧪 tests passed', 'tests'], ['📦 commits', 'commits'], ['🚀 deploys', 'deploys'], ['✗ failures', 'fails']].map(([t, k]) => `<tr><td>${t}</td><td class="${me.detail[k] > th.detail[k] ? (k === 'fails' ? 'l' : 'w') : ''}">${me.detail[k]}</td><td class="${th.detail[k] > me.detail[k] ? (k === 'fails' ? 'l' : 'w') : ''}">${th.detail[k]}</td></tr>`).join('')}<tr class="tot"><td>⚡ points</td><td>${me.score}</td><td>${th.score}</td></tr></table><p class="bd-fine" style="margin:2px 0 6px">Counted since the duel started · ${Math.max(0, Math.ceil((d.end - Date.now()) / 3600e3))} h left</p>` : '';
      return `${tbl ? '' : ''}<div class="bd-duel"><span>${th ? `vs ${th.name} ${flag(th.country)}${th.sim ? ' <small style="color:#8e88a0">· simulated</small>' : ''}` : 'Waiting for a rival'}</span><b>${th ? `${me.score}–${th.score}` : ''} ${d.status === 'live' ? '🔴' : d.status === 'over' ? (me.score > (th ? th.score : 0) ? '🏆' : '·') : ''}</b></div>${d.status !== 'open' ? tbl : ''}${d.status === 'open' ? `<div class="bd-link"><input readonly value="${duelLink(d.id)}"><button class="bd-save" data-copy="${duelLink(d.id)}">Copy</button>${d.you === 'a' ? `<button class="bd-save" data-botid="${d.id}" title="No friend around? The House Bot takes it">🤖</button>` : ''}</div>` : ''}`; }).join('') : '<p class="bd-fine" style="margin:0">No duels yet. Challenge a friend and send them the link.</p>'}
      <div style="display:flex;gap:8px;margin-top:8px"><button class="bd-save" data-new style="flex:1">⚔️ Challenge a friend</button><button class="bd-save" data-bot style="flex:1">🎲 Practice rival now</button></div>`;
    el.querySelector('.bd-tabs').before(box);
    if (riv) {
      const r = riv, rec = r.record, t = document.createElement('div'); t.className = 'bd-team'; t.style.setProperty('--rc', r.color);
      t.innerHTML = `<h3>${r.flag} ${esc(r.name)}'s team ${r.sim ? '<small style="color:#8e88a0">· simulated rival</small>' : ''}</h3>
        <p class="bd-fine" style="margin:0 0 6px">${r.sim ? 'No real player was free, so a simulated team plays you. It never appears on the world board.' : `${r.online ? '🟢 Online now' : '😴 Offline' + (r.lastSeen ? ', last seen ' + since(r.lastSeen) + ' ago' : '')}${rec ? ` · duels ${rec.w}W ${rec.l}L${rec.d ? ' ' + rec.d + 'D' : ''} · 🔥 ${rec.streak}-day streak` : ''}${r.today != null ? ` · ⚡ ${fmt(r.today)} today` : ''}`}</p>
        ${(r.agents || []).map(a => `<div class="row"><span><i style="background:${dot(a.state)}"></i><b>${esc(a.name)}</b> <small style="color:#8e88a0">${a.src === 'codex' ? 'Codex' : 'Claude Code'}${a.sub ? ` · +${a.sub} helper${a.sub > 1 ? 's' : ''}` : ''}</small></span><span>${a.state}${a.done ? ` · ${a.done} done` : ''}</span></div>`).join('') || '<p class="bd-fine">No agents online right now.</p>'}
        ${rivFeed.length ? `<div style="margin-top:6px">${rivFeed.slice(0, 5).map(e => `<div class="row"><span>${esc(feedLine(e))}</span><small>${since(e.t)} ago</small></div>`).join('')}</div>` : ''}
        ${myTeam().length ? `<p class="bd-fine">Your rival sees your agents as: ${myTeam().slice(0, 6).map(a => `<b>${a.name}</b> (${esc(a.label)})`).join(', ')}. Only you see the project names.</p>` : ''}`;
      box.after(t);
    }
    box.querySelector('[data-new]').onclick = () => challenge();
    box.querySelector('[data-bot]').onclick = () => botDuel();
    box.querySelectorAll('[data-botid]').forEach(b => b.onclick = () => botDuel(b.dataset.botid));
    box.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => navigator.clipboard && navigator.clipboard.writeText(b.dataset.copy).then(() => b.textContent = 'Copied ✓'));
  };
  // ---------------------------------------------------------------- the rival's team, live
  // In a live duel both sides' games swap team snapshots through the server: each agent's callsign (never the project
  // name), Claude or Codex, working / waiting / idle, and its finished steps. Games play the rival's agents as the
  // opposing team: B.rival() for the roster, B.onRival(cb) for their finished steps as they happen.
  const myAgents = new Map();                             // my lead agents: id → { k, name, src, last, kind, done, subs: Map }
  const outbox = [], usedNames = new Set();
  const hash = s => [...String(s)].reduce((a, c) => (a * 33 + c.charCodeAt(0)) >>> 0, 5381);
  function callsignOf(id) { const m = myAgents.get(id); if (m) return m.name; let i = hash(id) % CALL.length; for (let n = 0; n < CALL.length && usedNames.has(CALL[i]); n++) i = (i + 1) % CALL.length; usedNames.add(CALL[i]); return CALL[i]; }
  function trackMine(list) {
    if (A && A.demo) return;
    for (const e of list) {
      const lead = e.parent || e.agent;
      let m = myAgents.get(lead);
      if (!m) { m = { k: (hash(lead) % 1e9).toString(36), name: callsignOf(lead), src: e.src, label: e.label, last: 0, kind: '', done: 0, subs: new Map() }; myAgents.set(lead, m); }
      if (e.parent) m.subs.set(e.agent, e.t); else if (e.kind !== 'tokens') { m.last = Math.max(m.last, e.t); m.kind = e.kind; }
      if (e.kind === 'result') { if (e.ok) m.done++; if (e.live) outbox.push({ k: m.k, cat: e.cat || 'other', ok: !!e.ok, t: e.t }); }
    }
    if (outbox.length > 60) outbox.splice(0, outbox.length - 60);
  }
  const myTeam = () => { const now = Date.now(); return [...myAgents.values()].filter(m => now - m.last < 3 * 3600e3).sort((a, b) => b.last - a.last).slice(0, 16)
    .map(m => ({ k: m.k, name: m.name, src: m.src, label: m.label, state: m.kind === 'done' ? 'waiting' : now - m.last < 120e3 ? 'working' : 'idle', sub: [...m.subs.values()].filter(t => now - t < 120e3).length, done: m.done })); };
  let riv = null, rivAfter = 0, rivDuel = null;
  const rivCbs = [], rivFeed = [];
  const PAL = ['#ff5d5d', '#4dabf7', '#ffd43b', '#9775fa', '#20c997', '#ff922b', '#f06595', '#5c7cfa'];
  async function rivalTick() {
    const p = profile(), linked = A && A.connected && A.connected.length && !A.demo;
    if (!p) return;
    try {
      if (linked && duels.some(d => d.status === 'live')) {
        const ev = outbox.splice(0, outbox.length);
        await fetch(`${API}/api/team`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client, agents: myTeam().map(({ label, ...a }) => a), ev }) });
      }
      const j = await (await fetch(`${API}/api/rival?client=${client}&after=${rivAfter}`, { cache: 'no-store' })).json();
      if (!j.duel) { riv = null; rivDuel = null; return; }
      if (!rivDuel || rivDuel.id !== j.duel.id) { rivAfter = 0; rivFeed.length = 0; }
      rivDuel = j.duel;
      const r = j.rival, first = !riv || riv.key !== j.duel.id;
      riv = { ...r, key: j.duel.id, color: r.sim ? '#dfe4ec' : PAL[hash(r.name + r.country) % PAL.length], flag: flag(r.country),
        score: j.duel[j.duel.you === 'a' ? 'b' : 'a'].score, myScore: j.duel[j.duel.you].score, end: j.duel.end, detail: j.duel[j.duel.you === 'a' ? 'b' : 'a'].detail };
      const byK = new Map((r.agents || []).map(a => [a.k, a]));
      const ev = (r.events || []).filter(e => e.seq > rivAfter).map(e => ({ ...e, agent: byK.get(e.k) || { k: e.k, name: 'Agent', src: 'claude' } }));
      if (r.events && r.events.length) rivAfter = Math.max(rivAfter, ...r.events.map(e => e.seq));
      if (!first || r.sim) {                             // the first poll only sets the baseline (no replay of the last minutes)
        const fresh = ev.filter(e => Date.now() - e.t < 90e3);
        for (const e of fresh) rivFeed.unshift(e); rivFeed.splice(8);
        if (fresh.length) rivCbs.forEach(cb => { try { cb(fresh, riv); } catch (er) { console.warn(er); } });
      }
      chip();
    } catch (e) {}
  }
  setInterval(rivalTick, 3500); setTimeout(rivalTick, 2500);
  const esc = x => String(x).replace(/[<>&"]/g, '');
  const dot = st => st === 'working' ? '#9cf28a' : st === 'waiting' ? '#ffcf5a' : '#6b6580';
  const since = t => { const s = Math.max(1, Math.round((Date.now() - t) / 1000)); return s < 60 ? s + 's' : s < 3600 ? Math.round(s / 60) + 'm' : Math.round(s / 3600) + 'h'; };
  function rivalCard() {
    const r = riv, h = Math.max(0, Math.ceil((r.end - Date.now()) / 3600e3)), ags = r.agents || [];
    const status = r.sim ? `${ags.length} agents · simulated` : r.online ? `🟢 ${ags.filter(a => a.state === 'working').length} of ${ags.length} agents working` : `😴 offline${r.lastSeen ? ' · seen ' + since(r.lastSeen) + ' ago' : ''}`;
    return `<div class="bd-rv" data-open style="border-color:${r.color}">
      <div class="hd"><span class="fl">${r.flag}</span><b>${esc(r.name)}</b><i style="background:${r.color}"></i></div>
      <div class="st">${status}</div>
      <div class="sc"><b class="${r.myScore >= r.score ? 'w' : ''}">You ${r.myScore}</b><span>⚔️</span><b class="${r.score > r.myScore ? 'w' : ''}">${r.score}</b><small>${h} h left</small></div>
      ${ags.length ? `<div class="ag">${ags.slice(0, 6).map(a => `<span title="${a.src === 'codex' ? 'Codex' : 'Claude Code'} · ${a.state}"><i style="background:${dot(a.state)}"></i>${esc(a.name)}${a.sub ? `+${a.sub}` : ''}</span>`).join('')}</div>` : ''}
      ${rivFeed.slice(0, 2).map(e => `<div class="fd ${e.ok ? '' : 'bad'}">${esc(feedLine(e))} <small>${since(e.t)}</small></div>`).join('')}</div>`;
  }
  const VERB = { test: '🧪 passed tests', commit: '📦 committed', deploy: '🚀 deployed', edit: '✏️ edited', run: '▶️ ran a step', read: '🔍 read code', web: '🌐 searched', delegate: '👥 sent a helper', other: '✓ finished a step' };
  const feedLine = e => `${e.agent.name} ${e.ok ? VERB[e.cat] || VERB.other : '✗ hit an error'}`;

  const api = {
    open(tab) { if (tab) which = tab; wrap.hidden = false; render(); loadDuels(); },
    close,
    // call with the game's score whenever it improves; the server keeps each player's best of the day
    submit(score, extra = {}) { score = Math.floor(score) || 0; if (score > (best[game] || 0)) best[game] = score; queue(game, best[game], extra); if (!profile() && score > 0 && !store.get('asked', false) && !(A && A.demo)) { store.set('asked', true); toast('🏆 Join the world leaderboard: open 🏆 and pick a nickname + your flag', 6000); } },
    onAgentEvents,                       // pass every agents() batch here so the agent points board stays current
    ship: () => ({ ...ship }),
    replies: () => ({ quick: reply.quick, n: reply.n, median: median(reply.times) }),
    // the rival's team in your live duel, or null: { name, country, flag, sim, online, color, agents: [{ k, name, src, state, sub, done }],
    //   score, myScore, detail, record: { w, l, d, streak } | null, end }. Real rival → their colour; simulated → silver.
    rival: () => riv,
    // cb(events, rival): the rival's agents finished steps, as they happen. event { agent: { k, name, src }, cat, ok, t }
    onRival(cb) { rivCbs.push(cb); },
    // my own agents' public callsigns (what the rival sees): [{ name, src, label, state }]
    myCallsigns: () => myTeam(),
    profile,
    challenge,
    botDuel,
  };
  return api;
}
