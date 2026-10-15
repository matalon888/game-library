// Flow — honest adaptive difficulty for the RIFFCADE originals.
// It reads only how the player has been doing (never device, country or money), and nudges one difficulty knob:
//   • warm-up: the first few points of an endless run are a little gentler, so a run never dies in the first seconds
//   • skill: players who keep doing well get up to +HARD harder, players who keep failing get up to −EASE easier
// It never rigs a single move, never forces a loss, never touches the score.
const N = 8;                                     // runs remembered

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
      const s = skill(), m = 1 + (s > 0 ? s * hard : s * ease);
      const w = warmup > 0 ? Math.min(1, score / warmup) : 1;
      return m * (0.85 + 0.15 * w);
    },
    endless(score) { runs.push(Math.min(1, score / (2 * par))); save(); },
    level(won, cleared = 0) { runs.push(won ? 1 : Math.min(0.5, cleared * 0.5)); save(); },
  };
}
