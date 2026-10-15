"""agentpark.co/today (served at today.agentpark.co): the daily page an AI's "new games every morning" task reads, and
the page people land on from it. Laid out like an app store's Today tab: game of the day, category chips, then shelves
of covers (just added, top scored, great on a phone, one per category). Readable with no JavaScript. The plain-text
list at the bottom (names, one line, raw links, grouped by category) is what an AI quotes. Also writes arcade/today.json.
Simulated gambling (chat_safe=false) and games played off-site never appear. Runs at the end of build_arcade.py.
A copy runs in the site repo (tools/build_today.py, GitHub Action "today", 05:30 and 17:30 UTC) so the page moves to the
new day even when this Mac is asleep: TODAY_LAYOUT=site reads arcade/ and writes today.html at that repo's root.
Usage: python3 build_today.py"""
import datetime, html, json, os, re, shutil

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE_LAYOUT = os.environ.get("TODAY_LAYOUT") == "site"
if SITE_LAYOUT: ROOT = os.path.dirname(ROOT)  # site repo: tools/build_today.py, games in arcade/, page at the root
OUT = ROOT if SITE_LAYOUT else os.path.join(ROOT, "site")
SITE = "https://agentpark.co"
SHELF = 12          # covers per shelf
NEW = 12            # "Just added" shelf and the JSON's games list
PER_CAT = 3         # games per category in the plain-text list
EMOJI = {"Puzzle": "🧩", "Arcade": "👾", "Action": "💥", "Racing": "🏎️", "Strategy": "♟️", "3D": "🧊", "Idle": "⏳",
         "Word & Math": "🔤", "Sports": "⚽", "Makeover": "💅", "Retro": "🕹️", "Kids": "🧸", "2-Player": "🤝", "Cards": "🃏"}

games = json.load(open(os.path.join(ROOT, "arcade", "games.json")))
ok = [g for g in games if g.get("chat_safe") is not False and not g.get("external")]
shown = [g for g in ok if g.get("thumb") or g.get("cover")]  # the shelves only show games with a cover
today = datetime.date.today()

def score(g):  # Park score, as arcade/park.js: Claude's review (depth + polish, 1-10) averaged
    r = g.get("review") or {}
    return round((r["depth"] + r["polish"]) / 2, 1) if r.get("depth") and r.get("polish") else None

def fresh(g):  # added in the last 2 days
    try: return (today - datetime.date.fromisoformat(g.get("added") or "")).days <= 1
    except ValueError: return False

def play(g, pos): return f"{SITE}/arcade/play.html?g={g['slug']}&ref=daily&pos={pos}"
def img(g): return f"{SITE}/arcade/{g.get('thumb') or g.get('cover')}" if (g.get("thumb") or g.get("cover")) else ""
def pitch(g): return (g.get("review") or {}).get("pitch") or g.get("blurb") or ""
best = lambda gs: sorted(gs, key=lambda g: -(score(g) or 0))
newest = sorted(ok, key=lambda g: (g.get("added") or "", score(g) or 0), reverse=True)

# game of the day: rotates daily through the best phone-friendly games, so it changes every morning
phone = lambda g: not g.get("desk_only") and g.get("platform") != "desktop"
new_shown = [g for g in newest if g in shown]
top_new = [g for g in best(shown) if (score(g) or 0) >= 7.5 and phone(g)] or new_shown[:1]  # most people open it on a phone
gotd = top_new[today.toordinal() % len(top_new)]
cats = sorted({g["category"] for g in ok}, key=lambda c: (-sum(g["category"] == c for g in ok), c))
cats = [c for c in cats if sum(g["category"] == c for g in ok) >= 3]

shelves = [("new", "✨ New this week", "The best of the newest", best(new_shown[:60])[:NEW]),
           ("top", "🏆 Top scored", "Deepest and most polished", best(shown)[:SHELF]),
           ("phone", "📱 Great on your phone", "Tap and play, no keyboard", best([g for g in shown if phone(g)])[:SHELF])]
