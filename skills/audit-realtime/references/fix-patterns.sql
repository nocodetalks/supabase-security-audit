-- Remove a table from Realtime
ALTER PUBLICATION supabase_realtime DROP TABLE public.<table_name>;

-- Remove all, re-add selectively
ALTER PUBLICATION supabase_realtime DROP ALL TABLES;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Enable RLS on Realtime tables (users only receive rows they can SELECT)
ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;

-- Limit columns broadcast (PostgreSQL 15+)
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders (id, status, updated_at);
