-- Option 1: Revoke column-level SELECT
REVOKE SELECT (<column_name>) ON public.<table_name> FROM anon;
REVOKE SELECT (<column_name>) ON public.<table_name> FROM authenticated;

-- Option 2: Create a safe view excluding sensitive columns
CREATE OR REPLACE VIEW public.<table>_public AS
SELECT id, username, display_name, created_at
-- Intentionally EXCLUDING: password_hash, api_key, etc.
FROM public.<table>;
GRANT SELECT ON public.<table>_public TO anon;
REVOKE ALL ON public.<table> FROM anon;

-- Option 3: Mask data in a view
CREATE OR REPLACE VIEW public.<table>_safe AS
SELECT id,
    LEFT(email, 2) || '***@' || SPLIT_PART(email, '@', 2) AS email_masked,
    '***-***-' || RIGHT(phone, 4) AS phone_masked
FROM public.<table>;
