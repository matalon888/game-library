// Larkspur Manor: object table, room surfaces and the story.
// OBJ: id -> [name, real size in cm (largest side, small things nudged up), sprite w, sprite h]
export const OBJ = {"acorn": ["Acorn", 5, 174, 242], "apple": ["Apple", 9, 234, 243], "ball-of-wool-with-needles": ["Ball of wool", 14, 301, 261], "bird-nest": ["Bird nest", 16, 313, 263], "brass-key": ["Brass key", 11, 239, 228], "brooch": ["Brooch", 6, 198, 303], "butterfly": ["Butterfly", 8, 310, 206], "button": ["Button", 5, 207, 208], "candle-in-a-holder": ["Candlestick", 18, 240, 272], "chess-knight": ["Chess knight", 8, 142, 282], "china-teacup": ["China teacup", 10, 320, 234], "copper-pan": ["Copper pan", 30, 320, 210], "cupcake": ["Cupcake", 9, 218, 279], "dice": ["Dice", 6, 278, 191], "egg": ["Egg", 7, 187, 236], "feather": ["Feather", 16, 208, 289], "flower-pot": ["Flower pot", 14, 229, 250], "garden-fork": ["Garden fork", 30, 232, 287], "gloves": ["Gloves", 22, 295, 270], "gold-locket": ["Gold locket", 6, 194, 255], "harmonica": ["Harmonica", 11, 320, 183], "horseshoe": ["Horseshoe", 13, 245, 255], "jar-of-honey": ["Honey jar", 11, 248, 260], "ladybird": ["Ladybird", 5, 245, 185], "lantern": ["Lantern", 30, 161, 306], "leather-book": ["Leather book", 22, 310, 251], "lemon": ["Lemon", 9, 266, 216], "loaf-of-bread": ["Loaf of bread", 22, 319, 226], "magnifying-glass": ["Magnifying glass", 20, 301, 252], "mushroom": ["Mushroom", 11, 230, 288], "music-box": ["Music box", 18, 248, 295], "pearl-necklace": ["Pearl necklace", 18, 254, 271], "pepper-mill": ["Pepper mill", 20, 117, 313], "perfume-bottle": ["Perfume bottle", 13, 191, 305], "pincushion": ["Pincushion", 10, 227, 248], "pinecone": ["Pinecone", 10, 204, 249], "pocket-watch": ["Pocket watch", 7, 204, 277], "porcelain-doll": ["Porcelain doll", 35, 225, 292], "quill-pen": ["Quill pen", 24, 261, 283], "rolling-pin": ["Rolling pin", 40, 320, 203], "scissors": ["Scissors", 16, 291, 276], "sealed-letter": ["Sealed letter", 18, 320, 245], "seashell": ["Seashell", 12, 247, 225], "silver-spoon": ["Silver spoon", 16, 246, 275], "silver-thimble": ["Thimble", 5, 150, 211], "snail": ["Snail", 7, 305, 186], "spectacles": ["Spectacles", 13, 320, 191], "spinning-top": ["Spinning top", 9, 186, 245], "spool": ["Spool", 7, 199, 238], "sprig-of-lavender": ["Lavender sprig", 22, 227, 310], "straw-hat": ["Straw hat", 34, 320, 199], "tape-measure": ["Tape measure", 8, 279, 236], "teapot": ["Teapot", 22, 309, 267], "teddy-bear": ["Teddy bear", 30, 243, 280], "toy-sailboat": ["Toy sailboat", 35, 279, 275], "trowel": ["Trowel", 30, 253, 267], "umbrella": ["Umbrella", 80, 285, 305], "watering-can": ["Watering can", 38, 314, 265], "wedge-of-cheese": ["Cheese wedge", 12, 279, 263], "whisk": ["Whisk", 28, 265, 280]};

