import { GLYPH, SITES, EPILOGUE } from "./data.js";

/* ============================== geometry ============================== */
const COLS=12, ROWS=10, U=100, GUT=170, TOP=64;
const VW=GUT+COLS*U, VH=TOP+ROWS*U;
const COLNAME=(c)=>String.fromCharCode(65+c);
const cellY=(r)=>TOP+r*U;
const STAMINA_MAX=160, SURVEYS=3;
const MERIT_KEY=45, MERIT_FIND=22, MERIT_DMG=9;
const TOOLS={
  trowel:{power:1,cost:1,label:"Trowel"},
  pick:{power:3,cost:2,label:"Pick"},
  survey:{power:0,cost:12,label:"Magnetometer"}
};
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ============================== helpers ============================== */
function rng(seed){let a=seed>>>0;return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function shade(hex,amt){
  const n=parseInt(hex.slice(1),16);
  let r=(n>>16)&255,g=(n>>8)&255,b=n&255;
  const f=(v)=>Math.max(0,Math.min(255,Math.round(amt<0?v*(1+amt):v+(255-v)*amt)));
  return "rgb("+f(r)+","+f(g)+","+f(b)+")";
}
const pathCache={};
function pathFor(k){ if(!pathCache[k]) pathCache[k]=new Path2D(GLYPH[k]); return pathCache[k]; }
function svgGlyph(k,size,color){
  return '<svg viewBox="0 0 24 24" width="'+size+'" height="'+size+'" fill="none" stroke="'+color+
         '" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+GLYPH[k]+'"/></svg>';
}
function layerOf(r){ return Math.min(4, Math.floor(r/2)); }

/* ============================== audio ============================== */
let AC=null, NOISE=null, soundOn=true;
function audio(){
  if(!AC){
    try{
      AC=new (window.AudioContext||window.webkitAudioContext)();
      const len=Math.floor(AC.sampleRate*0.4);
      NOISE=AC.createBuffer(1,len,AC.sampleRate);
      const d=NOISE.getChannelData(0);
      for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*(1-i/len);
    }catch(e){ return null; }
  }
  if(AC.state==="suspended") AC.resume();
  return AC;
}
function sfxDig(power){
  if(!soundOn) return; const c=audio(); if(!c) return;
  try{
    const s=c.createBufferSource(); s.buffer=NOISE;
    const f=c.createBiquadFilter(); f.type="lowpass"; f.frequency.value=power>1?380:760;
    const g=c.createGain();
    g.gain.setValueAtTime(power>1?0.20:0.11,c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0008,c.currentTime+(power>1?0.24:0.15));
    s.connect(f); f.connect(g); g.connect(c.destination);
    s.start(); s.stop(c.currentTime+0.3);
  }catch(e){}
}
function sfxFind(){
  if(!soundOn) return; const c=audio(); if(!c) return;
  try{
    [660,990].forEach((hz,i)=>{
      const o=c.createOscillator(), g=c.createGain();
      o.type="triangle"; o.frequency.value=hz;
      g.gain.setValueAtTime(0.0001,c.currentTime+i*0.09);
      g.gain.exponentialRampToValueAtTime(0.10,c.currentTime+i*0.09+0.02);
      g.gain.exponentialRampToValueAtTime(0.0001,c.currentTime+i*0.09+0.7);
      o.connect(g); g.connect(c.destination);
      o.start(c.currentTime+i*0.09); o.stop(c.currentTime+i*0.09+0.75);
    });
  }catch(e){}
}
function sfxBreak(){
  if(!soundOn) return; const c=audio(); if(!c) return;
  try{
    const s=c.createBufferSource(); s.buffer=NOISE;
    const f=c.createBiquadFilter(); f.type="highpass"; f.frequency.value=1800;
    const g=c.createGain();
    g.gain.setValueAtTime(0.16,c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.3);
    s.connect(f); f.connect(g); g.connect(c.destination);
    s.start(); s.stop(c.currentTime+0.35);
  }catch(e){}
}

/* ============================== state ============================== */
const S={
  chapter:0, site:null, cells:[], stamina:STAMINA_MAX, merit:0, totalMerit:0,
  tool:"trowel", surveys:SURVEYS, found:[], keyFound:false, cursor:{r:0,c:5},
  hover:null, particles:[], seasonOver:false, lastFind:null, flash:0, completed:0
};

/* ============================== persistence ============================== */
const SAVE_KEY="dig-for-bharat/v1";
function save(){
  try{ localStorage.setItem(SAVE_KEY, JSON.stringify(
    {chapter:S.chapter,totalMerit:S.totalMerit,completed:S.completed})); }catch(e){}
}
function load(){
  try{
    const raw=localStorage.getItem(SAVE_KEY); if(!raw) return null;
    const d=JSON.parse(raw);
    if(typeof d.chapter==="number" && d.chapter>=0 && d.chapter<SITES.length) return d;
  }catch(e){}
  return null;
}

/* ============================== canvas ============================== */
const pit=document.getElementById("pit");
const ctx=pit.getContext("2d");
const back=document.createElement("canvas");
const bctx=back.getContext("2d");
let scale=1, dirty=true;
pit.style.aspectRatio=VW+" / "+VH;

function resize(){
  const w=pit.clientWidth; if(!w) return;
  const dpr=Math.min(window.devicePixelRatio||1,2);
  const pw=Math.round(w*dpr), ph=Math.round(w*(VH/VW)*dpr);
  if(pit.width!==pw||pit.height!==ph){
    pit.width=pw; pit.height=ph; back.width=pw; back.height=ph;
    scale=pw/VW; dirty=true;
  }
}

/* ---------- static layer: soil, cuts, finds, ghosts ---------- */
function drawStatic(){
  const st=S.site;
  bctx.setTransform(scale,0,0,scale,0,0);
  bctx.clearRect(0,0,VW,VH);

  /* gutter — the section drawing */
  bctx.fillStyle="#130E0A"; bctx.fillRect(0,0,GUT,VH);
  bctx.fillStyle="#171009"; bctx.fillRect(0,0,VW,TOP);
  bctx.fillStyle="#6E6152"; bctx.font="500 20px 'IBM Plex Mono',monospace";
  bctx.textBaseline="middle"; bctx.textAlign="center";
  for(let c=0;c<COLS;c++) bctx.fillText(COLNAME(c),GUT+c*U+U/2,TOP/2);
  bctx.textAlign="left";
  bctx.fillStyle="#57493A"; bctx.font="400 15px 'IBM Plex Mono',monospace";
  bctx.fillText("SECTION",16,TOP/2);
  bctx.textBaseline="top";
  for(let li=0;li<5;li++){
    const y0=TOP+li*2*U, h=2*U;
    bctx.fillStyle=shade(st.soil[li],-0.78); bctx.fillRect(0,y0,GUT,h);
    bctx.strokeStyle="rgba(255,236,210,.10)"; bctx.lineWidth=1.5;
    bctx.beginPath(); bctx.moveTo(0,y0+.75); bctx.lineTo(GUT,y0+.75); bctx.stroke();
    bctx.fillStyle="#A2937C"; bctx.font="500 34px 'IBM Plex Mono',monospace"; bctx.textBaseline="top";
    bctx.fillText(st.layers[li].n,16,y0+16);
    bctx.fillStyle="#6E6152"; bctx.font="400 16px 'IBM Plex Mono',monospace";
    bctx.fillText(st.layers[li].d,16,y0+56);
    bctx.fillStyle="#8A7C68"; bctx.font="400 17px 'IBM Plex Sans',sans-serif";
    wrapText(bctx,st.layers[li].name,16,y0+84,GUT-30,21);
  }
  bctx.strokeStyle="#3B2E21"; bctx.lineWidth=2;
  bctx.beginPath(); bctx.moveTo(GUT-1,0); bctx.lineTo(GUT-1,VH); bctx.stroke();
  bctx.beginPath(); bctx.moveTo(0,TOP-.5); bctx.lineTo(VW,TOP-.5); bctx.stroke();

  /* cells */
  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      const cell=S.cells[r][c], x=GUT+c*U, y=cellY(r), li=layerOf(r);
      if(cell.dug){
        bctx.fillStyle="#0B0806"; bctx.fillRect(x,y,U,U);
        const gr=bctx.createLinearGradient(x,y,x,y+U);
        gr.addColorStop(0,"rgba(0,0,0,.55)"); gr.addColorStop(1,"rgba(255,220,170,.045)");
        bctx.fillStyle=gr; bctx.fillRect(x,y,U,U);
        bctx.strokeStyle="rgba(255,232,200,.13)"; bctx.lineWidth=2;
        bctx.beginPath(); bctx.moveTo(x,y+1); bctx.lineTo(x+U,y+1); bctx.stroke();
      }else{
        const base=st.soil[li];
        bctx.fillStyle=base; bctx.fillRect(x,y,U,U);
        const g2=bctx.createLinearGradient(x,y,x+U,y+U);
        g2.addColorStop(0,"rgba(255,240,215,.055)"); g2.addColorStop(1,"rgba(0,0,0,.22)");
        bctx.fillStyle=g2; bctx.fillRect(x,y,U,U);
        for(const s of cell.grit){
          bctx.fillStyle=s.d?"rgba(20,12,6,.42)":"rgba(255,238,214,.19)";
          bctx.beginPath(); bctx.arc(x+s.x,y+s.y,s.r,0,6.283); bctx.fill();
        }
        const dmg=1-cell.hp/cell.max;
        if(dmg>0){
          bctx.strokeStyle="rgba(14,8,4,.55)"; bctx.lineWidth=2.6; bctx.lineCap="round";
          const n=Math.ceil(dmg*3);
          for(let i=0;i<n && i<cell.cracks.length;i++){
            const k=cell.cracks[i];
            bctx.beginPath(); bctx.moveTo(x+k.x1,y+k.y1);
            bctx.lineTo(x+k.mx,y+k.my); bctx.lineTo(x+k.x2,y+k.y2); bctx.stroke();
          }
        }
        bctx.strokeStyle="rgba(0,0,0,.30)"; bctx.lineWidth=1;
        bctx.strokeRect(x+.5,y+.5,U-1,U-1);
        if(!cell.reach){ bctx.fillStyle="rgba(6,4,2,.34)"; bctx.fillRect(x,y,U,U); }
        else if(r>0){
          bctx.strokeStyle="rgba(92,199,166,.16)"; bctx.lineWidth=2;
          bctx.beginPath(); bctx.moveTo(x+2,y+1.5); bctx.lineTo(x+U-2,y+1.5); bctx.stroke();
        }
        if(cell.ghost && cell.find!=null && !cell.lifted){
          drawGlyph(bctx,st.finds[cell.find].g,x+U/2,y+U/2,60,"#5CC7A6",0.30);
        }
      }
      if(cell.lifted && cell.find!=null){
        const f=st.finds[cell.find];
        drawGlyph(bctx,f.g,x+U/2,y+U/2,66,f.damaged?"#A24A2A":(f.key?"#E8A93C":"#D8C6A6"),1);
      }
    }
  }
  /* ground surface line */
  bctx.strokeStyle="rgba(232,169,60,.30)"; bctx.lineWidth=3;
  bctx.beginPath(); bctx.moveTo(GUT,TOP+1.5); bctx.lineTo(VW,TOP+1.5); bctx.stroke();
  dirty=false;
}
function wrapText(c,text,x,y,maxW,lh){
  const words=text.split(" "); let line="", yy=y;
  for(const w of words){
    const t=line?line+" "+w:w;
    if(c.measureText(t).width>maxW && line){ c.fillText(line,x,yy); line=w; yy+=lh; }
    else line=t;
  }
  if(line) c.fillText(line,x,yy);
}
function drawGlyph(c,key,cx,cy,size,color,alpha){
  c.save(); c.globalAlpha=alpha; c.translate(cx,cy);
  const s=size/24; c.scale(s,s); c.translate(-12,-12);
  c.strokeStyle=color; c.lineWidth=1.4; c.lineCap="round"; c.lineJoin="round"; c.fillStyle="transparent";
  c.stroke(pathFor(key)); c.restore();
}

