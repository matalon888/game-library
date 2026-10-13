// @ts-check
(function (/** @type {typeof globalThis} */ root) {
    'use strict';
    /** Shell-facing railway integration. No marine physics or job constructors.
     * @param {import('./contracts.js').RailServices} services
     * @returns {import('./contracts.js').RailAdapter} */
    function create(services) {
        const {railway:R, audio, view, finish, fail} = services;
        return {
            id: 'rail',
            create(level) { return {rail:R.create(level)}; },
            ready(run) { return run.rail.config.tasks.every(task=>task.milestone||run.rail.completed.includes(task.id)); },
            clean(run) { return run.rail.stats.contacts === 0; },
            step(run, dt) {
                const st = run.rail;
                R.update(st, dt);
                if (st.stats.contacts > run.contacts) audio.railEvent('couple');
                run.time = st.time;
                // First completion is timing history; current validity lives in st.completed.
                run.splits ||= [];
                for(const task of st.config.tasks)if(st.completed.includes(task.id)&&!run.splits.some(split=>split.name===task.text)) {
                    run.splits.push({name:task.text,time:st.time});
                }
                run.distance = st.stats.distance;
                run.contacts = st.stats.contacts;
                const engine = R.drivingEngine(st);
                const position = R.locate(st, R.engineGroup(st), engine.q);
                run.focus = {x:position.x,y:position.y,a:position.a};
                run.maxSpeed = Math.max(run.maxSpeed, Math.abs(engine.v));
                if (st.failure) { fail(); return; }
                if (run.time >= run.sampleAt) {
                    run.ghost.push([run.time,position.x,position.y,position.a]);
                    run.sampleAt = run.time + .2;
                }
                if (st.finishHold >= 2) finish();
            },
            command(run, name, value) {
                const before = R.engineGroup(run.rail).brake;
                const ok = R.command(run.rail, name, value);
                if (!ok) return false;
                const cue = R.commands.definitions[name].cue;
                if (cue === 'horn') audio.horn();
                else if (cue) audio.railEvent(cue);
                if (name === 'brake' && typeof value === 'number' && Math.abs(before-value) >= .25) audio.railEvent('brake');
                if (name === 'power') run.throttleOrders++;
                return true;
            },
            key(event, run) { return view.key(event, run.rail); },
            prepare(level, command) { view.prepare(level, command); },
            update(...args) { view.update(...args); },
            render(canvas, level, run, zoom) { view.render(canvas, level, run, zoom); },
            dialog(...args) { return view.dialog(...args); },
            result(run) { return {rail:{...run.rail.stats}}; }
        };
    }
    const api = {create};
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.RailSimulation = api;
})(globalThis);
