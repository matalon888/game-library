// Cipherleaf quotes — public-domain only: traditional proverbs and lines by authors who died long before 1929.
// Format: "quote|source". Chosen to be kid-safe and readable in both US and UK English (original spellings kept).
const RAW = `
Actions speak louder than words.|Proverb
A journey of a thousand miles begins with a single step.|Chinese proverb
Where there is a will, there is a way.|Proverb
The early bird catches the worm.|Proverb
Many hands make light work.|Proverb
Practice makes perfect.|Proverb
Better late than never.|Proverb
Every cloud has a silver lining.|Proverb
Do not count your chickens before they hatch.|Aesop
Rome was not built in a day.|Proverb
Slow and steady wins the race.|Aesop
Look before you leap.|Proverb
Two heads are better than one.|Proverb
When in Rome, do as the Romans do.|Proverb
The pen is mightier than the sword.|Edward Bulwer-Lytton
All that glitters is not gold.|Proverb
Honesty is the best policy.|Proverb
A stitch in time saves nine.|Proverb
An apple a day keeps the doctor away.|Proverb
Birds of a feather flock together.|Proverb
Do not put all your eggs in one basket.|Proverb
Laughter is the best medicine.|Proverb
Necessity is the mother of invention.|Proverb
The grass is always greener on the other side of the fence.|Proverb
You cannot judge a book by its cover.|Proverb
A friend in need is a friend indeed.|Proverb
Great minds think alike.|Proverb
Haste makes waste.|Proverb
Knowledge is power.|Francis Bacon
No news is good news.|Proverb
Patience is a virtue.|Proverb
Still waters run deep.|Proverb
The best things in life are free.|Proverb
Time and tide wait for no man.|Proverb
Variety is the very spice of life.|William Cowper
You can lead a horse to water, but you cannot make it drink.|Proverb
Every dog has its day.|Proverb
Hope for the best and prepare for the worst.|Proverb
It is always darkest just before the dawn.|Thomas Fuller
Make hay while the sun shines.|Proverb
One good turn deserves another.|Proverb
Strike while the iron is hot.|Proverb
The squeaky wheel gets the grease.|Proverb
There is no place like home.|L. Frank Baum
Too many cooks spoil the broth.|Proverb
Absence makes the heart grow fonder.|Proverb
Beauty is in the eye of the beholder.|Proverb
Do not bite the hand that feeds you.|Proverb
Easy come, easy go.|Proverb
First things first.|Proverb
Good things come to those who wait.|Proverb
If at first you do not succeed, try, try again.|Thomas H. Palmer
Little strokes fell great oaks.|Benjamin Franklin
Out of sight, out of mind.|Proverb
Practice what you preach.|Proverb
The apple never falls far from the tree.|Proverb
Where there is smoke, there is fire.|Proverb
A watched pot never boils.|Proverb
All good things must come to an end.|Proverb
Better safe than sorry.|Proverb
Every little bit helps.|Proverb
Fools rush in where angels fear to tread.|Alexander Pope
Home is where the heart is.|Proverb
Learn to walk before you run.|Proverb
Old habits die hard.|Proverb
One step at a time.|Proverb
Rain does not fall on one roof alone.|Cameroonian proverb
A smooth sea never made a skilled sailor.|Proverb
He who hesitates is lost.|Proverb
The road to a friend's house is never long.|Danish proverb
A good laugh is sunshine in a house.|William Makepeace Thackeray
Tomorrow is another day.|Proverb
Waste not, want not.|Proverb
Fall seven times, stand up eight.|Japanese proverb
A bird in the hand is worth two in the bush.|Proverb
The more, the merrier.|Proverb
Two wrongs do not make a right.|Proverb
Do not cross the bridge until you come to it.|Proverb
A rolling stone gathers no moss.|Proverb
Well begun is half done.|Proverb
The best laid schemes of mice and men often go astray.|Robert Burns
A penny saved is a penny earned.|Proverb
Many a true word is spoken in jest.|Proverb
It is never too late to learn.|Proverb
A good beginning makes a good ending.|Proverb
Little and often fills the purse.|Proverb
Kind words are worth much and cost little.|Proverb
Well done is better than well said.|Benjamin Franklin
Early to bed and early to rise, makes a man healthy, wealthy, and wise.|Benjamin Franklin
Lost time is never found again.|Benjamin Franklin
Energy and persistence conquer all things.|Benjamin Franklin
Diligence is the mother of good luck.|Benjamin Franklin
Never leave that till tomorrow which you can do today.|Benjamin Franklin
A small leak will sink a great ship.|Benjamin Franklin
Either write things worth reading, or do things worth the writing.|Benjamin Franklin
Courage is resistance to fear, mastery of fear, not absence of fear.|Mark Twain
Always do right. This will gratify some people and astonish the rest.|Mark Twain
When in doubt, tell the truth.|Mark Twain
Good friends, good books, and a sleepy conscience: this is the ideal life.|Mark Twain
Name the greatest of all inventors. Accident.|Mark Twain
To live is the rarest thing in the world. Most people exist, that is all.|Oscar Wilde
Experience is the name everyone gives to their mistakes.|Oscar Wilde
I can resist everything except temptation.|Oscar Wilde
We are all in the gutter, but some of us are looking at the stars.|Oscar Wilde
Determine that the thing can and shall be done, and then we shall find the way.|Abraham Lincoln
Let us have faith that right makes might.|Abraham Lincoln
Nothing great was ever achieved without enthusiasm.|Ralph Waldo Emerson
The only way to have a friend is to be one.|Ralph Waldo Emerson
Adopt the pace of nature: her secret is patience.|Ralph Waldo Emerson
Hitch your wagon to a star.|Ralph Waldo Emerson
Write it on your heart that every day is the best day in the year.|Ralph Waldo Emerson
Our life is frittered away by detail. Simplify, simplify.|Henry David Thoreau
Heaven is under our feet as well as over our heads.|Henry David Thoreau
The sun is but a morning star.|Henry David Thoreau
All the world's a stage.|William Shakespeare
Brevity is the soul of wit.|William Shakespeare
The course of true love never did run smooth.|William Shakespeare
We know what we are, but know not what we may be.|William Shakespeare
Though she be but little, she is fierce.|William Shakespeare
There is nothing either good or bad, but thinking makes it so.|William Shakespeare
To thine own self be true.|William Shakespeare
How far that little candle throws his beams! So shines a good deed in a weary world.|William Shakespeare
Love all, trust a few, do wrong to none.|William Shakespeare
Better three hours too soon than a minute too late.|William Shakespeare
Some are born great, some achieve greatness, and some have greatness thrust upon them.|William Shakespeare
There is no charm equal to tenderness of heart.|Jane Austen
I declare after all there is no enjoyment like reading!|Jane Austen
One half of the world cannot understand the pleasures of the other.|Jane Austen
No one is useless in this world who lightens the burden of it for any one else.|Charles Dickens
Reflect upon your present blessings, of which every man has many.|Charles Dickens
Sometimes I have believed as many as six impossible things before breakfast.|Lewis Carroll
It is no use going back to yesterday, because I was a different person then.|Lewis Carroll
Begin at the beginning, and go on till you come to the end: then stop.|Lewis Carroll
I am not afraid of storms, for I am learning how to sail my ship.|Louisa May Alcott
To travel hopefully is a better thing than to arrive.|Robert Louis Stevenson
The world is so full of a number of things, I am sure we should all be as happy as kings.|Robert Louis Stevenson
Keep your fears to yourself, but share your courage with others.|Robert Louis Stevenson
Do what you can, with what you have, where you are.|Theodore Roosevelt
Keep your eyes on the stars, and your feet on the ground.|Theodore Roosevelt
Laughter is the sun that drives winter from the human face.|Victor Hugo
No act of kindness, no matter how small, is ever wasted.|Aesop
United we stand, divided we fall.|Aesop
Little friends may prove great friends.|Aesop
It is easy to be brave from a safe distance.|Aesop
Appearances are often deceiving.|Aesop
I am large, I contain multitudes.|Walt Whitman
Hope is the thing with feathers that perches in the soul.|Emily Dickinson
Forever is composed of nows.|Emily Dickinson
The truth must dazzle gradually.|Emily Dickinson
Into each life some rain must fall.|Henry Wadsworth Longfellow
Lives of great men all remind us we can make our lives sublime.|Henry Wadsworth Longfellow
Give what you have. To some one, it may be better than you dare to think.|Henry Wadsworth Longfellow
I attribute my success to this: I never gave or took any excuse.|Florence Nightingale
If there is no struggle, there is no progress.|Frederick Douglass
Just living is not enough. One must have sunshine, freedom, and a little flower.|Hans Christian Andersen
In every walk with nature one receives far more than he seeks.|John Muir
The mountains are calling and I must go.|John Muir
The two most powerful warriors are patience and time.|Leo Tolstoy
Great works are performed not by strength but by perseverance.|Samuel Johnson
To err is human, to forgive divine.|Alexander Pope
Hope springs eternal in the human breast.|Alexander Pope
To see a world in a grain of sand and a heaven in a wild flower.|William Blake
The busy bee has no time for sorrow.|William Blake
A thing of beauty is a joy for ever.|John Keats
What do we live for, if it is not to make life less difficult to each other?|George Eliot
I am no bird; and no net ensnares me.|Charlotte Bronte
I cannot live without books.|Thomas Jefferson
It is better to offer no excuse than a bad one.|George Washington
May you live all the days of your life.|Jonathan Swift
Vision is the art of seeing things invisible.|Jonathan Swift
The Owl and the Pussy-cat went to sea in a beautiful pea-green boat.|Edward Lear
Who has seen the wind? Neither I nor you.|Christina Rossetti
The secret of success is constancy to purpose.|Benjamin Disraeli
If I have seen further it is by standing on the shoulders of giants.|Isaac Newton
Chance favours only the prepared mind.|Louis Pasteur
All that we see or seem is but a dream within a dream.|Edgar Allan Poe
It is better to fail in originality than to succeed in imitation.|Herman Melville
A kind heart is a fountain of gladness.|Washington Irving
We must cultivate our garden.|Voltaire
The road is always better than the inn.|Miguel de Cervantes
The harder the conflict, the more glorious the triumph.|Thomas Paine
Curiouser and curiouser!|Lewis Carroll
If you are looking for perfect safety, you will do well to sit on a fence and watch the birds.|Wilbur Wright
Whatever you do, do it with all your might.|Proverb
`;
export const QUOTES = RAW.trim().split('\n').map(l => { const i = l.lastIndexOf('|'); return { text: l.slice(0, i).trim(), by: l.slice(i + 1).trim() }; });
