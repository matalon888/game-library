import { FOUNDER_ACTIONS, MODELS, UPGRADE_INFO } from "./actions.js";
import { forecast, getDebrief, getEnding, getScore, getStatus, getUpgradeCost } from "./game.js";

const RESOURCE_MAX = { cash: 1000, users: 160, compute: 100, trust: 100, hype: 100, quality: 100, sanity: 100 };

export function buildActions(container, onSelect) {
  container.replaceChildren();
  FOUNDER_ACTIONS.forEach((action, index) => {
    const button = document.createElement("button");
    button.type = "button"; button.className = "action-button"; button.dataset.action = action.id; button.style.setProperty("--delay", `${index * 25}ms`);
    button.innerHTML = `<span class="action-icon" aria-hidden="true">${action.icon}</span><span class="action-copy"><strong>${action.name}</strong><small>${action.hint}</small></span><span class="action-check" aria-hidden="true">✓</span>`;
    button.addEventListener("click", () => onSelect(action.id)); container.append(button);
  });
}

export function renderUpgrades(state, container, onBuy) {
  container.replaceChildren();
  Object.entries(UPGRADE_INFO).forEach(([type, info]) => {
    const cost = getUpgradeCost(state, type);
    const maxed = cost === null || (type === "cache" && state.cache >= 3);
    const button = document.createElement("button"); button.type = "button"; button.className = "upgrade-button";
    button.disabled = state.phase !== "planning" || maxed || state.cash < cost;
    button.innerHTML = `<span><strong>${info.name}</strong><small>${maxed ? "Installed / maxed" : info.description}</small></span><b>${maxed ? "✓" : `$${cost}`}</b>`;
    button.addEventListener("click", () => onBuy(type)); container.append(button);
  });
}

function setResource(key, value) {
  const display = key === "cash" ? `$${Math.max(0, Math.round(value)).toLocaleString()}` : Math.max(0, Math.round(value)).toLocaleString();
  document.querySelector(`#${key}-value`).textContent = display;
  const meter = document.querySelector(`#${key}-meter`); const percent = Math.max(0, Math.min(100, value / RESOURCE_MAX[key] * 100));
  meter.style.width = `${percent}%`; meter.parentElement.classList.toggle("danger", percent <= 18);
}

function signal(value, high, low) { return value >= high ? "High ↑" : value <= low ? "Low ↓" : "Steady →"; }

export function renderGame(state) {
  document.querySelector("#day-number").textContent = state.day;
  document.querySelector("#current-status").textContent = getStatus(state);
  setResource("cash", state.cash); setResource("users", state.users); setResource("compute", state.gpu); setResource("trust", state.trust);
  setResource("hype", state.hype); setResource("quality", state.quality); setResource("sanity", state.sanity);
  document.querySelector("#safety-value").textContent = state.safety;

  document.querySelector("#news-tag").textContent = state.news.tag; document.querySelector("#news-title").textContent = state.news.title; document.querySelector("#news-text").textContent = state.news.text;
  document.querySelector("#demand-signal").textContent = signal(state.news.demand, 1.18, 0.88); document.querySelector("#gpu-signal").textContent = signal(state.news.gpuPrice ?? 1, 1.15, 0.88);
  const f = forecast(state); const report = state.history[0];
  const reportPhase = state.phase === "report" && report;
  document.querySelector("#forecast-requests-label").textContent = reportPhase ? "Forecast → actual" : "Expected requests";
  document.querySelector("#forecast-capacity-label").textContent = reportPhase ? "Capacity → served" : "Safe capacity";
  document.querySelector("#forecast-signups-label").textContent = reportPhase ? "Expected → joined" : "Expected signups";
  document.querySelector("#forecast-requests").textContent = reportPhase ? `~${report.forecastRequests} → ${report.requests}` : `~${f.estimatedRequests}`;
  document.querySelector("#forecast-capacity").textContent = reportPhase ? `${report.forecastCapacity} → ${report.served}` : f.capacity;
  document.querySelector("#forecast-signups").textContent = reportPhase ? `~${report.forecastSignups} → ${report.newUsers}` : `~${f.estimatedNew}`;
  document.querySelector("#stack-summary").textContent = `${state.ram} GB RAM · ${state.gpu} compute · ${state.cache ? `${state.cache * 12}% cache` : "no cache"}`;

  const planning = state.phase === "planning";
  document.querySelector("#price-input").disabled = !planning; document.querySelector("#model-select").disabled = !planning; document.querySelector("#burst-input").disabled = !planning;
  document.querySelector("#price-input").value = state.price; document.querySelector("#price-output").textContent = `$${state.price}`;
  document.querySelector("#model-select").value = state.modelId; document.querySelector("#model-description").textContent = MODELS[state.modelId].description;
  document.querySelector("#burst-input").checked = state.burst;

  document.querySelectorAll(".action-button").forEach((button) => {
    const action = FOUNDER_ACTIONS.find((item) => item.id === button.dataset.action); const selected = state.selectedAction === action.id;
    button.classList.toggle("selected", selected); button.disabled = !planning || !action.affordable(state); button.setAttribute("aria-pressed", String(selected));
  });

  const openButton = document.querySelector("#open-app-button"); const nextButton = document.querySelector("#next-day-button");
  openButton.hidden = !planning; nextButton.hidden = planning;
  const selectedFocus = FOUNDER_ACTIONS.find((item) => item.id === state.selectedAction); const focusAffordable = selectedFocus ? selectedFocus.affordable(state) : false; openButton.disabled = !state.selectedAction || !focusAffordable; openButton.textContent = !state.selectedAction ? "Choose a founder focus" : focusAffordable ? "Open the app for today →" : "That focus is over budget";
  nextButton.innerHTML = state.gameOver ? "See founder result →" : "Read tomorrow’s news →";
  if (planning) renderPlanningCard();
}

