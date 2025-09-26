import * as keytar from 'keytar';
import { randomBytes, createCipherGCM, createDecipherGCM } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import { SSOTokens } from './sso-auth';

// Safe import of electron app for test environment compatibility
let electronApp: any = null;
try {
  electronApp = require('electron').app;
} catch {
  // Electron not available (test environment)
}

export interface SecureCredentialData {
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  ssoTokens?: SSOTokens;
  region?: string;
  profileName?: string;
  credentialType: 'sso' | 'profile' | 'role' | 'environment';
  expiresAt?: Date;
  createdAt: Date;
  lastUsed: Date;
}

export interface SecureStorageOptions {
  serviceName?: string;
  encryptionKey?: string;
  storageDir?: string;
}

/**
 * Secure credential storage using OS keychain and encrypted local storage
 * Implements secure memory handling and automatic cleanup
 */
export class SecureCredentialStorage {
  private readonly serviceName: string;
  private readonly storageDir: string;
  private encryptionKey: string;
  private readonly METADATA_FILE = 'credential-metadata.json';
  private readonly KEY_FILE = 'storage.key';
  private memoryCleanupHandlers: Array<() => void> = [];

  constructor(options: SecureStorageOptions = {}) {
    this.serviceName = options.serviceName || 'aws-network-flow-visualizer';
    
    if (options.storageDir) {
      this.storageDir = options.storageDir;
    } else if (electronApp) {
      this.storageDir = join(electronApp.getPath('userData'), 'secure-storage');
    } else {
      // Fallback for test environment
      this.storageDir = join(process.cwd(), '.test-secure-storage');
    }
    
    this.encryptionKey = options.encryptionKey || '';
    
    // Register cleanup handlers for application exit
    this.registerCleanupHandlers();
  }

