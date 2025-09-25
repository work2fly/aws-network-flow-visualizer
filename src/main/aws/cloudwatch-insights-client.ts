import {
  CloudWatchLogsClient,
  StartQueryCommand,
  GetQueryResultsCommand,
  DescribeLogGroupsCommand,
  StartQueryCommandInput,
  GetQueryResultsCommandInput,
  QueryStatus,
  ResultField,
} from '@aws-sdk/client-cloudwatch-logs';
import { CredentialProvider } from '@aws-sdk/types';
import { FlowLogRecord, QueryExecutionResult, QueryProgress } from '../../shared/types';

export interface CloudWatchInsightsConfig {
  region: string;
  credentials: CredentialProvider;
}

export interface QueryParams {
  logGroupNames: string[];
  startTime: Date;
  endTime: Date;
  queryString: string;
  limit?: number;
}

export interface QueryExecution {
  queryId: string;
  status: QueryStatus;
  progress?: QueryProgress;
  results?: FlowLogRecord[];
  error?: string;
}

/**
 * CloudWatch Insights client for querying VPC and Transit Gateway flow logs
 */
export class CloudWatchInsightsClient {
  private client: CloudWatchLogsClient;

  constructor(config: CloudWatchInsightsConfig) {
    this.client = new CloudWatchLogsClient({
      region: config.region,
      credentials: config.credentials,
    });
  }

