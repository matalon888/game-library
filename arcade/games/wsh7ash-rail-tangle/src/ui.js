"use strict";

const { connections, followRoute, rotateTile, isSolved, solvedRoutes, DIRS, PIECES } = require("./engine");

const CELL = 72;
const COLORS = {
  bg: "#0f1420",
  grid: "#1d2737",
  rail: "#cfd8e6",
  railActive: "#4ade80",
  railBad: "#f87171",
  stationA: "#38bdf8",
  stationB: "#fbbf24",
  deco: "#334155",
  text: "#e2e8f0",
  muted: "#7c8aa0",
};

class RailGame {
  constructor(canvas, level, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.opts = opts;
    this.loadLevel(level);
  }

  loadLevel(level) {
    const { createBoard } = require("./engine");
    this.board = createBoard(level);
    this.moves = 0;
    this.locked = false;
    this.highlight = new Set();
    this.train = null;
    this.setCanvasSize();
    this.draw();
    if (this.opts.onChange) this.opts.onChange(this);
  }

  setCanvasSize() {
    const w = this.board.width * CELL;
    const h = this.board.height * CELL;
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
  }

  cellFromEvent(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * this.board.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * this.board.height);
    return { x, y };
  }

  rotateCell(x, y, steps) {
    if (this.locked) return;
    const tile = this.board.get(x, y);
    if (!tile || tile.fixed) return;
    rotateTile(tile, steps);
    this.moves += 1;
    this.highlight.clear();
    const solved = solvedRoutes(this.board);
    for (const s of solved) {
      if (s.solved) {
        const route = this.board.routes.find((r) => r.id === s.id);
        if (route) {
          const path = followRoute(this.board, route);
          for (const p of path) this.highlight.add(p.x + "," + p.y);
        }
      }
    }
    this.draw();
    if (isSolved(this.board)) {
      this.win();
    }
    if (this.opts.onChange) this.opts.onChange(this);
  }

  async win() {
    this.locked = true;
    this.draw();
    const routes = this.board.routes;
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));
    for (const route of routes) {
      const path = followRoute(this.board, route);
      if (!path) continue;
      for (let i = 1; i < path.length; i++) {
        this.train = { x: path[i].x, y: path[i].y, dir: path[i].dir, color: COLORS.stationA };
        this.draw();
        await delay(90);
      }
    }
    this.train = null;
    this.draw();
    if (this.opts.onWin) this.opts.onWin(this);
  }

  restart() {
    if (this.opts.onRestart) this.opts.onRestart();
  }

  draw() {
    const ctx = this.ctx;
    const { width, height } = this.board;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, width * CELL, height * CELL);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 1;
        ctx.strokeRect(x * CELL, y * CELL, CELL, CELL);
        const tile = this.board.get(x, y);
        const isStation = this.board.routes.some(
          (r) => (r.start.x === x && r.start.y === y) || (r.goal.x === x && r.goal.y === y)
        );
        if (tile && tile.base) {
          this.drawTile(x, y, tile);
        }
        if (isStation) this.drawStation(x, y);
      }
    }
    if (this.train) this.drawTrain(this.train);
  }

  drawTile(x, y, tile) {
    const ctx = this.ctx;
    const cx = x * CELL + CELL / 2;
    const cy = y * CELL + CELL / 2;
    const conns = connections(tile);
    const active = this.highlight.has(x + "," + y);
    const color = active ? COLORS.railActive : COLORS.rail;
    ctx.strokeStyle = color;
    ctx.lineWidth = active ? 7 : 5;
    ctx.lineCap = "round";

    if (conns.length === 2) {
      const n1 = this.coord(cx, cy, conns[0]);
      const n2 = this.coord(cx, cy, conns[1]);
      ctx.beginPath();
      ctx.moveTo(n1.x, n1.y);
      ctx.lineTo(cx, cy);
      ctx.lineTo(n2.x, n2.y);
      ctx.stroke();
    }

    // Hub dot
    ctx.fillStyle = active ? COLORS.railActive : COLORS.text;
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  coord(cx, cy, dir) {
    const nd = DIRS[dir];
    return {
      x: cx + nd.dx * (CELL / 2 - 2),
      y: cy + nd.dy * (CELL / 2 - 2),
    };
  }

  drawStation(x, y) {
    const ctx = this.ctx;
    const cx = x * CELL + CELL / 2;
    const cy = y * CELL + CELL / 2;
    const r = CELL * 0.3;
    ctx.fillStyle = COLORS.deco;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.stationA;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = COLORS.stationA;
    ctx.font = "bold 20px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("S", cx, cy);
  }

  drawTrain(t) {
    const ctx = this.ctx;
    const cx = t.x * CELL + CELL / 2;
    const cy = t.y * CELL + CELL / 2;
    ctx.fillStyle = t.color || COLORS.stationB;
    ctx.strokeStyle = "#171f2e";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, CELL * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#0b1220";
    ctx.beginPath();
    ctx.arc(cx, cy, CELL * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
}

module.exports = { RailGame, CELL, COLORS };