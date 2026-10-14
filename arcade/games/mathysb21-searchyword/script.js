const sideLength = 21; // min 12, max 110, 21 is optimal for most screens
const areaPerWord = 26; // Reducing will make the words more dense, but can cause issues when the sideLength goes too low, 32 is optimal
const tableRows = sideLength;
const tableColumns = sideLength;
const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
// const words = ['Halibut', 'Lystrosaurus', 'Stonefish', 'Alligator', 'Dachshund', 'Kiwi', 'Rhinoceros', 'Tigerfish', 'Brachiosaurus', 'Yorkie', 'Wasp', 'Sheep', 'Wallaby', 'Armadillo', 'Guppy', 'Fossa', 'Anteosaurus', 'Anaconda', 'Jackal', 'Dalmatian', 'Llama', 'Goldfish', 'Shrimp', 'Emu', 'Hamster', 'Nightingale', 'Hawk', 'Kudu', 'Chinook', 'Pomeranian', 'Hummingbird', 'Civet', 'Lizard', 'Basset', 'Chihuahua', 'Falcon', 'Heron', 'Eel', 'Quagga', 'Elephant', 'Anteater', 'Doberman', 'Grouper', 'Megalodon', 'Jaguar', 'Raccoon', 'Prawn', 'Goldeneye', 'Dragonfly', 'Quail', 'Caracal', 'Butterfly', 'Limpet', 'Bat', 'Jellyfish', 'Reindeer', 'Cow', 'Triggerfish', 'Panther', 'Axolotl', 'Stingray', 'Frigatebird', 'Titanoboa', 'Alsatian', 'Peacock', 'Ant', 'Anglerfish', 'Mockingbird', 'Ragamuffin', 'Bowfin', 'Puma', 'Labrador', 'Tuna', 'Herring', 'Bluegill', 'Sparrow', 'Gerbil', 'Porcupine', 'Wolf', 'Mamba', 'Hornbill', 'Foxhound', 'Impala', 'Yak', 'Pelican', 'Blobfish', 'Pachycephalosaurus', 'Gazelle', 'Robin', 'Toad', 'Marmoset', 'Ragdoll', 'Crab', 'Crayfish', 'Warbler', 'Gecko', 'Kingfisher', 'Monitor', 'Bluebird', 'Bird', 'Beaver', 'Turtle', 'Malamute', 'Springbok', 'Archerfish', 'Boerboel', 'Seagull', 'Dolphin', 'Baboon', 'Siamese', 'Goat', 'Monkey', 'Ladybug', 'Shark', 'Schnauzer', 'Bandicoot', 'Firefly', 'Amargasaurus', 'Warthog', 'Starling', 'Shepherd', 'Stork', 'Pug', 'Walrus', 'Bison', 'Carp', 'Parakeet', 'Puffin', 'Bluefish', 'Swordfish', 'Tortoise', 'Shrew', 'Moth', 'Angelfish', 'Ape', 'Platypus', 'Mastiff', 'Mandrill', 'Roadrunner', 'Serval', 'Dog', 'Ceratosaurus', 'Mackerel', 'Cougar', 'Newt', 'Wildebeest', 'Chicken', 'Abyssinian', 'Bee', 'Allosaurus', 'Klipspringer', 'Lion', 'Masiakasaurus', 'Centipede', 'Lemur', 'Duck', 'Moose', 'Seahorse', 'Starfish', 'Styracosaurus', 'Maltese', 'Clownfish', 'Pointer', 'Sphynx', 'Brontosaurus', 'Hyena', 'Sloth', 'Boomslang', 'Wolverine', 'Catfish', 'Deer', 'Bass', 'Adder', 'Pangolin', 'Seal', 'Narwhal', 'Elasmosaurus', 'Bullfrog', 'Cobra', 'Oxpecker', 'Sparrowhawk', 'Mauzer', 'Cheetah', 'Egret', 'Camel', 'Badger', 'Bloodhound', 'Lobster', 'Lionfish', 'Ibex', 'Kangaroo', 'Hippopotamus', 'Meerkat', 'Donkey', 'Krill', 'Eagle', 'Antelope', 'Mole', 'Hornet', 'Giraffe', 'Squid', 'Beetle', 'Burmese', 'Snake', 'Koala', 'Scorpion', 'Flycatcher', 'Bear', 'Mongrel', 'Caterpillar', 'Octopus', 'Dingo', 'Wombat', 'Viper', 'Swan', 'Barracuda', 'Cockatoo', 'Hainosaurus', 'Mammoth', 'Dodo', 'Buffalo', 'Raven', 'Capybara', 'Canary', 'Swallow', 'Bulldog', 'Rat', 'Tapir', 'Flamingo', 'Lyrebird', 'Human', 'Koi', 'Cricket', 'Pufferfish', 'Possum', 'Siberian', 'Nautilus', 'Orangutan', 'Panda', 'Hedgehog', 'Beagle', 'Weasel', 'Whale', 'Penguin', 'Sardines', 'Hare', 'Rattlesnake', 'Piranha', 'Vulture', 'Tiger', 'Firehawk', 'Haddock', 'Mule', 'Pterodactyl', 'Kookaburra', 'Bobcat', 'Velociraptor', 'Gopher', 'Bully', 'Otter', 'Fish', 'Bullmastiff', 'Bullsnake', 'Chameleon', 'Trout', 'Sailfish', 'Iguana', 'Liger', 'Sturgeon', 'Tarantula', 'Poodle', 'Ray', 'Ostrich', 'Mongoose', 'Goose', 'Magpie', 'Anchovies', 'Terrier', 'Elk', 'Boa', 'Yellowfin', 'Codfish', 'Fox', 'Marlin', 'Ibis', 'Woodpecker', 'Sheepdog', 'Gorilla', 'Collie', 'Ferret', 'Jackrabbit', 'Copperhead', 'Barosaurus', 'Leopard', 'Pig', 'Bumblebee', 'Spaniel', 'Lynx', 'Frog', 'Ocelot', 'Greyhound', 'Cassowary', 'Pheasant', 'Chipmunk', 'Cockroach', 'Caribou', 'Cockle', 'Retriever', 'Oyster', 'Fowl', 'Hoopoe', 'Hartebeest', 'Dilophosaurus', 'Labradoodle', 'Cicada', 'Mantis', 'Rabbit', 'Buzzard', 'Grasshopper', 'Macaw', 'Mouse', 'Kingklip', 'Parrotfish', 'Squirrel', 'Waterbuck', 'Chilesaurus', 'Wildcat', 'Perch', 'Okapi', 'Mosasaurus', 'Skunk', 'Zebra', 'Earthworm', 'Puffer', 'Nguni', 'Sunfish', 'Manatee', 'Cryolophosaurus', 'Chinchilla', 'Parrot', 'Horse', 'Swallowtail', 'Chimpanzee', 'Albatross', 'Snail', 'Aardvark', 'Cockatiel', 'Nyala', 'Whippet', 'Coyote', 'Alpaca', 'Boxer', 'Fisher', 'Hound', 'Toucan', 'Crane', 'Capuchin', 'Angelshark', 'Crocodile', 'Owl', 'Eland', 'Turkey', 'Kakapo', 'Husky', 'Cat', 'Magyarosaurus', 'Salamander', 'Marmot', 'Rottweiler', 'Cottonmouth', 'Pigeon', 'Cod', 'Python', 'Osprey', 'Salmon', 'Crow'];

