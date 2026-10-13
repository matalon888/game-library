/* ============================================================
   The city as it stood.

   One builder, driven by a per-site recipe, writing into a second
   block array. The dig world keeps its buried remains where the
   city's walls and floors were, so digging at a building actually
   hits that building's brick.

   Returns six anchors — the places the six clues point at.
   ============================================================ */
import { B } from "./blocks.js";
import { WX, WZ } from "./world.js";

export const CITY = {
  rakhigarhi: { wall: B.MUDBRICK, house: B.MUDBRICK, floor: B.CLAY, road: B.DIRT,
                big: B.MUDBRICK, special: "well", rampart: true, blocks: 3, houseH: 3 },
  lothal:     { wall: B.BRICK, house: B.MUDBRICK, floor: B.CLAY, road: B.SAND,
                big: B.BRICK, special: "basin", rampart: false, blocks: 3, houseH: 3 },
  vidisha:    { wall: B.MUDBRICK, house: B.MUDBRICK, floor: B.LOAM, road: B.DIRT,
                big: B.PLASTER, special: "pillar", rampart: true, blocks: 3, houseH: 4 },
  nalanda:    { wall: B.BRICK, house: B.BRICK, floor: B.PLASTER, road: B.RUBBLE,
                big: B.BRICK, special: "stupa", rampart: false, blocks: 3, houseH: 5 },
  hampi:      { wall: B.GRANITE, house: B.GRANITE, floor: B.PLASTER, road: B.SAND,
                big: B.GRANITE, special: "temple", rampart: false, blocks: 3, houseH: 4 }
};

/* labels shown floating over the city in Then view */
export const LABEL_KEYS = {
  house: "city.house", street: "city.street", drain: "city.drain", well: "city.well",
  big: "city.big", gate: "city.gate", special: "city.special", workshop: "city.workshop"
};

