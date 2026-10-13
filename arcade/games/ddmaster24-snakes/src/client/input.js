// Captures player input and converts to an aim point + boost flag. Browser-only.
class InputController {
  constructor(canvas, controlMethod = 'mouse') {
    this.canvas = canvas;
    this.method = controlMethod;
    this.mouse = { x: canvas.width / 2, y: canvas.height / 2 };
    this.arrowDir = { x: 0, y: -1 };
    this.boost = false;
    this.joystick = { active: false, cx: 0, cy: 0, x: 0, y: 0 };
    this._bind();
  }

  _bind() {
    this.canvas.addEventListener('mousemove', (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left; this.mouse.y = e.clientY - r.top;
      if (this.method === 'joystick' && this.joystick.active) {
        this.joystick.x = this.mouse.x; this.joystick.y = this.mouse.y;
      }
    });
    document.addEventListener('keydown', (e) => {
      if (this.method === 'arrows') {
        if (e.code === 'ArrowUp' || e.code === 'KeyW') { this.arrowDir = { x: 0, y: -1 }; e.preventDefault(); }
        else if (e.code === 'ArrowDown' || e.code === 'KeyS') { this.arrowDir = { x: 0, y: 1 }; e.preventDefault(); }
        else if (e.code === 'ArrowLeft' || e.code === 'KeyA') { this.arrowDir = { x: -1, y: 0 }; e.preventDefault(); }
        else if (e.code === 'ArrowRight' || e.code === 'KeyD') { this.arrowDir = { x: 1, y: 0 }; e.preventDefault(); }
      }
      if (e.code === 'Space') { this.boost = true; e.preventDefault(); }
    });
    document.addEventListener('keyup', (e) => { if (e.code === 'Space') this.boost = false; });

    if (this.method === 'joystick') {
      const start = (x, y) => { this.joystick = { active: true, cx: x, cy: y, x, y }; };
      const move = (x, y) => { if (this.joystick.active) { this.joystick.x = x; this.joystick.y = y; } };
      const end = () => { this.joystick.active = false; };
      this.canvas.addEventListener('mousedown', (e) => { const r = this.canvas.getBoundingClientRect(); start(e.clientX - r.left, e.clientY - r.top); });
      this.canvas.addEventListener('mouseup', end);
      this.canvas.addEventListener('touchstart', (e) => { e.preventDefault(); const r = this.canvas.getBoundingClientRect(); const t = e.touches[0]; start(t.clientX - r.left, t.clientY - r.top); });
      this.canvas.addEventListener('touchmove', (e) => { e.preventDefault(); const r = this.canvas.getBoundingClientRect(); const t = e.touches[0]; move(t.clientX - r.left, t.clientY - r.top); });
      this.canvas.addEventListener('touchend', (e) => { e.preventDefault(); end(); });
    }
  }

  getAim(renderer) {
    if (this.method === 'arrows') {
      const head = renderer.followHead || { x: 2000, y: 2000 };
      return { x: head.x + this.arrowDir.x * 1000, y: head.y + this.arrowDir.y * 1000 };
    }
    if (this.method === 'joystick' && this.joystick.active) {
      const dx = this.joystick.x - this.joystick.cx;
      const dy = this.joystick.y - this.joystick.cy;
      const head = renderer.followHead || { x: 2000, y: 2000 };
      if (Math.hypot(dx, dy) > 10) return { x: head.x + dx * 5, y: head.y + dy * 5 };
      return head;
    }
    // mouse → world via camera
    return {
      x: this.mouse.x / renderer.zoom + renderer.cam.x,
      y: this.mouse.y / renderer.zoom + renderer.cam.y,
    };
  }
}
