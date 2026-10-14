"use strict";

// Browser entry point for Rail Tangle.
const { RailGame, CELL } = require("./ui");
const { LEVELS } = require("./levels");
const { generateLevel } = require("./engine");

const canvas = document.getElementById("board");
const hudLevel = document.getElementById("hud-level");
const hudMoves = document.getElementById("hud-moves");
const hudPar = document.getElementById("hud-par");
const hudRoutes = document.getElementById("hud-routes");
const popup = document.getElementById("popup");
const popupTitle = document.getElementById("popup-title");
const popupBody = document.getElementById("popup-body");
const btnNext = document.getElementById("btn-next");
const btnRandom = document.getElementById("btn-random");
const btnRestart = document.getElementById("btn-restart");
const levelPicker = document.getElementById("level-picker");

let currentIndex = 0;
let game = null;

function refreshLevelPicker() {
  levelPicker.innerHTML = "";
  LEVELS.forEach((lvl, i) => {
    const btn = document.createElement("button");
    btn.className = "level-btn";
    btn.textContent = String(lvl.index).padStart(2, "0");
    btn.title = lvl.name;
    if (i === currentIndex) btn.classList.add("active");
    btn.addEventListener("click", () => loadLevel(i));
    levelPicker.appendChild(btn);
  });
}

function refreshHud() {
  const level = LEVELS[currentIndex];
  hudLevel.textContent = "Level " + level.index + " \u2014 " + level.name;
  hudMoves.textContent = "Moves: " + game.moves;
  hudPar.textContent = "Par: " + (level.par == null ? "\u2013" : level.par);
  const solved = game.board.routes.filter((r) => {
    const { followRoute } = require("./engine");
    return Boolean(followRoute(game.board, r));
  }).length;
  hudRoutes.textContent = "Routes: " + solved + "/" + game.board.routes.length;
}

function loadLevel(i) {
  currentIndex = i;
  game = new RailGame(canvas, LEVELS[i], {
    onChange: refreshHud,
    onWin: () => {
      popupTitle.textContent = "Level Complete!";
      popupBody.textContent =
        "All " + game.board.routes.length + " route(s) connected in " + game.moves + " moves (par " + (LEVELS[currentIndex].par ?? "\u2013") + ").";
      popup.classList.remove("hidden");
    },
  });
  refreshLevelPicker();
  popup.classList.add("hidden");
  refreshHud();
}

function playRandom() {
  const { createBoard } = require("./engine");
  const level = generateLevel(Math.floor(Math.random() * 1e9), 6, 5, Math.floor(Math.random() * 2) + 1);
  game = new RailGame(canvas, level, {
    onChange: refreshHud,
    onWin: () => {
      popupTitle.textContent = "Random Level Complete!";
      popupBody.textContent = "Generated board solved in " + game.moves + " moves.";
      popup.classList.remove("hidden");
    },
  });
  popup.classList.add("hidden");
  refreshHud();
}

canvas.addEventListener("mousedown", (e) => {
  if (e.button === 2) return;
  const cell = game.cellFromEvent(e);
  game.rotateCell(cell.x, cell.y, e.ctrlKey ? -1 : 1);
  e.preventDefault();
});

canvas.addEventListener("contextmenu", (e) => {
  const cell = game.cellFromEvent(e);
  game.rotateCell(cell.x, cell.y, -1);
  e.preventDefault();
});

btnRestart.addEventListener("click", () => loadLevel(currentIndex));
btnRandom.addEventListener("click", playRandom);
btnNext.addEventListener("click", () => {
  if (currentIndex + 1 < LEVELS.length) loadLevel(currentIndex + 1);
  else loadLevel(0);
});

loadLevel(0);

window.RailTangle = { loadLevel, playRandom, get game() { return game; } };