# Changelog

## 6.0.0 — The Long Grade

- Complete World 5 with rear-helper handling, two-track ferry loading, timed flood evacuation and the winter-supply finale. The railway circuit has twelve stages; the Grand Tour now visits all six complete worlds in 72 stages.
- Make volcanic cones real hills, with smooth height and downhill gravity matching their visible aprons. Update the Prickly Business recording for the changed terrain. Fixes #34.
- Add front/rear power controls, sustained coupler-load warnings, a ferry balance/ramp display and visible flood forecasts. Keep the main locomotive as the controlled engine when a helper detaches.
- Add a console-only finale recording: `DeadSlow.watch("long-grade-12", 16)`.
- Schema 16 preserves earlier volcanic-course and 60-stage tour records in separate archives; existing railway records remain active.

## Unreleased

- Keep shortcut badges inside their buttons when controls wrap; remove the tiny berth BOW label and simplify player-facing help and status copy.

- Add a persistent setting for pausing when the window loses focus. Turning it off preserves the running attempt; hidden tabs and manual pauses still pause as practice.

- Retry immediately with Shift+R or a retry button; remove the pause-inducing confirmation.
- Replace angular volcanic footprints with shared winding contours, rounded lobes and matching collision boundaries. Keep eruption timing; archive records from the angular layouts.

## 5.1.0 — The Eight-World Atlas

- Confirm keyboard and touch restarts; keep completed circuit stages and cancel safely.
- Composite the complete hamster ghost once to prevent translucent limb stacking.
- Give all named ships and geographic settings fictional display names.
- Put Gerbozilla in World 4 and space in World 6; show twelve disabled coming-soon
  stages each for railway (5), the Pale Reach (7) and megastructures (8).
- Keep the playable Grand Tour at sixty missions; exclude placeholders and bonus.
- Add deterministic lava/steam windows to Downhill, Boulder Wood and No Petting.
- Preserve changed-layout and reordered-circuit records in schema-13 archives.
- Add official play/support links and targeted regression checks.

## 5.0.2 — Ready for the Grand Tour

- Replace Backwater's straight backing lane with an offset reverse dogleg around
  an old mole. Rework Island Exchange around perpendicular ramps and Long Island.
- Ship two clean fixed-input approach recordings; the library now contains 38.
- Add console-started practice tours/circuits, compact progress reports, an
  on-chart time selector, freeze/resume and keyboard rate controls.
- Preserve practice status across the entire circuit even after returning to 1×.
  Do not record later individual PBs or ranked departures from a practice circuit.
- Retain Codex's clean/overall archive presentation and add separate schema-12
  archives for the two earlier approaches and their affected circuits.
- Document all later-world route purposes and the targeted validation scope.
  No physics coefficients, audio, dependencies or unrelated layouts change.

## 5.0.1 — Broadside Pickup & Teardrop Mere

- Start The Granite Needle's barge north-facing, broadside to the passage. Add
  approach guidance, adjusted pace targets and a clean 373.575-second recording.
- Move Teardrop Mere southwest into low, open ground on the Whiskerdoom rescue
  map. The existing clean 456.491667-second escort recording remains unchanged.
- Archive the two superseded stage layouts and the affected World 3, World 5
  and 60-stage circuit records separately; keep all previous archives intact.
- Preserve Codex's rolling-circuit Next button fix, physics and audio. Add only
  targeted geometry, migration and replay checks for these two assignments.

## 5.0.0 — The Complete Field Atlas

- Promote Gerbozilla’s Rampage to a twelve-course championship and expand the
  Grand Tour to sixty stages. The Century Ship is still a separate bonus.
- Fill out the field maps with named woods, tarns, ponds, broken mountain spurs
  and asymmetric ridgelines. Seedhaven and The Long Way Home are unchanged.
- Add a meandering, chart-spanning Bristle Brook to Strictly No Petting. River
  rendering and traction use the same bank polygon; both crossings need speed.
