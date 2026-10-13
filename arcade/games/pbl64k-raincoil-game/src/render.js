import { W, H, COLORS } from './engine.js';
const CELL = 30;
export class Renderer {
  constructor(canvas) { this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false }); this.particles = []; this.rings = []; this.labels = []; this.shake = 0; this.flash = 0; this.reduced = false; }
  effect(e) {
    if (e.type === 'skin_clear') e = { ...e, type: 'clear' };
    else if (e.type === 'skin_catch' || e.type === 'skin_create') e = { ...e, type: 'catch' };
    const color = COLORS[e.color] || '#e3f67b', x = (e.x + .5) * CELL, y = (e.y + .5) * CELL;
    const count = e.type === 'clear' ? 28 : e.type === 'hit' ? 22 : e.type === 'shed' ? 28 : e.type === 'catch' ? 8 : e.type === 'miss' ? 3 : 0;
    if (!this.reduced) for (let i = 0; i < count; i++) { const a = Math.random() * Math.PI * 2, v = 25 + Math.random() * (e.type === 'clear' ? 150 : 90); this.particles.push({x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: .35 + Math.random() * .4, max: .75, color: e.type === 'hit' ? '#ff7b70' : color, size: Math.random() * 3 + 1}); }
    if (['clear', 'shed', 'hit', 'catch'].includes(e.type)) this.rings.push({x, y, r: e.type === 'clear' ? 95 : e.type === 'shed' ? 80 : 27, age: 0, color: e.type === 'hit' ? '#ff7b70' : color});
    if (e.type === 'clear') { this.labels.push({x:Math.max(45,Math.min(W*CELL-45,x)), y, text: `+${e.points}`, life: 1.1, color}); this.shake = 4;
      for (const p of (e.positions || []).filter((_,i)=>i%2===0)) this.rings.push({x:(p.x+.5)*CELL,y:(p.y+.5)*CELL,r:35,age:0,color});
    }
    if (e.type === 'hit') { this.shake = 10; this.flash = .35; }
    if (e.type === 'shed') this.shake = 5;
    this.particles = this.particles.slice(-250);
  }
  glyph(x,y,color,size=3.5) {
    const c = this.ctx; c.fillStyle = '#12232bc9'; c.strokeStyle = '#12232bc9'; c.lineWidth = 2;
    if (color === 0) { c.beginPath(); c.arc(x,y,size,0,Math.PI*2); c.fill(); }
    if (color === 1) { c.beginPath(); c.moveTo(x,y-size-1); c.lineTo(x+size+1,y); c.lineTo(x,y+size+1); c.lineTo(x-size-1,y); c.closePath(); c.fill(); }
    if (color === 2) { c.beginPath(); c.moveTo(x-size-1,y); c.lineTo(x+size+1,y); c.stroke(); }
  }
  draw(g, dt, elapsed, { demo = false } = {}) {
    const c = this.ctx, width = W * CELL, height = H * CELL;
    c.fillStyle = '#0d1920'; c.fillRect(0,0,width,height);
    c.save();
    if (!this.reduced && this.shake > .1) c.translate((Math.random()-.5)*this.shake,(Math.random()-.5)*this.shake);
    this.shake *= Math.exp(-dt*14);
    // Quiet drafting grid, with slightly brighter intersections every four cells.
    c.strokeStyle = '#314a531f'; c.lineWidth = 1; c.beginPath();
    for(let x=0;x<=W;x++){c.moveTo(x*CELL+.5,0);c.lineTo(x*CELL+.5,height);}
    for(let y=0;y<=H;y++){c.moveTo(0,y*CELL+.5);c.lineTo(width,y*CELL+.5);}c.stroke();
    c.fillStyle='#48616a50';for(let x=2;x<W;x+=4)for(let y=2;y<H;y+=4)c.fillRect(x*CELL-1,y*CELL-1,2,2);
    // Chamber edge tickmarks and a striped catch tray.
    c.strokeStyle='#61767a65';c.lineWidth=2;c.beginPath();for(let y=2;y<H;y+=3){c.moveTo(0,y*CELL);c.lineTo(4,y*CELL);c.moveTo(width-4,y*CELL);c.lineTo(width,y*CELL);}c.stroke();
    c.fillStyle='#36464b';for(let x=0;x<W;x++){c.save();c.translate(x*CELL,height-3);c.transform(1,0,-.6,1,0,0);c.fillRect(0,0,13,3);c.restore();}
    // Forecasts mark actual columns; stacked numbers keep Echo's three returns legible.
    const stacks = new Map();
    for (const note of g.forecast || []) {
      const x=(note.x+.5)*CELL,col=COLORS[note.color],stack=stacks.get(note.x)||0;
      stacks.set(note.x,stack+1);
      c.fillStyle=col+'0b';c.fillRect(x-12,0,24,height);
      c.strokeStyle=col+'45';c.lineWidth=1;c.setLineDash([2,7]);c.beginPath();c.moveTo(x,65);c.lineTo(x,height);c.stroke();c.setLineDash([]);
      const y=14+stack*23;c.fillStyle='#12232b';c.beginPath();c.arc(x,y,10,0,Math.PI*2);c.fill();
      c.strokeStyle=col;c.lineWidth=1.5;c.beginPath();c.arc(x,y,10,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.max(.03,1-Math.min(1,note.eta/2.7)));c.stroke();
      c.fillStyle=col;c.font='bold 11px monospace';c.textAlign='center';c.textBaseline='middle';c.fillText(String(note.index+1),x,y);
    }
    c.textBaseline='alphabetic';
    const debris = g.debris || [];
    for (const p of debris) {
      const x=p.x*CELL,y=p.y*CELL; const col=COLORS[p.color];
      c.fillStyle='#0005';c.fillRect(x+3,y+5,26,25);
      c.fillStyle='#293b43';c.beginPath();c.moveTo(x+5,y+2);c.lineTo(x+24,y+2);c.lineTo(x+28,y+7);c.lineTo(x+28,y+26);c.lineTo(x+4,y+27);c.lineTo(x+2,y+21);c.lineTo(x+2,y+7);c.closePath();c.fill();
      c.strokeStyle=col+'60';c.lineWidth=1;c.stroke();c.fillStyle=col+'90';c.fillRect(x+7,y+5,15,2);
      c.strokeStyle='#6c818670';c.beginPath();c.moveTo(x+7,y+17);c.lineTo(x+13,y+12);c.lineTo(x+17,y+18);c.lineTo(x+24,y+11);c.stroke();
    }
    // Shed skins are hollow, angular links, with no face. Ghosts have dashed outlines.
    for (const skin of g.skins || []) {
      const ghost=skin.arming>0;c.globalAlpha=ghost?.45:1;c.lineWidth=4;c.strokeStyle='#b3d4cd77';
      c.setLineDash([3,4]);c.beginPath();skin.cells.forEach((p,i)=>{const x=(p.x+.5)*CELL,y=(p.y+.5)*CELL;if(i)c.lineTo(x,y);else c.moveTo(x,y);});c.stroke();
      for(const p of skin.cells){const x=(p.x+.5)*CELL,y=(p.y+.5)*CELL,col=COLORS[p.color]||'#78979b';
        c.setLineDash(ghost?[4,3]:[]);c.fillStyle='#11262d';c.strokeStyle=col;c.lineWidth=2;
        c.beginPath();c.moveTo(x-7,y-12);c.lineTo(x+7,y-12);c.lineTo(x+12,y-7);c.lineTo(x+12,y+7);c.lineTo(x+7,y+12);c.lineTo(x-7,y+12);c.lineTo(x-12,y+7);c.lineTo(x-12,y-7);c.closePath();c.fill();c.stroke();
        c.setLineDash([]);c.fillStyle=col;c.beginPath();c.arc(x,y,6,0,Math.PI*2);c.fill();
        if(p.color>=0)this.glyph(x,y,p.color,2.5);else{c.strokeStyle='#132a30';c.lineWidth=2;c.beginPath();c.moveTo(x-3,y);c.lineTo(x+3,y);c.stroke();}
      }
      const first=skin.cells[0];if(first){c.fillStyle='#d8eada';c.font='8px monospace';c.textAlign='center';c.fillText(ghost?'GHOST':'SKIN',Math.max(18,Math.min(width-18,(first.x+.5)*CELL)),first.y*CELL-4);}
      c.globalAlpha=1;c.setLineDash([]);
    }
    for (const d of g.drops || []) {
      const x=(d.x+.5)*CELL, y=(d.y+.5)*CELL, col=COLORS[d.color];
      if(d.warning>0){
        c.fillStyle=col+'0d';c.fillRect(x-13,0,26,height);
        c.fillStyle=col;c.globalAlpha=this.reduced?1:.6+.4*Math.sin(elapsed*12);c.beginPath();c.moveTo(x-7,5);c.lineTo(x+7,5);c.lineTo(x,13);c.closePath();c.fill();c.globalAlpha=1;
        c.fillStyle=col+'30';c.fillRect(x-8,18,16,2);c.fillStyle=col;c.fillRect(x-8,18,16*(1-Math.min(1,d.warning/.7)),2);
      } else {
        const grad=c.createLinearGradient(x,y-42,x,y);grad.addColorStop(0,col+'00');grad.addColorStop(1,col+'55');c.fillStyle=grad;c.fillRect(x-3,y-42,6,40);
        c.shadowColor=col;c.shadowBlur=this.reduced?0:13;c.fillStyle=col;c.beginPath();c.moveTo(x,y-13);c.bezierCurveTo(x-2,y-5,x-9,y-4,x-9,y+2);c.arc(x,y+2,9,Math.PI,0,true);c.bezierCurveTo(x+9,y-4,x+2,y-5,x,y-13);c.fill();c.shadowBlur=0;
        this.glyph(x,y+2,d.color,3);
      }
    }
    const snake = g.snake || [], prev=g.previousSnake||snake;
    const t = this.reduced ? 1 : Math.max(0,Math.min(1,(g.moveAccumulator || 0)/(g.stepDuration || .155)));
    const points=snake.map((p,i)=>{const q=prev[i]||p;const close=Math.abs(q.x-p.x)+Math.abs(q.y-p.y)<=1;return {x:((close?q.x+(p.x-q.x)*t:p.x)+.5)*CELL,y:((close?q.y+(p.y-q.y)*t:p.y)+.5)*CELL,color:p.color};});
    c.globalAlpha=g.invulnerable>0&&!demo ? (this.reduced?.85:.7+Math.sin(elapsed*24)*.2):1;
    if(points.length){
      c.lineCap='round';c.lineJoin='round';c.strokeStyle='#0007';c.lineWidth=27;c.beginPath();points.forEach((p,i)=>{if(i)c.lineTo(p.x,p.y+3);else c.moveTo(p.x,p.y+3);});c.stroke();
      c.strokeStyle=g.invulnerable>0?'#b9e6d78a':'#5d858581';c.lineWidth=24;c.beginPath();points.forEach((p,i)=>{if(i)c.lineTo(p.x,p.y);else c.moveTo(p.x,p.y);});c.stroke();
      c.strokeStyle='#27474d';c.lineWidth=20;c.stroke();
      for(let i=points.length-1;i>=0;i--){
        const p=points[i],col=COLORS[p.color]||'#41676b',radius=i===points.length-1?8:11;
        c.fillStyle=col;c.beginPath();c.arc(p.x,p.y,radius,0,Math.PI*2);c.fill();
        c.strokeStyle=p.color<0?'#76a2a33d':'#ffffff40';c.lineWidth=1;c.stroke();
        if(p.color>=0)this.glyph(p.x,p.y,p.color);else {c.fillStyle='#a8ccbf35';c.beginPath();c.arc(p.x,p.y,2,0,Math.PI*2);c.fill();}
      }
      const head=points[0],dir=g.dir||{x:1,y:0};
      c.fillStyle='#ecefda';c.beginPath();c.arc(head.x,head.y,12,0,Math.PI*2);c.fill();
      if(snake[0].color>=0){c.strokeStyle=COLORS[snake[0].color];c.lineWidth=3;c.stroke();}
      const side={x:-dir.y,y:dir.x};
      c.fillStyle='#142831';for(const s of [-1,1]){const ex=head.x+dir.x*4+side.x*s*4.5,ey=head.y+dir.y*4+side.y*s*4.5;c.beginPath();c.arc(ex,ey,2.8,0,Math.PI*2);c.fill();}
      if(g.invulnerable>0){c.strokeStyle='#e3f67b88';c.lineWidth=2;c.beginPath();c.arc(head.x,head.y,19,0,Math.PI*2);c.stroke();}
    }
    c.globalAlpha=1;
    for(const r of this.rings){r.age+=dt;const t=r.age/.5;if(t>1)continue;c.globalAlpha=(1-t)*.7;c.strokeStyle=r.color;c.lineWidth=2+(1-t)*2;c.beginPath();c.arc(r.x,r.y,8+r.r*(this.reduced?.65:t),0,Math.PI*2);c.stroke();}this.rings=this.rings.filter(r=>r.age<.5);
    for(const p of this.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=60*dt;c.globalAlpha=Math.max(0,p.life/p.max);c.fillStyle=p.color;c.fillRect(p.x,p.y,p.size,p.size);}this.particles=this.particles.filter(p=>p.life>0);
    c.font='bold 19px monospace';c.textAlign='center';for(const l of this.labels){l.life-=dt;l.y-=dt*25;c.globalAlpha=Math.min(1,Math.max(0,l.life*2));c.fillStyle=l.color;c.fillText(l.text,l.x,l.y-20);}this.labels=this.labels.filter(l=>l.life>0);c.globalAlpha=1;
    if(this.flash>0){c.fillStyle=`rgba(255,90,70,${this.flash*.32})`;c.fillRect(0,0,width,height);this.flash=Math.max(0,this.flash-dt);}
    c.restore();
    // Tiny consistent grain marks replace an expensive fullscreen filter.
    c.fillStyle='#cce4dd05';for(let i=0;i<240;i++){const x=(i*137.2)%width,y=(i*83.7)%height;c.fillRect(x,y,1,1);}
  }
}
