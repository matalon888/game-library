'use strict';
// ---------- geometry merging helper (positions/normals/uvs/colors, non-indexed) ----------
class GeoMerger{
  constructor(){ this.pos=[]; this.nor=[]; this.uv=[]; this.col=[]; }
  add(geo,matrix,color,uvScale){
    const g=geo.index?geo.toNonIndexed():geo; const p=g.attributes.position, n=g.attributes.normal, u=g.attributes.uv;
    const v=new THREE.Vector3(), nm=new THREE.Matrix3().getNormalMatrix(matrix); const c=color;
    for(let i=0;i<p.count;i++){
      v.fromBufferAttribute(p,i).applyMatrix4(matrix); this.pos.push(v.x,v.y,v.z);
      v.fromBufferAttribute(n,i).applyMatrix3(nm).normalize(); this.nor.push(v.x,v.y,v.z);
      if(u){ this.uv.push(u.getX(i)*(uvScale||1),u.getY(i)*(uvScale||1)); } else this.uv.push(0,0);
      this.col.push(c.r,c.g,c.b);
    }
    if(g!==geo) g.dispose();
  }
  quad(a,b,c,d,normal,color,uvs){ // a,b,c,d: [x,y,z] counter-clockwise seen from the normal side
    const pts=[a,b,c,a,c,d]; const uu=uvs||[[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]];
    for(let i=0;i<6;i++){ const p=pts[i]; this.pos.push(p[0],p[1],p[2]); this.nor.push(normal[0],normal[1],normal[2]); this.uv.push(uu[i][0],uu[i][1]); this.col.push(color.r,color.g,color.b); }
  }
  build(){ const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(this.pos,3)); g.setAttribute('normal',new THREE.Float32BufferAttribute(this.nor,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(this.uv,2)); g.setAttribute('color',new THREE.Float32BufferAttribute(this.col,3)); g.computeBoundingSphere(); return g; }
  get empty(){ return this.pos.length===0; }
}
function noiseTexture(size,lo,hi,seed){ const c=document.createElement('canvas'); c.width=c.height=size; const g=c.getContext('2d'); const img=g.createImageData(size,size); const d=img.data; for(let i=0;i<size*size;i++){ const v=lo+hash2(i%size+seed*7,(i/size|0)+seed*13)*(hi-lo); d[i*4]=d[i*4+1]=d[i*4+2]=v; d[i*4+3]=255; } g.putImageData(img,0,0); const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.colorSpace=THREE.SRGBColorSpace; return t; }
function windowTextures(){
  const N=4, S=64, size=N*S; const c=document.createElement('canvas'); c.width=c.height=size; const g=c.getContext('2d');
  const e=document.createElement('canvas'); e.width=e.height=size; const ge=e.getContext('2d');
  g.fillStyle='#fff'; g.fillRect(0,0,size,size); ge.fillStyle='#000'; ge.fillRect(0,0,size,size);
  for(let j=0;j<N;j++) for(let i=0;i<N;i++){
    const x=i*S, y=j*S; g.fillStyle='rgba(0,0,0,0.08)'; g.fillRect(x,y+S-3,S,3); // floor line
    g.fillStyle='#3a4658'; g.fillRect(x+14,y+12,36,38); g.fillStyle='#6f86a8'; g.fillRect(x+16,y+14,32,16); g.fillStyle='#2a3444'; g.fillRect(x+31,y+12,2,38); g.fillRect(x+14,y+30,36,2);
    const lit=hash2(i*31+7,j*17+3)<0.55; if(lit){ const warm=hash2(i,j)<0.7; ge.fillStyle=warm?'#ffd28a':'#bfe0ff'; ge.fillRect(x+16,y+14,32,34); ge.fillStyle='rgba(0,0,0,0.5)'; ge.fillRect(x+31,y+12,2,38); ge.fillRect(x+14,y+30,36,2); }
  }
  const map=new THREE.CanvasTexture(c); map.wrapS=map.wrapT=THREE.RepeatWrapping; map.colorSpace=THREE.SRGBColorSpace;
  const em=new THREE.CanvasTexture(e); em.wrapS=em.wrapT=THREE.RepeatWrapping; em.colorSpace=THREE.SRGBColorSpace;
  return {map,em};
}
function textTexture(text,color,bg,w=512,h=128,font='bold 64px Impact, Arial Black, sans-serif'){ const c=document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d'); if(bg){ g.fillStyle=bg; g.fillRect(0,0,w,h); } g.font=font; g.textAlign='center'; g.textBaseline='middle'; g.lineWidth=8; g.strokeStyle='rgba(0,0,0,0.85)'; g.strokeText(text,w/2,h/2); g.fillStyle=color; g.fillText(text,w/2,h/2); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; }

// ---------- city scene builder + environment (sky, sun, fog, lamps) ----------
class CityScene{
  constructor(G,world,scene,opts){
    this.G=G; this.world=world; this.scene=scene; this.opts=opts||{}; this.darkness=0; this.lampGlow=0;
    this.groundNoise=noiseTexture(256,215,255,1); this.groundNoise.repeat.set(1,1);
    this.build();
    this.buildEnvironment();
  }
  build(){
    const W=this.world, S=this.scene;
    // ---- ground tiles + curbs ----
    const gm=new GeoMerger(); const cc=new THREE.Color();
    const tileColor=(t,tx,tz)=>{ const c=TILE_COL[t]; let f=0.92+hash2(tx*3,tz*5)*0.16; if(t===TILE.ROAD) f=0.95+hash2(tx,tz)*0.1; cc.setRGB(c[0]*f/255,c[1]*f/255,c[2]*f/255); return cc; };
    const hOf=(tx,tz)=>{ const t=W.tile(tx,tz); if(t===TILE.WATER) return -0.7; return W.isRaised(tx,tz)?CURB:0; };
    const curbCol=new THREE.Color(0.62,0.61,0.58), coastCol=new THREE.Color(0.55,0.47,0.34);
    for(let tz=0;tz<W.h;tz++) for(let tx=0;tx<W.w;tx++){
      const t=W.tile(tx,tz); if(t===TILE.WATER) continue;
      const y=hOf(tx,tz), x0=tx*T, z0=tz*T, x1=x0+T, z1=z0+T; const col=tileColor(t,tx,tz);
      const uv=[[x0/8,z0/8],[x1/8,z0/8],[x1/8,z1/8],[x0/8,z0/8],[x1/8,z1/8],[x0/8,z1/8]];
      gm.quad([x0,y,z0],[x0,y,z1],[x1,y,z1],[x1,y,z0],[0,1,0],col,uv);
      // curb / coast faces toward lower neighbours
      const sides=[[tx-1,tz,[x0,z0],[x0,z1],[-1,0,0]],[tx+1,tz,[x1,z1],[x1,z0],[1,0,0]],[tx,tz-1,[x1,z0],[x0,z0],[0,0,-1]],[tx,tz+1,[x0,z1],[x1,z1],[0,0,1]]];
      for(const [nx,nz,a,b,n] of sides){ const ny=hOf(nx,nz); if(ny>=y) continue; const wc=W.tile(nx,nz)===TILE.WATER?coastCol:curbCol; gm.quad([a[0],ny,a[1]],[b[0],ny,b[1]],[b[0],y,b[1]],[a[0],y,a[1]],n,wc); }
    }
    const groundMat=new THREE.MeshLambertMaterial({vertexColors:true,map:this.groundNoise});
    this.ground=new THREE.Mesh(gm.build(),groundMat); this.ground.receiveShadow=true; S.add(this.ground);
    // ---- road markings ----
    const mm=new GeoMerger(); const yellow=new THREE.Color(0.95,0.78,0.2), white=new THREE.Color(0.92,0.92,0.9); const my=0.012;
    const strip=(x0,z0,x1,z1,c)=>mm.quad([x0,my,z0],[x0,my,z1],[x1,my,z1],[x1,my,z0],[0,1,0],c);
    for(let tz=0;tz<W.h;tz++) for(let tx=0;tx<W.w;tx++){
      if(W.tile(tx,tz)!==TILE.ROAD) continue; const hb=W.hBand[tz], vb=W.vBand[tx]; const x0=tx*T, z0=tz*T;
      if(hb>=0&&vb<0){ const rr=tz-W.roadsH[hb];
        if(rr===1){ for(let x=0;x<T;x+=4) strip(x0+x+0.2,z0+T-0.08,x0+x+2.2,z0+T+0.08,yellow); }
        if(rr===0) strip(x0,z0+0.25,x0+T,z0+0.4,white); if(rr===3) strip(x0,z0+T-0.4,x0+T,z0+T-0.25,white);
        const nearX=(W.vBand[tx+1]>=0&&W.tile(tx+1,tz)===TILE.ROAD)||(W.vBand[tx-1]>=0&&W.tile(tx-1,tz)===TILE.ROAD);
        if(nearX){ for(let z=0.3;z<T-0.3;z+=1.0) strip(x0+0.6,z0+z,x0+T-0.6,z0+z+0.5,white); }
      } else if(vb>=0&&hb<0){ const c=tx-W.roadsV[vb];
        if(c===1){ for(let z=0;z<T;z+=4) strip(x0+T-0.08,z0+z+0.2,x0+T+0.08,z0+z+2.2,yellow); }
        if(c===0) strip(x0+0.25,z0,x0+0.4,z0+T,white); if(c===3) strip(x0+T-0.4,z0,x0+T-0.25,z0+T,white);
        const nearZ=(W.hBand[tz+1]>=0&&W.tile(tx,tz+1)===TILE.ROAD)||(W.hBand[tz-1]>=0&&W.tile(tx,tz-1)===TILE.ROAD);
        if(nearZ){ for(let x=0.3;x<T-0.3;x+=1.0) strip(x0+x,z0+0.6,x0+x+0.5,z0+T-0.6,white); }
      }
    }
    for(let tz=0;tz<W.h;tz++) for(let tx=0;tx<W.w;tx++){ if(W.tile(tx,tz)===TILE.PARKING&&tx%2===0){ const x0=tx*T,z0=tz*T; mm.quad([x0-0.06,CURB+my,z0+0.4],[x0-0.06,CURB+my,z0+T-0.4],[x0+0.06,CURB+my,z0+T-0.4],[x0+0.06,CURB+my,z0+0.4],[0,1,0],white); } }
    this.markings=new THREE.Mesh(mm.build(),new THREE.MeshLambertMaterial({vertexColors:true})); S.add(this.markings);
    // ---- buildings ----
    const wt=windowTextures(); const bm=new GeoMerger(); const bc=new THREE.Color();
    for(const b of W.buildings){
      const h=b.hm-CURB; const geo=new THREE.BoxGeometry(b.w,h,b.d); const uv=geo.attributes.uv; const ox=hash2(b.tx,b.tz)*4, oy=Math.floor(hash2(b.tz,b.tx)*4);
      // faces: +x,-x,+y,-y,+z,-z ; 4 verts each
      const wall=[b.d/12.4,b.d/12.4,0,0,b.w/12.4,b.w/12.4];
      for(let f=0;f<6;f++) for(let k=0;k<4;k++){ const i=f*4+k; const u=uv.getX(i), v=uv.getY(i); if(f===2||f===3) uv.setXY(i,0.02,0.02); else uv.setXY(i,ox+u*wall[f],oy+v*h/(FLOOR_H*4)); }
      const f=0.9+b.seed*0.2; bc.setRGB(b.col[0]*f/255,b.col[1]*f/255,b.col[2]*f/255);
      const m=new THREE.Matrix4().makeTranslation(b.x+b.w/2,CURB+h/2,b.z+b.d/2); bm.add(geo,m,bc);
      // roof colour: overwrite the top face colours (face index 2 => verts 8..11 -> after toNonIndexed 6 verts at 12..17)
      const n=bm.col.length/3; const start=n-36+12; for(let k=0;k<6;k++){ bm.col[(start+k)*3]=bc.r*0.5; bm.col[(start+k)*3+1]=bc.g*0.5; bm.col[(start+k)*3+2]=bc.b*0.5; }
      if(b.height>=4&&b.seed>0.45){ const rw=b.w*0.35, rd=b.d*0.35; const rg=new THREE.BoxGeometry(rw,2.6,rd); rg.attributes.uv.array.fill(0.02); const rm=new THREE.Matrix4().makeTranslation(b.x+b.w*(0.3+b.seed*0.4),b.hm+1.3,b.z+b.d*0.5); bc.multiplyScalar(0.7); bm.add(rg,rm,bc); }
    }
    this.buildingMat=new THREE.MeshLambertMaterial({vertexColors:true,map:wt.map,emissiveMap:wt.em,emissive:new THREE.Color(1,1,1),emissiveIntensity:0});
    this.buildings=new THREE.Mesh(bm.build(),this.buildingMat); this.buildings.castShadow=true; this.buildings.receiveShadow=true; S.add(this.buildings);
    // ---- signs and doors on special buildings ----
    for(const l of W.locations){ const b=l.building, spec=b.spec; const width=Math.min(b.w*0.85,16); const tex=textTexture(spec.name,spec.sign||'#fff','rgba(20,10,30,0.85)',1024,160); const sign=new THREE.Mesh(new THREE.PlaneGeometry(width,width*160/1024),new THREE.MeshBasicMaterial({map:tex,transparent:true})); sign.position.set(b.x+b.w/2,Math.min(b.hm-1.2,4.2+ (b.height>1?1.2:0)),b.z+b.d+0.06); S.add(sign); l.sign=sign;
      const door=new THREE.Mesh(new THREE.PlaneGeometry(2.4,2.6),new THREE.MeshLambertMaterial({color:0x22262e})); door.position.set(b.x+b.w/2,CURB+1.3,b.z+b.d+0.05); S.add(door); }
    // ---- trees ----
    const tm=new GeoMerger(); const trunkCol=new THREE.Color(0.35,0.24,0.14); const tmp=new THREE.Matrix4(), q=new THREE.Quaternion(), e=new THREE.Euler();
    const trunk=new THREE.CylinderGeometry(0.16,0.24,1,6), canopy=new THREE.IcosahedronGeometry(1,1), frond=new THREE.BoxGeometry(2.6,0.06,0.5);
    for(const t of W.trees){ const y=W.heightAt(t.x,t.z);
      if(t.kind==='tree'){ const th=2.2+t.r*0.5; tmp.compose(new THREE.Vector3(t.x,y+th/2,t.z),q.identity(),new THREE.Vector3(1,th,1)); tm.add(trunk,tmp,trunkCol); const g=hsv(0.25+hash2(t.x,t.z)*0.1,0.55,0.45+hash2(t.z,t.x)*0.25); tmp.compose(new THREE.Vector3(t.x,y+th+t.r*0.7,t.z),q.identity(),new THREE.Vector3(t.r,t.r*0.9,t.r)); tm.add(canopy,tmp,col3(g)); }
      else { const th=5+t.r; const lean=e.set(0.12*hash2(t.x,1),hash2(t.x,t.z)*TAU,0.1); q.setFromEuler(lean); tmp.compose(new THREE.Vector3(t.x,y+th/2,t.z),q,new THREE.Vector3(0.8,th,0.8)); tm.add(trunk,tmp,new THREE.Color(0.5,0.38,0.22)); const top=new THREE.Vector3(t.x+Math.sin(lean.z)*th*0.5,y+th*0.98,t.z); for(let k=0;k<7;k++){ e.set(0,k/7*TAU,-0.45); q.setFromEuler(e); const off=new THREE.Vector3(1.1,0,0).applyQuaternion(q); tmp.compose(top.clone().add(off),q,new THREE.Vector3(1,1,1)); tm.add(frond,tmp,new THREE.Color(0.2,0.55,0.25)); } }
    }
    this.trees=new THREE.Mesh(tm.build(),new THREE.MeshLambertMaterial({vertexColors:true})); this.trees.castShadow=true; S.add(this.trees);
    // ---- street lamps ----
    const lm=new GeoMerger(), hm=new GeoMerger(), pm=new GeoMerger(); const poleCol=new THREE.Color(0.25,0.26,0.28);
    const pole=new THREE.CylinderGeometry(0.06,0.09,5.2,5), arm=new THREE.BoxGeometry(1.2,0.08,0.08), head=new THREE.BoxGeometry(0.5,0.16,0.28);
    for(const L of W.lamps){ const y=W.heightAt(L.x,L.z); const toRoad=W.tile(Math.floor(L.x/T),Math.floor(L.z/T)-1)===TILE.ROAD?-1:W.tile(Math.floor(L.x/T),Math.floor(L.z/T)+1)===TILE.ROAD?1:0; const toRoadX=toRoad===0?(W.tile(Math.floor(L.x/T)-1,Math.floor(L.z/T))===TILE.ROAD?-1:1):0;
      const ang=toRoad!==0?(toRoad<0?-Math.PI/2:Math.PI/2):(toRoadX<0?Math.PI:0);
      tmp.makeTranslation(L.x,y+2.6,L.z); lm.add(pole,tmp,poleCol);
      q.setFromEuler(e.set(0,-ang,0)); const ax=Math.cos(ang)*0.6, az=Math.sin(ang)*0.6; tmp.compose(new THREE.Vector3(L.x+ax,y+5.15,L.z+az),q,new THREE.Vector3(1,1,1)); lm.add(arm,tmp,poleCol);
      tmp.compose(new THREE.Vector3(L.x+ax*1.8,y+5.05,L.z+az*1.8),q,new THREE.Vector3(1,1,1)); hm.add(head,tmp,new THREE.Color(1,1,1)); L.hx=L.x+ax*1.8; L.hz=L.z+az*1.8; L.hy=y+5;
      const r=7, px=L.hx, pz=L.hz; pm.quad([px-r,y+0.03,pz-r],[px-r,y+0.03,pz+r],[px+r,y+0.03,pz+r],[px+r,y+0.03,pz-r],[0,1,0],new THREE.Color(1,1,1)); }
    S.add(new THREE.Mesh(lm.build(),new THREE.MeshLambertMaterial({vertexColors:true})));
    this.lampHeadMat=new THREE.MeshBasicMaterial({color:0x777777}); S.add(new THREE.Mesh(hm.build(),this.lampHeadMat));
    const poolTex=(()=>{ const c=document.createElement('canvas'); c.width=c.height=128; const g=c.getContext('2d'); const gr=g.createRadialGradient(64,64,4,64,64,64); gr.addColorStop(0,'rgba(255,225,160,0.8)'); gr.addColorStop(0.5,'rgba(255,210,140,0.3)'); gr.addColorStop(1,'rgba(255,200,120,0)'); g.fillStyle=gr; g.fillRect(0,0,128,128); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; })();
    this.lampPoolMat=new THREE.MeshBasicMaterial({map:poolTex,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:0}); S.add(new THREE.Mesh(pm.build(),this.lampPoolMat));
    // ---- water ----
    const wg=new THREE.PlaneGeometry(2600,2600,1,1); wg.rotateX(-Math.PI/2);
    this.waterMat=new THREE.MeshPhongMaterial({color:0x2a6f9e,specular:0x99bbdd,shininess:90,transparent:true,opacity:0.92});
    this.water=new THREE.Mesh(wg,this.waterMat); this.water.position.set(W.size/2,-0.35,W.size/2); S.add(this.water);
    // sea floor below (dark) so the horizon has depth
    const sf=new THREE.Mesh(new THREE.PlaneGeometry(2600,2600).rotateX(-Math.PI/2),new THREE.MeshLambertMaterial({color:0x1c3d55})); sf.position.set(W.size/2,-1.2,W.size/2); S.add(sf);
  }
  buildEnvironment(){
    const S=this.scene;
    this.sun=new THREE.DirectionalLight(0xffffff,2.2); this.sun.castShadow=!this.opts.noShadows; const sh=this.sun.shadow; sh.mapSize.set(this.opts.shadowSize||2048,this.opts.shadowSize||2048); sh.camera.near=1; sh.camera.far=400; sh.camera.left=sh.camera.bottom=-90; sh.camera.right=sh.camera.top=90; sh.bias=-0.0015; sh.normalBias=0.4; S.add(this.sun); S.add(this.sun.target);
    this.hemi=new THREE.HemisphereLight(0xbfd8ff,0x5a6a48,0.9); S.add(this.hemi);
    this.fog=new THREE.Fog(0xcfe4f5,140,this.opts.fogFar||460); S.fog=this.fog;
    // sky dome
    const skyGeo=new THREE.SphereGeometry(1500,24,12); this.skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:{top:{value:new THREE.Color(0x3d7fd0)},horizon:{value:new THREE.Color(0xcfe4f5)},sunDir:{value:new THREE.Vector3(0,1,0)},sunCol:{value:new THREE.Color(1,0.95,0.8)},night:{value:0}},
      vertexShader:'varying vec3 vDir; void main(){ vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader:'uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunCol; uniform float night; varying vec3 vDir; float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); } void main(){ float h=clamp(vDir.y,0.0,1.0); vec3 c=mix(horizon,top,pow(h,0.55)); float sd=max(dot(normalize(vDir),normalize(sunDir)),0.0); c+=sunCol*(pow(sd,900.0)*1.5+pow(sd,24.0)*0.28*(1.0-night*0.5)); if(night>0.05){ vec2 g=floor(vDir.xz*320.0/(vDir.y+0.25)); float s=hash(g); float st=step(0.994,s)*smoothstep(0.02,0.25,vDir.y); c+=vec3(st*night*0.9); } gl_FragColor=vec4(c,1.0); }'});
    this.sky=new THREE.Mesh(skyGeo,this.skyMat); S.add(this.sky);
    this.moon=new THREE.DirectionalLight(0x8fa8d8,0.0); S.add(this.moon); S.add(this.moon.target);
  }
  // time of day: clock in hours [0,24)
  update(clock,camPos,focusPos){
    const h=clock; const elev=Math.sin((h-6)/14*Math.PI); // >0 during the day (6..20)
    const az=(h-6)/14*Math.PI; const sd=new THREE.Vector3(Math.cos(az)*0.8,Math.max(elev,-0.3),Math.sin(az)*0.35).normalize();
    const day=clamp(elev*3,0,1); const dusk=clamp(1-Math.abs(elev)*5,0,1); const night=1-day;
    this.darkness=night*0.85;
    const dayTop=new THREE.Color(0x3d7fd0), dayHor=new THREE.Color(0xcfe4f5), duskTop=new THREE.Color(0x3a2c6a), duskHor=new THREE.Color(0xff8a5a), nightTop=new THREE.Color(0x05070f), nightHor=new THREE.Color(0x141a2e);
    const top=dayTop.clone().lerp(nightTop,night).lerp(duskTop,dusk*0.7), hor=dayHor.clone().lerp(nightHor,night).lerp(duskHor,dusk*0.8);
    this.skyMat.uniforms.top.value.copy(top); this.skyMat.uniforms.horizon.value.copy(hor); this.skyMat.uniforms.sunDir.value.copy(sd); this.skyMat.uniforms.night.value=night; this.skyMat.uniforms.sunCol.value.setRGB(1,0.95-dusk*0.4,0.8-dusk*0.5);
    this.sky.position.copy(camPos); this.fog.color.copy(hor); this.scene.background=hor;
    const sunCol=new THREE.Color(1,1,1).lerp(new THREE.Color(1,0.62,0.35),dusk);
    this.sun.color.copy(sunCol); this.sun.intensity=2.3*day+0.05; this.sun.position.copy(focusPos).addScaledVector(sd,120); this.sun.target.position.copy(focusPos);
    this.moon.intensity=0.32*night; this.moon.position.copy(focusPos).add(new THREE.Vector3(-40,90,30)); this.moon.target.position.copy(focusPos);
    this.hemi.intensity=0.95*day+0.24; this.hemi.color.setRGB(0.75,0.85,1).lerp(new THREE.Color(0.35,0.4,0.6),night); this.hemi.groundColor.setRGB(0.35,0.42,0.28).lerp(new THREE.Color(0.08,0.08,0.12),night);
    this.lampGlow=clamp((night-0.25)*2.2,0,1);
    this.lampHeadMat.color.setRGB(0.45+this.lampGlow*1.6,0.45+this.lampGlow*1.4,0.45+this.lampGlow*0.9); this.lampPoolMat.opacity=this.lampGlow*0.95;
    this.buildingMat.emissiveIntensity=this.lampGlow*0.9;
    this.waterMat.color.setRGB(0.16,0.44,0.62).lerp(new THREE.Color(0.03,0.06,0.12),night);
  }
}
