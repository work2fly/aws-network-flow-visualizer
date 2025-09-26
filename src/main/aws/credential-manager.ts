import {
  STSClient,
  GetCallerIdentityCommand,
  AssumeRoleCommandInput,
} from '@aws-sdk/client-sts';
import {
  fromSSO,
  fromIni,
  fromEnv,
  fromInstanceMetadata,
  fromTemporaryCredentials,
} from '@aws-sdk/credential-providers';
import { CredentialProvider } from '@aws-sdk/types';
import {
  AWSCredentials,
  ConnectionStatus,
  CredentialType,
  SSOConfig,
  ProfileConfig,
  RoleConfig,
  CredentialValidationResult,
  CredentialChainOptions,
} from '../../shared/types';
import { SSOAuthService, SSOAuthConfig, SSOTokens } from './sso-auth';
import { SSOTokenStorage } from './sso-token-storage';
import { SecureCredentialStorage, SecureCredentialData } from './secure-credential-storage';

export class AWSCredentialManager {
  private currentCredentials: AWSCredentials | null = null;
  private currentCredentialProvider: CredentialProvider | null = null;
  private stsClient: STSClient | null = null;
  private ssoAuthService: SSOAuthService | null = null;
  private ssoTokenStorage: SSOTokenStorage;
  private secureStorage: SecureCredentialStorage;

  constructor() {
    this.ssoTokenStorage = new SSOTokenStorage();
    this.secureStorage = new SecureCredentialStorage();
  }

  /**
   * Initialize AWS SDK client with credential chain support
   */
  async initializeWithCredentialChain(
    options: CredentialChainOptions = {}
  ): Promise<CredentialValidationResult> {
    const { preferredCredentialTypes = ['sso', 'profile', 'environment', 'instance'] } = options;

    for (const credentialType of preferredCredentialTypes) {
      try {
        let provider: CredentialProvider;
        let region = 'us-east-1'; // Default region

        switch (credentialType) {
          case 'sso':
            if (!options.ssoConfig) continue;
            provider = fromSSO({
              profile: options.ssoConfig.sessionName,
            });
            region = options.ssoConfig.region;
            break;

          case 'profile':
            provider = fromIni({
              profile: options.profileConfig?.profileName,
            });
            region = options.profileConfig?.region || region;
            break;

          case 'environment':
            provider = fromEnv();
            region = process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION || region;
            break;

          case 'instance':
            provider = fromInstanceMetadata();
            break;

          case 'role':
            if (!options.roleConfig) continue;
            // Role assumption requires base credentials, so we'll handle this separately
            continue;

          default:
            continue;
        }

        const result = await this.validateCredentialProvider(provider, region, credentialType);
        if (result.valid) {
          this.currentCredentialProvider = provider;
          this.currentCredentials = {
            region,
            expiration: result.expiration,
          };
          this.stsClient = new STSClient({
            region,
            credentials: provider,
          });
          return result;
        }
      } catch (error) {
        console.warn(`Failed to initialize ${credentialType} credentials:`, error);
        continue;
      }
    }

    return {
      valid: false,
      error: 'No valid credentials found in credential chain',
    };
  }

  /**
   * Initialize SSO token storage and secure credential storage
   */
  async initializeSSO(): Promise<void> {
    await this.ssoTokenStorage.initialize();
    await this.secureStorage.initialize();
  }

