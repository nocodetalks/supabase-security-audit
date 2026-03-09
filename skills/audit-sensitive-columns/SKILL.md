---
name: audit-sensitive-columns
description: Finds exposed sensitive columns like passwords, tokens, API keys, SSNs, and credit card numbers in Supabase tables. Use when user says "check for PII", "sensitive data exposed", "are passwords visible", or "audit column security". Generates read-only SQL for the Supabase SQL Editor.
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

- Any sensitive column in a `public` schema table is exposed via the REST API
- If `anon` has SELECT on a table with password/token columns, anyone can read them
- Sensitivity types found: PASSWORD, SECRET, TOKEN, API_KEY, PII_SSN, PII_FINANCIAL, CRYPTO

### Step 3: Recommend Fixes

Based on findings, provide the appropriate fix from [references/fix-patterns.sql](references/fix-patterns.sql):
- **Column revoke** — quickest, removes SELECT on specific columns
- **Safe view** — exposes only non-sensitive columns
- **Masked view** — shows partial data (e.g., `j***@email.com`)

## Examples

**Example 1:** User says "Can anyone see user passwords?"
- Run the sensitive columns query
- If `password_hash` appears with anon SELECT access, explain the risk
- Recommend column-level REVOKE or a safe view

**Example 2:** User says "We store credit card numbers, is that exposed?"
- Run both queries to find the column and check who has access
- Recommend encryption at rest if storing card data

## Troubleshooting

**No results returned:**
- No columns match the sensitive name patterns. This doesn't mean data is safe — columns with non-standard names (e.g., `cc_num`) won't be caught. Review manually.
