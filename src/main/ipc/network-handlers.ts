import { ipcMain } from 'electron';
import { FlowLogRecord, NetworkTopology, TrafficStatistics } from '../../shared/types';
import { TopologyConstructionEngine } from '../network/topology-construction-engine';
import { TrafficPatternAnalyzer } from '../network/traffic-pattern-analysis';

export function registerNetworkHandlers() {
  // Build network topology from flow logs
  ipcMain.handle('network:build-topology', async (event, flowLogs: FlowLogRecord[]): Promise<NetworkTopology> => {
    try {
      const engine = new TopologyConstructionEngine();
      const topology = await engine.buildTopology(flowLogs);
      return topology;
    } catch (error) {
      console.error('Failed to build topology:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to build topology');
    }
  });

  // Analyze traffic patterns
  ipcMain.handle('network:analyze-traffic-patterns', async (
    event, 
    params: { topology: NetworkTopology; flowLogs: FlowLogRecord[] }
  ): Promise<TrafficStatistics> => {
    try {
      const { topology, flowLogs } = params;
      const analyzer = new TrafficPatternAnalyzer();
      const analysisResult = await analyzer.analyzeTrafficPatterns(flowLogs);
      
      // Convert the analysis result to TrafficStatistics format
      const statistics: TrafficStatistics = {
        totalBytes: analysisResult.volumeAnalysis.totalVolume,
        totalPackets: analysisResult.connectionAnalysis.totalConnections, // Using connections as packet approximation
        acceptedConnections: analysisResult.connectionAnalysis.totalConnections - analysisResult.connectionAnalysis.rejectionAnalysis.totalRejections,
        rejectedConnections: analysisResult.connectionAnalysis.rejectionAnalysis.totalRejections,
        uniqueSourceIPs: analysisResult.connectionAnalysis.uniqueSourceIPs,
        uniqueDestinationIPs: analysisResult.connectionAnalysis.uniqueDestinationIPs,
        topPorts: [], // Would need to be derived from connectionPatterns
        timeRange: { 
          start: analysisResult.volumeAnalysis.peakTime, 
          end: analysisResult.volumeAnalysis.peakTime 
        }, // Simplified time range
        protocolDistribution: [], // Would need to be derived from connectionPatterns
      };
      
      return statistics;
    } catch (error) {
      console.error('Failed to analyze traffic patterns:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to analyze traffic patterns');
    }
  });
}