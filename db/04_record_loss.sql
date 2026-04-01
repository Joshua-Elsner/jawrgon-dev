-- 04_record_loss.sql
CREATE OR REPLACE FUNCTION record_loss(shark_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF shark_id IS NOT NULL THEN
        UPDATE players
        SET fish_eaten = fish_eaten + 1
        WHERE id = shark_id;
    END IF;
END;
$$;
