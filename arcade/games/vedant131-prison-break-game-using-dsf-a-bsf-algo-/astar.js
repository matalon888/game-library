// astar.js — A* with Manhattan heuristic + debug exposure
const AStar = (() => {
  function h(a,b){ return Math.abs(a.col-b.col)+Math.abs(a.row-b.row); }

  function neighbors(n,grid){
    const out=[];
    for(const [dc,dr] of [[0,1],[0,-1],[1,0],[-1,0]]){
      const nc=n.col+dc,nr=n.row+dr;
      if(nr>=0&&nr<grid.length&&nc>=0&&nc<grid[0].length&&grid[nr][nc]!==1)
        out.push({col:nc,row:nr});
    }
    return out;
  }

  function findWithDebug(sc,sr,gc,gr,grid){
    const start={col:sc,row:sr}, goal={col:gc,row:gr};
    const open=[start], closed=[], cameFrom={}, g={}, f={};
    const sk=Utils.tileKey(sc,sr);
    g[sk]=0; f[sk]=h(start,goal);
    let iter=0;
    while(open.length>0&&iter++<2000){
      let bi=0;
      for(let i=1;i<open.length;i++) if((f[Utils.tileKey(open[i].col,open[i].row)]??Infinity)<(f[Utils.tileKey(open[bi].col,open[bi].row)]??Infinity)) bi=i;
      const cur=open.splice(bi,1)[0];
      const ck=Utils.tileKey(cur.col,cur.row);
      closed.push(cur);
      if(cur.col===gc&&cur.row===gr){
        // reconstruct
        const path=[]; let k=ck;
        while(cameFrom[k]){ path.unshift(cameFrom[k].node); k=cameFrom[k].from; }
        path.push(cur);
        return {path,openSet:[...open],closedSet:[...closed]};
      }
      for(const nb of neighbors(cur,grid)){
        const nk=Utils.tileKey(nb.col,nb.row);
        if(closed.find(n=>n.col===nb.col&&n.row===nb.row)) continue;
        const tg=(g[ck]??Infinity)+1;
        if(tg<(g[nk]??Infinity)){
          cameFrom[nk]={node:cur,from:ck};
          g[nk]=tg; f[nk]=tg+h(nb,goal);
          if(!open.find(n=>n.col===nb.col&&n.row===nb.row)) open.push(nb);
        }
      }
    }
    return null;
  }

  function find(sc,sr,gc,gr,grid){
    const r=findWithDebug(sc,sr,gc,gr,grid);
    return r?r.path:null;
  }

  return {find,findWithDebug};
})();
