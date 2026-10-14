# 🔴 AI Prison Break — Cinematic Edition

> **A browser-based stealth game where guards are powered by real AI algorithms — DFS, A\*, BFS, Boids, and a Finite State Machine — all visualized live on screen.**

![Game Preview](https://img.shields.io/badge/HTML5-Canvas-orange?style=flat-square&logo=html5)
![No Dependencies](https://img.shields.io/badge/Dependencies-None-brightgreen?style=flat-square)
![Algorithms](https://img.shields.io/badge/Algorithms-DFS%20%7C%20A*%20%7C%20BFS%20%7C%20Boids-red?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

---

## 📋 Table of Contents

- [About the Game](#-about-the-game)
- [Algorithms Used](#-algorithms-used)
- [How to Run](#-how-to-run)
- [File Structure](#-file-structure)
- [Gameplay Controls](#-gameplay-controls)
- [Difficulty Levels](#-difficulty-levels)
- [AI Debug Panel](#-ai-debug-panel)
- [Complexity Reference](#-complexity-reference)
- [Academic Context](#-academic-context)

---

## 🎮 About the Game

**AI Prison Break** is a top-down stealth game built entirely with **Vanilla JavaScript** and **HTML5 Canvas** — no frameworks, no libraries, no game engines.

You play as a prisoner trying to reach the **EXIT** tile while avoiding guards. The twist: guards are not scripted. Each guard runs a **real Finite State Machine** with three states, and each state triggers a different graph/search algorithm.

Every algorithm is **drawn on screen in real time** — you can literally watch DFS trails, A\* path nodes, BFS wave rings, and Boid force arrows as the guards think.

### ✨ Key Features

- 🧠 **Real AI algorithms** — DFS, A\*, BFS run as actual code every frame
- 🎬 **Cinematic effects** — slow-motion on detection, chromatic aberration, film grain, pulsing danger border
- 👥 **Boids squad AI** — guards hunt in coordinated packs with live force arrows
- 📊 **Live AI debug panel** — FSM state, algorithm name, stack depth, path nodes, BFS queue
- 🎮 **3 difficulty levels** — Rookie, Officer, Warden
- 🔦 **Dynamic lighting** — darkness overlay with player flashlight and guard vision cones
- 🌊 **Dijkstra heatmap** — entire floor color-coded by danger level in real time

---

## 🤖 Algorithms Used

### 1. Depth First Search — PATROL State
```
Guard maintains an explicit stack of tiles.
Pushes unvisited neighbors → explores deep into corridors → pops on dead end.
Neighbors shuffled randomly → no two patrol routes are identical.
```
- **Time:** O(V + E) — visits every tile once
- **Space:** O(V) — stack + visited set
- **File:** `guard.js` → `_dfsStep()`
- **Visual:** Green trail shows visited tiles, stack preview shows upcoming path

---

### 2. A\* Search — CHASE State
```
f(n) = g(n) + h(n)
g(n) = cost from start to current tile
h(n) = Manhattan distance to player (admissible heuristic)
Recalculates every 350ms as player moves.
```
- **Time:** O(E log V) — priority queue with heuristic pruning
- **Space:** O(V) — open set + closed set
- **File:** `astar.js` → `findWithDebug()`
- **Visual:** Red dashed line shows live A\* path, closed set shaded behind it

---

### 3. Breadth First Search — SEARCH State
```
Triggered when guard loses sight of player.
Seeds BFS queue from last known player position.
Expands outward wave by wave (FIFO queue).
Guarantees nearest tiles searched first.
```
- **Time:** O(V + E) — level-by-level expansion
- **Space:** O(V) — queue + visited set
- **File:** `guard.js` → `_bfsNext()`, `onEnterSearch()`
- **Visual:** Orange concentric rings show BFS waves, numbers show wave distance

---

### 4. Boids Flocking — ALL States
```
3 local rules create emergent group behavior:
  Separation  — repel guards that are too close
  Alignment   — match heading of nearby guards
  Cohesion    — attract toward center of group
Alert state multiplies force weights (guards swarm more aggressively).
```
- **Time:** O(n²) per frame — each guard checks all others
- **Space:** O(n) — force vectors per guard
- **File:** `boids.js` → `forces()`, `apply()`
- **Visual:** Three colored force arrows (SEP/ALI/COH) drawn on each guard live

---

### 5. Finite State Machine — Guard Brain
```
PATROL (DFS) ──[sees player]──► CHASE (A*)
CHASE (A*)   ──[loses sight]──► SEARCH (BFS)
SEARCH (BFS) ──[timeout]──────► PATROL (DFS)
```
- **Time:** O(1) per transition
- **Space:** O(1)
- **File:** `fsm.js` → `GuardFSM` class

---

### 6. Raycasting Vision Cone
```
60° field of view (configurable per guard).
Steps along ray in 0.25-tile increments.
Halts at first wall tile hit.
Detection = distance check ∧ angle check ∧ line-of-sight.
```
- **Time:** O(rays × range) per guard per frame
- **Space:** O(1)
- **File:** `vision.js` → `canSee()`, `buildConePoly()`

---

## 🚀 How to Run

### Option 1 — VS Code Live Server (Recommended)

1. Install [VS Code](https://code.visualstudio.com/)
2. Install the **Live Server** extension (by Ritwick Dey)
3. Open the `ai-prison-break/` folder in VS Code
   - `File → Open Folder → select ai-prison-break`
4. Right-click `index.html` → **"Open with Live Server"**
5. Browser opens at `http://127.0.0.1:5500` ✅

### Option 2 — Python HTTP Server

```bash
cd ai-prison-break
python -m http.server 8000
```
Then open `http://localhost:8000` in your browser.

### Option 3 — Node.js HTTP Server

```bash
cd ai-prison-break
npx serve .
```

### ⚠️ Important
> **Do NOT open `index.html` by double-clicking it.** The game requires a local server because of how JavaScript modules are loaded. Double-clicking gives a `file://` URL which will fail.

---

## 📁 File Structure

```
ai-prison-break/
│
├── index.html          ← Entry point, UI overlay, HUD, AI panel
├── style.css           ← Dark cinematic theme, scanlines, animations
│
├── utils.js            ← Math helpers (lerp, dist, angle, tileKey)
├── map.js              ← Static grid map, tile rendering, spawn points
├── astar.js            ← A* pathfinding with debug data exposure
├── fsm.js              ← Finite State Machine (GuardFSM class)
├── vision.js           ← Raycasting line-of-sight, 60° FOV cone
├── lighting.js         ← Darkness overlay, flashlight, guard beams
├── effects.js          ← Screen shake, flash, particles, vignette
├── boids.js            ← Boids flocking (SEP + ALI + COH forces)
├── player.js           ← WASD movement, collision, trail effects
├── guard.js            ← Guard AI — DFS patrol, A* chase, BFS search
└── main.js             ← Game loop, camera, cinematic effects, audio
```

### Script Load Order (important)
```html
utils.js → map.js → astar.js → fsm.js → vision.js →
lighting.js → effects.js → boids.js → player.js → guard.js → main.js
```

---

## 🎮 Gameplay Controls

| Key | Action |
|-----|--------|
| `W` or `↑` | Move Up |
| `S` or `↓` | Move Down |
| `A` or `←` | Move Left |
| `D` or `→` | Move Right |

**Goal:** Reach the glowing **EXIT** tile in the bottom-right area of the map.

---

## ⚙️ Difficulty Levels

| Level | Name | Guards | Speed | Vision Range | Vision Angle | Search Time |
|-------|------|--------|-------|-------------|-------------|-------------|
| **L1** | Rookie | 2 | Slow (0.85×) | 4 tiles | 45° | 2.5 sec |
| **L2** | Officer | 3 | Medium (1.4×) | 6 tiles | 64° | 4.0 sec |
| **L3** | Warden | 3 | Fast (2.1×) | 8 tiles | 90° | 6.0 sec |

Select difficulty on the title screen before starting.

---

## 📊 AI Debug Panel

The top-right panel updates live during gameplay:

| Element | What it shows |
|---------|---------------|
| **FSM Diagram** | Current active state highlighted (green/red/orange) |
| **Algorithm** | Which algo is running (DFS PATROL / A* PATHFIND / BFS SEARCH) |
| **A\* Nodes** | Remaining path nodes in current A\* route |
| **DFS Stack** | Current stack depth in DFS traversal |
| **BFS Queue** | Frontier size in BFS wave expansion |
| **Detection** | 🔴 DETECTED / 🟢 SAFE |
| **Live Note** | Plain English explanation of current algorithm behavior |

### Toggle Overlays
- ✅ **A\* Path** — red dashed path line
- ✅ **DFS Trail** — green visited tile trail
- ✅ **BFS Wave** — orange wave rings
- ✅ **Boid Forces** — SEP/ALI/COH arrows on guards

---

## 📐 Complexity Reference

| Algorithm | State | Time | Space | File |
|-----------|-------|------|-------|------|
| DFS Patrol | PATROL | O(V+E) | O(V) | guard.js |
| A\* Search | CHASE | O(E log V) | O(V) | astar.js |
| BFS Search | SEARCH | O(V+E) | O(V) | guard.js |
| Boids Flocking | ALL | O(n²)/frame | O(n) | boids.js |
| Raycasting LOS | ALL | O(rays×range) | O(1) | vision.js |
| FSM Transition | ALL | O(1) | O(1) | fsm.js |

*V = walkable tiles, E = edges between adjacent tiles, n = number of guards*

---

## 🎓 Academic Context

This project was built as an **algorithms course project** to demonstrate:

1. **Graph traversal** — DFS and BFS on a grid graph
2. **Heuristic search** — A\* with admissible Manhattan heuristic
3. **Emergent behavior** — Boids algorithm (Craig Reynolds, 1986)
4. **State machines** — FSM as an AI architecture pattern
5. **Computational geometry** — Raycasting for line-of-sight

Each algorithm is not simulated or faked — it runs as real code every frame and its internal data structures are drawn on screen as visual proof.

---

## 🛠️ Tech Stack

- **Language:** Vanilla JavaScript (ES6+)
- **Rendering:** HTML5 Canvas API
- **Audio:** Web Audio API (procedural synthesis)
- **No frameworks, no libraries, no game engines**

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

*Built with ❤️ using real algorithms, real code, and zero game engines.*
