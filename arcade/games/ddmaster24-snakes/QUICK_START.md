# 🐍 Quick Start — Play Together on WiFi

1. On the host machine: `npm install` then `npm run web`.
2. The terminal prints the server URL. Find your LAN IP:
   - macOS: `ipconfig getifaddr en0`
   - Windows: `ipconfig` (look for IPv4 Address)
3. Host: open `http://localhost:3000`, enter a name, click **Create Lobby**. Share the 5-letter code.
4. Other players (same WiFi): open `http://<HOST-LAN-IP>:3000`, enter the code, click **Join**.
5. Mouse to steer, **Spacebar** to boost. Eat glowing dots to grow; make enemies crash into your body. Press **Esc** for the menu.
