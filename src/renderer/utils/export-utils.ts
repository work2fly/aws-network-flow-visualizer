import { NetworkTopology, FlowLogRecord, FlowFilters } from '@shared/types';

export interface ExportOptions {
  format: 'png' | 'svg' | 'csv' | 'json';
  filename?: string;
  quality?: number; // For PNG exports (0.1 - 1.0)
  width?: number;
  height?: number;
  backgroundColor?: string;
  includeMetadata?: boolean;
  anonymize?: boolean; // Enable data anonymization
  anonymizationOptions?: {
    preserveStructure?: boolean;
    anonymizeIPs?: boolean;
    anonymizeAccountIds?: boolean;
    anonymizeInstanceIds?: boolean;
    anonymizeVpcIds?: boolean;
    anonymizeSubnetIds?: boolean;
    anonymizeSecurityGroupIds?: boolean;
    anonymizeUsernames?: boolean;
    anonymizeRoleNames?: boolean;
  };
}

export interface ExportProgress {
  stage: 'preparing' | 'processing' | 'generating' | 'complete' | 'error';
  progress: number; // 0-100
  message: string;
  error?: string;
}

export type ExportProgressCallback = (progress: ExportProgress) => void;

/**
 * Export network topology visualization as PNG or SVG
 */
export async function exportVisualization(
  cytoscapeInstance: any,
  options: ExportOptions,
  onProgress?: ExportProgressCallback
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      onProgress?.({
        stage: 'preparing',
        progress: 10,
        message: 'Preparing visualization for export...'
      });

      if (!cytoscapeInstance) {
        throw new Error('Cytoscape instance not available');
      }

      const exportOptions = {
        output: options.format === 'png' ? 'blob' : 'blob',
        bg: options.backgroundColor || '#ffffff',
        full: true,
        scale: calculateScale(options.width, options.height, cytoscapeInstance),
        quality: options.quality || 1.0,
        maxWidth: options.width || 1920,
        maxHeight: options.height || 1080
      };

      onProgress?.({
        stage: 'processing',
        progress: 50,
        message: 'Generating export...'
      });

      if (options.format === 'png') {
        const blob = cytoscapeInstance.png(exportOptions);
        onProgress?.({
          stage: 'complete',
          progress: 100,
          message: 'PNG export complete'
        });
        resolve(blob);
      } else if (options.format === 'svg') {
        const svgString = cytoscapeInstance.svg(exportOptions);
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        onProgress?.({
          stage: 'complete',
          progress: 100,
          message: 'SVG export complete'
        });
        resolve(blob);
      } else {
        throw new Error(`Unsupported visualization format: ${options.format}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown export error';
      onProgress?.({
        stage: 'error',
        progress: 0,
        message: 'Export failed',
        error: errorMessage
      });
      reject(new Error(errorMessage));
    }
  });
}

/**
 * Export flow log data as CSV with enhanced options
 */
export async function exportFlowLogData(
  flowLogs: FlowLogRecord[],
  options: ExportOptions & {
    selectedFields?: string[];
    batchSize?: number;
    includeHeaders?: boolean;
    dateFormat?: 'iso' | 'timestamp' | 'readable';
    delimiter?: ',' | ';' | '\t';
    encoding?: 'utf-8' | 'utf-16';
  },
  onProgress?: ExportProgressCallback
): Promise<Blob> {
  return new Promise(async (resolve, reject) => {
    try {
      onProgress?.({
        stage: 'preparing',
        progress: 10,
        message: 'Preparing flow log data...'
      });

      if (!flowLogs || flowLogs.length === 0) {
        throw new Error('No flow log data to export');
      }

      let processedFlowLogs = flowLogs;

      // Apply anonymization if requested
      if (options.anonymize && window.electronAPI?.anonymizeFlowLogs) {
        onProgress?.({
          stage: 'processing',
          progress: 15,
          message: 'Anonymizing sensitive data...'
        });

        try {
          processedFlowLogs = await window.electronAPI.anonymizeFlowLogs(
            flowLogs,
            options.anonymizationOptions
          );
        } catch (error) {
          console.warn('Failed to anonymize flow logs:', error);
          // Continue with original data if anonymization fails
        }
      }

      const batchSize = options.batchSize || 10000;
      const totalBatches = Math.ceil(processedFlowLogs.length / batchSize);

      onProgress?.({
        stage: 'processing',
        progress: 20,
        message: `Processing ${processedFlowLogs.length} records in ${totalBatches} batches...`
      });

      let csvContent = '';
      
      // Generate header if requested
      if (options.includeHeaders !== false) {
        const headers = generateCSVHeaders(processedFlowLogs, options);
        csvContent += headers + '\n';
      }

      // Process data in batches
      for (let i = 0; i < totalBatches; i++) {
        const start = i * batchSize;
        const end = Math.min(start + batchSize, processedFlowLogs.length);
        const batch = processedFlowLogs.slice(start, end);

        const batchContent = generateCSVContent(batch, options);
        csvContent += batchContent;

        if (i < totalBatches - 1) {
          csvContent += '\n';
        }

        // Update progress
        const progress = 20 + (60 * (i + 1)) / totalBatches;
        onProgress?.({
          stage: 'processing',
          progress,
          message: `Processing batch ${i + 1} of ${totalBatches}...`
        });
      }

      onProgress?.({
        stage: 'generating',
        progress: 90,
        message: 'Generating CSV file...'
      });

      const mimeType = options.encoding === 'utf-16' 
        ? 'text/csv;charset=utf-16;' 
        : 'text/csv;charset=utf-8;';

      const blob = new Blob([csvContent], { type: mimeType });

      onProgress?.({
        stage: 'complete',
        progress: 100,
        message: `CSV export complete (${processedFlowLogs.length} records)${options.anonymize ? ' - anonymized' : ''}`
      });

      resolve(blob);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown export error';
      onProgress?.({
        stage: 'error',
        progress: 0,
        message: 'Export failed',
        error: errorMessage
      });
      reject(new Error(errorMessage));
    }
  });
}

/**
 * Export network topology as JSON
 */
export async function exportTopologyData(
  topology: NetworkTopology,
  options: ExportOptions,
  onProgress?: ExportProgressCallback
): Promise<Blob> {
  return new Promise(async (resolve, reject) => {
    try {
      onProgress?.({
        stage: 'preparing',
        progress: 20,
        message: 'Preparing topology data...'
      });

      if (!topology) {
        throw new Error('No topology data to export');
      }

      let processedTopology = topology;

      // Apply anonymization if requested
      if (options.anonymize && window.electronAPI?.anonymizeTopology) {
        onProgress?.({
          stage: 'processing',
          progress: 40,
          message: 'Anonymizing sensitive data...'
        });

        try {
          processedTopology = await window.electronAPI.anonymizeTopology(
            topology,
            options.anonymizationOptions
          );
        } catch (error) {
          console.warn('Failed to anonymize topology:', error);
          // Continue with original data if anonymization fails
        }
      }

      onProgress?.({
        stage: 'processing',
        progress: 60,
        message: 'Serializing topology...'
      });

      const exportData = options.includeMetadata ? processedTopology : {
        nodes: processedTopology.nodes,
        edges: processedTopology.edges
      };

      const jsonContent = JSON.stringify(exportData, null, 2);

      onProgress?.({
        stage: 'generating',
        progress: 90,
        message: 'Generating JSON file...'
      });

      const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });

      onProgress?.({
        stage: 'complete',
        progress: 100,
        message: `JSON export complete${options.anonymize ? ' - anonymized' : ''}`
      });

      resolve(blob);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown export error';
      onProgress?.({
        stage: 'error',
        progress: 0,
        message: 'Export failed',
        error: errorMessage
      });
      reject(new Error(errorMessage));
    }
  });
}

/**
 * Download blob as file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate filename with timestamp
 */
export function generateFilename(prefix: string, extension: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  return `${prefix}_${timestamp}.${extension}`;
}

/**
 * Calculate optimal scale for export based on desired dimensions
 */
function calculateScale(
  targetWidth?: number,
  targetHeight?: number,
  cytoscapeInstance?: any
): number {
  if (!targetWidth && !targetHeight) {
    return 2; // Default high-resolution scale
  }

  if (!cytoscapeInstance) {
    return 1;
  }

  const currentExtent = cytoscapeInstance.extent();
  const currentWidth = currentExtent.w;
  const currentHeight = currentExtent.h;

  if (targetWidth && targetHeight) {
    const scaleX = targetWidth / currentWidth;
    const scaleY = targetHeight / currentHeight;
    return Math.min(scaleX, scaleY);
  } else if (targetWidth) {
    return targetWidth / currentWidth;
  } else if (targetHeight) {
    return targetHeight / currentHeight;
  }

  return 1;
}

/**
 * Generate CSV headers based on selected fields
 */
function generateCSVHeaders(
  flowLogs: FlowLogRecord[], 
  options: {
    selectedFields?: string[];
    delimiter?: string;
  }
): string {
  const delimiter = options.delimiter || ',';
  
  if (options.selectedFields && options.selectedFields.length > 0) {
    return options.selectedFields.join(delimiter);
  }

  // Default columns if no specific fields selected
  const baseColumns = [
    'timestamp',
    'sourceIP',
    'destinationIP',
    'sourcePort',
    'destinationPort',
    'protocol',
    'action',
    'bytes',
    'packets'
  ];

  const optionalColumns = [
    'accountId',
    'vpcId',
    'subnetId',
    'instanceId',
    'interfaceId',
    'flowDirection',
    'region',
    'availabilityZone',
    'transitGatewayId',
    'transitGatewayAttachmentId',
    'resourceType',
    'targetResourceId'
  ];

  // Determine which optional columns have data
  const presentOptionalColumns = optionalColumns.filter(col =>
    flowLogs.some(record => record[col as keyof FlowLogRecord] !== undefined)
  );

  const allColumns = [...baseColumns, ...presentOptionalColumns];
  return allColumns.join(delimiter);
}

/**
 * Generate CSV content from flow log records with enhanced options
 */
function generateCSVContent(
  flowLogs: FlowLogRecord[], 
  options: {
    selectedFields?: string[];
    delimiter?: string;
    dateFormat?: 'iso' | 'timestamp' | 'readable';
    includeMetadata?: boolean;
  } = {}
): string {
  if (flowLogs.length === 0) {
    return '';
  }

  const delimiter = options.delimiter || ',';
  
  // Determine columns to export
  let columns: string[];
  if (options.selectedFields && options.selectedFields.length > 0) {
    columns = options.selectedFields;
  } else {
    // Default behavior - include all available columns
    const baseColumns = [
      'timestamp',
      'sourceIP',
      'destinationIP',
      'sourcePort',
      'destinationPort',
      'protocol',
      'action',
      'bytes',
      'packets'
    ];

    const optionalColumns = [
      'accountId',
      'vpcId',
      'subnetId',
      'instanceId',
      'interfaceId',
      'flowDirection',
      'region',
      'availabilityZone',
      'transitGatewayId',
      'transitGatewayAttachmentId',
      'resourceType',
      'targetResourceId'
    ];

    const presentOptionalColumns = optionalColumns.filter(col =>
      flowLogs.some(record => record[col as keyof FlowLogRecord] !== undefined)
    );

    columns = [...baseColumns, ...presentOptionalColumns];
  }

  // Generate data rows
  const rows = flowLogs.map(record => {
    return columns.map(column => {
      const value = record[column as keyof FlowLogRecord];
      
      if (value === undefined || value === null) {
        return '';
      }
      
      // Handle date formatting
      if (value instanceof Date) {
        switch (options.dateFormat) {
          case 'timestamp':
            return value.getTime().toString();
          case 'readable':
            return value.toLocaleString();
          case 'iso':
          default:
            return value.toISOString();
        }
      }
      
      // Escape values that contain delimiter, quotes, or newlines
      const stringValue = String(value);
      const needsEscaping = stringValue.includes(delimiter) || 
                           stringValue.includes('"') || 
                           stringValue.includes('\n') ||
                           stringValue.includes('\r');
      
      if (needsEscaping) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      
      return stringValue;
    }).join(delimiter);
  });

  return rows.join('\n');
}

/**
 * Validate export options
 */
export function validateExportOptions(options: ExportOptions): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!options.format) {
    errors.push('Export format is required');
  } else if (!['png', 'svg', 'csv', 'json'].includes(options.format)) {
    errors.push('Invalid export format. Supported formats: png, svg, csv, json');
  }

  if (options.quality !== undefined && (options.quality < 0.1 || options.quality > 1.0)) {
    errors.push('Quality must be between 0.1 and 1.0');
  }

  if (options.width !== undefined && options.width <= 0) {
    errors.push('Width must be greater than 0');
  }

  if (options.height !== undefined && options.height <= 0) {
    errors.push('Height must be greater than 0');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get export format recommendations based on use case
 */
export function getExportRecommendations(useCase: 'presentation' | 'analysis' | 'documentation' | 'sharing'): ExportOptions[] {
  const recommendations: Record<string, ExportOptions[]> = {
    presentation: [
      { format: 'png', width: 1920, height: 1080, quality: 1.0, backgroundColor: '#ffffff' },
      { format: 'svg', backgroundColor: '#ffffff' }
    ],
    analysis: [
      { format: 'csv', includeMetadata: true },
      { format: 'json', includeMetadata: true }
    ],
    documentation: [
      { format: 'svg', backgroundColor: '#ffffff' },
      { format: 'png', width: 1200, height: 800, quality: 0.9, backgroundColor: '#ffffff' }
    ],
    sharing: [
      { format: 'png', width: 800, height: 600, quality: 0.8, backgroundColor: '#ffffff' },
      { format: 'csv', includeMetadata: false }
    ]
  };

  return recommendations[useCase] || [];
}