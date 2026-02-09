/**
 * Supabase Detector Module
 * Detects Supabase usage and extracts project URL and anon key from HTML content
 * Based on the detection patterns from the browser extension
 */

const SupabaseDetector = {
    detected: false,
    detectionDetails: [],
    projectUrl: null,
    anonKey: null,

    /**
     * Detect Supabase credentials from a frontend URL
     * @param {string} frontendUrl - The frontend website URL to analyze
     * @returns {Promise<Object>} Object containing projectUrl and anonKey if found
     */
    async detectFromUrl(frontendUrl) {
        try {
            // Reset state
            this.detected = false;
            this.detectionDetails = [];
            this.projectUrl = null;
            this.anonKey = null;

            // Normalize URL
            let url = frontendUrl.trim();
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }

            UI.showLoading('Fetching website content...');

            // Fetch the page content using CORS proxy
            const pageContent = await this.fetchPageContent(url);
            
            if (!pageContent) {
                throw new Error('Could not fetch page content. CORS may be blocking the request.');
            }

            UI.showLoading('Analyzing page for Supabase usage...');

            // Parse and analyze the content
            await this.analyzeContent(pageContent, url);

            // Log detection details for debugging
            console.log('Detection results:', {
                detected: this.detected,
                projectUrl: this.projectUrl,
                anonKey: this.anonKey ? `${this.anonKey.substring(0, 20)}...` : null,
                details: this.detectionDetails
            });

            // Provide detailed feedback
            if (!this.detected) {
                const detailsMsg = this.detectionDetails.length > 0 
                    ? ` Detection details: ${this.detectionDetails.slice(0, 3).join(', ')}`
                    : '';
                throw new Error(`No Supabase usage detected on this page.${detailsMsg} The credentials may be in JavaScript bundles that require authentication to access, or the page may load them dynamically. Please try manual entry.`);
            }

            if (!this.projectUrl || !this.anonKey) {
                const detectedMsg = this.detectionDetails.length > 0 
                    ? ` Detected patterns: ${this.detectionDetails.slice(0, 5).join(', ')}.`
                    : '';
                const partialInfo = [];
                if (this.projectUrl) partialInfo.push(`found project URL: ${this.projectUrl}`);
                if (this.anonKey) partialInfo.push('found anon key');
                
                const partialMsg = partialInfo.length > 0 
                    ? ` Partially detected: ${partialInfo.join(' and ')}.`
                    : '';
                    
                throw new Error(`Supabase detected but could not extract both project URL and anon key.${detectedMsg}${partialMsg} The credentials may be in minified JavaScript bundles or require authentication. Please enter them manually.`);
            }

            return {
                projectUrl: this.projectUrl,
                anonKey: this.anonKey,
                details: this.detectionDetails
            };
        } catch (error) {
            console.error('Detection error:', error);
            throw error;
        }
    },

    /**
     * Fetch page content using CORS proxy
     * @param {string} url - URL to fetch
     * @returns {Promise<string>} HTML content
     */
    async fetchPageContent(url) {
        // Try multiple CORS proxy services with longer timeout
        const proxies = [
            `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
            `https://corsproxy.io/?${encodeURIComponent(url)}`,
            `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
            `https://cors-anywhere.herokuapp.com/${url}`,
            `https://thingproxy.freeboard.io/fetch/${url}`
        ];

        let lastError = null;
        for (let i = 0; i < proxies.length; i++) {
            const proxyUrl = proxies[i];
            try {
                UI.showLoading(`Fetching content (${i + 1}/${proxies.length})...`);
                
                // Create AbortController for better timeout control
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
                
                const response = await fetch(proxyUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                    },
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (response.ok) {
                    const content = await response.text();
                    if (content && content.length > 100) {
                        return content;
                    }
                }
            } catch (e) {
                lastError = e;
                // Don't log timeout errors as they're expected
                if (!e.name || e.name !== 'AbortError') {
                    console.log('Proxy failed, trying next...', e.message || e);
                }
                continue;
            }
        }

        // If all proxies fail, try direct fetch (may fail due to CORS)
        try {
            UI.showLoading('Trying direct fetch...');
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            const response = await fetch(url, {
                method: 'GET',
                mode: 'cors',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                return await response.text();
            }
        } catch (e) {
            lastError = e;
            if (!e.name || e.name !== 'AbortError') {
                console.log('Direct fetch also failed:', e.message || e);
            }
        }

        // If we get here, all methods failed
        if (lastError) {
            const errorMsg = lastError.name === 'AbortError' 
                ? 'Request timed out. The website may be slow or blocking requests.'
                : `Could not fetch page content. CORS may be blocking the request. Error: ${lastError.message}`;
            throw new Error(errorMsg);
        }
        
        throw new Error('Could not fetch page content. Please check the URL and try again.');
    },

    /**
     * Analyze HTML content for Supabase usage and extract credentials
     * @param {string} htmlContent - HTML content to analyze
     * @param {string} baseUrl - Base URL of the page
     */
    async analyzeContent(htmlContent, baseUrl) {
        // Create a temporary DOM parser
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');

        // 1. Check script sources for Supabase URLs
        this.checkScriptSources(doc);
        
        // 2. Check link hrefs for Supabase URLs
        this.checkLinkHrefs(doc);
        
        // 3. Check for Supabase-related JavaScript globals and patterns
        this.checkJavaScriptGlobals(doc);
        
        // 4. Check text content for Supabase references
        this.checkTextContent(htmlContent);
        
        // 5. Check for bundled/minified Supabase code
        this.checkBundledCode(doc);
        
        // 6. Extract credentials from various patterns
        this.extractCredentials(htmlContent);
        
        // 7. If we detected Supabase but don't have credentials, try fetching JS files
        if (this.detected && (!this.projectUrl || !this.anonKey)) {
            UI.showLoading('Fetching JavaScript files to extract credentials...');
            await this.fetchAndAnalyzeJavaScriptFiles(doc, baseUrl);
        }
    },

    /**
     * Check script sources for Supabase URLs
     */
    checkScriptSources(doc) {
        const scripts = doc.querySelectorAll('script[src]');
        scripts.forEach(script => {
            const src = script.getAttribute('src');
            if (src && this.isSupabaseURL(src)) {
                this.detected = true;
                const projectUrl = this.extractProjectUrl(src);
                if (projectUrl) this.projectUrl = projectUrl;
                this.detectionDetails.push(`Script source: ${src}`);
            }
        });
    },

    /**
     * Check link hrefs for Supabase URLs
     */
    checkLinkHrefs(doc) {
        const links = doc.querySelectorAll('link[href]');
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (href && this.isSupabaseURL(href)) {
                this.detected = true;
                const projectUrl = this.extractProjectUrl(href);
                if (projectUrl) this.projectUrl = projectUrl;
                this.detectionDetails.push(`Link href: ${href}`);
            }
        });
    },

    /**
     * Check for Supabase-related JavaScript globals and patterns
     */
    checkJavaScriptGlobals(doc) {
        const globalChecks = [
            'supabaseClient',
            'createClient',
            'supabase',
            'Supabase',
            'SUPABASE_URL',
            'SUPABASE_ANON_KEY',
            '_supabase',
            'supabaseAuth'
        ];
        
        // Check inline scripts for Supabase patterns
        const scripts = doc.querySelectorAll('script:not([src])');
        scripts.forEach(script => {
            const content = script.textContent || script.innerHTML;
            if (content) {
                // Check for global variable assignments
                globalChecks.forEach(globalName => {
                    const pattern = new RegExp(`${globalName}\\s*[=:]\\s*['"]([^'"]+)['"]`, 'i');
                    const match = content.match(pattern);
                    if (match && match[1]) {
                        this.detected = true;
                        const value = match[1];
                        if (this.isSupabaseURL(value)) {
                            this.projectUrl = this.extractProjectUrl(value) || value;
                        } else if (value.startsWith('eyJ')) {
                            this.anonKey = value;
                        }
                        this.detectionDetails.push(`Global variable: ${globalName} = ${value.substring(0, 50)}...`);
                    }
                });

                // Check for common Supabase import patterns
                const supabasePatterns = [
                    /createClient\s*\(/,
                    /from\s+['"]@supabase/,
                    /import.*supabase/i,
                    /supabaseUrl/i,
                    /supabaseKey/i,
                    /\.supabase\.co/,
                    /\.supabase\.com/,
                    /\/rest\/v1\//,
                    /\/auth\/v1\//,
                    /\/realtime\/v1\//,
                    /"supabase-js"/,
                    /supabase.*client/i,
                    /NEXT_PUBLIC_SUPABASE/,
                    /REACT_APP_SUPABASE/,
                    /VITE_SUPABASE/,
                    /process\.env.*SUPABASE/i
                ];
                
                supabasePatterns.forEach(pattern => {
                    if (pattern.test(content)) {
                        this.detected = true;
                        this.detectionDetails.push(`Script content pattern: ${pattern.source}`);
                    }
                });
            }
        });
    },

    /**
     * Check text content for Supabase references
     */
    checkTextContent(htmlContent) {
        const patterns = [
            /supabase\.co/i,
            /supabase\.com/i,
            /powered by supabase/i
        ];
        
        patterns.forEach(pattern => {
            if (pattern.test(htmlContent)) {
                this.detected = true;
                this.detectionDetails.push(`Text content: ${pattern.source}`);
            }
        });
    },

    /**
     * Check for bundled/minified Supabase code
     */
    checkBundledCode(doc) {
        const allScripts = doc.querySelectorAll('script');
        allScripts.forEach(script => {
            const content = script.textContent || script.innerHTML;
            if (content && content.length > 1000) { // Only check substantial scripts
                const bundlePatterns = [
                    /supabase-js/i,
                    /createClient.*from.*supabase/i,
                    /\.supabase\.co/,
                    /\.supabase\.com/,
                    /postgrest/i,
                    /gotrue/i,
                    /realtime.*supabase/i,
                    /[a-zA-Z_$][a-zA-Z0-9_$]*\.from\(['"][^'"]*supabase/,
                    /[a-zA-Z_$][a-zA-Z0-9_$]*\.createClient/
                ];
                
                bundlePatterns.forEach(pattern => {
                    if (pattern.test(content)) {
                        this.detected = true;
                        this.detectionDetails.push(`Bundled code pattern: ${pattern.source}`);
                    }
                });
            }
        });
    },

    /**
     * Extract credentials from various patterns in HTML content
     */
    extractCredentials(htmlContent) {
        // 1. Extract from environment variable patterns
        const envPatterns = [
            /NEXT_PUBLIC_SUPABASE_URL[=:]\s*['"]([^'"]+)['"]/i,
            /REACT_APP_SUPABASE_URL[=:]\s*['"]([^'"]+)['"]/i,
            /VITE_SUPABASE_URL[=:]\s*['"]([^'"]+)['"]/i,
            /SUPABASE_URL[=:]\s*['"]([^'"]+)['"]/i,
            /supabaseUrl[=:]\s*['"]([^'"]+)['"]/i,
            /SUPABASE_URL[=:]\s*([^\s;]+)/i
        ];

        envPatterns.forEach(pattern => {
            const match = htmlContent.match(pattern);
            if (match && match[1]) {
                const url = match[1].trim();
                if (this.isSupabaseURL(url)) {
                    this.detected = true;
                    this.projectUrl = this.extractProjectUrl(url) || url;
                    this.detectionDetails.push(`Found Supabase URL in environment variable: ${url}`);
                }
            }
        });

        // 2. Extract anon key from environment variables
        const keyPatterns = [
            /NEXT_PUBLIC_SUPABASE_ANON_KEY[=:]\s*['"]([^'"]+)['"]/i,
            /REACT_APP_SUPABASE_ANON_KEY[=:]\s*['"]([^'"]+)['"]/i,
            /VITE_SUPABASE_ANON_KEY[=:]\s*['"]([^'"]+)['"]/i,
            /SUPABASE_ANON_KEY[=:]\s*['"]([^'"]+)['"]/i,
            /supabaseAnonKey[=:]\s*['"]([^'"]+)['"]/i,
            /anonKey[=:]\s*['"]([^'"]+)['"]/i
        ];

        keyPatterns.forEach(pattern => {
            const match = htmlContent.match(pattern);
            if (match && match[1]) {
                const key = match[1].trim();
                if (key.startsWith('eyJ') || key.startsWith('sb_publishable_')) {
                    this.detected = true;
                    this.anonKey = key;
                    this.detectionDetails.push('Found Supabase anon key in environment variable');
                }
            }
        });

        // 3. Extract from createClient patterns
        const createClientPatterns = [
            // createClient(url, key)
            /createClient\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/,
            // createClient({ url: ..., anonKey: ... })
            /createClient\s*\(\s*\{[^}]*url:\s*['"]([^'"]+)['"][^}]*anonKey:\s*['"]([^'"]+)['"]/,
            // createClient({ anonKey: ..., url: ... })
            /createClient\s*\(\s*\{[^}]*anonKey:\s*['"]([^'"]+)['"][^}]*url:\s*['"]([^'"]+)['"]/,
            // Multi-line patterns
            /createClient\s*\([^)]*url[^:]*:\s*['"]([^'"]+)['"][^)]*anonKey[^:]*:\s*['"]([^'"]+)['"]/s,
            /createClient\s*\([^)]*anonKey[^:]*:\s*['"]([^'"]+)['"][^)]*url[^:]*:\s*['"]([^'"]+)['"]/s
        ];

        createClientPatterns.forEach(pattern => {
            const match = htmlContent.match(pattern);
            if (match) {
                this.detected = true;
                // Check all capture groups
                for (let i = 1; i < match.length; i++) {
                    if (match[i]) {
                        if (this.isSupabaseURL(match[i])) {
                            this.projectUrl = this.extractProjectUrl(match[i]) || match[i];
                        } else if (match[i].startsWith('eyJ') || match[i].startsWith('sb_publishable_')) {
                            this.anonKey = match[i];
                        }
                    }
                }
                this.detectionDetails.push('Found createClient pattern');
            }
        });

        // 4. Extract JWT tokens (anon keys) from content - be more aggressive
        const jwtPattern = /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
        const jwtMatches = htmlContent.match(jwtPattern);
        if (jwtMatches && jwtMatches.length > 0) {
            // Sort by length (longer JWTs are more likely to be anon keys)
            const sortedJWTs = jwtMatches.sort((a, b) => b.length - a.length);
            // Use the longest valid-looking JWT (anon keys are typically 200+ chars)
            const validJWT = sortedJWTs.find(jwt => jwt.length > 50);
            if (validJWT && !this.anonKey) {
                this.detected = true;
                this.anonKey = validJWT;
                this.detectionDetails.push('Found JWT token in page content');
            }
        }

        // 4b. Extract from minified/bundled code patterns (more aggressive)
        // Look for patterns like: "https://xxx.supabase.co","eyJ..."
        const bundledPattern1 = /["'](https?:\/\/[^"']+\.supabase\.(co|in|com))["'][^"']*["'](eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)["']/;
        const bundledMatch1 = htmlContent.match(bundledPattern1);
        if (bundledMatch1) {
            this.detected = true;
            if (!this.projectUrl) this.projectUrl = this.extractProjectUrl(bundledMatch1[1]) || bundledMatch1[1];
            if (!this.anonKey) this.anonKey = bundledMatch1[3];
            this.detectionDetails.push('Found credentials in bundled code pattern');
        }

        // Look for patterns like: url:"https://xxx.supabase.co",key:"eyJ..."
        const bundledPattern2 = /url\s*:\s*["'](https?:\/\/[^"']+\.supabase\.(co|in|com))["'][^}]*key\s*:\s*["'](eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)["']/;
        const bundledMatch2 = htmlContent.match(bundledPattern2);
        if (bundledMatch2) {
            this.detected = true;
            if (!this.projectUrl) this.projectUrl = this.extractProjectUrl(bundledMatch2[1]) || bundledMatch2[1];
            if (!this.anonKey) this.anonKey = bundledMatch2[3];
            this.detectionDetails.push('Found credentials in object pattern');
        }

        // Look for patterns in arrays: ["https://xxx.supabase.co","eyJ..."]
        const bundledPattern3 = /\[["'](https?:\/\/[^"']+\.supabase\.(co|in|com))["']\s*,\s*["'](eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)["']\]/;
        const bundledMatch3 = htmlContent.match(bundledPattern3);
        if (bundledMatch3) {
            this.detected = true;
            if (!this.projectUrl) this.projectUrl = this.extractProjectUrl(bundledMatch3[1]) || bundledMatch3[1];
            if (!this.anonKey) this.anonKey = bundledMatch3[3];
            this.detectionDetails.push('Found credentials in array pattern');
        }

        // 5. Extract Supabase URLs from content
        const urlPattern = /https?:\/\/[a-zA-Z0-9-]+\.supabase\.(co|in|com)/g;
        const urlMatches = htmlContent.match(urlPattern);
        if (urlMatches && urlMatches.length > 0 && !this.projectUrl) {
            this.detected = true;
            this.projectUrl = this.extractProjectUrl(urlMatches[0]) || urlMatches[0];
            this.detectionDetails.push(`Found Supabase URL: ${urlMatches[0]}`);
        }

        // Clean up extracted values
        if (this.projectUrl) {
            this.projectUrl = this.projectUrl.replace(/\/+$/, '');
        }
        if (this.anonKey) {
            this.anonKey = this.anonKey.replace(/^['"]|['"]$/g, '').trim();
        }
    },

    /**
     * Check if URL is Supabase-related
     * @param {string} url - URL to check
     * @returns {boolean}
     */
    isSupabaseURL(url) {
        if (!url) return false;
        
        const supabasePatterns = [
            /\.supabase\.co/,
            /\.supabase\.in/,
            /\.supabase\.com/,
            /supabase\.io/,
            /\/rest\/v1\//,
            /\/auth\/v1\//,
            /\/realtime\/v1\//,
            /\/storage\/v1\//,
            /\/functions\/v1\//,
            /supabase.*\.co/,
            /[a-zA-Z0-9-]+\.supabase\.co/,
            /[a-zA-Z0-9]{20,}\.supabase\.co/
        ];
        
        return supabasePatterns.some(pattern => pattern.test(url));
    },

    /**
     * Extract project URL from a Supabase URL
     * @param {string} url - Full URL
     * @returns {string|null} Project URL
     */
    extractProjectUrl(url) {
        if (!url) return null;

        // Match patterns like https://xxxxx.supabase.co
        const match = url.match(/(https?:\/\/[a-zA-Z0-9-]+\.supabase\.(co|in|com))/);
        if (match) {
            return match[1];
        }

        // Match patterns like https://xxxxx.supabase.co/rest/v1/...
        const restMatch = url.match(/(https?:\/\/[a-zA-Z0-9-]+\.supabase\.(co|in|com))\/rest/);
        if (restMatch) {
            return restMatch[1];
        }

        return null;
    },

    /**
     * Fetch and analyze JavaScript files referenced in the page
     * @param {Document} doc - Parsed HTML document
     * @param {string} baseUrl - Base URL of the page
     */
    async fetchAndAnalyzeJavaScriptFiles(doc, baseUrl) {
        const scripts = doc.querySelectorAll('script[src]');
        const jsFiles = [];
        
        // Collect JavaScript file URLs
        scripts.forEach(script => {
            const src = script.getAttribute('src');
            if (src) {
                // Convert relative URLs to absolute
                let absoluteUrl = src;
                if (src.startsWith('//')) {
                    absoluteUrl = 'https:' + src;
                } else if (src.startsWith('/')) {
                    const urlObj = new URL(baseUrl);
                    absoluteUrl = urlObj.origin + src;
                } else if (!src.startsWith('http')) {
                    const urlObj = new URL(baseUrl);
                    absoluteUrl = urlObj.origin + '/' + src;
                }
                
                // Only fetch JS files (not external CDNs unless they're Supabase)
                if (src.endsWith('.js') || src.includes('.js?') || this.isSupabaseURL(absoluteUrl)) {
                    jsFiles.push(absoluteUrl);
                }
            }
        });

        // Limit to first 10 JS files to avoid too many requests
        const filesToFetch = jsFiles.slice(0, 10);
        
        // Fetch and analyze each JS file
        for (let i = 0; i < filesToFetch.length; i++) {
            const jsUrl = filesToFetch[i];
            try {
                UI.showLoading(`Analyzing JavaScript file ${i + 1}/${filesToFetch.length}...`);
                
                // Try to fetch via proxy
                const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(jsUrl)}`;
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);
                
                const response = await fetch(proxyUrl, {
                    method: 'GET',
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (response.ok) {
                    const jsContent = await response.text();
                    if (jsContent && jsContent.length > 100) {
                        // Analyze the JavaScript content
                        this.extractCredentials(jsContent);
                        
                        // If we found both, we can stop
                        if (this.projectUrl && this.anonKey) {
                            this.detectionDetails.push(`Found credentials in: ${jsUrl}`);
                            break;
                        }
                    }
                }
            } catch (e) {
                // Silently continue if a JS file can't be fetched
                if (e.name !== 'AbortError') {
                    console.log(`Could not fetch JS file ${jsUrl}:`, e.message);
                }
                continue;
            }
        }
    }
};