/* ---------- dynamic layer ---------- */
let last=performance.now();
function frame(now){
  const dt=Math.min((now-last)/1000,0.05); last=now;
  if(dirty) drawStatic();
  ctx.setTransform(scale,0,0,scale,0,0);
  ctx.clearRect(0,0,VW,VH);
  ctx.drawImage(back,0,0,VW,VH);

  /* particles */
  if(!reduceMotion){
    for(let i=S.particles.length-1;i>=0;i--){
      const p=S.particles[i];
      p.life-=dt; if(p.life<=0){ S.particles.splice(i,1); continue; }
      p.vy+=1900*dt; p.x+=p.vx*dt; p.y+=p.vy*dt;
      ctx.globalAlpha=Math.max(0,p.life/p.max);
      ctx.fillStyle=p.col;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,6.283); ctx.fill();
    }
    ctx.globalAlpha=1;
  }

  /* hover + cursor */
  const h=S.hover;
  if(h && !S.seasonOver){
    const cell=S.cells[h.r][h.c], x=GUT+h.c*U, y=cellY(h.r);
    const ok=cell.reach && !cell.dug;
    ctx.strokeStyle= S.tool==="survey" ? "#E8A93C" : (ok?"#5CC7A6":"rgba(162,74,42,.75)");
    ctx.lineWidth=3; ctx.strokeRect(x+1.5,y+1.5,U-3,U-3);
    if(S.tool==="survey"){
      ctx.strokeStyle="rgba(232,169,60,.42)"; ctx.lineWidth=2; ctx.setLineDash([8,7]);
      ctx.strokeRect(GUT+(h.c-2)*U+1,cellY(h.r-2)+1,5*U-2,5*U-2); ctx.setLineDash([]);
    }
  }
  const cu=S.cursor;
  if(cu){
    ctx.strokeStyle="rgba(239,230,214,.55)"; ctx.lineWidth=2; ctx.setLineDash([5,6]);
    ctx.strokeRect(GUT+cu.c*U+4.5,cellY(cu.r)+4.5,U-9,U-9); ctx.setLineDash([]);
  }
  if(S.flash>0 && !reduceMotion){
    S.flash-=dt*2.2;
    ctx.fillStyle="rgba(232,169,60,"+Math.max(0,S.flash*0.12)+")";
    ctx.fillRect(GUT,TOP,VW-GUT,VH-TOP);
  }
  requestAnimationFrame(frame);
