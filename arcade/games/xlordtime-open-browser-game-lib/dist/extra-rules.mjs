import { Chess } from './vendor/chess.mjs';
const shuffle=a=>{for(let i=a.length-1;i;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const valid=(ok,message)=>{if(!ok)throw Error(message)};
export const cardValue=c=>c.rank===1?11:Math.min(c.rank,10);
export function isMeld(cards){
  if(cards.length<3||new Set(cards.map(c=>c.id)).size!==cards.length)return false;
  if(cards.length<=4&&cards.every(c=>c.rank===cards[0].rank)&&new Set(cards.map(c=>c.suit)).size===cards.length)return true;
  if(!cards.every(c=>c.suit===cards[0].suit))return false;
  const ranks=cards.map(c=>c.rank).sort((a,b)=>a-b);
  return ranks.every((n,i)=>!i||n===ranks[i-1]+1);
}
export function findMelds(hand){
  const found=[],seen=new Set();const add=cards=>{const key=cards.map(c=>c.id).sort().join(',');if(isMeld(cards)&&!seen.has(key)){seen.add(key);found.push(cards.map(c=>c.id))}};
  for(let rank=1;rank<=13;rank++){const cards=hand.filter(c=>c.rank===rank);for(let i=0;i<cards.length;i++)for(let j=i+1;j<cards.length;j++)for(let k=j+1;k<cards.length;k++){add([cards[i],cards[j],cards[k]]);for(let l=k+1;l<cards.length;l++)add([cards[i],cards[j],cards[k],cards[l]])}}
  for(const suit of ['♠','♥','♦','♣'])for(const start of hand.filter(c=>c.suit===suit)){let sequence=[start];for(let rank=start.rank+1;rank<=13;rank++){const next=hand.find(c=>c.suit===suit&&c.rank===rank);if(!next)break;sequence.push(next);if(sequence.length>=3)add(sequence)}}
  return found;
}
export function initialMeldPlan(hand){
  const groups=findMelds(hand).sort((a,b)=>b.length-a.length);let best=[];
  function visit(at,used,plan,sum){if(sum>=30){if(plan.flat().length>best.flat().length)best=plan.map(g=>g.slice());return}if(at>=groups.length||plan.length>=3)return;for(let i=at;i<groups.length;i++){const group=groups[i];if(group.some(id=>used.has(id)))continue;const next=new Set([...used,...group]);visit(i+1,next,[...plan,group],sum+group.reduce((n,id)=>n+cardValue(hand.find(c=>c.id===id)),0))}}
  visit(0,new Set(),[],0);return best;
}
export function createRummy(seats){
  valid(Number.isInteger(seats)&&seats>=2&&seats<=6,'Rommé benötigt 2 bis 6 Plätze.');
  const deck=shuffle(Array.from({length:104},(_,id)=>({id,suit:['♠','♥','♦','♣'][Math.floor(id/13)%4],rank:id%13+1})));
  return {seats,turn:0,winner:null,deck,hands:Array.from({length:seats},()=>deck.splice(0,13)),discard:[deck.pop()],melds:[],opened:Array(seats).fill(false),drawn:false,passes:0};
}
export function rummyAction(s,seat,a){
  valid(s.winner===null&&seat===s.turn,'Du bist gerade nicht dran.');const hand=s.hands[seat];
  if(a.type==='draw'){
    valid(!s.drawn,'Du hast bereits gezogen.');
    if(a.source==='discard'){valid(s.discard.length,'Keine Karte auf der Ablage.');hand.push(s.discard.pop())}
    else{if(!s.deck.length&&s.discard.length>1){const top=s.discard.pop();s.deck=shuffle(s.discard);s.discard=[top]}valid(s.deck.length,'Der Stapel ist leer. Nimm die Ablage oder passe.');hand.push(s.deck.pop())}
    s.drawn=true;s.passes=0;
  }else if(a.type==='meld'){
    valid(s.drawn,'Ziehe zuerst eine Karte.');valid(Array.isArray(a.groups)&&a.groups.length>0,'Wähle eine Kombination.');
    const all=a.groups.flat();valid(new Set(all).size===all.length&&all.every(id=>hand.some(c=>c.id===id)),'Die Karten müssen aus deiner Hand stammen.');
    const groups=a.groups.map(g=>g.map(id=>hand.find(c=>c.id===id)));valid(groups.every(isMeld),'Eine Gruppe braucht mindestens drei passende Karten.');
    valid(s.opened[seat]||groups.flat().reduce((n,c)=>n+cardValue(c),0)>=30,'Zum ersten Auslegen brauchst du zusammen mindestens 30 Punkte.');
    s.opened[seat]=true;s.melds.push(...groups);s.hands[seat]=hand.filter(c=>!all.includes(c.id));
  }else if(a.type==='extend'){
    valid(s.drawn&&s.opened[seat],'Ziehe zuerst und lege mindestens 30 Punkte aus.');const card=hand.find(c=>c.id===a.id),group=s.melds[a.group];valid(card&&group&&isMeld([...group,card]),'Diese Karte passt nicht an diese Gruppe.');group.push(card);s.hands[seat]=hand.filter(c=>c.id!==card.id);
  }else if(a.type==='discard'){
    valid(s.drawn,'Ziehe zuerst.');const at=hand.findIndex(c=>c.id===a.id);valid(at>=0,'Wähle eine eigene Karte.');s.discard.push(...hand.splice(at,1));s.drawn=false;s.turn=(seat+1)%s.seats;
  }else if(a.type==='pass'){
    valid(!s.drawn&&!s.deck.length&&!s.discard.length,'Passen ist nur bei leeren Stapeln möglich.');s.passes++;s.turn=(seat+1)%s.seats;if(s.passes>=s.seats)s.winner='draw';
  }else throw Error('Unbekannte Rommé-Aktion.');
  if(!s.hands[seat].length)s.winner=seat;return s;
}
export function rummyBot(s,seat,level){
  const actions=[];const act=a=>{rummyAction(s,seat,a);actions.push(a)};
  if(!s.drawn){const top=s.discard.at(-1);const useful=top&&s.hands[seat].some(c=>c.rank===top.rank||c.suit===top.suit&&Math.abs(c.rank-top.rank)===1);if(!s.deck.length&&!top){act({type:'pass'});return actions}act({type:'draw',source:top&&(level!=='easy'&&useful||!s.deck.length)?'discard':'deck'})}
  if(!s.opened[seat]){const plan=initialMeldPlan(s.hands[seat]);if(plan.length)act({type:'meld',groups:plan})}
  if(s.opened[seat]){
    for(let count=0;count<12&&s.winner===null;count++){const groups=findMelds(s.hands[seat]);if(groups.length){act({type:'meld',groups:[groups.sort((a,b)=>b.length-a.length)[0]]});if(level==='easy')break;continue}const fit=s.hands[seat].flatMap(c=>s.melds.flatMap((g,i)=>isMeld([...g,c])?[{type:'extend',id:c.id,group:i}]:[]))[0];if(!fit)break;act(fit)}
  }
  if(s.winner===null){const hand=s.hands[seat];const score=c=>cardValue(c)-(level==='hard'?hand.filter(o=>o.id!==c.id&&(o.rank===c.rank||o.suit===c.suit&&Math.abs(o.rank-c.rank)<=2)).length*8:0);const card=level==='easy'?hand[Math.floor(Math.random()*hand.length)]:hand.slice().sort((a,b)=>score(b)-score(a))[0];act({type:'discard',id:card.id})}
  return actions;
}
export const PROPERTY_TILES=Array.from({length:20},(_,i)=>i===0?{name:'Start',type:'start'}:i===5?{name:'Besuch',type:'visit'}:i===10?{name:'Auszeit',type:'jail'}:i===15?{name:'Freier Park',type:'park'}:[3,13].includes(i)?{name:'Stadtkasse',type:'tax'}:[7,17].includes(i)?{name:'Überraschung',type:'chance'}:{name:['','Gartenweg','Blütenallee','','Uferstraße','','Marktplatz','','Hafenweg','Seeblick','','Waldgasse','Parkring','','Sonnenweg','','Sternplatz','','Mondallee','Schlossweg'][i],type:'street',price:100+Math.floor(i/2)*25,rent:15+Math.floor(i/2)*5,group:Math.floor(i/5)});
export function createProperty(seats){valid(Number.isInteger(seats)&&seats>=2&&seats<=6,'Wähle 2 bis 6 Plätze.');return {seats,turn:0,winner:null,players:Array.from({length:seats},()=>({cash:1500,position:0,out:false,jail:0})),owners:Array(20).fill(null),houses:Array(20).fill(0),phase:'roll',dice:[],round:1,message:'Willkommen in der Stadt!'};}
export const ownsGroup=(s,seat,i)=>PROPERTY_TILES.every((t,j)=>t.type!=='street'||t.group!==PROPERTY_TILES[i].group||s.owners[j]===seat);
export const propertyWealth=(s,seat)=>s.players[seat].cash+PROPERTY_TILES.reduce((n,t,i)=>n+(s.owners[i]===seat?t.price+s.houses[i]*100:0),0);
function propertyPay(s,seat,amount,to=null){const p=s.players[seat];p.cash-=amount;if(to!==null)s.players[to].cash+=amount;if(p.cash<0){for(let i=0;i<20&&p.cash<0;i++)if(s.owners[i]===seat){p.cash+=Math.floor((PROPERTY_TILES[i].price+s.houses[i]*100)/2);s.owners[i]=null;s.houses[i]=0}if(p.cash<0){p.cash=0;p.out=true;s.message+=' Zahlungsunfähig und ausgeschieden.';s.owners.forEach((owner,i)=>{if(owner===seat){s.owners[i]=null;s.houses[i]=0}})}}const alive=s.players.flatMap((p,i)=>!p.out?[i]:[]);if(alive.length===1)s.winner=alive[0];}
export function propertyAction(s,seat,a,rng=max=>Math.floor(Math.random()*max)){
  valid(s.winner===null&&seat===s.turn,'Du bist gerade nicht dran.');const p=s.players[seat];
  if(a.type==='roll'){
    valid(s.phase==='roll','Der Wurf ist bereits erfolgt.');s.dice=[rng(6)+1,rng(6)+1];s.phase='manage';
    if(p.jail){p.jail--;s.message='Eine Runde aussetzen. Danach bist du wieder frei.';return s}
    const next=p.position+s.dice[0]+s.dice[1];if(next>=20)p.cash+=200;p.position=next%20;const t=PROPERTY_TILES[p.position];s.message='Gelanden auf '+t.name+'.';
    if(t.type==='tax'){propertyPay(s,seat,100);s.message+=' 100 Münzen Stadtabgabe.'}
    if(t.type==='jail'){p.position=5;p.jail=1;s.message='Auszeit: zurück auf Besuch und den nächsten Zug aussetzen.'}
    if(t.type==='chance'){const n=rng(2)?100:-75;if(n>0)p.cash+=n;else propertyPay(s,seat,-n);s.message+=' '+(n>0?'+':'')+n+' Münzen.'}
    if(t.type==='street'&&s.owners[p.position]!==null&&s.owners[p.position]!==seat){const rent=t.rent*(s.houses[p.position]+1)*(ownsGroup(s,s.owners[p.position],p.position)?2:1);propertyPay(s,seat,rent,s.owners[p.position]);s.message+=' '+rent+' Münzen Miete.'}
  }else if(a.type==='buy'){
    const i=p.position,t=PROPERTY_TILES[i];valid(s.phase==='manage'&&!p.out&&t.type==='street'&&s.owners[i]===null&&p.cash>=t.price,'Dieses Grundstück kannst du nicht kaufen.');p.cash-=t.price;s.owners[i]=seat;s.message=t.name+' gekauft.';
  }else if(a.type==='build'){
    const i=a.index;valid(Number.isInteger(i)&&i>=0&&i<20&&s.phase==='manage'&&!p.out&&s.owners[i]===seat&&ownsGroup(s,seat,i)&&s.houses[i]<3&&p.cash>=100,'Bauen erfordert die gesamte Farbgruppe und 100 Münzen.');p.cash-=100;s.houses[i]++;s.message='Ein Haus auf '+PROPERTY_TILES[i].name+'.';
  }else if(a.type==='end'){
    valid(s.phase==='manage','Würfle zuerst.');do{s.turn=(s.turn+1)%s.seats}while(s.players[s.turn].out);s.phase='roll';s.round++;if(s.round>200){const best=s.players.map((p,i)=>p.out?-1:propertyWealth(s,i)),max=Math.max(...best),w=best.flatMap((n,i)=>n===max?[i]:[]);s.winner=w.length===1?w[0]:'draw'}
  }else throw Error('Unbekannte Aktion.');return s;
}
export function propertyBot(s,seat,level){
  if(s.phase==='roll')propertyAction(s,seat,{type:'roll'});if(s.winner!==null)return;const p=s.players[seat],t=PROPERTY_TILES[p.position];
  const reserve=level==='easy'?0:level==='medium'?200:350;const completes=t.type==='street'&&PROPERTY_TILES.every((other,i)=>other.type!=='street'||other.group!==t.group||i===p.position||s.owners[i]===seat);
  if(!p.out&&t.type==='street'&&s.owners[p.position]===null&&p.cash>=t.price+(completes&&level==='hard'?50:reserve)&&(level!=='easy'||Math.random()>.35))propertyAction(s,seat,{type:'buy'});
  if(level!=='easy')for(let i=0;i<20;i++)if(s.owners[i]===seat&&ownsGroup(s,seat,i)&&s.houses[i]<3&&p.cash>=100+reserve)propertyAction(s,seat,{type:'build',index:i});
  propertyAction(s,seat,{type:'end'});
}
const VALUES={p:100,n:320,b:330,r:500,q:900,k:0};
export function chooseChessMove(chess,level){
  const moves=chess.moves({verbose:true});if(!moves.length)return null;if(level==='easy')return moves[Math.floor(Math.random()*moves.length)];
  let nodes=0;const maxNodes=level==='hard'?6500:1000,depth=level==='hard'?3:1;
  const evaluate=()=>chess.board().flat().reduce((n,p)=>n+(p?(p.color==='w'?1:-1)*(VALUES[p.type]+(p.type!=='k'?Math.round((3.5-Math.abs(3.5-'abcdefgh'.indexOf(p.square[0])))*4):0)):0),0)*(chess.turn()==='w'?1:-1);
  function search(d,alpha,beta){nodes++;if(chess.isCheckmate())return -100000-d;if(chess.isDraw())return 0;if(!d||nodes>maxNodes)return evaluate();let best=-Infinity;const list=chess.moves({verbose:true}).sort((a,b)=>(VALUES[b.captured]||0)-(VALUES[a.captured]||0));for(const m of list){chess.move(m);const score=-search(d-1,-beta,-alpha);chess.undo();best=Math.max(best,score);alpha=Math.max(alpha,score);if(alpha>=beta)break}return best;}
  let best=-Infinity,choice=moves[0];for(const m of moves){chess.move(m);const score=-search(depth-1,-Infinity,Infinity);chess.undo();if(score>best){best=score;choice=m}}return choice;
}
