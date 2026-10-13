import { Chess } from './vendor/chess.mjs';
import { createState,applyAction,settleState,legalLudo,publicState } from './room-engine.mjs';
import { createRummy,rummyAction,rummyBot,findMelds,initialMeldPlan,cardValue,createProperty,propertyAction,propertyBot,PROPERTY_TILES,ownsGroup,propertyWealth,chooseChessMove } from './extra-rules.mjs';
const THEMES=[['system','Wie mein Gerät'],['light','Wald · Hell'],['dark','Wald · Dunkel'],['ocean','Ozean'],['lavender','Lavendel'],['sunset','Sonnenuntergang'],['midnight','Mitternacht']];
const SYMBOLS=['🌿','🍄','🌻','🍋','🐸','🦋','🍒','🐝','🐬','🦊','🌙','🍉','🐳','🌈','🌸','🐧','🍇','⭐','🍓','🦉','🐢','🌵','🦄','🎈'];
window.makeRoomChess=history=>{const chess=new Chess();history.forEach(m=>chess.move(m));return chess};
const PIECES={w:{k:'♔',q:'♕',r:'♖',b:'♗',n:'♘',p:'♙'},b:{k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'}};
const LEVEL={easy:'Leicht',medium:'Mittel',hard:'Schwer'};
const options=(items,value)=>items.map(([v,t])=>`<option value="${v}" ${String(v)===String(value)?'selected':''}>${t}</option>`).join('');
const numbers=(min,max,suffix)=>Array.from({length:max-min+1},(_,i)=>[min+i,(min+i)+' '+suffix]);
if(!['easy','medium','hard'].includes(settings.difficulty))settings.difficulty='medium';
if(![4,6,8,12,16,24].includes(settings.memoryPairs))settings.memoryPairs=8;
settings.bots=Math.max(0,Math.min(5,Number(settings.bots)||0));settings.humans=Math.max(1,Math.min(6,Number(settings.humans)||1));
const settingsTabs=settingsDialog.querySelector('.detail-tabs');
const gamesTab=document.createElement('button');gamesTab.dataset.settingtab='games';gamesTab.setAttribute('role','tab');gamesTab.textContent='Spiele & Bots';settingsTabs.append(gamesTab);
const baseSettings=openSettings;
openSettings=function(section='appearance'){
  if(section!=='games')baseSettings(section);
  else{
    settingsTabs.querySelectorAll('button').forEach(b=>{const on=b.dataset.settingtab===section;b.classList.toggle('active',on);b.setAttribute('aria-selected',on);b.onclick=()=>openSettings(b.dataset.settingtab)});
    $('#settings-body').innerHTML=`<label class="field">Bot-Stärke<select id="setting-difficulty">${options(Object.entries(LEVEL),settings.difficulty)}</select></label><div class="settings-grid"><label class="field">Menschen am Gerät<select id="setting-humans">${options(numbers(1,6,'Person(en)'),settings.humans)}</select></label><label class="field">Bots hinzufügen<select id="setting-bots">${options(numbers(0,5,'Bot(s)'),settings.bots)}</select></label></div><label class="field">Memory: Anzahl der Paare<select id="setting-pairs">${options([4,6,8,12,16,24].map(n=>[n,n+' Paare · '+n*2+' Karten']),settings.memoryPairs)}</select></label><div class="bot-guide"><strong>Deine nächste Runde</strong><p>Die Vorgaben gelten beim Start eigener Spiele. Du kannst die Plätze auch direkt im Spiel ändern. Eine Änderung beginnt eine neue Runde.</p><p>Schach, Tic-Tac-Toe, Vier gewinnt, Mühle und Mau-Mau: zwei Plätze. Laufspiel: bis zu vier Plätze. Rommé, Stadt & Straßen und Memory: bis zu sechs Plätze. Bots belegen jeweils einen Platz.</p><p>Leicht spielt lockerer, Mittel plant einfache Kombinationen, Schwer wählt taktischere Züge. Memory-Bots merken sich nur bereits aufgedeckte Karten. Diese Bots spielen am selben Gerät; Netzwerk-Räume werden von Menschen besetzt.</p></div>`;
    for(const[id,key]of [['difficulty','difficulty'],['humans','humans'],['bots','bots'],['pairs','memoryPairs']])$('#setting-'+id).onchange=e=>{settings[key]=key==='difficulty'?e.target.value:+e.target.value;applySettings()};
    showDialog('#settings-dialog');$('.sidebar').classList.remove('open');
  }
  if(section==='appearance'){
    const swatches=document.createElement('div');swatches.className='theme-swatches';swatches.setAttribute('aria-label','Themes');swatches.innerHTML=THEMES.filter(([id])=>id!=='system').map(([id,name])=>`<button class="theme-swatch ${settings.theme===id?'active':''}" data-theme-choice="${id}" aria-pressed="${settings.theme===id}"><span class="theme-preview preview-${id}"><i></i><i></i><i></i></span>${name}</button>`).join('');$('#setting-theme').closest('label').after(swatches);swatches.querySelectorAll('button').forEach(b=>b.onclick=()=>{settings.theme=b.dataset.themeChoice;applySettings();openSettings('appearance')});
  }
};
gamesTab.onclick=()=>openSettings('games');
window.extraGames={chess:ctx=>playSession('chess',ctx),romme:ctx=>playSession('romme',ctx),property:ctx=>playSession('property',ctx)};
playMemory=ctx=>playSession('memory',ctx);
playLudo=ctx=>playSession('ludo',ctx);
window.drawChessBoard=function(root,chess,enabled,onMove){
  let selected=null;root.innerHTML='<div class="chess-toolbar"><label>Bauernumwandlung <select aria-label="Bauernumwandlung"><option value="q">Dame</option><option value="r">Turm</option><option value="b">Läufer</option><option value="n">Springer</option></select></label></div><div class="chess-board" role="group" aria-label="Schachbrett"></div>';
  const board=root.querySelector('.chess-board'),promotion=root.querySelector('select');
  function draw(){const moves=selected?chess.moves({square:selected,verbose:true}):[];board.innerHTML=chess.board().flat().map((p,i)=>{const square='abcdefgh'[i%8]+(8-Math.floor(i/8)),legal=moves.some(m=>m.to===square);return `<button class="chess-square ${(Math.floor(i/8)+i%8)%2?'chess-dark':'chess-light'} ${selected===square?'selected':''} ${legal?'legal':''} ${p?.color==='w'?'white-piece':'black-piece'}" data-square="${square}" aria-label="${square}: ${p?({p:'Bauer',n:'Springer',b:'Läufer',r:'Turm',q:'Dame',k:'König'}[p.type])+' '+(p.color==='w'?'weiß':'schwarz'):'leer'}" ${enabled?'':'disabled'}><span>${p?PIECES[p.color][p.type]:''}</span><small>${square}</small></button>`}).join('');board.querySelectorAll('button').forEach(b=>b.onclick=()=>{const square=b.dataset.square,p=chess.get(square);if(selected&&moves.some(m=>m.to===square)){onMove({type:'move',from:selected,to:square,promotion:promotion.value});return}selected=p?.color===chess.turn()?square:null;draw()})}draw();
};
function playSession(game,{root,later,signal}){
  const max=game==='chess'?2:game==='ludo'?4:6,min=game==='memory'?1:2;
  let humans=Math.min(settings.humans,max),bots=Math.min(settings.bots,max-humans);if(humans+bots<min)bots=min-humans;
  let level=settings.difficulty,pairs=settings.memoryPairs,state,epoch=0,busy=false,queued=false,selected=[],staged=[],memorySeen=new Map(),revealedFor=null,hiddenHand=false,chessSelected=null;
  const names=()=>Array.from({length:humans+bots},(_,i)=>i<humans?(humans===1?settings.name:'Person '+(i+1)):'Bot '+(i-humans+1));
  const bot=()=>state.turn>=humans;
  function setup(){
    epoch++;busy=false;queued=false;selected=[];staged=[];memorySeen=new Map();revealedFor=null;hiddenHand=humans>1&&game==='romme';chessSelected=null;
    state=game==='romme'?createRummy(humans+bots):game==='property'?createProperty(humans+bots):createState(game,humans+bots,undefined,{pairs});
    root.innerHTML=`<div class="round-config"><label>Menschen<select id="round-humans" aria-label="Menschen am Gerät">${options(numbers(1,max,'Person(en)'),humans)}</select></label><label>Bots<select id="round-bots" aria-label="Anzahl Bots">${options(numbers(0,max-humans,'Bot(s)'),bots)}</select></label><label>Bot-Stärke<select id="round-level" aria-label="Bot-Stärke">${options(Object.entries(LEVEL),level)}</select></label>${game==='memory'?`<label>Paare<select id="round-pairs" aria-label="Memory-Paare">${options([4,6,8,12,16,24].map(n=>[n,n+' Paare']),pairs)}</select></label>`:''}<button id="round-reset">Neue Runde</button></div><p class="game-instruction">${game==='romme'?'Rommé ohne Joker · zuerst ziehen, Kombinationen auslegen, dann abwerfen.':game==='property'?'Eigene Grundstücksspiel-Variante · kaufen, Miete kassieren und Farbgruppen bebauen.':game==='memory'?'Finde gleiche Paare. Bei einem Treffer bleibst du dran.':game==='ludo'?'Eine Sechs bringt Figuren ins Spiel. Vier Figuren im Ziel gewinnen.':'Wähle eine Figur, dann ein markiertes Zielfeld. Du spielst Weiß.'} Änderungen starten eine neue Runde.</p><div class="seat-strip" id="round-seats"></div><div class="game-status" id="round-status" role="status"></div><div id="extra-board"></div><div id="extra-actions" class="game-controls"></div>`;
    $('#round-humans').onchange=e=>{humans=+e.target.value;bots=Math.min(bots,max-humans);if(humans+bots<min)bots=min-humans;setup()};$('#round-bots').onchange=e=>{bots=+e.target.value;if(humans+bots<min){toast('Dieses Spiel benötigt mindestens zwei Plätze.');bots=min-humans}setup()};$('#round-level').onchange=e=>{level=e.target.value;setup()};if($('#round-pairs'))$('#round-pairs').onchange=e=>{pairs=+e.target.value;setup()};$('#round-reset').onclick=setup;draw();schedule();
  }
  function after(ms,fn){const e=epoch;later(()=>{if(e===epoch&&!signal.aborted)fn()},ms)}
  function act(a){if(busy||state.winner!==null||bot())return;try{step(a);draw();schedule()}catch(e){toast(e.message)}}
  function step(a){const seat=state.turn;const before=state.turn;if(game==='romme')rummyAction(state,seat,a);else if(game==='property')propertyAction(state,seat,a);else applyAction(state,seat,a);if(game==='memory')observe();if(game==='romme'&&state.turn!==before){selected=[];staged=[];revealedFor=null;hiddenHand=humans>1&&!bot()}}
  function observe(){if(game!=='memory')return;for(const i of state.open)if(level==='hard'||level==='medium'&&Math.random()<.7)memorySeen.set(i,state.deck[i]);for(const i of state.matched)memorySeen.delete(i)}
  function schedule(){
    if(queued||signal.aborted||state.winner!==null)return;
    if(game==='memory'&&state.flipAt){queued=true;after(Math.max(1,state.flipAt-Date.now()+20),()=>{queued=false;settleState(state);if(level==='easy')memorySeen.clear();draw();schedule()});return}
    if(!bot())return;queued=true;busy=true;draw();after(550,()=>{queued=false;try{
      if(game==='romme'){rummyBot(state,state.turn,level);selected=[];staged=[];hiddenHand=humans>1&&!bot();revealedFor=null}
      if(game==='property')propertyBot(state,state.turn,level);
      if(game==='chess'){const chess=new Chess();state.history.forEach(m=>chess.move(m));const m=chooseChessMove(chess,level);if(m)applyAction(state,state.turn,{type:'move',from:m.from,to:m.to,promotion:m.promotion||'q'})}
      if(game==='ludo'){
        if(!state.waiting)applyAction(state,state.turn,{type:'roll'});
        else{const legal=state.pieces[state.turn].flatMap((_,i)=>legalLudo(state,state.turn,i)?[i]:[]),seat=state.turn;
          const score=i=>{const old=state.pieces[seat][i],dest=old<0?0:old+state.die,global=(dest+state.colors[seat]*10)%40,capture=state.pieces.some((pieces,p)=>p!==seat&&pieces.some(n=>n>=0&&n<40&&(n+state.colors[p]*10)%40===global));return level==='medium'?dest+(old<0?12:0):(dest>=40?100:0)+(capture?35:0)+(old<0?20:0)+dest};
          const i=level==='easy'?legal[Math.floor(Math.random()*legal.length)]:legal.sort((a,b)=>score(b)-score(a))[0];applyAction(state,seat,{type:'move',piece:i});}
      }
      if(game==='memory'){
        const free=state.deck.flatMap((_,i)=>!state.open.includes(i)&&!state.matched.includes(i)?[i]:[]);let i;
        if(state.open.length){const value=memorySeen.get(state.open[0]);i=free.find(n=>memorySeen.get(n)===value&&value!==undefined)}
        else{const known=free.filter(n=>memorySeen.has(n));i=known.find(n=>known.some(m=>m!==n&&memorySeen.get(m)===memorySeen.get(n)))}
        if(i===undefined)i=free[Math.floor(Math.random()*free.length)];applyAction(state,state.turn,{type:'flip',index:i});observe();
      }
    }catch(e){toast(e.message)}busy=false;draw();schedule()});
  }
  function draw(){
    const n=names(),over=state.winner!==null;$('#round-status').textContent=over?state.winner==='draw'?'Unentschieden!':n[state.winner]+' gewinnt!':busy?n[state.turn]+' überlegt …':n[state.turn]+' ist dran'+(game==='chess'&&state.check?' · Schach!':'');
    $('#round-seats').innerHTML=n.map((name,i)=>`<span class="seat ${state.turn===i?'active':''}">${i>=humans?'⚙':'☺'} ${escapeHTML(name)}${i>=humans?' · '+LEVEL[level]:''}${game==='memory'?' · '+state.points[i]+' Paare':game==='romme'?' · '+state.hands[i].length+' Karten':game==='property'?' · '+state.players[i].cash+' Münzen'+(state.players[i].out?' · ausgeschieden':''):''}</span>`).join('');
    const board=$('#extra-board'),actions=$('#extra-actions'),enabled=!bot()&&!busy&&!over;actions.innerHTML='';
    if(game==='chess'){const chess=new Chess();state.history.forEach(m=>chess.move(m));window.drawChessBoard(board,chess,enabled,act);actions.innerHTML=`<p class="move-history">${escapeHTML(state.history.map((m,i)=>i%2===0?(Math.floor(i/2)+1)+'. '+m:m).join(' '))||'Die Partie beginnt.'}</p>`}
    if(game==='memory'){
      const s=publicState(state,state.turn);board.innerHTML=`<p class="game-instruction">${state.moves} Züge · ${state.matched.length/2} von ${pairs} Paaren</p><div class="board board-memory extended-memory" style="--memory-cols:${pairs<=8?4:pairs<=16?6:8}">${s.board.map((v,i)=>`<button class="cell ${state.matched.includes(i)?'matched':''}" data-memory="${i}" aria-label="Karte ${i+1}: ${v===null?'verdeckt':SYMBOLS[v]}" ${enabled&&!state.flipAt&&v===null?'':'disabled'}>${v===null?'✦':SYMBOLS[v]}</button>`).join('')}</div>`;board.querySelectorAll('[data-memory]').forEach(b=>b.onclick=()=>act({type:'flip',index:+b.dataset.memory}));
    }
    if(game==='ludo'){
      let html='';LUDO_PATH.forEach(([r,c],i)=>html+=`<span class="ludo-field ${i%10===0?'color-'+Math.floor(i/10):''}" style="grid-row:${r+1};grid-column:${c+1}"></span>`);
      state.colors.forEach((color,p)=>{LUDO_HOMES[color].forEach(([r,c])=>html+=`<span class="ludo-field home color-${color}" style="grid-row:${r+1};grid-column:${c+1}"></span>`);LUDO_GOALS[color].forEach(([r,c])=>html+=`<span class="ludo-field goal color-${color}" style="grid-row:${r+1};grid-column:${c+1}"></span>`);state.pieces[p].forEach((v,i)=>{const[r,c]=v<0?LUDO_HOMES[color][i]:v>=40?LUDO_GOALS[color][v-40]:LUDO_PATH[(v+color*10)%40],ok=enabled&&state.waiting&&state.turn===p&&legalLudo(state,p,i);html+=`<button class="ludo-piece color-${color} ${ok?'movable':''}" data-piece="${i}" style="grid-row:${r+1};grid-column:${c+1}" aria-label="${n[p]} Figur ${i+1}, ${v<0?'im Häuschen':v>=40?'im Ziel':'auf dem Brett'}" ${ok?'':'disabled'}>${i+1}</button>`})});board.innerHTML=`<div class="ludo-board">${html}</div><p class="game-instruction">${escapeHTML(state.message||'Würfle und wähle eine markierte Figur.')}</p>`;board.querySelectorAll('[data-piece]').forEach(b=>b.onclick=()=>act({type:'move',piece:+b.dataset.piece}));actions.innerHTML=`<button id="extra-roll" ${enabled&&!state.waiting?'':'disabled'}>Würfeln ⚄</button>`;$('#extra-roll').onclick=()=>act({type:'roll'});
    }
    if(game==='romme')drawRummy(board,actions,enabled,n);
    if(game==='property')drawProperty(board,actions,enabled,n);
  }
  const card=(c,attrs='')=>`<button class="playing-card ${['♥','♦'].includes(c.suit)?'red':''}" ${attrs}><small>${({1:'A',11:'B',12:'D',13:'K'})[c.rank]||c.rank}${c.suit}</small><strong>${c.suit}</strong><small>${cardValue(c)} P.</small></button>`;
  function drawRummy(board,actions,enabled,n){
    const top=state.discard.at(-1),secret=bot()||hiddenHand;
    board.innerHTML=`<div class="rummy-stock"><span>${state.deck.length} Karten im Stapel</span><div>${top?card(top,'disabled aria-label="Oberste Ablagekarte"'):'Leere Ablage'}</div><span>${state.opened[state.turn]?'Bereits ausgelegt':'Erstauslage: mindestens 30 Punkte'}<br>${state.drawn?'Gezogen · auslegen oder abwerfen':'Zuerst ziehen'}</span></div><div class="rummy-table">${state.melds.map((g,i)=>`<div class="rummy-meld"><span>Gruppe ${i+1}</span><div>${g.slice().sort((a,b)=>a.rank-b.rank).map(c=>card(c,'disabled')).join('')}</div><button data-extend="${i}" ${enabled&&selected.length===1&&state.opened[state.turn]&&state.drawn?'':'disabled'}>Auswahl anlegen</button></div>`).join('')||'<p>Noch keine Kombinationen auf dem Tisch.</p>'}</div><div class="cards-hand">${secret?'<div class="hand-hidden">✦ ✦ ✦<p>'+escapeHTML(bot()?'Bot-Hand verborgen':'Gerät an '+n[state.turn]+' weitergeben')+'</p></div>':state.hands[state.turn].slice().sort((a,b)=>a.suit.localeCompare(b.suit)||a.rank-b.rank).map(c=>card(c,`data-rummy-card="${c.id}" aria-label="${c.rank} ${c.suit}" aria-pressed="${selected.includes(c.id)}" ${enabled&&state.drawn?'':'disabled'}`)).join('')}</div>${staged.length?'<p class="game-instruction">Vorgemerkt: '+staged.map((g,i)=>'Gruppe '+(i+1)+' ('+g.length+' Karten)').join(' · ')+'</p>':''}`;
    // Avoid duplicate class attributes on selectable cards.
    board.querySelectorAll('[data-rummy-card]').forEach(b=>{b.classList.toggle('selected',selected.includes(+b.dataset.rummyCard));b.onclick=()=>{const id=+b.dataset.rummyCard;if(selected.includes(id))selected=selected.filter(x=>x!==id);else selected.push(id);draw()}});
    board.querySelectorAll('[data-extend]').forEach(b=>b.onclick=()=>{act({type:'extend',group:+b.dataset.extend,id:selected[0]});selected=[];staged=[];draw()});
    if(hiddenHand&&!bot()){actions.innerHTML='<button id="show-rummy-hand">Hand anzeigen – bereit</button>';$('#show-rummy-hand').onclick=()=>{hiddenHand=false;revealedFor=state.turn;draw()};return}
    actions.innerHTML=`<button id="rummy-deck" ${enabled&&!state.drawn&&state.deck.length?'':'disabled'}>Vom Stapel ziehen</button><button id="rummy-discard-draw" ${enabled&&!state.drawn&&top?'':'disabled'}>Ablage nehmen</button><button id="rummy-stage" ${enabled&&state.drawn&&selected.length>=3?'':'disabled'}>Gruppe vormerken</button><button id="rummy-meld" ${enabled&&state.drawn&&(selected.length>=3||staged.length)?'':'disabled'}>Auslegen</button><button id="rummy-auto" ${enabled&&state.drawn?'':'disabled'}>Kombination finden</button><button id="rummy-clear" ${enabled?'':'disabled'}>Auswahl löschen</button><button id="rummy-discard" ${enabled&&state.drawn&&selected.length===1?'':'disabled'}>Auswahl abwerfen</button>${!state.deck.length&&!top&&!state.drawn?'<button id="rummy-pass">Passen</button>':''}`;
    $('#rummy-deck').onclick=()=>act({type:'draw',source:'deck'});$('#rummy-discard-draw').onclick=()=>act({type:'draw',source:'discard'});
    $('#rummy-stage').onclick=()=>{if(staged.flat().some(id=>selected.includes(id))){toast('Eine Karte kann nur in einer Gruppe liegen.');return}staged.push(selected.slice());selected=[];draw()};
    $('#rummy-meld').onclick=()=>{try{step({type:'meld',groups:[...staged,...(selected.length?[selected]:[])]});selected=[];staged=[];draw();schedule()}catch(e){toast(e.message)}};
    $('#rummy-auto').onclick=()=>{const hand=state.hands[state.turn];const plan=state.opened[state.turn]?findMelds(hand).slice(0,1):initialMeldPlan(hand);if(!plan.length){toast('Keine passende Auslage gefunden.');return}staged=plan;selected=[];draw()};$('#rummy-clear').onclick=()=>{selected=[];staged=[];draw()};$('#rummy-discard').onclick=()=>act({type:'discard',id:selected[0]});if($('#rummy-pass'))$('#rummy-pass').onclick=()=>act({type:'pass'});
  }
  function drawProperty(board,actions,enabled,n){
    const p=state.players[state.turn];board.innerHTML=`<div class="property-board">${PROPERTY_TILES.map((t,i)=>`<div class="property-tile group-${t.group??'none'} ${p.position===i?'current':''}"><small>${i===0?'↗':'#'+i}</small><strong>${t.name}</strong><span>${t.type==='street'?t.price+' Münzen':' '+({tax:'−100',chance:'± Glück',jail:'1 Runde Pause',start:'+200',visit:'Besuch',park:'Pause'})[t.type]}</span>${sOwn(i)}<div class="property-tokens">${state.players.map((q,j)=>q.position===i&&!q.out?`<b style="--seat-color:${['#bd785c','#649666','#6495bf','#b89240','#a774b9','#cc658e'][j]}" title="${escapeHTML(n[j])}">${j+1}</b>`:'').join('')}</div></div>`).join('')}</div><p class="game-instruction">${escapeHTML(state.message)}${state.dice.length?' · Würfel '+state.dice.join(' + '):''} · Zug ${state.round}/200</p>`;
    actions.innerHTML=`<button id="property-roll" ${enabled&&state.phase==='roll'?'':'disabled'}>Würfeln ⚄</button><button id="property-buy" ${enabled&&!p.out&&state.phase==='manage'&&PROPERTY_TILES[p.position].type==='street'&&state.owners[p.position]===null&&p.cash>=PROPERTY_TILES[p.position].price?'':'disabled'}>Grundstück kaufen</button><button id="property-end" ${enabled&&state.phase==='manage'?'':'disabled'}>Zug beenden</button>`;
    $('#property-roll').onclick=()=>act({type:'roll'});$('#property-buy').onclick=()=>act({type:'buy'});$('#property-end').onclick=()=>act({type:'end'});
    const build=document.createElement('div');build.className='property-estate';build.innerHTML='<h3>Deine Grundstücke</h3>'+PROPERTY_TILES.map((t,i)=>state.owners[i]===state.turn?`<div><span>${t.name} · ${state.houses[i]} Häuser</span><button data-build="${i}" ${enabled&&!p.out&&state.phase==='manage'&&ownsGroup(state,state.turn,i)&&state.houses[i]<3&&p.cash>=100?'':'disabled'}>Haus bauen · 100</button></div>`:'').join('');board.append(build);board.querySelectorAll('[data-build]').forEach(b=>b.onclick=()=>act({type:'build',index:+b.dataset.build}));
    function sOwn(i){const owner=state.owners[i];return owner!==null?`<em>${escapeHTML(n[owner])} ${'⌂'.repeat(state.houses[i])}</em>`:''}
  }
  setup();
}
for(const [get,set,id] of [[()=>playTTT,f=>playTTT=f,'ttt'],[()=>playConnect,f=>playConnect=f,'connect'],[()=>playMill,f=>playMill=f,'mill'],[()=>playCards,f=>playCards=f,'cards']]){const base=get();set(ctx=>{base(ctx);const select=$('#'+id+'-mode');select.value=settings.bots>0?'ai':'couch';select.dispatchEvent(new Event('change'));const note=document.createElement('p');note.className='game-instruction';note.textContent='Bot-Stärke: '+LEVEL[settings.difficulty]+' · in Einstellungen → Spiele & Bots ändern.';ctx.root.prepend(note)})}
render();
