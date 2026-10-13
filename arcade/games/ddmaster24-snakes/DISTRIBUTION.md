# 🎮 Snakes IO Game - Distribution Guide

## 📦 Building the Installer

### Windows Installer (Recommended)
```bash
npm run build
```

This creates two files in the `dist/` folder:
- **`Snakes IO Game Setup X.X.X.exe`** - Full installer with wizard
- **`Snakes IO Game X.X.X.exe`** - Portable version (no install needed)

### Build for All Platforms
```bash
npm run build:all
```

## 🌐 Web Version Deployment

### Option 1: GitHub Pages (Free)

1. **Create GitHub Repository**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/snakes-io-game.git
   git push -u origin main
   ```

2. **Enable GitHub Pages**
   - Go to repository Settings > Pages
   - Select "Deploy from branch" > "main" > "/ (root)"
   - Your game will be live at: `https://YOUR_USERNAME.github.io/snakes-io-game/`

### Option 2: Vercel (Free, Fastest)

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Deploy**
   ```bash
   vercel
   ```

3. **Create vercel.json** (already included)

### Option 3: Netlify (Free)

1. **Install Netlify CLI**
   ```bash
   npm i -g netlify-cli
   ```

2. **Deploy**
   ```bash
   netlify deploy --prod
   ```

## 📤 Distribution Methods

### Method 1: GitHub Releases (Recommended)

1. **Create a Release on GitHub**
   - Go to your repository
   - Click "Releases" > "Create a new release"
   - Tag version: `v1.0.0`
   - Upload files from `dist/` folder
   - Add release notes

2. **Users Download**
   - Direct download link from GitHub
   - Automatic version tracking
   - Users can report issues

### Method 2: Google Drive / Dropbox

1. **Upload** the installer to cloud storage
2. **Share** the link with your friend
3. **Simple** but no version control

### Method 3: Your Own Website

Add a download button to your existing Vercel site:

```html
<a href="https://github.com/YOUR_USERNAME/snakes-io-game/releases/latest/download/Snakes-IO-Game-Setup-1.0.0.exe" 
   class="download-btn">
   Download Game for Windows
</a>
```

## 🔒 Dealing with Windows Security Warnings

### The Problem
Windows SmartScreen will show "Windows protected your PC" warning for unsigned apps.

### Solutions

#### Option 1: Instructions for Users (Free)
Tell users to:
1. Click "More info" on the warning
2. Click "Run anyway"
3. This is safe - it's just because we don't have a code signing certificate

#### Option 2: Code Signing Certificate ($100-300/year)
- Purchase from: DigiCert, Sectigo, or SSL.com
- Sign your executable with the certificate
- Windows will trust it immediately

#### Option 3: Build Reputation (Free, takes time)
- After enough users download and run without issues
- Windows SmartScreen will stop showing warnings
- Takes weeks to months

### Best Immediate Solution
Create a simple instructions page:

```markdown
## How to Install

1. Download the installer
2. If you see "Windows protected your PC":
   - Click "More info"
   - Click "Run anyway"
3. Follow the installation wizard
4. Enjoy the game!

This warning appears because we don't have a $300/year certificate.
The game is completely safe!
```

## 🎯 Quick Distribution Checklist

- [ ] Build Windows installer: `npm run build`
- [ ] Test the installer on your machine
- [ ] Create GitHub repository
- [ ] Create GitHub Release with installer
- [ ] Deploy web version to Vercel/Netlify
- [ ] Share links with your friend
- [ ] Add download button to your website

## 📝 Example README for GitHub

```markdown
# 🐍 Snakes IO Game

A modern Snake.io-inspired game with AI opponents!

## 🎮 Play Online
👉 [Play in Browser](https://your-game.vercel.app)

## 💾 Download for Windows
👉 [Download Installer](https://github.com/YOUR_USERNAME/snakes-io-game/releases/latest)

### Features
- Smooth mouse/keyboard controls
- 6 AI opponents with varying difficulty
- Beautiful glowing graphics
- Grow by eating particles and other snakes
- Boost ability for intense moments

### Controls
- **Mouse**: Move to control
- **Arrow Keys/WASD**: Direction control
- **Joystick**: Click and drag (touch support)
- **Space**: Boost
- **ESC**: Pause

## 🛠️ Development
\`\`\`bash
npm install
npm start        # Run desktop app
npm run web      # Run in browser
npm run build    # Build installer
\`\`\`
```

## 🚀 Next Steps

1. Test the game thoroughly
2. Choose your distribution method
3. Create nice screenshots for GitHub
4. Share with your friend!
5. Collect feedback for v2.0

---

Made with ❤️ using AI-assisted development
