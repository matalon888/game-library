import { FOUNDER_ACTIONS, MODELS } from "./actions.js";
import { drawIncident, nextNews, shuffledNews } from "./events.js";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const money = (value) => Math.round(value * 100) / 100;

export function createGame(random = Math.random) {
  const state = {
    day: 1, cash: 500, users: 5, trust: 60, hype: 10, quality: 10, sanity: 80, safety: 18,
    ram: 8, gpu: 20, cache: 0, monitoring: 0,
    price: 9, modelId: "balanced", burst: false,
    phase: "planning", selectedAction: null, lastAction: null, lastIncident: null,
    newsDeck: shuffledNews(random), news: null, history: [], totalRevenue: 0, totalProfit: 0,
    gameOver: false, endReason: null
  };
  state.news = nextNews(state, random);
  return state;
}

export function getUpgradeCost(state, type) {
  if (type === "ram") return 38 + Math.max(0, state.ram - 8) * 2;
  if (type === "gpu") return Math.round((48 + Math.max(0, state.gpu - 20) * 0.8) * (state.news.gpuPrice ?? 1));
  if (type === "cache") return 45 + state.cache * 34;
  if (type === "monitoring") return state.monitoring ? null : 50;
  return null;
}

export function buyUpgrade(state, type) {
  if (state.phase !== "planning") return false;
  const cost = getUpgradeCost(state, type);
  if (cost === null || state.cash < cost || (type === "cache" && state.cache >= 3)) return false;
  state.cash -= cost;
  if (type === "ram") state.ram += 4;
  if (type === "gpu") state.gpu += 12;
  if (type === "cache") state.cache += 1;
  if (type === "monitoring") state.monitoring = 1;
  return true;
}

function normalize(state) {
  ["cash", "users", "trust", "hype", "quality", "sanity", "safety"].forEach((key) => { state[key] = Math.round(state[key]); });
  state.users = Math.max(0, state.users);
  state.trust = clamp(state.trust, -20, 100);
  state.hype = clamp(state.hype, 0, 100);
  state.quality = clamp(state.quality, 0, 100);
  state.sanity = clamp(state.sanity, -20, 100);
  state.safety = clamp(state.safety, 0, 100);
  state.cash = money(state.cash);
}

export function forecast(state) {
  const news = state.news;
  const model = MODELS[state.modelId];
  const priceSensitivity = news.priceSensitivity ?? 1;
  const priceFit = clamp(1.18 - Math.max(0, state.price - 7) * 0.045 * priceSensitivity, 0.48, 1.2);
  const signal = (1 + state.hype / 28 + state.quality / 42 + state.trust / 65) * news.demand * priceFit;
  const estimatedNew = Math.max(0, Math.round(signal));
  const estimatedRequests = Math.max(1, Math.round((state.users + estimatedNew) * 1.8 * (news.requestLoad ?? 1)));
  const cacheDiscount = state.cache * 0.12;
  const gpuRequests = Math.floor(state.gpu / Math.max(0.45, model.compute * (1 - cacheDiscount)));
  const ramRequests = state.ram * 4;
  return { estimatedNew, estimatedRequests, capacity: Math.min(gpuRequests, ramRequests), gpuRequests, ramRequests };
}

