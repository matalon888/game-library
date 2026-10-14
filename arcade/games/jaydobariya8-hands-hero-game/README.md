# HANDS HERO 🖐️🎵

**A browser-based cyberpunk rhythm game controlled by your real-time hand gestures.**

> **Built with Gemini 3.0 x Jay Dobariya**

## 🎮 About
**HANDS HERO** is a single-file web experiment that turns your webcam into a game controller. Notes fall down a retro-synthwave grid, and you must catch them to the beat by making a **fist** with the correct hand.

It runs entirely in the browser using **Vanilla JavaScript**—no heavy frameworks, no build steps, and no MP3 files (all audio is synthesized in real-time).

## ✨ Features
* **Visual Hand Tracking:** See your hand skeleton overlaid on the game in real-time (powered by MediaPipe).
* **Gesture Recognition:** Detects "Open Palm" vs "Fist" to trigger game actions.
* **Procedural Audio:** No pre-recorded music tracks. The beat is generated live using the Web Audio API.
* **Cyberpunk UI:** Neon aesthetics, 3D perspective grid, and particle effects.
* **Zero Dependencies:** Just one HTML file referencing CDNs.

## 🚀 How to Run
1.  **Clone the repository** (or download the ZIP):
    ```bash
    git clone https://github.com/jaydobariya8/hands-hero-game.git
    ```
2.  **Open the file:**
    Simply double-click `index.html` in the root directory to open it in your browser.
    * *Note: For best performance and webcam permissions, use Google Chrome, Edge, or Brave.*
3.  **Allow Camera Access:**
    The browser will ask for permission to use your webcam. Click "Allow" to start tracking.

## 🕹️ How to Play
1.  Click **"INITIALIZE CAMERA"**.
2.  **Calibration:** Raise both hands so the camera sees them.
3.  **Start:** Make a **FIST** with both hands to begin the countdown.
4.  **Gameplay:**
    * **Cyan Notes (Left Lane):** Catch with your **Left Hand**.
    * **Magenta Notes (Right Lane):** Catch with your **Right Hand**.
    * **Action:** When a note hits the bottom target, make a **FIST** to catch it!

## 🛠️ Tech Stack
* **HTML5 Canvas** (Rendering)
* **Google MediaPipe** (Hand Tracking ML)
* **Web Audio API** (Sound Synthesis)
* **Vanilla JavaScript** (Game Logic)

## 📄 License
This project is open source and available under the [MIT License](LICENSE).
