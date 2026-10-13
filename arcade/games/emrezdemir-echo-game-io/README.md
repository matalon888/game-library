<a name="top"></a>

# Time Echo

A turn-based browser puzzle game in which the player records sequences of moves as deterministic echoes, then collaborates with those past selves to solve grid-based puzzles.

[![Version](https://img.shields.io/badge/version-1.12.0-8A7DFF)](CHANGELOG.md)
[![Language](https://img.shields.io/badge/language-JavaScript-F7DF1E?logo=javascript&logoColor=black)](#)
[![Build](https://img.shields.io/badge/build-none_required-brightgreen)](#how-to-run)
[![Browsers](https://img.shields.io/badge/browsers-Chrome%2C_Edge%2C_Firefox%2C_Safari-0078D4)](#)
[![Rendering](https://img.shields.io/badge/rendering-Canvas2D_%2B_WebGL2-990000)](#tech)
[![Levels](https://img.shields.io/badge/levels-23_hand--crafted-FFD97D)](#levels)
[![Audit](https://img.shields.io/badge/audit-23%2F23_passing-brightgreen)](#quality--audit)
[![AI-Native](https://img.shields.io/badge/AI--native_development-Claude_Code-7A5DFF)](#ai-native-development)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Live Demo](https://img.shields.io/badge/live_demo-hbnf.net-1D76DB)](https://hbnf.net/)

Live demo: <https://hbnf.net/>

---

## Table of Contents

- [About](#about)
- [Core Mechanic](#core-mechanic)
- [Cell Symbols](#cell-symbols)
- [Levels](#levels)
- [Quality & Audit](#quality--audit)
- [Controls](#controls)
- [How to Run](#how-to-run)
- [Tech](#tech)
- [Deploy](#deploy)
- [AI-Native Development](#ai-native-development)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

---

## About

Time Echo is a single-page browser game built with vanilla JavaScript. Each level is a grid played in discrete ticks. The defining mechanic: pressing `R` records the sequence of moves performed so far as an *echo*; the player respawns at the start while the echo replays its recorded moves on subsequent runs. Solutions usually require one or more echoes to hold pressure plates, block beams, or occupy positions while the live player executes a complementary path.

Design constraints:

- No build step. No bundler, no transpiler, no ES module loader. Files are loaded via `<script>` tags from `index.html`.
- No third-party game frameworks. Rendering uses Canvas2D for gameplay and WebGL2 for post-processing.
- Modular structure: each of the 11 source files has a single responsibility.
- All levels are verified by a BFS-based audit before release.

## Core Mechanic

A level is played on a fixed grid. Each input is a tick, executed in the following order:

1. Pre-snapshot of the world is taken for this tick's input resolution.
2. Player and all echoes attempt their moves simultaneously against the pre-snapshot.
3. Entities standing on portal cells teleport to the matched portal.
4. Post-snapshot is taken.
5. Beam paths are computed from each laser emitter until a wall or closed door.
6. Entities in beam cells are killed.
7. Goal check: if the player occupies the goal cell, the level is cleared.

Pressing `R` commits the current move sequence as a new echo and resets the live player to the start position. The world state otherwise persists where the game rules require it (for example, fragile plates remain latched once pressed).

## Cell Symbols

| Symbol | Name | Behavior |
|:------:|:-----|:---------|
| `#` | Wall | Impassable. |
| `P` | Spawn | Player and echo start position. |
| `G` | Goal | Player on this cell clears the level. |
| `a–z` | Plate | The matched door is open while an entity stands on the plate. |
| `A–Z` | Door | Passable while the matched plate is active; otherwise treated as a wall. |
| `1–9` | Portal | Two portals share a digit and teleport between each other after movement. |
| `^ v < >` | Laser emitter | Continuously emits a beam in the indicated direction. |
| `Q` | Quantum tile | Alternates between wall and floor on every move. |
| `B` | Crate | Pushable. Activates plates and blocks laser beams. |
| `X` | Sentry | Patrols a corridor; lethal on contact. |
| Fragile plate | (lowercase, listed in level `fragile`) | Latches the matched door open permanently on first press. |

Lasers tied to plates are silenced while the plate is active. A plate can drive both a door and a laser (declared in the level definition).

## Levels

The game contains 23 hand-crafted levels arranged on a rising difficulty curve.

| # | Name | Mechanic Focus | Move Budget |
|--:|:-----|:---------------|------------:|
| 1 | İlk Yankı | Plate, door (tutorial) | 14 |
| 2 | Çift Dolaşık | Two plates, two doors | 18 |
| 3 | Üç Eşzamanlı | Three simultaneous plates | 24 |
| 4 | Köprü | Portal pair | 16 |
| 5 | Işın | Laser, plate | 16 |
| 6 | Çöküş | Portal, door | 24 |
| 7 | Kuantum Geçit | Three sequential quantum tiles | 16 |
| 8 | Kargo | Crate, plate | 16 |
| 9 | Dalgalanma | Quantum, laser | 20 |
| 10 | Devriye | Sentry, door | 28 |
| 11 | Kırılgan Plaka | Fragile plate (latch) | 22 |
| 12 | Kör Nokta | Portal, laser (shared plate) | 22 |
| 13 | Kutu Çıkmaz | Crate, quantum, laser | 28 |
| 14 | Çift Mühür | Two simultaneous plates (constrained layout) | 30 |
| 15 | Ritm Anı | Quantum, sentry, plate | 22 |
| 16 | Üç Aşama | Door, laser, portal well | 32 |
| 17 | Perde | Fragile plus regular plate | 26 |
| 18 | Çukur | Two portal pairs, door | 26 |
| 19 | Dalgalı Çıkış | Two lasers (horizontal and vertical) | 30 |
| 20 | Nefes Payı | Tight move budget, sentry | 20 |
| 21 | Sis | Quantum, portal, laser | 28 |
| 22 | Dehliz | Long corridor, three threats | 36 |
| 23 | Sonsuz Döngü | All mechanics combined | 56 |

## Quality & Audit

Every level passes a seven-stage BFS-based audit before release:

1. Exactly one `P` cell.
2. Exactly one `G` cell.
3. Every door letter has a matching plate letter.
4. Every portal digit occurs exactly twice.
5. The goal is reachable from the spawn when all doors are open.
6. Every plate is reachable when all doors are open.
7. The goal is *not* reachable when all doors are closed (proving the doors gate the path).

Run the audit:

```bash
node _audit_hand.js
```

Expected output:

```
Hand levels: 23
  OK   1. İLK YANKI
  ...
  OK  23. SONSUZ DÖNGÜ
Total broken: 0
```

The audit does not model laser gating for door-less levels; those are verified manually.

## Controls

| Key | Action |
|:----|:-------|
| Arrow keys, W A S D | Move (four directions) |
| Q E X C | Diagonal move (eight directions) |
| R | Commit current run as an echo and respawn |
| Z | Remove the most recent echo |
| N | Remove all echoes and reset the level |
| M | Toggle audio |
| Esc | Return to main menu |
| Enter | Continue from overlay |

Mobile: 3×3 directional pad (diagonals included), on-screen R/Z/N buttons, swipe input.

Editor: left-click to place the active brush, right-click to erase, drag to paint continuously.

## How to Run

```bash
git clone https://github.com/emrezdemir/echo-game.io.git
cd echo-game.io

# Windows
start index.html

# macOS
open index.html

# Linux
xdg-open index.html
```

Some browsers restrict Web Audio under the `file://` protocol. If the title-screen track does not play, serve the directory over HTTP:

```bash
python -m http.server 8000
# or
npx serve .
```

## Tech

| Layer | Technology | Notes |
|:------|:-----------|:------|
| 2D rendering | Canvas2D | Procedural sprites, cached pixel-art tile textures. |
| Post-processing | WebGL2 | Bloom, CRT distortion, chromatic aberration, scanlines, vignette, grain. |
| Sound effects | Web Audio API | Synth bleeps, percussion, transient effects. |
| Music | Web Audio API | Title-screen MP3 with `AnalyserNode`; in-game procedural chiptune. |
| Persistence | `localStorage` | Key: `timeEcho.progress.v2`. |
| Internationalization | Turkish, English | All UI strings, level intros, and version history are bilingual. |
| PRNG | mulberry32 | Deterministic seed for level URL share. |
| URL encoding | base64url | Custom level share format. |

## Deploy

```powershell
.\deploy.ps1
```

Produces `echo-game-v<version>.zip` containing the HTML, CSS, JavaScript, music, and license files. Upload the archive to a static host and extract.

The build is sub-path friendly. All asset references are relative and `index.html` declares `<base href="./">`, so extracting the archive into any directory (for example `public_html/time-echo/`) makes the game available at `https://your-host.example/time-echo/` without further configuration.

## AI-Native Development

This project was developed iteratively in collaboration with [Claude Code](https://docs.anthropic.com/claude/docs/claude-code), Anthropic's CLI agent. The development model is documented here for transparency and as a reference for similar workflows.

### Workflow

| Phase | Human responsibility | Agent responsibility |
|:------|:--------------------|:---------------------|
| Product direction | Goals, priorities, acceptance criteria | Decomposition, option analysis |
| Mechanic design | Constraints and feedback | Specification and code drafts |
| Level design | Concept and playtesting | Implementation, BFS audit, redesign on failure |
| Implementation | Approval and integration calls | Direct file edits via Read/Edit/Write |
| Verification | In-browser manual testing | Audit script execution, syntax checks |
| Documentation sync | Final review | Coordinated updates across required files |

### Memory Bank

A single file at the project root, `CLAUDE.md`, is loaded as context at the start of each agent session. It contains the architecture overview, critical concepts, branch state, prior decisions, and project-specific conventions. Both human and agent maintain it across sessions.

### Synchronization Protocol

Every feature, fix, or design change updates the following files together as a single logical commit:

1. `version.js` — new entry prepended to `VERSION.history` (bilingual).
2. `CHANGELOG.md` — Keep-a-Changelog entry under the new version.
3. `i18n.js` — translation keys for any new UI strings.
4. `CLAUDE.md` — architectural or branch-state updates.
5. `README.md` — public-facing changes.

This protocol is enforced through agent memory and reviewed at commit time.

### Scope of AI Involvement

The agent contributes to source code, level design, audit logic, documentation, and release coordination. The runtime game does not call any large language model; "AI-native" refers to the development process, not to in-game features.

## Documentation

- [CHANGELOG.md](CHANGELOG.md) — version history.
- [CLAUDE.md](CLAUDE.md) — project memory bank and developer notes.
- [THIRD_PARTY.md](THIRD_PARTY.md) — third-party attributions.
- [LICENSE](LICENSE) — MIT license text.

## Contributing

Issues and pull requests are accepted at <https://github.com/emrezdemir/echo-game.io/issues>.

Useful contribution types:

- New levels: build in the editor, share via URL, attach the level data to an issue. New levels are expected to pass `_audit_hand.js`.
- New mechanics: review existing design decisions in `CLAUDE.md` before proposing changes that affect tick order.
- Translations: extend the bilingual structure in `i18n.js`.

## License

[MIT](LICENSE). Third-party attributions are listed in [THIRD_PARTY.md](THIRD_PARTY.md).

The title-screen track is "C — Voyage" by NoCopyrightSounds, used under the NCS Free Use License.

## Contact

- Issues: <https://github.com/emrezdemir/echo-game.io/issues>
- Live demo: <https://hbnf.net/>
- Author: Emre Özdemir ([@emrezdemir](https://github.com/emrezdemir))

[Back to top](#top)
