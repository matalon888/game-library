export const W = 22;
export const H = 24;
export const COLORS = ['#ff7b70', '#79ceff', '#e3f67b'];
const FIXED = 1 / 120;
const MIN_LENGTH = 5;

export class Game {
  constructor({ mode = 'storm', variant = 'wild', seed = 41739, practice = false, relaxed = false } = {}) {
    this.mode = mode;
    this.relaxed = Boolean(relaxed);
    this.speed = this.relaxed ? 0.6 : 1;
    this.maxHealth = this.relaxed ? 5 : 3;
    this.growthInterval = this.relaxed ? 4.2 : 2.8;
    this.variant = ['wild', 'cadence', 'afterimage'].includes(variant) ? variant : 'wild';
    this.skins = [];
    this.forecast = [];
    this.phrase = null;
    this.phraseCount = 0;
    this.phraseRepeat = 0;
    this.nextSkinId = 1;
    this.practice = practice;
    this.seed = seed >>> 0;
    this.rng = this.seed || 1;
    this.snake = Array.from({ length: 12 }, (_, i) => ({ x: 11 - i, y: 12, color: -1 }));
    this.previousSnake = this.snake.map(p => ({ ...p }));
    this.dir = { x: 1, y: 0 };
    this.turns = [];
    this.drops = [];
    this.debris = [];
    this.time = 0;
    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.comboTimer = 0;
    this.health = this.maxHealth;
    this.status = 'playing';
    this.shedCooldown = 0;
    this.invulnerable = 0;
    this.stats = { caught: 0, missed: 0, clears: 0, shed: 0, removed: 0, skinCaught: 0, skinClears: 0, skinsCreated: 0 };
    this.events = [];
    this.stepDuration = 0.155;
    this.moveAccumulator = 0;
    this.accumulator = 0;
    this.rainTimer = 0.75;
    this.growthTimer = this.growthInterval;
    this.growthPending = 0;
    this.nextDropId = 1;
    this.rainCount = 0;
  }

  random() {
    let x = this.rng;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this.rng = x >>> 0;
    return this.rng / 4294967296;
  }

  turn(dx, dy) {
    if (this.status !== 'playing' || Math.abs(dx) + Math.abs(dy) !== 1 ||
        !Number.isInteger(dx) || !Number.isInteger(dy) || this.turns.length >= 2) return false;
    const last = this.turns.at(-1) || this.dir;
    if ((dx === -last.x && dy === -last.y) || (dx === last.x && dy === last.y)) return false;
    this.turns.push({ x: dx, y: dy });
    return true;
  }

  spawnDrop(x, color, y = -1, warning = 0.7) {
    if (!Number.isInteger(x) || x < 0 || x >= W || !Number.isInteger(color) || color < 0 || color > 2) return null;
    const drop = { id: this.nextDropId++, x, y, color, warning: Math.max(0, warning) };
    this.drops.push(drop);
    return drop;
  }

  drainEvents() { return this.events.splice(0); }

