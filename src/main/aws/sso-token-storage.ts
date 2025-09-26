import { promises as fs } from 'fs';
import { join } from 'path';
import { createCipherGCM, createDecipherGCM, randomBytes } from 'crypto';
import { SSOTokens } from './sso-auth';
import { SecureCredentialStorage } from './secure-credential-storage';

// Safe import of electron app for test environment compatibility
let electronApp: any = null;
try {
  electronApp = require('electron').app;
} catch {
  // Electron not available (test environment)
}

export interface StoredSSOSession {
  startUrl: string;
  region: string;
  tokens: SSOTokens;
  createdAt: Date;
  lastRefreshed: Date;
}

export interface SSOTokenStorageOptions {
  encryptionKey?: string;
  storageDir?: string;
}

/**
 * Secure storage for SSO tokens with encryption and automatic cleanup
 */
export class SSOTokenStorage {
  private storageDir: string;
  private encryptionKey: string;
  private readonly STORAGE_FILE = 'sso-sessions.json';
  private readonly KEY_FILE = 'storage.key';
  private secureStorage: SecureCredentialStorage;

  constructor(options: SSOTokenStorageOptions = {}) {
    // Use provided storage directory or default based on environment
    if (options.storageDir) {
      this.storageDir = options.storageDir;
    } else if (electronApp) {
      this.storageDir = join(electronApp.getPath('userData'), 'aws-sso');
    } else {
      // Fallback for test environment
      this.storageDir = join(process.cwd(), '.test-aws-sso');
    }
    this.encryptionKey = options.encryptionKey || '';
    
    // Initialize secure storage for enhanced security
    this.secureStorage = new SecureCredentialStorage({
      serviceName: 'aws-network-flow-visualizer-sso',
      storageDir: join(this.storageDir, 'secure')
    });
  }

