'use strict';
// Build-time scenery only: never loaded by the browser.
const fs=require('node:fs'),path=require('node:path'),R=require('../src/rail.js');
// A thin-plate surface uses every survey point continuously. Unlike a nearest-N
// average it cannot introduce seams where the neighbour set changes. Extra
// authored heights describe the land away from the railway, not fictitious rails.
function terrain(level,net) {
    const points=[];
    const add=p=>{if(!points.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<1))points.push(p);};
    for(const edge of Object.values(net.edges)) {
        for(let s=0;s<edge.length;s+=80)add(R.at(net,edge.id,s));
        add(R.at(net,edge.id,edge.length));
    }
    for(const [x,y,z] of level.rail.terrain?.heights||[])add({x,y,z});
    const scale=Math.max(...level.world),ps=points.map(p=>({...p,x:p.x/scale,y:p.y/scale}));
    const kernel=(a,b)=>{const d=(a.x-b.x)**2+(a.y-b.y)**2;return d?d*Math.log(d)/2:0;};
    const n=ps.length,size=n+3;
    const matrix=Array.from({length:size},()=>new Float64Array(size+1));
    ps.forEach((p,i)=>{
        ps.forEach((q,j)=>matrix[i][j]=kernel(p,q));
        matrix[i][n]=matrix[n][i]=1;
        matrix[i][n+1]=matrix[n+1][i]=p.x;
        matrix[i][n+2]=matrix[n+2][i]=p.y;
        matrix[i][size]=p.z;
    });
    // Partial pivoting; all work stays in the build, never on the render thread.
    for(let k=0;k<size;k++) {
        let pivot=k;for(let i=k+1;i<size;i++)if(Math.abs(matrix[i][k])>Math.abs(matrix[pivot][k]))pivot=i;
        if(Math.abs(matrix[pivot][k])<1e-12)throw Error(`Degenerate terrain survey: ${level.id}`);
        [matrix[k],matrix[pivot]]=[matrix[pivot],matrix[k]];
        for(let i=k+1;i<size;i++) {
            const f=matrix[i][k]/matrix[k][k];
            for(let j=k+1;j<=size;j++)matrix[i][j]-=f*matrix[k][j];
        }
    }
    const weights=new Float64Array(size);
    for(let i=size-1;i>=0;i--) {
        let z=matrix[i][size];for(let j=i+1;j<size;j++)z-=matrix[i][j]*weights[j];
        weights[i]=z/matrix[i][i];
    }
    return (x,y)=>{
        const p={x:x/scale,y:y/scale};
        let z=weights[n]+weights[n+1]*p.x+weights[n+2]*p.y;
        ps.forEach((q,i)=>z+=weights[i]*kernel(p,q));return z;
    };
}
function generateLandscape(level,net) {
        const edges=Object.values(net.edges),contours=[];
        const heights=edges.flatMap(e=>e.samples.map(p=>p.z));
        const relief=Math.max(...heights)-Math.min(...heights);
        const interval=level.rail.terrain?.interval||(relief<8?1:5);
        if(relief>1) {
            const elevation=terrain(level,net);
            const nx=Math.ceil(level.world[0]/25),ny=Math.ceil(level.world[1]/25),grid=[];
            for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++) {
                const p={x:x*level.world[0]/nx,y:y*level.world[1]/ny};
                grid.push({...p,z:elevation(p.x,p.y)});
            }
            const min=Math.min(...grid.map(p=>p.z)),max=Math.max(...grid.map(p=>p.z));
            for(let z=Math.ceil((min+1e-6)/interval)*interval;z<max-1e-6;z+=interval)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++) {
                const i=y*(nx+1)+x,corners=[grid[i],grid[i+1],grid[i+nx+2],grid[i+nx+1]],crossings=[];
                corners.forEach((a,j)=>{const b=corners[(j+1)%4];if((a.z<z)===(b.z<z))return;
                    const t=(z-a.z)/(b.z-a.z);crossings.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});});
                // Resolve saddle cells from the centre height instead of joining
                // the wrong pair of branches along the cell boundary.
                if(crossings.length===4&&((corners[0].z<z)!==(elevation((corners[0].x+corners[2].x)/2,(corners[0].y+corners[2].y)/2)<z)))crossings.push(crossings.shift());
                for(let j=0;j+1<crossings.length;j+=2)contours.push([crossings[j],crossings[j+1]]);
            }
        }
        const river=level.rail.scenery!=='valley'?[]:level.rail.river?
            level.rail.river.map(([x,y])=>({x,y})):Array.from({length:45},(_,i)=>({x:i*level.world[0]/40-70,y:level.world[1]*.89+Math.sin(i*.13)*85}));
        const bridges=[];
        const cross=(a,b)=>a.x*b.y-a.y*b.x;
        for(const edge of edges) {
            if(edge.bridge)continue; // Load-rated structures already supply a deck.
            const spans=[];
            edge.samples.slice(1).forEach((b,i)=>{
                const a=edge.samples[i],v={x:b.x-a.x,y:b.y-a.y};
                river.slice(1).forEach((d,j)=>{
                    const c=river[j],w={x:d.x-c.x,y:d.y-c.y},den=cross(v,w);
                    if(Math.abs(den)<1e-8)return;
                    const delta={x:c.x-a.x,y:c.y-a.y},t=cross(delta,w)/den,u=cross(delta,v)/den;
                    if(t<0||t>1||u<0||u>1)return;
                    const s=a.s+(b.s-a.s)*t;
                    if(edge.closedFrom!==undefined&&s>=edge.closedFrom)return;
                    if((level.rail.floods||[]).some(f=>f.edge===edge.id&&s>=f.from&&s<=f.to))return;
                    const half=30*Math.hypot(v.x,v.y)*Math.hypot(w.x,w.y)/Math.abs(den)+10;
                    spans.push({edge:edge.id,from:Math.max(0,s-half),to:Math.min(edge.length,edge.closedFrom??Infinity,s+half)});
                });
            });
            spans.sort((a,b)=>a.from-b.from);
            for(const span of spans){const prev=bridges.at(-1);
                if(prev?.edge===span.edge&&span.from<=prev.to)prev.to=Math.max(prev.to,span.to);else bridges.push(span);}
        }
        return {interval,contours:contours.map(segment=>segment.flatMap(p=>[Math.round(p.x*10)/10,Math.round(p.y*10)/10])),river,bridges};
    }

function source(root=path.resolve(__dirname,'..')) {
    const levels=require(path.join(root,'src/rail-levels.js'));
    const data=Object.fromEntries(levels.map(level=>[level.id,generateLandscape(level,R.network(level.rail))]));
    return '// Generated by tools/build-rail-scenery.cjs; edit railway levels, then npm run build.\n'+
        '(function(root){\n    const data='+JSON.stringify(data)+';\n'+
        "    if(typeof module!=='undefined'&&module.exports)module.exports=data;\n"+
        "    root.RailScenery=data;\n})(typeof globalThis!=='undefined'?globalThis:this);\n";
}
function write(root=path.resolve(__dirname,'..')) {
    fs.writeFileSync(path.join(root,'src/rail-scenery.js'),source(root));
}
if(require.main===module)write();
module.exports={source,write,terrain,generateLandscape};
