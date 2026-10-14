// boids.js — 3-rule flocking: Separation, Alignment, Cohesion
// Force vectors drawn as live arrows on each guard
const Boids = (() => {
  const SEP_R=75,  ALI_R=160, COH_R=200;
  const SEP_W=2.5, ALI_W=0.9, COH_W=0.7;

  function forces(g, all){
    let sx=0,sy=0,sc=0;
    let ax=0,ay=0,ac=0;
    let cx=0,cy=0,cc=0;
    for(const o of all){
      if(o===g) continue;
      const dx=g.x-o.x, dy=g.y-o.y;
      const d=Math.sqrt(dx*dx+dy*dy)||1;
      if(d<SEP_R){ sx+=dx/d/d; sy+=dy/d/d; sc++; }
      if(d<ALI_R){ ax+=Math.cos(o.facing); ay+=Math.sin(o.facing); ac++; }
      if(d<COH_R){ cx+=o.x; cy+=o.y; cc++; }
    }
    const alert=g.currentState===FSM_STATE.CHASE||g.currentState===FSM_STATE.SEARCH;
    const m=alert?2.8:1;
    const sep=sc?{x:(sx/sc)*SEP_W*m,  y:(sy/sc)*SEP_W*m}:{x:0,y:0};
    let ali={x:0,y:0};
    if(ac){ const al=Math.sqrt(ax*ax+ay*ay)||1; ali={x:(ax/al)*ALI_W,y:(ay/al)*ALI_W}; }
    let coh={x:0,y:0};
    if(cc){ const cl=Math.sqrt((cx/cc-g.x)**2+(cy/cc-g.y)**2)||1; coh={x:(cx/cc-g.x)/cl*COH_W*m,y:(cy/cc-g.y)/cl*COH_W*m}; }
    return {sep,ali,coh};
  }

  function apply(g, all){
    const f=forces(g,all);
    g._boidF=f;
    const tx=f.sep.x+f.ali.x+f.coh.x;
    const ty=f.sep.y+f.ali.y+f.coh.y;
    const B=0.15;
    const nx=g.x+tx*B, ny=g.y+ty*B;
    if(!g._collides(nx,g.y)) g.x=nx;
    if(!g._collides(g.x,ny)) g.y=ny;
  }

  function drawArrow(ctx,x1,y1,x2,y2,color,label){
    const dx=x2-x1,dy=y2-y1,len=Math.sqrt(dx*dx+dy*dy);
    if(len<1.5) return;
    ctx.save();
    ctx.globalAlpha=0.85; ctx.strokeStyle=color; ctx.fillStyle=color; ctx.lineWidth=1.8;
    ctx.shadowBlur=6; ctx.shadowColor=color;
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    const a=Math.atan2(dy,dx), hl=7;
    ctx.beginPath();
    ctx.moveTo(x2,y2);
    ctx.lineTo(x2-hl*Math.cos(a-0.45),y2-hl*Math.sin(a-0.45));
    ctx.lineTo(x2-hl*Math.cos(a+0.45),y2-hl*Math.sin(a+0.45));
    ctx.closePath(); ctx.fill();
    if(len>6){
      ctx.font='bold 7px monospace'; ctx.textAlign='center'; ctx.shadowBlur=0;
      ctx.fillText(label,x1+dx*0.55,y1+dy*0.55-3);
    }
    ctx.restore();
  }

  function drawForces(ctx,g,cam){
    if(!g._boidF) return;
    const sx=g.x-cam.x, sy=g.y-cam.y;
    const S=32;
    const {sep,ali,coh}=g._boidF;
    drawArrow(ctx,sx,sy,sx+sep.x*S,sy+sep.y*S,'#ff4455','SEP');
    drawArrow(ctx,sx,sy,sx+ali.x*S,sy+ali.y*S,'#44aaff','ALI');
    drawArrow(ctx,sx,sy,sx+coh.x*S,sy+coh.y*S,'#44ff99','COH');
  }

  return {apply,drawForces};
})();
