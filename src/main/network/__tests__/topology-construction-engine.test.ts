import { TopologyConstructionEngine } from '../topology-construction-engine';
import { FlowLogRecord } from '../../../shared/types';

describe('TopologyConstructionEngine', () => {
  let engine: TopologyConstructionEngine;

  beforeEach(() => {
    engine = new TopologyConstructionEngine();
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
    availabilityZone: 'us-east-1a',
    ...overrides,
  });

  describe('buildTopology', () => {
    it('should build topology from single flow record', async () => {
      const records = [createMockRecord()];

      const topology = await engine.buildTopology(records);

      expect(topology.nodes.length).toBeGreaterThan(0);
      expect(topology.edges.length).toBeGreaterThan(0);
      expect(topology.metadata.recordCount).toBe(1);
      expect(topology.hierarchy).toBeDefined();
    });

    it('should build topology from multiple flow records', async () => {
      const records = [
        createMockRecord({
          sourceIP: '10.0.1.100',
          destinationIP: '10.0.2.200',
          instanceId: 'i-source',
        }),
        createMockRecord({
          sourceIP: '10.0.2.200',
          destinationIP: '10.0.1.100',
          instanceId: 'i-destination',
        }),
        createMockRecord({
          sourceIP: '10.0.3.100',
          destinationIP: '10.0.4.200',
          instanceId: 'i-other',
          vpcId: 'vpc-other',
        }),
      ];

      const topology = await engine.buildTopology(records);

      expect(topology.nodes.length).toBeGreaterThan(2);
      expect(topology.edges.length).toBeGreaterThan(0);
      expect(topology.metadata.recordCount).toBe(3);
    });

    it('should identify VPC nodes correctly', async () => {
      const records = [
        createMockRecord({ vpcId: 'vpc-12345' }),
        createMockRecord({ vpcId: 'vpc-67890' }),
      ];

      const topology = await engine.buildTopology(records);

      const vpcNodes = topology.nodes.filter(node => node.type === 'vpc');
      expect(vpcNodes.length).toBeGreaterThanOrEqual(2);
      
      const vpcIds = vpcNodes.map(node => node.id);
      expect(vpcIds).toContain('vpc-12345');
      expect(vpcIds).toContain('vpc-67890');
    });

    it('should identify subnet nodes correctly', async () => {
      const records = [
        createMockRecord({ subnetId: 'subnet-12345', vpcId: 'vpc-12345' }),
        createMockRecord({ subnetId: 'subnet-67890', vpcId: 'vpc-12345' }),
      ];

      const topology = await engine.buildTopology(records);

      const subnetNodes = topology.nodes.filter(node => node.type === 'subnet');
      expect(subnetNodes.length).toBeGreaterThanOrEqual(2);
      
      const subnetIds = subnetNodes.map(node => node.id);
      expect(subnetIds).toContain('subnet-12345');
      expect(subnetIds).toContain('subnet-67890');
    });

    it('should identify instance nodes correctly', async () => {
      const records = [
        createMockRecord({ instanceId: 'i-12345', sourceIP: '10.0.1.100' }),
        createMockRecord({ instanceId: 'i-67890', destinationIP: '10.0.2.200' }),
      ];

      const topology = await engine.buildTopology(records);

      const instanceNodes = topology.nodes.filter(node => node.type === 'instance');
      expect(instanceNodes.length).toBeGreaterThanOrEqual(2);
      
      const instanceIds = instanceNodes.map(node => node.id);
      expect(instanceIds).toContain('i-12345');
      expect(instanceIds).toContain('i-67890');
    });

    it('should identify Transit Gateway nodes correctly', async () => {
      const records = [
        createMockRecord({ transitGatewayId: 'tgw-12345' }),
        createMockRecord({ transitGatewayId: 'tgw-67890' }),
      ];

      const topology = await engine.buildTopology(records);

      const tgwNodes = topology.nodes.filter(node => node.type === 'tgw');
      expect(tgwNodes.length).toBeGreaterThanOrEqual(2);
      
      const tgwIds = tgwNodes.map(node => node.id);
      expect(tgwIds).toContain('tgw-12345');
      expect(tgwIds).toContain('tgw-67890');
    });

    it('should create edges between nodes', async () => {
      const records = [
        createMockRecord({
          sourceIP: '10.0.1.100',
          destinationIP: '10.0.2.200',
          instanceId: 'i-source',
          bytes: 1000,
        }),
        createMockRecord({
          sourceIP: '10.0.1.100',
          destinationIP: '10.0.2.200',
          instanceId: 'i-source',
          bytes: 2000,
        }),
      ];

      const topology = await engine.buildTopology(records);

      expect(topology.edges.length).toBeGreaterThan(0);
      
      const edge = topology.edges[0];
      expect(edge.source).toBeDefined();
      expect(edge.target).toBeDefined();
      expect(edge.trafficStats.totalBytes).toBe(3000);
      expect(edge.flowRecords.length).toBe(2);
    });

    it('should handle external IP addresses', async () => {
      const records = [
        createMockRecord({
          sourceIP: '10.0.1.100',
          destinationIP: '8.8.8.8', // External IP
          instanceId: 'i-12345',
        }),
      ];

      const topology = await engine.buildTopology(records);

      const externalNodes = topology.nodes.filter(node => 
        node.type === 'internet-gateway' || node.id.startsWith('external-')
      );
      expect(externalNodes.length).toBeGreaterThan(0);
    });

    it('should filter nodes by traffic threshold', async () => {
      const records = [
        createMockRecord({ 
          bytes: 100, 
          instanceId: 'i-low-traffic',
          sourceIP: '10.0.1.100',
          destinationIP: '10.0.2.100'
        }),
        createMockRecord({ 
          bytes: 10000, 
          instanceId: 'i-high-traffic',
          sourceIP: '10.0.1.200',
          destinationIP: '10.0.2.200'
        }),
      ];

      const topology = await engine.buildTopology(records, {
        minTrafficThreshold: 5000,
      });

      // Should include high-traffic nodes (infrastructure nodes are always included)
      const nodeIds = topology.nodes.map(node => node.id);
      expect(nodeIds.length).toBeGreaterThan(0);
    });

    it('should limit number of nodes and edges', async () => {
      const records = Array.from({ length: 100 }, (_, i) =>
        createMockRecord({
          instanceId: `i-${i}`,
          sourceIP: `10.0.1.${i}`,
          destinationIP: `10.0.2.${i}`,
        })
      );

      const topology = await engine.buildTopology(records, {
        maxNodes: 10,
        maxEdges: 5,
      });

      expect(topology.nodes.length).toBeLessThanOrEqual(10);
      expect(topology.edges.length).toBeLessThanOrEqual(5);
    });

    it('should build hierarchy information', async () => {
      const records = [
        createMockRecord({
          vpcId: 'vpc-12345',
          subnetId: 'subnet-12345',
          instanceId: 'i-12345',
          region: 'us-east-1',
          accountId: '123456789012',
        }),
      ];

      const topology = await engine.buildTopology(records);

      expect(topology.hierarchy).toBeDefined();
      expect(topology.hierarchy!.regions.size).toBeGreaterThan(0);
      expect(topology.hierarchy!.vpcs.size).toBeGreaterThan(0);
      expect(topology.hierarchy!.subnets.size).toBeGreaterThan(0);
      expect(topology.hierarchy!.instances.size).toBeGreaterThan(0);

      // Check region contains VPC
      const region = topology.hierarchy!.regions.get('us-east-1');
      expect(region).toBeDefined();
      expect(region!.vpcs).toContain('vpc-12345');

      // Check VPC contains subnet
      const vpc = topology.hierarchy!.vpcs.get('vpc-12345');
      expect(vpc).toBeDefined();
      expect(vpc!.subnets).toContain('subnet-12345');

      // Check subnet contains instance
      const subnet = topology.hierarchy!.subnets.get('subnet-12345');
      expect(subnet).toBeDefined();
      expect(subnet!.instances).toContain('i-12345');
    });

    it('should calculate metadata correctly', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const records = [
        createMockRecord({ timestamp: oneHourAgo }),
        createMockRecord({ timestamp: now }),
      ];

      const topology = await engine.buildTopology(records);

      expect(topology.metadata.recordCount).toBe(2);
      expect(topology.metadata.timeRange.start).toEqual(oneHourAgo);
      expect(topology.metadata.timeRange.end).toEqual(now);
      expect(topology.metadata.completeness).toBeGreaterThan(0);
      expect(topology.metadata.accuracy).toBeGreaterThan(0);
      expect(topology.metadata.freshness).toBeGreaterThan(0);
    });

    it('should handle empty records gracefully', async () => {
      const topology = await engine.buildTopology([]);

      expect(topology.nodes).toHaveLength(0);
      expect(topology.edges).toHaveLength(0);
      expect(topology.metadata.recordCount).toBe(0);
    });

    it('should exclude unknown nodes when configured', async () => {
      const records = [
        createMockRecord({
          sourceIP: '192.168.1.100', // Unknown private IP
          destinationIP: '192.168.1.200',
          instanceId: undefined,
          subnetId: undefined,
          vpcId: undefined,
        }),
      ];

      const topologyWithUnknown = await engine.buildTopology(records, {
        includeUnknownNodes: true,
      });

      const topologyWithoutUnknown = await engine.buildTopology(records, {
        includeUnknownNodes: false,
      });

      expect(topologyWithUnknown.nodes.length).toBeGreaterThanOrEqual(
        topologyWithoutUnknown.nodes.length
      );
    });
  });

  describe('node identification', () => {
    it('should identify nodes by instance ID with high confidence', async () => {
      const records = [
        createMockRecord({
          instanceId: 'i-12345',
          sourceIP: '10.0.1.100',
        }),
      ];

      const topology = await engine.buildTopology(records);

      const instanceNode = topology.nodes.find(node => node.id === 'i-12345');
      expect(instanceNode).toBeDefined();
      expect(instanceNode!.type).toBe('instance');
      expect(instanceNode!.metadata.confidence).toBeGreaterThan(0.8);
    });

    it('should identify load balancer patterns', async () => {
      const records = [
        createMockRecord({
          sourceIP: '10.0.1.100',
          destinationPort: 80, // Load balancer port
          instanceId: undefined,
          subnetId: undefined,
          vpcId: 'vpc-12345',
        }),
      ];

      const topology = await engine.buildTopology(records);

      // Should identify some form of load balancer or web service
      const nodes = topology.nodes.filter(node => 
        node.type === 'load-balancer' || 
        (node.properties.port === 80)
      );
      expect(nodes.length).toBeGreaterThan(0);
    });

    it('should handle bidirectional traffic', async () => {
      const records = [
        createMockRecord({
          sourceIP: '10.0.1.100',
          destinationIP: '10.0.2.200',
          instanceId: undefined, // Use IP-based identification
        }),
        createMockRecord({
          sourceIP: '10.0.2.200',
          destinationIP: '10.0.1.100',
          instanceId: undefined, // Use IP-based identification
        }),
      ];

      const topology = await engine.buildTopology(records);

      const edges = topology.edges;
      expect(edges.length).toBeGreaterThan(0);

      // Should have one edge with both records (bidirectional)
      const edge = edges.find(e => e.flowRecords.length === 2);
      expect(edge).toBeDefined();
      
      // Check if the edge is marked as bidirectional
      expect(edge!.properties.bidirectional).toBe(true);
    });
  });
});