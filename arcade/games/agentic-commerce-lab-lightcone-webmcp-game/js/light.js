/* LIGHTCONE · 2D raytracing over the tile grid (DDA), used by both the
   renderer (visibility polygons) and the engine (line-of-sight checks). */
(function () {
  window.HS = window.HS || {};

  // March a ray from (px,py) in tile units; returns distance to first solid
  // cell edge, capped at maxDist. solid(x,y) decides occlusion.
  function castRay(px, py, ang, maxDist, solid) {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    let mapX = Math.floor(px), mapY = Math.floor(py);
    const ddx = Math.abs(1 / dx), ddy = Math.abs(1 / dy);
    let stepX, sideX, stepY, sideY;
    if (dx < 0) { stepX = -1; sideX = (px - mapX) * ddx; }
    else { stepX = 1; sideX = (mapX + 1 - px) * ddx; }
    if (dy < 0) { stepY = -1; sideY = (py - mapY) * ddy; }
    else { stepY = 1; sideY = (mapY + 1 - py) * ddy; }
    let dist = 0;
    for (let i = 0; i < 96; i++) {
      if (sideX < sideY) { dist = sideX; sideX += ddx; mapX += stepX; }
      else { dist = sideY; sideY += ddy; mapY += stepY; }
      if (dist >= maxDist) return maxDist;
      if (solid(mapX, mapY)) return dist;
    }
    return maxDist;
  }

  // True if the segment from (ax,ay) to (bx,by) is unobstructed.
  function lineOfSight(ax, ay, bx, by, solid) {
    const d = Math.hypot(bx - ax, by - ay);
    if (d < 0.0001) return true;
    const ang = Math.atan2(by - ay, bx - ax);
    return castRay(ax, ay, ang, d, solid) >= d - 0.02;
  }

  // Visibility polygon as a Path2D in *pixel* space.
  // Full circle when a0/a1 omitted; a wedge (fan from the origin) otherwise.
  function lightPath(px, py, radius, solid, tile, a0, a1, rays) {
    const cone = a0 !== undefined;
    const n = rays || (cone ? 90 : 160);
    const start = cone ? a0 : 0;
    const span = cone ? (a1 - a0) : Math.PI * 2;
    const path = new Path2D();
    if (cone) path.moveTo(px * tile, py * tile);
    for (let i = 0; i <= n; i++) {
      const ang = start + (span * i) / n;
      const d = castRay(px, py, ang, radius, solid) + 0.06; // bleed onto wall face
      const x = (px + Math.cos(ang) * d) * tile;
      const y = (py + Math.sin(ang) * d) * tile;
      if (i === 0 && !cone) path.moveTo(x, y);
      else path.lineTo(x, y);
    }
    path.closePath();
    return path;
  }

  HS.light = { castRay, lineOfSight, lightPath };
})();