if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>{ dirty=true; });
}

/* ============================== game logic ============================== */
function newSite(i){
  const st=SITES[i];
  S.site=st; S.chapter=i; S.stamina=STAMINA_MAX; S.merit=0; S.tool="trowel";
  S.surveys=SURVEYS; S.found=[]; S.keyFound=false; S.seasonOver=false;
  S.lastFind=null; S.particles=[]; S.cursor={r:0,c:5}; S.hover=null;
  const rand=rng(i*7919+13);
  S.cells=[];
  for(let r=0;r<ROWS;r++){
    const row=[];
    for(let c=0;c<COLS;c++){
      const hard=st.layers[layerOf(r)].hard;
      const grit=[];
      for(let k=0;k<7;k++) grit.push({x:8+rand()*84,y:8+rand()*84,r:1.6+rand()*3.4,d:rand()>0.45});
      const cracks=[];
      for(let k=0;k<3;k++){
        const a=rand()*6.283;
        cracks.push({x1:50+Math.cos(a)*46,y1:50+Math.sin(a)*46,mx:50+(rand()-.5)*30,my:50+(rand()-.5)*30,
                     x2:50+Math.cos(a+2.4+rand())*46,y2:50+Math.sin(a+2.4+rand())*46});
      }
      row.push({hp:hard,max:hard,dug:false,reach:r===0,find:null,lifted:false,ghost:false,grit,cracks});
    }
    S.cells.push(row);
  }
  st.finds.forEach((f,idx)=>{ S.cells[f.r][f.c].find=idx; f.damaged=false; });
  dirty=true;
  renderAll(); renderBrief();
  journal("Trench "+st.code+" opened on the "+st.name+" mound. Grid pegged, section drawn, surface cleaned.",true);
  journal("Six anomalies logged in the pre-season survey. None of them are labelled.");
}

