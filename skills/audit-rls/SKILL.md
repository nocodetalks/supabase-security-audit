---
name: audit-rls
description: Finds Supabase tables missing Row Level Security (RLS). Use when user says "check RLS", "are my tables secure", "find unprotected tables", or "audit table security". Generates read-only SQL queries for the Supabase SQL Editor.
metadata:
  author: PolicyCheck
  version: 1.0.0
---

## Critical

- Generate ONLY read-only SELECT queries. Never generate ALTER, DROP, CREATE, REVOKE, UPDATE, DELETE, or INSERT statements that execute directly.
- All fixes go in a clearly labeled "Recommended Fix" section as reference SQL the user copies and adapts manually.
- Queries are for the Supabase SQL Editor — you do not run them.

## Instructions

### Step 1: Provide the Audit Queries

Give the user the queries from [references/queries.sql](references/queries.sql) to paste into their Supabase SQL Editor.

### Step 2: Interpret Results

After the user runs the queries, help them understand:
- Tables with `rls_enabled = false` are fully exposed to anyone with the anon key
- Tables with RLS enabled but no policies block ALL access (may break the app)
- Every table with user data should have RLS enabled + policies

### Step 3: Recommend Fixes

For each unprotected table found, provide this template:

```sql
-- Replace <table_name> with actual table name
ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.<table_name> FORCE ROW LEVEL SECURITY;
-- Add policies immediately — without them, all access is blocked
```

Tell the user to run `/audit-policies` next to set up proper RLS policies.

## Examples

**Example 1:** User says "Are my Supabase tables secure?"
- Provide the RLS audit queries
- Highlight any tables with `rls_enabled = false`
- Explain the risk and provide the fix template

**Example 2:** User says "I enabled RLS but my app broke"
- Run the "RLS but no policies" query to find tables blocking all access
- Explain they need policies and point to `/audit-policies`

## Troubleshooting

**Query returns permission error:**
- User may be running with anon key. These queries require the Supabase SQL Editor (runs as postgres role).

**No tables returned:**
- All tables may already have RLS. Confirm with the full status query that shows both enabled and disabled tables.