shelves += [(f"c-{c.lower().replace(' & ', '-').replace(' ', '-')}", f"{EMOJI.get(c, '🎮')} {c}", f"{sum(g['category'] == c for g in ok)} games",
             best([g for g in shown if g["category"] == c])[:SHELF]) for c in cats]

def pick_cat(c):
    """The list an AI quotes, different every day: games added today or yesterday first, then a window that moves PER_CAT
    places a day through the category's good games (Park score 6+, best first), so the picks rotate even on days with
    nothing new; a category of 30 games repeats only after 10 days."""
    gs = [g for g in shown if g["category"] == c and g is not gotd]
    new = best([g for g in gs if fresh(g)])
    pool = [g for g in best(gs) if g not in new]
    good = [g for g in pool if (score(g) or 0) >= 6]
    if len(good) >= 7 * PER_CAT: pool = good  # big categories keep to their good games; small ones use all, so a week never repeats
    off = (today.toordinal() * PER_CAT) % len(pool) if pool else 0
    return (new + pool[off:] + pool[:off])[:PER_CAT]

data = {"title": "AGENTPARK: new games", "date": today.isoformat(), "more": f"{SITE}/today", "total": len(ok),
        "game_of_the_day": {"name": gotd["name"], "category": gotd["category"], "pitch": pitch(gotd), "image": img(gotd), "play_url": play(gotd, "gotd")},
        "games": [{"name": g["name"], "category": g["category"], "blurb": g.get("blurb") or "", "pitch": pitch(g), "score": score(g),
                   "added": g.get("added"), "desktop_only": bool(g.get("desk_only")), "image": img(g), "play_url": play(g, i + 1)}
                  for i, g in enumerate(newest[:NEW])],
        "categories": {c: [{"name": g["name"], "new": fresh(g), "pitch": pitch(g), "image": img(g), "play_url": play(g, f"list-{c}")}
                           for g in pick_cat(c)] for c in cats}}
for path in ((os.path.join(ROOT, "arcade/today.json"),) if SITE_LAYOUT else (os.path.join(ROOT, "arcade/today.json"), os.path.join(OUT, "arcade/today.json"))):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=1, ensure_ascii=False); f.write("\n")

e = html.escape
date = f"{today:%A}, {today.day} {today:%B}"
# today's daily challenge (arcade/config.js DAILY_CHALLENGE): a plain link, no ads on this page
# (same rules as build_challenge.py, inlined so the site repo's copy runs alone)
cfg = json.loads(re.search(r"window\.RIFFCADE\s*=\s*(\{.*\})\s*;", open(os.path.join(ROOT, "arcade", "config.js")).read(), re.S).group(1))
challenge = ""
if cfg.get("DAILY_CHALLENGE") and cfg.get("CHALLENGE_GAMES"):
    n = (datetime.datetime.now(datetime.timezone.utc).date() - datetime.date.fromisoformat(cfg["CHALLENGE_EPOCH"])).days + 1
    cg = next((g for g in games if n >= 1 and g["slug"] == cfg["CHALLENGE_GAMES"][(n - 1) % len(cfg["CHALLENGE_GAMES"])]), None)
    if cg and os.path.exists(os.path.join(OUT, "c", str(n), "index.html")):  # only link a challenge page that exists
        challenge = (f'<a class="chal" href="{SITE}/c/{n}"><span>🔥</span><div><b>Today\'s challenge: {e(cg["name"])}</b>'
                     f'<small>Everyone plays the same game today. Beat your friends: {SITE}/c/{n}</small></div><i>›</i></a>')

def tile(g, pos):
    s = score(g)
    return (f'<a class="t" href="{e(play(g, pos))}"><span class="cv"><img src="{e(img(g))}" alt="{e(g["name"])} cover" loading="lazy" width="600" height="1000">'
            f'{"<em>NEW</em>" if fresh(g) else ""}{f"<b class=sc>★ {s:.1f}</b>" if s and s >= 7 else ""}</span>'
            f'<strong>{e(g["name"])}</strong><small>{e(g["category"])}{" · 💻" if g.get("desk_only") else ""}</small></a>')

