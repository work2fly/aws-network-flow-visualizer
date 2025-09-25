import {
  FlowLogRecordValidator,
  TrafficStatisticsCalculator,
  NetworkNodeFactory,
  NetworkEdgeFactory,
} from '../topology-data-models';
import { FlowLogRecord, NodeType } from '../../../shared/types';

describe('FlowLogRecordValidator', () => {
  let validator: FlowLogRecordValidator;

  beforeEach(() => {
    validator = new FlowLogRecordValidator();
  });

  describe('validateRecord', () => {
    it('should validate a complete valid record', () => {
      const record: FlowLogRecord = {
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
      };

      const result = validator.validateRecord(record);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject record with missing required fields', () => {
      const record = {
        timestamp: new Date(),
        sourceIP: '10.0.1.100',
        // Missing other required fields
      };

      const result = validator.validateRecord(record);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('Missing required field'))).toBe(true);
    });

    it('should reject record with invalid IP addresses', () => {
      const record: Partial<FlowLogRecord> = {
        timestamp: new Date(),
        sourceIP: 'invalid-ip',
        destinationIP: '10.0.2.200',
        sourcePort: 12345,
        destinationPort: 80,
        protocol: 'TCP',
        action: 'ACCEPT',
        bytes: 1024,
        packets: 10,
      };

      const result = validator.validateRecord(record);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid source IP address'))).toBe(true);
    });

    it('should reject record with invalid ports', () => {
      const record: Partial<FlowLogRecord> = {
        timestamp: new Date(),
        sourceIP: '10.0.1.100',
        destinationIP: '10.0.2.200',
        sourcePort: -1,
        destinationPort: 70000,
        protocol: 'TCP',
        action: 'ACCEPT',
        bytes: 1024,
        packets: 10,
      };

      const result = validator.validateRecord(record);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid source port'))).toBe(true);
      expect(result.errors.some(e => e.includes('Invalid destination port'))).toBe(true);
    });

    it('should warn about unusual protocols', () => {
      const record: Partial<FlowLogRecord> = {
        timestamp: new Date(),
        sourceIP: '10.0.1.100',
        destinationIP: '10.0.2.200',
        sourcePort: 12345,
        destinationPort: 80,
        protocol: 'CUSTOM',
        action: 'ACCEPT',
        bytes: 1024,
        packets: 10,
      };

      const result = validator.validateRecord(record);
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes('Unusual protocol'))).toBe(true);
    });
  });

  describe('validateBatch', () => {
    it('should validate a batch of records', () => {
      const records: Partial<FlowLogRecord>[] = [
        {
          timestamp: new Date(),
          sourceIP: '10.0.1.100',
          destinationIP: '10.0.2.200',
          sourcePort: 12345,
          destinationPort: 80,
          protocol: 'TCP',
          action: 'ACCEPT',
          bytes: 1024,
          packets: 10,
        },
        {
          timestamp: new Date(),
          sourceIP: 'invalid-ip',
          destinationIP: '10.0.2.200',
          sourcePort: 12345,
          destinationPort: 80,
          protocol: 'TCP',
          action: 'ACCEPT',
          bytes: 1024,
          packets: 10,
        },
      ];

      const result = validator.validateBatch(records);
      expect(result.summary.total).toBe(2);
      expect(result.summary.valid).toBe(1);
      expect(result.summary.invalid).toBe(1);
      expect(result.validRecords).toHaveLength(1);
      expect(result.invalidRecords).toHaveLength(1);
    });
  });
});

