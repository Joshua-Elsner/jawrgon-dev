CREATE OR REPLACE FUNCTION claim_shark_title(
    winner_id UUID,
    outgoing_shark_id UUID,
    new_secret_word TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    shark_duration_seconds INTEGER;
BEGIN
    -- 1. Calculate how long the current shark survived in seconds
    SELECT EXTRACT(EPOCH FROM (NOW() - shark_start_time))::INTEGER
    INTO shark_duration_seconds
    FROM game_state
    WHERE id = 1;

    -- 2. Update the outgoing Shark's stats (TIME ONLY, NO FISH EATEN)
    IF outgoing_shark_id IS NOT NULL THEN
        UPDATE players
        SET total_time_as_shark = total_time_as_shark + COALESCE(shark_duration_seconds, 0)
        WHERE id = outgoing_shark_id;
    END IF;

    -- 3. Update the Winner's stats (They survived/evaded!)
    UPDATE players
    SET sharks_evaded = sharks_evaded + 1
    WHERE id = winner_id;

    -- 4. Update the global Game State
    UPDATE game_state
    SET 
        current_shark_id = winner_id,
        secret_word = UPPER(new_secret_word),
        shark_start_time = NOW()
    WHERE id = 1;
END;
$$;
