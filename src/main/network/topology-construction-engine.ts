import {
  FlowLogRecord,
  NetworkNode,
  NetworkEdge,
  NetworkTopology,
  NodeType,
  TopologyMetadata,
  TopologyHierarchy,
  RegionInfo,
  VPCInfo,
  SubnetInfo,
  InstanceInfo,
} from '../../shared/types';
import {
  NetworkNodeFactory,
  NetworkEdgeFactory,
  TrafficStatisticsCalculator,
} from './topology-data-models';

export interface TopologyConstructionOptions {
  includeUnknownNodes?: boolean;
  aggregateTraffic?: boolean;
  timeWindowMs?: number;
  minTrafficThreshold?: number;
  maxNodes?: number;
  maxEdges?: number;
}

export interface NodeIdentificationResult {
  nodeId: string;
  nodeType: NodeType;
  confidence: number;
  properties: Record<string, unknown>;
}

/**
 * Network Topology Construction Engine
 * Builds network topology graphs from flow log data
 */
export class TopologyConstructionEngine {
  private nodeCache = new Map<string, NetworkNode>();
  private edgeCache = new Map<string, NetworkEdge>();
  private flowRecordsByEdge = new Map<string, FlowLogRecord[]>();

  /**
   * Build network topology from flow log records
   */
  async buildTopology(
    records: FlowLogRecord[],
    options: TopologyConstructionOptions = {}
  ): Promise<NetworkTopology> {
    const {
      includeUnknownNodes = true,
      aggregateTraffic = true,
      timeWindowMs = 300000, // 5 minutes
      minTrafficThreshold = 0,
      maxNodes = 1000,
      maxEdges = 5000,
    } = options;

    // Clear caches
    this.nodeCache.clear();
    this.edgeCache.clear();
    this.flowRecordsByEdge.clear();

    // Step 1: Identify and create nodes
    const nodeIdentificationResults = await this.identifyNodes(records);
    const nodes = this.createNodesFromIdentification(nodeIdentificationResults, includeUnknownNodes);

    // Step 2: Create edges from flow records
    const edges = this.createEdgesFromFlowRecords(records, aggregateTraffic);

    // Step 3: Filter based on thresholds and limits
    const filteredNodes = this.filterNodesByTraffic(nodes, minTrafficThreshold, maxNodes);
    const filteredEdges = this.filterEdgesByTraffic(edges, minTrafficThreshold, maxEdges);

    // Step 4: Build hierarchy information
    const hierarchy = this.buildTopologyHierarchy(filteredNodes, records);

    // Step 5: Create metadata
    const metadata = this.createTopologyMetadata(records, filteredNodes.length, filteredEdges.length);

    return {
      nodes: filteredNodes,
      edges: filteredEdges,
      metadata,
      hierarchy,
    };
  }

  /**
   * Identify nodes from flow log records
   */
  private async identifyNodes(records: FlowLogRecord[]): Promise<NodeIdentificationResult[]> {
    const nodeIdentifications = new Map<string, NodeIdentificationResult>();

    for (const record of records) {
      // Always create nodes for source and destination IPs
      const sourceIpNode = this.createNodeFromIP(record.sourceIP, record.sourcePort, record, 'source');
      if (sourceIpNode) {
        nodeIdentifications.set(sourceIpNode.nodeId, sourceIpNode);
      }

      const destinationIpNode = this.createNodeFromIP(record.destinationIP, record.destinationPort, record, 'destination');
      if (destinationIpNode) {
        nodeIdentifications.set(destinationIpNode.nodeId, destinationIpNode);
      }

      // Identify source node (may override IP-based node with more specific info)
      const sourceNode = this.identifyNodeFromRecord(record, 'source');
      if (sourceNode) {
        nodeIdentifications.set(sourceNode.nodeId, sourceNode);
      }

      // Identify destination node (may override IP-based node with more specific info)
      const destinationNode = this.identifyNodeFromRecord(record, 'destination');
      if (destinationNode) {
        nodeIdentifications.set(destinationNode.nodeId, destinationNode);
      }

      // Identify infrastructure nodes (VPC, subnet, TGW, etc.)
      const infrastructureNodes = this.identifyInfrastructureNodes(record);
      for (const node of infrastructureNodes) {
        nodeIdentifications.set(node.nodeId, node);
      }
    }

    return Array.from(nodeIdentifications.values());
  }

