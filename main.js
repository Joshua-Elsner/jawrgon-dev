// ==========================================
// IMPORTS
// ==========================================
import { 
    fetchGameState, fetchLeaderboard, fetchPlayers, 
    claimSharkTitle, recordSharkMeal, fetchUsedWords, 
    setupRealtimeSubscriptions, createNewPlayer
} from './api.js';

import { 
    gameState, setPlayer, resetGameState, addLetterToState, 
    deleteLetterFromState, advanceRow, isValidWord, 
    evaluateGuess, processLeaderboardData 
} from './game.js';

import { 
    showToast, resetBoardUI, updateTileText, paintRowStatuses, 
    shakeRow, revealNextRow, updateSharkDisplay, updateStartButton, 
    renderPlayerList, toggleScreen, setupWinModal, 
    renderWordSuggestions, setSubmitButtonLoading, renderLeaderboardTable 
} from './ui.js';

// ==========================================
// INITIALIZATION & DATA FETCHING
// ==========================================

let timerInterval = null;

async function init() {
    try {
        await loadGameState();
        await loadLeaderboard();
        await loadPlayers(); // <-- Just call it here now!

        // Setup real-time listeners for multiplayer updates
        setupRealtimeSubscriptions(
            () => { loadLeaderboard(); loadPlayers(); },
            async () => {             // Callback for when game state changes
                const oldSecretWord = gameState.secretWord;
                await loadGameState();

                const isGameVisible = !document.getElementById('game-screen').classList.contains('hidden');
                const isCurrentlyPlaying = gameState.currentRow > 0 || gameState.currentTile > 0;

                if (isGameVisible && isCurrentlyPlaying && oldSecretWord !== gameState.secretWord && !gameState.isGameOver) {
                    showToast(`YOINK!!!\n${gameState.currentShark} just guessed the word!`);
                    startNewGame(); 
                }
            }
        );
    } catch (error) {
        showToast("Error connecting to server.");
        console.error(error);
    }
}

async function loadPlayers() {
    try {
        const players = await fetchPlayers();
        
        // If the current player isn't "Guest", check if their ID still exists in the database
        if (gameState.currentPlayerId) {
            const playerStillExists = players.some(p => p.id === gameState.currentPlayerId);
            if (!playerStillExists) {
                // If they were wiped from the DB, reset them to Guest
                setPlayer("Guest", null);
                updateStartButton("Guest", gameState.currentShark);
            }
        }

        renderPlayerList(players, (selectedPlayer) => {
            setPlayer(selectedPlayer.username, selectedPlayer.id);
            updateStartButton(gameState.currentPlayer, gameState.currentShark);
            toggleScreen('player-modal', false);
        });
    } catch (e) {
        console.error(e);
    }
}

async function loadGameState() {
    const data = await fetchGameState();
    gameState.secretWord = data.secret_word;
    gameState.currentSharkId = data.current_shark_id;
    gameState.sharkStartTime = data.shark_start_time;
    gameState.currentShark = data.players ? data.players.username : "No Shark Yet";

    updateSharkDisplay(gameState.currentShark);
    updateStartButton(gameState.currentPlayer, gameState.currentShark);
    startSharkTimer();
}

async function loadLeaderboard() {
    const players = await fetchLeaderboard();
    gameState.cachedPlayers = players;
    updateLeaderboardUI();
}

function updateLeaderboardUI() {
    if (gameState.cachedPlayers.length === 0) return;
    const sortedPlayers = processLeaderboardData(gameState.cachedPlayers);
    renderLeaderboardTable(sortedPlayers);
}

function startSharkTimer() {
    if (timerInterval) clearInterval(timerInterval);
    if (!gameState.sharkStartTime || gameState.currentShark === "No Shark Yet") return;

    timerInterval = setInterval(() => {
        const leaderboardScreen = document.getElementById('leaderboard-screen');
        // Only run the heavy sorting/rendering if they are actually looking at the leaderboard
        if (leaderboardScreen && !leaderboardScreen.classList.contains('hidden')) {
            updateLeaderboardUI();
        }
    }, 1000);
}

function startNewGame() {
    resetGameState(); // game.js
    resetBoardUI();   // ui.js
}