describe('TrafficStatisticsCalculator', () => {
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
    ...overrides,
  });

  describe('calculateTrafficStatistics', () => {
    it('should calculate basic statistics for empty records', () => {
      const stats = TrafficStatisticsCalculator.calculateTrafficStatistics([]);
      expect(stats.totalBytes).toBe(0);
      expect(stats.totalPackets).toBe(0);
      expect(stats.acceptedConnections).toBe(0);
      expect(stats.rejectedConnections).toBe(0);
    });

    it('should calculate statistics for single record', () => {
      const record = createMockRecord();
      const stats = TrafficStatisticsCalculator.calculateTrafficStatistics([record]);

      expect(stats.totalBytes).toBe(1024);
      expect(stats.totalPackets).toBe(10);
      expect(stats.acceptedConnections).toBe(1);
      expect(stats.rejectedConnections).toBe(0);
      expect(stats.uniqueSourceIPs).toBe(1);
      expect(stats.uniqueDestinationIPs).toBe(1);
    });

    it('should calculate statistics for multiple records', () => {
      const records = [
        createMockRecord({ bytes: 1000, packets: 5, action: 'ACCEPT' }),
        createMockRecord({ bytes: 2000, packets: 15, action: 'REJECT', sourceIP: '10.0.1.101' }),
        createMockRecord({ bytes: 500, packets: 3, action: 'ACCEPT', destinationIP: '10.0.2.201' }),
      ];

      const stats = TrafficStatisticsCalculator.calculateTrafficStatistics(records);

      expect(stats.totalBytes).toBe(3500);
      expect(stats.totalPackets).toBe(23);
      expect(stats.acceptedConnections).toBe(2);
      expect(stats.rejectedConnections).toBe(1);
      expect(stats.uniqueSourceIPs).toBe(2);
      expect(stats.uniqueDestinationIPs).toBe(2);
    });

    it('should calculate time-based metrics', () => {
      const now = new Date();
      const oneSecondLater = new Date(now.getTime() + 1000);

      const records = [
        createMockRecord({ timestamp: now, bytes: 1000 }),
        createMockRecord({ timestamp: oneSecondLater, bytes: 2000 }),
      ];

      const stats = TrafficStatisticsCalculator.calculateTrafficStatistics(records);

      expect(stats.bytesPerSecond).toBeCloseTo(3000, 0);
      expect(stats.connectionsPerSecond).toBeCloseTo(2, 0);
      expect(stats.averagePacketSize).toBe(150); // 3000 bytes / 20 packets
    });

    it('should identify unusual ports', () => {
      const records = [
        createMockRecord({ destinationPort: 80 }), // Common port
        createMockRecord({ destinationPort: 50000 }), // Unusual port
        createMockRecord({ destinationPort: 60000 }), // Unusual port
      ];

      const stats = TrafficStatisticsCalculator.calculateTrafficStatistics(records);

      expect(stats.unusualPorts).toContain(50000);
      expect(stats.unusualPorts).toContain(60000);
      expect(stats.unusualPorts).not.toContain(80);
    });
  });

  describe('calculateEdgeTrafficStatistics', () => {
    it('should calculate directional statistics', () => {
      const records = [
        createMockRecord({ sourceIP: '10.0.1.100', destinationIP: '10.0.2.200', bytes: 1000 }),
        createMockRecord({ sourceIP: '10.0.2.200', destinationIP: '10.0.1.100', bytes: 500 }),
      ];

      const stats = TrafficStatisticsCalculator.calculateEdgeTrafficStatistics(
        records,
        'node1',
        'node2'
      );

      expect(stats.totalBytes).toBe(1500);
      expect(stats.averageBytesPerConnection).toBe(750);
      expect(stats.peakTrafficTime).toBeInstanceOf(Date);
    });
  });
});

