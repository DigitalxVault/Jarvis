-- Sessions table for JARVIS DCS
-- Each session represents one bridge↔dashboard connection

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  status text not null default 'active'
    check (status in ('active', 'ended')),
  pairing_code text unique,
  pairing_expires_at timestamptz,
  bridge_claimed boolean default false,
  created_at timestamptz default now(),
  ended_at timestamptz
);

-- Index for looking up active sessions by user
create index idx_sessions_user_active
  on sessions (user_id, status)
  where status = 'active';

-- Index for pairing code lookups
create index idx_sessions_pairing_code
  on sessions (pairing_code)
  where pairing_code is not null;

-- Enable Realtime on sessions table (for session status changes)
alter publication supabase_realtime add table sessions;
