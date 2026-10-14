// lighting.js — brighter cinematic lighting
const Lighting = (() => {
  function render(ctx,W,H,player,guards,cam){
    const off=document.createElement('canvas');
    off.width=W; off.height=H;
    const oc=off.getContext('2d');

    // Darkness — reduced from 0.91 to 0.78 for more brightness
    oc.fillStyle='rgba(0,0,0,0.78)';
    oc.fillRect(0,0,W,H);

    oc.globalCompositeOperation='destination-out';

    // Player flashlight — increased radius 210→280, stronger falloff
    const px=player.x-cam.x, py=player.y-cam.y;
    const pl=oc.createRadialGradient(px,py,0,px,py,280);
    pl.addColorStop(0,  'rgba(255,220,160,1)');
    pl.addColorStop(0.3,'rgba(255,190,110,0.85)');
    pl.addColorStop(0.6,'rgba(255,160,80,0.5)');
    pl.addColorStop(0.85,'rgba(255,120,50,0.2)');
    pl.addColorStop(1,  'rgba(0,0,0,0)');
    oc.fillStyle=pl;
    oc.beginPath(); oc.arc(px,py,280,0,Math.PI*2); oc.fill();

    // Guard cones — brighter
    for(const g of guards){
      const gx=g.x-cam.x, gy=g.y-cam.y;
      const chase=g.currentState===FSM_STATE.CHASE;
      const search=g.currentState===FSM_STATE.SEARCH;
      const poly=Vision.buildConePoly(gx+cam.x,gy+cam.y,g.facing,g.visionAngle,g.visionRange);
      const gl=oc.createRadialGradient(gx,gy,0,gx,gy,g.visionRange*MAP_TILE_SIZE);
      if(chase){
        gl.addColorStop(0,'rgba(255,100,40,1)');
        gl.addColorStop(0.5,'rgba(255,60,20,0.65)');
        gl.addColorStop(1,'rgba(0,0,0,0)');
      } else if(search){
        gl.addColorStop(0,'rgba(255,200,20,0.95)');
        gl.addColorStop(0.5,'rgba(200,140,0,0.5)');
        gl.addColorStop(1,'rgba(0,0,0,0)');
      } else {
        gl.addColorStop(0,'rgba(200,225,255,0.9)');
        gl.addColorStop(0.5,'rgba(160,200,255,0.45)');
        gl.addColorStop(1,'rgba(0,0,0,0)');
      }
      oc.save();
      oc.fillStyle=gl;
      oc.beginPath();
      const pts=poly.map(p=>({x:p.x-cam.x,y:p.y-cam.y}));
      if(pts.length){ oc.moveTo(pts[0].x,pts[0].y); for(let i=1;i<pts.length;i++) oc.lineTo(pts[i].x,pts[i].y); }
      oc.closePath(); oc.fill();
      oc.restore();

      // Ambient glow around each guard
      const ag=oc.createRadialGradient(gx,gy,0,gx,gy,55);
      ag.addColorStop(0,'rgba(255,255,255,0.3)');
      ag.addColorStop(1,'rgba(0,0,0,0)');
      oc.save(); oc.fillStyle=ag;
      oc.beginPath(); oc.arc(gx,gy,55,0,Math.PI*2); oc.fill();
      oc.restore();
    }

    ctx.drawImage(off,0,0);

    // Colored glow rings on top of darkness
    for(const g of guards){
      const gx=g.x-cam.x, gy=g.y-cam.y;
      const chase=g.currentState===FSM_STATE.CHASE;
      const search=g.currentState===FSM_STATE.SEARCH;
      ctx.save();
      const gg=ctx.createRadialGradient(gx,gy,0,gx,gy,48);
      if(chase){      gg.addColorStop(0,'rgba(255,80,0,0.7)');  gg.addColorStop(1,'rgba(255,0,0,0)'); }
      else if(search){gg.addColorStop(0,'rgba(255,180,0,0.6)'); gg.addColorStop(1,'rgba(255,100,0,0)'); }
      else{           gg.addColorStop(0,'rgba(80,160,255,0.4)'); gg.addColorStop(1,'rgba(0,60,255,0)'); }
      ctx.fillStyle=gg;
      ctx.beginPath(); ctx.arc(gx,gy,48,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }
  return {render};
})();
