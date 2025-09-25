import React, { useState, useCallback, useMemo } from 'react';
import { FlowFilters, TimeRangePreset, IPRangeFilter, PortFilter } from '@shared/types';

interface FilterPanelProps {
  filters: FlowFilters;
  onFiltersChange: (filters: Partial<FlowFilters>) => void;
  onReset: () => void;
  onSave?: (name: string, description?: string) => void;
  className?: string;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onFiltersChange,
  onReset,
  onSave,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'basic' | 'advanced' | 'time'>('basic');
  const [isExpanded, setIsExpanded] = useState(true);

  // Time range presets
  const timePresets: { value: TimeRangePreset; label: string }[] = [
    { value: 'last-hour', label: 'Last Hour' },
    { value: 'last-4-hours', label: 'Last 4 Hours' },
    { value: 'last-24-hours', label: 'Last 24 Hours' },
    { value: 'last-7-days', label: 'Last 7 Days' },
    { value: 'last-30-days', label: 'Last 30 Days' },
    { value: 'custom', label: 'Custom Range' }
  ];

  const handleTimePresetChange = useCallback((preset: TimeRangePreset) => {
    const now = new Date();
    let start: Date;
    
    switch (preset) {
      case 'last-hour':
        start = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case 'last-4-hours':
        start = new Date(now.getTime() - 4 * 60 * 60 * 1000);
        break;
      case 'last-24-hours':
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'last-7-days':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'last-30-days':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        return; // Custom range - don't auto-set dates
    }
    
    onFiltersChange({
      timeRange: {
        start,
        end: now,
        preset
      }
    });
  }, [onFiltersChange]);

  const handleIPRangeAdd = useCallback(() => {
    const newRange: IPRangeFilter = {
      cidr: '',
      include: true,
      label: ''
    };
    
    const currentRanges = filters.ipRanges || [];
    onFiltersChange({
      ipRanges: [...currentRanges, newRange]
    });
  }, [filters.ipRanges, onFiltersChange]);

  const handleIPRangeUpdate = useCallback((index: number, range: Partial<IPRangeFilter>) => {
    const currentRanges = filters.ipRanges || [];
    const updatedRanges = [...currentRanges];
    updatedRanges[index] = { ...updatedRanges[index], ...range };
    
    onFiltersChange({ ipRanges: updatedRanges });
  }, [filters.ipRanges, onFiltersChange]);

  const handleIPRangeRemove = useCallback((index: number) => {
    const currentRanges = filters.ipRanges || [];
    const updatedRanges = currentRanges.filter((_, i) => i !== index);
    
    onFiltersChange({ ipRanges: updatedRanges });
  }, [filters.ipRanges, onFiltersChange]);

