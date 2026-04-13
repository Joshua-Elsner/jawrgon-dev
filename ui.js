// ==========================================
// ui.js - The View Layer
// ==========================================

import { updatePresence } from './api.js';
import { gameState } from './game.js';

// --- CACHED DOM ELEMENTS ---
// Caching these prevents the browser from having to search the entire document every time a key is pressed.
const rows = document.querySelectorAll('.board-row');
const keys = document.querySelectorAll('.key');

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================

/**
 * Creates and animates a tiny modal notification at the top of the screen.
 * @param {string} message - The text to display
 * @param {number} duration - How long it stays on screen in milliseconds
 */
export function showToast(message, duration = 2500) {
    const container = document.getElementById('toast-container');
    if (!container) return; // Fail gracefully if HTML isn't set up yet

    const toast = document.createElement('div');
    toast.classList.add('toast');
    toast.innerHTML = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('transitionend', () => toast.remove());
    }, duration);
}

// ==========================================
// BOARD & KEYBOARD UI
// ==========================================

/**
 * Completely resets the game board bubbles and keyboard colors for a new game.
 */
export function resetBoardUI() {
    // Reset all rows and tiles
    for (let r = 0; r < 6; r++) {
        // Only the first row should be visible at the start
        if (r === 0) {
            rows[r].classList.remove('row-collapsed');
        } else {
            rows[r].classList.add('row-collapsed');
        }
        
        // Clear text and colors from the 5 tiles in this row
        for (let c = 0; c < 5; c++) {
            const tile = rows[r].children[c];
            tile.textContent = "";
            tile.classList.remove('correct', 'present', 'absent');
        }
    }

    // Clear all colors from the virtual keyboard
    keys.forEach(key => key.classList.remove('correct', 'present', 'absent'));
    updateGuessCounter(0);
}

/**
 * Updates the text inside a specific tile on the board.
 */
export function updateTileText(rowIndex, tileIndex, letter) {
    const tile = rows[rowIndex].children[tileIndex];
    if (tile) tile.textContent = letter;
}

/**
 * Takes the status array from game.js and paints the row and keyboard!
 */
export function paintRowStatuses(currentRow, guess, statuses) {
    const tiles = rows[currentRow].children;

    for (let i = 0; i < 5; i++) {
        // 1. Paint the board tile
        tiles[i].classList.add(statuses[i]);

        // 2. Paint the virtual keyboard key
        const letter = guess[i].toLowerCase();
        const keyElement = document.getElementById('key-' + letter);
        
        if (keyElement) {
            // Prevent downgrading a previously found green key to yellow/gray
            if (keyElement.classList.contains('correct')) {
                continue;
            }
            if (keyElement.classList.contains('present') && statuses[i] !== 'correct') {
                continue;
            }

            keyElement.classList.remove('present', 'absent');
            keyElement.classList.add(statuses[i]);
        }
    }
}

/**
 * Applies a quick CSS shake animation to a row (used for invalid words).
 */
export function shakeRow(rowIndex) {
    const currentRowEl = rows[rowIndex];
    currentRowEl.classList.add('shake');
    
    // Remove the shake class after animation finishes so it can be shaken again later
    setTimeout(() => {
        currentRowEl.classList.remove('shake');
    }, 400);
}

/**
 * Smoothly expands the next row of bubbles.
 */
export function revealNextRow(rowIndex) {
    if (rows[rowIndex]) {
        rows[rowIndex].classList.remove('row-collapsed');
    }
}

// ==========================================
// MENU & HEADER UI
// ==========================================

/**
 * Updates the "Current Shark" text on both the home screen and leaderboard and all time stats
 * Also displays the secret word if the viewer is the active Shark
 */
