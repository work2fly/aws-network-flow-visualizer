import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { 
  FlowFilters, 
  FilterState, 
  SavedFilter, 
  SearchQuery, 
  SearchResult,
  IPRangeFilter,
  PortFilter,
  TimeRangeFilter,
  TimeRangePreset
} from '@shared/types';

// Filter state interface
export interface FilterSliceState extends FilterState {
  // Search state
  currentSearch?: SearchQuery;
  searchResults: SearchResult[];
  isSearching: boolean;
  
  // UI state
  isFilterPanelOpen: boolean;
  isSearchPanelOpen: boolean;
  activeFilterTab: 'basic' | 'advanced' | 'saved';
  
  // Filter validation
  filterErrors: Record<string, string>;
  
  // Performance settings
  enableRealTimeFiltering: boolean;
  filterDebounceMs: number;
}

const defaultFilters: FlowFilters = {
  sourceIPs: [],
  destinationIPs: [],
  ipRanges: [],
  sourcePorts: [],
  destinationPorts: [],
  protocols: [],
  actions: ['ACCEPT', 'REJECT'],
  vpcIds: [],
  subnetIds: [],
  instanceIds: [],
  accountIds: [],
  regions: [],
  hasAnomalies: false,
  isActive: true
};

const initialState: FilterSliceState = {
  filters: defaultFilters,
  savedFilters: [],
  activeFilterCount: 0,
  lastApplied: new Date(),
  searchResults: [],
  isSearching: false,
  isFilterPanelOpen: false,
  isSearchPanelOpen: false,
  activeFilterTab: 'basic',
  filterErrors: {},
  enableRealTimeFiltering: true,
  filterDebounceMs: 300
};

