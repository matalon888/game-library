// @ts-check
(function (/** @type {typeof globalThis} */ root) {
    'use strict';
    /** @typedef {{id:string,campaign:string,simulation:string,courseRevision?:number,rulesRevision?:number,bonus?:boolean,standalone?:boolean}} Course */
    /** @typedef {{stages:Record<string,string>,races:Record<string,string>}} Manifest */
    /** @param {Course} level */
    function stamp(level) {
        const course = level.courseRevision ?? 1, rules = level.rulesRevision ?? 1;
        if (!/^[a-z][a-z0-9-]*$/.test(level.simulation) || !Number.isInteger(course) || course<1 || course>999 || !Number.isInteger(rules) || rules<1 || rules>999)
            throw Error('Invalid course compatibility: '+level.id);
        return `${level.simulation}:${course}:${rules}`;
    }
    /** @param {Course[]} levels @returns {Manifest} */
    function manifest(levels) {
        /** @type {Record<string,string>} */ const stages = {};
        /** @type {Record<string,string[]>} */ const routes = {'grand-tour':[]};
        for (const level of levels) {
            if (!/^[a-z0-9-]{1,26}$/.test(level.id) || Object.hasOwn(stages,level.id)) throw Error('Invalid or duplicate course ID: '+level.id);
            if (!/^[a-z0-9-]+$/.test(level.campaign)) throw Error('Invalid campaign: '+level.id);
            stages[level.id] = stamp(level);
            if (!level.bonus && !level.standalone) {
                const entry = level.id+'@'+stages[level.id];
                (routes[level.campaign] ||= []).push(entry); routes['grand-tour'].push(entry);
            }
        }
        return {stages,races:Object.fromEntries(Object.entries(routes).map(([id,route])=>[id,route.join('|')]))};
    }
    /** Stable archive identifier; the full signature remains in compatibility metadata.
     * @param {string} signature */
    function hash(signature) {
        let value=2166136261;
        for(let i=0;i<signature.length;i++)value=Math.imul(value^signature.charCodeAt(i),16777619);
        return (value>>>0).toString(16).padStart(8,'0');
    }
    /** @param {string} id @param {string} previous */
    function archiveKey(id,previous) { return id+'-rev-'+hash(previous); }
    /** @param {unknown} value @returns {value is Manifest} */
    function valid(value) {
        if(!value||typeof value!=='object'||!('stages' in value)||!('races' in value))return false;
        return [value.stages,value.races].every(part=>part&&typeof part==='object'&&!Array.isArray(part)&&Object.values(part).every(v=>typeof v==='string'&&v.length<=16000));
    }
    // Frozen schema-17 release routes. Never derive legacy signatures from a
    // future catalog: added or reordered stages must invalidate old circuits.
    /** @type {Manifest} */
    const baseline = {
        "stages": {
            "dead-slow": "marine:1:1",
            "dogleg": "marine:1:1",
            "crosscurrent-sheltered": "marine:1:1",
            "signal": "marine:1:1",
            "traffic": "marine:1:1",
            "radio": "marine:1:1",
            "lock": "marine:1:1",
            "astern": "marine:1:1",
            "ballast-sheltered": "marine:1:1",
            "tidal": "marine:1:1",
            "quiet": "marine:1:1",
            "last-berth-sheltered": "marine:1:1",
            "crosscurrent": "marine:1:1",
            "ballast": "marine:1:1",
            "last-berth": "marine:1:1",
            "two-greens": "marine:1:1",
            "tidal-race": "marine:1:1",
            "night-convoy": "marine:1:1",
            "dogwatch-lock": "marine:1:1",
            "backwater": "marine:1:1",
            "sounding-line": "marine:1:1",
            "deadweight": "marine:1:1",
            "switchback": "marine:1:1",
            "last-light": "marine:1:1",
            "first-crossing": "marine:1:1",
            "bigger-boat": "marine:1:1",
            "milk-run": "marine:1:1",
            "floating-sauna": "marine:1:1",
            "market-day": "marine:1:1",
            "granite-needle": "marine:1:1",
            "last-bus": "marine:1:1",
            "slackwater-salvage": "marine:1:1",
            "island-exchange": "marine:1:1",
            "two-calls": "marine:1:1",
            "cars-and-casualty": "marine:1:1",
            "midsummer-dispatch": "marine:1:1",
            "gerbo-first-outing": "rolling:1:1",
            "gerbo-banking": "rolling:1:1",
            "gerbo-lake-skipping": "rolling:1:1",
            "gerbo-downhill": "rolling:1:1",
            "gerbo-forest-slalom": "rolling:1:1",
            "gerbo-fort-pillow": "rolling:1:1",
            "gerbo-cavy-clash": "rolling:1:1",
            "gerbo-pepperbreath": "rolling:1:1",
            "gerbo-whiskerdoom": "rolling:1:1",
            "gerbo-prickly-business": "rolling:1:1",
            "gerbo-rolling-threat": "rolling:1:1",
            "gerbo-long-way-home": "rolling:1:1",
            "long-grade-1": "rail:1:1",
            "long-grade-2": "rail:1:1",
            "long-grade-3": "rail:1:1",
            "long-grade-4": "rail:1:1",
            "long-grade-5": "rail:1:1",
            "long-grade-6": "rail:1:1",
            "long-grade-7": "rail:1:1",
            "long-grade-8": "rail:1:1",
            "long-grade-9": "rail:1:1",
            "long-grade-10": "rail:1:1",
            "long-grade-11": "rail:1:1",
            "long-grade-12": "rail:1:1",
            "vacuum": "space:1:1",
            "wandering-stone": "space:1:1",
            "last-fill": "space:1:1",
            "family-reunion": "space:1:1",
            "newtons-broadside": "space:1:1",
            "moving-argument": "space:1:1",
            "equal-and-opposite": "space:1:1",
            "umbra": "space:1:1",
            "borrowed-sun": "space:1:1",
            "yesterday": "space:1:1",
            "cold-transit": "space:1:1",
            "perihelion-dispatch": "space:1:1",
            "century-ship": "space:1:1"
        },
        "races": {
            "grand-tour": "dead-slow@marine:1:1|dogleg@marine:1:1|crosscurrent-sheltered@marine:1:1|signal@marine:1:1|traffic@marine:1:1|radio@marine:1:1|lock@marine:1:1|astern@marine:1:1|ballast-sheltered@marine:1:1|tidal@marine:1:1|quiet@marine:1:1|last-berth-sheltered@marine:1:1|crosscurrent@marine:1:1|ballast@marine:1:1|last-berth@marine:1:1|two-greens@marine:1:1|tidal-race@marine:1:1|night-convoy@marine:1:1|dogwatch-lock@marine:1:1|backwater@marine:1:1|sounding-line@marine:1:1|deadweight@marine:1:1|switchback@marine:1:1|last-light@marine:1:1|first-crossing@marine:1:1|bigger-boat@marine:1:1|milk-run@marine:1:1|floating-sauna@marine:1:1|market-day@marine:1:1|granite-needle@marine:1:1|last-bus@marine:1:1|slackwater-salvage@marine:1:1|island-exchange@marine:1:1|two-calls@marine:1:1|cars-and-casualty@marine:1:1|midsummer-dispatch@marine:1:1|gerbo-first-outing@rolling:1:1|gerbo-banking@rolling:1:1|gerbo-lake-skipping@rolling:1:1|gerbo-downhill@rolling:1:1|gerbo-forest-slalom@rolling:1:1|gerbo-fort-pillow@rolling:1:1|gerbo-cavy-clash@rolling:1:1|gerbo-pepperbreath@rolling:1:1|gerbo-whiskerdoom@rolling:1:1|gerbo-prickly-business@rolling:1:1|gerbo-rolling-threat@rolling:1:1|gerbo-long-way-home@rolling:1:1|long-grade-1@rail:1:1|long-grade-2@rail:1:1|long-grade-3@rail:1:1|long-grade-4@rail:1:1|long-grade-5@rail:1:1|long-grade-6@rail:1:1|long-grade-7@rail:1:1|long-grade-8@rail:1:1|long-grade-9@rail:1:1|long-grade-10@rail:1:1|long-grade-11@rail:1:1|long-grade-12@rail:1:1|vacuum@space:1:1|wandering-stone@space:1:1|last-fill@space:1:1|family-reunion@space:1:1|newtons-broadside@space:1:1|moving-argument@space:1:1|equal-and-opposite@space:1:1|umbra@space:1:1|borrowed-sun@space:1:1|yesterday@space:1:1|cold-transit@space:1:1|perihelion-dispatch@space:1:1",
            "coast": "dead-slow@marine:1:1|dogleg@marine:1:1|crosscurrent-sheltered@marine:1:1|signal@marine:1:1|traffic@marine:1:1|radio@marine:1:1|lock@marine:1:1|astern@marine:1:1|ballast-sheltered@marine:1:1|tidal@marine:1:1|quiet@marine:1:1|last-berth-sheltered@marine:1:1",
            "northwatch": "crosscurrent@marine:1:1|ballast@marine:1:1|last-berth@marine:1:1|two-greens@marine:1:1|tidal-race@marine:1:1|night-convoy@marine:1:1|dogwatch-lock@marine:1:1|backwater@marine:1:1|sounding-line@marine:1:1|deadweight@marine:1:1|switchback@marine:1:1|last-light@marine:1:1",
            "archipelago": "first-crossing@marine:1:1|bigger-boat@marine:1:1|milk-run@marine:1:1|floating-sauna@marine:1:1|market-day@marine:1:1|granite-needle@marine:1:1|last-bus@marine:1:1|slackwater-salvage@marine:1:1|island-exchange@marine:1:1|two-calls@marine:1:1|cars-and-casualty@marine:1:1|midsummer-dispatch@marine:1:1",
            "gerbozilla": "gerbo-first-outing@rolling:1:1|gerbo-banking@rolling:1:1|gerbo-lake-skipping@rolling:1:1|gerbo-downhill@rolling:1:1|gerbo-forest-slalom@rolling:1:1|gerbo-fort-pillow@rolling:1:1|gerbo-cavy-clash@rolling:1:1|gerbo-pepperbreath@rolling:1:1|gerbo-whiskerdoom@rolling:1:1|gerbo-prickly-business@rolling:1:1|gerbo-rolling-threat@rolling:1:1|gerbo-long-way-home@rolling:1:1",
            "long-grade": "long-grade-1@rail:1:1|long-grade-2@rail:1:1|long-grade-3@rail:1:1|long-grade-4@rail:1:1|long-grade-5@rail:1:1|long-grade-6@rail:1:1|long-grade-7@rail:1:1|long-grade-8@rail:1:1|long-grade-9@rail:1:1|long-grade-10@rail:1:1|long-grade-11@rail:1:1|long-grade-12@rail:1:1",
            "meridian": "vacuum@space:1:1|wandering-stone@space:1:1|last-fill@space:1:1|family-reunion@space:1:1|newtons-broadside@space:1:1|moving-argument@space:1:1|equal-and-opposite@space:1:1|umbra@space:1:1|borrowed-sun@space:1:1|yesterday@space:1:1|cold-transit@space:1:1|perihelion-dispatch@space:1:1"
        }
    };
    Object.freeze(baseline.stages); Object.freeze(baseline.races); Object.freeze(baseline);
    const api = Object.freeze({stamp,manifest,archiveKey,valid,baseline});
    if(typeof module!=='undefined'&&module.exports)module.exports=api;
    root.CourseCompatibility=api;
})(globalThis);