  update(dt) {
    if (this.status !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
    this.accumulator += Math.min(dt, 0.5) * this.speed;
    while (this.accumulator + 1e-10 >= FIXED && this.status === 'playing') {
      this.accumulator -= FIXED;
      this.tick(FIXED);
    }
  }

  tick(dt) {
    this.time += dt;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.shedCooldown = Math.max(0, this.shedCooldown - dt);
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    if (!this.comboTimer) this.combo = 0;
    const pressure = Math.min(1, this.time / 180);
    this.stepDuration = 0.155 - pressure * 0.027;
    if (!this.practice) {
      this.growthTimer -= dt;
      if (this.growthTimer <= 0) {
        this.growthPending++;
        this.growthTimer += this.growthInterval;
      }
      if (this.variant !== 'wild') this.updatePhrases(dt, pressure);
      else {
      this.rainTimer -= dt;
      if (this.rainTimer <= 0) {
        // The first two clouds teach that neighboring catches share a pigment.
        const color = this.rainCount < 4 ? Math.floor(this.rainCount / 2) : Math.floor(this.random() * 3);
        let x = Math.floor(this.random() * W);
        if (this.rainCount < 4) x = [15, 16, 8, 9][this.rainCount];
        this.spawnDrop(x, color);
        this.rainCount++;
        this.rainTimer += 0.92 - pressure * 0.5;
      }
      }
    }
    this.moveAccumulator += dt;
    if (this.moveAccumulator >= this.stepDuration) {
      this.moveAccumulator -= this.stepDuration;
      this.move();
    }
    if (this.status !== 'playing') return;
    for (const skin of this.skins) {
      if (skin.arming > 0) {
        const overlap = skin.cells.some(p => this.snake.some(q => p.x === q.x && p.y === q.y));
        skin.arming = overlap ? Math.max(skin.arming, 0.1) : Math.max(0, skin.arming - dt);
      }
    }
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      if (d.warning > 0) { d.warning = Math.max(0, d.warning - dt); continue; }
      d.y += dt * (4.8 + pressure * 1.6);
      const row = Math.round(d.y);
      if (row < 0) continue;
      const bodyIndex = this.snake.findIndex(p => p.x === d.x && p.y === row);
      if (bodyIndex >= 0) {
        this.drops.splice(i, 1);
        this.paint(bodyIndex, d.color);
        continue;
      }
      const skin = this.skins.find(s => s.cells.some(p => p.x === d.x && p.y === row));
      if (skin) {
        this.drops.splice(i, 1);
        this.paintSkin(skin.id, skin.cells.findIndex(p => p.x === d.x && p.y === row), d.color);
        continue;
      }
      const floor = this.debris.reduce((y, p) => p.x === d.x ? Math.min(y, p.y - 1) : y, H - 1);
      if (d.y >= floor) {
        this.drops.splice(i, 1);
        if (floor >= 0) this.debris.push({ x: d.x, y: floor, color: d.color });
        this.stats.missed++;
        this.events.push({ type: 'miss', x: d.x, y: Math.max(0, floor), color: d.color, count: 1, points: 0 });
      }
    }
    if (!this.practice && this.mode === 'storm' && this.time + 1e-8 >= 180) {
      this.time = 180;
      this.status = 'won';
      this.score += 1000 + this.health * 250;
      this.events.push({ type: 'win', ...this.snake[0], count: 1, points: 1000 + this.health * 250 });
    }
  }

  updatePhrases(dt, pressure) {
    this.rainTimer -= dt;
    if (this.rainTimer <= 0) {
      const kinds = ['sweep', 'echo', 'fork'];
      let kind = this.phraseCount < 3 ? kinds[this.phraseCount] : kinds[Math.floor(this.random() * 3)];
      if (kind === this.phrase?.kind && this.phraseRepeat >= 2) kind = kinds[(kinds.indexOf(kind) + 1 + Math.floor(this.random() * 2)) % 3];
      this.phraseRepeat = kind === this.phrase?.kind ? this.phraseRepeat + 1 : 1;
      const color = Math.floor(this.random() * 3);
      const direction = this.random() < 0.5 ? -1 : 1;
      const anchor = 2 + Math.floor(this.random() * (W - 4));
      const columns = kind === 'sweep' ? [anchor, anchor + direction, anchor + 2 * direction] :
        kind === 'echo' ? [anchor, anchor, anchor] : [anchor, anchor + 2 * direction, anchor];
      const spacing = 0.8 - pressure * 0.15;
      this.phrase = { name: kind[0].toUpperCase() + kind.slice(1), kind, color, columns, startedAt: this.time };
      this.forecast = columns.map((x, index) => ({ x, color, index, kind, at: this.time + 1.1 + spacing * index, eta: 1.1 + spacing * index }));
      this.events.push({ type: 'phrase', ...this.phrase, text: this.phrase.name, x: columns[0], y: 0, count: 3, points: 0 });
      this.phraseCount++;
      // One complete announced phrase at a time. Telegraphing bounds peak density.
      this.rainTimer += Math.max(3 * (0.92 - pressure * 0.5), 1.1 + 2 * spacing + 0.15);
    }
    for (let i = this.forecast.length - 1; i >= 0; i--) {
      const note = this.forecast[i];
      note.eta = Math.max(0, note.at - this.time);
      if (note.at <= this.time + 1e-10) {
        this.spawnDrop(note.x, note.color, -1, 0);
        this.rainCount++;
        this.forecast.splice(i, 1);
      }
    }
  }

