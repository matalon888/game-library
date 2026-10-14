"use strict";

const { pieceFor, DIRS } = require("./engine");

const DIR_ORDER = ["N", "E", "S", "W"];
const opposite = (d) => DIRS[d].opposite;

function dirBetween(a, b) {
  if (!b) return null;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 1 && dy === 0) return "E";
  if (dx === -1 && dy === 0) return "W";
  if (dx === 0 && dy === 1) return "S";
  if (dx === 0 && dy === -1) return "N";
  throw new Error("path step must move to an adjacent cell");
}

// Build a concrete level object from a declarative definition.
// Each route provides its ordered tile path; the builder computes the
// correct piece for every step, guaranteeing at least one solution exists.
function buildLevel(def) {
  const tiles = {};
  for (const route of def.routes) {
    if (route.path.length === 0) continue;
    let travel = route.startDir;
    for (let i = 0; i < route.path.length; i++) {
      const cell = route.path[i];
      const incoming = opposite(travel);
      const next = route.path[i + 1] || null;
      const outgoing = next ? dirBetween(cell, next) : dirBetween(cell, route.goal);
      const base = pieceFor(incoming, outgoing);
      const key = cell.x + "," + cell.y;
      if (outgoing === null) throw new Error("route goal must be adjacent to last tile");
      tiles[key] = {
        base,
        rotation: (def.scramble && def.scramble[key]) || 0,
        fixed: Boolean(def.fixed && def.fixed[key]),
      };
      travel = outgoing;
    }
  }
  for (const d of def.decoys || []) {
    const key = d.x + "," + d.y;
    if (!tiles[key]) {
      tiles[key] = { base: d.base, rotation: d.rotation || 0, fixed: Boolean(d.fixed) };
    }
  }
  return {
    name: def.name,
    index: def.index,
    width: def.width,
    height: def.height,
    tiles,
    routes: (def.routes || []).map((r, i) => ({ ...r, id: r.id || "route-" + (i + 1) })),
    par: def.par || null,
    scramble: def.scramble || {},
  };
}

// Rotation values to apply so every routable tile sits in its base
// orientation (undoes the designer's scramble).
function solutionRotations(level) {
  const out = {};
  const scramble = level.scramble || {};
  for (const key of Object.keys(scramble)) {
    out[key] = (4 - scramble[key]) % 4;
  }
  return out;
}

const LEVELS = [
  buildLevel({
    index: 1,
    name: "First Track",
    width: 3,
    height: 3,
    par: 1,
    routes: [
      { id: "route-a", start: { x: 0, y: 1 }, goal: { x: 2, y: 1 }, startDir: "E", path: [{ x: 1, y: 1 }] },
    ],
    scramble: { "1,1": 3 },
  }),

  buildLevel({
    index: 2,
    name: "Two Trains",
    width: 4,
    height: 3,
    par: 4,
    routes: [
      { id: "route-a", start: { x: 0, y: 0 }, goal: { x: 3, y: 0 }, startDir: "E", path: [{ x: 1, y: 0 }, { x: 2, y: 0 }] },
      { id: "route-b", start: { x: 3, y: 2 }, goal: { x: 0, y: 2 }, startDir: "W", path: [{ x: 2, y: 2 }, { x: 1, y: 2 }] },
    ],
    scramble: { "1,0": 3, "2,0": 3, "2,2": 3, "1,2": 3 },
    decoys: [{ x: 1, y: 1, base: 6, rotation: 1, fixed: true }],
  }),

  buildLevel({
    index: 3,
    name: "The Turn",
    width: 4,
    height: 3,
    par: 3,
    routes: [
      {
        id: "route-a",
        start: { x: 0, y: 0 },
        goal: { x: 3, y: 1 },
        startDir: "E",
        path: [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
      },
    ],
    scramble: { "1,0": 3, "1,1": 3, "2,1": 3 },
    decoys: [{ x: 2, y: 0, base: 2, rotation: 0, fixed: true }, { x: 3, y: 0, base: 1, rotation: 2, fixed: false }],
  }),

  buildLevel({
    index: 4,
    name: "Crossroads",
    width: 5,
    height: 4,
    par: 6,
    routes: [
      { id: "route-a", start: { x: 0, y: 1 }, goal: { x: 4, y: 1 }, startDir: "E", path: [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }] },
      { id: "route-b", start: { x: 0, y: 3 }, goal: { x: 4, y: 3 }, startDir: "E", path: [{ x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 }] },
    ],
    scramble: { "1,1": 3, "2,1": 3, "3,1": 3, "1,3": 3, "2,3": 3, "3,3": 3 },
    decoys: [
      { x: 2, y: 0, base: 2, rotation: 0, fixed: true },
      { x: 2, y: 2, base: 3, rotation: 2, fixed: false },
      { x: 3, y: 2, base: 1, rotation: 3, fixed: false },
    ],
  }),

  buildLevel({
    index: 5,
    name: "The Loop",
    width: 5,
    height: 5,
    par: 4,
    routes: [
      {
        id: "route-a",
        start: { x: 0, y: 2 },
        goal: { x: 4, y: 1 },
        startDir: "E",
        path: [{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 1 }, { x: 3, y: 1 }],
      },
    ],
    scramble: { "1,2": 3, "2,2": 3, "2,1": 3, "3,1": 3 },
    decoys: [
      { x: 1, y: 1, base: 4, rotation: 1, fixed: true },
      { x: 3, y: 2, base: 2, rotation: 1, fixed: false },
    ],
  }),

  buildLevel({
    index: 6,
    name: "Tangle",
    width: 6,
    height: 4,
    par: 7,
    routes: [
      {
        id: "route-a",
        start: { x: 0, y: 0 },
        goal: { x: 4, y: 2 },
        startDir: "E",
        path: [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 2 }],
      },
      { id: "route-b", start: { x: 2, y: 3 }, goal: { x: 5, y: 3 }, startDir: "E", path: [{ x: 3, y: 3 }, { x: 4, y: 3 }] },
    ],
    scramble: { "1,0": 3, "1,1": 3, "2,1": 3, "3,1": 3, "3,2": 3, "3,3": 3, "4,3": 3 },
    decoys: [
      { x: 2, y: 0, base: 1, rotation: 0, fixed: true },
      { x: 2, y: 2, base: 3, rotation: 2, fixed: false },
      { x: 4, y: 1, base: 2, rotation: 3, fixed: false },
      { x: 5, y: 0, base: 5, rotation: 2, fixed: true },
    ],
  }),
];

module.exports = { LEVELS, buildLevel, solutionRotations, dirBetween };