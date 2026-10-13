import { audioManager } from '../../audio/index.js';

const BONUS_THRESHOLD = 20;
const RUN_FRAME_DURATION_MS = 110;
const RUN_FRAME_COUNT = 4;
const MIN_SAFE_OBSTACLE_GAP = 180;
const CRITICAL_ZONE_DISTANCE = 160;
const BASE_RUNNING_SPEED = 180;
const CACTUS_WIDTH = 22;
const CACTUS_HEIGHT = 42;
const ROCK_WIDTH = 28;
const ROCK_HEIGHT = 32;

export class DinoRunnerGame {
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
    this._completed = false;

    this.dino = { x: 0, y: 0, w: 40, h: 50 };
    this.obstacles = [];
    this.groundY = 0;
    this.width = 0;
    this.height = 0;

    this.timeLeft = 30;
    this.isJumping = false;
    this.jumpVel = 0;
    this.gravity = 1800;
    this.jumpForce = -620;
    this.groundLevel = 0;

    this.spawnTimer = 0;
    this.spawnInterval = 1.4;
    this.elapsed = 0;

    this.score = 0;
    this.dodgedObstacles = 0;
    this._scoreAccumulator = 0;
    this._currentStage = null;

    this.runningSpeed = BASE_RUNNING_SPEED;

    this._bonusAwarded = false;

