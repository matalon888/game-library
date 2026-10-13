export function normalizeMinigameResult(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('normalizeMinigameResult: result must be a non-null object');
  }

  const venceu = raw.venceu === true;

  const boardDeltaRaw = Number(raw.boardDelta);
  const boardDelta = Number.isFinite(boardDeltaRaw) ? Math.round(boardDeltaRaw) : 0;

  const progressoRaw = raw.progresso || {};
  const progressoAtual = Number.isFinite(Number(progressoRaw.atual)) ? Number(progressoRaw.atual) : 0;
  const progressoObjetivo = Number.isFinite(Number(progressoRaw.objetivo)) ? Number(progressoRaw.objetivo) : 0;

  const motivo = typeof raw.motivo === 'string' && raw.motivo.length > 0 ? raw.motivo : (venceu ? 'missao-completa' : 'missao-falhou');

  const stats = (raw.stats && typeof raw.stats === 'object' && !Array.isArray(raw.stats))
    ? { ...raw.stats }
    : {};

  return {
    venceu,
    boardDelta,
    progresso: {
      atual: progressoAtual,
      objetivo: progressoObjetivo
    },
    motivo,
    stats
  };
}
