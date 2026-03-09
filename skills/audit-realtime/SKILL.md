---
name: audit-realtime
description: Audits Supabase Realtime subscriptions for data leaks including tables without RLS broadcasting changes. Use when user says "check Realtime security", "who can see my Realtime data", "audit subscriptions", or "Realtime leaking data". Generates read-only SQL for the Supabase SQL Editor.
metadata:
  author: PolicyCheck
  version: 1.0.0
---

## Critical

- Generate ONLY read-only SELECT queries. Never generate executable ALTER, DROP, CREATE, REVOKE, UPDATE, DELETE, or INSERT.
- All fixes go in a clearly labeled "Recommended Fix" section as reference SQL the user copies manually.

## Instructions

### Step 1: Provide the Audit Queries

Give the user the queries from [references/queries.sql](references/queries.sql) to paste into their Supabase SQL Editor.

### Step 2: Interpret Results

- Tables in Realtime without RLS broadcast ALL changes to ALL subscribers
- Realtime uses SELECT policies to filter — no SELECT policy means everything visible
- Sensitive columns in Realtime tables leak data on every INSERT/UPDATE
- Fewer tables in Realtime = smaller attack surface

### Step 3: Recommend Fixes

Based on findings, provide fixes from [references/fix-patterns.sql](references/fix-patterns.sql).

## Examples

**Example 1:** User says "Can everyone see all my Realtime updates?"
- Run the Realtime tables query
- If any table shows `rls_enabled = false`, explain that all changes broadcast to everyone
- Recommend enabling RLS and adding SELECT policies

**Example 2:** User says "I only need Realtime on my messages table"
- Run the count query to see all Realtime tables
- Recommend dropping all and re-adding only `messages`

## Troubleshooting

**No tables returned from publication query:**
- Realtime may not be enabled. Check Dashboard > Database > Replication.
