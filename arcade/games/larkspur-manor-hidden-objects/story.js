// Larkspur Manor: the gentle mystery, six chapters of three scenes, then endless "Seasons at Larkspur" visits.
// Each scene has one story clue that is always on the list (marked with a rose ribbon).
export const CHAPTERS = [
  { room: 'library', title: 'The Key in the Library', decor: 'bench', cost: 6, scenes: [
    { intro: 'Great-aunt Iris has left you Larkspur Manor, and a single note: "The house has kept my secret for fifty years. Begin where I kept my books."',
      clue: 'brass-key', found: 'A small brass key, tagged in Iris\'s hand: "Desk, left drawer."' },
    { intro: 'The left drawer holds Iris\'s diary, but the pages stop in June 1974. The rest have been carefully cut away.',
      clue: 'magnifying-glass', found: 'Under the glass, faint pencil shows through: "Ask Cook about the elderflower cake."' },
    { intro: 'Before you go downstairs, the library has one more thing to give you.',
      clue: 'sealed-letter', found: 'A letter sealed with rose-red wax, addressed to Miss Iris Larkspur. It was never opened. It is signed only "T."' },
  ], end: 'Who was T.? The letter feels too precious to open alone. Restore the garden bench, where Iris liked to read, and the kitchen will open.' },
  { room: 'kitchen', title: 'Cook\'s Recipe Book', decor: 'birdbath', cost: 6, scenes: [
    { intro: 'Mrs. Penhallow cooked at Larkspur for forty years. Her granddaughter says Iris baked one cake every June, and never said why.',
      clue: 'jar-of-honey', found: 'Honey from the manor hives, labelled "June". Iris kept bees with someone who "knew every flower by name".' },
    { intro: 'The recipe book falls open at Elderflower Cake. A pressed larkspur marks the page.',
      clue: 'silver-spoon', found: 'An old silver spoon engraved "T.H. & I.L.": two sets of initials, side by side.' },
    { intro: 'T.H. The parish records say Thomas Hale was the manor\'s gardener until the summer of 1974.',
      clue: 'china-teacup', found: 'Folded inside the teacup, a tiny note: "The glasshouse, under the orchids. Always yours."' },
  ], end: 'Iris and the gardener. The pieces are coming together. Restore the birdbath and the conservatory doors will open.' },
  { room: 'conservatory', title: 'The Gardener\'s Glasshouse', decor: 'rose-arch', cost: 6, scenes: [
    { intro: 'Thomas built this glasshouse with his own hands. The orchids he planted still bloom every spring.',
      clue: 'gloves', found: 'Thomas\'s gardening gloves, mended many times. Stitched inside the cuff: "For T., from I."' },
    { intro: 'A watering rota is still pinned by the door. Tuesdays and Fridays: "T.H. & I.L."',
      clue: 'bird-nest', found: 'A robin\'s nest, empty and perfect. Iris wrote that a robin followed Thomas everywhere he dug.' },
    { intro: 'In the autumn of 1974 Thomas went to sea, to earn enough to marry. Did he ever come home?',
      clue: 'seashell', found: 'A shell from a far-off shore, sent with a note: "Keep the larkspur blooming. I will be home by spring."' },
  ], end: 'He promised to come home. Restore the rose arch and the sewing room will open.' },
  { room: 'sewing-room', title: 'A Dress Never Worn', decor: 'fountain', cost: 6, scenes: [
    { intro: 'On the dress form hangs a wedding gown, finished all but the very last button.',
      clue: 'button', found: 'The last pearl button, wrapped in tissue paper. Iris never sewed it on.' },
    { intro: 'Iris\'s sewing basket holds a bundle of letters from Thomas, every single one answered.',
      clue: 'spool', found: 'A spool of thread the exact blue of larkspur. She used it to stitch his initials.' },
    { intro: 'The last letter in the bundle is from the shipping line: Thomas\'s ship was delayed by a whole year.',
      clue: 'gold-locket', found: 'A gold locket. Inside, a tiny painted larkspur and a curl of sandy hair.' },
  ], end: 'A year apart, and still writing. Restore the fountain and the attic will open.' },
  { room: 'attic', title: 'Trunks and Treasures', decor: 'sundial', cost: 6, scenes: [
    { intro: 'The attic trunks are labelled in Iris\'s tidy hand: "Summer 1975".',
      clue: 'music-box', found: 'A music box. When you wind it, it plays the waltz from the village fête.' },
    { intro: 'Under the velvet lining of the music box is a ticket stub: a ship docking in the spring of 1975.',
      clue: 'pocket-watch', found: 'Thomas\'s pocket watch, stopped at ten past four: the hour his ship came in.' },
    { intro: 'So Thomas did come home. Then why was his letter never opened?',
      clue: 'toy-sailboat', found: 'A toy sailboat with "Larkspur" painted on its side. Thomas carved it for their wedding day.' },
  ], end: 'One last place to look: the potting shed, where Thomas kept his seeds. Restore the sundial to open it.' },
  { room: 'potting-shed', title: 'The Larkspur Seeds', decor: 'beehive', cost: 6, scenes: [
    { intro: 'Seed packets line the shelves, dated in two hands, his and hers, every year from 1975 to 2019.',
      clue: 'trowel', found: 'Two trowels hang side by side. They gardened here together for forty-four years.' },
    { intro: 'They married quietly in the garden. The sealed letter was the one Thomas wrote on the morning he sailed.',
      clue: 'sprig-of-lavender', found: 'Lavender tied with blue thread: Iris\'s way of saying "I remember".' },
    { intro: 'You sit on the bench by the larkspur and, at last, open the letter.',
      clue: 'flower-pot', found: 'A pot of larkspur seedlings, labelled: "For whoever comes next. Keep them blooming."' },
  ], end: '"My dearest Iris, if I am late, plant the larkspur and wait for me. I will always come home." He did. Now the manor is yours to keep blooming.' },
];
export const STORY_SCENES = CHAPTERS.length * 3;