chips = "".join(f'<a href="#{k}">{e(t)}</a>' for k, t, _, gs in shelves[3:])
rows = "\n".join(f'<section class="shelf" id="{k}"><header><h2>{e(t)}</h2><span>{e(sub)}</span></header>'
                 f'<div class="row">{"".join(tile(g, f"{k}-{i + 1}") for i, g in enumerate(gs))}</div></section>' for k, t, sub, gs in shelves if gs)
text = "\n".join(f'<h3>{EMOJI.get(c, "🎮")} {e(c)}</h3><ul>' + "".join(
    f'<li><img src="{e(x["image"])}" alt="{e(x["name"])} cover" width="48" height="80" loading="lazy"><span>{"🆕 " if x["new"] else ""}<b>{e(x["name"])}</b>: {e(x["pitch"])} <a href="{e(x["play_url"])}">{e(x["play_url"])}</a></span></li>' for x in xs) + '</ul>'
    for c, xs in data["categories"].items() if xs)
gs_ = score(gotd)
ld = json.dumps({"@context": "https://schema.org", "@type": "ItemList", "name": f"AGENTPARK new games, {date}",
                 "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": g["name"], "url": g["play_url"], "image": g["image"]}
                                     for i, g in enumerate(data["games"])]}, ensure_ascii=False).replace("</", "<\\/")

page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="index,follow">
<title>AGENTPARK Today: free games for {date}</title>
<meta name="description" content="Game of the day: {e(gotd['name'])}. {len(ok)} free games you play in your browser, by category, new ones every day. No download, no sign-up.">
<meta property="og:title" content="AGENTPARK Today: {e(gotd['name'])} and {len(ok) - 1} more free games">
<meta property="og:description" content="Free games in your browser. No download, no sign-up. New ones every day.">
<meta property="og:image" content="{e(img(gotd))}">
<meta name="theme-color" content="#FFF6E6">
<link rel="icon" href="{SITE}/arcade/brand/mark.svg">
<link rel="alternate" type="application/json" href="{SITE}/arcade/today.json">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap">
<script type="application/ld+json">{ld}</script>
<style>
:root {{ --bg: #FFF6E6; --surface: #FFFFFF; --ink: #1E1B33; --muted: #6E6A84; --line: #F0E2C8; --grass: #22A257; --sun: #FFC93C; --coral: #FF6A55;
  --shadow: 0 1px 0 rgba(30,27,51,.04), 0 12px 28px -12px rgba(76,52,18,.28); --display: "Bricolage Grotesque", system-ui, sans-serif; --body: "DM Sans", system-ui, -apple-system, sans-serif; color-scheme: light }}
@media (prefers-color-scheme: dark) {{ :root {{ --bg: #0E1428; --surface: #19223F; --ink: #F5F1FF; --muted: #A9AEC9; --line: #27325A; --grass: #7FE09A;
  --shadow: 0 14px 30px -12px rgba(0,0,0,.6); color-scheme: dark }} }}
