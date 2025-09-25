import React, { useState, useCallback, useMemo } from 'react';
import { FlowLogRecord, FlowFilters } from '@shared/types';
import { 
  ExportOptions, 
  ExportProgress,
  validateExportOptions,
  generateFilename 
} from '../../utils/export-utils';

interface DataExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: DataExportOptions) => Promise<void>;
  flowLogs: FlowLogRecord[];
  appliedFilters?: FlowFilters;
}

export interface DataExportOptions extends ExportOptions {
  selectedFields: string[];
  batchSize?: number;
  includeHeaders: boolean;
  dateFormat: 'iso' | 'timestamp' | 'readable';
  delimiter: ',' | ';' | '\t';
  encoding: 'utf-8' | 'utf-16';
  filterData: boolean;
}

interface FieldDefinition {
  key: string;
  label: string;
  description: string;
  category: 'basic' | 'network' | 'aws' | 'metadata';
  required?: boolean;
}

const AVAILABLE_FIELDS: FieldDefinition[] = [
  // Basic fields
  { key: 'timestamp', label: 'Timestamp', description: 'When the flow occurred', category: 'basic', required: true },
  { key: 'sourceIP', label: 'Source IP', description: 'Source IP address', category: 'basic', required: true },
  { key: 'destinationIP', label: 'Destination IP', description: 'Destination IP address', category: 'basic', required: true },
  { key: 'sourcePort', label: 'Source Port', description: 'Source port number', category: 'basic' },
  { key: 'destinationPort', label: 'Destination Port', description: 'Destination port number', category: 'basic' },
  { key: 'protocol', label: 'Protocol', description: 'Network protocol (TCP, UDP, etc.)', category: 'basic' },
  { key: 'action', label: 'Action', description: 'ACCEPT or REJECT', category: 'basic' },
  { key: 'bytes', label: 'Bytes', description: 'Number of bytes transferred', category: 'basic' },
  { key: 'packets', label: 'Packets', description: 'Number of packets transferred', category: 'basic' },
  
  // Network fields
  { key: 'interfaceId', label: 'Interface ID', description: 'Network interface identifier', category: 'network' },
  { key: 'flowDirection', label: 'Flow Direction', description: 'Ingress or egress', category: 'network' },
  { key: 'packetSourceAddr', label: 'Packet Source Address', description: 'Original packet source', category: 'network' },
  { key: 'packetDestinationAddr', label: 'Packet Destination Address', description: 'Original packet destination', category: 'network' },
  
  // AWS fields
  { key: 'accountId', label: 'Account ID', description: 'AWS account identifier', category: 'aws' },
  { key: 'vpcId', label: 'VPC ID', description: 'Virtual Private Cloud identifier', category: 'aws' },
  { key: 'subnetId', label: 'Subnet ID', description: 'Subnet identifier', category: 'aws' },
  { key: 'instanceId', label: 'Instance ID', description: 'EC2 instance identifier', category: 'aws' },
  { key: 'region', label: 'Region', description: 'AWS region', category: 'aws' },
  { key: 'availabilityZone', label: 'Availability Zone', description: 'AWS availability zone', category: 'aws' },
  
  // Transit Gateway fields
  { key: 'transitGatewayId', label: 'Transit Gateway ID', description: 'Transit Gateway identifier', category: 'aws' },
  { key: 'transitGatewayAttachmentId', label: 'TGW Attachment ID', description: 'Transit Gateway attachment identifier', category: 'aws' },
  { key: 'resourceType', label: 'Resource Type', description: 'Type of attached resource', category: 'aws' },
  { key: 'targetResourceId', label: 'Target Resource ID', description: 'Target resource identifier', category: 'aws' }
];