- Strengthen Needlesworth in A Hedge Against Disaster. He closes the distance
  before winding up. The fast clean reference makes three timed shield blocks.
- Publish refreshed input-only routes for the ten revised field maps. Preserve
  all audio, wet-gravity behavior and Codex’s retaliation readout correction.
- Schema 10 archives the old 48-stage Grand Tour and changed preview field maps,
  including their ghosts and splits, without replacing earlier terrain archives.
- Add focused release/circuit/migration/terrain checks and browser coverage.

## 5.0.0-preview.5 — Needlesworth & the Journey Home

- Add three courses, taking World 5 to twelve standalone assignments: evade
  invulnerable Sir Needlesworth, shield his pursuit, and escort Lady home.
- Preserve impact impulses while blocking all damage to the hedgehog. Optional
  predators are hazards, not defeat requirements or fake health-bar bosses.
- Start the finale with Lady free; route beacons release interceptors and launch
  finite long-range salvos targeting both hamsters. Player shielding is personal.
- Add hedgehog artwork, release markers, target labels, focused regressions and
  three clean fixed-input recordings. Existing course physics defaults, terrain,
  audio, saved-record formats, and circuit routes remain unchanged.

## 5.0.0-preview.4 — Into the Wilds

- Expand World 5 to nine standalone courses. Replace the repetitive Reservoir
  Hairpin with an ordered, city-free woodland course; add a guinea-pig duel,
  fire-only walled keep and Lady Whiskerdoom's rescue/escort.
- Make forest patches add rolling resistance and black boulders block whole
  ball footprints. Shared outlines drive the map and simulation; shields do
  not allow phasing through rocks. Keep the other five existing layouts intact.
- Add massive pet bodies, announced locked-direction charges, recovery windows,
  mutual momentum/damage and harmless defeated pets. Shields protect the player.
- Add a pepper pickup and finite, aimable fire breath (H/touch). Flame passes
  over low walls, stops at boulders and cannot fire underwater. Armored city
  cores require fire rather than rams.
- Free Lady Whiskerdoom by breaking two locks, then lead her on a recorded path
  to the recovery meadow. She has her own momentum and integrity; both hamsters
  must arrive intact for a clean result.
- Layer a faint inharmonic resonance beneath dry wheel creaks. Preserve the
  accepted water graph and add a soft filtered fire hiss, with mute/headroom checks.
- Publish four input-only recordings; retain the five unchanged Rampage runs.
  There are 34 recordings and 58 assignments; the Grand Tour stays at 48.
- Schema 9 archives only the retired Hairpin's active record, ghost and splits.
  Keep prior archives, unchanged course records and all circuit records.
- Add focused mechanics, controls, rendering, audio and migration regressions.
  Preserve Codex fixes, dependencies and CI configuration.


## 5.0.0-preview.3 — Fortified Cities

- Replace phonetic dry wheel formants with discrete rubber-bearing creaks;
  retain the accepted water chirp graph and parameters.
- Paint treading hind paws behind the belly.
- Enclose the two later courses' towns in steep terrain rims and continuous
  water moats, with correct dry island holes and shared physics/contour geometry.
- Add fixed-reticle, long-range retaliation after demolition in course 3 and
  Fort Pillow; shields and evasion work, local gun destruction cannot cancel it.
- Add three courses: It All Goes Downhill, The Reservoir Hairpin, Fort Pillow.
  Six World 5 courses remain standalone; 31 recordings and 55 assignments total.
- Publish five new/revised clean recordings; leave Seedhaven's run untouched.
- Archive only schema-7 Banking/Lake District records in schema 8, retaining
  Seedhaven, earlier archives, all other missions and circuit records.
- Add focused physics, audio, migration and rendering regressions.


## 5.0.0-preview.2 — Little Feet, Big Detours

- Replace the continuous wheel whine with alternating, separately enveloped
  eeh/ooh strokes; speed affects cadence and gently affects volume. Water uses
  quieter, higher cartoon chirps; mute/pause/mode changes silence them.
