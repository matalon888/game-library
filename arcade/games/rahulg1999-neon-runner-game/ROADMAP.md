# Neon Runner — Build Roadmap

Status legend: `[x]` done · `[~]` partial · `[ ]` not started

---

## Phase 1 — Scopes & loot economy ✅ SHIPPED

- [x] **Optics as loot.** Iron sights always available; Reflex 2x / Tactical 4x / Longshot 8x
      must be found. `V` cycles fitted optics. Rarity gated by wave (4x from wave 3, 8x from wave 5),
      no duplicates.
- [x] **True magnification.** FOV derived from `2·atan(tan(fov/2)/mag)` — 76° → 42.7° / 22.1° / 11.2°,
      not an arbitrary constant.
- [x] **Scoped presentation.** 4x and 8x hide the viewmodel and render a circular tube mask,
      mil-dot reticle, magnification readout. 1.35x and 2x keep the weapon on screen.
- [x] **Sensitivity scales with zoom** so aim feels identical at every magnification.
- [x] **Breathing sway** at high magnification, reduced when stationary.
- [x] **Safe ADS exit** — cancelled by dash, weapon swap, optic swap, sprint, death, pause.
- [x] **Recoil reduced 45% while scoped** so 8x stays usable.
- [x] **Loot cut from ~42 pickups/run to ~14.5.** Non-brute drop chance 54% → 15.5%;
      brutes no longer guarantee a drop (100% → 52%).
- [x] **Compensating balance pass** — see TUNING below.

### TUNING (Phase 1)
| | Before | After | Why |
|---|---|---|---|
| Seeker damage | 8 | 7 | fewer heals available |
| Gunner damage | 10 | 9 | " |
| Brute damage / HP | 17 / 14 | 15 / 13 | " |
| Health pickup | 30 | 40 | each find matters more |
| Regen | 11/s after 6s | 13/s after 5s | regen is now the main sustain |
| Warden hull / cores | 120 / 26×3 | 100 / 22×3 | leaner player kit |
| Spawn ramp | 1.5 − w×0.08 | 1.6 − w×0.07 | gentler pressure curve |

---

## Phase 2 — Weapons & loadout ✅ SHIPPED

- [x] **11 new weapons, 14 total**, across Pistol / SMG / Assault / Shotgun / Marksman /
      Sniper / Heavy / Energy / Melee. Verified every stat block is complete.
- [x] **Distinct behaviours, not reskins:** 3-round burst (Kestrel), sustained beam (Ion Lance),
      arcing gravity grenades with blast radius (Cinder GL), multi-target piercing (Rivet Gun),
      spin-up (Ogre LMG), melee arcs with knockback (Monoblade / Breaker).
- [x] **Range falloff** — damage tapers to 35% past each weapon's effective range, so shotguns
      and SMGs can't snipe.
- [x] **Movement penalty per weapon** (0.72 LMG → 1.14 Monoblade).
- [x] **Ammo types** (light / heavy / shell / energy / none) shown on the HUD.
- [x] **3-slot loadout.** Pick 3 before the drop; keys 1/2/3 select, Q cycles; looting a weapon
      replaces the active slot and drops the old one. Persists in profile.
- [x] **Parametric model builder** — new weapons compose from a shared parts library
      (receiver / barrel / shroud / vents / drum / mag / cells / 4 stock types), so the
      arsenal is maintainable instead of 11 bespoke model functions.
- [x] Armoury sells the full arsenal, priced 250–1900 by class and gated by level.

### Balance (measured, not guessed)
Ranged DPS spans 8.3–18.1 with role separation intact: Ripsaw-A tops raw DPS but falls off
past 18m; Ogre LMG sustains 115 damage per belt but moves at 0.72x; Cinder GL is weak
single-target (8.5) and strong on groups (20+). Retuned during testing: Ion Lance 4s → 5.6s
sustained fire, Vector-9 6.9 → 9.0 DPS.

## Phase 3 — Characters & abilities ✅ SHIPPED

- [x] **8 operators**, one free (Vanguard) + 7 purchasable (700–1800 credits, level-gated
      2–5), each with a distinct passive and a `F`-key active ability on a cooldown:
      Breach (dmg/rate burst), Triage (heal), Pulse Scan (radar reveal, doubles range),
      Aegis (dmg reduction + barrier), Overclock (speed + instant dash), Phase (stealth,
      breaks on firing), Sentry (deployable auto-turret with real target acquisition and
      fire logic), Mark (guaranteed crits).
- [x] Abilities wired into the systems they actually touch: fire rate, crit rolls, damage
      taken, movement speed, dash cooldown, enemy windup/fire timers, radar range —
      not bolted on as a separate damage-multiplier hack.
- [x] **Ability HUD module**: icon, name, state text, cooldown ring, screen-edge glow while active.
- [x] **Identity via hands, not models** — each operator recolours glove/pad/cuff/sleeve/
      strap/skin on the shared rig. Roster screen draws a small canvas portrait per operator
      from those same colours.
- [x] Roster screen: Preview → ability description → price/level-gate → Purchase → Select,
      all in one card, live-previews the hand recolour immediately on click.
- [x] Persists selection + purchases in the existing profile/credit system — no new currency.
- [x] Ability uptime checked numerically across all 8 (15–29%), no outlier dominates.

### Bug caught mid-phase
Phase 1's enemy damage tuning (seeker 8→7, gunner 10→9, brute 17→15) was documented as
shipped but had **silently never landed in the file** — same failure class as the earlier
`MAG_HOME`/`refreshPause` incidents. Re-applied and verified this phase; also tightened
seeker/brute standoff and telegraph timing so melee weapons (Phase 4) have a real window
to land a hit before the enemy's lunge.

## Phase 4 — Melee & enemy AI rework ✅ SHIPPED (with Phase 2)

- [x] Two melee weapons (Monoblade, Breaker) — swept arc test against enemies, the boss,
      and barrels, not a hitscan ray. Breaker adds knockback.
- [!] **The swing animation claimed here never actually existed** — `P.meleeT` was set and
      decremented but no code read it. Written for real in Phase 8; see that section.
- [x] Enemy standoff distance and telegraph duration tuned down for seeker/brute so a melee
      build can close inside the windup and land a hit — verified by reach math (weapon
      range + enemy hit radius comfortably exceeds standoff distance for both melee weapons).
- [x] Movement penalty compensates: Monoblade +14% speed, Breaker −14%, so melee has a real
      risk/reward profile rather than being strictly worse at range and strictly better up close.

## Phase 5 — Map & presentation polish ✅ SHIPPED

- [x] Radar legend and coordinate labels: 7–8px low-contrast grey → 9px white/bold with glow.
- [x] Objective banner: 9px → 12px bold white with a hard drop-shadow for contrast against
      any background.
