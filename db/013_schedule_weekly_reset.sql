-- Enable pg_cron if it isn't already enabled on your project
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the job for Midnight EST  every Sunday (day 0)
SELECT cron.schedule(
    'weekly-shark-reset',   -- The name of the cron job
    '0 0 * * 0',            -- Cron expression: Minute(0) Hour(0) DayOfMonth(*) Month(*) DayOfWeek(0=Sunday)
    $$ SELECT process_weekly_shark_reset(); $$
);
