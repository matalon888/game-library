// AGENTPARK ad attribution (our own Meta Conversions API, arcade-api capi.js). Loaded after consent.js + habits.js.
// - Arriving from a Meta ad (?fbclid=): the click id is kept on this device (Meta's own _fbc format) and linked on our server
//   to this visitor's prompt code (RiffHabits.agentCode, the ?u= in their AI prompt), so a game their AI opens later, from any
//   browser, is credited to the ad.
// - ApAttrib.conv(event, data, eid): a conversion (game start…) sent to our server, which passes it to Meta with the same
//   eid as the browser pixel (Meta counts it once). Only where tracking is on (Accept, or the US default in consent.js),
//   never on Kids games, never in the chat versions.
// - ApAttrib.fromAd(): this tab arrived from an ad (used by park.js / landing to open a game straight away).
(function () {
  const q = new URLSearchParams(location.search);
  if (q.get('embed') === 'chat') return;
  const API = 'https://mcp.riffcade.com';
  const RC = window.RiffConsent || { accepted: () => false };
  const RH = window.RiffHabits || null;
  const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const sget = k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
  const sset = (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} };
  const post = (p, b) => fetch(API + p, { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).catch(() => {});
  const cookie = n => (document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]+)')) || [])[1] || null;

  const fbclid = q.get('fbclid');
  const adTab = !!fbclid || /^(meta|facebook|instagram|fb|ig)$/i.test(q.get('utm_source') || '');
  if (adTab) sset('ap.fromAd', '1');
  if (fbclid && /^[\w-]{10,500}$/.test(fbclid)) {
    const old = get('ap.fbc');
    if (!old || !old.endsWith('.' + fbclid)) set('ap.fbc', 'fb.1.' + Date.now() + '.' + fbclid);
    set('ap.ad', JSON.stringify({ campaign: q.get('utm_campaign'), term: q.get('utm_term'), content: q.get('utm_content') }));
  }
  // a game link from the visitor's AI chat carries their code (?apu=): use it for this tab's conversions
  if (/^[a-z0-9]{10}$/.test(q.get('apu') || '')) sset('ap.u', q.get('apu'));
  const code = () => sget('ap.u') || (RH && RH.agentCode ? RH.agentCode() : null);
  const on = () => RC.accepted();

  let linked = false;
  function link() {
    if (linked || !on() || !get('ap.fbc') || !code()) return;
    linked = true;
    let ad = {}; try { ad = JSON.parse(get('ap.ad')) || {}; } catch (e) {}
    if (sget('ap.linked') === get('ap.fbc')) return;
    sset('ap.linked', get('ap.fbc'));
    post('/api/ad', { u: code(), fbc: get('ap.fbc'), campaign: ad.campaign, term: ad.term, content: ad.content });
  }
  link();
  if (RC.onChange) RC.onChange(link);

  window.ApAttrib = {
    fromAd: () => sget('ap.fromAd') === '1',
    conv(event, data, eid, kids) {
      if (!on() || kids) return;
      link();
      post('/api/conv', Object.assign({ u: code(), event, eid, url: location.href, fbc: get('ap.fbc') || cookie('_fbc'), fbp: cookie('_fbp') }, data || {}));
    },
  };
})();
