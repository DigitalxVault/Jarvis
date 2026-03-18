-- Migration 003: Enable Row Level Security on sessions table
-- Purpose: Defense-in-depth against direct PostgREST access with the anon key.
-- All server-side API routes use service_role (createServerSupabase()) which bypasses RLS.
-- The anon key is only used by the web client for Realtime Broadcast subscriptions,
-- which are independent of table RLS.
-- NextAuth is used for authentication (not Supabase Auth), so auth.uid() is NOT used.

-- Step 1: Enable RLS
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Step 2: Anon SELECT policies
-- Anon can only read sessions with active pairing/trainer codes.
-- No INSERT/UPDATE/DELETE is granted — denied by default when RLS is enabled with no matching policy.

-- Policy 1: Bridge claim lookups — anon can find sessions by active pairing code
CREATE POLICY "anon_select_by_pairing_code"
  ON sessions FOR SELECT TO anon
  USING (pairing_code IS NOT NULL AND status = 'active' AND bridge_claimed = false);

-- Policy 2: Trainer claim lookups — anon can find sessions by active trainer code
CREATE POLICY "anon_select_by_trainer_code"
  ON sessions FOR SELECT TO anon
  USING (trainer_code IS NOT NULL AND status = 'active');

-- Step 3: Authenticated role policies (defense-in-depth)
-- This project uses NextAuth (not Supabase Auth), so authenticated here means
-- a Supabase-authenticated role — not the same as a NextAuth session.
-- These permissive policies ensure the authenticated role is not locked out
-- if accidentally used. Real authorization happens in API route handlers.

CREATE POLICY "authenticated_select"
  ON sessions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "authenticated_insert"
  ON sessions FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "authenticated_update"
  ON sessions FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- No DELETE policy for anon or authenticated.
-- Sessions are never deleted — only ended (status = 'ended').
-- service_role bypasses RLS automatically; no policy needed for it.
