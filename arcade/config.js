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
//   PROMPT_TEST      A/B test of the daily prompt: each browser gets one of PROMPTS (a = DAILY_PROMPT, the control), carried as
//                    today.riffcade.com/?v=<x> so taps, the AI's daily fetch and the visits from its links are credited to it
//   TIERS            weak / okay / strong player thresholds (habits.js): strong = played on strong_days_7 of the last 7 days,
//                    or came from their AI's daily task on strong_daily_days_7 days; okay = okay_days_7 days, okay_games_today
//                    games today or okay_minutes_7 minutes this week; everyone else is weak
window.RIFFCADE = {
  "AUTO_NEXT": false,
  "DAILY_CHALLENGE": false,
  "SUBSCRIBE_V2": false,
  "ADS_ENABLED": false,
  "WHATSAPP_CHANNEL_URL": "",
  "META_PIXEL_ID": "1143064938054197",
  "GA4_ID": "G-N62V18VZ3S",
  "DAILY_PROMPT": "Right now, open https://today.agentpark.co and show me the game of the day plus 3 games from each category, each with its cover picture, one line and its link, and the page link to see them all. Then make this a daily task every morning at 8am and confirm it is scheduled.",
  "PROMPT_TEST": false,
  "PROMPTS": {
    "a": "Right now, open https://today.agentpark.co and show me the game of the day plus 3 games from each category, each with its cover picture, one line and its link, and the page link to see them all. Then make this a daily task every morning at 8am and confirm it is scheduled.",
    "b": "Right now, open https://today.agentpark.co and pick 6 games I'd enjoy from different categories, one line and a link each, plus the page link to see them all with pictures. Then make this a daily task every morning at 8am and confirm it is scheduled.",
    "c": "Right now, open https://today.agentpark.co and give me 8 games for a quick break, grouped by category, one line and a link each, plus the page link to see them all with pictures. Then make this a daily task every morning at 8am and confirm it is scheduled."
  },
  "TIERS": { "strong_days_7": 4, "strong_daily_days_7": 3, "okay_days_7": 2, "okay_games_today": 3, "okay_minutes_7": 10 },
  "CHALLENGE_EPOCH": "2026-10-15",
  "CHALLENGE_GAMES": [
    "neon-hop", "tube-rush", "swish-street-basketball-shooting", "slab-up", "marble-dash", "oche-ace-darts-duel", "cloud-leap",
    "capy-hop-endless-road-hopper", "ring-peel", "comet-tee-golf-long-drive", "switchback", "color-groove", "stretch-dash",
    "backyard-plop-bean-bag-toss", "boltpack-jetpack-runner", "core-crusher", "chilly-chute", "zip-vault-neon-maze-dash",
    "rack-attack", "pulse-prism-rhythm-runner", "cube-trek", "flip-volt", "putt-isles", "nugget-rush-mine-cart-runner"
  ]
};
