# The Long Grade: twelve assignments

On dry track, notch 3 launches faster than notch 4: wheelspin reduces the
force transmitted by the wheels. Motor effort falls with road speed, bringing
full power within dry adhesion at roughly 12 km/h. Wet-leaf sections retain
their lower grip. Railway rules revision 3 archives earlier handling times.
`DeadSlow.watch('long-grade-10', 8)` shows the ferry loading sequence.

Split clocks preserve the first completion time. A struck-through objective is
no longer satisfied and must be restored if required for victory. Next-split
guidance puts the route or buffer distance before reminders about selected cuts.
Double-click no longer zooms; use Z or the zoom button.

The vessel mission requires shunting parked flats off its swept path. The
running track is clear for the locomotive and normal wagon bodies; the long
vessel alone swings into the neighbouring siding. Secure the carriers, move
P1/P2 to the refuge, return for the vessel, and reverse through the headshunt.
Their actual oriented bodies affect both preview and collision checks, so other
clear parking positions also work. `DeadSlow.watch('long-grade-8', 8)` demonstrates
the complete sequence with ordinary controls. Blue preview outlines show the
rolling stock beneath the red cargo envelope.

At 1×, Train status uses a preferred empty area for each level and avoids tracks,
points, destination labels and tunnel mouths. Placement is stable throughout a
run; resizing recalculates it. The panel keeps its natural height without an
internal scrollbar. When the full panel cannot fit in a clear pocket, it uses
the default upper-right corner. Folding and expansion remain player choices.

Version 6 completes World 5. All twelve assignments join the railway circuit
and the 72-stage Grand Tour. Schema 17 separately archives earlier 5-04, 5-09
and 5-12 routes and their circuits. Other railway records remain active.

## Engine boundaries

`src/rail-levels.js` contains the track surveys, initial vehicles, switches,
destination zones and objective dependencies. `src/rail.js` has no DOM,
renderer, clock or dependency on the ship simulation. Its units are metres,
seconds, kilograms and newtons. The shared game loop advances it at 120 Hz.
`src/rail-view.js` owns train controls and canvas presentation.

Each connected cut owns an oriented, arc-length route history. Each vehicle
has its own coordinate and velocity along that history, mass, length, facing,
air pressure, brake temperature and handbrake state. Vehicles follow the
route actually traversed by the head. History is discarded only after the
whole cut clears; reversals can then take newly selected points. Occupancy
includes bodies, coupler gaps and a 12 m point-clearance margin.

Forces sum per vehicle: surveyed grade, resistance, adhesion-limited traction,
braking and adjacent coupler forces with free slack and damping. Brake orders
travel through the train with a delay and pressure response. Heat follows brake
work and cooling; fade begins at 180°C. Detached cuts retain air temporarily;
handbrakes hold them indefinitely. Gentle coupling merges routes, reverses
vehicle facing when needed and conserves longitudinal momentum. A route check
prevents coupling across adjacent parallel tracks.

Buffer and track-end impacts count once per contact episode. Stopping at the
buffers does not erase approach speed: an impact over 2 km/h blocks coupling
until the cuts separate beyond 3 m and approach again. Final parking requires
the listed wagons to remain coupled to the locomotive; delivery tasks still
allow the detached, secured cuts needed for shunting.

Stopping distance estimates full service braking with current temperature,
mass-weighted grade and brake response delay. It is an estimate, not a promised
stop point; changing grades ahead and coupler movement still matter. Curve
limits apply to every wagon, with sustained severe overspeed ending a run.

## Sound, warnings and a watchable run

The train has filtered diesel rumble, distance-driven paired bogie clacks, braking
noise, air release and mechanical coupling/point cues. Sound stops on pause,
mute, departure changes and failure. Cue counts are bounded during accelerated
playback. The shared horn remains available with H.

Curve warnings inspect each wagon and a copy of the selected route ahead.
Amber highlights the approaching speed restriction or an overspeed wagon;
red begins at 120% of the limit, before the sustained 135% derailment threshold.
Looking ahead does not reserve points. Junction lamps highlight both the common
track and the selected branch. Reverse is always labeled as an action.

