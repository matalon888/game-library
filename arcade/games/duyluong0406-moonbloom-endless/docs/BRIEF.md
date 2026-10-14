# Project brief

## Identity

- Name: Moonbloom Endless
- Mode: original
- Engine: html5
- Dimension: 2d
- Platforms: web, mobile
- Features: endless bubble shooter, descending field, continuous spawning, combos, local high score

## Source and rights

Original implementation inspired only by the familiar match-three bubble-shooter interaction. No source code, production assets, branding, or authored text from the linked reference will be copied.

Rights status: Not applicable.

## One-sentence pitch

Fire enchanted spirit orbs into a slowly descending moonlit canopy, chain colorful matches, and keep the garden alive for as long as possible.

## Target player and player fantasy

Casual web and mobile players who enjoy one-hand aiming, satisfying chain reactions, readable strategy, and score-chasing sessions of roughly 3–10 minutes.

## Core loop

1. Read the current orb, next orb, danger line, score, and combo state.
2. Aim directly or bank a shot from a wall; release to fire.
3. Match three or more colors to pop them; disconnected clusters fall for bonus points.
4. The canopy descends and new rows spawn continuously; survive increasing speed until an orb crosses the danger line, then retry and chase the local high score.

## In scope

- Responsive HTML5 Canvas gameplay for mouse, touch, and keyboard.
- Six original orb families with distinct silhouettes/patterns as well as color.
- Continuous descent, timed spawning, increasing difficulty, wall bounces, match clearing, falling clusters, combo scoring, danger feedback, pause/restart, and local high score.
- Original Moonbloom environment, launcher character, UI frame, particles, screen feedback, and lightweight generated SFX.

## Out of scope

- Accounts, leaderboards, backend, ads, IAP, multiplayer, campaign levels, and copied reference assets/code.

## Success criteria

- A first-time player can aim, shoot, form a match, understand the descending threat, lose, and restart without instruction outside the game.
- Maintain a smooth 60 fps target on a representative desktop browser and playable performance on a modern mobile viewport.
- Deliver a self-contained original vertical slice with automated core-logic tests and a browser-tested build.

## Constraints and open questions

- Scope is a polished vertical slice; later production breadth depends on Prototype Gate approval.
- Art must remain legible at 360 px viewport width and avoid color-only gameplay cues.
