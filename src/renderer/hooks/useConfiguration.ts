import { useState, useCallback, useEffect } from 'react';
import { FlowFilters } from '@shared/types';
import {
  SavedConfiguration,
  QueryParameters,
  VisualizationSettings,
  saveConfiguration,
  loadConfiguration,
  loadConfigurations,
  getDefaultConfiguration,
  createConfigurationFromState,
  validateConfiguration
} from '../utils/config-utils';

interface UseConfigurationOptions {
  autoLoadDefault?: boolean;
  onConfigurationChange?: (config: SavedConfiguration | null) => void;
}

interface UseConfigurationReturn {
  currentConfiguration: SavedConfiguration | null;
  availableConfigurations: SavedConfiguration[];
  isLoading: boolean;
  error: string | null;
  
  // Configuration management
  saveCurrentConfiguration: (
    name: string,
    description: string,
    filters: FlowFilters,
    queryParams: QueryParameters,
    visualSettings: VisualizationSettings,
    tags?: string[]
  ) => Promise<SavedConfiguration>;
  
  loadConfigurationById: (id: string) => Promise<SavedConfiguration | null>;
  applyConfiguration: (config: SavedConfiguration) => void;
  clearCurrentConfiguration: () => void;
  
  // State management
  refreshConfigurations: () => void;
  clearError: () => void;
  
  // Validation
  validateCurrentState: (
    filters: FlowFilters,
    queryParams: QueryParameters,
    visualSettings: VisualizationSettings
  ) => { valid: boolean; errors: string[]; warnings: string[] };
}

