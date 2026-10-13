// Browser WebSocket client + snapshot buffer for interpolation.
class NetClient {
  constructor() {
    this.ws = null;
    this.playerId = null;
    this.code = null;
    this._buf = []; // last two state messages
    this._lastInputSent = 0;
    this.onCreated = () => {};
    this.onJoined = () => {};
    this.onError = () => {};
    this.onState = () => {};
    this.onDead = () => {};
  }

  connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${proto}://${location.host}`);
    return new Promise((resolve, reject) => {
      this.ws.addEventListener('open', () => resolve());
      this.ws.addEventListener('error', (e) => reject(e));
      this.ws.addEventListener('message', (ev) => this._onMessage(ev));
    });
  }

  _onMessage(ev) {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    switch (msg.type) {
      case 'created': this.playerId = msg.playerId; this.code = msg.code; this.onCreated(msg); break;
      case 'joined': this.playerId = msg.playerId; this.code = msg.code; this.onJoined(msg); break;
      case 'error': this.onError(msg); break;
      case 'dead': this.onDead(msg); break;
      case 'state':
        this._buf.push(msg);
        if (this._buf.length > 2) this._buf.shift();
        this.onState(msg);
        break;
    }
  }

  _send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }

  create(name, color) { this._send({ type: 'create', name, color }); }
  join(code, name, color) { this._send({ type: 'join', code: String(code).toUpperCase(), name, color }); }
  leave() { this._send({ type: 'leave' }); }

  sendInput(aimX, aimY, boost) {
    const now = performance.now();
    if (now - this._lastInputSent < 50) return; // ~20/s
    this._lastInputSent = now;
    this._send({ type: 'input', aimX, aimY, boost });
  }

  latestTwo() {
    if (this._buf.length === 0) return [null, null];
    if (this._buf.length === 1) return [this._buf[0], this._buf[0]];
    return [this._buf[0], this._buf[1]];
  }
}
