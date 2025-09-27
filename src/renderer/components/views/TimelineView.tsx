import React, { useState } from 'react';
import { useAppSelector } from '../../store/hooks';
import { FlowLogRecord } from '../../../shared/types';

export const TimelineView: React.FC = () => {
  const { connectionStatus } = useAppSelector(state => state.auth);
  const { flowLogs } = useAppSelector(state => state.topology);
  const [chartType, setChartType] = useState<'timeline' | 'volume'>('timeline');

  // Show connection prompt if not connected
  if (!connectionStatus.connected) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Timeline View</h3>
          <p className="text-gray-600 mb-4">
            Connect to AWS to view traffic timeline and temporal analysis.
          </p>
          <p className="text-sm text-gray-500">
            Go to the Authentication tab to connect to your AWS account.
          </p>
        </div>
      </div>
    );
  }

  // Show query prompt if no flow logs
  if (!flowLogs || flowLogs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Timeline Data</h3>
          <p className="text-gray-600 mb-4">
            Query flow logs to view traffic patterns over time.
          </p>
          <div className="space-y-2 text-sm text-gray-500">
            <p>• Analyze traffic volume trends</p>
            <p>• Identify peak usage periods</p>
            <p>• Detect anomalies and patterns</p>
          </div>
        </div>
      </div>
    );
  }

  const dataToAnalyze = flowLogs;

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header Controls */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Traffic Timeline</h2>
            <p className="text-sm text-gray-500">
              Analyzing {dataToAnalyze.length} flow log records
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Chart Type Selector */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setChartType('timeline')}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  chartType === 'timeline'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Timeline
              </button>
              <button
                onClick={() => setChartType('volume')}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  chartType === 'volume'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Volume
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="flex-1 p-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Timeline Visualization</h3>
            <p className="text-gray-600 max-w-md">
              Interactive timeline charts will be displayed here when chart components are implemented.
            </p>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-semibold text-gray-900">
              {dataToAnalyze.length.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500">Total Records</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-gray-900">
              {dataToAnalyze.reduce((sum: number, record: FlowLogRecord) => sum + record.bytes, 0).toLocaleString()}
            </div>
            <div className="text-sm text-gray-500">Total Bytes</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-gray-900">
              {new Set(dataToAnalyze.map((r: FlowLogRecord) => r.sourceIP)).size.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500">Unique Sources</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-gray-900">
              {Math.round((dataToAnalyze.filter((r: FlowLogRecord) => r.action === 'ACCEPT').length / dataToAnalyze.length) * 100)}%
            </div>
            <div className="text-sm text-gray-500">Accept Rate</div>
          </div>
        </div>
      </div>
    </div>
  );
};