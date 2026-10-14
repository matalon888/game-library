// guard.js — Guard: DFS patrol, A* chase, BFS search + cinematic draw
class Guard {
  constructor(cfg){
    this.x=cfg.col*MAP_TILE_SIZE+MAP_TILE_SIZE/2;
    this.y=cfg.row*MAP_TILE_SIZE+MAP_TILE_SIZE/2;
    this.speed=cfg.speed??1.5;
    this.visionRange=cfg.visionRange??6;
    this.visionAngle=cfg.visionAngle??Math.PI/3;
    this.radius=12; this.id=cfg.id??0;
    this.facing=Math.random()*Math.PI*2;
    this.targetFacing=this.facing;
    this.currentState=FSM_STATE.PATROL;
    this.fsm=new GuardFSM(this);
    // DFS
    this.patrolStack=[{col:cfg.col,row:cfg.row}];
    this.patrolVisited=new Set();
    this.patrolTarget=null;
    this.dfsTrail=[];
    // A*
    this.chasePath=[]; this.chasePathIdx=0; this.chaseTimer=0;
    this.astarClosed=[]; this.astarOpen=[];
    // BFS
    this.bfsQueue=[]; this.bfsVisited=new Set(); this.bfsTiles=[];
    this.searchTarget=null;
    this.lastKnownPos=null;
    this.stepT=0; this._boidF=null;
  }

  update(dt,player){
    const canSee=Vision.canSee(this.x,this.y,this.facing,this.visionAngle,this.visionRange,player.x,player.y);
    if(canSee) this.lastKnownPos={x:player.x,y:player.y};
    this.currentState=this.fsm.update(dt,canSee);
    if(this.currentState===FSM_STATE.PATROL) this._patrol(dt);
    else if(this.currentState===FSM_STATE.CHASE) this._chase(dt,player);
    else this._search(dt);
    // Smooth facing
    this.facing+=Utils.angleDiff(this.facing,this.targetFacing)*0.1;
    this.stepT+=dt*0.003;
  }

  // ── 1. DFS PATROL ──
  _patrol(dt){
    if(!this.patrolTarget||this._atTile(this.patrolTarget)) this._dfsStep();
    if(this.patrolTarget) this._moveTo(this.patrolTarget,this.speed*0.68,dt);
  }
  _dfsStep(){
    for(let i=0;i<40&&this.patrolStack.length>0;i++){
      const top=this.patrolStack[this.patrolStack.length-1];
      const k=Utils.tileKey(top.col,top.row);
      if(!this.patrolVisited.has(k)){
        this.patrolVisited.add(k);
        this.patrolTarget=top;
        this.dfsTrail.push({col:top.col,row:top.row});
        if(this.dfsTrail.length>22) this.dfsTrail.shift();
        const dirs=[[0,1],[1,0],[0,-1],[-1,0]].sort(()=>Math.random()-0.5);
        for(const [dc,dr] of dirs){
          const nc=top.col+dc,nr=top.row+dr;
          if(GameMap.isWalkable(nc,nr)&&!this.patrolVisited.has(Utils.tileKey(nc,nr)))
            this.patrolStack.push({col:nc,row:nr});
        }
        return;
      }
      this.patrolStack.pop();
    }
    const cur=Utils.worldToTile(this.x,this.y,MAP_TILE_SIZE);
    this.patrolVisited.clear(); this.dfsTrail=[];
    this.patrolStack=[{col:cur.col,row:cur.row}];
  }

  // ── 2. A* CHASE ──
  _chase(dt,player){
    this.chaseTimer-=dt;
    if(this.chaseTimer<=0){ this.chaseTimer=320; this._astar(player.x,player.y); }
    if(this.chasePathIdx<this.chasePath.length){
      const n=this.chasePath[this.chasePathIdx];
      const w=Utils.tileCenterWorld(n.col,n.row,MAP_TILE_SIZE);
      if(Utils.dist(this.x,this.y,w.x,w.y)<6) this.chasePathIdx++;
      else this._moveWorld(w.x,w.y,this.speed*1.65,dt);
    } else if(this.lastKnownPos){
      this._moveWorld(this.lastKnownPos.x,this.lastKnownPos.y,this.speed*1.65,dt);
    }
  }
  _astar(tx,ty){
    const sc=Utils.worldToTile(this.x,this.y,MAP_TILE_SIZE);
    const tc=Utils.worldToTile(tx,ty,MAP_TILE_SIZE);
    const r=AStar.findWithDebug(sc.col,sc.row,tc.col,tc.row,GameMap.grid);
    if(r){ this.chasePath=r.path; this.chasePathIdx=1; this.astarClosed=r.closedSet; this.astarOpen=r.openSet; }
  }

