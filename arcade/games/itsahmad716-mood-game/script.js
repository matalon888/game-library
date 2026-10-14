// Game state
let currentGame = null;
let gameData = {};

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    setupMoodButtons();
    setupGameEvents();
});

// Setup mood selection buttons
function setupMoodButtons() {
    const moodBtns = document.querySelectorAll('.mood-btn');
    moodBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const gameType = this.dataset.game;
            showGame(gameType);
        });
    });
}

// Show specific game
function showGame(gameType) {
    // Hide all screens
    document.querySelectorAll('.game-screen, #mood-selection').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Show selected game
    document.getElementById(`${gameType}-game`).classList.add('active');
    currentGame = gameType;
    
    // Reset game immediately
    resetGame(gameType);
}

// Setup all game event listeners
function setupGameEvents() {
    // Number Guessing (Bored)
    document.getElementById('guess-btn').addEventListener('click', guessNumber);
    document.getElementById('guess-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') guessNumber();
    });

    // Fast Click (Angry)
    document.getElementById('click-btn').addEventListener('click', handleClick);

    // Emoji Guessing (Happy)
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', checkEmojiGuess);
    });

    // Riddle (Confused)
    document.getElementById('riddle-btn').addEventListener('click', checkRiddle);
    document.getElementById('riddle-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') checkRiddle();
    });
}

// ===== GAME LOGIC =====

// 1. Number Guessing Game
function guessNumber() {
    const input = document.getElementById('guess-input');
    const feedback = document.getElementById('feedback');
    const attemptsEl = document.getElementById('attempts');
    
    const guess = parseInt(input.value);
    if (isNaN(guess) || guess < 1 || guess > 100) {
        feedback.textContent = 'Please enter a number between 1-100!';
        feedback.className = 'error';
        return;
    }
    
    gameData.bored = gameData.bored || { secret: Math.floor(Math.random() * 100) + 1, attempts: 7 };
    const data = gameData.bored;
    
    data.attempts--;
    attemptsEl.textContent = `Attempts left: ${data.attempts}`;
    
    if (guess === data.secret) {
        feedback.textContent = `🎉 Correct! It was ${data.secret}!`;
        feedback.className = 'success';
        input.disabled = true;
        document.getElementById('guess-btn').style.display = 'none';
    } else if (data.attempts === 0) {
        feedback.textContent = `💔 Game Over! It was ${data.secret}`;
        feedback.className = 'error';
        input.disabled = true;
        document.getElementById('guess-btn').style.display = 'none';
    } else if (guess < data.secret) {
        feedback.textContent = '📈 Too low! Try higher.';
        feedback.className = '';
    } else {
        feedback.textContent = '📉 Too high! Try lower.';
        feedback.className = '';
    }
    
    input.value = '';
    input.focus();
}

// 2. Fast Click Game
function handleClick() {
    if (!gameData.angry) return;
    
    gameData.angry.clicks++;
    document.getElementById('click-count').textContent = gameData.angry.clicks;
}

function startClickGame() {
    const btn = document.getElementById('click-btn');
    const timeEl = document.getElementById('time-left');
    
    gameData.angry = { clicks: 0, time: 5 };
    document.getElementById('click-count').textContent = '0';
    
    btn.disabled = false;
    btn.style.background = 'linear-gradient(135deg, #ff6b6b, #ee5a52)';
    
    const timer = setInterval(() => {
        gameData.angry.time--;
        timeEl.textContent = gameData.angry.time;
        
        if (gameData.angry.time <= 0) {
            clearInterval(timer);
            btn.disabled = true;
            btn.textContent = `Final: ${gameData.angry.clicks} clicks!`;
            btn.style.background = gameData.angry.clicks > 30 ? '#27ae60' : '#f39c12';
        }
    }, 1000);
}

// 3. Emoji Guessing Game
const emojiData = [
    { emoji: '😂', answer: 'happy' },
    { emoji: '😢', answer: 'sad' },
    { emoji: '😡', answer: 'angry' },
    { emoji: '😲', answer: 'surprised' },
    { emoji: '😍', answer: 'happy' },
    { emoji: '😭', answer: 'sad' }
];

function showRandomEmoji() {
    const randomEmoji = emojiData[Math.floor(Math.random() * emojiData.length)];
    document.getElementById('emoji-display').textContent = randomEmoji.emoji;
    gameData.happy = { correct: randomEmoji.answer };
}

function checkEmojiGuess(e) {
    const feedback = document.getElementById('emoji-feedback');
    const selected = e.target.dataset.answer;
    
    if (selected === gameData.happy.correct) {
        feedback.textContent = '🎉 Correct!';
        feedback.className = 'success';
    } else {
        feedback.textContent = '❌ Wrong! Try again.';
        feedback.className = 'error';
    }
}

// 4. Riddle Game
const riddles = [
    {
        question: "I speak without a mouth and hear without ears. I have no body, but I come alive with the wind. What am I?",
        answer: "echo"
    },
    {
        question: "What has keys but can't open locks?",
        answer: "piano"
    },
    {
        question: "What gets wetter as it dries?",
        answer: "towel"
    }
];

function showRandomRiddle() {
    const randomRiddle = riddles[Math.floor(Math.random() * riddles.length)];
    document.getElementById('riddle-text').textContent = randomRiddle.question;
    gameData.confused = { correct: randomRiddle.answer };
}

function checkRiddle() {
    const input = document.getElementById('riddle-input');
    const feedback = document.getElementById('riddle-feedback');
    
    const answer = input.value.trim().toLowerCase();
    if (answer === gameData.confused.correct) {
        feedback.textContent = '🎉 Brilliant! Correct answer!';
        feedback.className = 'success';
    } else {
        feedback.textContent = '🤔 Not quite! Try again.';
        feedback.className = 'error';
    }
    input.value = '';
}

// Reset specific game
function resetGame(gameType) {
    gameData[gameType] = null;
    
    if (gameType === 'bored') {
        document.getElementById('guess-input').disabled = false;
        document.getElementById('guess-btn').style.display = 'inline-block';
        document.getElementById('feedback').textContent = 'Good luck! 🎲';
        document.getElementById('feedback').className = '';
        document.getElementById('attempts').textContent = 'Attempts left: 7';
        document.getElementById('guess-input').focus();
    } else if (gameType === 'angry') {
        startClickGame();
    } else if (gameType === 'happy') {
        document.getElementById('emoji-feedback').textContent = '';
        showRandomEmoji();
    } else if (gameType === 'confused') {
        document.getElementById('riddle-feedback').textContent = '';
        document.getElementById('riddle-input').value = '';
        showRandomRiddle();
    }
}
