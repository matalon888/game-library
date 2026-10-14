export const CONFIG = {
  ITUNES_API: {
    BASE_URL: "https://itunes.apple.com",
    ARTIST_SEARCH_LIMIT: 1,
    SONG_LOOKUP_LIMIT: 200,
    ARTWORK_SIZE_SMALL: "100x100",
    ARTWORK_SIZE_LARGE: "600x600",
  },
  AUDIO_PLAYER: {
    VOLUME: 0.5,
    CONTROLS: ["play", "progress", "current-time", "mute", "volume"],
  },
  CONFETTI: {
    PARTICLE_COUNT: 100,
    SPREAD: 70,
    ORIGIN_Y: 0.6,
  },
  FILTERS: {
    EXCLUDED_KEYWORDS: ["remix", "instrumental"],
  },
  MESSAGES: {
    ARTIST_REQUIRED: "Please enter an artist",
    ARTIST_NOT_FOUND: "Artist not found",
    NO_SONGS_FOUND: "No playable songs found",
    LOAD_ERROR: "Failed to load songs. Please try again.",
    PLAY_AUDIO_HINT: "Click play to start audio",
    GAME_RESET: "All songs played - game restarted",
    EMPTY_GUESS: "Please enter a guess.",
    CORRECT: "Correct!",
    INCORRECT: "Wrong! Try again.",
    SONG_REVEAL: "The song was:",
  },
  GAME: {
    MAX_ROUNDS: 10,
    NOTIFICATION_TIMEOUT: 2000,
    SCORING: {
      BASE_POINTS: 100,
      TIME_PENALTY: 2,
      ATTEMPT_PENALTY: 10,
      SKIP_PENALTY: 10,
      STREAK_MULTIPLIER: 0.1,
    },
  },
};
