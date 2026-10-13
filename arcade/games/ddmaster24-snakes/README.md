# 🐍 Snakes IO Game

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/DDMaster24/snakes-io-game/releases)
[![Platform](https://img.shields.io/badge/platform-Windows-blue.svg)](https://github.com/DDMaster24/snakes-io-game/releases)

A modern, Snake.io-inspired game built with Electron and JavaScript. Play real-time multiplayer with friends on the same WiFi using room codes, or challenge AI opponents. Control your snake with your mouse or keyboard, eat particles to grow massive, and compete for the top spot!

![Game Screenshot - Coming Soon](https://via.placeholder.com/800x400/0f1419/00ff88?text=Snakes+IO+Game+Screenshot)

---

## 🎮 Play Now

### 💾 Download for Windows
**[⬇️ Download Installer (v1.0.0)](https://github.com/DDMaster24/snakes-io-game/releases/latest/download/Snakes-IO-Game-Setup-1.0.0.exe)**

*Installer size: ~71 MB*

### 🌐 Play on Same WiFi
**Real-time multiplayer with room codes** — Run locally via `npm run web`, create a lobby on the host, and invite friends on the same WiFi to join with a 5-letter code. AI bots fill the world alongside human players. See [QUICK_START.md](QUICK_START.md) for detailed setup.

---

## ✨ Features

### 🕹️ **Multiple Control Methods**
- **Mouse Control**: Smooth, responsive movement following your cursor
- **Keyboard Control**: Arrow keys or WASD for classic Snake gameplay
- **Virtual Joystick**: Touch-friendly on-screen controls

### 🤖 **Multiplayer & Smart AI Opponents**
- Play real-time multiplayer with friends on the same WiFi using room codes
- Server-authoritative simulation — fair collisions, one source of truth
- 6 AI snakes with per-bot skill tiers fill the world alongside human players
- Bots actively avoid walls, flee bigger snakes, and **lead** their prey (aim ahead of it)
- Bots boost to chase or escape — but not into walls
- Some start HUGE (300+ mass!) for immediate challenge

### 🎨 **Beautiful Graphics**
- Glowing particle effects and a boost glow
- Smooth interpolated movement + camera that eases and **zooms out as you grow**
- Live **minimap** showing every snake in the arena
- On-screen **kill feed** of recent takedowns
- Massive 4000x4000 playing field

### ⚡ **Boost with a cost**
- Hold **SPACEBAR** for a 1.8x speed boost
- Boosting **drains your mass** and drops a food trail — a real tactical tradeoff
- Too small to boost below a minimum size

### 🔊 **Sound**
- Web Audio effects for eating, boosting, and death

### 📊 **Competitive Features**
- Real-time leaderboard with rankings
- Track your mass and length
- Compete against friends and AI for the top spot

### 🌈 **Customization**
- Choose from 7 vibrant snake colors
- Personalize your gameplay experience

---

## 🎯 How to Play

### � Objective
Grow your snake as large as possible by eating particles and smaller snakes while avoiding walls and your own body!

### 🕹️ Controls
| Action | Control |
|--------|---------|
| **Move** | Mouse / Arrow Keys / WASD / Joystick |
| **Boost** | Hold SPACEBAR |
| **Pause** | ESC |

### 📈 Gameplay Tips
1. **Start Small**: Eat glowing particles to grow your length
2. **Hunt Smaller Snakes**: Collide with smaller snakes' heads to eliminate them
3. **Eat Their Remains**: Dead snakes drop particles worth their mass
4. **Avoid Bigger Snakes**: They can eliminate you instantly
5. **Use Boost Wisely**: Speed up to escape or chase, but don't crash!
6. **Body Collision**: Any part of another snake's body is deadly!
7. **Watch the Borders**: Red dashed lines mark the boundaries

### 💡 Pro Tips
- Larger snakes are slower but more powerful
- Circle around bigger snakes to trap them
- Use boost to cut off opponents
- Stay near the center where food spawns
- Watch the leaderboard to track threats

---

## 🚀 Installation

### Windows Installer (Recommended)

1. **Download** the installer from [Releases](https://github.com/DDMaster24/snakes-io-game/releases/latest)
2. **Run** `Snakes IO Game Setup 1.0.0.exe`
3. If you see **"Windows protected your PC"**:
   - Click **"More info"**
   - Click **"Run anyway"**
   - *(This is normal for apps without a $300/year code-signing certificate)*
4. **Follow** the installation wizard
5. **Launch** from Desktop or Start Menu
6. **Enjoy!**

### Portable Version

Download `Snakes IO Game 1.0.0.exe` - no installation required!

---

## ⚠️ Security Warning Explained

You might see: **"Windows protected your PC"**

**Why does this happen?**
- Apps need a code-signing certificate ($300-500/year) to avoid this warning
- This game doesn't have one (it's an indie game!)
- The code is 100% open source - you can verify it's safe

**How to install:**
1. Click "More info"
2. Click "Run anyway"
3. Done!

The game is completely safe and contains no malware. All code is visible in this repository.

---

## 🛠️ Development

### Run Locally

```bash
# Install dependencies
npm install

# Run desktop app (Electron)
npm start

# Run web version (http://localhost:3000)
npm run web

# Build Windows installer
npm run build
```

### Project Structure

```
snakes-io-game/
├── src/
│   ├── shared/          # Browser-free simulation (runs on server AND browser)
│   │   ├── vector2.js   #   2D vector math
│   │   ├── constants.js #   Gameplay/network constants
│   │   ├── random.js    #   Random helpers + room-code generator
│   │   ├── snake.js     #   Snake movement/growth/serialization
│   │   ├── particle.js  #   Food particles
│   │   ├── collisions.js#   Authoritative collision rules
│   │   └── ai.js        #   Bot decision logic
│   └── client/          # Browser-only presentation
│       ├── net.js       #   WebSocket client + snapshot buffer
│       ├── renderer.js  #   Interpolated rendering, camera, minimap
│       ├── input.js     #   Mouse/keyboard/joystick input
│       ├── audio.js     #   Sound effects
│       └── main.js      #   Lobby UI + render loop wiring
├── server/
│   ├── GameRoom.js      # One authoritative game instance (30Hz tick)
│   └── LobbyManager.js  # Rooms keyed by code
├── server.js            # Express static host + WebSocket server + tick loop
├── test/                # node:test unit + integration tests
├── index.html           # Game UI (lobby, HUD, kill feed)
├── electron.js          # Electron desktop wrapper (hosts the server)
└── package.json         # Dependencies
```

---

## 🎮 How to Play

## �️ Technology Stack

| Technology | Purpose |
|------------|---------|
| **Electron** | Cross-platform desktop app framework |
| **HTML5 Canvas** | High-performance 2D rendering |
| **JavaScript (ES6+)** | Pure vanilla JS, no frameworks |
| **Express** | Web server for browser version |
| **electron-builder** | Creating Windows installer |

---

## 📊 Game Statistics

- **World Size**: 4000x4000 units
- **AI Opponents**: 6 snakes with varying sizes (100-300 starting mass)
- **Food Particles**: 800+ glowing particles
- **Growth Rate**: 1 mass = 1 body segment
- **Boost Speed**: 1.8x normal speed
- **FPS Target**: 60 FPS with smooth interpolation

---

## 🎨 Game Mechanics Deep Dive

### Growth System
- Each particle eaten = +1 mass
- Each mass point = +1 body segment
- Eating a 300-mass snake = +270 mass (90% transfer)
- Body collision kill = +30% of victim's mass bonus

### AI Behavior
- **Self-preservation**: Avoids own body automatically
- **Wall avoidance**: Proactively steers back toward the center near edges
- **Threat detection**: Flees from larger snakes (range scales with bot skill)
- **Hunting with leading**: Aims *ahead* of smaller prey along their heading
- **Boost**: Boosts to close on prey or escape — but never into a wall
- **Skill tiers**: Each bot has its own reaction/aggression level
- **Food seeking**: Targets nearby particle clusters when no threat/prey

### Collision Detection
- **Head-to-head**: Smaller snake dies
- **Head-to-body**: Head owner dies instantly
- **Self-collision**: Death after length > 20
- **Wall collision**: Instant death at borders

---

## 🔮 Roadmap

### Version 1.1 (Planned)
- [ ] Sound effects and background music
- [ ] More AI difficulty levels
- [ ] Custom snake skins/patterns
- [ ] Achievements system

### Version 2.0 (Future)
- [ ] Online multiplayer
- [ ] Power-ups (speed boost, invincibility, magnet)
- [ ] Different game modes (team mode, battle royale)
- [ ] Mobile version (iOS/Android)

---

## 🐛 Known Issues & Limitations

- Windows Defender SmartScreen warning (due to no code-signing certificate)
- Default Electron icon (custom icon requires .ico file)
- Web version requires modern browser (Chrome, Firefox, Edge)

**Found a bug?** [Open an issue](https://github.com/DDMaster24/snakes-io-game/issues)

---

## 🤝 Contributing

This was built as a demo of AI-assisted development, but contributions are welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## � License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Inspired by the classic Snake game and Snake.io
- Built in under 1 hour using AI-assisted development
- Special thanks to the open-source community

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/DDMaster24/snakes-io-game/issues)
- **Discussions**: [GitHub Discussions](https://github.com/DDMaster24/snakes-io-game/discussions)

---

## 🌟 Show Your Support

If you enjoyed this game, please consider:
- ⭐ Starring this repository
- 🐛 Reporting bugs
- 💡 Suggesting features
- 🔗 Sharing with friends

---

## � Screenshots

*Screenshots coming soon! Play the game and share yours!*

---

**Made with ❤️ using AI-assisted development**

*Built to demonstrate the power of modern AI coding assistants*

## 📝 License

MIT License - Feel free to use and modify!

## 👨‍💻 Credits

Created with ❤️ using AI-assisted development.

---

**Enjoy the game!** 🎮🐍
