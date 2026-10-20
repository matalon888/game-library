// The park's sponsored pick (Daniel, 2026-10-20): one labelled card on our own home page linking to earn.html, never shown inside
// ChatGPT / Claude (embed=chat) or in the Kids corner, where ads don't belong. Offers: arcade-api offers.js.
(function () {
  const q = new URLSearchParams(location.search), el = document.getElementById('sponsor');
  if (!el || q.get('embed') === 'chat' || /kids/i.test(q.get('mode') || '') || (window.RIFFCADE || {}).SPONSOR_OFF) return;
  const u = window.RiffHabits && RiffHabits.agentCode ? RiffHabits.agentCode() : '', os = /Android/i.test(navigator.userAgent) ? 'android' : 'ios';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  fetch(`https://mcp.riffcade.com/api/offers?u=${u}&os=${os}`, { cache: 'no-store' }).then(r => r.json()).then(j => {
    const o = j.pick; if (!o) return;
    el.innerHTML = `<a class="spick" href="earn.html">${o.image ? `<img src="${esc(o.image)}" alt="">` : ''}<span><small>SPONSORED · EARN</small><b>${esc(o.title)}</b></span><em>+$${o.you_get.toFixed(2)}</em></a><a class="svip" href="vip.html">👑 VIP: every AI-only game, no ads</a>`;
  }).catch(() => {});
})();
