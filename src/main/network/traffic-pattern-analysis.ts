import {
  FlowLogRecord,
  TrafficPattern,
  PatternCharacteristics,
  AnomalyDetectionResult,
  TrafficAnomaly,
  AnomalyEvidence,
  TrafficBaseline,
  BaselineThresholds,
  SecurityIssue,
} from '../../shared/types';

export interface TrafficAnalysisOptions {
  timeWindowMs?: number;
  anomalyThreshold?: number;
  baselineWindowMs?: number;
  minPatternOccurrences?: number;
  enableAnomalyDetection?: boolean;
  enablePatternDetection?: boolean;
  enableSecurityAnalysis?: boolean;
}

export interface TrafficVolumeAnalysis {
  totalVolume: number;
  averageVolume: number;
  peakVolume: number;
  peakTime: Date;
  volumeDistribution: VolumeDistribution[];
  trends: VolumeTrend[];
}

export interface VolumeDistribution {
  timeRange: { start: Date; end: Date };
  volume: number;
  percentage: number;
}

export interface VolumeTrend {
  period: 'hourly' | 'daily' | 'weekly';
  direction: 'increasing' | 'decreasing' | 'stable';
  magnitude: number;
  confidence: number;
}

export interface ConnectionAnalysis {
  totalConnections: number;
  uniqueSourceIPs: number;
  uniqueDestinationIPs: number;
  connectionPatterns: ConnectionPattern[];
  rejectionAnalysis: RejectionAnalysis;
}

export interface ConnectionPattern {
  sourcePattern: string;
  destinationPattern: string;
  frequency: number;
  protocols: string[];
  ports: number[];
  timePattern: 'continuous' | 'periodic' | 'burst' | 'irregular';
}

export interface RejectionAnalysis {
  totalRejections: number;
  rejectionRate: number;
  rejectionsByPort: Map<number, number>;
  rejectionsByProtocol: Map<string, number>;
  rejectionsBySource: Map<string, number>;
  suspiciousRejections: FlowLogRecord[];
}

/**
 * Traffic Pattern Analysis Engine
 * Analyzes traffic patterns, detects anomalies, and identifies security issues
 */
export class TrafficPatternAnalyzer {
  private baseline: TrafficBaseline | null = null;

  /**
   * Analyze traffic patterns from flow log records
   */
  async analyzeTrafficPatterns(
    records: FlowLogRecord[],
    options: TrafficAnalysisOptions = {}
  ): Promise<{
    volumeAnalysis: TrafficVolumeAnalysis;
    connectionAnalysis: ConnectionAnalysis;
    patterns: TrafficPattern[];
    anomalies: AnomalyDetectionResult | null;
    securityIssues: SecurityIssue[];
  }> {
    const {
      timeWindowMs = 300000, // 5 minutes
      anomalyThreshold = 0.7,
      baselineWindowMs = 3600000, // 1 hour
      minPatternOccurrences = 3,
      enableAnomalyDetection = true,
      enablePatternDetection = true,
      enableSecurityAnalysis = true,
    } = options;

    // Analyze traffic volume
    const volumeAnalysis = this.analyzeTrafficVolume(records, timeWindowMs);

    // Analyze connections
    const connectionAnalysis = this.analyzeConnections(records);

    // Detect patterns
    const patterns = enablePatternDetection 
      ? this.detectTrafficPatterns(records, timeWindowMs, minPatternOccurrences)
      : [];

    // Detect anomalies
    const anomalies = enableAnomalyDetection 
      ? await this.detectAnomalies(records, anomalyThreshold, baselineWindowMs)
      : null;

    // Analyze security issues
    const securityIssues = enableSecurityAnalysis 
      ? this.analyzeSecurityIssues(records, connectionAnalysis)
      : [];

    return {
      volumeAnalysis,
      connectionAnalysis,
      patterns,
      anomalies,
      securityIssues,
    };
  }

