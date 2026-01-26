/**
 * Main Application Module
 * Orchestrates the security audit flow
 */

const App = {
    currentReport: null,

    /**
     * Initialize the application
     */
    init() {
        UI.init();
        this.setupEventListeners();
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Form submission
        UI.elements.form?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.runAudit();
        });

        // Prevent form validation for detect mode
        UI.elements.form?.setAttribute('novalidate', 'novalidate');

        // Copy JSON button
        UI.elements.copyJsonBtn?.addEventListener('click', () => {
            this.copyReportAsJson();
        });

        // Download button
        UI.elements.downloadBtn?.addEventListener('click', () => {
            this.downloadReport();
        });

        // Download PDF button
        UI.elements.downloadPdfBtn?.addEventListener('click', () => {
            this.downloadReportAsPdf();
        });
    },

    /**
     * Get current mode (manual or detect)
     * @returns {string} Current mode
     */
    getCurrentMode() {
        return UI.elements.modeDetect?.classList.contains('active') ? 'detect' : 'manual';
    },

    /**
     * Validate input values
     * @returns {Object|null} Validated inputs or null if invalid
     */
    validateInputs() {
        const mode = this.getCurrentMode();

        if (mode === 'detect') {
            // Validate frontend URL
            const frontendUrl = UI.elements.frontendUrl.value.trim();
            if (!frontendUrl) {
                UI.showError('Please enter a frontend URL to analyze');
                return null;
            }

            try {
                const url = new URL(frontendUrl.startsWith('http') ? frontendUrl : 'https://' + frontendUrl);
                if (url.protocol !== 'https:' && url.protocol !== 'http:') {
                    UI.showError('Invalid URL format');
                    return null;
                }
            } catch (e) {
                UI.showError('Invalid frontend URL format');
                return null;
            }

            return { mode: 'detect', frontendUrl: frontendUrl.startsWith('http') ? frontendUrl : 'https://' + frontendUrl };
        } else {
            // Manual mode validation
            const projectUrl = UI.elements.projectUrl.value.trim();
            const anonKey = UI.elements.anonKey.value.trim();

            // Validate URL
            if (!projectUrl) {
                UI.showError('Please enter a Supabase project URL');
                return null;
            }

            try {
                const url = new URL(projectUrl);
                if (url.protocol !== 'https:') {
                    UI.showError('Project URL must use HTTPS');
                    return null;
                }
            } catch (e) {
                UI.showError('Invalid project URL format');
                return null;
            }

            // Validate anon key
            if (!anonKey) {
                UI.showError('Please enter your anon/publishable key');
                return null;
            }

            if (!anonKey.startsWith('eyJ') && !anonKey.startsWith('sb_publishable_')) {
                UI.showError('Invalid anon key format (should start with "eyJ" or "sb_publishable_")');
                return null;
            }

            // Remove trailing slash from URL
            const cleanUrl = projectUrl.replace(/\/+$/, '');

            return { mode: 'manual', projectUrl: cleanUrl, anonKey };
        }
    },

    /**
     * Run the security audit
     */
    async runAudit() {
        const inputs = this.validateInputs();
        if (!inputs) return;

        let projectUrl, anonKey;

        // Handle detection mode
        if (inputs.mode === 'detect') {
            try {
                UI.showLoading('Detecting Supabase credentials...');
                const detectionResult = await SupabaseDetector.detectFromUrl(inputs.frontendUrl);
                
                if (!detectionResult.projectUrl || !detectionResult.anonKey) {
                    // If we got partial results, fill them in and show helpful error
                    if (detectionResult.projectUrl) {
                        if (UI.elements.projectUrl) UI.elements.projectUrl.value = detectionResult.projectUrl;
                        UI.showError('Detected project URL but could not find anon key. Please enter the anon key manually.');
                        // Switch to manual mode so user can enter the key
                        if (UI.elements.modeManual) UI.switchMode('manual');
                        return;
                    }
                    UI.showError('Could not detect Supabase credentials. Please try manual entry or check if the website uses Supabase.');
                    return;
                }

                projectUrl = detectionResult.projectUrl;
                anonKey = detectionResult.anonKey;

                // Fill in the manual fields with detected values
                if (UI.elements.projectUrl) UI.elements.projectUrl.value = projectUrl;
                if (UI.elements.anonKey) UI.elements.anonKey.value = anonKey;

                UI.showToast('Supabase credentials detected successfully!', 'success');
            } catch (error) {
                console.error('Detection error:', error);
                
                // Check if we have partial results stored
                const partialUrl = SupabaseDetector.projectUrl;
                if (partialUrl) {
                    if (UI.elements.projectUrl) UI.elements.projectUrl.value = partialUrl;
                    if (UI.elements.modeManual) UI.switchMode('manual');
                    UI.showError(`${error.message} However, we found the project URL. Please enter the anon key manually.`);
                } else {
                    UI.showError(error.message || 'Failed to detect Supabase credentials. Please try manual entry.');
                }
                return;
            }
        } else {
            // Manual mode
            projectUrl = inputs.projectUrl;
            anonKey = inputs.anonKey;
        }

        try {
            // Step 0: Decode JWT
            UI.showLoading('Analyzing JWT token...');
            const jwtInfo = Analyzer.decodeJWT(anonKey);

            // Step 1: Fetch OpenAPI spec
            UI.showLoading('Fetching API specification...');
            const spec = await SupabaseClient.fetchOpenAPISpec(projectUrl, anonKey);

            // Step 2: Parse the spec
            UI.showLoading('Parsing API schema...');
            const parsedData = Analyzer.parseOpenAPISpec(spec);

            if (parsedData.tables.length === 0 && parsedData.functions.length === 0) {
                UI.showError('No tables or functions found. The project may not have any public API exposed, or the anon key may be invalid.');
                return;
            }

            // Step 3: Test table access
            UI.showLoading(`Testing access to ${parsedData.tables.length} tables...`);
            const tableAccessResults = new Map();

            for (const table of parsedData.tables) {
                try {
                    const access = await SupabaseClient.testTableAccess(projectUrl, anonKey, table.name);
                    tableAccessResults.set(table.name, access);
                } catch (e) {
                    tableAccessResults.set(table.name, { error: e.message });
                }
            }

            // Step 3.5: Fetch exact row counts for accessible tables
            UI.showLoading('Counting public records...');
            let totalPublicRecords = 0;
            const tableRowCounts = new Map();

            for (const table of parsedData.tables) {
                const access = tableAccessResults.get(table.name);
                if (access && access.select) {
                    try {
                        const count = await SupabaseClient.fetchTableRowCount(projectUrl, anonKey, table.name);
                        if (count !== null) {
                            tableRowCounts.set(table.name, count);
                            totalPublicRecords += count;
                            // Update the access results with exact count
                            access.rowCount = count;
                        }
                    } catch (e) {
                        // Count fetch failed, continue
                    }
                }
            }

            // Step 4: Test RPC functions
            UI.showLoading(`Testing ${parsedData.functions.length} RPC functions...`);
            const functionTestResults = new Map();

            for (const func of parsedData.functions) {
                try {
                    const result = await SupabaseClient.testRPCFunction(projectUrl, anonKey, func.name);
                    functionTestResults.set(func.name, result);
                } catch (e) {
                    functionTestResults.set(func.name, { error: e.message });
                }
            }

            // Step 5: Check storage buckets
            UI.showLoading('Scanning storage buckets...');
            let buckets = [];
            try {
                const bucketList = await SupabaseClient.listStorageBuckets(projectUrl, anonKey);
                for (const bucket of bucketList) {
                    const access = await SupabaseClient.testBucketAccess(projectUrl, anonKey, bucket.id || bucket.name);
                    buckets.push({
                        ...bucket,
                        access
                    });
                }
            } catch (e) {
                // Storage not accessible
            }

            // Step 6: Check realtime config
            UI.showLoading('Checking realtime configuration...');
            let realtime = null;
            try {
                realtime = await SupabaseClient.checkRealtimeConfig(projectUrl, anonKey);
            } catch (e) {
                // Realtime check failed
            }

            // Step 7: Try to get RLS policies
            UI.showLoading('Checking RLS policies...');
            const rlsPolicies = await SupabaseClient.queryRLSPolicies(projectUrl, anonKey);

            // Step 8: Generate report
            UI.showLoading('Generating security report...');
            const report = Analyzer.generateReport(
                parsedData,
                tableAccessResults,
                functionTestResults,
                {
                    jwtInfo,
                    buckets,
                    realtime,
                    rlsPolicies,
                    totalPublicRecords,
                    tableRowCounts: Object.fromEntries(tableRowCounts)
                }
            );

            // Store for export
            this.currentReport = report;

            // Step 9: Render results
            UI.renderReport(report);

        } catch (error) {
            console.error('Audit failed:', error);

            let errorMessage = 'Failed to analyze the Supabase project. ';

            if (error.message.includes('Failed to fetch')) {
                errorMessage += 'Could not connect to the server. Check the URL and try again.';
            } else if (error.message.includes('401') || error.message.includes('403')) {
                errorMessage += 'Authentication failed. Check your anon key.';
            } else if (error.message.includes('CORS')) {
                errorMessage += 'Cross-origin request blocked. The Supabase project may have restrictive CORS settings.';
            } else {
                errorMessage += error.message;
            }

            UI.showError(errorMessage);
        }
    },

    /**
     * Copy report as JSON to clipboard
     */
    async copyReportAsJson() {
        if (!this.currentReport) {
            UI.showToast('No report to copy', 'error');
            return;
        }

        try {
            const json = JSON.stringify(this.currentReport, null, 2);
            await navigator.clipboard.writeText(json);
            UI.showToast('Report copied to clipboard!', 'success');
        } catch (e) {
            UI.showToast('Failed to copy to clipboard', 'error');
        }
    },

    /**
     * Download report as JSON file
     */
    downloadReport() {
        if (!this.currentReport) {
            UI.showToast('No report to download', 'error');
            return;
        }

        try {
            const json = JSON.stringify(this.currentReport, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `supabase-security-report-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            UI.showToast('Report downloaded!', 'success');
        } catch (e) {
            UI.showToast('Failed to download report', 'error');
        }
    },

    /**
     * Download report as PDF
     */
    async downloadReportAsPdf() {
        if (!this.currentReport) {
            UI.showToast('No report to download', 'error');
            return;
        }

        try {
            UI.showToast('Generating PDF...', 'success');

            // Create a printable version of the report
            const pdfContent = this.generatePdfContent();

            // Create an iframe to isolate from DaisyUI's oklch colors
            const iframe = document.createElement('iframe');
            iframe.style.cssText = 'position: absolute; left: -9999px; top: 0; width: 850px; height: 1200px; border: none;';
            document.body.appendChild(iframe);

            // Write content to iframe (isolated from parent styles)
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            iframeDoc.open();
            iframeDoc.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        * { box-sizing: border-box; margin: 0; padding: 0; }
                        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: #fff; color: #374151; }
                    </style>
                </head>
                <body>${pdfContent}</body>
                </html>
            `);
            iframeDoc.close();

            // Wait for content to render
            await new Promise(resolve => setTimeout(resolve, 100));

            // PDF options
            const opt = {
                margin: [10, 10, 10, 10],
                filename: `supabase-security-report-${new Date().toISOString().split('T')[0]}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#ffffff'
                },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            // Generate PDF from iframe content
            await html2pdf().set(opt).from(iframeDoc.body).save();

            // Cleanup
            document.body.removeChild(iframe);

            UI.showToast('PDF downloaded!', 'success');
        } catch (e) {
            console.error('PDF generation failed:', e);
            UI.showToast('Failed to generate PDF', 'error');
        }
    },

    /**
     * Generate HTML content for PDF
     */
    generatePdfContent() {
        const report = this.currentReport;
        const date = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const riskColors = {
            critical: '#dc2626',
            high: '#ea580c',
            medium: '#ca8a04',
            low: '#16a34a'
        };

        const severityBadge = (severity) => {
            const colors = {
                critical: 'background: #fee2e2; color: #dc2626; border: 1px solid #fecaca;',
                high: 'background: #ffedd5; color: #ea580c; border: 1px solid #fed7aa;',
                medium: 'background: #fef9c3; color: #ca8a04; border: 1px solid #fef08a;',
                low: 'background: #dbeafe; color: #2563eb; border: 1px solid #bfdbfe;'
            };
            return `<span style="padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 500; ${colors[severity]}">${severity.toUpperCase()}</span>`;
        };

        let issuesHtml = '';
        if (report.issues.length === 0) {
            issuesHtml = '<p style="color: #16a34a; text-align: center; padding: 20px;">No security issues detected!</p>';
        } else {
            issuesHtml = report.issues.map(issue => `
                <div style="padding: 12px; margin-bottom: 8px; border-left: 4px solid ${riskColors[issue.severity]}; background: #f9fafb; border-radius: 4px; page-break-inside: avoid;">
                    <div style="margin-bottom: 4px;">${severityBadge(issue.severity)} <span style="color: #6b7280; font-size: 12px; margin-left: 8px;">${issue.type.replace(/_/g, ' ')}</span></div>
                    <p style="margin: 0; color: #374151; font-size: 13px;">${issue.message}</p>
                    ${issue.recommendation ? `<p style="margin: 4px 0 0 0; color: #6b7280; font-size: 12px;">💡 ${issue.recommendation}</p>` : ''}
                </div>
            `).join('');
        }

        // Filter to only exposed tables (with rowCount > 0)
        const exposedTables = report.tables.filter(table => {
            const rowCount = table.access?.rowCount;
            return rowCount !== null && rowCount !== undefined && rowCount > 0;
        });

        let tablesHtml = '';
        if (exposedTables.length === 0) {
            tablesHtml = '<p style="color: #6b7280; text-align: center;">No tables with exposed data</p>';
        } else {
            tablesHtml = exposedTables.map(table => {
                const rowCount = table.access?.rowCount || 0;
                return `
                <div style="margin-bottom: 16px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; page-break-inside: avoid;">
                    <div style="padding: 12px; background: #f9fafb; border-bottom: 1px solid #e5e7eb;">
                        <strong style="color: #0a5757; font-family: monospace;">${table.name}</strong>
                        <span style="color: #6b7280; font-size: 12px; margin-left: 8px;">${table.columns.length} columns</span>
                        <span style="color: #F45D48; font-weight: 600; margin-left: 8px;">${rowCount.toLocaleString()} records</span>
                        ${table.sensitiveColumns?.length > 0 ? severityBadge('medium') : ''}
                    </div>
                    <div style="padding: 12px;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                            <thead>
                                <tr style="border-bottom: 1px solid #e5e7eb;">
                                    <th style="text-align: left; padding: 4px 8px; color: #6b7280;">Column</th>
                                    <th style="text-align: left; padding: 4px 8px; color: #6b7280;">Type</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${table.columns.slice(0, 10).map(col => `
                                    <tr style="border-bottom: 1px solid #f3f4f6;">
                                        <td style="padding: 4px 8px; font-family: monospace; color: #374151;">${col.name}</td>
                                        <td style="padding: 4px 8px; color: #6b7280;">${col.type}</td>
                                    </tr>
                                `).join('')}
                                ${table.columns.length > 10 ? `<tr><td colspan="2" style="padding: 4px 8px; color: #6b7280; font-style: italic;">... and ${table.columns.length - 10} more columns</td></tr>` : ''}
                            </tbody>
                        </table>
                    </div>
                </div>
            `}).join('');
        }

        // Filter to only exposed functions (not auth-required)
        const exposedFunctions = report.functions.filter(func => {
            return func.testResults?.requiresAuth !== true;
        });

        let functionsHtml = '';
        if (exposedFunctions.length === 0) {
            functionsHtml = '<p style="color: #6b7280; text-align: center;">No exposed RPC functions</p>';
        } else {
            functionsHtml = exposedFunctions.map(func => `
                <div style="padding: 8px 12px; margin-bottom: 8px; border: 1px solid #e5e7eb; border-radius: 8px; page-break-inside: avoid;">
                    <strong style="color: #2563eb; font-family: monospace;">${func.name}()</strong>
                    <span style="color: #6b7280; font-size: 12px; margin-left: 8px;">${func.parameters.length} params</span>
                </div>
            `).join('');
        }

        let checklistHtml = '';
        if (report.checklist && report.checklist.length > 0) {
            checklistHtml = report.checklist.map(item => {
                const icon = item.status === 'pass' ? '✅' : item.status === 'fail' ? '❌' : item.status === 'warn' ? '⚠️' : 'ℹ️';
                return `
                    <div style="padding: 8px 12px; margin-bottom: 8px; background: #f9fafb; border-radius: 8px;">
                        <span style="margin-right: 8px;">${icon}</span>
                        <strong style="color: #374151;">${item.title}</strong>
                        <p style="margin: 4px 0 0 24px; color: #6b7280; font-size: 12px;">${item.details}</p>
                    </div>
                `;
            }).join('');
        }

        return `
            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; color: #374151; padding: 20px;">
                <!-- Header -->
                <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #0a5757; page-break-after: avoid;">
                    <h1 style="color: #0a5757; margin: 0 0 8px 0; font-size: 24px;">PolicyCheck Security Report</h1>
                    <p style="color: #6b7280; margin: 0 0 4px 0; font-size: 14px;">Generated on ${date}</p>
                    <p style="color: #6b7280; margin: 0; font-size: 12px;">Contact: <a href="mailto:nocodetalks@gmail.com" style="color: #0a5757;">nocodetalks@gmail.com</a></p>
                </div>

                <!-- Summary -->
                <div style="display: flex; justify-content: space-between; margin-bottom: 30px; gap: 12px; flex-wrap: wrap; page-break-inside: avoid;">
                    <div style="flex: 1; min-width: 100px; text-align: center; padding: 16px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
                        <div style="font-size: 24px; font-weight: bold; color: #374151;">${exposedTables.length}</div>
                        <div style="font-size: 11px; color: #6b7280;">Tables Exposed</div>
                    </div>
                    <div style="flex: 1; min-width: 100px; text-align: center; padding: 16px; background: #fef2f2; border-radius: 8px; border: 1px solid #fecaca;">
                        <div style="font-size: 24px; font-weight: bold; color: #F45D48;">${(report.summary.totalPublicRecords || 0).toLocaleString()}</div>
                        <div style="font-size: 11px; color: #6b7280;">Public Records</div>
                    </div>
                    <div style="flex: 1; min-width: 100px; text-align: center; padding: 16px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
                        <div style="font-size: 24px; font-weight: bold; color: #374151;">${exposedFunctions.length}</div>
                        <div style="font-size: 11px; color: #6b7280;">Exposed RPC Functions</div>
                    </div>
                    <div style="flex: 1; min-width: 100px; text-align: center; padding: 16px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
                        <div style="font-size: 24px; font-weight: bold; color: #374151;">${report.summary.totalIssues}</div>
                        <div style="font-size: 11px; color: #6b7280;">Security Issues</div>
                    </div>
                    <div style="flex: 1; min-width: 100px; text-align: center; padding: 16px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
                        <div style="font-size: 24px; font-weight: bold; color: ${riskColors[report.summary.riskScore.riskLevel]};">${report.summary.riskScore.score}</div>
                        <div style="font-size: 11px; color: #6b7280;">Risk Score</div>
                    </div>
                </div>

                <!-- Risk Assessment -->
                <div style="margin-bottom: 30px; padding: 16px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb; page-break-inside: avoid;">
                    <h2 style="margin: 0 0 12px 0; font-size: 16px; color: #374151;">Risk Assessment</h2>
                    <div style="display: flex; align-items: center; gap: 20px;">
                        <div style="width: 60px; height: 60px; border-radius: 50%; background: ${riskColors[report.summary.riskScore.riskLevel]}20; border: 3px solid ${riskColors[report.summary.riskScore.riskLevel]}; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold; color: ${riskColors[report.summary.riskScore.riskLevel]};">
                            ${report.summary.riskScore.score}
                        </div>
                        <div>
                            <div style="font-weight: 600; color: ${riskColors[report.summary.riskScore.riskLevel]}; margin-bottom: 4px;">${report.summary.riskScore.riskLevel.toUpperCase()} RISK</div>
                            <div style="font-size: 12px; color: #6b7280;">
                                Critical: ${report.summary.riskScore.breakdown.critical} |
                                High: ${report.summary.riskScore.breakdown.high} |
                                Medium: ${report.summary.riskScore.breakdown.medium} |
                                Low: ${report.summary.riskScore.breakdown.low}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Security Checklist -->
                ${checklistHtml ? `
                <div style="margin-bottom: 30px; page-break-inside: avoid;">
                    <h2 style="margin: 0 0 12px 0; font-size: 16px; color: #374151;">Security Checklist</h2>
                    ${checklistHtml}
                </div>
                ` : ''}

                <!-- Security Issues -->
                <div style="margin-bottom: 30px; page-break-inside: avoid;">
                    <h2 style="margin: 0 0 12px 0; font-size: 16px; color: #374151;">Security Issues (${report.issues.length})</h2>
                    ${issuesHtml}
                </div>

                <!-- Tables -->
                <div style="margin-bottom: 30px;">
                    <h2 style="margin: 0 0 12px 0; font-size: 16px; color: #374151; page-break-after: avoid;">Exposed Tables & Views (${exposedTables.length})</h2>
                    ${tablesHtml}
                </div>

                <!-- Functions -->
                <div style="margin-bottom: 30px;">
                    <h2 style="margin: 0 0 12px 0; font-size: 16px; color: #374151; page-break-after: avoid;">Exposed RPC Functions (${exposedFunctions.length})</h2>
                    ${functionsHtml}
                </div>

                <!-- Footer -->
                <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px;">
                    <p style="margin: 0;">Generated by PolicyCheck</p>
                    <p style="margin: 4px 0 0 0;">Questions? Contact nocodetalks@gmail.com</p>
                </div>
            </div>
        `;
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
