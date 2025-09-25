import {
  FlowLogRecord,
  FlowLogValidator,
  FlowLogValidationResult,
  NetworkNode,
  NetworkEdge,
  NetworkTopology,
  TrafficStatistics,
  EdgeTrafficStatistics,
  ProtocolDistribution,
  NodeType,
  NodeProperties,
  NodeMetadata,
  EdgeProperties,
  EdgeMetadata,
  TopologyMetadata,
} from '../../shared/types';

/**
 * Flow Log Record Validator
 * Validates flow log records for completeness and correctness
 */
export class FlowLogRecordValidator implements FlowLogValidator {
  private static readonly REQUIRED_FIELDS = [
    'timestamp',
    'sourceIP',
    'destinationIP',
    'sourcePort',
    'destinationPort',
    'protocol',
    'action',
    'bytes',
    'packets',
  ];

  private static readonly VALID_PROTOCOLS = new Set([
    'TCP', 'UDP', 'ICMP', 'ICMPv6', 'GRE', 'ESP', 'AH', 'SCTP'
  ]);

  private static readonly VALID_ACTIONS = new Set(['ACCEPT', 'REJECT']);

  /**
   * Validate a single flow log record
   */
  validateRecord(record: Partial<FlowLogRecord>): FlowLogValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    for (const field of FlowLogRecordValidator.REQUIRED_FIELDS) {
      if (!(field in record) || record[field as keyof FlowLogRecord] === undefined) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors, warnings };
    }

    // Type and format validation
    const typedRecord = record as FlowLogRecord;

    // Validate timestamp
    if (!(typedRecord.timestamp instanceof Date) || isNaN(typedRecord.timestamp.getTime())) {
      errors.push('Invalid timestamp format');
    }

    // Validate IP addresses
    if (!this.isValidIP(typedRecord.sourceIP)) {
      errors.push(`Invalid source IP address: ${typedRecord.sourceIP}`);
    }
    if (!this.isValidIP(typedRecord.destinationIP)) {
      errors.push(`Invalid destination IP address: ${typedRecord.destinationIP}`);
    }

    // Validate ports
    if (!this.isValidPort(typedRecord.sourcePort)) {
      errors.push(`Invalid source port: ${typedRecord.sourcePort}`);
    }
    if (!this.isValidPort(typedRecord.destinationPort)) {
      errors.push(`Invalid destination port: ${typedRecord.destinationPort}`);
    }

    // Validate protocol
    if (!FlowLogRecordValidator.VALID_PROTOCOLS.has(typedRecord.protocol.toUpperCase())) {
      warnings.push(`Unusual protocol: ${typedRecord.protocol}`);
    }

    // Validate action
    if (!FlowLogRecordValidator.VALID_ACTIONS.has(typedRecord.action)) {
      errors.push(`Invalid action: ${typedRecord.action}`);
    }

    // Validate numeric fields
    if (typedRecord.bytes < 0) {
      errors.push('Bytes cannot be negative');
    }
    if (typedRecord.packets < 0) {
      errors.push('Packets cannot be negative');
    }

    // Logical validations
    if (typedRecord.bytes === 0 && typedRecord.packets > 0) {
      warnings.push('Zero bytes with non-zero packets is unusual');
    }
    if (typedRecord.packets === 0 && typedRecord.bytes > 0) {
      warnings.push('Zero packets with non-zero bytes is unusual');
    }

    // Check for private IP ranges
    if (this.isPrivateIP(typedRecord.sourceIP) && this.isPrivateIP(typedRecord.destinationIP)) {
      // Internal traffic - normal
    } else if (!this.isPrivateIP(typedRecord.sourceIP) && !this.isPrivateIP(typedRecord.destinationIP)) {
      warnings.push('External to external traffic detected');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate a batch of flow log records
   */
  validateBatch(records: Partial<FlowLogRecord>[]): {
    validRecords: FlowLogRecord[];
    invalidRecords: Array<{ record: Partial<FlowLogRecord>; errors: string[] }>;
    summary: { total: number; valid: number; invalid: number };
  } {
    const validRecords: FlowLogRecord[] = [];
    const invalidRecords: Array<{ record: Partial<FlowLogRecord>; errors: string[] }> = [];

    for (const record of records) {
      const validation = this.validateRecord(record);
      if (validation.valid) {
        validRecords.push(record as FlowLogRecord);
      } else {
        invalidRecords.push({ record, errors: validation.errors });
      }
    }

    return {
      validRecords,
      invalidRecords,
      summary: {
        total: records.length,
        valid: validRecords.length,
        invalid: invalidRecords.length,
      },
    };
  }

  private isValidIP(ip: string): boolean {
    // IPv4 validation
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    // IPv6 validation (simplified)
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  private isValidPort(port: number): boolean {
    return Number.isInteger(port) && port >= 0 && port <= 65535;
  }

  private isPrivateIP(ip: string): boolean {
    // Check for private IPv4 ranges
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
}

/**
 * Traffic Statistics Calculator
 * Calculates comprehensive traffic statistics and aggregations
 */
export class TrafficStatisticsCalculator {
  /**
   * Calculate enhanced traffic statistics from flow log records
   */
  static calculateTrafficStatistics(
    records: FlowLogRecord[],
    timeWindowMs?: number
  ): TrafficStatistics {
    if (records.length === 0) {
      return this.getEmptyStatistics();
    }

    let totalBytes = 0;
    let totalPackets = 0;
    let acceptedConnections = 0;
    let rejectedConnections = 0;

    const sourceIPs = new Set<string>();
    const destinationIPs = new Set<string>();
    const portStats = new Map<string, { port: number; protocol: string; connections: number; bytes: number }>();
    const protocolStats = new Map<string, { bytes: number; packets: number; connections: number }>();
    const unusualPorts = new Set<number>();

    let minTimestamp = records[0].timestamp;
    let maxTimestamp = records[0].timestamp;

    // Common ports for anomaly detection
    const commonPorts = new Set([22, 23, 25, 53, 80, 110, 143, 443, 993, 995, 3389]);

    for (const record of records) {
      // Accumulate totals
      totalBytes += record.bytes;
      totalPackets += record.packets;

      if (record.action === 'ACCEPT') {
        acceptedConnections++;
      } else {
        rejectedConnections++;
      }

      // Track unique IPs
      sourceIPs.add(record.sourceIP);
      destinationIPs.add(record.destinationIP);

      // Track port statistics
      const portKey = `${record.destinationPort}-${record.protocol}`;
      if (!portStats.has(portKey)) {
        portStats.set(portKey, {
          port: record.destinationPort,
          protocol: record.protocol,
          connections: 0,
          bytes: 0,
        });
      }
      const portStat = portStats.get(portKey)!;
      portStat.connections++;
      portStat.bytes += record.bytes;

      // Track protocol statistics
      if (!protocolStats.has(record.protocol)) {
        protocolStats.set(record.protocol, {
          bytes: 0,
          packets: 0,
          connections: 0,
        });
      }
      const protocolStat = protocolStats.get(record.protocol)!;
      protocolStat.bytes += record.bytes;
      protocolStat.packets += record.packets;
      protocolStat.connections++;

      // Check for unusual ports
      if (!commonPorts.has(record.destinationPort)) {
        unusualPorts.add(record.destinationPort);
      }

      // Track time range
      if (record.timestamp < minTimestamp) {
        minTimestamp = record.timestamp;
      }
      if (record.timestamp > maxTimestamp) {
        maxTimestamp = record.timestamp;
      }
    }

    // Calculate time-based metrics
    const timeRangeMs = maxTimestamp.getTime() - minTimestamp.getTime();
    const timeRangeSeconds = Math.max(timeRangeMs / 1000, 1); // Avoid division by zero

    // Get top ports
    const topPorts = Array.from(portStats.values())
      .sort((a, b) => b.connections - a.connections)
      .slice(0, 10)
      .map(stat => ({
        port: stat.port,
        protocol: stat.protocol,
        connections: stat.connections,
        bytes: stat.bytes,
      }));

    // Calculate protocol distribution
    const protocolDistribution: ProtocolDistribution[] = Array.from(protocolStats.entries())
      .map(([protocol, stat]) => ({
        protocol,
        bytes: stat.bytes,
        packets: stat.packets,
        connections: stat.connections,
        percentage: totalBytes > 0 ? (stat.bytes / totalBytes) * 100 : 0,
      }))
      .sort((a, b) => b.bytes - a.bytes);

    return {
      totalBytes,
      totalPackets,
      acceptedConnections,
      rejectedConnections,
      uniqueSourceIPs: sourceIPs.size,
      uniqueDestinationIPs: destinationIPs.size,
      topPorts,
      timeRange: { start: minTimestamp, end: maxTimestamp },
      // Enhanced statistics
      bytesPerSecond: totalBytes / timeRangeSeconds,
      packetsPerSecond: totalPackets / timeRangeSeconds,
      connectionsPerSecond: records.length / timeRangeSeconds,
      averagePacketSize: totalPackets > 0 ? totalBytes / totalPackets : 0,
      protocolDistribution,
      // Anomaly indicators
      anomalousConnections: rejectedConnections,
      suspiciousTraffic: this.calculateSuspiciousTraffic(records),
      unusualPorts: Array.from(unusualPorts),
    };
  }

  /**
   * Calculate edge-specific traffic statistics
   */
  static calculateEdgeTrafficStatistics(
    records: FlowLogRecord[],
    sourceNodeId: string,
    targetNodeId: string
  ): EdgeTrafficStatistics {
    const baseStats = this.calculateTrafficStatistics(records);

    // Calculate directional statistics
    let sourceToTargetBytes = 0;
    let targetToSourceBytes = 0;
    let sourceToTargetPackets = 0;
    let targetToSourcePackets = 0;

    const connectionDurations: number[] = [];
    const connectionsPerSecond: number[] = [];

    for (const record of records) {
      // Determine direction based on source/destination mapping
      // This is a simplified approach - in practice, you'd need more sophisticated logic
      if (record.sourceIP.includes(sourceNodeId) || record.vpcId === sourceNodeId) {
        sourceToTargetBytes += record.bytes;
        sourceToTargetPackets += record.packets;
      } else {
        targetToSourceBytes += record.bytes;
        targetToSourcePackets += record.packets;
      }
    }

    // Calculate average bytes per connection
    const totalConnections = baseStats.acceptedConnections + baseStats.rejectedConnections;
    const averageBytesPerConnection = totalConnections > 0 ? baseStats.totalBytes / totalConnections : 0;

    // Find peak traffic time (simplified - would need time series analysis)
    const peakTrafficTime = records.length > 0 
      ? records.reduce((peak, record) => record.bytes > peak.bytes ? record : peak).timestamp
      : new Date();

    return {
      ...baseStats,
      sourceToTargetBytes,
      targetToSourceBytes,
      sourceToTargetPackets,
      targetToSourcePackets,
      peakTrafficTime,
      averageBytesPerConnection,
      connectionDuration: connectionDurations.length > 0 
        ? connectionDurations.reduce((a, b) => a + b, 0) / connectionDurations.length 
        : 0,
    };
  }

  private static getEmptyStatistics(): TrafficStatistics {
    return {
      totalBytes: 0,
      totalPackets: 0,
      acceptedConnections: 0,
      rejectedConnections: 0,
      uniqueSourceIPs: 0,
      uniqueDestinationIPs: 0,
      topPorts: [],
      timeRange: { start: new Date(), end: new Date() },
      bytesPerSecond: 0,
      packetsPerSecond: 0,
      connectionsPerSecond: 0,
      averagePacketSize: 0,
      protocolDistribution: [],
      anomalousConnections: 0,
      suspiciousTraffic: 0,
      unusualPorts: [],
    };
  }

  private static calculateSuspiciousTraffic(records: FlowLogRecord[]): number {
    let suspiciousCount = 0;

    for (const record of records) {
      // High port numbers (potential backdoors)
      if (record.destinationPort > 49152) {
        suspiciousCount++;
      }

      // Large packet sizes (potential data exfiltration)
      if (record.bytes > 1000000) { // 1MB
        suspiciousCount++;
      }

      // Rejected connections to common ports (potential attacks)
      if (record.action === 'REJECT' && [22, 80, 443, 3389].includes(record.destinationPort)) {
        suspiciousCount++;
      }
    }

    return suspiciousCount;
  }
}

/**
 * Network Node Factory
 * Creates network nodes from various AWS resource types
 */
export class NetworkNodeFactory {
  /**
   * Create a network node from flow log data and AWS resource information
   */
  static createNode(
    id: string,
    type: NodeType,
    properties: Partial<NodeProperties> = {},
    metadata: Partial<NodeMetadata> = {}
  ): NetworkNode {
    const now = new Date();

    return {
      id,
      type,
      label: this.generateLabel(id, type, properties),
      properties: {
        name: properties.name || id,
        ...properties,
      },
      metadata: {
        createdAt: now,
        lastSeen: now,
        isActive: true,
        confidence: 1.0,
        trafficVolume: 0,
        connectionCount: 0,
        ...metadata,
      },
    };
  }

  /**
   * Create a VPC node
   */
  static createVPCNode(
    vpcId: string,
    cidrBlock: string,
    region: string,
    accountId: string,
    additionalProperties: Partial<NodeProperties> = {}
  ): NetworkNode {
    return this.createNode(vpcId, 'vpc', {
      cidrBlock,
      region,
      accountId,
      ...additionalProperties,
    });
  }

  /**
   * Create a subnet node
   */
  static createSubnetNode(
    subnetId: string,
    cidrBlock: string,
    vpcId: string,
    availabilityZone: string,
    subnetType: 'public' | 'private',
    additionalProperties: Partial<NodeProperties> = {}
  ): NetworkNode {
    return this.createNode(subnetId, 'subnet', {
      cidrBlock,
      availabilityZone,
      subnetType,
      ...additionalProperties,
    });
  }

  /**
   * Create an instance node
   */
  static createInstanceNode(
    instanceId: string,
    instanceType: string,
    subnetId: string,
    privateIpAddress: string,
    publicIpAddress?: string,
    additionalProperties: Partial<NodeProperties> = {}
  ): NetworkNode {
    return this.createNode(instanceId, 'instance', {
      instanceType,
      privateIpAddress,
      publicIpAddress,
      ...additionalProperties,
    });
  }

  /**
   * Create a Transit Gateway node
   */
  static createTransitGatewayNode(
    tgwId: string,
    region: string,
    accountId: string,
    additionalProperties: Partial<NodeProperties> = {}
  ): NetworkNode {
    return this.createNode(tgwId, 'tgw', {
      region,
      accountId,
      ...additionalProperties,
    });
  }

  private static generateLabel(id: string, type: NodeType, properties: Partial<NodeProperties>): string {
    if (properties.name) {
      return properties.name;
    }

    switch (type) {
      case 'vpc':
        return `VPC ${id}${properties.cidrBlock ? ` (${properties.cidrBlock})` : ''}`;
      case 'subnet':
        return `Subnet ${id}${properties.cidrBlock ? ` (${properties.cidrBlock})` : ''}`;
      case 'instance':
        return `Instance ${id}${properties.instanceType ? ` (${properties.instanceType})` : ''}`;
      case 'tgw':
        return `TGW ${id}`;
      case 'vpn':
        return `VPN ${id}`;
      default:
        return id;
    }
  }
}

/**
 * Network Edge Factory
 * Creates network edges representing connections between nodes
 */
export class NetworkEdgeFactory {
  /**
   * Create a network edge from flow log records
   */
  static createEdge(
    sourceNodeId: string,
    targetNodeId: string,
    flowRecords: FlowLogRecord[],
    properties: Partial<EdgeProperties> = {},
    metadata: Partial<EdgeMetadata> = {}
  ): NetworkEdge {
    const id = `${sourceNodeId}-${targetNodeId}`;
    const trafficStats = TrafficStatisticsCalculator.calculateEdgeTrafficStatistics(
      flowRecords,
      sourceNodeId,
      targetNodeId
    );

    const protocols = [...new Set(flowRecords.map(r => r.protocol))];
    const ports = [...new Set(flowRecords.map(r => r.destinationPort))];
    const hasRejectedConnections = flowRecords.some(r => r.action === 'REJECT');
    const rejectionRate = flowRecords.length > 0 
      ? flowRecords.filter(r => r.action === 'REJECT').length / flowRecords.length 
      : 0;

    const now = new Date();

    return {
      id,
      source: sourceNodeId,
      target: targetNodeId,
      trafficStats,
      flowRecords,
      properties: {
        protocols,
        ports,
        hasRejectedConnections,
        rejectionRate,
        bidirectional: this.isBidirectional(flowRecords),
        connectionType: this.determineConnectionType(sourceNodeId, targetNodeId, flowRecords),
        ...properties,
      },
      metadata: {
        firstSeen: flowRecords.length > 0 
          ? new Date(Math.min(...flowRecords.map(r => r.timestamp.getTime())))
          : now,
        lastSeen: flowRecords.length > 0 
          ? new Date(Math.max(...flowRecords.map(r => r.timestamp.getTime())))
          : now,
        isActive: true,
        confidence: 1.0,
        anomalyScore: this.calculateAnomalyScore(flowRecords),
        ...metadata,
      },
    };
  }

  private static isBidirectional(flowRecords: FlowLogRecord[]): boolean {
    const sourceIPs = new Set(flowRecords.map(r => r.sourceIP));
    const destinationIPs = new Set(flowRecords.map(r => r.destinationIP));

    // Check if there are flows in both directions
    for (const sourceIP of sourceIPs) {
      if (destinationIPs.has(sourceIP)) {
        return true;
      }
    }

    // Also check if we have records with swapped source/destination
    const ipPairs = new Set<string>();
    const reversePairs = new Set<string>();

    for (const record of flowRecords) {
      const pair = `${record.sourceIP}-${record.destinationIP}`;
      const reversePair = `${record.destinationIP}-${record.sourceIP}`;
      
      ipPairs.add(pair);
      if (ipPairs.has(reversePair)) {
        return true;
      }
      reversePairs.add(reversePair);
    }

    return false;
  }

  private static determineConnectionType(
    sourceNodeId: string,
    targetNodeId: string,
    flowRecords: FlowLogRecord[]
  ): EdgeProperties['connectionType'] {
    // Simplified logic - in practice, this would be more sophisticated
    if (sourceNodeId.startsWith('tgw-') || targetNodeId.startsWith('tgw-')) {
      return 'routed';
    }

    if (sourceNodeId.startsWith('vpn-') || targetNodeId.startsWith('vpn-')) {
      return 'vpn';
    }

    // Check if traffic goes through internet (simplified check)
    const hasPublicIPs = flowRecords.some(r => 
      !this.isPrivateIP(r.sourceIP) || !this.isPrivateIP(r.destinationIP)
    );

    if (hasPublicIPs) {
      return 'internet';
    }

    return 'direct';
  }

  private static isPrivateIP(ip: string): boolean {
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

  private static calculateAnomalyScore(flowRecords: FlowLogRecord[]): number {
    let anomalyScore = 0;
    const totalRecords = flowRecords.length;

    if (totalRecords === 0) return 0;

    // High rejection rate
    const rejectedCount = flowRecords.filter(r => r.action === 'REJECT').length;
    const rejectionRate = rejectedCount / totalRecords;
    if (rejectionRate > 0.5) {
      anomalyScore += 0.3;
    }

    // Unusual ports
    const unusualPorts = flowRecords.filter(r => r.destinationPort > 49152).length;
    if (unusualPorts / totalRecords > 0.2) {
      anomalyScore += 0.2;
    }

    // Large data transfers
    const largeTransfers = flowRecords.filter(r => r.bytes > 1000000).length;
    if (largeTransfers / totalRecords > 0.1) {
      anomalyScore += 0.2;
    }

    // Off-hours traffic (simplified - would need more sophisticated time analysis)
    const offHoursTraffic = flowRecords.filter(r => {
      const hour = r.timestamp.getHours();
      return hour < 6 || hour > 22;
    }).length;
    if (offHoursTraffic / totalRecords > 0.5) {
      anomalyScore += 0.3;
    }

    return Math.min(anomalyScore, 1.0);
  }
}