  move() {
    this.previousSnake = this.snake.map(p => ({ ...p }));
    if (this.turns.length) this.dir = this.turns.shift();
    const head = this.snake[0];
    let x = head.x + this.dir.x, y = head.y + this.dir.y;
    if (x < 0 || x >= W || y < 0 || y >= H) {
      this.damage('wall');
      this.dir = { x: -this.dir.x, y: -this.dir.y };
      this.turns = [];
      x = head.x + this.dir.x; y = head.y + this.dir.y;
    }
    const occupied = this.snake.slice(0, this.growthPending ? this.snake.length : -1).some(p => p.x === x && p.y === y);
    if (occupied || this.debris.some(p => p.x === x && p.y === y)) this.damage(occupied ? 'body' : 'debris');
    if (this.skins.some(s => s.arming <= 0 && s.cells.some(p => p.x === x && p.y === y))) this.damage('skin');
    if (this.status !== 'playing') return;
    if (this.invulnerable > 0) this.debris = this.debris.filter(p => p.x !== x || p.y !== y);
    // Pigment belongs to body order; movement advances the physical path only.
    const colors = this.snake.map(p => p.color);
    this.snake.unshift({ x, y, color: -1 });
    if (this.growthPending && this.snake.length < W * H / 2) {
      this.growthPending--;
      this.events.push({ type: 'grow', x, y, color: -1, count: 1, points: 0 });
    } else { this.snake.pop(); this.growthPending = 0; }
    this.snake.forEach((p, i) => { p.color = colors[i] ?? -1; });
  }

  damage(reason) {
    if (this.invulnerable > 0 || this.status !== 'playing') return;
    this.health--;
    this.combo = 0; this.comboTimer = 0;
    this.invulnerable = 1.5;
    this.snake.length = Math.max(MIN_LENGTH, this.snake.length - 4);
    this.blast([this.snake[0]], 2);
    this.events.push({ type: 'hit', ...this.snake[0], count: 1, points: 0, text: reason });
    if (this.health <= 0) {
      this.status = 'lost';
      this.events.push({ type: 'lose', ...this.snake[0], count: 1, points: 0 });
    }
  }

  blast(positions, radius) {
    const before = this.debris.length;
    this.debris = this.debris.filter(p => !positions.some(q => Math.abs(p.x - q.x) + Math.abs(p.y - q.y) <= radius));
    return before - this.debris.length;
  }

  paint(index, color) {
    if (!this.snake[index]) return;
    this.snake[index].color = color;
    if (this.snake[index + 1]) this.snake[index + 1].color = color;
    this.stats.caught++;
    this.score += 15;
    this.events.push({ type: 'catch', ...this.snake[index], count: 1, points: 15 });
    this.resolveMatches();
  }

  paintSkin(id, index, color) {
    const skin = this.skins.find(s => s.id === id);
    if (!skin?.cells[index] || !Number.isInteger(color) || color < 0 || color > 2) return;
    skin.cells[index].color = color;
    // A hollow skin wicks pigment through an existing same-color patch. This
    // keeps vertical casts solvable even when the top link shields the others.
    for (const direction of [1, -1]) {
      let next = index + direction;
      while (skin.cells[next]?.color === color) next += direction;
      if (skin.cells[next]) { skin.cells[next].color = color; break; }
    }
    this.stats.skinCaught++;
    this.score += 15;
    this.events.push({ type: 'skin_catch', skinId: id, ...skin.cells[index], count: 1, points: 15 });
    this.resolveSkin(skin);
  }

