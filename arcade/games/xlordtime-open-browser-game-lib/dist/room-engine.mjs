import { Chess } from './vendor/chess.mjs';
const randomInt=max=>{const a=new Uint32Array(1),limit=4294967296-4294967296%max;do{crypto.getRandomValues(a)}while(a[0]>=limit);return a[0]%max;};

export const ROOM_GAMES = {
  chess:{min:2,max:2}, tictactoe: {min:2,max:2}, connect:{min:2,max:2}, mill:{min:2,max:2},
  ludo:{min:2,max:4}, crazy8:{min:2,max:2}, memory:{min:1,max:6},
  dice:{min:2,max:6}, draw:{min:2,max:8}, sound:{min:2,max:8}
};
export class GameError extends Error { constructor(message,status=400){super(message);this.status=status;} }
const requireThat=(condition,message,status=400)=>{if(!condition)throw new GameError(message,status);};
const index=(n,max)=>Number.isInteger(n)&&n>=0&&n<max;
const shuffle=(a,rng)=>{for(let i=a.length-1;i>0;i--){const j=rng(i+1);[a[i],a[j]]=[a[j],a[i]]}return a;};
export const MILL_LINES=[[0,1,2],[3,4,5],[6,7,8],[9,10,11],[12,13,14],[15,16,17],[18,19,20],[21,22,23],[0,9,21],[3,10,18],[6,11,15],[1,4,7],[16,19,22],[8,12,17],[5,13,20],[2,14,23]];
const millNeighbors=i=>[...new Set(MILL_LINES.flatMap(l=>{const p=l.indexOf(i);return p<0?[]:[l[p-1],l[p+1]].filter(n=>n!==undefined)}))];
const millAt=(s,i,p)=>MILL_LINES.some(l=>l.includes(i)&&l.every(n=>s.board[n]===p));
const count=(s,p)=>s.board.filter(n=>n===p).length;
const removable=(s,p)=>{const all=s.board.flatMap((v,i)=>v===p?[i]:[]),outside=all.filter(i=>!millAt(s,i,p));return outside.length?outside:all;};
const millMoves=(s,p)=>s.placed[p]<9?s.board.flatMap((v,to)=>v===null?[[null,to]]:[]):s.board.flatMap((v,from)=>v!==p?[]:(count(s,p)===3?s.board.flatMap((v,i)=>v===null?[i]:[]):millNeighbors(from).filter(i=>s.board[i]===null)).map(to=>[from,to]));
export function createState(game,seats,rng=randomInt,options={}){
  requireThat(ROOM_GAMES[game]&&index(seats-ROOM_GAMES[game].min,ROOM_GAMES[game].max-ROOM_GAMES[game].min+1),'Ungültige Spielerzahl.');
  const s={game,seats,turn:0,winner:null};
  if(game==='chess')Object.assign(s,{fen:new Chess().fen(),history:[],check:false});
  if(game==='tictactoe')s.board=Array(9).fill(null);
  if(game==='connect')s.board=Array(42).fill(null);
  if(game==='mill')Object.assign(s,{board:Array(24).fill(null),placed:[0,0],capture:false,quiet:0});
  if(game==='ludo')Object.assign(s,{pieces:Array.from({length:seats},()=>[-1,-1,-1,-1]),colors:seats===2?[0,2]:Array.from({length:seats},(_,i)=>i),die:0,waiting:false,attempts:0,message:''});
  if(game==='memory'){const pairs=options.pairs??8;requireThat([4,6,8,12,16,24].includes(pairs),'Ungültige Paarzahl.');Object.assign(s,{pairs,deck:shuffle([...Array(pairs).keys(),...Array(pairs).keys()],rng),open:[],matched:[],points:Array(seats).fill(0),flipAt:0,moves:0});}
  if(game==='crazy8'){
    const deck=shuffle(['♠','♥','♦','♣'].flatMap(suit=>['A','2','3','4','5','6','7','8','9','10','J','Q','K'].map(rank=>({suit,rank}))),rng);
    const hands=[deck.splice(0,7),deck.splice(0,7)],top=deck.splice(deck.findIndex(c=>c.rank!=='8'),1)[0];
    Object.assign(s,{deck,hands,discard:[top],suit:top.suit,wish:false,passes:0});
  }
  if(game==='dice')Object.assign(s,{dice:[1,1,1,1,1],held:[],rolls:0,round:1});
  if(game==='draw')Object.assign(s,{strokes:[]});
  if(game==='sound')Object.assign(s,{tones:[],sequence:0});
  return s;
}
function lineWinner(board,width,height,length){
  for(let r=0;r<height;r++)for(let c=0;c<width;c++){
    const p=board[r*width+c];if(p===null)continue;
    for(const[dr,dc]of [[0,1],[1,0],[1,1],[1,-1]]){
      const rr=r+(length-1)*dr,cc=c+(length-1)*dc;
      if(rr>=0&&rr<height&&cc>=0&&cc<width&&Array.from({length},(_,i)=>board[(r+i*dr)*width+c+i*dc]).every(v=>v===p))return p;
    }
  }
  return board.every(v=>v!==null)?'draw':null;
}
export function settleState(s,now=Date.now()){
  if(s.game==='memory'&&s.flipAt&&s.flipAt<=now){s.open=[];s.flipAt=0;s.turn=(s.turn+1)%s.seats;return true;}
  return false;
}
export function legalLudo(s,seat,i){
  if(!s.waiting||!index(i,4))return false;
  const old=s.pieces[seat][i],next=old<0?(s.die===6?0:null):old+s.die;
  return next!==null&&next<=43&&!s.pieces[seat].some((n,j)=>j!==i&&(n===next||(next>=40&&n>=40&&n>old&&n<=next)));
}
export function applyAction(s,seat,a,{rng=randomInt,now=Date.now()}={}){
  requireThat(index(seat,s.seats),'Ungültiger Platz.',403);
  requireThat(a&&typeof a==='object'&&typeof a.type==='string','Ungültiger Zug.');
  requireThat(s.winner===null,'Die Runde ist beendet.');
  if(!['draw','sound'].includes(s.game))requireThat(seat===s.turn,'Die andere Person ist am Zug.',403);
  if(s.game==='chess'){
    requireThat(a.type==='move'&&/^[a-h][1-8]$/.test(a.from)&&/^[a-h][1-8]$/.test(a.to)&&['q','r','b','n'].includes(a.promotion||'q'),'Ungültiger Schachzug.');
    const chess=new Chess();s.history.forEach(m=>chess.move(m));let move;try{move=chess.move({from:a.from,to:a.to,promotion:a.promotion||'q'})}catch{throw new GameError('Dieser Schachzug ist nicht erlaubt.')}
    s.history.push(move.san);s.fen=chess.fen();s.check=chess.isCheck();s.turn=chess.turn()==='w'?0:1;s.winner=chess.isCheckmate()?seat:chess.isDraw()?'draw':null;
  }else if(s.game==='tictactoe'){
    requireThat(a.type==='place'&&index(a.index,9)&&s.board[a.index]===null,'Dieses Feld ist nicht frei.');
    s.board[a.index]=seat;s.winner=lineWinner(s.board,3,3,3);s.turn=1-seat;
  }else if(s.game==='connect'){
    requireThat(a.type==='drop'&&index(a.column,7),'Wähle eine Spalte.');
    let pos=-1;for(let r=5;r>=0;r--)if(s.board[r*7+a.column]===null){pos=r*7+a.column;break;}
    requireThat(pos>=0,'Die Spalte ist voll.');s.board[pos]=seat;s.winner=lineWinner(s.board,7,6,4);s.turn=1-seat;
  }else if(s.game==='mill'){
    if(s.capture){
      requireThat(a.type==='capture'&&removable(s,1-seat).includes(a.index),'Dieser Stein steht unter Mühlenschutz.');
      s.board[a.index]=null;s.capture=false;s.quiet=0;s.turn=1-seat;
    }else{
      const from=s.placed[seat]<9?null:a.from;
      requireThat(a.type==='move'&&millMoves(s,seat).some(([f,to])=>f===from&&to===a.to),'Dieser Mühle-Zug ist nicht erlaubt.');
      if(from===null)s.placed[seat]++;else{s.board[from]=null;s.quiet++;}
      s.board[a.to]=seat;
      if(millAt(s,a.to,seat)&&removable(s,1-seat).length)s.capture=true;else s.turn=1-seat;
    }
    if(!s.capture&&s.placed.every(n=>n===9)&&(count(s,s.turn)<3||!millMoves(s,s.turn).length))s.winner=1-s.turn;
    if(s.winner===null&&s.quiet>=100)s.winner='draw';
  }else if(s.game==='ludo'){
    const nextTurn=()=>{s.turn=(s.turn+1)%s.seats;s.die=0;s.waiting=false;s.attempts=0;};
    if(a.type==='roll'){
      requireThat(!s.waiting,'Wähle zuerst deine Figur.');s.die=rng(6)+1;s.attempts++;
      s.waiting=true;
      if(!s.pieces[seat].some((_,i)=>legalLudo(s,seat,i))){
        const noOutside=s.pieces[seat].every(n=>n<0||n>=40),die=s.die;
        s.waiting=false;
        if(noOutside&&s.attempts<3&&die!==6)s.message=`Gewürfelt: ${die}. Noch ${3-s.attempts} Versuch(e).`;
        else{nextTurn();s.message=`Gewürfelt: ${die}. Kein Zug möglich.`;}
      }else s.message=`Gewürfelt: ${s.die}. Wähle eine Figur.`;
    }else{
      requireThat(a.type==='move'&&legalLudo(s,seat,a.piece),'Diese Figur kann nicht ziehen.');
      const next=s.pieces[seat][a.piece]<0?0:s.pieces[seat][a.piece]+s.die;
      s.pieces[seat][a.piece]=next;
      if(next<40)s.pieces.forEach((pieces,p)=>{if(p===seat)return;pieces.forEach((n,i)=>{if(n>=0&&n<40&&(n+s.colors[p]*10)%40===(next+s.colors[seat]*10)%40)pieces[i]=-1;});});
      if(s.pieces[seat].every(n=>n>=40))s.winner=seat;
      else if(s.die===6){s.die=0;s.waiting=false;s.attempts=0;s.message='Noch einmal würfeln.';}else{nextTurn();s.message='';}
    }
  }else if(s.game==='memory'){
    requireThat(!s.flipAt&&a.type==='flip'&&index(a.index,s.deck.length)&&!s.matched.includes(a.index)&&!s.open.includes(a.index),'Diese Karte kannst du gerade nicht umdrehen.');
    s.open.push(a.index);
    if(s.open.length===2){
      s.moves++;
      if(s.deck[s.open[0]]===s.deck[s.open[1]]){s.points[seat]++;s.matched.push(...s.open);s.open=[];
        if(s.matched.length===s.deck.length){const max=Math.max(...s.points),best=s.points.flatMap((p,i)=>p===max?[i]:[]);s.winner=best.length===1?best[0]:'draw';}
      }else s.flipAt=now+1200;
    }
  }else if(s.game==='crazy8'){
    const next=()=>{if(!s.hands[seat].length)s.winner=seat;else s.turn=1-seat;};
    if(s.wish){requireThat(a.type==='wish'&&['♠','♥','♦','♣'].includes(a.suit),'Wähle eine Wunschfarbe.');s.suit=a.suit;s.wish=false;next();}
    else if(a.type==='card'){
      requireThat(index(a.index,s.hands[seat].length),'Ungültige Karte.');
      const c=s.hands[seat][a.index],top=s.discard.at(-1);
      requireThat(c.rank==='8'||c.suit===s.suit||c.rank===top.rank,'Die Karte passt nicht.');
      s.hands[seat].splice(a.index,1);s.discard.push(c);s.suit=c.suit;s.passes=0;
      if(c.rank==='8'&&s.hands[seat].length)s.wish=true;else next();
    }else{
      requireThat(a.type==='draw','Wähle eine Karte oder ziehe.');
      if(!s.deck.length&&s.discard.length>1){const top=s.discard.pop();s.deck=shuffle(s.discard,rng);s.discard=[top];}
      if(s.deck.length){s.hands[seat].push(s.deck.pop());s.passes=0;}else s.passes++;
      if(s.passes>=2)s.winner='draw';else next();
    }
  }else if(s.game==='dice'){
    if(a.type==='roll'){requireThat(s.rolls<3,'Drei Würfe sind erreicht.');s.dice=s.dice.map((v,i)=>s.held.includes(i)?v:rng(6)+1);s.rolls++;}
    else if(a.type==='hold'){requireThat(s.rolls>0&&index(a.index,5),'Würfle zuerst.');s.held=s.held.includes(a.index)?s.held.filter(i=>i!==a.index):[...s.held,a.index];}
    else{requireThat(a.type==='next'&&s.rolls>0,'Würfle zuerst.');s.turn=(seat+1)%s.seats;s.rolls=0;s.held=[];s.round++;}
  }else if(s.game==='draw'){
    if(a.type==='clear'){requireThat(seat===0,'Nur die Gastgeberperson darf die Fläche leeren.',403);s.strokes=[];}
    else{
      requireThat(a.type==='stroke'&&Array.isArray(a.points)&&a.points.length>=1&&a.points.length<=200,'Ungültiger Pinselstrich.');
      requireThat(a.points.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1))&&/^#[0-9a-f]{6}$/i.test(a.color)&&Number.isFinite(a.width)&&a.width>=1&&a.width<=32,'Ungültige Zeichenwerte.');
      requireThat(s.strokes.length<1000,'Die Fläche ist voll. Speichere das Bild und starte eine neue Runde.');
      s.strokes.push({points:a.points.map(p=>p.slice()),color:a.color,width:a.width,seat});
    }
  }else if(s.game==='sound'){
    requireThat(a.type==='tone'&&index(a.note,8),'Ungültiger Ton.');
    s.tones.push({note:a.note,seat,id:++s.sequence,time:now});s.tones=s.tones.slice(-40);
  }
  return s;
}
export function publicState(s,seat){
  const copy=structuredClone(s);
  if(s.game==='crazy8'){copy.counts=s.hands.map(h=>h.length);copy.hand=index(seat,s.seats)?s.hands[seat].map(c=>({...c})):[];copy.top={...s.discard.at(-1)};copy.deckCount=s.deck.length;delete copy.hands;delete copy.deck;delete copy.discard;}
  if(s.game==='memory'){copy.board=s.deck.map((v,i)=>s.open.includes(i)||s.matched.includes(i)?v:null);delete copy.deck;}
  return copy;
}
