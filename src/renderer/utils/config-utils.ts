import { FlowFilters, SavedFilter } from '@shared/types';

export interface SavedConfiguration {
  id: string;
  name: string;
  description?: string;
  filters: FlowFilters;
  queryParameters: QueryParameters;
  visualizationSettings: VisualizationSettings;
  createdAt: Date;
  lastUsed?: Date;
  isDefault?: boolean;
  tags?: string[];
}

export interface QueryParameters {
  timeRange?: {
    start: Date;
    end: Date;
    preset?: string;
  };
  regions?: string[];
  logGroups?: string[];
  maxResults?: number;
  queryTimeout?: number;
}

export interface VisualizationSettings {
  layoutAlgorithm?: 'cose' | 'dagre' | 'grid' | 'circle' | 'breadthfirst';
  showAnimations?: boolean;
  nodeSize?: 'traffic' | 'connections' | 'fixed';
  edgeWidth?: 'traffic' | 'connections' | 'fixed';
  colorScheme?: 'default' | 'traffic' | 'security' | 'performance';
  showLabels?: boolean;
  showLegend?: boolean;
  backgroundColor?: string;
}

export interface ConfigurationValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const STORAGE_KEY = 'aws-network-visualizer-configs';
const MAX_CONFIGURATIONS = 50;

/**
 * Save configuration to local storage
 */
export function saveConfiguration(config: Omit<SavedConfiguration, 'id' | 'createdAt'>): SavedConfiguration {
  const configurations = loadConfigurations();
  
  const newConfig: SavedConfiguration = {
    ...config,
    id: generateConfigId(),
    createdAt: new Date()
  };

  // Validate configuration
  const validation = validateConfiguration(newConfig);
  if (!validation.valid) {
    throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
  }

  // Check for duplicate names
  const existingNames = configurations.map(c => c.name.toLowerCase());
  if (existingNames.includes(newConfig.name.toLowerCase())) {
    throw new Error(`Configuration with name "${newConfig.name}" already exists`);
  }

  // Add new configuration
  configurations.push(newConfig);

  // Limit number of configurations
  if (configurations.length > MAX_CONFIGURATIONS) {
    // Remove oldest non-default configurations
    const sortedConfigs = configurations
      .filter(c => !c.isDefault)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    
    const toRemove = configurations.length - MAX_CONFIGURATIONS;
    for (let i = 0; i < toRemove && i < sortedConfigs.length; i++) {
      const index = configurations.findIndex(c => c.id === sortedConfigs[i].id);
      if (index !== -1) {
        configurations.splice(index, 1);
      }
    }
  }

  // Save to storage
  saveConfigurationsToStorage(configurations);
  
  return newConfig;
}

/**
 * Load all configurations from local storage
 */
export function loadConfigurations(): SavedConfiguration[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    
    // Convert date strings back to Date objects
    return parsed.map((config: any) => ({
      ...config,
      createdAt: new Date(config.createdAt),
      lastUsed: config.lastUsed ? new Date(config.lastUsed) : undefined,
      filters: {
        ...config.filters,
        timeRange: config.filters.timeRange ? {
          ...config.filters.timeRange,
          start: new Date(config.filters.timeRange.start),
          end: new Date(config.filters.timeRange.end)
        } : undefined
      },
      queryParameters: {
        ...config.queryParameters,
        timeRange: config.queryParameters.timeRange ? {
          ...config.queryParameters.timeRange,
          start: new Date(config.queryParameters.timeRange.start),
          end: new Date(config.queryParameters.timeRange.end)
        } : undefined
      }
    }));
  } catch (error) {
    console.error('Failed to load configurations:', error);
    return [];
  }
}

/**
 * Load specific configuration by ID
 */
export function loadConfiguration(id: string): SavedConfiguration | null {
  const configurations = loadConfigurations();
  const config = configurations.find(c => c.id === id);
  
  if (config) {
    // Update last used timestamp
    config.lastUsed = new Date();
    updateConfiguration(config);
  }
  
  return config || null;
}

