-- 1. Unschedule the old job

SELECT cron.unschedule('weekly-shark-reset');



-- 2. Reschedule: Fire every 5 minutes during hour 4 and hour 5 UTC on Sundays

SELECT cron.schedule(

    'weekly-shark-reset',   

    '*/5 4,5 * * 0', 

    $$ SELECT trigger_reset_at_local_midnight(); $$

);
