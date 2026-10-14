// player.js — smooth player movement & rendering
class Player {
  constructor(col,row){
    this.x=col*MAP_TILE_SIZE+MAP_TILE_SIZE/2;
    this.y=row*MAP_TILE_SIZE+MAP_TILE_SIZE/2;
    this.speed=2.6; this.radius=10;
    this.facing=0; this.moving=false;
    this.stepT=0; this.bobY=0;
    this.trail=[];
  }
  update(keys,dt){
    let dx=0,dy=0;
    if(keys['w']||keys['arrowup'])    dy-=1;
    if(keys['s']||keys['arrowdown'])  dy+=1;
    if(keys['a']||keys['arrowleft'])  dx-=1;
    if(keys['d']||keys['arrowright']) dx+=1;
    this.moving=dx!==0||dy!==0;
    if(this.moving){
      const len=Math.sqrt(dx*dx+dy*dy);
      dx/=len; dy/=len;
      this.facing=Math.atan2(dy,dx);
      this._tryMove(dx*this.speed,0);
      this._tryMove(0,dy*this.speed);
      this.stepT+=dt*0.005;
      this.bobY=Math.sin(this.stepT*6)*1.5;
      this.trail.push({x:this.x,y:this.y,life:1});
      if(this.trail.length>14) this.trail.shift();
    } else { this.trail.length=0; }
    for(const t of this.trail) t.life-=0.09;
  }
  _tryMove(dx,dy){
    if(!this._collides(this.x+dx,this.y)) this.x+=dx;
    if(!this._collides(this.x,this.y+dy)) this.y+=dy;
  }
  _collides(x,y){
    const r=this.radius-2;
    for(const [cx,cy] of [[x-r,y-r],[x+r,y-r],[x-r,y+r],[x+r,y+r]])
      if(GameMap.getTile(Math.floor(cx/MAP_TILE_SIZE),Math.floor(cy/MAP_TILE_SIZE))===1) return true;
    return false;
  }
  draw(ctx,cam){
    const sx=this.x-cam.x, sy=this.y-cam.y+this.bobY;
    // Trail
    for(const t of this.trail){
      ctx.save(); ctx.globalAlpha=t.life*0.18;
      ctx.fillStyle='#88ccff';
      ctx.beginPath(); ctx.arc(t.x-cam.x,t.y-cam.y,this.radius*0.5,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
    // Shadow
    ctx.save(); ctx.globalAlpha=0.3; ctx.fillStyle='#000';
    ctx.beginPath(); ctx.ellipse(sx,sy+this.radius+2,this.radius*0.8,4,0,0,Math.PI*2); ctx.fill(); ctx.restore();
    // Body
    const bg=ctx.createRadialGradient(sx-2,sy-2,1,sx,sy,this.radius);
    bg.addColorStop(0,'#99ddff'); bg.addColorStop(1,'#1155aa');
    ctx.save(); ctx.fillStyle=bg;
    ctx.beginPath(); ctx.arc(sx,sy,this.radius,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#4499cc'; ctx.lineWidth=1.5; ctx.stroke(); ctx.restore();
    // Eye
    ctx.save(); ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.arc(sx+Math.cos(this.facing)*5,sy+Math.sin(this.facing)*5,2.5,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
  isAtExit(){
    const e=GameMap.getExit(); if(!e) return false;
    return Utils.dist(this.x,this.y,e.col*MAP_TILE_SIZE+MAP_TILE_SIZE/2,e.row*MAP_TILE_SIZE+MAP_TILE_SIZE/2)<MAP_TILE_SIZE*0.75;
  }
}
