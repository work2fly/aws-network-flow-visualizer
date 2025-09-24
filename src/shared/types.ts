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

export interface AWSCredentials {
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  region: string;
  profile?: string;
}

export interface ConnectionStatus {
  connected: boolean;
  region?: string;
  accountId?: string;
  error?: string;
}
