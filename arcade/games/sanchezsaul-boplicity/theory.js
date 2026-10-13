(() => {
  'use strict';

  const WEIGHTS = Object.freeze({
    GUIDE_TONE:150,
    CHORD_TONE:50,
    GUIDE_WEAK:50,
    CHORD_WEAK:25,
    COLOR_TONE:25,
    ARPEGGIO:200,
    ENCLOSURE:250,
    PASSING_TONE:25,
    SUS_RESOLUTION:50,
    UNRESOLVED_HARD:-100,
    TRIPLET:100,
    UPBEAT_ENTRY:75
  });
  const BIRD_PAR = Object.freeze({harmony:165,melody:95,rhythm:50,total:310});
  const CONFIG = Object.freeze({VELOCITY_GHOST:20,BIRD_PAR,SWING_OFFBEAT_MIN:.5,SWING_OFFBEAT_MAX:.72});

  const CHORD_FORMULAS=Object.freeze({minor7:{tones:[0,3,7,10],guides:{3:'3rd',10:'7th'}},dominant7:{tones:[0,4,7,10],guides:{4:'3rd',10:'7th'}},major7:{tones:[0,4,7,11],guides:{4:'3rd',11:'7th'}}});
  const ROOT_PITCH_CLASSES=Object.freeze({C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11});
  const KEY_SPECS=Object.freeze({C:{root:0,side:'nat'},Db:{root:1,side:'flat'},D:{root:2,side:'sharp'},Eb:{root:3,side:'flat'},E:{root:4,side:'sharp'},F:{root:5,side:'flat'},Gb:{root:6,side:'flat'},G:{root:7,side:'sharp'},Ab:{root:8,side:'flat'},A:{root:9,side:'sharp'},Bb:{root:10,side:'flat'},B:{root:11,side:'sharp'}});
  const FLAT_NAMES=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'],SHARP_NAMES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const mod12=value=>((value%12)+12)%12;

  function makeChord(rootPc,quality){
    const formula=CHORD_FORMULAS[quality];if(!formula)throw new Error(`Unknown chord quality: ${quality}`);const root=mod12(Number(rootPc)),tones=formula.tones.map(interval=>mod12(root+interval)),guides=Object.keys(formula.guides).map(Number).map(interval=>mod12(root+interval)),degrees={};Object.entries(formula.guides).forEach(([interval,label])=>{degrees[mod12(root+Number(interval))]=label;});return{root,quality,tones,guides,degrees};
  }

  function chordFromSymbol(symbol){
    const match=String(symbol).match(/^([A-G](?:#|b)?)(m7|maj7|7)$/);if(!match)throw new Error(`Unknown chord: ${symbol}`);const quality=match[2]==='m7'?'minor7':match[2]==='maj7'?'major7':'dominant7';return makeChord(ROOT_PITCH_CLASSES[match[1]],quality);
  }

  function bassNoteName(midi,side){const names=side==='sharp'?SHARP_NAMES:FLAT_NAMES;return`${names[mod12(midi)]}${Math.floor(midi/12)-1}`;}

  function progressionForKey(keyName){
    const spec=KEY_SPECS[keyName];if(!spec)throw new Error(`Unknown key: ${keyName}`);const chordRoots=[mod12(spec.root+2),mod12(spec.root+7),spec.root,spec.root],suffixes=['m7','7','maj7','maj7'],names=spec.side==='sharp'?SHARP_NAMES:FLAT_NAMES;
    const bars=chordRoots.map((rootPc,index)=>{const rootMidi=36+rootPc,fifthMidi=rootMidi+7>52?rootMidi-5:rootMidi+7;return{symbol:`${names[rootPc]}${suffixes[index]}`,root:bassNoteName(rootMidi,spec.side),fifth:bassNoteName(fifthMidi,spec.side)};});
    return{id:`ii-v-i-${keyName.toLowerCase()}`,name:`ii–V–I in ${keyName}`,timeSignature:[4,4],bars};
  }

  const CHORDS = Object.freeze({Gm7:makeChord(7,'minor7'),C7:makeChord(0,'dominant7'),Fmaj7:makeChord(5,'major7')});

  const blankStats=()=>({guideTones:0,otherChordTones:0,colorTones:0,arpeggios:0,enclosures:0,passingTones:0,diatonicSteps:0,chromaticApproaches:0,unresolved:0,triplets:0,upbeatEntries:0,phrases3:0,rhythmicGaps:0,eighthGaps:0,doubleTimeLines:0,longestCombo:0,harmonyBasePoints:0,melodyBasePoints:0,rhythmBasePoints:0,timingDeviationTotalMs:0,timingAttackCount:0});
  const blankPhrase=()=>({count:0,pendingUpbeatId:null,doubleTimeRun:0,doubleTimeFired:false,fastNoteIds:[]});
  const createState=()=>({recent:[],pending:[],tripletBars:[],barBasePoints:[],phrase:blankPhrase(),combo:0,multiplier:1,baseScore:0,arcadeScore:0,stats:blankStats()});
  const pitchClass=(midi)=>((midi%12)+12)%12;

  function sessionPositionFromTicks(ticks,ppq=192,countOffBars=2){
    const beats=Number(ticks)/Number(ppq)-countOffBars*4;
    return{bar:Math.max(0,Math.floor(beats/4)),beat:Math.max(0,((beats%4)+4)%4)};
  }

  function gradeFor(points,barsPlayed,parPerBar){if(points<=0||barsPlayed<=0||parPerBar<=0)return 0;return Math.min(100,Math.round(100*points/(barsPlayed*parPerBar)));}
  function hardGradeFor(points,barsPlayed,parPerBar){if(points<=0||barsPlayed<=0||parPerBar<=0)return 0;const ratio=points/(barsPlayed*parPerBar);return Math.min(100,Math.round(100*Math.pow(ratio/1.15,1.6)));}
  function gradeBand(grade){return grade>=95?'Legend':grade>=85?'Headliner':grade>=75?'Bandleader':grade>=65?'Gigging':grade>=50?'Sideman':grade>=35?'Comping':grade>=20?'Jam Session':'Woodshedding';}
  function rhythmicProfile(stats,barsPlayed){
    const gaps=stats.rhythmicGaps||0,phrases=stats.phrases3||0,share=gaps?Math.max(0,Math.min(1,(stats.eighthGaps||0)/gaps)):0;
    const eighthFlow=Math.round(share>=.4?100:share>=.15?40+60*(share-.15)/.25:40*share/.15);
    const tripletSprinkle=barsPlayed>0?Math.round(Math.min(100,(stats.triplets||0)/(barsPlayed/4)*100)):0;
    const upbeatRate=phrases?Math.round(Math.min(100,((stats.upbeatEntries||0)/phrases)/.65*100)):0;
    const applied=phrases>=4&&gaps>=10,profile=Math.round((eighthFlow+tripletSprinkle+upbeatRate)/3);
    return{applied,profile,eighthFlow,tripletSprinkle,upbeatRate,eighthShare:share,qualifyingGaps:gaps,phrases3:phrases};
  }
  function calculateGrades(state,barsPlayed,options={}){
    const hardMode=!!options.hardMode,grader=hardMode?hardGradeFor:gradeFor;
    const harmony=grader(state.stats.harmonyBasePoints,barsPlayed,BIRD_PAR.harmony),melody=grader(state.stats.melodyBasePoints,barsPlayed,BIRD_PAR.melody),rhythmPoints=gradeFor(state.stats.rhythmBasePoints,barsPlayed,BIRD_PAR.rhythm),rhythmProfile=rhythmicProfile(state.stats,barsPlayed);
    const blendedRhythm=rhythmProfile.applied?Math.round(.6*rhythmPoints+.4*rhythmProfile.profile):rhythmPoints;
    const rhythm=rhythmProfile.applied?(hardMode?hardGradeFor(blendedRhythm,1,100):blendedRhythm):grader(state.stats.rhythmBasePoints,barsPlayed,BIRD_PAR.rhythm);
    let overall=Math.round((harmony*BIRD_PAR.harmony+melody*BIRD_PAR.melody+rhythm*BIRD_PAR.rhythm)/BIRD_PAR.total);
    if(hardMode&&state.stats.unresolved>0)overall=Math.min(95,overall);
    return{overall,band:gradeBand(overall),harmony,melody,rhythm,rhythmPoints,rhythmProfile};
  }

  function timeFeelReport(stats){
    const count=stats.timingAttackCount||0;if(!count)return{averageMs:null,text:'Average deviation: — · No grid attacks recorded.'};
    const rawAverage=stats.timingDeviationTotalMs/count,averageMs=Math.round(rawAverage),magnitude=Math.abs(averageMs),placement=averageMs<0?'ahead':averageMs>0?'behind':'centered';
    const read=rawAverage < -15?`You're rushing ~${magnitude}ms — relax into the pocket`:rawAverage>40?`You're dragging ~${magnitude}ms`:rawAverage>15?'Nice laid-back placement':'Locked in.';
    return{averageMs,text:`Average deviation: ${averageMs>0?'+':''}${averageMs}ms (${placement}) · ${read}`};
  }

  function consistencyReport(state,barsPlayed=16,windowSize=4){
    const windowCount=Math.max(1,Math.ceil(barsPlayed/windowSize)),windows=Array.from({length:windowCount},(_,window)=>Array.from({length:windowSize},(_,offset)=>state.barBasePoints[window*windowSize+offset]||0).reduce((sum,value)=>sum+value,0));
    const strongestIndex=windows.indexOf(Math.max(...windows)),weakestIndex=windows.indexOf(Math.min(...windows)),range=index=>`${index*windowSize+1}-${Math.min(barsPlayed,(index+1)*windowSize)}`;
    const lastIsWeakest=windows.length>1&&windows[windows.length-1]<Math.min(...windows.slice(0,-1));
    return{windows,strongest:range(strongestIndex),weakest:range(weakestIndex),lastIsWeakest,text:`Strongest bars: ${range(strongestIndex)} · Weakest bars: ${range(weakestIndex)}`};
  }

  function createChordContext(symbol,accidentalSide=''){
    const chord=chordFromSymbol(symbol);
    const context={symbol,root:chord.root,quality:chord.quality,tones:[...chord.tones],guides:[...chord.guides],degrees:{...chord.degrees}};if(accidentalSide)context.accidentalSide=accidentalSide;return context;
  }

  const isChordTone=(midi,chord)=>chord.tones.includes(pitchClass(midi));
  const chordInterval=(midi,chord)=>(pitchClass(midi)-chord.root+12)%12;
  const isProtectedColor=(midi,chord)=>(chord.quality==='dominant7'&&[1,3,6,8,9].includes(chordInterval(midi,chord)))||(chord.quality==='major7'&&chordInterval(midi,chord)===9);
  const isDominantFourth=(midi,chord)=>chord.quality==='dominant7'&&chordInterval(midi,chord)===5;
  const ids=(...notes)=>notes.map(note=>note&&note.id).filter(id=>id!==undefined&&id!==null);

  function spellNote(midi,chord){
    const pc=pitchClass(midi),octave=Math.floor(midi/12)-1;
    const dominant=['c','db','d','eb','e','f','f#','g','ab','a','bb','b'];
    const flatKey=['c','db','d','eb','e','f','gb','g','ab','a','bb','b'];
    const sharpKey=['c','c#','d','d#','e','f','f#','g','g#','a','a#','b'];
    return`${(chord.accidentalSide==='sharp'?sharpKey:chord.quality==='dominant7'?dominant:flatKey)[pc]}/${octave}`;
  }
  const multiplierFor=(combo)=>combo>=15?4:combo>=10?3:combo>=5?2:1;
  const cloneState=(state)=>({...state,recent:[...state.recent],pending:[...state.pending],tripletBars:[...state.tripletBars],barBasePoints:[...(state.barBasePoints||[])],phrase:{...blankPhrase(),...(state.phrase||{}),fastNoteIds:[...(state.phrase?.fastNoteIds||[])]},stats:{...state.stats}});
  const categoryForEvent=(event)=>['guide-tone','chord-tone','color-tone','sus-resolution'].includes(event.type)?'harmony':['arpeggio','enclosure','passing-tone'].includes(event.type)?'melody':['upbeat-entry','triplet'].includes(event.type)?'rhythm':'';

  function applyScoringEvents(inputState,events){
    const state=cloneState(inputState);
    for(const event of events){
      const basePoints=event.points||0;
      state.baseScore+=basePoints;
      if(event.type==='unresolved')state.combo=0;
      else if(basePoints>0)state.combo++;
      state.multiplier=multiplierFor(state.combo);
      state.arcadeScore+=basePoints>0?basePoints*state.multiplier:basePoints;
      if(Number.isInteger(event.bar))state.barBasePoints[event.bar]=(state.barBasePoints[event.bar]||0)+basePoints;
      if(event.stat)state.stats[event.stat]=(state.stats[event.stat]||0)+1;
      for(const stat of event.extraStats||[])state.stats[stat]=(state.stats[stat]||0)+1;
      if(basePoints>0){const category=categoryForEvent(event);if(category)state.stats[`${category}BasePoints`]+=basePoints;}
      state.stats.longestCombo=Math.max(state.stats.longestCombo,state.combo);
    }
    return{state,events};
  }

  function unresolvedEvent(hardMode,note){
    return{type:'unresolved',points:hardMode?WEIGHTS.UNRESOLVED_HARD:0,label:hardMode?'Unresolved −100':'Unresolved',tone:'negative',stat:'unresolved',bar:note.bar,noteIds:ids(note)};
  }

  function departureEvent(note){
    return{type:'departure-tone',points:0,label:'Try a chromatic approach',tone:'neutral',hint:true,stat:'diatonicSteps',bar:note.bar,noteIds:ids(note)};
  }

  function expirePending(inputState,now,hardMode=false){
    const state=cloneState(inputState);const events=[];const remaining=[];
    for(const item of state.pending){
      if(now-item.note.time>item.note.beatDuration)events.push(item.departure?departureEvent(item.note):unresolvedEvent(hardMode,item.note));
      else remaining.push(item);
    }
    state.pending=remaining;
    return applyScoringEvents(state,events);
  }

  function isStrongBeat(note){
    const nearest=Math.round(note.beat);const ms=Math.abs(note.beat-nearest)*note.beatDuration*1000;
    return(nearest===0||nearest===2)&&ms<=90;
  }

  function isWeakBeat(note){
    const nearest=Math.round(note.beat);const ms=Math.abs(note.beat-nearest)*note.beatDuration*1000;
    return(nearest===1||nearest===3)&&ms<=90;
  }

  function isOffbeat(note,feel='swing'){
    const fraction=((note.beat%1)+1)%1,tolerance=90/(note.beatDuration*1000);
    return feel==='straight'?Math.abs(fraction-.5)<=tolerance:fraction>=CONFIG.SWING_OFFBEAT_MIN-tolerance&&fraction<=CONFIG.SWING_OFFBEAT_MAX+tolerance;
  }

  function isAnticipation(note,feel='swing'){
    return Math.floor(note.beat)===3&&isOffbeat(note,feel);
  }

  function scoreHeldAnticipation(input={}){
    const onsetBeat=Number(input.onsetBeat),durationBeats=Number(input.durationBeats),beatDuration=Number(input.beatDuration)||.5,feel=input.feel==='straight'?'straight':'swing',chord=input.chordContext,pc=Number.isFinite(Number(input.pitchClass))?mod12(Number(input.pitchClass)):Number.isFinite(Number(input.midi))?pitchClass(Number(input.midi)):NaN;
    if(!Number.isFinite(onsetBeat)||!Number.isFinite(durationBeats)||durationBeats<=.5||!chord||!isOffbeat({beat:onsetBeat,beatDuration},feel)||!chord.tones.includes(pc))return 0;
    const followingBeat=(Math.floor(onsetBeat)+1)%4,strong=followingBeat===0||followingBeat===2,guide=chord.guides.includes(pc),points=guide?(strong?WEIGHTS.GUIDE_TONE:WEIGHTS.GUIDE_WEAK):(strong?WEIGHTS.CHORD_TONE:WEIGHTS.CHORD_WEAK),degree=guide?chord.degrees[pc]:undefined,label=guide?(strong?`${degree} anticipation +${points}`:`Guide tone +${points}`):`Chord tone +${points}`;
    return{type:guide?'guide-tone':'chord-tone',points,label,tone:'positive',stat:guide?'guideTones':'otherChordTones',degree,anticipation:true,heldAnticipation:true,weakBeat:!strong,bar:input.bar,noteIds:input.noteId===undefined?[]:[input.noteId],firedOn:input.noteId};
  }

  function isDeparturePosition(note,feel='swing'){
    if(isStrongBeat(note))return false;
    if(isWeakBeat(note))return true;
    return isOffbeat(note,feel);
  }

  const isUpbeat=(note,feel='swing')=>isOffbeat(note,feel);

  function timingDeviationMs(note,feel='swing'){
    const nearestBeat=Math.round(note.beat),onBeatMs=(note.beat-nearestBeat)*note.beatDuration*1000;
    if(Math.abs(onBeatMs)<=90)return onBeatMs;
    if(!isOffbeat(note,feel))return null;
    const gridOffset=feel==='straight'?.5:.62,target=Math.floor(note.beat)+gridOffset;
    return(note.beat-target)*note.beatDuration*1000;
  }

  function recordTiming(state,note,feel){const deviation=timingDeviationMs(note,feel);if(deviation===null)return;state.stats.timingDeviationTotalMs+=deviation;state.stats.timingAttackCount++;}

  function updatePhraseState(state,note,previous,feel,events){
    const gapBeats=previous?(note.time-previous.time)/note.beatDuration:Infinity,newPhrase=!previous||gapBeats>=1;
    if(previous&&gapBeats>=0&&gapBeats<1.6){state.stats.rhythmicGaps++;if(gapBeats>=.35&&gapBeats<=.75)state.stats.eighthGaps++;}
    if(newPhrase){state.phrase={count:1,pendingUpbeatId:previous&&isUpbeat(note,feel)?note.id:null,doubleTimeRun:1,doubleTimeFired:false,fastNoteIds:[note.id].filter(Boolean)};return;}
    state.phrase.count++;state.phrase.doubleTimeRun=gapBeats<=.35?state.phrase.doubleTimeRun+1:1;state.phrase.fastNoteIds=gapBeats<=.35?[...state.phrase.fastNoteIds,note.id].filter(Boolean).slice(-6):[note.id].filter(Boolean);
    if(state.phrase.count===3)state.stats.phrases3++;
    if(state.phrase.count===3&&state.phrase.pendingUpbeatId){events.push({type:'upbeat-entry',points:WEIGHTS.UPBEAT_ENTRY,label:'Upbeat entry +75',tone:'positive',stat:'upbeatEntries',bankedPopup:true,noteIds:[state.phrase.pendingUpbeatId],firedOn:note.id,bar:note.bar});state.phrase.pendingUpbeatId=null;}
    if(state.phrase.doubleTimeRun>=6&&!state.phrase.doubleTimeFired){events.push({type:'double-time',points:0,label:'Double time!',tone:'positive',recognition:true,stat:'doubleTimeLines',bankedPopup:true,noteIds:[...state.phrase.fastNoteIds],firedOn:note.id,bar:note.bar});state.phrase.doubleTimeFired=true;}
  }

  function enclosureEvent(recent,note,chord){
    if(!isChordTone(note.midi,chord)||recent.length<2)return null;
    const approaches=recent.slice(-2);
    if(!approaches.every(approach=>note.time-approach.time>=0&&note.time-approach.time<=note.beatDuration*2))return null;
    const a=approaches[0].midi-note.midi,b=approaches[1].midi-note.midi;
    if(a*b<0&&Math.abs(a)<=2&&Math.abs(b)<=2)return{type:'enclosure',points:WEIGHTS.ENCLOSURE,label:'Enclosure! +250',tone:'positive',stat:'enclosures',extraStats:Math.abs(a)===1||Math.abs(b)===1?['chromaticApproaches']:[],noteIds:ids(recent[recent.length-2],recent[recent.length-1],note),firedOn:note.id};
    return null;
  }

  function arpeggioEvent(recent,note,chord){
    if(recent.length<2)return null;
    const notes=[recent[recent.length-2],recent[recent.length-1],note];
    if(!notes.every(item=>isChordTone(item.midi,chord)))return null;
    if(!notes.slice(0,2).every(item=>item.chordSymbol===chord.symbol))return null;
    if(!notes.every(item=>item.bar===note.bar)||note.time-notes[0].time>note.beatDuration*4)return null;
    const d1=notes[1].midi-notes[0].midi,d2=notes[2].midi-notes[1].midi;
    if(!d1||!d2||Math.sign(d1)!==Math.sign(d2))return null;
    if(recent.length>=3){const prior=recent[recent.length-3];if(prior.chordSymbol===chord.symbol&&isChordTone(prior.midi,chord)&&Math.sign(notes[0].midi-prior.midi)===Math.sign(d1))return null;}
    return{type:'arpeggio',points:WEIGHTS.ARPEGGIO,label:'Arpeggio +200',tone:'positive',stat:'arpeggios',noteIds:ids(...notes),firedOn:note.id};
  }

  function tripletEvent(state,note){
    if(state.recent.length<2)return null;
    const notes=[state.recent[state.recent.length-2],state.recent[state.recent.length-1],note];
    if(!notes.every(item=>item.bar===note.bar))return null;
    const a=notes[1].time-notes[0].time,b=notes[2].time-notes[1].time,eighthPerfect=note.beatDuration/3,quarterPerfect=note.beatDuration*2/3,within=perfect=>Math.abs(a-perfect)<=perfect*.12&&Math.abs(b-perfect)<=perfect*.12;
    const tripletKind=within(eighthPerfect)?'eighth':within(quarterPerfect)?'quarter':'';if(!tripletKind)return null;
    const noteIds=ids(...notes),capped=state.tripletBars.includes(note.bar);
    return{tripletKind,notes,noteIds,capped,event:capped?null:{type:'triplet',tripletKind,points:WEIGHTS.TRIPLET,label:'Triplet +100',tone:'positive',stat:'triplets',noteIds,firedOn:note.id,groupId:`triplet-${tripletKind}-${note.id??note.bar}`}};
  }

  function processNote(inputState,note,chord,options={}){
    let state=cloneState(inputState);let events=[];
    const feel=options.feel==='straight'?'straight':'swing';
    recordTiming(state,note,feel);
    if(Number(note.velocity)<CONFIG.VELOCITY_GHOST)return applyScoringEvents(state,[{type:'ghost-note',points:0,label:'Ghost note',tone:'neutral',ghost:true,silent:true,bar:note.bar,noteIds:ids(note),firedOn:note.id}]);
    const currentIsChordTone=isChordTone(note.midi,chord),upbeat=isOffbeat(note,feel),targetChord=upbeat?(Math.floor(note.beat)===3&&options.nextChord?options.nextChord:chord):null,deferredAnticipation=targetChord&&isChordTone(note.midi,targetChord)?{pitchClass:pitchClass(note.midi),chordContext:{...targetChord,tones:[...targetChord.tones],guides:[...targetChord.guides],degrees:{...targetChord.degrees}},onsetBeat:note.beat,beatDuration:note.beatDuration,feel,bar:note.bar,noteId:note.id}:null;
    const previous=state.recent[state.recent.length-1];
    const isDeparture=!currentIsChordTone&&isDeparturePosition(note,feel)&&previous&&previous.chordSymbol===chord.symbol&&previous.isChordTone&&Math.abs(note.midi-previous.midi)>=1&&Math.abs(note.midi-previous.midi)<=2;
    const triplet=tripletEvent(state,note),tripletContains=candidate=>triplet?.capped&&triplet.notes.some(member=>member.id!==undefined&&candidate.id!==undefined?member.id===candidate.id:member.time===candidate.time&&member.midi===candidate.midi);

    const remaining=[];
    for(const item of state.pending){
      if(tripletContains(item.note))continue;
      const age=note.time-item.note.time;
      const susToThird=item.isDominantFourth&&item.chordSymbol===chord.symbol&&note.midi===item.note.midi-1&&pitchClass(note.midi)===(chord.root+4)%12;
      const nextChordBarline=item.isDominantFourth&&item.chordSymbol!==chord.symbol&&note.bar===item.note.bar+1&&Math.abs(note.beat)*note.beatDuration*1000<=90;
      if(currentIsChordTone&&age<=item.note.beatDuration&&age>=0&&susToThird){
        events.push({type:'sus-resolution',points:WEIGHTS.SUS_RESOLUTION,label:'Sus resolution +50',tone:'positive',noteIds:ids(note),sourceNoteId:item.note.id,firedOn:note.id});
      }else if(currentIsChordTone&&age<=item.note.beatDuration&&age>=0&&nextChordBarline&&Math.abs(note.midi-item.note.midi)<=2){
        events.push({type:'passing-tone',points:WEIGHTS.PASSING_TONE,label:'Chromatic ✓ +25',tone:'neutral',stat:'passingTones',extraStats:Math.abs(note.midi-item.note.midi)===1?['chromaticApproaches']:[],noteIds:ids(item.note),firedOn:note.id});
      }else if(currentIsChordTone&&age<=item.note.beatDuration&&age>=0&&Math.abs(note.midi-item.note.midi)<=2){
        events.push({type:'passing-tone',points:WEIGHTS.PASSING_TONE,label:'Chromatic ✓ +25',tone:'neutral',stat:'passingTones',extraStats:Math.abs(note.midi-item.note.midi)===1?['chromaticApproaches']:[],noteIds:ids(item.note),firedOn:note.id});
      }else if(age>item.note.beatDuration){
        events.push(item.departure?departureEvent(item.note):unresolvedEvent(!!options.hardMode,item.note));
      }else remaining.push(item);
    }
    state.pending=remaining;

    if(currentIsChordTone&&!upbeat&&isStrongBeat(note)){
      const pc=pitchClass(note.midi);
      if(chord.guides.includes(pc))events.push({type:'guide-tone',points:WEIGHTS.GUIDE_TONE,label:`${chord.degrees[pc]} on the downbeat +150`,tone:'positive',stat:'guideTones',degree:chord.degrees[pc],noteIds:ids(note),firedOn:note.id});
      else events.push({type:'chord-tone',points:WEIGHTS.CHORD_TONE,label:'Chord tone +50',tone:'positive',stat:'otherChordTones',noteIds:ids(note),firedOn:note.id});
    }else if(currentIsChordTone&&!upbeat&&isWeakBeat(note)){
      const pc=pitchClass(note.midi);
      if(chord.guides.includes(pc))events.push({type:'guide-tone',points:WEIGHTS.GUIDE_WEAK,label:'Guide tone +50',tone:'positive',stat:'guideTones',degree:chord.degrees[pc],weakBeat:true,noteIds:ids(note),firedOn:note.id});
      else events.push({type:'chord-tone',points:WEIGHTS.CHORD_WEAK,label:'Chord tone +25',tone:'positive',stat:'otherChordTones',weakBeat:true,noteIds:ids(note),firedOn:note.id});
    }

    if(!deferredAnticipation&&!currentIsChordTone&&isProtectedColor(note.midi,chord))events.push({type:'color-tone',points:WEIGHTS.COLOR_TONE,label:'Color tone +25',tone:'positive',stat:'colorTones',noteIds:ids(note),firedOn:note.id});

    const enclosure=enclosureEvent(state.recent,note,chord);if(enclosure)events.push(enclosure);
    const arpeggio=arpeggioEvent(state.recent,note,chord);if(arpeggio)events.push(arpeggio);
    if(triplet?.event){events.push(triplet.event);state.tripletBars.push(note.bar);}
    updatePhraseState(state,note,previous,feel,events);

    if(!triplet?.capped&&!deferredAnticipation&&!currentIsChordTone&&!isProtectedColor(note.midi,chord))state.pending.push({note:{...note},chordSymbol:chord.symbol,isDominantFourth:isDominantFourth(note.midi,chord),departure:!!isDeparture});
    state.recent.push({...note,chordSymbol:chord.symbol,isChordTone:currentIsChordTone});
    state.recent=state.recent.slice(-16);
    events.forEach(event=>{if(!Number.isInteger(event.bar))event.bar=note.bar;});
    return{...applyScoringEvents(state,events),deferredAnticipation};
  }

  function advanceTime(state,now,options={}){return expirePending(state,now,!!options.hardMode);}

  window.BopTheory=Object.freeze({WEIGHTS,CONFIG,makeChord,chordFromSymbol,progressionForKey,createState,createChordContext,isChordTone,spellNote,sessionPositionFromTicks,gradeFor,gradeBand,calculateGrades,timeFeelReport,consistencyReport,timingDeviationMs,scoreHeldAnticipation,processNote,advanceTime,applyScoringEvents});
})();
