'use strict';
// ---------- procedural WebAudio sound: engine (rpm based), tyres, wind, sirens, guns, radio ----------
class AudioSys{
  constructor(){ this.ctx=null; this.enabled=false; this.radio={station:0,nextNote:0,step:0}; this.stations=['RADIO OFF','VICE SYNTH FM','LEONIDA LATINO','BASS CARTEL']; this.volume=0.5; }
  init(){
    if(this.ctx) return;
    try{ this.ctx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return; }
    const c=this.ctx;
    this.master=c.createGain(); this.master.gain.value=this.volume; this.master.connect(c.destination);
    const len=c.sampleRate*2, buf=c.createBuffer(1,len,c.sampleRate), d=buf.getChannelData(0);
    for(let i=0;i<len;i++) d[i]=Math.random()*2-1; this.noise=buf;
    // engine: two detuned oscillators through a lowpass that opens with throttle
    this.engGain=c.createGain(); this.engGain.gain.value=0; this.engGain.connect(this.master);
    const ef=c.createBiquadFilter(); ef.type='lowpass'; ef.frequency.value=500; ef.Q.value=2; ef.connect(this.engGain); this.engFilter=ef;
    this.engOsc=c.createOscillator(); this.engOsc.type='sawtooth'; this.engOsc.frequency.value=60; this.engOsc.connect(ef); this.engOsc.start();
    this.engOsc2=c.createOscillator(); this.engOsc2.type='square'; this.engOsc2.frequency.value=30; const g2=c.createGain(); g2.gain.value=0.3; this.engOsc2.connect(g2); g2.connect(ef); this.engOsc2.start();
    this.engOsc3=c.createOscillator(); this.engOsc3.type='sawtooth'; this.engOsc3.frequency.value=121; const g3=c.createGain(); g3.gain.value=0.18; this.engOsc3.connect(g3); g3.connect(ef); this.engOsc3.start();
    // tyre squeal: bandpass noise
    this.skidGain=c.createGain(); this.skidGain.gain.value=0; this.skidGain.connect(this.master);
    const sf=c.createBiquadFilter(); sf.type='bandpass'; sf.frequency.value=1800; sf.Q.value=6; sf.connect(this.skidGain); const ss=c.createBufferSource(); ss.buffer=buf; ss.loop=true; ss.connect(sf); ss.start(); this.skidFilter=sf;
    // wind
    this.windGain=c.createGain(); this.windGain.gain.value=0; this.windGain.connect(this.master);
    const wf=c.createBiquadFilter(); wf.type='lowpass'; wf.frequency.value=600; wf.connect(this.windGain); const ws=c.createBufferSource(); ws.buffer=buf; ws.loop=true; ws.connect(wf); ws.start();
    // siren
    this.sirGain=c.createGain(); this.sirGain.gain.value=0; this.sirGain.connect(this.master);
    this.sirOsc=c.createOscillator(); this.sirOsc.type='triangle'; this.sirOsc.frequency.value=700; this.sirOsc.connect(this.sirGain); this.sirOsc.start();
    // helicopter rotor thump
    this.heliGain=c.createGain(); this.heliGain.gain.value=0; this.heliGain.connect(this.master);
    const hf=c.createBiquadFilter(); hf.type='lowpass'; hf.frequency.value=220; hf.connect(this.heliGain); const hs=c.createBufferSource(); hs.buffer=buf; hs.loop=true; hs.connect(hf); hs.start();
    const lfo=c.createOscillator(); lfo.type='square'; lfo.frequency.value=14; const lg=c.createGain(); lg.gain.value=0.5; lfo.connect(lg); lg.connect(this.heliGain.gain); lfo.start();
    // radio
    this.radioGain=c.createGain(); this.radioGain.gain.value=0.3; this.radioGain.connect(this.master);
    this.enabled=true; this.skidLevel=0;
  }
  resume(){ if(this.ctx&&this.ctx.state==='suspended') this.ctx.resume(); }
  setVolume(v){ this.volume=v; if(this.master) this.master.gain.value=v; }
  noiseBurst(dur,vol,freq,type='lowpass',q=1,dest){
    if(!this.enabled)return; const c=this.ctx, t=c.currentTime;
    const src=c.createBufferSource(); src.buffer=this.noise; src.loop=true;
    const f=c.createBiquadFilter(); f.type=type; f.frequency.value=freq; f.Q.value=q;
    const g=c.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    src.connect(f); f.connect(g); g.connect(dest||this.master); src.start(t); src.stop(t+dur+0.05);
  }
  tone(freq,dur,vol,type='square',slideTo,dest,delay=0){
    if(!this.enabled)return; const c=this.ctx, t=c.currentTime+delay;
    const o=c.createOscillator(); o.type=type; o.frequency.setValueAtTime(freq,t);
    if(slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1,slideTo),t+dur);
    const g=c.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    o.connect(g); g.connect(dest||this.master); o.start(t); o.stop(t+dur+0.05);
  }
  shoot(kind,vol=1){
    switch(kind){
      case 'pistol': this.noiseBurst(0.13,0.5*vol,1500); this.tone(220,0.1,0.3*vol,'square',50); break;
      case 'smg': this.noiseBurst(0.08,0.35*vol,2000); this.tone(300,0.06,0.2*vol,'square',80); break;
      case 'shotgun': this.noiseBurst(0.3,0.8*vol,900); this.tone(120,0.25,0.4*vol,'sawtooth',30); break;
      case 'rifle': this.noiseBurst(0.12,0.5*vol,2500,'bandpass',0.7); this.tone(260,0.08,0.3*vol,'square',60); break;
      case 'rocket': this.noiseBurst(0.6,0.6*vol,600); this.tone(80,0.5,0.3*vol,'sawtooth',400); break;
      default: this.tone(140,0.08,0.3*vol,'square',60);
    }
  }
  explosion(vol=1){ this.noiseBurst(1.4,1.2*vol,220); this.tone(60,0.8,0.6*vol,'sine',20); }
  hit(){ this.noiseBurst(0.06,0.35,3000,'bandpass'); }
  punch(){ this.tone(110,0.09,0.4,'square',50); this.noiseBurst(0.05,0.2,800); }
  crash(v){ this.noiseBurst(0.25,clamp(v,0.1,0.9),700); this.tone(90,0.2,0.3*clamp(v*1.5,0.2,1),'sawtooth',40); }
  pickup(){ this.tone(880,0.08,0.25,'square'); this.tone(1320,0.12,0.25,'square',undefined,undefined,0.08); }
  cash(){ this.tone(1200,0.05,0.2,'square'); this.tone(1600,0.05,0.2,'square',undefined,undefined,0.05); this.tone(2000,0.1,0.2,'square',undefined,undefined,0.1); }
  missionPass(){ [523,659,784,1046].forEach((f,i)=>this.tone(f,0.35,0.3,'triangle',undefined,undefined,i*0.14)); this.tone(1046,0.9,0.25,'triangle',undefined,undefined,0.6); }
  fail(){ [400,330,262,200].forEach((f,i)=>this.tone(f,0.3,0.3,'sawtooth',undefined,undefined,i*0.18)); }
  wanted(){ this.tone(700,0.1,0.25,'square'); this.tone(500,0.15,0.25,'square',undefined,undefined,0.1); }
  click(){ this.tone(600,0.04,0.15,'square'); }
  horn(){ this.tone(400,0.4,0.3,'sawtooth'); this.tone(504,0.4,0.2,'sawtooth'); }
  door(){ this.noiseBurst(0.08,0.3,400); this.tone(180,0.06,0.2,'square',90); }
  gearShift(){ this.noiseBurst(0.05,0.12,1200,'bandpass',2); }
  // engine follows rpm & throttle. rpmFrac: rpm/redline
  setEngine(on,rpmFrac,throttle,dt){
    if(!this.enabled)return; const target=on?0.12+throttle*0.08:0; const g=this.engGain.gain; g.value+=(target-g.value)*Math.min(1,dt*8);
    const f=(35+rpmFrac*300); this.engOsc.frequency.value=f; this.engOsc2.frequency.value=f*0.5; this.engOsc3.frequency.value=f*2.01; this.engFilter.frequency.value=250+rpmFrac*1200+throttle*900;
  }
  skid(amount,dt){ this.skidLevel=Math.max(this.skidLevel,amount); }
  updateLoops(dt,speedFrac,heliDist){
    if(!this.enabled)return; const g=this.skidGain.gain; g.value+=(this.skidLevel*0.35-g.value)*Math.min(1,dt*10); this.skidLevel*=Math.max(0,1-dt*6); this.skidFilter.frequency.value=1500+this.skidLevel*600;
    const w=this.windGain.gain; w.value+=(clamp(speedFrac,0,1)*0.25-w.value)*Math.min(1,dt*3);
    const h=this.heliGain.gain; const hv=heliDist<0?0:clamp(1-heliDist/120,0,1)*0.35; h.value+=(hv-h.value)*Math.min(1,dt*3);
  }
  setSiren(vol,time,dt){
    if(!this.enabled)return; const g=this.sirGain.gain; g.value+=(vol*0.18-g.value)*Math.min(1,dt*6);
    this.sirOsc.frequency.value=(Math.floor(time*1.6)%2===0)?660:880;
  }
  nextStation(){ this.radio.station=(this.radio.station+1)%this.stations.length; this.radio.step=0; if(this.ctx) this.radio.nextNote=this.ctx.currentTime+0.1; return this.stations[this.radio.station]; }
  updateRadio(inVehicle){
    if(!this.enabled)return; const r=this.radio; if(r.station===0||!inVehicle){ return; }
    const c=this.ctx; const now=c.currentTime; const tempo=[0,0.125,0.14,0.2][r.station];
    if(r.nextNote<now-1) r.nextNote=now;
    while(r.nextNote < now+0.25){
      const st=r.step, t=r.nextNote - now;
      const prog=[[0,3,7],[ -4,0,3],[-7,-4,0],[-5,-2,2]]; const chord=prog[Math.floor(st/16)%4];
      const base=110*Math.pow(2,chord[0]/12); const note=(semi,octave)=>base*Math.pow(2,semi/12)*Math.pow(2,octave); const g=this.radioGain;
      if(r.station===1){ if(st%2===0) this.tone(base,0.2,0.35,'sawtooth',undefined,g,t); const arpIdx=[0,1,2,1][st%4]; this.tone(note(chord[arpIdx]-chord[0],2),0.12,0.15,'square',undefined,g,t); if(st%4===2) this.noiseBurst(0.05,0.12,6000,'highpass',1,g); if(st%8===0) this.tone(60,0.25,0.5,'sine',30,g,t); }
      else if(r.station===2){ if([0,3,6,8,11,14].includes(st%16)) this.tone(90,0.15,0.5,'sine',40,g,t); if(st%2===1) this.noiseBurst(0.04,0.15,3000,'bandpass',2,g); const mel=[0,2,3,5,7,5,3,2]; if(st%2===0) this.tone(note(mel[(st/2|0)%8]-chord[0]+chord[1],2),0.18,0.18,'triangle',undefined,g,t); if(st%4===0) this.tone(base*2,0.1,0.15,'sawtooth',undefined,g,t); }
      else { if(st%4===0) this.tone(55*Math.pow(2,chord[0]/12),0.5,0.6,'sine',undefined,g,t); if(st%8===4) this.noiseBurst(0.12,0.3,1200,'lowpass',1,g); if(st%2===0) this.noiseBurst(0.03,0.1,7000,'highpass',1,g); if(st%16===8) this.tone(note(chord[2]-chord[0],1),0.4,0.2,'square',undefined,g,t); }
      r.step++; r.nextNote+=tempo;
    }
  }
}
