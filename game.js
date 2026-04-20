// ==========================================
// CENTRAL STATE
// ==========================================

import { VALID_WORDS } from './words.js';

export const gameState = {
    // Database sync data
    secretWord: "",
    currentShark: "Loading...",
    currentSharkId: null,
    sharkStartTime: null,
    
    // Local player data
    currentPlayer: localStorage.getItem('jawrgon_username') || "Guest",
    currentPlayerId: localStorage.getItem('jawrgon_userid') || null,
    
    // Current match data
    currentRow: 0,
    currentTile: 0,
    currentGuess: "",
    isGameOver: false,
    submittedGuesses: [],
    
    // Leaderboard memory
    cachedPlayers: [],
    lastWeekWinners: []
};

// ==========================================
// STATE MODIFIERS (Actions)
// ==========================================

/**
 * Updates the local player data and saves to local storage
 */
export function setPlayer(username, id) {
    gameState.currentPlayer = username;
    gameState.currentPlayerId = id;

    localStorage.setItem('jawrgon_username', username);
    localStorage.setItem('jawrgon_userid', id);
}

/**
 * Resets the active match state variables to start a new game
 */
export function resetGameState() {
    gameState.currentRow = 0;
    gameState.currentTile = 0;
    gameState.currentGuess = "";
    gameState.isGameOver = false;
    gameState.submittedGuesses = [];
}

/**
 * Adds a letter to the current guess if there is room
 * @param {string} letter - A single uppercase letter
 * @returns {boolean} True if the letter was added, false if row is full
 */
export function addLetterToState(letter) {
    if (gameState.currentTile >= 5) return false;

    gameState.currentGuess += letter;
    gameState.currentTile++;
    return true;
}

/**
 * Removes the last letter from the current guess
 * @returns {boolean} True if a letter was deleted, false if row is empty
 */
export function deleteLetterFromState() {
    if (gameState.currentTile <= 0) return false;

    gameState.currentGuess = gameState.currentGuess.slice(0, -1);
    gameState.currentTile--;
    return true;
}

/**
 * Advances the game state to the next row
 */
export function advanceRow() {
    gameState.currentRow++;
    gameState.currentTile = 0;
    gameState.currentGuess = "";
}

// ==========================================
// PURE GAME LOGIC (The Rules)
// ==========================================

/**
 * Checks if a word exists in the local dictionary instantly
 * @param {string} word - The 5 letter word to check
 * @returns {boolean}
 */
export function isValidWord(word) {
    return VALID_WORDS.has(word.toUpperCase()); 
}

/**
 * Evaluates a guess against the secret word and calculates tile colors.
 * This is a PURE FUNCTION: It takes inputs and returns an output without mutating external state.
 * * @param {string} guess - The 5-letter user guess
 * @param {string} secretWord - The 5-letter actual answer
 * @returns {string[]} Array of statuses: ['correct', 'present', 'absent', ...]
 */
export function evaluateGuess(guess, secretWord) {
    let secretLetterCounts = {};
    let guessStatuses = new Array(5).fill('absent'); // Default everything to gray

    // 1. Build a frequency map of letters in the secret word 
    for (let char of secretWord) {
        secretLetterCounts[char] = (secretLetterCounts[char] || 0) + 1;
    }

    // 2. Find exact matches (Green)
    for (let i = 0; i < 5; i++) {
        if (guess[i] === secretWord[i]) {
            guessStatuses[i] = 'correct';
            secretLetterCounts[guess[i]]--; // Remove this letter from the available pool
        }
    }

    // 3. Find partial matches (Yellow)
    for (let i = 0; i < 5; i++) {
        // If it isn't already green...
        if (guessStatuses[i] !== 'correct') {
            const letter = guess[i];

            // ...and the letter is in the word, AND we haven't run out of instances of it
            if (secretLetterCounts[letter] > 0) {
                guessStatuses[i] = 'present';
                secretLetterCounts[letter]--; // Deduct from the pool so we don't highlight duplicates incorrectly
            }
        }
    }

    return guessStatuses;
}

/**
 * Analyzes the player list to format it for the leaderboard (calculates live time for active shark)
 * @param {Array} players - Array of player objects from the database
 * @returns {Array} Sorted and formatted array of players
 */
