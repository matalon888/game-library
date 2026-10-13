// Shared 2D vector math. Runs in Node and the browser.
(function (root) {
  class Vector2 {
    constructor(x, y) { this.x = x; this.y = y; }
    add(v) { return new Vector2(this.x + v.x, this.y + v.y); }
    subtract(v) { return new Vector2(this.x - v.x, this.y - v.y); }
    multiply(s) { return new Vector2(this.x * s, this.y * s); }
    distance(v) {
      const dx = this.x - v.x, dy = this.y - v.y;
      return Math.sqrt(dx * dx + dy * dy);
    }
    length() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    normalize() {
      const len = this.length();
      if (len === 0) return new Vector2(0, 0);
      return new Vector2(this.x / len, this.y / len);
    }
    angle() { return Math.atan2(this.y, this.x); }
  }
  const api = { Vector2 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof self !== 'undefined' ? self : this);