  /**
   * Create a node from IP address
   */
  private createNodeFromIP(
    ip: string,
    port: number,
    record: FlowLogRecord,
    direction: 'source' | 'destination'
  ): NodeIdentificationResult | null {
    if (this.isPrivateIP(ip)) {
      const nodeId = `ip-${ip.replace(/\./g, '-')}`;
      
      let nodeType: NodeType = 'instance';
      let confidence = 0.6;

      if (this.isLoadBalancerPort(port)) {
        nodeType = 'load-balancer';
        confidence = 0.7;
      } else if (this.isNATGatewayPattern(ip, port)) {
        nodeType = 'nat-gateway';
        confidence = 0.8;
      }

      return {
        nodeId,
        nodeType,
        confidence,
        properties: {
          ipAddress: ip,
          port,
          vpcId: record.vpcId,
          subnetId: record.subnetId,
          accountId: record.accountId,
          region: record.region,
        },
      };
    } else {
      // External IP
      const nodeId = `external-${ip.replace(/\./g, '-')}`;
      
      return {
        nodeId,
        nodeType: 'internet-gateway',
        confidence: 0.4,
        properties: {
          ipAddress: ip,
          port,
          isExternal: true,
        },
      };
    }
  }

  /**
   * Identify a node from a flow log record
   */
  private identifyNodeFromRecord(
    record: FlowLogRecord,
    direction: 'source' | 'destination'
  ): NodeIdentificationResult | null {
    const ip = direction === 'source' ? record.sourceIP : record.destinationIP;
    const port = direction === 'source' ? record.sourcePort : record.destinationPort;

    // For instance-level identification, create separate nodes for source and destination
    if (record.instanceId && direction === 'source') {
      return {
        nodeId: record.instanceId,
        nodeType: 'instance',
        confidence: 0.9,
        properties: {
          privateIpAddress: ip,
          instanceId: record.instanceId,
          subnetId: record.subnetId,
          vpcId: record.vpcId,
          accountId: record.accountId,
          region: record.region,
        },
      };
    }

    // For destination, try to identify by IP patterns first
    if (direction === 'destination') {
      const ipBasedNode = this.identifyNodeByIP(ip, port, record);
      if (ipBasedNode) {
        return ipBasedNode;
      }
    }

    // Try to identify by subnet
    if (record.subnetId) {
      return {
        nodeId: record.subnetId,
        nodeType: 'subnet',
        confidence: 0.8,
        properties: {
          subnetId: record.subnetId,
          vpcId: record.vpcId,
          accountId: record.accountId,
          region: record.region,
        },
      };
    }

    // Try to identify by VPC
    if (record.vpcId) {
      return {
        nodeId: record.vpcId,
        nodeType: 'vpc',
        confidence: 0.7,
        properties: {
          vpcId: record.vpcId,
          accountId: record.accountId,
          region: record.region,
        },
      };
    }

    // Identify by IP address patterns
    return this.identifyNodeByIP(ip, port, record);
  }

  /**
   * Identify infrastructure nodes (VPC, TGW, etc.) from flow record
   */
  private identifyInfrastructureNodes(record: FlowLogRecord): NodeIdentificationResult[] {
    const nodes: NodeIdentificationResult[] = [];

    // VPC node
    if (record.vpcId) {
      nodes.push({
        nodeId: record.vpcId,
        nodeType: 'vpc',
        confidence: 1.0,
        properties: {
          vpcId: record.vpcId,
          accountId: record.accountId,
          region: record.region,
        },
      });
    }

    // Subnet node
    if (record.subnetId) {
      nodes.push({
        nodeId: record.subnetId,
        nodeType: 'subnet',
        confidence: 1.0,
        properties: {
          subnetId: record.subnetId,
          vpcId: record.vpcId,
          accountId: record.accountId,
          region: record.region,
          availabilityZone: record.availabilityZone,
        },
      });
    }

    // Transit Gateway node
    if (record.transitGatewayId) {
      nodes.push({
        nodeId: record.transitGatewayId,
        nodeType: 'tgw',
        confidence: 1.0,
        properties: {
          transitGatewayId: record.transitGatewayId,
          accountId: record.accountId,
          region: record.region,
        },
      });
    }

    return nodes;
  }

