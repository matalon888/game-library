// Hollowtide — world: chapter maps, procedural textures, and the level builder (merged static geometry by material).
import { THREE } from './kit/cine.js';
import { RoundedBoxGeometry } from './kit/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from './kit/addons/utils/BufferGeometryUtils.js';

export const T = 3, HL = 3.0, HH = 4.8, TOP = HH + 0.6;
export const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export function hash(a, b, s = 0) { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

// ------------------------------------------------------------------ chapters
// # wall  . floor  ~ flooded  S start  X lift/exit  d door  a/b/c keyed doors (cards 1/2/3)  T terminal  L locker
// B battery  P plasma cells  G EMP charge  H patch kit  J junk (throwable)  O objective  M mender  W warden
// C crates  Q pump  Y server rack  w ocean window  R ceiling leak  Z sparking panel
export const CHAPTERS = [
  { id: 1, name: 'DESCENT', sub: 'Dive Bay · Deck C', obj: 'Find the AMBER keycard and reach the lift', objVerb: '', par: 150, emp: 0, junk: 1, cells: 12,
    map: [
      '#####################',
      '#w..T########.T...Bw#',
      '#..S.d..R...d.......#',
      '#....########....C..#',
      '#....########.......#',
      '################.####',
      '#......####.........#',
      '#..X...a..Z..M....1.#',
      '#.H....####.....L.P.#',
      '#####################'],
    logs: [
      ['DIVE BAY · DUTY LOG · TECH ANDO PRIESS', 'Day 41. The Menders keep welding the dive bay hatch shut. I cut it open, they weld it again. CAIRN calls it protocol. Protocol for what?'],
      ['CREW QUARTERS · DR. HALLE VOSS', 'If you are reading this, the evac sub left without us. Something walks the lower ring at night. It does not see well. It listens. Walk soft. Keep your light low.']] },
  { id: 2, name: 'THE RING', sub: 'Maintenance Ring · Deck D', obj: 'Re-seat 2 fuse cores, then take the lift', objVerb: 'RE-SEAT FUSE', par: 210, emp: 2, junk: 2, cells: 12, warden: true,
    map: [
      '#########################',
      '#...T#......w..M.L..#.O.#',
      '#.S..d..............d...#',
      '#.T..#.#####d######.#...#',
      '###.##.#..........#.#####',
      '#.J..#.#...Q..Q..T#.#...#',
      '#L...d.d....W.....d.d.G.#',
      '#....#.#...Q..Q...#.#.M.#',
      '###.##.#..........#.#####',
      '#.H..#.#####d######.#...#',
      '#....d..............d.O.#',
      '#X.B.#...M..w...L...#...#',
      '#########################'],
    logs: [
      ['MAINT. RING · CAIRN SYSTEM NOTICE', 'BREACH PROTOCOL 7 ACTIVE. ALL PERSONNEL REMAIN INSIDE. WARDEN UNIT ASSIGNED TO HOLD THE RING. THIS IS FOR YOUR SAFETY.'],
      ['PUMP CONTROL · TECH ANDO PRIESS', 'Fuses are in the side bays. Menders guard anything that hums. Throw something loud the other way. They are curious, like gulls.']] },
  { id: 3, name: 'PUMP HALL', sub: 'Ballast Pumps · Deck E', obj: 'Close 3 pressure valves, find the CYAN card, reach the lift', objVerb: 'CLOSE VALVE', par: 240, emp: 2, junk: 2, cells: 12, warden: true,
    map: [
      '#######################',
      '#S..T#~~~~~~~~~~~~~O~~#',
      '#....d~~Q~~~~~~~Q~~~~~#',
      '#....#~~~~~##~~~~~~~~L#',
      '######~~~~~~~~R~~~~~~~#',
      '#.J..d~~Q~~~M~~~Q~~~~~#',
      '#L...#~~~~~~~W~~~~~~~O#',
      '#H...#~~Q~~##~~~Q~~M~~#',
      '######~~~~~~~R~~~~~~~~#',
      '#....#~~~~~~~2~~~~~~~~#',
      '#.X..b~~Q~~~~~~~Q~~J~~#',
      '#..P.#O~~~~~T~~~M~~~~~#',
      '#######################'],
    logs: [
      ['PUMP HALL · DR. HALLE VOSS', 'We found a light at the bottom of the trench. Not ours. It answers the station sonar in prime numbers. The board wants it raised. CAIRN said no.'],
      ['PUMP HALL · OPERATOR LOG', 'Valve 3 sticks, hit it twice. And for the love of air, do not run in the water. The Warden hears a splash from two decks away.']] },
  { id: 4, name: 'THE VAULT', sub: 'CAIRN Core · Deck F', obj: 'Pull 2 memory cores from the vault, then reach the lift', objVerb: 'PULL CORE', par: 270, emp: 2, junk: 2, cells: 12, warden: true,
    map: [
      '#######################',
      '#S..T#..........#...O.#',
      '#....d.Y.Y..Y.Y.#.....#',
      '#w...#.Y.Y..Y.Y.c..M..#',
      '#.#.##.Y.Y..Y.Y.#L....#',
      '#J...#.....2....#.....#',
      '#....d####b########.###',
      '#L...#..........#.....#',
      '#....#.Y.Y.W.Y.Y#..O..#',
      '#.H..c.Y.Y...Y.Yd.....#',
      '#....#......3...#..J..#',
      '#X...#...M......#B...M#',
      '#######################'],
    logs: [
      ['VAULT · CAIRN', 'I SEALED THE STATION WHEN THE SURFACE ORDERED THE LIGHT CUT LOOSE AND HAULED UP. IT IS ALIVE. IT IS SINGING. I WILL NOT LET THEM TAKE IT.'],
      ['VAULT · DR. HALLE VOSS (LAST)', 'The crew got out on the second sub. I stayed with CAIRN. The memory cores hold everything: the song, the proof. Take them up. Tell people what is down here.']] },
  { id: 5, name: 'ASCENT', sub: 'Pod Bay · Deck A', obj: 'Release 2 pod clamps, then launch the pod', objVerb: 'RELEASE CLAMP', par: 270, emp: 3, junk: 3, cells: 18, warden: true,
    map: [
      '#########################',
      '#S..T#...C....w.#.....O.#',
      '#....d..........d.......#',
      '#....#..C...M...#...X...#',
      '###.##..........##d######',
      '#J...#####.######...M...#',
      '#L...d.......R..d......O#',
      '#....#.Q..W...Q.#......L#',
      '#H...#.....T....#..J....#',
      '###.########d########.###',
      '#...Md....M....G.d......#',
      '#B...#w..........#..P...#',
      '#########################'],
    logs: [
      ['POD BAY · CAIRN', 'DIVER. YOU CARRY MY MEMORY. THE WARDEN WAS NEVER HUNTING YOU. IT WAS COUNTING WHO LEFT. GO. I WILL KEEP THE LIGHTS ON AS LONG AS I CAN.'],
      ['POD BAY · TECH ANDO PRIESS', 'Pod clamps are manual. Two levers, one each side. They are loud. Make it fast.']] },
];
export const ENDING = 'The pod rises through 3,140 metres of dark. Below you the station lights go out, one deck at a time. Then, far deeper, something answers them.';

// ------------------------------------------------------------------ Lights Out: a seeded maze of rooms
export function survivalMap(rand) {
  const RW = 4, RH = 3, CW = 5, CH = 4;              // rooms grid, cell size in tiles
  const W = RW * CW + 1, Hh = RH * CH + 1, g = Array.from({ length: Hh }, () => Array(W).fill('#'));
  const rooms = [];
  for (let j = 0; j < RH; j++) for (let i = 0; i < RW; i++) {
    const x0 = i * CW + 1, y0 = j * CH + 1, w = CW - 1, h = CH - 1;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) g[y][x] = rand() < 0.12 ? '~' : '.';
    rooms.push({ i, j, x0, y0, w, h });
  }
  // spanning tree + loops
  const seen = new Set([0]), edges = [], key = (i, j) => j * RW + i;
  const stack = [0];
  while (stack.length) {
    const k = stack[stack.length - 1], i = k % RW, j = (k / RW) | 0;
    const nb = DIRS.map(([dx, dy]) => [i + dx, j + dy]).filter(([a, b]) => a >= 0 && b >= 0 && a < RW && b < RH && !seen.has(key(a, b)));
    if (!nb.length) { stack.pop(); continue; }
    const [a, b] = nb[(rand() * nb.length) | 0]; seen.add(key(a, b)); edges.push([i, j, a, b]); stack.push(key(a, b));
  }
  for (let n = 0; n < 4; n++) { const i = (rand() * (RW - 1)) | 0, j = (rand() * RH) | 0; edges.push([i, j, i + 1, j]); }
  for (const [i, j, a, b] of edges) {
    if (a !== i) { const x = Math.max(i, a) * CW, y = j * CH + 1 + ((rand() * (CH - 1)) | 0); g[y][x] = rand() < 0.5 ? 'd' : '.'; }
    else { const y = Math.max(j, b) * CH, x = i * CW + 1 + ((rand() * (CW - 1)) | 0); g[y][x] = rand() < 0.5 ? 'd' : '.'; }
  }
  const free = () => { for (let k = 0; k < 400; k++) { const r = rooms[(rand() * rooms.length) | 0]; const x = r.x0 + ((rand() * r.w) | 0), y = r.y0 + ((rand() * r.h) | 0); if (g[y][x] === '.' || g[y][x] === '~') return [x, y]; } return null; };
  const wallFree = () => { for (let k = 0; k < 400; k++) { const p = free(); if (p && DIRS.some(([dx, dy]) => g[p[1] + dy][p[0] + dx] === '#')) return p; } return null; };
  const put = (ch, n, wall) => { for (let k = 0; k < n; k++) { const p = wall ? wallFree() : free(); if (p) g[p[1]][p[0]] = ch; } };
  g[rooms[0].y0 + 1][rooms[0].x0 + 1] = 'S';
  put('W', 1); put('T', 2, 1); put('L', 6, 1); put('C', 4); put('Q', 2); put('Y', 3, 1); put('w', 4, 1); put('R', 4); put('Z', 4, 1);
  put('B', 3); put('P', 4); put('G', 2); put('H', 2); put('J', 3);
  put('M', 3);
  return g.map(r => r.join(''));
}

