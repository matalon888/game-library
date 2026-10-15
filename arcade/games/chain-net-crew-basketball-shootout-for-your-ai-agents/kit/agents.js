// Agents — connect the player's own AI coding agents (Claude Code, Codex) to a RIFFCADE game. Shared by every
// "Connect your AI" game. Everything runs in this tab: the player picks their ~/.claude or ~/.codex folder once
// (File System Access API, desktop Chrome/Edge), we re-read only the new bytes of changed log files every 2.5 s.
// Only tool names, success/failure, token counts, times and the project folder name are used. Prompts, code and
// command text never leave the parser (commands are only pattern-matched for "test" / "commit" / "deploy").
//
// Event { agent, parent, label, src, kind, cat, tool, ok, tokens, t, live, counted }
//   kind: 'tool'   the agent started a tool          cat: edit | read | run | test | commit | deploy | web | delegate | other
//         'result' a tool finished                   ok: true / false  (cat carried over from the call)
//         'think'  the agent wrote / reasoned        'tokens' tokens: n (output + input/10)
//         'prompt' the player sent a message         'done' the agent finished its turn and waits for the player
//         'end'    a subagent finished
//   live:    happened in the last 30 min (show it on screen)
//   counted: new for THIS game since the last time it ran (use it for score / coins / progress: each event once, ever)
//
// Usage:
//   import { agents } from '../kit/agents.js';
//   const A = agents({ game: 'agent-fc', title: 'AGENT FC', tagline: 'Your agents are the team.', onEvents(list, info) {...} });
//   A.open();  // show the connect card again (e.g. from a "Connect" button)
//   A.demo / A.connected / A.supported

const DAY = 864e5, LIVE = 30 * 60e3;
export const supported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

// ---------------------------------------------------------------- helpers games can use
export const toolName = t => String(t || '').replace(/^mcp__[^_]+(?:_[^_]+)*?__/, '').replace(/^mcp__/, '').slice(0, 14);
export const folderName = cwd => { const p = String(cwd).split(/[\\/]/).filter(Boolean); return (p.length <= 2 && /^(Users|home)$/.test(p[0] || '') ? 'home' : p.pop() || 'agent').slice(0, 16); };
const TEST = /\b(pytest|jest|vitest|mocha|playwright test|cargo test|go test|npm (run )?test|pnpm (run )?test|yarn test|bun test|rspec|phpunit|unittest|check\.cjs|qa\.cjs)\b/i;
const COMMIT = /\bgit (commit|merge|rebase)\b/i, DEPLOY = /\b(git push|deploy|vercel|wrangler|railway up|fly deploy|netlify|firebase deploy|--push)\b/i;
export function category(tool, cmd = '') {
  const t = String(tool || '').toLowerCase();
  if (cmd && TEST.test(cmd)) return 'test';
  if (cmd && COMMIT.test(cmd)) return 'commit';
  if (cmd && DEPLOY.test(cmd)) return 'deploy';
  if (/edit|write|patch|notebook|apply/.test(t)) return 'edit';
  if (/^(read|grep|glob|ls|view)|search_files|find/.test(t)) return 'read';
  if (/bash|shell|exec|run|terminal|^js$|python|repl/.test(t)) return 'run';
  if (/web|fetch|browse|search|chrome|navigate|computer/.test(t)) return 'web';
  if (/^(agent|task)$|spawn|delegate|subagent/.test(t)) return 'delegate';
  return 'other';
}