  /**
   * Identify node by IP address patterns
   */
  private identifyNodeByIP(
    ip: string,
    port: number,
    record: FlowLogRecord
  ): NodeIdentificationResult | null {
    // Check if it's a private IP (likely internal resource)
    if (this.isPrivateIP(ip)) {
      // Could be an instance, load balancer, or other internal resource
      const nodeId = `ip-${ip.replace(/\./g, '-')}`;
      
      // Try to determine type based on port patterns
      let nodeType: NodeType = 'unknown';
      let confidence = 0.5;

      if (this.isLoadBalancerPort(port)) {
        nodeType = 'load-balancer';
        confidence = 0.7;
      } else if (this.isNATGatewayPattern(ip, port)) {
        nodeType = 'nat-gateway';
        confidence = 0.8;
      } else {
        nodeType = 'instance';
        confidence = 0.6;
      }

      return {
        nodeId,
        nodeType,
        confidence,
        properties: {
          ipAddress: ip,
          port,
          vpcId: record.vpcId,
          subnetId: record.subnetId,
          accountId: record.accountId,
          region: record.region,
        },
      };
    } else {
      // Public IP - could be internet gateway, external service, etc.
      const nodeId = `external-${ip.replace(/\./g, '-')}`;
      
      return {
        nodeId,
        nodeType: 'internet-gateway',
        confidence: 0.4,
        properties: {
          ipAddress: ip,
          port,
          isExternal: true,
        },
      };
    }
  }

  /**
   * Create nodes from identification results
   */
  private createNodesFromIdentification(
    identifications: NodeIdentificationResult[],
    includeUnknownNodes: boolean
  ): NetworkNode[] {
    const nodes: NetworkNode[] = [];

    for (const identification of identifications) {
      if (!includeUnknownNodes && identification.nodeType === 'unknown') {
        continue;
      }

      // Check if node already exists in cache
      if (this.nodeCache.has(identification.nodeId)) {
        continue;
      }

      const node = this.createNodeFromIdentification(identification);
      nodes.push(node);
      this.nodeCache.set(node.id, node);
    }

    return nodes;
  }

  /**
   * Create a node from identification result
   */
  private createNodeFromIdentification(identification: NodeIdentificationResult): NetworkNode {
    const { nodeId, nodeType, confidence, properties } = identification;

    switch (nodeType) {
      case 'vpc':
        return NetworkNodeFactory.createVPCNode(
          nodeId,
          properties.cidrBlock as string || 'unknown',
          properties.region as string || 'unknown',
          properties.accountId as string || 'unknown',
          properties
        );

      case 'subnet':
        return NetworkNodeFactory.createSubnetNode(
          nodeId,
          properties.cidrBlock as string || 'unknown',
          properties.vpcId as string || 'unknown',
          properties.availabilityZone as string || 'unknown',
          properties.subnetType as 'public' | 'private' || 'private',
          properties
        );

      case 'instance':
        return NetworkNodeFactory.createInstanceNode(
          nodeId,
          properties.instanceType as string || 'unknown',
          properties.subnetId as string || 'unknown',
          properties.privateIpAddress as string || properties.ipAddress as string || 'unknown',
          properties.publicIpAddress as string,
          properties
        );

      case 'tgw':
        return NetworkNodeFactory.createTransitGatewayNode(
          nodeId,
          properties.region as string || 'unknown',
          properties.accountId as string || 'unknown',
          properties
        );

      default:
        return NetworkNodeFactory.createNode(nodeId, nodeType, properties, { confidence });
    }
  }

  /**
   * Create edges from flow log records
   */
  private createEdgesFromFlowRecords(
    records: FlowLogRecord[],
    aggregateTraffic: boolean
  ): NetworkEdge[] {
    // Group records by source-destination pairs
    const recordsByEdge = new Map<string, FlowLogRecord[]>();

    for (const record of records) {
      const sourceNodeId = this.getNodeIdFromRecord(record, 'source');
      const destinationNodeId = this.getNodeIdFromRecord(record, 'destination');

      if (!sourceNodeId || !destinationNodeId || sourceNodeId === destinationNodeId) {
        continue;
      }

      // Create a consistent edge ID (always put smaller ID first for bidirectional detection)
      const edgeId = sourceNodeId < destinationNodeId 
        ? `${sourceNodeId}--${destinationNodeId}`
        : `${destinationNodeId}--${sourceNodeId}`;
      
      if (!recordsByEdge.has(edgeId)) {
        recordsByEdge.set(edgeId, []);
      }
      recordsByEdge.get(edgeId)!.push(record);
    }

    // Create edges from grouped records
    const edges: NetworkEdge[] = [];

    for (const [edgeId, edgeRecords] of recordsByEdge.entries()) {
      const [nodeId1, nodeId2] = edgeId.split('--');
      
      // Determine primary direction based on traffic volume
      const node1ToNode2Records = edgeRecords.filter(r => {
        const sourceId = this.getNodeIdFromRecord(r, 'source');
        return sourceId === nodeId1;
      });
      
      const node2ToNode1Records = edgeRecords.filter(r => {
        const sourceId = this.getNodeIdFromRecord(r, 'source');
        return sourceId === nodeId2;
      });

      // Use the direction with more traffic as primary
      const [sourceNodeId, targetNodeId] = node1ToNode2Records.length >= node2ToNode1Records.length
        ? [nodeId1, nodeId2]
        : [nodeId2, nodeId1];
      
      const edge = NetworkEdgeFactory.createEdge(
        sourceNodeId,
        targetNodeId,
        edgeRecords
      );

      edges.push(edge);
      this.edgeCache.set(edgeId, edge);
      this.flowRecordsByEdge.set(edgeId, edgeRecords);
    }

    return edges;
  }

