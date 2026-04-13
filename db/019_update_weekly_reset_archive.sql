CREATE OR REPLACE FUNCTION process_weekly_shark_reset()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    top_shark_id UUID;
    active_shark_id UUID;
    active_duration INTEGER;
BEGIN
    -- 1. Cash in the CURRENT active shark's live running time (BOTH clocks)
    SELECT current_shark_id, EXTRACT(EPOCH FROM (NOW() - shark_start_time))::INTEGER
    INTO active_shark_id, active_duration
    FROM game_state
    WHERE id = 1;

    IF active_shark_id IS NOT NULL THEN
        UPDATE players
        SET total_time_as_shark = total_time_as_shark + COALESCE(active_duration, 0),
            all_time_time_as_shark = all_time_time_as_shark + COALESCE(active_duration, 0)
        WHERE id = active_shark_id;
    END IF;

    -- 2. NOW find the player with the most weekly time_as_shark
    SELECT id INTO top_shark_id
    FROM players
    WHERE total_time_as_shark > 0
    ORDER BY total_time_as_shark DESC
    LIMIT 1;

    -- 3. Award the 'Shark of the Week' crown
    IF top_shark_id IS NOT NULL THEN
        UPDATE players
        SET shark_of_the_week_wins = shark_of_the_week_wins + 1
        WHERE id = top_shark_id;
    END IF;

    -- 4. Archive everyone's time into the history table
    INSERT INTO weekly_shark_history (player_id, time_as_shark, week_ending)
    SELECT id, total_time_as_shark, CURRENT_DATE
    FROM players
    WHERE total_time_as_shark > 0;

    -- 5. RESET ALL WEEKLY STATS TO 0 (Leave All-Time stats untouched)
    UPDATE players
    SET total_time_as_shark = 0,
        weekly_fish_eaten = 0,
        weekly_sharks_evaded = 0,
        weekly_yoinks = 0
    WHERE id IS NOT NULL;

    -- 6. Reset active game state
    UPDATE game_state
    SET current_shark_id = NULL, secret_word = 'SHARK', shark_start_time = NOW()
    WHERE id = 1;

    -- ==========================================
    -- 7. ARCHIVE AND WIPE THE USED WORDS DICTIONARY
    -- ==========================================
    
    -- NEW: Copy all used words into the history table first
    INSERT INTO used_words_history (word, shark_id, used_at, week_ending)
    SELECT word, shark_id, used_at, CURRENT_DATE 
    FROM used_words 
    WHERE word != 'SHARK'; -- Don't bother archiving the default starting word
    
    -- THEN wipe the active dictionary
    DELETE FROM used_words WHERE word IS NOT NULL;

    -- Re-insert the default game word
    INSERT INTO used_words (word) VALUES ('SHARK');
    
END;
$$;
