# Neon Runner

A browser FPS. Single-player works by just opening the file; multiplayer needs one
machine to run a small server (details below).

---

## Folder layout

```
neon-runner/
├── index.html              the page: markup + script tags, nothing else
├── server.js               LAN host — only needed for multiplayer
├── css/
│   └── styles.css          all styling (HUD, menus, scope, scoreboard)
├── js/                     game source, split by system
│   ├── 01-core.js          config, seeded RNG, profile/save, catalogue tables
│   ├── 02-render.js        renderer, render targets, post-processing, sky, lighting
│   ├── 03-world.js         geometry merging, the five maps, barrels, extraction pad
│   ├── 03b-nav.js          walkable grid + flow field the AIs path on
│   ├── 04-fx-audio.js      rain, particles, tracers, audio engine, soundtrack
│   ├── 05-weapons.js       arsenal, viewmodel, parametric gun builder, hands
│   ├── 06-player.js        operator abilities, sentry, input, weapon logic, melee
│   ├── 07-enemies.js       enemy chassis, projectiles, pickups, waves, Warden + Sovereign
│   ├── 08-hud.js           HUD, radar, day/night cycle, environmental events
│   ├── 09-loop.js          render pipeline, adaptive resolution, warm-up, lifecycle
│   ├── 10-ui.js            view router, settings, loadout, roster, armoury, records
│   ├── 11-multiplayer.js   LAN presence, PvP deathmatch/duel/TDM, scoreboard
│   └── 12-touch.js         on-screen controls for phones and tablets
├── music/                  your soundtrack — menu/ and combat/ (see Soundtrack)
│                           audio is gitignored: add your own, see that section
└── test/                   jsdom + stubbed-WebGL2 harness (see Testing)
```

### ⚠️ Script order matters

These are **classic scripts sharing one global scope**, not ES modules. Later files
reference things declared in earlier ones, so the `<script>` tags in `index.html`
must stay in numeric order. Renaming or reordering them will break the game.

If you add a new system, add a new numbered file and a matching `<script>` tag at the
correct position rather than appending to the end.

---

## Running single-player

Open `index.html` in a browser. That's it.

One caveat: opening it as a `file://` path means saves work but multiplayer is
unavailable (browsers block WebSockets from `file://`). The game detects this and
says so on the Multiplayer screen.

---

## Running multiplayer (same wifi / office LAN)

**You do NOT need to send anyone the game files.** Only one machine needs the folder.
Everyone else just opens a link in their browser — the server sends them the game.

### On the host machine (one person)

