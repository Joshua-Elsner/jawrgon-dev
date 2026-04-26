// ==========================================
// ui.js - The View Layer
// ==========================================

import { gameState } from './game.js';

const FIRST_RESET_DATE = new Date('2026-04-12T00:00:00'); 

/**
 * Calculates the exact Week Number based on a given date.
 */
function calculateWeekNumber(targetDate) {
    // Normalize both dates to UTC midnight to completely bypass daylight savings/timezone bugs
    const start = Date.UTC(FIRST_RESET_DATE.getFullYear(), FIRST_RESET_DATE.getMonth(), FIRST_RESET_DATE.getDate());
    const target = Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

    const diffInDays = Math.floor((target - start) / (1000 * 60 * 60 * 24));

    // Week 1 = 0 days difference. Week 2 = 7 days. Week 3 = 14 days.
    return Math.floor(diffInDays / 7) + 1;
}

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
            tile.classList.remove('correct', 'present', 'absent', 'selected');
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
    const statsDisplay = document.getElementById('player-stats-shark-display');

    const onScreenShark = document.getElementById('shark-name-display');
    const onScreenFish = document.getElementById('fish-name-display');
    
    if (onScreenShark) onScreenShark.textContent = currentSharkName;
    if (onScreenFish) onScreenFish.textContent = currentPlayerName;

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

// Keep track of timeouts so rapid guesses don't break the animation loop
let sharkAnimationTimeouts = [];

/**
 * Swaps the shark image back and forth for incorrect guesses.
 */
export function animateSharkChomp() {
    const topShark = document.getElementById('top-shark');
    if (!topShark) return;

    // Clear any ongoing animations if the player guesses rapidly
    sharkAnimationTimeouts.forEach(clearTimeout);
    sharkAnimationTimeouts = [];

    // Swap to shark2.png immediately
    topShark.src = 'shark2.png';

    // 0.25 seconds: back to normal
    sharkAnimationTimeouts.push(setTimeout(() => {
        topShark.src = 'shark.png';
    }, 250));

    // 0.5 seconds: back to shark2
    sharkAnimationTimeouts.push(setTimeout(() => {
        topShark.src = 'shark2.png';
    }, 500));

    // 0.75 seconds: settle back to normal
    sharkAnimationTimeouts.push(setTimeout(() => {
        topShark.src = 'shark.png';
    }, 750));
}

// Keep track of timeouts for the fish
let fishAnimationTimeouts = [];

/**
 * Swaps the fish image to surprised for 1 second.
 */
