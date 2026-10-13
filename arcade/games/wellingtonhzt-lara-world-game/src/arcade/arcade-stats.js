const STORAGE_KEY = 'lara-world-arcade-stats';
const SCHEMA_VERSION = 1;

function createEmptyStats() {
  return { version: SCHEMA_VERSION, games: {} };
}

function createEmptyGameStats() {
  return {
    partidas: 0,
    vitorias: 0,
    derrotas: 0,
    sequenciaAtual: 0,
    sequenciaMaxima: 0,
    tempoTotalJogado: 0,
    ultimaJogada: null,
    ultimoResultado: null,
    records: {},
  };
}

function normalizeCounter(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

function normalizeGameStats(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    ...createEmptyGameStats(),
    ...source,
    partidas: normalizeCounter(source.partidas),
    vitorias: normalizeCounter(source.vitorias),
    derrotas: normalizeCounter(source.derrotas),
    sequenciaAtual: normalizeCounter(source.sequenciaAtual),
    sequenciaMaxima: normalizeCounter(source.sequenciaMaxima),
    tempoTotalJogado: normalizeCounter(source.tempoTotalJogado),
    records: source.records && typeof source.records === 'object' && !Array.isArray(source.records)
      ? { ...source.records }
      : {},
  };
}

function safeResult(result) {
  if (!result || typeof result !== 'object') return null;
  return {
    venceu: result.venceu === true,
    stats: (result.stats && typeof result.stats === 'object' && !Array.isArray(result.stats))
      ? { ...result.stats }
      : {},
  };
}

export function loadStats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyStats();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return createEmptyStats();
    if (parsed.version !== SCHEMA_VERSION) return createEmptyStats();
    if (!parsed.games || typeof parsed.games !== 'object') {
      parsed.games = {};
    }
    for (const gameId of Object.keys(parsed.games)) {
      parsed.games[gameId] = normalizeGameStats(parsed.games[gameId]);
    }
    return parsed;
  } catch {
    return createEmptyStats();
  }
}

export function saveStats(stats) {
  try {
    if (!stats || typeof stats !== 'object') return false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    return true;
  } catch {
    return false;
  }
}

export function recordGame(minigameId, result, durationMs) {
  try {
    const stats = loadStats();
    if (!stats.games[minigameId]) {
      stats.games[minigameId] = createEmptyGameStats();
    }
    const mg = stats.games[minigameId];
    const venceu = !!(result && result.venceu);

    mg.partidas++;
    if (venceu) {
      mg.vitorias++;
      mg.sequenciaAtual++;
      if (mg.sequenciaAtual > mg.sequenciaMaxima) {
        mg.sequenciaMaxima = mg.sequenciaAtual;
      }
    } else {
      mg.derrotas++;
      mg.sequenciaAtual = 0;
    }
    if (typeof durationMs === 'number' && durationMs > 0) {
      mg.tempoTotalJogado += Math.round(durationMs);
    }
    mg.ultimaJogada = Date.now();
    mg.ultimoResultado = safeResult(result);

    if (mg.ultimoResultado && mg.ultimoResultado.stats) {
      for (const [key, value] of Object.entries(mg.ultimoResultado.stats)) {
        if (typeof value !== 'number' || !Number.isFinite(value)) continue;
        const prev = typeof mg.records[key] === 'number' ? mg.records[key] : 0;
        if (value > prev) {
          mg.records[key] = value;
        }
      }
    }

    saveStats(stats);
    return stats;
  } catch {
    return null;
  }
}

export function getMinigameStats(minigameId) {
  try {
    const stats = loadStats();
    return stats.games[minigameId] || createEmptyGameStats();
  } catch {
    return createEmptyGameStats();
  }
}

export function getWinRate(minigameId) {
  const mg = getMinigameStats(minigameId);
  if (mg.partidas === 0) return null;
  return Math.round((mg.vitorias / mg.partidas) * 100);
}

export function formatDurationMs(ms) {
  if (typeof ms !== 'number' || ms <= 0) return '--';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}m ${sec}s`;
}
