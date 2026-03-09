-- User overview
SELECT id, email, role, created_at, last_sign_in_at,
    CASE WHEN confirmed_at IS NOT NULL THEN 'confirmed' ELSE 'UNCONFIRMED' END AS email_status,
    CASE WHEN banned_until IS NOT NULL AND banned_until > now() THEN 'BANNED' ELSE 'active' END AS ban_status
FROM auth.users ORDER BY created_at DESC LIMIT 50;

-- Unconfirmed user count
SELECT COUNT(*) AS total_users,
    COUNT(*) FILTER (WHERE confirmed_at IS NULL) AS unconfirmed,
    COUNT(*) FILTER (WHERE last_sign_in_at IS NULL) AS never_signed_in
FROM auth.users;

-- MFA adoption
SELECT COUNT(*) AS total_users,
    COUNT(*) FILTER (WHERE raw_app_meta_data->>'mfa_enabled' = 'true'
        OR jsonb_array_length(COALESCE(raw_app_meta_data->'factors', '[]'::jsonb)) > 0) AS mfa_enabled,
    COUNT(*) FILTER (WHERE raw_app_meta_data->>'mfa_enabled' IS DISTINCT FROM 'true'
        AND jsonb_array_length(COALESCE(raw_app_meta_data->'factors', '[]'::jsonb)) = 0) AS mfa_disabled
FROM auth.users;

-- Users with custom roles
SELECT id, email, raw_app_meta_data->>'role' AS custom_role,
    raw_app_meta_data->>'provider' AS provider, created_at
FROM auth.users WHERE raw_app_meta_data->>'role' IS NOT NULL
ORDER BY raw_app_meta_data->>'role', email;

-- Auth hook functions accessible by anon
SELECT p.proname AS function_name, p.prosecdef AS security_definer,
    CASE WHEN has_function_privilege('anon', p.oid, 'execute')
         THEN 'WARNING: Anon can call' ELSE 'OK' END AS anon_access
FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname ~* 'hook|claim|token|auth|validate';

-- service_role references in policies
SELECT tablename, policyname, roles::text, qual AS using_expression
FROM pg_policies WHERE schemaname = 'public'
  AND (roles::text LIKE '%service_role%' OR qual::text LIKE '%service_role%');
