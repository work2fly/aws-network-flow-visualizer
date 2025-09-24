// Jest setup file for additional configuration
import '@testing-library/jest-dom';

// Mock Electron APIs for testing
Object.defineProperty(window, 'electronAPI', {
  value: {
    getAppVersion: jest.fn().mockResolvedValue('1.0.0'),
  },
  writable: true,
});

// Mock AWS SDK for testing
jest.mock('@aws-sdk/client-cloudwatch-logs', () => ({
  CloudWatchLogsClient: jest.fn(),
}));

jest.mock('@aws-sdk/client-sts', () => ({
  STSClient: jest.fn(),
}));