// const words = ['Iam', 'Melanie', 'Rudi', 'Zoey', 'Zayden', 'Mariette', 'Nickey', 'Keagan', 'Lien', 'Wentzel', 'Ida', 'Jenny', 'Teresa', 'Patrick', 'Anne', 'MaryAnn', 'Francina', 'Euan', 'Shae', 'Bev', 'Stewart', 'Rosie', 'Barry', 'Nikita', 'James', 'Sophie', 'Sam', 'Stanton', 'Evlin', 'Olivia', 'Ryan', 'Nic', 'Lauren', 'Alice', 'Steven', 'Ophelia', 'Bernadette', 'Dylan', 'Christopher', 'Michelle', 'Catherine', 'Jessica', 'Gerard', 'Mathys', 'Elaine', 'Stan']

// const words = ['Sweetheart', 'Obsessed', 'Heart', 'Affection', 'Passion'];
const words = ["Love",
    "Heart",
    "Romance",
    "Affection",
    "Sweetheart",
    "Hug",
    "Kiss",
    "Cupid",
    "Passion",
    "Adore",
    "Embrace",
    "Cherish",
    "Date",
    "Roses",
    "Chocolate",
    "Forever",
    "Devotion",
    "Soulmate",
    "Valentine",
    "Gift"
]

const directions = ['upright', 'downright', 'downleft', 'upleft', 'right', 'down', 'left', 'up'];
const colorNames = {
    'gunmetal-lightskyblue': ["#092327", "#0a3b3c", "#0b5351", "#067e7b", "#00a9a5", "#27959f", "#4e8098", "#6fa1c0", "#90c2e7"],
    'champagnepink-africanviolet': ["#cfb9ab", "#dcc2b9", "#d0ada7", "#bf8c8a", "#ad6a6c", "#854c59", "#5d2e46", "#895e7e", "#b58db6"],
    'auburn-chocolatecosmos': ["#a62639", "#b4293e", "#c12c43", "#db324d", "#ba384e", "#993e4e", "#a64a5d", "#b3566c", "#511c29"],
    'gunmetal-tearose': ["#2f323a", "#53445a", "#77567a", "#9e689d", "#c47ac0", "#d48cc1", "#e39ec1", "#e1acc1", "#debac0"],
    'sunglow-salmon': ["#ffd25a", "#ffc85a", "#ffbe5a", "#ffb45a", "#ffaa5a", "#ff9e5a", "#ff915a", "#ff785a", "#ff8469"],
    'ashgray-recedagreen': ["#bac7be", "#bed4c0", "#8da88d", "#a0d7a4", "#7dcd85", "#7fbc84", "#80ab82", "#7c987a", "#778472"],
    'silver-paynesgray': ["#c6c5b9", "#adb9b3", "#94acac", "#7b9fa5", "#62929e", "#5f8896", "#5b7e8d", "#587484", "#546a7b"]
};
const paletteNames = ['gunmetal-lightskyblue', 'champagnepink-africanviolet', 'auburn-chocolatecosmos', 'gunmetal-tearose', 'sunglow-salmon', 'ashgray-recedagreen', 'silver-paynesgray'];
let cellsUsed = [];
let lettersRevealed = [];
let grid = {};
let isDragging = false;
let selectedCells = [];
let selectedCellIDs = [];
let posWord = {}
let wordsStillHidden;
const successMessages = ['Hey, you found a word!', 'Nice! That\'s a word!', 'Yup, you got one!', 'Yes indeed, that\'s a word!', 'Cool beans, you found a word!', 'Yay! That\'s a word!', 'Yes! You got one', 'Nicely done!', 'You got one!', 'Good eye!'];
const failMessages = ['Oops!', 'Nope!', 'Unfortunately not!', 'Sadly not...', 'You were so close!', 'I didn\'t put it there...', 'Just missed it!', 'So close!', 'Almost had it!'];
let listOfWords = [];
let wordObject = {};
let indexOfLastDeletedWord;
let mouseDragDirection = null;
let currentPalette;
let shouldRotate = false;

