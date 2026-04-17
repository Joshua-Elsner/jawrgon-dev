CREATE OR REPLACE FUNCTION process_weekly_shark_reset()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
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
        SET total_time_as_shark = total_time_as_shark + COALESCE(active_duration, 0),
            all_time_time_as_shark = all_time_time_as_shark + COALESCE(active_duration, 0)
        WHERE id = active_shark_id;
    END IF;

    -- 2 & 3. Rank top 3 players and award medals in one pass
    WITH top_sharks AS (
        SELECT id, row_number() OVER (ORDER BY total_time_as_shark DESC) as rank
        FROM players
        WHERE total_time_as_shark > 0
        LIMIT 3
    )
    UPDATE players
    SET 
        shark_of_the_week_wins = shark_of_the_week_wins + CASE WHEN ts.rank = 1 THEN 1 ELSE 0 END,
        silver_medals = silver_medals + CASE WHEN ts.rank = 2 THEN 1 ELSE 0 END,
        bronze_medals = bronze_medals + CASE WHEN ts.rank = 3 THEN 1 ELSE 0 END
    FROM top_sharks ts
    WHERE players.id = ts.id;

    -- 4. Archive everyone's time into the history table
    INSERT INTO weekly_shark_history (player_id, time_as_shark, week_ending)
    SELECT id, total_time_as_shark, CURRENT_DATE
    FROM players
    WHERE total_time_as_shark > 0;

    -- 5. RESET ALL WEEKLY STATS TO 0 
    UPDATE players
    SET total_time_as_shark = 0,
        weekly_fish_eaten = 0,
        weekly_sharks_evaded = 0,
        weekly_yoinks = 0,
        weekly_guesses = 0,          
        weekly_puzzles_played = 0    
    WHERE id IS NOT NULL;

    -- 6. Reset active game state
    UPDATE game_state
    SET current_shark_id = NULL, secret_word = 'SHARK', shark_start_time = NOW()
    WHERE id = 1;

    -- 7. ARCHIVE AND WIPE THE USED WORDS DICTIONARY
    INSERT INTO used_words_history (word, shark_id, used_at, week_ending)
    SELECT word, shark_id, used_at, CURRENT_DATE 
    FROM used_words 
    WHERE word != 'SHARK';

    DELETE FROM used_words WHERE word IS NOT NULL;
    INSERT INTO used_words (word) VALUES ('SHARK');
END;
$$;
