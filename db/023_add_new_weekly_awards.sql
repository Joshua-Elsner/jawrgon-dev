-- Track total career awards for the Player Stats screen
ALTER TABLE players ADD COLUMN jawbreaker_awards INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN robster_awards INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN apex_predator_awards INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN efishent_awards INTEGER DEFAULT 0;

-- Track who won what during a specific week for the Recap Modal
ALTER TABLE weekly_shark_history ADD COLUMN is_jawbreaker BOOLEAN DEFAULT FALSE;
ALTER TABLE weekly_shark_history ADD COLUMN is_robster BOOLEAN DEFAULT FALSE;
ALTER TABLE weekly_shark_history ADD COLUMN is_apex_predator BOOLEAN DEFAULT FALSE;
ALTER TABLE weekly_shark_history ADD COLUMN is_efishent BOOLEAN DEFAULT FALSE;
