# Architecture

## Runtime and build

The game remains plain JavaScript with CommonJS exports for Node tests and
named browser globals. `index.html` is the ordered source manifest;
`tools/build.cjs` inlines its modules and stylesheet without transpiling physics.
The resulting `dist/index.html` runs offline with no runtime dependencies.
Duplicate modules and external code assets fail the build.

TypeScript is a pinned development dependency. `npm run typecheck` checks JS
with JSDoc under strict settings, without emitting files. The first checked
boundaries are commands, simulation adapters, compatibility and railway level
data. `contracts.d.ts` describes the adapter's ports; `rail-level-types.d.ts`
describes the railway's mission variants. `tsconfig.json` is an explicit list,
so unchecked legacy internals are visible rather than hidden behind `any`.
`tests/contracts.ts` guards against accidentally weakening these contracts.

## Shared shell and domain state

`game.js` owns input lifetime, modal state, the fixed-step clock, circuits,
records and the current adapter. `simulations.js` resolves the level's explicit
`simulation` ID and rejects missing or duplicate registrations.

Every adapter creates its domain state and supplies `step`, `ready` and `clean`.
The railway adapter in `rail-adapter.js` also owns its command/audio integration,
presentation delegates, ghost sampling and result details. It receives narrow
services rather than reaching into the shell's globals. A railway run has a
`rail` state and a camera/ghost `focus`; it has no placeholder ship, marine jobs,
water environment or dock. Its vehicles remain an articulated network object.

Marine, space and rolling registrations still delegate to their established
functions in `game.js`. Their engines are separate modules, but their shell
integration is not yet fully extracted. Move those adapters when their next
substantial change needs it. Do not add a universal vehicle object merely to
make incompatible domains look alike. A future campaign should register an
adapter and declare its own state and commands.

## Time and commands

`requestAnimationFrame` feeds a 1/120-second accumulator. Simulation time drives
hazards, passenger movement, brake propagation and objectives. Manual stepping,
recording playback and accelerated watching use that same path. Acceleration
adds ticks; it never increases the timestep. Long frame gaps and hidden tabs
pause into practice. Window-focus pausing is optional; held inputs are cleared
on focus loss. Shift+R retries immediately without a confirmation dialog.

`rail-commands.js` is the shared definition of railway command payloads, lever
metadata and keyboard mappings. UI buttons, keys, `DeadSlow.rail()` and recorded
commands all reach the adapter and then `Railway.command()`. The engine validates
the payload and current eligibility before applying it. The UI may explain or
disable an action; it cannot authorize one. Numeric lever commands retain their
existing clamping behavior. Invalid commands do not mutate train state beyond
a notice. Uncoupling identifies both neighboring vehicles; old recording strings
remain supported and resolve against the current topology.

Coupling prepares a candidate route and verifies every donor vehicle before
publishing the merged consist, conserved momentum and selection. Uncoupling
publishes both cuts and the selected detached cut in one synchronous transition.
No render, callback or async work runs in the middle. `assertInvariants()` checks
unique vehicle ownership, finite motion, a valid selected cut and attached
helper power. Bounded mixed-command tests exercise those invariants.

The console exposes detached inspection data. Mutations mark attempts and
circuits as practice; replay cannot write ranked records. `?test` exposes the
raw harness only for tests. This is an inspectable local game, not an anti-cheat
system. See [CONSOLE.md](CONSOLE.md).

## Simulation and presentation

`rail.js` owns track sampling, switch occupancy, per-car grade and adhesion,
brake response and heat, coupler forces, coupling and objectives. Rendering uses
the same geometry. `tools/validate-rail.cjs` checks references, switch connections,
passenger route continuity and task dependencies before a release. Structural
types alone cannot detect a misspelled track or vehicle ID.

