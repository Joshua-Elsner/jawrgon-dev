// ==========================================
// IMPORTS
// ==========================================
import {
    fetchGameState, fetchLeaderboard, fetchPlayers,
    claimSharkTitle, recordSharkMeal, fetchWordSuggestions,
    setupRealtimeSubscriptions, createNewPlayer,
    recordYoink, sendYoinkBroadcast,
    fetchLastWeekWinners, fetchWeeklyRecap
} from './api.js';

import {
    gameState, setPlayer, resetGameState, addLetterToState,
    deleteLetterFromState, advanceRow, isValidWord,
    evaluateGuess, processLeaderboardData, processPlayerStatsData,
    saveBoardState, loadBoardState, clearBoardState,
    replaceLetterInState
} from './game.js';

import {
    showToast, resetBoardUI, updateTileText, paintRowStatuses,
    shakeRow, revealNextRow, updateSharkDisplay, updateStartButton,
    renderPlayerList, toggleScreen, setupWinModal,
    renderWordSuggestions, setSubmitButtonLoading, renderLeaderboardTable,
    renderPlayerStatsTable, updateGuessCounter,
    setWeekEndingDate, setStartButtonLoading, setPlayerGridLoading,
    setLeaderboardLoading, setStatsLoading, setSuggestionsLoading,
    showWeeklyRecap, escapeHTML
} from './ui.js';

// ==========================================
// INITIALIZATION & DATA FETCHING
// ==========================================

let timerInterval = null;
cacheKeyGeometries();

async function init() {
    try {

        setStartButtonLoading();
        setPlayerGridLoading();

         setWeekEndingDate();

        await loadGameState();
        await loadLeaderboard();
        await loadPlayers();
        gameState.lastWeekWinners = await fetchLastWeekWinners();

        // 1. Core Game State Subscriptions
        setupRealtimeSubscriptions(
            () => { loadLeaderboard(); loadPlayers(); },

            // Callback for game state change
            async () => {
                const oldSecretWord = gameState.secretWord;
                await loadGameState();

                const isGameVisible = !document.getElementById('game-screen').classList.contains('hidden');
                const isCurrentlyPlaying = gameState.currentRow > 0 || gameState.currentTile > 0;
                const isSettingWord = !document.getElementById('win-modal').classList.contains('hidden');

                if (isGameVisible && oldSecretWord !== gameState.secretWord) {
                    if ((isCurrentlyPlaying && !gameState.isGameOver) || isSettingWord) {
                        showToast(`YOINK!!!\n<span class="toast-highlight">${escapeHTML(gameState.currentShark)}</span> guessed it!\nWord was: <span class="toast-highlight">${escapeHTML(oldSecretWord)}</span>`, 4000);
                        if (isSettingWord) {
                            toggleScreen('win-modal', false);
                        }

                        // Trust the client to report that it got yoinked
                        recordYoink(gameState.currentSharkId);
                        sendYoinkBroadcast(gameState.currentSharkId, gameState.currentPlayer);

                        startNewGame();
                    }
                }
            },

            // Callback for Yoink Broadcasts
            (payload) => {
                if (gameState.currentPlayerId === payload.sharkId) {
                    showToast(`<span class="toast-highlight">${escapeHTML(payload.yoinkedName)}</span> got yoinked! Gottem!`, 3500);
                }
            }
        );
       
        // --- WEEKLY RECAP CHECK ---
        const recap = await fetchWeeklyRecap();
        
        if (recap) {
            const lastSeenWeek = localStorage.getItem('jawrgon_last_seen_week');
            
            if (!lastSeenWeek) {
                // Scenario 1: First time loading the update OR a brand new player.
                // Silently stamp their browser with the current week so they are synced, 
                // but do NOT show them the modal for a week they didn't see.
                localStorage.setItem('jawrgon_last_seen_week', recap.weekEnding);
            } 
            else if (lastSeenWeek !== recap.weekEnding) {
                // Scenario 2: They have a stamp, but a new Sunday reset has happened!
                showWeeklyRecap(recap);
                
                // Set up the one-time event listener to close and save
                document.getElementById('close-recap-btn').onclick = () => {
                    localStorage.setItem('jawrgon_last_seen_week', recap.weekEnding);
                    toggleScreen('weekly-recap-modal', false);
                };
            }
        }

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
            updateSharkDisplay(gameState.currentShark, gameState.currentPlayer, gameState.secretWord);
            toggleScreen('player-modal', false);
        }, gameState.currentSharkId);

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

    updateSharkDisplay(gameState.currentShark, gameState.currentPlayer, gameState.secretWord);
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

