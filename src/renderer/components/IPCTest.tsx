import React, { useState, useEffect } from 'react';

interface IPCTestProps {
  onClose: () => void;
}

export const IPCTest: React.FC<IPCTestProps> = ({ onClose }) => {
  const [results, setResults] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const testAPI = async (name: string, apiCall: () => Promise<any>) => {
    setLoading(prev => ({ ...prev, [name]: true }));
    try {
      const result = await apiCall();
      setResults(prev => ({ ...prev, [name]: { success: true, data: result } }));
    } catch (error) {
      setResults(prev => ({ 
        ...prev, 
        [name]: { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        } 
      }));
    } finally {
      setLoading(prev => ({ ...prev, [name]: false }));
    }
  };

  const runTests = async () => {
    // Test basic IPC
    await testAPI('getAppVersion', () => window.electronAPI.getAppVersion());
    
    // Test AWS profile APIs
    await testAPI('getProfiles', () => window.electronAPI.aws.getProfiles());
    await testAPI('hasConfig', () => window.electronAPI.aws.hasConfig());
    await testAPI('getRegions', () => window.electronAPI.aws.getRegions());
    
    // Test connection status
    await testAPI('testConnection', () => window.electronAPI.aws.testConnection());
    
    // Test SSO status
    await testAPI('ssoStatus', () => window.electronAPI.sso.getStatus());
    
    // Test network security
    await testAPI('getCertificatePins', () => window.electronAPI.networkSecurity.getCertificatePins());
  };

  useEffect(() => {
    runTests();
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[80vh] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">IPC Communication Test</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        
        <div className="space-y-4">
          {Object.entries(results).map(([name, result]) => (
            <div key={name} className="border rounded p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium">{name}</span>
                {loading[name] && <span className="text-blue-500">Loading...</span>}
                {!loading[name] && (
                  <span className={`px-2 py-1 rounded text-xs ${
                    result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {result.success ? 'SUCCESS' : 'ERROR'}
                  </span>
                )}
              </div>
              
              <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-32">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          ))}
        </div>
        
        <div className="mt-4 flex gap-2">
          <button
            onClick={runTests}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Run Tests Again
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};