-- All existing RLS policies
SELECT
    schemaname, tablename, policyname, permissive,
    roles::text, cmd, qual AS using_expression, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Overly permissive WRITE policies (USING true or WITH CHECK true)
SELECT
    tablename, policyname, cmd, roles::text,
    qual AS using_expression, with_check,
    'WARNING: Permissive write policy' AS status
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual::text = 'true' OR with_check::text = 'true')
  AND cmd != 'r'
ORDER BY tablename;

-- Check if policies use auth functions
SELECT
    tablename, policyname, cmd, qual AS using_expression,
    CASE
        WHEN qual::text LIKE '%auth.uid()%' THEN 'GOOD: Uses auth.uid()'
        WHEN qual::text LIKE '%auth.role()%' THEN 'GOOD: Uses auth.role()'
        WHEN qual::text = 'true' THEN 'WARNING: Allows all'
        ELSE 'REVIEW: Custom expression'
    END AS auth_check_status
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
