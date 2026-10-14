export const MUSIC_STEP_SECONDS = 0.48;
export const MUSIC_LOOP_STEPS = 32;

const CHORDS = Object.freeze([
  Object.freeze([146.83, 174.61, 220]),
  Object.freeze([116.54, 146.83, 174.61]),
  Object.freeze([174.61, 220, 261.63]),
  Object.freeze([130.81, 164.81, 196]),
]);

const BELLS = Object.freeze([
  587.33, null, null, 523.25, null, 440, null, null,
  523.25, null, 440, null, 392, null, null, 440,
  523.25, null, null, 659.25, null, 587.33, null, null,
  440, null, 392, null, 349.23, null, null, 392,
]);

export function musicEventAt(step) {
  const index = ((Math.trunc(step) % MUSIC_LOOP_STEPS) + MUSIC_LOOP_STEPS) % MUSIC_LOOP_STEPS;
  return {
    chord: index % 8 === 0 ? CHORDS[index / 8] : null,
    bell: BELLS[index],
  };
}

export function createAmbientMusic(context, destination) {
  const bus = context.createGain();
  const filter = context.createBiquadFilter();
  bus.gain.value = 0.0001;
  filter.type = "lowpass";
  filter.frequency.value = 1800;
  filter.Q.value = 0.35;
  filter.connect(bus).connect(destination);

  let active = false;
  let timer = null;
  let nextStepAt = 0;
  let step = 0;

  function scheduleVoice(frequency, startAt, duration, volume, type = "sine") {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startAt);
    oscillator.detune.setValueAtTime(type === "sine" ? -4 : 3, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume, startAt + Math.min(0.35, duration * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    oscillator.connect(gain).connect(filter);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.03);
  }

  function scheduleStep(event, startAt) {
    if (event.chord) {
      event.chord.forEach((frequency, index) => {
        scheduleVoice(frequency, startAt, MUSIC_STEP_SECONDS * 7.6, 0.022 - index * 0.003, "sine");
      });
    }
    if (event.bell) scheduleVoice(event.bell, startAt + 0.02, 1.05, 0.018, "triangle");
  }

  function fillQueue() {
    if (!active) return;
    const horizon = context.currentTime + 0.8;
    while (nextStepAt < horizon) {
      scheduleStep(musicEventAt(step), nextStepAt);
      step = (step + 1) % MUSIC_LOOP_STEPS;
      nextStepAt += MUSIC_STEP_SECONDS;
    }
  }

  function setActive(shouldPlay) {
    if (active === shouldPlay) return;
    active = shouldPlay;
    const now = context.currentTime;
    bus.gain.cancelScheduledValues(now);
    bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), now);
    bus.gain.exponentialRampToValueAtTime(active ? 0.42 : 0.0001, now + (active ? 0.7 : 0.25));

    if (active) {
      nextStepAt = now + 0.05;
      fillQueue();
      timer = window.setInterval(fillQueue, 220);
    } else if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  }

  function dispose() {
    setActive(false);
    filter.disconnect();
    bus.disconnect();
  }

  return {
    dispose,
    get active() { return active; },
    setActive,
  };
}
