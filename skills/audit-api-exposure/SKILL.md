---
name: audit-api-exposure
description: Audits the overall API attack surface of a Supabase project including exposed tables, data volume, and role grants. Use when user says "how much is exposed", "audit API surface", "what can anon access", or "too many tables visible". Generates read-only SQL for the Supabase SQL Editor.
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

- Everything in the `public` schema is exposed via the Supabase REST API
- More exposed tables = larger attack surface
- Tables with 10k+ rows may indicate overly permissive data access
- `anon` with DELETE/INSERT/UPDATE on any table is a red flag

### Step 3: Recommend Fixes

Based on findings, provide fixes from [references/fix-patterns.sql](references/fix-patterns.sql):
- Move internal tables to a `private` schema (removes from API)
- Revoke and re-grant selectively
- Use views to limit exposed columns

## Examples

**Example 1:** User says "I have 50 tables exposed, is that too many?"
- Run the summary counts and grants queries
- Identify tables that don't need public access
- Recommend moving internal tables to a private schema

**Example 2:** User says "What can anonymous users do in my project?"
- Run the anon grants query
- Show exactly which tables anon can SELECT, INSERT, UPDATE, DELETE

## Troubleshooting

**Row counts show 0 for all tables:**
- Run `ANALYZE` first to update statistics: `ANALYZE;`
