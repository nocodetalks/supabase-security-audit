/**
 * Security Analyzer Module
 * Parses OpenAPI spec and analyzes security issues
 */

const Analyzer = {
    // Sensitive column name patterns
    SENSITIVE_PATTERNS: [
        /password/i,
        /passwd/i,
        /secret/i,
        /token/i,
        /api_?key/i,
        /apikey/i,
        /private_?key/i,
        /access_?key/i,
        /auth_?key/i,
        /ssn/i,
        /social_?security/i,
        /credit_?card/i,
        /card_?number/i,
        /cvv/i,
        /cvc/i,
        /pin/i,
        /encryption_?key/i,
        /salt/i,
        /hash/i,
        /credential/i
    ],

    // Auth-related patterns that suggest RLS might be in use
    AUTH_PATTERNS: [
        /auth\.uid/i,
        /auth\.role/i,
        /current_user/i,
        /session_user/i
    ],

    /**
     * Decode JWT token (anon key)
     * @param {string} token - JWT token
     * @returns {Object} Decoded token info
     */
    decodeJWT(token) {
        const result = {
            valid: false,
            header: null,
            payload: null,
            expiresAt: null,
            isExpired: false,
            role: null,
            issuer: null,
            projectRef: null,
            error: null
        };

        try {
            const parts = token.split('.');
            if (parts.length !== 3) {
                result.error = 'Invalid JWT format';
                return result;
            }

            // Decode header
            const header = JSON.parse(atob(parts[0]));
            result.header = header;

            // Decode payload
            const payload = JSON.parse(atob(parts[1]));
            result.payload = payload;
            result.valid = true;

            // Extract useful info
            result.role = payload.role || 'anon';
            result.issuer = payload.iss || null;

            // Extract project ref from issuer
            if (payload.iss) {
                const match = payload.iss.match(/https:\/\/([^.]+)\.supabase\.co/);
                if (match) {
                    result.projectRef = match[1];
                }
            }

            // Check expiration
            if (payload.exp) {
                result.expiresAt = new Date(payload.exp * 1000);
                result.isExpired = result.expiresAt < new Date();
            }

        } catch (e) {
            result.error = 'Failed to decode JWT: ' + e.message;
        }

        return result;
    },

    /**
     * Parse OpenAPI spec to extract tables and their schemas
     * @param {Object} spec - OpenAPI specification
     * @returns {Object} Parsed data with tables and functions
     */
    parseOpenAPISpec(spec) {
        const result = {
            tables: [],
            functions: [],
            rawSpec: spec
        };

        if (!spec || !spec.paths) {
            return result;
        }

        // Extract tables from paths
        for (const [path, methods] of Object.entries(spec.paths)) {
            // Skip RPC functions for now
            if (path.startsWith('/rpc/')) {
                continue;
            }

            // Table path format: /{tableName}
            const tableName = path.replace(/^\//, '').replace(/\/$/, '');
            if (!tableName || tableName.includes('/')) {
                continue;
            }

            const table = {
                name: tableName,
                columns: [],
                operations: [],
                description: ''
            };

            // Extract operations
            for (const [method, details] of Object.entries(methods)) {
                const op = method.toUpperCase();
                if (['GET', 'POST', 'PATCH', 'DELETE'].includes(op)) {
                    table.operations.push({
                        method: op,
                        description: details.description || details.summary || ''
                    });
                }

                // Extract columns from GET response schema or POST request body
                if (details.parameters) {
                    for (const param of details.parameters) {
                        if (param.in === 'query' && param.name && !param.name.startsWith('select') &&
                            !param.name.startsWith('order') && !param.name.startsWith('limit') &&
                            !param.name.startsWith('offset') && !param.name.startsWith('on_conflict')) {

                            // Check if column already exists
                            if (!table.columns.find(c => c.name === param.name)) {
                                table.columns.push({
                                    name: param.name,
                                    type: param.schema?.type || param.schema?.format || 'unknown',
                                    format: param.schema?.format || null,
                                    description: param.description || ''
                                });
                            }
                        }
                    }
                }
            }

            // Also try to get columns from definitions/schemas
            const schemaName = spec.definitions?.[tableName] ? tableName : null;
            if (schemaName && spec.definitions[schemaName]?.properties) {
                for (const [colName, colSchema] of Object.entries(spec.definitions[schemaName].properties)) {
                    if (!table.columns.find(c => c.name === colName)) {
                        table.columns.push({
                            name: colName,
                            type: colSchema.type || 'unknown',
                            format: colSchema.format || null,
                            description: colSchema.description || '',
                            primaryKey: spec.definitions[schemaName].required?.includes(colName) || false
                        });
                    }
                }
            }

            if (table.operations.length > 0) {
                result.tables.push(table);
            }
        }

        // Extract RPC functions
        for (const [path, methods] of Object.entries(spec.paths)) {
            if (!path.startsWith('/rpc/')) {
                continue;
            }

            const functionName = path.replace('/rpc/', '');
            const postMethod = methods.post || methods.get;

            if (!postMethod) {
                continue;
            }

            const func = {
                name: functionName,
                description: postMethod.description || postMethod.summary || '',
                parameters: [],
                returnType: 'void'
            };

            // Extract parameters from request body schema
            if (postMethod.parameters) {
                for (const param of postMethod.parameters) {
                    if (param.in === 'body' && param.schema?.properties) {
                        for (const [paramName, paramSchema] of Object.entries(param.schema.properties)) {
                            func.parameters.push({
                                name: paramName,
                                type: paramSchema.type || paramSchema.format || 'any',
                                format: paramSchema.format || null,
                                required: param.schema.required?.includes(paramName) || false,
                                description: paramSchema.description || ''
                            });
                        }
                    }
                }
            }

            // Try to get return type from response schema
            if (postMethod.responses?.['200']?.schema) {
                const responseSchema = postMethod.responses['200'].schema;
                if (responseSchema.$ref) {
                    // Extract type name from $ref like "#/definitions/typename"
                    const refMatch = responseSchema.$ref.match(/\/([^/]+)$/);
                    func.returnType = refMatch ? refMatch[1] : 'object';
                } else if (responseSchema.type === 'array' && responseSchema.items) {
                    const itemType = responseSchema.items.$ref
                        ? responseSchema.items.$ref.match(/\/([^/]+)$/)?.[1] || 'object'
                        : responseSchema.items.type || 'any';
                    func.returnType = `${itemType}[]`;
                } else if (responseSchema.type) {
                    func.returnType = responseSchema.type;
                } else {
                    func.returnType = 'json';
                }
            }

            result.functions.push(func);
        }

        return result;
    },

    /**
     * Detect sensitive columns in a table
     * @param {Array} columns - Array of column objects
     * @returns {Array} Array of sensitive column names
     */
    detectSensitiveColumns(columns) {
        const sensitive = [];

        for (const col of columns) {
            for (const pattern of this.SENSITIVE_PATTERNS) {
                if (pattern.test(col.name)) {
                    sensitive.push({
                        column: col.name,
                        pattern: pattern.toString(),
                        type: col.type
                    });
                    break;
                }
            }
        }

        return sensitive;
    },

    /**
     * Analyze table security and generate issues
     * @param {Object} table - Table object with columns and operations
     * @param {Object} accessResults - Results from testTableAccess
     * @returns {Array} Array of security issues
     */
    analyzeTableSecurity(table, accessResults) {
        const issues = [];

        // Check for sensitive columns
        const sensitiveColumns = this.detectSensitiveColumns(table.columns);
        if (sensitiveColumns.length > 0) {
            issues.push({
                severity: 'medium',
                type: 'sensitive_columns',
                table: table.name,
                message: `Table "${table.name}" exposes potentially sensitive columns: ${sensitiveColumns.map(c => c.column).join(', ')}`,
                details: sensitiveColumns
            });
        }

        // Check for unrestricted write operations
        // Note: true means allowed, false means denied, 'unknown' means we couldn't determine
        if (accessResults?.insert === true) {
            issues.push({
                severity: 'high',
                type: 'unrestricted_insert',
                table: table.name,
                message: `Table "${table.name}" allows INSERT operations with anon key`,
                recommendation: 'Consider adding RLS policies to restrict INSERT access'
            });
        }

        if (accessResults?.update === true) {
            issues.push({
                severity: 'high',
                type: 'unrestricted_update',
                table: table.name,
                message: `Table "${table.name}" allows UPDATE operations with anon key`,
                recommendation: 'Consider adding RLS policies to restrict UPDATE access'
            });
        }

        if (accessResults?.delete === true) {
            issues.push({
                severity: 'critical',
                type: 'unrestricted_delete',
                table: table.name,
                message: `Table "${table.name}" allows DELETE operations with anon key`,
                recommendation: 'Strongly consider adding RLS policies to restrict DELETE access'
            });
        }

        // Check if table has many rows exposed
        if (accessResults?.rowCount !== null && accessResults.rowCount > 10000) {
            issues.push({
                severity: 'low',
                type: 'large_exposure',
                table: table.name,
                message: `Table "${table.name}" exposes ${accessResults.rowCount.toLocaleString()} rows to anon users`,
                recommendation: 'Consider if all this data needs to be publicly accessible'
            });
        }

        return issues;
    },

    /**
     * Analyze RPC function security
     * @param {Object} func - Function object
     * @param {Object} testResults - Results from testRPCFunction
     * @returns {Array} Array of security issues
     */
    analyzeFunctionSecurity(func, testResults) {
        const issues = [];

        // Function is accessible if it appears in the OpenAPI spec
        if (testResults?.accessible) {
            // Check if function name suggests sensitive operation
            const sensitiveOps = [/delete/i, /drop/i, /truncate/i, /admin/i, /update/i, /insert/i, /create/i];

            for (const pattern of sensitiveOps) {
                if (pattern.test(func.name)) {
                    issues.push({
                        severity: 'medium', // Lowered from high since we can't confirm it's actually callable
                        type: 'sensitive_function',
                        function: func.name,
                        message: `RPC function "${func.name}" appears to perform sensitive operations and is exposed in the API`,
                        recommendation: 'Verify this function has proper authentication checks'
                    });
                    break;
                }
            }
        }

        return issues;
    },

    /**
     * Analyze storage bucket security
     * @param {Object} bucket - Bucket info
     * @param {Object} accessResults - Results from testBucketAccess
     * @returns {Array} Array of security issues
     */
    analyzeBucketSecurity(bucket, accessResults) {
        const issues = [];

        if (bucket.public || accessResults?.isPublic) {
            issues.push({
                severity: 'medium',
                type: 'public_bucket',
                bucket: bucket.name || bucket.id,
                message: `Storage bucket "${bucket.name || bucket.id}" is publicly accessible`,
                recommendation: 'Review if this bucket should be public. Consider restricting access.'
            });
        }

        if (accessResults?.canList) {
            issues.push({
                severity: 'low',
                type: 'bucket_listable',
                bucket: bucket.name || bucket.id,
                message: `Storage bucket "${bucket.name || bucket.id}" allows listing files with anon key`,
                recommendation: 'Consider restricting list access if not needed'
            });
        }

        return issues;
    },

    /**
     * Calculate overall risk score
     * @param {Array} issues - Array of all security issues
     * @returns {Object} Risk score and breakdown
     */
    calculateRiskScore(issues) {
        const weights = {
            critical: 25,
            high: 15,
            medium: 8,
            low: 3
        };

        let totalScore = 0;
        const breakdown = {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0
        };

        for (const issue of issues) {
            breakdown[issue.severity]++;
            totalScore += weights[issue.severity] || 0;
        }

        // Normalize to 0-100 scale (higher = worse)
        // Cap at 100
        const normalizedScore = Math.min(100, totalScore);

        // Determine risk level
        let riskLevel;
        if (breakdown.critical > 0 || normalizedScore >= 75) {
            riskLevel = 'critical';
        } else if (breakdown.high > 0 || normalizedScore >= 50) {
            riskLevel = 'high';
        } else if (breakdown.medium > 0 || normalizedScore >= 25) {
            riskLevel = 'medium';
        } else {
            riskLevel = 'low';
        }

        return {
            score: normalizedScore,
            riskLevel,
            breakdown,
            totalIssues: issues.length
        };
    },

    /**
     * Generate remediation code for issues
     * @param {Array} issues - Array of security issues
     * @param {Array} tables - Array of table objects
     * @returns {Array} Array of remediation suggestions with code
     */
    generateRemediations(issues, tables) {
        const remediations = [];

        // Group issues by table
        const tableIssues = {};
        for (const issue of issues) {
            if (issue.table) {
                if (!tableIssues[issue.table]) {
                    tableIssues[issue.table] = [];
                }
                tableIssues[issue.table].push(issue);
            }
        }

        // Generate RLS enable code for each table with issues
        for (const [tableName, tableIssueList] of Object.entries(tableIssues)) {
            const hasWriteIssue = tableIssueList.some(i =>
                ['unrestricted_insert', 'unrestricted_update', 'unrestricted_delete'].includes(i.type)
            );

            if (hasWriteIssue) {
                remediations.push({
                    title: `Enable RLS on "${tableName}"`,
                    description: 'Enable Row Level Security and add restrictive policies',
                    severity: 'high',
                    code: `-- Enable RLS on the table
ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;

-- Create a policy that denies all access by default
CREATE POLICY "Deny all access" ON ${tableName}
    FOR ALL
    USING (false);

-- OR create a policy that only allows authenticated users to access their own data
CREATE POLICY "Users can access own data" ON ${tableName}
    FOR ALL
    USING (auth.uid() = user_id);`,
                    language: 'sql'
                });
            }

            const hasSensitiveColumns = tableIssueList.some(i => i.type === 'sensitive_columns');
            if (hasSensitiveColumns) {
                const sensitiveIssue = tableIssueList.find(i => i.type === 'sensitive_columns');
                const columns = sensitiveIssue?.details?.map(d => d.column) || [];

                remediations.push({
                    title: `Hide sensitive columns in "${tableName}"`,
                    description: 'Create a view that excludes sensitive columns for public access',
                    severity: 'medium',
                    code: `-- Option 1: Create a view without sensitive columns
CREATE VIEW ${tableName}_public AS
SELECT ${tables.find(t => t.name === tableName)?.columns
    .filter(c => !columns.includes(c.name))
    .map(c => c.name)
    .join(', ') || '*'}
FROM ${tableName};

-- Option 2: Use column-level security (Supabase)
-- Revoke SELECT on specific columns
REVOKE SELECT (${columns.join(', ')}) ON ${tableName} FROM anon;`,
                    language: 'sql'
                });
            }
        }

        // General RLS template
        if (Object.keys(tableIssues).length > 0) {
            remediations.push({
                title: 'RLS Policy Templates',
                description: 'Common RLS policy patterns you can use',
                severity: 'info',
                code: `-- Allow public read access
CREATE POLICY "Public read access" ON table_name
    FOR SELECT USING (true);

-- Allow authenticated users to insert their own data
CREATE POLICY "Users can insert own data" ON table_name
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to update only their own data
CREATE POLICY "Users can update own data" ON table_name
    FOR UPDATE USING (auth.uid() = user_id);

-- Allow users to delete only their own data
CREATE POLICY "Users can delete own data" ON table_name
    FOR DELETE USING (auth.uid() = user_id);

-- Role-based access (e.g., admin only)
CREATE POLICY "Admin only" ON table_name
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');`,
                language: 'sql'
            });
        }

        return remediations;
    },

    /**
     * Generate security checklist
     * @param {Object} report - Full security report
     * @returns {Array} Array of checklist items
     */
    generateSecurityChecklist(report) {
        const checklist = [];

        // RLS enabled check
        const tablesWithWriteAccess = report.tables.filter(t =>
            t.access?.insert === true || t.access?.update === true || t.access?.delete === true
        );
        checklist.push({
            id: 'rls_enabled',
            title: 'Enable RLS on all tables',
            description: 'Row Level Security should be enabled on all tables that contain user data',
            status: tablesWithWriteAccess.length === 0 ? 'pass' : 'fail',
            details: tablesWithWriteAccess.length > 0
                ? `${tablesWithWriteAccess.length} table(s) allow write operations: ${tablesWithWriteAccess.map(t => t.name).join(', ')}`
                : 'No tables allow unrestricted write access'
        });

        // Sensitive data exposure check
        const tablesWithSensitiveData = report.tables.filter(t => t.sensitiveColumns?.length > 0);
        checklist.push({
            id: 'sensitive_data',
            title: 'Protect sensitive columns',
            description: 'Columns containing passwords, tokens, or PII should not be exposed',
            status: tablesWithSensitiveData.length === 0 ? 'pass' : 'warn',
            details: tablesWithSensitiveData.length > 0
                ? `${tablesWithSensitiveData.length} table(s) expose sensitive columns`
                : 'No sensitive columns detected'
        });

        // JWT expiration check
        if (report.jwtInfo) {
            checklist.push({
                id: 'jwt_valid',
                title: 'Valid JWT token',
                description: 'The anon key should be a valid, non-expired JWT',
                status: report.jwtInfo.valid && !report.jwtInfo.isExpired ? 'pass' : 'fail',
                details: report.jwtInfo.isExpired
                    ? `Token expired on ${report.jwtInfo.expiresAt?.toLocaleDateString()}`
                    : report.jwtInfo.valid
                        ? 'Token is valid'
                        : 'Token is invalid'
            });
        }

        // Storage buckets check
        const publicBuckets = report.buckets?.filter(b => b.public || b.access?.isPublic) || [];
        checklist.push({
            id: 'storage_private',
            title: 'Review public storage buckets',
            description: 'Public buckets allow anyone to access files without authentication',
            status: publicBuckets.length === 0 ? 'pass' : 'warn',
            details: publicBuckets.length > 0
                ? `${publicBuckets.length} public bucket(s) found`
                : 'No public buckets or storage not accessible'
        });

        // Function exposure check
        const exposedFunctions = report.functions?.length || 0;
        checklist.push({
            id: 'function_exposure',
            title: 'Review exposed RPC functions',
            description: 'RPC functions should have proper authentication checks',
            status: exposedFunctions === 0 ? 'pass' : exposedFunctions > 10 ? 'warn' : 'info',
            details: `${exposedFunctions} RPC function(s) exposed to anon key`
        });

        // Table count check
        const tableCount = report.tables?.length || 0;
        checklist.push({
            id: 'table_exposure',
            title: 'Minimize table exposure',
            description: 'Only expose tables that need public access',
            status: tableCount <= 5 ? 'pass' : tableCount <= 15 ? 'info' : 'warn',
            details: `${tableCount} table(s) exposed to anon key`
        });

        // Data volume check
        const totalRows = report.tables?.reduce((sum, t) => sum + (t.access?.rowCount || 0), 0) || 0;
        checklist.push({
            id: 'data_volume',
            title: 'Review data exposure volume',
            description: 'Large amounts of exposed data may indicate overly permissive policies',
            status: totalRows < 1000 ? 'pass' : totalRows < 100000 ? 'info' : 'warn',
            details: `~${totalRows.toLocaleString()} total rows accessible`
        });

        return checklist;
    },

    /**
     * Calculate data exposure summary
     * @param {Array} tables - Array of table objects with access info
     * @returns {Object} Data exposure summary
     */
    calculateDataExposure(tables) {
        const exposure = {
            totalTables: tables.length,
            totalRows: 0,
            totalColumns: 0,
            tablesWithRowCount: 0,
            largestTables: [],
            sensitiveDataTables: [],
            writeAccessTables: []
        };

        for (const table of tables) {
            exposure.totalColumns += table.columns?.length || 0;

            if (table.access?.rowCount !== null && table.access?.rowCount !== undefined) {
                exposure.totalRows += table.access.rowCount;
                exposure.tablesWithRowCount++;
                exposure.largestTables.push({
                    name: table.name,
                    rowCount: table.access.rowCount
                });
            }

            if (table.sensitiveColumns?.length > 0) {
                exposure.sensitiveDataTables.push({
                    name: table.name,
                    sensitiveColumns: table.sensitiveColumns.map(c => c.column)
                });
            }

            if (table.access?.insert === true || table.access?.update === true || table.access?.delete === true) {
                exposure.writeAccessTables.push({
                    name: table.name,
                    canInsert: table.access.insert === true,
                    canUpdate: table.access.update === true,
                    canDelete: table.access.delete === true
                });
            }
        }

        // Sort largest tables
        exposure.largestTables.sort((a, b) => b.rowCount - a.rowCount);
        exposure.largestTables = exposure.largestTables.slice(0, 5);

        return exposure;
    },

    /**
     * Generate full security report
     * @param {Object} parsedData - Parsed OpenAPI data
     * @param {Map} tableAccessResults - Map of table name to access results
     * @param {Map} functionTestResults - Map of function name to test results
     * @param {Object} additionalData - Additional data (JWT, buckets, etc.)
     * @returns {Object} Complete security report
     */
    generateReport(parsedData, tableAccessResults, functionTestResults, additionalData = {}) {
        const allIssues = [];

        // Analyze each table
        for (const table of parsedData.tables) {
            const accessResults = tableAccessResults.get(table.name);
            const tableIssues = this.analyzeTableSecurity(table, accessResults);
            allIssues.push(...tableIssues);
        }

        // Analyze each function
        for (const func of parsedData.functions) {
            const testResults = functionTestResults.get(func.name);
            const funcIssues = this.analyzeFunctionSecurity(func, testResults);
            allIssues.push(...funcIssues);
        }

        // Analyze storage buckets
        if (additionalData.buckets) {
            for (const bucket of additionalData.buckets) {
                const bucketIssues = this.analyzeBucketSecurity(bucket, bucket.access);
                allIssues.push(...bucketIssues);
            }
        }

        // Build tables with access info for counting exposed tables
        const tablesWithAccess = parsedData.tables.map(table => ({
            ...table,
            access: tableAccessResults.get(table.name) || {},
            sensitiveColumns: this.detectSensitiveColumns(table.columns)
        }));

        // Count only tables that actually have data exposed (rowCount > 0)
        const exposedTablesCount = tablesWithAccess.filter(table => {
            const rowCount = table.access?.rowCount;
            return rowCount !== null && rowCount !== undefined && rowCount > 0;
        }).length;

        // Count only functions that don't require auth (exposed functions)
        const exposedFunctionsCount = parsedData.functions.filter(func => {
            const testResults = functionTestResults.get(func.name);
            return testResults?.requiresAuth !== true;
        }).length;

        // Always report exposed tables/views count
        allIssues.push({
            severity: 'low',
            type: 'many_tables',
            message: `${exposedTablesCount} tables/views are exposed to the anon key`,
            recommendation: exposedTablesCount > 20 
                ? 'Review if all these tables need to be publicly accessible'
                : 'Consider if all these tables need to be publicly accessible'
        });

        // Always report exposed functions count
        allIssues.push({
            severity: 'low',
            type: 'many_functions',
            message: `${exposedFunctionsCount} RPC functions are exposed to the anon key`,
            recommendation: exposedFunctionsCount > 10
                ? 'Review if all these functions need to be publicly accessible'
                : 'Consider if all these functions need to be publicly accessible'
        });

        // Sort issues by severity
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        allIssues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

        const riskScore = this.calculateRiskScore(allIssues);

        // Calculate total public records
        const totalPublicRecords = additionalData.totalPublicRecords ||
            tablesWithAccess.reduce((sum, t) => sum + (t.access?.rowCount || 0), 0);

        // Build report (using exposed counts calculated above)
        const report = {
            summary: {
                totalTables: exposedTablesCount,
                totalFunctions: exposedFunctionsCount,
                totalIssues: allIssues.length,
                totalPublicRecords,
                riskScore
            },
            tables: tablesWithAccess,
            functions: parsedData.functions.map(func => ({
                ...func,
                testResults: functionTestResults.get(func.name) || {}
            })),
            issues: allIssues,
            generatedAt: new Date().toISOString()
        };

        // Add JWT info
        if (additionalData.jwtInfo) {
            report.jwtInfo = additionalData.jwtInfo;
        }

        // Add bucket info
        if (additionalData.buckets) {
            report.buckets = additionalData.buckets;
        }

        // Add realtime info
        if (additionalData.realtime) {
            report.realtime = additionalData.realtime;
        }

        // Add analysis mode and auth user (for authenticated user mode)
        report.mode = additionalData.mode || 'anonymous';
        if (additionalData.authUser) {
            report.authUser = additionalData.authUser;
        }

        // Generate remediation code
        report.remediations = this.generateRemediations(allIssues, tablesWithAccess);

        // Generate security checklist
        report.checklist = this.generateSecurityChecklist(report);

        // Calculate data exposure
        report.dataExposure = this.calculateDataExposure(tablesWithAccess);

        return report;
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Analyzer;
}
