import React from 'react';
import { useAppSelector } from '../../store/hooks';
import { NetworkVisualization } from '../visualization/NetworkVisualization';

export const TopologyView: React.FC = () => {
  const { topology } = useAppSelector(state => state.topology);
  const { connectionStatus } = useAppSelector(state => state.auth);

  // Show connection prompt if not connected
  if (!connectionStatus.connected) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Network Topology</h3>
          <p className="text-gray-600 mb-4">
            Connect to AWS to view your network topology visualization.
          </p>
          <p className="text-sm text-gray-500">
            Go to the Authentication tab to connect to your AWS account.
          </p>
        </div>
      </div>
    );
  }

  // Show empty state if no topology data
  if (!topology || topology.nodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Network Data</h3>
          <p className="text-gray-600 mb-4">
            No network topology data available. Query flow logs to build your network topology.
          </p>
          <p className="text-sm text-gray-500">
            Use the Flow Analysis tab to query VPC or Transit Gateway flow logs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-gray-50">
      {/* Main Visualization Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-4">
          <h2 className="text-lg font-semibold text-gray-900">Network Topology</h2>
          <p className="text-sm text-gray-500">
            Interactive visualization of your AWS network infrastructure
          </p>
        </div>
        
        {/* Network Visualization */}
        <div className="flex-1 relative">
          <NetworkVisualization topology={topology} />
        </div>
      </div>
    </div>
  );
};