5-01 has a fixed input recording available through the browser console:
`DeadSlow.watch("long-grade-1", 8)`. The transformer shuttle is available as
`DeadSlow.watch("long-grade-7", 16)` (3212.208 simulated seconds). Regenerate
that recording with `node tools/record-rail-run.cjs 7` and `node tools/sync-replays.cjs`. The tutorial completes in 590.408 seconds of
simulation time (about 74 seconds at 8×). No vehicle positions or objectives
are changed during playback. `DeadSlow.normal()` starts a fresh ranked attempt at 1×. Replay controls stay
out of the player UI. Regenerate with `node tools/record-rail-run.cjs`
followed by `node tools/sync-replays.cjs`.

## Assignments 5-04 through 5-08

| Assignment | Handling problem and reusable mechanic |
| --- | --- |
| Meet at Rook’s Hollow | Signal the passenger with H when ready. Fit the whole freight in Rook’s loop and set both junctions back to Main line. The short refuge requires splitting. The passenger follows clear blocks into Rook tunnel. |
| Three Wagons Going Somewhere | Detached cuts may start with speed and empty air reservoirs. Both service connections permit interception; coupling conserves the moving cuts’ longitudinal momentum. The gravel bed adds resistance and counts one rough contact. Secure the caught wagons manually. |
| Leaves on the Line | Low track adhesion limits tractive effort. Excess brake demand slides the wheels and reduces effective grip; brake estimates include that reduction. Rain and shaded ballast show the affected track. |
| One Bridge, Two Loads | Bridge capacity counts the full mass of every vehicle whose body overlaps the span. The locomotive begins between the loads. A receiving pocket and engine return loop allow ordered reassembly without teleporting or trapping the locomotive. |
| The Corners Are the Cargo | A vessel spans two articulated carriers. Its actual swept rectangle is checked against visible platforms and equipment. The preview uses the same geometry along a copy of the selected route; inspection does not reserve points. |

Traffic uses a separate autonomous consist representation with a prescribed
route, bounded acceleration/deceleration, body occupancy and collision checks
against player cuts. Its current route uses whole track edges as signal
blocks. Passengers wait indefinitely for a player departure signal (H or the
Signal departure button). Releasing a passenger does not clear its track signals
or throw points: a blocked or incorrectly aligned route holds it at red. Aligned
points are reserved within braking distance and cannot be changed underneath it.
Passenger vehicles do not participate in the player's coupling controls. Tunnel
portals cover entering carriages individually; the route clears only after the
last carriage is inside. The finale's Summit Junction must be set to Ridge tunnel.

Bridge ratings and cargo clearance are physical requirements, not mission
checkpoints. Cargo carrier links cannot be split while the vessel spans them.
The cargo assignment now uses a full-load headshunt stop followed by a reverse
push into the export spur. A route ribbon, four spaced silhouettes and one
collision outline replace the dense overlapping preview rectangles.

Head and tail always follow the selected reverser. UI speed is signed against
that direction, so rollback reads negative. Warning entry ignores tiny stopping
vibrations; action buttons require a quiet eligibility interval before relighting.
These display filters do not change physics or relax command validation.

Schema 15 archives the earlier bridge and cargo results. Bridge support pairs
must remain adjacent in the same cut whenever either vehicle occupies the span.
Assembly tasks can require wagon order toward the siding's buffers, ignoring
the locomotive's position within the completed train.

## Assignments 5-09 through 5-12

| Assignment | Route and handling problem |
| --- | --- |
| A Push from Behind | Back the freight across a curved, flat approach to No. 42, initially 78.4 m from the last wagon's buffers. Share a 20 m climb between front power and rear assistance, then reduce each as its end crosses the crest. Leave the helper in the marked summit berth and deliver the ore freight without it. |
| The Railway Ends Here | Split the rear pair before pushing the first pair aboard with the reach wagon. Retrieve the second pair, use the quay loop to get behind it, and push it onto the other deck. Park the locomotive and reach wagon ashore. |
| The Last Working Line | Retrieve the lowland cut before Low Crossing floods, then enter the dead-end quarry spur, collect its wagons and stop at the crew platform. Reverse clear of the junction and climb to the upland refuge. Every route remains physically usable until its forecast closure. |
| The Long Grade | Couple the helper, cross the mountain, retire it, descend with cool brakes and meet the coastal passenger in Lantern loop. Signal its departure and align both viaduct points and the Ridge tunnel exit. Deliver every supply wagon. All deliveries and helper retirement remain live requirements. |

