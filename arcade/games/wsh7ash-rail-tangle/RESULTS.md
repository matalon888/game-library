# Results

## Environment

- OS: Windows 11 (PowerShell 7)
- Runtime: Node.js v24.13.0
- Package manager: npm 11.16.0
- Bundler: esbuild 0.24.2 (devDependency only)

## Validation performed

- install: PASS (`npm install`)
- build: PASS (`npm run build` → dist/game.js, 13.5 kB)
- unit tests: PASS (13/13, `node --test`; `npm test` script fixed from `node --test test/` to auto-discovery `node --test` after verification re-run on 2026-09-19 failed with `Cannot find module ...\test`)
- integration tests: N/A (static browser game)
- lint: N/A (no lint tool in stack; `npm run check` runs `node --check` on all src files)
- type check: N/A (plain JavaScript)
- demo run: PASS (headless; browser render cannot be verified in this terminal environment)
- name availability: PASS (checked via `gh repo view Wsh7Ash/rail-tangle`)

## Commands executed

```shell
npm install
npm approve-scripts esbuild
npm run build
node --test
node scripts/generate-results.js
```

## Observed result

`node --test` reports 13 passing tests. All six hand-crafted levels are
scrambled on load and solvable via their declared scramble solution; the
procedural generator produced solvable boards for seeds 1–25 (and seeds 1–8
in the artifact report). `dist/game.js` bundles to 13,836 bytes.

## Generated artifacts

- `results/validation-report.txt`
- `results/solution-walkthrough.txt`
- `results/generated-level-seed-1.json`
- `dist/game.js`

## Known limitations

- Browser rendering was not visually verified in this terminal-only session;
  engine behavior is covered by unit tests, and the `dist/` bundle is built
  from the same tested source.
- Larger boards (9x9+) were not tuned; generator targets ≤ 8x8.