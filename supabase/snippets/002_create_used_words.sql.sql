-- Create the table to track word history
CREATE TABLE used_words (
    word TEXT PRIMARY KEY, -- Making the word the Primary Key ensures it must be unique!
    used_at TIMESTAMPTZ DEFAULT NOW(),
    shark_id UUID REFERENCES players(id) -- Optional: tracks who set it
);

-- Enable RLS so it's secure
ALTER TABLE used_words ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read the history (in case you want to make a "Past Words" UI later)
CREATE POLICY "Allow public read access to used_words"
ON used_words FOR SELECT USING (true);

-- Insert the very first initial game state word so it can't be used again
INSERT INTO used_words (word) VALUES ('SHARK');