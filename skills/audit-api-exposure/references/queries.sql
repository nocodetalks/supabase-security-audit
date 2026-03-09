-- Summary counts
SELECT
    (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public') AS total_tables,
    (SELECT COUNT(*) FROM information_schema.views WHERE table_schema = 'public') AS total_views,
    (SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public') AS total_functions,
    (SELECT SUM(n_live_tup) FROM pg_stat_user_tables WHERE schemaname = 'public') AS total_rows;

-- Row counts per table
SELECT relname AS table_name, n_live_tup AS estimated_rows,
    CASE
        WHEN n_live_tup > 100000 THEN 'WARNING: 100k+ rows exposed'
        WHEN n_live_tup > 10000 THEN 'INFO: 10k+ rows'
        ELSE 'OK'
    END AS status
FROM pg_stat_user_tables WHERE schemaname = 'public' ORDER BY n_live_tup DESC;

-- Grants for anon and authenticated roles
SELECT table_name, grantee,
    string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges,
    CASE
        WHEN string_agg(privilege_type, ',') LIKE '%DELETE%' THEN 'CRITICAL'
        WHEN string_agg(privilege_type, ',') LIKE '%INSERT%' OR string_agg(privilege_type, ',') LIKE '%UPDATE%' THEN 'HIGH'
        ELSE 'INFO'
    END AS risk_level
FROM information_schema.table_privileges
WHERE grantee IN ('anon', 'authenticated') AND table_schema = 'public'
GROUP BY table_name, grantee ORDER BY grantee, table_name;
