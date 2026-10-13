import { audioManager } from '../../audio/index.js';

export class OceanMatch3 {
  static PIECE_TYPES = ['fish', 'octopus', 'crab', 'shell', 'star'];

  static PIECE_EMOJI = {
    fish: '\uD83D\uDC20',
    octopus: '\uD83D\uDC19',
    crab: '\uD83E\uDD80',
    shell: '\uD83D\uDC1A',
    star: '\u2B50',
  };

  static EMPTY_CELL = null;

  static DEFAULT_TIME_LIMIT = 45;

  static debugTimeLimit = null;

  static currentInstance = null;

  constructor(container, onComplete, options = {}) {
    this.container = container;
    this.onComplete = onComplete;
    this.mode = options.mode === 'arcade' ? 'arcade' : 'board';
    this.params = options.mode === 'arcade' ? (options.params || null) : null;
    this.score = 0;
    this.maxMultiplicador = 0;
    this._stageIndex = 0;
    this.elapsed = 0;
    this._completed = false;
    this._started = false;
    this.grid = null;
    this.selectedCell = null;
    this.swapCount = 0;
    this.lastSwap = null;
    this.validSwapCount = 0;
    this.invalidSwapCount = 0;
    this.lastMatches = { groups: [], cells: [], hasMatches: false };
    this.isResolving = false;
    this.combinations = 0;
    this.targetCombinations = 5;
    this._noTimerLimit = this.mode === 'arcade' || options.noTimerLimit === true;
    this.timeLimit = (options.timeLimit && Number.isInteger(options.timeLimit) && options.timeLimit > 0)
      ? options.timeLimit
      : OceanMatch3.DEFAULT_TIME_LIMIT;
    this.timeRemaining = this.timeLimit;
    const arcadeStages = this.mode === 'arcade' ? this._getArcadeStages() : null;
    if (arcadeStages && arcadeStages.length > 0) {
      this.targetCombinations = arcadeStages[0].target;
    }
    this.cascadeCycles = 0;
    this._totalCascadeCycles = 0;
    this._timerInterval = null;
    this._boundGridClick = null;
    this.rootElement = null;
    this.interactionLocked = false;
    this._botPreviewInterval = null;
    this._targetReached = false;
  }

  start() {
    if (this._started) return;
    this._started = true;

    this._completed = false;
    this._targetReached = false;
    this.combinations = 0;
    this.timeRemaining = this.timeLimit;
    this.selectedCell = null;
    this.swapCount = 0;
    this.validSwapCount = 0;
    this.invalidSwapCount = 0;
    this.lastSwap = null;
    this.isResolving = false;
    this.cascadeCycles = 0;
    this._totalCascadeCycles = 0;
    this.lastMatches = { groups: [], cells: [], hasMatches: false };
    this.score = 0;
    this.maxMultiplicador = 0;
    this._stageIndex = 0;
    this.elapsed = 0;
    this.targetCombinations = 5;
    const arcadeStages = this.mode === 'arcade' ? this._getArcadeStages() : null;
    if (arcadeStages && arcadeStages.length > 0) {
      this.targetCombinations = arcadeStages[0].target;
    }

    this._loadCSS();
    this.container.style.aspectRatio = 'auto';
    this.container.style.minHeight = '350px';
    this._createGrid();
    this._render();
  }

  _loadCSS() {
    if (typeof document === 'undefined') return;
    const id = 'ocean-match3-css';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'minigames/ocean-match3/oceanMatch3.css';
    document.head.appendChild(link);
  }

  _createGrid() {
    this.grid = [];
    const types = OceanMatch3.PIECE_TYPES;
    for (let r = 0; r < 6; r++) {
      const row = [];
      for (let c = 0; c < 6; c++) {
        row.push({
          type: types[Math.floor(Math.random() * types.length)],
          row: r,
          col: c,
        });
      }
      this.grid.push(row);
    }
  }

  _loadTestGrid() {
    const layout = [
      ['fish','fish','fish','crab','crab','star'],
      ['crab','shell','crab','crab','shell','octopus'],
      ['fish','shell','star','octopus','star','fish'],
      ['star','shell','shell','shell','shell','shell'],
      ['fish','shell','star','crab','fish','star'],
      ['crab','octopus','crab','star','crab','fish'],
    ];
    this.grid = [];
    for (let r = 0; r < 6; r++) {
      const row = [];
      for (let c = 0; c < 6; c++) {
        row.push({ type: layout[r][c], row: r, col: c });
      }
      this.grid.push(row);
    }
    this.selectedCell = null;
    this.lastSwap = null;
    this.swapCount = 0;
    this.validSwapCount = 0;
    this.invalidSwapCount = 0;
    this.lastMatches = { groups: [], cells: [], hasMatches: false };
    this._renderGrid();
    this._syncSelectionDOM();
  }