function refreshReach(){
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const cell=S.cells[r][c];
    if(cell.dug){ cell.reach=true; continue; }
    cell.reach = r===0 ||
      (r>0&&S.cells[r-1][c].dug) || (r<ROWS-1&&S.cells[r+1][c].dug) ||
      (c>0&&S.cells[r][c-1].dug) || (c<COLS-1&&S.cells[r][c+1].dug);
  }
}

function burst(r,c,color,n){
  if(reduceMotion) return;
  const x=GUT+c*U+U/2, y=cellY(r)+U/2;
  for(let i=0;i<n;i++){
    const a=-Math.PI/2+(Math.random()-.5)*2.4, sp=180+Math.random()*460;
    S.particles.push({x:x+(Math.random()-.5)*50,y:y+(Math.random()-.5)*40,
      vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,r:1.5+Math.random()*3.6,
      life:0.45+Math.random()*0.5,max:0.95,col:color});
  }
}

function strike(r,c){
  if(S.seasonOver||r<0||c<0||r>=ROWS||c>=COLS) return;
  const cell=S.cells[r][c], st=S.site;

  if(S.tool==="survey"){
    if(S.surveys<=0||S.stamina<TOOLS.survey.cost) return;
    S.stamina-=TOOLS.survey.cost; S.surveys--;
    let hits=0;
    for(let rr=Math.max(0,r-2);rr<=Math.min(ROWS-1,r+2);rr++)
      for(let cc=Math.max(0,c-2);cc<=Math.min(COLS-1,c+2);cc++){
        S.cells[rr][cc].ghost=true;
        if(S.cells[rr][cc].find!=null && !S.cells[rr][cc].lifted) hits++;
      }
    const span=COLNAME(Math.max(0,c-2))+"–"+COLNAME(Math.min(COLS-1,c+2))+
      ", layers "+ROMAN[layerOf(Math.max(0,r-2))]+"–"+ROMAN[layerOf(Math.min(ROWS-1,r+2))];
    journal(hits ? "Magnetometer over "+span+": <em>"+hits+" anomal"+(hits>1?"ies":"y")+"</em> in the block."
                 : "Magnetometer over "+span+": clean. Sterile soil is also a result — it tells you where not to spend the season.");
    S.tool="trowel"; frameEl.classList.remove("survey");
    dirty=true; renderAll(); checkStamina(); return;
  }

  if(cell.dug) return;
  if(!cell.reach){ journal("You cannot reach that. Soil has to be cut from a face that is already open — down from the surface, not in from the side."); return; }
  const t=TOOLS[S.tool];
  if(S.stamina<t.cost){ checkStamina(); return; }

  S.stamina-=t.cost;
  cell.hp-=t.power;
  sfxDig(t.power);
  burst(r,c,shade(st.soil[layerOf(r)],0.05),t.power>1?16:9);

  if(cell.hp<=0){
    cell.dug=true; cell.hp=0;
    refreshReach();
    if(cell.find!=null && !cell.lifted) lift(r,c);
  }
  dirty=true; renderAll(); checkStamina();
}

