'use strict';
const WEAPONS={
  fist:{name:'Fist',dmg:12,rate:0.35,range:1.6,melee:true},
  bat:{name:'Baseball Bat',dmg:40,rate:0.5,range:2.2,melee:true,price:50},
  pistol:{name:'Pistol',dmg:26,rate:0.22,spread:0.02,auto:false,clip:17,price:250,ammoPrice:50,driveby:true},
  smg:{name:'Uzi 9mm',dmg:13,rate:0.075,spread:0.06,auto:true,clip:30,price:600,ammoPrice:120,driveby:true},
  shotgun:{name:'Shotgun',dmg:11,pellets:7,rate:0.85,spread:0.09,auto:false,clip:8,price:800,ammoPrice:150,maxRange:35},
  rifle:{name:'Assault Rifle',dmg:32,rate:0.11,spread:0.025,auto:true,clip:30,price:1500,ammoPrice:250,driveby:true},
  rocket:{name:'RPG',dmg:80,rate:1.4,speed:60,spread:0,auto:false,clip:1,price:5000,ammoPrice:1000,rocket:true},
};
const WEAPON_ORDER=['fist','bat','pistol','smg','shotgun','rifle','rocket'];
const WANTED_THRESHOLDS=[1,3,6,10,15];
const PHYS_DT=1/120;

class Pickup{
  constructor(x,z,type,opts,G){ this.x=x;this.z=z;this.y=G.world.heightAt(x,z);this.type=type;this.amount=opts.amount||0;this.weapon=opts.weapon||null;this.t=rnd(10);this.expire=opts.expire||0;this.removed=false;this.respawn=opts.respawn||0;this.hiddenUntil=0;this.pkgIdx=opts.pkgIdx;this.missionItem=opts.missionItem||false;this.label=opts.label||null;this.ammo=opts.ammo;
    const g=this.mesh=new THREE.Group(); let m;
    switch(type){
      case 'cash': m=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.12,0.3),new THREE.MeshLambertMaterial({color:0x3fbf5f,emissive:0x1b5e2b,emissiveIntensity:0.5})); break;
      case 'health': m=new THREE.Group(); const s=new THREE.Mesh(new THREE.SphereGeometry(0.28,12,10),new THREE.MeshLambertMaterial({color:0xffffff,emissive:0x444444})); const c1=new THREE.Mesh(new THREE.BoxGeometry(0.36,0.1,0.1),new THREE.MeshBasicMaterial({color:0xe02020})); const c2=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.36,0.1),new THREE.MeshBasicMaterial({color:0xe02020})); c1.position.z=c2.position.z=0.26; m.add(s,c1,c2); break;
      case 'armor': m=new THREE.Mesh(new THREE.OctahedronGeometry(0.32,0),new THREE.MeshLambertMaterial({color:0x4a7fd0,emissive:0x203a70})); break;
      case 'weapon': m=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.12,0.1),new THREE.MeshLambertMaterial({color:0x333333,emissive:0x222222})); break;
      case 'package': m=new THREE.Mesh(new THREE.BoxGeometry(0.45,0.45,0.45),new THREE.MeshLambertMaterial({color:0x8a5a2a,emissive:0x3a2a10})); break;
      case 'bribe': m=new THREE.Mesh(new THREE.OctahedronGeometry(0.3,0),new THREE.MeshLambertMaterial({color:0xffd23f,emissive:0x806000})); break;
      default: m=new THREE.Mesh(new THREE.BoxGeometry(0.4,0.3,0.4),new THREE.MeshLambertMaterial({color:0xe8e0c0}));
    }
    g.add(m); this.inner=m; const ring=new THREE.Mesh(new THREE.RingGeometry(0.55,0.75,24),new THREE.MeshBasicMaterial({color:type==='package'?0xffd23f:type==='health'?0xff6060:type==='armor'?0x60a0ff:type==='cash'?0x60ff80:0xffffff,transparent:true,opacity:0.6,side:THREE.DoubleSide})); ring.rotation.x=-Math.PI/2; ring.position.y=0.03; g.add(ring);
    if(type==='weapon'){ const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:textTexture(WEAPONS[this.weapon].name,'#fff',null,256,64,'bold 36px sans-serif'),depthTest:false})); sp.scale.set(2,0.5,1); sp.position.y=1.4; g.add(sp); }
    g.position.set(x,this.y,z); G.scene.add(g);
  }
  update(dt,G){ const vis=this.hiddenUntil<=G.time&&!this.removed; this.mesh.visible=vis; if(!vis) return; this.inner.position.y=0.6+Math.sin(G.time*3+this.t)*0.12; this.inner.rotation.y+=dt*1.5; }
  dispose(G){ G.scene.remove(this.mesh); }
}
class Rocket{
  constructor(owner,o,d,G){ this.owner=owner; this.x=o.x; this.y=o.y; this.z=o.z; this.dx=d.x; this.dy=d.y; this.dz=d.z; this.speed=WEAPONS.rocket.speed; this.life=4; this.removed=false;
    const g=this.mesh=new THREE.Group(); const body=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.09,0.7,8),new THREE.MeshLambertMaterial({color:0x556644})); body.rotation.z=-Math.PI/2; g.add(body); const tip=new THREE.Mesh(new THREE.ConeGeometry(0.07,0.2,8),new THREE.MeshLambertMaterial({color:0xcc3333})); tip.rotation.z=-Math.PI/2; tip.position.x=0.45; g.add(tip);
    g.position.set(this.x,this.y,this.z); g.lookAt(this.x+this.dx,this.y+this.dy,this.z+this.dz); g.rotateY(-Math.PI/2); G.scene.add(g); }
  update(dt,G){ const step=this.speed*dt; const hit=G.raycastAll({x:this.x,y:this.y,z:this.z},{x:this.dx,y:this.dy,z:this.dz},step+0.3,this.owner); const t=hit?hit.t:Infinity;
    if(t<=step+0.3){ this.x+=this.dx*t; this.y+=this.dy*t; this.z+=this.dz*t; G.explosion(this.x,this.y,this.z,11,this.owner,null); this.removed=true; G.scene.remove(this.mesh); return; }
    this.x+=this.dx*step; this.y+=this.dy*step; this.z+=this.dz*step; this.life-=dt; this.mesh.position.set(this.x,this.y,this.z); for(let i=0;i<3;i++) G.fx.smoke(this.x-this.dx*i*0.3,this.y-this.dy*i*0.3,this.z-this.dz*i*0.3,{small:true});
    if(this.life<=0||this.y<-1){ G.explosion(this.x,this.y,this.z,11,this.owner,null); this.removed=true; G.scene.remove(this.mesh); } }
}

