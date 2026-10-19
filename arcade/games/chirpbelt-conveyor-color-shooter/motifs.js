// Chirpbelt picture motifs — every picture is drawn by these little shape functions, sampled on a G×G grid.
// u, v run from -1 to 1 (v grows downward). A motif returns a colour name or null (empty / background).
export const COL = {
  red: '#ff4d5e', pink: '#ff8fc7', orange: '#ff9a3c', yellow: '#ffd23d', green: '#4cc964', dgreen: '#22975a', teal: '#25c9bb',
  blue: '#3d86ff', sky: '#9ed6ff', purple: '#9b6bff', brown: '#a8683c', white: '#fdfbf6', dark: '#3d3756', cream: '#ffe2ae',
  mint: '#bdf0d2', lilac: '#e2d2ff', peach: '#ffd0b5',
};
const circ = (u, v, x, y, r) => (u - x) ** 2 + (v - y) ** 2 < r * r;
const ell = (u, v, x, y, a, b) => ((u - x) / a) ** 2 + ((v - y) / b) ** 2 < 1;
const box = (u, v, x0, x1, y0, y1) => u >= x0 && u <= x1 && v >= y0 && v <= y1;

export const MOTIFS = {
  heart: (o) => (u, v) => {
    const x = u * 1.22, y = -v * 1.22 + 0.25;
    if ((x * x + y * y - 1) ** 3 - x * x * y ** 3 > 0) return null;
    if (circ(u, v, -0.42, -0.32, 0.2)) return 'white';
    return o.alt ? 'pink' : 'red';
  },
  apple: () => (u, v) => {
    if (box(u, v, -0.08, 0.08, -0.95, -0.55)) return 'brown';
    if (ell(u, v, 0.32, -0.72, 0.28, 0.14)) return 'green';
    if (ell(u, v, 0, 0.15, 0.8, 0.75) || circ(u, v, -0.32, -0.32, 0.42) || circ(u, v, 0.32, -0.32, 0.42)) return circ(u, v, -0.38, -0.12, 0.17) ? 'white' : 'red';
    return null;
  },
  mushroom: () => (u, v) => {
    if (v < 0.12 && ell(u, v, 0, 0.12, 0.96, 0.92)) {
      if (circ(u, v, -0.48, -0.22, 0.2) || circ(u, v, 0.38, -0.45, 0.18) || circ(u, v, 0.12, -0.02, 0.14) || circ(u, v, 0.66, -0.06, 0.12)) return 'white';
      return 'red';
    }
    if (Math.abs(u) < 0.36 && v >= 0.12 && v < 0.92) return (circ(u, v, -0.14, 0.4, 0.08) || circ(u, v, 0.14, 0.4, 0.08)) ? 'dark' : 'cream';
    return null;
  },
  flower: () => (u, v) => {
    const cy = -0.25, r = Math.hypot(u, v - cy), t = Math.atan2(v - cy, u);
    if (r < 0.24) return 'yellow';
    if (r < 0.66 * (0.5 + 0.5 * Math.abs(Math.cos(2.5 * t)))) return 'pink';
    if (Math.abs(u) < 0.08 && v > 0.3) return 'green';
    if (ell(u, v, 0.28, 0.62, 0.24, 0.1) || ell(u, v, -0.28, 0.78, 0.22, 0.09)) return 'green';
    return null;
  },
  fish: () => (u, v) => {
    if (circ(u, v, -0.42, -0.1, 0.11)) return 'dark';
    if (ell(u, v, -0.08, 0, 0.66, 0.46)) return Math.abs(u - 0.02) < 0.09 || Math.abs(u + 0.28) < 0.06 && Math.abs(v) < 0.3 ? 'white' : 'orange';
    if (u > 0.5 && u < 0.96 && Math.abs(v) < (u - 0.46) * 1.0) return 'yellow';
    if (ell(u, v, -0.05, -0.5, 0.25, 0.1)) return 'yellow';
    return null;
  },
  house: () => (u, v) => {
    if (box(u, v, 0.32, 0.5, -0.82, -0.4)) return 'brown';
    if (v >= -0.9 && v < -0.08 && Math.abs(u) < 0.95 * (v + 0.9) / 0.82) return 'red';
    if (box(u, v, 0.05, 0.38, 0.38, 0.92)) return 'brown';
    if (box(u, v, -0.55, -0.2, 0.12, 0.42)) return 'sky';
    if (box(u, v, -0.7, 0.7, -0.08, 0.92)) return 'cream';
    return null;
  },
  cactus: () => (u, v) => {
    if (circ(u, v, 0, -0.86, 0.13)) return 'pink';
    if (v > 0.45 && v < 0.96 && Math.abs(u) < 0.48 - (v - 0.45) * 0.25) return 'orange';
    if (Math.abs(u) < 0.22 && v > -0.8 && v <= 0.45) return 'green';
    if (box(u, v, -0.62, -0.2, 0.0, 0.16) || box(u, v, -0.62, -0.44, -0.5, 0.16)) return 'green';
    if (box(u, v, 0.2, 0.6, -0.22, -0.06) || box(u, v, 0.42, 0.6, -0.65, -0.06)) return 'green';
    return null;
  },
  rocket: () => (u, v) => {
    if (circ(u, v, 0, -0.18, 0.15)) return 'blue';
    if (Math.abs(u) < 0.3 && v >= -0.45 && v < 0.55) return 'white';
    if (v >= -0.95 && v < -0.45 && Math.abs(u) < 0.3 * (v + 0.95) / 0.5) return 'red';
    if (v > 0.2 && v < 0.72 && Math.abs(u) >= 0.3 && Math.abs(u) < 0.3 + (v - 0.2) * 0.9) return 'red';
    if (v >= 0.55 && v < 0.98 && Math.abs(u) < 0.2 * (1 - (v - 0.55) / 0.43)) return 'orange';
    return null;
  },
  sun: () => (u, v) => {
    const r = Math.hypot(u, v), t = Math.atan2(v, u);
    if (circ(u, v, -0.18, -0.08, 0.08) || circ(u, v, 0.18, -0.08, 0.08)) return 'dark';
    if (r < 0.52) return v > 0.12 && v < 0.24 && Math.abs(u) < 0.2 ? 'orange' : 'yellow';
    if (r > 0.62 && r < 0.95 && Math.cos(8 * t) > 0.55) return 'orange';
    return null;
  },
  star: () => (u, v) => {
    const r = Math.hypot(u, v * 1.05 - 0.05), t = Math.atan2(v, u) + Math.PI / 2, k = Math.cos(5 * t);
    if (r < 0.42 + 0.52 * Math.max(0, k) ** 2) return r < 0.22 ? 'orange' : 'yellow';
    return null;
  },
  ghost: () => (u, v) => {
    if (ell(u, v, -0.25, -0.2, 0.12, 0.17) || ell(u, v, 0.25, -0.2, 0.12, 0.17)) return 'dark';
    const wave = 0.72 + 0.12 * Math.cos(u * 9);
    if ((v < 0 && circ(u, v, 0, 0, 0.75)) || (v >= 0 && Math.abs(u) < 0.75 && v < wave)) return circ(u, v, 0, 0.18, 0.1) ? 'pink' : 'lilac';
    return null;
  },
  turtle: () => (u, v) => {
    if (circ(u, v, 0.78, -0.12, 0.2)) return circ(u, v, 0.84, -0.18, 0.05) ? 'dark' : 'green';
    if (v < 0.25 && ell(u, v, 0, 0.25, 0.7, 0.75)) return (Math.abs(u) < 0.08 || Math.abs(v + 0.15) < 0.07) ? 'dgreen' : 'teal';
    if (circ(u, v, -0.45, 0.42, 0.16) || circ(u, v, 0.4, 0.42, 0.16) || ell(u, v, -0.78, 0.15, 0.14, 0.07)) return 'green';
    return null;
  },
};
export const ORDER = ['heart', 'apple', 'mushroom', 'star', 'fish', 'flower', 'house', 'sun', 'cactus', 'ghost', 'rocket', 'turtle'];
export const BGS = ['sky', 'mint', 'lilac', 'peach', 'cream'];
