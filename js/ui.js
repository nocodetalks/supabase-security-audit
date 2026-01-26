/**
 * UI Rendering Module - Vercel Design System
 */

const UI = {
    elements: {},
    charts: { risk: null, issues: null },
    currentData: { tables: [], functions: [], projectUrl: '', anonKey: '' },
    filters: { tableSearch: '', functionSearch: '' },

    init() {
        this.elements = {
            form: document.getElementById('audit-form'),
            projectUrl: document.getElementById('project-url'),
            anonKey: document.getElementById('anon-key'),
            toggleKey: document.getElementById('toggle-key'),
            eyeIcon: document.getElementById('eye-icon'),
            eyeOffIcon: document.getElementById('eye-off-icon'),
            analyzeBtn: document.getElementById('analyze-btn'),
            analyzeBtnText: document.getElementById('analyze-btn-text'),
            modeManual: document.getElementById('mode-manual'),
            modeDetect: document.getElementById('mode-detect'),
            manualMode: document.getElementById('manual-mode'),
            detectMode: document.getElementById('detect-mode'),
            frontendUrl: document.getElementById('frontend-url'),
            heroSection: document.getElementById('hero-section'),
            featuresSection: document.getElementById('features'),
            howItWorksSection: document.getElementById('how-it-works'),
            loadingSection: document.getElementById('loading-section'),
            loadingMessage: document.getElementById('loading-message'),
            errorSection: document.getElementById('error-section'),
            errorMessage: document.getElementById('error-message'),
            retryBtn: document.getElementById('retry-btn'),
            resultsSection: document.getElementById('results-section'),
            headerScore: document.getElementById('header-score'),
            headerStats: document.getElementById('header-stats'),
            summaryContent: document.getElementById('summary-content'),
            scoreContent: document.getElementById('score-content'),
            jwtContent: document.getElementById('jwt-content'),
            checklistContent: document.getElementById('checklist-content'),
            exposureContent: document.getElementById('exposure-content'),
            issuesContent: document.getElementById('issues-content'),
            tablesContent: document.getElementById('tables-content'),
            functionsContent: document.getElementById('functions-content'),
            bucketsContent: document.getElementById('buckets-content'),
            remediationContent: document.getElementById('remediation-content'),
            copyJsonBtn: document.getElementById('copy-json-btn'),
            downloadBtn: document.getElementById('download-btn'),
            downloadPdfBtn: document.getElementById('download-pdf-btn'),
            newScanBtn: document.getElementById('new-scan-btn'),
            sidebarIssuesCount: document.getElementById('sidebar-issues-count'),
            sidebarTablesCount: document.getElementById('sidebar-tables-count'),
            sidebarFunctionsCount: document.getElementById('sidebar-functions-count'),
            tableSearch: document.getElementById('table-search'),
            functionSearch: document.getElementById('function-search'),
            detailsToggle: document.getElementById('details-toggle'),
            detailsContent: document.getElementById('details-content'),
            riskChart: document.getElementById('risk-chart'),
            issuesChart: document.getElementById('issues-chart'),
            dataModal: document.getElementById('data-modal'),
            modalBackdrop: document.getElementById('modal-backdrop'),
            modalClose: document.getElementById('modal-close'),
            modalTitle: document.getElementById('modal-title'),
            modalContent: document.getElementById('modal-content')
        };
        this.setupEventListeners();
    },

    setupEventListeners() {
        this.elements.toggleKey?.addEventListener('click', () => {
            const isPassword = this.elements.anonKey.type === 'password';
            this.elements.anonKey.type = isPassword ? 'text' : 'password';
            this.elements.eyeIcon.classList.toggle('hidden', !isPassword);
            this.elements.eyeOffIcon.classList.toggle('hidden', isPassword);
        });

        this.elements.retryBtn?.addEventListener('click', () => {
            this.hideError();
            this.showInput();
        });

        this.elements.newScanBtn?.addEventListener('click', () => this.showInput());

        this.elements.detailsToggle?.addEventListener('click', () => {
            const content = this.elements.detailsContent;
            const chevron = this.elements.detailsToggle.querySelector('.chevron');
            content.classList.toggle('hidden');
            chevron?.classList.toggle('rotate-180');
        });

        this.elements.tableSearch?.addEventListener('input', (e) => {
            this.filters.tableSearch = e.target.value.toLowerCase();
            this.filterAndRenderTables();
        });

        this.elements.functionSearch?.addEventListener('input', (e) => {
            this.filters.functionSearch = e.target.value.toLowerCase();
            this.filterAndRenderFunctions();
        });

        this.elements.modalClose?.addEventListener('click', () => this.closeModal());
        this.elements.modalBackdrop?.addEventListener('click', () => this.closeModal());

        this.setupSidebarNavigation();
        this.setupContactDropdown();
    },

    setupContactDropdown() {
        const contactButton = document.getElementById('contact-button');
        const contactMenu = document.getElementById('contact-menu');
        
        if (!contactButton || !contactMenu) return;

        // Toggle dropdown on click (for mobile)
        contactButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = !contactMenu.classList.contains('invisible');
            if (isVisible) {
                contactMenu.classList.add('invisible', 'opacity-0');
            } else {
                contactMenu.classList.remove('invisible', 'opacity-0');
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('contact-dropdown');
            if (dropdown && !dropdown.contains(e.target)) {
                contactMenu.classList.add('invisible', 'opacity-0');
            }
        });

        // Close dropdown when clicking on a link
        contactMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                contactMenu.classList.add('invisible', 'opacity-0');
            });
        });
    },

    setupSidebarNavigation() {
        const sidebarLinks = document.querySelectorAll('.sidebar-link');
        sidebarLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href').substring(1);
                const target = document.getElementById(targetId);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                    sidebarLinks.forEach(l => l.classList.remove('active'));
                    link.classList.add('active');
                }
            });
        });

        // Setup scroll spy to auto-highlight active section
        this.setupScrollSpy();
    },

    setupScrollSpy() {
        const sections = document.querySelectorAll('[id^="section-"]');
        const sidebarLinks = document.querySelectorAll('.sidebar-link');

        if (sections.length === 0 || sidebarLinks.length === 0) return;

        // Clear any existing observer
        if (this.scrollObserver) {
            this.scrollObserver.disconnect();
        }

        const observerOptions = {
            root: null,
            rootMargin: '-140px 0px -60% 0px', // Account for sticky header
            threshold: [0, 0.25, 0.5, 0.75, 1]
        };

        let currentActive = null;

        const observer = new IntersectionObserver((entries) => {
            // Find the section that's most visible
            let maxRatio = 0;
            let mostVisible = null;

            entries.forEach(entry => {
                if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
                    maxRatio = entry.intersectionRatio;
                    mostVisible = entry.target;
                }
            });

            // If we have a most visible section, update active link
            if (mostVisible && mostVisible !== currentActive) {
                currentActive = mostVisible;
                const id = mostVisible.getAttribute('id');
                sidebarLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${id}`) {
                        link.classList.add('active');
                    }
                });
            }
        }, observerOptions);

        sections.forEach(section => {
            observer.observe(section);
        });

        this.scrollObserver = observer;
    },

    switchMode(mode) {
        const isManual = mode === 'manual';
        
        // Update toggle buttons
        if (isManual) {
            this.elements.modeManual?.classList.add('active');
            this.elements.modeDetect?.classList.remove('active');
        } else {
            this.elements.modeManual?.classList.remove('active');
            this.elements.modeDetect?.classList.add('active');
        }

        // Show/hide mode sections
        if (isManual) {
            this.elements.manualMode?.classList.remove('hidden');
            this.elements.detectMode?.classList.add('hidden');
        } else {
            this.elements.manualMode?.classList.add('hidden');
            this.elements.detectMode?.classList.remove('hidden');
        }

        // Update button text
        if (this.elements.analyzeBtnText) {
            this.elements.analyzeBtnText.textContent = isManual ? 'Analyze Security' : 'Detect & Analyze';
        }
    },

    showLoading(message = 'Analyzing...') {
        this.elements.heroSection?.classList.add('hidden');
        this.elements.featuresSection?.classList.add('hidden');
        this.elements.howItWorksSection?.classList.add('hidden');
        this.elements.errorSection?.classList.add('hidden');
        this.elements.resultsSection?.classList.add('hidden');
        this.elements.loadingSection?.classList.remove('hidden');
        if (this.elements.loadingMessage) this.elements.loadingMessage.textContent = message;
    },

    hideLoading() {
        this.elements.loadingSection?.classList.add('hidden');
    },

    showError(message) {
        this.hideLoading();
        this.elements.heroSection?.classList.add('hidden');
        this.elements.featuresSection?.classList.add('hidden');
        this.elements.howItWorksSection?.classList.add('hidden');
        this.elements.resultsSection?.classList.add('hidden');
        this.elements.errorSection?.classList.remove('hidden');
        if (this.elements.errorMessage) this.elements.errorMessage.textContent = message;
    },

    hideError() {
        this.elements.errorSection?.classList.add('hidden');
    },

    showInput() {
        this.elements.heroSection?.classList.remove('hidden');
        this.elements.featuresSection?.classList.remove('hidden');
        this.elements.howItWorksSection?.classList.remove('hidden');
        this.elements.loadingSection?.classList.add('hidden');
        this.elements.errorSection?.classList.add('hidden');
        this.elements.resultsSection?.classList.add('hidden');
        this.destroyCharts();
        
        // Disconnect scroll observer when hiding results
        if (this.scrollObserver) {
            this.scrollObserver.disconnect();
            this.scrollObserver = null;
        }
    },

    showResults() {
        this.hideLoading();
        this.elements.heroSection?.classList.add('hidden');
        this.elements.featuresSection?.classList.add('hidden');
        this.elements.howItWorksSection?.classList.add('hidden');
        this.elements.errorSection?.classList.add('hidden');
        this.elements.resultsSection?.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    destroyCharts() {
        if (this.charts.risk) { this.charts.risk.destroy(); this.charts.risk = null; }
        if (this.charts.issues) { this.charts.issues.destroy(); this.charts.issues = null; }
    },

    formatNumber(num) {
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toLocaleString();
    },

    escapeHtml(str) {
        if (typeof str !== 'string') return str;
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    getRiskColor(riskLevel) {
        const colors = { critical: 'text-[#e00]', high: 'text-[#f5a623]', medium: 'text-[#f5a623]', low: 'text-[#0070f3]' };
        return colors[riskLevel] || 'text-[#666]';
    },

    showToast(message, type = 'success') {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.className = `toast ${type === 'success' ? 'toast-success' : 'toast-error'}`;
        toast.innerHTML = `<span>${message}</span>`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    },

    openModal(title, content) {
        if (this.elements.modalTitle) this.elements.modalTitle.textContent = title;
        if (this.elements.modalContent) this.elements.modalContent.innerHTML = content;
        this.elements.dataModal?.classList.remove('hidden');
    },

    closeModal() {
        this.elements.dataModal?.classList.add('hidden');
    },

    renderStickyHeader(summary) {
        const riskLevel = summary.riskScore.riskLevel;
        if (this.elements.headerScore) {
            this.elements.headerScore.className = `score-badge score-${riskLevel}`;
            this.elements.headerScore.innerHTML = `<span>${summary.riskScore.score}</span><span class="text-xs uppercase">${riskLevel}</span>`;
        }

        const recordsDisplay = this.formatNumber(summary.totalPublicRecords || 0);
        if (this.elements.headerStats) {
            this.elements.headerStats.innerHTML = `
                <span><strong class="text-[#000]">${summary.totalTables}</strong> Tables</span>
                <span><strong class="text-[#e00]">${recordsDisplay}</strong> Records</span>
                <span><strong class="text-[#000]">${summary.totalIssues}</strong> Issues</span>
            `;
        }
    },

    updateSidebarCounts(summary) {
        if (this.elements.sidebarIssuesCount) {
            this.elements.sidebarIssuesCount.textContent = summary.totalIssues;
            if (summary.totalIssues > 0) {
                this.elements.sidebarIssuesCount.style.backgroundColor = '#fee2e2';
                this.elements.sidebarIssuesCount.style.color = '#dc2626';
            }
        }
        if (this.elements.sidebarTablesCount) this.elements.sidebarTablesCount.textContent = summary.totalTables;
        if (this.elements.sidebarFunctionsCount) this.elements.sidebarFunctionsCount.textContent = summary.totalFunctions;
    },

    renderSummary(summary) {
        const recordsDisplay = this.formatNumber(summary.totalPublicRecords || 0);
        const html = `
            <div class="stat-card">
                <div class="stat-value">${summary.totalTables}</div>
                <div class="stat-label">Tables Exposed</div>
            </div>
            <div class="stat-card" style="background-color: #fef2f2; border-color: #fecaca;">
                <div class="stat-value" style="color: #dc2626;">${recordsDisplay}</div>
                <div class="stat-label">Public Records</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${summary.totalFunctions}</div>
                <div class="stat-label">Exposed RPC Functions</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${summary.totalIssues}</div>
                <div class="stat-label">Security Issues</div>
            </div>
            <div class="stat-card">
                <div class="stat-value ${this.getRiskColor(summary.riskScore.riskLevel)}">${summary.riskScore.score}</div>
                <div class="stat-label">Risk Score</div>
            </div>
        `;
        if (this.elements.summaryContent) this.elements.summaryContent.innerHTML = html;
    },

    renderRiskChart(riskScore) {
        if (this.charts.risk) this.charts.risk.destroy();
        const ctx = this.elements.riskChart?.getContext('2d');
        if (!ctx) return;

        const { breakdown } = riskScore;
        const total = breakdown.critical + breakdown.high + breakdown.medium + breakdown.low;
        const data = total === 0 ? [1] : [breakdown.critical, breakdown.high, breakdown.medium, breakdown.low];
        const colors = total === 0 ? ['#0070f3'] : ['#e00', '#f5a623', '#f5a623', '#0070f3'];

        this.charts.risk = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: total === 0 ? ['No Issues'] : ['Critical', 'High', 'Medium', 'Low'],
                datasets: [{ data, backgroundColor: colors, borderWidth: 0, cutout: '70%' }]
            },
            options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } } }
        });
    },

    renderIssuesChart(breakdown) {
        if (this.charts.issues) this.charts.issues.destroy();
        const ctx = this.elements.issuesChart?.getContext('2d');
        if (!ctx) return;

        this.charts.issues = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Critical', 'High', 'Medium', 'Low'],
                datasets: [{ data: [breakdown.critical, breakdown.high, breakdown.medium, breakdown.low], backgroundColor: ['#e00', '#f5a623', '#f5a623', '#0070f3'], borderRadius: 4, barThickness: 32 }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { beginAtZero: true, ticks: { stepSize: 1, color: '#666' }, grid: { color: '#eaeaea' } }, y: { ticks: { color: '#666' }, grid: { display: false } } }
            }
        });
    },

    renderRiskScore(riskScore) {
        const html = `
            <div class="text-14 font-semibold ${this.getRiskColor(riskScore.riskLevel)} mb-3">${riskScore.riskLevel.toUpperCase()} RISK</div>
            <div class="grid grid-cols-2 gap-2 text-13">
                <div class="flex items-center justify-between px-2 py-1.5 rounded-vercel" style="background-color: #fef2f2;"><span style="color: #dc2626;">Critical</span><span class="font-semibold" style="color: #dc2626;">${riskScore.breakdown.critical}</span></div>
                <div class="flex items-center justify-between px-2 py-1.5 rounded-vercel" style="background-color: #fff7ed;"><span style="color: #ea580c;">High</span><span class="font-semibold" style="color: #ea580c;">${riskScore.breakdown.high}</span></div>
                <div class="flex items-center justify-between px-2 py-1.5 rounded-vercel" style="background-color: #fffbeb;"><span style="color: #d97706;">Medium</span><span class="font-semibold" style="color: #d97706;">${riskScore.breakdown.medium}</span></div>
                <div class="flex items-center justify-between px-2 py-1.5 rounded-vercel" style="background-color: #eff6ff;"><span style="color: #0070f3;">Low</span><span class="font-semibold" style="color: #0070f3;">${riskScore.breakdown.low}</span></div>
            </div>
        `;
        if (this.elements.scoreContent) this.elements.scoreContent.innerHTML = html;
        this.renderRiskChart(riskScore);
        this.renderIssuesChart(riskScore.breakdown);
    },

    renderChecklist(checklist) {
        if (!checklist || checklist.length === 0) {
            if (this.elements.checklistContent) this.elements.checklistContent.innerHTML = `<p class="text-[#666] text-center py-4 text-14">No checklist items</p>`;
            return;
        }

        const statusStyles = {
            pass: { bg: '#f0fdf4', border: '#bbf7d0', color: '#16a34a', icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>' },
            fail: { bg: '#fef2f2', border: '#fecaca', color: '#dc2626', icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>' },
            warn: { bg: '#fffbeb', border: '#fde68a', color: '#d97706', icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>' },
            info: { bg: '#eff6ff', border: '#bfdbfe', color: '#0070f3', icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>' }
        };

        const html = checklist.map(item => {
            const style = statusStyles[item.status] || statusStyles.info;
            return `
                <div class="flex items-start gap-3 p-4 rounded-vercel border" style="background-color: ${style.bg}; border-color: ${style.border};">
                    <div class="flex-shrink-0 mt-0.5" style="color: ${style.color};">${style.icon}</div>
                    <div class="flex-1">
                        <div class="font-medium text-[#000] text-14">${this.escapeHtml(item.title)}</div>
                        <div class="text-13 text-[#666] mt-1">${this.escapeHtml(item.description)}</div>
                        <div class="text-13 text-[#888] mt-1">${this.escapeHtml(item.details)}</div>
                    </div>
                </div>
            `;
        }).join('');

        if (this.elements.checklistContent) this.elements.checklistContent.innerHTML = html;
    },

    renderIssues(issues) {
        if (issues.length === 0) {
            if (this.elements.issuesContent) this.elements.issuesContent.innerHTML = `
                <div class="text-center py-12">
                    <svg class="w-12 h-12 mx-auto mb-4" fill="none" stroke="#0070f3" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <p class="font-medium text-[#000] text-14">No security issues detected!</p>
                    <p class="text-13 text-[#666] mt-1">Your API exposure looks good.</p>
                </div>
            `;
            return;
        }

        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const sortedIssues = [...issues].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

        const severityStyles = {
            critical: { bg: '#fef2f2', border: '#dc2626', badge: 'badge-critical' },
            high: { bg: '#fff7ed', border: '#ea580c', badge: 'badge-high' },
            medium: { bg: '#fffbeb', border: '#d97706', badge: 'badge-medium' },
            low: { bg: '#eff6ff', border: '#0070f3', badge: 'badge-low' }
        };

        const html = sortedIssues.map(issue => {
            const style = severityStyles[issue.severity] || severityStyles.low;
            return `
                <div class="issue-card issue-${issue.severity}">
                    <div class="flex items-start gap-3">
                        <span class="badge-severity ${style.badge}">${issue.severity.toUpperCase()}</span>
                        <div class="flex-1">
                            <div class="text-13 text-[#888] font-medium mb-1">${issue.type.replace(/_/g, ' ').toUpperCase()}</div>
                            <p class="text-14 text-[#000] font-medium">${this.escapeHtml(issue.message)}</p>
                            ${issue.recommendation ? `<p class="text-13 text-[#666] mt-2">${this.escapeHtml(issue.recommendation)}</p>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        if (this.elements.issuesContent) this.elements.issuesContent.innerHTML = html;
    },

    filterAndRenderTables() {
        let filteredTables = [...this.currentData.tables]
            .filter(table => {
                const rowCount = table.access?.rowCount;
                return rowCount !== null && rowCount !== undefined && rowCount > 0;
            })
            .sort((a, b) => (b.access?.rowCount || 0) - (a.access?.rowCount || 0));

        if (this.filters.tableSearch) {
            filteredTables = filteredTables.filter(table => table.name.toLowerCase().includes(this.filters.tableSearch));
        }

        this.renderTablesList(filteredTables);
    },

    renderTablesList(tables) {
        if (tables.length === 0) {
            if (this.elements.tablesContent) this.elements.tablesContent.innerHTML = `<p class="text-[#666] text-center py-8 text-14">No tables with exposed data found</p>`;
            return;
        }

        const html = `
            <div class="overflow-x-auto">
                <table class="w-full text-13">
                    <thead>
                        <tr class="border-b border-[#eaeaea]">
                            <th class="text-left py-3 px-4 font-medium text-[#000]">Table Name</th>
                            <th class="text-right py-3 px-4 font-medium text-[#000]">Records</th>
                            <th class="text-center py-3 px-4 font-medium text-[#000]">Columns</th>
                            <th class="text-center py-3 px-4 font-medium text-[#000]">Access</th>
                            <th class="text-center py-3 px-4 font-medium text-[#000]">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tables.map(table => {
                            const rowCount = table.access?.rowCount || 0;
                            return `
                                <tr class="border-b border-[#eaeaea] hover:bg-[#fafafa] transition-colors">
                                    <td class="py-3 px-4">
                                        <span class="font-mono text-[#000] font-medium">${this.escapeHtml(table.name)}</span>
                                    </td>
                                    <td class="py-3 px-4 text-right">
                                        <span class="font-semibold ${rowCount > 1000 ? 'text-[#e00]' : 'text-[#000]'}">${rowCount.toLocaleString()}</span>
                                    </td>
                                    <td class="py-3 px-4 text-center text-[#666]">${table.columns.length}</td>
                                    <td class="py-3 px-4 text-center">
                                        <div class="flex justify-center gap-1">
                                            ${table.access?.select ? '<span class="method-badge method-get">GET</span>' : ''}
                                            ${table.access?.insert === true ? '<span class="method-badge method-post">POST</span>' : ''}
                                            ${table.access?.update === true ? '<span class="method-badge method-patch">PATCH</span>' : ''}
                                            ${table.access?.delete === true ? '<span class="method-badge method-delete">DELETE</span>' : ''}
                                        </div>
                                    </td>
                                    <td class="py-3 px-4 text-center">
                                        <button class="fetch-data-btn h-7 px-3 text-13 font-medium rounded-vercel border border-[#eaeaea] text-[#666] hover:border-[#000] hover:text-[#000] transition-colors" data-table="${this.escapeHtml(table.name)}">
                                            View
                                        </button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        if (this.elements.tablesContent) {
            this.elements.tablesContent.innerHTML = html;
            document.querySelectorAll('.fetch-data-btn').forEach(btn => {
                btn.addEventListener('click', () => this.fetchTableData(btn.dataset.table));
            });
        }
    },

    async fetchTableData(tableName) {
        const { projectUrl, anonKey } = this.currentData;
        if (!projectUrl || !anonKey) {
            this.showToast('Missing credentials', 'error');
            return;
        }

        this.openModal(`Loading ${tableName}...`, '<div class="flex items-center justify-center py-12"><div class="w-6 h-6 rounded-full border-2 border-[#eaeaea] border-t-[#000] animate-spin"></div></div>');

        try {
            const response = await fetch(`${projectUrl}/rest/v1/${tableName}?limit=100`, {
                headers: { 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}` }
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();

            if (!data || data.length === 0) {
                this.openModal(tableName, '<p class="text-center text-[#666] py-8 text-14">No data found</p>');
                return;
            }

            const columns = Object.keys(data[0]);
            const tableHtml = `
                <div class="overflow-x-auto">
                    <table class="w-full text-13 border-collapse">
                        <thead>
                            <tr class="bg-[#fafafa]">
                                ${columns.map(col => `<th class="text-left py-2 px-3 font-medium text-[#000] border border-[#eaeaea]">${this.escapeHtml(col)}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${data.slice(0, 50).map(row => `
                                <tr class="hover:bg-[#fafafa]">
                                    ${columns.map(col => `<td class="py-2 px-3 border border-[#eaeaea] text-[#666] max-w-xs truncate">${this.escapeHtml(String(row[col] ?? ''))}</td>`).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <p class="text-13 text-[#888] mt-4">Showing first ${Math.min(data.length, 50)} of ${data.length} records (limited to 100)</p>
            `;

            this.openModal(`${tableName} Data`, tableHtml);
        } catch (error) {
            this.openModal(tableName, `<p class="text-center text-[#e00] py-8 text-14">Failed to fetch data: ${this.escapeHtml(error.message)}</p>`);
        }
    },

    renderTables(tables) {
        this.currentData.tables = tables;
        this.filterAndRenderTables();
    },

    filterAndRenderFunctions() {
        let filteredFunctions = [...this.currentData.functions]
            .filter(func => {
                // Don't show functions that require auth
                return func.testResults?.requiresAuth !== true;
            });
        if (this.filters.functionSearch) {
            filteredFunctions = filteredFunctions.filter(func => func.name.toLowerCase().includes(this.filters.functionSearch));
        }
        this.renderFunctionsList(filteredFunctions);
    },

    renderFunctionsList(functions) {
        if (functions.length === 0) {
            if (this.elements.functionsContent) this.elements.functionsContent.innerHTML = `<p class="text-[#666] text-center py-8 text-14">No RPC functions exposed</p>`;
            return;
        }

        const html = `
            <div class="overflow-x-auto">
                <table class="w-full text-13">
                    <thead>
                        <tr class="border-b border-[#eaeaea]">
                            <th class="text-left py-3 px-4 font-medium text-[#000]">Function Name</th>
                            <th class="text-center py-3 px-4 font-medium text-[#000]">Parameters</th>
                            <th class="text-center py-3 px-4 font-medium text-[#000]">Return Type</th>
                            <th class="text-center py-3 px-4 font-medium text-[#000]">Auth</th>
                            <th class="text-center py-3 px-4 font-medium text-[#000]">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${functions.map(func => {
                            const requiresAuth = func.testResults?.requiresAuth;
                            const returnType = func.returnType || 'void';
                            return `
                                <tr class="border-b border-[#eaeaea] hover:bg-[#fafafa] transition-colors">
                                    <td class="py-3 px-4">
                                        <span class="font-mono text-[#000] font-medium">${this.escapeHtml(func.name)}()</span>
                                    </td>
                                    <td class="py-3 px-4 text-center text-[#666]">${func.parameters.length}</td>
                                    <td class="py-3 px-4 text-center font-mono text-[#666]">${this.escapeHtml(returnType)}</td>
                                    <td class="py-3 px-4 text-center">
                                        ${requiresAuth === true ? '<span class="badge-severity badge-success">Required</span>' : requiresAuth === 'unknown' ? '<span class="badge-severity badge-info">Unknown</span>' : '<span class="badge-severity badge-medium">Public</span>'}
                                    </td>
                                    <td class="py-3 px-4 text-center">
                                        <button class="call-func-btn h-7 px-3 text-13 font-medium rounded-vercel border border-[#eaeaea] text-[#666] hover:border-[#000] hover:text-[#000] transition-colors" data-function="${this.escapeHtml(func.name)}" data-params='${JSON.stringify(func.parameters)}'>
                                            Call
                                        </button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        if (this.elements.functionsContent) {
            this.elements.functionsContent.innerHTML = html;
            document.querySelectorAll('.call-func-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const funcName = btn.dataset.function;
                    const params = JSON.parse(btn.dataset.params || '[]');
                    this.showCallFunctionModal(funcName, params);
                });
            });
        }
    },

    showCallFunctionModal(funcName, parameters) {
        let paramsHtml = '';
        if (parameters && parameters.length > 0) {
            const paramInputs = parameters.map(param => {
                const paramName = this.escapeHtml(param.name);
                const paramType = param.type || 'string';
                const placeholder = paramType === 'integer' || paramType === 'number' ? '0' : paramType === 'boolean' ? 'true/false' : '';
                const required = param.required ? '<span class="text-[#e00]">*</span>' : '';
                return `<div class="mb-3">
                    <label class="block text-13 font-medium text-[#000] mb-1.5">
                        ${paramName} <span class="font-normal text-[#888]">(${paramType})</span> ${required}
                    </label>
                    <input type="text" id="param-${paramName}" 
                        class="w-full h-10 px-3 text-14 border border-[#eaeaea] rounded-vercel focus:outline-none focus:border-[#000] transition-colors" 
                        placeholder="${placeholder}">
                </div>`;
            }).join('');
            paramsHtml = `<div class="mb-4"><p class="text-13 text-[#666] mb-3">Enter parameter values:</p>${paramInputs}</div>`;
        } else {
            paramsHtml = '<p class="text-14 text-[#666] mb-4">This function takes no parameters.</p>';
        }

        const buttonHtml = `<button id="execute-func-btn" class="w-full h-10 bg-[#000] text-white text-14 font-medium rounded-vercel hover:bg-[#333] transition-colors">Call Function</button>`;
        const resultHtml = `<div id="func-result" class="mt-4 hidden">
            <h4 class="text-13 font-medium text-[#000] mb-2">Response:</h4>
            <pre id="func-result-content" class="p-4 bg-[#000] text-[#fff] rounded-vercel text-13 overflow-x-auto max-h-96 font-mono"></pre>
        </div>`;

        this.openModal(`Call ${funcName}()`, paramsHtml + buttonHtml + resultHtml);

        const executeBtn = document.getElementById('execute-func-btn');
        if (executeBtn) {
            executeBtn.addEventListener('click', () => this.executeRpcFunction(funcName, parameters));
        }
    },

    async executeRpcFunction(funcName, parameters) {
        const { projectUrl, anonKey } = this.currentData;
        if (!projectUrl || !anonKey) {
            this.showToast('Missing credentials', 'error');
            return;
        }

        const params = {};
        for (const param of parameters) {
            const input = document.getElementById(`param-${param.name}`);
            if (input && input.value) {
                let value = input.value;
                if (param.type === 'integer' || param.type === 'number') {
                    value = Number(value);
                } else if (param.type === 'boolean') {
                    value = value.toLowerCase() === 'true';
                } else {
                    try { value = JSON.parse(value); } catch (e) {}
                }
                params[param.name] = value;
            }
        }

        const resultDiv = document.getElementById('func-result');
        const resultContent = document.getElementById('func-result-content');

        if (resultDiv) resultDiv.classList.remove('hidden');
        if (resultContent) resultContent.textContent = 'Loading...';

        try {
            const response = await fetch(`${projectUrl}/rest/v1/rpc/${funcName}`, {
                method: 'POST',
                headers: { 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(params)
            });

            const responseText = await response.text();
            let result;
            try {
                result = JSON.parse(responseText);
                result = JSON.stringify(result, null, 2);
            } catch (e) {
                result = responseText || '(empty response)';
            }

            if (resultContent) {
                resultContent.textContent = `Status: ${response.status} ${response.statusText}\n\n${result}`;
            }
        } catch (error) {
            if (resultContent) resultContent.textContent = `Error: ${error.message}`;
        }
    },

    renderFunctions(functions) {
        this.currentData.functions = functions;
        this.filterAndRenderFunctions();
    },

    renderJWTInfo(jwtInfo) {
        if (!jwtInfo || !jwtInfo.valid) {
            if (this.elements.jwtContent) this.elements.jwtContent.innerHTML = `<p class="text-[#666] text-center py-4 text-14">Could not decode JWT token</p>`;
            return;
        }

        const html = `
            <div class="grid md:grid-cols-2 gap-3">
                <div class="space-y-2">
                    <div class="flex items-center justify-between p-3 bg-white rounded-vercel border border-[#eaeaea]">
                        <span class="text-13 text-[#666]">Status</span>
                        <span class="badge-severity ${jwtInfo.isExpired ? 'badge-critical' : 'badge-success'}">${jwtInfo.isExpired ? 'Expired' : 'Valid'}</span>
                    </div>
                    <div class="flex items-center justify-between p-3 bg-white rounded-vercel border border-[#eaeaea]">
                        <span class="text-13 text-[#666]">Role</span>
                        <span class="font-mono text-13 text-[#000]">${this.escapeHtml(jwtInfo.role || 'anon')}</span>
                    </div>
                </div>
                <div class="space-y-2">
                    ${jwtInfo.projectRef ? `<div class="flex items-center justify-between p-3 bg-white rounded-vercel border border-[#eaeaea]"><span class="text-13 text-[#666]">Project Ref</span><span class="font-mono text-13 text-[#000]">${this.escapeHtml(jwtInfo.projectRef)}</span></div>` : ''}
                    ${jwtInfo.expiresAt ? `<div class="flex items-center justify-between p-3 bg-white rounded-vercel border border-[#eaeaea]"><span class="text-13 text-[#666]">Expires</span><span class="text-13 text-[#000]">${jwtInfo.expiresAt.toLocaleDateString()}</span></div>` : ''}
                </div>
            </div>
        `;
        if (this.elements.jwtContent) this.elements.jwtContent.innerHTML = html;
    },

    renderDataExposure(exposure) {
        if (!exposure) {
            if (this.elements.exposureContent) this.elements.exposureContent.innerHTML = `<p class="text-[#666] text-center py-4 text-14">No exposure data</p>`;
            return;
        }

        const html = `
            <div class="grid md:grid-cols-3 gap-3">
                <div class="text-center p-3 bg-white rounded-vercel border border-[#eaeaea]">
                    <div class="text-lg font-semibold text-[#000]">${exposure.totalRows.toLocaleString()}</div>
                    <div class="text-13 text-[#666]">Total Rows</div>
                </div>
                <div class="text-center p-3 bg-white rounded-vercel border border-[#eaeaea]">
                    <div class="text-lg font-semibold text-[#000]">${exposure.totalColumns}</div>
                    <div class="text-13 text-[#666]">Total Columns</div>
                </div>
                <div class="text-center p-3 bg-white rounded-vercel border border-[#eaeaea]">
                    <div class="text-lg font-semibold ${exposure.writeAccessTables.length > 0 ? 'text-[#e00]' : 'text-[#0070f3]'}">${exposure.writeAccessTables.length}</div>
                    <div class="text-13 text-[#666]">Writable Tables</div>
                </div>
            </div>
        `;
        if (this.elements.exposureContent) this.elements.exposureContent.innerHTML = html;
    },

    renderBuckets(buckets) {
        if (!buckets || buckets.length === 0) {
            if (this.elements.bucketsContent) this.elements.bucketsContent.innerHTML = `<p class="text-[#666] text-center py-4 text-14">No storage buckets accessible</p>`;
            return;
        }

        const html = buckets.map(bucket => `
            <div class="flex items-center justify-between p-3 bg-white rounded-vercel border border-[#eaeaea]">
                <span class="font-mono text-13 text-[#000]">${this.escapeHtml(bucket.name || bucket.id)}</span>
                <div class="flex gap-2">
                    ${bucket.public ? '<span class="badge-severity badge-medium">Public</span>' : '<span class="badge-severity badge-success">Private</span>'}
                </div>
            </div>
        `).join('');

        if (this.elements.bucketsContent) this.elements.bucketsContent.innerHTML = html;
    },

    renderRemediations(remediations) {
        if (!remediations || remediations.length === 0) {
            const tables = this.currentData.tables.filter(t => t.access?.rowCount > 0);
            if (tables.length === 0) {
                if (this.elements.remediationContent) this.elements.remediationContent.innerHTML = `
                    <div class="text-center py-12">
                        <svg class="w-12 h-12 mx-auto mb-4" fill="none" stroke="#0070f3" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <p class="font-medium text-[#000] text-14">No remediations needed!</p>
                    </div>
                `;
                return;
            }

            const dynamicRemediations = [];
            tables.forEach(table => {
                dynamicRemediations.push({
                    title: `Enable RLS for ${table.name}`,
                    description: `${table.access?.rowCount?.toLocaleString() || 0} records are publicly exposed`,
                    code: `-- Enable Row Level Security for ${table.name}
ALTER TABLE public.${table.name} ENABLE ROW LEVEL SECURITY;

-- Deny all access by default
CREATE POLICY "Deny all access" ON public.${table.name}
    FOR ALL USING (false);

-- Or allow authenticated users only
CREATE POLICY "Allow authenticated" ON public.${table.name}
    FOR SELECT USING (auth.role() = 'authenticated');`
                });
            });
            remediations = dynamicRemediations;
        }

        const html = remediations.map((rem, index) => `
            <div class="border border-[#eaeaea] rounded-vercel overflow-hidden">
                <div class="p-4 bg-[#fafafa] border-b border-[#eaeaea]">
                    <div class="flex items-center justify-between">
                        <div>
                            <h4 class="font-medium text-[#000] text-14">${this.escapeHtml(rem.title)}</h4>
                            <p class="text-13 text-[#666]">${this.escapeHtml(rem.description)}</p>
                        </div>
                        <button class="h-8 px-3 rounded-vercel border border-[#eaeaea] text-[#666] text-13 font-medium hover:border-[#000] hover:text-[#000] transition-colors copy-code-btn" data-code-index="${index}">Copy</button>
                    </div>
                </div>
                <div class="p-4 bg-[#000] overflow-x-auto">
                    <pre class="text-13 text-[#fff] font-mono whitespace-pre-wrap">${this.escapeHtml(rem.code)}</pre>
                </div>
            </div>
        `).join('');

        if (this.elements.remediationContent) {
            this.elements.remediationContent.innerHTML = html;
            document.querySelectorAll('.copy-code-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const index = parseInt(btn.dataset.codeIndex);
                    const code = remediations[index].code;
                    navigator.clipboard.writeText(code).then(() => this.showToast('Copied!', 'success')).catch(() => this.showToast('Failed to copy', 'error'));
                });
            });
        }
    },

    renderReport(report) {
        this.currentData.projectUrl = UI.elements.projectUrl?.value?.trim()?.replace(/\/+$/, '') || '';
        this.currentData.anonKey = UI.elements.anonKey?.value?.trim() || '';

        this.renderStickyHeader(report.summary);
        this.updateSidebarCounts(report.summary);
        this.renderSummary(report.summary);
        this.renderRiskScore(report.summary.riskScore);
        this.renderChecklist(report.checklist);
        this.renderIssues(report.issues);
        this.renderTables(report.tables);
        this.renderFunctions(report.functions);
        this.renderJWTInfo(report.jwtInfo);
        this.renderDataExposure(report.dataExposure);
        this.renderBuckets(report.buckets);
        this.renderRemediations(report.remediations);
        this.showResults();
        
        // Setup scroll spy after results are rendered
        setTimeout(() => {
            this.setupScrollSpy();
        }, 100);
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = UI;
}
