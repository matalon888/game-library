// Original procedural app icon. ICO uses an uncompressed 32-bit Windows DIB.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const size = 256, scale = 2;
const snake = [[18,18], [38,18], [46,26], [46,42], [38,48], [24,48], [17,41], [17,33], [25,29], [32,33]];
const colors = [[74,233,213],[95,189,255],[242,94,174]];
function distance(x,y,a,b) {
  const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));
  return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);
}
function pixel(x,y) {
  if (Math.hypot(Math.max(0,Math.abs(x-32)-21),Math.max(0,Math.abs(y-32)-21))>9) return [0,0,0,0];
  let result=[10,16,31,255];
  for(let i=1;i<snake.length;i++) if(distance(x,y,snake[i-1],snake[i])<4.4) result=[...colors[Math.min(2,Math.floor((i-1)/3))],255];
  if(Math.hypot(x-32,y-33)<5.5) result=[239,247,250,255];
  if(Math.hypot(x-33.6,y-31.5)<1.1) result=[10,16,31,255];
  if(Math.hypot(x-19,y-9)<2.5) result=[74,233,213,255];
  return result;
}
const bitmap=Buffer.alloc(size*size*4),mask=Buffer.alloc(size*size/8),header=Buffer.alloc(40),directory=Buffer.alloc(22);
for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
  const values=[0,0,0,0];
  for(let sy=0;sy<scale;sy++) for(let sx=0;sx<scale;sx++) {
    const c=pixel((x+(sx+.5)/scale)/4,(y+(sy+.5)/scale)/4);
    for(let i=0;i<4;i++) values[i]+=c[i]/(scale*scale);
  }
  const at=((size-1-y)*size+x)*4;
  bitmap[at]=Math.round(values[2]);bitmap[at+1]=Math.round(values[1]);bitmap[at+2]=Math.round(values[0]);bitmap[at+3]=Math.round(values[3]);
}
header.writeUInt32LE(40,0);header.writeInt32LE(size,4);header.writeInt32LE(size*2,8);header.writeUInt16LE(1,12);header.writeUInt16LE(32,14);header.writeUInt32LE(bitmap.length+mask.length,20);
directory.writeUInt16LE(1,2);directory.writeUInt16LE(1,4);directory[6]=0;directory[7]=0;directory.writeUInt16LE(1,10);directory.writeUInt16LE(32,12);directory.writeUInt32LE(header.length+bitmap.length+mask.length,14);directory.writeUInt32LE(22,18);
fs.writeFileSync(fileURLToPath(new URL('../desktop/icon.ico',import.meta.url)),Buffer.concat([directory,header,bitmap,mask]));
