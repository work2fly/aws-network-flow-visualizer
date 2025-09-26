import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MainLayout, Tab } from '../MainLayout';

// Mock components for testing
const MockComponent1 = () => <div>Mock Component 1</div>;
const MockComponent2 = () => <div>Mock Component 2</div>;

const mockTabs: Tab[] = [
  {
    id: 'tab1',
    label: 'Tab 1',
    component: MockComponent1,
  },
  {
    id: 'tab2',
    label: 'Tab 2',
    component: MockComponent2,
    closable: true,
  },
];

const mockConnectionStatus = {
  connected: true,
  region: 'us-east-1',
  accountId: '123456789012',
};

const mockOperationStatus = {
  isLoading: false,
};

describe('MainLayout', () => {
  const defaultProps = {
    tabs: mockTabs,
    activeTabId: 'tab1',
    onTabChange: jest.fn(),
    onTabClose: jest.fn(),
    connectionStatus: mockConnectionStatus,
    operationStatus: mockOperationStatus,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the main layout structure', () => {
    render(<MainLayout {...defaultProps} />);
    
    // Check for main layout elements
    expect(screen.getByText('AWS Network Flow Visualizer')).toBeInTheDocument();
    expect(screen.getByText('Tab 1')).toBeInTheDocument();
    expect(screen.getByText('Tab 2')).toBeInTheDocument();
    expect(screen.getByText('Mock Component 1')).toBeInTheDocument();
  });

  it('displays connection status correctly', () => {
    render(<MainLayout {...defaultProps} />);
    
    expect(screen.getAllByText('Connected')).toHaveLength(2); // Sidebar and status bar
    expect(screen.getAllByText('us-east-1')).toHaveLength(2); // Sidebar and status bar
  });

  it('displays disconnected status correctly', () => {
    const disconnectedProps = {
      ...defaultProps,
      connectionStatus: {
        connected: false,
        error: 'Connection failed',
      },
    };
    
    render(<MainLayout {...disconnectedProps} />);
    
    expect(screen.getAllByText('Disconnected')).toHaveLength(2); // Sidebar and status bar
    expect(screen.getAllByText('Connection failed')).toHaveLength(2); // Sidebar and status bar
  });

  it('calls onTabChange when tab is clicked', () => {
    render(<MainLayout {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Tab 2'));
    
    expect(defaultProps.onTabChange).toHaveBeenCalledWith('tab2');
  });

  it('calls onTabClose when close button is clicked on closable tab', () => {
    render(<MainLayout {...defaultProps} />);
    
    // Find the close button for Tab 2 (which is closable)
    const closeButtons = screen.getAllByRole('button');
    const closeButton = closeButtons.find(button => 
      button.querySelector('svg') && 
      button.closest('[data-testid]') === null
    );
    
    if (closeButton) {
      fireEvent.click(closeButton);
      expect(defaultProps.onTabClose).toHaveBeenCalledWith('tab2');
    }
  });

  it('displays loading status when operation is in progress', () => {
    const loadingProps = {
      ...defaultProps,
      operationStatus: {
        isLoading: true,
        operation: 'Loading flow logs',
        progress: 0.5,
      },
    };
    
    render(<MainLayout {...loadingProps} />);
    
    expect(screen.getByText('Loading flow logs')).toBeInTheDocument();
    expect(screen.getByText('(50%)')).toBeInTheDocument();
  });

  it('renders the active tab component', () => {
    render(<MainLayout {...defaultProps} />);
    
    expect(screen.getByText('Mock Component 1')).toBeInTheDocument();
    expect(screen.queryByText('Mock Component 2')).not.toBeInTheDocument();
  });

  it('switches to different tab component when activeTabId changes', () => {
    const { rerender } = render(<MainLayout {...defaultProps} />);
    
    expect(screen.getByText('Mock Component 1')).toBeInTheDocument();
    
    rerender(<MainLayout {...defaultProps} activeTabId="tab2" />);
    
    expect(screen.getByText('Mock Component 2')).toBeInTheDocument();
    expect(screen.queryByText('Mock Component 1')).not.toBeInTheDocument();
  });
});