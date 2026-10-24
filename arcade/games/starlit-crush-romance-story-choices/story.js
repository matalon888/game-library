// Starlit Crush — the script. Book One: "Notes Signed with a Star".
// A tiny screenplay language, parsed by parse() below (same grammar family as lantern-bay, plus a few kawaii extras):
//   @set variant | Place · Time        scene change (fade, location card)
//   +id MARK / -id                     character enters at a mark (L, R, C, LL, RR) / leaves
//   > text                             narration
//   ID: text   ID[emo]: text           a line (emo: happy laugh sad angry shock think shy love cheer jump wave)
//   ME~ text   ME~[emo] text           the player's thought
//   ? prompt                           the question above the next choices
//   * text => label {effects}          a choice; "*$25" = premium (coins); effects: sol+1 mika-1 f:flag album:key sticker:key
//   :label   => label   ?? cond => label   (cond: flag, !flag, a&b, sol>=3, top=sol)
//   !album k !sticker k !outfit k !sfx s !cliff text !end !anim id clip !emote id kind !note text !letter text !name
// {name} is the player's name. The player is never gendered; nobody uses pronouns for them.

export const CAST = {
  me:   { name: '{name}', color: '#ff5fa2', char: 'k01', h: 1.3 },
  bea:  { name: 'Bea', color: '#ff8d5c', char: 'k02', h: 1.3, role: 'Your roommate. Illustration. Runs on gossip and gummy bears.' },
  sol:  { name: 'Sol', color: '#19b892', char: 'k03', h: 1.3, li: true, pron: 'they/them', role: 'Ceramics. Makes a lopsided mug for everyone they love. Has made a lot of mugs.' },
  mika: { name: 'Mika', color: '#8a63ff', char: 'k04', h: 1.3, li: true, pron: 'she/her', role: 'Music production. Headphones always on. Writes a theme song for everyone she notices.' },
  june: { name: 'June', color: '#f2a516', char: 'k05', h: 1.3, li: true, pron: 'she/her', role: 'Film. Narrates her own life like a romcom trailer. Has a shot list for everything.' },
  dean: { name: 'Dean Mallow', color: '#b86bff', char: 'k07', h: 0.9, role: 'Head of Starlit College. Is a large lilac cat. Nobody mentions it.' },
  bun:  { name: 'Bun-Bun', color: '#ff7eb6', char: 'k06', h: 0.9, role: 'The college mascot. Never speaks. Somebody is inside. Nobody knows who.' },
};
export const LIS = ['sol', 'mika', 'june'];

// relationship album: polaroids captured from the 3D scene the moment they unlock
export const ALBUM = {
  sol_clay:    { who: 'sol', title: 'Clay Handprint', cap: 'Your first high-five. It\'s still on your sleeve.' },
  sol_wheel:   { who: 'sol', title: 'Two Pairs of Hands', cap: 'The bowl came out lopsided. Sol says that\'s the best kind.', premium: true },
  sol_mixer:   { who: 'sol', title: 'Lantern Glow', cap: 'They named a star after your laugh. It\'s a small star.' },
  sol_roof:    { who: 'sol', title: 'Pinky Promise', cap: 'Sun-person, meet starlight.' },
  mika_song:   { who: 'mika', title: 'Track 01 (Unfinished)', cap: 'Forty seconds of a song she swears isn\'t about anyone.' },
  mika_booth:  { who: 'mika', title: 'Inside the Booth', cap: 'One pair of headphones, two listeners.', premium: true },
  mika_mixer:  { who: 'mika', title: 'Quiet Corner', cap: 'The loudest party of the year, and she found the quiet bit.' },
  mika_roof:   { who: 'mika', title: 'A Song With Your Name', cap: 'Track 01 is finished now.' },
  june_extra:  { who: 'june', title: 'Mysterious Stranger #2', cap: 'Your film debut. One line. Nailed it.' },
  june_scene:  { who: 'june', title: 'The Rain Scene', cap: 'Take 14. The sprinkler was not in the script.', premium: true },
  june_mixer:  { who: 'june', title: 'Fairy-Light Montage', cap: 'She says this is the part with the slow-motion music.' },
  june_roof:   { who: 'june', title: 'Final Shot', cap: 'For once, she put the camera down.' },
  bea_room:    { who: 'bea', title: 'Lilac Hall 4B', cap: 'Roommates for life. Or at least till May.' },
  bea_letter:  { who: 'bea', title: 'Evidence Board', cap: 'Bea used string. So much string.' },
  sol_mug:     { who: 'sol', title: 'The Leaning Mug', cap: 'It holds tea at a slight angle. You love it.', premium: true },
  roof_all:    { who: 'bea', title: 'Gallery Night', cap: 'Everyone in their best, under every star.', premium: true },
};

// stickers: the sticker book (kawaii prop renders); earned along the story
export const STICKERS = {
  boba:   { img: 't01', name: 'First Boba' },
  letter: { img: 'r04', name: 'The Star Letter' },
  bouquet:{ img: 'r05', name: 'Gallery Bouquet' },
  teapot: { img: 'f09', name: 'Moonbean Tea' },
  cupcake:{ img: 'g09', name: 'Mixer Cupcake' },
  phones: { img: 'w07', name: 'Mika\'s Spare Headphones' },
  shades: { img: 'w09', name: 'Director Shades' },
  tree:   { img: 'r01', name: 'The Old Cherry Tree' },
  coin:   { img: 'x02', name: 'Lucky Heart Coin' },
  bear:   { img: 'g15', name: 'Dorm Bear' },
  charm:  { img: 'g14', name: 'Bun-Bun Charm' },
  lamp:   { img: 'h06', name: 'Mushroom Lamp' },
  trophy: { img: 'w11', name: 'Starlit Star' },
  icecream:{ img: 't08', name: 'Rooftop Soft Serve' },
  star:   { img: 'm03', name: 'Wishing Star' },
  rainbow:{ img: 'x05', name: 'After the Rain' },
  bow:    { img: 'b01', name: 'Satin Bow' },
  macaron:{ img: 'g08', name: 'Crit-Day Macaron' },
  berry:  { img: 't03', name: 'Strawberry Sol' },
  heart:  { img: 'm01', name: 'Brave Heart' },
};

