# Contributing

Use Node.js 22 or newer. Run `npm ci --ignore-scripts` for the pinned TypeScript
checker, then `npm run build` and `npm run serve`. The game has no runtime
dependencies. Source modules are
plain JavaScript, wrapped so the same physics and job logic load in Node tests
and in a browser without transpilation.

Run `npm run check && npm run build && npm test` before submitting a change.
For UI, input or renderer changes, also run the browser checks described in
`docs/TESTING.md` and inspect portrait and landscape layouts. Python/Playwright
are test tools only, not runtime dependencies.

Preserve the game’s central trade-off: useful propulsion, appreciable inertia,
and time to anticipate a mistake. Do not add an instant brake, teleport or
hidden auto-docking to solve a difficult stage. Add shelter, turning room,
clearer instructions or a more suitable berth instead.

Keep simulation decisions independent of wall-clock rendering and randomness.
Do not duplicate game physics in tests: use `tests/headless.cjs`. A test that
positions a hull is an objective test, not evidence of a navigable control-only
route. Label that distinction. Add a regression test for fixed bugs.

Stage IDs are save-data identities. Do not silently reuse an ID for a materially
different course. Explicitly handle records when changing circuits or physics.
Do not remove record import/export or make optional audio mandatory.

Use descriptive functions, four-space JavaScript indentation, two-space
JSON/YAML/CSS/HTML indentation and LF line endings. There is no required
formatter or transpiler. Avoid large dependencies for functions that can remain
small and independently tested. Keep generated `dist/`, test reports and local
screenshots out of source commits; curated documentation images belong in
`docs/images/`.

A useful issue includes the stage ID, browser/device, input sequence, expected
result and actual behavior. Please review exported logbooks before attaching
them. Pull requests should explain handling, scoring and migration changes,
not just show screenshots.

Shared boundaries and railway level data use strict TypeScript checking of JS
with JSDoc. Add new boundary modules to `tsconfig.json`; expand coverage when
extracting legacy code. Keep the existing recordings and expected times unchanged
for refactors. Bump course/rules revisions on affected levels for intentional
handling or route changes; save-schema versions describe only data format changes.
See [Architecture](docs/ARCHITECTURE.md) for the adapter and command contracts.
