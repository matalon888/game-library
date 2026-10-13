# Flight feedback: implementation and checks

`space-audio.js` is an asset-free Web Audio module. `audio.js` chooses a palette
on departure and owns the shared mute gain, transient lifetime and marine engine.
`game.js` passes the actual `firingJets` and `beamForce` to the flight drive. It
never infers thrust from velocity, engine orders alone, or the presence of fuel.

The continuous drive uses rounded custom periodic waves, a slow detuning
oscillator and deterministic filtered noise. Main, reaction-control and beam
levels are independently controlled. Gain/frequency targets are smoothed and
unchanged targets are not rescheduled. A stopped or inhibited drive has zero
steady-state output; a brief release avoids clicks.

Radar and mission cues use sine carriers with modest frequency modulation,
frequency glides and shaped gain envelopes. Delayed components are scheduled
on the audio clock, not JavaScript timers. Completed sources disconnect.
A cue of a given kind cannot overlap itself. Mute and stage changes stop all
pending components, including components whose start time is still in the future.
Marine cues retain their tone/frequency/timing; a voice budget prevents rapid
commands or accelerated replays from accumulating unlimited overlapping notes.

The radar scan is presentation state, reset on stage load. It is not part of a
control recording or an objective. Its origin stays where the transmission
occurred, and it fades on presentation time even when the console freezes IGT.
H and both radar buttons use the same cooldown. Scanning is allowed only during
an active flight. With audio disabled or unavailable the graphic still works.

## Tests

`tests/flight-copy.test.cjs` covers every space briefing and pause, personal-best,
non-PB and practice capture screens, a circuit ending, marine restoration and
radar's lack of side effects. Synthetic result setups are UI isolation, not
navigation/author-time proofs.

`tests/browser_flight_presentation.py` exercises the actual keyboard and button
routing, desktop/mobile layout, accessible labels, lost-focus and hidden-tab
pauses, logs/help, and switching back to sea. It is called by the normal browser
smoke suite; no special release build is needed.

`tests/browser_flight_audio.py` renders the production graph in
`OfflineAudioContext`: full drive, all cue types, repeated calls, all control
axes separately, coasting, stopping, mute and world changes. Combined peak is
required below 0.16 full scale at 44.1, 48 and 96 kHz, with no clipped or non-finite
samples. Quiet tails and immediately-cancelled radar are also checked. Existing
marine audio-mix tests remain active.

These tests measure digital output, not acoustic volume at physical speakers.
There is no assertion that this synthesizer reproduces a real spacecraft.
Navigation, fuel, level layouts, save formats and author recordings are unchanged.