export function runDay(state, random = Math.random) {
  if (state.phase !== "planning" || state.gameOver || !state.selectedAction) return null;
  const action = FOUNDER_ACTIONS.find((item) => item.id === state.selectedAction);
  if (!action || !action.affordable(state)) return null;

  const plannedForecast = forecast(state);
  state.lastAction = action.id;
  const focus = action.apply(state, random);
  const news = state.news;
  const model = MODELS[state.modelId];
  const priceFit = clamp(1.18 - Math.max(0, state.price - 7) * 0.045 * (news.priceSensitivity ?? 1), 0.48, 1.2);
  const productPull = 1 + (state.quality * (news.qualityWeight ?? 1)) / 42 + (state.trust * (news.trustWeight ?? 1)) / 65 + state.hype / 28;
  const acquisitionRaw = productPull * news.demand * priceFit * (1 + focus.demandBonus);
  const newUsers = Math.max(0, Math.round(acquisitionRaw * (0.78 + random() * 0.44)));
  const prospectiveUsers = state.users + newUsers;
  const requestLoad = news.requestLoad ?? 1;
  const requests = Math.max(1, Math.round(prospectiveUsers * (1.55 + random() * 0.5) * requestLoad));

  const cacheDiscount = state.cache * 0.12;
  const effectiveCompute = Math.max(0.42, model.compute * (1 - cacheDiscount) * (1 - focus.computeDiscount));
  const gpuBaseRequests = Math.floor(state.gpu / effectiveCompute);
  const ramCapacity = state.ram * 4;
  const baseCapacity = Math.min(gpuBaseRequests, ramCapacity);
  const burstCeiling = state.burst ? Math.min(ramCapacity, Math.floor(gpuBaseRequests * 1.55)) : baseCapacity;
  const served = Math.min(requests, burstCeiling);
  const burstRequests = Math.max(0, served - baseCapacity);
  const burstCost = burstRequests * effectiveCompute * 0.58;
  const usedCompute = served * effectiveCompute;
  const capacity = burstCeiling;
  const serviceRate = served / requests;
  const utilization = Math.min(1.5, usedCompute / state.gpu);
  const latency = Math.round((0.7 + Math.pow(utilization, 2) * 3.5) * (news.latencyWeight ?? 1) * 10) / 10;

  const infraCost = state.ram * 0.11 + state.gpu * 0.075 + (state.monitoring ? 2.4 : 0);
  const inferenceCost = served * model.cost * (1 - cacheDiscount * 0.65);
  const revenue = prospectiveUsers * (state.price / 7) * (0.62 + serviceRate * 0.38);
  const totalCost = infraCost + inferenceCost + burstCost;
  const profit = revenue - totalCost;

  const valueScore = state.quality + model.quality + state.trust * 0.35;
  let churn = serviceRate < 0.9 ? Math.ceil(prospectiveUsers * (1 - serviceRate) * 0.32) : 0;
  if (state.price > 12 && valueScore < 55) churn += Math.ceil(prospectiveUsers * 0.05);
  if (state.trust < 38) churn += Math.ceil(prospectiveUsers * 0.06);
  churn = Math.max(0, churn - focus.churnShield);

  state.users = prospectiveUsers - churn;
  state.cash += profit;
  state.totalRevenue += revenue;
  state.totalProfit += profit;
  state.sanity -= 1 + (state.users > 60 ? 2 : 0);
  if (serviceRate > 0.94 && latency < 3.2) state.trust += 1;
  if (serviceRate < 0.75) state.trust -= 3;
  if (model.quality > 0 && serviceRate > 0.85) state.quality += 1;

  const report = {
    day: state.day, news, actionId: action.id, actionName: action.name, actionNote: focus.note,
    model: model.name, price: state.price, newUsers, churn, requests, served,
    dropped: requests - served, capacity, gpuBaseRequests, ramCapacity,
    serviceRate, utilization, latency, revenue: money(revenue), infraCost: money(infraCost),
    inferenceCost: money(inferenceCost), burstCost: money(burstCost), totalCost: money(totalCost),
    profit: money(profit), modelRisk: model.risk * (1 - state.safety / 130), incident: null, incidentDelta: "",
    forecastRequests: plannedForecast.estimatedRequests, forecastCapacity: plannedForecast.capacity,
    forecastSignups: plannedForecast.estimatedNew
  };

  report.incident = drawIncident(state, report, random);
  normalize(state);
  state.history.unshift(report);
  state.phase = "report";

  if (state.cash < 0) state.endReason = "cash";
  else if (state.trust <= 0) state.endReason = "trust";
  else if (state.sanity <= 0) state.endReason = "sanity";
  else if (state.day >= 30) state.endReason = "survived";
  if (state.endReason) state.gameOver = true;
  return report;
}

export function advanceDay(state, random = Math.random) {
  if (state.phase !== "report" || state.gameOver) return false;
  state.day += 1; state.phase = "planning"; state.selectedAction = null; state.news = nextNews(state, random);
  return true;
}

export function getScore(state) {
  return Math.max(0, Math.round(state.day * 25 + state.users * 8 + state.cash * 0.4 + state.trust * 4 + state.quality * 5 + state.sanity * 2 + state.gpu * 2 + state.ram * 2.5));
}