The main engine is identified by its persistent `engine` ID, independently of
the group order or other powered vehicles. E / Q raises / lowers rear assistance
in place of the locomotive brake, leaving three levers in helper missions;
Space cuts both engines and applies the train brake. Detached helpers cannot
receive power. Brakes still propagate from the main locomotive. A sustained
pull above 120 kN overloads the finale's mountain couplers after eight seconds.
The helper introduction has lighter wagons, a gentler climb, a 130 kN sustained
pull limit with sixteen seconds to react, and three seconds of excessive
compression before failure (the finale allows 1.5 seconds). Excessive
rear compression on restrictive curves has its own visible warning and limit.
The grade strip shows the crest moving through the whole train. A persistent
status panel defaults to “Couplers within limits”; warnings retain their space
and clear after a quiet interval, so the controls do not jump around.

Ferry balance counts each body's fraction actually aboard, including the reach
wagon. A 65 t side-to-side difference uses the full four-degree ramp envelope.
Loading all freight onto one deck overloads it; the locomotive is prohibited
from crossing the shore boundary. The boat and ramp display the current load.

Flood closures use surveyed track intervals and simulation time. Any part of
a vehicle entering a closed interval ends the run. The forecast is visible
from departure; no collection order or revisits are prohibited by script.
The crew boards after a stopped, five-second platform dwell.

`DeadSlow.watch("long-grade-12", 16)` plays the complete finale. Its passenger
is signalled at departure, then waits at Lantern until the freight clears the
points and sets the tunnel route. Regenerate it with
`node tools/record-rail-run.cjs 12`, then `node tools/sync-replays.cjs`.

## Validation

`node --test tests/rail.test.cjs` covers the full control-only route in 5-01,
the complete run-around/delivery sequence in 5-02, and both descent routes in
5-03, including the cooling loop. The feedback driver issues ordinary power,
brake, reverser, coupling and switch commands without moving vehicles directly.
It is a conservative smoke driver, not an authored pace or optimal solution.

`tests/rail-sprint.test.cjs` completes assignments 4–8 using ordinary controls,
including both interception routes, the emergency catch, and the complete
pocket/shuttle/return-loop sequence. `tests/rail-final.test.cjs` completes all
four final missions. `tests/version-six.test.cjs` probes helper command guards,
balanced and unbalanced coupler loading, partial ferry boarding, flood
boundaries, volcanic gravity and record migration.

Separate tests cover tail occupancy, air-brake delay, temperature-dependent
stopping estimates, detached handbrakes, shared records and pause/retry rules.
Those geometry/objective fixtures are explicitly distinguished from routes.
Circuit tests check the railway route and the field-to-rail-to-space transitions.

The actual renderer was inspected through native canvas, and all source scripts
were exercised against a DOM to check controls and stage loading. Full browser
layout and touch QA remain for CI/review: browser access to the cloud preview
was blocked in this Work chat. No localhost permission request was repeated.

`npm run build` produces the complete offline game in `dist/index.html`, with
every source module and the stylesheet inlined. Generated builds are not committed.

## Integration boundaries

The lower helm offers +/− steps for power, train brake and loco brake (rear
assistance on helper missions); values remain in the sidebar. Clicking a slider
keeps game shortcuts active, while arrow keys still adjust the focused slider.
The next-step hint identifies required brakes and overshot stopping positions.
Hard buffer contact keeps coupling locked until the cuts separate beyond 3 m;
the hint explains this recovery even before the first tutorial stop is complete.

The shared shell selects `rail-adapter.js` through the simulation registry. Rail
runs contain their own vehicles and a presentation focus, with no marine ship or
job placeholders. Commands from keys, buttons, the console and recordings share
`rail-commands.js` and the engine's eligibility checks. `rail-presentation.js`
keeps warning persistence out of the physics state and supplies one HUD snapshot.

`npm run check` now checks command/adapter types and all twelve typed level
definitions, then validates track, vehicle, zone and task references. Transition
invariants and save compatibility are covered in `tests/architecture.test.cjs`.

Rail guidance lives in a collapsible map panel, with optional operational and wagon details. Speed and stopping distance remain beside the controls. The grade profile shares the footer with compact telegraphs on wide screens and stacks above them on phones. Changing notices never shift the sidebar controls.

Mission splits live in the railway sidebar and preserve first-completion timestamps. Invalidated live objectives are struck through until restored. The side-view profile uses a read-only selected-route window with real longitudinal distances, exaggerated elevation, vehicle lengths, detached wagons and junction markers. It does not reserve track or alter routing.
