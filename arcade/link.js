#!/usr/bin/env node
// (copy of ~/arcade-api/link.js, served as riffcade.com/arcade/link.js for a short Terminal line: keep both in sync)
// RIFFCADE agent link: lets your riffcade.com "Connect your AI" games (on any device, phone included) follow what
// your Claude Code and Codex agents are doing on this computer.
//   curl -fsSL https://mcp.riffcade.com/link.js | node - <code>
// What it reads: ~/.claude/projects/**/*.jsonl and ~/.codex/sessions/**/*.jsonl (the agents' own local logs).
// What it sends (to mcp.riffcade.com, only under your private code): tool names, success or failure, token counts,
// times and the project FOLDER NAME. Never your prompts, code, file contents or commands.
// Stop it any time with Ctrl+C. It changes nothing on your computer.
const fs = require('fs'), path = require('path'), os = require('os');
const CODE = process.argv.slice(1).reverse().find(a => /^[a-z0-9]{10}$/.test(a || ''));
const API = process.env.RIFFCADE_API || 'https://mcp.riffcade.com';
if (!CODE) { console.log('Usage: curl -fsSL https://mcp.riffcade.com/link.js | node - <your 10-letter code from the game>'); process.exit(1); }
const ROOTS = [['claude', path.join(os.homedir(), '.claude', 'projects')], ['codex', path.join(os.homedir(), '.codex', 'sessions')]];
const DAY = 864e5, since = Date.now() - DAY;

