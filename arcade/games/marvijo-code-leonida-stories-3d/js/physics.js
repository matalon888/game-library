'use strict';
// cannon-es world: rigid bodies for vehicles, static boxes for buildings/trees/coast walls.
const GROUP_STATIC=1, GROUP_VEHICLE=2, GROUP_DEBRIS=4;
class Physics{
  constructor(world){
    const C=CANNON; const pw=this.world=new C.World({gravity:new C.Vec3(0,-9.81,0)});
    pw.broadphase=new C.SAPBroadphase(pw); pw.allowSleep=true; pw.solver.iterations=10; pw.solver.tolerance=0.001; pw.defaultContactMaterial.friction=0.4; pw.defaultContactMaterial.restitution=0.1;
    this.matStatic=new C.Material('static'); this.matChassis=new C.Material('chassis'); this.matGround=new C.Material('ground');
    pw.addContactMaterial(new C.ContactMaterial(this.matChassis,this.matStatic,{friction:0.35,restitution:0.18,contactEquationStiffness:1e7,contactEquationRelaxation:3}));
    pw.addContactMaterial(new C.ContactMaterial(this.matChassis,this.matChassis,{friction:0.35,restitution:0.22,contactEquationStiffness:1e7,contactEquationRelaxation:3}));
    pw.addContactMaterial(new C.ContactMaterial(this.matChassis,this.matGround,{friction:0.5,restitution:0.05,contactEquationStiffness:1e7,contactEquationRelaxation:3}));
    // ground plane at road level
    const ground=new C.Body({mass:0,material:this.matGround,collisionFilterGroup:GROUP_STATIC,collisionFilterMask:GROUP_VEHICLE|GROUP_DEBRIS}); ground.addShape(new C.Plane()); ground.quaternion.setFromEuler(-Math.PI/2,0,0); pw.addBody(ground);
    // buildings
    for(const b of world.buildings){ const body=new C.Body({mass:0,material:this.matStatic,collisionFilterGroup:GROUP_STATIC,collisionFilterMask:GROUP_VEHICLE|GROUP_DEBRIS}); body.addShape(new C.Box(new C.Vec3(b.w/2,b.hm/2,b.d/2))); body.position.set(b.x+b.w/2,b.hm/2,b.z+b.d/2); body.isBuilding=true; pw.addBody(body); }
    // trees (thin columns)
    for(const t of world.trees){ const body=new C.Body({mass:0,material:this.matStatic,collisionFilterGroup:GROUP_STATIC,collisionFilterMask:GROUP_VEHICLE}); const r=t.kind==='palm'?0.28:0.24; body.addShape(new C.Box(new C.Vec3(r,3,r))); body.position.set(t.x,world.heightAt(t.x,t.z)+3,t.z); body.isTree=true; pw.addBody(body); }
    // coast walls (island margin is 4 tiles)
    const m=4*T, S=world.size; const walls=[[m,S/2,1,S],[S-m,S/2,1,S],[S/2,m,S,1],[S/2,S-m,S,1]];
    for(const [x,z,sx,sz] of walls){ const body=new C.Body({mass:0,material:this.matStatic,collisionFilterGroup:GROUP_STATIC,collisionFilterMask:GROUP_VEHICLE|GROUP_DEBRIS}); body.addShape(new C.Box(new C.Vec3(sx/2,12,sz/2))); body.position.set(x,6,z); body.isWall=true; pw.addBody(body); }
  }
  step(h){ this.world.step(h); }
}