export function animateFishSurprise() {
    const boardFish = document.getElementById('board-fish');
    if (!boardFish) return;

    // Clear any ongoing animations if the player guesses rapidly
    fishAnimationTimeouts.forEach(clearTimeout);
    fishAnimationTimeouts = [];

    // Swap to fish_surprised.png immediately
    boardFish.src = 'fish_surprised.png';

    // 1.0 seconds: back to normal
    fishAnimationTimeouts.push(setTimeout(() => {
        boardFish.src = 'fish.png';
    }, 1000));
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

export function setPlayerGridLoading() {
    const grid = document.getElementById('player-list-grid');
    if (grid) {
        grid.innerHTML = '<span style="font-size: 0.9rem; color: #888;">Loading players...</span>';
    }
}

export function setStartButtonLoading() {
    const startGameBtn = document.getElementById('start-game-btn');
    if (startGameBtn) {
        startGameBtn.innerHTML = `Connecting to server...`;
        startGameBtn.disabled = true;
    }
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

export function setSuggestionsLoading() {
    const suggestionsContainer = document.getElementById('word-suggestions');
    const sug1Btn = document.getElementById('suggestion-1');
    const sug2Btn = document.getElementById('suggestion-2');

    if (suggestionsContainer && sug1Btn && sug2Btn) {
        // Set the first button to loading and disable it
        sug1Btn.textContent = "Loading...";
        sug1Btn.disabled = true; 
        
        // Hide the second button completely
        sug2Btn.classList.add('hidden'); 
        
        suggestionsContainer.classList.remove('hidden');
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
    const submitBtn = document.getElementById('submit-new-word'); // Grab the submit button

    if (!suggestionsContainer || !sug1Btn || !sug2Btn || !submitBtn) return;

    // Apply the new words
    sug1Btn.textContent = word1;
    sug2Btn.textContent = word2;
    
    // Restore the buttons to their active, visible states (from previous loading update)
    sug1Btn.disabled = false;
    sug2Btn.classList.remove('hidden');

    // Auto-fill the input AND instantly submit it
    sug1Btn.onclick = () => { 
        newWordInput.value = word1; 
        submitBtn.click(); 
    };
    sug2Btn.onclick = () => { 
        newWordInput.value = word2; 
        submitBtn.click(); 
    };

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

export function setLeaderboardLoading() {
    const tbody = document.getElementById('leaderboard-body');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #888;">Loading leaderboard...</td></tr>';
}

export function setStatsLoading() {
    const table = document.getElementById('player-stats-table');
    if (table) table.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #888;">Loading stats...</td></tr>';
}

export function showWeeklyRecap(recapData) {
    const modal = document.getElementById('weekly-recap-modal');
    const weekText = document.getElementById('recap-week-text');
    const podium = document.getElementById('podium-container');
    
    // Grab both buttons
    const nextBtn = document.getElementById('next-recap-btn');
    const closeBtn = document.getElementById('close-recap-btn');

    if (!modal || !podium) return;

    const dateObj = new Date(recapData.weekEnding);
    dateObj.setMinutes(dateObj.getMinutes() + dateObj.getTimezoneOffset());

    const weekNum = calculateWeekNumber(dateObj);
    weekText.textContent = `Week ${weekNum}`;

    // Initialize two separate wrapper divs for pagination
    let page1HTML = `<div id="recap-page-1" style="display: flex; flex-direction: column; gap: 12px;">`;
    let page2HTML = `<div id="recap-page-2" class="hidden" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">`;

    // ==========================================
    // PAGE 1: The Podium (Top 3)
    // ==========================================
    const medals = ['👑 Shark of the Week', '🥈 Silver Medal', '🥉 Bronze Medal'];
    const colors = ['#ffd700', '#c0c0c0', '#cd7f32'];
    
    recapData.podium.forEach((winner, index) => {
        const name = winner.players ? winner.players.username : 'Unknown Fish';
        const time = formatSharkTime(winner.time_as_shark, false);
        
        page1HTML += `
            <div style="background-color: var(--color-background); padding: 15px; border-radius: 8px; border-left: 5px solid ${colors[index]}; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="color: ${colors[index]}; font-weight: bold; font-size: 0.85rem; text-transform: uppercase;">${medals[index]}</div>
                    <div style="font-size: 1.3rem; margin-top: 4px;">${name}</div>
                </div>
                <div style="color: var(--color-text); font-family: monospace; font-size: 1.1rem;">
                    ${time}
                </div>
            </div>
        `;
    });
    
    page1HTML += `</div>`; // Close page 1

    // ==========================================
    // PAGE 2: Special Awards
    // ==========================================
    const awards = [
        { data: recapData.jawbreaker, title: "Jawbreaker", desc: "Most Words Solved", img: "Jawbreaker.png" },
        { data: recapData.robster, title: "Robster", desc: "Most Yoinks", img: "Robster2.png" },
        { data: recapData.apex, title: "Apex Predator", desc: "Most Fish Eaten", img: "ApexPredator.png" },
        { data: recapData.efishent, title: "E-fish-ent", desc: "Lowest Avg Guesses", img: "E-Fish-Ent.png" }
    ];

    awards.forEach(award => {
        if (award.data && award.data.players) {
            page2HTML += `
                <div style="background-color: rgba(125, 211, 252, 0.1); padding: 15px 10px; border-radius: 8px; display: flex; flex-direction: column; align-items: center; text-align: center; height: 100%;">
                    
                    <img src="${award.img}" alt="${award.title}" style="width: 70px; height: 70px; object-fit: contain; margin-bottom: 10px;">
                    
                    <div style="color: var(--color-text); font-weight: bold; font-size: 0.9rem; text-transform: uppercase;">
                        ${award.title}
                    </div>
                    
                    <div style="font-size: 0.75rem; color: #888; margin-bottom: 12px;">
                        ${award.desc}
                    </div>
                    
                    <div style="font-size: 1.1rem; color: white; margin-top: auto; font-weight: bold;">
                        ${award.data.players.username}
                    </div>
                    
                </div>
            `;
        }
    });

    page2HTML += `</div>`; // Close page 2

    // Inject both pages into the container
    podium.innerHTML = page1HTML + page2HTML;

    // Reset button visibility (critical for when the modal is opened again)
    if (nextBtn) nextBtn.classList.remove('hidden');
    if (closeBtn) closeBtn.classList.add('hidden');

    // Attach pagination logic to the "Next" button
    if (nextBtn) {
        nextBtn.onclick = () => {
            document.getElementById('recap-page-1').classList.add('hidden');
            document.getElementById('recap-page-2').classList.remove('hidden');
            nextBtn.classList.add('hidden');
            closeBtn.classList.remove('hidden');
        };
    }

    modal.classList.remove('hidden');
}

/**
 * Helper: Formats total seconds into a clean d:hh:mm:ss or ddd:hh:mm:ss string
 */
export function formatSharkTime(totalSeconds, isAllTime = false) {
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
    
    const weekDisplay = document.getElementById('leaderboard-week-display');
    if (weekDisplay) {
        const now = new Date();
        
        // If today is Sunday (0), the reset just happened, so the next one is in 7 days.
        // Otherwise, subtract today's day from 7 to find the upcoming Sunday.
        const daysUntilSunday = now.getDay() === 0 ? 7 : 7 - now.getDay();
        
        const nextSunday = new Date(now);
        nextSunday.setDate(now.getDate() + daysUntilSunday);
        
        weekDisplay.textContent = `Week ${calculateWeekNumber(nextSunday)}`;
    }

    tbody.innerHTML = '';

    sortedPlayers.forEach((player, index) => {
        const avgGuesses = formatAverageGuesses(player.weekly_guesses, player.weekly_puzzles_played);

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

         // 2. Build the styled rank string
        let spacing = '';
        if (rank < 10) spacing = '&nbsp;&nbsp;';
        else if (rank < 100) spacing = '&nbsp;';

        const rankString = `<span class="${rankClass}">${rank}<span style="font-size: 0.6em; vertical-align: super;">${ordinal}</span></span>${spacing}`;

        const formattedTime = formatSharkTime(player.displayTimeSeconds, false);
        const sharkStyle = player.isShark ? 'style="color: var(--color-present);"' : '';
        const timeCellId = player.isShark ? 'id="active-shark-live-time"' : '';
        const baseTimeAttr = player.isShark ? `data-basetime="${player.baseTime}"` : '';

        // 1. Setup variables for our icons
        let suffix = "";

        // 2. Determine placements (Assign all medals directly to the suffix)
        if (gameState.lastWeekWinners.length > 0 && player.id === gameState.lastWeekWinners[0]) {
            suffix = ` <span title="Last Week's Winner!">👑</span>`;
        } else if (gameState.lastWeekWinners.length > 1 && player.id === gameState.lastWeekWinners[1]) {
            suffix = ` <span title="2nd Place Last Week">🥈</span>`;
        } else if (gameState.lastWeekWinners.length > 2 && player.id === gameState.lastWeekWinners[2]) {
            suffix = ` <span title="3rd Place Last Week">🥉</span>`;
        }

        // 3. Prepend the rankString to the name HTML (Removed the relative div wrapper)
        let nameHTML = `${rankString}<span ${sharkStyle}>${escapeHTML(player.username)}</span>${suffix}`;

        // 4. Remove the Rank <td> and left-align the Player <td>
        const rowHTML = `
        <tr>
            <td style="text-align: left; padding-left: 20px;">${nameHTML}</td>
            <td ${sharkStyle} ${timeCellId} ${baseTimeAttr}>${formattedTime}</td>
            <td>${player.weekly_sharks_evaded || 0}</td>
            <td>${player.weekly_yoinks || 0}</td>
            <td>${player.weekly_fish_eaten || 0}</td>
            <td>${avgGuesses}</td> 
        </tr>
        `;

        tbody.insertAdjacentHTML('beforeend', rowHTML);
    });
}

/**
 * Generates the HTML table rows for the Player Stats screen.
 * @param {Array} sortedPlayers - Must be pre-sorted alphabetically by game.js
 */
// ui.js
export function renderPlayerStatsTable(sortedPlayers, sortBy = 'alpha') {
    const table = document.getElementById('player-stats-table');
    if (!table) return;

    // 1. Define the blueprint for every column
    const cols = [
        { id: 'time', head: '<th>Time as<br>Shark</th>', getVal: p => formatSharkTime(p.displayAllTimeSeconds, true) },
        { id: 'words', head: '<th>Words<br>Solved</th>', getVal: p => p.sharks_evaded || 0 },
        { id: 'yoinks', head: '<th>Yoinks</th>', getVal: p => p.yoinks || 0 },
        { id: 'fish', head: '<th>Fish<br>Eaten</th>', getVal: p => p.fish_eaten || 0 },
        { id: 'avg', head: '<th>Average<br>Guesses</th>', getVal: p => formatAverageGuesses(p.all_time_guesses, p.all_time_puzzles_played) },
        { id: 'sotw', head: '<th>Shark of<br>the Week<br>Awards</th>', getVal: p => p.shark_of_the_week_wins || 0 },
        { id: 'silver', head: '<th>Silver<br>Medals</th>', getVal: p => p.silver_medals || 0 },
        { id: 'bronze', head: '<th>Bronze<br>Medals</th>', getVal: p => p.bronze_medals || 0 },
        { id: 'jawbreaker', head: '<th>Jawbreaker<br>Awards</th>', getVal: p => p.jawbreaker_awards || 0 },
        { id: 'robster', head: '<th>Robster<br>Awards</th>', getVal: p => p.robster_awards || 0 },
        { id: 'apex', head: '<th>Apex Predator<br>Awards</th>', getVal: p => p.apex_predator_awards || 0 },
        { id: 'efishent', head: '<th>E-fish-ent<br>Awards</th>', getVal: p => p.efishent_awards || 0 }
    ];

    // 2. Rearrange the columns based on the current sort
    let orderedCols = [...cols];
    if (sortBy !== 'alpha') {
        const activeIndex = orderedCols.findIndex(c => c.id === sortBy);
        if (activeIndex > -1) {
            // Cut the active column out and paste it at the front of the line
            orderedCols.unshift(orderedCols.splice(activeIndex, 1)[0]);
        }
    }

    // 3. Generate the dynamic Header HTML
    const headHTML = `
        <thead>
            <tr>
                <th>Player</th>
                ${orderedCols.map(c => 
                    c.id === sortBy ? c.head.replace('<th', '<th class="sorted-column"') : c.head
                ).join('')}
            </tr>
        </thead>
    `;

    // 4. Generate the dynamic Body HTML
    const bodyHTML = `
        <tbody id="player-stats-body">
            ${sortedPlayers.map(p => `
                <tr>
                    <td>${p.username}</td>
                    ${orderedCols.map(c => 
                        `<td ${c.id === sortBy ? 'class="sorted-column"' : ''}>${c.getVal(p)}</td>`
                    ).join('')}
                </tr>
            `).join('')}
        </tbody>
    `;

    // 5. Inject it all into the empty table
    table.innerHTML = headHTML + bodyHTML;
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

/**
 * Helper to format the Average Guesses metric
 */
function formatAverageGuesses(totalGuesses, gamesPlayed) {
    const games = gamesPlayed || 0;
    const guesses = totalGuesses || 0;
    
    // Only wrap the fraction in the styling span. 
    // The dashes remain outside so they match normal table text!
    if (games < 10) {
        return `-- <span style="font-size: 0.75rem; color: #888;">(${games}/10)</span>`;
    }
    
    return (guesses / games).toFixed(1);
}

/**
 * Sanitizes untrusted user input to prevent XSS attacks 
 * when injecting variables into innerHTML strings.
 */
export function escapeHTML(str) {
    if (!str) return "";
    return String(str).replace(/[&<>'"]/g, tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[tag]));
}