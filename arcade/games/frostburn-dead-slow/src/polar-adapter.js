// @ts-check
(function (/** @type {typeof globalThis} */ root){
    'use strict';
    /** @param {import('./contracts.js').PolarServices} services
     * @returns {import('./contracts.js').PolarAdapter} */
    function create({polar:I,view,input,finish,fail}){
        /** @param {import('./contracts.js').PolarState} st */
        const cleanState=st=>st.contacts===0&&st.stats.damageTaken===0&&st.stats.towBreaks===0&&st.fleet.every(f=>f.ship.hull>=100);
        return {id:'polar',create:level=>I.create(level),ready:I.ready,
            clean:run=>cleanState(run.polar)&&(!run.finalJourney||cleanState(run.finalJourney.subState)),
            step(run,dt){I.step(run.polar.level,run,input,dt);if(run.polar.failure)fail();else if(run.polar.complete)finish();},
            command:I.command,action:I.action,
            key(e,run){
                /** @type {Record<string,import('./contracts.js').PolarAction>} */
                const keys=run.polar.submarine?{KeyB:'fire',KeyT:'target',KeyP:'ping',KeyI:'identify',KeyF:'team',KeyZ:'ascend',KeyX:'descend'}:{KeyB:'fire',KeyT:'target'};
                const name=keys[e.code];if(!name)return false;e.preventDefault();if(!e.repeat)I.action(run,name);return true;
            },
            update:view.update,render:view.render,dialog:view.dialog,
            result:run=>({polar:{...run.polar.stats,iceContacts:run.contacts??run.polar.contacts,...(run.finalJourney?{
                teamInserted:run.finalJourney.subState.stats.teamInserted,teamRecovered:run.finalJourney.subState.stats.teamRecovered,
                damageTaken:run.polar.stats.damageTaken+run.finalJourney.subState.stats.damageTaken,
                submarineLeg:run.finalJourney.watch.handoffAt??0,surfaceLeg:(run.time??0)-(run.finalJourney.watch.handoffAt??0)}: {})}})};
    }
    const api={create};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.PolarSimulation=api;
})(globalThis);
