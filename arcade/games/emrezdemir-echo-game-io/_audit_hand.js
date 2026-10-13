// Geçici tarama scripti — el-yapımı seviyeleri Generator.auditLevel ile doğrula.
const fs = require("fs");

function isDoorCell(c) {
  if (c < "A" || c > "Z") return false;
  return c !== "B" && c !== "G" && c !== "P" && c !== "Q" && c !== "X";
}
function isPlateCell(c) { return c >= "a" && c <= "z" && c !== "v"; }
function isPortalCell(c) { return c >= "1" && c <= "9"; }

function bfsReach(grid, sx, sy, opts) {
  opts = opts || {};
  const H = grid.length, W = grid[0].length;
  const seen = new Set();
  const q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift();
    const k = x + "," + y;
    if (seen.has(k)) continue;
    seen.add(k);
    if (!opts.portalsDisabled && isPortalCell(grid[y][x])) {
      const ch = grid[y][x];
      for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++)
        if ((xx !== x || yy !== y) && grid[yy][xx] === ch) q.push([xx, yy]);
    }
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const c = grid[ny][nx];
      if (c === "#") continue;
      if ("^v<>".includes(c)) continue;
      if (opts.doorsClosed && isDoorCell(c)) continue;
      q.push([nx, ny]);
    }
  }
  return seen;
}

function auditLevel(grid) {
  let px = -1, py = -1, gx = -1, gy = -1;
  const plates = new Map(), doors = new Map(), portals = new Map();
  for (let y = 0; y < grid.length; y++) {
    if (typeof grid[y] !== "string") return "row " + y + " not string";
    for (let x = 0; x < grid[y].length; x++) {
      const c = grid[y][x];
      if (c === "P") { px = x; py = y; }
      else if (c === "G") { gx = x; gy = y; }
      else if (isPlateCell(c)) { if (!plates.has(c)) plates.set(c, []); plates.get(c).push({x,y}); }
      else if (isDoorCell(c)) { if (!doors.has(c)) doors.set(c, []); doors.get(c).push({x,y}); }
      else if (isPortalCell(c)) { if (!portals.has(c)) portals.set(c, []); portals.get(c).push({x,y}); }
    }
  }
  if (px < 0) return "missing P";
  if (gx < 0) return "missing G";

  const widths = grid.map(r => r.length);
  if (new Set(widths).size !== 1) return "row width mismatch: " + widths.join(",");

  for (const [d] of doors) if (!plates.has(d.toLowerCase())) return "door " + d + " without plate";
  for (const [d, list] of portals) if (list.length !== 2) return "portal " + d + " has " + list.length;

  const reachOpen = bfsReach(grid, px, py, {});
  if (!reachOpen.has(gx + "," + gy)) return "G unreachable from P";
  for (const [letter, list] of plates) {
    let found = false;
    for (const pos of list) if (reachOpen.has(pos.x + "," + pos.y)) { found = true; break; }
    if (!found) return "plate " + letter + " unreachable";
  }
  if (doors.size > 0) {
    const reachClosed = bfsReach(grid, px, py, { doorsClosed: true });
    if (reachClosed.has(gx + "," + gy)) return "solo-passable (doors not gating)";
  }
  return null;
}

// levels.js'ten HAND_LEVELS'ı çek
global.I18n = { get: () => "tr" };
const lvlCode = fs.readFileSync("levels.js", "utf8");
const upTo = lvlCode.indexOf("const HAND_LEVELS = LEVELS.slice();");
const snippet = lvlCode.slice(0, upTo) + "\nglobal.__LEVELS = LEVELS;";
(0, eval)(snippet.replace("let LEVELS", "var LEVELS"));
const HAND = global.__LEVELS.slice();

console.log("Hand levels:", HAND.length);
let bad = 0;
HAND.forEach((lvl, i) => {
  const grid = lvl.grid;
  const res = auditLevel(grid);
  const name = (lvl.name && lvl.name.tr) || ("Lv" + (i+1));
  const tag = res ? "  BAD" : "  OK ";
  if (res) bad++;
  console.log(tag + " " + String(i+1).padStart(2) + ". " + name.padEnd(18) + " " + (res || ""));
  if (res) {
    console.log("       grid:");
    grid.forEach(r => console.log("       " + r));
  }
});
console.log("\nTotal broken: " + bad);
