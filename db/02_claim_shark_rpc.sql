CREATE OR REPLACE FUNCTION claim_shark_title(
    winner_id UUID,          -- Who is claiming the title
    guessed_word TEXT,       -- The word they just guessed to win
    new_secret_word TEXT     -- The new word they are setting
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    db_current_shark_id UUID;
    db_secret_word TEXT;
    shark_duration_seconds INTEGER;
BEGIN
    -- 1. STRICT INPUT VALIDATION
    -- Force uppercase and ensure it is exactly 5 alphabetical letters
    IF upper(new_secret_word) !~ '^[A-Z]{5}$' THEN
        RAISE EXCEPTION 'Invalid secret word. Must be exactly 5 letters.';
    END IF;

    -- 2. FETCH AND LOCK CURRENT STATE
    -- "FOR UPDATE" locks the game_state row. If Player A and Player B 
    -- both guess correctly at the exact same millisecond, the database 
    -- forces Player B to wait until Player A's transaction finishes.
    SELECT current_shark_id, secret_word, EXTRACT(EPOCH FROM (NOW() - shark_start_time))::INTEGER
    INTO db_current_shark_id, db_secret_word, shark_duration_seconds
    FROM game_state
    WHERE id = 1
    FOR UPDATE; 

    -- 3. VERIFY THE GUESS AGAINST THE DATABASE
    -- If Player A already won and changed the word, Player B's guess will 
    -- fail this check, preventing them from overwriting Player A's victory.
    IF upper(guessed_word) != db_secret_word THEN
        RAISE EXCEPTION 'Incorrect word. The Shark may have already been defeated by someone else!';
    END IF;

    -- Prevent a player from beating themselves if they are already the shark
    IF winner_id = db_current_shark_id THEN
        RAISE EXCEPTION 'You are already the Shark!';
    END IF;

    -- 4. EXECUTE SECURE UPDATES
    -- Update outgoing Shark (using the DB's ID, not the client's)
    IF db_current_shark_id IS NOT NULL THEN
        UPDATE players
        SET total_time_as_shark = total_time_as_shark + COALESCE(shark_duration_seconds, 0)
        WHERE id = db_current_shark_id;
    END IF;

    -- Update the Winner
    UPDATE players
    SET sharks_evaded = sharks_evaded + 1
    WHERE id = winner_id;

    -- Update Global Game State
    UPDATE game_state
    SET 
        current_shark_id = winner_id,
        secret_word = upper(new_secret_word),
        shark_start_time = NOW()
    WHERE id = 1;
END;
$$;