class Word {
    constructor(wordInput) {
        this.word = wordInput;
        this.wordLength = this.word.length;
        this.dir = randomChoice(directions)
        this.startPointBounds = boundCalculator(this.dir, this.wordLength);
        this.startPoint = this.findStartPoint();
    }

    chooseNewWord() {
        this.word = randomChoice(words);
        console.log('Chose a new word: ', this.word);
    }

    changeWord() {
        const oldWord = this.word;
        // Choose a new word
        this.chooseNewWord();
        this.wordLength = this.word.length; // Update word length

        // Remove current word from the listOfWords
        const index = listOfWords.indexOf(oldWord);
        indexOfLastDeletedWord = index;
        const deleted = listOfWords.splice(index, 1, this.word);
        console.log('Deleted word: ', deleted);
        // console.log('Array after deletion: ', listOfWords);

        // Add the new word to the list of words
        // listOfWords.push(this.word);
        console.log('Array after addition: ', listOfWords);
    }

    findStartPoint() {
        let tryCount = 0;
        while (tryCount < 40) { // Try maximum of 40 times (10 per direction)
            const startPoint = startPointFinder(this.startPointBounds, this.wordLength, this.dir, this.word);
            if (startPoint) {
                this.startPoint = startPoint;
                return startPoint;
            }
            tryCount++;
            if (tryCount % 10 === 0) { // Change direction every 10 tries
                this.dir = randomChoice(directions);
                this.startPointBounds = boundCalculator(this.dir, this.wordLength);
            }
        }
        // If unable to find a suitable spot, choose a new word
        this.word = this.changeWord(); // Choose a new word

        this.startPointBounds = boundCalculator(this.dir, this.wordLength); // Recalculate bounds
        return this.findStartPoint(); // Recursively try again with new word
    }
}

function optimalAmountOfWords(sideLength) {
    let area = sideLength ** 2;
    return Math.round(area / areaPerWord);
}

function tableBuilder(tableColumns, tableRows) {
    const table = document.getElementById('crossword-grid');
    let newRow;
    let newRowID;
    let newCell;
    let newCellID;

    // Add event listener to the table
    table.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);

    // Row loop
    for (let x = 1; x <= tableRows; x++) {
        // Add the row
        newRow = document.createElement('tr')
        newRowID = `row-${x}`;
        newRow.setAttribute('id', newRowID);

        // Column loop
        for (let i = 1; i <= tableColumns; i++) {
            // Add the column
            newCell = document.createElement('td')
            newCellID = `cell-${i},${x}`;
            grid[`${i},${x}`] = '';
            newCell.setAttribute('id', newCellID);
            // newCell.innerHTML += (i + (x-1)*12);

            // Add the event listener waiting for clicks:
            // addCellClickListener(newCell);

            // Append this cell to the row
            newRow.appendChild(newCell);
        }

        // After adding the rows to the column, append the entire column to 
        table.appendChild(newRow);
    }
}

function addCellClickListener(newCell) {
    newCell.addEventListener("click", () => {
        newCell.classList.toggle('clicked');
    });
}

function randomChoice(input) {
    let choice;
    if (typeof input == 'number') {
        choice = Math.floor(Math.random() * input);
    } else {
        choice = input[Math.floor(Math.random() * input.length)];
    }

    return choice;
}

function boundCalculator(dir, wordLength) {
    let bounds = {
        start: {
            x: 0,
            y: 0
        },
        end: {
            x: 0,
            y: 0
        }
    };
    //Make nested switches 
    switch (dir) {
        case 'right':
            bounds.start.x = 1;
            bounds.start.y = 1;
            bounds.end.x = tableColumns - wordLength + 1;
            bounds.end.y = tableRows;

            break;
        case 'down':
            bounds.start.x = 1;
            bounds.start.y = 1;
            bounds.end.x = tableColumns;
            bounds.end.y = tableRows - wordLength + 1;

            break;
        case 'left':
            bounds.start.x = wordLength;
            bounds.start.y = 1;
            bounds.end.x = tableColumns;
            bounds.end.y = tableRows;

            break;
        case 'up':
            bounds.start.x = 1;
            bounds.start.y = wordLength;
            bounds.end.x = tableColumns;
            bounds.end.y = tableRows;

            break;
        case 'downright':
            bounds.start.x = 1;
            bounds.start.y = 1;
            bounds.end.x = tableColumns - wordLength + 1;
            bounds.end.y = tableRows - wordLength + 1;

            break;
        case 'downleft':
            bounds.start.x = wordLength;
            bounds.start.y = 1;
            bounds.end.x = tableColumns;
            bounds.end.y = tableRows - wordLength + 1;

            break;
        case 'upleft':
            bounds.start.x = wordLength;
            bounds.start.y = wordLength;
            bounds.end.x = tableColumns;
            bounds.end.y = tableRows;

            break;
        case 'upright':
            bounds.start.x = 1;
            bounds.start.y = wordLength;
            bounds.end.x = tableColumns - wordLength + 1;
            bounds.end.y = tableRows;

            break;
        default:
            break;
    }
    return bounds;
}