function updatePlayerStatsUI() {
    if (gameState.cachedPlayers.length === 0) return;

    const sortSelect = document.getElementById('stats-sort-select');
    const currentSort = sortSelect ? sortSelect.value : 'alpha';
    
    const sortedStats = processPlayerStatsData(gameState.cachedPlayers, currentSort);
    
    // Pass currentSort into the render function
    renderPlayerStatsTable(sortedStats, currentSort); 
}

function startSharkTimer() {
    if (timerInterval) clearInterval(timerInterval);
    if (!gameState.sharkStartTime || gameState.currentShark === "No Shark Yet") return;

    timerInterval = setInterval(() => {
        const leaderboardScreen = document.getElementById('leaderboard-screen');
        const statsScreen = document.getElementById('player-stats-screen');
        
        // Only run heavy sorting/rendering if they are actually looking at the screen
        if (leaderboardScreen && !leaderboardScreen.classList.contains('hidden')) {
            updateLeaderboardUI();
        }
        if (statsScreen && !statsScreen.classList.contains('hidden')) {
            updatePlayerStatsUI();
        }
    }, 1000);
}

function startNewGame() {
    resetGameState(); // game.js
    resetBoardUI();   // ui.js

    // Check if they have an active game for THIS word
    if (loadBoardState() && gameState.submittedGuesses.length > 0) {
        restoreBoardUI();
    }
}

function restoreBoardUI() {
    // Replay every saved guess to instantly reconstruct the board
    gameState.submittedGuesses.forEach((guess, index) => {
        for (let i = 0; i < 5; i++) {
            updateTileText(index, i, guess[i]);
        }
        const statuses = evaluateGuess(guess, gameState.secretWord);
        paintRowStatuses(index, guess, statuses);
        revealNextRow(index);
    });

    gameState.currentRow = gameState.submittedGuesses.length;

    // Check if they reloaded after already finishing the game
    if (gameState.isGameOver) {
        const lastGuess = gameState.submittedGuesses[gameState.submittedGuesses.length - 1];
        if (lastGuess === gameState.secretWord) {
            handleWin(); 
        } else {
            handleLoss(true); // Pass true to prevent double-awarding "Fish eaten"
        }
    } else if (gameState.currentRow < 6) {
        // Game is still active, open the next row for them!
        updateGuessCounter(gameState.currentRow);
        revealNextRow(gameState.currentRow);
    }
}

// ==========================================
// CORE GAME LOOP
// ==========================================

function clearCurrentRow() {
    while (gameState.currentTile > 0) {
        if (deleteLetterFromState()) {
            updateTileText(gameState.currentRow, gameState.currentTile, "");
        }
    }
}

function handleKeyInput(letter) {
    if (gameState.isGameOver) return;

    if (letter === "ENTER") {
        submitGuess();
        } else if (letter === "BACK" || letter === "BACKSPACE") {
        clearSelection(); // NEW
        if (deleteLetterFromState()) {
            updateTileText(gameState.currentRow, gameState.currentTile, "");
        }
    } else if (letter === "CLEAR") {
        clearSelection(); // NEW
        clearCurrentRow();
    } else {
        // NEW LOGIC: Replace letter if a bubble is selected
        if (gameState.selectedTileIndex !== null) {
            if (replaceLetterInState(letter)) {
                updateTileText(gameState.currentRow, gameState.selectedTileIndex, letter);
            }
        } else {
            // NORMAL LOGIC: Add letter to the end
            if (addLetterToState(letter)) {
                updateTileText(gameState.currentRow, gameState.currentTile - 1, letter);
            }
        }
    }
}

