# Development Log

This lightweight log records the decisions most useful for Build Week documentation.

## July 15, 2026 — Scope and rules

- Read and summarized the supplied Build Week rules before implementation.
- Selected Education as the likely submission category.
- Identified submission requirements: working build, repository, narrated public demo under three minutes, README disclosure, and `/feedback` Session ID.
- Human approved the implementation plan before code was written.

## July 15, 2026 — Architecture

- Chose a dependency-free static web application because the game is a text-heavy turn simulation rather than a sprite-action game.
- Kept simulation state outside the renderer.
- Centralized actions and events in data modules so balance changes remain explainable.
- Rejected paid APIs, external services, third-party assets, music, and unnecessary dependencies.

## July 15, 2026 — Design

- Established a screen-printed food-cart visual direction using diner red, mustard yellow, ink navy, and paper cream.
- Built all artwork from original CSS shapes and type—no downloaded assets.
- Used three surfaces: landing poster, playable daily workspace, and ending poster.
- Included visible startup lessons in every action/event result rather than adding a separate tutorial.

## July 17, 2026 — Launch-readiness pass

- Confirmed the core project work used GPT-5.6 Sol Medium in Codex.
- Verified the organizer clarification that GPT-5.6 may contribute during development and does not require a runtime API integration.
- Deliberately retained a static architecture despite receiving optional API credits, protecting judge access from secret-key, backend, quota, and network dependencies.
- Added forecast-versus-actual reporting so uncertainty and capacity decisions are visible after every shift.
- Added a personalized founder debrief covering service rate, dropped demand, utilization, shift margin, and three run-specific lessons.
- Added dependency-free simulation tests and completed desktop, mobile, failure-path, and responsive browser QA.
- Seeded simulations confirmed that careful capacity management can survive 30 days while a high-price, deluxe-model marketing strategy reliably collapses trust.

## Before submission

- Record the primary Codex `/feedback` Session ID.
- Add the live project URL and repository URL.
- Record any human-requested balance, copy, or visual changes made after the MVP.
- Confirm the final deployed build and video remain publicly available through judging.