function lift(r,c){
  const cell=S.cells[r][c], st=S.site, f=st.finds[cell.find];
  cell.lifted=true;
  const brittle = f.fragile && S.tool==="pick" && Math.random()<0.30;
  f.damaged=brittle;
  S.found.push(cell.find);
  S.merit += brittle?MERIT_DMG:(f.key?MERIT_KEY:MERIT_FIND);
  S.lastFind=f;
  if(brittle){
    sfxBreak(); burst(r,c,"#A24A2A",26);
    journal("<em>"+f.nm+"</em> came up under the pick, and came up in pieces. Recorded as fragments — the layer is still good, the object is not.",true);
  }else{
    sfxFind(); burst(r,c,"#E8A93C",30); S.flash=1;
    journal("Lifted: <em>"+f.nm+"</em>, "+f.er+".",true);
  }
  if(f.key){ S.keyFound=true; journal(st.keynote,true); }
  dirty=true;
}

function checkStamina(){
  renderAll();
  if(S.stamina<TOOLS.trowel.cost && !S.seasonOver) endSeason(S.keyFound);
}

/* ============================== interface ============================== */
const ROMAN=["I","II","III","IV","V"];
const $=(id)=>document.getElementById(id);
const journalBox=$("journal");

function journal(html,big){
  const p=document.createElement("p");
  if(big) p.className="big";
  p.innerHTML=html;
  journalBox.insertBefore(p,journalBox.firstChild);
  while(journalBox.children.length>26) journalBox.removeChild(journalBox.lastChild);
}

