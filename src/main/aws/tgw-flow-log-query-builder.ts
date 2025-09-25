import { FlowLogRecord, TGWFlowLogFilters, QueryExecutionResult } from '../../shared/types';
import { CloudWatchInsightsClient, QueryParams } from './cloudwatch-insights-client';

export interface TGWQueryParams {
  logGroupNames: string[];
  startTime: Date;
  endTime: Date;
  filters?: TGWFlowLogFilters;
  limit?: number;
  crossAccountRoleArns?: string[]; // For cross-account queries
}

export interface CrossAccountQueryResult {
  accountId: string;
  result: QueryExecutionResult;
}

export interface TGWFlowLogQueryBuilder {
  buildQuery(filters?: TGWFlowLogFilters): string;
  executeQuery(params: TGWQueryParams): Promise<QueryExecutionResult>;
  executeCrossAccountQuery(params: TGWQueryParams): Promise<CrossAccountQueryResult[]>;
  validateFilters(filters: TGWFlowLogFilters): { valid: boolean; errors: string[] };
}

/**
 * Transit Gateway Flow Log query builder for CloudWatch Insights
 * Constructs and executes queries for TGW Flow Log data with cross-account support
 */
export class TGWFlowLogQueryBuilder implements TGWFlowLogQueryBuilder {
  private client: CloudWatchInsightsClient;
  private crossAccountClients: Map<string, CloudWatchInsightsClient> = new Map();

  constructor(client: CloudWatchInsightsClient) {
    this.client = client;
  }

  /**
   * Build CloudWatch Insights query for Transit Gateway Flow Logs
   */
  buildQuery(filters?: TGWFlowLogFilters): string {
    let query = 'fields @timestamp, srcaddr, dstaddr, srcport, dstport, protocol, action, bytes, packets';
    
    // Add TGW-specific fields
    query += ', `tgw-id`, `tgw-attachment-id`, `tgw-src-vpc-account-id`, `tgw-dst-vpc-account-id`';
    query += ', `tgw-pair-attachment-id`, `sublocation-type`, `sublocation-id`';
    
    // Add standard optional fields
    query += ', `account-id`, `vpc-id`, `subnet-id`, `instance-id`';
    
    // Add WHERE clauses based on filters
    const whereConditions: string[] = [];

    if (filters) {
      // Include all VPC Flow Log filters
      this.addVPCFilterConditions(filters, whereConditions);

      // Add TGW-specific filters
      
      // Transit Gateway ID filters
      if (filters.transitGatewayIds && filters.transitGatewayIds.length > 0) {
        const tgwConditions = filters.transitGatewayIds.map(tgwId => 
          `\`tgw-id\` = "${this.sanitizeString(tgwId)}"`
        );
        whereConditions.push(`(${tgwConditions.join(' or ')})`);
      }

      // Attachment ID filters
      if (filters.attachmentIds && filters.attachmentIds.length > 0) {
        const attachmentConditions = filters.attachmentIds.map(attachmentId => 
          `(\`tgw-attachment-id\` = "${this.sanitizeString(attachmentId)}" or \`tgw-pair-attachment-id\` = "${this.sanitizeString(attachmentId)}")`
        );
        whereConditions.push(`(${attachmentConditions.join(' or ')})`);
      }

      // Resource type filters (based on sublocation-type)
      if (filters.resourceTypes && filters.resourceTypes.length > 0) {
        const resourceConditions = filters.resourceTypes.map(resourceType => 
          `\`sublocation-type\` = "${this.sanitizeString(resourceType)}"`
        );
        whereConditions.push(`(${resourceConditions.join(' or ')})`);
      }

      // Cross-account filters
      if (filters.accountIds && filters.accountIds.length > 0) {
        const accountConditions = filters.accountIds.map(accountId => 
          `(\`account-id\` = "${this.sanitizeString(accountId)}" or \`tgw-src-vpc-account-id\` = "${this.sanitizeString(accountId)}" or \`tgw-dst-vpc-account-id\` = "${this.sanitizeString(accountId)}")`
        );
        whereConditions.push(`(${accountConditions.join(' or ')})`);
      }
    }

    // Add WHERE clause if conditions exist
    if (whereConditions.length > 0) {
      query += ` | filter ${whereConditions.join(' and ')}`;
    }

    // Sort by timestamp
    query += ' | sort @timestamp desc';

    return query;
  }