// ------------------------------------------------------------------ procedural textures (no image files)
function cv(n, m, draw) { const c = document.createElement('canvas'); c.width = n; c.height = m; draw(c.getContext('2d'), n, m); return c; }
function tx(c, color = true) { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (color) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
const R = Math.random;
function grain(x, n, m, k = 6, a = 0.05) { for (let i = 0; i < n * k; i++) { x.fillStyle = `rgba(${R() < .5 ? '255,255,255' : '0,0,0'},${R() * a})`; const s = 1 + R() * 3; x.fillRect(R() * n, R() * m, s, s); } }
function streaks(x, n, m, cnt, col) { for (let i = 0; i < cnt; i++) { const px = R() * n, py = R() * m * .8, l = 30 + R() * 140, w = 2 + R() * 6; const g = x.createLinearGradient(0, py, 0, py + l); g.addColorStop(0, col.replace('A', .35)); g.addColorStop(1, col.replace('A', 0)); x.fillStyle = g; x.fillRect(px, py, w, l); } }

// candy-coloured undersea base: off-white panels, teal/coral bands, blue tile floors, bright signage
function wallCanvas(bump) {
  return cv(512, 512, (x, n) => {
    x.fillStyle = bump ? '#808080' : '#cfd9df'; x.fillRect(0, 0, n, n);
    const P = n / 2;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const px = i * P, py = j * P;
      x.fillStyle = bump ? '#9a9a9a' : (i + j) % 2 ? '#c4d2da' : '#dbe4e9'; x.fillRect(px + 22, py + 22, P - 44, P - 44);
      x.strokeStyle = bump ? '#c8c8c8' : 'rgba(255,255,255,.9)'; x.lineWidth = 4; x.strokeRect(px + 22, py + 22, P - 44, P - 44);
      x.fillStyle = bump ? '#e8e8e8' : '#b9c7cf';
      for (const [a, b] of [[12, 12], [P - 12, 12], [12, P - 12], [P - 12, P - 12]]) { x.beginPath(); x.arc(px + a, py + b, 5, 0, 7); x.fill(); }
    }
    // a coloured band at hip height (canvas y≈290..345 → 1.0..1.3 m) with chevrons
    x.fillStyle = bump ? '#a0a0a0' : '#25b8cf'; x.fillRect(0, 286, n, 62);
    if (!bump) { x.fillStyle = '#ff6f61'; x.fillRect(0, 280, n, 8); x.fillRect(0, 346, n, 8); x.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < n; i += 64) { x.beginPath(); x.moveTo(i + 14, 296); x.lineTo(i + 34, 317); x.lineTo(i + 14, 338); x.lineTo(i + 26, 338); x.lineTo(i + 46, 317); x.lineTo(i + 26, 296); x.fill(); } }
    x.fillStyle = bump ? '#303030' : '#9fb3bd'; x.fillRect(0, 0, n, 5); x.fillRect(0, P - 2, n, 5); x.fillRect(0, 0, 5, n); x.fillRect(P - 2, 0, 5, n);
    if (!bump) { grain(x, n, n, 3, .03); x.fillStyle = '#ff8a3d'; x.font = 'bold 30px sans-serif'; x.fillText('V-' + (10 + ((R() * 80) | 0)), 50, 90); x.fillStyle = '#5b6d78'; x.font = 'bold 16px sans-serif'; x.fillText('HOLLOWTIDE · DECK ' + 'CDEF'[(R() * 4) | 0], 280, 470); }
  });
}
function floorCanvas(bump) {
  return cv(512, 512, (x, n) => {
    const S = n / 4;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { x.fillStyle = bump ? '#909090' : (i + j) % 2 ? '#2a8fb8' : '#3aa6cc'; x.fillRect(i * S, j * S, S, S); }
    x.fillStyle = bump ? '#303030' : '#1d5f86'; for (let i = 0; i <= 4; i++) { x.fillRect(i * S - 3, 0, 6, n); x.fillRect(0, i * S - 3, n, 6); }
    if (!bump) {
      x.fillStyle = 'rgba(255,255,255,.12)'; for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(i * S + S / 2, j * S + S / 2, S * .28, 0, 7); x.fill(); }
      for (let i = 0; i < n; i += 32) { x.fillStyle = '#ffd23f'; x.beginPath(); x.moveTo(i, 6); x.lineTo(i + 16, 6); x.lineTo(i + 6, 22); x.lineTo(i - 10, 22); x.fill(); }
      grain(x, n, n, 3, .04);
    }
  });
}
function ceilCanvas() {
  return cv(256, 256, (x, n) => {
    x.fillStyle = '#aebdca'; x.fillRect(0, 0, n, n);
    for (let k = 0; k < 6; k++) { x.fillStyle = '#8496a8'; x.fillRect(50, 60 + k * 24, n - 100, 10); }
    x.fillStyle = '#aebec7'; x.fillRect(0, 0, n, 5); x.fillRect(0, 0, 5, n);
  });
}
function hazardCanvas() {
  return cv(256, 64, (x, n, m) => {
    x.fillStyle = '#2b2d42'; x.fillRect(0, 0, n, m); x.fillStyle = '#ffd23f';
    for (let i = -m; i < n + m; i += 40) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 20, 0); x.lineTo(i + 20 - m, m); x.lineTo(i - m, m); x.fill(); }
  });
}
function doorCanvas() {
  return cv(512, 512, (x, n) => {
    x.fillStyle = '#ff7a3d'; x.fillRect(0, 0, n, n);
    x.fillStyle = '#ffffff'; x.fillRect(0, n * .46, n, n * .08);
    x.drawImage(hazardCanvas(), 0, 0, 256, 64, 0, n - 70, n, 70);
    for (let k = 0; k < 3; k++) { x.strokeStyle = '#ffe14d'; x.lineWidth = 20; x.lineCap = 'round'; x.beginPath(); x.moveTo(150, 100 + k * 46); x.lineTo(n / 2, 66 + k * 46); x.lineTo(n - 150, 100 + k * 46); x.stroke(); }
    x.fillStyle = '#fff'; x.font = 'bold 76px sans-serif'; x.textAlign = 'center'; x.fillText((1 + ((R() * 9) | 0)) + '' + ((R() * 9) | 0), n / 2, n * .75);
    x.strokeStyle = '#c94f22'; x.lineWidth = 14; x.strokeRect(7, 7, n - 14, n - 14);
  });
}
function lockerCanvas() {
  return cv(256, 512, (x, n, m) => {
    x.fillStyle = '#4fd1a8'; x.fillRect(0, 0, n, m);
    for (let k = 0; k < 6; k++) { x.fillStyle = '#2a8f78'; x.fillRect(50, 40 + k * 18, n - 100, 8); }
    for (let k = 0; k < 4; k++) { x.fillStyle = '#2a8f78'; x.fillRect(50, m - 110 + k * 18, n - 100, 8); }
    x.fillStyle = '#fff'; x.beginPath(); x.roundRect ? x.roundRect(70, 180, 116, 44, 10) : x.rect(70, 180, 116, 44); x.fill(); x.fillStyle = '#2b2d42'; x.font = 'bold 24px sans-serif'; x.fillText('V-' + ((R() * 90 + 10) | 0), 92, 211);
    x.fillStyle = '#ffd23f'; x.fillRect(200, 260, 18, 76);
    x.strokeStyle = '#2a8f78'; x.lineWidth = 8; x.strokeRect(6, 6, n - 12, m - 12);
  });
}
function crateCanvas() {
  return cv(256, 256, (x, n) => {
    const c = ['#3d7bff', '#ff5d8f', '#ffb020', '#2ec4a0'][(R() * 4) | 0];
    x.fillStyle = c; x.fillRect(0, 0, n, n);
    x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 18; x.strokeRect(9, 9, n - 18, n - 18);
    x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 10; x.beginPath(); x.moveTo(20, 20); x.lineTo(n - 20, n - 20); x.moveTo(n - 20, 20); x.lineTo(20, n - 20); x.stroke();
    x.fillStyle = '#fff'; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.fillText('CARGO', n / 2, n / 2 + 10);
  });
}
function screenCanvas(lines, col = '#5ff3ff') {
  return cv(256, 192, (x, n, m) => {
    x.fillStyle = '#10234a'; x.fillRect(0, 0, n, m);
    x.fillStyle = col; x.font = 'bold 16px sans-serif';
    lines.forEach((l, i) => x.fillText(l, 14, 28 + i * 21));
    for (let y = 0; y < m; y += 4) { x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, y, n, 1); }
  });
}
export const SIGNS = ['DECK C', 'PUMP HALL', '⚠ PRESSURE', 'POD BAY', '▶▶▶', 'KEEP QUIET', 'HOLLOWTIDE', 'LIFT', 'C-07', 'EXIT', 'CAIRN', '3140 M'];
function atlasCanvas() {
  return cv(1024, 1024, (x) => {
    const C = 256; let g;
    for (let i = 0; i < 7; i++) { const px = 60 + R() * 130, w = 6 + R() * 12, l = 80 + R() * 100; g = x.createLinearGradient(0, 10, 0, 10 + l); g.addColorStop(0, 'rgba(40,140,150,.45)'); g.addColorStop(1, 'rgba(40,140,150,0)'); x.fillStyle = g; x.fillRect(px, 10, w, l); }
    // 1 sticker: smiling bubble mascot
    x.fillStyle = '#ffd23f'; x.beginPath(); x.arc(C * 1.5, 128, 90, 0, 7); x.fill(); x.fillStyle = '#2b2d42'; x.beginPath(); x.arc(C * 1.5 - 30, 110, 12, 0, 7); x.arc(C * 1.5 + 30, 110, 12, 0, 7); x.fill(); x.lineWidth = 10; x.strokeStyle = '#2b2d42'; x.beginPath(); x.arc(C * 1.5, 135, 40, .3, Math.PI - .3); x.stroke();
    // 2 scorch
    g = x.createRadialGradient(C * 2.5, 128, 4, C * 2.5, 128, 110); g.addColorStop(0, 'rgba(30,20,40,.9)'); g.addColorStop(.5, 'rgba(60,30,60,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(C * 2, 0, C, C);
    // 3 puddle
    x.save(); x.translate(C * 3.5, 128); x.scale(1, .8); g = x.createRadialGradient(0, 0, 20, 0, 0, 120); g.addColorStop(0, 'rgba(120,230,255,.75)'); g.addColorStop(.75, 'rgba(120,230,255,.55)'); g.addColorStop(1, 'rgba(120,230,255,0)'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 120, 0, 7); x.fill(); x.restore();
    SIGNS.forEach((s, k) => {
      const cx = (k % 4) * C, cy = C + ((k / 4) | 0) * C;
      const red = /QUIET|⚠/.test(s), green = /EXIT|LIFT/.test(s), amber = /▶|C-07|3140/.test(s);
      const bg = red ? '#ff4d6d' : green ? '#22c55e' : amber ? '#ffb020' : '#2f6bff';
      x.fillStyle = bg; x.beginPath(); x.roundRect ? x.roundRect(cx + 10, cy + 66, C - 20, 124, 26) : x.rect(cx + 10, cy + 66, C - 20, 124); x.fill();
      x.strokeStyle = '#fff'; x.lineWidth = 8; x.stroke();
      x.fillStyle = '#fff'; x.font = `bold ${s.length > 9 ? 30 : 44}px sans-serif`; x.textAlign = 'center'; x.fillText(s, cx + C / 2, cy + 144); x.textAlign = 'left';
    });
  });
}
function waterNormal() {
  const n = 256, h = new Float32Array(n * n);
  for (let k = 0; k < 60; k++) { const cx = R() * n, cy = R() * n, r = 8 + R() * 40, a = R() * 2 - 1; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { let dx = Math.abs(x - cx), dy = Math.abs(y - cy); dx = Math.min(dx, n - dx); dy = Math.min(dy, n - dy); const d = Math.hypot(dx, dy); if (d < r) h[y * n + x] += a * (1 + Math.cos(d / r * Math.PI)) * .5; } }
  return cv(n, n, (x) => {
    const im = x.createImageData(n, n);
    for (let y = 0; y < n; y++) for (let X = 0; X < n; X++) {
      const l = h[y * n + (X + n - 1) % n], r = h[y * n + (X + 1) % n], u = h[((y + n - 1) % n) * n + X], d = h[((y + 1) % n) * n + X];
      let nx = (l - r) * 2, ny = (u - d) * 2, nz = 1; const s = Math.hypot(nx, ny, nz); const i = (y * n + X) * 4;
      im.data[i] = (nx / s * .5 + .5) * 255; im.data[i + 1] = (ny / s * .5 + .5) * 255; im.data[i + 2] = (nz / s * .5 + .5) * 255; im.data[i + 3] = 255;
    }
    x.putImageData(im, 0, 0);
  });
}
function rackCanvas() {
  return cv(64, 256, (x, n, m) => {
    x.fillStyle = '#1b2a55'; x.fillRect(0, 0, n, m);
    for (let y = 4; y < m; y += 8) for (let i = 6; i < n; i += 9) if (R() < .5) { x.fillStyle = ['#3cff9a', '#ffb030', '#46c8ff', '#ff5dcf'][(R() * 4) | 0]; x.fillRect(i, y, 5, 4); }
  });
}

let TEX = null;
export function textures() {
  if (TEX) return TEX;
  TEX = { wall: tx(wallCanvas(false)), wallB: tx(wallCanvas(true), false), floor: tx(floorCanvas(false)), floorB: tx(floorCanvas(true), false), ceil: tx(ceilCanvas()), hazard: tx(hazardCanvas()), door: tx(doorCanvas()), locker: tx(lockerCanvas()), crate: tx(crateCanvas()), atlas: tx(atlasCanvas()), water: tx(waterNormal(), false), rack: tx(rackCanvas()),
    screen: tx(screenCanvas(['CAIRN TERMINAL', '> LOG ARCHIVE', '> 2 ENTRIES', '> PRESS USE', '', 'DEPTH 3140 M', 'HULL OK ♥'])),
    screenRed: tx(screenCanvas(['!! PROTOCOL 7', '!! SEAL: HOLD', '', 'WARDEN: AWAKE', 'MENDERS: 41', '', '> _'], '#ff8fa3')) };
  return TEX;
}

// ------------------------------------------------------------------ materials (strong colours, soft plastic/metal)
let MAT = null, _ramp = null;
export function RAMP() { if (_ramp) return _ramp; const d = new Uint8Array([110, 185, 255]); _ramp = new THREE.DataTexture(d, 3, 1, THREE.RedFormat); _ramp.minFilter = _ramp.magFilter = THREE.NearestFilter; _ramp.needsUpdate = true; return _ramp; }
export const OCEAN_FRAG = `varying vec3 vW; varying vec3 vN; uniform float uT;
  float hs(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
  void main(){
    bool top = abs(vN.y) > .5;
    vec2 p = top ? vW.xz : vec2(vW.x + vW.z, vW.y);
    float up = top ? 1. : smoothstep(-.5, 4.5, vW.y);
    vec3 col = mix(vec3(.02,.20,.42), vec3(.16,.66,.92), up);
    vec2 q = p * .9; float c = 0.;
    for (int i = 0; i < 3; i++) { q = vec2(q.x + sin(q.y * 1.7 + uT * .7), q.y + sin(q.x * 1.3 - uT * .6)); c += .5 / (1. + abs(sin(q.x) * sin(q.y)) * 7.); }
    col += vec3(.35,.6,.6) * pow(c * .55, 3.) * (top ? 1.2 : .6 + up);
    if (!top) { float kelp = sin(p.x * 2.3 + sin(p.x * .7) * 2. + sin(uT * .8 + p.x) * .25); float h = .6 + .5 * sin(p.x * .9) + .3 * kelp; if (vW.y < h) col = mix(col, vec3(.05,.35,.25), .85); }
    for (int k = 0; k < 4; k++) {
      float fk = float(k), dir = mod(fk, 2.) * 2. - 1., sp = .7 + fk * .2;
      vec2 f = mod(p - vec2(uT * sp * dir, sin(uT * .5 + fk) * .4) + vec2(fk * 2.3, fk * 1.1), vec2(7.5, 3.2)) - vec2(3.75, 1.6);
      f.x *= dir; float body = length(f * vec2(1., 1.9));
      vec3 fc = k == 0 ? vec3(1.,.45,.1) : k == 1 ? vec3(1.,.85,.1) : k == 2 ? vec3(1.,.35,.6) : vec3(.6,.4,1.);
      float tail = step(f.x, -.28) * step(-.52, f.x) * step(abs(f.y), (-f.x - .26) * .9);
      float m = max(step(body, .32), tail);
      if (m > .5) { col = fc * 1.3; if (abs(f.x - .02) < .04 && k == 0) col = vec3(1.4); if (length(f - vec2(.17, .04)) < .045) col = vec3(.02); }
    }
    vec2 b = p * vec2(3., 1.) + vec2(0., -uT * .8); vec2 bi = floor(b); vec2 bf = fract(b) - .5; float bh = hs(bi);
    if (bh > .93 && length(bf * vec2(1., 3.)) < .18) col += vec3(.5,.7,.8);
    gl_FragColor = vec4(col, 1.); }`;
export function materials() {
  if (MAT) return MAT;
  const X = textures(), Std = THREE.MeshStandardMaterial;
  // toon: 3-step ramp like the stylized bar (no metal/rough: flat candy colours)
  const S = function (o) { const q = { ...o }; delete q.metalness; delete q.roughness; return new THREE.MeshToonMaterial({ gradientMap: RAMP(), ...q }); };
  const emi = (c, i = 3) => new S({ color: c, emissive: c, emissiveIntensity: i, roughness: .4 });
  MAT = {
    wall: new S({ map: X.wall, bumpMap: X.wallB, bumpScale: 1.2, metalness: .1, roughness: .55 }),
    floor: new S({ map: X.floor, bumpMap: X.floorB, bumpScale: 1, metalness: .15, roughness: .32 }),
    ceil: new S({ map: X.ceil, metalness: .05, roughness: .7 }),
    trim: new S({ color: 0x33406b, metalness: .25, roughness: .45 }),
    trimLight: new S({ color: 0xffb21e, metalness: .2, roughness: .4 }),
    pipe: new S({ color: 0x19c2b0, metalness: .3, roughness: .3 }),
    pipeRed: new S({ color: 0xff4d6d, metalness: .3, roughness: .3 }),
    cable: new S({ color: 0x2b2d42, metalness: .1, roughness: .5 }),
    hazard: new S({ map: X.hazard, metalness: .1, roughness: .5 }),
    door: new S({ map: X.door, metalness: .2, roughness: .45 }),
    locker: new S({ map: X.locker, metalness: .2, roughness: .45 }),
    crate: new S({ map: X.crate, metalness: .1, roughness: .5 }),
    stripC: emi(0x35e0ff, 2.2), stripA: emi(0xff9a3d, 2.2), stripR: emi(0xff3d6e, 2.5), led: emi(0x3cff9a, 3),
    lamp: emi(0xfff3d6, 1.4), dead: new S({ color: 0x8592a0, metalness: .2, roughness: .4 }),
    screen: new S({ color: 0, emissive: 0xffffff, emissiveMap: X.screen, emissiveIntensity: 1.3, roughness: .2 }),
    screenRed: new S({ color: 0, emissive: 0xffffff, emissiveMap: X.screenRed, emissiveIntensity: 1.3, roughness: .2 }),
    rack: new S({ color: 0x2b3a7a, metalness: .3, roughness: .4 }),
    rackLed: new S({ color: 0, emissive: 0xffffff, emissiveMap: X.rack, emissiveIntensity: 2 }),
    decal: new S({ map: X.atlas, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, roughness: .5 }),
    sign: new S({ transparent: true, alphaTest: .5, map: X.atlas, emissive: 0xffffff, emissiveMap: X.atlas, emissiveIntensity: .7, roughness: .4 }),
    puddle: new Std({ color: 0xbff4ff, map: X.atlas, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, metalness: .3, roughness: .03, normalMap: X.water, normalScale: new THREE.Vector2(.25, .25) }),
    water: new Std({ color: 0x27c6d8, metalness: .1, roughness: .04, transparent: true, opacity: .62, normalMap: X.water, normalScale: new THREE.Vector2(.6, .6), depthWrite: false }),
    stream: new THREE.MeshBasicMaterial({ color: new THREE.Color(.5, 1.1, 1.3), transparent: true, opacity: .55, map: X.water, depthWrite: false, blending: THREE.AdditiveBlending }),
    pump: new S({ color: 0xffc21a, metalness: .25, roughness: .35 }),
    ocean: new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 } }, fog: false,
      vertexShader: 'varying vec3 vW; varying vec3 vN; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: OCEAN_FRAG }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xcff6ff, metalness: 0, roughness: .02, transparent: true, opacity: .14, depthWrite: false }),
  };
  return MAT;
}

