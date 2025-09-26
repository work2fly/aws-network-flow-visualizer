import { useState, useCallback, useMemo } from 'react';
import { FlowLogRecord, FlowFilters } from '@shared/types';
import { 
  ExportProgress, 
  ExportProgressCallback,
  exportFlowLogData,
  downloadBlob
} from '../utils/export-utils';
import { DataExportOptions } from '../components/visualization/DataExportDialog';

interface UseDataExportOptions {
  flowLogs: FlowLogRecord[];
  appliedFilters?: FlowFilters;
}

interface UseDataExportReturn {
  isExporting: boolean;
  progress: ExportProgress | null;
  error: string | null;
  exportData: (options: DataExportOptions) => Promise<void>;
  clearError: () => void;
  getFilteredData: () => FlowLogRecord[];
  getExportPreview: (options: DataExportOptions) => {
    recordCount: number;
    fieldCount: number;
    estimatedSize: string;
    sampleRows: string[];
  };
}

export function useDataExport({
  flowLogs,
  appliedFilters
}: UseDataExportOptions): UseDataExportReturn {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filter data based on applied filters
  const filteredData = useMemo(() => {
    if (!appliedFilters) {
      return flowLogs;
    }

    return flowLogs.filter(record => {
      // Apply IP filters
      if (appliedFilters.sourceIPs && appliedFilters.sourceIPs.length > 0) {
        if (!appliedFilters.sourceIPs.includes(record.sourceIP)) {
          return false;
        }
      }

      if (appliedFilters.destinationIPs && appliedFilters.destinationIPs.length > 0) {
        if (!appliedFilters.destinationIPs.includes(record.destinationIP)) {
          return false;
        }
      }

      // Apply port filters
      if (appliedFilters.sourcePorts && appliedFilters.sourcePorts.length > 0) {
        const portMatches = appliedFilters.sourcePorts.some(portFilter => {
          if (typeof portFilter === 'object' && portFilter !== null && 'port' in portFilter) {
            return portFilter.port === record.sourcePort;
          }
          // Handle legacy number format
          return Number(portFilter) === record.sourcePort;
        });
        if (!portMatches) {
          return false;
        }
      }

      if (appliedFilters.destinationPorts && appliedFilters.destinationPorts.length > 0) {
        const portMatches = appliedFilters.destinationPorts.some(portFilter => {
          if (typeof portFilter === 'object' && portFilter !== null && 'port' in portFilter) {
            return portFilter.port === record.destinationPort;
          }
          // Handle legacy number format
          return Number(portFilter) === record.destinationPort;
        });
        if (!portMatches) {
          return false;
        }
      }

      // Apply protocol filters
      if (appliedFilters.protocols && appliedFilters.protocols.length > 0) {
        if (!appliedFilters.protocols.includes(record.protocol)) {
          return false;
        }
      }

      // Apply action filters
      if (appliedFilters.actions && appliedFilters.actions.length > 0) {
        if (!appliedFilters.actions.includes(record.action)) {
          return false;
        }
      }

      // Apply time range filters
      if (appliedFilters.timeRange) {
        const recordTime = record.timestamp.getTime();
        const startTime = appliedFilters.timeRange.start.getTime();
        const endTime = appliedFilters.timeRange.end.getTime();
        
        if (recordTime < startTime || recordTime > endTime) {
          return false;
        }
      }

      // Apply AWS resource filters
      if (appliedFilters.vpcIds && appliedFilters.vpcIds.length > 0) {
        if (!record.vpcId || !appliedFilters.vpcIds.includes(record.vpcId)) {
          return false;
        }
      }

      if (appliedFilters.accountIds && appliedFilters.accountIds.length > 0) {
        if (!record.accountId || !appliedFilters.accountIds.includes(record.accountId)) {
          return false;
        }
      }

      // Apply traffic volume filters
      if (appliedFilters.minBytes !== undefined && record.bytes < appliedFilters.minBytes) {
        return false;
      }

      if (appliedFilters.maxBytes !== undefined && record.bytes > appliedFilters.maxBytes) {
        return false;
      }

      if (appliedFilters.minPackets !== undefined && record.packets < appliedFilters.minPackets) {
        return false;
      }

      if (appliedFilters.maxPackets !== undefined && record.packets > appliedFilters.maxPackets) {
        return false;
      }

      return true;
    });
  }, [flowLogs, appliedFilters]);

  const progressCallback: ExportProgressCallback = useCallback((progressUpdate) => {
    setProgress(progressUpdate);
    
    if (progressUpdate.stage === 'error') {
      setError(progressUpdate.error || 'Export failed');
      setIsExporting(false);
    } else if (progressUpdate.stage === 'complete') {
      setIsExporting(false);
    }
  }, []);

  const exportData = useCallback(async (options: DataExportOptions) => {
    if (isExporting) {
      return; // Prevent concurrent exports
    }

    try {
      setIsExporting(true);
      setError(null);
      setProgress(null);

      // Determine which data to export
      const dataToExport = options.filterData ? filteredData : flowLogs;

      if (dataToExport.length === 0) {
        throw new Error('No data available for export');
      }

      // Prepare export options
      const exportOptions = {
        ...options,
        selectedFields: options.selectedFields,
        batchSize: options.batchSize || 10000,
        includeHeaders: options.includeHeaders,
        dateFormat: options.dateFormat || 'iso',
        delimiter: options.delimiter || ',',
        encoding: options.encoding || 'utf-8'
      };

      const blob = await exportFlowLogData(
        dataToExport,
        exportOptions,
        progressCallback
      );

      const filename = options.filename || `flow-logs-${new Date().toISOString().slice(0, 10)}.csv`;
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
    }
  }, [flowLogs, filteredData, isExporting, progressCallback]);

  const getFilteredData = useCallback(() => {
    return filteredData;
  }, [filteredData]);

  const getExportPreview = useCallback((options: DataExportOptions) => {
    const dataToExport = options.filterData ? filteredData : flowLogs;
    const recordCount = dataToExport.length;
    const fieldCount = options.selectedFields.length;
    
    // Estimate file size (rough calculation)
    const avgFieldSize = 15; // Average characters per field
    const estimatedBytes = recordCount * fieldCount * avgFieldSize;
    const estimatedSize = formatFileSize(estimatedBytes);

    // Generate sample rows for preview
    const sampleCount = Math.min(3, recordCount);
    const sampleRows = dataToExport.slice(0, sampleCount).map(record => {
      return options.selectedFields.map(field => {
        const value = record[field as keyof FlowLogRecord];
        if (value === undefined || value === null) return '';
        if (value instanceof Date) {
          switch (options.dateFormat) {
            case 'timestamp':
              return value.getTime().toString();
            case 'readable':
              return value.toLocaleString();
            default:
              return value.toISOString();
          }
        }
        return String(value);
      }).join(options.delimiter || ',');
    });

    return {
      recordCount,
      fieldCount,
      estimatedSize,
      sampleRows
    };
  }, [flowLogs, filteredData]);

  const clearError = useCallback(() => {
    setError(null);
    setProgress(null);
  }, []);

  return {
    isExporting,
    progress,
    error,
    exportData,
    clearError,
    getFilteredData,
    getExportPreview
  };
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}