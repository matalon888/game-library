// A player's art style and favourite kinds of game, so the women's games come to her in the look she likes.
// The 43 women's games come in three art styles (games.json tags): Cozy games = Hero Lab 3D (A, women 25–54), Kawaii Pop (B,
// Gen Z), Storybook Garden (C, 50+). Each also has a `kind` (match3, mahjong, words…, hc-games/publish.py KIND).
// What we learn from, all on this device (localStorage ap.taste, synced with her other saves by save.js):
// - ?st=a|b|c on an ad's link (a creative made in that style) — a strong first guess;
// - every game she plays: a minute or more counts for its style and kind, leaving within 15 s counts against;
// - a game she picks from the end-of-round choices or the Next button.
// Until her style is clear (it must lead the others), the choices show one game of each style, so one tap teaches us.
// Women's ad visitors (ap.aud = f), and anyone who has played a women's game, get these games first in the feed.
// A test: half of new women visitors (ap.tst = style) get the style flow, half the old feed (base), counted in diag runs.
// Everyone else too (every game, not only the women's): each play teaches her categories, collections (tags), kinds and the
// game itself, newest plays weighing most (older scores fade 3% per signal). like(g) is how much she will probably like a game,
// rank(list) sorts a shelf by it on top of the Park score: games like the ones she stays in rise, ones she left in seconds sink.
// window.ApTaste: { active(), style(), art(g), played(g, secs), chose(g), tap(g, skipped), like(g), rank(list, base), warm(),
//   feed(all, opts), oneOfEach(all, opts), arm() }
(function () {
  if (window.ApTaste) return;
  const ART = { 'Cozy games': 'A', 'Kawaii Pop': 'B', 'Storybook Garden': 'C' };
  const NAMES = { A: 'Hero Lab 3D', B: 'Kawaii Pop', C: 'Storybook Garden' };
  const KEY = 'ap.taste', q = new URLSearchParams(location.search);
  const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const load = () => Object.assign({ a: { A: 0, B: 0, C: 0 }, k: {}, n: 0, c: {}, t: {}, g: {}, m: 0 }, get(KEY, {}));
  const art = g => { for (const t of (g && g.tags) || []) if (ART[t]) return ART[t]; return null; };

  // the 50/50 test, decided once per device for women's ad visitors
  function arm() {
    let a = null; try { a = localStorage.getItem('ap.tst'); } catch (e) {}
    if (a !== 'style' && a !== 'base') { a = Math.random() < 0.5 ? 'style' : 'base'; try { localStorage.setItem('ap.tst', a); } catch (e) {} }
    return a;
  }
  const st = (q.get('st') || '').toUpperCase();
  if (/^[ABC]$/.test(st)) { const p = load(); if (!p.ad) { p.a[st] += 3; p.ad = st; put(KEY, p); } }

  function style(p = load()) {
    const s = Object.entries(p.a).sort((x, y) => y[1] - x[1]);
    return s[0][1] >= 2 && s[0][1] - s[1][1] >= 1 ? s[0][0] : null;
  }
  function women() { let a = null; try { a = localStorage.getItem('ap.aud'); } catch (e) {} return a === 'f' || load().n > 0; }
  function active() {
    if (q.get('taste') === '0') return false;
    if (/^[ABC]$/.test(st) || load().n > 0) return true;   // a style ad, or she already played one: always on
    return women() && arm() === 'style';
  }
  const clamp = v => Math.max(-6, Math.min(30, Math.round(v * 100) / 100));
  const bump = (o, k, w) => { if (k) o[k] = clamp((o[k] || 0) + w); };
  const fade = o => { for (const k in o) { o[k] = Math.round(o[k] * 97) / 100; if (Math.abs(o[k]) < 0.05) delete o[k]; } };
  // what she plays, in every game: category, collections, kind, the game itself (all = false: only the general part)
  function learn(p, g, w, wg) {
    [p.c, p.t, p.g, p.k].forEach(fade);
    bump(p.c, g.category || 'Arcade', w);
    for (const t of g.tags || []) bump(p.t, t, t === 'Hyper-casual' ? w * 0.2 : w);   // on 3 in 4 games: says little
    bump(p.k, g.kind, w);
    bump(p.g, g.slug, wg == null ? w : wg);
    p.m = (p.m || 0) + 1;
  }
  function add(g, w) {
    if (!g) return;
    const p = load(), s = art(g);
    learn(p, g, w);
    if (s) { p.a[s] = Math.max(-3, Math.min(30, p.a[s] + w)); p.n++; p.last = s; }
    put(KEY, p);
  }
  // a finished run (diag.js): how long she stayed is the honest signal
  function played(g, secs) { add(g, secs >= 180 ? 3 : secs >= 60 ? 2 : secs >= 25 ? 1 : secs < 15 ? -1 : 0); }
  function chose(g) { add(g, 1); }
  // a card tapped on the home page: a small vote for its kind of game; the ones shown just before it and passed over, a tiny one against
  function tap(g, skipped = []) {
    if (!g) return;
    const p = load();
    learn(p, g, 0.5, 0);
    for (const x of skipped.slice(0, 6)) bump(p.g, x.slug, -0.15);
    put(KEY, p);
  }
  const warm = (p = load()) => (p.m || 0) > 0 || !!style(p);
  // how much she'll probably like g, about -6..6 (0 = we know nothing)
  function like(g, p = load(), s = style(p)) {
    let r = (p.c[g.category || 'Arcade'] || 0) * 1.2 + (p.k[g.kind] || 0) * 1.2;
    const tg = (g.tags || []).filter(t => t in p.t);
    if (tg.length) r += tg.reduce((n, t) => n + p.t[t], 0) / Math.sqrt(tg.length);
    const a = art(g); if (s && a) r += a === s ? 4 : -1;
    const own = p.g[g.slug] || 0;
    r += own < 0 ? own * 3 : own * 0.6;                 // left it in seconds: it sinks; loved it: stays near the top
    if (!own && r > 0) r += 0.5;                        // like her games but not played yet: a little lift
    return 6 * Math.tanh(r / 8);
  }
  // a shelf in her order: base(g) (the Park score, 0-10) + like(g); a cold visitor keeps the plain order
  function rank(list, base = () => 0) {
    const p = load(); if (!warm(p)) return list.slice();
    const s = style(p);
    return list.map((g, i) => [(base(g) || 0) + like(g, p, s) - i * 1e-6, g]).sort((x, y) => y[0] - x[0]).map(x => x[1]);
  }

  const okFor = (g, o) => !g.external && !g.linkout && g.category !== 'Kids' && !(o.phone && (g.platform === 'desktop' || g.orientation === 'landscape'));
  // her games: her style first (all three while it's unclear), favourite kinds first, then a kind she hasn't tried, unplayed first
  function feed(all, o = {}) {
    const p = load(), s = style(p), seen = new Set(o.seen || []);
    const score = g => {
      const a = art(g); if (!a) return -1e9;
      return (s ? (a === s ? 100 : p.a[a] * 3) : p.a[a] * 3) + (p.k[g.kind] || 0) * 4 + (g.kind && !(g.kind in p.k) ? 2 : 0)
        - (seen.has(g.slug) ? 50 : 0) + Math.random() * 3;
    };
    return all.filter(g => art(g) && okFor(g, o)).map(g => [score(g), g]).sort((x, y) => y[0] - x[0]).map(x => x[1]);
  }
  // one game of each style (best kind for her in each), for the choice that teaches us her style
  function oneOfEach(all, o = {}) {
    const f = feed(all, o), out = [];
    for (const s of ['A', 'B', 'C']) { const g = f.find(x => art(x) === s && !(o.seen || []).includes(x.slug)); if (g) out.push(g); }
    return out;
  }
  window.ApTaste = { active, style, art, played, chose, tap, like, rank, warm, feed, oneOfEach, arm, name: s => NAMES[s] || '', profile: load };
})();
