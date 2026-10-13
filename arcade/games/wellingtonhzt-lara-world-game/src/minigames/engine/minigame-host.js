import { getMinigame } from './minigame-registry.js';
import { normalizeMinigameResult } from './minigame-result.js';
import { getEffectiveConfig } from './minigame-profiles.js';

const DEFAULT_BOT_DELAY = 6000;

export function launchMinigameHost(id, options = {}) {
  const { isBot = false, playerName = 'Jogador', context = 'board', getStats = null } = options;

  function getReturnPresentation(ctx) {
    if (ctx === 'arcade') {
      return {
        buttonLabel: 'Voltar ao Arcade'
      };
    }
    return {
      buttonLabel: 'Voltar ao tabuleiro',
      countdownLabel: seconds => `Voltando ao tabuleiro em ${seconds}s...`
    };
  }

  const config = getMinigame(id);
  const effective = getEffectiveConfig(id, context);
  const pres = effective.presentation || {};
  const rewards = effective.rewards || {};
  const resultStats = effective.resultStats || [];
  const autoReturn = effective.autoReturnSeconds;
  const botRate = effective.botSuccessRate;
  const successDelta = rewards.successBoardDelta ?? 3;
  const failureDelta = rewards.failureBoardDelta ?? 0;

  const overlay = document.getElementById('minigame-overlay');
  const container = document.getElementById('minigame-container');
  const playPhase = document.getElementById('minigame-phase-play');
  const header = document.querySelector('#minigame-phase-play .minigame-header');
  const titleEl = document.getElementById('minigame-title');
  const instrEl = document.getElementById('minigame-instructions');
  const botBar = document.getElementById('minigame-bot-bar');
  const botText = document.getElementById('minigame-bot-text');
  const skipBtn = document.getElementById('minigame-skip-btn');
  const card = document.getElementById('minigame-result-card');
  const cardIcon = document.getElementById('minigame-card-icon');
  const cardTitle = document.getElementById('minigame-card-title');
  const cardDesc = document.getElementById('minigame-card-desc');
  const bonusEl = document.getElementById('minigame-card-bonus');
  const bonusValue = document.getElementById('minigame-card-bonus-value');
  const cardBtn = document.getElementById('minigame-card-btn');
  const countdownEl = document.getElementById('minigame-card-countdown');
  const cardStats = document.getElementById('minigame-card-stats');

  if (!card) {
    throw new Error('[MinigameHost] #minigame-result-card n\u00E3o encontrado no DOM. Um minigame pode t\u00EA-lo destru\u00EDdo.');
  }

  titleEl.textContent = pres.title || config.name || 'Minigame';
  instrEl.textContent = pres.instruction || '';

  playPhase.classList.remove('hidden');
  header.classList.remove('hidden');
  botBar.classList.add('hidden');
  card.classList.add('hidden');
  bonusEl.classList.add('hidden');
  overlay.classList.remove('hidden');
  container.innerHTML = '';
  container.appendChild(card);

  /* ── Bot mode overlay builder ── */
  function buildBotOverlay() {
    const div = document.createElement('div');
    div.className = 'minigame-bot-overlay';
    div.innerHTML = `
      <div class="bot-overlay-content">
        <div class="bot-overlay-icon">\uD83E\uDD16</div>
        <div class="bot-overlay-label">${pres.botMessage || `${config.name || 'M\u00E1quina'} est\u00E1 jogando...`}</div>
        <div class="minigame-bot-progress-track">
          <div class="minigame-bot-progress-fill"></div>
        </div>
      </div>`;
    return div;
  }
  let botOverlayEl = null;

  return new Promise((resolve) => {
    let gameInstance = null;
    let resolved = false;
    let autoTimer = null;
    let countdownInterval = null;

    function stopBotPresentation() {
      const bp = effective.botPresentation;
      if (bp && typeof bp.stop === 'function') {
        bp.stop(gameInstance);
      }
    }

    function cleanup() {
      if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
      if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
      cardBtn.onclick = null;
      skipBtn.onclick = null;
      stopBotPresentation();
      removeBotOverlay();
      if (gameInstance && typeof gameInstance.destroy === 'function') { gameInstance.destroy(); }
      gameInstance = null;
    }

    function removeBotOverlay() {
      if (botOverlayEl && botOverlayEl.parentNode) {
        botOverlayEl.parentNode.removeChild(botOverlayEl);
      }
      botOverlayEl = null;
      container.classList.remove('bot-active');
    }

    function resolveWith(result) {
      if (resolved) return;
      resolved = true;
      cleanup();
      card.classList.add('hidden');
      header.classList.remove('hidden');
      overlay.classList.add('hidden');
      resolve(result);
    }

    function formatArcadeStat(value, format) {
      if (format === 'multiplier') return `x${value}`;
      if (format === 'percent') return `${value}%`;
      if (format === 'seconds') {
        const seconds = Math.round(value);
        if (seconds < 60) return `${seconds}s`;
        const min = Math.floor(seconds / 60);
        const sec = seconds % 60;
        return `${min}m ${sec < 10 ? '0' : ''}${sec}s`;
      }
      return String(value);
    }

    function getArcadeRecords() {
      if (typeof getStats !== 'function') return {};
      try {
        const mg = getStats();
        return (mg && typeof mg === 'object' && mg.records && typeof mg.records === 'object') ? mg.records : {};
      } catch {
        return {};
      }
    }

    function renderArcadeStats(result) {
      if (!cardStats) return;
      const matchStats = result.stats || {};
      const records = getArcadeRecords();
      const rows = [];
      for (const item of resultStats) {
        const value = matchStats[item.key];
        if (typeof value !== 'number' || !Number.isFinite(value)) continue;
        const record = typeof records[item.key] === 'number' ? records[item.key] : 0;
        const isNew = value > record;
        rows.push(`
          <div class="minigame-card-stat-row${isNew ? ' is-record' : ''}">
            <span class="minigame-card-stat-label">${item.label}</span>
            <span class="minigame-card-stat-value">${formatArcadeStat(value, item.format)}</span>
            ${isNew ? '<span class="minigame-card-stat-new">\u2605 Novo recorde!</span>' : ''}
            ${record > 0 ? `<span class="minigame-card-stat-record">${item.recordLabel || 'Recorde'}: ${formatArcadeStat(record, item.format)}</span>` : ''}
          </div>`);
      }
      cardStats.innerHTML = rows.join('');
      cardStats.classList.toggle('hidden', rows.length === 0);
    }

    function showResult(result) {
      if (context === 'arcade') {
        renderArcadeStats(result);
      } else if (cardStats) {
        cardStats.innerHTML = '';
        cardStats.classList.add('hidden');
      }
      if (result.venceu) {
        cardIcon.textContent = pres.successIcon || '\uD83D\uDE80';
        cardTitle.textContent = pres.successTitle || 'Miss\u00E3o conclu\u00EDda!';
        cardDesc.textContent = pres.successMessage || '';
        if (context === 'board' && result.boardDelta > 0) {
          bonusEl.classList.remove('hidden');
          bonusValue.textContent = `+${result.boardDelta} ${result.boardDelta > 1 ? 'casas' : 'casa'}`;
        }
      } else {
        cardIcon.textContent = pres.failureIcon || '\uD83D\uDCA5';
        cardTitle.textContent = pres.failureTitle || 'Fim da miss\u00E3o';
        cardDesc.textContent = pres.failureMessage || '';
      }
      card.classList.remove('hidden');
      card.scrollTop = 0;
      const cardContent = card.querySelector('.minigame-card-content');
      if (cardContent) cardContent.scrollTop = 0;
    }

    function startReturnCountdown(result) {
      const ret = getReturnPresentation(context);
      cardBtn.textContent = ret.buttonLabel;
      requestAnimationFrame(() => {
        cardBtn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        cardBtn.focus({ preventScroll: true });
      });

      if (context === 'arcade') {
        countdownEl.textContent = '';
        countdownEl.classList.add('hidden');
        cardBtn.onclick = () => resolveWith(result);
        return;
      }

      let count = autoReturn;
      countdownEl.textContent = ret.countdownLabel(count);
      countdownEl.classList.remove('hidden');
      cardBtn.onclick = () => {
        if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
        countdownEl.classList.add('hidden');
        resolveWith(result);
      };
      countdownInterval = setInterval(() => {
        count--;
        if (count <= 0) {
          clearInterval(countdownInterval);
          countdownInterval = null;
          countdownEl.classList.add('hidden');
          resolveWith(result);
        } else {
          countdownEl.textContent = ret.countdownLabel(count);
        }
      }, 1000);
    }

    function onGameComplete(rawResult) {
      if (resolved) return;
      cleanup();
      header.classList.add('hidden');
      botBar.classList.add('hidden');
      const normalized = normalizeMinigameResult(rawResult);
      showResult(normalized);
      startReturnCountdown(normalized);
    }

    function autoResolveBot() {
      if (resolved) return;
      const sucesso = Math.random() < botRate;
      const delta = sucesso ? successDelta : failureDelta;
      const result = normalizeMinigameResult({
        venceu: sucesso,
        boardDelta: delta,
        progresso: { atual: sucesso ? 3 : 0, objetivo: 3 },
        motivo: sucesso ? 'completo' : 'sem-vidas',
        stats: {}
      });
      cleanup();
      header.classList.add('hidden');
      botBar.classList.add('hidden');
      showResult(result);
      startReturnCountdown(result);
    }

    gameInstance = config.create({
      container,
      onComplete: onGameComplete,
      context
    });

    if (isBot) {
      container.classList.add('bot-active');
      botOverlayEl = buildBotOverlay();
      container.appendChild(botOverlayEl);

      const bp = effective.botPresentation;
      if (bp && typeof bp.start === 'function') {
        bp.start(gameInstance);
      }

      botBar.classList.remove('hidden');
      if (botText && pres.botMessage) {
        botText.textContent = pres.botMessage;
      }
      skipBtn.onclick = () => {
        if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
        removeBotOverlay();
        autoResolveBot();
      };
      autoTimer = setTimeout(() => {
        removeBotOverlay();
        autoResolveBot();
      }, DEFAULT_BOT_DELAY);
    }
  });
}
