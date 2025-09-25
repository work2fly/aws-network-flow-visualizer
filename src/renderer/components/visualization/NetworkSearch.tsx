import React, { useState, useCallback, useRef, useEffect } from 'react';
import { NetworkNode } from '@shared/types';

interface NetworkSearchProps {
  onSearch: (query: string) => NetworkNode[];
  onNodeSelect: (nodeId: string) => void;
  onHighlightNodes: (nodeIds: string[]) => void;
  onClearHighlights: () => void;
  className?: string;
}

export const NetworkSearch: React.FC<NetworkSearchProps> = ({
  onSearch,
  onNodeSelect,
  onHighlightNodes,
  onClearHighlights,
  className = ''
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NetworkNode[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Debounced search
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  
  const performSearch = useCallback((searchQuery: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      if (searchQuery.trim()) {
        const searchResults = onSearch(searchQuery);
        setResults(searchResults);
        setIsOpen(searchResults.length > 0);
        setSelectedIndex(-1);
        
        // Highlight all results
        onHighlightNodes(searchResults.map(node => node.id));
      } else {
        setResults([]);
        setIsOpen(false);
        onClearHighlights();
      }
    }, 300);
  }, [onSearch, onHighlightNodes, onClearHighlights]);

  useEffect(() => {
    performSearch(query);
  }, [query, performSearch]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleNodeSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        handleClear();
        break;
    }
  };

  const handleNodeSelect = (node: NetworkNode) => {
    onNodeSelect(node.id);
    setQuery(node.label);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setSelectedIndex(-1);
    onClearHighlights();
    inputRef.current?.focus();
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (resultsRef.current && !resultsRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Search nodes (IP, name, ID, tags...)"
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div
          ref={resultsRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto"
        >
          <div className="py-1">
            {results.map((node, index) => (
              <button
                key={node.id}
                onClick={() => handleNodeSelect(node)}
                className={`w-full px-4 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none ${
                  index === selectedIndex ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-center">
                  <NodeTypeIcon type={node.type} className="w-4 h-4 mr-3 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {node.label}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {node.id} • {node.type}
                      {node.properties.privateIpAddress && ` • ${node.properties.privateIpAddress}`}
                    </div>
                  </div>
                  {node.metadata.isActive && (
                    <div className="flex-shrink-0 ml-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
          
          {/* Results Summary */}
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
            {results.length} result{results.length !== 1 ? 's' : ''} found
            {results.length > 0 && ' • Use ↑↓ to navigate, Enter to select'}
          </div>
        </div>
      )}

      {/* No Results */}
      {isOpen && query && results.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
          <div className="px-4 py-3 text-sm text-gray-500 text-center">
            No nodes found matching "{query}"
          </div>
        </div>
      )}
    </div>
  );
};

interface NodeTypeIconProps {
  type: string;
  className?: string;
}

const NodeTypeIcon: React.FC<NodeTypeIconProps> = ({ type, className = '' }) => {
  const getIcon = () => {
    switch (type) {
      case 'vpc':
        return (
          <svg className={className} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
          </svg>
        );
      case 'subnet':
        return (
          <svg className={className} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" clipRule="evenodd" />
          </svg>
        );
      case 'instance':
        return (
          <svg className={className} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clipRule="evenodd" />
          </svg>
        );
      case 'tgw':
        return (
          <svg className={className} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832L14 10.202a1 1 0 000-1.664l-4.445-2.37z" clipRule="evenodd" />
          </svg>
        );
      case 'vpn':
        return (
          <svg className={className} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
        );
      case 'internet-gateway':
        return (
          <svg className={className} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.56-.5-.948-.737-1.182C10.232 4.032 10.076 4 10 4zm3.971 5c-.089-1.546-.383-2.97-.837-4.118A6.004 6.004 0 0115.917 9h-1.946zm-2.003 2H8.032c.093 1.414.377 2.649.766 3.556.24.56.5.948.737 1.182.233.23.389.262.465.262.076 0 .232-.032.465-.262.238-.234.498-.623.737-1.182.389-.907.673-2.142.766-3.556zm1.166 4.118c.454-1.147.748-2.572.837-4.118h1.946a6.004 6.004 0 01-2.783 4.118zm-6.268 0C6.412 13.97 6.118 12.546 6.03 11H4.083a6.004 6.004 0 002.783 4.118z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className={className} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  const getColor = () => {
    const colors = {
      vpc: 'text-blue-500',
      subnet: 'text-green-500',
      instance: 'text-yellow-500',
      tgw: 'text-purple-500',
      vpn: 'text-red-500',
      'internet-gateway': 'text-cyan-500',
      'nat-gateway': 'text-lime-500',
      'load-balancer': 'text-orange-500'
    };
    return colors[type as keyof typeof colors] || 'text-gray-500';
  };

  return (
    <div className={`${getColor()} ${className}`}>
      {getIcon()}
    </div>
  );
};