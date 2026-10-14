// Weather + day/night system.
// - Day/night cycle: based on local clock (changes the sky gradient & adds stars at night).
// - Rain: random episodes; rain drops fall from above, splash on water.

const STAR_COUNT = 60;
const stars = [];

// Lazy initialisation — depends on canvas size, so set on first draw.
let initialized = false;

function initStars(width, height) {
  stars.length = 0;
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: Math.random(),
      y: Math.random() * 0.34, // sky region only
      r: 0.5 + Math.random() * 1.2,
      twinklePhase: Math.random() * Math.PI * 2,
    });
  }
  initialized = true;
}

// Rain
const drops = [];
const DROP_CAP = 90;
let rainState = 'clear'; // 'clear' | 'building' | 'falling' | 'fading'
let rainLevel = 0;       // 0..1
let nextEpisodeAt = performance.now() + randomMs(45000, 120000);

function randomMs(lo, hi) { return lo + Math.random() * (hi - lo); }

// 0 = midnight, 12 = noon. Used by the gradient picker.
function hourFraction() {
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
}

// Returns 0..1 — how "night" it is (1 = full night, 0 = full day).
function nightness() {
  const h = hourFraction();
  // Full day 8-18, full night 22-5; smooth ramps in between.
  if (h >= 8 && h <= 18) return 0;
  if (h >= 22 || h <= 5) return 1;
  if (h > 18 && h < 22) return (h - 18) / 4;
  return 1 - (h - 5) / 3;
}

function lerp(a, b, t) { return a + (b - a) * t; }
function lerpColor(c1, c2, t) {
  return c1.map((v, i) => Math.round(lerp(v, c2[i], t)));
}
function rgb([r, g, b]) { return `rgb(${r}, ${g}, ${b})`; }

const DAY_SKY_TOP = [42, 90, 130];
const DAY_SKY_BOT = [126, 180, 212];
const NIGHT_SKY_TOP = [6, 14, 38];
const NIGHT_SKY_BOT = [22, 40, 78];

const DAY_WATER_TOP = [26, 109, 160];
const NIGHT_WATER_TOP = [10, 36, 70];

export function getSkyTop(_h) {
  const n = nightness();
  return rgb(lerpColor(DAY_SKY_TOP, NIGHT_SKY_TOP, n));
}
export function getSkyBottom(_h) {
  const n = nightness();
  return rgb(lerpColor(DAY_SKY_BOT, NIGHT_SKY_BOT, n));
}
export function getWaterTop(_h) {
  const n = nightness();
  return rgb(lerpColor(DAY_WATER_TOP, NIGHT_WATER_TOP, n));
}

function updateRain(dtMs, width, height) {
  const now = performance.now();
  if (rainState === 'clear' && now >= nextEpisodeAt) {
    rainState = 'building';
  }
  if (rainState === 'building') {
    rainLevel = Math.min(1, rainLevel + dtMs / 4000);
    if (rainLevel >= 1) {
      rainState = 'falling';
      nextEpisodeAt = now + randomMs(15000, 40000);
    }
  } else if (rainState === 'falling') {
    if (now >= nextEpisodeAt) rainState = 'fading';
  } else if (rainState === 'fading') {
    rainLevel = Math.max(0, rainLevel - dtMs / 5000);
    if (rainLevel <= 0) {
      rainState = 'clear';
      nextEpisodeAt = now + randomMs(60000, 180000);
    }
  }

  // Spawn drops in proportion to rainLevel
  const target = Math.floor(DROP_CAP * rainLevel);
  while (drops.length < target) {
    drops.push({
      x: Math.random() * width,
      y: -10 - Math.random() * height * 0.5,
      vy: 700 + Math.random() * 400,
      len: 10 + Math.random() * 12,
    });
  }
  const dt = dtMs / 1000;
  const waterY = height * 0.35;
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.y += d.vy * dt;
    if (d.y > waterY) {
      drops.splice(i, 1);
    }
  }
  if (drops.length > target) drops.splice(0, drops.length - target);
}

export const weather = {
  update({ dtMs, width, height }) {
    if (!initialized) initStars(width, height);
    updateRain(dtMs, width, height);
  },

  // Star layer is drawn BEHIND fish but in front of base sky; we expose it
  // as a separate drawable below.
  draw() {
    /* nothing — sky/water draw the colour, this draws stars + rain */
  },
};

export const starsLayer = {
  draw({ ctx, width, height, time }) {
    const n = nightness();
    if (n < 0.1) return;
    const alpha = n * 0.9;
    for (const s of stars) {
      const twinkle = 0.6 + 0.4 * Math.sin(time * 0.003 + s.twinklePhase);
      ctx.globalAlpha = alpha * twinkle;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x * width, s.y * height, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },
};

export const rainLayer = {
  draw({ ctx }) {
    if (drops.length === 0) return;
    ctx.strokeStyle = 'rgba(180, 220, 240, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const d of drops) {
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - 2, d.y + d.len);
    }
    ctx.stroke();
  },
};
