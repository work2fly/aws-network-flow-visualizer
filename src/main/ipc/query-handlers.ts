import { ipcMain } from 'electron';
import { FlowLogQueryEngine } from '../aws/flow-log-query-engine';
import { AWSCredentialManager } from '../aws/credential-manager';
import { VPCFlowLogFilters, TGWFlowLogFilters, QueryExecutionResult } from '../../shared/types';

// Create a shared credential manager instance
const credentialManager = new AWSCredentialManager();

// Enhanced error handling for AWS operations
function handleAWSError(error: any, operation: string): QueryExecutionResult {
  console.error(`${operation} failed:`, error);
  
  let userFriendlyMessage = '';
  
  // Handle specific AWS error types
  if (error.name === 'CredentialsError' || error.code === 'CredentialsError') {
    userFriendlyMessage = 'AWS credentials are invalid or expired. Please re-authenticate.';
  } else if (error.name === 'UnauthorizedOperation' || error.code === 'UnauthorizedOperation') {
    userFriendlyMessage = 'You do not have permission to perform this operation. Check your CloudWatch Insights permissions.';
  } else if (error.name === 'AccessDenied' || error.code === 'AccessDenied') {
    userFriendlyMessage = 'Access denied. Verify your CloudWatch Logs permissions and try again.';
  } else if (error.name === 'ThrottlingException' || error.code === 'ThrottlingException') {
    userFriendlyMessage = 'Request was throttled by AWS. Please wait a moment and try again.';
  } else if (error.name === 'ServiceUnavailable' || error.code === 'ServiceUnavailable') {
    userFriendlyMessage = 'CloudWatch Insights service is temporarily unavailable. Please try again later.';
  } else if (error.name === 'InvalidParameterValue' || error.code === 'InvalidParameterValue') {
    userFriendlyMessage = 'Invalid query parameters provided. Please check your log group name and time range.';
  } else if (error.name === 'ResourceNotFound' || error.code === 'ResourceNotFound') {
    userFriendlyMessage = 'The specified log group was not found. Please verify the log group name.';
  } else if (error.name === 'LimitExceededException' || error.code === 'LimitExceededException') {
    userFriendlyMessage = 'Query limit exceeded. Try reducing the time range or adding more specific filters.';
  } else if (error.name === 'NetworkingError' || error.code === 'NetworkingError') {
    userFriendlyMessage = 'Network error occurred while connecting to AWS. Check your internet connection.';
  } else if (error.message && error.message.includes('timeout')) {
    userFriendlyMessage = 'Query timed out. Try reducing the time range or adding more specific filters.';
  } else {
    userFriendlyMessage = error.message || `${operation} failed due to an unknown error`;
  }

  return {
    success: false,
    error: userFriendlyMessage,
    // Include additional error details for debugging
    errorDetails: {
      code: error.code,
      name: error.name,
      requestId: error.requestId,
      region: error.region,
      originalMessage: error.message
    }
  };
}

// Validate query parameters
function validateQueryParams(params: any): string | null {
  if (!params.logGroupName || typeof params.logGroupName !== 'string') {
    return 'Log group name is required and must be a string';
  }
  
  if (!params.startTime || !(params.startTime instanceof Date)) {
    return 'Start time is required and must be a valid date';
  }
  
  if (!params.endTime || !(params.endTime instanceof Date)) {
    return 'End time is required and must be a valid date';
  }
  
  if (params.startTime >= params.endTime) {
    return 'Start time must be before end time';
  }
  
  // Check for reasonable time range (not more than 30 days)
  const timeDiff = params.endTime.getTime() - params.startTime.getTime();
  const maxRange = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
  
  if (timeDiff > maxRange) {
    return 'Time range cannot exceed 30 days. Please select a shorter time range.';
  }
  
  if (params.limit && (typeof params.limit !== 'number' || params.limit <= 0 || params.limit > 10000)) {
    return 'Limit must be a positive number not exceeding 10,000';
  }
  
  return null;
}