// ==========================================
// CORE GAME LOOP
// ==========================================

function handleKeyInput(letter) {
    if (gameState.isGameOver) return;

    if (letter === "ENTER") {
        submitGuess();
    } else if (letter === "BACK" || letter === "BACKSPACE") {
        if (deleteLetterFromState()) {
            updateTileText(gameState.currentRow, gameState.currentTile, "");
        }
    } else {
        if (addLetterToState(letter)) {
            // Because addLetterToState increments currentTile, we use currentTile - 1 for the UI index
            updateTileText(gameState.currentRow, gameState.currentTile - 1, letter);
        }
    }
}

async function submitGuess() {
    if (gameState.currentGuess.length !== 5) return;

    if (!isValidWord(gameState.currentGuess)) {
        shakeRow(gameState.currentRow);
        showToast("Not in word list");
        return;
    }

    // 1. Calculate Results (Brain)
    const statuses = evaluateGuess(gameState.currentGuess, gameState.secretWord);

    // 2. Update UI (View)
    paintRowStatuses(gameState.currentRow, gameState.currentGuess, statuses);

    // 3. Check Win/Loss
    if (gameState.currentGuess === gameState.secretWord) {
        handleWin();
    } else {
        if (gameState.currentRow === 5) { // 6th attempt (0-indexed)
            handleLoss();
        } else {
            advanceRow();
            revealNextRow(gameState.currentRow);
        }
    }
}

async function handleWin() {
    gameState.isGameOver = true;
    setupWinModal(gameState.currentPlayer);
    toggleScreen('win-modal', true);

    if (gameState.currentPlayer !== "Guest") {
        try {
            const usedWords = await fetchUsedWords();
            
            // FIX: Access the global variables directly rather than through the window object
            let wordBank = [];
            if (typeof COMMON_WORDS !== 'undefined') {
                wordBank = COMMON_WORDS;
            } else if (typeof VALID_WORDS !== 'undefined') {
                wordBank = VALID_WORDS;
            }

            const unusedWords = wordBank.filter(word => !usedWords.includes(word.toUpperCase()));

            if (unusedWords.length >= 2) {
                // Get two unique random indices
                const randomIndices = [];
                while(randomIndices.length < 2){
                    let r = Math.floor(Math.random() * unusedWords.length);
                    if(!randomIndices.includes(r)) randomIndices.push(r);
                }
                
                renderWordSuggestions(unusedWords[randomIndices[0]].toUpperCase(), unusedWords[randomIndices[1]].toUpperCase());
            }
        } catch (error) {
            console.error("Failed to load word suggestions:", error);
        }
    }
}

async function handleLoss() {
    gameState.isGameOver = true;
    toggleScreen('lose-modal', true);

    if (gameState.currentSharkId) {
        try {
            await recordSharkMeal();
        } catch (error) {
            console.error("Failed to record meal.", error);
        }
    }
}

// ==========================================
// EVENT LISTENERS
// ==========================================

// --- Keyboard Input ---
document.querySelectorAll('.key').forEach(key => {
    key.addEventListener('click', () => {
        handleKeyInput(key.textContent.trim());
    });
});

document.addEventListener('keydown', (e) => {
    if (gameState.isGameOver) return;
    
    if (e.key === 'Enter') {
        handleKeyInput('ENTER');
    } else if (e.key === 'Backspace') {
        handleKeyInput('BACK');
    } else if (/^[a-zA-Z]$/.test(e.key)) {
        handleKeyInput(e.key.toUpperCase());
    }
});

// --- Main Menu Buttons ---
document.getElementById('start-game-btn').addEventListener('click', async () => {
    await loadGameState(); // Ensure freshest data before playing
    startNewGame();
    toggleScreen('home-screen', false);
    toggleScreen('game-screen', true);
});

document.getElementById('leaderboard-btn').addEventListener('click', () => {
    loadLeaderboard();
    toggleScreen('home-screen', false);
    toggleScreen('leaderboard-screen', true);
});

document.getElementById('how-to-play-btn').addEventListener('click', () => {
    toggleScreen('how-to-play-modal', true);
});

// --- Remove old Dropdown Controls section entirely, and add this: ---

