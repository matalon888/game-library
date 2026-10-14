// Original knitted pictures, painted procedurally from simple shapes on an N x N grid.
// Each painter returns a function (u, v) -> colour key, with u,v in [0,1] (v = 0 at the top).
export const YARN = {
  red: '#e8434f', white: '#f4f1ea', pink: '#ff8fb8', blue: '#3b7ff0', navy: '#2b3a8f', yellow: '#ffc93c', orange: '#ff8a3d',
  green: '#3cbf5e', dkgreen: '#23864a', brown: '#8a5a3c', beige: '#f1d3a5', sky: '#8fd0ff', purple: '#9a6bff', teal: '#2ec4b6', black: '#3a3845',
};
const inC = (u, v, x, y, r) => (u - x) ** 2 + (v - y) ** 2 < r * r;
const inR = (u, v, x0, y0, x1, y1) => u >= x0 && u <= x1 && v >= y0 && v <= y1;
const inTri = (u, v, ax, ay, bx, by, cx, cy) => { const s = (p, q, r, t, x, y) => (x - r) * (q - t) - (p - r) * (y - t); const d1 = s(u, v, ax, ay, bx, by), d2 = s(u, v, bx, by, cx, cy), d3 = s(u, v, cx, cy, ax, ay); return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); };

export const PICTURES = [
  { name: 'heart', n: 10, f: (u, v) => {
    if (inC(u, v, 0.31, 0.37, 0.2) || inC(u, v, 0.69, 0.37, 0.2) || inTri(u, v, 0.12, 0.42, 0.88, 0.42, 0.5, 0.9)) return 'red';
    return 'sky'; } },
  { name: 'mushroom', n: 12, f: (u, v) => {
    if (v > 0.84) return 'green';
    if (inR(u, v, 0.38, 0.5, 0.62, 0.86)) return 'beige';
    if (v < 0.58 && ((u - 0.5) / 0.46) ** 2 + ((v - 0.58) / 0.44) ** 2 < 1) return inC(u, v, 0.3, 0.42, 0.08) || inC(u, v, 0.56, 0.27, 0.08) || inC(u, v, 0.74, 0.47, 0.07) ? 'white' : 'red';
    return 'sky'; } },
  { name: 'cherries', n: 14, f: (u, v) => {
    if (inC(u, v, 0.33, 0.68, 0.17) || inC(u, v, 0.68, 0.72, 0.17)) return inC(u, v, 0.27, 0.62, 0.05) || inC(u, v, 0.62, 0.66, 0.05) ? 'white' : 'red';
    if (inTri(u, v, 0.52, 0.12, 0.8, 0.2, 0.62, 0.3)) return 'green';
    const s1 = Math.abs((u - 0.33) - (0.52 - 0.33) * (0.5 - (v - 0.15)) / 0.5) < 0.05 && v > 0.14 && v < 0.54, s2 = Math.abs(u - (0.52 + (v - 0.14) * 0.42)) < 0.05 && v > 0.14 && v < 0.58;
    if (s1 || s2) return 'brown'; return 'yellow'; } },
  { name: 'sailboat', n: 14, f: (u, v) => {
    if (inC(u, v, 0.8, 0.18, 0.1)) return 'yellow';
    if (inTri(u, v, 0.48, 0.12, 0.48, 0.6, 0.18, 0.6) || inTri(u, v, 0.53, 0.2, 0.53, 0.6, 0.76, 0.6)) return 'white';
    if (inR(u, v, 0.48, 0.1, 0.53, 0.64)) return 'brown';
    if (v > 0.62 && v < 0.74 && u > 0.18 + (v - 0.62) * 0.9 && u < 0.84 - (v - 0.62) * 0.9) return 'brown';
    if (v > 0.7) return Math.abs(Math.sin(u * 18) * 0.03 + 0.8 - v) < 0.03 ? 'white' : 'blue';
    return 'sky'; } },
  { name: 'ice cream', n: 14, f: (u, v) => {
    if (inC(u, v, 0.5, 0.12, 0.06)) return 'red';
    if (inC(u, v, 0.5, 0.3, 0.17)) return 'pink';
    if (inC(u, v, 0.36, 0.46, 0.15) || inC(u, v, 0.64, 0.46, 0.15)) return 'white';
    if (inTri(u, v, 0.26, 0.54, 0.74, 0.54, 0.5, 0.95)) return (Math.floor((u + v) * 9) + Math.floor((u - v) * 9)) % 2 ? 'orange' : 'beige';
    return 'teal'; } },
  { name: 'house', n: 16, f: (u, v) => {
    if (v > 0.84) return 'green';
    if (inTri(u, v, 0.14, 0.42, 0.86, 0.42, 0.5, 0.12)) return 'red';
    if (inR(u, v, 0.2, 0.42, 0.8, 0.86)) { if (inR(u, v, 0.42, 0.6, 0.58, 0.86)) return 'brown'; if (inR(u, v, 0.26, 0.5, 0.38, 0.62) || inR(u, v, 0.62, 0.5, 0.74, 0.62)) return 'sky'; return 'yellow'; }
    if (inC(u, v, 0.13, 0.14, 0.07)) return 'white'; return 'sky'; } },
  { name: 'apple tree', n: 16, f: (u, v) => {
    if (v > 0.86) return 'green';
    if (inC(u, v, 0.34, 0.36, 0.08) || inC(u, v, 0.62, 0.28, 0.07) || inC(u, v, 0.64, 0.5, 0.07)) return 'red';
    if (inC(u, v, 0.5, 0.38, 0.3)) return 'dkgreen';
    if (inR(u, v, 0.44, 0.6, 0.56, 0.88)) return 'brown';
    return 'sky'; } },
  { name: 'rainbow', n: 16, f: (u, v) => {
    if (inC(u, v, 0.2, 0.74, 0.11) || inC(u, v, 0.32, 0.76, 0.1) || inC(u, v, 0.7, 0.74, 0.11) || inC(u, v, 0.82, 0.76, 0.1)) return 'white';
    const d = Math.hypot(u - 0.5, v - 0.8), cs = ['red', 'orange', 'yellow', 'green', 'blue'];
    if (v < 0.8 && d < 0.46 && d > 0.21) return cs[Math.floor((0.46 - d) / 0.05)] || 'blue';
    return 'sky'; } },
  { name: 'rocket', n: 16, f: (u, v) => {
    if (inC(u, v, 0.5, 0.42, 0.06)) return 'sky';
    if (inTri(u, v, 0.38, 0.28, 0.62, 0.28, 0.5, 0.06)) return 'red';
    if (inR(u, v, 0.38, 0.28, 0.62, 0.72)) return 'white';
    if (inTri(u, v, 0.38, 0.5, 0.38, 0.76, 0.24, 0.76) || inTri(u, v, 0.62, 0.5, 0.62, 0.76, 0.76, 0.76)) return 'red';
    if (inTri(u, v, 0.4, 0.72, 0.6, 0.72, 0.5, 0.96)) return v < 0.84 ? 'yellow' : 'orange';
    const h = Math.sin(u * 91.7 + v * 37.3) * 43758.5; if (h - Math.floor(h) > 0.93) return 'yellow';
    return 'navy'; } },
  { name: 'flower', n: 18, f: (u, v) => {
    if (inC(u, v, 0.5, 0.36, 0.09)) return 'yellow';
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; if (inC(u, v, 0.5 + Math.cos(a) * 0.15, 0.36 + Math.sin(a) * 0.15, 0.1)) return 'pink'; }
    if (inR(u, v, 0.45, 0.5, 0.55, 0.94)) return 'green';
    if (inC(u, v * 1.6, 0.38, 1.18, 0.09) || inC(u, v * 1.6, 0.62, 1.28, 0.09)) return 'green';
    return v > 0.9 ? 'brown' : 'sky'; } },
  { name: 'planet', n: 18, f: (u, v) => {
    const x = u - 0.5, y = v - 0.5, rx = x * 0.94 + y * 0.34, ry = -x * 0.34 + y * 0.94, ring = Math.hypot(rx / 0.44, ry / 0.12);
    const inP = Math.hypot(x, y) < 0.24;
    if (ring > 0.82 && ring < 1.02 && (!inP || ry > 0)) return 'yellow';
    if (inP) return Math.floor((y + 0.3) * 12) % 3 === 0 ? 'red' : 'orange';
    const h = Math.sin(u * 71.7 + v * 17.3) * 43758.5; if (h - Math.floor(h) > 0.94) return 'white';
    return 'navy'; } },
  { name: 'cactus', n: 18, f: (u, v) => {
    if (inC(u, v, 0.5, 0.16, 0.06)) return 'pink';
    if (inR(u, v, 0.32, 0.72, 0.68, 0.92) || inR(u, v, 0.28, 0.7, 0.72, 0.76)) return 'orange';
    if (inR(u, v, 0.42, 0.2, 0.58, 0.72) || inR(u, v, 0.24, 0.4, 0.33, 0.56) || inR(u, v, 0.24, 0.52, 0.44, 0.6) || inR(u, v, 0.67, 0.32, 0.76, 0.48) || inR(u, v, 0.56, 0.44, 0.76, 0.52)) return 'green';
    return 'beige'; } },
];
// endless: seeded geometric "sweater" patterns
export function patternPicture(seed, n) {
  const R = (() => { let s = seed % 2147483647 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const keys = Object.keys(YARN), pal = keys.sort(() => R() - 0.5).slice(0, 3 + Math.floor(R() * 3));
  const kind = Math.floor(R() * 5);
  return { name: 'pattern', n, f: (u, v) => {
    const x = u - 0.5, y = v - 0.5;
    if (kind === 0) return pal[Math.floor((Math.abs(x) + Math.abs(y)) * pal.length * 1.4) % pal.length];
    if (kind === 1) return pal[Math.floor(Math.max(Math.abs(x), Math.abs(y)) * pal.length * 2) % pal.length];
    if (kind === 2) return pal[(Math.floor(u * 4) + Math.floor(v * 4)) % pal.length];
    if (kind === 3) return pal[Math.floor((v + Math.sin(u * 6.28) * 0.08) * pal.length * 1.5) % pal.length];
    return pal[Math.floor(Math.hypot(x, y) * pal.length * 2.4) % pal.length];
  } };
}
