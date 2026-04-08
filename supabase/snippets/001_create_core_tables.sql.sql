-- 1. Create the players table
CREATE TABLE players (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    total_time_as_shark INTEGER DEFAULT 0,
    fish_eaten INTEGER DEFAULT 0,
    sharks_evaded INTEGER DEFAULT 0
);

-- 2. Create the game_state table
CREATE TABLE game_state (
    id INTEGER PRIMARY KEY CHECK (id = 1), -- The CHECK ensures only one active game exists
    current_shark_id UUID REFERENCES players(id),
    secret_word TEXT NOT NULL,
    shark_start_time TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Insert the initial game state row so the game can start
INSERT INTO game_state (id, secret_word, shark_start_time)
VALUES (1, 'SHARK', NOW());

-- 4. Enable Row Level Security (RLS)
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_state ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies for Reading Data
-- These allow anyone playing the game to see the leaderboard and current state
CREATE POLICY "Allow public read access to players"
ON players FOR SELECT USING (true);

CREATE POLICY "Allow public read access to game_state"
ON game_state FOR SELECT USING (true);