// Procedural level generator.
// Deterministic — aynı index her zaman aynı seviyeyi üretir.
// Solvability "constructive" garantisi: koridor şablonları + plaka-kapı
// mesafesi >1 zorlanır → solo-pass bug'ı yok.

const Generator = (() => {
  const TOTAL = 1987;

  // Kapı/plaka harfleri — B (kutu), G (hedef), P (oyuncu), Q (quantum), X (devriye) ile çakışmasın.
  // Pratikte generator en fazla 3 kapı üretiyor, ilk 3 yeterli.
  const DOOR_LETTERS = ["A", "C", "D", "E", "F", "H", "I", "J", "K"];
  const doorChar  = (i) => DOOR_LETTERS[i] || "A";
  const plateChar = (i) => DOOR_LETTERS[i] ? DOOR_LETTERS[i].toLowerCase() : "a";

  // ---- mulberry32 PRNG ----
  function rng(seed) {
    let s = seed | 0;
    return () => {
      s = s + 0x6D2B79F5 | 0;
      let t = s;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function rint(r, lo, hi) { return lo + Math.floor(r() * (hi - lo + 1)); }
  function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }

  // ---- Grid helpers ----
  function makeGrid(W, H) {
    const g = [];
    for (let y = 0; y < H; y++) {
      const row = [];
      for (let x = 0; x < W; x++) {
        row.push((y === 0 || y === H - 1 || x === 0 || x === W - 1) ? "#" : ".");
      }
      g.push(row);
    }
    return g;
  }
  function gridToStrings(g) { return g.map(r => r.join("")); }

  // Hücre tipi yardımcıları
  function isDoorCell(c) {
    if (c < "A" || c > "Z") return false;
    return c !== "B" && c !== "G" && c !== "P" && c !== "Q" && c !== "X";
  }
  function isPlateCell(c) { return c >= "a" && c <= "z" && c !== "v"; }
  function isPortalCell(c) { return c >= "1" && c <= "9"; }

  // Genel BFS — opts.doorsClosed: kapıları duvar say; opts.portalsDisabled: portal teleport iptal
  function bfsReach(grid, sx, sy, opts) {
    opts = opts || {};
    const H = grid.length, W = grid[0].length;
    const seen = new Set();
    const q = [[sx, sy]];
    while (q.length) {
      const [x, y] = q.shift();
      const k = x + "," + y;
      if (seen.has(k)) continue;
      seen.add(k);
      // Portal teleport
      if (!opts.portalsDisabled && isPortalCell(grid[y][x])) {
        const ch = grid[y][x];
        for (let yy = 0; yy < H; yy++) {
          for (let xx = 0; xx < W; xx++) {
            if ((xx !== x || yy !== y) && grid[yy][xx] === ch) q.push([xx, yy]);
          }
        }
      }
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const c = grid[ny][nx];
        if (c === "#") continue;
        if ("^v<>".includes(c)) continue;       // emitter solid
        if (opts.doorsClosed && isDoorCell(c)) continue;
        q.push([nx, ny]);
      }
    }
    return seen;
  }

  // Eski API (geriye uyumluluk)
  function reachable(grid, sx, sy, gx, gy) {
    return bfsReach(grid, sx, sy, {}).has(gx + "," + gy);
  }

  // Üretilmiş seviyeyi mantıksal tutarlılık için denetle.
  // Dönüş: null = geçerli; string = neden invalid.
  function auditLevel(grid) {
    let px = -1, py = -1, gx = -1, gy = -1;
    const plates = new Map();   // letter -> [{x,y}]
    const doors = new Map();    // letter -> [{x,y}]
    const portals = new Map();  // digit -> [{x,y}]
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        const c = grid[y][x];
        if (c === "P") { px = x; py = y; }
        else if (c === "G") { gx = x; gy = y; }
        else if (isPlateCell(c)) {
          if (!plates.has(c)) plates.set(c, []);
          plates.get(c).push({ x, y });
        } else if (isDoorCell(c)) {
          if (!doors.has(c)) doors.set(c, []);
          doors.get(c).push({ x, y });
        } else if (isPortalCell(c)) {
          if (!portals.has(c)) portals.set(c, []);
          portals.get(c).push({ x, y });
        }
      }
    }
    if (px < 0) return "missing P";
    if (gx < 0) return "missing G";

    // 1. Tek bir P ve G olmalı (template'lar zaten sağlıyor ama emin ol)
    let pCount = 0, gCount = 0;
    for (const row of grid) for (const c of row) {
      if (c === "P") pCount++;
      if (c === "G") gCount++;
    }
    if (pCount !== 1) return "wrong P count: " + pCount;
    if (gCount !== 1) return "wrong G count: " + gCount;

    // 2. Her kapının eşli plakası olmalı (orphan door → unsolvable)
    for (const [d] of doors) {
      if (!plates.has(d.toLowerCase())) return "door " + d + " without plate";
    }
    // NOT: Orphan plate kontrolü yapılmıyor — tplLaser plakayı kapı yerine
    // lazer'e bağlıyor (lasers: [{plate:'a'}]). Bu geçerli bir tasarım.
    // 4. Her portal tam 2 kez geçmeli (engine pair gerektiriyor)
    for (const [d, list] of portals) {
      if (list.length !== 2) return "portal " + d + " has " + list.length + " instances";
    }
    // 5. P→G ulaşılır olmalı (kapılar açık varsayımıyla)
    const reachOpen = bfsReach(grid, px, py, {});
    if (!reachOpen.has(gx + "," + gy)) return "G unreachable";
    // 6. Her plaka P'den ulaşılır olmalı (kapılar açık)
    for (const [letter, list] of plates) {
      let found = false;
      for (const pos of list) if (reachOpen.has(pos.x + "," + pos.y)) { found = true; break; }
      if (!found) return "plate " + letter + " unreachable";
    }
    // 7. Yankı zorunluluğu — kapılar KAPALI iken P→G ulaşılamamalı (en az bir kapı gerçekten gating yapıyor)
    if (doors.size > 0) {
      const reachClosed = bfsReach(grid, px, py, { doorsClosed: true });
      if (reachClosed.has(gx + "," + gy)) return "solo-passable (doors not gating)";
    }
    return null;
  }

  // ---- Templates ----
  // T1: yatay koridor — P solda, G sağda, N gate ortada
  function tplHorizontal(r, gates, withPortal, withLaser) {
    const cellsPerRegion = rint(r, 2, 4);
    const W = 1 + (gates + 1) * (cellsPerRegion + 1) + 1;   // baş + bölgeler + son
    const H = rint(r, 4, 6);
    const g = makeGrid(W, H);
    const playerRow = Math.floor(H / 2);

    g[playerRow][1] = "P";
    let curX = 1 + cellsPerRegion + 1;
    for (let i = 0; i < gates; i++) {
      // Dikey duvar + kapı playerRow'da
      for (let y = 1; y < H - 1; y++) {
        g[y][curX] = (y === playerRow) ? doorChar(i) : "#";
      }
      // Plaka önceki bölgede, kapıdan UZAK (>=2 cell)
      const plateX = Math.max(1, curX - 1 - rint(r, 1, cellsPerRegion - 1));
      const plateY = pick(r, [1, H - 2, playerRow]);
      if (g[plateY][plateX] === ".") g[plateY][plateX] = plateChar(i);
      curX += cellsPerRegion + 1;
    }
    g[playerRow][W - 2] = "G";

    // Opsiyonel: portal — başlangıca yakın bir hücre ile son bölgenin içine
    if (withPortal) {
      const p1y = playerRow === 1 ? H - 2 : 1;
      const p2y = p1y;
      const p1x = 2;
      const p2x = W - 3;
      if (g[p1y][p1x] === "." && g[p2y][p2x] === ".") {
        g[p1y][p1x] = "1";
        g[p2y][p2x] = "1";
      }
    }

    const moves = W * 2 + gates * 4 + 6;
    return { grid: gridToStrings(g), moves, lasers: [] };
  }

  // T2: dikey koridor — yukarıdan aşağıya
  function tplVertical(r, gates, withPortal) {
    const cellsPerRegion = rint(r, 2, 3);
    const H = 1 + (gates + 1) * (cellsPerRegion + 1) + 1;
    const W = rint(r, 5, 7);
    const g = makeGrid(W, H);
    const playerCol = Math.floor(W / 2);

    g[1][playerCol] = "P";
    let curY = 1 + cellsPerRegion + 1;
    for (let i = 0; i < gates; i++) {
      for (let x = 1; x < W - 1; x++) {
        g[curY][x] = (x === playerCol) ? doorChar(i) : "#";
      }
      const plateY = Math.max(1, curY - 1 - rint(r, 1, cellsPerRegion - 1));
      const plateX = pick(r, [1, W - 2, playerCol]);
      if (g[plateY][plateX] === ".") g[plateY][plateX] = plateChar(i);
      curY += cellsPerRegion + 1;
    }
    g[H - 2][playerCol] = "G";

    if (withPortal) {
      const p1x = playerCol === 1 ? W - 2 : 1;
      if (g[1][p1x] === "." && g[H - 2][p1x] === ".") {
        g[1][p1x] = "1";
        g[H - 2][p1x] = "1";
      }
    }

    const moves = H * 2 + gates * 4 + 6;
    return { grid: gridToStrings(g), moves, lasers: [] };
  }

  // T3: lazer koridoru — yatay yapı, iki sıra arasında lazer
  function tplLaser(r, gates) {
    const W = rint(r, 8, 10);
    const H = 7;
    const g = makeGrid(W, H);
    // P üstte, G altta. Orta satırda lazer (plaka ile söndürülebilir).
    g[1][1] = "P";

    // Geçit kolonu
    const passageCol = rint(r, 2, W - 3);
    for (let y = 2; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        if (x !== passageCol) g[y][x] = "#";
      }
    }
    // Lazer satırını aç ve emitter koy
    const laserY = Math.floor(H / 2);
    for (let x = 1; x < W - 1; x++) g[laserY][x] = ".";
    g[laserY][1] = ">";

    // G'yi passage sütunundaki alt bölgeye koy (erişilebilir garanti)
    g[H - 2][passageCol] = "G";

    // Plaka üst bölgede
    const plateX = pick(r, [2, W - 2]);
    if (g[1][plateX] === ".") g[1][plateX] = "a";
    else g[1][2] = "a";   // fallback

    return {
      grid: gridToStrings(g),
      moves: W + H + 8,
      lasers: [{ x: 1, y: laserY, plate: "a" }],
    };
  }

  // Bir corridor floor hücresine X (devriye) yerleştir.
  // P/G/plaka/kapı/portal/emitter olmayan ilk uygun hücre seçilir.
  function injectPatrol(grid, r) {
    const H = grid.length, W = grid[0].length;
    const candidates = [];
    for (let y = 1; y < H - 1; y++) {
      for (let x = 2; x < W - 2; x++) {
        if (grid[y][x] !== ".") continue;
        // Solda ve sağda boş hücre olsun ki devriye yürüyebilsin
        if (grid[y][x - 1] === "." && grid[y][x + 1] === ".") {
          candidates.push([x, y]);
        }
      }
    }
    if (candidates.length === 0) return false;
    const [px, py] = candidates[Math.floor(r() * candidates.length)];
    grid[py][px] = "X";
    return true;
  }

  // ---- Public ----
  function level(idx) {
    if (idx < 0 || idx >= TOTAL) return null;

    // Birden fazla seed dene — audit'ten geçen ilk seviyeyi döndür
    for (let attempt = 0; attempt < 12; attempt++) {
      const r = rng(idx * 7919 + 13 + attempt * 9973);

      const difficulty = idx;
      const gates = difficulty < 20 ? 1
                  : difficulty < 60 ? rint(r, 1, 2)
                  : difficulty < 200 ? rint(r, 1, 3)
                  : difficulty < 600 ? rint(r, 2, 3)
                  : rint(r, 2, 3);

      const withPortal = difficulty >= 80 && r() < 0.30;
      const wantLaser  = difficulty >= 250 && r() < 0.25;
      // Yeni mekanikler — daha yüksek zorluklarda
      const wantFragile = difficulty >= 150 && r() < 0.18;
      const wantPatrol  = difficulty >= 350 && r() < 0.22 && !wantLaser;

      let lvl;
      if (wantLaser) {
        lvl = tplLaser(r, gates);
      } else if (r() < 0.35) {
        lvl = tplVertical(r, gates, withPortal);
      } else {
        lvl = tplHorizontal(r, gates, withPortal, false);
      }

      // Patrol inject — koridorda yürüyebilecek bir hücreye X yerleştir
      const gridArr = lvl.grid.map(s => [...s]);
      let patrolAdded = false;
      if (wantPatrol) patrolAdded = injectPatrol(gridArr, r);

      // Fragile plate: rastgele bir plaka harfini kırılgan olarak işaretle
      let fragile = null;
      if (wantFragile) {
        const plateLetters = [];
        for (const row of gridArr) for (const c of row) {
          if (c >= "a" && c <= "z" && !plateLetters.includes(c)) plateLetters.push(c);
        }
        if (plateLetters.length > 0) {
          fragile = [plateLetters[Math.floor(r() * plateLetters.length)]];
        }
      }

      // Tam audit: orphan door/plate, unreachable plate, portal pairing,
      // solo-pass (echo zorunlu), P→G ulaşılırlığı — hepsi tek seferde
      const grid = gridArr;
      const auditFail = auditLevel(grid);
      if (auditFail === null) {
        const tags = [];
        if (gates > 0) tags.push(`${gates} kapı`);
        if (withPortal) tags.push("portal");
        if (wantLaser) tags.push("lazer");
        if (patrolAdded) tags.push("devriye");
        if (fragile) tags.push("kırılgan");
        const tagsEn = [];
        if (gates > 0) tagsEn.push(`${gates} gate${gates > 1 ? "s" : ""}`);
        if (withPortal) tagsEn.push("portal");
        if (wantLaser) tagsEn.push("laser");
        if (patrolAdded) tagsEn.push("sentry");
        if (fragile) tagsEn.push("fragile");
        return {
          name:  { tr: `BÖLÜM ${idx + 1}`, en: `LEVEL ${idx + 1}` },
          intro: {
            tr: `Üretilmiş seviye · ${tags.join(" · ")}.`,
            en: `Generated level · ${tagsEn.join(" · ")}.`,
          },
          moves: lvl.moves + (patrolAdded ? 4 : 0),
          grid:  grid.map(row => row.join("")),
          lasers: lvl.lasers || [],
          fragile: fragile || undefined,
          __generated: true,
          __seed: idx,
        };
      }
    }
    // Fallback: basit tek kapılı yatay koridor
    const r = rng(idx * 7919 + 13);
    const lvl = tplHorizontal(r, 1, false, false);
    return {
      name:  { tr: `BÖLÜM ${idx + 1}`, en: `LEVEL ${idx + 1}` },
      intro: { tr: "Üretilmiş seviye · 1 kapı.", en: "Generated level · 1 gate." },
      moves: lvl.moves,
      grid:  lvl.grid,
      lasers: [],
      __generated: true,
      __seed: idx,
    };
  }

  return { TOTAL, level };
})();
