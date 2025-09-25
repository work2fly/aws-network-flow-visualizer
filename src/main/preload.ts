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
  },
});

// Type definitions for the exposed API
declare global {
  interface Window {
    electronAPI: {
      getAppVersion: () => Promise<string>;
      sso: {
        initialize: () => Promise<void>;
        authenticate: (config: SSOConfig) => Promise<{ success: boolean; error?: string }>;
        getAccounts: (startUrl: string, region: string) => Promise<Array<{accountId: string; accountName: string; emailAddress: string}>>;
        getAccountRoles: (accountId: string) => Promise<Array<{roleName: string; accountId: string}>>;
        setupCredentials: (config: SSOConfig) => Promise<{ success: boolean; error?: string }>;
        refreshTokens: (startUrl: string, region: string) => Promise<{ success: boolean; error?: string }>;
        logout: () => Promise<void>;
        getStatus: () => Promise<{ isAuthenticated: boolean; config?: SSOConfig }>;
      };
      aws: {
        // Profile management
        getProfiles: () => Promise<AWSProfile[]>;
        validateProfile: (profileName: string) => Promise<{ valid: boolean; error?: string; profileType?: 'sso' | 'role' | 'credentials' }>;
        authenticateWithProfile: (profileName: string, region?: string) => Promise<{ success: boolean; error?: string }>;
        authenticateWithRole: (roleConfig: RoleConfig) => Promise<{ success: boolean; error?: string }>;
        getSourceProfiles: () => Promise<AWSProfile[]>;
        getRoleProfiles: () => Promise<AWSProfile[]>;
        profileRequiresMFA: (profileName: string) => Promise<boolean>;

        // Connection management
        testConnection: () => Promise<ConnectionStatus>;
        getCurrentCredentials: () => Promise<AWSCredentials | null>;
        refreshCredentials: () => Promise<{ success: boolean; error?: string }>;
        clearCredentials: () => Promise<void>;
        getRegions: () => Promise<string[]>;
        hasConfig: () => Promise<boolean>;
        areCredentialsExpired: () => Promise<boolean>;
        autoDiscover: () => Promise<{ success: boolean; error?: string }>;
      };
    };
  }
}
