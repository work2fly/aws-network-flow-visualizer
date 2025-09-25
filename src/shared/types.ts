// Shared type definitions used across main and renderer processes

export interface FlowLogRecord {
  timestamp: Date;
  sourceIP: string;
  destinationIP: string;
  sourcePort: number;
  destinationPort: number;
  protocol: string;
  action: 'ACCEPT' | 'REJECT';
  bytes: number;
  packets: number;
  accountId?: string;
  vpcId?: string;
  subnetId?: string;
  instanceId?: string;
  // Additional fields for enhanced analysis
  interfaceId?: string;
  flowDirection?: 'ingress' | 'egress';
  packetSourceAddr?: string;
  packetDestinationAddr?: string;
  region?: string;
  availabilityZone?: string;
  // Transit Gateway specific fields
  transitGatewayId?: string;
  transitGatewayAttachmentId?: string;
  resourceType?: string;
  targetResourceId?: string;
}

// Validation interface for flow log records
export interface FlowLogValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Enhanced validation functions
export interface FlowLogValidator {
  validateRecord(record: Partial<FlowLogRecord>): FlowLogValidationResult;
  validateBatch(records: Partial<FlowLogRecord>[]): {
    validRecords: FlowLogRecord[];
    invalidRecords: Array<{ record: Partial<FlowLogRecord>; errors: string[] }>;
    summary: { total: number; valid: number; invalid: number };
  };
}

export interface NetworkNode {
  id: string;
  type: NodeType;
  label: string;
  properties: NodeProperties;
  position?: { x: number; y: number };
  // Visual properties for rendering
  size?: number;
  color?: string;
  shape?: string;
  // Metadata
  metadata: NodeMetadata;
}

export type NodeType = 'vpc' | 'subnet' | 'instance' | 'tgw' | 'vpn' | 'internet-gateway' | 'nat-gateway' | 'load-balancer' | 'unknown';

export interface NodeProperties {
  // Common properties
  name?: string;
  region?: string;
  accountId?: string;
  availabilityZone?: string;
  // VPC specific
  cidrBlock?: string;
  isDefault?: boolean;
  // Subnet specific
  subnetType?: 'public' | 'private';
  // Instance specific
  instanceType?: string;
  state?: string;
  privateIpAddress?: string;
  publicIpAddress?: string;
  // Transit Gateway specific
  amazonSideAsn?: number;
  autoAcceptSharedAttachments?: boolean;
  defaultRouteTableAssociation?: boolean;
  defaultRouteTablePropagation?: boolean;
  // VPN specific
  vpnConnectionId?: string;
  customerGatewayId?: string;
  vpnGatewayId?: string;
  // Additional properties
  tags?: Record<string, string>;
  [key: string]: unknown;
}

export interface NodeMetadata {
  createdAt?: Date;
  lastSeen?: Date;
  trafficVolume?: number;
  connectionCount?: number;
  isActive?: boolean;
  confidence?: number; // 0-1 confidence in node identification
}

export interface NetworkEdge {
  id: string;
  source: string;
  target: string;
  trafficStats: EdgeTrafficStatistics;
  flowRecords: FlowLogRecord[];
  // Edge properties
  properties: EdgeProperties;
  // Visual properties
  style?: EdgeStyle;
  // Metadata
  metadata: EdgeMetadata;
}

export interface EdgeProperties {
  connectionType?: 'direct' | 'routed' | 'peered' | 'vpn' | 'internet';
  protocols: string[];
  ports: number[];
  bidirectional?: boolean;
  // Security properties
  hasRejectedConnections?: boolean;
  rejectionRate?: number;
  // Performance properties
  averageLatency?: number;
  packetLossRate?: number;
}

export interface EdgeStyle {
  width?: number;
  color?: string;
  opacity?: number;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  animated?: boolean;
  arrowSize?: number;
}

export interface EdgeMetadata {
  firstSeen?: Date;
  lastSeen?: Date;
  isActive?: boolean;
  confidence?: number;
  anomalyScore?: number;
}

