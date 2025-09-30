/**
 * Browser polyfills for Node.js globals when running in development
 * This allows the renderer to work in both Electron and browser environments
 */

// Polyfill for Node.js global object
if (typeof global === 'undefined') {
  (window as any).global = window;
}

// Polyfill for process object (minimal implementation)
if (typeof process === 'undefined') {
  (window as any).process = {
    env: {},
    platform: 'browser',
    version: '16.0.0',
    versions: { node: '16.0.0' }
  };
}

// Mock electronAPI for browser development
if (typeof window !== 'undefined' && !window.electronAPI) {
  (window as any).electronAPI = {
    getAppVersion: () => Promise.resolve('1.0.0-dev'),
    
    sso: {
      initialize: () => Promise.resolve(),
      authenticate: () => Promise.resolve({ success: false, error: 'Not available in browser' }),
      getAccounts: () => Promise.resolve([]),
      getAccountRoles: () => Promise.resolve([]),
      setupCredentials: () => Promise.resolve({ success: false, error: 'Not available in browser' }),
      refreshTokens: () => Promise.resolve({ success: false, error: 'Not available in browser' }),
      logout: () => Promise.resolve(),
      getStatus: () => Promise.resolve({ isAuthenticated: false }),
    },
    
    aws: {
      getProfiles: () => Promise.resolve([]),
      validateProfile: () => Promise.resolve({ valid: false, error: 'Not available in browser' }),
      authenticateWithProfile: () => Promise.resolve({ success: false, error: 'Not available in browser' }),
      authenticateWithRole: () => Promise.resolve({ success: false, error: 'Not available in browser' }),
      getSourceProfiles: () => Promise.resolve([]),
      getRoleProfiles: () => Promise.resolve([]),
      profileRequiresMFA: () => Promise.resolve(false),
      testConnection: () => Promise.resolve({ connected: false, error: 'Not available in browser' }),
      getCurrentCredentials: () => Promise.resolve(null),
      refreshCredentials: () => Promise.resolve({ success: false, error: 'Not available in browser' }),
      clearCredentials: () => Promise.resolve(),
      getRegions: () => Promise.resolve(['us-east-1', 'us-west-2', 'eu-west-1']),
      hasConfig: () => Promise.resolve(false),
      areCredentialsExpired: () => Promise.resolve(true),
      autoDiscover: () => Promise.resolve({ success: false, error: 'Not available in browser' }),
      queryVPCFlowLogs: () => Promise.resolve({ success: false, error: 'Not available in browser' }),
      queryTGWFlowLogs: () => Promise.resolve({ success: false, error: 'Not available in browser' }),
    },
    
    network: {
      buildTopology: () => Promise.resolve({ nodes: [], edges: [] }),
      analyzeTrafficPatterns: () => Promise.resolve({ patterns: [] }),
    },
    
    anonymizeData: (data: any) => Promise.resolve(data),
    anonymizeFlowLogs: (flowLogs: any[]) => Promise.resolve(flowLogs),
    anonymizeTopology: (topology: any) => Promise.resolve(topology),
    
    networkSecurity: {
      getRequestLogs: () => Promise.resolve([]),
      clearRequestLogs: () => Promise.resolve(),
      exportRequestLogs: () => Promise.resolve(''),
      getCertificatePins: () => Promise.resolve([]),
      addCertificatePin: () => Promise.resolve(),
      removeCertificatePin: () => Promise.resolve(),
    },
  };
}

export {};