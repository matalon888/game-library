# The Black Meridian — flight and mission guide

World 6 has twelve circuit sectors and a thirteenth, optional Century Ship.
All are available immediately. There are 49 selectable stages in the game;
the Grand Tour includes 48 and the Meridian circuit includes twelve.

## Flight audio and radar

The spacecraft has its own onboard sound palette: a rounded ion-drive tone and
filtered exhaust, quieter attitude/lateral-jet hiss, and beam resonance. Sound
follows **actual firing**, not requested thrust or ship speed. There is no diesel
idle while coasting; an empty tank, a blackout, full shadow on a solar craft,
pause or frozen simulation cannot leave a thrust loop sounding indefinitely.
Order confirmations, mission events, impacts and captures use electronic cues.

**H** sends a visual radar pulse with an electronic chirp, not a horn. The same
operation is on the flight-deck RADAR PULSE button and the chart's **◎** touch
button. The scan expands from the transmission position, briefly highlights
charted contacts and fades on presentation time; it does not change the physics,
consume propellant, pause the run or affect leaderboard eligibility. The shared
1.1-second cooldown prevents stacked signals. **M** mutes audio, not the visual
scan. Stage changes clear the pulse and fade/cancel queued audio.

Sea worlds retain their marine engine, horn and terminology. The audio is
avionics feedback, not sound propagating through vacuum. See
[flight-audio test notes](FLIGHT_AUDIO.md) for implementation and limitations.

## Flying something that will not stop by itself

W/S select persistent fore/aft engine notches. Full reverse thrust is as strong
as full forward thrust; changing direction takes a brief actuator ramp, not an
instant velocity reversal. Space cuts the main engine. A/D fire torque jets:
release them and spin persists; counterfire to stop rotation. Q/E translate
sideways without applying torque. Held controls combine on keyboard and touch.

There is no water drag, rotational damping, speed cap, automatic stabilization,
gravitational orbit or relativistic correction. These are two-dimensional local
navigation exercises. Main and lateral forces divide by spacecraft mass;
rotational response is also mass-scaled. The propellant gauge is a scalar
reference-mass impulse reserve (displayed as delta-v), not a calibrated fuel
mass or rocket-equation simulation. Mass is held constant during burns. All
jets and rescue beams consume that reserve. An empty tank cannot produce thrust.

The white arrow shows the nose; the blue vector shows actual velocity. The
drift vector is the position twelve seconds ahead with no further thrust. The
HUD separates signed nose-relative speed, sideways drift, spin, range and
**relative speed against the active target**. Space uses m/s rather than knots.

To dock, fit the entire hull inside a capture cradle, face its arrow, match its
velocity, reduce relative spin below 0.012 rad/s, cut main output below 2% and
release every held jet/beam control. Most cradles allow 0.24 m/s relative drift.
Final capture takes two seconds. A moving cradle does not stop for you.
Contact with any craft counts against clean results. Any free hull crossing a
sector boundary fails immediately; there is no perimeter or invisible bounce.
Onboard audio represents instrument/engine feedback, not sound crossing vacuum.

## Moving cradles and compulsory fuel

Hildara's landing platform follows the asteroid's analytic motion. The rock's
silhouette is solid; its cantilevered survey cradle is the landing zone. The
same ephemeris gives rendering, collision position and cradle velocity.

In **The Last Fill Before Dark**, Faraday Port starts ahead and moves away at
4.2 m/s. The mass-one courier starts at rest with only 4 reference impulse units.
Its velocity gain cannot exceed 4 m/s, regardless of burn timing. Distance
alone would not require fuel in a drag-free world: the *receding target* does.
The accessible tanker moves at 1.1 m/s. Hold relative rest in its amber cradle
for six uninterrupted seconds to refill to 85 units, then intercept Faraday.
An interrupted hold resets progress and never grants partial free fuel.

## Some Assembly Required

Fly Kestrellet into Waywarden's upper cradle, then Wrenlet into the lower cradle.
Each capture requires two seconds of relative rest with all jets cut. Control
transfers to the other actual spacecraft; no fuel or impulse is manufactured
by the handover. Captured tender mass joins the mothership. Terminal clamps
dissipate the small permitted relative motion.