class Game{
  constructor(canvas,opts={}){
    this.opts=opts; this.canvas=canvas; this.test=!!opts.test;
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:!this.test,powerPreference:'high-performance'}); this.renderer.setPixelRatio(this.test?0.6:Math.min(window.devicePixelRatio,1.5)); this.renderer.shadowMap.enabled=!this.test; this.renderer.shadowMap.type=THREE.PCFShadowMap; this.renderer.outputColorSpace=THREE.SRGBColorSpace; this.renderer.toneMapping=THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure=1.0;
    this.scene=new THREE.Scene(); this.camera=new THREE.PerspectiveCamera(62,1,0.2,1600);
    this.world=new World(1337); this.physics=new Physics(this.world); this.city=new CityScene(this,this.world,this.scene,{noShadows:this.test,shadowSize:2048});
    this.fx=new FX(this,this.scene); this.audio=new AudioSys(); this.missions=new MissionSystem(this); this.ui=new UI(this);
    this.vehicles=[]; this.peds=[]; this.rockets=[]; this.pickups=[]; this.floatTexts=[]; this.notifications=[];
    this.time=0; this.realTime=0; this.clock=10; this.cam={yaw:0,pitch:0.32,dist:5,x:0,y:2,z:0,mouseT:99,mode:0}; this.shakeT=0; this.shakeAmt=0; this.shakeX=0; this.shakeY=0;
    this.input={keys:new Set(),mouseDown:false,justDown:false,rmb:false,mx:0,my:0};
    this.state='title'; this.titleSel=0; this.menu=null; this.dialog=null; this.big=null; this.hint=''; this.hintT=0; this.hurtFlash=0; this.hitMarker=0; this.vehicleName=''; this.vehicleNameT=0; this.aiming=false;
    this.progress={missionIdx:0,packages:[]}; this.stats={kills:0,vehiclesDestroyed:0,missionsPassed:0,fares:0,criminals:0,cash:0};
    this.lastShot={x:0,z:0,t:-99}; this.lastExplosion={x:0,z:0,t:-99}; this.lastCrimeT=-99; this.gunshotHeatCd=0;
    this.heli=null; this.policeT=0; this.trafficT=0; this.pedT=0; this.busted=false; this.deathT=0; this.godMode=false; this.credits=0; this.sprayCd=0; this.fps=60; this.accum=0; this.player=null;
    this.hasSave=!!localStorage.getItem('leonida3d_save');
    this.markerMeshes=[]; for(let i=0;i<8;i++){ const g=new THREE.Group(); const cyl=new THREE.Mesh(new THREE.CylinderGeometry(1,1,1.2,24,1,true),new THREE.MeshBasicMaterial({color:0xffd23f,transparent:true,opacity:0.35,side:THREE.DoubleSide,depthWrite:false})); cyl.position.y=0.6; g.add(cyl); const beam=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.3,60,8,1,true),new THREE.MeshBasicMaterial({color:0xffd23f,transparent:true,opacity:0.18,depthWrite:false})); beam.position.y=30; g.add(beam); g.visible=false; this.scene.add(g); this.markerMeshes.push({g,cyl,beam}); }
    this.headlights=[]; for(let i=0;i<2;i++){ const l=new THREE.SpotLight(0xfff1cc,0,60,0.42,0.6,1.2); l.visible=false; this.scene.add(l); this.scene.add(l.target); this.headlights.push(l); }
    this.frustum=new THREE.Frustum(); this.projM=new THREE.Matrix4();
    this.resize(); window.addEventListener('resize',()=>this.resize());
    this.bindInput();
    this.last=performance.now(); if(!opts.noLoop) requestAnimationFrame(t=>this.loop(t));
  }
  resize(){ const w=window.innerWidth, h=window.innerHeight; this.renderer.setSize(w,h,false); this.camera.aspect=w/h; this.camera.updateProjectionMatrix(); }
  // ---------------- setup ----------------
  titleItems(){ return [{label:'NEW GAME'},{label:'CONTINUE',disabled:!this.hasSave},{label:'CONTROLS'}]; }
  initWorldEntities(){
    const W=this.world;
    for(const s of W.parkSpots){ if(Math.random()<0.5){ const kind=s.kind==='dealer'?pick(['sports','sports','muscle']):s.kind==='docks'?pick(['van','truck']):s.kind==='garage'?pick(['sports','sedan','muscle']):s.kind==='compound'?'muscle':pick(['sedan','compact','muscle','van','sports']); const v=this.spawnVehicle(kind,s.x,s.z,s.angle); v.parked=true; v.body.sleep(); } }
    const pol=W.loc('police'); for(let i=0;i<2;i++){ const v=this.spawnVehicle('police',pol.x-16+i*7,pol.z,Math.PI/2); v.parked=true; }
    for(const sp of W.staticPickups) this.spawnPickup(sp.x,sp.z,sp.type,{weapon:sp.weapon,respawn:120,ammo:sp.weapon==='shotgun'?8:sp.weapon==='smg'?30:sp.weapon==='pistol'?17:0});
    for(const p of W.packages){ if(!this.progress.packages.includes(p.idx)) this.spawnPickup(p.x,p.z,'package',{pkgIdx:p.idx}); }
  }
  newGame(){
    this.progress={missionIdx:0,packages:[]}; this.stats={kills:0,vehiclesDestroyed:0,missionsPassed:0,fares:0,criminals:0,cash:0};
    this.resetWorldState(); this.clock=9.5;
    const s=this.world.loc('safehouse'); this.player=this.makePlayer(s.x+7,s.z+3); this.player.money=250;
    this.initWorldEntities(); this.cam.yaw=this.player.angle=-Math.PI/2; this.state='play'; this.snapCamera();
    this.showDialog([{who:'Lucia',text:"Welcome to Leonida, kid. This is my place; you can crash here. The marker out front is me, come talk when you want work."},{who:'Phone',text:"Tip: WASD to move, mouse to look, right mouse to aim, E to jack a car. Shops and jobs are on the map (M). Try not to get WASTED."}]);
  }
  resetWorldState(){ for(const v of this.vehicles) v.dispose(this); for(const p of this.peds) p.dispose(this); for(const p of this.pickups) p.dispose(this); for(const r of this.rockets) this.scene.remove(r.mesh); if(this.heli){ this.scene.remove(this.heli.mesh); } this.vehicles=[]; this.peds=[]; this.rockets=[]; this.pickups=[]; this.floatTexts=[]; this.notifications=[]; this.heli=null; this.busted=false; this.big=null; this.menu=null; this.dialog=null; this.godMode=false; this.credits=0; this.time=0; this.radioAuto=false; const M=this.missions; M.current=null; M.marker=null; M.entBlips=[]; M.entities=[]; M.timer=null; M.objective=''; M.side=null; M.sideData={}; M.failCd=0; }
  makePlayer(x,z){ const P=new Ped(x,z,'player',{},this); P.isPlayer=true; this.peds.push(P); P.state='idle'; P.money=0; P.heat=0; P.wanted=0; P.weapons={fist:{ammo:Infinity}}; P.curWeapon='fist'; P.shootCd=0; P.r=0.35; P.walkSpeed=2.6; P.runSpeed=6.5; P.fearless=true; P.noCrime=true; return P; }
  save(){ const P=this.player; const w={}; for(const k in P.weapons) w[k]=isFinite(P.weapons[k].ammo)?P.weapons[k].ammo:-1; const data={missionIdx:this.progress.missionIdx,packages:this.progress.packages,money:P.money,weapons:w,curWeapon:P.curWeapon,stats:this.stats,hp:P.hp,armor:P.armor,clock:this.clock}; try{ localStorage.setItem('leonida3d_save',JSON.stringify(data)); this.hasSave=true; this.notify('Game saved','#5fd97a'); }catch(e){ this.notify('Save failed','#ff5050'); } }
  continueGame(){ let d=null; try{ d=JSON.parse(localStorage.getItem('leonida3d_save')); }catch(e){} if(!d){ this.newGame(); return; }
    this.progress={missionIdx:d.missionIdx||0,packages:d.packages||[]}; this.stats=Object.assign({kills:0,vehiclesDestroyed:0,missionsPassed:0,fares:0,criminals:0,cash:0},d.stats||{});
    this.resetWorldState(); this.clock=d.clock||9;
    const s=this.world.loc('safehouse'); const P=this.player=this.makePlayer(s.x+7,s.z+3); P.money=d.money||0; P.hp=d.hp||100; P.armor=d.armor||0;
    for(const k in d.weapons) P.weapons[k]={ammo:d.weapons[k]<0?Infinity:d.weapons[k]}; P.curWeapon=d.curWeapon&&P.weapons[d.curWeapon]?d.curWeapon:'fist'; P.weapon=WEAPONS[P.curWeapon].melee&&P.curWeapon==='fist'?null:P.curWeapon; P.setWeaponMesh();
    this.initWorldEntities(); this.cam.yaw=P.angle=-Math.PI/2; this.state='play'; this.snapCamera(); this.notify('Game loaded','#5fd97a'); }
  // ---------------- input ----------------
  bindInput(){
    const c=this.canvas, I=this.input;
    window.addEventListener('keydown',e=>{ if(['Tab','F5',' '].includes(e.key)||e.key.startsWith('Arrow')) e.preventDefault(); if(e.repeat) return; I.keys.add(e.code); this.onKey(e); });
    window.addEventListener('keyup',e=>I.keys.delete(e.code));
    window.addEventListener('blur',()=>{ I.keys.clear(); I.mouseDown=false; I.rmb=false; });
    document.addEventListener('mousemove',e=>{ I.mx=e.clientX; I.my=e.clientY; if(this.state==='play'&&!this.menu&&!this.dialog&&(document.pointerLockElement===c||this.test)){ const s=0.0022; this.cam.yaw+=e.movementX*s; this.cam.pitch=clamp(this.cam.pitch+e.movementY*s,-0.35,1.1); if(Math.abs(e.movementX)+Math.abs(e.movementY)>0) this.cam.mouseT=0; } });
    c.addEventListener('mousedown',e=>{ this.audio.init(); this.audio.resume(); if(e.button===2){ I.rmb=true; return; } if(e.button!==0) return; if(this.state==='play'&&!this.menu&&!this.dialog){ if(document.pointerLockElement!==c&&!this.test){ try{ c.requestPointerLock(); }catch(err){} } I.mouseDown=true; I.justDown=true; } else if(this.dialog) this.advanceDialog(); });
    window.addEventListener('mouseup',e=>{ if(e.button===0) I.mouseDown=false; if(e.button===2) I.rmb=false; });
    c.addEventListener('contextmenu',e=>e.preventDefault());
    c.addEventListener('wheel',e=>{ if(this.state==='play'&&!this.menu&&!this.dialog) this.cycleWeapon(e.deltaY>0?1:-1); e.preventDefault(); },{passive:false});
    document.addEventListener('pointerlockchange',()=>{ if(document.pointerLockElement!==c&&this.state==='play'&&!this.menu&&!this.dialog&&this.hadLock){ this.openPause(); } this.hadLock=document.pointerLockElement===c; });
  }
  titleSelect(){ const it=this.titleItems()[this.titleSel]; if(it.disabled) return; this.audio.init(); this.audio.resume(); this.audio.click(); if(this.titleSel===0) this.newGame(); else if(this.titleSel===1) this.continueGame(); else { this.prevState='title'; this.state='controls'; } }
  closeControls(){ this.state=this.prevState==='title'?'title':'play'; if(this.state==='play') this.openPause(); }
  onKey(e){
    const k=e.code;
    if(this.state==='title'){ const n=this.titleItems().length; if(k==='ArrowUp'||k==='KeyW') this.titleSel=(this.titleSel+n-1)%n; if(k==='ArrowDown'||k==='KeyS') this.titleSel=(this.titleSel+1)%n; if(k==='Enter'||k==='Space'){ this.audio.init(); this.titleSelect(); } return; }
    if(this.state==='controls'){ if(k==='Escape'||k==='Enter') this.closeControls(); return; }
    if(this.dialog){ if(k==='Enter'||k==='Space'||k==='KeyE') this.advanceDialog(); return; }
    if(this.menu){ const n=this.menu.items.length; if(k==='ArrowUp'||k==='KeyW'){ this.menu.sel=(this.menu.sel+n-1)%n; this.audio.click(); } if(k==='ArrowDown'||k==='KeyS'){ this.menu.sel=(this.menu.sel+1)%n; this.audio.click(); } if(k==='Enter'||k==='Space') this.menuSelect(); if(k==='Escape'){ const m=this.menu; this.menu=null; if(m.onClose) m.onClose(); } return; }
    if(this.state==='map'){ if(k==='KeyM'||k==='Tab'||k==='Escape') this.state='play'; return; }
    if(this.state!=='play') return;
    switch(k){
      case 'Escape': this.openPause(); break;
      case 'KeyM': case 'Tab': this.state='map'; break;
      case 'KeyE': case 'KeyF': this.interact(); break;
      case 'KeyR': if(this.player.vehicle){ const s=this.audio.nextStation(); this.notify('♪ '+s,'#ffb0e0'); } break;
      case 'KeyT': this.trySideJob(); break;
      case 'KeyC': this.cam.mode=(this.cam.mode+1)%3; break;
      case 'F5': this.save(); break;
      case 'Backquote': this.godMode=!this.godMode; this.notify('God mode '+(this.godMode?'ON':'OFF')); break;
      default: if(k.startsWith('Digit')){ const n=parseInt(k.slice(5))-1; const key=WEAPON_ORDER[n]; if(key&&this.player.weapons[key]){ this.setWeapon(key); this.audio.click(); } }
    }
  }
  setWeapon(key){ const P=this.player; P.curWeapon=key; P.weapon=key==='fist'?null:key; P.setWeaponMesh(); }
  cycleWeapon(dir){ const P=this.player; const owned=WEAPON_ORDER.filter(k=>P.weapons[k]); let i=owned.indexOf(P.curWeapon); i=(i+dir+owned.length)%owned.length; this.setWeapon(owned[i]); this.audio.click(); }
  openPause(){ const G=this; if(document.pointerLockElement) document.exitPointerLock(); this.menu={title:'PAUSED',sel:0,items:[{label:'Resume'},{label:'Controls'},{label:'Radio: '+this.audio.stations[this.audio.radio.station]},{label:'Volume: '+Math.round(this.audio.volume*100)+'%'},{label:'Save Game'},{label:'Quit to Title'}],
      onSelect(i){ if(i===0) G.menu=null; else if(i===1){ G.menu=null; G.prevState='play'; G.state='controls'; } else if(i===2){ G.audio.nextStation(); G.menu.items[2].label='Radio: '+G.audio.stations[G.audio.radio.station]; } else if(i===3){ G.audio.setVolume((Math.round(G.audio.volume*10)+2)%12/10); G.menu.items[3].label='Volume: '+Math.round(G.audio.volume*100)+'%'; } else if(i===4){ G.save(); G.menu=null; } else { G.menu=null; G.state='title'; } },
      footer:`Kills ${this.stats.kills}  ·  Vehicles wrecked ${this.stats.vehiclesDestroyed}  ·  Missions ${this.progress.missionIdx}/${MISSIONS.length}  ·  Packages ${this.progress.packages.length}/15`}; }
  menuSelect(){ const m=this.menu; const it=m.items[m.sel]; if(it.disabled){ this.audio.click(); return; } this.audio.click(); m.onSelect(m.sel); }
  showDialog(lines,onDone){ this.dialog={lines,idx:0,charT:0,onDone}; this.input.mouseDown=false; }
  advanceDialog(){ const d=this.dialog; const line=d.lines[d.idx]; if(d.charT*45<line.text.length){ d.charT=99; return; } d.idx++; d.charT=0; if(d.idx>=d.lines.length){ this.dialog=null; if(d.onDone) d.onDone(); } this.audio.click(); }
  // ---------------- helpers ----------------
  notify(text,color){ this.notifications.push({text,color:color||'#fff',t:4}); if(this.notifications.length>4) this.notifications.shift(); }
  floatText(x,y,z,text,color){ this.floatTexts.push({x,y,z,text,color:color||'#fff',t:1.5}); }
  shake(a){ this.shakeAmt=Math.max(this.shakeAmt,a); this.shakeT=0.3; }
  inView(x,z,pad=0){ if(dist(x,z,this.cam.x,this.cam.z)<pad) return true; return this.frustum.containsPoint(new THREE.Vector3(x,1,z)); }
  spawnVehicle(kind,x,z,angle,color){ const v=new Vehicle(kind,x,z,angle,color,this); this.vehicles.push(v); return v; }
  spawnPed(x,z,kind,opts){ const p=new Ped(x,z,kind,opts||{},this); this.peds.push(p); return p; }
  spawnPickup(x,z,type,opts){ const p=new Pickup(x,z,type,opts||{},this); this.pickups.push(p); return p; }
  giveWeapon(key,ammo){ const P=this.player; const W=WEAPONS[key]; if(!P.weapons[key]) P.weapons[key]={ammo:W.melee?Infinity:0}; if(!W.melee) P.weapons[key].ammo+=ammo||W.clip; if(P.curWeapon==='fist'||P.curWeapon==='bat'||key===P.curWeapon) this.setWeapon(key); }
  markers(){ const out=this.missions.markers(); for(const l of this.world.locations){ if(l.type==='ammu') out.push({x:l.x,z:l.z,r:2.5,color:'#e0e0e0'}); else if(l.type==='spray') out.push({x:l.x,z:l.z,r:l.r,color:'#f0a050'}); else if(l.type==='hospital') out.push({x:l.x,z:l.z,r:2.5,color:'#ff7070'}); else if(l.type==='safehouse'&&(this.missions.current||!this.missions.available||this.missions.available.at!=='safehouse')) out.push({x:l.x,z:l.z,r:2.5,color:'#5fd97a'}); } return out; }
  blips(full){ const out=[]; const L={safehouse:['L','#ffd23f'],club:['R','#ffd23f'],docks:['T','#ffd23f'],ammu:['A','#e0e0e0'],spray:['S','#f0a050'],hospital:['H','#ff7070'],police:['P','#7090ff'],bank:['$','#5fd97a'],dealer:['C','#c0f0ff']};
    for(const l of this.world.locations){ const e=L[l.type]; if(!e) continue; out.push({x:l.x,z:l.z,color:e[1],shape:'sq',txt:e[0]}); }
    for(const b of this.missions.blips()) out.push(b); for(const b of this.missions.sideBlips()) out.push(b);
    if(this.player.wanted>0){ for(const p of this.peds){ if((p.kind==='cop'||p.kind==='swat')&&!p.dead&&!p.vehicle) out.push({x:p.x,z:p.z,color:'#4a7fd0',r:3}); } for(const v of this.vehicles){ if(v.isPolice&&!v.wrecked&&v.driver) out.push({x:v.x,z:v.z,color:'#4a7fd0',r:4}); } if(this.heli&&!this.heli.removed) out.push({x:this.heli.x,z:this.heli.z,color:'#4a7fd0',r:5}); }
    return out; }
  // ---------------- crime / police ----------------
  addCrime(n){ const P=this.player; if(P.dead) return; const before=P.wanted; P.heat=Math.min(20,P.heat+n); this.lastCrimeT=this.time; this.updateWanted(); if(P.wanted>before){ this.audio.wanted(); if(P.wanted===1) this.notify('The cops are after you!','#ffd23f'); if(P.wanted>=4) this.notify('Heavy police response incoming!','#ff5050'); } }
  updateWanted(){ const P=this.player; let w=0; for(const t of WANTED_THRESHOLDS) if(P.heat>=t) w++; P.wanted=w; }
  onKill(ped,src){ const byPlayer=src&&(src.isPlayer||(src.driver&&src.driver.isPlayer)||(src.owner&&src.owner.isPlayer));
    if(!ped.noCrime&&ped.kind!=='target'&&ped.kind!=='boss'){ const amt=rnd(5,40)*(ped.kind==='gang'?3:1); this.spawnPickup(ped.x+rnd(-1,1),ped.z+rnd(-1,1),'cash',{amount:Math.round(amt),expire:this.time+40}); }
    if(ped.weapon&&!WEAPONS[ped.weapon].melee&&Math.random()<0.4) this.spawnPickup(ped.x+rnd(-1.5,1.5),ped.z+rnd(-1.5,1.5),'weapon',{weapon:ped.weapon,ammo:Math.ceil(WEAPONS[ped.weapon].clip*0.5),expire:this.time+40});
    if(byPlayer){ this.stats.kills++; if(!ped.noCrime){ if(ped.kind==='cop') this.addCrime(3); else if(ped.kind==='swat') this.addCrime(2); else if(ped.kind==='civ') this.addCrime(1); else if(ped.kind==='gang') this.addCrime(0.3); } }
  }
  bust(){ const P=this.player; if(P.dead||this.busted||this.godMode) return; this.busted=true; this.deathT=0; this.big={text:'BUSTED',color:'#7090ff',t:4}; this.audio.fail(); if(P.vehicle){ P.vehicle.removeOccupant(P,this); } P.state='knocked'; P.knockT=3.5; P.vx=P.vz=0; P.vy=0; P.airborne=false; }
  onPlayerDeath(){ this.big={text:'WASTED',color:'#ff5050',t:4}; this.audio.fail(); this.deathT=0; this.input.mouseDown=false; }
  respawn(atPolice){ const P=this.player; const l=this.world.loc(atPolice?'police':'hospital'); P.x=l.x; P.z=l.z+5; P.y=this.world.heightAt(P.x,P.z); P.dead=false; P.state='idle'; P.hp=P.maxHp; if(!atPolice) P.armor=0; P.heat=0; P.wanted=0; P.vx=P.vz=0; P.knockT=0; P.deadT=0; P.vehicle=null; this.busted=false; const loss=atPolice?Math.min(500,P.money):Math.floor(P.money*0.1); P.money-=loss; if(loss>0) this.notify(`Lost ${fmtMoney(loss)}`,'#ff7070'); this.cam.yaw=P.angle=Math.PI/2; this.snapCamera(); if(this.heli){ this.heli.removed=true; this.scene.remove(this.heli.mesh); this.heli=null; } for(const p of this.peds){ if(p.kind==='cop'||p.kind==='swat'){ p.state='wander'; p.target=null; } } for(const v of this.vehicles){ if(v.isPolice&&v.ai&&v.ai.mode==='police'){ v.ai={mode:'traffic',speedMul:1}; v.aiPickEdge(this); v.siren=false; } } }
  // ---------------- interaction ----------------
  interact(){
    const P=this.player; if(P.dead||this.busted) return;
    if(P.vehicle){ const v=P.vehicle; if(Math.abs(v.speed)>12){ this.hint='Slow down to get out'; this.hintT=1.5; return; } v.removeOccupant(P,this); P.state='idle'; this.audio.door(); this.detachHeadlights(); return; }
    for(const l of this.world.locations){ if(dist(P.x,P.z,l.x,l.z)>l.r) continue;
      if(l.type==='ammu'){ this.openShop(); return; }
      if(l.type==='hospital'){ if(P.hp>=P.maxHp){ this.notify('You are already healthy'); } else if(P.money>=100){ P.money-=100; P.hp=P.maxHp; this.audio.pickup(); this.notify('Healed (-$100)','#5fd97a'); } else this.notify('Not enough cash ($100)','#ff7070'); return; }
      if(l.type==='safehouse'&&!(this.missions.available&&this.missions.available.at==='safehouse'&&!this.missions.current)){ this.save(); P.hp=P.maxHp; this.clock=8; this.notify('You slept until morning','#ffd23f'); return; }
    }
    let best=null,bd=1e9; for(const v of this.vehicles){ if(v.wrecked||v.removed) continue; const lp=v.localPoint(P.x,P.z); const dx=Math.max(0,Math.abs(lp.x)-v.l/2), dz=Math.max(0,Math.abs(lp.z)-v.w/2); const d=Math.hypot(dx,dz); if(d<2.6&&d<bd){ bd=d; best=v; } }
    if(!best) return; const v=best; if(v.upY<0.3){ this.hint='This vehicle is upside down'; this.hintT=2; return; }
    if(v.driver&&!v.driver.isPlayer){ const d=v.driver; const wasCop=d.kind==='cop'||d.kind==='swat'; for(const o of v.occupants.slice()){ v.removeOccupant(o,this); if(o.kind==='cop'||o.kind==='swat'){ o.state='attack'; o.target=P; } else { o.knock((o.x-v.x)*2,(o.z-v.z)*2,1.5,0,P,this); o.knockT=1.5; } } this.addCrime(wasCop?2.5:(this.copNearby(38)?1:0.5)); this.notify('Carjacked a '+v.name,'#ffd23f'); }
    else { for(const o of v.occupants.slice()) v.removeOccupant(o,this); }
    v.ai=null; v.parked=false; v.addOccupant(P,true); P.state='driver'; this.vehicleName=v.name; this.vehicleNameT=3; this.audio.door(); this.attachHeadlights(v);
    if(v.stats.taxi){ this.hint='Press T to start a Taxi job'; this.hintT=4; } if(v.isPolice){ this.hint='Press T to start Vigilante duty'; this.hintT=4; }
    if(this.audio.radio.station===0&&!this.radioAuto){ this.radioAuto=true; this.audio.radio.station=1; if(this.audio.ctx) this.audio.radio.nextNote=this.audio.ctx.currentTime+0.1; }
  }
  attachHeadlights(v){ const s=v.stats; for(let i=0;i<2;i++){ const l=this.headlights[i]; v.inner.add(l); v.inner.add(l.target); l.position.set(s.L/2,0.7,(i?1:-1)*(s.W/2-0.3)); l.target.position.set(s.L/2+20,0.1,(i?1:-1)*(s.W/2-0.3)+ (i?1:-1)*1.5); l.visible=true; } }
  detachHeadlights(){ for(const l of this.headlights){ if(l.parent) l.parent.remove(l); if(l.target.parent) l.target.parent.remove(l.target); l.visible=false; this.scene.add(l); this.scene.add(l.target); } }
  copNearby(r){ return this.peds.some(p=>(p.kind==='cop'||p.kind==='swat')&&!p.dead&&dist(p.x,p.z,this.player.x,this.player.z)<r) || this.vehicles.some(v=>v.isPolice&&v.driver&&!v.driver.isPlayer&&dist(v.x,v.z,this.player.x,this.player.z)<r); }
  trySideJob(){ const P=this.player; const M=this.missions; if(M.side){ M.endSide(); return; } if(!P.vehicle) return; if(P.vehicle.stats.taxi) M.startSide('taxi'); else if(P.vehicle.isPolice) M.startSide('vigilante'); else this.notify('Get a taxi or police car for side jobs'); }
  openShop(){ const G=this,P=this.player; const items=[]; for(const k of ['bat','pistol','smg','shotgun','rifle','rocket']){ const W=WEAPONS[k]; if(!P.weapons[k]) items.push({label:W.name,right:fmtMoney(W.price),key:k,buy:'weapon'}); else if(!W.melee) items.push({label:W.name+' ammo (+'+W.clip+')',right:fmtMoney(W.ammoPrice),key:k,buy:'ammo'}); }
    items.push({label:'Body Armor',right:fmtMoney(300),buy:'armor'}); items.push({label:'Leave'}); if(document.pointerLockElement) document.exitPointerLock();
    this.menu={title:'AMMU-NATION',sel:0,items,footer:'Cash: '+fmtMoney(P.money),onSelect(i){ const it=items[i]; if(!it.buy){ G.menu=null; return; } const price=it.buy==='armor'?300:it.buy==='weapon'?WEAPONS[it.key].price:WEAPONS[it.key].ammoPrice; if(P.money<price){ G.notify('Not enough cash','#ff7070'); return; } P.money-=price; G.audio.cash(); if(it.buy==='armor') P.armor=100; else if(it.buy==='weapon'){ G.giveWeapon(it.key,WEAPONS[it.key].clip); G.notify('Bought '+WEAPONS[it.key].name,'#5fd97a'); } else { P.weapons[it.key].ammo+=WEAPONS[it.key].clip; } G.openShop(); G.menu.sel=Math.min(i,G.menu.items.length-1); }}; }
  // ---------------- weapons ----------------
  // ray against buildings/ground, vehicles, peds, heli. Returns {t, kind, obj, x,y,z}
  raycastAll(o,d,maxT,owner){
    let bt=this.world.raycastBuildings(o.x,o.y,o.z,d.x,d.y,d.z,maxT); let best=bt<maxT?{t:bt,kind:'world',obj:null}:null; let lim=best?best.t:maxT;
    const ownerVeh=owner&&owner.vehicle;
    for(const v of this.vehicles){ if(v.removed||v===ownerVeh||v===owner) continue; if(Math.abs(v.x-o.x)>lim+8&&Math.abs(v.z-o.z)>lim+8) continue; const t=v.rayHit(o,d,lim); if(t>=0&&t<lim){ lim=t; best={t,kind:'vehicle',obj:v}; } }
    for(const p of this.peds){ if(p.dead||p===owner||p.vehicle||p.removed) continue; const cx=p.x-o.x, cz=p.z-o.z; const dl=Math.hypot(d.x,d.z)||1e-6; const tt=(cx*d.x+cz*d.z)/(dl*dl); if(tt<0||tt>lim) continue; const px=o.x+d.x*tt-p.x, pz=o.z+d.z*tt-p.z; const r2=px*px+pz*pz; const rad=p.state==='knocked'||p.dead?0.6:0.42; if(r2>rad*rad) continue; const y=o.y+d.y*tt; const lo=p.y+(p.state==='knocked'?0:0.1), hi=p.y+(p.state==='knocked'?0.8:1.85); if(y<lo||y>hi) continue; lim=tt; best={t:tt,kind:'ped',obj:p}; }
    if(this.heli&&!this.heli.dead&&owner!==this.heli){ const t=this.heli.rayHit(o,d,lim); if(t>=0){ lim=t; best={t,kind:'heli',obj:this.heli}; } }
    if(best){ best.x=o.x+d.x*best.t; best.y=o.y+d.y*best.t; best.z=o.z+d.z*best.t; } return best;
  }
  fireBullet(owner,origin,target,wkey,spread){
    const W=WEAPONS[wkey]; const n=W.pellets||1; let dx=target.x-origin.x, dy=target.y-origin.y, dz=target.z-origin.z; const L=Math.hypot(dx,dy,dz)||1; dx/=L; dy/=L; dz/=L;
    const sp=spread!==undefined?spread:W.spread; const isP=owner&&owner.isPlayer;
    const d=dist(origin.x,origin.z,this.player.x,this.player.z); if(d<140) this.audio.shoot(wkey,clamp(1-d/140,0.15,1));
    this.fx.flash(origin.x+dx*0.6,origin.y,origin.z+dz*0.6,W.rocket?6:2.5,0xffc060,0.06);
    for(let i=0;i<n;i++){
      // perturb direction
      const ax=rnd(-1,1)*sp, ay=rnd(-1,1)*sp; const ux=-dz, uz=dx; const ul=Math.hypot(ux,uz)||1; let ddx=dx+ux/ul*ax, ddy=dy+ay, ddz=dz+uz/ul*ax; const dl=Math.hypot(ddx,ddy,ddz); ddx/=dl; ddy/=dl; ddz/=dl;
      if(W.rocket){ this.rockets.push(new Rocket(owner,{x:origin.x+ddx*0.8,y:origin.y,z:origin.z+ddz*0.8},{x:ddx,y:ddy,z:ddz},this)); continue; }
      const maxT=W.maxRange||160; const hit=this.raycastAll(origin,{x:ddx,y:ddy,z:ddz},maxT,owner);
      const ex=hit?hit.x:origin.x+ddx*maxT, ey=hit?hit.y:origin.y+ddy*maxT, ez=hit?hit.z:origin.z+ddz*maxT;
      this.fx.tracer(origin.x+ddx*0.8,origin.y,origin.z+ddz*0.8,ex,ey,ez);
      if(!hit) continue;
      if(hit.kind==='world'){ this.fx.spark(ex,ey,ez); this.fx.spark(ex,ey,ez); this.fx.dust(ex,ey,ez); }
      else if(hit.kind==='ped'){ const p=hit.obj; for(let k=0;k<3;k++) this.fx.blood(ex,ey,ez); p.damage(W.dmg,owner,this,'bullet'); if(isP) this.hitMarker=0.1; }
      else if(hit.kind==='vehicle'){ const v=hit.obj; this.fx.spark(ex,ey,ez); v.damage(W.dmg*0.6,owner,this); v.body.wakeUp(); if(v.driver&&!v.driver.isPlayer&&Math.random()<0.25) v.driver.damage(W.dmg,owner,this,'bullet'); if(v.driver&&!v.driver.isPlayer&&v.ai&&v.ai.mode==='traffic'){ v.ai.speedMul=2; v.ai.reckless=true; v.ai.panic=true; } if(v.driver&&v.driver.isPlayer&&owner&&!owner.isPlayer&&Math.random()<0.35) v.driver.damage(W.dmg*0.5,owner,this,'bullet'); }
      else if(hit.kind==='heli'){ this.fx.spark(ex,ey,ez); this.heli.damage(W.dmg,owner,this); }
    }
    if(isP){ this.lastShot={x:origin.x,z:origin.z,t:this.time}; if(this.gunshotHeatCd<=0&&this.copNearby(35)){ this.gunshotHeatCd=4; this.addCrime(1); } }
    else if(owner&&!owner.isHeli){ if(d<50) this.lastShot={x:origin.x,z:origin.z,t:this.time}; }
  }
  aimPoint(){ // where the crosshair (screen centre) points in the world
    const o=this.camera.position; const d=new THREE.Vector3(0,0,-1).applyQuaternion(this.camera.quaternion); const P=this.player; const skip=P.vehicle||P;
    const hit=this.raycastAll({x:o.x,y:o.y,z:o.z},{x:d.x,y:d.y,z:d.z},200,P); if(hit&&hit.t>this.cam.dist+0.5) return {x:hit.x,y:hit.y,z:hit.z}; return {x:o.x+d.x*150,y:o.y+d.y*150,z:o.z+d.z*150}; }
  playerAttack(dt){
    const P=this.player, I=this.input; const key=P.curWeapon, W=WEAPONS[key]; const wp=P.weapons[key];
    if(P.shootCd>0){ I.justDown=false; return; } if(!I.mouseDown){ I.justDown=false; return; } if(!W.auto&&!I.justDown) return;
    I.justDown=false;
    if(P.vehicle){ if(!W.driveby){ this.hint='Only pistol, Uzi and rifle can be used from a vehicle'; this.hintT=1.5; return; } }
    const aim=this.aimPoint(); const aimAng=angTo(P.x,P.z,aim.x,aim.z); if(!P.vehicle) P.angle=aimAng;
    if(W.melee){
      P.shootCd=W.rate; P.punchT=0.25; this.audio.punch(); let hit=false;
      for(const p of this.peds){ if(p.dead||p===P||p.vehicle) continue; const d=dist(P.x,P.z,p.x,p.z); if(d<W.range+p.r&&Math.abs(wrapAng(angTo(P.x,P.z,p.x,p.z)-P.angle))<1.1){ p.damage(W.dmg,P,this,'melee'); p.vx+=Math.cos(P.angle)*4; p.vz+=Math.sin(P.angle)*4; hit=true; for(let i=0;i<3;i++) this.fx.blood(p.x,p.y+1.2,p.z); } }
      if(!hit&&key==='bat'){ const hx=P.x+Math.cos(P.angle)*W.range, hz=P.z+Math.sin(P.angle)*W.range; for(const v of this.vehicles){ if(!v.wrecked&&v.containsPoint(hx,hz,0.5)){ v.damage(9,P,this); v.body.wakeUp(); v.body.applyImpulse(new CANNON.Vec3(Math.cos(P.angle)*900,300,Math.sin(P.angle)*900),new CANNON.Vec3(hx-v.x,0.3,hz-v.z)); for(let i=0;i<4;i++) this.fx.spark(hx,P.y+0.8,hz); this.audio.crash(0.3); if(v.driver&&!v.driver.isPlayer&&v.ai&&v.ai.mode==='traffic'){ v.ai.speedMul=2; v.ai.reckless=true; } break; } } }
      return;
    }
    if(wp.ammo<=0){ P.shootCd=0.3; this.audio.click(); this.hint='Out of ammo! Buy more at Ammu-Nation'; this.hintT=2; return; }
    wp.ammo--; P.shootCd=W.rate;
    const ox=P.vehicle?P.vehicle.x+Math.cos(P.vehicle.angle)*0.3:P.x+Math.cos(P.angle)*0.4, oz=P.vehicle?P.vehicle.z+Math.sin(P.vehicle.angle)*0.3:P.z+Math.sin(P.angle)*0.4, oy=P.vehicle?P.vehicle.y+0.6:P.y+1.35;
    this.fireBullet(P,{x:ox,y:oy,z:oz},aim,key);
    if(wp.ammo<=0&&key!=='rocket'){ this.hint='Out of ammo!'; this.hintT=2; }
  }
  explosionFx(x,y,z,r){ for(let i=0;i<24;i++) this.fx.fire(x+rnd(-r*0.3,r*0.3),y+rnd(0,r*0.3),z+rnd(-r*0.3,r*0.3)); for(let i=0;i<16;i++) this.fx.smoke(x+rnd(-r*0.25,r*0.25),y+rnd(0,r*0.4),z+rnd(-r*0.25,r*0.25),{big:true,dark:true}); for(let i=0;i<14;i++) this.fx.debris(x,y+0.5,z); this.fx.boom(x,y+1,z,r*0.28); this.fx.flash(x,y+2,z,28,0xffa040,0.35); const d=dist(x,z,this.player.x,this.player.z); this.audio.explosion(clamp(1-d/200,0.2,1)); this.shake(clamp(12-d/8,2,12)); }
  explosion(x,y,z,r,src,srcVehicle){
    this.explosionFx(x,y,z,r); this.fx.decal('scorch',x,this.world.heightAt(x,z),z,r*0.45); this.lastExplosion={x,z,t:this.time};
    for(const p of this.peds){ if(p.dead||p.vehicle) continue; const d=dist(x,z,p.x,p.z); if(d<r){ const f=1-d/r; p.damage(30+110*f,src,this,'explosion'); if(!p.dead&&!p.isPlayer){ p.knock((p.x-x)/(d||1)*10*f,(p.z-z)/(d||1)*10*f,4+6*f,0,src,this); } } }
    for(const v of this.vehicles){ if(v===srcVehicle||v.removed) continue; const d=dist(x,z,v.x,v.z); const rr=r*1.3; if(d<rr){ const f=1-d/rr; v.body.wakeUp(); const m=v.stats.mass; v.body.applyImpulse(new CANNON.Vec3((v.x-x)/(d||1)*m*5*f,m*(4+3*f),(v.z-z)/(d||1)*m*5*f),new CANNON.Vec3(rnd(-1,1),0,rnd(-1,1))); v.damage(25+75*f,src,this); } }
    if(this.heli&&!this.heli.dead&&dist(x,z,this.heli.x,this.heli.z)<r*0.8&&Math.abs(this.heli.y-y)<10) this.heli.damage(60,src,this);
  }
  // ---------------- main loop ----------------
  loop(ts){ const dt=Math.min(0.05,(ts-this.last)/1000); this.last=ts; this.realTime+=dt; this.fps=lerp(this.fps,1/Math.max(dt,1e-3),0.05);
    if(this.state==='play'&&!this.menu&&!this.dialog) this.update(dt);
    if(this.dialog) this.dialog.charT+=dt;
    this.render(dt);
    requestAnimationFrame(t=>this.loop(t)); }
  simulate(seconds,step=1/60){ const n=Math.round(seconds/step); for(let i=0;i<n;i++){ if(this.state==='play'&&!this.menu&&!this.dialog) this.update(step); if(this.dialog) this.dialog.charT+=step; this.realTime+=step; } this.updateCamera(0.1,true); }
  render(dt){
    if(this.state!=='title'&&this.player){ this.updateCamera(dt); const P=this.player; this.city.update(this.clock,this.camera.position,new THREE.Vector3(P.x,P.y,P.z)); this.updateMarkers(); this.projM.multiplyMatrices(this.camera.projectionMatrix,this.camera.matrixWorldInverse); this.frustum.setFromProjectionMatrix(this.projM);
      const night=this.city.lampGlow; for(const l of this.headlights) l.intensity=night*260;
      for(const v of this.vehicles){ v.mesh.visible=dist(v.x,v.z,this.cam.x,this.cam.z)<300; }
      this.renderer.render(this.scene,this.camera); }
    this.ui.update(dt);
  }
  updateMarkers(){ const ms=this.markers(); for(let i=0;i<this.markerMeshes.length;i++){ const mm=this.markerMeshes[i]; const m=ms[i]; if(!m){ mm.g.visible=false; continue; } mm.g.visible=true; const y=this.world.heightAt(m.x,m.z); mm.g.position.set(m.x,y,m.z); mm.g.scale.set(m.r,1,m.r); mm.cyl.material.color.set(m.color); mm.beam.material.color.set(m.color); mm.beam.scale.set(1/m.r,1,1/m.r); mm.cyl.material.opacity=0.28+Math.sin(this.time*3)*0.08; } }
  snapCamera(){ this.updateCamera(1,true); }
  updateCamera(dt,snap){
    if(this.freeCam){ const f=this.freeCam; this.camera.position.set(f.x,f.y,f.z); this.camera.lookAt(f.tx,f.ty,f.tz); this.camera.updateProjectionMatrix(); this.camX=f.x; this.camZ=f.z; this.cam.x=f.x; this.cam.y=f.y; this.cam.z=f.z; return; }
    const P=this.player, C=this.cam, v=P.vehicle; let tx,ty,tz,dist0,pitch;
    C.mouseT+=dt;
    if(v){ tx=v.x; ty=v.y+0.9; tz=v.z; dist0=[5.5+v.stats.L*0.9,3.5+v.stats.L*0.6,9+v.stats.L][C.mode]; pitch=[0.3,0.2,0.5][C.mode];
      if(C.mouseT>2.5){ const targetYaw=v.speed<-1?v.angle+Math.PI:v.angle; C.yaw+=wrapAng(targetYaw-C.yaw)*Math.min(1,dt*(snap?100:3)); C.pitch=damp(C.pitch,pitch,2,dt); }
      const sp=clamp(Math.abs(v.speed)/40,0,1); this.camera.fov=damp(this.camera.fov,62+sp*14,3,dt); }
    else { tx=P.x; ty=P.y+1.55; tz=P.z; dist0=[4.2,2.6,7][C.mode]; if(this.aiming) dist0=2.2; this.camera.fov=damp(this.camera.fov,this.aiming?50:62,8,dt); }
    C.dist=snap?dist0:damp(C.dist,dist0,4,dt);
    const cy=Math.cos(C.yaw), sy=Math.sin(C.yaw), cp=Math.cos(C.pitch), spp=Math.sin(C.pitch);
    let cx=tx-cy*cp*C.dist, cyy=ty+spp*C.dist, cz=tz-sy*cp*C.dist;
    if(this.aiming&&!v){ cx+= -sy*0.7; cz+= cy*0.7; }
    // camera collision with buildings
    const dx=cx-tx, dy=cyy-ty, dz=cz-tz; const L=Math.hypot(dx,dy,dz)||1; const t=this.world.raycastBuildings(tx,ty,tz,dx/L,dy/L,dz/L,L); if(t<L){ const k=Math.max(0.3,t-0.4)/L; cx=tx+dx*k; cyy=ty+dy*k; cz=tz+dz*k; }
    const gy=this.world.heightAt(cx,cz)+0.4; if(cyy<gy) cyy=gy;
    if(snap){ C.x=cx; C.y=cyy; C.z=cz; } else { const k=1-Math.exp(-dt*(v?9:14)); C.x+=(cx-C.x)*k; C.y+=(cyy-C.y)*k; C.z+=(cz-C.z)*k; }
    this.camera.position.set(C.x+this.shakeX*0.05,C.y+this.shakeY*0.05,C.z); const la=this.aiming?40:12; this.camera.lookAt(tx+cy*cp*la+this.shakeX*0.1,ty-spp*la+this.shakeY*0.1,tz+sy*cp*la); this.camera.updateProjectionMatrix(); this.camX=C.x; this.camZ=C.z;
  }
  update(dt){
    const P=this.player, I=this.input; this.time+=dt;
    this.clock=(this.clock+dt*(24/720))%24;
    if(this.hintT>0) this.hintT-=dt; if(this.hurtFlash>0) this.hurtFlash-=dt; if(this.hitMarker>0) this.hitMarker-=dt; if(this.vehicleNameT>0) this.vehicleNameT-=dt; if(this.big) this.big.t-=dt; if(this.gunshotHeatCd>0) this.gunshotHeatCd-=dt; if(this.sprayCd>0) this.sprayCd-=dt;
    for(const n of this.notifications) n.t-=dt; this.notifications=this.notifications.filter(n=>n.t>0);
    for(const f of this.floatTexts) f.t-=dt; this.floatTexts=this.floatTexts.filter(f=>f.t>0);
    if(this.shakeT>0){ this.shakeT-=dt; this.shakeX=rnd(-1,1)*this.shakeAmt; this.shakeY=rnd(-1,1)*this.shakeAmt; } else { this.shakeX=this.shakeY=0; this.shakeAmt=0; }
    if(this.credits>0){ this.credits-=dt; if(this.credits<=0){ this.showDialog([{who:'Tony',text:'The cartel is finished. Leonida belongs to you now, kid. Enjoy it, the city never sleeps.'},{who:'Lucia',text:"Congratulations, you finished the story! Free roam is yours: taxi jobs, vigilante duty, hidden packages... and a five-star rampage if you dare."}]); } }
    if(P.dead||this.busted){ this.deathT+=dt; if(this.deathT>3.5) this.respawn(this.busted); }
    else this.updatePlayer(dt);
    // physics substeps
    this.accum+=dt; let n=0; while(this.accum>=PHYS_DT&&n<8){ for(const v of this.vehicles) if(!v.removed) v.physicsStep(PHYS_DT); this.physics.step(PHYS_DT); this.accum-=PHYS_DT; n++; } if(n===8) this.accum=0;
    for(const v of this.vehicles) if(!v.removed) v.update(dt,this);
    for(const p of this.peds) if(!p.isPlayer&&!p.removed) p.update(dt,this);
    for(const r of this.rockets) r.update(dt,this); this.rockets=this.rockets.filter(r=>!r.removed);
    if(this.heli){ this.heli.update(dt,this); if(this.heli.removed) this.heli=null; }
    this.fx.update(dt);
    this.collisions(dt); this.pickupsUpdate(dt); this.locationsUpdate(dt);
    this.trafficManager(dt); this.pedManager(dt); this.policeManager(dt);
    this.missions.update(dt);
    // cleanup
    for(const v of this.vehicles) if(v.removed){ if(v===P.vehicle){ v.removed=false; continue; } for(const o of v.occupants) o.removed=true; v.dispose(this); } this.vehicles=this.vehicles.filter(v=>!v.removed);
    for(const p of this.peds) if(p.removed&&!p.isPlayer) p.dispose(this); this.peds=this.peds.filter(p=>!p.removed||p.isPlayer);
    for(const p of this.pickups) if(p.removed) p.dispose(this); this.pickups=this.pickups.filter(p=>!p.removed);
    // audio
    const A=this.audio, tv=P.vehicle; if(A.enabled){ A.setEngine(!!tv&&!tv.wrecked,tv?tv.rpm/tv.stats.redline:0,tv?Math.abs(tv.throttleEff):0,dt); let sv=0; for(const v of this.vehicles){ if(v.siren&&!v.wrecked){ const d=dist(v.x,v.z,P.x,P.z); sv=Math.max(sv,1-d/130); } } A.setSiren(clamp(sv,0,1),this.time,dt); A.updateRadio(!!tv); A.updateLoops(dt,tv?Math.abs(tv.speed)/45:0,this.heli?dist(this.heli.x,this.heli.z,P.x,P.z):-1); }
  }
  updatePlayer(dt){
    const P=this.player, I=this.input, K=I.keys; P.shootCd-=dt; P.hitFlash-=dt;
    this.aiming=I.rmb&&!P.vehicle;
    if(P.state==='knocked'){ P.update(dt,this); return; }
    if(P.vehicle){
      const v=P.vehicle; const c=v.ctrl; c.throttle=(K.has('KeyW')||K.has('ArrowUp'))?1:(K.has('KeyS')||K.has('ArrowDown'))?-1:0; c.steer=(K.has('KeyA')||K.has('ArrowLeft'))?-1:(K.has('KeyD')||K.has('ArrowRight'))?1:0; c.handbrake=K.has('Space'); c.brake=0;
      P.x=v.x; P.z=v.z; P.y=v.y; this.playerAttack(dt);
      if(v.wrecked){ P.damage(200,v.lastHitBy,this,'explosion'); }
      P.update(dt,this); return;
    }
    let ax=0,az=0; if(K.has('KeyW')||K.has('ArrowUp'))ax+=1; if(K.has('KeyS')||K.has('ArrowDown'))ax-=1; if(K.has('KeyA')||K.has('ArrowLeft'))az-=1; if(K.has('KeyD')||K.has('ArrowRight'))az+=1;
    const sprint=(K.has('ShiftLeft')||K.has('ShiftRight'))&&!this.aiming; const spd=sprint?P.runSpeed:P.walkSpeed;
    const yaw=this.cam.yaw; const fx=Math.cos(yaw), fz=Math.sin(yaw), rx=-fz, rz=fx;
    if(ax||az){ const L=Math.hypot(ax,az); const mx=(fx*ax+rx*az)/L, mz=(fz*ax+rz*az)/L; P.vx=mx*spd; P.vz=mz*spd; P.moving=true; if(!this.aiming) P.angle=Math.atan2(mz,mx); } else { P.vx=P.vz=0; P.moving=false; }
    if(this.aiming||I.mouseDown) P.angle=yaw;
    const aim=this.aiming?this.aimPoint():null; P.aimPitch=aim?clamp(Math.atan2(aim.y-(P.y+1.4),dist(P.x,P.z,aim.x,aim.z)),-0.8,0.8):0; P.aiming=this.aiming;
    P.update(dt,this);
    this.playerAttack(dt);
    I.justDown=false;
  }
  collisions(dt){
    const V=this.vehicles, Pd=this.peds;
    // vehicle-ped
    for(const v of V){ if(v.removed) continue; const sp=Math.hypot(v.vx,v.vz);
      for(const p of Pd){ if(p.dead||p.vehicle||p.removed) continue; if(Math.abs(p.x-v.x)>v.l||Math.abs(p.z-v.z)>v.l) continue; if(Math.abs(p.y-v.y)>2.5) continue; if(!v.containsPoint(p.x,p.z,p.r-0.05)) continue;
        const lp=v.localPoint(p.x,p.z);
        if(sp>2.5&&p.state!=='knocked'){ const src=v.driver||v; const dmg=sp*3.2*(p.isPlayer?0.5:1); const dd=dist(p.x,p.z,v.x,v.z)||1; const nx=(p.x-v.x)/dd, nz=(p.z-v.z)/dd; p.knock(v.vx*0.85+nx*3,v.vz*0.85+nz*3,2.5+sp*0.18,dmg,src,this); this.audio.hit(); v.damage(1,null,this); v.body.applyImpulse(new CANNON.Vec3(-v.vx*30,0,-v.vz*30),new CANNON.Vec3(lp.x,0.2,0)); if(v.driver&&!v.driver.isPlayer&&v.ai&&v.ai.mode==='traffic'&&!v.ai.panic){ v.ai.panic=true; v.ai.speedMul=1.5; } }
        else { const ox=v.l/2+p.r-Math.abs(lp.x), oz=v.w/2+p.r-Math.abs(lp.z); let px,pz; if(ox<oz){ px=Math.sign(lp.x||1)*ox; pz=0; } else { px=0; pz=Math.sign(lp.z||1)*oz; } const c=Math.cos(v.angle), s=Math.sin(v.angle); p.x+=px*c-pz*s; p.z+=px*s+pz*c; if(p.state==='knocked'&&sp>2.5){ p.damage(sp*2,v.driver||v,this,'vehicle'); } }
      } }
    // ped-ped
    for(let i=0;i<Pd.length;i++){ const a=Pd[i]; if(a.dead||a.vehicle) continue; for(let j=i+1;j<Pd.length;j++){ const b=Pd[j]; if(b.dead||b.vehicle) continue; const dx=b.x-a.x, dz=b.z-a.z; if(Math.abs(dx)>0.7||Math.abs(dz)>0.7) continue; const d=Math.hypot(dx,dz)||0.01; if(d<0.7){ const push=(0.7-d)/2; const nx=dx/d, nz=dz/d; a.x-=nx*push; a.z-=nz*push; b.x+=nx*push; b.z+=nz*push; } } }
  }
  pickupsUpdate(dt){
    const P=this.player; const px=P.x,pz=P.z; const r=P.vehicle?3.2:1.6;
    for(const p of this.pickups){ p.update(dt,this); if(p.removed) continue; if(p.expire&&this.time>p.expire){ p.removed=true; continue; } if(p.hiddenUntil>this.time) continue; if(dist(px,pz,p.x,p.z)>r) continue; if(P.dead) continue;
      switch(p.type){
        case 'cash': P.money+=p.amount; this.stats.cash+=p.amount; this.audio.cash(); this.floatText(p.x,p.y+1,p.z,'+'+fmtMoney(p.amount),'#5fd97a'); break;
        case 'health': if(P.hp>=P.maxHp) continue; P.hp=P.maxHp; this.audio.pickup(); break;
        case 'armor': if(P.armor>=100) continue; P.armor=100; this.audio.pickup(); break;
        case 'weapon': this.giveWeapon(p.weapon,p.ammo||WEAPONS[p.weapon].clip); this.audio.pickup(); this.notify('Picked up '+WEAPONS[p.weapon].name,'#ffd23f'); break;
        case 'package': this.progress.packages.push(p.pkgIdx); P.money+=1000; this.audio.missionPass(); this.notify(`Hidden package ${this.progress.packages.length}/15 (+$1,000)`,'#ffd23f'); if(this.progress.packages.length===15){ P.money+=15000; this.notify('All packages found! +$15,000','#ffd23f'); } break;
        case 'bribe': P.heat=Math.max(0,P.heat-4); this.updateWanted(); this.audio.pickup(); this.notify('Police bribe taken','#ffd23f'); break;
        case 'item': p.collected=true; this.audio.pickup(); break;
      }
      if(p.respawn){ p.hiddenUntil=this.time+p.respawn; } else p.removed=true;
    }
  }
  locationsUpdate(dt){
    const P=this.player; if(P.dead) return;
    if(!P.vehicle&&this.hintT<=0&&this.time<240){ for(const v of this.vehicles){ if(v.wrecked) continue; if(Math.abs(v.x-P.x)<9&&Math.abs(v.z-P.z)<9){ const lp=v.localPoint(P.x,P.z); if(Math.abs(lp.x)<v.l/2+2.6&&Math.abs(lp.z)<v.w/2+2.6){ this.hint=v.driver?'Press E to jack the '+v.name:'Press E to enter the '+v.name; this.hintT=0.4; break; } } } }
    for(const l of this.world.locations){ const d=dist(P.x,P.z,l.x,l.z); if(d>l.r) continue;
      if(l.type==='spray'&&P.vehicle&&this.sprayCd<=0&&Math.abs(P.vehicle.speed)<8){ const v=P.vehicle; if(P.wanted===0&&v.hp>=v.maxHp){ continue; } if(P.money<100){ this.hint="Pay 'n' Spray costs $100"; this.hintT=2; this.sprayCd=3; continue; } P.money-=100; v.hp=v.maxHp; P.heat=0; this.updateWanted(); this.sprayCd=6; this.audio.cash(); this.notify('Resprayed! Cops lost your trail (-$100)','#5fd97a'); for(let i=0;i<24;i++) this.fx.water(v.x+rnd(-2,2),v.y+0.5,v.z+rnd(-1.5,1.5)); for(const c of this.peds){ if(c.kind==='cop'||c.kind==='swat'){ c.state='wander'; c.target=null; } } if(!v.stats.fixedColor){ v.color=pick(CAR_COLORS); v.paintMat.color.copy(col3(v.color)); } }
      if(!P.vehicle&&this.hintT<=0){ if(l.type==='ammu'){ this.hint='Press E to shop at Ammu-Nation'; this.hintT=0.5; } else if(l.type==='hospital'){ this.hint='Press E to heal ($100)'; this.hintT=0.5; } else if(l.type==='safehouse'&&!(this.missions.available&&this.missions.available.at==='safehouse'&&!this.missions.current)){ this.hint='Press E to save and sleep'; this.hintT=0.5; } }
    }
  }
  // ---------------- managers ----------------
  spawnPointOffscreen(minD,maxD,fn){ const P=this.player; for(let i=0;i<20;i++){ const a=rnd(TAU), d=rnd(minD,maxD); const x=P.x+Math.cos(a)*d, z=P.z+Math.sin(a)*d; if(this.inView(x,z,40)) continue; const r=fn(x,z); if(r) return r; } return null; }
  trafficManager(dt){
    this.trafficT-=dt; if(this.trafficT>0||this.noTraffic) return; this.trafficT=0.6;
    const P=this.player; const target=this.city.darkness>0.5?10:16;
    let n=0; for(const v of this.vehicles){ if(v.removed) continue; const d=dist(v.x,v.z,P.x,P.z); if(v.ai&&v.ai.mode==='traffic'&&!v.mission&&v.driver){ if(d>220){ v.removed=true; continue; } n++; } if(v.wrecked&&d>170&&v.wreckT>12&&!v.mission) v.removed=true; if(!v.driver&&!v.parked&&!v.mission&&d>280&&!v.wrecked) v.removed=true; }
    if(n>=target) return;
    const W=this.world; const nodes=W.nodeList.filter(nd=>{ const d=dist(nd.x,nd.z,P.x,P.z); return d>65&&d<140&&!this.inView(nd.x,nd.z,40); }); if(!nodes.length) return;
    const A=pick(nodes); const toward=A.nb.filter(nb=>dist(nb.x,nb.z,P.x,P.z)<dist(A.x,A.z,P.x,P.z)); const B=(toward.length&&Math.random()<0.75)?pick(toward):pick(A.nb); const dx=B.x-A.x, dz=B.z-A.z, L=Math.hypot(dx,dz), ux=dx/L, uz=dz/L, rx=-uz, rz=ux; const s=rnd(T*3,L-T*3); const x=A.x+ux*s+rx*T, z=A.z+uz*s+rz*T;
    if(this.vehicles.some(v=>dist(v.x,v.z,x,z)<12)) return;
    const kind=pick(TRAFFIC_KINDS); const v=this.spawnVehicle(kind,x,z,Math.atan2(uz,ux)); v.ai={mode:'traffic',speedMul:rnd(0.8,1.2),node:A,next:B,C:null}; const drv=this.spawnPed(x,z,'civ'); v.addOccupant(drv,true); if(Math.random()<0.3&&kind!=='bike'){ const pas=this.spawnPed(x,z,'civ'); v.addOccupant(pas,false); }
    v.body.velocity.set(ux*10,0,uz*10); for(const w of v.wheels) w.omega=10/v.stats.wheelR;
    if(P.wanted===0&&Math.random()<0.12&&!this.vehicles.some(v=>v.isPolice&&v.driver&&!v.driver.isPlayer&&!v.wrecked)){ v.removed=true; const pv=this.spawnVehicle('police',x,z,Math.atan2(uz,ux)); pv.ai={mode:'traffic',speedMul:1,node:A,next:B,C:null}; const cop=this.spawnPed(x,z,'cop'); pv.addOccupant(cop,true); pv.body.velocity.set(ux*10,0,uz*10); }
  }
  pedManager(dt){
    this.pedT-=dt; if(this.pedT>0||this.noTraffic) return; this.pedT=0.4;
    const P=this.player; const target=this.city.darkness>0.5?18:30; let n=0;
    for(const p of this.peds){ if(p.removed||p.isPlayer) continue; const d=dist(p.x,p.z,P.x,P.z); if(p.dead){ if(p.deadT>30||(d>150&&p.deadT>5)) p.removed=true; continue; } if(p.vehicle) continue; if(p.mission) continue; if(d>190&&!this.inView(p.x,p.z,40)){ p.removed=true; continue; } if(p.kind==='civ') n++; }
    if(n>=target) return;
    const sp=this.spawnPointOffscreen(50,100,(x,z)=>{ const t=this.world.tileAt(x,z); return (PED_OK[t]&&t!==TILE.ROAD)?{x,z}:null; }); if(!sp) return;
    const beach=this.world.tileAt(sp.x,sp.z)===TILE.SAND;
    const kind=(!beach&&Math.random()<0.06)?'cop':(Math.random()<0.05?'gang':'civ'); const p=this.spawnPed(sp.x,sp.z,kind); if(kind==='gang') p.aggro=false;
    if(Math.random()<0.25){ const p2=this.spawnPed(sp.x+1.2,sp.z+0.8,'civ'); p2.dir=p.dir; }
  }
  policeManager(dt){
    const P=this.player; const seen=this.copNearby(65)||(this.heli&&!this.heli.dead);
    if(P.heat>0&&!seen&&!P.dead){ P.heat=Math.max(0,P.heat-dt/6); const w=P.wanted; this.updateWanted(); if(P.wanted<w&&P.wanted===0) this.notify('You lost the cops','#5fd97a'); }
    this.policeT-=dt; if(this.policeT>0) return; this.policeT=1.2;
    const W=this.player.wanted;
    for(const v of this.vehicles){ if(!v.isPolice||v.wrecked||!v.driver||v.driver.isPlayer) continue; if(W>0&&(!v.ai||v.ai.mode!=='police')&&dist(v.x,v.z,P.x,P.z)<175){ v.ai={mode:'police'}; v.siren=true; v.body.wakeUp(); } if(W===0&&v.ai&&v.ai.mode==='police'){ v.ai={mode:'traffic',speedMul:1}; v.aiPickEdge(this); v.siren=false; } }
    for(const v of this.vehicles){ if(W===0&&v.ai&&v.ai.mode==='parked'&&!v.driver) v.ai=null; }
    if(W===0){ if(this.heli&&!this.heli.dead){ this.heli.removed=true; this.scene.remove(this.heli.mesh); this.heli=null; } return; }
    const cfg=[null,{cops:2,cars:0,swat:0,heli:false},{cops:3,cars:1,swat:0,heli:false},{cops:4,cars:2,swat:0,heli:false},{cops:5,cars:3,swat:1,heli:true},{cops:6,cars:4,swat:2,heli:true}][W];
    let cops=0,cars=0,swat=0; for(const p of this.peds){ if(p.dead||p.removed) continue; if(p.kind==='cop'&&!p.vehicle) cops++; if(p.kind==='swat') swat++; } for(const v of this.vehicles){ if(v.isPolice&&!v.wrecked&&v.driver&&!v.driver.isPlayer&&v.ai&&v.ai.mode==='police'){ if(v.kind!=='swat') cars++; } }
    if(cops<cfg.cops){ const sp=this.spawnPointOffscreen(55,100,(x,z)=>{ const t=this.world.tileAt(x,z); return (PED_OK[t])?{x,z}:null; }); if(sp){ const c=this.spawnPed(sp.x,sp.z,'cop'); c.state='attack'; c.target=P; if(W>=4){ c.weapon=pick(['pistol','shotgun','smg']); c.setWeaponMesh(); } } }
    if(cars<cfg.cars){ this.spawnPoliceVehicle('police',2,W>=3?'shotgun':'pistol'); }
    if(swat<cfg.swat*4){ this.spawnPoliceVehicle('swat',4,'rifle'); }
    if(cfg.heli&&!this.heli){ const a=rnd(TAU); this.heli=new Helicopter(P.x+Math.cos(a)*170,P.z+Math.sin(a)*170,this); this.notify('Police helicopter inbound!','#ff5050'); }
  }
  spawnPoliceVehicle(kind,n,weapon){
    const P=this.player; const nodes=this.world.nodeList.filter(nd=>{ const d=dist(nd.x,nd.z,P.x,P.z); return d>75&&d<160&&!this.inView(nd.x,nd.z,40); }); if(!nodes.length) return;
    const A=pick(nodes), B=pick(A.nb); const ang=angTo(A.x,A.z,B.x,B.z); const x=A.x+Math.cos(ang)*T*2-Math.sin(ang)*T, z=A.z+Math.sin(ang)*T*2+Math.cos(ang)*T; if(this.vehicles.some(v=>dist(v.x,v.z,x,z)<10)) return;
    const v=this.spawnVehicle(kind,x,z,ang); v.ai={mode:'police'}; v.siren=true; for(let i=0;i<n;i++){ const c=this.spawnPed(x,z,kind==='swat'?'swat':'cop',{weapon}); v.addOccupant(c,i===0); }
    v.body.velocity.set(Math.cos(ang)*12,0,Math.sin(ang)*12);
  }
  // test helpers
  teleport(x,z,angle){ const P=this.player; if(P.vehicle){ const v=P.vehicle; const b=v.body; b.position.set(x,this.world.heightAt(x,z)+v.stats.comH+0.05,z); b.velocity.set(0,0,0); b.angularVelocity.set(0,0,0); if(angle!==undefined) b.quaternion.setFromAxisAngle(new CANNON.Vec3(0,1,0),-angle); b.wakeUp(); v.update(0.001,this); } else { P.x=x; P.z=z; P.y=this.world.heightAt(x,z); if(angle!==undefined) P.angle=angle; } this.snapCamera(); }
  debugState(){ const P=this.player; return {state:this.state,fps:Math.round(this.fps),x:+P.x.toFixed(1),z:+P.z.toFixed(1),hp:Math.round(P.hp),money:P.money,wanted:P.wanted,heat:+P.heat.toFixed(1),veh:P.vehicle?P.vehicle.kind:null,vspeed:P.vehicle?+(P.vehicle.speed*3.6).toFixed(0):0,gear:P.vehicle?P.vehicle.gear:0,rpm:P.vehicle?Math.round(P.vehicle.rpm):0,peds:this.peds.length,vehs:this.vehicles.length,mission:this.missions.current?this.missions.current.id:null,obj:this.missions.objectiveText(),side:this.missions.side,dialog:!!this.dialog,menu:!!this.menu,busted:this.busted,dead:P.dead,big:this.big&&this.big.t>0?this.big.text:null,clock:+this.clock.toFixed(1),heli:!!this.heli}; }
}
window.addEventListener('load',()=>{ const test=/[?&]test=1/.test(location.search); window.G=new Game(document.getElementById('c'),{test}); });
