/* ========================================
   IMPORTS
   ======================================== */

import { CONFIG } from "./config.js";
import { DOM } from "./dom.js";
import {
  gameState,
  scoreState,
  noteAttempt,
  finalizeRoundScore,
  renderScoreboard,
  playCurrentRound,
  isGuessCorrect,
} from "./game.js";
import {
  updateStatusMessage,
  resetSearchButton,
  setSearchButtonLoading,
  setVisibility,
  showPointsUpdate,
} from "./utils.js";
import { searchAndLoadArtist } from "./api.js";
import {
  showGameScreens,
  showGameRoundUI,
  showResultsUI,
  showSearchScreen,
  showEndGameScreen,
  showConfetti,
  populateSongSuggestions,
} from "./ui.js";

/* ========================================
   AUDIO PLAYER INITIALIZATION
   ======================================== */

const audioPlayer = new Plyr(DOM.audioPlayer, {
  controls: CONFIG.AUDIO_PLAYER.CONTROLS,
});

audioPlayer.volume = CONFIG.AUDIO_PLAYER.VOLUME;

let activeSearchRequestId = 0;
let activeSearchAbortController = null;
let lastHelpTrigger = null;

function setRoundControlsEnabled(isEnabled) {
  DOM.guessInput.disabled = !isEnabled;
  DOM.submitBtn.disabled = !isEnabled;
  DOM.skipBtn.disabled = !isEnabled;
}

function setFeedbackMessage(message, statusType = "") {
  DOM.feedbackDisplay.classList.remove("is-success", "is-info", "is-error");
  DOM.feedbackDisplay.textContent = message;

  if (statusType) {
    DOM.feedbackDisplay.classList.add(`is-${statusType}`);
  }
}

function openHelpModal(trigger = DOM.helpBtn) {
  lastHelpTrigger = trigger;
  DOM.helpModal.classList.add("is-open");
  DOM.helpModal.setAttribute("aria-hidden", "false");
  DOM.helpBtn.setAttribute("aria-expanded", "true");
  DOM.modalCloseBtn.focus();
}

function closeHelpModal() {
  DOM.helpModal.classList.remove("is-open");
  DOM.helpModal.setAttribute("aria-hidden", "true");
  DOM.helpBtn.setAttribute("aria-expanded", "false");
  lastHelpTrigger?.focus();
  lastHelpTrigger = null;
}

/* ========================================
   GAME INITIALIZATION
   ======================================== */

async function loadArtistAndStartGame(artistName) {
  activeSearchRequestId++;
  const requestId = activeSearchRequestId;

  if (activeSearchAbortController) {
    activeSearchAbortController.abort();
  }

  activeSearchAbortController = new AbortController();

  gameState.reset();
  scoreState.reset();
  renderScoreboard();

  setSearchButtonLoading();

  try {
    const result = await searchAndLoadArtist(artistName, {
      signal: activeSearchAbortController.signal,
    });

    if (requestId !== activeSearchRequestId) {
      return;
    }

    scoreState.artistId = result.artistId;
    DOM.artistNameDisplay.textContent = result.artistName;
    gameState.allSongs = result.songs;

    scoreState.maxRounds = Math.min(
      result.songs.length,
      CONFIG.GAME.MAX_ROUNDS,
    );

    populateSongSuggestions(gameState.allSongs);
    setVisibility(
      [DOM.albumArt, DOM.songArtistDisplay, DOM.songTitleDisplay],
      "none",
    );
    showGameScreens();
    setRoundControlsEnabled(true);
    showGameRoundUI();
    setVisibility([DOM.audioContainer, DOM.scoreboard], "flex");
    setVisibility([DOM.artistHeader, DOM.statusMsg], "block");
    updateStatusMessage("", "");
    playCurrentRound(audioPlayer);
    DOM.guessInput.focus();
  } catch (error) {
    if (error.name === "AbortError") {
      return;
    }

    if (requestId !== activeSearchRequestId) {
      return;
    }

    console.error("Error loading artist:", error);
    updateStatusMessage(error.message, "error");
  } finally {
    if (requestId === activeSearchRequestId) {
      resetSearchButton();
      activeSearchAbortController = null;
    }
  }
}

