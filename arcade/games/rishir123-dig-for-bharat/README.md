# Dig for Bharat

A voxel excavation game. You are a first-season Archaeological Survey field
trainee. Each season opens with a question, six clues answer it one at a time,
and every clue names something you can actually see on the ground plus how deep
to go. Nothing is marked on a map — the clue is the map.

Five sites, thirty finds, all of them real, each dated by the layer it comes out
of: Rakhigarhi, Lothal, Vidisha, Nalanda, Hampi.

## Status

Playable and complete through five sites. Honest state of things:

| | |
| --- | --- |
| Simple English, ages 11-14 | done — mean sentence 7.1 words |
| Hindi, Bengali, Telugu, Marathi | done, **draft** — need a native speaker's read |
| Tamil | **not written yet** |
| Chunky UI rebuild | done |
| The city + Then/Now toggle | done — one parameterised layout per site |
| Compass, beacon, shallower digging | done |

The four translations were machine-assisted and are marked `draft` in their
files. The language picker says so. Get a speaker to read them before this goes
in front of a class — place names and period names most of all.

The city builder is currently one layout with a per-site palette and one
signature building. Nalanda's real quadrangle plan and Hampi's bazaar
colonnade deserve bespoke layouts.

## Run it

**As a desktop app:**

```sh
npm install       # once — pulls Electron
npm start         # the game, in its own window
npm run dev       # same, with devtools
npm run selftest  # builds a world, digs a clue target out, prints a report, exits
```

**In a browser:**

```sh
python3 serve.py          # http://localhost:5173, opens your browser
python3 serve.py 8080     # different port
```

The browser path has no build step and no dependencies at all. `/` is the voxel
game; `/section.html` is the 2D excavation record that shares its dataset.

**Packaging:** `npm run dist:mac` (or `dist` for all three platforms) builds
installers via electron-builder into `dist/`. The app icon is generated —
`build/icon.html` is rendered to `build/icon.png`.

## The desktop app

`electron/main.cjs` registers its own standard scheme and serves the project
directory through it. Two reasons that beats loading files directly:

- The game is ES modules with an import map, and Chromium refuses to load
  modules over `file://`. A custom scheme gets correct MIME types and module
  semantics without opening a local port.
- The handler refuses any path that resolves outside the project directory.

The renderer runs sandboxed with no Node integration — the game does not need
it. `electron/preload.cjs` exposes only `window.digDesktop`, so the page can
tell it is running as a desktop app.

`npm run selftest` runs the whole game headlessly in the real desktop runtime:
builds a world, checks the physics figures, digs the first clue's target out of
the ground, brushes it, backfills a block, prints a JSON report and exits
non-zero on failure. The script it injects lives in `electron/selftest.js` as a
plain file rather than a string inside `main.cjs`, because embedding it as a
string means an escaping layer, and an escaping layer means a `\n` that quietly
becomes a real newline and breaks the injected source.

### If Electron starts as plain Node

Terminals spawned by Electron-based editors — VS Code, Claude Code, others —
export `ELECTRON_RUN_AS_NODE=1` for their own tooling. Inherit that and Electron
boots as plain Node: no app, no window, and `require("electron")` hands back the
*path to the binary* instead of the API, so the first line that touches
`protocol` or `app` throws. `electron/launch.cjs` strips the variable before
spawning, which is why `npm start` runs it rather than calling `electron`
directly.

## What is in the box

A title screen, settings, a field manual and a pause screen, all reachable
without touching the keyboard. Settings persist and apply live: master / music /
effects volumes, mouse sensitivity, invert look, field of view, view distance,
head bob, block-damage overlay, frame counter.

### Sound and music

Every sound is synthesised at runtime — nothing is downloaded, which keeps the
licensing clean and lets a sound know what it is about. A trowel in silt and a
pick in granite differ because the block carries an acoustic material, not
because two files were recorded. Footsteps, breaks, machines and UI all read
from the same table.