  /**
   * Authenticate using AWS SSO with browser-based PKCE flow
   */
  async authenticateWithSSO(ssoConfig: SSOConfig): Promise<CredentialValidationResult> {
    try {
      // Initialize SSO token storage if not already done
      if (!(await this.ssoTokenStorage.isInitialized())) {
        await this.ssoTokenStorage.initialize();
      }

      // Check for existing valid session
      const existingSession = await this.ssoTokenStorage.getSession(ssoConfig.startUrl, ssoConfig.region);
      if (existingSession && !this.isTokenExpired(existingSession.tokens)) {
        // Use existing session
        return await this.setupSSOCredentials(ssoConfig, existingSession.tokens);
      }

      // Create new SSO auth service
      const authConfig: SSOAuthConfig = {
        startUrl: ssoConfig.startUrl,
        region: ssoConfig.region,
        clientName: 'AWS Network Flow Visualizer'
      };

      this.ssoAuthService = new SSOAuthService(authConfig);

      // Start authentication flow
      const authResult = await this.ssoAuthService.authenticate();
      
      if (!authResult.success || !authResult.tokens) {
        return {
          valid: false,
          error: authResult.error || 'SSO authentication failed'
        };
      }

      // Store tokens securely
      await this.ssoTokenStorage.storeSession(ssoConfig.startUrl, ssoConfig.region, authResult.tokens);

      // Setup credentials
      return await this.setupSSOCredentials(ssoConfig, authResult.tokens);

    } catch (error) {
      return {
        valid: false,
        error: `SSO authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Setup SSO credentials with account and role
   */
  async setupSSOCredentials(ssoConfig: SSOConfig, tokens: SSOTokens): Promise<CredentialValidationResult> {
    try {
      if (!ssoConfig.accountId || !ssoConfig.roleName) {
        return {
          valid: false,
          error: 'Account ID and role name are required for SSO credentials'
        };
      }

      const provider = fromSSO({
        ssoStartUrl: ssoConfig.startUrl,
        ssoRegion: ssoConfig.region,
        ssoAccountId: ssoConfig.accountId,
        ssoRoleName: ssoConfig.roleName
      } as any);

      const result = await this.validateCredentialProvider(provider, ssoConfig.region, 'sso');
      
      if (result.valid) {
        this.currentCredentialProvider = provider;
        this.currentCredentials = {
          region: ssoConfig.region,
          expiration: result.expiration,
        };
        this.setCredentialType('sso');
        this.stsClient = new STSClient({
          region: ssoConfig.region,
          credentials: provider,
        });
      }

      return result;
    } catch (error) {
      return {
        valid: false,
        error: `SSO credential setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get available SSO accounts
   */
  async getSSOAccounts(startUrl: string, region: string): Promise<Array<{accountId: string; accountName: string; emailAddress: string}>> {
    if (!this.ssoAuthService) {
      throw new Error('SSO not authenticated');
    }

    return await this.ssoAuthService.getAccounts();
  }

  /**
   * Get available roles for an SSO account
   */
  async getSSOAccountRoles(accountId: string): Promise<Array<{roleName: string; accountId: string}>> {
    if (!this.ssoAuthService) {
      throw new Error('SSO not authenticated');
    }

    return await this.ssoAuthService.getRolesForAccount(accountId);
  }

  /**
   * Refresh SSO tokens if needed
   */
  async refreshSSOTokens(startUrl: string, region: string): Promise<CredentialValidationResult> {
    try {
      if (!this.ssoAuthService) {
        return {
          valid: false,
          error: 'SSO not authenticated'
        };
      }

      const refreshResult = await this.ssoAuthService.refreshToken();
      
      if (!refreshResult.success || !refreshResult.tokens) {
        return {
          valid: false,
          error: refreshResult.error || 'Token refresh failed'
        };
      }

      // Update stored tokens
      await this.ssoTokenStorage.updateSession(startUrl, region, refreshResult.tokens);

      return {
        valid: true,
        credentialType: 'sso'
      };

    } catch (error) {
      return {
        valid: false,
        error: `SSO token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Logout from SSO
   */
  async logoutSSO(): Promise<void> {
    if (this.ssoAuthService) {
      this.ssoAuthService.logout();
      this.ssoAuthService = null;
    }
    
    // Clear stored sessions
    await this.ssoTokenStorage.clearAllSessions();
    
    // Clear current credentials if they were SSO-based
    if (this.getStoredCredentialType() === 'sso') {
      this.clearCredentials();
    }
  }

  /**
   * Check if SSO token is expired
   */
  private isTokenExpired(tokens: SSOTokens): boolean {
    const now = new Date();
    const expirationBuffer = 5 * 60 * 1000; // 5 minutes buffer
    return tokens.expiresAt.getTime() - now.getTime() < expirationBuffer;
  }

  /**
   * Authenticate using AWS CLI profile
   */
  async authenticateWithProfile(profileConfig: ProfileConfig): Promise<CredentialValidationResult> {
    try {
      const provider = fromIni({
        profile: profileConfig.profileName,
      });

      const region = profileConfig.region || 'us-east-1';
      const result = await this.validateCredentialProvider(provider, region, 'profile');
      
      if (result.valid) {
        this.currentCredentialProvider = provider;
        this.currentCredentials = {
          region,
          profile: profileConfig.profileName,
          expiration: result.expiration,
        };
        this.setCredentialType('profile');
        this.stsClient = new STSClient({
          region,
          credentials: provider,
        });
      }

      return result;
    } catch (error) {
      return {
        valid: false,
        error: `Profile authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Authenticate using IAM role assumption
   */
  async authenticateWithRole(roleConfig: RoleConfig): Promise<CredentialValidationResult> {
    try {
      if (!this.currentCredentialProvider) {
        return {
          valid: false,
          error: 'Base credentials required for role assumption',
        };
      }

      const assumeRoleParams: AssumeRoleCommandInput = {
        RoleArn: roleConfig.roleArn,
        RoleSessionName: roleConfig.sessionName || 'aws-network-flow-visualizer',
        ExternalId: roleConfig.externalId,
        DurationSeconds: roleConfig.durationSeconds || 3600, // Default 1 hour
      };

      const provider = fromTemporaryCredentials({
        params: assumeRoleParams,
        masterCredentials: this.currentCredentialProvider,
      });

      const region = roleConfig.region || this.currentCredentials?.region || 'us-east-1';
      const result = await this.validateCredentialProvider(provider, region, 'role');
      
      if (result.valid) {
        this.currentCredentialProvider = provider;
        this.currentCredentials = {
          region,
          expiration: result.expiration,
        };
        this.setCredentialType('role');
        this.stsClient = new STSClient({
          region,
          credentials: provider,
        });
      }

      return result;
    } catch (error) {
      return {
        valid: false,
        error: `Role assumption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Authenticate using profile with automatic role assumption if configured
   */
  async authenticateWithProfileAndRole(profileName: string, region?: string): Promise<CredentialValidationResult> {
    try {
      // First authenticate with the base profile
      const profileConfig: ProfileConfig = {
        profileName,
        region,
      };

      const baseResult = await this.authenticateWithProfile(profileConfig);
      if (!baseResult.valid) {
        return baseResult;
      }

      // Check if this profile has a role to assume
      const profileReader = new (await import('./profile-reader')).AWSProfileReader();
      const profile = await profileReader.getProfile(profileName);
      
      if (profile?.roleArn) {
        // This profile assumes a role, so assume it
        const roleConfig: RoleConfig = {
          roleArn: profile.roleArn,
          sessionName: `${profileName}-session`,
          region: region || profile.region,
        };

        return await this.authenticateWithRole(roleConfig);
      }

      return baseResult;
    } catch (error) {
      return {
        valid: false,
        error: `Profile with role authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Test current connection and validate credentials
   */
  async testConnection(): Promise<ConnectionStatus> {
    if (!this.stsClient || !this.currentCredentialProvider) {
      return {
        connected: false,
        error: 'No credentials configured',
      };
    }

    try {
      const command = new GetCallerIdentityCommand({});
      const response = await this.stsClient.send(command);

      return {
        connected: true,
        accountId: response.Account,
        region: this.currentCredentials?.region,
        lastChecked: new Date(),
        credentialType: this.getStoredCredentialType(),
      };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
        lastChecked: new Date(),
      };
    }
  }

  /**
   * Validate credential provider by testing STS call
   */
  private async validateCredentialProvider(
    provider: CredentialProvider,
    region: string,
    credentialType: CredentialType
  ): Promise<CredentialValidationResult> {
    try {
      // Try to get credential expiration if available first
      let expiration: Date | undefined;
      try {
        const credentials = await provider();
        if (credentials.expiration) {
          expiration = credentials.expiration;
        }
      } catch {
        // Expiration not available, continue without it
      }

      const testClient = new STSClient({
        region,
        credentials: provider,
      });

      const command = new GetCallerIdentityCommand({});
      const response = await testClient.send(command);

      return {
        valid: true,
        accountId: response.Account,
        region,
        expiration,
        credentialType,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Credential validation failed',
      };
    }
  }

  /**
   * Get current credential type
   */
  private getCredentialType(): CredentialType | undefined {
    // This is a simplified implementation - in practice, you might want to track this more explicitly
    if (this.currentCredentials?.profile) {
      return 'profile';
    }
    return 'environment'; // Default fallback
  }

  /**
   * Set credential type for tracking
   */
  private setCredentialType(credentialType: CredentialType): void {
    if (this.currentCredentials) {
      // Store credential type in a private property for tracking
      (this.currentCredentials as any)._credentialType = credentialType;
    }
  }

  /**
   * Get stored credential type
   */
  private getStoredCredentialType(): CredentialType | undefined {
    return (this.currentCredentials as any)?._credentialType;
  }

  /**
   * Get current credentials
   */
  getCurrentCredentials(): AWSCredentials | null {
    return this.currentCredentials;
  }

  /**
   * Get current STS client
   */
  getSTSClient(): STSClient | null {
    return this.stsClient;
  }

  /**
   * Check if credentials are expired or about to expire
   */
  areCredentialsExpired(): boolean {
    if (!this.currentCredentials?.expiration) {
      return false; // No expiration info available
    }

    const now = new Date();
    const expirationBuffer = 5 * 60 * 1000; // 5 minutes buffer
    return this.currentCredentials.expiration.getTime() - now.getTime() < expirationBuffer;
  }

  /**
   * Clear current credentials
   */
  clearCredentials(): void {
    this.currentCredentials = null;
    this.currentCredentialProvider = null;
    this.stsClient = null;
  }

  /**
   * Refresh credentials if possible
   */
  async refreshCredentials(): Promise<CredentialValidationResult> {
    if (!this.currentCredentialProvider || !this.currentCredentials) {
      return {
        valid: false,
        error: 'No credentials to refresh',
      };
    }

    try {
      // Force refresh by creating a new STS client
      this.stsClient = new STSClient({
        region: this.currentCredentials.region,
        credentials: this.currentCredentialProvider,
      });

      const connectionStatus = await this.testConnection();
      
      if (connectionStatus.connected) {
        return {
          valid: true,
          accountId: connectionStatus.accountId,
          region: connectionStatus.region,
          credentialType: this.getStoredCredentialType(),
        };
      } else {
        return {
          valid: false,
          error: connectionStatus.error,
        };
      }
    } catch (error) {
      return {
        valid: false,
        error: `Credential refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Store credentials securely in OS keychain
   */
  async storeCredentialsSecurely(accountKey: string, credentials: AWSCredentials, credentialType: CredentialType): Promise<void> {
    try {
      const secureData: SecureCredentialData = {
        region: credentials.region,
        profileName: credentials.profile,
        credentialType,
        createdAt: new Date(),
        lastUsed: new Date(),
        expiresAt: credentials.expiration
      };

      await this.secureStorage.storeCredentials(accountKey, secureData);
    } catch (error) {
      throw new Error(`Failed to store credentials securely: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load credentials securely from OS keychain
   */
  async loadCredentialsSecurely(accountKey: string): Promise<SecureCredentialData | null> {
    try {
      return await this.secureStorage.getCredentials(accountKey);
    } catch (error) {
      console.warn(`Failed to load secure credentials for ${accountKey}:`, error);
      return null;
    }
  }

  /**
   * List all securely stored credential accounts
   */
  async listSecureCredentialAccounts(): Promise<Array<{
    accountKey: string;
    credentialType: string;
    region?: string;
    profileName?: string;
    expiresAt?: Date;
    lastUsed: Date;
    isExpired: boolean;
  }>> {
    try {
      return await this.secureStorage.listCredentialAccounts();
    } catch (error) {
      console.warn('Failed to list secure credential accounts:', error);
      return [];
    }
  }

  /**
   * Delete securely stored credentials
   */
  async deleteSecureCredentials(accountKey: string): Promise<void> {
    try {
      await this.secureStorage.deleteCredentials(accountKey);
    } catch (error) {
      console.warn(`Failed to delete secure credentials for ${accountKey}:`, error);
    }
  }

  /**
   * Clean up expired credentials and perform secure memory cleanup
   */
  async performSecureCleanup(): Promise<void> {
    try {
      // Clean up expired credentials
      await this.secureStorage.cleanupExpiredCredentials();
      
      // Perform secure memory cleanup
      await this.secureStorage.performSecureCleanup();
      
      // Clear current credentials if expired
      if (this.areCredentialsExpired()) {
        this.clearCredentials();
      }
    } catch (error) {
      console.warn('Secure cleanup failed:', error);
    }
  }

  /**
   * Clear all stored credentials (for logout/reset)
   */
  async clearAllStoredCredentials(): Promise<void> {
    try {
      await this.secureStorage.clearAllCredentials();
      await this.ssoTokenStorage.clearAllSessions();
      this.clearCredentials();
    } catch (error) {
      throw new Error(`Failed to clear all stored credentials: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}