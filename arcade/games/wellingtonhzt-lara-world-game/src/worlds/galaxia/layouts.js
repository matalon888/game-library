/* ── Galaxy board layout variations ──
 * All coordinates are percentages (0‑100) for CSS positioning.
 * Only used when world is Galáxia Estelar.
 */

function round(v) {
  return Math.round(v * 10) / 10;
}

/* ── Default (snake, original) ── */
const cellsDefault = [
  { id: 1,  x: 15, y: 8 },
  { id: 2,  x: 29, y: 8 },
  { id: 3,  x: 43, y: 8 },
  { id: 4,  x: 57, y: 8 },
  { id: 5,  x: 71, y: 8 },
  { id: 6,  x: 71, y: 28 },
  { id: 7,  x: 57, y: 28 },
  { id: 8,  x: 43, y: 28 },
  { id: 9,  x: 29, y: 28 },
  { id: 10, x: 15, y: 28 },
  { id: 11, x: 15, y: 48 },
  { id: 12, x: 29, y: 48 },
  { id: 13, x: 43, y: 48 },
  { id: 14, x: 57, y: 48 },
  { id: 15, x: 71, y: 48 },
  { id: 16, x: 71, y: 68 },
  { id: 17, x: 57, y: 68 },
  { id: 18, x: 43, y: 68 },
  { id: 19, x: 29, y: 68 },
  { id: 20, x: 15, y: 84 },
];

/* ── Spiral ──
 * 2.5 clockwise rotations, outer→inner, wormhole feel.
 * Cell 15 at center (Buraco de Minhoca).
 * Cell 20 at bottom‑center.
 */
const cellsSpiral = (() => {
  const cells = [];
  for (let i = 1; i <= 20; i++) {
    const t = (i - 1) / 19;
    const angle = t * 5 * Math.PI - Math.PI / 2;
    const radius = 40 - t * 26;
    let x = 50 + radius * Math.cos(angle);
    let y = 50 + radius * Math.sin(angle);
    if (i === 15) { x = 50; y = 50; }
    if (i === 20) { x = 50; y = 62; }
    cells.push({ id: i, x: round(x), y: round(y) });
  }
  return cells;
})();

/* ── Orbit ──
 * Elliptical arc — planets orbiting a cosmic center.
 * Cell 15 at the right‑bottom region.
 * Cell 20 at the bottom.
 */
const cellsOrbit = (() => {
  const cells = [];
  for (let i = 1; i <= 20; i++) {
    const t = (i - 1) / 19;
    const angle = t * 2 * Math.PI * 0.78 - Math.PI;
    cells.push({ id: i, x: round(50 + 40 * Math.cos(angle)), y: round(50 + 30 * Math.sin(angle)) });
  }
  return cells;
})();

export const galaxyLayouts = {
  padrao: {
    id: 'padrao',
    name: 'Padrão',
    icon: '\u2B50',
    description: 'Trilha clássica da Galáxia em formato serpentina',
    cells: cellsDefault,
  },
  orbita: {
    id: 'orbita',
    name: 'Órbita',
    icon: '\uD83D\uDF90',
    description: 'Trilha em formato orbital',
    cells: cellsOrbit,
  },
  spiral: {
    id: 'spiral',
    name: 'Espiral',
    icon: '\uD83C\uDF00',
    description: 'Trilha em espiral (experimental)',
    cells: cellsSpiral,
  },
};
