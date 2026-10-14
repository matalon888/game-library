// Lightweight toast queue. Used by achievements + quests for transient
// "unlocked!" / "completed!" feedback. Drawn directly on the canvas so it
// integrates with the existing render loop.

import * as Achievements from '../achievements.js';
import { t } from '../i18n.js';

const TOAST_MS = 3200;
const FADE_MS = 400;
const queue = [];

function enqueue(toast) {
  queue.push({ ...toast, createdAt: performance.now() });
}

Achievements.onUnlock((def) => {
  enqueue({ kind: 'achievement', title: t(def.titleKey), body: t(def.descKey) });
});

// Public helper for other modules (quests) to push their own toasts.
export function pushToast({ title, body, kind = 'info' }) {
  enqueue({ kind, title, body });
}

export const toastOverlay = {
  draw({ ctx, width, height, time }) {
    if (queue.length === 0) return;

    // Drop expired
    while (queue.length && time - queue[0].createdAt > TOAST_MS) queue.shift();
    if (queue.length === 0) return;

    const t0 = queue[0];
    const age = time - t0.createdAt;
    let alpha = 1;
    if (age < FADE_MS) alpha = age / FADE_MS;
    else if (age > TOAST_MS - FADE_MS) alpha = (TOAST_MS - age) / FADE_MS;
    alpha = Math.max(0, Math.min(1, alpha));

    const w = Math.min(280, width - 32);
    const h = 64;
    const x = (width - w) / 2;
    const y = height * 0.18;

    ctx.globalAlpha = alpha;

    // Panel
    ctx.fillStyle = 'rgba(10, 58, 90, 0.92)';
    roundedRect(ctx, x, y, w, h, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(244, 184, 96, 0.6)';
    ctx.lineWidth = 1;
    roundedRect(ctx, x, y, w, h, 12);
    ctx.stroke();

    // Icon
    ctx.font = '700 22px -apple-system, sans-serif';
    ctx.fillStyle = '#f4b860';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏆', x + 14, y + h / 2);

    // Title + body
    ctx.fillStyle = '#f4b860';
    ctx.font = '700 13px -apple-system, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(t0.title, x + 46, y + 12);
    ctx.fillStyle = 'rgba(232, 244, 255, 0.85)';
    ctx.font = '500 11px -apple-system, sans-serif';
    ctx.fillText(t0.body, x + 46, y + 32);

    ctx.globalAlpha = 1;
  },
};

function roundedRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