function startPointFinder(startPointBounds, wordLength, dir, word) {
    let possibleCells = {};
    let choiceArray = [];
    let legalStartPoint;

    for (let y = startPointBounds.start.y; y <= startPointBounds.end.y; y++) {

        for (let x = startPointBounds.start.x; x <= startPointBounds.end.x; x++) {

            possibleCells[`${x},${y}`] = grid[`${x},${y}`];
            choiceArray.push(`${x},${y}`);
        }

    }

    // console.log(`The cells we can choose from for ${word}: `,choiceArray);

    let goodSpotToStart;
    let isLegal = false;
    let counter = 0;
    while (!isLegal) {
        // Find an empty start pos
        let emptyPos = findEmptyPos(choiceArray, possibleCells, word);

        isLegal = findGoodSpot(emptyPos, wordLength, dir, word);
        if (isLegal) {
            goodSpotToStart = emptyPos;
            // console.log(`This is a good spot to place ${word}: `, emptyPos);
        } else if (counter == 5) {
            return null;
        }
        counter++;
    }

    legalStartPoint = goodSpotToStart;

    return legalStartPoint;
}

function findGoodSpot(startPoint, wordLength, dir, word) {
    let [x, y] = startPoint.split(',');
    let xWL;
    let yWL;
    let xyWL;
    let cellsEmpty = [];
    let counter = 0;
    let ythLetter;
    switch (dir) {
        case 'right':
            xWL = Number(x) + wordLength
            for (let i = x; i < xWL; i++) {
                if (grid[`${i},${y}`] == '' || grid[`${i},${y}`] == word[counter]) {
                    if (grid[`${i},${y}`] == word[counter]) {
                        console.log('Letters matched!', `${i},${y}`);
                        // colourCell(`cell-${i},${y}`);
                    }
                    cellsEmpty.push(true)
                } else {
                    cellsEmpty.push(false)
                }
                counter++;
            }
            break;
        case 'down':
            yWL = Number(y) + wordLength
            for (let i = y; i < yWL; i++) {
                if (grid[`${x},${i}`] == '' || grid[`${x},${i}`] == word[counter]) {
                    if (grid[`${x},${i}`] == word[counter]) {
                        console.log('Letters matched!', `${x},${i}`);
                        // colourCell(`cell-${x},${i}`);
                    }
                    cellsEmpty.push(true)
                } else {
                    cellsEmpty.push(false)
                }
                counter++;
            }
            break;
        case 'left':
            xWL = Number(x) - wordLength
            for (let i = x; i > xWL; i--) {
                if (grid[`${i},${y}`] == '' || grid[`${i},${y}`] == word[counter]) {
                    if (grid[`${i},${y}`] == word[counter]) {
                        console.log('Letters matched!', `${i},${y}`);
                        // colourCell(`cell-${i},${y}`);
                    }
                    cellsEmpty.push(true)
                } else {
                    cellsEmpty.push(false)
                }
                counter++;
            }
            break;
        case 'up':
            yWL = Number(y) - wordLength
            for (let i = y; i > yWL; i--) {
                if (grid[`${x},${i}`] == '' || grid[`${x},${i}`] == word[counter]) {
                    if (grid[`${x},${i}`] == word[counter]) {
                        console.log('Letters matched!', `${x},${i}`);
                        // colourCell(`cell-${x},${i}`);
                    }
                    cellsEmpty.push(true)
                } else {
                    cellsEmpty.push(false)
                }
                counter++;
            }
            break;
        case 'downright':
            xyWL = Number(x) + wordLength; // You can use xyWL if x and y change at the same rate and in the same direction
            for (let i = x; i < xyWL; i++) {
                ythLetter = Number(y) + counter;
                if (grid[`${i},${ythLetter}`] == '' || grid[`${i},${ythLetter}`] == word[counter]) {
                    if (grid[`${i},${ythLetter}`] == word[counter]) {
                        console.log('Letters matched!', `${i},${ythLetter}`);
                        // colourCell(`cell-${x},${i}`);
                    }
                    cellsEmpty.push(true);
                } else {
                    cellsEmpty.push(false);
                }
                counter++;
            }
            break;
        case 'downleft':
            xWL = Number(x) - wordLength; // x reduces, y increases
            yWL = Number(y) + wordLength;
            let xcounter = Number(x);
            for (let i = y; i < yWL; i++) {
                if (grid[`${xcounter},${i}`] == '' || grid[`${xcounter},${i}`] == word[counter]) {
                    if (grid[`${xcounter},${i}`] == word[counter]) {
                        console.log('Letters matched!', `${xcounter},${i}`);
                        // colourCell(`cell-${x},${i}`);
                    }
                    cellsEmpty.push(true)
                } else {
                    cellsEmpty.push(false)
                }
                counter++;
                xcounter--;
            }
            break;
        case 'upleft':
            xyWL = Number(x) - wordLength; // You can use xyWL if x and y change at the same rate and in the same direction
            for (let i = x; i > xyWL; i--) {
                ythLetter = Number(y) + counter;
                if (grid[`${i},${ythLetter}`] == '' || grid[`${i},${ythLetter}`] == word[counter]) {
                    if (grid[`${i},${ythLetter}`] == word[counter]) {
                        console.log('Letters matched!', `${i},${ythLetter}`);
                        // colourCell(`cell-${x},${i}`);
                    }
                    cellsEmpty.push(true);
                } else {
                    cellsEmpty.push(false);
                }
                counter++;
            }
            break;
        case 'upright':
            xWL = Number(x) + wordLength; // x reduces, y increases
            yWL = Number(y) - wordLength;
            let ycounter = Number(y);
            for (let i = x; i < xWL; i++) {
                if (grid[`${i},${ycounter}`] == '' || grid[`${i},${ycounter}`] == word[counter]) {
                    if (grid[`${i},${ycounter}`] == word[counter]) {
                        console.log('Letters matched!', `${i},${ycounter}`);
                        // colourCell(`cell-${x},${i}`);
                    }
                    cellsEmpty.push(true)
                } else {
                    cellsEmpty.push(false)
                }
                counter++;
                ycounter--;
            }
            break;
    }

    return cellsEmpty.every((cell) => {
        return cell == true;
    });
}

