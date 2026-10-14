// Hook-vs-fish collision system.
//   FISHING + collision   → transition(HOOKED).
//   REELING + collision   → mid-reel catch (no state change), score added directly.
//   HOOKED/REELING        → the hooked fish follows the hook (reads rod.hookX/Y
//                           directly so the depth filter in getHookPosition()
//                           doesn't strand the fish during late REELING frames).

import * as Game from './game.js';
import { State } from './game.js';
import { FISH, SCENE } from './config.js';
import { fishSpawner } from './entities/fishSpawner.js';
import { rod } from './render/rod.js';
import * as Audio from './audio/audio.js';
import * as Storage from './storage.js';
import * as Mode from './modes/mode.js';
import * as Combo from './combo.js';
import * as Upgrades from './upgrades.js';
import { Haptic } from './haptic.js';
import { emitSparkle } from './render/particles.js';

let attachedFish = null;

function pointInBox(px, py, box, padding) {
  return (
    px >= box.x - padding &&
    px <= box.x + box.w + padding &&
    py >= box.y - padding &&
    py <= box.y + box.h + padding
  );
}

function tryHook(frame) {
  const waterY = frame.height * SCENE.WATER_LINE_RATIO;
  if (rod.hookY < waterY) return;

  const px = rod.hookX;
  const py = rod.hookY;
  const padding = FISH.HOOK_HITBOX_PADDING + Upgrades.getEffect('hitbox');
  const magnetRadius = Upgrades.getEffect('magnet');

  // Magnet: nudge nearby (within radius) free fish toward the hook so they
  // get caught more easily. Effect is subtle — adds a small velocity bias.
  if (magnetRadius > 0) {
    for (const fish of fishSpawner.getFish()) {
      if (fish.attached) continue;
      const dx = px - fish.x;
      const dy = py - fish.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0 && dist < magnetRadius) {
        const strength = (1 - dist / magnetRadius) * 0.35;
        fish.x += dx * strength;
        fish.y += dy * strength;
      }
    }
  }

  for (const fish of fishSpawner.getFish()) {
    if (fish.attached) continue;
    if (pointInBox(px, py, fish.getBoundingBox(), padding)) {
      fish.attached = true;
      attachedFish = fish;
      fish.direction = px < fish.x ? -1 : 1;

      const currentState = Game.getState();
      if (currentState === State.FISHING) {
        Game.transition(State.HOOKED, { fish });
      } else if (currentState === State.REELING) {
        // Mid-reel catch: HOOKED is skipped, so we must trigger feedback
        // ourselves (events.js wires those to state transitions only).
        const points = fish.type.points ?? 1;
        Game.addScore(points);
        const bonus = Combo.registerCatch(points);
        if (bonus > 0) Game.addScore(bonus);
        Audio.playCatch(fish.type.rarity);
        if (fish.type.rarity === 'rare' || fish.type.rarity === 'uncommon') Haptic.catchBig();
        else Haptic.catchSmall();
        emitSparkle(rod.hookX, rod.hookY, { count: 20, speed: 160 });
        Storage.recordCatch(points);
        Storage.updateHighscoreIfBeat(Game.getScore());
        Mode.onCatch(points + bonus);
      }
      return;
    }
  }
}

function followHook() {
  if (!attachedFish) return;
  const offset = attachedFish.type.sizePx * 0.45;
  attachedFish.x = rod.hookX;
  attachedFish.y = rod.hookY + offset;
}

// Cleanup: when leaving HOOKED+REELING, drop the attached fish.
Game.subscribe((snapshot, prevState) => {
  const wasHookedOrReeling = prevState === State.HOOKED || prevState === State.REELING;
  const isHookedOrReeling = snapshot.state === State.HOOKED || snapshot.state === State.REELING;

  if (wasHookedOrReeling && !isHookedOrReeling && attachedFish) {
    fishSpawner.removeFish(attachedFish);
    attachedFish.attached = false;
    attachedFish = null;
  }
});

export const catchSystem = {
  update(frame) {
    const { game } = frame;
    if (game.state === State.FISHING) {
      tryHook(frame);
    } else if (game.state === State.HOOKED) {
      followHook();
    } else if (game.state === State.REELING) {
      if (attachedFish) {
        followHook();
      } else {
        tryHook(frame);
        if (attachedFish) followHook();
      }
    }
  },
  draw() {},
};