// garden restoration on the manor lawn (stars). The first six open the chapters; the rest are for the seasons after.
// x/y = base point on the hub painting, h = height, per orientation (P portrait 1024x1536, W wide 1536x1024)
export const DECOR = [
  { id: 'bench', name: 'Garden bench', cost: 6, P: [520, 1265, 150], W: [840, 880, 120] },
  { id: 'birdbath', name: 'Birdbath', cost: 6, P: [370, 1190, 150], W: [690, 820, 120] },
  { id: 'rose-arch', name: 'Rose arch', cost: 6, P: [515, 1080, 190], W: [840, 770, 150] },
  { id: 'fountain', name: 'Fountain', cost: 6, P: [690, 1200, 160], W: [990, 830, 125] },
  { id: 'sundial', name: 'Sundial', cost: 6, P: [345, 1315, 150], W: [645, 925, 115] },
  { id: 'beehive', name: 'Beehive', cost: 6, P: [770, 1330, 140], W: [1050, 930, 110] },
  { id: 'birdhouse', name: 'Birdhouse', cost: 8, P: [300, 1110, 170], W: [610, 760, 130] },
  { id: 'lantern', name: 'Garden lantern', cost: 8, P: [610, 1330, 110], W: [930, 945, 90] },
  { id: 'trellis', name: 'Clematis trellis', cost: 8, P: [740, 1090, 170], W: [1060, 760, 130] },
  { id: 'urn', name: 'Flower urn', cost: 10, P: [430, 1360, 130], W: [760, 960, 100] },
  { id: 'wheelbarrow', name: 'Wheelbarrow', cost: 10, P: [610, 1150, 110], W: [910, 800, 85] },
  { id: 'watering-can', name: 'Watering can', cost: 10, P: [455, 1240, 80], W: [760, 860, 65] },
];
// coin sink: flowering borders along the lawn
export const BLOOMS = [
  { id: 'rose', name: 'Rose border', cost: 120, P: [300, 1420, 170], W: [600, 990, 130] },
  { id: 'lavender', name: 'Lavender edge', cost: 120, P: [720, 1420, 150], W: [1110, 990, 120] },
  { id: 'peony', name: 'Peony bed', cost: 160, P: [250, 1260, 160], W: [570, 880, 120] },
  { id: 'hydrangea', name: 'Hydrangea bush', cost: 160, P: [790, 1250, 160], W: [1120, 880, 120] },
  { id: 'tulip', name: 'Tulip row', cost: 200, P: [420, 1450, 140], W: [700, 1005, 110] },
  { id: 'foxglove', name: 'Foxgloves', cost: 200, P: [610, 1450, 170], W: [1000, 1005, 130] },
  { id: 'sunflower', name: 'Sunflowers', cost: 250, P: [210, 1380, 200], W: [520, 960, 150] },
  { id: 'larkspur', name: 'Larkspur', cost: 300, P: [830, 1380, 220], W: [1180, 960, 160] },
];

// after the story: gentle reasons to visit a room again
export const VISITS = [
  'The vicar is coming for tea. Tidy the {room} before the kettle boils.',
  'Last night\'s storm rattled the {room}. Put a few things back where they belong.',
  'The village garden club is touring the manor today. Find some curios in the {room} to show them.',
  'Mrs. Penhallow\'s granddaughter is visiting. She remembers playing hide-and-seek in the {room}.',
  'A rainy afternoon: the perfect time for a slow look around the {room}.',
  'The robin has followed you indoors again. Look around the {room} while it sings.',
  'Spring cleaning! Iris left little treasures all over the {room}.',
  'A letter from the museum: they would love to borrow a few things from the {room}.',
];
export const DAILY_LINES = [
  'Today\'s visit: the {room}, just as Iris left it this morning.',
  'Everyone in the village is looking in the {room} today. How quickly can you tidy it?',
];
export const STAMPS = ['robin', 'rose', 'teapot', 'cottage', 'bluebells', 'butterfly', 'peony', 'hedgehog', 'lighthouse', 'cat', 'sunflower', 'bluetit',
  'hydrangea', 'swan', 'beehive', 'teacup', 'fox', 'lavender', 'owl', 'strawberry', 'sailboat', 'squirrel', 'tulip', 'kingfisher'];
