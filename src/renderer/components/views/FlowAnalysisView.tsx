import React, { useState } from 'react';
import { useAppSelector } from '../../store/hooks';
import { FlowLogRecord } from '../../../shared/types';

export const FlowAnalysisView: React.FC = () => {
  const { connectionStatus } = useAppSelector(state => state.auth);
  const { flowLogs } = useAppSelector(state => state.topology);
  const [activePanel, setActivePanel] = useState<'filters' | 'search' | 'statistics'>('filters');

  // Show connection prompt if not connected
  if (!connectionStatus.connected) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Flow Analysis</h3>
          <p className="text-gray-600 mb-4">
            Connect to AWS to analyze your VPC and Transit Gateway flow logs.
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Flow Log Data</h3>
          <p className="text-gray-600 mb-4">
            Query VPC or Transit Gateway flow logs to start analyzing your network traffic.
          </p>
          <div className="space-y-2 text-sm text-gray-500">
            <p>• Use CloudWatch Insights to query flow logs</p>
            <p>• Filter by time range, IPs, ports, and protocols</p>
            <p>• Analyze traffic patterns and anomalies</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-gray-50">
      {/* Left Panel - Controls */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Panel Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex">
            <button
              onClick={() => setActivePanel('filters')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activePanel === 'filters'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Filters
            </button>
            <button
              onClick={() => setActivePanel('search')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activePanel === 'search'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Search
            </button>
            <button
              onClick={() => setActivePanel('statistics')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activePanel === 'statistics'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Statistics
            </button>
          </nav>
        </div>

        {/* Panel Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activePanel === 'filters' && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900">Filters</h3>
              <p className="text-sm text-gray-500">Filter controls will be available here.</p>
            </div>
          )}
          {activePanel === 'search' && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900">Search</h3>
              <p className="text-sm text-gray-500">Search functionality will be available here.</p>
            </div>
          )}
          {activePanel === 'statistics' && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900">Statistics</h3>
              <p className="text-sm text-gray-500">Traffic statistics will be displayed here.</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Flow Log Data */}
      <div className="flex-1 flex flex-col">
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Flow Log Analysis</h2>
              <p className="text-sm text-gray-500">
                {flowLogs.length} records
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 p-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-900">Flow Log Records</h3>
            </div>
            <div className="overflow-auto h-full">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Destination</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Protocol</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bytes</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {flowLogs.slice(0, 100).map((record: FlowLogRecord, index: number) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {record.timestamp.toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {record.sourceIP}:{record.sourcePort}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {record.destinationIP}:{record.destinationPort}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {record.protocol}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          record.action === 'ACCEPT' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {record.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {record.bytes.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};