# ⚔️ Another Dungeon Game
### (not) Completely Vibecoded Edition
[![On VibeCruiser](https://vibecruiser.com/badge/martinsuii--another-dungeon-game.svg)](https://vibecruiser.com/v/martinsuii--another-dungeon-game?ref=badge)

[**🕹️ Play Now →**](https://martinsuii.github.io/another-dungeon-game/)
---

## What Is This?

A browser-based dungeon crawler built entirely in vanilla JavaScript and HTML5 Canvas — no frameworks, no dependencies, no excuses. Procedurally generated floors, a scrap-and-gold economy, and boss fights with pre-battle dialog.

---

## Features

### 🗺️ Procedural Floors
Every floor is randomly generated with walls, chests, enemies, and a key you need to find before the exit unlocks. A BFS pathfinding check guarantees every floor is actually winnable — no dead ends, no softlocks.

### ⚔️ Two-Weapon Combat
- **Sword** (Space) — melee swing, hits adjacent tiles
- **Bow** (F + Mouse aim) — fire arrows in any direction using your mouse cursor as the crosshair

### 🏪 Market Floors
Safe floors appear at X5 and X9 of every decade (5, 9, 15, 19, 25, 29...) with four vendors:
| Vendor | Sells |
| :--- | :--- |
| 🔧 The Forge | Shields, arrows |
| 💎 Artifact Seller | ATK and DEF upgrades |
| 🧙 The Witch | Healing potions |
| 💰 Scrap Buyer | Sells scrap and gives you gold |

### 👁️ Boss Fights
Every 10th floor is a boss encounter. Each boss has:
- A unique name, portrait, and pre-fight dialog
- A dedicated HP bar with the boss's name and color
- Minion waves that respawn when fully cleared
- HP that scales up with each successive boss

The door only opens once **both** the boss and all minions are dead.

---

## Controls

| Key | Action |
| :--- | :--- |
| **W A S D** | Move |
| **Space** | Sword attack |
| **Mouse / F** | Shoot arrow |
| **E** | Drink potion |

---

## Technical Details

- **Engine:** Pure JavaScript, HTML5 Canvas
- **Dependencies:** None
- **Map generation:** Random with BFS reachability validation
- **Floor pattern:** Normal → Boss (X0) → Market (X5, X9) → repeat
- **Enemy AI:** Manhattan-distance chase with tile-based collision

### Enemies

| Enemy | HP | DMG | Speed | First Appearance | Color |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Grunt | 6 | 10 | Fast (1.2s) | Floor 1 | Red |
| Slime | 3 | 3 | Very fast (0.45s) | Floor 3 | Green |
| Fighter | 10 | 20 | Slow (1.6s) | Floor 16 | Yellow |

---
