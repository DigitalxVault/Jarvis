-- Add trainer_code column to sessions table
-- Enables the trainer pairing flow: player generates a 4-digit code,
-- trainer enters it via /api/trainer/claim to join the session.

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS trainer_code text;

-- Fast lookup index for /api/trainer/claim (.eq('trainer_code', code))
-- Matches the pattern used for pairing_code in 001_sessions.sql
CREATE INDEX IF NOT EXISTS idx_sessions_trainer_code
  ON sessions (trainer_code)
  WHERE trainer_code IS NOT NULL;

-- Unique partial index — enforces no two active sessions share the same trainer code.
-- The /api/sessions/[id]/trainer-code route handles 23505 violations with retry logic.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_trainer_code_unique
  ON sessions (trainer_code)
  WHERE trainer_code IS NOT NULL;
