let secretWord = "SHARK"; //Starts as shark initially
let currentRow = 0; 
let currentTile = 0;
let currentGuess = "";
let isGameOver = false;

const rows = document.querySelectorAll('.board-row');
const keys = document.querySelectorAll('.key'); 

//Hide all rows except bottom
for (let i = 1; i < 6; i++) {
    rows[i].classList.add('row-collapsed');
}

keys.forEach(key => {
    key.addEventListener('click', () => {
        if (isGameOver) return;

        const letter = key.textContent.trim();

        if (letter === "ENTER") {
            //TODO: checking logic
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
    //Make sure the user actually typed a full 5-letter word 
    if (currentGuess.length !== 5) {
        return;
    }

    //Compare their guess against the secretWord SHARK letter by letter
    for (let i = 0; i < secretWord.length; i++) {
        if (currentGuess[i] === secretWord[i]) {
           rows[currentRow].children[i].classList.add('correct');
        }

        else if (secretWord.includes(currentGuess[i])) {
           rows[currentRow].children[i].classList.add('present');
        }

        else {
           rows[currentRow].children[i].classList.add('absent');
        }
    }

    //Win chekc
    if (currentGuess === secretWord) {
        document.getElementById('win-modal').classList.remove('hidden');
        isGameOver = true;
        return;
    }
    currentRow++;
    currentTile = 0;
    currentGuess = "";

    //Lose check
    if (currentRow === 6) {
        document.getElementById('lose-modal').classList.remove('hidden');
        isGameOver = true;
        
        //TODO: Add 1 to Fish Eaten on leaderboard
        console.log("Shark gets a point!");
    }

    //Reveal next row of bubbles
    rows[currentRow].classList.remove('row-collapsed');
}

const tryAgainBtn = document.getElementById('try-again-btn');

tryAgainBtn.addEventListener('click', () => {
    document.getElementById('lose-modal').classList.add('hidden');

    currentRow = 0;
    currentTile = 0;
    currentGuess = "";
    isGameOver = false;

    //Clear all letters and colors from the bubbles
    for (let r = 0; r < 6; r++) {
        //Hide all bubbles again
        if (r > 0) {
            rows[r].classList.add('row-collapsed');
        }

        for (let c = 0; c < 5; c++) {
            const tile = rows[r].children[c];
            tile.textContent = "";
            tile.classList.remove('correct', 'present', 'absent');
        }
    }
});

const submitNewWordBtn = document.getElementById('submit-new-word');
const newWordInput = document.getElementById('new-word-input');

submitNewWordBtn.addEventListener('click', () => {
    const newWord = newWordInput.value.toUpperCase().trim();

    if (newWord.length !== 5) {
        alert("Must be 5 letters");
        return; 
    }

    console.log("TODO: Update databas with new word here.");
    
    secretWord = newWord; 

    //Hide the Modal and clear the input box
    document.getElementById('win-modal').classList.add('hidden');
    newWordInput.value = ""; 

    currentRow = 0;
    currentTile = 0;
    currentGuess = "";
    isGameOver = false;

    for (let r = 0; r < 6; r++) {
        //Hide all bubbles again
        if (r > 0) {
            rows[r].classList.add('row-collapsed');
        }

        for (let c = 0; c < 5; c++) {
            const tile = rows[r].children[c];
            tile.textContent = ""; 
            tile.classList.remove('correct', 'present', 'absent'); 
        }
    }

    // window.location.href = "leaderboard.html"; 
    console.log("TODO: Updating leaderboard will happen here.");

    document.getElementById('win-modal').classList.add('hidden');
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('leaderboard-screen').classList.remove('hidden');
});


//-------------------Main menu and modals----------

const homeScreen = document.getElementById('home-screen');
const gameScreen = document.getElementById('game-screen');
const leaderboardScreen = document.getElementById('leaderboard-screen');

//Play game button
const startGameBtn = document.getElementById('start-game-btn');
startGameBtn.addEventListener('click', () => {
    homeScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
});

//Choose player logic
const chooseNameBtn = document.getElementById('choose-name-btn');
const choosePlayerModal = document.getElementById('choose-player-modal');
const confirmPlayerBtn = document.getElementById('confirm-player-btn');
const playerSelect = document.getElementById('player-select');

chooseNameBtn.addEventListener('click', () => {
    choosePlayerModal.classList.remove('hidden');
});

confirmPlayerBtn.addEventListener('click', () => {
    const selectedPlayer = playerSelect.value;
    startGameBtn.textContent = `Play as ${selectedPlayer}`; //Update text on button 
    choosePlayerModal.classList.add('hidden');
});

//Daredevil challenge logic
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

// Leaderboard Navigation
const leaderboardBtn = document.getElementById('leaderboard-btn');
const backToMenuBtn = document.getElementById('back-to-menu-btn');

//Go to leaderboard
leaderboardBtn.addEventListener('click', () => {
    renderLeaderboard(dummyPlayers);
    homeScreen.classList.add('hidden');
    leaderboardScreen.classList.remove('hidden');
});

//Return to main menu
backToMenuBtn.addEventListener('click', () => {
    leaderboardScreen.classList.add('hidden');
    homeScreen.classList.remove('hidden');
});

//LEADERBOARD LOGIC ---------------------------

const dummyPlayers = [
    { name: "Elijah", points: 15, fishEaten: 2 },
    { name: "Samantha", points: 42, fishEaten: 0 },
    { name: "Clayton", points: 15, fishEaten: 3 },
    { name: "Amelia", points: 30, fishEaten: 2 },
    { name: "John", points: 5, fishEaten: 0 }
];

function renderLeaderboard(players) {
    const tbody = document.getElementById('leaderboard-body');
    tbody.innerHTML = '';

    const sortedPlayers = [...players].sort((a, b) => {
        if (b.fishEaten !== a.fishEaten) {
            return b.fishEaten - a.fishEaten; //Sort by fish eaten
        }
        return b.points - a.points;           //Sort by points if fish are tied
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

//Info Modals
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