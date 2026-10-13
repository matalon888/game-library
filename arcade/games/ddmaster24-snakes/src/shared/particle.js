// Browser-free food particle. No canvas/DOM.
(function (root) {
  const V = (typeof module !== 'undefined' && module.exports)
    ? require('./vector2.js') : root;
  const R = (typeof module !== 'undefined' && module.exports)
    ? require('./random.js') : root;
  const Vector2 = V.Vector2;
  const randomColor = R.randomColor;

  class Particle {
    constructor(x, y) {
      this.position = new Vector2(x, y);
      this.radius = 5;
      this.color = randomColor();
      this.value = 1;
    }
    toState() {
      return { x: this.position.x, y: this.position.y, r: this.radius, color: this.color };
    }
  }

  const api = { Particle };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof self !== 'undefined' ? self : this);
