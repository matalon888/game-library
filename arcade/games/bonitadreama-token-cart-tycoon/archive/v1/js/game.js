import { ACTIONS } from "./actions.js";
import { drawEvent } from "./events.js";

export const INITIAL_STATE = Object.freeze({
  day: 1,
  cash: 500,
  users: 5,
  compute: 20,
  trust: 60,
  hype: 10,
  quality: 10,
  sanity: 80,
  totalRevenue: 0,
  turns: 0,
  lastAction: null,
  lastEvent: null,
  gameOver: false,
  endReason: null
});

const BOUNDS = {
  cash: [-999, 9999],
  users: [0, 9999],
  compute: [-99, 150],
  trust: [-99, 100],
  hype: [0, 100],
  quality: [0, 100],
  sanity: [-99, 100]
};

export function createGame() {
  return { ...INITIAL_STATE, history: [] };
}

function clampState(state) {
  Object.entries(BOUNDS).forEach(([key, [min, max]]) => {
    state[key] = Math.round(Math.min(max, Math.max(min, state[key])));
  });
}

function resolveOperations(state) {
  const revenuePerUser = 1.35 + state.quality / 100;
  const revenue = Math.max(2, Math.round(state.users * revenuePerUser));
  const overhead = 8 + Math.ceil(state.users * 0.12);
  const computeBurn = Math.max(1, Math.ceil(state.users / 14));
  const organicPull = (state.quality + state.trust + state.hype) / 3;
  const organicUsers = organicPull >= 48 ? Math.max(1, Math.floor(organicPull / 28)) : 0;

  state.cash += revenue - overhead;
  state.totalRevenue += revenue;
  state.compute -= computeBurn;
  state.users += organicUsers;
  state.sanity -= state.users >= 75 ? 2 : 1;

  let churn = 0;
  if (state.quality < 18 || state.trust < 38) {
    churn = Math.max(1, Math.ceil(state.users * 0.08));
    state.users -= churn;
  }

  return { revenue, overhead, computeBurn, organicUsers, churn };
}

function checkEnd(state) {
  if (state.cash < 0) return "cash";
  if (state.trust <= 0) return "trust";
  if (state.compute <= 0) return "compute";
  if (state.sanity <= 0) return "sanity";
  if (state.day >= 30) return "survived";
  return null;
}

export function takeTurn(state, actionId, random = Math.random) {
  if (state.gameOver) return null;
  const action = ACTIONS.find((item) => item.id === actionId);
  if (!action || !action.affordable(state)) return null;

  const actionResult = action.apply(state, random);
  const operations = resolveOperations(state);
  const event = drawEvent(state, random);
  state.turns += 1;
  state.lastAction = actionId;
  state.lastEvent = event?.id ?? null;
  clampState(state);

  const endReason = checkEnd(state);
  state.history.unshift({
    day: state.day,
    action: action.name,
    actionResult,
    operations,
    event: event ? { id: event.id, title: event.title, detail: event.detail, lesson: event.lesson } : null
  });

  if (endReason) {
    state.gameOver = true;
    state.endReason = endReason;
  } else {
    state.day += 1;
  }

  return state.history[0];
}

export function getScore(state) {
  const survival = state.turns * 30;
  const company = state.users * 7 + state.cash * 0.35;
  const health = state.trust * 4 + state.quality * 5 + state.sanity * 2 + state.compute * 1.5;
  const balancePenalty = Math.abs(state.hype - state.quality) * 2;
  return Math.max(0, Math.round(survival + company + health - balancePenalty));
}

export function getEnding(state) {
  const score = getScore(state);
  if (state.endReason === "cash" && state.trust >= 62) {
    return {
      title: "Bankrupt but Beloved",
      kicker: "The wallet is empty. The inbox is full of thank-yous.",
      summary: "You built something people trusted, but the business model could not keep the grill lit.",
      lesson: "Mission and customer love need sustainable unit economics to survive."
    };
  }
  if (state.trust >= 90 && state.quality >= 45) {
    return {
      title: "Trust & Safety Hero",
      kicker: state.endReason === "survived" ? "Thirty responsible days later" : "The cart closed with its integrity intact",
      summary: "Your careful choices made reliability and user trust the strongest features on the menu.",
      lesson: "Trust can be a product advantage when it is built through repeated operational choices."
    };
  }
  if (state.hype >= 68 && state.quality < 40) {
    return {
      title: "Hype Bubble Casualty",
      kicker: "The launch thread was magnificent",
      summary: "Attention outran the product. The crowd arrived, found the grill unfinished, and moved on.",
      lesson: "Marketing amplifies whatever is already there—including unfinished product decisions."
    };
  }
  if ((state.compute >= 75 && state.compute > state.quality * 1.7) || state.endReason === "compute") {
    return {
      title: "GPU Goblin",
      kicker: state.endReason === "compute" ? "The last token has been served" : "So much compute. Such interesting priorities.",
      summary: "Infrastructure became the strategy. Somewhere beneath the GPU receipts, there may still be an app.",
      lesson: "Capacity matters, but infrastructure should follow validated product demand."
    };
  }
  if (state.endReason === "sanity") {
    return {
      title: "Burned-Out Visionary",
      kicker: "The founder has left the cart",
      summary: "The company kept asking for one more shift until there was no energy left to give.",
      lesson: "Founder capacity is a real operating constraint, not an infinitely renewable resource."
    };
  }
  if (state.endReason === "trust") {
    return {
      title: "Apology-Post Founder",
      kicker: "The notes app is open",
      summary: "Users stopped believing the promises. A product without trust has no durable growth loop.",
      lesson: "Trust is slow to earn, quick to spend, and expensive to rebuild."
    };
  }
  if (state.endReason === "survived" && state.users >= 115 && state.cash >= 650 && state.quality >= 55 && state.trust >= 60) {
    return {
      title: "Unicorn Founder",
      kicker: "Thirty days. One extremely valuable cart.",
      summary: "You balanced growth, reliability, product, and runway well enough to turn a tiny stand into a serious company.",
      lesson: "Durable growth comes from managing the whole system, not maximizing a single metric."
    };
  }
  if (state.endReason === "survived") {
    return {
      title: "Sustainable Startup",
      kicker: "You survived all 30 days",
      summary: "The cart is still open, users are still ordering, and tomorrow’s problems are at least tomorrow’s.",
      lesson: "Survival creates options. Balanced companies can keep learning long after hype fades."
    };
  }
  return {
    title: "Scrappy Cart Operator",
    kicker: `The experiment ended on day ${state.day}`,
    summary: "The first company did not make it, but every constraint left behind a useful lesson for the next one.",
    lesson: "Startups are systems of tradeoffs; failure in one resource can overwhelm strength everywhere else."
  };
}

export function getStatus(state) {
  if (state.sanity < 22) return "Founder held together by mustard and momentum";
  if (state.compute < Math.max(8, state.users * 0.5)) return "Traffic rising faster than the servers";
  if (state.trust < 35) return "One incident away from an apology post";
  if (state.hype > state.quality + 30) return "The story is running ahead of the product";
  if (state.cash < 100) return "Runway shorter than the lunch line";
  if (state.users >= 100) return "A real company disguised as a food cart";
  if (state.quality >= 60 && state.trust >= 70) return "Quietly excellent and earning loyalty";
  if (state.users >= 35) return "Growing, creaking, and mostly online";
  return "Tiny, scrappy, and technically online";
}
