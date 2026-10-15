// Seekaloo themes — every theme and word list here is written by us for this game. Kid-safe, US + UK friendly.
// Format: "Theme name|scene|word word word ..." (scene picks the painted backdrop family).
const RAW = `
Beach Day|sea|sand shell wave towel bucket spade crab kite sunhat picnic seagull tide pebble surf
Breakfast Table|meadow|toast jam honey cereal juice eggs bacon pancake waffle butter yogurt muffin tea milk
Garden Shed|meadow|rake hoe trowel seeds pots hose gloves shears ladder twine bulbs compost barrow
Rainy Day|lake|puddle boots umbrella cloud drizzle raincoat splash thunder drops gust window
Space Trip|night|rocket orbit planet comet star moon galaxy alien crater launch nebula module
Farm Animals|meadow|cow pig goat sheep horse duck hen goose donkey llama rooster lamb calf piglet
In the Kitchen|desert|spoon whisk ladle oven kettle grater sieve pan fork knife bowl toaster apron
Snow Day|snow|sledge mitten scarf snowman igloo frost icicle flake blizzard boots cocoa skis
Ocean Life|sea|whale shark squid dolphin seal coral starfish octopus turtle jellyfish eel clam ray
Music Room|lake|piano drum flute violin cello harp tuba guitar banjo trumpet choir tempo note chord
Camping Trip|forest|tent lantern compass campfire marshmallow map trail backpack canoe owl torch hike
Birthday Party|blossom|cake candles balloon gift card games banner party hat song wish ribbon cupcake
Fruit Bowl|meadow|apple pear banana grape mango lemon lime plum peach cherry kiwi melon orange berry
Vegetable Patch|meadow|carrot potato onion leek pea bean radish cabbage pumpkin lettuce celery turnip beet
Jungle Trek|forest|vine parrot monkey jaguar sloth toucan frog canopy river orchid gecko tapir moss
Desert Sands|desert|dune camel cactus oasis lizard scorpion mirage heat sun caravan nomad mesa
Under the Sea|sea|reef kelp pearl oyster anchor diver bubble shipwreck urchin current lagoon
Arctic Edge|snow|polar bear walrus seal puffin glacier iceberg tundra husky sled aurora orca
Weather Words|lake|rain snow hail wind storm fog mist sleet gale breeze sunny frost cloudy rainbow
Shapes|blossom|circle square oval star heart cube cone sphere prism arrow diamond cross ring spiral
Rainbow Hues|blossom|red blue green yellow purple pink brown black white gold silver teal amber violet
Sports Day|meadow|race relay hurdle javelin medal sprint jump throw team cheer whistle finish
Football Pitch|meadow|goal pass shot kick header corner keeper striker referee tackle whistle penalty
Tennis Court|meadow|serve volley racket net lob smash rally deuce ace court ball match love
Library Visit|lake|book shelf page chapter author index novel atlas fable poem reader quiet
Art Class|blossom|paint brush easel canvas sketch crayon clay palette pastel collage chalk ink
Toy Box|blossom|teddy blocks kite yoyo puzzle doll robot train marbles ball dice top
Pirate Ship|sea|mast sail anchor parrot treasure map cannon deck plank hook flag captain chest
Castle|forest|tower moat knight king queen throne drawbridge banner shield sword dragon gate crown
Fairy Tale|forest|wand castle giant dragon princess frog magic spell potion wizard tower elf
City Streets|city|bus taxi bridge tower park cafe subway market square crossing bike tram museum
At the Airport|city|plane pilot ticket gate runway luggage passport tower boarding hangar cabin wing
Train Ride|forest|track ticket carriage station platform engine tunnel whistle signal guard steam
Bakery|desert|bread bagel scone roll croissant tart pie loaf cookie dough flour icing oven crumb
Pizza Night|desert|cheese tomato basil olive crust slice dough oven pepper mushroom sauce oregano
Ice Cream Stand|blossom|cone scoop sprinkles wafer sundae cherry vanilla mint fudge cup syrup
Tea Party|blossom|teapot cups saucer scones cream jam cake sugar lemon spoon napkin biscuit
Insects|meadow|ant bee beetle moth wasp fly cricket firefly dragonfly flea gnat
Birds|forest|robin owl eagle hawk swan crow wren finch duck heron parrot gull dove sparrow
Pets|blossom|dog cat rabbit hamster goldfish parrot mouse pony tortoise gerbil puppy kitten
Big Cats|desert|lion tiger leopard cheetah jaguar puma lynx ocelot cougar panther
Dinosaur Dig|desert|fossil bone raptor claw tooth egg skull dig brush amber herd swamp
Woodland Walk|forest|oak fern acorn mushroom badger fox deer squirrel hedgehog owl moss stream log
Mountain Hike|snow|peak summit ridge cliff boulder valley trail goat eagle rope cairn view
River Bank|lake|otter reed bank stone ferry boat heron willow bridge fish frog duck lily
Pond Dip|lake|newt frog tadpole snail dragonfly lily reed net jar mud ripple duckweed
Flower Shop|blossom|rose tulip daisy lily orchid poppy iris lilac peony aster bouquet vase stem
Tree Names|forest|oak ash elm pine birch maple willow cedar beech yew holly spruce larch fir
Planets|night|mercury venus earth mars jupiter saturn uranus neptune moon sun orbit ring
Night Sky|night|star moon comet meteor planet orbit owl lantern dusk dawn glow twinkle shadow
Bath Time|lake|soap sponge bubbles towel duck tap bath shampoo rinse flannel steam mirror
Bedtime|night|pillow blanket lamp story yawn dream nightlight slipper teddy lullaby moon sleep
School Bag|city|pencil ruler eraser book lunch crayon glue notepad folder bottle sharpener map
Science Lab|city|beaker magnet test atom cell lens laser robot data graph flask spark circuit
Inventions|city|wheel engine radio phone camera robot clock compass lamp printer rocket bicycle
Construction Site|city|crane brick drill hammer ladder cement digger helmet plank bolt nail beam
Fire Station|city|siren ladder hose helmet engine alarm rescue boots water axe crew bell
Doctor Visit|city|nurse doctor bandage plaster medicine scales chart pulse cough cast clinic
Opposites|blossom|hot cold big small up down fast slow open shut old new loud quiet
Kitchen Herbs|meadow|mint basil sage thyme parsley chives dill rosemary oregano bay coriander
Spices|desert|ginger pepper cinnamon nutmeg clove saffron cumin paprika vanilla turmeric
Fishing Trip|lake|rod reel hook bait net boat lake trout pike float catch cast line
Sailing|sea|boat sail mast deck rudder keel knot port compass breeze crew
Musical Words|lake|rhythm melody song chorus verse beat tune solo band encore duet note
Dance Floor|night|tango waltz salsa disco ballet tap jive swing twirl spin step hop
Circus|blossom|clown juggler tent ring acrobat trapeze magician unicycle popcorn drum lion ticket
Fun Fair|blossom|carousel ferris coaster prize candy floss ticket slide hoopla teacups ride
Superheroes|city|cape mask hero power shield rescue flight speed strong villain gadget badge
Robots|city|circuit gear bolt metal sensor laser battery wheel beep code chip motor
Board Games|lake|dice board token card spinner chess checkers pawn rook queen king turn
Kitchen Sink|city|tap soap sponge plate glass bowl rinse scrub towel drain dish bubbles
Seasons|meadow|spring summer autumn winter fall harvest bloom frost leaves sunshine snow breeze
Halloween Fun|night|pumpkin lantern costume mask candy treat bat cat broom ghost moon owl
Winter Holidays|snow|tree star gift bells snow sleigh candle wreath card carol tinsel cocoa
Picnic Basket|meadow|sandwich apple juice blanket cake grapes cheese napkin flask plate
Body Parts|blossom|head nose ear eye hand foot knee elbow arm leg toe chin thumb wrist
Feelings|blossom|happy sad brave calm shy proud angry glad excited silly kind curious
Family|blossom|mother father sister brother aunt uncle cousin nana grandpa baby twin niece nephew
Jobs|city|chef pilot nurse farmer baker teacher builder vet judge actor artist dentist plumber
Vehicles|city|car bus van truck bike train tram plane boat scooter tractor rocket ferry yacht
Clothes|blossom|shirt skirt dress coat jacket scarf sock shoe boot glove hat sweater belt
Hats|blossom|cap beret bonnet helmet crown hood beanie bowler sunhat turban stetson visor
Tools|city|hammer saw drill wrench pliers screw nail chisel level spanner file clamp tape
Gemstones|night|ruby emerald diamond pearl opal topaz jade amber garnet sapphire quartz onyx
Metals|city|gold silver copper iron tin zinc lead steel bronze brass nickel chrome
Numbers|lake|one two three four five six seven eight nine ten twelve twenty hundred dozen
Time Words|lake|second minute hour day week month year decade noon dawn dusk today later
Volcano|desert|lava ash crater magma smoke rock erupt cone vent island heat steam
Treasure Hunt|forest|map clue key chest gold coin riddle spade path cross compass jewel
Knights|forest|sword shield lance horse quest castle banner helmet squire
Ancient Egypt|desert|pyramid sphinx nile mummy pharaoh tomb scarab papyrus temple desert camel
Ancient Greece|sea|temple olive myth hero column athens oracle marble vase
Vikings|sea|longship helmet shield saga axe fjord oar raid rune chief horn sail
Rainforest|forest|canopy vine orchid frog sloth macaw jaguar mist moss river leaf monkey
Savanna|desert|lion zebra giraffe elephant rhino hippo acacia grass herd hyena gazelle baobab
Australia Wildlife|desert|koala kangaroo wombat emu platypus dingo possum wallaby kookaburra gecko
Sweet Shop|blossom|toffee fudge lolly gum mint jelly sherbet caramel nougat candy truffle
Cheese Board|meadow|cheddar brie feta gouda edam stilton cracker grape chutney apple walnut fig
Sandwich Bar|city|bread ham cheese tuna egg salad pickle relish mayo roll wrap bagel lettuce
Soup Pot|desert|tomato leek onion pea lentil carrot celery stock ladle bowl spoon bread steam
Garden Birds|meadow|robin blackbird wren tit thrush finch starling sparrow magpie jay pigeon dove
Bugs and Slugs|meadow|slug snail worm beetle spider ant earwig woodlouse millipede aphid grub
Reptiles|desert|snake lizard gecko iguana turtle tortoise crocodile alligator chameleon cobra python
Sea Birds|sea|gull puffin tern gannet pelican albatross cormorant petrel skua penguin
Penguin Parade|snow|emperor king waddle huddle egg chick ice flipper slide colony fish krill
Horse Riding|meadow|saddle stirrup bridle rein pony gallop trot canter hoof mane stable rider
Swimming Pool|lake|dive splash lane float goggles towel swim lifeguard slide ladder deep
Gym Class|city|rope mat bench hoop ball skip stretch climb jump vault relay whistle
Keep Fit|meadow|run jog walk swim cycle squat lunge stretch yoga plank row skip
Road Trip|desert|map car fuel snack road motel sign bridge view song tunnel highway
Holiday Bags|sea|suitcase passport ticket camera sunglasses swimsuit towel map sandals hat book
Post Office|city|letter stamp parcel postcard envelope address courier mailbox queue scales
Office Desk|city|stapler pen paper clip folder laptop mouse keyboard lamp diary mug note
Computer|city|screen mouse keyboard laptop email file folder cursor click code pixel app
Stationery|blossom|pen pencil ink paper glue tape ruler stapler clip notebook marker eraser
Wild Weather|lake|tornado cyclone storm thunder flood drought blizzard hail gale lightning
Kitchen Verbs|desert|bake boil fry chop stir mix whisk grill roast peel slice knead pour
Action Words|meadow|run jump skip hop climb swim dance kick throw catch spin crawl slide
Sounds|lake|bang buzz click crash pop hiss hum ring roar tick whoosh splash boom
Animal Babies|meadow|cub calf foal kid lamb chick joey kitten puppy fawn duckling piglet owlet
Animal Homes|forest|nest den burrow hive web stable kennel sett lodge warren shell pond
Green Things|meadow|grass leaf lime frog pea moss kiwi emerald fern lettuce mint olive cactus
Round Things|blossom|ball coin moon wheel ring button plate clock orange pizza bubble globe
Sticky Things|desert|glue tape honey syrup jam gum toffee sap paste resin slime
Things With Wings|forest|bird bee bat plane angel butterfly moth dragon fairy owl kite
Things That Shine|night|star sun moon torch lamp candle gold pearl mirror crystal glitter
Cold Things|snow|ice snow frost fridge freezer igloo glacier sleet hail penguin lolly
Hot Things|desert|sun fire oven kettle lava toast pepper stove desert soup sauna candle
Soft Things|blossom|pillow cloud kitten feather cotton wool fleece velvet marshmallow teddy moss
Island Life|sea|palm coconut lagoon reef hut hammock shell boat sunset turtle sand breeze
Under Ground|forest|root mole worm cave tunnel burrow fossil rock coal bulb badger seed
Harbor Town|sea|boat ferry pier crane dock lighthouse fish nets rope gull buoy anchor quay
Market Stall|meadow|apple bread cheese flower honey egg jam plum basket scales sign coins
Wizard School|night|wand robe hat owl potion spell broom cauldron scroll star moon book
Detective|city|clue magnifier footprint suspect alibi case notebook mystery torch witness puzzle
Spy Kit|city|code cipher gadget map mask torch radio secret signal agent badge disguise
Fairground Food|blossom|popcorn candy toffee apple hotdog waffle donut pretzel slush churro
Breakfast Around|desert|porridge granola omelette crepe bagel croissant pancake muesli kipper congee
Musical Instruments|lake|oboe sitar ukulele tuba harp lute bugle organ cymbal triangle bongo kazoo
Board Sports|sea|surf skate snowboard kite wake paddle wave ramp trick grind carve
Winter Sports|snow|ski skate sled curling luge biathlon slalom hockey toboggan jump
Ball Games|meadow|tennis golf rugby cricket hockey netball bowls squash polo baseball volleyball
Water Words|lake|rain river lake sea pond stream tide wave splash drop puddle spring ocean brook
Light and Dark|night|lamp torch candle shadow dusk dawn glow beam spark moon star dim bright
`;
export const THEMES = RAW.trim().split('\n').map(l => {
  const [name, scene, words] = l.split('|');
  return { name, scene, words: [...new Set(words.trim().split(/\s+/).map(w => w.toUpperCase()))] };
});
