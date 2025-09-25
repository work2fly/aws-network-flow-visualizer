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
}

export interface NetworkNode {
  id: string;
  type: 'vpc' | 'subnet' | 'instance' | 'tgw' | 'vpn';
  label: string;
  properties: Record<string, unknown>;
  position?: { x: number; y: number };
}

export interface NetworkEdge {
  id: string;
  source: string;
  target: string;
  trafficStats: TrafficStatistics;
  flowRecords: FlowLogRecord[];
}

export interface NetworkTopology {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  metadata: TopologyMetadata;
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
