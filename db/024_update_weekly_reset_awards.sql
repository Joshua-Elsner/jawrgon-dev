CREATE OR REPLACE FUNCTION process_weekly_shark_reset()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    active_shark_id UUID;
    active_duration INTEGER;
    
    -- Variables to hold our new award winners
    v_jawbreaker_id UUID;
    v_robster_id UUID;
    v_apex_id UUID;
    v_efishent_id UUID;
BEGIN
    -- 1. Cash in the CURRENT active shark's live running time [cite: 189, 190]
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

    -- 2. Rank top 3 players and award Gold/Silver/Bronze medals 
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

    -- 3. Identify the new award winners using window functions
    WITH ranked_stats AS (
        SELECT id,
            RANK() OVER (ORDER BY weekly_sharks_evaded DESC) as rank_words,
            RANK() OVER (ORDER BY weekly_yoinks DESC) as rank_yoinks,
            RANK() OVER (ORDER BY weekly_fish_eaten DESC) as rank_fish,
            -- E-fish-ent logic: Must have played 10+ games to qualify
            CASE WHEN weekly_puzzles_played >= 10 
                 THEN (weekly_guesses::numeric / weekly_puzzles_played) 
                 ELSE 'Infinity'::numeric END as avg_guesses
        FROM players 
        WHERE weekly_puzzles_played > 0
    )
    SELECT 
        (SELECT id FROM ranked_stats WHERE rank_words = 1 LIMIT 1),
        (SELECT id FROM ranked_stats WHERE rank_yoinks = 1 LIMIT 1),
        (SELECT id FROM ranked_stats WHERE rank_fish = 1 LIMIT 1),
        (SELECT id FROM ranked_stats ORDER BY avg_guesses ASC LIMIT 1)
    INTO 
        v_jawbreaker_id, 
        v_robster_id, 
        v_apex_id, 
        v_efishent_id;

    -- 4. Increment lifetime award counts on the players table
    UPDATE players SET jawbreaker_awards = jawbreaker_awards + 1 WHERE id = v_jawbreaker_id;
    UPDATE players SET robster_awards = robster_awards + 1 WHERE id = v_robster_id;
    UPDATE players SET apex_predator_awards = apex_predator_awards + 1 WHERE id = v_apex_id;
    UPDATE players SET efishent_awards = efishent_awards + 1 WHERE id = v_efishent_id;

    -- 5. Archive everyone's time into the history table with their award flags
    INSERT INTO weekly_shark_history (
        player_id, 
        time_as_shark, 
        week_ending, 
        is_jawbreaker, 
        is_robster, 
        is_apex_predator, 
        is_efishent
    )
    SELECT 
        id, 
        total_time_as_shark, 
        CURRENT_DATE,
        (id = v_jawbreaker_id),
        (id = v_robster_id),
        (id = v_apex_id),
        (id = v_efishent_id)
    FROM players
    WHERE total_time_as_shark > 0 OR weekly_puzzles_played > 0;

    -- 6. RESET ALL WEEKLY STATS TO 0 (Leave All-Time stats untouched) [cite: 194]
    UPDATE players
    SET total_time_as_shark = 0,
        weekly_fish_eaten = 0,
        weekly_sharks_evaded = 0,
        weekly_yoinks = 0,
        weekly_guesses = 0,          
        weekly_puzzles_played = 0    
    WHERE id IS NOT NULL;

    -- 7. Reset active game state 
    UPDATE game_state
    SET current_shark_id = NULL, secret_word = 'SHARK', shark_start_time = NOW()
    WHERE id = 1;

    -- 8. ARCHIVE AND WIPE THE USED WORDS DICTIONARY 
    INSERT INTO used_words_history (word, shark_id, used_at, week_ending)
    SELECT word, shark_id, used_at, CURRENT_DATE 
    FROM used_words 
    WHERE word != 'SHARK';

    DELETE FROM used_words WHERE word IS NOT NULL; 
    INSERT INTO used_words (word) VALUES ('SHARK');
END;
$$;
