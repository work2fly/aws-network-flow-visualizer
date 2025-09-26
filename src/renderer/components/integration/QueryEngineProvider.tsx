import React, { createContext, useContext, useCallback, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { 
  queryVPCFlowLogs,
  queryTGWFlowLogs,
  buildTopology,
  analyzeTrafficPatterns,
  clearAllErrors,
  addFlowLogs,
  replaceFlowLogs,
  clearFlowLogs
} from '../../store/slices/topologySlice';
import { 
  startOperation,
  updateOperationProgress,
  completeOperation,
  addNotification
} from '../../store/slices/uiSlice';
import { 
  VPCFlowLogFilters,
  TGWFlowLogFilters,
  FlowLogRecord,
  NetworkTopology,
  TrafficStatistics
} from '@shared/types';

interface QueryEngineContextValue {
  // Query methods
  queryVPCLogs: (params: VPCQueryParams) => Promise<FlowLogRecord[]>;
  queryTGWLogs: (params: TGWQueryParams) => Promise<FlowLogRecord[]>;
  
  // Topology building
  buildNetworkTopology: (flowLogs?: FlowLogRecord[]) => Promise<NetworkTopology>;
  analyzeTraffic: (topology?: NetworkTopology, flowLogs?: FlowLogRecord[]) => Promise<TrafficStatistics>;
  
  // Data management
  addFlowLogData: (records: FlowLogRecord[]) => void;
  replaceFlowLogData: (records: FlowLogRecord[]) => void;
  clearFlowLogData: () => void;
  
  // Batch operations
  performFullAnalysis: (vpcParams?: VPCQueryParams, tgwParams?: TGWQueryParams) => Promise<void>;
  refreshData: () => Promise<void>;
  
  // Error management
  clearQueryErrors: () => void;
  
  // State getters
  getQueryState: () => {
    isQuerying: boolean;
    isBuilding: boolean;
    isAnalyzing: boolean;
    hasErrors: boolean;
    progress?: number;
  };
}

interface VPCQueryParams {
  logGroupName: string;
  startTime: Date;
  endTime: Date;
  filters?: VPCFlowLogFilters;
  limit?: number;
}

interface TGWQueryParams {
  logGroupName: string;
  startTime: Date;
  endTime: Date;
  filters?: TGWFlowLogFilters;
  limit?: number;
}

const QueryEngineContext = createContext<QueryEngineContextValue | null>(null);

export const useQueryEngine = () => {
  const context = useContext(QueryEngineContext);
  if (!context) {
    throw new Error('useQueryEngine must be used within a QueryEngineProvider');
  }
  return context;
};

interface QueryEngineProviderProps {
  children: React.ReactNode;
}

export const QueryEngineProvider: React.FC<QueryEngineProviderProps> = ({ children }) => {
  const dispatch = useAppDispatch();
  const topologyState = useAppSelector(state => state.topology);
  const authState = useAppSelector(state => state.auth);
  
  // Check if user is authenticated before allowing queries
  const ensureAuthenticated = useCallback(() => {
    if (!authState.isAuthenticated || !authState.connectionStatus.connected) {
      throw new Error('Not authenticated or connected to AWS');
    }
  }, [authState.isAuthenticated, authState.connectionStatus.connected]);
  
  // Query VPC Flow Logs
  const queryVPCLogs = useCallback(async (params: VPCQueryParams): Promise<FlowLogRecord[]> => {
    ensureAuthenticated();
    
    dispatch(startOperation({ 
      operation: 'Querying VPC Flow Logs', 
      canCancel: true 
    }));
    
    try {
      const result = await dispatch(queryVPCFlowLogs(params)).unwrap();
      
      dispatch(completeOperation({ 
        success: true, 
        message: `Retrieved ${result.results?.length || 0} VPC flow log records` 
      }));
      
      return result.results || [];
    } catch (error) {
      dispatch(completeOperation({ 
        success: false, 
        message: error instanceof Error ? error.message : 'VPC query failed' 
      }));
      throw error;
    }
  }, [dispatch, ensureAuthenticated]);
  
  // Query TGW Flow Logs
  const queryTGWLogs = useCallback(async (params: TGWQueryParams): Promise<FlowLogRecord[]> => {
    ensureAuthenticated();
    
    dispatch(startOperation({ 
      operation: 'Querying Transit Gateway Flow Logs', 
      canCancel: true 
    }));
    
    try {
      const result = await dispatch(queryTGWFlowLogs(params)).unwrap();
      
      dispatch(completeOperation({ 
        success: true, 
        message: `Retrieved ${result.results?.length || 0} TGW flow log records` 
      }));
      
      return result.results || [];
    } catch (error) {
      dispatch(completeOperation({ 
        success: false, 
        message: error instanceof Error ? error.message : 'TGW query failed' 
      }));
      throw error;
    }
  }, [dispatch, ensureAuthenticated]);
  
  // Build Network Topology
  const buildNetworkTopology = useCallback(async (flowLogs?: FlowLogRecord[]): Promise<NetworkTopology> => {
    const logsToUse = flowLogs || topologyState.flowLogs;
    
    if (!logsToUse.length) {
      throw new Error('No flow log data available to build topology');
    }
    
    dispatch(startOperation({ 
      operation: 'Building Network Topology', 
      canCancel: false 
    }));
    
    try {
      const topology = await dispatch(buildTopology(logsToUse)).unwrap();
      
      dispatch(completeOperation({ 
        success: true, 
        message: `Built topology with ${topology.nodes.length} nodes and ${topology.edges.length} edges` 
      }));
      
      return topology;
    } catch (error) {
      dispatch(completeOperation({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Topology building failed' 
      }));
      throw error;
    }
  }, [dispatch, topologyState.flowLogs]);
  
  // Analyze Traffic Patterns
  const analyzeTraffic = useCallback(async (
    topology?: NetworkTopology, 
    flowLogs?: FlowLogRecord[]
  ): Promise<TrafficStatistics> => {
    const topologyToUse = topology || topologyState.topology;
    const logsToUse = flowLogs || topologyState.flowLogs;
    
    if (!topologyToUse) {
      throw new Error('No topology available for traffic analysis');
    }
    
    if (!logsToUse.length) {
      throw new Error('No flow log data available for traffic analysis');
    }
    
    dispatch(startOperation({ 
      operation: 'Analyzing Traffic Patterns', 
      canCancel: false 
    }));
    
    try {
      const statistics = await dispatch(analyzeTrafficPatterns({ 
        topology: topologyToUse, 
        flowLogs: logsToUse 
      })).unwrap();
      
      dispatch(completeOperation({ 
        success: true, 
        message: 'Traffic pattern analysis completed' 
      }));
      
      return statistics;
    } catch (error) {
      dispatch(completeOperation({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Traffic analysis failed' 
      }));
      throw error;
    }
  }, [dispatch, topologyState.topology, topologyState.flowLogs]);
  
  // Data management
  const addFlowLogData = useCallback((records: FlowLogRecord[]) => {
    dispatch(addFlowLogs(records));
    dispatch(addNotification({
      type: 'info',
      title: 'Flow Log Data Added',
      message: `Added ${records.length} flow log records`,
      duration: 3000
    }));
  }, [dispatch]);
  
  const replaceFlowLogData = useCallback((records: FlowLogRecord[]) => {
    dispatch(replaceFlowLogs(records));
    dispatch(addNotification({
      type: 'info',
      title: 'Flow Log Data Replaced',
      message: `Loaded ${records.length} flow log records`,
      duration: 3000
    }));
  }, [dispatch]);
  
  const clearFlowLogData = useCallback(() => {
    dispatch(clearFlowLogs());
    dispatch(addNotification({
      type: 'info',
      title: 'Flow Log Data Cleared',
      message: 'All flow log data has been cleared',
      duration: 3000
    }));
  }, [dispatch]);
  
  // Batch operations
  const performFullAnalysis = useCallback(async (
    vpcParams?: VPCQueryParams, 
    tgwParams?: TGWQueryParams
  ) => {
    ensureAuthenticated();
    
    dispatch(startOperation({ 
      operation: 'Performing Full Network Analysis', 
      canCancel: true 
    }));
    
    try {
      let allFlowLogs: FlowLogRecord[] = [];
      
      // Query VPC logs if parameters provided
      if (vpcParams) {
        dispatch(updateOperationProgress({ 
          progress: 10, 
          message: 'Querying VPC Flow Logs...' 
        }));
        const vpcLogs = await queryVPCLogs(vpcParams);
        allFlowLogs = [...allFlowLogs, ...vpcLogs];
      }
      
      // Query TGW logs if parameters provided
      if (tgwParams) {
        dispatch(updateOperationProgress({ 
          progress: 30, 
          message: 'Querying Transit Gateway Flow Logs...' 
        }));
        const tgwLogs = await queryTGWLogs(tgwParams);
        allFlowLogs = [...allFlowLogs, ...tgwLogs];
      }
      
      if (allFlowLogs.length === 0) {
        throw new Error('No flow log data retrieved');
      }
      
      // Replace existing data with new data
      dispatch(replaceFlowLogs(allFlowLogs));
      
      // Build topology
      dispatch(updateOperationProgress({ 
        progress: 60, 
        message: 'Building network topology...' 
      }));
      const topology = await buildNetworkTopology(allFlowLogs);
      
      // Analyze traffic patterns
      dispatch(updateOperationProgress({ 
        progress: 80, 
        message: 'Analyzing traffic patterns...' 
      }));
      await analyzeTraffic(topology, allFlowLogs);
      
      dispatch(completeOperation({ 
        success: true, 
        message: `Full analysis completed with ${allFlowLogs.length} records` 
      }));
      
    } catch (error) {
      dispatch(completeOperation({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Full analysis failed' 
      }));
      throw error;
    }
  }, [dispatch, ensureAuthenticated, queryVPCLogs, queryTGWLogs, buildNetworkTopology, analyzeTraffic]);
  
  // Refresh existing data
  const refreshData = useCallback(async () => {
    if (!topologyState.lastVPCQuery && !topologyState.lastTGWQuery) {
      throw new Error('No previous queries to refresh');
    }
    
    await performFullAnalysis(
      topologyState.lastVPCQuery,
      topologyState.lastTGWQuery
    );
  }, [performFullAnalysis, topologyState.lastVPCQuery, topologyState.lastTGWQuery]);
  
  // Error management
  const clearQueryErrors = useCallback(() => {
    dispatch(clearAllErrors());
  }, [dispatch]);
  
  // State getter
  const getQueryState = useCallback(() => {
    return {
      isQuerying: topologyState.isQueryingVPCLogs || topologyState.isQueryingTGWLogs,
      isBuilding: topologyState.isBuildingTopology,
      isAnalyzing: topologyState.isAnalyzingTraffic,
      hasErrors: !!(topologyState.queryError || topologyState.buildError || topologyState.analysisError),
      progress: topologyState.processingProgress?.progress
    };
  }, [topologyState]);
  
  const contextValue: QueryEngineContextValue = {
    queryVPCLogs,
    queryTGWLogs,
    buildNetworkTopology,
    analyzeTraffic,
    addFlowLogData,
    replaceFlowLogData,
    clearFlowLogData,
    performFullAnalysis,
    refreshData,
    clearQueryErrors,
    getQueryState
  };
  
  return (
    <QueryEngineContext.Provider value={contextValue}>
      {children}
    </QueryEngineContext.Provider>
  );
};