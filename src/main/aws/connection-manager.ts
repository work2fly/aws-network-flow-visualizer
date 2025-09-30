import { AWSCredentialManager } from './credential-manager';
import { AWSProfileReader } from './profile-reader';
import {
  ConnectionStatus,
  SSOConfig,
  ProfileConfig,
  RoleConfig,
  CredentialValidationResult,
  AWSProfile,
  AWSCredentials,
} from '../../shared/types';

export interface AWSConnectionManagerInterface {
  authenticateWithSSO(ssoConfig: SSOConfig): Promise<boolean>;
  authenticateWithProfile(profileName: string): Promise<boolean>;
  authenticateWithRole(roleArn: string): Promise<boolean>;
  testConnection(): Promise<ConnectionStatus>;
  getAvailableProfiles(): Promise<string[]>;
  getAvailableRegions(): Promise<string[]>;
  refreshCredentials(): Promise<boolean>;
}

export class AWSConnectionManager implements AWSConnectionManagerInterface {
  private credentialManager: AWSCredentialManager;
  private profileReader: AWSProfileReader;

  constructor() {
    this.credentialManager = new AWSCredentialManager();
    this.profileReader = new AWSProfileReader();
  }

  /**
   * Authenticate using AWS SSO
   */
  async authenticateWithSSO(ssoConfig: SSOConfig): Promise<boolean> {
    try {
      const result = await this.credentialManager.authenticateWithSSO(ssoConfig);
      return result.valid;
    } catch (error) {
      console.error('SSO authentication failed:', error);
      return false;
    }
  }

  /**
   * Authenticate using AWS CLI profile
   */
  async authenticateWithProfile(profileName: string): Promise<boolean> {
    try {
      // Validate profile exists and is properly configured
      const profileValidation = await this.profileReader.validateProfile(profileName);
      if (!profileValidation.valid) {
        console.error('Profile validation failed:', profileValidation.error);
        return false;
      }

      // Get profile details
      const profile = await this.profileReader.getProfile(profileName);
      if (!profile) {
        console.error(`Profile '${profileName}' not found`);
        return false;
      }

      const profileConfig: ProfileConfig = {
        profileName,
        region: profile.region,
      };

      const result = await this.credentialManager.authenticateWithProfile(profileConfig);
      return result.valid;
    } catch (error) {
      console.error('Profile authentication failed:', error);
      return false;
    }
  }

  /**
   * Authenticate using IAM role assumption
   */
  async authenticateWithRole(roleArn: string, sessionName?: string): Promise<boolean> {
    try {
      const roleConfig: RoleConfig = {
        roleArn,
        sessionName: sessionName || 'aws-network-flow-visualizer',
      };

      const result = await this.credentialManager.authenticateWithRole(roleConfig);
      return result.valid;
    } catch (error) {
      console.error('Role authentication failed:', error);
      return false;
    }
  }

  /**
   * Test current AWS connection
   */
  async testConnection(): Promise<ConnectionStatus> {
    return await this.credentialManager.testConnection();
  }

  /**
   * Get list of available AWS profiles
   */
  async getAvailableProfiles(): Promise<string[]> {
    try {
      const profiles = await this.profileReader.getAvailableProfiles();
      return profiles.map(profile => profile.name);
    } catch (error) {
      console.error('Failed to get available profiles:', error);
      return [];
    }
  }

  /**
   * Get detailed profile information
   */
  async getProfileDetails(): Promise<AWSProfile[]> {
    try {
      return await this.profileReader.getAvailableProfiles();
    } catch (error) {
      console.error('Failed to get profile details:', error);
      return [];
    }
  }

  /**
   * Get list of available AWS regions
   */
  async getAvailableRegions(): Promise<string[]> {
    return this.profileReader.getAvailableRegions();
  }

  /**
   * Refresh current credentials
   */
  async refreshCredentials(): Promise<boolean> {
    try {
      const result = await this.credentialManager.refreshCredentials();
      return result.valid;
    } catch (error) {
      console.error('Failed to refresh credentials:', error);
      return false;
    }
  }

  /**
   * Initialize with automatic credential discovery
   */
  async initializeWithAutoDiscovery(): Promise<CredentialValidationResult> {
    try {
      // Try to initialize with credential chain
      const result = await this.credentialManager.initializeWithCredentialChain({
        preferredCredentialTypes: ['sso', 'profile', 'environment', 'instance'],
      });

      if (result.valid) {
        console.log('Successfully initialized AWS credentials via credential chain');
      } else {
        console.warn('Failed to initialize AWS credentials:', result.error);
      }

      return result;
    } catch (error) {
      console.error('Auto-discovery initialization failed:', error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error during initialization',
      };
    }
  }

  /**
   * Get current credentials information
   */
  getCurrentCredentials(): AWSCredentials | null {
    return this.credentialManager.getCurrentCredentials();
  }

  /**
   * Check if current credentials are expired
   */
  areCredentialsExpired(): boolean {
    return this.credentialManager.areCredentialsExpired();
  }

  /**
   * Clear current credentials
   */
  clearCredentials(): void {
    this.credentialManager.clearCredentials();
  }

  /**
   * Check if AWS CLI configuration exists
   */
  hasAWSConfig(): boolean {
    return this.profileReader.hasAWSConfig();
  }

  /**
   * Validate a specific profile
   */
  async validateProfile(profileName: string): Promise<{ valid: boolean; error?: string }> {
    return await this.profileReader.validateProfile(profileName);
  }

  /**
   * Get STS client for making AWS API calls
   */
  getSTSClient() {
    return this.credentialManager.getSTSClient();
  }

  /**
   * Initialize with specific SSO configuration
   */
  async initializeWithSSO(ssoConfig: SSOConfig): Promise<CredentialValidationResult> {
    return await this.credentialManager.authenticateWithSSO(ssoConfig);
  }

  /**
   * Initialize with specific profile
   */
  async initializeWithProfile(profileName: string, region?: string): Promise<CredentialValidationResult> {
    const profileConfig: ProfileConfig = {
      profileName,
      region,
    };
    return await this.credentialManager.authenticateWithProfile(profileConfig);
  }

  /**
   * Initialize with role assumption
   */
  async initializeWithRole(roleArn: string, sessionName?: string, region?: string): Promise<CredentialValidationResult> {
    const roleConfig: RoleConfig = {
      roleArn,
      sessionName: sessionName || 'aws-network-flow-visualizer',
      region,
    };
    return await this.credentialManager.authenticateWithRole(roleConfig);
  }

  /**
   * Get the credential manager instance
   */
  getCredentialManager(): AWSCredentialManager {
    return this.credentialManager;
  }
}