import { FlowLogProcessor } from '../flow-log-processor';
import { FlowLogRecord } from '../../../shared/types';

describe('FlowLogProcessor', () => {
  const mockFlowLogRecords: FlowLogRecord[] = [
    {
      timestamp: new Date('2023-01-01T00:00:00Z'),
      sourceIP: '192.168.1.1',
      destinationIP: '10.0.0.1',
      sourcePort: 12345,
      destinationPort: 80,
      protocol: 'tcp',
      action: 'ACCEPT',
      bytes: 1500,
      packets: 10,
      accountId: '123456789012',
      vpcId: 'vpc-12345678',
    },
    {
      timestamp: new Date('2023-01-01T00:01:00Z'),
      sourceIP: '192.168.1.2',
      destinationIP: '10.0.0.2',
      sourcePort: 54321,
      destinationPort: 443,
      protocol: 'tcp',
      action: 'ACCEPT',
      bytes: 2500,
      packets: 15,
      accountId: '123456789012',
      vpcId: 'vpc-12345678',
    },
    {
      timestamp: new Date('2023-01-01T00:02:00Z'),
      sourceIP: '192.168.1.3',
      destinationIP: '10.0.0.3',
      sourcePort: 11111,
      destinationPort: 22,
      protocol: 'tcp',
      action: 'REJECT',
      bytes: 0,
      packets: 1,
      accountId: '123456789012',
      vpcId: 'vpc-12345678',
    },
    {
      timestamp: new Date('2023-01-01T00:03:00Z'),
      sourceIP: '192.168.1.1',
      destinationIP: '10.0.0.4',
      sourcePort: 12346,
      destinationPort: 53,
      protocol: 'udp',
      action: 'ACCEPT',
      bytes: 512,
      packets: 2,
      accountId: '123456789012',
      vpcId: 'vpc-12345678',
    },
  ];

  describe('processFlowLogs', () => {
    it('should process flow logs and generate basic statistics', () => {
      const result = FlowLogProcessor.processFlowLogs(mockFlowLogRecords);

      expect(result.records).toHaveLength(4);
      expect(result.statistics.totalBytes).toBe(4512);
      expect(result.statistics.totalPackets).toBe(28);
      expect(result.statistics.acceptedConnections).toBe(3);
      expect(result.statistics.rejectedConnections).toBe(1);
      expect(result.statistics.uniqueSourceIPs).toBe(3);
      expect(result.statistics.uniqueDestinationIPs).toBe(4);
    });

    it('should exclude rejected connections when specified', () => {
      const result = FlowLogProcessor.processFlowLogs(mockFlowLogRecords, {
        includeRejectedConnections: false,
      });

      expect(result.records).toHaveLength(3);
      expect(result.statistics.rejectedConnections).toBe(0);
      expect(result.statistics.acceptedConnections).toBe(3);
    });

    it('should limit records when maxRecords is specified', () => {
      const result = FlowLogProcessor.processFlowLogs(mockFlowLogRecords, {
        maxRecords: 2,
      });

      expect(result.records).toHaveLength(2);
    });

    it('should generate time series data when requested', () => {
      const result = FlowLogProcessor.processFlowLogs(mockFlowLogRecords, {
        aggregateByTime: true,
        timeWindowMs: 60000, // 1 minute
      });

      expect(result.timeSeriesData).toBeDefined();
      expect(result.timeSeriesData!.length).toBeGreaterThan(0);
      expect(result.timeSeriesData![0]).toHaveProperty('timestamp');
      expect(result.timeSeriesData![0]).toHaveProperty('totalBytes');
      expect(result.timeSeriesData![0]).toHaveProperty('totalPackets');
    });

    it('should generate top source and destination IPs', () => {
      const result = FlowLogProcessor.processFlowLogs(mockFlowLogRecords);

      expect(result.topSourceIPs).toBeDefined();
      expect(result.topSourceIPs!.length).toBeGreaterThan(0);
      expect(result.topSourceIPs![0]).toHaveProperty('ip');
      expect(result.topSourceIPs![0]).toHaveProperty('bytes');
      expect(result.topSourceIPs![0]).toHaveProperty('connections');

      expect(result.topDestinationIPs).toBeDefined();
      expect(result.topDestinationIPs!.length).toBeGreaterThan(0);
      expect(result.topDestinationIPs![0]).toHaveProperty('ip');
      expect(result.topDestinationIPs![0]).toHaveProperty('bytes');
    });

    it('should generate protocol distribution', () => {
      const result = FlowLogProcessor.processFlowLogs(mockFlowLogRecords);

      expect(result.protocolDistribution).toBeDefined();
      expect(result.protocolDistribution!.length).toBeGreaterThan(0);
      expect(result.protocolDistribution![0]).toHaveProperty('protocol');
      expect(result.protocolDistribution![0]).toHaveProperty('percentage');
    });
  });

  describe('calculateTrafficStatistics', () => {
    it('should calculate correct statistics for empty records', () => {
      const stats = FlowLogProcessor.calculateTrafficStatistics([]);

      expect(stats.totalBytes).toBe(0);
      expect(stats.totalPackets).toBe(0);
      expect(stats.acceptedConnections).toBe(0);
      expect(stats.rejectedConnections).toBe(0);
      expect(stats.uniqueSourceIPs).toBe(0);
      expect(stats.uniqueDestinationIPs).toBe(0);
      expect(stats.topPorts).toHaveLength(0);
    });

    it('should calculate correct statistics for sample records', () => {
      const stats = FlowLogProcessor.calculateTrafficStatistics(mockFlowLogRecords);

      expect(stats.totalBytes).toBe(4512);
      expect(stats.totalPackets).toBe(28);
      expect(stats.acceptedConnections).toBe(3);
      expect(stats.rejectedConnections).toBe(1);
      expect(stats.uniqueSourceIPs).toBe(3);
      expect(stats.uniqueDestinationIPs).toBe(4);
      expect(stats.topPorts.length).toBeGreaterThan(0);
      expect(stats.timeRange.start).toEqual(new Date('2023-01-01T00:00:00Z'));
      expect(stats.timeRange.end).toEqual(new Date('2023-01-01T00:03:00Z'));
    });

    it('should sort top ports by connection count', () => {
      const stats = FlowLogProcessor.calculateTrafficStatistics(mockFlowLogRecords);

      expect(stats.topPorts).toBeDefined();
      if (stats.topPorts.length > 1) {
        expect(stats.topPorts[0].connections).toBeGreaterThanOrEqual(stats.topPorts[1].connections);
      }
    });
  });

  describe('generateTimeSeriesData', () => {
    it('should generate time series data with correct time windows', () => {
      const timeSeriesData = FlowLogProcessor.generateTimeSeriesData(mockFlowLogRecords, 60000); // 1 minute

      expect(timeSeriesData.length).toBeGreaterThan(0);
      expect(timeSeriesData[0]).toHaveProperty('timestamp');
      expect(timeSeriesData[0]).toHaveProperty('totalBytes');
      expect(timeSeriesData[0]).toHaveProperty('totalPackets');
      expect(timeSeriesData[0]).toHaveProperty('acceptedConnections');
      expect(timeSeriesData[0]).toHaveProperty('rejectedConnections');
    });

    it('should return empty array for empty records', () => {
      const timeSeriesData = FlowLogProcessor.generateTimeSeriesData([], 60000);

      expect(timeSeriesData).toHaveLength(0);
    });

    it('should sort time series data by timestamp', () => {
      const timeSeriesData = FlowLogProcessor.generateTimeSeriesData(mockFlowLogRecords, 60000);

      for (let i = 1; i < timeSeriesData.length; i++) {
        expect(timeSeriesData[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          timeSeriesData[i - 1].timestamp.getTime()
        );
      }
    });
  });

  describe('getTopSourceIPs', () => {
    it('should return top source IPs sorted by bytes', () => {
      const topIPs = FlowLogProcessor.getTopSourceIPs(mockFlowLogRecords, 5);

      expect(topIPs.length).toBeGreaterThan(0);
      expect(topIPs.length).toBeLessThanOrEqual(5);
      
      for (let i = 1; i < topIPs.length; i++) {
        expect(topIPs[i].bytes).toBeLessThanOrEqual(topIPs[i - 1].bytes);
      }
    });

    it('should include unique destination count', () => {
      const topIPs = FlowLogProcessor.getTopSourceIPs(mockFlowLogRecords, 5);

      expect(topIPs[0]).toHaveProperty('uniqueDestinations');
      expect(typeof topIPs[0].uniqueDestinations).toBe('number');
    });
  });

  describe('getTopDestinationIPs', () => {
    it('should return top destination IPs sorted by bytes', () => {
      const topIPs = FlowLogProcessor.getTopDestinationIPs(mockFlowLogRecords, 5);

      expect(topIPs.length).toBeGreaterThan(0);
      expect(topIPs.length).toBeLessThanOrEqual(5);
      
      for (let i = 1; i < topIPs.length; i++) {
        expect(topIPs[i].bytes).toBeLessThanOrEqual(topIPs[i - 1].bytes);
      }
    });

    it('should include unique source count', () => {
      const topIPs = FlowLogProcessor.getTopDestinationIPs(mockFlowLogRecords, 5);

      expect(topIPs[0]).toHaveProperty('uniqueSources');
      expect(typeof topIPs[0].uniqueSources).toBe('number');
    });
  });

  describe('getProtocolDistribution', () => {
    it('should return protocol distribution with percentages', () => {
      const distribution = FlowLogProcessor.getProtocolDistribution(mockFlowLogRecords);

      expect(distribution.length).toBeGreaterThan(0);
      
      let totalPercentage = 0;
      for (const protocol of distribution) {
        expect(protocol).toHaveProperty('protocol');
        expect(protocol).toHaveProperty('percentage');
        expect(protocol.percentage).toBeGreaterThanOrEqual(0);
        expect(protocol.percentage).toBeLessThanOrEqual(100);
        totalPercentage += protocol.percentage;
      }
      
      expect(totalPercentage).toBeCloseTo(100, 1);
    });

    it('should sort protocols by bytes', () => {
      const distribution = FlowLogProcessor.getProtocolDistribution(mockFlowLogRecords);

      for (let i = 1; i < distribution.length; i++) {
        expect(distribution[i].bytes).toBeLessThanOrEqual(distribution[i - 1].bytes);
      }
    });
  });

  describe('detectAnomalies', () => {
    it('should detect unusual ports', () => {
      const anomalies = FlowLogProcessor.detectAnomalies(mockFlowLogRecords);

      expect(anomalies).toHaveProperty('unusualPorts');
      expect(anomalies).toHaveProperty('highVolumeConnections');
      expect(anomalies).toHaveProperty('suspiciousRejections');
    });

    it('should identify high volume connections', () => {
      const anomalies = FlowLogProcessor.detectAnomalies(mockFlowLogRecords);

      expect(anomalies.highVolumeConnections.length).toBeGreaterThan(0);
      
      // Should be sorted by bytes (highest first)
      for (let i = 1; i < anomalies.highVolumeConnections.length; i++) {
        expect(anomalies.highVolumeConnections[i].bytes).toBeLessThanOrEqual(
          anomalies.highVolumeConnections[i - 1].bytes
        );
      }
    });

    it('should identify suspicious rejections', () => {
      const anomalies = FlowLogProcessor.detectAnomalies(mockFlowLogRecords);

      for (const rejection of anomalies.suspiciousRejections) {
        expect(rejection.action).toBe('REJECT');
        expect([22, 23, 25, 53, 80, 110, 143, 443, 993, 995]).toContain(rejection.destinationPort);
      }
    });
  });

  describe('filterRecords', () => {
    it('should filter by source IPs', () => {
      const filtered = FlowLogProcessor.filterRecords(mockFlowLogRecords, {
        sourceIPs: ['192.168.1.1'],
      });

      expect(filtered.length).toBeGreaterThan(0);
      for (const record of filtered) {
        expect(record.sourceIP).toBe('192.168.1.1');
      }
    });

    it('should filter by destination IPs', () => {
      const filtered = FlowLogProcessor.filterRecords(mockFlowLogRecords, {
        destinationIPs: ['10.0.0.1'],
      });

      expect(filtered.length).toBeGreaterThan(0);
      for (const record of filtered) {
        expect(record.destinationIP).toBe('10.0.0.1');
      }
    });

    it('should filter by ports', () => {
      const filtered = FlowLogProcessor.filterRecords(mockFlowLogRecords, {
        ports: [80, 443],
      });

      expect(filtered.length).toBeGreaterThan(0);
      for (const record of filtered) {
        expect([80, 443]).toContain(record.destinationPort);
      }
    });

    it('should filter by protocols', () => {
      const filtered = FlowLogProcessor.filterRecords(mockFlowLogRecords, {
        protocols: ['tcp'],
      });

      expect(filtered.length).toBeGreaterThan(0);
      for (const record of filtered) {
        expect(record.protocol).toBe('tcp');
      }
    });

    it('should filter by actions', () => {
      const filtered = FlowLogProcessor.filterRecords(mockFlowLogRecords, {
        actions: ['ACCEPT'],
      });

      expect(filtered.length).toBeGreaterThan(0);
      for (const record of filtered) {
        expect(record.action).toBe('ACCEPT');
      }
    });

    it('should filter by time range', () => {
      const filtered = FlowLogProcessor.filterRecords(mockFlowLogRecords, {
        timeRange: {
          start: new Date('2023-01-01T00:01:00Z'),
          end: new Date('2023-01-01T00:02:00Z'),
        },
      });

      expect(filtered.length).toBeGreaterThan(0);
      for (const record of filtered) {
        expect(record.timestamp.getTime()).toBeGreaterThanOrEqual(new Date('2023-01-01T00:01:00Z').getTime());
        expect(record.timestamp.getTime()).toBeLessThanOrEqual(new Date('2023-01-01T00:02:00Z').getTime());
      }
    });

    it('should filter by byte range', () => {
      const filtered = FlowLogProcessor.filterRecords(mockFlowLogRecords, {
        minBytes: 1000,
        maxBytes: 2000,
      });

      expect(filtered.length).toBeGreaterThan(0);
      for (const record of filtered) {
        expect(record.bytes).toBeGreaterThanOrEqual(1000);
        expect(record.bytes).toBeLessThanOrEqual(2000);
      }
    });

    it('should combine multiple filters', () => {
      const filtered = FlowLogProcessor.filterRecords(mockFlowLogRecords, {
        protocols: ['tcp'],
        actions: ['ACCEPT'],
        minBytes: 1000,
      });

      for (const record of filtered) {
        expect(record.protocol).toBe('tcp');
        expect(record.action).toBe('ACCEPT');
        expect(record.bytes).toBeGreaterThanOrEqual(1000);
      }
    });
  });

  describe('exportToCSV', () => {
    it('should export records to CSV format', () => {
      const csv = FlowLogProcessor.exportToCSV(mockFlowLogRecords);

      expect(csv).toContain('timestamp,sourceIP,destinationIP');
      expect(csv).toContain('192.168.1.1,10.0.0.1');
      expect(csv).toContain('ACCEPT');
      expect(csv).toContain('tcp');
    });

    it('should return empty string for empty records', () => {
      const csv = FlowLogProcessor.exportToCSV([]);

      expect(csv).toBe('');
    });

    it('should include all required columns', () => {
      const csv = FlowLogProcessor.exportToCSV(mockFlowLogRecords);
      const lines = csv.split('\n');
      const headers = lines[0].split(',');

      expect(headers).toContain('timestamp');
      expect(headers).toContain('sourceIP');
      expect(headers).toContain('destinationIP');
      expect(headers).toContain('sourcePort');
      expect(headers).toContain('destinationPort');
      expect(headers).toContain('protocol');
      expect(headers).toContain('action');
      expect(headers).toContain('bytes');
      expect(headers).toContain('packets');
    });
  });
});