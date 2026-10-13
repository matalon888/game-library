export const ACTIONS = [
  {
    id: "improve",
    icon: "↗",
    name: "Improve Product",
    hint: "$45 · quality up · sanity down",
    affordable: (state) => state.cash >= 45,
    apply(state) {
      state.cash -= 45;
      state.quality += 9;
      state.sanity -= 6;
      state.compute -= 1;
      return {
        title: "You shipped the button users kept asking for.",
        detail: "Quality +9 · Sanity −6 · Compute −1",
        lesson: "Product work compounds, but every release consumes money, focus, and infrastructure."
      };
    }
  },
  {
    id: "compute",
    icon: "▦",
    name: "Buy Compute",
    hint: "$80 · compute way up",
    affordable: (state) => state.cash >= 80,
    apply(state) {
      state.cash -= 80;
      state.compute += 20;
      state.sanity -= 2;
      return {
        title: "More GPUs entered the group chat.",
        detail: "Compute +20 · Cash −$80 · Sanity −2",
        lesson: "Capacity prevents outages, but idle infrastructure is expensive inventory."
      };
    }
  },
  {
    id: "market",
    icon: "✦",
    name: "Market the App",
    hint: "$55 · hype and users up",
    affordable: (state) => state.cash >= 55,
    apply(state, random) {
      const users = 4 + Math.floor(random() * 6);
      state.cash -= 55;
      state.hype += 12;
      state.users += users;
      state.trust -= 1;
      state.sanity -= 4;
      return {
        title: `Your demo brought ${users} curious people to the cart.`,
        detail: `Users +${users} · Hype +12 · Cash −$55`,
        lesson: "Attention creates demand immediately; product readiness usually catches up later."
      };
    }
  },
  {
    id: "safety",
    icon: "✓",
    name: "Fix Trust / Safety",
    hint: "$35 · trust up · quality up",
    affordable: (state) => state.cash >= 35,
    apply(state) {
      state.cash -= 35;
      state.trust += 10;
      state.quality += 2;
      state.sanity -= 5;
      return {
        title: "The app now refuses the spicy failure mode.",
        detail: "Trust +10 · Quality +2 · Cash −$35",
        lesson: "Safety work is product work: fewer failures make the experience more dependable."
      };
    }
  },
  {
    id: "support",
    icon: "☏",
    name: "Do Customer Support",
    hint: "trust and loyalty up · sanity down",
    affordable: () => true,
    apply(state) {
      state.trust += 7;
      state.users += 1;
      state.sanity -= 8;
      state.hype -= 1;
      return {
        title: "You personally answered 37 variations of ‘is it down?’",
        detail: "Trust +7 · Users +1 · Sanity −8",
        lesson: "Support builds loyalty and reveals product gaps, but it does not scale for free."
      };
    }
  },
  {
    id: "funding",
    icon: "$",
    name: "Seek Funding",
    hint: "risky · chance of fresh cash",
    affordable: () => true,
    apply(state, random) {
      const chance = Math.min(0.78, 0.28 + state.hype / 180 + state.quality / 300);
      state.sanity -= 9;
      state.hype += 5;
      if (random() < chance) {
        state.cash += 240;
        return {
          title: "An angel investor liked the mustard-based moat.",
          detail: "Cash +$240 · Hype +5 · Sanity −9",
          lesson: "Funding buys runway, but fundraising consumes founder attention and rewards a convincing story."
        };
      }
      state.trust -= 2;
      return {
        title: "The investor said ‘circle back after traction.’ Classic.",
        detail: "Hype +5 · Trust −2 · Sanity −9",
        lesson: "Fundraising is uncertain. A stronger product and credible traction improve the odds."
      };
    }
  },
  {
    id: "rest",
    icon: "☾",
    name: "Rest / Recover",
    hint: "sanity way up · momentum cools",
    affordable: () => true,
    apply(state) {
      state.sanity += 17;
      state.hype -= 3;
      return {
        title: "You closed the laptop before it became a pillow.",
        detail: "Sanity +17 · Hype −3",
        lesson: "Recovery protects future decision quality, even when the market keeps moving."
      };
    }
  }
];
