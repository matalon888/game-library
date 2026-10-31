// First-play A/B tests inside a game: ab('<test-name>') is true for half of the players (same coin as arcade/xp.js and the
// server's xpOn; see arcade-api xplab.js). Register the test with POST /api/xp-start. Outside the arcade (no player code) = false.
export function ab(name) {
  let c = ''; try { c = localStorage.getItem('ap.u') || ''; } catch (e) {}
  if (!c) return false;
  let h = 0x811c9dc5; for (const ch of name + ':' + c) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return ((h >>> 24) & 1) === 1;
}