describe('NetworkNodeFactory', () => {
  describe('createNode', () => {
    it('should create a basic network node', () => {
      const node = NetworkNodeFactory.createNode('test-id', 'vpc', { name: 'Test VPC' });

      expect(node.id).toBe('test-id');
      expect(node.type).toBe('vpc');
      expect(node.properties.name).toBe('Test VPC');
      expect(node.metadata.isActive).toBe(true);
      expect(node.metadata.confidence).toBe(1.0);
    });

    it('should generate appropriate labels', () => {
      const vpcNode = NetworkNodeFactory.createVPCNode(
        'vpc-12345',
        '10.0.0.0/16',
        'us-east-1',
        '123456789012'
      );

      expect(vpcNode.label).toContain('VPC vpc-12345');
      expect(vpcNode.label).toContain('10.0.0.0/16');
    });
  });

  describe('createVPCNode', () => {
    it('should create a VPC node with correct properties', () => {
      const node = NetworkNodeFactory.createVPCNode(
        'vpc-12345',
        '10.0.0.0/16',
        'us-east-1',
        '123456789012'
      );

      expect(node.type).toBe('vpc');
      expect(node.properties.cidrBlock).toBe('10.0.0.0/16');
      expect(node.properties.region).toBe('us-east-1');
      expect(node.properties.accountId).toBe('123456789012');
    });
  });

  describe('createSubnetNode', () => {
    it('should create a subnet node with correct properties', () => {
      const node = NetworkNodeFactory.createSubnetNode(
        'subnet-12345',
        '10.0.1.0/24',
        'vpc-12345',
        'us-east-1a',
        'private'
      );

      expect(node.type).toBe('subnet');
      expect(node.properties.cidrBlock).toBe('10.0.1.0/24');
      expect(node.properties.availabilityZone).toBe('us-east-1a');
      expect(node.properties.subnetType).toBe('private');
    });
  });

  describe('createInstanceNode', () => {
    it('should create an instance node with correct properties', () => {
      const node = NetworkNodeFactory.createInstanceNode(
        'i-12345',
        't3.micro',
        'subnet-12345',
        '10.0.1.100',
        '54.123.45.67'
      );

      expect(node.type).toBe('instance');
      expect(node.properties.instanceType).toBe('t3.micro');
      expect(node.properties.privateIpAddress).toBe('10.0.1.100');
      expect(node.properties.publicIpAddress).toBe('54.123.45.67');
    });
  });
});

describe('NetworkEdgeFactory', () => {
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
    ...overrides,
  });

  describe('createEdge', () => {
    it('should create a network edge with traffic statistics', () => {
      const records = [
        createMockRecord({ action: 'ACCEPT', bytes: 1000 }),
        createMockRecord({ action: 'REJECT', bytes: 500 }),
      ];

      const edge = NetworkEdgeFactory.createEdge('node1', 'node2', records);

      expect(edge.id).toBe('node1-node2');
      expect(edge.source).toBe('node1');
      expect(edge.target).toBe('node2');
      expect(edge.trafficStats.totalBytes).toBe(1500);
      expect(edge.trafficStats.acceptedConnections).toBe(1);
      expect(edge.trafficStats.rejectedConnections).toBe(1);
      expect(edge.properties.hasRejectedConnections).toBe(true);
      expect(edge.properties.rejectionRate).toBe(0.5);
    });

    it('should identify protocols and ports', () => {
      const records = [
        createMockRecord({ protocol: 'TCP', destinationPort: 80 }),
        createMockRecord({ protocol: 'UDP', destinationPort: 53 }),
        createMockRecord({ protocol: 'TCP', destinationPort: 443 }),
      ];

      const edge = NetworkEdgeFactory.createEdge('node1', 'node2', records);

      expect(edge.properties.protocols).toContain('TCP');
      expect(edge.properties.protocols).toContain('UDP');
      expect(edge.properties.ports).toContain(80);
      expect(edge.properties.ports).toContain(53);
      expect(edge.properties.ports).toContain(443);
    });

    it('should calculate anomaly scores', () => {
      const suspiciousRecords = [
        createMockRecord({ action: 'REJECT', destinationPort: 22 }), // Rejected SSH
        createMockRecord({ destinationPort: 50000, bytes: 2000000 }), // High port, large transfer
        createMockRecord({ timestamp: new Date('2023-01-01T02:00:00Z') }), // Off hours
      ];

      const edge = NetworkEdgeFactory.createEdge('node1', 'node2', suspiciousRecords);

      expect(edge.metadata.anomalyScore).toBeGreaterThan(0);
    });

    it('should detect bidirectional traffic', () => {
      const bidirectionalRecords = [
        createMockRecord({ sourceIP: '10.0.1.100', destinationIP: '10.0.2.200' }),
        createMockRecord({ sourceIP: '10.0.2.200', destinationIP: '10.0.1.100' }),
      ];

      const edge = NetworkEdgeFactory.createEdge('node1', 'node2', bidirectionalRecords);

      expect(edge.properties.bidirectional).toBe(true);
    });
  });
});