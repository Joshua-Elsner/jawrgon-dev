CREATE TABLE IF NOT EXISTS weekly_reset_logs (

    id SERIAL PRIMARY KEY,

    reset_date DATE UNIQUE NOT NULL, -- UNIQUE ensures a day can only exist once

    executed_at TIMESTAMPTZ DEFAULT NOW()

);



-- Enable RLS (Security best practice, even if only the server reads it)

ALTER TABLE weekly_reset_logs ENABLE ROW LEVEL SECURITY;
