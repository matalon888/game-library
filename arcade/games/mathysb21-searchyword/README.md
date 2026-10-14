# SearchyWord
This is a word search puzzle game to test and prove my abilities in JavaScript mainly. Later on I will convert the tech stack to being a Vue.js or React based project.

## How to use
This is basically just a website, so you can clone the repository and open the HTML file like any other file and the game should work!. Otherwise, you can open it in VS Code and use the Live Server Extension to host this website in your browser.

## How to play
In front of you, you will see a grid with letters and to the right of it you'll see the words you need to find. Click and drag on a word to mark it. Note that the word will only be marked if you drag it in the direction you would have to read it to understand the word. For instance if the word 'cat' is in the grid, but it is reversed: 'tac', you would need to drag from the right to the left. Drag over the word in the direction you would read to understand the word. 

Once you have marked a word, it's corresponding legend will be struck through to help show the words you still need to find.

Upon completion of the puzzle, you will be given the option to play another. Should you choose 'yes', another puzzle will be generated.

Have fun! You're more than welcome to print these puzzle and do them by hand as well!

## Features I want to add:
- Hint system: For every four words you find, you get a free hint which you can use to display the hidden words for 2 seconds.
- Difficulty system: You can choose out of 5 difficulty levels.
- Theme-based words: I want to add a few themes that the user can choose from
- Print functionality: I want to add a button the user can click to save the current puzzle as a PDF for printing.
- Diagonal words: I still need to add words that can spawn in diagonally.
- Words that cross: Currently none of the words use each others' letters making it easy to spot them
- User Authentication and points system: Users can create accounts where their scores are kept
- Convert to JS Framework: For ease of development and expansion of my skillset