function renderBrief(){
  const b=S.site.brief;
  $("briefBody").innerHTML =
    '<div class="who">'+b.who+'</div>'+
    '<blockquote>&ldquo;'+b.quote+'&rdquo;</blockquote>'+
    b.paras.map(p=>"<p>"+p+"</p>").join("");
  $("briefLayerCount").textContent="5 layers";
}

function renderFindCard(f){
  const card=$("findCard");
  if(!f){
    card.className="find empty";
    card.innerHTML='<div class="placeholder">Nothing lifted yet. Strike the soil to open the trench.</div>';
    return;
  }
  card.className="find";
  card.innerHTML=
    '<div class="glyphbox">'+svgGlyph(f.g,34,f.damaged?"#A24A2A":(f.key?"#E8A93C":"#EFE6D6"))+'</div>'+
    '<div class="meta"><h3 class="nm">'+f.nm+'</h3><div class="er">'+f.er+'</div>'+
    '<p class="no">'+f.no+'</p>'+
    (f.damaged?'<span class="dmg">Recovered as fragments</span>':'')+'</div>';
}

function renderCatalogue(){
  const box=$("catalogue"), st=S.site;
  box.innerHTML="";
  st.finds.forEach((f,i)=>{
    const got=S.found.indexOf(i)>=0;
    const el=document.createElement(got?"button":"div");
    el.className="cat-row"+(got?" found":" locked")+(got&&f.key?" key":"");
    if(got) el.type="button";
    el.innerHTML=
      '<span class="g">'+(got?svgGlyph(f.g,22,f.damaged?"#A24A2A":(f.key?"#E8A93C":"#A2937C")):
        '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#3B2E21" stroke-width="1.4" stroke-dasharray="3 3"><circle cx="12" cy="12" r="8"/></svg>')+'</span>'+
      '<span class="t">'+(got?'<b>'+f.nm+'</b><i>'+f.er+'</i>':'<b>Anomaly '+(i+1)+'</b><i>not yet reached</i>')+'</span>'+
      '<span class="lyr">'+(got?ROMAN[layerOf(f.r)]:"—")+'</span>';
    if(got) el.addEventListener("click",()=>renderFindCard(f));
    box.appendChild(el);
  });
  $("catCount").textContent=S.found.length+" / "+st.finds.length;
}

function renderChapters(){
  const box=$("chapters"); box.innerHTML="";
  SITES.forEach((s,i)=>{
    const d=document.createElement("div");
    d.className="chapter"+(i<S.completed?" done":"")+(i===S.chapter?" active":"");
    d.innerHTML='<span class="cn">Season '+ROMAN[i]+'</span>'+
                '<span class="cs">'+s.name+'</span>'+
                '<span class="cy">'+s.state+' &middot; from '+s.years+'</span>';
    box.appendChild(d);
  });
}