After both captures, fly the 4.7-mass assembly to its final port. Its 102-metre
collision beam conservatively encloses the tenders and support truss, so the
larger cradle matters. Docked craft remain visible and count in the envelope.
Control transfers are not counted as distance travelled.

## The cannon has an opinion

Reach the firing rectangle, rotate toward the hollow lead diamond, stop
translation/spin and cut all jets. A steady, aligned three-second firing
solution causes an automatic shot. Leaving the box, firing a jet or drifting
out of aim resets the charge. There is no manual instant-hit button.

The projectile travels at 115 m/s relative to the firing ship and inherits its
velocity. A swept trajectory must actually intersect the target hull; misses
can be retried. The opposite recoil impulse changes the warship's velocity.
Recover from it and return home only after a confirmed hit. The moving enemy
corvette requires leading its ephemeris, not aiming at its present position.
The lead marker includes projectile travel time and inherited ship velocity.

## Rescue beams

F locks/releases a friendly craft within 170 metres and clear rock line of
sight. J attracts, K repels. The two bodies receive equal and opposite momentum
changes, divided by their individual masses. A beam cannot brake the pair's
centre of mass for free. It cannot push through an asteroid, work beyond range,
or create impulse after fuel exhaustion. Release leaves both velocities intact.

The friendly must settle in its own cradle after the beam has actually been
used. The capture crew secures it and releases the beam. You must still dock
the tug. A secured friendly remains a collision obstacle. Perihelion Dispatch
requires fuel before accepting the beam lock, then combines rescue and drifting radiation cover.

## Light is geometry

Light travels horizontally from the left. Convex asteroid silhouettes cast
shadows; exposed hull vertices and the centre determine illuminated fraction.
Partial cover is partial protection, not an all-or-nothing centre-point test.

The two shelter missions now use **continuous radiation**. A fully exposed hull
heats at 34 percentage points per second; full cover cools at 22 points per second.
Reaching 100% heat is fatal. The shields drift steadily rather than waiting for a
short flare-free sprint. Haven migrates north at 0.30 m/s. Its shadow reaches the
station’s centred capture hull around **05:25**, and leaves around **13:30**. Take
the eight-second survey reading, then use that broad arrival window.

The flight computer samples future full-hull cover every five seconds and labels
its estimate with ≈. The forecast is guidance, not an objective lock or finish
timer. Position, hull geometry and the actual shadows determine exposure on every
tick. Perihelion Dispatch’s slowly opposing shadow lanes overlap during the rescue;
the station’s centred capture hull loses full cover at approximately **08:25**.
The dispatch tender is radiation-hardened; the tug is not. Retry resets all motion.

**Borrowed Sunlight** reverses the incentive. Every jet draws directly from
solar cells, with no battery; full shadow gives zero thrust and zero propellant
consumption. Motion still persists. In partial light, force and consumption
scale together. The final observatory is in shadow: brake while sunlit and
coast in gently. **Cold Transit** instead inhibits all jets inside a scanner
field; its moving maintenance drones demand a stable, correctly timed coast.

## Yesterday Has Right of Way

**Janara Station** is a physical concourse, not painted scenery. Two large freight
stacks force a winding path between its bays. The west entrance stays open; the
station plates and equipment blocks share their drawing and collision geometry.

Capture chronogate **A**, then **B**, then the experimental terminal. Each gate has
an explicitly marked **A′ / B′ arrival site**. Both require two seconds of relative
rest with jets cut. An insertion preserves velocity, orientation and remaining
fuel; the score clock never rewinds and the jump is not counted as travel.

Each leg records your actual trajectory at 30 Hz, with initial and endpoint poses.
The jump itself is never interpolated into a diagonal ghost path. Gate A starts
its history 18 recorded seconds ahead; B starts its own 32 seconds ahead. Each
history repeats its recorded leg, resetting to its own starting point on each
cycle. The first history keeps its clock when the second is introduced. They do
not disappear when you wait and do not push each other. Only your overlap with a
solid history causes a paradox. Your optional personal-best ghost remains harmless.

The final leg therefore shares the concourse with **two** past selves. The three
marked passing bays and different lines through the central aisle let you yield
or pass, rather than retracing your previous line blindly. A deliberately cautious
reference flight stops at its turns and takes **20:50.01**; this is not an optimal
speedrun. Each recorded leg has a fifteen-minute limit; retry clears both histories.