// outfit scenes: hue = target hue for the jacket/top (null = original), acc = accessories (prop ids on the head)
export const OUTFITS = {
  mixer: {
    prompt: 'The Welcome Mixer. Fairy lights, a DJ who only plays bangers, and everybody you\'ll know for four years.',
    looks: [
      { id: 'classic', name: 'Starlit Classic', note: 'Lilac blazer, the original', cost: 0, hue: null, acc: [] },
      { id: 'mint', name: 'Mint Milk', note: 'Fresh, soft, approachable', cost: 0, hue: 158, sat: 0.9, lit: 1.08, acc: [] },
      { id: 'butter', name: 'Butter Dream', note: 'Sunny + a satin bow', cost: 0, hue: 46, sat: 1.0, lit: 1.12, acc: ['b01'] },
      { id: 'berry', name: 'Strawberry Pop', note: 'Main-character pink + heart shades', cost: 40, hue: 342, sat: 1.15, lit: 1.0, acc: ['w09'] },
      { id: 'night', name: 'Midnight Idol', note: 'Deep sapphire + cat-ear phones', cost: 40, hue: 222, sat: 1.2, lit: 0.72, acc: ['w07'] },
    ],
  },
  gallery: {
    prompt: 'Gallery Night. Your work on the wall. Your crush in the room. Dress like you meant to be here.',
    looks: [
      { id: 'classic', name: 'Starlit Classic', note: 'The blazer that started it all', cost: 0, hue: null, acc: [] },
      { id: 'butter', name: 'Butter Dream', note: 'Sunny + a satin bow', cost: 0, hue: 46, sat: 1.0, lit: 1.12, acc: ['b01'] },
      { id: 'peach', name: 'Peach Sorbet', note: 'Warm, soft + a heart clip', cost: 0, hue: 18, sat: 1.0, lit: 1.12, acc: ['b02'] },
      { id: 'galaxy', name: 'Galaxy Gala', note: 'Ultraviolet + a satin bow', cost: 45, hue: 272, sat: 1.35, lit: 0.82, acc: ['b01'] },
      { id: 'berry', name: 'Strawberry Pop', note: 'Main-character pink + heart shades', cost: 40, hue: 342, sat: 1.15, lit: 1.0, acc: ['w09'] },
    ],
  },
};

// the chapter map: Book One (chapters 1–3 written, 4–8 outlined)
export const BOOK = {
  title: 'Notes Signed with a Star',
  chapters: [
    { n: 1, title: 'First Day, First Spark', place: 'The quad', icon: '🌸', teaser: 'Move-in day at Starlit College. A roommate with a megaphone voice, three people you can\'t stop thinking about, and a letter nobody signed.' },
    { n: 2, title: 'Under the Old Cherry Tree', place: 'Studio 7', icon: '💌', teaser: 'Who wrote the letter? Bea has a theory board. You have a showcase partner. Starlight is at nine.' },
    { n: 3, title: 'Gallery Night', place: 'The rooftop', icon: '✨', teaser: 'Your work on the wall, everyone in their best, and one rooftop under every star. Someone has something to say.' },
    { n: 4, title: 'Who\'s Inside Bun-Bun?', place: 'Lilac Hall', icon: '🐰', teaser: 'The mascot takes off its head. Everything you thought you knew about the letters was a group project.', soon: true },
    { n: 5, title: 'Kiln Fire', place: 'The ceramics yard', icon: '🔥', teaser: 'Sol\'s final piece cracks the night before crits. Two pairs of hands. One long night.', soon: true },
    { n: 6, title: 'Open Mic', place: 'Moonbean Café', icon: '🎧', teaser: 'Mika signs up to play live for the first time. Then she signs you up too.', soon: true },
    { n: 7, title: 'Cut! Print!', place: 'The film lot', icon: '🎬', teaser: 'June\'s thesis film loses its lead. She knows exactly who she wants instead.', soon: true },
    { n: 8, title: 'The Starlit Showcase', place: 'The great hall', icon: '🌟', teaser: 'The whole college, one stage, and the question you\'ve been answering all year.', soon: true },
  ],
};

