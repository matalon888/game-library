# Decision log

Record date, decision, owner, reason, affected acceptance, and follow-up.

## 2026-08-12 — Prototype Gate approved

- **Owner:** Project Owner
- **Decision:** Approve the Moonbloom Endless playable prototype and proceed to production.
- **Reason:** The original theme, assets, typography, endless descent/spawn loop, match-and-drop feedback, desktop/mobile controls, and loss/retry flow meet the approved prototype direction.
- **Affected acceptance:** ACC-001, ACC-002 and prototype-level ACC-003 accepted.
- **Follow-up:** Execute the approved 20–38 hour production slice: gameplay hardening/balance, presentation/audio polish, compatibility/performance QA, then prepare a release candidate.

## 2026-08-12 — Release Candidate proposed

- **Owner:** Production team; pending Project Owner approval.
- **Decision:** Propose Moonbloom Endless 1.0.0-rc.1 for Release Candidate Gate review.
- **Reason:** All six production tasks are complete; 8/8 tests and packaged browser smoke scenarios pass with no critical/high findings.
- **Affected acceptance:** ACC-001 through ACC-003 and the approved production slice.
- **Follow-up:** Owner plays the candidate and either approves Release Candidate or returns focused change notes. Launch remains locked.

## 2026-08-12 — Release Candidate Gate approved

- **Owner:** Project Owner.
- **Decision:** Approve Moonbloom Endless 1.0.0-rc.1 and advance to Launch.
- **Reason:** Packaged build, skill-earned powers, responsive presentation, local persistence, and QA evidence were accepted.
- **Affected acceptance:** Release Candidate Gate passed without an incomplete exception.
- **Follow-up:** Freeze and publish the approved artifact to an owner-selected host, smoke-test its production URL, and prepare monitoring/rollback readiness before requesting Launch Gate approval.

## 2026-08-12 — Post-RC aiming guide improvement

- **Owner:** Project Owner.
- **Decision:** Make the aiming indicator clearer and extend it to the actual target, including wall-bank trajectories.
- **Impact:** Small player-facing launch change; candidate version advances to 1.0.0-rc.2 and requires focused visual/regression review before publishing.
- **Follow-up:** Rebuild, smoke-test aiming/fire alignment on desktop and mobile, then replace the frozen launch artifact.

## 2026-08-12 — Post-RC next-ball swap

- **Owner:** Project Owner.
- **Decision:** Let the player swap the loaded and queued bubbles by tapping the next-ball control; add `R` as the keyboard equivalent.
- **Impact:** Small interaction change; candidate advances to 1.0.0-rc.3 and needs focused input/state regression before publishing.
- **Follow-up:** Verify tap/click, keyboard, swap-back, shot locking and mobile hit target, then refresh the release archive.

## 2026-08-12 — Aim landing accuracy and quieter swapping

- **Owner:** Project Owner.
- **Decision:** Remove the swap callout and make the guide preview the snapped hex cell where the projectile will actually attach.
- **Impact:** Small interaction/physics correction; candidate advances to 1.0.0-rc.4.
- **Follow-up:** Compare preview and actual attachment across straight, angled and bank shots, then rebuild the launch artifact.

## 2026-08-12 — Score-sensitive descent

- **Owner:** Project Owner.
- **Decision:** Increase canopy descent speed gradually as score rises, without making high-score play excessively fast.
- **Balance:** Time pressure grows from 4.2 to 7.6 px/s; score adds a logarithmic maximum of 2.2 px/s; combined speed is hard-capped at 9.8 px/s.
- **Impact:** Small balance change; candidate advances to 1.0.0-rc.5.
- **Follow-up:** Verify monotonic growth, hard cap, baseline pacing and normal gameplay regression before replacing the launch artifact.

## 2026-08-12 — Lyra character animation

- **Owner:** Project Owner.
- **Decision:** Animate Lyra's body, hands and launcher rather than presenting a static mascot.
- **Presentation:** Procedural breathing, body sway and aim lean at idle; a new original recoil pose, backward kick, compression, muzzle flash and recovery on fire.
- **Impact:** Small presentation change with one additional project-owned raster asset; candidate advances to 1.0.0-rc.6.
- **Follow-up:** Optimize the pose, verify idle/fire/recovery/reduced-motion behavior and refresh the launch artifact.

## 2026-08-12 — Faster shots with continuous descent

- **Owner:** Project Owner.
- **Decision:** Increase fired-orb speed and keep the canopy descending while a projectile is in flight.
- **Balance:** Projectile speed increases from 780 to 1080 px/s; descent still pauses during match resolution and the Frost power freeze.
- **Impact:** Small gameplay-feel change; candidate advances to 1.0.0-rc.7.
- **Follow-up:** Verify shot/preview alignment, continuous descent during flight, collision behavior and rebuild the published artifact.

## 2026-08-12 — Themed end-of-run experience and test guide

- **Owner:** Project Owner.
- **Decision:** Replace generic game-over language with a Moonbloom ending and document repeatable player-facing QA scenarios.
- **Presentation:** The end card now frames failure as dawn reaching the garden, with a lunar emblem, magical divider and a “Thắp lại khu vườn” retry action.
- **Impact:** Small presentation/documentation change; candidate advances to 1.0.0-rc.8.
- **Follow-up:** Verify normal/new-record copy, loss/retry flow, responsive layout and all README test commands before publishing.

## 2026-08-14 — Original procedural background music

- **Owner:** Project Owner.
- **Decision:** Add a calm Moonbloom background score generated at runtime with Web Audio instead of shipping a large external music file.
- **Audio direction:** A sparse 32-step loop uses soft D-minor-family pads and bell tones, mixed below gameplay SFX.
- **Lifecycle:** Music begins only after player interaction, fades on pause/tab hide/game over, resumes with play and follows the existing mute preference.
- **Deployment:** The entry module carries the RC version as a cache key so GitHub Pages clients load the new audio code immediately after deployment.
- **Impact:** Small audio/presentation change with no third-party music rights or download-size cost; candidate advances to 1.0.0-rc.9.
- **Follow-up:** Verify autoplay compliance, mute/pause/resume state, SFX audibility, console health and production deployment.
