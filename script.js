const dummyPlayers = [
    { name: "Elijah", points: 15, fishEaten: 2 },
    { name: "Samantha", points: 42, fishEaten: 0 },
    { name: "Clayton", points: 15, fishEaten: 3 },
    { name: "Amelia", points: 30, fishEaten: 2 },
    { name: "John", points: 5, fishEaten: 0 }
];

let secretWord = "SHARK";
let currentRow = 0;
let currentTile = 0;
let currentGuess = "";
let isGameOver = false;

let currentPlayer = dummyPlayers[0].name; // Elijah
let currentShark = dummyPlayers[1].name;  // Samantha

const rows = document.querySelectorAll('.board-row');
const keys = document.querySelectorAll('.key');

const playerSelect = document.getElementById('player-select');
playerSelect.innerHTML = '';

dummyPlayers.forEach(player => {
    const option = document.createElement('option');
    option.value = player.name;
    option.textContent = player.name;
    playerSelect.appendChild(option);
});

function setupBoard() {
    const wager = parseInt(document.getElementById('stake-select').value);
    currentRow = isDaredevil ? wager : 0; 
    
    currentTile = 0;
    currentGuess = "";
    isGameOver = false;

    for (let r = 0; r < 6; r++) {
        
        if (r <= currentRow) {
            rows[r].classList.remove('row-collapsed');
        } else {
            rows[r].classList.add('row-collapsed');
        }
        
        for (let c = 0; c < 5; c++) {
            const tile = rows[r].children[c];
            tile.textContent = "";
            tile.classList.remove('correct', 'present', 'absent');
        }
    }

    document.querySelectorAll('.key').forEach(key => key.classList.remove('correct', 'present', 'absent'));
}

keys.forEach(key => {
    key.addEventListener('click', () => {
        if (isGameOver) return;

        const letter = key.textContent.trim();

        if (letter === "ENTER") {
            checkGuess();
        } else if (letter === "BACK") {
            deleteLetter();
        } else {
            addLetter(letter);
        }
    });
});

//Physical keyboard strokes
document.addEventListener('keydown', (e) => {
    if (isGameOver) return;

    if (e.key === 'Enter') {
        checkGuess();
        return;
    }

    if (e.key === 'Backspace') {
        deleteLetter();
        return;
    }

    //Regex for a single char
    const isLetter = /^[a-zA-Z]$/.test(e.key);

    if (isLetter) {
        addLetter(e.key.toUpperCase());
    }
});

function addLetter(letter) {
    if (currentTile < 5) {
        const tile = rows[currentRow].children[currentTile];
        tile.textContent = letter;
        currentGuess += letter;
        currentTile++;
    }
}

function deleteLetter() {
    if (currentTile > 0) {
        currentTile--;
        const tile = rows[currentRow].children[currentTile];
        tile.textContent = "";
        currentGuess = currentGuess.slice(0, -1);
    }
}

function checkGuess() {
    // Make sure the user actually typed a full 5 letter word 
    if (currentGuess.length !== 5) {
        return;
    }

    const tiles = rows[currentRow].children;
    let secretLetterCounts = {};
    let guessStatuses = new Array(5).fill('absent'); //Default everything to gray

    // Frequency map of letters in secret word 
    for (let char of secretWord) {
        secretLetterCounts[char] = (secretLetterCounts[char] || 0) + 1;
    }

    // Find exact matches
    for (let i = 0; i < 5; i++) {
        if (currentGuess[i] === secretWord[i]) {
            guessStatuses[i] = 'correct';
            secretLetterCounts[currentGuess[i]]--;
        }
    }

    //Find partial matches
    for (let i = 0; i < 5; i++) {
        if (guessStatuses[i] !== 'correct') {
            const letter = currentGuess[i];

            //In word and we haven't run out
            if (secretLetterCounts[letter] > 0) {
                guessStatuses[i] = 'present';
                secretLetterCounts[letter]--;
            }
        }
    }

    for (let i = 0; i < 5; i++) {
        tiles[i].classList.add(guessStatuses[i]);
    }

    // Update the on screen keyboard colors
    for (let i = 0; i < 5; i++) {
        const letter = currentGuess[i].toLowerCase();
        const status = guessStatuses[i];
        const keyElement = document.getElementById('key-' + letter);

        if (keyElement) {
            if (keyElement.classList.contains('correct')) {
                continue;
            }

            if (keyElement.classList.contains('present')) {
                if (status === 'correct') {
                    keyElement.classList.remove('present');
                    keyElement.classList.add('correct');
                }
                continue;
            }

            keyElement.classList.add(status);
        }
    }

    // Win check
    if (currentGuess === secretWord) {
        document.getElementById('win-modal').classList.remove('hidden');
        isGameOver = true;

        if (isDaredevil) {
            const wager = parseInt(document.getElementById('stake-select').value);

            const bonus = wager * 2;

            console.log(`[API] DAREDEVIL SUCCESS! Awarding ${bonus} points to ${currentPlayer}`);
            const winner = dummyPlayers.find(p => p.name === currentPlayer);
            if (winner) {
                winner.points += bonus;
            }

            // Turn Daredevil off for the next game
            isDaredevil = false;
            document.getElementById('challenge-btn').textContent = "Daredevil? NO";
        }

        console.log(`[API] ${currentPlayer} guessed correctly and is the new Shark!`);
        currentShark = currentPlayer;
        return;
    }

    // Incorrect guess logic
    awardSharkPoints(1);

    currentRow++;
    currentTile = 0;
    currentGuess = "";

    // Lose check
    if (currentRow === 6) {
        document.getElementById('lose-modal').classList.remove('hidden');
        isGameOver = true;

        awardSharkFish();
        return;
    }

    // Reveal next row of bubbles
    rows[currentRow].classList.remove('row-collapsed');
}

