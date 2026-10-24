// Lantern Bay: Story Choices — the script. Book One: "The Keeper's Light".
// A tiny screenplay language, parsed by parse() below:
//   @set variant | Caption        scene change (fade, location card)
//   +id MARK / -id / -all          character enters at a mark (L, R, C) / leaves
//   > text                         narration
//   ID: text   ID[emo]: text       a line (emo: happy laugh sad angry shock think shy cheer jump)
//   ME~ text   ME~[emo] text       the player's thought
//   ? prompt                       the question above the next choices
//   * text => label {effects}      a choice; "*$25" = premium (coins), "*?" = disappears once picked
//                                  effects: kai+1 theo-2 f:flag album:key clue:key   (picking also sets flag <label>)
//   :label   => label   ?? cond => label   (cond: flag, !flag, a&b, kai>=3)
//   !light !clue k !album k !outfit k !sfx s !cliff text !end !anim id clip !hold id lantern
// {name} is the player's name. The player is never gendered.

export const CAST = {
  me:     { name: '{name}', color: '#ff6f86', char: 'p09', h: 1.68 },
  wren:   { name: 'Aunt Wren', color: '#a77bff', char: 'p05', h: 1.62, role: 'Owner of the Gull & Kettle tearoom. Seventy-eight. Sunglasses indoors, for the drama.' },
  kai:    { name: 'Kai', color: '#1fb3bf', char: 'p06', h: 1.84, role: 'Boat hire, lifeboat crew, chronic loser of shoes.' },
  theo:   { name: 'Theo', color: '#e39a2d', char: 'p14', h: 1.78, role: 'Runs Marsh & Margins bookshop. Grandson of the "thief".' },
  juno:   { name: 'Juno', color: '#ff4fa3', char: 'p04', h: 1.66, role: 'Fixes boats, bikes and anything with a motor. Gossip engine.' },
  pike:   { name: 'Mr Pike', color: '#c99a12', char: 'p08', h: 1.76, role: 'Developer. Mustard suit. Wants to buy the waterfront.' },
  vesper: { name: 'Vesper', color: '#6d6fb5', char: 'p10', h: 1.78, role: 'A stranger in a long black coat. Claims to be a painter.' },
};

// relationship album: polaroids taken from the 3D scene the moment they unlock
export const ALBUM = {
  kai_suitcase:  { who: 'kai', title: 'The Great Suitcase Rescue', cap: 'Saved from the sea by one bare foot.' },
  kai_gallery:   { who: 'kai', title: 'When the Tide Turned', cap: 'Thirty years waiting for the right company.', premium: true },
  kai_shanty:    { who: 'kai', title: 'A Very Dignified Shanty', cap: 'He had a whole speech. It rhymed.' },
  kai_lantern:   { who: 'kai', title: 'Two Wishes, One Lantern', cap: 'Neither of you will say what you wrote.', premium: true },
  theo_admiral:  { who: 'theo', title: 'The Admiral Approves', cap: 'Outranked by a cat, and fine with it.' },
  theo_letters:  { who: 'theo', title: 'Letters by the Stove', cap: 'He is terrible at voices. Do not tell him.', premium: true },
  theo_window:   { who: 'theo', title: 'The Round Window', cap: 'The best seat in town has a cushion and a cat hair.' },
  theo_stars:    { who: 'theo', title: 'An Index of Stars', cap: 'He catalogued the sky for you. Alphabetically.', premium: true },
  wren_storm:    { who: 'wren', title: 'Storm Cake', cap: 'There is history in it. Rum is how history gets around.', premium: true },
  wren_photo:    { who: 'wren', title: 'Our Secret, 1994', cap: 'Two young people and a stolen sun.' },
  wren_truth:    { who: 'wren', title: 'The Whole Truth (Nearly)', cap: 'Thirty years of holding her breath.' },
  juno_purple:   { who: 'juno', title: 'Code Purple', cap: 'The mustard suit means business.' },
  juno_swan:     { who: 'juno', title: 'The Swan', cap: 'Nobody told her not to.' },
  juno_chips:    { who: 'juno', title: 'Chips on the Harbour Wall', cap: 'Best seat in Lantern Bay. Vinegar mandatory.' },
  vesper_sketch: { who: 'vesper', title: 'A Sketch of the Tower', cap: 'Painters notice things.' },
  vesper_deal:   { who: 'vesper', title: 'Partners, Provisionally', cap: 'A handshake with charcoal on it.' },
};

// case notes (the clue journal): every clue is a stamp
export const CLUES = {
  ledger:     { icon: '📒', title: 'The Festival Ledger', text: 'Eleven pounds and a broken trestle table. The festival runs on hope.' },
  brass_key:  { icon: '🗝️', title: 'A Brass Key', text: 'Ship\'s brass, an anchor stamp. Tag: "For whoever bakes here next."' },
  wax:        { icon: '🕯️', title: 'Fresh Candle Wax', text: 'Still soft. Someone lit candles inside the lantern and let the old mirrors do the rest.' },
  teacup:     { icon: '☕', title: 'A Chipped Teacup', text: 'Purple rim, moon-shaped chip. From the Gull & Kettle.' },
  logbook:    { icon: '📖', title: 'The 1994 Logbook', text: '"THE HEART IS SAFE. IT\'S GONE WHERE THE LIGHT GOES HOME."' },
  insurance:  { icon: '📜', title: 'The Insurance Claim', text: 'The lens was insured for a fortune. The Trust got paid. Its chairman: Archibald Pike.' },
  sketch:     { icon: '🎨', title: 'Vesper\'s Sketch', text: 'The tower, perfect and eerie. At its base: a little door that isn\'t there anymore.' },
  photo:      { icon: '📷', title: 'Our Secret, 1994', text: 'Wren and Elias, holding the Lantern Heart. "Our secret. Forever. — E."' },
  wren_story: { icon: '🌧️', title: 'The Night of the Storm', text: 'Someone tried to steal the Heart. It cracked. Elias hid it, then rowed out for Manny Mendes.' },
  card:       { icon: '🪪', title: 'Halloran & Finch', text: 'Vesper Hale, marine insurance investigator. Her firm wants its money back.' },
};

