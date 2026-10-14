// Fish species. When adding a new one, see the checklist in CLAUDE.md.
// speedRange: pixels/second of horizontal swim.

export const FISH_TYPES = {
  small: {
    id: 'small',
    name: 'Bream',
    sizePx: 24,
    speedRange: [60, 90],
    points: 1,
    color: '#9ec5e8',
    accentColor: '#5a8bb5',
    rarity: 'common',
  },
  medium: {
    id: 'medium',
    name: 'Bass',
    sizePx: 34,
    speedRange: [40, 60],
    points: 3,
    color: '#a8e090',
    accentColor: '#4d8a3e',
    rarity: 'common',
  },
  big: {
    id: 'big',
    name: 'Bluefish',
    sizePx: 52,
    speedRange: [20, 35],
    points: 8,
    color: '#e8a060',
    accentColor: '#a8521a',
    rarity: 'uncommon',
  },
  golden: {
    id: 'golden',
    name: 'Goldfish',
    sizePx: 38,
    speedRange: [80, 110],
    points: 20,
    color: '#f4d03f',
    accentColor: '#b08820',
    rarity: 'rare',
  },
};
