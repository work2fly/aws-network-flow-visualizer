import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { 
  ConnectionStatus, 
  SSOConfig, 
  AWSProfile, 
  RoleConfig,
  CredentialType,
  CredentialValidationResult 
} from '@shared/types';

// Async thunks for authentication actions
export const authenticateWithSSO = createAsyncThunk(
  'auth/authenticateWithSSO',
  async (config: SSOConfig) => {
    const result = await window.electronAPI.sso.authenticate(config);
    if (!result.success) {
      throw new Error(result.error || 'SSO authentication failed');
    }
    return { config, result };
  }
);

export const authenticateWithProfile = createAsyncThunk(
  'auth/authenticateWithProfile',
  async ({ profileName, region }: { profileName: string; region?: string }) => {
    const result = await window.electronAPI.aws.authenticateWithProfile(profileName, region);
    if (!result.success) {
      throw new Error(result.error || 'Profile authentication failed');
    }
    return { profileName, region, result };
  }
);

export const authenticateWithRole = createAsyncThunk(
  'auth/authenticateWithRole',
  async (roleConfig: RoleConfig) => {
    const result = await window.electronAPI.aws.authenticateWithRole(roleConfig);
    if (!result.success) {
      throw new Error(result.error || 'Role authentication failed');
    }
    return { roleConfig, result };
  }
);

export const testConnection = createAsyncThunk(
  'auth/testConnection',
  async () => {
    return await window.electronAPI.aws.testConnection();
  }
);

export const loadProfiles = createAsyncThunk(
  'auth/loadProfiles',
  async () => {
    return await window.electronAPI.aws.getProfiles();
  }
);

export const loadSSOAccounts = createAsyncThunk(
  'auth/loadSSOAccounts',
  async ({ startUrl, region }: { startUrl: string; region: string }) => {
    return await window.electronAPI.sso.getAccounts(startUrl, region);
  }
);

export const loadSSOAccountRoles = createAsyncThunk(
  'auth/loadSSOAccountRoles',
  async (accountId: string) => {
    return await window.electronAPI.sso.getAccountRoles(accountId);
  }
);

