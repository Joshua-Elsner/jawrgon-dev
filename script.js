// Import Supabase directly from the CDN
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Initialize the connection
const supabaseUrl = 'https://okbynkairmznzcriuknd.supabase.co';
const supabaseKey = 'sb_publishable_ZJGYQbdtUaABBX1lhOw8qw_Ksiw-S54';
const supabase = createClient(supabaseUrl, supabaseKey);

// --- DOM Elements ---
const startGameBtn = document.getElementById('start-game-btn');
const rows = document.querySelectorAll('.board-row');
const keys = document.querySelectorAll('.key');

// --- Game State Variables ---
let secretWord = ""; 
let currentShark = "Loading..."; 

let currentPlayer = localStorage.getItem('jawrgon_username') || "Guest";
let currentPlayerId = localStorage.getItem('jawrgon_userid') || null;

let currentSharkId = null;
let sharkStartTime = null; 
let timerInterval = null;  
let cachedPlayers = [];

let currentRow = 0;
let currentTile = 0;
let currentGuess = "";
let isGameOver = false;

function updateSharkDisplay() {
    const homeDisplay = document.getElementById('home-shark-display');
    const boardDisplay = document.getElementById('leaderboard-shark-display');

    if (homeDisplay) homeDisplay.textContent = `Current Shark: ${currentShark}`;
    if (boardDisplay) boardDisplay.textContent = `Current Shark: ${currentShark}`;
}

function updateStartButton() {
    if (!startGameBtn) return;
    
    if (currentPlayer === "Guest") {
        startGameBtn.innerHTML = `Play as Guest<br><span style="font-size: 0.85rem; font-weight: normal;">(Cannot set new word)</span>`;
        startGameBtn.disabled = false;
    } else if (currentPlayer === currentShark) {
        startGameBtn.innerHTML = `${currentPlayer} Is Already Shark!`;
        startGameBtn.disabled = true;
    } else {
        startGameBtn.innerHTML = `Play as ${currentPlayer}`;
        startGameBtn.disabled = false;
    }
}

updateSharkDisplay();

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

async function checkGuess() {
    // Make sure the user actually typed a full 5 letter word 
    if (currentGuess.length !== 5) {
        return;
    }

    if (typeof VALID_WORDS !== 'undefined' && !VALID_WORDS.includes(currentGuess)) {
        const currentRowEl = rows[currentRow];
        currentRowEl.classList.add('shake');
        
        // Remove the shake class after animation finishes so it can be shaken again
        setTimeout(() => {
            currentRowEl.classList.remove('shake');
        }, 400);
        
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

        const winModalTitle = document.querySelector('#win-modal h2');
        const winModalDesc = document.querySelector('#win-modal p');
        const newWordInput = document.getElementById('new-word-input');
        const submitBtn = document.getElementById('submit-new-word');
        const wordSuggestions = document.getElementById('word-suggestions'); // Grab the new container

        if (currentPlayer === "Guest") {
            // Guest UI
            winModalTitle.textContent = "You Survived!";
            winModalDesc.textContent = "Great guessing! However, Guests cannot become the Shark or set new words.";
            newWordInput.classList.add('hidden');
            wordSuggestions.classList.add('hidden'); // Ensure hidden for guests
            submitBtn.textContent = "Back to Menu";
        } else {
            // Registered player UI and logic
            winModalTitle.textContent = "Winner!";
            winModalDesc.textContent = "Enter new 5 letter secret word!";
            newWordInput.classList.remove('hidden');
            submitBtn.textContent = "Confirm";

            // --- CALL THE NEW FUNCTION HERE ---
            displayWordSuggestions();

            newWordInput.focus();

            console.log(`[API] ${currentPlayer} guessed correctly and is the new Shark!`);
            currentShark = currentPlayer;
            updateSharkDisplay();
            updateStartButton();
        }
        return;
    }

    currentRow++;
    currentTile = 0;
    currentGuess = "";

    // Lose check
    if (currentRow === 6) {
        document.getElementById('lose-modal').classList.remove('hidden');
        isGameOver = true;

        // --- NEW LOGIC: Reward the Shark for defending their word! ---
        if (currentSharkId) {
            console.log(`[API] Updating DB: ${currentShark} ate a fish!`);

            const { error } = await supabase.rpc('record_shark_meal');

            if (error) {
                console.error("Error recording shark meal:", error);
            }
        }

        return;
    }

    // Reveal next row of bubbles
    rows[currentRow].classList.remove('row-collapsed');
}

// ============ UI and event listeners ============

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
    
    fetchAndRenderLeaderboard();
    document.getElementById('leaderboard-screen').classList.remove('hidden');
    setupBoard();
});

const submitNewWordBtn = document.getElementById('submit-new-word');
const newWordInput = document.getElementById('new-word-input');

