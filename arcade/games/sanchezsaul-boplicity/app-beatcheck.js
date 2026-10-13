(() => {
  'use strict';

  const QWERTY = { a:60, w:61, s:62, e:63, d:64, f:65, t:66, g:67, y:68, h:69, u:70, j:71, k:72 };
  const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const MIDI_MIN = 21;
  const MIDI_MAX = 108;
  const SESSION_BARS = 16;
  const SESSION_START_BEATS = 8;
  const COUNT_POSITIONS = ['0:0:0','0:2:0','1:0:0','1:1:0','1:2:0','1:3:0'];
  const COUNT_LABELS = ['1','2','1','2','3','4'];
  const DEV_TIMING = new URLSearchParams(window.location.search).has('debugTiming');
  const DEV_MODE = new URLSearchParams(window.location.search).get('dev')==='1';
  const DEV_PIANO_FAILURE = DEV_MODE&&new URLSearchParams(window.location.search).get('pianoFail')==='1';
  const LATENCY_STORAGE_KEY='boplicity-latency-ms';
  const LATENCY_OVERRIDE_PARAM = new URLSearchParams(window.location.search).get('latency');
  const LATENCY_OVERRIDE_SECONDS = LATENCY_OVERRIDE_PARAM!==null&&Number.isFinite(Number(LATENCY_OVERRIDE_PARAM))?Number(LATENCY_OVERRIDE_PARAM)/1000:null;
  const PIANO_SAMPLE_BASE_URL='https://tonejs.github.io/audio/salamander/';
  const PIANO_SAMPLE_URLS={C3:'C3.mp3','D#3':'Ds3.mp3','F#3':'Fs3.mp3',A3:'A3.mp3',C4:'C4.mp3','D#4':'Ds4.mp3','F#4':'Fs4.mp3',A4:'A4.mp3',C5:'C5.mp3'};
  const PIANO_LOAD_TIMEOUT=8000;
  const LEARN_TRANSCRIPTION_MS=4000;
  const LEARN_PROMPT_MS=4000;
  const LEARN_PREVIEW_BEAT_SECONDS=.25;
  const PEDAL_RETRY_MS=700;
  const REVIEW_COLORS={ink:'#221c18',earned:'#4d7838',unresolved:'#c34f2c',passing:'#8b8074',timefeel:'#b07d1e'};
  const FLAT_KEYS=new Set(['F','Bb','Eb','Ab','Db','Gb']),COMP_VOICING_CACHE=new Map();
  const SKILL_LIBRARY=[
    {id:'guide-tones',name:'Guide tones',teach:"The 3rd and 7th spell the chord — land them and you're already inside the harmony.",rubricStat:'guideTones',perBarTarget:1,exampleNotes:[{midi:70,bar:0,beat:0,durationBeats:.8,velocity:96},{midi:77,bar:0,beat:2,durationBeats:.8,velocity:92},{midi:76,bar:1,beat:0,durationBeats:.8,velocity:96},{midi:70,bar:1,beat:2,durationBeats:.8,velocity:92},{midi:69,bar:2,beat:0,durationBeats:.8,velocity:96},{midi:76,bar:2,beat:2,durationBeats:1.4,velocity:92}]},
    {id:'chord-tones',name:'Chord tones',teach:'Roots and 5ths give your line solid landing places while the changes move underneath you.',rubricStat:'otherChordTones',perBarTarget:1,exampleNotes:[{midi:67,bar:0,beat:0,durationBeats:.8,velocity:92},{midi:74,bar:0,beat:2,durationBeats:.8,velocity:92},{midi:72,bar:1,beat:0,durationBeats:.8,velocity:92},{midi:79,bar:1,beat:2,durationBeats:.8,velocity:92},{midi:65,bar:2,beat:0,durationBeats:.8,velocity:92},{midi:72,bar:2,beat:2,durationBeats:1.4,velocity:92}]},
    {id:'triad-arps',name:'Triad arpeggios',teach:'Three chord tones in one direction make the harmony audible before the band tells you what it is.',rubricStat:'arpeggios',perBarTarget:.5,exampleNotes:[{midi:67,bar:0,beat:0,durationBeats:.35,velocity:92},{midi:70,bar:0,beat:.62,durationBeats:.35,velocity:92},{midi:74,bar:0,beat:1,durationBeats:.8,velocity:98},{midi:72,bar:1,beat:0,durationBeats:.35,velocity:92},{midi:76,bar:1,beat:.62,durationBeats:.35,velocity:92},{midi:79,bar:1,beat:1,durationBeats:.8,velocity:98},{midi:65,bar:2,beat:0,durationBeats:.35,velocity:92},{midi:69,bar:2,beat:.62,durationBeats:.35,velocity:92},{midi:72,bar:2,beat:1,durationBeats:1.2,velocity:98}]}
  ];
  const STONES=[{id:'stone-1',name:'First Steps',skillIds:['guide-tones','chord-tones','triad-arps'],keys:['C','F','G'],targetTempo:120}];
  const STONE_COMPLIMENTS=['Yeah!',"That's hip.","Now you're speaking it.",'You found the changes.'];
  const PROGRESS_STORAGE_KEY='boplicity-progress';
  const INLINE_PROGRESSION = {
    id:'ii-v-i-f', name:'ii–V–I in F', timeSignature:[4,4],
    bars:[
      {symbol:'Gm7',root:'G2',fifth:'D3'},
      {symbol:'C7',root:'C2',fifth:'G2'},
      {symbol:'Fmaj7',root:'F2',fifth:'C3'},
      {symbol:'Fmaj7',root:'F2',fifth:'C3'}
    ]
  };
  const DEMO_MOTIFS = [
    [[.62,65],[1,62],[1.62,60],[2,58,.4,100],[2.62,57],[3,55,.65]],
    [[.62,52],[1,55],[1.62,58,.4,100],[2,61],[2.62,60,.65]],
    [[0,60],[1,58],[1.62,56],[2,57,1.5,102]],
    [[3.62,58,.75,96]],
    [[.62,55],[1,58,.3,100],[1.62,57],[2,55],[2.62,53],[3,50,.65]],
    [[.62,55],[1,53],[1.62,52,.4],[2,55],[2.62,57],[3,58,.65,100]],
    [[.62,60],[1,57],[1.62,55],[2,57,.3,100],[2.333,58,.28],[2.667,59,.28],[3,60,.65]],
    [[2,57,.4,102],[2.62,55,.3,15],[3,53,1]],
    [[.62,62],[1,65],[1.62,63],[2,62,.3,100],[2.62,60],[3,57],[3.62,58,.75,102]],
    [[.62,56],[1,55],[1.62,53],[2,52,.4,100],[2.62,50],[3,48,.65]],
    [[.62,52],[1,53],[1.62,55],[2,57,.4,100],[2.62,58],[3,60],[3.62,62]],
    [[0,60,1.5,95]],
    [[.62,62],[1,65,.3,100],[1.62,63],[2,62],[2.62,60],[3,58,.4],[3.62,57]],
    [[0,55,.4],[1,58,.4],[2,55],[2.333,56,.28],[2.667,57,.28],[3,58],[3.62,57,.75,100]],
    [[.62,60],[1,57],[1.62,55],[2,53,.4,100],[2.62,52],[3,48,.65]],
    [[.62,60],[1,58],[1.62,56],[2,57,1.8,105]]
  ];
  const DEMO_SOLO=DEMO_MOTIFS.flatMap((motif,bar)=>motif.map(([beat,midi,durationBeats=.3,velocity=90])=>({midi,bar,beat,durationBeats,velocity})));
  const state = { progression:null, progressionReady:null, toneReady:null, pianoReady:null, pianoSampler:null, cancelPianoLoad:null, vexReady:null, midiAccess:null, midiName:'', midiWasConnected:false, connectionPaused:false, held:new Set(), activeNotes:new Map(), noteSequence:0, soloNotes:[], demoMode:false, sessionKind:'play', sessionBars:SESSION_BARS, learnStone:null, learnLessonIndex:0, learnPhase:'lesson', learnRunKind:'skill', learnActiveSkill:null, learnAutoTimer:null, learnPreviewTimers:[], pedalDownAt:0, pedalLongTimer:null, pedalLongHandled:false, feel:'swing', sessionBpm:100, sessionFeel:'swing', sessionKey:'F', sessionAccidentalSide:'flat', sessionHardMode:false, sessionLatencySource:'estimated', sessionRunId:0, starting:false, listeningBack:false, listenBackLoop:null, listenBackGrooveHits:0, listenBackCursorFrame:null, listenBackCursorLine:-1, calibration:{active:false,runId:0,scheduledClicks:[],taps:[],resultMs:null}, synth:null, bass:null, ride:null, rideNoise:null, rideFilter:null, countClick:null, endChime:null, comp:null, compFilter:null, master:null, channels:{}, loop:null, countLoop:null, bar:0, beat:0, started:false, counting:false, countClicks:0, rideHits:0, bassHits:0, compHits:0, theoryState:null, eventHistory:[], timingTrace:[],lastHintBar:-4,hintPending:false,popupManager:null };
  const $ = (s) => document.querySelector(s);
  const titleScreen = $('#title-screen'), playScreen = $('#play-screen'), resultsScreen=$('#results-screen'),learnScreen=$('#learn-screen'),learnResultsScreen=$('#learn-results-screen');

  function noteName(midi) { return NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1); }

  function compVoicing(symbol){
    if(COMP_VOICING_CACHE.has(symbol))return COMP_VOICING_CACHE.get(symbol);const chord=BopTheory.createChordContext(symbol),notes=chord.tones.map(pc=>{for(let midi=55;midi<=75;midi++)if(midi%12===pc)return midi;return 60+pc;}).sort((a,b)=>a-b).map(noteName);COMP_VOICING_CACHE.set(symbol,notes);return notes;
  }

  function savedLatencySeconds(){
    try{const stored=localStorage.getItem(LATENCY_STORAGE_KEY);if(stored===null)return null;const value=Number(stored);return Number.isFinite(value)?value/1000:null;}catch(error){return null;}
  }

  function hardwareLatencyEstimateSeconds(){
    if(!window.Tone||typeof Tone.getContext!=='function')return 0;
    const toneContext=Tone.getContext(),rawContext=toneContext?.rawContext||toneContext?._context||toneContext;
    const lookAhead=Number(toneContext?.lookAhead),outputLatency=Number(rawContext?.outputLatency),baseLatency=Number(rawContext?.baseLatency);
    return Math.max(0,(Number.isFinite(lookAhead)?lookAhead:0)+(Number.isFinite(outputLatency)?outputLatency:0)+(Number.isFinite(baseLatency)?baseLatency:0));
  }

  function activeLatencyCompensation(){
    if(LATENCY_OVERRIDE_SECONDS!==null)return{seconds:LATENCY_OVERRIDE_SECONDS,source:'url'};
    const saved=savedLatencySeconds();if(saved!==null)return{seconds:saved,source:'calibrated'};
    return{seconds:hardwareLatencyEstimateSeconds(),source:'estimated'};
  }

  function latencyCompensationSeconds(){
    return activeLatencyCompensation().seconds;
  }

  function updateLatencyHud(){
    const active=activeLatencyCompensation(),milliseconds=active.seconds*1000,hud=$('.score-hud');
    hud.dataset.latencyCompMs=String(Number(milliseconds.toFixed(1)));hud.dataset.latencySource=active.source;
    return active.seconds;
  }

  function updateFirstRunCalibrationInvite(){
    const invite=$('#first-run-calibration-invite');if(!invite)return;
    invite.hidden=LATENCY_OVERRIDE_SECONDS!==null||savedLatencySeconds()!==null;
  }

  function transportSecondsForEvent(eventTimeStamp){
    const nowStamp=typeof performance!=='undefined'?performance.now():NaN,eventStamp=Number(eventTimeStamp),transportNow=window.Tone?Number(Tone.Transport.seconds):0;
    if(!Number.isFinite(nowStamp)||!Number.isFinite(eventStamp)||!Number.isFinite(transportNow))return Math.max(0,transportNow||0);
    return Math.max(0,transportNow-Math.max(0,(nowStamp-eventStamp)/1000));
  }

  function buildPiano() {
    const piano = $('#piano');
    const whiteNotes = [48,50,52,53,55,57,59,60,62,64,65,67,69,71,72];
    const blackNotes = [49,51,54,56,58,61,63,66,68,70];
    const labels = Object.fromEntries(Object.entries(QWERTY).map(([key,note]) => [note,key.toUpperCase()]));
    whiteNotes.forEach((note) => {
      const key = document.createElement('div'); key.className='white-key'; key.dataset.note=note;
      if (labels[note]) key.innerHTML=`<span class="key-label">${labels[note]}</span>`;
      piano.appendChild(key);
    });
    const whiteIndex = Object.fromEntries(whiteNotes.map((n,i)=>[n,i]));
    blackNotes.forEach((note) => {
      const prior = note - 1; const pos = ((whiteIndex[prior] + 1) / whiteNotes.length) * 100;
      const key = document.createElement('div'); key.className='black-key'; key.dataset.note=note; key.style.left=`${pos}%`;
      if (labels[note]) key.innerHTML=`<span class="key-label">${labels[note]}</span>`;
      piano.appendChild(key);
    });
  }

  function setKey(note, on) {
    const key=document.querySelector(`[data-note="${note}"]`);
    if(!key)return;
    key.classList.toggle('active',on);
  }

  function playNote(note, on, source='qwerty', velocity=0.75, audioTime, position) {
    if (note < MIDI_MIN || note > MIDI_MAX) return;
    const token=`${source}:${note}`;
    if (on) {
      if (state.held.has(token)) return; state.held.add(token); setKey(note,true);
      if ((source==='qwerty'||source==='midi'||source==='demo') && state.synth) state.synth.triggerAttack(noteName(note), audioTime, velocity);
      if((state.started&&!state.connectionPaused)||source==='demo')scoreLiveNote(note,token,source,velocity,position);
    } else {
      state.held.delete(token);
      if (![...state.held].some(t=>t.endsWith(`:${note}`))) setKey(note,false);
      if ((source==='qwerty'||source==='midi'||source==='demo') && state.synth) state.synth.triggerRelease(noteName(note),audioTime);
      const activeId=state.activeNotes.get(token);
      if(activeId){const logged=state.soloNotes.find(item=>item.id===activeId);if(logged){const beatDuration=60/Tone.Transport.bpm.value,sessionStartTime=SESSION_START_BEATS*beatDuration,latency=(source==='midi'||source==='qwerty')?updateLatencyHud():0,rawTransportTime=Number.isFinite(position?.transportSeconds)?position.transportSeconds:Tone.Transport.seconds;logged.offTime=position?.time??Math.max(sessionStartTime,rawTransportTime-latency);}state.activeNotes.delete(token);}
    }
  }

  function renderStrip() {
    const strip=$('#measure-strip'); strip.innerHTML='';
    for(let i=-1;i<5;i++) {
      const index=(state.bar+i+state.progression.bars.length)%state.progression.bars.length;
      const el=document.createElement('div'); el.className=`measure ${i<0?'past':''} ${i===0?'current':''}`;
      el.innerHTML=`<div class="sweep"></div><span class="chord">${state.progression.bars[index].symbol}</span>${i===0?'<div class="beat-ticks"><i class="beat-tick strong"></i><i class="beat-tick"></i><i class="beat-tick strong"></i><i class="beat-tick"></i></div>':''}`;
      strip.appendChild(el);
    }
    updateBeat(0);
  }

  function updateBeat(beat) {
    state.beat=beat;
    document.querySelectorAll('.beat-tick').forEach((t,i)=>t.classList.toggle('active',i===beat));
  }

  function animateSweep() {
    if (!state.started) return;
    const pos=Tone.Transport.position.split(':');
    const percent=Math.min(100,((Number(pos[1])+Number(pos[2])/4)/4)*100);
    const sweep=document.querySelector('.measure.current .sweep'); if(sweep) sweep.style.width=`${percent}%`;
    requestAnimationFrame(animateSweep);
  }

  function setupAudio() {
    state.master=new Tone.Limiter(-1).toDestination();
    state.channels={
      ui:new Tone.Channel({volume:-1}).connect(state.master),
      ride:new Tone.Channel({volume:-5}).connect(state.master),
      bass:new Tone.Channel({volume:-16}).connect(state.master),
      comp:new Tone.Channel({volume:-18}).connect(state.master),
      player:new Tone.Channel({volume:-9}).connect(state.master)
    };
    state.synth=new Tone.PolySynth(Tone.Synth,{oscillator:{type:'triangle'},envelope:{attack:.01,decay:.12,sustain:.25,release:.4}}).connect(state.channels.player);
    document.documentElement.dataset.pianoVoice='synth';
    state.countClick=new Tone.Synth({oscillator:{type:'square4'},envelope:{attack:.001,decay:.025,sustain:0,release:.015}}).connect(state.channels.ui);
    state.endChime=new Tone.Synth({volume:-18,oscillator:{type:'triangle'},envelope:{attack:.005,decay:.09,sustain:0,release:.12}}).connect(state.channels.ui);
    state.bass=new Tone.FMSynth({harmonicity:1.5,modulationIndex:1.25,oscillator:{type:'sine'},modulation:{type:'triangle'},envelope:{attack:.006,decay:.22,sustain:.12,release:.16},modulationEnvelope:{attack:.001,decay:.055,sustain:0,release:.03}}).connect(state.channels.bass);
    state.ride=new Tone.MetalSynth({frequency:500,envelope:{attack:.001,decay:.085,release:.03},harmonicity:3.1,modulationIndex:9,resonance:7200,octaves:1.15}).connect(state.channels.ride);
    state.rideFilter=new Tone.Filter({frequency:4200,type:'highpass',Q:.55}).connect(state.channels.ride);
    state.rideNoise=new Tone.NoiseSynth({noise:{type:'pink'},envelope:{attack:.001,decay:.24,sustain:0,release:.07},volume:-10}).connect(state.rideFilter);
    state.compFilter=new Tone.Filter({frequency:4600,type:'lowpass',Q:.45}).connect(state.channels.comp);
    state.comp=new Tone.PolySynth(Tone.FMSynth,{harmonicity:3.01,modulationIndex:1.7,oscillator:{type:'sine'},modulation:{type:'sine'},envelope:{attack:.008,decay:.18,sustain:.045,release:.26},modulationEnvelope:{attack:.002,decay:.09,sustain:0,release:.07}}).connect(state.compFilter);
    document.documentElement.dataset.bandSource='synthesis';document.documentElement.dataset.bassVoice='upright-fm';document.documentElement.dataset.rideVoice='ping-wash';document.documentElement.dataset.compVoice='rhodes-fm';document.documentElement.dataset.bandFallback='ready';
    Tone.Transport.bpm.value=Number($('#bpm-select').value); Tone.Transport.swing=state.feel==='swing'?.62:0; Tone.Transport.swingSubdivision='8n';
  }

  function preloadPiano(){
    if(state.pianoReady)return state.pianoReady;
    if(!state.master)setupAudio();
    if(DEV_PIANO_FAILURE){document.documentElement.dataset.pianoVoice='synth';document.documentElement.dataset.pianoSamples='fallback';state.pianoReady=Promise.resolve('synth');return state.pianoReady;}
    document.documentElement.dataset.pianoSamples='loading';
    state.pianoReady=new Promise((resolve)=>{
      let settled=false,sampler=null;
      const finish=(voice)=>{
        if(settled)return;settled=true;
        if(voice==='sampled'&&sampler){const fallback=state.synth;state.synth=sampler;state.pianoSampler=null;if(fallback){fallback.releaseAll();fallback.dispose();}}
        else if(sampler){sampler.dispose();state.pianoSampler=null;}
        state.cancelPianoLoad=null;document.documentElement.dataset.pianoVoice=voice;document.documentElement.dataset.pianoSamples=voice==='sampled'?'ready':'fallback';resolve(voice);
      };
      try{
        sampler=new Tone.Sampler({urls:PIANO_SAMPLE_URLS,baseUrl:PIANO_SAMPLE_BASE_URL,release:1,onload:()=>finish('sampled'),onerror:()=>finish('synth')}).connect(state.channels.player);
        state.pianoSampler=sampler;state.cancelPianoLoad=()=>finish('synth');
      }catch(error){finish('synth');}
    });
    return state.pianoReady;
  }

  async function awaitPianoReady(){
    const ready=state.pianoReady||preloadPiano();let timer;
    const result=await Promise.race([ready,new Promise(resolve=>{timer=setTimeout(()=>resolve('timeout'),PIANO_LOAD_TIMEOUT);})]);clearTimeout(timer);
    if(result==='timeout'&&state.cancelPianoLoad){state.cancelPianoLoad();await ready;}
  }

  function unmuteAudio(){Object.values(state.channels).forEach(channel=>{channel.mute=false;});}

  function setAudioDiagnostics() {
    const status=$('#transport-status');
    status.dataset.audioState=Tone.getContext().state;
    status.dataset.countClicks=String(state.countClicks);
    status.dataset.rideHits=String(state.rideHits);
    status.dataset.bassHits=String(state.bassHits);
    status.dataset.compHits=String(state.compHits);
    status.dataset.routes='count+calibration+end>ui>master,ride>master,bass>master,comp>master,player>master,master>destination';
  }

  function traceTiming(label,position){
    const entry=`${label}@${position}`;state.timingTrace.push(entry);$('#transport-status').dataset.timingTrace=state.timingTrace.join('|');
    if(DEV_TIMING)console.log(`[timing] ${entry}`);
  }

  function currentNoteContext(midi,id,velocity,position,source){
    const ppq=Number(Tone.Transport.PPQ)||192,beatDuration=60/Tone.Transport.bpm.value,isLive=source==='midi'||source==='qwerty',latencySeconds=isLive?updateLatencyHud():0,latencyBeats=latencySeconds/beatDuration;
    const eventTransportSeconds=Number(position?.transportSeconds),rawTicks=Number(Tone.Transport.ticks),transportBeats=Number.isFinite(eventTransportSeconds)?eventTransportSeconds/beatDuration:rawTicks/ppq,totalBeats=transportBeats-SESSION_START_BEATS,adjustedBeats=Math.max(0,totalBeats-latencyBeats),adjustedTicks=(SESSION_START_BEATS+adjustedBeats)*ppq,sessionPosition=BopTheory.sessionPositionFromTicks(adjustedTicks,ppq,2);
    const [barValue,beatValue,sixteenthValue]=String(Tone.Transport.position).split(':').map(Number);
    const fallbackBeats=Math.max(0,((barValue||0)*4+(beatValue||0)+(sixteenthValue||0)/4)-SESSION_START_BEATS-latencyBeats);
    const tickBar=Number.isFinite(totalBeats)?sessionPosition.bar:Math.floor(fallbackBeats/4);
    const tickBeat=Number.isFinite(totalBeats)?sessionPosition.beat:fallbackBeats%4;
    const bar=position?.bar??tickBar,beat=position?.beat??tickBeat;
    const chordIndex=bar%state.progression.bars.length,nextChordIndex=(bar+1)%state.progression.bars.length;
    const midiVelocity=velocity<=1?Math.round(velocity*127):Math.round(velocity);
    const sessionStartTime=SESSION_START_BEATS*beatDuration,rawTransportTime=Number.isFinite(eventTransportSeconds)?eventTransportSeconds:Tone.Transport.seconds,time=position?.time??Math.max(sessionStartTime,rawTransportTime-latencySeconds);
    return{note:{id,midi,velocity:midiVelocity,time,bar,beat,beatDuration},chord:BopTheory.createChordContext(state.progression.bars[chordIndex].symbol,state.sessionAccidentalSide),nextChord:BopTheory.createChordContext(state.progression.bars[nextChordIndex].symbol,state.sessionAccidentalSide)};
  }

  function scoreLiveNote(midi,token,source,velocity,position){
    const id=`note-${++state.noteSequence}`;
    const context=currentNoteContext(midi,id,velocity,position,source);
    const logged={id,midi,velocity:context.note.velocity,onTime:context.note.time,offTime:null,bar:context.note.bar,beat:context.note.beat,chordSymbol:context.chord.symbol,accidentalSide:state.sessionAccidentalSide,source,tags:BopTheory.isChordTone(midi,context.chord)?['neutral-chord-tone']:[],scoringEvents:[],labels:[],tripletGroup:null};
    state.soloNotes.push(logged);state.activeNotes.set(token,id);
    const hud=$('.score-hud');hud.dataset.lastInputBeat=context.note.beat.toFixed(3);hud.dataset.lastInputBar=String(context.note.bar+1);hud.dataset.lastInputChord=context.chord.symbol;hud.dataset.lastInputMidi=String(midi);
    const result=BopTheory.processNote(state.theoryState,context.note,context.chord,{hardMode:state.sessionHardMode,nextChord:context.nextChord,feel:state.feel});
    state.theoryState=result.state;
    presentScoringEvents(result.events);
  }

  function attachScoringEvents(events){
    const labelFor=(event)=>event.type==='enclosure'?'encl':event.type==='arpeggio'?'arp':event.type==='guide-tone'?(event.degree==='3rd'?'3rd':'7th'):'';
    const guideLabeledNotes=new Set(events.filter(event=>event.type==='guide-tone'&&event.firedOn).map(event=>event.firedOn));
    const addLabel=(noteId,label)=>{const note=state.soloNotes.find(item=>item.id===noteId);if(note&&!note.labels.includes(label))note.labels.push(label);};
    for(const event of events){
      for(const id of event.noteIds||[]){const note=state.soloNotes.find(item=>item.id===id);if(!note)continue;note.tags.push(event.type);note.scoringEvents.push({...event});if(event.type==='triplet')note.tripletGroup=event.groupId;}
      if(event.type==='sus-resolution'){
        addLabel(event.sourceNoteId,'sus 4–');
        if(!guideLabeledNotes.has(event.firedOn))addLabel(event.firedOn,'3');
      }else{
        const label=labelFor(event);if(label&&event.firedOn)addLabel(event.firedOn,label);
      }
    }
  }

  function updateScoreHud(){
    if(!state.theoryState)return;
    $('#score-value').textContent=state.theoryState.arcadeScore.toLocaleString();
    $('#combo-value').textContent=`COMBO ×${state.theoryState.multiplier}`;
    const hud=$('.score-hud');hud.dataset.score=String(state.theoryState.arcadeScore);hud.dataset.baseScore=String(state.theoryState.baseScore);hud.dataset.combo=String(state.theoryState.combo);hud.dataset.eventHistory=state.eventHistory.join('|');
  }

  const POPUP_LIFETIME=1800,POPUP_MAX_WAIT=380,POPUP_LANE_LEFT=['18%','50%','82%'];

  function resetPopupManager(){
    if(state.popupManager?.timer)clearTimeout(state.popupManager.timer);
    state.popupManager={lanes:POPUP_LANE_LEFT.map(()=>0),bankLane:0,nextLane:0,queue:[],timer:null,sequence:0};
    const layer=$('#popup-layer');layer.innerHTML='';layer.dataset.overlapCount='0';layer.dataset.maxSimultaneous='0';layer.dataset.droppedPopups='0';
  }

  function popupGroups(events){
    const groups=new Map();let anonymous=0;
    for(const event of events){const trigger=event.firedOn||event.noteIds?.[event.noteIds.length-1]||`anonymous-${anonymous++}`;if(!groups.has(trigger))groups.set(trigger,{trigger,events:[]});groups.get(trigger).events.push(event);}
    return[...groups.values()].map(group=>{group.events.sort((a,b)=>(b.points||0)-(a.points||0));group.total=group.events.reduce((sum,event)=>sum+(event.points||0),0);group.value=Math.max(0,group.total);group.banked=group.events.some(event=>event.bankedPopup);return group;});
  }

  function popupTone(group){return group.total<0||group.events.some(event=>event.tone==='negative')?'negative':group.total===0&&group.events.every(event=>event.tone==='neutral')?'neutral':group.total>0?'positive':'';}
  const signedPoints=value=>`${value>0?'+':''}${value}`;

  function auditPopupOverlap(){
    if(!DEV_MODE)return;requestAnimationFrame(()=>{const cards=[...document.querySelectorAll('.event-popup:not(.hint-popup)')],rects=cards.map(card=>card.getBoundingClientRect());let overlaps=0;for(let a=0;a<rects.length;a++)for(let b=a+1;b<rects.length;b++){const x=Math.min(rects[a].right,rects[b].right)-Math.max(rects[a].left,rects[b].left),y=Math.min(rects[a].bottom,rects[b].bottom)-Math.max(rects[a].top,rects[b].top);if(x>1&&y>1)overlaps++;}const layer=$('#popup-layer');layer.dataset.overlapCount=String(Number(layer.dataset.overlapCount||0)+overlaps);layer.dataset.maxSimultaneous=String(Math.max(Number(layer.dataset.maxSimultaneous||0),cards.length));});
  }

  function spawnPopup(group,lane,banked=false){
    const manager=state.popupManager,now=performance.now(),popup=document.createElement('div');popup.className=`event-popup popup-card ${popupTone(group)}${banked?' banked-popup':''}`.trim();popup.dataset.popupId=String(++manager.sequence);popup.dataset.triggerNote=String(group.trigger);popup.dataset.eventTypes=group.events.map(event=>event.type).join(',');popup.dataset.eventCount=String(group.events.length);popup.dataset.total=String(group.total);popup.dataset.lane=banked?'bank':String(lane);
    if(!banked)popup.style.setProperty('--lane-left',POPUP_LANE_LEFT[lane]);
    group.events.forEach(event=>{const line=document.createElement('span');line.className='popup-line';line.textContent=event.label;popup.appendChild(line);});
    if(group.events.length>1){const total=document.createElement('span');total.className='popup-total';total.textContent=`${signedPoints(group.total)} total`;popup.appendChild(total);}
    $('#popup-layer').appendChild(popup);const releaseAt=now+POPUP_LIFETIME;if(banked)manager.bankLane=releaseAt;else{manager.lanes[lane]=releaseAt;manager.nextLane=(lane+1)%manager.lanes.length;}setTimeout(()=>{popup.remove();drainPopupQueue();},POPUP_LIFETIME);auditPopupOverlap();
  }

  function availablePopupLane(now){const manager=state.popupManager;for(let offset=0;offset<manager.lanes.length;offset++){const lane=(manager.nextLane+offset)%manager.lanes.length;if(manager.lanes[lane]<=now)return lane;}return-1;}

  function schedulePopupDrain(){
    const manager=state.popupManager;if(manager.timer)clearTimeout(manager.timer);if(!manager.queue.length){manager.timer=null;return;}const now=performance.now(),releases=[];if(manager.queue.some(item=>!item.group.banked))releases.push(...manager.lanes);if(manager.queue.some(item=>item.group.banked))releases.push(manager.bankLane);const nextRelease=Math.min(...releases),nextExpiry=Math.min(...manager.queue.map(item=>item.createdAt+POPUP_MAX_WAIT));manager.timer=setTimeout(()=>{manager.timer=null;drainPopupQueue();},Math.max(8,Math.min(nextRelease,nextExpiry)-now+2));
  }

  function drainPopupQueue(){
    const manager=state.popupManager;if(!manager)return;const now=performance.now(),layer=$('#popup-layer');manager.queue=manager.queue.filter(item=>{const keep=now-item.createdAt<=POPUP_MAX_WAIT;if(!keep)layer.dataset.droppedPopups=String(Number(layer.dataset.droppedPopups||0)+1);return keep;});
    for(let index=0;index<manager.queue.length;){const item=manager.queue[index],lane=item.group.banked?(manager.bankLane<=now?'bank':null):availablePopupLane(now);if(lane===null||lane===-1){index++;continue;}manager.queue.splice(index,1);spawnPopup(item.group,lane==='bank'?0:lane,lane==='bank');}
    schedulePopupDrain();
  }

  function enqueuePopup(group){
    const manager=state.popupManager||resetPopupManager()||state.popupManager,now=performance.now(),lane=group.banked?(manager.bankLane<=now?'bank':null):availablePopupLane(now);if(lane!==null&&lane!==-1){spawnPopup(group,lane==='bank'?0:lane,lane==='bank');return;}
    manager.queue.push({group,createdAt:now});if(manager.queue.length>3){let lowest=0;for(let index=1;index<manager.queue.length;index++)if(manager.queue[index].group.value<manager.queue[lowest].group.value)lowest=index;manager.queue.splice(lowest,1);$('#popup-layer').dataset.droppedPopups=String(Number($('#popup-layer').dataset.droppedPopups||0)+1);}schedulePopupDrain();
  }

  function queueDepartureHint(hint){
    if(state.hintPending||hint.bar-state.lastHintBar<4)return;state.hintPending=true;let attempts=0;
    const tryShow=()=>{if(!state.started||!playScreen.classList.contains('is-active')){state.hintPending=false;return;}if(document.querySelector('.event-popup:not(.hint-popup)')){if(attempts++<8){setTimeout(tryShow,180);return;}state.hintPending=false;return;}
      const popup=document.createElement('div');popup.className='event-popup hint-popup';popup.textContent=hint.label;popup.dataset.eventType=hint.type;$('#popup-layer').appendChild(popup);state.lastHintBar=hint.bar;state.hintPending=false;setTimeout(()=>popup.remove(),POPUP_LIFETIME);
    };tryShow();
  }

  function presentScoringEvents(events){
    attachScoringEvents(events);
    if(!events.length){updateScoreHud();return;}
    const scoringEvents=events.filter(event=>!event.hint&&!event.silent);
    if(scoringEvents.length)document.querySelectorAll('.hint-popup').forEach(popup=>popup.remove());
    for(const event of scoringEvents){state.eventHistory.push(event.label);state.eventHistory=state.eventHistory.slice(-30);}
    popupGroups(scoringEvents).forEach(enqueuePopup);
    const hint=events.find(event=>event.hint);if(hint&&scoringEvents.length===0)queueDepartureHint(hint);
    updateScoreHud();
  }

  function expireTheoryNotes(now){
    if(!state.theoryState)return;
    const result=BopTheory.advanceTime(state.theoryState,now,{hardMode:state.sessionHardMode});state.theoryState=result.state;
    if(result.events.length)Tone.Draw.schedule(()=>presentScoringEvents(result.events),Tone.now());
  }

  function showStartError(error) {
    console.error('Unable to start Boplicity audio:',error);
    state.counting=false; state.started=false;
    $('#count-in').classList.remove('visible');
    $('#count-in').setAttribute('aria-hidden','true');
    const message=!window.Tone
      ? 'AUDIO FAILED TO LOAD — CHECK YOUR CONNECTION AND RELOAD'
      : !state.progression
        ? 'PROGRESSION FAILED TO LOAD — SERVE THIS FOLDER OVER HTTP'
        : 'AUDIO COULD NOT START — CLICK PLAY AGAIN';
    $('#transport-status').textContent=message;
    $('#title-input-status').textContent=message;
    playScreen.classList.add('is-active');
    titleScreen.classList.remove('is-active');
  }

  function loadScript(url,globalName,timeoutMs=7000) {
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script'); let settled=false;
      const finish=(error)=>{if(settled)return;settled=true;clearTimeout(timer);script.onload=null;script.onerror=null;error?reject(error):resolve();};
      const timer=setTimeout(()=>{script.remove();finish(new Error(`Timed out loading ${url}`));},timeoutMs);
      script.src=url; script.async=true;
      script.onload=()=>window[globalName]?finish():finish(new Error(`${globalName} missing after loading ${url}`));
      script.onerror=()=>finish(new Error(`Failed to load ${url}`));
      document.head.appendChild(script);
    });
  }

  async function loadTone() {
    if(window.Tone)return;
    const sources=['https://unpkg.com/tone@14.8.49/build/Tone.js','https://cdn.jsdelivr.net/npm/tone@14.8.49/build/Tone.js'];
    let lastError;
    for(const source of sources){try{await loadScript(source,'Tone');return;}catch(error){lastError=error;console.warn(error.message);}}
    throw lastError||new Error('Tone.js failed to load');
  }

  async function loadVexFlow(){
    if(window.VexFlow)return window.VexFlow;
    const sources=['https://cdn.jsdelivr.net/npm/vexflow@5.0.0/build/cjs/vexflow.js','https://unpkg.com/vexflow@5.0.0/build/cjs/vexflow.js'];let lastError;
    for(const source of sources){try{await loadScript(source,'VexFlow');if(VexFlow.loadFonts){await VexFlow.loadFonts('Bravura','Academico');VexFlow.setFonts('Bravura','Academico');}return VexFlow;}catch(error){lastError=error;console.warn(error.message);}}
    throw lastError||new Error('VexFlow failed to load');
  }

  function scheduleGroove(runId) {
    let step=0;
    state.loop=Tone.Transport.scheduleRepeat((time)=>{
      if(runId!==state.sessionRunId)return;
      const stepInBar=step%8;
      const bar=Math.floor(step/8);
      if(bar>=state.sessionBars){
        Tone.Transport.stop(time);
        Tone.Draw.schedule(()=>{if(runId===state.sessionRunId)finishSession();},time);
        return;
      }
      const beat=Math.floor(stepInBar/2);
      if(stepInBar===0) {
        const next=bar%state.progression.bars.length; Tone.Draw.schedule(()=>{if(runId!==state.sessionRunId)return;if(bar===0){traceTiming('groove','2:0:0');state.counting=false;state.started=true;$('#count-in').classList.remove('visible');$('#count-in').setAttribute('aria-hidden','true');requestAnimationFrame(animateSweep);}state.bar=next;renderStrip();$('#transport-status').textContent=`BAR ${bar+1} / ${state.sessionBars} · ${state.sessionBpm} BPM`;},time);
      }
      if(stepInBar%2===0) Tone.Draw.schedule(()=>{if(runId===state.sessionRunId)updateBeat(beat);},time);
      const chord=state.progression.bars[bar%state.progression.bars.length];
      if(stepInBar===0||stepInBar===4){state.bass.triggerAttackRelease(stepInBar===0?chord.root:chord.fifth,'8n',time,.62);state.bassHits++;}
      if([0,2,3,4,6,7].includes(stepInBar)){
        const velocity=[.98,0,.68,.5,.82,0,.64,.48][stepInBar];
        state.ride.triggerAttackRelease('32n',time,velocity);
        state.rideNoise.triggerAttackRelease('64n',time,velocity*.7);
        state.rideHits++;
      }
      if(stepInBar===3||stepInBar===7){const voicing=compVoicing(chord.symbol);state.comp.triggerAttackRelease(voicing,'16n',time,.42);$('#transport-status').dataset.compVoicing=`${chord.symbol}:${voicing.join(',')}`;state.compHits++;}
      expireTheoryNotes(Tone.Transport.seconds);
      setAudioDiagnostics();
      step++;
    },'8n','2:0:0');
  }

  function scheduleDemoSolo(runId){
    const beatSeconds=60/Tone.Transport.bpm.value;
    DEMO_SOLO.forEach(({midi,bar,beat,durationBeats,velocity})=>{const at=(SESSION_START_BEATS+bar*4+beat)*beatSeconds,duration=durationBeats*beatSeconds,normalized=velocity/127;
      Tone.Transport.schedule((time)=>{if(runId===state.sessionRunId)playNote(midi,true,'demo',normalized,time,{bar,beat,time:at});},at);Tone.Transport.schedule((time)=>{if(runId===state.sessionRunId)playNote(midi,false,'demo',normalized,time,{time:at+duration});},at+duration);
    });
  }

  function updateListenBackButton(status='idle'){
    const button=$('#listen-back-button'),playing=status==='playing';
    button.textContent=playing?'STOP':'LISTEN BACK';button.setAttribute('aria-pressed',String(playing));button.disabled=!playing&&!state.soloNotes.length;
    resultsScreen.dataset.listenBackState=status;
  }

  function hideListenBackCursor(){
    if(state.listenBackCursorFrame!==null)cancelAnimationFrame(state.listenBackCursorFrame);
    state.listenBackCursorFrame=null;state.listenBackCursorLine=-1;
    const cursor=$('#playback-cursor');if(cursor){cursor.classList.remove('visible');cursor.removeAttribute('data-bar');cursor.removeAttribute('data-line');}
    resultsScreen.dataset.playbackCursor='hidden';delete resultsScreen.dataset.playbackCursorBar;delete resultsScreen.dataset.playbackCursorLine;
  }

  function animateListenBackCursor(){
    if(!state.listeningBack||!window.Tone){hideListenBackCursor();return;}
    const wrap=$('#review-chart-wrap'),chart=$('#review-chart'),cursor=$('#playback-cursor'),svg=chart?.querySelector('svg');
    if(!wrap||!cursor||!svg){state.listenBackCursorFrame=requestAnimationFrame(animateListenBackCursor);return;}
    const ppq=Number(Tone.Transport.PPQ)||192,totalBeats=Math.max(0,Tone.Transport.ticks/ppq),bar=Math.min(SESSION_BARS-1,Math.floor(totalBeats/4)),beatInBar=Math.max(0,Math.min(4,totalBeats-bar*4)),line=Math.floor(bar/4),within=bar%4;
    const viewBox=svg.viewBox?.baseVal,viewWidth=viewBox?.width||Number(chart.dataset.reviewWidth)||920,viewHeight=viewBox?.height||Number(chart.dataset.reviewHeight)||650;
    const lineHeight=Number(chart.dataset.reviewLineHeight)||150,lineYs=JSON.parse(chart.dataset.reviewLineYs||'[]'),lineTops=JSON.parse(chart.dataset.reviewLineTops||'[]'),margin=Number(chart.dataset.reviewMargin)||18,widths=JSON.parse(chart.dataset.reviewBarWidths||'[]'),xs=JSON.parse(chart.dataset.reviewBarXs||'[]'),barWidth=Number(widths[bar])||(viewWidth-margin*2)/4;
    const barX=Number(xs[bar])||(margin+within*barWidth),startX=barX+(within===0?72:10),endX=barX+barWidth-8,cursorX=startX+(endX-startX)*(beatInBar/4),staveY=Number(lineYs[line])||(30+line*lineHeight),cursorY=Math.max(4,staveY-18);
    const svgRect=svg.getBoundingClientRect(),wrapRect=wrap.getBoundingClientRect(),scaleX=svgRect.width/viewWidth,scaleY=svgRect.height/viewHeight;
    cursor.style.left=`${svgRect.left-wrapRect.left+cursorX*scaleX}px`;cursor.style.top=`${svgRect.top-wrapRect.top+cursorY*scaleY}px`;cursor.style.height=`${126*scaleY}px`;cursor.classList.add('visible');cursor.dataset.bar=String(bar+1);cursor.dataset.line=String(line+1);
    resultsScreen.dataset.playbackCursor='visible';resultsScreen.dataset.playbackCursorBar=String(bar+1);resultsScreen.dataset.playbackCursorLine=String(line+1);
    if(line!==state.listenBackCursorLine){
      state.listenBackCursorLine=line;
      const systemTop=Number(lineTops[line])||(18+line*lineHeight),lineTop=window.scrollY+svgRect.top+systemTop*scaleY,target=Math.max(0,lineTop-window.innerHeight*.28);
      window.scrollTo({top:target,behavior:'smooth'});
    }
    state.listenBackCursorFrame=requestAnimationFrame(animateListenBackCursor);
  }

  function stopListenBack(status='stopped'){
    if(window.Tone){Tone.Transport.stop();Tone.Transport.cancel();}
    state.listeningBack=false;state.listenBackLoop=null;
    hideListenBackCursor();
    if(state.synth)state.synth.releaseAll();if(state.comp)state.comp.releaseAll();if(state.bass)state.bass.triggerRelease();
    Object.values(state.channels).forEach(channel=>{channel.mute=true;});
    updateListenBackButton(status);
  }

  function scheduleListenBackGroove(){
    let step=0;
    state.listenBackLoop=Tone.Transport.scheduleRepeat((time)=>{
      if(!state.listeningBack)return;
      const stepInBar=step%8,bar=Math.floor(step/8);if(bar>=SESSION_BARS)return;
      const chord=state.progression.bars[bar%state.progression.bars.length];
      if(stepInBar===0||stepInBar===4)state.bass.triggerAttackRelease(stepInBar===0?chord.root:chord.fifth,'8n',time,.62);
      if([0,2,3,4,6,7].includes(stepInBar)){const velocity=[.98,0,.68,.5,.82,0,.64,.48][stepInBar];state.ride.triggerAttackRelease('32n',time,velocity);state.rideNoise.triggerAttackRelease('64n',time,velocity*.7);}
      if(stepInBar===3||stepInBar===7)state.comp.triggerAttackRelease(compVoicing(chord.symbol),'16n',time,.42);
      state.listenBackGrooveHits++;resultsScreen.dataset.listenBackGrooveHits=String(state.listenBackGrooveHits);step++;
    },'8n','0:0:0');
  }

  async function startListenBack(){
    if(state.listeningBack){stopListenBack();return;}
    if(!state.soloNotes.length)return;
    await Tone.start();if(!state.master)setupAudio();await awaitPianoReady();
    const bpm=state.sessionBpm||Number($('#grade-tempo').textContent)||100,beatSeconds=60/bpm,sessionOffset=SESSION_START_BEATS*beatSeconds;
    const notes=state.soloNotes.map(note=>({midi:note.midi,onTime:note.onTime,offTime:note.offTime,velocity:note.velocity}));
    Tone.Transport.stop();Tone.Transport.cancel();Tone.Transport.position='0:0:0';Tone.Transport.bpm.value=bpm;Tone.Transport.swing=state.sessionFeel==='swing'?.62:0;Tone.Transport.swingSubdivision='8n';
    unmuteAudio();state.listeningBack=true;state.listenBackGrooveHits=0;updateListenBackButton('playing');
    resultsScreen.dataset.listenBackNotes=String(notes.length);resultsScreen.dataset.listenBackGrooveHits='0';resultsScreen.dataset.listenBackBpm=String(bpm);resultsScreen.dataset.listenBackFeel=state.sessionFeel;resultsScreen.dataset.listenBackStart='0:0:0';
    scheduleListenBackGroove();
    for(const note of notes){
      const start=Math.max(0,note.onTime-sessionOffset),end=Math.max(start+.02,(Number.isFinite(note.offTime)?note.offTime:note.onTime+beatSeconds*.25)-sessionOffset),velocity=Math.max(.001,Math.min(1,note.velocity/127)),name=noteName(note.midi);
      Tone.Transport.schedule(time=>state.synth.triggerAttack(name,time,velocity),start);
      Tone.Transport.schedule(time=>state.synth.triggerRelease(name,time),end);
    }
    Tone.Transport.schedule(time=>{Tone.Transport.stop(time);Tone.Draw.schedule(()=>{if(state.listeningBack)stopListenBack('complete');},time);},`${SESSION_BARS}:0:0`);
    Tone.Transport.start('+0.1');
    hideListenBackCursor();state.listenBackCursorFrame=requestAnimationFrame(animateListenBackCursor);
  }

  function calibrationMedian(values){
    const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
  }

  function updateCalibrationEstimate(){
    const estimate=Math.round(hardwareLatencyEstimateSeconds()*1000),active=activeLatencyCompensation();
    $('#calibration-estimate').textContent=`Hardware estimate: ${estimate}ms · Active: ${Math.round(active.seconds*1000)}ms (${active.source})`;
    $('#calibration-panel').dataset.estimatedMs=String(estimate);$('#calibration-panel').dataset.activeSource=active.source;
  }

  async function openCalibration(){
    const panel=$('#calibration-panel');panel.hidden=false;panel.dataset.state='ready';$('#calibration-status').textContent='READY';$('#calibration-progress').textContent='12 steady taps';$('#calibration-copy').textContent='After one bar of count-in, tap any piano or QWERTY key with each of 12 clicks.';$('#calibration-start-button').hidden=false;$('#calibration-start-button').textContent='START';$('#calibration-save-button').hidden=true;state.calibration.resultMs=null;
    try{if(state.toneReady)await state.toneReady;if(window.Tone&&!state.master)setupAudio();updateCalibrationEstimate();}catch(error){$('#calibration-status').textContent='AUDIO UNAVAILABLE';}
  }

  function stopCalibration(close=false){
    state.calibration.active=false;state.calibration.runId++;state.calibration.scheduledClicks=[];state.calibration.taps=[];
    if(window.Tone){Tone.Transport.stop();Tone.Transport.cancel();}
    if(state.synth)state.synth.releaseAll();if(state.countClick)state.countClick.triggerRelease?.();Object.values(state.channels).forEach(channel=>{channel.mute=true;});
    if(close)$('#calibration-panel').hidden=true;
  }

  function finishCalibration(runId){
    if(runId!==state.calibration.runId)return;
    const ordered=[...state.calibration.taps].sort((a,b)=>a.inputTime-b.inputTime),valid=ordered.slice(2).filter(tap=>Math.abs(tap.offsetMs)<=250),status=$('#calibration-status');
    state.calibration.active=false;Tone.Transport.stop();Tone.Transport.cancel();Object.values(state.channels).forEach(channel=>{channel.mute=true;});
    $('#calibration-panel').dataset.capturedTaps=String(ordered.length);$('#calibration-panel').dataset.validTaps=String(valid.length);
    if(valid.length<6){state.calibration.resultMs=null;$('#calibration-panel').dataset.state='retry';status.textContent='TRY AGAIN';$('#calibration-progress').textContent='Try again — tap with every click.';$('#calibration-start-button').hidden=false;$('#calibration-start-button').textContent='TRY AGAIN';$('#calibration-save-button').hidden=true;return;}
    const result=Math.round(calibrationMedian(valid.map(tap=>tap.offsetMs)));state.calibration.resultMs=result;$('#calibration-panel').dataset.state='complete';status.textContent=`YOUR OFFSET: ${result}ms`;$('#calibration-progress').textContent=`Median of ${valid.length} valid taps`;$('#calibration-start-button').hidden=true;$('#calibration-save-button').hidden=false;$('#calibration-panel').dataset.resultMs=String(result);
  }

  function recordCalibrationTap(eventTimeStamp){
    if(!state.calibration.active||!state.calibration.scheduledClicks.length)return false;
    const inputTime=transportSecondsForEvent(eventTimeStamp);let nearest=0;
    for(let index=1;index<state.calibration.scheduledClicks.length;index++)if(Math.abs(state.calibration.scheduledClicks[index]-inputTime)<Math.abs(state.calibration.scheduledClicks[nearest]-inputTime))nearest=index;
    const offsetMs=(inputTime-state.calibration.scheduledClicks[nearest])*1000;if(Math.abs(offsetMs)>500)return true;
    const tap={clickIndex:nearest,inputTime,offsetMs},existing=state.calibration.taps.findIndex(item=>item.clickIndex===nearest);
    if(existing<0)state.calibration.taps.push(tap);else if(Math.abs(offsetMs)<Math.abs(state.calibration.taps[existing].offsetMs))state.calibration.taps[existing]=tap;
    $('#calibration-progress').textContent=`${state.calibration.taps.length} / 12 taps`;
    return true;
  }

  async function startCalibration(){
    if(!window.Tone){if(state.toneReady)await state.toneReady;if(!window.Tone)throw new Error('Tone.js did not load');}
    await Tone.start();if(!state.master)setupAudio();unmuteAudio();
    const bpm=Number($('#bpm-select').value)||100,beatSeconds=60/bpm,runId=++state.calibration.runId;
    state.calibration.active=true;state.calibration.taps=[];state.calibration.resultMs=null;state.calibration.scheduledClicks=Array.from({length:12},(_,index)=>(4+index)*beatSeconds);
    $('#calibration-start-button').hidden=true;$('#calibration-save-button').hidden=true;$('#calibration-status').textContent='COUNT IN';$('#calibration-progress').textContent='1 bar';$('#calibration-panel').dataset.state='running';
    Tone.Transport.stop();Tone.Transport.cancel();Tone.Transport.position='0:0:0';Tone.Transport.bpm.value=bpm;Tone.Transport.swing=0;
    for(let beat=0;beat<4;beat++)Tone.Transport.schedule(time=>{if(runId!==state.calibration.runId)return;state.countClick.triggerAttackRelease(beat===0?'C7':'G6','64n',time,1);Tone.Draw.schedule(()=>{$('#calibration-status').textContent='COUNT IN';$('#calibration-progress').textContent=`${beat+1} / 4`;},time);},`0:${beat}:0`);
    for(let index=0;index<12;index++){const absoluteBeat=4+index,position=`${Math.floor(absoluteBeat/4)}:${absoluteBeat%4}:0`;Tone.Transport.schedule(time=>{if(runId!==state.calibration.runId)return;state.countClick.triggerAttackRelease('G6','64n',time,1);Tone.Draw.schedule(()=>{$('#calibration-status').textContent='TAP';$('#calibration-progress').textContent=`${state.calibration.taps.length} / 12 taps`;},time);},position);}
    Tone.Transport.schedule(time=>{Tone.Draw.schedule(()=>finishCalibration(runId),time);},'4:0:0');Tone.Transport.start('+0.1');
  }

  function saveCalibration(){
    if(!Number.isFinite(state.calibration.resultMs))return;
    try{localStorage.setItem(LATENCY_STORAGE_KEY,String(state.calibration.resultMs));}catch(error){console.warn('Could not save latency calibration.',error);}
    updateLatencyHud();updateFirstRunCalibrationInvite();updateCalibrationEstimate();$('#calibration-panel').dataset.saved='true';$('#calibration-panel').hidden=true;updateInputStatus();
  }

  function stoneSkills(stone=STONES[0]){return stone.skillIds.map(id=>SKILL_LIBRARY.find(skill=>skill.id===id)).filter(Boolean);}
  function calculateStoneResult(stone,stats,barsPlayed){const subscores=stoneSkills(stone).map(skill=>({skill,score:Math.min(100,Math.round(100*Number(stats[skill.rubricStat]||0)/(skill.perBarTarget*barsPlayed)))})),stoneGrade=Math.round(subscores.reduce((sum,item)=>sum+item.score,0)/Math.max(1,subscores.length)),weakest=subscores.reduce((low,item)=>item.score<low.score?item:low,subscores[0]);return{subscores,stoneGrade,passed:stoneGrade>=80,weakest};}
  function stoneProgression(stone=STONES[0]){
    return{id:stone.id,name:`${stone.name} · ${stone.keys.join(' → ')}`,timeSignature:[4,4],bars:stone.keys.flatMap(key=>BopTheory.progressionForKey(key).bars.map(bar=>({...bar,key})))};
  }
  function readLearnProgress(){try{const value=JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY)||'{}');return value&&typeof value==='object'?value:{};}catch(_error){return{};}}
  function updateStoneClearedUI(){const stone=STONES[0],progress=readLearnProgress(),record=progress.perStone?.[stone.id],cleared=Boolean(record?.cleared),button=$('#learn-button'),badge=$('#learn-cleared-badge'),canonicalStats=Object.fromEntries(stoneSkills(stone).map(skill=>[skill.rubricStat,skill.perBarTarget*stone.keys.length*4])),canonical=calculateStoneResult(stone,canonicalStats,stone.keys.length*4);button.dataset.cleared=String(cleared);button.dataset.bestGrade=String(record?.bestGrade??0);button.dataset.skillCount=String(stoneSkills(stone).length);button.dataset.canonicalGrade=String(canonical.stoneGrade);badge.hidden=!cleared;badge.textContent=cleared?`CLEARED · BEST ${record.bestGrade}/100`:'CLEARED';}
  function saveStoneGrade(stone,grade){const progress=readLearnProgress(),previous=progress.perStone?.[stone.id]||{};progress.perStone={...(progress.perStone||{}),[stone.id]:{cleared:Boolean(previous.cleared||grade>=80),bestGrade:Math.max(Number(previous.bestGrade)||0,grade)}};try{localStorage.setItem(PROGRESS_STORAGE_KEY,JSON.stringify(progress));}catch(error){console.warn('Could not save Learn progress.',error);}updateStoneClearedUI();}

  function clearLearnAutomation(release=true){
    if(state.learnAutoTimer){clearTimeout(state.learnAutoTimer);state.learnAutoTimer=null;}state.learnPreviewTimers.forEach(clearTimeout);state.learnPreviewTimers=[];if(release)state.synth?.releaseAll();
  }
  function scheduleLearnAuto(action,delay){if(state.learnAutoTimer)clearTimeout(state.learnAutoTimer);state.learnAutoTimer=setTimeout(()=>{state.learnAutoTimer=null;action();},delay);}
  function playLearnExampleAudio(skill){
    clearLearnAutomation();if(!state.synth)return;unmuteAudio();const startDelay=120;
    skill.exampleNotes.forEach(event=>{const attackDelay=startDelay+(event.bar*4+event.beat)*LEARN_PREVIEW_BEAT_SECONDS*1000,releaseDelay=attackDelay+(event.durationBeats||.4)*LEARN_PREVIEW_BEAT_SECONDS*1000;state.learnPreviewTimers.push(setTimeout(()=>state.synth?.triggerAttack(noteName(event.midi),Tone.now(),event.velocity/127),attackDelay));state.learnPreviewTimers.push(setTimeout(()=>state.synth?.triggerRelease(noteName(event.midi),Tone.now()),releaseDelay));});
  }

  async function renderLearnExample(skill){
    const chart=$('#learn-example-chart');chart.innerHTML='<p>Preparing example…</p>';
    try{
      const progression=BopTheory.progressionForKey('F'),beatSeconds=.5,notes=skill.exampleNotes.map((event,index)=>{const chordSymbol=progression.bars[event.bar%4].symbol,chord=BopTheory.createChordContext(chordSymbol,'flat'),onTime=(SESSION_START_BEATS+event.bar*4+event.beat)*beatSeconds;return{id:`lesson-${skill.id}-${index}`,midi:event.midi,bar:event.bar,beat:event.beat,velocity:event.velocity,onTime,offTime:onTime+(event.durationBeats||.4)*beatSeconds,chordSymbol,accidentalSide:'flat',source:'lesson',tags:BopTheory.isChordTone(event.midi,chord)?['neutral-chord-tone']:[],scoringEvents:[{type:skill.id,points:1}],labels:[],tripletGroup:null};});
      await renderSoloReview({chart,notes,progression,bars:4,key:'F',beatSeconds,lesson:true,auditTarget:learnScreen});chart.dataset.skillId=skill.id;chart.dataset.noteCount=String(notes.length);chart.dataset.pitchRange=`${Math.min(...notes.map(note=>note.midi))}-${Math.max(...notes.map(note=>note.midi))}`;
    }catch(error){console.error('Unable to render Learn example:',error);chart.innerHTML='<p>Example notation could not load.</p>';}
  }

  async function showLearnLesson(index){
    const stone=state.learnStone||STONES[0],skills=stoneSkills(stone),skill=skills[index];clearLearnAutomation();state.learnLessonIndex=index;state.learnPhase='lesson';state.learnActiveSkill=skill;learnResultsScreen.classList.remove('is-active');learnScreen.classList.add('is-active');$('#learn-lesson-card').hidden=false;$('#learn-synthesis-prompt').hidden=true;$('#learn-progress-label').textContent=`SKILL ${index+1} OF ${skills.length} · LESSON`;$('#learn-skill-name').textContent=skill.name;$('#learn-skill-teach').textContent=skill.teach;$('#learn-next-button').textContent='TRY IT';$('#learn-hands-hint').textContent='Play a note or tap pedal to begin · starts automatically';const dots=$('#learn-progress-dots');dots.innerHTML='';skills.forEach((_,dotIndex)=>{const dot=document.createElement('i');dot.className=dotIndex<index?'done':dotIndex===index?'active':'';dots.appendChild(dot);});learnScreen.dataset.skillId=skill.id;learnScreen.dataset.phase='lesson';await renderLearnExample(skill);playLearnExampleAudio(skill);scheduleLearnAuto(startLearnSkillSession,LEARN_PROMPT_MS);
  }

  function showLearnSynthesisPrompt(){const stone=state.learnStone||STONES[0],skills=stoneSkills(stone),names=skills.map(skill=>skill.name);clearLearnAutomation();state.learnPhase='synthesis-prompt';state.learnActiveSkill=null;learnResultsScreen.classList.remove('is-active');learnScreen.classList.add('is-active');$('#learn-lesson-card').hidden=true;$('#learn-synthesis-prompt').hidden=false;$('#learn-progress-label').textContent='FINAL · GRADED SYNTHESIS';$('#learn-synthesis-copy').textContent=`Now put all three together — use ${names[0]}, ${names[1]}, and ${names[2]}.`;$('#learn-next-button').textContent='START FINAL SESSION';$('#learn-hands-hint').textContent='Play a note or tap pedal to begin · starts automatically';learnScreen.dataset.phase='synthesis-prompt';scheduleLearnAuto(startLearnSynthesis,LEARN_PROMPT_MS);}

  async function openLearnMode(){
    if(!window.Tone)throw new Error('Tone.js did not load');await Tone.start();if(!state.master)setupAudio();await awaitPianoReady();haltPlayback();unmuteAudio();state.learnStone=STONES[0];state.learnLessonIndex=0;state.learnPhase='lesson';state.learnRunKind='skill';state.learnActiveSkill=null;titleScreen.classList.remove('is-active');resultsScreen.classList.remove('is-active');learnResultsScreen.classList.remove('is-active');playScreen.classList.remove('is-active');learnScreen.classList.add('is-active');$('#learn-stone-title').textContent=state.learnStone.name;updateStoneClearedUI();await showLearnLesson(0);
  }

  function startLearnSkillSession(){clearLearnAutomation();state.learnRunKind='skill';state.learnActiveSkill=stoneSkills(state.learnStone||STONES[0])[state.learnLessonIndex];state.learnPhase='skill-session';state.held.clear();startGame(false,state.learnStone||STONES[0]).catch(showStartError);}
  function startLearnSynthesis(){clearLearnAutomation();state.learnRunKind='final';state.learnActiveSkill=null;state.learnPhase='final-session';state.held.clear();startGame(false,state.learnStone||STONES[0]).catch(showStartError);}

  function continueLearnAfterResult(){clearLearnAutomation();if(state.learnRunKind==='final'){stopGame();return;}const skills=stoneSkills(state.learnStone||STONES[0]);if(state.learnLessonIndex<skills.length-1)showLearnLesson(state.learnLessonIndex+1);else showLearnSynthesisPrompt();}

  function learnSkillScore(skill,stats,barsPlayed){return Math.min(100,Math.round(100*Number(stats[skill.rubricStat]||0)/(skill.perBarTarget*barsPlayed)));}

  function finishLearnSession(){
    const stone=state.learnStone||STONES[0],stats=state.theoryState.stats,isFinal=state.learnRunKind==='final';state.learnPhase=isFinal?'final-result':'skill-result';haltPlayback();playScreen.classList.remove('is-active');learnScreen.classList.remove('is-active');resultsScreen.classList.remove('is-active');learnResultsScreen.classList.add('is-active');$('#learn-results-title').textContent=stone.name;$('#learn-result-eyebrow').textContent=isFinal?'LEVEL COMPLETE':`SKILL ${state.learnLessonIndex+1} COMPLETE`;const grades=$('#stone-skill-grades');grades.innerHTML='';
    if(isFinal){const{subscores,stoneGrade,passed,weakest}=calculateStoneResult(stone,stats,state.sessionBars);$('#stone-grade-value').textContent=stoneGrade;$('#stone-result-status').textContent=passed?'LEVEL CLEARED':'KEEP SHEDDING';$('#stone-result-message').textContent=passed?STONE_COMPLIMENTS[Math.floor(Math.random()*STONE_COMPLIMENTS.length)]:'Almost there — take the weakest piece back to the shed.';subscores.forEach(item=>{const row=document.createElement('div');row.className='stone-skill-grade';row.dataset.skillId=item.skill.id;row.innerHTML=`<span>${item.skill.name}</span><strong>${item.score}</strong>`;grades.appendChild(row);});$('#stone-result-tip').textContent=passed?'You combined all three skills across C, F, and G.':`${weakest.skill.name}: ${weakest.skill.teach}`;$('#learn-result-review-eyebrow').textContent='YOUR SYNTHESIS';$('#stone-retry-button').textContent='RETRY FINAL SESSION';learnResultsScreen.dataset.passed=String(passed);learnResultsScreen.dataset.stoneGrade=String(stoneGrade);learnResultsScreen.dataset.lowestSkill=weakest.skill.id;learnResultsScreen.dataset.skillGrades=JSON.stringify(Object.fromEntries(subscores.map(item=>[item.skill.id,item.score])));if(passed)saveStoneGrade(stone,stoneGrade);
    }else{const skill=state.learnActiveSkill||stoneSkills(stone)[state.learnLessonIndex],score=learnSkillScore(skill,stats,state.sessionBars),count=Number(stats[skill.rubricStat]||0);$('#stone-grade-value').textContent=score;$('#stone-result-status').textContent='TRY IT COMPLETE';$('#stone-result-message').textContent=`${skill.name}: ${count} across ${state.sessionBars} bars`;const row=document.createElement('div');row.className='stone-skill-grade';row.dataset.skillId=skill.id;row.innerHTML=`<span>${skill.name}</span><strong>${score}</strong>`;grades.appendChild(row);$('#stone-result-tip').textContent=skill.teach;$('#learn-result-review-eyebrow').textContent=`YOUR ${skill.name.toUpperCase()} TAKE`;$('#stone-retry-button').textContent='CONTINUE';learnResultsScreen.dataset.passed='';learnResultsScreen.dataset.stoneGrade=String(score);learnResultsScreen.dataset.lowestSkill=skill.id;learnResultsScreen.dataset.skillGrades=JSON.stringify({[skill.id]:score});}
    learnResultsScreen.dataset.runKind=state.learnRunKind;$('#learn-result-hands-hint').textContent=isFinal?'Tap pedal to finish · hold to retry':'Tap pedal to continue · hold to retry · continuing automatically';Promise.resolve(renderSoloReview({chart:$('#learn-result-review-chart'),notes:state.soloNotes,progression:state.progression,bars:state.sessionBars,key:'F',beatSeconds:60/state.sessionBpm,lesson:true,auditTarget:learnResultsScreen})).then(()=>{if(!isFinal&&state.learnPhase==='skill-result'&&learnResultsScreen.classList.contains('is-active'))scheduleLearnAuto(continueLearnAfterResult,LEARN_TRANSCRIPTION_MS);});
  }

  async function startGame(demoMode=false,learnStone=null) {
    if(state.calibration.active)stopCalibration(true);else $('#calibration-panel').hidden=true;
    if(state.listeningBack)stopListenBack();
    if(state.starting){if(window.Tone)Tone.start().catch(()=>{});return;}
    if(state.counting||state.started)return;
    state.starting=true;
    try{
      if (!window.Tone) throw new Error('Tone.js did not load from either CDN');
      // This must be the first await: AudioContext resume stays inside the click gesture.
      await Tone.start();
      if (state.progressionReady) await state.progressionReady;
      if (!state.progression) throw new Error('progression.json is unavailable');
      if(!state.master)setupAudio();
      await awaitPianoReady();
      state.sessionKind=learnStone?'learn':demoMode?'demo':'play';state.sessionBars=learnStone?learnStone.keys.length*4:SESSION_BARS;state.learnStone=learnStone||state.learnStone;
      state.sessionKey=learnStone?'F':demoMode?'F':$('#key-select').value;state.sessionAccidentalSide=FLAT_KEYS.has(state.sessionKey)?'flat':state.sessionKey==='C'?'nat':'sharp';state.progression=learnStone?stoneProgression(learnStone):BopTheory.progressionForKey(state.sessionKey);
      state.feel=learnStone?'swing':$('#feel-select').value==='straight'?'straight':'swing';state.sessionFeel=state.feel;state.sessionHardMode=learnStone?false:$('#mode-select').value==='hard';state.sessionBpm=learnStone?learnStone.targetTempo:Number($('#bpm-select').value);Tone.Transport.bpm.value=state.sessionBpm;Tone.Transport.swing=state.feel==='swing'?.62:0;Tone.Transport.swingSubdivision='8n';document.documentElement.dataset.feel=state.feel;document.documentElement.dataset.key=learnStone?learnStone.keys.join('-'):state.sessionKey;document.documentElement.dataset.difficulty=state.sessionHardMode?'hard':'normal';$('#transport-status').dataset.swing=String(Tone.Transport.swing);
      updateLatencyHud();state.sessionLatencySource=activeLatencyCompensation().source;
      unmuteAudio();
      state.countClicks=0; state.rideHits=0; state.bassHits=0; state.compHits=0;state.bar=0;state.beat=0;state.demoMode=demoMode;playScreen.dataset.sessionMode=state.sessionKind;playScreen.dataset.sessionKey=learnStone?learnStone.keys.join('|'):state.sessionKey;playScreen.dataset.sessionBars=String(state.sessionBars);playScreen.dataset.difficulty=state.sessionHardMode?'hard':'normal';state.noteSequence=0;state.soloNotes=[];state.activeNotes.clear();state.timingTrace=[];state.lastHintBar=-4;state.hintPending=false;resetPopupManager();
      state.theoryState=BopTheory.createState();state.eventHistory=[];updateScoreHud();
      titleScreen.classList.remove('is-active');resultsScreen.classList.remove('is-active');learnScreen.classList.remove('is-active');learnResultsScreen.classList.remove('is-active');playScreen.classList.add('is-active');renderStrip();
      state.counting=true; $('#count-in').classList.add('visible'); $('#count-in').setAttribute('aria-hidden','false');
      $('#transport-status').textContent='COUNT IN';
      $('#count-in-number').textContent='1';
      Tone.Transport.stop();Tone.Transport.cancel();Tone.Transport.position='0:0:0';
      const runId=++state.sessionRunId;$('#transport-status').dataset.sessionRunId=String(runId);
      COUNT_POSITIONS.forEach((position,index)=>Tone.Transport.schedule((time)=>{
        if(runId!==state.sessionRunId)return;state.countClick.triggerAttackRelease(index===0?'C7':'G6','64n',time,1);state.countClicks++;traceTiming('count',position);setAudioDiagnostics();
        Tone.Draw.schedule(()=>{if(runId===state.sessionRunId)$('#count-in-number').textContent=COUNT_LABELS[index];},time);
      },position));
      scheduleGroove(runId);if(state.demoMode)scheduleDemoSolo(runId);Tone.Transport.start('+0.1');
    }finally{state.starting=false;}
  }

  function haltPlayback(){
    state.sessionRunId++;
    const stoppedAt=window.Tone?Tone.Transport.seconds:0;
    const beatDuration=window.Tone?60/Tone.Transport.bpm.value:0,sessionStartTime=SESSION_START_BEATS*beatDuration;
    state.activeNotes.forEach(id=>{const note=state.soloNotes.find(item=>item.id===id);if(note&&!Number.isFinite(note.offTime)){const latency=(note.source==='midi'||note.source==='qwerty')?latencyCompensationSeconds():0;note.offTime=Math.max(sessionStartTime,stoppedAt-latency);}});state.activeNotes.clear();
    if(window.Tone){ Tone.Transport.stop(); Tone.Transport.cancel(); }
    if(state.countLoop){state.countLoop.dispose();state.countLoop=null;} state.started=false;state.counting=false;state.loop=null;state.connectionPaused=false;$('#midi-lost-overlay').hidden=true;if(state.popupManager?.timer)clearTimeout(state.popupManager.timer);if(state.popupManager)state.popupManager.queue=[];
    state.held.forEach(t=>{const [,n]=t.split(':');setKey(Number(n),false)});state.held.clear(); if(state.synth) state.synth.releaseAll();
    if(state.comp)state.comp.releaseAll(); if(state.bass)state.bass.triggerRelease();
    Object.values(state.channels).forEach(channel=>{channel.mute=true;});
    $('#count-in').classList.remove('visible');$('#count-in').setAttribute('aria-hidden','true');
  }

  function stopGame() {
    if(state.listeningBack)stopListenBack();
    clearLearnAutomation();if(state.pedalLongTimer){clearTimeout(state.pedalLongTimer);state.pedalLongTimer=null;}state.pedalDownAt=0;state.pedalLongHandled=false;haltPlayback();playScreen.classList.remove('is-active');resultsScreen.classList.remove('is-active');learnScreen.classList.remove('is-active');learnResultsScreen.classList.remove('is-active');titleScreen.classList.add('is-active');
    updateInputStatus();
  }

  function coachingLine(stats,consistency){
    if(consistency?.lastIsWeakest)return'Strong start — keep the energy through the final bars.';
    if(stats.guideTones<4)return`You landed ${stats.guideTones} guide ${stats.guideTones===1?'tone':'tones'} in 16 bars — aim for the 3rd of each chord on beat one.`;
    if(stats.diatonicSteps>stats.chromaticApproaches)return"You're connecting chord tones with scale steps — bebop favors the chromatic path. Try approaching your target from a half step away.";
    if(stats.enclosures===0)return'Try surrounding a chord tone from above and below, then resolve cleanly into it.';
    if(stats.arpeggios===0)return'Connect three chord tones in one direction to make the harmony audible in your line.';
    if(stats.unresolved>stats.passingTones)return'Let chromatic notes resolve by step; your line will sound freer without losing the harmony.';
    return'Your line balanced harmony and motion — next time, target more 3rds and 7ths on beats one and three.';
  }

  const CATEGORY_HOMEWORK={
    harmony:[
      {stat:'guideTones',target:12,tip:'Land more 3rds and 7ths on beats 1 and 3'},
      {stat:'otherChordTones',target:10,tip:'Land more roots and 5ths cleanly on the downbeats'},
      {stat:'colorTones',target:2,tip:'Reach for a b9 or 13 over the dominants'},
      {stat:'susResolutions',target:1,tip:'Resolve the 4 down to the 3rd over a dominant'}
    ],
    melody:[
      {stat:'arpeggios',target:4,tip:'Outline three chord tones in one direction'},
      {stat:'enclosures',target:3,tip:'Surround a chord tone from above and below'},
      {stat:'passingTones',target:8,tip:'Connect chord tones chromatically, not by scale'}
    ],
    rhythm:[
      {stat:'upbeatEntries',target:8,tip:"Start phrases on the 'and', not the beat"},
      {stat:'triplets',target:4,tip:'Sprinkle in a triplet every few bars'}
    ]
  };
  const RHYTHM_PROFILE_HOMEWORK=[
    {stat:'eighthFlow',tip:"Build your lines from eighth notes — that's the fabric"},
    {stat:'tripletSprinkle',tip:'Sprinkle in a triplet every few bars'},
    {stat:'upbeatRate',tip:"Start phrases on the 'and', not the beat"}
  ];

  function updateGradeHomework(stats,grades){
    const resultStats={...stats,susResolutions:state.soloNotes.reduce((count,note)=>count+note.scoringEvents.filter(event=>event.type==='sus-resolution').length,0)};
    for(const category of ['harmony','melody','rhythm']){
      const tip=$(`#grade-${category}-tip`),profile=category==='rhythm'&&grades.rhythmProfile?.applied?grades.rhythmProfile:null,candidates=profile?RHYTHM_PROFILE_HOMEWORK:CATEGORY_HOMEWORK[category],weakest=profile?candidates.reduce((current,item)=>profile[item.stat]<profile[current.stat]?item:current,candidates[0]):candidates.reduce((current,item)=>(Number(resultStats[item.stat]||0)/item.target)<(Number(resultStats[current.stat]||0)/current.target)?item:current,candidates[0]),show=grades[category]<85;
      tip.textContent=weakest.tip;tip.hidden=!show;tip.dataset.device=weakest.stat;tip.dataset.actual=String(profile?profile[weakest.stat]:resultStats[weakest.stat]||0);if(profile)tip.removeAttribute('data-target');else tip.dataset.target=String(weakest.target);
    }
  }

  function noteStyle(note){
    if(note.tags.includes('unresolved'))return{fillStyle:REVIEW_COLORS.unresolved,strokeStyle:REVIEW_COLORS.unresolved};
    if(note.tags.includes('ghost-note')||note.tags.includes('passing-tone')||note.tags.includes('departure-tone'))return{fillStyle:REVIEW_COLORS.passing,strokeStyle:REVIEW_COLORS.passing};
    if(note.scoringEvents.some(event=>(event.points||0)>0))return{fillStyle:REVIEW_COLORS.earned,strokeStyle:REVIEW_COLORS.earned};
    return{fillStyle:REVIEW_COLORS.ink,strokeStyle:REVIEW_COLORS.ink};
  }

  const REVIEW_STAFF_LETTERS={c:0,d:1,e:2,f:3,g:4,a:5,b:6},REVIEW_MIDDLE_LINE=4*7+REVIEW_STAFF_LETTERS.b;

  function reviewStaffPosition(note){
    const chord=BopTheory.createChordContext(note.chordSymbol,note.accidentalSide||state.sessionAccidentalSide),key=BopTheory.spellNote(note.midi,chord),[pitch,octaveText]=key.split('/'),octave=Number(octaveText),letter=REVIEW_STAFF_LETTERS[pitch.charAt(0).toLowerCase()];
    if(!Number.isFinite(octave)||letter===undefined)return Number(note.midi)>=71?0:-1;
    return octave*7+letter-REVIEW_MIDDLE_LINE;
  }

  function reviewStemDirection(notes){
    let direction=-1,extreme=-1;
    for(const note of notes){const position=reviewStaffPosition(note),distance=Math.abs(position),candidate=position>=0?-1:1;if(distance>extreme){direction=candidate;extreme=distance;}else if(distance===extreme)direction=-1;}
    return direction;
  }

  function applyReviewStemDirection(notes,direction){
    notes.forEach(note=>{if(note?.setStemDirection)note.setStemDirection(direction);});
  }

  function makeNotationNote(VF,logged,duration){
    const chord=BopTheory.createChordContext(logged.chordSymbol,logged.accidentalSide||state.sessionAccidentalSide);const key=BopTheory.spellNote(logged.midi,chord);
    const stemDirection=logged.reviewStemDirection??reviewStemDirection([logged]),staveNote=new VF.StaveNote({clef:'treble',keys:[key],duration,auto_stem:true});
    if(staveNote.setStemDirection)staveNote.setStemDirection(stemDirection);staveNote.reviewStemDirection=stemDirection;
    const pitch=key.split('/')[0];if(pitch.includes('b'))staveNote.addModifier(new VF.Accidental('b'),0);else if(pitch.includes('#'))staveNote.addModifier(new VF.Accidental('#'),0);
    staveNote.setStyle(noteStyle(logged));
    if(logged.tags.includes('ghost-note')){const heads=staveNote.getNoteHeads?staveNote.getNoteHeads():[];heads.forEach(head=>{if(head.setScale)head.setScale(.78);});try{if(VF.Parenthesis){staveNote.addModifier(new VF.Parenthesis(VF.Modifier.Position.LEFT),0);staveNote.addModifier(new VF.Parenthesis(VF.Modifier.Position.RIGHT),0);}}catch(error){console.warn('Ghost-note parentheses unavailable:',error);}}
    logged.labels.forEach(label=>{const annotation=new VF.Annotation(label).setFont('Arial',8),color=label==='*'?REVIEW_COLORS.unresolved:REVIEW_COLORS.earned;if(annotation.setStyle)annotation.setStyle({fillStyle:color,strokeStyle:color});if(VF.Annotation.VerticalJustify)annotation.setVerticalJustification(VF.Annotation.VerticalJustify.TOP);staveNote.addModifier(annotation,0);});
    return staveNote;
  }

  function quantizeReviewSlot(beat){
    const base=Math.floor(beat),offbeat=state.feel==='swing'?.62:.5,candidates=[{beat:base,slot:base*2},{beat:base+offbeat,slot:base*2+1},{beat:base+1,slot:base*2+2}];
    return Math.max(0,Math.min(7,candidates.reduce((best,item)=>Math.abs(item.beat-beat)<Math.abs(best.beat-beat)?item:best).slot));
  }

  function detectReviewDoubleTimeBeats(barNotes,excludedIds=new Set()){
    const eligible=barNotes.filter(note=>!note.tieContinuation&&!note.tripletGroup&&!excludedIds.has(note.id)&&Number.isFinite(note.beat)).sort((a,b)=>a.beat-b.beat||a.onTime-b.onTime),beats=new Set();
    for(let index=1;index<eligible.length;index++){
      const previous=eligible[index-1],current=eligible[index],gap=current.beat-previous.beat;
      if(gap<.18||gap>.32)continue;
      const localBeat=Math.floor((previous.beat+current.beat)/2);
      if(localBeat>=0&&localBeat<4)beats.add(localBeat);
    }
    return beats;
  }

  function detectReviewTupletGroups(barNotes){
    const sorted=barNotes.filter(note=>!note.tieContinuation&&Number.isFinite(note.beat)).sort((a,b)=>a.beat-b.beat||a.onTime-b.onTime),groups=[],reserved=new Set(),scored=new Map();
    sorted.forEach(note=>{if(note.tripletGroup){if(!scored.has(note.tripletGroup))scored.set(note.tripletGroup,[]);scored.get(note.tripletGroup).push(note);}});
    for(const [id,notes] of scored){if(notes.length!==3)continue;notes.sort((a,b)=>a.onTime-b.onTime);const event=notes.flatMap(note=>note.scoringEvents||[]).find(item=>item.type==='triplet'),kind=event?.tripletKind||'eighth',startBeat=kind==='quarter'?(Math.abs(notes[0].beat-2)<Math.abs(notes[0].beat)?2:0):kind==='sixteenth'?Math.round(notes[0].beat*2)/2:Math.round(notes[0].beat);if(kind==='quarter'&&Math.abs(notes[0].beat-startBeat)>.12)continue;groups.push({id,kind,notes,startBeat});notes.forEach(note=>reserved.add(note.id));}
    const detect=(kind,targetGap)=>{for(let index=0;index<=sorted.length-3;index++){const notes=sorted.slice(index,index+3);if(notes.some(note=>reserved.has(note.id)))continue;const a=notes[1].beat-notes[0].beat,b=notes[2].beat-notes[1].beat;if(Math.abs(a-targetGap)>targetGap*.12||Math.abs(b-targetGap)>targetGap*.12)continue;let startBeat;if(kind==='quarter'){startBeat=Math.abs(notes[0].beat-2)<Math.abs(notes[0].beat)?2:0;if(Math.abs(notes[0].beat-startBeat)>.12)continue;}else{startBeat=Math.round(notes[0].beat*2)/2;if(Math.abs(notes[0].beat-startBeat)>.09||notes[2].beat>startBeat+.5+.03)continue;}const id=`review-${kind}-${notes[0].id}`;groups.push({id,kind,notes,startBeat});notes.forEach(note=>reserved.add(note.id));index+=2;}};
    detect('quarter',2/3);detect('sixteenth',1/6);return groups.sort((a,b)=>a.startBeat-b.startBeat);
  }

  function quantizeReviewPosition(note,doubleTimeBeats){
    const beatIndex=Math.max(0,Math.min(3,Math.floor(note.beat))),base=beatIndex;
    if(doubleTimeBeats.has(beatIndex)){
      const candidates=[0,.25,.5,.75,1].map((offset,index)=>({beat:base+offset,slot:beatIndex*4+index})),best=candidates.reduce((nearest,item)=>Math.abs(item.beat-note.beat)<Math.abs(nearest.beat-note.beat)?item:nearest);
      return{slot:Math.max(0,Math.min(15,best.slot)),grid:'16',beatIndex};
    }
    const offbeat=state.feel==='swing'?.62:.5,candidates=[{beat:base,slot:beatIndex*4},{beat:base+offbeat,slot:beatIndex*4+2},{beat:base+1,slot:beatIndex*4+4}],best=candidates.reduce((nearest,item)=>Math.abs(item.beat-note.beat)<Math.abs(nearest.beat-note.beat)?item:nearest);
    return{slot:Math.max(0,Math.min(15,best.slot)),grid:'8',beatIndex};
  }

  function resolveReviewCollisions(entries,reservedSlots=new Set()){
    const occupied=new Set(reservedSlots),resolved=[];
    for(const entry of [...entries].sort((a,b)=>a.onTime-b.onTime||a.slot-b.slot)){
      const desiredSlot=entry.slot;
      let slot=desiredSlot;
      if(occupied.has(slot)){
        const nearby=[];
        for(let candidate=desiredSlot+1;candidate<=15;candidate++)nearby.push(candidate);
        for(let candidate=desiredSlot-1;candidate>=0;candidate--)nearby.push(candidate);
        slot=nearby.find(candidate=>!occupied.has(candidate));
        if(slot===undefined)slot=desiredSlot;
      }
      occupied.add(slot);resolved.push({...entry,slot,collisionAdjusted:slot!==desiredSlot,desiredSlot});
    }
    return resolved.sort((a,b)=>a.slot-b.slot||a.onTime-b.onTime);
  }

  function packReviewRuns(entries,doubleTimeBeats,excludedIds=new Set()){
    const packed=entries.map(entry=>({...entry})),runs=[];
    for(let beatIndex=0;beatIndex<4;beatIndex++){
      const beatStart=beatIndex*4,beatEntries=packed.filter(entry=>entry.beatIndex===beatIndex&&!excludedIds.has(entry.id)).sort((a,b)=>a.onTime-b.onTime);
      if(doubleTimeBeats.has(beatIndex)){
        for(let start=0;start<beatEntries.length-1;){
          let end=start;
          while(end+1<beatEntries.length){const gap=beatEntries[end+1].beat-beatEntries[end].beat;if(gap<.18||gap>.32)break;end++;}
          if(end>start){const members=beatEntries.slice(start,end+1),latestStart=beatStart+4-members.length,firstSlot=Math.max(beatStart,Math.min(latestStart,Math.round(members[0].beat*4)));members.forEach((entry,index)=>{entry.slot=firstSlot+index;entry.grid='16';entry.packedRun=true;});runs.push({grid:'16',slots:members.map((entry,index)=>firstSlot+index),ids:members.map(entry=>entry.id)});}
          start=end+1;
        }
      }else{
        for(let index=0;index<beatEntries.length-1;index++){const first=beatEntries[index],second=beatEntries[index+1],gap=second.beat-first.beat;if(first.slot===beatStart&&gap>=.42&&gap<=.78){second.slot=beatStart+2;first.packedRun=true;second.packedRun=true;runs.push({grid:'8',slots:[beatStart,beatStart+2],ids:[first.id,second.id]});index++;}}
      }
    }
    return{entries:packed,runs};
  }

  function ensureTimingLegend(){
    const legend=$('.notation-legend');if(!legend||legend.querySelector('[data-time-feel-legend]'))return;
    const item=document.createElement('em');item.dataset.timeFeelLegend='true';item.textContent='→ rushing · ← dragging';item.style.cssText=`color:${REVIEW_COLORS.timefeel};font-style:normal;font-weight:700`;legend.appendChild(item);
  }

  function absorbReviewFlams(notes){
    const ordered=notes.map((note,index)=>({note,index})).filter(item=>Number.isFinite(item.note.onTime)).sort((a,b)=>a.note.onTime-b.note.onTime||a.index-b.index),omitted=new Set(),audit=[];
    for(let firstIndex=0;firstIndex<ordered.length;firstIndex++)for(let secondIndex=firstIndex+1;secondIndex<ordered.length;secondIndex++){
      const first=ordered[firstIndex],second=ordered[secondIndex],deltaMs=(second.note.onTime-first.note.onTime)*1000;if(deltaMs>60)break;
      const semitones=Math.abs(second.note.midi-first.note.midi);if(semitones>2)continue;
      const firstVelocity=Number(first.note.velocity)||0,secondVelocity=Number(second.note.velocity)||0,keep=secondVelocity>firstVelocity?second:first,drop=keep===first?second:first;
      omitted.add(drop.note.id);audit.push({keptId:keep.note.id,omittedId:drop.note.id,deltaMs:Number(deltaMs.toFixed(1)),semitones,keptVelocity:Number(keep.note.velocity)||0,omittedVelocity:Number(drop.note.velocity)||0});
    }
    return{notes:notes.filter(note=>!omitted.has(note.id)),omittedIds:[...omitted],audit};
  }

  function barTickables(VF,barNotes,beatSeconds,useTuplets=true){
    const detectedTuplets=detectReviewTupletGroups(barNotes),tupletMemberIds=new Set(detectedTuplets.flatMap(group=>group.notes.map(note=>note.id))),doubleTimeBeats=detectReviewDoubleTimeBeats(barNotes,tupletMemberIds),rawEntries=barNotes.map(note=>({...note,...quantizeReviewPosition(note,doubleTimeBeats)})).sort((a,b)=>a.slot-b.slot||a.onTime-b.onTime),completeTuplets=useTuplets?detectedTuplets:[],memberIds=new Set(completeTuplets.flatMap(group=>group.notes.map(note=>note.id)));
    if(!useTuplets)detectedTuplets.forEach(group=>{const base=Math.max(0,Math.min(15,Math.round(group.startBeat*4))),step=group.kind==='sixteenth'?1:group.kind==='quarter'?4:2;group.notes.forEach((note,index)=>{const entry=rawEntries.find(item=>item.id===note.id);if(entry){entry.slot=Math.min(15,base+index*step);entry.grid=group.kind==='sixteenth'?'16':'8';if(index===0)entry.labels=[...entry.labels,'3'];}});});
    const reservedSlots=new Set();completeTuplets.forEach(group=>{const start=Math.max(0,Math.min(15,Math.round(group.startBeat*4))),occupied=group.kind==='quarter'?8:group.kind==='sixteenth'?2:4;for(let slot=start;slot<Math.min(16,start+occupied);slot++)reservedSlots.add(slot);});
    const packedRuns=packReviewRuns(rawEntries.filter(note=>!memberIds.has(note.id)),doubleTimeBeats,tupletMemberIds),entries=resolveReviewCollisions(packedRuns.entries,reservedSlots);
    const items=[];const tuplets=[];const beamCandidates=[];const noteRefs=new Map(),interpretationExtensions=[],syncopationExtensions=[];let cursor=0;
    const addRest=(duration,slots)=>{items.push(new VF.StaveNote({clef:'treble',keys:['b/4'],duration}));cursor+=slots;};
    const addRests=(until)=>{while(cursor<until){const gap=until-cursor,beatIndex=Math.floor(cursor/4),beatGap=Math.min(gap,(beatIndex+1)*4-cursor);if(doubleTimeBeats.has(beatIndex)){if(cursor%4===0&&beatGap>=3)addRest('8dr',3);else if(cursor%2===0&&beatGap>=2)addRest('8r',2);else addRest('16r',1);}else if((cursor===0||cursor===8)&&gap>=8&&!doubleTimeBeats.has(beatIndex+1))addRest('hr',8);else if(cursor%4===0&&gap>=4)addRest('qr',4);else if(cursor%2===0&&gap>=2)addRest('8r',2);else addRest('16r',1);}};
    const timeline=[];completeTuplets.forEach(group=>timeline.push({slot:Math.max(0,Math.min(15,Math.round(group.startBeat*4))),group}));entries.forEach(note=>timeline.push({slot:note.slot,note}));timeline.sort((a,b)=>a.slot-b.slot);
    const onsetSlots=new Set(timeline.map(entry=>entry.slot));
    for(let index=0;index<timeline.length;index++){const entry=timeline[index];if(entry.slot<cursor)entry.slot=Math.min(15,cursor);addRests(entry.slot);if(entry.group){const duration=entry.group.kind==='quarter'?'q':entry.group.kind==='sixteenth'?'16':'8',occupiedSlots=entry.group.kind==='quarter'?8:entry.group.kind==='sixteenth'?2:4,stemDirection=reviewStemDirection(entry.group.notes),notes=entry.group.notes.map(note=>makeNotationNote(VF,{...note,reviewStemDirection:stemDirection},duration));entry.group.notes.forEach((note,noteIndex)=>noteRefs.set(note.id,notes[noteIndex]));items.push(...notes);tuplets.push({notes,sourceNotes:entry.group.notes,kind:entry.group.kind,startSlot:entry.slot,stemDirection,style:noteStyle(entry.group.notes[0])});cursor+=occupiedSlots;continue;}
      const nextEntry=timeline.slice(index+1).find(item=>item.slot>entry.slot),nextSlot=nextEntry?.slot??16,available=Math.max(1,nextSlot-entry.slot),heldSlots=Math.max(1,Math.round(((entry.note.offTime??entry.note.onTime+beatSeconds/4)-entry.note.onTime)/(beatSeconds/4)));
      const isTupletMember=tupletMemberIds.has(entry.note.id),isDoubleTime=doubleTimeBeats.has(Math.floor(entry.slot/4))&&!isTupletMember,downbeat=entry.slot%4===0,followingEighthEmpty=!onsetSlots.has(entry.slot+2);let slots=isDoubleTime?1:2,duration=isDoubleTime?'16':'8',syncopated=false;
      if(isDoubleTime){const withinBeat=Math.max(1,(Math.floor(entry.slot/4)+1)*4-entry.slot),room=Math.min(available,withinBeat);if(heldSlots>=3&&room>=3){slots=3;duration='8d';}else if(heldSlots>=2&&room>=2){slots=2;duration='8';}}
      else if(!entry.note.forceEighth&&!entry.note.tieContinuation&&downbeat&&!tupletMemberIds.has(entry.note.id)){
        if(heldSlots>=16&&entry.slot===0&&available>=16){slots=16;duration='w';}
        else if(heldSlots>=12&&available>=12){slots=12;duration='hd';}
        else if(heldSlots>=8&&available>=8){slots=8;duration='h';}
        else if(available>=4&&(heldSlots>=4||followingEighthEmpty)){slots=4;duration='q';}
      }
      // Logic-style syncopation display: an eighth-note push that is still
      // sounding after the next downbeat reads as one quarter on the "and".
      // Slots 6 and 14 are deliberately excluded: they would cross the
      // mid-bar divider or barline, whose existing split/tie rules take over.
      const durationBeats=Number.isFinite(entry.note.offTime)&&Number.isFinite(entry.note.onTime)?Math.max(0,(entry.note.offTime-entry.note.onTime)/beatSeconds):0,nextDownbeat=Math.floor(entry.note.beat)+1,releaseBeat=entry.note.beat+durationBeats,safeSyncopationSlot=entry.slot===2||entry.slot===10;
      if(!entry.note.forceEighth&&!entry.note.tieContinuation&&!isTupletMember&&!isDoubleTime&&safeSyncopationSlot&&durationBeats>=.75&&releaseBeat>nextDownbeat&&durationBeats<=1.25&&available>=4){
        syncopated=true;slots=4;duration='q';syncopationExtensions.push({id:entry.note.id,slot:entry.slot,fromSlots:2,toSlots:4,releaseBeat:Number(releaseBeat.toFixed(4))});
      }
      const nextOnset=nextEntry?.note?.onTime??(nextEntry?.group?Math.min(...nextEntry.group.notes.map(note=>note.onTime)):null),releaseGap=Number.isFinite(nextOnset)&&Number.isFinite(entry.note.offTime)?Math.max(0,nextOnset-entry.note.offTime):null,interpretationThreshold=beatSeconds*(isDoubleTime?.125:.25),interpretedDuration={1:'16',2:'8',3:'8d',4:'q',6:'qd',8:'h',12:'hd',16:'w'}[available];
      if(!entry.note.forceEighth&&!syncopated&&nextEntry&&releaseGap!==null&&releaseGap<interpretationThreshold&&available>slots&&interpretedDuration){interpretationExtensions.push({id:entry.note.id,grid:isDoubleTime?'16':'8',fromSlots:slots,toSlots:available,gapBeats:Number((releaseGap/beatSeconds).toFixed(4))});slots=available;duration=interpretedDuration;}
      const staveNote=makeNotationNote(VF,entry.note,duration);noteRefs.set(entry.note.id,staveNote);items.push(staveNote);if(duration==='16'||duration==='8')beamCandidates.push({note:staveNote,sourceNote:entry.note,slot:entry.slot,slots,duration,grid:isDoubleTime?'16':'8',style:noteStyle(entry.note)});cursor+=slots;
    }
    addRests(16);const beams=[];let run=[];const flushBeam=()=>{if(run.length>1){const sourceNotes=run.map(member=>member.sourceNote),stemDirection=reviewStemDirection(sourceNotes);applyReviewStemDirection(run.map(member=>member.note),stemDirection);beams.push({notes:run.map(member=>member.note),sourceNotes,stemDirection,slots:run.map(member=>member.slot/2),sixteenthSlots:run.map(member=>member.slot),durations:run.map(member=>member.duration),style:run[0].style});}run=[];};
    for(const candidate of beamCandidates){const previous=run[run.length-1],consecutive=previous&&candidate.slot===previous.slot+previous.slots,sameBeat=previous&&Math.floor(candidate.slot/4)===Math.floor(previous.slot/4);if(previous&&(!consecutive||!sameBeat))flushBeam();if(!run.length&&candidate.slot%4!==0)continue;run.push(candidate);}flushBeam();
    return{items,tuplets,beams,noteRefs,doubleTimeBeats:[...doubleTimeBeats].sort((a,b)=>a-b),packedRuns:packedRuns.runs,collisionAdjustments:entries.filter(note=>note.collisionAdjusted).map(note=>({id:note.id,from:note.desiredSlot,to:note.slot})),interpretationExtensions,syncopationExtensions};
  }

  function reviewTieContinuations(beatSeconds,reviewNotes=state.soloNotes,barCount=SESSION_BARS){
    const continuations=new Map(),ties=[],gridCache=new Map();
    const gridForBar=(bar)=>{
      if(gridCache.has(bar))return gridCache.get(bar);
      const notes=reviewNotes.filter(note=>note.bar===bar),tuplets=detectReviewTupletGroups(notes),tupletMemberIds=new Set(tuplets.flatMap(group=>group.notes.map(note=>note.id))),doubleTimeBeats=detectReviewDoubleTimeBeats(notes,tupletMemberIds),grid={notes,tupletMemberIds,doubleTimeBeats};
      gridCache.set(bar,grid);return grid;
    };
    for(const source of reviewNotes){
      if(source.bar>=barCount-1||!Number.isFinite(source.offTime))continue;
      const sourceGrid=gridForBar(source.bar);
      if(sourceGrid.tupletMemberIds.has(source.id)||quantizeReviewPosition(source,sourceGrid.doubleTimeBeats).slot!==14)continue;
      const boundary=(SESSION_START_BEATS+(source.bar+1)*4)*beatSeconds;
      if(source.offTime<=boundary)continue;
      const targetBar=source.bar+1,targetGrid=gridForBar(targetBar),targetHasDownbeat=targetGrid.notes.some(note=>quantizeReviewPosition(note,targetGrid.doubleTimeBeats).slot===0);
      if(targetHasDownbeat||continuations.has(targetBar))continue;
      const continuationId=`tie-continuation-${source.id}`;
      const continuation={...source,id:continuationId,bar:targetBar,beat:0,onTime:boundary,offTime:boundary+beatSeconds/2,labels:[],tags:[...source.tags],scoringEvents:[...source.scoringEvents],tripletGroup:null,tieContinuation:true,reviewStemDirection:reviewStemDirection([source])};
      continuations.set(targetBar,continuation);
      ties.push({sourceId:source.id,continuationId,sourceBar:source.bar,targetBar,crossSystem:source.bar%4===3});
    }
    return{continuations,ties};
  }

  function allocateReviewBarWidths(weights,totalWidth,minShare=.14,maxShare=.40){
    const count=weights.length,minWidth=totalWidth*minShare,maxWidth=totalWidth*maxShare,widths=Array(count).fill(0),open=new Set(weights.map((_,index)=>index));let remaining=totalWidth;
    while(open.size){
      const weightTotal=[...open].reduce((sum,index)=>sum+Math.max(.01,weights[index]),0);let clamped=false;
      for(const index of [...open]){
        const proposed=remaining*(Math.max(.01,weights[index])/weightTotal);
        if(proposed<minWidth){widths[index]=minWidth;remaining-=minWidth;open.delete(index);clamped=true;}
        else if(proposed>maxWidth){widths[index]=maxWidth;remaining-=maxWidth;open.delete(index);clamped=true;}
      }
      if(!clamped){const finalWeight=[...open].reduce((sum,index)=>sum+Math.max(.01,weights[index]),0);for(const index of open)widths[index]=remaining*(Math.max(.01,weights[index])/finalWeight);break;}
    }
    const correction=totalWidth-widths.reduce((sum,value)=>sum+value,0);widths[widths.length-1]+=correction;return widths;
  }

  function reviewBarDensity(built,notesInBar){
    const accidentalCount=notesInBar.reduce((count,note)=>{if(note.tieContinuation)return count;const chord=BopTheory.createChordContext(note.chordSymbol,note.accidentalSide||state.sessionAccidentalSide),key=BopTheory.spellNote(note.midi,chord);return count+(key.includes('b')||key.includes('#')?1:0);},0);
    return Math.max(1,built.items.length+accidentalCount*.75+built.tuplets.length*.75+built.beams.length*.25);
  }

  function addReviewBarClip(svg,id,x,y,width,height){
    const namespace='http://www.w3.org/2000/svg';let defs=svg.querySelector('defs[data-review-clips]');if(!defs){defs=document.createElementNS(namespace,'defs');defs.dataset.reviewClips='true';svg.insertBefore(defs,svg.firstChild);}
    const clip=document.createElementNS(namespace,'clipPath'),rect=document.createElementNS(namespace,'rect');clip.id=id;rect.setAttribute('x',String(x));rect.setAttribute('y',String(y));rect.setAttribute('width',String(width));rect.setAttribute('height',String(height));clip.appendChild(rect);defs.appendChild(clip);
  }

  function reviewNoteHeadroom(note,isTuplet){
    const ledgerSteps=Math.max(0,reviewStaffPosition(note)-4),labelAllowance=note.labels?.length?16:0,tupletAllowance=isTuplet?24:0;
    return 30+ledgerSteps*5+labelAllowance+tupletAllowance;
  }

  function reviewLineHeadroom(candidates){
    let required=30;
    for(const candidate of candidates){
      const tupletMembers=new Set(candidate.built.tuplets.flatMap(group=>(group.sourceNotes||[]).map(note=>note.id)));
      for(const note of candidate.notesInBar)required=Math.max(required,reviewNoteHeadroom(note,tupletMembers.has(note.id)));
    }
    return Math.ceil(required);
  }

  function reviewBoundsAudit(lineCandidates,lineYs,height){
    const violations=[];
    lineCandidates.forEach((candidates,line)=>candidates.forEach(candidate=>{const tupletMembers=new Set(candidate.built.tuplets.flatMap(group=>(group.sourceNotes||[]).map(note=>note.id)));candidate.notesInBar.forEach(note=>{const top=lineYs[line]-reviewNoteHeadroom(note,tupletMembers.has(note.id)),bottom=lineYs[line]+105;if(top<-.5||bottom>height+.5)violations.push({bar:candidate.bar+1,id:note.id,top:Number(top.toFixed(2)),bottom:Number(bottom.toFixed(2)),height:Number(height.toFixed(2))});});}));
    return violations;
  }

  async function renderSoloReview(options={}){
    const lessonMode=Boolean(options.lesson),compactMode=Boolean(options.compact),hideChordSymbols=Boolean(options.hideChordSymbols),chart=options.chart||$('#review-chart'),auditTarget=options.auditTarget||resultsScreen,sourceNotes=options.notes||state.soloNotes,progression=options.progression||state.progression,barCount=options.bars||SESSION_BARS,lineCount=Math.ceil(barCount/4),reviewKey=options.key||state.sessionKey||'F';if(!lessonMode){hideListenBackCursor();ensureTimingLegend();}chart.innerHTML='';auditTarget.dataset.reviewNotes=String(sourceNotes.length);
    if(!sourceNotes.length){chart.innerHTML='<p class="nothing-to-review">Nothing to review — play some notes!</p>';auditTarget.dataset.reviewRendered='empty';return;}
    try{const flamPass=absorbReviewFlams(sourceNotes),reviewNotes=flamPass.notes,VF=await state.vexReady,width=Math.max(compactMode?420:920,chart.clientWidth-32),margin=18,usableWidth=width-margin*2,beatSeconds=options.beatSeconds||60/Number($('#bpm-select').value),tiePlan=reviewTieContinuations(beatSeconds,reviewNotes,barCount),barLayouts=[],lineCandidates=[];
      for(let line=0;line<lineCount;line++){
        const candidates=[];
        const barsOnLine=Math.min(4,barCount-line*4);for(let within=0;within<barsOnLine;within++){const bar=line*4+within,continuation=tiePlan.continuations.get(bar),notesInBar=[...reviewNotes.filter(note=>note.bar===bar),...(continuation?[continuation]:[])];let built,useTuplets=true;try{built=barTickables(VF,notesInBar,beatSeconds,true);}catch(error){console.warn(`Triplet layout fallback in bar ${bar+1}:`,error);built=barTickables(VF,notesInBar,beatSeconds,false);useTuplets=false;}candidates.push({bar,within,notesInBar,built,useTuplets,density:reviewBarDensity(built,notesInBar)});}
        lineCandidates.push(candidates);const widths=allocateReviewBarWidths(candidates.map(candidate=>candidate.density),usableWidth);let x=margin;candidates.forEach((candidate,index)=>{barLayouts[candidate.bar]={...candidate,line,x,width:widths[index]};x+=widths[index];});
      }
      // Draw into generously separated provisional systems first. Their true
      // vertical extents are measured from the rendered SVG below; pitch is
      // deliberately not used to predict headroom.
      const provisionalHeight=Math.max(220,lineCount*180+40),lineYs=Array.from({length:lineCount},(_,line)=>55+line*180),lineTops=Array.from({length:lineCount},(_,line)=>line*180),renderer=new VF.Renderer(chart,VF.Renderer.Backends.SVG);renderer.resize(width,provisionalHeight);const context=renderer.getContext();context.setFillStyle(REVIEW_COLORS.ink);context.setStrokeStyle(REVIEW_COLORS.ink);const beamAudit=[],doubleTimeAudit=[],tupletAudit=[],collisionAudit=[],runAudit=[],interpretationAudit=[],syncopationAudit=[],timingMarkerAudit=[],stemAudit=[],renderedNotes=new Map(),layoutAudit=[],lineGroups=Array(lineCount),tieGroups=Array.from({length:lineCount},()=>[]);
      chart.dataset.reviewWidth=String(width);chart.dataset.reviewHeight=String(provisionalHeight);chart.dataset.reviewLineHeight='180';chart.dataset.reviewLineYs=JSON.stringify(lineYs);chart.dataset.reviewLineTops=JSON.stringify(lineTops);chart.dataset.reviewLineHeadrooms='[]';chart.dataset.reviewMargin=String(margin);
      chart.dataset.reviewBarWidths=JSON.stringify(barLayouts.map(layout=>Number(layout.width.toFixed(2))));chart.dataset.reviewBarXs=JSON.stringify(barLayouts.map(layout=>Number(layout.x.toFixed(2))));
      const svg=chart.querySelector('svg');
      for(const layout of barLayouts){const {bar,within,line,x,width:barWidth,notesInBar,built}=layout,y=lineYs[line];if(within===0){lineGroups[line]=context.openGroup?.('review-line',`review-line-${line}`)||null;if(lineGroups[line]?.setAttribute)lineGroups[line].setAttribute('data-review-line',String(line));}const stave=new VF.Stave(x,y,barWidth);if(within===0){stave.addClef('treble');if(!compactMode)stave.addKeySignature(reviewKey).addTimeSignature('4/4');}stave.setContext(context).draw();if(!hideChordSymbols){context.save();context.setFont('Georgia',11,'italic');context.setFillStyle(REVIEW_COLORS.ink);context.fillText(progression.bars[bar%progression.bars.length].symbol,x+(within===0?72:10),y-7);context.restore();}
        const drawBuilt=()=>{
          built.tuplets.forEach(group=>applyReviewStemDirection(group.notes,group.stemDirection));built.beams.forEach(group=>applyReviewStemDirection(group.notes,group.stemDirection));
          const tuplets=built.tuplets.map(group=>({tuplet:new VF.Tuplet(group.notes,{num_notes:3,notes_occupied:2,bracketed:true}),style:group.style})),beams=[...built.beams.map(group=>({beam:new VF.Beam(group.notes,false),style:group.style})),...built.tuplets.filter(group=>group.kind!=='quarter').map(group=>({beam:new VF.Beam(group.notes,false),style:group.style}))],noteStartX=stave.getNoteStartX(),noteEndX=stave.getNoteEndX(),padding=14,noteAreaWidth=Math.max(52,noteEndX-noteStartX-padding*2),clipId=`${chart.id||'review'}-bar-clip-${bar}`;
          // The clip remains horizontal-only during the measurement pass.
          // A guessed vertical clip would hide the very glyphs getBBox must see.
          if(svg)addReviewBarClip(svg,clipId,x,-4096,barWidth,8192);const group=context.openGroup?context.openGroup('review-bar-glyphs',`${clipId}-glyphs`):null;if(group?.setAttribute){group.setAttribute('clip-path',`url(#${clipId})`);group.setAttribute('data-bar',String(bar+1));}
          const voice=new VF.Voice({num_beats:4,beat_value:4});voice.setStrict(false);voice.addTickables(built.items);new VF.Formatter().joinVoices([voice]).format([voice],noteAreaWidth);voice.draw(context,stave);beams.forEach(({beam,style})=>{context.save();context.setFillStyle(style.fillStyle);context.setStrokeStyle(style.strokeStyle);beam.setContext(context).draw();context.restore();});tuplets.forEach(({tuplet,style})=>{context.save();context.setFillStyle(style.fillStyle);context.setStrokeStyle(style.strokeStyle);tuplet.setContext(context).draw();context.restore();});if(group&&context.closeGroup)context.closeGroup();
          const tickableXs=built.items.map(tickable=>Number(tickable.getAbsoluteX?.()??tickable.getX?.())).filter(Number.isFinite),limit=noteEndX-padding,overflow=tickableXs.filter(value=>value>limit+.5);layoutAudit[bar]={x:Number(x.toFixed(2)),width:Number(barWidth.toFixed(2)),density:Number(layout.density.toFixed(2)),tickables:built.items.length,noteStartX:Number(noteStartX.toFixed(2)),noteEndX:Number(noteEndX.toFixed(2)),formatWidth:Number(noteAreaWidth.toFixed(2)),maxTickableX:tickableXs.length?Number(Math.max(...tickableXs).toFixed(2)):null,overflow:overflow.map(value=>Number(value.toFixed(2)))};if(DEV_MODE&&overflow.length)console.warn(`Solo review bar ${bar+1} overflow: tickable x exceeds stave end`,layoutAudit[bar]);

          // Time feel is a visual review pass only. Confirmed tuplets use their own grid,
          // so they are excluded from the straight/swing timing comparison.
          const timingBuckets=Array.from({length:4},()=>[]);
          for(const note of notesInBar){
            if(note.tieContinuation||note.tripletGroup||!Number.isFinite(note.beat))continue;
            const beatIndex=Math.max(0,Math.min(3,Math.floor(note.beat)));
            const deviation=BopTheory.timingDeviationMs({beat:note.beat,beatDuration:beatSeconds},state.feel);
            if(deviation!==null)timingBuckets[beatIndex].push(deviation);
          }
          const timingMarkers=timingBuckets.flatMap((values,beat)=>{
            if(!values.length)return[];
            const meanMs=values.reduce((sum,value)=>sum+value,0)/values.length;
            if(meanMs<=-20)return[{beat,meanMs,type:'rush',glyph:'→'}];
            if(meanMs>=45)return[{beat,meanMs,type:'drag',glyph:'←'}];
            return[];
          });
          context.save();context.setFont('Arial',11,'bold');context.setFillStyle(REVIEW_COLORS.timefeel);context.setStrokeStyle(REVIEW_COLORS.timefeel);
          timingMarkers.forEach(marker=>context.fillText(marker.glyph,noteStartX+(marker.beat+.5)*(noteEndX-noteStartX)/4-5,y+18));
          context.restore();

          beamAudit[bar]=built.beams.map(group=>{const audit={slots:group.slots,durations:group.durations,stemDirection:group.stemDirection};if(group.durations.some(duration=>duration==='16'||duration==='8d'))audit.sixteenthSlots=group.sixteenthSlots;return audit;});doubleTimeAudit[bar]=built.doubleTimeBeats;tupletAudit[bar]=built.tuplets.map(group=>({kind:group.kind,startSlot:group.startSlot,stemDirection:group.stemDirection,durations:group.notes.map(note=>note.getDuration?.()||'')}));collisionAudit[bar]=built.collisionAdjustments;runAudit[bar]=built.packedRuns;interpretationAudit[bar]=built.interpretationExtensions;syncopationAudit[bar]=built.syncopationExtensions;timingMarkerAudit[bar]=timingMarkers.map(marker=>({...marker,meanMs:Number(marker.meanMs.toFixed(1))}));stemAudit[bar]={notes:notesInBar.map(note=>({id:note.id,midi:note.midi,staffPosition:reviewStaffPosition(note),stemDirection:built.noteRefs.get(note.id)?.getStemDirection?.()??built.noteRefs.get(note.id)?.reviewStemDirection??null})),beams:built.beams.map(group=>group.stemDirection),tuplets:built.tuplets.map(group=>group.stemDirection)};built.noteRefs.forEach((note,id)=>renderedNotes.set(id,note));};drawBuilt();if(within===3&&lineGroups[line]&&context.closeGroup)context.closeGroup();
      }
      const tieAudit=[];
      for(const [tieIndex,planned] of tiePlan.ties.entries()){
        const firstNote=renderedNotes.get(planned.sourceId),lastNote=renderedNotes.get(planned.continuationId);if(!firstNote||!lastNote)continue;
        const sourceLine=Math.floor(planned.sourceBar/4),targetLine=Math.floor(planned.targetBar/4);
        const drawTie=(notes,line,suffix)=>{const group=context.openGroup?.('review-tie',`review-tie-${tieIndex}-${suffix}`)||null;if(group?.setAttribute)group.setAttribute('data-review-line',String(line));new VF.StaveTie({...notes,firstIndexes:[0],lastIndexes:[0]}).setContext(context).draw();if(group&&context.closeGroup)context.closeGroup();if(group)tieGroups[line].push(group);};
        if(planned.crossSystem){drawTie({firstNote},sourceLine,'out');drawTie({lastNote},targetLine,'in');}else drawTie({firstNote,lastNote},sourceLine,'full');
        const source=reviewNotes.find(note=>note.id===planned.sourceId),continuation=tiePlan.continuations.get(planned.targetBar);tieAudit.push({...planned,sourceSlot:14,sourceEighthSlot:7,targetSlot:0,form:planned.crossSystem?'partial':'full',targetLabels:continuation?.labels.length??0,targetBeamed:beamAudit[planned.targetBar]?.some(group=>group.slots.includes(0))??false,sourceStyle:source?noteStyle(source).fillStyle:'',targetStyle:continuation?noteStyle(continuation).fillStyle:''});
      }

      // VexFlow glyphs (including beams, ledger lines, tuplets and text)
      // can extend well outside a notehead's pitch-derived estimate. Measure
      // the browser's actual SVG geometry, pack each system from those bounds,
      // then size the viewBox around the finished result.
      const measureRoots=roots=>{
        const selector='path,text,line,polyline,polygon,rect,circle,ellipse,use',leaves=[];let minY=Infinity,maxY=-Infinity;
        for(const root of roots.filter(Boolean)){
          const elements=[...(root.matches?.(selector)?[root]:[]),...root.querySelectorAll(selector)];
          for(const element of elements){
            try{
              // VexFlow adds large transparent pointer hit-rects around some
              // glyph groups. They are interaction geometry, not painted
              // notation, and must not inflate the visible content bounds.
              const opacity=element.getAttribute('opacity');if((opacity!==null&&Number(opacity)===0)||element.getAttribute('display')==='none'||element.getAttribute('visibility')==='hidden')continue;
              const box=element.getBBox(),matrix=element.getCTM?.();if(!matrix||![box.x,box.y,box.width,box.height].every(Number.isFinite))continue;
              const corners=[[box.x,box.y],[box.x+box.width,box.y],[box.x,box.y+box.height],[box.x+box.width,box.y+box.height]].map(([x,y])=>{const point=svg.createSVGPoint();point.x=x;point.y=y;return point.matrixTransform(matrix);});
              const top=Math.min(...corners.map(point=>point.y)),bottom=Math.max(...corners.map(point=>point.y));if(!Number.isFinite(top)||!Number.isFinite(bottom))continue;minY=Math.min(minY,top);maxY=Math.max(maxY,bottom);leaves.push({element,top,bottom});
            }catch(_error){/* An empty VexFlow group has no measurable box. */}
          }
        }
        return{minY:Number.isFinite(minY)?minY:0,maxY:Number.isFinite(maxY)?maxY:0,leaves};
      };
      const topPadding=14,bottomPadding=14,systemGap=28,lineMeasurements=lineGroups.map((group,line)=>measureRoots([group,...tieGroups[line]])),lineShifts=[],finalLineYs=[],finalLineTops=[];let packedTop=topPadding;
      lineMeasurements.forEach((measurement,line)=>{const shift=packedTop-measurement.minY;lineShifts[line]=shift;for(const root of [lineGroups[line],...tieGroups[line]].filter(Boolean)){const existing=root.getAttribute('transform');root.setAttribute('transform',`translate(0 ${shift})${existing?` ${existing}`:''}`);}finalLineYs[line]=lineYs[line]+shift;finalLineTops[line]=measurement.minY+shift;packedTop=measurement.maxY+shift+systemGap;});
      const measured=measureRoots([...lineGroups,...tieGroups.flat()]),viewBoxTop=Math.floor(measured.minY-topPadding),viewBoxBottom=Math.ceil(measured.maxY+bottomPadding),height=Math.max(1,viewBoxBottom-viewBoxTop),boundsAudit=measured.leaves.filter(item=>item.top<viewBoxTop-.5||item.bottom>viewBoxBottom+.5).map(item=>({tag:item.element.tagName,class:item.element.getAttribute('class')||'',top:Number(item.top.toFixed(2)),bottom:Number(item.bottom.toFixed(2)),viewBoxTop,viewBoxBottom}));
      if(svg){svg.setAttribute('viewBox',`0 ${viewBoxTop} ${width} ${height}`);svg.setAttribute('height',String(height));svg.setAttribute('preserveAspectRatio','xMinYMin meet');svg.style.width='100%';svg.style.height='auto';}
      chart.dataset.reviewHeight=String(height);chart.dataset.reviewLineYs=JSON.stringify(finalLineYs);chart.dataset.reviewLineTops=JSON.stringify(finalLineTops);chart.dataset.reviewLineHeadrooms=JSON.stringify(finalLineYs.map((y,line)=>Number((y-finalLineTops[line]).toFixed(2))));chart.dataset.reviewLineShifts=JSON.stringify(lineShifts.map(value=>Number(value.toFixed(2))));chart.dataset.reviewViewBoxTop=String(viewBoxTop);chart.dataset.reviewMeasuredBounds=JSON.stringify({top:Number(measured.minY.toFixed(2)),bottom:Number(measured.maxY.toFixed(2)),viewBoxTop,viewBoxBottom});
      if(DEV_MODE&&boundsAudit.length)console.warn('Solo review vertical bounds violation:',boundsAudit);auditTarget.dataset.reviewBoundsAudit=JSON.stringify(boundsAudit);auditTarget.dataset.reviewLayoutAudit=JSON.stringify(layoutAudit);auditTarget.dataset.stemAudit=JSON.stringify(stemAudit);auditTarget.dataset.beamAudit=JSON.stringify(beamAudit);auditTarget.dataset.doubleTimeAudit=JSON.stringify(doubleTimeAudit);auditTarget.dataset.tupletAudit=JSON.stringify(tupletAudit);auditTarget.dataset.collisionAudit=JSON.stringify(collisionAudit);auditTarget.dataset.runAudit=JSON.stringify(runAudit);auditTarget.dataset.interpretationAudit=JSON.stringify(interpretationAudit);auditTarget.dataset.syncopationAudit=JSON.stringify(syncopationAudit);auditTarget.dataset.timingMarkerAudit=JSON.stringify(timingMarkerAudit);auditTarget.dataset.flamAudit=JSON.stringify(flamPass.audit);auditTarget.dataset.flamAbsorbed=String(flamPass.omittedIds.length);auditTarget.dataset.renderedNoteCount=String([...renderedNotes.keys()].filter(id=>!String(id).startsWith('tie-continuation-')).length);auditTarget.dataset.tieAudit=JSON.stringify(tieAudit);auditTarget.dataset.reviewRendered='true';
    }catch(error){console.error('Unable to render solo review:',error);chart.innerHTML='<p>Notation could not load. Check your connection and reload.</p>';auditTarget.dataset.reviewRendered='error';}
  }

  function markCarryOvers(){
    const beatSeconds=60/Number($('#bpm-select').value);let found=false;const details=[];
    for(const note of state.soloNotes){if(note.bar>=SESSION_BARS-1||!Number.isFinite(note.offTime))continue;const boundary=(SESSION_START_BEATS+(note.bar+1)*4)*beatSeconds,nextChord=BopTheory.createChordContext(state.progression.bars[(note.bar+1)%state.progression.bars.length].symbol,state.sessionAccidentalSide);if(note.offTime>boundary+.02&&!BopTheory.isChordTone(note.midi,nextChord)){note.tags.push('carry-over');if(!note.labels.includes('*'))note.labels.push('*');found=true;details.push({id:note.id,midi:note.midi,bar:note.bar,beat:note.beat,onTime:note.onTime,offTime:note.offTime,boundary});}}
    const footnote=$('#carry-over-footnote');footnote.hidden=!found;resultsScreen.dataset.carryOvers=String(state.soloNotes.filter(note=>note.tags.includes('carry-over')).length);
    if(DEV_MODE){window.__boplicitySession={notes:state.soloNotes,carryOvers:details};resultsScreen.dataset.devExportJson=JSON.stringify(sessionExportEvents());}
  }

  function finishSession(){
    if(state.theoryState){const pendingDeadlines=state.theoryState.pending.map(item=>item.note.time+item.note.beatDuration+.01);const flushAt=Math.max(Tone.Transport.seconds,...pendingDeadlines,0);const flushed=BopTheory.advanceTime(state.theoryState,flushAt,{hardMode:state.sessionHardMode});state.theoryState=flushed.state;attachScoringEvents(flushed.events);}
    if(state.sessionKind==='learn'){finishLearnSession();return;}
    haltPlayback();if(state.channels.ui&&state.endChime){state.channels.ui.mute=false;state.endChime.triggerAttackRelease('C6','32n',Tone.now()+.03,.45);}playScreen.classList.remove('is-active');titleScreen.classList.remove('is-active');resultsScreen.classList.add('is-active');
    markCarryOvers();const stats=state.theoryState.stats,grades=BopTheory.calculateGrades(state.theoryState,SESSION_BARS,{hardMode:state.sessionHardMode}),timeFeel=BopTheory.timeFeelReport(stats),consistency=BopTheory.consistencyReport(state.theoryState,SESSION_BARS);
    $('#results-session-summary').textContent=`${state.progression.name} · ${state.sessionBpm} BPM · ${state.sessionFeel.toUpperCase()}`;resultsScreen.dataset.sessionKey=state.sessionKey;resultsScreen.dataset.progression=state.progression.bars.map(bar=>bar.symbol).join('|');
    $('#final-score').textContent=state.theoryState.arcadeScore.toLocaleString();
    $('#grade-value').textContent=grades.overall;$('#grade-tempo').textContent=state.sessionBpm;$('#grade-mode').textContent=state.sessionHardMode?' · HARD':'';$('#hard-mode-note').hidden=!state.sessionHardMode;$('#grade-band').textContent=grades.band;$('#grade-harmony').textContent=grades.harmony;$('#grade-melody').textContent=grades.melody;$('#grade-rhythm').textContent=grades.rhythm;resultsScreen.dataset.rhythmProfile=JSON.stringify(grades.rhythmProfile);updateGradeHomework(stats,grades);resultsScreen.dataset.difficulty=state.sessionHardMode?'hard':'normal';
    $('#report-guides').textContent=stats.guideTones;$('#report-chords').textContent=stats.otherChordTones;$('#report-arpeggios').textContent=stats.arpeggios;$('#report-enclosures').textContent=stats.enclosures;$('#report-passing').textContent=stats.passingTones;$('#report-unresolved').textContent=stats.unresolved;$('#report-triplets').textContent=stats.triplets;$('#report-upbeats').textContent=stats.upbeatEntries;$('#report-combo').textContent=stats.longestCombo;const diatonic=$('#report-diatonic'),chromatic=$('#report-chromatic');if(diatonic)diatonic.textContent=stats.diatonicSteps;if(chromatic)chromatic.textContent=stats.chromaticApproaches;
    $('#time-feel-report').textContent=timeFeel.text;$('#consistency-report').textContent=consistency.text;const latencyNudge=$('#latency-nudge'),showLatencyNudge=Number.isFinite(timeFeel.averageMs)&&Math.abs(timeFeel.averageMs)>40;latencyNudge.textContent=state.sessionLatencySource==='estimated'?'Timing reads consistently off — run Calibrate on the title screen (one minute).':'Timing reads consistently off — consider recalibrating.';latencyNudge.hidden=!showLatencyNudge;resultsScreen.dataset.latencyNudge=String(showLatencyNudge);resultsScreen.dataset.latencySource=state.sessionLatencySource;$('#coaching-line').textContent=coachingLine(stats,consistency);resultsScreen.dataset.reportPopulated='true';resultsScreen.dataset.score=String(state.theoryState.arcadeScore);resultsScreen.dataset.baseScore=String(state.theoryState.baseScore);resultsScreen.dataset.averageDeviation=String(timeFeel.averageMs??'');resultsScreen.dataset.strongestBars=consistency.strongest;resultsScreen.dataset.weakestBars=consistency.weakest;updateListenBackButton();renderSoloReview();
  }

  function updateInputStatus() {
    const label=state.midiName?`MIDI: ${state.midiName} connected`:'Keyboard mode';
    $('#title-input-status').textContent=label; $('#play-input-status').textContent=label;
  }

  function pauseForMidiLoss(){
    if(state.demoMode||state.connectionPaused||!playScreen.classList.contains('is-active')||(!state.started&&!state.counting))return;state.connectionPaused=true;if(window.Tone)Tone.Transport.pause();$('#midi-lost-overlay').hidden=false;$('#transport-status').textContent='MIDI CONNECTION LOST';
  }

  function resumeFromMidiLoss(){
    if(!state.connectionPaused)return;state.connectionPaused=false;$('#midi-lost-overlay').hidden=true;if(window.Tone)Tone.Transport.start('+0.05');if(state.started){$('#transport-status').textContent=`${$('#bpm-select').value} BPM · ${state.feel.toUpperCase()}`;requestAnimationFrame(animateSweep);}
  }

  function bindMidiInputs() {
    state.midiName='';const connected=[];
    for(const input of state.midiAccess.inputs.values()) {if(input.state==='disconnected')continue;connected.push(input);
      if(!state.midiName) state.midiName=input.name||'MIDI device';
      input.onmidimessage=(event)=>{ const [status,note,velocity]=event.data; const command=status&0xf0,position={transportSeconds:transportSecondsForEvent(event.timeStamp)};
        if(command===0xb0&&note===64){handlePedalCc(velocity);return;}
        if(command===0x90&&velocity>0){if(recordCalibrationTap(event.timeStamp))return;if(handleIdleNoteStart())return;playNote(note,true,'midi',velocity/127,undefined,position);}
        else if(command===0x80||(command===0x90&&velocity===0)){if(state.calibration.active)return;playNote(note,false,'midi',0,undefined,position);}
      };
    }
    if(connected.length){state.midiWasConnected=true;resumeFromMidiLoss();}else if(state.midiWasConnected)pauseForMidiLoss();
    updateInputStatus();
  }

  async function initMidi() {
    if(!navigator.requestMIDIAccess){updateInputStatus();return;}
    try{state.midiAccess=await navigator.requestMIDIAccess();bindMidiInputs();state.midiAccess.onstatechange=bindMidiInputs;}
    catch(error){updateInputStatus();}
  }

  function sessionExportEvents(){
    const beatSeconds=60/Number($('#bpm-select').value);return state.soloNotes.filter(note=>note.bar<SESSION_BARS).map(note=>({midi:note.midi,bar:note.bar,beat:Number(note.beat.toFixed(4)),durationBeats:Number(Math.max(.05,((note.offTime??note.onTime)-note.onTime)/beatSeconds).toFixed(4)),velocity:note.velocity}));
  }

  function exportDemoSession(){
    const events=sessionExportEvents();
    const blob=new Blob([JSON.stringify(events,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='boplicity-demo-solo.json';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),0);
    const button=$('#dev-export-button');button.dataset.exported=String(events.length);button.textContent=`EXPORTED ${events.length} NOTES`;setTimeout(()=>{button.textContent='EXPORT DEMO JSON';},1400);
  }

  function initCompatibilityNotice(){
    const ua=navigator.userAgent,isMobile=/Android|iPhone|iPad|iPod|Mobile/i.test(ua),isChrome=/Chrome\//.test(ua)&&!/Edg\//.test(ua)&&!/OPR\//.test(ua);$('#compatibility-banner').hidden=isChrome&&!isMobile;
  }

  function ignoresGlobalShortcut(target){return target instanceof Element&&(target.matches('select,input,textarea')||target.isContentEditable);}
  function quickRetry(){
    const fromPlay=playScreen.classList.contains('is-active'),fromResults=resultsScreen.classList.contains('is-active'),demoMode=(fromPlay||fromResults)?state.demoMode:false,learnStone=state.sessionKind==='learn'?state.learnStone:null;
    if(state.listeningBack)stopListenBack();if(fromPlay)haltPlayback();startGame(demoMode,learnStone).catch(showStartError);
  }

  function handleIdleNoteStart(){
    if(state.calibration.active)return false;
    if(titleScreen.classList.contains('is-active')){startGame(false).catch(showStartError);return true;}
    if(learnScreen.classList.contains('is-active')){if(state.learnPhase==='lesson')startLearnSkillSession();else if(state.learnPhase==='synthesis-prompt')startLearnSynthesis();else return false;return true;}
    if(learnResultsScreen.classList.contains('is-active')){continueLearnAfterResult();return true;}
    if(resultsScreen.classList.contains('is-active')){if(state.listeningBack)stopListenBack();startGame(false).catch(showStartError);return true;}
    return false;
  }

  function retryCurrentSession(){
    clearLearnAutomation(false);
    if(playScreen.classList.contains('is-active')){quickRetry();return;}
    if(learnResultsScreen.classList.contains('is-active')){if(state.learnRunKind==='final')startLearnSynthesis();else startLearnSkillSession();return;}
    if(resultsScreen.classList.contains('is-active')){quickRetry();return;}
    if(learnScreen.classList.contains('is-active')){if(state.learnPhase==='synthesis-prompt')startLearnSynthesis();else startLearnSkillSession();}
  }

  function handlePedalTap(){
    if(titleScreen.classList.contains('is-active')){openLearnMode().catch(showStartError);return;}
    if(learnScreen.classList.contains('is-active')){if(state.learnPhase==='synthesis-prompt')startLearnSynthesis();else if(state.learnPhase==='lesson')startLearnSkillSession();return;}
    if(learnResultsScreen.classList.contains('is-active')){continueLearnAfterResult();return;}
    if(resultsScreen.classList.contains('is-active')){if(state.listeningBack)stopListenBack();startGame(false).catch(showStartError);}
  }

  function handlePedalCc(value){
    if(state.calibration.active)return;
    if(value>=64){if(state.pedalDownAt)return;state.pedalDownAt=performance.now();state.pedalLongHandled=false;if(state.pedalLongTimer)clearTimeout(state.pedalLongTimer);state.pedalLongTimer=setTimeout(()=>{state.pedalLongTimer=null;state.pedalLongHandled=true;retryCurrentSession();},PEDAL_RETRY_MS);return;}
    if(!state.pedalDownAt)return;const wasLong=state.pedalLongHandled;state.pedalDownAt=0;if(state.pedalLongTimer){clearTimeout(state.pedalLongTimer);state.pedalLongTimer=null;}state.pedalLongHandled=false;if(!wasLong)handlePedalTap();
  }

  document.addEventListener('keydown',(e)=>{
    if(!e.metaKey&&!e.ctrlKey&&!e.altKey&&state.calibration.active){if(e.key==='Escape'){e.preventDefault();stopCalibration(true);return;}e.preventDefault();if(!e.repeat)recordCalibrationTap(e.timeStamp);return;}
    const isSpace=e.code==='Space'||e.key===' '||e.key==='Spacebar',isRetry=e.code==='KeyR'||e.key.toLowerCase()==='r',modified=e.metaKey||e.ctrlKey||e.altKey;
    if((isSpace||isRetry)&&!modified){
      if(ignoresGlobalShortcut(e.target))return;e.preventDefault();if(e.repeat)return;
      if(isSpace){
        if(titleScreen.classList.contains('is-active'))startGame(false).catch(showStartError);
        else if(resultsScreen.classList.contains('is-active'))(state.listeningBack?Promise.resolve(stopListenBack()):startListenBack()).catch(showStartError);
        else if(learnScreen.classList.contains('is-active')){if(state.learnPhase==='lesson')startLearnSkillSession();else if(state.learnPhase==='synthesis-prompt')startLearnSynthesis();}
        else if(learnResultsScreen.classList.contains('is-active'))continueLearnAfterResult();
      }else if(titleScreen.classList.contains('is-active'))startGame(false).catch(showStartError);else if(playScreen.classList.contains('is-active')||resultsScreen.classList.contains('is-active'))quickRetry();else if(learnResultsScreen.classList.contains('is-active'))retryCurrentSession();
      return;
    }
    if(e.key==='Escape'&&(playScreen.classList.contains('is-active')||learnScreen.classList.contains('is-active')||learnResultsScreen.classList.contains('is-active'))){e.preventDefault();stopGame();return;}
    if(e.repeat||e.metaKey||e.ctrlKey||e.altKey)return;const note=QWERTY[e.key.toLowerCase()];if(note){if(handleIdleNoteStart()){e.preventDefault();return;}if(playScreen.classList.contains('is-active')){e.preventDefault();if(state.connectionPaused)resumeFromMidiLoss();playNote(note,true,'qwerty',.75,undefined,{transportSeconds:transportSecondsForEvent(e.timeStamp)});}}
  });
  document.addEventListener('keyup',(e)=>{if(state.calibration.active){e.preventDefault();return;}const isSpace=e.code==='Space'||e.key===' '||e.key==='Spacebar',isRetry=e.code==='KeyR'||e.key.toLowerCase()==='r';if((isSpace||isRetry)&&!e.metaKey&&!e.ctrlKey&&!e.altKey){if(!ignoresGlobalShortcut(e.target))e.preventDefault();return;}const note=QWERTY[e.key.toLowerCase()];if(note){e.preventDefault();playNote(note,false,'qwerty',0,undefined,{transportSeconds:transportSecondsForEvent(e.timeStamp)});}});
  window.addEventListener('blur',()=>Object.entries(QWERTY).forEach(([,n])=>playNote(n,false)));
  $('#play-button').addEventListener('click',()=>{ startGame().catch(showStartError); });$('#learn-button').addEventListener('click',()=>openLearnMode().catch(showStartError));$('#demo-button').addEventListener('click',()=>{startGame(true).catch(showStartError);});$('#calibrate-button').addEventListener('click',()=>openCalibration().catch(showStartError));$('#calibration-start-button').addEventListener('click',()=>startCalibration().catch(showStartError));$('#calibration-save-button').addEventListener('click',saveCalibration);$('#calibration-cancel-button').addEventListener('click',()=>stopCalibration(true)); $('#brand-button').addEventListener('click',()=>stopGame()); $('#stop-button').addEventListener('click',()=>stopGame());
  $('#listen-back-button').addEventListener('click',()=>{(state.listeningBack?Promise.resolve(stopListenBack()):startListenBack()).catch(showStartError);});
  $('#play-again-button').addEventListener('click',()=>{if(state.listeningBack)stopListenBack();startGame().catch(showStartError);});$('#results-title-button').addEventListener('click',()=>{if(state.listeningBack)stopListenBack();stopGame();});
  $('#learn-close-button').addEventListener('click',stopGame);$('#learn-next-button').addEventListener('click',()=>{if(state.learnPhase==='lesson')startLearnSkillSession();else if(state.learnPhase==='synthesis-prompt')startLearnSynthesis();});$('#stone-retry-button').addEventListener('click',()=>{if(state.learnRunKind==='final')startLearnSynthesis();else continueLearnAfterResult();});$('#stone-title-button').addEventListener('click',stopGame);
  $('#dismiss-banner').addEventListener('click',()=>{$('#compatibility-banner').hidden=true;});$('#dev-export-button').addEventListener('click',exportDemoSession);

  async function loadProgression(){
    try{
      const response=await fetch('progression.json');
      if(!response.ok)throw new Error(`progression.json returned ${response.status}`);
      state.progression=await response.json();
      document.documentElement.dataset.progressionSource='json';
    }catch(error){
      console.warn('progression.json unavailable; using the inline fallback.',error);
      state.progression=INLINE_PROGRESSION;
      document.documentElement.dataset.progressionSource='inline';
    }
    renderStrip();
  }
  function updatePlayAvailability(){const button=$('#play-button'),learn=$('#learn-button'),demo=$('#demo-button'),calibrate=$('#calibrate-button');if(state.progression&&window.Tone){button.disabled=false;button.textContent='PLAY';learn.disabled=false;demo.disabled=false;calibrate.disabled=false;}}
  function init(){
    if(DEV_MODE){window.BopLearnDev=Object.freeze({skills:SKILL_LIBRARY,stones:STONES,calculateStoneResult});window.BopHandsDev=Object.freeze({pedal:handlePedalCc,idleNote:handleIdleNoteStart});}buildPiano();updateInputStatus();updateFirstRunCalibrationInvite();updateStoneClearedUI();initCompatibilityNotice();$('#dev-export-button').hidden=!DEV_MODE;initMidi();
    state.progressionReady=loadProgression().then(updatePlayAvailability).catch((error)=>{console.error('Unable to load progression:',error);$('#title-input-status').textContent='PROGRESSION UNAVAILABLE — SERVE THIS FOLDER OVER HTTP';$('#play-button').textContent='PROGRESSION UNAVAILABLE';});
    state.toneReady=loadTone().then(()=>{setupAudio();preloadPiano();updateLatencyHud();updatePlayAvailability();}).catch((error)=>{console.error('Unable to load Tone.js:',error);$('#title-input-status').textContent='AUDIO FAILED TO LOAD — CHECK YOUR CONNECTION';$('#play-button').textContent='AUDIO UNAVAILABLE';});
    state.vexReady=loadVexFlow().catch((error)=>{console.error('Unable to load VexFlow:',error);throw error;});
  }
  init();
})();
