// Shared gameplay + network constants.
(function (root) {
  const CONSTANTS = {
    WORLD_SIZE: 4000,
    TICK_RATE: 30,
    DT: 1 / 30,
    BASE_SPEED: 120,
    BOOST_MULTIPLIER: 1.8,
    TURN_SPEED: 3,
    SEGMENT_SPACING: 7,
    START_MASS: 100,
    MAX_PARTICLES: 1000,
    START_PARTICLES: 800,
    WALL_PADDING: 40,
    BOOST_DRAIN: 22,
    BOOST_MIN_MASS: 15,
  };
  const api = { CONSTANTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof self !== 'undefined' ? self : this);
