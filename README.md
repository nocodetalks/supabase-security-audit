# PolicyCheck

A client-side web application that analyzes Supabase project security using only the project URL and anon/publishable key.

## Features

- **Public Tables Discovery**: Lists all tables/views exposed to the anon key with column details
- **RPC Functions Analysis**: Shows exposed functions with parameters and return types
- **Security Issue Detection**: Identifies potential security vulnerabilities
- **Risk Scoring**: Calculates an overall risk score based on findings
- **Export Options**: Copy results as JSON or download full report

## Security Checks Performed

1. **Unrestricted Operations**: Flags tables allowing INSERT, UPDATE, or DELETE with anon key
2. **Sensitive Column Exposure**: Detects columns with names like password, token, api_key, etc.
3. **Large Data Exposure**: Warns when tables expose many rows publicly
4. **Sensitive RPC Functions**: Identifies functions that perform potentially dangerous operations
5. **Excessive Public Endpoints**: Notes when many tables/functions are publicly accessible

## Usage

1. Open `index.html` in a web browser
2. Enter your Supabase project URL (e.g., `https://your-project.supabase.co`)
3. Enter your anon/publishable key
4. Click "Analyze Security"
5. Review the results and address any security issues

## File Structure

```
/
├── index.html              # Main HTML structure
├── css/
│   └── styles.css          # Custom styles (TailwindCSS via CDN)
├── js/
│   ├── app.js              # Main application logic
│   ├── supabase-client.js  # Supabase API interactions
│   ├── analyzer.js         # Security analysis logic
│   └── ui.js               # UI rendering functions
└── README.md               # This file
```

## Privacy & Security

- **All processing is client-side**: Your keys are never sent to any third-party server
- **No data storage**: Nothing is persisted between sessions
- **HTTPS required**: Only HTTPS Supabase URLs are accepted

## Limitations

1. **Edge Functions**: Cannot be discovered with anon key (requires Management API with service_role key)
2. **RLS Policy Details**: May not be accessible with anon key - some checks are heuristic-based
3. **Server-side Measures**: Cannot detect custom middleware or server-side security measures
4. **Heuristic Detection**: Some security assessments are based on naming patterns and may have false positives

## Risk Levels

- **Critical** (25 points): Unrestricted DELETE operations, no RLS on sensitive data
- **High** (15 points): Unrestricted INSERT/UPDATE operations, sensitive RPC functions
- **Medium** (8 points): Exposed sensitive column names
- **Low** (3 points): Large number of public endpoints, many exposed rows

## API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `GET /rest/v1/` | Fetch OpenAPI spec with tables/functions |
| `GET /rest/v1/{table}?limit=0` | Test table SELECT access |
| `POST /rest/v1/{table}` | Test table INSERT access |
| `PATCH /rest/v1/{table}` | Test table UPDATE access |
| `DELETE /rest/v1/{table}` | Test table DELETE access |
| `POST /rest/v1/rpc/{function}` | Test RPC function access |

## Browser Compatibility

Works in all modern browsers (Chrome, Firefox, Safari, Edge). Requires JavaScript enabled.

## License

MIT