export function useConfiguration({
  autoLoadDefault = false,
  onConfigurationChange
}: UseConfigurationOptions = {}): UseConfigurationReturn {
  const [currentConfiguration, setCurrentConfiguration] = useState<SavedConfiguration | null>(null);
  const [availableConfigurations, setAvailableConfigurations] = useState<SavedConfiguration[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load configurations on mount
  useEffect(() => {
    refreshConfigurations();
    
    if (autoLoadDefault) {
      loadDefaultConfiguration();
    }
  }, [autoLoadDefault]);

  // Notify when configuration changes
  useEffect(() => {
    onConfigurationChange?.(currentConfiguration);
  }, [currentConfiguration, onConfigurationChange]);

  const refreshConfigurations = useCallback(() => {
    try {
      const configs = loadConfigurations();
      setAvailableConfigurations(configs);
    } catch (err) {
      setError('Failed to load configurations');
      console.error('Failed to load configurations:', err);
    }
  }, []);

  const loadDefaultConfiguration = useCallback(async () => {
    setIsLoading(true);
    try {
      const defaultConfig = getDefaultConfiguration();
      if (defaultConfig) {
        setCurrentConfiguration(defaultConfig);
      }
    } catch (err) {
      setError('Failed to load default configuration');
      console.error('Failed to load default configuration:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveCurrentConfiguration = useCallback(async (
    name: string,
    description: string,
    filters: FlowFilters,
    queryParams: QueryParameters,
    visualSettings: VisualizationSettings,
    tags: string[] = []
  ): Promise<SavedConfiguration> => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Validate inputs
      if (!name.trim()) {
        throw new Error('Configuration name is required');
      }

      // Create and save configuration
      const config = createConfigurationFromState(
        name.trim(),
        description.trim(),
        filters,
        queryParams,
        visualSettings,
        tags
      );

      // Update state
      setCurrentConfiguration(config);
      refreshConfigurations();
      
      return config;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save configuration';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [refreshConfigurations]);

  const loadConfigurationById = useCallback(async (id: string): Promise<SavedConfiguration | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const config = loadConfiguration(id);
      if (config) {
        setCurrentConfiguration(config);
        refreshConfigurations(); // Refresh to update last used timestamp
      }
      return config;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load configuration';
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [refreshConfigurations]);

  const applyConfiguration = useCallback((config: SavedConfiguration) => {
    try {
      // Validate configuration before applying
      const validation = validateConfiguration(config);
      if (!validation.valid) {
        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
      }

      setCurrentConfiguration(config);
      
      // Update last used timestamp
      const updatedConfig = {
        ...config,
        lastUsed: new Date()
      };
      
      // Save updated timestamp (async, don't wait)
      setTimeout(() => {
        try {
          saveConfiguration(updatedConfig);
          refreshConfigurations();
        } catch (err) {
          console.warn('Failed to update last used timestamp:', err);
        }
      }, 0);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to apply configuration';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [refreshConfigurations]);

  const clearCurrentConfiguration = useCallback(() => {
    setCurrentConfiguration(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const validateCurrentState = useCallback((
    filters: FlowFilters,
    queryParams: QueryParameters,
    visualSettings: VisualizationSettings
  ) => {
    try {
      // Create a temporary configuration for validation
      const tempConfig: SavedConfiguration = {
        id: 'temp',
        name: 'Temporary',
        filters,
        queryParameters: queryParams,
        visualizationSettings: visualSettings,
        createdAt: new Date()
      };

      return validateConfiguration(tempConfig);
    } catch (err) {
      return {
        valid: false,
        errors: ['Failed to validate configuration'],
        warnings: []
      };
    }
  }, []);

  return {
    currentConfiguration,
    availableConfigurations,
    isLoading,
    error,
    saveCurrentConfiguration,
    loadConfigurationById,
    applyConfiguration,
    clearCurrentConfiguration,
    refreshConfigurations,
    clearError,
    validateCurrentState
  };
}

/**
 * Hook for managing configuration presets
 */
export function useConfigurationPresets() {
  const createNetworkTroubleshootingPreset = useCallback((): Partial<SavedConfiguration> => ({
    name: 'Network Troubleshooting',
    description: 'Optimized for identifying network connectivity issues',
    filters: {
      actions: ['REJECT'],
      minPackets: 1
    },
    visualizationSettings: {
      layoutAlgorithm: 'dagre',
      colorScheme: 'security',
      showAnimations: false,
      nodeSize: 'connections',
      edgeWidth: 'traffic'
    },
    tags: ['troubleshooting', 'security', 'network']
  }), []);

  const createSecurityAnalysisPreset = useCallback((): Partial<SavedConfiguration> => ({
    name: 'Security Analysis',
    description: 'Focused on security events and anomalies',
    filters: {
      actions: ['REJECT'],
      hasAnomalies: true
    },
    visualizationSettings: {
      layoutAlgorithm: 'cose',
      colorScheme: 'security',
      showAnimations: true,
      nodeSize: 'traffic',
      edgeWidth: 'traffic'
    },
    tags: ['security', 'analysis', 'anomalies']
  }), []);

  const createPerformanceMonitoringPreset = useCallback((): Partial<SavedConfiguration> => ({
    name: 'Performance Monitoring',
    description: 'Optimized for monitoring traffic patterns and performance',
    filters: {
      actions: ['ACCEPT'],
      minBytes: 1000
    },
    visualizationSettings: {
      layoutAlgorithm: 'cose',
      colorScheme: 'performance',
      showAnimations: true,
      nodeSize: 'traffic',
      edgeWidth: 'traffic'
    },
    tags: ['performance', 'monitoring', 'traffic']
  }), []);

  const createComplianceAuditPreset = useCallback((): Partial<SavedConfiguration> => ({
    name: 'Compliance Audit',
    description: 'Comprehensive view for compliance and audit purposes',
    filters: {},
    visualizationSettings: {
      layoutAlgorithm: 'dagre',
      colorScheme: 'default',
      showAnimations: false,
      nodeSize: 'fixed',
      edgeWidth: 'fixed',
      showLabels: true,
      showLegend: true
    },
    tags: ['compliance', 'audit', 'comprehensive']
  }), []);

  return {
    createNetworkTroubleshootingPreset,
    createSecurityAnalysisPreset,
    createPerformanceMonitoringPreset,
    createComplianceAuditPreset
  };
}