// Surfaces where objects can rest, in room-image pixels, per orientation (P = portrait 1024x1536, W = wide 1536x1024):
// [x0, y0, x1, y1, k, maxCm, rim?]  the base of an object sits somewhere on the segment (x0,y0)-(x1,y1);
// k = pixels per 10 cm at that depth (perspective), maxCm = the biggest object that fits there,
// rim = y of a front edge (basket rim, box side, table edge): the room is painted back over the object below it,
// so the object looks tucked inside / behind.
export const ROOMS = {
  library: {
    name: 'Library', light: [1, 0.93, 0.82],
    pool: ['leather-book', 'quill-pen', 'spectacles', 'magnifying-glass', 'pocket-watch', 'sealed-letter', 'chess-knight', 'candle-in-a-holder', 'brass-key', 'gold-locket', 'dice', 'harmonica', 'feather', 'china-teacup', 'pearl-necklace', 'seashell', 'brooch', 'button', 'apple', 'spinning-top'],
    P: [
      [470, 630, 540, 630, 20, 18], [595, 630, 630, 630, 20, 14],
      [610, 990, 690, 990, 30, 30], [770, 1000, 900, 1005, 30, 30],
      [70, 1085, 130, 1085, 30, 20], [290, 1062, 380, 1062, 32, 30],
      [170, 428, 330, 428, 26, 14], [170, 605, 340, 605, 26, 14], [270, 775, 340, 775, 26, 14],
      [760, 500, 830, 500, 24, 14], [760, 690, 830, 690, 24, 14], [285, 855, 345, 855, 28, 16],
      [470, 1010, 560, 1010, 32, 25], [600, 1205, 790, 1205, 36, 30],
      [230, 1420, 420, 1440, 44, 90], [40, 1320, 120, 1320, 40, 30, 1300], [880, 1330, 960, 1330, 40, 30, 1305],
    ],
    W: [
      [720, 383, 790, 383, 22, 18], [1000, 384, 1030, 384, 22, 18],
      [290, 330, 400, 330, 22, 12], [430, 232, 600, 232, 22, 12], [1050, 325, 1160, 325, 22, 12],
      [470, 592, 580, 592, 26, 18], [250, 712, 330, 712, 30, 25], [680, 766, 725, 766, 30, 20],
      [560, 690, 640, 690, 28, 25, 660], [230, 890, 300, 885, 32, 25], [540, 915, 600, 915, 32, 25],
      [1250, 665, 1330, 665, 28, 25], [1030, 795, 1120, 795, 32, 25],
      [760, 960, 900, 970, 42, 90], [1180, 970, 1290, 975, 42, 90],
    ],
  },
  kitchen: {
    name: 'Kitchen', light: [1, 0.96, 0.86],
    pool: ['egg', 'lemon', 'whisk', 'rolling-pin', 'wedge-of-cheese', 'loaf-of-bread', 'copper-pan', 'jar-of-honey', 'silver-spoon', 'pepper-mill', 'teapot', 'china-teacup', 'apple', 'cupcake', 'acorn', 'ladybird', 'brass-key', 'sprig-of-lavender', 'spectacles', 'button'],
    P: [
      [180, 965, 330, 975, 34, 40], [450, 945, 560, 950, 34, 40], [620, 860, 700, 860, 32, 30],
      [335, 603, 375, 603, 28, 30], [800, 600, 1000, 600, 26, 30], [770, 385, 1000, 385, 22, 14],
      [470, 1285, 620, 1285, 38, 30, 1268], [560, 1480, 660, 1490, 46, 90], [430, 1480, 520, 1490, 46, 90],
      [640, 1120, 780, 1110, 38, 35],
    ],
    W: [
      [300, 850, 600, 850, 34, 35], [870, 760, 950, 760, 32, 25], [700, 330, 750, 330, 22, 12],
      [920, 490, 975, 490, 24, 18], [60, 395, 100, 395, 24, 15], [1000, 960, 1150, 990, 42, 90],
      [880, 990, 960, 1000, 42, 90], [1200, 950, 1300, 950, 40, 30, 925], [1380, 560, 1420, 560, 26, 20],
    ],
  },
  conservatory: {
    name: 'Conservatory', light: [0.95, 1, 0.92],
    pool: ['butterfly', 'watering-can', 'flower-pot', 'ladybird', 'snail', 'teapot', 'china-teacup', 'straw-hat', 'umbrella', 'sprig-of-lavender', 'bird-nest', 'feather', 'seashell', 'spectacles', 'leather-book', 'lantern', 'mushroom', 'gloves', 'pinecone', 'garden-fork'],
    P: [
      [330, 905, 400, 905, 26, 25], [420, 1110, 510, 1110, 28, 25], [440, 745, 500, 745, 22, 20],
      [140, 700, 170, 700, 24, 14], [110, 960, 200, 960, 30, 25], [740, 1070, 820, 1065, 32, 30],
      [330, 1260, 450, 1260, 38, 90], [515, 1262, 560, 1262, 38, 90], [820, 1300, 870, 1300, 32, 20],
    ],
    W: [
      [440, 192, 470, 192, 22, 14], [440, 398, 470, 398, 22, 14], [420, 500, 470, 500, 22, 14],
      [440, 775, 600, 770, 32, 30], [270, 760, 310, 760, 30, 18], [710, 690, 740, 690, 28, 18],
      [640, 960, 820, 980, 40, 90], [850, 900, 950, 920, 38, 90], [1290, 615, 1340, 615, 26, 20],
    ],
  },
  'sewing-room': {
    name: 'Sewing Room', light: [1, 0.97, 0.9],
    pool: ['scissors', 'spool', 'silver-thimble', 'pincushion', 'tape-measure', 'button', 'ball-of-wool-with-needles', 'brooch', 'pearl-necklace', 'gloves', 'spectacles', 'perfume-bottle', 'straw-hat', 'china-teacup', 'porcelain-doll', 'feather', 'gold-locket', 'sealed-letter', 'teapot', 'butterfly'],
    P: [
      [560, 815, 680, 815, 26, 20], [530, 708, 800, 708, 22, 14], [560, 165, 600, 165, 22, 14],
      [170, 1190, 250, 1195, 34, 25], [380, 1350, 450, 1350, 36, 25, 1330], [330, 1080, 440, 1090, 34, 25],
      [560, 1490, 640, 1490, 46, 60], [690, 935, 770, 935, 28, 20, 920], [640, 1010, 690, 1010, 30, 18],
    ],
    W: [
      [460, 665, 560, 665, 28, 25], [700, 355, 750, 355, 22, 12], [640, 575, 700, 575, 24, 14],
      [1060, 585, 1110, 585, 24, 14], [680, 930, 790, 930, 32, 20], [20, 850, 90, 850, 32, 25, 830],
      [1150, 845, 1240, 845, 36, 25], [1330, 455, 1380, 455, 22, 12], [40, 690, 140, 690, 28, 20],
    ],
  },
  attic: {
    name: 'Attic', light: [1, 0.94, 0.84],
    pool: ['teddy-bear', 'porcelain-doll', 'toy-sailboat', 'spinning-top', 'music-box', 'lantern', 'umbrella', 'straw-hat', 'horseshoe', 'dice', 'chess-knight', 'harmonica', 'brass-key', 'pearl-necklace', 'perfume-bottle', 'pocket-watch', 'candle-in-a-holder', 'sealed-letter', 'gold-locket', 'seashell'],
    P: [
      [420, 785, 520, 785, 24, 18], [250, 840, 330, 840, 30, 30], [380, 960, 470, 960, 30, 25, 940],
      [420, 1300, 560, 1310, 42, 90], [360, 1150, 500, 1150, 38, 90], [230, 1235, 320, 1235, 38, 30],
      [770, 1080, 830, 1080, 34, 25], [820, 700, 880, 700, 26, 20], [600, 1360, 680, 1360, 40, 25],
    ],
    W: [
      [170, 585, 240, 585, 28, 20], [380, 592, 420, 592, 28, 18], [880, 455, 935, 455, 22, 12],
      [750, 497, 830, 497, 24, 20], [960, 622, 995, 622, 28, 18], [620, 800, 800, 810, 38, 90],
      [650, 940, 780, 960, 42, 90], [1420, 338, 1470, 338, 22, 14], [1000, 870, 1080, 870, 36, 25],
      [60, 770, 200, 770, 32, 25, 750],
    ],
  },
  'potting-shed': {
    name: 'Potting Shed', light: [0.97, 0.98, 0.88],
    pool: ['trowel', 'garden-fork', 'flower-pot', 'watering-can', 'gloves', 'snail', 'ladybird', 'acorn', 'pinecone', 'mushroom', 'bird-nest', 'egg', 'straw-hat', 'sprig-of-lavender', 'lantern', 'apple', 'horseshoe', 'butterfly', 'seashell', 'umbrella'],
    P: [
      [100, 195, 150, 195, 22, 14], [380, 975, 440, 975, 32, 30], [230, 990, 300, 990, 32, 30],
      [880, 995, 920, 995, 30, 20], [800, 835, 860, 835, 26, 18], [500, 1480, 600, 1490, 46, 90],
      [310, 1400, 380, 1400, 38, 25, 1385], [730, 1170, 820, 1170, 32, 20, 1150],
    ],
    W: [
      [660, 598, 760, 598, 28, 25], [960, 600, 1010, 600, 28, 25], [1180, 612, 1230, 612, 28, 25],
      [300, 618, 360, 618, 28, 20], [870, 505, 900, 505, 24, 14], [520, 990, 580, 990, 40, 90],
      [800, 1000, 850, 1000, 40, 90], [470, 790, 580, 790, 32, 25, 775],
    ],
  },
};
export const ROOM_IDS = Object.keys(ROOMS);