const filterSlice = createSlice({
  name: 'filter',
  initialState,
  reducers: {
    // Filter management
    updateFilters: (state, action: PayloadAction<Partial<FlowFilters>>) => {
      state.filters = { ...state.filters, ...action.payload };
      state.lastApplied = new Date();
      state.activeFilterCount = calculateActiveFilterCount(state.filters);
      
      // Clear any validation errors for updated fields
      Object.keys(action.payload).forEach(key => {
        delete state.filterErrors[key];
      });
    },
    
    resetFilters: (state) => {
      state.filters = defaultFilters;
      state.lastApplied = new Date();
      state.activeFilterCount = 0;
      state.filterErrors = {};
    },
    
    resetSpecificFilter: (state, action: PayloadAction<keyof FlowFilters>) => {
      const filterKey = action.payload;
      if (filterKey in defaultFilters) {
        (state.filters as any)[filterKey] = (defaultFilters as any)[filterKey];
        state.lastApplied = new Date();
        state.activeFilterCount = calculateActiveFilterCount(state.filters);
        delete state.filterErrors[filterKey];
      }
    },
    
    // IP Range filters
    addIPRangeFilter: (state, action: PayloadAction<IPRangeFilter>) => {
      if (!state.filters.ipRanges) {
        state.filters.ipRanges = [];
      }
      state.filters.ipRanges.push(action.payload);
      state.lastApplied = new Date();
      state.activeFilterCount = calculateActiveFilterCount(state.filters);
    },
    
    removeIPRangeFilter: (state, action: PayloadAction<number>) => {
      if (state.filters.ipRanges) {
        state.filters.ipRanges.splice(action.payload, 1);
        state.lastApplied = new Date();
        state.activeFilterCount = calculateActiveFilterCount(state.filters);
      }
    },
    
    updateIPRangeFilter: (state, action: PayloadAction<{ index: number; filter: IPRangeFilter }>) => {
      if (state.filters.ipRanges && state.filters.ipRanges[action.payload.index]) {
        state.filters.ipRanges[action.payload.index] = action.payload.filter;
        state.lastApplied = new Date();
      }
    },
    
    // Port filters
    addPortFilter: (state, action: PayloadAction<PortFilter>) => {
      if (!state.filters.sourcePorts) {
        state.filters.sourcePorts = [];
      }
      state.filters.sourcePorts.push(action.payload);
      state.lastApplied = new Date();
      state.activeFilterCount = calculateActiveFilterCount(state.filters);
    },
    
    removePortFilter: (state, action: PayloadAction<{ type: 'source' | 'destination'; index: number }>) => {
      const { type, index } = action.payload;
      const filterArray = type === 'source' ? state.filters.sourcePorts : state.filters.destinationPorts;
      if (filterArray) {
        filterArray.splice(index, 1);
        state.lastApplied = new Date();
        state.activeFilterCount = calculateActiveFilterCount(state.filters);
      }
    },
    
    // Time range filters
    setTimeRangeFilter: (state, action: PayloadAction<TimeRangeFilter>) => {
      state.filters.timeRange = action.payload;
      state.lastApplied = new Date();
      state.activeFilterCount = calculateActiveFilterCount(state.filters);
    },
    
    setTimeRangePreset: (state, action: PayloadAction<TimeRangePreset>) => {
      const preset = action.payload;
      const now = new Date();
      let start: Date;
      
      switch (preset) {
        case 'last-hour':
          start = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case 'last-4-hours':
          start = new Date(now.getTime() - 4 * 60 * 60 * 1000);
          break;
        case 'last-24-hours':
          start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'last-7-days':
          start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'last-30-days':
          start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          return; // Don't update for 'custom'
      }
      
      state.filters.timeRange = {
        start,
        end: now,
        preset
      };
      state.lastApplied = new Date();
      state.activeFilterCount = calculateActiveFilterCount(state.filters);
    },
    
    clearTimeRangeFilter: (state) => {
      state.filters.timeRange = undefined;
      state.lastApplied = new Date();
      state.activeFilterCount = calculateActiveFilterCount(state.filters);
    },
    
    // Saved filters
    saveFilter: (state, action: PayloadAction<{ name: string; description?: string; isDefault?: boolean }>) => {
      const { name, description, isDefault } = action.payload;
      
      // If setting as default, clear other defaults
      if (isDefault) {
        state.savedFilters = state.savedFilters.map(f => ({ ...f, isDefault: false }));
      }
      
      const newFilter: SavedFilter = {
        id: Date.now().toString(),
        name,
        description,
        filters: { ...state.filters },
        createdAt: new Date(),
        isDefault
      };
      
      state.savedFilters.push(newFilter);
    },
    
    loadFilter: (state, action: PayloadAction<string>) => {
      const filter = state.savedFilters.find(f => f.id === action.payload);
      if (filter) {
        state.filters = { ...filter.filters };
        state.lastApplied = new Date();
        state.activeFilterCount = calculateActiveFilterCount(state.filters);
        state.filterErrors = {};
        
        // Update last used timestamp
        filter.lastUsed = new Date();
      }
    },
    
    deleteFilter: (state, action: PayloadAction<string>) => {
      state.savedFilters = state.savedFilters.filter(f => f.id !== action.payload);
    },
    
    updateSavedFilter: (state, action: PayloadAction<{ id: string; updates: Partial<SavedFilter> }>) => {
      const { id, updates } = action.payload;
      const filterIndex = state.savedFilters.findIndex(f => f.id === id);
      if (filterIndex >= 0) {
        state.savedFilters[filterIndex] = { ...state.savedFilters[filterIndex], ...updates };
      }
    },
    
    // Search functionality
    setCurrentSearch: (state, action: PayloadAction<SearchQuery>) => {
      state.currentSearch = action.payload;
      state.isSearching = true;
    },
    
    setSearchResults: (state, action: PayloadAction<SearchResult[]>) => {
      state.searchResults = action.payload;
      state.isSearching = false;
    },
    
    clearSearch: (state) => {
      state.currentSearch = undefined;
      state.searchResults = [];
      state.isSearching = false;
    },
    
    // UI state
    setFilterPanelOpen: (state, action: PayloadAction<boolean>) => {
      state.isFilterPanelOpen = action.payload;
    },
    
    setSearchPanelOpen: (state, action: PayloadAction<boolean>) => {
      state.isSearchPanelOpen = action.payload;
    },
    
    setActiveFilterTab: (state, action: PayloadAction<FilterSliceState['activeFilterTab']>) => {
      state.activeFilterTab = action.payload;
    },
    
    // Filter validation
    setFilterError: (state, action: PayloadAction<{ field: string; error: string }>) => {
      state.filterErrors[action.payload.field] = action.payload.error;
    },
    
    clearFilterError: (state, action: PayloadAction<string>) => {
      delete state.filterErrors[action.payload];
    },
    
    clearAllFilterErrors: (state) => {
      state.filterErrors = {};
    },
    
    // Settings
    setEnableRealTimeFiltering: (state, action: PayloadAction<boolean>) => {
      state.enableRealTimeFiltering = action.payload;
    },
    
    setFilterDebounceMs: (state, action: PayloadAction<number>) => {
      state.filterDebounceMs = action.payload;
    },
    
    // Bulk operations
    addMultipleIPs: (state, action: PayloadAction<{ type: 'source' | 'destination'; ips: string[] }>) => {
      const { type, ips } = action.payload;
      const targetArray = type === 'source' ? 'sourceIPs' : 'destinationIPs';
      
      if (!state.filters[targetArray]) {
        state.filters[targetArray] = [];
      }
      
      // Add unique IPs only
      const existingIPs = new Set(state.filters[targetArray]);
      const newIPs = ips.filter(ip => !existingIPs.has(ip));
      
      if (newIPs.length > 0) {
        state.filters[targetArray] = [...(state.filters[targetArray] || []), ...newIPs];
        state.lastApplied = new Date();
        state.activeFilterCount = calculateActiveFilterCount(state.filters);
      }
    },
    
    addMultipleProtocols: (state, action: PayloadAction<string[]>) => {
      const protocols = action.payload;
      if (!state.filters.protocols) {
        state.filters.protocols = [];
      }
      
      // Add unique protocols only
      const existingProtocols = new Set(state.filters.protocols);
      const newProtocols = protocols.filter(protocol => !existingProtocols.has(protocol));
      
      if (newProtocols.length > 0) {
        state.filters.protocols = [...state.filters.protocols, ...newProtocols];
        state.lastApplied = new Date();
        state.activeFilterCount = calculateActiveFilterCount(state.filters);
      }
    },
    
    // Load saved filters from localStorage
    loadSavedFiltersFromStorage: (state, action: PayloadAction<SavedFilter[]>) => {
      state.savedFilters = action.payload;
    }
  }
});

