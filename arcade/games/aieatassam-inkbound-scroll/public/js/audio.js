// Ambient sound for the scroll — Web Audio wrapper.
// Sources are CC0 recordings from freesound.org (see README attribution).
// All playback goes through a master gain so mute is instant and pop-free.

const FILES = {
  pen: "audio/pen-writing.mp3",       // long take, looped while text appears
  brush: "audio/brush-stroke.mp3",    // single stroke, retriggered per gesture
  unroll: "audio/scroll-unroll.mp3",  // played once when the scroll opens
  paint: "audio/scene-paint.mp3",     // wet brush, looped while a scene paints
};

const MUTE_KEY = "inkbound-muted";

class ScrollAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.buffers = {};
    this.penNode = null;   // {src, gain}
    this.brushNode = null; // {src, gain}
    this.paintNode = null; // {src, gain}
    this._paintTimer = null;
    this.muted = localStorage.getItem(MUTE_KEY) === "1";
    this._loading = null;
  }

  // Must be called from a user gesture (autoplay policy).
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
      this._loading = this._loadAll();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  async _loadAll() {
    await Promise.all(
      Object.entries(FILES).map(async ([name, url]) => {
        try {
          const res = await fetch(url);
          const buf = await res.arrayBuffer();
          this.buffers[name] = await this.ctx.decodeAudioData(buf);
        } catch {
          /* missing file = silent game, never an error */
        }
      })
    );
  }

  setMuted(m) {
    this.muted = m;
    localStorage.setItem(MUTE_KEY, m ? "1" : "0");
    if (this.master) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.linearRampToValueAtTime(m ? 0 : 1, t + 0.15);
    }
  }

  _play(name, { gain = 1, rate = 1, loop = false, offset = 0, fadeIn = 0 } = {}) {
    if (!this.ctx || !this.buffers[name]) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers[name];
    src.loop = loop;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    if (fadeIn > 0) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(gain, t + fadeIn);
    } else {
      g.gain.value = gain;
    }
    src.connect(g).connect(this.master);
    src.start(t, offset);
    return { src, gain: g };
  }

  _fadeStop(node, fade = 0.25) {
    if (!node || !this.ctx) return;
    const t = this.ctx.currentTime;
    node.gain.gain.cancelScheduledValues(t);
    node.gain.gain.setValueAtTime(node.gain.gain.value, t);
    node.gain.gain.linearRampToValueAtTime(0.0001, t + fade);
    node.src.stop(t + fade + 0.05);
  }

  // ── the three voices ──

  /** Heavy paper unfurling — once, when the scroll opens. */
  unroll() {
    if (!this.ensure()) return;
    const go = () => this._play("unroll", { gain: 0.9 });
    this.buffers.unroll ? go() : this._loading?.then(go);
  }

  /** Nib scratch loop while the ink spirit writes. */
  penStart() {
    if (!this.ensure() || this.penNode) return;
    const go = () => {
      if (this.penNode || !this.buffers.pen) return;
      const dur = this.buffers.pen.duration;
      this.penNode = this._play("pen", {
        gain: 0.55,
        loop: true,
        offset: Math.random() * Math.max(0, dur - 8),
        fadeIn: 0.4,
      });
    };
    this.buffers.pen ? go() : this._loading?.then(go);
  }

  penStop() {
    this._fadeStop(this.penNode, 0.5);
    this.penNode = null;
  }

  /** Bristle drag while the player's brush is down. */
  brushStart() {
    if (!this.ensure()) return;
    if (this.brushNode) this._fadeStop(this.brushNode, 0.05);
    if (!this.buffers.brush) return;
    this.brushNode = this._play("brush", {
      gain: 0.7,
      rate: 0.85 + Math.random() * 0.4, // every stroke sounds a little different
      loop: true,
      fadeIn: 0.03,
    });
  }

  brushStop() {
    this._fadeStop(this.brushNode, 0.12);
    this.brushNode = null;
  }

  /** Wet brush on paper while the spirit paints a scene; stops itself. */
  scenePaint(durationMs) {
    if (!this.ensure() || !durationMs) return;
    const go = () => {
      if (!this.buffers.paint) return;
      this.paintStop();
      const dur = this.buffers.paint.duration;
      this.paintNode = this._play("paint", {
        gain: 0.5,
        loop: true,
        offset: Math.random() * Math.max(0, dur - 6),
        fadeIn: 0.35,
      });
      this._paintTimer = setTimeout(() => this.paintStop(), durationMs);
    };
    this.buffers.paint ? go() : this._loading?.then(go);
  }

  paintStop() {
    clearTimeout(this._paintTimer);
    this._paintTimer = null;
    this._fadeStop(this.paintNode, 0.6);
    this.paintNode = null;
  }
}

export const audio = new ScrollAudio();