export function updateSharkDisplay(currentSharkName, currentPlayerName, secretWord) {
    const homeDisplay = document.getElementById('home-shark-display');
    const boardDisplay = document.getElementById('leaderboard-shark-display');
    
    // 1. Grab the new stats display element
    const statsDisplay = document.getElementById('player-stats-shark-display');

    const isCurrentShark = (currentSharkName === currentPlayerName && currentPlayerName !== "Guest");
    const displayName = isCurrentShark ? "You" : currentSharkName;

    // Build the base display text
    let displayText = `Current Shark: ${displayName}`;

    // If the local player is the shark, append their secret word on a new line
    if (isCurrentShark && secretWord) {
        displayText += `<br><span style="font-size: 0.9rem; color: #888; text-transform: uppercase; letter-spacing: 2px;">(Your Word: <span style="color: var(--color-text);">${secretWord}</span>)</span>`;
    }

    // Use innerHTML instead of textContent so the <br> and <span> tags render correctly
    if (homeDisplay) homeDisplay.innerHTML = displayText;
    if (boardDisplay) boardDisplay.innerHTML = displayText;
    
    // 2. Inject the text into the new stats screen element
    if (statsDisplay) statsDisplay.innerHTML = displayText;
}

/**
 * Adjusts the main menu Start button based on who is playing.
 */
export function updateStartButton(currentPlayerName, currentSharkName) {
    const startGameBtn = document.getElementById('start-game-btn');
    if (!startGameBtn) return;
    
    if (currentPlayerName === "Guest") {
        startGameBtn.innerHTML = `Play as Guest<br><span style="font-size: 0.85rem; font-weight: normal;">(Cannot set new word)</span>`;
        startGameBtn.disabled = false;
    } else if (currentPlayerName === currentSharkName) {
        startGameBtn.innerHTML = `${currentPlayerName} Is Already Shark!`;
        startGameBtn.disabled = true;
    } else {
        startGameBtn.innerHTML = `Play as ${currentPlayerName}`;
        startGameBtn.disabled = false;
    }
}

/**
 * Populates the player grid in the modal.
 * Disables the button if the player is currently the active Shark.
 */
export function renderPlayerList(players, onSelectCallback, currentSharkId) {
    const grid = document.getElementById('player-list-grid');
    if (!grid) return;

    grid.innerHTML = ''; 
    
    if (players.length === 0) {
        grid.innerHTML = '<span style="font-size: 0.9rem; color: #888;">No players yet. Create one!</span>';
        return;
    }

    players.forEach(player => {
        const btn = document.createElement('button');

        // Check if this player in the loop is the current active Shark
        if (player.id === currentSharkId) {
            btn.innerHTML = `${player.username}<br><span style="font-size: 0.75rem; color: var(--color-present);">(Current Shark)</span>`;
            btn.disabled = true; // This triggers your CSS button:disabled rules
        } else {
            btn.textContent = player.username;
            btn.addEventListener('click', () => {
                onSelectCallback(player);
            });
        }
        
        grid.appendChild(btn);
    });
}

// ==========================================
// MODALS & SCREENS
// ==========================================

export function toggleScreen(screenId, show) {
    const screen = document.getElementById(screenId);
    if (screen) {
        show ? screen.classList.remove('hidden') : screen.classList.add('hidden');
    }
}

/**
 * Customizes the Win Modal depending on if the user is a Guest or a Registered Player.
 */
export function setupWinModal(currentPlayerName) {
    const winModalTitle = document.querySelector('#win-modal h2');
    const winModalDesc = document.querySelector('#win-modal p');
    const newWordInput = document.getElementById('new-word-input');
    const submitBtn = document.getElementById('submit-new-word');
    const wordSuggestions = document.getElementById('word-suggestions');

    if (currentPlayerName === "Guest") {
        winModalTitle.textContent = "You Survived!";
        winModalDesc.textContent = "Great guessing! However, Guests cannot become the Shark or set new words.";
        if (newWordInput) newWordInput.classList.add('hidden');
        if (wordSuggestions) wordSuggestions.classList.add('hidden');
        submitBtn.textContent = "Back to Menu";
    } else {
        winModalTitle.textContent = "Correct!";
        winModalDesc.textContent = "Quick! Set a new word before you get yoinked!";
        if (newWordInput) {
            newWordInput.classList.remove('hidden');
            newWordInput.value = ""; // Clear old inputs
        }
        submitBtn.textContent = "Confirm";
    }
}

