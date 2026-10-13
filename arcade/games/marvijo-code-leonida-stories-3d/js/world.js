'use strict';
const TILE={GRASS:0,ROAD:1,SIDEWALK:2,BUILDING:3,WATER:4,SAND:5,PARKING:6,PLAZA:7};
const SOLID=[0,0,0,1,1,0,0,0];
const PED_OK=[1,0,1,0,0,1,1,1];
const PASTEL=[[236,184,190],[176,222,214],[244,226,176],[206,196,232],[226,214,200],[160,182,206],[238,158,128],[196,214,176],[240,200,150],[190,220,240]];
const GLASSY=[[92,124,156],[74,84,104],[120,134,148],[60,90,120],[140,150,160]];
const TILE_COL=[[78,142,60],[52,52,58],[178,176,166],[70,66,62],[36,96,150],[228,210,160],[80,80,86],[196,190,178]];

// Procedural island city. Layout logic is a port of the 2D game (same seed => same map),
// with the 2D y axis mapped onto the 3D z axis.
class World{
  constructor(seed){
    this.w=150; this.h=150; this.tiles=new Uint8Array(this.w*this.h); this.raised=new Uint8Array(this.w*this.h);
    this.R=mulberry32(seed);
    this.buildings=[]; this.trees=[]; this.lamps=[]; this.locations=[]; this.packages=[]; this.parkSpots=[]; this.staticPickups=[];
    this.roadsH=[]; this.roadsV=[]; this.nodes=[]; this.nodeList=[];
    this.hBand=new Int16Array(this.h).fill(-1); this.vBand=new Int16Array(this.w).fill(-1);
    this.generate();
    this.buildMinimap();
  }
  tile(tx,tz){ if(tx<0||tz<0||tx>=this.w||tz>=this.h) return TILE.WATER; return this.tiles[tz*this.w+tx]; }
  tileAt(px,pz){ return this.tile(Math.floor(px/T),Math.floor(pz/T)); }
  solidAt(px,pz){ return SOLID[this.tileAt(px,pz)]===1; }
  isRaised(tx,tz){ if(tx<0||tz<0||tx>=this.w||tz>=this.h) return 0; return this.raised[tz*this.w+tx]; }
  // ground height (meters) for wheels/feet
  heightAt(px,pz){ const tx=Math.floor(px/T), tz=Math.floor(pz/T); const t=this.tile(tx,tz); if(t===TILE.WATER) return -0.6; return this.raised[tz*this.w+tx]?CURB:0; }
  fill(x,y,w,h,v){ for(let j=y;j<y+h;j++) for(let i=x;i<x+w;i++) if(i>=0&&j>=0&&i<this.w&&j<this.h) this.tiles[j*this.w+i]=v; }
  loc(type){ return this.locations.find(l=>l.type===type); }
  locs(type){ return this.locations.filter(l=>l.type===type); }
  get size(){ return this.w*T; }

