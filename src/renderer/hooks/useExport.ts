import { useState, useCallback, useRef } from 'react';
import { 
  ExportOptions, 
  ExportProgress, 
  ExportProgressCallback,
  exportVisualization,
  exportFlowLogData,
  exportTopologyData,
  downloadBlob
} from '../utils/export-utils';
import { NetworkTopology, FlowLogRecord } from '@shared/types';

interface UseExportOptions {
  cytoscapeInstance?: any;
  topology?: NetworkTopology | null;
  flowLogs?: FlowLogRecord[];
}

interface UseExportReturn {
  isExporting: boolean;
  progress: ExportProgress | null;
  error: string | null;
  exportVisualizationImage: (options: ExportOptions) => Promise<void>;
  exportFlowData: (options: ExportOptions) => Promise<void>;
  exportTopology: (options: ExportOptions) => Promise<void>;
  clearError: () => void;
}

export function useExport({
  cytoscapeInstance,
  topology,
  flowLogs
}: UseExportOptions): UseExportReturn {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const progressCallback: ExportProgressCallback = useCallback((progressUpdate) => {
    setProgress(progressUpdate);
    
    if (progressUpdate.stage === 'error') {
      setError(progressUpdate.error || 'Export failed');
      setIsExporting(false);
    } else if (progressUpdate.stage === 'complete') {
      setIsExporting(false);
    }
  }, []);

  const exportVisualizationImage = useCallback(async (options: ExportOptions) => {
    if (!cytoscapeInstance) {
      setError('Visualization not available for export');
      return;
    }

    if (isExporting) {
      return; // Prevent concurrent exports
    }

    try {
      setIsExporting(true);
      setError(null);
      setProgress(null);

      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController();

      const blob = await exportVisualization(
        cytoscapeInstance,
        options,
        progressCallback
      );

      // Check if export was aborted
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      const filename = options.filename || `network-topology.${options.format}`;
      downloadBlob(blob, filename);

      setProgress({
        stage: 'complete',
        progress: 100,
        message: 'Export downloaded successfully'
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Export failed';
      setError(errorMessage);
      setProgress({
        stage: 'error',
        progress: 0,
        message: 'Export failed',
        error: errorMessage
      });
    } finally {
      setIsExporting(false);
      abortControllerRef.current = null;
    }
  }, [cytoscapeInstance, isExporting, progressCallback]);

  const exportFlowData = useCallback(async (options: ExportOptions) => {
    if (!flowLogs || flowLogs.length === 0) {
      setError('No flow log data available for export');
      return;
    }

    if (isExporting) {
      return; // Prevent concurrent exports
    }

    try {
      setIsExporting(true);
      setError(null);
      setProgress(null);

      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController();

      const blob = await exportFlowLogData(
        flowLogs,
        options,
        progressCallback
      );

      // Check if export was aborted
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      const filename = options.filename || `flow-logs.${options.format}`;
      downloadBlob(blob, filename);

      setProgress({
        stage: 'complete',
        progress: 100,
        message: 'Export downloaded successfully'
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Export failed';
      setError(errorMessage);
      setProgress({
        stage: 'error',
        progress: 0,
        message: 'Export failed',
        error: errorMessage
      });
    } finally {
      setIsExporting(false);
      abortControllerRef.current = null;
    }
  }, [flowLogs, isExporting, progressCallback]);

  const exportTopology = useCallback(async (options: ExportOptions) => {
    if (!topology) {
      setError('No topology data available for export');
      return;
    }

    if (isExporting) {
      return; // Prevent concurrent exports
    }

    try {
      setIsExporting(true);
      setError(null);
      setProgress(null);

      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController();

      const blob = await exportTopologyData(
        topology,
        options,
        progressCallback
      );

      // Check if export was aborted
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      const filename = options.filename || `topology.${options.format}`;
      downloadBlob(blob, filename);

      setProgress({
        stage: 'complete',
        progress: 100,
        message: 'Export downloaded successfully'
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Export failed';
      setError(errorMessage);
      setProgress({
        stage: 'error',
        progress: 0,
        message: 'Export failed',
        error: errorMessage
      });
    } finally {
      setIsExporting(false);
      abortControllerRef.current = null;
    }
  }, [topology, isExporting, progressCallback]);

  const clearError = useCallback(() => {
    setError(null);
    setProgress(null);
  }, []);

  // Cleanup on unmount
  const abortExport = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsExporting(false);
      setProgress(null);
    }
  }, []);

  return {
    isExporting,
    progress,
    error,
    exportVisualizationImage,
    exportFlowData,
    exportTopology,
    clearError
  };
}