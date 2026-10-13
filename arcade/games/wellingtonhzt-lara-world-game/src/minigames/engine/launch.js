import { getMinigame } from './minigame-registry.js';
import { normalizeMinigameResult } from './minigame-result.js';

export function launchMinigame(id, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const config = getMinigame(id);
      const instance = config.create({
        ...options,
        onComplete(rawResult) {
          try {
            const normalized = normalizeMinigameResult(rawResult);
            resolve(normalized);
          } catch (err) {
            reject(err);
          }
        }
      });
      if (options._returnInstance) {
        options._returnInstance(instance);
      }
    } catch (err) {
      reject(err);
    }
  });
}