/* ========================================
   EVENT LISTENERS
   ======================================== */

DOM.helpBtn.addEventListener("click", () => {
  openHelpModal(DOM.helpBtn);
});

DOM.modalCloseBtn.addEventListener("click", () => {
  closeHelpModal();
});

DOM.helpModal.addEventListener("click", (event) => {
  if (event.target === DOM.helpModal) {
    closeHelpModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (!DOM.helpModal.classList.contains("is-open")) {
    return;
  }

  if (event.key === "Escape") {
    closeHelpModal();
    return;
  }

  if (event.key === "Tab") {
    const focusableElements = DOM.helpModal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const focusableList = Array.from(focusableElements).filter(
      (element) => !element.hasAttribute("disabled"),
    );

    if (focusableList.length === 0) {
      event.preventDefault();
      return;
    }

    const firstFocusable = focusableList[0];
    const lastFocusable = focusableList[focusableList.length - 1];

    if (event.shiftKey && document.activeElement === firstFocusable) {
      event.preventDefault();
      lastFocusable.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === lastFocusable) {
      event.preventDefault();
      firstFocusable.focus();
    }
  }
});

// Search when form submitted
DOM.searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loadArtistAndStartGame(DOM.searchInput.value);
});

DOM.guessInput.addEventListener("keydown", (event) => {
  if (DOM.helpModal.classList.contains("is-open")) {
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    event.stopPropagation();
    DOM.submitBtn.click();
  }
});

document.addEventListener("keydown", (event) => {
  if (DOM.helpModal.classList.contains("is-open")) {
    return;
  }

  if (
    event.key === "Enter" &&
    getComputedStyle(DOM.nextBtn).display !== "none" &&
    gameState.allSongs.length > 0
  ) {
    DOM.nextBtn.click();
  }
});

// Submit guess
DOM.submitBtn.addEventListener("click", () => {
  if (scoreState.rounds > scoreState.maxRounds) {
    audioPlayer.pause();
    showEndGameScreen(scoreState);
    return;
  }

  const userGuess = DOM.guessInput.value;

  if (userGuess.trim() === "") {
    setFeedbackMessage(CONFIG.MESSAGES.EMPTY_GUESS, "error");
    return;
  }

  noteAttempt();

  if (isGuessCorrect(userGuess, gameState.currentSong.trackName)) {
    const points = finalizeRoundScore("correct");

    if (points === null) {
      return;
    }

    setRoundControlsEnabled(false);

    // Only show results if game hasn't ended
    if (scoreState.rounds <= scoreState.maxRounds) {
      showPointsUpdate(Math.round(points));
      setFeedbackMessage(CONFIG.MESSAGES.CORRECT, "success");
      showConfetti();
      showResultsUI(gameState.currentSong);
    }
  } else {
    setFeedbackMessage(CONFIG.MESSAGES.INCORRECT, "error");
  }
});

// Move to next round
DOM.nextBtn.addEventListener("click", () => {
  if (scoreState.rounds >= scoreState.maxRounds) {
    audioPlayer.pause();
    showEndGameScreen(scoreState);
  } else {
    setRoundControlsEnabled(true);
    showGameRoundUI();
    playCurrentRound(audioPlayer);
  }
});

// Skip current song
DOM.skipBtn.addEventListener("click", () => {
  setFeedbackMessage("");
  const points = finalizeRoundScore("skip");

  if (points === null) {
    return;
  }

  setRoundControlsEnabled(false);
  showPointsUpdate(Math.round(points));

  if (scoreState.rounds >= scoreState.maxRounds) {
    audioPlayer.pause();
    showEndGameScreen(scoreState);
  } else {
    setFeedbackMessage(CONFIG.MESSAGES.SONG_REVEAL, "info");
    showResultsUI(gameState.currentSong);
  }
});

DOM.newGameBtn.addEventListener("click", () => {
  if (scoreState.rounds >= scoreState.maxRounds) {
    showSearchScreen();
  } else {
    setRoundControlsEnabled(true);
    showGameRoundUI();
    playCurrentRound(audioPlayer);
  }
});
