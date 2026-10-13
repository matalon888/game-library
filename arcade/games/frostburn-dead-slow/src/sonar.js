/* Sensor memories, never live references to hidden hulls. No rendering or randomness. */
(function(root){
    'use strict';
    const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
    function predict(track,time){
        const age=Math.max(0,time-track.at),travel=Math.min(age,45);
        return {x:track.x+track.vx*travel,y:track.y+track.vy*travel,depth:track.depth,
            radius:Math.min(300,track.radius+age*(track.source==='active'?2.4:3.2)),age,
            quality:clamp(track.quality-age*.7,0,100)};
    }
    function observe(state,actor,observer,time,active=false){
        let t=state.tracks.find(t=>t.entity===actor.id);
        if(!t){t={id:'C'+String(++state.trackSerial).padStart(2,'0'),entity:actor.id,evidence:0,identified:false,category:'unknown',first:time};state.tracks.push(t);}
        if(!active&&t.source==='active'&&time-t.at<6)return t;
        const s=actor.ship,d=Math.hypot(s.x-observer.x,s.y-observer.y),self=state.noise;
        t.evidence=Math.min(55,t.evidence+(active?30:Math.max(.15,1-self)));
        const radius=active?7:Math.max(12,65+d*.07-t.evidence*2.2)+self*24;
        const phase=Number(t.id.slice(1))*2.17+time*.023;
        t.x=s.x+Math.sin(phase)*radius*.48;t.y=s.y+Math.cos(phase*.83)*radius*.48;
        t.vx=s.vx+(active?.018:.075)*Math.sin(phase);t.vy=s.vy+(active?.018:.075)*Math.cos(phase);
        t.depth=active||t.evidence>=16?s.depth:null;t.radius=radius;t.at=time;t.source=active?'active':'passive';
        t.quality=active?100:clamp(32+t.evidence*1.25-self*25,5,95);
        t.category=t.evidence>=18?actor.kind==='service'?'service':actor.kind==='decoy'?'decoy':actor.kind==='patrol'?'patrol':'submarine':'unknown';
        t.clue=t.category==='service'?'Council maintenance transponder':t.category==='decoy'?'Repeating recording; drifting source':t.category==='submarine'?'Submerged machinery; independent propulsion':t.category==='patrol'?'Surface patrol machinery':
            Math.hypot(s.vx,s.vy)>.35?'Changing bearing; sustained motion':'Slow drift; repeating acoustic rhythm';
        return t;
    }
    function prune(state,time){state.tracks=state.tracks.filter(t=>time-t.at<150);if(!state.tracks.some(t=>t.id===state.selected))state.selected=null;}
    const api={predict,observe,prune};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.PaleReachSonar=api;
})(globalThis);
