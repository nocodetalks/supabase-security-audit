-- EMERGENCY ASSESSMENT — Read-only, run immediately

-- Recent auth activity (unusual sign-ins?)
SELECT '--- RECENT AUTH ACTIVITY ---' AS section;
SELECT id, user_id, created_at, ip_address, user_agent
FROM auth.audit_log_entries ORDER BY created_at DESC LIMIT 50;

-- Recently created users (unauthorized signups?)
SELECT '--- RECENT USERS ---' AS section;
SELECT id, email, created_at, last_sign_in_at, confirmed_at,
    raw_app_meta_data->>'provider' AS provider,
    raw_app_meta_data->>'role' AS custom_role
FROM auth.users ORDER BY created_at DESC LIMIT 30;

-- Users with elevated roles (privilege escalation?)
SELECT '--- ELEVATED ROLES ---' AS section;
SELECT id, email, raw_app_meta_data->>'role' AS role, created_at
FROM auth.users WHERE raw_app_meta_data->>'role' IS NOT NULL ORDER BY created_at DESC;

-- Unprotected tables
SELECT '--- UNPROTECTED TABLES ---' AS section;
SELECT tablename, 'CRITICAL: No RLS' AS status
FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false ORDER BY tablename;

-- Public storage buckets
SELECT '--- PUBLIC BUCKETS ---' AS section;
SELECT id, name, public, created_at FROM storage.buckets WHERE public = true;

-- Permissive write policies
SELECT '--- PERMISSIVE WRITE POLICIES ---' AS section;
SELECT tablename, policyname, cmd, roles::text, qual AS using_expr
FROM pg_policies WHERE schemaname = 'public'
  AND (qual::text = 'true' OR with_check::text = 'true') AND cmd != 'r' ORDER BY tablename;

-- Anon-accessible destructive functions
SELECT '--- ANON DESTRUCTIVE FUNCTIONS ---' AS section;
SELECT p.proname AS function_name, p.prosecdef AS security_definer
FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND has_function_privilege('anon', p.oid, 'execute')
  AND p.proname ~* 'delete|drop|truncate|admin|update|insert' ORDER BY function_name;

-- Realtime without RLS
SELECT '--- REALTIME WITHOUT RLS ---' AS section;
SELECT pt.tablename FROM pg_publication_tables pt
JOIN pg_tables t ON t.schemaname = pt.schemaname AND t.tablename = pt.tablename
WHERE pt.pubname = 'supabase_realtime' AND t.rowsecurity = false;

-- Data exposure volume
SELECT '--- DATA EXPOSURE ---' AS section;
SELECT relname AS table_name, n_live_tup AS estimated_rows
FROM pg_stat_user_tables WHERE schemaname = 'public' AND n_live_tup > 0
ORDER BY n_live_tup DESC;
