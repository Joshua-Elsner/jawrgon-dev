CREATE OR REPLACE FUNCTION record_shark_meal() RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    db_current_shark_id UUID;
BEGIN
    -- Look up the current shark directly from the source of truth
    SELECT current_shark_id INTO db_current_shark_id
    FROM game_state
    WHERE id = 1;

    -- Give the current Shark a point
    IF db_current_shark_id IS NOT NULL THEN
        UPDATE players
        SET fish_eaten = fish_eaten + 1
        WHERE id = db_current_shark_id;
    END IF;
END;
$$;