  generate(){
    const R=this.R, w=this.w, h=this.h;
    this.fill(0,0,w,h,TILE.WATER);
    this.fill(4,4,w-8,h-8,TILE.GRASS);
    const beachX=this.beachX=w-26;
    this.fill(beachX,4,w-4-beachX,h-8,TILE.SAND);
    const mk=(first,last)=>{ const a=[first]; let c=first; while(true){ const step=9+Math.floor(R()*7); if(c+step+8>last) break; c+=step; a.push(c);} a.push(last); return a; };
    const rv=this.roadsV=mk(8,beachX-5), rh=this.roadsH=mk(8,h-12);
    for(let i=0;i<rh.length;i++){ const r0=rh[i]; this.fill(rv[0],r0,rv[rv.length-1]+4-rv[0],4,TILE.ROAD); for(let k=0;k<4;k++)this.hBand[r0+k]=i; }
    for(let j=0;j<rv.length;j++){ const c0=rv[j]; this.fill(c0,rh[0],4,rh[rh.length-1]+4-rh[0],TILE.ROAD); for(let k=0;k<4;k++)this.vBand[c0+k]=j; }
    const nodes=this.nodes;
    for(let i=0;i<rh.length;i++){ nodes[i]=[]; for(let j=0;j<rv.length;j++){ const n={i,j,x:(rv[j]+2)*T,z:(rh[i]+2)*T,nb:[],id:this.nodeList.length}; nodes[i][j]=n; this.nodeList.push(n);} }
    const edges=[];
    for(let i=0;i<rh.length;i++) for(let j=0;j<rv.length;j++){ if(j+1<rv.length) edges.push([nodes[i][j],nodes[i][j+1],'h']); if(i+1<rh.length) edges.push([nodes[i][j],nodes[i+1][j],'v']); }
    for(const e of edges){ e[0].nb.push(e[1]); e[1].nb.push(e[0]); }
    const shuffled=edges.slice().sort(()=>R()-0.5); let removed=0; const maxRemove=Math.floor(edges.length*0.10);
    this.boulevards=[];
    for(const e of shuffled){
      if(removed>=maxRemove)break; const [a,b,dir]=e;
      if(dir==='h'&&(a.i===0||a.i===rh.length-1))continue; if(dir==='v'&&(a.j===0||a.j===rv.length-1))continue;
      if(a.nb.length<=2||b.nb.length<=2)continue;
      a.nb.splice(a.nb.indexOf(b),1); b.nb.splice(b.nb.indexOf(a),1);
      if(!this.connected()){ a.nb.push(b); b.nb.push(a); continue; }
      removed++;
      if(dir==='h'){ this.fill(rv[a.j]+4,rh[a.i],rv[b.j]-rv[a.j]-4,4,TILE.PLAZA); for(let x=rv[a.j]+5;x<rv[b.j]-1;x+=3) this.trees.push({x:(x+0.5)*T,z:(rh[a.i]+2)*T,r:1.6+R()*0.6,kind:'tree'}); }
      else { this.fill(rv[a.j],rh[a.i]+4,4,rh[b.i]-rh[a.i]-4,TILE.PLAZA); for(let y=rh[a.i]+5;y<rh[b.i]-1;y+=3) this.trees.push({x:(rv[a.j]+2)*T,z:(y+0.5)*T,r:1.6+R()*0.6,kind:'tree'}); }
    }
    // pedestrian plazas (removed road segments) are raised like sidewalks
    for(let z=0;z<h;z++) for(let x=0;x<w;x++) if(this.tiles[z*w+x]===TILE.PLAZA) this.raised[z*w+x]=1;
    const X0=rv[0]-1, X1=rv[rv.length-1]+4, Y0=rh[0]-1, Y1=rh[rh.length-1]+4;
    this.fill(X0,Y0,X1-X0+1,1,TILE.SIDEWALK); this.fill(X0,Y1,X1-X0+1,1,TILE.SIDEWALK); this.fill(X0,Y0,1,Y1-Y0+1,TILE.SIDEWALK); this.fill(X1,Y0,1,Y1-Y0+1,TILE.SIDEWALK);
    for(let x=X0;x<=X1;x++){ this.raised[Y0*w+x]=1; this.raised[Y1*w+x]=1; } for(let y=Y0;y<=Y1;y++){ this.raised[y*w+X0]=1; this.raised[y*w+X1]=1; }
    const nh=rh.length-1, nv=rv.length-1;
    this.specialCells=new Map();
    const put=(fi,fj,spec)=>{ let i=clamp(Math.round(fi*(nh-1)),0,nh-1), j=clamp(Math.round(fj*(nv-1)),0,nv-1); let guard=0; while(this.specialCells.has(i+','+j)&&guard++<50){ j=(j+1)%nv; if(j===0) i=(i+1)%nh; } this.specialCells.set(i+','+j,spec); };
    put(0.15,0.2,{type:'safehouse',name:"LUCIA'S PLACE",col:[240,196,120],size:[6,4],height:2,sign:'#ff5fa0'});
    put(0.15,0.5,{type:'dealer',name:'SUNSHINE AUTOS',col:[250,240,230],size:[7,3],height:2,lot:true,sign:'#ffd23f'});
    put(0.3,0.85,{type:'hospital',name:'LEONIDA GENERAL',col:[245,245,250],size:[8,5],height:5,sign:'#ff4040'});
    put(0.85,0.15,{type:'police',name:'LPD STATION',col:[150,170,210],size:[8,5],height:3,sign:'#7090ff'});
    put(0.5,0.3,{type:'ammu',name:'AMMU-NATION',col:[120,110,100],size:[6,4],height:2,sign:'#ffffff'});
    put(0.8,0.75,{type:'ammu',name:'AMMU-NATION',col:[120,110,100],size:[6,4],height:2,sign:'#ffffff'});
    put(0.35,0.55,{type:'spray',name:"PAY 'N' SPRAY",col:[210,120,60],size:[6,3],height:1,sign:'#ffb060'});
    put(0.85,0.45,{type:'spray',name:"PAY 'N' SPRAY",col:[210,120,60],size:[6,3],height:1,sign:'#ffb060'});
    put(0.5,0.65,{type:'bank',name:'LEONIDA BANK',col:[220,215,200],size:[8,6],height:8,sign:'#5fd97a'});
    put(0.65,0.1,{type:'club',name:'CLUB MALIBU',col:[230,120,200],size:[7,4],height:3,sign:'#40e0d0'});
    put(0.9,0.9,{type:'docks',name:"TONY'S WAREHOUSE",col:[130,120,110],size:[9,5],height:2,lot:true,sign:'#ffb040'});
    put(0.6,0.85,{type:'garage',name:'IMPORT GARAGE',col:[90,100,110],size:[7,4],height:2,lot:true,sign:'#c0f0ff'});
    put(0.05,0.9,{type:'compound',name:'CARTEL COMPOUND',col:[200,180,150],size:[10,6],height:3,lot:true,sign:'#c060ff'});
    for(let i=0;i<nh;i++) for(let j=0;j<nv;j++) this.genCell(rv[j]+4,rh[i]+4,rv[j+1]-1,rh[i+1]-1,i,j,this.specialCells.get(i+','+j));
    for(let k=0;k<90;k++){ const x=(beachX+1+R()*(w-7-beachX))*T, z=(6+R()*(h-12))*T; if(this.tileAt(x,z)===TILE.SAND) this.trees.push({x,z,r:2+R()*0.8,kind:'palm'}); }
    let tries=0; while(this.packages.length<15&&tries++<3000){ const tx=Math.floor(R()*w), tz=Math.floor(R()*h); const t=this.tile(tx,tz); if(!PED_OK[t]||t===TILE.ROAD) continue; const x=(tx+0.5)*T,z=(tz+0.5)*T; if(this.packages.some(p=>dist(p.x,p.z,x,z)<88)) continue; this.packages.push({x,z,idx:this.packages.length}); }
    const near=(type,dx,dz)=>{ const l=this.loc(type); return {x:l.x+dx,z:l.z+dz}; };
    this.staticPickups.push({...near('hospital',-9,0),type:'health'});
    this.staticPickups.push({...near('hospital',9,0),type:'health'});
    this.staticPickups.push({...near('police',-11,0),type:'armor'});
    this.staticPickups.push({...near('club',14,0),type:'weapon',weapon:'bat'});
    this.staticPickups.push({...near('safehouse',11,0),type:'weapon',weapon:'pistol'});
    this.staticPickups.push({x:(beachX+8)*T,z:(Math.floor(h/2)+0.5)*T,type:'weapon',weapon:'shotgun'});
    this.staticPickups.push({x:(beachX+12)*T,z:20*T,type:'weapon',weapon:'smg'});
    this.staticPickups.push({x:(beachX+12)*T,z:(h-20)*T,type:'armor'});
    this.staticPickups.push({...near('bank',15,0),type:'bribe'});
  }
  connected(){ const seen=new Set([0]); const st=[this.nodeList[0]]; while(st.length){ const n=st.pop(); for(const m of n.nb) if(!seen.has(m.id)){ seen.add(m.id); st.push(m);} } return seen.size===this.nodeList.length; }
  addBuilding(tx,tz,tw,th,height,col,spec){
    this.fill(tx,tz,tw,th,TILE.BUILDING);
    const b={tx,tz,tw,th,x:tx*T,z:tz*T,w:tw*T,d:th*T,height,hm:height*FLOOR_H+CURB,col,spec:spec||null,seed:this.R()};
    this.buildings.push(b); return b;
  }
  genCell(x0,y0,x1,y1,ci,cj,spec){
    const R=this.R, cw=x1-x0+1, ch=y1-y0+1;
    this.fill(x0,y0,cw,ch,TILE.SIDEWALK);
    for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++) this.raised[y*this.w+x]=1;
    for(let x=x0;x<=x1;x+=7){ this.lamps.push({x:(x+0.5)*T,z:(y0+0.5)*T}); this.lamps.push({x:(x+0.5)*T,z:(y1+0.5)*T}); }
    for(let y=y0+7;y<y1;y+=7){ this.lamps.push({x:(x0+0.5)*T,z:(y+0.5)*T}); this.lamps.push({x:(x1+0.5)*T,z:(y+0.5)*T}); }
    const ix0=x0+1,iy0=y0+1,ix1=x1-1,iy1=y1-1, iw=ix1-ix0+1, ih=iy1-iy0+1;
    if(iw<2||ih<2){ this.fill(ix0,iy0,iw,ih,TILE.GRASS); return; }
    const cx=(x0+x1+1)/2*T, cz=(y0+y1+1)/2*T; const dc=dist(cx,cz,this.w*T/2,this.h*T/2)/(this.w*T/2); const downtown=dc<0.33;
    let special=null;
    if(spec){
      const bw=Math.min(spec.size[0],iw), bh=Math.min(spec.size[1],ih);
      const bx=Math.floor((ix0+ix1+1)/2-bw/2), by=iy1-bh+1;
      special=this.addBuilding(bx,by,bw,bh,spec.height,spec.col,spec);
      const mx=(bx+bw/2)*T, mz=(y1+0.5)*T;
      this.locations.push({type:spec.type,name:spec.name,x:mx,z:mz,r:(spec.type==='spray'||spec.type==='dealer')?5.5:3.2,building:special,cell:{x0,y0,x1,y1}});
    }
    const r=R();
    const kind = spec? (spec.lot?'lot':'bld') : (r<0.13?'park': r<0.2?'lot':'bld');
    const interiorFree=(x,y)=> !(special && x>=special.tx&&x<special.tx+special.tw&&y>=special.tz&&y<special.tz+special.th);
    if(kind==='park'){
      for(let y=iy0;y<=iy1;y++) for(let x=ix0;x<=ix1;x++) if(interiorFree(x,y)) this.tiles[y*this.w+x]=TILE.GRASS;
      const my=Math.floor((iy0+iy1)/2), mx=Math.floor((ix0+ix1)/2);
      for(let x=ix0;x<=ix1;x++) if(interiorFree(x,my)) this.tiles[my*this.w+x]=TILE.PLAZA;
      for(let y=iy0;y<=iy1;y++) if(interiorFree(mx,y)) this.tiles[y*this.w+mx]=TILE.PLAZA;
      const n=Math.floor(iw*ih/7);
      for(let k=0;k<n;k++){ const x=(ix0+R()*iw)*T, z=(iy0+R()*ih)*T; if(this.tileAt(x,z)===TILE.GRASS) this.trees.push({x,z,r:1.6+R()*1.0,kind:'tree'}); }
    } else if(kind==='lot'){
      for(let y=iy0;y<=iy1;y++) for(let x=ix0;x<=ix1;x++) if(interiorFree(x,y)) this.tiles[y*this.w+x]=TILE.PARKING;
      const lotKind = spec? spec.type : 'lot';
      for(let y=iy0+1;y+1<=iy1;y+=3) for(let x=ix0;x+1<=ix1;x+=2){
        if(!interiorFree(x,y)||!interiorFree(x+1,y)||!interiorFree(x,y+1)||!interiorFree(x+1,y+1)) continue;
        if(special && y+1>=special.tz-1 && x+1>=special.tx-1 && x<=special.tx+special.tw) continue;
        this.parkSpots.push({x:(x+1)*T,z:(y+1)*T,angle:-Math.PI/2,kind:lotKind});
      }
    } else {
      const lots=[]; this.split(ix0,iy0,ix1,iy1,lots);
      for(const L of lots){
        let lx0=L.x0,ly0=L.y0,lx1=L.x1,ly1=L.y1;
        if(lx1-lx0>=3&&R()<0.5){ if(R()<0.5)lx0++; else lx1--; }
        if(ly1-ly0>=3&&R()<0.5){ if(R()<0.5)ly0++; else ly1--; }
        if(special && rectsOverlap(lx0,ly0,lx1,ly1,special.tx-1,special.tz-1,special.tx+special.tw,special.tz+special.th)){
          if(ly1>=special.tz-1 && ly0<special.tz-1) ly1=special.tz-2; else continue;
          if(ly1-ly0<1) continue;
        }
        if(lx1-lx0<1||ly1-ly0<1) continue;
        const hgt = downtown? 4+Math.floor(R()*9) : 1+Math.floor(R()*4);
        const col = (downtown&&R()<0.6)? GLASSY[Math.floor(R()*GLASSY.length)] : PASTEL[Math.floor(R()*PASTEL.length)];
        this.addBuilding(lx0,ly0,lx1-lx0+1,ly1-ly0+1,hgt,col,null);
      }
      for(let y=iy0;y<=iy1;y++) for(let x=ix0;x<=ix1;x++){ const k=y*this.w+x; if(this.tiles[k]===TILE.SIDEWALK) this.tiles[k]=TILE.PLAZA; }
    }
  }
  split(x0,y0,x1,y1,out){
    const R=this.R, w=x1-x0+1, h=y1-y0+1;
    const canV = w>=7, canH = h>=7;
    const wantV = w>8 || (canV && R()<0.4), wantH = h>8 || (canH && R()<0.4);
    if(wantV && (w>=h || !wantH)){ const s=x0+3+Math.floor(R()*(w-5)); this.split(x0,y0,s-1,y1,out); this.split(s,y0,x1,y1,out); return; }
    if(wantH){ const s=y0+3+Math.floor(R()*(h-5)); this.split(x0,y0,x1,s-1,out); this.split(x0,s,x1,y1,out); return; }
    out.push({x0,y0,x1,y1});
  }
  // ----- graph helpers -----
  nearestNode(x,z){ let best=null,bd=1e18; for(const n of this.nodeList){ const d=(n.x-x)**2+(n.z-z)**2; if(d<bd){bd=d;best=n;} } return best; }
  route(a,b){ if(a===b) return [a]; const prev=new Map([[a.id,null]]); const q=[a]; let qi=0; while(qi<q.length){ const n=q[qi++]; if(n===b) break; for(const m of n.nb) if(!prev.has(m.id)){ prev.set(m.id,n); q.push(m);} } if(!prev.has(b.id)) return [a]; const path=[]; let n=b; while(n){ path.push(n); n=prev.get(n.id);} return path.reverse(); }
  randomNode(){ return this.nodeList[Math.floor(Math.random()*this.nodeList.length)]; }
  randomNodeNear(x,z,minD,maxD){ const c=this.nodeList.filter(n=>{ const d=dist(n.x,n.z,x,z); return d>=minD&&d<=maxD; }); return c.length? pick(c) : this.randomNode(); }
  randomWalkableNear(x,z,minD,maxD,allowRoad=false){ for(let i=0;i<60;i++){ const a=rnd(TAU), d=rnd(minD,maxD); const px=x+Math.cos(a)*d, pz=z+Math.sin(a)*d; const t=this.tileAt(px,pz); if(PED_OK[t]&&(allowRoad||t!==TILE.ROAD)) return {x:px,z:pz}; } return null; }
  findFreeSpot(x,z,r){ for(let ring=0;ring<8;ring++){ const n=ring===0?1:8; for(let k=0;k<n;k++){ const a=k/n*TAU, d=ring*r*1.2; const px=x+Math.cos(a)*d, pz=z+Math.sin(a)*d; if(!this.solidAt(px,pz)&&!this.solidAt(px-r,pz-r)&&!this.solidAt(px+r,pz+r)&&!this.solidAt(px+r,pz-r)&&!this.solidAt(px-r,pz+r)) return {x:px,z:pz}; } } return {x,z}; }
  // line of sight on the ground plane (buildings block)
  lineOfSight(x1,z1,x2,z2){ const d=dist(x1,z1,x2,z2); const n=Math.ceil(d/1.5); for(let i=1;i<n;i++){ const t=i/n; if(this.solidAt(lerp(x1,x2,t),lerp(z1,z2,t))) return false; } return true; }
  // ray vs buildings (3D): returns t (meters) of first hit or Infinity. dir normalised.
  raycastBuildings(ox,oy,oz,dx,dy,dz,maxT){
    // 2D DDA across tiles. Buildings are full columns [0,top]; ground is a heightfield.
    let tx=Math.floor(ox/T), tz=Math.floor(oz/T);
    const stepX=dx>0?1:-1, stepZ=dz>0?1:-1;
    const tDX=dx!==0?Math.abs(T/dx):1e18, tDZ=dz!==0?Math.abs(T/dz):1e18;
    let tMaxX=dx!==0?((dx>0?(tx+1)*T-ox:ox-tx*T)/Math.abs(dx)):1e18;
    let tMaxZ=dz!==0?((dz>0?(tz+1)*T-oz:oz-tz*T)/Math.abs(dz)):1e18;
    let tEnter=0;
    for(let i=0;i<600;i++){
      if(tx<0||tz<0||tx>=this.w||tz>=this.h) return Infinity;
      const tExit=Math.min(tMaxX,tMaxZ,maxT);
      const tile=this.tile(tx,tz);
      const yEnter=oy+dy*tEnter, yExit=oy+dy*tExit;
      if(tile===TILE.BUILDING){ const b=this.buildingAtTile(tx,tz); const top=b?b.hm:8; if(yEnter<=top) return tEnter; if(yExit<=top) return (top-oy)/dy; }
      const gh=this.heightAt(tx*T+1,tz*T+1); if(yExit<=gh){ return dy<0?Math.max(tEnter,(gh-oy)/dy):tEnter; }
      if(tExit>=maxT) return Infinity;
      if(tMaxX<tMaxZ){ tEnter=tMaxX; tMaxX+=tDX; tx+=stepX; } else { tEnter=tMaxZ; tMaxZ+=tDZ; tz+=stepZ; }
    }
    return Infinity;
  }
  buildingAtTile(tx,tz){ if(!this.bIndex){ this.bIndex=new Int16Array(this.w*this.h).fill(-1); this.buildings.forEach((b,i)=>{ for(let z=b.tz;z<b.tz+b.th;z++) for(let x=b.tx;x<b.tx+b.tw;x++) this.bIndex[z*this.w+x]=i; }); } const i=this.bIndex[tz*this.w+tx]; return i>=0?this.buildings[i]:null; }
  // ----- minimap -----
  buildMinimap(){
    const c=document.createElement('canvas'); c.width=this.w; c.height=this.h; const g=c.getContext('2d'); const img=g.createImageData(this.w,this.h); const d=img.data;
    const cols=[[70,130,60],[70,70,78],[170,170,160],[110,105,100],[40,100,150],[225,205,150],[95,95,100],[190,185,175]];
    for(let y=0;y<this.h;y++) for(let x=0;x<this.w;x++){ const t=this.tiles[y*this.w+x]; const k=(y*this.w+x)*4; d[k]=cols[t][0]; d[k+1]=cols[t][1]; d[k+2]=cols[t][2]; d[k+3]=255; }
    g.putImageData(img,0,0); this.minimap=c;
  }
}
