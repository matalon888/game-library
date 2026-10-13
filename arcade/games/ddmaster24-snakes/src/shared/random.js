// Shared random helpers. Runs in Node and the browser.
(function (root) {
  function randomRange(min, max) { return Math.random() * (max - min) + min; }
  function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

  const COLORS = [
    '#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24',
    '#6c5ce7', '#fd79a8', '#fdcb6e', '#00b894',
    '#ff7675', '#74b9ff', '#a29bfe', '#ffeaa7',
  ];
  function randomColor() { return COLORS[Math.floor(Math.random() * COLORS.length)]; }

  const ADJ = ['Speedy', 'Mighty', 'Sneaky', 'Giant', 'Tiny', 'Angry', 'Happy', 'Crazy'];
  const NOUN = ['Snake', 'Serpent', 'Viper', 'Python', 'Cobra', 'Rattler', 'Noodle', 'Worm'];
  function randomName() {
    return `${ADJ[randomInt(0, ADJ.length - 1)]} ${NOUN[randomInt(0, NOUN.length - 1)]}`;
  }

  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  function makeRoomCode() {
    let s = '';
    for (let i = 0; i < 5; i++) s += LETTERS[randomInt(0, 25)];
    return s;
  }

  const api = { randomRange, randomInt, randomColor, randomName, makeRoomCode };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof self !== 'undefined' ? self : this);