submitNewWordBtn.addEventListener('click', async () => {
    // Only validate and set a new word if they are a registered player
    if (currentPlayer !== "Guest") {
        const newWord = newWordInput.value.toUpperCase().trim();

        if (newWord.length !== 5) {
            alert("Must be 5 letters");
            return;
        }

        if (typeof VALID_WORDS !== 'undefined' && !VALID_WORDS.includes(newWord)) {
            alert("That is not a valid dictionary word!");
            return;
        }

        submitNewWordBtn.textContent = "Updating...";
        submitNewWordBtn.disabled = true;

        const { error } = await supabase.rpc('claim_shark_title', {
            winner_id: currentPlayerId,
            guessed_word: currentGuess,
            new_secret_word: newWord
        });

        if (error) {
            console.error("Error claiming shark title:", error);
            
            // --- NEW: Show the actual database error to the user ---
            if (error.message.includes('Word already used')) {
                alert("That word has already been used in a past game! Please choose a new one.");
            } else {
                alert(error.message || "Failed to update the database.");
            }
            
            submitNewWordBtn.textContent = "Confirm";
            submitNewWordBtn.disabled = false;
            return; // Stops the function here so the modal doesn't close!
        }

        // Update the front-end Shark ID to the winner
        currentSharkId = currentPlayerId;
        // If successful, update the local secret word
        secretWord = newWord;
    }
      
    // Reset UI and close out the modal
    newWordInput.value = "";
    submitNewWordBtn.textContent = "Confirm";
    submitNewWordBtn.disabled = false;
    setupBoard();

    document.getElementById('win-modal').classList.add('hidden');
    document.getElementById('game-screen').classList.add('hidden');

    if (currentPlayer === "Guest") {
        document.getElementById('home-screen').classList.remove('hidden');
    } else {
        // Fetch the fresh leaderboard from the database to show their updated score!
        fetchAndRenderLeaderboard();
        document.getElementById('leaderboard-screen').classList.remove('hidden');
    }
});

newWordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        submitNewWordBtn.click();
    }
});

const homeScreen = document.getElementById('home-screen');
const gameScreen = document.getElementById('game-screen');
const leaderboardScreen = document.getElementById('leaderboard-screen');

// Starting the game from the main menu
startGameBtn.addEventListener('click', () => {
    // Make sure we grab the absolute freshest word from the DB before starting
    fetchGameState();
    homeScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    setupBoard();
});

const chooseNameBtn = document.getElementById('choose-name-btn');
const playerDropdownList = document.getElementById('player-dropdown-list');