export const DataExportDialog: React.FC<DataExportDialogProps> = ({
  isOpen,
  onClose,
  onExport,
  flowLogs,
  appliedFilters
}) => {
  const [options, setOptions] = useState<DataExportOptions>({
    format: 'csv',
    selectedFields: ['timestamp', 'sourceIP', 'destinationIP', 'sourcePort', 'destinationPort', 'protocol', 'action', 'bytes', 'packets'],
    batchSize: 10000,
    includeHeaders: true,
    dateFormat: 'iso',
    delimiter: ',',
    encoding: 'utf-8',
    filterData: true,
    includeMetadata: false
  });

  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [customFilename, setCustomFilename] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Calculate export statistics
  const exportStats = useMemo(() => {
    const totalRecords = flowLogs.length;
    const selectedFieldCount = options.selectedFields.length;
    const estimatedSize = totalRecords * selectedFieldCount * 20; // Rough estimate in bytes
    
    return {
      totalRecords,
      selectedFieldCount,
      estimatedSizeMB: (estimatedSize / (1024 * 1024)).toFixed(2),
      batchCount: Math.ceil(totalRecords / (options.batchSize || 10000))
    };
  }, [flowLogs.length, options.selectedFields.length, options.batchSize]);

  // Filter available fields based on data
  const availableFields = useMemo(() => {
    return AVAILABLE_FIELDS.filter(field => {
      // Check if any flow log record has this field
      return flowLogs.some(record => 
        record[field.key as keyof FlowLogRecord] !== undefined &&
        record[field.key as keyof FlowLogRecord] !== null
      );
    });
  }, [flowLogs]);

  // Filter fields by category
  const filteredFields = useMemo(() => {
    if (selectedCategory === 'all') {
      return availableFields;
    }
    return availableFields.filter(field => field.category === selectedCategory);
  }, [availableFields, selectedCategory]);

  const handleFieldToggle = useCallback((fieldKey: string, checked: boolean) => {
    setOptions(prev => {
      const field = AVAILABLE_FIELDS.find(f => f.key === fieldKey);
      if (field?.required && !checked) {
        return prev; // Don't allow unchecking required fields
      }

      const newFields = checked
        ? [...prev.selectedFields, fieldKey]
        : prev.selectedFields.filter(f => f !== fieldKey);

      return {
        ...prev,
        selectedFields: newFields
      };
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setOptions(prev => ({
      ...prev,
      selectedFields: availableFields.map(f => f.key)
    }));
  }, [availableFields]);

  const handleSelectNone = useCallback(() => {
    const requiredFields = AVAILABLE_FIELDS.filter(f => f.required).map(f => f.key);
    setOptions(prev => ({
      ...prev,
      selectedFields: requiredFields
    }));
  }, []);

  const handleSelectPreset = useCallback((preset: 'basic' | 'network' | 'aws' | 'complete') => {
    let fields: string[];
    
    switch (preset) {
      case 'basic':
        fields = availableFields.filter(f => f.category === 'basic').map(f => f.key);
        break;
      case 'network':
        fields = availableFields.filter(f => f.category === 'basic' || f.category === 'network').map(f => f.key);
        break;
      case 'aws':
        fields = availableFields.filter(f => f.category === 'basic' || f.category === 'aws').map(f => f.key);
        break;
      case 'complete':
        fields = availableFields.map(f => f.key);
        break;
      default:
        fields = options.selectedFields;
    }

    setOptions(prev => ({
      ...prev,
      selectedFields: fields
    }));
  }, [availableFields, options.selectedFields]);

  const handleExport = useCallback(async () => {
    const validation = validateExportOptions(options);
    
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    if (options.selectedFields.length === 0) {
      setErrors(['At least one field must be selected']);
      return;
    }

    setErrors([]);
    
    const filename = customFilename || generateFilename('flow-logs', 'csv');

    const exportOptions: DataExportOptions = {
      ...options,
      filename
    };

    try {
      await onExport(exportOptions);
      onClose();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Export failed']);
    }
  }, [options, customFilename, onExport, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Export Flow Log Data</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={progress?.stage === 'processing' || progress?.stage === 'generating'}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Export Statistics */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-sm font-medium text-blue-900 mb-2">Export Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-blue-600 font-medium">{exportStats.totalRecords.toLocaleString()}</div>
                <div className="text-blue-500">Records</div>
              </div>
              <div>
                <div className="text-blue-600 font-medium">{exportStats.selectedFieldCount}</div>
                <div className="text-blue-500">Fields</div>
              </div>
              <div>
                <div className="text-blue-600 font-medium">{exportStats.estimatedSizeMB} MB</div>
                <div className="text-blue-500">Est. Size</div>
              </div>
              <div>
                <div className="text-blue-600 font-medium">{exportStats.batchCount}</div>
                <div className="text-blue-500">Batches</div>
              </div>
            </div>
          </div>

          {/* Field Selection */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Select Fields</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => handleSelectPreset('basic')}
                  className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                >
                  Basic
                </button>
                <button
                  onClick={() => handleSelectPreset('network')}
                  className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                >
                  Network
                </button>
                <button
                  onClick={() => handleSelectPreset('aws')}
                  className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                >
                  AWS
                </button>
                <button
                  onClick={() => handleSelectPreset('complete')}
                  className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                >
                  All
                </button>
              </div>
            </div>

            {/* Category Filter */}
            <div className="mb-4">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Categories</option>
                <option value="basic">Basic Fields</option>
                <option value="network">Network Fields</option>
                <option value="aws">AWS Fields</option>
                <option value="metadata">Metadata Fields</option>
              </select>
            </div>

            {/* Field List */}
            <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
              <div className="p-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">
                  {options.selectedFields.length} of {filteredFields.length} fields selected
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={handleSelectAll}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Select All
                  </button>
                  <button
                    onClick={handleSelectNone}
                    className="text-xs text-gray-600 hover:text-gray-800"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="p-3 space-y-2">
                {filteredFields.map((field) => (
                  <label key={field.key} className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={options.selectedFields.includes(field.key)}
                      onChange={(e) => handleFieldToggle(field.key, e.target.checked)}
                      disabled={field.required}
                      className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          {field.label}
                        </span>
                        {field.required && (
                          <span className="text-xs text-red-500 font-medium">Required</span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getCategoryColor(field.category)}`}>
                          {field.category}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{field.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Export Options */}
          <div className="mb-6 space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Export Options</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Date Format */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date Format
                </label>
                <select
                  value={options.dateFormat}
                  onChange={(e) => setOptions(prev => ({
                    ...prev,
                    dateFormat: e.target.value as 'iso' | 'timestamp' | 'readable'
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="iso">ISO 8601 (2024-01-01T10:00:00Z)</option>
                  <option value="timestamp">Unix Timestamp (1704110400)</option>
                  <option value="readable">Human Readable (Jan 1, 2024 10:00 AM)</option>
                </select>
              </div>

              {/* Delimiter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Delimiter
                </label>
                <select
                  value={options.delimiter}
                  onChange={(e) => setOptions(prev => ({
                    ...prev,
                    delimiter: e.target.value as ',' | ';' | '\t'
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value=",">Comma (,)</option>
                  <option value=";">Semicolon (;)</option>
                  <option value="\t">Tab</option>
                </select>
              </div>

              {/* Batch Size */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Batch Size
                </label>
                <select
                  value={options.batchSize}
                  onChange={(e) => setOptions(prev => ({
                    ...prev,
                    batchSize: parseInt(e.target.value)
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={1000}>1,000 records</option>
                  <option value={5000}>5,000 records</option>
                  <option value={10000}>10,000 records</option>
                  <option value={50000}>50,000 records</option>
                  <option value={100000}>100,000 records</option>
                </select>
              </div>

              {/* Encoding */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Encoding
                </label>
                <select
                  value={options.encoding}
                  onChange={(e) => setOptions(prev => ({
                    ...prev,
                    encoding: e.target.value as 'utf-8' | 'utf-16'
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="utf-8">UTF-8</option>
                  <option value="utf-16">UTF-16</option>
                </select>
              </div>
            </div>

            {/* Additional Options */}
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={options.includeHeaders}
                  onChange={(e) => setOptions(prev => ({
                    ...prev,
                    includeHeaders: e.target.checked
                  }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Include column headers</span>
              </label>

              {appliedFilters && (
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={options.filterData}
                    onChange={(e) => setOptions(prev => ({
                      ...prev,
                      filterData: e.target.checked
                    }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Apply current filters to exported data
                  </span>
                </label>
              )}
            </div>
          </div>

          {/* Custom Filename */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filename (optional)
            </label>
            <input
              type="text"
              value={customFilename}
              onChange={(e) => setCustomFilename(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder={generateFilename('flow-logs', 'csv')}
            />
          </div>

          {/* Progress Indicator */}
          {progress && (
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">
                  {progress.message}
                </span>
                <span className="text-sm text-gray-500">
                  {progress.progress}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    progress.stage === 'error' ? 'bg-red-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
              {progress.error && (
                <p className="text-sm text-red-600 mt-2">{progress.error}</p>
              )}
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="text-sm text-red-800">
                <ul className="list-disc list-inside space-y-1">
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              disabled={progress?.stage === 'processing' || progress?.stage === 'generating'}
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={progress?.stage === 'processing' || progress?.stage === 'generating' || options.selectedFields.length === 0}
            >
              {progress?.stage === 'processing' || progress?.stage === 'generating' 
                ? 'Exporting...' 
                : 'Export CSV'
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function getCategoryColor(category: string): string {
  const colors = {
    basic: 'bg-blue-100 text-blue-800',
    network: 'bg-green-100 text-green-800',
    aws: 'bg-orange-100 text-orange-800',
    metadata: 'bg-purple-100 text-purple-800'
  };
  
  return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800';
}