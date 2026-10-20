// Singular Ads: THE ONE FILE TO EDIT. See ADS_SETUP.md in the repo root.
// Google Ad Manager (network 23009047059 "Dando online ltd", reactivated 2026-10-20, in Google's review) through the Google
// Publisher Tag. Ads stay off until config.js ADS_ENABLED is true; turn that on only once the network is approved and the three
// ad units below exist in Ad Manager (Inventory → Ad units) and agentpark.co/ads.txt carries the network's line.
// The adapter (ads/adapter.js) calls the functions below, enforces the caps (1 interstitial and 1 rewarded per session,
// banner only during play, never in chat embeds or on /today, privacy, terms, support) and always shows a close button
// within 5 seconds, so nothing in here can exceed them.
window.SINGULAR_ADS = {
  tagUrl: 'https://securepubads.g.doubleclick.net/tag/js/gpt.js',
  publisherId: '23009047059',
  slots: { banner: '/23009047059/agentpark_banner_320x50', interstitial: '/23009047059/agentpark_interstitial', rewarded: '/23009047059/agentpark_rewarded' },

  // `personalised` is false until the visitor accepts (outside the US) or always on a Kids game
  init({ personalised }) {
    const g = window.googletag = window.googletag || { cmd: [] };
    g.cmd.push(() => {
      g.pubads().setPrivacySettings({ nonPersonalizedAds: !personalised, childDirectedTreatment: false });
      g.pubads().enableSingleRequest();
      g.enableServices();
    });
  },
  consent(personalised) {
    const g = window.googletag; if (!g) return;
    g.cmd.push(() => g.pubads().setPrivacySettings({ nonPersonalizedAds: !personalised }));
  },

  // a 320x50 banner in the reserved box under the game
  banner(el, slotId) {
    const g = window.googletag; if (!g || !slotId) return;
    el.id = el.id || 'ap-banner-' + Math.random().toString(36).slice(2, 8);
    g.cmd.push(() => { const s = g.defineSlot(slotId, [320, 50], el.id); if (s) { s.addService(g.pubads()); g.display(el.id); } });
  },

  // GPT shows web interstitials on its own when the page navigates; the adapter's between-games call just lets it happen
  interstitial(slotId) {
    const g = window.googletag; if (!g || !slotId) return Promise.resolve();
    return new Promise(res => g.cmd.push(() => {
      const s = g.defineOutOfPageSlot(slotId, g.enums.OutOfPageFormat.INTERSTITIAL);
      if (s) { s.addService(g.pubads()); g.display(s); }
      setTimeout(res, 300);
    }));
  },

  // opt-in rewarded video: { completed: true } only when Google grants the reward (watched to the end)
  rewarded(slotId) {
    const g = window.googletag; if (!g || !slotId) return Promise.resolve({ completed: false });
    return new Promise(res => g.cmd.push(() => {
      const s = g.defineOutOfPageSlot(slotId, g.enums.OutOfPageFormat.REWARDED);
      if (!s) return res({ completed: false });   // the format isn't available on this page / device
      s.addService(g.pubads());
      let granted = false, ready = false, over = false;
      const done = () => { if (over) return; over = true; g.destroySlots([s]); res({ completed: granted }); };
      setTimeout(() => { if (!ready) done(); }, 4000);   // no ad ready in 4 s (common in some in-app browsers): no wait, no reward
      const pa = g.pubads();
      pa.addEventListener('rewardedSlotReady', e => { if (e.slot === s && !over) { ready = true; e.makeRewardedVisible(); } });
      pa.addEventListener('rewardedSlotGranted', e => { if (e.slot === s) granted = true; });
      pa.addEventListener('rewardedSlotClosed', e => { if (e.slot === s) done(); });
      pa.addEventListener('slotRenderEnded', e => { if (e.slot === s && e.isEmpty) done(); });   // no ad to show: no reward, no wait
      g.display(s);
    }));
  },
};
