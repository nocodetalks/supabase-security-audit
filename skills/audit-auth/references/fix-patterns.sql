-- Secure auth hook functions (only supabase_auth_admin should call)
GRANT EXECUTE ON FUNCTION public.<hook_function> TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.<hook_function> FROM anon, authenticated;