// ------------------------------------------------------------------ geometry helpers (world-space box UVs so textures run seamlessly across tiles)
function worldUV(g, su = T, sv = T) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (ay >= ax && ay >= az) uv.setXY(i, p.getX(i) / su, p.getZ(i) / sv);
    else if (ax >= az) uv.setXY(i, -Math.sign(n.getX(i)) * p.getZ(i) / su, p.getY(i) / sv);
    else uv.setXY(i, Math.sign(n.getZ(i)) * p.getX(i) / su, p.getY(i) / sv);
  }
  return g;
}
class Buckets {
  constructor() { this.b = {}; }
  add(k, g) { (this.b[k] = this.b[k] || []).push(g); return g; }
  box(k, w, h, d, x, y, z, ry = 0) { const g = new THREE.BoxGeometry(w, h, d); if (ry) g.rotateY(ry); g.translate(x, y, z); return this.add(k, g); }
  rbox(k, w, h, d, x, y, z, ry = 0, r = .04) { const g = new RoundedBoxGeometry(w, h, d, 2, r); if (ry) g.rotateY(ry); g.translate(x, y, z); return this.add(k, g); }
  cyl(k, r, len, x, y, z, axis = 'y', seg = 12, r2 = r) { const g = new THREE.CylinderGeometry(r, r2, len, seg); if (axis === 'x') g.rotateZ(Math.PI / 2); if (axis === 'z') g.rotateX(Math.PI / 2); g.translate(x, y, z); return this.add(k, g); }
  build(group, mats, opt = {}) {
    const meshes = {};
    for (const k in this.b) {
      const list = this.b[k].map(g => g.index ? g.toNonIndexed() : g); let geo;
      try { geo = mergeGeometries(list, false); } catch (e) { geo = null; }
      if (!geo) { console.warn('merge failed', k); continue; }
      if (opt.world && opt.world.includes(k)) worldUV(geo, k === 'wall' ? T : T, k === 'wall' ? T : T);
      const m = new THREE.Mesh(geo, mats[k]);
      const noShadow = /strip|lamp|led|screen|sign|decal|puddle|water|stream|ocean|glass|rackLed/.test(k);
      m.castShadow = !noShadow && k !== 'floor'; m.receiveShadow = !/strip|lamp|led|ocean|stream/.test(k);
      m.matrixAutoUpdate = false; m.updateMatrix();
      group.add(m); meshes[k] = m;
    }
    return meshes;
  }
}
// a plane facing +dir (dir: [dx,dz]) at wall face, uv mapped to atlas cell
function atlasPlane(w, h, cell, rows = 4) {
  const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv, cx = cell % 4, cy = (cell / 4) | 0;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (cx + uv.getX(i)) / 4, 1 - (cy + 1 - uv.getY(i)) / rows);
  return g;
}
function facing(g, dx, dz) { g.rotateY(Math.atan2(dx, dz)); return g; }

