# Virtual game-development studio

The framework models a complete studio rather than a single coding agent. Its generated `.game-ai/agents.json` contains every studio role across leadership, production, design, art, animation, audio, engineering, QA, data, growth, LiveOps, publishing, legal, privacy, localization, accessibility, certification, community, and support.

## Active versus covered

- `active: true`: the project needs a distinct accountable specialist now.
- `active: false` plus `coveredBy`: a compatible active lead owns the responsibility until its activation trigger appears.

This provides full responsibility coverage without spending time and tokens on dozens of idle agents. A role can be logical rather than a separate process. For a large production, activate separate agents; for a prototype, consolidate compatible roles.

## Studio departments

1. Leadership/Product/Production
2. Game Design and UX
3. Art, Animation, and VFX
4. Audio and Voice
5. Engineering and Technical Operations
6. Quality Assurance
7. Data, Growth, Publishing, and LiveOps
8. Governance, Localization, Accessibility, and Certification

The authoritative detailed role catalog and conflict rules live in `.agents/skills/build-game-lean/references/agents-and-ownership.md`.

## Non-negotiable separation

- Development and independent QA remain separate.
- Clone/reskin implementation does not self-approve IP rights.
- Online/payment/data work receives privacy/security review.
- The project owner, not an agent, approves Brief, Prototype, Release Candidate, and Launch gates.

Run `node tools/gameflow.mjs team --project <path>` to view the active specialists and covered roles for a generated game.

