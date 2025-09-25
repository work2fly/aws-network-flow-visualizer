import React, { useState } from 'react';
import { VisualizationFilters } from '@renderer/hooks/useNetworkVisualization';

interface VisualizationControlsProps {
  filters: VisualizationFilters;
  onFiltersChange: (filters: Partial<VisualizationFilters>) => void;
  onReset: () => void;
  className?: string;
}

export const VisualizationControls: React.FC<VisualizationControlsProps> = ({
  filters,
  onFiltersChange,
  onReset,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const nodeTypeOptions = [
    { value: 'vpc', label: 'VPC', color: '#3B82F6' },
    { value: 'subnet', label: 'Subnet', color: '#10B981' },
    { value: 'instance', label: 'Instance', color: '#F59E0B' },
    { value: 'tgw', label: 'Transit Gateway', color: '#8B5CF6' },
    { value: 'vpn', label: 'VPN', color: '#EF4444' },
    { value: 'internet-gateway', label: 'Internet Gateway', color: '#06B6D4' },
    { value: 'nat-gateway', label: 'NAT Gateway', color: '#84CC16' },
    { value: 'load-balancer', label: 'Load Balancer', color: '#F97316' }
  ];

  const handleNodeTypeToggle = (nodeType: string) => {
    const newNodeTypes = filters.nodeTypes.includes(nodeType)
      ? filters.nodeTypes.filter(type => type !== nodeType)
      : [...filters.nodeTypes, nodeType];
    
    onFiltersChange({ nodeTypes: newNodeTypes });
  };

  const handleTrafficVolumeChange = (field: 'minTrafficVolume' | 'maxTrafficVolume', value: string) => {
    const numValue = value === '' ? (field === 'minTrafficVolume' ? 0 : Number.MAX_SAFE_INTEGER) : parseInt(value);
    onFiltersChange({ [field]: numValue });
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900">Visualization Controls</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={onReset}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Reset
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg
                className={`w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Controls Content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Node Types Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Node Types
            </label>
            <div className="grid grid-cols-2 gap-2">
              {nodeTypeOptions.map(option => (
                <label key={option.value} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.nodeTypes.includes(option.value)}
                    onChange={() => handleNodeTypeToggle(option.value)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 flex items-center">
                    <span
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: option.color }}
                    />
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Traffic Volume Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Traffic Volume (bytes)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Minimum</label>
                <input
                  type="number"
                  min="0"
                  value={filters.minTrafficVolume === 0 ? '' : filters.minTrafficVolume}
                  onChange={(e) => handleTrafficVolumeChange('minTrafficVolume', e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Maximum</label>
                <input
                  type="number"
                  min="0"
                  value={filters.maxTrafficVolume === Number.MAX_SAFE_INTEGER ? '' : filters.maxTrafficVolume}
                  onChange={(e) => handleTrafficVolumeChange('maxTrafficVolume', e.target.value)}
                  placeholder="No limit"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Display Options */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Display Options
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.showRejectedConnections}
                  onChange={(e) => onFiltersChange({ showRejectedConnections: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Show rejected connections</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.showOnlyActiveNodes}
                  onChange={(e) => onFiltersChange({ showOnlyActiveNodes: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Show only active nodes</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 rounded-b-lg">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Active filters: {getActiveFilterCount(filters)}</span>
          <span>Click nodes/edges to inspect</span>
        </div>
      </div>
    </div>
  );
};

function getActiveFilterCount(filters: VisualizationFilters): number {
  let count = 0;
  
  // Count non-default node types
  const defaultNodeTypes = ['vpc', 'subnet', 'instance', 'tgw', 'vpn', 'internet-gateway', 'nat-gateway'];
  if (filters.nodeTypes.length !== defaultNodeTypes.length) count++;
  
  // Count traffic volume filters
  if (filters.minTrafficVolume > 0) count++;
  if (filters.maxTrafficVolume < Number.MAX_SAFE_INTEGER) count++;
  
  // Count display options
  if (!filters.showRejectedConnections) count++;
  if (filters.showOnlyActiveNodes) count++;
  
  // Count time range
  if (filters.timeRange) count++;
  
  return count;
}