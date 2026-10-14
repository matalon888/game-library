// utils.js
const Utils = {
  lerp(a,b,t){ return a+(b-a)*t; },
  dist(ax,ay,bx,by){ return Math.sqrt((bx-ax)**2+(by-ay)**2); },
  angle(ax,ay,bx,by){ return Math.atan2(by-ay,bx-ax); },
  angleDiff(a,b){ return ((b-a+Math.PI*3)%(Math.PI*2))-Math.PI; },
  clamp(v,min,max){ return Math.max(min,Math.min(max,v)); },
  worldToTile(x,y,ts){ return {col:Math.floor(x/ts),row:Math.floor(y/ts)}; },
  tileCenterWorld(col,row,ts){ return {x:col*ts+ts/2,y:row*ts+ts/2}; },
  tileKey(col,row){ return col+','+row; }
};
