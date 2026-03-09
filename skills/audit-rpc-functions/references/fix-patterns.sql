-- Revoke anon access from sensitive functions
REVOKE EXECUTE ON FUNCTION public.<function_name>(<args>) FROM anon;

-- Revoke all, then grant selectively
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
GRANT EXECUTE ON FUNCTION public.search_products(text) TO anon;

-- Add auth check inside function body
IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
END IF;

-- Fix SECURITY DEFINER search_path
CREATE OR REPLACE FUNCTION public.<name>()
RETURNS void LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$ ... $$;

-- Prefer SECURITY INVOKER when possible (respects RLS)
CREATE OR REPLACE FUNCTION public.<name>()
RETURNS void LANGUAGE sql SECURITY INVOKER
AS $$ ... $$;