//UI and event listenestr

const tryAgainBtn = document.getElementById('try-again-btn');

tryAgainBtn.addEventListener('click', () => {
    document.getElementById('lose-modal').classList.add('hidden');

    isDaredevil = false;
    document.getElementById('challenge-btn').textContent = "Daredevil? NO";

    setupBoard();
});

const submitNewWordBtn = document.getElementById('submit-new-word');
const newWordInput = document.getElementById('new-word-input');

submitNewWordBtn.addEventListener('click', () => {
    const newWord = newWordInput.value.toUpperCase().trim();

    if (newWord.length !== 5) {
        alert("Must be 5 letters");
        return;
    }

    secretWord = newWord;
    newWordInput.value = "";

    setupBoard();

    renderLeaderboard(dummyPlayers);
    document.getElementById('win-modal').classList.add('hidden');
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('leaderboard-screen').classList.remove('hidden');
});

const homeScreen = document.getElementById('home-screen');
const gameScreen = document.getElementById('game-screen');
const leaderboardScreen = document.getElementById('leaderboard-screen');

const startGameBtn = document.getElementById('start-game-btn');
startGameBtn.addEventListener('click', () => {
    homeScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    setupBoard();
});

const chooseNameBtn = document.getElementById('choose-name-btn');
const choosePlayerModal = document.getElementById('choose-player-modal');
const confirmPlayerBtn = document.getElementById('confirm-player-btn');

chooseNameBtn.addEventListener('click', () => {
    choosePlayerModal.classList.remove('hidden');
});

confirmPlayerBtn.addEventListener('click', () => {
    currentPlayer = playerSelect.value;
    startGameBtn.textContent = `Play as ${currentPlayer}`;
    choosePlayerModal.classList.add('hidden');
});

const challengeBtn = document.getElementById('challenge-btn');
const challengeStakeModal = document.getElementById('challenge-stake-modal');
const confirmStakeBtn = document.getElementById('confirm-stake-btn');
const cancelStakeBtn = document.getElementById('cancel-stake-btn');
const stakeSelect = document.getElementById('stake-select');
let isDaredevil = false;

challengeBtn.addEventListener('click', () => {
    if (isDaredevil) {
        isDaredevil = false;
        challengeBtn.textContent = "Daredevil? NO";
    } else {
        challengeStakeModal.classList.remove('hidden');
    }
});

confirmStakeBtn.addEventListener('click', () => {
    const points = stakeSelect.value;
    isDaredevil = true;
    challengeBtn.textContent = `Daredevil? YES (${points} pts)`;
    challengeStakeModal.classList.add('hidden');
});

cancelStakeBtn.addEventListener('click', () => {
    challengeStakeModal.classList.add('hidden');
});

const leaderboardBtn = document.getElementById('leaderboard-btn');
const backToMenuBtn = document.getElementById('back-to-menu-btn');

leaderboardBtn.addEventListener('click', () => {
    renderLeaderboard(dummyPlayers);
    homeScreen.classList.add('hidden');
    leaderboardScreen.classList.remove('hidden');
});

backToMenuBtn.addEventListener('click', () => {
    leaderboardScreen.classList.add('hidden');
    homeScreen.classList.remove('hidden');
});

function renderLeaderboard(players) {
    const tbody = document.getElementById('leaderboard-body');
    tbody.innerHTML = '';

    const sortedPlayers = [...players].sort((a, b) => {
        const totalA = a.points + (a.fishEaten * 5);
        const totalB = b.points + (b.fishEaten * 5);
        return totalB - totalA;
    });

    sortedPlayers.forEach((player, index) => {
        const rank = index + 1;

        let rankClass = '';
        if (rank === 1) rankClass = 'rank-1';
        if (rank === 2) rankClass = 'rank-2';
        if (rank === 3) rankClass = 'rank-3';

        const rowHTML = `
        <tr>
            <td class="${rankClass}">${rank}</td>
            <td>${player.name}</td>
            <td>${player.points}</td>
            <td>${player.fishEaten}</td>
        </tr>
    `;

        tbody.insertAdjacentHTML('beforeend', rowHTML);
    });
}

const challengeInfoBtn = document.getElementById('challenge-info-btn');
const challengeInfoModal = document.getElementById('challenge-info-modal');
const closeChallengeInfoBtn = document.getElementById('close-challenge-info-btn');

challengeInfoBtn.addEventListener('click', () => {
    challengeInfoModal.classList.remove('hidden');
});
closeChallengeInfoBtn.addEventListener('click', () => {
    challengeInfoModal.classList.add('hidden');
});

const howToPlayBtn = document.getElementById('how-to-play-btn');
const howToPlayModal = document.getElementById('how-to-play-modal');
const closeHowToPlayBtn = document.getElementById('close-how-to-play-btn');

howToPlayBtn.addEventListener('click', () => {
    howToPlayModal.classList.remove('hidden');
});
closeHowToPlayBtn.addEventListener('click', () => {
    howToPlayModal.classList.add('hidden');
});

//Dummy backend
function awardSharkPoints(points) {
    console.log(`[API] Awarding ${points} points to Shark (${currentShark})`);
    const shark = dummyPlayers.find(p => p.name === currentShark);
    if (shark) {
        shark.points += points;
    }
}

function awardSharkFish() {
    console.log(`[API] Awarding 1 Fish Eaten to Shark (${currentShark})`);
    const shark = dummyPlayers.find(p => p.name === currentShark);
    if (shark) {
        shark.fishEaten += 1;
    }
}