const EVENTS = [
  {
    id: "viral-demo",
    title: "The demo went tiny-viral!",
    detail: "A 14-second clip brought a lunch rush. Users +14 · Hype +9 · Compute −3",
    lesson: "Viral growth is exciting, but traffic arrives before infrastructure has time to prepare.",
    weight: 6,
    apply(state) {
      state.users += 14;
      state.hype += 9;
      state.compute -= 3;
    }
  },
  {
    id: "gpu-bill",
    title: "GPU bill surprise",
    detail: "The dashboard said ‘estimated.’ Your wallet heard ‘definitely.’ Cash −$58",
    lesson: "Usage-based costs can grow faster than revenue unless unit economics are watched closely.",
    weight: 5,
    apply(state) {
      state.cash -= 58;
    }
  },
  {
    id: "hallucination",
    title: "The model confidently invented a condiment law.",
    detail: "The correction got more views than the launch. Trust −12 · Users −2",
    lesson: "Confident errors become trust failures when users rely on an AI product’s output.",
    weight: 4,
    apply(state) {
      state.trust -= 12;
      state.users -= 2;
    }
  },
  {
    id: "churn",
    title: "Quiet user churn",
    detail: "Some people left without filing a ticket. Users −10% · Hype −3",
    lesson: "Acquisition is visible; retention is what reveals whether the product keeps its promise.",
    weight: 4,
    apply(state) {
      state.users -= Math.max(1, Math.ceil(state.users * 0.1));
      state.hype -= 3;
    }
  },
  {
    id: "investor-hype",
    title: "An investor used the phrase ‘category-defining.’",
    detail: "Nobody knows the category. Cash +$120 · Hype +10 · Sanity −4",
    lesson: "Capital and attention can accelerate a company, but expectations rise with them.",
    weight: 3,
    eligible: (state) => state.hype >= 25,
    apply(state) {
      state.cash += 120;
      state.hype += 10;
      state.sanity -= 4;
    }
  },
  {
    id: "outage",
    title: "The app is serving 503 with extra relish.",
    detail: "A capacity crunch caused an outage. Compute −5 · Trust −8 · Users −3",
    lesson: "Reliability is part of product quality, especially when demand approaches capacity.",
    weight: 5,
    eligible: (state) => state.compute < Math.max(12, state.users * 0.65),
    apply(state) {
      state.compute -= 5;
      state.trust -= 8;
      state.users -= 3;
    }
  },
  {
    id: "support-backlog",
    title: "Support inbox achieves sentience.",
    detail: "It is mostly asking for a password reset. Trust −5 · Sanity −6",
    lesson: "Growth creates operational work; unattended support becomes churn and reputational risk.",
    weight: 4,
    eligible: (state) => state.users >= 20,
    apply(state) {
      state.trust -= 5;
      state.sanity -= 6;
    }
  },
  {
    id: "great-review",
    title: "A user wrote an absurdly thoughtful review.",
    detail: "They understood the product better than your pitch deck. Users +6 · Hype +6 · Trust +4",
    lesson: "Delighted users create credible growth that paid marketing cannot fully reproduce.",
    weight: 5,
    eligible: (state) => state.quality >= 25,
    apply(state) {
      state.users += 6;
      state.hype += 6;
      state.trust += 4;
    }
  },
  {
    id: "safety-praise",
    title: "Your boring safety fix gets noticed.",
    detail: "A teacher recommends the app because it handles uncertainty well. Trust +9 · Users +4",
    lesson: "Responsible behavior can be a meaningful product advantage, not merely a compliance cost.",
    weight: 4,
    eligible: (state) => state.trust >= 72,
    apply(state) {
      state.trust += 9;
      state.users += 4;
    }
  },
  {
    id: "enterprise-customer",
    title: "A catering company wants the ‘team plan.’",
    detail: "You do not have a team plan. They pay anyway. Cash +$95 · Users +5",
    lesson: "Real customer demand can reveal pricing and packaging opportunities before a roadmap does.",
    weight: 3,
    eligible: (state) => state.quality >= 35 && state.trust >= 55,
    apply(state) {
      state.cash += 95;
      state.users += 5;
    }
  },
  {
    id: "prompt-injection",
    title: "Someone tried to jailbreak the menu.",
    detail: "The cart disclosed its secret sauce prompt. Trust −8 · Cash −$20",
    lesson: "Adversarial use is normal operating reality; defenses need testing before incidents happen.",
    weight: 3,
    apply(state) {
      state.trust -= 8;
      state.cash -= 20;
    }
  },
  {
    id: "cache-win",
    title: "Caching works. You feel briefly omnipotent.",
    detail: "Fewer duplicate requests lower the burn. Compute +6 · Cash +$18",
    lesson: "Efficiency improvements can increase capacity and margins without buying more infrastructure.",
    weight: 4,
    eligible: (state) => state.quality >= 20,
    apply(state) {
      state.compute += 6;
      state.cash += 18;
    }
  },
  {
    id: "quiet-shift",
    title: "A suspiciously normal day",
    detail: "The app stayed up. Nobody subtweeted the cart. Sanity +2",
    lesson: "Operational stability rarely goes viral, but it creates the space needed for good decisions.",
    weight: 5,
    apply(state) {
      state.sanity += 2;
    }
  }
];

function weightedPick(events, random) {
  const total = events.reduce((sum, event) => sum + event.weight, 0);
  let target = random() * total;
  for (const event of events) {
    target -= event.weight;
    if (target <= 0) return event;
  }
  return events.at(-1);
}

export function drawEvent(state, random = Math.random) {
  if (random() > 0.58) return null;
  const eligible = EVENTS.filter((event) => !event.eligible || event.eligible(state));
  const event = weightedPick(eligible, random);
  event.apply(state);
  return event;
}

export { EVENTS };
