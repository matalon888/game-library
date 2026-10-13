/* ============================================================
   share.js — Wordle-style shareable result text + clipboard.
   Produces a compact, emoji-flavored summary (plus an optional
   downsampled minefield silhouette) that pastes nicely anywhere.
   ============================================================ */

import { formatTime } from "./timer.js";
import { isMine } from "./board.js";

/**
 * Build the share string.
 * @param {object} r result context
 * @param {Engine} [engine] finished engine, for the minimap silhouette
 */
export function buildShare(r, engine) {
  const lines = [];
  const tag = r.daily ? `Daily ${r.dailyKey}` : (r.title || "Custom");
  lines.push(`Caldera Minesweeper — ${tag}`);

  if (r.won) {
    lines.push(`🟩 Cleared in ${formatTime(r.timeMs)}`);
    const bits = [];
    if (r.threeBV) bits.push(`3BV ${r.threeBV}`);
    if (r.threeBVps != null) bits.push(`${r.threeBVps.toFixed(2)}/s`);
    if (r.efficiency != null) bits.push(`${Math.round(r.efficiency * 100)}% eff`);
    if (bits.length) lines.push(`⏱ ${bits.join(" · ")}`);
    if (r.noGuess) lines.push("🧠 No-guess");
    if (r.streak >= 2) lines.push(`🔥 ${r.streak} win streak`);
  } else {
    lines.push("💥 Boom — hit a mine");
  }

  if (engine && engine.width <= 30) {
    const map = minimap(engine);
    if (map) lines.push("", map);
  }
  return lines.join("\n");
}

/** Downsample the board to a small emoji silhouette of the minefield. */
function minimap(engine) {
  const { width, height } = engine;
  const cols = Math.min(width, 12);
  const rows = Math.max(1, Math.round((height / width) * cols));
  const out = [];
  for (let ry = 0; ry < rows; ry++) {
    let line = "";
    for (let rx = 0; rx < cols; rx++) {
      const x0 = Math.floor((rx / cols) * width);
      const x1 = Math.max(x0 + 1, Math.floor(((rx + 1) / cols) * width));
      const y0 = Math.floor((ry / rows) * height);
      const y1 = Math.max(y0 + 1, Math.floor(((ry + 1) / rows) * height));
      let mine = false;
      for (let y = y0; y < y1 && !mine; y++)
        for (let x = x0; x < x1; x++)
          if (isMine(engine.state, y * width + x)) { mine = true; break; }
      line += mine ? "💣" : "🟦";
    }
    out.push(line);
  }
  return out.join("\n");
}

/** Copy text to the clipboard, with a legacy fallback. Resolves to bool. */
export async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}