function renderGauges(){
  const st=S.site;
  $("seasonNo").textContent=ROMAN[S.chapter];
  $("trenchCode").textContent=st.code;
  $("siteName").textContent=st.name;
  $("siteState").textContent=st.state;
  $("periodLabel").textContent=st.period;
  $("staminaVal").textContent=Math.max(0,S.stamina);
  $("staminaMax").textContent=STAMINA_MAX;
  $("meritVal").textContent=S.totalMerit+S.merit;
  $("findVal").textContent=S.found.length;
  $("findMax").textContent=st.finds.length;
  const pct=Math.max(0,S.stamina)/STAMINA_MAX;
  const bar=$("staminaBar");
  bar.firstElementChild.style.width=(pct*100)+"%";
  bar.classList.toggle("low",pct<0.25);
  $("gStamina").classList.toggle("low",pct<0.25);
  $("surveyLeft").textContent=S.surveys+" left";
}

function renderTools(){
  document.querySelectorAll(".tool").forEach(b=>{
    const t=b.dataset.tool;
    b.setAttribute("aria-pressed",String(S.tool===t));
    const cost=TOOLS[t].cost;
    b.disabled = S.seasonOver || S.stamina<cost || (t==="survey"&&S.surveys<=0);
  });
  fileBtn.disabled=!(S.keyFound&&!S.seasonOver);
  fileBtn.textContent = S.keyFound ? "File season report" : "Keystone not yet found";
}

function renderAll(){
  renderGauges(); renderTools(); renderCatalogue(); renderChapters();
  if(S.lastFind) renderFindCard(S.lastFind); else renderFindCard(null);
}

/* ============================== season report ============================== */
const veil=$("veil");
function grade(m){
  if(m>=140) return "Distinction";
  if(m>=112) return "Commended";
  if(m>=70)  return "Satisfactory";
  return "Provisional";
}
let reportMode="next";
function endSeason(success){
  S.seasonOver=true;
  const st=S.site, last=S.chapter===SITES.length-1;
  const nextIdx=Math.min(S.chapter+1,SITES.length-1);
  if(success){
    S.totalMerit+=S.merit;
    S.completed=Math.max(S.completed,S.chapter+1);
    const filed=S.chapter; S.chapter=last?filed:nextIdx; save(); S.chapter=filed;
  }
  const canResume = success && S.stamina>=TOOLS.trowel.cost;

  if(success && last){
    reportMode="restart";
    $("reportKicker").textContent="Training year complete";
    $("reportTitle").textContent=EPILOGUE.title;
    $("reportSite").textContent="Five trenches · Rakhigarhi to Hampi";
    $("reportBody").innerHTML=EPILOGUE.body.map(p=>"<p>"+p+"</p>").join("");
    $("reportPrimary").textContent="Take a new licence";
    $("reportSecondary").hidden=true;
  }else if(success){
    reportMode="next";
    $("reportKicker").textContent="Season report";
    $("reportTitle").textContent="Trench "+st.code+" closed";
    $("reportSite").textContent=st.name+", "+st.state;
    $("reportBody").innerHTML="<p>"+st.close+"</p>";
    $("reportPrimary").textContent="Open trench "+SITES[nextIdx].code+" at "+SITES[nextIdx].name;
    $("reportSecondary").hidden=!canResume;
  }else{
    reportMode="retry";
    $("reportKicker").textContent="Season suspended";
    $("reportTitle").textContent="Out of season";
    $("reportSite").textContent=st.name+", "+st.state;
    $("reportBody").innerHTML="<p>The stamina is gone and the keystone deposit is still down there under "+
      st.layers[4].d.split("–")[0]+" metres of "+st.layers[4].name.toLowerCase()+
      ". The trench is backfilled to protect it and you come back with a fresh budget.</p>"+
      "<p>Next time: sink one narrow shaft to the base before you widen anything, and save the pick for the hard layers.</p>";
    $("reportPrimary").textContent="Re-open trench "+st.code;
    $("reportSecondary").hidden=true;
  }
  $("rFinds").textContent=S.found.length+" / "+st.finds.length;
  $("rMerit").textContent=S.merit;
  $("rGrade").textContent=success?grade(S.merit):"—";
  veil.hidden=false;
  $("reportPrimary").focus();
  renderTools();
}
$("reportPrimary").addEventListener("click",()=>{
  veil.hidden=true;
  if(reportMode==="restart"){ S.chapter=0; S.totalMerit=0; S.completed=0; save(); newSite(0); }
  else if(reportMode==="retry"){ newSite(S.chapter); }
  else { newSite(Math.min(S.chapter+1,SITES.length-1)); }
  pit.focus();
});
$("reportSecondary").addEventListener("click",()=>{
  veil.hidden=true; S.seasonOver=false; renderTools(); pit.focus();
});
veil.addEventListener("keydown",e=>{ if(e.key==="Escape"&&!$("reportSecondary").hidden){ $("reportSecondary").click(); }});

