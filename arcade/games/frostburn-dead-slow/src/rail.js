(function(root) {
    'use strict';
    const Commands = typeof module !== 'undefined' && module.exports ? require('./rail-commands.js') : root.RailCommands;
    const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),G=9.81,GAP=1.2,COUPLING_SPEED=2/3.6;
    const impactKey=hit=>[hit.a.car.id,hit.b.car.id].sort().join('|');
    const other=(edge,node)=>edge.a===node?edge.b:edge.a;
    function network(config) {
        const edges={};
        for(const track of config.tracks) {
            const controls=track.points||[config.nodes[track.a],config.nodes[track.b]],samples=[];
            // Catmull-Rom centreline, sampled once by arc length. Elevation is
            // linear between survey points to avoid inventing crests at knots.
            // Optional endpoint directions make return loops tangent to adjoining rails.
            for(let i=0;i<controls.length-1;i++)for(let j=0;j<24;j++) {
                const t=j/24,p=controls[Math.max(0,i-1)],a=controls[i],b=controls[i+1],q=controls[Math.min(controls.length-1,i+2)];
                const tangent=(v,k)=>v[k]/Math.hypot(...v)*Math.hypot(b[0]-a[0],b[1]-a[1]);
                const point=k=>{
                    const m0=i===0&&track.tangentStart?tangent(track.tangentStart,k):(b[k]-p[k])/2;
                    const m1=i===controls.length-2&&track.tangentEnd?tangent(track.tangentEnd,k):(q[k]-a[k])/2;
                    return (2*t*t*t-3*t*t+1)*a[k]+(t*t*t-2*t*t+t)*m0+(-2*t*t*t+3*t*t)*b[k]+(t*t*t-t*t)*m1;
                };
                samples.push({x:point(0),y:point(1),z:a[2]+(b[2]-a[2])*t});
            }
            const end=controls[controls.length-1];samples.push({x:end[0],y:end[1],z:end[2]});
            let length=0;samples.forEach((p,i)=>{if(i)length+=Math.hypot(p.x-samples[i-1].x,p.y-samples[i-1].y);p.s=length;});
            edges[track.id]={...track,samples,length};
        }
        return {edges,nodes:config.nodes,switches:config.switches.map(s=>({...s,label:s.label||s.node.toUpperCase(),selected:0}))};
    }
    function at(net,id,s) {
        const edge=net.edges[id];s=clamp(s,0,edge.length);
        let lo=0,hi=edge.samples.length-1;
        while(hi-lo>1){const m=(hi+lo)>>1;if(edge.samples[m].s<s)lo=m;else hi=m;}
        const a=edge.samples[lo],b=edge.samples[hi],length=b.s-a.s,t=(s-a.s)/(length||1);
        return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t,
            a:Math.atan2(b.y-a.y,b.x-a.x),grade:(b.z-a.z)/(length||1),edge:id,s,
            limit:(edge.restrictions||[]).find(r=>s/edge.length>=r.from&&s/edge.length<=r.to)?.limit||edge.limit||10,
            adhesion:edge.adhesion??.23};
    }
    const entry=(net,id,dir,start=0)=>({id,dir,start,end:start+net.edges[id].length});
    function locate(st,group,q) {
        const leg=group.path.find(e=>q>=e.start&&q<=e.end)|| (q<group.path[0].start?group.path[0]:group.path[group.path.length-1]);
        const p=at(st.net,leg.id,leg.dir===1?q-leg.start:leg.end-q);
        p.a+=leg.dir===1?0:Math.PI;p.grade*=leg.dir;p.dir=leg.dir;return p;
    }
    const groupFor=(st,id)=>st.groups.find(g=>g.cars.some(c=>c.id===id));
    const engineGroup=st=>groupFor(st,'engine');
    const drivingEngine=st=>engineGroup(st).cars.find(c=>c.id==='engine');
    const bounds=group=>({lo:Math.min(...group.cars.map(c=>c.q-c.length/2)),hi:Math.max(...group.cars.map(c=>c.q+c.length/2))});
    function occupied(st,node) {
        return [...st.groups,...st.traffic||[]].filter(g=>!g.finished).some(group=>{
            const {lo,hi}=bounds(group);
            return group.path.some(leg=>{
                const edge=st.net.edges[leg.id];
                const q=node===(leg.dir===1?edge.a:edge.b)?leg.start:node===(leg.dir===1?edge.b:edge.a)?leg.end:null;
                return q!==null&&q>=lo-12&&q<=hi+12;
            });
        });
    }
    function route(st,node,incoming) {
        const sw=st.net.switches.find(s=>s.node===node);
        if(sw){const selected=sw.branches[sw.selected];return incoming===sw.stem?selected:incoming===selected?sw.stem:null;}
        return Object.values(st.net.edges).find(e=>e.id!==incoming&&(e.a===node||e.b===node))?.id||null;
    }
    function extend(st,group,forward) {
        const path=group.path,leg=forward?path[path.length-1]:path[0],edge=st.net.edges[leg.id];
        const node=forward?(leg.dir===1?edge.b:edge.a):(leg.dir===1?edge.a:edge.b),next=route(st,node,leg.id);
        if(!next)return false;
        const e=st.net.edges[next],dir=forward?(e.a===node?1:-1):(e.b===node?1:-1);
        const part=entry(st.net,next,dir,forward?leg.end:leg.start-e.length);
        if(forward)path.push(part);else path.unshift(part);return true;
    }
    // Read-only route window for maps and other lookahead displays.
    function previewPath(st,group,lo,hi) {
        const copy={path:group.path.map(leg=>({...leg}))};
        for(const forward of [false,true])for(let i=0;i<40;i++) {
            if(forward?copy.path.at(-1).end>=hi:copy.path[0].start<=lo)break;
            if(!extend(st,copy,forward))break;
        }
        return copy;
    }
    function create(level) {
        const cfg=level.rail,net=network(cfg);
        const groups=cfg.groups.map((g,i)=>({id:'cut-'+i,path:[entry(net,g.cars[0].edge,1)],brake:g.brake??1,orders:[{t:-100,value:g.brake??1}],
            cars:g.cars.map(c=>({...c,q:c.s,v:g.speed||0,face:1,pressure:g.brake??1,temp:20,hand:!!g.secured,stress:0,curveTime:0}))}));
        const traffic=(cfg.traffic||[]).map(t=>{
            let q=0;const path=t.route.map(([id,dir])=>{const p=entry(net,id,dir,q);q=p.end;return p;});
            const last=path.at(-1),tunnel=net.edges[last.id].tunnel;
            const exitQ=tunnel&&last.dir===1?last.start+tunnel.from:last.end;
            return {...t,path,exitQ,v:0,released:false,finished:false,waiting:'Awaiting Signal departure',cars:Array.from({length:4},(_,i)=>({id:t.id+'-'+i,q:t.head-i*t.length/4,length:t.length/4-1.2,mass:40000,v:0}))};
        });
        return {net,groups,traffic,config:cfg,time:0,power:0,helper:0,reverser:1,independent:0,selected:'engine',crew:[],
            completed:[],taskHold:{},finishHold:0,failure:null,notice:'Release the train brake to move.',
            stats:{distance:0,couplings:0,uncouplings:0,peakTemperature:20,peakCoupler:0,contacts:0},nextCut:groups.length};
    }
    function setBrake(st,group,value) {
        value=clamp(value,0,1);if(group.brake===value)return;
        group.brake=value;group.orders.push({t:st.time,value});
    }
    function command(st,name,value) {
        if(!Commands.valid(name,value)){st.notice='Invalid railway command.';return false;}
        const allowed=availability(st,name,value);
        if(!allowed.enabled){st.notice=allowed.reason;return false;}
        const group=engineGroup(st),engine=drivingEngine(st);
        if(name==='power'){st.power=clamp(value,0,4);return true;}
        if(name==='helper'){st.helper=clamp(value,0,4);return true;}
        if(name==='brake'){setBrake(st,group,value);return true;}
        if(name==='independent'){st.independent=clamp(value,0,1);return true;}
        if(name==='dispatch') {
            const t=st.traffic.find(t=>!t.released&&!t.finished&&(!value||t.id===value));
            t.released=true;t.waiting='Signal received';st.notice=t.name+' signalled. Track signals still protect the route.';return true;
        }
        if(name==='stop'){st.power=0;st.helper=0;setBrake(st,group,1);return true;}
        if(name==='reverse') {
            if(Math.abs(engine.v)>.12){st.notice='Stop before changing direction.';return false;}
            st.power=0;st.helper=0;st.reverser*=-1;st.notice=st.reverser===1?'Forward selected.':'Reverse selected.';return true;
        }
        if(name==='switch') {
            const sw=st.net.switches.find(s=>s.node===value);if(!sw)return false;
            if(occupied(st,sw.node)){st.notice='Points occupied — clear the whole train first.';return false;}
            sw.selected=(sw.selected+1)%sw.branches.length;st.notice=sw.names[sw.selected]+'.';return true;
        }
        if(name==='select'){st.selected=value;return true;}
        if(name==='hand') {
            const cut=groupFor(st,st.selected);if(!cut)return false;
            if(cut.cars.some(c=>Math.abs(c.v)>.15)){st.notice='Stop this cut before setting handbrakes.';return false;}
            const apply=!cut.cars.some(c=>c.hand);cut.cars.forEach(c=>c.hand=apply);
            st.notice=apply?'Handbrakes set on this cut.':'Handbrakes released on this cut.';return true;
        }
        if(name==='uncouple') {
            return uncouple(st,typeof value==='object'?value.after:value);
        }
        if(name==='couple')return couple(st);
        return false;
    }
    // Called only after command eligibility has checked the current link,
    // movement and brakes. Publish the new topology and selection together.
    function uncouple(st,after) {
        const cut=groupFor(st,after),index=cut.cars.findIndex(car=>car.id===after);
        const retained=cut.cars.slice(0,index+1);
        const detached={
            id:'cut-'+st.nextCut,
            path:cut.path.map(leg=>({...leg})),
            cars:cut.cars.slice(index+1),
            brake:1,
            orders:[{t:st.time-100,value:1}]
        };
        cut.cars=retained;
        setBrake(st,cut,1);
        st.groups.push(detached);
        st.selected=(retained.some(car=>car.id==='engine')?detached:cut).cars[0].id;
        st.nextCut++;
        st.stats.uncouplings++;
        st.notice='Cut detached. Set its handbrakes before leaving it.';
        return true;
    }
    function endpoints(st,group) {
        const b=bounds(group);
        return [{q:b.hi,sign:1,car:group.cars[0]},{q:b.lo,sign:-1,car:group.cars[group.cars.length-1]}].map(e=>({...e,...locate(st,group,e.q)}));
    }
    function nearby(st,group,max=3) {
        let nearest=null,distance=max;
        for(const cut of st.groups)if(cut!==group)for(const a of endpoints(st,group))for(const b of endpoints(st,cut)) {
            // End faces must oppose along the same rail. Nearby parallel tracks
            // are not a coupling opportunity.
            const gap=Math.abs(a.s-b.s);
            if(a.edge===b.edge&&gap<=distance&&(b.s-a.s)*a.dir*a.sign>=-.1&&Math.cos(a.a-b.a)*a.sign*b.sign<-.7){nearest={cut,a,b,distance:gap};distance=gap;}
        }
        return nearest;
    }
    function routeDistance(st,group,q,edge,s) {
        const preview=previewPath(st,group,q-3000,q+3000);
        const distances=preview.path.filter(leg=>leg.id===edge).map(leg=>(leg.dir===1?leg.start+s:leg.end-s)-q);
        return distances.length?distances.sort((a,b)=>Math.abs(a)-Math.abs(b))[0]:null;
    }
    function availability(st,name,value) {
        const eg=engineGroup(st),selected=groupFor(st,st.selected)||eg;
        let reason='';
        if(!Commands.valid(name,value,true))reason='Invalid railway command.';
        else if(st.failure)reason='Retry to begin again.';
        else if(name==='helper'&&!eg.cars.some(c=>c.helper))reason='Couple the helper before requesting assistance.';
        else if(name==='independent'&&st.config.helper&&value!==0)reason='Use the train brake with a helper.';
        else if(name==='dispatch'&&!st.traffic.some(t=>!t.released&&!t.finished&&(!value||t.id===value)))reason='No passenger awaiting a departure signal.';
        else if(name==='select'&&!groupFor(st,value))reason='That cut has changed. Select it again.';
        else if(name==='reverse'&&eg.cars.some(c=>Math.abs(c.v)>.12))reason='Stop the whole train before reversing.';
        else if(name==='hand'&&selected.cars.some(c=>Math.abs(c.v)>.15))reason='Stop the selected cut before changing handbrakes.';
        else if(name==='uncouple') {
            const id=typeof value==='object'?value?.after:value,g=groupFor(st,id),i=g?.cars.findIndex(c=>c.id===id);
            if(!g||i===g.cars.length-1||(typeof value==='object'&&g.cars[i+1].id!==value.before))reason='That link has changed. Choose the link again.';
            else if(st.config.cargo?.cars.some(id=>g.cars.slice(0,i+1).some(c=>c.id===id))&&st.config.cargo.cars.some(id=>g.cars.slice(i+1).some(c=>c.id===id)))reason='The vessel spans these carriers. Keep them connected.';
            else if(st.power||st.helper)reason='Cut front and helper power before uncoupling.';
            else if(g.cars.some(c=>Math.abs(c.v)>.12))reason='Stop the whole cut before uncoupling.';
            else if(g.cars.some(c=>!c.hand&&c.pressure<.3))reason='Apply the train brake and wait for the wagons to brake.';
        } else if(name==='couple') {
            const hit=nearby(st,eg);
            if(!hit)reason='Approach within 3 m of the waiting cut.';
            else if(st.bufferImpact?.key===impactKey(hit)&&st.bufferImpact.speed>COUPLING_SPEED)reason='Back away beyond 3 m, then approach below 2 km/h.';
            else if(Math.abs(hit.a.car.v-hit.b.car.v*hit.a.dir*hit.b.dir)>COUPLING_SPEED)reason='Match speed below 2 km/h to couple.';
        } else if(name==='switch') {
            if(!st.net.switches.some(s=>s.node===value))reason='Unknown points.';
            else if(occupied(st,value))reason='Clear the whole train from these points.';
            else if(st.traffic?.some(t=>t.reserved?.includes(value)))reason='Passenger approaching — points reserved.';
        }
        return {enabled:!reason,reason};
    }
    function assistance(st) {
        const eg=engineGroup(st),selected=groupFor(st,st.selected)||eg,hit=nearby(st,eg,Infinity);
        const hands=selected.cars.filter(c=>c.hand).length,air=Math.min(...selected.cars.map(c=>c.pressure));
        const label=selected.cars.map(c=>c.helper?'Helper':c.powered?'Loco':c.id).join(' · ');
        const cut=`${label} — handbrakes ${hands}/${selected.cars.length} · air brake ${Math.round(air*100)}%`;
        const coupling=availability(st,'couple');
        const pickup=hit?`${hit.b.car.id} · ${hit.distance.toFixed(1)} m to buffers · relative speed ${(Math.abs(hit.a.car.v-hit.b.car.v*hit.a.dir*hit.b.dir)*3.6).toFixed(1)} km/h${hit.distance<=3?'\n'+(coupling.enabled?'Ready to couple':coupling.reason):''}`:'No waiting cut on this stretch of track.';
        let next='',action=null,split=null,direction=null,needsMovement=false;
        const unsecured=selected!==eg&&hands<selected.cars.length;
        const task=st.config.tasks.find(t=>!st.completed.includes(t.id)&&(!t.after||st.completed.includes(t.after))&&!(st.caught&&t.milestone&&t.type==='coupled'));
        if(!next&&task) {
            const zone=st.config.zones.find(z=>z.id===task.zone);
            if(task.type==='traffic') {
                const passenger=st.traffic.find(t=>t.id===task.traffic);
                next=passenger?.released?'Keep the passenger route clear. '+passenger.waiting+'.':'Fit the whole freight in the loop, set the passenger route, then use Signal departure.';
            }
            else if(task.type==='crew')next=`Stop beside ${zone.name} for ${task.dwell||5} seconds to board the crew.`;
            else if(task.type==='rescue'){
                const wagons=groupFor(st,task.cars[0]);
                if(st.caught&&wagons.cars.every(c=>Math.abs(c.v)<.08)){
                    next='Secure the caught wagons with their handbrakes.';action=selected===wagons?'hand':'select';
                } else if(taskReady(st,task))next='Hold the rescued wagons here.';
                else if(eg.cars.some(c=>task.cars.includes(c.id))) {
                    const room=eg.cars.filter(c=>task.cars.includes(c.id)).map(c=>routeDistance(st,eg,c.q,zone.edge,zone.to-c.length/2)).filter(d=>d!==null);
                    const stopped=eg.cars.every(c=>Math.abs(c.v)<.08),insideZone=eg.cars.filter(c=>task.cars.includes(c.id)).every(c=>inside(st,c,eg,zone));
                    next=room.length?`${Math.max(0,Math.floor(Math.min(...room)))} m of stopping room before the river. `:'';
                    next+=stopped&&insideZone?'Set the wagon handbrakes to secure the train.':'Brake into the marked track; secure the wagons once stopped.';
                    action=stopped&&insideZone?'hand':'stop';
                } else {next='Match the rolling wagons, then couple within 3 m.';action='couple';}
            }
            else if(task.type==='coupled') {
                if(task.cars.every(id=>eg.cars.some(c=>c.id===id)))next='Coupled. Collection being confirmed.';
                else {
                    const target=task.cars.find(id=>!eg.cars.some(c=>c.id===id)),cut=groupFor(st,target),ends=endpoints(st,eg);
                    const gaps=cut?endpoints(st,cut).flatMap(b=>ends.map(a=>routeDistance(st,eg,a.q,b.edge,b.s))).filter(d=>d!==null):[];
                    const distance=gaps.length?Math.min(...gaps.map(Math.abs)):null;
                    next=coupling.enabled?'Buffers in reach. Couple the waiting wagons.':hit&&hit.distance<=3?coupling.reason:distance!==null?`${Math.ceil(distance)} m to ${target}'s cut along the selected route. Approach below 2 km/h relative speed.`:`Set the points toward ${target}'s cut.`;
                    action='couple';needsMovement=!hit||hit.distance>3;
                }
            }
            else {
                const ids=task.type==='stop'?['engine']:task.cars;
                const cars=ids.map(id=>{const g=groupFor(st,id);return {g,c:g?.cars.find(c=>c.id===id)};}).filter(({c})=>c);
                const outside=cars.filter(({g,c})=>!inside(st,c,g,zone));
                if(task.type==='park'&&cars.some(({g})=>g!==eg)){next='Reconnect every wagon before parking the complete train.';action='couple';}
                else if(outside.length) {
                    const {g,c}=outside.at(-1),p=locate(st,g,c.q);
                    const same=p.edge===zone.edge,missing=same?(clamp(p.s,zone.from+c.length/2,zone.to-c.length/2)-p.s)*p.dir:routeDistance(st,g,c.q,zone.edge,(zone.from+zone.to)/2);
                    const behind=missing!==null&&g===eg&&missing*st.reverser*drivingEngine(st).face<0;
                    next=missing!==null?`${c.id==='engine'?'Loco':c.id} needs ${Math.ceil(Math.abs(missing))} m ${behind?'back':'more'} ${same?'to fit inside':'along the selected route to'} ${zone.name}.${behind?' Stop and reverse (X).':''}`:`Set the points to bring ${c.id==='engine'?'the loco':c.id} into ${zone.name}.`;
                    if(task.type==='stop'&&task.independent)next+=' Stop with the loco brake (E / Q).';
                    needsMovement=true;
                } else if(st.power||cars.some(({c})=>Math.abs(c.v)>.08)) {
                    next=task.type==='stop'&&task.independent?'Cut power and stop with the loco brake (E / Q).':'Cut power and stop in the marked track.';
                    action=st.power?'power':task.type==='stop'&&task.independent?'independent':'stop';direction=st.power?-1:1;
                } else if(task.type==='stop') {
                    if(task.independent&&st.independent<=.3){next='Increase the loco brake to at least 50% (E) to confirm this stop.';action='independent';direction=1;}
                    else next='Hold here until the stop is confirmed.';
                }
                else if(task.type==='position'){next='Hold here until the whole load is clear. Then select Export spur and reverse.';}
                else if(['delivery','retire','ferry'].includes(task.type)&&cars.some(({g})=>g===eg)) {
                    const i=eg.cars.findIndex((c,i,a)=>i<a.length-1&&ids.includes(c.id)!==ids.includes(a[i+1].id));
                    if(i>=0) {
                        split={after:eg.cars[i].id,before:eg.cars[i+1].id};action='uncouple';
                        next=`Release the delivery at ${split.after} / ${split.before}.`;
                        const allowed=availability(st,'uncouple',split);
                        if(!allowed.enabled) {
                            next=allowed.reason;
                            if(st.power||st.helper){action=st.power?'power':'helper';direction=-1;}
                            else if(eg.cars.some(c=>Math.abs(c.v)>.12))action='stop';
                            else if(eg.cars.some(c=>!c.hand&&c.pressure<.3)){action='brake';direction=1;next='Apply the train brake (D) and wait for wagon brake pressure before uncoupling.';}
                        }
                    }
                } else if(cars.some(({c})=>!c.hand)) {
                    const id=cars.find(({c})=>!c.hand).c.id;
                    next=`Set handbrakes on ${id}'s cut.`;action=groupFor(st,id)===selected?'hand':'select';
                } else {
                    const blocked=st.net.switches.filter(s=>occupied(st,s.node));
                    next=blocked.length?`Clear ${blocked.map(s=>s.label).join(', ')} with every wagon.`:task.order&&!ordered(st,task)?`Order toward the buffers: ${task.order.join(' · ')}.`:'Hold here to complete the delivery.';
                }
            }
        }
        // A latched hard contact needs recovery even if the player skipped the
        // preceding tutorial stop. Never hide its reason behind the next task.
        if(hit&&hit.distance<=3&&st.bufferImpact?.key===impactKey(hit)&&st.bufferImpact.speed>COUPLING_SPEED) {
            const away=st.reverser*drivingEngine(st).face*hit.a.sign<0;
            const moving=eg.cars.some(c=>Math.abs(c.v)>.12);
            next='Hard buffer contact. '+(away?'Back away beyond 3 m.':moving?'Stop, then reverse (X) and back away beyond 3 m.':'Reverse (X) and back away beyond 3 m.')+' Return below 2 km/h.';
            action=away?(st.power===0?'power':null):moving?'stop':'reverse';
            direction=away?1:null;needsMovement=away;
        }
        if(!next)next='Keep all delivered wagons secured.';
        if(unsecured){next+=' Secure the selected cut before leaving it.';action='hand';needsMovement=false;}
        if(eg.cars.some(c=>c.hand)&&!['hand','uncouple'].includes(action)){next+=' Release the attached handbrakes before moving.';}
        if(needsMovement&&!eg.cars.some(c=>c.hand)) {
            if(st.independent>.05){next+=' Release the loco brake (Q) to move.';action='independent';direction=-1;}
            else if(eg.brake>.05){next+=' Release the train brake (A) to move.';action='brake';direction=-1;}
        }
        return {cut,pickup,next,action,split,direction};
    }
    function couple(st) {
        const group=engineGroup(st),hit=nearby(st,group);
        if(!hit){st.notice='Bring either end within 3 m of the waiting cut.';return false;}
        const {cut,a,b}=hit,orientation=Math.cos(a.a-b.a)>0?1:-1;
        if(st.bufferImpact?.key===impactKey(hit)&&st.bufferImpact.speed>COUPLING_SPEED){st.notice='Approach was too fast. Back away beyond 3 m, then approach below 2 km/h.';return false;}
        if(Math.abs(a.car.v-b.car.v*orientation)>COUPLING_SPEED){st.notice='Too fast to couple. Match speed below 2 km/h.';return false;}
        const moved=cut.cars.map(c=>({...c,q:a.q+a.sign*GAP+(c.q-b.q)*orientation,v:c.v*orientation,face:c.face*orientation}));
        const low=Math.min(...moved.map(c=>c.q-c.length/2)),high=Math.max(...moved.map(c=>c.q+c.length/2));
        // Extend the receiving path, then verify that every donor wagon still
        // occupies its actual track. Parallel rails cannot be joined by proximity.
        const candidate={...group,path:group.path.map(leg=>({...leg}))};
        for(let i=0;i<30&&(low<candidate.path[0].start||high>candidate.path.at(-1).end);i++) {
            if(!extend(st,candidate,high>candidate.path.at(-1).end)){st.notice='The route between the cuts is blocked.';return false;}
        }
        const matches=moved.every((c,i)=>{
            const target=locate(st,cut,cut.cars[i].q),actual=locate(st,candidate,c.q);
            return target.edge===actual.edge&&Math.hypot(target.x-actual.x,target.y-actual.y)<5;
        });
        if(!matches){st.notice='Align the route with the waiting cut.';return false;}
        const total=[...group.cars,...moved];
        const momentum=total.reduce((sum,car)=>sum+car.mass*car.v,0);
        const mass=total.reduce((sum,car)=>sum+car.mass,0);
        total.forEach(car=>car.v=momentum/mass);
        group.path=candidate.path;
        group.cars=total.sort((a,b)=>b.q-a.q);
        st.groups=st.groups.filter(g=>g!==cut);
        st.selected='engine';
        st.bufferImpact=null;st.stats.couplings++;st.notice='Coupled. Check the handbrakes before pulling away.';return true;
    }
    function inside(st,car,group,zone) {
        return [-1,1].every(sign=>{const p=locate(st,group,car.q+sign*car.length/2);return p.edge===zone.edge&&p.s>=zone.from&&p.s<=zone.to;});
    }
    function ordered(st,task) {
        const zone=st.config.zones.find(z=>z.id===task.zone),g=engineGroup(st);
        const ids=g.cars.filter(c=>task.order.includes(c.id)).sort((a,b)=>locate(st,g,b.q).s-locate(st,g,a.q).s).map(c=>c.id);
        return !!zone&&ids.join('|')===task.order.join('|');
    }
    function segments(st,group) {
        return group.cars.flatMap(car=>group.path.flatMap(leg=>{
            const lo=Math.max(leg.start,car.q-car.length/2),hi=Math.min(leg.end,car.q+car.length/2);
            if(lo>=hi)return [];
            return [{edge:leg.id,from:leg.dir===1?lo-leg.start:leg.end-hi,to:leg.dir===1?hi-leg.start:leg.end-lo,car}];
        }));
    }
    function updateTraffic(st,dt) {
        const player=st.groups.flatMap(g=>segments(st,g));
        for(const t of st.traffic) {
            if(t.finished)continue;
            t.reserved=[];
            if(!t.released){t.waiting='Awaiting Signal departure';continue;}
            const head=bounds(t).hi,horizon=t.v*t.v/.8+70;
            let stop=t.path.at(-1).end+t.length+20;t.waiting='Running';
            for(let i=0;i<t.path.length;i++) {
                const leg=t.path[i],edge=st.net.edges[leg.id];
                if(leg.end<head-12)continue;
                // A whole edge is a signal block. A short refuge never makes
                // its adjacent main block clear while a tail remains outside.
                if(player.some(p=>p.edge===leg.id)) {stop=Math.min(stop,leg.start-22);t.waiting='Held at red signal';break;}
                if(i===t.path.length-1||leg.end-head>horizon)continue;
                const node=leg.dir===1?edge.b:edge.a,sw=st.net.switches.find(s=>s.node===node);
                if(!sw)continue;
                const branch=sw.branches.findIndex(id=>id===leg.id||id===t.path[i+1].id);
                if(route(st,node,leg.id)!==t.path[i+1].id) {
                    stop=Math.min(stop,leg.end-24);
                    t.waiting=occupied(st,node)?'Waiting for points to clear':`Set ${sw.label} → ${sw.names[branch]}`;break;
                }
                t.reserved.push(node);
            }
            const target=Math.min(t.speed,Math.sqrt(Math.max(0,stop-head)*.7));
            t.v=clamp(target,t.v-.4*dt,t.v+.25*dt);
            const travel=Math.min(t.v*dt,Math.max(0,stop-head));
            t.cars.forEach(c=>{c.q+=travel;c.v=t.v;});
            if(bounds(t).lo>t.exitQ){t.finished=true;t.waiting='Clear';t.reserved=[];}
            const occupiedTrack=segments(st,t);
            if(occupiedTrack.some(a=>player.some(b=>a.edge===b.edge&&a.from<b.to&&a.to>b.from)))st.failure='The trains collided. Wait behind a clear signal block.';
        }
    }
    function bridges(st) {
        const all=st.groups.flatMap(g=>segments(st,g));
        return Object.values(st.net.edges).filter(e=>e.bridge).map(e=>{
            const cars=[...new Set(all.filter(p=>p.edge===e.id).map(p=>p.car))];
            const mass=cars.reduce((sum,c)=>sum+c.mass,0),loads=cars.filter(c=>c.heavy).length;
            const unpaired=(e.bridge.pairs||[]).filter(([a,b])=>cars.some(c=>c.id===a||c.id===b)&&
                (groupFor(st,a)!==groupFor(st,b)||Math.abs(groupFor(st,a)?.cars.findIndex(c=>c.id===a)-groupFor(st,b)?.cars.findIndex(c=>c.id===b))!==1));
            return {edge:e.id,...e.bridge,mass,loads,unpaired,over:mass>e.bridge.maxMass||loads>e.bridge.maxLoads};
        });
    }
    function cargoShape(st,group,shift=0) {
        const spec=st.config.cargo;if(!spec)return null;
        const carriers=spec.cars.map(id=>group.cars.find(c=>c.id===id));if(carriers.some(c=>!c))return null;
        const a=locate(st,group,carriers[0].q+shift),b=locate(st,group,carriers.at(-1).q+shift);
        const angle=Math.atan2(a.y-b.y,a.x-b.x),dx=Math.cos(angle),dy=Math.sin(angle),r=spec.width/2;
        return [{x:a.x+dx*spec.overhang-dy*r,y:a.y+dy*spec.overhang+dx*r},
            {x:a.x+dx*spec.overhang+dy*r,y:a.y+dy*spec.overhang-dx*r},
            {x:b.x-dx*spec.overhang+dy*r,y:b.y-dy*spec.overhang-dx*r},
            {x:b.x-dx*spec.overhang-dy*r,y:b.y-dy*spec.overhang+dx*r}];
    }
    function vehicleShape(st,group,car) {
        const p=locate(st,group,car.q),dx=Math.cos(p.a),dy=Math.sin(p.a),half=car.length/2;
        return [[half,4.5],[half,-4.5],[-half,-4.5],[-half,4.5]].map(([x,y])=>({x:p.x+x*dx-y*dy,y:p.y+x*dy+y*dx}));
    }
    function obstacles(st) {
        return [...st.config.obstacles||[],...(st.config.cargo?.clearanceWagons||[]).map(id=>{
            const g=groupFor(st,id),c=g.cars.find(c=>c.id===id);
            return {name:`${id} · parked wagon`,car:id,polygon:vehicleShape(st,g,c)};
        })];
    }
    function cargoHit(st,poly,boxes=obstacles(st)) {
        if(!poly)return null;
        return boxes.find(o=>{
            const box=o.polygon||[{x:o.x,y:o.y},{x:o.x+o.w,y:o.y},{x:o.x+o.w,y:o.y+o.h},{x:o.x,y:o.y+o.h}];
            const axes=[poly,box].flatMap(shape=>shape.slice(0,2).map((p,i)=>({x:shape[i+1].y-p.y,y:p.x-shape[i+1].x})));
            return axes.every(n=>{const a=poly.map(p=>p.x*n.x+p.y*n.y),b=box.map(p=>p.x*n.x+p.y*n.y);return Math.max(...a)>=Math.min(...b)&&Math.max(...b)>=Math.min(...a);});
        })||null;
    }
    function clearance(st) {
        if(!st.config.cargo)return null;
        if(groupFor(st,st.config.cargo.cars[0])!==engineGroup(st))return null;
        const original=groupFor(st,st.config.cargo.cars[0]),group={...original,path:original.path.map(p=>({...p}))};
        const eg=engineGroup(st),engine=eg.cars.find(c=>c.id==='engine'),dir=st.reverser*engine.face;
        for(let i=0;i<16;i++)if(!extend(st,group,dir>0))break;
        const b=bounds(group),room=dir>0?group.path.at(-1).end-b.hi:b.lo-group.path[0].start,previews=[];
        for(let distance=0;distance<=Math.min(2400,room);distance+=12){const polygon=cargoShape(st,group,dir*distance);if(polygon)previews.push({polygon,distance,hit:cargoHit(st,polygon)?.name||null});}
        const collision=previews.find(p=>p.hit)||null;
        if(collision)collision.bodies=group.cars.map(c=>vehicleShape(st,group,{...c,q:c.q+dir*collision.distance}));
        return {previews,collision};
    }
    function checkInfrastructure(st) {
        for(const b of bridges(st)){
            if(b.over)st.failure=`${b.name} overloaded. Cross with one transformer and its support wagon at a time.`;
            else if(b.unpaired.length)st.failure=`Keep ${b.unpaired[0].join(' and ')} coupled beside each other while crossing the bridge.`;
        }
        for(const g of st.groups)for(const p of segments(st,g)) {
            const edge=st.net.edges[p.edge];
            if(edge.closedFrom!==undefined&&p.to>=edge.closedFrom)st.failure='The wagons reached the broken crossing.';
            const closure=(st.config.floods||[]).find(f=>f.edge===p.edge&&st.time>=f.at&&p.to>f.from&&p.from<f.to);
            if(closure)st.failure=`Floodwater has closed ${closure.name}. Clear the crossing before the forecast time.`;
            if(st.config.ferry?.decks.includes(p.edge)&&p.car.powered&&p.to>st.config.ferry.start)st.failure='Keep the locomotive ashore. Use the reach wagon to push the loads aboard.';
        }
        const deck=ferry(st);
        if(deck&&!st.failure&&Math.abs(deck.balance)>deck.maxDifference)st.failure='The ferry heeled beyond the ramp limit. Alternate loads between deck tracks.';
        if(st.config.cargo) {
            const g=groupFor(st,st.config.cargo.cars[0]),hit=cargoHit(st,cargoShape(st,g));
            if(hit)st.failure=`The vessel struck ${hit.name.toLowerCase()}. Check the swept outline before taking the curve.`;
        }
    }
    function ferry(st) {
        const spec=st.config.ferry;if(!spec)return null;
        const all=st.groups.flatMap(g=>segments(st,g));
        const loads=spec.decks.map(edge=>all.filter(p=>p.edge===edge).reduce((sum,p)=>sum+p.car.mass*Math.max(0,p.to-Math.max(spec.start,p.from))/p.car.length,0));
        const balance=loads[0]-loads[1];
        return {...spec,loads,balance,heel:balance/spec.maxDifference*4};
    }
    function forecast(st) {
        return (st.config.floods||[]).map(f=>({...f,remaining:Math.max(0,f.at-st.time),closed:st.time>=f.at}));
    }
    function taskReady(st,task) {
        const eg=engineGroup(st),engine=drivingEngine(st),zone=st.config.zones.find(z=>z.id===task.zone);
        if(task.after&&!st.completed.includes(task.after))return false;
        if(task.type==='traffic')return st.traffic.some(t=>t.id===task.traffic&&t.finished);
        if(task.type==='stop')return inside(st,engine,eg,zone)&&Math.abs(engine.v)<.08&&(!task.independent||st.independent>.3)&&st.power===0;
        if(task.type==='coupled')return task.cars.every(id=>eg.cars.some(c=>c.id===id));
        if(task.type==='crew')return st.power===0&&st.helper===0&&eg.cars.every(c=>Math.abs(c.v)<.08)&&eg.cars.some(c=>inside(st,c,eg,zone));
        const cars=task.cars.map(id=>{const g=groupFor(st,id);return {g,c:g?.cars.find(c=>c.id===id)};});
        if(task.type==='position')return st.power===0&&cars.every(({c,g})=>c&&g===eg&&Math.abs(c.v)<.08&&inside(st,c,g,zone));
        if(task.type==='rescue') {
            const catchZone=st.config.zones.find(z=>z.id===task.alternative);
            return st.power===0&&cars.every(({c,g})=>c&&Math.abs(c.v)<.08&&c.hand)&&
                (cars.every(({c,g})=>g===eg&&inside(st,c,g,zone))||cars.every(({c,g})=>inside(st,c,g,catchZone)));
        }
        if(task.type==='park'&&cars.some(({g})=>g!==eg))return false;
        if(task.exclude?.some(id=>eg.cars.some(c=>c.id===id)))return false;
        if(task.order&&!ordered(st,task))return false;
        return st.power===0&&st.helper===0&&cars.every(({c,g})=>c&&Math.abs(c.v)<.08&&c.hand&&inside(st,c,g,zone)&&
            (!['delivery','retire','ferry'].includes(task.type)||g!==eg)&&
            (task.type!=='delivery'||!g.cars.some(c=>c.powered)))&&st.net.switches.every(s=>!occupied(st,s.node));
    }
    function update(st,dt) {
        if(st.failure)return;
        st.time+=dt;st.slip=false;st.slide=false;
        updateTraffic(st,dt);
        for(const group of st.groups) {
            const engine=group.cars.find(c=>c.id==='engine'),cars=group.cars,force=cars.map(c=>{
                const p=locate(st,group,c.q);c.location=p;
                return -c.mass*G*p.grade;
            });
            // A released cut retains air temporarily; only handbrakes secure it
            // indefinitely. This also provides the future runaway-wagon mechanic.
            if(!engine)group.brake=Math.max(0,group.brake-dt*.007);
            for(let i=0;i<cars.length-1;i++) {
                const a=cars[i],b=cars[i+1],rest=(a.length+b.length)/2+GAP,extension=a.q-b.q-rest;
                const stretch=Math.sign(extension)*Math.max(0,Math.abs(extension)-.22);
                const load=stretch*180000+(a.v-b.v)*(stretch?55000:4000);
                force[i]-=load;force[i+1]+=load;a.coupler=load;
                st.stats.peakCoupler=Math.max(st.stats.peakCoupler,Math.abs(load));
                a.stress=Math.abs(load)>(st.config.couplerLimit||650000)?a.stress+dt:Math.max(0,a.stress-dt);
                if(a.stress>.6)st.failure='A coupler parted. Ease power and brake changes across the crest.';
                a.workStress=engine&&st.config.helper&&load>(st.config.helper.workingPull||120000)?(a.workStress||0)+dt:Math.max(0,(a.workStress||0)-dt*2);
                if(a.workStress>(st.config.helper?.pullGrace||8))st.failure='A coupler could not sustain the pull. Share the climb with the rear helper.';
                const tight=a.location.limit<=6;
                a.bunchTime=tight&&engine&&cars.some(c=>c.helper)&&load<-(st.config.compressionLimit||Infinity)?(a.bunchTime||0)+dt:0;
                if(a.bunchTime>(st.config.helper?.compressionGrace||1.5))st.failure='The helper bunched the wagons on a curve. Reduce rear assistance before the head descends.';
            }
            for(let i=0;i<cars.length;i++) {
                const c=cars[i],p=c.location,old=c.q;
                const delay=engine?Math.abs(c.q-engine.q)*.022:0;
                const order=engine?[...group.orders].reverse().find(o=>o.t<=st.time-delay)?.value??1:group.brake;
                c.pressure+=(order-c.pressure)*Math.min(1,dt/(c.powered?.5:1.4));
                const fade=1-clamp((c.temp-180)/270,0,.8);
                let brake=c.mass*(c.powered?.85:.7)*c.pressure*fade;
                if(c.powered&&engine) {
                    // Motor effort falls with road speed. Full power spins at
                    // launch; easing to notch 3 restores grip. At speed the
                    // fourth notch fits within adhesion and adds useful power.
                    const demand=(c.helper?st.helper:st.power)/4*(c.helper?(st.config.helper?.tractive||190000):(st.config.tractive||210000))*Math.min(1,2.8/Math.max(.01,Math.abs(c.v)));
                    const adhesion=p.adhesion*c.mass*G,slip=demand>adhesion*1.01;
                    force[i]+=(slip?adhesion*.78:Math.min(demand,adhesion))*st.reverser*engine.face;
                    if(slip)st.slip=true;
                    if(!c.helper)brake=Math.max(brake,c.mass*1.05*st.independent*fade);
                }
                c.sliding=brake>p.adhesion*c.mass*G*1.05&&Math.abs(c.v)>.2;
                if(c.sliding)st.slide=true;
                brake=Math.min(brake,p.adhesion*c.mass*G*(c.sliding?.72:1));
                if(c.hand)brake=Math.max(brake,c.mass*1.5);
                const track=st.net.edges[p.edge];
                if(track.catchFrom!==undefined&&p.s>=track.catchFrom) {
                    brake+=c.mass*1.6;
                    if(!st.caught){st.caught=true;st.stats.contacts++;}
                }
                const resistance=c.mass*(.012+.00025*c.v*c.v),opposition=brake+resistance;
                const sign=Math.abs(c.v)>.004?Math.sign(c.v):Math.sign(force[i]);
                if(Math.abs(c.v)<.02&&Math.abs(force[i])<=opposition)c.v=0;
                else {const next=c.v+(force[i]-sign*opposition)/c.mass*dt;c.v=c.v*next<0&&Math.abs(force[i])<=opposition?0:next;}
                c.q+=c.v*dt;
                if(c.id==='engine')st.stats.distance+=Math.abs(c.q-old);
                if(st.config.thermal)c.temp=clamp(c.temp+(brake*Math.abs(c.v)/c.mass*.9-(c.temp-20)*(.005+Math.abs(c.v)*.0003))*dt,20,650);
                st.stats.peakTemperature=Math.max(st.stats.peakTemperature,c.temp);
                c.curveTime=Math.abs(c.v)>p.limit*1.35?c.curveTime+dt:Math.max(0,c.curveTime-dt);
                if(c.curveTime>1.5)st.failure='The train left the rails on a curve. Slow the tail before it reaches the bend.';
            }
            // Keep only the occupied route history. After the tail clears, a
            // reversal can take newly selected points instead of a stale path.
            const b=bounds(group);
            while(group.path.length>1&&b.lo>group.path[0].end+14)group.path.shift();
            while(group.path.length>1&&b.hi<group.path[group.path.length-1].start-14)group.path.pop();
            for(const forward of [false,true]) {
                const bound=forward?b.hi:b.lo,leg=forward?group.path[group.path.length-1]:group.path[0];
                const contactKey=leg.id+':'+forward;
                group.endContacts=group.endContacts||{};
                if(forward?bound<leg.end-3:bound>leg.start+3)delete group.endContacts[contactKey];
                if(forward?bound>leg.end-2:bound<leg.start+2) {
                    if(!extend(st,group,forward)) {
                        const speed=Math.max(...cars.map(c=>Math.abs(c.v)));
                        if(!group.endContacts[contactKey]&&speed>.02)st.stats.contacts++;
                        group.endContacts[contactKey]=true;
                        if(speed>1.4)st.failure='The train ran past a stop or into the buffers. Brake earlier.';
                        const shift=forward?Math.min(0,leg.end-2-bound):Math.max(0,leg.start+2-bound);
                        cars.forEach(c=>{c.q+=shift;c.v=0;});
                        if(engine){st.power=0;st.helper=0;st.notice='End of available track. Check the points or reverse.';}
                    }
                }
            }
            const history=engine?Math.max(30,...cars.map(c=>Math.abs(c.q-engine.q)*.022+2)):30;
            group.orders=group.orders.filter((o,i,a)=>i===a.length-1||a[i+1].t>st.time-history);
        }
        const eg=engineGroup(st),hit=nearby(st,eg,1.1);
        if(hit) {
            const rel=hit.a.car.v-hit.b.car.v*hit.a.dir*hit.b.dir;
            const key=impactKey(hit),previous=st.bufferImpact?.key===key?st.bufferImpact:null;
            if(!previous&&Math.abs(rel)>.02)st.stats.contacts++;
            st.bufferImpact={key,speed:Math.max(previous?.speed||0,Math.abs(rel))};
            if(Math.abs(rel)>1.4)st.failure='A hard coupling damaged the wagons. Approach below 2 km/h.';
            const correction=1.2-Math.hypot(hit.a.x-hit.b.x,hit.a.y-hit.b.y);
            const orientation=hit.a.dir*hit.b.dir,otherMoving=Math.abs(hit.b.car.v)>.08&&!hit.cut.cars.some(c=>c.hand);
            const totalMass=eg.cars.reduce((s,c)=>s+c.mass,0)+hit.cut.cars.reduce((s,c)=>s+c.mass,0);
            const velocity=otherMoving?(eg.cars.reduce((s,c)=>s+c.mass*c.v,0)+hit.cut.cars.reduce((s,c)=>s+c.mass*c.v*orientation,0))/totalMass:0;
            eg.cars.forEach(c=>{c.q-=hit.a.sign*Math.max(0,correction);c.v=velocity;});hit.cut.cars.forEach(c=>c.v=velocity*orientation);
            st.power=0;st.helper=0;st.notice=st.bufferImpact.speed>COUPLING_SPEED?'Hard buffer contact. Back away beyond 3 m and approach slowly.':'Buffers touching. Use Couple.';
        }
        const approach=nearby(st,eg,3);
        if(st.bufferImpact&&(!approach||impactKey(approach)!==st.bufferImpact.key))st.bufferImpact=null;
        checkInfrastructure(st);
        for(const task of st.config.tasks) {
            const met=taskReady(st,task);
            st.taskHold[task.id]=met?(st.taskHold[task.id]||0)+dt:0;
            if(met&&st.taskHold[task.id]>=(task.dwell||1)&&!st.completed.includes(task.id))st.completed.push(task.id);
            // Delivery/parking are live requirements; leaving the zone revokes
            // them. Tutorial and optional guide milestones remain remembered.
            if(!met&&!task.milestone&&['delivery','park','rescue','retire','ferry'].includes(task.type))st.completed=st.completed.filter(id=>id!==task.id);
        }
        st.finishHold=st.config.tasks.every(t=>t.milestone||st.completed.includes(t.id))?st.finishHold+dt:0;
    }
    function metrics(st) {
        const group=engineGroup(st),engine=group.cars.find(c=>c.id==='engine'),mass=group.cars.reduce((s,c)=>s+c.mass,0),b=bounds(group);
        const direction=Math.abs(engine.v)>.02?Math.sign(engine.v):st.reverser*engine.face;
        const gradient=group.cars.reduce((s,c)=>s+locate(st,group,c.q).grade*c.mass,0)/mass;
        const braking=group.cars.reduce((s,c)=>{const demand=(c.powered?.85:.7)*(1-clamp((c.temp-180)/270,0,.8)),grip=locate(st,group,c.q).adhesion*G;return s+c.mass*Math.min(demand,grip*(demand>grip*1.05?.72:1));},0)/mass;
        const decel=braking+gradient*G*direction+.012;
        const stopping=decel>.02?engine.v*engine.v/(2*decel)+Math.abs(engine.v)*(1.4+(b.hi-b.lo)*.022):Infinity;
        const driving=st.reverser*engine.face;
        return {mass,length:b.hi-b.lo,speed:engine.v,signedSpeed:engine.v*driving,gradient,stopping,
            head:locate(st,group,driving>0?b.hi:b.lo),tail:locate(st,group,driving>0?b.lo:b.hi),
            temperature:Math.max(...group.cars.map(c=>c.temp)),limit:Math.min(...group.cars.map(c=>locate(st,group,c.q).limit))};
    }
    // Presentation-only lookahead. Extend a copy so inspecting an unoccupied
    // junction never reserves its route or alters subsequent train movement.
    function danger(st) {
        const g=engineGroup(st),m=metrics(st),engine=g.cars.find(c=>c.id==='engine');
        const direction=Math.abs(engine.v)>.02?Math.sign(engine.v):st.reverser*engine.face,b=bounds(g);
        const cars=g.cars.map(c=>{const p=locate(st,g,c.q);return {id:c.id,ratio:Math.abs(c.v)/p.limit,limit:p.limit,edge:p.edge,s:p.s};}).filter(c=>c.ratio>1);
        const severity=cars.some(c=>c.ratio>=1.2)?2:cars.length?1:0;
        const head=direction>0?b.hi:b.lo,path={path:g.path.map(e=>({...e}))};
        const horizon=Math.min(500,Math.max(70,(Number.isFinite(m.stopping)?m.stopping:400)+Math.abs(m.speed)*4));
        for(let i=0;i<20;i++) {
            const end=direction>0?path.path.at(-1).end:path.path[0].start;
            if((end-head)*direction>=horizon||!extend(st,path,direction>0))break;
        }
        let ahead=null;
        for(let d=0;d<=horizon;d+=4) {
            const q=head+direction*d;
            if(q<path.path[0].start||q>path.path.at(-1).end)break;
            const p=locate(st,path,q);
            if(Math.abs(m.speed)>p.limit*1.02){ahead={edge:p.edge,s:p.s,limit:p.limit,distance:d};break;}
        }
        let coupling=null;
        if(st.config.helper) {
            const helper=g.cars.some(c=>c.helper);
            for(const c of g.cars) {
                const force=c.coupler||0,limit=force>=0?(st.config.helper.workingPull||120000):helper?st.config.compressionLimit:st.config.couplerLimit;
                const ratio=Math.abs(force)/limit;
                if(ratio>.8&&(!coupling||ratio>coupling.ratio))coupling={id:c.id,ratio,force,kind:force>=0?'pull':'push'};
            }
        }
        return {severity:Math.max(severity,ahead?1:0,coupling?(coupling.ratio>1?2:1):0),cars,ahead,coupling};
    }
    function assertInvariants(st) {
        const ids = new Set();
        for(const group of st.groups) {
            if(!group.cars.length || !group.path.length)throw Error('A cut must contain vehicles and a route.');
            for(const car of group.cars) {
                if(ids.has(car.id))throw Error('Vehicle belongs to multiple cuts: '+car.id);
                if(!Number.isFinite(car.q)||!Number.isFinite(car.v))throw Error('Non-finite vehicle motion: '+car.id);
                ids.add(car.id);
            }
        }
        if(!ids.has('engine')||!ids.has(st.selected))throw Error('Driving engine or selected cut is missing.');
        if(st.helper&&!engineGroup(st).cars.some(c=>c.helper))throw Error('A detached helper cannot receive power.');
        return true;
    }
    const api={network,at,locate,previewPath,create,update,command,availability,assistance,occupied,engineGroup,drivingEngine,groupFor,bounds,metrics,taskReady,danger,segments,bridges,cargoShape,vehicleShape,cargoHit,obstacles,clearance,ferry,forecast,assertInvariants,commands:Commands};
    if(typeof module!=='undefined'&&module.exports)module.exports=api;
    root.Railway=api;
})(typeof globalThis!=='undefined'?globalThis:this);
