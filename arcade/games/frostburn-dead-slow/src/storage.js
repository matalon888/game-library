(function (root) {
    'use strict';
    // Keep the original key so same-origin upgrades discover the v1 logbook.
    const KEY = 'dead-slow.records.v1', VERSION = 18;
    const Compatibility = typeof module !== 'undefined' && module.exports ? require('./compatibility.js') : root.CourseCompatibility;
    const levels = typeof module !== 'undefined' && module.exports ? require('./levels.js') : root.HarborLevels;
    const CURRENT = Compatibility.manifest(levels), BASELINE = Compatibility.baseline;
    // These routes now include an approach leg. Keep their earlier PBs/ghosts,
    // but never compare a dock-side departure against a midwater departure.
    const RESTARTED = ['milk-run', 'floating-sauna', 'market-day', 'granite-needle', 'last-bus', 'slackwater-salvage', 'island-exchange', 'two-calls', 'cars-and-casualty', 'midsummer-dispatch'];
    const REDESIGNED = ['vacuum', 'umbra', 'perihelion-dispatch', 'yesterday', 'century-ship'];
    const FIELD_INTRODUCED = { 'gerbo-banking':7, 'gerbo-lake-skipping':7, 'gerbo-downhill':8, 'gerbo-fort-pillow':8 };
    const FIELD_REVISED = ['gerbo-banking', 'gerbo-lake-skipping', 'gerbo-downhill', 'gerbo-forest-slalom', 'gerbo-fort-pillow', 'gerbo-cavy-clash', 'gerbo-pepperbreath', 'gerbo-whiskerdoom', 'gerbo-prickly-business', 'gerbo-rolling-threat'];
    const ARCHIVES = ['gerbozilla-contour-v1', 'grand-tour-contour-v1', 'gerbozilla-volcano-v1', 'grand-tour-order-v1', 'northwatch-approach-v1', 'archipelago-approach-v1', 'grand-tour-approach-v1', 'archipelago-layout-v2', 'gerbozilla-layout-v2', 'grand-tour-layout-v2', 'grand-tour-48', 'meridian-layout-v1', 'grand-tour-layout-v1', 'grand-tour-36', 'grand-tour-24', 'archipelago-dock-starts', 'grand-tour-dock-starts'];
    ARCHIVES.push('gerbozilla-topography-v1','grand-tour-60','long-grade-dispatch-v1','grand-tour-dispatch-v1');
    const RACES = ['coast', 'northwatch', 'archipelago', 'meridian', 'gerbozilla', 'long-grade', 'pale-reach', 'grand-tour'];
    const fresh = () => ({
        version: VERSION, compatibility:{stages:{...CURRENT.stages},races:{...CURRENT.races}}, archivedCompatibility:{stages:{},races:{}}, stages: {}, marathon: [], races: Object.fromEntries(RACES.map(id=>[id,[]])), archivedStages: {}, archivedRaces: Object.fromEntries(ARCHIVES.map(id => [id, []])), settings: { ghost: true, sound: true, guide: true, pauseOnBlur: true }, attempts: 0
    });
    function validRun(r) {
        return r && Number.isFinite(r.time) && r.time >= 0 && r.time < 86400 && Number.isInteger(r.contacts) && r.contacts >= 0 && typeof r.clean === 'boolean';
    }
    function retain(runs) {
        const sorted = runs.slice().sort((a, b) => a.time - b.time);
        const keep = new Set([...sorted.slice(0, 10), ...sorted.filter(r => r.clean).slice(0, 10)]);
        return sorted.filter(r => keep.has(r));
    }
    function sanitizeStages(stages) {
        const result = {};
        for (const [key, stage] of Object.entries(stages || {})) {
            if (!/^[a-z0-9-]{1,40}$/.test(key) || ['constructor', 'prototype'].includes(key) || !stage || typeof stage !== 'object')
                continue;
            const runs = retain((Array.isArray(stage.runs) ? stage.runs : []).filter(validRun).slice(0, 100).map(r => ({ ...r, ghost: undefined })));
            const ghost = Array.isArray(stage.ghost) ? stage.ghost.filter(p => Array.isArray(p) && p.length === 4 && p.every(Number.isFinite)).slice(0, 12000) : [];
            const splits = Array.isArray(stage.bestSplits) ? stage.bestSplits.filter(Number.isFinite).slice(0, 30) : [];
            result[key] = {
                runs, ghost, bestSplits: splits, clears: Math.max(0, Math.floor(Number(stage.clears) || 0)), attempts: Math.max(0, Math.floor(Number(stage.attempts) || 0))
            };
        }
        return result;
    }
    function sanitize(data, manifest = CURRENT) {
        const result = fresh();
        if (!data || ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, VERSION].includes(data.version))
            return result;
        result.attempts = Math.max(0, Math.floor(Number(data.attempts) || 0));
        result.stages = sanitizeStages(data.stages);
        result.archivedStages = sanitizeStages(data.archivedStages);
        if (data.version < 4) {
            for (const id of RESTARTED) {
                if (!result.stages[id]) continue;
                result.archivedStages[id] = result.stages[id];
                delete result.stages[id];
            }
        }
        // Never compare circuit records for different routes or stage counts.
        result.marathon = retain((Array.isArray(data.marathon) ? data.marathon : []).filter(validRun).slice(0, 100));
        if (data.version >= 2)
            for (const id of RACES) {
                const records = retain((Array.isArray(data.races?.[id]) ? data.races[id] : []).filter(validRun).slice(0, 100));
                if (data.version === 2 && id === 'grand-tour')
                    result.archivedRaces['grand-tour-24'] = records;
                else
                    result.races[id] = records;
            }
        if (data.version >= 3) {
            for (const id of ARCHIVES)
                result.archivedRaces[id] = retain((Array.isArray(data.archivedRaces?.[id]) ? data.archivedRaces[id] : []).filter(validRun).slice(0, 100));
            if (data.version < 4) {
                for (const id of ['archipelago', 'grand-tour']) {
                    result.archivedRaces[id + '-dock-starts'] = result.races[id];
                    result.races[id] = [];
                }
            }
        }
        if (data.version < 5 && result.races['grand-tour'].length) {
            result.archivedRaces['grand-tour-36'] = retain([...result.archivedRaces['grand-tour-36'], ...result.races['grand-tour']]);
            result.races['grand-tour'] = [];
        }
        // World 4 first appeared in schema 5, so only that schema can contain
        // records for the layouts replaced by schema 6. Older schemas still
        // need their own migrations above, but must not have unrelated stage
        // IDs swept into this archive when imported.
        if (data.version === 5) {
            for (const id of REDESIGNED) {
                if (!result.stages[id]) continue;
                result.archivedStages[id] = result.stages[id];
                delete result.stages[id];
            }
            for (const id of ['meridian', 'grand-tour']) {
                result.archivedRaces[id + '-layout-v1'] = retain([
                    ...result.archivedRaces[id + '-layout-v1'], ...result.races[id]
                ]);
                result.races[id] = [];
            }
        }
        // Only schema 6 shipped the first rolling course. Preserve its earlier
        // ellipse/wet-gravity route without resetting any sea/space records.
        if (data.version === 6 && result.stages['gerbo-first-outing']) {
            result.archivedStages['gerbo-first-outing'] = result.stages['gerbo-first-outing'];
            delete result.stages['gerbo-first-outing'];
        }
        // Schema 7 introduced these routes; their mountain/moat defenses and
        // retaliation now change times. Keep the introduction and all circuits.
        if (data.version === 7) for (const id of ['gerbo-banking','gerbo-lake-skipping']) {
            if (!result.stages[id]) continue;
            result.archivedStages[id]=result.stages[id];
            delete result.stages[id];
        }
        // Retire only the superseded Reservoir Hairpin. No retained course or
        // circuit changes geometry in this update; old exports remain readable.
        if (data.version === 8 && result.stages['gerbo-hairpin']) {
            result.archivedStages['gerbo-hairpin']=result.stages['gerbo-hairpin'];
            delete result.stages['gerbo-hairpin'];
        }
        // All earlier migration rules run first. Only still-active 48-stage
        // Grand Tours move here; do not relabel older, already archived routes.
        if(data.version < 10) {
            result.archivedRaces['grand-tour-48'] = retain([
                ...result.archivedRaces['grand-tour-48'], ...result.races['grand-tour']
            ]);
            result.races['grand-tour'] = [];
            result.races.gerbozilla = [];
            if(data.version >= 6) for(const id of FIELD_REVISED) {
                if(data.version < (FIELD_INTRODUCED[id] || 9) || !result.stages[id]) continue;
                // A separate key preserves earlier terrain archives too, including
                // their own ghost and split arrays. Never mix different layouts.
                result.archivedStages[id+'-preview'] = result.stages[id];
                delete result.stages[id];
            }
        }
        // The broadside barge replaces the inline tow (schemas 4–10). The
        // southwest lake replaces only the released field map (schema 10);
        // earlier field variants were already archived above. Keep each
        // layout's ghost/splits separate from prior departure/preview archives.
        if (data.version < 11) {
            const ids = [];
            if (data.version >= 4) ids.push('granite-needle');
            if (data.version >= 10) ids.push('gerbo-whiskerdoom');
            for (const id of ids) {
                if (!result.stages[id]) continue;
                result.archivedStages[id + '-layout-v1'] = result.stages[id];
                delete result.stages[id];
            }
            const races = data.version >= 4 ? ['archipelago'] : [];
            if (data.version >= 10) races.push('gerbozilla', 'grand-tour');
            for (const id of races) {
                result.archivedRaces[id + '-layout-v2'] = retain([
                    ...result.archivedRaces[id + '-layout-v2'], ...result.races[id]
                ]);
                result.races[id] = [];
            }
        }
        // Only active records survive the preceding migrations. Keep the old
        // straight backing / same-axis ferry routes separate, including clean
        // circuit records and their older archives. Do not touch other worlds.
        if (data.version < 12) {
            for (const [id, introduced] of [['backwater', 2], ['island-exchange', 4]]) {
                if (data.version < introduced || !result.stages[id]) continue;
                result.archivedStages[id + '-approach-v1'] = result.stages[id];
                delete result.stages[id];
            }
            for (const [id, introduced] of [['northwatch', 2], ['archipelago', 4], ['grand-tour', 10]]) {
                if (data.version < introduced) continue;
                result.archivedRaces[id + '-approach-v1'] = retain([
                    ...result.archivedRaces[id + '-approach-v1'], ...result.races[id]
                ]);
                result.races[id] = [];
            }
        }
        // 5.1 changes three field hazards and the order (not membership) of the
        // Grand Tour. Archive only surviving active records; retain both classes.
        if (data.version < 13) {
            for (const id of ['gerbo-downhill','gerbo-forest-slalom','gerbo-prickly-business']) {
                if (data.version < 10 || !result.stages[id]) continue;
                result.archivedStages[id+'-volcano-v1'] = result.stages[id];
                delete result.stages[id];
            }
            for (const [id,archive] of [['gerbozilla','gerbozilla-volcano-v1'],['grand-tour','grand-tour-order-v1']]) {
                result.archivedRaces[archive] = retain([...result.archivedRaces[archive], ...result.races[id]]);
                result.races[id] = [];
            }
        }
        // Rounded volcanic contours change the safe banks, even though the
        // clocks and objectives are identical. Keep earlier comparisons separate.
        if (data.version === 13) {
            for (const id of ['gerbo-downhill','gerbo-forest-slalom','gerbo-prickly-business']) {
                if (!result.stages[id]) continue;
                result.archivedStages[id+'-contour-v1'] = result.stages[id];
                delete result.stages[id];
            }
            for (const id of ['gerbozilla','grand-tour']) {
                const archive=id+'-contour-v1';
                result.archivedRaces[archive] = retain([...result.archivedRaces[archive], ...result.races[id]]);
                result.races[id] = [];
            }
        }
        if (data.version < 15) {
            for(const [id,suffix] of [['long-grade-7','support-v1'],['long-grade-8','clearance-v1']]) {
                if(!result.stages[id])continue;
                result.archivedStages[id+'-'+suffix]=result.stages[id];delete result.stages[id];
            }
        }
        if(data.version<16) {
            for(const id of ['gerbo-downhill','gerbo-forest-slalom','gerbo-prickly-business']) {
                if(data.version<14||!result.stages[id])continue;
                result.archivedStages[id+'-topography-v1']=result.stages[id];delete result.stages[id];
            }
            for(const [id,archive] of [['gerbozilla','gerbozilla-topography-v1'],['grand-tour','grand-tour-60']]) {
                result.archivedRaces[archive]=retain([...result.archivedRaces[archive],...result.races[id]]);result.races[id]=[];
            }
        }
        if(data.version<17) {
            for(const id of ['long-grade-4','long-grade-9','long-grade-12']) {
                if(!result.stages[id])continue;
                result.archivedStages[id+'-dispatch-v1']=result.stages[id];delete result.stages[id];
            }
            for(const id of ['long-grade','grand-tour']) {
                const archive=id+'-dispatch-v1';
                result.archivedRaces[archive]=retain([...result.archivedRaces[archive],...result.races[id]]);result.races[id]=[];
            }
        }
        // Save format and handling compatibility are independent. Historical
        // format migrations above run once; future course edits only bump revisions.
        for(const [id,rows] of Object.entries(data.archivedRaces||{})) {
            if(/^[a-z0-9-]{1,40}-rev-[a-f0-9]{8}$/.test(id))result.archivedRaces[id]=retain((Array.isArray(rows)?rows:[]).filter(validRun).slice(0,100));
        }
        if(Compatibility.valid(data.archivedCompatibility)) {
            for(const kind of ['stages','races'])for(const [id,signature] of Object.entries(data.archivedCompatibility[kind])) {
                if(/^[a-z0-9-]{1,40}-rev-[a-f0-9]{8}$/.test(id))result.archivedCompatibility[kind][id]=signature;
            }
        }
        // A hash is only an index. Compare full signatures before merging records.
        function archiveKey(kind,id,signature) {
            const signatures=result.archivedCompatibility[kind];
            const records=kind==='stages'?result.archivedStages:result.archivedRaces;
            let key=Compatibility.archiveKey(id,signature),salt=0;
            while(Object.hasOwn(records,key)&&signatures[key]!==signature)key=Compatibility.archiveKey(id,signature+'#'+(++salt));
            signatures[key]=signature;
            return key;
        }
        const previous = Compatibility.valid(data.compatibility) ? data.compatibility : data.version<18 ? BASELINE : {stages:{},races:{}};
        for(const [id,signature] of Object.entries(manifest.stages)) {
            if(result.stages[id] && previous.stages[id]!==signature) {
                const key=archiveKey('stages',id,previous.stages[id]||'unknown');
                const stage=result.stages[id],older=result.archivedStages[key];
                if(older) {
                    const olderBest=older.runs[0]&&(!stage.runs[0]||older.runs[0].time<stage.runs[0].time);
                    stage.runs=retain([...older.runs,...stage.runs]);
                    if(olderBest){stage.ghost=older.ghost;stage.bestSplits=older.bestSplits;}
                    stage.clears+=older.clears;
                    stage.attempts+=older.attempts;
                }
                result.archivedStages[key]=stage;delete result.stages[id];
            }
        }
        for(const [id,signature] of Object.entries(manifest.races)) {
            if(result.races[id]?.length && previous.races[id]!==signature) {
                const key=archiveKey('races',id,previous.races[id]||'unknown');
                result.archivedRaces[key]=retain([...(result.archivedRaces[key]||[]),...result.races[id]]);result.races[id]=[];
            }
        }
        result.compatibility={stages:{...manifest.stages},races:{...manifest.races}};
        for (const k of ['ghost', 'sound', 'guide', 'pauseOnBlur'])
            if (typeof data.settings?.[k] === 'boolean')
                result.settings[k] = data.settings[k];
        return result;
    }
    function create(storage) {
        let data = fresh(), available = true;
        try {
            const s = storage.getItem(KEY);
            if (s)
                data = sanitize(JSON.parse(s));
        }
        catch (e) {
            available = false;
        }
        function save() {
            try {
                storage.setItem(KEY, JSON.stringify(data));
                available = true;
                return true;
            }
            catch (e) {
                available = false;
                return false;
            }
        }
        function stage(id) {
            return data.stages[id] || (data.stages[id] = {
                runs: [], ghost: [], bestSplits: [], clears: 0, attempts: 0
            });
        }
        function best(id, clean = false) {
            const arr = stage(id).runs.filter(r => !clean || r.clean);
            return arr.length ? arr.reduce((a, b) => a.time < b.time ? a : b) : null;
        }
        function attempt(id) {
            data.attempts++;
            stage(id).attempts++;
            save();
        }
        function record(id, run, ghost, splits) {
            const s = stage(id), previous = best(id), pb = !previous || run.time < previous.time;
            s.clears++;
            s.runs = retain([
                ...s.runs, { ...run, date: run.date || new Date().toISOString() }
            ]);
            if (pb) {
                s.ghost = ghost;
                s.bestSplits = splits;
            }
            save();
            return pb;
        }
        function recordRace(id, run) {
            if (!RACES.includes(id) || !validRun(run))
                return false;
            data.races[id] = retain([...data.races[id], run]);
            return save();
        }
        function bestRace(id, clean = false) {
            return (data.races[id] || []).find(r => !clean || r.clean) || null;
        }
        return {
            get data() {
                return data;
            }, get available() {
                return available;
            }, save, stage, best, attempt, record, recordRace, bestRace,
            import(text) {
                const d = JSON.parse(text);
                if (!d || ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, VERSION].includes(d.version))
                    throw Error('This is not a compatible Dead Slow logbook.');
                data = sanitize(d);
                save();
            },
            reset() {
                data = fresh();
                save();
            }, export() {
                return JSON.stringify(data, null, 2);
            }
        };
    }
    const api = {
        KEY, VERSION, RESTARTED, REDESIGNED, FIELD_REVISED, fresh, sanitize, create
    };
    if (typeof module !== 'undefined' && module.exports)
        module.exports = api;
    root.HarborStorage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
