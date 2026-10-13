/* Pale Reach surface charts. Metres, seconds and fictional institutions. */
(function(root){
    'use strict';
    const breaker={name:'PASSAGE SERVICE · KESTREL',length:34,beam:13,mass:1.35,propulsion:1.9,dragScale:1.15,draft:5.2,iceClass:1};
    const supply={name:'COUNCIL SUPPLY · LANTERN',length:42,beam:10,mass:1.8,propulsion:2,dragScale:1.05,draft:5.8,iceClass:0};
    const armed={...breaker,name:'COUNCIL ESCORT · KESTREL',mass:1.5};
    const patrol={length:29,beam:9,mass:.8,propulsion:1.3,dragScale:1.1,iceClass:0};
    const raider={length:24,beam:8,mass:.65,propulsion:1.4,dragScale:1.15,iceClass:0};
    const cutter={length:44,beam:22,mass:1.8,propulsion:3,dragScale:1.15,iceClass:1};
    const berth=(x,y,a=0)=>({x,y,a,l:64,w:27,angle:12,speed:.32});
    const base=(n,name,kind,start,spec,world,polar,brief,tip,pace)=>({id:`pale-reach-${n}`,name,kind,start,spec,world,polar,
        simulation:'polar',standalone:true,courseRevision:2,rulesRevision:n===2?2:1,berth:polar.berth,brief,tip,pace});
    const firstRoute=[[105,390],[210,365],[280,275],[350,220],[445,235],[530,275],[640,280]];
    const lead=[[115,380],[210,380],[290,330],[385,265],[485,265],[585,320],[690,340],[795,310]];
    const north=[[160,355],[275,290],[355,230],[450,185],[570,165],[690,170]];
    const south=[[165,410],[260,450],[370,485],[485,465],[580,430],[700,425]];
    const levels=[
        base(1,'The First Fracture','Icebreaking · a usable harbor',[105,390,0],breaker,[840,560],{
            mission:'pocket',cell:12,thickness:.86,closing:240,route:firstRoute,thinWidth:54,thinIce:.28,
            water:[{x:125,y:390,rx:140,ry:93},{x:577,y:280,rx:78,ry:90},{x:746,y:280,rx:65,ry:94}],
            patches:[{x:600,y:198,w:110,h:164,thickness:.28}],
            ridges:[{x:324,y:292,w:60,h:268},{x:315,y:0,w:67,h:152}],
            pocket:{x:666,y:280,rx:49,ry:42,required:.86},berth:berth(746,280),
            docks:[{x:778,y:238,w:22,h:87,name:'THAWMARK SUPPLY JETTY'}],
            landmarks:[{x:112,y:462,text:'WINTER ANCHORAGE'},{x:355,y:385,text:'PRESSURE RIDGE'},{x:359,y:181,text:'THIN DOGLEG'}],
            fragments:4,fragmentFromX:460,
            dispatch:['FREE ANCHORAGE COUNCIL / 06:20','Thawmark has three days of heating fuel. The Council will accept the delivery without accepting either authority’s new passage chart. Open room to turn, not just room to arrive.'],
            objectives:['Open the thin dogleg','Widen the turning pocket','Moor at Thawmark jetty']
        },'The winter anchorage has opened, but Thawmark’s supply jetty is still behind a pressure ridge. Take Kestrel through the thinner dogleg. Broken sheet leaves slush and drifting floes; slow as you enter the basin. Widen the marked turning pocket before docking.',
        'Build 3–5 kn in open water and meet thin sheet bow first. The cream pressure ridge cannot be broken. Sweep the amber turning pocket until 86% is clear, then moor at the green jetty in neutral.',[600,800,1100]),
        base(2,'Borrowed Water','Loaded supply ship · continuous spacing',[90,380,0],supply,[920,580],{
            mission:'follow',cell:12,thickness:.82,closing:58,route:lead,thinWidth:52,thinIce:.25,
            patches:[{x:400,y:218,w:85,h:98,thickness:.58}],
            water:[{x:92,y:380,rx:118,ry:76},{x:805,y:310,rx:90,ry:84}],
            ridges:[],berth:berth(827,336),docks:[{x:853,y:352,w:46,h:20,name:'GLASS QUAY'}],
            fleet:[{id:'leader',name:'RIME · COMPACT ICEBREAKER',start:[163,380,0],spec:{...breaker,name:'RIME',beam:18},
                leader:true,route:[...lead.slice(1),[823,271]],cruise:2.8}],
            landmarks:[{x:108,y:464,text:'DEPARTURE LEAD'},{x:442,y:203,text:'COMPRESSED SHEET'},{x:754,y:414,text:'COUNCIL FREIGHT TERMINAL'}],
            dispatch:['NARROWS COMPACT / PASSAGE SERVICE','Rime will pilot the lead at working speed. The Shelf League’s survey marks disagree with ours; follow the water the breaker actually opens. Lantern’s cargo belongs to the Council. Give the breaker room to stop.'],
            objectives:['Follow Rime through the lead','Deliver Lantern’s cargo at Glass Quay']
        },'Lantern is heavily laden and cannot break a new route. Follow Rime through the winding lead. New water thickens into slush behind the icebreaker; crowding her bow-to-stern leaves no braking room when she meets compressed sheet.',
        'Aim for 25–65 m of water between hulls. Read the gap and closing rate, anticipate the thick patch, and steer the stern through each bend. Rime waits at the far end; there is no arrival deadline. If heavy slush leaves you struggling, retry when you choose.',[360,500,700]),
        base(3,'Deliveries Beyond the Map','Route preparation · two deliveries and returns',[155,375,0],breaker,[900,660],{
            mission:'convoy',cell:12,thickness:.88,closing:112,route:north,thinWidth:64,thinIce:.27,
            secondary:{route:south,width:70,thickness:.48,closing:240},
            water:[{x:120,y:380,rx:157,ry:133},{x:690,y:178,rx:102,ry:86},{x:700,y:425,rx:107,ry:87},{x:445,y:475,rx:73,ry:55}],
            ridges:[{x:360,y:282,w:310,h:69}],berth:berth(107,385,Math.PI),
            docks:[{x:750,y:117,w:27,h:80,name:'TERN ASSEMBLY'},{x:757,y:392,w:25,h:79,name:'CINDER CO-OPERATIVE'}],
            fleet:[
                {id:'morrow',name:'MORROW · HEAT & MEDICINES',start:[100,325,0],spec:{...supply,name:'MORROW',length:36,mass:1.55},cruise:2.1,
                    route:[[190,328],...north.slice(1)],home:[[684,225],[565,204],[447,222],[351,253],[259,310],[100,325]],unload:16},
                {id:'sedge',name:'SEDGE · FOOD & GENERATORS',start:[100,440,0],spec:{...supply,name:'SEDGE',length:37,mass:1.6},cruise:2,
                    route:[[194,430],...south.slice(1)],home:[[677,478],[579,468],[476,492],[365,514],[246,476],[100,440]],unload:19}
            ],
            bergs:[{id:'entrance-berg',x:292,y:197,vx:0,vy:.23,length:63,beam:37,keel:22,range:{x:292,y:245,rx:0,ry:118}}],
            landmarks:[{x:113,y:535,text:'SAFE WATER / COUNCIL ANCHORAGE'},{x:425,y:410,text:'SHELTERED WAITING BASIN'},{x:458,y:312,text:'OLD PRESSURE RIDGE'}],
            dispatch:['FREE ANCHORAGE COUNCIL / 08:45','Tern’s assembly and Cinder’s co-operative have each authorized a supply call. Neither accepts the other powers’ berth permits. Deliver to both, then bring both crews back to safe water. They decide when their cargo is ashore; you decide whether the route home will hold.'],
            objectives:['Morrow: unload at Tern and return','Sedge: unload at Cinder and return','Bring Kestrel home']
        },'Prepare both branches for Morrow and Sedge. The northern sheet breaks easily but closes quickly, and an iceberg crosses its entrance. The longer southern cut has heavier ice and a sheltered waiting basin. Give each supply ship Hold or Proceed; their captains steer the marked routes.',
        'Clear both sides of the dashed route for the outward and return legs. Hold starts a braking maneuver, not an instant stop. After unloading each captain waits for a fresh Proceed order. Both ships must return to safe water before Kestrel can finish.',[1200,1800,2400]),
        base(4,'Buoys, Not Borders','Survey rescue · weapons restricted',[120,520,0],breaker,[960,720],{
            mission:'survey',cell:12,thickness:.82,closing:220,thinIce:.3,thinWidth:72,
            route:[[600,280],[500,245],[405,180],[290,205],[170,340],[120,500]],
            openWaterRoutes:[{route:[[120,500],[260,570],[420,600],[580,550],[640,435],[600,335],[600,280]],width:130}],
            water:[{x:120,y:510,rx:120,ry:100},{x:600,y:290,rx:110,ry:100}],
            ridges:[{x:320,y:380,w:175,h:65}],berth:berth(135,510,Math.PI),docks:[],
            survey:{id:'survey',name:'CALIPER',start:[600,280,Math.PI/2],spec:{length:31,beam:10,mass:1.25,propulsion:0,disabled:true,iceClass:0},safe:{x:135,y:510,rx:100,ry:78}},
            assets:[{id:'monitor',name:'CIVILIAN MONITORING STATION',x:653,y:186,w:48,h:40,hp:100,team:'civilian'}],
            patrols:[
                {id:'picket-a',name:'SHELF PICKET 1',start:[390,272,0],spec:patrol,route:[[390,272],[480,315]],cruise:1.2},
                {id:'picket-b',name:'SHELF PICKET 2',start:[505,366,Math.PI],spec:patrol,route:[[505,366],[405,308]],cruise:1.1}
            ],
            patrolWater:[{route:[[390,272],[480,315],[505,366],[405,308]],width:85},{route:[[390,272],[260,425],[120,510]],width:85}],
            exclusion:[[357,250],[420,292],[487,337],[531,384]],
            cutters:[{id:'awl',name:'AWL · COUNCIL ICEBREAKER',team:'friendly',start:[135,455,-1.2],spec:cutter,cruise:2.8,
                route:[[135,455],[170,340],[290,205],[405,180],[500,245],[565,335]],width:80,thickness:.28}],
            landmarks:[{x:145,y:637,text:'COUNCIL SAFE WATER'},{x:363,y:473,text:'LONG SOUTHERN ROUTE'},{x:332,y:140,text:'NARROW OPENING LEAD'}],
            dispatch:['FREE ANCHORAGE COUNCIL / 11:10','Caliper’s steering gear has failed beside the shelf observatory. Recover her scientific recorders and tow the vessel home. Shelf League pickets are placing exclusion buoys across the direct exit. They call this a survey precaution; the Council has not agreed. No weapons are authorized.'],
            objectives:['Recover Caliper’s scientific recorders','Tow Caliper into safe water','Moor Kestrel without damaging the station']
        },'Rival pickets obstruct the direct passage and demand course changes. Awl is cutting a narrow northern lead; follow her actual wake or take the long open southern route. Approach Caliper slowly to transfer her recorders, then connect Kestrel’s stern towline to her bow. Protect the civilian station.',
        'F connects or releases the line when the towing points are within 55 m and relative speed is low. J/K shorten/lengthen it. Recorder transfer takes eight steady seconds nearby. The tow has inertia and can swing into ice; its whole hull must return.',[800,1100,1500]),
        base(5,'Home Ice','Armed escort · defend the unloading window',[295,390,0],armed,[1000,760],{
            mission:'defense',cell:12,thickness:.8,closing:260,thinIce:.35,thinWidth:66,
            route:[[235,390],[425,390],[655,390],[820,390]],
            water:[{x:180,y:390,rx:190,ry:210},{x:820,y:385,rx:150,ry:280}],
            ridges:[],berth:berth(280,390,Math.PI),docks:[],
            cutters:[
                {id:'north-cutter',name:'SHELF ICEBREAKER N',team:'hostile',start:[750,205,Math.PI],spec:cutter,cruise:2.8,depart:8,
                    route:[[750,205],[650,205],[440,245],[270,300],[230,230]],width:80,thickness:.28},
                {id:'middle-cutter',name:'SHELF ICEBREAKER C',team:'hostile',start:[750,390,Math.PI],spec:cutter,cruise:2.8,depart:70,
                    route:[[750,390],[650,390],[470,390],[350,390],[310,520]],width:82,thickness:.28},
                {id:'south-cutter',name:'SHELF ICEBREAKER S',team:'hostile',start:[775,570,Math.PI],spec:cutter,cruise:2.8,depart:135,
                    route:[[775,570],[650,585],[460,545],[270,475],[250,540]],width:88,thickness:.28}
            ],
            assets:[{id:'base',name:'THAWMARK SUPPLY BASE',x:215,y:362,w:42,h:56,hp:140,team:'friendly',essential:true}],
            fleet:[
                {id:'hearth',name:'HEARTH · HEATING FUEL',start:[170,310,Math.PI],spec:{...supply,name:'HEARTH',length:36,mass:1.6},cruise:1.8,unload:360,unloading:true,route:[[170,310]],home:[[95,310]]},
                {id:'pantry',name:'PANTRY · FOOD & MEDICINES',start:[170,465,Math.PI],spec:{...supply,name:'PANTRY',length:37,mass:1.7},cruise:1.7,unload:600,unloading:true,route:[[170,465]],home:[[95,465]]}
            ],
            gun:{range:290,arc:1.05,hold:2.5,reload:9,damage:36,ammo:28,shellSpeed:55,maxSpeed:1.25,maxTurn:.02},
            raiders:[
                {id:'north-boat',name:'NORTH RAIDER',start:[830,205,Math.PI],spec:raider,cruise:2.4,spawn:0},
                {id:'middle-boat',name:'CENTRAL RAIDER',start:[830,390,Math.PI],spec:raider,cruise:2.3,spawn:55},
                {id:'south-boat',name:'SOUTH RAIDER',start:[850,585,Math.PI],spec:raider,cruise:2.4,spawn:125}
            ],
            landmarks:[{x:108,y:615,text:'TRANSPORT SAFE WATER'},{x:800,y:89,text:'SHELF LEAGUE APPROACHES'}],
            dispatch:['COUNCIL HARBOR DEFENSE / 14:35','The League calls the depot a Compact fuel dump. Hearth carries heating oil; Pantry carries food and medicines. Their captains need time at the hoses and cranes. Weapons are now authorized against attacking craft. Get the essential cargo ashore and both ships clear.'],
            objectives:['Land Hearth’s and Pantry’s essential cargo','Get both transports into safe water']
        },'Three visible Shelf icebreakers are opening approaches for the raiders. Disabled cutters coast to a stop, but their wakes remain open. Raiders use connected water, including any shortcuts you cut. Defend the unloading transports, then give each captain Proceed to escape. Destroying every attacker is not required.',
        'Select a hostile contact with T or the target buttons. Hold a steady bow solution below 2.4 kn; B fires one round. Red solution lines warn of enemy fire. Hold/Proceed lets you time each transport’s departure after unloading.',[620,800,1100]),
        base(6,'The Other Shore','Military strike · disable and withdraw',[125,590,0],armed,[1080,780],{
            mission:'strike',cell:12,thickness:.82,closing:170,thinIce:.35,thinWidth:80,
            route:[[125,590],[340,540],[520,445],[685,370],[825,350]],
            openWaterRoutes:[{route:[[125,590],[340,540],[520,445],[685,370],[825,350]],width:120},{route:[[825,350],[940,480],[965,640]],width:120}],
            water:[{x:125,y:590,rx:125,ry:112},{x:802,y:280,rx:125,ry:105},{x:965,y:650,rx:100,ry:90}],
            ridges:[{x:434,y:282,w:180,h:80}],berth:berth(125,590,Math.PI),docks:[],
            cutters:[{id:'rime',name:'RIME · COMPACT ICEBREAKER',team:'friendly',start:[260,550,-1.09],spec:cutter,cruise:3.1,
                route:[[260,550],[325,425],[395,245],[560,185],[710,200],[855,265]],width:80,thickness:.28}],
            assets:[
                {id:'battery',name:'COASTAL BATTERY',x:716,y:330,w:36,h:38,hp:108,team:'hostile',gun:{range:340,arc:.75,hold:4,reload:18,damage:18,shellSpeed:48},a:Math.PI},
                {id:'fuel',name:'FUEL-TRANSFER MACHINERY',x:884,y:317,w:33,h:57,hp:90,team:'hostile'}
            ],
            gun:{range:290,arc:1.05,hold:2.5,reload:9,damage:36,ammo:24,shellSpeed:55,maxSpeed:1.25,maxTurn:.02},
            raiders:[
                {id:'response-a',name:'RESPONSE BOAT 1',start:[965,640,-Math.PI/2],spec:raider,cruise:2.3,alarmDelay:60},
                {id:'response-b',name:'RESPONSE BOAT 2',start:[1000,685,-Math.PI/2],spec:raider,cruise:2.2,alarmDelay:115}
            ],
            fragments:4,fragmentFromX:510,
            bergs:[{id:'inlet-berg',x:579,y:438,vx:0,vy:.11,length:47,beam:25,keel:18,range:{x:579,y:454,rx:0,ry:58}}],
            landmarks:[{x:134,y:736,text:'WITHDRAWAL / SAFE WATER'},{x:510,y:141,text:'RIME’S FLANK CUT'},{x:762,y:435,text:'EXPOSED MAIN INLET'}],
            dispatch:['NARROWS COMPACT / COUNCIL LIAISON / 17:05','Disable the League battery and the military fuel-transfer plant at Ravel Shelf, then withdraw. The Council’s liaison has removed civilian berths from the target list. The flank chart is already out of date; send no crew through on momentum alone. Reinforcements are expected once the battery reports contact.'],
            objectives:['Disable the coastal battery','Disable the military fuel-transfer machinery','Withdraw and secure Kestrel']
        },'The main inlet is open and covered by the coastal battery. Rime is cutting the thinner northern flank; the dashed line is her intended route, not open water. Follow the icebreaker or prepare your own approach. Disable both military installations and withdraw to the green home berth. Response boats and drifting ice can obstruct your return.',
        'The forward gun needs a clear arc and 2.5 seconds below 2.4 kn with little turn. T selects, B fires. The battery announces its firing solution before launching a visible shell. Plan a retreat while opening your approach.',[650,900,1250])
    ];
    const underwater=typeof module!=='undefined'&&module.exports?require('./submarine-levels.js'):root.PaleReachSubmarineLevels;
    levels.push(...underwater.levels);
    const finale=typeof module!=='undefined'&&module.exports?require('./polar-finale-levels.js'):root.PaleReachFinaleLevels;
    levels.push(...finale.levels);
    for(const level of levels)delete level.standalone;
    const api={levels,breaker,supply};
    if(typeof module!=='undefined'&&module.exports)module.exports=api;
    root.PaleReachLevels=api;
})(globalThis);
