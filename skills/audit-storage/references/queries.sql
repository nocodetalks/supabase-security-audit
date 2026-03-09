-- Bucket status overview
SELECT
    id, name, public, file_size_limit, allowed_mime_types, created_at,
    CASE WHEN public = true THEN 'WARNING: Public' ELSE 'OK: Private' END AS status,
    CASE WHEN file_size_limit IS NULL THEN 'WARNING: No size limit' ELSE 'OK' END AS size_status,
    CASE WHEN allowed_mime_types IS NULL THEN 'WARNING: No MIME restriction' ELSE 'OK' END AS mime_status
FROM storage.buckets ORDER BY public DESC, name;

-- File counts per bucket
SELECT bucket_id, COUNT(*) AS file_count,
    pg_size_pretty(SUM(COALESCE((metadata->>'size')::bigint, 0))) AS total_size
FROM storage.objects GROUP BY bucket_id ORDER BY file_count DESC;

-- Storage RLS policies
SELECT policyname, tablename, permissive, roles::text, cmd,
    qual AS using_expression, with_check
FROM pg_policies WHERE schemaname = 'storage' ORDER BY tablename, policyname;

-- Buckets without any policies
SELECT b.id, b.name, b.public,
    'WARNING: No storage policies found' AS status
FROM storage.buckets b
WHERE NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'storage' AND p.tablename = 'objects'
      AND p.qual::text LIKE '%' || b.id || '%'
);