  resolveSkin(skin) {
    let matchedColor = -1;
    for (let i = 0; i < skin.cells.length - 2; i++) {
      const color = skin.cells[i].color;
      if (color >= 0 && skin.cells[i + 1].color === color && skin.cells[i + 2].color === color) { matchedColor = color; break; }
    }
    if (matchedColor < 0) return;
    const positions = skin.cells.map(p => ({ ...p }));
    this.skins = this.skins.filter(s => s.id !== skin.id);
    const blasted = this.blast(positions, 3);
    this.combo = Math.min(8, this.combo + 1);
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.comboTimer = 5;
    const points = (positions.length * 100 + blasted * 35) * this.combo;
    this.score += points;
    this.stats.skinClears++;
    this.events.push({ type: 'skin_clear', skinId: skin.id, x: positions[0].x, y: positions[0].y, color: matchedColor, count: positions.length, points, combo: this.combo, blasted, positions });
  }

  resolveMatches() {
    // Removing a run can bring separated pigments together: resolve that chain too.
    for (let chain = 0; chain < W * H; chain++) {
      const runs = [];
      for (let i = 0; i < this.snake.length;) {
        let j = i + 1;
        while (j < this.snake.length && this.snake[j].color === this.snake[i].color) j++;
        if (this.snake[i].color >= 0 && j - i >= 3) runs.push({ start: i, end: j, color: this.snake[i].color });
        i = j;
      }
      if (!runs.length) break;
      const indices = new Set(runs.flatMap(r => Array.from({ length: r.end - r.start }, (_, i) => r.start + i)));
      const positions = this.snake.filter((_, i) => indices.has(i)).map(p => ({ ...p }));
      const blasted = this.blast(positions, 3);
      this.combo = Math.min(8, this.combo + 1);
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.comboTimer = 5;
      const points = (positions.length * 100 + blasted * 35) * this.combo;
      this.score += points;
      this.stats.clears += runs.length;
      const shrink = Math.min(positions.length, this.snake.length - MIN_LENGTH);
      this.stats.removed += shrink;
      const colors = this.snake.filter((_, i) => !indices.has(i)).map(p => p.color);
      this.snake.length -= shrink;
      this.snake.forEach((p, i) => { p.color = colors[i] ?? -1; });
      this.events.push({ type: 'clear', x: positions[0].x, y: positions[0].y, color: runs[0].color, count: positions.length, points, combo: this.combo, blasted, positions });
    }
  }

  shed() {
    if (this.status !== 'playing' || this.shedCooldown > 0 || this.snake.length < 9) return false;
    const positions = this.snake.splice(-4);
    this.blast([this.snake[0]], 2);
    this.invulnerable = Math.max(this.invulnerable, 0.8);
    this.shedCooldown = 6;
    this.stats.shed++;
    this.stats.removed += 4;
    this.events.push({ type: 'shed', ...this.snake[0], count: 4, points: 0, positions });
    if (this.variant === 'afterimage') {
      const unique = new Set(positions.map(p => `${p.x},${p.y}`)).size === positions.length;
      const blocked = positions.some(p => [...this.debris, ...this.skins.flatMap(s => s.cells)].some(q => p.x === q.x && p.y === q.y));
      if (!unique || blocked) {
        this.events.push({ type: 'skin_reject', ...this.snake[0], text: 'Cast scattered — no clear space', count: 0, points: 0 });
      } else {
        const skin = { id: this.nextSkinId++, cells: positions.map(p => ({ ...p })), arming: 1 };
        this.skins.push(skin);
        this.stats.skinsCreated++;
        this.events.push({ type: 'skin_create', skinId: skin.id, ...positions[0], count: positions.length, points: 0, positions: skin.cells.map(p => ({ ...p })) });
        this.resolveSkin(skin);
      }
    }
    return true;
  }
}