  /**
   * Get node ID from flow record based on direction
   */
  private getNodeIdFromRecord(record: FlowLogRecord, direction: 'source' | 'destination'): string | null {
    const ip = direction === 'source' ? record.sourceIP : record.destinationIP;

    // For source direction, prefer instance ID if available
    if (direction === 'source' && record.instanceId) {
      return record.instanceId;
    }

    // For destination, or if no instance ID, use IP-based identification
    if (this.isPrivateIP(ip)) {
      return `ip-${ip.replace(/\./g, '-')}`;
    } else {
      return `external-${ip.replace(/\./g, '-')}`;
    }
  }

  /**
   * Filter nodes by traffic volume
   */
  private filterNodesByTraffic(
    nodes: NetworkNode[],
    minTrafficThreshold: number,
    maxNodes: number
  ): NetworkNode[] {
    // Calculate traffic volume for each node
    const nodesWithTraffic = nodes.map(node => {
      const trafficVolume = this.calculateNodeTrafficVolume(node.id);
      return { node, trafficVolume };
    });

    // If no traffic threshold, return all nodes (up to limit)
    if (minTrafficThreshold === 0) {
      const sortedNodes = nodesWithTraffic
        .sort((a, b) => b.trafficVolume - a.trafficVolume)
        .slice(0, maxNodes);

      return sortedNodes.map(({ node, trafficVolume }) => ({
        ...node,
        metadata: {
          ...node.metadata,
          trafficVolume,
        },
      }));
    }

    // Filter by minimum threshold
    const filteredNodes = nodesWithTraffic.filter(
      ({ trafficVolume }) => trafficVolume >= minTrafficThreshold
    );

    // If no nodes meet threshold, include infrastructure nodes anyway
    if (filteredNodes.length === 0) {
      const infrastructureNodes = nodesWithTraffic.filter(({ node }) => 
        ['vpc', 'subnet', 'tgw'].includes(node.type)
      );
      
      if (infrastructureNodes.length > 0) {
        return infrastructureNodes
          .sort((a, b) => b.trafficVolume - a.trafficVolume)
          .slice(0, maxNodes)
          .map(({ node, trafficVolume }) => ({
            ...node,
            metadata: {
              ...node.metadata,
              trafficVolume,
            },
          }));
      }
    }

    // Sort by traffic volume and limit
    const sortedNodes = filteredNodes
      .sort((a, b) => b.trafficVolume - a.trafficVolume)
      .slice(0, maxNodes);

    // Update node metadata with traffic volume
    return sortedNodes.map(({ node, trafficVolume }) => ({
      ...node,
      metadata: {
        ...node.metadata,
        trafficVolume,
      },
    }));
  }

  /**
   * Filter edges by traffic volume
   */
  private filterEdgesByTraffic(
    edges: NetworkEdge[],
    minTrafficThreshold: number,
    maxEdges: number
  ): NetworkEdge[] {
    // Filter by minimum threshold
    const filteredEdges = edges.filter(
      edge => edge.trafficStats.totalBytes >= minTrafficThreshold
    );

    // Sort by traffic volume and limit
    return filteredEdges
      .sort((a, b) => b.trafficStats.totalBytes - a.trafficStats.totalBytes)
      .slice(0, maxEdges);
  }

  /**
   * Calculate traffic volume for a node
   */
  private calculateNodeTrafficVolume(nodeId: string): number {
    let totalVolume = 0;

    for (const [edgeId, edge] of this.edgeCache.entries()) {
      if (edge.source === nodeId || edge.target === nodeId) {
        totalVolume += edge.trafficStats.totalBytes;
      }
    }

    return totalVolume;
  }