function findEmptyPos(choiceArray, possibleCells, word) {
    let randEmpty = false;
    let pos;
    let emptyPos;
    while (!randEmpty) {
        pos = randomChoice(choiceArray);
        if (possibleCells[pos] == '' || possibleCells[pos] == word[0]) {
            emptyPos = pos;
            randEmpty = true;
        }
    }
    return emptyPos;
}

function placeWord(startPoint, dir, oldWord) {
    // console.log(oldWord);
    if (oldWord == undefined) {
        oldWord = listOfWords[indexOfLastDeletedWord];
        console.log('Undefined word replaced with actual word: ', oldWord);
    }
    let word = oldWord.toUpperCase().trim();
    let [x, y] = startPoint.split(',');
    let wordLength = word.length;
    let letter;
    let xyWL;
    let xWL;
    let yWL;
    let placedWordPos = [];
    let key;
    let ythLetter;
    switch (dir) {
        case 'right':
            xWL = Number(x) + wordLength
            letter = 0;
            for (let i = x; i < xWL; i++) {
                cell = document.getElementById(`cell-${i},${y}`);
                cell.innerHTML = word[letter];
                grid[`${i},${y}`] = word[letter];
                cellsUsed.push(`cell-${i},${y}`);
                placedWordPos.push(`cell-${i},${y}`);
                letter++;
            }
            key = placedWordPos.join('.');
            posWord[key] = oldWord.trim();
            break;
        case 'down':
            yWL = Number(y) + wordLength
            letter = 0;
            for (let i = y; i < yWL; i++) {
                cell = document.getElementById(`cell-${x},${i}`);
                cell.innerHTML = word[letter];
                grid[`${x},${i}`] = word[letter];
                cellsUsed.push(`cell-${x},${i}`);
                placedWordPos.push(`cell-${x},${i}`);
                letter++;
            }
            key = placedWordPos.join('.');
            posWord[key] = oldWord.trim();
            break;
        case 'left':
            xWL = Number(x) - wordLength
            letter = 0;
            for (let i = x; i > xWL; i--) {
                cell = document.getElementById(`cell-${i},${y}`);
                cell.innerHTML = word[letter];
                grid[`${i},${y}`] = word[letter];
                cellsUsed.push(`cell-${i},${y}`);
                placedWordPos.push(`cell-${i},${y}`);
                letter++;
            }
            key = placedWordPos.join('.');
            posWord[key] = oldWord.trim();
            break;
        case 'up':
            yWL = Number(y) - wordLength
            letter = 0;
            for (let i = y; i > yWL; i--) {
                cell = document.getElementById(`cell-${x},${i}`);
                cell.innerHTML = word[letter];
                grid[`${x},${i}`] = word[letter];
                cellsUsed.push(`cell-${x},${i}`);
                placedWordPos.push(`cell-${x},${i}`);
                letter++;
            }
            key = placedWordPos.join('.');
            posWord[key] = oldWord.trim();
            break;
        case 'downright':
            xyWL = Number(x) + wordLength; // You can use xyWL if x and y change at the same rate and in the same direction
            letter = 0;
            for (let i = x; i < xyWL; i++) {
                ythLetter = Number(y) + letter;
                cell = document.getElementById(`cell-${i},${ythLetter}`);
                cell.innerHTML = word[letter];
                grid[`${i},${ythLetter}`] = word[letter];
                cellsUsed.push(`cell-${i},${ythLetter}`);
                placedWordPos.push(`cell-${i},${ythLetter}`);
                letter++;
            }
            key = placedWordPos.join('.');
            posWord[key] = oldWord.trim();
            break;
        case 'downleft':
            xWL = Number(x) - wordLength; // x reduces, y increases
            yWL = Number(y) + wordLength;
            let xcounter = Number(x);
            letter = 0;
            for (let i = y; i < yWL; i++) {
                cell = document.getElementById(`cell-${xcounter},${i}`);
                cell.innerHTML = word[letter];
                grid[`${xcounter},${i}`] = word[letter];
                cellsUsed.push(`cell-${xcounter},${i}`);
                placedWordPos.push(`cell-${xcounter},${i}`);
                letter++;
                xcounter--;
            }
            key = placedWordPos.join('.');
            posWord[key] = oldWord.trim();
            break;
        case 'upleft':
            xyWL = Number(x) - wordLength; // You can use xyWL if x and y change at the same rate and in the same direction
            letter = 0;
            for (let i = x; i > xyWL; i--) {
                ythLetter = Number(y) + letter;
                cell = document.getElementById(`cell-${i},${ythLetter}`);
                cell.innerHTML = word[letter];
                grid[`${i},${ythLetter}`] = word[letter];
                cellsUsed.push(`cell-${i},${ythLetter}`);
                placedWordPos.push(`cell-${i},${ythLetter}`);
                letter++;
            }
            key = placedWordPos.join('.');
            posWord[key] = oldWord.trim();
            break;
        case 'upright':
            xWL = Number(x) + wordLength; // x reduces, y increases
            yWL = Number(y) - wordLength;
            let ycounter = Number(y);
            letter = 0;
            for (let i = x; i < xWL; i++) {
                cell = document.getElementById(`cell-${i},${ycounter}`);
                cell.innerHTML = word[letter];
                grid[`${i},${ycounter}`] = word[letter];
                cellsUsed.push(`cell-${i},${ycounter}`);
                placedWordPos.push(`cell-${i},${ycounter}`);
                letter++;
                ycounter--;
            }
            key = placedWordPos.join('.');
            posWord[key] = oldWord.trim();
            break;
    }
}

