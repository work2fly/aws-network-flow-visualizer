import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExportButton } from '../ExportButton';
import { NetworkTopology, FlowLogRecord } from '@shared/types';

// Mock the export utilities
jest.mock('../../utils/export-utils', () => ({
  exportVisualization: jest.fn(),
  exportFlowLogData: jest.fn(),
  exportTopologyData: jest.fn(),
  downloadBlob: jest.fn(),
  generateFilename: jest.fn(() => 'test-file.png'),
  validateExportOptions: jest.fn(() => ({ valid: true, errors: [] })),
  getExportRecommendations: jest.fn(() => [])
}));

// Mock the useExport hook
jest.mock('../../hooks/useExport', () => ({
  useExport: jest.fn(() => ({
    isExporting: false,
    progress: null,
    error: null,
    exportVisualizationImage: jest.fn(),
    exportFlowData: jest.fn(),
    exportTopology: jest.fn(),
    clearError: jest.fn()
  }))
}));

const mockCytoscapeInstance = {
  png: jest.fn(() => new Blob(['mock-png'], { type: 'image/png' })),
  svg: jest.fn(() => '<svg>mock-svg</svg>')
};

const mockTopology: NetworkTopology = {
  nodes: [
    {
      id: 'node-1',
      type: 'vpc',
      label: 'VPC-1',
      properties: {},
      metadata: { isActive: true }
    }
  ],
  edges: [],
  metadata: {
    lastUpdated: new Date(),
    recordCount: 1,
    timeRange: { start: new Date(), end: new Date() }
  }
};

const mockFlowLogs: FlowLogRecord[] = [
  {
    timestamp: new Date(),
    sourceIP: '10.0.1.100',
    destinationIP: '10.0.2.200',
    sourcePort: 80,
    destinationPort: 443,
    protocol: 'TCP',
    action: 'ACCEPT',
    bytes: 1024,
    packets: 10
  }
];

