import { BrowserWindow, shell } from 'electron';
import { randomBytes, createHash } from 'crypto';
import { SSOOIDCClient, CreateTokenCommand, RegisterClientCommand } from '@aws-sdk/client-sso-oidc';
import { SSOClient, GetRoleCredentialsCommand, ListAccountRolesCommand } from '@aws-sdk/client-sso';
import { fromSSO } from '@aws-sdk/credential-providers';
import { CredentialProvider } from '@aws-sdk/types';

export interface SSOAuthConfig {
  startUrl: string;
  region: string;
  clientName?: string;
  scopes?: string[];
}

export interface SSOTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  clientId: string;
  clientSecret: string;
  deviceCode?: string;
}

export interface SSOAccount {
  accountId: string;
  accountName: string;
  emailAddress: string;
}

export interface SSORole {
  roleName: string;
  accountId: string;
}

export interface SSOAuthResult {
  success: boolean;
  tokens?: SSOTokens;
  accounts?: SSOAccount[];
  error?: string;
}

/**
 * AWS SSO Authentication Service with PKCE flow
 * Handles browser-based SSO login and token management
 */
export class SSOAuthService {
  private ssoOidcClient: SSOOIDCClient;
  private ssoClient: SSOClient;
  private currentTokens: SSOTokens | null = null;
  private authWindow: BrowserWindow | null = null;

  constructor(private config: SSOAuthConfig) {
    this.ssoOidcClient = new SSOOIDCClient({ region: config.region });
    this.ssoClient = new SSOClient({ region: config.region });
  }

