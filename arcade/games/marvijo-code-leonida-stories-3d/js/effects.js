'use strict';
// Particles (GPU points), skid marks, decals, tracers, flash lights, explosion spheres.
class FX{
  constructor(G,scene){
    this.G=G; this.scene=scene; const N=this.N=2200; this.parts=[]; this.count=0;
    const g=new THREE.BufferGeometry(); this.pPos=new Float32Array(N*3); this.pCol=new Float32Array(N*3); this.pSize=new Float32Array(N); this.pAlpha=new Float32Array(N);
    g.setAttribute('position',new THREE.BufferAttribute(this.pPos,3)); g.setAttribute('pcol',new THREE.BufferAttribute(this.pCol,3)); g.setAttribute('psize',new THREE.BufferAttribute(this.pSize,1)); g.setAttribute('palpha',new THREE.BufferAttribute(this.pAlpha,1));
    const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{},vertexShader:'attribute float psize; attribute float palpha; attribute vec3 pcol; varying vec4 vC; void main(){ vC=vec4(pcol,palpha); vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=psize*420.0/max(1.0,-mv.z); gl_Position=projectionMatrix*mv; }',fragmentShader:'varying vec4 vC; void main(){ vec2 d=gl_PointCoord-0.5; float r=length(d); if(r>0.5) discard; float a=smoothstep(0.5,0.12,r)*vC.a; gl_FragColor=vec4(vC.rgb,a); }'});
    this.points=new THREE.Points(g,mat); this.points.frustumCulled=false; scene.add(this.points);
    // skid marks ring buffer
    const SK=this.SK=700; const sg=new THREE.BufferGeometry(); this.skPos=new Float32Array(SK*6*3); sg.setAttribute('position',new THREE.BufferAttribute(this.skPos,3)); this.skMesh=new THREE.Mesh(sg,new THREE.MeshBasicMaterial({color:0x0a0a0a,transparent:true,opacity:0.5,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2})); this.skMesh.frustumCulled=false; this.skIdx=0; scene.add(this.skMesh); sg.setDrawRange(0,0);
    // decals
    const DN=this.DN=260; const dg=new THREE.BufferGeometry(); this.dPos=new Float32Array(DN*6*3); this.dCol=new Float32Array(DN*6*3); this.dUv=new Float32Array(DN*6*2); dg.setAttribute('position',new THREE.BufferAttribute(this.dPos,3)); dg.setAttribute('color',new THREE.BufferAttribute(this.dCol,3)); dg.setAttribute('uv',new THREE.BufferAttribute(this.dUv,2));
    const dc=document.createElement('canvas'); dc.width=dc.height=64; const dgc=dc.getContext('2d'); const gr=dgc.createRadialGradient(32,32,2,32,32,32); gr.addColorStop(0,'rgba(255,255,255,0.95)'); gr.addColorStop(0.6,'rgba(255,255,255,0.6)'); gr.addColorStop(1,'rgba(255,255,255,0)'); dgc.fillStyle=gr; dgc.fillRect(0,0,64,64);
    this.decalMesh=new THREE.Mesh(dg,new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(dc),vertexColors:true,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3})); this.decalMesh.frustumCulled=false; this.dIdx=0; scene.add(this.decalMesh); dg.setDrawRange(0,0);
    // tracers
    const TN=this.TN=80; const tg=new THREE.BufferGeometry(); this.tPos=new Float32Array(TN*2*3); tg.setAttribute('position',new THREE.BufferAttribute(this.tPos,3)); this.tracers=new THREE.LineSegments(tg,new THREE.LineBasicMaterial({color:0xffe9a0,transparent:true,opacity:0.9})); this.tracers.frustumCulled=false; this.tLife=new Float32Array(TN); this.tIdx=0; scene.add(this.tracers);
    // lights pool
    this.lights=[]; for(let i=0;i<4;i++){ const l=new THREE.PointLight(0xffaa55,0,30,2); l.visible=false; scene.add(l); this.lights.push({l,t:0,dur:1,peak:0}); }
    // explosion spheres pool
    this.booms=[]; for(let i=0;i<5;i++){ const m=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),new THREE.MeshBasicMaterial({color:0xffa030,transparent:true,opacity:0.9,blending:THREE.AdditiveBlending,depthWrite:false})); m.visible=false; scene.add(m); this.booms.push({m,t:0,r:1}); }
  }
  spawn(type,x,y,z,o={}){
    if(this.parts.length>=this.N) this.parts.shift();
    const p={x,y,z,vx:0,vy:0,vz:0,life:1,max:1,size:0.6,r:1,g:1,b:1,a:1,grav:0,drag:0,grow:0,type};
    switch(type){
      case 'smoke': p.max=o.big?2.2:1.3; p.size=o.small?0.3:o.big?1.4:0.8; p.grow=o.big?1.6:0.9; p.vx=rnd(-0.8,0.8); p.vz=rnd(-0.8,0.8); p.vy=rnd(1.2,2.6); const s=o.dark?0.15:0.55; p.r=p.g=p.b=s; p.a=o.dark?0.6:0.45; break;
      case 'fire': p.max=rnd(0.3,0.7); p.size=rnd(0.5,1.1); p.vx=rnd(-1.5,1.5); p.vz=rnd(-1.5,1.5); p.vy=rnd(1,4); p.r=1; p.g=rnd(0.35,0.7); p.b=0.1; p.a=0.9; p.grow=-0.6; break;
      case 'spark': p.max=rnd(0.15,0.4); p.size=0.12; p.vx=rnd(-7,7); p.vz=rnd(-7,7); p.vy=rnd(0,7); p.grav=1; p.r=1; p.g=0.85; p.b=0.4; break;
      case 'blood': p.max=rnd(0.3,0.6); p.size=rnd(0.1,0.2); p.vx=rnd(-3,3); p.vz=rnd(-3,3); p.vy=rnd(0.5,3.5); p.grav=1; p.r=0.6; p.g=0.02; p.b=0.02; break;
      case 'debris': p.max=rnd(0.6,1.4); p.size=rnd(0.15,0.35); p.vx=rnd(-12,12); p.vz=rnd(-12,12); p.vy=rnd(4,14); p.grav=1; p.r=0.2; p.g=0.18; p.b=0.16; break;
      case 'cash': p.max=rnd(0.6,1.2); p.size=0.25; p.vx=rnd(-3,3); p.vz=rnd(-3,3); p.vy=rnd(2,5); p.grav=0.5; p.r=0.3; p.g=0.8; p.b=0.35; break;
      case 'water': p.max=rnd(0.4,0.9); p.size=rnd(0.2,0.4); p.vx=rnd(-4,4); p.vz=rnd(-4,4); p.vy=rnd(1,5); p.grav=1; p.r=0.7; p.g=0.85; p.b=1; p.a=0.8; break;
      case 'dust': p.max=rnd(0.5,1.0); p.size=0.6; p.grow=1.2; p.vx=rnd(-1,1); p.vz=rnd(-1,1); p.vy=rnd(0.3,1); p.r=0.75; p.g=0.7; p.b=0.6; p.a=0.35; break;
    }
    p.life=p.max; this.parts.push(p);
  }
  smoke(x,y,z,o){ this.spawn('smoke',x,y,z,o); } fire(x,y,z){ this.spawn('fire',x,y,z); } spark(x,y,z){ this.spawn('spark',x,y,z); } blood(x,y,z){ this.spawn('blood',x,y,z); } debris(x,y,z){ this.spawn('debris',x,y,z); } water(x,y,z){ this.spawn('water',x,y,z); } dust(x,y,z){ this.spawn('dust',x,y,z); }
  skid(v,w){ const key=w; if(!key.lastSkid){ key.lastSkid={x:w.cx,z:w.cz}; return; } const d=dist(key.lastSkid.x,key.lastSkid.z,w.cx,w.cz); if(d<0.35) return; if(d>3){ key.lastSkid={x:w.cx,z:w.cz}; return; }
    const ax=key.lastSkid.x, az=key.lastSkid.z, bx=w.cx, bz=w.cz; const nx=-(bz-az)/d*0.11, nz=(bx-ax)/d*0.11; const y=w.cy+0.02; const i=this.skIdx*18; const P=this.skPos;
    const quad=[[ax+nx,az+nz],[ax-nx,az-nz],[bx-nx,bz-nz],[ax+nx,az+nz],[bx-nx,bz-nz],[bx+nx,bz+nz]]; for(let k=0;k<6;k++){ P[i+k*3]=quad[k][0]; P[i+k*3+1]=y; P[i+k*3+2]=quad[k][1]; }
    this.skIdx=(this.skIdx+1)%this.SK; this.skFilled=Math.min(this.SK,(this.skFilled||0)+1); this.skMesh.geometry.attributes.position.needsUpdate=true; this.skMesh.geometry.setDrawRange(0,this.skFilled*6); key.lastSkid={x:bx,z:bz}; }
  decal(type,x,y,z,r){ const i=this.dIdx*18, iu=this.dIdx*12; const c=type==='blood'?[0.45,0.02,0.02]:[0.05,0.05,0.05]; const rot=rnd(TAU); const pts=[[-1,-1],[-1,1],[1,1],[-1,-1],[1,1],[1,-1]]; const uv=[[0,0],[0,1],[1,1],[0,0],[1,1],[1,0]];
    for(let k=0;k<6;k++){ const px=pts[k][0]*r, pz=pts[k][1]*r; const rx=px*Math.cos(rot)-pz*Math.sin(rot), rz=px*Math.sin(rot)+pz*Math.cos(rot); this.dPos[i+k*3]=x+rx; this.dPos[i+k*3+1]=y+0.025; this.dPos[i+k*3+2]=z+rz; this.dCol[i+k*3]=c[0]; this.dCol[i+k*3+1]=c[1]; this.dCol[i+k*3+2]=c[2]; this.dUv[iu+k*2]=uv[k][0]; this.dUv[iu+k*2+1]=uv[k][1]; }
    this.dIdx=(this.dIdx+1)%this.DN; this.dFilled=Math.min(this.DN,(this.dFilled||0)+1); const g=this.decalMesh.geometry; g.attributes.position.needsUpdate=true; g.attributes.color.needsUpdate=true; g.attributes.uv.needsUpdate=true; g.setDrawRange(0,this.dFilled*6); }
  tracer(ax,ay,az,bx,by,bz){ const i=this.tIdx*6; const P=this.tPos; P[i]=ax;P[i+1]=ay;P[i+2]=az;P[i+3]=bx;P[i+4]=by;P[i+5]=bz; this.tLife[this.tIdx]=0.06; this.tIdx=(this.tIdx+1)%this.TN; this.tracers.geometry.attributes.position.needsUpdate=true; }
  flash(x,y,z,peak,color,dur){ let best=this.lights[0]; for(const L of this.lights){ if(L.t<=0){ best=L; break; } if(L.t<best.t) best=L; } best.l.position.set(x,y,z); best.l.color.setHex(color||0xffb060); best.peak=peak; best.t=dur; best.dur=dur; best.l.visible=true; best.l.intensity=peak; }
  boom(x,y,z,r){ let best=this.booms[0]; for(const b of this.booms){ if(b.t<=0){ best=b; break; } } best.m.position.set(x,y,z); best.t=0.5; best.r=r; best.m.visible=true; }
  update(dt){
    // particles
    const P=this.parts; let n=0; const pos=this.pPos, col=this.pCol, sz=this.pSize, al=this.pAlpha;
    for(let i=P.length-1;i>=0;i--){ const p=P[i]; p.life-=dt; if(p.life<=0){ P.splice(i,1); continue; } if(p.grav) p.vy-=9.81*p.grav*dt; if(p.type==='debris'||p.type==='blood'||p.type==='water'||p.type==='spark'){ const f=Math.pow(0.35,dt); p.vx*=f; p.vz*=f; } p.x+=p.vx*dt; p.y+=p.vy*dt; p.z+=p.vz*dt; if(p.grav&&p.y<0.05){ p.y=0.05; p.vy=0; p.vx*=0.5; p.vz*=0.5; } p.size+=p.grow*dt; }
    for(const p of P){ const t=p.life/p.max; pos[n*3]=p.x; pos[n*3+1]=p.y; pos[n*3+2]=p.z; col[n*3]=p.r; col[n*3+1]=p.g; col[n*3+2]=p.b; sz[n]=Math.max(0.02,p.size); al[n]=p.a*(p.type==='smoke'?Math.min(1,t*2)*t:t); n++; }
    const g=this.points.geometry; g.attributes.position.needsUpdate=true; g.attributes.pcol.needsUpdate=true; g.attributes.psize.needsUpdate=true; g.attributes.palpha.needsUpdate=true; g.setDrawRange(0,n);
    // tracers
    let tdirty=false; for(let i=0;i<this.TN;i++){ if(this.tLife[i]>0){ this.tLife[i]-=dt; if(this.tLife[i]<=0){ const k=i*6; for(let j=0;j<6;j++) this.tPos[k+j]=0; tdirty=true; } } } if(tdirty) this.tracers.geometry.attributes.position.needsUpdate=true;
    for(const L of this.lights){ if(L.t>0){ L.t-=dt; L.l.intensity=L.peak*Math.max(0,L.t/L.dur); if(L.t<=0){ L.l.visible=false; L.l.intensity=0; } } }
    for(const b of this.booms){ if(b.t>0){ b.t-=dt; const k=1-b.t/0.5; const s=b.r*(0.3+k*1.0); b.m.scale.set(s,s*0.9,s); b.m.material.opacity=0.9*(1-k); if(b.t<=0) b.m.visible=false; } }
  }
}
