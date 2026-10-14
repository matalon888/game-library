import { CONFIG } from "./config.js";
import { DOM } from "./dom.js";
import { setVisibility } from "./utils.js";

export function showGameRoundUI() {
  setVisibility([DOM.guessInput, DOM.submitBtn, DOM.skipBtn], "block");
  setVisibility(
    [DOM.albumArt, DOM.songArtistDisplay, DOM.songTitleDisplay, DOM.nextBtn],
    "none",
  );

  DOM.feedbackDisplay.classList.remove("is-success", "is-info", "is-error");
  DOM.feedbackDisplay.textContent = "";
  DOM.guessInput.value = "";

  DOM.guessInput.focus();
}

export function showResultsUI(currentSong) {
  DOM.albumArt.classList.add("is-placeholder");
  setVisibility([DOM.albumArt], "block");

  const lowResUrl = currentSong.artworkUrl100;
  DOM.albumArt.src = lowResUrl;

  DOM.songArtistDisplay.textContent = currentSong.artistName;
  DOM.songTitleDisplay.textContent = currentSong.trackName;

  if (DOM.albumArt.complete) {
    handleLowResLoad();
  } else {
    DOM.albumArt.addEventListener("load", handleLowResLoad, { once: true });
    DOM.albumArt.addEventListener("error", handleImageError, { once: true });
  }

  setVisibility(
    [DOM.songArtistDisplay, DOM.songTitleDisplay, DOM.nextBtn],
    "block",
  );
  setVisibility([DOM.guessInput, DOM.submitBtn, DOM.skipBtn], "none");

  function handleLowResLoad() {
    const highResUrl = currentSong.artworkUrl100.replace(
      CONFIG.ITUNES_API.ARTWORK_SIZE_SMALL,
      CONFIG.ITUNES_API.ARTWORK_SIZE_LARGE,
    );

    DOM.albumArt.src = highResUrl;

    if (DOM.albumArt.complete) {
      handleHighResLoad();
    } else {
      DOM.albumArt.addEventListener("load", handleHighResLoad, { once: true });
      DOM.albumArt.addEventListener("error", handleHighResLoadError, {
        once: true,
      });
    }
  }

  function handleHighResLoadError() {
    DOM.albumArt.classList.remove("is-placeholder");
  }

  function handleHighResLoad() {
    DOM.albumArt.classList.remove("is-placeholder");
    setVisibility([DOM.albumArt], "block");
  }
}

export function showGameScreens() {
  setVisibility([DOM.gameContainer], "flex");
  setVisibility([DOM.introSection, DOM.searchInput, DOM.searchBtn], "none");
  DOM.scoreboard.classList.remove("is-hidden");
}

export function showSearchScreen() {
  setVisibility([DOM.introSection, DOM.searchInput, DOM.searchBtn], "block");
  setVisibility([DOM.gameContainer, DOM.endGameScreen], "none");
}

export function showEndGameScreen(scoreState) {
  setVisibility([DOM.endGameScreen], "block");
  setVisibility(
    [
      DOM.guessInput,
      DOM.submitBtn,
      DOM.skipBtn,
      DOM.nextBtn,
      DOM.audioContainer,
      DOM.artistHeader,
      DOM.scoreboard,
      DOM.statusMsg,
      DOM.albumArt,
      DOM.songArtistDisplay,
      DOM.songTitleDisplay,
      DOM.feedbackDisplay,
    ],
    "none",
  );

  // Populate final results
  DOM.finalScore.textContent = Math.round(scoreState.total);
  DOM.finalStreak.textContent = scoreState.bestStreak;
  DOM.finalRounds.textContent = scoreState.rounds;
}

export function showConfetti() {
  if (typeof confetti !== "function") return;
  confetti({
    particleCount: CONFIG.CONFETTI.PARTICLE_COUNT,
    spread: CONFIG.CONFETTI.SPREAD,
    origin: { y: CONFIG.CONFETTI.ORIGIN_Y },
  });
}

export function populateSongSuggestions(songs) {
  DOM.songSuggestions.innerHTML = "";
  const seenTitles = new Set();

  songs.forEach((song) => {
    // Skip duplicate song titles
    if (seenTitles.has(song.trackName)) return;

    seenTitles.add(song.trackName);

    const option = document.createElement("option");
    option.value = song.trackName;
    DOM.songSuggestions.appendChild(option);
  });
}

function handleImageError() {
  setVisibility([DOM.albumArt], "none");
}
