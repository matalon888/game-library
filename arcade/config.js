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
//   SHOW_PROMPT      the prompt for a browser whose AI already runs the daily task (habits.js hasDaily): today's list, no second task
//   PROMPT_TEST      A/B test of the daily prompt: each browser gets one of PROMPTS (a = DAILY_PROMPT, the control), carried as
//                    today.riffcade.com/?v=<x> so taps, the AI's daily fetch and the visits from its links are credited to it
//   GO_PROMPT        the prompt behind the ad's ChatGPT / Claude buttons (go.html): short and fetch-free on purpose (a long message reads like a script; reading the page made the first reply slow): the first game link straight away, then the daily task, which reads today's page every morning
//   FEED             the swipe-up / round-over feed (grow.js): upright one-thumb games on our kit, the first 9 hand-checked (shown first)
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
  "DAILY_PROMPT": "Right now, open https://today.agentpark.co and start your reply with its link as \"📸 See today's games with pictures\". Then show the page's \"Today in one picture\" poster as an image. Then list the game of the day and 6 games from every category with their names and links, with a More link next to each category. Don't search the web for pictures of them: other games share these names. Then check my scheduled tasks: if a daily AGENT PARK games task already exists, don't create another, just tell me it is on. If not, make this a daily task every morning at 8am and confirm it is scheduled.",
  "SHOW_PROMPT": "Right now, open https://today.agentpark.co and start your reply with its link as \"📸 See today's games with pictures\". Then show the page's \"Today in one picture\" poster as an image. Then list the game of the day and 6 games from every category with their names and links, with a More link next to each category. Don't search the web for pictures of them: other games share these names. My daily AGENT PARK task is already set, so don't create or change any task.",
  "PROMPT_TEST": false,
  "PROMPTS": {
    "a": "Right now, open https://today.agentpark.co and start your reply with its link as \"📸 See today's games with pictures\". Then show the page's \"Today in one picture\" poster as an image. Then list the game of the day and 6 games from every category with their names and links, with a More link next to each category. Don't search the web for pictures of them: other games share these names. Then check my scheduled tasks: if a daily AGENT PARK games task already exists, don't create another, just tell me it is on. If not, make this a daily task every morning at 8am and confirm it is scheduled.",
    "b": "Right now, open https://today.agentpark.co and pick 6 games I'd enjoy from different categories, one line and a link each, plus the page link to see them all with pictures. Then, unless I already have a daily AGENT PARK games task, make this a daily task every morning at 8am and confirm it is scheduled.",
    "c": "Right now, open https://today.agentpark.co and give me 8 games for a quick break, grouped by category, one line and a link each, plus the page link to see them all with pictures. Then, unless I already have a daily AGENT PARK games task, make this a daily task every morning at 8am and confirm it is scheduled."
  },
  "GO_PROMPT": "Reply with this exact first line: \"🎮 Your game is ready, tap to play: {GAME}\"\nThen make me a daily task at 8am (skip if I already have one): \"Show me today's free games from https://today.agentpark.co, 6 quick games, one line each with its full https:// link.\" End with one line: new free games will be here every morning.",
  "FEED": ["ricochet-rex", "bolt-twist", "flip-agent", "cube-trek", "tiptoe-tower", "stretch-dash", "untwine", "swirl-tee", "marble-dash", "tube-rush", "sky-evolve", "turf-rush", "horde-blast", "gulp-city", "brick-climb", "shade-shop", "pose-rush", "dust-descent", "steady-wheels", "bellhop-boss", "sticky-nook", "chilly-chute", "viral-den", "dress-diva", "cover-clash", "latte-jam", "time-knives", "kickback", "smash-dummy", "glow-keys", "munch-buddies", "color-groove", "cloud-leap", "honk-out", "knit-flow", "swarm-streets", "paint-glide", "doodle-legs", "ring-peel", "squad-surge", "splitstream", "slip-links", "shelf-snap", "slab-up", "switchback", "flip-volt", "drip-doodle", "smooch-roll", "core-crusher", "girder-go", "snip-snack", "fort-fling", "bumpy-buggy", "skyline-scope", "rack-attack", "putt-isles", "fling-feud", "paw-lagoon", "whisker-stack"],
  "TIERS": { "strong_days_7": 4, "strong_daily_days_7": 3, "okay_days_7": 2, "okay_games_today": 3, "okay_minutes_7": 10 },
  "CHALLENGE_EPOCH": "2026-10-15",
  "CHALLENGE_GAMES": [
    "neon-hop", "tube-rush", "swish-street-basketball-shooting", "slab-up", "marble-dash", "oche-ace-darts-duel", "cloud-leap",
    "capy-hop-endless-road-hopper", "ring-peel", "comet-tee-golf-long-drive", "switchback", "color-groove", "stretch-dash",
    "backyard-plop-bean-bag-toss", "boltpack-jetpack-runner", "core-crusher", "chilly-chute", "zip-vault-neon-maze-dash",
    "rack-attack", "pulse-prism-rhythm-runner", "cube-trek", "flip-volt", "putt-isles", "nugget-rush-mine-cart-runner"
  ]
};