// --- Player Modal Controls ---
document.getElementById('open-player-modal-btn')?.addEventListener('click', () => {
    toggleScreen('player-modal', true);
});
document.getElementById('close-player-x')?.addEventListener('click', () => {
    toggleScreen('player-modal', false);
});

// --- Create New Player ---
document.getElementById('create-player-btn')?.addEventListener('click', async () => {
    const input = document.getElementById('new-player-input');
    const newUsername = input ? input.value.trim() : "";

    // 1. Local Validation
    if (!/^[a-zA-Z0-9 ']{1,13}$/.test(newUsername)) {
        showToast("Name must be 1-13 letters/numbers only.");
        return;
    }

    const btn = document.getElementById('create-player-btn');
    btn.textContent = "Creating...";
    btn.disabled = true;

    // 2. Database Creation
    try {
        const newPlayer = await createNewPlayer(newUsername);
        
        // 3. Update State & UI
        setPlayer(newPlayer.username, newPlayer.id);
        updateStartButton(gameState.currentPlayer, gameState.currentShark);
        
        input.value = ""; // Clear input
        toggleScreen('player-modal', false);
        showToast(`Welcome, ${newPlayer.username}!`);
        
        await loadPlayers(); // Refresh list

    } catch (error) {
        showToast(error.message || "Failed to create player.");
    } finally {
        btn.textContent = "Create & Play";
        btn.disabled = false;
    }
});

// --- Modal Controls ---
document.getElementById('close-how-to-play-btn')?.addEventListener('click', () => toggleScreen('how-to-play-modal', false));
document.getElementById('close-how-to-x')?.addEventListener('click', () => toggleScreen('how-to-play-modal', false));
document.getElementById('try-again-btn')?.addEventListener('click', () => {
    toggleScreen('lose-modal', false);
    startNewGame();
});

document.getElementById('lose-menu-btn')?.addEventListener('click', () => {
    toggleScreen('lose-modal', false);
    toggleScreen('game-screen', false);
    toggleScreen('home-screen', true);
    startNewGame();
});

document.getElementById('lose-leaderboard-btn')?.addEventListener('click', () => {
    toggleScreen('lose-modal', false);
    toggleScreen('game-screen', false);
    loadLeaderboard();
    toggleScreen('leaderboard-screen', true);
    startNewGame();
});

document.getElementById('back-to-menu-btn')?.addEventListener('click', () => {
    toggleScreen('leaderboard-screen', false);
    toggleScreen('home-screen', true);
});

// Click outside to close modals
const closableModalIds = ['how-to-play-modal'];
closableModalIds.forEach(id => {
    const modal = document.getElementById(id);
    if (modal) {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) toggleScreen(id, false);
        });
    }
});

// --- New Word Submission ---
document.getElementById('submit-new-word')?.addEventListener('click', async () => {
    if (gameState.currentPlayer === "Guest") {
        toggleScreen('win-modal', false);
        toggleScreen('game-screen', false);
        toggleScreen('home-screen', true);
        startNewGame();
        return;
    }

    const input = document.getElementById('new-word-input');
    const newWord = input ? input.value.toUpperCase().trim() : "";

    if (newWord.length !== 5) {
        showToast("Must be 5 letters");
        return;
    }

    if (!isValidWord(newWord)) {
        showToast("Not in word list");
        return;
    }

    setSubmitButtonLoading(true);

    try {
        await claimSharkTitle(gameState.currentPlayerId, gameState.currentGuess, newWord);
        
        // Success!
        gameState.currentSharkId = gameState.currentPlayerId;
        gameState.secretWord = newWord;
        
        setSubmitButtonLoading(false);
        toggleScreen('win-modal', false);
        toggleScreen('game-screen', false);
        
        await loadLeaderboard();
        toggleScreen('leaderboard-screen', true);
        startNewGame();

    } catch (error) {
        setSubmitButtonLoading(false);
        if (error.message && error.message.includes('Word already used')) {
            showToast("That word has already been used in a past game!");
        } else {
            showToast(error.message || "Failed to update the database.");
        }
    }
});

// Allow hitting Enter in the input field
document.getElementById('new-word-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('submit-new-word').click();
    }
});

// ==========================================
// START APP
// ==========================================
init();