  /**
   * Analyze traffic volume patterns
   */
  private analyzeTrafficVolume(records: FlowLogRecord[], timeWindowMs: number): TrafficVolumeAnalysis {
    if (records.length === 0) {
      return {
        totalVolume: 0,
        averageVolume: 0,
        peakVolume: 0,
        peakTime: new Date(),
        volumeDistribution: [],
        trends: [],
      };
    }

    // Calculate total and average volume
    const totalVolume = records.reduce((sum, record) => sum + record.bytes, 0);
    const averageVolume = totalVolume / records.length;

    // Find peak volume and time
    let peakVolume = 0;
    let peakTime = records[0].timestamp;

    // Group records by time windows
    const timeWindows = this.groupRecordsByTimeWindow(records, timeWindowMs);
    
    for (const [windowStart, windowRecords] of timeWindows.entries()) {
      const windowVolume = windowRecords.reduce((sum, record) => sum + record.bytes, 0);
      if (windowVolume > peakVolume) {
        peakVolume = windowVolume;
        peakTime = new Date(windowStart);
      }
    }

    // Calculate volume distribution
    const volumeDistribution = this.calculateVolumeDistribution(timeWindows, totalVolume);

    // Analyze trends
    const trends = this.analyzeVolumeTrends(timeWindows);

    return {
      totalVolume,
      averageVolume,
      peakVolume,
      peakTime,
      volumeDistribution,
      trends,
    };
  }

  /**
   * Analyze connection patterns
   */
  private analyzeConnections(records: FlowLogRecord[]): ConnectionAnalysis {
    const sourceIPs = new Set<string>();
    const destinationIPs = new Set<string>();
    const connectionPatterns = new Map<string, ConnectionPattern>();
    
    let totalRejections = 0;
    const rejectionsByPort = new Map<number, number>();
    const rejectionsByProtocol = new Map<string, number>();
    const rejectionsBySource = new Map<string, number>();
    const suspiciousRejections: FlowLogRecord[] = [];

    for (const record of records) {
      sourceIPs.add(record.sourceIP);
      destinationIPs.add(record.destinationIP);

      // Analyze connection patterns
      const patternKey = `${this.getIPPattern(record.sourceIP)}->${this.getIPPattern(record.destinationIP)}`;
      if (!connectionPatterns.has(patternKey)) {
        connectionPatterns.set(patternKey, {
          sourcePattern: this.getIPPattern(record.sourceIP),
          destinationPattern: this.getIPPattern(record.destinationIP),
          frequency: 0,
          protocols: [],
          ports: [],
          timePattern: 'irregular',
        });
      }

      const pattern = connectionPatterns.get(patternKey)!;
      pattern.frequency++;
      
      if (!pattern.protocols.includes(record.protocol)) {
        pattern.protocols.push(record.protocol);
      }
      
      if (!pattern.ports.includes(record.destinationPort)) {
        pattern.ports.push(record.destinationPort);
      }

      // Analyze rejections
      if (record.action === 'REJECT') {
        totalRejections++;
        
        rejectionsByPort.set(
          record.destinationPort,
          (rejectionsByPort.get(record.destinationPort) || 0) + 1
        );
        
        rejectionsByProtocol.set(
          record.protocol,
          (rejectionsByProtocol.get(record.protocol) || 0) + 1
        );
        
        rejectionsBySource.set(
          record.sourceIP,
          (rejectionsBySource.get(record.sourceIP) || 0) + 1
        );

        // Check for suspicious rejections
        if (this.isSuspiciousRejection(record)) {
          suspiciousRejections.push(record);
        }
      }
    }

    // Determine time patterns for connection patterns
    for (const pattern of connectionPatterns.values()) {
      pattern.timePattern = this.determineTimePattern(pattern.frequency, records.length);
    }

    const rejectionRate = records.length > 0 ? totalRejections / records.length : 0;

    return {
      totalConnections: records.length,
      uniqueSourceIPs: sourceIPs.size,
      uniqueDestinationIPs: destinationIPs.size,
      connectionPatterns: Array.from(connectionPatterns.values()),
      rejectionAnalysis: {
        totalRejections,
        rejectionRate,
        rejectionsByPort,
        rejectionsByProtocol,
        rejectionsBySource,
        suspiciousRejections,
      },
    };
  }

  /**
   * Detect traffic patterns
   */
  private detectTrafficPatterns(
    records: FlowLogRecord[],
    timeWindowMs: number,
    minOccurrences: number
  ): TrafficPattern[] {
    const patterns: TrafficPattern[] = [];

    // Group records by time windows
    const timeWindows = this.groupRecordsByTimeWindow(records, timeWindowMs);

    // Detect periodic patterns
    const periodicPatterns = this.detectPeriodicPatterns(timeWindows, minOccurrences);
    patterns.push(...periodicPatterns);

    // Detect burst patterns
    const burstPatterns = this.detectBurstPatterns(timeWindows);
    patterns.push(...burstPatterns);

    // Detect baseline patterns
    const baselinePatterns = this.detectBaselinePatterns(timeWindows);
    patterns.push(...baselinePatterns);

    return patterns;
  }

