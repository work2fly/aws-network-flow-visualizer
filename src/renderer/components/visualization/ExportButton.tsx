import React, { useState, useCallback } from 'react';
import { ExportDialog } from './ExportDialog';
import { useExport } from '../../hooks/useExport';
import { ExportOptions } from '../../utils/export-utils';
import { NetworkTopology, FlowLogRecord } from '@shared/types';

interface ExportButtonProps {
  cytoscapeInstance?: any;
  topology?: NetworkTopology | null;
  flowLogs?: FlowLogRecord[];
  className?: string;
  variant?: 'button' | 'dropdown';
  size?: 'sm' | 'md' | 'lg';
}

export const ExportButton: React.FC<ExportButtonProps> = ({
  cytoscapeInstance,
  topology,
  flowLogs,
  className = '',
  variant = 'button',
  size = 'md'
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [exportType, setExportType] = useState<'visualization' | 'data' | 'topology'>('visualization');

  const {
    isExporting,
    progress,
    error,
    exportVisualizationImage,
    exportFlowData,
    exportTopology,
    clearError
  } = useExport({
    cytoscapeInstance,
    topology,
    flowLogs
  });

  const handleExport = useCallback(async (options: ExportOptions) => {
    try {
      switch (exportType) {
        case 'visualization':
          if (options.format === 'png' || options.format === 'svg') {
            await exportVisualizationImage(options);
          } else {
            throw new Error('Invalid format for visualization export');
          }
          break;
        case 'data':
          if (options.format === 'csv') {
            await exportFlowData(options);
          } else {
            throw new Error('Invalid format for data export');
          }
          break;
        case 'topology':
          if (options.format === 'json') {
            await exportTopology(options);
          } else {
            throw new Error('Invalid format for topology export');
          }
          break;
      }
    } catch (err) {
      console.error('Export failed:', err);
    }
  }, [exportType, exportVisualizationImage, exportFlowData, exportTopology]);

  const openDialog = useCallback((type: typeof exportType) => {
    setExportType(type);
    setIsDialogOpen(true);
    setIsDropdownOpen(false);
    clearError();
  }, [clearError]);

  const getAvailableFormats = useCallback((): ('png' | 'svg' | 'csv' | 'json')[] => {
    switch (exportType) {
      case 'visualization':
        return ['png', 'svg'];
      case 'data':
        return ['csv'];
      case 'topology':
        return ['json'];
      default:
        return ['png'];
    }
  }, [exportType]);

  const getDefaultFormat = useCallback((): 'png' | 'svg' | 'csv' | 'json' => {
    switch (exportType) {
      case 'visualization':
        return 'png';
      case 'data':
        return 'csv';
      case 'topology':
        return 'json';
      default:
        return 'png';
    }
  }, [exportType]);

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  if (variant === 'dropdown') {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className={`${sizeClasses[size]} bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
          disabled={isExporting}
        >
          <svg className={iconSizes[size]} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export
          <svg className={`${iconSizes[size]} transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isDropdownOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10">
            <div className="py-1">
              <button
                onClick={() => openDialog('visualization')}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                disabled={!cytoscapeInstance}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Export Visualization
              </button>
              <button
                onClick={() => openDialog('data')}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                disabled={!flowLogs || flowLogs.length === 0}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a4 4 0 01-4-4V5a4 4 0 014-4h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a4 4 0 01-4 4z" />
                </svg>
                Export Flow Data
              </button>
              <button
                onClick={() => openDialog('topology')}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                disabled={!topology}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Export Topology
              </button>
            </div>
          </div>
        )}

        {/* Click outside to close dropdown */}
        {isDropdownOpen && (
          <div
            className="fixed inset-0 z-0"
            onClick={() => setIsDropdownOpen(false)}
          />
        )}

        <ExportDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          onExport={handleExport}
          availableFormats={getAvailableFormats()}
          defaultFormat={getDefaultFormat()}
        />
      </div>
    );
  }

  // Simple button variant
  return (
    <div className={className}>
      <button
        onClick={() => openDialog('visualization')}
        className={`${sizeClasses[size]} bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
        disabled={isExporting || !cytoscapeInstance}
      >
        <svg className={iconSizes[size]} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        {isExporting ? 'Exporting...' : 'Export'}
      </button>

      <ExportDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onExport={handleExport}
        availableFormats={getAvailableFormats()}
        defaultFormat={getDefaultFormat()}
      />

      {/* Progress indicator */}
      {progress && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-10">
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

      {/* Error notification */}
      {error && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-red-50 border border-red-200 rounded-lg p-3 z-10">
          <div className="flex justify-between items-start">
            <p className="text-sm text-red-800">{error}</p>
            <button
              onClick={clearError}
              className="text-red-400 hover:text-red-600 ml-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};