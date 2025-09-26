import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StatusBar } from '../StatusBar';

describe('StatusBar', () => {
  const defaultProps = {
    connectionStatus: {
      connected: true,
      region: 'us-east-1',
      accountId: '123456789012',
    },
    onToggleControlPanel: jest.fn(),
    controlPanelVisible: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders connected status correctly', () => {
    render(<StatusBar {...defaultProps} />);
    
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('us-east-1')).toBeInTheDocument();
    expect(screen.getByText('(1234-5678-9012)')).toBeInTheDocument();
  });

  it('renders disconnected status correctly', () => {
    const disconnectedProps = {
      ...defaultProps,
      connectionStatus: {
        connected: false,
        error: 'Authentication failed',
      },
    };
    
    render(<StatusBar {...disconnectedProps} />);
    
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
    expect(screen.getByText('Authentication failed')).toBeInTheDocument();
  });

  it('displays loading operation status', () => {
    const loadingProps = {
      ...defaultProps,
      operationStatus: {
        isLoading: true,
        operation: 'Querying CloudWatch',
        progress: 0.75,
      },
    };
    
    render(<StatusBar {...loadingProps} />);
    
    expect(screen.getByText('Querying CloudWatch')).toBeInTheDocument();
    expect(screen.getByText('(75%)')).toBeInTheDocument();
  });

  it('calls onToggleControlPanel when control panel button is clicked', () => {
    render(<StatusBar {...defaultProps} />);
    
    const toggleButton = screen.getByTitle('Show control panel');
    fireEvent.click(toggleButton);
    
    expect(defaultProps.onToggleControlPanel).toHaveBeenCalledTimes(1);
  });

  it('shows correct control panel button state when panel is visible', () => {
    const visiblePanelProps = {
      ...defaultProps,
      controlPanelVisible: true,
    };
    
    render(<StatusBar {...visiblePanelProps} />);
    
    expect(screen.getByTitle('Hide control panel')).toBeInTheDocument();
  });

  it('formats account ID correctly', () => {
    render(<StatusBar {...defaultProps} />);
    
    // Account ID should be formatted as 1234-5678-9012
    expect(screen.getByText('(1234-5678-9012)')).toBeInTheDocument();
  });

  it('displays current time', () => {
    render(<StatusBar {...defaultProps} />);
    
    // Should display current time (format may vary by locale)
    const timeRegex = /\d{1,2}:\d{2}:\d{2}/;
    expect(screen.getByText(timeRegex)).toBeInTheDocument();
  });

  it('displays ready status', () => {
    render(<StatusBar {...defaultProps} />);
    
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('displays memory usage indicator', () => {
    render(<StatusBar {...defaultProps} />);
    
    expect(screen.getByText('Memory: 45MB')).toBeInTheDocument();
  });

  it('displays zoom level indicator', () => {
    render(<StatusBar {...defaultProps} />);
    
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});