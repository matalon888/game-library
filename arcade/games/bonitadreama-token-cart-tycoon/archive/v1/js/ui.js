import { ACTIONS } from "./actions.js";
import { getEnding, getScore, getStatus } from "./game.js";

const RESOURCE_MAX = { cash: 1000, users: 150, compute: 100, trust: 100, hype: 100, quality: 100, sanity: 100 };
const RESOURCE_IDS = ["cash", "users", "compute", "trust", "hype", "quality", "sanity"];

export function buildActions(container, onAction) {
  container.replaceChildren();
  ACTIONS.forEach((action, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "action-button";
    button.dataset.action = action.id;
    button.style.setProperty("--delay", `${index * 35}ms`);
    button.innerHTML = `
      <span class="action-icon" aria-hidden="true">${action.icon}</span>
      <span class="action-copy"><strong>${action.name}</strong><small>${action.hint}</small></span>
      <span class="action-arrow" aria-hidden="true">→</span>`;
    button.addEventListener("click", () => onAction(action.id));
    container.append(button);
  });
}

export function renderGame(state) {
  document.querySelector("#day-number").textContent = state.day;
  document.querySelector("#current-status").textContent = getStatus(state);

  RESOURCE_IDS.forEach((key) => {
    const value = state[key];
    document.querySelector(`#${key}-value`).textContent = key === "cash" ? `$${Math.max(0, value).toLocaleString()}` : Math.max(0, value).toLocaleString();
    const percentage = Math.max(0, Math.min(100, (value / RESOURCE_MAX[key]) * 100));
    const meter = document.querySelector(`#${key}-meter`);
    meter.style.width = `${percentage}%`;
    meter.parentElement.classList.toggle("danger", percentage <= 18);
  });

  document.querySelectorAll(".action-button").forEach((button) => {
    const action = ACTIONS.find((item) => item.id === button.dataset.action);
    const enabled = !state.gameOver && action.affordable(state);
    button.disabled = !enabled;
    button.title = enabled ? "" : "Not enough cash for this move";
  });

  const latest = state.history[0];
  if (latest) renderDailyCard(latest);
  renderLog(state.history);

  const revenueEstimate = Math.max(2, Math.round(state.users * (1.35 + state.quality / 100)));
  const overheadEstimate = 8 + Math.ceil(state.users * 0.12);
  const computeEstimate = Math.max(1, Math.ceil(state.users / 14));
  document.querySelector("#shift-preview").textContent = `Next shift estimate: +$${revenueEstimate} subscriptions · −$${overheadEstimate} overhead · −${computeEstimate} compute`;
}

function renderDailyCard(turn) {
  const card = document.querySelector("#daily-card");
  const content = turn.event ?? turn.actionResult;
  const kicker = turn.event ? `Day ${turn.day} · Chaos card` : `Day ${turn.day} · Shift complete`;
  card.classList.remove("event-pop");
  void card.offsetWidth;
  card.classList.add("event-pop");
  card.innerHTML = `
    <div class="card-kicker">${kicker}</div>
    <h2>${content.title}</h2>
    <p>${content.detail}</p>
    <div class="lesson"><span>THE LESSON</span> ${content.lesson}</div>
    ${turn.event ? `<div class="action-footnote">Your move: ${turn.actionResult.title}</div>` : ""}`;
}

function renderLog(history) {
  const log = document.querySelector("#event-log");
  log.replaceChildren();
  history.slice(0, 8).forEach((turn) => {
    const item = document.createElement("li");
    item.innerHTML = `
      <span>Day ${turn.day}</span>
      <strong>${turn.action}</strong>
      <small>+$${turn.operations.revenue} revenue · −$${turn.operations.overhead} overhead${turn.event ? ` · ${turn.event.title}` : " · No chaos card"}</small>`;
    log.append(item);
  });
  if (!history.length) {
    const item = document.createElement("li");
    item.className = "empty-log";
    item.textContent = "Your questionable business decisions will appear here.";
    log.append(item);
  }
}

export function renderEnd(state) {
  const ending = getEnding(state);
  document.querySelector("#end-kicker").textContent = ending.kicker;
  document.querySelector("#ranking-title").textContent = ending.title;
  document.querySelector("#end-summary").textContent = ending.summary;
  document.querySelector("#final-score").textContent = getScore(state).toLocaleString();
  document.querySelector("#end-lesson").textContent = ending.lesson;
  document.querySelector("#final-stats").innerHTML = [
    ["Days", state.turns],
    ["Cash", `$${Math.max(0, state.cash)}`],
    ["Users", Math.max(0, state.users)],
    ["Trust", Math.max(0, state.trust)],
    ["Quality", Math.max(0, state.quality)],
    ["Sanity", Math.max(0, state.sanity)]
  ].map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("");
}