function renderPlanningCard() {
  document.querySelector("#daily-card").innerHTML = `<div class="card-kicker">Morning plan</div><h2>Read the signals. Prepare the stack.</h2><p>Your settings persist. Change only what today’s market makes necessary, then choose one founder focus.</p><div class="lesson"><span>THE QUESTION</span> Can your product serve the demand you are about to create?</div>`;
}

export function renderReport(report) {
  const card = document.querySelector("#daily-card"); card.classList.remove("event-pop"); void card.offsetWidth; card.classList.add("event-pop");
  const rate = Math.round(report.serviceRate * 100); const incident = report.incident;
  card.innerHTML = `<div class="card-kicker">Day ${report.day} · Operations report</div><div class="report-head"><h2>${rate >= 90 ? "A clean shift at the cart." : rate >= 70 ? "The stack bent, but mostly held." : "Demand overwhelmed the stack."}</h2><strong class="profit ${report.profit < 0 ? "negative" : ""}">${report.profit >= 0 ? "+" : "−"}$${Math.abs(report.profit).toFixed(2)}</strong></div>
    <div class="report-grid"><div><span>Demand</span><strong>${report.requests}</strong></div><div><span>Served</span><strong>${report.served}</strong></div><div><span>Dropped</span><strong>${report.dropped}</strong></div><div><span>Latency</span><strong>${report.latency}s</strong></div><div><span>Revenue</span><strong>$${report.revenue.toFixed(2)}</strong></div><div><span>Costs</span><strong>$${report.totalCost.toFixed(2)}</strong></div></div>
    <p class="action-note"><strong>${report.actionName}:</strong> ${report.actionNote}</p>
    ${incident ? `<div class="incident-slip"><strong>${incident.title}</strong><span>${incident.text} ${report.incidentDelta}</span></div><div class="lesson"><span>THE LESSON</span> ${incident.lesson}</div>` : `<div class="lesson"><span>THE LESSON</span> ${rate < 85 ? "Capacity planning determines how much demand becomes revenue instead of churn." : "Healthy headroom turns market demand into reliable, profitable service."}</div>`}`;
  renderQueue(report);
}

function renderQueue(report) {
  const queue = document.querySelector("#request-queue"); queue.replaceChildren(); const total = Math.min(16, report.requests);
  for (let i = 0; i < total; i += 1) { const dot = document.createElement("span"); dot.className = i / total < report.serviceRate ? "served" : "dropped"; dot.style.setProperty("--i", i); queue.append(dot); }
}

export function renderLedger(history) {
  const ledger = document.querySelector("#event-log");
  if (!history.length) { ledger.innerHTML = "<p>Your first shift report will appear here.</p>"; return; }
  ledger.innerHTML = history.slice(0, 6).map((r) => `<article><span>DAY ${r.day}</span><strong>${Math.round(r.serviceRate * 100)}% served</strong><small>${r.requests} requests · ${r.newUsers} joined · ${r.churn} churned</small><b class="${r.profit < 0 ? "negative" : ""}">${r.profit >= 0 ? "+" : "−"}$${Math.abs(r.profit).toFixed(2)}</b></article>`).join("");
}

export function renderEnd(state) {
  const ending = getEnding(state); const debrief = getDebrief(state); document.querySelector("#end-kicker").textContent = state.endReason === "survived" ? "Thirty shifts later" : `The cart closed on day ${state.day}`;
  document.querySelector("#ranking-title").textContent = ending.title; document.querySelector("#end-summary").textContent = ending.summary; document.querySelector("#final-score").textContent = getScore(state).toLocaleString(); document.querySelector("#end-lesson").textContent = ending.lesson;
  document.querySelector("#final-stats").innerHTML = [["Days", state.day], ["Cash", `$${Math.max(0, state.cash)}`], ["Users", state.users], ["GPU", state.gpu], ["Trust", state.trust], ["Sanity", state.sanity]].map(([l, v]) => `<div><span>${l}</span><strong>${v}</strong></div>`).join("");
  document.querySelector("#debrief-metrics").innerHTML = [
    ["Requests served", `${Math.round(debrief.serviceRate * 100)}%`],
    ["Requests dropped", debrief.totalDropped.toLocaleString()],
    ["Avg. utilization", `${Math.round(debrief.averageUtilization * 100)}%`],
    ["Shift margin", `${Math.round(debrief.operatingMargin * 100)}%`]
  ].map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("");
  document.querySelector("#debrief-insights").innerHTML = debrief.insights.map((insight, index) => `<article><span>0${index + 1}</span><div><strong>${insight.title}</strong><p>${insight.text}</p></div></article>`).join("");
}
