// Sky, water and wave animation. Sky/water tints follow the day/night
// system in weather.js.

import { SCENE } from '../config.js';
import { getSkyTop, getSkyBottom, getWaterTop } from './weather.js';

export const sky = {
  draw({ ctx, width, height }) {
    const waterY = height * SCENE.WATER_LINE_RATIO;
    const grad = ctx.createLinearGradient(0, 0, 0, waterY);
    grad.addColorStop(0, getSkyTop());
    grad.addColorStop(1, getSkyBottom());
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, waterY);
  },
};

export const water = {
  draw({ ctx, width, height, time }) {
    const waterY = height * SCENE.WATER_LINE_RATIO;

    const grad = ctx.createLinearGradient(0, waterY, 0, height);
    grad.addColorStop(0, getWaterTop());
    grad.addColorStop(0.5, '#0d4870');
    grad.addColorStop(1, '#04243d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, waterY, width, height - waterY);

    ctx.beginPath();
    const step = 6;
    for (let x = 0; x <= width; x += step) {
      const y =
        waterY +
        Math.sin(x * 0.02 + time * SCENE.WAVE_SPEED) * SCENE.WAVE_AMPLITUDE_PX +
        Math.sin(x * 0.045 + time * SCENE.WAVE_SPEED * 1.7) * SCENE.WAVE_AMPLITUDE_PX * 0.35;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(232, 244, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    for (let x = 0; x <= width; x += step) {
      const y =
        waterY +
        Math.sin(x * 0.02 + time * SCENE.WAVE_SPEED) * SCENE.WAVE_AMPLITUDE_PX +
        Math.sin(x * 0.045 + time * SCENE.WAVE_SPEED * 1.7) * SCENE.WAVE_AMPLITUDE_PX * 0.35 +
        4;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
  },
};