async function submitGuess() {
    // 1. Check if they have enough letters
    if (gameState.currentGuess.length !== 5) {
        shakeRow(gameState.currentRow);
        showToast("Not enough letters");
        return;
    }

    // 2. Check if it's a valid dictionary word
    const isValid = isValidWord(gameState.currentGuess);
    if (!isValid) {
        shakeRow(gameState.currentRow);
        showToast("Not in word list");
        return;
    }

    clearSelection();

    // 3. Calculate Results (Brain)
    const statuses = evaluateGuess(gameState.currentGuess, gameState.secretWord);

    // 4. Update UI (View)
    paintRowStatuses(gameState.currentRow, gameState.currentGuess, statuses);

    // 5. Save the Guess (Memory)
    gameState.submittedGuesses.push(gameState.currentGuess);

    // 6. Check Win/Loss
    if (gameState.currentGuess === gameState.secretWord) {
        gameState.isGameOver = true;
        saveBoardState();
        handleWin();
    } else {
        if (gameState.currentRow === 5) { // 6th attempt (0-indexed)
            gameState.isGameOver = true;
            saveBoardState();
            handleLoss();
        } else {
            advanceRow();
            saveBoardState();
            updateGuessCounter(gameState.currentRow);
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
            setSuggestionsLoading();
            // Ask the database for 2 words
            const suggestions = await fetchWordSuggestions();
            if (suggestions && suggestions.length === 2) {
                renderWordSuggestions(suggestions[0], suggestions[1]);
            }
        } catch (error) {
            console.error("Failed to load word suggestions:", error);
        }
    }
}

async function handleLoss(isRestore = false) {
    gameState.isGameOver = true;
    toggleScreen('lose-modal', true);

    if (gameState.currentSharkId && !isRestore) {
        try {
            // Check if they are retrying the exact same word
            const isRetry = localStorage.getItem('jawrgon_last_lost_word') === gameState.secretWord;
            const guessesUsed = gameState.submittedGuesses.length;
            
            await recordSharkMeal(gameState.currentPlayerId, guessesUsed, isRetry);
            
            // Flag that they have now recorded a loss for this word
            localStorage.setItem('jawrgon_last_lost_word', gameState.secretWord);
        } catch (error) {
            console.error("Failed to record meal.", error);
        }
    }
}

// ==========================================
// EVENT LISTENERS
// ==========================================

// --- Virtual Keyboard Hit Detection ---
let keyGeometries = [];

function cacheKeyGeometries() {
    keyGeometries = [];
    document.querySelectorAll('.key').forEach(key => {
        const rect = key.getBoundingClientRect();
        keyGeometries.push({
            id: key.id,
            textContent: key.textContent.trim(),
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom
        });
    });
}

const keyboardContainer = document.getElementById('keyboard');
//let backspaceTimeout = null;

keyboardContainer.addEventListener('pointerdown', (e) => {
    e.preventDefault();

    const x = e.clientX;
    const y = e.clientY;

    // Find the key whose bounding box contains the pointer coordinates
    const hitKey = keyGeometries.find(geo => 
        x >= geo.left && x <= geo.right && y >= geo.top && y <= geo.bottom
    );

    if (!hitKey) return; // User tapped dead space between keys

    const cancelBackspace = (e) => {
    e.preventDefault();
    if (backspaceTimeout) {
        clearTimeout(backspaceTimeout);
        backspaceTimeout = null;
        handleKeyInput('BACK'); // Timeout didn't finish, do a normal backspace
    }
};

keyboardContainer.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const x = e.clientX;
    const y = e.clientY;

    const hitKey = keyGeometries.find(geo => 
        x >= geo.left && x <= geo.right && y >= geo.top && y <= geo.bottom
    );

    if (!hitKey) return;

    if (hitKey.id === 'key-backspace') {
        backspaceTimeout = setTimeout(() => {
            clearCurrentRow();
            backspaceTimeout = null; 
        }, 500);
    } else {
        handleKeyInput(hitKey.textContent);
    }
});

// Attach the cancellation events to the container itself
keyboardContainer.addEventListener('pointerup', cancelBackspace);
keyboardContainer.addEventListener('pointerleave', cancelBackspace);
});

// Update bounds when the window resizes or device rotates
window.addEventListener('resize', cacheKeyGeometries);

export function clearSelection() {
    gameState.selectedTileIndex = null;
    document.querySelectorAll('.tile.selected').forEach(t => t.classList.remove('selected'));
}

