CREATE OR REPLACE FUNCTION record_shark_meal(
    active_shark_id UUID
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Give the current Shark a point for eating the player
    IF active_shark_id IS NOT NULL THEN
        UPDATE players
        SET fish_eaten = fish_eaten + 1
        WHERE id = active_shark_id;
    END IF;
END;
$$;
