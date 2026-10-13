/* Onboard flight sonification, not sound travelling through vacuum.
 * No simulation state, timers, assets or network. All voices use the audio clock.
 */
(function (root) {
    'use strict';
    const clamp = value => Number.isFinite(value) ? Math.min(1, Math.abs(value)) : 0;
    function createDrive(ctx, destination = ctx.destination) {
        const sources = [], nodes = [], targets = new Map();
        function smooth(param, value, tau = .045) {
            if (targets.get(param) === value) return;
            targets.set(param, value);
            param.setTargetAtTime(value, ctx.currentTime, tau);
        }
        function voice(frequency, harmonics) {
            const o = ctx.createOscillator(), gain = ctx.createGain();
            o.setPeriodicWave(ctx.createPeriodicWave(new Float32Array(harmonics.length), new Float32Array(harmonics)));
            o.frequency.value = frequency; gain.gain.value = 0;
            o.connect(gain); gain.connect(destination); o.start();
            sources.push(o); nodes.push(gain);
            return { oscillator: o, gain: gain.gain };
        }
        // Rounded, mildly inharmonic ion-drive resonances, distinct from the diesel.
        const core = voice(96, [0, 1, .16, .05]);
        const overtone = voice(153, [0, 1, .08]);
        const attitude = voice(470, [0, 1, .12]);
        const shimmer = ctx.createOscillator(), depth = ctx.createGain();
        shimmer.type = 'sine'; shimmer.frequency.value = 2.3; depth.gain.value = 3.5;
        shimmer.connect(depth); depth.connect(overtone.oscillator.detune); shimmer.start();
        sources.push(shimmer); nodes.push(depth);
        // Seeded noise: short, reusable source; filtering keeps jet hiss soft.
        const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate), ctx.sampleRate);
        const samples = buffer.getChannelData(0);
        let seed = 0x51a7;
        for (let i = 0; i < samples.length; i++) {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            samples[i] = seed / 2147483648 - 1;
        }
        const noise = ctx.createBufferSource(); noise.buffer = buffer; noise.loop = true;
        sources.push(noise);
        function hiss(frequency, q) {
            const filter = ctx.createBiquadFilter(), gain = ctx.createGain();
            filter.type = 'bandpass'; filter.frequency.value = frequency; filter.Q.value = q;
            gain.gain.value = 0; noise.connect(filter); filter.connect(gain); gain.connect(destination);
            nodes.push(filter, gain); return { filter, gain: gain.gain };
        }
        const exhaust = hiss(420, .7), jets = hiss(1450, .65);
        noise.start();
        return {
            tick(firing = {}, active = true) {
                const main = active ? clamp(firing.main) : 0;
                const rcs = active ? Math.min(1, clamp(firing.side) + clamp(firing.yaw) * .65) : 0;
                const beam = active ? clamp(firing.beam) : 0;
                smooth(core.gain, main * .014);
                smooth(overtone.gain, main * .008 + beam * .004);
                smooth(attitude.gain, rcs * .004 + beam * .005);
                smooth(exhaust.gain, main * .038);
                smooth(jets.gain, rcs * .023);
                smooth(core.oscillator.frequency, 96 + main * 38, .12);
                smooth(overtone.oscillator.frequency, 153 + main * 59 + beam * 35, .12);
                smooth(attitude.oscillator.frequency, 470 + rcs * 160 + beam * 75, .07);
                smooth(exhaust.filter.frequency, 420 + main * 490, .1);
            },
            dispose() {
                for (const source of sources) { try { source.stop(); } catch (_) { /* Already stopped. */ } source.disconnect(); }
                for (const node of nodes) node.disconnect();
            }
        };
    }
    // Frequency glides and gentle FM supply radar, UI and capture feedback.
    // Levels are intentionally low; summed drive + radar + cues retain headroom.
    const CUES = {
        radar: [[0, .68, 1280, 310, .024], [.10, .57, 640, 1050, .011], [.28, .62, 1280, 310, .006]],
        order: [[0, .13, 650, 930, .014], [.035, .12, 1100, 760, .007]],
        checkpoint: [[0, .24, 430, 660, .016], [.11, .28, 860, 1120, .010]],
        success: [[0, .60, 260, 330, .014], [.12, .62, 390, 495, .011], [.24, .70, 585, 740, .009]],
        impact: [[0, .22, 180, 68, .021], [0, .13, 1050, 160, .010]]
    };
    function soundCue(ctx, kind, destination = ctx.destination) {
        const pattern = CUES[kind];
        if (!pattern) throw new RangeError('Unknown flight cue: ' + kind);
        const now = ctx.currentTime, voices = [];
        let until = now, stopped = false;
        for (const [delay, duration, from, to, volume] of pattern) {
            const start = now + delay, end = start + duration, attack = .018;
            const o = ctx.createOscillator(), fm = ctx.createOscillator();
            const depth = ctx.createGain(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
            o.type = 'sine'; fm.type = 'sine';
            o.frequency.setValueAtTime(from, start); o.frequency.exponentialRampToValueAtTime(to, end);
            fm.frequency.value = kind === 'impact' ? 73 : 37;
            depth.gain.value = kind === 'impact' ? 45 : 12;
            fm.connect(depth); depth.connect(o.frequency);
            filter.type = 'lowpass'; filter.frequency.value = 1900; filter.Q.value = .5;
            gain.gain.value = 0; gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(volume, start + attack);
            gain.gain.exponentialRampToValueAtTime(.00001, end);
            gain.gain.linearRampToValueAtTime(0, end + .01);
            o.connect(filter); filter.connect(gain); gain.connect(destination);
            o.start(start); fm.start(start); o.stop(end + .02); fm.stop(end + .02);
            let ended = 0;
            const finish = () => { if (++ended === 2) for (const n of [o, fm, depth, filter, gain]) n.disconnect(); };
            o.onended = finish; fm.onended = finish;
            voices.push({ o, fm, gain, start, end, attack, volume });
            until = Math.max(until, end + .02);
        }
        return {
            until,
            stop() {
                if (stopped) return;
                stopped = true;
                const time = ctx.currentTime;
                for (const v of voices) {
                    const age = time - v.start;
                    const value = age <= 0 || time >= v.end ? 0 : age < v.attack ? v.volume * age / v.attack
                        : v.volume * Math.pow(.00001 / v.volume, (age - v.attack) / (v.end - v.start - v.attack));
                    v.gain.gain.cancelScheduledValues(time);
                    v.gain.gain.setValueAtTime(value, time);
                    v.gain.gain.linearRampToValueAtTime(0, time + .012);
                    for (const source of [v.o, v.fm]) { try { source.stop(time + .02); } catch (_) { /* Completed cue. */ } }
                }
            }
        };
    }
    const api = { createDrive, soundCue };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.HarborSpaceAudio = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
