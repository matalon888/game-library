import { audioManager } from '../../audio/index.js';

export const DRAGONS_SPRITE_URLS = Object.freeze({
  castle: new URL('../../assets/minigames/dragons/castle.webp', import.meta.url).href,
  dragons: Object.freeze([
    new URL('../../assets/minigames/dragons/dragon-1.webp', import.meta.url).href,
    new URL('../../assets/minigames/dragons/dragon-2.webp', import.meta.url).href,
    new URL('../../assets/minigames/dragons/dragon-3.webp', import.meta.url).href,
  ]),
});

const EMPTY_SPRITE_SET = Object.freeze({
  castle: null,
  dragons: Object.freeze([null, null, null]),
});

const DRAGON_VISUAL_WIDTH_RATIO = 0.995;
const DRAGON_VISUAL_HEIGHT_RATIO = 0.94;

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

export function preloadDragonsSprites() {
  if (sharedSpritePromise) return sharedSpritePromise;
  if (typeof globalThis.Image !== 'function') return Promise.resolve(EMPTY_SPRITE_SET);

  const urls = [DRAGONS_SPRITE_URLS.castle, ...DRAGONS_SPRITE_URLS.dragons];
  sharedSpritePromise = Promise.allSettled(urls.map(loadSprite)).then((results) => Object.freeze({
    castle: results[0].status === 'fulfilled' ? results[0].value : null,
    dragons: Object.freeze(results.slice(1).map(result => (
      result.status === 'fulfilled' ? result.value : null
    ))),
  }));
  return sharedSpritePromise;
}

if (typeof globalThis.Image === 'function') {
  void preloadDragonsSprites();
}

const DURATION = 20;
const META = 15;
const DEFENSE_MAX = 3;
const DRAGON_HITBOX_RATIO = 0.7;
const CASTLE_W_RATIO = 0.2;
const CASTLE_H_RATIO = 0.18;
const CASTLE_MARGIN_BOTTOM = 10;
const EFFECT_DURATION = 300;
const SCORE_FLOAT_DURATION = 600;
const COUNTDOWN_STEP_MS = 1000;
const COUNTDOWN_STEPS = 4;

const TIERS = [
  { after: 0,  maxSimultaneous: 2, spawnInterval: 1.5, speed: 80 },
  { after: 5,  maxSimultaneous: 3, spawnInterval: 1.2, speed: 100 },
  { after: 10, maxSimultaneous: 4, spawnInterval: 0.9, speed: 120 },
  { after: 15, maxSimultaneous: 5, spawnInterval: 0.7, speed: 140 },
];

export class AtaqueDragoesGame {
  constructor(container, onComplete, options = {}) {
    this.container = container;
    this.onComplete = onComplete;
    this.mode = options.mode === 'arcade' ? 'arcade' : 'board';
    this.params = this.mode === 'arcade' ? (options.params || null) : null;

    this.canvas = null;
    this.ctx = null;
    this.rafId = null;
    this.running = false;
    this.state = 'IDLE';
    this._completed = false;

    this.width = 0;
    this.height = 0;

    this.timeLeft = DURATION;
    this.elapsed = 0;
    this.lastSpawn = 0;

    this.dragons = [];
    this.nextDragonId = 1;

    this.hits = 0;
    this.score = 0;
    this._scoreAccumulator = 0;
    this.lost = 0;
    this.defense = DEFENSE_MAX;

    this.effects = [];
    this.floats = [];

    this.castleX = 0;
    this.castleY = 0;
    this.castleW = 0;
    this.castleH = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.dragonSize = 36;

    this.interactionLocked = false;

    this.countdownElapsed = 0;
    this.countdownStep = 0;

    this.debugMode = /[?&]debug=1/.test(location.search);

    this._resizeObserver = null;
    this._destroyed = false;
    this._sprites = EMPTY_SPRITE_SET;
    this._visualVariantCursor = 0;

    this._onPointerDown = this._onPointerDown.bind(this);
    this._onTouchStart = this._onTouchStart.bind(this);
    this._loop = this._loop.bind(this);
  }

