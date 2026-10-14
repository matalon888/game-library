# Usage

## Play

Open `index.html` in a modern browser. If you cloned the repository before a
build, run `npm run build` once so `dist/game.js` exists.

Serve the folder while developing:

```shell
npx serve .
```

## Controls

| Action | Input |
| --- | --- |
| Rotate tile clockwise | Left-click on the tile |
| Rotate tile counter-clockwise | Right-click, or Ctrl+left-click |
| Restart level | Restart button |
| Fresh random board | Random Board button |
| Jump to a level | Numbered buttons below the board |

## Win condition

Every station (blue `S`) must connect through a continuous chain of railed
tiles to its neighboring goal station. When all routes resolve, the trains
animate and the level-complete panel appears.

## Headless output (results)

```shell
node scripts/generate-results.js
```

Writes into `results/`:

- `validation-report.txt` — level-by-level solvability checks
- `solution-walkthrough.txt` — a step-by-step trace for Level 1
- `generated-level-seed-1.json` — an example procedurally generated level

## Adding a level

Append a definition to `LEVELS` in `src/levels.js`:

```js
buildLevel({
  index: 7,
  name: "Switchyard",
  width: 5, height: 4,
  par: 5,
  routes: [
    { id: "route-a", start: { x: 0, y: 0 }, goal: { x: 4, y: 2 },
      startDir: "E", path: [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 2 }] },
  ],
  scramble: { "1,0": 3, "1,1": 3, "2,1": 3, "3,1": 3, "3,2": 3 },
})
```

The builder derives pieces from the path, so a valid route always exists.
`scramble` sets each railed tile's starting rotation (use `3` for a one-click
fix). Run `npm test` and `node scripts/generate-results.js` to verify.