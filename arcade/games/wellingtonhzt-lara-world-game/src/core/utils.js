export function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function getDadoEmoji(valor) {
  return ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][valor - 1] || "🎲";
}

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
