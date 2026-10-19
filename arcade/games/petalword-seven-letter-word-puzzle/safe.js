// safe.js — kid-safe filter for words.js: grown-up, rude, violent, drug/alcohol/gambling, religious and slur words never
// appear as answers, hints or "words you missed" lists, and are not accepted as guesses. Our own code, MIT.
import { WORDS } from './words.js';
const BLOCK = new Set(`abort aborted aborts abuse abused abuser abusers abuses addict addicts alcohol ale ales anuses arsenic asexual assault
bawdy bayonet beer beers bet bets betcha betted betting bettor bettors bewitch bible bikini bikinis bitched bitches bleed bleeds blood blooded bloods bloody
bomb bombard bombed bomber bombers bombing bombs booby booty booze bosom bosoms bowel bowels bra brandy breast breasts brew brewed brewery brewing brews
bugger buggers bum bummed bummer bummest bumming bums buttock butts casino casinos chinks church churches cider cigar cigars cocked cockier cocking cocks cocky
coffin condom condoms corpse corpses coward cowards cretin cripple crotch cum cumming cums damn damned damning damns dead deaden deadens deader deadest deadly
death deaths demon demons devil devils dope doped dopes dopey drugged drunk drunken drunker drunks dumb dumber dumbest dung dunged dunging dungs enema erotic
execute faggots fatties fatty filth filthy flirt flirted flirts fondle fondled fondles funeral gamble gambled gambler gambles gay gayer gayest gays gin gins ginned ginning
god goddess godless godlier godlike godly gods godsend gore gored gores grenade groin groins grope groped gropes gun gunfire gunman gunmen gunned gunner gunners
gunning guns gunshot hag hags harass harem harlot harlots hate hated hateful hates hating hatred hearse hearses hell hellish heroin heroins hooker hornier horny
hostage idiot idiotic idiots incest inject injects insane insaner jackpot jerk jerked jerkier jerking jerks junkie junkies kidnap kidnaps kill killed killer killers
killing kills kink kinked kinkier kinking kinks kinky kiss kissed kisses kissing knife knifed knifes lager lesbian lewd lewder lewdest liquor liquors loony lord lorded
lording lords loser losers lottery lover lovers lunatic lust lusted lustier lusting lusts lusty lynch lynched lynches madam madame madams madman madmen maim maimed
maiming maims maniac maniacs midget midgets missile molest molests moron moronic morons mosque murder murders naked nipple nipples noose nooses nude nuder nudest
nudity nun nuns obese obscene opium orgasm ovary penis penises pervert pill pills pistol pistols poker pokers poop pooped pooping poops pray prayed prayer prayers
praying prays prick pricks priest priests pub pubs puberty puke puked pukes queer queers racism racist racists rape rapes rapist rapists rectum rectums retard retards
rifle rifled rifles rum rums rump rumps saloon satanic screw screwed screws screwy scum scummed scums seduce seduced seduces sensual sex sexed sexes sexing sexism
sexist sexual sherry shotgun sin sinful sinner sins slag slain slave slaved slavery slaves slay slaying slays slut sluts smoke smoked smoker smokers smokes smoking
smut sniper sodomy sperm sperms stab stabbed stabs stoned stupid stupids suck sucked sucker suckers sucking sucks suicide swine swines sword swords syringe
tart tarts tavern testes testis thigh thighs thong thongs tipsy tobacco torture toupee undress undying urinate urine vagina vaginae vaginal virgin virgins vodka vomit
vomited vomits vulgar wager wagered wagers weapon weapons weed weeded weedier weeding weeds weedy whisky whiskys whore whores wine wined wines witch witched witches
womb wound wounded wounds dying die died dies terror terrors panties hump humped humping humps lick licked licking licks nutty nuttier crummy junk butt`.split(/\s+/));
export const SAFE = WORDS.filter(w => /^[a-z]+$/.test(w) && !BLOCK.has(w));
export const isBlocked = (w) => BLOCK.has(w);
