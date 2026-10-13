import { PAIR_ASSETS, PAIR_KEYS, BOARD_PAIR_KEYS, CARD_BACK_URL, CARD_BACK_EMOJI } from './memoryAssets.js';
import { audioManager } from '../../audio/index.js';

const TIME_LIMIT = 30;
const PAIRS_TOTAL = 6;
const VICTORY_THRESHOLD = 4;
const FLIP_DELAY = 700;

export class MemoryGame {
  constructor(container, onComplete, options = {}) {
    this._container = container;
    this._onComplete = onComplete;
    this._flipped = [];
    this._matchedPairs = 0;
    this._locked = false;
    this.mode = options.mode === 'arcade' ? 'arcade' : 'board';
    this.params = this.mode === 'arcade' ? (options.params || null) : null;
    this._timeLimit = this.mode === 'arcade' && Number(this.params?.timeLimit) > 0
      ? Number(this.params.timeLimit)
      : TIME_LIMIT;
    this._timeLeft = this._timeLimit;
    this._pairCount = this.mode === 'arcade'
      ? Math.min(PAIR_KEYS.length, Math.max(1, Number(this.params?.pairCount) || PAIRS_TOTAL))
      : PAIRS_TOTAL;
    this._selectedPairKeys = [];
    this._completed = false;
    this._started = false;
    this._destroyed = false;

    this._rootEl = null;
    this._hudEl = null;
    this._timerEl = null;
    this._pairsEl = null;
    this._boardEl = null;

    this._timerInterval = null;
    this._flipTimeout = null;
    this._botInterval = null;
    this._assetReady = {};
    this._cardBackReady = false;

    this._boundOnCardClick = this._onCardClick.bind(this);
  }

  start() {
    if (this._started) return;
    this._started = true;
    this._preloadAssets();
    this._buildBoard();
    this._startTimer();
  }

  stop() {
    this.abort();
  }

  abort() {
    if (this._completed) return;
    this._completed = true;
    this._clearTimers();
    if (this._boardEl) {
      this._boardEl.removeEventListener('click', this._boundOnCardClick);
    }
    this._flipped = [];
    this._locked = false;
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this._clearTimers();
    if (this._boardEl) {
      this._boardEl.removeEventListener('click', this._boundOnCardClick);
    }
    this._removeGameRoot();
    this._onComplete = null;
    this._container = null;
  }

  _clearTimers() {
    if (this._timerInterval) { clearInterval(this._timerInterval); this._timerInterval = null; }
    if (this._flipTimeout) { clearTimeout(this._flipTimeout); this._flipTimeout = null; }
    if (this._botInterval) { clearInterval(this._botInterval); this._botInterval = null; }
  }

  _removeGameRoot() {
    if (this._rootEl && this._rootEl.parentNode) {
      this._rootEl.parentNode.removeChild(this._rootEl);
    }
    this._rootEl = null;
    this._hudEl = null;
    this._timerEl = null;
    this._pairsEl = null;
    this._boardEl = null;
  }

  _preloadAssets() {
    for (const key of PAIR_KEYS) {
      if (!PAIR_ASSETS[key].url) {
        this._assetReady[key] = false;
        continue;
      }
      const img = new Image();
      img.onload = () => {
        const valid = img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
        this._assetReady[key] = valid;
        if (valid) this._applyCardVisuals(key);
      };
      img.onerror = () => { this._assetReady[key] = false; };
      img.src = PAIR_ASSETS[key].url;
    }

    const backImg = new Image();
    backImg.onload = () => {
      const valid = backImg.complete && backImg.naturalWidth > 0 && backImg.naturalHeight > 0;
      this._cardBackReady = valid;
      if (valid) this._applyCardBackVisual();
    };
    backImg.onerror = () => { this._cardBackReady = false; };
    backImg.src = CARD_BACK_URL;
  }

  _applyCardVisuals(pairKey) {
    if (!this._boardEl) return;
    const targets = this._boardEl.querySelectorAll(`.mem-card[data-pair="${pairKey}"] .mem-card-back`);
    targets.forEach(el => {
      if (!PAIR_ASSETS[pairKey].url) return;
      el.style.backgroundImage = `url(${PAIR_ASSETS[pairKey].url})`;
      el.style.backgroundSize = 'contain';
      el.style.backgroundRepeat = 'no-repeat';
      el.style.backgroundPosition = 'center';
      el.textContent = '';
    });
  }

