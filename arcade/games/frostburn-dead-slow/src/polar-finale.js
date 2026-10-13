/* One watch and one evolving surface sea, across two command bridges. */
(function(root){
    'use strict';
    const U=typeof module!=='undefined'&&module.exports?require('./submarine.js'):root.PaleReachSubmarine;
    const fields=()=>({time:0,contacts:0,distance:0,maxSpeed:0,dockHold:0,sampleAt:0,ghost:[],splits:[]});
    function create(level,I){
        const sub=U.create(level),c=level.polar.surface;
        const surfaceLevel={...level,start:c.start,spec:c.spec,polar:c.polar,berth:c.polar.berth};
        const surface={...fields(),...I.create(surfaceLevel)};surface.ship.moored=true;
        // The two depth views share the same physical keels. Surface physics
        // advances them exactly once; the submarine still collides at its depth.
        sub.polar.bergs=surface.polar.bergs;sub.polar.externalIce=true;
        const watch={phase:'underwater',deadline:level.polar.deadline,disabled:false,subSecured:false,channel:false,handoffAt:null};
        sub.polar.journey=watch;surface.polar.journey=watch;
        return {...sub,finalJourney:{watch,surface,subState:sub.polar,subShip:sub.ship,level}};
    }
    function step(level,run,input,dt,I){
        const f=run.finalJourney,w=f.watch,surface=f.surface,st=surface.polar;
        if(w.phase==='underwater'){
            I.step(st.level,surface,{},dt,true);
            I.step(level,run,input,dt,true);
            if(run.polar.mission.work>=run.polar.config.access.work&&!w.disabled){
                w.disabled=true;const battery=st.operation.assets.find(a=>a.id==='denial');battery.ship.disabled=true;battery.name='DENIAL SYSTEM · ISOLATED';
            }
            if(st.failure)run.polar.failure=st.failure;
            if(run.polar.complete&&!run.polar.failure){
                w.phase='surface';w.subSecured=true;w.handoffAt=run.time;
                f.subShip.moored=true;surface.ship.moored=false;
                run.ghost.push([run.time,run.ship.x,run.ship.y,run.ship.a]);
                run.ship=surface.ship;run.polar=st;run.dock=surface.dock;run.dockHold=0;
                run.ghost.push([run.time,run.ship.x,run.ship.y,run.ship.a]);run.sampleAt=run.time+.25;
                st.rebridge=true;st.complete=false;st.notice='KESTREL HAS THE WATCH · same clock, same sea. Reopen Rime’s aging wake and release the convoy.';st.noticeUntil=st.time+15;
                input.rudder=0;input.thruster=0;input.winch=0;
            }
        }else{I.step(st.level,run,input,dt,true);surface.time=run.time;}
        // Weather increases slush drag continuously; it never creates a solid
        // wall through an occupied hull. The negotiated window is explicit.
        const factor=Math.max(.25,1-run.time/w.deadline*.7);
        st.weatherFactor=factor;
        if(run.time>=w.deadline&&!run.polar.complete)run.polar.failure='The negotiated weather window closed before the final relief ship cleared the passage.';
        if(!w.channel&&w.phase==='surface'&&st.fleet.every(v=>v.navigation))w.channel=true;
        run.contacts=f.subState.contacts+st.contacts;
        for(const o of progress(run))if(o.done&&!run.splits.some(s=>s.name===o.text))run.splits.push({name:o.text,time:run.time});
    }
    function ready(run){return run.finalJourney.watch.phase==='surface'&&run.polar.fleet.every(f=>f.returned);}
    function progress(run){const f=run.finalJourney,w=f.watch;
        const done=[f.subState.stats.teamInserted>0,w.disabled,f.subState.stats.teamRecovered>0,w.subSecured,w.channel,run.polar.complete&&w.phase==='surface'];
        return f.level.polar.objectives.map((text,i)=>({text,done:!!done[i]}));
    }
    function message(run){const f=run.finalJourney,w=f.watch,left=Math.max(0,Math.ceil(w.deadline-run.time)),clock=`WEATHER ${Math.floor(left/60)}:${String(left%60).padStart(2,'0')} · `;
        if(run.polar.failure)return run.polar.failure;
        if(run.polar.complete)return 'The route is open, and the relief ships are through.';
        if(w.phase==='underwater')return clock+'PETREL / '+U.message(run);
        return clock+(run.polar.noticeUntil>run.time?run.polar.notice:`KESTREL / ${run.polar.stats.safeReturns} of 3 ships through. Clear the wake, then give Proceed.`);
    }
    const api={create,step,ready,progress,message};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.PaleReachFinale=api;
})(globalThis);
