-- Migration 004: Observer role support
-- Purpose: Adds trainer_role and observer_token columns to support the observer role system.
-- trainer_role only stores 'controller' (presence = a controller has claimed this session).
-- Observers are determined at join time (second claim = observer).
-- observer_token is a UUID used to validate observer deep-link access.

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS trainer_role text CHECK (trainer_role IN ('controller'));
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS observer_token text;

-- Index for fast observer token lookups (partial — only rows with a token)
CREATE INDEX IF NOT EXISTS idx_sessions_observer_token ON sessions (observer_token) WHERE observer_token IS NOT NULL;
