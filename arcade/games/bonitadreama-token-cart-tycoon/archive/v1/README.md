# Token Cart Tycoon

**Token Cart Tycoon** is a cozy-chaotic educational browser game about surviving the first 30 days of an AI startup. You begin with a hot dog cart, one laptop, $500, five users, and a tiny app. Every day you make one founder decision while balancing cash, users, compute, trust, hype, product quality, and sanity.

The project was created for OpenAI Build Week 2026 in the **Education** category.

## Play

No installation or API key is required.

1. Download or clone this repository.
2. Open `index.html` in a modern browser.

For local development with Python installed:

```powershell
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## How it works

- Survive 30 days without allowing cash, compute, trust, or sanity to collapse.
- Choose one action each day: improve the product, buy compute, market, work on safety, support customers, seek funding, or rest.
- Receive subscription revenue and pay operating costs after each shift.
- Respond to conditional startup events, from viral demos to outages and hallucination controversies.
- Finish with a score, company summary, and a founder ranking based on the shape of the business—not merely one number.

Each action and event includes a short lesson connecting the mechanic to a real operating tradeoff. The game is intentionally simplified and is not financial or business advice.

## Technical design

The project deliberately uses only semantic HTML, CSS, and vanilla JavaScript modules:

- No paid APIs or external services
- No runtime dependencies or build step
- No external images, fonts, music, or copyrighted assets
- Responsive DOM interface for desktop and mobile
- Serializable simulation state kept separate from rendering
- Data-driven actions and events for easy balancing
- Reduced-motion and keyboard-focus support

Key modules:

- `js/game.js` owns state, daily operations, scoring, and end conditions.
- `js/actions.js` defines player choices and their effects.
- `js/events.js` defines conditional random events.
- `js/ui.js` renders state and never owns simulation rules.
- `js/app.js` connects screens and player input.

## How Codex and GPT-5.6 were used

Codex powered by GPT-5.6 was used during the Build Week development period as a collaborative implementation tool. It helped:

- Translate the initial concept into a deliberately small, dependency-free architecture.
- Separate the game simulation from the DOM renderer.
- Draft and implement the action economy, conditional event system, scoring, and founder rankings.
- Create the original CSS hot dog cart artwork and responsive visual system.
- Draft educational microcopy connecting each mechanic to an AI-startup concept.
- Run repeatable simulations, browser checks, and responsive-layout QA.
- Prepare setup instructions and submission documentation.

Codex accelerated the path from concept to a testable game by keeping gameplay logic, interface work, documentation, and verification in one development task.

## Key human decisions

The entrant supplied and retained final authority over:

- The Token Cart Tycoon concept and hot-dog-cart startup metaphor
- The Education category and learning objective
- The seven starting resources and action set
- The 30-day survival structure
- The instruction to avoid paid APIs, external services, third-party IP, and unnecessary dependencies
- The cozy, funny, accessible tone
- Scope approval before implementation

All balance values, event wording, visual choices, and submission materials should be reviewed by the entrant before submission.

## Build Week submission notes

- **Category:** Education
- **Suggested one-line description:** Survive 30 days running a tiny AI startup from a hot dog cart while learning how compute, trust, growth, product quality, runway, and founder capacity interact.
- **Demo target:** A narrated public YouTube video under three minutes.
- **Judging build:** Publish this static project at a stable free URL and keep it available through the judging period.
- **Repository:** Use a public repository with this license, or share a private repository with the judging addresses specified in `RULES.md`.
- **Codex evidence:** Add the `/feedback` Codex Session ID from the primary implementation task to `docs/submission-notes.md` before submitting.

See [docs/submission-notes.md](docs/submission-notes.md) for the final checklist and demo outline.

## License

Released under the [MIT License](LICENSE).
