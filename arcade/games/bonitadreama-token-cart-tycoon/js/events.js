export const NEWS = [
  { id: "school-season", tag: "MARKET", title: "Study-app season starts early", text: "Students are shopping for tools. Expect more traffic—and more scrutiny of incorrect answers.", demand: 1.34, gpuPrice: 1, trustWeight: 1.25 },
  { id: "quiet-tuesday", tag: "MARKET", title: "A suspiciously quiet Tuesday", text: "Demand looks ordinary. A good day to build buffer or protect runway.", demand: 0.82, gpuPrice: 0.94, trustWeight: 1 },
  { id: "viral-thread", tag: "SOCIAL", title: "A tiny AI demo is all over the feed", text: "People are trying every new app they can find. Curiosity is high; patience is low.", demand: 1.48, gpuPrice: 1.08, trustWeight: 0.9 },
  { id: "gpu-shortage", tag: "SUPPLY", title: "GPU suppliers discover the word ‘scarcity’", text: "Compute upgrades cost more today. Existing capacity just became precious.", demand: 1.03, gpuPrice: 1.42, trustWeight: 1 },
  { id: "gpu-sale", tag: "SUPPLY", title: "Cloud warehouse clears old GPU slices", text: "Infrastructure is temporarily cheaper. Demand remains steady.", demand: 1, gpuPrice: 0.72, trustWeight: 1 },
  { id: "hallucination-news", tag: "TRUST", title: "Confident AI error makes national news", text: "Users are checking outputs twice. Trust will matter more than hype today.", demand: 0.9, gpuPrice: 1, trustWeight: 1.55 },
  { id: "creator-boost", tag: "SOCIAL", title: "A creator calls tiny AI tools ‘the next big cart’", text: "The category is getting attention. Prepared products could grow quickly.", demand: 1.28, gpuPrice: 1.05, trustWeight: 1 },
  { id: "privacy-week", tag: "TRUST", title: "Privacy questions trend across tech news", text: "Products with stronger safety practices will retain more cautious users.", demand: 0.94, gpuPrice: 1, trustWeight: 1.4 },
  { id: "exam-week", tag: "MARKET", title: "Exam week drives late-night demand", text: "Request volume may spike well above subscriber growth.", demand: 1.38, requestLoad: 1.35, gpuPrice: 1.06, trustWeight: 1.15 },
  { id: "competitor-free", tag: "RIVAL", title: "A competitor launches an aggressive free plan", text: "Users are unusually price-sensitive today. Quality can still justify a premium.", demand: 1.08, priceSensitivity: 1.45, gpuPrice: 1, trustWeight: 1 },
  { id: "latency-discourse", tag: "TECH", title: "Everyone suddenly has opinions about latency", text: "Fast responses will earn extra satisfaction; overloaded systems will feel worse.", demand: 1.08, latencyWeight: 1.5, gpuPrice: 1, trustWeight: 1 },
  { id: "local-grant", tag: "MONEY", title: "Local builder grant opens applications", text: "Fundraising odds improve today for products with visible traction.", demand: 1, fundingBoost: 0.2, gpuPrice: 1, trustWeight: 1 },
  { id: "weekend-lull", tag: "MARKET", title: "The internet allegedly goes outside", text: "Traffic should dip. Lower utilization is not necessarily a product failure.", demand: 0.7, gpuPrice: 0.9, trustWeight: 1 },
  { id: "good-review-wave", tag: "MARKET", title: "Users are sharing thoughtful tool reviews", text: "Quality and trust will convert attention better than raw hype.", demand: 1.16, qualityWeight: 1.35, gpuPrice: 1, trustWeight: 1.2 }
];

const INCIDENTS = [
  { id: "outage", when: (x) => x.serviceRate < 0.66, title: "Capacity outage", text: "The request queue spilled onto the sidewalk.", lesson: "Demand without capacity becomes downtime, churn, and lost revenue.", apply: (s, x) => { const hit = s.monitoring ? 3 : 7; s.trust -= hit; x.incidentDelta = `Trust −${hit}`; } },
  { id: "latency", when: (x) => x.utilization > 0.9 && x.serviceRate >= 0.66, title: "Latency complaints", text: "Users had enough time to make a sandwich while waiting.", lesson: "Systems need headroom; operating at the limit makes small spikes visible to users.", apply: (s, x) => { s.trust -= 3; x.incidentDelta = "Trust −3"; } },
  { id: "hallucination", when: (x, s) => x.modelRisk > (s.safety / 600), title: "Confident wrong answer", text: "A user found an answer that was polished, persuasive, and imaginary.", lesson: "Higher-capability output still needs safeguards, evaluation, and honest uncertainty.", apply: (s, x) => { s.trust -= 6; s.users -= 1; x.incidentDelta = "Trust −6 · Users −1"; } },
  { id: "fan-review", when: (x, s) => s.quality >= 42 && s.trust >= 62 && x.serviceRate > 0.9, title: "Great product review", text: "A customer explains your value proposition better than your homepage.", lesson: "Reliable product value turns satisfied users into credible distribution.", apply: (s, x) => { s.hype += 5; s.users += 3; x.incidentDelta = "Hype +5 · Users +3"; } },
  { id: "safety-praise", when: (x, s) => s.safety >= 48 && s.trust >= 72, title: "Safety work earns trust", text: "A teacher recommends the app because it handles uncertainty responsibly.", lesson: "Trust and safety investments can become a product advantage.", apply: (s, x) => { s.trust += 4; s.users += 2; x.incidentDelta = "Trust +4 · Users +2"; } },
  { id: "idle-capacity", when: (x) => x.utilization < 0.3 && x.capacity > 45, title: "Expensive empty servers", text: "The GPU is warm. The customer queue is not.", lesson: "Buying capacity too early traps cash in underused infrastructure.", apply: (s, x) => { s.cash -= 8; x.incidentDelta = "Cash −$8"; } },
  { id: "support-backlog", when: (x, s) => s.users > 45 && s.lastAction !== "support", title: "Support backlog", text: "The inbox now has weather patterns.", lesson: "User growth creates operational work even when the servers are healthy.", apply: (s, x) => { s.sanity -= 4; s.trust -= 2; x.incidentDelta = "Sanity −4 · Trust −2"; } },
  { id: "cache-win", when: (x, s) => s.cache >= 1 && x.requests > 20, title: "Cache hit parade", text: "Repeated questions cost less without making users wait.", lesson: "Efficiency work can improve margins and capacity at the same time.", apply: (s, x) => { s.cash += 7; x.incidentDelta = "Cash +$7"; } }
];

export function shuffledNews(random = Math.random) {
  const deck = [...NEWS];
  for (let i = deck.length - 1; i > 0; i -= 1) { const j = Math.floor(random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return deck;
}
export function nextNews(state, random = Math.random) { if (!state.newsDeck.length) state.newsDeck = shuffledNews(random); let news = state.newsDeck.shift(); if (news.id === state.lastNews && state.newsDeck.length) { state.newsDeck.push(news); news = state.newsDeck.shift(); } state.lastNews = news.id; return news; }
export function drawIncident(state, report, random = Math.random) {
  const eligible = INCIDENTS.filter((incident) => incident.id !== state.lastIncident && incident.when(report, state));
  if (!eligible.length || random() > 0.62) return null;
  const incident = eligible[Math.floor(random() * eligible.length)]; incident.apply(state, report); state.lastIncident = incident.id;
  return { id: incident.id, title: incident.title, text: incident.text, lesson: incident.lesson };
}
