/* Fictional underwater charts. Depths and acoustic rules are deliberately simplified. */
(function(root){
    'use strict';
    const spec={name:'COUNCIL SUBMERSIBLE · PETREL',length:38,beam:8,mass:1.35,propulsion:1.25,dragScale:1.1,draft:4,iceClass:0};
    const sub={...spec,name:'UNIDENTIFIED SUBMARINE',length:34,mass:1.2,propulsion:1.15};
    const tender={length:32,beam:9,mass:1.1,propulsion:1.1,dragScale:1.05};
    const chart=(n,name,kind,start,world,config,brief,tip,pace)=>({id:`pale-reach-${n}`,name,kind,start,spec,world,simulation:'polar',standalone:true,
        courseRevision:1,rulesRevision:2,berth:{x:start[0],y:start[1],a:Math.PI,l:70,w:35,speed:.35,angle:15},
        polar:{underwater:true,depth:48,floor:130,ceiling:5,home:{x:start[0],y:start[1],radius:65},shelves:[],bergs:[],platforms:[],actors:[],...config},brief,tip,pace});
    const levels=[
        chart(7,'What the Ice Heard','Submarine watch · identify and intercept',[135,535,0],[1120,780],{
            mission:'intercept',depth:18,
            shelves:[{name:'NORTH SHELF · 64 m',floor:64,poly:[[320,80],[690,70],[790,175],[705,250],[420,235],[300,155]]},
                {name:'SEABED RISE · 70 m',floor:70,poly:[[465,510],[650,500],[735,575],[670,665],[475,650],[410,575]]}],
            bergs:[{id:'keel',name:'DRIFTING KEEL · 60 m',x:555,y:356,vx:0,vy:.07,length:135,beam:104,keel:60,range:{y:360,ry:45}}],
            platforms:[{id:'installation',name:'COUNCIL COMMUNICATIONS',x:975,y:420,w:30,h:90}],
            installation:{x:965,y:475,radius:62,hold:18},
            actors:[
                {id:'maintenance',kind:'service',name:'SERVICE TENDER · MICA',start:[360,595,0],depth:3,spec:tender,route:[[360,595],[825,640]],cruise:.9,loop:true},
                {id:'echo',kind:'decoy',start:[445,375,0],depth:48,vx:.1,vy:.025,life:1600},
                {id:'intruder',kind:'submarine',hostile:true,start:[860,230,Math.PI/2],depth:48,spec:sub,
                    route:[[860,230],[825,340],[860,475],[965,475]],cruise:.65}
            ],
            objectives:['Identify the intruding submarine','Intercept before the installation is reached','Secure Petrel in home water'],
            dispatch:['FREE ANCHORAGE COUNCIL / UNDERWATER WATCH / 21:10','Mica is repairing the passage cable. A recorder buoy has broken loose, and somebody else is moving toward the communications caisson. Neither power has filed a submarine transit. Listen before naming a target. The Council authorizes an interception only after identification.'],
            landmarks:[{x:135,y:625,text:'PETREL / SAFE WATER'},{x:830,y:150,text:'DISPUTED SHELF'}]
        },'Three returns, three different causes. Listen quietly for motion and machinery, or send an active pulse for a clearer echo. A pulse also gives the intruder your position. Identify the submarine, stop it before it reaches the communications installation, then return home.',
        'Z / X select shallower / deeper bands; P sends a pulse; T selects a track; I records its identification; B launches a torpedo after a stable solution. The 60 m iceberg keel blocks shallow and working depth. Deep water passes beneath it, but the nearby 70 m seabed rise does not.',[750,1050,1450]),
        chart(8,'Under the Listening Post','Covert team operation · insert and recover',[135,585,0],[1120,800],{
            mission:'covert',depth:48,
            shelves:[{name:'WEST SHOAL · 35 m',floor:35,poly:[[320,230],[470,190],[545,265],[515,425],[385,445],[300,345]]},
                {name:'RELAY SHELF · 68 m',floor:68,poly:[[705,200],[1040,210],[1080,480],[885,525],[705,445]]}],
            bergs:[{id:'post-keel',name:'ICE MARGIN · 32 m',x:625,y:260,vx:.045,vy:0,length:118,beam:65,keel:32,range:{x:625,rx:50}}],
            platforms:[{id:'relay',name:'SHELF MILITARY RELAY',x:815,y:290,w:42,h:92}],
            access:{x:770,y:360,radius:29,depth:48,hold:8,standOff:125,work:90},
            actors:[
                {id:'watch-a',kind:'patrol',name:'SHORE WATCH · PATROL A',visible:true,start:[865,165,Math.PI],depth:3,spec:tender,
                    route:[[865,165],[535,165],[555,520],[955,550],[1000,180]],cruise:1.25,loop:true},
                {id:'watch-b',kind:'patrol',name:'SHORE WATCH · PATROL B',visible:true,start:[985,550,Math.PI],depth:3,spec:tender,
                    route:[[985,550],[510,550],[480,130],[995,130]],cruise:1.1,loop:true}
            ],
            objectives:['Insert the team at the submerged access','Clear the exposed area while the team works','Recover the team','Escape without a confirmed alarm'],
            dispatch:['COUNCIL LIAISON / NARROWS COMPACT / 23:40','The relay is directing the League’s channel patrols. Put the team through its submerged maintenance hatch, leave while they copy and disable its military routing equipment, then collect them. Council shore watchers keep the two surface patrols plotted. An alarm would expose the settlements that helped us.'],
            landmarks:[{x:140,y:680,text:'COVERT WITHDRAWAL'},{x:600,y:650,text:'SOUTHERN PATROL GAP'}]
        },'Stop at the working-depth access point and order insertion. Leave the 125 m exposed area while the team works, then return through a patrol gap to recover it. Bring everyone home with suspicion below 20%. A confirmed alarm fails the assignment.',
        'F orders insertion or recovery. Hold within 29 m at working depth and below 0.5 kn for eight seconds. Team work advances only while you are clear of the exposed area. Watch patrol listening arcs. Hard counterthrust, bow thrusters and active sonar are loud; reduce speed early. Weapons are sealed.',[1800,2300,2900]),
        chart(9,'Three Echoes Too Many','Passage defense · hunt a minelayer',[150,420,0],[1200,850],{
            mission:'hunt',depth:48,
            shelves:[{name:'SPLIT SHELF · 36 m',floor:36,poly:[[410,210],[570,190],[650,280],[610,400],[465,430],[390,340]]},
                {name:'EAST RISE · 65 m',floor:65,poly:[[795,185],[920,165],[970,265],[885,330],[770,275]]},
                {name:'SOUTH SHELF · 66 m',floor:66,poly:[[460,620],[650,600],[720,710],[655,795],[440,785],[390,700]]}],
            bergs:[{id:'passage-keel',name:'KEEL · 58 m',x:620,y:505,vx:0,vy:.065,length:94,beam:84,keel:58,range:{y:515,ry:38}}],
            passage:{x:995,y:430,radius:54,lay:55},withdrawal:{x:1100,y:720,radius:48},
            actors:[
                {id:'echo-a',kind:'decoy',start:[375,500,0],depth:48,vx:.065,vy:-.035,life:210},
                {id:'echo-b',kind:'decoy',start:[760,380,0],depth:48,vx:-.04,vy:.07,life:280},
                {id:'minelayer',kind:'submarine',hostile:true,armed:true,torpedoDamage:40,start:[760,545,-.5],depth:48,spec:sub,cruise:1.05,quiet:true,decoys:true,
                    route:[[760,545],[895,570],[1040,535],[1050,430],[995,430]]}
            ],
            objectives:['Identify the minelaying submarine','Keep the passage clear of armed mines','Hold safe water after the threat withdraws'],
            dispatch:['FREE ANCHORAGE COUNCIL / PASSAGE GUARD / 04:15','A submarine is preparing to deny the narrow passage to relief traffic. Its echoes disagree. Protect the marked transit water: stop the minelaying, or force the boat out of the assignment. Do not pursue it beyond the chart. Your last fix is a memory, not a promise that the boat is still there.'],
            landmarks:[{x:150,y:510,text:'PASSAGE GUARD / SAFE WATER'},{x:1005,y:350,text:'RELIEF TRANSIT PASSAGE'},{x:1040,y:790,text:'HOSTILE WITHDRAWAL LIMIT'}]
        },'Find the minelayer among drifting decoys. It goes quiet and moves between seabed shelves; lost tracks continue as expanding uncertainty regions. An active pulse improves your fix but gives the enemy a reference for its next attack. Prevent the mine deployment, then hold safe water once the threat is disabled or has withdrawn.',
        'The shelves leave several routes around the basin. A torpedo hit forces the minelayer to abandon its approach and withdraw; its escape is a successful defense if the passage remains clear. Do not chase it beyond the assignment. Reacquire old tracks before trusting a firing solution.',[750,1100,1500])
    ];
    const api={levels,spec};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.PaleReachSubmarineLevels=api;
})(globalThis);
