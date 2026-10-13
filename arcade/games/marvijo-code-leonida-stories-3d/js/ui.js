'use strict';
// DOM based HUD, menus, dialog, title and map screens.
class UI{
  constructor(G){
    this.G=G; const root=this.root=document.getElementById('ui');
    root.innerHTML=`
      <div id="hurt"></div><div id="vignette"></div>
      <div id="topleft"><div id="clock">00:00</div><div id="radio"></div><div id="god"></div></div>
      <div id="topright"><div id="money">$0</div><div class="bar"><div id="hpbar"></div></div><div class="bar"><div id="armorbar"></div></div><div id="stars"></div>
        <div id="weapon"><canvas id="wicon" width="48" height="40"></canvas><div><div id="wname"></div><div id="wammo"></div></div></div>
        <div class="bar thin"><div id="vbar"></div></div><div id="vname"></div><div id="mlines"></div></div>
      <div id="notif"></div><div id="big"><div id="bigtext"></div><div id="bigsub"></div></div>
      <div id="speedo"><span id="speed">0</span><span class="unit">km/h</span><span id="gear"></span><div id="rpm"><div id="rpmbar"></div></div></div>
      <div id="bottom"><div id="hint"></div><div id="timer"></div><div id="objective"></div></div>
      <div id="crosshair"><div class="c"></div></div><div id="hitmarker">×</div>
      <div id="minimapwrap"><canvas id="minimap" width="240" height="170"></canvas><div id="wantedtag">WANTED</div></div>
      <div id="floats"></div>
      <div id="dialog"><div id="portrait"></div><div id="dlgbody"><div id="dlgwho"></div><div id="dlgtext"></div><div id="dlgnext">ENTER ▸ next</div></div></div>
      <div id="menu"><div id="menubox"><div id="menutitle"></div><div id="menuitems"></div><div id="menufooter"></div></div></div>
      <div id="controls"></div>
      <div id="map"><div id="maptitle">LEONIDA — CITY MAP</div><canvas id="mapcanvas"></canvas><div id="maplegend"></div><div id="mapfoot"></div></div>
      <div id="title"><div id="titlebg"></div><div id="titleinner"><div id="tlogo">LEONIDA<span>STORIES</span></div><div id="tsub">A 3D open-world crime game in the browser</div><div id="titleitems"></div><div id="tctrls">WASD move / drive · Mouse look, LMB shoot, RMB aim · Shift sprint · E enter/exit vehicle<br>Space handbrake · 1-7 / wheel weapons · T taxi / vigilante jobs · R radio · M map · Esc pause</div></div></div>`;
    this.el={}; for(const e of root.querySelectorAll('[id]')) this.el[e.id]=e;
    this.mm=this.el.minimap.getContext('2d'); this.lastMenuSig=''; this.lastTitleSig=''; this.lastCtrl=false; this.floatEls=new Map();
    this.el.controls.innerHTML=this.controlsHtml();
    root.querySelector('#controls').addEventListener('click',()=>G.closeControls());
  }
  controlsHtml(){ const lines=[['ON FOOT',''],['W A S D','Move (relative to camera)'],['Mouse','Look around'],['Shift','Sprint'],['Right mouse','Aim'],['Left mouse','Attack / shoot'],['1-7, wheel','Switch weapon'],['E','Enter vehicle (steals if occupied)'],['IN A VEHICLE',''],['W / S','Accelerate / brake & reverse'],['A / D','Steer'],['Space','Handbrake'],['Left mouse','Drive-by (pistol/uzi/rifle)'],['E','Exit vehicle'],['R','Change radio station'],['T','Start taxi / vigilante job'],['C','Toggle camera'],['GENERAL',''],['M / Tab','City map'],['Esc','Pause menu'],['F5','Quick save']];
    return '<h1>CONTROLS</h1><table>'+lines.map(([k,v])=>v===''?`<tr><th colspan=2>${k}</th></tr>`:`<tr><td class="k">${k}</td><td>${v}</td></tr>`).join('')+'</table><div class="foot">Press Esc to go back</div>'; }
  star(ctx,x,y,r,fill){ ctx.beginPath(); for(let i=0;i<10;i++){ const rr=i%2?r*0.45:r, a=i/10*TAU-Math.PI/2; ctx.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);} ctx.closePath(); ctx.fill(); ctx.stroke(); }
  update(dt){
    const G=this.G, E=this.el, P=G.player;
    E.title.style.display=G.state==='title'?'flex':'none';
    E.controls.style.display=G.state==='controls'?'block':'none';
    E.map.style.display=G.state==='map'?'flex':'none';
    if(G.state==='title'){ this.drawTitle(); return; }
    if(!P) return;
    // HUD
    E.hurt.style.opacity=G.hurtFlash>0?G.hurtFlash*1.5:0; E.vignette.style.opacity=(P.hp<30&&!P.dead)?(0.35+Math.sin(G.time*6)*0.15):0;
    E.money.textContent=fmtMoney(P.money); E.hpbar.style.width=(clamp(P.hp/P.maxHp,0,1)*100)+'%'; E.armorbar.style.width=(clamp(P.armor/100,0,1)*100)+'%';
    const flash=G.time-G.lastCrimeT<2&&Math.floor(G.time*4)%2===0; let stars=''; for(let i=0;i<5;i++) stars+=`<span class="${i<P.wanted?(flash?'on flash':'on'):''}">★</span>`; if(this.lastStars!==stars){ E.stars.innerHTML=stars; this.lastStars=stars; }
    const w=P.weapons[P.curWeapon]; const WD=WEAPONS[P.curWeapon]; E.wname.textContent=WD.name; E.wammo.textContent=WD.melee?'':(w&&isFinite(w.ammo)?String(w.ammo):'∞'); if(this.lastWIcon!==P.curWeapon){ this.drawWeaponIcon(P.curWeapon); this.lastWIcon=P.curWeapon; }
    const v=P.vehicle; E.vbar.parentElement.style.display=v?'block':'none'; if(v){ const f=clamp(v.hp/v.maxHp,0,1); E.vbar.style.width=(f*100)+'%'; E.vbar.style.background=f>0.5?'#9ad07a':f>0.25?'#e0b040':'#e04040'; }
    E.vname.textContent=G.vehicleNameT>0?G.vehicleName:''; E.vname.style.opacity=clamp(G.vehicleNameT,0,1);
    E.speedo.style.display=v?'block':'none'; if(v){ E.speed.textContent=Math.round(Math.abs(v.speed)*3.6); E.gear.textContent=v.gear<0?'R':v.gear; E.rpmbar.style.width=(clamp(v.rpm/v.stats.redline,0,1)*100)+'%'; E.rpmbar.style.background=v.rpm/v.stats.redline>0.9?'#ff4040':'#ffd23f'; }
    const hh=Math.floor(G.clock)%24, mm=Math.floor((G.clock%1)*60); E.clock.textContent=`${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
    E.radio.textContent=v?'♪ '+G.audio.stations[G.audio.radio.station]:''; E.god.textContent=G.godMode?'GOD MODE':'';
    E.notif.innerHTML=G.notifications.map(n=>`<div style="color:${n.color};opacity:${clamp(n.t,0,1)}">${n.text}</div>`).join('');
    if(G.big&&G.big.t>0){ E.big.style.display='block'; E.big.style.opacity=clamp(Math.min(G.big.t,1)*1.5,0,1); E.bigtext.textContent=G.big.text; E.bigtext.style.color=G.big.color; E.bigsub.textContent=G.big.sub||''; } else E.big.style.display='none';
    const M=G.missions; const obj=M.objectiveText(); const tp=M.targetPos(); const dtxt=tp?`  ·  ${Math.round(dist(tp.x,tp.z,P.x,P.z))} m`:''; E.objective.textContent=obj?obj+dtxt:''; E.objective.style.display=obj?'inline-block':'none';
    const dtm=M.displayTimer(); E.timer.style.display=(dtm!==null&&dtm!==undefined)?'block':'none'; if(dtm!==null&&dtm!==undefined){ E.timer.textContent=fmtTime(dtm); E.timer.style.color=dtm<10?'#ff5050':'#fff'; }
    E.hint.textContent=(G.hint&&G.hintT>0)?G.hint:''; E.hint.style.opacity=clamp(G.hintT,0,1);
    E.crosshair.style.display=(!G.menu&&!G.dialog&&G.state==='play'&&!(v&&!G.aiming))?'block':'none'; E.hitmarker.style.opacity=G.hitMarker>0?1:0;
    E.mlines.innerHTML=(M.current&&M.current.hudLines)?M.current.hudLines(M).map(l=>`<div>${l}</div>`).join(''):'';
    E.wantedtag.style.display=P.wanted>0?'block':'none';
    this.drawMinimap();
    this.updateFloats();
    // dialog
    if(G.dialog){ const d=G.dialog, line=d.lines[d.idx]; E.dialog.style.display='flex'; const col={Lucia:'#ff5fa0',Ray:'#40e0d0',Tony:'#ffb040',Phone:'#aaa',Dispatch:'#7090ff'}[line.who]||'#ccc'; E.portrait.style.background=col; E.portrait.textContent=line.who[0]; E.dlgwho.textContent=line.who.toUpperCase(); E.dlgwho.style.color=col; E.dlgtext.textContent=line.text.slice(0,Math.floor(d.charT*45)); E.dlgnext.textContent=d.idx<d.lines.length-1?'ENTER ▸ next':'ENTER ▸ close'; } else E.dialog.style.display='none';
    // menu
    if(G.menu){ const m=G.menu; const sig=m.title+'|'+m.sel+'|'+m.items.map(i=>i.label+(i.right||'')+(i.disabled?'d':'')).join(',')+'|'+(m.footer||''); if(sig!==this.lastMenuSig){ this.lastMenuSig=sig; E.menutitle.textContent=m.title; E.menuitems.innerHTML=m.items.map((it,i)=>`<div class="mi ${i===m.sel?'sel':''} ${it.disabled?'dis':''}" data-i="${i}"><span>${it.label}</span><span class="r">${it.right||''}</span></div>`).join(''); E.menufooter.textContent=m.footer||''; for(const el of E.menuitems.querySelectorAll('.mi')){ el.addEventListener('mouseenter',()=>{ G.menu&&(G.menu.sel=+el.dataset.i); }); el.addEventListener('click',()=>{ if(G.menu){ G.menu.sel=+el.dataset.i; G.menuSelect(); } }); } } E.menu.style.display='flex'; } else { E.menu.style.display='none'; this.lastMenuSig=''; }
    if(G.state==='map') this.drawMap();
  }
  drawWeaponIcon(key){ const c=this.el.wicon, ctx=c.getContext('2d'); ctx.clearRect(0,0,48,40); ctx.save(); ctx.translate(24,20); ctx.fillStyle='#eee';
    switch(key){ case 'fist': ctx.beginPath(); ctx.arc(0,0,8,0,TAU); ctx.fill(); ctx.fillStyle='#bbb'; ctx.fillRect(-8,-2,16,3); break;
      case 'bat': ctx.rotate(-0.7); ctx.fillStyle='#b07a3a'; ctx.fillRect(-12,-2,24,4); ctx.fillRect(4,-3,10,6); break;
      case 'pistol': ctx.fillRect(-9,-4,18,5); ctx.fillRect(-4,0,5,8); break;
      case 'smg': ctx.fillRect(-12,-4,22,6); ctx.fillRect(-2,1,4,9); ctx.fillRect(-12,2,4,4); break;
      case 'shotgun': ctx.fillRect(-14,-3,28,4); ctx.fillStyle='#b07a3a'; ctx.fillRect(-14,-1,10,5); break;
      case 'rifle': ctx.fillRect(-14,-3,28,5); ctx.fillRect(-2,1,4,8); ctx.fillStyle='#b07a3a'; ctx.fillRect(-14,1,8,4); ctx.fillStyle='#eee'; ctx.fillRect(8,-6,2,4); break;
      case 'rocket': ctx.fillStyle='#4a5a3a'; ctx.fillRect(-14,-3,28,6); ctx.fillStyle='#c33'; ctx.beginPath(); ctx.moveTo(14,-4); ctx.lineTo(20,0); ctx.lineTo(14,4); ctx.fill(); break; }
    ctx.restore(); }
  drawMinimap(){
    const G=this.G, P=G.player, world=G.world, ctx=this.mm; const mw=240,mh=170; const scale=2.4; const yaw=G.cam.yaw;
    ctx.save(); ctx.clearRect(0,0,mw,mh); ctx.beginPath(); ctx.roundRect(0,0,mw,mh,10); ctx.fillStyle='#2b6f9c'; ctx.fill(); ctx.clip();
    ctx.translate(mw/2,mh/2); ctx.rotate(-yaw-Math.PI/2); // camera forward points up
    const px=P.x/T, pz=P.z/T; ctx.imageSmoothingEnabled=false; ctx.drawImage(world.minimap,-px*scale,-pz*scale,world.w*scale,world.h*scale); ctx.imageSmoothingEnabled=true;
    const blip=(x,z,color,r=4,shape='dot',txt)=>{ const sx=(x/T-px)*scale, sz=(z/T-pz)*scale; if(Math.abs(sx)>mw||Math.abs(sz)>mh) return; ctx.save(); ctx.translate(sx,sz); ctx.rotate(yaw+Math.PI/2); ctx.fillStyle=color; ctx.strokeStyle='rgba(0,0,0,0.8)'; ctx.lineWidth=1.5; if(shape==='dot'){ ctx.beginPath(); ctx.arc(0,0,r,0,TAU); ctx.fill(); ctx.stroke(); } else { ctx.beginPath(); ctx.roundRect(-6,-6,12,12,2); ctx.fill(); ctx.stroke(); if(txt){ ctx.fillStyle='#000'; ctx.font='bold 9px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(txt,0,0.5);} } ctx.restore(); };
    for(const b of G.blips()) blip(b.x,b.z,b.color,b.r||4,b.shape||'dot',b.txt);
    ctx.restore();
    // player arrow (heading relative to camera)
    ctx.save(); ctx.translate(mw/2,mh/2); const ang=(P.vehicle?P.vehicle.angle:P.angle)-yaw-Math.PI/2; ctx.rotate(ang); ctx.fillStyle='#fff'; ctx.strokeStyle='#000'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(8,0); ctx.lineTo(-6,-6); ctx.lineTo(-3,0); ctx.lineTo(-6,6); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    // target arrow on the border
    const tp=G.missions.targetPos(); if(tp){ const dx=tp.x-P.x, dz=tp.z-P.z; const a=Math.atan2(dz,dx)-yaw-Math.PI/2; const sx=Math.cos(a)*(dx*dx+dz*dz>0?1:0), sz=Math.sin(a); const rx=mw/2-14, rz=mh/2-14; const k=Math.min(rx/Math.max(Math.abs(sx),1e-6),rz/Math.max(Math.abs(sz),1e-6)); const d=Math.hypot(dx,dz)/T*scale; if(d>k){ ctx.save(); ctx.translate(mw/2+sx*k,mh/2+sz*k); ctx.rotate(a); ctx.fillStyle=tp.color||'#ffd23f'; ctx.strokeStyle='#000'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(9,0); ctx.lineTo(-6,-7); ctx.lineTo(-3,0); ctx.lineTo(-6,7); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); } }
    ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=2; ctx.beginPath(); ctx.roundRect(1,1,mw-2,mh-2,10); ctx.stroke();
  }
  drawMap(){
    const G=this.G, world=G.world, P=G.player; const c=this.el.mapcanvas; const size=Math.min(window.innerWidth-320,window.innerHeight-150); c.width=size; c.height=size; const ctx=c.getContext('2d'); const scale=size/world.w;
    ctx.imageSmoothingEnabled=false; ctx.drawImage(world.minimap,0,0,size,size); ctx.imageSmoothingEnabled=true;
    const blip=(x,z,color,r=5,shape='dot',txt)=>{ const sx=x/T*scale, sz=z/T*scale; ctx.fillStyle=color; ctx.strokeStyle='#000'; ctx.lineWidth=1.5; if(shape==='dot'){ ctx.beginPath(); ctx.arc(sx,sz,r,0,TAU); ctx.fill(); ctx.stroke(); } else { ctx.beginPath(); ctx.roundRect(sx-8,sz-8,16,16,3); ctx.fill(); ctx.stroke(); if(txt){ ctx.fillStyle='#000'; ctx.font='bold 11px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(txt,sx,sz+0.5);} } };
    for(const b of G.blips(true)) blip(b.x,b.z,b.color,b.r||5,b.shape||'dot',b.txt);
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(P.x/T*scale,P.z/T*scale,6,0,TAU); ctx.fill(); ctx.strokeStyle='#000'; ctx.stroke();
    const legend=[['L','Lucia (safehouse)','#ffd23f'],['R','Ray (club)','#ffd23f'],['T','Tony (docks)','#ffd23f'],['A','Ammu-Nation','#e0e0e0'],['S',"Pay 'n' Spray",'#f0a050'],['H','Hospital','#ff7070'],['P','Police','#7090ff'],['$','Bank','#5fd97a'],['C','Car dealer','#c0f0ff']];
    this.el.maplegend.innerHTML=legend.map(([k,n,col])=>`<div><span class="lk" style="background:${col}">${k}</span>${n}</div>`).join('');
    this.el.mapfoot.textContent=`Hidden packages: ${G.progress.packages.length}/${world.packages.length}   Missions: ${G.progress.missionIdx}/${MISSIONS.length}   ·   Press M or TAB to close`;
  }
  drawTitle(){ const G=this.G; const items=G.titleItems(); const sig=items.map((i,k)=>i.label+(i.disabled?'d':'')+(k===G.titleSel?'*':'')).join(); if(sig===this.lastTitleSig) return; this.lastTitleSig=sig;
    this.el.titleitems.innerHTML=items.map((it,i)=>`<div class="ti ${i===G.titleSel?'sel':''} ${it.disabled?'dis':''}" data-i="${i}">${it.label}</div>`).join('');
    for(const el of this.el.titleitems.querySelectorAll('.ti')){ el.addEventListener('mouseenter',()=>{ G.titleSel=+el.dataset.i; }); el.addEventListener('click',()=>{ G.titleSel=+el.dataset.i; G.titleSelect(); }); } }
  updateFloats(){ const G=this.G; const box=this.el.floats; const seen=new Set(); const v=new THREE.Vector3();
    for(const f of G.floatTexts){ seen.add(f); let el=this.floatEls.get(f); if(!el){ el=document.createElement('div'); el.className='float'; el.textContent=f.text; el.style.color=f.color; box.appendChild(el); this.floatEls.set(f,el); } v.set(f.x,f.y+(1.5-f.t)*1.2,f.z).project(G.camera); const sx=(v.x*0.5+0.5)*window.innerWidth, sy=(-v.y*0.5+0.5)*window.innerHeight; el.style.display=(v.z<1)?'block':'none'; el.style.left=sx+'px'; el.style.top=sy+'px'; el.style.opacity=clamp(f.t,0,1); }
    for(const [f,el] of this.floatEls){ if(!seen.has(f)){ el.remove(); this.floatEls.delete(f); } } }
}
