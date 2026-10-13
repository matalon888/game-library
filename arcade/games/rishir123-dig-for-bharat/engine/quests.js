/* ============================================================
   The mystery layer.

   Each season opens with a question. Six clues answer it one at a
   time, and every clue names something you can actually see on
   the ground plus how deep to go. Nothing is marked on a map:
   the clue is the map.

   Depths are in metres below the old ground surface, and they are
   not decoration — a find only appears at the depth its layer says
   it should be at, which is the whole lesson.
   ============================================================ */
import { B } from "./blocks.js";

/* terrain recipe per site: what the country looks like, what the
   five strata are made of, and which six landmarks stand on it */
export const TERRAIN = {
  rakhigarhi: {
    base: 18, relief: 5.0, mound: 9, moundR: 34,
    river: true, riverX: 30, riverW: 9, riverDepth: 4,
    skin: B.GRASS, strata: [B.DIRT, B.SILT, B.CLAY, B.MUDBRICK, B.GRAVEL],
    trees: 0.7, scrub: 1.4,
    far: 0x8e8a58,
    sky: { top: 0x4f88cc, bottom: 0xe8d3a8, fog: 0xd6c39c },
    landmarks: [{ type: "burnt" }, { type: "hollow" }, { type: "cairn" },
                { type: "wallline" }, { type: "tree" }, { type: "grove" }]
  },
  lothal: {
    base: 13, relief: 2.2, mound: 5, moundR: 30,
    river: true, riverX: 92, riverW: 11, riverDepth: 5,
    skin: B.SAND, strata: [B.SAND, B.SILT, B.CLAY, B.MUDBRICK, B.PEAT],
    trees: 0.12, scrub: 0.7,
    far: 0xbfab80,
    sky: { top: 0x5b96cc, bottom: 0xf0e0bc, fog: 0xdfd0ac },
    landmarks: [{ type: "chips" }, { type: "scatter" }, { type: "platform" },
                { type: "channel" }, { type: "wallline" }, { type: "saltpan" }]
  },
  vidisha: {
    base: 17, relief: 6.5, mound: 7, moundR: 30,
    river: true, riverX: 34, riverW: 12, riverDepth: 5,
    skin: B.GRASS, strata: [B.DIRT, B.LOAM, B.SILT, B.CLAY, B.LATERITE],
    trees: 2.4, scrub: 1.0,
    far: 0x86864e,
    sky: { top: 0x477fc4, bottom: 0xe4d6b0, fog: 0xcfc19c },
    landmarks: [{ type: "scatter" }, { type: "cairn" }, { type: "platform" },
                { type: "chips" }, { type: "outcrop" }, { type: "stump" }]
  },
  nalanda: {
    base: 16, relief: 3.4, mound: 11, moundR: 32,
    river: false, riverX: 0, riverW: 0, riverDepth: 0,
    skin: B.GRASS, strata: [B.DIRT, B.RUBBLE, B.LOAM, B.MUDBRICK, B.ASH],
    trees: 1.6, scrub: 0.7,
    far: 0x88894e,
    sky: { top: 0x4d84c0, bottom: 0xe2d4b4, fog: 0xcdbfa0 },
    landmarks: [{ type: "wallline" }, { type: "scatter" }, { type: "platform" },
                { type: "hollow" }, { type: "postrow" }, { type: "ashfloor" }]
  },
  hampi: {
    base: 19, relief: 8.0, mound: 6, moundR: 26,
    river: true, riverX: 96, riverW: 13, riverDepth: 6,
    skin: B.GRASS, strata: [B.DIRT, B.ASH, B.SILT, B.RUBBLE, B.CLAY],
    trees: 0.9, scrub: 1.6,
    far: 0x8d8956,
    sky: { top: 0x4a86c8, bottom: 0xecdcb4, fog: 0xd4c4a0 },
    landmarks: [{ type: "ashfloor" }, { type: "scatter" }, { type: "slagheap" },
                { type: "outcrop" }, { type: "postrow" }, { type: "platform" }]
  }
};

