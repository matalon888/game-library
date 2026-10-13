# Boplicity

Boplicity is a no-build, single-page bebop improvisation trainer. It gives the player a rhythm section and chord progression, listens to a single-note MIDI solo, scores the bebop vocabulary in real time, and turns the take into a readable solo review.

Use **Play** for an open 16-bar session, **Learn** for guided lessons, or **Demo Mode** to experience the complete flow without a MIDI keyboard.

## Quick start

Serve the repository locally, then open `http://localhost:8000` in desktop Chrome.

```sh
python3 -m http.server 8000
```

Web MIDI requires a secure context; Chrome treats `localhost` as secure. Connect and power on the controller before loading the page, then allow MIDI access if Chrome prompts. No keyboard is required for Demo Mode, and the computer-keyboard fallback works with the keys listed below.

## How this project was built

- **Saul Sanchez** owns the product direction, musical judgment, corpus interpretation, play testing, and final decisions.
- **OpenAI Codex with GPT-5.6 Sol** was the primary implementation and debugging environment for the application, notation renderer, audio engine, calibration workflow, and tests.
- **Claude** assisted with prompt and specification drafting and served as an independent review pass.

The important engineering decisions were to keep the project deployable as a static site, separate arcade scoring from the corpus-relative musicianship grade, keep display quantization separate from the player's measured timing, provide deterministic Demo Mode data, and fall back to synthesized piano when remote samples are unavailable.

## Modes and controls

- **PLAY** starts an open 16-bar ii–V–I session in any of the 12 keys.
- **LEARN** teaches guide tones, chord tones, and triad arpeggios before a graded 12-bar synthesis across C, F, and G. Lesson progress is stored locally in the browser.
- **DEMO MODE** runs a deterministic take through the same scoring and notation pipeline used by live input.
- **Escape** stops the current session and returns to the title.
- **Space** — Listen Back / stop (Results screen). **R** — retry from the count-in anywhere.
- **CALIBRATE** on the title screen — the latency wizard (see below).
- QWERTY row A–K plays C4–C5 (W/E/T/Y/U as sharps); MIDI preferred, full range 21–108.
- Hands-on navigation uses three note gestures while no grading clock is live: blocked D♭ major down to C major retries, blocked C major up to D♭ major advances, and F–A–C–E played sequentially starts Listen Back. Sustain pedal CC64 has no navigation behavior.
- `?dev=1` reveals **Export demo JSON** on the Results screen.

### Player XP

XP is cumulative and stored in `boplicity-progress`: Play awards the completed session grade, each completed lesson awards 20 XP, a passed Learn skill run awards 100 XP, and a cleared synthesis awards 150 XP. Advancing from level L costs `round(150 × 1.4^(L−1))`, with unused XP carrying into the next level.

## Latency: calibrate once, then trust the clock

Click **CALIBRATE**, play along with 12 clicks, save. The wizard measures your rig's real input-to-audio offset (median of taps, outliers rejected) and persists it; precedence is `?latency=<ms>` URL override > saved calibration > Chrome's hardware estimate. If a session's timing reads consistently off, the Results screen suggests recalibrating.

Notes from this rig's tuning: tap tests read ~25ms low (players snipe the click); a relaxed comping feel during calibration lands closer to truth. Monitor yourself acoustically from the piano — the laptop is the band, never your own monitor. The old "always use `?latency=160`" workaround is retired.

## Scoring (as shipped 2026-07-19)

- Every event value is corpus-tuned from transcribed solos of the masters — Parker, Bud Powell, Sonny Clark, Barry Harris, Hank Jones, Red Garland. The title screen's "HOW TO EARN" legend explains each device and why.
- **Category grades:** Harmony (guide/chord/color/sus), Melody (arps, enclosures, passing), Rhythm (upbeat entries, triplets) — each against its par slice (165/95/50 of 310 per bar).
- **Rhythm blends a corpus profile** (60% points, 40% profile): eighth-note flow (quarter-dominated lines score low; sprinkled quarters and phrase-end landings are free), triplet sprinkle (~1 per 4 bars), and upbeat entry rate (65% of phrases = full credit). Small samples skip the profile.
- **Overall = par-weighted average of the three category grades** (53/31/16%) — no single category can carry a 100.
- **Grade bands (8):** Legend 95+, Headliner 85, Bandleader 75, Gigging 65, Sideman 50, Comping 35, Jam Session 20, Woodshedding below.
- **Hard mode** (title-screen select): unresolved notes cost −100, grades ride an exponential curve (par ≈ 80; 100 requires ~15% past the masters), and any unresolved note caps the session at 95.
- Sub-85 categories show one targeted tip on the Results screen.