  _applyCardBackVisual() {
    if (!this._boardEl) return;
    const fronts = this._boardEl.querySelectorAll('.mem-card-front');
    fronts.forEach(el => {
      el.style.backgroundImage = `url(${CARD_BACK_URL})`;
      el.style.backgroundSize = 'cover';
      el.style.backgroundRepeat = 'no-repeat';
      el.style.backgroundPosition = 'center';
      el.textContent = '';
    });
  }

  startBotPreview() {
    if (this._botInterval) return;
    this._botInterval = setInterval(() => {
      if (this._completed || !this._boardEl) { this.stopBotPreview(); return; }
      const cards = this._boardEl.querySelectorAll('.mem-card:not(.matched):not(.flipped)');
      if (cards.length === 0) { this.stopBotPreview(); return; }
      const idx = Math.floor(Math.random() * cards.length);
      cards[idx].click();
    }, 1200);
  }

  stopBotPreview() {
    if (this._botInterval) { clearInterval(this._botInterval); this._botInterval = null; }
  }

  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  _selectPairKeys() {
    const pairPool = this.mode === 'arcade' ? [...PAIR_KEYS] : [...BOARD_PAIR_KEYS];
    return this._shuffle(pairPool).slice(0, this._pairCount);
  }

  _createDeck() {
    this._selectedPairKeys = this._selectPairKeys();
    return this._shuffle([...this._selectedPairKeys, ...this._selectedPairKeys]);
  }

  _buildBoard() {
    this._removeGameRoot();

    const deck = this._createDeck();

    this._rootEl = document.createElement('div');
    this._rootEl.className = 'memory-game-root';

    this._hudEl = document.createElement('div');
    this._hudEl.className = 'mem-hud';

    this._timerEl = document.createElement('div');
    this._timerEl.className = 'mem-timer';
    this._timerEl.textContent = `\u23F1 ${this._timeLimit}s`;
    this._timerEl.setAttribute('role', 'timer');
    this._timerEl.setAttribute('aria-label', 'Tempo restante');

    this._pairsEl = document.createElement('div');
    this._pairsEl.className = 'mem-pairs';
    this._pairsEl.textContent = `Pares: 0/${this._pairCount}`;
    this._pairsEl.setAttribute('aria-label', 'Pares encontrados');

    this._hudEl.appendChild(this._timerEl);
    this._hudEl.appendChild(this._pairsEl);

    this._boardEl = document.createElement('div');
    this._boardEl.className = 'mem-board';
    this._boardEl.setAttribute('role', 'grid');
    this._boardEl.setAttribute('aria-label', 'Tabuleiro do Jogo da Mem\u00F3ria');

    deck.forEach((pairKey, i) => {
      const asset = PAIR_ASSETS[pairKey];

      const card = document.createElement('div');
      card.className = 'mem-card';
      card.dataset.index = i;
      card.dataset.emoji = asset.emoji;
      card.dataset.pair = pairKey;
      card.setAttribute('role', 'gridcell');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', 'Carta virada');

      const inner = document.createElement('div');
      inner.className = 'mem-card-inner';

      const front = document.createElement('div');
      front.className = 'mem-card-front';
      front.textContent = CARD_BACK_EMOJI;

      const back = document.createElement('div');
      back.className = 'mem-card-back';
      back.textContent = asset.emoji;

      if (this._assetReady[pairKey] && asset.url) {
        back.style.backgroundImage = `url(${asset.url})`;
        back.style.backgroundSize = 'contain';
        back.style.backgroundRepeat = 'no-repeat';
        back.style.backgroundPosition = 'center';
        back.textContent = '';
      }

      inner.appendChild(front);
      inner.appendChild(back);
      card.appendChild(inner);
      this._boardEl.appendChild(card);
    });

    if (this._cardBackReady) {
      const fronts = this._boardEl.querySelectorAll('.mem-card-front');
      fronts.forEach(el => {
        el.style.backgroundImage = `url(${CARD_BACK_URL})`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundRepeat = 'no-repeat';
        el.style.backgroundPosition = 'center';
        el.textContent = '';
      });
    }

    this._boardEl.addEventListener('click', this._boundOnCardClick);

    this._rootEl.appendChild(this._hudEl);
    this._rootEl.appendChild(this._boardEl);
    this._container.appendChild(this._rootEl);
  }