describe('ExportButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Button variant', () => {
    it('should render export button', () => {
      render(
        <ExportButton
          cytoscapeInstance={mockCytoscapeInstance}
          topology={mockTopology}
          flowLogs={mockFlowLogs}
          variant="button"
        />
      );

      expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
    });

    it('should be disabled when no cytoscape instance', () => {
      render(
        <ExportButton
          topology={mockTopology}
          flowLogs={mockFlowLogs}
          variant="button"
        />
      );

      expect(screen.getByRole('button', { name: /export/i })).toBeDisabled();
    });

    it('should open export dialog when clicked', () => {
      render(
        <ExportButton
          cytoscapeInstance={mockCytoscapeInstance}
          topology={mockTopology}
          flowLogs={mockFlowLogs}
          variant="button"
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /export/i }));

      expect(screen.getByText('Export Options')).toBeInTheDocument();
    });

    it('should show different sizes', () => {
      const { rerender } = render(
        <ExportButton
          cytoscapeInstance={mockCytoscapeInstance}
          size="sm"
          variant="button"
        />
      );

      let button = screen.getByRole('button', { name: /export/i });
      expect(button).toHaveClass('px-2', 'py-1', 'text-xs');

      rerender(
        <ExportButton
          cytoscapeInstance={mockCytoscapeInstance}
          size="lg"
          variant="button"
        />
      );

      button = screen.getByRole('button', { name: /export/i });
      expect(button).toHaveClass('px-4', 'py-3', 'text-base');
    });
  });

  describe('Dropdown variant', () => {
    it('should render dropdown button', () => {
      render(
        <ExportButton
          cytoscapeInstance={mockCytoscapeInstance}
          topology={mockTopology}
          flowLogs={mockFlowLogs}
          variant="dropdown"
        />
      );

      expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
    });

    it('should show dropdown menu when clicked', () => {
      render(
        <ExportButton
          cytoscapeInstance={mockCytoscapeInstance}
          topology={mockTopology}
          flowLogs={mockFlowLogs}
          variant="dropdown"
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /export/i }));

      expect(screen.getByText('Export Visualization')).toBeInTheDocument();
      expect(screen.getByText('Export Flow Data')).toBeInTheDocument();
      expect(screen.getByText('Export Topology')).toBeInTheDocument();
    });

    it('should disable options when data not available', () => {
      render(
        <ExportButton
          variant="dropdown"
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /export/i }));

      const visualizationButton = screen.getByText('Export Visualization').closest('button');
      const flowDataButton = screen.getByText('Export Flow Data').closest('button');
      const topologyButton = screen.getByText('Export Topology').closest('button');

      expect(visualizationButton).toBeDisabled();
      expect(flowDataButton).toBeDisabled();
      expect(topologyButton).toBeDisabled();
    });

    it('should open appropriate dialog for each export type', () => {
      render(
        <ExportButton
          cytoscapeInstance={mockCytoscapeInstance}
          topology={mockTopology}
          flowLogs={mockFlowLogs}
          variant="dropdown"
        />
      );

      // Open dropdown
      fireEvent.click(screen.getByRole('button', { name: /export/i }));

      // Click visualization export
      fireEvent.click(screen.getByText('Export Visualization'));

      expect(screen.getByText('Export Options')).toBeInTheDocument();
    });

    it('should close dropdown when clicking outside', () => {
      render(
        <div>
          <ExportButton
            cytoscapeInstance={mockCytoscapeInstance}
            topology={mockTopology}
            flowLogs={mockFlowLogs}
            variant="dropdown"
          />
          <div data-testid="outside">Outside</div>
        </div>
      );

      // Open dropdown
      fireEvent.click(screen.getByRole('button', { name: /export/i }));
      expect(screen.getByText('Export Visualization')).toBeInTheDocument();

      // Click outside
      fireEvent.click(screen.getByTestId('outside'));

      // Dropdown should be closed
      expect(screen.queryByText('Export Visualization')).not.toBeInTheDocument();
    });
  });

  describe('Export functionality', () => {
    it('should handle export errors gracefully', async () => {
      const mockUseExport = require('../../hooks/useExport').useExport;
      mockUseExport.mockReturnValue({
        isExporting: false,
        progress: null,
        error: 'Export failed',
        exportVisualizationImage: jest.fn(),
        exportFlowData: jest.fn(),
        exportTopology: jest.fn(),
        clearError: jest.fn()
      });

      render(
        <ExportButton
          cytoscapeInstance={mockCytoscapeInstance}
          topology={mockTopology}
          flowLogs={mockFlowLogs}
          variant="button"
        />
      );

      expect(screen.getByText('Export failed')).toBeInTheDocument();
    });

    it('should show progress indicator', () => {
      const mockUseExport = require('../../hooks/useExport').useExport;
      mockUseExport.mockReturnValue({
        isExporting: true,
        progress: {
          stage: 'processing',
          progress: 50,
          message: 'Processing export...'
        },
        error: null,
        exportVisualizationImage: jest.fn(),
        exportFlowData: jest.fn(),
        exportTopology: jest.fn(),
        clearError: jest.fn()
      });

      render(
        <ExportButton
          cytoscapeInstance={mockCytoscapeInstance}
          topology={mockTopology}
          flowLogs={mockFlowLogs}
          variant="button"
        />
      );

      expect(screen.getByText('Processing export...')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('should show exporting state on button', () => {
      const mockUseExport = require('../../hooks/useExport').useExport;
      mockUseExport.mockReturnValue({
        isExporting: true,
        progress: null,
        error: null,
        exportVisualizationImage: jest.fn(),
        exportFlowData: jest.fn(),
        exportTopology: jest.fn(),
        clearError: jest.fn()
      });

      render(
        <ExportButton
          cytoscapeInstance={mockCytoscapeInstance}
          topology={mockTopology}
          flowLogs={mockFlowLogs}
          variant="button"
        />
      );

      expect(screen.getByText('Exporting...')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(
        <ExportButton
          cytoscapeInstance={mockCytoscapeInstance}
          topology={mockTopology}
          flowLogs={mockFlowLogs}
          variant="button"
        />
      );

      const button = screen.getByRole('button', { name: /export/i });
      expect(button).toBeInTheDocument();
    });

    it('should be keyboard accessible', () => {
      render(
        <ExportButton
          cytoscapeInstance={mockCytoscapeInstance}
          topology={mockTopology}
          flowLogs={mockFlowLogs}
          variant="dropdown"
        />
      );

      const button = screen.getByRole('button', { name: /export/i });
      
      // Focus and activate with keyboard
      button.focus();
      fireEvent.keyDown(button, { key: 'Enter' });

      expect(screen.getByText('Export Visualization')).toBeInTheDocument();
    });
  });
});