/**
 * Supabase Client Module
 * Handles all API interactions with Supabase
 */

const SupabaseClient = {
    /**
     * Fetch the OpenAPI specification from Supabase
     * @param {string} projectUrl - The Supabase project URL
     * @param {string} anonKey - The anon/publishable key
     * @returns {Promise<Object>} The OpenAPI spec
     */
    async fetchOpenAPISpec(projectUrl, anonKey) {
        const url = `${projectUrl}/rest/v1/`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'apikey': anonKey,
                'Authorization': `Bearer ${anonKey}`,
                'Accept': 'application/openapi+json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch OpenAPI spec: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    },

    /**
     * Test access to a specific table using safe, read-only methods
     * Uses OPTIONS and HEAD requests to check permissions without modifying data
     * @param {string} projectUrl - The Supabase project URL
     * @param {string} anonKey - The anon/publishable key
     * @param {string} tableName - Name of the table to test
     * @returns {Promise<Object>} Access test results
     */
    async testTableAccess(projectUrl, anonKey, tableName) {
        const baseUrl = `${projectUrl}/rest/v1/${tableName}`;
        const results = {
            select: false,
            insert: 'unknown',
            update: 'unknown',
            delete: 'unknown',
            rowCount: null,
            error: null
        };

        const headers = {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'count=exact'
        };

        // Test SELECT - this is safe (read-only)
        try {
            const selectResponse = await fetch(`${baseUrl}?limit=0`, {
                method: 'GET',
                headers: {
                    ...headers,
                    'Range': '0-0'
                }
            });

            results.select = selectResponse.ok || selectResponse.status === 416; // 416 = range not satisfiable (empty table)

            // Try to get row count from Content-Range header
            const contentRange = selectResponse.headers.get('Content-Range');
            if (contentRange) {
                const match = contentRange.match(/\/(\d+|\*)/);
                if (match && match[1] !== '*') {
                    results.rowCount = parseInt(match[1], 10);
                }
            }
        } catch (e) {
            results.select = false;
        }

        // Use OPTIONS request to check allowed methods (safe, no data modification)
        try {
            const optionsResponse = await fetch(baseUrl, {
                method: 'OPTIONS',
                headers: {
                    'apikey': anonKey,
                    'Authorization': `Bearer ${anonKey}`
                }
            });

            // Check Allow header or Access-Control-Allow-Methods
            const allowHeader = optionsResponse.headers.get('Allow') ||
                               optionsResponse.headers.get('Access-Control-Allow-Methods') || '';
            const allowedMethods = allowHeader.toUpperCase();

            // Determine permissions from OPTIONS response
            results.insert = allowedMethods.includes('POST');
            results.update = allowedMethods.includes('PATCH');
            results.delete = allowedMethods.includes('DELETE');
        } catch (e) {
            // OPTIONS not supported, permissions remain unknown
            results.error = 'Could not determine write permissions (OPTIONS not supported)';
        }

        return results;
    },

    /**
     * Attempt to query system catalogs for RLS information
     * @param {string} projectUrl - The Supabase project URL
     * @param {string} anonKey - The anon/publishable key
     * @returns {Promise<Object|null>} RLS policy info or null if not accessible
     */
    async queryRLSPolicies(projectUrl, anonKey) {
        const headers = {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json'
        };

        // Try to access pg_policies view
        try {
            const response = await fetch(`${projectUrl}/rest/v1/pg_policies?limit=100`, {
                method: 'GET',
                headers
            });

            if (response.ok) {
                return await response.json();
            }
        } catch (e) {
            // Not accessible
        }

        // Try RPC function if exists
        try {
            const response = await fetch(`${projectUrl}/rest/v1/rpc/get_policies`, {
                method: 'POST',
                headers,
                body: JSON.stringify({})
            });

            if (response.ok) {
                return await response.json();
            }
        } catch (e) {
            // Not accessible
        }

        return null;
    },

    /**
     * Test RPC function accessibility and auth requirements
     * @param {string} projectUrl - The Supabase project URL
     * @param {string} anonKey - The anon/publishable key
     * @param {string} functionName - Name of the RPC function
     * @returns {Promise<Object>} Function test results
     */
    async testRPCFunction(projectUrl, anonKey, functionName) {
        const url = `${projectUrl}/rest/v1/rpc/${functionName}`;
        const headers = {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json'
        };

        const result = {
            accessible: true,
            requiresAuth: false, // Default to public/no auth required
            error: null,
            testResponse: null
        };

        // Try calling the function with empty params to test auth
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({})
            });

            result.testResponse = response.status;

            // 401/403 means auth is required
            if (response.status === 401 || response.status === 403) {
                result.requiresAuth = true;
            } else if (response.status === 404) {
                // Function doesn't exist
                result.accessible = false;
                result.requiresAuth = 'unknown';
            } else {
                // 200, 400, 422 etc. = function is publicly accessible
                result.requiresAuth = false;
            }

        } catch (e) {
            // Network error or CORS issue
            result.error = e.message;
            result.requiresAuth = 'unknown';
        }

        return result;
    },

    /**
     * Get allowed HTTP methods for a resource
     * @param {string} projectUrl - The Supabase project URL
     * @param {string} anonKey - The anon/publishable key
     * @param {string} resource - The resource path (e.g., table name)
     * @returns {Promise<string[]>} Array of allowed methods
     */
    async getAllowedMethods(projectUrl, anonKey, resource) {
        const url = `${projectUrl}/rest/v1/${resource}`;

        try {
            const response = await fetch(url, {
                method: 'OPTIONS',
                headers: {
                    'apikey': anonKey,
                    'Authorization': `Bearer ${anonKey}`
                }
            });

            const allowHeader = response.headers.get('Allow') || response.headers.get('Access-Control-Allow-Methods');
            if (allowHeader) {
                return allowHeader.split(',').map(m => m.trim().toUpperCase());
            }
        } catch (e) {
            // OPTIONS might not be supported
        }

        return [];
    },

    /**
     * List storage buckets (if accessible)
     * @param {string} projectUrl - The Supabase project URL
     * @param {string} anonKey - The anon/publishable key
     * @returns {Promise<Array>} Array of bucket info
     */
    async listStorageBuckets(projectUrl, anonKey) {
        const url = `${projectUrl}/storage/v1/bucket`;
        const headers = {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`
        };

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers
            });

            if (response.ok) {
                const buckets = await response.json();
                return buckets;
            }
        } catch (e) {
            // Storage API not accessible
        }

        return [];
    },

    /**
     * Test storage bucket access
     * @param {string} projectUrl - The Supabase project URL
     * @param {string} anonKey - The anon/publishable key
     * @param {string} bucketId - Bucket ID to test
     * @returns {Promise<Object>} Bucket access results
     */
    async testBucketAccess(projectUrl, anonKey, bucketId) {
        const headers = {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`
        };

        const result = {
            canList: false,
            canUpload: 'unknown',
            canDelete: 'unknown',
            isPublic: false,
            fileCount: null
        };

        // Test listing files
        try {
            const listResponse = await fetch(`${projectUrl}/storage/v1/object/list/${bucketId}`, {
                method: 'POST',
                headers: {
                    ...headers,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ limit: 1, prefix: '' })
            });

            if (listResponse.ok) {
                result.canList = true;
                const files = await listResponse.json();
                result.fileCount = files.length;
            }
        } catch (e) {
            // Cannot list
        }

        // Test public access (try to access without auth)
        try {
            const publicResponse = await fetch(`${projectUrl}/storage/v1/object/public/${bucketId}/`, {
                method: 'GET'
            });
            result.isPublic = publicResponse.status !== 400 && publicResponse.status !== 404;
        } catch (e) {
            // Not public
        }

        return result;
    },

    /**
     * Fetch exact row count for a table
     * @param {string} projectUrl - The Supabase project URL
     * @param {string} anonKey - The anon/publishable key
     * @param {string} tableName - Name of the table
     * @returns {Promise<number|null>} Row count or null if not accessible
     */
    async fetchTableRowCount(projectUrl, anonKey, tableName) {
        const headers = {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`,
            'Prefer': 'count=exact'
        };

        try {
            // Use HEAD request with count=exact to get total count without fetching data
            const response = await fetch(`${projectUrl}/rest/v1/${tableName}?select=*`, {
                method: 'HEAD',
                headers
            });

            if (response.ok || response.status === 206) {
                const contentRange = response.headers.get('Content-Range');
                if (contentRange) {
                    // Format: "0-24/1234" or "*/1234" for empty ranges
                    const match = contentRange.match(/\/(\d+)/);
                    if (match) {
                        return parseInt(match[1], 10);
                    }
                }
            }

            // Fallback: try GET with limit=0
            const fallbackResponse = await fetch(`${projectUrl}/rest/v1/${tableName}?select=*&limit=0`, {
                method: 'GET',
                headers
            });

            if (fallbackResponse.ok) {
                const contentRange = fallbackResponse.headers.get('Content-Range');
                if (contentRange) {
                    const match = contentRange.match(/\/(\d+)/);
                    if (match) {
                        return parseInt(match[1], 10);
                    }
                }
            }
        } catch (e) {
            // Count not available
        }

        return null;
    },

    /**
     * Check realtime configuration
     * @param {string} projectUrl - The Supabase project URL
     * @param {string} anonKey - The anon/publishable key
     * @returns {Promise<Object>} Realtime configuration info
     */
    async checkRealtimeConfig(projectUrl, anonKey) {
        // Realtime endpoint typically doesn't support CORS from browsers
        // So we just return unknown status - this is expected behavior
        return {
            enabled: 'unknown',
            accessibleTables: [],
            note: 'Realtime endpoint check skipped (CORS restriction)'
        };
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SupabaseClient;
}