export const setupSSOCredentials = createAsyncThunk(
  'auth/setupSSOCredentials',
  async (config: SSOConfig) => {
    const result = await window.electronAPI.sso.setupCredentials(config);
    if (!result.success) {
      throw new Error(result.error || 'Failed to setup SSO credentials');
    }
    return { config, result };
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async () => {
    await window.electronAPI.sso.logout();
    await window.electronAPI.aws.clearCredentials();
  }
);

// SSO Account and Role interfaces
export interface SSOAccount {
  accountId: string;
  accountName: string;
  emailAddress: string;
}

export interface SSORole {
  roleName: string;
  accountId: string;
}

// Auth state interface
export interface AuthState {
  // Connection status
  connectionStatus: ConnectionStatus;
  
  // Authentication state
  isAuthenticated: boolean;
  credentialType?: CredentialType;
  currentProfile?: string;
  currentSSOConfig?: SSOConfig;
  currentRoleConfig?: RoleConfig;
  
  // Loading states
  isAuthenticating: boolean;
  isLoadingProfiles: boolean;
  isLoadingSSOAccounts: boolean;
  isLoadingSSORoles: boolean;
  isTestingConnection: boolean;
  
  // Data
  profiles: AWSProfile[];
  ssoAccounts: SSOAccount[];
  ssoRoles: SSORole[];
  selectedSSOAccount?: string;
  selectedSSORole?: string;
  
  // Error states
  authError?: string;
  profileError?: string;
  ssoError?: string;
  connectionError?: string;
  
  // Timestamps
  lastAuthenticated?: string;
  lastConnectionTest?: string;
  credentialExpiration?: string;
}

const initialState: AuthState = {
  connectionStatus: {
    connected: false,
    error: 'Not connected to AWS'
  },
  isAuthenticated: false,
  isAuthenticating: false,
  isLoadingProfiles: false,
  isLoadingSSOAccounts: false,
  isLoadingSSORoles: false,
  isTestingConnection: false,
  profiles: [],
  ssoAccounts: [],
  ssoRoles: []
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearAuthError: (state) => {
      state.authError = undefined;
    },
    clearProfileError: (state) => {
      state.profileError = undefined;
    },
    clearSSOError: (state) => {
      state.ssoError = undefined;
    },
    clearConnectionError: (state) => {
      state.connectionError = undefined;
    },
    clearAllErrors: (state) => {
      state.authError = undefined;
      state.profileError = undefined;
      state.ssoError = undefined;
      state.connectionError = undefined;
    },
    setSelectedSSOAccount: (state, action: PayloadAction<string>) => {
      state.selectedSSOAccount = action.payload;
      state.selectedSSORole = undefined; // Clear role when account changes
      state.ssoRoles = []; // Clear roles when account changes
    },
    setSelectedSSORole: (state, action: PayloadAction<string>) => {
      state.selectedSSORole = action.payload;
    },
    updateConnectionStatus: (state, action: PayloadAction<ConnectionStatus>) => {
      state.connectionStatus = action.payload;
      state.lastConnectionTest = new Date().toISOString();
    }
  },
  extraReducers: (builder) => {
    // SSO Authentication
    builder
      .addCase(authenticateWithSSO.pending, (state) => {
        state.isAuthenticating = true;
        state.authError = undefined;
        state.ssoError = undefined;
      })
      .addCase(authenticateWithSSO.fulfilled, (state, action) => {
        state.isAuthenticating = false;
        state.isAuthenticated = true;
        state.credentialType = 'sso';
        state.currentSSOConfig = action.payload.config;
        state.lastAuthenticated = new Date().toISOString();
        state.authError = undefined;
        state.ssoError = undefined;
      })
      .addCase(authenticateWithSSO.rejected, (state, action) => {
        state.isAuthenticating = false;
        state.isAuthenticated = false;
        state.ssoError = action.error.message || 'SSO authentication failed';
      });

    // Profile Authentication
    builder
      .addCase(authenticateWithProfile.pending, (state) => {
        state.isAuthenticating = true;
        state.authError = undefined;
        state.profileError = undefined;
      })
      .addCase(authenticateWithProfile.fulfilled, (state, action) => {
        state.isAuthenticating = false;
        state.isAuthenticated = true;
        state.credentialType = 'profile';
        state.currentProfile = action.payload.profileName;
        state.lastAuthenticated = new Date().toISOString();
        state.authError = undefined;
        state.profileError = undefined;
      })
      .addCase(authenticateWithProfile.rejected, (state, action) => {
        state.isAuthenticating = false;
        state.isAuthenticated = false;
        state.profileError = action.error.message || 'Profile authentication failed';
      });

    // Role Authentication
    builder
      .addCase(authenticateWithRole.pending, (state) => {
        state.isAuthenticating = true;
        state.authError = undefined;
      })
      .addCase(authenticateWithRole.fulfilled, (state, action) => {
        state.isAuthenticating = false;
        state.isAuthenticated = true;
        state.credentialType = 'role';
        state.currentRoleConfig = action.payload.roleConfig;
        state.lastAuthenticated = new Date().toISOString();
        state.authError = undefined;
      })
      .addCase(authenticateWithRole.rejected, (state, action) => {
        state.isAuthenticating = false;
        state.isAuthenticated = false;
        state.authError = action.error.message || 'Role authentication failed';
      });

    // Connection Testing
    builder
      .addCase(testConnection.pending, (state) => {
        state.isTestingConnection = true;
        state.connectionError = undefined;
      })
      .addCase(testConnection.fulfilled, (state, action) => {
        state.isTestingConnection = false;
        state.connectionStatus = action.payload;
        state.lastConnectionTest = new Date().toISOString();
        state.connectionError = undefined;
      })
      .addCase(testConnection.rejected, (state, action) => {
        state.isTestingConnection = false;
        state.connectionStatus = {
          connected: false,
          error: action.error.message || 'Connection test failed'
        };
        state.connectionError = action.error.message || 'Connection test failed';
      });

    // Load Profiles
    builder
      .addCase(loadProfiles.pending, (state) => {
        state.isLoadingProfiles = true;
        state.profileError = undefined;
      })
      .addCase(loadProfiles.fulfilled, (state, action) => {
        state.isLoadingProfiles = false;
        state.profiles = action.payload;
        state.profileError = undefined;
      })
      .addCase(loadProfiles.rejected, (state, action) => {
        state.isLoadingProfiles = false;
        state.profileError = action.error.message || 'Failed to load profiles';
      });

    // Load SSO Accounts
    builder
      .addCase(loadSSOAccounts.pending, (state) => {
        state.isLoadingSSOAccounts = true;
        state.ssoError = undefined;
        state.ssoAccounts = [];
        state.selectedSSOAccount = undefined;
        state.ssoRoles = [];
        state.selectedSSORole = undefined;
      })
      .addCase(loadSSOAccounts.fulfilled, (state, action) => {
        state.isLoadingSSOAccounts = false;
        state.ssoAccounts = action.payload;
        state.ssoError = undefined;
      })
      .addCase(loadSSOAccounts.rejected, (state, action) => {
        state.isLoadingSSOAccounts = false;
        state.ssoError = action.error.message || 'Failed to load SSO accounts';
      });

    // Load SSO Account Roles
    builder
      .addCase(loadSSOAccountRoles.pending, (state) => {
        state.isLoadingSSORoles = true;
        state.ssoError = undefined;
        state.ssoRoles = [];
        state.selectedSSORole = undefined;
      })
      .addCase(loadSSOAccountRoles.fulfilled, (state, action) => {
        state.isLoadingSSORoles = false;
        state.ssoRoles = action.payload;
        state.ssoError = undefined;
      })
      .addCase(loadSSOAccountRoles.rejected, (state, action) => {
        state.isLoadingSSORoles = false;
        state.ssoError = action.error.message || 'Failed to load SSO roles';
      });

    // Setup SSO Credentials
    builder
      .addCase(setupSSOCredentials.pending, (state) => {
        state.isAuthenticating = true;
        state.ssoError = undefined;
      })
      .addCase(setupSSOCredentials.fulfilled, (state, action) => {
        state.isAuthenticating = false;
        state.currentSSOConfig = action.payload.config;
        state.ssoError = undefined;
      })
      .addCase(setupSSOCredentials.rejected, (state, action) => {
        state.isAuthenticating = false;
        state.ssoError = action.error.message || 'Failed to setup SSO credentials';
      });

    // Logout
    builder
      .addCase(logout.pending, (state) => {
        state.isAuthenticating = true;
      })
      .addCase(logout.fulfilled, (state) => {
        // Reset to initial state but keep profiles
        const profiles = state.profiles;
        Object.assign(state, initialState);
        state.profiles = profiles;
      })
      .addCase(logout.rejected, (state, action) => {
        state.isAuthenticating = false;
        state.authError = action.error.message || 'Logout failed';
      });
  }
});

export const {
  clearAuthError,
  clearProfileError,
  clearSSOError,
  clearConnectionError,
  clearAllErrors,
  setSelectedSSOAccount,
  setSelectedSSORole,
  updateConnectionStatus
} = authSlice.actions;

export default authSlice.reducer;