export interface EdgeTrafficStatistics extends TrafficStatistics {
  // Direction-specific statistics
  sourceToTargetBytes: number;
  targetToSourceBytes: number;
  sourceToTargetPackets: number;
  targetToSourcePackets: number;
  // Connection patterns
  peakTrafficTime?: Date;
  averageBytesPerConnection?: number;
  connectionDuration?: number;
}

export interface NetworkTopology {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  metadata: TopologyMetadata;
  // Hierarchical structure
  hierarchy?: TopologyHierarchy;
  // Layout information
  layout?: TopologyLayout;
  // Analysis results
  analysis?: TopologyAnalysis;
}

export interface TopologyHierarchy {
  regions: Map<string, RegionInfo>;
  vpcs: Map<string, VPCInfo>;
  subnets: Map<string, SubnetInfo>;
  instances: Map<string, InstanceInfo>;
}

export interface RegionInfo {
  id: string;
  name: string;
  vpcs: string[];
  transitGateways: string[];
}

export interface VPCInfo {
  id: string;
  name?: string;
  cidrBlock: string;
  region: string;
  accountId: string;
  subnets: string[];
  instances: string[];
  isDefault: boolean;
}

export interface SubnetInfo {
  id: string;
  name?: string;
  cidrBlock: string;
  vpcId: string;
  availabilityZone: string;
  type: 'public' | 'private';
  instances: string[];
}

export interface InstanceInfo {
  id: string;
  name?: string;
  type: string;
  subnetId: string;
  privateIpAddress: string;
  publicIpAddress?: string;
  state: string;
}

export interface TopologyLayout {
  algorithm: 'hierarchical' | 'force-directed' | 'circular' | 'grid';
  parameters: Record<string, unknown>;
  bounds?: { x: number; y: number; width: number; height: number };
}

export interface TopologyAnalysis {
  connectedComponents: number;
  isolatedNodes: string[];
  criticalPaths: CriticalPath[];
  bottlenecks: Bottleneck[];
  securityIssues: SecurityIssue[];
}

export interface TrafficStatistics {
  totalBytes: number;
  totalPackets: number;
  acceptedConnections: number;
  rejectedConnections: number;
  uniqueSourceIPs: number;
  uniqueDestinationIPs: number;
  topPorts: PortStatistic[];
  timeRange: { start: Date; end: Date };
  // Enhanced statistics
  bytesPerSecond?: number;
  packetsPerSecond?: number;
  connectionsPerSecond?: number;
  averagePacketSize?: number;
  protocolDistribution: ProtocolDistribution[];
  // Anomaly indicators
  anomalousConnections?: number;
  suspiciousTraffic?: number;
  unusualPorts?: number[];
}

export interface ProtocolDistribution {
  protocol: string;
  bytes: number;
  packets: number;
  connections: number;
  percentage: number;
}

export interface PortStatistic {
  port: number;
  protocol: string;
  connections: number;
  bytes: number;
}

export interface TopologyMetadata {
  lastUpdated: Date;
  recordCount: number;
  timeRange: { start: Date; end: Date };
  // Processing information
  processingTime?: number;
  dataSource?: string;
  version?: string;
  // Quality metrics
  completeness?: number; // 0-1 score
  accuracy?: number; // 0-1 score
  freshness?: number; // 0-1 score based on data age
}

// Additional analysis types
export interface CriticalPath {
  id: string;
  nodes: string[];
  edges: string[];
  trafficVolume: number;
  importance: number;
}

export interface Bottleneck {
  nodeId: string;
  type: 'bandwidth' | 'connections' | 'latency';
  severity: 'low' | 'medium' | 'high' | 'critical';
  impact: number;
  description: string;
}

export interface SecurityIssue {
  id: string;
  type: 'unusual-port' | 'high-rejection-rate' | 'suspicious-traffic' | 'anomalous-pattern';
  severity: 'low' | 'medium' | 'high' | 'critical';
  nodeIds: string[];
  edgeIds: string[];
  description: string;
  recommendation?: string;
  firstDetected: Date;
  lastSeen: Date;
}

