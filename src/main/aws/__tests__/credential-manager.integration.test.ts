import { AWSCredentialManager } from '../credential-manager';
import { SSOConfig, ProfileConfig } from '../../../shared/types';

describe('AWSCredentialManager Integration Tests', () => {
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
  });

  describe('Configuration validation', () => {
    it('should validate SSO config structure', async () => {
      const ssoConfig: SSOConfig = {
        startUrl: 'https://example.awsapps.com/start',
        region: 'us-east-1',
        accountId: '123456789012',
        roleName: 'TestRole',
      };

      // This will fail due to invalid credentials, but should not throw
      const result = await credentialManager.authenticateWithSSO(ssoConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should validate profile config structure', async () => {
      const profileConfig: ProfileConfig = {
        profileName: 'nonexistent-profile',
        region: 'us-west-2',
      };

      // This will fail due to invalid profile, but should not throw
      const result = await credentialManager.authenticateWithProfile(profileConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
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

  describe('Error handling', () => {
    it('should handle invalid SSO configuration gracefully', async () => {
      const invalidSSOConfig: SSOConfig = {
        startUrl: 'invalid-url',
        region: 'invalid-region',
      };

      const result = await credentialManager.authenticateWithSSO(invalidSSOConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    });

    it('should handle invalid profile gracefully', async () => {
      const invalidProfileConfig: ProfileConfig = {
        profileName: '',
        region: 'us-east-1',
      };

      const result = await credentialManager.authenticateWithProfile(invalidProfileConfig);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
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
});