export function buildCity(world, siteId) {
  const cfg = CITY[siteId] || CITY.rakhigarhi;
  const cx = Math.floor(WX / 2), cz = Math.floor(WZ / 2);
  const anchors = [], labels = [];

  /* ground level of the mound top; the city sits on one terrace */
  const base = world.surfaceAt(cx, cz);
  const put = (x, y, z, id) => world.setThen(x, y, z, id);
  const buried = (x, z, depth, id) => world.setBuried(x, z, depth, id);

  /* flatten a terrace for the town */
  const R = 26;
  for (let dz = -R; dz <= R; dz++)
    for (let dx = -R; dx <= R; dx++) {
      if (Math.hypot(dx, dz) > R) continue;
      const x = cx + dx, z = cz + dz;
      const s = world.surfaceAt(x, z);
      for (let y = s + 1; y <= base; y++) put(x, y, z, cfg.floor);
      for (let y = base + 1; y < base + 8; y++) put(x, y, z, B.AIR);
      put(x, base, z, cfg.floor);
    }

  /* street grid: two main streets crossing, houses in the blocks between */
  const step = 9;
  for (let d = -R; d <= R; d++) {
    for (const w of [-1, 0, 1]) {
      put(cx + d, base, cz + w, cfg.road);
      put(cx + w, base, cz + d, cfg.road);
      /* the covered drain runs under the street */
      buried(cx + d, cz + w, 1, B.BRICK);
      buried(cx + w, cz + d, 1, B.BRICK);
    }
  }

  const houseAt = (hx, hz, w, h) => {
    for (let dz = 0; dz < h; dz++)
      for (let dx = 0; dx < w; dx++) {
        const edge = dx === 0 || dz === 0 || dx === w - 1 || dz === h - 1;
        for (let y = 1; y <= cfg.houseH; y++)
          if (edge) put(hx + dx, base + y, hz + dz, cfg.house);
        put(hx + dx, base, hz + dz, cfg.floor);
        /* wall footings survive underground */
        if (edge) { buried(hx + dx, hz + dz, 1, cfg.house);
                    buried(hx + dx, hz + dz, 2, cfg.house); }
      }
    /* doorway */
    put(hx + Math.floor(w / 2), base + 1, hz, B.AIR);
    put(hx + Math.floor(w / 2), base + 2, hz, B.AIR);
  };

  for (let bz = -2; bz <= 1; bz++)
    for (let bx = -2; bx <= 1; bx++) {
      const hx = cx + 3 + bx * step, hz = cz + 3 + bz * step;
      if (Math.hypot(hx - cx, hz - cz) > R - 4) continue;
      houseAt(hx, hz, 6, 6);
    }

  /* the big building: granary, warehouse, monastery block, temple hall */
  const gx = cx - 16, gz = cz - 6;
  for (let dz = 0; dz < 10; dz++)
    for (let dx = 0; dx < 14; dx++) {
      put(gx + dx, base + 1, gz + dz, cfg.big);
      const edge = dx === 0 || dz === 0 || dx === 13 || dz === 9;
      if (edge) for (let y = 2; y <= cfg.houseH + 2; y++) put(gx + dx, base + y, gz + dz, cfg.big);
      buried(gx + dx, gz + dz, 1, cfg.big);
    }
  labels.push({ key: LABEL_KEYS.big, x: gx + 7, y: base + cfg.houseH + 4, z: gz + 5 });

  /* the one thing this site is known for */
  const sx = cx + 14, sz = cz + 10;
  if (cfg.special === "well" || cfg.special === "basin") {
    const r = cfg.special === "basin" ? 7 : 3;
    for (let dz = -r; dz <= r; dz++)
      for (let dx = -r; dx <= r; dx++) {
        const ring = Math.abs(dx) === r || Math.abs(dz) === r;
        for (let y = 1; y <= 2; y++) put(sx + dx, base + y, sz + dz, ring ? cfg.wall : B.AIR);
        put(sx + dx, base, sz + dz, ring ? cfg.wall : B.WATER);
        buried(sx + dx, sz + dz, 1, cfg.wall);
      }
  } else if (cfg.special === "pillar") {
    for (let y = 1; y <= 9; y++) put(sx, base + y, sz, B.GRANITE);
    for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) put(sx + dx, base + 1, sz + dz, B.GRANITE);
    buried(sx, sz, 1, B.GRANITE);
  } else if (cfg.special === "stupa") {
    for (let y = 1; y <= 8; y++) {
      const r = Math.max(1, 7 - y);
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++)
        if (Math.hypot(dx, dz) <= r) put(sx + dx, base + y, sz + dz, B.BRICK);
    }
    buried(sx, sz, 1, B.BRICK);
  } else if (cfg.special === "temple") {
    for (let y = 1; y <= 12; y++) {
      const r = Math.max(1, 6 - Math.floor(y / 2));
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        const edge = Math.abs(dx) === r || Math.abs(dz) === r;
        if (edge || y === 1) put(sx + dx, base + y, sz + dz, B.GRANITE);
      }
    }
    buried(sx, sz, 1, B.GRANITE);
  }
  labels.push({ key: LABEL_KEYS.special, x: sx, y: base + 10, z: sz });

  /* rampart and gate */
  if (cfg.rampart) {
    for (let a = 0; a < 360; a += 2) {
      const rad = a * Math.PI / 180;
      const x = Math.round(cx + Math.cos(rad) * (R + 2));
      const z = Math.round(cz + Math.sin(rad) * (R + 2));
      const gate = Math.abs(z - cz) < 3 && x > cx;
      if (gate) continue;
      const s = world.surfaceAt(x, z);
      for (let y = 1; y <= 4; y++) put(x, Math.max(base, s) + y, z, cfg.wall);
      buried(x, z, 1, cfg.wall);
    }
    labels.push({ key: LABEL_KEYS.gate, x: cx + R + 2, y: base + 5, z: cz });
  }

  /* six anchors, in clue order */
  anchors.push({ type: "burnt",    x: cx + 12, z: cz - 14 });   // kiln ground
  anchors.push({ type: "hollow",   x: sx,      z: sz });        // well / tank
  anchors.push({ type: "cairn",    x: cx + R,  z: cz + 2 });    // by the gate road
  anchors.push({ type: "wallline", x: cx + 3,  z: cz + 3 });    // house wall
  anchors.push({ type: "tree",     x: gx + 7,  z: gz + 5 });    // the big building
  anchors.push({ type: "grove",    x: cx - 6,  z: cz + R + 3 }); // outside the wall
  labels.push({ key: LABEL_KEYS.street, x: cx, y: base + 3, z: cz });
  labels.push({ key: LABEL_KEYS.house, x: cx + 6, y: base + cfg.houseH + 2, z: cz + 6 });

  return { anchors, labels, base };
}
