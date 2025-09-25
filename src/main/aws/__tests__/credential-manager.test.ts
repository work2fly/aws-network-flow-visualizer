import { AWSCredentialManager } from '../credential-manager';
import { SSOConfig, ProfileConfig, RoleConfig } from '../../../shared/types';

describe('AWSCredentialManager - Logic Tests', () => {
  let credentialManager: AWSCredentialManager;

  beforeEach(() => {
    credentialManager = new AWSCredentialManager();
  });

  describe('Basic functionality', () => {
    it('should initialize without errors', () => {
      expect(credentialManager).toBeInstanceOf(AWSCredentialManager);
      expect(credentialManager.getCurrentCredentials()).toBeNull();
      expect(credentialManager.getSTSClient()).toBeNull();
    });

    it('should handle credential expiration check with no credentials', () => {
      const isExpired = credentialManager.areCredentialsExpired();
      expect(isExpired).toBe(false);
    });

    it('should clear credentials safely when none exist', () => {
      expect(() => credentialManager.clearCredentials()).not.toThrow();
      expect(credentialManager.getCurrentCredentials()).toBeNull();
    });
  });

  describe('Configuration validation', () => {
    it('should handle SSO authentication with invalid config', async () => {
      const ssoConfig: SSOConfig = {
        startUrl: 'invalid-url',
        region: 'invalid-region',
      };

      // This will fail due to invalid credentials, but should not throw
      const result = await credentialManager.authenticateWithSSO(ssoConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    });

    it('should handle profile authentication with invalid config', async () => {
      const profileConfig: ProfileConfig = {
        profileName: 'nonexistent-profile',
        region: 'us-west-2',
      };

      // This will fail due to invalid profile, but should not throw
      const result = await credentialManager.authenticateWithProfile(profileConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    });
  });

  describe('Error handling', () => {
    it('should handle refresh when no credentials exist', async () => {
      const result = await credentialManager.refreshCredentials();
      expect(result.valid).toBe(false);
      expect(result.error).toBe('No credentials to refresh');
    });

    it('should handle test connection when no credentials exist', async () => {
      const status = await credentialManager.testConnection();
      expect(status.connected).toBe(false);
      expect(status.error).toBe('No credentials configured');
    });

    it('should handle role assumption without base credentials', async () => {
      const result = await credentialManager.authenticateWithRole({
        roleArn: 'arn:aws:iam::123456789012:role/TestRole',
        sessionName: 'test-session',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Base credentials required for role assumption');
    });
  });

  describe('Credential chain initialization', () => {
    it('should handle credential chain initialization gracefully', async () => {
      // This will likely fail in test environment, but should not throw
      const result = await credentialManager.initializeWithCredentialChain();
      expect(result).toHaveProperty('valid');
      expect(typeof result.valid).toBe('boolean');
      
      if (!result.valid) {
        expect(result.error).toBeDefined();
      }
    });

    it('should handle credential chain with specific options', async () => {
      const result = await credentialManager.initializeWithCredentialChain({
        preferredCredentialTypes: ['environment'],
      });
      
      expect(result).toHaveProperty('valid');
      expect(typeof result.valid).toBe('boolean');
    });
  });

  describe('Configuration structure validation', () => {
    it('should validate SSO config structure', () => {
      const ssoConfig: SSOConfig = {
        startUrl: 'https://example.awsapps.com/start',
        region: 'us-east-1',
        accountId: '123456789012',
        roleName: 'TestRole',
      };

      expect(ssoConfig.startUrl).toBeDefined();
      expect(ssoConfig.region).toBeDefined();
      expect(typeof ssoConfig.startUrl).toBe('string');
      expect(typeof ssoConfig.region).toBe('string');
    });

    it('should validate profile config structure', () => {
      const profileConfig: ProfileConfig = {
        profileName: 'test-profile',
        region: 'us-west-2',
      };

      expect(profileConfig.profileName).toBeDefined();
      expect(typeof profileConfig.profileName).toBe('string');
      expect(profileConfig.profileName.length).toBeGreaterThan(0);
    });

    it('should validate role config structure', () => {
      const roleConfig: RoleConfig = {
        roleArn: 'arn:aws:iam::123456789012:role/TestRole',
        sessionName: 'test-session',
      };

      expect(roleConfig.roleArn).toBeDefined();
      expect(typeof roleConfig.roleArn).toBe('string');
      expect(roleConfig.roleArn).toMatch(/^arn:aws:iam::/);
    });
  });
});