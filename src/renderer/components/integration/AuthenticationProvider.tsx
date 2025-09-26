import React, { createContext, useContext, useEffect, useCallback } from 'react';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { 
  authenticateWithSSO,
  authenticateWithProfile,
  authenticateWithRole,
  testConnection,
  loadProfiles,
  loadSSOAccounts,
  loadSSOAccountRoles,
  setupSSOCredentials,
  logout,
  clearAllErrors,
  updateConnectionStatus
} from '../../store/slices/authSlice';
import { 
  SSOConfig, 
  RoleConfig, 
  ConnectionStatus,
  CredentialValidationResult 
} from '@shared/types';

interface AuthenticationContextValue {
  // Authentication methods
  authenticateSSO: (config: SSOConfig) => Promise<void>;
  authenticateProfile: (profileName: string, region?: string) => Promise<CredentialValidationResult>;
  authenticateRole: (roleConfig: RoleConfig) => Promise<void>;
  logoutUser: () => Promise<void>;
  
  // Connection management
  testAWSConnection: () => Promise<ConnectionStatus>;
  refreshConnection: () => Promise<void>;
  
  // Profile management
  loadAWSProfiles: () => Promise<void>;
  
  // SSO management
  loadSSOAccountList: (startUrl: string, region: string) => Promise<void>;
  loadSSORoleList: (accountId: string) => Promise<void>;
  setupSSOCredentialsForRole: (config: SSOConfig) => Promise<void>;
  
  // Error management
  clearErrors: () => void;
  
  // State getters (for backward compatibility with existing hooks)
  getAuthState: () => ReturnType<typeof useAppSelector>;
}

const AuthenticationContext = createContext<AuthenticationContextValue | null>(null);

export const useAuthentication = () => {
  const context = useContext(AuthenticationContext);
  if (!context) {
    throw new Error('useAuthentication must be used within an AuthenticationProvider');
  }
  return context;
};

interface AuthenticationProviderProps {
  children: React.ReactNode;
}

export const AuthenticationProvider: React.FC<AuthenticationProviderProps> = ({ children }) => {
  const dispatch = useAppDispatch();
  const authState = useAppSelector(state => state.auth);
  
  // Initialize authentication on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        // Load profiles on startup
        await dispatch(loadProfiles()).unwrap();
        
        // Test existing connection
        await dispatch(testConnection()).unwrap();
      } catch (error) {
        console.error('Failed to initialize authentication:', error);
      }
    };
    
    initialize();
  }, [dispatch]);
  
  // Auto-refresh connection status periodically
  useEffect(() => {
    if (!authState.isAuthenticated) return;
    
    const interval = setInterval(async () => {
      try {
        const status = await dispatch(testConnection()).unwrap();
        dispatch(updateConnectionStatus(status));
      } catch (error) {
        console.error('Connection status check failed:', error);
      }
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, [authState.isAuthenticated, dispatch]);
  
  // Authentication methods
  const authenticateSSO = useCallback(async (config: SSOConfig) => {
    await dispatch(authenticateWithSSO(config)).unwrap();
  }, [dispatch]);
  
  const authenticateProfile = useCallback(async (profileName: string, region?: string): Promise<CredentialValidationResult> => {
    try {
      await dispatch(authenticateWithProfile({ profileName, region })).unwrap();
      return { valid: true, credentialType: 'profile' };
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Profile authentication failed' 
      };
    }
  }, [dispatch]);
  
  const authenticateRole = useCallback(async (roleConfig: RoleConfig) => {
    await dispatch(authenticateWithRole(roleConfig)).unwrap();
  }, [dispatch]);
  
  const logoutUser = useCallback(async () => {
    await dispatch(logout()).unwrap();
  }, [dispatch]);
  
  // Connection management
  const testAWSConnection = useCallback(async (): Promise<ConnectionStatus> => {
    return await dispatch(testConnection()).unwrap();
  }, [dispatch]);
  
  const refreshConnection = useCallback(async () => {
    await dispatch(testConnection()).unwrap();
  }, [dispatch]);
  
  // Profile management
  const loadAWSProfiles = useCallback(async () => {
    await dispatch(loadProfiles()).unwrap();
  }, [dispatch]);
  
  // SSO management
  const loadSSOAccountList = useCallback(async (startUrl: string, region: string) => {
    await dispatch(loadSSOAccounts({ startUrl, region })).unwrap();
  }, [dispatch]);
  
  const loadSSORoleList = useCallback(async (accountId: string) => {
    await dispatch(loadSSOAccountRoles(accountId)).unwrap();
  }, [dispatch]);
  
  const setupSSOCredentialsForRole = useCallback(async (config: SSOConfig) => {
    await dispatch(setupSSOCredentials(config)).unwrap();
  }, [dispatch]);
  
  // Error management
  const clearErrors = useCallback(() => {
    dispatch(clearAllErrors());
  }, [dispatch]);
  
  // State getter for backward compatibility
  const getAuthState = useCallback(() => {
    return authState;
  }, [authState]);
  
  const contextValue: AuthenticationContextValue = {
    authenticateSSO,
    authenticateProfile,
    authenticateRole,
    logoutUser,
    testAWSConnection,
    refreshConnection,
    loadAWSProfiles,
    loadSSOAccountList,
    loadSSORoleList,
    setupSSOCredentialsForRole,
    clearErrors,
    getAuthState
  };
  
  return (
    <AuthenticationContext.Provider value={contextValue}>
      {children}
    </AuthenticationContext.Provider>
  );
};