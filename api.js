// Import Supabase directly from the CDN
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Initialize the connection
const supabaseUrl = 'https://okbynkairmznzcriuknd.supabase.co';
const supabaseKey = 'sb_publishable_ZJGYQbdtUaABBX1lhOw8qw_Ksiw-S54';


const supabase = createClient(supabaseUrl, supabaseKey);

let gameEventsChannel;

/**
 * Fetches the current game state (Secret word, current shark, start time)
 * @returns {Promise<Object>} The game state data
 */
export async function fetchGameState() {
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
        throw error; // Throw the error so main.js can handle it (e.g., show a toast)
    }

    return data;
}

/**
 * Fetches the top 10 players for the leaderboard
 * @returns {Promise<Array>} Array of player objects
 */
export async function fetchLeaderboard() {
    const { data: players, error } = await supabase
        .from('players')
        .select('*')
        .order('total_time_as_shark', { ascending: false })
        .limit(100);

    if (error) {
        console.error("Error fetching leaderboard:", error);
        throw error;
    }

    return players;
}

/**
 * Fetches all players for the name selection dropdown
 * @returns {Promise<Array>} Array of player objects (id and username)
 */
export async function fetchPlayers() {
    const { data: players, error } = await supabase
        .from('players')
        .select('id, username');
    
    if (error) {
        console.error("Error fetching players for dropdown:", error);
        throw error;
    }

    return players;
}

/**
 * Calls the database RPC to record a loss (Current shark eats a fish)
 */
export async function recordSharkMeal() {
    const { error } = await supabase.rpc('record_shark_meal');

    if (error) {
        console.error("Error recording shark meal:", error);
        throw error;
    }
}

/**
 * Calls the database RPC to claim the shark title and set a new word
 * @param {string} winnerId - UUID of the winning player
 * @param {string} guessedWord - The word they guessed correctly
 * @param {string} newSecretWord - The new 5-letter word they are setting
 */
export async function claimSharkTitle(winnerId, guessedWord, newSecretWord) {
    const { error } = await supabase.rpc('claim_shark_title', {
        winner_id: winnerId,
        guessed_word: guessedWord,
        new_secret_word: newSecretWord
    });

    if (error) {
        console.error("Error claiming shark title:", error);
        throw error; 
    }
}

/**
 * Checks if a word exists in the remote dictionary
 */
export async function checkWordValidity(word) {
    const { data, error } = await supabase
        .from('dictionary')
        .select('word')
        .eq('word', word.toUpperCase())
        .single();
    
    // If we find a row, it's valid. If not, it's invalid.
    if (error && error.code === 'PGRST116') return false; // Not found
    if (error) throw error;
    
    return !!data;
}

/**
 * Asks the database to run the RPC and return 2 valid, unused words
 */
export async function fetchWordSuggestions() {
    const { data, error } = await supabase.rpc('get_word_suggestions');
    if (error) {
        console.error("Error fetching word suggestions:", error);
        throw error;
    }
    return data ? data.map(row => row.word) : [];
}

/**
 * Sets up real-time listeners for the database.
 * @param {Function} onLeaderboardChange - Callback fired when a player's stats change
 * @param {Function} onGameStateChange - Callback fired when a new shark takes over
 */
export function setupRealtimeSubscriptions(onLeaderboardChange, onGameStateChange, onYoinkBroadcast) {
    // 1. Listen for changes to the Leaderboard (players table)
    supabase
        .channel('players-channel')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'players' },
            (payload) => {
                if (onLeaderboardChange) onLeaderboardChange(payload);
            }
        )
        .subscribe();

    // 2. Listen for changes to the Game State (New Shark / New Word!)
    supabase
        .channel('game-state-channel')
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'game_state' },
            (payload) => {
                if (onGameStateChange) onGameStateChange(payload);
            }
        )
        .subscribe();

         // Set up broadcast channel for player-to-player transient messages
    gameEventsChannel = supabase.channel('game-events');
    gameEventsChannel
        .on('broadcast', { event: 'yoink' }, (payload) => {
            if (onYoinkBroadcast) onYoinkBroadcast(payload.payload);
        })
        .subscribe();
}

export async function createNewPlayer(username) {
    const { data, error } = await supabase.rpc('create_new_player', {
        new_username: username
    });

    if (error) {
        console.error("Error creating player:", error);
        throw error;
    }
    return data;
}