function crossWord(amountOfWords) {
    wordsStillHidden = amountOfWords;

    while (listOfWords.length < amountOfWords) {
        const wordChoice = randomChoice(words);

        if (wordChoice.length <= sideLength && !listOfWords.includes(wordChoice)) {
            listOfWords.push(wordChoice);
        }
    }

    for (let index = 0; index < listOfWords.length; index++) {
        const word = listOfWords[index];
        let newWord = new Word(word);
        placeWord(newWord.startPoint, newWord.dir, newWord.word);
        wordObject[word] = newWord;
    }
    console.log("List of the words: ", listOfWords);
    displayWordsToFind(listOfWords);
    emptySpaceFiller();
}

function emptySpaceFiller() {
    for (let key in grid) {
        if (grid[key] == '') {
            cell = document.getElementById(`cell-${key}`);
            cell.innerHTML = randomChoice(letters);
        }
    }
}

function reveal5Seconds() {
    reveal();
    setTimeout(() => {
        unReveal();
    }, 5000);
}

function reveal() {
    for (let keyIndex in cellsUsed) {
        let cell = document.getElementById(cellsUsed[keyIndex]);
        cell.style.backgroundColor = 'crimson';
        cell.style.color = 'white';
        lettersRevealed.push(cellsUsed[keyIndex]);
    }
}

function revealbyWord(paletteName) {
    currentPalette = paletteName;
    console.log(paletteName)

    // For every word in the grid
    for (wordIndex in posWord) {
        let wordColour = randomChoice(colorNames[paletteName]);
        let wordspace = []
        wordspace = wordIndex.split('.')

        // For every letter in the word
        for (let keyIndex in wordspace) {
            let cell = document.getElementById(wordspace[keyIndex]);
            cell.style.backgroundColor = wordColour;
            cell.style.color = 'white';
            lettersRevealed.push(cellsUsed[keyIndex]);
        }
    }
}

function switchPalette() {
    let paletteIndex = paletteNames.indexOf(currentPalette);
    let newPaletteIndex;
    if (paletteIndex == paletteNames.length - 1) {
        newPaletteIndex = 0;
    } else {
        newPaletteIndex = paletteIndex + 1;
    }

    revealbyWord(paletteNames[newPaletteIndex]);
}

function unReveal() {
    if (lettersRevealed.length !== 0) {
        console.log(`Amount of letters revealed: ${lettersRevealed.length}`)
        for (let i in lettersRevealed) {
            let cell = document.getElementById(lettersRevealed[i]);
            cell.style.backgroundColor = 'white';
            cell.style.color = 'black';
            console.log('unrevealed')
        }

        lettersRevealed = [];
    } else {
        console.log('No letters are revealed...')
    }
}

function hideClicked() {
    let cells = document.querySelectorAll('.clicked');

    cells.forEach((cell) => {
        cell.classList.remove('clicked');
    });
}

function displayWordsToFind(listOfWords) {
    const wordBox = document.getElementById('word-box');
    let newListItemID;

    for (let wordIndex in listOfWords) {
        let listItem = document.createElement('li');
        newListItemID = `${listOfWords[wordIndex]}`;
        listItem.setAttribute('id', newListItemID);
        listItem.innerHTML = capitalize(listOfWords[wordIndex]);
        wordBox.appendChild(listItem);
    }
}

function capitalize(word) {
    let firstLetter = word[0].toUpperCase();
    let wordArray = word.split('');
    wordArray.splice(0, 1, firstLetter);
    word = wordArray.join('');
    return word;
}

function handleMouseDown(event) {
    const clickedCell = event.target;

    // Add the 'clicked' class to the clicked cell
    if (clickedCell.tagName.toLowerCase() === 'td') {
        isDragging = true;
        clickedCell.classList.add('clicked');
        selectedCells.push(clickedCell);
        selectedCellIDs.push(clickedCell.id);

        // Add the event listener for mousemove
        document.addEventListener('mousemove', handleMouseMove);
    }
}

function handleMouseMove(event) {
    if (isDragging) {
        const hoveredCell = document.elementFromPoint(event.clientX, event.clientY);

        if (mouseDragDirection == null) {
            // Check if the hovered element is a table cell
            if (hoveredCell && hoveredCell.tagName.toLowerCase() === 'td') {
                // Add the 'clicked' class to the hovered cell
                hoveredCell.classList.add('clicked');
                selectedCells.push(hoveredCell);
                selectedCellIDs.push(hoveredCell.id);
            }

            let cellsNoDups = removeDups(selectedCellIDs);
            // Check in which direction the mouse is dragging if the selectedCells is 2 elements long
            if (cellsNoDups.length == 2) {
                let startCellID = cellsNoDups[0];
                let directionalCellID = cellsNoDups[1];

                mouseDragDirection = whichDirection(startCellID, directionalCellID);
                // console.log(`Mouse dragged in ${mouseDragDirection} direction`)
            }
        } else {
            // Then make it so that dragged cells after that match the direction through a direction checker function

            // Check if the hovered element is a table cell
            if (hoveredCell && hoveredCell.tagName.toLowerCase() === 'td' && sameDirection(hoveredCell.id)) {
                // Add the 'clicked' class to the hovered cell
                hoveredCell.classList.add('clicked');
                selectedCells.push(hoveredCell);
                selectedCellIDs.push(hoveredCell.id);
            }
        }
    }
}