The score is **generative and raga-based**, and each site gets one whose
traditional time of day suits it:

| Site | Raga | |
| --- | --- | --- |
| Rakhigarhi | Bhairav | morning |
| Lothal | Bhupali | early evening |
| Vidisha | Yaman | evening |
| Nalanda | Malkauns | late night |
| Hampi | Kafi | late evening |

A drone holds the tonic and the fifth with a slow shimmer, a melodic line walks
the raga's scale above it with occasional meend between notes, and percussion
only joins in while your tool is actually in the ground. Lifting a find gets its
own resolving phrase. Scheduling is the standard lookahead pattern — a timer
places events a fraction of a second ahead of the clock, because `setTimeout` is
not tight enough to keep a beat.

The time-of-day association of each raga is a real convention in Hindustani
music (*samay*); which site gets which is this game's own choice.

**Why nothing was downloaded.** Kenney's packs are genuinely CC0 but are UI
clicks and sci-fi impacts — no use for soil. The Indian-instrument sample
sources are "royalty-free" or "open access" rather than clearly CC0, and muddy
licensing is the wrong thing to put in a classroom build. Generated audio also
responds to game state, which a loop cannot.

## How a season goes

1. Read the clue. It is on screen the whole time, and `J` opens the full
   notebook with the reasoning and the expected depth.
2. Walk out and find the landmark it names — the fire-reddened ground, the
   hollow where the ground dips, the stack of stones by the track. They are
   built out of blocks, so you spot them on the skyline, not on a minimap.
3. **Hold** the left button to dig. The block cracks through ten stages and
   breaks after `hardness x 0.55 / tool speed` seconds — trowel 1.0, pick 3.2,
   brush 0.35. Let go, or look away, and the next block starts from scratch.
4. **Depth is the answer, not a hint.** A find only appears at the depth its
   layer says it should be at. Layer II is about three metres; the keystone
   deposit of the season is usually nine.
5. When something appears, **switch to the brush.** The pick has a 30% chance of
   shattering anything brittle it touches.
6. Six clues answered closes the question. `R` files the season report.

Everything you dig comes out as **spoil**, and spoil is not waste:

- **Right-click** puts a load back — backfill a trench the way a real one gets
  closed, or build yourself a step out of a hole you cut too deep. `Q` changes
  which material you are holding.
- **`G` at the sieve** by the datum peg puts eight loads through the screen. It
  is worth merit, it turns up the small things trowelling misses — a 4 mm bead,
  charcoal worth a radiocarbon date — and it sometimes tells you that the grit
  in that load is not local, along with a bearing to what you have been walking
  over.

### Six tools

| | |
| --- | --- |
| **Trowel** | The default. Slow, controlled, safe near anything fragile |
| **Shovel** | Fast through loose material only, two loads of spoil at a time. Refuses anything hard |
| **Pick** | Three times the speed through hard layers. 30% chance of shattering anything brittle |
| **Brush** | Lifts an exposed find without damaging it |
| **Dental pick** | Slower, but a careful lift is worth +9 merit. Use it on anything fragile |
| **Magnetometer** | Four sweeps a season; a bearing and a distance to the open clue |

### Four machines

They stand around the datum peg. Walk up and press `G`.

| | |
| --- | --- |
| **Sieve** | Eight loads of spoil. Merit, small finds, and sometimes a bearing |
| **Flotation tank** | Twelve loads. Seeds and charcoal — the environmental record, and a date |
| **Conservation bench** | Stabilises a find you broke. Most of its value comes back; the break stays in the record |
| **Total station** | Surveys the open clue and leaves a sight line over it for a minute |

## Controls

