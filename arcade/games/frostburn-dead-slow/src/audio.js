(function (root) {
    'use strict';
    // Four beating reeds, including a semitone, rather than two decaying sine bells.
    // Exported separately so the real graph can be rendered in an OfflineAudioContext.
    function soundHorn(ctx, destination = ctx.destination) {
        // Keep the abrasive reed drive, but leave room for the running engine and cues.
        // Halving only the final envelope lowers the horn by approximately 6 dB.
        const now = ctx.currentTime, duration = 1.75, attackLevel = .0425, sustainLevel = .036;
        const envelope = ctx.createGain(), lowpass = ctx.createBiquadFilter();
        const highpass = ctx.createBiquadFilter(), drive = ctx.createWaveShaper();
        const mix = ctx.createGain(), sources = [], nodes = [envelope, lowpass, highpass, drive, mix];
        const curve = new Float32Array(2049);
        for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(2.8 * (2 * i / (curve.length - 1) - 1));
        drive.curve = curve;
        drive.oversample = '2x';
        highpass.type = 'highpass';
        highpass.frequency.value = 55;
        highpass.Q.value = .5;
        lowpass.type = 'lowpass';
        lowpass.frequency.setValueAtTime(650, now);
        lowpass.frequency.linearRampToValueAtTime(1450, now + .11);
        lowpass.frequency.linearRampToValueAtTime(1050, now + 1.25);
        lowpass.Q.value = .7;
        mix.gain.value = .32;
        envelope.gain.setValueAtTime(0, now);
        envelope.gain.linearRampToValueAtTime(attackLevel, now + .09);
        envelope.gain.linearRampToValueAtTime(sustainLevel, now + 1.18);
        envelope.gain.exponentialRampToValueAtTime(.0001, now + duration);
        mix.connect(drive); drive.connect(highpass); highpass.connect(lowpass);
        lowpass.connect(envelope); envelope.connect(destination);
        const real = new Float32Array(17);
        const imag = new Float32Array([0, 1, .82, .61, .48, .37, .27, .20, .17, .13, .11, .08, .06, .04, .03, .02, .01]);
        const wave = ctx.createPeriodicWave(real, imag);
        for (const [i, frequency] of [87.31, 110, 116.54, 146.83].entries()) {
            const reed = ctx.createOscillator();
            reed.setPeriodicWave(wave);
            reed.frequency.setValueAtTime(frequency * .965, now);
            reed.frequency.exponentialRampToValueAtTime(frequency, now + .12);
            reed.detune.value = (i - 1.5) * 2.5;
            reed.connect(mix);
            reed.start(now); reed.stop(now + duration + .04);
            sources.push(reed);
        }
        let ended = 0, stopped = false;
        for (const source of sources) source.onended = () => {
            source.disconnect();
            if (++ended === sources.length) for (const node of nodes) node.disconnect();
        };
        return {
            until: now + duration,
            stop() {
                if (stopped) return;
                stopped = true;
                const time = ctx.currentTime, age = Math.max(0, time - now);
                // AudioParam.value is not necessarily the value of its scheduled
                // ramp (notably before offline rendering). Hold the envelope's
                // actual level, then fade; muting before attack stays silent.
                const held = age < .09 ? attackLevel * age / .09
                    : age < 1.18 ? attackLevel + (sustainLevel - attackLevel) * (age - .09) / 1.09
                    : sustainLevel * Math.pow(.0001 / sustainLevel, Math.min(1, (age - 1.18) / (duration - 1.18)));
                envelope.gain.cancelScheduledValues(time);
                envelope.gain.setValueAtTime(held, time);
                envelope.gain.linearRampToValueAtTime(0, time + .012);
            }
        };
    }
    function create() {
        const flightAudio = typeof module !== 'undefined' && module.exports ? require('./space-audio.js') : root.HarborSpaceAudio;
        let ctx = null, engine = null, gain = null, master = null, enabled = true;
        let space = false, drive = null, horn = null, rampage = false, wheel = null, rail = false, train = null;
        const trainAudio = typeof module !== 'undefined' && module.exports ? require('./rail-audio.js') : root.RailAudio;
        const wheelAudio = typeof module !== 'undefined' && module.exports ? require('./rampage-audio.js') : root.GerboAudio;
        const cues = new Map(), tones = new Set();
        function stopTransient() {
            horn?.stop(); horn = null;
            for (const cue of cues.values()) cue.stop();
            cues.clear();
            for (const tone of tones) tone.stop();
            tones.clear();
        }
        function init() {
            try {
                if (!ctx) {
                    const AC = root.AudioContext || root.webkitAudioContext;
                    if (!AC) return;
                    ctx = new AC();
                    master = ctx.createGain(); master.gain.value = enabled ? 1 : 0;
                    master.connect(ctx.destination);
                    const re = new Float32Array(9), im = new Float32Array([0, 1, .4, .18, .075, .03, .018, .01, .008]);
                    engine = ctx.createOscillator();
                    engine.setPeriodicWave(ctx.createPeriodicWave(re, im));
                    const filter = ctx.createBiquadFilter();
                    filter.type = 'lowpass'; filter.frequency.value = 145; filter.Q.value = .45;
                    gain = ctx.createGain(); gain.gain.value = 0;
                    engine.connect(filter); filter.connect(gain); gain.connect(master); engine.start();
                }
                if (space && !drive) drive = flightAudio.createDrive(ctx, master);
                if (rampage && !wheel) wheel = wheelAudio.createWheel(ctx, master);
                if (rail && !train) train = trainAudio.createTrain(ctx, master);
                if (ctx.state === 'suspended') ctx.resume().catch(() => {});
            } catch (_) {
                // Audio failure never interrupts navigation. A later gesture may retry.
                if (ctx) ctx.close?.()?.catch?.(() => {});
                ctx = engine = gain = master = drive = wheel = train = null;
                cues.clear(); tones.clear(); horn = null;
            }
        }
        function tone(frequency = 440, duration = .2, volume = .035, delay = 0) {
            if (!ctx || !enabled) return;
            const start = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
            o.type = 'sine'; o.frequency.value = frequency;
            f.type = 'lowpass'; f.frequency.value = 700;
            g.gain.value = 0; g.gain.setValueAtTime(0, start);
            g.gain.linearRampToValueAtTime(volume, start + .018);
            g.gain.exponentialRampToValueAtTime(.0001, start + duration);
            o.connect(f); f.connect(g); g.connect(master);
            o.start(start); o.stop(start + duration + .03);
            let stopped = false;
            const voice = { stop() {
                if (stopped) return;
                stopped = true;
                const time = ctx.currentTime, age = time - start;
                const held = age <= 0 || age >= duration ? 0 : age < .018 ? volume * age / .018
                    : volume * Math.pow(.0001 / volume, (age - .018) / (duration - .018));
                g.gain.cancelScheduledValues(time); g.gain.setValueAtTime(held, time);
                g.gain.linearRampToValueAtTime(0, time + .012);
                try { o.stop(time + .02); } catch (_) { /* Already ended. */ }
            } };
            // Accelerated replays and rapid commands must not accumulate an
            // unbounded cue mix. Normal marine cues retain their sound and timing.
            if (tones.size >= 8) { const oldest = tones.values().next().value; oldest.stop(); tones.delete(oldest); }
            tones.add(voice);
            o.onended = () => { o.disconnect(); f.disconnect(); g.disconnect(); tones.delete(voice); };
        }
        function cue(kind) {
            if (!ctx || !enabled) return false;
            if (cues.get(kind)?.until > ctx.currentTime) return false;
            cues.set(kind, flightAudio.soundCue(ctx, kind, master));
            return true;
        }
        function radar() {
            if (!space || !enabled) return false;
            init(); return cue('radar');
        }
        return {
            init,
            // Called for every departure, even within the same world: no stale cues.
            setRail(value) {
                stopTransient(); train?.stop(); rail = !!value;
                if (gain) gain.gain.setTargetAtTime(0, ctx.currentTime, .02);
            },
            railEvent(kind) { if (enabled && rail) train?.event(kind); },
            setRampage(value) {
                stopTransient(); rampage = !!value; wheel?.stop();
                if (gain) gain.gain.setTargetAtTime(0, ctx.currentTime, .02);
            },
            setSpace(value) {
                stopTransient(); space = !!value;
                if (gain) gain.gain.setTargetAtTime(0, ctx.currentTime, .02);
                drive?.tick({}, false);
            },
            set enabled(v) {
                enabled = !!v;
                if (!enabled) { stopTransient(); drive?.tick({}, false); wheel?.stop(); train?.stop(); }
                if (master) master.gain.setTargetAtTime(enabled ? 1 : 0, ctx.currentTime, .008);
            },
            get enabled() { return enabled; },
            tick(s, active, flight = null, rolling = null, freight = null) {
                if (!ctx || !gain) return;
                const now = ctx.currentTime;
                if (rail && !active) { horn?.stop(); horn = null; }
                gain.gain.setTargetAtTime(active && enabled && !space && !rampage && !rail ? .011 + Math.abs(s.engine) * .024 : 0, now, .13);
                if (!space && !rail && s) engine.frequency.setTargetAtTime(35 + Math.abs(s.engine) * 27, now, .2);
                drive?.tick({ ...flight?.firingJets, beam: flight?.beamForce }, active && enabled && space);
                train?.tick(freight, active && enabled && rail);
                wheel?.tick(rolling ? { ...rolling, audioSpeed: Math.hypot(s.vx, s.vy) } : null, active && enabled && rampage);
            },
            order() { if (space) cue('order'); else tone(310, .15, .025); },
            checkpoint() {
                if (space) cue('checkpoint');
                else { tone(520, .22, .025); tone(650, .28, .022, .11); }
            },
            impact() { if (space) cue('impact'); else tone(73, .35, .06); },
            success() {
                if (space) cue('success');
                else { tone(330, .35, .025); tone(440, .4, .026, .14); tone(550, .65, .025, .28); }
            },
            radar,
            horn() {
                if (space) return radar();
                if (rampage) return false;
                if (!enabled) return false;
                init();
                if (!ctx || horn && ctx.currentTime < horn.until) return false;
                horn = rail ? trainAudio.soundWhistle(ctx, master) : soundHorn(ctx, master); return true;
            }
        };
    }
    const api = { create, soundHorn };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.HarborAudio = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
