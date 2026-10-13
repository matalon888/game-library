/* ============================================================
   DIG FOR BHARAT — shared dataset (2D section view + 3D trench) — field drawings, sites, and season script
   ============================================================ */

/* Line-art glyphs, 24x24, stroked. Drawn identically in canvas
   (via Path2D) and in the catalogue (via inline SVG). */
export const GLYPH = {
  bangle:"M12 3.2a8.8 8.8 0 100 17.6 8.8 8.8 0 000-17.6z M12 8a4 4 0 100 8 4 4 0 000-8z",
  hook:  "M9 3.5v9.5a3.4 3.4 0 006.8 0V9 M15.8 9l-1.9 2.1 M15.8 9l1.9 2.1 M9 3.5h3",
  weight:"M6 8l6-3.2L18 8v8l-6 3.2L6 16z M6 8l6 3.2L18 8 M12 11.2V19.2",
  brick: "M3.5 7.5h17v9h-17z M3.5 12h17 M9 7.5v4.5 M15 12v4.5",
  seal:  "M4 4h16v16H4z M8 8.6h8 M8 12h5.5 M8 15.4h8",
  burial:"M9.2 4.2h5.6 M9.6 4.2l-.6 3.4 M14.4 4.2l.6 3.4 M9 7.6c-2.9 2-4.4 4.7-4.4 7.8 0 3.2 3.3 4.9 7.4 4.9s7.4-1.7 7.4-4.9c0-3.1-1.5-5.8-4.4-7.8 M7 12.6h10",
  bead:  "M4 12a3 3 0 106 0 3 3 0 10-6 0z M14 12a3 3 0 106 0 3 3 0 10-6 0z M10 12h4",
  drill: "M12 2.6v9.6 M9.2 12.2h5.6L12 21.4z M9.2 6h5.6",
  game:  "M8.6 20.4h6.8 M10 20.4v-5 M14 20.4v-5 M12 4.4a3 3 0 100 6 3 3 0 000-6z M9.4 10.4h5.2l-1 4.6h-3.2z",
  grain: "M12 20.6V9.4 M12 9.4c-3.1 0-5.2-2.1-5.2-5.2 3.1 0 5.2 2.1 5.2 5.2z M12 12.6c3.1 0 5.2-2.1 5.2-5.2-3.1 0-5.2 2.1-5.2 5.2z",
  sherd: "M5.2 16.8L9 6l9.4 4.2-3.4 9.2z M9 6l1.2 9.6",
  coin:  "M12 3.4a8.6 8.6 0 100 17.2 8.6 8.6 0 000-17.2z M12 7.2v9.6 M8.4 9.6h7.2 M8.4 14.4h7.2",
  chisel:"M10.4 3h3.2v11l-1.6 6.8-1.6-6.8z M10.4 8h3.2",
  flake: "M4.6 13.4l5-8.6 9.8 5.4-5.8 8.2z M9.6 4.8l2.6 7.4 7.2-1.6",
  edict: "M6.2 3.2h11.6v17.6H6.2z M9 7.6h6 M9 11h6 M9 14.4h4",
  pillar:"M9 20.8h6 M10.2 20.8V8.2 M13.8 20.8V8.2 M7.4 8.2h9.2l-1.6-3.4H9z M12 4.8V2.4",
  head:  "M12 4c3.6 0 5.6 2.6 5.6 6.2 0 4.2-2.1 7.2-5.6 7.2s-5.6-3-5.6-7.2C6.4 6.6 8.4 4 12 4z M9.6 11h1.2 M13.2 11h1.2 M10.4 14.2h3.2 M12 17.4v3",
  bronze:"M12 2.6a9.4 9.4 0 100 18.8 9.4 9.4 0 000-18.8z M12 7.4a1.7 1.7 0 100 3.4 1.7 1.7 0 000-3.4z M12 10.8v4.2 M8.4 12.4l3.6 1 3.6-1.6 M10 19l2-4 2 3",
  plate: "M4 6.4h16v11.2H4z M7 10h10 M7 12.8h10 M7 15.6h6 M4 6.4L6.6 4H20v11.2l-2.6 2.4",
  lamp:  "M4.6 13.6c0-2 2.6-3.4 6.2-3.4h5.4c1.8 0 3.2.9 3.2 2s-1.4 2-3.2 2h-1.4 M4.6 13.6c0 2 2.6 3.4 6.2 3.4 2.4 0 4-.6 4.8-1.4 M11 10.2V7.4 M9.2 7.4h3.6 M19.4 12.2s2 .8 2 2.2",
  manus: "M2.6 8.8h18.8v6.4H2.6z M11.2 12a.9.9 0 101.8 0 .9.9 0 10-1.8 0z M5.4 8.8v6.4 M18.6 8.8v6.4 M2.6 8.8l1.6-2h15.6l1.6 2",
  flame: "M12 2.8s4.8 4.2 4.8 8.8a4.8 4.8 0 01-9.6 0c0-1.9 1-3.4 1.9-4.3.1 1.9 1 2.9 1.9 2.9 1.4 0 1.5-2.9 1-7.4z M7.2 19.6h9.6",
  slag:  "M4.8 15.4c0-4 3.2-7.2 7.2-7.2s7.2 2.6 7.2 6.6c0 2.6-2 4.6-7.2 4.6s-7.2-1.4-7.2-4z M8.6 11.8l1.8-3 M14 11l1.8-2.2",
  wheel: "M12 3a9 9 0 100 18 9 9 0 000-18z M12 5.4v13.2 M5.4 12h13.2 M7.4 7.4l9.2 9.2 M16.6 7.4l-9.2 9.2 M12 9.6a2.4 2.4 0 100 4.8 2.4 2.4 0 000-4.8z"
};

