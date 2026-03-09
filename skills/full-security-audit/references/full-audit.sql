-- SUPABASE FULL SECURITY AUDIT — Read-only, safe for production

-- 1. TABLES WITHOUT RLS
SELECT '--- 1. TABLES WITHOUT RLS ---' AS section;
SELECT tablename, 'CRITICAL: RLS not enabled' AS issue
FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false ORDER BY tablename;

-- 2. RLS BUT NO POLICIES
SELECT '--- 2. RLS BUT NO POLICIES ---' AS section;
SELECT t.tablename, 'WARNING: RLS on but no policies — all access blocked' AS issue
FROM pg_tables t WHERE t.schemaname = 'public' AND t.rowsecurity = true
  AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = t.tablename);

-- 3. PERMISSIVE WRITE POLICIES
SELECT '--- 3. PERMISSIVE WRITE POLICIES ---' AS section;
SELECT tablename, policyname, cmd, roles::text, qual AS using_expr, with_check
FROM pg_policies WHERE schemaname = 'public'
  AND (qual::text = 'true' OR with_check::text = 'true') AND cmd != 'r' ORDER BY tablename;

-- 4. SENSITIVE COLUMNS
SELECT '--- 4. SENSITIVE COLUMNS ---' AS section;
SELECT table_name, column_name, data_type,
    CASE
        WHEN column_name ~* 'password|passwd' THEN 'PASSWORD'
        WHEN column_name ~* 'secret|token' THEN 'SECRET/TOKEN'
        WHEN column_name ~* 'api_?key|apikey|private_?key|access_?key' THEN 'API_KEY'
        WHEN column_name ~* 'ssn|social_?security|credit_?card|card_?number|cvv|cvc|pin' THEN 'PII'
        WHEN column_name ~* 'encryption_?key|salt|hash|credential' THEN 'CRYPTO'
        ELSE 'OTHER'
    END AS type
FROM information_schema.columns WHERE table_schema = 'public'
  AND column_name ~* 'password|passwd|secret|token|api_?key|apikey|private_?key|access_?key|auth_?key|ssn|social_?security|credit_?card|card_?number|cvv|cvc|pin|encryption_?key|salt|hash|credential'
ORDER BY table_name;

-- 5. ANON PERMISSIONS
SELECT '--- 5. ANON PERMISSIONS ---' AS section;
SELECT table_name, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges,
    CASE
        WHEN string_agg(privilege_type, ',') LIKE '%DELETE%' THEN 'CRITICAL'
        WHEN string_agg(privilege_type, ',') LIKE '%INSERT%' OR string_agg(privilege_type, ',') LIKE '%UPDATE%' THEN 'HIGH'
        ELSE 'INFO'
    END AS risk
FROM information_schema.table_privileges
WHERE grantee = 'anon' AND table_schema = 'public'
GROUP BY table_name ORDER BY risk, table_name;

-- 6. ANON FUNCTIONS
SELECT '--- 6. ANON FUNCTIONS ---' AS section;
SELECT p.proname AS function_name, p.prosecdef AS security_definer,
    CASE
        WHEN p.proname ~* 'delete|drop|truncate|admin' THEN 'HIGH'
        WHEN p.proname ~* 'update|insert|create' THEN 'MEDIUM'
        ELSE 'LOW'
    END AS risk
FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND has_function_privilege('anon', p.oid, 'execute')
ORDER BY risk, function_name;

-- 7. SECURITY DEFINER
SELECT '--- 7. SECURITY DEFINER ---' AS section;
SELECT p.proname AS function_name,
    CASE WHEN p.proconfig IS NULL OR NOT (p.proconfig::text LIKE '%search_path%')
         THEN 'CRITICAL: No search_path' ELSE 'OK' END AS search_path,
    CASE WHEN has_function_privilege('anon', p.oid, 'execute')
         THEN 'WARNING: Anon can call' ELSE 'OK' END AS anon_access
FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.prosecdef = true;

-- 8. STORAGE
SELECT '--- 8. STORAGE ---' AS section;
SELECT id, name, public, file_size_limit, allowed_mime_types,
    CASE WHEN public = true THEN 'WARNING' ELSE 'OK' END AS status
FROM storage.buckets ORDER BY public DESC, name;

-- 9. STORAGE POLICIES
SELECT '--- 9. STORAGE POLICIES ---' AS section;
SELECT policyname, tablename, cmd, roles::text, qual AS using_expr
FROM pg_policies WHERE schemaname = 'storage' ORDER BY tablename, policyname;

-- 10. REALTIME
SELECT '--- 10. REALTIME ---' AS section;
SELECT pt.tablename, t.rowsecurity AS rls_enabled,
    CASE WHEN t.rowsecurity = false THEN 'WARNING: No RLS' ELSE 'OK' END AS status
FROM pg_publication_tables pt
JOIN pg_tables t ON t.schemaname = pt.schemaname AND t.tablename = pt.tablename
WHERE pt.pubname = 'supabase_realtime' ORDER BY t.rowsecurity, pt.tablename;

-- 11. DATA VOLUME
SELECT '--- 11. DATA VOLUME ---' AS section;
SELECT relname AS table_name, n_live_tup AS estimated_rows,
    CASE WHEN n_live_tup > 100000 THEN 'WARNING' WHEN n_live_tup > 10000 THEN 'INFO' ELSE 'OK' END AS status
FROM pg_stat_user_tables WHERE schemaname = 'public' ORDER BY n_live_tup DESC;

-- 12. AUTH
SELECT '--- 12. AUTH ---' AS section;
SELECT COUNT(*) AS total_users,
    COUNT(*) FILTER (WHERE confirmed_at IS NULL) AS unconfirmed,
    COUNT(*) FILTER (WHERE last_sign_in_at IS NULL) AS never_signed_in
FROM auth.users;

-- 13. SUMMARY
SELECT '--- 13. SUMMARY ---' AS section;
SELECT
    (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false) AS tables_no_rls,
    (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public') AS total_tables,
    (SELECT COUNT(*) FROM storage.buckets WHERE public = true) AS public_buckets,
    (SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
     WHERE n.nspname = 'public' AND has_function_privilege('anon', p.oid, 'execute')) AS anon_functions,
    (SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
     WHERE n.nspname = 'public' AND p.prosecdef = true) AS sec_definer_functions,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public'
       AND column_name ~* 'password|passwd|secret|token|api_?key|ssn|credit_?card|cvv') AS sensitive_columns,
    (SELECT COUNT(*) FROM pg_publication_tables WHERE pubname = 'supabase_realtime') AS realtime_tables;
