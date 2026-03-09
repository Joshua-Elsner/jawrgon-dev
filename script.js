const dummyPlayers = [
    { name: "Elijah", timeAsShark: 125000, fishEaten: 2, sharksEvaded: 4 }, // Time in seconds
    { name: "Samantha", timeAsShark: 450000, fishEaten: 0, sharksEvaded: 10 },
    { name: "Clayton", timeAsShark: 86400, fishEaten: 3, sharksEvaded: 2 },
    { name: "Amelia", timeAsShark: 9000, fishEaten: 2, sharksEvaded: 5 },
    { name: "John", timeAsShark: 0, fishEaten: 0, sharksEvaded: 1 }
];

let secretWord = "SHARK";
let currentRow = 0;
let currentTile = 0;
let currentGuess = "";
let isGameOver = false;

let currentPlayer = dummyPlayers[0].name; // Elijah
let currentShark = dummyPlayers[1].name;  // Samantha

function updateSharkDisplay() {
    document.getElementById('home-shark-display').textContent = `Current Shark: ${currentShark}`;
    document.getElementById('leaderboard-shark-display').textContent = `Current Shark: ${currentShark}`;
}

updateSharkDisplay();

const rows = document.querySelectorAll('.board-row');
const keys = document.querySelectorAll('.key');

function setupBoard() {
    currentRow = 0; 
    
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

        console.log(`[API] ${currentPlayer} guessed correctly and is the new Shark!`);
        currentShark = currentPlayer;
        updateSharkDisplay();
        awardSharkEvaded();
    console.log(`[API] Placeholder: Stop DB timer for ${currentShark}, start DB timer for ${currentPlayer}`);
        return;
    }

    // Incorrect guess logic

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

//  UI and event listeners============

const tryAgainBtn = document.getElementById('try-again-btn');

tryAgainBtn.addEventListener('click', () => {
    document.getElementById('lose-modal').classList.add('hidden');
    setupBoard();
});

const loseMenuBtn = document.getElementById('lose-menu-btn');
const loseLeaderboardBtn = document.getElementById('lose-leaderboard-btn');

loseMenuBtn.addEventListener('click', () => {
    document.getElementById('lose-modal').classList.add('hidden');
    document.getElementById('game-screen').classList.add('hidden');
    
    document.getElementById('home-screen').classList.remove('hidden');
    setupBoard();
});

loseLeaderboardBtn.addEventListener('click', () => {
    document.getElementById('lose-modal').classList.add('hidden');
    document.getElementById('game-screen').classList.add('hidden');
    
    renderLeaderboard(dummyPlayers);
    document.getElementById('leaderboard-screen').classList.remove('hidden');
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

// Starting the game from the main menu
startGameBtn.addEventListener('click', () => {
    homeScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');

    setupBoard();
});

const chooseNameBtn = document.getElementById('choose-name-btn');
const playerDropdownList = document.getElementById('player-dropdown-list');

if (chooseNameBtn && playerDropdownList) {
    dummyPlayers.forEach(player => {
        const li = document.createElement('li');
        li.textContent = player.name;
        
        li.addEventListener('click', () => {
            currentPlayer = player.name;
            
            chooseNameBtn.textContent = `Player: ${currentPlayer} ▼`;
            startGameBtn.textContent = `Play as ${currentPlayer}`;
            
            playerDropdownList.classList.add('hidden');
        });
        
        playerDropdownList.appendChild(li);
    });

    chooseNameBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        playerDropdownList.classList.toggle('hidden');
    });

    document.addEventListener('click', (event) => {
        if (!playerDropdownList.contains(event.target) && event.target !== chooseNameBtn) {
            playerDropdownList.classList.add('hidden');
        }
    });
}

//Leaderboard

function formatSharkTime(totalSeconds) {
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${days.toString().padStart(3, '0')}:${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

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

    // Sort by timeAsShark descending
    const sortedPlayers = [...players].sort((a, b) => b.timeAsShark - a.timeAsShark);

    sortedPlayers.forEach((player, index) => {
        const rank = index + 1;

        let rankClass = '';
        if (rank === 1) rankClass = 'rank-1';
        if (rank === 2) rankClass = 'rank-2';
        if (rank === 3) rankClass = 'rank-3';

        const formattedTime = formatSharkTime(player.timeAsShark);

        const rowHTML = `
        <tr>
            <td class="${rankClass}">${rank}</td>
            <td>${player.name}</td>
            <td>${formattedTime}</td>
            <td>${player.fishEaten}</td>
            <td>${player.sharksEvaded}</td>
        </tr>
    `;

        tbody.insertAdjacentHTML('beforeend', rowHTML);
    });
}

//Info modals
const howToPlayBtn = document.getElementById('how-to-play-btn');
const howToPlayModal = document.getElementById('how-to-play-modal');
const closeHowToPlayBtn = document.getElementById('close-how-to-play-btn');
const closeHowToX = document.getElementById('close-how-to-x');

howToPlayBtn.addEventListener('click', () => {
    howToPlayModal.classList.remove('hidden');
});
closeHowToPlayBtn.addEventListener('click', () => {
    howToPlayModal.classList.add('hidden');
});
if (closeHowToX) {
    closeHowToX.addEventListener('click', () => howToPlayModal.classList.add('hidden'));
}

//Dummy backend
function awardSharkEvaded() {
    console.log(`[API] Placeholder: Awarding 1 Shark Evaded to ${currentPlayer}`);
    const player = dummyPlayers.find(p => p.name === currentPlayer);
    if (player) {
        player.sharksEvaded += 1;
    }
}

function awardSharkFish() {
    console.log(`[API] Awarding 1 Fish Eaten to Shark (${currentShark})`);
    const shark = dummyPlayers.find(p => p.name === currentShark);
    if (shark) {
        shark.fishEaten += 1;
    }
}

// List of modals that are safe to close by clicking outside
const closableModalIds = [
    'how-to-play-modal'
];

closableModalIds.forEach(id => {
    const modal = document.getElementById(id);
    
    if (modal) {
        modal.addEventListener('click', (event) => {
            // If it matches the dark background wrapper, hide it.
            if (event.target === modal) {
                modal.classList.add('hidden');
            }
        });
    }
});