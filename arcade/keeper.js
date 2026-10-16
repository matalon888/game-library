// The Park Keeper: a small chat on the library page where players report issues or suggest ideas.
// Messages go to arcade-api /api/feedback (feedback.js there); Daniel gets them on Telegram once a day.
(() => {
  const API = 'https://mcp.riffcade.com/api/feedback';
  if (document.documentElement.classList.contains('embed')) return;   // never inside the ChatGPT/Claude widget
  const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const plat = /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'ios' : /Android/.test(navigator.userAgent) ? 'android' : /Mac/.test(navigator.platform) ? 'mac' : /Win/.test(navigator.platform) ? 'windows' : 'other';

  const root = el('div', 'kp');
  root.innerHTML = `
    <div class="kp-panel" role="dialog" aria-label="Talk to the Park Keeper" hidden>
      <div class="kp-head"><div class="kp-ava" aria-hidden="true"></div><div><b>The Park Keeper</b><small>Reads every note. Tells only the builders.</small></div>
        <button class="kp-x" type="button" aria-label="Close">×</button></div>
      <div class="kp-log" aria-live="polite"></div>
      <form class="kp-form" novalidate>
        <div class="kp-row"><textarea rows="1" maxlength="2000" placeholder="Tell the keeper…" aria-label="Your message"></textarea>
          <button class="kp-send" type="submit" aria-label="Send" disabled><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M13 6l6 6-6 6"/></svg></button></div>
        <input type="email" maxlength="120" placeholder="Email, if you'd like a reply (optional)" aria-label="Email for a reply (optional)" autocomplete="email">
        <input class="kp-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        <p class="kp-note">No account needed. We don't see who you are unless you leave an email.</p>
      </form>
    </div>
    <button class="kp-btn" type="button" aria-label="Report a problem or suggest an idea" aria-expanded="false"><i></i><i></i><i></i></button>`;
  document.body.appendChild(root);

  const panel = root.querySelector('.kp-panel'), btn = root.querySelector('.kp-btn'), log = root.querySelector('.kp-log');
  const form = root.querySelector('form'), ta = form.querySelector('textarea'), mail = form.querySelector('input[type=email]'), hp = form.querySelector('.kp-hp'), send = form.querySelector('.kp-send');
  let kind = null, started = false, busy = false;

  const scroll = () => { log.scrollTop = log.scrollHeight; };
  const say = (who, text) => { const m = el('div', 'kp-m ' + who); m.textContent = text; log.appendChild(m); scroll(); return m; };
  const typing = () => { const d = el('div', 'kp-m k kp-dots', '<span></span><span></span><span></span>'); log.appendChild(d); scroll(); return d; };
  const keeper = (text, wait = 650) => new Promise(r => { const d = typing(); setTimeout(() => { d.remove(); say('k', text); r(); }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : wait); });

  const PROMPTS = {
    issue: "Ugh, sorry. Which game, and what happened? (What you tapped, what broke, phone or computer, all helps.)",
    idea: "I love these. What should the park have?",
    other: "Go on, I'm all ears. Well, all hat.",
  };
  function chips() {
    const c = el('div', 'kp-chips');
    [['issue', '🐞 Something’s broken'], ['idea', '💡 I have an idea'], ['other', '💬 Just saying']].forEach(([k, label]) => {
      const b = el('button', '', label); b.type = 'button';
      b.onclick = async () => { kind = k; c.remove(); say('u', label); await keeper(PROMPTS[k], 550); ta.focus(); };
      c.appendChild(b);
    });
    log.appendChild(c); scroll();
  }
  async function greet() {
    started = true;
    await keeper("Psst. I'm the Park Keeper. 🎩", 450);
    await keeper("Found a broken game? Got an idea for the park? Tell me. The builders read every note, every morning.", 800);
    chips();
  }

  function open() {
    panel.hidden = false; root.classList.add('open'); btn.setAttribute('aria-expanded', 'true');
    root.querySelector('.kp-hint')?.remove(); ls.set('ap.kp.seen', '1');
    if (!started) greet(); else setTimeout(() => ta.focus(), 50);
  }
  function close() { panel.hidden = true; root.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
  btn.onclick = () => (panel.hidden ? open() : close());
  root.querySelector('.kp-x').onclick = close;
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) close(); });
  document.addEventListener('pointerdown', e => { if (!panel.hidden && !root.contains(e.target)) close(); });

  const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(130, ta.scrollHeight) + 'px'; send.disabled = busy || ta.value.trim().length < 3; };
  ta.addEventListener('input', grow);
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const text = ta.value.trim();
    if (busy || text.length < 3) return;
    busy = true; send.disabled = true;
    root.querySelector('.kp-chips')?.remove();
    say('u', text); ta.value = ''; grow();
    const d = typing();
    let ok = false;
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        kind: kind || 'other', text, contact: mail.value.trim() || null, hp: hp.value || null, page: location.pathname, u: ls.get('ap.u'), plat }) });
      ok = r.ok;
      if (r.status === 429) { d.remove(); say('k', "Whoa, that's a lot of notes. Give me a minute to catch up and try again."); busy = false; grow(); return; }
    } catch (err) {}
    d.remove();
    if (ok) {
      say('k', kind === 'issue' ? "Got it. It's in my hat 🎩 The builders see it first thing tomorrow." :
        kind === 'idea' ? "Ooh. Tucked into my hat 🎩 The builders read ideas every morning." : "Noted, and tucked into my hat 🎩 Thanks for telling me.");
      setTimeout(() => say('k', mail.value.trim() ? "And you left an email, so you might hear back. Anything else?" : "Anything else? Type away."), 900);
      kind = null;
    } else {
      say('k', "Hmm, my message didn't get through. Check your connection and try again?");
      ta.value = text; grow();
    }
    busy = false; grow();
  });

  // a one-time hint, a few seconds in, so people know the keeper exists
  // (waits while the privacy popup or another sheet is up, and gives up after a minute)
  const hint = (tries = 0) => {
    if (ls.get('ap.kp.seen') || !panel.hidden || tries > 12) return;
    if (document.documentElement.classList.contains('rc-lock') || document.querySelector('.isheet, .g-sub, .g-ad-full')) return setTimeout(() => hint(tries + 1), 5000);
    const h = el('div', 'kp-hint', 'Something broken? <b>Tell the keeper.</b>');
    h.onclick = open; root.appendChild(h); ls.set('ap.kp.seen', '1');
    setTimeout(() => h.remove(), 7000);
  };
  setTimeout(hint, 6000);
})();