export const SCRIPT = String.raw`
## 1 | First Day, First Spark
@quad day | Starlit College · Move-in day
> Starlit College of Art and Design. Pink blossoms, pastel bricks, and a sign at the gate that says NO GLITTER IN THE FOUNTAIN (AGAIN).
+me C
ME~[think] Okay. One suitcase, one sketchbook, zero friends. New city, new start. Totally normal amount of nervous.
+bea R
!sfx pop
BEA[cheer]: ROOMMATE! It's you! You're my roommate! I can tell because you look exactly like your enrolment photo but more three-dimensional!
BEA[happy]: I'm Bea. Illustration major. I've already decided we're best friends, so you can relax. And you're...?
!name
BEA[love]: {name}! Perfect. That's a main-character name. I've been saying it in my head for a week and it fits.
? Bea is vibrating with joy. What do you do?
* Hug her. Full commitment. => b_hug {bea+2 sticker:bear}
* "Hi Bea. I brought gummy bears for the room." => b_gummy {bea+1}
* "Did you... practise my name?" => b_tease {bea+1}
:b_hug
BEA[shy]: Oh! Oh, we're huggers. Amazing. I was going to wait until week two.
=> b_after
:b_gummy
BEA[shock]: You've known me for nine seconds and you've already found my weakness. This is the start of something.
=> b_after
:b_tease
BEA[laugh]: Out loud, in the mirror, with different emotions. You were very kind in all of them.
=> b_after
:b_after
+bun LL
!anim bun wave
> Across the quad, a giant white bunny waves at you with both paws.
ME[shock]: Bea. There's a six-foot bunny waving at me.
BEA: That's Bun-Bun! College mascot. Never speaks. Nobody knows who's inside. Some say it's a grad student. Some say it's three raccoons.
BEA[think]: I say it's whoever stole my good pencil sharpener in orientation week, but I can't prove anything.
!emote bun heart
-bun
+dean L
DEAN[happy]: Welcome, welcome, new stars! I am Dean Mallow. My door is always open. Mostly because I can't work the handle.
ME~[shock] The Dean is a large lilac cat. Nobody else seems to think this is worth mentioning.
? Do you mention it?
* "Lovely to meet you, Dean Mallow!" (do not mention it) => d_polite
* "Sorry, are you... a cat?" => d_cat {f:asked_cat}
:d_polite
DEAN[cheer]: Excellent manners. You'll go far. Probably to the third floor, which is where the printers are.
=> d_after
:d_cat
DEAN[think]: I am the Dean. My credentials are on the wall. Some of them are slightly scratched.
BEA~[laugh] We do not ask. We never ask.
=> d_after
:d_after
DEAN: Remember: in eight weeks it's the Freshman Showcase. One piece from each of you on the gallery wall, and the best one wins the Starlit Star.
DEAN[wave]: No pressure! Except all of it. Toodle-oo!
-dean
-bea
!sticker tree
@studio day | Studio 7 · Ceramics and sculpture
> Studio 7 smells like wet clay and ambition. Somebody is playing lo-fi beats on a speaker shaped like a frog.
+me L
+sol R
SOL[happy]: Okay, okay, okay, she's centred, she's centred, she's —
!sfx splat
> A wet lump of clay flies off the wheel and lands — splat — on your sleeve.
SOL[shock]: Oh no. Oh no no no. I am SO sorry. Hi. I'm Sol. I just threw clay at you. Not on purpose. I'm normally much better at first impressions.
!emote sol sweat
? Your sleeve has clay on it. Sol looks like they want to dissolve. What do you say?
* "Honestly? It's a vibe. Very art school." => s_vibe {sol+2}
* Take the rest of the clay and high-five them. => s_five {sol+2 album:sol_clay}
* "You owe me a coffee. A big one." => s_coffee {sol+1 f:sol_coffee}
:s_vibe
SOL[laugh]: Right?! Day one and you already look like you've been here for years. Wise. Seasoned. Slightly damp.
=> s_after
:s_five
SOL[cheer]: A clay high-five! Nobody ever high-fives back! Now we've got matching handprints. That's basically a friendship contract.
=> s_after
:s_coffee
SOL[happy]: Deal. Moonbean, extra large, my treat. I'll even carry it with both hands, because, you know. History.
=> s_after
:s_after
SOL: I make mugs, mostly. They all come out a bit lopsided. I tell people it's a style.
SOL[shy]: Here. This one's from the kiln this morning. It leans to the left. I think it's shy.
? Sol holds out a small, slightly lopsided pink mug.
* "It's perfect. I love it." => m_love {sol+2 f:mug_love sticker:berry}
* "It's leaning like it's got a secret to tell." => m_lean {sol+1 f:mug_lean}
*$25 "Teach me to make one? Right now?" => m_wheel {sol+3 album:sol_wheel f:sol_wheel}
:m_love
SOL[love]: You... wow. People usually say "it's very handmade." You said perfect. I'm going to think about that all week. Normal amount.
=> m_after
:m_lean
SOL[laugh]: That's EXACTLY what I think! It's leaning in for gossip. You get it. Most people just ask if it was an accident.
=> m_after
:m_wheel
> Sol sits you at the wheel and puts their hands over yours. The clay spins. It wobbles. It somehow becomes a bowl.
SOL[shy]: See? You've got good hands. Steady. Like you know where you're going even when you don't.
SOL[happy]: It's lopsided. That's the best kind. That means two people made it.
=> m_after
:m_after
SOL: Anyway! I'll let you go before I throw anything else at you. Come back anytime. The wheel's always free at night. So am I. Wait. That came out — I mean the studio is free —
ME~[laugh] They're blushing harder than the mug.
-sol
@cafe day | Moonbean Café · Afternoon
> Moonbean Café: moon-shaped cookies, a cake case that glows, and a barista who draws cats in the latte foam.
+me C
+june R
JUNE[shock]: Don't move. DON'T move. The light is hitting you perfectly. You — yes, you — you're in my film now.
JUNE[happy]: June Delgado, film, second year. My short is about a stranger who walks into a café and changes everyone's life. You walked into a café. It's fate. Or blocking. Same thing.
? June is already framing you with her fingers.
* "I'm in. What's my motivation?" => j_in {june+2}
* "Can I at least know my character's name?" => j_name {june+1}
* "I'm not really a camera person..." => j_shy {june+1 f:june_gentle}
:j_in
JUNE[cheer]: A professional! Your motivation is: you just lost something important and you don't know it yet. Also you want a croissant.
=> j_shot
:j_name
JUNE[think]: Mysterious Stranger Number Two. Number One dropped out to study law. Tragic, really. For the film.
=> j_shot
:j_shy
JUNE[shy]: Oh — no, totally, that's okay. Sorry. I do this. I see a good shot and forget that there's a real person in it.
JUNE: How about: no close-ups, one line, and you can see it before anyone else does. Deal?
ME: ...Deal.
=> j_shot
:j_shot
JUNE: Okay, your line is: "I think I've been here before." Say it like you're remembering a dream.
ME[think]: I think I've been here before.
JUNE[love]: ...Cut. Oh, that was GOOD. That gave me chills. Look, actual arm chills.
!album june_extra
JUNE[happy]: You're a natural. Come with me, I need you to meet the only person who can score this film. If she says yes. She never says yes.
!sticker boba
+mika L
> In the corner booth, a girl with a black bob and pink headphones is hunched over a tiny keyboard.
JUNE: Mika! Mika. Mika. Mika-chan. Mika Sato. This is {name}. {name} is my new lead. Play them the thing.
MIKA[shock]: I — what? No. It's not — it isn't finished.
MIKA[shy]: Hi. Sorry. Hi. I don't really... talk. At first. I'm better after about a month.
? Mika is holding her headphones like a shield.
* "Can I hear it? Even unfinished?" => k_hear {mika+2 album:mika_song}
* "No pressure. I'll just sit here and be quiet with you." => k_quiet {mika+2 f:mika_quiet}
* "June, maybe give her a minute?" => k_june {mika+1 june-1 f:stood_up}
:k_hear
> She hesitates. Then she slides one ear of the headphones over to you. It's forty seconds of something soft and bright, like the moment before a sunrise.
MIKA[shy]: It stops there. I don't know how it ends yet.
ME: Maybe it doesn't know yet either.
MIKA[love]: ...Yeah. Maybe.
=> k_after
:k_quiet
> You sit. She keeps playing, quietly. After a minute, she turns the speaker up — just a little. Just for you.
MIKA[happy]: You're... really easy to be quiet with. That's rare. Thanks.
=> k_after
:k_june
JUNE[sad]: Oh. Right. Yes. Sorry, Mika. I'm a lot. I know I'm a lot.
MIKA[happy]: You're the right amount of a lot. Usually. But thanks, {name}. Nobody ever says that.
=> k_after
:k_after
MIKA: If... if you come back tomorrow, I might have eight more seconds.
JUNE[laugh]: That's practically a proposal, coming from her.
-mika
-june
@dorm evening | Lilac Hall 4B · Evening
> Room 4B: two beds, one mushroom lamp, and a wall Bea has already covered in sketches of everyone she met today.
+me L
+bea R
BEA[shock]: So. SO. Sol from ceramics, Mika from music AND June from film? On DAY ONE? {name}, you're a romcom.
BEA[think]: Sol made you a mug? Sol makes mugs for people they like. They have made, conservatively, four hundred mugs. But still.
?? mug_love => bea_mug
=> bea_next
:bea_mug
BEA[love]: And you told them it was PERFECT? Oh, they're going to put that mug in a glass case.
:bea_next
!album bea_room
BEA[happy]: Now, the important thing: the Welcome Mixer. Tonight. On the quad. You need a look.
!outfit mixer
BEA[cheer]: YES. Iconic. Someone's going to write a song about you in that.
@quad night | The Quad · The Welcome Mixer
> The quad is strung with fairy lights. The cherry blossoms glow pink in the dark. The DJ is playing exclusively bangers, as promised.
+me C
+bea L
BEA: Right. I'm going to go and get us cupcakes and also several people's life stories. Who are you looking for first?
!sticker cupcake
-bea
? You scan the crowd. Who do you look for?
* Sol, by the lanterns. => x_sol {sol+1}
* Mika, in the quiet corner. => x_mika {mika+1}
* June, filming the whole thing. => x_june {june+1}
:x_sol
+sol R
SOL[cheer]: {name}! You came! And your sleeve survived! I was worried I'd ruined your whole first day.
?? s_coffee => x_sol_coffee
=> x_sol_b
:x_sol_coffee
SOL[happy]: Also, I owe you an extra-large coffee. I wrote it on my hand so I wouldn't forget. See? COFFEE FOR {name}. In pen.
:x_sol_b
SOL: Look, that star there — the little one next to the bright one. I'm naming it after your laugh. It's a small star. It's still a star.
!album sol_mixer
=> x_end
:x_mika
+mika R
MIKA[shy]: Oh. Hi. You found the quiet bit. Nobody finds the quiet bit.
?? mika_quiet => x_mika_q
=> x_mika_b
:x_mika_q
MIKA[happy]: I finished eight more seconds. After you sat with me. I don't know if that's a coincidence.
:x_mika_b
MIKA: The music's too loud over there, but from here it sounds like it's underwater. I like it. Is that weird?
ME: It's not weird. It sounds like a memory.
MIKA[love]: ...I'm stealing that. For a lyric. If that's okay.
!album mika_mixer
=> x_end
:x_june
+june R
JUNE[cheer]: My lead! Stand there. No — there. Under the lights. This is the montage part. Imagine slow-motion music.
?? june_gentle => x_june_g
=> x_june_b
:x_june_g
JUNE[happy]: No close-ups. I remembered. I wrote it on my shot list: "{name}: wide shots only, be nice."
:x_june_b
JUNE[think]: Can I tell you something? I film everyone else's stories because it's easier than being in one. Tonight I kind of wish I was in one.
!album june_mixer
=> x_end
:x_end
+bun RR
!anim bun jump
> Then Bun-Bun bounces through the crowd, stops in front of you, and holds out an envelope. Pink. Sealed with a gold star.
ME[shock]: For me?
!emote bun heart
-bun
!sticker letter
!sfx letter
!letter Meet me under the old cherry tree tomorrow, at starlight. I've wanted to tell you something since the moment you walked in. — ✦
ME~[shock] No name. Just a star.
+bea L
BEA[shock]: Is that a LETTER? Is that a SEALED LETTER? From BUN-BUN? {name}. {name}. We are going to need string. And a corkboard.
!cliff Someone at Starlit has a crush on you. They signed it with a star. And tomorrow, at starlight, they'll be waiting under the old cherry tree.
!end

## 2 | Under the Old Cherry Tree
@dorm morning | Lilac Hall 4B · The next morning
+me L
+bea R
> Overnight, Bea has turned the wall into an evidence board. There is string. There is so much string.
BEA[think]: Okay. Suspects. Sol: makes mugs for people they like, said "so am I" by accident. Mika: wrote a lyric about you within three hours. June: literally cast you as her lead.
BEA[shock]: Also Bun-Bun delivered it, which means either the writer KNOWS Bun-Bun or the writer IS Bun-Bun, and I can't deal with that second one before coffee.
!album bea_letter
? Who do you secretly hope wrote it?
* "Honestly? I hope it's Sol." => h_sol {f:hope_sol}
* "Mika. I think it's Mika." => h_mika {f:hope_mika}
* "June. It has June energy." => h_june {f:hope_june}
* "I don't want to guess. I want to find out." => h_none {bea+1}
:h_sol
BEA[love]: The sunshine one! Okay. Noted. Underlined. Heart drawn next to it.
=> h_after
:h_mika
BEA[love]: The quiet one! Oh, she would write a letter. She would write eleven drafts of a letter.
=> h_after
:h_june
BEA[love]: The director! "Meet me at starlight" IS very cinematic. Very golden hour, but for night.
=> h_after
:h_none
BEA[happy]: Mysterious. Patient. Emotionally mature. I hate it. I respect it.
=> h_after
:h_after
BEA: Whoever it is, you'll know tonight. Until then — showcase partners get announced at ten. Go. Be brilliant. Report back.
-bea
@studio day | Studio 7 · Showcase partners
+me C
+dean L
DEAN[happy]: Good morning, stars! This year, every showcase piece is a collaboration. Two artists, one piece, zero arguments. Ideally.
DEAN[think]: I will now let you choose your own partners, because last year I chose, and two sculptors are still not speaking.
!emote dean sweat
-dean
+sol R
+mika LL
+june RR
> Three people look up at the same time. Sol waves with both clay-covered hands. Mika takes one headphone off. June has already drawn you a storyboard of the two of you working together.
? Who do you ask to be your showcase partner?
* Sol: "Want to make something lopsided with me?" => p_sol {sol+2 f:pair_sol}
* Mika: "Can my art have a soundtrack?" => p_mika {mika+2 f:pair_mika}
* June: "Direct me. I'm ready." => p_june {june+2 f:pair_june}
:p_sol
SOL[cheer]: YES. Yes! Sorry. Yes, I'd love that. Calm yes. Normal yes.
?? mug_love => p_sol_mug
=> p_sol_b
:p_sol_mug
SOL[love]: You know, I still have the glaze from your mug. The perfect one. We could use it. Like it's — part of the story.
:p_sol_b
MIKA[happy]: Good choice. Sol's the nicest person in this building. They once gave the vending machine a pep talk.
JUNE[sad]: Noooo. I had storyboards. I'll recover. I'll make a short film about recovering.
=> p_after
:p_mika
MIKA[shock]: Me? You — me? Okay. Yes. I'll make it sound like... like how you look when you're thinking.
?? mika_quiet => p_mika_q
=> p_mika_b
:p_mika_q
MIKA[shy]: You sat with me and didn't make me talk. That's... I want to make something good for that person.
:p_mika_b
SOL[happy]: Aww. Mika, that's the most words you've said in a row all semester.
JUNE[sad]: I'm fine. I'm fine! I'm going to go and look out of a window dramatically.
=> p_after
:p_june
JUNE[cheer]: I KNEW IT. I had a feeling. I had a shot list for this exact moment. Look — "Scene 1: They pick me."
?? june_gentle => p_june_g
=> p_june_b
:p_june_g
JUNE[shy]: And no close-ups unless you want them. I remember. I'll always remember stuff like that, okay?
:p_june_b
SOL[laugh]: You've doomed yourself to at least forty takes of everything. Godspeed.
MIKA[happy]: If you need music, you know where I'll be. Hiding. In the booth.
=> p_after
:p_after
-sol
-mika
-june
?? pair_sol => w_sol
?? pair_mika => w_mika
=> w_june
:w_sol
@studio dusk | Studio 7 · After hours
+me L
+sol R
> The studio is empty except for the two of you, the kiln humming like a sleepy cat, and a wheel spinning slow.
SOL: So I was thinking — what if our piece is a set of cups? One for every person who made you feel at home on day one.
SOL[shy]: Mine would be... wobbly. Obviously. But warm. Like, really warm. The kiln kind.
? Sol is looking at you like the answer matters.
* "That's beautiful. Let's do it." => ws_yes {sol+2}
* "One cup should be for you." => ws_you {sol+3 f:sol_cup}
*$30 "Let's glaze the old mug together, too." => ws_mug {sol+3 album:sol_mug f:sol_mug}
:ws_yes
SOL[cheer]: Really? Oh, I'm so happy. I'm going to be weird about it. I'm already being weird about it.
=> w_end
:ws_you
SOL[shock]: Me? I — you'd make one for me?
SOL[love]: Nobody's ever made one for me. I make them for everybody. I didn't think about it until right now. Okay. I might cry a tiny amount. Kiln-related.
=> w_end
:ws_mug
> Side by side, you paint stars onto the leaning mug. Sol's stars are perfect. Yours are lopsided. Sol says yours are better.
SOL[love]: Now it's leaning toward you on purpose.
=> w_end
:w_mika
@studio dusk | The Sound Booth · After hours
+me L
+mika R
> The sound booth is tiny and padded and smells like vanilla lip balm. Mika has two pairs of headphones ready. One of them has cat ears.
MIKA: I had an idea. Your drawings, projected on the wall, and the music changes when the colours change. Like the art is singing.
MIKA[shy]: I already wrote the part for the blue bits. It's sad but okay. Like rain when you're already inside.
? Mika is waiting, chewing her sleeve.
* "Play me the blue part." => wm_blue {mika+2}
* "Rain when you're already inside. That's exactly it." => wm_rain {mika+3 f:mika_rain}
*$30 Share the cat-ear headphones and listen together. => wm_booth {mika+3 album:mika_booth sticker:phones}
:wm_blue
> It's soft and low and it makes your chest ache in the good way.
MIKA[happy]: You closed your eyes. People only do that when it's working.
=> w_end
:wm_rain
MIKA[shock]: You — you got it. Nobody gets it. People say "nice" and then ask if I can make it more upbeat.
MIKA[love]: I don't want to make it more upbeat. I want to make it more you.
=> w_end
:wm_booth
> Her shoulder against yours. One song in four ears. She mouths the lyrics without singing them.
MIKA[shy]: There's a line in there I'm not ready to sing yet. One day.
=> w_end
:w_june
@cafe dusk | Moonbean Café · After hours
+me L
+june R
> The café's closed. June has borrowed the keys, three lamps and the barista's cat. The cat is not cooperating.
JUNE: Our piece: a two-minute film. You walk into Starlit for the first time. Everything's new and terrifying and pink.
JUNE[think]: And at the end you look straight at the camera and I don't know what happens next. I've never known how to end anything.
? June is holding the camera a little lower than usual.
* "Maybe you end it by stepping into the shot." => wj_shot {june+3 f:june_in_shot}
* "End it with the cat. Everyone loves a cat ending." => wj_cat {june+2}
*$30 "Let's shoot a rain scene. Right now. With the sprinkler." => wj_rain {june+3 album:june_scene sticker:rainbow}
:wj_shot
JUNE[shock]: Me? In the shot? I don't — I'm behind the camera. That's where I go.
JUNE[love]: ...But maybe I could come out. For one scene. If you're in it too.
=> w_end
:wj_cat
JUNE[laugh]: A cat ending! Bold! Commercial! Mallow will give us top marks out of solidarity.
=> w_end
:wj_rain
> Take 14. The sprinkler hits you both. June is laughing so hard she drops the camera on the cushion. She doesn't pick it up for a long time.
JUNE[love]: That's the best take. The one I wasn't filming.
=> w_end
:w_end
> Outside, the sky is going lilac. Then dark blue. Then — starlight.
ME~[think] Nine o'clock. The old cherry tree.
@quad night | The old cherry tree · Starlight
+me C
> The old cherry tree is lit up by the lamps, petals falling slow like the sky is shedding. The bench underneath is empty.
ME~[sad] Nobody here. Maybe it was a joke. Maybe I'm early. Maybe I'm—
!sfx pop
+sol LL
SOL[shock]: Oh! {name}! Hi! I was just — passing. Through. With this mug. Of tea. That I made. For no one.
+mika L
MIKA[shock]: ...I was also passing. Through. With these headphones. Which I always have.
+june RR
JUNE[shock]: Funny story, I was ALSO passing through, scouting locations, totally unrelated, very professional—
> The three of them look at each other. Then at you. Then at each other again.
SOL[think]: Wait. Why are all of us passing through?
? Three people, one bench, a lot of eye contact. What do you say?
* "Did one of you write me a letter?" => t_ask
* "This is the best day of my life and I'm not even sure why." => t_best {sol+1 mika+1 june+1}
* "Sit with me. All of you. It's a nice tree." => t_sit {sol+1 mika+1 june+1 sticker:star}
:t_ask
SOL[shy]: A letter? I... no. I make mugs, not letters. Though now I wish I had.
MIKA[shy]: I write lyrics. Not letters. They're like letters with fewer guarantees.
JUNE[shy]: I write scripts! Which are... technically... no. No letter. Sadly. Unfortunately.
=> t_after
:t_best
JUNE[laugh]: That's a great line. Can I use that? Ugh, sorry. Instinct.
MIKA[happy]: I think it's a good day for being not sure why.
SOL[love]: Same. Exactly that. Same.
=> t_after
:t_sit
> You all squeeze onto the heart bench. It's not built for four. Nobody minds. Petals land in Mika's hair and she doesn't notice. Sol notices. June notices Sol noticing.
SOL[happy]: This is nice. This is really nice.
=> t_after
:t_after
> Then a gust of wind. A pink envelope tumbles out of the branches, sealed with a gold star, and lands in your lap.
!sfx letter
!letter You came. I'm sorry I couldn't be there. I chickened out. On Gallery Night, I'll be on the rooftop. I'll tell you everything. Promise. — ✦
+bea RR
BEA[shock]: I KNEW IT. I followed you. I'm not sorry. {name}. Look at the handwriting.
BEA[think]: It's the same handwriting as the Showcase sign-up sheet. Which means whoever wrote this... is a freshman in this showcase.
> Sol, Mika and June are all in the showcase.
!cliff Somebody wrote you two letters — and they're in the showcase. On Gallery Night, on the rooftop, they've promised to tell you everything.
!end

## 3 | Gallery Night
@dorm evening | Lilac Hall 4B · Gallery Night
+me L
+bea R
BEA[cheer]: GALLERY NIGHT. Your art on a wall! Real walls! With little labels! I'm going to cry and then I'm going to steal a canapé.
BEA[think]: And then the rooftop. The letter. The truth. I've prepared a playlist for every possible outcome.
!outfit gallery
BEA[love]: Oh. Oh, you look like the last page of a really good book.
? Bea is fixing your collar. You can tell she's nervous for you.
* "Thanks for being in my corner, Bea." => g_thanks {bea+2 f:bea_thanks}
* "If this goes badly, we're eating all the gummy bears." => g_gummy {bea+1}
:g_thanks
BEA[shy]: Always. Day one, I decided. Remember? I'm very decisive. Sometimes too decisive. You'll see.
=> g_after
:g_gummy
BEA[laugh]: If it goes WELL we're eating all the gummy bears. The gummy bears are happening regardless.
=> g_after
:g_after
-bea
@studio gallery | Studio 7 · Gallery Night
+me C
> Studio 7 has become a gallery. Fairy lights, white plinths, and everyone's work under little spotlights. People are whispering. In a good way.
+dean L
DEAN[happy]: Ah! The collaborative piece. Let me see. Mm. Mmm. Mmmmm.
DEAN[think]: I am going to sit on it. That is the highest honour I can give. I sit on the work I love.
!emote dean heart
?? pair_sol => gd_sol
?? pair_mika => gd_mika
=> gd_june
:gd_sol
DEAN: A set of cups for the people who made a stranger feel at home. Lopsided. Brave. I would drink milk from any of these.
=> gd_after
:gd_mika
DEAN: Drawings that sing. I have heard my first sad blue song. I must lie down in a sunbeam.
=> gd_after
:gd_june
DEAN: A first day, filmed. A cat in the final shot. Exquisite casting.
=> gd_after
:gd_after
-dean
!sticker macaron
+sol LL
+mika R
+june RR
> Then three things go wrong at once.
SOL[sad]: My piece. The big bowl. It cracked in the kiln. It's — it's fine. It's fine! It's just. I made it for... it doesn't matter who.
MIKA[shock]: They want me to play live. In five minutes. In front of people. With faces.
JUNE[sad]: The projector's dead. My whole film. Two minutes of my whole heart and it's just a black square.
? Everyone needs you right now. Who do you go to first?
* Sol and the cracked bowl. => fx_sol {sol+3 f:helped_sol}
* Mika and the live set. => fx_mika {mika+3 f:helped_mika}
* June and the dead projector. => fx_june {june+3 f:helped_june}
:fx_sol
ME: Sol. Look. It cracked right through the middle, like a smile. Can we fill it with gold?
SOL[shock]: Like kintsugi. You'd — you'd help me fix it instead of telling me it's fine?
SOL[love]: Okay. Okay. Yes. A bowl that broke and got better. I think that might be the most honest thing I've made.
=> fx_after
:fx_mika
ME: Mika. Don't look at the people. Look at me. Play it like it's just the booth.
MIKA[shy]: Just the booth. Just you. Okay.
> She plays. The room goes quiet. When she hits the last note, the quiet stays for a second — and then everyone claps at once.
MIKA[love]: I looked at you the whole time. I didn't look at a single face. Except yours.
=> fx_after
:fx_june
ME: June. Forget the projector. Hold your phone up to the wall. Tell them what happens. Live.
JUNE[shock]: Narrate it? Out loud? Me? In front of —
JUNE[love]: ...Okay. Okay! "Scene one. A stranger walks into Starlit." Oh, they're laughing. They're laughing at the good bits!
=> fx_after
:fx_after
?? !helped_sol => ok_sol
=> ok_sol_done
:ok_sol
SOL[happy]: Bea brought me gold paint. Apparently she carries it "for emergencies". It's going to be okay.
:ok_sol_done
?? !helped_mika => ok_mika
=> ok_mika_done
:ok_mika
MIKA[happy]: I played. Badly, in the middle. But I played. Next time I want you in the front row.
:ok_mika_done
?? !helped_june => ok_june
=> ok_june_done
:ok_june
JUNE[happy]: The barista fixed the projector with a hair tie. Film saved. Cat ending landed. Best night of my life, part two.
:ok_june_done
!sticker bouquet
> The gallery is winding down. The rooftop door at the end of the corridor is propped open with a paintbrush.
-sol
-mika
-june
? Before you go up — who do you ask to come with you?
* Sol. => r_sol
* Mika. => r_mika
* June. => r_june
:r_sol
@roof night | The Rooftop · Starlight
+me L
+sol R
SOL[shy]: I've never been up here at night. The stars look closer. Or maybe I'm just — more awake.
?? helped_sol => rs_help
=> rs_b
:rs_help
SOL[love]: You fixed my bowl with gold. You didn't say "it's fine". You said "let's make it better". I don't think you know what that did.
:rs_b
SOL: Can I tell you something? I didn't write the letters. I wish I had. I made you a mug instead, because that's the only way I know how to say things.
? Sol's hand is right next to yours on the railing.
* Hold out your pinky. => rs_pinky {sol+3 album:sol_roof}
* "The mug said it. Loud and clear." => rs_mug {sol+2}
*$35 Share the soft serve they snuck up here for you. => rs_ice {sol+3 album:roof_all sticker:icecream}
:rs_pinky
SOL[love]: A pinky promise? For what?
ME: That we'll keep making lopsided things together.
SOL[cheer]: Deal. Forever deal. Pinky deals are legally binding in ceramics.
=> roof_end
:rs_mug
SOL[love]: It did? Oh. Oh good. I put a lot of feelings in a very small cup.
=> roof_end
:rs_ice
SOL[laugh]: I had it in the freezer in Studio 7 behind the clay. It tastes a tiny bit like clay. Sorry. Romantic, though!
=> roof_end
:r_mika
@roof night | The Rooftop · Starlight
+me L
+mika R
MIKA[shy]: It's so quiet up here. I can hear the whole city humming. It's in B flat, if you were wondering.
?? helped_mika => rm_help
=> rm_b
:rm_help
MIKA[love]: I played because you told me to look at you. I've never played for one person in a full room before.
:rm_b
MIKA: I didn't write the letters. I'd have written fifty drafts and sent none. But I finished the song. Track 01. Can I...?
? She holds out one side of her headphones.
* Lean in and listen. => rm_listen {mika+3 album:mika_roof}
* "Sing it. Just the line you weren't ready for." => rm_sing {mika+2 f:mika_sang}
*$35 Watch the meteor shower together on her playlist. => rm_stars {mika+3 album:roof_all sticker:icecream}
:rm_listen
> It's the forty seconds from the café. And then it keeps going. It knows how it ends now.
MIKA[love]: It's called {name}. I hope that's okay. I couldn't call it anything else.
=> roof_end
:rm_sing
MIKA[shy]: "I was better after a month, but I was better after you." ...That's it. That's the line. Please don't look at me. Okay, you can look at me.
=> roof_end
:rm_stars
MIKA[happy]: Every time one falls the song goes up a note. I timed it. I've been planning this for a week. Don't tell June.
=> roof_end
:r_june
@roof night | The Rooftop · Starlight
+me L
+june R
JUNE[shy]: No camera. See? Hands empty. I don't know what to do with them. Is this how normal people feel all the time?
?? helped_june => rj_help
=> rj_b
:rj_help
JUNE[love]: You told me to narrate my own film out loud. I've never been in my own story before. It was terrifying. I loved it.
:rj_b
JUNE: Full honesty: I didn't write the letters. I'd have done a whole storyboard. But I did think about how this scene would go. A lot.
? June is looking at you instead of at the view.
* "So how does the scene end?" => rj_end {june+3 album:june_roof}
* "No script. Let's just see." => rj_free {june+2 f:june_free}
*$35 "Slow dance? There's music coming from the gallery." => rj_dance {june+3 album:roof_all sticker:icecream}
:rj_end
JUNE[love]: In my version? We just stand here. Nothing happens. And it's the best scene in the whole film.
=> roof_end
:rj_free
JUNE[laugh]: No script! Terrifying. Thrilling. Okay. I'm improvising. I'm — I'm really glad you picked me to come up here.
=> roof_end
:rj_dance
> It's a bad dance. You step on each other's feet twice. June doesn't call cut.
JUNE[happy]: Best take. Not filming. Again.
=> roof_end
:roof_end
!sticker trophy
> Then the rooftop door creaks open.
+bun RR
!anim bun wave
> Bun-Bun steps out into the starlight, holding a third pink envelope with a gold star on it.
ME[shock]: Bun-Bun?
> The mascot puts the envelope down. Raises both paws. And slowly, carefully, starts to take off its own head.
!sfx cliff
!cliff The letters were never from who you thought. Bun-Bun is taking off its head — and the face underneath is someone you know very, very well.
!end
`;

