import React, { useState } from 'react';

export const DebugPanel: React.FC = () => {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testAppVersion = async () => {
    try {
      const version = await window.electronAPI.getAppVersion();
      addResult(`✅ App version: ${version}`);
    } catch (error) {
      addResult(`❌ App version failed: ${error}`);
    }
  };

  const testAWSConfig = async () => {
    try {
      const hasConfig = await window.electronAPI.aws.hasConfig();
      addResult(`✅ AWS config check: ${hasConfig}`);
    } catch (error) {
      addResult(`❌ AWS config failed: ${error}`);
    }
  };

  const testSSOInitialize = async () => {
    try {
      await window.electronAPI.sso.initialize();
      addResult(`✅ SSO initialize: success`);
    } catch (error) {
      addResult(`❌ SSO initialize failed: ${error}`);
    }
  };

  const testAWSProfiles = async () => {
    try {
      const profiles = await window.electronAPI.aws.getProfiles();
      addResult(`✅ AWS profiles: ${profiles.length} found`);
    } catch (error) {
      addResult(`❌ AWS profiles failed: ${error}`);
    }
  };

  const runIntegrationTests = async () => {
    try {
      addResult(`🔄 Running AWS integration tests...`);
      const result = await window.electronAPI.aws.runIntegrationTests(false);
      if (result.success) {
        const passed = result.results?.filter(r => r.success).length || 0;
        const total = result.results?.length || 0;
        addResult(`✅ Integration tests: ${passed}/${total} passed`);
      } else {
        addResult(`❌ Integration tests failed: ${result.error}`);
      }
    } catch (error) {
      addResult(`❌ Integration tests error: ${error}`);
    }
  };

  const runRealCredentialTests = async () => {
    try {
      addResult(`🔄 Running real credential tests...`);
      const result = await window.electronAPI.aws.runIntegrationTests(true);
      if (result.success) {
        const passed = result.results?.filter(r => r.success).length || 0;
        const total = result.results?.length || 0;
        addResult(`✅ Real credential tests: ${passed}/${total} passed`);
        if (result.report) {
          console.log('Integration Test Report:', result.report);
        }
      } else {
        addResult(`❌ Real credential tests failed: ${result.error}`);
      }
    } catch (error) {
      addResult(`❌ Real credential tests error: ${error}`);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        style={{
          position: 'fixed',
          bottom: '10px',
          right: '10px',
          padding: '8px 12px',
          backgroundColor: '#007acc',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px',
          zIndex: 9999
        }}
      >
        Debug IPC
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      width: '400px',
      maxHeight: '300px',
      backgroundColor: 'white',
      border: '1px solid #ccc',
      borderRadius: '8px',
      padding: '16px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      zIndex: 9999,
      fontSize: '12px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '14px' }}>IPC Debug Panel</h3>
        <button onClick={() => setIsVisible(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
      </div>
      
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <button onClick={testAppVersion} style={{ padding: '4px 8px', fontSize: '11px' }}>Test Version</button>
        <button onClick={testAWSConfig} style={{ padding: '4px 8px', fontSize: '11px' }}>Test AWS Config</button>
        <button onClick={testSSOInitialize} style={{ padding: '4px 8px', fontSize: '11px' }}>Test SSO Init</button>
        <button onClick={testAWSProfiles} style={{ padding: '4px 8px', fontSize: '11px' }}>Test Profiles</button>
        <button onClick={runIntegrationTests} style={{ padding: '4px 8px', fontSize: '11px' }}>Integration Tests</button>
        <button onClick={runRealCredentialTests} style={{ padding: '4px 8px', fontSize: '11px' }}>Real Creds Test</button>
        <button onClick={clearResults} style={{ padding: '4px 8px', fontSize: '11px' }}>Clear</button>
      </div>

      <div style={{
        maxHeight: '150px',
        overflowY: 'auto',
        backgroundColor: '#f5f5f5',
        padding: '8px',
        borderRadius: '4px',
        fontFamily: 'monospace'
      }}>
        {testResults.length === 0 ? (
          <div style={{ color: '#666' }}>Click buttons above to test IPC communication</div>
        ) : (
          testResults.map((result, index) => (
            <div key={index} style={{ marginBottom: '4px' }}>{result}</div>
          ))
        )}
      </div>
    </div>
  );
};