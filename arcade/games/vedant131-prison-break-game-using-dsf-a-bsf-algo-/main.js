// main.js — cinematic orchestrator: slow-mo, pulse border, chromatic aberration, film grain

const AudioMgr = (() => {
  let ctx=null,ls=0;
  function init(){ try{ctx=new(window.AudioContext||window.webkitAudioContext)();_amb();}catch(e){} }
  function _o(f,t,g,d,st){ if(!ctx)return; const o=ctx.createOscillator(),gn=ctx.createGain(); o.type=t; o.frequency.value=f; gn.gain.setValueAtTime(g,st); gn.gain.exponentialRampToValueAtTime(0.0001,st+d); o.connect(gn).connect(ctx.destination); o.start(st); o.stop(st+d); }
  function _amb(){ if(!ctx)return; const o=ctx.createOscillator(),g=ctx.createGain(),f=ctx.createBiquadFilter(); o.type='sawtooth';o.frequency.value=55;g.gain.value=0.015;f.type='lowpass';f.frequency.value=160; o.connect(f).connect(g).connect(ctx.destination);o.start(); }
  function foot(){ if(!ctx)return; const n=ctx.currentTime; if(n-ls<0.22)return;ls=n;_o(75+Math.random()*25,'sine',0.04,0.07,n); }
  function alarm(){ if(!ctx)return; const n=ctx.currentTime; _o(880,'square',0.08,0.2,n);_o(660,'square',0.06,0.2,n+0.25);_o(880,'square',0.08,0.2,n+0.5);_o(440,'square',0.04,0.5,n+0.85); }
  function caught(){ if(!ctx)return; const n=ctx.currentTime; for(let i=0;i<6;i++) _o(500-i*65,'sawtooth',0.09,0.35,n+i*0.18); }
  function win(){ if(!ctx)return; const n=ctx.currentTime; [523,659,784,1046].forEach((f,i)=>_o(f,'sine',0.09,0.45,n+i*0.14)); }
  return {init,foot,alarm,caught,win};
})();

const GS={TITLE:'TITLE',PLAYING:'PLAYING',OVER:'OVER',WIN:'WIN'};

