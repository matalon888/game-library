    document.addEventListener("visibilitychange", () => {
        document.title = document.hidden ? "You've got people to fight" : "Another Dungeon Game";
    });

    // ── Translations ──────────────────────────────────────────────────────
    let currentLang = localStorage.getItem('adg_lang') || 'en';

    const T = {
        en: {
            title:"ANOTHER DUNGEON GAME",subtitle:"Just another dungeon game",
            start:"START ADVENTURE",best:"BEST STATS",
            youDied:"YOU DIED",diedSub:"The dungeon claims another soul.",
            floorReached:"FLOOR REACHED",goldCollected:"GOLD COLLECTED",scrapFound:"SCRAP FOUND",
            enemiesSlain:"ENEMIES SLAIN",atkBonus:"ATK BONUS",defBonus:"DEF BONUS",
            tryAgain:"TRY AGAIN",bestRun:"BEST RUN",bestSub:"Your greatest achievement.",
            back:"BACK",controls:"CONTROLS:",wasd:"WASD",move:"Move",
            space:"SPACE",sword:"Sword",mouseF:"MOUSE / F",shootBow:"Shoot Bow",
            eKey:"E KEY",potion:"Potion",forge:"THE FORGE",shield:"SHIELD (2 SCRAP)",
            arrows5:"5 ARROWS (30G)",leave:"LEAVE",seller:"ARTIFACT SELLER",
            witch:"THE WITCH",potion40:"POTION (40G)",buyer:"SCRAP BUYER",
            sellScrap:"SELL SCRAP (+25G)",scrap:"SCRAP:",gold:"GOLD:",key:"KEY:",
            missing:"MISSING",ready:"READY",hp:"HP",floor:"FLOOR",atk:"ATK:",def:"DEF:",
            bossLabel:"The boss of the dungeons",cheater:"I'M A CHEATER",
            cheaterMsg:"Something feels different...",
            secretMsg:"SECRET MODE ACTIVE — you feel lucky!",
            continue:"CONTINUE ›",loseFocus:"You've got people to fight",gameTitle:"Another Dungeon Game",
            powerStone:"POWER STONE",ironCharm:"IRON CHARM",
            cheatLoaded:"🗡 Another Dungeon Game loaded — type Game.help() for cheat commands",
            cheatHelp1:"ANOTHER DUNGEON GAME — CHEATS",
            godMode:"GOD MODE: damage reduced to 1",
            cheaterMode:"CHEATER MODE ON",
            cheaterWarn:"⚠ The bosses know what you did.",
        },
        cz: {
            title:"DALŠÍ DUNGEON HRA",subtitle:"Jen další dungeon hra",
            start:"ZAČÍT DOBRODRUŽSTVÍ",best:"NEJLEPŠÍ STATY",
            youDied:"ZEMŘEL JSI",diedSub:"Dungeon si žádá další duši.",
            floorReached:"DOSAŽENÉ PATRO",goldCollected:"NASBÍRÁNO ZLATA",scrapFound:"NALEZENO ŠROTU",
            enemiesSlain:"ZABITO NEPŘÁTEL",atkBonus:"ÚTOK BONUS",defBonus:"OBRANA BONUS",
            tryAgain:"ZKUSIT ZNOVU",bestRun:"NEJLEPŠÍ BĚH",bestSub:"Tvůj největší úspěch.",
            back:"ZPĚT",controls:"OVLÁDÁNÍ:",wasd:"WASD",move:"Pohyb",
            space:"MEZERNÍK",sword:"Meč",mouseF:"MYŠ / F",shootBow:"Střelba z luku",
            eKey:"E",potion:"Lektvar",forge:"KOVÁRNA",shield:"ŠTÍT (2 ŠROTU)",
            arrows5:"5 ŠÍPŮ (30G)",leave:"ODEJÍT",seller:"PRODEJCE ARTEFAKTŮ",
            witch:"ČARODĚJNICE",potion40:"LEKTVAR (40G)",buyer:"VYKUPOVAČ ŠROTU",
            sellScrap:"PRODAT ŠROT (+25G)",scrap:"ŠROT:",gold:"ZLATO:",key:"KLÍČ:",
            missing:"CHYBÍ",ready:"PŘIPRAVEN",hp:"HP",floor:"PATRO",atk:"ÚTK:",def:"OBR:",
            bossLabel:"Vládce dungeonu",cheater:"JSEM CHEATER",
            cheaterMsg:"Něco je jinak...",
            secretMsg:"TAJNÝ REŽIM AKTIVNÍ — máš štěstí!",
            continue:"POKRAČOVAT ›",loseFocus:"Máš lidi k boji",gameTitle:"Další Dungeon Hra",
            powerStone:"KÁMEN SÍLY",ironCharm:"ŽELEZNÝ AMULET",
            cheatLoaded:"🗡 Další Dungeon Hra načtena — napiš Game.help() pro cheaty",
            cheatHelp1:"DALŠÍ DUNGEON HRA — CHEATY",
            godMode:"GOD MODE: poškození sníženo na 1",
            cheaterMode:"CHEATER MODE ZAPNUT",
            cheaterWarn:"⚠ Šéfové vědí, cos provedl.",
        }
    };

    const BOSS_TIERS_CZ = [
        { name: "Strážce Dungeonu",   portrait: "👁",  color: "#f44",
          lines: ["Další blázen vpadl do mých síní.", "Smrdíš povrchem. Sluncem.", "Ten pach tady skončí."],
          cheatLines: ["Počkat... cítím to na tobě.", "Hrabal ses v konzoli, že ano?", "Ubohé. Bojuj čestně, nebo nebojuj vůbec."] },
        { name: "Vex, Dutý Král", portrait: "💀", color: "#a0f",
          lines: ["Zabil jsi mého strážce. Působivé... nebo šťastné.", "Vládl jsem těmto hlubinám tři staletí.", "Budeš skvělým přírůstkem do mé sbírky kostí."],
          cheatLines: ["Smrdíš devtools a zoufalstvím.", "Viděl jsem, jak jsi psal Game.something() jako zbabělec.", "Tři staletí vlády, a ty mě urážíš cheaty."] },
        { name: "Propastná Tlama",      portrait: "🔥", color: "#f80",
          lines: ["HLADOVÝ.", "TAK DLOUHO BEZ MASA.", "POSLOUŽÍŠ."],
          cheatLines: ["HLADOVÝ.", "ALE CHEATERSKÉ MASO CHUTNÁ DIVNĚ.", "STEJNĚ TĚ SEŽERU."] },
        { name: "Vládce Zkázy",    portrait: "⚡", color: "#ff0",
          lines: ["Odvažuješ se vyzvat boha?", "Každé patro, které jsi přežil, byl můj dar.", "Teď ho beru zpět."],
          cheatLines: ["Bůh vidí vše. Včetně tvé konzole.", "Psal jsi příkazy jako vystrašený smrtelník.", "Tvá vypůjčená síla pro mě nic neznamená."] },
        { name: "Bezejmenný",         portrait: "❄️", color: "#0af",
          lines: ["...", "Došel jsi dál než kdokoli před tebou.", "Už nemám slov. Jen konec."],
          cheatLines: ["...", "Nezasloužil sis tuto hloubku.", "Nemám žádný respekt. Jen pohrdání."] },
        { name: "Nyx, Tkadlena Stínů", portrait: "🌑", color: "#a4f",
          lines: ["Stíny mi pošeptaly o tvém příchodu.", "Každý krok hlouběji živí mou temnotu.", "Tvé světlo pohasíná. Umírá."],
          cheatLines: ["I stíny mají oči, podvodníku.", "Viděla jsem každou klávesu, kterou jsi stiskl.", "Tvé triky jsou jen jiskry v mé věčné tmě."] },
        { name: "Korgath, Železný Tyran", portrait: "🗿", color: "#aaa",
          lines: ["Kdo se odvažuje vstoupit do říše Železného Tyrana?", "Mé brnění roztříštilo tisíc čepelí.", "Jsi jen škrábanec na mé oceli."],
          cheatLines: ["Železo se neohýbá před konzolovými triky.", "Tvé cheaty jsou rez. Já jsem kovaná ocel.", "Bojuj se mnou čestně, nebo vůbec."] },
        { name: "Morová Matka",     portrait: "🧪", color: "#6a4",
          lines: ["Čerstvé maso vstupuje do mého hnízda.", "Cítím tvůj strach ve vzduchu.", "Brzy nakrmíš mé děti."],
          cheatLines: ["Mor ignoruje tvé cheaty.", "Tvá vypůjčená síla zhnije jako všechno ostatní.", "Zkonzumovala jsem větší s menším."] },
        { name: "Zapomenutá Věštkyně",     portrait: "🔮", color: "#f0f",
          lines: ["Předpověděla jsem tvůj příchod, smrtelníku.", "Každá cesta, kterou jsi prošel, byla zapsána v mé kouli.", "Každá budoucnost končí tady. Se mnou."],
          cheatLines: ["Nepředpověděla jsem... konzoli.", "Přepisuješ osud svými ubohými funkcemi.", "Ale i osudoví podvodníci musí čelit soudu."] },
        { name: "Primus, První Strážce", portrait: "🏛️", color: "#ff4",
          lines: ["Tak. Došel jsi až na začátek.", "Každý strážce, kterého jsi zabil, byl můj žák.", "Teď čelíš prvnímu. Poslednímu."],
          cheatLines: ["První strážce vidí vše. Včetně DevTools.", "POSTAVIL jsem tento dungeon. Nemůžeš ho ošidit.", "Zavři konzoli. Čel tomu, pro co jsi přišel."] },
    ];

    function t(key) { return T[currentLang][key] || key; }

    function applyLang() {
        currentLang = document.getElementById("lang-select").value;
        localStorage.setItem('adg_lang', currentLang);
        document.querySelector("#ui-menu p").innerText = t("subtitle");
        document.getElementById("start-btn").innerText = t("start");
        document.getElementById("best-btn").innerText = t("best");
        document.querySelector("#ui-death h2").innerText = t("youDied");
        document.querySelector("#ui-death p").innerText = t("diedSub");
        document.querySelectorAll(".stat-row")[0].querySelector(".stat-label").innerText = t("floorReached");
        document.querySelectorAll(".stat-row")[1].querySelector(".stat-label").innerText = t("goldCollected");
        document.querySelectorAll(".stat-row")[2].querySelector(".stat-label").innerText = t("scrapFound");
        document.querySelectorAll(".stat-row")[3].querySelector(".stat-label").innerText = t("enemiesSlain");
        document.querySelectorAll(".stat-row")[4].querySelector(".stat-label").innerText = t("atkBonus");
        document.querySelectorAll(".stat-row")[5].querySelector(".stat-label").innerText = t("defBonus");
        document.getElementById("retry-btn").innerText = t("tryAgain");
        document.querySelector("#ui-best h2").innerText = t("bestRun");
        document.querySelector("#ui-best p").innerText = t("bestSub");
        document.querySelectorAll(".stat-row")[6].querySelector(".stat-label").innerText = t("floorReached");
        document.querySelectorAll(".stat-row")[7].querySelector(".stat-label").innerText = t("goldCollected");
        document.querySelectorAll(".stat-row")[8].querySelector(".stat-label").innerText = t("scrapFound");
        document.querySelectorAll(".stat-row")[9].querySelector(".stat-label").innerText = t("enemiesSlain");
        document.querySelectorAll(".stat-row")[10].querySelector(".stat-label").innerText = t("atkBonus");
        document.querySelectorAll(".stat-row")[11].querySelector(".stat-label").innerText = t("defBonus");
        document.getElementById("back-btn").innerText = t("back");
        document.getElementById("dialog-continue").innerText = t("continue");
        document.getElementById("cheater-banner").innerText = t("cheater");
        document.getElementById("forge-title").innerText = t("forge");
        document.getElementById("seller-title").innerText = t("seller");
        document.getElementById("witch-title").innerText = t("witch");
        document.getElementById("buyer-title").innerText = t("buyer");
        document.getElementById("btn-shield").innerText = t("shield");
        document.getElementById("btn-arrows").innerText = t("arrows5");
        document.getElementById("btn-leave-forge").innerText = t("leave");
        document.getElementById("btn-leave-seller").innerText = t("leave");
        document.getElementById("btn-heal").innerText = t("potion40");
        document.getElementById("btn-leave-witch").innerText = t("leave");
        document.getElementById("btn-sell").innerText = t("sellScrap");
        document.getElementById("btn-leave-buyer").innerText = t("leave");
        document.getElementById("boss-label").innerText = t("bossLabel");
        document.querySelector("#controls-tooltip b:first-child").innerText = t("controls");
        const tip = document.getElementById("controls-tooltip");
        const tipHTML = tip.innerHTML;
        tip.innerHTML = tipHTML.replace(/<b>WASD<\/b> - Move/, `<b>${t("wasd")}</b> - ${t("move")}`)
            .replace(/<b>SPACE<\/b> - Sword/, `<b>${t("space")}</b> - ${t("sword")}`)
            .replace(/<b>MOUSE \/ F<\/b> - Shoot Bow/, `<b>${t("mouseF")}</b> - ${t("shootBow")}`)
            .replace(/<b>E KEY<\/b> - Potion/, `<b>${t("eKey")}</b> - ${t("potion")}`);
        document.getElementById("label-hp").innerText = t("hp");
        document.getElementById("label-floor").innerText = t("floor");
        document.getElementById("label-atk").innerText = t("atk");
        document.getElementById("label-def").innerText = t("def");
        document.getElementById("label-scrap").innerText = t("scrap");
        document.getElementById("label-gold").innerText = t("gold");
        document.getElementById("label-key").innerText = t("key");
        updateArtifactButtons();
    }

    document.getElementById("lang-select").addEventListener('change', applyLang);
    document.getElementById("lang-select").value = currentLang;
    setTimeout(applyLang, 0);

    // ── Core game code ────────────────────────────────────────────────────
    const canvas = document.getElementById("ctx");
    const ctx = canvas.getContext("2d");
    const TILE = 40, ROWS = 10, COLS = 15;
    const urlEasterEgg = new URLSearchParams(window.location.search).get('easter') === 'egg';
    const icons = {};
    const imgList = ['sword', 'shield', 'bow', 'heal', 'gold', 'github'];
    imgList.forEach(n => { icons[n] = new Image(); icons[n].src = `assets/icons/${n}.png`; });

    // ── Floor type helpers ──────────────────────────────────────────────
    // Pattern per decade: X5 = market, X9 = market, X0 = boss (floor > 0)
    function isMarketFloor(f) { return f % 10 === 5 || f % 10 === 9; }
    function isBossFloor(f)   { return f % 10 === 0 && f > 0; }
    function isKeylessFloor(f){ return isMarketFloor(f) || isBossFloor(f); }

    // ── Boss dialog data ────────────────────────────────────────────────
    let cheaterDetected = false;

    const BOSS_TIERS = [
        { name: "The Dungeon Warden",   portrait: "👁",  color: "#f44",
          lines: ["So. Another fool stumbles into my halls.", "You reek of the surface. Of sunlight.", "That smell ends here."],
          cheatLines: ["Hold on... I can smell it on you.", "You've been fiddling with the console, haven't you?", "Pathetic. Fight me fairly or don't fight me at all."] },
        { name: "Vex, the Hollow King", portrait: "💀", color: "#a0f",
          lines: ["You killed my warden. Impressive... or lucky.", "I have ruled these depths for three centuries.", "You will make a fine addition to my collection of bones."],
          cheatLines: ["You reek of devtools and desperation.", "I watched you type Game.something() like a coward.", "Three centuries of rule, and you insult me with cheats."] },
        { name: "The Abyssal Maw",      portrait: "🔥", color: "#f80",
          lines: ["HUNGRY.", "SO LONG SINCE FLESH.", "YOU WILL DO."],
          cheatLines: ["HUNGRY.", "BUT CHEATER-FLESH TASTES WRONG.", "STILL EAT YOU ANYWAY."] },
        { name: "Sovereign of Ruin",    portrait: "⚡", color: "#ff0",
          lines: ["You dare challenge a god?", "Every floor you've survived was my gift to you.", "Now I take it back."],
          cheatLines: ["A god sees all. Including your console.", "You typed commands like a frightened mortal.", "Your borrowed power means nothing to me."] },
        { name: "The Nameless",         portrait: "❄️", color: "#0af",
          lines: ["...", "You have gone further than any before you.", "I have no words left. Only the end."],
          cheatLines: ["...", "You did not earn this depth.", "I have no respect left. Only contempt."] },
        { name: "Nyx, the Shadow Weaver", portrait: "🌑", color: "#a4f",
          lines: ["The shadows whispered of your coming.", "Every step deeper feeds my darkness.", "Your light flickers. It dies."],
          cheatLines: ["Even shadows have eyes, cheater.", "I saw every key you pressed.", "Your tricks are but sparks in my eternal dark."] },
        { name: "Korgath, the Iron Tyrant", portrait: "🗿", color: "#aaa",
          lines: ["Who dares enter the Iron Tyrant's domain?", "My armor has shattered a thousand blades.", "You are but a scratch on my steel."],
          cheatLines: ["Iron does not bend to console tricks.", "Your cheats are rust. I am forged steel.", "Face me with honor, or not at all."] },
        { name: "The Plague Matriarch",     portrait: "🧪", color: "#6a4",
          lines: ["Fresh flesh enters my nest.", "I can taste your fear in the air.", "Soon you will feed my children."],
          cheatLines: ["Plague ignores your cheats.", "Your borrowed strength will rot like everything else.", "I've consumed greater with less."] },
        { name: "The Forgotten Oracle",     portrait: "🔮", color: "#f0f",
          lines: ["I have foreseen your arrival, mortal.", "Every path you walked was written in my orb.", "Every future ends here. With me."],
          cheatLines: ["I did not foresee... the console.", "You rewrite fate with your petty functions.", "But even fate-benders must face judgment."] },
        { name: "Primus, the First Warden", portrait: "🏛️", color: "#ff4",
          lines: ["So. You made it to the beginning.", "Every warden you killed was my student.", "Now you face the first. The last."],
          cheatLines: ["The first warden sees all. Including DevTools.", "I BUILT this dungeon. You cannot cheat it.", "Close the console. Face what you came for."] },
    ];

    function getBossTier(f) {
        const idx = Math.floor(f / 10) - 1;
        const arr = currentLang === 'cz' ? BOSS_TIERS_CZ : BOSS_TIERS;
        return arr[idx % arr.length];
    }

    let dialogLines = [], dialogIdx = 0;

    function showBossDialog(tier) {
        dialogLines = cheaterDetected ? tier.cheatLines : tier.lines;
        dialogIdx = 0;
        document.getElementById("dialog-name").innerText = tier.name;
        document.getElementById("dialog-name").style.color = tier.color;
        document.getElementById("dialog-portrait").innerText = tier.portrait;
        document.getElementById("dialog-portrait").style.borderColor = tier.color;
        document.getElementById("dialog-text").innerText = dialogLines[0];
        document.getElementById("menu-dialog").style.display = "flex";
        paused = true;
    }

    function dialogNext() {
        dialogIdx++;
        if (dialogIdx < dialogLines.length) {
            document.getElementById("dialog-text").innerText = dialogLines[dialogIdx];
        } else {
            document.getElementById("menu-dialog").style.display = "none";
            paused = false;
            requestAnimationFrame(draw);
        }
    }

    // ── State ───────────────────────────────────────────────────────────
    let gameActive = false, paused = false;
    let floor = 1, gold = 0, scrap = 0, atkBonus = 0, defBonus = 0;
    let killCount = 0, easterClicks = 0, easterEgg = false, rainbowPlayer = false;
    let atkPurchases = 0, defPurchases = 0, cheatedThisRun = false;
    let totalGoldEarned = 0, totalScrapFound = 0;
    let player = { x: 1, y: 1, hp: 200, heals: 2, hasShield: false, shieldDur: 0, arrows: 10, hasKey: false, cooldown: 0 };
    let mousePos = { x: 0, y: 0 };
    let map = [], visited = [], enemies = [], chests = [], npcs = [], projectiles = [], bossProjectiles = [], orbs = [], keyPos = {x:-1,y:-1};
    let boss = null;
    let lastMoveDx = 0, lastMoveDy = -1;
    let mobileMoveInterval = null;
    let aimAngle = null;

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        mousePos.x = (e.clientX - rect.left) * scaleX;
        mousePos.y = (e.clientY - rect.top) * scaleY;
    });

    canvas.addEventListener('mousedown', (e) => {
        if (!gameActive || paused || e.button !== 0) return;
        if (player.arrows > 0 && player.cooldown <= 0) {
            const centerX = player.x * TILE + TILE/2;
            const centerY = player.y * TILE + TILE/2;
            const angle = Math.atan2(mousePos.y - centerY, mousePos.x - centerX);
            shootBow(angle);
        }
    });

    function spawnMinions(count) {
        for(let i=0; i<count; i++) {
            let ex, ey;
            do {
                ex = Math.floor(Math.random() * 8) + 4;
                ey = Math.floor(Math.random() * 6) + 2;
            } while (map[ey][ex] !== 0 || enemies.some(e => e.x === ex && e.y === ey));
            enemies.push({x: ex, y: ey, hp: 3, maxHp: 3, cooldown: 0, moveCooldown: 0, type: 'slime', isBossMinion: true});
        }
    }

    function initLevel() {
        let valid = false;
        boss = null; bossProjectiles = [];
        document.getElementById("boss-ui").style.display = "none";

        const isMarket = isMarketFloor(floor);
        const isBoss   = isBossFloor(floor);

        while (!valid) {
            map = []; visited = []; enemies = []; chests = []; npcs = []; projectiles = []; orbs = []; player.hasKey = false;

            for (let y = 0; y < ROWS; y++) {
                map[y] = []; visited[y] = [];
                for (let x = 0; x < COLS; x++) {
                    let edge = (x===0||x===COLS-1||y===0||y===ROWS-1);
                    map[y][x] = (edge || (!isMarket && !isBoss && Math.random()<0.2)) ? 1 : 0;
                    visited[y][x] = isBoss || isMarket;
                }
            }

            if (isMarket) {
                map[1][1] = 0; map[ROWS-2][COLS-2] = 2;
                player.hasKey = true;
                npcs.push({x: 2, y: 2, type: 'forge', color: '#888'}, {x: 12, y: 2, type: 'seller', color: '#0af'},
                          {x: 2, y: 7, type: 'witch', color: '#a0f'}, {x: 12, y: 7, type: 'buyer', color: '#fb0'});
                valid = true;
                player.x = 1; player.y = 1;
            } else if (isBoss) {
                player.hasKey = false;
                player.x = 2; player.y = 5;
                const tier = getBossTier(floor);
                const bossHp = 60 + (Math.floor(floor / 10) - 1) * 40;
                boss = { x: 11, y: 4, hp: bossHp, maxHp: bossHp, attackTimer: 1.5, aiming: false, aimTarget: null, aimTimer: 0, attackCount: 0, jumbleActive: false, jumbleTimer: 0 };
                document.getElementById("boss-ui").style.display = "block";
                document.getElementById("boss-label").innerText = tier.name.toUpperCase();
                document.getElementById("boss-label").style.color = tier.color;
                spawnMinions(5);
                valid = true;
                // Show dialog after level is set up
                setTimeout(() => { if (gameActive && boss) showBossDialog(tier); }, 50);
            } else {
                map[1][1] = 0; map[ROWS-2][COLS-2] = 2;
                let kx, ky; do { kx = Math.floor(Math.random()*13)+1; ky = Math.floor(Math.random()*8)+1; } while (map[ky][kx] !== 0);
                keyPos = {x: kx, y: ky};
                if (canReach(1, 1, kx, ky) && canReach(kx, ky, COLS-2, ROWS-2)) {
                    for(let i=0; i<3; i++) { let cx, cy; do { cx = Math.floor(Math.random()*13)+1; cy = Math.floor(Math.random()*8)+1; } while (map[cy][cx] !== 0); chests.push({x: cx, y: cy, type: Math.random()<0.3?'scrap':'gold'}); }
                    for(let i=0; i<Math.min(floor+1, 15); i++) {
                        let ex, ey; do { ex = Math.floor(Math.random()*10)+4; ey = Math.floor(Math.random()*7)+2; } while (map[ey][ex] !== 0);
                        enemies.push({x: ex, y: ey, hp: 6, maxHp: 6, cooldown: 0, moveCooldown: 0, type: 'grunt'});
                    }
                    // Slimes start appearing from floor 3, scale in number
                    const slimeCount = Math.min(Math.floor(floor / 3), 4);
                    for(let i=0; i<slimeCount; i++) {
                         let ex, ey; do { ex = Math.floor(Math.random()*10)+4; ey = Math.floor(Math.random()*7)+2; } while (map[ey][ex] !== 0 || enemies.some(e => e.x===ex && e.y===ey));
                        enemies.push({x: ex, y: ey, hp: 3, maxHp: 3, cooldown: 0, moveCooldown: 0, type: 'slime'});
                    }
                    // Fighters start appearing from floor 16, scale in number
                    const fighterCount = floor >= 60 ? 6 : floor >= 50 ? 5 : floor >= 40 ? 4 : floor >= 30 ? 3 : floor >= 20 ? 2 : floor >= 16 ? 1 : 0;
                    for(let i=0; i<fighterCount; i++) {
                        let ex, ey; do { ex = Math.floor(Math.random()*10)+4; ey = Math.floor(Math.random()*7)+2; } while (map[ey][ex] !== 0 || enemies.some(e => e.x===ex && e.y===ey));
                        enemies.push({x: ex, y: ey, hp: 10, maxHp: 10, cooldown: 0, moveCooldown: 0, type: 'fighter'});
                    }
                    valid = true;
                    player.x = 1; player.y = 1;
                }
            }
        }
    }

    function canReach(x1, y1, x2, y2) {
        let queue = [{x: x1, y: y1}];
        let seen = new Set([`${x1},${y1}`]);
        while(queue.length > 0) {
            let {x, y} = queue.shift();
            if (x === x2 && y === y2) return true;
            [[0,1],[0,-1],[1,0],[-1,0]].forEach(([dx, dy]) => {
                let nx = x+dx, ny = y+dy;
                if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS && map[ny][nx] !== 1 && !seen.has(`${nx},${ny}`)) {
                    seen.add(`${nx},${ny}`); queue.push({x: nx, y: ny});
                }
            });
        }
        return false;
    }

    function startGame() {
        gameActive = true; floor = 1; gold = 0; scrap = 0; atkBonus = 0; defBonus = 0; killCount = 0;
        totalGoldEarned = 0; totalScrapFound = 0; cheatedThisRun = false;
        document.getElementById("cheater-skull").style.display = "none";
        atkPurchases = 0; defPurchases = 0;
        player = { x:1, y:1, hp: 200, heals: 2, hasShield: false, shieldDur: 0, arrows: 10, hasKey: false, cooldown: 0 };
        if (easterEgg) {
            gold += 50; totalGoldEarned += 50;
            rainbowPlayer = true;
            easterEgg = false;
            console.log('%c🥚 SECRET MODE ACTIVE — you feel lucky!', 'color:#ff0; font-size:16px');
        }
        updateArtifactButtons();
        if (urlEasterEgg) { player.hasShield = true; player.shieldDur = 999999; }
        document.getElementById("ui-menu").style.display = "none";
        document.getElementById("ui-death").style.display = "none";
        initLevel(); requestAnimationFrame(draw);
    }

    function showDeathScreen() {
        gameActive = false;
        document.getElementById("death-floor").innerText = floor;
        document.getElementById("death-gold").innerText = totalGoldEarned + "G";
        document.getElementById("death-scrap").innerText = totalScrapFound;
        document.getElementById("death-kills").innerText = killCount;
        document.getElementById("death-atk").innerText = "+" + atkBonus;
        document.getElementById("death-def").innerText = defBonus;
        document.getElementById("ui-death").style.display = "flex";
        rainbowPlayer = false;
        saveHighScore();
    }

    function saveHighScore() {
        const current = { floor, gold: totalGoldEarned, scrap: totalScrapFound, kills: killCount, atk: atkBonus, def: defBonus, cheated: cheatedThisRun };
        const saved = JSON.parse(localStorage.getItem('adg_highscore') || 'null');
        if (!saved || current.floor > saved.floor) {
            localStorage.setItem('adg_highscore', JSON.stringify(current));
        }
    }

    function loadHighScore() {
        return JSON.parse(localStorage.getItem('adg_highscore') || 'null');
    }

    function showBestStats() {
        const best = loadHighScore();
        if (!best) return;
        if (best.cheated) {
            document.getElementById("cheater-banner").style.display = "block";
        } else {
            document.getElementById("cheater-banner").style.display = "none";
        }
        document.getElementById("best-floor").innerText = best.floor;
        document.getElementById("best-gold").innerText = best.gold + "G";
        document.getElementById("best-scrap").innerText = best.scrap;
        document.getElementById("best-kills").innerText = best.kills;
        document.getElementById("best-atk").innerText = "+" + best.atk;
        document.getElementById("best-def").innerText = best.def;
        document.getElementById("ui-menu").style.display = "none";
        document.getElementById("ui-best").style.display = "flex";
    }

    document.getElementById("start-btn").onclick = startGame;
    document.getElementById("retry-btn").onclick = startGame;
    document.getElementById("best-btn").onclick = showBestStats;
    document.getElementById("back-btn").onclick = () => {
        document.getElementById("ui-best").style.display = "none";
        document.getElementById("ui-menu").style.display = "flex";
    };

    document.getElementById("info-trigger").onclick = () => {
        easterClicks++;
        if (easterClicks >= 4 && !easterEgg) {
            easterEgg = true;
            const el = document.getElementById("info-trigger");
            el.innerText = "!";
            el.style.color = "#ff0";
            el.style.borderColor = "#ff0";
            setTimeout(() => { el.innerText = "?"; el.style.color = "#888"; el.style.borderColor = "#888"; }, 1200);
            console.log('%c🥚 Something feels different...', 'color:#ff0; font-size:14px');
        }
    };

    function tryMovePlayer(dx, dy) {
        if (!gameActive || paused) return;
        if (dx !== 0 || dy !== 0) { lastMoveDx = dx; lastMoveDy = dy; }
        let nx = player.x + dx;
        let ny = player.y + dy;
        if (map[ny] && map[ny][nx] !== 1) {
            let npc = npcs.find(n => n.x === nx && n.y === ny);
            if (npc) { paused = true; document.getElementById('menu-' + npc.type).style.display = 'flex'; return; }
            let ch = chests.find(c => c.x === nx && c.y === ny);
            if (ch) { if(ch.type === 'scrap') { scrap++; totalScrapFound++; } else { gold += 40; totalGoldEarned += 40; } chests = chests.filter(c => c !== ch); }
            let orb = orbs.find(o => o.x === nx && o.y === ny);
            if (orb) { if(orb.type === 'atk') atkBonus++; else defBonus++; orbs = orbs.filter(o => o !== orb); }
            if (nx === keyPos.x && ny === keyPos.y) player.hasKey = true;
            player.x = nx; player.y = ny;
        }
        if (map[player.y][player.x] === 2 && (player.hasKey || isKeylessFloor(floor))) { floor++; initLevel(); }
    }

    function swordAttack() {
        if (!gameActive || paused || player.cooldown > 0) return;
        if (boss && Math.abs(player.x - (boss.x+1)) <= 2 && Math.abs(player.y - (boss.y+1)) <= 2) {
            boss.hp -= (2 + atkBonus);
            if (boss.hp <= 0) { killCount++; orbs.push({x: boss.x+1, y: boss.y+1, type: Math.random()<0.5?'atk':'def'}); boss = null; document.getElementById("boss-ui").style.display = "none"; checkBossVictory(); }
        }
        for (let i = enemies.length - 1; i >= 0; i--) { const en = enemies[i]; if (en.dying) continue; if (Math.abs(en.x - player.x) <= 1 && Math.abs(en.y - player.y) <= 1) { en.hp -= (2 + atkBonus); if (en.hp <= 0) { en.dying = true; en.deathTimer = 3.0; if(!en.isBossMinion) { gold += 15; totalGoldEarned += 15; } killCount++; checkBossVictory(); } } }
        player.cooldown = 0.5;
    }

    function shootBow(angle) {
        if (!gameActive || paused || player.arrows <= 0 || player.cooldown > 0) return;
        projectiles.push({ x: player.x + 0.5, y: player.y + 0.5, vx: Math.cos(angle), vy: Math.sin(angle) });
        player.arrows--; player.cooldown = 0.3;
    }

    function healPlayer() {
        if (!gameActive || paused || player.heals <= 0) return;
        player.heals--; player.hp = Math.min(200, player.hp + 60);
    }

    window.onkeydown = e => {
        if (!gameActive || paused) return;
        let k = e.key.toLowerCase();
        if (k === 'w') tryMovePlayer(0, -1);
        else if (k === 's') tryMovePlayer(0, 1);
        else if (k === 'a') tryMovePlayer(-1, 0);
        else if (k === 'd') tryMovePlayer(1, 0);
        else if (k === 'e') healPlayer();
        else if (k === 'f') {
            const centerX = player.x * TILE + TILE/2;
            const centerY = player.y * TILE + TILE/2;
            shootBow(Math.atan2(mousePos.y - centerY, mousePos.x - centerX));
        } else if (e.key === ' ') swordAttack();
    };

    function updateEnemies() {
        if (boss && enemies.filter(e => !e.dying).length === 0) spawnMinions(5);
        for (let i = enemies.length - 1; i >= 0; i--) {
            const en = enemies[i];
            if (en.dying) {
                en.deathTimer -= 0.016;
                if (en.deathTimer <= 0) { enemies.splice(i, 1); }
                continue;
            }
            const isSlime = en.type === 'slime';
            const isFighter = en.type === 'fighter';
            const moveSpeed  = isSlime ? 0.45 : (isFighter ? 1.6 : 1.2);
            const attackDmg  = isSlime ? Math.max(1, 3 - defBonus) : (isFighter ? Math.max(1, 20 - defBonus) : Math.max(1, 10 - defBonus));
            const aggroRange = isSlime ? 12 : 10;

            if (en.cooldown > 0) en.cooldown -= 0.016;
            if (en.moveCooldown > 0) en.moveCooldown -= 0.016;
            let d = Math.abs(player.x - en.x) + Math.abs(player.y - en.y);
            if (d === 1 && en.cooldown <= 0) {
                if (player.hasShield && player.shieldDur > 0) { player.shieldDur--; if(player.shieldDur<=0) player.hasShield=false; }
                else player.hp -= attackDmg;
                en.cooldown = 1.0;
            } else if (d < aggroRange && d > 1 && en.moveCooldown <= 0) {
                let dx = player.x > en.x ? 1 : (player.x < en.x ? -1 : 0);
                let dy = player.y > en.y ? 1 : (player.y < en.y ? -1 : 0);
                if (dx !== 0 && map[en.y][en.x+dx] === 0 && !enemies.some(e => !e.dying && e.x === en.x+dx && e.y === en.y)) { en.x += dx; en.moveCooldown = moveSpeed; }
                else if (dy !== 0 && map[en.y+dy][en.x] === 0 && !enemies.some(e => !e.dying && e.x === en.x && e.y === en.y+dy)) { en.y += dy; en.moveCooldown = moveSpeed; }
            }
        }
    }

    function updateProjectiles() {
        for (let i = projectiles.length - 1; i >= 0; i--) {
            let p = projectiles[i]; p.x += p.vx * 0.25; p.y += p.vy * 0.25;
            if (map[Math.floor(p.y)]?.[Math.floor(p.x)] === 1) { projectiles.splice(i, 1); continue; }
            if (boss && p.x > boss.x && p.x < boss.x+3 && p.y > boss.y && p.y < boss.y+3) {
                boss.hp -= (2 + atkBonus); projectiles.splice(i, 1);
                if (boss.hp <= 0) { killCount++; orbs.push({x: boss.x+1, y: boss.y+1, type: Math.random()<0.5?'atk':'def'}); boss = null; document.getElementById("boss-ui").style.display = "none"; checkBossVictory(); }
                continue;
            }
            for (let ei = enemies.length - 1; ei >= 0; ei--) {
                const en = enemies[ei];
                if (en.dying) continue;
                if (Math.abs(p.x - (en.x+0.5)) < 0.4 && Math.abs(p.y - (en.y+0.5)) < 0.4) {
                    const arrowDmg = en.type === 'slime' ? 1 : (2 + atkBonus);
                    en.hp -= arrowDmg;
                    projectiles.splice(i, 1);
                    if (en.hp <= 0) { en.dying = true; en.deathTimer = 3.0; if(!en.isBossMinion) { gold += 15; totalGoldEarned += 15; if(Math.random()<0.3) { scrap++; totalScrapFound++; } } killCount++; checkBossVictory(); }
                    break;
                }
            }
        }
    }

    function updateBoss() {
        if (!boss || paused) return;

        if (boss.jumbleActive) {
            boss.jumbleTimer -= 0.016;
            if (boss.jumbleTimer <= 0) {
                const jx1 = boss.x - 5, jy1 = boss.y - 5, jx2 = boss.x + 7, jy2 = boss.y + 7;
                if (player.x >= jx1 && player.x <= jx2 && player.y >= jy1 && player.y <= jy2) {
                    if (player.hasShield && player.shieldDur > 0) {
                        player.shieldDur--;
                        if (player.shieldDur <= 0) player.hasShield = false;
                    } else {
                        player.hp -= Math.max(1, 30 - defBonus);
                    }
                    const cx = boss.x + 1.5, cy = boss.y + 1.5;
                    const dx = player.x > cx ? 1 : (player.x < cx ? -1 : 0);
                    const dy = player.y > cy ? 1 : (player.y < cy ? -1 : 0);
                    for (let s = 0; s < 2; s++) {
                        const nx = player.x + dx, ny = player.y + dy;
                        if (map[ny]?.[nx] !== undefined && map[ny][nx] !== 1 && !enemies.some(e => e.x === nx && e.y === ny)) {
                            player.x = nx; player.y = ny;
                        } else break;
                    }
                }
                boss.jumbleActive = false;
                boss.attackCount = (boss.attackCount + 1) % 3;
                boss.attackTimer = 3.0 + Math.random() * 2.0;
            }
        } else if (boss.aiming) {
            boss.aimTimer -= 0.016;
            if (boss.aimTimer <= 0) {
                const bx = boss.x * TILE + TILE * 1.5;
                const by = boss.y * TILE + TILE * 1.5;
                const tx = boss.aimTarget.x * TILE + TILE / 2;
                const ty = boss.aimTarget.y * TILE + TILE / 2;
                const angle = Math.atan2(ty - by, tx - bx);
                bossProjectiles.push({
                    x: bx / TILE, y: by / TILE,
                    vx: Math.cos(angle) * 0.08,
                    vy: Math.sin(angle) * 0.08
                });
                boss.aiming = false;
                boss.aimTarget = null;
                boss.attackCount = (boss.attackCount + 1) % 3;
                boss.attackTimer = 3.0 + Math.random() * 2.0;
            }
        } else {
            boss.attackTimer -= 0.016;
            if (boss.attackTimer <= 0) {
                if (boss.attackCount >= 2) {
                    boss.jumbleActive = true;
                    boss.jumbleTimer = 2.0;
                } else {
                    boss.aimTarget = { x: player.x, y: player.y };
                    boss.aimTimer = 2.0;
                    boss.aiming = true;
                }
            }
        }

        for (let i = bossProjectiles.length - 1; i >= 0; i--) {
            const bp = bossProjectiles[i];
            bp.x += bp.vx;
            bp.y += bp.vy;
            if (map[Math.floor(bp.y)]?.[Math.floor(bp.x)] === 1) {
                bossProjectiles.splice(i, 1);
                continue;
            }
            if (Math.abs(bp.x - (player.x + 0.5)) < 0.5 && Math.abs(bp.y - (player.y + 0.5)) < 0.5) {
                if (player.hasShield && player.shieldDur > 0) {
                    player.shieldDur--;
                    if (player.shieldDur <= 0) player.hasShield = false;
                } else {
                    player.hp -= Math.max(1, 15 - defBonus);
                }
                bossProjectiles.splice(i, 1);
            }
        }
    }

    function checkBossVictory() {
        if (!boss && enemies.length === 0 && isBossFloor(floor)) {
            player.hasKey = true;
            map[ROWS-2][COLS-2] = 2;
        }
    }

    function buyHeal() { if(gold >= 40) { gold -= 40; player.heals++; } }
    function buyArrows() { if(gold >= 30) { gold -= 30; player.arrows += 5; } }
    function buyShield() { if(scrap >= 2) { scrap -= 2; player.hasShield = true; player.shieldDur = 10; } }
    function buyArtifact(type) {
        const count = type === 'atk' ? atkPurchases : defPurchases;
        const price = 300 + (count * 300);
        if (gold >= price) {
            gold -= price;
            if (type === 'atk') { atkBonus++; atkPurchases++; }
            else { defBonus++; defPurchases++; }
            updateArtifactButtons();
        }
    }
    function updateArtifactButtons() {
        document.getElementById("btn-atk").innerText = `${t("powerStone")} (${300 + atkPurchases * 300}G)`;
        document.getElementById("btn-def").innerText = `${t("ironCharm")} (${300 + defPurchases * 300}G)`;
    }
    function sellScrap() { if(scrap >= 1) { scrap -= 1; gold += 25; totalGoldEarned += 25; } }
    function closeMenus() { paused = false; document.querySelectorAll('.ui-panel').forEach(p => { if(p.id !== 'ui-menu' && p.id !== 'ui-death') p.style.display = 'none'; }); }

    // ── Mobile touch controls ────────────────────────────────────────────
    function mobileMoveInDir(dir) {
        if (dir === 'up') tryMovePlayer(0, -1);
        else if (dir === 'down') tryMovePlayer(0, 1);
        else if (dir === 'left') tryMovePlayer(-1, 0);
        else if (dir === 'right') tryMovePlayer(1, 0);
    }

    function startMobileMove(dir) {
        if (mobileMoveInterval) clearInterval(mobileMoveInterval);
        mobileMoveInDir(dir);
        mobileMoveInterval = setInterval(() => mobileMoveInDir(dir), 130);
    }

    function stopMobileMove() {
        if (mobileMoveInterval) { clearInterval(mobileMoveInterval); mobileMoveInterval = null; }
        document.querySelectorAll('.dpad-btn.pressed').forEach(b => b.classList.remove('pressed'));
    }

    document.getElementById('dpad').addEventListener('touchstart', (e) => {
        e.preventDefault();
        const btn = e.target.closest('.dpad-btn');
        if (!btn || !gameActive || paused) return;
        btn.classList.add('pressed');
        startMobileMove(btn.dataset.dir);
    }, { passive: false });

    document.getElementById('dpad').addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const el = document.elementFromPoint(touch.clientX, touch.clientY);
        const btn = el ? el.closest('.dpad-btn') : null;
        if (btn && btn.dataset.dir) {
            document.querySelectorAll('.dpad-btn.pressed').forEach(b => { if (b !== btn) b.classList.remove('pressed'); });
            btn.classList.add('pressed');
            if (mobileMoveInterval) clearInterval(mobileMoveInterval);
            mobileMoveInDir(btn.dataset.dir);
            mobileMoveInterval = setInterval(() => mobileMoveInDir(btn.dataset.dir), 130);
        }
    }, { passive: false });

    document.getElementById('dpad').addEventListener('touchend', (e) => { e.preventDefault(); stopMobileMove(); }, { passive: false });
    document.getElementById('dpad').addEventListener('touchcancel', stopMobileMove);

    function mobileShootBow() {
        const centerX = player.x * TILE + TILE/2;
        const centerY = player.y * TILE + TILE/2;
        shootBow(Math.atan2(mousePos.y - centerY, mousePos.x - centerX));
    }

    // ── Aim joystick ────────────────────────────────────────────────────
    function updateJoystick(touch) {
        const joystick = document.getElementById('aim-joystick');
        const thumb = document.getElementById('aim-thumb');
        const rect = joystick.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const maxR = rect.width / 2 - thumb.offsetWidth / 2 - 2;
        let dx = touch.clientX - cx;
        let dy = touch.clientY - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxR) { dx = dx / dist * maxR; dy = dy / dist * maxR; }
        aimAngle = Math.atan2(dy, dx);
        thumb.style.left = `calc(50% + ${dx}px)`;
        thumb.style.top = `calc(50% + ${dy}px)`;
        thumb.style.transform = 'translate(-50%, -50%)';
    }

    function resetJoystick() {
        aimAngle = null;
        const thumb = document.getElementById('aim-thumb');
        thumb.style.left = '50%';
        thumb.style.top = '50%';
        thumb.style.transform = 'translate(-50%, -50%)';
    }

    const aimJs = document.getElementById('aim-joystick');
    aimJs.addEventListener('touchstart', (e) => { e.preventDefault(); updateJoystick(e.touches[0]); }, { passive: false });
    aimJs.addEventListener('touchmove', (e) => { e.preventDefault(); updateJoystick(e.touches[0]); }, { passive: false });
    aimJs.addEventListener('touchend', (e) => { e.preventDefault(); resetJoystick(); }, { passive: false });
    aimJs.addEventListener('touchcancel', resetJoystick);

    document.getElementById('btn-touch-sword').addEventListener('touchstart', (e) => { e.preventDefault(); swordAttack(); }, { passive: false });
    document.getElementById('btn-touch-bow').addEventListener('touchstart', (e) => { e.preventDefault(); mobileShootBow(); }, { passive: false });
    document.getElementById('btn-touch-heal').addEventListener('touchstart', (e) => { e.preventDefault(); healPlayer(); }, { passive: false });

    // ── Console cheat commands ──────────────────────────────────────────
    const _cheat = () => { cheaterDetected = true; cheatedThisRun = true; document.getElementById("cheater-skull").style.display = "block"; };

    window.Game = {
        // Gold & resources
        addGold:   (n = 100)  => { _cheat(); gold += n;  console.log(`%c+${n} gold (total: ${gold})`, 'color:#fb0'); },
        addScrap:  (n = 5)    => { _cheat(); scrap += n; console.log(`%c+${n} scrap (total: ${scrap})`, 'color:#aaa'); },
        setGold:   (n = 999)  => { _cheat(); gold = n;   console.log(`%cGold set to ${gold}`, 'color:#fb0'); },

        // Combat
        addAtk:    (n = 1)    => { _cheat(); atkBonus += n; console.log(`%cATK bonus: +${atkBonus}`, 'color:#f44'); },
        addDef:    (n = 1)    => { _cheat(); defBonus += n; console.log(`%cDEF bonus: ${defBonus}`, 'color:#0af'); },
        heal:      (n = 200)  => { _cheat(); player.hp = Math.min(200, player.hp + n); console.log(`%cHP: ${player.hp}/200`, 'color:#f44'); },
        godMode:   ()         => { _cheat(); defBonus = 999; console.log('%cGOD MODE: damage reduced to 1', 'color:#ff0'); },

        // Items
        addArrows: (n = 50)   => { _cheat(); player.arrows += n; console.log(`%c+${n} arrows (total: ${player.arrows})`, 'color:#8b4513'); },
        addHeals:  (n = 5)    => { _cheat(); player.heals += n;  console.log(`%c+${n} potions (total: ${player.heals})`, 'color:#a0f'); },
        giveShield:()         => { _cheat(); player.hasShield = true; player.shieldDur = 10; console.log('%cShield restored (10 charges)', 'color:#0af'); },

        // Floor navigation
        nextFloor: ()         => { _cheat(); floor++; initLevel(); console.log(`%cJumped to floor ${floor}`, 'color:#0f0'); },
        gotoFloor: (n = 1)    => { _cheat(); if(!gameActive){console.log('%cStart the game first!','color:#f44');return;} floor = Math.max(1, n); initLevel(); console.log(`%cWarped to floor ${floor}`, 'color:#0f0'); },
        getKey:    ()         => { _cheat(); player.hasKey = true; if(map[ROWS-2]) map[ROWS-2][COLS-2] = 2; console.log('%cKey obtained — exit unlocked', 'color:#0f0'); },

        // Nuclear option
        cheater:   ()         => {
            _cheat();
            gold = 9999; scrap = 99; atkBonus = 10; defBonus = 10;
            player.hp = 200; player.heals = 20; player.arrows = 99;
            player.hasShield = true; player.shieldDur = 10; player.hasKey = true;
            if(map[ROWS-2]) map[ROWS-2][COLS-2] = 2;
            console.log('%c╔══════════════════════╗', 'color:#ff0');
            console.log('%c║   CHEATER MODE ON    ║', 'color:#ff0; font-weight:bold');
            console.log('%c╚══════════════════════╝', 'color:#ff0');
            console.log('%cGold: 9999 | Scrap: 99 | ATK: +10 | DEF: 10 | HP: 200 | Arrows: 99 | Heals: 20', 'color:#aaa');
            console.log('%c⚠ The bosses know what you did.', 'color:#f44; font-style:italic');
        },

        // Info
        help: () => {
            console.log('%c╔═══════════════════════════════════════╗', 'color:#0af');
            console.log('%c║       ANOTHER DUNGEON GAME — CHEATS  ║', 'color:#0af; font-weight:bold');
            console.log('%c╠═══════════════════════════════════════╣', 'color:#0af');
            console.log('%cGame.addGold(n)    — add n gold (default 100)', 'color:#fb0');
            console.log('%cGame.addScrap(n)   — add n scrap (default 5)', 'color:#aaa');
            console.log('%cGame.setGold(n)    — set gold to exact amount', 'color:#fb0');
            console.log('%cGame.addAtk(n)     — add n ATK bonus (default 1)', 'color:#f44');
            console.log('%cGame.addDef(n)     — add n DEF bonus (default 1)', 'color:#0af');
            console.log('%cGame.heal(n)       — restore n HP (default 200)', 'color:#f44');
            console.log('%cGame.godMode()     — take only 1 damage per hit', 'color:#ff0');
            console.log('%cGame.addArrows(n)  — add n arrows (default 50)', 'color:#8b4513');
            console.log('%cGame.addHeals(n)   — add n potions (default 5)', 'color:#a0f');
            console.log('%cGame.giveShield()  — restore shield (10 charges)', 'color:#0af');
            console.log('%cGame.nextFloor()   — advance one floor', 'color:#0f0');
            console.log('%cGame.gotoFloor(n)  — warp to specific floor', 'color:#0f0');
            console.log('%cGame.getKey()      — unlock the exit door', 'color:#0f0');
            console.log('%cGame.cheater()     — give absolutely everything', 'color:#ff0; font-weight:bold');
            console.log('%c╚═══════════════════════════════════════╝', 'color:#0af');
        }
    };
    console.log('%c🗡 Another Dungeon Game loaded — type Game.help() for cheat commands', 'color:#0f0; font-style:italic');

    function draw() {
        if (!gameActive || paused) { if(gameActive) requestAnimationFrame(draw); return; }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (player.cooldown > 0) player.cooldown -= 0.016;
        updateEnemies(); updateBoss(); updateProjectiles();

        for(let y=0; y<ROWS; y++) for(let x=0; x<COLS; x++) if(Math.hypot(x-player.x, y-player.y) < 4) visited[y][x] = true;
        for (let y=0; y<ROWS; y++) for (let x=0; x<COLS; x++) {
            if (visited[y][x]) {
                ctx.fillStyle = map[y][x] === 1 ? "#333" : (map[y][x] === 2 ? (player.hasKey || isKeylessFloor(floor) ? "#0af" : "#f00") : "#111");
                ctx.fillRect(x*TILE, y*TILE, TILE-1, TILE-1);
            }
        }

        if (aimAngle !== null) {
            mousePos.x = player.x * TILE + 20 + Math.cos(aimAngle) * 80;
            mousePos.y = player.y * TILE + 20 + Math.sin(aimAngle) * 80;
        }

        ctx.strokeStyle = "rgba(0, 255, 255, 0.6)";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(player.x * TILE + 20, player.y * TILE + 20);
        ctx.lineTo(mousePos.x, mousePos.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 1;

        projectiles.forEach(p => { ctx.fillStyle = "#8b4513"; ctx.fillRect(p.x*TILE-4, p.y*TILE-4, 8, 8); });
        chests.forEach(c => { if(visited[c.y][c.x]) { ctx.fillStyle = "#d80"; ctx.fillRect(c.x*TILE+10, c.y*TILE+15, 20, 15); } });
        orbs.forEach(o => { if(visited[o.y] && visited[o.y][o.x]) { ctx.fillStyle = "#a0f"; ctx.beginPath(); ctx.arc(o.x*TILE+20, o.y*TILE+20, 8, 0, Math.PI*2); ctx.fill(); } });
        npcs.forEach(n => { ctx.fillStyle = n.color; ctx.fillRect(n.x*TILE+8, n.y*TILE+8, 24, 24); });

        if(!player.hasKey && visited[keyPos.y]?.[keyPos.x] && !isKeylessFloor(floor)) {
            ctx.fillStyle = "#fb0"; ctx.beginPath(); ctx.arc(keyPos.x*TILE+20, keyPos.y*TILE+20, 6, 0, 7); ctx.fill();
        }

        if (boss) {
            ctx.fillStyle = "#911";
            ctx.fillRect(boss.x*TILE, boss.y*TILE, TILE*3-2, TILE*3-2);
            document.getElementById("boss-bar-fill").style.width = (boss.hp / boss.maxHp * 100) + "%";

            if (boss.aiming && boss.aimTarget) {
                const bx = boss.x * TILE + TILE * 1.5;
                const by = boss.y * TILE + TILE * 1.5;
                const tx = boss.aimTarget.x * TILE + TILE / 2;
                const ty = boss.aimTarget.y * TILE + TILE / 2;
                const blink = Math.floor(Date.now() / 250) % 2 === 0;
                if (blink) {
                    ctx.strokeStyle = "#f44";
                    ctx.lineWidth = 3;
                    ctx.setLineDash([8, 8]);
                    ctx.beginPath();
                    ctx.moveTo(bx, by);
                    ctx.lineTo(tx, ty);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.lineWidth = 1;
                }
            }

            if (boss.jumbleActive) {
                const blink = Math.floor(Date.now() / 250) % 2 === 0;
                if (blink) {
                    const jx1 = boss.x - 5, jy1 = boss.y - 5;
                    ctx.fillStyle = "rgba(128, 128, 128, 0.4)";
                    for (let yy = jy1; yy <= jy1 + 12; yy++) {
                        for (let xx = jx1; xx <= jx1 + 12; xx++) {
                            if (yy >= 0 && yy < ROWS && xx >= 0 && xx < COLS) {
                                ctx.fillRect(xx * TILE, yy * TILE, TILE - 1, TILE - 1);
                            }
                        }
                    }
                }
            }
        }

        bossProjectiles.forEach(bp => {
            ctx.fillStyle = "#d22";
            ctx.beginPath();
            ctx.arc(bp.x * TILE, bp.y * TILE, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#f80";
            ctx.beginPath();
            ctx.arc(bp.x * TILE, bp.y * TILE, 3, 0, Math.PI * 2);
            ctx.fill();
        });

        enemies.forEach(en => {
            if(visited[en.y][en.x]) {
                if (en.dying) {
                    ctx.save();
                    ctx.globalAlpha = en.deathTimer / 3.0;
                    ctx.fillStyle = "#555";
                    if (en.type === 'slime') {
                        ctx.beginPath();
                        ctx.arc(en.x*TILE+20, en.y*TILE+22, 10, 0, Math.PI*2);
                        ctx.fill();
                    } else {
                        ctx.fillRect(en.x*TILE+10, en.y*TILE+10, 20, 20);
                    }
                    ctx.restore();
                    return;
                }
                const hue = urlEasterEgg ? ((Date.now() / 10 + en.x * 30) % 360) : 0;
                if (en.type === 'slime') {
                    ctx.fillStyle = urlEasterEgg ? `hsl(${hue}, 100%, 50%)` : (en.cooldown > 0 ? "#292" : "#4f4");
                    ctx.beginPath();
                    ctx.arc(en.x*TILE+20, en.y*TILE+22, 10, 0, Math.PI*2);
                    ctx.fill();
                    for(let i=0; i<en.maxHp; i++) { ctx.fillStyle = i < en.hp ? "#0f0" : "#400"; ctx.fillRect(en.x*TILE+8 + i*8, en.y*TILE-6, 6, 5); }
                } else if (en.type === 'fighter') {
                    ctx.fillStyle = urlEasterEgg ? `hsl(${hue}, 100%, 50%)` : (en.cooldown > 0 ? "#840" : "#fa0");
                    ctx.fillRect(en.x*TILE+10, en.y*TILE+10, 20, 20);
                    for(let i=0; i<en.maxHp; i++) { ctx.fillStyle = i < en.hp ? "#0f0" : "#400"; ctx.fillRect(en.x*TILE+5 + i*3, en.y*TILE-6, 2, 5); }
                } else {
                    ctx.fillStyle = urlEasterEgg ? `hsl(${hue}, 100%, 50%)` : (en.cooldown > 0 ? "#611" : "#f44"); ctx.fillRect(en.x*TILE+10, en.y*TILE+10, 20, 20);
                    for(let i=0; i<en.maxHp; i++) { ctx.fillStyle = i < en.hp ? "#0f0" : "#400"; ctx.fillRect(en.x*TILE+4 + i*5, en.y*TILE-6, 4, 5); }
                }
            }
        });
        if (urlEasterEgg) {
            ctx.fillStyle = "#f00";
        } else if (rainbowPlayer) {
            const hue = (Date.now() / 10) % 360;
            ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        } else {
            ctx.fillStyle = "#0f0";
        }
        ctx.fillRect(player.x*TILE+12, player.y*TILE+12, 16, 16);

        document.getElementById("hp").innerText = player.hp;
        document.getElementById("floor").innerText = floor;
        document.getElementById("atk-bonus").innerText = atkBonus;
        document.getElementById("def-bonus").innerText = defBonus;
        document.getElementById("bar-scrap").innerText = scrap;
        document.getElementById("bar-gold").innerText = gold;
        document.getElementById("bar-key").innerText = (player.hasKey || isKeylessFloor(floor)) ? t("ready") : t("missing");
        document.getElementById("bar-key").style.color = (player.hasKey || isKeylessFloor(floor)) ? "#0f0" : "#f44";
        document.getElementById("heal-count").innerText = player.heals;
        document.getElementById("arrow-count").innerText = player.arrows;
        document.getElementById("dur-bar").style.width = (player.shieldDur * 10) + "%";
        document.getElementById("img-shield").style.display = player.hasShield ? "block" : "none";
        document.getElementById("img-sword").style.display = "block";
        document.getElementById("img-bow").style.display = "block";
        document.getElementById("img-heal").style.display = player.heals > 0 ? "block" : "none";

        if(player.hp <= 0) { showDeathScreen(); return; }
        requestAnimationFrame(draw);
    }
