import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { AWSConnectionManager } from '../aws/connection-manager';
import { AWSProfileReader } from '../aws/profile-reader';
import { ProfileConfig, RoleConfig, AWSProfile, ConnectionStatus, AWSCredentials } from '../../shared/types';

export interface ProfileIPCHandlers {
  'profile:get-profiles': () => Promise<AWSProfile[]>;
  'profile:validate-profile': (profileName: string) => Promise<{ valid: boolean; error?: string; profileType?: 'sso' | 'role' | 'credentials' }>;
  'profile:authenticate': (profileName: string, region?: string) => Promise<{ success: boolean; error?: string }>;
  'profile:authenticate-with-role': (roleConfig: RoleConfig) => Promise<{ success: boolean; error?: string }>;
  'profile:get-source-profiles': () => Promise<AWSProfile[]>;
  'profile:get-role-profiles': () => Promise<AWSProfile[]>;
  'profile:requires-mfa': (profileName: string) => Promise<boolean>;
  'aws:test-connection': () => Promise<ConnectionStatus>;
  'aws:get-current-credentials': () => Promise<AWSCredentials | null>;
  'aws:refresh-credentials': () => Promise<{ success: boolean; error?: string }>;
  'aws:clear-credentials': () => Promise<void>;
  'aws:get-regions': () => Promise<string[]>;
}

/**
 * Setup IPC handlers for AWS profile and role authentication
 */
export function setupProfileIPCHandlers(connectionManager: AWSConnectionManager): void {
  const profileReader = new AWSProfileReader();

  // Get all available profiles
  ipcMain.handle('profile:get-profiles', async (): Promise<AWSProfile[]> => {
    try {
      return await profileReader.getAvailableProfiles();
    } catch (error) {
      console.error('Failed to get profiles:', error);
      return [];
    }
  });

  // Validate a specific profile
  ipcMain.handle('profile:validate-profile', async (
    event: IpcMainInvokeEvent,
    profileName: string
  ): Promise<{ valid: boolean; error?: string; profileType?: 'sso' | 'role' | 'credentials' }> => {
    try {
      return await profileReader.validateProfile(profileName);
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Profile validation failed'
      };
    }
  });

  // Authenticate with a profile
  ipcMain.handle('profile:authenticate', async (
    event: IpcMainInvokeEvent,
    profileName: string,
    region?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await connectionManager.initializeWithProfile(profileName, region);
      return {
        success: result.valid,
        error: result.error
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Profile authentication failed'
      };
    }
  });

  // Authenticate with role assumption
  ipcMain.handle('profile:authenticate-with-role', async (
    event: IpcMainInvokeEvent,
    roleConfig: RoleConfig
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await connectionManager.initializeWithRole(
        roleConfig.roleArn,
        roleConfig.sessionName,
        roleConfig.region
      );
      return {
        success: result.valid,
        error: result.error
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Role authentication failed'
      };
    }
  });

  // Get profiles that can be used as source profiles for role assumption
  ipcMain.handle('profile:get-source-profiles', async (): Promise<AWSProfile[]> => {
    try {
      return await profileReader.getSourceProfiles();
    } catch (error) {
      console.error('Failed to get source profiles:', error);
      return [];
    }
  });

  // Get profiles that assume roles
  ipcMain.handle('profile:get-role-profiles', async (): Promise<AWSProfile[]> => {
    try {
      return await profileReader.getRoleProfiles();
    } catch (error) {
      console.error('Failed to get role profiles:', error);
      return [];
    }
  });

  // Check if profile requires MFA
  ipcMain.handle('profile:requires-mfa', async (
    event: IpcMainInvokeEvent,
    profileName: string
  ): Promise<boolean> => {
    try {
      return await profileReader.profileRequiresMFA(profileName);
    } catch (error) {
      console.error('Failed to check MFA requirement:', error);
      return false;
    }
  });

  // Test current AWS connection
  ipcMain.handle('aws:test-connection', async (): Promise<ConnectionStatus> => {
    try {
      return await connectionManager.testConnection();
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  });

  // Get current credentials information
  ipcMain.handle('aws:get-current-credentials', async (): Promise<AWSCredentials | null> => {
    try {
      return connectionManager.getCurrentCredentials();
    } catch (error) {
      console.error('Failed to get current credentials:', error);
      return null;
    }
  });

  // Refresh current credentials
  ipcMain.handle('aws:refresh-credentials', async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const success = await connectionManager.refreshCredentials();
      return {
        success,
        error: success ? undefined : 'Failed to refresh credentials'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Credential refresh failed'
      };
    }
  });

  // Clear current credentials
  ipcMain.handle('aws:clear-credentials', async (): Promise<void> => {
    try {
      connectionManager.clearCredentials();
    } catch (error) {
      console.error('Failed to clear credentials:', error);
    }
  });

  // Get available AWS regions
  ipcMain.handle('aws:get-regions', async (): Promise<string[]> => {
    try {
      return await connectionManager.getAvailableRegions();
    } catch (error) {
      console.error('Failed to get regions:', error);
      return [];
    }
  });

  // Check if AWS configuration exists
  ipcMain.handle('aws:has-config', async (): Promise<boolean> => {
    try {
      return connectionManager.hasAWSConfig();
    } catch (error) {
      console.error('Failed to check AWS config:', error);
      return false;
    }
  });

  // Check if credentials are expired
  ipcMain.handle('aws:are-credentials-expired', async (): Promise<boolean> => {
    try {
      return connectionManager.areCredentialsExpired();
    } catch (error) {
      console.error('Failed to check credential expiration:', error);
      return true; // Assume expired on error for safety
    }
  });

  // Initialize with automatic credential discovery
  ipcMain.handle('aws:auto-discover', async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await connectionManager.initializeWithAutoDiscovery();
      return {
        success: result.valid,
        error: result.error
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Auto-discovery failed'
      };
    }
  });
}

/**
 * Remove profile IPC handlers
 */
export function removeProfileIPCHandlers(): void {
  ipcMain.removeAllListeners('profile:get-profiles');
  ipcMain.removeAllListeners('profile:validate-profile');
  ipcMain.removeAllListeners('profile:authenticate');
  ipcMain.removeAllListeners('profile:authenticate-with-role');
  ipcMain.removeAllListeners('profile:get-source-profiles');
  ipcMain.removeAllListeners('profile:get-role-profiles');
  ipcMain.removeAllListeners('profile:requires-mfa');
  ipcMain.removeAllListeners('aws:test-connection');
  ipcMain.removeAllListeners('aws:get-current-credentials');
  ipcMain.removeAllListeners('aws:refresh-credentials');
  ipcMain.removeAllListeners('aws:clear-credentials');
  ipcMain.removeAllListeners('aws:get-regions');
  ipcMain.removeAllListeners('aws:has-config');
  ipcMain.removeAllListeners('aws:are-credentials-expired');
  ipcMain.removeAllListeners('aws:auto-discover');
}