  _loadEmptyCellsTestGrid() {
    const layout = [
      [null, null, null, 'crab', 'crab', 'star'],
      ['crab', 'shell', 'crab', 'crab', 'shell', 'octopus'],
      ['fish', null, 'star', 'octopus', 'star', 'fish'],
      ['star', 'shell', 'shell', 'shell', 'shell', 'shell'],
      ['fish', 'shell', null, 'crab', null, 'star'],
      ['crab', 'octopus', 'crab', 'star', 'crab', null],
    ];
    this.grid = [];
    for (let r = 0; r < 6; r++) {
      const row = [];
      for (let c = 0; c < 6; c++) {
        const val = layout[r][c];
        row.push(val === null ? OceanMatch3.EMPTY_CELL : { type: val, row: r, col: c });
      }
      this.grid.push(row);
    }
    this.selectedCell = null;
    this.lastSwap = null;
    this.swapCount = 0;
    this.validSwapCount = 0;
    this.invalidSwapCount = 0;
    this.lastMatches = { groups: [], cells: [], hasMatches: false };
    this._renderGrid();
    this._syncSelectionDOM();
  }

  _render() {
    if (typeof document === 'undefined') {
      this._createGrid();
      this._renderGrid();
      OceanMatch3.currentInstance = this;
      return;
    }
    const isDebug = typeof window !== 'undefined' && window.location.search.includes('debug=1');
    const timerLabel = this.mode === 'arcade' ? '0s' : (this._noTimerLimit ? '\u221E' : `${this.timeLimit}s`);
    const initialCombosText = this.mode === 'arcade'
      ? `\u2B50 0 \u00B7 ${this._getStageInfoText()} \u00B7 Combina\u00E7\u00F5es: 0 / ${this.targetCombinations}`
      : `Combina\u00E7\u00F5es: 0 / ${this.targetCombinations}`;

    this.rootElement = document.createElement('div');
    this.rootElement.className = 'ocean-match3';
    this.rootElement.innerHTML = `
      <div class="ocean-match3-hud">
        <span class="ocean-match3-hud-combos">${initialCombosText}</span>
        <span class="ocean-match3-hud-timer">Tempo: ${timerLabel}</span>
      </div>
      <div class="ocean-match3-progress">${this._generateProgressHTML()}</div>
      <div class="ocean-match3-arcade-status ocean-match3-hidden" role="status" aria-live="polite"></div>
      <div class="ocean-match3-grid"></div>
      <div class="ocean-match3-invalid-msg ocean-match3-hidden">Essa troca n\u00E3o forma combina\u00E7\u00E3o.</div>
      ${isDebug ? `
      <div class="ocean-match3-debug-btns">
        <button class="ocean-match3-btn ocean-match3-btn-success" data-action="atingir-meta">\u2705 Atingir meta</button>
        <button class="ocean-match3-btn ocean-match3-btn-failure" data-action="encerrar-tempo">\u23F1 Encerrar tempo</button>
      </div>` : ''}
    `;
    this.container.appendChild(this.rootElement);

    this._renderGrid();

    const gridEl = this.rootElement.querySelector('.ocean-match3-grid');
    if (gridEl) {
      this._boundGridClick = (e) => {
        const piece = e.target.closest('.ocean-match3-piece');
        if (!piece) return;
        this._handlePieceClick(
          parseInt(piece.dataset.row, 10),
          parseInt(piece.dataset.col, 10)
        );
      };
      gridEl.addEventListener('click', this._boundGridClick);
    }

    this.rootElement.querySelectorAll('.ocean-match3-btn').forEach(btn => {
      btn.addEventListener('click', () => this._handleAction(btn.dataset.action));
    });

    OceanMatch3.currentInstance = this;
    this._startTimer();
  }

  _renderGrid() {
    const gridEl = (this.rootElement || this.container).querySelector('.ocean-match3-grid');
    if (!gridEl) return;
    gridEl.innerHTML = this._buildGridHTML();
  }