const TEST = /\b(pytest|jest|vitest|mocha|playwright test|cargo test|go test|npm (run )?test|pnpm (run )?test|yarn test|bun test|rspec|phpunit|unittest)\b/i;
const COMMIT = /\bgit (commit|merge|rebase)\b/i, DEPLOY = /\b(git push|deploy|vercel|wrangler|railway up|fly deploy|netlify|firebase deploy|--push)\b/i;
function category(tool, cmd = '') {
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
// readable names for the player: the project folder; "home folder" for the home folder; ".claude" → "claude settings"
const folderName = cwd => {
  const p = String(cwd).split(/[\\/]/).filter(Boolean);
  if (p.length <= 2 && /^(Users|home)$/.test(p[0] || '')) return 'home folder';
  let f = p.pop() || 'agent';
  // agents' temp folders are named after an encoded path ("-Users-me-my-app"): decode to the project
  if (/^-(Users|home)-/.test(f)) { const q = f.split('-').filter(Boolean); if (q.length <= 2) return 'home folder'; f = q.pop(); }
  if (/^\.(claude|codex)$/i.test(f)) return f.slice(1).toLowerCase() + ' settings';
  return f.replace(/^\./, '').slice(0, 16);
};
const FAIL = /exit code:? *[1-9]|\btraceback\b|\berror:|\bfailed\b|command not found|\bexception\b/i;

function parseClaude(line, st) {
  let j; try { j = JSON.parse(line); } catch (e) { return []; }
  if (j.cwd && !st.named) { st.meta.label = folderName(j.cwd); st.named = true; }
  const t = Date.parse(j.timestamp || '') || 0; if (!t) return [];
  const out = [], m = j.message;
  if (j.type === 'assistant' && m) {
    for (const c of Array.isArray(m.content) ? m.content : []) if (c && c.type === 'tool_use') {
      const cat = category(c.name, c.input && (c.input.command || c.input.cmd) || ''); if (c.id) st.calls.set(c.id, cat);
      out.push({ kind: 'tool', tool: c.name || 'tool', cat, t });
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
function parseCodex(line, st) {
  let j; try { j = JSON.parse(line); } catch (e) { return []; }
  const t = Date.parse(j.timestamp || '') || 0; if (!t) return [];
  const p = j.payload || {};
  if (j.type === 'turn_context' && p.cwd) { st.meta.label = folderName(p.cwd); return []; }
  if (j.type === 'response_item') {
    if (p.type === 'function_call' || p.type === 'custom_tool_call' || p.type === 'local_shell_call') {
      let cmd = ''; try { const a = typeof p.arguments === 'string' ? JSON.parse(p.arguments) : p.arguments || {}; cmd = [].concat(a.cmd || a.command || a.code || '').join(' '); } catch (e) {}
      if (!cmd && typeof p.input === 'string') cmd = p.input;
      const cat = category(p.name || 'shell', cmd); if (p.call_id) st.calls.set(p.call_id, cat);
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
function metaFor(src, rel) {
  const parts = rel.split(path.sep);
  if (src === 'claude') {
    const proj = parts.length > 1 ? parts[0] : 'agent', label = (proj.split('-').filter(Boolean).pop() || 'agent').slice(0, 16);
    if (parts.includes('subagents')) return { agent: 'c:' + parts[parts.length - 1].replace(/\.jsonl$/, ''), parent: 'c:' + parts[parts.length - 3], label, src };
    return { agent: 'c:' + parts[parts.length - 1].replace(/\.jsonl$/, ''), parent: null, label, src };
  }
  return { agent: 'x:' + parts[parts.length - 1].replace(/\.jsonl$/, '').slice(-12), parent: null, label: 'codex', src };
}
function walk(dir, out = [], depth = 0) {
  let list = []; try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const d of list) {
    const p = path.join(dir, d.name);
    if (d.isDirectory() && depth < 5) walk(p, out, depth + 1);
    else if (d.isFile() && d.name.endsWith('.jsonl')) out.push(p);
  }
  return out;
}
const state = new Map();
function readNew(src, root, file, first) {
  let stat; try { stat = fs.statSync(file); } catch (e) { return []; }
  let st = state.get(file);
  if (!st) {
    const rel = path.relative(root, file);
    st = { size: 0, meta: metaFor(src, rel), seen: new Set(), calls: new Map(), carry: '', sub: rel.includes('subagents') };
    state.set(file, st);
    if (stat.mtimeMs < since) { st.size = stat.size; return []; }
  }
  if (stat.size <= st.size) return [];
  const from = first && stat.size - st.size > 2e6 ? stat.size - 2e6 : st.size;
  const fd = fs.openSync(file, 'r'), buf = Buffer.alloc(stat.size - from); fs.readSync(fd, buf, 0, buf.length, from); fs.closeSync(fd);
  st.size = stat.size;
  const lines = (st.carry + buf.toString('utf8')).split('\n'); st.carry = lines.pop();
  if (from > 0 && first) lines.shift();
  const out = [];
  for (const l of lines) if (l) for (const e of (src === 'claude' ? parseClaude : parseCodex)(l, st)) if (e.t >= since) out.push({ ...e, ...st.meta });
  return out;
}
let sent = 0, failures = 0, linked = false;
const have = ROOTS.filter(([, r]) => fs.existsSync(r)).map(([s]) => s === 'claude' ? 'Claude Code' : 'Codex');
console.log('RIFFCADE link · connecting your agents…');
const queue = [];
const agentsSeen = new Set();
async function post(events, backfill) {
  for (let i = 0; i < events.length || (backfill && i === 0); i += 1000) {
    const chunk = events.slice(i, i + 1000);
    const r = await fetch(`${API}/api/link/${CODE}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ events: chunk, backfill }) });
    if (!r.ok) throw new Error('server said ' + r.status);
    if (!events.length) break;
  }
}
async function tick(first) {
  const all = [];
  for (const [src, root] of ROOTS) for (const f of walk(root)) all.push(...readNew(src, root, f, first));
  all.sort((a, b) => a.t - b.t);
  queue.push(...all); if (queue.length > 50000) queue.splice(0, queue.length - 50000);   // kept until the server has them
  if (queue.length || first) {
    const batch = queue.slice();
    try {
      await post(batch, first || !linked); queue.splice(0, batch.length); sent += batch.length; failures = 0; batch.forEach(e => agentsSeen.add(e.agent));
      if (!linked) { linked = true; console.log(`\n✅ Linked! Following ${have.join(' + ') || 'your agents'}. Your game shows them in a few seconds.\n   Keep this window open while you play. Ctrl+C stops it. Only counts are sent, never prompts or code.`); }
    }
    catch (e) { if (++failures === 1) console.log('\n⚠️  Could not reach riffcade.com (' + e.message + '). Retrying…'); }
  }
  if (first && !have.length) console.log('⚠️  No Claude Code or Codex logs found on this computer yet (looked in ~/.claude and ~/.codex). Start an agent and they will show up.');
  if (linked) process.stdout.write(`\r   ${sent} agent events sent · ${agentsSeen.size} agent sessions today   `);
  setTimeout(() => tick(false), 2000);
}
if (typeof fetch !== 'function') { console.log('This needs Node 18 or newer. Update Node (https://nodejs.org) or use the folder option in the game.'); process.exit(1); }
tick(true);
