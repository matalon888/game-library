// Bridges game state transitions to audio, particles, storage and wake lock.
// catch.js handles its own feedback for in-flight REELING catches because
// those don't go through transition().

import * as Game from './game.js';
import { State } from './game.js';
import * as Audio from './audio/audio.js';
import * as Storage from './storage.js';
import * as Mode from './modes/mode.js';
import * as Combo from './combo.js';
import { Haptic } from './haptic.js';
import { emitSplash, emitSparkle } from './render/particles.js';
import { rod } from './render/rod.js';
import { enableWakeLock, disableWakeLock } from './sensors/wakelock.js';

function onTransition(snapshot, prevState) {
  // IDLE → CASTING: user plugged in (or tapped in fallback mode).
  if (prevState === State.IDLE && snapshot.state === State.CASTING) {
    Audio.playCast();
    Haptic.cast();
    enableWakeLock();
  }

  // CASTING → FISHING: hook hits the water.
  if (prevState === State.CASTING && snapshot.state === State.FISHING) {
    Audio.playSplash();
    Haptic.splash();
    emitSplash(rod.hookX, rod.hookY);
  }

  // FISHING → HOOKED: a fish is on the hook.
  if (prevState === State.FISHING && snapshot.state === State.HOOKED) {
    Audio.playBite();
    Haptic.bite();
    emitSparkle(rod.hookX, rod.hookY, { count: 10, color: '#ffd680', speed: 100 });
  }

  // HOOKED → REELING (caught) or FISHING → REELING (empty).
  if (snapshot.state === State.REELING && prevState !== State.REELING) {
    if (snapshot.reelReason === 'caught' && snapshot.hookedFish) {
      const points = snapshot.hookedFish.type.points ?? 1;
      const rarity = snapshot.hookedFish.type.rarity;
      const bonus = Combo.registerCatch(points);
      if (bonus > 0) Game.addScore(bonus);
      Audio.playCatch(rarity);
      if (rarity === 'rare' || rarity === 'uncommon') Haptic.catchBig();
      else Haptic.catchSmall();
      emitSparkle(rod.hookX, rod.hookY, { count: 24, speed: 180 });
      Storage.recordCatch(points);
      Storage.updateHighscoreIfBeat(Game.getScore());
      Mode.onCatch(points + bonus);
    } else {
      Audio.playReel();
    }
  }

  // HOOKED → FISHING: fish escaped (timeout).
  if (prevState === State.HOOKED && snapshot.state === State.FISHING) {
    Audio.playEscape();
    Haptic.escape();
  }

  // REELING → IDLE: normal round end. Catch-all: any → IDLE releases the
  // wake lock so the menu / game over screen doesn't keep the screen on.
  if (snapshot.state === State.IDLE && prevState !== State.IDLE) {
    disableWakeLock();
    if (prevState === State.REELING) {
      Storage.updateHighscoreIfBeat(snapshot.score);
    }
  }
}

export function wireEvents() {
  Game.subscribe(onTransition);
}
