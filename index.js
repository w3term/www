/**
 * Simplified Web Terminal Application
 * 
 * A browser-based terminal interface connecting to remote environments via WebSockets.
 * State management is delegated to the server.
 */
(function() {
    //=============================================================================
    // CONFIGURATION
    //=============================================================================
    const CONFIG = {
      // WebSocket settings
      WS_URL: 'ws://localhost:8081', // Replace with your WebSocket server URL
      
      // GitHub OAuth settings
      GITHUB_CLIENT_ID: 'Ov23lierUHCC1NsRnWlv', // Replace with your client ID
      GITHUB_REDIRECT_URI: 'http://localhost:3000/auth/github/callback',
      GITHUB_SCOPE: 'read:user',
      
      // Auth server
      AUTH_SERVER: 'http://localhost:3000',
      
      // Terminal settings
      DEFAULT_COLS: 120,
      DEFAULT_ROWS: 30,
      DEFAULT_HEIGHT: 450,
      MIN_HEIGHT: 200,
      MAX_HEIGHT: 800,
      
      // Connection settings
      MAX_CONNECT_ATTEMPTS: 3,
      CONNECT_RETRY_DELAY: 2000,
      CONNECTION_TIMEOUT: 10000,
      
      // UI Settings
      TERMINAL_TRANSITION_SPEED: '0.3s',
      
      // Debug settings
      DEBUG: true
    };
    
    //=============================================================================
    // STATE MANAGEMENT - Simplified to essentials
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
    // UTILITY FUNCTIONS
    //=============================================================================
    
    /**
     * Format date for display
     * @param {Date} date - Date to format
     * @returns {string} Formatted date string
     */
    function formatDate(date) {
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    }
  
    /**
     * Log message to console and optionally to UI
     * @param {string} message - Message to log
     * @param {string} type - Message type: 'info', 'error', 'success'
     * @param {string} tabId - Tab identifier
     */
    function log(message, type = 'info', tabId = state.activeTabId) {
      if (CONFIG.DEBUG) {
        console.log(`[Tab ${tabId}] ${message}`);
      }
      
      // Update status panel
      //updateStatusPanel(message, type);
    }
    
    /**
     * Update the status panel with a message
     * @param {string} message - Message to display
     * @param {string} type - Message type: 'info', 'error', 'success'
     */
    function updateStatusPanel(message, type = 'info') {
      const statusPanel = document.getElementById('connection-status');
      if (!statusPanel) return;
      
      // Color-code messages
      let color = '#ccc';
      if (type === 'error') color = '#ff5555';
      if (type === 'success') color = '#55ff55';
      if (type === 'info') color = '#5555ff';
      
      statusPanel.innerHTML = `<span style="color: ${color}">${message}</span>`;
      statusPanel.style.display = 'block';
    }
    
    /**
     * Get DOM element safely with error logging
     * @param {string} id - Element ID
     * @param {boolean} required - Whether the element is required
     * @returns {HTMLElement|null} The element or null if not found
     */
    function getElement(id, required = false) {
      const element = document.getElementById(id);
      if (!element && required) {
        console.error(`Required element not found: ${id}`);
      }
      return element;
    }
    
    /**
     * Get an auth token from cookies
     * @returns {string|null} Auth token or null if not found
     */
    function getAuthTokenFromCookie() {
      // Try cookie first
      const cookies = document.cookie.split(';');
      for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'auth_token') {
          return value;
        }
      }
    }
    
    /**
     * Generate a unique ID
     * @returns {string} A unique identifier
     */
    function generateUniqueId() {
      return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    /**
     * Clear all authentication data from cookie and localStorage
     */
    function clearAuthData() {
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
      updateAuthUI();
      
      // Don't hide the terminal immediately since we want to show the cooldown message
      // Just update the auth status
      log('Session expired. Authentication cleared.', 'error');
    }
    
    //=============================================================================
    // AUTHENTICATION MANAGEMENT
    //=============================================================================
    
    /**
     * Start GitHub OAuth flow
     */
    function initiateGitHubLogin() {
      // Save current state to check against CSRF
      const oauthState = Math.random().toString(36).substring(2, 15);
      localStorage.setItem('github_oauth_state', oauthState);
      
      // Build GitHub authorization URL
      const authUrl = `https://github.com/login/oauth/authorize?client_id=${CONFIG.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(CONFIG.GITHUB_REDIRECT_URI)}&scope=${encodeURIComponent(CONFIG.GITHUB_SCOPE)}&state=${oauthState}`;
      
      // Log debug info
      if (CONFIG.DEBUG) {
        console.log('Initiating GitHub OAuth flow');
        console.log('GitHub Authorization URL:', authUrl);
      }
      
      // Redirect to GitHub
      window.location.href = authUrl;
    }
    
    /**
     * Handle OAuth callback
     */
    function handleOAuthCallback() {
      const urlParams = new URLSearchParams(window.location.search);
      const authSuccess = urlParams.get('auth_success');
      
      if (authSuccess === 'true') {
        //console.log('Auth success detected in URL');
        
        // Clean URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Set flag for GitHub login path
        sessionStorage.setItem('from_github_login', 'true');
        
        // Use existing token validation function
        validateTokenFromCookie();
      }
    }
    
    /**
     * Validate token from cookie
     */
    function validateTokenFromCookie() {
      const authToken = getAuthTokenFromCookie();
      
      if (!authToken) {
        console.warn('No auth token cookie found');
        console.log('Cookies available:', document.cookie);  // Debug to see all cookies
        updateAuthStatus('No authentication token found', 'error');
        return;
      }
      
      // console.log('Auth token found in cookie, first 10 chars:', authToken.substring(0, 10) + '...');
      
      updateAuthStatus('Validating token...', 'info');
      
      // Validate token with auth server
      fetch(`${CONFIG.AUTH_SERVER}/validate-token`, {
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
          setAuthenticatedState(authToken, userProfile);
          
          // Show terminal
          showTerminal();
          
          // Connect to session
          initializeAndConnectTerminal(state.activeTabId);
        } else {
          updateAuthStatus('Token validation failed', 'error');
        }
      })
      .catch(error => {
        console.error('Token Validation Error:', error);
        updateAuthStatus('Error validating token', 'error');
      });
    }
    
    /**
     * Set authenticated state
     * @param {string} token - Auth token
     * @param {Object} profile - User profile
     * @returns {boolean} Success status
     */
    function setAuthenticatedState(token, profile) {
      if (!profile || !profile.login || profile.login === '') {
        console.error('Cannot authenticate with invalid profile');
        updateAuthStatus('Authentication failed: Invalid user profile', 'error');
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
      updateAuthUI();
      
      return true;
    }
    
    /**
     * Update authentication status display
     * @param {string} message - Status message
     * @param {string} type - Message type: 'info', 'error', 'success'
     */
    function updateAuthStatus(message, type = 'info') {
      const authStatus = getElement('auth-status');
      if (!authStatus) return;
      
      let color = '#ccc';
      if (type === 'error') color = '#ff5555';
      if (type === 'success') color = '#55ff55';
      if (type === 'info') color = '#5555ff';
      
      authStatus.innerText = message;
      authStatus.style.color = color;
    }
    
    /**
     * Update UI based on auth state
     */
    function updateAuthUI() {
      const authStatus = getElement('auth-status');
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
    }
    
    /**
     * Logout function
     */
    function logout() {
      // Clear auth state
      state.auth.token = null;
      state.auth.userProfile = null;
      state.auth.isAuthenticated = false;
      
      // Remove from localStorage
      localStorage.removeItem('terminal_auth_token');
      localStorage.removeItem('terminal_user_profile');
      
      // Update UI
      updateAuthUI();
      
      // Hide terminal
      hideTerminal();
      
      // Show login container
      const loginContainer = getElement('login-container');
      if (loginContainer) {
        loginContainer.style.display = 'block';
      }
      
      // Close all connections
      closeAllConnections();
    }
    
    /**
     * Close all active WebSocket connections
     */
    function closeAllConnections() {
      Object.keys(state.websockets).forEach(tabId => {
        if (state.websockets[tabId]) {
          try {
            state.websockets[tabId].close();
          } catch (e) {
            console.error(`Error closing websocket for tab ${tabId}:`, e);
          }
          state.websockets[tabId] = null;
        }
      });
    }
    
    /**
     * Check for existing authentication
     * @returns {boolean} Authentication status
     */
    function checkExistingAuth() {
      // Check for existing authentication in localStorage
      const storedToken = localStorage.getItem('terminal_auth_token');
      const storedProfile = localStorage.getItem('terminal_user_profile');
      
      // Also check cookie
      const cookieToken = getAuthTokenFromCookie();
      
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
            updateAuthUI();
            
            return true;
          }
        } catch (e) {
          console.error('Error parsing stored profile:', e);
        }
      }
      
      // If we have a cookie token but no stored token, validate it
      if (cookieToken && !storedToken) {
        validateTokenFromCookie();
        return false; // Return false since validation is async
      }
      
      return false;
    }
    
    //=============================================================================
    // TERMINAL MANAGEMENT
    //=============================================================================
    
    /**
     * Create a new terminal tab
     */
    function createNewTerminalTab() {
      // Get current tab count
      const tabsContainer = document.querySelector('.terminal-tabs-list');
      const existingTabs = tabsContainer.querySelectorAll('.terminal-tab');
      const currentTabCount = existingTabs.length;
      
      // Check if we're at the maximum number of tabs (3)
      if (currentTabCount >= 4) {
        log('Maximum number of terminals reached (4)', 'error');
        return;
      }
      
      // Generate new tab ID (will be 2 or 3 based on existing tabs)
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
      
      // Create terminal container
      createTerminalContainer(newTabId);
      
      // Add click event to new tab
      newTab.addEventListener('click', function() {
        switchTab(newTabId);
      });
      
      // Switch to the new tab
      switchTab(newTabId);
    }

    /**
     * Create a new terminal container
     * @param {string} tabId - Tab identifier
     */
    function createTerminalContainer(tabId) {
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
      const wrapper = getElement('terminalWrapper');
      const statusPanel = getElement('connection-status');
      if (wrapper && statusPanel) {
        wrapper.insertBefore(newContainer, statusPanel);
      }
    }

    /**
     * Initialize terminal for a specific tab
     * @param {string} tabId - Tab identifier
     */
    function initializeTerminal(tabId) {
      console.log(`Initializing terminal for tab ${tabId}...`);
      
      // Only initialize if authenticated
      if (!state.auth.isAuthenticated) {
        console.error('Cannot initialize terminal: Not authenticated');
        return;
      }
      
      var container = getElement(`terminal-container-${tabId}`);
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
        cols: CONFIG.DEFAULT_COLS,
        rows: CONFIG.DEFAULT_ROWS,
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
      setTimeout(() => resizeTerminal(tabId), 100);
      
      // Set up data handler
      setupTerminalDataHandler(tabId);
    }
    
    /**
     * Setup terminal data handler for sending user input to server
     * @param {string} tabId - Tab identifier
     */
    function setupTerminalDataHandler(tabId) {
      if (!state.terminals[tabId] || !state.websockets[tabId]) return;
      
      state.terminals[tabId].onData(function(data) {
        if (state.websockets[tabId] && state.websockets[tabId].readyState === WebSocket.OPEN) {
          state.websockets[tabId].send(JSON.stringify({
            type: 'data',
            data: data 
          }));
        }
      });
    }
    
    /**
     * Show loading state for terminal
     * @param {string} tabId - Tab identifier
     * @param {string} message - Message to display
     */
    function showTerminalLoading(tabId, message = 'Connecting to your environment...') {
      const container = getElement(`terminal-container-${tabId}`);
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
    }
    
    /**
     * Show cooldown message in terminal
     * @param {string} tabId - Tab identifier
     * @param {string} formattedTime - Time when cooldown ends
     */
    function showCooldownMessage(tabId, formattedTime) {
      const container = getElement(`terminal-container-${tabId}`);
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
      
      //updateStatusPanel(`Session expired. Available at ${formattedTime}`, 'error');
    }
    
    /**
     * Show reconnect UI after cooldown has ended
     * @param {string} tabId - Tab identifier
     */
    function showReconnectUI(tabId) {
      const container = getElement(`terminal-container-${tabId}`);
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
      const reconnectButton = getElement('reconnect-button');
      if (reconnectButton) {
        reconnectButton.addEventListener('click', function() {
          // Initialize terminal and connect
          initializeAndConnectTerminal(tabId);
        });
      }
      
      //updateStatusPanel('Ready to connect.', 'info');
    }
    
    /**
     * Initialize and connect terminal
     * @param {string} tabId - Tab identifier
     * @param {boolean} checkExistingSession - Whether to force check for existing sessions
     */
    function initializeAndConnectTerminal(tabId, checkExistingSession = false) {
      // Prevent multiple simultaneous connection attempts
      if (connectionInProgress) {
        //console.log("Connection already in progress, skipping duplicate attempt");
        return;
      }
      
      connectionInProgress = true;

      if (!state.auth.isAuthenticated) {
        console.error('Cannot connect: Not authenticated');
        return;
      }
      
      // Show loading state
      showTerminalLoading(tabId);
      //updateStatusPanel('Connecting to server...', 'info');
      
      // Connect to WebSocket
      connectWebSocket(tabId, checkExistingSession)
      .finally(() => {
        // Reset flag to allow future connection attempts
        setTimeout(() => {
          connectionInProgress = false;
        }, 1000);
      });
    }
    
    /**
     * Connect to WebSocket server with JWT authentication
     * @param {string} tabId - Tab identifier
     * @param {boolean} checkExistingSession - Force check for existing sessions
     */
    function connectWebSocket(tabId, checkExistingSession = false) {
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
        let authToken = getAuthTokenFromCookie();
        
        // If not in cookie, try localStorage backups
        if (!authToken) {
          authToken = localStorage.getItem('terminal_auth_token');
        }
        
        if (!authToken) {
          log('Cannot connect: Missing authentication token', 'error');
          reject(new Error('Missing authentication token'));
          return;
        }
        
        // Get user ID for connection
        const userId = state.auth.userProfile?.login;
        const terminalId = 'terminal_' + tabId + '_' + generateUniqueId();
        
        // Create connection URL with the JWT token parameter
        let wsUrl = `${CONFIG.WS_URL}?token=${encodeURIComponent(authToken)}&terminalid=${encodeURIComponent(terminalId)}`;
        
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
              log('Connection timeout. Server not responding.', 'error');
              if (state.websockets[tabId]) state.websockets[tabId].close();
              reject(new Error('Connection timeout'));
            }
          }, CONFIG.CONNECTION_TIMEOUT);
          
          // Set up event handlers that resolve/reject the promise
          state.websockets[tabId].onopen = function() {
            clearTimeout(connectionTimeout);
            log('WebSocket connection established', 'info');
            
            // Send auth message to start the terminal session
            state.websockets[tabId].send(JSON.stringify({
              type: 'auth'
            }));
            
            // Set up other handlers
            setupWebSocketHandlers(tabId);
            
            resolve();
          };
          
          state.websockets[tabId].onerror = function(error) {
            clearTimeout(connectionTimeout);
            log(`WebSocket error: ${error.message || 'Unknown error'}`, 'error');
            reject(error);
          };
          
          state.websockets[tabId].onclose = function(event) {
            clearTimeout(connectionTimeout);
            
            if (event.wasClean) {
              log(`Connection closed cleanly, code: ${event.code}`, 'info');
            } else {
              log('Connection died', 'error');
            }
            
            // Only reject if the connection hasn't been established yet
            if (state.websockets[tabId].readyState !== WebSocket.OPEN) {
              reject(new Error('Connection closed'));
            }
          };
          
        } catch (error) {
          log(`Error creating WebSocket: ${error.message}`, 'error');
          reject(error);
        }
      });
    }
      
    /**
     * Setup WebSocket event handlers - simplified version
     * @param {string} tabId - Tab identifier
     * @param {number} connectionTimeout - Connection timeout ID
     */
    function setupWebSocketHandlers(tabId) {
      state.websockets[tabId].onmessage = function(event) {
        handleWebSocketMessage(event, tabId);
      };
    }
    
    /**
     * Handle WebSocket message
     * @param {MessageEvent} event - WebSocket message event
     * @param {string} tabId - Tab identifier
     */
    function handleWebSocketMessage(event, tabId) {
      try {
        // Log message received by server (may be useful for debug)
        //console.log(event);

        // Try to parse as JSON
        let jsonData = JSON.parse(event.data);

        switch (jsonData.type) {
          case 'vm_creating':
            showTerminalLoading(tabId, 'Creating your environment...');
            log('Your environment is being created. Please wait...', 'info');
            break;
            
          case 'vm_ready':
            log('Your environment is ready!', 'success');
            
            // Initialize proper terminal if needed
            if (!state.terminals[tabId]) {
              initializeTerminal(tabId);
            }
            break;
            
          case 'connected':
            log('SSH connection established', 'success');
            break;
            
          case 'data':
            if (state.terminals[tabId]) state.terminals[tabId].write(jsonData.data);
            break;
            
          case 'error':
            log(`Error: ${jsonData.message}`, 'error');
            if (jsonData.cooldown) {
              const formattedTime = jsonData.cooldown.formattedTime || formatDate(new Date(jsonData.cooldown.expiryTimestamp));
              showCooldownMessage(tabId, formattedTime);

              // Clear auth data on session expiration
              if (jsonData.message && jsonData.message.includes('session expired')) {
                clearAuthData();
              }
            }
            break;
            
          // Handle session termination with cooldown  
          case 'environment_terminated':
            if (jsonData.cooldown) {
              const formattedTime = jsonData.cooldown.formattedTime || formatDate(new Date(jsonData.cooldown.expiryTimestamp));
              showCooldownMessage(tabId, formattedTime);

              // Clear auth data on session termination
              clearAuthData();
            }
            break;
            
          case 'closed':
            log('SSH connection closed', 'info');
            break;
        }
      } catch (error) {
        // Not JSON, treat as raw data
        if (state.terminals[tabId]) {
          state.terminals[tabId].write(event.data);
        }
      }
    }
    
    /**
     * Resize terminal
     * @param {string} tabId - Tab identifier
     */
    function resizeTerminal(tabId) {
      if (!state.terminals[tabId] || !state.fitAddons[tabId]) return;
      
      try {
        // Resize the terminal to fit its container
        state.fitAddons[tabId].fit();
        
        // Send the new size to the server if connected
        if (state.websockets[tabId] && state.websockets[tabId].readyState === WebSocket.OPEN) {
          const cols = Math.max(state.terminals[tabId].cols, CONFIG.DEFAULT_COLS);
          const rows = Math.max(state.terminals[tabId].rows, CONFIG.DEFAULT_ROWS);
          
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
    
    //=============================================================================
    // UI MANAGEMENT
    //=============================================================================
    
    /**
     * Show terminal UI
     */
    function showTerminal() {
        state.isTerminalVisible = true;
        
        const wrapper = getElement('terminalWrapper');
        if (!wrapper) return;
        
        // Show the terminal wrapper
        wrapper.style.display = 'flex';
        wrapper.style.bottom = '0px';
        
        // Show/hide UI elements based on authentication status
        const loginContainer = getElement('login-container');
        const tabsContainer = getElement('terminal-tabs-container');
        const terminalContainer = getElement(`terminal-container-${state.activeTabId}`);
        
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
                  setTimeout(() => resizeTerminal(state.activeTabId), 50);
                } else {
                  // Initialize connection
                  initializeAndConnectTerminal(state.activeTabId);
                }
              } else {
                // No terminal exists, create one
                initializeAndConnectTerminal(state.activeTabId);
              }
            } else {
              // We have an active connection, just resize the terminal
              setTimeout(() => resizeTerminal(state.activeTabId), 50);
            }
        } else {
            // When not authenticated, show login UI
            if (loginContainer) {
            loginContainer.style.display = 'flex';
            console.log('Showing login container');
            }
            if (tabsContainer) tabsContainer.style.display = 'none';
            if (terminalContainer) terminalContainer.style.display = 'none';
        }
    }
    
    /**
     * Hide terminal UI
     */
    function hideTerminal() {
      state.isTerminalVisible = false;
      
      const wrapper = getElement('terminalWrapper');
      if (!wrapper) return;
      
      wrapper.style.bottom = '-' + wrapper.offsetHeight + 'px';
    }
    
    /**
     * Toggle terminal visibility
     */
    function toggleTerminal() {
      if (state.isTerminalVisible) {
        hideTerminal();
      } else {
        showTerminal();
      }
    }
    
    /**
     * Switch to a different terminal tab
     * @param {string} tabId - Tab identifier
     */
    function switchTab(tabId) {
      // Only allow tab switching if authenticated
      if (!state.auth.isAuthenticated) return;
      
      // Update active tab
      state.activeTabId = tabId;
      
      // Update tab UI
      document.querySelectorAll('.terminal-tab').forEach(function(tab) {
        tab.classList.remove('active-tab');
        tab.style.backgroundColor = '#222';
      });
      
      const activeTabElement = getElement(`terminal-tab-${tabId}`);
      if (activeTabElement) {
        activeTabElement.classList.add('active-tab');
        activeTabElement.style.backgroundColor = '#444';
      }
      
      // Update terminal containers visibility
      document.querySelectorAll('.terminal-container').forEach(function(container) {
        container.style.display = 'none';
      });
      
      const activeContainer = getElement(`terminal-container-${tabId}`);
      if (activeContainer) {
        activeContainer.style.display = 'block';
      }
      
      // Initialize terminal if it doesn't exist
      if (!state.terminals[tabId]) {
        if (state.websockets[tabId] && state.websockets[tabId].readyState === WebSocket.OPEN) {
          // If already connected, initialize terminal
          initializeTerminal(tabId);
        } else {
          // Otherwise connect to WebSocket
          initializeAndConnectTerminal(tabId);
        }
      } else {
        // Terminal exists, just resize it
        setTimeout(() => resizeTerminal(tabId), 50);
      }
    }
    
    /**
     * Setup vertical resize functionality
     * @param {HTMLElement} resizeHandle - Resize handle element
     * @param {HTMLElement} wrapper - Terminal wrapper element
     */
    function setupVerticalResize(resizeHandle, wrapper) {
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
        Math.max(startHeight + deltaY, CONFIG.MIN_HEIGHT),
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
        wrapper.style.transition = `bottom ${CONFIG.TERMINAL_TRANSITION_SPEED} ease-in-out`;
        document.body.style.userSelect = '';
        
        // If terminal is hidden, update the bottom position
        if (!state.isTerminalVisible) {
          wrapper.style.bottom = '-' + wrapper.offsetHeight + 'px';
        }
        
        // Apply terminal resize on all tabs
        Object.keys(state.terminals).forEach(id => {
          if (state.terminals[id] && state.fitAddons[id]) {
            resizeTerminal(id);
          }
        });
      }
    });
  }
  
  /**
   * Setup horizontal drag functionality
   * @param {HTMLElement} header - Terminal header element
   * @param {HTMLElement} wrapper - Terminal wrapper element
   */
  function setupHorizontalDrag(header, wrapper) {
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
  
  //=============================================================================
  // INITIALIZATION
  //=============================================================================
  
  /**
   * Initialize the application
   */
  function initialize() {
    //console.log('Terminal script loaded');
    
    // Check for existing authentication
    const existingAuth = checkExistingAuth();
    
    // Handle OAuth callback
    handleOAuthCallback();
    
    // Pre-create terminal container for tab 1 (if not already in HTML)
    if (!getElement('terminal-container-1')) {
      createTerminalContainer('1');
    }

    // Setup event listeners
    setupEventListeners();
    
    // Setup window resize handler
    window.addEventListener('resize', function() {
      // Resize all terminals when window is resized
      if (state.isTerminalVisible) {
        Object.keys(state.terminals).forEach(id => {
          if (state.terminals[id] && state.fitAddons[id]) {
            resizeTerminal(id);
          }
        });
      }
    });
    
    // If authenticated, show terminal
    if (existingAuth) {
      setTimeout(() => showTerminal(), 500);
    } else {
      // Show login container
      const loginContainer = getElement('login-container');
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
      toggleButton: getElement('terminalToggle'),
      wrapper: getElement('terminalWrapper'),
      minimizeButton: getElement('terminalMinimize'),
      closeButton: getElement('terminalClose'),
      resizeHandle: getElement('terminalResizeHandle'),
      header: getElement('terminalHeader'),
      githubLoginButton: getElement('github-login-button'),
      tab1: getElement('terminal-tab-1'),
      tab2: getElement('terminal-tab-2')
    };
    
    // Terminal toggle button
    if (elements.toggleButton) {
      elements.toggleButton.addEventListener('click', toggleTerminal);
    }
    
    // Terminal minimize button
    if (elements.minimizeButton) {
      elements.minimizeButton.addEventListener('click', toggleTerminal);
    }
    
    // Terminal close button
    if (elements.closeButton) {
      elements.closeButton.addEventListener('click', function() {
        closeAllConnections();
        hideTerminal();
      });
    }
    
    // GitHub login button
    if (elements.githubLoginButton) {
      elements.githubLoginButton.addEventListener('click', initiateGitHubLogin);
    }
    
    // Add terminal tab button
    const addTerminalTabButton = getElement('add-terminal-tab');
    if (addTerminalTabButton) {
      addTerminalTabButton.addEventListener('click', function() {
        if (state.auth.isAuthenticated) {
          createNewTerminalTab();
        } else {
          log('Please login first', 'error');
        }
      });
    }

    // Terminal tabs
    if (elements.tab1) {
      elements.tab1.addEventListener('click', function() {
        switchTab('1');
      });
    }
    
    if (elements.tab2) {
      elements.tab2.addEventListener('click', function() {
        switchTab('2');
      });
    }
    
    // Setup resize and drag functionality
    if (elements.resizeHandle && elements.wrapper) {
      setupVerticalResize(elements.resizeHandle, elements.wrapper);
    }
    
    if (elements.header && elements.wrapper) {
      setupHorizontalDrag(elements.header, elements.wrapper);
    }
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', function(e) {
      // Alt+T to toggle terminal
      if (e.altKey && e.key === 't') {
        toggleTerminal();
        e.preventDefault();
      }
    });
  }
  
  // Initialize the application when DOM is ready
  document.addEventListener('DOMContentLoaded', initialize);
})();