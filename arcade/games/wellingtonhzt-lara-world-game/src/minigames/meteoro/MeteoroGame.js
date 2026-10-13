import { audioManager } from '../../audio/index.js';

export const METEOR_SPRITE_URLS = Object.freeze({
  ship: new URL('../../assets/minigames/meteoro/ship.webp', import.meta.url).href,
  meteors: Object.freeze([
    new URL('../../assets/minigames/meteoro/meteor-1.webp', import.meta.url).href,
    new URL('../../assets/minigames/meteoro/meteor-2.webp', import.meta.url).href,
    new URL('../../assets/minigames/meteoro/meteor-3.webp', import.meta.url).href,
  ]),
});

const EMPTY_SPRITE_SET = Object.freeze({
  ship: null,
  meteors: Object.freeze([null, null, null]),
});

let sharedSpritePromise = null;

function loadSprite(url) {
  return new Promise((resolve) => {
    const image = new globalThis.Image();
    image.decoding = 'async';
    image.onload = () => {
      const valid = image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
      resolve(valid ? image : null);
    };
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

export function preloadMeteorSprites() {
  if (sharedSpritePromise) return sharedSpritePromise;
  if (typeof globalThis.Image !== 'function') return Promise.resolve(EMPTY_SPRITE_SET);

  const urls = [METEOR_SPRITE_URLS.ship, ...METEOR_SPRITE_URLS.meteors];
  sharedSpritePromise = Promise.allSettled(urls.map(loadSprite)).then((results) => Object.freeze({
    ship: results[0].status === 'fulfilled' ? results[0].value : null,
    meteors: Object.freeze(results.slice(1).map(result => (
      result.status === 'fulfilled' ? result.value : null
    ))),
  }));
  return sharedSpritePromise;
}

if (typeof globalThis.Image === 'function') {
  void preloadMeteorSprites();
}

export class MeteoroGame {
  constructor(container, onComplete, options = {}) {
    this.container = container;
    this.onComplete = onComplete;
    this.mode = options.mode === 'arcade' ? 'arcade' : 'board';
    this.params = options.mode === 'arcade' ? (options.params || null) : null;
    this.canvas = null;
    this.ctx = null;
    this.rafId = null;
    this.running = false;
    this.state = 'IDLE';

    this.ship = { x: 0, y: 0, width: 40, height: 32 };
    this.meteoros = [];
    this.stars = [];
    this.lives = 3;
    this.timeLeft = 20;
    this.lastSpawn = 0;
    this.score = 0;
    this.elapsed = 0;
    this.meteorosDesviados = 0;
    this._scoreAccumulator = 0;
    this._currentStage = null;
    this.width = 0;
    this.height = 0;
    this.keys = { left: false, right: false, up: false, down: false };
    this.touchX = null;
    this.touchY = null;
    this.touchActive = false;
    this._dragLastX = null;
    this._dragLastY = null;
    this.isMobile = window.innerWidth < 768;
    this.debugMode = /[?&]debug=1/.test(location.search);
    this.shipBottomMargin = this.isMobile ? 56 : 24;
    this.interactionLocked = false;
    this._botPreviewTimer = null;
    this._destroyed = false;
    this._sprites = EMPTY_SPRITE_SET;
    this._visualVariantCursor = 0;

    this.invulnerableUntil = 0;
    this.flashTimer = 0;
    this.lifeLostText = '';
    this.lifeLostTextTimer = 0;
    this.hitPauseTimer = 0;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchMove = this._onTouchMove.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._loop = this._loop.bind(this);
  }

  async start() {
    this._destroyed = false;
    this.state = 'PLAYING';
    this.lives = 3;
    this.timeLeft = 20;
    this.meteoros = [];
    this.hitPauseTimer = 0;
    this.invulnerableUntil = 0;
    this.flashTimer = 0;
    this.lifeLostText = '';
    this.lifeLostTextTimer = 0;
    this.elapsed = 0;
    this.score = 0;
    this.meteorosDesviados = 0;
    this._scoreAccumulator = 0;
    this._currentStage = null;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'meteoro-canvas';
    this.canvas.setAttribute('tabindex', '0');
    this.container.appendChild(this.canvas);

    this._resize();
    this._initStars();

    const sprites = await preloadMeteorSprites();
    if (this._destroyed || !this.canvas || this.state !== 'PLAYING') return;
    this._sprites = sprites;
    this.running = true;
    this.lastSpawn = performance.now();

    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('touchstart', this._onTouchStart, { passive: false });
    document.addEventListener('touchend', this._onTouchEnd, { passive: false });
    document.addEventListener('touchmove', this._onTouchMove, { passive: false });
    document.addEventListener('pointerdown', this._onPointerDown);
    document.addEventListener('pointermove', this._onPointerMove);
    document.addEventListener('pointerup', this._onPointerUp);

    this._loop(performance.now());
  }

  /* ── Bot preview (visual only, no model changes) ── */

  startBotPreview() {
    this.interactionLocked = true;
    if (!this.canvas || !this.ctx) return;
    const w = this.width;
    const h = this.height;
    const dirs = [
      { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 },
      { x: 0.7, y: -0.7 }, { x: -0.7, y: -0.7 }, { x: 0.7, y: 0.7 }, { x: -0.7, y: 0.7 },
    ];
    let dIdx = 0;
    let step = 0;
    const stepLimit = 30;
    const speed = w * 0.018;

    this._botPreviewTimer = setInterval(() => {
      if (!this.canvas || !this.ctx || !this.interactionLocked) return;
      const d = dirs[dIdx];
      this.ship.x += d.x * speed;
      this.ship.y += d.y * speed;
      const pad = Math.max(2, this.ship.width * 0.08);
      this.ship.x = Math.max(pad, Math.min(w - this.ship.width - pad, this.ship.x));
      this.ship.y = Math.max(pad, Math.min(h - this.ship.height - pad, this.ship.y));
      step++;
      if (step >= stepLimit) {
        step = 0;
        dIdx = (dIdx + 1) % dirs.length;
      }
    }, 50);
  }

  stopBotPreview() {
    this.interactionLocked = false;
    if (this._botPreviewTimer) {
      clearInterval(this._botPreviewTimer);
      this._botPreviewTimer = null;
    }
  }

  stop() {
    this._destroyed = true;
    this.stopBotPreview();
    this.state = 'IDLE';
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('touchstart', this._onTouchStart);
    document.removeEventListener('touchend', this._onTouchEnd);
    document.removeEventListener('touchmove', this._onTouchMove);
    document.removeEventListener('pointerdown', this._onPointerDown);
    document.removeEventListener('pointermove', this._onPointerMove);
    document.removeEventListener('pointerup', this._onPointerUp);
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
  }

  stopEarly() {
    if (this.state !== 'PLAYING') return;
    this._destroyed = true;
    this.state = 'FAIL';
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this._cleanup();
    if (this.mode === 'arcade') {
      this.onComplete(this._buildArcadeResult('interrompido'));
      return;
    }
    this.onComplete({ status: 'fail', bonus: 0, lives: this.lives, timeLeft: Math.ceil(this.timeLeft) });
  }

  _cleanup() {
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('touchstart', this._onTouchStart);
    document.removeEventListener('touchend', this._onTouchEnd);
    document.removeEventListener('touchmove', this._onTouchMove);
    document.removeEventListener('pointerdown', this._onPointerDown);
    document.removeEventListener('pointermove', this._onPointerMove);
    document.removeEventListener('pointerup', this._onPointerUp);
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
  }

  _resize() {
    const rect = this.container.getBoundingClientRect();
    this.width = rect.width || 600;
    this.height = rect.height || 400;
    if (this.canvas) {
      this.canvas.width = this.width;
      this.canvas.height = this.height;
      this.canvas.style.width = this.width + 'px';
      this.canvas.style.height = this.height + 'px';
      this.ctx = this.canvas.getContext('2d');
    }
    const shipW = this.isMobile
      ? Math.round(Math.min(this.width * 0.18, 80))
      : Math.max(28, Math.round(this.width * 0.068));
    const shipH = Math.round(shipW * 0.8);
    this.ship.width = shipW;
    this.ship.height = shipH;
    this.ship.x = this.width / 2 - shipW / 2;
    this.ship.y = this.height - shipH - this.shipBottomMargin;
  }

  _initStars() {
    this.stars = [];
    for (let i = 0; i < 60; i++) {
      this.stars.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        r: Math.random() * 1.8 + 0.4,
        a: Math.random() * 0.7 + 0.3,
        speed: Math.random() * 0.3 + 0.1,
      });
    }
  }

  _getArcadeStage() {
    if (!this.params || !this.params.difficulty || !Array.isArray(this.params.difficulty.stages)) {
      return null;
    }
    const stages = this.params.difficulty.stages;
    for (const stage of stages) {
      if (stage.until === null || stage.until === undefined || this.elapsed < stage.until) {
        return stage;
      }
    }
    return stages[stages.length - 1];
  }

  _accumulateScore(dt) {
    const perSecond = this.params && this.params.score ? (Number(this.params.score.perSecond) || 0) : 0;
    this._scoreAccumulator += perSecond * dt;
    const whole = Math.floor(this._scoreAccumulator);
    if (whole > 0) {
      this.score += whole;
      this._scoreAccumulator -= whole;
    }
  }

  _spawnMeteoro() {
    const stage = this.mode === 'arcade' ? this._getArcadeStage() : null;
    const speedMul = stage && stage.speed ? stage.speed : 1;
    const sizeMul = stage && stage.meteoroSize ? stage.meteoroSize : 1;
    const baseSize = Math.max(8, this.width * 0.025) * sizeMul;
    const size = Math.random() * baseSize * 1.5 + baseSize;
    const baseSpeed = (Math.random() * 1.8 + 1.2) * speedMul * (this.isMobile ? 0.82 : 1.0);
    const speed = baseSpeed * (400 / Math.max(this.height, 300));
    this.meteoros.push({
      x: Math.random() * (this.width - size * 2) + size,
      y: -size,
      size: size,
      speed: speed,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.05,
      visualVariant: this._selectVisualVariant(),
    });
  }

  _selectVisualVariant() {
    try {
      const cryptoApi = globalThis.crypto;
      if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
        const value = new Uint32Array(1);
        cryptoApi.getRandomValues(value);
        return value[0] % METEOR_SPRITE_URLS.meteors.length;
      }
    } catch {
      // A deterministic visual-only cycle is a safe fallback when Crypto is unavailable.
    }

    const variant = this._visualVariantCursor;
    this._visualVariantCursor = (variant + 1) % METEOR_SPRITE_URLS.meteors.length;
    return variant;
  }

  _onKeyDown(e) {
    if (this.interactionLocked) return;
    switch (e.key) {
      case 'ArrowLeft': case 'a': this.keys.left = true; e.preventDefault(); break;
      case 'ArrowRight': case 'd': this.keys.right = true; e.preventDefault(); break;
      case 'ArrowUp': case 'w': this.keys.up = true; e.preventDefault(); break;
      case 'ArrowDown': case 's': this.keys.down = true; e.preventDefault(); break;
    }
  }

  _onKeyUp(e) {
    switch (e.key) {
      case 'ArrowLeft': case 'a': this.keys.left = false; e.preventDefault(); break;
      case 'ArrowRight': case 'd': this.keys.right = false; e.preventDefault(); break;
      case 'ArrowUp': case 'w': this.keys.up = false; e.preventDefault(); break;
      case 'ArrowDown': case 's': this.keys.down = false; e.preventDefault(); break;
    }
  }

  _posFromEvent(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  _isTouchOnCanvas(e) {
    if (!this.canvas) return false;
    const rect = this.canvas.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    return (
      p.clientX >= rect.left &&
      p.clientX <= rect.right &&
      p.clientY >= rect.top &&
      p.clientY <= rect.bottom
    );
  }

  /* ── Mobile: relative drag (touch anywhere on canvas) ── */

  _onTouchStart(e) {
    if (this.interactionLocked) return;
    if (!this.canvas || this.state !== 'PLAYING') return;
    if (!this._isTouchOnCanvas(e)) return;
    e.preventDefault();
    const t = this._posFromEvent(e.touches[0]);
    this._dragLastX = t.x;
    this._dragLastY = t.y;
    this.touchActive = true;
  }

  _onTouchMove(e) {
    if (this.interactionLocked) return;
    if (!this.canvas || !this.touchActive || this.state !== 'PLAYING') return;
    if (!this._isTouchOnCanvas(e)) { this._cancelTouch(); return; }
    e.preventDefault();
    const t = this._posFromEvent(e.touches[0]);
    const deltaX = t.x - this._dragLastX;
    const deltaY = t.y - this._dragLastY;
    this.ship.x += deltaX;
    this.ship.y += deltaY;
    const pad = Math.max(2, this.ship.width * 0.08);
    this.ship.x = Math.max(pad, Math.min(this.width - this.ship.width - pad, this.ship.x));
    this.ship.y = Math.max(pad, Math.min(this.height - this.ship.height - pad, this.ship.y));
    this._dragLastX = t.x;
    this._dragLastY = t.y;
  }

  _onTouchEnd(e) {
    if (this.interactionLocked) return;
    if (!this.touchActive) return;
    if (!this._isTouchOnCanvas(e)) return;
    e.preventDefault();
    this._cancelTouch();
  }

  _cancelTouch() {
    this.touchActive = false;
    this._dragLastX = null;
    this._dragLastY = null;
  }

  /* ── Desktop pointer: quadrant-based + canvas guard ── */

  _onPointerDown(e) {
    if (this.interactionLocked) return;
    if (!this.canvas || e.pointerType === 'touch') return;
    if (!this._isTouchOnCanvas(e)) return;
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    const t = this._posFromEvent(e);
    this.touchX = t.x;
    this.touchY = t.y;
    this.touchActive = true;
  }

  _onPointerMove(e) {
    if (this.interactionLocked) return;
    if (!this.canvas || !this.touchActive || e.pointerType === 'touch') return;
    if (!this._isTouchOnCanvas(e)) { this._cancelPointer(); return; }
    e.preventDefault();
    const t = this._posFromEvent(e);
    this.touchX = t.x;
    this.touchY = t.y;
  }

  _onPointerUp(e) {
    if (!this.canvas || e.pointerType === 'touch') return;
    if (!this._isTouchOnCanvas(e)) return;
    e.preventDefault();
    this._cancelPointer();
  }

  _cancelPointer() {
    this.touchX = null;
    this.touchY = null;
    this.touchActive = false;
  }

  _update(dt) {
    if (this.state !== 'PLAYING') return;
    if (this.interactionLocked) return;

    this.elapsed += dt;
    if (this.mode === 'arcade') {
      this._accumulateScore(dt);
    }

    if (this.hitPauseTimer > 0) {
      this.hitPauseTimer -= dt * 1000;
      if (this.hitPauseTimer < 0) this.hitPauseTimer = 0;
      return;
    }

    const halfW = this.width / 2;
    const halfH = this.height / 2;

    if (this.touchActive && this.touchX !== null) {
      const shipSpeed = 260 * (this.width / 600);
      if (this.touchX < halfW) this.ship.x -= shipSpeed * dt;
      if (this.touchX >= halfW) this.ship.x += shipSpeed * dt;
      if (this.touchY !== null && this.touchY < halfH) this.ship.y -= shipSpeed * dt;
      if (this.touchY !== null && this.touchY >= halfH) this.ship.y += shipSpeed * dt;
    }

    if (this.keys.left) this.ship.x -= 260 * (this.width / 600) * dt;
    if (this.keys.right) this.ship.x += 260 * (this.width / 600) * dt;
    if (this.keys.up) this.ship.y -= 260 * (this.width / 600) * dt;
    if (this.keys.down) this.ship.y += 260 * (this.width / 600) * dt;

    const pad = Math.max(2, this.ship.width * 0.08);
    this.ship.x = Math.max(pad, Math.min(this.width - this.ship.width - pad, this.ship.x));
    this.ship.y = Math.max(pad, Math.min(this.height - this.ship.height - pad, this.ship.y));

    if (this.mode === 'arcade') {
      if (this.timeLeft <= 0) this.timeLeft = 0;
    } else {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this._end(true);
        return;
      }
    }

    const now = performance.now();
    if (this.mode === 'arcade') {
      const stage = this._getArcadeStage();
      this._currentStage = stage;
      const interval = stage && stage.spawnInterval ? stage.spawnInterval : 0.7;
      const extraChance = stage && typeof stage.spawnExtraChance === 'number' ? stage.spawnExtraChance : 0.3;
      if (now - this.lastSpawn > interval * 1000) {
        this._spawnMeteoro();
        this.lastSpawn = now;
        if (Math.random() < extraChance) {
          this._spawnMeteoro();
        }
      }
    } else if (now - this.lastSpawn > 700) {
      this._spawnMeteoro();
      this.lastSpawn = now;
      if (Math.random() < 0.3) {
        this._spawnMeteoro();
      }
    }

    for (let i = this.meteoros.length - 1; i >= 0; i--) {
      const m = this.meteoros[i];
      m.y += m.speed * 120 * dt;
      m.rotation += m.rotSpeed;
      if (m.y > this.height + m.size) {
        this.meteoros.splice(i, 1);
        if (this.mode === 'arcade') {
          this.meteorosDesviados++;
          const perMeteoro = this.params && this.params.score ? (Number(this.params.score.perMeteoro) || 0) : 0;
          this.score += perMeteoro;
        }
      }
    }

    if (this.invulnerableUntil > now) return;

    const hitboxInset = 0.1;
    const shipRect = {
      x: this.ship.x + this.ship.width * hitboxInset,
      y: this.ship.y + this.ship.height * hitboxInset,
      w: this.ship.width * (1 - hitboxInset * 2),
      h: this.ship.height * (1 - hitboxInset * 2),
    };

    for (let i = this.meteoros.length - 1; i >= 0; i--) {
      const m = this.meteoros[i];
      const meteorR = m.size * 0.5;
      if (
        m.x - meteorR < shipRect.x + shipRect.w &&
        m.x + meteorR > shipRect.x &&
        m.y - meteorR < shipRect.y + shipRect.h &&
        m.y + meteorR > shipRect.y
      ) {
        this.meteoros.splice(i, 1);
        this.lives--;
        audioManager.play('meteorHit');

        if (this.lives <= 0) {
          this._end(false);
          return;
        }

        this._removeNearbyMeteoros(shipRect);
        this.hitPauseTimer = 800;
        this.invulnerableUntil = performance.now() + 1000;
        this.flashTimer = 200;
        this.lifeLostText = '\uD83D\uDCA5 -1 Vida!';
        this.lifeLostTextTimer = 800;
        return;
      }
    }
  }

  _removeNearbyMeteoros(shipRect) {
    const clearZone = Math.max(60, this.width * 0.18);
    const cx = shipRect.x + shipRect.w / 2;
    const cy = shipRect.y + shipRect.h / 2;
    for (let i = this.meteoros.length - 1; i >= 0; i--) {
      const m = this.meteoros[i];
      const dx = m.x - cx;
      const dy = m.y - cy;
      if (Math.sqrt(dx * dx + dy * dy) < clearZone) {
        this.meteoros.splice(i, 1);
      }
    }
  }

  _buildArcadeResult(motivo) {
    return {
      venceu: false,
      boardDelta: 0,
      progresso: { atual: 0, objetivo: 1 },
      motivo,
      stats: {
        tempo: Math.round(this.elapsed),
        pontuacao: this.score,
        meteorosDesviados: this.meteorosDesviados
      }
    };
  }

  _end(success) {
    this.state = success ? 'SUCCESS' : 'FAIL';
    this.flashTimer = 0;
    this.lifeLostText = '';
    this.lifeLostTextTimer = 0;
    this._draw();
    if (this.mode === 'arcade') {
      this.onComplete(this._buildArcadeResult('sem-vidas'));
      return;
    }
    setTimeout(() => {
      this.onComplete({ status: success ? 'success' : 'fail', bonus: success ? 3 : 0, lives: this.lives, timeLeft: Math.ceil(this.timeLeft) });
    }, 1000);
  }

  _draw() {
    const ctx = this.ctx;
    if (!ctx) return;

    const now = performance.now();
    const isTerminal = this.state === 'SUCCESS' || this.state === 'FAIL';

    if (!isTerminal && this.flashTimer > 0) {
      ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
      ctx.fillRect(0, 0, this.width, this.height);
      this.flashTimer -= 16;
    }

    ctx.fillStyle = '#05051a';
    ctx.fillRect(0, 0, this.width, this.height);

    for (const s of this.stars) {
      ctx.globalAlpha = s.a + Math.sin(now * 0.001 * s.speed) * 0.15;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const m of this.meteoros) {
      this._drawMeteor(ctx, m);
    }

    ctx.save();
    if (!isTerminal && this.invulnerableUntil > now) {
      ctx.globalAlpha = 0.5 + Math.sin(now * 0.02) * 0.3;
    }
    this._drawShip(ctx);
    ctx.restore();
    ctx.globalAlpha = 1;

    if (this.debugMode) {
      const hi = 0.1;
      const sx = this.ship.x + this.ship.width * hi;
      const sy = this.ship.y + this.ship.height * hi;
      const sw = this.ship.width * (1 - hi * 2);
      const sh = this.ship.height * (1 - hi * 2);
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(sx, sy, sw, sh);
      for (const m of this.meteoros) {
        const mr = m.size * 0.5;
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
        ctx.beginPath();
        ctx.arc(m.x, m.y, mr, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    const hudSize = Math.max(12, Math.round(this.width * 0.032));
    const hudY = Math.max(18, Math.round(this.height * 0.05));
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${hudSize}px sans-serif`;
    ctx.textAlign = 'left';
    if (this.mode === 'arcade') {
      ctx.fillText(`\u2B50 ${this.score}`, Math.max(8, this.width * 0.025), hudY);
    } else {
      ctx.fillText('\u2764\uFE0F '.repeat(Math.max(0, this.lives)), Math.max(8, this.width * 0.025), hudY);
    }

    ctx.textAlign = 'right';
    if (this.mode === 'arcade') {
      const stage = this._currentStage;
      const seconds = Math.ceil(this.elapsed);
      ctx.fillText(`${stage ? stage.name : 'Inicial'}\u00B7 ${seconds}s`, this.width - Math.max(8, this.width * 0.025), hudY);
    } else {
      const timeColor = this.timeLeft < 5 ? '#ff4444' : '#ffffff';
      ctx.fillStyle = timeColor;
      ctx.font = `bold ${Math.round(hudSize * 1.2)}px monospace`;
      ctx.fillText(Math.ceil(this.timeLeft) + 's', this.width - Math.max(8, this.width * 0.025), hudY);
    }

    if (!isTerminal && this.lifeLostTextTimer > 0) {
      this.lifeLostTextTimer -= 16;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff4444';
      ctx.font = `bold ${Math.round(hudSize * 1.8)}px sans-serif`;
      ctx.fillText(this.lifeLostText, this.width / 2, this.height / 2 - this.height * 0.04);
    }

    if (this.debugMode) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#88ff88';
      ctx.font = `${Math.max(9, Math.round(this.width * 0.022))}px monospace`;
      ctx.fillText('DEBUG HITBOX', 6, this.height - 8);
    }
  }

  _drawMeteor(ctx, meteor) {
    ctx.save();
    ctx.translate(meteor.x, meteor.y);
    ctx.rotate(meteor.rotation);

    const sprite = this._sprites.meteors[meteor.visualVariant];
    if (sprite) {
      ctx.drawImage(
        sprite,
        -0.60 * meteor.size,
        -0.70 * meteor.size,
        1.20 * meteor.size,
        1.10 * meteor.size
      );
    } else {
      this._drawMeteorFallback(ctx, meteor);
    }

    ctx.restore();
  }

  _drawMeteorFallback(ctx, meteor) {
    const s = meteor.size;
    ctx.fillStyle = '#ff6b35';
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.7);
    ctx.lineTo(s * 0.6, s * 0.4);
    ctx.lineTo(0, s * 0.1);
    ctx.lineTo(-s * 0.6, s * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffaa44';
    ctx.beginPath();
    ctx.arc(0, -s * 0.1, s * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawShip(ctx) {
    if (this._sprites.ship) {
      ctx.drawImage(
        this._sprites.ship,
        this.ship.x,
        this.ship.y,
        this.ship.width,
        this.ship.height
      );
      return;
    }

    this._drawShipFallback(ctx);
  }

  _drawShipFallback(ctx) {
    ctx.translate(this.ship.x, this.ship.y);
    ctx.fillStyle = '#7c4dff';
    ctx.beginPath();
    ctx.moveTo(this.ship.width / 2, 0);
    ctx.lineTo(this.ship.width, this.ship.height);
    ctx.lineTo(this.ship.width * 0.7, this.ship.height * 0.75);
    ctx.lineTo(this.ship.width / 2, this.ship.height * 0.85);
    ctx.lineTo(this.ship.width * 0.3, this.ship.height * 0.75);
    ctx.lineTo(0, this.ship.height);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#b388ff';
    ctx.beginPath();
    ctx.arc(this.ship.width / 2, this.ship.height * 0.3, Math.max(4, this.ship.width * 0.12), 0, Math.PI * 2);
    ctx.fill();
  }

  _loop(timestamp) {
    const isTerminal = this.state === 'SUCCESS' || this.state === 'FAIL';

    if (!isTerminal && !this.running) {
      if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
      return;
    }

    if (!isTerminal) {
      if (!this._lastTime) { this._lastTime = timestamp; }
      const dt = Math.min((timestamp - this._lastTime) / 1000, 0.05);
      this._lastTime = timestamp;
      this._update(dt);
    }

    this._draw();
    this.rafId = requestAnimationFrame(this._loop);
  }

  destroy() {
    this.stop();
  }
}