  _buildGridHTML() {
    return this.grid.map((row, r) =>
      row.map((piece, c) => {
        if (piece === OceanMatch3.EMPTY_CELL) {
          return `<button class="ocean-match3-piece ocean-match3-piece--empty" data-row="${r}" data-col="${c}" aria-label="vazio" disabled> </button>`;
        }
        return `<button class="ocean-match3-piece ocean-match3-piece-${piece.type}" data-row="${r}" data-col="${c}" data-type="${piece.type}" aria-label="${piece.type}" aria-pressed="false">${OceanMatch3.PIECE_EMOJI[piece.type]}</button>`;
      }).join('')
    ).join('');
  }

  /* ── HUD ── */

  _generateProgressHTML() {
    const filled = Math.min(this.combinations, this.targetCombinations);
    let html = '';
    for (let i = 0; i < this.targetCombinations; i++) {
      const cls = i < filled ? 'ocean-match3-progress-dot ocean-match3-progress-dot--filled' : 'ocean-match3-progress-dot';
      html += `<span class="${cls}" role="img" aria-label="${i < filled ? 'completado' : 'pendente'}"></span>`;
    }
    return html;
  }

  _updateHUD() {
    const comboEl = (this.rootElement || this.container).querySelector('.ocean-match3-hud-combos');
    if (comboEl) {
      const prefix = this._targetReached ? '\u2714 ' : '';
      if (this.mode === 'arcade') {
        comboEl.textContent = `${prefix}\u2B50 ${this.score} \u00B7 ${this._getStageInfoText()} \u00B7 Combina\u00E7\u00F5es: ${this.combinations} / ${this.targetCombinations}`;
      } else {
        comboEl.textContent = `${prefix}Combina\u00E7\u00F5es: ${this.combinations} / ${this.targetCombinations}`;
      }
    }
    const progEl = (this.rootElement || this.container).querySelector('.ocean-match3-progress');
    if (progEl) {
      progEl.innerHTML = this._generateProgressHTML();
      progEl.classList.toggle('ocean-match3-progress--target-reached', this._targetReached);
    }
    const timerEl = (this.rootElement || this.container).querySelector('.ocean-match3-hud-timer');
    if (timerEl) {
      if (this.mode === 'arcade') {
        timerEl.textContent = `Tempo: ${this.elapsed}s`;
        timerEl.classList.remove('ocean-match3-timer-urgent');
      } else if (this._noTimerLimit) {
        timerEl.textContent = 'Tempo: \u221E';
        timerEl.classList.remove('ocean-match3-timer-urgent');
      } else {
        timerEl.textContent = `Tempo: ${this.timeRemaining}s`;
        timerEl.classList.toggle('ocean-match3-timer-urgent', this.timeRemaining <= 5);
      }
    }
    const statusEl = (this.rootElement || this.container).querySelector('.ocean-match3-arcade-status');
    if (statusEl) {
      const minMoves = this._getMinMovesToWin();
      const waitingForMoves = this.mode === 'arcade' && this._allArcadeGoalsComplete() && this.validSwapCount < minMoves;
      statusEl.textContent = waitingForMoves
        ? `Metas completas! Continue até ${minMoves} jogadas. (${this.validSwapCount}/${minMoves})`
        : '';
      statusEl.classList.toggle('ocean-match3-hidden', !waitingForMoves);
    }
  }

  /* ── Target resolution ── */

  _hasReachedTarget() {
    return (
      this._targetReached ||
      this.combinations >= this.targetCombinations
    );
  }

  /* ── Arcade helpers ── */

  _getArcadeStages() {
    if (this.mode !== 'arcade' || !this.params || !this.params.difficulty || !Array.isArray(this.params.difficulty.stages)) {
      return null;
    }
    return this.params.difficulty.stages;
  }

  _getArcadeStage() {
    const stages = this._getArcadeStages();
    if (!stages || stages.length === 0) return null;
    return stages[this._stageIndex] || null;
  }

  _getStageInfoText() {
    const stages = this._getArcadeStages();
    if (!stages || stages.length === 0) return '';
    return `Est\u00E1gio ${this._stageIndex + 1}/${stages.length}`;
  }

  _advanceArcadeStage() {
    const stages = this._getArcadeStages();
    if (!stages || stages.length === 0) return true;
    if (this._stageIndex < stages.length - 1) {
      this._stageIndex++;
      this.targetCombinations = stages[this._stageIndex].target;
      this._targetReached = false;
      return false;
    }
    return true;
  }

