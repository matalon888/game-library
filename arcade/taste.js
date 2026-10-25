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
// window.ApTaste: { active(), style(), art(g), played(g, secs), chose(g), feed(all, opts), oneOfEach(all, opts), arm() }
(function () {
  if (window.ApTaste) return;
  const ART = { 'Cozy games': 'A', 'Kawaii Pop': 'B', 'Storybook Garden': 'C' };
  const NAMES = { A: 'Hero Lab 3D', B: 'Kawaii Pop', C: 'Storybook Garden' };
  const KEY = 'ap.taste', q = new URLSearchParams(location.search);
  const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const load = () => Object.assign({ a: { A: 0, B: 0, C: 0 }, k: {}, n: 0 }, get(KEY, {}));
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
  function add(g, w) {
    const s = art(g); if (!s) return;
    const p = load();
    p.a[s] = Math.max(-3, Math.min(30, p.a[s] + w));
    if (g.kind) p.k[g.kind] = Math.max(-3, Math.min(30, (p.k[g.kind] || 0) + w));
    p.n++; p.last = s; put(KEY, p);
  }
  // a finished run (diag.js): how long she stayed is the honest signal
  function played(g, secs) { if (!art(g)) return; add(g, secs >= 60 ? 2 : secs >= 25 ? 1 : secs < 15 ? -1 : 0); }
  function chose(g) { add(g, 1); }

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
  window.ApTaste = { active, style, art, played, chose, feed, oneOfEach, arm, name: s => NAMES[s] || '', profile: load };
})();