## The Century Ship: why thirty minutes cannot suffice

The nearest-system capture centre is 110,592 metres from departure on this
**compressed** interstellar chart. Main acceleration is 0.12 m/s² and lateral
acceleration 0.04 m/s². Even simultaneous full main and lateral burns have magnitude
at most `hypot(0.12, 0.04) = 0.126491106 m/s²`. Rotational jets do not add translation.

**Erebune**, a 3,800-metre-radius rogue planet, blocks the straight route. The chart
is now 18 km tall, leaving real space to pass above or below its limb. The normal
camera tracks locally; the overview and route strip mark the planet. There is no
gravity assist. Any planetary surface overlap ends the mission, rather than giving
a collision impulse that could be exploited as free braking or steering.

Grant a hypothetical optimal pilot instant engine response, unlimited fuel,
maximum combined acceleration in any direction, no planet, and a point-sized craft
that can finish anywhere in the cradle. The closest capture point is still
**110,550 metres** ahead; the stationary cradle allows final speed 0.24 m/s. The
best possible x-velocity envelope is `min(a*t, v + a*(T-t))`, so

```text
maximum distance = a*T²/4 + v*T/2 - v²/(4*a)
a = hypot(0.12, 0.04), T = 1800 seconds, v = 0.24:
maximum distance = 102,673.68 metres < 110,550 metres.
```

Successful voyages cannot use surface contacts, beams, cannons or moving obstacles
to gain an extra impulse. The real hull, finite actuator response, planet detour
and two-second capture hold cannot improve the relaxed bound. There is no
`time >= 1800` completion gate.

The clean reference uses **eight commands** and completes in **1922.333333 seconds**.
It keeps the main-burn schedule while independently shifting north by 4,649.9161 m,
clearing the planet, then reversing that lateral transfer:

```text
   0.000000 s  Full forward + left lateral jets
 340.950000 s  Right lateral jets
 681.900000 s  Cut lateral jets
 959.833333 s  Full reverse main thrust
1200.000000 s  Right lateral jets
1540.950000 s  Left lateral jets
1881.900000 s  Cut lateral jets
1920.000000 s  Cut main thrust
```

`DeadSlow.watch("century-ship", 32)` is roughly a one-minute real-time viewing
when the browser keeps up. Acceleration remains practice and never writes a
ranked voyage. At normal speed the in-game clock and wall time track each other
except for pauses or overloaded rendering. Z includes a full-sector overview;
the regular camera tracks locally with an offscreen bearing and route strip.

## Verified flight library

These are clean reference completions, not claimed optimal times. Every event
is a normal throttle/RCS/beam input applied through the live game at 120 Hz.
No fixture sets coordinates, edits fuel, bypasses objectives or relaxes physics.

| ID for `DeadSlow.watch(id, speed)` | Mission | Measured clean seconds |
| --- | --- | ---: |
| `vacuum` | Nothing to Push Against | 148.358333 |
| `wandering-stone` | A Stone with a Schedule | 128.858333 |
| `last-fill` | The Last Fill Before Dark | 358.358333 |
| `family-reunion` | Some Assembly Required | 367.466667 |
| `newtons-broadside` | Newton’s Broadside | 233.833333 |
| `moving-argument` | A Moving Argument | 242.833333 |
| `equal-and-opposite` | Equal and Opposite | 228.358333 |
| `umbra` | The Safe Side of a Stone | 398.508333 |
| `borrowed-sun` | Borrowed Sunlight | 410.783333 |
| `yesterday` | Yesterday Has Right of Way | 1250.008333 |
| `cold-transit` | Cold Transit | 163.108333 |
| `perihelion-dispatch` | Perihelion Dispatch | 393.258333 |
| `century-ship` | The Century Ship (bonus) | 1922.333333 |

`DeadSlow.runs()` lists these and the twelve established marine recordings.
`DeadSlow.timeline(id)` exposes their inputs; `DeadSlow.verify("all")` measures
all 25. Reports flag divergence and never silently label an incomplete attempt
verified. Playback remains unranked and cannot replace PBs, ghosts or splits.