// Traffic pattern analysis types
export interface TrafficPattern {
  id: string;
  type: 'periodic' | 'burst' | 'baseline' | 'anomalous';
  confidence: number;
  timeRange: { start: Date; end: Date };
  characteristics: PatternCharacteristics;
}

export interface PatternCharacteristics {
  frequency?: number; // For periodic patterns
  amplitude?: number; // Traffic volume variation
  duration?: number; // Pattern duration in ms
  nodes: string[];
  protocols: string[];
  ports: number[];
}

// Anomaly detection types
export interface AnomalyDetectionResult {
  anomalies: TrafficAnomaly[];
  baseline: TrafficBaseline;
  confidence: number;
  analysisTime: Date;
}

export interface TrafficAnomaly {
  id: string;
  type: 'volume' | 'pattern' | 'destination' | 'protocol' | 'timing';
  severity: number; // 0-1 scale
  description: string;
  affectedNodes: string[];
  affectedEdges: string[];
  timeRange: { start: Date; end: Date };
  evidence: AnomalyEvidence;
}

export interface AnomalyEvidence {
  statisticalSignificance: number;
  deviationFromBaseline: number;
  relatedRecords: FlowLogRecord[];
  patterns: string[];
}

export interface TrafficBaseline {
  establishedAt: Date;
  sampleSize: number;
  timeRange: { start: Date; end: Date };
  normalPatterns: TrafficPattern[];
  thresholds: BaselineThresholds;
}

export interface BaselineThresholds {
  maxBytesPerSecond: number;
  maxConnectionsPerSecond: number;
  maxUniqueDestinations: number;
  normalPorts: Set<number>;
  normalProtocols: Set<string>;
}

// AWS Authentication Types
export interface AWSCredentials {
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  region: string;
  profile?: string;
  expiration?: Date;
}

export interface ConnectionStatus {
  connected: boolean;
  region?: string;
  accountId?: string;
  error?: string;
  lastChecked?: Date;
  credentialType?: CredentialType;
}

export type CredentialType = 'sso' | 'profile' | 'role' | 'environment' | 'instance';

export interface SSOConfig {
  startUrl: string;
  region: string;
  accountId?: string;
  roleName?: string;
  sessionName?: string;
}

export interface ProfileConfig {
  profileName: string;
  region?: string;
}

export interface RoleConfig {
  roleArn: string;
  sessionName?: string;
  externalId?: string;
  region?: string;
  durationSeconds?: number;
  mfaSerial?: string;
  mfaToken?: string;
}

export interface CredentialValidationResult {
  valid: boolean;
  error?: string;
  accountId?: string;
  region?: string;
  expiration?: Date;
  credentialType?: CredentialType;
}

export interface AWSProfile {
  name: string;
  region?: string;
  output?: string;
  ssoStartUrl?: string;
  ssoRegion?: string;
  ssoAccountId?: string;
  ssoRoleName?: string;
  roleArn?: string;
  sourceProfile?: string;
}

export interface CredentialChainOptions {
  preferredCredentialTypes?: CredentialType[];
  ssoConfig?: SSOConfig;
  profileConfig?: ProfileConfig;
  roleConfig?: RoleConfig;
}

// CloudWatch Insights Query Types
export interface QueryProgress {
  recordsMatched: number;
  recordsScanned: number;
  bytesScanned: number;
}

export interface QueryExecutionResult {
  success: boolean;
  queryId?: string;
  results?: FlowLogRecord[];
  statistics?: QueryProgress;
  error?: string;
}

export interface VPCFlowLogFilters {
  sourceIPs?: string[];
  destinationIPs?: string[];
  sourcePorts?: (string | number)[];
  destinationPorts?: (string | number)[];
  protocols?: string[];
  actions?: ('ACCEPT' | 'REJECT')[];
  vpcIds?: string[];
  accountIds?: string[];
  minBytes?: number;
  maxBytes?: number;
  minPackets?: number;
  maxPackets?: number;
}

export interface TGWFlowLogFilters extends VPCFlowLogFilters {
  transitGatewayIds?: string[];
  attachmentIds?: string[];
  resourceTypes?: string[];
}
