---
name: audit-rpc-functions
description: Audits Supabase RPC functions for security risks including anon access, SECURITY DEFINER issues, and search_path vulnerabilities. Use when user says "check my functions", "which functions can anon call", "audit RPC security", or "SECURITY DEFINER risk". Generates read-only SQL for the Supabase SQL Editor.
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

- Functions callable by `anon` are accessible to anyone with the anon key
- `SECURITY DEFINER` functions run as the owner — they bypass RLS
- SECURITY DEFINER without `search_path` is vulnerable to search_path hijacking
- Destructive names (delete, drop, truncate) callable by anon = critical risk

### Step 3: Recommend Fixes

Based on findings, provide the appropriate fix from [references/fix-patterns.sql](references/fix-patterns.sql).

## Examples

**Example 1:** User says "Can anonymous users call my delete function?"
- Run the anon permissions query
- If the function shows `anon_can_execute = YES`, explain the risk
- Recommend REVOKE EXECUTE from anon

**Example 2:** User says "Is my SECURITY DEFINER function safe?"
- Run the SECURITY DEFINER audit query
- Check for missing search_path (critical vulnerability)
- Recommend adding `SET search_path = public` and switching to SECURITY INVOKER if possible

## Troubleshooting

**has_function_privilege returns errors:**
- The function may not exist or the role name may differ. Verify role names with `SELECT rolname FROM pg_roles`.