// ------------------------------------------------------------------ level
export function buildLevel(rows, opt = {}) {
  const M = materials(), X = textures();
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const grid = rows.map(r => r.padEnd(w, '#').split(''));
  const at = (c, r) => (r < 0 || c < 0 || r >= h || c >= w) ? '#' : grid[r][c];
  const isWall = (c, r) => at(c, r) === '#';
  const L = { grid, w, h, at, doors: [], items: [], objectives: [], lockers: [], terminals: [], fixtures: [], leaks: [], sparkers: [], props: [], menders: [], windows: [], start: null, warden: null, exit: null, group: new THREE.Group(), dyn: [], flick: [] };
  const open8 = (c, r) => { let n = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (!isWall(c + i, r + j)) n++; return n; };
  const tallT = grid.map((row, r) => row.map((ch, c) => ch !== '#' && open8(c, r) >= 8));
  // grow: a tile is tall if any 8-neighbour is a "room core" tile (rooms get high ceilings, corridors stay low)
  const tall = (c, r) => { if (isWall(c, r) || /[dabc]/.test(at(c, r))) return false; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const cc = c + i, rr = r + j; if (rr >= 0 && cc >= 0 && rr < h && cc < w && tallT[rr][cc]) return true; } return false; };
  L.tall = tall; L.ceil = (c, r) => tall(c, r) ? HH : HL;
  const B = new Buckets(), P = (c) => c * T;
  const wallNb = (c, r) => DIRS.find(([dx, dy]) => isWall(c + dx, r + dy));
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const ch = at(c, r), x = P(c), z = P(r);
    if (ch === '#') {
      let near = false; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (!isWall(c + i, r + j)) near = true;
      if (near) B.box('wall', T, TOP, T, x, TOP / 2, z);
      continue;
    }
    const hc = L.ceil(c, r), door = /[dabc]/.test(ch), hv = hash(c, r, 7);
    // floor + ceiling
    B.box('floor', T, .3, T, x, -.15, z);
    if (tall(c, r)) {   // glass dome: the ocean (fish, caustics, sun shafts) right over your head
      const o = new THREE.PlaneGeometry(T, T); o.rotateX(Math.PI / 2); o.translate(x, TOP - .05, z); B.add('ocean', o);
      B.box('trimLight', T, .18, .22, x, hc + .1, z - T / 2); B.box('trimLight', .22, .18, T, x - T / 2, hc + .1, z);
      B.box('trim', .12, TOP - hc, .12, x - T / 2, (hc + TOP) / 2, z - T / 2);
    } else B.box('ceil', T, TOP - hc + .3, T, x, hc + (TOP - hc + .3) / 2, z);
    if (ch === '~' || (opt.flood && hv < .1)) { const g = new THREE.PlaneGeometry(T, T); g.rotateX(-Math.PI / 2); g.translate(x, .09, z); B.add('water', g); }
    if (door) continue;
    // ceiling beams + light fixture
    B.box('trim', T, .22, .32, x, hc - .11, z - T / 2);
    if (tall(c, r)) { B.box('trim', .32, .3, T, x - T / 2, hc - .15, z); if (hv < .35) B.cyl('pipe', .16, T, x, hc - .55, z + .6, 'x'); if (hv > .7) { const cur = new THREE.CatmullRomCurve3([new THREE.Vector3(x - T / 2, hc - .3, z - .5), new THREE.Vector3(x, hc - 1.1 - hv * .6, z - .3), new THREE.Vector3(x + T / 2, hc - .3, z - .5)]); B.add('cable', new THREE.TubeGeometry(cur, 10, .045, 6, false)); } }
    if ((c + r) % 2 === 0 || tall(c, r) && (c % 2 === 0)) {
      B.box('trim', 1.5, .12, .55, x, hc - .06, z);
      const kind = hv < .16 ? 'dead' : hv < .34 ? 'flick' : 'lamp';
      if (kind === 'flick') { const m = new THREE.Mesh(new THREE.BoxGeometry(1.3, .05, .34), M.lamp.clone()); m.position.set(x, hc - .14, z); L.group.add(m); L.flick.push(m); L.fixtures.push({ x, y: hc - 1.1, z, color: 0xcfeeff, int: 14, flick: m, ph: hv * 50 }); }
      else { B.box(kind, 1.3, .05, .34, x, hc - .14, z); if (kind === 'lamp') L.fixtures.push({ x, y: hc - 1.1, z, color: 0xcfeeff, int: 14 }); }
    }
    // walls facing this tile
    for (const [dx, dy] of DIRS) {
      if (!isWall(c + dx, r + dy)) continue;
      const ex = x + dx * T / 2, ez = z + dy * T / 2, along = dx !== 0 ? 'z' : 'x', ry = dx !== 0 ? Math.PI / 2 : 0;
      const off = (d) => [ex - dx * d, ez - dy * d], hf = hash(c * 3 + dx, r * 3 + dy, 11);
      let [px, pz] = off(.06); B.box('trim', T, .32, .14, px, .16, pz, ry);
      [px, pz] = off(.08); B.box('trim', T, .1, .16, px, hc - .2, pz, ry);
      // rib at one end
      { const sx = along === 'x' ? x - T / 2 + .14 : ex - dx * .1, sz = along === 'z' ? z - T / 2 + .14 : ez - dy * .1; B.box('trimLight', .28, hc, .22, sx, hc / 2, sz, ry); }
      // pipes along the top of the wall
      [px, pz] = off(.16); B.cyl(hf < .5 ? 'pipe' : 'pipeRed', .075, T, px, hc - .42, pz, along);
      [px, pz] = off(.3); B.cyl('pipe', .05, T, px, hc - .62, pz, along);
      // floor guide strip
      if (hf > .22) { [px, pz] = off(.02); B.box(opt.strip || 'stripC', T * .86, .04, .05, px, .4, pz, ry); }
      // extras
      if (hf < .14) { [px, pz] = off(.1); B.box('trim', .55, .8, .18, px, 1.35, pz, ry); [px, pz] = off(.2); B.box('led', .06, .06, .03, px, 1.6, pz, ry); }
      else if (hf < .24) { [px, pz] = off(.2); B.cyl('pipe', .11, hc, px + (along === 'x' ? .8 : 0), hc / 2, pz + (along === 'z' ? .8 : 0)); }
      if (hf > .55 && hf < .75) { const g = facing(atlasPlane(1.2, 1.6, hf < .65 ? 0 : 1), -dx, -dy); [px, pz] = off(.012); g.translate(px, 1.8 + hf, pz); B.add('decal', g); }
      if (hf > .74 && hf < .84 && tall(c, r) && !'TLwZXO'.includes(ch)) {   // aquarium column: fish, kelp, coral
        [px, pz] = off(.75); const tk = new THREE.CylinderGeometry(.5, .5, hc - .9, 20, 1, true); tk.translate(px, (hc - .9) / 2 + .45, pz); B.add('ocean', tk);
        B.cyl('trimLight', .62, .45, px, .225, pz, 'y', 20); B.cyl('trimLight', .62, .3, px, hc - .3, pz, 'y', 20); B.cyl('stripC', .64, .06, px, .47, pz, 'y', 20);
        const gl = new THREE.CylinderGeometry(.53, .53, hc - .9, 20, 1, true); gl.translate(px, (hc - .9) / 2 + .45, pz); B.add('glass', gl);
        L.props.push({ x: px, z: pz, hw: .6, hd: .6 }); L.fixtures.push({ x: px - dx * .9, y: 1.6, z: pz - dy * .9, color: 0x40c8ff, int: 4 });
      }
      if (hf > .9 && tall(c, r)) { const g = facing(atlasPlane(1.6, 1.6, 4 + ((hf * 1000) | 0) % SIGNS.length), -dx, -dy); [px, pz] = off(.03); g.translate(px, 2.4, pz); B.add('sign', g); }
    }
    // tile contents
    const nb = wallNb(c, r);
    const onWall = (d = .35) => nb ? [x + nb[0] * (T / 2 - d), z + nb[1] * (T / 2 - d), Math.atan2(-nb[0], -nb[1])] : [x, z, 0];
    if (ch === 'S') L.start = { x, z, c, r };
    else if (ch === 'W') L.warden = { x, z, c, r };
    else if (ch === 'M') L.menders.push({ x, z, c, r });
    else if (ch === 'X') {
      L.exit = { x, z, c, r };
      B.cyl('trim', 1.25, .16, x, .08, z, 'y', 32); B.cyl('hazard', 1.05, .17, x, .09, z, 'y', 32);
      for (const s of [-1, 1]) { B.box('trimLight', .3, hc, .3, x + s * 1.2, hc / 2, z - 1.1); B.box('trimLight', .3, hc, .3, x + s * 1.2, hc / 2, z + 1.1); }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, .05, 8, 48), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xff3030, emissiveIntensity: 5 })); ring.rotation.x = -Math.PI / 2; ring.position.set(x, .2, z); L.group.add(ring); L.exit.ring = ring;
      const g = facing(atlasPlane(1.6, 1.6, 4 + 7), 0, 1); g.translate(x, hc - .9, z - 1.25); B.add('sign', g);
      L.fixtures.push({ x, y: 1, z, color: 0xff3a30, int: 10, exit: true });
    }
    else if (ch === 'T') {
      const [tx_, tz, ry] = onWall(.5); L.terminals.push({ x: tx_, z: tz, c, r, read: false });
      B.rbox('trim', 1.1, 1.0, .55, tx_, .5, tz, ry); const g = new THREE.BoxGeometry(1.0, .7, .08); g.rotateX(-.35); g.rotateY(ry); g.translate(tx_ - Math.sin(ry) * -.05, 1.3, tz - Math.cos(ry) * -.05); B.add('trim', g);
      const s = new THREE.PlaneGeometry(.88, .6); s.rotateX(-.35); s.rotateY(ry); s.translate(tx_ + Math.sin(ry) * .0, 1.3, tz + Math.cos(ry) * .0); s.translate(Math.sin(ry) * .05, 0, Math.cos(ry) * .05); B.add(hv < .5 ? 'screen' : 'screenRed', s);
      L.fixtures.push({ x: tx_ + Math.sin(ry) * .8, y: 1.4, z: tz + Math.cos(ry) * .8, color: hv < .5 ? 0x40e0ff : 0xff5040, int: 4 });
      L.props.push({ x: tx_, z: tz, hw: .6, hd: .6 });
    }
    else if (ch === 'L') {
      const [lx, lz, ry] = onWall(.38); const g = new THREE.BoxGeometry(.95, 2.15, .62); g.rotateY(ry); g.translate(lx, 1.075, lz);
      // map locker texture onto the front face only (other faces share it, fine)
      B.add('locker', g); B.box('trim', 1.05, .08, .7, lx, 2.18, lz, ry);
      L.lockers.push({ x: lx, z: lz, c, r, ry }); L.props.push({ x: lx, z: lz, hw: .55, hd: .55 });
    }
    else if (ch === 'C') {
      const n = 2 + ((hv * 3) | 0);
      for (let k = 0; k < n; k++) { const s = .9 + hash(c, r, k) * .5, a = hash(r, c, k) * 2 - 1; B.rbox('crate', s, s * .8, s, x + (k % 2 ? .45 : -.45) + a * .1, (k < 2 ? 0 : s * .8) + s * .4, z + (k === 1 ? .5 : -.3), a * .4, .05); }
      L.props.push({ x, z, hw: 1.15, hd: 1.15 });
    }
    else if (ch === 'Q') {
      B.cyl('pump', 1.0, hc - .4, x, (hc - .4) / 2, z, 'y', 28); for (const yy of [.5, 1.6, hc - 1]) B.cyl('trim', 1.08, .18, x, yy, z, 'y', 28);
      B.cyl('stripA', 1.02, .08, x, 2.4, z, 'y', 28); B.cyl('pipe', .22, hc, x + 1.1, hc / 2, z + .4); B.cyl('pipeRed', .3, T, x, hc - .3, z, 'x');
      L.props.push({ x, z, hw: 1.15, hd: 1.15 }); L.fixtures.push({ x: x + 1.4, y: 2.4, z: z + 1.4, color: 0xffa040, int: 5 });
    }
    else if (ch === 'Y') {
      for (const s of [-1, 1]) { B.box('rack', .95, 2.5, .9, x + s * .55, 1.25, z); const f = new THREE.PlaneGeometry(.8, 2.2); f.translate(x + s * .55, 1.25, z + .455); B.add('rackLed', f); const f2 = new THREE.PlaneGeometry(.8, 2.2); f2.rotateY(Math.PI); f2.translate(x + s * .55, 1.25, z - .455); B.add('rackLed', f2); }
      B.box('cable', 2.1, .1, .5, x, 2.55, z);
      L.props.push({ x, z, hw: 1.1, hd: .55 }); L.fixtures.push({ x, y: 1.5, z: z + 1.2, color: 0x30ff90, int: 3 });
    }
    else if (ch === 'w') {
      const [wx, wz, ry] = onWall(.0); const dx = Math.sin(ry), dz = Math.cos(ry);
      const disc = new THREE.CircleGeometry(.95, 40); disc.rotateY(ry); disc.translate(wx + dx * .04, 1.8, wz + dz * .04); B.add('ocean', disc);
      const ring = new THREE.TorusGeometry(1.0, .13, 10, 40); ring.rotateY(ry); ring.translate(wx, 1.8, wz); B.add('trimLight', ring);
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; const b = new THREE.BoxGeometry(.12, .12, .1); b.translate(Math.cos(a) * 1.0, Math.sin(a) * 1.0 + 1.8, .08); b.rotateY(0); const bb = b; bb.translate(0, 0, 0); const q = new THREE.BoxGeometry(.12, .12, .1); q.translate(Math.cos(a), Math.sin(a), .08); q.rotateY(ry); q.translate(wx, 1.8, wz); B.add('trim', q); }
      const gl = new THREE.CircleGeometry(.95, 40); gl.rotateY(ry); gl.translate(wx + dx * .09, 1.8, wz + dz * .09); B.add('glass', gl);
      L.fixtures.push({ x: wx + dx * 1.2, y: 1.8, z: wz + dz * 1.2, color: 0x1a8cff, int: 6 }); L.windows.push({ x: wx, z: wz });
    }
    else if (ch === 'R') {
      const sx = x + (hv - .5), sz = z + (hash(r, c, 3) - .5);
      const s = new THREE.CylinderGeometry(.035, .06, hc, 6, 1, true); s.translate(sx, hc / 2, sz); B.add('stream', s);
      const p = atlasPlane(2.6, 2.6, 3); p.rotateX(-Math.PI / 2); p.translate(sx, .012, sz); B.add('puddle', p);
      L.leaks.push({ x: sx, z: sz, top: hc });
    }
    else if (ch === 'Z') {
      const [zx, zz, ry] = onWall(.1); const g = new THREE.BoxGeometry(.9, .7, .12); g.rotateZ(.3); g.rotateY(ry); g.translate(zx, 1.7, zz); B.add('trimLight', g);
      const sc = facing(atlasPlane(1.6, 1.6, 2), -Math.sin(ry) * -1, -Math.cos(ry) * -1); sc.translate(zx + Math.sin(ry) * .02, 1.7, zz + Math.cos(ry) * .02); B.add('decal', sc);
      for (let k = 0; k < 3; k++) { const cur = new THREE.CatmullRomCurve3([new THREE.Vector3(zx, 1.6, zz), new THREE.Vector3(zx + Math.sin(ry) * .3 + (k - 1) * .15, 1.0 - k * .15, zz + Math.cos(ry) * .3), new THREE.Vector3(zx + Math.sin(ry) * .4 + (k - 1) * .25, .6 + k * .1, zz + Math.cos(ry) * .45)]); B.add('cable', new THREE.TubeGeometry(cur, 8, .03, 5, false)); }
      L.sparkers.push({ x: zx + Math.sin(ry) * .25, y: 1.6, z: zz + Math.cos(ry) * .25, t: 1 + hv * 3 });
    }
    else if (ch === 'O') L.objectives.push({ x, z, c, r, done: false, prog: 0 });
    else if ('123BPGHJ'.includes(ch)) L.items.push({ kind: ch, x, z, c, r, taken: false });
  }
  // doors
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const ch = at(c, r); if (!/[dabc]/.test(ch)) continue;
    const x = P(c), z = P(r), ns = isWall(c - 1, r) && isWall(c + 1, r), ry = ns ? 0 : Math.PI / 2, Hd = 2.7, hc = HL;
    // frame
    for (const s of [-1, 1]) { const ox = ns ? s * (T / 2 - .2) : 0, oz = ns ? 0 : s * (T / 2 - .2); B.box('trimLight', ns ? .4 : .7, Hd, ns ? .7 : .4, x + ox, Hd / 2, z + oz); }
    B.box('trim', ns ? T : .7, hc - Hd, ns ? .7 : T, x, Hd + (hc - Hd) / 2, z);
    const hz = new THREE.BoxGeometry(ns ? T - .8 : .72, .22, ns ? .72 : T - .8); hz.translate(x, .11, z); B.add('hazard', hz);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(ns ? T - .7 : .22, Hd, ns ? .22 : T - .7), M.door); slab.position.set(x, Hd / 2, z); slab.castShadow = slab.receiveShadow = true; L.group.add(slab);
    const key = ch === 'd' ? null : ' abc'.indexOf(ch);
    const col = [0x40ff90, 0xffa030, 0x30d8ff, 0xb070ff][key || 0];
    const lm = new THREE.MeshStandardMaterial({ color: 0, emissive: col, emissiveIntensity: 5 });
    const lg = []; for (const s of [-1, 1]) { const g = new THREE.BoxGeometry(ns ? 1.0 : .1, .1, ns ? .1 : 1.0); g.translate(x + (ns ? 0 : s * .4), Hd + .12, z + (ns ? s * .4 : 0)); lg.push(g); }
    const light = new THREE.Mesh(mergeGeometries(lg), lm); L.group.add(light);
    L.doors.push({ c, r, x, z, ns, key, unlocked: key === null, open: 0, slab, light, col, Hd });
    L.fixtures.push({ x, y: 2.9, z, color: col, int: key ? 3 : 2, door: L.doors[L.doors.length - 1] });
  }
  L.meshes = B.build(L.group, M, { world: ['wall', 'floor', 'ceil'] });
  L.group.traverse(o => { if (o.isMesh && o.matrixAutoUpdate) { /* dynamic */ } });
  return L;
}

