import { useState, useEffect, useCallback } from 'react';
import { SSOConfig } from '../../shared/types';

export interface SSOAccount {
  accountId: string;
  accountName: string;
  emailAddress: string;
}

export interface SSORole {
  roleName: string;
  accountId: string;
}

export interface SSOState {
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  isLoadingAccounts: boolean;
  isLoadingRoles: boolean;
  isSelectingRole: boolean;
  authError?: string;
  accountError?: string;
  roleError?: string;
  currentConfig?: SSOConfig;
  accounts: SSOAccount[];
  roles: SSORole[];
  selectedAccount?: string;
  selectedRole?: string;
}

export interface SSOActions {
  authenticate: (config: SSOConfig) => Promise<void>;
  logout: () => Promise<void>;
  loadAccounts: (startUrl: string, region: string) => Promise<void>;
  loadRoles: (accountId: string) => Promise<void>;
  selectAccountAndRole: (accountId: string, roleName: string, config: SSOConfig) => Promise<void>;
  refreshTokens: (startUrl: string, region: string) => Promise<void>;
  checkStatus: () => Promise<void>;
}

export function useSSO(): [SSOState, SSOActions] {
  const [state, setState] = useState<SSOState>({
    isAuthenticated: false,
    isAuthenticating: false,
    isLoadingAccounts: false,
    isLoadingRoles: false,
    isSelectingRole: false,
    accounts: [],
    roles: [],
  });

  // Initialize SSO and check status on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        await window.electronAPI.sso.initialize();
        await checkStatus();
      } catch (error) {
        console.error('Failed to initialize SSO:', error);
      }
    };

    initialize();
  }, []);

  const authenticate = useCallback(async (config: SSOConfig) => {
    setState(prev => ({ 
      ...prev, 
      isAuthenticating: true, 
      authError: undefined,
      accounts: [],
      roles: [],
      selectedAccount: undefined,
      selectedRole: undefined
    }));

    try {
      const result = await window.electronAPI.sso.authenticate(config);
      
      if (result.success) {
        setState(prev => ({ 
          ...prev, 
          isAuthenticated: true,
          currentConfig: config
        }));
        
        // Load accounts after successful authentication
        await loadAccounts(config.startUrl, config.region);
      } else {
        setState(prev => ({ 
          ...prev, 
          authError: result.error || 'Authentication failed'
        }));
      }
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        authError: error instanceof Error ? error.message : 'Authentication failed'
      }));
    } finally {
      setState(prev => ({ ...prev, isAuthenticating: false }));
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await window.electronAPI.sso.logout();
      setState({
        isAuthenticated: false,
        isAuthenticating: false,
        isLoadingAccounts: false,
        isLoadingRoles: false,
        isSelectingRole: false,
        accounts: [],
        roles: [],
      });
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, []);

  const loadAccounts = useCallback(async (startUrl: string, region: string) => {
    setState(prev => ({ 
      ...prev, 
      isLoadingAccounts: true, 
      accountError: undefined,
      accounts: [],
      roles: [],
      selectedAccount: undefined,
      selectedRole: undefined
    }));

    try {
      const accounts = await window.electronAPI.sso.getAccounts(startUrl, region);
      setState(prev => ({ 
        ...prev, 
        accounts,
        isLoadingAccounts: false
      }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        accountError: error instanceof Error ? error.message : 'Failed to load accounts',
        isLoadingAccounts: false
      }));
    }
  }, []);

  const loadRoles = useCallback(async (accountId: string) => {
    setState(prev => ({ 
      ...prev, 
      isLoadingRoles: true, 
      roleError: undefined,
      roles: [],
      selectedRole: undefined
    }));

    try {
      const roles = await window.electronAPI.sso.getAccountRoles(accountId);
      setState(prev => ({ 
        ...prev, 
        roles,
        selectedAccount: accountId,
        isLoadingRoles: false
      }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        roleError: error instanceof Error ? error.message : 'Failed to load roles',
        isLoadingRoles: false
      }));
    }
  }, []);

  const selectAccountAndRole = useCallback(async (accountId: string, roleName: string, config: SSOConfig) => {
    setState(prev => ({ ...prev, isSelectingRole: true, roleError: undefined }));

    try {
      const fullConfig: SSOConfig = {
        ...config,
        accountId,
        roleName
      };

      const result = await window.electronAPI.sso.setupCredentials(fullConfig);
      
      if (result.success) {
        setState(prev => ({ 
          ...prev, 
          selectedRole: roleName,
          currentConfig: fullConfig,
          isSelectingRole: false
        }));
      } else {
        setState(prev => ({ 
          ...prev, 
          roleError: result.error || 'Failed to setup credentials',
          isSelectingRole: false
        }));
      }
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        roleError: error instanceof Error ? error.message : 'Failed to setup credentials',
        isSelectingRole: false
      }));
    }
  }, []);

  const refreshTokens = useCallback(async (startUrl: string, region: string) => {
    try {
      const result = await window.electronAPI.sso.refreshTokens(startUrl, region);
      
      if (!result.success) {
        setState(prev => ({ 
          ...prev, 
          authError: result.error || 'Token refresh failed'
        }));
      }
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        authError: error instanceof Error ? error.message : 'Token refresh failed'
      }));
    }
  }, []);

  const checkStatus = useCallback(async () => {
    try {
      const status = await window.electronAPI.sso.getStatus();
      setState(prev => ({ 
        ...prev, 
        isAuthenticated: status.isAuthenticated,
        currentConfig: status.config
      }));
    } catch (error) {
      console.error('Failed to check SSO status:', error);
    }
  }, []);

  const actions: SSOActions = {
    authenticate,
    logout,
    loadAccounts,
    loadRoles,
    selectAccountAndRole,
    refreshTokens,
    checkStatus
  };

  return [state, actions];
}