function handleMouseUp() {
    isDragging = false;

    // Check if selected cells form a stored word (you need to implement this logic)
    const foundWord = checkForWord(selectedCellIDs);
    // const foundWord = true;

    if (foundWord) {
        // Add the 'foundit' class to the selected cells
        selectedCells.forEach(cell => cell.classList.add('foundit'));
    }

    // Clear the selected cells array
    selectedCells = [];
    selectedCellIDs = [];

    // Remove the 'clicked' class from all cells
    document.querySelectorAll('td.clicked').forEach(cell => cell.classList.remove('clicked'));

    // Remove the event listener for mousemove
    document.removeEventListener('mousemove', handleMouseMove);

    // Clean mouseDragDirection
    mouseDragDirection = null;
}

function whichDirection(startCellID, secondCellID) {
    let splitStart = startCellID.split('-');
    let [startx, starty] = splitStart[1].split(',');

    let splitEnd = secondCellID.split('-');
    let [endx, endy] = splitEnd[1].split(',');

    // Calculate differences in X and Y coordinates
    const deltaX = endx - startx;
    const deltaY = endy - starty;

    // Determine the direction based on the differences
    let directionDragged;
    if (deltaX === 0 && deltaY === 0) {
        directionDragged = "no movement"; // Same cell
    } else if (deltaX === 0) {
        directionDragged = deltaY > 0 ? "down" : "up"; // Vertical movement
    } else if (deltaY === 0) {
        directionDragged = deltaX > 0 ? "right" : "left"; // Horizontal movement
    } else if (Math.abs(deltaX) === Math.abs(deltaY)) {
        directionDragged = deltaY > 0 ? (deltaX > 0 ? "downright" : "downleft") : (deltaX > 0 ? "upright" : "upleft"); // Diagonal movement
    } else {
        directionDragged = "unknown"; // Unknown or invalid movement
    }

    // console.log(`Direction dragged: ${directionDragged}`);

    return directionDragged;
}

function sameDirection(cellID) {
    // The latest cell must be compared to the previous cell and then compared to mouseDragDirection

    // Get the cellID of the previous selected cell (aka the latest one in the selected cells array)
    let previousCellID = selectedCellIDs.slice(-1)[0];
    if (mouseDragDirection == whichDirection(previousCellID, cellID)) {
        // If in the same direction as the original mousedrag
        // console.log('Same direction: ', true);
        return true;
    } else {
        // console.log(`Same direction: ${false}, Which direction: ${whichDirection(previousCellID, cellID)}`);
        // console.log(`Previous CellID: ${previousCellID}, Current CellID: ${cellID}`);
        return false;
    }
}

function removeDups(array) {
    let newArrayNoDups = [];

    for (let index in array) {
        // If the selected Cell Id is not in the list add it
        if (!newArrayNoDups.includes(array[index])) {
            newArrayNoDups.push(array[index]);
        }
    }

    return newArrayNoDups;
}

// Function to check if selected cells form a stored word
function checkForWord(selectedCellIDs) {
    let cellIDNoDups = removeDups(selectedCellIDs);

    let keyToCheck = cellIDNoDups.join('.');

    // Return true if a word is found, false otherwise, ignore too short words;
    if (keyToCheck in posWord) {
        strikeWord(posWord[keyToCheck]);
        displayTinyPopup(randomChoice(successMessages), 3);
        wordsStillHidden--;
        runWhenAllWordsFound();
        return true;
    } else if (cellIDNoDups.length > 2) {
        // Put in a failure toast: Oops, you might have found a word, but I didn't put it there. Here's a cookie 🍪
        // console.log("CellIDs that caused a fail in check for word: ", cellIDNoDups);
        displayTinyPopup(randomChoice(failMessages), 3);
        return false;
    }
}

function strikeWord(word) {
    let listElement = document.getElementById(`${word}`);
    listElement.classList.add('struckthrough');
}

function displayTinyPopup(message, time) {
    // Display the popup
    let popup = document.getElementById('tiny-popup');
    popup.innerHTML = message;
    popup.style.display = 'block';

    let millis = time * 1000;

    setTimeout(() => {
        popup.style.display = 'none';
    }, millis);
}

function runWhenAllWordsFound() {
    if (wordsStillHidden == 0) {
        setTimeout(() => {
            showConfirmationPopup('Congratulations!');
        }, 2500);
    }
}

// Function to display the confirmation popup
function showConfirmationPopup(heading) {
    let newHeading = document.getElementById('popup-heading');
    newHeading.innerText = heading;
    const popup = document.getElementById('confirmationPopup');
    popup.style.display = 'block';
    document.getElementById('overlay').style.display = 'block';
}

// Function to hide the confirmation popup
function hideConfirmationPopup() {
    const popup = document.getElementById('confirmationPopup');
    popup.style.display = 'none';
    document.getElementById('overlay').style.display = 'none';
}

// Function to play another round
function playAgain() {
    hideConfirmationPopup();
    // Clean die crossword-grid en die word-box met die cleaner function
    clean();

    // Generate the table
    tableBuilder(tableColumns, tableRows);

    // Generate the words
    crossWord(optimalAmountOfWords(sideLength));
}

// Function to play later and add button
function playLater() {
    hideConfirmationPopup();
    // Add a button to the page that the user can click to play again, do this with a function and make it disappear when the user clicks the button. When the button is clicked it must show the confirmation popup.
    let anotherButton = document.getElementById('anotherOne');
    anotherButton.style.display = 'inline-block';
    anotherButton.addEventListener('click', () => {
        showConfirmationPopup('Another one?👀');
        const anotherbtn = document.getElementById('anotherOne');
        anotherbtn.style.display = 'none';
    });
}

