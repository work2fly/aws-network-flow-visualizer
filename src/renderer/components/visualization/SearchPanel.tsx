import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { SearchQuery, SearchResult, SearchType, NetworkNode, NetworkEdge } from '@shared/types';

interface SearchPanelProps {
  onSearch: (query: SearchQuery) => SearchResult[];
  onHighlight: (nodeIds: string[], edgeIds: string[]) => void;
  onClearHighlights: () => void;
  onNavigateToResult: (result: SearchResult) => void;
  className?: string;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
  onSearch,
  onHighlight,
  onClearHighlights,
  onNavigateToResult,
  className = ''
}) => {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('all');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [exactMatch, setExactMatch] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState(-1);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Perform search when query or options change
  const performSearch = useCallback(() => {
    if (!query.trim()) {
      setResults([]);
      onClearHighlights();
      return;
    }

    const searchQuery: SearchQuery = {
      query: query.trim(),
      type: searchType,
      caseSensitive,
      exactMatch
    };

    const searchResults = onSearch(searchQuery);
    setResults(searchResults);
    setSelectedResultIndex(searchResults.length > 0 ? 0 : -1);

    // Highlight all results
    const nodeIds = searchResults
      .filter(result => result.type === 'node')
      .map(result => result.id);
    const edgeIds = searchResults
      .filter(result => result.type === 'edge')
      .map(result => result.id);
    
    onHighlight(nodeIds, edgeIds);
  }, [query, searchType, caseSensitive, exactMatch, onSearch, onHighlight, onClearHighlights]);

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(performSearch, 300);
    return () => clearTimeout(timeoutId);
  }, [performSearch]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (results.length > 0 && selectedResultIndex >= 0) {
        onNavigateToResult(results[selectedResultIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedResultIndex(prev => 
        prev < results.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedResultIndex(prev => 
        prev > 0 ? prev - 1 : results.length - 1
      );
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setQuery('');
      onClearHighlights();
    }
  }, [results, selectedResultIndex, onNavigateToResult, onClearHighlights]);

  // Navigate to specific result
  const handleResultClick = useCallback((result: SearchResult, index: number) => {
    setSelectedResultIndex(index);
    onNavigateToResult(result);
  }, [onNavigateToResult]);

  // Clear search
  const handleClear = useCallback(() => {
    setQuery('');
    setResults([]);
    setSelectedResultIndex(-1);
    onClearHighlights();
    searchInputRef.current?.focus();
  }, [onClearHighlights]);

  // Navigate through results
  const navigateResults = useCallback((direction: 'next' | 'prev') => {
    if (results.length === 0) return;
    
    let newIndex;
    if (direction === 'next') {
      newIndex = selectedResultIndex < results.length - 1 ? selectedResultIndex + 1 : 0;
    } else {
      newIndex = selectedResultIndex > 0 ? selectedResultIndex - 1 : results.length - 1;
    }
    
    setSelectedResultIndex(newIndex);
    onNavigateToResult(results[newIndex]);
  }, [results, selectedResultIndex, onNavigateToResult]);

  const searchTypeOptions: { value: SearchType; label: string; icon: string }[] = [
    { value: 'all', label: 'All', icon: '🔍' },
    { value: 'ip', label: 'IP Address', icon: '🌐' },
    { value: 'port', label: 'Port', icon: '🚪' },
    { value: 'protocol', label: 'Protocol', icon: '📡' },
    { value: 'node', label: 'Node', icon: '🔗' }
  ];

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900">Search</h3>
          <div className="flex items-center gap-2">
            {results.length > 0 && (
              <span className="text-xs text-gray-500">
                {selectedResultIndex + 1} of {results.length}
              </span>
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

      {/* Search Input */}
      <div className="p-4">
        <div className="relative">
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search IPs, ports, protocols, nodes..."
            className="w-full pl-10 pr-20 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
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

        {/* Search Options */}
        {isExpanded && (
          <div className="mt-3 space-y-3">
            {/* Search Type */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Search Type
              </label>
              <div className="flex flex-wrap gap-1">
                {searchTypeOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setSearchType(option.value)}
                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                      searchType === option.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="mr-1">{option.icon}</span>
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Options */}
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={caseSensitive}
                  onChange={(e) => setCaseSensitive(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-xs text-gray-700">Case sensitive</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={exactMatch}
                  onChange={(e) => setExactMatch(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-xs text-gray-700">Exact match</span>
              </label>
            </div>
          </div>
        )}

        {/* Navigation Controls */}
        {results.length > 0 && (
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigateResults('prev')}
                disabled={results.length === 0}
                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => navigateResults('next')}
                disabled={results.length === 0}
                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <button
              onClick={onClearHighlights}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Clear highlights
            </button>
          </div>
        )}
      </div>

      {/* Search Results */}
      {results.length > 0 && (
        <div className="border-t border-gray-200">
          <div className="px-4 py-2 bg-gray-50">
            <span className="text-xs font-medium text-gray-700">
              {results.length} result{results.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div 
            ref={resultsRef}
            className="max-h-64 overflow-y-auto"
          >
            {results.map((result, index) => (
              <div
                key={`${result.type}-${result.id}`}
                onClick={() => handleResultClick(result, index)}
                className={`px-4 py-2 border-b border-gray-100 cursor-pointer transition-colors ${
                  index === selectedResultIndex
                    ? 'bg-blue-50 border-blue-200'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600">
                      {result.type}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {result.label}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {Math.round(result.relevance * 100)}%
                  </span>
                </div>
                {result.matches.length > 0 && (
                  <div className="mt-1 text-xs text-gray-600">
                    {result.matches.map((match, matchIndex) => (
                      <div key={matchIndex}>
                        <span className="font-medium">{match.field}:</span>{' '}
                        <span>
                          {match.value.substring(0, match.highlightStart)}
                          <mark className="bg-yellow-200 px-0">
                            {match.value.substring(match.highlightStart, match.highlightEnd)}
                          </mark>
                          {match.value.substring(match.highlightEnd)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Results */}
      {query && results.length === 0 && (
        <div className="px-4 py-8 text-center text-gray-500">
          <svg className="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-sm">No results found for "{query}"</p>
          <p className="text-xs text-gray-400 mt-1">
            Try adjusting your search terms or filters
          </p>
        </div>
      )}
    </div>
  );
};