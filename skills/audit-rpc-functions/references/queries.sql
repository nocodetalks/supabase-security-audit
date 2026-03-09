-- All public functions with risk level
SELECT
    p.proname AS function_name,
    pg_get_function_arguments(p.oid) AS arguments,
    pg_get_function_result(p.oid) AS return_type,
    p.prosecdef AS security_definer,
    CASE
        WHEN p.proname ~* 'delete|drop|truncate' THEN 'HIGH: Destructive'
        WHEN p.proname ~* 'admin|sudo|superuser' THEN 'HIGH: Admin'
        WHEN p.proname ~* 'update|insert|create|modify' THEN 'MEDIUM: Write'
        ELSE 'LOW'
    END AS risk_level
FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY CASE WHEN p.proname ~* 'delete|drop|truncate|admin' THEN 1
              WHEN p.proname ~* 'update|insert|create' THEN 2 ELSE 3 END;

-- Anon and authenticated execute permissions
SELECT
    p.proname AS function_name,
    CASE WHEN has_function_privilege('anon', p.oid, 'execute') THEN 'YES' ELSE 'no' END AS anon_can_execute,
    CASE WHEN has_function_privilege('authenticated', p.oid, 'execute') THEN 'YES' ELSE 'no' END AS auth_can_execute,
    p.prosecdef AS is_security_definer,
    CASE
        WHEN has_function_privilege('anon', p.oid, 'execute') AND p.proname ~* 'delete|drop|truncate|admin'
        THEN 'CRITICAL: Sensitive function callable by anon'
        WHEN has_function_privilege('anon', p.oid, 'execute') AND p.proname ~* 'update|insert|create'
        THEN 'WARNING: Write function callable by anon'
        ELSE 'OK'
    END AS status
FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY CASE WHEN has_function_privilege('anon', p.oid, 'execute') THEN 0 ELSE 1 END;

-- SECURITY DEFINER functions with search_path check
SELECT
    p.proname AS function_name,
    pg_get_function_arguments(p.oid) AS arguments,
    CASE
        WHEN p.proconfig IS NULL OR NOT (p.proconfig::text LIKE '%search_path%')
        THEN 'CRITICAL: No search_path — vulnerable to hijacking'
        ELSE 'OK: search_path configured'
    END AS search_path_status,
    CASE WHEN has_function_privilege('anon', p.oid, 'execute')
         THEN 'WARNING: Anon can call' ELSE 'OK' END AS anon_access
FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.prosecdef = true;
