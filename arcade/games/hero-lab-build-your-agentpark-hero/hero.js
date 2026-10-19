// hero.js: kept for older imports. The runtime moved to kit/heroes.js (shared by every game: My heroes, hero bar,
// loadHero with game-weight models). This wrapper loads from this Hero Lab folder's assets.
import { loadHero as kitLoadHero } from './kit/heroes.js';
import { readHero } from './store.js';

export const loadHero = (THREE, GLTFLoader, opts = {}) => kitLoadHero(THREE, GLTFLoader, { assets: new URL('./assets/', import.meta.url).href, ...opts });
export { readHero };
