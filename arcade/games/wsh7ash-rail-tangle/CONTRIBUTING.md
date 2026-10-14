# Contributing

Thanks for your interest in Rail Tangle.

## Getting started

1. Fork the repository and clone your fork.
2. `npm install`
3. Make your changes, keeping the engine free of DOM dependencies so it stays testable in Node.
4. Add or update tests in `test/` for any behavior change.
5. Run `npm test` and `npm run build`.
6. Open a pull request with a clear description.

## Guidelines

- Follow the existing CommonJS style and JSDoc-free plain comments approach used in `src/`.
- Keep new rules of the puzzle in `src/engine.js`; keep level data in `src/levels.js`; keep rendering in `src/ui.js`.
- Every hand-authored level must remain solvable; run `node scripts/generate-results.js` to check.
- Do not commit `node_modules/`.

## Definition of done

- `npm test` passes.
- `npm run build` succeeds.
- `node scripts/generate-results.js` still reports all levels solvable.