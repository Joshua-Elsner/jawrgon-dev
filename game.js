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
    
    // Leaderboard memory
    cachedPlayers: []
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
    return playersWithLiveTime.sort((a, b) => b.displayTimeSeconds - a.displayTimeSeconds);
}