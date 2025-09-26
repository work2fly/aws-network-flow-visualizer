import { EventEmitter } from 'events';
import { CloudWatchInsightsClient } from './cloudwatch-insights-client';
import { VPCFlowLogQueryBuilder, VPCQueryParams } from './vpc-flow-log-query-builder';
import { TGWFlowLogQueryBuilder, TGWQueryParams, CrossAccountQueryResult } from './tgw-flow-log-query-builder';
import { AWSCredentialManager } from './credential-manager';
import { 
  FlowLogRecord, 
  QueryExecutionResult, 
  QueryProgress,
  VPCFlowLogFilters,
  TGWFlowLogFilters 
} from '../../shared/types';

export interface QueryEngineConfig {
  credentialManager: AWSCredentialManager;
  region: string;
  cacheEnabled?: boolean;
  cacheTTLMs?: number;
  maxConcurrentQueries?: number;
  networkSecurityManager?: any; // NetworkSecurityManager type
}

export interface QueryExecutionOptions {
  enableProgress?: boolean;
  timeoutMs?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
}

export interface CachedQueryResult {
  result: QueryExecutionResult;
  timestamp: Date;
  ttl: number;
}

export interface QueryMetrics {
  executionTimeMs: number;
  recordsReturned: number;
  bytesScanned: number;
  recordsScanned: number;
  cacheHit: boolean;
}

/**
 * Flow Log Query Engine
 * Orchestrates query execution, caching, and data processing for VPC and TGW flow logs
 */
export class FlowLogQueryEngine extends EventEmitter {
  private client!: CloudWatchInsightsClient;
  private vpcQueryBuilder!: VPCFlowLogQueryBuilder;
  private tgwQueryBuilder!: TGWFlowLogQueryBuilder;
  private credentialManager: AWSCredentialManager;
  private queryCache: Map<string, CachedQueryResult> = new Map();
  private activeQueries: Map<string, Promise<any>> = new Map();
  private config: Required<Omit<QueryEngineConfig, 'networkSecurityManager'>> & { networkSecurityManager?: any };

  constructor(config: QueryEngineConfig) {
    super();
    
    this.config = {
      ...config,
      cacheEnabled: config.cacheEnabled ?? true,
      cacheTTLMs: config.cacheTTLMs ?? 300000, // 5 minutes default
      maxConcurrentQueries: config.maxConcurrentQueries ?? 5,
    };

    this.credentialManager = config.credentialManager;
    this.initializeClients();
  }

  /**
   * Initialize CloudWatch Insights client and query builders
   */
  private initializeClients(): void {
    const credentials = this.credentialManager.getCurrentCredentials();
    if (!credentials) {
      throw new Error('No AWS credentials available');
    }

    const stsClient = this.credentialManager.getSTSClient();
    if (!stsClient) {
      throw new Error('No STS client available');
    }

    this.client = new CloudWatchInsightsClient({
      region: this.config.region,
      credentials: stsClient.config.credentials!,
      networkSecurityManager: this.config.networkSecurityManager,
    });

    this.vpcQueryBuilder = new VPCFlowLogQueryBuilder(this.client);
    this.tgwQueryBuilder = new TGWFlowLogQueryBuilder(this.client);
  }

  /**
   * Execute VPC Flow Log query with caching and progress tracking
   */
  async executeVPCQuery(
    params: VPCQueryParams,
    options: QueryExecutionOptions = {}
  ): Promise<{ result: QueryExecutionResult; metrics: QueryMetrics }> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey('vpc', params);
    
    // Check cache first
    if (this.config.cacheEnabled) {
      const cachedResult = this.getCachedResult(cacheKey);
      if (cachedResult) {
        this.emit('queryComplete', {
          type: 'vpc',
          cached: true,
          result: cachedResult.result,
        });

        return {
          result: cachedResult.result,
          metrics: {
            executionTimeMs: Date.now() - startTime,
            recordsReturned: cachedResult.result.results?.length || 0,
            bytesScanned: cachedResult.result.statistics?.bytesScanned || 0,
            recordsScanned: cachedResult.result.statistics?.recordsScanned || 0,
            cacheHit: true,
          },
        };
      }
    }

    // Check if query is already running
    if (this.activeQueries.has(cacheKey)) {
      const result = await this.activeQueries.get(cacheKey)!;
      return {
        result,
        metrics: {
          executionTimeMs: Date.now() - startTime,
          recordsReturned: result.results?.length || 0,
          bytesScanned: result.statistics?.bytesScanned || 0,
          recordsScanned: result.statistics?.recordsScanned || 0,
          cacheHit: false,
        },
      };
    }

    // Execute new query
    const queryPromise = this.executeVPCQueryInternal(params, options);
    this.activeQueries.set(cacheKey, queryPromise);

