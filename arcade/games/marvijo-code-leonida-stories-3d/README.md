# Leonida Stories 3D

A third-person, open-world crime game that runs entirely in the browser: a 3D remake of the 2D
*Leonida Stories*. Same seeded island city, same story, now with real vehicle physics,
a chase camera, day/night lighting and synthesized 3D sound. No build step: plain HTML + JavaScript,
with [three.js](https://threejs.org) for rendering and [cannon-es](https://github.com/pmndrs/cannon-es)
for rigid-body physics (both vendored in `vendor/`).

> Built by Claude Fable 5.1 in Claude Code from one prompt, on camera.
> Watch this 3D build and the gameplay: https://www.youtube.com/watch?v=DnnMnQjyBkg
> Part one (the 2D game): https://www.youtube.com/watch?v=hhbCLvs7ZP0

## Play

Open `index.html` in Chrome/Edge/Firefox, or serve the folder:

```
python3 -m http.server 8000   # then open http://localhost:8000
```

Click the game to lock the mouse (Esc releases it and pauses).

## Features

- **City**: procedurally generated 600 m × 600 m island (seed 1337, identical layout to the 2D game): road grid with lanes, crosswalks and curbs, downtown high-rises with lit windows at night, parks, parking lots, pedestrian boulevards, a beach with palms, street lamps, water and a sky dome with sun, dusk and stars. Full day/night cycle (24 h in 12 real minutes) with shadows, headlights and lamp glow.
- **Vehicle physics** (custom, on top of cannon-es rigid bodies): four independent raycast wheels with spring/damper suspension, anti-roll bars and droop travel; slip-ratio / slip-angle tyre model (Pacejka-style curves, friction circle, load per wheel from the suspension); engine torque curve with rev limiter, automatic gearbox with shift cut, engine braking, reverse; brake bias, ABS, traction and stability control; aerodynamic drag and downforce; weight transfer, curb hops, rollovers (with auto-recovery), collision damage from impact speed, smoke/fire/explosions. Motorbikes are two-wheel bodies with an active lean controller.
- **11 vehicle types**: sedan, compact, sports car, muscle car, taxi, police cruiser, van, truck, motorbike, SWAT van, bus, each with its own mass, engine, gearing, grip and profile-extruded body mesh.
- **On foot**: camera-relative movement, sprint, right-mouse aiming with a crosshair, 7 weapons (fist, bat, pistol, Uzi, shotgun, assault rifle, RPG), hitscan bullets with tracers, rockets, drive-by shooting, melee.
- **Living city**: pedestrians that walk the sidewalks, cross streets and flee; gangs that fight back; traffic AI that follows lanes, slows for corners, brakes for cars and people, honks and panics; carjacking; peds get knocked flying by cars.
- **5-star wanted system**: foot cops that arrest you, pursuing cruisers with sirens and light bars, SWAT teams and a police helicopter with a searchlight and door gunner. Lose the heat by hiding, bribes, or Pay 'n' Spray.
- **8 story missions** across three contacts (Lucia, Ray, Tony): car theft, timed delivery, assassination, a police chase, a street race against AI drivers, a convoy takedown, a bank heist and the final compound assault. Side jobs: taxi fares and vigilante duty. 15 hidden packages, hospital, safehouse (save and sleep), Pay 'n' Spray, Ammu-Nation shops.
- **Sound**: procedural WebAudio engine that follows rpm, gear shifts, tyre squeal, wind, sirens, helicopter rotor, gunfire, explosions, crashes and three radio stations.
- Save/continue via localStorage.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move (camera relative) / drive |
| Mouse | Look around |
| Right mouse | Aim |
| Left mouse | Attack / shoot / drive-by |
| Shift | Sprint |
| E | Enter or exit vehicle (steals occupied cars), talk to shops |
| Space | Handbrake |
| 1-7 / wheel | Switch weapon |
| C | Toggle camera distance |
| T | Start / stop taxi or vigilante job (in a taxi / police car) |
| R | Change radio station |
| M / Tab | City map |
| F5 | Quick save |
| Esc | Pause menu |

## Play-testing

`test/playtest.js` drives the game with Playwright in headless Chromium (SwiftShader WebGL) and
writes screenshots to `test/shots/`. It uses the in-game `G.simulate(seconds)` stepper so the
simulation is deterministic regardless of rendering speed, plus real key/mouse events:

```
node test/playtest.js basic physics missions missions2 side death traffic shops stress
node test/showroom.js      # vehicle / pedestrian line-up screenshots, day and night
```

Append `?test=1` to the URL to run the game in the low-cost test configuration (no shadows,
reduced resolution, no pointer lock).

## Code layout

| File | Contents |
| --- | --- |
| `js/util.js` | helpers, seeded RNG, tyre curve |
| `js/world.js` | island/city generation, road graph, heightfield, building raycasts, minimap |
| `js/scene.js` | 3D city builder (ground, curbs, markings, buildings, trees, lamps, water) and sky/lighting |
| `js/physics.js` | cannon-es world with static buildings, trees and coast walls |
| `js/vehicle.js` | vehicle specs, suspension/tyre/engine simulation, damage, AI driving, car meshes |
| `js/ped.js` | pedestrians, cops, gangs: AI, movement, ragdoll-lite knockdowns, animated meshes |
| `js/police.js` | police helicopter |
| `js/effects.js` | GPU particles, skid marks, decals, tracers, flashes, explosion spheres |
| `js/missions.js` | story missions, taxi and vigilante side jobs |
| `js/audio.js` | procedural WebAudio |
| `js/ui.js` | DOM HUD, minimap, menus, dialog, title and map screens |
| `js/main.js` | game loop, player control, camera, weapons, wanted system, spawners |
