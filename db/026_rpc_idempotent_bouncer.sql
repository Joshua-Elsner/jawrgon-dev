CREATE OR REPLACE FUNCTION trigger_reset_at_local_midnight()

RETURNS void

LANGUAGE plpgsql

SECURITY DEFINER

AS $$

DECLARE

    local_time TIMESTAMP;

    local_date DATE;

BEGIN

    -- 1. Get the exact current time and date in New York

    local_time := timezone('America/New_York', NOW());

    local_date := local_time::DATE;



    -- 2. Verify it is Sunday locally (Day 0) AND within the Midnight hour (Hour 0)

    IF EXTRACT(DOW FROM local_time) = 0 AND EXTRACT(HOUR FROM local_time) = 0 THEN

        

        -- 3. THE IDEMPOTENCY CHECK: Have we run a reset for today's date yet?

        IF NOT EXISTS (SELECT 1 FROM weekly_reset_logs WHERE reset_date = local_date) THEN

            

            -- 4. Execute the massive reset logic

            PERFORM process_weekly_shark_reset();

            

            -- 5. Write today's date in blood so it NEVER runs again today

            INSERT INTO weekly_reset_logs (reset_date) VALUES (local_date);

            

        END IF;

    END IF;

END;

$$;
