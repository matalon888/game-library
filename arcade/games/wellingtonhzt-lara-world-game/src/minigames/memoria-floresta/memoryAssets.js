const ASSETS_BASE = '../../assets/minigames/memoria-floresta';

function assetUrl(relativePath) {
  return new URL(`${ASSETS_BASE}/${relativePath}`, import.meta.url).href;
}

export const CARD_BACK_URL = assetUrl('card-back.webp');

export const PAIR_ASSETS = {
  raposa:    { url: assetUrl('pairs/raposa.webp'),    emoji: '\uD83E\uDD8A' },
  coruja:    { url: assetUrl('pairs/coruja.webp'),    emoji: '\uD83E\uDD89' },
  borboleta: { url: assetUrl('pairs/borboleta.webp'), emoji: '\uD83E\uDD8B' },
  cogumelo:  { url: assetUrl('pairs/cogumelo.webp'),  emoji: '\uD83C\uDF44' },
  flor:      { url: assetUrl('pairs/flor.webp'),      emoji: '\uD83C\uDF3A' },
  esquilo:   { url: assetUrl('pairs/esquilo.webp'),   emoji: '\uD83E\uDD8F' },
  arvore:    { url: assetUrl('pairs/arvore.webp'),    emoji: '\uD83C\uDF33' },
  pinheiro:  { url: assetUrl('pairs/pinheiro.webp'),  emoji: '\uD83C\uDF32' },
  abelha:    { url: assetUrl('pairs/abelha.webp'),    emoji: '\uD83D\uDC1D' },
  trevo:     { url: assetUrl('pairs/trevo.webp'),     emoji: '\uD83C\uDF40' },
  girassol:  { url: assetUrl('pairs/girassol.webp'),  emoji: '\uD83C\uDF3B' },
  sapo:      { url: assetUrl('pairs/sapo.webp'),      emoji: '\uD83D\uDC38' },
  ourico:    { url: assetUrl('pairs/ourico.webp'),    emoji: '\uD83E\uDD94' },
  morango:   { url: assetUrl('pairs/morango.webp'),   emoji: '\uD83C\uDF53' },
  joaninha:  { url: assetUrl('pairs/joaninha.webp'),  emoji: '\uD83D\uDC1E' },
  folha:     { url: assetUrl('pairs/folha.webp'),     emoji: '\uD83C\uDF3F' },
};

export const PAIR_KEYS = Object.keys(PAIR_ASSETS);
export const BOARD_PAIR_KEYS = Object.freeze(['raposa', 'coruja', 'borboleta', 'cogumelo', 'flor', 'esquilo']);

export const CARD_BACK_EMOJI = '\uD83C\uDF3F';
