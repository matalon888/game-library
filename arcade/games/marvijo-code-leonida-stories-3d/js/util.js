'use strict';
// ---------- basic helpers (3D world: x/z ground plane, y up) ----------
const T = 4;                       // tile size in meters
const TAU = Math.PI * 2;
const FLOOR_H = 3.2;               // meters per building floor
const CURB = 0.15;                 // sidewalk height
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const rnd=(a,b)=>{ if(a===undefined)return Math.random(); if(b===undefined)return Math.random()*a; return a+Math.random()*(b-a); };
const rndi=(a,b)=>Math.floor(a+Math.random()*(b-a+1));
const pick=a=>a[Math.floor(Math.random()*a.length)];
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const dist=(x1,z1,x2,z2)=>Math.hypot(x2-x1,z2-z1);
function wrapAng(a){ a%=TAU; if(a>Math.PI)a-=TAU; else if(a<-Math.PI)a+=TAU; return a; }
const angTo=(x1,z1,x2,z2)=>Math.atan2(z2-z1,x2-x1);
function turnToward(a,target,maxStep){ const d=wrapAng(target-a); return Math.abs(d)<=maxStep? target : a+Math.sign(d)*maxStep; }
function hash2(x,y){ let h=(x|0)*374761393+(y|0)*668265263; h=(h^(h>>>13))*1274126177; h=h^(h>>>16); return (h>>>0)/4294967296; }
function fmtMoney(n){ return (n<0?'-$':'$')+Math.floor(Math.abs(n)).toLocaleString('en-US'); }
function fmtTime(s){ s=Math.max(0,Math.ceil(s)); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); }
function rectsOverlap(ax0,ay0,ax1,ay1,bx0,by0,bx1,by1){ return !(ax1<bx0||bx1<ax0||ay1<by0||by1<ay0); }
function hsv(h,s,v){ const i=Math.floor(h*6), f=h*6-i, p=v*(1-s), q=v*(1-f*s), t=v*(1-(1-f)*s); let r,g,b;
  switch(i%6){case 0:r=v;g=t;b=p;break;case 1:r=q;g=v;b=p;break;case 2:r=p;g=v;b=t;break;case 3:r=p;g=q;b=v;break;case 4:r=t;g=p;b=v;break;default:r=v;g=p;b=q;}
  return [r*255|0,g*255|0,b*255|0]; }
const col3=(c,f=1)=>new THREE.Color(clamp(c[0]*f/255,0,1),clamp(c[1]*f/255,0,1),clamp(c[2]*f/255,0,1));
const cssRgb=(c)=>`rgb(${c[0]|0},${c[1]|0},${c[2]|0})`;
// smooth damping helper (critically damped-ish)
const damp=(cur,target,rate,dt)=>cur+(target-cur)*(1-Math.exp(-rate*dt));
// Pacejka-style tyre curve: peaks at 1, falls to sin(C*pi/2) when sliding
const tyreCurve=(s,B,C)=>Math.sin(C*Math.atan(B*s));
