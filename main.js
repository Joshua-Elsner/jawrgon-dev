// ==========================================
// IMPORTS
// ==========================================
import {
    fetchGameState, fetchLeaderboard, fetchPlayers,
    claimSharkTitle, recordSharkMeal, fetchWordSuggestions,
    setupRealtimeSubscriptions, createNewPlayer,
    recordYoink, sendYoinkBroadcast,
    setupPresence, updatePresence, mySessionId,
    fetchLastWeekWinners
} from './api.js';

import {
    gameState, setPlayer, resetGameState, addLetterToState,
    deleteLetterFromState, advanceRow, isValidWord,
    evaluateGuess, processLeaderboardData,
    saveBoardState, loadBoardState, clearBoardState
} from './game.js';

import {
    showToast, resetBoardUI, updateTileText, paintRowStatuses,
    shakeRow, revealNextRow, updateSharkDisplay, updateStartButton,
    renderPlayerList, toggleScreen, setupWinModal,
    renderWordSuggestions, setSubmitButtonLoading, renderLeaderboardTable,
    updateGuessCounter, updatePresenceUI
} from './ui.js';

// ==========================================
// INITIALIZATION & DATA FETCHING
// ==========================================

let timerInterval = null;

async function init() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('discord_linked') === 'success') {
            showToast("Discord successfully linked!");
            // Clean up the URL so the parameter disappears
            window.history.replaceState({}, document.title, window.location.pathname);
        }

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
                        showToast(`YOINK!!!\n<span class="toast-highlight">${gameState.currentShark}</span> guessed it!\nWord was: <span class="toast-highlight">${oldSecretWord}</span>`, 4000);
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
                    showToast(`<span class="toast-highlight">${payload.yoinkedName}</span> got yoinked! Gottem!`, 3500);
                }
            }
        );

        // 2. Setup the live Presence tracker with Auto-Culling
        let latestPresenceState = {};
        
        // NEW: Store the local time we received their last message to defeat Clock Drift
        let localPresenceData = {}; 

        function evaluatePresence() {
            let othersGuessingCount = 0;
            const now = Date.now();

            for (const key in latestPresenceState) {
                if (key === mySessionId) continue; 
                
                // Get this user's most recent sync data
                const latestObj = latestPresenceState[key].reduce((newest, current) => {
                    return (current.updatedAt || 0) > (newest.updatedAt || 0) ? current : newest;
                }, { isGuessing: false, updatedAt: 0 });
                
                let localData = localPresenceData[key];

                // NEW FIX: Accept the update if the timestamp is newer OR if their true/false state flipped!
                if (!localData || 
                    localData.foreignUpdatedAt !== latestObj.updatedAt || 
                    localData.isGuessing !== latestObj.isGuessing) {
                    
                    localData = {
                        isGuessing: latestObj.isGuessing,
                        foreignUpdatedAt: latestObj.updatedAt,
                        localReceivedAt: now 
                    };
                    localPresenceData[key] = localData;
                }

                // Evaluate using ONLY our local clock to prevent "Ghost Yoink" time drift
                if (localData.isGuessing && (now - localData.localReceivedAt < 25000)) {
                    othersGuessingCount++;
                }
            }
            
            updatePresenceUI(othersGuessingCount);
        }

        // Whenever the server sends data, save it and evaluate
        setupPresence((state) => {
            latestPresenceState = state;
            evaluatePresence();
        });

        // Even if the server is quiet, check the data locally every 3 seconds.
        // This instantly drops people who close tabs or lose internet!
        setInterval(evaluatePresence, 3000);
       
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

    const isValid = isValidWord(gameState.currentGuess);
    if (!isValid) {
        shakeRow(gameState.currentRow);
        showToast("Not in word list");
        return;
    }

    // 1. Calculate Results (Brain)
    const statuses = evaluateGuess(gameState.currentGuess, gameState.secretWord);

    // 2. Update UI (View)
    paintRowStatuses(gameState.currentRow, gameState.currentGuess, statuses);

    // 3. Save the Guess (Memory)
    gameState.submittedGuesses.push(gameState.currentGuess); // <-- ADD THIS

    // 4. Check Win/Loss
    if (gameState.currentGuess === gameState.secretWord) {
        gameState.isGameOver = true;
        saveBoardState(); // <-- ADD THIS
        handleWin();
    } else {
        if (gameState.currentRow === 5) { // 6th attempt (0-indexed)
            gameState.isGameOver = true;
            saveBoardState(); // <-- ADD THIS
            handleLoss();
        } else {
            advanceRow();
            saveBoardState(); // <-- ADD THIS
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
            // Simply ask the database for 2 words! No client filtering needed.
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

    // Prevent giving the Shark double points if the player refreshed the page!
    if (gameState.currentSharkId && !isRestore) {
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
    updatePresence(true);
});

document.getElementById('board-return-menu-btn')?.addEventListener('click', async () => {
    console.log("1. Back button clicked. Telling Supabase I am no longer guessing...");

    // 1. Instantly update the UI so there is zero lag
    toggleScreen('game-screen', false);
    toggleScreen('home-screen', true);
    startNewGame();

    // 2. Tell Supabase in the background
    await updatePresence(false);
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
document.getElementById('link-discord-btn')?.addEventListener('click', () => {
    console.log(" 1. The button was successfully clicked!");

    // Check if they are a guest
    if (gameState.currentPlayer === "Guest" || !gameState.currentPlayerId) {
        console.log("2. Blocked: No player is selected. They are currently a Guest.");
        showToast("You must select or create a player first!");
        return;
    }

    console.log("3. Player is selected. Building the Discord URL...");

    // Make sure you put your REAL Discord Client ID here!
    const clientId = '1490905676635967508';
    const redirectUri = encodeURIComponent('https://okbynkairmznzcriuknd.supabase.co/functions/v1/discord-callback');
    const state = gameState.currentPlayerId;

    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify&state=${state}`;

    console.log("🚀 4. Redirecting browser to:", discordAuthUrl);

    // This is the line that actually changes the page
    window.location.href = discordAuthUrl;
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
document.getElementById('close-how-to-play-btn')?.addEventListener('click', () => toggleScreen('how-to-play-modal', false));
document.getElementById('close-how-to-x')?.addEventListener('click', () => toggleScreen('how-to-play-modal', false));
document.getElementById('try-again-btn')?.addEventListener('click', () => {
    toggleScreen('lose-modal', false);
    clearBoardState();
    startNewGame();
});

document.getElementById('lose-menu-btn')?.addEventListener('click', () => {
    toggleScreen('lose-modal', false);
    toggleScreen('game-screen', false);
    toggleScreen('home-screen', true);
    clearBoardState();
    startNewGame();
    updatePresence(false);
});

document.getElementById('lose-leaderboard-btn')?.addEventListener('click', () => {
    toggleScreen('lose-modal', false);
    toggleScreen('game-screen', false);
    loadLeaderboard();
    toggleScreen('leaderboard-screen', true);
    clearBoardState();
    startNewGame();
    updatePresence(false);
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
        clearBoardState();
        startNewGame();
        updatePresence(false);
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
        await claimSharkTitle(gameState.currentPlayerId, gameState.currentGuess, newWord);

        // Success!
        clearBoardState();

        gameState.currentSharkId = gameState.currentPlayerId;
        gameState.secretWord = newWord;

        setSubmitButtonLoading(false);
        toggleScreen('win-modal', false);
        toggleScreen('game-screen', false);

        await loadLeaderboard();
        toggleScreen('leaderboard-screen', true);
        startNewGame();
        updatePresence(false);

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