`rail-presentation.js` produces one HUD snapshot of metrics, warnings, assistance
and action eligibility. Warning holds and action hysteresis live in WeakMaps
outside physics state. Snapshot creation never changes the simulated train.
Topology changes reset action history. Head/tail follow the selected driving end;
speed can be negative during rollback. `rail-view.js` consumes this projection
and draws the chart; procedural audio is another consumer, never a clock source.

The established marine engines retain water-relative drag, whole-hull collision,
open chart boundaries and real tow momentum. Space uses its own forces while
sharing geometry helpers. Rolling terrain and hazards share surveyed geometry
with their renderer. Preserve these domain rules during later extractions.

## Records, courses and recordings

The storage key remains `dead-slow.records.v1`. Schema **18** changes the JSON
format to carry compatibility metadata; schemas 1–17 still pass through their
historical migrations. A frozen schema-17 route manifest supplies legacy signatures,
so future additions and reordered circuits cannot adopt old results. This refactor keeps all current course/rule revisions at
1, so existing version-17 records remain comparable.

`compatibility.js` derives a stage signature from `simulation`, `courseRevision`
and `rulesRevision`. Circuit signatures include the ordered stage IDs and their
signatures. Change a course revision for geometry/start/objective changes; change
rules revisions on affected levels for handling/scoring changes. Neither requires
a new save schema. Text, layout and sound edits normally change neither.

On import/load, incompatible active results, ghosts and splits move into named
archives; compatible records stay active. Full archived signatures accompany
compact archive keys, and hash collisions cannot merge unrelated records. The
logbook exposes archived results and exports preserve them. Sanitizing an already
migrated save is idempotent. Imported data is filtered JSON, never executable.

`verification.js` is generated from checked-in JSON control recordings. Legacy
recordings receive baseline compatibility metadata during synchronization; later
recordings must declare their course signature when it differs. `watch` rejects
incompatible recordings before loading a run. Do not regenerate input sequences
to conceal refactor drift: existing recordings must keep their completion times,
cleanliness and outcomes. See [TESTING.md](TESTING.md).

## Scope of the next campaigns

The atlas has eight worlds, seven complete campaigns, 84 circuit missions and one
separate bonus. Stable IDs identify stages and campaigns; world numbers are
presentation. The remaining 24 cards are disabled placeholders.

Build new mechanics inside their domain engine, with a small command contract,
validated level data and a presentation projection. Share the shell's clock,
practice policy, input cleanup, circuits and records. Extract another abstraction
only when two domains need the same behavior; preserve the offline HTML deliverable.

## Pale Reach surface service

`polar-levels.js` declares the first six World 7 charts. `polar.js` owns a
hexagonal sheet grid (144 m² per tile), per-cell opening times and closure rates, physical fleet
ships, drifting solids, cargo states and completion. `polar-adapter.js` plugs
that state into the existing shell; `polar-view.js` draws the same collision
grid and exposes captain, tow and gun orders. `polar-grid.js` shares tile polygons,
point lookup and six-neighbor connectivity between rendering, collision and
route planning. No marine job state is fabricated.
Authored water basins, thin patches and pressure ridges can use concave polygons
in metre coordinates. These are sampled at hex centres during initialization;
rendering and collision retain the same grid without stretching either axis.
The rescue chart uses these boundaries for irregular leads and waiting basins.
The view retains a raster ice layer per live grid. Fractures repaint nearby
96-metre regions immediately; slush appearance is sampled at 8 Hz in 32 bands.
Each dirty region is repainted from opaque water, including neighboring hex
edges, so clearing slush cannot leave old opacity behind. Zoom/DPR changes
rebuild the raster. Ships and moving ice still draw every frame, while physics
continues at 120 Hz with continuous slush density. Unchanged HUD text and split
markup retain their DOM nodes. A draw-call budget guards against repainting the
whole field per frame; CI also compares incremental ice updates with fresh pixels.
The folding `polar-info` chart window owns status, briefings, fleet reports and
elapsed splits. The sidebar holds only orders and selectable targets. Missions
without extra orders collapse that sidebar. The same window survives the finale
handoff, switching from submarine reports to the surface convoy's reports.

