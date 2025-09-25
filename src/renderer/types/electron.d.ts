import { SSOConfig, RoleConfig, AWSProfile, ConnectionStatus, AWSCredentials } from '../../shared/types';

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

export {};