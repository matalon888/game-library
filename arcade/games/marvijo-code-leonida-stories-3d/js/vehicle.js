'use strict';
// Vehicle specs (SI units). torque in Nm, mass kg, dims m. hp = durability.
const VEH_TYPES={
  sedan:  {name:'Sedan',L:4.5,W:1.82,H:1.42,mass:1400,comH:0.5,wheelR:0.32,wb:2.7,track:1.56,fBias:0.56,torque:245,idle:900,redline:6500,gears:[3.4,2.0,1.35,1.0,0.8],final:3.9,drive:'rwd',mu:1.05,brake:3200,cdA:0.75,maxSteer:0.6,sag:0.3,zeta:0.5,hp:100,profile:'sedan'},
  compact:{name:'Compact',L:3.9,W:1.7,H:1.5,mass:1100,comH:0.52,wheelR:0.3,wb:2.5,track:1.48,fBias:0.6,torque:175,idle:900,redline:6300,gears:[3.6,2.1,1.4,1.0,0.82],final:4.1,drive:'fwd',mu:1.0,brake:2600,cdA:0.7,maxSteer:0.62,sag:0.32,zeta:0.45,hp:80,profile:'compact'},
  sports: {name:'Sports Car',L:4.4,W:1.92,H:1.2,mass:1350,comH:0.4,wheelR:0.34,wb:2.6,track:1.62,fBias:0.47,torque:470,idle:1000,redline:8000,gears:[3.2,2.1,1.5,1.15,0.92,0.78],final:3.7,drive:'rwd',mu:1.3,brake:4600,cdA:0.62,clA:0.9,maxSteer:0.58,sag:0.2,zeta:0.7,hp:90,profile:'sports'},
  muscle: {name:'Muscle Car',L:4.9,W:1.9,H:1.35,mass:1700,comH:0.5,wheelR:0.34,wb:2.85,track:1.6,fBias:0.55,torque:560,idle:800,redline:6200,gears:[2.9,1.8,1.3,1.0],final:3.55,drive:'rwd',mu:1.02,brake:3600,cdA:0.85,maxSteer:0.58,sag:0.3,zeta:0.45,hp:110,profile:'muscle'},
  taxi:   {name:'Taxi',L:4.5,W:1.82,H:1.42,mass:1450,comH:0.5,wheelR:0.32,wb:2.7,track:1.56,fBias:0.56,torque:250,idle:900,redline:6500,gears:[3.4,2.0,1.35,1.0,0.8],final:3.9,drive:'rwd',mu:1.05,brake:3200,cdA:0.76,maxSteer:0.6,sag:0.3,zeta:0.5,hp:100,fixedColor:[240,200,40],taxi:true,profile:'sedan'},
  police: {name:'Police Cruiser',L:4.9,W:1.9,H:1.45,mass:1800,comH:0.48,wheelR:0.33,wb:2.9,track:1.6,fBias:0.55,torque:420,idle:900,redline:6600,gears:[3.1,1.9,1.35,1.0,0.78],final:3.7,drive:'rwd',mu:1.15,brake:4200,cdA:0.8,maxSteer:0.6,sag:0.26,zeta:0.55,hp:140,fixedColor:[240,240,245],police:true,profile:'sedan'},
  van:    {name:'Van',L:5.2,W:2.0,H:2.2,mass:2300,comH:0.72,wheelR:0.34,wb:3.2,track:1.68,fBias:0.5,torque:330,idle:800,redline:5000,gears:[4.0,2.3,1.5,1.0,0.8],final:4.1,drive:'rwd',mu:0.95,brake:3800,cdA:1.4,maxSteer:0.58,sag:0.3,zeta:0.5,hp:150,profile:'van'},
  truck:  {name:'Truck',L:7.6,W:2.5,H:3.2,mass:6000,comH:1.0,wheelR:0.48,wb:4.6,track:2.0,fBias:0.42,torque:1400,idle:700,redline:2800,gears:[8.0,5.0,3.3,2.2,1.5,1.0],final:4.5,drive:'rwd',mu:0.9,brake:12000,cdA:3.2,maxSteer:0.55,sag:0.28,zeta:0.6,hp:240,profile:'truck'},
  bike:   {name:'Motorbike',L:2.1,W:0.6,H:1.1,mass:240,comH:0.55,wheelR:0.33,wb:1.45,track:0,fBias:0.5,torque:115,idle:1200,redline:11000,gears:[3.4,2.4,1.9,1.6,1.4,1.25],final:3.5,drive:'rwd',mu:1.15,brake:900,cdA:0.45,maxSteer:0.5,sag:0.28,zeta:0.55,hp:50,bike:true,profile:'bike'},
  swat:   {name:'SWAT Van',L:6.0,W:2.4,H:2.6,mass:4500,comH:0.9,wheelR:0.42,wb:3.6,track:1.95,fBias:0.5,torque:800,idle:800,redline:4200,gears:[4.5,2.6,1.7,1.15,0.9],final:4.3,drive:'awd',mu:1.0,brake:9000,cdA:2.2,maxSteer:0.56,sag:0.26,zeta:0.6,hp:320,fixedColor:[40,40,50],police:true,profile:'swat'},
  bus:    {name:'Bus',L:11,W:2.5,H:3.2,mass:11000,comH:1.0,wheelR:0.5,wb:6.0,track:2.05,fBias:0.4,torque:1700,idle:650,redline:2600,gears:[7.0,4.2,2.7,1.8,1.2,0.9],final:4.8,drive:'rwd',mu:0.9,brake:20000,cdA:4.5,maxSteer:0.5,sag:0.28,zeta:0.6,hp:260,fixedColor:[80,150,210],profile:'bus'},
};
const CAR_COLORS=[[210,40,40],[40,80,200],[240,240,240],[30,30,35],[200,200,60],[60,160,80],[240,120,50],[150,60,160],[120,120,130],[230,100,160],[60,200,200],[100,70,40]];
const TRAFFIC_KINDS=['sedan','sedan','sedan','compact','compact','sports','muscle','taxi','taxi','van','truck','bike','bus'];
const SHARED_GEO={};
function wheelGeo(r,w){ const k=r+'_'+w; if(!SHARED_GEO[k]){ const g=new THREE.CylinderGeometry(r,r,w,16); g.rotateX(Math.PI/2); SHARED_GEO[k]=g; } return SHARED_GEO[k]; }
const MAT={ rubber:new THREE.MeshLambertMaterial({color:0x151515}), hub:new THREE.MeshPhongMaterial({color:0xb8b8b8,shininess:60}), glass:new THREE.MeshPhongMaterial({color:0x1c2a3a,shininess:120,specular:0x8899aa}), dark:new THREE.MeshLambertMaterial({color:0x44464c}), chrome:new THREE.MeshPhongMaterial({color:0xcccccc,shininess:100}), red:new THREE.MeshLambertMaterial({color:0x300000,emissive:0xff2020,emissiveIntensity:0.4}), blue:new THREE.MeshLambertMaterial({color:0x000030,emissive:0x2040ff,emissiveIntensity:0.4}), wreck:new THREE.MeshLambertMaterial({color:0x1a1815}) };
function extrudeProfile(pts,L,depth,mat){ const s=new THREE.Shape(); pts.forEach((p,i)=>{ const x=p[0]*L, y=p[1]; if(i===0) s.moveTo(x,y); else s.lineTo(x,y); }); const g=new THREE.ExtrudeGeometry(s,{depth:depth-0.08,bevelEnabled:true,bevelThickness:0.04,bevelSize:0.04,bevelSegments:2}); g.translate(0,0,-(depth-0.08)/2); g.computeVertexNormals(); return new THREE.Mesh(g,mat); }
const PROFILES={
  sedan:{body:[[-0.5,0.3],[0.5,0.3],[0.5,0.62],[0.44,0.72],[0.18,0.76],[-0.36,0.78],[-0.5,0.7]],cabin:[[-0.36,0.76],[0.18,0.74],[0.06,1.4],[-0.28,1.42]]},
  compact:{body:[[-0.5,0.3],[0.5,0.3],[0.5,0.65],[0.42,0.78],[0.2,0.8],[-0.45,0.82],[-0.5,0.7]],cabin:[[-0.44,0.8],[0.2,0.78],[0.08,1.48],[-0.34,1.5]]},
  sports:{body:[[-0.5,0.22],[0.5,0.22],[0.5,0.5],[0.36,0.6],[-0.42,0.64],[-0.5,0.6]],cabin:[[-0.4,0.62],[0.24,0.58],[0.05,1.12],[-0.28,1.15]]},
  muscle:{body:[[-0.5,0.3],[0.5,0.3],[0.5,0.68],[0.44,0.76],[0.1,0.78],[-0.4,0.82],[-0.5,0.74]],cabin:[[-0.4,0.8],[0.1,0.77],[0.0,1.32],[-0.28,1.34]]},
  van:{body:[[-0.5,0.32],[0.5,0.32],[0.5,0.85],[0.44,0.95],[0.3,2.1],[-0.5,2.15]],cabin:[[0.3,1.0],[0.44,0.98],[0.32,2.05],[0.2,2.05]]},
  swat:{body:[[-0.5,0.4],[0.5,0.4],[0.5,1.0],[0.42,1.1],[0.3,2.5],[-0.5,2.55]],cabin:[[0.3,1.2],[0.42,1.15],[0.31,2.3],[0.2,2.3]]},
  truck:{body:[[-0.5,0.5],[0.5,0.5],[0.5,1.3],[0.44,1.5],[0.34,3.0],[0.2,3.0],[0.2,1.4],[-0.5,1.4]],cabin:[[0.34,1.6],[0.44,1.55],[0.36,2.9],[0.25,2.9]]},
  bus:{body:[[-0.5,0.45],[0.5,0.45],[0.5,3.1],[-0.5,3.1]],cabin:null},
};

