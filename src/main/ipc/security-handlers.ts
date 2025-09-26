import { ipcMain } from 'electron';
import { DataAnonymizer } from '../utils/data-anonymizer';
import { NetworkSecurityManager } from '../aws/network-security-manager';

let dataAnonymizer: DataAnonymizer | null = null;
let networkSecurityManager: NetworkSecurityManager | null = null;

/**
 * Initialize security handlers
 */
export function initializeSecurityHandlers(): void {
  // Initialize data anonymizer
  dataAnonymizer = new DataAnonymizer();
  
  // Initialize network security manager
  networkSecurityManager = new NetworkSecurityManager({
    enableCertificatePinning: true,
    enableRequestLogging: true
  });

  // Initialize network security manager
  networkSecurityManager.initialize().catch(console.error);

  // Data anonymization handlers
  ipcMain.handle('anonymize:data', async (event, data: any, options?: any) => {
    try {
      if (!dataAnonymizer) {
        throw new Error('Data anonymizer not initialized');
      }

      const result = dataAnonymizer.anonymizeData(data);
      return result.anonymizedData;
    } catch (error) {
      console.error('Failed to anonymize data:', error);
      throw error;
    }
  });

  ipcMain.handle('anonymize:flow-logs', async (event, flowLogs: any[], options?: any) => {
    try {
      if (!dataAnonymizer) {
        throw new Error('Data anonymizer not initialized');
      }

      // Create new anonymizer with provided options
      const anonymizer = new DataAnonymizer(options);
      return anonymizer.anonymizeFlowLogs(flowLogs);
    } catch (error) {
      console.error('Failed to anonymize flow logs:', error);
      throw error;
    }
  });

  ipcMain.handle('anonymize:topology', async (event, topology: any, options?: any) => {
    try {
      if (!dataAnonymizer) {
        throw new Error('Data anonymizer not initialized');
      }

      // Create new anonymizer with provided options
      const anonymizer = new DataAnonymizer(options);
      return anonymizer.anonymizeNetworkTopology(topology);
    } catch (error) {
      console.error('Failed to anonymize topology:', error);
      throw error;
    }
  });

  // Network security handlers
  ipcMain.handle('network-security:get-request-logs', async (event, options?: any) => {
    try {
      if (!networkSecurityManager) {
        throw new Error('Network security manager not initialized');
      }

      return networkSecurityManager.getNetworkRequestLogs(options);
    } catch (error) {
      console.error('Failed to get network request logs:', error);
      throw error;
    }
  });

  ipcMain.handle('network-security:clear-request-logs', async (event) => {
    try {
      if (!networkSecurityManager) {
        throw new Error('Network security manager not initialized');
      }

      await networkSecurityManager.clearNetworkLogs();
    } catch (error) {
      console.error('Failed to clear network request logs:', error);
      throw error;
    }
  });

  ipcMain.handle('network-security:export-request-logs', async (event, format: 'json' | 'csv') => {
    try {
      if (!networkSecurityManager) {
        throw new Error('Network security manager not initialized');
      }

      return await networkSecurityManager.exportNetworkLogs(format);
    } catch (error) {
      console.error('Failed to export network request logs:', error);
      throw error;
    }
  });

  ipcMain.handle('network-security:get-certificate-pins', async (event) => {
    try {
      if (!networkSecurityManager) {
        throw new Error('Network security manager not initialized');
      }

      return networkSecurityManager.getCertificatePins();
    } catch (error) {
      console.error('Failed to get certificate pins:', error);
      throw error;
    }
  });

  ipcMain.handle('network-security:add-certificate-pin', async (event, config: any) => {
    try {
      if (!networkSecurityManager) {
        throw new Error('Network security manager not initialized');
      }

      networkSecurityManager.addCertificatePin(config);
    } catch (error) {
      console.error('Failed to add certificate pin:', error);
      throw error;
    }
  });

  ipcMain.handle('network-security:remove-certificate-pin', async (event, hostname: string) => {
    try {
      if (!networkSecurityManager) {
        throw new Error('Network security manager not initialized');
      }

      networkSecurityManager.removeCertificatePin(hostname);
    } catch (error) {
      console.error('Failed to remove certificate pin:', error);
      throw error;
    }
  });
}

/**
 * Get network security manager instance
 */
export function getNetworkSecurityManager(): NetworkSecurityManager | null {
  return networkSecurityManager;
}

/**
 * Get data anonymizer instance
 */
export function getDataAnonymizer(): DataAnonymizer | null {
  return dataAnonymizer;
}

/**
 * Cleanup security handlers
 */
export function cleanupSecurityHandlers(): void {
  if (networkSecurityManager) {
    networkSecurityManager.performSecureCleanup?.().catch(console.error);
  }
  
  if (dataAnonymizer) {
    dataAnonymizer.clearMappings();
  }
}