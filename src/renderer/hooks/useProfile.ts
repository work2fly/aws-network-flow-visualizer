import { useState, useEffect, useCallback } from 'react';
import { AWSProfile, RoleConfig, ConnectionStatus, CredentialValidationResult } from '../../shared/types';

interface ProfileState {
  profiles: AWSProfile[];
  selectedProfile: string | null;
  connectionStatus: ConnectionStatus | null;
  isLoading: boolean;
  isAuthenticating: boolean;
  error: string | null;
  lastRefresh: Date | null;
}

interface ProfileActions {
  loadProfiles: () => Promise<void>;
  authenticateWithProfile: (profileName: string, region?: string) => Promise<CredentialValidationResult>;
  authenticateWithRole: (roleConfig: RoleConfig) => Promise<CredentialValidationResult>;
  testConnection: () => Promise<ConnectionStatus>;
  refreshCredentials: () => Promise<void>;
  clearCredentials: () => Promise<void>;
  setSelectedProfile: (profileName: string | null) => void;
  clearError: () => void;
}

export function useProfile(): [ProfileState, ProfileActions] {
  const [state, setState] = useState<ProfileState>({
    profiles: [],
    selectedProfile: null,
    connectionStatus: null,
    isLoading: false,
    isAuthenticating: false,
    error: null,
    lastRefresh: null,
  });

  // Load profiles on mount
  useEffect(() => {
    loadProfiles();
    checkConnectionStatus();
  }, []);

  // Auto-refresh connection status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (state.connectionStatus?.connected) {
        checkConnectionStatus();
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [state.connectionStatus?.connected]);

  const loadProfiles = useCallback(async (): Promise<void> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const profiles = await window.electronAPI.aws.getProfiles();
      setState(prev => ({ 
        ...prev, 
        profiles, 
        isLoading: false,
        lastRefresh: new Date()
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load profiles';
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMessage 
      }));
    }
  }, []);

  const checkConnectionStatus = useCallback(async (): Promise<void> => {
    try {
      const connectionStatus = await window.electronAPI.aws.testConnection();
      setState(prev => ({ ...prev, connectionStatus }));
    } catch (error) {
      console.error('Failed to check connection status:', error);
      setState(prev => ({ 
        ...prev, 
        connectionStatus: { 
          connected: false, 
          error: 'Failed to check connection status' 
        } 
      }));
    }
  }, []);

  const authenticateWithProfile = useCallback(async (
    profileName: string, 
    region?: string
  ): Promise<CredentialValidationResult> => {
    setState(prev => ({ ...prev, isAuthenticating: true, error: null }));
    
    try {
      const result = await window.electronAPI.aws.authenticateWithProfile(profileName, region);
      
      if (result.success) {
        setState(prev => ({ 
          ...prev, 
          selectedProfile: profileName,
          isAuthenticating: false 
        }));
        
        // Update connection status
        await checkConnectionStatus();
        
        return {
          valid: true,
          credentialType: 'profile'
        };
      } else {
        setState(prev => ({ 
          ...prev, 
          isAuthenticating: false, 
          error: result.error || 'Profile authentication failed' 
        }));
        
        return {
          valid: false,
          error: result.error || 'Profile authentication failed'
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Profile authentication failed';
      setState(prev => ({ 
        ...prev, 
        isAuthenticating: false, 
        error: errorMessage 
      }));
      
      return {
        valid: false,
        error: errorMessage
      };
    }
  }, [checkConnectionStatus]);

  const authenticateWithRole = useCallback(async (
    roleConfig: RoleConfig
  ): Promise<CredentialValidationResult> => {
    setState(prev => ({ ...prev, isAuthenticating: true, error: null }));
    
    try {
      const result = await window.electronAPI.aws.authenticateWithRole(roleConfig);
      
      if (result.success) {
        setState(prev => ({ 
          ...prev, 
          isAuthenticating: false 
        }));
        
        // Update connection status
        await checkConnectionStatus();
        
        return {
          valid: true,
          credentialType: 'role'
        };
      } else {
        setState(prev => ({ 
          ...prev, 
          isAuthenticating: false, 
          error: result.error || 'Role authentication failed' 
        }));
        
        return {
          valid: false,
          error: result.error || 'Role authentication failed'
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Role authentication failed';
      setState(prev => ({ 
        ...prev, 
        isAuthenticating: false, 
        error: errorMessage 
      }));
      
      return {
        valid: false,
        error: errorMessage
      };
    }
  }, [checkConnectionStatus]);

  const testConnection = useCallback(async (): Promise<ConnectionStatus> => {
    try {
      const connectionStatus = await window.electronAPI.aws.testConnection();
      setState(prev => ({ ...prev, connectionStatus }));
      return connectionStatus;
    } catch (error) {
      const errorStatus: ConnectionStatus = {
        connected: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      };
      setState(prev => ({ ...prev, connectionStatus: errorStatus }));
      return errorStatus;
    }
  }, []);

  const refreshCredentials = useCallback(async (): Promise<void> => {
    setState(prev => ({ ...prev, error: null }));
    
    try {
      const result = await window.electronAPI.aws.refreshCredentials();
      
      if (result.success) {
        await checkConnectionStatus();
      } else {
        setState(prev => ({ 
          ...prev, 
          error: result.error || 'Failed to refresh credentials' 
        }));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh credentials';
      setState(prev => ({ ...prev, error: errorMessage }));
    }
  }, [checkConnectionStatus]);

  const clearCredentials = useCallback(async (): Promise<void> => {
    try {
      await window.electronAPI.aws.clearCredentials();
      setState(prev => ({ 
        ...prev, 
        selectedProfile: null,
        connectionStatus: { connected: false },
        error: null 
      }));
    } catch (error) {
      console.error('Failed to clear credentials:', error);
    }
  }, []);

  const setSelectedProfile = useCallback((profileName: string | null): void => {
    setState(prev => ({ ...prev, selectedProfile: profileName }));
  }, []);

  const clearError = useCallback((): void => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const actions: ProfileActions = {
    loadProfiles,
    authenticateWithProfile,
    authenticateWithRole,
    testConnection,
    refreshCredentials,
    clearCredentials,
    setSelectedProfile,
    clearError,
  };

  return [state, actions];
}