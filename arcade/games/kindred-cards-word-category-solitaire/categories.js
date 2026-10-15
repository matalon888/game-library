// Kindred Cards categories — every category and word list here is written by us for this game (kid-safe, US + UK friendly).
// Format: "Category|icon|family|word word ...". A level never uses two categories from the same family, and never deals a word
// that also appears in another category on the table, so every card has exactly one home.
const RAW = `
Fruits|🍎|food|Apple Pear Plum Grape Mango Cherry Peach Lemon Kiwi Melon
Vegetables|🥕|food|Carrot Potato Onion Pea Leek Cabbage Turnip Radish Celery Spinach
Desserts|🍰|food|Pudding Trifle Sundae Crumble Brownie Cupcake Mousse Tart Jelly Cheesecake
Breakfast|🍳|food|Toast Cereal Porridge Waffle Pancake Bacon Muffin Bagel Granola Eggs
Drinks|🥤|food|Juice Milk Tea Coffee Cocoa Lemonade Smoothie Water Milkshake
Bakery|🥐|food|Bread Scone Roll Croissant Pie Loaf Cookie Bun Pretzel Doughnut
Pizza|🍕|food|Cheese Tomato Basil Olive Crust Slice Pepperoni Mushroom Sauce Oregano
Ice Cream|🍦|food|Cone Scoop Sprinkles Wafer Vanilla Fudge Syrup Cherry Mint Sundae
Herbs|🌿|food|Mint Basil Sage Thyme Parsley Chives Dill Rosemary Oregano Bay
Spices|🌶️|food|Ginger Pepper Cinnamon Nutmeg Clove Saffron Cumin Paprika Turmeric Vanilla
Nuts|🥜|food|Almond Cashew Walnut Peanut Hazelnut Pecan Pistachio Acorn Chestnut Coconut
Cheeses|🧀|food|Cheddar Brie Feta Gouda Edam Stilton Mozzarella Parmesan Ricotta Halloumi
Pasta|🍝|food|Penne Fusilli Ravioli Macaroni Spaghetti Linguine Rigatoni Tortellini Gnocchi Orzo
Sweets|🍬|food|Toffee Fudge Caramel Lollipop Jellybean Gumdrop Nougat Truffle Licorice Marshmallow
Soup|🍲|food|Tomato Lentil Onion Pea Noodle Leek Minestrone Broth Chowder Pumpkin
Salad|🥗|food|Lettuce Cucumber Radish Tomato Celery Spinach Olive Crouton Dressing Beetroot
Baking|🧁|food|Flour Sugar Butter Eggs Yeast Dough Oven Icing Whisk Tray
Dogs|🐶|animal|Poodle Beagle Collie Boxer Pug Terrier Spaniel Husky Labrador Dalmatian
Big Cats|🦁|animal|Lion Tiger Leopard Cheetah Jaguar Puma Lynx Panther Cougar Ocelot
Birds|🐦|animal|Robin Eagle Swan Owl Crow Finch Wren Heron Parrot Sparrow
Sea Life|🐠|animal|Whale Shark Squid Dolphin Seal Octopus Crab Starfish Turtle Eel
Insects|🐝|animal|Ant Bee Beetle Moth Wasp Cricket Firefly Gnat Dragonfly Flea
Farm|🐄|animal|Cow Pig Sheep Goat Horse Hen Duck Donkey Llama Goose
Pets|🐹|animal|Hamster Goldfish Rabbit Gerbil Kitten Puppy Pony Tortoise Ferret Mouse
Baby Animals|🐣|animal|Cub Calf Foal Kid Lamb Chick Joey Kitten Puppy Piglet
Animal Homes|🪺|animal|Nest Hive Den Burrow Web Stable Kennel Lodge Warren Hutch
Reptiles|🦎|animal|Snake Lizard Gecko Iguana Turtle Tortoise Crocodile Alligator Chameleon Cobra
Polar|🐧|animal|Penguin Walrus Seal Puffin Husky Orca Narwhal Reindeer Lemming Iceberg
Jungle|🌴|animal|Vine Parrot Monkey Jaguar Sloth Toucan Canopy Orchid Gecko Tapir
Pond|🐸|animal|Frog Newt Tadpole Lily Reed Duck Snail Heron Dragonfly Ripple
Dinosaur Dig|🦕|animal|Fossil Claw Tooth Skull Bones Footprint Amber Raptor Brush Shovel
Weather|⛅|nature|Rain Snow Hail Fog Wind Storm Sleet Drizzle Thunder Breeze
Flowers|🌷|nature|Rose Tulip Daisy Lily Orchid Poppy Iris Lilac Peony Sunflower
Trees|🌳|nature|Oak Pine Birch Willow Maple Cedar Beech Elm Spruce Holly
Garden|🌻|nature|Rake Hoe Trowel Hose Shed Pond Hedge Lawn Seeds Compost
Water|🌊|nature|Ocean Sea Lake River Pond Stream Lagoon Bay Creek Waterfall
Volcano|🌋|nature|Lava Ash Crater Magma Smoke Erupt Cone Vent Steam Rock
Mountains|🏔️|nature|Peak Summit Ridge Cliff Valley Boulder Glacier Slope Cave Pass
Desert|🌵|nature|Dune Camel Cactus Oasis Lizard Scorpion Mirage Mesa Caravan Sand
Countries|🌍|place|France Japan Brazil Canada Egypt India Peru Kenya Spain Norway
Cities|🏙️|place|Paris Tokyo Cairo Rome London Sydney Lima Oslo Madrid Delhi
Rivers|🏞️|place|Nile Amazon Thames Danube Rhine Ganges Volga Seine Yukon Mekong
Islands|🏝️|place|Iceland Bali Crete Sicily Cuba Malta Fiji Jamaica Tahiti Hawaii
Planets|🪐|space|Mercury Venus Earth Mars Jupiter Saturn Uranus Neptune
Space|🚀|space|Rocket Comet Galaxy Nebula Orbit Astronaut Meteor Star Moon Alien
Furniture|🛋️|home|Sofa Table Chair Desk Bed Shelf Stool Wardrobe Bench Dresser
Kitchen|🍴|home|Whisk Ladle Grater Sieve Kettle Toaster Spatula Fork Spoon Pan
Tools|🔨|home|Hammer Saw Drill Wrench Pliers Chisel Screwdriver Clamp Spanner Tape
Bathroom|🛁|home|Soap Sponge Towel Shampoo Toothbrush Mirror Bathtub Shower Tap Bathmat
Bedroom|🛏️|home|Pillow Blanket Lamp Duvet Mattress Curtain Slippers Alarm Wardrobe Rug
Appliances|🔌|home|Toaster Kettle Fridge Blender Oven Freezer Microwave Mixer Dishwasher Stove
Jobs|👩|people|Nurse Pilot Chef Farmer Baker Teacher Builder Vet Dentist Plumber
Family|👪|people|Mother Father Sister Brother Aunt Uncle Cousin Niece Nephew Grandma
Body|✋|people|Knee Elbow Ankle Wrist Shoulder Thumb Heel Chin Cheek Nose
Feelings|😊|people|Happy Sad Brave Calm Shy Proud Grumpy Glad Excited Curious
Toys|🧸|fun|Doll Kite Yoyo Teddy Puzzle Robot Marbles Blocks Ball Rattle
Games|♟️|fun|Chess Checkers Ludo Dominoes Bingo Snap Charades Tag Hopscotch Marbles
Castle|🏰|fun|Tower Moat Knight King Queen Throne Drawbridge Turret Banner Gate
Pirates|🏴|fun|Treasure Plank Cannon Anchor Compass Eyepatch Captain Map Chest Parrot
Circus|🎪|fun|Clown Juggler Acrobat Trapeze Magician Unicycle Tent Ringmaster Popcorn Tightrope
Fairground|🎡|fun|Carousel Coaster Prize Ticket Slide Teacups Hoopla Ferris Bumper Ride
Heroes|🦸|fun|Cape Mask Hero Power Shield Rescue Gadget Sidekick Villain Badge
Fairy Tales|🧚|fun|Wand Dragon Giant Princess Frog Spell Potion Wizard Elf Beanstalk
Halloween|🎃|fun|Pumpkin Ghost Broom Cauldron Costume Lantern Bat Spider Candy Mask
Birthday|🎂|fun|Cake Candles Balloon Gift Party Card Wish Banner Ribbon Games
Magic Show|🪄|fun|Wand Spell Cloak Rabbit Hat Cards Trick Curtain Bow Applause
Detective|🔍|fun|Clue Suspect Alibi Footprint Magnifier Case Mystery Witness Notebook Puzzle
Robots|🤖|fun|Circuit Gear Bolt Metal Sensor Battery Wheel Beep Code Chip
Ancient Egypt|🐫|fun|Pyramid Sphinx Nile Mummy Pharaoh Tomb Scarab Papyrus Temple Camel
Vikings|🛶|fun|Longship Helmet Shield Saga Fjord Oar Raid Rune Chief Horn
Vehicles|🚗|travel|Car Bus Van Truck Train Tram Bike Scooter Taxi Tractor
Boats|⛵|travel|Canoe Yacht Ferry Raft Kayak Barge Sailboat Gondola Tugboat Dinghy
Airport|✈️|travel|Plane Pilot Ticket Gate Runway Luggage Passport Boarding Hangar Cabin
Station|🚉|travel|Platform Ticket Carriage Engine Whistle Signal Timetable Guard Track Tunnel
Camping|⛺|travel|Tent Lantern Campfire Marshmallow Backpack Torch Compass Canoe Hike Trail
Beach|🏖️|travel|Sand Shell Wave Towel Bucket Spade Sunhat Seagull Pebble Surf
Winter|❄️|travel|Snowman Sled Mitten Igloo Icicle Scarf Frost Skates Cocoa Blizzard
Picnic|🧺|travel|Basket Blanket Sandwich Flask Napkin Lemonade Grapes Plate Ants Cheese
Road Trip|🚦|travel|Map Fuel Snacks Motel Sign Bridge Tunnel Highway Playlist Signpost
School|🏫|learn|Pencil Ruler Eraser Notebook Desk Teacher Lesson Homework Library Exam
Science|🔬|learn|Beaker Magnet Atom Cell Lens Laser Flask Circuit Gravity Microscope
Computer|💻|learn|Screen Mouse Keyboard Laptop Email File Cursor Pixel Folder Printer
Art Class|🖌️|learn|Paint Brush Easel Canvas Sketch Crayon Clay Palette Pastel Chalk
Show Time|🎭|learn|Stage Curtain Actor Script Costume Spotlight Audience Ticket Encore Usher
Reading|📚|learn|Book Page Chapter Author Novel Index Atlas Fable Poem Library
Office|📎|learn|Stapler Pen Paper Clip Folder Laptop Diary Mug Desk Printer
Post|✉️|learn|Letter Stamp Parcel Postcard Envelope Address Courier Mailbox Package Postbox
Music|🎵|learn|Piano Violin Flute Drum Guitar Harp Trumpet Cello Tuba Banjo
Dance|💃|learn|Waltz Tango Salsa Ballet Tap Disco Jive Swing Samba Polka
Music Styles|🎸|learn|Jazz Rock Pop Folk Blues Opera Reggae Soul Country Gospel
Sports|⚽|sport|Tennis Golf Rugby Hockey Cricket Rowing Boxing Skiing Judo Archery
Ball Games|🏀|sport|Football Basketball Netball Volleyball Baseball Softball Handball Dodgeball Polo Bowling
Gym|🤸|sport|Rope Mat Bench Hoop Skip Stretch Climb Vault Relay Whistle
Months|📅|time|January February March April May June July August September October
Days|🗓️|time|Monday Tuesday Wednesday Thursday Friday Saturday Sunday
Numbers|🔢|time|One Two Three Four Five Six Seven Eight Nine Ten
Telling Time|⏰|time|Clock Watch Sundial Hourglass Calendar Timer Stopwatch Minute Second Hour
Clothes|👕|wear|Shirt Skirt Coat Scarf Dress Jacket Sock Glove Sweater Shorts
Hats|🎩|wear|Cap Beret Bonnet Helmet Crown Beanie Bowler Sombrero Visor Hood
Shoes|👟|wear|Boot Sandal Slipper Clog Sneaker Loafer Flipflop Trainer Moccasin Wader
Gems|💎|stuff|Ruby Emerald Diamond Pearl Opal Topaz Jade Amber Garnet Sapphire
Metals|⚙️|stuff|Gold Silver Copper Iron Tin Zinc Lead Steel Bronze Brass
Cozy|🧣|feel|Snug Warm Fireplace Cushion Quilt Candle Nap Cuddle Socks Cocoa
Fast|⚡|feel|Rocket Cheetah Jet Lightning Sprint Rush Zoom Dash Bolt Racecar
Quiet|🤫|feel|Whisper Hush Silence Library Mouse Tiptoe Murmur Mute Calm Still
Loud|📢|feel|Thunder Siren Shout Drum Roar Trumpet Alarm Horn Fireworks Cheer
Bright|☀️|feel|Sun Lamp Torch Neon Sparkle Glitter Beam Flash Dazzle Glow
Cold|🧊|feel|Ice Frost Freezer Glacier Sleet Hail Shiver Chilly Frozen Snowflake
Sticky|🍯|feel|Glue Honey Tape Syrup Jam Gum Toffee Sap Paste Slime
Soft|☁️|feel|Pillow Cloud Feather Cotton Velvet Fleece Kitten Moss Fluff Wool
Round|⚪|feel|Ball Coin Wheel Ring Button Plate Clock Bubble Globe Pizza
Sharp|📌|feel|Knife Needle Pin Thorn Claw Cactus Tooth Scissors Arrow Pencil
Shiny|✨|feel|Mirror Chrome Pearl Diamond Glitter Silver Star Crystal Sequin Gold
Wet|💧|feel|Rain Puddle River Splash Sponge Dew Tears Wave Swim Drizzle
Green|🟢|color|Grass Leaf Lime Frog Pea Moss Emerald Kiwi Mint Fern
Yellow|🟡|color|Banana Lemon Canary Sunflower Butter Daffodil Custard Corn Taxi Mustard
Red|🔴|color|Cherry Tomato Ruby Strawberry Poppy Brick Rose Radish Lobster Ketchup
Blue|🔵|color|Sky Ocean Sapphire Blueberry Denim Navy Jay Bluebell Cornflower Sea
Shapes|🔷|color|Circle Square Triangle Oval Hexagon Cube Sphere Cone Pyramid Diamond
`;
export const CATS = RAW.trim().split('\n').map(l => {
  const [name, icon, family, words] = l.split('|');
  return { name, icon, family, words: [...new Set(words.trim().split(/\s+/))] };
});
