// vision.js — raycasting vision cone
const Vision = (() => {
  function hasLOS(x1,y1,x2,y2){
    const dx=x2-x1,dy=y2-y1,dist=Math.sqrt(dx*dx+dy*dy);
    const steps=Math.ceil(dist/(MAP_TILE_SIZE*0.25));
    for(let i=1;i<steps;i++){
      const t=i/steps;
      if(GameMap.getTile(Math.floor((x1+dx*t)/MAP_TILE_SIZE),Math.floor((y1+dy*t)/MAP_TILE_SIZE))===1) return false;
    }
    return true;
  }
  function canSee(gx,gy,facing,fov,range,tx,ty){
    const dx=tx-gx,dy=ty-gy;
    const dist=Math.sqrt(dx*dx+dy*dy);
    if(dist>range*MAP_TILE_SIZE) return false;
    if(Math.abs(Utils.angleDiff(facing,Math.atan2(dy,dx)))>fov) return false;
    return hasLOS(gx,gy,tx,ty);
  }
  function buildConePoly(gx,gy,facing,fov,range,rays=28){
    const maxD=range*MAP_TILE_SIZE;
    const pts=[{x:gx,y:gy}];
    for(let i=0;i<=rays;i++){
      const angle=facing-fov+(2*fov*i/rays);
      let hit=maxD;
      for(let d=4;d<=maxD;d+=4){
        const rx=gx+Math.cos(angle)*d, ry=gy+Math.sin(angle)*d;
        if(GameMap.getTile(Math.floor(rx/MAP_TILE_SIZE),Math.floor(ry/MAP_TILE_SIZE))===1){hit=d-4;break;}
      }
      pts.push({x:gx+Math.cos(angle)*hit,y:gy+Math.sin(angle)*hit});
    }
    return pts;
  }
  return {canSee,buildConePoly,hasLOS};
})();
