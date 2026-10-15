// MusicManager: trilha chiptune procedural via Tone.js. Dono: composer.
// Robusto: qualquer erro de áudio é engolido para nunca derrubar o jogo.
import * as Tone from 'tone';

class MusicManager {
  constructor() {
    this.started = false;
    this.lead = null;
    this.bass = null;
    this.out = null;
    this.parts = [];
    this.muted = false;
    this.current = null;
  }

  async init() {
    if (this.started) return;
    try {
      await Tone.start();
      this.out = new Tone.Volume(-10).toDestination();
      this.lead = new Tone.Synth({
        oscillator: { type: 'square' },
        envelope: { attack: 0.005, decay: 0.1, sustain: 0.15, release: 0.08 },
      }).connect(this.out);
      this.bass = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.1 },
      }).connect(this.out);
      this.started = true;
    } catch (e) {
      // áudio bloqueado pelo navegador: segue sem música
      this.started = false;
    }
  }

  _clear() {
    this.parts.forEach((p) => { try { p.dispose(); } catch (_) {} });
    this.parts = [];
    try { Tone.Transport.stop(); Tone.Transport.cancel(); } catch (_) {}
  }

  _play(leadNotes, bassNotes, bpm) {
    if (!this.started) return;
    this._clear();
    try {
      Tone.Transport.bpm.value = bpm;
      const lead = new Tone.Sequence((time, note) => {
        if (note) this.lead.triggerAttackRelease(note, '8n', time);
      }, leadNotes, '8n');
      const bass = new Tone.Sequence((time, note) => {
        if (note) this.bass.triggerAttackRelease(note, '4n', time);
      }, bassNotes, '4n');
      lead.start(0); bass.start(0);
      this.parts.push(lead, bass);
      Tone.Transport.start();
    } catch (_) { /* noop */ }
  }

  playStage() {
    this.current = 'stage';
    // Lá menor, animado de fliperama
    const lead = ['A4', 'C5', 'E5', 'C5', 'D5', 'F5', 'E5', 'C5',
                  'G4', 'B4', 'D5', 'B4', 'A4', 'E5', 'A5', 'E5'];
    const bass = ['A2', 'A2', 'F2', 'G2'];
    this._play(lead, bass, 150);
  }

  playBoss() {
    this.current = 'boss';
    // mais tenso, mais grave e rápido
    const lead = ['A4', 'A4', 'Bb4', 'A4', 'G4', 'A4', 'E4', 'A4',
                  'F4', 'F4', 'G4', 'F4', 'E4', 'F4', 'C4', 'E4'];
    const bass = ['A1', 'A1', 'Bb1', 'E2'];
    this._play(lead, bass, 172);
  }

  stop() {
    this.current = null;
    this._clear();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.out) this.out.volume.value = this.muted ? -Infinity : -10;
    return this.muted;
  }
}

export const music = new MusicManager();
export default music;