export async function recordYoink(targetSharkId) {
    const { error } = await supabase.rpc('record_yoink', { target_shark_id: targetSharkId });
    if (error) console.error("Error recording yoink:", error);
}

export function sendYoinkBroadcast(sharkId, yoinkedName) {
    if (gameEventsChannel) {
        gameEventsChannel.send({
            type: 'broadcast',
            event: 'yoink',
            payload: { sharkId, yoinkedName }
        });
    }
}

// ==========================================
// PRESENCE (Others Guessing)
// ==========================================

let presenceChannel;
let amIGuessing = false; // System memory of where you actually are

// Generate and EXPORT the ID so main.js can access it directly
export const mySessionId = (typeof crypto.randomUUID === 'function') 
    ? crypto.randomUUID() 
    : Math.random().toString(36).substring(2, 15);

export function setupPresence(onSyncCallback) {
    presenceChannel = supabase.channel('jawrgon-presence', {
        config: { presence: { key: mySessionId } },
    });

    presenceChannel
        .on('presence', { event: 'sync' }, () => {
            const state = presenceChannel.presenceState();
            onSyncCallback(state, mySessionId);
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                // When waking up from sleep, restore the saved state
                await presenceChannel.track({ isGuessing: amIGuessing, updatedAt: Date.now() });
            }
        });

        // --- 1. THE HEARTBEAT (The Failsafe) ---
    setInterval(() => {
        if (amIGuessing && document.visibilityState === 'visible' && navigator.onLine) {
            updatePresence(true); // Now uses the safe queue!
        }
    }, 10000);

    // --- 2. MODERN MOBILE LIFECYCLE ---
    document.addEventListener('visibilitychange', () => {
        if (!presenceChannel) return;
        if (document.visibilityState === 'hidden') {
            updatePresence(false);
        } else if (document.visibilityState === 'visible') {
            updatePresence(amIGuessing);
        }
    });

    // --- 3. CONNECTION LOSS ---
    window.addEventListener('offline', () => {
        if (presenceChannel) updatePresence(false);
    });
    
    window.addEventListener('online', () => {
        if (presenceChannel) updatePresence(amIGuessing);
    });

    // Explicitly rip the connection down if they close the tab (Desktop)
    window.addEventListener('beforeunload', () => {
        if (presenceChannel) {
            presenceChannel.untrack();
            supabase.removeChannel(presenceChannel); 
        }
    });

    // If the user loses wifi, instantly update state if possible
    window.addEventListener('offline', async () => {
        if (presenceChannel) await presenceChannel.track({ isGuessing: false, updatedAt: Date.now() });
    });
    
    // When wifi returns, restore their real state
    window.addEventListener('online', async () => {
        if (presenceChannel) await presenceChannel.track({ isGuessing: amIGuessing, updatedAt: Date.now() });
    });
}

// ==========================================
// PRESENCE QUEUE & MONOTONIC CLOCK
// Defeats Millisecond Collisions & State Tearing
// ==========================================

let isPresenceUpdating = false;
let presenceQueue = null;
let lastPresenceTimestamp = 0;

// Guarantees every timestamp is chronologically larger than the last!
function getPresenceTimestamp() {
    let now = Date.now();
    if (now <= lastPresenceTimestamp) {
        now = lastPresenceTimestamp + 1;
    }
    lastPresenceTimestamp = now;
    return now;
}

export async function updatePresence(isGuessing) {
    amIGuessing = isGuessing; // Instantly save to memory for lifecycles

    if (!presenceChannel) return;

    // 1. If we are talking to the server, take a ticket and wait!
    if (isPresenceUpdating) {
        presenceQueue = isGuessing;
        return;
    }

    isPresenceUpdating = true;

    // 2. Capture the exact state and a safe, unique timestamp
    const stateToTransmit = isGuessing;
    const safeTimestamp = getPresenceTimestamp();

    try {
        await presenceChannel.track({ isGuessing: stateToTransmit, updatedAt: safeTimestamp });
    } catch (e) {
        console.error("Presence tracking failed:", e);
    } finally {
        isPresenceUpdating = false;
        
        // 3. If the user spam-clicked while we were transmitting, 
        // the queue holds their final destination. Send it now!
        if (presenceQueue !== null) {
            const nextState = presenceQueue;
            presenceQueue = null;
            updatePresence(nextState);
        }
    }
}