  /**
   * Detect anomalies in traffic
   */
  private async detectAnomalies(
    records: FlowLogRecord[],
    threshold: number,
    baselineWindowMs: number
  ): Promise<AnomalyDetectionResult> {
    const now = new Date();
    
    // Establish or update baseline
    if (!this.baseline) {
      this.baseline = this.establishBaseline(records, baselineWindowMs);
    }

    const anomalies: TrafficAnomaly[] = [];

    // Detect volume anomalies
    const volumeAnomalies = this.detectVolumeAnomalies(records, this.baseline, threshold);
    anomalies.push(...volumeAnomalies);

    // Detect pattern anomalies
    const patternAnomalies = this.detectPatternAnomalies(records, this.baseline, threshold);
    anomalies.push(...patternAnomalies);

    // Detect destination anomalies
    const destinationAnomalies = this.detectDestinationAnomalies(records, this.baseline, threshold);
    anomalies.push(...destinationAnomalies);

    // Detect protocol anomalies
    const protocolAnomalies = this.detectProtocolAnomalies(records, this.baseline, threshold);
    anomalies.push(...protocolAnomalies);

    // Detect timing anomalies
    const timingAnomalies = this.detectTimingAnomalies(records, this.baseline, threshold);
    anomalies.push(...timingAnomalies);

    // Calculate overall confidence
    const confidence = anomalies.length > 0 
      ? anomalies.reduce((sum, anomaly) => sum + anomaly.severity, 0) / anomalies.length
      : 1.0;

    return {
      anomalies,
      baseline: this.baseline,
      confidence,
      analysisTime: now,
    };
  }

  /**
   * Analyze security issues
   */
  private analyzeSecurityIssues(
    records: FlowLogRecord[],
    connectionAnalysis: ConnectionAnalysis
  ): SecurityIssue[] {
    const securityIssues: SecurityIssue[] = [];

    // Analyze unusual ports
    const unusualPortIssues = this.analyzeUnusualPorts(records);
    securityIssues.push(...unusualPortIssues);

    // Analyze high rejection rates
    const rejectionIssues = this.analyzeHighRejectionRates(connectionAnalysis);
    securityIssues.push(...rejectionIssues);

    // Analyze suspicious traffic patterns
    const suspiciousTrafficIssues = this.analyzeSuspiciousTraffic(records);
    securityIssues.push(...suspiciousTrafficIssues);

    // Analyze anomalous patterns
    const anomalousPatternIssues = this.analyzeAnomalousPatterns(records);
    securityIssues.push(...anomalousPatternIssues);

    return securityIssues;
  }

  /**
   * Helper methods
   */
  private groupRecordsByTimeWindow(
    records: FlowLogRecord[],
    timeWindowMs: number
  ): Map<number, FlowLogRecord[]> {
    const timeWindows = new Map<number, FlowLogRecord[]>();

    for (const record of records) {
      const windowStart = Math.floor(record.timestamp.getTime() / timeWindowMs) * timeWindowMs;
      
      if (!timeWindows.has(windowStart)) {
        timeWindows.set(windowStart, []);
      }
      
      timeWindows.get(windowStart)!.push(record);
    }

    return timeWindows;
  }

  private calculateVolumeDistribution(
    timeWindows: Map<number, FlowLogRecord[]>,
    totalVolume: number
  ): VolumeDistribution[] {
    const distribution: VolumeDistribution[] = [];

    for (const [windowStart, windowRecords] of timeWindows.entries()) {
      const windowVolume = windowRecords.reduce((sum, record) => sum + record.bytes, 0);
      const percentage = totalVolume > 0 ? (windowVolume / totalVolume) * 100 : 0;

      distribution.push({
        timeRange: {
          start: new Date(windowStart),
          end: new Date(windowStart + 300000), // Assuming 5-minute windows
        },
        volume: windowVolume,
        percentage,
      });
    }

    return distribution.sort((a, b) => a.timeRange.start.getTime() - b.timeRange.start.getTime());
  }