Sheet fractures require forward momentum and a bow approach, cost speed and
open a narrow shoulder beside the hull. Pressure ridges remain impassable.
Slush is a continuous resistance field after a 20-second grace period; an
opened cell never becomes a solid collider under a vessel. Breaking can leave
mass-bearing floes, spawned only after occupied hulls clear their location.
Icebergs drift independently and collide as solid bodies. Their keel metadata
also defines underwater clearance in the submarine assignments.

Supply captains plan connected cleared water with beam clearance, then apply
the same engine lag, thrust, rudder, drag and collision model as the player.
They brake for ice and traffic. Hold cannot erase velocity. They unload at
rest, await a fresh Proceed for their return, and must get home with their
hulls intact. Navigation may retain its last valid route when a conservative
planning clearance rejects the current grid cell; physics still prevents
crossing intact sheet. Paths are requests, never position constraints.

`polar-operations.js` supplies the survey rescue, defense and strike state. A
stern-to-bow spring/damper tow applies equal and opposite impulses and torque;
winching, overload and obstacle chafe act on the physical line. Scientific
recorders require sustained relative rest, and the whole rescued hull must stop
in safe water. Pickets move, collide and issue warnings without firing.

Each changing lead is cut by a visible physical icebreaker: Council cutter Awl
in the rescue, three hostile Shelf cutters in defense, and Compact cutter Rime
on the strike flank. Their captains use ordinary throttle, rudder and thruster
orders, brake for traffic, and call the same bow-contact icebreaking code as the
player. Chart dashes show intended routes, never a promise of cleared water.
No timer opens hexes. Hostile cutters can be targeted; disabled ships coast to a
stop, and their wrecks and opened wakes remain physical. Cutters park clear of
their approaches after reaching open water.
Hostile captains use the same connected-water planner as supply vessels, so a
player-cut shortcut works for either side. No paths move hulls directly. Guns
require range, bow arc, a clear line, low speed and rotation, and a timed solution.
Each manual player shot has recoil, ammunition and a reload. Enemy solution lines
announce attacks; shells travel independently and strike the first hull, fixed
installation or solid ice they meet. Exact hex intersections along a narrow ray strip block both solutions and shell flight on unopened sheet or pressure ridges, while opened slush remains transparent to fire. Destroyed targets remain physical wrecks.
Defense ends with cargo ashore and both transports returned, regardless of live
attackers. Strike completion also requires docking after both installations fall.

Borrowed Water has no arrival deadline: Rime waits at Glass Quay, late checkpoints
still count, and heavy slush leaves retry to the player. Its rules revision is 2;
all six charts use course revision 2. The physical cutter routes archive the
previous timed-opening records for 7-04–7-06 only.
Each assignment has normal individual records, elapsed split times and ghosts.
The completed twelve-assignment campaign joins the 84-stage Grand Tour.
Individual signatures and the first six campaign signatures remain unchanged;
the prior 72-stage tour is archived through the compatibility manifest.
The polar tests cover boundaries and complete all six surface missions
through ordinary controls at 120 Hz, including towing and physical projectile
hits. A passive defense run loses a transport before it can leave. Browser UI checks run
inside the existing atlas job; there is no additional CI matrix or job.

## Pale Reach submarine watch

`submarine-levels.js` adds 7-07–7-09 to the same campaign.
`submarine.js` uses the existing inertial hull integrator and captain controls,
with gradual depth changes between 18, 48 and 88 metres. Whole-hull overlap
determines keel and seabed clearance. Invalid horizontal approaches collide;
terrain never snaps a vessel into another depth band. Static hex chart texture
is cached; moving keels and depth-dependent obstruction shading stay live.
Player and hostile submarines use a rounded pressure-hull polygon in `physics.js`
for drawing, collision and clearance. Precomputed cap directions keep it cheap.
The shell rejects the horn action underwater and hides its button, restoring it
on the surface bridge. Sonar uncertainty is isotropic: the chart uses the same
circular radius as the stored estimate.

