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
    -- 1. Cash in the CURRENT active shark's live running time
    SELECT current_shark_id, EXTRACT(EPOCH FROM (NOW() - shark_start_time))::INTEGER
    INTO active_shark_id, active_duration
    FROM game_state
    WHERE id = 1;

    IF active_shark_id IS NOT NULL THEN
        UPDATE players
        SET total_time_as_shark = total_time_as_shark + COALESCE(active_duration, 0)
        WHERE id = active_shark_id;
    END IF;

    -- 2. NOW find the player with the most time_as_shark
    SELECT id INTO top_shark_id
    FROM players
    WHERE total_time_as_shark > 0
    ORDER BY total_time_as_shark DESC
    LIMIT 1;

    -- 3. Award the 'Shark of the Week' crown to the winner
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

    -- 5. Reset the time_as_shark column to 0 for EVERYONE
    -- 🔥 THE FIX: Added a WHERE clause to satisfy pg_safeupdate
    UPDATE players
    SET total_time_as_shark = 0
    WHERE id IS NOT NULL; 
    
    -- 6. Reset the active game state to the starting default
    UPDATE game_state
    SET 
        current_shark_id = NULL,
        secret_word = 'SHARK',
        shark_start_time = NOW()
    WHERE id = 1;

    -- ==========================================
    -- 7. WIPE THE USED WORDS DICTIONARY
    -- ==========================================
    DELETE FROM used_words WHERE word IS NOT NULL;
    
    -- Re-insert the default game word 'SHARK' so players can't 
    -- immediately set it to 'SHARK' after the reset happens.
    INSERT INTO used_words (word) VALUES ('SHARK');
    
END;
$$;