  async start() {
    this._destroyed = false;
    this.state = 'COUNTDOWN';
    this.running = false;
    this._completed = false;
    this.timeLeft = DURATION;
    this.elapsed = 0;
    this.lastSpawn = 0;
    this.dragons = [];
    this.nextDragonId = 1;
    this.hits = 0;
    this.score = 0;
    this._scoreAccumulator = 0;
    this.lost = 0;
    this.defense = DEFENSE_MAX;
    this.effects = [];
    this.floats = [];
    this.countdownElapsed = 0;
    this.countdownStep = 0;
    this.interactionLocked = false;
    this._lastTime = null;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'ataque-dragoes-canvas';
    this.container.appendChild(this.canvas);

    this._resize();

    const sprites = await preloadDragonsSprites();
    if (this._destroyed || !this.canvas || this.state !== 'COUNTDOWN') return;
    this._sprites = sprites;
    this.running = true;

    this._resizeObserver = new ResizeObserver(() => this._resize());
    this._resizeObserver.observe(this.container);

    document.addEventListener('pointerdown', this._onPointerDown);
    document.addEventListener('touchstart', this._onTouchStart, { passive: false });

    this._loop(performance.now());
  }

  stop() {
    this._destroyed = true;
    this.state = 'IDLE';
    this.running = false;
    this._completed = true;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this._cleanup();
  }

  destroy() {
    this.stop();
  }

  startBotPreview() {
    this.interactionLocked = true;
  }

  stopBotPreview() {
    this.interactionLocked = false;
  }

  _resize() {
    const rect = this.container.getBoundingClientRect();
    this.width = rect.width || 600;
    this.height = rect.height || 400;

    if (this.canvas) {
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = this.width * dpr;
      this.canvas.height = this.height * dpr;
      this.canvas.style.width = this.width + 'px';
      this.canvas.style.height = this.height + 'px';
      this.ctx = this.canvas.getContext('2d');
      this.ctx.scale(dpr, dpr);
    }

    this.castleW = this.width * CASTLE_W_RATIO;
    this.castleH = this.height * CASTLE_H_RATIO;
    this.castleX = (this.width - this.castleW) / 2;
    this.castleY = this.height - this.castleH - CASTLE_MARGIN_BOTTOM;
    this.targetX = this.width / 2;
    this.targetY = this.castleY;

    this.dragonSize = Math.max(28, Math.min(48, this.width * 0.06));
  }

  _getTier() {
    if (this.mode === 'arcade') {
      const stages = this.params?.difficulty?.stages;
      if (Array.isArray(stages) && stages.length > 0) {
        return stages.find(stage => stage.until == null || this.elapsed < stage.until) || stages[stages.length - 1];
      }
    }
    for (let i = TIERS.length - 1; i >= 0; i--) {
      if (this.elapsed >= TIERS[i].after) return TIERS[i];
    }
    return TIERS[0];
  }

  _spawnDragon() {
    const tier = this._getTier();
    if (this.dragons.length >= tier.maxSimultaneous) return;

    const size = this.dragonSize;
    const margin = size * 2;

    const spawns = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      spawns.push({
        x: margin + Math.random() * (this.width - margin * 2),
        y: -size,
      });
    }
    spawns.push({ x: -size, y: margin + Math.random() * (this.height * 0.5) });
    spawns.push({ x: this.width + size, y: margin + Math.random() * (this.height * 0.5) });

    const spawn = spawns[Math.floor(Math.random() * spawns.length)];

    const castleExclR = Math.max(this.castleW, this.castleH) * 0.8;
    const cdx = spawn.x - this.targetX;
    const cdy = spawn.y - this.targetY;
    if (Math.sqrt(cdx * cdx + cdy * cdy) < castleExclR) return;

    for (const d of this.dragons) {
      const ddx = spawn.x - d.x;
      const ddy = spawn.y - d.y;
      if (Math.sqrt(ddx * ddx + ddy * ddy) < size * 2.5) return;
    }

    const tdx = this.targetX - spawn.x;
    const tdy = this.targetY - spawn.y;
    const dist = Math.sqrt(tdx * tdx + tdy * tdy);
    if (dist < 1) return;
    const speed = tier.speed * (this.width / 600);

    const wobble = Math.random() * Math.PI * 2;
    const visualVariant = this._selectVisualVariant();