* {{ box-sizing: border-box }}
body {{ margin: 0; background: var(--bg); color: var(--ink); font: 15.5px/1.45 var(--body); -webkit-text-size-adjust: 100% }}
a {{ color: inherit; text-decoration: none }}
main {{ max-width: 1100px; margin: 0 auto; padding: max(18px, env(safe-area-inset-top)) 0 56px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 26px }}
.pad {{ padding-inline: max(16px, env(safe-area-inset-left)) max(16px, env(safe-area-inset-right)) }}
.top {{ display: flex; align-items: center; gap: 12px; min-width: 0 }}
.top img {{ width: 44px; height: 44px }}
.top h1 {{ font: 800 26px/1 var(--display); letter-spacing: -.04em; margin: 0 }}
.top h1 span {{ color: var(--grass) }}
.top p {{ margin: 3px 0 0; font-size: 13px; color: var(--muted); font-weight: 500 }}
.hero {{ position: relative; display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 18px; align-items: center; background: var(--surface); border-radius: 28px; padding: 16px; box-shadow: var(--shadow); overflow: hidden }}
.hero::before {{ content: ""; position: absolute; inset: 0; background: var(--hero) center/cover; filter: blur(40px) saturate(1.4); opacity: .35; z-index: 0 }}
.hero > * {{ position: relative; min-width: 0 }}
.hero .cv {{ aspect-ratio: 3/5; border-radius: 18px; overflow: hidden; box-shadow: var(--shadow) }}
.hero .cv img {{ width: 100%; height: 100%; object-fit: cover; display: block }}
.hero small {{ font: 700 11px/1 var(--body); letter-spacing: .12em; color: var(--coral) }}
.hero h2 {{ font: 800 clamp(26px, 6vw, 40px)/1 var(--display); letter-spacing: -.035em; margin: 8px 0 6px }}
.hero p {{ margin: 0 0 14px; color: var(--muted); max-width: 46ch; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden }}
.btn {{ display: inline-flex; white-space: nowrap; align-items: center; gap: 8px; background: var(--grass); color: #fff; font: 700 16px var(--body); padding: 12px 26px; border-radius: 999px }}
@media (prefers-color-scheme: dark) {{ .btn {{ color: #0E1428 }} }}
.meta {{ display: block; font-size: 13px; color: var(--muted); margin-top: 10px }}
.chips {{ display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding-block: 2px }}
.chips::-webkit-scrollbar, .row::-webkit-scrollbar {{ display: none }}
.chips a {{ flex: none; background: var(--surface); border: 1px solid var(--line); border-radius: 999px; padding: 8px 14px; font-weight: 700; font-size: 14px; white-space: nowrap }}
.chal {{ display: flex; align-items: center; gap: 12px; background: var(--sun); color: #1E1B33; border-radius: 20px; padding: 14px 16px }}
.chal span {{ font-size: 26px }} .chal div {{ flex: 1; min-width: 0 }} .chal b {{ display: block }} .chal small {{ font-size: 13px; opacity: .75; overflow-wrap: anywhere }} .chal i {{ font: 800 26px var(--display); font-style: normal }}
.shelf header {{ display: flex; flex-wrap: wrap; align-items: baseline; column-gap: 10px; margin-bottom: 10px }}
.shelf h2 {{ font: 800 21px/1.1 var(--display); letter-spacing: -.03em; margin: 0 }}
.shelf header span {{ font-size: 13px; color: var(--muted) }}
.shelf, .shelf header {{ scroll-margin-top: 12px }}
.shelf > header {{ padding-inline: max(16px, env(safe-area-inset-left)) 16px }}
.row {{ display: grid; grid-auto-flow: column; grid-auto-columns: 128px; gap: 12px; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none;
  padding: 2px max(16px, env(safe-area-inset-left)) 6px; scroll-padding-inline: 16px }}
.t {{ scroll-snap-align: start; display: grid; gap: 3px; min-width: 0 }}
.t .cv {{ position: relative; aspect-ratio: 3/5; border-radius: 16px; overflow: hidden; background: var(--line); box-shadow: var(--shadow) }}
.t img {{ width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .25s }}
.t:hover img {{ transform: scale(1.04) }}
.t em {{ position: absolute; top: 8px; left: 8px; background: var(--coral); color: #fff; font: 800 10px/1 var(--body); letter-spacing: .08em; padding: 5px 7px; border-radius: 999px; font-style: normal }}
.t .sc {{ position: absolute; top: 8px; right: 8px; background: rgba(14,20,40,.78); color: #FFD966; font: 700 12px/1 var(--body); padding: 5px 7px; border-radius: 999px; backdrop-filter: blur(4px) }}
.t strong {{ font-size: 14px; line-height: 1.2; margin-top: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }}
.t small {{ font-size: 12px; color: var(--muted) }}
@media (min-width: 720px) {{ .row {{ grid-auto-columns: 150px }} .hero {{ grid-template-columns: 200px minmax(0, 1fr); padding: 22px }} }}
.list {{ font-size: 14px; color: var(--muted) }}
.list summary {{ font: 700 15px var(--body); color: var(--ink); cursor: pointer }}
.list h3 {{ font-size: 15px; color: var(--ink); margin: 14px 0 4px }}
.list ul {{ margin: 0; padding: 0; list-style: none; display: grid; gap: 8px }}
.list li, .list .gl {{ display: flex; gap: 10px; align-items: flex-start }}
.list li img, .list .gl img {{ width: 48px; height: 80px; object-fit: cover; border-radius: 8px; flex: none; background: var(--line) }}
.list li span {{ min-width: 0 }}
.list a {{ text-decoration: underline; overflow-wrap: anywhere }}
.daily {{ margin: 0; font-size: 14px; background: var(--surface); border: 1px dashed var(--line); border-radius: 16px; padding: 12px 16px }}
footer {{ font-size: 13px; color: var(--muted) }}
footer a {{ text-decoration: underline }}
</style>
</head>
<body>
<main>
<div class="top pad"><img src="{SITE}/arcade/brand/mark.svg" alt=""><div><h1>AGENT<span>PARK</span> Today</h1><p>{date} · {len(ok)} free games · no download, no sign-up</p></div></div>
<div class="pad"><a class="hero" href="{e(play(gotd, 'gotd'))}" style="--hero:url('{e(img(gotd))}')">
<span class="cv"><img src="{e(img(gotd))}" alt="{e(gotd['name'])} cover" width="600" height="1000"></span>
<div><small>GAME OF THE DAY</small><h2>{e(gotd['name'])}</h2><p>{e(pitch(gotd))}</p>
<span class="btn">▶ Play free</span><span class="meta">{e(EMOJI.get(gotd['category'], '🎮'))} {e(gotd['category'])}{f" · ★ {gs_:.1f}" if gs_ else ""}{" · best on a computer" if gotd.get("desk_only") else ""}</span></div></a></div>
<details class="list pad" open><summary>📋 Today's list with links</summary>
<p>Game of the day, then today's picks in each category (🆕 = just added), one line each with its link. They change every day. All free, in the browser.</p>
<p class="gl"><img src="{e(img(gotd))}" alt="{e(gotd['name'])} cover" width="48" height="80">🏆 <b>Game of the day: {e(gotd['name'])}</b>: {e(pitch(gotd))} <a href="{e(play(gotd, 'gotd'))}">{e(play(gotd, 'gotd'))}</a></p>
{text}
<p>All the games with pictures: <a href="https://today.agentpark.co">https://today.agentpark.co</a></p>
</details>
<nav class="chips pad" aria-label="Categories">{chips}</nav>
{f'<div class="pad">{challenge}</div>' if challenge else ""}
{rows}
<p class="pad daily">📬 <b>Want this every morning?</b> Tell your AI: <q>Make this a daily task at 8am.</q> ChatGPT, Claude and Grok can all do it. No sign-up.</p>
<footer class="pad">See all {len(ok)} games in the park: <a href="{SITE}">{SITE.replace('https://', '')}</a>. New games every day.</footer>
</main>
</body>
</html>
"""
with open(os.path.join(OUT, "today.html"), "w") as f:
    f.write(page)
if not SITE_LAYOUT:  # keep the site repo's copy (run by its GitHub Action) the same as this file
    os.makedirs(os.path.join(OUT, "tools"), exist_ok=True); shutil.copy(os.path.abspath(__file__), os.path.join(OUT, "tools", "build_today.py"))
print(f"today: game of the day {gotd['name']}, {len(shelves)} shelves, {len(ok)} games -> site/today.html, arcade/today.json")