export const OUTFITS = {
  festival: {
    prompt: 'The Lantern Festival. Everybody dresses up. The vicar wears sequins.',
    looks: [
      { id: 'own', name: 'Just Me', note: 'What you arrived in', cost: 0, hue: 0, sat: 1, bri: 1, items: {} },
      { id: 'knit', name: 'Harbour Knit', note: 'Cosy, muted, a bobble hat', cost: 0, hue: 0.98, sat: 0.75, bri: 0.95, items: { head: 'h02' } },
      { id: 'lantern', name: 'Lantern Gold', note: 'Warm as a window at night', cost: 0, hue: 0.04, sat: 1.3, bri: 1.12, items: {} },
      { id: 'masq', name: 'Midnight Masquerade', note: 'Deep, moody + a carnival mask', cost: 40, hue: 0.94, sat: 1.15, bri: 0.82, items: { face: 'f04' } },
      { id: 'starlit', name: 'Starlit Keeper', note: 'Glowing + an old ship\'s lantern', cost: 40, hue: 0.06, sat: 1.25, bri: 1.05, items: { hand: 'w07' } },
    ],
  },
};

// the chapter map: Book One (chapters 1–3 written, 4–8 outlined)
export const BOOK = {
  title: 'The Keeper\'s Light',
  chapters: [
    { n: 1, title: 'Low Tide, High Hopes', place: 'The harbour', icon: '🧳', teaser: 'A runaway suitcase, a purple tearoom, a man in a mustard suit — and a lighthouse that has been dark for thirty years.' },
    { n: 2, title: 'The Keeper\'s Logbook', place: 'The lighthouse', icon: '📖', teaser: 'A cut chain, a chipped teacup and a torn-out page. Somebody climbed 112 steps in the dark.' },
    { n: 3, title: 'Lanterns on the Water', place: 'The festival', icon: '🏮', teaser: 'Four hundred lanterns, one confession, and a date you\'ll have to choose.' },
    { n: 4, title: 'Where the Sea Keeps Secrets', place: 'The sea cave', icon: '🌊', teaser: 'Barnaby Pike explains. Mostly. The brass key finds its door.', soon: true },
    { n: 5, title: 'Sea Holly House', place: 'The care home', icon: '🌼', teaser: 'Elias Marsh remembers a storm, a promise and a name.', soon: true },
    { n: 6, title: 'Storm Season', place: 'The open sea', icon: '⛈️', teaser: 'The lifeboat goes out. Not everyone wants it to come back.', soon: true },
    { n: 7, title: 'The Vote', place: 'The town hall', icon: '🗳️', teaser: 'Eleven hundred people, one waterfront, and a cake that could change everything.', soon: true },
    { n: 8, title: 'Where the Light Goes Home', place: 'The lantern room', icon: '💡', teaser: 'The Lantern Heart shines again. For someone, it means goodbye.', soon: true },
  ],
};

