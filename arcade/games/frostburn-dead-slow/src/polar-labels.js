/* Screen-space chart labels: bounded placement, independent of the ice grid. */
(function(root){
    'use strict';
    function create(ctx,W,H,ox,oy,scale){
        const pending=[],placed=[];
        const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
        function add(text,x,y,color='#b7d1d0',size=10,priority=1){
            x=ox+x*scale;y=oy+y*scale;
            // Off-chart objects must not acquire misleading edge labels when zoomed.
            if(x<0||x>W||y<0||y>H)return;
            pending.push({text,x,y,color,size:Math.min(12,Math.max(9,size*scale)),priority});
        }
        function draw(){
            ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
            for(const p of pending.sort((a,b)=>b.priority-a.priority)){
                ctx.font=`${p.size}px ui-monospace,monospace`;
                const w=(ctx.measureText(p.text)?.width||p.text.length*p.size*.61)+8,h=p.size+6;
                let box;
                for(const [dx,dy] of [[0,0],[0,-h],[0,h],[0,-2*h],[0,2*h],[-w/2,-h],[w/2,h],[0,-3*h],[0,3*h]]){
                    const b={x:Math.max(8,Math.min(W-8-w,p.x+dx-w/2)),y:p.y+dy-h/2,w,h};
                    if(b.x<8||b.x+w>W-8||b.y<54||b.y+h>H-36||placed.some(q=>overlap(b,q)))continue;
                    box=b;break;
                }
                // Dense secondary annotations yield to vessel/target names.
                if(!box)continue;
                placed.push(box);
                const x=box.x+w/2,y=box.y+h/2;
                if(Math.hypot(x-p.x,y-p.y)>h){
                    ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(x,y);ctx.strokeStyle=p.color;ctx.lineWidth=.5;ctx.stroke();
                }
                ctx.fillStyle=p.color;ctx.fillText(p.text,x,y);
            }
            ctx.restore();return placed;
        }
        return {add,draw};
    }
    const api={create};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.PaleReachLabels=api;
})(globalThis);
