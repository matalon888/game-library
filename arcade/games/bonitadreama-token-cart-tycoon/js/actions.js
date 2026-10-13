export const FOUNDER_ACTIONS = [
  { id: "improve", icon: "↗", name: "Improve Product", hint: "$18 · better retention and demand", affordable: (s) => s.cash >= 18,
    apply(s) { s.cash -= 18; s.quality += 7; s.sanity -= 6; return { demandBonus: 0, churnShield: 1, computeDiscount: 0, note: "You shipped a feature users can actually find." }; } },
  { id: "market", icon: "✦", name: "Market the App", hint: "$22 · demand and hype spike", affordable: (s) => s.cash >= 22,
    apply(s) { s.cash -= 22; s.hype += 9; s.sanity -= 5; return { demandBonus: 0.28, churnShield: 0, computeDiscount: 0, note: "Your launch clip found the loud part of the internet." }; } },
  { id: "safety", icon: "✓", name: "Fix Trust / Safety", hint: "$16 · safer output and more trust", affordable: (s) => s.cash >= 16,
    apply(s) { s.cash -= 16; s.safety += 9; s.trust += 7; s.sanity -= 5; return { demandBonus: 0, churnShield: 2, computeDiscount: 0, note: "The model now knows when to say ‘I’m not sure.’" }; } },
  { id: "support", icon: "☏", name: "Customer Support", hint: "less churn · founder energy down", affordable: () => true,
    apply(s) { s.trust += 5; s.sanity -= 8; s.hype -= 1; return { demandBonus: 0.04, churnShield: 5, computeDiscount: 0, note: "You answered every ticket and learned where the app hurts." }; } },
  { id: "funding", icon: "$", name: "Seek Funding", hint: "risky · runway if the pitch lands", affordable: () => true,
    apply(s, random) { const chance = Math.min(0.82, 0.22 + s.hype / 190 + s.quality / 260 + s.users / 600 + (s.news.fundingBoost ?? 0)); s.sanity -= 9; s.hype += 4; if (random() < chance) { s.cash += 190; return { demandBonus: 0, churnShield: 0, computeDiscount: 0, note: "An angel funded the mustard-powered roadmap. Cash +$190." }; } return { demandBonus: 0, churnShield: 0, computeDiscount: 0, note: "The investors requested more traction and fewer hot-dog metaphors." }; } },
  { id: "optimize", icon: "⚙", name: "Tune Infrastructure", hint: "$10 · requests use less compute today", affordable: (s) => s.cash >= 10,
    apply(s) { s.cash -= 10; s.sanity -= 5; return { demandBonus: 0, churnShield: 0, computeDiscount: 0.18, note: "You found one extremely unnecessary inference call." }; } },
  { id: "rest", icon: "☾", name: "Rest / Recover", hint: "sanity way up · hype cools", affordable: () => true,
    apply(s) { s.sanity += 16; s.hype -= 3; return { demandBonus: -0.03, churnShield: 0, computeDiscount: 0, note: "You closed the laptop before it became a pillow." }; } }
];

export const MODELS = {
  tiny: { id: "tiny", name: "Tiny & Quick", compute: 1, cost: 0.09, quality: -4, risk: 0.04, description: "Cheap and fast; basic answers." },
  balanced: { id: "balanced", name: "Cart Classic", compute: 1.7, cost: 0.18, quality: 3, risk: 0.07, description: "A practical middle ground." },
  deluxe: { id: "deluxe", name: "Deluxe Reasoner", compute: 2.8, cost: 0.34, quality: 10, risk: 0.11, description: "Better output; heavy and pricey." }
};

export const UPGRADE_INFO = {
  ram: { name: "RAM crate", description: "+4 GB · handles more requests at once" },
  gpu: { name: "GPU slice", description: "+12 daily compute capacity" },
  cache: { name: "Cache layer", description: "−12% compute per request" },
  monitoring: { name: "Monitoring", description: "reduces outage damage" }
};