// ---------------------------------------------------------------- parsers (one JSONL line → events)
function parseClaude(line, st) {
  let j; try { j = JSON.parse(line); } catch (e) { return []; }
  if (j.cwd && !st.named) { st.meta.label = folderName(j.cwd); st.named = true; }
  const t = Date.parse(j.timestamp || '') || 0;
  if (!t) return [];
  const out = [], m = j.message;
  if (j.type === 'assistant' && m) {
    for (const c of Array.isArray(m.content) ? m.content : []) {
      if (c && c.type === 'tool_use') {
        const cat = category(c.name, c.input && (c.input.command || c.input.cmd) || '');
        if (c.id) st.calls.set(c.id, cat);
        out.push({ kind: 'tool', tool: c.name || 'tool', cat, t });
      }
    }
    if (!out.length) out.push({ kind: m.stop_reason === 'end_turn' ? 'done' : 'think', t });
    const u = m.usage, id = m.id || j.requestId;
    if (u && id && !st.seen.has(id)) { st.seen.add(id); out.push({ kind: 'tokens', tokens: (u.output_tokens || 0) + Math.round((u.input_tokens || 0) / 10), t }); }
  } else if (j.type === 'user' && m) {
    if (typeof m.content === 'string') out.push({ kind: 'prompt', t });
    else for (const c of Array.isArray(m.content) ? m.content : []) {
      if (c && c.type === 'tool_result') { const cat = st.calls.get(c.tool_use_id) || 'other'; st.calls.delete(c.tool_use_id); out.push({ kind: 'result', ok: !c.is_error, cat, t }); }
      else if (c && c.type === 'text' && !st.sub) { out.push({ kind: 'prompt', t }); break; }
    }
  }
  return out;
}
const FAIL = /exit code:? *[1-9]|\btraceback\b|\berror:|\bfailed\b|command not found|\bexception\b/i;
function parseCodex(line, st) {
  let j; try { j = JSON.parse(line); } catch (e) { return []; }
  const t = Date.parse(j.timestamp || '') || 0;
  if (!t) return [];
  const p = j.payload || {};
  if (j.type === 'turn_context' && p.cwd) { st.meta.label = folderName(p.cwd); return []; }
  if (j.type === 'response_item') {
    if (p.type === 'function_call' || p.type === 'custom_tool_call' || p.type === 'local_shell_call') {
      let cmd = ''; try { const a = typeof p.arguments === 'string' ? JSON.parse(p.arguments) : p.arguments || {}; cmd = [].concat(a.cmd || a.command || a.code || '').join(' '); } catch (e) {}
      if (!cmd && typeof p.input === 'string') cmd = p.input;
      const cat = category(p.name || 'shell', cmd);
      if (p.call_id) st.calls.set(p.call_id, cat);
      return [{ kind: 'tool', tool: p.name || 'shell', cat, t }];
    }
    if (p.type === 'function_call_output' || p.type === 'custom_tool_call_output') {
      const cat = st.calls.get(p.call_id) || 'other'; st.calls.delete(p.call_id);
      const o = typeof p.output === 'string' ? p.output : JSON.stringify(p.output || '');
      return [{ kind: 'result', ok: !FAIL.test(o.slice(0, 600)), cat, t }];
    }
    if (p.type === 'reasoning') return [{ kind: 'think', t }];
  }
  if (j.type === 'event_msg') {
    if (p.type === 'token_count' && p.info && p.info.last_token_usage) { const u = p.info.last_token_usage; return [{ kind: 'tokens', tokens: (u.output_tokens || 0) + Math.round((u.input_tokens || 0) / 10), t }]; }
    if (p.type === 'user_message') return [{ kind: 'prompt', t }];
    if (p.type === 'task_complete') return [{ kind: 'done', t }];
  }
  return [];
}