## Notation (Solo Review)

Display quantization is separate from performance truth: the chart snaps to musical intent while the export and time-feel layer retain the measured timing. The current renderer includes adaptive swing-eighth and per-beat sixteenth grids, interpretation and syncopation passes, flam absorption, eighth/quarter/sixteenth triplet handling, proportional measure spacing, direction-aware stems, ties across barlines and systems, chord-aware spelling in all 12 keys, and a listen-back cursor.

Green notes earn points, gray notes are passing or neutral, red notes are unresolved, and amber arrows show rushing or dragging without changing the score.

## Remaining queue

- Publish a hosted HTTPS build and link it here.
- Add an optional local-monitor toggle for MIDI players.
- Vendor critical audio/notation dependencies for a completely offline build.
- Expand Learn beyond the First Steps level and add motif-focused material.
- Add automated end-to-end coverage for live-session and lesson navigation.

## Testing

With the local server running, open `http://localhost:8000/theory.test.html`. The page runs the deterministic theory, scoring, transposition, timing, and grading suite and should report `81/81 passed`.

For an end-to-end smoke test:

1. Open `http://localhost:8000` and select **Demo Mode**.
2. Confirm the count-off reads `1, 2, 1, 2, 3, 4` and the session completes without input.
3. Confirm the Vocabulary Report, notation, and Listen Back controls appear.
4. Return to the title, choose **Learn**, and confirm the example notation and lesson audio load.
5. Add `?dev=1` to the main URL to expose diagnostic exports and layout audits.

## Development notes

### Beat-weighting rationale

Corpus analysis places chord tones on roughly 80% of strong-beat attacks and 67% of weak-beat attacks. All four downbeats are landing spots, but 1/3 outrank 2/4; the engine awards full weight on 1/3, half on 2/4.

### Departure-tone rationale

Diatonic 2/9, 4/11, 6/13 are the largest non-chord-tone category (~57–63% passing, 14% neighbors, 10% appoggiaturas, 10% escape). Protecting a step connection either side matches ~95% of observed language; isolated leap-in/leap-out notes remain unresolved. Departure tones stay score-neutral with a rate-limited hint.

### The 6th on major-7 chords

Protected color tone: +25 wherever it lands, never unresolved, either mode. F6 ≈ Fmaj7 — the 6 substitutes for the maj7 melodically. Not a chord tone: no guide-tone credit, no arp/enclosure participation.

### Session feel and demo export

Swing/Straight is captured at session start. Swing accepts offbeats from 50–72% of a beat. `?dev=1` exposes the JSON export — the diagnostic tool of record (its beat-fraction clusters found the latency bug and dialed the calibration).

### Corpus-derived par

The masters' measured per-bar device frequencies through this engine's WEIGHTS ≈ 310 base points/bar (Harmony 165, Melody 95, Rhythm 50). The greats define 100, not the developer. The bundled demo verifies at ~370–390/bar, zero unresolved, at 80/100/120 BPM — and grades 99 overall under weighted scoring (its two triplets score 50 on sprinkle; the demo is a solo, not the standard).

### Manual Solo Review checklist

1. Play four known notes in four known bars; verify pitch, spelling, color, placement.
2. One unresolved note renders red; a resolved chromatic renders gray.
3. Demo Mode passes through the same chart pipeline.
4. Staccato note on beat 1 + silence → quarter note, not 8th + rest.
5. Note on the "and of 2" + silence → 8th + rest, never a quarter.
6. Two-beat hold → half note.
7. Velocity-below-20 ghost → small parenthesized gray notehead, no score.
8. Hold into an incompatible chord → red asterisk + footnote.
9. F→E over C7 → `sus 4–` then `3` (or guide label).
10. 8ths in slots 1–3 after an opening 8th rest → slot 1 flagged, 2–3 beamed; beams start on downbeats, never cross mid-bar, never absorb rests/longer notes/triplets.
11. A beat of four even 16ths → one beamed group of four, double beam, none dropped.
12. And-of-4 note held over the barline → 8th tied to 8th (partial ties across line breaks).
13. 6th on a downbeat over Fmaj7 → "Color tone +25", no red.
14. Play deliberately ahead → amber → over those beats; behind → amber ←; in the pocket → no arrows; Demo shows none.
15. Calibrate, then play a take on a plain URL → exported beat fractions cluster near 0.0/0.62.

The review intentionally does not provide MusicXML, notation playback, editing, a grand staff, or dynamics.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
