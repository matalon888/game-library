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
//   AI_ONLY          games that only open from an AI's link (the daily message, ?ref=daily-*/go-*): hidden from the park,
//                    shelves and feeds; play.html shows a lock card otherwise (shell.js). AI_VIP = the 7-day streak game.
//   GO_PROMPT_CPA    the CPAlead version of GO_PROMPT: it keeps the {START} check-in fetch (we pay CPAlead per verified AI run)
//   GO_PROMPT        the prompt behind the ad's ChatGPT / Claude buttons (go.html): short on purpose (a long message reads like a script): one tiny check-in fetch ({START}, so we see the message was sent without waiting for 8am; the full page made the reply slow), the first game link, then the daily task, which reads today's page every morning
//   FEED             the swipe-up / round-over feed (grow.js): upright one-thumb games on our kit, the first 9 hand-checked (shown first)
//   TIERS            weak / okay / strong player thresholds (habits.js): strong = played on strong_days_7 of the last 7 days,
//                    or came from their AI's daily task on strong_daily_days_7 days; okay = okay_days_7 days, okay_games_today
//                    games today or okay_minutes_7 minutes this week; everyone else is weak
window.RIFFCADE = {
  "AUTO_NEXT": false,
  "DAILY_CHALLENGE": false,
  "SUBSCRIBE_V2": false,
  "ADS_ENABLED": false,
  "ADS_FORCED": false,
  "SPONSOR_OFF": true,
  "WHATSAPP_CHANNEL_URL": "",
  "META_PIXEL_ID": "1143064938054197",
  "GA4_ID": "G-N62V18VZ3S",
  "DAILY_PROMPT": "Right now, open https://today.agentpark.co and start your reply with its link as \"📸 See today's games with pictures\". Then show the page's \"Today in one picture\" poster as an image. Then list the game of the day and 6 games from every category each game's name as a clickable link (never a bare web address), with a More link next to each category. Don't search the web for pictures of them: other games share these names. Then check my scheduled tasks: if a daily AGENT PARK games task already exists, don't create another, just tell me it is on. If not, make this a daily task every morning at 8am and confirm it is scheduled.",
  "SHOW_PROMPT": "Right now, open https://today.agentpark.co and start your reply with its link as \"📸 See today's games with pictures\". Then show the page's \"Today in one picture\" poster as an image. Then list the game of the day and 6 games from every category each game's name as a clickable link (never a bare web address), with a More link next to each category. Don't search the web for pictures of them: other games share these names. My daily AGENT PARK task is already set, so don't create or change any task.",
  "PROMPT_TEST": false,
  "PROMPTS": {
    "a": "Right now, open https://today.agentpark.co and start your reply with its link as \"📸 See today's games with pictures\". Then show the page's \"Today in one picture\" poster as an image. Then list the game of the day and 6 games from every category each game's name as a clickable link (never a bare web address), with a More link next to each category. Don't search the web for pictures of them: other games share these names. Then check my scheduled tasks: if a daily AGENT PARK games task already exists, don't create another, just tell me it is on. If not, make this a daily task every morning at 8am and confirm it is scheduled.",
    "b": "Right now, open https://today.agentpark.co and pick 6 games I'd enjoy from different categories, one line each with the name as a clickable link, plus the page link to see them all with pictures. Then, unless I already have a daily AGENT PARK games task, make this a daily task every morning at 8am and confirm it is scheduled.",
    "c": "Right now, open https://today.agentpark.co and give me 8 games for a quick break, grouped by category, one line each with the name as a clickable link, plus the page link to see them all with pictures. Then, unless I already have a daily AGENT PARK games task, make this a daily task every morning at 8am and confirm it is scheduled."
  },
  "GO_PROMPT": "Don't open any website now. Make me a daily 8am task \"🐼 Daily games\": open https://today.agentpark.co and show me today's games in the layout of its daily message: picture, game of the day, then each category's games and More link, each name as a clickable link.\nThen reply with only these lines, the link behind the words (markdown, no bare web address):\n🎮 [Play your first game ▶]({GAME})\n✅ Daily games set for 8am.\n📌 Pin this chat so your games stay on top.",
  "GO_PROMPT_CPA": "🎮 Set up my free daily arcade:\n1. Open {START} and give me the first game link it has.\n2. Make a daily 8am task called \"🐼 Daily games\": 6 new free games from https://today.agentpark.co, one line each, the game's name as a clickable link (no bare web addresses).\n3. Tell me to pin this chat so my games stay on top.",
  "AI_ONLY": ["alibi-grid-daily-logic-puzzle", "hunch-five-letter-word-guess", "bunchwise-word-groups-puzzle", "lurkfield-monster-minesweeper-rpg"],
  "AI_VIP": "lurkfield-monster-minesweeper-rpg",
  "TASTE_OPENERS": {"A": ["gemloft-block-puzzle", "shelfie-goods-sort"], "B": ["mochi-match-match-3-dorm-decor", "jelly-blocks-block-puzzle"], "C": ["garden-gather-match-3-garden", "peony-mahjong-relaxing-tile-solitaire"]},
  "OPENERS": ["stretch-dash", "swirl-tee", "tiptoe-tower"],
  "FEED_BY": {"f": ["stretch-dash", "tube-rush", "swirl-tee", "shade-shop", "rack-attack", "tiptoe-tower", "viral-den", "pose-rush", "fort-fling", "ricochet-rex", "paw-lagoon", "dust-descent", "marble-dash", "horde-blast", "untwine", "bellhop-boss", "steady-wheels", "squad-surge", "gulp-city", "sticky-nook", "sky-evolve", "girder-go", "turf-rush", "chilly-chute", "snip-snack", "cube-trek", "bolt-twist", "dress-diva", "brick-climb", "flip-agent", "cover-clash", "latte-jam", "time-knives", "kickback", "smash-dummy", "glow-keys", "munch-buddies", "color-groove", "cloud-leap", "honk-out", "knit-flow", "swarm-streets", "paint-glide", "doodle-legs", "ring-peel", "splitstream", "slip-links", "shelf-snap", "slab-up", "switchback", "flip-volt", "drip-doodle", "smooch-roll", "core-crusher", "bumpy-buggy", "skyline-scope", "putt-isles", "fling-feud", "whisker-stack"], "m": ["stretch-dash", "tube-rush", "rack-attack", "shade-shop", "swirl-tee", "tiptoe-tower", "viral-den", "pose-rush", "fort-fling", "marble-dash", "ricochet-rex", "dust-descent", "paw-lagoon", "untwine", "horde-blast", "bellhop-boss", "steady-wheels", "squad-surge", "gulp-city", "sticky-nook", "sky-evolve", "girder-go", "turf-rush", "chilly-chute", "snip-snack", "cube-trek", "bolt-twist", "dress-diva", "brick-climb", "flip-agent", "cover-clash", "latte-jam", "time-knives", "kickback", "smash-dummy", "glow-keys", "munch-buddies", "color-groove", "cloud-leap", "honk-out", "knit-flow", "swarm-streets", "paint-glide", "doodle-legs", "ring-peel", "splitstream", "slip-links", "shelf-snap", "slab-up", "switchback", "flip-volt", "drip-doodle", "smooch-roll", "core-crusher", "bumpy-buggy", "skyline-scope", "putt-isles", "fling-feud", "whisker-stack"]},
  "OPENERS_BY": {"f": ["swirl-tee", "untwine", "paw-lagoon"], "m": ["stretch-dash", "marble-dash", "fort-fling"]},
  "FEED": ["stretch-dash", "tube-rush", "rack-attack", "shade-shop", "swirl-tee", "tiptoe-tower", "viral-den", "pose-rush", "fort-fling", "marble-dash", "ricochet-rex", "dust-descent", "paw-lagoon", "untwine", "horde-blast", "bellhop-boss", "steady-wheels", "squad-surge", "gulp-city", "sticky-nook", "sky-evolve", "girder-go", "turf-rush", "chilly-chute", "snip-snack", "cube-trek", "bolt-twist", "dress-diva", "brick-climb", "flip-agent", "cover-clash", "latte-jam", "time-knives", "kickback", "smash-dummy", "glow-keys", "munch-buddies", "color-groove", "cloud-leap", "honk-out", "knit-flow", "swarm-streets", "paint-glide", "doodle-legs", "ring-peel", "splitstream", "slip-links", "shelf-snap", "slab-up", "switchback", "flip-volt", "drip-doodle", "smooch-roll", "core-crusher", "bumpy-buggy", "skyline-scope", "putt-isles", "fling-feud", "whisker-stack"],
  "TIERS": { "strong_days_7": 4, "strong_daily_days_7": 3, "okay_days_7": 2, "okay_games_today": 3, "okay_minutes_7": 10 },
  "CHALLENGE_EPOCH": "2026-10-15",
  "CHALLENGE_GAMES": [
    "neon-hop", "tube-rush", "swish-street-basketball-shooting", "slab-up", "marble-dash", "oche-ace-darts-duel", "cloud-leap",
    "capy-hop-endless-road-hopper", "ring-peel", "comet-tee-golf-long-drive", "switchback", "color-groove", "stretch-dash",
    "backyard-plop-bean-bag-toss", "boltpack-jetpack-runner", "core-crusher", "chilly-chute", "zip-vault-neon-maze-dash",
    "rack-attack", "pulse-prism-rhythm-runner", "cube-trek", "flip-volt", "putt-isles", "nugget-rush-mine-cart-runner"
  ]
};