const Game=(()=>{
  let canvas,ctx,W,H,state=GS.TITLE,last=0;
  let player=null,guards=[],keys={},cam={x:0,y:0};
  let alert=false,alertCD=0,focusG=0;

  // Cinematic state
  let slowMo=1,slowTimer=0;          // slow-motion
  let pulseA=0,pulseT=0;             // red border pulse
  let chromatic=0;                   // chromatic aberration intensity
  let grainT=0;                      // film grain timer
  let detectFlash=0;                 // white flash on detection

  // UI toggles
  let showPath=true,showDFS=true,showBFS=true,showBoids=true;

  function init(){
    canvas=document.getElementById('game-canvas');
    ctx=canvas.getContext('2d');
    resize();
    window.addEventListener('resize',resize);
    window.addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true;});
    window.addEventListener('keyup',  e=>{keys[e.key.toLowerCase()]=false;});
    document.getElementById('start-btn').addEventListener('click',startGame);
    document.getElementById('restart-btn').addEventListener('click',startGame);
    document.getElementById('toggle-path').addEventListener('change',e=>showPath=e.target.checked);
    document.getElementById('toggle-dfs').addEventListener('change', e=>showDFS=e.target.checked);
    document.getElementById('toggle-bfs').addEventListener('change', e=>showBFS=e.target.checked);
    document.getElementById('toggle-boids').addEventListener('change',e=>showBoids=e.target.checked);
    AudioMgr.init();
    requestAnimationFrame(loop);
  }

  function resize(){ W=canvas.width=window.innerWidth; H=canvas.height=window.innerHeight; }

  function startGame(){
    const ps=GameMap.getPlayerStart();
    player=new Player(ps.col,ps.row);
    const diff=window.selectedDiff||2;
    guards=GameMap.getDifficultyGuards(diff).map((c,i)=>new Guard({...c,id:i}));
    const dnames={1:"LVL 1 — ROOKIE",2:"LVL 2 — OFFICER",3:"LVL 3 — WARDEN"};
    document.getElementById("diff-badge").textContent=dnames[diff]||"";
    const pc=Utils.tileCenterWorld(ps.col,ps.row,MAP_TILE_SIZE);
    cam={x:pc.x-W/2,y:pc.y-H/2};
    alert=false;alertCD=0;slowMo=1;slowTimer=0;pulseA=0;chromatic=0;detectFlash=0;
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('gameover-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('alert-bar').classList.add('hidden');
    state=GS.PLAYING;
  }

  function loop(ts){
    requestAnimationFrame(loop);
    const rdt=Math.min(ts-last,50); last=ts;
    if(state===GS.PLAYING) update(rdt*slowMo, rdt);
    render(rdt);
  }

  function update(dt,rdt){
    player.update(keys,dt);

    // Camera
    cam.x=Utils.lerp(cam.x,player.x-W/2,0.09);
    cam.y=Utils.lerp(cam.y,player.y-H/2,0.09);

    Effects.update(dt);

    // Slow-mo recovery
    if(slowTimer>0){ slowTimer-=rdt; if(slowTimer<=0) slowTimer=0; }
    if(slowTimer<=0 && slowMo<1){ slowMo=Math.min(1,slowMo+rdt*0.002); }

    // Chromatic aberration decay
    if(chromatic>0) chromatic=Math.max(0,chromatic-rdt*0.003);
    if(detectFlash>0) detectFlash=Math.max(0,detectFlash-rdt*0.005);

    // Update guards + boids
    let anyChase=false;
    for(const g of guards){ g.update(dt,player); if(g.currentState===FSM_STATE.CHASE) anyChase=true; }
    for(const g of guards) Boids.apply(g,guards);

    // Focus guard
    focusG=guards.findIndex(g=>g.currentState===FSM_STATE.CHASE);
    if(focusG<0) focusG=guards.findIndex(g=>g.currentState===FSM_STATE.SEARCH);
    if(focusG<0) focusG=0;

    // Alert transition
    if(anyChase&&!alert){
      alert=true; alertCD=700;
      AudioMgr.alarm();
      // CINEMATIC: slow-mo burst
      slowMo=0.12; slowTimer=1400;
      chromatic=1; detectFlash=1;
      Effects.triggerFlash('rgba(255,50,0,',0.6,600);
      Effects.triggerShake(10,600);
      document.getElementById('alert-bar').classList.remove('hidden');
    } else if(!anyChase){
      alertCD-=rdt;
      if(alertCD<=0){
        alert=false;
        document.getElementById('alert-bar').classList.add('hidden');
      }
    }

    // Pulse border during alert
    if(alert||pulseA>0){
      if(alert){ pulseT+=rdt*0.005; pulseA=0.22+0.18*Math.sin(pulseT*5); }
      else pulseA=Math.max(0,pulseA-0.015);
    }

    updatePanel();

    const domS=anyChase?'CHASE':guards.some(g=>g.currentState===FSM_STATE.SEARCH)?'SEARCH':'PATROL';
    const nm={PATROL:'EVADING',CHASE:'⚠ DETECTED',SEARCH:'SUSPICIOUS'};
    document.getElementById('state-display').textContent='STATUS: '+(nm[domS]||'—');
    document.getElementById('slowmo-ind').style.opacity=slowMo<0.5?1:0;

    if(player.isAtExit()){ AudioMgr.win(); state=GS.WIN; endScreen(true); return; }
    for(const g of guards){
      if(Utils.dist(player.x,player.y,g.x,g.y)<player.radius+g.radius-2){
        state=GS.OVER; AudioMgr.caught();
        Effects.triggerFlash('rgba(200,0,0,',0.85,900);
        Effects.triggerShake(18,800);
        setTimeout(()=>endScreen(false),800); return;
      }
    }
  }

  function updatePanel(){
    if(!guards.length) return;
    const d=guards[focusG].getDebugData();
    document.querySelectorAll('.fsm-node').forEach(el=>el.classList.remove('active-patrol','active-chase','active-search'));
    if(d.state===FSM_STATE.PATROL) document.getElementById('fsm-patrol').classList.add('active-patrol');
    if(d.state===FSM_STATE.CHASE)  document.getElementById('fsm-chase').classList.add('active-chase');
    if(d.state===FSM_STATE.SEARCH) document.getElementById('fsm-search').classList.add('active-search');
    document.getElementById('arr-pc').classList.toggle('active',d.state===FSM_STATE.CHASE);
    document.getElementById('arr-cs').classList.toggle('active',d.state===FSM_STATE.SEARCH);
    document.getElementById('ai-algo').textContent=d.algo;
    document.getElementById('ai-state').textContent=d.state;
    document.getElementById('ai-vis').textContent=guards.some(g=>g.currentState===FSM_STATE.CHASE)?'🔴 DETECTED':'🟢 SAFE';
    document.getElementById('ai-path').textContent=d.state===FSM_STATE.CHASE?d.pathNodes+' nodes':'—';
    document.getElementById('ai-stack').textContent=d.state===FSM_STATE.PATROL?d.stackSize+' deep':'—';
    document.getElementById('ai-bfs').textContent=d.state===FSM_STATE.SEARCH?d.bfsQueue+' frontier':'—';
    document.getElementById('ai-note').textContent=d.note;
  }

  function endScreen(won){
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('alert-bar').classList.add('hidden');
    document.getElementById('gameover-title').textContent=won?'ESCAPED':'CAPTURED';
    document.getElementById('gameover-sub').textContent=won?'Freedom achieved. The AI failed.':'The guards caught you. Study the algorithms.';
    document.getElementById('gameover-screen').classList.remove('hidden');
  }

  function render(rdt){
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#030303'; ctx.fillRect(0,0,W,H);
    if(state===GS.TITLE) return;

    // ── CHROMATIC ABERRATION pre-pass ──
    if(chromatic>0.05){
      ctx.save();
      ctx.globalCompositeOperation='screen';
      ctx.globalAlpha=chromatic*0.07;
      ctx.fillStyle='#ff0000'; ctx.fillRect(-4,0,W,H);
      ctx.fillStyle='#0000ff'; ctx.fillRect(4,0,W,H);
      ctx.restore();
    }

    const shake=Effects.getShakeOffset();
    ctx.save();
    ctx.translate(shake.x,shake.y);

    // Map
    GameMap.draw(ctx,cam);

    // Debug overlays
    for(const g of guards) g.drawDebug(ctx,cam,showPath,showDFS,showBFS);

    // Boid force arrows
    if(showBoids) for(const g of guards) Boids.drawForces(ctx,g,cam);

    // Entities
    for(const g of guards) g.draw(ctx,cam);
    if(player) player.draw(ctx,cam);

    Effects.renderParticles(ctx);
    Lighting.render(ctx,W,H,player,guards,cam);

    // ── CINEMATIC: Red danger border pulse ──
    if(pulseA>0.01){
      const bx=ctx.createLinearGradient(0,0,W,0);
      bx.addColorStop(0,`rgba(220,0,0,${pulseA})`);
      bx.addColorStop(0.12,'rgba(220,0,0,0)');
      bx.addColorStop(0.88,'rgba(220,0,0,0)');
      bx.addColorStop(1,`rgba(220,0,0,${pulseA})`);
      ctx.fillStyle=bx; ctx.fillRect(0,0,W,H);
      const by=ctx.createLinearGradient(0,0,0,H);
      by.addColorStop(0,`rgba(220,0,0,${pulseA})`);
      by.addColorStop(0.1,'rgba(220,0,0,0)');
      by.addColorStop(0.9,'rgba(220,0,0,0)');
      by.addColorStop(1,`rgba(220,0,0,${pulseA})`);
      ctx.fillStyle=by; ctx.fillRect(0,0,W,H);
    }

    // ── Detection white flash ──
    if(detectFlash>0.05){
      ctx.save(); ctx.globalAlpha=detectFlash*0.3;
      ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,W,H);
      ctx.restore();
    }

    Effects.renderFlash(ctx,W,H);
    Effects.renderVignette(ctx,W,H);

    // ── Film grain during slow-mo ──
    if(slowMo<0.5){
      const grainAlpha=(1-slowMo*2)*0.055;
      ctx.save(); ctx.globalAlpha=grainAlpha;
      for(let i=0;i<300;i++){
        ctx.fillStyle=Math.random()>0.5?'#fff':'#000';
        ctx.fillRect(Math.random()*W,Math.random()*H,1.5,1.5);
      }
      // Letterbox bars during slow-mo
      ctx.globalAlpha=(1-slowMo*2)*0.6;
      ctx.fillStyle='#000';
      const bh=H*0.06;
      ctx.fillRect(0,0,W,bh);
      ctx.fillRect(0,H-bh,W,bh);
      ctx.restore();
    }

    ctx.restore();
  }

  return {init};
})();

window.addEventListener('DOMContentLoaded',()=>Game.init());
