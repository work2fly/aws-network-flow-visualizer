import { FlowLogRecord, VPCFlowLogFilters, QueryExecutionResult } from '../../shared/types';
import { CloudWatchInsightsClient, QueryParams } from './cloudwatch-insights-client';

export interface VPCQueryParams {
  logGroupNames: string[];
  startTime: Date;
  endTime: Date;
  filters?: VPCFlowLogFilters;
  limit?: number;
}

export interface VPCFlowLogQueryBuilder {
  buildQuery(filters?: VPCFlowLogFilters): string;
  executeQuery(params: VPCQueryParams): Promise<QueryExecutionResult>;
  validateFilters(filters: VPCFlowLogFilters): { valid: boolean; errors: string[] };
}

/**
 * VPC Flow Log query builder for CloudWatch Insights
 * Constructs and executes queries for VPC Flow Log data
 */
export class VPCFlowLogQueryBuilder implements VPCFlowLogQueryBuilder {
  private client: CloudWatchInsightsClient;

  constructor(client: CloudWatchInsightsClient) {
    this.client = client;
  }

  /**
   * Build CloudWatch Insights query for VPC Flow Logs
   */
  buildQuery(filters?: VPCFlowLogFilters): string {
    let query = 'fields @timestamp, srcaddr, dstaddr, srcport, dstport, protocol, action, bytes, packets';
    
    // Add optional fields if available
    query += ', `account-id`, `vpc-id`, `subnet-id`, `instance-id`';
    
    // Add WHERE clauses based on filters
    const whereConditions: string[] = [];

    if (filters) {
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

      // Action filters (ACCEPT/REJECT)
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

      // Account ID filters
      if (filters.accountIds && filters.accountIds.length > 0) {
        const accountConditions = filters.accountIds.map(accountId => 
          `\`account-id\` = "${this.sanitizeString(accountId)}"`
        );
        whereConditions.push(`(${accountConditions.join(' or ')})`);
      }

      // Minimum bytes filter
      if (filters.minBytes && filters.minBytes > 0) {
        whereConditions.push(`bytes >= ${filters.minBytes}`);
      }

      // Maximum bytes filter
      if (filters.maxBytes && filters.maxBytes > 0) {
        whereConditions.push(`bytes <= ${filters.maxBytes}`);
      }

      // Minimum packets filter
      if (filters.minPackets && filters.minPackets > 0) {
        whereConditions.push(`packets >= ${filters.minPackets}`);
      }

      // Maximum packets filter
      if (filters.maxPackets && filters.maxPackets > 0) {
        whereConditions.push(`packets <= ${filters.maxPackets}`);
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
   * Execute VPC Flow Log query
   */
  async executeQuery(
    params: VPCQueryParams,
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
   * Validate VPC Flow Log filters
   */
  validateFilters(filters: VPCFlowLogFilters): { valid: boolean; errors: string[] } {
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
  private validateQueryParams(params: VPCQueryParams): { valid: boolean; errors: string[] } {
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

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if string is an IP range (CIDR notation)
   */
  private isIPRange(ip: string): boolean {
    return ip.includes('/');
  }

  /**
   * Build IP range condition for CIDR notation
   */
  private buildIPRangeCondition(field: string, ipRange: string): string {
    // For CloudWatch Insights, we'll use the cidr function if available
    // Otherwise, we'll need to expand the range or use like patterns
    const sanitizedRange = this.sanitizeString(ipRange);
    
    // Try to use CIDR function (may not be available in all regions)
    return `cidr("${sanitizedRange}") = ${field}`;
  }

  /**
   * Validate IP address or CIDR range
   */
  private isValidIPOrRange(ip: string): boolean {
    // Basic IP validation - could be enhanced with more robust validation
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}(\/\d{1,3})?$/;
    
    if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip)) {
      return false;
    }

    // Additional validation for IPv4 octets
    if (ip.includes('.')) {
      const parts = ip.split('/')[0].split('.');
      for (const part of parts) {
        const num = parseInt(part, 10);
        if (num < 0 || num > 255) {
          return false;
        }
      }
    }
    
    return true;
  }

  /**
   * Validate port number or range
   */
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

  /**
   * Validate protocol
   */
  private isValidProtocol(protocol: string): boolean {
    const validProtocols = ['tcp', 'udp', 'icmp', 'gre', 'esp', 'ah'];
    const protocolLower = protocol.toLowerCase();
    
    // Check if it's a known protocol name
    if (validProtocols.includes(protocolLower)) {
      return true;
    }

    // Check if it's a valid protocol number
    const protocolNum = parseInt(protocol, 10);
    return !isNaN(protocolNum) && protocolNum >= 0 && protocolNum <= 255;
  }

  /**
   * Get protocol number from protocol name
   */
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

  /**
   * Sanitize IP address for query
   */
  private sanitizeIP(ip: string): string {
    return ip.replace(/[^0-9a-fA-F:.\/]/g, '');
  }

  /**
   * Sanitize string for query
   */
  private sanitizeString(str: string): string {
    return str.replace(/['"\\]/g, '');
  }
}