// "Who said it?" — the daily quiz (?daily=1): 5 seeded quotes a day, pick who said it. Win = 3+ right.
export const QUOTES = {
  sol: [
    'I gave the vending machine a pep talk. It gave me two cookies. We have an understanding.',
    'It came out lopsided, which means it has personality.',
    'I named a star after your laugh. It\'s a small star. It counts.',
    'The kiln is humming. I think it\'s happy for us.',
    'I\'m going to be honest, because I\'m bad at not being honest.',
    'If you put tea in it and it only spills a little, that\'s a mug.',
    'Okay, I cried at the sunset again. It was a really good sunset.',
    'Clay high-five! Now we\'re legally friends.',
    'Every crack is just the bowl telling you where it\'s been.',
    'I made you something. It leans a bit. So do I, toward you.',
  ],
  mika: [
    'I\'m better after about a month.',
    'The city hums in B flat. You can\'t unhear it now. Sorry.',
    'It\'s not finished. Nothing I make is finished. That\'s the point.',
    'You\'re really easy to be quiet with.',
    'Can you make it more upbeat? No. Next question.',
    'One ear for you, one for me. That\'s the rule.',
    'I wrote eleven drafts of a text that said "ok".',
    'Rain sounds better when you\'re already inside.',
    'Please don\'t look at me while I play. Okay, you can look.',
    'I put your footsteps in the beat. You walk at 92 bpm.',
  ],
  june: [
    'Don\'t move. The light is hitting you perfectly.',
    'Your motivation: you lost something and you don\'t know it yet. Also, croissant.',
    'Every good film needs a cat ending.',
    'Picture this, but in slow motion.',
    'Take 14! Fourteen is my lucky number as of right now.',
    'I have a shot list for this exact moment.',
    'This is the montage part. Imagine strings.',
    'Cut! No, keep going! Don\'t cut! Never cut!',
    'I film everyone else\'s story. It\'s easier.',
    'That was the best take — the one I wasn\'t filming.',
  ],
  bea: [
    'We are going to need string. And a corkboard.',
    'I\'ve already decided we\'re best friends, so you can relax.',
    'The gummy bears are happening regardless.',
    'I carry gold paint for emergencies. Everything is an emergency.',
    'You\'re a romcom. You\'re a walking romcom.',
    'I said your name in the mirror with different emotions.',
    'Some say Bun-Bun is a grad student. Some say three raccoons.',
    'I\'ve prepared a playlist for every possible outcome.',
    'Day one, I decided. I\'m very decisive.',
    'I followed you. I\'m not sorry.',
  ],
};
export const QUIZ_HINTS = { sol: 'clay · mugs · feelings', mika: 'music · quiet · headphones', june: 'film · drama · big plans', bea: 'gossip · gummy bears · hype' };

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
    if (line[0] === '?') { B.push({ k: 'prompt', text: line.slice(1).trim() }); continue; }
    if (line[0] === '*') {
      m = /^\*(\$(\d+))?\s*(.+?)\s*=>\s*(\S+)\s*(\{(.*)\})?$/.exec(line);
      if (!m) throw new Error('bad choice: ' + line);
      const c = { text: m[3], to: m[4], cost: m[2] ? +m[2] : 0, fx: parseFx(m[6] || '') };
      const last = B[B.length - 1];
      if (last && last.k === 'choice') last.opts.push(c);
      else { const pr = last && last.k === 'prompt' ? B.pop().text : ''; B.push({ k: 'choice', prompt: pr, opts: [c] }); }
      continue;
    }
    if (line[0] === '!') {
      const [cmd, ...rest] = line.slice(1).split(/\s+/); const arg = rest.join(' ');
      if (cmd === 'end') B.push({ k: 'end' });
      else if (cmd === 'cliff') B.push({ k: 'cliff', text: arg });
      else if (cmd === 'name') B.push({ k: 'name' });
      else if (cmd === 'letter') B.push({ k: 'letter', text: arg });
      else if (cmd === 'note') B.push({ k: 'note', text: arg });
      else if (['album', 'sticker', 'outfit', 'sfx'].includes(cmd)) B.push({ k: cmd, id: arg });
      else if (cmd === 'anim') B.push({ k: 'anim', id: rest[0], clip: rest[1] });
      else if (cmd === 'emote') B.push({ k: 'emote', id: rest[0], kind: rest[1] });
      else throw new Error('unknown command: ' + line);
      continue;
    }
    if ((m = /^([A-Z]+)(~)?(\[(\w+)\])?:?\s*(.+)$/.exec(line))) {
      B.push({ k: 'say', id: m[1].toLowerCase(), think: !!m[2], emo: m[4] || '', text: m[5].trim() });
      continue;
    }
    throw new Error('cannot parse: ' + line);
  }
  for (const c of chapters) for (const b of c.beats) {
    const targets = b.k === 'goto' || b.k === 'if' ? [b.to] : b.k === 'choice' ? b.opts.map(o => o.to) : [];
    for (const t of targets) if (!(t in c.labels)) throw new Error(`chapter ${c.n}: missing label ${t}`);
  }
  return chapters;
}
function parseFx(s) {
  const fx = { rel: {}, flags: [], album: [], sticker: [] };
  for (const tok of s.split(/\s+/).filter(Boolean)) {
    let m;
    if ((m = /^(\w+)([+-]\d+)$/.exec(tok))) fx.rel[m[1]] = +m[2];
    else if ((m = /^f:(\w+)$/.exec(tok))) fx.flags.push(m[1]);
    else if ((m = /^album:(\w+)$/.exec(tok))) fx.album.push(m[1]);
    else if ((m = /^sticker:(\w+)$/.exec(tok))) fx.sticker.push(m[1]);
  }
  return fx;
}