  private analyzeVolumeTrends(timeWindows: Map<number, FlowLogRecord[]>): VolumeTrend[] {
    const trends: VolumeTrend[] = [];
    
    if (timeWindows.size < 3) {
      return trends; // Need at least 3 data points for trend analysis
    }

    const sortedWindows = Array.from(timeWindows.entries())
      .sort(([a], [b]) => a - b);

    const volumes = sortedWindows.map(([, records]) => 
      records.reduce((sum, record) => sum + record.bytes, 0)
    );

    // Simple linear trend analysis
    const trend = this.calculateLinearTrend(volumes);
    
    trends.push({
      period: 'hourly',
      direction: trend > 0.1 ? 'increasing' : trend < -0.1 ? 'decreasing' : 'stable',
      magnitude: Math.abs(trend),
      confidence: Math.min(volumes.length / 10, 1.0), // Higher confidence with more data points
    });

    return trends;
  }

  private calculateLinearTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const sumX = (n * (n - 1)) / 2; // Sum of indices 0, 1, 2, ...
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, index) => sum + index * val, 0);
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6; // Sum of squares of indices

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
  }

  private getIPPattern(ip: string): string {
    const parts = ip.split('.');
    if (parts.length !== 4) return ip;

    // Create pattern based on IP classification
    if (this.isPrivateIP(ip)) {
      return `${parts[0]}.${parts[1]}.x.x`; // Private network pattern
    } else {
      return 'external'; // External IP pattern
    }
  }

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

  private determineTimePattern(frequency: number, totalRecords: number): ConnectionPattern['timePattern'] {
    const ratio = frequency / totalRecords;
    
    if (ratio > 0.8) return 'continuous';
    if (ratio > 0.3) return 'periodic';
    if (ratio > 0.1) return 'burst';
    return 'irregular';
  }

  private isSuspiciousRejection(record: FlowLogRecord): boolean {
    // Common ports that shouldn't normally be rejected
    const commonPorts = [22, 80, 443, 25, 53];
    
    // High-value ports that are often targeted
    const targetPorts = [3389, 1433, 3306, 5432, 6379];

    return commonPorts.includes(record.destinationPort) || 
           targetPorts.includes(record.destinationPort) ||
           record.destinationPort > 49152; // Dynamic/private ports
  }

  private detectPeriodicPatterns(
    timeWindows: Map<number, FlowLogRecord[]>,
    minOccurrences: number
  ): TrafficPattern[] {
    const patterns: TrafficPattern[] = [];
    
    // Simple periodic pattern detection based on volume consistency
    const sortedWindows = Array.from(timeWindows.entries()).sort(([a], [b]) => a - b);
    
    if (sortedWindows.length < minOccurrences) {
      return patterns;
    }

    const volumes = sortedWindows.map(([, records]) => 
      records.reduce((sum, record) => sum + record.bytes, 0)
    );

    // Check for periodic patterns (simplified)
    const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
    const variance = volumes.reduce((sum, vol) => sum + Math.pow(vol - avgVolume, 2), 0) / volumes.length;
    const stdDev = Math.sqrt(variance);

    // If variance is low, it might be a periodic pattern
    if (stdDev / avgVolume < 0.3 && avgVolume > 0) {
      const firstWindow = sortedWindows[0];
      const lastWindow = sortedWindows[sortedWindows.length - 1];
      
      patterns.push({
        id: `periodic-${Date.now()}`,
        type: 'periodic',
        confidence: 1 - (stdDev / avgVolume),
        timeRange: {
          start: new Date(firstWindow[0]),
          end: new Date(lastWindow[0] + 300000),
        },
        characteristics: {
          frequency: volumes.length,
          amplitude: avgVolume,
          duration: lastWindow[0] - firstWindow[0],
          nodes: [],
          protocols: [],
          ports: [],
        },
      });
    }

    return patterns;
  }

  private detectBurstPatterns(timeWindows: Map<number, FlowLogRecord[]>): TrafficPattern[] {
    const patterns: TrafficPattern[] = [];
    
    const sortedWindows = Array.from(timeWindows.entries()).sort(([a], [b]) => a - b);
    const volumes = sortedWindows.map(([, records]) => 
      records.reduce((sum, record) => sum + record.bytes, 0)
    );

    if (volumes.length < 3) return patterns;

    const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
    
    // Detect bursts (volumes significantly above average)
    for (let i = 0; i < volumes.length; i++) {
      if (volumes[i] > avgVolume * 3) { // 3x above average
        const windowStart = sortedWindows[i][0];
        
        patterns.push({
          id: `burst-${windowStart}`,
          type: 'burst',
          confidence: Math.min(volumes[i] / avgVolume / 3, 1.0),
          timeRange: {
            start: new Date(windowStart),
            end: new Date(windowStart + 300000),
          },
          characteristics: {
            amplitude: volumes[i],
            duration: 300000,
            nodes: [],
            protocols: [],
            ports: [],
          },
        });
      }
    }

    return patterns;
  }

  private detectBaselinePatterns(timeWindows: Map<number, FlowLogRecord[]>): TrafficPattern[] {
    const patterns: TrafficPattern[] = [];
    
    const sortedWindows = Array.from(timeWindows.entries()).sort(([a], [b]) => a - b);
    const volumes = sortedWindows.map(([, records]) => 
      records.reduce((sum, record) => sum + record.bytes, 0)
    );

    if (volumes.length < 5) return patterns;

    const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
    const variance = volumes.reduce((sum, vol) => sum + Math.pow(vol - avgVolume, 2), 0) / volumes.length;
    const stdDev = Math.sqrt(variance);

    // If most volumes are within 1 standard deviation, it's baseline
    const baselineVolumes = volumes.filter(vol => Math.abs(vol - avgVolume) <= stdDev);
    
    if (baselineVolumes.length / volumes.length > 0.7) {
      const firstWindow = sortedWindows[0];
      const lastWindow = sortedWindows[sortedWindows.length - 1];
      
      patterns.push({
        id: `baseline-${Date.now()}`,
        type: 'baseline',
        confidence: baselineVolumes.length / volumes.length,
        timeRange: {
          start: new Date(firstWindow[0]),
          end: new Date(lastWindow[0] + 300000),
        },
        characteristics: {
          amplitude: avgVolume,
          duration: lastWindow[0] - firstWindow[0],
          nodes: [],
          protocols: [],
          ports: [],
        },
      });
    }

    return patterns;
  }

  private establishBaseline(records: FlowLogRecord[], windowMs: number): TrafficBaseline {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMs);
    
    // Use first 70% of records for baseline to avoid including anomalies in baseline
    const sortedRecords = [...records].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const baselineCount = Math.floor(sortedRecords.length * 0.7);
    const baselineRecords = sortedRecords.slice(0, baselineCount);

    // Calculate baseline thresholds
    const totalBytes = baselineRecords.reduce((sum, record) => sum + record.bytes, 0);
    const totalConnections = baselineRecords.length;
    const uniqueDestinations = new Set(baselineRecords.map(r => r.destinationIP)).size;
    
    const bytesPerSecond = totalBytes / (windowMs / 1000);
    const connectionsPerSecond = totalConnections / (windowMs / 1000);

    const normalPorts = new Set(baselineRecords.map(r => r.destinationPort));
    const normalProtocols = new Set(baselineRecords.map(r => r.protocol));

    return {
      establishedAt: now,
      sampleSize: baselineRecords.length,
      timeRange: { start: windowStart, end: now },
      normalPatterns: [], // Would be populated with detected patterns
      thresholds: {
        maxBytesPerSecond: bytesPerSecond * 2, // 2x baseline
        maxConnectionsPerSecond: connectionsPerSecond * 2,
        maxUniqueDestinations: uniqueDestinations * 2,
        normalPorts,
        normalProtocols,
      },
    };
  }

  private detectVolumeAnomalies(
    records: FlowLogRecord[],
    baseline: TrafficBaseline,
    threshold: number
  ): TrafficAnomaly[] {
    const anomalies: TrafficAnomaly[] = [];
    
    const totalBytes = records.reduce((sum, record) => sum + record.bytes, 0);
    const timeSpanMs = records.length > 0 
      ? Math.max(...records.map(r => r.timestamp.getTime())) - Math.min(...records.map(r => r.timestamp.getTime()))
      : 1000;
    
    const bytesPerSecond = totalBytes / (timeSpanMs / 1000);
    
    if (bytesPerSecond > baseline.thresholds.maxBytesPerSecond) {
      const severity = Math.min(bytesPerSecond / baseline.thresholds.maxBytesPerSecond, 1.0);
      
      if (severity >= threshold) {
        anomalies.push({
          id: `volume-anomaly-${Date.now()}`,
          type: 'volume',
          severity,
          description: `Traffic volume ${bytesPerSecond.toFixed(0)} bytes/sec exceeds baseline of ${baseline.thresholds.maxBytesPerSecond.toFixed(0)} bytes/sec`,
          affectedNodes: [],
          affectedEdges: [],
          timeRange: {
            start: new Date(Math.min(...records.map(r => r.timestamp.getTime()))),
            end: new Date(Math.max(...records.map(r => r.timestamp.getTime()))),
          },
          evidence: {
            statisticalSignificance: severity,
            deviationFromBaseline: bytesPerSecond - baseline.thresholds.maxBytesPerSecond,
            relatedRecords: records.slice(0, 10), // Sample of records
            patterns: ['high-volume'],
          },
        });
      }
    }

    return anomalies;
  }

  private detectPatternAnomalies(
    records: FlowLogRecord[],
    baseline: TrafficBaseline,
    threshold: number
  ): TrafficAnomaly[] {
    // Simplified pattern anomaly detection
    return [];
  }

  private detectDestinationAnomalies(
    records: FlowLogRecord[],
    baseline: TrafficBaseline,
    threshold: number
  ): TrafficAnomaly[] {
    const anomalies: TrafficAnomaly[] = [];
    
    const uniqueDestinations = new Set(records.map(r => r.destinationIP)).size;
    
    if (uniqueDestinations > baseline.thresholds.maxUniqueDestinations) {
      const severity = Math.min(uniqueDestinations / baseline.thresholds.maxUniqueDestinations - 1, 1.0);
      
      if (severity >= threshold) {
        anomalies.push({
          id: `destination-anomaly-${Date.now()}`,
          type: 'destination',
          severity,
          description: `Unusual number of destinations: ${uniqueDestinations} (baseline: ${baseline.thresholds.maxUniqueDestinations})`,
          affectedNodes: [],
          affectedEdges: [],
          timeRange: {
            start: new Date(Math.min(...records.map(r => r.timestamp.getTime()))),
            end: new Date(Math.max(...records.map(r => r.timestamp.getTime()))),
          },
          evidence: {
            statisticalSignificance: severity,
            deviationFromBaseline: uniqueDestinations - baseline.thresholds.maxUniqueDestinations,
            relatedRecords: records.slice(0, 10),
            patterns: ['unusual-destinations'],
          },
        });
      }
    }

    return anomalies;
  }

  private detectProtocolAnomalies(
    records: FlowLogRecord[],
    baseline: TrafficBaseline,
    threshold: number
  ): TrafficAnomaly[] {
    const anomalies: TrafficAnomaly[] = [];
    
    const unusualProtocols = records.filter(record => 
      !baseline.thresholds.normalProtocols.has(record.protocol)
    );

    if (unusualProtocols.length > 0) {
      const severity = unusualProtocols.length / records.length;
      
      if (severity >= threshold) {
        anomalies.push({
          id: `protocol-anomaly-${Date.now()}`,
          type: 'protocol',
          severity,
          description: `Unusual protocols detected: ${[...new Set(unusualProtocols.map(r => r.protocol))].join(', ')}`,
          affectedNodes: [],
          affectedEdges: [],
          timeRange: {
            start: new Date(Math.min(...records.map(r => r.timestamp.getTime()))),
            end: new Date(Math.max(...records.map(r => r.timestamp.getTime()))),
          },
          evidence: {
            statisticalSignificance: severity,
            deviationFromBaseline: unusualProtocols.length,
            relatedRecords: unusualProtocols.slice(0, 10),
            patterns: ['unusual-protocols'],
          },
        });
      }
    }

    return anomalies;
  }

  private detectTimingAnomalies(
    records: FlowLogRecord[],
    baseline: TrafficBaseline,
    threshold: number
  ): TrafficAnomaly[] {
    const anomalies: TrafficAnomaly[] = [];
    
    // Detect off-hours traffic
    const offHoursRecords = records.filter(record => {
      const hour = record.timestamp.getHours();
      return hour < 6 || hour > 22; // Outside business hours
    });

    if (offHoursRecords.length > 0) {
      const severity = Math.min(offHoursRecords.length / records.length, 1.0);
      
      if (severity >= threshold) {
        anomalies.push({
          id: `timing-anomaly-${Date.now()}`,
          type: 'timing',
          severity,
          description: `Unusual off-hours traffic: ${offHoursRecords.length} connections outside business hours`,
          affectedNodes: [],
          affectedEdges: [],
          timeRange: {
            start: new Date(Math.min(...records.map(r => r.timestamp.getTime()))),
            end: new Date(Math.max(...records.map(r => r.timestamp.getTime()))),
          },
          evidence: {
            statisticalSignificance: severity,
            deviationFromBaseline: offHoursRecords.length,
            relatedRecords: offHoursRecords.slice(0, 10),
            patterns: ['off-hours-traffic'],
          },
        });
      }
    }

    return anomalies;
  }

  private analyzeUnusualPorts(records: FlowLogRecord[]): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    const commonPorts = new Set([22, 23, 25, 53, 80, 110, 143, 443, 993, 995, 3389]);
    
    const unusualPortRecords = records.filter(record => 
      !commonPorts.has(record.destinationPort) && record.destinationPort > 1024
    );

    if (unusualPortRecords.length > 0) {
      const unusualPorts = [...new Set(unusualPortRecords.map(r => r.destinationPort))];
      
      issues.push({
        id: `unusual-ports-${Date.now()}`,
        type: 'unusual-port',
        severity: unusualPortRecords.length > records.length * 0.1 ? 'high' : 'medium',
        nodeIds: [],
        edgeIds: [],
        description: `Unusual ports detected: ${unusualPorts.join(', ')}`,
        recommendation: 'Review traffic to unusual ports for potential security risks',
        firstDetected: new Date(Math.min(...unusualPortRecords.map(r => r.timestamp.getTime()))),
        lastSeen: new Date(Math.max(...unusualPortRecords.map(r => r.timestamp.getTime()))),
      });
    }

    return issues;
  }

  private analyzeHighRejectionRates(connectionAnalysis: ConnectionAnalysis): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    
    if (connectionAnalysis.rejectionAnalysis.rejectionRate > 0.3) {
      issues.push({
        id: `high-rejection-rate-${Date.now()}`,
        type: 'high-rejection-rate',
        severity: connectionAnalysis.rejectionAnalysis.rejectionRate > 0.5 ? 'critical' : 'high',
        nodeIds: [],
        edgeIds: [],
        description: `High rejection rate: ${(connectionAnalysis.rejectionAnalysis.rejectionRate * 100).toFixed(1)}%`,
        recommendation: 'Investigate rejected connections for potential security threats or misconfigurations',
        firstDetected: new Date(),
        lastSeen: new Date(),
      });
    }

    return issues;
  }

  private analyzeSuspiciousTraffic(records: FlowLogRecord[]): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    
    // Large data transfers
    const largeTransfers = records.filter(record => record.bytes > 10000000); // 10MB
    
    if (largeTransfers.length > 0) {
      issues.push({
        id: `large-transfers-${Date.now()}`,
        type: 'suspicious-traffic',
        severity: 'medium',
        nodeIds: [],
        edgeIds: [],
        description: `${largeTransfers.length} large data transfers detected (>10MB each)`,
        recommendation: 'Review large data transfers for potential data exfiltration',
        firstDetected: new Date(Math.min(...largeTransfers.map(r => r.timestamp.getTime()))),
        lastSeen: new Date(Math.max(...largeTransfers.map(r => r.timestamp.getTime()))),
      });
    }

    return issues;
  }

  private analyzeAnomalousPatterns(records: FlowLogRecord[]): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    
    // Port scanning detection (many different ports from same source)
    const sourcePortMap = new Map<string, Set<number>>();
    
    for (const record of records) {
      if (!sourcePortMap.has(record.sourceIP)) {
        sourcePortMap.set(record.sourceIP, new Set());
      }
      sourcePortMap.get(record.sourceIP)!.add(record.destinationPort);
    }

    for (const [sourceIP, ports] of sourcePortMap.entries()) {
      if (ports.size > 10) { // More than 10 different ports
        issues.push({
          id: `port-scan-${sourceIP}-${Date.now()}`,
          type: 'anomalous-pattern',
          severity: ports.size > 50 ? 'critical' : 'high',
          nodeIds: [],
          edgeIds: [],
          description: `Potential port scanning from ${sourceIP}: ${ports.size} different ports accessed`,
          recommendation: 'Investigate source IP for potential scanning activity',
          firstDetected: new Date(),
          lastSeen: new Date(),
        });
      }
    }

    return issues;
  }
}