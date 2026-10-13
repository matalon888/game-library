#!/usr/bin/env bash
# POST a single event TYPE to the Bonk Box desktop app.
#
# This is the only thing that ever crosses localhost: one word from a fixed
# list. No prompt text, no tool output, no paths. Fails silently and fast so a
# closed app can never slow a coding session down.
type="${1:-bonk}"
port="${BONK_BOX_PORT:-48222}"
config="$HOME/.config/bonk-box/config.json"
state_dir="$HOME/.config/bonk-box"

# Leave a note next to the app rather than only shouting at it. The statusline
# reads this, so he still reacts in your terminal when the desktop box is shut.
# One event type and a timestamp, the same single word that crosses localhost -
# no prompt text has ever been in this script's hands to write down.
#
# Written to a temporary name and moved into place, because the statusline can
# read this at any moment and half a line of JSON is worse than none.
if mkdir -p "$state_dir" 2>/dev/null; then
  tmp="$state_dir/.session-state.$$"
  if printf '{"event":"%s","ts":%s}\n' "$type" "$(date +%s)" > "$tmp" 2>/dev/null; then
    mv -f "$tmp" "$state_dir/session-state.json" 2>/dev/null || rm -f "$tmp" 2>/dev/null
  else
    rm -f "$tmp" 2>/dev/null
  fi
fi

if [ -z "${BONK_BOX_PORT:-}" ] && [ -f "$config" ]; then
  from_config=$(sed -n 's/.*"port"[[:space:]]*:[[:space:]]*\([0-9]\{1,5\}\).*/\1/p' "$config" | head -1)
  [ -n "$from_config" ] && port="$from_config"
fi
curl -s -o /dev/null --max-time 1 \
  -X POST "http://127.0.0.1:${port}/event" \
  -H 'Content-Type: application/json' \
  -d "{\"type\":\"${type}\"}" 2>/dev/null || true
exit 0