  _onCardClick(e) {
    const card = e.target.closest('.mem-card');
    if (!card || this._locked || this._completed) return;
    if (card.classList.contains('flipped') || card.classList.contains('matched')) return;
    if (this._flipped.length >= 2) return;

    card.classList.add('flipped');
    card.setAttribute('aria-label', `Carta: ${card.dataset.emoji}`);
    this._flipped.push(card);
    audioManager.play('memoryFlip');

    if (this._flipped.length === 2) {
      this._locked = true;
      const [a, b] = this._flipped;
      if (a.dataset.emoji === b.dataset.emoji) {
        audioManager.play('memoryMatch');
        a.classList.add('matched');
        b.classList.add('matched');
        this._matchedPairs++;
        if (this._pairsEl) {
          this._pairsEl.textContent = `Pares: ${this._matchedPairs}/${this._pairCount}`;
        }
        this._flipped = [];
        this._locked = false;

        const victoryPairs = this.mode === 'arcade'
          ? (Number(this.params?.difficulty?.victoryPairs) || this._pairCount)
          : PAIRS_TOTAL;
        if (this._matchedPairs >= victoryPairs) {
          this._endGame();
        }
      } else {
        audioManager.play('memoryMiss');
        this._flipTimeout = setTimeout(() => {
          a.classList.remove('flipped');
          b.classList.remove('flipped');
          a.setAttribute('aria-label', 'Carta virada');
          b.setAttribute('aria-label', 'Carta virada');
          this._flipped = [];
          this._locked = false;
          this._flipTimeout = null;
        }, FLIP_DELAY);
      }
    }
  }

  _startTimer() {
    this._timerInterval = setInterval(() => {
      this._timeLeft--;
      if (this._timerEl) {
        this._timerEl.textContent = `\u23F1 ${this._timeLeft}s`;
      }
      if (this._timeLeft <= 0) {
        this._endGame();
      }
    }, 1000);
  }

  _endGame() {
    if (this._completed) return;
    this._completed = true;
    this._clearTimers();

    if (this._boardEl) {
      this._boardEl.removeEventListener('click', this._boundOnCardClick);
    }
    this._flipped = [];
    this._locked = false;

    const paresEncontrados = this._matchedPairs;
    const percentual = Math.round((paresEncontrados / this._pairCount) * 100);
    const objetivo = this.mode === 'arcade'
      ? (Number(this.params?.difficulty?.victoryPairs) || this._pairCount)
      : PAIRS_TOTAL;
    const venceu = paresEncontrados >= (this.mode === 'arcade' ? objetivo : VICTORY_THRESHOLD);

    if (this.mode === 'arcade') {
      const perPair = Number(this.params?.score?.perPair) || 0;
      const timeBonus = venceu ? (Number(this.params?.score?.timeBonusPerSecond) || 0) * this._timeLeft : 0;
      this._onComplete?.({
        venceu,
        boardDelta: 0,
        progresso: { atual: paresEncontrados, objetivo },
        motivo: venceu ? 'todos-os-pares' : 'tempo-esgotado',
        stats: {
          pontuacao: paresEncontrados * perPair + timeBonus,
          paresEncontrados,
          tempo: this._timeLeft
        }
      });
      return;
    }

    if (this._onComplete) {
      this._onComplete({
        venceu,
        boardDelta: venceu ? 3 : 0,
        progresso: { atual: paresEncontrados, objetivo: PAIRS_TOTAL },
        motivo: venceu ? 'pares-suficientes' : 'tempo-esgotado',
        stats: {
          paresEncontrados,
          totalPares: this._pairCount,
          percentual,
        },
      });
    }
  }
}
