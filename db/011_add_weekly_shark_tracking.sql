-- 1. Add the new Shark of the Week column to the existing players table
ALTER TABLE players ADD COLUMN shark_of_the_week_wins INTEGER DEFAULT 0;

-- 2. Create the historical archive table for record keeping
CREATE TABLE weekly_shark_history (
    id SERIAL PRIMARY KEY,
    player_id UUID REFERENCES players(id),
    week_ending DATE DEFAULT CURRENT_DATE,
    time_as_shark INTEGER NOT NULL
);

-- 3. Enable RLS on the new table and allow public read access
ALTER TABLE weekly_shark_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to weekly_shark_history" ON weekly_shark_history FOR SELECT USING (true);