1. Install [Node.js](https://nodejs.org) if it isn't already there.
2. Open a terminal **in this folder**.
3. Run:

   ```
   node server.js
   ```

4. It prints something like:

   ```
   Neon Runner LAN host listening on port 8080
   On this machine, open: http://localhost:8080
   Share this with others on the same wifi:
     http://192.168.1.42:8080
   ```

5. Open `http://localhost:8080` yourself.

### On everyone else's machine

Open the `http://192.168.1.42:8080` style address the host shared. Nothing to install,
nothing to download — the page comes from the host's machine.

You can also find the shareable address in-game: **Multiplayer** in the menu shows
every valid LAN address with a **Copy** button.

### Then

1. Everyone goes to the **Multiplayer** screen — you should see each other in the roster.
2. Pick a mode. The picker shows which are available for your player count:

   | Mode | Combatants (players + bots) |
   |---|---|
   | 1v1 Duel | exactly 2 |
   | Deathmatch (FFA) | 3–8 |
   | Team Deathmatch | 2–8 |

3. Set a frag limit, press **Start match**. Everyone gets pulled into it automatically.

### Troubleshooting

- **Others can't reach the address** — you're probably on different networks (one on
  wifi, one on ethernet or a guest network). A firewall prompt on the host asking to
  allow Node through must be accepted.
- **`node: command not found`** — Node.js isn't installed or isn't on PATH.
- **Port 8080 in use** — change `const PORT = 8080;` near the top of `server.js`.

### What multiplayer currently does

**Multiplayer is PvP only** — Duel, Deathmatch and Team Deathmatch. Positions, hits,
headshots, kills, scores, respawns and win conditions all sync. PvE waves are disabled
during a match.

**You do not need the server to play bots.** Open the Multiplayer screen, pick a mode,
choose how many bots and a skill tier, and press Start match. The server is only needed
when you want to play with other *people*.

**PvP carries two weapons — primary + secondary.** Two guns force a real commitment
instead of a three-slot toolbox covering every range. PvE still carries three.

**Matches ignore your Armoury progress on purpose.** Inside a PvP match the permanent
upgrades are switched off and every weapon is issued to everyone, so a match is decided
by aim rather than by who has ground more credits. Operators and perks still apply —
those are sidegrades, not purchased power. A few weapons are also tuned down in PvP
(explosives most of all) so spam cannot substitute for aiming.

*Co-op was removed.* It had never been more than position sync — every client fought its
own drones — so it promised something the game did not do. Solo PvE waves live on the
**Deploy** screen.

Hit detection is **shooter-authoritative** — your machine decides it hit and tells the
target. That keeps it responsive on a LAN, but it is not cheat-resistant. Fine among
colleagues; don't put this on the public internet as-is.

---

## Soundtrack

Your music lives in **folders**, not in a settings screen:

```
music/
├── menu/      plays in the menus
└── combat/    plays during a run
```

Number the files `01`, `02`, `03`, … using any of `.mp3 .ogg .m4a .opus .wav .webm`:

```
music/combat/01.mp3
music/combat/02.mp3
music/menu/01.ogg
```

Both lists are **shuffled at the start of every match**. Leave one folder empty and the
other covers both; leave both empty and the built-in adaptive score plays.

**Why numbered names?** A browser cannot list a directory, so the game probes `01`, `02`,
… and stops after three consecutive misses. That keeps it working with no server and no
manifest to maintain. Gaps of one or two are fine; a gap of three ends the scan.

Settings → Soundtrack shows how many tracks were found and has a **Rescan folders**
button for when you add files without reloading. **N** skips to the next track. There is
no source setting: if there are files, they play; if there are not, the score does.

Browsers block audio until the page has seen a real click or keypress, so music starts on
your first input rather than the instant the page loads.

---

## Controls

| | |
|---|---|
| WASD | Move |
| Space | Jump |
| Shift | Sprint |
| Ctrl (hold) | Crouch |
| C | Crouch (toggle) |
| Left click | Fire |
| Right click | Aim / scope |
| R | Reload |
| E | Dash |
| F | Operator ability |
| V | Cycle fitted optic forward |
| Shift+V | Cycle fitted optic backward |
| G | Throw grenade |
| T | Take the weapon you are standing on |
| 1 / 2 / 3 | Weapon slots |
| N | Next track (reshuffles when the list wraps) |
| Q (tap) | Quick swap |
| Q (hold) | Weapon wheel — steer with mouse, release to equip (centre = cancel) |
| Tab (hold) | Full scoreboard |
| Esc | Pause |
| ` | Performance readout |

### On a phone or tablet

The game is playable on touch — `js/12-touch.js` adds an on-screen pad when it detects a
coarse pointer, and does nothing at all otherwise, so desktop is untouched.

| | |
|---|---|
| Left stick | Move — push to the rim to sprint |
| Drag anywhere right | Look |
| FIRE / JUMP / R | Fire, jump, reload |
| ADS | Aim — a **toggle** here, not a hold |
| NADE / SKILL / SWAP | Grenade, operator ability, quick swap |
| II (top right) | Pause |
| FULLSCREEN (top left) | Fullscreen, and asks for a landscape lock where the browser allows it |

It writes the same `keys.*` flags the keyboard writes and nudges `P.yaw`/`P.pitch` the way
the mouse handler does, so it adds no separate movement path to keep in sync.

Portrait is gated: an FPS needs the long axis, so turning the phone upright pauses the run
and shows a rotate prompt. Android honours the orientation lock; iOS Safari has no such
API, which is why the gate exists rather than relying on the lock.

---

## Weapon handling

Bullets are not lasers. Where a round lands is the sum of two separate systems, split the
way Counter-Strike splits them, because the split is what makes a spray learnable:

**Inaccuracy** — a random cone you cannot out-skill, only out-position. It is the sum of
the weapon's own dispersion, a quadratic penalty for your movement speed, a large flat
penalty for being airborne, and *bloom*: extra cone added per shot while the trigger is
held, up to a per-weapon cap. Crouching multiplies the weapon's own term by `INACC_CROUCH`.
Bloom decays fast, but only once the trigger has been off for `BLOOM_HOLD` — so tapping
and burst-firing are meaningfully more accurate than holding the trigger down.

**Recoil** — a fixed, learnable pattern that kicks the *camera*, which is what the next
round is fired down. Each weapon climbs hard for its first `climb` rounds, then the rise
tails off and the muzzle walks sideways along a deterministic curve (small jitter on top,
so it can be learned but not memorised to the pixel). Pull down and against it and you
land the spray. It recovers to your original aim point once you release. A 30-round spray
climbs about 10 degrees and walks 3-5 degrees wide, which keeps the horizontal inside the
vertical — a pattern that wanders further sideways than it rises reads as the weapon
swimming rather than climbing.

The crosshair arms sit exactly on the edge of the current cone, converted from radians
through the live projection — it widens as you move, jump and spray, and tightens when you
crouch or aim. What it draws is where rounds can actually go.

Crouching is a full stance, not a camera tween: the eye drops to `EYE_CROUCH`, walk speed
drops to `CROUCH_MOVE`, the aim cone tightens, and the stance is broadcast in multiplayer
so a crouching player is genuinely shorter to shoot at (`CROUCH_SQ` squashes both the model
and its hitbox by the same factor). Sprinting cancels it.

**Everything shooting back plays by the same model.** A handling cost the player pays and
the AI does not is just a tax, so incoming fire runs the geometry in reverse: the shooter
has a cone, you are a disc inside it (`playerTargetRadius`), and the chance of connecting
is the ratio of the two areas.

- **Bots** used to resolve a shot with a flat coin flip against their skill tier —
  identical odds at 4m and at 40m, whether you were sprinting or standing still, with a
  tracer drawn as decorative scatter that had nothing to do with the result. Each tier's
  `aim` is now *derived* into an aim cone calibrated so it reproduces exactly its old hit
  chance at `BOT_RANGE` (14m, the distance bots try to hold) — and everything else falls
  out of the geometry. Closing to 5m makes them lethal; backing off to 30m drops an Elite
  from 88% to 19%; sprinting roughly halves their chance; crouching costs them ~30%. Their
  own sustained fire blooms their cone on the same hold-then-settle rule the player's does,
  and the tracer is drawn down the line actually rolled, so what you see is what happened.
- **PvE gunners** put a perfectly-aimed round on your chest every single time. Their
  tracking error now scales with how fast *you* are moving: stand still and they still hit
  dead-on, sprint across their front and they have to lead you and mostly cannot.
- **Your hitbox** against incoming projectiles shrinks by `CROUCH_HIT_R` when crouched — a
  crouched figure is narrower, not just shorter, and the sphere has to say so.

**Aiming down sights** aligns the weapon's actual sight with the crosshair. The viewmodel
is drawn by `vmCam`, which sits at the origin of `vmScene` looking down −Z, so a sight is
on the crosshair exactly when its world x and y are zero — which makes the aimed position
of the viewmodel simply the negative of the sight's local offset (the standard "aim part
offset" technique). Every weapon records a `sightY` and derives its `adsPos` from it, so
the geometry and the alignment cannot drift apart. ADS also multiplies the whole aim cone
by the weapon's `adsSpread` — bloom included — and damps recoil to 55% vertical / 60%
horizontal, so right-click is a real accuracy tool and not just a zoom.

Every sight is built to be seen *through*: `SIGHT_CLEAR` defines a clear channel around
the sight line that no opaque part of a weapon may enter behind its own front sight, and
apertures, optic windows and scope tubes are all sized off it. Sight glass is transparent
and does not write depth. (Both were previously untrue — the optics were solid blocks,
which only worked because ADS parked the weapon off to one side so you looked past the
sight rather than through it.)

Optics split by whether they actually occlude. **Reflex 2x** is a single pane of glass:
the weapon stays on screen, you see past the housing, and the only thing added is the
illuminated dot. **Tactical 4x** and **Longshot 8x** are tubes — your eye is at the ocular
lens, so the viewmodel and hands go away and a scope overlay takes over. Magnification is
a true FOV ratio, `tan(half-fov)/mag`, verified across all 48 weapon/optic pairs.

All of these constants live together at the top of `js/01-core.js`; the per-weapon
`bloom` / `bloomMax` / `hRecoil` / `climb` values are derived and then overridden at the
bottom of `js/05-weapons.js`.

---

## Testing

`test/` contains a jsdom + stubbed-WebGL2 harness that loads the real `index.html`
over HTTP and runs the actual `<script>` tags in order. It catches runtime errors that
`node --check` cannot — which is this project's usual failure mode.

```
node server.js &
node test/run-all.js
```

Or `npm test`, which runs the same thing (the server has to be up first — the harness
loads the game over HTTP).

Eighteen suites: weapons, scopes, views, armoury, melee/bots, accessibility, offline bots,
pickups/grenades, progression, maps, traversal, ai-nav, wheel/drops, look, music/icons,
combat/end-screen, events, profile-sync.

Two of those are worth knowing about:

- **traversal** flood-fills each map's walkable surface with the real collision
  functions and asserts the spawn, the extraction pad and every staircase are actually
  connected. It exists because exactly-abutting collision volumes leave a hairline seam
  where `floorAt` reads ground level, which silently made stairs unclimbable.
- **ai-nav** drops a hunter behind real cover with no line of sight and walks it by the
  flow field, asserting it routes *around* the geometry and regains sight.

---

## Saves

Progress (credits, level, unlocks, settings, callsign, records) is stored in your
browser's `localStorage`, per browser and per origin.

**On the host machine that runs `node server.js`, progress follows you across addresses.**
`http://localhost:8080` and `http://192.168.1.42:8080` are technically different origins
with separate browser storage, which used to mean opening the game "the other way" showed
a brand new account. The server now keeps a `profile.json` and shares it with — and only
with — the machine it is running on, so either address gives you the same progression.

Joining players are refused that endpoint and keep their own browser-local save. That is
deliberate: nobody should inherit (or overwrite) the host's account just by joining them.

`profile.json` is written next to `server.js`. Delete it to reset the host's shared copy;
your browser still holds its own until you clear site data.

---

## Licence

MIT — see [LICENSE](LICENSE).
