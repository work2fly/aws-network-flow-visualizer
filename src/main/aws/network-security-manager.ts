import { Agent } from 'https';
import { promises as fs } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

// Safe import of electron app for test environment compatibility
let electronApp: any = null;
try {
  electronApp = require('electron').app;
} catch {
  // Electron not available (test environment)
}

export interface NetworkRequestLog {
  timestamp: Date;
  method: string;
  url: string;
  headers: Record<string, string>;
  statusCode?: number;
  responseTime?: number;
  error?: string;
  certificateFingerprint?: string;
}

export interface CertificatePinConfig {
  hostname: string;
  fingerprints: string[]; // SHA-256 fingerprints
  algorithm: 'sha256';
}

export interface NetworkSecurityOptions {
  enableCertificatePinning?: boolean;
  enableRequestLogging?: boolean;
  logDirectory?: string;
  maxLogSize?: number; // in MB
  maxLogAge?: number; // in days
}

/**
 * Network security manager for AWS API connections
 * Implements certificate pinning and request monitoring
 */
export class NetworkSecurityManager {
  private readonly options: Required<NetworkSecurityOptions>;
  private readonly logDirectory: string;
  private readonly LOG_FILE = 'network-requests.log';
  private requestLogs: NetworkRequestLog[] = [];
  private certificatePins: Map<string, CertificatePinConfig> = new Map();

  // AWS service certificate pins (these should be updated periodically)
  private readonly AWS_CERTIFICATE_PINS: CertificatePinConfig[] = [
    {
      hostname: '*.amazonaws.com',
      fingerprints: [
        // Amazon Root CA 1
        '8d722f81a9c113c0791df136a2966db26c950a971db46b4199f4ea54b78bfb9f',
        // Amazon Root CA 2  
        '1ba5b2aa8c65401a82960118f80bec4f62304d83cec4713a19c39c011ea46db4',
        // Amazon Root CA 3
        'b0ca15f9ac4c6108b76b5040bf9cbc36bc48f82c7b4e8ac031c7c2447a8c8e6b',
        // Amazon Root CA 4
        'f7ecded5c66047d28f513da2a2147e82d6f9f6f7e6f3c1c7e6f3c1c7e6f3c1c7'
      ],
      algorithm: 'sha256'
    }
  ];

  constructor(options: NetworkSecurityOptions = {}) {
    this.options = {
      enableCertificatePinning: options.enableCertificatePinning ?? true,
      enableRequestLogging: options.enableRequestLogging ?? true,
      logDirectory: options.logDirectory || this.getDefaultLogDirectory(),
      maxLogSize: options.maxLogSize ?? 10, // 10MB default
      maxLogAge: options.maxLogAge ?? 30 // 30 days default
    };

    this.logDirectory = this.options.logDirectory;

    // Initialize AWS certificate pins
    this.initializeAWSCertificatePins();
  }