  _getMinMovesToWin() {
    if (this.mode !== 'arcade') return 0;
    return Math.max(0, Number(this.params?.minMovesToWin) || 0);
  }

  _allArcadeGoalsComplete() {
    const stages = this._getArcadeStages();
    return !!(stages && stages.length > 0 && this._stageIndex === stages.length - 1 && this._hasReachedTarget());
  }

  _canCompleteArcade() {
    return this._allArcadeGoalsComplete() && this.validSwapCount >= this._getMinMovesToWin();
  }

  _completeArcadeIfReady() {
    if (!this._canCompleteArcade()) return false;
    this._complete(this._buildResult(true, 'arcade-completo'));
    return true;
  }

  _buildResult(venceu, motivo) {
    if (this.mode === 'arcade') {
      return {
        venceu,
        boardDelta: 0,
        progresso: { atual: this.combinations, objetivo: this.targetCombinations },
        motivo,
        stats: {
          pontuacao: this.score,
          combinacoes: this.combinations,
          cascatas: this._totalCascadeCycles,
          multiplicadorMax: this.maxMultiplicador,
          metasConcluidas: this._allArcadeGoalsComplete() ? this._getArcadeStages().length : this._stageIndex,
          movimentos: this.validSwapCount,
          tempo: Math.round(this.elapsed)
        }
      };
    }
    return {
      venceu,
      boardDelta: venceu ? 3 : 0,
      progresso: { atual: this.combinations, objetivo: this.targetCombinations },
      motivo: venceu ? 'objetivo-concluido' : 'tempo-encerrado',
      stats: { combinacoes: this.combinations, cascatas: this._totalCascadeCycles }
    };
  }

  /* ── Timer ── */

  _startTimer() {
    this._stopTimer();
    if (this._noTimerLimit) {
      this._updateHUD();
      if (this.mode === 'arcade') {
        this.elapsed = 0;
        this._timerInterval = setInterval(() => {
          if (this._completed) return;
          this.elapsed++;
          this._updateHUD();
        }, 1000);
      }
      return;
    }
    this.timeRemaining = this.timeLimit;
    this._updateHUD();
    this._timerInterval = setInterval(() => {
      if (this._completed) return;
      this.timeRemaining--;
      this._updateHUD();
      if (this.timeRemaining <= 0) {
        this._timerTick();
      }
    }, 1000);
  }

  _timerTick() {
    this._stopTimer();
    if (this._completed || !this._started) return;
    const venceu = this._hasReachedTarget();
    if (venceu) {
      this._targetReached = true;
    }
    this._complete(this._buildResult(venceu, venceu ? 'objetivo-concluido' : 'tempo-encerrado'));
  }

  _stopTimer() {
    if (this._timerInterval !== null) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
  }

  /* ── Click handling ── */

  _handlePieceClick(row, col) {
    if (this.interactionLocked || this.isResolving || this._completed) return;
    if (this.grid[row][col] === OceanMatch3.EMPTY_CELL) return;
    if (this.selectedCell === null) {
      this.selectedCell = { row, col };
      this._syncSelectionDOM();
    } else if (this.selectedCell.row === row && this.selectedCell.col === col) {
      this.selectedCell = null;
      this._syncSelectionDOM();
    } else if (this._isAdjacent(this.selectedCell, { row, col })) {
      this._trySwap(this.selectedCell, { row, col });
    } else {
      this.selectedCell = { row, col };
      this._syncSelectionDOM();
    }
  }

  _isAdjacent(a, b) {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
  }

  /* ── Swap with match validation and cascade ── */

  _swapCells(a, b) {
    const cellA = this.grid[a.row][a.col];
    const cellB = this.grid[b.row][b.col];
    if (cellA === OceanMatch3.EMPTY_CELL || cellB === OceanMatch3.EMPTY_CELL) return;
    const typeA = cellA.type;
    const typeB = cellB.type;
    cellA.type = typeB;
    cellB.type = typeA;
    this.swapCount++;
    this.lastSwap = {
      from: { row: a.row, col: a.col, type: typeA },
      to: { row: b.row, col: b.col, type: typeB },
      valid: false,
    };
  }