/**
 * Update existing configuration
 */
export function updateConfiguration(config: SavedConfiguration): void {
  const configurations = loadConfigurations();
  const index = configurations.findIndex(c => c.id === config.id);
  
  if (index === -1) {
    throw new Error(`Configuration with ID "${config.id}" not found`);
  }

  // Validate configuration
  const validation = validateConfiguration(config);
  if (!validation.valid) {
    throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
  }

  configurations[index] = config;
  saveConfigurationsToStorage(configurations);
}

/**
 * Delete configuration by ID
 */
export function deleteConfiguration(id: string): void {
  const configurations = loadConfigurations();
  const index = configurations.findIndex(c => c.id === id);
  
  if (index === -1) {
    throw new Error(`Configuration with ID "${id}" not found`);
  }

  const config = configurations[index];
  if (config.isDefault) {
    throw new Error('Cannot delete default configuration');
  }

  configurations.splice(index, 1);
  saveConfigurationsToStorage(configurations);
}

/**
 * Duplicate configuration with new name
 */
export function duplicateConfiguration(id: string, newName: string): SavedConfiguration {
  const original = loadConfiguration(id);
  if (!original) {
    throw new Error(`Configuration with ID "${id}" not found`);
  }

  const duplicate = {
    ...original,
    name: newName,
    description: `Copy of ${original.name}`,
    isDefault: false
  };

  delete (duplicate as any).id;
  delete (duplicate as any).createdAt;
  delete (duplicate as any).lastUsed;

  return saveConfiguration(duplicate);
}

/**
 * Export configuration as JSON
 */
export function exportConfiguration(id: string): string {
  const config = loadConfiguration(id);
  if (!config) {
    throw new Error(`Configuration with ID "${id}" not found`);
  }

  return JSON.stringify(config, null, 2);
}

/**
 * Import configuration from JSON
 */
