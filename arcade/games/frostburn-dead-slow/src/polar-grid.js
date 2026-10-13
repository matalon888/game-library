/* One hex geometry for the polar chart, ice contacts and captain navigation. */
(function(root){
    'use strict';
    function create(width,height,cell){
        // Keep the authored cell area (cell²) and thus the cost of breaking it.
        const radius=cell/Math.sqrt(3*Math.sqrt(3)/2),dx=Math.sqrt(3)*radius,dy=1.5*radius;
        const cols=Math.ceil(width/dx)+3,rows=Math.ceil(height/dy)+3,tiles=[];
        // A padded ring covers the chart edges, including staggered rows.
        for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
            const row=j-1,x=(i-1+(row&1)/2)*dx,y=row*dy;
            const poly=Array.from({length:6},(_,n)=>{const a=(n*60-90)*Math.PI/180;return {x:x+radius*Math.cos(a),y:y+radius*Math.sin(a)};});
            tiles.push({x,y,poly});
        }
        return {width,height,cell,area:cell*cell,radius,dx,dy,cols,rows,tiles};
    }
    function indexAt(g,x,y){
        if(x<0||y<0||x>g.width||y>g.height)return -1;
        const r=y/g.dy,q=x/g.dx-r/2,s=-q-r;
        let rq=Math.round(q),rr=Math.round(r);const rs=Math.round(s);
        const dq=Math.abs(rq-q),dr=Math.abs(rr-r),ds=Math.abs(rs-s);
        if(dq>dr&&dq>ds)rq=-rr-rs;else if(dr>ds)rr=-rq-rs;
        const i=rq+(rr-(rr&1))/2+1,j=rr+1;
        return j*g.cols+i;
    }
    function each(g,b,fn){
        const firstRow=Math.max(0,Math.ceil((b.minY-g.radius)/g.dy)+1),lastRow=Math.min(g.rows-1,Math.floor((b.maxY+g.radius)/g.dy)+1);
        for(let j=firstRow;j<=lastRow;j++){
            const shift=((j-1)&1)/2;
            const first=Math.max(0,Math.ceil(b.minX/g.dx-.5-shift)+1),last=Math.min(g.cols-1,Math.floor(b.maxX/g.dx+.5-shift)+1);
            for(let i=first;i<=last;i++){const k=j*g.cols+i;fn(k,g.tiles[k]);}
        }
    }
    function neighbors(g,k){
        const i=k%g.cols,j=Math.floor(k/g.cols),side=((j-1)&1)?1:-1,result=[];
        for(const [di,dj] of [[-1,0],[1,0],[0,-1],[side,-1],[0,1],[side,1]]){
            const x=i+di,y=j+dj;if(x>=0&&x<g.cols&&y>=0&&y<g.rows)result.push(y*g.cols+x);
        }
        return result;
    }
    // Authored basin and ice-margin boundaries are in metres, independently of
    // the staggered storage grid. Concave polygons allow fractured shorelines.
    function contains(region,x,y){
        if(region.poly){
            const p=region.poly;let inside=false;
            for(let i=0,j=p.length-1;i<p.length;j=i++){
                const a=p[i],b=p[j];
                if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
            }
            return inside;
        }
        if(region.rx!==undefined)return ((x-region.x)/region.rx)**2+((y-region.y)/region.ry)**2<=1;
        return x>=region.x&&x<=region.x+region.w&&y>=region.y&&y<=region.y+region.h;
    }
    const api={create,indexAt,each,neighbors,contains};
    if(typeof module!=='undefined'&&module.exports)module.exports=api;root.PaleReachGrid=api;
})(globalThis);
