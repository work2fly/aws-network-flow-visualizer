import { SecureCredentialStorage, SecureCredentialData } from '../secure-credential-storage';
import { SSOTokens } from '../sso-auth';
import * as keytar from 'keytar';
import { promises as fs } from 'fs';
import { join } from 'path';

// Mock keytar
jest.mock('keytar');
const mockedKeytar = keytar as jest.Mocked<typeof keytar>;

// Mock fs
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    access: jest.fn(),
  },
}));

const mockedFs = fs as jest.Mocked<typeof fs>;

describe('SecureCredentialStorage', () => {
  let storage: SecureCredentialStorage;
  const testStorageDir = '/test/storage';

  beforeEach(() => {
    jest.clearAllMocks();
    storage = new SecureCredentialStorage({
      serviceName: 'test-service',
      storageDir: testStorageDir,
      encryptionKey: 'test-key-32-chars-long-for-aes256'
    });
  });

  afterEach(async () => {
    // Clean up any test data
    try {
      await storage.clearAllCredentials();
    } catch {
      // Ignore cleanup errors in tests
    }
  });

  describe('initialization', () => {
    it('should initialize storage directory and encryption key', async () => {
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.readFile.mockRejectedValue(new Error('File not found'));
      mockedFs.writeFile.mockResolvedValue(undefined);

      await storage.initialize();

      expect(mockedFs.mkdir).toHaveBeenCalledWith(testStorageDir, { recursive: true });
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        join(testStorageDir, 'storage.key'),
        expect.any(String),
        { mode: 0o600 }
      );
    });

    it('should load existing encryption key', async () => {
      const existingKey = 'existing-key-32-chars-long-for-test';
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.readFile.mockResolvedValue(existingKey);

      await storage.initialize();

      expect(mockedFs.readFile).toHaveBeenCalledWith(
        join(testStorageDir, 'storage.key'),
        'utf8'
      );
    });
  });

  describe('credential storage and retrieval', () => {
    const testAccountKey = 'test-account';
    const testCredentials: SecureCredentialData = {
      accessKeyId: 'AKIATEST123',
      secretAccessKey: 'secret123',
      sessionToken: 'session123',
      region: 'us-east-1',
      credentialType: 'sso',
      createdAt: new Date(),
      lastUsed: new Date(),
      expiresAt: new Date(Date.now() + 3600000) // 1 hour from now
    };

    beforeEach(async () => {
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.readFile.mockRejectedValue(new Error('File not found'));
      mockedFs.writeFile.mockResolvedValue(undefined);
      mockedKeytar.setPassword.mockResolvedValue();
      mockedKeytar.getPassword.mockResolvedValue(null);
      mockedKeytar.deletePassword.mockResolvedValue(true);

      await storage.initialize();
    });

    it('should store credentials securely', async () => {
      await storage.storeCredentials(testAccountKey, testCredentials);

      expect(mockedKeytar.setPassword).toHaveBeenCalledWith(
        'test-service',
        testAccountKey,
        expect.any(String) // Encrypted data
      );
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        join(testStorageDir, 'credential-metadata.json'),
        expect.any(String),
        { mode: 0o600 }
      );
    });

    it('should retrieve stored credentials', async () => {
      // Mock keychain return
      const mockEncryptedData = 'encrypted-sensitive-data';
      mockedKeytar.getPassword.mockResolvedValue(mockEncryptedData);
      
      // Mock metadata file
      const mockMetadata = {
        [testAccountKey]: {
          region: testCredentials.region,
          credentialType: testCredentials.credentialType,
          createdAt: testCredentials.createdAt.toISOString(),
          lastUsed: testCredentials.lastUsed.toISOString(),
          expiresAt: testCredentials.expiresAt?.toISOString()
        }
      };
      mockedFs.readFile.mockResolvedValue(JSON.stringify(mockMetadata));

      // Store first to set up encryption
      await storage.storeCredentials(testAccountKey, testCredentials);
      
      // Then retrieve
      const retrieved = await storage.getCredentials(testAccountKey);

      expect(retrieved).toBeTruthy();
      expect(retrieved?.region).toBe(testCredentials.region);
      expect(retrieved?.credentialType).toBe(testCredentials.credentialType);
    });

    it('should return null for non-existent credentials', async () => {
      mockedKeytar.getPassword.mockResolvedValue(null);

      const result = await storage.getCredentials('non-existent');

      expect(result).toBeNull();
    });

    it('should delete credentials', async () => {
      await storage.deleteCredentials(testAccountKey);

      expect(mockedKeytar.deletePassword).toHaveBeenCalledWith(
        'test-service',
        testAccountKey
      );
    });
  });

  describe('credential expiration handling', () => {
    const expiredCredentials: SecureCredentialData = {
      accessKeyId: 'AKIATEST123',
      secretAccessKey: 'secret123',
      region: 'us-east-1',
      credentialType: 'sso',
      createdAt: new Date(),
      lastUsed: new Date(),
      expiresAt: new Date(Date.now() - 3600000) // 1 hour ago (expired)
    };

    beforeEach(async () => {
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.readFile.mockRejectedValue(new Error('File not found'));
      mockedFs.writeFile.mockResolvedValue(undefined);
      mockedKeytar.setPassword.mockResolvedValue();
      mockedKeytar.getPassword.mockResolvedValue(null);
      mockedKeytar.deletePassword.mockResolvedValue(true);

      await storage.initialize();
    });

    it('should return null for expired credentials', async () => {
      const mockEncryptedData = 'encrypted-data';
      mockedKeytar.getPassword.mockResolvedValue(mockEncryptedData);
      
      const mockMetadata = {
        'expired-account': {
          region: expiredCredentials.region,
          credentialType: expiredCredentials.credentialType,
          createdAt: expiredCredentials.createdAt.toISOString(),
          lastUsed: expiredCredentials.lastUsed.toISOString(),
          expiresAt: expiredCredentials.expiresAt?.toISOString()
        }
      };
      mockedFs.readFile.mockResolvedValue(JSON.stringify(mockMetadata));

      const result = await storage.getCredentials('expired-account');

      expect(result).toBeNull();
      expect(mockedKeytar.deletePassword).toHaveBeenCalledWith(
        'test-service',
        'expired-account'
      );
    });

    it('should clean up expired credentials', async () => {
      const mockMetadata = {
        'valid-account': {
          region: 'us-east-1',
          credentialType: 'sso',
          createdAt: new Date().toISOString(),
          lastUsed: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3600000).toISOString() // Valid
        },
        'expired-account': {
          region: 'us-east-1',
          credentialType: 'sso',
          createdAt: new Date().toISOString(),
          lastUsed: new Date().toISOString(),
          expiresAt: new Date(Date.now() - 3600000).toISOString() // Expired
        }
      };
      mockedFs.readFile.mockResolvedValue(JSON.stringify(mockMetadata));

      const cleanedCount = await storage.cleanupExpiredCredentials();

      expect(cleanedCount).toBe(1);
      expect(mockedKeytar.deletePassword).toHaveBeenCalledWith(
        'test-service',
        'expired-account'
      );
    });
  });

  describe('SSO token storage', () => {
    const ssoTokens: SSOTokens = {
      accessToken: 'sso-access-token',
      refreshToken: 'sso-refresh-token',
      idToken: 'sso-id-token',
      expiresAt: new Date(Date.now() + 3600000)
    };

    const ssoCredentials: SecureCredentialData = {
      ssoTokens,
      region: 'us-east-1',
      credentialType: 'sso',
      createdAt: new Date(),
      lastUsed: new Date()
    };

    beforeEach(async () => {
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.readFile.mockRejectedValue(new Error('File not found'));
      mockedFs.writeFile.mockResolvedValue(undefined);
      mockedKeytar.setPassword.mockResolvedValue();
      mockedKeytar.getPassword.mockResolvedValue(null);

      await storage.initialize();
    });

    it('should store SSO tokens securely', async () => {
      await storage.storeCredentials('sso-account', ssoCredentials);

      expect(mockedKeytar.setPassword).toHaveBeenCalledWith(
        'test-service',
        'sso-account',
        expect.any(String)
      );
    });
  });

  describe('security features', () => {
    beforeEach(async () => {
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.readFile.mockRejectedValue(new Error('File not found'));
      mockedFs.writeFile.mockResolvedValue(undefined);

      await storage.initialize();
    });

    it('should perform secure cleanup', async () => {
      // This test verifies that the cleanup method runs without errors
      await expect(storage.performSecureCleanup()).resolves.not.toThrow();
    });

    it('should clear all credentials', async () => {
      mockedKeytar.getPassword.mockResolvedValue(null);
      mockedFs.readFile.mockResolvedValue('{}');

      await storage.clearAllCredentials();

      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        join(testStorageDir, 'credential-metadata.json'),
        expect.stringContaining('{}'),
        { mode: 0o600 }
      );
    });

    it('should check if storage is initialized', async () => {
      mockedFs.access.mockResolvedValue(undefined);

      const isInitialized = await storage.isInitialized();

      expect(isInitialized).toBe(true);
      expect(mockedFs.access).toHaveBeenCalledWith(
        join(testStorageDir, 'storage.key')
      );
    });
  });

  describe('error handling', () => {
    it('should handle keychain errors gracefully', async () => {
      mockedKeytar.getPassword.mockRejectedValue(new Error('Keychain error'));

      const result = await storage.getCredentials('test-account');

      expect(result).toBeNull();
    });

    it('should handle file system errors during initialization', async () => {
      mockedFs.mkdir.mockRejectedValue(new Error('Permission denied'));

      await expect(storage.initialize()).rejects.toThrow('Failed to initialize secure credential storage');
    });

    it('should handle encryption errors gracefully', async () => {
      // Create storage with invalid encryption key
      const invalidStorage = new SecureCredentialStorage({
        encryptionKey: 'too-short'
      });

      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue(undefined);

      await expect(invalidStorage.initialize()).resolves.not.toThrow();
    });
  });
});