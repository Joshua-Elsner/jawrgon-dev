-- 1. Create the dictionary table
CREATE TABLE dictionary (
    word TEXT PRIMARY KEY,
    is_common BOOLEAN DEFAULT false
);

-- 2. Secure it so anyone can read it, but only the server can write to it
ALTER TABLE dictionary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to dictionary" ON dictionary FOR SELECT USING (true);

-- 3. Create the new RPC for the NEW front-end to use
CREATE OR REPLACE FUNCTION get_word_suggestions()
RETURNS TABLE(word TEXT)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT d.word
    FROM dictionary d
    WHERE d.is_common = true
      AND d.word NOT IN (SELECT u.word FROM used_words u)
    ORDER BY random()
    LIMIT 2;
$$;