  // ── 3. BFS SEARCH ──
  onEnterSearch(){
    if(!this.lastKnownPos) return;
    const {col,row}=Utils.worldToTile(this.lastKnownPos.x,this.lastKnownPos.y,MAP_TILE_SIZE);
    this.bfsQueue=[{col,row}];
    this.bfsVisited=new Set([Utils.tileKey(col,row)]);
    this.bfsTiles=[{col,row,wave:0}];
  }
  _search(dt){
    if(!this.searchTarget||this._atTile(this.searchTarget)) this.searchTarget=this._bfsNext();
    if(this.searchTarget) this._moveTo(this.searchTarget,this.speed*0.9,dt);
  }
  _bfsNext(){
    if(!this.bfsQueue.length){ this.onEnterSearch(); return null; }
    const node=this.bfsQueue.shift();
    const wave=this.bfsTiles.find(t=>t.col===node.col&&t.row===node.row)?.wave??0;
    for(const [dc,dr] of [[0,1],[1,0],[0,-1],[-1,0]]){
      const nc=node.col+dc,nr=node.row+dr,nk=Utils.tileKey(nc,nr);
      if(GameMap.isWalkable(nc,nr)&&!this.bfsVisited.has(nk)){
        this.bfsVisited.add(nk);
        this.bfsQueue.push({col:nc,row:nr});
        if(wave<7) this.bfsTiles.push({col:nc,row:nr,wave:wave+1});
      }
    }
    return node;
  }

  // ── MOVEMENT ──
  _moveTo(tile,spd,dt){ const w=Utils.tileCenterWorld(tile.col,tile.row,MAP_TILE_SIZE); this._moveWorld(w.x,w.y,spd,dt); }
  _moveWorld(wx,wy,spd,dt){
    const dx=wx-this.x,dy=wy-this.y,d=Math.sqrt(dx*dx+dy*dy)||1;
    const nx=this.x+dx/d*spd,ny=this.y+dy/d*spd;
    if(!this._collides(nx,this.y)) this.x=nx;
    if(!this._collides(this.x,ny)) this.y=ny;
    this.targetFacing=Math.atan2(dy,dx);
  }
  _collides(x,y){
    const r=this.radius-3;
    for(const [cx,cy] of [[x-r,y-r],[x+r,y-r],[x-r,y+r],[x+r,y+r]])
      if(GameMap.getTile(Math.floor(cx/MAP_TILE_SIZE),Math.floor(cy/MAP_TILE_SIZE))===1) return true;
    return false;
  }
  _atTile(t){ const w=Utils.tileCenterWorld(t.col,t.row,MAP_TILE_SIZE); return Utils.dist(this.x,this.y,w.x,w.y)<8; }

  // ── DEBUG OVERLAYS ──
  drawDebug(ctx,cam,showPath,showDFS,showBFS){
    const T=MAP_TILE_SIZE;
    // DFS trail
    if(showDFS&&this.currentState===FSM_STATE.PATROL){
      for(let i=0;i<this.dfsTrail.length;i++){
        const t=this.dfsTrail[i];
        ctx.save(); ctx.globalAlpha=(i/this.dfsTrail.length)*0.28;
        ctx.fillStyle='#00ff88';
        ctx.fillRect(t.col*T-cam.x+2,t.row*T-cam.y+2,T-4,T-4);
        ctx.restore();
      }
      // Stack peek
      for(let i=Math.max(0,this.patrolStack.length-6);i<this.patrolStack.length;i++){
        const s=this.patrolStack[i];
        ctx.save(); ctx.globalAlpha=0.1; ctx.fillStyle='#88ffaa';
        ctx.fillRect(s.col*T-cam.x+1,s.row*T-cam.y+1,T-2,T-2);
        ctx.globalAlpha=0.35; ctx.strokeStyle='#00ff88'; ctx.lineWidth=1;
        ctx.strokeRect(s.col*T-cam.x+1,s.row*T-cam.y+1,T-2,T-2);
        ctx.restore();
      }
    }
    // BFS wave
    if(showBFS&&this.currentState===FSM_STATE.SEARCH){
      const WC=['#ff8800','#ff6600','#ff4400','#dd2200','#bb1100','#991100','#771100'];
      for(const t of this.bfsTiles){
        ctx.save(); ctx.globalAlpha=Math.max(0.04,0.28-t.wave*0.035);
        ctx.fillStyle=WC[Math.min(t.wave,WC.length-1)];
        ctx.fillRect(t.col*T-cam.x+2,t.row*T-cam.y+2,T-4,T-4); ctx.restore();
      }
      for(const q of this.bfsQueue.slice(0,12)){
        ctx.save(); ctx.globalAlpha=0.4; ctx.strokeStyle='#ffaa00';
        ctx.lineWidth=1.5; ctx.setLineDash([3,3]);
        ctx.strokeRect(q.col*T-cam.x+3,q.row*T-cam.y+3,T-6,T-6); ctx.restore();
      }
    }
    // A* path
    if(showPath&&this.currentState===FSM_STATE.CHASE&&this.chasePath.length){
      for(const n of this.astarClosed.slice(0,100)){
        ctx.save(); ctx.globalAlpha=0.09; ctx.fillStyle='#ff3300';
        ctx.fillRect(n.col*T-cam.x+2,n.row*T-cam.y+2,T-4,T-4); ctx.restore();
      }
      ctx.save(); ctx.strokeStyle='#ff3300'; ctx.lineWidth=2.5;
      ctx.setLineDash([4,4]); ctx.globalAlpha=0.8;
      ctx.beginPath();
      for(let i=this.chasePathIdx;i<this.chasePath.length;i++){
        const n=this.chasePath[i];
        const wx=n.col*T+T/2-cam.x,wy=n.row*T+T/2-cam.y;
        i===this.chasePathIdx?ctx.moveTo(wx,wy):ctx.lineTo(wx,wy);
      }
      ctx.stroke(); ctx.restore();
      for(let i=this.chasePathIdx;i<this.chasePath.length;i++){
        const n=this.chasePath[i];
        ctx.save(); ctx.globalAlpha=0.9; ctx.fillStyle='#ff4400';
        ctx.beginPath(); ctx.arc(n.col*T+T/2-cam.x,n.row*T+T/2-cam.y,3,0,Math.PI*2); ctx.fill(); ctx.restore();
      }
    }
  }