- Animate two pink hind paws against the shell, with alternating planted and
  reaching legs. Running in water drives the futile paddling gait.
- Give hills blended, rotated shoulders and lakes smooth, irregular bays and
  headlands. Rendering and traction share a shoreline definition.
- Fix wet gravity: water grip scales player drive only, never terrain gravity.
- Restore the shared manifest after tow duty so Rampage counters remain visible.
- Add Banks for the Memories and No Grip, No Problem; generalize course controls,
  district counts and field sheets. Three courses remain outside all circuits.
- Publish three clean recorded runs. Schema 7 archives only the obsolete
  Seedhaven layout from schema 6; keep sea, space and circuit records intact.
- Focus verification on rolling physics, migration, new recordings, audio gaps,
  tow-to-Rampage UI transitions and responsive field sheets.

## 5.0.0-preview.1 — Gerbozilla’s first outing

- Add World 5’s orienteering-paper theme and one standalone rolling-ball course.
- Add downhill gravity, momentum, tractionless lake crossings, mutual ramming
  damage, telegraphed city fire and a temporary shield with recharge.
- Synchronize animated shell ribs and squeaky ee-oo bearings to rolling phase.
- Add a ball-specific multitouch pad, menus, field log, counters and one clean
  89.508333-second watchable reference. No further courses are stubbed in.
- Keep all four established worlds, the 48-stage Grand Tour, saved-record schema
  and Codex’s migration fix intact. The preview has independent stage records.
- Add focused mechanics/browser/audio tests and update catalog-size assertions.

## Unreleased — Moving Cover and Recurring Histories

- Offset the first spaceport and add two straight-line outbound asteroid flybys.
- Replace sprint-between-flare timing with continuous exposure behind migrating
  shields in Umbra and Perihelion Dispatch. Forecast approximate cradle-cover
  windows from real hull/shadow geometry.
- Rebuild Yesterday inside Janus Station: solid freight stacks, passing bays,
  two chronogates, marked insertion destinations, and two recurring actual histories.
- Put Erebus in the Century Ship’s direct route; provide weak lateral jets, a
  wider chart and local/overview tracking. Surface contact fails the mission.
  Preserve the >30-minute distance bound, including combined thrust magnitude.
- Replace affected input recordings; all five changed missions have clean runs.
- Archive incompatible stage/circuit records under schema 6; retain all unchanged
  records and the existing audio, radar, collision fixes and CI configuration.
- Do not treat deliberately frozen console inspection as a missed-watch pause.

## Earlier spaceflight feedback and fixes

### Flight feedback

- Give spacecraft a separate ion-drive/jet/beam sound palette, driven by actual
  firing rather than the marine engine; coasting, disabled jets and frozen flight
  are silent. Add electronic order, mission, impact and capture cues.
- Replace the space horn with a cosmetic radar pulse and frequency-swept ping.
  H, the flight-deck button and the touch chart button share a cooldown. Muting
  audio leaves the scan visible and never changes fuel, clocks or records.
- Use flight terminology in capture, pause, unattended, logbook, help and circuit
  screens, browser titles, live instruments and accessible labels. Restore marine
  controls and the original horn on return to sea.
- Schedule cue sequences on the audio clock; fade and cancel stale sounds on mute
  and stage changes. Bound rapid-command/replay polyphony and test mixed levels.
- Show `stage` in console catalogs, retaining the legacy numeric `harbor` property
  as a non-enumerable compatibility alias.

### Space contact and campaign progress

- Pass actual velocity vectors to asteroid, target-vessel and docked-tender
  contacts. Gentle collisions no longer turn world coordinates into impact speed.
- Count only the twelve campaign sectors in Meridian progress. Show the Century
  Ship's bonus completion separately, keeping it selectable and outside circuits.
- Add collision-response and campaign/bonus regression tests. No level layouts,
  author recordings, record formats, dependencies or audio are changed.