  async _trySwap(a, b) {
    this.isResolving = true;

    const cellA = this.grid[a.row][a.col];
    const cellB = this.grid[b.row][b.col];
    if (cellA === OceanMatch3.EMPTY_CELL || cellB === OceanMatch3.EMPTY_CELL) {
      this.isResolving = false;
      return;
    }
    const typeA = cellA.type;
    const typeB = cellB.type;

    const preMatches = this._findMatches(this.grid);
    const preCellSet = new Set(preMatches.cells.map(c => `${c.row},${c.col}`));

    this._swapCells(a, b);

    this._renderGrid();

    const postMatches = this._findMatches(this.grid);
    const isValid = this._isValidSwap(postMatches, preCellSet, a, b);

    this.lastSwap.valid = isValid;

    if (isValid) {
      audioManager.play('match3Swap');
      this.validSwapCount++;
      this.lastMatches = postMatches;
      this.selectedCell = null;
      this._syncSelectionDOM();
      this._highlightMatches(postMatches);
      await this._wait(300);
      await this._resolveCascade(postMatches);
      this.lastMatches = this._findMatches(this.grid);
    } else {
      this.invalidSwapCount++;
      this.selectedCell = null;
      this._syncSelectionDOM();
      this._showInvalidFeedback(a, b);
      await this._wait(300);
      this.grid[a.row][a.col].type = typeA;
      this.grid[b.row][b.col].type = typeB;
      this.lastSwap.valid = false;
      this._renderGrid();
      this._syncSelectionDOM();
      this._hideInvalidFeedback();
      this.lastMatches = this._findMatches(this.grid);
    }

    this.isResolving = false;
  }

  _isValidSwap(postMatches, preCellSet, cellA, cellB) {
    const involvedGroups = postMatches.groups.filter(group =>
      group.cells.some(cell =>
        (cell.row === cellA.row && cell.col === cellA.col) ||
        (cell.row === cellB.row && cell.col === cellB.col)
      )
    );
    return involvedGroups.some(group =>
      group.cells.some(cell => {
        const key = `${cell.row},${cell.col}`;
        return !preCellSet.has(key);
      })
    );
  }

  _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /* ── Removal, Gravity, Fill, Cascade ── */

  _removeMatches(matchResult) {
    for (const cell of matchResult.cells) {
      this.grid[cell.row][cell.col] = OceanMatch3.EMPTY_CELL;
    }
    if (matchResult.cells.length > 0) {
      audioManager.play('match3Match');
    }
    this.combinations += matchResult.groups.length;
    if (this.mode === 'arcade') {
      const perCombo = this.params && this.params.score ? (Number(this.params.score.perCombo) || 0) : 0;
      const multiplier = Math.min(this.cascadeCycles + 1, 4);
      this.maxMultiplicador = Math.max(this.maxMultiplicador, multiplier);
      this.score += matchResult.groups.length * perCombo * multiplier;
    }
  }

  _applyGravity() {
    for (let c = 0; c < 6; c++) {
      const nonNull = [];
      for (let r = 0; r < 6; r++) {
        if (this.grid[r][c] !== OceanMatch3.EMPTY_CELL) nonNull.push(this.grid[r][c]);
      }
      const emptyCount = 6 - nonNull.length;
      for (let r = 0; r < 6; r++) {
        if (r < emptyCount) {
          this.grid[r][c] = OceanMatch3.EMPTY_CELL;
        } else {
          this.grid[r][c] = nonNull[r - emptyCount];
          this.grid[r][c].row = r;
          this.grid[r][c].col = c;
        }
      }
    }
  }