    this.dragons.push({
      id: this.nextDragonId++,
      x: spawn.x,
      y: spawn.y,
      size: size,
      vx: (tdx / dist) * speed,
      vy: (tdy / dist) * speed,
      active: true,
      wobble,
      visualVariant,
    });
  }

  _selectVisualVariant() {
    const cryptoApi = globalThis.crypto;
    if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
      try {
        const value = new Uint32Array(1);
        cryptoApi.getRandomValues(value);
        return value[0] % DRAGONS_SPRITE_URLS.dragons.length;
      } catch {
        // Fall through to the deterministic visual-only sequence.
      }
    }

    const variant = this._visualVariantCursor;
    this._visualVariantCursor = (variant + 1) % DRAGONS_SPRITE_URLS.dragons.length;
    return variant;
  }

  _onPointerDown(e) {
    if (this.interactionLocked) return;
    if (this.state !== 'PLAYING') return;
    if (!this.canvas) return;
    if (e.pointerType === 'touch') return;
    if (!this.canvas.contains(e.target)) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this._tryHit(x, y);
  }

  _onTouchStart(e) {
    if (this.interactionLocked) return;
    if (this.state !== 'PLAYING') return;
    if (!this.canvas) return;
    if (!this.canvas.contains(e.target)) return;

    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    this._tryHit(x, y);
  }

  _tryHit(x, y) {
    for (let i = this.dragons.length - 1; i >= 0; i--) {
      const d = this.dragons[i];
      if (!d.active) continue;

      const hitR = d.size * DRAGON_HITBOX_RATIO;
      const dx = x - d.x;
      const dy = y - d.y;

      if (dx * dx + dy * dy <= hitR * hitR) {
        d.active = false;
        this.hits++;
        audioManager.play('dragonsHit');
        if (this.mode === 'arcade') {
          this.score += Number(this.params?.score?.perHit) || 0;
        }

        this.effects.push({
          x: d.x, y: d.y,
          timer: EFFECT_DURATION, maxTimer: EFFECT_DURATION,
          type: 'hit',
        });
        this.floats.push({
          x: d.x, y: d.y,
          timer: SCORE_FLOAT_DURATION, maxTimer: SCORE_FLOAT_DURATION,
          text: '+1',
        });

        return;
      }
    }
  }

  _update(dt) {
    if (this.state === 'COUNTDOWN') {
      this.countdownElapsed += dt * 1000;
      if (this.countdownElapsed >= COUNTDOWN_STEP_MS) {
        this.countdownElapsed -= COUNTDOWN_STEP_MS;
        this.countdownStep++;
        if (this.countdownStep >= COUNTDOWN_STEPS) {
          this.state = 'PLAYING';
          this._lastTime = performance.now();
          this.lastSpawn = performance.now();
        }
      }
      return;
    }

    if (this.state !== 'PLAYING') return;
    if (this.interactionLocked) return;

    this.elapsed += dt;

    if (this.mode === 'arcade') {
      this._scoreAccumulator += (Number(this.params?.score?.perSecond) || 0) * dt;
      const whole = Math.floor(this._scoreAccumulator);
      if (whole > 0) {
        this.score += whole;
        this._scoreAccumulator -= whole;
      }
    } else {
      this.timeLeft -= dt;
    }

    if (this.mode !== 'arcade' && this.timeLeft <= 0) {
      this.timeLeft = 0;
      const venceu = this.hits >= META;
      this._complete({
        venceu,
        boardDelta: venceu ? 3 : 0,
        progresso: { atual: this.hits, objetivo: META },
        motivo: venceu ? 'meta-atingida' : 'meta-nao-atingida',
        stats: {
          acertos: this.hits,
          perdidos: this.lost,
          defesaRestante: this.defense,
          meta: META,
          duracao: DURATION,
        },
      });
      return;
    }

    const tier = this._getTier();
    const now = performance.now();
    if (now - this.lastSpawn > tier.spawnInterval * 1000) {
      this._spawnDragon();
      this.lastSpawn = now;
    }

    for (let i = this.dragons.length - 1; i >= 0; i--) {
      const d = this.dragons[i];
      if (!d.active) {
        this.dragons.splice(i, 1);
        continue;
      }

      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.wobble += dt * 3;

      const ddx = d.x - this.targetX;
      const ddy = d.y - this.targetY;
      if (Math.sqrt(ddx * ddx + ddy * ddy) < this.dragonSize * 1.5) {
        d.active = false;
        this.lost++;
        if (this.defense > 0) {
          this.defense--;
          audioManager.play('dragonsShieldHit');
        }
        this.effects.push({
          x: d.x, y: d.y,
          timer: EFFECT_DURATION, maxTimer: EFFECT_DURATION,
          type: 'miss',
        });
        this.floats.push({
          x: d.x, y: d.y,
          timer: SCORE_FLOAT_DURATION, maxTimer: SCORE_FLOAT_DURATION,
          text: '-1',
          color: '#ff4444',
        });
        if (this.mode === 'arcade' && this.defense <= 0) {
          this._complete({
            venceu: false,
            boardDelta: 0,
            progresso: { atual: 0, objetivo: 1 },
            motivo: 'defesa-destruida',
            stats: {
              pontuacao: this.score,
              tempo: Math.round(this.elapsed),
              acertos: this.hits
            }
          });
          return;
        }
      }

      if (d.x < -100 || d.x > this.width + 100 || d.y < -100 || d.y > this.height + 100) {
        d.active = false;
      }
    }

    for (let i = this.effects.length - 1; i >= 0; i--) {
      this.effects[i].timer -= dt * 1000;
      if (this.effects[i].timer <= 0) this.effects.splice(i, 1);
    }
    for (let i = this.floats.length - 1; i >= 0; i--) {
      this.floats[i].timer -= dt * 1000;
      if (this.floats[i].timer <= 0) this.floats.splice(i, 1);
    }
  }

  _draw() {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = performance.now();

    this._drawBackground(ctx, now);
    this._drawCastle(ctx, now);
    this._drawDragons(ctx, now);
    this._drawEffects(ctx);
    this._drawFloats(ctx);
    this._drawHUD(ctx);

    if (this.state === 'COUNTDOWN') {
      this._drawCountdown(ctx);
    }

    if (this.debugMode) {
      this._drawDebugInfo(ctx);
    }
  }

  _drawBackground(ctx, now) {
    const grad = ctx.createLinearGradient(0, 0, 0, this.height);
    grad.addColorStop(0, '#1a0033');
    grad.addColorStop(0.5, '#2d004d');
    grad.addColorStop(1, '#1a0033');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 40; i++) {
      const sx = ((i * 137.5) % this.width);
      const sy = ((i * 97.3) % (this.height * 0.7));
      const sr = 0.5 + (i % 3) * 0.5;
      const alpha = 0.3 + Math.sin(now * 0.001 + i) * 0.2;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _drawCastle(ctx, now) {
    if (this._sprites.castle) {
      const bounds = this._getCastleVisualBounds();
      const image = this._sprites.castle;
      const scale = Math.min(bounds.w / image.naturalWidth, bounds.h / image.naturalHeight);
      const drawW = image.naturalWidth * scale;
      const drawH = image.naturalHeight * scale;
      const drawX = bounds.x + (bounds.w - drawW) / 2;
      const drawY = bounds.y + (bounds.h - drawH) / 2;
      ctx.drawImage(image, drawX, drawY, drawW, drawH);
      this._drawCastleCrystal(ctx, now);
      return;
    }

    this._drawCastleFallback(ctx, now);
  }

  _getCastleVisualBounds() {
    const x = this.castleX;
    const y = this.castleY;
    const w = this.castleW;
    const h = this.castleH;
    const towerW = w * 0.22;
    const crenSize = towerW * 0.35;
    const topOverflow = crenSize * 0.4;
    const rightOverflow = Math.max(0, -towerW + crenSize * 1.3 * 2 + crenSize);

    return {
      x,
      y: y - topOverflow,
      w: w + rightOverflow,
      h: h + topOverflow,
    };
  }

  _drawCastleFallback(ctx, now) {
    const x = this.castleX;
    const y = this.castleY;
    const w = this.castleW;
    const h = this.castleH;

    const towerW = w * 0.22;
    const wallH = h * 0.65;
    const wallY = y + h - wallH;

    ctx.fillStyle = '#5a5a8a';
    ctx.fillRect(x, y, towerW, h);
    ctx.fillRect(x + w - towerW, y, towerW, h);

    ctx.fillStyle = '#4a4a7a';
    ctx.fillRect(x + towerW, wallY, w - towerW * 2, wallH);

    const crenSize = towerW * 0.35;
    ctx.fillStyle = '#5a5a8a';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(x + i * crenSize * 1.3, y - crenSize * 0.4, crenSize, crenSize * 0.4);
      ctx.fillRect(x + w - towerW + i * crenSize * 1.3, y - crenSize * 0.4, crenSize, crenSize * 0.4);
    }

    const gateW = w * 0.18;
    const gateH = wallH * 0.5;
    const gateX = x + (w - gateW) / 2;
    const gateTopY = y + h - gateH;

    ctx.fillStyle = '#1a1a2a';
    ctx.beginPath();
    ctx.moveTo(gateX, y + h);
    ctx.lineTo(gateX, gateTopY + gateW / 2);
    ctx.arc(gateX + gateW / 2, gateTopY + gateW / 2, gateW / 2, Math.PI, 0);
    ctx.lineTo(gateX + gateW, y + h);
    ctx.closePath();
    ctx.fill();

    this._drawCastleCrystal(ctx, now);
  }

  _drawCastleCrystal(ctx, now) {
    const x = this.castleX;
    const y = this.castleY;
    const w = this.castleW;
    const h = this.castleH;
    const crystalY = y + h * 0.15;
    const crystalR = w * 0.04;
    ctx.fillStyle = '#ffd700';
    ctx.globalAlpha = 0.6 + Math.sin(now * 0.003) * 0.3;
    ctx.beginPath();
    ctx.arc(x + w / 2, crystalY, crystalR, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.15 + Math.sin(now * 0.003) * 0.1;
    ctx.beginPath();
    ctx.arc(x + w / 2, crystalY, crystalR * 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  _drawDragons(ctx, now) {
    for (const d of this.dragons) {
      if (!d.active) continue;
      this._drawDragon(ctx, d, now);
    }
  }

  _drawDragon(ctx, d, now) {
    const s = d.size;
    const angle = Math.atan2(this.targetY - d.y, this.targetX - d.x);
    const wobble = Math.sin(d.wobble) * 2;

    ctx.save();
    ctx.translate(d.x, d.y + wobble);
    ctx.rotate(angle);

    const sprite = this._sprites.dragons[d.visualVariant];
    if (sprite) {
      const drawW = s * DRAGON_VISUAL_WIDTH_RATIO;
      const drawH = s * DRAGON_VISUAL_HEIGHT_RATIO;
      ctx.drawImage(sprite, -drawW / 2, -drawH / 2, drawW, drawH);
    } else {
      this._drawDragonFallback(ctx, d, wobble);
    }

    ctx.restore();
  }

  _drawDragonFallback(ctx, d, wobble) {
    const s = d.size;
    ctx.fillStyle = '#2d5a27';
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.4, s * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    const wingFlap = Math.sin(d.wobble * 2.5) * s * 0.12;
    ctx.fillStyle = '#4a8a3f';

    ctx.beginPath();
    ctx.moveTo(-s * 0.05, -s * 0.1);
    ctx.lineTo(-s * 0.18, -s * 0.35 - wingFlap);
    ctx.lineTo(s * 0.12, -s * 0.12);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-s * 0.05, s * 0.1);
    ctx.lineTo(-s * 0.18, s * 0.35 + wingFlap);
    ctx.lineTo(s * 0.12, s * 0.12);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#2d5a27';
    ctx.beginPath();
    ctx.arc(s * 0.35, 0, s * 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ff3333';
    ctx.beginPath();
    ctx.arc(s * 0.38, -s * 0.02, s * 0.03, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#3a7a32';
    ctx.lineWidth = s * 0.05;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.35, 0);
    ctx.quadraticCurveTo(-s * 0.5, -s * 0.04 + wobble * 0.3, -s * 0.52, s * 0.06);
    ctx.stroke();
  }

  _drawEffects(ctx) {
    for (const e of this.effects) {
      const progress = 1 - e.timer / e.maxTimer;
      const alpha = 1 - progress;
      const radius = e.type === 'hit'
        ? this.dragonSize * (0.5 + progress * 1.0)
        : this.dragonSize * (0.3 + progress * 0.6);

      ctx.globalAlpha = alpha * 0.7;
      ctx.fillStyle = e.type === 'hit' ? '#ffd700' : '#ff4444';
      ctx.beginPath();
      ctx.arc(e.x, e.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  _drawFloats(ctx) {
    for (const f of this.floats) {
      const progress = 1 - f.timer / f.maxTimer;
      const y = f.y - progress * 30;
      ctx.globalAlpha = 1 - progress;
      ctx.fillStyle = f.color || '#ffd700';
      ctx.font = `bold ${Math.round(this.dragonSize * 0.45)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, y);
      ctx.globalAlpha = 1;
    }
  }

  _drawHUD(ctx) {
    const hudSize = Math.max(12, Math.round(this.width * 0.032));
    const pad = Math.max(8, this.width * 0.025);

    ctx.fillStyle = '#ffd700';
    ctx.font = `bold ${hudSize}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(this.mode === 'arcade' ? `\u2B50 ${this.score}` : `\uD83D\uDC09 ${this.hits}/${META}`, pad, hudSize + pad);

    ctx.textAlign = 'right';
    ctx.fillStyle = this.mode === 'arcade' ? '#ffffff' : (this.timeLeft < 5 ? '#ff4444' : '#ffffff');
    ctx.font = `bold ${Math.round(hudSize * 1.2)}px monospace`;
    if (this.mode === 'arcade') {
      const tier = this._getTier();
      ctx.fillText(`${tier.name || 'Inicial'} \u00B7 ${Math.ceil(this.elapsed)}s`, this.width - pad, hudSize + pad);
    } else {
      ctx.fillText(Math.ceil(this.timeLeft) + 's', this.width - pad, hudSize + pad);
    }

    ctx.textAlign = 'left';
    ctx.font = `${hudSize}px sans-serif`;
    ctx.fillStyle = '#ffffff';
    let defenseStr = '';
    for (let i = 0; i < DEFENSE_MAX; i++) {
      defenseStr += i < this.defense ? '\uD83D\uDEE1\uFE0F' : '\u2764\uFE0F';
    }
    ctx.fillText(defenseStr, pad, hudSize * 2 + pad * 1.5);
  }

  _drawCountdown(ctx) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, this.width, this.height);

    let text;
    if (this.countdownStep < 3) {
      text = String(3 - this.countdownStep);
    } else {
      text = 'Come\u00E7ar!';
    }

    const size = Math.round(this.width * 0.15);
    ctx.fillStyle = '#ffd700';
    ctx.font = `bold ${size}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, this.width / 2, this.height / 2);
    ctx.textBaseline = 'alphabetic';
  }

  _drawDebugInfo(ctx) {
    ctx.fillStyle = '#88ff88';
    ctx.font = `${Math.max(9, Math.round(this.width * 0.022))}px monospace`;
    ctx.textAlign = 'left';
    ctx.fillText(
      `DEBUG | Dragons: ${this.dragons.length} | Elapsed: ${this.elapsed.toFixed(1)}s | Hits: ${this.hits} | Lost: ${this.lost} | Defense: ${this.defense}`,
      6, this.height - 8
    );
    for (const d of this.dragons) {
      if (!d.active) continue;
      const hitR = d.size * DRAGON_HITBOX_RATIO;
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(d.x, d.y, hitR, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  _loop(timestamp) {
    const isTerminal = this.state === 'COMPLETE';

    if (!isTerminal && !this.running) {
      if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
      return;
    }

    if (!isTerminal && !this._completed) {
      if (!this._lastTime) { this._lastTime = timestamp; }
      const dt = Math.min((timestamp - this._lastTime) / 1000, 0.05);
      this._lastTime = timestamp;
      this._update(dt);
    }

    if (!this._completed) {
      this._draw();
      this.rafId = requestAnimationFrame(this._loop);
    }
  }

  _cleanup() {
    document.removeEventListener('pointerdown', this._onPointerDown);
    document.removeEventListener('touchstart', this._onTouchStart);
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
    this.dragons = [];
    this.effects = [];
    this.floats = [];
  }

  _complete(result) {
    if (this._completed) return;
    this._completed = true;
    this.state = 'COMPLETE';
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this._cleanup();
    if (typeof this.onComplete === 'function') {
      this.onComplete(result);
    }
  }
}
