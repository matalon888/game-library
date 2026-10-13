'use strict';
const SKINS=[[240,200,170],[210,160,120],[160,110,80],[110,75,50],[250,220,200]];
const PED_GEO={ head:new THREE.SphereGeometry(0.13,10,8), torso:new THREE.BoxGeometry(0.42,0.6,0.24), hips:new THREE.BoxGeometry(0.38,0.16,0.24), leg:new THREE.BoxGeometry(0.16,0.82,0.18).translate(0,-0.41,0), arm:new THREE.BoxGeometry(0.12,0.62,0.12).translate(0,-0.31,0), hair:new THREE.BoxGeometry(0.2,0.1,0.26), cap:new THREE.BoxGeometry(0.28,0.1,0.3), gun:new THREE.BoxGeometry(0.42,0.08,0.06), bat:new THREE.CylinderGeometry(0.035,0.025,0.85,6), vest:new THREE.BoxGeometry(0.44,0.4,0.28) };
class Ped{
  constructor(x,z,kind='civ',opts={},G){
    this.G=G; this.x=x;this.z=z;this.y=G?G.world.heightAt(x,z):0;this.angle=rnd(TAU);this.vx=0;this.vz=0;this.vy=0;this.r=0.35;this.kind=kind;
    this.hp=opts.hp||(kind==='boss'?450:kind==='swat'?160:100); this.maxHp=this.hp; this.armor=0;
    this.state='wander'; this.stateT=0; this.dir=rndi(0,3); this.wp=null; this.walkSpeed=rnd(1.2,1.8); this.runSpeed=kind==='target'?3.4:rnd(3.8,4.6);
    this.weapon=opts.weapon!==undefined?opts.weapon:(kind==='cop'?'pistol':kind==='gang'?(Math.random()<0.3?'smg':'pistol'):kind==='swat'?'rifle':kind==='boss'?'rifle':null);
    this.shootCd=rnd(0.3,1); this.burst=0; this.vehicle=null; this.knockT=0; this.anim=0; this.dead=false; this.deadT=0; this.crossing=false; this.target=null;
    this.fleeX=0; this.fleeZ=0; this.stuckT=0; this.lastX=x; this.lastZ=z; this.removed=false; this.isPlayer=false; this.mission=false; this.airborne=false; this.tumble=0;
    this.aggro=opts.aggro||false; this.aggroRange=opts.aggroRange||35; this.moving=false; this.id=Ped.nextId++; this.hitFlash=0; this.name=opts.name||null;
    this.important=!!opts.important; this.noCrime=!!opts.noCrime; this.arrestT=0; this.strafeDir=Math.random()<0.5?-1:1; this.accuracy=opts.accuracy||(kind==='swat'?0.06:kind==='boss'?0.05:kind==='cop'?0.13:0.15);
    this.colors=Ped.makeColors(kind,opts); this.blip=opts.blip||null; this.fearless=!!opts.fearless; this.homeX=x; this.homeZ=z; this.leash=opts.leash||0; this.speechT=0; this.wantSpeed=1; this.aimPitch=0;
    if(G) this.buildMesh(G);
  }
  static makeColors(kind,opts){
    const skin=pick(SKINS); const hair=pick([[30,25,20],[90,60,30],[200,170,90],[20,20,20],[120,40,30]]);
    switch(kind){
      case 'cop': return {skin,hair,shirt:[120,160,220],pants:[30,40,90],cap:[25,35,80]};
      case 'swat': return {skin,hair,shirt:[35,35,40],pants:[25,25,30],cap:[20,20,25],vest:true};
      case 'gang': return {skin,hair,shirt:opts.shirt||pick([[120,40,160],[160,30,30],[240,240,240]]),pants:[40,40,45]};
      case 'boss': return {skin,hair:[220,220,220],shirt:[250,250,250],pants:[240,240,240]};
      case 'target': return {skin,hair,shirt:[250,250,250],pants:[250,250,250]};
      case 'player': return {skin:[225,180,150],hair:[30,20,15],shirt:[240,90,140],pants:[60,100,180]};
      default: { const h=Math.random(); const shirt=hsv(h,rnd(0.4,0.9),rnd(0.6,1)); const pants=pick([[40,50,90],[30,30,30],[90,80,70],[200,200,200],[60,90,70]]); return {skin,hair,shirt,pants}; }
    }
  }
  buildMesh(G){
    const c=this.colors; const m=(col)=>new THREE.MeshLambertMaterial({color:col3(col)});
    this.mats={skin:m(c.skin),shirt:m(c.shirt),pants:m(c.pants),hair:m(c.hair)}; const M=this.mats;
    const root=this.mesh=new THREE.Group(); const body=this.bodyGrp=new THREE.Group(); root.add(body);
    const torso=new THREE.Mesh(PED_GEO.torso,M.shirt); torso.position.y=1.18; torso.castShadow=true; body.add(torso);
    const hips=new THREE.Mesh(PED_GEO.hips,M.pants); hips.position.y=0.86; body.add(hips);
    const head=new THREE.Mesh(PED_GEO.head,M.skin); head.position.y=1.62; body.add(head); this.head=head;
    if(c.cap){ const cap=new THREE.Mesh(PED_GEO.cap,m(c.cap)); cap.position.y=1.72; body.add(cap); } else { const hair=new THREE.Mesh(PED_GEO.hair,M.hair); hair.position.set(-0.02,1.72,0); body.add(hair); }
    if(c.vest){ const v=new THREE.Mesh(PED_GEO.vest,m([20,20,24])); v.position.y=1.2; body.add(v); }
    this.legs=[]; this.arms=[];
    for(const s of [-1,1]){ const lg=new THREE.Group(); lg.position.set(0,0.84,s*0.11); const lm=new THREE.Mesh(PED_GEO.leg,M.pants); lg.add(lm); body.add(lg); this.legs.push(lg);
      const ag=new THREE.Group(); ag.position.set(0,1.44,s*0.28); const am=new THREE.Mesh(PED_GEO.arm,M.shirt); ag.add(am); const hand=new THREE.Mesh(PED_GEO.head,M.skin); hand.scale.set(0.5,0.5,0.5); hand.position.y=-0.62; ag.add(hand); body.add(ag); this.arms.push(ag); }
    this.weaponMesh=null; this.setWeaponMesh();
    root.position.set(this.x,this.y,this.z); G.scene.add(root);
  }
  setWeaponMesh(){ const arm=this.arms&&this.arms[1]; if(!arm) return; if(this.weaponMesh){ arm.remove(this.weaponMesh); this.weaponMesh=null; } const W=this.weapon?WEAPONS[this.weapon]:null; if(!W) return;
    if(W.melee){ if(this.weapon==='bat'){ const b=new THREE.Mesh(PED_GEO.bat,new THREE.MeshLambertMaterial({color:0x8a5a2a})); b.position.set(0.2,-0.6,0); b.rotation.z=-0.4; arm.add(b); this.weaponMesh=b; } return; }
    const g=new THREE.Mesh(PED_GEO.gun,new THREE.MeshLambertMaterial({color:this.weapon==='rocket'?0x4a5a3a:0x222222})); const len=this.weapon==='pistol'?0.25:this.weapon==='rocket'?0.9:0.6; g.scale.x=len/0.42; g.position.set(0.12+len*0.3,-0.62,0); arm.add(g); this.weaponMesh=g; }
  get speedNow(){ return Math.hypot(this.vx,this.vz); }
  update(dt,G){
    if(this.dead){ this.deadT+=dt; this.updateMesh(dt,G); return; }
    this.shootCd-=dt; this.hitFlash-=dt; if(this.speechT>0) this.speechT-=dt;
    if(this.vehicle){ this.x=this.vehicle.x; this.z=this.vehicle.z; this.y=this.vehicle.y; this.updateMesh(dt,G); return; }
    if(this.state==='knocked'){ this.knockStep(dt,G); this.updateMesh(dt,G); return; }
    if(this.isPlayer){ this.move(dt,G); this.updateMesh(dt,G); return; }
    const P=G.player; const dP=dist(this.x,this.z,P.x,P.z);
    if(!this.fearless&&(this.kind==='civ'||(this.kind==='cop'&&P.wanted===0)||this.kind==='target')){
      if(G.lastShot.t>G.time-1.2&&dist(this.x,this.z,G.lastShot.x,G.lastShot.z)<40&&this.state!=='flee'){ this.flee(G.lastShot.x,G.lastShot.z,rnd(4,7)); }
      if(G.lastExplosion.t>G.time-1&&dist(this.x,this.z,G.lastExplosion.x,G.lastExplosion.z)<60&&this.state!=='flee'){ this.flee(G.lastExplosion.x,G.lastExplosion.z,rnd(5,8)); }
    }
    if(this.kind==='cop'||this.kind==='swat'){ if(P.wanted>0&&dP<110&&!P.dead&&this.state!=='knocked'){ this.state='attack'; this.target=P; } else if(this.state==='attack'&&(P.wanted===0||dP>160||P.dead)){ this.state='wander'; this.target=null; } }
    if(this.aggro&&!P.dead&&this.state!=='attack'&&dP<this.aggroRange&&G.world.lineOfSight(this.x,this.z,P.x,P.z)){ this.state='attack'; this.target=P; }
    if(this.kind==='target'&&dP<38&&this.state!=='flee'){ this.flee(P.x,P.z,999); }
    switch(this.state){
      case 'wander': this.wanderStep(dt,G); break;
      case 'flee': this.fleeStep(dt,G); break;
      case 'attack': this.attackStep(dt,G); break;
      case 'goto': this.gotoStep(dt,G); break;
      case 'idle': this.vx=this.vz=0; this.moving=false; break;
      default: this.wanderStep(dt,G);
    }
    this.move(dt,G);
    if(this.moving){ const moved=dist(this.x,this.z,this.lastX,this.lastZ); if(moved<this.wantSpeed*dt*0.25){ this.stuckT+=dt; if(this.stuckT>0.7){ this.stuckT=0; this.dir=(this.dir+(Math.random()<0.5?1:3))%4; this.wp=null; if(this.state==='flee'){ const a=rnd(TAU); this.fleeX=this.x-Math.cos(a)*12; this.fleeZ=this.z-Math.sin(a)*12; } if(this.state==='attack'){ this.strafeDir*=-1; this.detourT=0.6; this.detourA=this.angle+rnd(-2,2); } } } else this.stuckT=0; }
    this.lastX=this.x; this.lastZ=this.z;
    this.updateMesh(dt,G);
  }
  flee(fx,fz,t){ this.state='flee'; this.fleeX=fx; this.fleeZ=fz; this.stateT=t; this.wp=null; }
  setVel(ax,az,speed){ const d=Math.hypot(ax,az)||1; this.vx=ax/d*speed; this.vz=az/d*speed; this.angle=Math.atan2(az,ax); this.moving=true; this.wantSpeed=speed; }
  wanderStep(dt,G){ if(!this.wp) this.pickWp(G); const d=dist(this.x,this.z,this.wp.x,this.wp.z); if(d<0.5) this.pickWp(G); this.setVel(this.wp.x-this.x,this.wp.z-this.z,this.walkSpeed); }
  pickWp(G){
    const W=G.world; const tx=Math.floor(this.x/T), tz=Math.floor(this.z/T); const DX=[1,0,-1,0], DZ=[0,1,0,-1];
    const cur=W.tile(tx,tz); if(cur!==TILE.ROAD) this.crossing=false;
    const order=[this.dir,this.dir,this.dir,(this.dir+1)%4,(this.dir+3)%4,(this.dir+2)%4];
    const r=Math.random(); const cands=r<0.7?order:[(this.dir+1)%4,(this.dir+3)%4,this.dir,(this.dir+2)%4];
    for(const d of cands){ const nx=tx+DX[d], nz=tz+DZ[d]; const t=W.tile(nx,nz); if(!PED_OK[t]) continue;
      if(t===TILE.ROAD){ if(!this.crossing){ if(Math.random()<0.06&&cur!==TILE.ROAD) this.crossing=true; else continue; } if(d!==this.dir&&cur===TILE.ROAD) continue; }
      if(this.leash&&dist((nx+0.5)*T,(nz+0.5)*T,this.homeX,this.homeZ)>this.leash) continue;
      this.dir=d; this.wp={x:(nx+0.5)*T,z:(nz+0.5)*T}; return; }
    this.wp={x:(tx+0.5)*T,z:(tz+0.5)*T}; this.dir=rndi(0,3);
  }
  fleeStep(dt,G){
    this.stateT-=dt; if(this.stateT<=0){ this.state='wander'; this.wp=null; return; }
    let ax=this.x-this.fleeX, az=this.z-this.fleeZ; const d=Math.hypot(ax,az)||1; ax/=d; az/=d;
    const wob=Math.sin(G.time*3+this.id)*0.5; const cx=ax*Math.cos(wob)-az*Math.sin(wob), cz=ax*Math.sin(wob)+az*Math.cos(wob);
    let vx=cx,vz=cz; if(G.world.solidAt(this.x+vx*3,this.z+vz*3)){ if(!G.world.solidAt(this.x-vz*3,this.z+vx*3)){ const t=vx; vx=-vz; vz=t; } else { const t=vx; vx=vz; vz=-t; } }
    this.setVel(vx,vz,this.runSpeed); if(this.kind==='target'&&this.stateT>100) this.stateT=200;
  }
  gotoStep(dt,G){
    if(!this.gotoT){ this.state='wander'; return; }
    const d=dist(this.x,this.z,this.gotoT.x,this.gotoT.z); if(d<0.8){ this.state=this.gotoThen||'idle'; this.vx=this.vz=0; this.moving=false; if(this.onArrive){ const f=this.onArrive; this.onArrive=null; f(this,G);} return; }
    let ax=this.gotoT.x-this.x, az=this.gotoT.z-this.z; const L=Math.hypot(ax,az); ax/=L; az/=L;
    if(G.world.solidAt(this.x+ax*2.5,this.z+az*2.5)){ if(!G.world.solidAt(this.x-az*2.5,this.z+ax*2.5)){ const t=ax; ax=-az; az=t; } else { const t=ax; ax=az; az=-t; } }
    this.setVel(ax,az,this.gotoRun?this.runSpeed:this.walkSpeed);
  }
  attackStep(dt,G){
    const tgt=this.target; if(!tgt||tgt.dead){ this.state='wander'; this.target=null; this.wp=null; return; }
    const tv=tgt.vehicle||tgt; const d=dist(this.x,this.z,tv.x,tv.z); const a=angTo(this.x,this.z,tv.x,tv.z);
    const los=G.world.lineOfSight(this.x,this.z,tv.x,tv.z);
    let wpn=this.weapon; if(this.kind==='cop'&&tgt.isPlayer&&tgt.wanted<=2&&!tgt.vehicle&&G.time-G.lastShot.t>4) wpn=null;
    const keep=wpn?(wpn==='shotgun'?12:wpn==='rifle'?27:21):0;
    if(this.detourT>0){ this.detourT-=dt; this.setVel(Math.cos(this.detourA),Math.sin(this.detourA),this.runSpeed); return; }
    let mx=0,mz=0;
    if(!los||d>keep+5||(!wpn&&d>1.6)){ mx=Math.cos(a); mz=Math.sin(a); if(G.world.solidAt(this.x+mx*2.7,this.z+mz*2.7)){ if(!G.world.solidAt(this.x-mz*2.7,this.z+mx*2.7)){ const t=mx; mx=-mz; mz=t; } else { const t=mx; mx=mz; mz=-t; } } }
    else if(d<keep-6&&wpn){ mx=-Math.cos(a); mz=-Math.sin(a); }
    else if(wpn){ const px=-Math.sin(a)*this.strafeDir, pz=Math.cos(a)*this.strafeDir; if(!G.world.solidAt(this.x+px*2.5,this.z+pz*2.5)){ mx=px*0.6; mz=pz*0.6; } else this.strafeDir*=-1; }
    if(mx||mz) this.setVel(mx,mz,this.runSpeed*(wpn&&los?0.7:1)); else { this.vx=this.vz=0; this.moving=false; }
    if(los) this.angle=a;
    if(wpn&&los&&d<55&&this.shootCd<=0&&!G.player.dead){
      const W=WEAPONS[wpn]; if(this.burst<=0){ this.burst=W.auto?rndi(3,6):1; }
      const ty=tv.y!==undefined?tv.y:this.y; const aimY=(tgt.vehicle?ty+0.6:ty+1.1);
      G.fireBullet(this,{x:this.x,y:this.y+1.35,z:this.z},{x:tv.x,y:aimY,z:tv.z},wpn,this.accuracy);
      this.burst--; this.shootCd=this.burst>0?W.rate:(W.rate*1.5+rnd(0.5,1.2)); if(wpn==='pistol') this.shootCd=this.burst>0?W.rate*2:rnd(0.6,1.3);
    }
    if(!wpn&&d<1.7&&this.shootCd<=0&&!tgt.vehicle){ this.shootCd=0.6; tgt.damage(this.kind==='cop'?5:10,this,G,'melee'); G.audio.punch(); this.punchT=0.25; }
    if((this.kind==='cop'||this.kind==='swat')&&tgt.isPlayer){
      const canGrab=(!tgt.vehicle&&d<2.2&&tgt.speedNow<2.0)||(tgt.vehicle&&Math.abs(tgt.vehicle.speed)<1.5&&d<5);
      if(canGrab&&tgt.wanted>0){ this.arrestT+=dt; if(this.arrestT>(tgt.vehicle?1.6:0.8)) G.bust(); } else this.arrestT=Math.max(0,this.arrestT-dt);
    }
  }
  move(dt,G){
    const W=G.world, r=this.r;
    this.x+=this.vx*dt; for(const [tx,tz] of this.overlapTiles(W)){ if(this.vx>0) this.x=tx*T-r-0.01; else if(this.vx<0) this.x=(tx+1)*T+r+0.01; }
    this.z+=this.vz*dt; for(const [tx,tz] of this.overlapTiles(W)){ if(this.vz>0) this.z=tz*T-r-0.01; else if(this.vz<0) this.z=(tz+1)*T+r+0.01; }
    const m=4*T+0.5; this.x=clamp(this.x,m,W.size-m); this.z=clamp(this.z,m,W.size-m);
    const gy=W.heightAt(this.x,this.z); this.y=damp(this.y,gy,20,dt); if(Math.abs(this.y-gy)<0.01) this.y=gy;
    this.anim+=Math.hypot(this.vx,this.vz)*dt*1.1;
  }
  overlapTiles(W){ const r=this.r; const out=[]; const tx0=Math.floor((this.x-r)/T), tz0=Math.floor((this.z-r)/T), tx1=Math.floor((this.x+r)/T), tz1=Math.floor((this.z+r)/T); for(let tz=tz0;tz<=tz1;tz++) for(let tx=tx0;tx<=tx1;tx++) if(SOLID[W.tile(tx,tz)]) out.push([tx,tz]); return out; }
  knockStep(dt,G){
    const W=G.world; this.vy-=9.81*dt; this.x+=this.vx*dt; this.z+=this.vz*dt; this.y+=this.vy*dt; const gy=W.heightAt(this.x,this.z);
    for(const [tx,tz] of this.overlapTiles(W)){ const cx=(tx+0.5)*T, cz=(tz+0.5)*T; const dx=this.x-cx, dz=this.z-cz; if(Math.abs(dx)>Math.abs(dz)){ this.x=cx+Math.sign(dx)*(T/2+this.r); this.vx*=-0.3; } else { this.z=cz+Math.sign(dz)*(T/2+this.r); this.vz*=-0.3; } }
    if(this.y<=gy){ this.y=gy; if(this.vy<-4&&this.airborne){ this.damage(-this.vy*1.5,this.knockSrc,G,'fall'); } this.vy=0; this.airborne=false; const f=Math.pow(0.02,dt); this.vx*=f; this.vz*=f; } else { this.airborne=true; this.tumble+=dt*7; }
    const m=4*T+0.5; this.x=clamp(this.x,m,W.size-m); this.z=clamp(this.z,m,W.size-m);
    if(!this.airborne){ this.knockT-=dt; if(this.knockT<=0&&!this.dead){ this.state=this.isPlayer?'idle':'flee'; this.stateT=rnd(3,5); this.vx=this.vz=0; this.tumble=0; } }
  }
  damage(amount,src,G,type){
    if(this.dead) return;
    if(this.isPlayer){ if(G.godMode) return; if(this.armor>0){ const a=Math.min(this.armor,amount*0.75); this.armor-=a; amount-=a; } G.hurtFlash=0.3; }
    this.hp-=amount; this.hitFlash=0.12;
    const byPlayer=src&&(src.isPlayer||(src.driver&&src.driver.isPlayer));
    if(!this.isPlayer){
      if(this.kind==='civ'&&this.state!=='flee'&&this.state!=='knocked'&&src) this.flee(src.x,src.z,rnd(4,7));
      if((this.kind==='gang'||this.kind==='boss')&&byPlayer){ this.state='attack'; this.target=G.player; this.aggro=true; }
      if(this.kind==='cop'&&byPlayer&&!this.noCrime) G.addCrime(type==='melee'?0.4:0.7);
      if(this.kind==='civ'&&byPlayer&&!this.noCrime&&type==='bullet') G.addCrime(0.12);
    }
    if(this.hp<=0) this.die(src,G);
  }
  die(src,G){
    if(this.dead) return; this.dead=true; this.state='dead'; this.deadT=0; this.vx=this.vz=0; this.moving=false;
    if(this.vehicle){ const v=this.vehicle; const i=v.occupants.indexOf(this); if(i>=0) v.occupants.splice(i,1); if(v.driver===this){ v.driver=null; if(v.ai&&v.ai.mode!=='parked'&&!v.isPolice) v.ai=null; } this.vehicle=null; if(!this.isPlayer){ const p=v.worldPoint(0,-(v.w/2+1.2)); this.x=p.x; this.z=p.z; this.y=G.world.heightAt(p.x,p.z); } if(this.mesh){ if(this.mesh.parent!==G.scene){ this.mesh.parent.remove(this.mesh); G.scene.add(this.mesh); } this.mesh.visible=true; } }
    G.fx.decal('blood',this.x,this.y,this.z,rnd(1.0,1.6));
    if(this.isPlayer){ G.onPlayerDeath(); return; }
    G.onKill(this,src);
  }
  knock(vx,vz,vy,dmg,src,G){
    if(this.dead) return; this.vx=vx; this.vz=vz; this.vy=vy; this.state='knocked'; this.knockT=rnd(1.2,2.0); this.wp=null; this.moving=false; this.airborne=true; this.knockSrc=src; this.tumble=0;
    for(let i=0;i<5;i++) G.fx.blood(this.x,this.y+1,this.z);
    if(dmg>0) this.damage(dmg,src,G,'vehicle');
  }
  // -------- visuals --------
  updateMesh(dt,G){
    const M=this.mesh; if(!M) return;
    if(this.vehicle){ if(this.vehicle.stats.bike){ if(M.parent!==this.vehicle.inner){ if(M.parent) M.parent.remove(M); this.vehicle.inner.add(M); } M.position.set(-0.32,0.5,0); M.rotation.set(0,0,0); this.bodyGrp.rotation.set(0,0,0.15); for(const l of this.legs) l.rotation.z=1.3; for(const a of this.arms) a.rotation.z=1.0; M.visible=true; } else M.visible=false; return; }
    if(M.parent!==G.scene){ if(M.parent) M.parent.remove(M); G.scene.add(M); }
    const far=dist(this.x,this.z,G.camX||0,G.camZ||0)>170; M.visible=!far; if(far) return;
    M.position.set(this.x,this.y,this.z); M.rotation.set(0,-this.angle,0);
    const B=this.bodyGrp;
    if(this.dead){ const t=Math.min(this.deadT*4,1); B.rotation.set(0,0,-Math.PI/2*t); B.position.y=0.25*t; for(const l of this.legs) l.rotation.z=0; for(const a of this.arms) a.rotation.z=0.3; if(this.deadT>25) M.visible=this.deadT%0.4<0.2; return; }
    if(this.state==='knocked'){ if(this.airborne){ B.rotation.set(0,0,this.tumble); B.position.y=0.6; } else { B.rotation.set(0,0,-Math.PI/2); B.position.y=0.25; } return; }
    B.rotation.set(0,0,0); B.position.y=0;
    const sw=this.moving?Math.sin(this.anim*4.2)*0.7*Math.min(1,this.speedNow/2):0;
    this.legs[0].rotation.z=sw; this.legs[1].rotation.z=-sw;
    const W=this.weapon?WEAPONS[this.weapon]:null; const aiming=W&&!W.melee&&(this.state==='attack'||this.isPlayer&&(this.aiming||this.shootCd>0.0));
    if(aiming){ this.arms[1].rotation.z=Math.PI/2-this.aimPitch; this.arms[0].rotation.z=Math.PI/2*0.7-this.aimPitch; this.arms[0].rotation.y=0.35; if(this.weaponMesh) this.weaponMesh.visible=true; }
    else { this.arms[0].rotation.y=0; this.arms[1].rotation.z=-sw*0.8+(this.punchT>0?1.2:0); this.arms[0].rotation.z=sw*0.8; if(this.weaponMesh) this.weaponMesh.visible=!!W; }
    if(this.punchT>0) this.punchT-=dt;
    if(this.hitFlash>0){ this.mats.shirt.emissive.setRGB(0.6,0.6,0.6); } else this.mats.shirt.emissive.setRGB(0,0,0);
  }
  dispose(G){ if(this.mesh){ if(this.mesh.parent) this.mesh.parent.remove(this.mesh); for(const k in this.mats) this.mats[k].dispose(); this.mesh=null; } }
}
Ped.nextId=1;
