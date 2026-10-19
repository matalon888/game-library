// Daily — the return-and-share layer for the RIFFCADE originals (no ads, no tracking, no notifications).
//   • daily streak: counts consecutive days the player opened this game, shown on the start card
//   • daily challenge: ?daily=1 plays today's seed — the same level for everyone today
//   • challenge links: "beat my score" links carry ?beat=<score>; the receiver sees the target on the start card
//   • ask after a win only: a Share button appears on the win card (and on a new best), never after a loss
const day = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const Q = new URLSearchParams(location.search);

export function daily(key, ui, { name = document.title } = {}) {
  const k = 'daily_' + key, get = (n, d) => { try { const v = localStorage.getItem(k + n); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  const put = (n, v) => { try { localStorage.setItem(k + n, JSON.stringify(v)); } catch (e) {} };
  // streak: yesterday → +1, today → same, older → back to 1
  const today = day(), y = new Date(); y.setDate(y.getDate() - 1);
  let last = get('last', 0), streak = get('streak', 0);
  if (last !== today) { streak = last === day(y) ? streak + 1 : 1; put('last', today); put('streak', streak); }
  const isDaily = Q.get('daily') === '1', beat = +Q.get('beat') || 0;
  // start card line: challenge target first, then streak
  const line = beat ? `Beat ${beat}!` : streak > 1 ? `🔥 ${streak}-day streak` : isDaily ? `Daily challenge` : '';
  if (line && ui) { const p = document.createElement('p'); p.textContent = line; ui.els.start.querySelector('h1').after(p); }

  async function share(score, label = 'scored') {
    const u = new URL(location.href); u.search = ''; u.searchParams.set('beat', score);
    const text = `I ${label} ${score} in ${name}. Beat it?`;
    try { if (navigator.share) return await navigator.share({ title: name, text, url: u.href }); } catch (e) { return; }
    try { await navigator.clipboard.writeText(`${text} ${u.href}`); ui && ui.pop('Link copied!', '#fff', 28, 30); } catch (e) {}
  }
  // the Share button lives on the win card; it eats its own tap so the card doesn't advance
  let btn = null;
  if (ui) {
    btn = document.createElement('button'); btn.className = 'hc-btn'; btn.textContent = 'Share'; btn.style.marginTop = '8px';
    btn.addEventListener('pointerdown', e => e.stopPropagation());
    ui.els.win.querySelector('[data-x]').after(btn);
  }
  let shareScore = 0, shareLabel = 'scored';
  if (btn) btn.addEventListener('click', e => { e.stopPropagation(); share(shareScore, shareLabel); });
  return {
    streak, isDaily, beat,
    seed: isDaily ? today : null,                  // use as the level seed when set: same level for everyone today
    won(score, label = 'scored') { shareScore = score; shareLabel = label; },   // call on win, before ui.win()
    beaten: (score) => beat > 0 && score > beat,     // true once the challenge target is passed (pop a "BEATEN!" moment)
    share,
  };
}
