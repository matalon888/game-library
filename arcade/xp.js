// First-play A/B tests (2026-10-26, arcade-api xplab.js). window.APX.on('<test-name>') is true for half of the players: the
// same coin as the server's xpOn(name, code) (FNV-1a high bit over "name:code"), so the lab knows every player's arm without
// logging it, and each test splits players independently of every other test. Needs ap.u (habits.js, loaded before this).
// Games use hc-games/kit/xp.js (same function). Register every test with POST /api/xp-start before relying on its numbers.
(function () {
  const code = () => { try { return (window.RiffHabits && RiffHabits.agentCode && RiffHabits.agentCode()) || localStorage.getItem('ap.u') || ''; } catch (e) { return ''; } };
  const on = name => { const c = code(); if (!c) return false; let h = 0x811c9dc5; for (const ch of name + ':' + c) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return ((h >>> 24) & 1) === 1; };
  window.APX = { on };
})();
