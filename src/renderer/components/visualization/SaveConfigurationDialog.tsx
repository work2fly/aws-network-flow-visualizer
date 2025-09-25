import React, { useState, useCallback } from 'react';
import { FlowFilters } from '@shared/types';
import { QueryParameters, VisualizationSettings } from '../../utils/config-utils';
import { useConfigurationPresets } from '../../hooks/useConfiguration';

interface SaveConfigurationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    name: string,
    description: string,
    filters: FlowFilters,
    queryParams: QueryParameters,
    visualSettings: VisualizationSettings,
    tags: string[]
  ) => Promise<void>;
  currentFilters: FlowFilters;
  currentQueryParams: QueryParameters;
  currentVisualSettings: VisualizationSettings;
}

export const SaveConfigurationDialog: React.FC<SaveConfigurationDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  currentFilters,
  currentQueryParams,
  currentVisualSettings
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const presets = useConfigurationPresets();

  const handleAddTag = useCallback(() => {
    const trimmedTag = tagInput.trim().toLowerCase();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags(prev => [...prev, trimmedTag]);
      setTagInput('');
    }
  }, [tagInput, tags]);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    setTags(prev => prev.filter(tag => tag !== tagToRemove));
  }, []);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  }, [handleAddTag]);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      setError('Configuration name is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(
        name.trim(),
        description.trim(),
        currentFilters,
        currentQueryParams,
        currentVisualSettings,
        tags
      );
      
      // Reset form
      setName('');
      setDescription('');
      setTags([]);
      setTagInput('');
      setIsDefault(false);
      
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  }, [name, description, tags, currentFilters, currentQueryParams, currentVisualSettings, onSave, onClose]);

  const applyPreset = useCallback((presetFn: () => Partial<any>) => {
    const preset = presetFn();
    setName(preset.name || '');
    setDescription(preset.description || '');
    setTags(preset.tags || []);
  }, []);

  const getConfigurationSummary = useCallback(() => {
    const summary = {
      filterCount: 0,
      hasTimeRange: false,
      hasIPFilters: false,
      hasPortFilters: false,
      hasProtocolFilters: false,
      hasAWSFilters: false
    };

    // Count active filters
    if (currentFilters.sourceIPs?.length) {
      summary.filterCount++;
      summary.hasIPFilters = true;
    }
    if (currentFilters.destinationIPs?.length) {
      summary.filterCount++;
      summary.hasIPFilters = true;
    }
    if (currentFilters.sourcePorts?.length) {
      summary.filterCount++;
      summary.hasPortFilters = true;
    }
    if (currentFilters.destinationPorts?.length) {
      summary.filterCount++;
      summary.hasPortFilters = true;
    }
    if (currentFilters.protocols?.length) {
      summary.filterCount++;
      summary.hasProtocolFilters = true;
    }
    if (currentFilters.timeRange) {
      summary.filterCount++;
      summary.hasTimeRange = true;
    }
    if (currentFilters.vpcIds?.length || currentFilters.accountIds?.length) {
      summary.filterCount++;
      summary.hasAWSFilters = true;
    }

    return summary;
  }, [currentFilters]);

  const summary = getConfigurationSummary();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Save Configuration</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={isSaving}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Configuration Summary */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-sm font-medium text-blue-900 mb-2">Current Configuration Summary</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-blue-600 font-medium">{summary.filterCount}</div>
                <div className="text-blue-500">Active Filters</div>
              </div>
              <div>
                <div className="text-blue-600 font-medium">{currentVisualSettings.layoutAlgorithm || 'cose'}</div>
                <div className="text-blue-500">Layout Algorithm</div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {summary.hasTimeRange && (
                <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">Time Range</span>
              )}
              {summary.hasIPFilters && (
                <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">IP Filters</span>
              )}
              {summary.hasPortFilters && (
                <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">Port Filters</span>
              )}
              {summary.hasProtocolFilters && (
                <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">Protocol Filters</span>
              )}
              {summary.hasAWSFilters && (
                <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded-full">AWS Filters</span>
              )}
            </div>
          </div>

          {/* Preset Templates */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Quick Templates</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => applyPreset(presets.createNetworkTroubleshootingPreset)}
                className="p-3 text-left border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <div className="text-sm font-medium text-gray-900">Network Troubleshooting</div>
                <div className="text-xs text-gray-500 mt-1">Focus on connectivity issues</div>
              </button>
              <button
                onClick={() => applyPreset(presets.createSecurityAnalysisPreset)}
                className="p-3 text-left border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <div className="text-sm font-medium text-gray-900">Security Analysis</div>
                <div className="text-xs text-gray-500 mt-1">Security events and anomalies</div>
              </button>
              <button
                onClick={() => applyPreset(presets.createPerformanceMonitoringPreset)}
                className="p-3 text-left border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <div className="text-sm font-medium text-gray-900">Performance Monitoring</div>
                <div className="text-xs text-gray-500 mt-1">Traffic patterns and performance</div>
              </button>
              <button
                onClick={() => applyPreset(presets.createComplianceAuditPreset)}
                className="p-3 text-left border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <div className="text-sm font-medium text-gray-900">Compliance Audit</div>
                <div className="text-xs text-gray-500 mt-1">Comprehensive audit view</div>
              </button>
            </div>
          </div>

          {/* Configuration Details */}
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Configuration Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter a descriptive name..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                disabled={isSaving}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this configuration is used for..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                disabled={isSaving}
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Add tags..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  disabled={isSaving}
                />
                <button
                  onClick={handleAddTag}
                  disabled={!tagInput.trim() || isSaving}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="text-blue-600 hover:text-blue-800"
                        disabled={isSaving}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Options */}
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  disabled={isSaving}
                />
                <span className="ml-2 text-sm text-gray-700">
                  Set as default configuration
                </span>
              </label>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!name.trim() || isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};