export function getDebrief(state) {
  const reports = state.history;
  const totalRequests = reports.reduce((sum, report) => sum + report.requests, 0);
  const totalServed = reports.reduce((sum, report) => sum + report.served, 0);
  const totalDropped = reports.reduce((sum, report) => sum + report.dropped, 0);
  const serviceRate = totalRequests ? totalServed / totalRequests : 0;
  const averageUtilization = reports.length ? reports.reduce((sum, report) => sum + report.utilization, 0) / reports.length : 0;
  const operatingMargin = state.totalRevenue ? state.totalProfit / state.totalRevenue : 0;
  const insights = [];

  if (serviceRate < 0.82) insights.push({ title: "Capacity was the bottleneck", text: `${totalDropped} requests were dropped. Demand only becomes growth when RAM and compute can serve it.` });
  else insights.push({ title: "Reliability became distribution", text: `${Math.round(serviceRate * 100)}% of requests were served. Consistent delivery protected revenue and customer trust.` });

  if (state.totalProfit < 0) insights.push({ title: "Usage did not cover operations", text: "Revenue never caught daily infrastructure and inference costs. Price, model choice, and efficiency all shape unit economics." });
  else insights.push({ title: "The shifts produced margin", text: `${Math.round(operatingMargin * 100)}% operating margin left room for product work—but upgrade and founder-focus spending still came from runway.` });

  if (state.sanity < 35) insights.push({ title: "Founder capacity collapsed", text: "The company outgrew the person operating it. Rest and support systems are infrastructure too." });
  else if (state.trust < 48) insights.push({ title: "Trust became expensive debt", text: "Reliability and safeguards lagged behind growth. Lost trust increased churn and reduced the value of future hype." });
  else if (state.safety >= 55) insights.push({ title: "Safety became product value", text: "Responsible output and honest uncertainty strengthened retention instead of acting like a last-minute patch." });
  else if (averageUtilization < 0.42 && state.gpu >= 44) insights.push({ title: "The stack grew ahead of demand", text: "Low average utilization tied runway up in idle capacity. Forecasts should guide infrastructure timing." });
  else insights.push({ title: "The whole system stayed connected", text: "Product, trust, founder health, demand, and infrastructure moved together. No single metric could carry the company alone." });

  return { serviceRate, totalDropped, averageUtilization, operatingMargin, insights: insights.slice(0, 3) };
}

export function getEnding(state) {
  if (state.endReason === "cash" && state.trust >= 60) return { title: "Bankrupt but Beloved", summary: "Users trusted the cart, but the unit economics never learned to sit.", lesson: "Customer love needs sustainable margins and runway." };
  if (state.trust >= 90 && state.safety >= 65) return { title: "Trust & Safety Hero", summary: "Reliability became the strongest feature on your menu.", lesson: "Responsible operations can become durable product value." };
  if (state.hype >= 70 && state.quality < 42) return { title: "Hype Bubble Casualty", summary: "Attention arrived faster than product readiness.", lesson: "Marketing amplifies the product—including its unfinished parts." };
  if (state.gpu >= 80 && state.history[0]?.utilization < 0.45) return { title: "GPU Goblin", summary: "You built a magnificent compute pantry for a very modest lunch rush.", lesson: "Capacity should follow informed demand, not infrastructure enthusiasm." };
  if (state.endReason === "sanity") return { title: "Burned-Out Visionary", summary: "The servers stayed up longer than their founder did.", lesson: "Founder capacity is a real operational constraint." };
  if (state.endReason === "trust") return { title: "Apology-Post Founder", summary: "Users stopped believing the promises on the menu.", lesson: "Trust is slow to earn and extremely fast to spend." };
  if (state.endReason === "survived" && state.users >= 130 && state.cash >= 650 && state.quality >= 55) return { title: "Unicorn Founder", summary: "Demand, infrastructure, product, and runway grew together.", lesson: "Durable growth comes from managing the whole system." };
  if (state.endReason === "survived") return { title: "Sustainable Startup", summary: "The cart survived 30 days with customers, capacity, and options intact.", lesson: "Balanced systems stay alive long enough to keep learning." };
  return { title: "Scrappy Cart Operator", summary: "The experiment ended, but the operating lessons are coming with you.", lesson: "A startup is a connected system of tradeoffs." };
}

export function getStatus(state) {
  const f = forecast(state);
  if (state.sanity < 24) return "Founder held together by mustard and momentum";
  if (f.estimatedRequests > f.capacity * 1.25) return "Forecast says the queue may overwhelm the cart";
  if (state.trust < 35) return "One incident away from an apology post";
  if (state.cash < 90) return "Runway shorter than the lunch line";
  if (state.users >= 100) return "A real company disguised as a food cart";
  return "Tiny, strategic, and technically online";
}
