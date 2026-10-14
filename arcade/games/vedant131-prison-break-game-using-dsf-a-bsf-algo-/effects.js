// effects.js — screen shake, flash, vignette, particles
const Effects = (() => {
  let shakeAmt=0,shakeTime=0,flashAmt=0,flashCol='rgba(255,0,0,';
  let particles=[];

  function triggerShake(intensity,duration){ shakeAmt=intensity; shakeTime=duration; }
  function triggerFlash(col,alpha,duration){
    flashAmt=alpha; flashCol=col;
    const step=alpha/(duration/16);
    const iv=setInterval(()=>{ flashAmt-=step; if(flashAmt<=0){flashAmt=0;clearInterval(iv);} },16);
  }
  function update(dt){
    if(shakeTime>0){ shakeTime-=dt; if(shakeTime<=0) shakeAmt=0; }
    for(let i=particles.length-1;i>=0;i--){
      const p=particles[i];
      p.x+=p.vx; p.y+=p.vy; p.vy+=0.1; p.life-=p.decay;
      if(p.life<=0) particles.splice(i,1);
    }
  }
  function getShakeOffset(){
    if(shakeAmt<=0) return {x:0,y:0};
    return {x:(Math.random()-0.5)*shakeAmt*2,y:(Math.random()-0.5)*shakeAmt*2};
  }
  function spawnParticles(wx,wy,cam,count=10){
    for(let i=0;i<count;i++){
      particles.push({
        x:wx-cam.x,y:wy-cam.y,
        vx:(Math.random()-0.5)*4,vy:(Math.random()-0.5)*4-1,
        life:1,decay:0.025+Math.random()*0.03,
        size:1+Math.random()*2.5,
        color:`hsl(${20+Math.random()*40},90%,60%)`
      });
    }
  }
  function renderParticles(ctx){
    for(const p of particles){
      ctx.save();
      ctx.globalAlpha=p.life;
      ctx.fillStyle=p.color;
      ctx.shadowBlur=6; ctx.shadowColor=p.color;
      ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size);
      ctx.restore();
    }
  }
  function renderFlash(ctx,w,h){
    if(flashAmt<=0) return;
    ctx.save();
    ctx.fillStyle=flashCol+flashAmt+')';
    ctx.fillRect(0,0,w,h);
    ctx.restore();
  }
  function renderVignette(ctx,w,h){
    const g=ctx.createRadialGradient(w/2,h/2,h*0.25,w/2,h/2,h*0.85);
    g.addColorStop(0,'rgba(0,0,0,0)');
    g.addColorStop(1,'rgba(0,0,0,0.72)');
    ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  }
  return {triggerShake,triggerFlash,update,getShakeOffset,spawnParticles,renderParticles,renderFlash,renderVignette};
})();
