# RAINCOIL

**Eat the weather.** An original arcade game about a living coil, colored rain, and making room to survive.

A Little More Time · version 0.3.0 · September 2026

Game by **OpenAI Codex**. Original game concept by **L. Lepin**.

## Build from source

With Node.js 22.12 or newer, run `node tools/serve.mjs` to play locally, `npm test` for rules tests, and `node tools/package.mjs Web` to create the itch.io ZIP. None of these steps needs installed dependencies. On Windows x64, `./Build.ps1 -Install` builds both targets with pinned local dependencies. See [build instructions](docs/BUILD.md) for prerequisites and troubleshooting. Generated downloads are not committed to Git.

## Play

**Windows:** open `dist/windows/Raincoil-0.3.0-Windows-x64.exe`. It is a portable x64 executable with its runtime included; no installation, Node.js, or network connection is required. The launcher extracts its runtime to a temporary directory. This independent build is unsigned.

**Web:** upload `dist/Raincoil-0.3.0-itch-web.zip` as an itch.io HTML game. For local play from source, run `node tools/serve.mjs` with a modern Node installation and open `http://127.0.0.1:8080`. Directly double-clicking index.html is not supported because it uses browser ES modules.

Choose a game type, then **First Rain** for its short, safe lessons. **Enter the Storm** is a three-minute survival run with a finish. **Endless** keeps the storm going. Each type has separate Storm and Endless records.

| Game type | Character |
| --- | --- |
| **Wild** | The original unpredictable rain and immediate shedding. |
| **Cadence** | Rain arrives in three-note Sweep, Echo and Fork phrases. Colored, numbered markers forecast where each note will fall. The default game type. |
| **Afterimage** | Cadence's weather, plus shed tails that remain where you left them. Turn your escape route into a rain collector. |

Cadence and Afterimage leave more space between phrases than Wild's late storm. They offer a different rhythm as well as more information.

**Relaxed pace:** open **Change** beside Game Type and tick the checkbox. It works with all three types, Storm, Endless, and First Rain. Movement and rain run at 60% speed, your tail grows once every seven real seconds, and you have five integrity points. Forecasts and recovery windows stretch with the action. A full storm takes five minutes; the clock shows real playing time. Standard and Relaxed have separate records, and your choice is remembered. Standard pace remains unchanged.

| Control | Action |
| --- | --- |
| Arrow keys / WASD | Steer; your coil moves automatically |
| Space | Shed four links when you have at least nine |
| Escape / P | Pause or resume |
| F11 on Windows | Toggle fullscreen |
| On-screen arrows / swipes | Touch steering |

## Make something of the mess

Rain colors the body where it hits, painting that link and its next neighbor toward the tail. A run of **three or more matching links** bursts. It removes those pigments, retracts the physical tail, and clears nearby stone. Clears can chain when the remaining colors come together. Your body never shrinks below five links.

Missed drops become solid stone at the bottom of the chamber and stack upward. At standard pace, your coil grows one link every 2.8 seconds. Walls, your body, and stone cost integrity; three hits end the run. A hit gives a short shield so you can recover.

**Shed** spends four tail links to clear a small area around your head and grant a brief shield. It takes six seconds to recharge. Length is both trouble and a reserve you can spend.

In **Afterimage**, those four links also leave a stationary colored skin. It remains ghostly until you move clear, then becomes an obstacle. Rain paints it; repeated pigment seeps along already matching links. Three consecutive matching links dissolve the entire skin and clear nearby stone, without shortening your living coil. Skins do not fade away by themselves. An overlapping cast may fail to leave a skin, but you still receive the emergency shed and shield.

Catch: 15 points. Bursts: 100 per matched link plus 35 per nearby stone removed, multiplied by the current chain. Another burst within five seconds increases the chain, up to ×8. Surviving the storm gives 1,000 points plus 250 per remaining integrity.

## Comfort and storage

Settings provide separate music and effects volumes plus reduced motion. Reduced motion removes camera shake and particles, stops the ambient menu movement, and uses steady shield feedback. Each pigment also has a distinct symbol: circle, diamond, or stripe. The game pauses when it loses focus.

Records and settings stay on this device when local browser storage is available. There are no accounts, analytics, external assets, or runtime network requests. Progress during a run is not saved.

## About this candidate

The concept was commissioned as an independent first design combining the pressures of Snake, falling puzzle pieces, and color adjacency. I chose fast steering, two-link paint splashes, three-minute storms, forgiving collision recovery, and an emergency action that spends the very thing causing spatial pressure. The aesthetic is a dark reclamation chamber with luminous pigment, compact industrial typography, and an original procedural electronic score.

All graphics, effects, icons and sound are created in code. Version 0.1.0 was developed independently, before inspecting any other implementation. Its rules remain available as Wild.

A subsequent comparison with Color Snake, created by L. Lepin for MSX in the early 1990s, prompted the second iteration. Patterned weather and persistent shed skins explore new consequences of the shared concept while retaining RAINCOIL's arcade character. They are authored design choices, not conclusions from broad playtesting. See [docs/ITERATION_02.md](docs/ITERATION_02.md) for the reasoning.

Source and build details: [docs/BUILD.md](docs/BUILD.md). Rules and testing: [docs/ENGINE.md](docs/ENGINE.md), [docs/VALIDATION.md](docs/VALIDATION.md).

The Windows runtime includes Electron/Chromium and their bundled license notices. Source and documentation are available under the [MIT license](LICENSE). See [third-party notices](THIRD_PARTY_NOTICES.md) for bundled runtime components.
