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
export async function recordSharkMeal(loserId = null, guessesUsed = 0, isRetry = false) {
    const { error } = await supabase.rpc('record_shark_meal', {
        loser_id: loserId,
        guesses_used: guessesUsed,
        is_retry: isRetry
    });
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
 * @param {number} guessesUsed - The number of guesses it took to win
 * @param {boolean} isRetry - Whether the player was retrying the same word
 */

export async function claimSharkTitle(winnerId, guessedWord, newSecretWord, guessesUsed = 0, isRetry = false) {
    const { error } = await supabase.rpc('claim_shark_title', {
        winner_id: winnerId,
        guessed_word: guessedWord,
        new_secret_word: newSecretWord,
        guesses_used: guessesUsed,
        is_retry: isRetry
    });
    if (error) {
        console.error("Error claiming shark title:", error);
        throw error;
    }
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

/**
 * Fetches the 1st, 2nd, and 3rd place winners from the most recently completed week
 * @returns {Promise<Array>} Array of player UUIDs
 */
export async function fetchLastWeekWinners() {
    const { data, error } = await supabase
        .from('weekly_shark_history')
        .select('player_id, week_ending')
        .order('week_ending', { ascending: false })
        .order('time_as_shark', { ascending: false })
        .limit(3);

    if (error || !data || data.length === 0) return [];

    // Ensure we only grab players from the exact same "most recent" date
    // (Prevents accidentally giving 3rd place to someone from 2 weeks ago if only 2 people played last week)
    const latestWeek = data[0].week_ending;
    return data
        .filter(row => row.week_ending === latestWeek)
        .map(row => row.player_id);
}

/**
 * Fetches the top 3 winners from the most recently completed week with their usernames
 * 
 */
export async function fetchWeeklyRecap() {
    const { data, error } = await supabase
        .from('weekly_shark_history')
        .select(`
            time_as_shark,
            week_ending,
            is_jawbreaker,
            is_robster,
            is_apex_predator,
            is_efishent,
            players ( id, username )
        `)
        .order('week_ending', { ascending: false })
        .order('time_as_shark', { ascending: false })
        .limit(20); // Expanded limit to catch players who won an award but didn't place top 3 in time

    if (error || !data || data.length === 0) return null;

    const latestWeek = data[0].week_ending;
    const allParticipants = data.filter(row => row.week_ending === latestWeek);

    // Isolate the top 3 times for the podium, plus our specific award winners
    return { 
        weekEnding: latestWeek, 
        podium: allParticipants.slice(0, 3),
        jawbreaker: allParticipants.find(p => p.is_jawbreaker),
        robster: allParticipants.find(p => p.is_robster),
        apex: allParticipants.find(p => p.is_apex_predator),
        efishent: allParticipants.find(p => p.is_efishent)
    };
}