import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { AWSCredentialManager } from '../aws/credential-manager';
import { SSOConfig } from '../../shared/types';

export interface SSOIPCHandlers {
  'sso:authenticate': (config: SSOConfig) => Promise<{ success: boolean; error?: string }>;
  'sso:get-accounts': (startUrl: string, region: string) => Promise<Array<{accountId: string; accountName: string; emailAddress: string}>>;
  'sso:get-account-roles': (accountId: string) => Promise<Array<{roleName: string; accountId: string}>>;
  'sso:setup-credentials': (config: SSOConfig) => Promise<{ success: boolean; error?: string }>;
  'sso:refresh-tokens': (startUrl: string, region: string) => Promise<{ success: boolean; error?: string }>;
  'sso:logout': () => Promise<void>;
  'sso:get-status': () => Promise<{ isAuthenticated: boolean; config?: SSOConfig }>;
}

/**
 * Setup IPC handlers for SSO authentication
 */
export function setupSSOIPCHandlers(credentialManager: AWSCredentialManager): void {
  // Initialize SSO
  ipcMain.handle('sso:initialize', async (): Promise<void> => {
    await credentialManager.initializeSSO();
  });

  // Authenticate with SSO
  ipcMain.handle('sso:authenticate', async (
    event: IpcMainInvokeEvent,
    config: SSOConfig
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await credentialManager.authenticateWithSSO(config);
      return {
        success: result.valid,
        error: result.error
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  });

  // Get available accounts
  ipcMain.handle('sso:get-accounts', async (
    event: IpcMainInvokeEvent,
    startUrl: string,
    region: string
  ): Promise<Array<{accountId: string; accountName: string; emailAddress: string}>> => {
    try {
      return await credentialManager.getSSOAccounts(startUrl, region);
    } catch (error) {
      console.error('Failed to get SSO accounts:', error);
      return [];
    }
  });

  // Get roles for account
  ipcMain.handle('sso:get-account-roles', async (
    event: IpcMainInvokeEvent,
    accountId: string
  ): Promise<Array<{roleName: string; accountId: string}>> => {
    try {
      return await credentialManager.getSSOAccountRoles(accountId);
    } catch (error) {
      console.error('Failed to get account roles:', error);
      return [];
    }
  });

  // Setup credentials with account and role
  ipcMain.handle('sso:setup-credentials', async (
    event: IpcMainInvokeEvent,
    config: SSOConfig
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // Get stored tokens first
      const result = await credentialManager.setupSSOCredentials(config, {} as any); // Tokens will be loaded from storage
      return {
        success: result.valid,
        error: result.error
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Credential setup failed'
      };
    }
  });

  // Refresh SSO tokens
  ipcMain.handle('sso:refresh-tokens', async (
    event: IpcMainInvokeEvent,
    startUrl: string,
    region: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await credentialManager.refreshSSOTokens(startUrl, region);
      return {
        success: result.valid,
        error: result.error
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token refresh failed'
      };
    }
  });

  // Logout from SSO
  ipcMain.handle('sso:logout', async (): Promise<void> => {
    await credentialManager.logoutSSO();
  });

  // Get SSO authentication status
  ipcMain.handle('sso:get-status', async (): Promise<{ isAuthenticated: boolean; config?: SSOConfig }> => {
    try {
      const connectionStatus = await credentialManager.testConnection();
      return {
        isAuthenticated: connectionStatus.connected && connectionStatus.credentialType === 'sso',
        // Note: We don't return the full config for security reasons
        config: connectionStatus.connected && connectionStatus.credentialType === 'sso' ? {
          startUrl: '', // Don't expose sensitive data
          region: connectionStatus.region || '',
          sessionName: 'aws-network-flow-visualizer'
        } : undefined
      };
    } catch (error) {
      return {
        isAuthenticated: false
      };
    }
  });
}

/**
 * Remove SSO IPC handlers
 */
export function removeSSOIPCHandlers(): void {
  ipcMain.removeAllListeners('sso:initialize');
  ipcMain.removeAllListeners('sso:authenticate');
  ipcMain.removeAllListeners('sso:get-accounts');
  ipcMain.removeAllListeners('sso:get-account-roles');
  ipcMain.removeAllListeners('sso:setup-credentials');
  ipcMain.removeAllListeners('sso:refresh-tokens');
  ipcMain.removeAllListeners('sso:logout');
  ipcMain.removeAllListeners('sso:get-status');
}