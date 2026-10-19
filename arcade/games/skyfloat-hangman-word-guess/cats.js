// Skyfloat word categories — our own hand-picked, kid-safe word lists (plain everyday words, no names or brands).
const L = (s) => s.trim().split(/\s+/);
export const CATS = {
  Animals: L(`rabbit giraffe elephant penguin dolphin turtle kangaroo zebra monkey squirrel hedgehog octopus flamingo koala panda
    tiger lion leopard cheetah camel donkey parrot ostrich beaver otter walrus hamster puppy kitten pony lizard frog goose owl eagle
    falcon raccoon badger moose reindeer buffalo gorilla butterfly ladybug snail beetle chipmunk peacock pelican chicken duckling
    lamb piglet llama alpaca sloth hippo rhino jaguar lobster crab seal swan robin sparrow`),
  Food: L(`pancake banana sandwich noodles spaghetti cheese pizza muffin cookie carrot broccoli tomato potato apple orange cherry grape
    lemon mango peach pear melon strawberry blueberry popcorn pretzel waffle yogurt omelet butter honey bagel taco burrito soup salad
    cereal biscuit cupcake pudding pumpkin cucumber avocado pepper almond peanut raisin pickle dumpling lasagna risotto smoothie
    lemonade cinnamon coconut pineapple watermelon kiwi oatmeal toast`),
  Nature: L(`mountain river forest meadow canyon valley volcano island desert glacier waterfall rainbow sunflower daisy tulip acorn
    pebble boulder breeze blossom prairie jungle orchard puddle cactus fern moss pine maple willow lagoon cliff cave hill pond
    thunder snowflake drizzle blizzard sunshine cloud storm frost tornado mushroom pinecone seashore wildflower dewdrop rose lily
    bamboo oak branch leaf garden`),
  Sports: L(`soccer tennis hockey cricket baseball football basketball volleyball skating skiing surfing rowing cycling archery
    bowling golf marathon trophy medal goalie referee whistle racket helmet stadium dribble javelin hurdle karate judo swimming
    climbing sailing badminton kayak relay sprint gymnast snowboard skateboard frisbee dodgeball champion scoreboard`),
  Space: L(`planet comet rocket galaxy asteroid astronaut orbit telescope meteor nebula satellite crater gravity moon eclipse jupiter
    saturn venus mars neptune spaceship launch starlight sunrise universe cosmos lunar solar spacesuit countdown stardust
    observatory constellation`),
  Ocean: L(`whale shark seahorse jellyfish starfish coral seaweed anchor harbor lighthouse wave tide seashell clam oyster submarine
    sailboat seagull reef island beach surfboard snorkel dolphin penguin walrus pelican lobster turtle octopus squid manatee
    stingray pufferfish shipwreck treasure compass captain`),
  Home: L(`blanket pillow kettle teapot spoon fork ladder window curtain carpet sofa lamp mirror bathtub toaster fridge oven drawer
    cupboard bookshelf doorbell staircase basket broom bucket candle clock wardrobe chimney doormat towel umbrella kitchen
    bedroom garage attic laundry teacup saucer napkin`),
  Music: L(`guitar piano violin trumpet drum flute harp banjo cello tuba melody rhythm chorus concert orchestra tambourine xylophone
    harmonica song ukulele trombone saxophone microphone lullaby anthem ballet conductor drummer keyboard`),
  Jobs: L(`teacher doctor farmer baker pilot nurse chef dentist painter builder plumber dancer singer artist author sailor gardener
    florist librarian mechanic firefighter scientist waiter tailor jeweler potter cashier engineer architect astronaut
    photographer carpenter zookeeper lifeguard`),
  Toys: L(`puzzle marble kite robot teddy domino balloon crayon jigsaw rattle doll trampoline scooter bubbles swing slide sandbox
    yoyo puppet whistle blocks paintbrush playdough rocking spinning`),
  Travel: L(`suitcase passport airport train ticket bicycle tractor helicopter airplane camper backpack journey bridge tunnel
    highway map postcard luggage station subway ferry voyage holiday hotel camping`),
};
