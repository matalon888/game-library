import { createGame, takeTurn } from "./game.js";
import { buildActions, renderEnd, renderGame } from "./ui.js";

const screens = {
  landing: document.querySelector("#landing-screen"),
  game: document.querySelector("#game-screen"),
  end: document.querySelector("#end-screen")
};

let state = createGame();
let actionLocked = false;

function showScreen(name) {
  Object.entries(screens).forEach(([key, element]) => {
    element.hidden = key !== name;
  });
  window.scrollTo({ top: 0, behavior: "instant" });
}

function startGame() {
  state = createGame();
  actionLocked = false;
  showScreen("game");
  renderGame(state);
  document.querySelector(".action-button")?.focus({ preventScroll: true });
}

function chooseAction(actionId) {
  if (actionLocked || state.gameOver) return;
  const result = takeTurn(state, actionId);
  if (!result) return;
  actionLocked = true;
  renderGame(state);

  window.setTimeout(() => {
    actionLocked = false;
    if (state.gameOver) {
      renderEnd(state);
      showScreen("end");
      document.querySelector("#play-again-button").focus({ preventScroll: true });
    }
  }, 360);
}

buildActions(document.querySelector("#action-list"), chooseAction);
renderGame(state);

document.querySelector("#start-button").addEventListener("click", startGame);
document.querySelector("#play-again-button").addEventListener("click", startGame);
document.querySelector("#restart-button").addEventListener("click", startGame);