  /**
   * Start a CloudWatch Insights query
   */
  async startQuery(params: QueryParams): Promise<string> {
    try {
      const command = new StartQueryCommand({
        logGroupNames: params.logGroupNames,
        startTime: Math.floor(params.startTime.getTime() / 1000),
        endTime: Math.floor(params.endTime.getTime() / 1000),
        queryString: params.queryString,
        limit: params.limit || 10000,
      });

      const response = await this.client.send(command);
      
      if (!response.queryId) {
        throw new Error('Failed to start query - no query ID returned');
      }

      return response.queryId;
    } catch (error) {
      throw new Error(`Failed to start CloudWatch Insights query: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get query results and status
   */
  async getQueryResults(queryId: string): Promise<QueryExecution> {
    try {
      const command = new GetQueryResultsCommand({ queryId });
      const response = await this.client.send(command);

      const execution: QueryExecution = {
        queryId,
        status: response.status || QueryStatus.Unknown,
      };

      // Add progress information if available
      if (response.statistics) {
        execution.progress = {
          recordsMatched: response.statistics.recordsMatched || 0,
          recordsScanned: response.statistics.recordsScanned || 0,
          bytesScanned: response.statistics.bytesScanned || 0,
        };
      }

      // Process results if query is complete
      if (response.status === QueryStatus.Complete && response.results) {
        execution.results = this.parseQueryResults(response.results);
      }

      // Handle errors
      if (response.status === QueryStatus.Failed) {
        execution.error = 'Query execution failed';
      }

      return execution;
    } catch (error) {
      return {
        queryId,
        status: QueryStatus.Failed,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Poll query until completion or timeout
   */
  async executeQuery(
    params: QueryParams,
    onProgress?: (progress: QueryProgress) => void,
    timeoutMs: number = 300000 // 5 minutes default
  ): Promise<QueryExecutionResult> {
    try {
      const queryId = await this.startQuery(params);
      const startTime = Date.now();

      while (Date.now() - startTime < timeoutMs) {
        const execution = await this.getQueryResults(queryId);

        // Report progress if callback provided
        if (onProgress && execution.progress) {
          onProgress(execution.progress);
        }

        switch (execution.status) {
          case QueryStatus.Complete:
            return {
              success: true,
              queryId,
              results: execution.results || [],
              statistics: execution.progress,
            };

          case QueryStatus.Failed:
          case QueryStatus.Cancelled:
            return {
              success: false,
              queryId,
              error: execution.error || `Query ${execution.status.toLowerCase()}`,
            };

          case QueryStatus.Running:
          case QueryStatus.Scheduled:
            // Continue polling
            await this.sleep(2000); // Wait 2 seconds before next poll
            break;

          default:
            throw new Error(`Unknown query status: ${execution.status}`);
        }
      }

      // Timeout reached
      return {
        success: false,
        queryId,
        error: 'Query execution timeout',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Cancel a running query
   */
  async cancelQuery(queryId: string): Promise<void> {
    try {
      const { StopQueryCommand } = await import('@aws-sdk/client-cloudwatch-logs');
      const command = new StopQueryCommand({ queryId });
      await this.client.send(command);
    } catch (error) {
      throw new Error(`Failed to cancel query: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List available log groups for flow logs
   */
  async getFlowLogGroups(prefix?: string): Promise<string[]> {
    try {
      const command = new DescribeLogGroupsCommand({
        logGroupNamePrefix: prefix,
        limit: 50,
      });

      const response = await this.client.send(command);
      
      return (response.logGroups || [])
        .map(group => group.logGroupName)
        .filter((name): name is string => !!name)
        .filter(name => 
          name.includes('vpc-flow-logs') || 
          name.includes('tgw-flow-logs') ||
          name.includes('flowlogs')
        );
    } catch (error) {
      throw new Error(`Failed to list log groups: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse CloudWatch Insights query results into flow log records
   */
  private parseQueryResults(results: ResultField[][]): FlowLogRecord[] {
    const flowRecords: FlowLogRecord[] = [];

    for (const result of results) {
      try {
        const record = this.parseFlowLogRecord(result);
        if (record) {
          flowRecords.push(record);
        }
      } catch (error) {
        console.warn('Failed to parse flow log record:', error);
        // Continue processing other records
      }
    }

    return flowRecords;
  }

  /**
   * Parse individual flow log record from CloudWatch Insights result
   */
  private parseFlowLogRecord(fields: ResultField[]): FlowLogRecord | null {
    const fieldMap = new Map<string, string>();
    
    // Convert result fields to a map for easier access
    for (const field of fields) {
      if (field.field && field.value) {
        fieldMap.set(field.field, field.value);
      }
    }

    // Extract required fields
    const timestamp = fieldMap.get('@timestamp') || fieldMap.get('start');
    const sourceIP = fieldMap.get('srcaddr');
    const destinationIP = fieldMap.get('dstaddr');
    const sourcePort = fieldMap.get('srcport');
    const destinationPort = fieldMap.get('dstport');
    const protocol = fieldMap.get('protocol');
    const action = fieldMap.get('action');
    const bytes = fieldMap.get('bytes');
    const packets = fieldMap.get('packets');

    // Validate required fields
    if (!timestamp || !sourceIP || !destinationIP || !action) {
      return null;
    }

    // Parse and validate data
    const parsedTimestamp = new Date(timestamp);
    if (isNaN(parsedTimestamp.getTime())) {
      return null;
    }

    const parsedAction = action.toUpperCase();
    if (parsedAction !== 'ACCEPT' && parsedAction !== 'REJECT') {
      return null;
    }

    return {
      timestamp: parsedTimestamp,
      sourceIP,
      destinationIP,
      sourcePort: sourcePort ? parseInt(sourcePort, 10) : 0,
      destinationPort: destinationPort ? parseInt(destinationPort, 10) : 0,
      protocol: this.parseProtocol(protocol),
      action: parsedAction as 'ACCEPT' | 'REJECT',
      bytes: bytes ? parseInt(bytes, 10) : 0,
      packets: packets ? parseInt(packets, 10) : 0,
      // Optional fields
      accountId: fieldMap.get('account-id'),
      vpcId: fieldMap.get('vpc-id'),
      subnetId: fieldMap.get('subnet-id'),
      instanceId: fieldMap.get('instance-id'),
    };
  }

  /**
   * Convert protocol number to protocol name
   */
  private parseProtocol(protocol?: string): string {
    if (!protocol) return 'unknown';

    const protocolNum = parseInt(protocol, 10);
    if (isNaN(protocolNum)) return protocol.toLowerCase();

    // Common protocol mappings
    const protocolMap: Record<number, string> = {
      1: 'icmp',
      6: 'tcp',
      17: 'udp',
      47: 'gre',
      50: 'esp',
      51: 'ah',
    };

    return protocolMap[protocolNum] || `protocol-${protocolNum}`;
  }

  /**
   * Sleep utility for polling
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update client credentials
   */
  updateCredentials(credentials: CredentialProvider, region?: string): void {
    this.client = new CloudWatchLogsClient({
      region: region || this.client.config.region,
      credentials,
    });
  }

  /**
   * Get current region
   */
  getRegion(): string {
    return this.client.config.region as string;
  }
}