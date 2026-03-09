---
name: audit-storage
description: Audits Supabase storage buckets for public access, missing policies, and upload restrictions. Use when user says "check storage security", "are my buckets public", "audit file uploads", or "storage bucket exposed". Generates read-only SQL for the Supabase SQL Editor.
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

- Public buckets allow anyone to download files without authentication
- Buckets without size limits can be abused for unlimited uploads
- Missing MIME restrictions accept any file type including executables
- Buckets with no storage policies have no fine-grained access control

### Step 3: Recommend Fixes

Based on findings, provide the appropriate fix from [references/fix-patterns.sql](references/fix-patterns.sql).

## Examples

**Example 1:** User says "Is my avatars bucket secure?"
- Run the bucket status query
- Check if `public = true`, if size/MIME limits exist, if policies are defined
- Recommend making it private with user-scoped policies if it stores user uploads

**Example 2:** User says "Anyone can list files in my bucket"
- Explain that without storage policies, the bucket is listable
- Provide the user-scoped folder policy pattern

## Troubleshooting

**storage.buckets table not accessible:**
- User needs to run queries in the Supabase SQL Editor (postgres role), not via the REST API.

**Bucket shows as private but files are still accessible:**
- Check if there are permissive SELECT policies on `storage.objects` that bypass the bucket's private flag.