  const handlePortFilterAdd = useCallback((type: 'source' | 'destination') => {
    const newFilter: PortFilter = {
      port: undefined,
      include: true,
      label: ''
    };
    
    const currentFilters = type === 'source' ? filters.sourcePorts || [] : filters.destinationPorts || [];
    const key = type === 'source' ? 'sourcePorts' : 'destinationPorts';
    
    onFiltersChange({
      [key]: [...currentFilters, newFilter]
    });
  }, [filters.sourcePorts, filters.destinationPorts, onFiltersChange]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    
    if (filters.sourceIPs?.length) count++;
    if (filters.destinationIPs?.length) count++;
    if (filters.ipRanges?.length) count++;
    if (filters.sourcePorts?.length) count++;
    if (filters.destinationPorts?.length) count++;
    if (filters.protocols?.length) count++;
    if (filters.timeRange) count++;
    if (filters.actions?.length && filters.actions.length < 2) count++;
    if (filters.vpcIds?.length) count++;
    if (filters.minBytes !== undefined || filters.maxBytes !== undefined) count++;
    
    return count;
  }, [filters]);

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900">Filters</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {activeFilterCount} active
            </span>
            {onSave && (
              <button
                onClick={() => {
                  const name = prompt('Filter name:');
                  if (name) onSave(name);
                }}
                className="text-xs text-blue-600 hover:text-blue-700 underline"
              >
                Save
              </button>
            )}
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

      {/* Filter Content */}
      {isExpanded && (
        <div className="p-4">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 mb-4">
            {[
              { key: 'basic', label: 'Basic' },
              { key: 'advanced', label: 'Advanced' },
              { key: 'time', label: 'Time Range' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Basic Filters */}
          {activeTab === 'basic' && (
            <div className="space-y-4">
              {/* IP Addresses */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  IP Addresses
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Source IPs</label>
                    <textarea
                      value={filters.sourceIPs?.join('\n') || ''}
                      onChange={(e) => onFiltersChange({
                        sourceIPs: e.target.value.split('\n').filter(ip => ip.trim())
                      })}
                      placeholder="192.168.1.1&#10;10.0.0.0/8"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Destination IPs</label>
                    <textarea
                      value={filters.destinationIPs?.join('\n') || ''}
                      onChange={(e) => onFiltersChange({
                        destinationIPs: e.target.value.split('\n').filter(ip => ip.trim())
                      })}
                      placeholder="192.168.1.1&#10;10.0.0.0/8"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              {/* Protocols */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Protocols
                </label>
                <div className="flex flex-wrap gap-2">
                  {['TCP', 'UDP', 'ICMP', 'ESP', 'AH', 'GRE'].map(protocol => (
                    <label key={protocol} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.protocols?.includes(protocol) || false}
                        onChange={(e) => {
                          const current = filters.protocols || [];
                          const updated = e.target.checked
                            ? [...current, protocol]
                            : current.filter(p => p !== protocol);
                          onFiltersChange({ protocols: updated });
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">{protocol}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Connection Actions
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.actions?.includes('ACCEPT') !== false}
                      onChange={(e) => {
                        const current = filters.actions || ['ACCEPT', 'REJECT'];
                        const updated = e.target.checked
                          ? [...current.filter(a => a !== 'ACCEPT'), 'ACCEPT']
                          : current.filter(a => a !== 'ACCEPT');
                        onFiltersChange({ actions: updated });
                      }}
                      className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Accepted</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.actions?.includes('REJECT') !== false}
                      onChange={(e) => {
                        const current = filters.actions || ['ACCEPT', 'REJECT'];
                        const updated = e.target.checked
                          ? [...current.filter(a => a !== 'REJECT'), 'REJECT']
                          : current.filter(a => a !== 'REJECT');
                        onFiltersChange({ actions: updated });
                      }}
                      className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Rejected</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Advanced Filters */}
          {activeTab === 'advanced' && (
            <div className="space-y-4">
              {/* IP Ranges */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    IP Ranges (CIDR)
                  </label>
                  <button
                    onClick={handleIPRangeAdd}
                    className="text-xs text-blue-600 hover:text-blue-700 underline"
                  >
                    Add Range
                  </button>
                </div>
                <div className="space-y-2">
                  {(filters.ipRanges || []).map((range, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <select
                        value={range.include ? 'include' : 'exclude'}
                        onChange={(e) => handleIPRangeUpdate(index, { include: e.target.value === 'include' })}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="include">Include</option>
                        <option value="exclude">Exclude</option>
                      </select>
                      <input
                        type="text"
                        value={range.cidr}
                        onChange={(e) => handleIPRangeUpdate(index, { cidr: e.target.value })}
                        placeholder="10.0.0.0/8"
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      <input
                        type="text"
                        value={range.label || ''}
                        onChange={(e) => handleIPRangeUpdate(index, { label: e.target.value })}
                        placeholder="Label"
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      <button
                        onClick={() => handleIPRangeRemove(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Traffic Volume */}
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
                      value={filters.minBytes || ''}
                      onChange={(e) => onFiltersChange({
                        minBytes: e.target.value ? parseInt(e.target.value) : undefined
                      })}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Maximum</label>
                    <input
                      type="number"
                      min="0"
                      value={filters.maxBytes || ''}
                      onChange={(e) => onFiltersChange({
                        maxBytes: e.target.value ? parseInt(e.target.value) : undefined
                      })}
                      placeholder="No limit"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* AWS Resources */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  AWS Resources
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">VPC IDs</label>
                    <textarea
                      value={filters.vpcIds?.join('\n') || ''}
                      onChange={(e) => onFiltersChange({
                        vpcIds: e.target.value.split('\n').filter(id => id.trim())
                      })}
                      placeholder="vpc-12345678&#10;vpc-87654321"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Regions</label>
                    <textarea
                      value={filters.regions?.join('\n') || ''}
                      onChange={(e) => onFiltersChange({
                        regions: e.target.value.split('\n').filter(region => region.trim())
                      })}
                      placeholder="us-east-1&#10;us-west-2"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Time Range Filters */}
          {activeTab === 'time' && (
            <div className="space-y-4">
              {/* Presets */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quick Presets
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {timePresets.map(preset => (
                    <button
                      key={preset.value}
                      onClick={() => handleTimePresetChange(preset.value)}
                      className={`px-3 py-2 text-sm border rounded-md transition-colors ${
                        filters.timeRange?.preset === preset.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Time Range
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Start Time</label>
                    <input
                      type="datetime-local"
                      value={filters.timeRange?.start ? 
                        new Date(filters.timeRange.start.getTime() - filters.timeRange.start.getTimezoneOffset() * 60000)
                          .toISOString().slice(0, 16) : ''
                      }
                      onChange={(e) => {
                        if (e.target.value) {
                          const start = new Date(e.target.value);
                          onFiltersChange({
                            timeRange: {
                              ...filters.timeRange,
                              start,
                              end: filters.timeRange?.end || new Date(),
                              preset: 'custom'
                            }
                          });
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">End Time</label>
                    <input
                      type="datetime-local"
                      value={filters.timeRange?.end ? 
                        new Date(filters.timeRange.end.getTime() - filters.timeRange.end.getTimezoneOffset() * 60000)
                          .toISOString().slice(0, 16) : ''
                      }
                      onChange={(e) => {
                        if (e.target.value) {
                          const end = new Date(e.target.value);
                          onFiltersChange({
                            timeRange: {
                              ...filters.timeRange,
                              start: filters.timeRange?.start || new Date(Date.now() - 24 * 60 * 60 * 1000),
                              end,
                              preset: 'custom'
                            }
                          });
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};