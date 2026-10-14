// localStorage wrapper — fails silently in private mode / when quota is full.

const KEY = 'chargefishing_v1';
const DEFAULTS = {
  highscore: 0,
  totalCatches: 0,
  totalScore: 0,
};

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    // Defensive: parsed could be anything if tampered with; only keep
    // numeric fields that match our schema.
    return {
      highscore: typeof parsed.highscore === 'number' ? parsed.highscore : 0,
      totalCatches: typeof parsed.totalCatches === 'number' ? parsed.totalCatches : 0,
      totalScore: typeof parsed.totalScore === 'number' ? parsed.totalScore : 0,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function write(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // private mode / quota / disabled — swallow silently.
  }
}

export function getStats() {
  return read();
}

export function updateHighscoreIfBeat(score) {
  const d = read();
  if (score > d.highscore) {
    d.highscore = score;
    write(d);
    return true;
  }
  return false;
}

export function recordCatch(points) {
  const d = read();
  d.totalCatches += 1;
  d.totalScore += points;
  write(d);
}

export function resetStats() {
  write({ ...DEFAULTS });
}