  /**
   * Build topology hierarchy information
   */
  private buildTopologyHierarchy(nodes: NetworkNode[], records: FlowLogRecord[]): TopologyHierarchy {
    const regions = new Map<string, RegionInfo>();
    const vpcs = new Map<string, VPCInfo>();
    const subnets = new Map<string, SubnetInfo>();
    const instances = new Map<string, InstanceInfo>();

    // Process nodes to build hierarchy
    for (const node of nodes) {
      switch (node.type) {
        case 'vpc':
          this.processVPCNode(node, vpcs, regions);
          break;
        case 'subnet':
          this.processSubnetNode(node, subnets, vpcs);
          break;
        case 'instance':
          this.processInstanceNode(node, instances, subnets);
          break;
        case 'tgw':
          this.processTransitGatewayNode(node, regions);
          break;
      }
    }

    // Process flow records to establish relationships
    for (const record of records) {
      this.processRecordForHierarchy(record, regions, vpcs, subnets, instances);
    }

    return { regions, vpcs, subnets, instances };
  }

  /**
   * Process VPC node for hierarchy
   */
  private processVPCNode(node: NetworkNode, vpcs: Map<string, VPCInfo>, regions: Map<string, RegionInfo>): void {
    const region = node.properties.region as string || 'unknown';
    const accountId = node.properties.accountId as string || 'unknown';

    // Add to VPCs map
    vpcs.set(node.id, {
      id: node.id,
      name: node.properties.name as string,
      cidrBlock: node.properties.cidrBlock as string || 'unknown',
      region,
      accountId,
      subnets: [],
      instances: [],
      isDefault: node.properties.isDefault as boolean || false,
    });

    // Add to regions map
    if (!regions.has(region)) {
      regions.set(region, {
        id: region,
        name: region,
        vpcs: [],
        transitGateways: [],
      });
    }
    const regionInfo = regions.get(region)!;
    if (!regionInfo.vpcs.includes(node.id)) {
      regionInfo.vpcs.push(node.id);
    }
  }

  /**
   * Process subnet node for hierarchy
   */
  private processSubnetNode(node: NetworkNode, subnets: Map<string, SubnetInfo>, vpcs: Map<string, VPCInfo>): void {
    const vpcId = node.properties.vpcId as string || 'unknown';
    const availabilityZone = node.properties.availabilityZone as string || 'unknown';

    // Add to subnets map
    subnets.set(node.id, {
      id: node.id,
      name: node.properties.name as string,
      cidrBlock: node.properties.cidrBlock as string || 'unknown',
      vpcId,
      availabilityZone,
      type: node.properties.subnetType as 'public' | 'private' || 'private',
      instances: [],
    });

    // Add to VPC's subnet list
    const vpcInfo = vpcs.get(vpcId);
    if (vpcInfo && !vpcInfo.subnets.includes(node.id)) {
      vpcInfo.subnets.push(node.id);
    }
  }

  /**
   * Process instance node for hierarchy
   */
  private processInstanceNode(node: NetworkNode, instances: Map<string, InstanceInfo>, subnets: Map<string, SubnetInfo>): void {
    const subnetId = node.properties.subnetId as string || 'unknown';

    // Add to instances map
    instances.set(node.id, {
      id: node.id,
      name: node.properties.name as string,
      type: node.properties.instanceType as string || 'unknown',
      subnetId,
      privateIpAddress: node.properties.privateIpAddress as string || 'unknown',
      publicIpAddress: node.properties.publicIpAddress as string,
      state: node.properties.state as string || 'unknown',
    });

    // Add to subnet's instance list
    const subnetInfo = subnets.get(subnetId);
    if (subnetInfo && !subnetInfo.instances.includes(node.id)) {
      subnetInfo.instances.push(node.id);
    }
  }

  /**
   * Process Transit Gateway node for hierarchy
   */
  private processTransitGatewayNode(node: NetworkNode, regions: Map<string, RegionInfo>): void {
    const region = node.properties.region as string || 'unknown';

    // Add to regions map
    if (!regions.has(region)) {
      regions.set(region, {
        id: region,
        name: region,
        vpcs: [],
        transitGateways: [],
      });
    }
    const regionInfo = regions.get(region)!;
    if (!regionInfo.transitGateways.includes(node.id)) {
      regionInfo.transitGateways.push(node.id);
    }
  }

