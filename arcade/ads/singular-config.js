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

  // second source: Google H5 Games Ads (AdSense pub-9924926064570335, Ad Placement API, by-application beta applied 2026-10-20).
  // Loaded once; adBreak({type:'reward'}) only plays after the player's own tap, and only once Google has approved the account.
  h5Client: 'ca-pub-9924926064570335',
  h5Load() {
    if (this._h5) return this._h5;
    window.adsbygoogle = window.adsbygoogle || [];
    window.adBreak = window.adConfig = function (o) { window.adsbygoogle.push(o); };
    this._h5 = new Promise(res => {
      const s = document.createElement('script'); s.async = true; s.crossOrigin = 'anonymous';
      s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + this.h5Client;
      s.setAttribute('data-ad-frequency-hint', '30s');
      s.onload = () => { try { window.adConfig({ preloadAdBreaks: 'on', sound: 'on' }); } catch (e) {} res(true); };
      s.onerror = () => res(false);
      document.head.appendChild(s);
    });
    return this._h5;
  },
  h5Reward() {
    return this.h5Load().then(ok => !ok ? { completed: false } : new Promise(res => {
      let shown = false, out = false; const done = v => { if (!out) { out = true; res({ completed: v }); } };
      setTimeout(() => { if (!shown) done(false); }, 3000);   // nothing ready in 3 s: no wait, no reward
      try {
        window.adBreak({ type: 'reward', name: 'bonus-level',
          beforeReward: showAdFn => { shown = true; showAdFn(); },   // the player already chose to watch (our button)
          adViewed: () => done(true), adDismissed: () => done(false),
          adBreakDone: info => { if (!info || info.breakStatus !== 'viewed') done(false); } });
      } catch (e) { done(false); }
    }));
  },

  // third source: Ezoic Web Games (rewardedBreak). Their SDK runs inside the game frame (same origin, marked data-ez-game by
  // shell.js), so we load it into that frame and ask it for the ad; 3 s with nothing ready = no reward, no wait.
  ezReward() {
    const fr = document.querySelector('iframe[data-ez-game]'), w = fr && fr.contentWindow;
    if (!w || !window.ezstandalone) return Promise.resolve({ completed: false });
    return new Promise(res => {
      let out = false; const done = v => { if (!out) { out = true; res({ completed: v }); } };
      setTimeout(() => done(false), 3000);
      const go = () => { try { w.EzGameSDK.cmd.push(() => w.EzGameSDK.init().then(() => w.EzGameSDK.rewardedBreak({ rewardName: 'bonus_level' }))
        .then(r => done(!!(r && r.rewarded)), () => done(false))); } catch (e) { done(false); } };
      try {
        if (w.EzGameSDK) return go();
        w.EzGameSDK = { cmd: [] };
        const s = w.document.createElement('script'); s.src = 'https://www.ezojs.com/ezoic/gamesdk.js'; s.onload = go; s.onerror = () => done(false);
        w.document.head.appendChild(s);
      } catch (e) { done(false); }
    });
  },

  // opt-in rewarded video: Ad Manager, then H5 Games Ads, then Ezoic; { completed: true } only when the network grants the reward
  rewarded(slotId) {
    return this.gptReward(slotId).then(r => r.completed || r.shown ? r : this.h5Reward()).then(r => r.completed ? r : this.ezReward());
  },
  gptReward(slotId) {
    const g = window.googletag; if (!g || !slotId) return Promise.resolve({ completed: false });
    return new Promise(res => g.cmd.push(() => {
      const s = g.defineOutOfPageSlot(slotId, g.enums.OutOfPageFormat.REWARDED);
      if (!s) return res({ completed: false });   // the format isn't available on this page / device
      s.addService(g.pubads());
      let granted = false, ready = false, over = false;
      const done = () => { if (over) return; over = true; g.destroySlots([s]); res({ completed: granted, shown: ready }); };
      setTimeout(() => { if (!ready) done(); }, 3000);   // no ad ready in 3 s (common in some in-app browsers): no wait, no reward
      const pa = g.pubads();
      pa.addEventListener('rewardedSlotReady', e => { if (e.slot === s && !over) { ready = true; e.makeRewardedVisible(); } });
      pa.addEventListener('rewardedSlotGranted', e => { if (e.slot === s) granted = true; });
      pa.addEventListener('rewardedSlotClosed', e => { if (e.slot === s) done(); });
      pa.addEventListener('slotRenderEnded', e => { if (e.slot === s && e.isEmpty) done(); });   // no ad to show: no reward, no wait
      g.display(s);
    }));
  },
};