    try {
      const result = await queryPromise;
      
      // Cache successful results
      if (this.config.cacheEnabled && result.success) {
        this.cacheResult(cacheKey, result);
      }

      this.emit('queryComplete', {
        type: 'vpc',
        cached: false,
        result,
      });

      return {
        result,
        metrics: {
          executionTimeMs: Date.now() - startTime,
          recordsReturned: result.results?.length || 0,
          bytesScanned: result.statistics?.bytesScanned || 0,
          recordsScanned: result.statistics?.recordsScanned || 0,
          cacheHit: false,
        },
      };
    } finally {
      this.activeQueries.delete(cacheKey);
    }
  }

  /**
   * Execute Transit Gateway Flow Log query with cross-account support
   */
  async executeTGWQuery(
    params: TGWQueryParams,
    options: QueryExecutionOptions = {}
  ): Promise<{ result: QueryExecutionResult; crossAccountResults?: CrossAccountQueryResult[]; metrics: QueryMetrics }> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey('tgw', params);
    
    // Check cache first
    if (this.config.cacheEnabled) {
      const cachedResult = this.getCachedResult(cacheKey);
      if (cachedResult) {
        this.emit('queryComplete', {
          type: 'tgw',
          cached: true,
          result: cachedResult.result,
        });

        return {
          result: cachedResult.result,
          metrics: {
            executionTimeMs: Date.now() - startTime,
            recordsReturned: cachedResult.result.results?.length || 0,
            bytesScanned: cachedResult.result.statistics?.bytesScanned || 0,
            recordsScanned: cachedResult.result.statistics?.recordsScanned || 0,
            cacheHit: true,
          },
        };
      }
    }

    // Check if query is already running
    if (this.activeQueries.has(cacheKey)) {
      const result = await this.activeQueries.get(cacheKey)!;
      return {
        result,
        metrics: {
          executionTimeMs: Date.now() - startTime,
          recordsReturned: result.results?.length || 0,
          bytesScanned: result.statistics?.bytesScanned || 0,
          recordsScanned: result.statistics?.recordsScanned || 0,
          cacheHit: false,
        },
      };
    }

    // Execute new query
    const queryPromise = this.executeTGWQueryInternal(params, options);
    this.activeQueries.set(cacheKey, queryPromise);

    try {
      const { result, crossAccountResults } = await queryPromise;
      
      // Cache successful results
      if (this.config.cacheEnabled && result.success) {
        this.cacheResult(cacheKey, result);
      }

      this.emit('queryComplete', {
        type: 'tgw',
        cached: false,
        result,
        crossAccountResults,
      });

      return {
        result,
        crossAccountResults,
        metrics: {
          executionTimeMs: Date.now() - startTime,
          recordsReturned: result.results?.length || 0,
          bytesScanned: result.statistics?.bytesScanned || 0,
          recordsScanned: result.statistics?.recordsScanned || 0,
          cacheHit: false,
        },
      };
    } finally {
      this.activeQueries.delete(cacheKey);
    }
  }

  /**
   * Get available log groups for flow logs
   */
  async getAvailableLogGroups(prefix?: string): Promise<string[]> {
    try {
      return await this.client.getFlowLogGroups(prefix);
    } catch (error) {
      this.emit('error', {
        type: 'logGroupDiscovery',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Cancel a running query
   */
  async cancelQuery(queryId: string): Promise<void> {
    try {
      await this.client.cancelQuery(queryId);
      this.emit('queryCancelled', { queryId });
    } catch (error) {
      this.emit('error', {
        type: 'queryCancellation',
        queryId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get available log groups
   */
  async getLogGroups(namePrefix?: string, limit?: number): Promise<Array<{ name: string; creationTime: Date; storedBytes: number }>> {
    try {
      return await this.client.getLogGroups(namePrefix, limit);
    } catch (error) {
      this.emit('error', {
        type: 'getLogGroups',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Clear query cache
   */
  clearCache(): void {
    this.queryCache.clear();
    this.emit('cacheCleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number; entries: Array<{ key: string; age: number }> } {
    const entries = Array.from(this.queryCache.entries()).map(([key, cached]) => ({
      key,
      age: Date.now() - cached.timestamp.getTime(),
    }));

    return {
      size: this.queryCache.size,
      hitRate: 0, // Would need to track hits/misses for accurate calculation
      entries,
    };
  }

  /**
   * Update credentials and reinitialize clients
   */
  updateCredentials(region?: string): void {
    if (region) {
      this.config.region = region;
    }
    
    this.initializeClients();
    this.clearCache(); // Clear cache when credentials change
    
    this.emit('credentialsUpdated', { region: this.config.region });
  }

  /**
   * Internal VPC query execution with retry logic
   */
  private async executeVPCQueryInternal(
    params: VPCQueryParams,
    options: QueryExecutionOptions
  ): Promise<QueryExecutionResult> {
    const {
      enableProgress = true,
      timeoutMs = 300000, // 5 minutes
      retryAttempts = 3,
      retryDelayMs = 1000,
    } = options;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        this.emit('queryStarted', {
          type: 'vpc',
          attempt,
          params,
        });

        const progressCallback = enableProgress ? (progress: QueryProgress) => {
          this.emit('queryProgress', {
            type: 'vpc',
            progress,
          });
        } : undefined;

        const result = await this.vpcQueryBuilder.executeQuery(params, progressCallback);
        
        if (result.success) {
          return result;
        } else {
          throw new Error(result.error || 'Query execution failed');
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        this.emit('queryError', {
          type: 'vpc',
          attempt,
          error: lastError.message,
        });

        if (attempt < retryAttempts) {
          await this.sleep(retryDelayMs * attempt); // Exponential backoff
        }
      }
    }

    return {
      success: false,
      error: `Query failed after ${retryAttempts} attempts: ${lastError?.message}`,
    };
  }

  /**
   * Internal TGW query execution with cross-account support
   */
  private async executeTGWQueryInternal(
    params: TGWQueryParams,
    options: QueryExecutionOptions
  ): Promise<{ result: QueryExecutionResult; crossAccountResults?: CrossAccountQueryResult[] }> {
    const {
      enableProgress = true,
      timeoutMs = 300000, // 5 minutes
      retryAttempts = 3,
      retryDelayMs = 1000,
    } = options;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        this.emit('queryStarted', {
          type: 'tgw',
          attempt,
          params,
        });

        const progressCallback = enableProgress ? (accountId: string, progress: QueryProgress) => {
          this.emit('queryProgress', {
            type: 'tgw',
            accountId,
            progress,
          });
        } : undefined;

        // Execute cross-account query if role ARNs provided
        if (params.crossAccountRoleArns && params.crossAccountRoleArns.length > 0) {
          const crossAccountResults = await this.tgwQueryBuilder.executeCrossAccountQuery(params, progressCallback);
          
          // Combine results from all accounts
          const combinedResults: FlowLogRecord[] = [];
          let totalBytesScanned = 0;
          let totalRecordsScanned = 0;
          let hasErrors = false;
          const errors: string[] = [];

          for (const accountResult of crossAccountResults) {
            if (accountResult.result.success && accountResult.result.results) {
              combinedResults.push(...accountResult.result.results);
              if (accountResult.result.statistics) {
                totalBytesScanned += accountResult.result.statistics.bytesScanned;
                totalRecordsScanned += accountResult.result.statistics.recordsScanned;
              }
            } else {
              hasErrors = true;
              errors.push(`Account ${accountResult.accountId}: ${accountResult.result.error}`);
            }
          }

          const result: QueryExecutionResult = {
            success: !hasErrors || combinedResults.length > 0,
            results: combinedResults,
            statistics: {
              recordsMatched: combinedResults.length,
              recordsScanned: totalRecordsScanned,
              bytesScanned: totalBytesScanned,
            },
            error: hasErrors ? errors.join('; ') : undefined,
          };

          return { result, crossAccountResults };
        } else {
          // Execute single-account query
          const result = await this.tgwQueryBuilder.executeQuery(params, progressCallback ? (progress) => progressCallback('current', progress) : undefined);
          return { result };
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        this.emit('queryError', {
          type: 'tgw',
          attempt,
          error: lastError.message,
        });

        if (attempt < retryAttempts) {
          await this.sleep(retryDelayMs * attempt); // Exponential backoff
        }
      }
    }

    return {
      result: {
        success: false,
        error: `Query failed after ${retryAttempts} attempts: ${lastError?.message}`,
      },
    };
  }

  /**
   * Generate cache key for query parameters
   */
  private generateCacheKey(type: 'vpc' | 'tgw', params: VPCQueryParams | TGWQueryParams): string {
    const keyData = {
      type,
      logGroupNames: params.logGroupNames.sort(),
      startTime: params.startTime.toISOString(),
      endTime: params.endTime.toISOString(),
      filters: params.filters,
      limit: params.limit,
    };

    return Buffer.from(JSON.stringify(keyData)).toString('base64');
  }

  /**
   * Get cached result if valid
   */
  private getCachedResult(cacheKey: string): CachedQueryResult | null {
    const cached = this.queryCache.get(cacheKey);
    if (!cached) {
      return null;
    }

    const age = Date.now() - cached.timestamp.getTime();
    if (age > cached.ttl) {
      this.queryCache.delete(cacheKey);
      return null;
    }

    return cached;
  }

  /**
   * Cache query result
   */
  private cacheResult(cacheKey: string, result: QueryExecutionResult): void {
    this.queryCache.set(cacheKey, {
      result,
      timestamp: new Date(),
      ttl: this.config.cacheTTLMs,
    });

    // Clean up expired entries periodically
    this.cleanupExpiredCache();
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.queryCache.entries()) {
      const age = now - cached.timestamp.getTime();
      if (age > cached.ttl) {
        this.queryCache.delete(key);
      }
    }
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}