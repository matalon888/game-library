export const BOARD = Object.freeze({
  width: 540,
  height: 960,
  cols: 9,
  radius: 23,
  xStep: 52,
  rowHeight: 45,
  left: 49,
  top: 92,
  dangerY: 742,
  shooterX: 270,
  shooterY: 830,
});

export const ORB_TYPES = ["flame", "tide", "starlight", "dream", "leaf", "frost"];
export const SHOT_SPEED = 1080;

export function cellKey(row, col) {
  return `${row}:${col}`;
}

export function cellPosition(row, col, fieldOffset = 0, topRow = 0) {
  return {
    x: BOARD.left + col * BOARD.xStep + (row % 2 ? BOARD.xStep / 2 : 0),
    y: BOARD.top + (row - topRow) * BOARD.rowHeight + fieldOffset,
  };
}

export function neighbors(row, col) {
  const diagonal = row % 2 ? [[-1, 0], [-1, 1], [1, 0], [1, 1]] : [[-1, -1], [-1, 0], [1, -1], [1, 0]];
  return [[0, -1], [0, 1], ...diagonal]
    .map(([dr, dc]) => ({ row: row + dr, col: col + dc }))
    .filter((cell) => cell.col >= 0 && cell.col < BOARD.cols);
}

export function findCluster(bubbles, start, sameType = true) {
  const map = new Map(bubbles.map((bubble) => [cellKey(bubble.row, bubble.col), bubble]));
  const target = map.get(cellKey(start.row, start.col));
  if (!target) return [];
  const found = [];
  const queue = [target];
  const visited = new Set();
  while (queue.length) {
    const bubble = queue.shift();
    const key = cellKey(bubble.row, bubble.col);
    if (visited.has(key)) continue;
    visited.add(key);
    if (sameType && bubble.type !== target.type) continue;
    found.push(bubble);
    for (const next of neighbors(bubble.row, bubble.col)) {
      const candidate = map.get(cellKey(next.row, next.col));
      if (candidate && !visited.has(cellKey(candidate.row, candidate.col))) queue.push(candidate);
    }
  }
  return found;
}

export function findDetached(bubbles, ceilingRow = null) {
  const map = new Map(bubbles.map((bubble) => [cellKey(bubble.row, bubble.col), bubble]));
  const connected = new Set();
  const topRow = ceilingRow ?? (bubbles.length ? Math.min(...bubbles.map((bubble) => bubble.row)) : 0);
  const queue = bubbles.filter((bubble) => bubble.row === topRow);
  while (queue.length) {
    const bubble = queue.shift();
    const key = cellKey(bubble.row, bubble.col);
    if (connected.has(key)) continue;
    connected.add(key);
    for (const next of neighbors(bubble.row, bubble.col)) {
      const candidate = map.get(cellKey(next.row, next.col));
      if (candidate && !connected.has(cellKey(candidate.row, candidate.col))) queue.push(candidate);
    }
  }
  return bubbles.filter((bubble) => !connected.has(cellKey(bubble.row, bubble.col)));
}

export function cellsWithinRadius(bubbles, start, radius = 1) {
  const map = new Map(bubbles.map((bubble) => [cellKey(bubble.row, bubble.col), bubble]));
  const found = [];
  const queue = [{ row: start.row, col: start.col, distance: 0 }];
  const visited = new Set();
  while (queue.length) {
    const cell = queue.shift();
    const key = cellKey(cell.row, cell.col);
    if (visited.has(key) || cell.distance > radius) continue;
    visited.add(key);
    const bubble = map.get(key);
    if (bubble) found.push(bubble);
    if (cell.distance < radius) {
      for (const next of neighbors(cell.row, cell.col)) {
        queue.push({ ...next, distance: cell.distance + 1 });
      }
    }
  }
  return found;
}

export function powerChargeFor(matchCount, detachedCount) {
  return Math.max(0, matchCount) + Math.max(0, detachedCount) * 2;
}

export function descentSpeedAt(seconds, score = 0) {
  const timeSpeed = Math.min(7.6, 4.2 + Math.max(0, seconds) * 0.02);
  const scoreBoost = Math.min(2.2, Math.log2(1 + Math.max(0, score) / 250) * 0.42);
  return Math.min(9.8, timeSpeed + scoreBoost);
}

export function shouldAdvanceDescent({ resolving, freezeTime }) {
  return !resolving && freezeTime <= 0;
}

export function gameOverCopy(isBest) {
  return isBest
    ? {
        kicker: "KHU VƯỜN BỪNG SÁNG!",
        note: "Một kỷ lục mới đã nở rộ dưới ánh trăng.",
      }
    : {
        kicker: "BÌNH MINH ĐÃ CHẠM VƯỜN",
        note: "Lyra sẽ trở lại khi vầng trăng tiếp theo mọc lên.",
      };
}

export function difficultyAt(seconds, score = 0) {
  return {
    activeColors: Math.min(6, 4 + Math.floor(seconds / 55)),
    descentSpeed: descentSpeedAt(seconds, score),
    phase: 1 + Math.floor(seconds / 35),
  };
}

export function scoreFor(matchCount, detachedCount, combo) {
  const multiplier = 1 + Math.min(4, Math.max(0, combo - 1)) * 0.25;
  return Math.round((matchCount * 20 + detachedCount * 45) * multiplier);
}

export function seededRandom(seed = 1) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function makeInitialField(random = Math.random, rows = 6, colors = 4) {
  const bubbles = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < BOARD.cols - (row % 2); col += 1) {
      bubbles.push({ row, col, type: ORB_TYPES[Math.floor(random() * colors)] });
    }
  }
  return bubbles;
}
