'use strict';
// ================= MISSION DEFINITIONS (port of the 2D campaign, distances in meters) =================
const MISSIONS=[
  { id:'welcome', name:'Welcome to Leonida', contact:'Lucia', at:'safehouse', reward:500,
    brief:[{who:'Lucia',text:"You made it. Leonida's ours for the taking, but nobody gets anywhere in this city on foot."},{who:'Lucia',text:"Head over to Sunshine Autos and pick us up a car. Any car. Then bring it back here."}],
    setup(M){ const G=M.G; const d=G.world.loc('dealer'); M.step=0; const spots=G.world.parkSpots.filter(s=>s.kind==='dealer'); if(spots.length&&!G.vehicles.some(v=>dist(v.x,v.z,d.x,d.z)<38&&!v.wrecked)){ const s=pick(spots); const v=G.spawnVehicle('sports',s.x,s.z,s.angle); v.parked=true; } M.setMarker(d.x,d.z-5,6,'#ffd23f','Sunshine Autos'); M.setObjective('Go to Sunshine Autos and get a car'); },
    update(M,dt){ const G=M.G,P=G.player; if(M.step===0 && P.vehicle){ M.step=1; const s=G.world.loc('safehouse'); M.setMarker(s.x,s.z,6,'#ffd23f','Safehouse'); M.setObjective("Drive the car back to Lucia's place"); G.hint='Press E near a car to get in. Hold Shift to sprint on foot.'; G.hintT=6; }
      if(M.step===1){ if(!P.vehicle){ M.setObjective('Get back in a vehicle'); } else { M.setObjective("Drive the car back to Lucia's place"); if(M.playerInMarker(true)) M.pass(); } } } },
  { id:'delivery', name:'Special Delivery', contact:'Lucia', at:'safehouse', reward:800,
    brief:[{who:'Lucia',text:"Tony left a package for us at his warehouse down by the docks. Ray at Club Malibu is waiting on it."},{who:'Lucia',text:"Ray isn't a patient man. Once you grab it you've got two minutes. Don't wreck the car, don't get busted."}],
    setup(M){ const G=M.G; const d=G.world.loc('docks'); M.step=0; M.setMarker(d.x,d.z,5.5,'#ffd23f',"Tony's Warehouse"); M.setObjective("Pick up the package at Tony's Warehouse"); },
    update(M,dt){ const G=M.G; if(M.step===0 && M.playerInMarker()){ M.step=1; M.timer=120; const c=G.world.loc('club'); M.setMarker(c.x,c.z,5.5,'#ffd23f','Club Malibu'); M.setObjective('Deliver the package to Ray at Club Malibu'); G.audio.pickup(); G.notify('Package acquired!','#ffd23f'); }
      if(M.step===1 && M.playerInMarker()) M.pass(); } },
  { id:'baddebt', name:'Bad Debt', contact:'Ray', at:'club', reward:1500,
    brief:[{who:'Ray',text:"So you're Lucia's new muscle. Cute. Here's a test: a lowlife named Vinnie owes me fifty grand and thinks he can hide."},{who:'Ray',text:"He hangs around Leonida Bank with a couple of goons. Make an example out of him. Take this pistol, you'll need it."}],
    setup(M){ const G=M.G; G.giveWeapon('pistol',34); const b=G.world.loc('bank'); const spot=G.world.randomWalkableNear(b.x,b.z,8,20)||{x:b.x+10,z:b.z}; const v=M.spawnPed(spot.x,spot.z,'target',{name:'Vinnie',blip:'#ff4040',important:true,fearless:true}); v.leash=25; M.data.vinnie=v;
      for(let i=0;i<2;i++){ const s=G.world.randomWalkableNear(spot.x,spot.z,2.5,8)||spot; const g=M.spawnPed(s.x,s.z,'gang',{aggro:true,aggroRange:28,shirt:[160,30,30]}); g.leash=15; }
      M.setObjective('Find Vinnie near Leonida Bank'); M.blipEntity(v); },
    update(M,dt){ const v=M.data.vinnie; if(v.dead){ M.pass(); return; } if(dist(v.x,v.z,M.G.player.x,M.G.player.z)<40) M.setObjective('Kill Vinnie before he gets away!'); } },
  { id:'hotwheels', name:'Hot Wheels', contact:'Ray', at:'club', reward:2500,
    brief:[{who:'Ray',text:"There's a prototype sports car sitting at the Import Garage. Cops have been babysitting it all week."},{who:'Ray',text:"Steal it and bring it to my lockup here at the club. Scratch the paint and I'll take it out of your hide. Lose the heat first, use a Pay 'n' Spray if you have to."}],
    setup(M){ const G=M.G; const g=G.world.loc('garage'); const spots=G.world.parkSpots.filter(s=>s.kind==='garage'); const s=spots.length?pick(spots):{x:g.x,z:g.z-8,angle:-Math.PI/2}; for(const v of G.vehicles){ if(!v.wrecked&&dist(v.x,v.z,s.x,s.z)<4&&!v.driver) v.removed=true; } const v=G.spawnVehicle('sports',s.x,s.z,s.angle,[255,60,200]); v.mission=true; v.setLabel('PROTOTYPE'); v.parked=true; M.data.car=v;
      for(let i=0;i<2;i++){ const p=G.world.randomWalkableNear(s.x,s.z,4,11)||s; const c=M.spawnPed(p.x,p.z,'cop'); c.leash=15; }
      M.setMarker(s.x,s.z,5,'#ffd23f','Prototype'); M.setObjective('Steal the prototype from the Import Garage'); M.blipEntity(v); },
    update(M,dt){ const G=M.G,P=G.player; const car=M.data.car; if(car.wrecked){ M.fail('The prototype was destroyed!'); return; }
      if(M.step===0 && P.vehicle===car){ M.step=1; G.addCrime(4); const c=G.world.loc('club'); M.setMarker(c.x,c.z,5.7,'#ffd23f','Club Malibu'); M.clearBlips(); }
      if(M.step===1){ if(P.vehicle!==car) M.setObjective('Get back in the prototype'); else if(P.wanted>0) M.setObjective("Lose the cops! (Pay 'n' Spray works)"); else { M.setObjective('Deliver the prototype to Club Malibu'); if(M.playerInMarker(true)&&P.vehicle===car){ car.mission=false; car.setLabel(null); M.pass(); } } } } },
  { id:'race', name:'Street Race', contact:'Ray', at:'club', reward:3500,
    brief:[{who:'Ray',text:"Race night. Three of the fastest drivers in Leonida, six checkpoints across the city, winner takes the pot."},{who:'Ray',text:"I've got a car waiting for you at the start line. Don't embarrass me."}],
    setup(M){ const G=M.G; const c=G.world.loc('club'); const start=G.world.nearestNode(c.x,c.z);
      const cps=[]; let n=start; const visited=new Set([start.id]); for(let i=0;i<6;i++){ const cands=G.world.nodeList.filter(m=>!visited.has(m.id)&&dist(m.x,m.z,n.x,n.z)>62&&dist(m.x,m.z,n.x,n.z)<160); const nx=cands.length?pick(cands):G.world.randomNode(); visited.add(nx.id); cps.push(nx); n=nx; } cps.push(start);
      M.data.cps=cps; M.data.idx=0; M.data.racers=[]; M.data.count=4; M.step=0;
      const nb=start.nb[0]; const dx=nb.x-start.x, dz=nb.z-start.z, L=Math.hypot(dx,dz), ux=dx/L, uz=dz/L, rx=-uz, rz=ux;
      const cars=[]; for(let i=0;i<4;i++){ const lane=i%2===0?1:-1; const back=Math.floor(i/2); const x=start.x+ux*(T*2.5+back*7)+rx*T*lane, z=start.z+uz*(T*2.5+back*7)+rz*T*lane; for(const v of G.vehicles){ if(!v.driver&&!v.mission&&dist(v.x,v.z,x,z)<6) v.removed=true; } const v=G.spawnVehicle(i===0?'sports':pick(['sports','muscle']),x,z,Math.atan2(uz,ux),i===0?[255,220,40]:undefined); v.mission=true; cars.push(v); }
      M.data.playerCar=cars[0]; cars[0].setLabel('YOUR CAR');
      for(let i=1;i<4;i++){ const v=cars[i]; const d=M.spawnPed(v.x,v.z,'civ',{noCrime:true}); v.addOccupant(d,true); v.ai={mode:'traffic',speedMul:0,reckless:true}; v.setLabel('RACER '+i); v.racerIdx=0; M.data.racers.push(v); }
      M.setMarker(cars[0].x,cars[0].z,4.5,'#ffd23f','Start'); M.setObjective('Get in your race car'); },
    update(M,dt){ const G=M.G,P=G.player,D=M.data;
      if(M.step===0){ if(P.vehicle===D.playerCar){ M.step=1; D.count=4; D.playerCar.setLabel(null); M.setMarker(null); } return; }
      if(M.step===1){ D.count-=dt; const n=Math.ceil(D.count); M.setObjective(n>0?`Race starts in ${n}...`:'GO!'); if(D.count<=0){ M.step=2; G.big={text:'GO!',color:'#5fd97a',t:1.2}; for(const v of D.racers){ v.ai={mode:'traffic',speedMul:rnd(1.7,2.0),reckless:true}; v.setRoute(G.world.route(G.world.nearestNode(v.x,v.z),D.cps[0]),G); v.ai.onRouteEnd=(veh)=>{ veh.racerIdx++; if(veh.racerIdx>=D.cps.length){ M.fail('Another racer won!'); return false; } veh.setRoute(G.world.route(veh.ai.next,D.cps[veh.racerIdx]),G); return true; }; } const cp=D.cps[0]; M.setMarker(cp.x,cp.z,7.5,'#ff5fa0','Checkpoint 1'); } else { for(const v of D.racers){ v.ctrl.throttle=0; v.ctrl.handbrake=true; } } return; }
      if(M.step===2){ const cp=D.cps[D.idx]; M.setObjective(`Checkpoint ${D.idx+1}/${D.cps.length}`); if(P.vehicle && dist(P.vehicle.x,P.vehicle.z,cp.x,cp.z)<7.5){ D.idx++; G.audio.pickup(); if(D.idx>=D.cps.length){ M.pass(); return; } const n=D.cps[D.idx]; M.setMarker(n.x,n.z,7.5,'#ff5fa0',D.idx===D.cps.length-1?'FINISH':'Checkpoint '+(D.idx+1)); } } },
    hudLines(M){ const D=M.data; if(M.step<2) return []; const pos=1+D.racers.filter(v=>v.racerIdx>D.idx||(v.racerIdx===D.idx&&dist(v.x,v.z,D.cps[D.idx].x,D.cps[D.idx].z)<dist(M.G.player.x,M.G.player.z,D.cps[D.idx].x,D.cps[D.idx].z))).length; return [`POSITION ${pos}/4`]; } },
  { id:'convoy', name:'Cartel Convoy', contact:'Tony', at:'docks', reward:5000,
    brief:[{who:'Tony',text:"Lucia says you're reliable. Good, because the cartel is moving product through my city in a convoy of vans tonight."},{who:'Tony',text:"Three vans, heading for their compound in the north-east. Wreck every one of them before they get there. I left an RPG in the crate outside."}],
    setup(M){ const G=M.G; const d=G.world.loc('docks'); G.spawnPickup(d.x-9,d.z,'weapon',{weapon:'rocket',ammo:4,missionItem:true});
      const comp=G.world.loc('compound'); const endNode=G.world.nearestNode(comp.x,comp.z); const startNode=G.world.randomNodeNear(endNode.x,endNode.z,275,500);
      const route=G.world.route(startNode,endNode); M.data.vans=[]; M.data.route=route;
      for(let i=0;i<3;i++){ const a=route[0], b=route[1]; const dx=b.x-a.x,dz=b.z-a.z,L=Math.hypot(dx,dz),ux=dx/L,uz=dz/L,rx=-uz,rz=ux; const v=G.spawnVehicle('van',a.x+ux*(-9*i)+rx*T,a.z+uz*(-9*i)+rz*T,Math.atan2(uz,ux),[40,40,45]); v.mission=true; v.setLabel('CARTEL'); const drv=M.spawnPed(v.x,v.z,'gang',{shirt:[120,40,160]}); v.addOccupant(drv,true); const g2=M.spawnPed(v.x,v.z,'gang',{shirt:[120,40,160],weapon:'smg'}); v.addOccupant(g2,false); v.ai={mode:'traffic',speedMul:0.95+i*0.05,reckless:false}; v.setRoute(route,G); v.ai.stopAtEnd=true; v.ai.onRouteEnd=()=>{ M.fail('The convoy reached the compound!'); return false; }; M.data.vans.push(v); M.blipEntity(v); }
      M.setObjective('Destroy the three cartel vans (3 left)'); M.setMarker(d.x-9,d.z,3.2,'#ffd23f','RPG'); },
    update(M,dt){ const G=M.G; const left=M.data.vans.filter(v=>!v.wrecked); M.setObjective(`Destroy the cartel vans (${left.length} left)`); if(M.data.vans.some(v=>v.wrecked)&&M.marker) M.setMarker(null); if(!left.length){ M.pass(); return; }
      for(const v of left){ if(v.ai&&v.ai.done){ M.fail('The convoy reached the compound!'); return; } } } },
  { id:'heist', name:'The Big Score', contact:'Tony', at:'docks', reward:12000,
    brief:[{who:'Tony',text:"Leonida Bank. Two million in the vault, and the manager's cousin is on my payroll. Tonight, the vault opens for thirty seconds."},{who:'Tony',text:"Get inside, hold the floor until it opens, grab the cash. Every cop in the city will come running. Bring the money back here, the warehouse is off the books."}],
    setup(M){ const G=M.G; const b=G.world.loc('bank'); M.step=0; M.setMarker(b.x,b.z,3.7,'#ffd23f','Leonida Bank'); M.setObjective('Get to Leonida Bank'); M.data.wait=30; },
    update(M,dt){ const G=M.G,P=G.player; const b=G.world.loc('bank');
      if(M.step===0 && M.playerInMarker()){ M.step=1; G.notify('Alarm triggered! Hold the floor!','#ff5050'); G.addCrime(2); }
      if(M.step===1){ const inside=dist(P.x,P.z,b.x,b.z)<9; if(inside){ M.data.wait-=dt; M.setObjective('Hold the floor until the vault opens'); M.countdown=M.data.wait; if(Math.random()<dt*0.35 && G.player.wanted<3) G.addCrime(0.6); } else { M.setObjective('Get back inside the bank!'); }
        if(M.data.wait<=0){ M.step=2; M.countdown=null; G.addCrime(6); G.audio.cash(); G.notify('You grabbed the cash!','#5fd97a'); const d=G.world.loc('docks'); M.setMarker(d.x,d.z,6,'#ffd23f',"Tony's Warehouse"); } }
      if(M.step===2){ M.setObjective("Escape to Tony's Warehouse with the cash"); if(M.playerInMarker()){ G.player.heat=0; M.pass(); } } } },
  { id:'kingpin', name:'Kingpin', contact:'Tony', at:'docks', reward:25000,
    brief:[{who:'Tony',text:"The cartel boss, El Serpiente, knows it was us. He's holed up in his compound with his whole crew and he's coming for all of us."},{who:'Tony',text:"So we finish it. Go in there and take them all out. Every last one. Do this and the whole city is yours, kid."}],
    setup(M){ const G=M.G; const c=G.world.loc('compound'); M.step=0; M.setMarker(c.x,c.z+2.5,7.5,'#ffd23f','Cartel Compound'); M.setObjective('Go to the Cartel Compound');
      const cell=c.cell; const cx0=(cell.x0+1)*T, cz0=(cell.y0+1)*T, cx1=(cell.x1)*T, cz1=(cell.y1)*T; M.data.crew=[];
      for(let i=0;i<9;i++){ let p=null; for(let k=0;k<30;k++){ const x=rnd(cx0,cx1), z=rnd(cz0,cz1); if(!G.world.solidAt(x,z)){ p={x,z}; break; } } if(!p) p={x:c.x,z:c.z-6}; const g=M.spawnPed(p.x,p.z,'gang',{aggro:true,aggroRange:41,shirt:[120,40,160],weapon:pick(['pistol','smg','smg','shotgun'])}); g.leash=32; M.data.crew.push(g); M.blipEntity(g); }
      const boss=M.spawnPed(c.building.x+c.building.w/2,c.building.z-4,'boss',{name:'El Serpiente',aggro:true,aggroRange:47,important:true}); M.data.boss=boss; M.blipEntity(boss);
      for(let i=0;i<2;i++){ const s=G.world.parkSpots.filter(sp=>sp.kind==='compound'); if(s.length){ const sp=pick(s); if(G.vehicles.some(v=>dist(v.x,v.z,sp.x,sp.z)<3)) continue; const v=G.spawnVehicle('muscle',sp.x,sp.z,sp.angle,[60,20,80]); v.mission=true; } } },
    update(M,dt){ const G=M.G; const alive=M.data.crew.filter(p=>!p.dead); if(M.step===0 && M.playerInMarker()){ M.step=1; M.setMarker(null); }
      if(M.step>=1){ if(alive.length) M.setObjective(`Wipe out the cartel crew (${alive.length} left)`); else if(!M.data.boss.dead) M.setObjective('Kill El Serpiente!'); else { M.pass(); G.credits=12; } } } },
];