class Vehicle{
  constructor(kind,x,z,angle,color,G){
    this.kind=kind; const s=this.stats=VEH_TYPES[kind]; this.G=G; this.id=Vehicle.nextId++;
    this.color=color||s.fixedColor||pick(CAR_COLORS); this.hp=s.hp; this.maxHp=s.hp;
    this.ctrl={throttle:0,steer:0,handbrake:false,brake:0};
    this.occupants=[]; this.driver=null; this.ai=null; this.wrecked=false; this.siren=false; this.explodeT=-1; this.removed=false; this.parked=false; this.mission=false; this.label=null;
    this.isPolice=!!s.police; this.name=s.name; this.lastHitBy=null; this.wreckT=0; this.stuckT=0; this.reverseT=0; this.blockedT=0; this.honkT=0; this.exitCd=0; this.skidT=0; this.flipT=0; this.hitCd=0; this.sirenLast=false;
    this.x=x; this.z=z; this.y=0; this.angle=angle; this.vx=0; this.vz=0; this.speed=0; this.lat=0; this.steer=0; this.gear=1; this.rpm=s.idle; this.shiftT=0; this.throttleEff=0; this.brakeEff=0; this.slipAmount=0; this.airborne=false;
    this.buildPhysics(x,z,angle); this.buildMesh();
  }
  get l(){return this.stats.L} get w(){return this.stats.W}
  // -------- physics setup --------
  buildPhysics(x,z,angle){
    const C=CANNON, s=this.stats, G=this.G;
    const b=this.body=new C.Body({mass:s.mass,material:G.physics.matChassis,collisionFilterGroup:GROUP_VEHICLE,collisionFilterMask:GROUP_STATIC|GROUP_VEHICLE|GROUP_DEBRIS,allowSleep:true,sleepSpeedLimit:0.3,sleepTimeLimit:0.8,angularDamping:0.2,linearDamping:0});
    const gc=s.bike?0.25:0.22; const bodyH=s.H-gc; const bw=s.bike?0.5:s.W;
    b.addShape(new C.Box(new C.Vec3(s.L/2*0.98,bodyH/2,bw/2*0.98)),new C.Vec3(0,gc+bodyH/2-s.comH,0));
    // manual inertia (box about CoM); yaw inertia bumped for stability
    const m=s.mass; const Ix=m/12*(s.H*s.H+bw*bw), Iy=m/12*(s.L*s.L+bw*bw)*1.15, Iz=m/12*(s.L*s.L+s.H*s.H);
    b.inertia.set(Ix,Iy,Iz); b.invInertia.set(1/Ix,1/Iy,1/Iz); b.updateInertiaWorld(true);
    const gy=G.world.heightAt(x,z); b.position.set(x,gy+s.comH+0.02,z); b.quaternion.setFromAxisAngle(new C.Vec3(0,1,0),-angle);
    b.vehicle=this; G.physics.world.addBody(b);
    b.addEventListener('collide',e=>this.onCollide(e));
    // wheels
    const sagLen=0.3*s.sag, droop=0.2, restLen=sagLen+droop; const wbF=s.wb*(1-s.fBias), wbR=s.wb*s.fBias; const g=9.81;
    const mk=(lx,lz,front,share)=>{ const k=m*g*share/sagLen; const c=2*Math.sqrt(k*m*share)*s.zeta; const yMount=s.wheelR+restLen-sagLen-s.comH; return {lx,ly:yMount,lz,front,k,c,restLen,len:restLen-sagLen,prevLen:restLen-sagLen,comp:0,contact:false,omega:0,Fz:0,slip:0,alpha:0,spin:0,steer:0,driven:(front&&(s.drive==='fwd'||s.drive==='awd'))||(!front&&(s.drive!=='fwd')),cx:0,cy:0,cz:0,hx:0,hy:0,hz:0,skid:0,share}; };
    if(s.bike){ this.wheels=[mk(wbF,0,true,0.5),mk(-wbR,0,false,0.5)]; }
    else { const tf=s.track/2; this.wheels=[mk(wbF,-tf,true,s.fBias/2),mk(wbF,tf,true,s.fBias/2),mk(-wbR,-tf,false,(1-s.fBias)/2),mk(-wbR,tf,false,(1-s.fBias)/2)]; }
    this.nDriven=this.wheels.filter(w=>w.driven).length;
    this.Iwheel=0.5*25*s.wheelR*s.wheelR;
  }
  onCollide(e){
    const G=this.G; const imp=Math.abs(e.contact.getImpactVelocityAlongNormal()); if(imp<1.5||this.hitCd>0) return;
    const other=e.body.vehicle||null; const om=other?other.stats.mass:1e9; const share=om/(om+this.stats.mass);
    const dmg=Math.max(0,imp-3)*3.2*share*(other?1:1.4); this.hitCd=0.12;
    if(dmg>0.5){ this.damage(dmg,other?(other.driver||other):null); const p=this.body.position; if(dist(p.x,p.z,G.player.x,G.player.z)<120) G.audio.crash(clamp(imp/18,0.15,1)); if(this.driver?.isPlayer){ G.shake(Math.min(8,imp/3)); if(imp>13) this.driver.damage((imp-13)*3,this.lastHitBy,G,'crash'); } if(imp>4) for(let i=0;i<4;i++) G.fx.spark(this.x+rnd(-1,1),this.y+0.5,this.z+rnd(-1,1)); }
    if(other&&other.ai&&other.ai.mode==='traffic'&&other.driver&&!other.ai.panic&&(this.driver?.isPlayer)){ other.ai.panic=true; other.ai.speedMul=1.6; other.ai.reckless=true; }
    if(!other&&e.body.isTree&&imp>6){ /* tree hit */ }
  }
  // -------- per-substep vehicle dynamics --------
  physicsStep(h){
    const b=this.body, s=this.stats, W=this.G.world; b.allowSleep=!(this.driver||this.ai); if(b.sleepState===2) return;
    if(!isFinite(b.position.x+b.position.y+b.position.z+b.velocity.x+b.velocity.y+b.velocity.z+b.quaternion.x+b.quaternion.w+b.angularVelocity.x)){ console.warn('NaN body',this.kind,this.ai?this.ai.mode:'-',JSON.stringify(this.lastGood)); this.G.nanEvents=(this.G.nanEvents||0)+1; const g=this.lastGood||{x:100,z:100,a:0}; b.position.set(g.x,W.heightAt(g.x,g.z)+s.comH+0.3,g.z); b.velocity.set(0,0,0); b.angularVelocity.set(0,0,0); b.quaternion.setFromAxisAngle(new CANNON.Vec3(0,1,0),-g.a); for(const w of this.wheels){ w.omega=0; w.len=w.prevLen=w.restLen; } b.force.set(0,0,0); b.torque.set(0,0,0); return; }
    this.lastGood={x:b.position.x,z:b.position.z,a:this.angle,v:+b.velocity.length().toFixed(1),av:+b.angularVelocity.length().toFixed(1),y:+b.position.y.toFixed(2),om:this.wheels.map(w=>Math.round(w.omega)),Fz:this.wheels.map(w=>Math.round(w.Fz))};
    const q=b.quaternion; const fwd=new CANNON.Vec3(1,0,0), up=new CANNON.Vec3(0,1,0), right=new CANNON.Vec3(0,0,1); q.vmult(fwd,fwd); q.vmult(up,up); q.vmult(right,right);
    const vel=b.velocity; const speed=vel.dot(fwd); this.speedNow=speed;
    const c=this.ctrl; const active=!this.wrecked;
    // ---- drivetrain ----
    let throttle=0, brake=c.brake||0;
    if(active){
      if(c.throttle>0){ if(this.gear<0){ if(speed>-0.8) this.gear=1; else brake=Math.max(brake,1); } if(this.gear>0) throttle=c.throttle; }
      else if(c.throttle<0){ if(speed>0.8) brake=Math.max(brake,-c.throttle); else { if(this.gear>0) this.gear=-1; throttle=-c.throttle; } }
      if(this.hp<this.maxHp*0.25) throttle*=0.5;
    } else { throttle=0; brake=0.2; }
    if(this.shiftT>0){ this.shiftT-=h; throttle=0; }
    if(throttle>0&&!c.handbrake){ let ms=0, fa=0, ra=0, nf=0, nr=0; for(const w of this.wheels){ if(w.driven&&w.contact) ms=Math.max(ms,w.slip); if(w.front){ fa+=Math.abs(w.alpha); nf++; } else { ra+=Math.abs(w.alpha); nr++; } }
      if(ms>0.2) throttle*=clamp(1-(ms-0.2)*2.5,0.12,1); // traction control
      if(nr&&nf&&Math.abs(speed)>4&&(ra/nr>fa/nf+0.1||ra/nr>0.2)) throttle*=0.35; } // stability control: power oversteer
    const ratio=(this.gear>0?s.gears[this.gear-1]:-s.gears[0]*1.1)*s.final;
    let wsum=0; for(const w of this.wheels) if(w.driven) wsum+=w.omega; const wAvg=wsum/this.nDriven;
    let rpm=wAvg*ratio*60/TAU; rpm=Math.max(s.idle,Math.min(rpm,s.redline*1.06)); this.rpm=damp(this.rpm,rpm,25,h);
    const x=this.rpm/s.redline; const curve=clamp(1-1.3*(x-0.6)*(x-0.6),0.5,1);
    let Teng=throttle*s.torque*curve*(this.rpm>=s.redline?0:1);
    if(throttle<0.05&&active) Teng=-s.torque*0.12*x; // engine braking
    if(this.gear>0&&active&&this.shiftT<=0){ if(x>0.93&&this.gear<s.gears.length){ this.gear++; this.shiftT=0.22; } else if(x<0.38&&this.gear>1){ this.gear--; this.shiftT=0.15; } }
    const Twheel=Teng*ratio*0.9/this.nDriven; const Ieng=0.25*ratio*ratio/this.nDriven;
    this.throttleEff=throttle; this.brakeEff=brake;
    // ---- steering (speed sensitive lock) ----
    const av=Math.abs(speed); const lock=clamp(Math.atan(s.wb*s.mu*9.81*0.92/Math.max(av*av,1)),0.03,s.maxSteer); const steerAng=this.steer*lock; this.steerAngle=steerAng;
    // ---- wheel contact pass ----
    const rayDir=up.scale(-1); const upWorld=new CANNON.Vec3(0,1,0); let anyContact=false;
    for(const w of this.wheels){
      const hp=b.pointToWorldFrame(new CANNON.Vec3(w.lx,w.ly,w.lz)); w.hx=hp.x; w.hy=hp.y; w.hz=hp.z; w.contact=false;
      if(rayDir.y<-0.25){ const gy=W.heightAt(hp.x,hp.z); const t=(hp.y-gy)/(-rayDir.y); const len=t-s.wheelR;
        if(len<w.restLen){ w.contact=true; anyContact=true; w.len=Math.max(len,0.0); w.comp=w.restLen-w.len; w.cx=hp.x+rayDir.x*t; w.cy=gy; w.cz=hp.z+rayDir.z*t; } else { w.len=w.restLen; w.comp=0; } }
      else { w.len=w.restLen; w.comp=0; }
      w.compVel=(w.prevLen-w.len)/h; w.prevLen=w.len;
    }
    this.airborne=!anyContact;
    // suspension forces (+ anti-roll bars)
    for(const w of this.wheels){ if(!w.contact){ w.Fz=0; continue; } const Fz0=s.mass*9.81*w.share; let F=w.k*w.comp+clamp(w.c*w.compVel,-1.5*Fz0,2.5*Fz0); if(w.len<0.03) F+=w.k*6*(0.03-w.len); w.Fz=Math.max(F,0); }
    if(!s.bike){ for(const pair of [[0,1],[2,3]]){ const a=this.wheels[pair[0]], bb=this.wheels[pair[1]]; if(!a.contact||!bb.contact) continue; const k=a.k*(a.front?0.35:0.2); const Fz0=s.mass*9.81*a.share; const d=clamp((a.comp-bb.comp)*k,-0.6*Fz0,0.6*Fz0); a.Fz=Math.max(0,a.Fz+d); bb.Fz=Math.max(0,bb.Fz-d); } }
    // ---- tyre forces ----
    const Iw=this.Iwheel; let slipAcc=0;
    for(const w of this.wheels){
      const I=Iw+(w.driven?Ieng:0);
      // drive & brake torques on the wheel
      if(w.driven) w.omega+=Twheel/I*h;
      let Tb=brake*s.brake*(w.front?0.62:0.38); if(w.slip<-0.3&&Tb>0&&Math.abs(speed)>3) Tb*=0.25; // ABS
      if(c.handbrake&&!w.front&&active) Tb=Math.max(Tb,s.brake*2.5); if(!active) Tb=Math.max(Tb,s.brake*0.3);
      if(Tb>0){ const dw=Tb/I*h; if(Math.abs(w.omega)<=dw) w.omega=0; else w.omega-=Math.sign(w.omega)*dw; }
      if(!w.contact){ w.omega*=Math.pow(0.6,h); w.slip=0; w.alpha=0; w.skid=0; continue; }
      // wheel directions in the ground plane
      const st=w.front?steerAng:0; let wfx=fwd.x*Math.cos(st)+right.x*Math.sin(st), wfz=fwd.z*Math.cos(st)+right.z*Math.sin(st); const wl=Math.hypot(wfx,wfz)||1; wfx/=wl; wfz/=wl; const wsx=-wfz, wsz=wfx;
      const cp=new CANNON.Vec3(w.cx,w.cy,w.cz); const v=b.getVelocityAtWorldPoint(cp,new CANNON.Vec3()); const vf=v.x*wfx+v.z*wfz, vs=v.x*wsx+v.z*wsz;
      let mu=s.mu*(w.front?0.95:1.05); if(c.handbrake&&!w.front) mu*=0.8; if(W.tileAt(w.cx,w.cz)===TILE.GRASS||W.tileAt(w.cx,w.cz)===TILE.SAND) mu*=0.72;
      const Fz=w.Fz; const muFz=mu*Fz;
      const slip=(w.omega*s.wheelR-vf)/Math.max(Math.abs(vf),3.0); const alpha=Math.atan2(vs,Math.max(Math.abs(vf),1.5));
      let Fx=muFz*tyreCurve(slip,12,1.5); let Fy=-muFz*tyreCurve(alpha,14,1.3);
      // friction circle
      const Ft=Math.hypot(Fx,Fy); if(Ft>muFz&&Ft>0){ Fx*=muFz/Ft; Fy*=muFz/Ft; }
      // low-speed stability clamps (cannot reverse contact velocity within one substep)
      const mEff=s.mass*w.share*1.2; const maxFy=Math.abs(vs)*mEff/h; if(Math.abs(Fy)>maxFy) Fy=Math.sign(Fy)*maxFy;
      const r=s.wheelR; const maxFx=Math.abs(w.omega*r-vf)*I/(r*r*h)+Math.abs(vf)*0.002*mEff/h; if(Math.abs(Fx)>maxFx) Fx=Math.sign(Fx)*maxFx;
      // wheel reaction (may not cross the free-rolling speed)
      const target=vf/r; const on=w.omega-Fx*r/I*h; w.omega=((w.omega-target)*(on-target)<0)?target:on;
      // rolling resistance
      if(Math.abs(vf)>0.2) Fx-=0.012*Fz*Math.sign(vf);
      w.slip=slip; w.alpha=alpha; w.skid=clamp((Math.abs(alpha)-0.2)*3,0,1)+clamp((Math.abs(slip)-0.25)*2,0,1); slipAcc+=w.skid*Fz;
      const hub=new CANNON.Vec3(w.cx,w.cy+r*0.9,w.cz); const rel=hub.vsub(b.position);
      const F=new CANNON.Vec3(wfx*Fx+wsx*Fy+up.x*w.Fz,up.y*w.Fz,wfz*Fx+wsz*Fy+up.z*w.Fz); b.applyForce(F,rel);
    }
    this.slipAmount=slipAcc/(s.mass*9.81);
    // ---- aero ----
    const vmag=vel.length(); if(vmag>0.5){ const drag=0.5*1.225*s.cdA*vmag; b.applyForce(vel.scale(-drag),new CANNON.Vec3()); if(s.clA){ b.applyForce(upWorld.scale(-0.5*1.225*s.clA*speed*speed),new CANNON.Vec3()); } }
    // ---- bike balance: keep the body upright (rider balance), lean is shown visually ----
    if(s.bike){ const fx=fwd.x,fz=fwd.z; const fl=Math.hypot(fx,fz)||1; const sx=-fz/fl, sz=fx/fl; const roll=Math.asin(clamp(up.x*sx+up.z*sz,-1,1)); const yawRate=b.angularVelocity.y; const target=(!this.driver&&av<1&&!this.wrecked)?0.25:this.wrecked?0.9:0; const rollRate=b.angularVelocity.dot(fwd); const tq=(target-roll)*s.mass*40-rollRate*s.mass*7; if(!this.wrecked) b.applyTorque(fwd.scale(tq)); this.visLean=damp(this.visLean||0,clamp(-Math.atan(speed*yawRate/9.81),-0.8,0.8)*(av>1?1:0),6,h); }
    // ---- sinking wrecks / keep out of water ----
    if(b.position.y<-0.4){ b.velocity.scale(0.9,b.velocity); }
  }
  // -------- per-frame --------
  update(dt,G){
    const b=this.body, s=this.stats;
    // sync state from physics
    if(!isFinite(b.position.x+b.position.y+b.position.z+b.velocity.x+b.quaternion.x)){ b.position.set(isFinite(this.x)?this.x:100,G.world.heightAt(isFinite(this.x)?this.x:100,isFinite(this.z)?this.z:100)+s.comH+0.5,isFinite(this.z)?this.z:100); b.velocity.set(0,0,0); b.angularVelocity.set(0,0,0); b.quaternion.setFromAxisAngle(new CANNON.Vec3(0,1,0),-(isFinite(this.angle)?this.angle:0)); for(const w of this.wheels){ w.omega=0; w.len=w.prevLen=w.restLen; } }
    const p=b.position; this.x=p.x; this.y=p.y; this.z=p.z; const f=new CANNON.Vec3(1,0,0); b.quaternion.vmult(f,f); this.angle=Math.atan2(f.z,f.x); this.vx=b.velocity.x; this.vz=b.velocity.z; this.speed=this.vx*f.x+this.vz*f.z; this.lat=-this.vx*f.z+this.vz*f.x; const upv=new CANNON.Vec3(0,1,0); b.quaternion.vmult(upv,upv); this.upY=upv.y;
    if(this.hitCd>0) this.hitCd-=dt; if(this.exitCd>0) this.exitCd-=dt;
    if(this.explodeT>=0){ this.explodeT-=dt; if(this.explodeT<0){ this.explodeT=-1; this.explode(G);} }
    if(this.wrecked){ this.wreckT+=dt; if(this.wreckT<8&&Math.random()<dt*20) G.fx.fire(this.x+rnd(-1,1),this.y+0.6,this.z+rnd(-1,1)); if(Math.random()<dt*6) G.fx.smoke(this.x+rnd(-0.8,0.8),this.y+1,this.z+rnd(-0.8,0.8),{big:true,dark:true}); this.updateMesh(dt,G); return; }
    if(this.ai&&!(this.driver&&this.driver.isPlayer)) this.aiUpdate(dt,G);
    if(!this.driver&&!this.ai){ this.ctrl.throttle=0; this.ctrl.steer=0; this.ctrl.handbrake=!this.parkedRolling; this.ctrl.brake=0; }
    // steering smoothing (rate limited, slower at speed)
    const av=Math.abs(this.speed); const target=clamp(this.ctrl.steer,-1,1); const rate=(Math.abs(target)<Math.abs(this.steer)?7:4.5)/(1+av/30); this.steer=damp(this.steer,target,rate,dt); if(Math.abs(this.steer-target)<0.005) this.steer=target;
    // upside down: auto recover for occupied vehicles
    if(this.upY<0.15&&av<1.5){ this.flipT+=dt; if(this.flipT>3&&this.driver){ const q=new CANNON.Quaternion(); q.setFromAxisAngle(new CANNON.Vec3(0,1,0),-this.angle); b.quaternion.copy(q); b.position.y+=1.2; b.angularVelocity.set(0,0,0); b.velocity.set(0,0,0); this.flipT=0; } } else this.flipT=0;
    // skids
    if(this.slipAmount>0.35&&av>2){ this.skidT+=dt; for(const w of this.wheels){ if(w.contact&&w.skid>0.4) G.fx.skid(this,w); } if(this.driver&&dist(this.x,this.z,G.player.x,G.player.z)<80) G.audio.skid(clamp(this.slipAmount-0.3,0,1),dt); }
    // damage effects
    if(this.hp<this.maxHp*0.5&&Math.random()<dt*(this.hp<this.maxHp*0.25?14:4)){ const p=this.worldPoint(s.L*0.42,rnd(-0.4,0.4)); G.fx.smoke(p.x,this.y+0.7,p.z,{big:this.hp<this.maxHp*0.25}); }
    if(this.hp<this.maxHp*0.12&&Math.random()<dt*10){ const p=this.worldPoint(s.L*0.42,rnd(-0.4,0.4)); G.fx.fire(p.x,this.y+0.7,p.z); }
    for(const o of this.occupants){ o.x=this.x; o.z=this.z; o.y=this.y; o.angle=this.angle; }
    this.updateMesh(dt,G);
  }
  localPoint(px,pz){ const c=Math.cos(-this.angle), s=Math.sin(-this.angle); const dx=px-this.x, dz=pz-this.z; return {x:dx*c-dz*s,z:dx*s+dz*c}; }
  worldPoint(lx,lz){ const c=Math.cos(this.angle), s=Math.sin(this.angle); return {x:this.x+lx*c-lz*s,z:this.z+lx*s+lz*c}; }
  containsPoint(px,pz,pad=0){ const lp=this.localPoint(px,pz); return Math.abs(lp.x)<=this.l/2+pad&&Math.abs(lp.z)<=this.w/2+pad; }
  // ray (3D) vs chassis box -> t or -1
  rayHit(o,d,maxT){ const b=this.body; const q=b.quaternion; const inv=q.inverse(new CANNON.Quaternion()); const lo=inv.vmult(new CANNON.Vec3(o.x-b.position.x,o.y-b.position.y,o.z-b.position.z)); const ld=inv.vmult(new CANNON.Vec3(d.x,d.y,d.z)); const sh=b.shapes[0], off=b.shapeOffsets[0]; const he=sh.halfExtents; let t0=0,t1=maxT; const mn=[off.x-he.x,off.y-he.y,off.z-he.z], mx=[off.x+he.x,off.y+he.y,off.z+he.z]; const O=[lo.x,lo.y,lo.z], D=[ld.x,ld.y,ld.z];
    for(let i=0;i<3;i++){ if(Math.abs(D[i])<1e-9){ if(O[i]<mn[i]||O[i]>mx[i]) return -1; continue; } let a=(mn[i]-O[i])/D[i], c=(mx[i]-O[i])/D[i]; if(a>c){ const tmp=a; a=c; c=tmp; } if(a>t0) t0=a; if(c<t1) t1=c; if(t0>t1) return -1; } return t0; }
  damage(amount,src,G){ G=G||this.G; if(this.wrecked) return; this.hp-=amount; if(src) this.lastHitBy=src; if(this.driver?.isPlayer&&amount>3) G.shake(2); if(this.hp<=0&&this.explodeT<0){ this.explodeT=rnd(0.05,0.35); } }
  explode(G){
    if(this.wrecked) return; this.wrecked=true; this.hp=0; this.siren=false; this.ai=null; this.wreckT=0;
    const killer=this.lastHitBy; for(const o of this.occupants.slice()){ o.vehicle=null; o.x=this.x; o.z=this.z; o.die(killer,G); } this.occupants=[]; this.driver=null;
    G.explosion(this.x,this.y+0.5,this.z,11,killer,this);
    this.body.wakeUp(); this.body.applyImpulse(new CANNON.Vec3(rnd(-1,1)*this.stats.mass*1.5,this.stats.mass*4.5,rnd(-1,1)*this.stats.mass*1.5),new CANNON.Vec3(rnd(-1,1),0,rnd(-0.5,0.5)));
    if(killer&&killer.isPlayer){ if(!this.mission||this.isPolice) G.addCrime(this.isPolice?3:1.2); G.stats.vehiclesDestroyed++; }
    this.setWreckLook();
  }
  addOccupant(p,asDriver){ p.vehicle=this; p.state='driver'; p.vx=p.vz=0; this.occupants.push(p); if(asDriver) this.driver=p; this.body.wakeUp(); this.parked=false; if(p.mesh) p.mesh.visible=!!this.stats.bike; }
  removeOccupant(p,G){
    const i=this.occupants.indexOf(p); if(i>=0) this.occupants.splice(i,1); if(this.driver===p) this.driver=null; p.vehicle=null; p.state='wander';
    const side=this.worldPoint(0.2,-(this.w/2+0.9)), side2=this.worldPoint(0.2,(this.w/2+0.9)); const W=G.world;
    let pos=!W.solidAt(side.x,side.z)?side:!W.solidAt(side2.x,side2.z)?side2:W.findFreeSpot(this.x,this.z,1.2);
    p.x=pos.x; p.z=pos.z; p.y=W.heightAt(pos.x,pos.z); p.vx=this.vx*0.2; p.vz=this.vz*0.2; if(p.mesh) p.mesh.visible=true;
    if(!this.driver&&!this.ai) this.ctrl.handbrake=true;
  }
  // ---------------- AI ----------------
  aiUpdate(dt,G){
    const ai=this.ai, c=this.ctrl; c.handbrake=false; c.brake=0;
    if(this.reverseT>0){ this.reverseT-=dt; c.throttle=-1; c.steer=ai.revSteer; return; }
    if(ai.mode==='police'||ai.mode==='chase'){ this.aiChase(dt,G); return; }
    if(ai.mode==='parked'){ c.throttle=0; c.steer=0; c.handbrake=true; return; }
    if(!ai.node||!ai.next) this.aiPickEdge(G);
    const A=ai.node, B=ai.next; const dx=B.x-A.x, dz=B.z-A.z, L=Math.hypot(dx,dz)||1, ux=dx/L, uz=dz/L, rx=-uz, rz=ux;
    const along=(this.x-A.x)*ux+(this.z-A.z)*uz; const lane=T;
    let tx,tz, turnAhead=0, distToTurn=1e9;
    let C=ai.C;
    if(!C){ if(ai.route){ if(along>L-2.6*T) C=ai.C=this.aiNextNode(G); else C=ai.route[ai.ri+1]||null; } else C=ai.C=this.randomNext(); }
    if(C===null&&along>L-3*T){ ai.done=true; c.throttle=this.speed>0.5?-1:0; c.steer=0; c.handbrake=this.speed<0.5; return; }
    if(C){ const dx2=C.x-B.x, dz2=C.z-B.z, L2=Math.hypot(dx2,dz2)||1; const u2x=dx2/L2, u2z=dz2/L2; turnAhead=Math.abs(wrapAng(Math.atan2(u2z,u2x)-Math.atan2(uz,ux))); distToTurn=L-along; }
    if(along>L-2.6*T&&C){
      const dx2=C.x-B.x, dz2=C.z-B.z, L2=Math.hypot(dx2,dz2)||1, u2x=dx2/L2, u2z=dz2/L2, r2x=-u2z, r2z=u2x;
      tx=B.x+u2x*T*2.2+r2x*lane; tz=B.z+u2z*T*2.2+r2z*lane;
      const passed=((this.x-B.x)*u2x+(this.z-B.z)*u2z)>T*0.3||along>L+T*0.5;
      if(passed){ ai.node=B; ai.next=C; ai.C=null; if(ai.route) ai.ri++; }
    } else { const look=2.5*T+Math.abs(this.speed)*0.5; tx=A.x+ux*(along+look)+rx*lane; tz=A.z+uz*(along+look)+rz*lane; }
    const desired=angTo(this.x,this.z,tx,tz); const d=wrapAng(desired-this.angle);
    c.steer=clamp(d*2.4,-1,1);
    if(Math.abs(d)>2.2&&Math.abs(this.speed)<2.5){ this.reverseT=1.3; ai.revSteer=-Math.sign(d); c.throttle=-1; c.steer=ai.revSteer; return; }
    const base=(ai.reckless?20:14)*(ai.speedMul||1); let target=base;
    { const fx=Math.cos(this.angle), fz=Math.sin(this.angle); const probe=4+Math.abs(this.speed)*0.55; const W=G.world;
      if(W.solidAt(this.x+fx*probe,this.z+fz*probe)){ const rightFree=!W.solidAt(this.x+fx*probe*0.6-fz*4,this.z+fz*probe*0.6+fx*4); const leftFree=!W.solidAt(this.x+fx*probe*0.6+fz*4,this.z+fz*probe*0.6-fx*4); if(rightFree&&(d>0||!leftFree)) c.steer=1; else if(leftFree) c.steer=-1; target=Math.min(target,5); } }
    if(Math.abs(d)>0.5) target=Math.min(target,7); if(Math.abs(d)>1.2) target=Math.min(target,4);
    // slow down before corners: v = sqrt(a_lat*R)
    if(turnAhead>0.4){ const vTurn=Math.sqrt((ai.reckless?5.5:4.5)*(T*1.5))*(1+(Math.PI-turnAhead)*0.3); const v=Math.abs(this.speed); const brakeDist=(v*v-vTurn*vTurn)/(2*5)+3; if(distToTurn<brakeDist) target=Math.min(target,vTurn); }
    if(!ai.reckless){
      const fx=Math.cos(this.angle), fz=Math.sin(this.angle), rxx=-fz, rzz=fx; let brake=false, slow=false; const P=G.player;
      const look=6+Math.abs(this.speed)*1.1;
      for(const v of G.vehicles){ if(v===this||v.removed) continue; const ex=v.x-this.x, ez=v.z-this.z; if(Math.abs(ex)>look+8||Math.abs(ez)>look+8) continue; const al=ex*fx+ez*fz, la=ex*rxx+ez*rzz; if(al>0&&al<look+this.l/2+v.l/2&&Math.abs(la)<this.w/2+v.w/2+0.8){ const vs=v.vx*fx+v.vz*fz; if(vs<this.speed-1){ if(al<this.l/2+v.l/2+3.5) brake=true; else slow=true; } } }
      for(const p of G.peds){ if(p.dead||p.vehicle) continue; const ex=p.x-this.x, ez=p.z-this.z; if(Math.abs(ex)>look||Math.abs(ez)>look) continue; const al=ex*fx+ez*fz, la=ex*rxx+ez*rzz; if(al>0&&al<look&&Math.abs(la)<this.w/2+1.2){ if(al<6) brake=true; else slow=true; if(p.isPlayer&&Math.random()<dt*0.5&&this.honkT<=0){ this.honkT=3; if(dist(p.x,p.z,P.x,P.z)<70) G.audio.horn(); } } }
      if(this.honkT>0) this.honkT-=dt;
      if(brake){ this.blockedT+=dt; if(this.blockedT<4){ c.throttle=this.speed>0.3?-1:0; c.handbrake=this.speed<0.3; return; } }
      else if(slow) target*=0.4;
      if(!brake) this.blockedT=Math.max(0,this.blockedT-dt);
    }
    const err=target-this.speed; c.throttle=clamp(err*0.35,-1,1); if(this.speed<target-0.5&&c.throttle<0.25) c.throttle=0.25;
    if(Math.abs(this.speed)<0.6&&c.throttle>0.2){ this.stuckT+=dt; if(this.stuckT>2.2){ this.stuckT=0; this.reverseT=1.2; ai.revSteer=-c.steer||(Math.random()<0.5?-1:1); } } else this.stuckT=0;
  }
  aiNextNode(G){ const ai=this.ai; if(ai.route){ const nxt=ai.route[ai.ri+1]; if(nxt) return nxt; if(ai.onRouteEnd){ const r=ai.onRouteEnd(this,G); if(r) return this.aiNextNode(G); } if(ai.loop){ ai.ri=-1; return ai.route[0]; } return ai.stopAtEnd?null:this.randomNext(); } return this.randomNext(); }
  randomNext(){ const ai=this.ai, A=ai.node, B=ai.next; const cand=B.nb.filter(n=>n!==A); if(!cand.length) return A; const dx=B.x-A.x, dz=B.z-A.z; const straight=cand.find(n=>Math.sign(n.x-B.x)===Math.sign(dx)&&Math.sign(n.z-B.z)===Math.sign(dz)); if(straight&&Math.random()<0.55) return straight; return pick(cand); }
  aiPickEdge(G){ const n=G.world.nearestNode(this.x,this.z); this.ai.node=n; this.ai.next=pick(n.nb); this.ai.C=null; }
  setRoute(route,G){ const ai=this.ai; ai.route=route; ai.ri=0; ai.node=route[0]; ai.next=route[1]||route[0]; ai.C=null; }
  aiChase(dt,G){
    const ai=this.ai, c=this.ctrl, P=G.player; const tgt=ai.target||P; const tv=tgt.vehicle||tgt;
    const d=dist(this.x,this.z,tv.x,tv.z); const lead=0.6; const tx=tv.x+(tv.vx||0)*lead, tz=tv.z+(tv.vz||0)*lead;
    const desired=angTo(this.x,this.z,tx,tz); const dd=wrapAng(desired-this.angle); c.steer=clamp(dd*2.8,-1,1);
    let throttle=1; const av=Math.abs(this.speed);
    if(Math.abs(dd)>2.3&&d<25){ throttle=-1; c.steer=-c.steer; }
    else if(Math.abs(dd)>0.9&&av>9) throttle=-0.4;
    const onFoot=!tgt.vehicle;
    if(onFoot&&d<14){ throttle=av>2?-1:0; c.steer=0; c.handbrake=av<2; if(av<5&&this.exitCd<=0&&ai.mode==='police'){ this.exitCd=1.5; for(const o of this.occupants.slice()){ if(!o.isPlayer){ this.removeOccupant(o,G); o.state='attack'; o.target=P; } } if(!this.occupants.length){ this.ai={mode:'parked'}; return; } } }
    else if(ai.mode==='police'&&this.occupants.length===0){ this.ai={mode:'parked'}; return; }
    // wall avoidance probes
    const fx=Math.cos(this.angle), fz=Math.sin(this.angle); const probe=5+av*0.45; const W=G.world;
    if(W.solidAt(this.x+fx*probe,this.z+fz*probe)){ const rightFree=!W.solidAt(this.x+fx*probe*0.7-fz*4,this.z+fz*probe*0.7+fx*4); const leftFree=!W.solidAt(this.x+fx*probe*0.7+fz*4,this.z+fz*probe*0.7-fx*4); if(rightFree) c.steer=1; else if(leftFree) c.steer=-1; if(av>12) throttle=-0.6; }
    if(d>40&&av>28*(ai.speedMul||1)) throttle=0.2;
    c.throttle=throttle;
    if(av<0.6&&throttle>0){ this.stuckT+=dt; if(this.stuckT>1.3){ this.stuckT=0; this.reverseT=1; ai.revSteer=-(c.steer||1); } } else this.stuckT=0;
  }
  // ---------------- MESH ----------------
  buildMesh(){
    const s=this.stats, G=this.G; const grp=this.mesh=new THREE.Group(); const inner=this.inner=new THREE.Group(); inner.position.y=-s.comH; grp.add(inner);
    const paint=this.paintMat=new THREE.MeshPhongMaterial({color:col3(this.color),shininess:70,specular:0x555555});
    const L=s.L, W=s.W; const prof=PROFILES[s.profile];
    this.parts=[];
    if(s.bike){
      const frame=new THREE.Mesh(new THREE.BoxGeometry(1.3,0.22,0.18),paint); frame.position.set(-0.05,0.62,0); inner.add(frame);
      const tank=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.26,0.32),paint); tank.position.set(0.15,0.8,0); inner.add(tank);
      const seat=new THREE.Mesh(new THREE.BoxGeometry(0.55,0.1,0.3),MAT.dark); seat.position.set(-0.35,0.82,0); inner.add(seat);
      const fork=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.75,0.12),MAT.chrome); fork.position.set(0.62,0.55,0); fork.rotation.z=-0.45; inner.add(fork); this.fork=fork;
      const bar=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.06,0.7),MAT.chrome); bar.position.set(0.45,0.98,0); inner.add(bar);
      const hl=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.16,0.16),new THREE.MeshLambertMaterial({color:0xffffee,emissive:0xffe9a0,emissiveIntensity:0.3})); hl.position.set(0.72,0.85,0); inner.add(hl); this.headMats=[hl.material];
      const tl=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.1,0.14),MAT.red.clone()); tl.position.set(-0.85,0.7,0); inner.add(tl); this.tailMats=[tl.material];
    } else {
      const body=extrudeProfile(prof.body,L,W,paint); body.castShadow=true; inner.add(body); this.parts.push(body);
      if(prof.cabin){ const cab=extrudeProfile(prof.cabin,L,W*0.92,MAT.glass); inner.add(cab); this.parts.push(cab); }
      if(s.profile==='bus'){ for(const side of [-1,1]){ const win=new THREE.Mesh(new THREE.BoxGeometry(L*0.92,1.0,0.05),MAT.glass); win.position.set(0,2.2,side*(W/2+0.01)); inner.add(win); } const wf=new THREE.Mesh(new THREE.BoxGeometry(0.05,1.4,W*0.9),MAT.glass); wf.position.set(L/2+0.02,2.1,0); inner.add(wf); }
      if(s.profile==='truck'){ const cargo=new THREE.Mesh(new THREE.BoxGeometry(L*0.66,1.9,W*0.98),new THREE.MeshLambertMaterial({color:0xd8d8d0})); cargo.position.set(-L*0.16,2.3,0); inner.add(cargo); this.parts.push(cargo); }
      if(s.profile==='sports'){ const sp=new THREE.Mesh(new THREE.BoxGeometry(0.16,0.05,W*0.8),paint); sp.position.set(-L*0.46,0.85,0); inner.add(sp); }
      // bumpers
      for(const sgn of [-1,1]){ const bm=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.16,W*0.95),MAT.dark); bm.position.set(sgn*L/2,prof.body[0][1]+0.08,0); inner.add(bm); }
      // lights
      this.headMats=[]; this.tailMats=[]; const ly=prof.body[2][1]-0.1;
      for(const sgn of [-1,1]){ const hm=new THREE.MeshLambertMaterial({color:0xffffee,emissive:0xffe9a0,emissiveIntensity:0.25}); const h=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.14,0.3),hm); h.position.set(L/2,ly,sgn*(W/2-0.28)); inner.add(h); this.headMats.push(hm);
        const tm=MAT.red.clone(); const t=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.14,0.36),tm); t.position.set(-L/2,ly+0.05,sgn*(W/2-0.3)); inner.add(t); this.tailMats.push(tm); }
      if(s.police&&s.profile==='sedan'){ const bar=new THREE.Group(); const roofY=prof.cabin[2][1]+0.08; const r=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.14,0.5),MAT.red.clone()); r.position.set(0,0,-0.27); const bl=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.14,0.5),MAT.blue.clone()); bl.position.set(0,0,0.27); bar.add(r,bl); bar.position.set(-L*0.1,roofY,0); inner.add(bar); this.lightbar=[r.material,bl.material];
        for(const side of [-1,1]){ const stripe=new THREE.Mesh(new THREE.BoxGeometry(L*0.5,0.28,0.02),MAT.dark); stripe.position.set(-L*0.05,0.55,side*(W/2+0.01)); inner.add(stripe); }
        const decal=new THREE.Mesh(new THREE.PlaneGeometry(1.0,0.32),new THREE.MeshBasicMaterial({map:textTexture('LPD','#153c8a',null,256,96,'bold 70px Impact, Arial Black, sans-serif'),transparent:true})); decal.position.set(-L*0.05,0.72,W/2+0.03); inner.add(decal); const decal2=decal.clone(); decal2.rotation.y=Math.PI; decal2.position.z=-W/2-0.03; inner.add(decal2); }
      if(s.police&&s.profile==='swat'){ const bar=new THREE.Group(); const r=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.16,0.6),MAT.red.clone()); r.position.set(0,0,-0.35); const bl=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.16,0.6),MAT.blue.clone()); bl.position.set(0,0,0.35); bar.add(r,bl); bar.position.set(L*0.2,2.62,0); inner.add(bar); this.lightbar=[r.material,bl.material]; }
      if(s.taxi){ const sign=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.18,0.24),new THREE.MeshLambertMaterial({color:0x222222,emissive:0xffd23f,emissiveIntensity:0.5})); sign.position.set(-L*0.1,prof.cabin[2][1]+0.1,0); inner.add(sign); }
    }
    // wheels
    this.wheelMeshes=[]; const ww=s.bike?0.14:s.W>2.2?0.32:0.24;
    for(const w of this.wheels){ const wg=new THREE.Group(); const tyre=new THREE.Mesh(wheelGeo(s.wheelR,ww),MAT.rubber); tyre.castShadow=true; const hub=new THREE.Mesh(wheelGeo(s.wheelR*0.62,ww*1.02),MAT.hub); const spin=new THREE.Group(); spin.add(tyre,hub); wg.add(spin); wg.position.set(w.lx,w.ly+s.comH-w.len,w.lz); inner.add(wg); this.wheelMeshes.push({grp:wg,spin}); }
    this.mesh.position.set(this.x,this.body.position.y,this.z); G.scene.add(this.mesh);
    // label sprite (mission cars)
    this.labelSprite=null;
  }
  setWreckLook(){ this.paintMat.color.setRGB(0.1,0.09,0.08); this.paintMat.shininess=5; for(const m of this.headMats) m.emissiveIntensity=0; for(const m of this.tailMats) m.emissiveIntensity=0; if(this.lightbar) for(const m of this.lightbar) m.emissiveIntensity=0; }
  setLabel(text){ if(this.labelSprite){ this.mesh.remove(this.labelSprite); this.labelSprite=null; } this.label=text; if(!text) return; const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:textTexture(text,'#fff','rgba(0,0,0,0.5)',256,64,'bold 40px sans-serif'),depthTest:false})); sp.scale.set(2.4,0.6,1); sp.position.set(0,this.stats.H+0.6,0); this.mesh.add(sp); this.labelSprite=sp; }
  updateMesh(dt,G){
    const b=this.body; this.mesh.position.set(b.position.x,b.position.y,b.position.z); this.mesh.quaternion.set(b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w);
    const s=this.stats;
    for(let i=0;i<this.wheels.length;i++){ const w=this.wheels[i], wm=this.wheelMeshes[i]; w.spin+=w.omega*dt; wm.grp.position.y=w.ly+s.comH-w.len; wm.grp.rotation.y=w.front?-this.steerAngle||0:0; wm.spin.rotation.z=-w.spin; }
    if(this.fork) this.fork.rotation.y=-(this.steerAngle||0);
    if(this.stats.bike){ this.inner.rotation.x=this.visLean||0; }
    if(this.wrecked) return;
    const night=G.city.lampGlow; const braking=this.brakeEff>0.1||this.ctrl.handbrake&&Math.abs(this.speed)>1; const reversing=this.gear<0&&this.speed<-0.3;
    for(const m of this.headMats) m.emissiveIntensity=0.25+night*0.9;
    for(const m of this.tailMats){ m.emissiveIntensity=braking?1.6:(0.35+night*0.5); m.emissive.setHex(reversing?0xffffff:0xff2020); }
    if(this.lightbar){ const on=this.siren&&Math.floor(G.time*6)%2===0; this.lightbar[0].emissiveIntensity=this.siren?(on?2.5:0.3):0.4; this.lightbar[1].emissiveIntensity=this.siren?(on?0.3:2.5):0.4; }
    if(this.label&&!this.labelSprite) this.setLabel(this.label);
    if(this.labelSprite&&this.wrecked) this.setLabel(null);
  }
  dispose(G){ G.scene.remove(this.mesh); G.physics.world.removeBody(this.body); this.paintMat.dispose(); }
}
Vehicle.nextId=1;
