-- Add the yoinks column to the players table
ALTER TABLE players ADD COLUMN yoinks INTEGER DEFAULT 0;

-- Create an RPC so a yoinked player can increment the new Shark's yoink count
CREATE OR REPLACE FUNCTION record_yoink(target_shark_id UUID) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE players SET yoinks = yoinks + 1 WHERE id = target_shark_id;
END;
$$;