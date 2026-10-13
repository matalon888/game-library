/* Deterministic surface ice and convoy simulation. No rendering or wall clock. */
(function(root){
    'use strict';
    const P=typeof module!=='undefined'&&module.exports?require('./physics.js'):root.HarborPhysics;
    const G=typeof module!=='undefined'&&module.exports?require('./polar-grid.js'):root.PaleReachGrid;
    const O=typeof module!=='undefined'&&module.exports?require('./polar-operations.js'):root.PaleReachOperations;
    const U=typeof module!=='undefined'&&module.exports?require('./submarine.js'):root.PaleReachSubmarine;
    const F=typeof module!=='undefined'&&module.exports?require('./polar-finale.js'):root.PaleReachFinale;
    const clamp=P.clamp, speed=s=>Math.hypot(s.vx,s.vy);
    function segmentDistance(x,y,a,b){
        const dx=b[0]-a[0],dy=b[1]-a[1],t=clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1),0,1);
        return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);
    }
    function routeDistance(x,y,route){let d=Infinity;for(let i=1;i<route.length;i++)d=Math.min(d,segmentDistance(x,y,route[i-1],route[i]));return d;}
    const inside=(x,y,e)=>((x-e.x)/e.rx)**2+((y-e.y)/e.ry)**2<=1;
    function create(level){
        if(level.polar.finale)return F.create(level,api);
        if(level.polar.underwater)return U.create(level);
        const c=level.polar,grid=G.create(...level.world,c.cell),count=grid.tiles.length;
        const ice={...grid,thickness:new Float32Array(count),opened:new Float64Array(count).fill(-1),closing:new Float32Array(count),revision:0};
        for(let k=0;k<count;k++){
            const {x,y}=ice.tiles[k];
            let thickness=c.thickness,closing=c.closing;
            if(routeDistance(x,y,c.route)<c.thinWidth/2)thickness=c.thinIce;
            if(c.secondary&&routeDistance(x,y,c.secondary.route)<c.secondary.width/2){thickness=c.secondary.thickness;closing=c.secondary.closing;}
            for(const cutter of c.cutters||[])if(routeDistance(x,y,cutter.route)<cutter.width/2)thickness=cutter.thickness;
            for(const patch of c.patches||[])if(G.contains(patch,x,y))thickness=patch.thickness;
            if(c.water.some(e=>G.contains(e,x,y))||[...(c.openWaterRoutes||[]),...(c.patrolWater||[])].some(r=>routeDistance(x,y,r.route)<r.width/2))thickness=0;
            if(c.ridges.some(r=>G.contains(r,x,y)))thickness=2;
            ice.thickness[k]=thickness;ice.closing[k]=closing;
        }
        const ship=P.ship(...level.start,level.spec);
        const fleet=(c.fleet||[]).map(f=>({...f,ship:P.ship(...f.start,f.spec),leg:f.evacuating?'return':f.unloading?'unloading':'outbound',order:f.leader?'proceed':'hold',waypoint:0,unloaded:!!f.evacuating,rescueContact:0,rescued:c.mission!=='rescue',unloadProgress:0,returned:false,waiting:f.unloading?`Unloading 0 / ${f.unload} s`:'Holding in safe water',input:{rudder:0,thruster:0}}));
        const bergs=(c.bergs||[]).map(b=>P.ship(b.x,b.y,0,{...b,mass:80,hull:100,vessel:'iceberg'}));
        const pocket=[];
        if(c.pocket)for(let k=0;k<ice.thickness.length;k++){
            const {x,y}=ice.tiles[k];
            if(inside(x,y,c.pocket))pocket.push(k);
        }
        return {ship,polar:{level,config:c,ice,fleet,bergs,operation:O.create(level),floes:[],pendingFloes:[],pocket,time:0,broken:0,contacts:0,damage:0,slush:0,
            routeOpened:false,notice:'Read the ice before committing your bow.',lastHits:{},failure:null,complete:false,
            stats:{sheetArea:0,slushCleared:0,deliveries:0,safeReturns:0,orders:0,shots:0,hostilesDisabled:0,recorders:0,towBreaks:0,damageTaken:0},checkpoint:0},dock:P.docking(ship,level.berth,false)};
    }
    const indexAt=G.indexAt;
    function slushAt(st,k){return k<0||st.ice.opened[k]<0?0:clamp((st.time-st.ice.opened[k]-20)/(st.ice.closing[k]*(st.weatherFactor||1)),0,.96);}
    function solidAt(st,x,y){const k=indexAt(st.ice,x,y);return k>=0&&st.ice.thickness[k]>0&&st.ice.opened[k]<0;}
    function impact(st,s,id,hit,record=s.required!==false){
        if(!hit||hit.impact<.24||st.time-(st.lastHits[id]??-100)<1.2)return;
        st.lastHits[id]=st.time;
        const damage=Math.max(.25,(hit.impact-.2)**2*2.4);s.hull=Math.max(0,s.hull-damage);
        if(record){st.contacts++;st.damage+=damage;}
    }
    function iceContact(st,s,dt){
        // The pressure bow fractures a narrow shoulder beside the hull as it advances.
        const g=st.ice,poly=P.hull(s),fracture=s.iceClass?P.hull({...s,beam:s.beam+18}):poly,f=P.axes(s).f;
        let slush=0,samples=0;
        G.each(g,P.bounds(fracture),(k,tile)=>{
            const {x,y}=tile;
            if(!g.thickness[k])return;
            const hit=P.sat(fracture,tile.poly);if(!hit)return;
            if(g.opened[k]>=0){
                const density=slushAt(st,k);if(P.sat(poly,tile.poly)){slush+=density;samples++;}
                if(s.iceClass&&density>.015){g.opened[k]=st.time;st.stats.slushCleared+=density*dt;}
                return;
            }
            const forward=s.vx*f.x+s.vy*f.y;
            const bow=(x-s.x)*f.x+(y-s.y)*f.y;
            // A suitable bow approach is required; broadside or stern-first contact cannot carve.
            if(s.iceClass&&g.thickness[k]<1&&forward>=.8+g.thickness[k]*1.5&&bow>0&&-P.dot(f,hit.normal)>.08){
                g.opened[k]=st.time;g.revision++;st.broken++;st.stats.sheetArea+=g.area;
                const loss=1-.045*g.thickness[k];s.vx*=loss;s.vy*=loss;
                if(st.config.fragments&&st.floes.length+st.pendingFloes.length<st.config.fragments&&x>=(st.config.fragmentFromX||0)&&st.broken%4===0)
                    st.pendingFloes.push({x,y,k});
            }else{
                const collision=P.contact(s,tile);
                impact(st,s,'ice-'+(s.name||'ship'),collision);
                if(s===st.player&&collision){st.notice=g.thickness[k]>=1?'PRESSURE RIDGE · take the thin dogleg':s.iceClass?'Back off, build momentum, meet the sheet bow first.':'Intact sheet · this hull needs an opened channel.';st.noticeUntil=st.time+3;}
            }
        });
        const density=samples?slush/samples:0;
        // Slush is a continuous resistance field, never a newly materialized collider.
        const resistance=(s.iceClass ? .06 : .13)*density;
        s.vx*=Math.exp(-resistance*dt);s.vy*=Math.exp(-resistance*dt);s.r*=Math.exp(-density*.11*dt);
        return density;
    }
    function clearance(st,s,distance){
        const f=P.axes(s).f,n=P.axes(s).n;
        for(let d=s.length/2;d<distance+s.length/2;d+=6)
            for(const side of [-.55,0,.55])if(solidAt(st,s.x+f.x*d+n.x*s.beam*side,s.y+f.y*d+n.y*s.beam*side))return Math.max(0,d-s.length/2);
        return distance;
    }
    /* Captains issue the same throttle/rudder/thruster orders as the player.
       Neither the route follower nor Hold writes position or zeroes velocity. */
    function pilot(s,route,waypoint=0,cruise=2.3,hold=false,lookAhead=40){
        let i=waypoint;
        while(i<route.length-1&&Math.hypot(s.x-route[i][0],s.y-route[i][1])<Math.min(26,lookAhead))i++;
        const goal=route[i],distance=Math.hypot(goal[0]-s.x,goal[1]-s.y),last=i===route.length-1;
        let aim=goal;
        // Look along the route before a bend instead of turning only at a waypoint.
        if(i>0&&distance<70){
            const a=route[i-1],dx=goal[0]-a[0],dy=goal[1]-a[1],length=Math.hypot(dx,dy),t=clamp(((s.x-a[0])*dx+(s.y-a[1])*dy)/(length*length||1),0,1);
            let remaining=lookAhead,point=[a[0]+dx*t,a[1]+dy*t];
            for(let j=i;j<route.length;j++){const b=route[j],d=Math.hypot(b[0]-point[0],b[1]-point[1]);if(d>=remaining){aim=[point[0]+(b[0]-point[0])*remaining/d,point[1]+(b[1]-point[1])*remaining/d];break;}remaining-=d;point=b;aim=b;}
        }
        const dx=aim[0]-s.x,dy=aim[1]-s.y;
        const motion=P.groundMotion(s),error=P.wrap(Math.atan2(dy,dx)-s.a);
        let desired=hold?0:Math.min(cruise,last?Math.sqrt(Math.max(0,distance-7)*.12):cruise);
        if(Math.abs(error)>.6)desired=Math.min(desired,.85);
        if(Math.abs(error)>2.2||Math.abs(error)>1.15&&speed(s)<.4)s.pilotTurning=true;
        if(Math.abs(error)<.15)s.pilotTurning=false;
        if(s.pilotTurning)desired=0;
        if(last&&distance<8)desired=0;
        const demand=(desired-motion.surge)*2.8+desired*.1;
        s.throttle=demand>.9?4:demand>.42?3:demand>.13?2:demand>.025?1:demand<-.6?-3:demand<-.2?-2:demand<-.025?-1:0;
        if(desired===0&&speed(s)<.08)s.throttle=0;
        const steer=hold||last&&distance<8?clamp(-s.r*40,-1,1):clamp(error*2.5-s.r*35,-1,1);
        return {waypoint:i,distance,arrived:last&&distance<16&&speed(s)<.24,input:{rudder:steer,thruster:steer}};
    }
    function command(run,id,order){
        const st=run.polar,f=st.fleet.find(f=>f.id===id&&!f.leader);
        if(!f||f.returned||!['hold','proceed'].includes(order))return false;
        if(order==='proceed'&&!f.rescued){st.notice='Establish rescue contact first: hold within 72 m below 1.9 kn for four seconds.';st.noticeUntil=st.time+6;return false;}
        if(f.order===order)return true;
        f.order=order;st.stats.orders++;st.noticeUntil=st.time+4;st.notice=f.ship.name+': '+(order==='hold'?'braking to hold; allow stopping room.':'proceeding on the marked route.');
        return true;
    }
    // Route requests are destination orders. Captains use the water actually cut,
    // with beam clearance, instead of insisting on an exact painted centreline.
    function waterRoute(st,s,goal){
        const g=st.ice,start=indexAt(g,s.x,s.y),end=indexAt(g,...goal);
        if(start<0||end<0)return null;
        const available=new Int8Array(g.thickness.length),margin=s.beam/2+3;
        function open(k){
            if(k<0||k>=available.length)return false;
            if(available[k])return available[k]===1;
            const {x,y}=g.tiles[k];
            let ok=x>margin&&y>margin&&x<g.width-margin&&y<g.height-margin;
            for(const [dx,dy] of [[0,0],[-margin,0],[margin,0],[0,-margin],[0,margin],[-margin*.7,-margin*.7],[margin*.7,-margin*.7],[-margin*.7,margin*.7],[margin*.7,margin*.7]])if(solidAt(st,x+dx,y+dy))ok=false;
            available[k]=ok?1:-1;return ok;
        }
        if(!open(start)||!open(end))return null;
        const queue=[start],prev=new Int32Array(available.length).fill(-1);prev[start]=start;
        for(let head=0;head<queue.length&&prev[end]<0;head++){
            const k=queue[head];
            for(const n of G.neighbors(g,k)){
                if(prev[n]>=0||!open(n))continue;
                prev[n]=k;queue.push(n);
            }
        }
        if(prev[end]<0)return null;
        const cells=[];for(let k=end;k!==start;k=prev[k])cells.push([g.tiles[k].x,g.tiles[k].y]);
        const points=[[s.x,s.y],...cells.reverse(),goal],route=[points[0]];
        function visible(a,b){
            const dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy),nx=-dy/(d||1)*margin,ny=dx/(d||1)*margin;
            for(let t=0;t<=d;t+=3)for(const side of [-1,0,1])if(solidAt(st,a[0]+dx*t/(d||1)+nx*side,a[1]+dy*t/(d||1)+ny*side))return false;
            return true;
        }
        for(let a=0;a<points.length-1;){let b=a+1;while(b+1<points.length&&visible(points[a],points[b+1]))b++;route.push(points[b]);a=b;}
        return route;
    }
    function fleetStep(st,dt){
        for(const f of st.fleet){
            const s=f.ship,requested=f.leg==='return'?f.home:f.route;
            if(!f.leader&&(f.navLeg!==f.leg||st.time>=(f.planAt||0))){
                if(f.navLeg!==f.leg)f.navigation=null;
                const planned=waterRoute(st,s,requested.at(-1));
                if(planned){f.navigation=planned;f.waypoint=0;}
                f.navLeg=f.leg;f.planAt=st.time+15;
            }
            const route=f.leader?requested:f.navigation||requested;
            let hold=f.order==='hold'||f.returned||f.leg==='unloading',reason=hold?'Braking / holding':'';
            if(!f.leader&&!f.navigation){hold=true;reason='No connected channel · waiting for Kestrel';}
            if(!s.iceClass&&!hold){
                const stopping=Math.min(24,speed(s)**2/.12+8),clear=clearance(st,s,stopping);
                if(clear<stopping){hold=true;reason='Intact sheet ahead · waiting for Kestrel';}
            }
            if(!hold)for(const other of [st.player,...st.fleet.filter(o=>o!==f).map(o=>o.ship),...st.bergs,...st.floes]){
                const delta={x:other.x-s.x,y:other.y-s.y},axis=P.axes(s),ahead=P.dot(delta,axis.f),side=Math.abs(P.dot(delta,axis.n));
                if(ahead>0&&ahead<(s.length+other.length)/2+speed(s)**2/.12+9&&side<(s.beam+other.beam)/2+6){hold=true;reason=other.vessel==='iceberg'?'Iceberg crossing · braking':'Traffic ahead · braking';break;}
            }
            const bow=P.axes(s).f,k=indexAt(st.ice,s.x+bow.x*(s.length/2+12),s.y+bow.y*(s.length/2+12));
            const compressed=f.leader&&k>=0&&st.ice.opened[k]<0&&st.ice.thickness[k]>.5;
            const control=pilot(s,route,f.waypoint,compressed?Math.min(f.cruise,2):f.cruise,hold,f.leader?40:20);
            if(hold&&f.order==='proceed'&&!f.returned&&f.leg!=='unloading'&&f.navigation){
                const turn=pilot(s,route,f.waypoint,0,false,20);control.input=turn.input;s.throttle=speed(s)>.1?-1:0;
            }f.waypoint=control.waypoint;f.input=control.input;
            f.waiting=reason||(f.leg==='return'?'Returning to safe water':'Following cleared water');
            P.integrate(s,control.input,{current:{x:0,y:0}},dt);iceContact(st,s,dt);
            if(f.leader){if(control.arrived){f.order='hold';f.returned=true;f.waiting='Lead complete · holding clear of Glass Quay';}continue;}
            if(f.leg==='outbound'&&control.arrived&&f.order==='proceed'){f.leg='unloading';f.waiting='Unloading';}
            if(f.leg==='unloading'){
                f.waiting=`Unloading ${Math.floor(f.unloadProgress)} / ${f.unload} s`;
                if(speed(s)<.25&&Math.hypot(s.x-f.route.at(-1)[0],s.y-f.route.at(-1)[1])<22)f.unloadProgress+=dt;
                if(f.unloadProgress>=f.unload){f.unloaded=true;st.stats.deliveries++;f.leg='return';f.waypoint=0;f.order='hold';f.waiting='Cargo ashore · awaiting Proceed for return';}
            }
            if(f.leg==='return'&&control.arrived&&f.order==='proceed'){f.returned=true;f.order='hold';st.stats.safeReturns++;f.waiting='Crew and ship back in safe water';}
            if(f.returned)f.waiting='Crew and ship back in safe water';
            else if(f.leg==='return'&&f.order==='hold')f.waiting=f.evacuating?(f.rescued?'Awaiting Proceed to safe water':'Stranded · awaiting rescue contact'):'Cargo ashore · awaiting Proceed for return';
        }
    }
    function pocketClear(st){return st.pocket.length?st.pocket.filter(k=>!st.ice.thickness[k]||st.ice.opened[k]>=0).length/st.pocket.length:0;}
    function ready(run){const st=run.polar;if(run.finalJourney)return F.ready(run);if(st.submarine)return U.ready(run);if(st.operation)return O.ready(st);return st.config.mission==='pocket'?st.routeOpened&&pocketClear(st)>=st.config.pocket.required:st.config.mission==='follow'?st.checkpoint>=3&&st.fleet[0].returned:st.fleet.every(f=>f.unloaded&&f.returned);}
    function step(level,run,input,dt,managed=false){
        if(run.finalJourney&&!managed)return F.step(level,run,input,dt,api);
        if(run.polar.submarine)return U.step(level,run,input,dt,api);
        const st=run.polar;st.player=run.ship;st.time+=dt;run.time=st.time;
        const s=run.ship,old={x:s.x,y:s.y};
        O.before(st,run,input,dt);
        P.integrate(s,input,{current:{x:0,y:0}},dt);st.slush=iceContact(st,s,dt);
        fleetStep(st,dt);O.move(st,run,dt,api);
        const ships=[s,...st.fleet.map(f=>f.ship),...O.bodies(st)];
        for(const b of [...st.bergs,...st.floes]){
            b.x+=b.vx*dt;b.y+=b.vy*dt;b.a=P.wrap(b.a+b.r*dt);
            if(b.range){if(b.y<b.range.y-b.range.ry&&b.vy<0||b.y>b.range.y+b.range.ry&&b.vy>0)b.vy=-b.vy;}
            else if(b.x<20||b.x>level.world[0]-20)b.vx=-b.vx;
            if(!b.range&&(b.y<20||b.y>level.world[1]-20))b.vy=-b.vy;
            for(const vessel of ships){const hit=b.vessel==='iceberg'?P.contact(vessel,{poly:P.hull(b),velocity:{x:b.vx,y:b.vy}}):P.collideBodies(vessel,b);impact(st,vessel,b.id+vessel.name,hit);}
        }
        for(let i=0;i<ships.length;i++){
            for(let j=i+1;j<ships.length;j++){const hit=P.collideBodies(ships[i],ships[j]);impact(st,ships[i],'ship-'+i+'-'+j,hit,ships[i].required!==false||ships[j].required!==false);if(hit&&hit.impact>.24)ships[j].hull=Math.max(0,ships[j].hull-hit.impact**2*2);}
            for(const dock of st.config.docks)impact(st,ships[i],'jetty-'+i,P.contact(ships[i],dock));
            O.assetContacts(st,ships[i],api);
            const hull=P.hull(ships[i]);
            if(ships[i].required!==false&&hull.some(p=>p.x<0||p.y<0||p.x>level.world[0]||p.y>level.world[1]))st.failure=ships[i].name+' left the assignment chart.';
            if(ships[i].required!==false&&ships[i].hull<=0)st.failure=ships[i].name+' lost. Every required crew must come home.';
        }
        for(let i=st.pendingFloes.length-1;i>=0;i--){
            const p=st.pendingFloes[i];
            if(ships.some(s=>Math.hypot(s.x-p.x,s.y-p.y)<s.length/2+23))continue;
            const floe=P.ship(p.x,p.y,(p.k%9)*.23,{id:'floe-'+p.k,name:'FRACTURED FLOE',length:18,beam:11,mass:2.5,vx:.08,vy:(p.k%2?1:-1)*.11,r:.001,vessel:'floe'});
            st.floes.push(floe);st.pendingFloes.splice(i,1);
        }
        if(st.config.mission==='pocket'&&s.x>460&&st.broken>8)st.routeOpened=true;
        if(st.config.mission==='follow'){
            const gates=[[300,330],[485,265],[690,340]],g=gates[st.checkpoint];
            if(g&&Math.hypot(s.x-g[0],s.y-g[1])<80)st.checkpoint++;
        }
        O.after(st,run,dt);
        run.thrusterTime=(run.thrusterTime||0)+Math.abs(input.thruster||0)*dt;
        run.contacts=st.contacts;run.distance+=Math.hypot(s.x-old.x,s.y-old.y);run.maxSpeed=Math.max(run.maxSpeed,speed(s));
        run.focus={x:s.x,y:s.y,a:s.a};run.dock=P.docking(s,level.berth,ready(run));
        run.dock.ready=run.dock.ready&&s.throttle===0&&Math.abs(s.engine)<.15;
        run.dockHold=run.dock.ready?run.dockHold+dt:0;st.complete=(['defense','rescue','transit'].includes(st.config.mission)?ready(run):run.dockHold>=2)&&!st.failure;
        if(run.time>=run.sampleAt){run.sampleAt=run.time+.25;run.ghost.push([run.time,s.x,s.y,s.a]);if(run.ghost.length>16000)run.ghost.shift();}
        const objectives=progress(run);
        for(const o of objectives)if(o.done&&!run.splits.some(p=>p.name===o.text))run.splits.push({name:o.text,time:run.time});
    }
    function gap(run){const leader=run.polar.fleet.find(f=>f.leader);if(!leader)return null;const s=run.ship,b=leader.ship,dx=b.x-s.x,dy=b.y-s.y,d=Math.hypot(dx,dy);return {metres:d-(s.length+b.length)/2,closing:d?((s.vx-b.vx)*dx+(s.vy-b.vy)*dy)/d:0};}
    function progress(run){if(run.finalJourney)return F.progress(run);if(run.polar.submarine)return U.progress(run);const st=run.polar,c=st.config;
        return c.objectives.map((text,i)=>({text,done:st.operation?O.progress(st)[i]:c.mission==='pocket'?[st.routeOpened,pocketClear(st)>=c.pocket.required,st.complete][i]:c.mission==='follow'?[st.checkpoint>=3,st.complete][i]:i<2?st.fleet[i].returned:st.complete}));
    }
    function message(run){if(run.finalJourney)return F.message(run);if(run.polar.submarine)return U.message(run);const st=run.polar;if(st.failure)return st.failure;if(st.complete)return 'Passage service complete. All required hulls secure.';if(st.noticeUntil>st.time)return st.notice;
        if(st.operation)return O.message(st);
        if(st.config.mission==='pocket')return !st.routeOpened?'Cut the blue dogleg around the pressure ridge.':pocketClear(st)<st.config.pocket.required?`Turning pocket ${Math.floor(pocketClear(st)*100)}% / 86% · widen the amber area before docking.`:'Turning pocket open · slow and moor at the green jetty.';
        if(st.config.mission==='follow'){const g=gap(run);if(st.fleet[0].returned)return 'Rime is holding at Glass Quay. Continue through the marked lead; retry when you choose.';return st.slush>.55?'HEAVY SLUSH · the lead is closing; recover spacing without crowding Rime.':g.metres<22?'TOO CLOSE · reduce speed; Rime needs room at the thick patch.':g.metres>70?'FALLING BEHIND · read the slush, keep the stern in the lead.':'Working separation · watch Rime’s speed and your stern.';}
        return ready(run)?'Both crews are home. Moor Kestrel in safe water.':`${st.stats.deliveries}/2 cargoes ashore · ${st.stats.safeReturns}/2 ships home. Clear return routes before sending Proceed.`;
    }
    const api={create,step,ready,command,pilot,progress,message,gap,pocketClear,slushAt,solidAt,indexAt,iceContact,routeDistance,waterRoute,speed,clearance,impact,action:(run,name,value)=>run.polar.submarine?U.action(run,name,value):O.action(run,name,value),operations:O};
    if(typeof module!=='undefined'&&module.exports)module.exports=api;root.PaleReach=api;
})(globalThis);
