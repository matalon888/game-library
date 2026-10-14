# HIDE — Classroom Horror

A browser-based low-poly hide-and-seek horror game. Survive in a dim elementary classroom and a long locker hallway while a tall distorted seeker patrols, listens for noise, checks lockers, and hunts with a narrow field of view.

**Live setup:** open `index.html` via a local HTTP server (ES modules require one).

## Play

```bash
# Python
python -m http.server 8080

# Node
npx --yes serve -l 8080
```

Then open **http://localhost:8080**

## Controls

### Desktop
| Key | Action |
|-----|--------|
| WASD / Arrows | Move |
| Mouse | Look (pointer lock) |
| Shift | Sprint (loud) |
| **C** / Ctrl | **Sneak** (quiet) |
| Space | Crouch / duck under desks |
| E | Enter / exit locker or cabinet |

### Mobile
- **Left stick** — move  
- **Drag right side** — look  
- **E** — action (hide / exit)  
- **SNEAK / CROUCH / RUN** — hold  

## Gameplay

- **30 seconds** free hide time before the seeker appears  
- Survive **3 minutes** after hunting starts  
- Hide under desks, in lockers, or cabinets  
- Seeker has a **narrow FOV** and **randomly checks lockers**  
- Minimap (top-right) shows you, the seeker, and the layout  
- Noise meter — sprinting draws attention; sneak stays quiet  

## Child safety & privacy

This is **single-player only**. There is **no chat, no multiplayer, no accounts, and no tracking** in this codebase.

Protections included:

- Self-hosted Three.js (no live third-party CDN)
- Content-Security-Policy + Permissions-Policy
- Runtime block on `fetch` / WebSocket / WebRTC / beacons
- No cookies or personal local storage
- Frame-busting / anti-clickjacking
- Host header configs for Netlify (`_headers`), Vercel (`vercel.json`), Azure SWA

Read **[PRIVACY.md](./PRIVACY.md)** for parent/teacher details.

**Do not** add third-party chat widgets, ads, or analytics if kids will use the site.

## Stack

- **Three.js** r160 (vendored in `/vendor`) — rendering, lights, fog  
- **Web Audio API** — procedural SFX (no media files)  
- Vanilla ES modules — no build step  

## Project layout

```
index.html
PRIVACY.md
css/style.css
js/security-bootstrap.js  — network / storage / media locks
js/main.js
js/world.js
js/player.js
js/seeker.js
js/audio.js
js/mobile.js
js/minimap.js
vendor/three.module.js
_headers / vercel.json    — security headers for static hosts
```

## License

MIT — use and remix freely.