/**
 * Fills the suggestion buttons with the two words provided by main.js.
 */
export function renderWordSuggestions(word1, word2) {
    const suggestionsContainer = document.getElementById('word-suggestions');
    const sug1Btn = document.getElementById('suggestion-1');
    const sug2Btn = document.getElementById('suggestion-2');
    const newWordInput = document.getElementById('new-word-input');

    if (!suggestionsContainer || !sug1Btn || !sug2Btn) return;

    sug1Btn.textContent = word1;
    sug2Btn.textContent = word2;

    // Auto-fill the input when clicked
    sug1Btn.onclick = () => { newWordInput.value = word1; newWordInput.focus(); };
    sug2Btn.onclick = () => { newWordInput.value = word2; newWordInput.focus(); };

    suggestionsContainer.classList.remove('hidden');
}

/**
 * Manages the state of the "Confirm" button to prevent double-submissions.
 */
export function setSubmitButtonLoading(isLoading) {
    const submitBtn = document.getElementById('submit-new-word');
    if (!submitBtn) return;

    if (isLoading) {
        submitBtn.textContent = "Updating...";
        submitBtn.disabled = true;
    } else {
        submitBtn.textContent = "Confirm";
        submitBtn.disabled = false;
    }
}

// ==========================================
// LEADERBOARD UI
// ==========================================

/**
 * Helper: Formats total seconds into a clean d:hh:mm:ss or ddd:hh:mm:ss string
 */
