import { CONFIG } from "./config.js";
import { DOM } from "./dom.js";
import { normalizeText, updateStatusMessage } from "./utils.js";

export const gameState = {
  currentSong: null,
  allSongs: [],
  playHistory: [],
  playQueue: [],
  lastPlayedTitleNormalized: null,

  reset() {
    this.currentSong = null;
    this.allSongs = [];
    this.playHistory = [];
    this.playQueue = [];
    this.lastPlayedTitleNormalized = null;
  },
};

export const scoreState = {
  total: 0,
  rounds: 0,
  maxRounds: 0,
  streak: 0,
  bestStreak: 0,
  roundStartTs: 0,
  roundLocked: false,
  attemptsInRound: 0,
  lastResult: null,
  history: [],
  currentSongId: null,
  artistId: null,

  reset() {
    this.total = 0;
    this.rounds = 0;
    this.maxRounds = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.roundStartTs = 0;
    this.roundLocked = false;
    this.attemptsInRound = 0;
    this.lastResult = null;
    this.history = [];
    this.currentSongId = null;
    this.artistId = null;
  },
};

export function startRoundScore(songId) {
  scoreState.rounds++;
  scoreState.roundStartTs = Date.now();
  scoreState.roundLocked = false;
  scoreState.attemptsInRound = 0;
  scoreState.lastResult = null;
  scoreState.currentSongId = songId;
  renderScoreboard();
}

export function noteAttempt() {
  scoreState.attemptsInRound++;
}

export function finalizeRoundScore(result) {
  if (scoreState.rounds > scoreState.maxRounds) {
    return null;
  }

  if (scoreState.roundLocked) {
    return null;
  }

  scoreState.roundLocked = true;

  const timeSinceRoundStart = (Date.now() - scoreState.roundStartTs) / 1000;
  const attemptsInCurrentRound = scoreState.attemptsInRound;

  let streakForScore = scoreState.streak;
  if (result === "correct") {
    streakForScore = scoreState.streak + 1;
  }

  let points;
  if (result === "skip") {
    points = -CONFIG.GAME.SCORING.SKIP_PENALTY;
  } else {
    points = Math.max(
      0,
      (CONFIG.GAME.SCORING.BASE_POINTS -
        CONFIG.GAME.SCORING.TIME_PENALTY * timeSinceRoundStart -
        CONFIG.GAME.SCORING.ATTEMPT_PENALTY * (attemptsInCurrentRound - 1)) *
        (1 + CONFIG.GAME.SCORING.STREAK_MULTIPLIER * streakForScore),
    );
  }

  scoreState.total = Math.max(0, scoreState.total + points);

  if (result === "correct") {
    scoreState.streak++;
    scoreState.bestStreak = Math.max(scoreState.bestStreak, scoreState.streak);
  }

  if (result === "skip") {
    scoreState.streak = 0;
  }

  scoreState.lastResult = result;

  scoreState.history.push({
    songId: scoreState.currentSongId,
    points,
    T: timeSinceRoundStart,
    A: attemptsInCurrentRound,
    result,
    at: Date.now(),
  });

  renderScoreboard();
  return points;
}

export function renderScoreboard() {
  DOM.scoreTotal.textContent = Math.round(scoreState.total);
  DOM.scoreStreak.textContent = scoreState.streak;
  DOM.scoreStreak
    .closest(".score-item")
    ?.classList.toggle("is-streak-active", scoreState.streak > 0);
  DOM.scoreRounds.innerHTML = `<span>${scoreState.rounds}</span><span class="text-secondary"> / ${scoreState.maxRounds}</span>`;
}

export function getUnplayedSong() {
  if (gameState.allSongs.length === 0) {
    return;
  }

  if (gameState.playHistory.length === gameState.allSongs.length) {
    return;
  }

  if (gameState.playQueue.length === 0) {
    const playedSet = new Set(gameState.playHistory);
    const remainingSongs = gameState.allSongs.filter(
      (song) => !playedSet.has(song.trackId),
    );

    shuffleArray(remainingSongs);
    gameState.playQueue = remainingSongs;
  }

  const nextSong = gameState.playQueue.shift();
  if (!nextSong) {
    return;
  }

  let selectedSong = nextSong;

  if (
    gameState.lastPlayedTitleNormalized &&
    normalizeText(nextSong.trackName) === gameState.lastPlayedTitleNormalized &&
    gameState.playQueue.length > 0
  ) {
    const alternativeSongIndex = gameState.playQueue.findIndex(
      (song) =>
        normalizeText(song.trackName) !== gameState.lastPlayedTitleNormalized,
    );

    if (alternativeSongIndex !== -1) {
      const [alternativeSong] = gameState.playQueue.splice(
        alternativeSongIndex,
        1,
      );
      gameState.playQueue.push(nextSong);
      selectedSong = alternativeSong;
    }
  }

  gameState.playHistory.push(selectedSong.trackId);
  gameState.lastPlayedTitleNormalized = normalizeText(selectedSong.trackName);
  return selectedSong;
}

function shuffleArray(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

export function playCurrentRound(audioPlayer) {
  audioPlayer.pause();
  gameState.currentSong = getUnplayedSong();
  if (!gameState.currentSong) {
    updateStatusMessage(CONFIG.MESSAGES.NO_SONGS_FOUND, "error");
    return;
  }

  DOM.audioPlayer.src = gameState.currentSong.previewUrl;

  startRoundScore(gameState.currentSong.trackId);

  audioPlayer.play().catch(() => {
    updateStatusMessage(CONFIG.MESSAGES.PLAY_AUDIO_HINT, "info");
  });
}

export function isGuessCorrect(userGuess, actualTitle) {
  return normalizeText(userGuess) === normalizeText(actualTitle);
}