function clean() {
    // Get the table and then get the word box
    const table = document.getElementById('crossword-grid');
    const wordBox = document.getElementById('word-box');

    // Clean these objects
    table.innerHTML = "";
    wordBox.innerHTML = "";

    // Clean the arrays and vars too
    cellsUsed = [];
    grid = {};
    posWord = {};
    wordsStillHidden = null;
    listOfWords = [];
    indexOfLastDeletedWord = null;
}

function colourCell(cellRef) {
    const cell = document.getElementById(cellRef);
    cell.style.backgroundColor = 'red';
}

function takeScreenshot() {
    html2canvas(document.querySelector("#mainbox")).then(canvas => {
        // Copy canvas to blob with specified MIME type
        canvas.toBlob(blob => {
            // Create ClipboardItem with blob and its type, and add to an array
            const data = [new ClipboardItem({ [blob.type]: blob })];
            // Write the data to the clipboard
            navigator.clipboard.write(data);
            displayTinyPopup('Screenshot copied to clipboard!', 3);
        });
    });
}

function rotate(secondsPerRotation) {
    shouldRotate = !shouldRotate; // Switches the shouldRotate value
    console.log(`${shouldRotate ? 'Rotating' : 'Stopped Rotating'}`);

    let screenshotbutton = document.getElementById("screenshot-btn");
    if (shouldRotate) {
        // Remove the screenshot button from the display
        screenshotbutton.style.display = 'none';
    } else {
        // Re-add the screenshot button to the display
        screenshotbutton.style.display = 'inline-block';
    }

    if (shouldRotate) {
        rotateLoop(secondsPerRotation);
    }
}

function rotateLoop(secondsPerRotation) {
    // Define a function for rotating once
    const rotateOnce = () => {
        clean();
        tableBuilder(tableColumns, tableRows);
        crossWord(words.length);
        revealbyWord(randomChoice(paletteNames));
        console.log('Waiting');

        // Schedule the next rotation after secondsPerRotation seconds
        setTimeout(() => {
            if (shouldRotate) {
                rotateLoop(secondsPerRotation);
            }
        }, secondsPerRotation * 1000);
    };

    // Start rotating
    if (shouldRotate) {
        rotateOnce();
    }
}

// Build the table and run the crossword generator when the page loads
tableBuilder(tableColumns, tableRows);
// crossWord(optimalAmountOfWords(sideLength));
crossWord(words.length);
// revealbyWord(randomChoice(paletteNames));
reveal()

const playAgainButton = document.getElementById('playAgain');
const playLaterButton = document.getElementById('playLater');
// Add event listeners to the playAgain and playLater buttons
playAgainButton.addEventListener('click', () => {
    playAgain();
});
playLaterButton.addEventListener('click', () => {
    playLater();
});

// TODO:
// x Add the click highlight function
// x Add the click and drag function
// x Add the functionality that words cannot overlap
// x Add the left and up functions as well, don't reverse the words!
// x Add a wordPositions object with all the positions of the words. Or maybe don't return an array, but make all the positions a unique key and then let the clickDrag function make a key for the dragged word and search for this key in the wordPositions Array.
// x Add Success popup if word is found and add an oops popup if the person didn't drag over a word
// ! Add a function that clears the clicked, but wait until the user doesn't interact with the grid and if the clicked letters match a word give success, otherwise clear the clicked cells and display oops
// x Add a reveal, unReveal and reveal5Seconds function
// x Add a block that lists the words to be found
// - Add a difficulty level. 5 Levels, some give you the list of words, others reduce the words and increase the gap between cells
// x Add a hideClicked function to hide the cells you clicked. Use when the user selected a string of words that you didn't put in there for example.
// x Create a function that calculates the optimal amount of words there should be hidden. Sort of a density calculation depending on the sqaure area.
// x Add a function that removes duplicate words
// x Add the function that displays the words you need to find on the right side of the grid
// x Add the diagonal word adding and bounds calculations
// x Add function where random words can start from other words' letters
// x Add the function that keeps words selected when they're found and strikethrough's the word in the word box
// - Figure out how to export and import function to make this main js file look neater
// x Add function to stop trying to add a word if it can't fit after like 10 tries. Then choose a new word
// x Add a check so that words that are longer than the sideLength cannot be chosen
// x Add a check to disallow the tiny popups after the game was completed and if not clicked inside the table. Do this by adding a check that the user clicked inside the table element.
// x Add the playAgain and playLater functions
// x Add the cleaner function
// - Add JSDoc strings om functions te verduidelik
// x Fix bug where multiple another one buttons appear if you just keep clicking no, it's okay - instead of deleting and creating the button, put it in html and change the display property
// - Add a hint system where you get one hint for every 4 words found
// - Add a print system where you can print one or more word search puzzle to a PDF
// x Add a screenshot function that saves the wordsearch puzzle as an image to your clipboard
// - Add themes that the user can choose from
// x Make words more likely to cross
// x Add function to make diagonal selection easier
// x Fix bug where the playAgain will get triggered the amount of times the user has played the game after clicking the playAgain button
// x Add the ability for the reveal function to use random colours, never the same colour once. Get a list of CSS colours- Fix this
// x Fix unReveal bug after you've used a revealbbyword function. For some reason it only unreveals some letters?
// - Add a function to save a puzzle, import / export
// - Adjust CSS so the words only wrap to new column once higher than table