  // ── CINEMATIC DRAW ──
  draw(ctx,cam){
    const sx=this.x-cam.x, sy=this.y-cam.y;
    const chase=this.currentState===FSM_STATE.CHASE;
    const search=this.currentState===FSM_STATE.SEARCH;
    const bob=Math.sin(this.stepT*6)*1.5;

    // Ground shadow
    ctx.save(); ctx.globalAlpha=0.28; ctx.fillStyle='#000';
    ctx.beginPath(); ctx.ellipse(sx,sy+this.radius+2,this.radius*0.75,4,0,0,Math.PI*2); ctx.fill(); ctx.restore();

    // Alert ring pulse
    if(chase){
      ctx.save();
      ctx.globalAlpha=0.18+0.12*Math.sin(Date.now()*0.012);
      ctx.strokeStyle='#ff2200'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(sx,sy+bob,this.radius+8,0,Math.PI*2); ctx.stroke();
      ctx.restore();
    }

    // Body
    const bg=ctx.createRadialGradient(sx-2,sy-2+bob,1,sx,sy+bob,this.radius);
    bg.addColorStop(0,chase?'#ff6644':search?'#ffbb44':'#55aadd');
    bg.addColorStop(1,chase?'#cc1100':search?'#cc7700':'#224488');
    ctx.save(); ctx.fillStyle=bg;
    ctx.beginPath(); ctx.arc(sx,sy+bob,this.radius,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=chase?'#ff2200':search?'#ff9900':'#3377aa';
    ctx.lineWidth=1.8; ctx.stroke(); ctx.restore();

    // Direction dot
    ctx.save(); ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.arc(sx+Math.cos(this.facing)*6,sy+Math.sin(this.facing)*6+bob,2.5,0,Math.PI*2); ctx.fill(); ctx.restore();

    // State label + dot above head
    const dotCol=chase?'#ff2200':search?'#ffaa00':'#00ff88';
    ctx.save();
    ctx.fillStyle=dotCol; ctx.shadowBlur=chase?14:6; ctx.shadowColor=dotCol;
    ctx.beginPath(); ctx.arc(sx,sy-this.radius-6+bob,4,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0;
    ctx.font='bold 8px monospace'; ctx.textAlign='center'; ctx.fillStyle=dotCol;
    ctx.fillText(chase?'A*':search?'BFS':'DFS',sx,sy-this.radius-12+bob);
    ctx.restore();
  }

  getDebugData(){
    return {
      state:this.currentState,
      stackSize:this.patrolStack.length,
      pathNodes:Math.max(0,this.chasePath.length-this.chasePathIdx),
      bfsQueue:this.bfsQueue.length,
      algo:this.currentState===FSM_STATE.PATROL?'DFS PATROL':this.currentState===FSM_STATE.CHASE?'A* PATHFIND':'BFS SEARCH',
      note:this.currentState===FSM_STATE.PATROL
        ?`DFS: stack depth ${this.patrolStack.length}, visited ${this.patrolVisited.size} tiles. Explores deep before backtrack.`
        :this.currentState===FSM_STATE.CHASE
        ?`A*: ${Math.max(0,this.chasePath.length-this.chasePathIdx)} nodes remain. f(n)=g(n)+h(n), Manhattan heuristic.`
        :`BFS: queue=${this.bfsQueue.length}. Expanding outward from last known pos wave-by-wave.`
    };
  }
}