// Fetch players for the dropdown menu
async function populatePlayerDropdown() {
    const { data: players, error } = await supabase.from('players').select('id, username');
    
    if (error) {
        console.error("Error fetching players for dropdown:", error);
        return;
    }

    if (chooseNameBtn && playerDropdownList) {
        playerDropdownList.innerHTML = ''; 
        
        players.forEach(player => {
            const li = document.createElement('li');
            li.textContent = player.username;

            li.addEventListener('click', () => {
                currentPlayer = player.username;
                currentPlayerId = player.id;

                localStorage.setItem('jawrgon_username', currentPlayer);
                localStorage.setItem('jawrgon_userid', currentPlayerId);

                updateStartButton();
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
}


// ============== Leaderboard =================

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
    fetchAndRenderLeaderboard();
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

    const playersWithLiveTime = players.map(player => {
        let displayTimeSeconds = player.total_time_as_shark;
        const isShark = player.username === currentShark;

        if (isShark && sharkStartTime) {
            const liveSeconds = Math.floor((new Date() - new Date(sharkStartTime)) / 1000);
            displayTimeSeconds += liveSeconds;
        }

        // We also pass the baseTime so the timer knows what number to start adding to
        return { ...player, displayTimeSeconds, isShark, baseTime: player.total_time_as_shark };
    });

    const sortedPlayers = playersWithLiveTime.sort((a, b) => b.displayTimeSeconds - a.displayTimeSeconds);

    sortedPlayers.forEach((player, index) => {
        const rank = index + 1;

        let rankClass = '';
        if (rank === 1) rankClass = 'rank-1';
        if (rank === 2) rankClass = 'rank-2';
        if (rank === 3) rankClass = 'rank-3';

        const formattedTime = formatSharkTime(player.displayTimeSeconds);
        const sharkStyle = player.isShark ? 'style="color: var(--color-present);"' : '';
        
        // NEW: Tag the active shark's time cell so our timer loop can find it
        const timeCellId = player.isShark ? 'id="active-shark-live-time"' : '';
        const baseTimeAttr = player.isShark ? `data-basetime="${player.baseTime}"` : '';

        const rowHTML = `
        <tr>
            <td class="${rankClass}">${rank}</td>
            <td ${sharkStyle}>${player.username}</td>
            <td ${sharkStyle} ${timeCellId} ${baseTimeAttr}>${formattedTime}</td>
            <td>${player.fish_eaten}</td>
            <td>${player.sharks_evaded}</td>
        </tr>
        `;

        tbody.insertAdjacentHTML('beforeend', rowHTML);
    });
}

// ========== Info modals ============

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

const closableModalIds = [
    'how-to-play-modal'
];

closableModalIds.forEach(id => {
    const modal = document.getElementById(id);
    
    if (modal) {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.classList.add('hidden');
            }
        });
    }
});

// ========== API Fetching ============

async function fetchGameState() {
    const { data, error } = await supabase
        .from('game_state')
        .select(`
            secret_word,
            current_shark_id,
            shark_start_time,
            players ( username )
        `)
        .eq('id', 1)
        .single();

    if (error) {
        console.error("Error fetching game state:", error);
        return;
    }

    // Set the global variables
    secretWord = data.secret_word;
    currentSharkId = data.current_shark_id;
    sharkStartTime = data.shark_start_time; // Save it globally
    
    currentShark = data.players ? data.players.username : "No Shark Yet";
    
    updateSharkDisplay();
    updateStartButton();
    startSharkTimer(); // Start the ticking clock!
}

async function fetchAndRenderLeaderboard() {
    const { data: players, error } = await supabase
        .from('players')
        .select('*')
        .order('total_time_as_shark', { ascending: false })
        .limit(10);

    if (error) {
        console.error("Error fetching leaderboard:", error);
        return;
    }

    cachedPlayers = players; // Save to our global memory!
    renderLeaderboard(cachedPlayers);
}

function startSharkTimer() {
    // Clear any existing timer so we don't accidentally run two clocks at once
    if (timerInterval) {
        clearInterval(timerInterval);
    }

    if (!sharkStartTime || currentShark === "No Shark Yet") return;

    function tickClock() {
        // Only do the heavy lifting if the user is actually looking at the leaderboard
        const leaderboardScreen = document.getElementById('leaderboard-screen');
        
        if (!leaderboardScreen.classList.contains('hidden') && cachedPlayers.length > 0) {
            // Re-render the table using our saved memory. 
            // Because renderLeaderboard recalculates the live time AND sorts the array,
            // the Shark will automatically jump up a row the second they beat the next score!
            renderLeaderboard(cachedPlayers);
        }
    }

    tickClock(); // Run once immediately
    timerInterval = setInterval(tickClock, 1000); // Loop every 1 second
}

// ========== Realtime Subscriptions ============

function setupRealtimeSubscriptions() {
    // 1. Listen for changes to the Leaderboard (players table)
    supabase
        .channel('players-channel')
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'players' },
            (payload) => {
                console.log("Live update! Someone's stats changed.");
                // Simply re-fetch and re-render the leaderboard
                fetchAndRenderLeaderboard();
            }
        )
        .subscribe();

    // 2. Listen for changes to the Game State (New Shark / New Word!)
    supabase
        .channel('game-state-channel')
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'game_state' },
            async (payload) => {
                console.log("Live update! New Shark took over!");
                
                // Save the old word before we fetch the new one
                const oldSecretWord = secretWord;
                
                // Fetch the new state (This updates the UI, timer, and the secretWord variable)
                await fetchGameState();

                // UX Polish: If a player is currently in the middle of a game 
                // and someone else wins, we need to let them know the word changed!
                const gameScreenIsVisible = !document.getElementById('game-screen').classList.contains('hidden');
                const isCurrentlyPlaying = currentRow > 0 || currentTile > 0;

                if (gameScreenIsVisible && isCurrentlyPlaying && oldSecretWord !== secretWord && !isGameOver) {
                    alert(`Whoops! ${currentShark} just guessed the word and became the new Shark! The secret word has been changed.`);
                    setupBoard(); // Reset their board so they can try against the new word
                }
            }
        )
        .subscribe();
}

async function displayWordSuggestions() {
    const suggestionsContainer = document.getElementById('word-suggestions');
    const sug1Btn = document.getElementById('suggestion-1');
    const sug2Btn = document.getElementById('suggestion-2');
    const newWordInput = document.getElementById('new-word-input');

    // Hide initially while loading
    suggestionsContainer.classList.add('hidden');

    // 1. Fetch used words from the database
    const { data, error } = await supabase.from('used_words').select('word');
    
    let usedWordsList = [];
    if (!error && data) {
        usedWordsList = data.map(row => row.word.toUpperCase());
    }

    // 2. Filter out used words from the global VALID_WORDS array
    const unusedWords = COMMON_WORDS.filter(word => !usedWordsList.includes(word.toUpperCase()));

    // 3. Pick 2 random words
    if (unusedWords.length >= 2) {
        // Pick two unique random indices
        const randomIndices = [];
        while(randomIndices.length < 2){
            let r = Math.floor(Math.random() * unusedWords.length);
            if(randomIndices.indexOf(r) === -1) randomIndices.push(r);
        }
        
        const word1 = unusedWords[randomIndices[0]].toUpperCase();
        const word2 = unusedWords[randomIndices[1]].toUpperCase();

        // 4. Update UI
        sug1Btn.textContent = word1;
        sug2Btn.textContent = word2;

        // Make them clickable to auto-fill the input
        sug1Btn.onclick = () => {
            newWordInput.value = word1;
            newWordInput.focus();
        };
        sug2Btn.onclick = () => {
            newWordInput.value = word2;
            newWordInput.focus();
        };

        suggestionsContainer.classList.remove('hidden');
    }
}

// Call the new function alongside your other initialization functions at the very bottom
setupRealtimeSubscriptions();

// Initialize the game with live data
fetchGameState();
fetchAndRenderLeaderboard();
populatePlayerDropdown();