    this._runFrames = [];
    this._runFramesLoaded = [];
    this._jumpImage = null;
    this._jumpSpriteLoaded = false;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._loop = this._loop.bind(this);
  }

  start() {
    this.state = 'PLAYING';
    this.running = true;
    this.timeLeft = 30;
    this.elapsed = 0;
    this.obstacles = [];
    this.isJumping = false;
    this.jumpVel = 0;
    this.spawnTimer = 0;
    this.spawnInterval = 1.4;
    this._bonusAwarded = false;
    this.score = 0;
    this.dodgedObstacles = 0;
    this._scoreAccumulator = 0;
    this._currentStage = null;
    this._runFramesLoaded = [];
    this._jumpSpriteLoaded = false;
    this._lastTime = null;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'dino-runner-canvas';
    this.container.appendChild(this.canvas);

    this._resize();
    this.runningSpeed = BASE_RUNNING_SPEED;

    console.info('[DinoRunner config]', {
      width: this.width,
      height: this.height,
      runningSpeed: this.runningSpeed,
      gravity: this.gravity,
      jumpForce: this.jumpForce,
      minSafeGap: MIN_SAFE_OBSTACLE_GAP,
      criticalZone: CRITICAL_ZONE_DISTANCE
    });

    this._loadDinoAssets();

    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('touchstart', this._onTouchStart, { passive: false });
    document.addEventListener('pointerdown', this._onPointerDown);

    this._loop(performance.now());
  }

  stop() {
    this.state = 'IDLE';
    this.running = false;
    this._completed = true;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('touchstart', this._onTouchStart);
    document.removeEventListener('pointerdown', this._onPointerDown);
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
  }

  stopEarly() {
    if (this.state !== 'PLAYING') return;
    this.state = 'FAIL';
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this._cleanup();
    this._complete(this._buildFailureResult('interrompido'));
  }

  destroy() {
    this.stop();
  }

  startBotPreview() {
    return;
  }

  stopBotPreview() {
    return;
  }

  _loadDinoAssets() {
    const frameCount = RUN_FRAME_COUNT;
    this._runFrames = new Array(frameCount);
    this._runFramesLoaded = new Array(frameCount).fill(false);

    for (let i = 0; i < frameCount; i++) {
      const idx = i;
      const url = new URL(`../../assets/minigames/dino-runner/dino-run-${idx + 1}.webp`, import.meta.url).href;
      const img = new Image();
      img.onload = () => {
        const valid = img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
        this._runFramesLoaded[idx] = valid;
        if (!valid) console.warn(`[DinoRunner] Run frame ${idx + 1} loaded with zero dimensions`);
      };
      img.onerror = () => {
        this._runFramesLoaded[idx] = false;
      };
      img.src = url;
      this._runFrames[idx] = img;
    }

    const jumpUrl = new URL('../../assets/minigames/dino-runner/dino-jump.webp', import.meta.url).href;
    this._jumpImage = new Image();
    this._jumpImage.onload = () => {
      const valid = this._jumpImage.complete && this._jumpImage.naturalWidth > 0 && this._jumpImage.naturalHeight > 0;
      this._jumpSpriteLoaded = valid;
      if (!valid) console.warn('[DinoRunner] Jump sprite loaded with zero dimensions');
    };
    this._jumpImage.onerror = () => {
      this._jumpSpriteLoaded = false;
    };
    this._jumpImage.src = jumpUrl;
  }

  _resize() {
    const rect = this.container.getBoundingClientRect();
    this.width = rect.width || 600;
    this.height = rect.height || 350;
    if (this.canvas) {
      this.canvas.width = this.width;
      this.canvas.height = this.height;
      this.canvas.style.width = this.width + 'px';
      this.canvas.style.height = this.height + 'px';
      this.ctx = this.canvas.getContext('2d');
    }
    const dinoW = Math.max(30, Math.round(this.width * 0.07));
    const dinoH = Math.round(dinoW * 1.25);
    this.dino.w = dinoW;
    this.dino.h = dinoH;
    this.groundLevel = this.height - 60;
    this.dino.x = Math.max(40, this.width * 0.1);
    this.dino.y = this.groundLevel - this.dino.h;
    this.groundY = this.groundLevel;
  }

  _onKeyDown(e) {
    if (e.key === ' ' || e.key === 'ArrowUp') {
      e.preventDefault();
      this._jump();
    }
  }

  _onTouchStart(e) {
    if (this.canvas && this.canvas.contains(e.target)) {
      e.preventDefault();
      this._jump();
    }
  }

  _onPointerDown(e) {
    if (e.pointerType === 'touch') return;
    if (this.canvas && this.canvas.contains(e.target)) {
      e.preventDefault();
      this._jump();
    }
  }

  _jump() {
    if (this.state !== 'PLAYING' || this.isJumping) return;
    this.isJumping = true;
    this.jumpVel = this.jumpForce;
    audioManager.play('dinoJump');
  }

  _getSpawnInterval() {
    if (this.elapsed < 10) return 1.4;
    if (this.elapsed < 20) return 1.0 + Math.random() * 0.4;
    if (this.elapsed < 24) return 0.85 + Math.random() * 0.45;
    return 0.9 + Math.random() * 0.4;
  }

  _getSpeedMultiplier() {
    if (this.elapsed < 10) return 1.0;
    if (this.elapsed < 20) return 1.2;
    if (this.elapsed < 24) return 1.4;
    return 1.4;
  }

  _spawnObstacle() {
    if (this.obstacles.length > 0) {
      const last = this.obstacles[this.obstacles.length - 1];
      const gap = this.width - (last.x + last.w);
      if (gap < MIN_SAFE_OBSTACLE_GAP) return;
    }

    for (const o of this.obstacles) {
      const dist = o.x - this.dino.x;
      if (dist > 0 && dist < CRITICAL_ZONE_DISTANCE) return;
    }

    const lastType = this.obstacles.length > 0
      ? this.obstacles[this.obstacles.length - 1].type : null;
    const isCactus = lastType === 'rock' ? true : Math.random() < 0.6;
    const w = isCactus ? CACTUS_WIDTH : ROCK_WIDTH;
    const h = isCactus ? CACTUS_HEIGHT : ROCK_HEIGHT;
    this.obstacles.push({
      x: this.width,
      y: this.groundLevel - h,
      w, h,
      type: isCactus ? 'cactus' : 'rock',
    });
  }

  _update(dt) {
    if (this.state !== 'PLAYING') return;

    this.elapsed += dt;
    if (this.mode === 'arcade') {
      this._accumulateScore(dt);
    } else {
      this.timeLeft -= dt;
    }

    // Bonus rule: player earns +3 boardDelta upon reaching the hard phase (BONUS_THRESHOLD = 20s).
    // Once awarded, it is never revoked, even on later collision. Board mode only.
    if (this.mode !== 'arcade' && !this._bonusAwarded && this.elapsed >= BONUS_THRESHOLD) {
      this._bonusAwarded = true;
    }

    if (this.mode !== 'arcade' && this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.state = 'SUCCESS';
      this._complete({ venceu: true, boardDelta: 3, progresso: { atual: 1, objetivo: 1 }, motivo: 'completo', stats: { tempo: 30 } });
      return;
    }

    let speed;
    if (this.mode === 'arcade') {
      const stage = this._getArcadeStage();
      this._currentStage = stage;
      const min = stage ? stage.spawnMin : 1.4;
      const max = stage ? stage.spawnMax : 1.4;
      this.spawnInterval = min + Math.random() * Math.max(0, max - min);
      speed = this.runningSpeed * (stage ? stage.speed : 1);
    } else {
      this.spawnInterval = this._getSpawnInterval();
      speed = this.runningSpeed * this._getSpeedMultiplier();
    }

    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this._spawnObstacle();
    }

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      o.x -= speed * dt;
      if (!o.dodged && o.x + o.w < this.dino.x) {
        o.dodged = true;
        this._onObstacleDodged();
      }
      if (o.x + o.w < 0) {
        this.obstacles.splice(i, 1);
      }
    }

    if (this.isJumping) {
      this.dino.y += this.jumpVel * dt;
      this.jumpVel += this.gravity * dt;

      if (this.dino.y >= this.groundLevel - this.dino.h) {
        this.dino.y = this.groundLevel - this.dino.h;
        this.isJumping = false;
        this.jumpVel = 0;
      }
    }

    const dinoBox = {
      x: this.dino.x + 4,
      y: this.dino.y + 4,
      w: this.dino.w - 8,
      h: this.dino.h - 8,
    };

    for (const o of this.obstacles) {
      const oBox = {
        x: o.x + 3,
        y: o.y + 3,
        w: o.w - 6,
        h: o.h - 6,
      };

      if (
        dinoBox.x < oBox.x + oBox.w &&
        dinoBox.x + dinoBox.w > oBox.x &&
        dinoBox.y < oBox.y + oBox.h &&
        dinoBox.y + dinoBox.h > oBox.y
      ) {
        this.state = 'FAIL';
        audioManager.play('dinoCollision');
        this._complete(this._buildFailureResult('colisao'));
        return;
      }
    }
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

  _onObstacleDodged() {
    if (this.mode !== 'arcade') return;
    this.dodgedObstacles++;
    const perObstacle = this.params && this.params.score ? (Number(this.params.score.perObstacle) || 0) : 0;
    this.score += perObstacle;
  }

  _buildFailureResult(motivo) {
    if (this.mode === 'arcade') {
      return {
        venceu: false,
        boardDelta: 0,
        progresso: { atual: 0, objetivo: 1 },
        motivo,
        stats: {
          tempo: Math.round(this.elapsed),
          pontuacao: this.score,
          obstaculosDesviados: this.dodgedObstacles
        }
      };
    }
    return {
      venceu: false,
      boardDelta: this._bonusAwarded ? 3 : 0,
      progresso: { atual: 0, objetivo: 1 },
      motivo,
      stats: { tempo: Math.round(30 - this.timeLeft) }
    };
  }

  _drawGround(ctx) {
    ctx.fillStyle = '#8B7355';
    ctx.fillRect(0, this.groundY, this.width, this.height - this.groundY);

    ctx.strokeStyle = '#6B5335';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, this.groundY);
    ctx.lineTo(this.width, this.groundY);
    ctx.stroke();

    ctx.strokeStyle = '#7B6345';
    ctx.lineWidth = 1;
    for (let x = 0; x < this.width; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, this.groundY + 6);
      ctx.lineTo(x + 12, this.groundY + 6);
      ctx.stroke();
    }
  }

  _drawDinoBody(ctx, w, h) {
    ctx.fillStyle = '#43A047';
    ctx.beginPath();
    ctx.moveTo(w * 0.05, h * 0.1);
    ctx.quadraticCurveTo(w * 0.3, -h * 0.08, w * 0.6, h * 0.02);
    ctx.quadraticCurveTo(w * 0.85, h * 0.05, w * 0.95, h * 0.15);
    ctx.lineTo(w * 0.95, h * 0.55);
    ctx.quadraticCurveTo(w * 0.85, h * 0.65, w * 0.65, h * 0.6);
    ctx.lineTo(w * 0.6, h * 0.55);
    ctx.lineTo(w * 0.5, h * 0.9);
    ctx.lineTo(w * 0.35, h * 0.9);
    ctx.lineTo(w * 0.3, h * 0.55);
    ctx.quadraticCurveTo(w * 0.18, h * 0.58, w * 0.08, h * 0.52);
    ctx.quadraticCurveTo(w * 0.02, h * 0.42, w * 0.02, h * 0.25);
    ctx.closePath();
    ctx.fill();
  }

  _drawDinoBelly(ctx, w, h) {
    ctx.fillStyle = '#81C784';
    ctx.beginPath();
    ctx.moveTo(w * 0.15, h * 0.3);
    ctx.quadraticCurveTo(w * 0.3, h * 0.22, w * 0.5, h * 0.25);
    ctx.quadraticCurveTo(w * 0.7, h * 0.28, w * 0.78, h * 0.35);
    ctx.lineTo(w * 0.78, h * 0.52);
    ctx.quadraticCurveTo(w * 0.6, h * 0.58, w * 0.4, h * 0.55);
    ctx.quadraticCurveTo(w * 0.25, h * 0.52, w * 0.15, h * 0.45);
    ctx.closePath();
    ctx.fill();
  }

  _drawDinoHead(ctx, w, h) {
    ctx.fillStyle = '#43A047';
    ctx.beginPath();
    ctx.moveTo(w * 0.55, h * 0.02);
    ctx.quadraticCurveTo(w * 0.4, -h * 0.12, w * 0.2, -h * 0.04);
    ctx.quadraticCurveTo(w * 0.05, h * 0.02, w * 0.02, h * 0.12);
    ctx.quadraticCurveTo(w * 0.05, h * 0.2, w * 0.15, h * 0.2);
    ctx.quadraticCurveTo(w * 0.3, h * 0.15, w * 0.55, h * 0.18);
    ctx.closePath();
    ctx.fill();
  }

  _drawDinoSnout(ctx, w, h) {
    ctx.fillStyle = '#2E7D32';
    ctx.beginPath();
    ctx.ellipse(w * 0.12, h * 0.08, w * 0.08, h * 0.06, -0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1B5E20';
    ctx.beginPath();
    ctx.arc(w * 0.1, h * 0.06, w * 0.02, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawDinoEye(ctx, w, h) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(w * 0.24, h * 0.0, w * 0.1, h * 0.1, -0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(w * 0.26, h * 0.02, w * 0.05, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(w * 0.23, h * -0.02, w * 0.02, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawDinoMouth(ctx, w, h) {
    ctx.strokeStyle = '#1B5E20';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(w * 0.08, h * 0.16);
    ctx.quadraticCurveTo(w * 0.18, h * 0.22, w * 0.25, h * 0.18);
    ctx.stroke();
  }

  _drawDinoTail(ctx, w, h, wag) {
    ctx.fillStyle = '#388E3C';
    ctx.beginPath();
    ctx.moveTo(w * 0.92, h * 0.2);
    ctx.quadraticCurveTo(w * 1.1, h * 0.15 + wag, w * 1.12, h * 0.3 + wag);
    ctx.quadraticCurveTo(w * 1.05, h * 0.4 + wag, w * 0.88, h * 0.5);
    ctx.closePath();
    ctx.fill();
  }

  _drawDinoArms(ctx, w, h, armSwing) {
    ctx.fillStyle = '#388E3C';
    ctx.beginPath();
    ctx.ellipse(w * 0.52, h * 0.42 + armSwing, w * 0.06, h * 0.08, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(w * 0.62, h * 0.4 + armSwing, w * 0.06, h * 0.08, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawDinoLegs(ctx, w, h, legPhase, jumping) {
    ctx.fillStyle = '#2E7D32';
    if (jumping) {
      ctx.beginPath();
      ctx.ellipse(w * 0.18, h * 0.88, w * 0.1, h * 0.06, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(w * 0.48, h * 0.88, w * 0.1, h * 0.06, -0.1, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const frontY = h * 0.9 + Math.sin(legPhase) * h * 0.04;
      const backY = h * 0.9 + Math.sin(legPhase + Math.PI) * h * 0.04;
      ctx.beginPath();
      ctx.ellipse(w * 0.18, frontY, w * 0.07, h * 0.08, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(w * 0.48, backY, w * 0.07, h * 0.08, -0.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawDinoSpikes(ctx, w, h) {
    ctx.fillStyle = '#2E7D32';
    for (let i = 0; i < 4; i++) {
      const sx = w * 0.35 + i * w * 0.12;
      const sy = h * 0.05;
      ctx.beginPath();
      ctx.moveTo(sx - w * 0.03, sy);
      ctx.lineTo(sx, sy - h * 0.06);
      ctx.lineTo(sx + w * 0.03, sy);
      ctx.closePath();
      ctx.fill();
    }
  }

  _drawDino(ctx, now) {
    if (this.isJumping && this._jumpSpriteLoaded) {
      this._drawDinoSprite(ctx, this._jumpImage);
      return;
    }

    if (!this.isJumping) {
      const frameIndex = Math.floor(now / RUN_FRAME_DURATION_MS) % RUN_FRAME_COUNT;
      if (this._runFramesLoaded[frameIndex] && this._runFrames[frameIndex]) {
        this._drawDinoSprite(ctx, this._runFrames[frameIndex]);
        return;
      }
      for (let i = 0; i < RUN_FRAME_COUNT; i++) {
        if (this._runFramesLoaded[i] && this._runFrames[i]) {
          this._drawDinoSprite(ctx, this._runFrames[i]);
          return;
        }
      }
    }

    this._drawDinoFallback(ctx, now);
  }

  _drawDinoSprite(ctx, image) {
    ctx.save();
    ctx.drawImage(image, this.dino.x, this.dino.y, this.dino.w, this.dino.h);
    ctx.restore();
  }

  _drawDinoFallback(ctx, now) {
    const w = this.dino.w;
    const h = this.dino.h;
    const legPhase = now * 0.008;
    const wag = Math.sin(now * 0.006) * h * 0.02;
    const armSwing = this.isJumping ? -h * 0.04 : Math.sin(now * 0.01) * h * 0.01;

    ctx.save();
    ctx.translate(this.dino.x, this.dino.y);

    this._drawDinoTail(ctx, w, h, wag);
    this._drawDinoBody(ctx, w, h);
    this._drawDinoBelly(ctx, w, h);
    this._drawDinoSpikes(ctx, w, h);
    this._drawDinoArms(ctx, w, h, armSwing);
    this._drawDinoLegs(ctx, w, h, legPhase, this.isJumping);
    this._drawDinoHead(ctx, w, h);
    this._drawDinoSnout(ctx, w, h);
    this._drawDinoEye(ctx, w, h);
    this._drawDinoMouth(ctx, w, h);

    ctx.restore();
  }

  _drawRoundedRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
  }

  _drawCactus(ctx, o) {
    ctx.fillStyle = '#2E7D32';
    this._drawRoundedRect(ctx, o.x + o.w * 0.25, o.y + o.h * 0.05, o.w * 0.5, o.h * 0.9, o.w * 0.1);

    this._drawRoundedRect(ctx, o.x, o.y + o.h * 0.25, o.w, o.h * 0.35, o.w * 0.08);

    this._drawRoundedRect(ctx, o.x + o.w * 0.15, o.y + o.h * 0.08, o.w * 0.2, o.h * 0.25, o.w * 0.06);

    this._drawRoundedRect(ctx, o.x + o.w * 0.65, o.y + o.h * 0.12, o.w * 0.2, o.h * 0.2, o.w * 0.06);

    ctx.fillStyle = '#1B5E20';
    this._drawRoundedRect(ctx, o.x + o.w * 0.3, o.y + o.h * 0.1, o.w * 0.15, o.h * 0.12, o.w * 0.04);
  }

  _drawRock(ctx, o) {
    ctx.fillStyle = '#8D6E63';
    ctx.beginPath();
    ctx.moveTo(o.x, o.y + o.h * 0.3);
    ctx.quadraticCurveTo(o.x + o.w * 0.1, o.y - o.h * 0.1, o.x + o.w * 0.35, o.y);
    ctx.quadraticCurveTo(o.x + o.w * 0.6, o.y - o.h * 0.05, o.x + o.w * 0.75, o.y + o.h * 0.15);
    ctx.quadraticCurveTo(o.x + o.w, o.y + o.h * 0.2, o.x + o.w, o.y + o.h * 0.4);
    ctx.quadraticCurveTo(o.x + o.w * 0.9, o.y + o.h * 0.6, o.x + o.w * 0.6, o.y + o.h * 0.55);
    ctx.quadraticCurveTo(o.x + o.w * 0.3, o.y + o.h * 0.6, o.x, o.y + o.h * 0.4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#6D4C41';
    ctx.beginPath();
    ctx.ellipse(o.x + o.w * 0.4, o.y + o.h * 0.2, o.w * 0.15, o.h * 0.12, 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#A1887F';
    ctx.beginPath();
    ctx.ellipse(o.x + o.w * 0.55, o.y + o.h * 0.15, o.w * 0.08, o.h * 0.06, -0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawObstacles(ctx) {
    for (const o of this.obstacles) {
      if (o.type === 'cactus') {
        this._drawCactus(ctx, o);
      } else {
        this._drawRock(ctx, o);
      }
    }
  }

  _drawHUD(ctx) {
    const hudSize = Math.max(14, Math.round(this.width * 0.032));
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${hudSize}px sans-serif`;
    ctx.textAlign = 'left';
    if (this.mode === 'arcade') {
      ctx.fillText(`\u2B50 ${this.score}`, 10, hudSize + 4);
    } else {
      ctx.fillText(`\u23F1 ${Math.ceil(this.timeLeft)}s`, 10, hudSize + 4);
    }

    ctx.textAlign = 'right';
    let phase;
    if (this.mode === 'arcade') {
      const stage = this._currentStage;
      const seconds = Math.ceil(this.elapsed);
      phase = stage ? `${stage.name} \u00B7 ${seconds}s` : `${seconds}s`;
    } else {
      phase = this.elapsed < 10 ? 'F\u00E1cil' : this.elapsed < 20 ? 'M\u00E9dio' : 'Intenso';
    }
    ctx.fillText(phase, this.width - 10, hudSize + 4);
  }

  _drawPhaseIndicator(ctx) {
    if (this.mode === 'arcade') return;
    if (this._bonusAwarded && this.state === 'PLAYING') {
      const size = Math.max(10, Math.round(this.width * 0.022));
      ctx.fillStyle = '#FFD600';
      ctx.font = `${size}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText('\u2605 B\u00F4nus garantido!', 10, this.height - 12);
    }
  }

  _drawBackground(ctx, now) {
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = '#E0F7FA';
    for (let i = 0; i < 6; i++) {
      const cx = ((now * 0.02 + i * 80) % (this.width + 60)) - 30;
      const cy = 20 + i * 18;
      ctx.beginPath();
      ctx.arc(cx, cy, 6 + i * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawResultOverlay(ctx) {
    if (this.state === 'SUCCESS' || this.state === 'FAIL') {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  _draw() {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = performance.now();

    this._drawBackground(ctx, now);
    this._drawGround(ctx);
    this._drawObstacles(ctx);
    this._drawDino(ctx, now);
    this._drawHUD(ctx);
    this._drawPhaseIndicator(ctx);
    this._drawResultOverlay(ctx);
  }

  _loop(timestamp) {
    const isTerminal = this.state === 'SUCCESS' || this.state === 'FAIL';

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
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('touchstart', this._onTouchStart);
    document.removeEventListener('pointerdown', this._onPointerDown);
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
  }

  _complete(result) {
    if (this._completed) return;
    this._completed = true;
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
