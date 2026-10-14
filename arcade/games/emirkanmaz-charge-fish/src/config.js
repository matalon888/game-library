// All timings, speeds and thresholds live here.
// Feature code must not contain magic numbers (CLAUDE.md Hard Rule #2).

export const CANVAS = {
  TARGET_DPR: Math.min(window.devicePixelRatio || 1, 2),
};

export const GAMMA = {
  // Raw gamma is -90..+90. We only use this active range and saturate beyond.
  RANGE_DEG: 30,
  // EMA smoothing time constant (ms). Lower = snappier, higher = smoother.
  SMOOTHING_MS: 200,
};

export const TIMING = {
  CAST_ANIMATION_MS: 1000,
  REEL_ANIMATION_MS: 1000,
  // How long a fish stays on the hook before escaping.
  HOOKED_TIMEOUT_MS: 6000,
};

export const SCENE = {
  // Vertical screen ratio of the water surface (0=top, 1=bottom).
  WATER_LINE_RATIO: 0.35,
  WAVE_AMPLITUDE_PX: 6,
  WAVE_SPEED: 0.0015,
};

export const ROD = {
  // Vertical screen position of the rod tip (above water).
  ANCHOR_Y_RATIO: 0.08,
  LINE_COLOR: '#e8f4ff',
  HOOK_SIZE_PX: 14,
  // Maximum reach of the line (deeper than this not allowed).
  MAX_HOOK_DEPTH_RATIO: 0.85,
  // Even at depth=0 on the meter, the hook still sinks below the surface.
  MIN_HOOK_DEPTH_RATIO: 0.42,
};

export const DEPTH_METER = {
  // Bar's vertical screen range.
  TOP_Y_RATIO: 0.22,
  BOTTOM_Y_RATIO: 0.82,
  RIGHT_MARGIN_PX: 22,
  BAR_WIDTH_PX: 8,
  INDICATOR_HEIGHT_PX: 18,
  // Animation speed (radians/ms) — lower = slower oscillation.
  ANIM_SPEED: 0.0018,
  // To compensate for the OS lag between "plug detected" and "chargingchange
  // event fired", the depth lock samples the value as it was this many
  // milliseconds ago — matching what the user saw when they plugged in.
  LOCK_DELAY_MS: 350,
};

export const FISH = {
  POPULATION_TARGET: 5,
  SPAWN_INTERVAL_MS: 1500,
  // Weighted spawn distribution by species (normalized to sum).
  SPAWN_WEIGHTS: {
    small: 50,
    medium: 30,
    big: 15,
    golden: 5,
  },
  // Collision tolerance between hook and fish bounding box (pixels).
  HOOK_HITBOX_PADDING: 6,
};

// Debug flags are read from URL query string. None are active in production
// unless explicitly enabled.
export const DEBUG = (() => {
  const params = new URLSearchParams(window.location.search);
  return {
    enabled: params.get('debug') === '1',
    forcedState: params.get('state'),
    fakeCharging: params.get('fakeCharging') === '1',
    manualGamma: params.get('gamma') === 'manual',
  };
})();
