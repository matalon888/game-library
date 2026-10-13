'use strict';
// Police helicopter: orbits above the player, searchlight at night, door gunner.
class Helicopter{
  constructor(x,z,G){ this.G=G; this.x=x; this.z=z; this.y=38; this.vx=0; this.vz=0; this.vy=0; this.angle=0; this.hp=380; this.maxHp=380; this.rotor=0; this.shootCd=2; this.dead=false; this.fallT=0; this.orbit=rnd(TAU); this.removed=false; this.burst=0; this.isHeli=true; this.tilt=0; this.roll=0;
    const g=this.mesh=new THREE.Group(); const mat=new THREE.MeshPhongMaterial({color:0x2b3a5a,shininess:50});
    const fus=new THREE.Mesh(new THREE.SphereGeometry(1,14,10),mat); fus.scale.set(2.6,1.2,1.3); fus.position.set(0.6,0,0); g.add(fus);
    const cockpit=new THREE.Mesh(new THREE.SphereGeometry(0.8,12,8),MAT.glass); cockpit.scale.set(1.3,0.9,1.0); cockpit.position.set(2.2,0.15,0); g.add(cockpit);
    const tail=new THREE.Mesh(new THREE.BoxGeometry(4.2,0.5,0.4),mat); tail.position.set(-3.2,0.3,0); g.add(tail);
    const fin=new THREE.Mesh(new THREE.BoxGeometry(0.5,1.5,0.15),mat); fin.position.set(-5.1,0.9,0); g.add(fin);
    for(const s of [-1,1]){ const skid=new THREE.Mesh(new THREE.BoxGeometry(3.2,0.08,0.08),MAT.chrome); skid.position.set(0.5,-1.3,s*0.9); g.add(skid); for(const dx of [-1,1]){ const strut=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.7,0.06),MAT.chrome); strut.position.set(0.5+dx*1.0,-0.95,s*0.9); g.add(strut); } }
    const mast=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,0.6,6),MAT.dark); mast.position.set(0.4,1.3,0); g.add(mast);
    this.rotorGrp=new THREE.Group(); this.rotorGrp.position.set(0.4,1.55,0); for(let i=0;i<4;i++){ const bl=new THREE.Mesh(new THREE.BoxGeometry(5.6,0.04,0.28),MAT.dark); bl.rotation.y=i*Math.PI/2; bl.position.x=0; bl.geometry.translate(0,0,0); this.rotorGrp.add(bl); } g.add(this.rotorGrp);
    const disc=new THREE.Mesh(new THREE.CircleGeometry(5.8,24),new THREE.MeshBasicMaterial({color:0x111111,transparent:true,opacity:0.25,side:THREE.DoubleSide})); disc.rotation.x=-Math.PI/2; disc.position.set(0.4,1.6,0); g.add(disc);
    this.tailRotor=new THREE.Group(); this.tailRotor.position.set(-5.1,0.9,0.15); for(let i=0;i<2;i++){ const bl=new THREE.Mesh(new THREE.BoxGeometry(0.06,1.0,0.12),MAT.dark); bl.rotation.x=i*Math.PI/2; this.tailRotor.add(bl); } g.add(this.tailRotor);
    const decal=new THREE.Mesh(new THREE.PlaneGeometry(1.2,0.4),new THREE.MeshBasicMaterial({map:textTexture('LPD','#ffffff',null,256,96,'bold 70px Impact, Arial Black, sans-serif'),transparent:true})); decal.position.set(-1.5,0.35,0.42); g.add(decal);
    this.light=new THREE.SpotLight(0xfff2cc,0,120,0.28,0.5,1); this.light.position.set(1.5,-0.8,0); g.add(this.light); g.add(this.light.target); this.light.target.position.set(1.5,-30,0);
    const lamp=new THREE.Mesh(new THREE.SphereGeometry(0.25,8,6),new THREE.MeshBasicMaterial({color:0xfff2cc})); lamp.position.set(1.5,-0.8,0); g.add(lamp);
    this.strobe=new THREE.Mesh(new THREE.SphereGeometry(0.16,8,6),new THREE.MeshBasicMaterial({color:0xff3030})); this.strobe.position.set(-5.2,1.8,0); g.add(this.strobe);
    g.position.set(x,this.y,z); G.scene.add(g);
  }
  update(dt,G){
    this.rotor+=dt*45; this.rotorGrp.rotation.y=this.rotor; this.tailRotor.rotation.z=this.rotor*3;
    if(this.dead){ this.fallT+=dt; this.vy-=6*dt; this.y+=this.vy*dt; this.angle+=dt*6; this.x+=this.vx*dt; this.z+=this.vz*dt; this.roll+=dt*1.5; if(Math.random()<dt*30) G.fx.smoke(this.x,this.y,this.z,{big:true,dark:true}); if(Math.random()<dt*20) G.fx.fire(this.x,this.y,this.z);
      const gy=G.world.heightAt(this.x,this.z); if(this.y<=gy+1.5){ this.removed=true; G.explosion(this.x,gy+1,this.z,16,G.player,null); G.fx.decal('scorch',this.x,gy,this.z,5); G.scene.remove(this.mesh); }
      this.mesh.position.set(this.x,this.y,this.z); this.mesh.rotation.set(0,-this.angle,this.roll); return; }
    const P=G.player; const tv=P.vehicle||P;
    this.orbit+=dt*0.55; const R=P.vehicle?26:20;
    const tx=tv.x+Math.cos(this.orbit)*R, tz=tv.z+Math.sin(this.orbit)*R; const dx=tx-this.x, dz=tz-this.z;
    this.vx+=dx*1.6*dt; this.vz+=dz*1.6*dt; const sp=Math.hypot(this.vx,this.vz); const maxS=45; if(sp>maxS){ this.vx*=maxS/sp; this.vz*=maxS/sp; }
    this.vx*=Math.pow(0.35,dt); this.vz*=Math.pow(0.35,dt);
    this.x+=this.vx*dt; this.z+=this.vz*dt; const targetY=38+Math.sin(G.time*0.7)*2; this.y=damp(this.y,targetY,1.5,dt);
    this.angle=turnToward(this.angle,angTo(this.x,this.z,tv.x,tv.z),dt*2.2);
    const fx=Math.cos(this.angle), fz=Math.sin(this.angle); const ax=(this.vx*fx+this.vz*fz), lat=(-this.vx*fz+this.vz*fx); this.tilt=damp(this.tilt,clamp(ax*0.012,-0.25,0.25),3,dt); this.roll=damp(this.roll,clamp(-lat*0.012,-0.25,0.25),3,dt);
    this.mesh.position.set(this.x,this.y,this.z); this.mesh.rotation.set(0,-this.angle,0); this.mesh.rotateZ(-this.tilt); this.mesh.rotateX(this.roll);
    // searchlight follows target
    const night=G.city.lampGlow; this.light.intensity=night*900; const lp=new THREE.Vector3(tv.x,(tv.y||0)+0.5,tv.z); this.mesh.worldToLocal(lp); this.light.target.position.copy(lp);
    this.strobe.material.color.setHex(Math.floor(G.time*4)%2===0?0xff3030:0x3050ff);
    this.shootCd-=dt;
    if(this.shootCd<=0&&!P.dead&&dist(this.x,this.z,tv.x,tv.z)<55){ if(this.burst<=0) this.burst=8; G.fireBullet(this,{x:this.x+fx*1.2,y:this.y-0.9,z:this.z+fz*1.2},{x:tv.x,y:(tv.y||0)+0.8,z:tv.z},'rifle',0.12); this.burst--; this.shootCd=this.burst>0?0.09:rnd(1.6,2.6); }
  }
  damage(amt,src,G){ if(this.dead) return; this.hp-=amt; if(this.hp<=0){ this.dead=true; this.vy=2; G.notify('Helicopter down!','#ffd23f'); G.addCrime(3); G.stats.vehiclesDestroyed++; G.explosionFx(this.x,this.y,this.z,5); this.light.intensity=0; } }
  rayHit(o,d,maxT){ const cx=this.x-o.x, cy=this.y-o.y, cz=this.z-o.z; const t=cx*d.x+cy*d.y+cz*d.z; if(t<0||t>maxT) return -1; const px=o.x+d.x*t-this.x, py=o.y+d.y*t-this.y, pz=o.z+d.z*t-this.z; return (px*px+py*py+pz*pz<3.2*3.2)?t:-1; }
}
