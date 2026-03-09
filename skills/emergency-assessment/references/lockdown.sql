-- LOCKDOWN SQL — Run manually after assessment

-- Enable RLS on all unprotected tables
ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.<table> FORCE ROW LEVEL SECURITY;

-- Make all buckets private
UPDATE storage.buckets SET public = false WHERE public = true;

-- Revoke anon access
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- Disable Realtime
ALTER PUBLICATION supabase_realtime DROP ALL TABLES;
