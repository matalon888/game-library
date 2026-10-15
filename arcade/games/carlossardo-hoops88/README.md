<div align="center">

# 🏀 HOOPS '88

### Retro Arcade Basketball — pure vanilla JavaScript, zero dependencies

[![Play Now](https://img.shields.io/badge/▶_PLAY_NOW-online-2ff3ff?style=for-the-badge)](https://carlossardo.github.io/hoops88/)
[![License: MIT](https://img.shields.io/badge/License-MIT-ff4fd8.svg?style=for-the-badge)](LICENSE)
[![Made with](https://img.shields.io/badge/made_with-vanilla_JS-f7df1e?style=for-the-badge&logo=javascript&logoColor=black)](game.js)

*A neon-soaked, CRT-flavored hoops cabinet you can play right in your browser.*

</div>

---

## 🎮 Play

**▶ [Play HOOPS '88 online](https://carlossardo.github.io/hoops88/)**

No install, no build step, no dependencies. Just open it and shoot.

## ✨ Features

- 🕹️ **1-Player mode** — beat the clock and chase your high score.
- 👥 **2-Player local 1v1** — share one hoop, most points in 60 seconds wins.
- 📱 **Mobile friendly** — on-screen touch controls kick in automatically on phones and tablets (1-player mode).
- 🎯 **Real arc physics** — gravity, rim collisions, and a charge-and-release shot meter.
- ⚡ **Super Shot** — bank the ball off a side wall and into the hoop for a big bonus and an explosive neon celebration.
- 🔥 **Combo system** — sink baskets back-to-back to rack up multipliers.
- 🎵 **Web Audio FX** — retro blips and swishes generated on the fly, no audio files.
- 📺 **CRT aesthetic** — scanlines, neon glow, and that sweet arcade-cabinet vibe.
- 💾 **Persistent high score** — saved locally in your browser.

## 🎛️ Controls

| Action | Player 1 | Player 2 |
| ------ | -------- | -------- |
| Move   | `◄` `►` or `A` `D` | `◄` `►` |
| Adjust arc | `▲` `▼` or `W` `S` | `▲` `▼` |
| Shoot  | `SPACE` | `ENTER` |

**Hold** the shoot key to charge the power meter, then **release** to fire. Sink baskets!

> In 1v1, both players share the hoop — most points in 60 seconds **WINS**.

### 📱 On mobile

On phones and tablets the game runs in **1-player mode** with on-screen touch pads: tap and hold ◄ ► to **move**, ▲ ▼ to adjust the **arc**, and hold the **SHOOT** button to charge — release to fire.

## 🚀 Run it locally

Clone and open — that's the whole setup:

```bash
git clone https://github.com/CarlosSardo/hoops88.git
cd hoops88
```

Then either open `index.html` directly in your browser, or serve it locally:

```bash
# Python 3
python3 -m http.server 8000
# then visit http://localhost:8000
```

## 🗂️ Project structure

```
hoops88/
├── index.html   # Markup, HUD, start/game-over overlays
├── style.css    # Neon CRT arcade styling
└── game.js      # Game loop, physics, input, audio, scoring
```

## 🛠️ Built with

- **Vanilla JavaScript** — Canvas 2D rendering and a hand-rolled physics loop.
- **Web Audio API** — procedural sound effects.
- **CSS** — CRT scanlines and neon glow, no frameworks.

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

## 📜 License

Released under the [MIT License](LICENSE).

## 💙 Credits

This is a very special project: it's the **first game I vibe-coded with my son, Eduardo Sardo** — co-creator, chief playtester, and the reason this cabinet exists. 🏀

Made with love by **Carlos Sardo** & **Eduardo Sardo**.
