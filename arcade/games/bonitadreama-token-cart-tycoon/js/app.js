import { MODELS } from "./actions.js";
import { advanceDay, buyUpgrade, createGame, runDay } from "./game.js";
import { buildActions, renderEnd, renderGame, renderLedger, renderReport, renderUpgrades } from "./ui.js";

const screens = { landing: document.querySelector("#landing-screen"), game: document.querySelector("#game-screen"), end: document.querySelector("#end-screen") };
let state = createGame();

function showScreen(name) { Object.entries(screens).forEach(([key, element]) => { element.hidden = key !== name; }); window.scrollTo({ top: 0, behavior: "auto" }); }
function renderAll() { renderGame(state); renderUpgrades(state, document.querySelector("#upgrade-list"), handleUpgrade); renderLedger(state.history); }
function startGame() { state = createGame(); showScreen("game"); renderAll(); document.querySelector(".action-button")?.focus({ preventScroll: true }); }
function handleUpgrade(type) { if (buyUpgrade(state, type)) renderAll(); }

buildActions(document.querySelector("#action-list"), (id) => { if (state.phase !== "planning") return; state.selectedAction = id; renderAll(); });
document.querySelector("#price-input").addEventListener("input", (event) => { state.price = Number(event.target.value); renderAll(); });
document.querySelector("#model-select").addEventListener("change", (event) => { state.modelId = event.target.value; document.querySelector("#model-description").textContent = MODELS[state.modelId].description; renderAll(); });
document.querySelector("#burst-input").addEventListener("change", (event) => { state.burst = event.target.checked; renderAll(); });
document.querySelector("#open-app-button").addEventListener("click", () => { const report = runDay(state); if (!report) return; renderAll(); renderReport(report); document.querySelector("#next-day-button").focus({ preventScroll: true }); });
document.querySelector("#next-day-button").addEventListener("click", () => { if (state.gameOver) { renderEnd(state); showScreen("end"); return; } advanceDay(state); document.querySelector("#request-queue").replaceChildren(); renderAll(); document.querySelector(".action-button")?.focus({ preventScroll: true }); });
document.querySelector("#start-button").addEventListener("click", startGame); document.querySelector("#play-again-button").addEventListener("click", startGame); document.querySelector("#restart-button").addEventListener("click", startGame);
renderAll();