| | |
| --- | --- |
| `W` `A` `S` `D` | Walk — hold `Shift` to run |
| Mouse | Look — **hold left** to dig, **right-click** to put spoil back |
| `Q` | Change which spoil you are holding |
| `G` | Sieve spoil at the station by the datum peg |
| `1`–`6` | Trowel, shovel, pick, brush, dental pick, magnetometer (or scroll) |
| `E` | Lift a find that has appeared |
| `J` | Field notebook — the clues live here |
| `F` | Aerial survey — rise and read the ground from above |
| `Space` `C` | Jump, crouch |
| `R` | File the season report |
| `Esc` | Release the mouse |

## The engine

Written against three.js, but the Minecraft look is not three.js — it is the
voxel pipeline, and that is all in `engine/`:

| File | |
| --- | --- |
| `engine/blocks.js` | Block registry and the procedural texture atlas. 16-pixel tiles painted onto one canvas, sampled NEAREST. Nothing is downloaded |
| `engine/world.js` | 128x128x64 world, terrain generation, the five strata, landmark building, DDA raycast, and the chunk mesher |
| `engine/player.js` | AABB collision against the voxel field, one axis at a time, with step-up and flight |
| `engine/quests.js` | Terrain recipe, mystery question and six clues per site |
| `engine/hud.js` | Readouts, hotbar, notebook, report |
| `engine/main.js` | Frame loop, mining, backfill, sieving, season flow |
| `electron/main.cjs` | Desktop shell: custom scheme, window, menu, self-test |
| `electron/launch.cjs` | Spawns Electron with a clean environment |
| `electron/selftest.js` | The headless run injected by `npm run selftest` |
| `src3d/` | Shared with the older build: procedural find meshes, held-tool viewmodel, synthesised audio |
| `src/data.js` | The thirty finds and their notes — read by both games |
| `vendor/` | three.js r180, vendored so it runs offline |

### Movement is Minecraft's, not an approximation

`engine/player.js` runs Minecraft's own movement model rather than something
that feels similar. That means a **fixed 20 Hz tick** with velocities in
blocks-per-tick, not per-frame integration — run the same arithmetic once per
frame and you get different speeds on different monitors. The camera
interpolates between the last two ticks so it stays smooth at any frame rate.

Order of operations inside a tick, which is the part that actually matters:

1. Scale the player's own input by `0.98`, then apply the sneak (`0.3`) multiplier.
2. Jump if grounded — `vy = 0.42`, plus a `0.2` forward kick if sprinting.
3. Accelerate: `0.1 * (0.6/slipperiness)^3` on the ground, `0.02` in air, times
   `1.3` when sprinting.
4. Move, resolving **Y, then X, then Z**, with a `0.6` step height — a full
   block still needs a jump.
5. `vy = (vy - 0.08) * 0.98`, then horizontal `*= slipperiness * 0.91`
   (`0.91` alone in air).

Friction is applied at the *end* of a tick, so the velocity left in the field is
always the post-friction value. The distance actually covered per tick is that
plus the next tick's acceleration — which is what the published
blocks-per-second figures describe, and a trap if you try to verify by reading
the velocity.

`player.selfTest()` runs the model on a flat floor and measures displacement.
Current output against the documented values:

| | measured | documented |
| --- | --- | --- |
| walk | 4.3172 | 4.317 blocks/s |
| sprint | 5.6123 | 5.612 blocks/s |
| sneak | 1.2952 | 1.295 blocks/s |
| jump height | 1.2522 | 1.2522 blocks |

Reachable in the browser as `window.__dig.physicsSelfTest()` with `?probe=1`.

