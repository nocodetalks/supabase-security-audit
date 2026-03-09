-- Move internal tables to private schema (removes from REST API)
CREATE SCHEMA IF NOT EXISTS private;
ALTER TABLE public.<internal_table> SET SCHEMA private;

-- Revoke and re-grant selectively
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT SELECT ON public.<public_table> TO anon;

-- Expose views instead of raw tables
CREATE VIEW public.<table>_public AS
SELECT id, name, description FROM public.<table> WHERE is_active = true;
GRANT SELECT ON public.<table>_public TO anon;
REVOKE ALL ON public.<table> FROM anon;
