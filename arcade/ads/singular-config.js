// Singular Ads: THE ONE FILE TO EDIT. See ADS_SETUP.md in the repo root.
// Until `tagUrl` is set, every slot shows a labelled test placeholder ("Ad, test").
// The adapter (ads/adapter.js) calls the three functions below, enforces the caps (1 interstitial and 1 rewarded per session,
// banner only during play, never in chat embeds or on /today, privacy, terms, support) and always shows a close button
// within 5 seconds, so nothing in here can exceed them.
window.SINGULAR_ADS = {
  // 1. The Singular Ads tag (script URL) and your ids. Leave tagUrl empty to keep the test placeholders.
  tagUrl: '',
  publisherId: '',
  slots: { banner: '', interstitial: '', rewarded: '' },

  // 2. Called once after the tag script loads. `personalised` is false until the visitor taps Accept in the consent banner:
  //    pass it to the tag as its non-personalised-ads switch (e.g. npa=1 / personalized: false).
  init({ personalised }) {
    // e.g. window.singularAds.init({ publisherId: this.publisherId, personalized: personalised });
  },
  // Called when the visitor changes their choice.
  consent(personalised) {
    // e.g. window.singularAds.setPersonalized(personalised);
  },

  // 3. Render a 320x50 banner into `el` (a reserved 320x50 box under the game).
  banner(el, slotId) {
    // e.g. window.singularAds.display({ slot: slotId, container: el, size: [320, 50] });
  },

  // 4. Show a full-screen interstitial. Return a Promise that resolves when it closes.
  interstitial(slotId) {
    // e.g. return window.singularAds.showInterstitial({ slot: slotId });
    return Promise.resolve();
  },

  // 5. Show a rewarded video. Return a Promise of { completed: true } only when the viewer watched to the end.
  rewarded(slotId) {
    // e.g. return window.singularAds.showRewarded({ slot: slotId }).then(r => ({ completed: !!r.rewarded }));
    return Promise.resolve({ completed: false });
  },
};
