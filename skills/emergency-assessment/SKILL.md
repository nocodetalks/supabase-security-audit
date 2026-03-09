---
name: emergency-assessment
description: Emergency security assessment for a potentially compromised Supabase project. Use ONLY when user says "I think I've been hacked", "breach assessment", "credentials leaked", or "emergency security check". Provides read-only assessment queries and a manual response plan. Do NOT use for routine audits.
disable-model-invocation: true
metadata:
  author: PolicyCheck
  version: 1.0.0
---

## Critical

- This is an emergency skill. Be direct and organized. No preamble.
- Generate ONLY read-only SELECT queries for assessment.
- All response actions go in a "Response Plan" section as manual steps the user follows themselves. Never execute lockdown actions.

## Instructions

### Step 1: Provide Assessment Queries

Give the user the queries from [references/assessment.sql](references/assessment.sql) to run immediately in the Supabase SQL Editor.

### Step 2: Analyze Results

Help the user identify:
- Suspicious recent signups or sign-ins (unusual IPs, bulk creation)
- Users with unexpected elevated roles (privilege escalation)
- Unprotected tables and permissive policies (exploit paths)
- Public storage buckets (data exfiltration)
- Anon-callable destructive functions

### Step 3: Provide Response Plan

Present this manual response plan in order:

**Phase 1: Contain (Supabase Dashboard — do immediately)**
1. Settings > API > Regenerate anon key
2. Settings > API > Regenerate service_role key
3. Settings > API > Generate new JWT secret (invalidates all sessions)
4. Settings > Database > Reset database password

**Phase 2: Lock Down (SQL the user runs manually)**
- Provide lockdown SQL from [references/lockdown.sql](references/lockdown.sql)

**Phase 3: Recover**
1. Update all environment variables with new keys
2. Redeploy the application
3. Selectively restore access table by table
4. Ban suspicious user accounts
5. Run `/full-security-audit` to verify

## Troubleshooting

**auth.audit_log_entries is empty:**
- Audit logging may not be enabled. Check Dashboard > Authentication > Settings.

**User can't access Supabase Dashboard:**
- If dashboard credentials are compromised, contact Supabase support immediately.
