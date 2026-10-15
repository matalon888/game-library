# Contributing to HOOPS '88 🏀

Thanks for your interest in making HOOPS '88 even better! This is a small, dependency-free arcade game, so contributing is quick and friendly.

## Ways to contribute

- 🐛 **Report bugs** — open an issue describing what happened, what you expected, and steps to reproduce.
- 💡 **Suggest features** — new game modes, power-ups, sound effects, or visual flourishes are all welcome.
- 🎨 **Polish** — tweaks to the CRT styling, animations, or controls.
- 📖 **Docs** — improvements to the README or this guide.

## Getting started

There's no build step and no dependencies.

```bash
git clone https://github.com/CarlosSardo/hoops88.git
cd hoops88
python3 -m http.server 8000   # then open http://localhost:8000
```

Or simply open `index.html` in your browser.

## Making changes

1. **Fork** the repository and create a branch:
   ```bash
   git checkout -b my-feature
   ```
2. Make your changes. Keep the project **dependency-free** — vanilla HTML, CSS, and JS only.
3. **Test in the browser**: both 1-player and 2-player modes, plus the start and game-over screens.
4. **Commit** with a clear message:
   ```bash
   git commit -m "Add: short description of your change"
   ```
5. **Push** and open a **Pull Request** describing what you changed and why.

## Code style

- Match the existing style in `game.js` (2-space indent, `const`/`let`, `"use strict"`).
- Keep gameplay constants grouped and commented, as they are now.
- Prefer small, focused changes that are easy to review.

## Code of conduct

Be kind and constructive. This project started as a father-and-son coding adventure — let's keep it fun and welcoming for everyone. 🏀

Happy hooping!
