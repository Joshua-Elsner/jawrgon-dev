CREATE OR REPLACE FUNCTION create_new_player(new_username TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    player_count INT;
    new_id UUID;
    clean_username TEXT;
BEGIN
    -- Trim whitespace from the beginning and end
    clean_username := btrim(new_username);
    
    -- Validate length (CHANGED TO 13)
    IF length(clean_username) < 1 OR length(clean_username) > 13 THEN
        RAISE EXCEPTION 'Username must be between 1 and 13 characters.';
    END IF;
    
    -- Validate characters (ADDED SPACE ALLOWANCE)
    IF clean_username !~ '^[a-zA-Z0-9 ''!]+$' THEN
        RAISE EXCEPTION 'Username must be alphanumeric and spaces only.';
    END IF;
    
    -- Check capacity to prevent spam
    SELECT count(*) INTO player_count FROM players;
    IF player_count >= 100 THEN
        RAISE EXCEPTION 'Player limit reached (100).';
    END IF;
    
    -- Check duplicates (case-insensitive)
    IF EXISTS (SELECT 1 FROM players WHERE lower(username) = lower(clean_username)) THEN
        RAISE EXCEPTION 'Username already exists!';
    END IF;
    
    -- Insert new player
    INSERT INTO players (username) VALUES (clean_username) RETURNING id INTO new_id;
    
    -- Return the newly created player data
    RETURN json_build_object('id', new_id, 'username', clean_username);
END;
$$;