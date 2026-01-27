# User Flow Diagram: Logged-In User Mode

## Current Flow (Anonymous Mode)

```
User Input
  ├─ Project URL
  └─ Anon Key
       │
       ▼
[Analyze Security Button]
       │
       ▼
[Fetch OpenAPI Spec] ──(using anon key)──> Supabase API
       │
       ▼
[Parse Tables & Functions]
       │
       ▼
[Test Table Access] ──(using anon key)──> Supabase API
       │
       ▼
[Test RPC Functions] ──(using anon key)──> Supabase API
       │
       ▼
[Generate Report]
       │
       ▼
[Display Results]
```

## New Flow (Authenticated User Mode)

```
User Input
  ├─ Project URL
  ├─ Anon Key
  ├─ Email         (user-provided, existing account)
  └─ Password      (user-provided)
       │
       ▼
[Mode: Authenticated User Mode] (toggle selected)
       │
       ▼
[Analyze Security Button]
       │
       ▼
[Sign In] ──POST /auth/v1/token?grant_type=password──> Supabase Auth API
  Body: { email, password }
       │
       ├─ Success ──> Extract access_token
       └─ Error ──> Show "Invalid email or password" (or network/rate-limit msg)
       │
       ▼
[Store Auth Token]
       │
       ▼
[Fetch OpenAPI Spec] ──(using auth token)──> Supabase API
       │
       ▼
[Parse Tables & Functions]
       │
       ▼
[Test Table Access] ──(using auth token)──> Supabase API
       │
       ▼
[Test RPC Functions] ──(using auth token)──> Supabase API
       │
       ▼
[Generate Report (Authenticated Mode)]
       │
       ▼
[Display Results with Mode Badge]
```

## Comparison Mode Flow (Future Enhancement)

```
User Input
  ├─ Project URL
  ├─ Anon Key
  ├─ Email
  └─ Password
       │
       ▼
[Compare Modes Button]
       │
       ├─► [Anonymous Analysis] ──> [Report A]
       │
       └─► [Sign In] ──> [Authenticated Analysis] ──> [Report B]
       │
       ▼
[Compare Reports A & B]
       │
       ▼
[Generate Comparison Report]
       │
       ▼
[Display Side-by-Side Results]
```

## Mode Selection Flow

```
[Landing Page]
       │
       ▼
[Mode Selector]
       │
       ├─► Anonymous Mode (default)
       │      │
       │      └─► [Show: Project URL, Anon Key fields]
       │
       └─► Authenticated User Mode
              │
              └─► [Show: Project URL, Anon Key, Email, Password fields]
                   [Help: "Use an existing user account in your project"]
```

## Error Handling Flow

```
[Sign In Attempt]
       │
       ├─► Success ──> Continue to Analysis
       │
       ├─► Invalid email or password
       │      └─► [Show: "Invalid email or password. Check credentials and try again."]
       │
       ├─► Rate Limited
       │      └─► [Show: "Too many attempts. Please try again later."]
       │
       └─► Network Error
              └─► [Show: "Could not reach Supabase. Check your connection and try again."]
                    └─► [Retry button]
```

## Token Usage in API Calls

### Anonymous Mode
```javascript
Headers: {
  'apikey': anonKey,
  'Authorization': `Bearer ${anonKey}`
}
```

### Authenticated Mode
```javascript
Headers: {
  'apikey': anonKey,        // Still required by Supabase
  'Authorization': `Bearer ${authToken}`  // User's access token
}
```

## Report Structure Comparison

### Anonymous Report
```json
{
  "mode": "anonymous",
  "summary": { ... },
  "tables": [
    {
      "name": "users",
      "access": {
        "select": true,
        "insert": false,
        "update": false,
        "delete": false
      }
    }
  ]
}
```

### Authenticated Report
```json
{
  "mode": "authenticated",
  "authUser": {
    "email": "test@example.com",
    "id": "uuid-here"
  },
  "summary": { ... },
  "tables": [
    {
      "name": "users",
      "access": {
        "select": true,
        "insert": true,   // Different!
        "update": true,   // Different!
        "delete": false
      }
    }
  ]
}
```

## UI State Transitions

```
[Initial State]
  ├─ Mode: Anonymous
  ├─ Fields: Project URL, Anon Key
  └─ Button: "Analyze Security"
       │
       ▼ (User clicks "Authenticated Mode")
[Authenticated State]
  ├─ Mode: Authenticated
  ├─ Fields: Project URL, Anon Key, Email, Password
  ├─ Help: "Use an existing user account in your project"
  └─ Button: "Analyze Security" (triggers sign-in first)
       │
       ▼ (User clicks "Analyze Security")
[Signing In State]
  ├─ Loading: "Signing in..."
  └─ Button: Disabled
       │
       ▼ (Sign-in success)
[Analyzing State]
  ├─ Loading: "Fetching API specification...", "Testing N tables...", etc.
  └─ Token: Stored in memory
       │
       ▼ (Analysis complete)
[Results State]
  ├─ Mode Badge: "Authenticated User Analysis"
  ├─ User Info: "Logged in as: user@example.com"
  └─ Report: Full authenticated analysis
```

## Key Decision Points

1. **When to Signup?**
   - Option A: Signup immediately when "Analyze Security" is clicked
   - Option B: Separate "Signup" button, then "Analyze Security"
   - **Recommendation**: Option A (simpler UX)

2. **Token Storage?**
   - Option A: Memory only (cleared on page refresh)
   - Option B: SessionStorage (persists during session)
   - **Recommendation**: Option A (more secure)

3. **Account Cleanup?**
   - Option A: Auto-delete after analysis
   - Option B: Keep account, user can delete manually
   - Option C: No cleanup (test accounts remain)
   - **Recommendation**: Option B (safer, user control)

4. **Error Recovery?**
   - Option A: Show error, require manual retry
   - Option B: Auto-retry with exponential backoff
   - **Recommendation**: Option A (simpler, clearer)
