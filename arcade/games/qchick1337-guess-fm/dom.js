export const DOM = {
  // Screen sections
  introSection: document.getElementById("intro-section"),
  gameContainer: document.getElementById("game-container"),
  endGameScreen: document.getElementById("end-game-screen"),
  audioContainer: document.querySelector(".audio-container"),

  // Help Modal
  helpBtn: document.getElementById("help-btn"),
  helpModal: document.getElementById("help-modal"),
  modalCloseBtn: document.getElementById("modal-close-btn"),

  // Search/Input
  searchForm: document.getElementById("search-container"),
  searchInput: document.getElementById("artist-input"),
  searchBtn: document.getElementById("search-btn"),
  statusMsg: document.getElementById("status-msg"),

  // Game display
  artistHeader: document.getElementById("current-artist-header"),
  artistNameDisplay: document.getElementById("artist-name"),
  albumArt: document.getElementById("album-art"),
  songArtistDisplay: document.getElementById("song-artist"),
  songTitleDisplay: document.getElementById("song-title"),
  feedbackDisplay: document.getElementById("feedback-txt"),

  // Game controls & input
  audioPlayer: document.getElementById("audio-player"),
  guessInput: document.getElementById("guess-input"),
  songSuggestions: document.getElementById("song-suggestions"),
  submitBtn: document.getElementById("submit-btn"),
  skipBtn: document.getElementById("skip-btn"),
  nextBtn: document.getElementById("next-btn"),

  // Scoreboard
  scoreboard: document.getElementById("scoreboard"),
  scoreTotal: document.getElementById("score-total"),
  scoreStreak: document.getElementById("score-streak"),
  scoreRounds: document.getElementById("score-rounds"),
  pointsNotification: document.getElementById("points-notification"),

  // Results
  finalScore: document.getElementById("final-score"),
  finalStreak: document.getElementById("final-streak"),
  finalRounds: document.getElementById("final-rounds"),
  newGameBtn: document.getElementById("new-game-btn"),
};