  /**
   * Start the SSO authentication flow with PKCE
   */
  async authenticate(): Promise<SSOAuthResult> {
    try {
      // Step 1: Register client with AWS SSO
      const clientRegistration = await this.registerClient();
      
      // Step 2: Generate PKCE parameters
      const pkceParams = this.generatePKCEParams();
      
      // Step 3: Start device authorization flow
      const deviceAuth = await this.startDeviceAuthorization(
        clientRegistration.clientId!,
        clientRegistration.clientSecret!,
        pkceParams
      );
      
      // Step 4: Open browser for user authentication
      await this.openAuthorizationBrowser(deviceAuth.verificationUriComplete!);
      
      // Step 5: Poll for token
      const tokens = await this.pollForToken(
        clientRegistration.clientId!,
        clientRegistration.clientSecret!,
        deviceAuth.deviceCode!,
        deviceAuth.interval || 5
      );
      
      // Step 6: Store tokens and get account information
      this.currentTokens = {
        accessToken: tokens.accessToken!,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + (tokens.expiresIn! * 1000)),
        clientId: clientRegistration.clientId!,
        clientSecret: clientRegistration.clientSecret!,
        deviceCode: deviceAuth.deviceCode
      };
      
      return {
        success: true,
        tokens: this.currentTokens
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SSO authentication failed'
      };
    }
  }

  /**
   * Register OAuth client with AWS SSO
   */
  private async registerClient() {
    const command = new RegisterClientCommand({
      clientName: this.config.clientName || 'AWS Network Flow Visualizer',
      clientType: 'public',
      scopes: this.config.scopes || ['sso:account:access']
    });
    
    return await this.ssoOidcClient.send(command);
  }

  /**
   * Generate PKCE code verifier and challenge
   */
  private generatePKCEParams() {
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    
    return {
      codeVerifier,
      codeChallenge,
      codeChallengeMethod: 'S256'
    };
  }

  /**
   * Start device authorization flow
   */
  private async startDeviceAuthorization(
    clientId: string,
    clientSecret: string,
    pkceParams: { codeChallenge: string; codeChallengeMethod: string }
  ) {
    const { StartDeviceAuthorizationCommand } = await import('@aws-sdk/client-sso-oidc');
    
    const command = new StartDeviceAuthorizationCommand({
      clientId,
      clientSecret,
      startUrl: this.config.startUrl
    });
    
    return await this.ssoOidcClient.send(command);
  }

  /**
   * Open browser window for user authentication
   */
  private async openAuthorizationBrowser(verificationUri: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Create a new browser window for authentication
      this.authWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        },
        title: 'AWS SSO Authentication'
      });

      // Load the verification URI
      this.authWindow.loadURL(verificationUri);

      // Handle window closed
      this.authWindow.on('closed', () => {
        this.authWindow = null;
        resolve();
      });

      // Handle navigation to detect completion
      this.authWindow.webContents.on('did-navigate', (event, navigationUrl) => {
        // Check if we've been redirected to a completion page
        if (navigationUrl.includes('success') || navigationUrl.includes('complete')) {
          this.closeAuthWindow();
          resolve();
        }
      });

      // Handle any errors
      this.authWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        reject(new Error(`Failed to load authentication page: ${errorDescription}`));
      });
    });
  }

  /**
   * Poll for authentication token
   */
  private async pollForToken(
    clientId: string,
    clientSecret: string,
    deviceCode: string,
    interval: number
  ): Promise<any> {
    const maxAttempts = 60; // 5 minutes with 5-second intervals
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const command = new CreateTokenCommand({
          clientId,
          clientSecret,
          grantType: 'urn:ietf:params:oauth:grant-type:device_code',
          deviceCode
        });

        const response = await this.ssoOidcClient.send(command);
        
        // Success - we got the token
        this.closeAuthWindow();
        return response;
        
      } catch (error: any) {
        if (error.name === 'AuthorizationPendingException') {
          // User hasn't completed authentication yet, continue polling
          await this.sleep(interval * 1000);
          attempts++;
          continue;
        } else if (error.name === 'SlowDownException') {
          // Slow down polling
          await this.sleep((interval + 5) * 1000);
          attempts++;
          continue;
        } else if (error.name === 'ExpiredTokenException') {
          throw new Error('Authentication session expired. Please try again.');
        } else {
          throw error;
        }
      }
    }

    throw new Error('Authentication timeout. Please try again.');
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(): Promise<SSOAuthResult> {
    if (!this.currentTokens?.refreshToken) {
      return {
        success: false,
        error: 'No refresh token available'
      };
    }

    try {
      const command = new CreateTokenCommand({
        clientId: this.currentTokens.clientId,
        clientSecret: this.currentTokens.clientSecret,
        grantType: 'refresh_token',
        refreshToken: this.currentTokens.refreshToken
      });

      const response = await this.ssoOidcClient.send(command);
      
      this.currentTokens = {
        ...this.currentTokens,
        accessToken: response.accessToken!,
        refreshToken: response.refreshToken || this.currentTokens.refreshToken,
        expiresAt: new Date(Date.now() + (response.expiresIn! * 1000))
      };

      return {
        success: true,
        tokens: this.currentTokens
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token refresh failed'
      };
    }
  }

  /**
   * Get available accounts for the authenticated user
   */
  async getAccounts(): Promise<SSOAccount[]> {
    if (!this.currentTokens) {
      throw new Error('Not authenticated');
    }

    const { ListAccountsCommand } = await import('@aws-sdk/client-sso');
    
    const command = new ListAccountsCommand({
      accessToken: this.currentTokens.accessToken
    });

    const response = await this.ssoClient.send(command);
    
    return (response.accountList || []).map(account => ({
      accountId: account.accountId!,
      accountName: account.accountName!,
      emailAddress: account.emailAddress!
    }));
  }

  /**
   * Get available roles for an account
   */
  async getRolesForAccount(accountId: string): Promise<SSORole[]> {
    if (!this.currentTokens) {
      throw new Error('Not authenticated');
    }

    const command = new ListAccountRolesCommand({
      accessToken: this.currentTokens.accessToken,
      accountId
    });

    const response = await this.ssoClient.send(command);
    
    return (response.roleList || []).map(role => ({
      roleName: role.roleName!,
      accountId
    }));
  }

  /**
   * Create credential provider for a specific account and role
   */
  createCredentialProvider(accountId: string, roleName: string): CredentialProvider {
    if (!this.currentTokens) {
      throw new Error('Not authenticated');
    }

    return fromSSO({
      ssoStartUrl: this.config.startUrl,
      ssoRegion: this.config.region,
      ssoAccountId: accountId,
      ssoRoleName: roleName
    } as any);
  }

  /**
   * Check if current tokens are expired or about to expire
   */
  isTokenExpired(): boolean {
    if (!this.currentTokens) {
      return true;
    }

    const now = new Date();
    const expirationBuffer = 5 * 60 * 1000; // 5 minutes buffer
    return this.currentTokens.expiresAt.getTime() - now.getTime() < expirationBuffer;
  }

  /**
   * Get current tokens
   */
  getCurrentTokens(): SSOTokens | null {
    return this.currentTokens;
  }

  /**
   * Clear stored tokens and logout
   */
  logout(): void {
    this.currentTokens = null;
    this.closeAuthWindow();
  }

  /**
   * Close authentication window
   */
  private closeAuthWindow(): void {
    if (this.authWindow && !this.authWindow.isDestroyed()) {
      this.authWindow.close();
      this.authWindow = null;
    }
  }

  /**
   * Sleep utility function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}