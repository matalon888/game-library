// map.js — static hand-crafted map (reliable, no procedural dependency)
const MAP_TILE_SIZE = 40;

// 0=floor 1=wall 2=exit
const _RAW = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,0,1],
  [1,0,1,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,1,0,1],
  [1,0,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1],
  [1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1],
  [1,0,1,1,1,0,1,1,1,1,0,1,1,1,1,0,1,1,1,0,1,0,1,1,1],
  [1,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,0,1,1,0,1,1,1,0,1,0,1,0,1,0,1,1,1,1,1,0,1],
  [1,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,1],
  [1,0,1,0,1,1,1,0,1,0,1,1,0,1,1,0,1,1,0,1,0,0,1,0,1],
  [1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1],
  [1,0,1,1,1,0,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,0,1,0,1],
  [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,0,1,1,0,1,1,0,1,0,1,1,0,1,0,1,1,0,1,1,0,1],
  [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,1],
  [1,0,1,1,1,1,0,1,1,0,1,1,0,0,0,1,1,0,1,1,0,0,1,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,0,1,1,0,1,1,0,1,0,1,1,1,0,1,0,1,1,0,1,1,0,1],
  [1,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,1,0,0,1,0,1],
  [1,0,1,1,0,0,1,1,0,0,1,1,0,1,1,0,1,1,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,1],
];

const GameMap = (() => {
  const ROWS=_RAW.length, COLS=_RAW[0].length;

  function isWalkable(col,row){
    if(row<0||row>=ROWS||col<0||col>=COLS) return false;
    return _RAW[row][col]!==1;
  }
  function getTile(col,row){
    if(row<0||row>=ROWS||col<0||col>=COLS) return 1;
    return _RAW[row][col];
  }
  function getExit(){ for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) if(_RAW[r][c]===2) return {col:c,row:r}; }
  function getPlayerStart(){ return {col:1,row:1}; }
  function getGuardStarts(){
    return [
      {col:12,row:5, speed:1.4,visionRange:6,visionAngle:Math.PI/2.8},
      {col:5, row:13,speed:1.1,visionRange:7,visionAngle:Math.PI/3},
      {col:20,row:10,speed:1.7,visionRange:5,visionAngle:Math.PI/2.5},
    ];
  }

  function draw(ctx,cam){
    const T=MAP_TILE_SIZE;
    for(let r=0;r<ROWS;r++){
      for(let c=0;c<COLS;c++){
        const wx=c*T-cam.x, wy=r*T-cam.y;
        const tile=_RAW[r][c];
        if(tile===1){
          ctx.fillStyle='#0d0d0d'; ctx.fillRect(wx,wy,T,T);
          ctx.fillStyle='#1e1e1e'; ctx.fillRect(wx,wy,T,3);
          ctx.fillStyle='#060606'; ctx.fillRect(wx,wy+T-2,T,2);
        } else if(tile===2){
          ctx.fillStyle='#001a0d'; ctx.fillRect(wx,wy,T,T);
          ctx.save();
          ctx.fillStyle='#00ff88';
          ctx.globalAlpha=0.13+0.08*Math.sin(Date.now()/300);
          ctx.fillRect(wx,wy,T,T);
          ctx.globalAlpha=1;
          ctx.strokeStyle='#00ff88'; ctx.lineWidth=2;
          ctx.strokeRect(wx+2,wy+2,T-4,T-4);
          ctx.fillStyle='#00ff88'; ctx.font='bold 8px monospace'; ctx.textAlign='center';
          ctx.fillText('EXIT',wx+T/2,wy+T/2+3);
          ctx.restore();
        } else {
          ctx.fillStyle='#111'; ctx.fillRect(wx,wy,T,T);
          ctx.strokeStyle='#161616'; ctx.lineWidth=0.4;
          ctx.strokeRect(wx,wy,T,T);
        }
      }
    }
  }

  return {ROWS,COLS,grid:_RAW,isWalkable,getTile,getExit,getPlayerStart,getGuardStarts,draw};
})();

// Difficulty configs — called by main.js
GameMap.getDifficultyGuards = function(level) {
  const base = [
    {col:12,row:5},
    {col:5, row:13},
    {col:20,row:10},
  ];
  const configs = {
    1: { speed:0.85, visionRange:4, visionAngle:Math.PI/4,   searchDur:2500, count:2 },
    2: { speed:1.4,  visionRange:6, visionAngle:Math.PI/2.8, searchDur:4000, count:3 },
    3: { speed:2.1,  visionRange:8, visionAngle:Math.PI/2,   searchDur:6000, count:3 },
  };
  const cfg = configs[level] || configs[2];
  return base.slice(0, cfg.count).map(pos => ({ ...pos, ...cfg }));
};