  /**
   * Execute Transit Gateway Flow Log query
   */
  async executeQuery(
    params: TGWQueryParams,
    onProgress?: (progress: any) => void
  ): Promise<QueryExecutionResult> {
    try {
      // Validate parameters
      const validation = this.validateQueryParams(params);
      if (!validation.valid) {
        return {
          success: false,
          error: `Invalid query parameters: ${validation.errors.join(', ')}`,
        };
      }

      // Build query string
      const queryString = this.buildQuery(params.filters);

      // Execute query
      const queryParams: QueryParams = {
        logGroupNames: params.logGroupNames,
        startTime: params.startTime,
        endTime: params.endTime,
        queryString,
        limit: params.limit,
      };

      return await this.client.executeQuery(queryParams, onProgress);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute cross-account Transit Gateway Flow Log queries
   */
  async executeCrossAccountQuery(
    params: TGWQueryParams,
    onProgress?: (accountId: string, progress: any) => void
  ): Promise<CrossAccountQueryResult[]> {
    const results: CrossAccountQueryResult[] = [];

    if (!params.crossAccountRoleArns || params.crossAccountRoleArns.length === 0) {
      // Execute single-account query
      const result = await this.executeQuery(params, onProgress ? (progress) => onProgress('current', progress) : undefined);
      results.push({
        accountId: 'current',
        result,
      });
      return results;
    }

    // Execute queries across multiple accounts
    const queryPromises = params.crossAccountRoleArns.map(async (roleArn) => {
      try {
        const accountId = this.extractAccountIdFromRoleArn(roleArn);
        
        // Get or create cross-account client
        const crossAccountClient = await this.getCrossAccountClient(roleArn);
        
        // Create temporary query builder for this account
        const crossAccountQueryBuilder = new TGWFlowLogQueryBuilder(crossAccountClient);
        
        // Execute query in the cross-account context
        const result = await crossAccountQueryBuilder.executeQuery(
          params,
          onProgress ? (progress) => onProgress(accountId, progress) : undefined
        );

        return {
          accountId,
          result,
        };
      } catch (error) {
        return {
          accountId: this.extractAccountIdFromRoleArn(roleArn),
          result: {
            success: false,
            error: error instanceof Error ? error.message : 'Cross-account query failed',
          },
        };
      }
    });

    const crossAccountResults = await Promise.all(queryPromises);
    results.push(...crossAccountResults);

    return results;
  }

  /**
   * Validate Transit Gateway Flow Log filters
   */
  validateFilters(filters: TGWFlowLogFilters): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate base VPC filters
    const baseValidation = this.validateVPCFilters(filters);
    errors.push(...baseValidation.errors);

    // Validate TGW-specific filters
    
    // Validate Transit Gateway IDs
    if (filters.transitGatewayIds) {
      for (const tgwId of filters.transitGatewayIds) {
        if (!this.isValidTGWId(tgwId)) {
          errors.push(`Invalid Transit Gateway ID: ${tgwId}`);
        }
      }
    }

    // Validate attachment IDs
    if (filters.attachmentIds) {
      for (const attachmentId of filters.attachmentIds) {
        if (!this.isValidAttachmentId(attachmentId)) {
          errors.push(`Invalid attachment ID: ${attachmentId}`);
        }
      }
    }

    // Validate resource types
    if (filters.resourceTypes) {
      const validResourceTypes = ['VPC', 'VPN', 'DirectConnect', 'PeeringConnection', 'TGW'];
      for (const resourceType of filters.resourceTypes) {
        if (!validResourceTypes.includes(resourceType)) {
          errors.push(`Invalid resource type: ${resourceType}. Valid types: ${validResourceTypes.join(', ')}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Add VPC filter conditions to the query
   */
  private addVPCFilterConditions(filters: TGWFlowLogFilters, whereConditions: string[]): void {
    // Source IP filters
    if (filters.sourceIPs && filters.sourceIPs.length > 0) {
      const ipConditions = filters.sourceIPs.map(ip => {
        if (this.isIPRange(ip)) {
          return this.buildIPRangeCondition('srcaddr', ip);
        } else {
          return `srcaddr = "${this.sanitizeIP(ip)}"`;
        }
      });
      whereConditions.push(`(${ipConditions.join(' or ')})`);
    }

    // Destination IP filters
    if (filters.destinationIPs && filters.destinationIPs.length > 0) {
      const ipConditions = filters.destinationIPs.map(ip => {
        if (this.isIPRange(ip)) {
          return this.buildIPRangeCondition('dstaddr', ip);
        } else {
          return `dstaddr = "${this.sanitizeIP(ip)}"`;
        }
      });
      whereConditions.push(`(${ipConditions.join(' or ')})`);
    }

    // Source port filters
    if (filters.sourcePorts && filters.sourcePorts.length > 0) {
      const portConditions = filters.sourcePorts.map(port => {
        if (typeof port === 'string' && port.includes('-')) {
          const [start, end] = port.split('-').map(p => parseInt(p.trim(), 10));
          return `(srcport >= ${start} and srcport <= ${end})`;
        } else {
          const portNum = typeof port === 'number' ? port : parseInt(port, 10);
          return `srcport = ${portNum}`;
        }
      });
      whereConditions.push(`(${portConditions.join(' or ')})`);
    }

    // Destination port filters
    if (filters.destinationPorts && filters.destinationPorts.length > 0) {
      const portConditions = filters.destinationPorts.map(port => {
        if (typeof port === 'string' && port.includes('-')) {
          const [start, end] = port.split('-').map(p => parseInt(p.trim(), 10));
          return `(dstport >= ${start} and dstport <= ${end})`;
        } else {
          const portNum = typeof port === 'number' ? port : parseInt(port, 10);
          return `dstport = ${portNum}`;
        }
      });
      whereConditions.push(`(${portConditions.join(' or ')})`);
    }

    // Protocol filters
    if (filters.protocols && filters.protocols.length > 0) {
      const protocolConditions = filters.protocols.map(protocol => {
        const protocolNum = this.getProtocolNumber(protocol);
        return `protocol = "${protocolNum}"`;
      });
      whereConditions.push(`(${protocolConditions.join(' or ')})`);
    }

    // Action filters
    if (filters.actions && filters.actions.length > 0) {
      const actionConditions = filters.actions.map(action => 
        `action = "${action.toUpperCase()}"`
      );
      whereConditions.push(`(${actionConditions.join(' or ')})`);
    }

    // VPC ID filters
    if (filters.vpcIds && filters.vpcIds.length > 0) {
      const vpcConditions = filters.vpcIds.map(vpcId => 
        `\`vpc-id\` = "${this.sanitizeString(vpcId)}"`
      );
      whereConditions.push(`(${vpcConditions.join(' or ')})`);
    }

    // Byte range filters
    if (filters.minBytes && filters.minBytes > 0) {
      whereConditions.push(`bytes >= ${filters.minBytes}`);
    }
    if (filters.maxBytes && filters.maxBytes > 0) {
      whereConditions.push(`bytes <= ${filters.maxBytes}`);
    }

    // Packet range filters
    if (filters.minPackets && filters.minPackets > 0) {
      whereConditions.push(`packets >= ${filters.minPackets}`);
    }
    if (filters.maxPackets && filters.maxPackets > 0) {
      whereConditions.push(`packets <= ${filters.maxPackets}`);
    }
  }

  /**
   * Validate VPC-level filters (reused from VPC query builder logic)
   */
  private validateVPCFilters(filters: TGWFlowLogFilters): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate IP addresses
    if (filters.sourceIPs) {
      for (const ip of filters.sourceIPs) {
        if (!this.isValidIPOrRange(ip)) {
          errors.push(`Invalid source IP or range: ${ip}`);
        }
      }
    }

    if (filters.destinationIPs) {
      for (const ip of filters.destinationIPs) {
        if (!this.isValidIPOrRange(ip)) {
          errors.push(`Invalid destination IP or range: ${ip}`);
        }
      }
    }

    // Validate ports
    if (filters.sourcePorts) {
      for (const port of filters.sourcePorts) {
        if (!this.isValidPortOrRange(port)) {
          errors.push(`Invalid source port or range: ${port}`);
        }
      }
    }

    if (filters.destinationPorts) {
      for (const port of filters.destinationPorts) {
        if (!this.isValidPortOrRange(port)) {
          errors.push(`Invalid destination port or range: ${port}`);
        }
      }
    }

    // Validate protocols
    if (filters.protocols) {
      for (const protocol of filters.protocols) {
        if (!this.isValidProtocol(protocol)) {
          errors.push(`Invalid protocol: ${protocol}`);
        }
      }
    }

    // Validate actions
    if (filters.actions) {
      for (const action of filters.actions) {
        if (!['ACCEPT', 'REJECT'].includes(action.toUpperCase())) {
          errors.push(`Invalid action: ${action}`);
        }
      }
    }

    // Validate byte ranges
    if (filters.minBytes && filters.maxBytes && filters.minBytes > filters.maxBytes) {
      errors.push('Minimum bytes cannot be greater than maximum bytes');
    }

    // Validate packet ranges
    if (filters.minPackets && filters.maxPackets && filters.minPackets > filters.maxPackets) {
      errors.push('Minimum packets cannot be greater than maximum packets');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate query parameters
   */
  private validateQueryParams(params: TGWQueryParams): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate log group names
    if (!params.logGroupNames || params.logGroupNames.length === 0) {
      errors.push('At least one log group name is required');
    }

    // Validate time range
    if (!params.startTime || !params.endTime) {
      errors.push('Start time and end time are required');
    } else if (params.startTime >= params.endTime) {
      errors.push('Start time must be before end time');
    }

    // Validate filters if provided
    if (params.filters) {
      const filterValidation = this.validateFilters(params.filters);
      errors.push(...filterValidation.errors);
    }

    // Validate cross-account role ARNs if provided
    if (params.crossAccountRoleArns) {
      for (const roleArn of params.crossAccountRoleArns) {
        if (!this.isValidRoleArn(roleArn)) {
          errors.push(`Invalid role ARN: ${roleArn}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get or create cross-account client
   */
  private async getCrossAccountClient(roleArn: string): Promise<CloudWatchInsightsClient> {
    if (this.crossAccountClients.has(roleArn)) {
      return this.crossAccountClients.get(roleArn)!;
    }

    // This would need to be implemented with actual role assumption logic
    // For now, we'll throw an error indicating this needs implementation
    throw new Error('Cross-account client creation not yet implemented. This requires role assumption logic.');
  }

  /**
   * Extract account ID from role ARN
   */
  private extractAccountIdFromRoleArn(roleArn: string): string {
    const match = roleArn.match(/arn:aws:iam::(\d{12}):role\//);
    return match ? match[1] : 'unknown';
  }

  /**
   * Validate Transit Gateway ID format
   */
  private isValidTGWId(tgwId: string): boolean {
    return /^tgw-[0-9a-f]{8,17}$/.test(tgwId);
  }

  /**
   * Validate attachment ID format
   */
  private isValidAttachmentId(attachmentId: string): boolean {
    return /^tgw-attach-[0-9a-f]{8,17}$/.test(attachmentId);
  }

  /**
   * Validate role ARN format
   */
  private isValidRoleArn(roleArn: string): boolean {
    return /^arn:aws:iam::\d{12}:role\/[\w+=,.@\/-]+$/.test(roleArn);
  }

  // Utility methods (shared with VPC query builder)
  private isIPRange(ip: string): boolean {
    return ip.includes('/');
  }

  private buildIPRangeCondition(field: string, ipRange: string): string {
    const sanitizedRange = this.sanitizeString(ipRange);
    return `cidr("${sanitizedRange}") = ${field}`;
  }

  private isValidIPOrRange(ip: string): boolean {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}(\/\d{1,3})?$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  private isValidPortOrRange(port: string | number): boolean {
    if (typeof port === 'number') {
      return port >= 0 && port <= 65535;
    }

    if (port.includes('-')) {
      const [start, end] = port.split('-').map(p => parseInt(p.trim(), 10));
      return !isNaN(start) && !isNaN(end) && start >= 0 && end <= 65535 && start <= end;
    }

    const portNum = parseInt(port, 10);
    return !isNaN(portNum) && portNum >= 0 && portNum <= 65535;
  }

  private isValidProtocol(protocol: string): boolean {
    const validProtocols = ['tcp', 'udp', 'icmp', 'gre', 'esp', 'ah'];
    const protocolLower = protocol.toLowerCase();
    
    if (validProtocols.includes(protocolLower)) {
      return true;
    }

    const protocolNum = parseInt(protocol, 10);
    return !isNaN(protocolNum) && protocolNum >= 0 && protocolNum <= 255;
  }

  private getProtocolNumber(protocol: string): string {
    const protocolMap: Record<string, string> = {
      'icmp': '1',
      'tcp': '6',
      'udp': '17',
      'gre': '47',
      'esp': '50',
      'ah': '51',
    };

    const protocolLower = protocol.toLowerCase();
    return protocolMap[protocolLower] || protocol;
  }

  private sanitizeIP(ip: string): string {
    return ip.replace(/[^0-9a-fA-F:.\/]/g, '');
  }

  private sanitizeString(str: string): string {
    return str.replace(/['"\\]/g, '');
  }
}