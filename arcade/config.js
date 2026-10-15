// RIFFCADE site config: one flag per feature, all OFF until turned on here (then run build_arcade.py --push).
// The object below is strict JSON (double quotes, no comments inside) because build_today.py and build_arcade.py read it too.
// None of these features ever run in the chat versions (play.html?embed=chat, the ChatGPT / Claude widget) or on /today.
//   AUTO_NEXT        "Next: <game>" with a 3 s countdown when a game ends or the player taps back
//   DAILY_CHALLENGE  one game a day for everyone, the streak, the share card, riffcade.com/c/<day> pages, the /today link
//   SUBSCRIBE_V2     "New games every morning" card after the 2nd game of a session, at most once a day
//   ADS_ENABLED      ad slots (banner during play, 1 interstitial + 1 rewarded offer per session) via ads/adapter.js
//   WHATSAPP_CHANNEL_URL  the WhatsApp Channel link for SUBSCRIBE_V2 (its button is hidden while this is empty)
//   META_PIXEL_ID    Meta pixel, fires only after the visitor accepts in the consent banner (empty = no pixel)
//   GA4_ID           Google Analytics 4 (G-…): Consent Mode, cookieless until Accept; mirrors every /api/ev event (empty = off)
//   CHALLENGE_EPOCH  day #1 of the daily challenge (UTC); CHALLENGE_GAMES the curated rotation, in order
window.RIFFCADE = {
  "AUTO_NEXT": false,
  "DAILY_CHALLENGE": false,
  "SUBSCRIBE_V2": false,
  "ADS_ENABLED": false,
  "WHATSAPP_CHANNEL_URL": "",
  "META_PIXEL_ID": "",
  "GA4_ID": "G-N62V18VZ3S",
  "DAILY_PROMPT": "Every morning, check https://today.riffcade.com and send me the 5 newest games with their links.",
  "CHALLENGE_EPOCH": "2026-10-15",
  "CHALLENGE_GAMES": [
    "neon-hop", "tube-rush", "swish-street-basketball-shooting", "slab-up", "marble-dash", "oche-ace-darts-duel", "cloud-leap",
    "capy-hop-endless-road-hopper", "ring-peel", "comet-tee-golf-long-drive", "switchback", "color-groove", "stretch-dash",
    "backyard-plop-bean-bag-toss", "boltpack-jetpack-runner", "core-crusher", "chilly-chute", "zip-vault-neon-maze-dash",
    "rack-attack", "pulse-prism-rhythm-runner", "cube-trek", "flip-volt", "putt-isles", "nugget-rush-mine-cart-runner"
  ]
};
