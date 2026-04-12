
-- Calculate total historical time for each player by summing up their past 
-- archived weeks in weekly_shark_history, and adding their current active 
-- week's total_time_as_shark. 
-- COALESCE handles players who have no past history.

UPDATE players
SET all_time_time_as_shark = total_time_as_shark + 
    COALESCE((
        SELECT SUM(time_as_shark) 
        FROM weekly_shark_history 
        WHERE player_id = players.id
    ), 0);