document.querySelectorAll('.board-row').forEach((row, rowIndex) => {
    const tiles = row.querySelectorAll('.tile');
    tiles.forEach((tile, tileIndex) => {
        tile.addEventListener('click', () => {
            // Only allow clicking in the active row
            if (rowIndex !== gameState.currentRow) return;
            
            // Only allow selecting tiles that have a letter in them
            if (tileIndex >= gameState.currentGuess.length) return;

            // Toggle selection
            if (gameState.selectedTileIndex === tileIndex) {
                clearSelection();
            } else {
                clearSelection();
                gameState.selectedTileIndex = tileIndex;
                tile.classList.add('selected');
            }
        });
    });
});

// --- Virtual Keyboard Input ---
let backspaceTimeout = null;

document.querySelectorAll('.key').forEach(key => {
    if (key.id === 'key-backspace') {
        // Long-press logic for backspace
        key.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            backspaceTimeout = setTimeout(() => {
                clearCurrentRow();
                backspaceTimeout = null; // Reset so pointerup doesn't fire a single backspace
            }, 500);
        });

        const cancelBackspace = (e) => {
            e.preventDefault();
            if (backspaceTimeout) {
                clearTimeout(backspaceTimeout);
                backspaceTimeout = null;
                handleKeyInput('BACK'); // Timeout didn't finish, do a normal backspace
            }
        };

        key.addEventListener('pointerup', cancelBackspace);
        key.addEventListener('pointerleave', cancelBackspace);
        
    } else {
        // Standard logic for all other keys
        key.addEventListener('pointerdown', (e) => {
            e.preventDefault(); 
            handleKeyInput(key.textContent.trim());
        });
    }
});

// Intercepts and kills double-clicks before the mobile browser can use them to zoom
document.addEventListener('dblclick', (e) => {
    e.preventDefault();
}, { passive: false });

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

document.getElementById('board-return-menu-btn')?.addEventListener('click', async () => {
    console.log("1. Back button clicked. Telling Supabase I am no longer guessing...");

    // 1. Instantly update the UI so there is zero lag
    toggleScreen('game-screen', false);
    toggleScreen('home-screen', true);
    startNewGame();
});

document.getElementById('leaderboard-btn').addEventListener('click', () => {
    if (gameState.cachedPlayers.length === 0) setLeaderboardLoading();
    updateLeaderboardUI();
    loadLeaderboard();
    toggleScreen('home-screen', false);
    toggleScreen('leaderboard-screen', true);
});

document.getElementById('player-stats-btn')?.addEventListener('click', () => {
    if (gameState.cachedPlayers.length === 0) setStatsLoading();
    loadLeaderboard(); // Refreshes the cachedPlayers array from the DB
    updatePlayerStatsUI();
    toggleScreen('home-screen', false);
    toggleScreen('player-stats-screen', true);
});

document.getElementById('stats-back-to-menu-btn')?.addEventListener('click', () => {
    toggleScreen('player-stats-screen', false);
    toggleScreen('home-screen', true);
});

document.getElementById('how-to-play-btn').addEventListener('click', () => {
    toggleScreen('how-to-play-modal', true);
});

// --- Remove old Dropdown Controls section entirely, and add this: ---

// --- Player Modal Controls ---
document.getElementById('open-player-modal-btn')?.addEventListener('click', () => {
    // Wipe the search bar clean every time the modal opens
    const searchInput = document.getElementById('player-search-input');
    if (searchInput) {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input')); // Forces the grid to un-hide everyone
    }
    
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
    if (!/^[a-zA-Z0-9 '!]{1,13}$/.test(newUsername)) {
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
        updateSharkDisplay(gameState.currentShark, gameState.currentPlayer, gameState.secretWord);

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
document.getElementById('close-how-to-play-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleScreen('how-to-play-modal', false);
});

document.getElementById('close-how-to-x')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleScreen('how-to-play-modal', false);
});

document.getElementById('try-again-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleScreen('lose-modal', false);
    clearBoardState();
    startNewGame();
});

document.getElementById('lose-menu-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleScreen('lose-modal', false);
    toggleScreen('game-screen', false);
    toggleScreen('home-screen', true);
    clearBoardState();
    startNewGame();
});

