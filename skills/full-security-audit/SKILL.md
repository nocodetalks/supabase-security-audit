---
name: full-security-audit
description: Runs a comprehensive Supabase security audit covering RLS, policies, sensitive columns, storage, functions, API exposure, auth, and Realtime in one script. Use when user says "full security audit", "check everything", "security posture", or "complete Supabase audit". Generates a single read-only SQL script for the Supabase SQL Editor.
metadata:
  author: PolicyCheck
  version: 1.0.0
---

## Critical

- Generate ONLY the single comprehensive audit script. No executable ALTER, DROP, CREATE, REVOKE, UPDATE, DELETE, or INSERT.
- This is audit-only. All results are informational.
- Take your time to explain each section thoroughly.

## Instructions

### Step 1: Provide the Full Audit Script

Give the user the complete script from [references/full-audit.sql](references/full-audit.sql) to paste into their Supabase SQL Editor.

### Step 2: Interpret Each Section

Walk through results section by section:
1. **Tables without RLS** — Most critical. Every table listed needs RLS enabled.
2. **RLS but no policies** — Blocks all access, may break the app.
3. **Permissive write policies** — `USING(true)` on writes is dangerous.
4. **Sensitive columns** — PII/secrets exposed via the API.
5. **Anon permissions** — What anonymous users can do. DELETE/INSERT = critical.
6. **Anon functions** — Functions callable without authentication.
7. **Security definer** — Elevated-privilege functions. Missing search_path = critical.
8. **Storage** — Public buckets, missing limits.
9. **Storage policies** — How storage access is controlled.
10. **Realtime** — Tables broadcasting without RLS.
11. **Data volume** — Large tables increase breach impact.
12. **Auth** — Unconfirmed users, weak verification.
13. **Summary** — Overall scorecard.

### Step 3: Direct to Specific Skills

For each area that needs fixing, point the user to the specific skill:
- RLS issues: `/audit-rls` and `/audit-policies`
- Sensitive data: `/audit-sensitive-columns`
- Storage: `/audit-storage`
- Functions: `/audit-rpc-functions`
- API surface: `/audit-api-exposure`
- Auth: `/audit-auth`
- Realtime: `/audit-realtime`

## Examples

**Example 1:** User says "Give me a complete security check"
- Provide the full audit script
- After results, summarize: "X critical, Y high, Z medium issues found"
- Prioritize which skills to run next

## Troubleshooting

**Script errors on a specific section:**
- Some sections (e.g., storage, auth) may fail if those features aren't used. The user can comment out those sections and re-run.