export const SCRIPT = String.raw`
## 1 | Low Tide, High Hopes
@harbor dusk | Lantern Bay · The harbour, dusk
> The last bus to Lantern Bay leaves you at the end of the world. Or at least the end of the harbour road, which around here is the same thing.
> Gulls. Salt. Painted houses leaning together like old friends sharing a secret. And out on the point, a lighthouse that hasn't been lit in thirty years.
+me C
ME~[think] Okay. You quit the restaurant. You sold the stand mixer. You are a free agent with one suitcase and zero plans. This is fine.
!sfx roll
> Your suitcase disagrees. It rolls down the slipway, picking up speed, heading for the sea with the confidence of something that has never been taught to swim.
ME[shock]: No — no, no, no — that's everything I own!
+kai R
!sfx thud
> A bare foot stops it, an inch from the water.
KAI[happy]: Easy. She just wanted to see the ocean. They all do, first night.
KAI: Kai Mendes. I run the boat hire, crew the lifeboat, and occasionally rescue luggage. Free of charge. Mostly.
!album kai_suitcase
? First impressions. What do you say?
* "My hero. Do you rescue people too, or just suitcases?" => k_flirt {kai+1}
* "Thank you. Genuinely. That suitcase is my whole life." => k_kind {kai+1}
* "Do you always sneak up on people barefoot?" => k_sass {kai+0}
:k_flirt
KAI[laugh]: People are harder. They argue. Suitcases just go quiet and let you carry them.
KAI[shy]: Though for you I'd make an exception. You've got a very rescuable face.
=> k_after
:k_kind
KAI: Your whole life fits in one suitcase? That's either very zen or a very sad story.
ME: Can it be both?
KAI[happy]: In Lantern Bay? It's usually both.
=> k_after
:k_sass
KAI[laugh]: Shoes are for people who don't live on a dock. Also, I lost them.
KAI: Long story. Involves a seal. The seal won.
=> k_after
:k_after
KAI: Let me guess. Wren Pennywhistle's famous relative. The pastry chef from the city.
ME[shock]: How do you know that?
KAI: Population eleven hundred. Every single one of them already knows you're here. Wren's been telling people for a week.
KAI: She said, and I quote: "If anyone's rude to my favourite relative, I'll put salt in their sugar bowl."
ME~[happy] That sounds exactly like Aunt Wren.
KAI: Gull and Kettle's at the end of the quay. Can't miss it. It's the only building in town that's purple on purpose.
-kai
@tearoom evening | The Gull & Kettle · Evening
> The Gull & Kettle smells of cinnamon, lemon and forty years of gossip. Every teacup is a different pattern. Every chair has an opinion.
+me L
+wren R
WREN[cheer]: There you are! My favourite relative. Don't tell your mother, she thinks it's her.
ME: Aunt Wren! You're wearing sunglasses. Indoors. At night.
WREN: Darling, I'm seventy-eight. The sunglasses aren't for the sun. They're for the drama.
WREN: Now sit. Eat. You look like someone who's been living on staff meals and spite.
? She's looking at you over the sunglasses. How are you, really?
* "Honestly? Burnt out. Like a croissant in a bad oven." => w_honest {wren+1}
* "Great! Totally great! Never better!" => w_brave
* "Let's talk about you. Why the urgent letter?" => w_letter
:w_honest
WREN[sad]: Oh, petal. Croissants come back, you know. They just need a cooler oven and someone who knows what they're doing.
WREN[happy]: Lucky for you, that's me. And the oven. The oven is eighty years old and it has never burnt anything it didn't mean to.
=> w_after
:w_brave
WREN[laugh]: Three "greats" and a "never better." Darling, I invented lying cheerfully. You're an amateur.
WREN: We'll come back to it. With cake.
=> w_after
:w_letter
WREN: Straight to business. Good. You get that from me.
=> w_after
:w_after
WREN: Here's the situation. The Harbour Trust is broke. The fish market roof is held up by optimism and one very determined beam.
WREN: And a man called Barnaby Pike wants to buy the whole waterfront. My tearoom. The boatyard. The lighthouse.
ME[think]: What would anyone do with a lighthouse?
WREN[angry]: A "luxury spa experience." Hot stones. Cucumber water. A gift shop selling tiny lighthouses for forty dollars.
WREN: Over my dead body. And I've told him I intend to live to a hundred and four, purely out of spite.
WREN: The town votes on his offer after the Lantern Festival. Three weeks. Until then I need someone in that kitchen who can make this place so wonderful nobody dares sell it.
ME: No pressure, then.
WREN[happy]: Oh, enormous pressure. But you're a pastry chef. You do your best work under a crust.
+juno C
!sfx door
JUNO[shock]: WREN. Code red. Code purple. Pike's car is outside and he's wearing the mustard suit.
WREN: The mustard suit. He means business.
JUNO[happy]: Hi! Juno. I fix boats, bikes and anything with a motor. Hearts too, if they've got a motor.
ME: Does everybody in this town know my CV?
JUNO[laugh]: We know your shoe size. Wren's been unbearable.
!album juno_purple
-juno
+pike C
PIKE[happy]: Mrs Pennywhistle! And this must be the famous pastry chef. Barnaby Pike, Pike Coastal Developments. Delighted, delighted.
PIKE: I hear you've come to save the tearoom. Marvellous. Very plucky. I love plucky. I've built three marinas on plucky.
? Mr Pike is smiling with every one of his very expensive teeth.
* Offer him a scone. Kill him with kindness. => p_kind {wren+1}
* "The tearoom isn't for sale. Neither is my aunt." => p_sharp {wren+1}
*$20 Serve him Wren's legendary Storm Cake. A negotiating tactic with icing. => p_cake {wren+2 album:wren_storm}
:p_kind
> He takes a bite. His eyes close, briefly, against his will.
PIKE[shock]: That is... unreasonably good. Hm. This complicates my spreadsheet.
=> p_after
:p_sharp
PIKE[laugh]: Ha! Fire. I like fire. Fire is very on-brand for a lighthouse.
=> p_after
:p_cake
> Wren raises one eyebrow above the sunglasses. Then she cuts a slice of Storm Cake: dark ginger, salted caramel, a crack of white icing like lightning.
PIKE: I couldn't possibly—
> He could. He does. Twice.
PIKE[shock]: Good heavens. Is there rum in this?
WREN: There's history in it, Mr Pike. Rum is just how history gets around.
=> p_after
:p_after
PIKE: The offer stands, Mrs Pennywhistle. Generous. Getting less generous every week. Nostalgia doesn't fix roofs.
WREN: No. But I've seen it sink a few marinas.
-pike
WREN: Now. An errand, darling. The festival ledger lives at Marsh and Margins, the bookshop on Gull Lane. Theo keeps it for me.
WREN: Be kind to Theo. He's shy, he's clever, and this town has been unkind to his family for thirty years.
ME: Why?
> She takes off her sunglasses. That's how you know it's serious.
WREN[sad]: Ask me another time. Go on, before he closes and pretends he didn't.
@bookshop evening | Marsh & Margins · Gull Lane
> Marsh and Margins is the kind of bookshop where the books outnumber the floorboards. A brass bell rings. Somewhere in the dark, something large and furry declines to get up.
+me L
+theo R
THEO: We're closed.
ME: The sign says open.
THEO: The sign is an optimist. I'm a realist.
THEO[shock]: Oh. You're — the pastry chef.
ME: Does everybody—
THEO: Wren put a notice in the parish newsletter. With a photo. You were eleven and missing a tooth.
ME~ I am going to have words with Aunt Wren.
THEO: Theo Marsh. The ledger's here somewhere. Under the poetry. Or under the cat. The cat's name is the Admiral. He outranks me.
!album theo_admiral
? Make conversation.
* "What are you reading?" => t_books {theo+1}
* "Marsh... like the lighthouse keeper? Wren said—" => t_elias
* "The Admiral looks like he runs this place." => t_cat {theo+1}
:t_books
THEO[happy]: Maps of places that aren't there anymore. Harbours that silted up. Islands that washed away.
THEO: I like knowing where things were. It's comforting. Like proof.
ME: Proof of what?
THEO[think]: That things don't just vanish. They go somewhere.
=> t_after
:t_elias
THEO[angry]: Ah. That.
THEO: Yes, Elias Marsh is my grandfather. Yes, he was keeper when the Lantern Heart disappeared. No, he didn't steal it. And no, I don't know where it is.
THEO[sad]: Sorry. That's the speech. I've had thirty years to rehearse it. Well. Twenty-nine. I wasn't very articulate at one.
ME: For what it's worth, I didn't come here to accuse anybody. I came for a ledger.
> A pause. Something in his shoulders lets go.
THEO[shy]: ...Right. The ledger. Yes. Sorry. Ledger.
=> t_after
:t_cat
THEO[laugh]: He does. He's the only one here who's ever turned a profit. He charges customers a stare, and they buy something to escape it.
=> t_after
:t_after
> He hands you a leather ledger that smells of salt and old paper. Your fingers brush. His are ink-stained. Of course they are.
!clue ledger
THEO: Tell Wren the festival committee has eleven pounds and a broken trestle table. She'll know what to do. She always does.
THEO: And walk safe. The harbour gets dark. Darker than it used to.
-theo
@harbor night | The quay · Night
> Night comes down soft over the bay. The water is black glass. The houses glow orange. The lighthouse stands on the point like a pale ghost that forgot what it was waiting for.
+me C
? The long way home, along the quay...
* Kai's boatyard light is still on. Say goodnight. => n_kai {kai+1}
* Go back to the bookshop. You "forgot your scarf". => n_theo {theo+1}
* Walk alone and enjoy the quiet. => n_alone
:n_kai
-me
+me L
+kai R
KAI[happy]: Back already? The suitcase missed me, didn't it.
KAI: See the lighthouse? My dad says it used to sweep right across our kitchen every night. Like the whole town was being tucked in.
KAI[sad]: Been dark my whole life. Feels like a song with the last note missing.
=> n_flash
:n_theo
-me
+me L
+theo R
THEO: You didn't forget a scarf. You're not wearing a scarf. You weren't wearing one before.
ME: I'm a very thorough liar.
THEO[happy]: Come on. I'll walk you to the quay. The cobbles are treacherous. Like people, but mossier.
=> n_flash
:n_alone
ME~ Silence. Real silence, the kind the city never sells. Just water talking to the stones.
ME~[happy] Maybe this is exactly what I needed. A place where nothing ever happens.
=> n_flash
:n_flash
!light
> And then the lighthouse blinks.
> Once. Twice. Three times. Three long arms of gold sweep across the water, over the rooftops — and over you.
ME[shock]: Did... did that just—
?? n_kai => n_fk
?? n_theo => n_ft
ME~[shock] All along the quay, windows fly open. A dog barks. Somebody drops a saucepan.
=> n_fw
:n_fk
KAI[shock]: That's not possible. That light's been dead for thirty years. The door's chained. The only key hangs at the lifeboat station.
=> n_fw
:n_ft
THEO[shock]: That's the keeper's signal. Three long. It means "all safe, come home."
THEO[sad]: Only my grandfather ever used it.
=> n_fw
:n_fw
+wren LL
> Footsteps behind you. Aunt Wren, in her dressing gown and pearls, staring at the dark tower.
WREN[sad]: Three flashes. Oh, Elias. You stubborn old fool.
ME: Aunt Wren? What did you just say?
> She turns, and the smile is back. Bright, brittle, perfectly lipsticked.
WREN[happy]: Nothing, darling. Go to bed. Pretend you didn't hear that.
!cliff What does Aunt Wren know about the light — and who climbed a dead lighthouse in the dark?
!end

## 2 | The Keeper's Logbook
@tearoom morning | The Gull & Kettle · Morning
> By seven in the morning, the whole town has a theory.
+me L
+juno R
JUNO: Okay. Theories. Mrs Abernathy says ghost. The fishermen say Pike, publicity stunt. The vicar says "teenagers", but the vicar says that about everything. Including weather.
JUNO[happy]: My theory? Aliens. Not because it makes sense. Because it would be fun.
ME: Where's Wren?
JUNO[think]: "Getting her hair done." At six-thirty. On a Tuesday. In a town with no hairdresser.
ME~[think] She's avoiding me.
> Reaching for the good tea, you find something taped under the tin: a small brass key on a faded ribbon. The tag, in Wren's loopy hand, says "For whoever bakes here next."
!clue brass_key
? What do you do with the key?
* Pocket it. Ask Wren later, when she can't escape. => k1
* Show Juno. Two heads are better than one. => k2 {juno+1}
:k2
JUNO[shock]: Ooh. That's an old one. Ship's brass. See the little anchor? Harbour Trust property. I'd bet my best wrench on it.
JUNO: Whatever it opens has been waiting a long time.
=> k_after
:k1
ME~ Into the apron pocket. Wren taught you that: never show your hand before the soufflé has risen.
=> k_after
:k_after
+kai C
KAI: Morning. Has anyone seen the lighthouse key? Asking for me. Because it's gone.
ME[shock]: Gone?
KAI: Only copy. Same hook at the lifeboat station for thirty years. Today: one empty hook and a very confused lifeboat crew.
JUNO[laugh]: Aliens. I'm telling you.
KAI: The Trust wants someone to go up and check the tower. Officially. Want to come? You look like a person with questions.
-juno
? Go up the lighthouse with Kai?
* "I was born with questions. Lead the way." => lh {kai+1}
* "Only if you promise there's no ghost." => lh_ghost {kai+1}
:lh_ghost
KAI[laugh]: No promises. But if there's a ghost, I'll protect you. I'm a very loud screamer.
=> lh
:lh
@lighthouse day | The lighthouse · The lantern room
> The chain on the lighthouse door has been cut clean through. Bright metal. A fresh cut.
> Up and up the spiral stairs — one hundred and twelve, Kai counts every one out loud — until the lantern room opens around you like the inside of a diamond.
+me L
+kai R
KAI[think]: Huh. I've never been up here. Not once. Grew up staring at it every day and never climbed it.
ME: Why not?
KAI: Didn't feel right. Like walking into somebody else's church.
:look
?? wax&teacup&logbook => l_done
? Look around the lantern room.
*? The empty pedestal in the middle. => l_ped
*? A teacup on the windowsill. => l_cup
*? The drawer of the old keeper's desk. => l_desk
:l_ped
> A great iron pedestal, built to hold a lens the size of a person. Empty. Around its base, a ring of candle wax, still soft under your fingernail.
!clue wax
ME[think]: Somebody was here last night. They lit candles inside the lantern. No real light — just candles, and the old mirrors did the rest.
KAI: Clever. And patient. You'd have to know exactly how this room works.
=> look
:l_cup
> A teacup. Bone china, purple rim, a chip on the handle shaped like a little moon.
ME[shock]: That's from the Gull and Kettle. I washed thirty of these yesterday. I'd know that chip anywhere.
!clue teacup
KAI[think]: So either your aunt's been climbing lighthouses at midnight...
ME: ...or somebody wants it to look like she has.
=> look
:l_desk
> The drawer sticks, then gives. Inside: the keeper's logbook for 1994. Every page filled in neat, cramped capitals. Weather. Ships. Oil.
> The last page has been torn out. All that's left is the ghost of hard-pressed handwriting on the page beneath.
ME: There's writing pressed into this page. If I had a pencil...
KAI[happy]: Lifeboat crew. Always prepared. Except for shoes.
> He produces one from behind his ear. You shade the page, and letters rise out of the grey like something surfacing:
> "THE HEART IS SAFE. IT'S GONE WHERE THE LIGHT GOES HOME."
!clue logbook
=> look
:l_done
> Kai pushes open the little door to the gallery. Wind rushes in, smelling of salt and distance.
KAI: Come and see. Best view in the county, and nobody's looked at it for thirty years.
> The whole bay lies below you. The purple tearoom. Boats scattered like toys. The town climbing the hill, one chimney at a time.
KAI: My dad was out there the night of the storm. 1994. His trawler lost power past the reef.
KAI: The light was already dead. Lens gone. Everybody says Elias Marsh stole it and ran.
KAI[sad]: But it was Elias who rowed out into that storm and brought my dad home. In a rowing boat. At seventy. That's not what thieves do.
? The wind is loud up here. You have to stand close to hear him.
* Take his hand. "Then maybe it's time someone found out what really happened." => g1 {kai+2}
* "Your dad's alive because of Elias. Does Theo know that?" => g2 {kai+1 theo+1}
*$30 Stay on the gallery and watch the tide turn together. => g3 {kai+3 album:kai_gallery}
:g1
> He looks down at your hand like a rare bird has landed on him and he's afraid to move.
KAI[shy]: ...Yeah. Yeah, maybe it is.
=> g_after
:g2
KAI: Everybody knows. Nobody says. That's the Lantern Bay way. We're very good at not saying things.
KAI[happy]: Maybe you could be bad at it. For all of us.
=> g_after
:g3
> You sit with your legs through the railings like a pair of kids. Kai points out every boat and tells you its secret: which one is haunted, which one is in love with which.
> The tide turns. The light turns gold. Neither of you mentions how long you've been sitting there.
KAI[shy]: Thirty years I never came up here. Turns out I was waiting for the right company.
=> g_after
:g_after
-kai
@bookshop day | Marsh & Margins · Late morning
+me L
+theo R
THEO[think]: You've been up the lighthouse. You've got rust on your sleeve and that look people get when they've found something.
ME: Is this your grandfather's handwriting?
> Theo takes the logbook as if it might crumble. He reads the pressed words. Then again. His glasses fog, and he takes them off, very carefully, to clean them.
THEO[sad]: "Where the light goes home." He used to say that when I was small and scared of the dark. "Don't worry, Theo. The light always goes home."
ME: Theo... where is he now?
THEO: Sea Holly House. A care home, two towns over. His memory comes and goes like the tide. Mostly goes.
THEO[laugh]: I visit on Sundays. Some Sundays he knows me. Some Sundays he thinks I'm a very polite burglar.
THEO[sad]: But not once, in thirty years, has he said where the lens went. Only that it's safe.
? Theo is holding the logbook like it's the last warm thing in the world.
* "Then let's prove it. Together. I'm good at fixing things that collapse." => b1 {theo+2}
* "Who needed everyone to believe Elias was a thief?" => b2 {theo+1}
*$30 Sit with Theo by the stove and read Elias's old letters. => b3 {theo+3 album:theo_letters}
:b1
THEO: You fix soufflés.
ME: Soufflés are the hardest thing in the world to fix. Reputations are easy by comparison.
THEO[happy]: ...All right. Together.
> And there it is — a real smile, quick and crooked, like he's out of practice.
=> b_after
:b2
> He goes very still.
THEO[think]: Someone who needed a thief. The Lantern Heart was insured, you know. For a fortune. And the Harbour Trust got paid.
THEO: The man who ran the Trust back then was a certain Archibald Pike.
ME[shock]: Pike? As in—
THEO: Barnaby's father. Small towns. Everyone is somebody's somebody.
=> b_after
:b3
> He lights the little stove at the back of the shop. You sit on the rug with a biscuit tin of letters: fifty years of Elias's handwriting. Shopping lists. Weather notes. A poem about a gull with "a criminal face".
> Theo reads the funny ones aloud and does the voices. He is terrible at voices. You laugh until the Admiral leaves the room in protest.
THEO[shy]: I haven't heard anyone laugh in here for a long time. The books like it. So do I.
> At the bottom of the tin: an unsent letter. "Archie — I know what you did with the claim. I'll keep quiet for Wren's sake. Not for yours. — E."
ME[shock]: Archie?
THEO: Archibald Pike. He ran the Harbour Trust. Barnaby's father.
=> b_after
:b_after
!clue insurance
-theo
@harbor afternoon | The quay · Afternoon
> On the quay, a stranger in a long black coat is sketching the lighthouse. Charcoal on her fingers. A gaze like a closed door.
+me L
+vesper R
VESPER: You're the baker. You've been up the tower.
ME[think]: You're very well informed for a tourist.
VESPER: I'm a painter. Painters notice things. Light, mostly. And who's chasing it.
VESPER: So tell me. Did you find the lens? The famous Heart?
? She's still drawing. She hasn't looked down once.
* Tell the truth: no lens, just a torn-out page. => v1 {vesper+1}
* Lie smoothly: "Just pigeons. And a lot of stairs." => v2
* "What kind of painter asks about a lens worth a fortune?" => v3 {vesper+1}
:v1
VESPER[happy]: Honest. How rare.
> She tears a page from her sketchbook — the tower, rendered in perfect, eerie detail — and hands it to you.
VESPER: For your trouble. Look at the base of the tower. Painters notice things.
!clue sketch
!album vesper_sketch
=> v_after
:v2
VESPER[laugh]: Pigeons. Of course.
> She smiles like a cat watching another cat tell a lie.
=> v_after
:v3
> For a moment the closed door opens a crack. Then it shuts again.
VESPER: The kind who gets paid either way. Good afternoon, baker.
=> v_after
:v_after
-vesper
ME~[think] She never told me her name.
@tearoom night | The Gull & Kettle · After closing
+me L
+wren R
WREN: You're late. And you've got lighthouse rust on your sleeve and that look on your face.
ME: Theo said that too.
WREN: Theo's very observant. He takes after his grandfather.
ME: Aunt Wren, the teacup in the lantern room was one of ours. You were up there. Weren't you?
> She sets the teapot down hard enough to make the spoons jump.
WREN[angry]: I am seventy-eight years old. I do not climb a hundred and twelve stairs at midnight to play with candles.
ME: Then who does?
WREN[sad]: Darling, some doors are closed because what's behind them is sleeping. Let it sleep.
? She won't look at you.
* "Some doors are closed because someone's hiding behind them." => w2a
* "All right. But when you're ready, I'm here. With cake." => w2b {wren+2}
:w2a
> For one terrible second she looks every day of her age.
WREN[sad]: ...Go to bed, darling. Please.
=> w2_after
:w2b
> Her hand finds yours across the counter, light as a bird.
WREN[happy]: You're a good egg. The best in the box.
=> w2_after
:w2_after
-wren
> Wren goes up to bed. The tearoom ticks and creaks and settles, like an old dog turning round three times.
> You're putting away her famous recipe box — battered, sacred, untouchable — when a card slips out from behind "Storm Cake".
> It isn't a recipe. It's a photograph.
> Two young people in front of the lighthouse. "1994" in the corner. A woman in enormous sunglasses. A man in a keeper's coat.
> And between them, cradled like a newborn, a great glass lens blazing with stolen sunlight.
!clue photo
!album wren_photo
ME[shock]: That's Wren. And that's... the Lantern Heart.
> On the back, in faded ink: "Our secret. Forever. — E."
!cliff Wren and Elias — together, holding the missing Lantern Heart. Was Aunt Wren in on it all along?
!end

## 3 | Lanterns on the Water
@tearoom morning | The Gull & Kettle · Festival morning
+me L
+wren R
WREN: You found the photograph.
ME: You left it in the recipe box. Behind Storm Cake. Where you knew I'd look.
WREN[sad]: I may have wanted to be found out. A little. Keeping a secret for thirty years is exhausting. Like holding your stomach in for three decades.
? Where do you start?
* Gently. "Tell me about him." => s1 {wren+2}
* Directly. "Did you two take the lens?" => s2 {wren+1}
:s1
WREN[happy]: Elias. Terrible jokes, wonderful hands. He could fix a clock by looking at it sternly.
WREN[sad]: We were to be married that autumn. Then the storm came, and the lens, and he was a thief, and I was a coward.
=> s_after
:s2
> She takes off her sunglasses.
WREN: We didn't take it, darling. We saved it.
=> s_after
:s_after
WREN: The night of the storm, someone tried to steal the Heart. Elias caught them on the stairs. In the struggle, the lens slipped. Cracked. Only a hairline — but a cracked lens is a dead lens.
WREN: Elias knew if it was found, they'd claim it lost, sell it in pieces and let the tower fall into the sea. So he hid it.
WREN: Then he rowed out into that storm for Manny Mendes, and came home to find himself called a thief.
WREN[sad]: And I said nothing. The person on the stairs promised to ruin us both if I did. I was young and frightened and very, very stupid.
ME: Who was on the stairs?
> A long pause. The kettle starts to sing, and she lets it.
WREN: I promised Elias I'd never say. I keep my promises, darling. Even when they're inconvenient. Especially then.
WREN: But I'll tell you this. That key opens the place where the light goes home. I never had the courage to use it.
WREN[happy]: Maybe you will.
!clue wren_story
!album wren_truth
-wren
@harbor festival | The quay · Festival day
> Lantern Bay has been transformed. Paper lanterns hang from every lamppost, every mast, every washing line. Someone has knitted a scarf for the harbour bollards.
+me L
+juno R
JUNO[cheer]: Festival day! Wren's got me hanging four hundred lanterns. I've hung two hundred. I've fallen off one ladder. Morale is high.
JUNO: Also I welded a swan for the regatta. Don't ask why. Okay. Ask why.
ME[laugh]: Why?
JUNO[happy]: Because nobody told me not to. That's my whole philosophy. It's got me into a lot of trouble and three very good boats.
!album juno_swan
JUNO[think]: Okay. Important question. What are you wearing tonight? Everybody dresses up for the Lantern Festival. The vicar wears sequins. It's a whole thing.
!outfit festival
?? look_masq => o_masq
?? look_starlit => o_star
?? look_hero => o_hero
JUNO[cheer]: Stop. You look like the main character. Which you are. Obviously.
=> o_after
:o_masq
JUNO[shock]: A mask? Oh, you're dangerous. Half this town is going to fall in love with you and the other half is going to accuse you of something.
=> o_after
:o_star
JUNO[shock]: A ship's lantern? At the Lantern Festival? That's not an outfit, that's a statement. That's a thesis.
=> o_after
:o_hero
JUNO[cheer]: Okay, that is so completely you it hurts. Nobody else could pull it off. Nobody else would try.
=> o_after
:o_after
-juno
+vesper R
> The stranger in the black coat is waiting by the harbour steps. This time, she isn't drawing.
VESPER: Baker. A word.
> She holds out a business card. Halloran and Finch, Marine Insurance Investigations. Vesper Hale.
VESPER: I'm not a painter. Well — I'm a bad painter, and a very good investigator.
!clue card
VESPER: In 1994, my firm paid out a great deal of money for a lens "lost in a storm". Someone got paid for a lens that was never lost. My firm would like its money back. With thirty years of interest.
?? v1 => vt_trust
VESPER[laugh]: You lied to me about the pigeons, by the way. You blink when you lie. It's adorable. Unhelpful, but adorable.
=> vt_ask
:vt_trust
VESPER: You were honest with me, so I'll return the favour. The claim was signed by the chairman of the Trust. Archibald Pike.
:vt_ask
? She's offering a handshake. Charcoal on the fingers.
* Shake it. "If we find the lens, Elias's name gets cleared. Deal?" => vt1 {vesper+2 album:vesper_deal}
* Keep her at arm's length. "I'll think about it." => vt2
:vt1
VESPER[happy]: Partners. Provisionally. Don't make me regret it — I bill by the hour.
=> vt_after
:vt2
VESPER: Think fast, baker. Tonight the whole town will be looking at the water. That's exactly when people stop watching towers.
=> vt_after
:vt_after
-vesper
@harbor stall | The Gull & Kettle stall · Afternoon
> Wren has dragged two tables onto the quay and declared them "the stall". You bake from dawn: lemon drizzle, cinnamon knots, and a tray of tiny lighthouse biscuits with gold-leaf lamps.
+me L
+juno R
JUNO[shock]: They're gone. All of them. Mrs Abernathy bought eleven. She cried a bit. She said they tasted like 1987.
ME[laugh]: Is that good?
JUNO[happy]: 1987 was a VERY good year for her. Ask her about the drummer.
-juno
+pike R
> A shadow falls across the empty tray. Mustard suit. Today, a mustard scarf to match.
PIKE: Sold out? Already? Hm. That's... very bad for my spreadsheet.
PIKE[think]: You know, my father used to take me up that lighthouse. When I was small. Before.
ME: Before what?
PIKE[sad]: Before it went dark. Before everything in this town went a bit... sideways. He'd let me hold the oil can. I thought it was the most important job in the world.
> He looks out at the tower for a long moment. For once, he isn't selling anything.
? This is a different Mr Pike. Or the same one, with the lights off.
* Give him the last biscuit — the one you saved for yourself. => pk1 {pike+2}
* "If you loved it, why turn it into a spa?" => pk2 {pike+1}
* "Nice try. You're not getting a discount." => pk3
:pk1
PIKE[shock]: A lighthouse. With a little gold lamp. Oh, that's... that's unkind of you. That's very unkind. Thank you.
> He eats it in two bites and pretends he has something in his eye. Seagull dust, he says. It's a known local hazard.
=> pk_after
:pk2
PIKE[think]: Because somebody has to fix the roof, and nobody else has offered. A spa with a lighthouse is still a lighthouse. A ruin is just a ruin.
PIKE: At least, that's what I tell the bank.
=> pk_after
:pk3
PIKE[laugh]: Ha! Wren's taught you well. Fine. Fine! I'll be at the launch. Try not to sell the sea while I'm gone.
=> pk_after
:pk_after
-pike
ME~[think] Candle wax on the stall cloth where he leaned. Fresh. Probably nothing. Probably.
> The sun goes down. Somewhere a brass band begins, slightly out of tune and entirely sincere.
? Two people asked Juno where you'd be tonight. Who do you watch the lantern launch with?
* Kai — out on the water, in his boat, in the middle of the regatta. => date_kai {kai+1}
* Theo — the round window above the bookshop, the best seat in town. => date_theo {theo+1}
* Juno — the harbour wall, with chips. Best friends first. => date_juno {juno+2}
:date_kai
@harbor launch | The end of the pier · Lantern launch
+me L
+kai R
KAI[happy]: You came. I had a whole speech prepared in case you didn't. It was very dignified. It rhymed. There was a shanty.
ME[laugh]: Let's hear the shanty.
KAI[shy]: Absolutely not. It's for emergencies only.
!album kai_shanty
> Around you, the boats are carrying their lanterns out onto the dark water. Each one holds a wish. That's the rule. You write it, you don't say it, you let the sea decide.
KAI: So. What are you wishing for?
? You hold your lantern over the water.
* "For the lighthouse to shine again." => wk1 {kai+1}
* "That's a secret. But you might be in it." => wk2 {kai+2}
*$35 Share the last lantern with Kai. One lantern, two wishes. => wk3 {kai+3 album:kai_lantern}
:wk1
KAI[happy]: Same. Well. Close. Mine had a person in it too.
=> d_end
:wk2
> Kai laughs, and then stops laughing, and looks at you like the tide just turned again.
KAI[shy]: That's not fair. Now I have to wish for something that good.
=> d_end
:wk3
> You both hold the last lantern. You both write. Neither of you reads the other's side. You let it go together, and it bobs off between the boats, glowing like a secret.
KAI[shy]: Whatever you wrote... I hope the sea is paying attention.
=> d_end
:date_theo
@bookshop night | Marsh & Margins · The round window
+me L
+theo R
THEO[shy]: You came. I tidied. Well. I moved the piles into different piles. The Admiral is furious.
> The round window above the shop looks over the whole harbour. Four hundred lanterns drift across it like someone spilled a jewellery box into the sea.
!album theo_window
THEO: My grandfather used to bring me here. He said the lanterns were the town apologising to the lighthouse for leaving it alone in the dark.
THEO[sad]: This year it feels like the town is apologising to him.
? He's not looking at the lanterns anymore. He's looking at you.
* "We're going to clear his name, Theo. I promise." => wt1 {theo+2}
* "You know, you're much less of a realist than your sign says." => wt2 {theo+2}
*$35 Ask Theo to show you the stars he's catalogued from this window. => wt3 {theo+3 album:theo_stars}
:wt1
THEO[happy]: People have promised that before. You're the first one I've believed.
=> d_end
:wt2
THEO[laugh]: Don't tell anyone. I have a reputation for gloom to maintain.
=> d_end
:wt3
> He pulls out a notebook: thirty years of night skies, every star named, numbered, cross-referenced. There's a page at the end with today's date and nothing on it yet.
THEO[shy]: I was saving that page. For something worth writing down.
=> d_end
:date_juno
@harbor launch | The harbour wall · Lantern launch
+me L
+juno R
JUNO[cheer]: Chips! Vinegar, salt, and a pickled egg, because I'm not an animal. Well. I'm a small animal.
!album juno_chips
JUNO: You know what? I'm glad you came. This town needed somebody who asks questions. We've been not-asking for thirty years. It's bad for the skin.
? Juno offers you the pickled egg. It's a sign of deep friendship.
* Accept the egg. Friendship is sacrifice. => wj1 {juno+2}
* "Juno. Who do YOU think was on those stairs?" => wj2 {juno+1}
:wj1
JUNO[cheer]: I knew it. I KNEW you were one of us.
=> d_end
:wj2
JUNO[think]: Honestly? Someone with a key. And the only people with keys in 1994 were the keeper, the Trust... and whoever the Trust trusted.
=> d_end
:d_end
@harbor launch | The quay · The lantern launch
> The last lanterns lift off the water and the whole town goes "ooh" in one long breath, the way towns have done for hundreds of years.
+me C
!light
> And then the lighthouse answers.
> Three long flashes. "All safe. Come home."
> The crowd falls silent. Then everybody is running for the point.
ME[shock]: Not this time. Whoever you are — I'm coming up.
@lighthouse night | The lighthouse · The lantern room
> One hundred and twelve stairs, two at a time. The lantern room door stands open. Gold light spills down the steps like honey.
> Someone is standing in the middle of it all, holding an old ship's lantern.
+me L
!hold pike lantern
+pike R
> He turns. Mustard suit. Candle wax on his very expensive shoes.
?? date_kai => cl_k
?? date_theo => cl_t
=> cl_go
:cl_k
> Behind you, Kai skids up the last stair, breathless, still holding the lantern you didn't launch.
=> cl_go
:cl_t
> Behind you, Theo arrives at a run, glasses crooked, the Admiral's hair all over his good coat.
:cl_go
PIKE[shock]: Ah.
PIKE: I can explain. Mostly.
!cliff Barnaby Pike has been lighting the lighthouse. But why would the man who wants to buy it be the one keeping it alive?
!end
`;