/* ============================== input ============================== */
const frameEl=$("trenchFrame");
function cellAt(e){
  const rect=pit.getBoundingClientRect();
  const vx=(e.clientX-rect.left)*(VW/rect.width);
  const vy=(e.clientY-rect.top)*(VH/rect.height);
  if(vx<GUT) return null;
  const c=Math.floor((vx-GUT)/U), r=Math.floor((vy-TOP)/U);
  if(r<0||c<0||r>=ROWS||c>=COLS) return null;
  return {r,c};
}
pit.addEventListener("pointermove",e=>{ S.hover=cellAt(e); });
pit.addEventListener("pointerleave",()=>{ S.hover=null; });
pit.addEventListener("pointerdown",e=>{
  const p=cellAt(e); if(!p) return;
  pit.focus(); S.cursor=p; strike(p.r,p.c);
});
pit.addEventListener("keydown",e=>{
  const k=e.key;
  if(k==="1"||k==="2"||k==="3"){ setTool(["trowel","pick","survey"][+k-1]); e.preventDefault(); return; }
  const mv={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]}[k];
  if(mv){
    S.cursor={r:Math.max(0,Math.min(ROWS-1,S.cursor.r+mv[0])),c:Math.max(0,Math.min(COLS-1,S.cursor.c+mv[1]))};
    S.hover=S.cursor; e.preventDefault(); return;
  }
  if(k==="Enter"||k===" "){ strike(S.cursor.r,S.cursor.c); e.preventDefault(); }
});
function setTool(t){
  if(S.seasonOver) return;
  if(t==="survey"&&S.surveys<=0) return;
  S.tool=t; frameEl.classList.toggle("survey",t==="survey"); renderTools();
}
document.querySelectorAll(".tool").forEach(b=>b.addEventListener("click",()=>setTool(b.dataset.tool)));

$("soundBtn").addEventListener("click",e=>{
  soundOn=!soundOn;
  e.currentTarget.textContent=soundOn?"Sound on":"Sound off";
  e.currentTarget.setAttribute("aria-pressed",String(soundOn));
  if(soundOn) sfxDig(1);
});

/* file-report button + reset, added to the hint row and ledger head */
const fileBtn=document.createElement("button");
fileBtn.className="btn ghost small filebtn"; fileBtn.type="button";
fileBtn.addEventListener("click",()=>{ if(S.keyFound&&!S.seasonOver) endSeason(true); });
document.querySelector(".hint").appendChild(fileBtn);

const resetBtn=document.createElement("button");
resetBtn.className="reset"; resetBtn.type="button"; resetBtn.textContent="Reset progress";
resetBtn.addEventListener("click",()=>{
  try{ localStorage.removeItem(SAVE_KEY); }catch(e){}
  S.totalMerit=0; S.completed=0; journalBox.innerHTML=""; newSite(0); pit.focus();
});
document.querySelector(".lh").appendChild(resetBtn);

/* ============================== boot ============================== */
if(window.ResizeObserver){ new ResizeObserver(()=>{ resize(); dirty=true; }).observe(frameEl); }
window.addEventListener("resize",()=>{ resize(); dirty=true; });

const saved=load();
if(saved){ S.chapter=saved.chapter; S.totalMerit=saved.totalMerit||0; S.completed=saved.completed||saved.chapter||0; }
resize();
newSite(S.chapter);
if(saved&&saved.chapter>0) journal("Licence resumed. "+saved.chapter+" season"+(saved.chapter>1?"s":"")+" already filed.");
requestAnimationFrame(frame);