  _fillEmptyCells() {
    const types = OceanMatch3.PIECE_TYPES;
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        if (this.grid[r][c] === OceanMatch3.EMPTY_CELL) {
          this.grid[r][c] = {
            type: types[Math.floor(Math.random() * types.length)],
            row: r,
            col: c,
          };
        }
      }
    }
  }

  async _resolveCascade(initialMatches) {
    this.cascadeCycles = 0;
    let currentMatches = initialMatches;

    while (this.cascadeCycles < 5 && currentMatches.hasMatches) {
      this._removeMatches(currentMatches);
      this._applyRemovalAnimation(currentMatches);
      await this._wait(200);
      this._renderGrid();

      this._applyGravity();
      this._renderGrid();
      this._applyFallAnimation();
      await this._wait(150);

      this._fillEmptyCells();
      this._renderGrid();
      await this._wait(100);

      this.cascadeCycles++;
      this._totalCascadeCycles++;
      this._updateHUD();

      if (this.mode === 'arcade') {
        if (this._hasReachedTarget()) {
          if (this._advanceArcadeStage()) {
            this._targetReached = true;
            if (this._completeArcadeIfReady()) return;
          }
          this._updateHUD();
        }
      } else if (!this._targetReached && this.combinations >= this.targetCombinations) {
        this._targetReached = true;
        this._updateHUD();
      }

      currentMatches = this._findMatches(this.grid);
    }
  }

  _applyRemovalAnimation(matchResult) {
    const gridEl = (this.rootElement || this.container).querySelector('.ocean-match3-grid');
    if (!gridEl) return;
    for (const cell of matchResult.cells) {
      const el = gridEl.querySelector(`[data-row="${cell.row}"][data-col="${cell.col}"]`);
      if (el) el.classList.add('ocean-match3-piece--removing');
    }
  }

  _applyFallAnimation() {
    const gridEl = (this.rootElement || this.container).querySelector('.ocean-match3-grid');
    if (!gridEl) return;
    gridEl.querySelectorAll('.ocean-match3-piece').forEach(el => {
      if (!el.classList.contains('ocean-match3-piece--empty')) {
        el.classList.add('ocean-match3-piece--falling');
      }
    });
  }

  /* ── Match detection ── */

  _findHorizontalMatches(grid) {
    const groups = [];
    for (let r = 0; r < grid.length; r++) {
      let start = 0;
      const row = grid[r];
      while (start < row.length) {
        if (row[start] === OceanMatch3.EMPTY_CELL) { start++; continue; }
        const type = row[start].type;
        let end = start + 1;
        while (end < row.length && row[end] !== OceanMatch3.EMPTY_CELL && row[end].type === type) end++;
        const len = end - start;
        if (len >= 3) {
          const cells = [];
          for (let c = start; c < end; c++) cells.push({ row: r, col: c });
          groups.push({ direction: 'horizontal', type, cells });
        }
        start = end;
      }
    }
    return groups;
  }

  _findVerticalMatches(grid) {
    const groups = [];
    const rows = grid.length;
    const cols = grid[0].length;
    for (let c = 0; c < cols; c++) {
      let start = 0;
      while (start < rows) {
        if (grid[start][c] === OceanMatch3.EMPTY_CELL) { start++; continue; }
        const type = grid[start][c].type;
        let end = start + 1;
        while (end < rows && grid[end][c] !== OceanMatch3.EMPTY_CELL && grid[end][c].type === type) end++;
        const len = end - start;
        if (len >= 3) {
          const cells = [];
          for (let r = start; r < end; r++) cells.push({ row: r, col: c });
          groups.push({ direction: 'vertical', type, cells });
        }
        start = end;
      }
    }
    return groups;
  }

  _findMatches(grid) {
    grid = grid || this.grid;
    const hGroups = this._findHorizontalMatches(grid);
    const vGroups = this._findVerticalMatches(grid);
    const groups = [...hGroups, ...vGroups];
    const cellSet = new Set();
    const cells = [];
    for (const group of groups) {
      for (const cell of group.cells) {
        const key = `${cell.row},${cell.col}`;
        if (!cellSet.has(key)) {
          cellSet.add(key);
          cells.push({ row: cell.row, col: cell.col });
        }
      }
    }
    return { groups, cells, hasMatches: groups.length > 0 };
  }

  /* ── Visual feedback ── */

  _highlightMatches(matchResult) {
    const gridEl = (this.rootElement || this.container).querySelector('.ocean-match3-grid');
    if (!gridEl) return;
    for (const cell of matchResult.cells) {
      const piece = gridEl.querySelector(`[data-row="${cell.row}"][data-col="${cell.col}"]`);
      if (piece) piece.classList.add('ocean-match3-piece--matched');
    }
  }

  _clearHighlight() {
    const gridEl = (this.rootElement || this.container).querySelector('.ocean-match3-grid');
    if (!gridEl) return;
    gridEl.querySelectorAll('.ocean-match3-piece--matched').forEach(p => p.classList.remove('ocean-match3-piece--matched'));
  }

  _showInvalidFeedback(a, b) {
    const gridEl = (this.rootElement || this.container).querySelector('.ocean-match3-grid');
    if (gridEl) {
      gridEl.querySelectorAll('.ocean-match3-piece').forEach(p => {
        const r = parseInt(p.dataset.row, 10);
        const c = parseInt(p.dataset.col, 10);
        if ((r === a.row && c === a.col) || (r === b.row && c === b.col)) {
          p.classList.add('ocean-match3-piece--invalid');
        }
      });
    }
    const msgEl = (this.rootElement || this.container).querySelector('.ocean-match3-invalid-msg');
    if (msgEl) msgEl.classList.remove('ocean-match3-hidden');
  }

  _hideInvalidFeedback() {
    const gridEl = (this.rootElement || this.container).querySelector('.ocean-match3-grid');
    if (gridEl) {
      gridEl.querySelectorAll('.ocean-match3-piece--invalid').forEach(p => p.classList.remove('ocean-match3-piece--invalid'));
    }
    const msgEl = (this.rootElement || this.container).querySelector('.ocean-match3-invalid-msg');
    if (msgEl) msgEl.classList.add('ocean-match3-hidden');
  }

  _clearSelection() {
    this.selectedCell = null;
    this._syncSelectionDOM();
  }

  _syncSelectionDOM() {
    const gridEl = (this.rootElement || this.container).querySelector('.ocean-match3-grid');
    if (!gridEl) return;
    gridEl.querySelectorAll('.ocean-match3-piece').forEach(p => {
      p.classList.remove('selected');
      p.setAttribute('aria-pressed', 'false');
    });
    if (this.selectedCell) {
      const sel = gridEl.querySelector(
        `[data-row="${this.selectedCell.row}"][data-col="${this.selectedCell.col}"]`
      );
      if (sel) {
        sel.classList.add('selected');
        sel.setAttribute('aria-pressed', 'true');
      }
    }
  }

  _animateSwap(a, b) {
    const gridEl = (this.rootElement || this.container).querySelector('.ocean-match3-grid');
    if (!gridEl) return;
    gridEl.querySelectorAll('.ocean-match3-piece').forEach(p => {
      const r = parseInt(p.dataset.row, 10);
      const c = parseInt(p.dataset.col, 10);
      if ((r === a.row && c === a.col) || (r === b.row && c === b.col)) {
        p.classList.add('ocean-match3-swapped');
        setTimeout(() => p.classList.remove('ocean-match3-swapped'), 200);
      }
    });
  }

  /* ── Public API ── */

  regenerateGrid() {
    if (this.isResolving) return;
    this._createGrid();
    this.selectedCell = null;
    this.lastSwap = null;
    this.swapCount = 0;
    this.validSwapCount = 0;
    this.invalidSwapCount = 0;
    this.combinations = 0;
    this.cascadeCycles = 0;
    this._totalCascadeCycles = 0;
    this.lastMatches = { groups: [], cells: [], hasMatches: false };
    this.score = 0;
    this.maxMultiplicador = 0;
    this._stageIndex = 0;
    this.elapsed = 0;
    this.targetCombinations = 5;
    const arcadeStages = this.mode === 'arcade' ? this._getArcadeStages() : null;
    if (arcadeStages && arcadeStages.length > 0) {
      this.targetCombinations = arcadeStages[0].target;
    }
    this._renderGrid();
    this._syncSelectionDOM();
    this._hideInvalidFeedback();
    this._updateHUD();
  }

  getDebugState() {
    if (!this._started || !this.grid) {
      return { active: false, valid: false, message: 'Ocean Match-3 n\u00E3o est\u00E1 ativo.' };
    }
    let totalPieces = 0;
    let emptyCells = 0;
    const emptyCoordinates = [];
    for (const row of this.grid) {
      for (const cell of row) {
        if (cell === OceanMatch3.EMPTY_CELL) {
          emptyCells++;
        } else {
          totalPieces++;
        }
      }
    }
    for (let r = 0; r < this.grid.length; r++) {
      for (let c = 0; c < this.grid[r].length; c++) {
        if (this.grid[r][c] === OceanMatch3.EMPTY_CELL) {
          emptyCoordinates.push({ row: r, col: c });
        }
      }
    }
    const valid = this.grid.length === 6 && this.grid.every(r => r.length === 6);
    const matchGroups = (this.lastMatches.groups || []).map(g => ({
      direction: g.direction,
      type: g.type,
      cells: g.cells.map(c => ({ row: c.row, col: c.col })),
    }));
    const matchedCells = (this.lastMatches.cells || []).map(c => ({ row: c.row, col: c.col }));
    return {
      active: true,
      valid,
      rows: this.grid.length,
      totalPieces,
      emptyCells,
      emptyCoordinates,
      selectedCell: this.selectedCell ? { row: this.selectedCell.row, col: this.selectedCell.col } : null,
      lastSwap: this.lastSwap
        ? {
            from: { row: this.lastSwap.from.row, col: this.lastSwap.from.col, type: this.lastSwap.from.type },
            to: { row: this.lastSwap.to.row, col: this.lastSwap.to.col, type: this.lastSwap.to.type },
            valid: this.lastSwap.valid,
          }
        : null,
      swapCount: this.swapCount,
      validSwapCount: this.validSwapCount,
      invalidSwapCount: this.invalidSwapCount,
      combinations: this.combinations,
      timeLimit: this.timeLimit,
      timeRemaining: this.timeRemaining,
      noTimerLimit: this._noTimerLimit,
      cascadeCycles: this.cascadeCycles,
      totalCascadeCycles: this._totalCascadeCycles,
      matchGroups,
      matchedCells,
      isResolving: this.isResolving,
      completed: this._completed,
    };
  }

  _handleAction(action) {
    if (this.interactionLocked) return;
    if (action === 'vitoria') {
      this.combinations = Math.max(this.combinations, this.targetCombinations);
      this._targetReached = true;
      this._complete(this._buildResult(true, 'objetivo-concluido'));
      return;
    }
    if (action === 'tempo') {
      this._complete(this._buildResult(this._hasReachedTarget(), 'tempo-encerrado'));
      return;
    }
    if (action === 'atingir-meta') {
      if (!this._targetReached) {
        this.combinations = Math.max(this.combinations, this.targetCombinations);
        this._targetReached = true;
        this._updateHUD();
      }
    } else if (action === 'encerrar-tempo') {
      const venceu = this._hasReachedTarget();
      if (venceu) {
        this._targetReached = true;
      }
      this._complete(this._buildResult(venceu, venceu ? 'objetivo-concluido' : 'tempo-encerrado'));
    }
  }

  /* ── Bot preview (visual only, no model changes) ── */

  startBotPreview() {
    this.interactionLocked = true;
    if (typeof document === 'undefined') return;
    const root = this.rootElement || this.container;
    if (!root) return;
    const pieces = [...(root.querySelectorAll('.ocean-match3-piece') || [])];
    if (pieces.length === 0) return;
    this._botPreviewInterval = setInterval(() => {
      if (!this.interactionLocked) return;
      const shuffled = [...pieces].sort(() => Math.random() - 0.5);
      const chosen = shuffled.slice(0, 3).filter(Boolean);
      chosen.forEach(p => p.classList.add('bot-glow'));
      setTimeout(() => {
        chosen.forEach(p => p.classList.remove('bot-glow'));
      }, 500);
    }, 800);
  }

  stopBotPreview() {
    this.interactionLocked = false;
    if (this._botPreviewInterval) {
      clearInterval(this._botPreviewInterval);
      this._botPreviewInterval = null;
    }
    if (typeof document === 'undefined') return;
    const root = this.rootElement || this.container;
    if (!root) return;
    root.querySelectorAll('.ocean-match3-piece.bot-glow').forEach(p => p.classList.remove('bot-glow'));
  }

  _complete(result) {
    if (this._completed) return;
    this._completed = true;
    this._stopTimer();
    if (typeof this.onComplete === 'function') {
      this.onComplete(result);
    }
  }

  destroy() {
    this.stopBotPreview();
    this._stopTimer();
    if (OceanMatch3.currentInstance === this) {
      OceanMatch3.currentInstance = null;
    }
    this._completed = true;
    this._started = false;
    this._targetReached = false;
    this.grid = null;
    this.selectedCell = null;
    this.lastSwap = null;
    this.swapCount = 0;
    this.validSwapCount = 0;
    this.invalidSwapCount = 0;
    this.combinations = 0;
    this.cascadeCycles = 0;
    this._totalCascadeCycles = 0;
    this.score = 0;
    this.maxMultiplicador = 0;
    this._stageIndex = 0;
    this.elapsed = 0;
    this.lastMatches = { groups: [], cells: [], hasMatches: false };
    this.isResolving = false;
    if (this._boundGridClick) {
      const gridEl = (this.rootElement || this.container).querySelector('.ocean-match3-grid');
      if (gridEl) gridEl.removeEventListener('click', this._boundGridClick);
      this._boundGridClick = null;
    }
    if (this.rootElement && this.rootElement.parentNode) {
      this.rootElement.parentNode.removeChild(this.rootElement);
    }
    this.rootElement = null;
    this.container.style.aspectRatio = '';
    this.container.style.minHeight = '';
  }

  stop() {
    this.destroy();
  }
}
