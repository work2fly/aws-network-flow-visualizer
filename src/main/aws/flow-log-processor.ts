import { FlowLogRecord, TrafficStatistics, PortStatistic } from '../../shared/types';

export interface ProcessingOptions {
  aggregateByTime?: boolean;
  timeWindowMs?: number;
  includeRejectedConnections?: boolean;
  maxRecords?: number;
}

export interface ProcessedFlowData {
  records: FlowLogRecord[];
  statistics: TrafficStatistics;
  timeSeriesData?: TimeSeriesDataPoint[];
  topSourceIPs?: IPStatistic[];
  topDestinationIPs?: IPStatistic[];
  protocolDistribution?: ProtocolStatistic[];
}

export interface TimeSeriesDataPoint {
  timestamp: Date;
  totalBytes: number;
  totalPackets: number;
  acceptedConnections: number;
  rejectedConnections: number;
}

export interface IPStatistic {
  ip: string;
  connections: number;
  bytes: number;
  packets: number;
  uniqueDestinations?: number;
  uniqueSources?: number;
}

export interface ProtocolStatistic {
  protocol: string;
  connections: number;
  bytes: number;
  packets: number;
  percentage: number;
}

/**
 * Flow Log Data Processor
 * Processes and analyzes flow log records to extract insights and statistics
 */
export class FlowLogProcessor {
  /**
   * Process flow log records and generate comprehensive statistics
   */
  static processFlowLogs(
    records: FlowLogRecord[],
    options: ProcessingOptions = {}
  ): ProcessedFlowData {
    const {
      aggregateByTime = false,
      timeWindowMs = 300000, // 5 minutes
      includeRejectedConnections = true,
      maxRecords,
    } = options;

    // Limit records if specified
    const processedRecords = maxRecords ? records.slice(0, maxRecords) : records;

    // Filter records based on options
    const filteredRecords = includeRejectedConnections 
      ? processedRecords 
      : processedRecords.filter(record => record.action === 'ACCEPT');

    // Generate basic statistics
    const statistics = this.calculateTrafficStatistics(filteredRecords);

    // Generate additional analytics
    const result: ProcessedFlowData = {
      records: filteredRecords,
      statistics,
    };

    if (aggregateByTime) {
      result.timeSeriesData = this.generateTimeSeriesData(filteredRecords, timeWindowMs);
    }

    result.topSourceIPs = this.getTopSourceIPs(filteredRecords, 10);
    result.topDestinationIPs = this.getTopDestinationIPs(filteredRecords, 10);
    result.protocolDistribution = this.getProtocolDistribution(filteredRecords);

    return result;
  }

  /**
   * Calculate comprehensive traffic statistics
   */
  static calculateTrafficStatistics(records: FlowLogRecord[]): TrafficStatistics {
    if (records.length === 0) {
      return {
        totalBytes: 0,
        totalPackets: 0,
        acceptedConnections: 0,
        rejectedConnections: 0,
        uniqueSourceIPs: 0,
        uniqueDestinationIPs: 0,
        topPorts: [],
        timeRange: { start: new Date(), end: new Date() },
        protocolDistribution: [],
      };
    }

    let totalBytes = 0;
    let totalPackets = 0;
    let acceptedConnections = 0;
    let rejectedConnections = 0;

    const sourceIPs = new Set<string>();
    const destinationIPs = new Set<string>();
    const portStats = new Map<string, { port: number; protocol: string; connections: number; bytes: number }>();
    const protocolStats = new Map<string, { bytes: number; packets: number; connections: number }>();

    let minTimestamp = records[0].timestamp;
    let maxTimestamp = records[0].timestamp;

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

      // Track time range
      if (record.timestamp < minTimestamp) {
        minTimestamp = record.timestamp;
      }
      if (record.timestamp > maxTimestamp) {
        maxTimestamp = record.timestamp;
      }
    }

    // Get top ports
    const topPorts: PortStatistic[] = Array.from(portStats.values())
      .sort((a, b) => b.connections - a.connections)
      .slice(0, 10)
      .map(stat => ({
        port: stat.port,
        protocol: stat.protocol,
        connections: stat.connections,
        bytes: stat.bytes,
      }));