// ---------------------------------------------------------------- folder watcher
async function resolveRoot(h) {
  const names = []; for await (const [n] of h.entries()) { names.push(n); if (names.length > 400) break; }
  if (names.includes('projects')) return { src: 'claude', dir: await h.getDirectoryHandle('projects') };
  if (names.includes('sessions')) return { src: 'codex', dir: await h.getDirectoryHandle('sessions') };
  if (names.some(n => /^20\d\d$/.test(n))) return { src: 'codex', dir: h };
  if (names.some(n => n.startsWith('-'))) return { src: 'claude', dir: h };
  return null;
}
function metaFor(src, path) {
  if (src === 'claude') {
    const proj = path.length > 1 ? path[0] : 'agent', label = (proj.split('-').filter(Boolean).pop() || 'agent').slice(0, 16);
    if (path.includes('subagents')) return { agent: 'c:' + path[path.length - 1].replace(/\.jsonl$/, ''), parent: 'c:' + path[path.length - 3], label, src };
    return { agent: 'c:' + path[path.length - 1].replace(/\.jsonl$/, ''), parent: null, label, src };
  }
  return { agent: 'x:' + path[path.length - 1].replace(/\.jsonl$/, '').slice(-12), parent: null, label: 'codex', src };
}
async function listFiles(root, src) {
  const files = [], minYear = new Date(Date.now() - 2 * DAY).getFullYear();
  async function walk(dir, path) {
    for await (const [name, h] of dir.entries()) {
      if (h.kind === 'file' && name.endsWith('.jsonl')) files.push({ h, path: path.concat(name) });
      else if (h.kind === 'directory' && path.length < 5) {
        if (src === 'codex' && path.length === 0 && /^\d{4}$/.test(name) && +name < minYear) continue;
        await walk(h, path.concat(name));
      }
    }
  }
  await walk(root, []);
  return files;
}
function watcher(handle, emit) {
  let root = null, stopped = false, timer = 0;
  const state = new Map(), since = Date.now() - DAY;
  async function readNew(f, first) {
    const key = f.path.join('/');
    let file; try { file = await f.h.getFile(); } catch (e) { return []; }
    let st = state.get(key);
    if (!st) {
      st = { size: 0, meta: metaFor(root.src, f.path), seen: new Set(), calls: new Map(), carry: '', sub: f.path.includes('subagents') };
      state.set(key, st);
      if (file.lastModified < since) { st.size = file.size; return []; }
    }
    if (file.size <= st.size) return [];
    const from = first && file.size - st.size > 2e6 ? file.size - 2e6 : st.size;
    const text = st.carry + await file.slice(from, file.size).text();
    st.size = file.size;
    const lines = text.split('\n'); st.carry = lines.pop();
    if (from > 0 && first) lines.shift();
    const out = [];
    for (const l of lines) {
      if (!l) continue;
      for (const e of (root.src === 'claude' ? parseClaude : parseCodex)(l, st)) if (e.t >= since) out.push({ ...e, ...st.meta });
    }
    return out;
  }
  async function tick(first) {
    if (stopped) return;
    try {
      const all = [];
      for (const f of await listFiles(root.dir, root.src)) all.push(...await readNew(f, first));
      all.sort((a, b) => a.t - b.t);
      if (all.length || first) emit(all, { backfill: first, src: root.src });
    } catch (e) { console.warn('[agents] read failed', e); }
    if (!stopped) timer = setTimeout(() => tick(false), 2500);
  }
  return {
    async start(ready) { root = await resolveRoot(handle); if (!root) throw new Error('No agent logs in that folder. Pick your .claude or .codex folder.'); ready && ready(root.src); await tick(true); return root.src; },
    stop() { stopped = true; clearTimeout(timer); },
  };
}

