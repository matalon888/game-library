/* The secret chart room. No devtools detection, polling, network calls or eval. */
(function (root) {
    'use strict';
    const V = typeof module !== 'undefined' && module.exports ? require('./verification.js') : root.HarborVerification;
    const C = typeof module !== 'undefined' && module.exports ? require('./compatibility.js') : root.CourseCompatibility;
    const Commands = typeof module !== 'undefined' && module.exports ? require('./rail-commands.js') : root.RailCommands;
    function create(bridge, logger = root.console) {
        const copy = value => JSON.parse(JSON.stringify(value));
        let unlocked = false, rate = 1, playback = null, launching = false, lastReport = null;
        const log = (method, ...args) => { if (!bridge.quiet) logger?.[method]?.(...args); };
        function finite(value, min, max, name) {
            if (!Number.isFinite(value) || value < min || value > max)
                throw new RangeError(`${name} must be a finite number from ${min} to ${max}.`);
            return value;
        }
        function catalog(rows) {
            // Keep the old numeric field readable by console scripts, but use a
            // domain-neutral heading in the visible table and JSON exports.
            for (const row of rows) Object.defineProperty(row, 'harbor', { value: row.stage, enumerable: false });
            log('table', rows); return rows;
        }
        function live() {
            if (bridge.state().status !== 'running') throw new Error('Start or resume a trial first; DeadSlow.level(3, 4) starts one.');
        }
        function practice(reason) { bridge.practice('Console practice: ' + reason); }
        function findLevel(worldOrId, stage) {
            const i = typeof worldOrId === 'string' ? bridge.levels.findIndex(l => l.id === worldOrId) :
                bridge.levels.findIndex(l => l.worldNumber === worldOrId && l.stageNumber === stage);
            if (i < 0) {
                const upcoming = (bridge.levels.catalog || []).find(l => l.comingSoon &&
                    (typeof worldOrId === 'string' ? l.id === worldOrId : l.worldNumber === worldOrId && l.stageNumber === stage));
                throw new RangeError(upcoming ? 'Coming soon: this assignment is not playable yet.' :
                    'Unknown assignment. Worlds 1–6 are complete; World 6 stage 13 is the separate bonus. DeadSlow.levels() lists the atlas.');
            }
            return i;
        }
        function fixture(id) {
            const f = V.runs.find(f => f.level === id);
            if (!f) throw new RangeError('No verified recording for this assignment. DeadSlow.runs() lists the available recordings.');
            return f;
        }
        function load(i) {
            launching = true;
            try { bridge.load(i); } finally { launching = false; }
            practice('assignment selected');
            bridge.hud();
        }
        function circuit(worldOrId = 'grand-tour', speed = 8) {
            finite(speed, 0, 32, 'Speed');
            const id = typeof worldOrId === 'number'
                ? bridge.levels.find(l => l.worldNumber === worldOrId)?.campaign : worldOrId;
            if (id !== 'grand-tour' && !bridge.levels.some(l => l.campaign === id && !l.bonus && !l.standalone))
                throw new RangeError('Circuit unavailable. Worlds 1–6 have complete circuits; World 7 has three individual assignments and World 8 is planned.');
            unlocked = true; rate = speed; playback = null; lastReport = null;
            launching = true;
            try { bridge.circuit(id); } finally { launching = false; }
            practice('circuit playtest'); bridge.resetClock(); bridge.hud();
            return menu.progress();
        }
        function controls(values) {
            if (!values || typeof values !== 'object' || Array.isArray(values)) throw new TypeError('Supply a controls object.');
            if (bridge.state().run.rail) throw new Error('Use DeadSlow.rail(name, value) for railway commands.');
            // Validate the entire command before applying any part of it.
            for (const [key, v] of Object.entries(values)) {
                if (!['throttle', 'rudder', 'thruster', 'winch'].includes(key)) throw new TypeError('Unknown control: ' + key);
                finite(v, key === 'throttle' ? -3 : -1, key === 'throttle' ? 4 : 1, key);
                if (key === 'throttle' && !Number.isInteger(v)) throw new RangeError('Throttle must be a whole notch.');
            }
            live(); practice('control override');
            if (values.throttle !== undefined) bridge.throttle(values.throttle - bridge.state().run.ship.throttle);
            bridge.input(values);
        }
        function watch(id, speed = 8) {
            const f = fixture(id), i = findLevel(id);
            finite(speed, 0, 32, 'Speed');
            if(f.compatibility!==C.stamp(bridge.levels[i]))throw new Error('This recording belongs to an earlier course or rules revision.');
            unlocked = true; rate = speed;
            load(i);
            playback = { fixture: f, tick: 0, event: 0, controls: { rudder: 0, thruster: 0, winch: 0 } };
            lastReport = null;
            practice('verification replay');
            bridge.resetClock();
            log('info', `Watching ${bridge.levels[i].name} at ${rate}×. Fixed controls, 120 Hz physics, unranked. Expected ${f.expectedTime.toFixed(3)} s.`);
            return { level: id, expectedTime: f.expectedTime, speed: rate };
        }
        function beforeStep() {
            if (rate !== 1) practice(rate === 0 ? 'manual stepping' : `${rate}× time`);
            if (!playback) return;
            const p = playback;
            while (p.event < p.fixture.events.length && p.fixture.events[p.event].time <= p.tick * V.step + 1e-7) {
                const e = p.fixture.events[p.event++];
                if (e.rail) bridge.rail(...e.rail);
                if (e.line) bridge.line();
                if (e.throttle !== undefined) bridge.throttle(e.throttle - bridge.state().run.ship.throttle);
                for (const key of ['rudder', 'thruster', 'winch']) if (e[key] !== undefined) p.controls[key] = e[key];
            }
            bridge.input(p.controls);
            p.tick++;
        }
        function afterStep() {
            if (!playback) return;
            const s = bridge.state(), p = playback;
            if (s.status === 'running' && p.tick < Math.ceil(p.fixture.duration / V.step)) return;
            const clean = s.run.result?.clean === true, error = s.run.time - p.fixture.expectedTime;
            lastReport = {
                level: p.fixture.level, status: s.status, clean, time: s.run.time,
                expectedTime: p.fixture.expectedTime, difference: error,
                verified: s.status === 'complete' && clean && Math.abs(error) <= V.step + 1e-6,
                contacts: s.run.contacts, lineBreaks: s.run.jobs?.stats.lineBreaks || 0, space: s.run.space ? copy(s.run.space.stats) : null, rampage: s.run.rampage ? copy(s.run.rampage.stats) : null, rail: s.run.rail ? copy(s.run.rail.stats) : null,
                steps: p.tick, eventsApplied: p.event, ranked: false,
                method: 'Fixed control inputs through the live game; no repositioning or objective shortcuts.'
            };
            playback = null;
            bridge.clearInput();
            if (s.status === 'running') rate = 0; // Stop a divergent recording at its declared end.
            log(lastReport.verified ? 'info' : 'warn', lastReport.verified ? (s.run.rampage ? 'Course complete! Rolling recording verified.' : s.run.space ? 'Capture confirmed! Flight recording verified.' : 'All fast! Control recording verified.') : 'Recording diverged; this is not a verified completion.');
            log('table', [copy(lastReport)]);
            return false; // Stop the caller's batch exactly here, including a divergent recording.
        }
        const menu = Object.freeze({
            help() {
                const commands = [
                    ['DeadSlow.tour(8)', 'Start a manual 84-stage Grand Tour at 8×, unranked from departure.'],
                    ['DeadSlow.circuit(3, 8)', 'Start a twelve-stage world playtest; keep speed across retry/next.'],
                    ['DeadSlow.convoy("morrow", "proceed")', 'Order a World 7 supply captain to proceed or hold; practice only.'],
                    ['DeadSlow.progress()', 'Compact current mission, circuit clock and completed sector splits.'],
                    ['DeadSlow.levels()', 'List all assignments; world and stage numbers start at 1.'],
                    ['DeadSlow.level(3, 4)', 'Start The Floating Sauna as unranked practice (or supply an id).'],
                    ['DeadSlow.speed(8)', '0–32× wall-time rate. Physics always uses 1/120 second steps. 0 freezes.'],
                    ['DeadSlow.step(30)', 'Advance up to 600 simulated seconds, including replay controls.'],
                    ['DeadSlow.controls({throttle: 4})', 'Persistent controls: throttle −3…4; rudder/thruster/winch −1…1. World 4: rudder = east, thruster = south; winch > 0 holds fire breath.'],
                    ['DeadSlow.line()', 'Make fast / cast off at sea; lock / release the rescue beam in space; activate Gerbozilla’s shield.'],
                    ['DeadSlow.rail("power", 2)', 'Issue the same railway command as the keyboard or buttons; unranked.'],
                    ['DeadSlow.warp(150, 200, 0)', 'Reposition the player only, stop motion; heading in degrees.'],
                    ['DeadSlow.repair()', 'Restore the hulls; does not erase contacts or failure.'],
                    ['DeadSlow.state()', 'A detached snapshot; inspecting it never taints a normal run.'],
                    ['DeadSlow.runs()', 'List the available control recordings and their author times.'],
                    ['DeadSlow.times()', 'All assignments: verified times or null, separately from medal targets.'],
                    ['DeadSlow.timeline("bigger-boat")', 'Inspect the fixed-time input events.'],
                    ['DeadSlow.watch("bigger-boat", 8)', 'Watch the actual verification run with the normal renderer.'],
                    ['DeadSlow.verify("all")', 'Execute all published recordings now; return measured verification reports.'],
                    ['DeadSlow.report()', 'Inspect the last replay result.'],
                    ['DeadSlow.normal()', 'Restore 1× time and start a fresh, ranked individual attempt.']
                ];
                log('table', commands.map(([command, purpose]) => ({ command, purpose })));
                log('info', 'Cheats are welcome aboard. Assisted runs never replace your records. Inspection alone is harmless.');
                return commands;
            },
            tour(speed = 8) { return circuit('grand-tour', speed); },
            circuit,
            progress() {
                const s = bridge.state(), m = bridge.progress?.() || null;
                return copy({ level: s.level.id, world: s.level.worldNumber, stage: s.level.stageNumber,
                    status: s.status, timeScale: rate, practice: s.run.pausedUsed, time: s.run.time, circuit: m });
            },
            levels() {
                const rows = (bridge.levels.catalog || bridge.levels).map(l => ({ comingSoon: !!l.comingSoon, world: l.worldNumber, stage: l.stageNumber, id: l.id, name: l.name, bonus: !!l.bonus }));
                return catalog(rows);
            },
            level(worldOrId, stage) { load(findLevel(worldOrId, stage)); return menu.state(); },
            speed(value) {
                if (value === undefined) return rate;
                finite(value, 0, 32, 'Speed');
                unlocked = true; rate = value; practice(value === 0 ? 'time frozen' : `${value}× time`);
                bridge.resetClock(); bridge.hud();
                return rate;
            },
            step(seconds = V.step) {
                finite(seconds, 0, 600, 'Seconds'); live(); practice('manual stepping');
                bridge.advance(seconds); bridge.resetClock();
                return menu.state();
            },
            controls,
            rail(name, value) {
                if(!Commands.valid(name,value))throw new TypeError('Invalid railway command.');
                live();
                if(!bridge.state().run.rail)throw new Error('Select a railway assignment first.');
                practice('railway command');return bridge.rail(name,value);
            },
            line() { live(); practice('line override'); bridge.line(); },
            convoy(id,order) {
                live();
                if(!bridge.state().run.polar||!bridge.state().run.polar.fleet.some(f=>f.id===id&&!f.leader)||!['hold','proceed'].includes(order))throw new RangeError('Choose a supply vessel ID and hold or proceed.');
                practice('convoy order');return bridge.convoy(id,order);
            },
            warp(x, y, degrees = 0) {
                if (bridge.state().run.rail) throw new Error('Rail vehicles stay on their track. Retry to reset the train.');
                const [w, h] = bridge.state().level.world;
                finite(x, -w, 2 * w, 'X'); finite(y, -h, 2 * h, 'Y'); finite(degrees, -36000, 36000, 'Heading');
                live(); practice('repositioned hull'); playback = null;
                bridge.clearInput(); bridge.warp(x, y, degrees * Math.PI / 180); bridge.hud();
            },
            repair() { live(); practice('hull repaired'); bridge.repair(); bridge.hud(); },
            state() {
                const s = bridge.state();
                return copy({ level: s.level.id, status: s.status, timeScale: rate, replay: playback?.fixture.level || null, input: s.input, run: s.run });
            },
            runs() {
                const rows = V.runs.filter(f=>{
                    const l=bridge.levels.find(l=>l.id===f.level);
                    return l&&f.compatibility===C.stamp(l);
                }).map(f => {
                    const l = bridge.levels.find(l => l.id === f.level);
                    return { id: f.level, world: l.worldNumber, stage: l.stageNumber, name: l.name, bonus: !!l.bonus,
                        authorTime: f.expectedTime, method: 'control-only', source: f.source };
                });
                return catalog(rows);
            },
            times() {
                const rows = (bridge.levels.catalog || bridge.levels).map(l => ({
                    comingSoon: !!l.comingSoon,
                    world: l.worldNumber, stage: l.stageNumber, id: l.id, bonus: !!l.bonus,
                    verifiedAuthorTime: V.runs.find(f => f.level === l.id && f.compatibility===C.stamp(l))?.expectedTime ?? null,
                    goldTarget: l.pace?.[0] ?? null, silverTarget: l.pace?.[1] ?? null, bronzeTarget: l.pace?.[2] ?? null
                }));
                catalog(rows); log('info', 'null means no control-only author recording. Medal targets are design goals, not verified completion times.');
                return rows;
            },
            timeline(id) { const events = copy(fixture(id).events); log('table', events); return events; },
            watch,
            verify(id = 'all') {
                const runs = id === 'all' ? V.runs : [fixture(id)];
                return runs.map(f => { watch(f.level, 0); bridge.advance(f.duration + V.step); bridge.resetClock(); return copy(lastReport); });
            },
            report() { return copy(lastReport); },
            normal() {
                unlocked = false; rate = 1; playback = null;
                bridge.load(bridge.state().index);
                bridge.resetClock();
                log('info', 'Back on the clock. Fresh individual trial, normal time, records enabled.');
            }
        });
        if (!bridge.quiet) {
            log('info', '%cAHOY, CAPTAIN! ✦', 'font-size:22px;font-weight:bold;color:#bcb66b');
            log('info', 'You found the secret chart room. Coffee is hot, the controls are yours, and mission control saw nothing. Type DeadSlow.help() for the spare keys.');
        }
        return {
            menu, get unlocked() { return unlocked; }, get rate() { return rate; }, beforeStep, afterStep,
            onLoad() {
                playback = null;
                if (launching || rate !== 1) practice('test session');
            }
        };
    }
    const api = { create };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.HarborConsole = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
