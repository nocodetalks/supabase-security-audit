---
name: audit-auth
description: Audits Supabase authentication configuration including user status, MFA adoption, unconfirmed accounts, and auth hook security. Use when user says "check auth security", "MFA adoption", "unconfirmed users", "audit authentication", or "JWT security". Generates read-only SQL for the Supabase SQL Editor.
metadata:
  author: PolicyCheck
  version: 1.0.0
---

## Critical

- Generate ONLY read-only SELECT queries. Never generate executable ALTER, DROP, CREATE, REVOKE, UPDATE, DELETE, or INSERT.
- All fixes go in a clearly labeled "Recommended Fix" section. Dashboard actions are noted separately.

## Instructions

### Step 1: Provide the Audit Queries

Give the user the queries from [references/queries.sql](references/queries.sql) to paste into their Supabase SQL Editor.

### Step 2: Interpret Results

- Unconfirmed users may indicate disabled email verification
- Low MFA adoption means accounts rely on passwords alone
- Auth hook functions callable by anon could allow token manipulation
- service_role references in policies may indicate misconfigurations

### Step 3: Recommend Fixes

**Dashboard actions (not SQL):**
- Rotate JWT secret: Settings > API > JWT Settings > Generate new
- Require email confirmation: Authentication > Settings > Confirm email = ON
- Enable MFA: Authentication > Settings > MFA

**SQL fixes** from [references/fix-patterns.sql](references/fix-patterns.sql) for auth hook security.

## Examples

**Example 1:** User says "How many users haven't confirmed their email?"
- Run the unconfirmed users query
- If count is high, recommend enabling email confirmation in Dashboard

**Example 2:** User says "Is my service_role key safe?"
- Run the service_role policy query
- Remind: NEVER use service_role in client-side code. Search frontend for "service_role".

## Troubleshooting

**auth.users not accessible:**
- These queries require the Supabase SQL Editor. The auth schema is not exposed via REST API.
