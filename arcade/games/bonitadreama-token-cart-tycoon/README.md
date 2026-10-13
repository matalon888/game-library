# Token Cart Tycoon

**Token Cart Tycoon** is a cozy-chaotic educational browser strategy game about surviving the first 30 days of an AI startup. You begin with a hot dog cart, one laptop, $500, five subscribers, 8 GB of RAM, and 20 units of daily compute capacity.

The project was created for OpenAI Build Week 2026 in the **Education** category.

## Play online

Play the public release on [ChatGPT Sites](https://token-cart-tycoon.bonitadreama.chatgpt.site). The submission source is available in the [public GitHub repository](https://github.com/bonitadreama/token-cart-tycoon).

## Run locally

This is a dependency-free static web project. Because it uses JavaScript modules, serve the folder locally instead of double-clicking `index.html`:

```powershell
cd "C:\Users\bonit\Documents\Builders Week"
python -m http.server 4173
```

Open `http://127.0.0.1:4173` in a modern browser. Stop the server with `Ctrl+C`.

Run the dependency-free simulation tests with:

```powershell
npm test
```

## The strategy loop

Each of the 30 days has five connected steps:

1. Read a market, supply, technical, or trust signal in **The Token Times**.
2. Adjust subscription price, model tier, and burst-compute policy.
3. Purchase RAM, GPU capacity, caching, or monitoring when the forecast justifies it.
4. Choose one founder focus: product, marketing, safety, support, funding, infrastructure optimization, or rest.
5. Open the app and reconcile demand, served requests, dropped requests, latency, revenue, costs, subscriber growth, churn, and incidents.

Settings persist across days. The player is encouraged to react only when signals or operating results justify it.

## What the systems teach

- Subscription pricing changes both demand and unit economics.
- Model tiers trade inference cost and throughput for output quality.
- RAM controls concurrent request capacity.
- GPU capacity controls daily inference throughput.
- Caching reduces compute per repeated request.
- Monitoring limits outage damage but adds operating cost.
- Burst compute handles temporary overflow at premium rates.
- Marketing creates demand that may exceed infrastructure.
- Trust, safety, product quality, support, and founder sanity compound over time.
- Compute is persistent capacity, not a health bar. Shortages become latency, dropped requests, churn, and trust loss.

News is dealt from a shuffled 14-card deck before reshuffling. Incidents are state-dependent and cannot repeat immediately.

## Technical design

- Semantic HTML, modern CSS, and vanilla JavaScript modules
- No paid APIs, external services, runtime dependencies, build step, downloaded assets, music, or third-party IP
- Original CSS artwork and interface
- Serializable simulation state separated from DOM rendering
- Data-driven news, incidents, model tiers, founder actions, and upgrades
- Responsive desktop/mobile layout and reduced-motion support

Key modules:

- `js/game.js`: state, forecasting, purchases, daily simulation, scoring, and endings
- `js/actions.js`: founder focuses, model tiers, and upgrade metadata
- `js/events.js`: shuffled market news and conditional incidents
- `js/ui.js`: rendering and accessible controls
- `js/app.js`: interaction and screen flow

The original button-driven prototype is preserved under `archive/v1` for comparison and recovery.

## How Codex and GPT-5.6 were used

Codex powered by **GPT-5.6 Sol Medium** was used throughout the Build Week development period to:

- Translate the human concept into a small dependency-free game architecture.
- Research the high-level educational loop of historical inventory-management simulations without copying protected expression.
- Redesign the prototype around forecasting, capacity planning, pricing, unit economics, and operational reports.
- Implement and test the demand, RAM, GPU, caching, burst-compute, revenue, cost, churn, trust, and incident systems.
- Create the original hot-dog-cart CSS artwork and responsive interface.
- Draft educational microcopy and submission documentation.
- Run repeatable simulations and browser QA.

The entrant received optional API credits but deliberately kept the submitted game free of runtime API calls. A static architecture gives judges an instant, reliable testing path without exposing a secret key, requiring a backend, or depending on quota and network availability. GPT-5.6's meaningful contribution is the design and implementation work documented above, not a decorative in-game call.

## Key human decisions

The entrant supplied and retained authority over the project concept, Education category, hot-dog-cart metaphor, 30-day structure, initial resources, AI-startup teaching goals, visual tone, IP/dependency restrictions, and the decision to deepen the first prototype with forecast-driven infrastructure strategy.

All balance values, wording, final deployment, and submission materials remain subject to entrant review.

## Submission checklist

Before submitting, add the public narrated YouTube demo and primary `/feedback` Codex Session ID to `docs/submission-notes.md`. Confirm the final requirements in `RULES.md`.

## License

Released under the [MIT License](LICENSE).
