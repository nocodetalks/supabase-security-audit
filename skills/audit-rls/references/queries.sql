-- Tables WITHOUT RLS enabled
SELECT
    schemaname,
    tablename,
    rowsecurity AS rls_enabled,
    CASE
        WHEN rowsecurity = false THEN 'CRITICAL: RLS not enabled'
        ELSE 'OK'
    END AS status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY rowsecurity, tablename;

-- Tables with RLS enabled but NO policies (all access blocked)
SELECT
    t.tablename,
    'WARNING: RLS enabled but no policies — all access blocked' AS status
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND t.rowsecurity = true
  AND NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = t.tablename
  );