// ================= MISSION SYSTEM =================
class MissionSystem{
  constructor(G){ this.G=G; this.current=null; this.step=0; this.data={}; this.objective=''; this.timer=null; this.marker=null; this.entBlips=[]; this.entities=[]; this.side=null; this.sideData={}; this.failCd=0; }
  get available(){ return MISSIONS[this.G.progress.missionIdx]||null; }
  contactPos(m){ const l=this.G.world.loc(m.at); return {x:l.x,z:l.z}; }
  markers(){ const out=[]; if(this.current){ if(this.marker) out.push(this.marker); } else { const m=this.available; if(m && this.failCd<=0){ const p=this.contactPos(m); out.push({x:p.x,z:p.z,r:3,color:'#ffd23f',icon:m.contact[0],label:m.contact}); } }
    if(this.side&&this.sideData.marker) out.push(this.sideData.marker); return out; }
  blips(){ const out=[]; for(const m of this.markers()) out.push({x:m.x,z:m.z,color:m.color,r:5}); for(const e of this.entBlips){ if(e.dead||e.wrecked||e.removed) continue; out.push({x:e.x,z:e.z,color:e.blip||'#ff4040',r:4}); } return out; }
  targetPos(){ if(!this.current&&this.side){ const st=this.sideTarget(); if(st) return st; } if(this.current&&this.marker) return this.marker; if(this.current&&this.entBlips.length){ const e=this.entBlips.find(e=>!e.dead&&!e.wrecked&&!e.removed); if(e) return {x:e.x,z:e.z,color:'#ff4040'}; } if(this.side&&this.sideData.marker) return this.sideData.marker; if(!this.current){ const m=this.available; if(m&&this.failCd<=0){ const p=this.contactPos(m); return {x:p.x,z:p.z,color:'#ffd23f'}; } } return null; }
  displayTimer(){ if(this.current) return this.timer!=null?this.timer:this.countdown; if(this.side&&this.sideData.timer!=null) return this.sideData.timer; return null; }
  objectiveText(){ if(this.current) return this.objective + (this.side&&this.sideData.objective? '   |   '+this.sideData.objective:''); if(this.side) return this.sideData.objective||''; const m=this.available; if(m) return `Go see ${m.contact} for a mission: ${m.name}`; return 'You own this city. Free roam.'; }
  setObjective(t){ this.objective=t; }
  setMarker(x,z,r,color,label){ this.marker = x===null? null : {x,z,r,color,label}; }
  blipEntity(e){ this.entBlips.push(e); }
  clearBlips(){ this.entBlips=[]; }
  playerInMarker(needVehicle){ const m=this.marker; if(!m) return false; const P=this.G.player; if(needVehicle&&!P.vehicle) return false; return dist(P.x,P.z,m.x,m.z)<m.r; }
  spawnPed(x,z,kind,opts){ const p=this.G.spawnPed(x,z,kind,opts); p.mission=true; if(kind!=='cop'&&kind!=='swat'&&kind!=='civ') p.noCrime=true; this.entities.push(p); return p; }
  update(dt){
    const G=this.G, P=G.player; if(this.failCd>0) this.failCd-=dt;
    if(this.current){
      if(P.dead||G.busted){ this.fail(P.dead?'You died.':'You got busted.'); return; }
      if(this.timer!==null&&this.timer!==undefined){ this.timer-=dt; if(this.timer<=0){ this.timer=null; this.fail('Out of time!'); return; } }
      this.current.update(this,dt);
    } else {
      const m=this.available; if(m&&this.failCd<=0&&!P.vehicle&&!P.dead){ const p=this.contactPos(m); if(dist(P.x,P.z,p.x,p.z)<3 && P.wanted===0) this.start(m); else if(dist(P.x,P.z,p.x,p.z)<3 && P.wanted>0){ G.hint='Lose the cops before starting a mission'; G.hintT=2; } }
    }
    if(this.side) this.updateSide(dt);
  }
  start(m){ const G=this.G; G.big=null; G.showDialog(m.brief,()=>{ this.current=m; this.step=0; this.data={}; this.timer=null; this.countdown=null; this.marker=null; this.entBlips=[]; this.entities=[]; this.objective=''; m.setup(this); G.notify('MISSION: '+m.name,'#ffd23f'); }); }
  pass(){ const G=this.G, m=this.current; if(!m) return; G.player.money+=m.reward; G.progress.missionIdx++; G.stats.missionsPassed++; G.big={text:'MISSION PASSED',sub:'+'+fmtMoney(m.reward),color:'#ffd23f',t:4}; G.audio.missionPass(); this.cleanup(false); G.save(); const nx=this.available; if(nx) setTimeout(()=>G.notify(`New mission available from ${nx.contact}`,'#ffd23f'),3000); }
  fail(reason){ const G=this.G; if(!this.current) return; G.big={text:'MISSION FAILED',sub:reason,color:'#ff5050',t:4}; G.audio.fail(); this.cleanup(true); this.failCd=3; }
  cleanup(failed){ const G=this.G; for(const e of this.entities){ if(!e.dead) e.removed=true; } for(const v of G.vehicles){ if(v.mission){ if(failed||v.wrecked||!v.driver||!v.driver.isPlayer){ if(v.driver&&v.driver.isPlayer){ v.mission=false; v.setLabel(null); } else v.removed=true; } else { v.mission=false; v.setLabel(null); } } }
    for(const p of G.pickups) if(p.missionItem) p.removed=true; this.current=null; this.marker=null; this.entBlips=[]; this.entities=[]; this.timer=null; this.countdown=null; this.objective=''; }
  // ---------- side missions: taxi & vigilante ----------
  startSide(kind){ const G=this.G; this.side=kind; this.sideData={level:1,earned:0}; if(kind==='taxi'){ G.notify('Taxi job started! Pick up fares.','#ffd23f'); this.nextFare(); } else { G.notify('Vigilante job started! Take down criminals.','#7090ff'); this.nextCriminal(); } }
  endSide(msg){ const G=this.G; if(!this.side) return; G.notify(msg||`Job over. Earned ${fmtMoney(this.sideData.earned)}`,'#ffd23f'); if(this.sideData.fare&&!this.sideData.fare.dead){ this.sideData.fare.removed=true; } if(this.sideData.crim){ this.sideData.crim.mission=false; this.sideData.crim.setLabel(null); } this.side=null; this.sideData={}; }
  nextFare(){ const G=this.G,P=G.player,D=this.sideData; const spot=G.world.randomWalkableNear(P.x,P.z,50,125)||G.world.randomWalkableNear(P.x,P.z,12,250); const fare=G.spawnPed(spot.x,spot.z,'civ',{noCrime:true}); fare.state='idle'; fare.fearless=true; fare.name='FARE'; D.fare=fare; D.phase='pickup'; D.marker={x:spot.x,z:spot.z,r:5,color:'#ffd23f',label:'Fare'}; D.objective='Pick up the fare'; D.timer=null; }
  nextCriminal(){ const G=this.G,P=G.player,D=this.sideData; const n=G.world.randomNodeNear(P.x,P.z,62,137); const nb=pick(n.nb); const v=G.spawnVehicle(pick(['sedan','muscle','sports']),n.x+(nb.x-n.x)*0.1,n.z+(nb.z-n.z)*0.1,angTo(n.x,n.z,nb.x,nb.z)); const d=G.spawnPed(v.x,v.z,'gang',{noCrime:true,weapon:'smg'}); d.name='CRIMINAL'; v.addOccupant(d,true); v.ai={mode:'traffic',speedMul:1.6,reckless:true}; v.mission=true; v.setLabel('CRIMINAL'); D.crim=v; D.crimPed=d; D.objective=`Take down the criminal (level ${D.level})`; D.timer=75; D.marker=null; }
  updateSide(dt){ const G=this.G,P=G.player,D=this.sideData;
    if(this.side==='taxi'){ if(!P.vehicle||!P.vehicle.stats.taxi){ this.endSide('You left the taxi. Job over.'); return; }
      if(D.timer!==null&&D.timer!==undefined){ D.timer-=dt; if(D.timer<=0){ this.endSide('Too slow! The fare walked off.'); return; } }
      const f=D.fare; if(!f||f.dead){ this.endSide('You killed your fare! Job over.'); return; }
      if(D.phase==='pickup'){ if(dist(P.vehicle.x,P.vehicle.z,f.x,f.z)<6&&Math.abs(P.vehicle.speed)<2){ P.vehicle.addOccupant(f,false); f.name=null; const dest=G.world.randomNodeNear(P.x,P.z,88,225); const spot=G.world.randomWalkableNear(dest.x,dest.z,5,15)||dest; D.dest=spot; D.phase='drop'; D.marker={x:spot.x,z:spot.z,r:6,color:'#ffd23f',label:'Destination'}; const d=dist(P.x,P.z,spot.x,spot.z); D.timer=12+d/17.5; D.fareVal=Math.round(40+d*0.72); D.objective=`Drop off the fare (${fmtMoney(D.fareVal)})`; G.audio.pickup(); } }
      else if(dist(P.vehicle.x,P.vehicle.z,D.dest.x,D.dest.z)<6&&Math.abs(P.vehicle.speed)<2){ P.vehicle.removeOccupant(f,G); f.removed=true; f.mission=false; const tip=D.timer>10?Math.round(D.fareVal*0.5):0; P.money+=D.fareVal+tip; D.earned+=D.fareVal+tip; G.audio.cash(); G.floatText(P.x,P.y+2,P.z,'+'+fmtMoney(D.fareVal+tip),'#5fd97a'); G.stats.fares++; D.level++; this.nextFare(); } }
    else if(this.side==='vigilante'){ if(!P.vehicle||!P.vehicle.isPolice){ this.endSide('You left the police vehicle. Job over.'); return; }
      D.timer-=dt; if(D.timer<=0){ this.endSide('The criminal escaped. Job over.'); return; }
      const v=D.crim, d=D.crimPed; if(v.wrecked||d.dead){ const rew=200*D.level; P.money+=rew; D.earned+=rew; G.floatText(P.x,P.y+2,P.z,'+'+fmtMoney(rew),'#5fd97a'); G.audio.cash(); G.stats.criminals++; D.level++; if(!v.wrecked){ v.mission=false; v.setLabel(null); } this.nextCriminal(); }
      else if(!v.driver){ d.state='flee'; d.fleeX=P.x; d.fleeZ=P.z; d.stateT=99; } }
  }
  sideBlips(){ const D=this.sideData; const out=[]; if(!this.side) return out; if(this.side==='taxi'&&D.fare&&!D.fare.vehicle) out.push({x:D.fare.x,z:D.fare.z,color:'#ffd23f',r:5}); if(this.side==='vigilante'&&D.crim){ const e=D.crim.wrecked?D.crimPed:D.crim; out.push({x:e.x,z:e.z,color:'#ff4040',r:5}); } return out; }
  sideTarget(){ const D=this.sideData; if(!this.side) return null; if(this.side==='taxi'){ if(D.phase==='pickup'&&D.fare) return {x:D.fare.x,z:D.fare.z,color:'#ffd23f'}; if(D.dest) return {x:D.dest.x,z:D.dest.z,color:'#ffd23f'}; } if(this.side==='vigilante'&&D.crim){ const e=D.crim.wrecked?D.crimPed:D.crim; return {x:e.x,z:e.z,color:'#ff4040'}; } return null; }
}