// ---------------------------------------------------------------- remembered folders (IndexedDB, shared by all games)
const idb = (() => {
  let p;
  const db = () => p || (p = new Promise((res, rej) => { const r = indexedDB.open('riffcade-agents', 1); r.onupgradeneeded = () => r.result.createObjectStore('h'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('h', mode); const r = fn(t.objectStore('h')); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }); };
  return { get: k => tx('readonly', s => s.get(k)), set: (k, v) => tx('readwrite', s => s.put(v, k)) };
})();
const saved = {
  async list() { try { return (await idb.get('handles')) || []; } catch (e) { return []; } },
  async add(h) { const l = await this.list(); if (!(await Promise.all(l.map(x => x.isSameEntry(h)))).some(Boolean)) l.push(h); await idb.set('handles', l); },
};
const permitted = async (h, ask) => { const o = { mode: 'read' }; if ((await h.queryPermission(o)) === 'granted') return true; return ask ? (await h.requestPermission(o)) === 'granted' : false; };

// ---------------------------------------------------------------- a pretend team for the demo (and phones)
function demoFeed(emit, { agents: n = 4 } = {}) {
  const names = ['web-app', 'api', 'docs', 'mobile', 'infra', 'billing'];
  const tools = [['Edit', 'edit'], ['Read', 'read'], ['Bash', 'run'], ['Grep', 'read'], ['Write', 'edit'], ['Bash', 'test'], ['WebSearch', 'web'], ['Bash', 'commit'], ['Agent', 'delegate'], ['Edit', 'edit']];
  const team = names.slice(0, n).map((l, i) => ({ agent: 'd:' + i, parent: null, label: l, src: i % 3 === 1 ? 'codex' : 'claude' }));
  let subs = 0, k = 0;
  const step = () => {
    const now = Date.now(), out = [];
    for (const a of team) {
      const r = Math.random();
      if (r < 0.5) {
        const [tool, cat] = tools[(Math.random() * tools.length) | 0];
        out.push({ ...a, kind: 'tool', tool, cat, t: now });
        const ok = Math.random() < (cat === 'test' ? 0.7 : 0.88);
        setTimeout(() => emit([{ ...a, kind: 'result', ok, cat, t: Date.now(), live: true, counted: true }], { demo: true }), 500 + Math.random() * 900);
        if (cat === 'delegate' && subs < 3 && !a.parent) {
          subs++; const s = { agent: 'd:s' + (++k), parent: a.agent, label: a.label, src: a.src }; team.push(s);
          setTimeout(() => { team.splice(team.indexOf(s), 1); subs--; emit([{ ...s, kind: 'end', t: Date.now(), live: true, counted: true }], { demo: true }); }, 9000 + Math.random() * 6000);
        }
      } else if (r < 0.62) out.push({ ...a, kind: 'think', t: now });
      else if (r > 0.97 && !a.parent) out.push({ ...a, kind: 'done', t: now });
      if (r < 0.7) out.push({ ...a, kind: 'tokens', tokens: 200 + ((Math.random() * 900) | 0), t: now });
    }
    emit(out.map(e => ({ ...e, live: true, counted: true })), { demo: true });
  };
  const id = setInterval(step, 1300); step();
  return { stop() { clearInterval(id); } };
}

// ---------------------------------------------------------------- connect card (same look in every game)
const CSS = `
.ag-card{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(500px,calc(100% - 32px));max-height:calc(100% - 40px);overflow:auto;background:rgba(18,16,30,.95);color:#f6f0e3;border:1px solid rgba(255,255,255,.14);border-radius:18px;padding:22px;z-index:50;font:15px/1.45 system-ui,-apple-system,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.5)}
.ag-card h1{margin:0;font-size:30px;letter-spacing:1px;color:var(--ag-acc,#ffcf5a)} .ag-card .ag-tag{margin:2px 0 10px;font-weight:700;font-size:17px}
.ag-card .ag-btns{display:grid;gap:8px;margin:14px 0 8px} .ag-card button{font:inherit;cursor:pointer;border-radius:12px;padding:11px 16px}
.ag-card .ag-big{background:var(--ag-acc,#ffcf5a);color:#1b1408;border:0;font-weight:700;font-size:16px} .ag-card .ag-big:disabled{opacity:.45;cursor:not-allowed}
.ag-card .ag-ghost{background:transparent;color:#f6f0e3;border:1px solid rgba(255,255,255,.18)} .ag-card .ag-fine{color:#b9b2c8;font-size:13px;margin:8px 0 0}
.ag-card kbd{border:1px solid rgba(255,255,255,.2);border-radius:4px;padding:0 4px;font-size:12px} .ag-card code{background:rgba(255,255,255,.08);padding:0 4px;border-radius:4px}
.ag-drop{position:fixed;inset:0;background:rgba(15,12,26,.82);display:grid;place-items:center;z-index:60;font:22px system-ui;color:#fff;border:3px dashed var(--ag-acc,#ffcf5a)}
.ag-toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:rgba(18,16,30,.95);color:#f6f0e3;border:1px solid var(--ag-acc,#ffcf5a);border-radius:12px;padding:10px 14px;font:14px system-ui;z-index:70;max-width:90%}
.ag-demo{position:fixed;left:50%;bottom:calc(12px + env(safe-area-inset-bottom));transform:translateX(-50%);background:rgba(18,16,30,.9);color:#f6f0e3;border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:7px 14px;font:13px system-ui;z-index:40;white-space:nowrap}
.ag-demo a{color:var(--ag-acc,#ffcf5a)} [hidden].ag-card,[hidden].ag-drop,[hidden].ag-demo{display:none!important}`;
export function toast(s, ms = 4000) { const d = document.createElement('div'); d.className = 'ag-toast'; d.textContent = s; document.body.appendChild(d); setTimeout(() => d.remove(), ms); }

export function agents({ game, title, tagline, about = '', accent = '#ffcf5a', onEvents, onConnect, demoAgents = 4, autoDemo = true }) {
  if (!document.getElementById('ag-css')) { const s = document.createElement('style'); s.id = 'ag-css'; s.textContent = CSS; document.head.appendChild(s); }
  document.documentElement.style.setProperty('--ag-acc', accent);
  const KEY = 'agents_mark_' + game;
  let mark = {}; try { mark = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
  const api = { demo: false, connected: [], supported, open, close };
  let demoRun = null;

  // every batch: tag live / counted, move this game's "already counted" mark after the batch
  function emit(list, info = {}) {
    if (info.demo) { if (api.demo) onEvents(list, info); return; }
    const now = Date.now(), m0 = { ...mark };
    for (const e of list) { e.live = now - e.t < LIVE; e.counted = e.t > (m0[e.src] || 0); if (e.counted) mark[e.src] = Math.max(mark[e.src] || 0, e.t); }
    try { localStorage.setItem(KEY, JSON.stringify(mark)); } catch (e) {}
    onEvents(list, info);
  }

  const card = document.createElement('section'); card.className = 'ag-card';
  card.innerHTML = `<h1>${title}</h1><p class="ag-tag">${tagline}</p>${about ? `<p>${about}</p>` : ''}
    <div class="ag-btns"><button class="ag-big" data-src="claude">Connect Claude Code</button><button class="ag-big" data-src="codex">Connect Codex</button>
    <button class="ag-ghost" data-demo>Watch a demo team</button></div>
    <p class="ag-fine">Pick your <code>.claude</code> (or <code>.codex</code>) folder in your home folder. On a Mac press <kbd>⌘</kbd><kbd>⇧</kbd><kbd>.</kbd> in the picker to show hidden folders, or drag the folder onto this page.</p>
    <p class="ag-fine">Private: the game runs in this tab and reads only tool names, success or failure, token counts and times. Prompts and code never leave your computer.</p>
    ${supported ? '' : '<p class="ag-fine" style="color:#ffb38a">Connecting live needs desktop Chrome or Edge. Here you can watch the demo team.</p>'}`;
  document.body.appendChild(card);
  const drop = document.createElement('div'); drop.className = 'ag-drop'; drop.hidden = true; drop.innerHTML = '<div>Drop your <b>.claude</b> or <b>.codex</b> folder</div>'; document.body.appendChild(drop);
  const tag = document.createElement('div'); tag.className = 'ag-demo'; tag.hidden = true; tag.innerHTML = 'Demo team · <a href="#">connect your agents</a>'; document.body.appendChild(tag);
  tag.querySelector('a').onclick = e => { e.preventDefault(); open(); };

  function open() { card.hidden = false; }
  function close() { card.hidden = true; }
  function startDemo() { if (demoRun || api.connected.length) return; api.demo = true; tag.hidden = false; demoRun = demoFeed(emit, { agents: demoAgents }); }
  function stopDemo() { if (!demoRun) return; demoRun.stop(); demoRun = null; api.demo = false; tag.hidden = true; }
  async function connect(h, ask) {
    if (!(await permitted(h, ask))) return false;
    const w = watcher(h, emit);
    try {
      stopDemo();
      // onConnect runs before the first (catch-up) batch, so a game can reset its demo state without losing today's numbers
      const src = await w.start(s => { api.connected.push(w); onConnect && onConnect(s); });
      saved.add(h).catch(() => {});
      close(); toast(`Connected to ${src === 'codex' ? 'Codex' : 'Claude Code'}. Your agents join as they work.`);
      return true;
    } catch (e) { const i = api.connected.indexOf(w); if (i >= 0) api.connected.splice(i, 1); toast('⚠️ ' + e.message); if (!api.connected.length && autoDemo) startDemo(); return false; }
  }
  api.connectHandle = h => connect(h, false);          // for automated QA with a fake handle
  card.querySelectorAll('[data-src]').forEach(b => { b.disabled = !supported; b.onclick = async () => {
    try { await connect(await showDirectoryPicker({ id: 'riffcade-' + b.dataset.src, mode: 'read' }), true); }
    catch (e) { if (e.name !== 'AbortError') toast('⚠️ ' + (e.message || 'Could not open that folder')); }
  }; });
  card.querySelector('[data-demo]').onclick = () => { close(); startDemo(); };
  addEventListener('dragover', e => { e.preventDefault(); drop.hidden = false; });
  addEventListener('dragleave', e => { if (!e.relatedTarget) drop.hidden = true; });
  addEventListener('drop', async e => {
    e.preventDefault(); drop.hidden = true;
    const it = e.dataTransfer.items && e.dataTransfer.items[0];
    if (it && it.getAsFileSystemHandle) { const h = await it.getAsFileSystemHandle(); if (h && h.kind === 'directory') return connect(h, true); }
    toast('⚠️ Drop the folder itself (.claude or .codex), in Chrome or Edge.');
  });
  // returning players reconnect silently; otherwise the demo team plays behind the card so the game is never empty
  (async () => {
    const list = supported ? await saved.list() : [];
    let any = false; for (const h of list) if (await connect(h, false)) any = true;
    if (any) return;
    if (list.length) { const b = document.createElement('button'); b.className = 'ag-big'; b.textContent = 'Reconnect my agents'; b.onclick = async () => { for (const h of list) await connect(h, true); }; card.querySelector('.ag-btns').prepend(b); }
    if (autoDemo) startDemo();
    if (new URLSearchParams(location.search).has('demo')) close();
  })();
  return api;
}
