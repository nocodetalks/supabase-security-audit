-- Find sensitive columns by name pattern
SELECT
    table_name, column_name, data_type,
    CASE
        WHEN column_name ~* 'password|passwd' THEN 'PASSWORD'
        WHEN column_name ~* 'secret' THEN 'SECRET'
        WHEN column_name ~* 'token' THEN 'TOKEN'
        WHEN column_name ~* 'api_?key|apikey' THEN 'API_KEY'
        WHEN column_name ~* 'private_?key|access_?key|auth_?key' THEN 'ACCESS_KEY'
        WHEN column_name ~* 'ssn|social_?security' THEN 'PII_SSN'
        WHEN column_name ~* 'credit_?card|card_?number|cvv|cvc|pin' THEN 'PII_FINANCIAL'
        WHEN column_name ~* 'encryption_?key|salt|hash|credential' THEN 'CRYPTO'
        ELSE 'OTHER'
    END AS sensitivity_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name ~* 'password|passwd|secret|token|api_?key|apikey|private_?key|access_?key|auth_?key|ssn|social_?security|credit_?card|card_?number|cvv|cvc|pin|encryption_?key|salt|hash|credential'
ORDER BY table_name, sensitivity_type;

-- Check who has access to tables with sensitive columns
SELECT
    tp.table_name, tp.grantee,
    string_agg(tp.privilege_type, ', ' ORDER BY tp.privilege_type) AS privileges,
    (SELECT string_agg(c.column_name, ', ')
     FROM information_schema.columns c
     WHERE c.table_schema = 'public' AND c.table_name = tp.table_name
       AND c.column_name ~* 'password|passwd|secret|token|api_?key|ssn|credit_?card|cvv|pin|hash|credential'
    ) AS sensitive_columns
FROM information_schema.table_privileges tp
WHERE tp.table_schema = 'public'
  AND tp.grantee IN ('anon', 'authenticated')
  AND EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = tp.table_name
        AND c.column_name ~* 'password|passwd|secret|token|api_?key|ssn|credit_?card|cvv|pin|hash|credential'
  )
GROUP BY tp.table_name, tp.grantee
ORDER BY tp.table_name, tp.grantee;