export const SITES = [
  {
    id:"rakhigarhi", code:"RGR·7", name:"Rakhigarhi", state:"Haryana",
    period:"Mature Harappan · c. 2600–1900 BCE", years:"2600 BCE",
    soil:["#6B563B","#77613F","#856841","#93673B","#9E5F31"],
    layers:[
      {n:"I",   name:"Ploughsoil and modern debris", d:"0.0–0.6 m", hard:1},
      {n:"II",  name:"Late Harappan reoccupation",   d:"0.6–1.4 m", hard:2},
      {n:"III", name:"Mature Harappan street",       d:"1.4–2.2 m", hard:2},
      {n:"IV",  name:"House floors and drains",      d:"2.2–3.1 m", hard:3},
      {n:"V",   name:"Cemetery cut into the mound",  d:"3.1–3.6 m", hard:4}
    ],
    brief:{
      who:"Dr. Nirmala Kaul · Superintending Archaeologist",
      quote:"Cut down, never sideways. The moment you dig from the side you have thrown away the only clock we own.",
      paras:[
        "Mound 4 at Rakhigarhi, first week of the season. Beneath your boots is one of the largest cities of the Harappan civilisation — bigger in area than Mohenjo-daro, and mostly still under wheat.",
        "Your trench is two metres square on the surface and gets narrower as you go. Six anomalies showed on the pre-season survey. Find them, and above all find what is cut into the base of the mound."
      ]
    },
    keynote:"The burial is articulated — undisturbed, lying where she was placed. Dr. Kaul stops talking, which she never does.",
    close:"Rakhigarhi is filled back in for the season. What you lifted goes to the site store with its layer number attached; without that number an object is only a curiosity.",
    finds:[
      {r:2,c:2, g:"bangle", key:false, fragile:true,
       nm:"Terracotta bangle fragments", er:"Layer II · Late Harappan",
       no:"Fired terracotta bangles turn up by the thousand at Harappan sites, worn at every rank. Ordinary objects date a layer far better than rare ones do."},
      {r:3,c:9, g:"hook", key:false, fragile:false,
       nm:"Copper fish-hook", er:"Layer II · c. 2000 BCE",
       no:"Cast from copper smelted with ore carried in from the Aravalli hills. Rakhigarhi's metalworkers had a quarter of their own on the mound."},
      {r:4,c:5, g:"weight", key:false, fragile:false,
       nm:"Cubical chert weight", er:"Layer III · Mature Harappan",
       no:"Part of the Harappan binary series — 1:2:4:8:16, then decimal multiples. The identical standard is used at Harappa 350 km away and at Lothal 900 km south. Somebody enforced it."},
      {r:5,c:10, g:"brick", key:false, fragile:false,
       nm:"Baked-brick drain course", er:"Layer III · Mature Harappan",
       no:"Kiln-fired bricks in the 1:2:4 ratio used from Sindh to Haryana, laid as a covered drain running under the street. Drainage, not palaces, is the Harappan signature."},
      {r:6,c:3, g:"seal", key:false, fragile:false,
       nm:"Steatite seal, one-horned animal", er:"Layer IV · Mature Harappan",
       no:"A single-horned creature above a line of signs. Roughly 400 Indus signs are known and the script is undeciphered — no bilingual text has ever been found to break it open."},
      {r:8,c:7, g:"burial", key:true, fragile:true,
       nm:"Burial with grave pottery", er:"Layer V · Harappan cemetery",
       no:"A woman laid out north-south with pots at her head. Ancient DNA published in 2019 from an individual in this cemetery carried Iranian-related and South Asian hunter-gatherer ancestry, with no Steppe component. One genome; the argument it started is still running."}
    ]
  },
  {
    id:"lothal", code:"LTL·3", name:"Lothal", state:"Gujarat",
    period:"Harappan port · c. 2400–1900 BCE", years:"2400 BCE",
    soil:["#6E6250","#7A6C55","#85714E","#8E6C44","#996639"],
    layers:[
      {n:"I",   name:"Salt crust and river silt",  d:"0.0–0.5 m", hard:1},
      {n:"II",  name:"Post-Harappan squatters",    d:"0.5–1.2 m", hard:2},
      {n:"III", name:"Warehouse platform",         d:"1.2–2.0 m", hard:2},
      {n:"IV",  name:"Bead workshop floors",       d:"2.0–2.9 m", hard:3},
      {n:"V",   name:"Basin wall foundation",      d:"2.9–3.5 m", hard:4}
    ],
    brief:{
      who:"Dr. Nirmala Kaul · Superintending Archaeologist",
      quote:"Everyone comes to Lothal to argue about the basin. Dig the workshop first — the workshop is what paid for the basin.",
      paras:[
        "The Bhal is flat, saline and hot, and 4,400 years ago it was closer to the sea. Lothal is small — you can walk it in twenty minutes — but it was a manufacturing town wired into a sea trade that reached the Gulf.",
        "Trench 3 cuts the workshop quarter and clips the edge of the great brick basin. Work down carefully: the bead debris here is smaller than a grain of rice."
      ]
    },
    keynote:"You have the sluice. Water came in here, or water was held here — the brick will not tell you which, and neither will anyone honest.",
    close:"Lothal closes with a full bead sequence in the record: raw carnelian, drill, waster, finished bead. That sequence is worth more than any single object in the store.",
    finds:[
      {r:2,c:4, g:"bead", key:false, fragile:false,
       nm:"Etched carnelian beads", er:"Layer II · c. 2000 BCE",
       no:"Carnelian heated to redden it, bored, then etched white with an alkali paste. Beads made this way travelled west — examples sit in the royal graves at Ur."},
      {r:3,c:8, g:"drill", key:false, fragile:false,
       nm:"Micro-drill of Ernestite", er:"Layer II · c. 2000 BCE",
       no:"A drill bit of a synthetic hard stone recorded only from Harappan workshops. Boring a long carnelian bead through took more than a day of continuous drilling."},
      {r:4,c:1, g:"game", key:false, fragile:true,
       nm:"Terracotta gamesmen and die", er:"Layer III · Mature Harappan",
       no:"Playing pieces and a cubical die pipped one to six. Play is one of the very few Harappan activities we can name with any confidence at all."},
      {r:5,c:10, g:"grain", key:false, fragile:false,
       nm:"Rice husk in a clay lump", er:"Layer III · Mature Harappan",
       no:"Husk impressions pressed into daub. Rice at Lothal sits alongside barley and wheat, at the western edge of its early range."},
      {r:6,c:6, g:"seal", key:false, fragile:false,
       nm:"Circular Persian Gulf seal", er:"Layer IV · Mature Harappan",
       no:"A round seal of Dilmun type — a Bahrain design found on an Indian shore. Mesopotamian tablets name a trading partner called Meluhha, generally taken to be the Indus world."},
      {r:8,c:3, g:"brick", key:true, fragile:false,
       nm:"Sluice block of the great basin", er:"Layer V · Basin foundation",
       no:"A baked-brick basin 214 m long with an inlet channel and a spillway. S.R. Rao excavated it as a tidal dock; others read it as a water reservoir. The brickwork is certain, the purpose is not."}
    ]
  },
  {
    id:"vidisha", code:"VDS·2", name:"Vidisha", state:"Madhya Pradesh",
    period:"Mauryan to Shunga · c. 300–50 BCE", years:"300 BCE",
    soil:["#4A4238","#544738","#63513B","#785234","#8A4E2C"],
    layers:[
      {n:"I",   name:"Field soil and cattle track", d:"0.0–0.5 m", hard:1},
      {n:"II",  name:"Shunga brick platform",       d:"0.5–1.3 m", hard:2},
      {n:"III", name:"Late Mauryan street",         d:"1.3–2.1 m", hard:2},
      {n:"IV",  name:"Mauryan occupation",          d:"2.1–3.0 m", hard:3},
      {n:"V",   name:"Pre-Mauryan, NBPW horizon",   d:"3.0–3.6 m", hard:4}
    ],
    brief:{
      who:"Dr. Nirmala Kaul · Superintending Archaeologist",
      quote:"You are digging a junction, not a city. Two rivers, one road to Ujjain, and everybody's stone ends up here.",
      paras:[
        "Vidisha stands where the Betwa meets the Bes, on the trunk road south. Sanchi's hill is nine kilometres away and its gateways were carved by craftsmen from this town.",
        "The trench cuts a merchant quarter. Below the Shunga brickwork the Mauryan levels start, and below those, the fine black tableware that tells you the century without a coin."
      ]
    },
    keynote:"The pillar base is in situ, and the inscription runs on to the drum. A Greek ambassador's name, in Prakrit, dedicating a Garuda standard to an Indian god.",
    close:"Vidisha goes back under plastic sheeting and soil. The edict fragment and the pillar base are recorded where they lay — in situ, which is a word that means an object still has its evidence attached.",
    finds:[
      {r:2,c:7, g:"sherd", key:false, fragile:true,
       nm:"Northern Black Polished Ware sherd", er:"Layer II · c. 200 BCE",
       no:"A lustrous grey-black tableware of the Gangetic cities, so distinctive that a single sherd dates the layer around it on sight."},
      {r:3,c:2, g:"coin", key:false, fragile:false,
       nm:"Punch-marked silver karshapana", er:"Layer II · Mauryan",
       no:"Silver stamped with sun, six-armed and hill symbols, punched one at a time. India's earliest coinage carries no ruler's face and no legend — only marks of authority."},
      {r:4,c:10, g:"chisel", key:false, fragile:false,
       nm:"Ivory-worker's chisel", er:"Layer III · late Mauryan",
       no:"Vidisha's ivory carvers were organised as a guild. An inscription on the southern gateway at Sanchi records that the ivory-workers of Vidisha carved it — an artisan's signature on a monument."},
      {r:6,c:5, g:"flake", key:false, fragile:false,
       nm:"Chunar sandstone flake, polished", er:"Layer IV · Mauryan",
       no:"A waste flake carrying the mirror finish known as the Mauryan polish. The stone was quarried at Chunar and moved hundreds of kilometres; how the polish was achieved is still argued."},
      {r:7,c:8, g:"edict", key:false, fragile:false,
       nm:"Edict fragment in Brahmi", er:"Layer IV · Ashokan, c. 250 BCE",
       no:"Ashoka ordered his instruction cut on rock so that it would endure. It did — but Brahmi was unreadable for some 1,500 years until James Prinsep worked the script out in 1837."},
      {r:8,c:1, g:"pillar", key:true, fragile:false,
       nm:"Base of the Heliodorus pillar", er:"Layer V · c. 113 BCE",
       no:"A Garuda standard raised by Heliodorus, ambassador of the Indo-Greek king Antialkidas, who names himself a Bhagavata — a devotee of Vasudeva. A Greek envoy's dedication, in Prakrit, to an Indian god."}
    ]
  },
  {
    id:"nalanda", code:"NLD·9", name:"Nalanda", state:"Bihar",
    period:"Gupta to Pala · c. 450–1200 CE", years:"450 CE",
    soil:["#6A4B3A","#75523C","#84553A","#925434","#A04E2C"],
    layers:[
      {n:"I",   name:"Mound wash and brick robbing", d:"0.0–0.6 m", hard:1},
      {n:"II",  name:"Late Pala rebuilding",         d:"0.6–1.5 m", hard:2},
      {n:"III", name:"Monastery cells and drain",    d:"1.5–2.4 m", hard:2},
      {n:"IV",  name:"Gupta shrine floor",           d:"2.4–3.2 m", hard:3},
      {n:"V",   name:"Foundation trench and ash",    d:"3.2–3.8 m", hard:4}
    ],
    brief:{
      who:"Dr. Nirmala Kaul · Superintending Archaeologist",
      quote:"Nine monasteries, one plan, seven centuries of rebuilding on the same footprint. Every floor you cut through is somebody's whole career.",
      paras:[
        "Nalanda Mahavihara ran for roughly seven hundred years and drew students from Tibet, China, Korea and Southeast Asia. Xuanzang studied here in the 630s and left a description precise enough to excavate against.",
        "Your trench takes a cell block down to the Gupta floor. Below that there is ash, and the ash is the reason this site is famous."
      ]
    },
    keynote:"Palm leaf, charred but holding its shape until the trowel touches it. Then it is a black outline in the soil, and the outline is the document now.",
    close:"The folio is lifted in a block of soil and goes to the conservation lab still in its matrix. Some finds are excavated in a trench; some are excavated later, under a microscope.",
    finds:[
      {r:2,c:6, g:"head", key:false, fragile:true,
       nm:"Stucco Buddha head", er:"Layer II · Pala",
       no:"Lime stucco moulded over a brick core, once painted. Whole galleries of these figures ran along Nalanda's outer walls."},
      {r:3,c:1, g:"seal", key:false, fragile:false,
       nm:"Sealing of the monastic Sangha", er:"Layer II · Pala",
       no:"A clay sealing reading Sri-Nalanda-Mahavihariya-Arya-Bhikshu-Sanghasya — of the community of venerable monks of the great monastery of Nalanda. Sealings like this proved which mound was which."},
      {r:4,c:9, g:"bronze", key:false, fragile:false,
       nm:"Pala votive bronze", er:"Layer III · 9th–11th c. CE",
       no:"Cast by the lost-wax method in the eastern Indian school. Bronzes of this workshop tradition reached Tibet and Java, carried by monks rather than merchants."},
      {r:5,c:11, g:"lamp", key:false, fragile:true,
       nm:"Oil lamp from a monk's cell", er:"Layer III · Pala",
       no:"Lampblack still on the lip. Xuanzang describes lamps burning through the night in halls where debate ran late; this one sat in a niche cut into a cell wall."},
      {r:6,c:4, g:"plate", key:false, fragile:false,
       nm:"Copper-plate charter of Devapala", er:"Layer IV · 9th c. CE",
       no:"A royal grant made at the request of Balaputradeva, king of Suvarnadvipa — Sumatra — who endowed a monastery here. Ninth-century Bihar and Srivijaya, on one sheet of copper."},
      {r:8,c:7, g:"manus", key:true, fragile:true,
       nm:"Charred palm-leaf folio", er:"Layer V · destruction horizon",
       no:"Nalanda's libraries burned. The account usually cited comes from a 13th-century Persian chronicle of Bakhtiyar Khalji's campaigns, and which monastery it describes is debated. The ash layer is the more direct witness, and it is thick."}
    ]
  },
  {
    id:"hampi", code:"HMP·5", name:"Hampi", state:"Karnataka",
    period:"Vijayanagara · c. 1336–1565 CE", years:"1336 CE",
    soil:["#7A6B52","#847049","#8D7244","#96703C","#A06A33"],
    layers:[
      {n:"I",   name:"Granite sand and path",     d:"0.0–0.4 m", hard:1},
      {n:"II",  name:"Abandonment after 1565",    d:"0.4–1.1 m", hard:2},
      {n:"III", name:"Bazaar street surface",     d:"1.1–1.9 m", hard:2},
      {n:"IV",  name:"Noble quarter floors",      d:"1.9–2.7 m", hard:3},
      {n:"V",   name:"Sealed sub-floor deposit",  d:"2.7–3.3 m", hard:4}
    ],
    brief:{
      who:"Dr. Nirmala Kaul · Superintending Archaeologist",
      quote:"Here the disaster is near the top and the city is underneath it. Read it downwards and you read a life backwards.",
      paras:[
        "Vijayanagara was one of the largest cities in the world in the sixteenth century, spread over 26 square kilometres of granite ridge and river. Visitors from Persia and Portugal wrote about its markets in the tone people use for things they cannot quite believe.",
        "This is your last trench of the training year. It cuts a house in the noble quarter, through the ash of 1565 and down into the floors below it."
      ]
    },
    keynote:"The pot is sealed under a floor, not dropped. Somebody put it there on purpose, meaning to come back — and did not.",
    close:"The hoard is counted, weighed and photographed in the trench before a single coin is lifted, because a hoard is an event, not a set of objects.",
    finds:[
      {r:2,c:5, g:"flame", key:false, fragile:false,
       nm:"Charred beam and ash lens", er:"Layer II · after 1565 CE",
       no:"Charcoal spread over a burnt floor. After the defeat at Talikota in 1565 the city was sacked over a period of months. The destruction layer is thick enough to trowel through slowly."},
      {r:3,c:9, g:"sherd", key:false, fragile:true,
       nm:"Chinese celadon sherd", er:"Layer II · 15th–16th c. CE",
       no:"Green-glazed stoneware carried by sea and then 350 km inland. Imported ceramics are the cheapest proof of a trade route that documents only assert."},
      {r:4,c:1, g:"slag", key:false, fragile:false,
       nm:"Smithing slag", er:"Layer III · Vijayanagara",
       no:"Waste from an iron workshop on the bazaar street. The colonnaded bazaar lines are still traceable running out from the temple gates."},
      {r:5,c:7, g:"wheel", key:false, fragile:false,
       nm:"Granite wheel, unfinished", er:"Layer III · Vijayanagara",
       no:"Roughed out and abandoned before the final dressing. The stone chariot at the Vitthala temple carries wheels like this one — carved separately, then set on axles."},
      {r:6,c:10, g:"hook", key:false, fragile:false,
       nm:"Iron horse bit", er:"Layer IV · Vijayanagara",
       no:"The empire bought war horses through the coastal ports in enormous numbers. Domingo Paes, who saw the city around 1520, thought it as large as Rome and better provisioned."},
      {r:8,c:4, g:"coin", key:true, fragile:false,
       nm:"Sealed pot of gold varahas", er:"Layer V · 16th c. CE",
       no:"Gold coins stamped with the boar of the dynasty, buried under a house floor and never recovered. A hoard is a record of someone's expectation that they would come back."}
    ]
  }
];

export const EPILOGUE = {
  title:"Licence endorsed",
  body:[
    "Five trenches, four thousand years, and one habit you did not have in June: you no longer ask what an object is before you ask what layer it came out of.",
    "Everything you lifted goes on to a site store, a conservation bench and a report that perhaps forty people will read closely. That is the work. The dramatic part — the trench, the brush, the first edge of something appearing — is about a week of any year.",
    "Bharat is not buried in one place. It is in the drain course as much as the gold, and the drain course is usually the better evidence."
  ]
};
