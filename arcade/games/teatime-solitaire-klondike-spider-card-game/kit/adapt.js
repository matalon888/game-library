// Adapt — in-round difficulty + rare deserved rescues (hc-games/ADAPT_BRIEF.md). Shared by every game that adapts.
//   • reads ONLY how this player is playing right now: misses, near-misses and successes in the last ~20 s, the current
//     streak and the time since the last success. Never device, country, money or ads.
//   • struggling → level drifts toward −1, cruising (streak, no misses) → toward +1, nothing happening → back to 0.
//     It moves at most one step every few seconds, so the game never lurches. An idle player gets no adjustment.
//   • A.k(fk) = the multiplier for a "harder when bigger" knob: ±max (≤ 20%) from the level, stacked on flow.js's
//     between-run fk and clamped to ±25% in total. Easier-when-bigger knobs (gaps, time, aim window) divide by it.
//   • A.rescue(): at most one per round, only for an active player who has earned it (≥ minOk successes this round).
//     The game calls it at the moment the player is about to lose and gives a small lucky break if it returns true.
//   • never touches the score. QA reads window.__game.adapt = { level, rescues, total, k }; ?adapt=0 turns it off.
//   • off for anyone on the world race (has a board nickname: only they post scores), so ranked players all face the
//     same difficulty (RULES.md 5). Checked live, so joining mid-session switches it off from the next step.
const QOFF = /[?&]adapt=0(&|$)/.test(location.search);
export const adaptOff = () => { if (QOFF) return true; try { return !!JSON.parse(localStorage.getItem('board_profile')); } catch (e) { return false; } };
export function adapt({ max = 0.2, every = 2.5, step = 0.25, span = 20, minOk = 2, idle = 6, fresh = 4 } = {}) {
  let now = 0, lvl = 0, cap = 1, nextT = every, ev = [], streak = 0, lastOk = 0, lastIn = -1e9, oks = 0, rescues = 0, total = 0;
  const sum = k => ev.reduce((a, e) => a + (e.k === k && now - e.t < span ? e.w : 0), 0);
  const active = (s = idle) => now - lastIn < s;
  const add = (k, w) => { ev.push({ k, t: now, w }); if (ev.length > 80) ev.shift(); };
  const A = {
    // new round: the level and the last ~20 s of signals carry over (quick retries still count), the rescue and the
    // "has earned it" tally are per round. cap = the highest level allowed this round (0 on level 1: never harder there)
    round(c = 1) { cap = c; lvl = Math.min(cap, lvl); lastOk = Math.max(lastOk, now - 6); oks = 0; rescues = 0; },
    tick(sec) {
      now += sec; if (now < nextT) return; nextT = now + every;
      if (adaptOff()) { lvl = 0; return; }
      const m = sum('miss'), n = sum('near'), o = sum('ok'), stuck = now - lastOk > 12;
      const struggle = m * 0.45 + n * 0.2 + (stuck ? 0.3 : 0) - o * 0.15;   // recent successes offset recent trouble
      let tg = 0;
      if (active()) {
        if (struggle > 0) tg = -Math.min(1, struggle);
        else if (m === 0 && streak >= 3) tg = Math.min(1, (streak - 2) * 0.25);
      }
      tg = Math.min(cap, tg);
      lvl += Math.max(-step, Math.min(step, tg - lvl));
    },
    input() { lastIn = now; },
    ok(w = 1) { add('ok', w); streak += w; oks += w; lastOk = now; },
    near(w = 1) { add('near', w); },
    miss(w = 1) { add('miss', w); streak = 0; },
    k(fk = 1) { return adaptOff() ? fk : Math.max(0.75, Math.min(1.25, fk * (1 + lvl * max))); },
    rescue() {
      if (adaptOff() || rescues >= 1 || oks < minOk || !active(fresh)) return false;
      rescues++; total++; A.near(); return true;
    },
    get level() { return lvl; },
    get state() { return { level: +lvl.toFixed(2), rescues, total, k: +A.k().toFixed(3), recent: [sum('ok'), sum('near'), sum('miss')].map(v => +v.toFixed(2)), streak: +streak.toFixed(2), off: adaptOff() }; },
  };
  return A;
}

// adapter(): the event-weighted variant (cube-trek, bolt-twist, swirl-tee, flip-agent, ricochet-rex). good()/bad() moves
// in the last 20 s and time since the last success set level −1 … +1, ≤ 0.25 per 3 s, back to 0 when neutral.
// k(fk, range) = multiplier for a harder-when-bigger knob, within ±25 % together with flow.js. sensible() = the player
// has been playing well enough to earn a rescue; rescue() = at most one a round and 60 s apart. Same off-switch as adapt().
export function adapter() {
  const ev = []; let lv = 0, stepAt = 0, okAt = 0, rescues = 0, used = false, lastR = -1e9;
  const now = () => performance.now() / 1000;
  const recent = () => { const t = now(); while (ev.length && ev[0][0] < t - 20) ev.shift(); let g = 0, b = 0; for (const e of ev) e[1] > 0 ? g += e[1] : b -= e[1]; return { g, b }; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  return {
    get level() { return lv; }, get rescues() { return rescues; },
    good(w = 1) { ev.push([now(), w]); okAt = now(); },
    bad(w = 1) { ev.push([now(), -w]); },
    tick(active = true) {
      const t = now(); if (t - stepAt < 3) return; stepAt = t;
      if (adaptOff()) { lv = 0; return; }
      const { g, b } = recent(), stuck = active && okAt && t - okAt > 25;
      const want = stuck ? -1 : g + b > 0 ? clamp((g - 2 * b) / Math.max(4, g + b), -1, 1) : 0;
      lv = clamp(lv + clamp(want - lv, -0.25, 0.25), -1, 1);
    },
    k(fk = 1, range = 0.2) { return adaptOff() ? fk : clamp(fk * (1 + range * lv), 0.75, 1.25); },
    sensible(min = 3) { const { g, b } = recent(); return g >= min && g >= 0.75 * (g + b); },
    round() { used = false; okAt = now(); },
    rescue() { if (adaptOff() || used || now() - lastR < 60) return false; used = true; lastR = now(); rescues++; return true; },   // rare: ≤ 1 a round and ≥ 60 s apart
  };
}