export function processLeaderboardData(players) {
    const playersWithLiveTime = players.map(player => {
        let displayTimeSeconds = player.total_time_as_shark;
        const isShark = player.username === gameState.currentShark;

        // If this player is the current shark, add their live running time to their base score
        if (isShark && gameState.sharkStartTime) {
            const liveSeconds = Math.floor((new Date() - new Date(gameState.sharkStartTime)) / 1000);
            displayTimeSeconds += liveSeconds;
        }

        return { 
            ...player, 
            displayTimeSeconds, 
            isShark, 
            baseTime: player.total_time_as_shark 
        };
    });

    // Sort by the highest score first
    return playersWithLiveTime
        .filter(player => player.displayTimeSeconds > 0) // Only render if they've played this week
        .sort((a, b) => b.displayTimeSeconds - a.displayTimeSeconds);
}

/**
 * Analyzes the player list to format it for the Player Stats screen
 * @param {Array} players - Array of player objects from the database
 * @returns {Array} Alphabetically sorted and formatted array of players
 */
export function processPlayerStatsData(players, sortBy = 'alpha') { 
    const playersWithLiveTime = players.map(player => {
        let displayAllTimeSeconds = player.all_time_time_as_shark || 0;
        const isShark = player.username === gameState.currentShark;

        // If this player is the current shark, add their live running time to their ALL-TIME score
        if (isShark && gameState.sharkStartTime) {
            const liveSeconds = Math.floor((new Date() - new Date(gameState.sharkStartTime)) / 1000);
            displayAllTimeSeconds += liveSeconds;
        }

        return { 
            ...player, 
            displayAllTimeSeconds
        };
    });

    // 2. Dynamically sort based on the requested metric
    return playersWithLiveTime.sort((a, b) => {
        if (sortBy === 'time') return b.displayAllTimeSeconds - a.displayAllTimeSeconds;
        if (sortBy === 'fish') return (b.fish_eaten || 0) - (a.fish_eaten || 0);
        if (sortBy === 'words') return (b.sharks_evaded || 0) - (a.sharks_evaded || 0);
        if (sortBy === 'yoinks') return (b.yoinks || 0) - (a.yoinks || 0);
        if (sortBy === 'sotw') return (b.shark_of_the_week_wins || 0) - (a.shark_of_the_week_wins || 0);
        if (sortBy === 'silver') return (b.silver_medals || 0) - (a.silver_medals || 0);
        if (sortBy === 'bronze') return (b.bronze_medals || 0) - (a.bronze_medals || 0);
        
        // NEW AWARDS SORTING LOGIC
        if (sortBy === 'jawbreaker') return (b.jawbreaker_awards || 0) - (a.jawbreaker_awards || 0);
        if (sortBy === 'robster') return (b.robster_awards || 0) - (a.robster_awards || 0);
        if (sortBy === 'apex') return (b.apex_predator_awards || 0) - (a.apex_predator_awards || 0);
        if (sortBy === 'efishent') return (b.efishent_awards || 0) - (a.efishent_awards || 0);
        
        if (sortBy === 'avg') {
            const playedA = a.all_time_puzzles_played || 0;
            const playedB = b.all_time_puzzles_played || 0;

            // If they haven't played 10 games, give them Infinity so they drop to the bottom
            const avgA = playedA >= 10 ? (a.all_time_guesses / playedA) : Infinity;
            const avgB = playedB >= 10 ? (b.all_time_guesses / playedB) : Infinity;

            // Sort ascending (lowest average wins!)
            if (avgA !== avgB) return avgA - avgB;
        }
        
        // Default: Alphabetical (Also acts as the tie-breaker if both have Infinity)
        return a.username.localeCompare(b.username, undefined, { sensitivity: 'base' });
    });
}
    

/**
 * Saves the current board state to the browser's local storage
 */
export function saveBoardState() {
    localStorage.setItem('jawrgon_board_state', JSON.stringify({
        secretWord: gameState.secretWord,
        guesses: gameState.submittedGuesses,
        isGameOver: gameState.isGameOver
    }));
}

/**
 * Checks local storage for an active game matching the current secret word
 * @returns {boolean} True if data was successfully restored
 */
export function loadBoardState() {
    const saved = localStorage.getItem('jawrgon_board_state');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            // Only restore if the word hasn't been yoinked!
            if (parsed.secretWord === gameState.secretWord) {
                gameState.submittedGuesses = parsed.guesses || [];
                gameState.isGameOver = parsed.isGameOver || false;
                return true;
            }
        } catch(e) {}
    }
    return false;
}

/**
 * Wipes the saved board state (used when the player officially chooses to try again)
 */
export function clearBoardState() {
    localStorage.removeItem('jawrgon_board_state');
    gameState.submittedGuesses = [];
}