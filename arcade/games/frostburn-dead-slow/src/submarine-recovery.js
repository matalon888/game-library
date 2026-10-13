/* Moving extraction beacons and visible patrol redeployment. No instant travel. */
(function(root){
    'use strict';
    function sites(st){return st.config.extraction.sites.map(p=>{
        const b=p.anchor&&st.bergs.find(b=>b.id===p.anchor);
        return {...p,x:b?b.x+p.dx:p.x,y:b?b.y+p.dy:p.y,vx:b?b.vx:0,vy:b?b.vy:0,hold:st.config.extraction.hold};
    });}
    function create(st){const p=sites(st)[0];st.mission.team='waiting';st.recovery={selected:p.id,beacon:{x:p.x,y:p.y,vx:p.vx,vy:p.vy},settled:true,exposed:false,search:false,escaped:false};}
    function access(st){const p=sites(st).find(p=>p.id===st.recovery.selected);return {...p,available:st.recovery.settled};}
    function reroute(a,route,cruise){a.route=[[a.ship.x,a.ship.y],...route.map(p=>p.slice())];a.waypoint=0;a.cruise=cruise;}
    function select(st,id){
        if(st.mission.team==='recovered'||!sites(st).some(p=>p.id===id))return false;
        if(st.recovery.selected!==id){st.recovery.selected=id;st.recovery.settled=false;st.mission.ordered=false;st.mission.board=0;}
        return true;
    }
    function step(st,dt){
        const r=st.recovery,m=st.mission,c=st.config.extraction;
        if(!r.exposed&&st.time>=c.exposeAt){r.exposed=true;for(const a of st.actors)if(a.exposureRoute)reroute(a,a.exposureRoute,1.45);}
        if(m.team==='recovered'){
            if(!r.search){r.search=true;for(const a of st.actors)if(a.returnRoute)reroute(a,a.returnRoute,1.6);st.notice='TEAM ABOARD · patrols are spreading west. Change your return approach.';st.noticeUntil=st.time+10;}
            if(st.player.x<310&&m.suspicion<20)r.escaped=true;
            return;
        }
        const p=access(st),b=r.beacon,dx=p.x-b.x,dy=p.y-b.y,d=Math.hypot(dx,dy),v=c.walkSpeed;
        r.settled=d<2;
        const old={x:b.x,y:b.y};
        if(r.settled){b.x=p.x;b.y=p.y;}else{b.x+=dx/(d||1)*Math.min(d,v*dt);b.y+=dy/(d||1)*Math.min(d,v*dt);}
        b.vx=(b.x-old.x)/dt;b.vy=(b.y-old.y)/dt;
    }
    function progress(st){return [st.mission.team==='recovered',st.recovery.escaped,st.mission.secured];}
    function message(st){const r=st.recovery,p=access(st),d=Math.hypot(p.x-r.beacon.x,p.y-r.beacon.y);
        if(st.mission.team==='recovered')return 'Team aboard. Avoid the redeployed patrols and regain quiet home water.';
        if(!r.settled)return `TEAM RELOCATING TO ${p.name.toUpperCase()} · about ${Math.ceil(d/st.config.extraction.walkSpeed)} s. The rendezvous keeps drifting.`;
        if(st.mission.ordered)return `RECOVERY ${st.mission.board.toFixed(1)} / ${p.hold} s · match the beacon’s drift at ${p.depth} m`;
        return `${p.name.toUpperCase()} · team waiting at ${p.depth} m. ${r.exposed?'Shelter gap exposed; patrols approaching.':'Shelter cover opening in '+Math.max(0,Math.ceil(st.config.extraction.exposeAt-st.time))+' s.'}`;
    }
    const api={sites,create,access,select,step,progress,message};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.PaleReachRecovery=api;
})(globalThis);
