import React, { useState, useCallback } from 'react';
import { 
  ExportOptions, 
  ExportProgress, 
  validateExportOptions, 
  generateFilename,
  getExportRecommendations 
} from '../../utils/export-utils';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => Promise<void>;
  availableFormats: ('png' | 'svg' | 'csv' | 'json')[];
  defaultFormat?: 'png' | 'svg' | 'csv' | 'json';
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  onClose,
  onExport,
  availableFormats,
  defaultFormat = 'png'
}) => {
  const [options, setOptions] = useState<ExportOptions>({
    format: defaultFormat,
    quality: 1.0,
    width: 1920,
    height: 1080,
    backgroundColor: '#ffffff',
    includeMetadata: true
  });

  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [useCase, setUseCase] = useState<'presentation' | 'analysis' | 'documentation' | 'sharing'>('presentation');
  const [customFilename, setCustomFilename] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const handleFormatChange = useCallback((format: 'png' | 'svg' | 'csv' | 'json') => {
    setOptions(prev => ({
      ...prev,
      format,
      // Reset format-specific options
      ...(format === 'csv' || format === 'json' ? {
        width: undefined,
        height: undefined,
        quality: undefined,
        backgroundColor: undefined
      } : {})
    }));
    setErrors([]);
  }, []);

  const handleUseCaseChange = useCallback((newUseCase: typeof useCase) => {
    setUseCase(newUseCase);
    const recommendations = getExportRecommendations(newUseCase);
    const recommendation = recommendations.find(rec => rec.format === options.format);
    
    if (recommendation) {
      setOptions(prev => ({
        ...prev,
        ...recommendation
      }));
    }
  }, [options.format]);

  const handleExport = useCallback(async () => {
    const validation = validateExportOptions(options);
    
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setErrors([]);
    
    const filename = customFilename || generateFilename(
      `network-topology`,
      options.format
    );

    const exportOptions: ExportOptions = {
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

  const isImageFormat = options.format === 'png' || options.format === 'svg';
  const isDataFormat = options.format === 'csv' || options.format === 'json';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Export Options</h2>
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

          {/* Use Case Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Export Purpose
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['presentation', 'analysis', 'documentation', 'sharing'] as const).map((case_) => (
                <button
                  key={case_}
                  onClick={() => handleUseCaseChange(case_)}
                  className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                    useCase === case_
                      ? 'bg-blue-50 border-blue-200 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {case_.charAt(0).toUpperCase() + case_.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Format Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Export Format
            </label>
            <div className="grid grid-cols-2 gap-2">
              {availableFormats.map((format) => (
                <button
                  key={format}
                  onClick={() => handleFormatChange(format)}
                  className={`px-4 py-3 text-sm rounded-md border transition-colors ${
                    options.format === format
                      ? 'bg-blue-50 border-blue-200 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium">{format.toUpperCase()}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {getFormatDescription(format)}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Image Format Options */}
          {isImageFormat && (
            <div className="mb-6 space-y-4">
              <h3 className="text-sm font-medium text-gray-700">Image Options</h3>
              
              {/* Dimensions */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Width (px)</label>
                  <input
                    type="number"
                    value={options.width || ''}
                    onChange={(e) => setOptions(prev => ({
                      ...prev,
                      width: e.target.value ? parseInt(e.target.value) : undefined
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Auto"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Height (px)</label>
                  <input
                    type="number"
                    value={options.height || ''}
                    onChange={(e) => setOptions(prev => ({
                      ...prev,
                      height: e.target.value ? parseInt(e.target.value) : undefined
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Auto"
                  />
                </div>
              </div>

              {/* Quality (PNG only) */}
              {options.format === 'png' && (
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Quality: {Math.round((options.quality || 1) * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={options.quality || 1}
                    onChange={(e) => setOptions(prev => ({
                      ...prev,
                      quality: parseFloat(e.target.value)
                    }))}
                    className="w-full"
                  />
                </div>
              )}

              {/* Background Color */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">Background Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={options.backgroundColor || '#ffffff'}
                    onChange={(e) => setOptions(prev => ({
                      ...prev,
                      backgroundColor: e.target.value
                    }))}
                    className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={options.backgroundColor || '#ffffff'}
                    onChange={(e) => setOptions(prev => ({
                      ...prev,
                      backgroundColor: e.target.value
                    }))}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="#ffffff"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Data Format Options */}
          {isDataFormat && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Data Options</h3>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={options.includeMetadata || false}
                  onChange={(e) => setOptions(prev => ({
                    ...prev,
                    includeMetadata: e.target.checked
                  }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-600">
                  Include metadata and analysis results
                </span>
              </label>
            </div>
          )}

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
              placeholder={generateFilename('network-topology', options.format)}
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave empty to auto-generate with timestamp
            </p>
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
              disabled={progress?.stage === 'processing' || progress?.stage === 'generating'}
            >
              {progress?.stage === 'processing' || progress?.stage === 'generating' 
                ? 'Exporting...' 
                : 'Export'
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function getFormatDescription(format: string): string {
  const descriptions = {
    png: 'High-quality raster image',
    svg: 'Scalable vector graphics',
    csv: 'Spreadsheet-compatible data',
    json: 'Structured data format'
  };
  
  return descriptions[format as keyof typeof descriptions] || '';
}