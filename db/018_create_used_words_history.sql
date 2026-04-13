CREATE TABLE used_words_history (
    id SERIAL PRIMARY KEY,
    word TEXT NOT NULL,
    shark_id UUID REFERENCES players(id),
    used_at TIMESTAMPTZ, -- Copies when it was originally played
    week_ending DATE DEFAULT CURRENT_DATE
);

ALTER TABLE used_words_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to used_words_history" ON used_words_history FOR SELECT USING (true);
