// Feed — turns the player's own AI agent logs into game events, entirely inside this browser tab.
//   • Claude Code writes one JSONL file per session in ~/.claude/projects/<project>/<session>.jsonl
//     (subagents in <session>/subagents/agent-*.jsonl); Codex writes ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl.
//   • The player picks that folder once (File System Access API, desktop Chrome/Edge); we re-read only the new bytes
//     of recently changed files every few seconds. Nothing is uploaded anywhere.
//   • Only tool names, token counts, timestamps and the project folder name are read. Messages and code are never kept.
// Event: { agent, parent, label, src: 'claude'|'codex', kind: 'tool'|'think'|'tokens'|'end', tool, tokens, t }

const DAY = 864e5;
const idb = (() => {
  let p;
  const db = () => p || (p = new Promise((res, rej) => { const r = indexedDB.open('deskfolk', 1); r.onupgradeneeded = () => r.result.createObjectStore('h'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('h', mode); const r = fn(t.objectStore('h')); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }); };
  return { get: k => tx('readonly', s => s.get(k)), set: (k, v) => tx('readwrite', s => s.put(v, k)), del: k => tx('readwrite', s => s.delete(k)) };
})();

export const supported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

// what kind of folder did the player give us? (they may pick ~/.claude, ~/.claude/projects, ~/.codex or ~/.codex/sessions)
async function resolveRoot(h) {
  const names = []; for await (const [n] of h.entries()) { names.push(n); if (names.length > 400) break; }
  if (names.includes('projects')) return { src: 'claude', dir: await h.getDirectoryHandle('projects') };
  if (names.includes('sessions')) return { src: 'codex', dir: await h.getDirectoryHandle('sessions') };
  if (names.some(n => /^20\d\d$/.test(n))) return { src: 'codex', dir: h };
  if (names.some(n => n.startsWith('-'))) return { src: 'claude', dir: h };
  if (names.some(n => n.endsWith('.jsonl'))) return { src: h.name.startsWith('rollout') ? 'codex' : 'claude', dir: h, flat: true };
  return null;
}

const cleanProject = s => (s.split('-').filter(Boolean).pop() || 'agent').slice(0, 18);

// parse one JSONL line into zero or more events
// a readable name for a working folder: its last part, or "home" for the home folder itself
export const folderName = cwd => { const parts = String(cwd).split(/[\\/]/).filter(Boolean); return (parts.length <= 2 && /^(Users|home)$/.test(parts[0] || '') ? 'home' : parts.pop() || 'agent').slice(0, 16); };
function parseClaude(line, meta, seen) {
  let j; try { j = JSON.parse(line); } catch (e) { return []; }
  if (j.cwd && !meta.named) { meta.label = folderName(j.cwd); meta.named = true; }
  const t = Date.parse(j.timestamp || '') || 0;
  if (!t) return [];
  const out = [];
  if (j.type === 'assistant' && j.message) {
    const m = j.message, id = m.id || j.requestId;
    for (const c of Array.isArray(m.content) ? m.content : []) {
      if (c && c.type === 'tool_use') out.push({ kind: 'tool', tool: c.name || 'tool', t });
    }
    if (!out.length) out.push({ kind: m.stop_reason === 'end_turn' ? 'done' : 'think', t });
    const u = m.usage;
    if (u && id && !seen.has(id)) { seen.add(id); out.push({ kind: 'tokens', tokens: (u.output_tokens || 0) + Math.round((u.input_tokens || 0) / 10), t }); }
  } else if (j.type === 'user' && j.message && typeof j.message.content === 'string') {
    out.push({ kind: 'prompt', t });
  }
  return out.map(e => ({ ...e, ...meta }));
}
function parseCodex(line, meta) {
  let j; try { j = JSON.parse(line); } catch (e) { return []; }
  const t = Date.parse(j.timestamp || '') || 0;
  if (!t) return [];
  const p = j.payload || {};
  if (j.type === 'response_item' && (p.type === 'function_call' || p.type === 'custom_tool_call' || p.type === 'local_shell_call'))
    return [{ kind: 'tool', tool: p.name || 'shell', t, ...meta }];
  if (j.type === 'response_item' && p.type === 'reasoning') return [{ kind: 'think', t, ...meta }];
  if (j.type === 'event_msg' && p.type === 'token_count' && p.info && p.info.last_token_usage) {
    const u = p.info.last_token_usage; return [{ kind: 'tokens', tokens: (u.output_tokens || 0) + Math.round((u.input_tokens || 0) / 10), t, ...meta }];
  }
  if (j.type === 'event_msg' && p.type === 'user_message') return [{ kind: 'prompt', t, ...meta }];
  if (j.type === 'event_msg' && p.type === 'task_complete') return [{ kind: 'done', t, ...meta }];
  if (j.type === 'turn_context' && p.cwd) meta.label = folderName(p.cwd);
  return [];
}

// walk the tree and list .jsonl files with where they belong
async function listFiles(root, src, flat) {
  const files = [];
  const now = Date.now();
  async function walk(dir, path, depth) {
    for await (const [name, h] of dir.entries()) {
      if (h.kind === 'file' && name.endsWith('.jsonl')) files.push({ h, path: path.concat(name) });
      else if (h.kind === 'directory' && depth < 5) {
        // codex: only walk the last 2 days of date folders; claude: every project
        if (src === 'codex' && /^\d+$/.test(name)) {
          const keep = path.length === 0 ? +name >= new Date(now - 2 * DAY).getFullYear()
            : path.length === 1 ? true : true;
          if (!keep) continue;
        }
        await walk(h, path.concat(name), depth + 1);
      }
    }
  }
  await walk(root, [], flat ? 5 : 0);
  return files;
}

function metaFor(src, path) {
  if (src === 'claude') {
    // projects/<proj>/<session>.jsonl  or  projects/<proj>/<session>/subagents/agent-x.jsonl
    const proj = path.length > 1 ? path[0] : 'agent';
    if (path.includes('subagents')) {
      const sess = path[path.length - 3], sub = path[path.length - 1].replace(/\.jsonl$/, '');
      return { agent: 'c:' + sub, parent: 'c:' + sess, label: cleanProject(proj), src };
    }
    const sess = path[path.length - 1].replace(/\.jsonl$/, '');
    return { agent: 'c:' + sess, parent: null, label: cleanProject(proj), src };
  }
  const f = path[path.length - 1].replace(/\.jsonl$/, '');
  return { agent: 'x:' + f.slice(-12), parent: null, label: 'codex', src };
}

// A watcher over one picked folder. onEvents(list, {backfill}) is called with new events in time order.
export function watcher(handle, onEvents, { since = Date.now() - DAY } = {}) {
  let root = null, stopped = false, timer = 0;
  const state = new Map();       // path -> { size, meta, seen, carry }
  async function readNew(f, firstPass) {
    const key = f.path.join('/');
    let file; try { file = await f.h.getFile(); } catch (e) { return []; }
    let st = state.get(key);
    if (!st) {
      st = { size: 0, meta: metaFor(root.src, f.path), seen: new Set(), carry: '' };
      state.set(key, st);
      // old files: skip their history entirely
      if (file.lastModified < since) { st.size = file.size; return []; }
    }
    if (file.size <= st.size) return [];
    // first pass on a big live file: only its last 2 MB (the past day's work is plenty)
    const from = firstPass && file.size - st.size > 2e6 ? file.size - 2e6 : st.size;
    const text = st.carry + await file.slice(from, file.size).text();
    st.size = file.size;
    const lines = text.split('\n'); st.carry = lines.pop();
    if (from > 0 && firstPass) lines.shift();   // a cut line
    const out = [];
    for (const l of lines) {
      if (!l) continue;
      const evs = root.src === 'claude' ? parseClaude(l, st.meta, st.seen) : parseCodex(l, st.meta);
      for (const e of evs) if (e.t >= since) out.push(e);
    }
    return out;
  }
  async function tick(first) {
    if (stopped) return;
    try {
      const files = await listFiles(root.dir, root.src, root.flat);
      const all = [];
      for (const f of files) all.push(...await readNew(f, first));
      all.sort((a, b) => a.t - b.t);
      if (all.length || first) onEvents(all, { backfill: first, src: root.src });
    } catch (e) { console.warn('[deskfolk] read failed', e); }
    if (!stopped) timer = setTimeout(() => tick(false), 2500);
  }
  return {
    async start() {
      root = await resolveRoot(handle);
      if (!root) throw new Error('That folder has no agent logs. Pick your .claude or .codex folder.');
      await tick(true);
      return root.src;
    },
    stop() { stopped = true; clearTimeout(timer); },
  };
}

// remembered folders (so returning players reconnect with one click)
export const saved = {
  async list() { return (await idb.get('handles')) || []; },
  async add(h) { const l = await this.list(); if (!(await Promise.all(l.map(x => x.isSameEntry(h)))).some(Boolean)) l.push(h); await idb.set('handles', l); },
  async clear() { await idb.del('handles'); },
};
export async function permitted(h, ask) {
  const o = { mode: 'read' };
  if ((await h.queryPermission(o)) === 'granted') return true;
  return ask ? (await h.requestPermission(o)) === 'granted' : false;
}

// a pretend team, so anyone can see the office before connecting (and on phones)
export function demo(onEvents) {
  const tools = ['Edit', 'Read', 'Bash', 'Grep', 'Write', 'Read', 'Edit', 'Bash', 'WebSearch', 'Glob', 'Agent'];
  const team = [{ agent: 'd:1', label: 'web-app', src: 'claude' }, { agent: 'd:2', label: 'api', src: 'codex' }, { agent: 'd:3', label: 'docs', src: 'claude' }, { agent: 'd:4', label: 'mobile', src: 'claude' }, { agent: 'd:5', label: 'infra', src: 'codex' }];
  let n = 0, subs = 0;
  const step = () => {
    const now = Date.now(), out = [];
    for (const a of team) {
      const r = Math.random();
      if (r < 0.45) {
        const tool = tools[(Math.random() * tools.length) | 0];
        out.push({ ...a, parent: a.parent || null, kind: 'tool', tool, t: now });
        if (tool === 'Agent' && subs < 3) { subs++; const s = { agent: 'd:s' + (++n), parent: a.agent, label: a.label, src: a.src }; team.push(s); setTimeout(() => { const i = team.indexOf(s); if (i >= 0) team.splice(i, 1); subs--; onEvents([{ ...s, kind: 'end', t: Date.now() }], { demo: true }); }, 9000 + Math.random() * 6000); }
      } else if (r < 0.6) out.push({ ...a, parent: a.parent || null, kind: 'think', t: now });
      else if (r > 0.97 && !a.parent) out.push({ ...a, parent: null, kind: 'done', t: now });
      if (r < 0.7) out.push({ ...a, parent: a.parent || null, kind: 'tokens', tokens: 200 + ((Math.random() * 900) | 0), t: now });
    }
    onEvents(out, { demo: true });
  };
  const id = setInterval(step, 1400); step();
  return { stop() { clearInterval(id); } };
}
