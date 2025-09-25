import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  SavedConfiguration, 
  loadConfigurations, 
  deleteConfiguration, 
  duplicateConfiguration,
  exportConfiguration,
  importConfiguration,
  setDefaultConfiguration,
  searchConfigurations,
  getRecentConfigurations,
  getStorageStats
} from '../../utils/config-utils';

interface ConfigurationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadConfiguration: (config: SavedConfiguration) => void;
  onSaveConfiguration: () => void;
  currentConfigName?: string;
}

type DialogMode = 'list' | 'save' | 'import' | 'export';

export const ConfigurationDialog: React.FC<ConfigurationDialogProps> = ({
  isOpen,
  onClose,
  onLoadConfiguration,
  onSaveConfiguration,
  currentConfigName
}) => {
  const [mode, setMode] = useState<DialogMode>('list');
  const [configurations, setConfigurations] = useState<SavedConfiguration[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConfig, setSelectedConfig] = useState<SavedConfiguration | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'created' | 'used'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showRecent, setShowRecent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Import/Export state
  const [importData, setImportData] = useState('');
  const [exportData, setExportData] = useState('');
  const [importName, setImportName] = useState('');

  // Load configurations on open
  useEffect(() => {
    if (isOpen) {
      refreshConfigurations();
      setError(null);
      setSuccess(null);
    }
  }, [isOpen]);

  const refreshConfigurations = useCallback(() => {
    try {
      const configs = loadConfigurations();
      setConfigurations(configs);
    } catch (err) {
      setError('Failed to load configurations');
    }
  }, []);

  // Filter and sort configurations
  const filteredConfigurations = useMemo(() => {
    let filtered = searchQuery 
      ? searchConfigurations(searchQuery)
      : configurations;

    if (showRecent) {
      filtered = getRecentConfigurations(10);
    }

    // Sort configurations
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'created':
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
          break;
        case 'used':
          const aUsed = a.lastUsed?.getTime() || 0;
          const bUsed = b.lastUsed?.getTime() || 0;
          comparison = aUsed - bUsed;
          break;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [configurations, searchQuery, sortBy, sortOrder, showRecent]);

  const handleLoadConfiguration = useCallback((config: SavedConfiguration) => {
    try {
      onLoadConfiguration(config);
      setSuccess(`Configuration "${config.name}" loaded successfully`);
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      setError('Failed to load configuration');
    }
  }, [onLoadConfiguration, onClose]);

  const handleDeleteConfiguration = useCallback((id: string) => {
    if (window.confirm('Are you sure you want to delete this configuration?')) {
      try {
        deleteConfiguration(id);
        refreshConfigurations();
        setSuccess('Configuration deleted successfully');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete configuration');
      }
    }
  }, [refreshConfigurations]);

  const handleDuplicateConfiguration = useCallback((id: string) => {
    const originalName = configurations.find(c => c.id === id)?.name || 'Configuration';
    const newName = prompt('Enter name for duplicated configuration:', `${originalName} (Copy)`);
    
    if (newName) {
      try {
        duplicateConfiguration(id, newName);
        refreshConfigurations();
        setSuccess('Configuration duplicated successfully');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to duplicate configuration');
      }
    }
  }, [configurations, refreshConfigurations]);

  const handleSetDefault = useCallback((id: string) => {
    try {
      setDefaultConfiguration(id);
      refreshConfigurations();
      setSuccess('Default configuration updated');
    } catch (err) {
      setError('Failed to set default configuration');
    }
  }, [refreshConfigurations]);

  const handleExportConfiguration = useCallback((id: string) => {
    try {
      const data = exportConfiguration(id);
      setExportData(data);
      setSelectedConfig(configurations.find(c => c.id === id) || null);
      setMode('export');
    } catch (err) {
      setError('Failed to export configuration');
    }
  }, [configurations]);

  const handleImportConfiguration = useCallback(() => {
    if (!importData.trim()) {
      setError('Please paste configuration data');
      return;
    }

    try {
      importConfiguration(importData, importName || undefined);
      refreshConfigurations();
      setSuccess('Configuration imported successfully');
      setImportData('');
      setImportName('');
      setMode('list');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import configuration');
    }
  }, [importData, importName, refreshConfigurations]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setSuccess('Copied to clipboard');
    }).catch(() => {
      setError('Failed to copy to clipboard');
    });
  }, []);

  const downloadAsFile = useCallback((data: string, filename: string) => {
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setSuccess('Configuration downloaded');
  }, []);

  const storageStats = useMemo(() => getStorageStats(), [configurations]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">
              {mode === 'list' && 'Saved Configurations'}
              {mode === 'save' && 'Save Configuration'}
              {mode === 'import' && 'Import Configuration'}
              {mode === 'export' && 'Export Configuration'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Mode Navigation */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setMode('list')}
              className={`px-3 py-2 text-sm rounded-md transition-colors ${
                mode === 'list' 
                  ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Browse
            </button>
            <button
              onClick={() => setMode('save')}
              className={`px-3 py-2 text-sm rounded-md transition-colors ${
                mode === 'save' 
                  ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Save Current
            </button>
            <button
              onClick={() => setMode('import')}
              className={`px-3 py-2 text-sm rounded-md transition-colors ${
                mode === 'import' 
                  ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Import
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* List Mode */}
          {mode === 'list' && (
            <div className="space-y-4">
              {/* Search and Filters */}
              <div className="flex gap-4 items-center">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search configurations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'name' | 'created' | 'used')}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="name">Sort by Name</option>
                  <option value="created">Sort by Created</option>
                  <option value="used">Sort by Last Used</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={showRecent}
                    onChange={(e) => setShowRecent(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Recent only</span>
                </label>
              </div>

              {/* Storage Stats */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">
                    {storageStats.configCount} configurations • {(storageStats.storageSize / 1024).toFixed(1)} KB used
                  </span>
                  <span className="text-gray-500">
                    {storageStats.usagePercentage.toFixed(1)}% of storage
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(storageStats.usagePercentage, 100)}%` }}
                  />
                </div>
              </div>

              {/* Configuration List */}
              <div className="space-y-2">
                {filteredConfigurations.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {searchQuery ? 'No configurations match your search' : 'No saved configurations'}
                  </div>
                ) : (
                  filteredConfigurations.map((config) => (
                    <ConfigurationItem
                      key={config.id}
                      config={config}
                      onLoad={() => handleLoadConfiguration(config)}
                      onDelete={() => handleDeleteConfiguration(config.id)}
                      onDuplicate={() => handleDuplicateConfiguration(config.id)}
                      onSetDefault={() => handleSetDefault(config.id)}
                      onExport={() => handleExportConfiguration(config.id)}
                      isCurrentConfig={config.name === currentConfigName}
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {/* Save Mode */}
          {mode === 'save' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-blue-900 mb-2">Save Current Configuration</h3>
                <p className="text-sm text-blue-700">
                  This will save your current filters, query parameters, and visualization settings.
                </p>
              </div>
              <button
                onClick={onSaveConfiguration}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Save Configuration
              </button>
            </div>
          )}

          {/* Import Mode */}
          {mode === 'import' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Configuration Name (optional)
                </label>
                <input
                  type="text"
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                  placeholder="Leave empty to use original name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Configuration Data (JSON)
                </label>
                <textarea
                  value={importData}
                  onChange={(e) => setImportData(e.target.value)}
                  placeholder="Paste exported configuration JSON here..."
                  rows={10}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                />
              </div>
              <button
                onClick={handleImportConfiguration}
                disabled={!importData.trim()}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Import Configuration
              </button>
            </div>
          )}

          {/* Export Mode */}
          {mode === 'export' && selectedConfig && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-green-900 mb-2">
                  Export: {selectedConfig.name}
                </h3>
                <p className="text-sm text-green-700">
                  Copy the JSON data below or download as a file to share or backup this configuration.
                </p>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => copyToClipboard(exportData)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Copy to Clipboard
                </button>
                <button
                  onClick={() => downloadAsFile(exportData, `${selectedConfig.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`)}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  Download File
                </button>
                <button
                  onClick={() => setMode('list')}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                >
                  Back to List
                </button>
              </div>
              
              <textarea
                value={exportData}
                readOnly
                rows={15}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 font-mono text-sm"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200">
          {/* Status Messages */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
          
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Configuration Item Component
interface ConfigurationItemProps {
  config: SavedConfiguration;
  onLoad: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSetDefault: () => void;
  onExport: () => void;
  isCurrentConfig: boolean;
}

const ConfigurationItem: React.FC<ConfigurationItemProps> = ({
  config,
  onLoad,
  onDelete,
  onDuplicate,
  onSetDefault,
  onExport,
  isCurrentConfig
}) => {
  const [showActions, setShowActions] = useState(false);

  return (
    <div 
      className={`border rounded-lg p-4 transition-colors ${
        isCurrentConfig 
          ? 'border-blue-300 bg-blue-50' 
          : 'border-gray-200 hover:border-gray-300'
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-medium text-gray-900 truncate">
              {config.name}
            </h3>
            {config.isDefault && (
              <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                Default
              </span>
            )}
            {isCurrentConfig && (
              <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                Current
              </span>
            )}
          </div>
          
          {config.description && (
            <p className="text-xs text-gray-600 mb-2 line-clamp-2">
              {config.description}
            </p>
          )}
          
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>Created: {config.createdAt.toLocaleDateString()}</span>
            {config.lastUsed && (
              <span>Last used: {config.lastUsed.toLocaleDateString()}</span>
            )}
            {config.tags && config.tags.length > 0 && (
              <div className="flex gap-1">
                {config.tags.slice(0, 3).map((tag, index) => (
                  <span key={index} className="px-1 py-0.5 bg-gray-100 rounded text-xs">
                    {tag}
                  </span>
                ))}
                {config.tags.length > 3 && (
                  <span className="text-gray-400">+{config.tags.length - 3}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className={`flex gap-1 transition-opacity ${showActions ? 'opacity-100' : 'opacity-0'}`}>
          <button
            onClick={onLoad}
            className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
            title="Load configuration"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </button>
          
          <button
            onClick={onDuplicate}
            className="p-1 text-gray-600 hover:bg-gray-100 rounded transition-colors"
            title="Duplicate configuration"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          
          <button
            onClick={onExport}
            className="p-1 text-green-600 hover:bg-green-100 rounded transition-colors"
            title="Export configuration"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
          
          {!config.isDefault && (
            <button
              onClick={onSetDefault}
              className="p-1 text-yellow-600 hover:bg-yellow-100 rounded transition-colors"
              title="Set as default"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </button>
          )}
          
          {!config.isDefault && (
            <button
              onClick={onDelete}
              className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
              title="Delete configuration"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};