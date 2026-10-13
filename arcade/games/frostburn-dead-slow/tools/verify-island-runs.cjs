'use strict';
// Replays fixed player inputs through the actual game, without rendering.
// No ship coordinates, velocities, job progress or physics values are changed.
const assert = require('node:assert/strict');
const L = require('../src/levels.js');
const { create } = require('../tests/headless.cjs');
// Historical filename retained; this now checks every published author run.
const { runs: fixtures } = require('../src/verification.js');
function replay(fixture) {
    const t = create();
    const index = L.findIndex(level => level.id === fixture.level);
    assert.ok(index >= 0, `Unknown stage: ${fixture.level}`);
    t.load(index);
    let event = 0;
    for (let tick = 0; tick < Math.ceil(fixture.duration * 120) && t.state.status === 'running'; tick++) {
        while (event < fixture.events.length && fixture.events[event].time <= tick / 120 + 1e-7) {
            const e = fixture.events[event++];
            if (e.rail) t.railCommand(...e.rail);
            if (e.line)
                t.lineAction();
            if (e.throttle !== undefined)
                t.throttle(e.throttle - t.state.run.ship.throttle);
            for (const key of ['rudder', 'thruster', 'winch']) {
                if (e[key] !== undefined)
                    t.state.input[key] = e[key];
            }
        }
        t.advance(1 / 120);
    }
    return t;
}
if (require.main === module) {
    for (const fixture of fixtures) {
        const t = replay(fixture);
        assert.equal(t.state.status, 'complete', `${fixture.level}: did not finish`);
        assert.ok(t.state.run.result.clean, `${fixture.level}: not clean`);
        assert.ok(Math.abs(t.state.run.time - fixture.expectedTime) < 1 / 120, `${fixture.level}: author time diverged`);
        console.log(`${t.state.level.name}: ${t.state.run.time.toFixed(2)} s, ${t.state.run.contacts} contacts, ${t.state.run.jobs.stats.lineBreaks} parted lines`);
    }
}
module.exports = { replay, fixtures };