  /**
   * Initialize storage directory and encryption key
   */
  async initialize(): Promise<void> {
    try {
      // Ensure storage directory exists
      await fs.mkdir(this.storageDir, { recursive: true });

      // Initialize or load encryption key
      await this.initializeEncryptionKey();
      
      // Initialize secure storage
      await this.secureStorage.initialize();
    } catch (error) {
      throw new Error(`Failed to initialize SSO token storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store SSO session tokens
   */
  async storeSession(startUrl: string, region: string, tokens: SSOTokens): Promise<void> {
    try {
      const sessions = await this.loadSessions();
      const sessionKey = this.getSessionKey(startUrl, region);
      
      sessions[sessionKey] = {
        startUrl,
        region,
        tokens,
        createdAt: new Date(),
        lastRefreshed: new Date()
      };

      await this.saveSessions(sessions);
    } catch (error) {
      throw new Error(`Failed to store SSO session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve SSO session tokens
   */
  async getSession(startUrl: string, region: string): Promise<StoredSSOSession | null> {
    try {
      const sessions = await this.loadSessions();
      const sessionKey = this.getSessionKey(startUrl, region);
      
      const session = sessions[sessionKey];
      if (!session) {
        return null;
      }

      // Check if token is expired
      if (this.isTokenExpired(session.tokens)) {
        // Remove expired session
        delete sessions[sessionKey];
        await this.saveSessions(sessions);
        return null;
      }

      return session;
    } catch (error) {
      console.warn('Failed to retrieve SSO session:', error);
      return null;
    }
  }

  /**
   * Update existing session with refreshed tokens
   */
  async updateSession(startUrl: string, region: string, tokens: SSOTokens): Promise<void> {
    try {
      const sessions = await this.loadSessions();
      const sessionKey = this.getSessionKey(startUrl, region);
      
      const existingSession = sessions[sessionKey];
      if (!existingSession) {
        throw new Error('Session not found');
      }

      sessions[sessionKey] = {
        ...existingSession,
        tokens,
        lastRefreshed: new Date()
      };

      await this.saveSessions(sessions);
    } catch (error) {
      throw new Error(`Failed to update SSO session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Remove SSO session
   */
  async removeSession(startUrl: string, region: string): Promise<void> {
    try {
      const sessions = await this.loadSessions();
      const sessionKey = this.getSessionKey(startUrl, region);
      
      delete sessions[sessionKey];
      await this.saveSessions(sessions);
    } catch (error) {
      throw new Error(`Failed to remove SSO session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List all stored sessions
   */
  async listSessions(): Promise<Array<{ startUrl: string; region: string; isExpired: boolean; lastRefreshed: Date }>> {
    try {
      const sessions = await this.loadSessions();
      
      return Object.values(sessions).map(session => ({
        startUrl: session.startUrl,
        region: session.region,
        isExpired: this.isTokenExpired(session.tokens),
        lastRefreshed: session.lastRefreshed
      }));
    } catch (error) {
      console.warn('Failed to list SSO sessions:', error);
      return [];
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const sessions = await this.loadSessions();
      const originalCount = Object.keys(sessions).length;
      
      // Remove expired sessions
      for (const [key, session] of Object.entries(sessions)) {
        if (this.isTokenExpired(session.tokens)) {
          delete sessions[key];
        }
      }

      await this.saveSessions(sessions);
      
      const removedCount = originalCount - Object.keys(sessions).length;
      return removedCount;
    } catch (error) {
      console.warn('Failed to cleanup expired sessions:', error);
      return 0;
    }
  }

  /**
   * Clear all stored sessions
   */
  async clearAllSessions(): Promise<void> {
    try {
      await this.saveSessions({});
      // Also clear from secure storage
      await this.secureStorage.clearAllCredentials();
    } catch (error) {
      throw new Error(`Failed to clear SSO sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Perform secure cleanup of SSO tokens
   */
  async performSecureCleanup(): Promise<void> {
    try {
      // Clean up expired sessions
      await this.cleanupExpiredSessions();
      
      // Perform secure memory cleanup
      await this.secureStorage.performSecureCleanup();
    } catch (error) {
      console.warn('SSO secure cleanup failed:', error);
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
   * Load sessions from encrypted storage
   */
  private async loadSessions(): Promise<Record<string, StoredSSOSession>> {
    const filePath = join(this.storageDir, this.STORAGE_FILE);
    
    try {
      const encryptedData = await fs.readFile(filePath, 'utf8');
      const decryptedData = this.decrypt(encryptedData);
      const sessions = JSON.parse(decryptedData);
      
      // Convert date strings back to Date objects
      for (const session of Object.values(sessions) as StoredSSOSession[]) {
        session.createdAt = new Date(session.createdAt);
        session.lastRefreshed = new Date(session.lastRefreshed);
        session.tokens.expiresAt = new Date(session.tokens.expiresAt);
      }
      
      return sessions;
    } catch (error) {
      // Return empty sessions if file doesn't exist or can't be read
      return {};
    }
  }

  /**
   * Save sessions to encrypted storage
   */
  private async saveSessions(sessions: Record<string, StoredSSOSession>): Promise<void> {
    const filePath = join(this.storageDir, this.STORAGE_FILE);
    
    try {
      const jsonData = JSON.stringify(sessions, null, 2);
      const encryptedData = this.encrypt(jsonData);
      await fs.writeFile(filePath, encryptedData, { mode: 0o600 });
    } catch (error) {
      throw new Error(`Failed to save sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  private encrypt(data: string): string {
    const iv = randomBytes(16);
    const cipher = createCipherGCM('aes-256-gcm', Buffer.from(this.encryptionKey, 'hex'));
    cipher.setAAD(Buffer.from('sso-token-storage', 'utf8'));
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Combine IV, auth tag, and encrypted data
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  private decrypt(encryptedData: string): string {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = createDecipherGCM('aes-256-gcm', Buffer.from(this.encryptionKey, 'hex'));
    decipher.setAAD(Buffer.from('sso-token-storage', 'utf8'));
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Generate session key from start URL and region
   */
  private getSessionKey(startUrl: string, region: string): string {
    return `${startUrl}:${region}`;
  }

  /**
   * Check if token is expired or about to expire
   */
  private isTokenExpired(tokens: SSOTokens): boolean {
    const now = new Date();
    const expirationBuffer = 5 * 60 * 1000; // 5 minutes buffer
    return tokens.expiresAt.getTime() - now.getTime() < expirationBuffer;
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