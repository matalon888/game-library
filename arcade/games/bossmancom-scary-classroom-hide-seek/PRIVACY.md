# Privacy & Child Safety

**HIDE — Classroom Horror** is designed as a **single-player, offline-capable browser game** for kids. It is **not** a social network, chat app, or multiplayer lobby.

## What this game does **not** do

| Risk | Status |
|------|--------|
| Chat / messaging | **None** — no chat UI, no usernames, no DMs |
| Multiplayer / matchmaking | **None** — pure single-player AI |
| Accounts / logins | **None** |
| Collecting real names, ages, school, location | **None** |
| Ads or third-party trackers | **None** in this codebase |
| Camera, microphone, GPS | **Blocked** |
| WebRTC / peer connections | **Blocked** |
| Cookies / local profiles | **Blocked** (no personal storage) |
| Phone-home analytics | **Blocked** (network APIs disabled in page) |

## What it *does* use

- Your device’s **graphics** (WebGL) and **speakers** (Web Audio) to run the game **in the browser**.
- Optional **pointer lock** / touch controls for gameplay only.
- **Self-hosted** Three.js engine files (no live CDN required after download).

Nothing about the player is sent to a game server, because **there is no game server**.

## Technical protections in this repo

1. **Content-Security-Policy** — only same-origin scripts/styles; no random third-party scripts.
2. **Permissions-Policy** — camera, mic, geo, payment, USB, etc. denied.
3. **Referrer-Policy** — `no-referrer` so other sites learn less if someone follows a link away.
4. **Frame guards** — refuses to run inside a foreign website’s iframe (anti-clickjacking / overlay traps).
5. **Runtime network lock** — `fetch`, XHR, WebSockets, beacons, WebRTC disabled in page JS.
6. **No durable storage** of player data.

## Hosting advice for parents / teachers

- Prefer a **clean static host** (GitHub Pages, Netlify, Cloudflare Pages, school intranet) with **no ad injectors**.
- Do **not** add third-party “engagement” or chat widgets.
- Do **not** put this page inside an unknown iframe portal.
- Keep the game **offline-friendly**: open via local server or static host you control.
- If you fork the project, review any new scripts before deploying to kids.

## If you need multiplayer later

Do **not** add open chat. If multiplayer is ever required for learning:

- Use **school-managed** accounts only  
- **No free-text chat** (presets / teacher-mediated only)  
- Age-appropriate platform policies and moderation  
- Data-minimization and parent consent as required by law (COPPA, etc.)

This repository intentionally has **zero** communication features so those risks do not exist today.

## Contact

This is an open static project. For safety concerns with a hosted copy, contact the person who deployed it (school/IT/parent), not a game backend — there isn’t one.