function formatSharkTime(totalSeconds, isAllTime = false) {
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    // Use 3 zeros for all-time stats, and 1 zero for the weekly leaderboard
    const daysFormat = isAllTime ? days.toString().padStart(3, '0') : days.toString();

    return `${daysFormat}:${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Generates the HTML table rows for the leaderboard.
 * @param {Array} sortedPlayers - Must be pre-sorted and processed by game.js
 */
export function renderLeaderboardTable(sortedPlayers) {
    const tbody = document.getElementById('leaderboard-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    sortedPlayers.forEach((player, index) => {
        const rank = index + 1;
        let rankClass = '';
        
        if (rank === 1) rankClass = 'rank-1';
        if (rank === 2) rankClass = 'rank-2';
        if (rank === 3) rankClass = 'rank-3';

        // 1. Calculate the correct ordinal suffix (st, nd, rd, th)
        let ordinal = 'th';
        if (rank % 10 === 1 && rank % 100 !== 11) ordinal = 'st';
        else if (rank % 10 === 2 && rank % 100 !== 12) ordinal = 'nd';
        else if (rank % 10 === 3 && rank % 100 !== 13) ordinal = 'rd';

        // 2. Build the styled rank string (using vertical-align: super for the tiny text)
        const rankString = `<span class="${rankClass}" style="margin-right: 8px;">${rank}<span style="font-size: 0.6em; vertical-align: super;">${ordinal}</span></span>`;

        const formattedTime = formatSharkTime(player.displayTimeSeconds, false);
        const sharkStyle = player.isShark ? 'style="color: var(--color-present);"' : '';
        const timeCellId = player.isShark ? 'id="active-shark-live-time"' : '';
        const baseTimeAttr = player.isShark ? `data-basetime="${player.baseTime}"` : '';

        // 1. Setup variables for our icons
        let suffix = "";
        let crownHTML = "";
        let rowClass = "";

        // 2. Determine placements (Crown for 1st, trailing medals for 2nd and 3rd)
        if (gameState.lastWeekWinners.length > 0 && player.id === gameState.lastWeekWinners[0]) {
            crownHTML = `<span class="prev-winner-crown" title="Last Week's Winner!">👑</span>`;
            rowClass = "has-crown";
        } else if (gameState.lastWeekWinners.length > 1 && player.id === gameState.lastWeekWinners[1]) {
            suffix = ` <span title="2nd Place Last Week">🥈</span>`;
        } else if (gameState.lastWeekWinners.length > 2 && player.id === gameState.lastWeekWinners[2]) {
            suffix = ` <span title="3rd Place Last Week">🥉</span>`;
        }

        // 3. Prepend the rankString to the name HTML
        let nameHTML = `${rankString}<div style="position: relative; display: inline-block;">${crownHTML}${player.username}</div>${suffix}`;

        // 4. Remove the Rank <td> and left-align the Player <td>
        const rowHTML = `
        <tr class="${rowClass}">
            <td style="text-align: left; padding-left: 20px;" ${sharkStyle}>${nameHTML}</td>
            <td ${sharkStyle} ${timeCellId} ${baseTimeAttr}>${formattedTime}</td>
            <td>${player.weekly_fish_eaten || 0}</td>
            <td>${player.weekly_sharks_evaded || 0}</td>
            <td>${player.weekly_yoinks || 0}</td>
        </tr>
        `;

        tbody.insertAdjacentHTML('beforeend', rowHTML);
    });
}

/**
 * Generates the HTML table rows for the Player Stats screen.
 * @param {Array} sortedPlayers - Must be pre-sorted alphabetically by game.js
 */
export function renderPlayerStatsTable(sortedPlayers) {
    const tbody = document.getElementById('player-stats-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    sortedPlayers.forEach(player => {
        const formattedTime = formatSharkTime(player.displayAllTimeSeconds, true);

        // Build the row (No rank, no green text, all-time stats)
        const rowHTML = `
        <tr>
            <td>${player.username}</td>
            <td>${formattedTime}</td>
            <td>${player.fish_eaten || 0}</td>
            <td>${player.sharks_evaded || 0}</td>
            <td>${player.yoinks || 0}</td>
            <td>${player.shark_of_the_week_wins || 0}</td>
        </tr>
        `;

        tbody.insertAdjacentHTML('beforeend', rowHTML);
    });
}

export function updateGuessCounter(currentRow) {
    const counter = document.getElementById('guess-counter');
    if (counter) {
        // We add 1 because rows are 0-indexed in the code!
        counter.textContent = `Guess ${currentRow + 1}/6`;
    }
}

/**
 * Calculates the date of the upcoming Sunday and updates the Leaderboard header
 */
export function setWeekEndingDate() {
    const display = document.getElementById('week-ending-display');
    if (!display) return;

    const now = new Date();
    
    // getDay() returns 0 for Sunday, 1 for Monday, etc.
    // If today is Sunday (0), 7 - 0 = 7. It will correctly target NEXT Sunday!
    let daysUntilSunday = 7 - now.getDay();
    
    const nextSunday = new Date(now);
    nextSunday.setDate(now.getDate() + daysUntilSunday);

    const month = nextSunday.getMonth() + 1;
    const day = nextSunday.getDate();

    display.textContent = `Week ending ${month}/${day}`;
}

// ==========================================
// PRESENCE UI
// ==========================================

export function updatePresenceUI(count) {
    const dot = document.getElementById('presence-dot');
    const text = document.getElementById('presence-count');
    
    if (!dot || !text) return;
    
    if (count > 0) {
        dot.classList.remove('inactive');
        dot.classList.add('active');
        // Pluralize properly (1 Other Guessing vs 2 Others Guessing)
        text.textContent = `${count} Other${count === 1 ? '' : 's'} Guessing`;
    } else {
        dot.classList.remove('active');
        dot.classList.add('inactive');
        text.textContent = `0 Others Guessing`;
    }
}