  /**
   * Initialize secure storage
   */
  async initialize(): Promise<void> {
    try {
      // Ensure storage directory exists
      await fs.mkdir(this.storageDir, { recursive: true });
      
      // Initialize encryption key
      await this.initializeEncryptionKey();
      
      // Clean up any expired credentials on startup
      await this.cleanupExpiredCredentials();
    } catch (error) {
      throw new Error(`Failed to initialize secure credential storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store credentials securely in OS keychain
   */
  async storeCredentials(accountKey: string, credentials: SecureCredentialData): Promise<void> {
    try {
      // Store sensitive data in OS keychain
      const sensitiveData = {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken,
        ssoTokens: credentials.ssoTokens
      };

      // Encrypt sensitive data before storing in keychain
      const encryptedData = this.encryptSensitiveData(JSON.stringify(sensitiveData));
      await keytar.setPassword(this.serviceName, accountKey, encryptedData);

      // Store non-sensitive metadata in encrypted local file
      const metadata = {
        region: credentials.region,
        profileName: credentials.profileName,
        credentialType: credentials.credentialType,
        expiresAt: credentials.expiresAt,
        createdAt: credentials.createdAt,
        lastUsed: credentials.lastUsed
      };

      await this.storeMetadata(accountKey, metadata);

      // Register for secure memory cleanup
      this.registerMemoryCleanup(() => {
        this.secureMemoryWipe(sensitiveData);
      });

    } catch (error) {
      throw new Error(`Failed to store credentials: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve credentials from secure storage
   */
  async getCredentials(accountKey: string): Promise<SecureCredentialData | null> {
    try {
      // Get encrypted data from keychain
      const encryptedData = await keytar.getPassword(this.serviceName, accountKey);
      if (!encryptedData) {
        return null;
      }

      // Decrypt sensitive data
      const decryptedData = this.decryptSensitiveData(encryptedData);
      const sensitiveData = JSON.parse(decryptedData);

      // Get metadata from local storage
      const metadata = await this.getMetadata(accountKey);
      if (!metadata) {
        // Clean up orphaned keychain entry
        await keytar.deletePassword(this.serviceName, accountKey);
        return null;
      }

      // Check if credentials are expired
      if (metadata.expiresAt && new Date() > new Date(metadata.expiresAt)) {
        await this.deleteCredentials(accountKey);
        return null;
      }

      // Combine sensitive data and metadata
      const credentials: SecureCredentialData = {
        ...sensitiveData,
        ...metadata,
        expiresAt: metadata.expiresAt ? new Date(metadata.expiresAt) : undefined,
        createdAt: new Date(metadata.createdAt),
        lastUsed: new Date(metadata.lastUsed)
      };

      // Update last used timestamp
      await this.updateLastUsed(accountKey);

      // Register for secure memory cleanup
      this.registerMemoryCleanup(() => {
        this.secureMemoryWipe(sensitiveData);
        this.secureMemoryWipe(credentials);
      });

      return credentials;

    } catch (error) {
      console.warn(`Failed to retrieve credentials for ${accountKey}:`, error);
      return null;
    }
  }

  /**
   * Update stored credentials
   */
  async updateCredentials(accountKey: string, credentials: Partial<SecureCredentialData>): Promise<void> {
    const existing = await this.getCredentials(accountKey);
    if (!existing) {
      throw new Error('Credentials not found');
    }

    const updated: SecureCredentialData = {
      ...existing,
      ...credentials,
      lastUsed: new Date()
    };

    await this.storeCredentials(accountKey, updated);
  }

  /**
   * Delete credentials from secure storage
   */
  async deleteCredentials(accountKey: string): Promise<void> {
    try {
      // Remove from keychain
      await keytar.deletePassword(this.serviceName, accountKey);
      
      // Remove metadata
      await this.deleteMetadata(accountKey);
    } catch (error) {
      console.warn(`Failed to delete credentials for ${accountKey}:`, error);
    }
  }

  /**
   * List all stored credential accounts
   */
  async listCredentialAccounts(): Promise<Array<{
    accountKey: string;
    credentialType: string;
    region?: string;
    profileName?: string;
    expiresAt?: Date;
    lastUsed: Date;
    isExpired: boolean;
  }>> {
    try {
      const metadata = await this.loadAllMetadata();
      const now = new Date();

      return Object.entries(metadata).map(([accountKey, data]) => ({
        accountKey,
        credentialType: data.credentialType,
        region: data.region,
        profileName: data.profileName,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
        lastUsed: new Date(data.lastUsed),
        isExpired: data.expiresAt ? now > new Date(data.expiresAt) : false
      }));
    } catch (error) {
      console.warn('Failed to list credential accounts:', error);
      return [];
    }
  }

  /**
   * Clean up expired credentials
   */
  async cleanupExpiredCredentials(): Promise<number> {
    try {
      const accounts = await this.listCredentialAccounts();
      let cleanedCount = 0;

      for (const account of accounts) {
        if (account.isExpired) {
          await this.deleteCredentials(account.accountKey);
          cleanedCount++;
        }
      }

      return cleanedCount;
    } catch (error) {
      console.warn('Failed to cleanup expired credentials:', error);
      return 0;
    }
  }

  /**
   * Clear all stored credentials
   */
  async clearAllCredentials(): Promise<void> {
    try {
      const accounts = await this.listCredentialAccounts();
      
      for (const account of accounts) {
        await this.deleteCredentials(account.accountKey);
      }

      // Clear metadata file
      await this.clearAllMetadata();
    } catch (error) {
      throw new Error(`Failed to clear all credentials: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Perform secure memory cleanup
   */
  async performSecureCleanup(): Promise<void> {
    try {
      // Execute all registered cleanup handlers
      for (const handler of this.memoryCleanupHandlers) {
        try {
          handler();
        } catch (error) {
          console.warn('Memory cleanup handler failed:', error);
        }
      }

      // Clear cleanup handlers
      this.memoryCleanupHandlers = [];

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    } catch (error) {
      console.warn('Secure cleanup failed:', error);
    }
  }

  /**
   * Initialize or load encryption key
   */
  private async initializeEncryptionKey(): Promise<void> {
    const keyPath = join(this.storageDir, this.KEY_FILE);
    
    try {
      // Try to load existing key
      const keyData = await fs.readFile(keyPath, 'utf8');
      this.encryptionKey = keyData.trim();
    } catch (error) {
      // Generate new key if none exists
      this.encryptionKey = randomBytes(32).toString('hex');
      await fs.writeFile(keyPath, this.encryptionKey, { mode: 0o600 });
    }
  }

  /**
   * Encrypt sensitive data using AES-256-GCM
   */
  private encryptSensitiveData(data: string): string {
    const iv = randomBytes(16);
    const cipher = createCipherGCM('aes-256-gcm', Buffer.from(this.encryptionKey, 'hex'));
    cipher.setAAD(Buffer.from('aws-network-flow-visualizer', 'utf8'));
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Combine IV, auth tag, and encrypted data
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt sensitive data using AES-256-GCM
   */
  private decryptSensitiveData(encryptedData: string): string {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = createDecipherGCM('aes-256-gcm', Buffer.from(this.encryptionKey, 'hex'));
    decipher.setAAD(Buffer.from('aws-network-flow-visualizer', 'utf8'));
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Store metadata in encrypted local file
   */
  private async storeMetadata(accountKey: string, metadata: any): Promise<void> {
    const allMetadata = await this.loadAllMetadata();
    allMetadata[accountKey] = metadata;
    await this.saveAllMetadata(allMetadata);
  }

  /**
   * Get metadata for account
   */
  private async getMetadata(accountKey: string): Promise<any> {
    const allMetadata = await this.loadAllMetadata();
    return allMetadata[accountKey] || null;
  }

  /**
   * Delete metadata for account
   */
  private async deleteMetadata(accountKey: string): Promise<void> {
    const allMetadata = await this.loadAllMetadata();
    delete allMetadata[accountKey];
    await this.saveAllMetadata(allMetadata);
  }

  /**
   * Load all metadata from encrypted file
   */
  private async loadAllMetadata(): Promise<Record<string, any>> {
    const filePath = join(this.storageDir, this.METADATA_FILE);
    
    try {
      const encryptedData = await fs.readFile(filePath, 'utf8');
      const decryptedData = this.decryptSensitiveData(encryptedData);
      return JSON.parse(decryptedData);
    } catch (error) {
      return {};
    }
  }

  /**
   * Save all metadata to encrypted file
   */
  private async saveAllMetadata(metadata: Record<string, any>): Promise<void> {
    const filePath = join(this.storageDir, this.METADATA_FILE);
    
    try {
      const jsonData = JSON.stringify(metadata, null, 2);
      const encryptedData = this.encryptSensitiveData(jsonData);
      await fs.writeFile(filePath, encryptedData, { mode: 0o600 });
    } catch (error) {
      throw new Error(`Failed to save metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear all metadata
   */
  private async clearAllMetadata(): Promise<void> {
    await this.saveAllMetadata({});
  }

  /**
   * Update last used timestamp
   */
  private async updateLastUsed(accountKey: string): Promise<void> {
    const metadata = await this.getMetadata(accountKey);
    if (metadata) {
      metadata.lastUsed = new Date();
      await this.storeMetadata(accountKey, metadata);
    }
  }

  /**
   * Register memory cleanup handler
   */
  private registerMemoryCleanup(handler: () => void): void {
    this.memoryCleanupHandlers.push(handler);
  }

  /**
   * Securely wipe sensitive data from memory
   */
  private secureMemoryWipe(obj: any): void {
    if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          if (typeof obj[key] === 'string') {
            // Overwrite string with random data
            obj[key] = randomBytes(obj[key].length).toString('hex');
          } else if (typeof obj[key] === 'object') {
            this.secureMemoryWipe(obj[key]);
          }
          delete obj[key];
        }
      }
    }
  }

  /**
   * Register cleanup handlers for application exit
   */
  private registerCleanupHandlers(): void {
    const cleanup = () => {
      this.performSecureCleanup().catch(console.warn);
    };

    // Register for various exit events
    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('uncaughtException', cleanup);

    // Register for Electron app events if available
    if (electronApp) {
      electronApp.on('before-quit', cleanup);
      electronApp.on('window-all-closed', cleanup);
    }
  }

  /**
   * Get storage directory path
   */
  getStorageDir(): string {
    return this.storageDir;
  }

  /**
   * Check if storage is initialized
   */
  async isInitialized(): Promise<boolean> {
    try {
      const keyPath = join(this.storageDir, this.KEY_FILE);
      await fs.access(keyPath);
      return true;
    } catch {
      return false;
    }
  }
}