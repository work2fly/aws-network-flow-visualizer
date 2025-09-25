import React from 'react';
import { NetworkNode, NetworkEdge } from '@shared/types';

interface NodeDetailsPanelProps {
  selectedNode: NetworkNode | null;
  selectedEdge: NetworkEdge | null;
  onClose: () => void;
  className?: string;
}

export const NodeDetailsPanel: React.FC<NodeDetailsPanelProps> = ({
  selectedNode,
  selectedEdge,
  onClose,
  className = ''
}) => {
  if (!selectedNode && !selectedEdge) {
    return null;
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">
          {selectedNode ? 'Node Details' : 'Connection Details'}
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-4 max-h-96 overflow-y-auto">
        {selectedNode && <NodeDetails node={selectedNode} />}
        {selectedEdge && <EdgeDetails edge={selectedEdge} />}
      </div>
    </div>
  );
};

interface NodeDetailsProps {
  node: NetworkNode;
}

const NodeDetails: React.FC<NodeDetailsProps> = ({ node }) => {
  return (
    <div className="space-y-4">
      {/* Basic Information */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-2">Basic Information</h4>
        <div className="space-y-2">
          <DetailRow label="ID" value={node.id} />
          <DetailRow label="Label" value={node.label} />
          <DetailRow label="Type" value={node.type} />
          <DetailRow 
            label="Status" 
            value={
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                node.metadata.isActive 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {node.metadata.isActive ? 'Active' : 'Inactive'}
              </span>
            } 
          />
        </div>
      </div>

      {/* Network Properties */}
      {(node.properties.privateIpAddress || node.properties.publicIpAddress || node.properties.cidrBlock) && (
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-2">Network</h4>
          <div className="space-y-2">
            {node.properties.privateIpAddress && (
              <DetailRow label="Private IP" value={node.properties.privateIpAddress} />
            )}
            {node.properties.publicIpAddress && (
              <DetailRow label="Public IP" value={node.properties.publicIpAddress} />
            )}
            {node.properties.cidrBlock && (
              <DetailRow label="CIDR Block" value={node.properties.cidrBlock} />
            )}
          </div>
        </div>
      )}

      {/* AWS Properties */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-2">AWS Properties</h4>
        <div className="space-y-2">
          {node.properties.region && (
            <DetailRow label="Region" value={node.properties.region} />
          )}
          {node.properties.accountId && (
            <DetailRow label="Account ID" value={node.properties.accountId} />
          )}
          {node.properties.availabilityZone && (
            <DetailRow label="Availability Zone" value={node.properties.availabilityZone} />
          )}
          {node.properties.instanceType && (
            <DetailRow label="Instance Type" value={node.properties.instanceType} />
          )}
          {node.properties.state && (
            <DetailRow label="State" value={node.properties.state} />
          )}
        </div>
      </div>

      {/* Traffic Statistics */}
      {(node.metadata.trafficVolume || node.metadata.connectionCount) && (
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-2">Traffic Statistics</h4>
          <div className="space-y-2">
            {node.metadata.trafficVolume && (
              <DetailRow 
                label="Traffic Volume" 
                value={formatBytes(node.metadata.trafficVolume)} 
              />
            )}
            {node.metadata.connectionCount && (
              <DetailRow 
                label="Connections" 
                value={node.metadata.connectionCount.toLocaleString()} 
              />
            )}
            {node.metadata.lastSeen && (
              <DetailRow 
                label="Last Seen" 
                value={formatDate(node.metadata.lastSeen)} 
              />
            )}
          </div>
        </div>
      )}

      {/* Tags */}
      {node.properties.tags && Object.keys(node.properties.tags).length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-2">Tags</h4>
          <div className="space-y-1">
            {Object.entries(node.properties.tags).map(([key, value]) => (
              <DetailRow key={key} label={key} value={value} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface EdgeDetailsProps {
  edge: NetworkEdge;
}

const EdgeDetails: React.FC<EdgeDetailsProps> = ({ edge }) => {
  return (
    <div className="space-y-4">
      {/* Basic Information */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-2">Connection Information</h4>
        <div className="space-y-2">
          <DetailRow label="ID" value={edge.id} />
          <DetailRow label="Source" value={edge.source} />
          <DetailRow label="Target" value={edge.target} />
          <DetailRow 
            label="Type" 
            value={edge.properties.connectionType || 'Unknown'} 
          />
          <DetailRow 
            label="Bidirectional" 
            value={edge.properties.bidirectional ? 'Yes' : 'No'} 
          />
        </div>
      </div>

      {/* Traffic Statistics */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-2">Traffic Statistics</h4>
        <div className="space-y-2">
          <DetailRow 
            label="Total Bytes" 
            value={formatBytes(edge.trafficStats.totalBytes)} 
          />
          <DetailRow 
            label="Total Packets" 
            value={edge.trafficStats.totalPackets.toLocaleString()} 
          />
          <DetailRow 
            label="Accepted Connections" 
            value={edge.trafficStats.acceptedConnections.toLocaleString()} 
          />
          <DetailRow 
            label="Rejected Connections" 
            value={edge.trafficStats.rejectedConnections.toLocaleString()} 
          />
          {edge.trafficStats.sourceToTargetBytes > 0 && (
            <DetailRow 
              label="Source → Target" 
              value={formatBytes(edge.trafficStats.sourceToTargetBytes)} 
            />
          )}
          {edge.trafficStats.targetToSourceBytes > 0 && (
            <DetailRow 
              label="Target → Source" 
              value={formatBytes(edge.trafficStats.targetToSourceBytes)} 
            />
          )}
        </div>
      </div>

      {/* Protocol and Port Information */}
      {(edge.properties.protocols.length > 0 || edge.properties.ports.length > 0) && (
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-2">Protocol & Ports</h4>
          <div className="space-y-2">
            {edge.properties.protocols.length > 0 && (
              <DetailRow 
                label="Protocols" 
                value={edge.properties.protocols.join(', ')} 
              />
            )}
            {edge.properties.ports.length > 0 && (
              <DetailRow 
                label="Ports" 
                value={edge.properties.ports.slice(0, 10).join(', ') + 
                       (edge.properties.ports.length > 10 ? '...' : '')} 
              />
            )}
          </div>
        </div>
      )}

      {/* Security Information */}
      {(edge.properties.hasRejectedConnections || edge.properties.rejectionRate) && (
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-2">Security</h4>
          <div className="space-y-2">
            {edge.properties.hasRejectedConnections && (
              <DetailRow 
                label="Has Rejected Connections" 
                value={
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    Yes
                  </span>
                } 
              />
            )}
            {edge.properties.rejectionRate && (
              <DetailRow 
                label="Rejection Rate" 
                value={`${(edge.properties.rejectionRate * 100).toFixed(2)}%`} 
              />
            )}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-2">Metadata</h4>
        <div className="space-y-2">
          {edge.metadata.firstSeen && (
            <DetailRow 
              label="First Seen" 
              value={formatDate(edge.metadata.firstSeen)} 
            />
          )}
          {edge.metadata.lastSeen && (
            <DetailRow 
              label="Last Seen" 
              value={formatDate(edge.metadata.lastSeen)} 
            />
          )}
          {edge.metadata.confidence && (
            <DetailRow 
              label="Confidence" 
              value={`${(edge.metadata.confidence * 100).toFixed(1)}%`} 
            />
          )}
        </div>
      </div>
    </div>
  );
};

interface DetailRowProps {
  label: string;
  value: React.ReactNode;
}

const DetailRow: React.FC<DetailRowProps> = ({ label, value }) => {
  return (
    <div className="flex justify-between items-start">
      <span className="text-xs font-medium text-gray-500 flex-shrink-0 w-24">
        {label}:
      </span>
      <span className="text-xs text-gray-900 text-right break-all">
        {value}
      </span>
    </div>
  );
};

// Utility functions
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
}