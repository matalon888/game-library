<div align="center">
   <img src="logo.svg" alt="Guess FM logo" width="160" />
</div>

# Guess FM

Guess FM is a web-based music quiz game that challenges your knowledge of songs and artists. Search for an artist, listen to a short audio snippet, and try to guess the song title. Built with vanilla JavaScript, HTML, and CSS, it uses the iTunes API for music data and previews.

<div align="center">
    <img
       src="assets/readme/guess-fm-screenshot.png"
       alt="Guess FM screenshot"
    />
</div>

## Live Demo

Try it out online: [Guess FM on GitHub Pages](https://qchick1337.github.io/guess-fm/)

## Features

- **Artist Search:** Enter an artist's name to start the game.
- **Audio Previews:** Listen to 30-second snippets of songs.
- **Guessing Game:** Type your guess for the song title and get instant feedback.
- **Skip & Next:** Skip songs or move to the next round easily.
- **Score System:** Earn points based on speed and accuracy, with streak bonuses for consecutive correct answers.
- **Responsive Design:** Works well on desktop and mobile devices.

## Scoring System

Your score is calculated based on multiple factors:

- **Base Points:** Start with 100 points per song
- **Time Penalty:** -2 points per second (faster guesses = higher score)
- **Attempt Penalty:** -10 points for each wrong guess beyond the first
- **Streak Bonus:** +10% multiplier for each consecutive correct answer
- **Skip Penalty:** -10 points for skipping a song (resets your streak)

**Formula:** `Score = max(0, (100 - 2×Time - 10×(Attempts-1)) × (1 + 0.1×Streak))`

## Getting Started

### Prerequisites

- Modern web browser (Chrome, Firefox, Edge, Safari)
- Internet connection (for API access)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/QCHICK1337/guess-fm.git
   ```
2. Open the project folder:
   ```bash
   cd guess-fm
   ```
3. Open `index.html` in your browser.

### Usage

1. Enter an artist name in the search box.
2. Click **Search**.
3. Listen to the song preview and type your guess.
4. Submit your guess or skip to the next song.

## Technologies Used

- HTML5
- CSS3
- JavaScript (ES6)
- [iTunes Search API](https://performance-partners.apple.com/search-api)
- [Plyr](https://plyr.io/) for the audio player UI (loaded via CDN)
- [Canvas Confetti](https://www.npmjs.com/package/canvas-confetti) for celebration effects (loaded via CDN)
- [Font Awesome](https://fontawesome.com/)

## Project Structure

```
├── index.html      # HTML markup - game interface and layout
├── style.css       # CSS styling - design tokens, layout, components
├── app.js          # Entry point - event listeners and game flow control
├── api.js          # iTunes API integration - artist search and song fetching
├── config.js       # Configuration - constants, API settings, and game rules
├── game.js         # Game state management - scoring, song selection, round logic
├── ui.js           # UI state functions - screen visibility, rendering results
├── dom.js          # DOM references
├── utils.js        # Utility functions - text normalization, messaging, helpers
└── logo.svg        # App logo
```

## Credits

- Developed by [QCHICK1337](https://github.com/QCHICK1337)
- Music data from Apple iTunes

## License

This project is licensed under the MIT License.
