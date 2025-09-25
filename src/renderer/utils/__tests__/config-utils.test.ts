import {
  saveConfiguration,
  loadConfigurations,
  loadConfiguration,
  updateConfiguration,
  deleteConfiguration,
  duplicateConfiguration,
  exportConfiguration,
  importConfiguration,
  validateConfiguration,
  clearAllConfigurations
} from '../config-utils';
import { SavedConfiguration } from '../config-utils';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

const mockConfiguration: Omit<SavedConfiguration, 'id' | 'createdAt'> = {
  name: 'Test Configuration',
  description: 'A test configuration',
  filters: {
    sourceIPs: ['10.0.1.100'],
    protocols: ['TCP']
  },
  queryParameters: {
    maxResults: 1000
  },
  visualizationSettings: {
    layoutAlgorithm: 'cose',
    showAnimations: true
  },
  tags: ['test', 'example']
};

describe('Configuration Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    clearAllConfigurations();
  });

  describe('saveConfiguration', () => {
    it('should save a new configuration', () => {
      localStorageMock.getItem.mockReturnValue('[]');

      const saved = saveConfiguration(mockConfiguration);

      expect(saved).toMatchObject({
        name: 'Test Configuration',
        description: 'A test configuration'
      });
      expect(saved.id).toBeDefined();
      expect(saved.createdAt).toBeInstanceOf(Date);
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('should throw error for duplicate names', () => {
      const existingConfigs = [
        {
          id: 'existing',
          name: 'Test Configuration',
          createdAt: new Date(),
          filters: {},
          queryParameters: {},
          visualizationSettings: {}
        }
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(existingConfigs));

      expect(() => saveConfiguration(mockConfiguration)).toThrow(
        'Configuration with name "Test Configuration" already exists'
      );
    });

    it('should validate configuration before saving', () => {
      localStorageMock.getItem.mockReturnValue('[]');

      const invalidConfig = {
        ...mockConfiguration,
        name: '' // Invalid empty name
      };

      expect(() => saveConfiguration(invalidConfig)).toThrow('Invalid configuration');
    });
  });

  describe('loadConfigurations', () => {
    it('should load configurations from localStorage', () => {
      const configs = [
        {
          id: 'test1',
          name: 'Config 1',
          createdAt: '2024-01-01T00:00:00.000Z',
          filters: {},
          queryParameters: {},
          visualizationSettings: {}
        }
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(configs));

      const loaded = loadConfigurations();

      expect(loaded).toHaveLength(1);
      expect(loaded[0].name).toBe('Config 1');
      expect(loaded[0].createdAt).toBeInstanceOf(Date);
    });

    it('should return empty array if no configurations exist', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const loaded = loadConfigurations();

      expect(loaded).toEqual([]);
    });

    it('should handle corrupted localStorage data', () => {
      localStorageMock.getItem.mockReturnValue('invalid json');

      const loaded = loadConfigurations();

      expect(loaded).toEqual([]);
    });
  });

  describe('loadConfiguration', () => {
    it('should load specific configuration by ID', () => {
      const configs = [
        {
          id: 'test1',
          name: 'Config 1',
          createdAt: '2024-01-01T00:00:00.000Z',
          filters: {},
          queryParameters: {},
          visualizationSettings: {}
        }
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(configs));

      const loaded = loadConfiguration('test1');

      expect(loaded).toBeTruthy();
      expect(loaded?.name).toBe('Config 1');
      expect(loaded?.lastUsed).toBeInstanceOf(Date);
    });

    it('should return null for non-existent ID', () => {
      localStorageMock.getItem.mockReturnValue('[]');

      const loaded = loadConfiguration('nonexistent');

      expect(loaded).toBeNull();
    });
  });

  describe('updateConfiguration', () => {
    it('should update existing configuration', () => {
      const configs = [
        {
          id: 'test1',
          name: 'Config 1',
          createdAt: '2024-01-01T00:00:00.000Z',
          filters: {},
          queryParameters: {},
          visualizationSettings: {}
        }
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(configs));

      const updatedConfig: SavedConfiguration = {
        id: 'test1',
        name: 'Updated Config',
        description: 'Updated description',
        createdAt: new Date('2024-01-01'),
        filters: {},
        queryParameters: {},
        visualizationSettings: {}
      };

      updateConfiguration(updatedConfig);

      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('should throw error for non-existent configuration', () => {
      localStorageMock.getItem.mockReturnValue('[]');

      const config: SavedConfiguration = {
        id: 'nonexistent',
        name: 'Config',
        createdAt: new Date(),
        filters: {},
        queryParameters: {},
        visualizationSettings: {}
      };

      expect(() => updateConfiguration(config)).toThrow(
        'Configuration with ID "nonexistent" not found'
      );
    });
  });

  describe('deleteConfiguration', () => {
    it('should delete configuration by ID', () => {
      const configs = [
        {
          id: 'test1',
          name: 'Config 1',
          createdAt: '2024-01-01T00:00:00.000Z',
          filters: {},
          queryParameters: {},
          visualizationSettings: {}
        }
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(configs));

      deleteConfiguration('test1');

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        expect.any(String),
        JSON.stringify([])
      );
    });

    it('should not delete default configuration', () => {
      const configs = [
        {
          id: 'test1',
          name: 'Config 1',
          createdAt: '2024-01-01T00:00:00.000Z',
          isDefault: true,
          filters: {},
          queryParameters: {},
          visualizationSettings: {}
        }
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(configs));

      expect(() => deleteConfiguration('test1')).toThrow(
        'Cannot delete default configuration'
      );
    });

    it('should throw error for non-existent configuration', () => {
      localStorageMock.getItem.mockReturnValue('[]');

      expect(() => deleteConfiguration('nonexistent')).toThrow(
        'Configuration with ID "nonexistent" not found'
      );
    });
  });

  describe('duplicateConfiguration', () => {
    it('should duplicate existing configuration', () => {
      const configs = [
        {
          id: 'test1',
          name: 'Original Config',
          createdAt: '2024-01-01T00:00:00.000Z',
          filters: { sourceIPs: ['10.0.1.1'] },
          queryParameters: {},
          visualizationSettings: {}
        }
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(configs));

      const duplicated = duplicateConfiguration('test1', 'Duplicated Config');

      expect(duplicated.name).toBe('Duplicated Config');
      expect(duplicated.description).toBe('Copy of Original Config');
      expect(duplicated.filters).toEqual({ sourceIPs: ['10.0.1.1'] });
      expect(duplicated.isDefault).toBe(false);
    });

    it('should throw error for non-existent configuration', () => {
      localStorageMock.getItem.mockReturnValue('[]');

      expect(() => duplicateConfiguration('nonexistent', 'New Name')).toThrow(
        'Configuration with ID "nonexistent" not found'
      );
    });
  });

  describe('exportConfiguration', () => {
    it('should export configuration as JSON', () => {
      const configs = [
        {
          id: 'test1',
          name: 'Config 1',
          createdAt: '2024-01-01T00:00:00.000Z',
          filters: {},
          queryParameters: {},
          visualizationSettings: {}
        }
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(configs));

      const exported = exportConfiguration('test1');

      expect(exported).toBeTruthy();
      const parsed = JSON.parse(exported);
      expect(parsed.name).toBe('Config 1');
    });

    it('should throw error for non-existent configuration', () => {
      localStorageMock.getItem.mockReturnValue('[]');

      expect(() => exportConfiguration('nonexistent')).toThrow(
        'Configuration with ID "nonexistent" not found'
      );
    });
  });

  describe('importConfiguration', () => {
    it('should import configuration from JSON', () => {
      localStorageMock.getItem.mockReturnValue('[]');

      const configData = {
        name: 'Imported Config',
        filters: { sourceIPs: ['10.0.1.1'] },
        queryParameters: {},
        visualizationSettings: {}
      };

      const imported = importConfiguration(JSON.stringify(configData));

      expect(imported.name).toBe('Imported Config (Imported)');
      expect(imported.filters).toEqual({ sourceIPs: ['10.0.1.1'] });
      expect(imported.isDefault).toBe(false);
    });

    it('should use custom name when provided', () => {
      localStorageMock.getItem.mockReturnValue('[]');

      const configData = {
        name: 'Original Name',
        filters: {},
        queryParameters: {},
        visualizationSettings: {}
      };

      const imported = importConfiguration(JSON.stringify(configData), 'Custom Name');

      expect(imported.name).toBe('Custom Name');
    });

    it('should throw error for invalid JSON', () => {
      expect(() => importConfiguration('invalid json')).toThrow(
        'Failed to import configuration'
      );
    });

    it('should throw error for invalid configuration structure', () => {
      const invalidConfig = { invalidField: 'value' };

      expect(() => importConfiguration(JSON.stringify(invalidConfig))).toThrow(
        'Failed to import configuration'
      );
    });
  });

  describe('validateConfiguration', () => {
    it('should validate valid configuration', () => {
      const validConfig: SavedConfiguration = {
        id: 'test',
        name: 'Valid Config',
        createdAt: new Date(),
        filters: {
          timeRange: {
            start: new Date('2024-01-01'),
            end: new Date('2024-01-02')
          }
        },
        queryParameters: {
          maxResults: 1000
        },
        visualizationSettings: {}
      };

      const result = validateConfiguration(validConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject configuration with empty name', () => {
      const invalidConfig: SavedConfiguration = {
        id: 'test',
        name: '',
        createdAt: new Date(),
        filters: {},
        queryParameters: {},
        visualizationSettings: {}
      };

      const result = validateConfiguration(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Configuration name is required');
    });

    it('should reject configuration with invalid time range', () => {
      const invalidConfig: SavedConfiguration = {
        id: 'test',
        name: 'Test Config',
        createdAt: new Date(),
        filters: {
          timeRange: {
            start: new Date('2024-01-02'),
            end: new Date('2024-01-01') // End before start
          }
        },
        queryParameters: {},
        visualizationSettings: {}
      };

      const result = validateConfiguration(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Time range start must be before end');
    });

    it('should reject configuration with invalid byte range', () => {
      const invalidConfig: SavedConfiguration = {
        id: 'test',
        name: 'Test Config',
        createdAt: new Date(),
        filters: {
          minBytes: 1000,
          maxBytes: 500 // Max less than min
        },
        queryParameters: {},
        visualizationSettings: {}
      };

      const result = validateConfiguration(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Minimum bytes must be less than maximum bytes');
    });

    it('should provide warnings for potential issues', () => {
      const configWithWarnings: SavedConfiguration = {
        id: 'test',
        name: 'Test Config',
        description: 'A'.repeat(600), // Very long description
        createdAt: new Date(),
        filters: {},
        queryParameters: {},
        visualizationSettings: {},
        tags: Array(15).fill('tag') // Too many tags
      };

      const result = validateConfiguration(configWithWarnings);

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});