// ------------------------------------------------------------------------------------------------- parser
export function parse(src) {
  const chapters = [];
  let ch = null;
  for (let raw of src.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    let m;
    if ((m = /^##\s*(\d+)\s*\|\s*(.+)$/.exec(line))) { ch = { n: +m[1], title: m[2].trim(), beats: [], labels: {} }; chapters.push(ch); continue; }
    if (!ch) continue;
    const B = ch.beats;
    if (line[0] === ':') { ch.labels[line.slice(1).trim()] = B.length; continue; }
    if (line.startsWith('=>')) { B.push({ k: 'goto', to: line.slice(2).trim() }); continue; }
    if ((m = /^\?\?\s*(.+?)\s*=>\s*(\S+)$/.exec(line))) { B.push({ k: 'if', cond: m[1].trim(), to: m[2] }); continue; }
    if (line[0] === '@') { const [a, cap] = line.slice(1).split('|'); const [set, v] = a.trim().split(/\s+/); B.push({ k: 'set', set, v: v || 'day', cap: (cap || '').trim() }); continue; }
    if ((m = /^\+(\w+)\s*(\w*)$/.exec(line))) { B.push({ k: 'enter', id: m[1], mark: m[2] || 'C' }); continue; }
    if ((m = /^-(\w+)$/.exec(line))) { B.push({ k: 'exit', id: m[1] }); continue; }
    if (line[0] === '>') { B.push({ k: 'say', id: null, text: line.slice(1).trim() }); continue; }
    if (line[0] === '?' ) { B.push({ k: 'prompt', text: line.slice(1).trim() }); continue; }
    if (line[0] === '*') {
      m = /^\*(\$(\d+))?(\?)?\s*(.+?)\s*=>\s*(\S+)\s*(\{(.*)\})?$/.exec(line);
      if (!m) throw new Error('bad choice: ' + line);
      const fx = parseFx(m[7] || '');
      const c = { text: m[4], to: m[5], cost: m[2] ? +m[2] : 0, once: !!m[3], fx };
      const last = B[B.length - 1];
      if (last && last.k === 'choice') last.opts.push(c);
      else { const pr = last && last.k === 'prompt' ? B.pop().text : ''; B.push({ k: 'choice', prompt: pr, opts: [c] }); }
      continue;
    }
    if (line[0] === '!') {
      const [cmd, ...rest] = line.slice(1).split(/\s+/); const arg = rest.join(' ');
      if (cmd === 'end') B.push({ k: 'end' });
      else if (cmd === 'cliff') B.push({ k: 'cliff', text: arg });
      else if (cmd === 'light') B.push({ k: 'light' });
      else if (cmd === 'clue') B.push({ k: 'clue', id: arg });
      else if (cmd === 'album') B.push({ k: 'album', id: arg });
      else if (cmd === 'outfit') B.push({ k: 'outfit', id: arg });
      else if (cmd === 'sfx') B.push({ k: 'sfx', id: arg });
      else if (cmd === 'hold') B.push({ k: 'hold', id: rest[0], what: rest[1] });
      else if (cmd === 'anim') B.push({ k: 'anim', id: rest[0], clip: rest[1] });
      continue;
    }
    if ((m = /^([A-Z]+)(~)?(\[(\w+)\])?:?\s*(.+)$/.exec(line))) {
      B.push({ k: 'say', id: m[1].toLowerCase(), think: !!m[2], emo: m[4] || '', text: m[5].trim() });
      continue;
    }
    throw new Error('cannot parse: ' + line);
  }
  // sanity: every jump target exists
  for (const c of chapters) for (const b of c.beats) {
    const targets = b.k === 'goto' || b.k === 'if' ? [b.to] : b.k === 'choice' ? b.opts.map(o => o.to) : [];
    for (const t of targets) if (!(t in c.labels)) throw new Error(`chapter ${c.n}: missing label ${t}`);
  }
  return chapters;
}
function parseFx(s) {
  const fx = { rel: {}, flags: [], album: [], clue: [] };
  for (const tok of s.split(/\s+/).filter(Boolean)) {
    let m;
    if ((m = /^(\w+)([+-]\d+)$/.exec(tok))) fx.rel[m[1]] = +m[2];
    else if ((m = /^f:(\w+)$/.exec(tok))) fx.flags.push(m[1]);
    else if ((m = /^album:(\w+)$/.exec(tok))) fx.album.push(m[1]);
    else if ((m = /^clue:(\w+)$/.exec(tok))) fx.clue.push(m[1]);
  }
  return fx;
}
// how many "lines" a chapter has on its main path (for the progress bar): every say beat counts
export const lineCount = ch => ch.beats.filter(b => b.k === 'say').length;
