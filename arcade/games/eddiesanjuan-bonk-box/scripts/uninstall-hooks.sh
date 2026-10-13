#!/usr/bin/env bash
# Remove the Bonk Box hooks and nothing else.
set -euo pipefail

SETTINGS="$HOME/.claude/settings.json"
BIN="$HOME/.local/bin"
say() { printf '\033[1m[bonk box]\033[0m %s\n' "$1"; }

[ -f "$SETTINGS" ] || { say "no settings.json, nothing to undo"; exit 0; }
command -v node >/dev/null 2>&1 || { echo "needs node" >&2; exit 1; }

BACKUP="$SETTINGS.bonk-backup.$(date +%Y%m%d-%H%M%S)"
cp "$SETTINGS" "$BACKUP"
say "backed up your settings to $(basename "$BACKUP")"

node - "$SETTINGS" <<'NODE'
const fs = require('fs');
const file = process.argv[2];
const settings = JSON.parse(fs.readFileSync(file, 'utf8'));
const MARK = 'bonk-box/hooks/';
let removed = 0;

for (const event of Object.keys(settings.hooks || {})) {
  const groups = settings.hooks[event];
  if (!Array.isArray(groups)) continue;
  for (const group of groups) {
    const before = (group.hooks || []).length;
    // Drop only our commands. Anything sharing the group survives.
    group.hooks = (group.hooks || []).filter(
      (h) => !(typeof h.command === 'string' && h.command.includes(MARK))
    );
    removed += before - group.hooks.length;
  }
  // Clear out groups we emptied, and events we emptied.
  settings.hooks[event] = groups.filter((g) => (g.hooks || []).length > 0);
  if (settings.hooks[event].length === 0) delete settings.hooks[event];
}

fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
console.log(removed ? `removed ${removed} hook(s)` : 'nothing of ours was installed');
NODE

# Put the status line back exactly as it was, from what we recorded.
STATE_DIR="$HOME/.config/bonk-box"
node - "$SETTINGS" "$STATE_DIR/statusline.json" <<'NODE'
const fs = require('fs');
const [file, record] = process.argv.slice(2);
const settings = JSON.parse(fs.readFileSync(file, 'utf8'));
const cur = settings.statusLine;

if (!cur || typeof cur.command !== 'string' || !cur.command.includes('bonk-statusline')) {
  console.log('the status line was not ours, leaving it alone');
} else if (fs.existsSync(record)) {
  const saved = JSON.parse(fs.readFileSync(record, 'utf8'));
  if (saved.original) settings.statusLine = saved.original;
  else delete settings.statusLine;
  fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
  fs.unlinkSync(record);
  try { fs.unlinkSync(record.replace('statusline.json', 'statusline-wrapped')); } catch (e) {}
  console.log(saved.original ? 'put your status line back' : 'removed the status line we added');
} else {
  // No record: we cannot know what was there, so say so rather than guess.
  console.log('WARNING: our status line is set but the record of yours is gone.');
  console.log('Leaving it in place - set statusLine in settings.json by hand.');
}
NODE

rm -f "$BIN/bonk" && say "removed the 'bonk' command"
say "done. Restart Claude Code for it to take effect."
