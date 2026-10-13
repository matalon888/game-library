/**
 * Pick a chroma-key background color that's safely distant from the colors
 * already present in the player's reference images.
 *
 * Why: a fixed magenta key fails when the character itself is magenta. We
 * sample the images, score a small palette of candidate keys against them,
 * and return whichever candidate overlaps least.
 */

const CANDIDATES = [
  { hex: '#FF00FF', name: 'pure magenta',         r: 255, g: 0,   b: 255 },
  { hex: '#00FF00', name: 'pure neon green',      r: 0,   g: 255, b: 0   },
  { hex: '#00FFFF', name: 'pure cyan',            r: 0,   g: 255, b: 255 },
  { hex: '#FF7F00', name: 'pure neon orange',     r: 255, g: 127, b: 0   },
  { hex: '#7F00FF', name: 'pure electric purple', r: 127, g: 0,   b: 255 },
  { hex: '#FFFF00', name: 'pure yellow',          r: 255, g: 255, b: 0   },
];

const SAMPLE_SIZE = 96;                  // downsample images for speed
const NEAR_THRESHOLD = 100 * 100;        // pixels this close (RGB dist²) "conflict" with the key

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = src;
  });
}

async function sampleImage(dataUrl) {
  const img = await loadImage(dataUrl);
  const c = document.createElement('canvas');
  c.width = SAMPLE_SIZE;
  c.height = SAMPLE_SIZE;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  return ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
}

/** Score each candidate and return the one with the fewest conflicting pixels. */
export async function pickKeyColor(dataUrls) {
  const samples = await Promise.all(dataUrls.map(sampleImage));
  let best = CANDIDATES[0];
  let bestScore = Infinity;

  for (const cand of CANDIDATES) {
    let conflicts = 0, totalDist = 0, pixels = 0;
    for (const { data } of samples) {
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 64) continue; // skip near-transparent
        const dr = data[i] - cand.r, dg = data[i + 1] - cand.g, db = data[i + 2] - cand.b;
        const d2 = dr * dr + dg * dg + db * db;
        if (d2 < NEAR_THRESHOLD) conflicts++;
        totalDist += Math.sqrt(d2);
        pixels++;
      }
    }
    // Fewer conflicts wins; ties go to the key that's further away on average
    const score = conflicts * 1e6 - (pixels ? totalDist / pixels : 0);
    if (score < bestScore) { bestScore = score; best = cand; }
  }
  return best;
}

/** Guess the background key of an existing sheet from its corner pixels. */
export async function detectKeyColor(dataUrl) {
  const img = await loadImage(dataUrl);
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const pts = [[1, 1], [c.width - 2, 1], [1, c.height - 2], [c.width - 2, c.height - 2]];
  let r = 0, g = 0, b = 0;
  for (const [x, y] of pts) {
    const d = ctx.getImageData(x, y, 1, 1).data;
    r += d[0]; g += d[1]; b += d[2];
  }
  return { r: Math.round(r / 4), g: Math.round(g / 4), b: Math.round(b / 4) };
}