document.getElementById('stats-sort-select')?.addEventListener('change', () => {
    updatePlayerStatsUI(); // Instantly re-sorts and re-renders when they click an option
    
    // Snap the table back to the left side
    const statsContainer = document.querySelector('.stats-container');
    if (statsContainer) {
        statsContainer.scrollLeft = 0;
        statsContainer.scrollTop = 0;
    }
});

// --- Player Search Filter ---
document.getElementById('player-search-input')?.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const buttons = document.querySelectorAll('#player-list-grid button');

    buttons.forEach(btn => {
        // textContent cleanly grabs the username and ignores the HTML tags for the Shark icon
        const username = btn.textContent.toLowerCase();
        
        if (username.includes(searchTerm)) {
            btn.classList.remove('hidden');
        } else {
            btn.classList.add('hidden');
        }
    });
});

document.getElementById('lose-leaderboard-btn')?.addEventListener('click', () => {
    toggleScreen('lose-modal', false);
    toggleScreen('game-screen', false);

    updateLeaderboardUI();
    loadLeaderboard();

    toggleScreen('leaderboard-screen', true);
    clearBoardState();
    startNewGame();
});

document.getElementById('back-to-menu-btn')?.addEventListener('click', () => {
    toggleScreen('leaderboard-screen', false);
    toggleScreen('home-screen', true);
});

// --- NATIVE LIFECYCLE SYNC ---
// Instantly resync the true game state the moment the user looks at the tab
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        console.log("Tab woke up! Fetching true state...");
        loadGameState();
        loadLeaderboard();
    }
});

// --- THE JANITOR CHECK ---
// A highly scalable fallback that only runs if the screen is actively being looked at
setInterval(() => {
    if (document.visibilityState === 'visible') {
        loadGameState();
    }
}, 45000); // 45 seconds is plenty fast for a fallback

// Click outside to close modals
const closableModalIds = ['how-to-play-modal'];
closableModalIds.forEach(id => {
    const modal = document.getElementById(id);
    if (modal) {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                event.preventDefault();
                event.stopPropagation();
                toggleScreen(id, false);
            }
        });
    }
});

// --- New Word Submission ---
document.getElementById('submit-new-word')?.addEventListener('click', async () => {
    if (gameState.currentPlayer === "Guest") {
        toggleScreen('win-modal', false);
        toggleScreen('game-screen', false);
        toggleScreen('home-screen', true);
        clearBoardState();
        startNewGame();
        return;
    }

    const input = document.getElementById('new-word-input');
    const newWord = input ? input.value.toUpperCase().trim() : "";

    if (newWord.length !== 5) {
        showToast("Must be 5 letters");
        return;
    }

    setSubmitButtonLoading(true);

    // Await the validation
    const isValid = isValidWord(newWord);
    if (!isValid) {
        showToast("Not in word list");
        setSubmitButtonLoading(false);
        return;
    }

    try {
        const isRetry = localStorage.getItem('jawrgon_last_lost_word') === gameState.secretWord;
        const guessesUsed = gameState.submittedGuesses.length;

        await claimSharkTitle(gameState.currentPlayerId, gameState.currentGuess, newWord, guessesUsed, isRetry);

        // Success!
        clearBoardState();

        localStorage.removeItem('jawrgon_last_lost_word');

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
        } else if (error.message && error.message.includes('TOO SLOW!!!')) {
            // Wipe their board, fetch the new reality, and kick them out of the modal
            showToast("Oops! Someone else already guessed it! You may have a bad connection.");

            toggleScreen('win-modal', false);
            toggleScreen('game-screen', false);

            clearBoardState();
            await loadGameState();
            startNewGame();

            toggleScreen('home-screen', true);
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

/*
// ==========================================
// ANNOUNCEMENT
// ==========================================

setTimeout(() => {
    // Check if they've seen it before
    if (!localStorage.getItem('saw_reset_announcement')) {
        toggleScreen('announcement-modal', true);
    }
}, 500); // Slight delay so it pops up smoothly after the game loads

document.getElementById('dismiss-announcement-btn')?.addEventListener('click', () => {
    // Drop the cookie so they never see it again
    localStorage.setItem('saw_reset_announcement', 'true');
    toggleScreen('announcement-modal', false);
});
*/