// Helper function to calculate active filter count
function calculateActiveFilterCount(filters: FlowFilters): number {
  let count = 0;
  
  if (filters.sourceIPs?.length) count++;
  if (filters.destinationIPs?.length) count++;
  if (filters.ipRanges?.length) count++;
  if (filters.sourcePorts?.length) count++;
  if (filters.destinationPorts?.length) count++;
  if (filters.protocols?.length) count++;
  if (filters.timeRange) count++;
  if (filters.actions?.length && filters.actions.length < 2) count++;
  if (filters.vpcIds?.length) count++;
  if (filters.subnetIds?.length) count++;
  if (filters.instanceIds?.length) count++;
  if (filters.accountIds?.length) count++;
  if (filters.regions?.length) count++;
  if (filters.minBytes !== undefined || filters.maxBytes !== undefined) count++;
  if (filters.minPackets !== undefined || filters.maxPackets !== undefined) count++;
  if (filters.hasAnomalies) count++;
  if (!filters.isActive) count++;
  
  return count;
}

export const {
  updateFilters,
  resetFilters,
  resetSpecificFilter,
  addIPRangeFilter,
  removeIPRangeFilter,
  updateIPRangeFilter,
  addPortFilter,
  removePortFilter,
  setTimeRangeFilter,
  setTimeRangePreset,
  clearTimeRangeFilter,
  saveFilter,
  loadFilter,
  deleteFilter,
  updateSavedFilter,
  setCurrentSearch,
  setSearchResults,
  clearSearch,
  setFilterPanelOpen,
  setSearchPanelOpen,
  setActiveFilterTab,
  setFilterError,
  clearFilterError,
  clearAllFilterErrors,
  setEnableRealTimeFiltering,
  setFilterDebounceMs,
  addMultipleIPs,
  addMultipleProtocols,
  loadSavedFiltersFromStorage
} = filterSlice.actions;

export default filterSlice.reducer;