**Why the model is ported rather than imported.** PrismarineJS's
[prismarine-physics](https://github.com/PrismarineJS/prismarine-physics) (MIT) is
the reference implementation of exactly this, and its core simulation is
self-contained arithmetic. But it reads block behaviour through `minecraft-data`
and `prismarine-block` — a version-keyed registry of Minecraft's thousand-odd
blocks, to drive a world that has twenty-eight. The constants themselves are
published facts. Porting the model is about 120 lines and no dependencies;
importing it would mean shipping a Minecraft data layer to a browser with no
bundler.

**What actually produces the look.** Faces are emitted only where a block meets
air. Each vertex carries `face shade x ambient occlusion x skylight` baked into
its colour, and the terrain material is unlit — a scene light on top of that
would shade everything twice. Ambient occlusion is the classic three-neighbour
corner test, and the quad's split is flipped when the gradient would otherwise
go anisotropic. Skylight is full above a column's surface and falls off with
depth below it, which is why a shaft you sink stays lit while its walls darken.

Scrub is drawn as two crossed alpha-tested billboards rather than a cube, and is
passable. Everything else is a cube.

Breaking a block remeshes **one** chunk, plus a neighbour only when the block sits
on a chunk seam. Remeshing all nine neighbours every time — which this did at
first — is nine times the work for no visible difference, and it was enough to
stall a headless run that mined as fast as it could.

## Working on it

Load any page with `?probe=1` and the game exposes `window.__dig` — the state,
the tool functions, and `step(dt)`, which runs exactly one frame. That last one
is what makes it testable without a mouse: drive frames yourself, dig on the ones
you choose, read the result. Without the query string, nothing is exposed.

Tuning constants are at the top of `engine/main.js` (`STAMINA_MAX`, `SURVEYS`,
`REACH`, the `TOOLS` table with per-tool power, cost and repeat rate) and
`engine/world.js` (`WX`, `WZ`, `WY`, `CH`, `SEA`, `STRATA_THICK`).

To add a site: append its finds to `SITES` in `src/data.js`, then give it a
`TERRAIN` recipe and a `QUESTS` entry in `engine/quests.js` — six landmark types
and six clues, in the same order as the finds. The generator places the
landmarks on a ring around the mound and buries each find directly beneath its
own, at the depth its layer demands.

### Open-source voxel projects worth knowing

| | Licence | |
| --- | --- | --- |
| [prismarine-physics](https://github.com/PrismarineJS/prismarine-physics) | MIT | Minecraft's movement model in JS. The reference for the port above |
| [noa-engine](https://github.com/fenomas/noa) | MIT | The serious web voxel *engine* — chunk streaming, entities, on Babylon.js. Worth it if the world ever needs to be bigger than one site |
| [voxel-physics-engine](https://github.com/fenomas/voxel-physics-engine) | MIT | noa's physics, standalone. Needs only an `(x,y,z) => boolean` solidity test, so it drops into any engine |
| [Luanti](https://www.luanti.org) (was Minetest) | LGPL-2.1+ | The genuinely open-source Minecraft. C++, desktop-first |
| [Terasology](https://github.com/MovingBlocks/Terasology) | Apache-2.0 | Mature, Java, also not a web target |

Minecraft itself is proprietary — Mojang has open-sourced side libraries
(Brigadier, DataFixerUpper) and publishes obfuscation mappings for modding, but
not the game. Every texture in `engine/blocks.js` is generated at load for the
same reason: no Mojang assets anywhere near this.

### Two three.js traps this hit

`THREE.Color` already converts an sRGB hex into the linear working space, so
calling `convertSRGBToLinear()` on top of it darkens everything by about 8x.

A custom `ShaderMaterial` needs `<tonemapping_fragment>` and
`<colorspace_fragment>` at the end of its fragment shader but *not* the matching
`_pars_` chunks — three prepends those itself, and including them twice fails to
compile with duplicate function bodies.

## Publishing

`python3 bundle.py` flattens the section view into `dist/dig-for-bharat.html`, a
single self-contained page. The voxel game is not bundled — it needs an import
map and nine modules.

## On the history

Every object and every note is real. Where archaeologists still disagree — what
the Lothal basin was for, which monastery the Persian chronicle describes, what a
single ancient genome from Rakhigarhi does and does not show — the catalogue says
so rather than picking a side.
