/* Gerbozilla: rolling terrain, water traction and twelve championship field courses. */
(function (root) {
    'use strict';
    const P = typeof module !== 'undefined' && module.exports ? require('./physics.js') : root.HarborPhysics;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const level = {
        id: 'gerbo-first-outing', name: 'A Small Problem in Seedhaven', kind: 'Rolling / ridge / lake / two districts',
        start: [130, 530, 0], world: [1500, 920], pace: [125, 180, 260], standalone: false,
        brief: 'Gerbozilla has outgrown the exercise wheel. Build a run-up over the ridge, coast across Blue Lake, flatten Seedhaven’s two evacuated districts, then settle in the recovery meadow. The northern district needs a little redirection.',
        tip: 'Hold the direction buttons to push. Push against your motion to brake. Water removes traction, not momentum. Shield gives 3 seconds of protection; recharge takes another 6 seconds.',
        spec: { name: 'GERBOZILLA', length: 48, beam: 48, mass: 8, draft: 0, vessel: 'ball' },
        // Used only by generic record/UI setup. Gerbozilla has circular, not ship-hull, geometry.
        berth: { x: 1340, y: 365, a: 0, l: 150, w: 150, speed: .8 },
        rampage: {
            radius: 24, drive: 1.9, resistance: .032, waterResistance: .050,
            sheet: 'SEEDHAVEN', subtitle: 'A SMALL PROBLEM',
            hills: [
                { x: 343, y: 510, rx: 65, ry: 195, height: 43, lobes: [{ x: 42, y: -105, rx: 58, ry: 83, height: 17 }] },
                { x: 540, y: 155, rx: 155, ry: 115, height: 78, angle: .23, lobes: [{ x: -85, y: 38, rx: 87, ry: 57, height: 34 }] },
                { x: 1035, y: 790, rx: 225, ry: 103, height: 95, angle: -.09, lobes: [{ x: 126, y: 23, rx: 83, ry: 64, height: 38 }] },
                { x: 1380, y: 120, rx: 185, ry: 80, height: 55, lobes: [{ x: -83, y: 33, rx: 96, ry: 44, height: 24 }] }
            ],
            lakes: [{ x: 600, y: 515, rx: 78, ry: 152, shore: [.13, .08, .4], name: 'BLUE LAKE' }],
            controls: [
                { x: 435, y: 530, r: 63, name: 'Ridge cleared' },
                { x: 727, y: 515, r: 58, name: 'Lake crossed' }
            ],
            districts: [
                { id: 'seedworks', name: 'Seedworks', x: 900, y: 515, r: 34, health: 72, defence: true },
                { id: 'north-ward', name: 'North Ward', x: 1120, y: 360, r: 34, health: 72, defence: true }
            ],
            finish: { x: 1340, y: 365, r: 78 }
        }
    };
    const course = (id, name, kind, start, world, brief, tip, config) => ({
        id, name, kind, start, world, brief, tip, standalone: false, pace: [160, 220, 320],
        spec: { ...level.spec },
        berth: { x: config.finish.x, y: config.finish.y, a: 0, l: 156, w: 156, speed: .8 },
        rampage: { radius: 24, drive: 1.9, resistance: .032, waterResistance: .05, ...config }
    });
    // Closed contours are climbable terrain, never a binary speed gate. The
    // walls oppose a standing push strongly enough that a real run-up matters.
    const bank = course('gerbo-banking', 'Banks for the Memories', 'Mountain-ring fortresses / run-ups / banked exits',
        [150, 650, 0], [2540, 1350],
        'Sunflower and Hayloft have retreated inside mountain bowls. The enclosing ridgelines cannot be crept over from their foot: gather speed on the western flats, crest the rim and shield the ram. Keep enough momentum to climb out again.',
        'A closed brown rim is a real hill. Its steep face can overpower your push. Back away for a longer run-up; do not grind against it. Shield protects the shell, not your momentum.', {
            sheet:'SUNFLOWER CITADELS', subtitle:'BANKS FOR THE MEMORIES',
            hills:[
                {x:755,y:265,rx:107,ry:280,height:103,angle:-.53,lobes:[{x:110,y:100,rx:96,ry:123,height:36}]},
                {x:1360,y:1070,rx:240,ry:80,height:72,angle:-.2,lobes:[{x:-130,y:15,rx:98,ry:50,height:30}]}
            ],
            rims:[
                {x:1060,y:650,r:170,width:28,height:47,shore:[.07,.035,.5],name:'CUSHION WALL'},
                {x:1640,y:530,r:150,width:27,height:44,shore:[.06,.04,1.7],name:'HAYLOFT RIM'}
            ],
            forests:[
                {x:315,y:275,rx:205,ry:125,angle:-.32,shore:[.18,.06,.7],density:.5,name:'CLOVER COPSE'},
                {x:775,y:1140,rx:260,ry:135,angle:.18,shore:[.16,.08,2.4],density:.65,name:'LOWLAND PINES'},
                {x:1975,y:205,rx:270,ry:105,angle:-.21,shore:[.13,.09,1.1],density:.45,name:'HAYLOFT WOOD'},
                {x:2150,y:1010,rx:200,ry:130,angle:.48,shore:[.15,.07,3],density:.6}
            ],
            lakes:[{x:350,y:1080,rx:160,ry:80,shore:[.16,.08,2.1],name:'CLOVER MERE'}],
            controls:[{x:640,y:650,r:68,name:'Western run-up'}],
            districts:[
                {id:'sunflower',name:'Sunflower',x:1060,y:650,r:34,health:105,defence:true},
                {id:'hayloft',name:'Hayloft',x:1640,y:530,r:34,health:95,defence:true}
            ],finish:{x:2250,y:540,r:87}, authorSpeed:34
        });
    const lakes = course('gerbo-lake-skipping', 'No Grip, No Problem', 'Island cities / closed moats / long-range retaliation',
        [150,420,0],[2250,1820],
        'Reedworks, Oatbridge and Pipsqueak Point are island citadels. Each complete water moat removes your paw traction. Every demolition alerts an off-map battery: three marked long-range strikes follow, even after the local guns are rubble.',
        'Build speed before entering each moat. Retaliation marks lock onto the map, not onto you: change course after the red circles appear, or shield at impact. Keep rolling after a demolition.',{
            sheet:'THE RETALIATING LAKE DISTRICT',subtitle:'NO GRIP, NO PROBLEM',
            hills:[{x:300,y:125,rx:160,ry:60,height:45,lobes:[{x:80,y:30,rx:70,ry:45,height:22}]}],
            lakes:[
                {x:900,y:420,rx:235,ry:225,inner:.46,shore:[.08,.04,1.3],name:'REED MOAT'},
                {x:1640,y:780,rx:235,ry:230,inner:.47,shore:[.07,.045,3],name:'OAT MOAT'},
                {x:1150,y:1370,rx:230,ry:230,inner:.46,shore:[.09,.035,2],name:'PIPSQUEAK MOAT'}
            ],
            forests:[
                {x:440,y:915,rx:265,ry:185,angle:-.3,shore:[.16,.07,2],density:.55,name:'REEDBANK ALDERS'},
                {x:1550,y:180,rx:270,ry:95,angle:.17,shore:[.18,.06,.7],density:.5,name:'OAT GROVE'},
                {x:1930,y:1450,rx:165,ry:200,angle:.4,shore:[.14,.09,1.8],density:.65},
                {x:245,y:1650,rx:145,ry:100,angle:-.2,shore:[.18,.07,2.9],density:.4}
            ],
            controls:[{x:430,y:420,r:62,name:'Build crossing speed'},
                {x:2010,y:1030,r:65,name:'Dry turning ground',after:'oatbridge',number:4}],
            districts:[
                {number:2,id:'reedworks',name:'Reedworks',x:900,y:420,r:33,health:85,defence:true},
                {number:3,id:'oatbridge',name:'Oatbridge',x:1640,y:780,r:33,health:90,defence:true},
                {number:5,id:'pipsqueak',name:'Pipsqueak Point',x:1150,y:1370,r:33,health:85,defence:true}
            ],retaliation:{delays:[10,18,26],warning:7.5,lead:0,radius:66,damage:24},
            finish:{x:520,y:1420,r:90},authorSpeed:35
        });
    const downhill = course('gerbo-downhill', 'It All Goes Downhill', 'Summit launch / flooded caldera / single heavy ram',
        [225,225,0],[2350,1500],
        'Start high on Mount Muesli. The single fortified caldera town lies behind a broad flooded rim. Trade height for speed on the descent, cross the moat and break the armored core in one shielded impact; then roll out to the eastern meadow.',
        'Gravity supplies the run-up. Aim before the long descent; frantic steering in the flooded rim only makes tiny squeaks. The armored town needs a harder hit than Seedhaven.',{
            sheet:'MOUNT MUESLI',subtitle:'IT ALL GOES DOWNHILL',
            // A broken, oblique crest with separate spurs and a saddle, not a round dome.
            hills:[{x:150,y:145,rx:168,ry:84,height:126,angle:.7,
                    lobes:[{x:95,y:-95,rx:122,ry:55,height:62,angle:-1},
                           {x:-70,y:155,rx:130,ry:68,height:63,angle:.65}]},
                {x:445,y:190,rx:166,ry:67,height:70,angle:-.23,
                    lobes:[{x:112,y:63,rx:105,ry:53,height:35,angle:.9}]},
                {x:1405,y:1240,rx:188,ry:69,height:67,angle:-.35,
                    lobes:[{x:230,y:-45,rx:140,ry:58,height:53,angle:.85},
                           {x:-90,y:105,rx:92,ry:54,height:28,angle:1.1}]}],
            forests:[{x:220,y:950,rx:150,ry:205,angle:-.3,shore:[.18,.07,1.7],density:.6,name:'MUESLI LARCHES'},
                {x:1070,y:205,rx:295,ry:120,angle:-.15,shore:[.13,.08,.7],density:.5},
                {x:2140,y:420,rx:125,ry:195,angle:.32,shore:[.19,.06,2],density:.7}],
            rims:[{x:1540,y:860,r:155,width:25,height:38,shore:[.06,.03,.9],name:'CALDERA RIM'}],
            lakes:[{x:1540,y:860,rx:290,ry:275,inner:.68,shore:[.075,.035,2.4],name:'FLOODED CALDERA'}],
            controls:[{x:755,y:610,r:85,name:'Downhill commitment'}],
            districts:[{id:'caldera',name:'Caldera Vault',x:1540,y:860,r:41,health:185,defence:true}],
            finish:{x:2070,y:970,r:92},authorSpeed:40
        });
    const fortress = course('gerbo-fort-pillow', 'Fort Pillow', 'Double moat / mountain wall / siege and extraction',
        [150,1110,0],[3100,1930],
        'Fort Pillow has two water moats with a steep mountain ring between them. One long run-up must pay for the outer crossing, the uphill crest and the inner crossing. Destroy the command core, escape its retaliatory strike pattern, then take the northern satellite fort before extraction.',
        'Spend momentum, not patience. A shield will not pull you out of a moat. Preserve speed through the nested defenses; after the command core falls, the eastern muster point provides room to turn north.',{
            sheet:'FORT PILLOW DEFENSE RESERVE',subtitle:'ONE VERY LARGE PILLOW FIGHT',
            hills:[{x:450,y:1670,rx:150,ry:70,height:63,angle:-.45,
                    lobes:[{x:165,y:-10,rx:130,ry:53,height:42,angle:.85},
                           {x:-120,y:82,rx:115,ry:45,height:29,angle:.3}]},
                {x:1215,y:840,rx:80,ry:120,height:24,angle:.52},
                {x:1730,y:1390,rx:125,ry:65,height:32,angle:-.55},
                {x:1480,y:1505,rx:80,ry:125,height:23,angle:.4}],
            forests:[{x:555,y:350,rx:315,ry:155,angle:-.3,shore:[.16,.08,2.2],density:.65,name:'PILLOW PINE RESERVE'},
                {x:730,y:1450,rx:260,ry:120,angle:.3,shore:[.19,.07,.4],density:.5},
                {x:2670,y:1380,rx:240,ry:180,angle:-.6,shore:[.18,.08,1],density:.6},
                {x:2760,y:805,rx:180,ry:130,angle:.2,shore:[.15,.06,2.8],density:.45}],
            rims:[{x:1560,y:1110,r:244,width:28,height:37,shore:[.1,.055,.8],bends:[[.065,1,.5],[.045,2,1.4]],name:'PILLOW WALL'},
                {x:2170,y:370,r:155,width:26,height:44,shore:[.06,.035,1.8],name:'SATELLITE RIM'}],
            lakes:[{x:1560,y:1110,rx:420,ry:410,inner:.76,shore:[.045,.03,2],name:'OUTER MOAT'},
                {x:1560,y:1110,rx:191,ry:190,inner:.52,shore:[.07,.035,.5],name:'INNER MOAT'}],
            controls:[{x:700,y:1110,r:70,name:'Siege run-up'},
                {x:2240,y:1090,r:82,name:'Eastern muster',after:'pillow-command',number:3}],
            districts:[{number:2,id:'pillow-command',name:'Pillow Command',x:1560,y:1110,r:38,health:140,defence:true},
                {id:'satellite-fort',name:'Satellite Fort',x:2170,y:370,r:36,health:110,defence:true}],
            retaliation:{delays:[10,18,26],warning:7.5,lead:0,radius:74,damage:26},
            finish:{x:2810,y:355,r:90},authorSpeed:42
        });
    // Orienteering routes and the three new gimmick missions. Black geometry
    // is impassable even with a shield; forest drag is separate from elevation.
    const boulder = (x,y,rx,ry,phase=0) => ({x,y,rx,ry,phase});
    const wall = (x,y,w,h,extra={}) => ({poly:[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}], lowWall:true, ...extra});
    const forest = course('gerbo-forest-slalom', 'The Black Boulder Wood', 'Orienteering / ordered controls / forest versus clearings',
        [180,1100,0],[1800,1320],
        'No cities today. Punch five controls in order through Bramble Wood. Black boulders are solid, not hills to crest. The darkest forest eats rolling speed; longer routes through pale clearings can be faster than a direct push through the trees.',
        'Read the magenta numbers before committing. Ease off before the boulder chicanes. Shields prevent damage, not collisions. Finish with paws off in the southern clearing.', {
            retiredId:'gerbo-hairpin',sheet:'BRAMBLE WOOD',subtitle:'THE BLACK BOULDER WOOD',
            hills:[{x:1060,y:1020,rx:140,ry:90,height:23,lobes:[{x:70,y:-20,rx:90,ry:60,height:11}]},
                {x:725,y:1140,rx:140,ry:68,height:32,angle:.3,lobes:[{x:-90,y:-40,rx:85,ry:45,height:19}]},
                {x:1410,y:580,rx:120,ry:66,height:26,angle:.6,lobes:[{x:-60,y:90,rx:80,ry:48,height:15}]}],
            forests:[{x:570,y:820,rx:380,ry:280,shore:[.15,.08,.7],density:.75},
                {x:940,y:380,rx:260,ry:150,shore:[.18,.08,2],density:1},
                {x:1530,y:1000,rx:160,ry:180,shore:[.12,.1,1],density:.55}],
            rocks:[boulder(550,960,115,125,.5),boulder(670,480,180,105,1),
                boulder(1170,440,130,195,2),boulder(1390,890,125,95,.1)],
            lakes:[{x:285,y:265,rx:125,ry:120,shore:[.15,.09,2],name:'FERN POND'},
                {x:555,y:810,rx:102,ry:57,angle:-.28,shore:[.18,.07,1.3],name:'BRAMBLE TARN'},
                {x:1400,y:605,rx:94,ry:52,angle:.55,shore:[.16,.08,2.4],name:'BIRCH POOL'}],
            controls:[{x:330,y:650,r:65,name:'Fern clearing'},{x:880,y:710,r:65,name:'South of the split stone'},
                {x:940,y:180,r:60,name:'Northern notch'},{x:1500,y:230,r:65,name:'Beyond the black wall'},
                {x:1620,y:720,r:60,name:'Birch clearing'}],districts:[],finish:{x:1560,y:1120,r:87},authorSpeed:24
        });
    const duel = course('gerbo-cavy-clash', 'A Very Territorial Guinea Pig', 'Telegraphed charges / mutual impacts / recovery windows',
        [260,1020,0],[1950,1350],
        'Cavyclasm has declared this entire valley his food bowl. He marks a charge, commits to that line and needs a breather afterwards. Build a run-up and shield the collision. Both giants recoil; your shield does not stop him moving.',
        'Red dashes show a locked charge, not a homing attack. Bait him past a boulder, then strike during recovery. A defeated pet curls up for a nap. Clear the approach control and return to the western meadow.', {
            sheet:'CAVYCLASM’S FOOD BOWL',subtitle:'A VERY TERRITORIAL GUINEA PIG',
            hills:[{x:1630,y:285,rx:170,ry:80,height:30,lobes:[{x:60,y:30,rx:80,ry:50,height:12}]},
                {x:1010,y:1110,rx:215,ry:83,height:33,angle:-.35,lobes:[{x:125,y:70,rx:115,ry:60,height:21}]},
                {x:600,y:170,rx:115,ry:57,height:29,angle:.72,lobes:[{x:140,y:50,rx:104,ry:65,height:20}]},
                {x:1010,y:685,rx:125,ry:70,height:16,angle:-.6}],
            forests:[{x:660,y:1050,rx:180,ry:160,density:.7,shore:[.16,.07,.8]},
                {x:1600,y:530,rx:170,ry:190,density:.5,shore:[.14,.08,2]}],
            rocks:[boulder(880,310,100,95,.5),boulder(1490,850,105,180,2),boulder(480,550,90,120,1)],
            lakes:[],controls:[{x:550,y:970,r:75,name:'Enter the feeding grounds'}],districts:[],
            monsters:[{id:'cavyclasm',name:'Cavyclasm',kind:'guinea-pig',x:1160,y:610,r:60,mass:14,health:240}],
            finish:{x:285,y:250,r:95},authorSpeed:28
        });
    const fire = course('gerbo-pepperbreath', 'Pepperbreath at Marshmallow Keep', 'Pepper pickup / fire arcs / armored walls',
        [180,680,0],[1800,1300],
        'Marshmallow Keep’s low stone walls stop even a mountain-sized exercise ball. Collect the giant pepper, then circle the keep and breathe fire over its walls into three armored districts. There is no ramming shortcut through the masonry.',
        'Hold Fire to breathe toward your last directional push. Release Fire to refill the breath meter. Low walls can be fired over; giant black boulders block the flame. Fire is unavailable in deep water. Shield the automated return fire.', {
            sheet:'MARSHMALLOW KEEP',subtitle:'PEPPERBREATH',
            hills:[{x:240,y:220,rx:120,ry:60,height:18,lobes:[{x:55,y:-20,rx:65,ry:45,height:8}]}],
            forests:[{x:420,y:320,rx:210,ry:150,shore:[.18,.08,1],density:.65}],
            rocks:[wall(880,340,630,22),wall(880,920,630,22),wall(880,340,22,602),wall(1488,340,22,602),
                boulder(740,1040,85,110,1),boulder(1590,270,75,100,2)],
            lakes:[{x:535,y:265,rx:91,ry:64,angle:-.25,shore:[.15,.09,.6],name:'SUGAR POND'},
                {x:1210,y:1110,rx:142,ry:67,angle:.2,shore:[.18,.06,2.3],name:'COCOA POOL'}],
            controls:[{x:420,y:680,r:65,name:'Giant pepper collected'}],
            fire:{unlockControl:1,range:340,spread:.38,capacity:3,recharge:.6,dps:44},
            districts:[{id:'sugar',name:'Sugar Battery',x:1050,y:540,r:33,health:100,defence:true,fireOnly:true},
                {id:'mallow',name:'Mallow Foundry',x:1250,y:540,r:33,health:100,defence:true,fireOnly:true},
                {id:'fluff',name:'Fluff Command',x:1350,y:740,r:33,health:100,defence:true,fireOnly:true}],
            finish:{x:400,y:1030,r:90},authorSpeed:26
        });
    const rescue = course('gerbo-whiskerdoom', 'Nobody Puts Whiskerdoom in a Cage', 'Break two locks / rabbit sentry / breadcrumb escort',
        [180,1260,0],[2400,1580],
        'Lady Whiskerdoom is being held in a granite menagerie. Flatten both external lock pylons to open its western gate and send Sir Flops-a-Lot to sleep. Roll close to greet her, then lead her along a safe route to the recovery meadow.',
        'She follows your trail and needs room to turn. Give her room in the gate, avoid ramming her and wait for her to catch up. Your shield protects your shell only. Both hamsters must get home.', {
            sheet:'THE GRANITE MENAGERIE',subtitle:'LADY WHISKERDOOM’S RESCUE',
            hills:[{x:470,y:375,rx:210,ry:90,height:22,lobes:[{x:100,y:30,rx:90,ry:60,height:10}]},
                {x:2090,y:780,rx:160,ry:78,height:31,angle:-.4,lobes:[{x:100,y:-30,rx:94,ry:55,height:18}]}],
            forests:[{x:1090,y:1190,rx:330,ry:170,shore:[.17,.09,1.6],density:.5},
                {x:620,y:570,rx:200,ry:180,shore:[.17,.07,2.4],density:.7}],
            rocks:[boulder(1230,440,155,180,1),boulder(750,910,140,180,2),
                wall(1660,300,380,22),wall(1660,600,380,22),wall(2018,300,22,322),
                wall(1660,300,22,120),wall(1660,500,22,122),wall(1660,420,22,80,{gate:true})],
            lakes:[{x:1810,y:1270,rx:150,ry:185,shore:[.17,.08,1],name:'TEARDROP MERE'}],
            controls:[],districts:[{id:'north-lock',name:'North Lock',x:1550,y:335,r:25,health:70,defence:false},
                {id:'south-lock',name:'South Lock',x:1550,y:630,r:25,health:70,defence:false}],
            monsters:[{id:'flops',name:'Sir Flops-a-Lot',kind:'rabbit',x:1180,y:890,r:48,mass:11,health:160}],
            rescue:{name:'Lady Whiskerdoom',x:1840,y:460,r:23,mass:7,health:100},
            finish:{x:410,y:1340,r:115},authorSpeed:26
        });
    const needles = (x,y,extra={}) => ({id:'needlesworth',name:'Sir Needlesworth',kind:'hedgehog',
        x,y,r:59,mass:20,health:100,invulnerable:true,required:false,...extra});
    const avoid = course('gerbo-prickly-business', 'Strictly No Petting', 'River crossing / invulnerable patrol / survey controls',
        [180,1040,0],[2080,1380],
        'Collect three ranger survey stamps in Needlewood, then return to the western meadow. Sir Needlesworth considers the survey equipment his property. Nothing can damage him. Build momentum to cross Bristle Brook, then return across it with all three stamps. Use the black outcrops to break up his charges and visit each control while he is committed elsewhere.',
        'Do not try to win a fight. The red charge line locks before he rolls. Pass behind him, take a clearing around the rocks, or shield a mistake. No monster defeat is required.', {
            sheet:'NEEDLEWOOD SURVEY RESERVE',subtitle:'STRICTLY NO PETTING',
            hills:[{x:1740,y:1060,rx:170,ry:100,height:24,lobes:[{x:-90,y:45,rx:95,ry:55,height:12}]}],
            forests:[{x:770,y:850,rx:250,ry:240,shore:[.16,.08,.8],density:.55},
                {x:1580,y:295,rx:240,ry:130,shore:[.14,.09,2],density:.55}],
            rocks:[boulder(720,790,110,145,.6),boulder(1260,440,120,165,1.5),boulder(1540,860,160,110,.2)],
            lakes:[{x:340,y:370,rx:155,ry:155,shore:[.17,.08,.9],name:'BRISTLE MERE'},
                {x:850,y:1220,name:'BRISTLE BROOK',river:{x:830,width:100,amplitude:85,period:780,phase:.5},
                    poly:riverRibbon(1380,{x:830,width:100,amplitude:85,period:780,phase:.5})}],
            controls:[{x:1050,y:1040,r:68,name:'South survey stamp'},
                {x:1720,y:650,r:65,name:'East survey stamp'},
                {x:1030,y:265,r:65,name:'North survey stamp'}],districts:[],
            monsters:[needles(1160,780,{ai:{range:720,prowlSpeed:7,approach:200,warning:2.5,charge:4,rest:7}})],
            finish:{x:280,y:1100,r:102},authorSpeed:24
        });
    const chase = course('gerbo-rolling-threat', 'A Hedge Against Disaster', 'Persistent pursuit / shield timing / forest pinches',
        [330,660,0],[2860,1380],
        'Carry the ranger warning through the three relay controls to the eastern refuge. Sir Needlesworth has decided to accompany you. His close pursuit and bristling spines make high-speed unshielded hits fatal. Read his wind-up and shield just before a hit, then use the impulse without rolling into black rock.',
        'He cannot be damaged, stunned into submission or put to sleep. Three seconds of shield, then six seconds of recharge. A blocked charge still pushes you. The final narrow rock notch fits your ball but not his spines; brake only after slipping through it.', {
            sheet:'THE BRISTLE EXPRESS',subtitle:'A HEDGE AGAINST DISASTER',
            hills:[{x:1820,y:1060,rx:180,ry:90,height:26,lobes:[{x:110,y:20,rx:90,ry:55,height:10}]}],
            forests:[{x:950,y:650,rx:180,ry:290,shore:[.12,.05,1],density:.8},
                {x:1820,y:630,rx:175,ry:285,shore:[.13,.07,2.4],density:.75}],
            rocks:[boulder(1050,300,180,120,.3),boulder(1050,1060,170,130,2),
                boulder(1870,295,185,120,1.4),boulder(1850,1060,175,135,.4),
                wall(2430,40,70,555,{lowWall:false}),wall(2430,685,70,655,{lowWall:false})],
            lakes:[{x:470,y:1120,rx:190,ry:95,shore:[.1,.07,1],name:'BOOT POND'}],
            controls:[{x:960,y:650,r:70,name:'Western warning relay'},
                {x:1770,y:670,r:70,name:'Eastern warning relay'},
                {x:2350,y:640,r:75,name:'Refuge approach'}],districts:[],
            monsters:[needles(160,650,{spineDamage:100,ai:{range:450,prowlSpeed:42,prowlAccel:5,approach:90,
                warning:1.8,charge:3.8,power:13,rest:6,cooldown:2}})],
            finish:{x:2630,y:640,r:120},authorSpeed:60
        });
    const escort = course('gerbo-long-way-home', 'The Long Way Home', 'Evacuation escort / interception / long-range strikes',
        [320,1050,0],[2760,1630],
        'Lady Whiskerdoom is already free and rolling beside you. Guide her from the forest refuge through two evacuation beacons to the eastern meadow. Crossing the first beacon draws Needlesworth out of the reserve; the second releases interceptors. An off-map battery targets both of you with fixed, clearly marked strikes.',
        'This is an escort, not another jailbreak. Follow a route that her slower ball can negotiate. Your shield protects only you. Knock mortal interceptors aside, lure the invulnerable hedgehog away, and keep her clear of red circles. Both hamsters must settle safely at home.', {
            sheet:'WHISKERDOOM’S EVACUATION ROUTE',subtitle:'THE LONG WAY HOME',
            hills:[{x:950,y:430,rx:220,ry:100,height:30,lobes:[{x:110,y:-30,rx:100,ry:70,height:16}]},
                {x:2110,y:1340,rx:240,ry:100,height:32,lobes:[{x:-120,y:30,rx:100,ry:65,height:12}]}],
            forests:[{x:470,y:1330,rx:250,ry:150,shore:[.15,.06,1],density:.6},
                {x:1380,y:550,rx:210,ry:150,shore:[.17,.06,2],density:.65},
                {x:2400,y:400,rx:230,ry:145,shore:[.13,.08,.3],density:.45}],
            rocks:[boulder(1110,750,125,145,1),boulder(1250,1340,155,115,.2),
                boulder(1970,370,150,115,2),boulder(2100,1100,130,175,.4)],
            lakes:[{x:1680,y:1190,rx:200,ry:170,shore:[.16,.08,1.2],name:'HOMEWARD MERE'}],
            controls:[{x:810,y:1040,r:75,name:'Leave the forest refuge'},
                {x:1600,y:780,r:75,name:'Eastern evacuation beacon'}],districts:[],
            monsters:[needles(520,670,{releaseControl:1,ai:{range:1500,prowlSpeed:13,approach:180,warning:2.6,charge:3.5,rest:7}}),
                {id:'nibbles',name:'Admiral Nibbles',kind:'mouse',x:1890,y:660,r:35,mass:5,health:115,
                    required:false,releaseControl:2,target:'lady',ai:{range:1100,prowlSpeed:9,warning:2.7,charge:3,power:5,rest:7}},
                {id:'flops-patrol',name:'Captain Cottonhop',kind:'rabbit',x:2230,y:450,r:46,mass:10,health:150,
                    required:false,releaseControl:2,target:'lady',ai:{range:1300,prowlSpeed:8,warning:2.8,charge:3.5,power:6,rest:8}}],
            rescue:{name:'Lady Whiskerdoom',x:210,y:1050,r:23,mass:7,health:100,free:true},
            ambushes:[{control:1,delays:[12,25,38],targets:['lady','player','lady']},
                {control:2,delays:[12,25,38,51],targets:['lady','player','lady','player']}],
            retaliation:{delays:[],warning:10,lead:2,radius:52,damage:22},
            finish:{x:2490,y:730,r:145},authorSpeed:17
        });
    avoid.pace=[280,360,480]; chase.pace=[95,125,180]; escort.pace=[245,335,460];
    // Gaussian shoulders make asymmetrical summits and saddles, while keeping
    // an exact analytical gradient shared by the physics and contour renderer.
    function terrain(c, x, y) {
        let height = 0, dx = 0, dy = 0;
        function add(h, ox, oy, angle) {
            const cs = Math.cos(angle), sn = Math.sin(angle), ex = x - ox, ey = y - oy;
            const u = (cs * ex + sn * ey) / h.rx, v = (-sn * ex + cs * ey) / h.ry;
            const z = h.height * Math.exp(-.5 * (u * u + v * v));
            height += z;
            dx -= z * (u * cs / h.rx - v * sn / h.ry);
            dy -= z * (u * sn / h.rx + v * cs / h.ry);
        }
        for (const h of c.hills) {
            add(h, h.x, h.y, h.angle || 0);
            for (const l of h.lobes || []) add(l, h.x + l.x, h.y + l.y, (h.angle || 0) + (l.angle || 0));
        }
        for (const v of c.volcanoes || []) {
            // A compact, smooth hill matches the visible apron. Its gradient
            // reaches zero at the summit and foot, with no invisible far slope.
            const radius=v.r+65,ex=x-v.x,ey=y-v.y,u=(ex*ex+ey*ey)/(radius*radius);
            if(u>=1)continue;
            const h=v.r*.28,t=1-u;
            height+=h*t*t*t;
            dx-=6*h*t*t*ex/(radius*radius);dy-=6*h*t*t*ey/(radius*radius);
        }
        for (const rim of c.rims || []) {
            const ex=x-rim.x, ey=y-rim.y, d=Math.hypot(ex,ey);
            if (d < 1e-6) continue; // Interior center is flat to numerical precision.
            const a=Math.atan2(ey,ex), [u,v,phase]=rim.shore || [0,0,0];
            let radius=rim.r*(1+u*Math.cos(3*a+phase)+v*Math.sin(5*a-phase));
            let derivative=rim.r*(-3*u*Math.sin(3*a+phase)+5*v*Math.cos(5*a-phase));
            for (const [amplitude, frequency, offset] of rim.bends || []) {
                radius += rim.r * amplitude * Math.cos(frequency*a+offset);
                derivative -= rim.r * amplitude * frequency * Math.sin(frequency*a+offset);
            }
            const q=(d-radius)/rim.width, z=rim.height*Math.exp(-.5*q*q), slope=-z*q/rim.width;
            height+=z; dx+=slope*(ex/d+derivative*ey/(d*d)); dy+=slope*(ey/d-derivative*ex/(d*d));
        }
        return { height, dx, dy };
    }
    // One shoreline definition for the visible coast and the traction probes.
    // Low-order waves make rounded bays and headlands, never sharp random noise.
    function shoreRadius(l, angle) {
        const [a, b, phase] = l.shore || [0, 0, 0];
        return 1 + a * Math.cos(3 * angle + phase) + b * Math.sin(5 * angle - phase);
    }
    function lakePoint(l, angle, scale = 1) {
        const r = shoreRadius(l, angle) * scale, cs = Math.cos(l.angle || 0), sn = Math.sin(l.angle || 0);
        const x = l.rx * r * Math.cos(angle), y = l.ry * r * Math.sin(angle);
        return {x: l.x + cs * x - sn * y, y: l.y + sn * x + cs * y};
    }
    function riverRibbon(height, river) {
        const left=[], right=[];
        for(let y=-120;y<=height+120;y+=12) {
            const t=y*Math.PI*2/river.period+river.phase;
            const x=river.x+river.amplitude*Math.sin(t)+river.amplitude*.28*Math.sin(t*2.3+.6);
            const half=river.width*.5*(1+.14*Math.sin(t*.8+1.1));
            left.push({x:x-half,y});right.push({x:x+half,y});
        }
        return left.concat(right.reverse());
    }
    function inLake(l, x, y) {
        if(l.poly) {
            if(l.river && Math.abs(x-l.river.x)>l.river.amplitude*1.28+l.river.width*.57) return false;
            let inside=false;
            for(let i=0,j=l.poly.length-1;i<l.poly.length;j=i++) {
                const a=l.poly[i],b=l.poly[j];
                if((a.y>y)!==(b.y>y) && x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x) inside=!inside;
            }
            return inside;
        }
        const cs = Math.cos(l.angle || 0), sn = Math.sin(l.angle || 0), dx = x - l.x, dy = y - l.y;
        const u = (cs * dx + sn * dy) / l.rx, v = (-sn * dx + cs * dy) / l.ry;
        const radius=shoreRadius(l, Math.atan2(v,u)), distance=Math.hypot(u,v);
        return distance < radius && (!l.inner || distance > radius*l.inner);
    }
    function water(c, s) {
        // Sample the footprint: traction fades across the shoreline, rather than flickering.
        let wet = 0;
        for (const [dx, dy] of [[0,0], [1,0], [-1,0], [0,1], [0,-1]]) {
            const x = s.x + dx * c.radius * .7, y = s.y + dy * c.radius * .7;
            if (c.lakes.some(l => inLake(l, x, y))) wet++;
        }
        return wet / 5;
    }
    function woodland(c, s) {
        // Feathered footprint sampling at the same rounded boundary drawn on paper.
        let cover = 0;
        for (const [dx,dy] of [[0,0],[.7,0],[-.7,0],[0,.7],[0,-.7]])
            cover += Math.max(0, ...(c.forests || []).filter(f => inLake(f,s.x+dx*c.radius,s.y+dy*c.radius)).map(f=>f.density));
        return cover / 5;
    }
    function rockPolygon(b) {
        if (b.poly) return b.poly.map(p=>({...p}));
        // Rounded but convex irregular boulders, exactly shared by physics and ink.
        return Array.from({length:9},(_,i)=>{
            const a=i*Math.PI*2/9+(b.phase || 0), r=1+.065*Math.cos(i*2+(b.phase || 0));
            return {x:b.x+Math.cos(a)*b.rx*r,y:b.y+Math.sin(a)*b.ry*r};
        });
    }
    function circleContact(s, radius, poly) {
        let inside=false, best=Infinity, closest=null;
        for(let i=0,j=poly.length-1;i<poly.length;j=i++) {
            const a=poly[j],b=poly[i],dx=b.x-a.x,dy=b.y-a.y;
            if((a.y>s.y)!==(b.y>s.y) && s.x<(b.x-a.x)*(s.y-a.y)/(b.y-a.y)+a.x) inside=!inside;
            const u=clamp(((s.x-a.x)*dx+(s.y-a.y)*dy)/(dx*dx+dy*dy || 1),0,1);
            const x=a.x+u*dx,y=a.y+u*dy,d=Math.hypot(s.x-x,s.y-y);
            if(d<best){best=d;closest={x,y,dx,dy};}
        }
        if(!inside && best>=radius) return null;
        let nx=(s.x-closest.x)/(best || 1),ny=(s.y-closest.y)/(best || 1);
        if(inside){nx=-nx;ny=-ny;}
        if(best<1e-9){const n=Math.hypot(closest.dx,closest.dy);nx=closest.dy/n;ny=-closest.dx/n;}
        return {nx,ny,depth:inside?radius+best:radius-best};
    }
    const solids = st => st.rocks.filter(r=>!r.gate || !st.unlocked);
    function blocked(st, a, b) {
        return solids(st).some(r=>!r.lowWall && P.segmentHitsPoly(a,b,r.poly));
    }
    const requiredMonster = m => !m.invulnerable && m.required !== false;
    function hurtMonster(m, amount) {
        if (!m.invulnerable) m.health = Math.max(0, m.health - amount);
    }
    function collideRock(run, body, radius, kind='player') {
        const st=run.rampage;
        for(const rock of solids(st)) {
            const h=circleContact(body,radius,rock.poly);
            if(!h) continue;
            body.x+=h.nx*(h.depth+.001);body.y+=h.ny*(h.depth+.001);
            const closing=-(body.vx*h.nx+body.vy*h.ny);
            if(closing<=0) continue;
            body.vx+=1.18*closing*h.nx;body.vy+=1.18*closing*h.ny;
            if(closing>2) {
                if(kind==='player'){st.stats.rockHits++;hurt(run,.045*closing*closing);}
                else if(kind==='lady') hurtLady(run,.025*closing*closing);
                else hurtMonster(body,.07*closing*closing);
            }
        }
    }
    function petPair(run, b, friendly=false) {
        const s=run.ship,st=run.rampage,dx=s.x-b.x,dy=s.y-b.y,d=Math.hypot(dx,dy),r=st.radius+b.r;
        if(d>=r) return;
        const nx=d?dx/d:1,ny=d?dy/d:0,ia=1/(s.mass || 8),ib=1/b.mass,sum=ia+ib;
        s.x+=nx*(r-d+.001)*ia/sum;s.y+=ny*(r-d+.001)*ia/sum;
        b.x-=nx*(r-d+.001)*ib/sum;b.y-=ny*(r-d+.001)*ib/sum;
        const closing=-((s.vx-b.vx)*nx+(s.vy-b.vy)*ny);
        if(closing<=0) return;
        const impulse=1.12*closing/sum;
        s.vx+=nx*impulse*ia;s.vy+=ny*impulse*ia;b.vx-=nx*impulse*ib;b.vy-=ny*impulse*ib;
        if(closing<(friendly?4:.5) || run.time-b.hitAt<.65) return;
        b.hitAt=run.time;st.flashes.push({x:b.x,y:b.y,t:run.time});
        if(friendly){hurt(run,.022*closing*closing);hurtLady(run,.022*closing*closing);}
        else {
            // The Bristle Express variant cannot be damage-tanked for an equally
            // fast unshielded time. Glancing contacts and other Needlesworth
            // courses retain their normal damage; no shield-count gate exists.
            const spines=b.invulnerable?(b.spineDamage && closing>4 ? b.spineDamage : 4):0;
            hurtMonster(b,.5*closing*closing);hurt(run,spines+.035*closing*closing);st.stats.monsterImpacts++;
            if(b.invulnerable && protectedAt(run)) st.stats.needleBlocks++;}
    }
    function hurtLady(run, amount) {
        const st=run.rampage, loss=Math.min(st.lady.health,amount);
        st.lady.health-=loss;st.stats.ladyDamage+=loss;st.stats.damage+=loss;run.contacts++;
    }
    function actorStep(c, b, ax, ay, dt) {
        const wet=water({...c,radius:b.r},b), trees=woodland(c,b),t=terrain(c,b.x,b.y);
        const drag=.05+trees*.10+wet*.03;
        ax=(1-wet)*ax-7.007*t.dx-drag*b.vx;ay=(1-wet)*ay-7.007*t.dy-drag*b.vy;
        b.roll=(b.roll||0)+Math.hypot(b.vx,b.vy)*dt/b.r;
        b.x+=b.vx*dt+ax*dt*dt/2;b.y+=b.vy*dt+ay*dt*dt/2;
        b.vx+=ax*dt;b.vy+=ay*dt;
    }
    function monsterUpdate(level, run, dt, events) {
        const st=run.rampage,c=level.rampage,s=run.ship;
        for(const m of st.monsters) {
            if (!m.released) {
                if (st.control < m.releaseControl) continue;
                m.released = true; m.until = run.time + .75;
                events.push(m.name + ' enters the pursuit');
            }
            if(m.health<=0) {
                if(!m.defeated){m.defeated=true;st.stats.monsters++;events.push(m.name+' is taking a nap');}
                m.vx=m.vy=0;continue;
            }
            const target=m.target==='lady' && st.lady?.following && !st.rescued ? st.lady : s;
            const ai=m.ai || {}, dx=target.x-m.x,dy=target.y-m.y,d=Math.hypot(dx,dy);
            if(m.state==='prowl' && d<(ai.range ?? 600) && run.time>=m.until) {
                m.state='warning';m.until=run.time+(ai.warning ?? 2.2);
                const a=Math.atan2(dy+target.vy*1.2,dx+target.vx*1.2);
                m.aim={x:m.x+Math.cos(a)*440,y:m.y+Math.sin(a)*440};m.angle=a;
            } else if(m.state==='warning' && run.time>=m.until) {m.state='charge';m.until=run.time+(ai.charge ?? 3.5);}
            else if(m.state==='charge' && run.time>=m.until) {m.state='rest';m.until=run.time+(ai.rest ?? 6);}
            else if(m.state==='rest' && run.time>=m.until) {m.state='prowl';m.until=run.time+(ai.cooldown ?? 2);}
            let ax=0,ay=0;
            if(m.state==='charge'){ax=(ai.power ?? 6)*Math.cos(m.angle);ay=(ai.power ?? 6)*Math.sin(m.angle);}
            else if(m.state==='prowl') {
                const speed=d>(ai.approach ?? 250)?(ai.prowlSpeed ?? 5):0, accel=ai.prowlAccel ?? 1.1;ax=clamp((dx/(d||1)*speed-m.vx)*.8,-accel,accel);ay=clamp((dy/(d||1)*speed-m.vy)*.8,-accel,accel);
            } else {ax=clamp(-m.vx*.6,-2,2);ay=clamp(-m.vy*.6,-2,2);}
            actorStep(c,m,ax,ay,dt);collideRock(run,m,m.r,'monster');
            // Pets remain on the play field; this edge turn gives no free attack impulse.
            for(const [axis,v,size] of [['x','vx',level.world[0]],['y','vy',level.world[1]]]) {
                if(m[axis]<m.r || m[axis]>size-m.r){m[axis]=clamp(m[axis],m.r,size-m.r);m[v]*=-.25;m.state='rest';m.until=run.time+(ai.rest ?? 6);}
            }
            petPair(run,m);
            if(m.health<=0){m.defeated=true;st.stats.monsters++;events.push(m.name+' is taking a nap');}
            if(st.lady?.following && !st.rescued && m.health>0) {
                const l=st.lady,x=l.x-m.x,y=l.y-m.y,dist=Math.hypot(x,y),r=l.r+m.r;
                if(dist<r) {
                    const nx=x/(dist||1),ny=y/(dist||1),impact=Math.max(0,-((l.vx-m.vx)*nx+(l.vy-m.vy)*ny));
                    l.x=m.x+nx*(r+.01);l.y=m.y+ny*(r+.01);
                    if(impact>1 && run.time-l.hitAt>.8){l.hitAt=run.time;hurtLady(run,impact*impact*.05);}
                    l.vx+=nx*impact;l.vy+=ny*impact;
                }
            }
        }
    }
    function flattened(level,run,d,events) {
        const st=run.rampage;
        st.stats.districts++;events.push(d.name+(level.rampage.rescue?' unlocked':' flattened'));
        d.aim=null;d.shotAt=null;st.flashes.push({x:d.x,y:d.y,t:run.time,demolished:true});
        retaliation(level,run,d);
    }
    function breathe(level,run,input,dt,events) {
        const st=run.rampage,c=level.rampage,fire=c.fire;
        st.fireActive=false;
        if(!fire) return;
        const permitted=st.control>=fire.unlockControl && st.wet<.5;
        if(input.winch>0 && permitted && st.breath>0) {
            const time=Math.min(dt,st.breath);st.breath-=time;st.stats.fireTime+=time;st.fireActive=true;
            for(const d of st.districts.filter(d=>d.health>0)) {
                const dx=d.x-run.ship.x,dy=d.y-run.ship.y,dist=Math.hypot(dx,dy);
                const error=Math.abs(Math.atan2(Math.sin(Math.atan2(dy,dx)-st.aim),Math.cos(Math.atan2(dy,dx)-st.aim)));
                if(dist>fire.range+d.r || error>fire.spread+Math.asin(Math.min(1,d.r/(dist||1))) || blocked(st,run.ship,d)) continue;
                d.health=Math.max(0,d.health-fire.dps*time);
                if(d.health===0) flattened(level,run,d,events);
            }
        } else if((input.winch||0)<=0) st.breath=Math.min(fire.capacity,st.breath+fire.recharge*dt);
    }
    function rescueUpdate(level,run,dt,events) {
        const st=run.rampage,c=level.rampage,l=st.lady;
        if(!l) return;
        if(l.health<=0){run.failure={type:'lost-friend',message:'Lady Whiskerdoom’s shell broke. Lead her clear of rocks and the sentry.'};return;}
        if(!c.rescue.free && !st.unlocked && st.districts.every(d=>d.health<=0)) {st.unlocked=true;events.push('Menagerie gate open');}
        if(!l.following && st.unlocked && Math.hypot(l.x-run.ship.x,l.y-run.ship.y)<115) {
            l.following=true;st.breadcrumbs=[{x:run.ship.x,y:run.ship.y}];events.push('Lady Whiskerdoom joins you');
        }
        if(l.following && !st.rescued) {
            const s=run.ship;
            // Greet first, then follow as the player leads OUT of the cage.
            // Never accelerate a newly rescued friend into an approaching ball.
            const separation=Math.hypot(s.x-l.x,s.y-l.y);
            if(!l.departed && (s.x-l.x)*s.vx+(s.y-l.y)*s.vy>0 && separation>90)l.departed=true;
            if(!l.departed)return;
            const last=st.breadcrumbs.at(-1);
            if(Math.hypot(s.x-last.x,s.y-last.y)>28 && st.breadcrumbs.length<4096) st.breadcrumbs.push({x:s.x,y:s.y});
            while(st.breadcrumbs.length>1 && Math.hypot(l.x-st.breadcrumbs[0].x,l.y-st.breadcrumbs[0].y)<22) st.breadcrumbs.shift();
            const target=st.breadcrumbs[0],dx=target.x-l.x,dy=target.y-l.y,d=Math.hypot(dx,dy),f=c.finish;
            // Slow to a real rest at each end. Never assign the follower's position.
            const nearHome=Math.hypot(s.x-f.x,s.y-f.y)<f.r-24;
            const gap=st.breadcrumbs.length===1?(nearHome?68:100):0;
            const speed=Math.min(15,Math.sqrt(2*1.5*Math.max(0,d-gap)));
            let ax=(dx/(d||1)*speed-l.vx)*1.4+.05*l.vx,ay=(dy/(d||1)*speed-l.vy)*1.4+.05*l.vy;
            const nx=(s.x-l.x)/(separation||1),ny=(s.y-l.y)/(separation||1);
            const closing=(l.vx-s.vx)*nx+(l.vy-s.vy)*ny;
            if(closing>0 && separation<82+closing*closing/4.4){ax=-nx*2.4;ay=-ny*2.4;}
            const a=Math.max(1,Math.hypot(ax,ay)/2.4);ax/=a;ay/=a;
            actorStep(c,l,ax,ay,dt);collideRock(run,l,l.r,'lady');petPair(run,l,true);
            if(Math.hypot(l.vx,l.vy)>.03)l.a=Math.atan2(l.vy,l.vx);
            if(l.x<l.r || l.y<l.r || l.x>level.world[0]-l.r || l.y>level.world[1]-l.r)
                run.failure={type:'lost-friend',message:'Lady Whiskerdoom left the field sheet. Lead her along a safe route.'};
            st.rescueHold=Math.hypot(l.x-f.x,l.y-f.y)<f.r-l.r && Math.hypot(l.vx,l.vy)<.8?st.rescueHold+dt:0;
            if(st.rescueHold>=2){st.rescued=true;l.vx=l.vy=0;events.push('Lady Whiskerdoom is safe');}
        }
        if(l.health<=0)run.failure={type:'lost-friend',message:'Lady Whiskerdoom’s shell broke. Clear the sentry, give her room and lead her away from the black rocks.'};
    }
    function create(level, ship) {
        ship.vessel = 'ball'; ship.radius = level.rampage.radius;
        const c=level.rampage;
        return { volcanoes:(c.volcanoes || []).map(v=>({...v,state:volcanoState(v,0),hitAt:-100,ladyHitAt:-100})), rocks:(c.rocks || []).map((r,i)=>({...r,id:'rock-'+i,poly:rockPolygon(r)})),
            monsters:(c.monsters || []).map(m=>({...m,maxHealth:m.health,vx:0,vy:0,state:'prowl',until:0,hitAt:-100,released:!m.releaseControl})),
            lady:c.rescue?{...c.rescue,vx:0,vy:0,a:0,hitAt:-100,following:!!c.rescue.free}:null,
            breadcrumbs:c.rescue?.free?[{x:ship.x,y:ship.y}]:[],unlocked:!!c.rescue?.free,ambushed:0,rescued:false,rescueHold:0,forest:woodland(c,ship),aim:0,breath:c.fire?.capacity || 0,fireActive:false,
            roll: 0, pawPhase: 0, radius: level.rampage.radius, slip: 0, wet: water(c,ship), effort: 0, elevation: terrain(c,ship.x,ship.y).height, control: 0, controlCount: level.rampage.controls.length,
            shieldUntil: 0, shieldReady: 0, shots: [], strikes: [], flashes: [], hold: 0,
            districts: level.rampage.districts.map(d => ({ ...d, maxHealth: d.health, nextShot: 0, aim: null, shotAt: null, hitAt: -100 })),
            stats: { volcanoHits:0, volcanoBlocks:0, districts: 0, damage: 0, blocked: 0, shields: 0, impacts: 0, waterTime: 0, salvos: 0, strikeHits: 0, strikeDodges: 0, strikeBlocks: 0, escortStrikeHits:0, rockHits:0, forestTime:0, monsters:0, monsterImpacts:0, needleBlocks:0, fireTime:0, ladyDamage:0 }
        };
    }
    function shield(run) {
        const st = run.rampage;
        if (run.time + 1e-8 < st.shieldReady) return false;
        st.shieldUntil = run.time + 3; st.shieldReady = run.time + 9;
        st.stats.shields++; return true;
    }
    const protectedAt = run => run.time < run.rampage.shieldUntil;
    function hurt(run, amount) {
        const st = run.rampage;
        if (protectedAt(run)) { st.stats.blocked++; return; }
        const loss = Math.min(run.ship.hull, amount);
        run.ship.hull -= loss; st.stats.damage += loss; run.contacts++;
    }
    function ready(run) {
        return run.rampage.control === run.rampage.controlCount && run.rampage.districts.every(d => d.health <= 0) &&
            run.rampage.monsters.every(m=>!requiredMonster(m) || m.health<=0) && (!run.rampage.lady || run.rampage.rescued);
    }
    function controlAvailable(c, st) {
        const cp=c.controls[st.control];
        return cp && (!cp.after || st.districts.some(d=>d.id===cp.after && d.health<=0));
    }
    function retaliation(level, run, district, salvo = null) {
        const c=level.rampage.retaliation, st=run.rampage;
        if (!c) return;
        st.stats.salvos++;
        for (const [i,delay] of (salvo?.delays || c.delays).entries()) st.strikes.push({
            source:district.id, launchAt:run.time+delay-c.warning, impactAt:run.time+delay,
            x:null,y:null,r:c.radius,damage:c.damage,lead:c.lead || 0,target:salvo?.targets?.[i] || 'player'
        });
        st.strikes.sort((a,b)=>a.impactAt-b.impactAt);
    }
    function strikeUpdate(level,run) {
        const st=run.rampage,s=run.ship;
        st.strikes=st.strikes.filter(b=>{
            if (b.x===null && run.time>=b.launchAt) {
                // The reticle locks ONCE. Flight is long enough to steer away;
                // the off-map battery never performs invisible homing hitscan.
                const target=b.target==='lady' && st.lady && !st.rescued ? st.lady : s;
                b.x=clamp(target.x+target.vx*b.lead,b.r,level.world[0]-b.r);
                b.y=clamp(target.y+target.vy*b.lead,b.r,level.world[1]-b.r);
            }
            if (run.time<b.impactAt) return true;
            const hit=Math.hypot(s.x-b.x,s.y-b.y)<b.r+level.rampage.radius;
            const ladyHit=st.lady?.following && !st.rescued && Math.hypot(st.lady.x-b.x,st.lady.y-b.y)<b.r+st.lady.r;
            if (hit) {
                if (protectedAt(run)) st.stats.strikeBlocks++; else st.stats.strikeHits++;
                hurt(run,b.damage);
            } else if (!ladyHit) st.stats.strikeDodges++;
            if (ladyHit) {
                hurtLady(run,b.damage); st.stats.escortStrikeHits++;
            }
            st.flashes.push({x:b.x,y:b.y,t:run.time,strike:true,r:b.r});
            return false;
        });
    }
    function update(level, run, input, dt) {
        const c = level.rampage, st = run.rampage, s = run.ship, events = [];
        let px = clamp(input.rudder || 0, -1, 1), py = clamp(input.thruster || 0, -1, 1);
        const norm = Math.max(1, Math.hypot(px, py)); px /= norm; py /= norm;
        st.effort = Math.hypot(px, py); st.wet = water(c, s); st.forest=woodland(c,s);
        if(st.effort>.05)st.aim=Math.atan2(py,px);
        if(st.forest>0)st.stats.forestTime+=dt;
        const t = terrain(c, s.x, s.y); st.elevation = t.height;
        // 5/7 g is the translation part of an ideal solid rolling body's acceleration.
        // Momentum and downhill gravity remain when Gerbozilla loses water traction.
        const grip = 1 - st.wet, drag = c.resistance * grip + c.waterResistance * st.wet + st.forest*.11*grip;
        const ax = grip * px * c.drive - 7.007 * t.dx - drag * s.vx;
        const ay = grip * py * c.drive - 7.007 * t.dy - drag * s.vy;
        const ox = s.x, oy = s.y;
        s.x += s.vx * dt + ax * dt * dt / 2; s.y += s.vy * dt + ay * dt * dt / 2;
        s.vx += ax * dt; s.vy += ay * dt;
        const speed = Math.hypot(s.vx, s.vy), distance = Math.hypot(s.x - ox, s.y - oy);
        if (speed > .05) s.a = Math.atan2(s.vy, s.vx);
        s.engine = 0; s.r = 0; s.throttle = 0;
        st.slip = st.wet * st.effort * 1.8;
        st.roll += distance / c.radius + st.slip * dt;
        // Paws alternate with rolling strokes; in water the futile wheelspin
        // drives the same animation. A coasting hamster can rest its feet.
        st.pawPhase += (distance / c.radius * 2 + st.slip * dt * 2) * st.effort;
        if (st.wet > 0) st.stats.waterTime += dt;
        run.distance += distance; run.maxSpeed = Math.max(run.maxSpeed, speed);
        if (s.x-c.radius < 0 || s.y-c.radius < 0 || s.x+c.radius > level.world[0] || s.y+c.radius > level.world[1])
            run.failure = { type: 'off-map', message: 'Gerbozilla rolled off the survey map. Retry for a fresh run-up.' };
        collideRock(run,s,c.radius);
        monsterUpdate(level,run,dt,events);
        const cp = c.controls[st.control];
        if (controlAvailable(c,st) && Math.hypot(s.x-cp.x, s.y-cp.y) < cp.r) { st.control++; events.push(cp.name); }
        const ambushes=c.ambushes || [];
        while(st.ambushed<ambushes.length && st.control>=ambushes[st.ambushed].control) {
            const salvo=ambushes[st.ambushed++];
            retaliation(level,run,{id:'route-beacon-'+salvo.control},salvo);
            events.push('Evacuation beacon spotted · long-range strikes inbound');
        }
        for (const d of st.districts) {
            if (d.health <= 0) continue;
            const dx = s.x-d.x, dy = s.y-d.y, dist = Math.hypot(dx, dy);
            if (dist < d.r+c.radius && run.time-d.hitAt > .65) {
                const nx = dx/(dist || 1), ny = dy/(dist || 1);
                const impact = Math.max(0, -(s.vx*nx+s.vy*ny));
                if (impact > .15) {
                    d.hitAt = run.time; st.stats.impacts++;
                    d.health = Math.max(0, d.health - (d.fireOnly ? 0 : .65*impact*impact));
                    hurt(run, .045*impact*impact);
                    st.flashes.push({x:d.x,y:d.y,t:run.time,demolished:d.health===0});
                    if (d.health === 0) {
                        s.vx *= .84; s.vy *= .84;
                        flattened(level,run,d,events);
                    } else {
                        // Surviving structures deflect the ball; shield never supplies a free impulse.
                        s.vx += nx*impact*1.12; s.vy += ny*impact*1.12;
                        s.x = d.x+nx*(d.r+c.radius+.1); s.y = d.y+ny*(d.r+c.radius+.1);
                    }
                }
            }
            if (d.health <= 0 || !d.defence) continue;
            if (d.shotAt === null && run.time >= d.nextShot && dist < (d.range || (c.fire ? 285 : 145)) && !blocked(st,d,s)) {
                const flight = dist/80;
                d.aim = { x:s.x+s.vx*flight, y:s.y+s.vy*flight };
                d.shotAt = run.time + 1.2; // Marked warning; no instantaneous hitscan damage.
            }
            if (d.shotAt !== null && run.time >= d.shotAt) {
                const a = Math.atan2(d.aim.y-d.y,d.aim.x-d.x);
                st.shots.push({x:d.x,y:d.y,vx:80*Math.cos(a),vy:80*Math.sin(a),life:5});
                d.aim = null; d.shotAt = null; d.nextShot = run.time + 5.5;
            }
        }
        st.shots = st.shots.filter(b => {
            const from={x:b.x,y:b.y};
            b.x += b.vx*dt; b.y += b.vy*dt; b.life -= dt;
            if(blocked(st,from,b))return false;
            if (Math.hypot(b.x-s.x,b.y-s.y)<c.radius+3) {
                hurt(run,8); st.flashes.push({x:b.x,y:b.y,t:run.time}); return false;
            }
            return b.life > 0;
        });
        breathe(level,run,input,dt,events);
        rescueUpdate(level,run,dt,events);
        strikeUpdate(level,run);
        volcanoUpdate(run);
        if(st.lady?.health<=0) run.failure={type:'lost-friend',message:'Lady Whiskerdoom’s shell broke. Protect her route from pursuers and marked artillery.'};
        st.flashes = st.flashes.filter(f => run.time-f.t < 1.5);
        if (s.hull <= 0) run.failure = { type:'shell-broken',message:'The exercise ball cracked. Use the shield for defensive fire and high-speed impacts.' };
        const inside = Math.hypot(s.x-c.finish.x,s.y-c.finish.y) <= c.finish.r-c.radius;
        const slow = Math.hypot(s.vx,s.vy) < .8 && st.effort === 0;
        run.dock = { inside, aligned:true, slow, ready:ready(run) && inside && slow && st.strikes.length===0 };
        run.dockHold = run.dock.ready ? run.dockHold+dt : 0;
        return events;
    }
    function message(level, run) {
        const st = run.rampage;
        if (run.failure) return run.failure.message;
        const strike=st.strikes.find(b=>b.x!==null);
        if (strike) return 'RETALIATION · '+Math.max(0,strike.impactAt-run.time).toFixed(1)+' s · LEAVE RED TARGET CIRCLES OR SHIELD';
        const vent=st.volcanoes.find(v=>v.state.phase!=='quiet' && (volcanoContact(v,run.ship,st.radius+90)));
        if(vent) return vent.name+' · '+(vent.state.active?'ERUPTING · CLEAR THE MARKED FOOTPRINT':'ERUPTION IN '+vent.state.remaining.toFixed(1)+' s');
        if (st.wet > .5) return 'NO TRACTION · keep coasting; running only spins the ball';
        if (run.dockHold > 0) return 'RECOVERY MEADOW · paws off · settling ' + Math.max(0,2-run.dockHold).toFixed(1)+' s';
        const hazard=st.monsters.find(m=>m.invulnerable && m.released && m.state==='warning' && Math.hypot(m.x-run.ship.x,m.y-run.ship.y)<500);
        if(hazard) return 'NEEDLESWORTH · INVULNERABLE · SHIELD / EVADE IN '+Math.max(0,hazard.until-run.time).toFixed(1)+' s';
        const cp = level.rampage.controls[st.control];
        if (controlAvailable(level.rampage,st)) return `${String(st.control + 1).padStart(2, '0')} · ${cp.name.toUpperCase()} · keep your momentum`;
        if(st.lady && level.rampage.rescue?.free && !st.rescued) return 'ESCORT · LADY '+Math.ceil(st.lady.health)+'% · KEEP HER CLEAR OF PURSUERS';
        const monster=st.monsters.find(m=>requiredMonster(m) && m.health>0);
        if(monster) return monster.name.toUpperCase()+' · '+(monster.state==='warning'?'CHARGE LOCKED · '+Math.max(0,monster.until-run.time).toFixed(1)+' s':monster.state==='rest'?'RECOVERING · SHIELD AND RAM':'KEEP ROOM FOR A RUN-UP');
        if(st.lady && st.unlocked && !st.rescued)return st.lady.following?'ESCORT LADY WHISKERDOOM · '+Math.ceil(st.lady.health)+'% SHELL · BRING BOTH HAMSTERS HOME':'GATE OPEN · APPROACH LADY WHISKERDOOM TO GREET HER';
        const d = st.districts.find(d=>d.health>0);
        if(d && level.rampage.fire)return d.name.toUpperCase()+' · HOLD H TO BREATHE · RELEASE TO REFILL';
        if (d) return `${d.name.toUpperCase()} · RAM WITH MOMENTUM · SPACE / F TO SHIELD`;
        if (st.strikes.length) return 'RETALIATION INBOUND · clear the marked strikes before recovery';
        return 'RECOVERY MEADOW · push against motion to brake, then release all directions';
    }
    // Timed geothermal footprints, not fluid simulation. The same polygons are
    // painted by the renderer and tested against the entire circular shell.
    function volcanoState(v, time) {
        const phase = ((time + (v.offset || 0)) % v.period + v.period) % v.period;
        const ignition = v.period - v.eruption, warning = ignition - v.warning;
        return phase >= ignition ? { phase:'erupting', remaining:v.period-phase, active:true }
            : phase >= warning ? { phase:'warning', remaining:ignition-phase, active:false }
            : { phase:'quiet', remaining:ignition-phase, active:false };
    }
    function volcanoContact(v, body, radius) {
        return Math.hypot(body.x-v.x,body.y-v.y) <= v.r+radius ||
            v.zones.some(poly => !!circleContact(body,radius,poly));
    }
    function volcanoUpdate(run) {
        const st=run.rampage;
        for (const v of st.volcanoes) {
            v.state=volcanoState(v,run.time);
            if (!v.state.active) continue;
            if (volcanoContact(v,run.ship,st.radius) && run.time >= v.hitAt) {
                v.hitAt=run.time+.75;
                if (protectedAt(run)) st.stats.volcanoBlocks++; else st.stats.volcanoHits++;
                hurt(run,24);
                st.flashes.push({x:run.ship.x,y:run.ship.y,t:run.time});
            }
            if (st.lady?.following && !st.rescued && volcanoContact(v,st.lady,st.lady.r) && run.time >= v.ladyHitAt) {
                v.ladyHitAt=run.time+.75; hurtLady(run,24);
            }
        }
    }
    // Sample a winding channel with broad, rounded lobes. These very same
    // vertices drive rendering and full-shell contact, including concave banks.
    function footprint(points) {
        const p=points.map(([x,y])=>({x,y}));
        const lengths=p.map((a,i)=>Math.hypot(a.x-p[(i+1)%4].x,a.y-p[(i+1)%4].y));
        const start=lengths.indexOf(Math.max(...lengths));
        const a=p[start],b=p[(start+1)%4],c=p[(start+2)%4],d=p[(start+3)%4];
        const near={x:(a.x+d.x)/2,y:(a.y+d.y)/2};
        const far={x:(b.x+c.x)/2,y:(b.y+c.y)/2};
        const dx=far.x-near.x,dy=far.y-near.y,len=Math.hypot(dx,dy);
        const nx=-dy/len,ny=dx/len;
        const w0=Math.hypot(a.x-d.x,a.y-d.y)/2,w1=Math.hypot(b.x-c.x,b.y-c.y)/2;
        return Array.from({length:256},(_,i)=>{
            const angle=i*Math.PI*2/256,t=(1-Math.cos(angle))/2;
            const width=w0+(w1-w0)*t;
            const bend=width*.34*Math.sin(t*Math.PI*3);
            const lobes=1+.19*Math.sin(t*Math.PI*5+.6)+.09*Math.sin(t*Math.PI*9-1);
            const offset=bend+Math.sin(angle)*width*lobes;
            return {x:near.x+dx*t+nx*offset,y:near.y+dy*t+ny*offset};
        });
    }
    downhill.rampage.volcanoes = [{ id:'muesli-furnace', name:'MUESLI FURNACE', x:1210,y:1015,r:38,
        period:48,warning:7,eruption:13,offset:28,
        zones:[footprint([[1145,975],[1140,610],[1195,550],[1240,980]])] }];
    downhill.kind = 'Volcanic descent / a timed lava crossing / caldera ram';
    downhill.brief += ' Muesli Furnace periodically sends lava across the western run-up. Watch its marked channel: preserve enough speed to cross the cooled lava bed and flooded rim in one committed approach.';
    downhill.tip = 'Amber warns of an eruption; orange means lava. Cross during the quiet window, divert around the channel, or shield a brief exposure. Never stop in the moat.';
    forest.rampage.volcanoes = [
        {id:'bramble-vent',name:'BRAMBLE FISSURE',x:755,y:580,r:30,period:46,warning:6,eruption:12,offset:22,
            zones:[footprint([[750,562],[1065,568],[1075,635],[750,620]])]},
        {id:'birch-vent',name:'BIRCH FISSURE',x:1340,y:325,r:34,period:57,warning:7,eruption:15,offset:6,
            zones:[footprint([[1298,90],[1362,90],[1380,320],[1310,330]])]}
    ];
    forest.kind = 'Forest navigation / independently timed volcanic fissures';
    forest.brief += ' Two volcanic fissures cross the control approaches on independent cycles. Use the clearings to hold or take a wider line while a marked lava bed is active.';
    forest.tip = 'Combine the map with the vent clocks: Bramble and Birch erupt independently. Full footprints turn amber before they heat. A shield buys three seconds, not immunity for an entire eruption.';
    avoid.rampage.volcanoes = [
        {id:'brook-boil',name:'BRISTLE BOIL',x:790,y:960,r:29,period:54,warning:7,eruption:18,offset:-10,steam:true,
            zones:[footprint([[760,992],[990,998],[975,1092],[752,1085]])]},
        {id:'north-boil',name:'NORTH STEAM VENT',x:915,y:305,r:27,period:64,warning:7,eruption:16,offset:5,steam:true,
            zones:[footprint([[700,170],[970,170],[955,260],[705,252]])]}
    ];
    avoid.kind = 'Invulnerable patrol / river run-ups / timed steam vents';
    avoid.brief += ' Geothermal vents boil the two useful river crossings at different times. Watch the steam footprints as well as Needlesworth: being safe from his charge does not make a hot crossing safe.';
    avoid.tip = 'Plan both crossings. In the brook you cannot brake or steer by running, so line up on dry ground during a quiet vent window. Needlesworth is still invulnerable; use the outcrops, not a fight.';
    const api = { volcanoState, volcanoContact, volcanoUpdate, levels:[level, bank, lakes, downhill, forest, fortress, duel, fire, rescue, avoid, chase, escort], terrain, shoreRadius, lakePoint, inLake, water, woodland, rockPolygon, circleContact, requiredMonster, hurtMonster, solids, blocked, petPair, create, shield, protectedAt, ready, controlAvailable, update, message };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.GerboRampage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
