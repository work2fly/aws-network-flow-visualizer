import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { 
  NetworkTopology, 
  FlowLogRecord, 
  TrafficStatistics,
  NetworkNode,
  NetworkEdge,
  TopologyMetadata,
  VPCFlowLogFilters,
  TGWFlowLogFilters,
  QueryExecutionResult
} from '@shared/types';

// Async thunks for topology operations
export const queryVPCFlowLogs = createAsyncThunk(
  'topology/queryVPCFlowLogs',
  async (params: { 
    logGroupName: string; 
    startTime: Date; 
    endTime: Date; 
    filters?: VPCFlowLogFilters;
    limit?: number;
  }) => {
    const result = await window.electronAPI.aws.queryVPCFlowLogs(params);
    if (!result.success) {
      throw new Error(result.error || 'VPC Flow Log query failed');
    }
    return result;
  }
);

export const queryTGWFlowLogs = createAsyncThunk(
  'topology/queryTGWFlowLogs',
  async (params: { 
    logGroupName: string; 
    startTime: Date; 
    endTime: Date; 
    filters?: TGWFlowLogFilters;
    limit?: number;
  }) => {
    const result = await window.electronAPI.aws.queryTGWFlowLogs(params);
    if (!result.success) {
      throw new Error(result.error || 'TGW Flow Log query failed');
    }
    return result;
  }
);

export const buildTopology = createAsyncThunk(
  'topology/buildTopology',
  async (flowLogs: FlowLogRecord[]) => {
    // This would typically call the main process to build topology
    // For now, we'll build it in the renderer process
    const result = await window.electronAPI.network.buildTopology(flowLogs);
    return result;
  }
);

export const analyzeTrafficPatterns = createAsyncThunk(
  'topology/analyzeTrafficPatterns',
  async (params: { topology: NetworkTopology; flowLogs: FlowLogRecord[] }) => {
    const result = await window.electronAPI.network.analyzeTrafficPatterns(params);
    return result;
  }
);

// Topology state interface
export interface TopologyState {
  // Data
  topology: NetworkTopology | null;
  flowLogs: FlowLogRecord[];
  trafficStatistics: TrafficStatistics | null;
  
  // Query state
  isQueryingVPCLogs: boolean;
  isQueryingTGWLogs: boolean;
  isBuildingTopology: boolean;
  isAnalyzingTraffic: boolean;
  
  // Query parameters
  lastVPCQuery?: {
    logGroupName: string;
    startTime: Date;
    endTime: Date;
    filters?: VPCFlowLogFilters;
    limit?: number;
  };
  lastTGWQuery?: {
    logGroupName: string;
    startTime: Date;
    endTime: Date;
    filters?: TGWFlowLogFilters;
    limit?: number;
  };
  
  // Query results
  lastVPCQueryResult?: QueryExecutionResult;
  lastTGWQueryResult?: QueryExecutionResult;
  
  // Processing state
  processingProgress?: {
    stage: 'querying' | 'parsing' | 'building' | 'analyzing' | 'complete';
    progress: number; // 0-100
    message?: string;
  };
  
  // Error states
  queryError?: string;
  buildError?: string;
  analysisError?: string;
  
  // Metadata
  lastUpdated?: string;
  dataSource?: string;
  recordCount: number;
  
  // View state
  selectedNodes: string[];
  selectedEdges: string[];
  highlightedNodes: string[];
  highlightedEdges: string[];
  
  // Layout state
  layoutAlgorithm: 'hierarchical' | 'force-directed' | 'circular' | 'grid';
  layoutParameters: Record<string, unknown>;
  
  // Performance settings
  maxNodes: number;
  maxEdges: number;
  enableAnimations: boolean;
  enableClustering: boolean;
}

const initialState: TopologyState = {
  topology: null,
  flowLogs: [],
  trafficStatistics: null,
  isQueryingVPCLogs: false,
  isQueryingTGWLogs: false,
  isBuildingTopology: false,
  isAnalyzingTraffic: false,
  recordCount: 0,
  selectedNodes: [],
  selectedEdges: [],
  highlightedNodes: [],
  highlightedEdges: [],
  layoutAlgorithm: 'hierarchical',
  layoutParameters: {},
  maxNodes: 1000,
  maxEdges: 2000,
  enableAnimations: true,
  enableClustering: false
};