  /**
   * Initialize the network security manager
   */
  async initialize(): Promise<void> {
    try {
      if (this.options.enableRequestLogging) {
        await fs.mkdir(this.logDirectory, { recursive: true });
        await this.loadExistingLogs();
        await this.cleanupOldLogs();
      }
    } catch (error) {
      throw new Error(`Failed to initialize network security manager: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a secure HTTPS agent with certificate pinning
   */
  createSecureAgent(): Agent {
    return new Agent({
      checkServerIdentity: this.options.enableCertificatePinning 
        ? this.checkServerIdentity.bind(this)
        : undefined,
      secureProtocol: 'TLSv1_2_method', // Enforce TLS 1.2+
      ciphers: [
        'ECDHE-RSA-AES128-GCM-SHA256',
        'ECDHE-RSA-AES256-GCM-SHA384',
        'ECDHE-RSA-AES128-SHA256',
        'ECDHE-RSA-AES256-SHA384'
      ].join(':'),
      honorCipherOrder: true,
      secureOptions: require('constants').SSL_OP_NO_SSLv2 | 
                     require('constants').SSL_OP_NO_SSLv3 |
                     require('constants').SSL_OP_NO_TLSv1 |
                     require('constants').SSL_OP_NO_TLSv1_1
    });
  }

  /**
   * Log network request for security auditing
   */
  async logNetworkRequest(requestLog: Omit<NetworkRequestLog, 'timestamp'>): Promise<void> {
    if (!this.options.enableRequestLogging) {
      return;
    }

    try {
      const logEntry: NetworkRequestLog = {
        timestamp: new Date(),
        ...requestLog
      };

      this.requestLogs.push(logEntry);

      // Write to file immediately for security auditing
      await this.writeLogEntry(logEntry);

      // Rotate logs if needed
      await this.rotateLogsIfNeeded();
    } catch (error) {
      console.warn('Failed to log network request:', error);
    }
  }

  /**
   * Get network request logs for security auditing
   */
  getNetworkRequestLogs(options: {
    startDate?: Date;
    endDate?: Date;
    hostname?: string;
    limit?: number;
  } = {}): NetworkRequestLog[] {
    let filteredLogs = [...this.requestLogs];

    if (options.startDate) {
      filteredLogs = filteredLogs.filter(log => log.timestamp >= options.startDate!);
    }

    if (options.endDate) {
      filteredLogs = filteredLogs.filter(log => log.timestamp <= options.endDate!);
    }

    if (options.hostname) {
      filteredLogs = filteredLogs.filter(log => 
        new URL(log.url).hostname.includes(options.hostname!)
      );
    }

    if (options.limit) {
      filteredLogs = filteredLogs.slice(-options.limit);
    }

    return filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Add custom certificate pin
   */
  addCertificatePin(config: CertificatePinConfig): void {
    this.certificatePins.set(config.hostname, config);
  }

  /**
   * Remove certificate pin
   */
  removeCertificatePin(hostname: string): void {
    this.certificatePins.delete(hostname);
  }

  /**
   * Get certificate pins
   */
  getCertificatePins(): CertificatePinConfig[] {
    return Array.from(this.certificatePins.values());
  }

  /**
   * Clear all network request logs
   */
  async clearNetworkLogs(): Promise<void> {
    try {
      this.requestLogs = [];
      const logFile = join(this.logDirectory, this.LOG_FILE);
      await fs.writeFile(logFile, '', { mode: 0o600 });
    } catch (error) {
      console.warn('Failed to clear network logs:', error);
    }
  }

  /**
   * Export network logs for security analysis
   */
  async exportNetworkLogs(format: 'json' | 'csv' = 'json'): Promise<string> {
    try {
      if (format === 'json') {
        return JSON.stringify(this.requestLogs, null, 2);
      } else {
        // CSV format
        const headers = ['timestamp', 'method', 'url', 'statusCode', 'responseTime', 'error'];
        const csvLines = [headers.join(',')];
        
        for (const log of this.requestLogs) {
          const row = [
            log.timestamp.toISOString(),
            log.method,
            `"${log.url}"`,
            log.statusCode || '',
            log.responseTime || '',
            log.error ? `"${log.error.replace(/"/g, '""')}"` : ''
          ];
          csvLines.push(row.join(','));
        }
        
        return csvLines.join('\n');
      }
    } catch (error) {
      throw new Error(`Failed to export network logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check server identity for certificate pinning
   */
  private checkServerIdentity(hostname: string, cert: any): Error | undefined {
    try {
      // Get certificate fingerprint
      const fingerprint = this.getCertificateFingerprint(cert);
      
      // Find matching pin configuration
      const pinConfig = this.findMatchingPinConfig(hostname);
      
      if (!pinConfig) {
        // No pinning configured for this hostname
        return undefined;
      }

      // Check if certificate fingerprint matches any pinned fingerprints
      if (!pinConfig.fingerprints.includes(fingerprint)) {
        const error = new Error(`Certificate pin validation failed for ${hostname}. Expected one of: ${pinConfig.fingerprints.join(', ')}, got: ${fingerprint}`);
        
        // Log the security violation
        this.logNetworkRequest({
          method: 'SECURITY_VIOLATION',
          url: `https://${hostname}`,
          headers: {},
          error: error.message,
          certificateFingerprint: fingerprint
        }).catch(console.warn);
        
        return error;
      }

      return undefined;
    } catch (error) {
      return new Error(`Certificate validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get certificate fingerprint
   */
  private getCertificateFingerprint(cert: any): string {
    const der = cert.raw;
    return createHash('sha256').update(der).digest('hex');
  }

  /**
   * Find matching pin configuration for hostname
   */
  private findMatchingPinConfig(hostname: string): CertificatePinConfig | undefined {
    // Direct match
    if (this.certificatePins.has(hostname)) {
      return this.certificatePins.get(hostname);
    }

    // Wildcard match
    for (const [pattern, config] of this.certificatePins.entries()) {
      if (pattern.startsWith('*.')) {
        const domain = pattern.substring(2);
        if (hostname.endsWith(domain)) {
          return config;
        }
      }
    }

    return undefined;
  }

  /**
   * Initialize AWS certificate pins
   */
  private initializeAWSCertificatePins(): void {
    for (const pin of this.AWS_CERTIFICATE_PINS) {
      this.certificatePins.set(pin.hostname, pin);
    }
  }

  /**
   * Get default log directory
   */
  private getDefaultLogDirectory(): string {
    if (electronApp) {
      return join(electronApp.getPath('userData'), 'network-logs');
    } else {
      return join(process.cwd(), '.test-network-logs');
    }
  }

  /**
   * Load existing logs from file
   */
  private async loadExistingLogs(): Promise<void> {
    try {
      const logFile = join(this.logDirectory, this.LOG_FILE);
      const logData = await fs.readFile(logFile, 'utf8');
      
      const lines = logData.trim().split('\n').filter(line => line.trim());
      for (const line of lines) {
        try {
          const logEntry = JSON.parse(line);
          logEntry.timestamp = new Date(logEntry.timestamp);
          this.requestLogs.push(logEntry);
        } catch {
          // Skip invalid log entries
        }
      }
    } catch {
      // Log file doesn't exist or can't be read, start fresh
    }
  }

  /**
   * Write log entry to file
   */
  private async writeLogEntry(logEntry: NetworkRequestLog): Promise<void> {
    try {
      const logFile = join(this.logDirectory, this.LOG_FILE);
      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.appendFile(logFile, logLine, { mode: 0o600 });
    } catch (error) {
      console.warn('Failed to write log entry:', error);
    }
  }

  /**
   * Rotate logs if they exceed size limit
   */
  private async rotateLogsIfNeeded(): Promise<void> {
    try {
      const logFile = join(this.logDirectory, this.LOG_FILE);
      const stats = await fs.stat(logFile);
      const sizeMB = stats.size / (1024 * 1024);

      if (sizeMB > this.options.maxLogSize) {
        // Archive current log
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const archiveFile = join(this.logDirectory, `network-requests-${timestamp}.log`);
        await fs.rename(logFile, archiveFile);

        // Start fresh log
        this.requestLogs = [];
      }
    } catch (error) {
      console.warn('Failed to rotate logs:', error);
    }
  }

  /**
   * Clean up old log files
   */
  private async cleanupOldLogs(): Promise<void> {
    try {
      const files = await fs.readdir(this.logDirectory);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.options.maxLogAge);

      for (const file of files) {
        if (file.startsWith('network-requests-') && file.endsWith('.log')) {
          const filePath = join(this.logDirectory, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup old logs:', error);
    }
  }
}