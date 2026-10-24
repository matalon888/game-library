// The garden you restore with stars. Each chapter is one painted scene (1024×1536); tasks place painted pieces at
// image coordinates (x, y = bottom centre, w = width, all in image px). The scene starts faded and weedy, and the
// colour comes back as tasks are finished.
export const CHAPTERS = [
  {
    id: 'lawn', name: 'The Rose Lawn', scene: 'meta-garden',
    weeds: [['m3/bramble-thick', 430, 790, 150], ['m3/bramble-thick', 660, 720, 130], ['m3/mud', 560, 960, 170], ['m3/bramble-thin', 340, 1010, 120],
      ['m3/mud', 470, 870, 150], ['m3/bramble-thick', 740, 1040, 130], ['m3/bramble-thin', 600, 1110, 120], ['m3/mud', 760, 880, 120]],
    tasks: [
      { id: 'weeds', name: 'Clear the brambles', cost: 1, say: 'Lovely, you can see the lawn again!', clear: true },
      { id: 'roses', name: 'Plant roses in the round bed', cost: 1, say: 'Young roses, tucked in for summer.', put: [['plants/rose-young', 205, 790, 110], ['plants/rose-young', 275, 805, 110]] },
      { id: 'fountain', name: 'Bring back the fountain', cost: 3, say: 'Listen, the water is singing again.', put: [['decor/fountain', 560, 930, 290]] },
      { id: 'arch', name: 'A rose arch at the gate', cost: 2, say: 'Now the garden has a doorway.', put: [['decor/rose-arch', 397, 510, 190]] },
      { id: 'bench', name: 'A bench to sit and rest', cost: 2, say: 'Somewhere to sit with a cup of tea.', put: [['decor/bench', 330, 1120, 230]] },
      { id: 'birdbath', name: 'Set out the birdbath', cost: 2, say: 'The bluebirds will be glad of that.', put: [['decor/birdbath', 795, 960, 150]] },
      { id: 'lavender', name: 'Lavender along the hedge', cost: 2, say: 'Smell that! Bees will come soon.', put: [['plants/lavender-bloom', 565, 528, 92], ['plants/lavender-bloom', 640, 532, 92], ['plants/lavender-bloom', 715, 536, 92]] },
      { id: 'beds', name: 'Peonies and hydrangeas', cost: 2, say: 'Pink and blue, just like Granny grew.', put: [['plants/hydrangea-bloom', 770, 585, 125], ['plants/peony-bloom', 845, 680, 120]] },
      { id: 'sundial', name: 'A sundial on the lawn', cost: 2, say: 'It only counts the sunny hours.', put: [['decor/sundial', 330, 760, 130]] },
      { id: 'bloom', name: 'Roses in full bloom', cost: 2, say: 'Oh, they have opened beautifully.', swap: [['plants/rose-young', 'plants/rose-bloom', 130]] },
      { id: 'beehive', name: 'Bees welcome', cost: 2, say: 'Honey for the winter, too.', put: [['decor/beehive', 850, 820, 110]] },
      { id: 'border', name: 'Foxgloves and larkspur', cost: 2, say: 'Tall spires to frame the gate.', put: [['plants/larkspur-bloom', 245, 590, 90], ['plants/foxglove-bloom', 300, 585, 85]] },
      { id: 'barrow', name: 'A barrow of flowers', cost: 2, say: 'Every garden needs a barrow.', put: [['decor/wheelbarrow', 690, 1150, 190], ['decor/watering-can', 215, 1125, 95]] },
      { id: 'lanterns', name: 'Lanterns for summer evenings', cost: 3, say: 'The Rose Lawn is restored. Bravo!', put: [['decor/lantern', 425, 1015, 62], ['decor/lantern', 700, 1020, 62]] },
    ],
  },
  {
    id: 'walled', name: 'The Walled Garden', scene: 'rosewick',
    weeds: [['m3/bramble-thick', 400, 760, 140], ['m3/mud', 600, 830, 160], ['m3/bramble-thick', 680, 980, 140], ['m3/bramble-thin', 330, 1040, 120],
      ['m3/mud', 470, 1130, 150], ['m3/bramble-thick', 560, 1210, 130], ['m3/bramble-thin', 760, 760, 110]],
    tasks: [
      { id: 'weeds', name: 'Pull up the weeds', cost: 1, say: 'Four old beds were hiding under there!', clear: true },
      { id: 'tulips', name: 'Sow tulips in the back bed', cost: 2, say: 'Little shoots already.', put: [['plants/tulip-young', 330, 535, 70], ['plants/tulip-young', 395, 535, 70]] },
      { id: 'sunflowers', name: 'Sunflowers by the wall', cost: 2, say: 'They will be taller than me soon.', put: [['plants/sunflower-young', 680, 535, 75], ['plants/sunflower-young', 745, 535, 75]] },
      { id: 'sundial', name: 'A sundial in the middle', cost: 2, say: 'Right in the heart of the garden.', put: [['decor/sundial', 520, 790, 130]] },
      { id: 'dahlias', name: 'Dahlias in the front bed', cost: 2, say: 'Dahlias love a sunny spot.', put: [['plants/dahlia-young', 255, 610, 80], ['plants/dahlia-young', 325, 610, 80]] },
      { id: 'peas', name: 'Sweet peas on canes', cost: 2, say: 'They smell of summer holidays.', put: [['plants/sweet-pea-young', 745, 610, 80], ['plants/sweet-pea-young', 812, 610, 80]] },
      { id: 'fountain', name: 'A fountain for the birds', cost: 3, say: 'Splish, splash. Perfect.', put: [['decor/fountain', 520, 1110, 250]] },
      { id: 'beehive', name: 'A beehive in the corner', cost: 2, say: 'Busy bees, happy garden.', put: [['decor/beehive', 240, 950, 115]] },
      { id: 'birdhouse', name: 'A birdhouse for the wrens', cost: 2, say: 'Someone has moved in already!', put: [['decor/birdhouse', 815, 900, 105]] },
      { id: 'barrow', name: 'Poppies and a wheelbarrow', cost: 2, say: 'A splash of red by the path.', put: [['decor/wheelbarrow', 340, 1205, 185], ['plants/poppy-bloom', 700, 1190, 95], ['plants/daisy-bloom', 765, 1180, 85]] },
      { id: 'lanterns', name: 'Lanterns by the sundial', cost: 2, say: 'So pretty when the sun goes down.', put: [['decor/lantern', 410, 860, 55], ['decor/lantern', 630, 860, 55]] },
      { id: 'bloom', name: 'Every bed in bloom', cost: 3, say: 'The Walled Garden is restored. Bravo!', swap: [['plants/tulip-young', 'plants/tulip-bloom', 78], ['plants/sunflower-young', 'plants/sunflower-bloom', 85], ['plants/dahlia-young', 'plants/dahlia-bloom', 88], ['plants/sweet-pea-young', 'plants/sweet-pea-bloom', 88]] },
    ],
  },
];
export const TOTAL_TASKS = CHAPTERS.reduce((a, c) => a + c.tasks.length, 0);

// build the scene's pieces for a chapter given the set of finished task ids
export function scenePieces(ch, done) {
  const out = [];
  if (!done.has('weeds')) for (const [src, x, y, w] of ch.weeds) out.push({ src, x, y, w, weed: true, flat: true });
  for (const t of ch.tasks) {
    if (!done.has(t.id) || !t.put) continue;
    for (const [src, x, y, w] of t.put) out.push({ src, x, y, w, task: t.id });
  }
  for (const t of ch.tasks) if (done.has(t.id) && t.swap) for (const [from, to, w] of t.swap) for (const p of out) if (p.src === from) { p.src = to; p.w = w; p.task = t.id; }
  return out.sort((a, b) => a.y - b.y);
}