const topologySlice = createSlice({
  name: 'topology',
  initialState,
  reducers: {
    clearQueryError: (state) => {
      state.queryError = undefined;
    },
    clearBuildError: (state) => {
      state.buildError = undefined;
    },
    clearAnalysisError: (state) => {
      state.analysisError = undefined;
    },
    clearAllErrors: (state) => {
      state.queryError = undefined;
      state.buildError = undefined;
      state.analysisError = undefined;
    },
    setSelectedNodes: (state, action: PayloadAction<string[]>) => {
      state.selectedNodes = action.payload;
    },
    setSelectedEdges: (state, action: PayloadAction<string[]>) => {
      state.selectedEdges = action.payload;
    },
    setHighlightedNodes: (state, action: PayloadAction<string[]>) => {
      state.highlightedNodes = action.payload;
    },
    setHighlightedEdges: (state, action: PayloadAction<string[]>) => {
      state.highlightedEdges = action.payload;
    },
    clearSelection: (state) => {
      state.selectedNodes = [];
      state.selectedEdges = [];
    },
    clearHighlights: (state) => {
      state.highlightedNodes = [];
      state.highlightedEdges = [];
    },
    setLayoutAlgorithm: (state, action: PayloadAction<TopologyState['layoutAlgorithm']>) => {
      state.layoutAlgorithm = action.payload;
    },
    setLayoutParameters: (state, action: PayloadAction<Record<string, unknown>>) => {
      state.layoutParameters = action.payload;
    },
    setMaxNodes: (state, action: PayloadAction<number>) => {
      state.maxNodes = action.payload;
    },
    setMaxEdges: (state, action: PayloadAction<number>) => {
      state.maxEdges = action.payload;
    },
    setEnableAnimations: (state, action: PayloadAction<boolean>) => {
      state.enableAnimations = action.payload;
    },
    setEnableClustering: (state, action: PayloadAction<boolean>) => {
      state.enableClustering = action.payload;
    },
    updateProcessingProgress: (state, action: PayloadAction<TopologyState['processingProgress']>) => {
      state.processingProgress = action.payload;
    },
    addFlowLogs: (state, action: PayloadAction<FlowLogRecord[]>) => {
      state.flowLogs = [...state.flowLogs, ...action.payload];
      state.recordCount = state.flowLogs.length;
      state.lastUpdated = new Date().toISOString();
    },
    replaceFlowLogs: (state, action: PayloadAction<FlowLogRecord[]>) => {
      state.flowLogs = action.payload;
      state.recordCount = action.payload.length;
      state.lastUpdated = new Date().toISOString();
    },
    clearFlowLogs: (state) => {
      state.flowLogs = [];
      state.recordCount = 0;
      state.topology = null;
      state.trafficStatistics = null;
      state.lastUpdated = new Date().toISOString();
    },
    updateTopologyMetadata: (state, action: PayloadAction<Partial<TopologyMetadata>>) => {
      if (state.topology) {
        state.topology.metadata = { ...state.topology.metadata, ...action.payload };
      }
    },
    updateNodeProperties: (state, action: PayloadAction<{ nodeId: string; properties: Partial<NetworkNode['properties']> }>) => {
      if (state.topology) {
        const node = state.topology.nodes.find(n => n.id === action.payload.nodeId);
        if (node) {
          node.properties = { ...node.properties, ...action.payload.properties };
        }
      }
    },
    updateEdgeProperties: (state, action: PayloadAction<{ edgeId: string; properties: Partial<NetworkEdge['properties']> }>) => {
      if (state.topology) {
        const edge = state.topology.edges.find(e => e.id === action.payload.edgeId);
        if (edge) {
          edge.properties = { ...edge.properties, ...action.payload.properties };
        }
      }
    }
  },
  extraReducers: (builder) => {
    // VPC Flow Log Queries
    builder
      .addCase(queryVPCFlowLogs.pending, (state, action) => {
        state.isQueryingVPCLogs = true;
        state.queryError = undefined;
        state.lastVPCQuery = action.meta.arg;
        state.processingProgress = {
          stage: 'querying',
          progress: 0,
          message: 'Querying VPC Flow Logs...'
        };
      })
      .addCase(queryVPCFlowLogs.fulfilled, (state, action) => {
        state.isQueryingVPCLogs = false;
        state.lastVPCQueryResult = action.payload;
        state.queryError = undefined;
        
        if (action.payload.results) {
          state.flowLogs = [...state.flowLogs, ...action.payload.results];
          state.recordCount = state.flowLogs.length;
        }
        
        state.processingProgress = {
          stage: 'complete',
          progress: 100,
          message: `Retrieved ${action.payload.results?.length || 0} VPC flow log records`
        };
        state.lastUpdated = new Date().toISOString();
        state.dataSource = 'VPC Flow Logs';
      })
      .addCase(queryVPCFlowLogs.rejected, (state, action) => {
        state.isQueryingVPCLogs = false;
        state.queryError = action.error.message || 'VPC Flow Log query failed';
        state.processingProgress = undefined;
      });

    // TGW Flow Log Queries
    builder
      .addCase(queryTGWFlowLogs.pending, (state, action) => {
        state.isQueryingTGWLogs = true;
        state.queryError = undefined;
        state.lastTGWQuery = action.meta.arg;
        state.processingProgress = {
          stage: 'querying',
          progress: 0,
          message: 'Querying Transit Gateway Flow Logs...'
        };
      })
      .addCase(queryTGWFlowLogs.fulfilled, (state, action) => {
        state.isQueryingTGWLogs = false;
        state.lastTGWQueryResult = action.payload;
        state.queryError = undefined;
        
        if (action.payload.results) {
          state.flowLogs = [...state.flowLogs, ...action.payload.results];
          state.recordCount = state.flowLogs.length;
        }
        
        state.processingProgress = {
          stage: 'complete',
          progress: 100,
          message: `Retrieved ${action.payload.results?.length || 0} TGW flow log records`
        };
        state.lastUpdated = new Date().toISOString();
        state.dataSource = state.dataSource ? `${state.dataSource}, TGW Flow Logs` : 'TGW Flow Logs';
      })
      .addCase(queryTGWFlowLogs.rejected, (state, action) => {
        state.isQueryingTGWLogs = false;
        state.queryError = action.error.message || 'TGW Flow Log query failed';
        state.processingProgress = undefined;
      });

    // Build Topology
    builder
      .addCase(buildTopology.pending, (state) => {
        state.isBuildingTopology = true;
        state.buildError = undefined;
        state.processingProgress = {
          stage: 'building',
          progress: 0,
          message: 'Building network topology...'
        };
      })
      .addCase(buildTopology.fulfilled, (state, action) => {
        state.isBuildingTopology = false;
        state.topology = action.payload;
        state.buildError = undefined;
        state.processingProgress = {
          stage: 'complete',
          progress: 100,
          message: `Built topology with ${action.payload.nodes.length} nodes and ${action.payload.edges.length} edges`
        };
        state.lastUpdated = new Date().toISOString();
      })
      .addCase(buildTopology.rejected, (state, action) => {
        state.isBuildingTopology = false;
        state.buildError = action.error.message || 'Topology building failed';
        state.processingProgress = undefined;
      });

    // Analyze Traffic Patterns
    builder
      .addCase(analyzeTrafficPatterns.pending, (state) => {
        state.isAnalyzingTraffic = true;
        state.analysisError = undefined;
        state.processingProgress = {
          stage: 'analyzing',
          progress: 0,
          message: 'Analyzing traffic patterns...'
        };
      })
      .addCase(analyzeTrafficPatterns.fulfilled, (state, action) => {
        state.isAnalyzingTraffic = false;
        state.trafficStatistics = action.payload;
        state.analysisError = undefined;
        state.processingProgress = {
          stage: 'complete',
          progress: 100,
          message: 'Traffic pattern analysis complete'
        };
        state.lastUpdated = new Date().toISOString();
      })
      .addCase(analyzeTrafficPatterns.rejected, (state, action) => {
        state.isAnalyzingTraffic = false;
        state.analysisError = action.error.message || 'Traffic pattern analysis failed';
        state.processingProgress = undefined;
      });
  }
});

export const {
  clearQueryError,
  clearBuildError,
  clearAnalysisError,
  clearAllErrors,
  setSelectedNodes,
  setSelectedEdges,
  setHighlightedNodes,
  setHighlightedEdges,
  clearSelection,
  clearHighlights,
  setLayoutAlgorithm,
  setLayoutParameters,
  setMaxNodes,
  setMaxEdges,
  setEnableAnimations,
  setEnableClustering,
  updateProcessingProgress,
  addFlowLogs,
  replaceFlowLogs,
  clearFlowLogs,
  updateTopologyMetadata,
  updateNodeProperties,
  updateEdgeProperties
} = topologySlice.actions;

export default topologySlice.reducer;