export function importConfiguration(jsonString: string, newName?: string): SavedConfiguration {
  try {
    const config = JSON.parse(jsonString);
    
    // Validate structure
    if (!config.name || !config.filters) {
      throw new Error('Invalid configuration format');
    }

    // Convert date strings to Date objects
    const importedConfig = {
      ...config,
      name: newName || `${config.name} (Imported)`,
      createdAt: config.createdAt ? new Date(config.createdAt) : undefined,
      lastUsed: config.lastUsed ? new Date(config.lastUsed) : undefined,
      isDefault: false, // Imported configs are never default
      filters: {
        ...config.filters,
        timeRange: config.filters.timeRange ? {
          ...config.filters.timeRange,
          start: new Date(config.filters.timeRange.start),
          end: new Date(config.filters.timeRange.end)
        } : undefined
      },
      queryParameters: config.queryParameters ? {
        ...config.queryParameters,
        timeRange: config.queryParameters.timeRange ? {
          ...config.queryParameters.timeRange,
          start: new Date(config.queryParameters.timeRange.start),
          end: new Date(config.queryParameters.timeRange.end)
        } : undefined
      } : {}
    };

    // Remove ID to force creation of new config
    delete importedConfig.id;
    delete importedConfig.createdAt;
    delete importedConfig.lastUsed;

    return saveConfiguration(importedConfig);
  } catch (error) {
    throw new Error(`Failed to import configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get default configuration
 */
export function getDefaultConfiguration(): SavedConfiguration | null {
  const configurations = loadConfigurations();
  return configurations.find(c => c.isDefault) || null;
}

/**
 * Set configuration as default
 */
export function setDefaultConfiguration(id: string): void {
  const configurations = loadConfigurations();
  
  // Remove default flag from all configurations
  configurations.forEach(c => c.isDefault = false);
  
  // Set new default
  const config = configurations.find(c => c.id === id);
  if (!config) {
    throw new Error(`Configuration with ID "${id}" not found`);
  }
  
  config.isDefault = true;
  saveConfigurationsToStorage(configurations);
}

/**
 * Search configurations by name or tags
 */
export function searchConfigurations(query: string): SavedConfiguration[] {
  const configurations = loadConfigurations();
  const lowerQuery = query.toLowerCase();
  
  return configurations.filter(config => 
    config.name.toLowerCase().includes(lowerQuery) ||
    config.description?.toLowerCase().includes(lowerQuery) ||
    config.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Get configurations sorted by usage
 */
export function getRecentConfigurations(limit = 10): SavedConfiguration[] {
  const configurations = loadConfigurations();
  
  return configurations
    .filter(c => c.lastUsed)
    .sort((a, b) => (b.lastUsed?.getTime() || 0) - (a.lastUsed?.getTime() || 0))
    .slice(0, limit);
}

/**
 * Validate configuration structure and content
 */
export function validateConfiguration(config: SavedConfiguration): ConfigurationValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!config.name || config.name.trim().length === 0) {
    errors.push('Configuration name is required');
  }

  if (config.name && config.name.length > 100) {
    errors.push('Configuration name must be less than 100 characters');
  }

  if (!config.filters) {
    errors.push('Filters are required');
  }

  // Validate filters
  if (config.filters) {
    if (config.filters.timeRange) {
      const { start, end } = config.filters.timeRange;
      if (start >= end) {
        errors.push('Time range start must be before end');
      }
    }

    if (config.filters.minBytes !== undefined && config.filters.maxBytes !== undefined) {
      if (config.filters.minBytes > config.filters.maxBytes) {
        errors.push('Minimum bytes must be less than maximum bytes');
      }
    }

    if (config.filters.minPackets !== undefined && config.filters.maxPackets !== undefined) {
      if (config.filters.minPackets > config.filters.maxPackets) {
        errors.push('Minimum packets must be less than maximum packets');
      }
    }
  }

  // Validate query parameters
  if (config.queryParameters) {
    if (config.queryParameters.maxResults !== undefined && config.queryParameters.maxResults <= 0) {
      errors.push('Max results must be greater than 0');
    }

    if (config.queryParameters.queryTimeout !== undefined && config.queryParameters.queryTimeout <= 0) {
      errors.push('Query timeout must be greater than 0');
    }
  }

  // Warnings
  if (config.description && config.description.length > 500) {
    warnings.push('Description is very long and may be truncated in some views');
  }

  if (config.tags && config.tags.length > 10) {
    warnings.push('Too many tags may affect performance');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Create configuration from current application state
 */
export function createConfigurationFromState(
  name: string,
  description: string,
  filters: FlowFilters,
  queryParams: QueryParameters,
  visualSettings: VisualizationSettings,
  tags: string[] = []
): SavedConfiguration {
  return saveConfiguration({
    name,
    description,
    filters,
    queryParameters: queryParams,
    visualizationSettings: visualSettings,
    tags
  });
}

// Private helper functions

function generateConfigId(): string {
  return `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function saveConfigurationsToStorage(configurations: SavedConfiguration[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configurations));
  } catch (error) {
    console.error('Failed to save configurations:', error);
    throw new Error('Failed to save configuration to storage');
  }
}

/**
 * Clear all configurations (use with caution)
 */
export function clearAllConfigurations(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Get storage usage statistics
 */
export function getStorageStats(): {
  configCount: number;
  storageSize: number;
  maxSize: number;
  usagePercentage: number;
} {
  const configurations = loadConfigurations();
  const stored = localStorage.getItem(STORAGE_KEY) || '';
  const storageSize = new Blob([stored]).size;
  const maxSize = 5 * 1024 * 1024; // 5MB typical localStorage limit
  
  return {
    configCount: configurations.length,
    storageSize,
    maxSize,
    usagePercentage: (storageSize / maxSize) * 100
  };
}