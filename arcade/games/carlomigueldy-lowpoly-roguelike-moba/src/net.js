import { Peer } from "peerjs";
import QRCode from "qrcode";

// Human-friendly room code generator. The code IS the host's PeerJS id
// (prefixed) so a joiner can connect directly with no signalling server of ours.
const ADJ = ["BRAVE", "SWIFT", "GRIM", "WILD", "LUCKY", "IRON", "VOID", "EMBER", "FROST", "STORM"];
const NOUN = ["FOX", "WOLF", "BEAR", "HAWK", "GOLEM", "DRAKE", "VIPER", "TITAN", "RAVEN", "BOAR"];
const PREFIX = "lrm-"; // namespaces our ids on the public PeerJS broker

function makeCode() {
  const a = ADJ[(Math.random() * ADJ.length) | 0];
  const n = NOUN[(Math.random() * NOUN.length) | 0];
  const num = ((Math.random() * 90) | 0) + 10;
  return `${a}-${n}-${num}`;
}
const codeToId = (code) => PREFIX + code.trim().toUpperCase();

// Net is a thin mesh wrapper. Host keeps connections to all peers and relays.
export class Net {
  constructor() {
    this.peer = null;
    this.code = null;
    this.isHost = false;
    this.conns = new Map(); // peerId -> DataConnection
    this.handlers = {};     // type -> fn(payload, fromId)
    this.onPeerChange = () => {};
    this.selfId = "p" + Math.random().toString(36).slice(2, 8);
  }

  on(type, fn) { this.handlers[type] = fn; }

  _dispatch(msg, fromId) {
    const h = this.handlers[msg.t];
    if (h) h(msg.d, fromId);
  }

  // Host: claim a code, listen for joiners.
  host() {
    return new Promise((resolve, reject) => {
      this.isHost = true;
      const tryClaim = (attempt = 0) => {
        const code = makeCode();
        const peer = new Peer(codeToId(code), { debug: 1 });
        peer.on("open", () => {
          this.peer = peer; this.code = code;
          peer.on("connection", (conn) => this._addConn(conn));
          resolve(code);
        });
        peer.on("error", (err) => {
          if (err.type === "unavailable-id" && attempt < 5) { peer.destroy(); tryClaim(attempt + 1); }
          else reject(err);
        });
      };
      tryClaim();
    });
  }

  // Client: connect to a host code.
  join(code) {
    return new Promise((resolve, reject) => {
      this.isHost = false;
      const peer = new Peer(undefined, { debug: 1 });
      peer.on("open", () => {
        this.peer = peer; this.code = code;
        const conn = peer.connect(codeToId(code), { reliable: true });
        const timeout = setTimeout(() => reject(new Error("Host not found or not responding.")), 12000);
        conn.on("open", () => { clearTimeout(timeout); this._addConn(conn); resolve(conn); });
        conn.on("error", (e) => { clearTimeout(timeout); reject(e); });
      });
      peer.on("error", (e) => reject(e));
    });
  }

  _addConn(conn) {
    this.conns.set(conn.peer, conn);
    conn.on("data", (msg) => {
      // Host relays peer messages to everyone else (star -> mesh emulation)
      if (this.isHost && msg.relay) this._relay(msg, conn.peer);
      this._dispatch(msg, conn.peer);
    });
    conn.on("close", () => { this.conns.delete(conn.peer); this.onPeerChange(); });
    this.onPeerChange();
  }

  _relay(msg, except) {
    for (const [id, conn] of this.conns) if (id !== except && conn.open) conn.send(msg);
  }

  // Send to all peers (and, if client, ask host to relay).
  send(type, data) {
    const msg = { t: type, d: data, relay: !this.isHost };
    for (const conn of this.conns.values()) if (conn.open) conn.send(msg);
  }

  peerCount() { return this.conns.size; }
  isConnected() { return this.conns.size > 0; }
}

export async function makeQR(canvas, text) {
  try {
    await QRCode.toCanvas(canvas, text, { width: 160, margin: 1, color: { dark: "#0c1018", light: "#ffffff" } });
  } catch (e) { console.warn("QR failed", e); }
}

export function inviteLink(code) {
  const u = new URL(location.href);
  u.searchParams.set("join", code);
  u.hash = "";
  return u.toString();
}

export { makeCode };
