import React, { useState, useMemo } from 'react';
import { FilteredStatistics, TimeSeriesData } from '@shared/types';

interface StatisticsPanelProps {
  statistics: FilteredStatistics | null;
  onExport?: (format: 'csv' | 'json') => void;
  className?: string;
}

export const StatisticsPanel: React.FC<StatisticsPanelProps> = ({
  statistics,
  onExport,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'traffic' | 'connections' | 'geography'>('overview');
  const [isExpanded, setIsExpanded] = useState(true);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat().format(num);
  };

  const formatPercentage = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  const formatRate = (value: number): string => {
    if (value < 1) return `${(value * 100).toFixed(1)}%`;
    return formatNumber(Math.round(value));
  };

  if (!statistics) {
    return (
      <div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
        <div className="px-4 py-8 text-center text-gray-500">
          <svg className="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-sm">No statistics available</p>
          <p className="text-xs text-gray-400 mt-1">
            Load network data to see traffic statistics
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900">Statistics</h3>
          <div className="flex items-center gap-2">
            {onExport && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onExport('csv')}
                  className="text-xs text-blue-600 hover:text-blue-700 underline"
                >
                  CSV
                </button>
                <span className="text-xs text-gray-400">|</span>
                <button
                  onClick={() => onExport('json')}
                  className="text-xs text-blue-600 hover:text-blue-700 underline"
                >
                  JSON
                </button>
              </div>
            )}
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

      {/* Content */}
      {isExpanded && (
        <div className="p-4">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 mb-4">
            {[
              { key: 'overview', label: 'Overview', icon: '📊' },
              { key: 'traffic', label: 'Traffic', icon: '🚦' },
              { key: 'connections', label: 'Connections', icon: '🔗' },
              { key: 'geography', label: 'Geography', icon: '🌍' }
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
                <span className="mr-1">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="text-xs text-blue-600 font-medium">Total Records</div>
                  <div className="text-lg font-bold text-blue-900">
                    {formatNumber(statistics.filteredRecords)}
                  </div>
                  <div className="text-xs text-blue-600">
                    {formatPercentage(100 - statistics.reductionPercentage)} of {formatNumber(statistics.totalRecords)}
                  </div>
                </div>
                
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="text-xs text-green-600 font-medium">Total Traffic</div>
                  <div className="text-lg font-bold text-green-900">
                    {formatBytes(statistics.totalBytes)}
                  </div>
                  <div className="text-xs text-green-600">
                    {formatNumber(statistics.totalPackets)} packets
                  </div>
                </div>
                
                <div className="bg-purple-50 p-3 rounded-lg">
                  <div className="text-xs text-purple-600 font-medium">Connections</div>
                  <div className="text-lg font-bold text-purple-900">
                    {formatNumber(statistics.totalConnections)}
                  </div>
                  <div className="text-xs text-purple-600">
                    {formatPercentage((statistics.acceptedConnections / statistics.totalConnections) * 100)} accepted
                  </div>
                </div>
                
                <div className="bg-red-50 p-3 rounded-lg">
                  <div className="text-xs text-red-600 font-medium">Rejection Rate</div>
                  <div className="text-lg font-bold text-red-900">
                    {formatPercentage(statistics.rejectionRate)}
                  </div>
                  <div className="text-xs text-red-600">
                    {formatNumber(statistics.rejectedConnections)} rejected
                  </div>
                </div>
              </div>

              {/* Filter Impact */}
              {statistics.reductionPercentage > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span className="text-sm font-medium text-yellow-800">
                      Filters reduced data by {formatPercentage(statistics.reductionPercentage)}
                    </span>
                  </div>
                  <div className="text-xs text-yellow-700 mt-1">
                    Showing {formatNumber(statistics.filteredRecords)} of {formatNumber(statistics.totalRecords)} total records
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Traffic Tab */}
          {activeTab === 'traffic' && (
            <div className="space-y-4">
              {/* Top Source IPs */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Top Source IPs</h4>
                <div className="space-y-2">
                  {statistics.topSourceIPs.slice(0, 5).map((ip, index) => (
                    <div key={ip.ip} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          #{index + 1}
                        </span>
                        <span className="text-sm font-mono">{ip.ip}</span>
                        {ip.isInternal && (
                          <span className="text-xs bg-blue-100 text-blue-600 px-1 rounded">
                            Internal
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{formatBytes(ip.bytes)}</div>
                        <div className="text-xs text-gray-500">
                          {formatNumber(ip.connections)} conn
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Protocols */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Protocol Distribution</h4>
                <div className="space-y-2">
                  {statistics.topProtocols.slice(0, 5).map((protocol, index) => (
                    <div key={protocol.protocol} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{protocol.protocol}</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-2 min-w-[60px]">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${protocol.percentage}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{formatPercentage(protocol.percentage)}</div>
                        <div className="text-xs text-gray-500">
                          {formatBytes(protocol.bytes)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Ports */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Top Ports</h4>
                <div className="space-y-2">
                  {statistics.topPorts.slice(0, 5).map((port, index) => (
                    <div key={`${port.port}-${port.protocol}`} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono">{port.port}</span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          {port.protocol}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{formatNumber(port.connections)}</div>
                        <div className="text-xs text-gray-500">
                          {formatBytes(port.bytes)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Connections Tab */}
          {activeTab === 'connections' && (
            <div className="space-y-4">
              {/* Connection Status */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Connection Status</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="text-xs text-green-600 font-medium">Accepted</div>
                    <div className="text-lg font-bold text-green-900">
                      {formatNumber(statistics.acceptedConnections)}
                    </div>
                    <div className="text-xs text-green-600">
                      {formatPercentage((statistics.acceptedConnections / statistics.totalConnections) * 100)}
                    </div>
                  </div>
                  
                  <div className="bg-red-50 p-3 rounded-lg">
                    <div className="text-xs text-red-600 font-medium">Rejected</div>
                    <div className="text-lg font-bold text-red-900">
                      {formatNumber(statistics.rejectedConnections)}
                    </div>
                    <div className="text-xs text-red-600">
                      {formatPercentage((statistics.rejectedConnections / statistics.totalConnections) * 100)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Destination IPs */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Top Destination IPs</h4>
                <div className="space-y-2">
                  {statistics.topDestinationIPs.slice(0, 5).map((ip, index) => (
                    <div key={ip.ip} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          #{index + 1}
                        </span>
                        <span className="text-sm font-mono">{ip.ip}</span>
                        {ip.isInternal && (
                          <span className="text-xs bg-blue-100 text-blue-600 px-1 rounded">
                            Internal
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{formatNumber(ip.connections)}</div>
                        <div className="text-xs text-gray-500">
                          {formatBytes(ip.bytes)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Peak Traffic Time */}
              {statistics.peakTrafficTime && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-medium text-blue-800">
                      Peak Traffic Time
                    </span>
                  </div>
                  <div className="text-sm text-blue-700 mt-1">
                    {statistics.peakTrafficTime.toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Geography Tab */}
          {activeTab === 'geography' && (
            <div className="space-y-4">
              {/* Top Regions */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Top Regions</h4>
                <div className="space-y-2">
                  {statistics.topRegions.slice(0, 5).map((region, index) => (
                    <div key={region.region} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          #{index + 1}
                        </span>
                        <span className="text-sm font-medium">{region.region}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{formatBytes(region.bytes)}</div>
                        <div className="text-xs text-gray-500">
                          {region.vpcs} VPCs, {formatNumber(region.connections)} conn
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top VPCs */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Top VPCs</h4>
                <div className="space-y-2">
                  {statistics.topVPCs.slice(0, 5).map((vpc, index) => (
                    <div key={vpc.vpcId} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          #{index + 1}
                        </span>
                        <div>
                          <div className="text-sm font-mono">{vpc.vpcId}</div>
                          {vpc.name && (
                            <div className="text-xs text-gray-500">{vpc.name}</div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{formatBytes(vpc.bytes)}</div>
                        <div className="text-xs text-gray-500">
                          {vpc.region}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Accounts */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Top Accounts</h4>
                <div className="space-y-2">
                  {statistics.topAccounts.slice(0, 5).map((account, index) => (
                    <div key={account.accountId} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          #{index + 1}
                        </span>
                        <div>
                          <div className="text-sm font-mono">{account.accountId}</div>
                          {account.name && (
                            <div className="text-xs text-gray-500">{account.name}</div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{formatBytes(account.bytes)}</div>
                        <div className="text-xs text-gray-500">
                          {account.vpcs} VPCs
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};