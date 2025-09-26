import { NetworkSecurityManager, NetworkRequestLog, CertificatePinConfig } from '../network-security-manager';
import { promises as fs } from 'fs';
import { Agent } from 'https';

// Mock fs
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    readdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    appendFile: jest.fn(),
    stat: jest.fn(),
    rename: jest.fn(),
    unlink: jest.fn(),
  },
}));

const mockedFs = fs as jest.Mocked<typeof fs>;

describe('NetworkSecurityManager', () => {
  let networkSecurityManager: NetworkSecurityManager;
  const testLogDir = '/test/logs';

  beforeEach(() => {
    jest.clearAllMocks();
    networkSecurityManager = new NetworkSecurityManager({
      enableCertificatePinning: true,
      enableRequestLogging: true,
      logDirectory: testLogDir,
      maxLogSize: 1, // 1MB for testing
      maxLogAge: 1 // 1 day for testing
    });
  });

  describe('initialization', () => {
    it('should initialize log directory', async () => {
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.readFile.mockRejectedValue(new Error('File not found'));
      mockedFs.readdir.mockResolvedValue([]);

      await networkSecurityManager.initialize();

      expect(mockedFs.mkdir).toHaveBeenCalledWith(testLogDir, { recursive: true });
    });

    it('should load existing logs on initialization', async () => {
      const existingLogs = [
        JSON.stringify({
          timestamp: new Date().toISOString(),
          method: 'GET',
          url: 'https://example.com',
          headers: {},
          statusCode: 200
        })
      ].join('\n');

      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.readFile.mockResolvedValue(existingLogs);
      mockedFs.readdir.mockResolvedValue([]);

      await networkSecurityManager.initialize();

      const logs = networkSecurityManager.getNetworkRequestLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].url).toBe('https://example.com');
    });
  });

  describe('secure agent creation', () => {
    it('should create HTTPS agent with security settings', () => {
      const agent = networkSecurityManager.createSecureAgent();

      expect(agent).toBeInstanceOf(Agent);
      expect(agent.options.secureProtocol).toBe('TLSv1_2_method');
      expect(agent.options.checkServerIdentity).toBeDefined();
    });

    it('should create agent without certificate pinning when disabled', () => {
      const manager = new NetworkSecurityManager({
        enableCertificatePinning: false
      });

      const agent = manager.createSecureAgent();
      expect(agent.options.checkServerIdentity).toBeUndefined();
    });
  });

  describe('request logging', () => {
    beforeEach(async () => {
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.readFile.mockRejectedValue(new Error('File not found'));
      mockedFs.readdir.mockResolvedValue([]);
      mockedFs.appendFile.mockResolvedValue(undefined);
      mockedFs.stat.mockResolvedValue({ size: 1024 } as any);

      await networkSecurityManager.initialize();
    });

    it('should log network requests', async () => {
      const requestLog: Omit<NetworkRequestLog, 'timestamp'> = {
        method: 'POST',
        url: 'https://logs.us-east-1.amazonaws.com/',
        headers: { 'Content-Type': 'application/json' },
        statusCode: 200,
        responseTime: 150
      };

      await networkSecurityManager.logNetworkRequest(requestLog);

      expect(mockedFs.appendFile).toHaveBeenCalledWith(
        expect.stringContaining('network-requests.log'),
        expect.stringContaining('"method":"POST"'),
        { mode: 0o600 }
      );

      const logs = networkSecurityManager.getNetworkRequestLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].method).toBe('POST');
      expect(logs[0].url).toBe('https://logs.us-east-1.amazonaws.com/');
    });

    it('should not log when logging is disabled', async () => {
      const manager = new NetworkSecurityManager({
        enableRequestLogging: false
      });

      const requestLog: Omit<NetworkRequestLog, 'timestamp'> = {
        method: 'GET',
        url: 'https://example.com',
        headers: {}
      };

      await manager.logNetworkRequest(requestLog);

      expect(mockedFs.appendFile).not.toHaveBeenCalled();
    });

    it('should filter logs by hostname', async () => {
      const logs = [
        {
          timestamp: new Date(),
          method: 'GET',
          url: 'https://logs.us-east-1.amazonaws.com/',
          headers: {}
        },
        {
          timestamp: new Date(),
          method: 'POST',
          url: 'https://sts.amazonaws.com/',
          headers: {}
        }
      ];

      // Manually add logs for testing
      (networkSecurityManager as any).requestLogs = logs;

      const filteredLogs = networkSecurityManager.getNetworkRequestLogs({
        hostname: 'logs.us-east-1'
      });

      expect(filteredLogs).toHaveLength(1);
      expect(filteredLogs[0].url).toBe('https://logs.us-east-1.amazonaws.com/');
    });

    it('should limit log results', async () => {
      const logs = Array.from({ length: 10 }, (_, i) => ({
        timestamp: new Date(),
        method: 'GET',
        url: `https://example${i}.com`,
        headers: {}
      }));

      (networkSecurityManager as any).requestLogs = logs;

      const limitedLogs = networkSecurityManager.getNetworkRequestLogs({ limit: 5 });
      expect(limitedLogs).toHaveLength(5);
    });
  });

  describe('certificate pinning', () => {
    it('should add custom certificate pin', () => {
      const pinConfig: CertificatePinConfig = {
        hostname: 'example.com',
        fingerprints: ['abc123', 'def456'],
        algorithm: 'sha256'
      };

      networkSecurityManager.addCertificatePin(pinConfig);

      const pins = networkSecurityManager.getCertificatePins();
      const customPin = pins.find(p => p.hostname === 'example.com');
      expect(customPin).toBeDefined();
      expect(customPin?.fingerprints).toEqual(['abc123', 'def456']);
    });

    it('should remove certificate pin', () => {
      const pinConfig: CertificatePinConfig = {
        hostname: 'example.com',
        fingerprints: ['abc123'],
        algorithm: 'sha256'
      };

      networkSecurityManager.addCertificatePin(pinConfig);
      networkSecurityManager.removeCertificatePin('example.com');

      const pins = networkSecurityManager.getCertificatePins();
      const customPin = pins.find(p => p.hostname === 'example.com');
      expect(customPin).toBeUndefined();
    });

    it('should have AWS certificate pins by default', () => {
      const pins = networkSecurityManager.getCertificatePins();
      const awsPin = pins.find(p => p.hostname === '*.amazonaws.com');
      expect(awsPin).toBeDefined();
      expect(awsPin?.fingerprints.length).toBeGreaterThan(0);
    });
  });

  describe('log management', () => {
    beforeEach(async () => {
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.readFile.mockRejectedValue(new Error('File not found'));
      mockedFs.readdir.mockResolvedValue([]);
      mockedFs.appendFile.mockResolvedValue(undefined);

      await networkSecurityManager.initialize();
    });

    it('should clear network logs', async () => {
      mockedFs.writeFile.mockResolvedValue(undefined);

      await networkSecurityManager.clearNetworkLogs();

      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('network-requests.log'),
        '',
        { mode: 0o600 }
      );
    });

    it('should export logs as JSON', async () => {
      const logs = [
        {
          timestamp: new Date(),
          method: 'GET',
          url: 'https://example.com',
          headers: {},
          statusCode: 200
        }
      ];

      (networkSecurityManager as any).requestLogs = logs;

      const exported = await networkSecurityManager.exportNetworkLogs('json');
      const parsed = JSON.parse(exported);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].method).toBe('GET');
    });

    it('should export logs as CSV', async () => {
      const logs = [
        {
          timestamp: new Date('2023-01-01T12:00:00Z'),
          method: 'GET',
          url: 'https://example.com',
          headers: {},
          statusCode: 200,
          responseTime: 100
        }
      ];

      (networkSecurityManager as any).requestLogs = logs;

      const exported = await networkSecurityManager.exportNetworkLogs('csv');
      const lines = exported.split('\n');

      expect(lines[0]).toBe('timestamp,method,url,statusCode,responseTime,error');
      expect(lines[1]).toContain('GET');
      expect(lines[1]).toContain('"https://example.com"');
      expect(lines[1]).toContain('200');
    });

    it('should rotate logs when size limit exceeded', async () => {
      // Mock large file size
      mockedFs.stat.mockResolvedValue({ size: 2 * 1024 * 1024 } as any); // 2MB
      mockedFs.rename.mockResolvedValue(undefined);

      const requestLog: Omit<NetworkRequestLog, 'timestamp'> = {
        method: 'GET',
        url: 'https://example.com',
        headers: {}
      };

      await networkSecurityManager.logNetworkRequest(requestLog);

      expect(mockedFs.rename).toHaveBeenCalled();
    });

    it('should cleanup old log files', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 5); // 5 days old

      mockedFs.readdir.mockResolvedValue(['network-requests-old.log', 'other-file.txt']);
      mockedFs.stat.mockResolvedValue({ mtime: oldDate } as any);
      mockedFs.unlink.mockResolvedValue(undefined);

      await networkSecurityManager.initialize();

      expect(mockedFs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('network-requests-old.log')
      );
    });
  });

  describe('error handling', () => {
    it('should handle file system errors gracefully', async () => {
      mockedFs.mkdir.mockRejectedValue(new Error('Permission denied'));

      await expect(networkSecurityManager.initialize()).rejects.toThrow(
        'Failed to initialize network security manager'
      );
    });

    it('should handle log writing errors gracefully', async () => {
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.readFile.mockRejectedValue(new Error('File not found'));
      mockedFs.readdir.mockResolvedValue([]);
      mockedFs.appendFile.mockRejectedValue(new Error('Write failed'));

      await networkSecurityManager.initialize();

      // Should not throw error, just log warning
      await expect(networkSecurityManager.logNetworkRequest({
        method: 'GET',
        url: 'https://example.com',
        headers: {}
      })).resolves.not.toThrow();
    });

    it('should handle export errors', async () => {
      // Corrupt logs that can't be serialized
      (networkSecurityManager as any).requestLogs = [{ circular: {} }];
      (networkSecurityManager as any).requestLogs[0].circular.ref = (networkSecurityManager as any).requestLogs[0];

      await expect(networkSecurityManager.exportNetworkLogs('json')).rejects.toThrow(
        'Failed to export network logs'
      );
    });
  });
});