- [x] Proximity/threat label: 8px dim magenta → 10px bold white with a magenta glow —
      readable at a glance during combat, not just on close inspection.
- [x] Extraction waypoint (added during the bug-fix pass) already carries large, high-contrast
      distance text and an edge-of-screen chevron.
- [ ] Per-map landmark naming on the radar — left for a future pass, not core to readability.

## Phase 6 — LAN multiplayer 🔶 IN PROGRESS

> **Note (Phase 8):** `server.js` was serving the stale `neon-runner.html` bundle rather
> than `index.html`, so every LAN client ran an old build. Fixed. Co-op status below is
> still accurate — see Phase 9 for the current plan.

**Shipped this session:**
- [x] **`server.js`** — dependency-free Node WebSocket relay + static file host.
      Functionally tested end-to-end: static 200/404 responses verified, real WebSocket
      upgrade (101 Switching Protocols) verified, correct frame encoding verified byte-for-byte,
      and a **live two-client test** confirming a second client's `welcome` roster includes the
      first client by name, and the first client receives a real-time `join` broadcast.
- [x] **`/net-info` endpoint** — server reports its own detected LAN IPs via `os.networkInterfaces()`,
      tested against a real interface.
- [x] **Multiplayer screen (UI/UX)**, reachable from the main nav:
      - On the host machine: auto-detects it's on `localhost`, fetches `/net-info`, and displays
        every shareable LAN address with a **Copy** button per address.
      - On a joined machine: shows the address you connected through (which is just the current
        URL, since that's how you got the page).
      - Live connection status dot (connecting / connected / disconnected-retrying) and a
        real-time roster of everyone connected, driven by actual `join`/`leave`/`welcome` messages.
      - Auto-reconnects on drop; cleans up its socket on page unload.
- [x] **Ghost players** — other connected clients render in-world as a simple glowing marker at
      their broadcast position, interpolated, visible only during a run.
- [x] Feature-guarded: works with no WebSocket support, no `fetch`, or a page opened as a local
      file (`file://`) instead of through the server — each shows a clear explanation instead of
      throwing. Caught by the automated harness (`fetch is not defined` under jsdom, which
      doesn't polyfill it) and fixed before shipping.

**Honest status — read this before expecting shared enemies/loot:** this is a working LAN
presence/relay layer with real UI, not yet authoritative co-op. You will see other connected
players' names, connection status, and their position moving around the map. You will
**not yet** see the same enemies, the same loot, or agree on who killed what — each client
still runs its own simulation. Turning this into real shared co-op needs the refactor below;
wiring deeper sync on top of the current single-player simulation before that refactor exists
would silently desync between clients, which is worse than the feature not being there.

### Refactors needed BEFORE deeper sync (do these during Phases 2–4)
- [ ] **Extract player state from the `P` singleton** into a `Player` factory so N players exist.
      Currently `P`, `camera` and the HUD are fused — this is the single biggest blocker.
- [ ] **Separate simulation from rendering.** `update()` mutates and draws in one pass;
      the host must be able to simulate without a camera.
- [ ] **Fixed-timestep simulation** (currently variable `dt`) so host and client agree.
- [x] **Seeded world generation is already deterministic** — the existing `runSeed` +
      xorshift RNG can be sent to clients verbatim. Already netcode-friendly.
- [ ] **Entity IDs** for enemies/pickups/projectiles (currently object references).
- [ ] Route all spawn/damage/pickup events through functions that can be replayed from the wire.

### Multiplayer feature list
- [x] Host / join UI with LAN IP display and copy button
- [x] Live roster with join/leave
- [x] **PvP: Deathmatch (incl. 1v1) and Team Deathmatch** — see below
- [x] Player nameplates on ghosts (red for hostile, green for friendly/teammate)
- [x] Kill feed, live scoreboard, frag limit, win detection
- [x] Death → 3s respawn at a spawn point chosen furthest from living opponents
- [ ] 2–4 player co-op waves (shared PvE simulation — still needs the refactor above)
- [ ] Shared or per-player loot rules
- [ ] Lag compensation for hitscan

## Phase 7 — PvP Deathmatch ✅ SHIPPED

Deathmatch turned out to be reachable *without* the authoritative-simulation refactor,
because PvP doesn't need synced enemies — waves are simply disabled during a match, so
the only things that must agree between clients are player positions, hits and scores.

- [x] **Four explicit modes**, each gated by player count so you can't start one that
      won't work:
      | Mode | Players | Notes |
      |---|---|---|
      | Co-op survival | 1–8 | PvE waves, no PvP |
      | **1v1 Duel** | exactly 2 | head-to-head, everyone hostile |
      | Deathmatch (FFA) | 3–8 | free-for-all |
      | Team Deathmatch | 2–8 | two teams by join-order parity, friendly fire off |
      The picker shows each mode's requirement live against the connected count
      ("Ready · 2 connected" vs "Needs 3+ players · 2 connected") and disables Start
      until the mode is actually playable.
- [x] **Selectable frag limit** (5/10/15/25) with automatic win detection and announcement.
- [x] **Player hit detection** — ray-vs-player using the same sphere maths as enemy
      hitscan, plus a headshot zone (2.2x). Melee arcs hit players too.
- [x] **Shooter-authoritative damage**: the firing client decides it connected and sends
      the target a `hit` event. Appropriate for a trusted office LAN; explicitly *not*
      cheat-resistant, and the code says so.
- [x] **Respawn loop** — dying in PvP no longer ends the run; 3s countdown overlay, then
      respawn at whichever candidate point is furthest from any living opponent.
- [x] **Scoreboard HUD** with live scores, team badges in TDM, and kill-feed toasts.
- [x] Late joiners are dropped straight into an in-progress match.

### Bugs caught by integration testing (not by syntax checks)
1. **`match` messages were never relayed.** The server had cases for `state` and `event`
   but not `match`, so pressing "Start match" would have put *only the host* into the
   match while everyone else stayed in co-op. Found by a scripted two-client test that
   asserted Bob actually received the message. Added the relay case.
2. **Late joiners missed the active match.** Added `room.match` so the server replays the
   current match state to anyone connecting mid-game. Verified with a third client.
3. **Team logic leaked into non-team modes.** The friendly-fire check tested
   `mode === 'tdm'` in some places but was reached from duel/FFA too; split out an
   explicit `mpTeamMode()` so only TDM has teams, and duel/FFA treat everyone as hostile.

Verified end-to-end against the live server: a 1v1 duel to 3 — match start reached the
second client, three kill events scored correctly, win condition fired.

---

## Phase 8 — Test harness, optics rework, UI overhaul ✅ SHIPPED

### The harness (do this first, it is why the rest of this phase found real bugs)

`test/` now holds a jsdom + stubbed-WebGL2 harness that loads the **real `index.html`
over HTTP** and executes the actual `<script>` tags in order — not `eval`, not a
re-implementation. Run it with:

```
node server.js &
node test/run-all.js
```

Six suites, all passing: `weapons`, `scopes`, `views`, `armoury`, `melee-bots`, `a11y`.
This exists specifically because this project's failure mode is edits that pass
`node --check` and then throw (or silently do nothing) at runtime. Every fix below was
verified through it, and most were *found* by it.

### Silently-lost patches found and fixed

Four more instances of the recurring failure class documented in Phase 3 and Phase 7:

1. **`server.js` was serving the wrong file.** `HTML_FILE` pointed at `neon-runner.html`,
   a stale 345 KB single-file bundle, so `node server.js` — the documented way to run the
   game, and the *only* way to run multiplayer — never served any of the split `js/` source.
   Every LAN client was playing an old build. Now serves `index.html`.
2. **`P.aim` was never assigned.** `08-hud.js` gated the entire scope-tube overlay on
   `P.aim > 0.55`, but nothing ever set `P.aim`, so it was permanently `undefined` and the
   comparison always false. The 4x and 8x optics could *never* render their tube, mask or
   reticle — they were a plain FOV change with no scope at all. This is the "scopes are
   just decoration" symptom. Fixed with a real aim-in ramp.
3. **The melee swing animation did not exist.** Phase 4 claims a "3-phase wind-up/arc/
   recover" animation. `P.meleeT` was set and decremented, but **no code read it** — grep
   returned exactly three lines, none of them a viewmodel. Written for real this time, and
   driven off a shared `MELEE_DUR` constant so the animation and the damage window cannot
   drift apart.
4. **The Armoury card rebuild had not landed.** Earlier notes describe `buildShop`/
   `shopCard`/`upgradeCard` and `.tabs`/`.cardGrid`/`.itemCard`. None of those functions or
   classes existed; the Armoury was still the old `.shopRow` list. Built for real (below).

Audit sweep also run across the whole codebase: every `$('...')`/`getElementById('...')`
id referenced in `js/` now resolves to a real element in `index.html` (152 refs checked,
0 missing), and every called function has a definition.

### Optics rework

- [x] **Scopes actually render.** See `P.aim` above — this was the headline bug.
- [x] **Sensible scope size.** The tube was a near-fullscreen mask (`92vh`); it is now a
      `58vh` porthole with a visible machined bezel and housing vignette, so ADS reads as
      *looking through an optic* rather than the viewport turning into a circle.
- [x] **A distinct reticle per tier**, not one crosshair at four sizes (`RETICLES` in
      `06-player.js`):
      | Optic | Reticle | Presentation |
      |---|---|---|
      | Iron 1.35x | none — keeps the standard crosshair | no tube |
      | Reflex 2x | illuminated dot + reference ticks | no tube, weapon visible |
      | Tactical 4x | duplex: thick posts thinning to a fine centre, holdover bars | tube |
      | Longshot 8x | fine crosshair, graduated holdover + windage marks | tube |
- [x] **Integral optics.** Long guns ship with the glass they were designed around, so a
      sniper is scoped on pickup instead of waiting for a scope drop: Rail Lance (Sniper) →
      8x, Verdict DMR (Marksman) → 4x. Fitted on equip, removed on swap-off. Looted optics
      (`P.lootOptics`) are tracked separately and survive weapon swaps.
- [x] **Equip / unequip / choose between optics.** `V` cycles forward, `Shift+V` backward;
      iron sights sit in the cycle, so cycling back once is "unscope". The HUD shows a
      strip of every fitted optic with the active one lit, rather than a single label.
- [x] **The crosshair can never vanish.** An optic only hides the crosshair if it draws its
      own sight picture (`.dotoptic` / `.tube`). Regression-tested — this was briefly broken
      during this phase and the test now guards it.

### Performance

- [x] **Fixed the wave-3 stall.** `body.blackout::before` animated a 260→320px fullscreen
      inset `box-shadow` on an infinite loop for the whole 24-second blackout event, which
      forces a full-viewport repaint every frame on top of the WebGL canvas. Wave 3 is
      exactly when `startEvent('blackout')` first fires (`wave % 3 === 0`). Both this and
      the identical `body.critical::after` low-integrity pulse now animate **opacity** over
      a statically-painted shadow, which stays on the compositor.

### UI overhaul

- [x] **Deploy is now a three-step flow** — 1 Drop zone → 2 Loadout → 3 Confirm — with
      numbered step headers instead of one dense two-column form. Map zones are a card grid
      with stacked thumbnails; weapons, perks and difficulty are all cards; the slot picker
      and the drop button are large targets. All element ids preserved, so the existing
      builders kept working unchanged.
- [x] **Armoury rebuilt as a tabbed card storefront** — Weapons / Loadouts / Drop zones /
      Upgrades / Contracts, one pane at a time, every entry an `.itemCard`. Upgrade cards
      show level pips and `n / max`. Purchase, upgrade and contract flows verified by test.
- [x] **A shared card system** (`.step` / `.cardGrid` / `.itemCard` / `.tabs`) so Deploy and
      Armoury use one visual language instead of each inventing its own.

### Feedback & accessibility

- [x] **Directional damage indicators.** `damageDirection()` and its CSS already existed and
      fired with correct bearings — they were simply invisible in practice: a 6x34px sliver.
      Redrawn as a chevron with a soft arc on a ring around the crosshair. Note the inline
      `transform: rotate()` carries the bearing, so `.dd` animates opacity only; animating
      its transform would point every arrow the same way.
- [x] Damage arrows stay legible under `prefers-reduced-motion` (the blanket
      `animation-duration: .01ms` override would otherwise blink them out of existence —
      they are information, not decoration).
- [x] Contract HUD no longer overlaps the radar legend. It was pinned at a hardcoded
      `top: 300px` while the radar cluster's height varies with responsive scaling and live
      content; it now positions from the radar's measured bottom edge and repositions on resize.
- [x] Accessibility pass re-verified by test: `aria-live="off"` on `#hud`, focus-visible
      rings on every interactive control type (including the new cards and tabs),
      reduced-motion and forced-colors support, no unnamed interactive controls.

### Re-verified after all of the above
- [x] All 14 weapons fire, decrement ammo, and report correct magazine sizes.
- [x] Slots 1/2/3 switch the active weapon and update the HUD.
- [x] Melee, burst and beam weapons all register.
- [x] Bots spawn, enter the scene, move and survive in solo PvP.
- [x] All eight menu views build without throwing.

---

## Phase 9 — PvP-only multiplayer, bots, and the long tail ✅ SHIPPED

### Co-op removed (deliberately, not deferred)

Co-op is **gone**, not postponed. It had never been more than position sync — every client
ran its own drone simulation, so "co-op" showed you a friend's avatar walking around a
different fight. Shipping a mode that advertises shared PvE and does not deliver it is
worse than not having it. `MP_MODES` now contains only Duel / Deathmatch / TDM, and solo
PvE waves live where they always worked: the Deploy screen.

If shared PvE is ever wanted, the blockers are unchanged and still real: `P` is a
singleton, `update()`/`render()` are fused, the timestep is variable, and entities are
object references rather than ids.

### Bots — the sixth silently-lost patch, and the largest

Phase 6 claimed "PvP and bots are done and tested". The bot *code* was all there —
`spawnBots`, `updateBots`, `botDamage`, `castBots`, `BOT_SKILL`, nameplates, LOS checks —
and **nothing called any of it.** No UI, no spawn on match start, no update in the game
loop, no hit test in `shoot()`. Bots had never once run in the actual game.

Worth noting for the record: an earlier test in this session "verified bots work" by
calling `spawnBots`/`updateBots` directly. That proved the functions worked, not that they
were *wired* — which is exactly the failure this project keeps repeating. Tests now assert
the path a player actually takes (click Start match → bots exist in the scene).

Now genuinely wired:
- [x] Bot controls on the Multiplayer screen — count (0/1/2/3/5/7) and skill (Recruit →
      Elite), rendered *before* any connectivity bail-out so they survive having no server,
      no WebSocket, or a `file://` page.
- [x] `spawnBots` on match start, `updateBots` in the frame loop, `castBots` in the firing
      path, splash damage in `boom()`.
- [x] **Offline play needs no server at all.** Mode minimums count *combatants* (humans +
      bots), so solo + 3 bots satisfies Deathmatch; `mpSend` is a no-op with no socket and
      the local player is assigned an id so scoring works.
- [x] Bots appear on the scoreboard with a `BOT` badge — they score into the same map as
      humans, so the frag limit behaves identically either way.
- [x] TDM teams alternate and count the player, so every bot count splits evenly.
- [x] No PvE bleed-through: `startGame()` queues a wave, which a PvP match now clears.

### PvP is no longer pay-to-win

Permanent Armoury upgrades and credit-gated weapons used to carry straight into
deathmatch, so whoever had ground more credits simply won. Inside an active PvP match
(`mpCompetitive()`): permanent upgrades are neutralised and the **entire arsenal is issued
to everyone**. Operators and perks still apply — those are per-run sidegrades, not
purchased power.

Anti-spam tuning (`PVP_TUNE`, 05-weapons.js) applies only in PvP, never to PvE:

| Weapon | Damage | Fire gap | Blast | Why |
|---|---|---|---|---|
| Cinder GL | ×0.55 | ×1.60 | ×0.60 | grenade spam is *the* deathmatch problem |
| Ion Lance | ×0.70 | — | — | no-travel-time hitscan beam |
| Ripsaw-A | ×0.82 | ×1.15 | — | full-auto shotgun in corridors |
| Ogre LMG | ×0.85 | ×1.10 | — | 100-round suppression |
| Rail Lance | ×0.90 | ×1.15 | — | piercing one-shot potential |
| Rivet Gun | ×0.88 | ×1.10 | — | pierces two targets |

Also fixed: `boom()` damaged enemies and *you* but never bots or other players, so the
grenade launcher was inert in PvP. Splash now applies to every combatant.

### Optics, continued

- [x] **PiP scopes** — the world outside the lens stays visible but blurred and dimmed
      (`backdrop-filter` + a radial mask), with a machined housing ring, rather than the
      screen becoming a black circle. Blur and dim scale with magnification (2x barely
      occludes, 8x heavily). Measured cost: none — 48fps scoped vs 46fps unscoped.
- [x] The overlay was moved **out of `#hud`** to sit between the canvas and the HUD, so the
      lens blur softens the world without blurring HUD text.
- [x] Weapon and hands are hidden while scoped — your eye is at the ocular lens, so the
      viewmodel is behind the sight picture, not in it.

### Feel and feedback

- [x] **Grenades** (`G`) — two per life, independent of the weapon in hand, so there is
      always an answer to someone holding an angle. Refill on respawn and on a new run.
- [x] **Opt-in weapon pickups** (`T`) — walking over a crate no longer swaps your gun.
      In PvP it always prompts; in PvE it prompts only when it would overwrite a filled
      slot, so an empty-handed pickup still just works.
- [x] Fixed **"+-40%"** on the Easy difficulty card. Easy pays `0.60`, i.e. 40% *less*, and
      the code hard-coded a `+` prefix. `signedPct()` derives the sign.

### The long tail (level 6 → 100)

Every SHOP item was gated at level ≤ 6 and upgrades maxed at 3–4, so past about level 6
there was nothing left to earn and nothing to spend credits on.

- [x] Upgrade tracks deepened (Plating/Magazines to 10, Thrusters/Broker to 8) with
      superlinear costs.
- [x] Four new tracks, gated by clearance: **Ordnance** (lv7, grenade capacity),
      **Field Aid** (lv10, regen delay + rate), **Handling** (lv14, scope sway + recoil),
      **Salvor** (lv18, XP rate).
- [x] New **Optics** shop category (lv8/12/16, 2.2k–7.5k cr) — buy an optic to drop in with
      it fitted instead of hoping one drops.
- [x] Maxing everything now costs **184,305 cr**, a real sink.
- [x] A test asserts **every upgrade key is actually read by game code** — no more selling
      the player a no-op. This is the guard the earlier phases needed.

### Housekeeping

- [x] `neon-runner.html` (the stale 345 KB single-file bundle that caused the server bug)
      moved to `legacy/` with a note. Nothing referenced it.
- [x] Multiplayer screen copy no longer describes the removed co-op mode.

### Test suites (9, all passing)

`weapons`, `scopes`, `views`, `armoury`, `melee-bots`, `a11y`, `bots-offline`,
`pickups-nades`, `progression` — run with `node server.js &` then `node test/run-all.js`.

---

## Phase 10 — Arenas, PvP presentation, weapon wheel ✅ SHIPPED

### Two new maps, built for teams (5 total)

`Ironworks` (roofed casting hall) and `Spillway` (drained basin, open sky) share one
generator, `buildSymmetricArena()`. They exist because **Team Deathmatch on an asymmetric
map hands one side the better ground** — every piece of cover placed at `(x, z)` is
mirrored to `(-x, -z)`, giving 180-degree rotational symmetry with spawns at opposite ends
of the long axis. A test asserts the symmetry rather than trusting it: both come out
**100% of blockers mirrored**.

- [x] All five maps are selectable in multiplayer regardless of what has been bought
      (`mapUnlocked()`), with a new arena picker on the Multiplayer screen. Credit gating
      still governs PvE progression.
- [x] Ironworks 1,400 cr (lv3) and Spillway 2,400 cr (lv6) in the Drop zones tab for PvE.
- [x] A `test-maps` suite builds **every** map and asserts geometry, collision volumes and
      a spawn point that is inside bounds and not inside a wall.

**Bug found while building them:** the neon fill rig was four point lights at coordinates
hardcoded for Rain District, created once at boot. On the larger arenas they fell outside
the play area and the map rendered as a black void. Replaced with `placeNeonLights(theme)`,
which spreads six lights to fit whatever map is being built and scales their range to its
bounds — all five maps benefit.

### PvP presentation

- [x] **PvE furniture is hidden in PvP** (`body.pvpHud`). Wave and hostile counters, the
      "clear five waves, then extract" objective, the extraction waypoint, daily contracts,
      the drone legend and the boss bar all describe a mode you are not playing.
- [x] **The scoreboard no longer blocks the screen.** It sat dead centre at all times,
      right where you aim. It is now a compact top-left strip showing the leader and you,
      and expands to the full board only while **TAB** is held.
- [x] **The radar shows combatants.** It drew pickups, drones and barrels — none of which
      exist in PvP — so it was blank. Now: teammates always; hostiles only within 34m, or
      anywhere for ~1.6s after they fire. Gunfire gives you away, nothing else does, which
      is a real design rather than a wallhack or an empty circle.
- [x] **Nameplates no longer show through walls.** Labels draw with `depthTest: false` so
      they are not clipped by the wearer's own head — which also made them hang in the air
      through solid geometry. Now gated on a real line-of-sight check and culled past 70m.
- [x] **Better player model.** Bevelled chest and pauldrons instead of plain boxes, jointed
      knees and elbows (driven off the half-wave so they cannot hyperextend), backpack,
      harness, cheek guards, and the team accent repeated on chest / shoulders / shins /
      visor so you can call a target's team from the silhouette.

### PvP weapon drops

Weapon crates were spawned only by `startWave()`, which is disabled during a match — so a
deathmatch had **no drops at all** and everyone fought their spawn loadout forever. Arena
pickups now run on their own cycle: a weapon every 22s and health/ammo every 16s, spawned
away from every living combatant so nobody camps a spawn on top of one, capped at four
live crates, drawn from the whole arsenal minus what you already carry.

Taking one still needs the `T` prompt, so a drop is a decision, never an accident.

### Weapon wheel (hold Q)

GTA-style radial selector. **TAB was already the scoreboard** (FPS convention), so the
wheel is on **hold Q** — a tap still does the old quick-swap, preserving muscle memory.
The pointer is driven by accumulated mouse delta rather than cursor position, because the
game holds pointer lock and there is no cursor to read. Time slows to 35% while it is open
rather than stopping, so it cannot be used as a free pause in PvP.

### Also fixed

- **The scoreboard lied about bot teams.** It derived teams from id parity via
  `mpTeamOf()`, which is correct for humans (teams come from join order) but wrong for
  bots, which get `b.team` assigned explicitly in `spawnBots()`. The board disagreed with
  who actually shot whom. Now uses the real team, and a test asserts the badges match
  combat behaviour and that sides stay balanced with the player counted.

### Test suites (12, all passing)

`weapons`, `scopes`, `views`, `armoury`, `melee-bots`, `a11y`, `bots-offline`,
`pickups-nades`, `progression`, `maps`, `wheel-drops`.

---

## Phase 11 — Wheel redesign, two-weapon PvP, colour pass ✅ SHIPPED

### Weapon wheel, rebuilt as a real radial menu

The first version was floating cards arranged in a circle, which throws away the entire
point of a radial menu. Rebuilt against the standard guidance (see Sources in the session
notes): **real annular pie slices, so the whole angular sector is the target** — Fitts's
law, the nearer and bigger the target the faster and more accurately you hit it — with a
**hollow centre** that serves as both the dead zone and the "release here to cancel"
target. Drawn as SVG wedges with HTML labels on top so the display font stays crisp.

- [x] Per-weapon tint on the selected wedge (fill, stroke, glow, label).
- [x] Live ammo readout per slice (`22 / 30`), class, and slot label.
- [x] 30px dead zone; the pointer stays dim until it commits to a direction.
- [x] Hub shows the pending choice, its sub-line, and the release hint.

### PvP carries two weapons

`slotCount()` returns **2 in PvP, 3 in PvE**. Two guns force a real commitment — a long
gun and an answer for close range — instead of a three-slot toolbox that covers every
range at once. Slots are labelled **Primary / Secondary** in PvP, the `3` key is inert,
the HUD strip shows two, and the wheel shows two. PvE is unchanged.

### Colour pass

The complaint was fair: outside the neon itself, almost everything rendered black.

**Two failed attempts worth recording**, because the obvious fixes were both wrong:
1. Lifting shadows globally in the grade — brightened the *fog* and produced a flat grey
   haze that destroyed the neon-noir contrast.
2. Raising ambient/hemisphere light — same problem, more so.

The fix was that colour belongs in the **materials**, not the atmosphere. The base
palette was near-black (`concrete 0x0b0e18`, `deck 0x14161f`, `grime 0x0d1116`), so every
unlit surface was a silhouette no matter how it was lit. Those are now tinted blue-violet
/ steel / rust, and the lighting sits close to where it started.

- [x] A real grade stage in the final shader: vibrance, plus split-toning (cool shadows,
      warm highlights — the standard neon-noir move) on a **band-limited** shadow mask that
      deliberately skips the very darkest pixels so distant fog is never lifted into haze.
- [x] `tintA` is set per map from its accent colour, so each drop zone has its own cast
      instead of all five grading to the same blue-black.
- [x] Vignette softened — it was crushing the frame edges to pure black.
- [x] A **Colour** slider in Settings drives grade + vibrance together, so the original
      near-monochrome look is still available at 0.

### Models wear the operator you unlocked

`buildPlayerModel()` now takes an operator id and dresses the figure from that character's
`hands` palette — the same colours the first-person hands use, so the person you see
across the map is wearing what you would see on your own arms if you picked them. Ghosts
read the operator from the roster (already relayed in `hello`); bots are assigned
different operators so a match is not four identical figures. The hostile/team accent
still overrides the trim, because that has to stay readable regardless of operator.
Tested: all 8 operators produce visually distinct models.

### Test suites (13, all passing)

Added `test-look` (operator models, grade wiring, Colour slider, PvP slot count, wheel
contents). Full list: `weapons`, `scopes`, `views`, `armoury`, `melee-bots`, `a11y`,
`bots-offline`, `pickups-nades`, `progression`, `maps`, `wheel-drops`, `look`.

---

## Phase 12 — Folder soundtrack, procedural imagery ✅ SHIPPED

### Music is folders now, not a settings screen

The whole track-management UI is gone — file pickers, URL fields, per-slot playlists,
clear buttons, and the `addTracks` / `addTrackUrl` / `removeTrack` / `renderPlaylist` /
`saveUrls` functions behind them. Music is files on disk:

```
music/menu/      plays in the menus
music/combat/    plays during a run
```

Named `01`, `02`, `03`, … in any of `.mp3 .ogg .m4a .opus .wav .webm`. Both lists are
**shuffled at the start of every match**, so a run never opens on the same track twice.

**A server endpoint was the obvious answer and was explicitly not wanted**, so discovery
is client-side: `probeTrack()` tries each extension for a number, `scanMusicFolder()`
walks upward and stops after three consecutive misses. That is why the numbering
convention exists — it is the cost of needing neither a server nor a manifest to keep in
sync, and the README says so rather than leaving it as folklore. Works over `node
server.js` or straight off disk.

What is left in Settings is what belongs there: source, volume, prev/next, a **Rescan
folders** button, and a status line reporting what was found (or that the built-in
adaptive score is covering).

`server.js` keeps only the widened audio MIME table, so tracks actually serve with the
right content type when the game is hosted.

**Removed:** the stray root `README.txt`, which documented the old "add them by relative
path in Settings" workflow. That workflow no longer exists, so the file was actively
misleading; `music/README.md` replaces it.

### Imagery, generated rather than downloaded

The menus were entirely type — every weapon was a name and a paragraph.

`drawWeaponIcon()` draws a side-profile silhouette per gun onto a canvas, derived from
the **same `build` parameters the 3D viewmodel is composed from** (length, bore, receiver
box, stock type, magazine, drum, cells, rail, bulk), plus the weapon's own tint. Melee
weapons get a blade or hammer profile instead. Icons now appear on Armoury cards, Deploy
weapon cards, and weapon-wheel slices.

Generated in code rather than fetched from the web on purpose: the icons cannot drift out
of sync with the weapons they depict (a new gun gets an icon for free), there are no image
files to ship, no network dependency, and no third-party licensing to audit. Operator
portraits and map thumbnails already worked this way; this extends the same approach to
the arsenal.

### Test suite (13, all passing)

`test-music-icons` asserts the folders exist and are documented, that the old
track-management UI is **gone from both the source and the markup** (not merely hidden),
that shuffle reorders without losing tracks and resets the play position, that starting a
match reshuffles, and that all 14 weapons draw an icon without throwing and those icons
reach the Armoury and Deploy screens.

---

## Phase 13 — Soundtrack fixes, three-lane map, level 100 ✅ SHIPPED

### Music: three separate bugs, one symptom

"I added my music and it isn't working" turned out to be three faults stacked:

1. **Autoplay policy.** The scan found every track, set the source, called `play()` — and
   the browser silently rejected it, because the page had not yet seen a user gesture. The
   promise rejection was swallowed by an existing `.catch(() => {})`. Now `unlockAudio()`
   retries on the first `pointerdown` / `keydown` / `touchstart`.
2. **A probe timeout silently dropped a track.** The `<audio>` metadata probe had a 2.5s
   limit; a 4.8 MB MP3 exceeded it and simply never appeared in the playlist — 5 of 6
   combat tracks were found and nothing said otherwise. Probing is now **HEAD-request
   first** (instant and definitive over http), with the audio probe as the `file://`
   fallback at a 12s timeout. All 6 now load.
3. **The humming.** Three oscillators (55 / 82.5 / 110 Hz) were started unconditionally in
   `initAudio()` and ramped to 0.7 by `startGame()`. They were independent of the music
   source, so they droned underneath the player's own tracks with no way to switch them
   off. **Removed.**

Also removed: the **Source dropdown**. There was no decision worth surfacing — if there
are files they play, otherwise the adaptive score covers, and `autoMusicSource()` decides.
`M` (toggle source) is gone with it; **N** now skips and reshuffles when the list wraps,
never opening a new pass on the track that just played.

### Sunken Metro replaced by Container Yard

Metro was a single enclosed trench: one held angle covered the whole playable width, so
fights were decided by who looked down it first. The replacement is a **three-lane** map,
the standard competitive shape:

- Three lanes with **one chokepoint each** — the two divider walls mean no single position
  covers more than one lane.
- **Cross-links** cut into the dividers at roughly a third and two thirds of the length,
  turning three corridors into two loops so players circulate instead of holding an end.
- A **contested tower** in the mid lane: the strongest position and the most exposed.
- 180-degree rotationally symmetric, verified by the same test the other arenas use.

### Bots spawned in the void on Neon Heights

`botSpawnPoint()` called `hitsWall(x, z, 1.2)` with **no feet argument**, so every walkable
roof deck counted as a wall. The only points that passed were the gaps *between* decks —
i.e. open air — and `floorAt()` then returned the map floor 46m below. Bots were spawning
under the level. Fixed by resolving the surface first and testing against it, exactly as
the player does, plus rejecting surfaces that are the void floor on a map with a drop.

Bots also had no ledge awareness — they snapped to `floorAt()` every frame, so walking off
a catwalk teleported them into the void. A step down of more than 2m is now treated as a
wall, so they path around edges. A test spawns 40 bots on each of the five maps and
asserts none land in the void or inside geometry.

### The weapon in their hands

The figure carried a hard-coded grey box, so everyone appeared to hold the same thing
regardless of what they were shooting you with — bad information in a deathmatch.
`setHeldWeapon()` attaches a `.clone()` of the real gun model to the right arm (the
viewmodel originals cannot be reparented; the clone shares geometry and materials, so it
is cheap). Bots are issued a weapon from a pool; players broadcast theirs in the state
packet, so a swap is visible to everyone.

### Level 100 is now a real cap

Two problems: the highest gate in the whole catalogue was **level 18**, and the XP curve
(`400·l^1.45`) needed **12.8M XP** — about 5,000 runs — to reach 100. The cap was
decorative in both directions.

- Curve retuned to `210·l^1.18`: ~2.2M total, roughly **870 runs**. A long tail that can
  actually be finished. `LEVEL_CAP` is enforced in `addXP`, so XP stops accruing at the
  cap rather than vanishing.
- Upgrade tracks deepened (Plating/Magazines to 20, Broker to 15, Thrusters/Field Aid/
  Handling to 12, Salvor to 10). Maxing everything now costs **921,060 cr**.
- **Every consumer clamped.** At the new depths the old linear formulas produced nonsense:
  dash cooldown went negative (now multiplicative, `2.6·0.94^n`), regen delay went negative
  (floored at 1.2s), scope sway and recoil inverted (floored). A test maxes every track and
  asserts none of them cross zero.
- A new **Field kit** tier fills levels 22-90: Assault Harness, Bandolier, Deep Pockets,
  Combat Stim, Reactive Plating, Forward Cache, Veteran Contract. All seven are wired into
  real systems, and a test asserts each id is read by game code — not merely defined.

### Tests (13 suites, all passing)

`test-armoury`'s tab assertion was hardcoded to a count and broke when the Field kit
category was added; it now asserts against `SHOP_TABS.length`, so extending the catalogue
no longer fails a test that is supposed to be checking the tab bar renders.

---

## Phase 14 — Player models rebuilt ✅ SHIPPED

The figures were boxes: constant-width limbs, cubes butted at the joints, a cube head.
Rebuilt against low-poly character practice, where **silhouette and proportion carry a
figure at distance** — surface detail does not. Three changes did the work:

1. **Tapered limbs via `LatheGeometry`.** A lathe sweeps a radius profile around Y, so
   arms and legs thin toward wrist and ankle with smooth normals. Constant-width stretched
   boxes were the single largest cause of the boxy look.
2. **Joints instead of butted ends.** Box ends meeting at a shoulder leave a hard seam that
   visibly comes apart when the limb rotates. Rounded joints hide the seam and read as
   articulation.
3. **Real proportions.** 1.85m over roughly 7.7 head-heights, with an elliptical torso (a
   lathe scaled on Z) rather than a cube, so the figure reads as a person from the side as
   well as the front.

Geometry is built **once** and shared by every figure (`playerGeoms()`); only materials are
per-model, since those carry the operator's colours. A dozen bots cost one set of buffers.

**The first attempt was worse, and the screenshot is why I know.** Sizing the joints
generously and giving them the armour material (metalness 0.70) produced a figure covered
in bulging chrome spheres — bubble wrap, not a soldier. Fixed by sizing every joint to sit
*inside* the limb silhouette rather than outside it, moving them to the suit material, and
dropping plate metalness to 0.35. Slab details (chest band, harness, pouches) went from
scaled spheres — which read as blobs — to actual boxes.

The held weapon also moved from the shoulder group to the **forearm**, so it tracks the
elbow instead of swinging from the wrong pivot.

### Bug found while inspecting the model

The bot I placed for a close-up turned up at **y = 35.9** — standing on a skyscraper roof.
`floorAt()` returns the top of any *walkable* blocker, and `tower()` marks building roofs
walkable, so `botSpawnPoint()` considered a 36m rooftop a perfectly legal spawn: the
surface resolved, and the wall test passed because the bot was standing on top of the
thing. Now bounded to roughly the height the player drops in at, which still allows
container stacks and the Neon Heights roof decks (which spawn high by design) while
rejecting scenery. `test-maps` asserts it across all five maps, alongside the existing
void and geometry checks.

---

## Phase 15 — Locational damage, bot operators, extraction screen ✅ SHIPPED

### Locational damage

Hit detection classified a hit as "head" or "not head" and multiplied by 2.2 or 1 — which
threw away most of a figure that now has real proportions. `classifyHit()` takes the actual
ray-sphere intersection point, converts it to a height above the feet plus a lateral
offset, and returns a zone:

| Zone | Multiplier | Why |
|---|---|---|
| Head | ×2.60 | small and hard to hit, so it should pay properly |
| Chest | ×1.00 | the reference |
| Abdomen | ×0.90 | |
| Arm | ×0.80 | off the centre line at torso height |
| Legs | ×0.70 | the easiest part of a running target to hit |

A spread rather than head-vs-everything: it rewards aiming up without making a leg hit
feel like it did nothing. Applies to players and bots through the same helper, and the
zone is surfaced as a toast (`HEADSHOT` / `ARM` / `LEG`) so a small number is legible
rather than mysterious. Tests assert both the classification *and* that the multiplier
reaches applied damage — classifying correctly but not using the result would be exactly
this project's usual failure.

### Bots fight like the operator they wear

Bots already wore an operator's colours. They now run **that operator's ability**, on its
real cooldown from `CHARACTERS` — otherwise the skin is a lie and every bot plays
identically. Only effects meaningful for an AI are implemented (a bot has no scope, no
dash input, no deployables), so each maps to something observable:

| Operator | Ability | Bot behaviour |
|---|---|---|
| Vanguard | Breach | +25% damage, 35% faster fire |
| Corpsman | Triage | heals 45 |
| Scout | Pulse Scan | +22% accuracy |
| Bulwark | Aegis | takes 55% less damage |
| Blur | Overclock | +45% move speed |
| Wraith | Phase | faster and 25% less damage taken |
| Engineer | Sentry | 45% faster sustained fire |
| Hunter | Mark | +35% damage |

They fire it on contact or when below 45% health, the visor lights in the ability colour
while it runs, and everything reverts cleanly when it ends. A test asserts **every**
operator's ability id is handled — so adding an operator without teaching bots to use it
fails the build rather than silently shipping a cosmetic-only skin.

### Extraction screen

The old screen had a real bug on top of being plain: the title used a fixed display size
and overflowed its card, so "EXTRACTED" rendered as **"EXTRACTE"**. Everything is fluid
now, and the screen was restructured as outcome → what you did → what it paid → where you
are now:

- **Map and difficulty stamp** in the header.
- **Four stats** including a new **accuracy** readout (tracked per trigger pull, not per
  pellet, so shotguns aren't punished for firing nine of them).
- **Payout breakdown** — score, kills, waves, Wardens, extraction, contracts, each with its
  contribution, plus the difficulty multiplier as a badge. A bare "+2,107 cr" told a player
  nothing about what to chase; this makes extraction and Warden kills visibly worth it.
- **XP progress bar** toward the next level, with a MAX LEVEL state at the cap, replacing
  a line of small grey text that was easy to miss.

### Tests (14 suites, all passing)

New `test-combat-end` covers zone classification, that zone multipliers reach real damage,
bot operator spread, ability fire/revert, full ability coverage, and the extraction screen
populating every field.

---

## Phase 16 — Hitboxes, bot facing, explosion cost ✅ SHIPPED

Three reports, all three real.

### Hitboxes were a beach ball

Players and bots were tested against **one sphere of radius 0.95** centred at chest height
— a 1.9m ball around a figure roughly 0.5m wide. Shots that visibly missed by a metre
registered as hits, and the "head" test was a guess at where inside that ball you landed.

Replaced with the shape the model actually is: a vertical capsule for the body (0.42m to
1.52m, radius 0.34) plus a 0.17m sphere for the head. The numbers are taken from
`buildPlayerModel`, so the hitbox and the geometry cannot drift apart. Measured: half-width
went **0.95m → 0.32m**, and a shot a metre off-centre now correctly misses.

Kept slightly generous (0.34 against a ~0.25 torso half-width) on purpose: hits are
shooter-authoritative with no lag compensation, so a little padding absorbs interpolation
error rather than making opponents feel bulletproof.

### Bots ran at you backwards

`mpApplyGhost` set `rotation.y = yaw + Math.PI` because the model faces **-Z**.
`updateBots` set `rotation.y = b.yaw` with **no correction**, and `b.yaw` is an
`atan2(dx, dz)` heading — so every bot faced exactly 180° away from where it was going.
That is what made their weapons look like they were mounted backwards: the *bot* was
backwards, not the gun. Now matches the ghost path. Verified: facing-vs-heading dot went
from -1 to **1.00** across four bots.

### Explosions stuttered

`boom()` called the full `damageEnemy()` for every victim, and the per-hit feedback is the
expensive part — a DOM damage number, a `setTimeout`-backed hitmarker, and **a fresh Web
Audio node graph each**. A grenade catching a dozen drones did all of that twelve times in
one frame.

Added a `quiet` splash path: reduced spark counts, at most three damage numbers per blast,
no per-victim audio or hitmarker, and one aggregate hitmarker plus one sound for the whole
explosion. Measured on a 12-enemy blast: **7.6ms → 1.6ms** in the browser (the test, which
runs under jsdom with its slower DOM, shows 13.8ms → 6.8ms). The old cost was roughly half
a frame budget, which is exactly the hitch that was reported.

### Tests

`test-combat-end` now also asserts hitbox width and that wide/low shots miss, that bot
models face their own heading, and that the splash path stays inside a frame budget and
beats the per-enemy path.

---

## Phase 17 — Grid failure fixed, event pool, muzzle alignment ✅ SHIPPED

### The blackout was broken — twice, for different reasons

Reported as "our bright one made it a bit broke". Correct on both counts, and the second
cause was the real one.

**Cause 1 — the colour pass raised the floor it was multiplying.** Blackout dimmed ambient
by a fixed factor, but Phase 11 raised the ambient base and added a shadow *lift* to the
grade. Measured at night in Rain District:

| | hemi | moon | shadow lift |
|---|---|---|---|
| original | 0.066 | 0.042 | off |
| after colour pass | **0.099** | **0.056** | **ON, fighting it** |
| now | 0.020 | 0.011 | off |

**Cause 2 — the city is not lit by scene lights at all.** Window blocks are `emissive` on
their facade material and every neon strip, sign and glow quad is a `MeshBasicMaterial`.
Both ignore scene lighting completely, so dimming lamps never touched them: during a
"district power failure" every window in Rain District stayed lit. `setCityPower()` now
scales the emitters themselves (base values captured once so the level is absolute, not
compounding), eased over a beat so the grid dies rather than snaps.

Enemy shells are deliberately excluded — their glow is the point of the event.

**Making it total.** In the grade the *base* image is crushed by 86% while bloom is added
at full strength afterwards. Bloom comes from the bright-pass, so hot shells, muzzle flash
and tracers punch through while anything merely lit goes black. Dimming after the bloom
add would have killed both.

### One event became six

Every third wave played out identically because the pool had exactly one entry. Now six,
drawn at random and never repeating back-to-back, mixing hazards with gifts so the banner
is suspenseful rather than always bad news:

| Event | Kind | Effect |
|---|---|---|
| Grid failure | hazard | total darkness, radar ×0.75 |
| Power surge | hazard | enemies ×1.28 speed, payout ×1.6, loot ×1.5 |
| Smog bank | hazard | fog ×3.2, radar ×1.35 to compensate |
| Grav flux | boon | gravity ×0.55, jump ×1.55 |
| Supply cache | boon | real airdrop — three weapon crates and a mod |
| Ion wind | boon | overdrive granted, payout ×1.25 |

Every multiplier is read somewhere real — `EV.mul` feeds enemy spawn speed, gravity, jump,
loot rolls, radar range and fog density. A HUD banner names the event, says what it means
for you, and counts down. A test asserts **each event actually moves something**, because
a cosmetic event would be worse than none.

### Tracers left the wrong place

The viewmodel is drawn in its own scene by `vmCam` (55°, parked at the origin) while the
world uses `camera` at `CFG.fov`. A point on the gun therefore has no world position, and
tracers used a fixed 0.62m offset down the aim vector — so rounds left a point near the
crosshair rather than the barrel.

`muzzleWorldPos()` projects the muzzle through `vmCam` to find where it actually *appears*
on screen, then unprojects that same screen point through the world camera. Measured error
between the barrel on screen and the tracer origin:

| | hip | ADS |
|---|---|---|
| old fixed offset | 0.191 | 0.155 |
| now | **0.000** | **0.000** |

Grenades use the same helper, and it falls back to the centre when the viewmodel is hidden
by a tube optic.

### Tests (16 suites)

New `test-events`: every event changes something, no back-to-back repeats, the draw is
varied, window lights and city power actually drop and come back, and tracers leave the
visible barrel in both hip and ADS.

---

## Phase 18 — Cross-origin profile sync ✅ SHIPPED

`localStorage` is scoped per **origin**, so `http://localhost:8080` and
`http://192.168.0.39:8080` kept entirely separate saves. Opening the game "the other way"
on your own machine showed a brand new account — no credits, no unlocks, level 1. The old
README just warned about it and told the player to pick one address and stick to it.

The server now keeps a single `profile.json` and serves it **only to the machine it is
running on**, so the host's progression follows them across both addresses. The
same-machine test is the request's source address: loopback, or one of this machine's own
interfaces. A genuine LAN peer always presents a different source IP and gets a 403.

That gate is the whole design. Without it, everyone who joined would inherit — and then
overwrite — the host's account. Nine address cases are asserted in `test-profile-sync`,
covering loopback, v4-mapped IPv6, the host's own LAN IP, teammates, other subnets and
off-network.

Merge rule is last-write-wins on `savedAt`, with one exception: an origin with nothing
earned on it always takes the server copy, because that is precisely the reported symptom.

### Two bugs found while building it, both mine

1. **The timestamp comparison was against the wrong value.** `saveProfile()` stamps
   `Date.now()` and runs several times during boot, so `PROFILE.savedAt` was already "now"
   before the player had done anything — making a brand new profile look *newer* than a
   real one and blocking every merge. Now compared against `loadedSavedAt`, the stamp that
   actually came out of this origin's storage.

2. **A fresh origin destroyed the host's account.** `profileSyncOK` flips true as soon as
   the GET succeeds, so boot-time saves on a newly-opened origin were PUT to the server —
   uploading an empty profile over a good one before the merge had even been considered.
   Verified as real data loss during testing: a level-27 profile on disk was replaced by
   level 1. Pushing is now gated on `profilePullDone`, and a test asserts that a boot save
   before the pull resolves sends **nothing**.

The second one is worth remembering: the sync feature briefly made losing progress *more*
likely than the problem it was fixing.

### Verified in a real browser

jsdom has no `fetch`, so the harness cannot exercise this path (the client guards for
that, which is why it degrades silently rather than throwing). Confirmed manually instead:
earned level 27 / 48,250 cr / two unlocks / Plating 6 on `localhost:8080`, then opened
`192.168.0.39:8080` with its storage cleared — a genuine first visit — and it loaded the
same account, with the menu rail reading `48,250 cr · lv 27`.

`profile.json` is gitignored.

### Tests (17 suites)
