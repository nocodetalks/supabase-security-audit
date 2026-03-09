---
name: audit-policies
description: Reviews existing RLS policies on Supabase tables for gaps and misconfigurations. Use when user says "review my policies", "check RLS policies", "find permissive policies", or "why can anon write to my table". Generates read-only SQL for the Supabase SQL Editor.
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

Help the user understand:
- `cmd` values: `r` = SELECT, `a` = INSERT, `w` = UPDATE, `d` = DELETE
- Policies with `USING (true)` on write operations are dangerous — anyone can write
- Good policies reference `auth.uid()` or `auth.role()` to scope access
- Tables without any policies but with RLS enabled block ALL access

### Step 3: Recommend Fix Patterns

Provide the appropriate pattern from [references/policy-patterns.sql](references/policy-patterns.sql) based on the user's needs.

## Examples

**Example 1:** User says "Why can anyone insert into my users table?"
- Run the permissive write policies query
- Likely shows a policy with `WITH CHECK (true)` on INSERT
- Recommend Pattern A (user-owned data) as replacement

**Example 2:** User says "I need admin-only access to a table"
- Recommend Pattern C (role-based) or Pattern E (deny all)

## Troubleshooting

**No policies returned:**
- Either RLS is not enabled (run `/audit-rls` first) or no policies have been created yet.

**Policy exists but access is still open:**
- Check if the policy is `permissive` (default). Multiple permissive policies are OR'd together — one `USING(true)` overrides stricter policies. Consider `RESTRICTIVE` policies instead.
