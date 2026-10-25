// Art wave 2: the game's painted background (assets/bg-art.webp) as the three.js scene background, cover-fit to the
// screen (never stretched) and washed with the game's own sky (a canvas, or a colour) so its colours and mood stay.
// onDraw: called after each draw (e.g. to hide a sky dome the painting replaces). Returns redraw(): call it again when the game repaints its sky; it also redraws on resize.
export function artSky(THREE, scene, tint, alpha = 0.45, onDraw = null) {
  const img = new Image(), c = document.createElement('canvas'), t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  function redraw() {
    if (!img.naturalWidth) return;
    const W = 360, H = Math.round(W * innerHeight / Math.max(1, innerWidth));
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; t.dispose(); }
    const x = c.getContext('2d'), k = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    x.drawImage(img, (W - img.naturalWidth * k) / 2, (H - img.naturalHeight * k) / 2, img.naturalWidth * k, img.naturalHeight * k);
    if (tint) { x.globalAlpha = alpha; if (typeof tint === 'string') { x.fillStyle = tint; x.fillRect(0, 0, W, H); } else x.drawImage(tint, 0, 0, W, H); x.globalAlpha = 1; }
    t.needsUpdate = true; scene.background = t; if (onDraw) onDraw();
  }
  img.onload = redraw; img.src = 'assets/bg-art.webp'; addEventListener('resize', redraw);
  return redraw;
}
