CREATE TABLE IF NOT EXISTS player_stats_snapshots (
    id SERIAL PRIMARY KEY,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    snapshot_date DATE DEFAULT CURRENT_DATE,
    
    -- Lifetime Stats
    all_time_time_as_shark INTEGER DEFAULT 0,
    fish_eaten INTEGER DEFAULT 0,
    sharks_evaded INTEGER DEFAULT 0,
    yoinks INTEGER DEFAULT 0,
    all_time_guesses INTEGER DEFAULT 0,
    all_time_puzzles_played INTEGER DEFAULT 0,
    
    -- Lifetime Awards
    shark_of_the_week_wins INTEGER DEFAULT 0,
    silver_medals INTEGER DEFAULT 0,
    bronze_medals INTEGER DEFAULT 0,
    jawbreaker_awards INTEGER DEFAULT 0,
    robster_awards INTEGER DEFAULT 0,
    apex_predator_awards INTEGER DEFAULT 0,
    efishent_awards INTEGER DEFAULT 0,

    -- A player can only have one snapshot per day
    UNIQUE(player_id, snapshot_date)
);

-- Secure it: Only the server (your RPCs) should ever be writing or reading this table
ALTER TABLE player_stats_snapshots ENABLE ROW LEVEL SECURITY;
