# Delivery plan

Estimates are initial ranges for a small game and must be revised after each approval.

| Stage | Small stages | Default estimate | Gate |
| --- | --- | --- | --- |
| Intake | mode, engine/platform, constraints, reference/rights | 0.5-1.5 h | - |
| Planning and Concept | pitch, audience/theme, core loop, scope, risks | 1-4 h | Brief |
| Pre-production | GDD-lite, spike, prototype, asset/level plan | 0.5-3 d | Prototype |
| Production | playable slices, assets, levels, systems, integration | 2 d-8 wk | - |
| Testing and Pre-launch | regression, playtest, balance, performance, packaging, release prep | 0.5-5 d | Release Candidate |
| Launch | publish, smoke test, monitor, hotfix readiness | 2 h-3 d | Launch |
| LiveOps (optional) | patches, balance/content/community cadence | recurring | cadence review |

The current detailed goal and tasks live in `.game-ai/goal.json` and `.game-ai/tasks.json`.

## Revised post-prototype slice plan

Pending Prototype Gate approval, the recommended production scope is **20–38 hours**:

| Slice | Owner | Estimate | Depends on | Acceptance |
| --- | --- | --- | --- | --- |
| Gameplay hardening and balance | Gameplay Engineer | 8–16 h | Prototype approval | Spawn/descent curve, attachment edge cases, combo cadence, and two lightweight power-ups pass fixed scenarios |
| Presentation and audio polish | Art Director / UI Engineer / Sound Designer | 6–12 h | Gameplay contract | Final motion timings, sprite compression, responsive UI, and mixed SFX remain readable at 360 px |
| Compatibility and release candidate | QA / Build Engineer | 6–10 h | Integrated production slice | Chrome, Edge, Safari representative tests; sustained performance evidence; packaged static build and rollback notes |

Accounts, backend leaderboards, ads, IAP, campaign levels, and multiplayer remain out of scope.