export function registerQueryHandlers() {
  // Query VPC Flow Logs
  ipcMain.handle('aws:query-vpc-flow-logs', async (
    event, 
    params: {
      logGroupName: string;
      startTime: Date;
      endTime: Date;
      filters?: VPCFlowLogFilters;
      limit?: number;
    }
  ): Promise<QueryExecutionResult> => {
    try {
      // Validate parameters
      const validationError = validateQueryParams(params);
      if (validationError) {
        return {
          success: false,
          error: validationError
        };
      }

      // Check credentials before proceeding
      const connectionStatus = await credentialManager.testConnection();
      if (!connectionStatus.connected) {
        return {
          success: false,
          error: connectionStatus.error || 'AWS connection is not available. Please authenticate first.'
        };
      }

      const queryEngine = new FlowLogQueryEngine({
        credentialManager,
        region: connectionStatus.region || 'us-east-1'
      });
      
      // Convert single logGroupName to array for the query builder
      const queryParams = {
        ...params,
        logGroupNames: [params.logGroupName]
      };
      delete (queryParams as any).logGroupName;
      
      const { result } = await queryEngine.executeVPCQuery(queryParams);
      
      // Add success metadata
      if (result.success && result.results) {
        result.metadata = {
          recordCount: result.results.length,
          queryTime: new Date(),
          logGroup: params.logGroupName,
          timeRange: {
            start: params.startTime,
            end: params.endTime
          }
        };
      }
      
      return result;
    } catch (error) {
      return handleAWSError(error, 'VPC Flow Log query');
    }
  });

  // Query Transit Gateway Flow Logs
  ipcMain.handle('aws:query-tgw-flow-logs', async (
    event, 
    params: {
      logGroupName: string;
      startTime: Date;
      endTime: Date;
      filters?: TGWFlowLogFilters;
      limit?: number;
    }
  ): Promise<QueryExecutionResult> => {
    try {
      // Validate parameters
      const validationError = validateQueryParams(params);
      if (validationError) {
        return {
          success: false,
          error: validationError
        };
      }

      // Check credentials before proceeding
      const connectionStatus = await credentialManager.testConnection();
      if (!connectionStatus.connected) {
        return {
          success: false,
          error: connectionStatus.error || 'AWS connection is not available. Please authenticate first.'
        };
      }

      const queryEngine = new FlowLogQueryEngine({
        credentialManager,
        region: connectionStatus.region || 'us-east-1'
      });
      
      // Convert single logGroupName to array for the query builder
      const queryParams = {
        ...params,
        logGroupNames: [params.logGroupName]
      };
      delete (queryParams as any).logGroupName;
      
      const { result } = await queryEngine.executeTGWQuery(queryParams);
      
      // Add success metadata
      if (result.success && result.results) {
        result.metadata = {
          recordCount: result.results.length,
          queryTime: new Date(),
          logGroup: params.logGroupName,
          timeRange: {
            start: params.startTime,
            end: params.endTime
          }
        };
      }
      
      return result;
    } catch (error) {
      return handleAWSError(error, 'Transit Gateway Flow Log query');
    }
  });

  // Get available log groups
  ipcMain.handle('aws:get-log-groups', async (
    event,
    params?: {
      namePrefix?: string;
      limit?: number;
    }
  ): Promise<{ success: boolean; logGroups?: Array<{ name: string; creationTime: Date; storedBytes: number }>; error?: string }> => {
    try {
      // Check credentials before proceeding
      const connectionStatus = await credentialManager.testConnection();
      if (!connectionStatus.connected) {
        return {
          success: false,
          error: connectionStatus.error || 'AWS connection is not available. Please authenticate first.'
        };
      }

      const queryEngine = new FlowLogQueryEngine({
        credentialManager,
        region: connectionStatus.region || 'us-east-1'
      });
      
      const logGroups = await queryEngine.getLogGroups(params?.namePrefix, params?.limit);
      
      return {
        success: true,
        logGroups
      };
    } catch (error) {
      return handleAWSError(error, 'Get log groups');
    }
  });

  // Cancel running query
  ipcMain.handle('aws:cancel-query', async (
    event,
    queryId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // Check credentials before proceeding
      const connectionStatus = await credentialManager.testConnection();
      if (!connectionStatus.connected) {
        return {
          success: false,
          error: connectionStatus.error || 'AWS connection is not available.'
        };
      }

      const queryEngine = new FlowLogQueryEngine({
        credentialManager,
        region: connectionStatus.region || 'us-east-1'
      });
      
      await queryEngine.cancelQuery(queryId);
      
      return { success: true };
    } catch (error) {
      console.error('Cancel query failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel query'
      };
    }
  });
}