// ------------------------------------------------------------------ collision + visibility + paths
export function solidTile(L, c, r, opt = {}) {
  const ch = L.at(c, r); if (ch === '#') return true;
  if (/[dabc]/.test(ch)) { const d = L.doors.find(d => d.c === c && d.r === r); return d ? d.open < .8 : true; }
  return false;
}
export function blocked(L, x, z, rad) {
  const c0 = Math.floor((x - rad) / T + .5), c1 = Math.floor((x + rad) / T + .5), r0 = Math.floor((z - rad) / T + .5), r1 = Math.floor((z + rad) / T + .5);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    if (!solidTile(L, c, r)) continue;
    const ch = L.at(c, r), dx = Math.max(Math.abs(x - c * T) - T / 2, 0), dz = Math.max(Math.abs(z - r * T) - T / 2, 0);
    if (/[dabc]/.test(ch)) { // doors: only the slab line is solid; the frame posts too
      const d = L.doors.find(d => d.c === c && d.r === r);
      const ax = d.ns ? Math.max(Math.abs(x - c * T) - T / 2, 0) : Math.max(Math.abs(x - c * T) - .2, 0), az = d.ns ? Math.max(Math.abs(z - r * T) - .2, 0) : Math.max(Math.abs(z - r * T) - T / 2, 0);
      if (ax * ax + az * az < rad * rad) return true; continue;
    }
    if (dx * dx + dz * dz < rad * rad) return true;
  }
  for (const p of L.props) { const dx = Math.max(Math.abs(x - p.x) - p.hw, 0), dz = Math.max(Math.abs(z - p.z) - p.hd, 0); if (dx * dx + dz * dz < rad * rad) return true; }
  return false;
}
export function los(L, x0, z0, x1, z1) {
  const d = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(d / .3);
  for (let i = 1; i < n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; if (solidTile(L, Math.floor(x / T + .5), Math.floor(z / T + .5))) return false; }
  return true;
}
export const tileOf = (x, z) => [Math.floor(x / T + .5), Math.floor(z / T + .5)];
// BFS over tiles; pass(c,r) decides doors. Returns list of [c,r] from start (excluded) to goal.
export function path(L, from, to, pass) {
  const [c0, r0] = from, [c1, r1] = to; if (c0 === c1 && r0 === r1) return [];
  const W = L.w, prev = new Int32Array(W * L.h).fill(-1), q = [r0 * W + c0]; prev[q[0]] = q[0];
  for (let qi = 0; qi < q.length; qi++) {
    const k = q[qi], c = k % W, r = (k / W) | 0;
    if (c === c1 && r === r1) break;
    for (const [dx, dy] of DIRS) { const cc = c + dx, rr = r + dy, kk = rr * W + cc; if (cc < 0 || rr < 0 || cc >= W || rr >= L.h || prev[kk] >= 0) continue; if (!pass(cc, rr)) continue; if ((cc !== c1 || rr !== r1) && 'QYC'.includes(L.at(cc, rr))) continue; prev[kk] = k; q.push(kk); }
  }
  const goal = r1 * W + c1; if (prev[goal] < 0) return null;
  const out = []; for (let k = goal; k !== r0 * W + c0; k = prev[k]) out.push([k % W, (k / W) | 0]);
  return out.reverse();
}
