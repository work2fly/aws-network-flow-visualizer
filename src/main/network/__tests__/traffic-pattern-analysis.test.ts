import { TrafficPatternAnalyzer } from '../traffic-pattern-analysis';
import { FlowLogRecord } from '../../../shared/types';

describe('TrafficPatternAnalyzer', () => {
  let analyzer: TrafficPatternAnalyzer;

  beforeEach(() => {
    analyzer = new TrafficPatternAnalyzer();
  });

  const createMockRecord = (overrides: Partial<FlowLogRecord> = {}): FlowLogRecord => ({
    timestamp: new Date(),
    sourceIP: '10.0.1.100',
    destinationIP: '10.0.2.200',
    sourcePort: 12345,
    destinationPort: 80,
    protocol: 'TCP',
    action: 'ACCEPT',
    bytes: 1024,
    packets: 10,
    accountId: '123456789012',
    vpcId: 'vpc-12345',
    subnetId: 'subnet-12345',
    instanceId: 'i-12345',
    region: 'us-east-1',
    ...overrides,
  });

  describe('analyzeTrafficPatterns', () => {
    it('should analyze traffic patterns from empty records', async () => {
      const result = await analyzer.analyzeTrafficPatterns([]);

      expect(result.volumeAnalysis.totalVolume).toBe(0);
      expect(result.connectionAnalysis.totalConnections).toBe(0);
      expect(result.patterns).toHaveLength(0);
      expect(result.securityIssues).toHaveLength(0);
    });

    it('should analyze basic traffic volume', async () => {
      const records = [
        createMockRecord({ bytes: 1000 }),
        createMockRecord({ bytes: 2000 }),
        createMockRecord({ bytes: 1500 }),
      ];

      const result = await analyzer.analyzeTrafficPatterns(records);

      expect(result.volumeAnalysis.totalVolume).toBe(4500);
      expect(result.volumeAnalysis.averageVolume).toBe(1500);
      expect(result.volumeAnalysis.peakVolume).toBeGreaterThan(0);
      expect(result.volumeAnalysis.volumeDistribution.length).toBeGreaterThan(0);
    });

    it('should analyze connection patterns', async () => {
      const records = [
        createMockRecord({ sourceIP: '10.0.1.100', destinationIP: '10.0.2.200' }),
        createMockRecord({ sourceIP: '10.0.1.101', destinationIP: '10.0.2.200' }),
        createMockRecord({ sourceIP: '10.0.1.100', destinationIP: '10.0.2.201' }),
      ];

      const result = await analyzer.analyzeTrafficPatterns(records);

      expect(result.connectionAnalysis.totalConnections).toBe(3);
      expect(result.connectionAnalysis.uniqueSourceIPs).toBe(2);
      expect(result.connectionAnalysis.uniqueDestinationIPs).toBe(2);
      expect(result.connectionAnalysis.connectionPatterns.length).toBeGreaterThan(0);
    });

    it('should detect rejection patterns', async () => {
      const records = [
        createMockRecord({ action: 'ACCEPT' }),
        createMockRecord({ action: 'REJECT', destinationPort: 22 }),
        createMockRecord({ action: 'REJECT', destinationPort: 3389 }),
      ];

      const result = await analyzer.analyzeTrafficPatterns(records);

      expect(result.connectionAnalysis.rejectionAnalysis.totalRejections).toBe(2);
      expect(result.connectionAnalysis.rejectionAnalysis.rejectionRate).toBeCloseTo(0.67, 1);
      expect(result.connectionAnalysis.rejectionAnalysis.suspiciousRejections.length).toBe(2);
    });

    it('should detect volume trends', async () => {
      const baseTime = new Date('2023-01-01T10:00:00Z');
      const records = [
        createMockRecord({ timestamp: new Date(baseTime.getTime()), bytes: 1000 }),
        createMockRecord({ timestamp: new Date(baseTime.getTime() + 300000), bytes: 2000 }),
        createMockRecord({ timestamp: new Date(baseTime.getTime() + 600000), bytes: 3000 }),
        createMockRecord({ timestamp: new Date(baseTime.getTime() + 900000), bytes: 4000 }),
      ];

      const result = await analyzer.analyzeTrafficPatterns(records);

      expect(result.volumeAnalysis.trends.length).toBeGreaterThan(0);
      const trend = result.volumeAnalysis.trends[0];
      expect(trend.direction).toBe('increasing');
      expect(trend.magnitude).toBeGreaterThan(0);
    });

    it('should detect periodic patterns', async () => {
      const baseTime = new Date('2023-01-01T10:00:00Z');
      const records = [];

      // Create consistent traffic pattern every 5 minutes
      for (let i = 0; i < 10; i++) {
        records.push(createMockRecord({
          timestamp: new Date(baseTime.getTime() + i * 300000),
          bytes: 1000 + Math.random() * 100, // Consistent volume with small variation
        }));
      }

      const result = await analyzer.analyzeTrafficPatterns(records, {
        enablePatternDetection: true,
      });

      expect(result.patterns.length).toBeGreaterThan(0);
      const periodicPatterns = result.patterns.filter(p => p.type === 'periodic');
      expect(periodicPatterns.length).toBeGreaterThan(0);
    });

    it('should detect burst patterns', async () => {
      const baseTime = new Date('2023-01-01T10:00:00Z');
      const records = [
        createMockRecord({ timestamp: new Date(baseTime.getTime()), bytes: 1000 }),
        createMockRecord({ timestamp: new Date(baseTime.getTime() + 300000), bytes: 1000 }),
        createMockRecord({ timestamp: new Date(baseTime.getTime() + 600000), bytes: 10000 }), // Burst
        createMockRecord({ timestamp: new Date(baseTime.getTime() + 900000), bytes: 1000 }),
      ];

      const result = await analyzer.analyzeTrafficPatterns(records, {
        enablePatternDetection: true,
      });

      const burstPatterns = result.patterns.filter(p => p.type === 'burst');
      expect(burstPatterns.length).toBeGreaterThan(0);
    });

    it('should detect volume anomalies', async () => {
      const records = [];
      
      // Create baseline traffic
      for (let i = 0; i < 50; i++) {
        records.push(createMockRecord({ bytes: 1000 }));
      }
      
      // Add anomalous high volume traffic
      for (let i = 0; i < 10; i++) {
        records.push(createMockRecord({ bytes: 10000 }));
      }

      const result = await analyzer.analyzeTrafficPatterns(records, {
        enableAnomalyDetection: true,
        anomalyThreshold: 0.5,
      });

      expect(result.anomalies).toBeDefined();
      if (result.anomalies) {
        const volumeAnomalies = result.anomalies.anomalies.filter(a => a.type === 'volume');
        expect(volumeAnomalies.length).toBeGreaterThan(0);
      }
    });

    it('should detect destination anomalies', async () => {
      const records = [];
      
      // Create baseline with few destinations (first 70% of records)
      for (let i = 0; i < 28; i++) { // 70% of 40 total records
        records.push(createMockRecord({ 
          destinationIP: `10.0.2.${100 + (i % 3)}`, // Only 3 destinations
          timestamp: new Date(Date.now() - (40 - i) * 60000) // Spread over time
        }));
      }
      
      // Add anomalous traffic to many destinations (last 30%)
      for (let i = 0; i < 12; i++) {
        records.push(createMockRecord({ 
          destinationIP: `10.0.3.${100 + i}`, // 12 new destinations
          timestamp: new Date(Date.now() - (12 - i) * 60000)
        }));
      }

      const result = await analyzer.analyzeTrafficPatterns(records, {
        enableAnomalyDetection: true,
        anomalyThreshold: 0.3, // Lower threshold
      });

      expect(result.anomalies).toBeDefined();
      if (result.anomalies) {
        
        const destAnomalies = result.anomalies.anomalies.filter(a => a.type === 'destination');
        expect(destAnomalies.length).toBeGreaterThan(0);
      }
    });

    it('should detect protocol anomalies', async () => {
      const records = [];
      
      // Create baseline with common protocols
      for (let i = 0; i < 30; i++) {
        records.push(createMockRecord({ protocol: 'TCP' }));
      }
      
      // Add anomalous protocols
      for (let i = 0; i < 10; i++) {
        records.push(createMockRecord({ protocol: 'CUSTOM' }));
      }

      const result = await analyzer.analyzeTrafficPatterns(records, {
        enableAnomalyDetection: true,
        anomalyThreshold: 0.2,
      });

      expect(result.anomalies).toBeDefined();
      if (result.anomalies) {
        const protocolAnomalies = result.anomalies.anomalies.filter(a => a.type === 'protocol');
        expect(protocolAnomalies.length).toBeGreaterThan(0);
      }
    });

    it('should detect timing anomalies', async () => {
      const records = [];
      
      // Create off-hours traffic (2 AM)
      const offHoursTime = new Date('2023-01-01T02:00:00Z');
      for (let i = 0; i < 20; i++) {
        records.push(createMockRecord({ 
          timestamp: new Date(offHoursTime.getTime() + i * 1000)
        }));
      }

      const result = await analyzer.analyzeTrafficPatterns(records, {
        enableAnomalyDetection: true,
        anomalyThreshold: 0.5,
      });

      expect(result.anomalies).toBeDefined();
      if (result.anomalies) {
        const timingAnomalies = result.anomalies.anomalies.filter(a => a.type === 'timing');
        expect(timingAnomalies.length).toBeGreaterThan(0);
      }
    });

    it('should identify unusual ports security issue', async () => {
      const records = [
        createMockRecord({ destinationPort: 80 }), // Common port
        createMockRecord({ destinationPort: 12345 }), // Unusual port
        createMockRecord({ destinationPort: 54321 }), // Unusual port
        createMockRecord({ destinationPort: 9999 }), // Unusual port
      ];

      const result = await analyzer.analyzeTrafficPatterns(records, {
        enableSecurityAnalysis: true,
      });

      const unusualPortIssues = result.securityIssues.filter(issue => 
        issue.type === 'unusual-port'
      );
      expect(unusualPortIssues.length).toBeGreaterThan(0);
    });

    it('should identify high rejection rate security issue', async () => {
      const records = [
        createMockRecord({ action: 'REJECT' }),
        createMockRecord({ action: 'REJECT' }),
        createMockRecord({ action: 'REJECT' }),
        createMockRecord({ action: 'ACCEPT' }),
      ];

      const result = await analyzer.analyzeTrafficPatterns(records, {
        enableSecurityAnalysis: true,
      });

      const rejectionIssues = result.securityIssues.filter(issue => 
        issue.type === 'high-rejection-rate'
      );
      expect(rejectionIssues.length).toBeGreaterThan(0);
    });

    it('should identify suspicious traffic patterns', async () => {
      const records = [
        createMockRecord({ bytes: 15000000 }), // Large transfer (15MB)
        createMockRecord({ bytes: 20000000 }), // Large transfer (20MB)
      ];

      const result = await analyzer.analyzeTrafficPatterns(records, {
        enableSecurityAnalysis: true,
      });

      const suspiciousIssues = result.securityIssues.filter(issue => 
        issue.type === 'suspicious-traffic'
      );
      expect(suspiciousIssues.length).toBeGreaterThan(0);
    });

    it('should detect port scanning patterns', async () => {
      const records = [];
      const sourceIP = '192.168.1.100';
      
      // Create port scanning pattern (same source, many different ports)
      for (let port = 1000; port < 1020; port++) {
        records.push(createMockRecord({ 
          sourceIP,
          destinationPort: port,
        }));
      }

      const result = await analyzer.analyzeTrafficPatterns(records, {
        enableSecurityAnalysis: true,
      });

      const scanningIssues = result.securityIssues.filter(issue => 
        issue.type === 'anomalous-pattern' && issue.description.includes('port scanning')
      );
      expect(scanningIssues.length).toBeGreaterThan(0);
    });

    it('should handle configuration options', async () => {
      const records = [createMockRecord()];

      const result = await analyzer.analyzeTrafficPatterns(records, {
        timeWindowMs: 600000, // 10 minutes
        anomalyThreshold: 0.8,
        enableAnomalyDetection: false,
        enablePatternDetection: false,
        enableSecurityAnalysis: false,
      });

      expect(result.patterns).toHaveLength(0);
      expect(result.anomalies).toBeNull();
      expect(result.securityIssues).toHaveLength(0);
    });

    it('should calculate IP patterns correctly', async () => {
      const records = [
        createMockRecord({ sourceIP: '10.0.1.100', destinationIP: '192.168.1.200' }),
        createMockRecord({ sourceIP: '10.0.1.101', destinationIP: '8.8.8.8' }),
      ];

      const result = await analyzer.analyzeTrafficPatterns(records);

      expect(result.connectionAnalysis.connectionPatterns.length).toBeGreaterThan(0);
      
      const patterns = result.connectionAnalysis.connectionPatterns;
      const privateToPrivatePattern = patterns.find(p => 
        p.sourcePattern.includes('10.0') && p.destinationPattern.includes('192.168')
      );
      const privateToExternalPattern = patterns.find(p => 
        p.sourcePattern.includes('10.0') && p.destinationPattern === 'external'
      );

      expect(privateToPrivatePattern || privateToExternalPattern).toBeDefined();
    });
  });

  describe('baseline establishment', () => {
    it('should establish baseline from historical data', async () => {
      const records = [];
      
      // Create consistent baseline traffic
      for (let i = 0; i < 100; i++) {
        records.push(createMockRecord({ 
          bytes: 1000 + Math.random() * 200,
          protocol: 'TCP',
          destinationPort: 80,
        }));
      }

      // First analysis establishes baseline
      const result1 = await analyzer.analyzeTrafficPatterns(records, {
        enableAnomalyDetection: true,
      });

      expect(result1.anomalies).toBeDefined();
      expect(result1.anomalies!.baseline).toBeDefined();

      // Second analysis should use established baseline
      const anomalousRecords = [
        ...records,
        createMockRecord({ bytes: 50000 }), // Anomalous traffic
      ];

      const result2 = await analyzer.analyzeTrafficPatterns(anomalousRecords, {
        enableAnomalyDetection: true,
      });

      expect(result2.anomalies).toBeDefined();
      expect(result2.anomalies!.anomalies.length).toBeGreaterThan(0);
    });
  });
});