/* One question per season, six clues that answer it, and the line
   that closes it when the keystone comes out of the ground. */
export const QUESTS = {
  rakhigarhi: {
    question: "A woman lies buried at the edge of this mound with pots at her head. Her city ran on things made a long way off. How far did they come, and who kept them honest?",
    answer: "Weights that match Harappa's, bricks in the same ratio as Sindh's, a seal in a script nobody can read — and a woman whose own ancestry the ground can still tell you. The standard held across a thousand kilometres. Somebody was enforcing it.",
    clues: [
      { text: "Bangles are fired, not carved, and a kiln scorches the ground it stands on for good. Find the ground that is still red, and take the turf off it.",
        why: "Fired clay needs a kiln. Kilns leave burnt earth." },
      { text: "A fish-hook is no use without water. There was a pond here once and the ground has never quite filled it back in. Cut into the low ground at its edge.",
        why: "Objects sit where they were used." },
      { text: "Traders weigh what they sell. The stones stacked beside the old track mark where the road came into the town — the merchants' quarter is beneath it, and it is deeper than the pond.",
        why: "A road brings a market; a market needs weights." },
      { text: "Where a wall has been ploughed for four thousand years, its brick comes up to the surface in a line. Follow the line of footings and go straight down: the drain runs under the street it served.",
        why: "Buried walls betray themselves at the surface." },
      { text: "Seals are kept where goods are sealed, in a storeroom on the highest floor of the town. The lone tamarind is growing on it. This one is deep — you are into the mature city now.",
        why: "The deeper the floor, the older the town." },
      { text: "Cemeteries lie outside the walls, never inside them. The thorn trees took the ground nobody would build on. Go deeper than you have gone all season.",
        why: "The dead are buried beyond the living." }
    ]
  },
  lothal: {
    question: "A brick basin two hundred metres long sits beside a town of two thousand people. Was it a dock or a reservoir — and what was this place selling to be worth either?",
    answer: "Carnelian, drilled with a stone harder than anything nearby, etched white, and shipped to a gulf whose seals came back the other way. Whether the basin took ships or held water is still argued. What it stood next to is not in doubt.",
    clues: [
      { text: "A bead workshop throws away far more stone than it sells. Look for the spread of pale chippings on the flat, and lift the sand off it.",
        why: "Manufacture leaves waste. Waste is evidence." },
      { text: "The drill that bores a bead is harder than the bead. It breaks, and it gets thrown out with the broken pots. Dig the pottery scatter.",
        why: "Rubbish heaps are where tools go to be found." },
      { text: "People play where they live. The low mud-brick platform is a house floor; take it down a couple of metres into the room below.",
        why: "A floor seals whatever was dropped on it." },
      { text: "Rice needs standing water, and this ground was drained by hand. The dry channel is where the water ran. Cut its bank.",
        why: "Crops follow water; water follows engineering." },
      { text: "Goods coming off a ship go into a store, and a store is sealed. The line of brick footings is a warehouse wall — go under its floor.",
        why: "Seals belong with storage." },
      { text: "The salt crust marks where the basin's water stood longest. Its wall is under you, and its sluice is under that. This is the deepest thing on the site.",
        why: "The biggest structure has the deepest foundation." }
    ]
  },
  vidisha: {
    question: "In 113 BCE a Greek ambassador put up a pillar here to an Indian god and called himself a devotee. What kind of town made that unremarkable?",
    answer: "A junction. Fine city tableware, the earliest coinage, a guild of ivory carvers who signed a monument nine kilometres away, imperial stone hauled in from Chunar — and a foreign envoy who found nothing strange about the local god. Traffic makes tolerance ordinary.",
    clues: [
      { text: "Fine tableware breaks like any other. The pottery scatter is where the town threw its rubbish — the black polished ware is just under the turf.",
        why: "A distinctive ware dates a layer on sight." },
      { text: "Coins are lost where people stop and pay. The stack of stones stands at the crossing of two tracks. Dig where they meet.",
        why: "Money is dropped at markets and gates." },
      { text: "Carvers work in a workshop, and a workshop has a floor. The low mud-brick platform is one; the tools are in it.",
        why: "Craft quarters cluster and stay put." },
      { text: "Dressing stone makes chips, and imperial stone makes chips with a mirror polish on them. Take the spread of chippings down to the Mauryan level.",
        why: "The polish is the signature of one century." },
      { text: "An edict is cut on rock so it will last, and rock is where you find it. The granite boulders carry it — go down beside them.",
        why: "Inscriptions are placed where people pass." },
      { text: "The broken stump on the rise is not natural. Under it is the base it was set into, and around the base is the inscription. Go deep.",
        why: "A pillar's story is in its footing." }
    ]
  },
  nalanda: {
    question: "Seven hundred years of monastery, and then a layer of ash. What was kept here that made burning it worth the trouble?",
    answer: "A library, and a network. Sealings that name the community, a charter from a king in Sumatra who paid for a building here, bronzes that reached Tibet — and a folio of palm leaf, charred, which is the only part of the collection anyone will ever hold.",
    clues: [
      { text: "The monastery is nine buildings on one plan, rebuilt for seven centuries. The line of brick footings is the outer wall — the figures that decorated it fell just inside.",
        why: "Decoration falls where the wall stood." },
      { text: "Every document leaving a monastery is sealed with its name. The rubbish scatter is where broken sealings ended up. It is shallow.",
        why: "A sealing is how a mound gets identified." },
      { text: "A shrine holds the images. The low platform is its floor; the bronze is under it.",
        why: "Votive objects are left at shrines." },
      { text: "Monks read at night and lamps go out. The hollow was the monastery tank — the cells stood along its edge. Cut into the bank.",
        why: "Water is dug where people live beside it." },
      { text: "A royal grant is a sheet of copper, kept where the community met. The row of column stumps is the courtyard. Go under it.",
        why: "Charters are stored at the centre." },
      { text: "The blackened floor is the reason this site is famous. Everything beneath it burned. Go through the ash and keep going — what you are after is at the very bottom of the season.",
        why: "A destruction layer seals everything under it." }
    ]
  },
  hampi: {
    question: "The largest city in India in 1565, and empty by 1566. Somebody put gold under a floor here. What happened to them?",
    answer: "Talikota happened, and then months of sacking. The ash sits near the top and the city sits under it, which means you read this place backwards. The hoard was never lifted, and a hoard is a plan to come back.",
    clues: [
      { text: "Start with the disaster, because here it is the shallowest thing on the site. The blackened floor is the burning of 1565. Barely scratch it.",
        why: "At Hampi the catastrophe lies above the city." },
      { text: "Imported porcelain travelled three hundred and fifty kilometres inland to be dropped in a market. Dig the pottery scatter.",
        why: "Foreign ceramics prove a trade route." },
      { text: "A bazaar has a smithy, and a smithy makes waste that never rots. The black heap of slag is exactly what it looks like.",
        why: "Industrial waste marks industrial quarters." },
      { text: "The chariot's wheels were cut from granite and finished on the spot. The boulders are the quarry; a rejected wheel is lying beside them.",
        why: "Quarries keep the pieces that failed." },
      { text: "Vijayanagara bought war horses by the thousand. The row of column stumps is the bazaar colonnade where they were traded. Go under the street.",
        why: "The bazaar is where the money moved." },
      { text: "Somebody lifted a floor slab in a good house, put a pot of gold coins under it, and meant to come back. The house platform is still there. This is the deepest cut of the year.",
        why: "A hoard is buried under a floor you trust." }
    ]
  }
};

/* the magnetometer's assist, so nobody is ever truly stuck */
export function bearingTo(px, pz, tx, tz) {
  const dx = tx - px, dz = tz - pz;
  const dist = Math.hypot(dx, dz);
  const compass = ["dir.n", "dir.ne", "dir.e", "dir.se", "dir.s", "dir.sw", "dir.w", "dir.nw"];
  const ang = Math.atan2(dx, -dz);                       // -z is north
  const oct = ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8;
  return { dist, dirKey: compass[oct] };
}