## 4.0.0 — The Black Meridian

- Add twelve spacecraft missions and the independent Century Ship bonus: 49
  selectable stages, 48 in the Grand Tour. Every space mission has a clean,
  watchable fixed-control completion; 25 recordings are now published in all.
- Use separate vacuum dynamics: persistent velocity/spin, opposite burns,
  finite shared propellant, relative docking and analytic moving targets.
- Add asteroid landing, required refuelling, two-tender mothership assembly,
  recoil gunnery, moving-target interception, attractive/repulsive rescue,
  lethal sunlight, solar-only jets, an unpowered corridor and actual past-self
  collisions. Finish with a combined dispatch assignment.
- Enforce the Century Ship's 30+ minute duration through distance and maximum
  acceleration, not a completion timer; exclude it from every circuit.
- Add flight instruments, star charts, geometric shadows, jet plumes, lead
  markers, control-transfer visuals and responsive keyboard/touch labels.
- Preserve existing marine simulation and records. Schema 5 archives the
  36-stage Grand Tour separately from the longer route.
- Refresh README screenshots with current space and borderless island charts.
- Update requested Pages actions to v5 and Python Playwright pin to 1.62.0.

## 3.1.1 — A Quieter Horn, More Watchkeeping

- Lower the horn's final envelope by approximately 6 dB while preserving the
  beating reed chord, saturation, attack/release and engine volume.
- Test the actual full-power engine, horn, engine-order bell and impact cue
  together at 44.1, 48 and 96 kHz, with no stacked horn voices or clipped samples.
- Add nine clean, fixed-control recordings: basic docking, the dogleg,
  timed boom, lock, stern-first parking, tidal crossing, double booms,
  the heavy barge and the island ferry exchange. Twelve runs are now watchable.
- Include harbor names/worlds in the console run list. Discover additional
  fixture files automatically and validate their input-only format in tests.
- Keep all playback unranked and all existing physics, levels and records intact.

## 3.1.0 — Open Water

- Remove all archipelago perimeter coasts; open the west side of every Coast
  and Northwatch harbor, sharing coast geometry between rendering and physics.
- End the attempt when any part of the player or a casualty leaves the chart,
  with a local edge warning, explicit failure reason, stopped clock and retry.
- Start the ten later island assignments with real positioning legs: tugs away
  from their casualties and empty ferries in the fairway. Keep both tutorials.
- Replace the horn's two sine tones with four beating, harmonic-rich reeds,
  saturation and filters; prevent stacked blasts and fade safely on mute.
- Welcome console explorers to `DeadSlow.help()`: 0–32× fixed-step time,
  stepping, level jumps, helm/warp/repair tools and detached state inspection.
- Publish the three real input recordings for animated or immediate console
  verification; distinguish measured author times from authored medal targets.
- Keep assists and playback unranked; do not pollute PBs, ghosts or circuit times.
- Migrate to logbook schema 4, archiving changed departures and island circuits
  while retaining their old records, ghosts and splits in exports.
- Add navigation/console/audio regressions and the console guide.

## 3.0.0 — The Archipelago

- Twelve Nordic-inspired island-service stages; thirty-six stages across three worlds.
- Double-ended vehicle ferry and working tug, with distinct handling and silhouettes.
- Automatic ramp cycles, visible vehicles, partial transfers and mass-changing manifests.
- Independent disabled vessels, unilateral towlines, winches, overload and obstacle chafe.
- Recovery after a parted line; rescue berths, shore crews and separate final mooring.
- Towable-hull collision, grounding and gate safety; attached-tow coast prediction.
- Job splits, work counters, archipelago circuit records and a 36-stage Grand Tour.
- Record schema 3 imports earlier logbooks and archives incompatible circuit lengths.
- Player-facing stage descriptions describe the harbor, not development history.
- Repository documentation, zero-dependency server/build, control-only fixtures,
  Node/browser tests, CI and an opt-in Pages deployment workflow.
