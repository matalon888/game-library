/* The last Pale Reach watches: moving extraction, neutral rescue and relief. */
(function(root){
    'use strict';
    const petrel={name:'COUNCIL SUBMARINE · PETREL',length:38,beam:8,mass:1.35,propulsion:1.25,dragScale:1.1};
    const kestrel={name:'PASSAGE SERVICE · KESTREL',length:34,beam:13,mass:1.35,propulsion:1.9,dragScale:1.15,draft:5.2,iceClass:1};
    const tender={length:32,beam:9,mass:1.1,propulsion:1.4,dragScale:1.1};
    const cargo={length:36,beam:10,mass:1.5,propulsion:2,dragScale:1.05,iceClass:0};
    const berth=(x,y,a=Math.PI)=>({x,y,a,l:65,w:28,angle:15,speed:.35});
    const chart=(n,name,kind,start,spec,world,polar,brief,tip,pace)=>({id:`pale-reach-${n}`,name,kind,start,spec,world,polar,simulation:'polar',courseRevision:n===11?2:1,rulesRevision:n===11?1:2,berth:polar.berth||berth(...start),brief,tip,pace});
    const recovery=chart(10,'Bring Them Back','Moving extraction · two possible rendezvous',[135,580,0],petrel,[1180,800],{
        underwater:true,mission:'recovery',depth:48,floor:140,ceiling:5,home:{x:135,y:580,radius:65},
        shelves:[{name:'WEST SHOAL · 36 m',floor:36,poly:[[345,230],[465,210],[525,330],[465,435],[330,415]]},
            {name:'SOUTH RISE · 66 m',floor:66,poly:[[520,610],[745,600],[790,710],[685,770],[485,740]]}],
        platforms:[],bergs:[
            {id:'shelter-n',name:'FRACTURING SHELTER / NORTH',x:625,y:411,vx:.035,vy:-.065,length:116,beam:34,keel:38},
            {id:'shelter-s',name:'FRACTURING SHELTER / SOUTH',x:625,y:445,vx:-.025,vy:.065,length:116,beam:34,keel:38},
            {id:'margin',name:'DRIFTING ICE MARGIN · 62 m',x:865,y:290,vx:-.035,vy:.04,length:155,beam:105,keel:62}
        ],
        extraction:{exposeAt:260,walkSpeed:1.8,hold:8,sites:[
            {id:'near',name:'Shelter gap',x:625,y:428,depth:48,radius:28},
            {id:'far',name:'Drifting margin',anchor:'margin',dx:55,dy:45,depth:88,radius:28}
        ]},
        actors:[
            {id:'search-a',name:'SHORE WATCH · EAST PATROL',kind:'patrol',visible:true,start:[1040,210,Math.PI/2],depth:3,spec:tender,cruise:1.25,loop:true,
                route:[[1040,210],[1040,570],[970,570],[970,190]],exposureRoute:[[870,415],[665,425],[700,200],[1020,200]],returnRoute:[[760,510],[400,505],[420,650],[1000,650]]},
            {id:'search-b',name:'SHORE WATCH · SOUTH PATROL',kind:'patrol',visible:true,start:[1030,690,Math.PI],depth:3,spec:tender,cruise:1.1,loop:true,
                route:[[1030,690],[810,690],[900,745],[1060,745]],returnRoute:[[770,570],[355,560],[355,180],[1030,180]]}
        ],
        objectives:['Recover the waiting team','Clear the intensified patrol search','Bring the team into safe water'],
        dispatch:['COUNCIL EXTRACTION / 02:35','The team is already outside. Its planned shelter has split into two drifting plates. The shelter gap is closer; a patrol will reach that approach shortly. The farther pickup follows the ice margin and needs a deep approach. Choose a rendezvous: the team will travel there on the ice, not appear there instantly. After pickup, expect the search to spread west.'],
        landmarks:[{x:140,y:680,text:'HOME WATER / TEAM MUST RETURN'},{x:720,y:125,text:'DEEP APPROACH ALONG ICE MARGIN'}]
    },'Recover the team already waiting on the ice. Choose the nearer shelter gap or the farther drifting margin; a rendezvous order gives the team time to relocate. Match the selected pickup’s depth and drift, then escape without a confirmed alarm. Patrols redeploy after the team boards.',
    'The shelter plates drift apart continuously. The near pickup remains possible after exposure, but loses its cover. The far pickup moves with the ice margin at 88 m. Choose the pickup with its bridge button, then F orders recovery. Match relative speed for eight seconds. The western patrol gap changes after pickup; plan a different return.',[1500,2100,2800]);
    const protectedRoute=[[205,590],[292,650],[370,691],[465,704],[552,731],[650,730],[735,704],[791,644],[813,566],[852,493],[844,398],[872,337],[833,295],[765,280]];
    const rescue=chart(11,'No Flag on the Lifeboats','Neutral rescue · every required hull',[155,570,-Math.PI/2],kestrel,[1000,820],{
        mission:'rescue',cell:12,thickness:.85,closing:140,thinIce:.23,thinWidth:86,
        route:[[205,520],[295,513],[367,484],[432,460],[520,463],[592,439],[685,463],[738,447],[785,455]],secondary:{route:protectedRoute,width:105,thickness:.31,closing:440},
        patches:[{poly:[[680,267],[719,223],[778,236],[816,261],[841,304],[793,335],[730,317],[694,327]],thickness:.26},
            {poly:[[731,373],[810,394],[841,453],[825,512],[861,575],[826,643],[781,685],[708,660],[699,608],[731,556],[709,490],[720,431]],thickness:.3}],
        water:[
            {poly:[[65,305],[133,304],[200,342],[238,390],[254,435],[278,482],[285,565],[256,635],[219,654],[190,735],[116,764],[43,729],[18,641],[34,568],[9,493],[53,441],[38,367]]},
            {poly:[[686,268],[713,237],[751,221],[793,236],[812,256],[850,266],[865,288],[887,307],[889,333],[869,351],[843,351],[811,329],[763,345],[733,326],[704,332],[692,303]]},
            {poly:[[708,436],[732,401],[774,393],[801,408],[838,414],[858,453],[836,480],[844,509],[797,527],[762,510],[730,513],[699,472]]},
            {poly:[[701,593],[742,569],[785,576],[805,601],[836,607],[845,643],[827,672],[795,680],[776,707],[737,691],[706,672],[685,628]]},
            // A fractured central lead carries the gunboats' actual crossfire.
            // Its ragged margins vary in width while the firing lane stays open.
            {poly:[[527,88],[566,82],[588,132],[574,177],[593,218],[578,263],[585,313],[572,358],[598,405],[582,445],[590,492],[578,528],[585,585],[568,658],[527,650],[505,613],[518,568],[507,527],[521,478],[508,434],[519,389],[508,347],[521,302],[511,264],[522,218],[510,172],[520,131]]}
        ],ridges:[{poly:[[405,352],[419,326],[448,337],[470,318],[506,343],[529,366],[515,385],[476,399],[450,382],[417,388]]}],
        berth:berth(150,570),docks:[],
        survey:{id:'oriel',name:'ORIEL · DISABLED RESCUE VESSEL',start:[210,520,-Math.PI/2],spec:{length:32,beam:10,mass:1.1,propulsion:0,disabled:true,iceClass:0},safe:{x:180,y:400,rx:82,ry:60},pocket:{x:220,y:520,rx:65,ry:60}},
        rescue:{protectedRoute,contactRange:72,hold:4},
        fleet:[
            {id:'moth',name:'MOTH · CIVILIAN FAMILIES',start:[765,280,Math.PI],spec:{...cargo,name:'MOTH',length:32,mass:1.2},cruise:1.7,evacuating:true,route:[[765,280]],home:[[765,280],[100,530]]},
            {id:'reed',name:'REED · COMPACT SURVIVORS',start:[785,455,Math.PI],spec:{...cargo,name:'REED'},cruise:1.7,evacuating:true,route:[[785,455]],home:[[785,455],[125,595]]},
            {id:'bracken',name:'BRACKEN · LEAGUE SURVIVORS',start:[760,635,Math.PI],spec:{...cargo,name:'BRACKEN',length:38,mass:1.7},cruise:1.6,evacuating:true,route:[[760,635]],home:[[760,635],[110,665]]}
        ],
        crossfire:[
            {id:'compact-watch',name:'COMPACT GUNBOAT',team:'compact',start:[550,125,Math.PI/2],spec:{...tender,length:40},opponent:'league-watch'},
            {id:'league-watch',name:'LEAGUE GUNBOAT',team:'league',start:[550,620,-Math.PI/2],spec:{...tender,length:40},opponent:'compact-watch'}
        ],
        landmarks:[{x:150,y:770,text:'NEUTRAL ANCHORAGE'},{x:185,y:335,text:'ORIEL’S SAFE REFUGE'},{x:340,y:428,text:'SHORT CUT / CROSS-FIRE'},{x:535,y:792,text:'PROTECTED SOUTHERN CUT'}],
        dispatch:['FREE ANCHORAGE COUNCIL / RESCUE WATCH / 06:50','Moth carries families; Reed and Bracken carry crews from opposite sides. All have accepted the Council’s rescue orders. Oriel has lost propulsion in the turning pocket. Tow her into the marked refuge, make contact with each stranded group, and bring every hull into neutral water. The gunboats have not accepted a ceasefire. We are awarding no victories for sinking anyone.'],
        objectives:['Moth and the families reach neutral water','Reed’s crew reaches neutral water','Bracken’s crew reaches neutral water','Clear Oriel from the turning pocket','All required rescues secure']
    },'Cut access to three stranded groups and bring every vulnerable hull into neutral anchorage. Approach each group slowly to establish rescue contact, then use Hold and Proceed. Tow disabled Oriel out of the turning pocket into her marked refuge. The direct lead crosses gunboat fire; the longer southern cut stays below it.',
    'No weapons are carried. F connects or releases the tow; J/K winch it. Rescue contact takes four seconds within 72 m below 1.9 kn. Captains require connected open water and keep their stopping distances. Protected channels need more breaking and room for the stern. All three groups and Oriel must survive.',[1800,2500,3300]);
    const objectives=['Insert the channel engineers','Disable the channel-denial installation','Recover the engineers','Secure Petrel and take Kestrel','Open a connected convoy passage','Final relief ship clears the passage'];
    const surface={mission:'transit',cell:12,thickness:.82,closing:300,thinIce:.29,thinWidth:100,
        route:[[165,590],[325,565],[455,535],[625,555],[780,590],[900,590]],
        water:[{x:145,y:590,rx:140,ry:112},{x:885,y:590,rx:104,ry:108}],ridges:[{x:375,y:305,w:230,h:92}],docks:[],berth:berth(170,600),
        bergs:[{id:'denial-keel',name:'DRIFTING DENIAL KEEL · 58 m',x:520,y:438,vx:0,vy:.055,length:100,beam:58,keel:58,range:{y:438,ry:80}}],
        fleet:[
            {id:'witness',name:'WITNESS · INSPECTION CREW',start:[90,545,0],spec:{...cargo,name:'WITNESS',length:32,mass:1.3},cruise:1.9,evacuating:true,route:[[90,545]],home:[[90,545],[875,540]]},
            {id:'mercy',name:'MERCY · MEDICAL RELIEF',start:[80,595,0],spec:{...cargo,name:'MERCY'},cruise:1.8,evacuating:true,route:[[80,595]],home:[[80,595],[880,605]]},
            {id:'bread',name:'BREADTH · FOOD & HEATING FUEL',start:[100,650,0],spec:{...cargo,name:'BREADTH',length:42,mass:1.8},cruise:1.7,evacuating:true,route:[[100,650]],home:[[100,650],[900,660]]}
        ],
        cutters:[{id:'rime-final',name:'RIME · PASSAGE ICEBREAKER',team:'friendly',start:[240,565,0],spec:{...kestrel,name:'RIME',length:44,beam:22,mass:1.8,propulsion:3},cruise:2.8,
            route:[[240,565],[455,535],[585,555],[620,485]],width:100,thickness:.29}],
        assets:[{id:'denial',name:'CHANNEL-DENIAL INSTALLATION',x:705,y:245,w:42,h:65,hp:120,team:'hostile',a:Math.PI/2,gun:{range:580,arc:1.2,hold:6,reload:25,damage:24,shellSpeed:48}}],
        fragments:3,fragmentFromX:625,objectives,
        dispatch:['JOINT INSPECTION / COUNCIL RELIEF / ONE WEATHER WINDOW','Petrel’s engineers have isolated the military denial system. Take Kestrel and lead Witness, Mercy and Breadth through the passage. Rime’s wake has been aging throughout the underwater leg. Reopen it where needed, watch the drifting keel and new floes, and keep enough separation for the loaded ships to stop.'],
        landmarks:[{x:145,y:720,text:'CONVOY / TAKEOVER ANCHORAGE'},{x:885,y:730,text:'FINAL RELIEF EXIT'}]
    };
    const finale=chart(12,'The Passage Must Stay Open','Two legs · one weather clock',[140,520,0],petrel,[1000,760],{
        underwater:true,mission:'covert',finale:true,deadline:2700,depth:48,floor:140,ceiling:5,home:{x:140,y:520,radius:60},
        shelves:[{name:'INSTALLATION SHELF · 68 m',floor:68,poly:[[595,210],[875,215],[880,380],[720,435],[585,375]]}],
        platforms:[{id:'denial',name:'MILITARY DENIAL CONTROL',x:705,y:245,w:42,h:65}],bergs:surface.bergs,
        access:{x:675,y:350,radius:28,depth:48,hold:8,standOff:100,work:60},actors:[],
        surface:{start:[170,600,0],spec:kestrel,polar:surface},objectives,
        dispatch:['NEGOTIATED INSPECTION / 09:10 / 45 MINUTE WEATHER WINDOW','The signatories have agreed to inspect the passage, but the military denial controls still answer to a local commander. Deliver the engineers, leave while they isolate the system, recover them, and secure Petrel. Then take Kestrel and bring the inspection and relief ships through. Rime is already working above you. The weather clock and moving ice will not restart when you change bridges.'],
        landmarks:[{x:140,y:655,text:'PETREL / HANDOFF ANCHORAGE'},{x:690,y:175,text:'ENGINEERS’ ACCESS'}]
    },'Two legs share one 45-minute weather window. Use Petrel to insert and recover the engineers disabling the channel-denial installation. Secure the submarine in home water to take Kestrel. The same sea keeps moving throughout: follow and reopen Rime’s actual wake, then escort all three relief ships through the far passage.',
    'F orders engineer transfers at the working-depth hatch. Leave the exposed circle during their work and recover them before returning. The handoff is automatic after five quiet seconds in home water. All three convoy captains then accept Hold and Proceed. Only the final ship clearing the passage completes the campaign.',[1900,2300,2650]);
    const api={levels:[recovery,rescue,finale]};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.PaleReachFinaleLevels=api;
})(globalThis);
