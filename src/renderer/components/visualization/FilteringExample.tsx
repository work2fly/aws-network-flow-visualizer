import React, { useState } from 'react';
import { FilterPanel } from './FilterPanel';
import { SearchPanel } from './SearchPanel';
import { StatisticsPanel } from './StatisticsPanel';
import { useFilteringSystem } from '@renderer/hooks/useFilteringSystem';
import { NetworkTopology, FlowLogRecord } from '@shared/types';

interface FilteringExampleProps {
  topology: NetworkTopology | null;
  flowLogs: FlowLogRecord[];
}

export const FilteringExample: React.FC<FilteringExampleProps> = ({
  topology,
  flowLogs
}) => {
  const {
    filterState,
    filteredTopology,
    filteredStatistics,
    updateFilters,
    resetFilters,
    saveFilter,
    search,
    exportStatistics,
    exportFilteredData
  } = useFilteringSystem(topology, flowLogs);

  const [highlightedNodes, setHighlightedNodes] = useState<string[]>([]);
  const [highlightedEdges, setHighlightedEdges] = useState<string[]>([]);

  const handleSearch = (query: any) => {
    return search(query);
  };

  const handleHighlight = (nodeIds: string[], edgeIds: string[]) => {
    setHighlightedNodes(nodeIds);
    setHighlightedEdges(edgeIds);
  };

  const handleClearHighlights = () => {
    setHighlightedNodes([]);
    setHighlightedEdges([]);
  };

  const handleNavigateToResult = (result: any) => {
    console.log('Navigate to result:', result);
    // In a real implementation, this would focus/zoom to the result
  };

  const handleExportStatistics = async (format: 'csv' | 'json') => {
    try {
      const blob = await exportStatistics(format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `statistics.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 p-4">
      {/* Left Panel - Filters and Search */}
      <div className="w-full lg:w-80 space-y-4">
        <FilterPanel
          filters={filterState.filters}
          onFiltersChange={updateFilters}
          onReset={resetFilters}
          onSave={saveFilter}
        />
        
        <SearchPanel
          onSearch={handleSearch}
          onHighlight={handleHighlight}
          onClearHighlights={handleClearHighlights}
          onNavigateToResult={handleNavigateToResult}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Network Visualization
          </h3>
          
          {/* Placeholder for actual network visualization */}
          <div className="h-96 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">Network Topology</h3>
              <p className="mt-1 text-sm text-gray-500">
                {filteredTopology ? 
                  `${filteredTopology.nodes.length} nodes, ${filteredTopology.edges.length} edges` :
                  'No topology data available'
                }
              </p>
              {highlightedNodes.length > 0 && (
                <p className="mt-1 text-sm text-blue-600">
                  {highlightedNodes.length} nodes highlighted
                </p>
              )}
            </div>
          </div>

          {/* Filter Summary */}
          <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
            <span>
              Active filters: {filterState.activeFilterCount}
            </span>
            <span>
              Last updated: {filterState.lastApplied.toLocaleTimeString()}
            </span>
          </div>
        </div>
      </div>

      {/* Right Panel - Statistics */}
      <div className="w-full lg:w-80">
        <StatisticsPanel
          statistics={filteredStatistics}
          onExport={handleExportStatistics}
        />
      </div>
    </div>
  );
};