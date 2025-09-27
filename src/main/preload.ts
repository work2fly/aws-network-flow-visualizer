import { contextBridge, ipcRenderer } from 'electron';
import { SSOConfig, RoleConfig, AWSProfile, ConnectionStatus, AWSCredentials } from '../shared/types';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('app-version'),

  // SSO Authentication methods
  sso: {
    initialize: () => ipcRenderer.invoke('sso:initialize'),
    authenticate: (config: SSOConfig) => ipcRenderer.invoke('sso:authenticate', config),
    getAccounts: (startUrl: string, region: string) => ipcRenderer.invoke('sso:get-accounts', startUrl, region),
    getAccountRoles: (accountId: string) => ipcRenderer.invoke('sso:get-account-roles', accountId),
    setupCredentials: (config: SSOConfig) => ipcRenderer.invoke('sso:setup-credentials', config),
    refreshTokens: (startUrl: string, region: string) => ipcRenderer.invoke('sso:refresh-tokens', startUrl, region),
    logout: () => ipcRenderer.invoke('sso:logout'),
    getStatus: () => ipcRenderer.invoke('sso:get-status'),
  },

  // AWS Profile and Role methods
  aws: {
    // Profile management
    getProfiles: () => ipcRenderer.invoke('profile:get-profiles'),
    validateProfile: (profileName: string) => ipcRenderer.invoke('profile:validate-profile', profileName),
    authenticateWithProfile: (profileName: string, region?: string) => ipcRenderer.invoke('profile:authenticate', profileName, region),
    authenticateWithRole: (roleConfig: RoleConfig) => ipcRenderer.invoke('profile:authenticate-with-role', roleConfig),
    getSourceProfiles: () => ipcRenderer.invoke('profile:get-source-profiles'),
    getRoleProfiles: () => ipcRenderer.invoke('profile:get-role-profiles'),
    profileRequiresMFA: (profileName: string) => ipcRenderer.invoke('profile:requires-mfa', profileName),

    // Connection management
    testConnection: () => ipcRenderer.invoke('aws:test-connection'),
    getCurrentCredentials: () => ipcRenderer.invoke('aws:get-current-credentials'),
    refreshCredentials: () => ipcRenderer.invoke('aws:refresh-credentials'),
    clearCredentials: () => ipcRenderer.invoke('aws:clear-credentials'),
    getRegions: () => ipcRenderer.invoke('aws:get-regions'),
    hasConfig: () => ipcRenderer.invoke('aws:has-config'),
    areCredentialsExpired: () => ipcRenderer.invoke('aws:are-credentials-expired'),
    autoDiscover: () => ipcRenderer.invoke('aws:auto-discover'),

    // Flow log queries
    queryVPCFlowLogs: (params: any) => ipcRenderer.invoke('aws:query-vpc-flow-logs', params),
    queryTGWFlowLogs: (params: any) => ipcRenderer.invoke('aws:query-tgw-flow-logs', params),
  },

  // Network topology and analysis methods
  network: {
    buildTopology: (flowLogs: any[]) => ipcRenderer.invoke('network:build-topology', flowLogs),
    analyzeTrafficPatterns: (params: any) => ipcRenderer.invoke('network:analyze-traffic-patterns', params),
  },

  // Data anonymization methods
  anonymizeData: (data: any, options?: any) => ipcRenderer.invoke('anonymize:data', data, options),
  anonymizeFlowLogs: (flowLogs: any[], options?: any) => ipcRenderer.invoke('anonymize:flow-logs', flowLogs, options),
  anonymizeTopology: (topology: any, options?: any) => ipcRenderer.invoke('anonymize:topology', topology, options),

  // Network security methods
  networkSecurity: {
    getRequestLogs: (options?: any) => ipcRenderer.invoke('network-security:get-request-logs', options),
    clearRequestLogs: () => ipcRenderer.invoke('network-security:clear-request-logs'),
    exportRequestLogs: (format: 'json' | 'csv') => ipcRenderer.invoke('network-security:export-request-logs', format),
    getCertificatePins: () => ipcRenderer.invoke('network-security:get-certificate-pins'),
    addCertificatePin: (config: any) => ipcRenderer.invoke('network-security:add-certificate-pin', config),
    removeCertificatePin: (hostname: string) => ipcRenderer.invoke('network-security:remove-certificate-pin', hostname),
  },
});


