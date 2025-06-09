/**
 * Web Terminal Bundle
 */
(function(global) {
    'use strict';

    const CSS_STYLES = `
        #terminalWrapper {
            position: fixed;
            bottom: -450px;
            left: 0;
            right: 0;
            height: 450px;
            background-color: rgba(0, 0, 0, 0.9);
            z-index: 9999;
            display: flex;
            flex-direction: column;
            transition: bottom 0.3s ease-in-out;
            border-top: 3px solid #333;
        }

        #terminalToggle {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 50px;
            height: 40px;
            border-radius: 5px;
            background-color: #000000;
            color: white;
            border: 1px solid white;
            display: flex;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            z-index: 10000;
            font-size: 20px;
            font-family: monospace;
            font-weight: bold;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        }

        #terminalHeader {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 16px;
            background-color: #333;
            color: #fff;
            cursor: move;
        }

        #terminal-tabs-container {
            display: none;
            align-items: center;
            overflow-x: auto;
        }

        .terminal-tabs-list {
            display: flex;
            align-items: center;
            overflow-x: auto;
        }

        .terminal-tab {
            font-family: monospace;
            padding: 5px 15px;
            margin-right: 5px;
            cursor: pointer;
            background-color: #444;
            border-radius: 4px 4px 0 0;
            transition: background-color 0.2s ease;
        }

        .terminal-tab:hover {
            background-color: #555 !important;
        }

        .active-tab {
            background-color: #444 !important;
            font-weight: bold;
        }

        #add-terminal-tab {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            margin-left: 5px;
            background-color: #333;
            color: #fff;
            border: 1px solid #555;
            border-radius: 4px;
            cursor: pointer;
            font-size: 18px;
            font-weight: bold;
        }

        #login-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            background: #111;
        }

        #github-login-button {
            display: flex;
            align-items: center;
            background-color: #24292e;
            color: white;
            border: none;
            border-radius: 6px;
            padding: 10px 16px;
            font-size: 16px;
            cursor: pointer;
            transition: background-color 0.2s;
        }

        #github-login-button:hover {
            background-color: #444;
        }

        .terminal-container {
            flex: 1;
            overflow: hidden;
            background: #000;
            width: 100%;
            display: none;
        }

        .active-container {
            display: block;
        }

        #connection-status {
            padding: 5px 10px;
            background: #222;
            color: #ccc;
            font-family: monospace;
            font-size: 12px;
            border-top: 1px solid #444;
            display: none;
        }

        #terminalResizeHandle {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 6px;
            cursor: ns-resize;
            background-color: #555;
            opacity: 0.7;
            transition: opacity 0.2s, background-color 0.2s;
        }

        #terminalResizeHandle:hover {
            opacity: 1;
            background-color: #888;
        }

        #terminalResizeHandle::before {
            content: "";
            position: absolute;
            left: 50%;
            top: 1px;
            transform: translateX(-50%);
            width: 40px;
            height: 3px;
            background-color: #ccc;
            border-radius: 2px;
        }

        #user-profile {
            display: flex;
            align-items: center;
            margin-right: 20px;
        }

        #user-avatar {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            margin-right: 8px;
        }
    `;

    // HTML template
    const HTML_TEMPLATE = `
        <button id="terminalToggle" data-turbo-permanent>
            >_
        </button>

        <div id="terminalWrapper" data-turbo-permanent>
            <div id="terminalResizeHandle"></div>
            
            <div id="terminalHeader">
                <div id="terminal-tabs-container">
                    <div class="terminal-tabs-list">
                        <div id="terminal-tab-1" class="terminal-tab active-tab">
                            Terminal 1
                        </div>
                        <button id="add-terminal-tab">+</button>
                    </div>
                </div>
                <div id="auth-status">
                    Not authenticated
                </div>
            </div>
            
            <div id="login-container">
                <button id="github-login-button">
                    <i class="fab fa-github" style="margin-right: 10px; font-size: 20px;"></i>
                    Sign in with GitHub
                </button>
            </div>
            
            <div id="terminal-container-1" class="terminal-container active-container"></div>
            
            <div id="connection-status"></div>
        </div>
    `;

    //  WebTerminalEmbed wrapper class used for initialization
    class WebTerminalEmbed {
        constructor(options = {}) {
            this.options = options;
            this.isInitialized = false;

            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.init());
            } else {
                this.init();
            }
        }

        init() {
            if (this.isInitialized) return;
            
            this.loadDependencies()
                .then(() => {
                    this.injectStyles();
                    this.createHTML();
                    this.setupConfig();
                    this.terminalLogic();
                    this.isInitialized = true;
                })
                .catch(error => {
                    console.error('Failed to initialize WebTerminalEmbed:', error);
                });
        }

        // Inject CSS
        injectStyles() {
            const styleElement = document.createElement('style');
            styleElement.id = 'web-terminal-styles';
            styleElement.textContent = CSS_STYLES;
            document.head.appendChild(styleElement);
        }

        // Create HTML
        createHTML() {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = HTML_TEMPLATE;
            
            while (tempDiv.firstChild) {
                document.body.appendChild(tempDiv.firstChild);
            }
        }

        // Setup config using user options
        setupConfig() {
            const currentDomain = window.location.hostname.replace(/^www\./, '');
            const isSecure = window.location.protocol === 'https:';
            const wsProtocol = isSecure ? 'wss://' : 'ws://';
            const httpProtocol = isSecure ? 'https://' : 'http://';
            const isLocalhost = currentDomain === 'localhost' || currentDomain.startsWith('127.0.0.1');
            
            // Validate required options
            const requiredOptions = ['githubClientId','githubAppName'];

            // backendDomain running Authorization and websocket server is required if not running on localhost
            if (!isLocalhost) {
                requiredOptions.push('backendDomain');
            }

            const missingOptions = requiredOptions.filter(option => !this.options[option]);

            if (missingOptions.length > 0) {
                const errorMessage = `WebTerminalEmbed: Missing required options: ${missingOptions.join(', ')}`;
                console.error(errorMessage);

                const requiredParams = {
                    githubClientId: 'Your GitHub OAuth App Client ID',
                    githubAppName: 'Your GitHub OAuth App Name'
                };

                if (!isLocalhost) {
                    requiredParams.backendDomain = 'The domain running the auth and websocket server';
                }

                console.error('Please provide these options when initializing:', requiredParams);

                // Throw an error to stop initialization
                throw new Error(errorMessage);
            }

            // Get backendDomain for URL construction
            const backendDomain = this.options.backendDomain;

            // Create CONFIG object with user overrides
            window.CONFIG = {               
                // GitHub OAuth app settings
                GITHUB_CLIENT_ID: this.options.githubClientId,
                GITHUB_APP_NAME: this.options.githubAppName,
                VM_TYPE: this.options.vmType || 'cka',
                GITHUB_SCOPE: this.options.githubScope || 'read:user',
                
                // Auth server related URLs
                AUTH_SERVER: this.options.authServer || (isLocalhost
                    ? 'http://localhost:3000'
                    : `${httpProtocol}auth.${backendDomain}`),
                GITHUB_REDIRECT_URI: this.options.githubRedirectUri || (isLocalhost 
                    ? 'http://localhost:3000/auth/github/callback' 
                    : `${httpProtocol}auth.${backendDomain}/auth/github/callback`),

               // WebSocket server URL
               WS_URL: this.options.wsUrl || (isLocalhost 
                ? `${wsProtocol}localhost:8081` 
                : `${wsProtocol}wss.${backendDomain}`),

                // Terminal settings
                DEFAULT_COLS: this.options.defaultCols || 120,
                DEFAULT_ROWS: this.options.defaultRows || 30,
                DEFAULT_HEIGHT: this.options.defaultHeight || 450,
                MIN_HEIGHT: this.options.minHeight || 200,
                MAX_HEIGHT: this.options.maxHeight || 800,
                
                // Connection settings
                MAX_CONNECT_ATTEMPTS: this.options.maxConnectAttempts || 3,
                CONNECT_RETRY_DELAY: this.options.connectRetryDelay || 2000,
                CONNECTION_TIMEOUT: this.options.connectionTimeout || 10000,
                
                // UI Settings
                TERMINAL_TRANSITION_SPEED: this.options.terminalTransitionSpeed || '0.3s',
                
                // Environment detection
                IS_PRODUCTION: !isLocalhost,
                DEBUG: this.options.debug || isLocalhost,

                // Store the backend domain for reference
                BACKEND_DOMAIN: backendDomain
            };

            if (window.CONFIG.DEBUG) {
                console.log('Terminal Configuration:', window.CONFIG);
                if (!isLocalhost) {
                    console.log('Constructed URLs from backend domain:', {
                        websocketUrl: window.CONFIG.WS_URL,
                        authServer: window.CONFIG.AUTH_SERVER,
                        redirectUri: window.CONFIG.GITHUB_REDIRECT_URI
                    });
                }
            }
        }

        // Load external dependencies
        loadDependencies() {
            return new Promise((resolve, reject) => {
                const dependencies = [
                    {
                        type: 'css',
                        url: 'https://cdn.jsdelivr.net/npm/xterm@5.1.0/css/xterm.min.css'
                    },
                    {
                        type: 'css',
                        url: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css'
                    },
                    {
                        type: 'js',
                        url: 'https://cdn.jsdelivr.net/npm/xterm@5.1.0/lib/xterm.min.js'
                    },
                    {
                        type: 'js',
                        url: 'https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.7.0/lib/xterm-addon-fit.min.js'
                    }
                ];

                let loadedCount = 0;
                const totalDeps = dependencies.length;

                dependencies.forEach(dep => {
                    if (dep.type === 'css') {
                        const link = document.createElement('link');
                        link.rel = 'stylesheet';
                        link.href = dep.url;
                        link.onload = () => {
                            loadedCount++;
                            if (loadedCount === totalDeps) resolve();
                        };
                        link.onerror = reject;
                        document.head.appendChild(link);
                    } else if (dep.type === 'js') {
                        const script = document.createElement('script');
                        script.src = dep.url;
                        script.onload = () => {
                            loadedCount++;
                            if (loadedCount === totalDeps) resolve();
                        };
                        script.onerror = reject;
                        document.head.appendChild(script);
                    }
                });
            });
        }

        // Initialize the terminal code
        terminalLogic() {

            //=============================================================================
            // STATE MANAGEMENT
            //=============================================================================
            const state = {
                // Terminal instances
                terminals: {},
                fitAddons: {},
                websockets: {},
                
                // UI state
                isTerminalVisible: false,
                activeTabId: "1",
                
                // Authentication state
                auth: {
                    isAuthenticated: false,
                    token: null,
                    userProfile: null
                }
            };
            
            // Connection attempt tracking flag
            let connectionInProgress = false;

            //=============================================================================
            // UTILITY MODULE - General helper functions
            //=============================================================================
            const Utility = {
                /**
                 * Format date for display
                 * @param {Date} date - Date to format
                 * @returns {string} Formatted date string
                 */
                formatDate(date) {
                const hours = date.getHours().toString().padStart(2, '0');
                const minutes = date.getMinutes().toString().padStart(2, '0');
                return `${hours}:${minutes}`;
                },
            
                /**
                 * Log message to console and optionally to UI
                 * @param {string} message - Message to log
                 * @param {string} type - Message type: 'info', 'error', 'success'
                 * @param {string} tabId - Tab identifier
                 */
                log(message, type = 'info', tabId = state.activeTabId) {
                if (window.CONFIG.DEBUG) {
                    console.log(`[Tab ${tabId}] ${message}`);
                }
                
                // Update status panel if needed
                if (type === 'error' || type === 'success') {
                    this.updateStatusPanel(message, type);
                }
                },
                
                /**
                 * Update the status panel with a message
                 * @param {string} message - Message to display
                 * @param {string} type - Message type: 'info', 'error', 'success'
                 */
                updateStatusPanel(message, type = 'info') {
                const statusPanel = this.getElement('connection-status');
                if (!statusPanel) return;
                
                // Color-code messages
                let color = '#ccc';
                if (type === 'error') color = '#ff5555';
                if (type === 'success') color = '#55ff55';
                if (type === 'info') color = '#5555ff';
                
                statusPanel.innerHTML = `<span style="color: ${color}">${message}</span>`;
                statusPanel.style.display = 'block';
                },
                
                /**
                 * Get DOM element safely with error logging
                 * @param {string} id - Element ID
                 * @param {boolean} required - Whether the element is required
                 * @returns {HTMLElement|null} The element or null if not found
                 */
                getElement(id, required = false) {
                const element = document.getElementById(id);
                if (!element && required) {
                    console.error(`Required element not found: ${id}`);
                }
                return element;
                },
                
                /**
                 * Generate a unique ID
                 * @returns {string} A unique identifier
                 */
                generateUniqueId() {
                return Date.now().toString(36) + Math.random().toString(36).substring(2);
                }
            };
            
            //=============================================================================
            // AUTH MODULE - Authentication related functionality
            //=============================================================================
            const Auth = {
                /**
                 * Get an auth token from cookies
                 * @returns {string|null} Auth token or null if not found
                 */
                getAuthTokenFromCookie() {
                // Try cookie first
                const cookies = document.cookie.split(';');
                for (let cookie of cookies) {
                    const [name, value] = cookie.trim().split('=');
                    if (name === 'auth_token') {
                    return value;
                    }
                }
                return null;
                },
                
                /**
                 * Clear all authentication data from cookie and localStorage
                 */
                clearAuthData() {
                // Clear localStorage items
                localStorage.removeItem('terminal_auth_token');
                localStorage.removeItem('terminal_user_profile');
                localStorage.removeItem('github_oauth_state');
                
                // Clear auth cookies
                document.cookie = 'auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                
                // Update application state
                state.auth.token = null;
                state.auth.userProfile = null;
                state.auth.isAuthenticated = false;
                
                // Update UI elements
                this.updateAuthUI();
                
                // Log the status
                Utility.log('Session expired. Authentication cleared.', 'error');
                },
                
                /**
                 * Start GitHub OAuth flow
                 */
                initiateGitHubLogin() {
                // Save current state to check against CSRF
                const oauthState = Math.random().toString(36).substring(2, 15);

                // Add app name to the state
                const gitHubAppName = window.CONFIG.GITHUB_APP_NAME;
                const fullState = `${oauthState}_${gitHubAppName}`;

                // Store the state for CSRF validation
                localStorage.setItem('github_oauth_state', fullState);
                
                // Build GitHub authorization URL
                const authUrl = `https://github.com/login/oauth/authorize?client_id=${window.CONFIG.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(window.CONFIG.GITHUB_REDIRECT_URI)}&scope=${encodeURIComponent(window.CONFIG.GITHUB_SCOPE)}&state=${fullState}`;
                
                // Log debug info
                if (window.CONFIG.DEBUG) {
                    console.log('Initiating GitHub OAuth flow');
                    console.log('GitHub App Name:', gitHubAppName);
                    console.log('Full OAuth State:', fullState);
                    console.log('GitHub Authorization URL:', authUrl);
                }
                
                // Redirect to GitHub
                window.location.href = authUrl;
                },
                
                /**
                 * Handle OAuth callback
                 */
                handleOAuthCallback() {
                const urlParams = new URLSearchParams(window.location.search);
                const authSuccess = urlParams.get('auth_success');
                
                if (authSuccess === 'true') {
                    // Clean URL parameters
                    window.history.replaceState({}, document.title, window.location.pathname);
                    
                    // Set flag for GitHub login path
                    sessionStorage.setItem('from_github_login', 'true');
                    
                    // Use existing token validation function
                    this.validateTokenFromCookie();
                }
                },
                
                /**
                 * Validate token from cookie
                 */
                validateTokenFromCookie() {
                const authToken = this.getAuthTokenFromCookie();
                
                if (!authToken) {
                    console.warn('No auth token cookie found');
                    this.updateAuthStatus('No authentication token found', 'error');
                    return;
                }
                
                this.updateAuthStatus('Validating token...', 'info');
                
                // Validate token with auth server
                fetch(`${window.CONFIG.AUTH_SERVER}/validate-token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include'
                })
                .then(response => {
                    if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.valid && data.user) {          
                    // Create user profile
                    const userProfile = {
                        login: data.user.username,
                        name: data.user.username,
                        avatar_url: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'
                    };
                    
                    // Set authenticated state
                    this.setAuthenticatedState(authToken, userProfile);
                    
                    // Show terminal
                    UI.showTerminal();
                    
                    // Connect to session
                    TerminalManager.initializeAndConnectTerminal(state.activeTabId);
                    } else {
                    this.updateAuthStatus('Token validation failed', 'error');
                    }
                })
                .catch(error => {
                    console.error('Token Validation Error:', error);
                    this.updateAuthStatus('Error validating token', 'error');
                });
                },
                
                /**
                 * Set authenticated state
                 * @param {string} token - Auth token
                 * @param {Object} profile - User profile
                 * @returns {boolean} Success status
                 */
                setAuthenticatedState(token, profile) {
                if (!profile || !profile.login || profile.login === '') {
                    console.error('Cannot authenticate with invalid profile');
                    this.updateAuthStatus('Authentication failed: Invalid user profile', 'error');
                    return false;
                }
                
                // Set auth state
                state.auth.token = token;
                state.auth.userProfile = profile;
                state.auth.isAuthenticated = true;
                
                // Store in localStorage for persistence
                localStorage.setItem('terminal_auth_token', token);
                localStorage.setItem('terminal_user_profile', JSON.stringify(profile));
                
                // Update UI
                this.updateAuthUI();
                
                return true;
                },
                
                /**
                 * Update authentication status display
                 * @param {string} message - Status message
                 * @param {string} type - Message type: 'info', 'error', 'success'
                 */
                updateAuthStatus(message, type = 'info') {
                const authStatus = Utility.getElement('auth-status');
                if (!authStatus) return;
                
                let color = '#ccc';
                if (type === 'error') color = '#ff5555';
                if (type === 'success') color = '#55ff55';
                if (type === 'info') color = '#5555ff';
                
                authStatus.innerText = message;
                authStatus.style.color = color;
                },
                
                /**
                 * Update UI based on auth state
                 */
                updateAuthUI() {
                const authStatus = Utility.getElement('auth-status');
                if (!authStatus) return;
                
                if (state.auth.isAuthenticated && state.auth.userProfile) {
                    // Update auth status with user profile
                    authStatus.innerHTML = `
                    <div id="user-profile">
                        <img src="${state.auth.userProfile.avatar_url}" alt="${state.auth.userProfile.login}" 
                            width="24" height="24" style="border-radius: 50%; vertical-align: middle;" />
                        <span>${state.auth.userProfile.name || state.auth.userProfile.login}</span>
                    </div>
                    `;

                    // Update style to position in right corner
                    authStatus.style.marginLeft = 'auto';
                    authStatus.style.marginRight = '10px';
                    authStatus.style.order = '3';
                } else {
                    // Show not authenticated
                    authStatus.innerText = 'Not authenticated';
                    authStatus.style.color = '#ff5555';
                }
                },
                
                /**
                 * Check for existing authentication
                 * @returns {boolean} Authentication status
                 */
                checkExistingAuth() {
                // Check for existing authentication in localStorage
                const storedToken = localStorage.getItem('terminal_auth_token');
                const storedProfile = localStorage.getItem('terminal_user_profile');
                
                // Also check cookie
                const cookieToken = this.getAuthTokenFromCookie();
                
                // If we have a stored profile and either token, consider authenticated
                if (storedProfile && (storedToken || cookieToken)) {
                    try {
                    const profile = JSON.parse(storedProfile);
                    
                    if (profile && profile.login && profile.login !== '') {
                        console.log('Found valid profile in storage:', profile.login);
                        
                        // Use whichever token we found
                        const token = storedToken || cookieToken;
                        
                        // Set auth state
                        state.auth.token = token;
                        state.auth.userProfile = profile;
                        state.auth.isAuthenticated = true;
                        
                        // Update UI
                        this.updateAuthUI();
                        
                        return true;
                    }
                    } catch (e) {
                    console.error('Error parsing stored profile:', e);
                    }
                }
                
                // If we have a cookie token but no stored token, validate it
                if (cookieToken && !storedToken) {
                    this.validateTokenFromCookie();
                    return false; // Return false since validation is async
                }
                
                return false;
                }
            };

            //=============================================================================
            // CONNECTION MODULE - WebSocket connection management
            //=============================================================================
            const Connection = {
                /**
                 * Connect to WebSocket server with JWT authentication
                 * @param {string} tabId - Tab identifier
                 * @param {boolean} checkExistingSession - Force check for existing sessions
                 * @returns {Promise} Connection promise
                 */
                connectWebSocket(tabId, checkExistingSession = false) {
                return new Promise((resolve, reject) => {
                    // Close existing connection if any
                    if (state.websockets[tabId]) {
                    try {
                        state.websockets[tabId].close();
                    } catch (e) {
                        console.error(`Error closing existing websocket for tab ${tabId}:`, e);
                    }
                    }
                    
                    // Get auth token - try all possible storage locations
                    let authToken = Auth.getAuthTokenFromCookie();
                    
                    // If not in cookie, try localStorage backups
                    if (!authToken) {
                    authToken = localStorage.getItem('terminal_auth_token');
                    }
                    
                    if (!authToken) {
                    Utility.log('Cannot connect: Missing authentication token', 'error');
                    reject(new Error('Missing authentication token'));
                    return;
                    }

                    // Get user ID for connection
                    const userId = state.auth.userProfile?.login;
                    const terminalId = 'terminal_' + tabId + '_' + Utility.generateUniqueId();
                    
                    // Create connection URL with the JWT token parameter
                    let wsUrl = `${window.CONFIG.WS_URL}?token=${encodeURIComponent(authToken)}&terminalid=${encodeURIComponent(terminalId)}&vmtype=${window.CONFIG.VM_TYPE}`;
                    
                    // Add flag for forcing session check when logging in via GitHub
                    if (checkExistingSession) {
                    wsUrl += '&checksession=true';
                    }
                    
                    // Create WebSocket connection
                    try {
                    state.websockets[tabId] = new WebSocket(wsUrl);
                    
                    // Set a connection timeout
                    const connectionTimeout = setTimeout(function() {
                        if (state.websockets[tabId] && state.websockets[tabId].readyState !== WebSocket.OPEN) {
                        Utility.log('Connection timeout. Server not responding.', 'error');
                        if (state.websockets[tabId]) state.websockets[tabId].close();
                        reject(new Error('Connection timeout'));
                        }
                    }, window.CONFIG.CONNECTION_TIMEOUT);
                    
                    // Set up event handlers that resolve/reject the promise
                    state.websockets[tabId].onopen = function() {
                        clearTimeout(connectionTimeout);
                        Utility.log('WebSocket connection established', 'info');
                        
                        // Send auth message to start the terminal session
                        state.websockets[tabId].send(JSON.stringify({
                        type: 'auth'
                        }));
                        
                        resolve();
                    };

                    // Setup message handler
                    state.websockets[tabId].onmessage = function(event) {
                        Connection.handleWebSocketMessage(event, tabId);
                    };

                    // Setup error handler
                    state.websockets[tabId].onerror = function(error) {
                        Utility.log('websocket received an error', error);
                        clearTimeout(connectionTimeout);
                        Utility.log(`WebSocket error: ${error.message || 'Unknown error'}`, 'error');
                        reject(error);
                    };
                    
                    // Setup close handler
                    state.websockets[tabId].onclose = function(event) {
                        clearTimeout(connectionTimeout);
                        
                        if (event.wasClean) {
                        Utility.log(`Connection closed cleanly, code: ${event.code}`, 'info');
                        } else {
                        Utility.log('Connection died unexpectedly', 'error');
                        // Show connection failure prompt
                        UI.showConnectionFailurePrompt(tabId);
                        }
                        
                        // Only reject if the connection hasn't been established yet
                        if (state.websockets[tabId].readyState !== WebSocket.OPEN) {
                        reject(new Error('Connection closed'));
                        }
                    };
                    
                    } catch (error) {
                    Utility.log(`Error creating WebSocket: ${error.message}`, 'error');
                    reject(error);
                    }
                });
                },
                
                /**
                 * Handle WebSocket message
                 * @param {MessageEvent} event - WebSocket message event
                 * @param {string} tabId - Tab identifier
                 */
                handleWebSocketMessage(event, tabId) {
                try {
                    // Try to parse as JSON
                    let jsonData = JSON.parse(event.data);

                    switch (jsonData.type) {
                    case 'vm_creating':
                        UI.showTerminalLoading(tabId, 'Creating your environment...');
                        Utility.log('Your environment is being created. Please wait...', 'info');

                        // Disable add terminal button while VM is creating
                        UI.setAddTerminalButtonState(false);
                        break;
                        
                    case 'vm_ready':
                        Utility.log('Your environment is ready!', 'success');
                        
                        // Show tabs container when VM is ready
                        const tabsContainer = Utility.getElement('terminal-tabs-container');
                        if (tabsContainer && state.auth.isAuthenticated) {
                        tabsContainer.style.display = 'flex';
                        }

                        // Enable add terminal button when VM is ready
                        UI.setAddTerminalButtonState(true);

                        // Initialize proper terminal if needed
                        if (!state.terminals[tabId]) {
                        TerminalManager.initializeTerminal(tabId);
                        }
                        break;
                        
                    case 'connected':
                        Utility.log('SSH connection established', 'success');
                        break;
                        
                    case 'data':
                        if (state.terminals[tabId]) state.terminals[tabId].write(jsonData.data);
                        break;
                        
                    case 'error':
                        Utility.log(`Error: ${jsonData.message}`, 'error');
                        UI.setAddTerminalButtonState(false);

                        // Handle token expiration
                        if (jsonData.message && jsonData.message.includes('Token expired')) {
                        console.log("Token expired");

                        // Clear auth data on session expiration
                        Auth.clearAuthData();

                        // Disconnect all terminals
                        setTimeout(() => {
                            // Remove onclose handlers to avoid errors
                            Object.keys(state.websockets).forEach(id => {
                            if (state.websockets[id]) {
                                state.websockets[id].onclose = null;
                            }
                            });
                            
                            // Then close all connections
                            this.closeAllConnections();
                        }, 200);
                        }
            
                        // Handle max number of terminals
                        if (jsonData.message && jsonData.message.includes('You have reached the maximum limit')) {
                        console.log("Max number of terminal reached");
                        // Show cooldown message before closing connections
                        UI.showTerminalQuotaMessage(tabId);
                        }
                        
                        // Handle cooldonw
                        if (jsonData.cooldown) {
                        console.log("Cooldown received - showing message");

                        const formattedTime = jsonData.cooldown.formattedTime || 
                                            Utility.formatDate(new Date(jsonData.cooldown.expiryTimestamp));
                        
                        // Show cooldown message before closing connections
                        UI.showCooldownMessage(tabId, formattedTime);

                        // Clear auth data on session expiration
                        if (jsonData.message && jsonData.message.includes('session expired')) {
                            Auth.clearAuthData();
                        }

                        // Disconnect all terminals
                        setTimeout(() => {
                            // Remove onclose handlers to avoid errors
                            Object.keys(state.websockets).forEach(id => {
                            if (state.websockets[id]) {
                                state.websockets[id].onclose = null;
                            }
                            });
                            
                            // Then close all connections
                            this.closeAllConnections();
                        }, 200);
                        }

                        break;
                        
                    // Handle session termination with cooldown  
                    case 'environment_terminated':
                        console.log("Environment terminated - showing cooldown message");

                        UI.setAddTerminalButtonState(false);

                        if (jsonData.cooldown) {
                        const formattedTime = jsonData.cooldown.formattedTime || 
                                            Utility.formatDate(new Date(jsonData.cooldown.expiryTimestamp));
                        UI.showCooldownMessage(tabId, formattedTime);

                        // Clear auth data on session termination
                        //Auth.clearAuthData();

                        // Close all connections to prevent further attempts
                        setTimeout(() => {
                            // Remove onclose handlers
                            Object.keys(state.websockets).forEach(id => {
                            if (state.websockets[id]) {
                                state.websockets[id].onclose = null;
                            }
                            });
                            
                            this.closeAllConnections();
                        }, 200);
                        }
                        break;
                        
                    case 'closed':
                        Utility.log('SSH connection closed', 'info');
                        break;
                    }
                } catch (error) {
                    // Not JSON, treat as raw data
                    if (state.terminals[tabId]) {
                    state.terminals[tabId].write(event.data);
                    }
                }
                },
                
                /**
                 * Close all active WebSocket connections
                 */
                closeAllConnections() {
                Object.keys(state.websockets).forEach(tabId => {
                    if (state.websockets[tabId]) {
                    try {
                        // Save reference to allow checking readyState later
                        const ws = state.websockets[tabId];
                        
                        // Remove the onclose handler to prevent errors
                        ws.onclose = null;
                        
                        // Now close the connection
                        ws.close();
                    } catch (e) {
                        console.error(`Error closing websocket for tab ${tabId}:`, e);
                    }
                    
                    // Set to null after closing
                    state.websockets[tabId] = null;
                    }
                });
                }
            };

            //=============================================================================
            // TERMINAL MODULE - Terminal management 
            //=============================================================================
            const TerminalManager = {
                /**
                 * Create a new terminal tab
                 */
                createNewTerminalTab() {
                // Get current tab count
                const tabsContainer = document.querySelector('.terminal-tabs-list');
                const existingTabs = tabsContainer.querySelectorAll('.terminal-tab');
                const currentTabCount = existingTabs.length;
                
                // Check if we're at the maximum number of tabs (4)
                if (currentTabCount >= 4) {
                    Utility.log('Maximum number of terminals reached (4)', 'error');
                    return;
                }
                
                // Generate new tab ID
                const newTabId = (currentTabCount + 1).toString();
                
                // Create tab element
                const newTab = document.createElement('div');
                newTab.id = `terminal-tab-${newTabId}`;
                newTab.className = 'terminal-tab';
                newTab.style.fontFamily = 'monospace';
                newTab.style.padding = '5px 15px';
                newTab.style.marginRight = '5px';
                newTab.style.cursor = 'pointer';
                newTab.style.backgroundColor = '#222';
                newTab.style.borderRadius = '4px 4px 0 0';
                newTab.textContent = `Terminal ${newTabId}`;
                
                // Add tab before the "+" button
                const addButton = document.getElementById('add-terminal-tab');
                tabsContainer.insertBefore(newTab, addButton);
                
                // Store tab ID in localStorage
                const activeTabs = JSON.parse(localStorage.getItem('terminal_active_tabs') || '["1"]');
                if (!activeTabs.includes(newTabId)) {
                    activeTabs.push(newTabId);
                    localStorage.setItem('terminal_active_tabs', JSON.stringify(activeTabs));
                }

                // Create terminal container
                this.createTerminalContainer(newTabId);
                
                // Add click event to new tab
                newTab.addEventListener('click', function() {
                    UI.switchTab(newTabId);
                });
                
                // Switch to the new tab
                UI.switchTab(newTabId);
                },

                /**
                 * Create a new terminal container
                 * @param {string} tabId - Tab identifier
                 */
                createTerminalContainer(tabId) {
                // Check if container already exists
                if (document.getElementById(`terminal-container-${tabId}`)) {
                    return;
                }
                
                // Create container element
                const newContainer = document.createElement('div');
                newContainer.id = `terminal-container-${tabId}`;
                newContainer.className = 'terminal-container';
                newContainer.style.flex = '1';
                newContainer.style.overflow = 'hidden';
                newContainer.style.background = '#000';
                newContainer.style.width = '100%';
                newContainer.style.display = 'none';
                
                // Add container to wrapper
                const wrapper = Utility.getElement('terminalWrapper');
                const statusPanel = Utility.getElement('connection-status');
                if (wrapper && statusPanel) {
                    wrapper.insertBefore(newContainer, statusPanel);
                }
                },

                /**
                 * Initialize terminal for a specific tab
                 * @param {string} tabId - Tab identifier
                 */
                initializeTerminal(tabId) {
                console.log(`Initializing terminal for tab ${tabId}...`);
                
                // Only initialize if authenticated
                if (!state.auth.isAuthenticated) {
                    console.error('Cannot initialize terminal: Not authenticated');
                    return;
                }
                
                var container = Utility.getElement(`terminal-container-${tabId}`);
                if (!container) {
                    console.error(`Terminal container for tab ${tabId} not found`);
                    return;
                }
                
                // Clear the container first
                container.innerHTML = '';
                
                // Dispose of existing terminal if any
                if (state.terminals[tabId]) {
                    try {
                    state.terminals[tabId].dispose();
                    } catch (e) {
                    console.error(`Error disposing terminal for tab ${tabId}:`, e);
                    }
                    state.terminals[tabId] = null;
                    state.fitAddons[tabId] = null;
                }
                
                // Create terminal instance
                state.terminals[tabId] = new Terminal({
                    cursorBlink: true,
                    theme: {
                    background: '#000',
                    foreground: '#f0f0f0'
                    },
                    fontFamily: 'monospace',
                    fontSize: 14,
                    cols: window.CONFIG.DEFAULT_COLS,
                    rows: window.CONFIG.DEFAULT_ROWS,
                    scrollback: 1000,
                    convertEol: true,
                    disableStdin: false
                });
                
                // Add fit addon
                if (typeof FitAddon !== 'undefined' && typeof FitAddon.FitAddon !== 'undefined') {
                    state.fitAddons[tabId] = new FitAddon.FitAddon();
                    state.terminals[tabId].loadAddon(state.fitAddons[tabId]);
                }
                
                // Open terminal in the container
                state.terminals[tabId].open(container);
                
                // Initial resize
                setTimeout(() => this.resizeTerminal(tabId), 100);
                
                // Set up data handler
                this.setupTerminalDataHandler(tabId);
                },
                
                /**
                 * Setup terminal data handler for sending user input to server
                 * @param {string} tabId - Tab identifier
                 */
                setupTerminalDataHandler(tabId) {
                if (!state.terminals[tabId] || !state.websockets[tabId]) return;
                
                state.terminals[tabId].onData(function(data) {
                    if (state.websockets[tabId] && state.websockets[tabId].readyState === WebSocket.OPEN) {
                    state.websockets[tabId].send(JSON.stringify({
                        type: 'data',
                        data: data 
                    }));
                    }
                });
                },
                
                /**
                 * Initialize and connect terminal
                 * @param {string} tabId - Tab identifier
                 * @param {boolean} checkExistingSession - Whether to force check for existing sessions
                 */
                initializeAndConnectTerminal(tabId, checkExistingSession = false) {
                // Prevent multiple simultaneous connection attempts
                if (connectionInProgress) {
                    return;
                }
                
                connectionInProgress = true;

                if (!state.auth.isAuthenticated) {
                    console.error('Cannot connect: Not authenticated');
                    return;
                }
                
                // Show loading state
                UI.showTerminalLoading(tabId);
                
                // Connect to WebSocket
                Connection.connectWebSocket(tabId, checkExistingSession)
                .finally(() => {
                    // Reset flag to allow future connection attempts
                    setTimeout(() => {
                    connectionInProgress = false;
                    }, 1000);
                });
                },
                
                /**
                 * Resize terminal
                 * @param {string} tabId - Tab identifier
                 */
                resizeTerminal(tabId) {
                if (!state.terminals[tabId] || !state.fitAddons[tabId]) return;
                
                try {
                    // Resize the terminal to fit its container
                    state.fitAddons[tabId].fit();
                    
                    // Send the new size to the server if connected
                    if (state.websockets[tabId] && state.websockets[tabId].readyState === WebSocket.OPEN) {
                    const cols = Math.max(state.terminals[tabId].cols, window.CONFIG.DEFAULT_COLS);
                    const rows = Math.max(state.terminals[tabId].rows, window.CONFIG.DEFAULT_ROWS);
                    
                    state.websockets[tabId].send(JSON.stringify({
                        type: 'resize',
                        cols: cols,
                        rows: rows
                    }));
                    }
                } catch (e) {
                    console.error(`Error resizing terminal ${tabId}:`, e);
                }
                }
            };

            //=============================================================================
            // UI MODULE - Interface management
            //=============================================================================
            const UI = {
                /**
                 * Show terminal UI
                 */
                showTerminal() {
                state.isTerminalVisible = true;
                
                const wrapper = Utility.getElement('terminalWrapper');
                if (!wrapper) return;
                
                // Show the terminal wrapper
                wrapper.style.display = 'flex';
                wrapper.style.bottom = '0px';
                
                // Show/hide UI elements based on authentication status
                const loginContainer = Utility.getElement('login-container');
                const tabsContainer = Utility.getElement('terminal-tabs-container');
                const terminalContainer = Utility.getElement(`terminal-container-${state.activeTabId}`);
                
                if (state.auth.isAuthenticated) {
                    // When authenticated, show terminal UI
                    if (loginContainer) loginContainer.style.display = 'none';
                    if (tabsContainer) tabsContainer.style.display = 'flex';
                    if (terminalContainer) terminalContainer.style.display = 'block';
                    
                    // Check if there's already an active connection for this tab
                    const hasActiveConnection = state.websockets[state.activeTabId] && 
                                            state.websockets[state.activeTabId].readyState === WebSocket.OPEN;
                    
                    // Only initialize a new connection if there isn't one already
                    if (!hasActiveConnection) {
                    // Only try reconnecting if we have a terminal
                    if (state.terminals[state.activeTabId]) {
                        // Check if terminal has content - if yes, just resize, don't reconnect
                        if (state.terminals[state.activeTabId].rows > 0) {
                        // Terminal exists and has content, just resize it
                        setTimeout(() => TerminalManager.resizeTerminal(state.activeTabId), 50);
                        } else {
                        // Initialize connection
                        TerminalManager.initializeAndConnectTerminal(state.activeTabId);
                        }
                    } else {
                        // No terminal exists, create one
                        TerminalManager.initializeAndConnectTerminal(state.activeTabId);
                    }
                    } else {
                    // We have an active connection, just resize the terminal
                    setTimeout(() => TerminalManager.resizeTerminal(state.activeTabId), 50);
                    }
                } else {
                    // When not authenticated, show login UI
                    if (loginContainer) {
                    loginContainer.style.display = 'flex';
                    }
                    if (tabsContainer) tabsContainer.style.display = 'none';
                    if (terminalContainer) terminalContainer.style.display = 'none';
                }
                },
                
                /**
                 * Hide terminal UI
                 */
                hideTerminal() {
                state.isTerminalVisible = false;
                
                const wrapper = Utility.getElement('terminalWrapper');
                if (!wrapper) return;
                
                wrapper.style.bottom = '-' + wrapper.offsetHeight + 'px';
                },
                
                /**
                 * Toggle terminal visibility
                 */
                toggleTerminal() {
                if (state.isTerminalVisible) {
                    this.hideTerminal();
                } else {
                    this.showTerminal();
                }
                },
                
                /**
                 * Switch to a different terminal tab
                 * @param {string} tabId - Tab identifier
                 */
                switchTab(tabId) {
                // Only allow tab switching if authenticated
                if (!state.auth.isAuthenticated) return;
                
                // Update active tab
                state.activeTabId = tabId;
                
                // Update tab UI
                document.querySelectorAll('.terminal-tab').forEach(function(tab) {
                    tab.classList.remove('active-tab');
                    tab.style.backgroundColor = '#222';
                });
                
                const activeTabElement = Utility.getElement(`terminal-tab-${tabId}`);
                if (activeTabElement) {
                    activeTabElement.classList.add('active-tab');
                    activeTabElement.style.backgroundColor = '#444';
                }
                
                // Update terminal containers visibility
                document.querySelectorAll('.terminal-container').forEach(function(container) {
                    container.style.display = 'none';
                });
                
                const activeContainer = Utility.getElement(`terminal-container-${tabId}`);
                if (activeContainer) {
                    activeContainer.style.display = 'block';
                }
                
                // Initialize terminal if it doesn't exist
                if (!state.terminals[tabId]) {
                    if (state.websockets[tabId] && state.websockets[tabId].readyState === WebSocket.OPEN) {
                    // If already connected, initialize terminal
                    TerminalManager.initializeTerminal(tabId);
                    } else {
                    // Otherwise connect to WebSocket
                    TerminalManager.initializeAndConnectTerminal(tabId);
                    }
                } else {
                    // Terminal exists, just resize it
                    setTimeout(() => TerminalManager.resizeTerminal(tabId), 50);
                }
                },
                
                /**
                 * Set the add terminal button state
                 * @param {boolean} enabled - Whether the button should be enabled
                 */
                setAddTerminalButtonState(enabled) {
                const addButton = Utility.getElement('add-terminal-tab');
                if (!addButton) return;
                
                if (enabled) {
                    // Enable the button
                    addButton.style.opacity = '1';
                    addButton.style.cursor = 'pointer';
                    addButton.style.backgroundColor = '#333';
                    addButton.style.borderColor = '#555';
                    addButton.disabled = false;
                } else {
                    // Disable the button
                    addButton.style.opacity = '0.5';
                    addButton.style.cursor = 'not-allowed';
                    addButton.style.backgroundColor = '#222';
                    addButton.style.borderColor = '#444';
                    addButton.disabled = true;
                }
                },
                
                /**
                 * Show loading state for terminal
                 * @param {string} tabId - Tab identifier
                 * @param {string} message - Message to display
                 */
                showTerminalLoading(tabId, message = 'Connecting to your environment...') {
                const container = Utility.getElement(`terminal-container-${tabId}`);
                if (!container) return;
                
                container.innerHTML = `
                    <div style="
                    position: absolute; 
                    top: 50%; 
                    left: 50%; 
                    transform: translate(-50%, -50%);
                    color: #5555ff;
                    text-align: center;
                    font-family: monospace;
                    font-size: 18px;
                    ">
                    ${message}<br>
                    <span style="font-size: 14px; color: #aaa; margin-top: 10px; display: block;">
                        Please wait
                    </span>
                    </div>
                `;
                },
                
                /**
                 * Show cooldown message in terminal
                 * @param {string} tabId - Tab identifier
                 * @param {string} formattedTime - Time when cooldown ends
                 */
                showCooldownMessage(tabId, formattedTime) {
                // Always clear auth data when showing cooldown message
                //Auth.clearAuthData();

                const container = Utility.getElement(`terminal-container-${tabId}`);
                if (!container) return;
                
                // Hide the tabs container during cooldown
                const tabsContainer = Utility.getElement('terminal-tabs-container');
                if (tabsContainer) {
                    tabsContainer.style.display = 'none';
                }

                // If there's an actual terminal, dispose of it
                if (state.terminals[tabId]) {
                    try {
                    state.terminals[tabId].dispose();
                    } catch (e) {
                    console.error(`Error disposing terminal: ${e}`);
                    }
                    state.terminals[tabId] = null;
                }

                container.innerHTML = `
                    <div style="
                    position: absolute; 
                    top: 50%; 
                    left: 50%; 
                    transform: translate(-50%, -50%);
                    color: #ff5555;
                    text-align: center;
                    font-family: monospace;
                    font-size: 18px;
                    background-color: rgba(0, 0, 0, 0.7);
                    padding: 20px;
                    border-radius: 8px;
                    width: 80%;
                    max-width: 500px;
                    ">
                    The session has expired<br>
                    <span style="font-size: 14px; color: #ffffff; margin-top: 10px; display: block;">
                        Reload the page after ${formattedTime} to request a new session
                    </span>
                    </div>
                `;
                },
                
                /**
                 * Show UI after cooldown has ended
                 * @param {string} tabId - Tab identifier
                 */
                showReconnectUI(tabId) {
                const container = Utility.getElement(`terminal-container-${tabId}`);
                if (!container) return;
                
                // Keep tabs hidden until user reconnects
                const tabsContainer = Utility.getElement('terminal-tabs-container');
                if (tabsContainer) {
                    tabsContainer.style.display = 'none';
                }
                
                container.innerHTML = `
                    <div style="
                    position: absolute; 
                    top: 50%; 
                    left: 50%; 
                    transform: translate(-50%, -50%);
                    color: #5555ff;
                    text-align: center;
                    font-family: monospace;
                    font-size: 18px;
                    ">
                    Ready to Connect<br>
                    <span style="font-size: 14px; color: #aaa; margin-top: 10px; display: block;">
                        <button id="reconnect-button" style="margin-top: 15px; padding: 5px 10px; 
                                background: #444; border: 1px solid #666; color: white; 
                                cursor: pointer; border-radius: 3px;">
                        You can now request a new session
                        </button>
                    </span>
                    </div>
                `;
                
                // Add click handler for reconnect button
                const reconnectButton = Utility.getElement('reconnect-button');
                if (reconnectButton) {
                    reconnectButton.addEventListener('click', function() {
                    // Show tabs when reconnecting
                    if (tabsContainer) {
                        tabsContainer.style.display = 'flex';
                    }
                    
                    // Initialize terminal and connect
                    TerminalManager.initializeAndConnectTerminal(tabId);
                    });
                }
                },
                
                /**
                 * Show message when max number of terminal reached
                 * (needed when different browsers are used simultaneously)
                 * @param {string} tabId - Tab identifier
                 */
                showTerminalQuotaMessage(tabId) {
                const container = Utility.getElement(`terminal-container-${tabId}`);
                if (!container) return;
                        
                container.innerHTML = `
                    <div style="
                    position: absolute; 
                    top: 50%; 
                    left: 50%; 
                    transform: translate(-50%, -50%);
                    color: #ff5555;
                    text-align: center;
                    font-family: monospace;
                    font-size: 18px;
                    background-color: rgba(0, 0, 0, 0.85);
                    padding: 20px;
                    border-radius: 8px;
                    width: 80%;
                    max-width: 500px;
                    ">
                    You reached the maximal number of terminals<br>
                    <span style="font-size: 14px; color: #ffffff; margin-top: 10px; display: block;">
                        Are you using multiple browsers simultaneously ?
                    </span>
                    </div>
                `;
                },

                /**
                 * Show message when connection dies unexpectedly
                 * @param {string} tabId - Tab identifier
                 */
                showConnectionFailurePrompt(tabId) {
                const container = Utility.getElement(`terminal-container-${tabId}`);
                if (!container) return;
                
                // Clear authentication data before showing the prompt
                Auth.clearAuthData();
                
                // Hide the tabs container
                const tabsContainer = Utility.getElement('terminal-tabs-container');
                if (tabsContainer) {
                    tabsContainer.style.display = 'none';
                }
                
                container.innerHTML = `
                    <div style="
                    position: absolute; 
                    top: 50%; 
                    left: 50%; 
                    transform: translate(-50%, -50%);
                    color: #ff5555;
                    text-align: center;
                    font-family: monospace;
                    font-size: 18px;
                    background-color: rgba(0, 0, 0, 0.85);
                    padding: 20px;
                    border-radius: 8px;
                    width: 80%;
                    max-width: 500px;
                    ">
                    Connection to the server has been lost<br>
                    <span style="font-size: 14px; color: #ffffff; margin-top: 10px; display: block;">
                        Please reload the page to reconnect
                    </span>
                    </div>
                `;
                },
                
                /**
                 * Setup vertical resize functionality
                 * @param {HTMLElement} resizeHandle - Resize handle element
                 * @param {HTMLElement} wrapper - Terminal wrapper element
                 */
                setupVerticalResize(resizeHandle, wrapper) {
                if (!resizeHandle || !wrapper) return;
                
                let isResizing = false;
                let startY = 0;
                let startHeight = 0;
                
                resizeHandle.addEventListener('mousedown', function(e) {
                    isResizing = true;
                    startY = e.clientY;
                    startHeight = wrapper.offsetHeight;
                    wrapper.style.transition = 'none';
                    document.body.style.userSelect = 'none';
                });
                
                document.addEventListener('mousemove', function(e) {
                    if (!isResizing) return;
                    
                    const deltaY = startY - e.clientY;
                    const newHeight = Math.min(
                    Math.max(startHeight + deltaY, window.CONFIG.MIN_HEIGHT),
                    CONFIG.MAX_HEIGHT
                    );
                    
                    // Update wrapper height
                    wrapper.style.height = newHeight + 'px';
                    
                    // If terminal is visible, update bottom position to maintain position
                    if (state.isTerminalVisible) {
                    wrapper.style.bottom = '0px';
                    }
                    
                    // Resize all terminals to match new height
                    Object.keys(state.terminals).forEach(id => {
                    if (state.terminals[id] && state.fitAddons[id]) {
                        state.fitAddons[id].fit();
                    }
                    });
                });
                
                document.addEventListener('mouseup', function() {
                    if (isResizing) {
                    isResizing = false;
                    wrapper.style.transition = `bottom ${window.CONFIG.TERMINAL_TRANSITION_SPEED} ease-in-out`;
                    document.body.style.userSelect = '';
                    
                    // If terminal is hidden, update the bottom position
                    if (!state.isTerminalVisible) {
                        wrapper.style.bottom = '-' + wrapper.offsetHeight + 'px';
                    }
                    
                    // Apply terminal resize on all tabs
                    Object.keys(state.terminals).forEach(id => {
                        if (state.terminals[id] && state.fitAddons[id]) {
                        TerminalManager.resizeTerminal(id);
                        }
                    });
                    }
                });
                },
                
                /**
                 * Setup horizontal drag functionality
                 * @param {HTMLElement} header - Terminal header element
                 * @param {HTMLElement} wrapper - Terminal wrapper element
                 */
                setupHorizontalDrag(header, wrapper) {
                if (!header || !wrapper) return;
                
                let isDragging = false;
                let dragOffsetX = 0;
                
                header.addEventListener('mousedown', function(e) {
                    // Don't initiate drag if clicking on buttons or tabs
                    if (e.target !== header && (e.target.tagName === 'BUTTON' || e.target.classList.contains('terminal-tab'))) {
                    return;
                    }
                    
                    isDragging = true;
                    dragOffsetX = e.clientX - wrapper.getBoundingClientRect().left;
                    wrapper.style.transition = 'none';
                    document.body.style.userSelect = 'none';
                });
                
                document.addEventListener('mousemove', function(e) {
                    if (!isDragging) return;
                    
                    const x = e.clientX - dragOffsetX;
                    const maxWidth = window.innerWidth - wrapper.offsetWidth;
                    
                    if (x >= 0 && x <= maxWidth) {
                    wrapper.style.left = x + 'px';
                    }
                });
                
                document.addEventListener('mouseup', function() {
                    if (isDragging) {
                    isDragging = false;
                    wrapper.style.transition = 'left 0.3s ease-in-out';
                    document.body.style.userSelect = '';
                    }
                });
                }
            };

            //=============================================================================
            // APP INITIALIZATION
            //=============================================================================

            /**
             * Initialize the application
             */
            function initialize() {
                // Check for existing authentication
                const existingAuth = Auth.checkExistingAuth();
                
                // Handle OAuth callback
                Auth.handleOAuthCallback();
                
                // Pre-create terminal container for tab 1
                if (!Utility.getElement('terminal-container-1')) {
                TerminalManager.createTerminalContainer('1');
                }

                // Initialize add terminal button as disabled
                UI.setAddTerminalButtonState(false);

                // Setup event listeners
                setupEventListeners();
                
                // Setup window resize handler
                window.addEventListener('resize', function() {
                // Resize all terminals when window is resized
                if (state.isTerminalVisible) {
                    Object.keys(state.terminals).forEach(id => {
                    if (state.terminals[id] && state.fitAddons[id]) {
                        TerminalManager.resizeTerminal(id);
                    }
                    });
                }
                });

                // Add window unload handler to clean up connections
                window.addEventListener('beforeunload', function() {
                // Close all connections cleanly before page unloads
                Connection.closeAllConnections();
                
                // Clear all stored terminal IDs
                localStorage.removeItem('terminal_active_tabs');
                });
                
                // If authenticated, show terminal
                if (existingAuth) {
                setTimeout(() => UI.showTerminal(), 500);
                } else {
                // Show login container
                const loginContainer = Utility.getElement('login-container');
                if (loginContainer) {
                    loginContainer.style.display = 'block';
                }
                }
            }
            
            /**
             * Setup event listeners
             */
            function setupEventListeners() {
                // Get elements
                const elements = {
                toggleButton: Utility.getElement('terminalToggle'),
                wrapper: Utility.getElement('terminalWrapper'),
                minimizeButton: Utility.getElement('terminalMinimize'),
                closeButton: Utility.getElement('terminalClose'),
                resizeHandle: Utility.getElement('terminalResizeHandle'),
                header: Utility.getElement('terminalHeader'),
                githubLoginButton: Utility.getElement('github-login-button'),
                tab1: Utility.getElement('terminal-tab-1'),
                tab2: Utility.getElement('terminal-tab-2')
                };
                
                // Terminal toggle button
                if (elements.toggleButton) {
                elements.toggleButton.addEventListener('click', () => UI.toggleTerminal());
                }
                
                // Terminal minimize button
                if (elements.minimizeButton) {
                elements.minimizeButton.addEventListener('click', () => UI.toggleTerminal());
                }
                
                // Terminal close button
                if (elements.closeButton) {
                elements.closeButton.addEventListener('click', function() {
                    Connection.closeAllConnections();
                    UI.hideTerminal();
                });
                }
                
                // GitHub login button
                if (elements.githubLoginButton) {
                elements.githubLoginButton.addEventListener('click', () => Auth.initiateGitHubLogin());
                }

                // Add terminal tab button
                const addTerminalTabButton = Utility.getElement('add-terminal-tab');
                if (addTerminalTabButton) {
                addTerminalTabButton.addEventListener('click', function() {
                    // Skip if button is disabled
                    if (addTerminalTabButton.disabled) {
                    return;
                    }
                    
                    if (state.auth.isAuthenticated) {
                    TerminalManager.createNewTerminalTab();
                    } else {
                    Utility.log('Please login first', 'error');
                    }
                });
                }

                // Terminal tabs
                if (elements.tab1) {
                elements.tab1.addEventListener('click', function() {
                    UI.switchTab('1');
                });
                }
                
                if (elements.tab2) {
                elements.tab2.addEventListener('click', function() {
                    UI.switchTab('2');
                });
                }
                
                // Setup resize and drag functionality
                if (elements.resizeHandle && elements.wrapper) {
                UI.setupVerticalResize(elements.resizeHandle, elements.wrapper);
                }
                
                if (elements.header && elements.wrapper) {
                UI.setupHorizontalDrag(elements.header, elements.wrapper);
                }
                
                // Add keyboard shortcuts (Alt+T to toggle terminal)
                document.addEventListener('keydown', function(e) {
                if (e.altKey && e.key === 't') {
                    UI.toggleTerminal();
                    e.preventDefault();
                }
                });
            }
            
            // Initialize the application
            initialize();
        }

        // Cleanup method
        destroy() {
            const elements = [
                'terminalWrapper',
                'terminalToggle',
                'web-terminal-styles'
            ];
            
            elements.forEach(id => {
                const element = document.getElementById(id);
                if (element) element.remove();
            });
        }
    }

    // Export for different environments
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = WebTerminalEmbed;
    } else if (typeof define === 'function' && define.amd) {
        define([], function() { return WebTerminalEmbed; });
    } else {
        global.WebTerminalEmbed = WebTerminalEmbed;
    }

})(typeof window !== 'undefined' ? window : this);