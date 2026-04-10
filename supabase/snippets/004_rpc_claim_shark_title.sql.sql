CREATE OR REPLACE FUNCTION claim_shark_title(
    winner_id UUID,          
    guessed_word TEXT,       
    new_secret_word TEXT     
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
    IF upper(new_secret_word) !~ '^[A-Z]{5}$' THEN
        RAISE EXCEPTION 'Invalid secret word. Must be exactly 5 letters.';
    END IF;

    -- NEW: Check if the word has been used before!
    IF EXISTS (SELECT 1 FROM used_words WHERE word = upper(new_secret_word)) THEN
        RAISE EXCEPTION 'Word already used! You must pick a word that has never been played.';
    END IF;

    -- 2. FETCH AND LOCK CURRENT STATE
    SELECT current_shark_id, secret_word, EXTRACT(EPOCH FROM (NOW() - shark_start_time))::INTEGER
    INTO db_current_shark_id, db_secret_word, shark_duration_seconds
    FROM game_state
    WHERE id = 1
    FOR UPDATE;

    -- 3. VERIFY THE GUESS AGAINST THE DATABASE
    IF upper(guessed_word) != db_secret_word THEN
        RAISE EXCEPTION 'TOO SLOW!!! The Shark may have already been defeated by someone else!';
    END IF;

    IF winner_id = db_current_shark_id THEN
        RAISE EXCEPTION 'You are already the Shark!';
    END IF;

    -- 4. EXECUTE SECURE UPDATES
    -- Update outgoing Shark
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

    -- NEW: Record the new word in the history table!
    INSERT INTO used_words (word, shark_id) 
    VALUES (upper(new_secret_word), winner_id);

END;
$$;