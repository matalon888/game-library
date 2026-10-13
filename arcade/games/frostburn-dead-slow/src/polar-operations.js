/* Bridge-level towing, patrols and deliberate surface combat. Metres / seconds. */
(function(root){
    'use strict';
    const P=typeof module!=='undefined'&&module.exports?require('./physics.js'):root.HarborPhysics;
    const G=typeof module!=='undefined'&&module.exports?require('./polar-grid.js'):root.PaleReachGrid;
    const speed=s=>Math.hypot(s.vx,s.vy),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
    const gun=c=>({...c,solution:0,cooldown:0,target:null,ammo:c.ammo??999,reason:'Select a hostile contact'});
    function create(level){
        const c=level.polar;if(!['survey','defense','strike','rescue','transit'].includes(c.mission))return null;
        const entity=(n,team)=>({...n,team,active:!!n.cutter||team==='patrol'||n.spawn===0,waypoint:0,planAt:0,route:n.route?.map(p=>p.slice()),ship:P.ship(...n.start,{...n.spec,id:n.id,name:n.name,required:false,hostile:team==='hostile',hull:team==='hostile'?72:100,maxHull:team==='hostile'?72:100}),gun:team==='hostile'&&!n.cutter?gun({range:215,arc:.95,hold:3.5,reload:18,damage:18,shellSpeed:48,maxSpeed:.9,maxTurn:.025}):null});
        const assets=(c.assets||[]).map(a=>({...a,active:true,fixed:true,poly:P.rect(a),ship:P.ship(a.x+a.w/2,a.y+a.h/2,a.a||0,{id:a.id,name:a.name,length:a.w,beam:a.h,mass:1e6,hull:a.hp,maxHull:a.hp,moored:true}),gun:a.gun?gun(a.gun):null}));
        const crossfire=(c.crossfire||[]).map(n=>({...entity({...n,spawn:0},n.team),crossfire:true,gun:gun({range:560,arc:.5,hold:8,reload:38,damage:12,shellSpeed:42,maxSpeed:.2,maxTurn:.02}),ship:P.ship(...n.start,{...n.spec,id:n.id,name:n.name,required:false,hull:600,maxHull:600})}));
        return {kind:c.mission,assets,npcs:[...(c.patrols||[]).map(n=>entity(n,'patrol')),...(c.raiders||[]).map(n=>entity(n,'hostile')),...(c.cutters||[]).map(n=>entity({...n,cutter:true,status:'HOLDING'},n.team)),...crossfire],
            survey:c.survey?{...c.survey,ship:P.ship(...c.survey.start,{...c.survey.spec,id:c.survey.id,name:c.survey.name,required:true}),recorders:0,recovered:false,safeNow:false}:null,
            line:null,gun:c.gun?gun(c.gun):null,shells:[],bursts:[],alarmAt:null,warning:'',serial:0};
    }
    function bodies(st){const o=st.operation;return o?[...o.npcs.filter(n=>n.active).map(n=>n.ship),...(o.survey?[o.survey.ship]:[])]:[];}
    function targets(st){const o=st.operation;return !o?[]:[...o.assets,...o.npcs.filter(n=>n.active)].filter(n=>n.team==='hostile'&&n.ship.hull>0);}
    function allEntities(st){
        const o=st.operation;
        return [{id:'player',team:'friendly',ship:st.player},...st.fleet.map(f=>({id:f.id,team:'friendly',ship:f.ship,escaped:f.returned})),...o.assets,...o.npcs.filter(n=>n.active),...(o.survey?[{...o.survey,team:'civilian'}]:[])];
    }
    function segmentHit(a,b,poly){
        if(poly.every((p,i)=>{const q=poly[(i+1)%poly.length];return (q.x-p.x)*(a.y-p.y)-(q.y-p.y)*(a.x-p.x)>=0;}))return 0;
        const dx=b.x-a.x,dy=b.y-a.y;let first=Infinity;
        for(let i=0;i<poly.length;i++){
            const p=poly[i],q=poly[(i+1)%poly.length],ex=q.x-p.x,ey=q.y-p.y,den=dx*ey-dy*ex;if(Math.abs(den)<1e-10)continue;
            const px=p.x-a.x,py=p.y-a.y,t=(px*ey-py*ex)/den,u=(px*dy-py*dx)/den;
            if(t>=0&&t<=1&&u>=0&&u<=1)first=Math.min(first,t);
        }
        return first;
    }
    function solution(st,source,target,g){
        if(!target||target.ship.hull<=0)return {ok:false,reason:'Select a hostile contact'};
        const s=source.ship,t=target.ship,d=distance(s,t),flight=d/g.shellSpeed,aim={x:t.x+t.vx*flight,y:t.y+t.vy*flight};
        if(d>g.range)return {ok:false,reason:'Out of range'};
        if(d<25)return {ok:false,reason:'Too close for the gun'};
        if(Math.abs(P.wrap(Math.atan2(aim.y-s.y,aim.x-s.x)-s.a))>g.arc)return {ok:false,reason:'Outside the forward arc'};
        if(speed(s)>(g.maxSpeed??.1)||Math.abs(s.r)>(g.maxTurn??.001))return {ok:false,reason:'Slow and steady the hull'};
        const muzzle=P.localPoint(s,s.length*.55,0);
        if(sheetHit(st,muzzle,aim)<1)return {ok:false,reason:'Intact sheet / pressure ridge blocks the shot'};
        for(const e of allEntities(st))if(e.id!==source.id&&e.id!==target.id&&segmentHit(muzzle,aim,e.poly||P.hull(e.ship))<1)return {ok:false,reason:e.team==='friendly'||e.team==='civilian'?'Friendly hull / installation in the firing line':'Firing line obstructed'};
        for(const b of [...st.bergs,...st.floes])if(segmentHit(muzzle,aim,P.hull(b))<1)return {ok:false,reason:'Solid drifting ice blocks the shot'};
        for(const d of st.config.docks)if(segmentHit(muzzle,aim,P.rect(d))<1)return {ok:false,reason:'Jetty blocks the shot'};
        return {ok:true,reason:'Stable firing solution',aim,muzzle};
    }
    // Walk short bounding boxes along the ray, including grazed hex corners.
    // This visits a narrow strip, not the whole diagonal bounding rectangle.
    function sheetHit(st,a,b){
        const g=st.ice,dx=b.x-a.x,dy=b.y-a.y,count=Math.max(1,Math.ceil(Math.hypot(dx,dy)/g.cell)),seen=new Set();let first=Infinity;
        for(let i=0;i<count&&first>i/count;i++){
            const p={x:a.x+dx*i/count,y:a.y+dy*i/count},q={x:a.x+dx*(i+1)/count,y:a.y+dy*(i+1)/count};
            G.each(g,{minX:Math.min(p.x,q.x),minY:Math.min(p.y,q.y),maxX:Math.max(p.x,q.x),maxY:Math.max(p.y,q.y)},(k,tile)=>{
                if(seen.has(k))return;seen.add(k);
                if(g.thickness[k]>0&&g.opened[k]<0)first=Math.min(first,segmentHit(a,b,tile.poly));
            });
        }
        return first;
    }
    function launch(st,source,target,g){
        if(g.solution<g.hold||g.cooldown>0||g.ammo<=0)return false;
        const aim=solution(st,source,target,g);if(!aim.ok)return false;
        const dx=aim.aim.x-aim.muzzle.x,dy=aim.aim.y-aim.muzzle.y,d=Math.hypot(dx,dy);
        st.operation.shells.push({id:++st.operation.serial,source:source.id,team:source.team,x:aim.muzzle.x,y:aim.muzzle.y,vx:dx/d*g.shellSpeed,vy:dy/d*g.shellSpeed,life:g.range/g.shellSpeed+.5,damage:g.damage,aim:aim.aim});
        g.ammo--;g.solution=0;g.cooldown=g.reload;
        if(source.id==='player'){st.stats.shots++;st.operation.alarmAt??=st.time;P.impulseAt(source.ship,aim.muzzle,{x:-dx/d*.18,y:-dy/d*.18});}
        return true;
    }
    function action(run,name,value){
        const st=run.polar,o=st.operation;if(!o)return false;st.player=run.ship;
        if(name==='tow'&&o.survey){
            if(o.line){o.line=null;st.notice='Towline released. '+o.survey.name+' is still moving.';st.noticeUntil=st.time+4;return true;}
            const s=run.ship,t=o.survey.ship,ends=P.towEndpoints(s,t),d=distance(ends.a,ends.b);
            const blocked=[...o.assets.map(a=>a.poly),...st.bergs.map(b=>P.hull(b))].some(poly=>P.segmentHitsPoly(ends.a,ends.b,poly));
            if(d>55||Math.hypot(s.vx-t.vx,s.vy-t.vy)>.7||blocked){st.notice='Towline: bring stern and '+o.survey.name+' bow within 55 m, slow together, and clear the line.';st.noticeUntil=st.time+4;return false;}
            o.line={length:P.clamp(d+2,18,65),strength:2.2,tension:0,overload:0};st.stats.orders++;return true;
        }
        if(!o.gun)return false;
        if(name==='target'){
            const list=targets(st),target=value?list.find(t=>t.id===value):list[(list.findIndex(t=>t.id===o.gun.target)+1)%list.length];
            if(!target)return false;o.gun.target=target.id;o.gun.solution=0;return true;
        }
        if(name==='fire')return launch(st,{id:'player',team:'friendly',ship:run.ship},targets(st).find(t=>t.id===o.gun.target),o.gun);
        return false;
    }
    function before(st,run,input,dt){
        const o=st.operation;if(!o)return;
        if(o.line){
            o.line.length=P.clamp(o.line.length+(input.winch||0)*4*dt,18,65);
            const f=P.towForce(run.ship,o.survey.ship,o.line,dt);o.line.tension=f.force/o.line.strength;
            o.line.overload=o.line.tension>1?o.line.overload+dt:Math.max(0,o.line.overload-dt);
            const fouled=[...o.assets.map(a=>a.poly),...st.bergs.map(b=>P.hull(b)),...st.floes.map(b=>P.hull(b))].some(poly=>P.segmentHitsPoly(f.a,f.b,poly));
            o.line.chafe=fouled?(o.line.chafe||0)+dt:0;
            if(o.line.overload>1.5||f.distance>110||o.line.chafe>.5){o.line=null;st.stats.towBreaks++;st.notice=fouled?'Towline fouled and parted. Clear the obstruction before reconnecting.':'Towline parted. Slow both hulls before reconnecting.';st.noticeUntil=st.time+6;}
        }
    }
    function move(st,run,dt,I){
        const o=st.operation;if(!o)return;o.warning='';
        if(o.survey){P.integrate(o.survey.ship,{}, {current:{x:0,y:0}},dt);I.iceContact(st,o.survey.ship,dt);}
        for(const n of o.npcs){
            if(!n.active){
                const due=n.alarmDelay!==undefined?o.alarmAt!==null&&st.time>=o.alarmAt+n.alarmDelay:st.time>=(n.spawn??0);
                if(due&&[run.ship,...st.fleet.map(f=>f.ship),...bodies(st)].every(s=>distance(s,n.ship)>(s.length+n.ship.length)/2+8))n.active=true;else continue;
            }
            const s=n.ship;let control;
            if(s.hull<=0||s.disabled){s.disabled=true;s.throttle=0;n.status='DISABLED';control={input:{}};}
            else if(n.cutter){
                let hold=st.time<(n.depart||0)||n.finished;n.status=hold?'HOLDING':'CUTTING LEAD';
                const axis=P.axes(s);
                for(const other of [run.ship,...st.fleet.map(f=>f.ship),...bodies(st),...st.bergs,...st.floes]){
                    if(other===s)continue;
                    const delta={x:other.x-s.x,y:other.y-s.y},ahead=P.dot(delta,axis.f),side=Math.abs(P.dot(delta,axis.n));
                    if(ahead>0&&ahead<(s.length+other.length)/2+speed(s)**2/.12+9&&side<(s.beam+other.beam)/2+6){hold=true;n.status='TRAFFIC · BRAKING';break;}
                }
                control=I.pilot(s,n.route,n.waypoint,n.cruise,hold,35);n.waypoint=control.waypoint;
                if(control.arrived&&!hold){n.finished=true;n.status='LEAD COMPLETE';}
                else if(n.finished)n.status='LEAD COMPLETE';
            }else if(n.crossfire){
                const opponent=o.npcs.find(a=>a.id===n.opponent&&a.ship.hull>0);
                n.gun.target=opponent?.id;s.throttle=0;
                const error=opponent?P.wrap(Math.atan2(opponent.ship.y-s.y,opponent.ship.x-s.x)-s.a):0;
                control={input:{rudder:0,thruster:P.clamp(error*2.5-s.r*35,-1,1)}};
            }else if(n.team==='patrol'){
                control=I.pilot(s,n.route,n.waypoint,n.cruise);n.waypoint=control.waypoint;
                if(control.arrived){n.route.reverse();n.waypoint=0;}
                if(distance(s,run.ship)<180)o.warning=n.name+': ALTER COURSE. EXCLUSION BUOYS ARE BEING LAID. Weapons restricted.';
            }else{
                const vulnerable=allEntities(st).filter(e=>e.team==='friendly'&&e.ship.hull>0&&!e.escaped);
                const cargo=vulnerable.filter(e=>st.fleet.some(f=>f.id===e.id&&!f.returned));
                const victim=(cargo.length?cargo:vulnerable).sort((a,b)=>distance(s,a.ship)-distance(s,b.ship))[0];
                if(n.gun.target!==victim?.id)n.gun.solution=0;
                n.gun.target=victim?.id;
                if(!victim){s.throttle=0;control={input:{}};}
                else if(distance(s,victim.ship)<n.gun.range*.82){control=I.pilot(s,[[victim.ship.x,victim.ship.y]],0,0,false);}
                else{
                    if(st.time>=n.planAt){const planned=I.waterRoute(st,s,[victim.ship.x,victim.ship.y]);if(planned){n.navigation=planned;n.waypoint=0;}n.planAt=st.time+5;}
                    const route=n.navigation||[[s.x,s.y],[victim.ship.x,victim.ship.y]];
                    const stopping=speed(s)**2/.12+10,blocked=I.clearance(st,s,stopping)<stopping;
                    control=I.pilot(s,route,n.waypoint,n.navigation&&!blocked?n.cruise:0,false,24);n.waypoint=control.waypoint;
                }
            }
            P.integrate(s,control.input,{current:{x:0,y:0}},dt);I.iceContact(st,s,dt);
        }
    }
    function assetContacts(st,s,I){
        if(!st.operation)return;
        for(const a of st.operation.assets){
            const hit=P.contact(s,{poly:a.poly});I.impact(st,s,'asset-'+a.id+'-'+s.name,hit);
            if(hit&&hit.impact>.25){const damage=(hit.impact-.2)**2*2.4;a.ship.hull=Math.max(0,a.ship.hull-damage);if(a.team==='civilian')st.failure='The civilian monitoring station was damaged. Keep the tow and your stern clear.';}
        }
    }
    function after(st,run,dt){
        const o=st.operation;if(!o)return;
        if(o.survey){
            const t=o.survey,s=t.ship,close=distance(run.ship,s)<65&&Math.hypot(run.ship.vx-s.vx,run.ship.vy-s.vy)<.5;
            if(o.kind==='survey'&&!t.recovered){t.recorders=close?t.recorders+dt:Math.max(0,t.recorders-dt*.5);if(t.recorders>=8){t.recovered=true;st.stats.recorders=1;}}
            const e=t.safe;t.safeNow=P.hull(s).every(p=>((p.x-e.x)/e.rx)**2+((p.y-e.y)/e.ry)**2<=1)&&speed(s)<.45;
            if(t.pocket)t.safeNow&&=P.hull(s).every(p=>((p.x-t.pocket.x)/t.pocket.rx)**2+((p.y-t.pocket.y)/t.pocket.ry)**2>1);
        }
        if(o.kind==='rescue')for(const f of st.fleet){
            if(!f.rescued){const close=distance(run.ship,f.ship)<st.config.rescue.contactRange&&speed(run.ship)<1;
                f.rescueContact=close?f.rescueContact+dt:Math.max(0,f.rescueContact-dt);
                if(f.rescueContact>0)f.waiting=`Rescue contact ${f.rescueContact.toFixed(1)} / ${st.config.rescue.hold} s`;
                if(f.rescueContact>=st.config.rescue.hold){f.rescued=true;st.notice=f.name+': rescue contact established. Awaiting Proceed through cleared water.';st.noticeUntil=st.time+8;}
            }
        }
        const entities=allEntities(st),player={id:'player',team:'friendly',ship:run.ship};
        const guns=[...(o.gun?[{...player,gun:o.gun}]:[]),...o.npcs.filter(n=>n.active&&n.gun),...o.assets.filter(a=>a.gun)];
        for(const source of guns){
            const g=source.gun;g.cooldown=Math.max(0,g.cooldown-dt);
            if(source.ship.hull<=0||source.ship.disabled){g.solution=0;continue;}
            if(source.fixed)g.target='player';
            const target=entities.find(e=>e.id===g.target&&e.ship.hull>0&&!e.escaped);
            if(!source.crossfire||st.time>=(g.checkAt||0)){g.cachedAim=solution(st,source,target,g);g.checkAt=st.time+.25;}
            const aim=g.cachedAim;
            g.reason=g.ammo<=0?'Ammunition expended':g.cooldown>0?'Reloading':aim.reason;g.aim=aim.aim;
            g.solution=aim.ok&&g.cooldown===0?Math.min(g.hold,g.solution+dt):Math.max(0,g.solution-dt*3);
            if(source.id!=='player')launch(st,source,target,g);
        }
        for(const shot of o.shells){
            const a={x:shot.x,y:shot.y},b={x:shot.x+shot.vx*dt,y:shot.y+shot.vy*dt};let hit=null,fraction=Infinity;
            for(const e of entities)if(e.id!==shot.source){const f=segmentHit(a,b,e.poly||P.hull(e.ship));if(f<fraction){fraction=f;hit=e;}}
            for(const solid of [...st.bergs,...st.floes,...st.config.docks]){const f=segmentHit(a,b,solid.w?P.rect(solid):P.hull(solid));if(f<fraction){fraction=f;hit={team:'ice'};}}
            const sheet=sheetHit(st,a,b);if(sheet<fraction){fraction=sheet;hit={team:'ice'};}
            shot.x=b.x;shot.y=b.y;shot.life-=dt;
            if(hit){
                shot.life=0;o.bursts.push({x:a.x+(b.x-a.x)*fraction,y:a.y+(b.y-a.y)*fraction,until:st.time+1.4});
                if(hit.ship){
                    const old=hit.ship.hull;hit.ship.hull=Math.max(0,old-shot.damage);
                    if(hit.team==='friendly'||hit.team==='civilian')st.stats.damageTaken+=Math.min(old,shot.damage);
                    else if(hit.team==='hostile'&&old>0&&hit.ship.hull===0)st.stats.hostilesDisabled++;
                    if(hit.team==='civilian'&&hit.fixed)st.failure='The civilian monitoring station was hit.';
                }
            }
        }
        o.shells=o.shells.filter(s=>s.life>0);o.bursts=o.bursts.filter(b=>b.until>st.time);
        for(const a of o.assets)if(a.essential&&a.ship.hull<=0)st.failure='The supply base was lost before its essential cargo and transports were secured.';
        for(const s of [run.ship,...st.fleet.map(f=>f.ship),...(o.survey?[o.survey.ship]:[])])if(s.hull<=0)st.failure=s.name+' lost. Every required crew must come home.';
    }
    function ready(st){const o=st.operation;if(!o)return false;return o.kind==='rescue'?o.survey.safeNow&&st.fleet.every(f=>f.rescued&&f.returned):o.kind==='transit'?st.fleet.every(f=>f.returned):o.kind==='survey'?o.survey.recovered&&o.survey.safeNow:o.kind==='defense'?st.fleet.every(f=>f.unloaded&&f.returned):o.assets.filter(a=>a.team==='hostile').every(a=>a.ship.hull<=0);}
    function progress(st){const o=st.operation;return o.kind==='rescue'?[...st.fleet.map(f=>f.returned),o.survey.safeNow,st.complete]:o.kind==='transit'?[false,false,false,false,false,st.complete]:o.kind==='survey'?[o.survey.recovered,o.survey.safeNow,st.complete]:o.kind==='defense'?[st.fleet.every(f=>f.unloaded),st.fleet.every(f=>f.returned)]:[o.assets.find(a=>a.id==='battery').ship.hull<=0,o.assets.find(a=>a.id==='fuel').ship.hull<=0,st.complete];}
    function message(st){const o=st.operation;
        if(o.warning)return o.warning;
        if(o.kind==='rescue')return `${st.fleet.filter(f=>f.rescued).length}/3 GROUPS CONTACTED · ${st.stats.safeReturns}/3 SAFE · ORIEL ${o.survey.safeNow?'IN REFUGE':o.line?'UNDER TOW':'BLOCKING THE TURNING POCKET'}. No kills count toward rescue.`;
        if(o.kind==='transit')return `${st.stats.safeReturns}/3 RELIEF SHIPS THROUGH · reopen the aging wake and keep stopping room.`;
        if(o.kind==='survey')return !o.survey.recovered?`RECORDER TRANSFER ${Math.floor(o.survey.recorders)} / 8 s · hold within 65 m with little relative motion`:o.survey.safeNow?'Caliper and her recorders are safe. Moor Kestrel.':o.line?`TOW CONNECTED · ${Math.round(o.line.tension*100)}% tension · allow room for Caliper’s stern`:'Recorders aboard · connect the tow and bring Caliper home.';
        if(o.kind==='defense')return `${st.stats.deliveries}/2 cargoes ashore · ${st.stats.safeReturns}/2 transports safe. Give Proceed after unloading.`;
        return ready(st)?'Both military installations disabled. Withdraw to the green home berth.':'Disable the battery and fuel-transfer machinery; plan your exit before firing.';
    }
    const api={create,bodies,targets,action,before,move,assetContacts,after,ready,progress,message,solution,segmentHit,sheetHit};
    if(typeof module!=='undefined'&&module.exports)module.exports=api;root.PaleReachOperations=api;
})(globalThis);
