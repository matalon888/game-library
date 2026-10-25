// Flow — honest adaptive difficulty for the RIFFCADE originals.
// It reads only how the player has been doing (never device, country or money), and nudges one difficulty knob:
//   • warm-up: the first few points of an endless run are a little gentler, so a run never dies in the first seconds
//   • skill: players who keep doing well get up to +HARD harder, players who keep failing get up to −EASE easier
// It never rigs a single move, never forces a loss, never touches the score.
import { adaptOff } from './adapt.js';
const N = 8;                                     // runs remembered

// The tuner (arcade-api tuner.js, 2026-10-25): every night it reads real plays per game and tries one game a little harder or
// easier for half the players ("t"), keeping the change only if those players play longer than the other half ("c").
// Here: this game's factor from the last /api/tune answer (cached on the device, refreshed in the background, so the first
// visit plays at 1), the player's arm (ap.tarm, kept on the device and in their save), and the game's slug from the address.
const SLUG = (location.pathname.match(/\/games\/([^/]+)\//) || [])[1] || '';
const TARM = (() => { try { let a = localStorage.getItem('ap.tarm'); if (a !== 't' && a !== 'c') { a = Math.random() < 0.5 ? 't' : 'c'; localStorage.setItem('ap.tarm', a); } return a; } catch (e) { return 'c'; } })();
const tuned = () => { try { const g = (JSON.parse(localStorage.getItem('ap.tune') || '{}').g || {})[SLUG]; return g ? Math.max(0.8, Math.min(1.5, TARM === 't' && g.test ? g.test : g.base || 1)) : 1; } catch (e) { return 1; } };
if (SLUG && !/[?&]lbapi=/.test(location.search)) try {   // humanbot / QA runs (?lbapi=) never call out
  const c = JSON.parse(localStorage.getItem('ap.tune') || '{}');
  if (!c.at || Date.now() - c.at > 3 * 3600e3) fetch('https://mcp.riffcade.com/api/tune').then(r => r.json()).then(j => { if (j && j.g) localStorage.setItem('ap.tune', JSON.stringify({ at: Date.now(), g: j.g })); }).catch(() => {});
} catch (e) {}

export function flow(key, { par = 20, warmup = 0, hard = 0.2, ease = 0.1 } = {}) {
  const k = 'flow_' + key;
  let runs = [];
  try { runs = JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) {}
  const save = () => { try { localStorage.setItem(k, JSON.stringify(runs.slice(-N))); } catch (e) {} };
  // performance of one run in 0..1, where 0.5 is "par": an endless score of `par`, or a level that was half cleared
  const skill = () => {
    if (runs.length < 2) return 0;
    const avg = runs.reduce((a, b) => a + b, 0) / runs.length;
    return Math.max(-1, Math.min(1, (avg - 0.5) * 2.5));
  };
  return {
    get skill() { return skill(); },
    // multiplier for a "harder when bigger" knob (speed, danger density); `score` drives the warm-up of endless runs
    k(score = Infinity) {
      // RULES.md 5: players on the world race (board nickname) all get the same difficulty, so the skill nudge is off
      // for them; everyone else gets it. ?adapt=0 turns it off too.
      const s = adaptOff() ? 0 : skill(), m = (1 + (s > 0 ? s * hard : s * ease)) * (adaptOff() ? 1 : tuned());
      const w = warmup > 0 ? Math.min(1, score / warmup) : 1;
      return m * (0.85 + 0.15 * w);
    },
    endless(score) { runs.push(Math.min(1, score / (2 * par))); save(); },
    level(won, cleared = 0) { runs.push(won ? 1 : Math.min(0.5, cleared * 0.5)); save(); },
  };
}
