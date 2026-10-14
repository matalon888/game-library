# Game Design Notes

## Concept

Lowpoly Roguelike MOBA is a browser prototype combining a DOTA-style top-down hero controller with roguelike survival waves. Players control a hero in a circular arena, defeat creeps and bosses, gain gold and XP, and choose upgrades during a run.

## Core loop

1. Start solo or host/join a P2P co-op run.
2. Move around the arena and fight incoming waves.
3. Use Q/W/E/R abilities to burst enemies or reposition.
4. Earn XP and gold from kills.
5. Pick a boon when leveling up.
6. Survive as many waves as possible.
7. On death, restart a fresh run.

## Player fantasy

The player should feel like a compact MOBA hero in a dangerous arena: tactical movement, ability cooldown timing, enemy kiting, and escalating roguelike power.

## Current hero abilities

- `Q` Bolt: projectile toward cursor.
- `W` Dash: quick reposition toward cursor.
- `E` Nova: area damage around the player.
- `R` Storm: repeated area damage at target point.

## Current enemy types

- Creep: low-health melee enemy.
- Elite: tougher enemy with higher rewards.
- Boss: large high-health enemy spawned every fifth wave.

## Continuation principles

- Prefer playable improvements over systems that are not visible in-game.
- Keep solo gameplay working before expanding multiplayer.
- Keep the low-poly art direction coherent: faceted geometry, simple silhouettes, readable colors.
- Add new systems behind small, testable interfaces.