  /**
   * Process flow record for hierarchy relationships
   */
  private processRecordForHierarchy(
    record: FlowLogRecord,
    regions: Map<string, RegionInfo>,
    vpcs: Map<string, VPCInfo>,
    subnets: Map<string, SubnetInfo>,
    instances: Map<string, InstanceInfo>
  ): void {
    // Establish VPC-subnet relationships
    if (record.vpcId && record.subnetId) {
      const vpcInfo = vpcs.get(record.vpcId);
      if (vpcInfo && !vpcInfo.subnets.includes(record.subnetId)) {
        vpcInfo.subnets.push(record.subnetId);
      }
    }

    // Establish subnet-instance relationships
    if (record.subnetId && record.instanceId) {
      const subnetInfo = subnets.get(record.subnetId);
      if (subnetInfo && !subnetInfo.instances.includes(record.instanceId)) {
        subnetInfo.instances.push(record.instanceId);
      }
    }

    // Establish VPC-instance relationships
    if (record.vpcId && record.instanceId) {
      const vpcInfo = vpcs.get(record.vpcId);
      if (vpcInfo && !vpcInfo.instances.includes(record.instanceId)) {
        vpcInfo.instances.push(record.instanceId);
      }
    }
  }

  /**
   * Create topology metadata
   */
  private createTopologyMetadata(
    records: FlowLogRecord[],
    nodeCount: number,
    edgeCount: number
  ): TopologyMetadata {
    const now = new Date();
    let minTimestamp = now;
    let maxTimestamp = now;

    if (records.length > 0) {
      minTimestamp = records[0].timestamp;
      maxTimestamp = records[0].timestamp;

      for (const record of records) {
        if (record.timestamp < minTimestamp) {
          minTimestamp = record.timestamp;
        }
        if (record.timestamp > maxTimestamp) {
          maxTimestamp = record.timestamp;
        }
      }
    }

    return {
      lastUpdated: now,
      recordCount: records.length,
      timeRange: { start: minTimestamp, end: maxTimestamp },
      processingTime: 0, // Will be set by caller
      dataSource: 'CloudWatch Insights',
      version: '1.0.0',
      completeness: this.calculateCompleteness(records, nodeCount, edgeCount),
      accuracy: this.calculateAccuracy(records),
      freshness: this.calculateFreshness(maxTimestamp),
    };
  }

  /**
   * Utility methods
   */
  private isPrivateIP(ip: string): boolean {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) return false;

    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;

    return false;
  }

  private isLoadBalancerPort(port: number): boolean {
    return [80, 443, 8080, 8443].includes(port);
  }

  private isNATGatewayPattern(ip: string, port: number): boolean {
    // Simplified heuristic - NAT gateways typically handle outbound traffic
    return this.isPrivateIP(ip) && [80, 443].includes(port);
  }

  private calculateCompleteness(records: FlowLogRecord[], nodeCount: number, edgeCount: number): number {
    // Simple heuristic: ratio of identified nodes/edges to total possible
    const expectedNodes = Math.min(records.length / 10, 100); // Rough estimate
    const expectedEdges = Math.min(records.length / 5, 200); // Rough estimate

    const nodeCompleteness = Math.min(nodeCount / expectedNodes, 1.0);
    const edgeCompleteness = Math.min(edgeCount / expectedEdges, 1.0);

    return (nodeCompleteness + edgeCompleteness) / 2;
  }

  private calculateAccuracy(records: FlowLogRecord[]): number {
    // Simple heuristic based on data quality
    let qualityScore = 1.0;

    const recordsWithInstanceId = records.filter(r => r.instanceId).length;
    const recordsWithVpcId = records.filter(r => r.vpcId).length;
    const recordsWithSubnetId = records.filter(r => r.subnetId).length;

    const instanceIdRatio = recordsWithInstanceId / records.length;
    const vpcIdRatio = recordsWithVpcId / records.length;
    const subnetIdRatio = recordsWithSubnetId / records.length;

    // Higher ratios indicate better data quality
    qualityScore = (instanceIdRatio * 0.4 + vpcIdRatio * 0.3 + subnetIdRatio * 0.3);

    return Math.max(qualityScore, 0.1); // Minimum 10% accuracy
  }

  private calculateFreshness(latestTimestamp: Date): number {
    const now = new Date();
    const ageMs = now.getTime() - latestTimestamp.getTime();
    const ageHours = ageMs / (1000 * 60 * 60);

    // Freshness decreases over time
    if (ageHours < 1) return 1.0;
    if (ageHours < 6) return 0.8;
    if (ageHours < 24) return 0.6;
    if (ageHours < 168) return 0.4; // 1 week
    return 0.2;
  }
}