    // Calculate protocol distribution
    const protocolDistribution = Array.from(protocolStats.entries())
      .map(([protocol, stats]) => ({
        protocol,
        bytes: stats.bytes,
        packets: stats.packets,
        connections: stats.connections,
        percentage: totalBytes > 0 ? (stats.bytes / totalBytes) * 100 : 0,
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
      protocolDistribution,
    };
  }

  /**
   * Generate time series data for visualization
   */
  static generateTimeSeriesData(
    records: FlowLogRecord[],
    timeWindowMs: number
  ): TimeSeriesDataPoint[] {
    if (records.length === 0) {
      return [];
    }

    // Sort records by timestamp
    const sortedRecords = [...records].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const startTime = sortedRecords[0].timestamp.getTime();
    const endTime = sortedRecords[sortedRecords.length - 1].timestamp.getTime();

    const timeSeriesData: TimeSeriesDataPoint[] = [];
    const buckets = new Map<number, {
      totalBytes: number;
      totalPackets: number;
      acceptedConnections: number;
      rejectedConnections: number;
    }>();

    // Initialize buckets
    for (let time = startTime; time <= endTime; time += timeWindowMs) {
      const bucketKey = Math.floor(time / timeWindowMs);
      buckets.set(bucketKey, {
        totalBytes: 0,
        totalPackets: 0,
        acceptedConnections: 0,
        rejectedConnections: 0,
      });
    }

    // Aggregate records into time buckets
    for (const record of sortedRecords) {
      const bucketKey = Math.floor(record.timestamp.getTime() / timeWindowMs);
      const bucket = buckets.get(bucketKey);
      
      if (bucket) {
        bucket.totalBytes += record.bytes;
        bucket.totalPackets += record.packets;
        
        if (record.action === 'ACCEPT') {
          bucket.acceptedConnections++;
        } else {
          bucket.rejectedConnections++;
        }
      }
    }

    // Convert buckets to time series data points
    for (const [bucketKey, bucket] of buckets.entries()) {
      timeSeriesData.push({
        timestamp: new Date(bucketKey * timeWindowMs),
        totalBytes: bucket.totalBytes,
        totalPackets: bucket.totalPackets,
        acceptedConnections: bucket.acceptedConnections,
        rejectedConnections: bucket.rejectedConnections,
      });
    }

    return timeSeriesData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Get top source IPs by traffic volume
   */
  static getTopSourceIPs(records: FlowLogRecord[], limit: number = 10): IPStatistic[] {
    const ipStats = new Map<string, {
      connections: number;
      bytes: number;
      packets: number;
      destinations: Set<string>;
    }>();

    for (const record of records) {
      if (!ipStats.has(record.sourceIP)) {
        ipStats.set(record.sourceIP, {
          connections: 0,
          bytes: 0,
          packets: 0,
          destinations: new Set(),
        });
      }

      const stat = ipStats.get(record.sourceIP)!;
      stat.connections++;
      stat.bytes += record.bytes;
      stat.packets += record.packets;
      stat.destinations.add(record.destinationIP);
    }

    return Array.from(ipStats.entries())
      .map(([ip, stat]) => ({
        ip,
        connections: stat.connections,
        bytes: stat.bytes,
        packets: stat.packets,
        uniqueDestinations: stat.destinations.size,
      }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, limit);
  }

  /**
   * Get top destination IPs by traffic volume
   */
  static getTopDestinationIPs(records: FlowLogRecord[], limit: number = 10): IPStatistic[] {
    const ipStats = new Map<string, {
      connections: number;
      bytes: number;
      packets: number;
      sources: Set<string>;
    }>();

    for (const record of records) {
      if (!ipStats.has(record.destinationIP)) {
        ipStats.set(record.destinationIP, {
          connections: 0,
          bytes: 0,
          packets: 0,
          sources: new Set(),
        });
      }

      const stat = ipStats.get(record.destinationIP)!;
      stat.connections++;
      stat.bytes += record.bytes;
      stat.packets += record.packets;
      stat.sources.add(record.sourceIP);
    }

    return Array.from(ipStats.entries())
      .map(([ip, stat]) => ({
        ip,
        connections: stat.connections,
        bytes: stat.bytes,
        packets: stat.packets,
        uniqueSources: stat.sources.size,
      }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, limit);
  }

  /**
   * Get protocol distribution statistics
   */
  static getProtocolDistribution(records: FlowLogRecord[]): ProtocolStatistic[] {
    const protocolStats = new Map<string, {
      connections: number;
      bytes: number;
      packets: number;
    }>();

    let totalBytes = 0;

    for (const record of records) {
      if (!protocolStats.has(record.protocol)) {
        protocolStats.set(record.protocol, {
          connections: 0,
          bytes: 0,
          packets: 0,
        });
      }

      const stat = protocolStats.get(record.protocol)!;
      stat.connections++;
      stat.bytes += record.bytes;
      stat.packets += record.packets;
      totalBytes += record.bytes;
    }

    return Array.from(protocolStats.entries())
      .map(([protocol, stat]) => ({
        protocol,
        connections: stat.connections,
        bytes: stat.bytes,
        packets: stat.packets,
        percentage: totalBytes > 0 ? (stat.bytes / totalBytes) * 100 : 0,
      }))
      .sort((a, b) => b.bytes - a.bytes);
  }

  /**
   * Detect anomalous traffic patterns
   */
  static detectAnomalies(records: FlowLogRecord[]): {
    unusualPorts: PortStatistic[];
    highVolumeConnections: FlowLogRecord[];
    suspiciousRejections: FlowLogRecord[];
  } {
    const statistics = this.calculateTrafficStatistics(records);
    
    // Find unusual ports (not in common port list)
    const commonPorts = new Set([22, 23, 25, 53, 80, 110, 143, 443, 993, 995]);
    const unusualPorts = statistics.topPorts.filter(port => !commonPorts.has(port.port));

    // Find high volume connections (top 5% by bytes)
    const sortedByBytes = [...records].sort((a, b) => b.bytes - a.bytes);
    const highVolumeThreshold = Math.ceil(records.length * 0.05);
    const highVolumeConnections = sortedByBytes.slice(0, highVolumeThreshold);

    // Find suspicious rejections (rejected connections to common ports)
    const suspiciousRejections = records.filter(record => 
      record.action === 'REJECT' && commonPorts.has(record.destinationPort)
    );

    return {
      unusualPorts,
      highVolumeConnections,
      suspiciousRejections,
    };
  }

  /**
   * Filter records by various criteria
   */
  static filterRecords(
    records: FlowLogRecord[],
    filters: {
      sourceIPs?: string[];
      destinationIPs?: string[];
      ports?: number[];
      protocols?: string[];
      actions?: ('ACCEPT' | 'REJECT')[];
      timeRange?: { start: Date; end: Date };
      minBytes?: number;
      maxBytes?: number;
    }
  ): FlowLogRecord[] {
    return records.filter(record => {
      // Source IP filter
      if (filters.sourceIPs && !filters.sourceIPs.includes(record.sourceIP)) {
        return false;
      }

      // Destination IP filter
      if (filters.destinationIPs && !filters.destinationIPs.includes(record.destinationIP)) {
        return false;
      }

      // Port filter (source or destination)
      if (filters.ports && 
          !filters.ports.includes(record.sourcePort) && 
          !filters.ports.includes(record.destinationPort)) {
        return false;
      }

      // Protocol filter
      if (filters.protocols && !filters.protocols.includes(record.protocol)) {
        return false;
      }

      // Action filter
      if (filters.actions && !filters.actions.includes(record.action)) {
        return false;
      }

      // Time range filter
      if (filters.timeRange) {
        if (record.timestamp < filters.timeRange.start || record.timestamp > filters.timeRange.end) {
          return false;
        }
      }

      // Bytes range filter
      if (filters.minBytes && record.bytes < filters.minBytes) {
        return false;
      }
      if (filters.maxBytes && record.bytes > filters.maxBytes) {
        return false;
      }

      return true;
    });
  }

  /**
   * Export processed data to CSV format
   */
  static exportToCSV(records: FlowLogRecord[]): string {
    if (records.length === 0) {
      return '';
    }

    const headers = [
      'timestamp',
      'sourceIP',
      'destinationIP',
      'sourcePort',
      'destinationPort',
      'protocol',
      'action',
      'bytes',
      'packets',
      'accountId',
      'vpcId',
      'subnetId',
      'instanceId',
    ];

    const csvRows = [headers.join(',')];

    for (const record of records) {
      const row = [
        record.timestamp.toISOString(),
        record.sourceIP,
        record.destinationIP,
        record.sourcePort.toString(),
        record.destinationPort.toString(),
        record.protocol,
        record.action,
        record.bytes.toString(),
        record.packets.toString(),
        record.accountId || '',
        record.vpcId || '',
        record.subnetId || '',
        record.instanceId || '',
      ];

      csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
  }
}