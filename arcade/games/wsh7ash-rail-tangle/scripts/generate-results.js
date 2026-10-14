"use strict";

// Generates reproducible demo artifacts under results/.
const fs = require("node:fs");
const path = require("node:path");
const { createBoard, isSolved, followRoute, generateLevel, rotateTile } = require("../src/engine");
const { LEVELS, solutionRotations } = require("../src/levels");

const resultsDir = path.join(__dirname, "..", "results");
fs.mkdirSync(resultsDir, { recursive: true });

function solveLevel(level) {
  const board = createBoard(level);
  const undo = solutionRotations(level);
  for (const [k, steps] of Object.entries(undo)) {
    const [x, y] = k.split(",").map(Number);
    const tile = board.get(x, y);
    if (tile) rotateTile(tile, steps);
  }
  return board;
}

const lines = [];
lines.push("Rail Tangle - validation report");
lines.push("Generated: " + new Date().toISOString());
lines.push("");
lines.push("Hand-crafted levels (each printed state is scrambled, par = intended click count)");
lines.push("=================================================================================");
for (const level of LEVELS) {
  const board = solveLevel(level);
  lines.push(
    "Level " +
      level.index +
      " '" +
      level.name +
      "' routes=" +
      level.routes.length +
      " solvable=" +
      (isSolved(board) ? "yes" : "no") +
      " moves-par=" +
      (level.par ?? "n/a")
  );
}

lines.push("");
lines.push("Generated random levels (seeded, reproducible, scrambled on load)");
lines.push("=================================================================");
const generated = [];
for (let seed = 1; seed <= 8; seed++) {
  const level = generateLevel(seed, 7, 6, 2);
  const board = solveLevel(level);
  generated.push({ seed, routes: level.routes.length, solvable: isSolved(board) });
  lines.push("seed " + seed + " routes=" + level.routes.length + " solvable=" + (isSolved(board) ? "yes" : "no"));
}

fs.writeFileSync(path.join(resultsDir, "validation-report.txt"), lines.join("\n"));

const example = {
  seed: 1,
  width: 7,
  height: 6,
  level: generateLevel(1, 7, 6, 2),
};
fs.writeFileSync(path.join(resultsDir, "generated-level-seed-1.json"), JSON.stringify(example, null, 2));

const board1 = solveLevel(LEVELS[0]);
const trace = followRoute(board1, board1.routes[0]);
const solutionTranscript = [
  "Rail Tangle - solution walkthrough for Level 1 (First Track)",
  "",
  "Board (3x3). A train departs station S at (0,1) heading East toward station (2,1).",
  "The only railed cell (1,1) holds a straight-h track currently rotated vertical.",
  "",
  "Click (1,1) once (90 deg clockwise) to lay the track horizontally, then the",
  "engine verifies the route. Board solved in 1 move (par 1).",
  "",
  "Engine trace after solving (followRoute result):",
];
if (trace) {
  solutionTranscript.push(
    "  " + trace.map((p) => p.x + "," + p.y + " (" + p.dir + ")").join(" -> ")
  );
} else {
  solutionTranscript.push("  unexpected: trace empty");
}
fs.writeFileSync(path.join(resultsDir, "solution-walkthrough.txt"), solutionTranscript.join("\n"));

console.log("Wrote results/validation-report.txt, generated-level-seed-1.json, solution-walkthrough.txt");