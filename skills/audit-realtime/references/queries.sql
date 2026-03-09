-- Tables published to Realtime with RLS status
SELECT pt.schemaname, pt.tablename, t.rowsecurity AS rls_enabled,
    CASE WHEN t.rowsecurity = false
         THEN 'WARNING: Realtime WITHOUT RLS — all changes broadcast to everyone'
         ELSE 'OK: RLS protects Realtime data'
    END AS status
FROM pg_publication_tables pt
JOIN pg_tables t ON t.schemaname = pt.schemaname AND t.tablename = pt.tablename
WHERE pt.pubname = 'supabase_realtime'
ORDER BY t.rowsecurity, pt.tablename;

-- Realtime tables with SELECT policies (Realtime uses SELECT for filtering)
SELECT pt.tablename,
    COALESCE(p.policyname, '(none)') AS select_policy,
    COALESCE(p.qual::text, 'NO POLICY') AS using_expression,
    CASE
        WHEN p.policyname IS NULL THEN 'WARNING: No SELECT policy — all data visible'
        WHEN p.qual::text = 'true' THEN 'INFO: Entire table visible in Realtime'
        ELSE 'OK: SELECT is filtered'
    END AS status
FROM pg_publication_tables pt
LEFT JOIN pg_policies p ON p.schemaname = pt.schemaname AND p.tablename = pt.tablename AND p.cmd = 'r'
WHERE pt.pubname = 'supabase_realtime'
ORDER BY pt.tablename;

-- Sensitive columns in Realtime tables
SELECT pt.tablename, string_agg(c.column_name, ', ') AS sensitive_columns
FROM pg_publication_tables pt
JOIN information_schema.columns c ON c.table_schema = pt.schemaname AND c.table_name = pt.tablename
WHERE pt.pubname = 'supabase_realtime'
  AND c.column_name ~* 'password|secret|token|api_?key|ssn|credit_?card|cvv|pin|hash|credential'
GROUP BY pt.tablename;

-- Realtime vs total tables
SELECT
    (SELECT COUNT(*) FROM pg_publication_tables WHERE pubname = 'supabase_realtime') AS realtime_tables,
    (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public') AS total_tables;