`sonar.js` stores detached observations, never live actor references. Passive
listening supplies uncertain position, motion and machinery clues; speed,
counterthrust and thrusters mask the receiver and alert listeners. Active pulses
schedule echoes after travel time and give enemies an expiring emission fix.
Unobserved tracks extrapolate briefly, then hold position while uncertainty grows.
The underwater view renders hidden contacts from those estimates alone; only
the covert mission's explicitly reported surface patrols have exact chart symbols.

Identification is a separate bridge order. Torpedoes require a fresh identified
submarine track, matching depth, forward arc, clearance and four steady seconds.
They follow the plotted solution through space, can miss, and strike the first
solid obstacle or hull at their depth. Enemy attacks use expiring sensor fixes.
Going quiet lets the minelayer lose contact; decoys are released from its stern.
One damaging hit makes it abandon minelaying and withdraw, which is a successful
defense once the passage is safe and Petrel returns. Pursuit is unnecessary.

The covert team needs quiet, slow transfers at working depth. Work advances only
after leaving the exposed area; recovery and homecoming are separate objectives.
Patrol listening arcs, self-noise, range and depth determine suspicion. Suspicion
can decay, while a confirmed alarm remains latched. No infantry state is exposed.

`submarine-navigation.cjs` completes all three missions through ordinary helm,
depth, sonar and mission orders, using observed tracks and visible patrol reports.
Focused tests cover lost-contact uncertainty, fire interlocks, projectile flight,
depth clearance, alarm latching, failure deadlines, pause/retry and a warm chart
draw budget. Existing browser CI checks the new controls and mobile layouts;
there is no additional job or Node version. Existing surface course signatures
remain unchanged; completing the campaign extends the Grand Tour to 84 stages.

## Extraction, neutral rescue and the final passage

`polar-finale-levels.js` supplies 7-10–7-12. `submarine-recovery.js` attaches one
pickup to a drifting ice margin and keeps the other in a shelter whose plates
separate continuously. The team begins waiting; a change of rendezvous moves
its beacon over time. Transfer requires the correct depth and low relative
speed. Exposure and pickup redirect already-visible patrols through ordinary
captain controls, without spawning or teleporting them. Recovery and escape
are separate objectives; confirmed suspicion still fails the assignment.

The rescue extends the existing surface operation and tow model. Three groups
need slow rescue contact before accepting Proceed, and captains plan through
connected water with hull clearance. Oriel must stop entirely in the marked
refuge outside the turning pocket. Two visible gunboats exchange physical
shells across the short route; a longer southern cut avoids that line of fire.
Their combat earns no rescue credit and is excluded from rescue damage totals.
Success requires all three groups and the disabled vessel to remain alive.

`polar-finale.js` owns the shared watch. It creates Petrel and a live surface
run together. Surface physics advances the shared iceberg exactly once while
the submarine checks the same keel at depth. Rime cuts only the initial lead;
the relief ships and Kestrel wait physically at anchorage. Finishing the
engineers' work disables the actual surface installation. Recovering the team
and securing Petrel hands command to the existing Kestrel hull. It retains the
ice grid, fracture timestamps, floes, NPCs, damage, elapsed clock and split list.
The bridge replaces depth/sonar controls with convoy orders at that handoff.

Weather continuously increases slush resistance; it never solidifies water
through an occupied hull. The explicit 45-minute window applies to both legs.
Kestrel cuts the remaining passage and the final relief ship reaching the exit
completes the mission. Pause freezes both runs; retry reconstructs both legs.
The result records each leg's duration and includes submarine damage in the
clean-run decision. Focused tests cover these transitions, physical causality,
record migration and ordinary-control completion of both pickup choices and
both final surface assignments. Desktop and mobile checks stay in the existing
browser job; no CI matrix or job is added.
