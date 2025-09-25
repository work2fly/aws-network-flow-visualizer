import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FilterPanel } from '../FilterPanel';
import { FlowFilters } from '@shared/types';

describe('FilterPanel', () => {
  const mockFilters: FlowFilters = {
    sourceIPs: [],
    destinationIPs: [],
    ipRanges: [],
    sourcePorts: [],
    destinationPorts: [],
    protocols: [],
    actions: ['ACCEPT', 'REJECT'],
    vpcIds: [],
    subnetIds: [],
    instanceIds: [],
    accountIds: [],
    regions: []
  };

  const mockOnFiltersChange = jest.fn();
  const mockOnReset = jest.fn();
  const mockOnSave = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders filter panel with tabs', () => {
    render(
      <FilterPanel
        filters={mockFilters}
        onFiltersChange={mockOnFiltersChange}
        onReset={mockOnReset}
        onSave={mockOnSave}
      />
    );

    expect(screen.getByText('Filters')).toBeInTheDocument();
    expect(screen.getByText('Basic')).toBeInTheDocument();
    expect(screen.getByText('Advanced')).toBeInTheDocument();
    expect(screen.getByText('Time Range')).toBeInTheDocument();
  });

  it('shows active filter count', () => {
    const filtersWithActive: FlowFilters = {
      ...mockFilters,
      sourceIPs: ['192.168.1.1'],
      protocols: ['TCP']
    };

    render(
      <FilterPanel
        filters={filtersWithActive}
        onFiltersChange={mockOnFiltersChange}
        onReset={mockOnReset}
      />
    );

    expect(screen.getByText('2 active')).toBeInTheDocument();
  });

  it('handles IP address filtering', async () => {
    render(
      <FilterPanel
        filters={mockFilters}
        onFiltersChange={mockOnFiltersChange}
        onReset={mockOnReset}
      />
    );

    const textareas = screen.getAllByRole('textbox');
    const sourceIPTextarea = textareas[0]; // First textarea is source IPs
    fireEvent.change(sourceIPTextarea, { target: { value: '192.168.1.1\n10.0.0.1' } });

    await waitFor(() => {
      expect(mockOnFiltersChange).toHaveBeenCalledWith({
        sourceIPs: ['192.168.1.1', '10.0.0.1']
      });
    });
  });

  it('handles protocol filtering', () => {
    render(
      <FilterPanel
        filters={mockFilters}
        onFiltersChange={mockOnFiltersChange}
        onReset={mockOnReset}
      />
    );

    const tcpCheckbox = screen.getByLabelText('TCP');
    fireEvent.click(tcpCheckbox);

    expect(mockOnFiltersChange).toHaveBeenCalledWith({
      protocols: ['TCP']
    });
  });

  it('handles time range presets', () => {
    render(
      <FilterPanel
        filters={mockFilters}
        onFiltersChange={mockOnFiltersChange}
        onReset={mockOnReset}
      />
    );

    // Switch to time range tab
    fireEvent.click(screen.getByText('Time Range'));

    const lastHourButton = screen.getByText('Last Hour');
    fireEvent.click(lastHourButton);

    expect(mockOnFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({
        timeRange: expect.objectContaining({
          preset: 'last-hour'
        })
      })
    );
  });

  it('handles IP range addition and removal', () => {
    render(
      <FilterPanel
        filters={mockFilters}
        onFiltersChange={mockOnFiltersChange}
        onReset={mockOnReset}
      />
    );

    // Switch to advanced tab
    fireEvent.click(screen.getByText('Advanced'));

    const addRangeButton = screen.getByText('Add Range');
    fireEvent.click(addRangeButton);

    expect(mockOnFiltersChange).toHaveBeenCalledWith({
      ipRanges: [{ cidr: '', include: true, label: '' }]
    });
  });

  it('calls reset function when reset button is clicked', () => {
    render(
      <FilterPanel
        filters={mockFilters}
        onFiltersChange={mockOnFiltersChange}
        onReset={mockOnReset}
      />
    );

    const resetButton = screen.getByText('Reset');
    fireEvent.click(resetButton);

    expect(mockOnReset).toHaveBeenCalled();
  });

  it('calls save function when save button is clicked', () => {
    // Mock window.prompt
    const mockPrompt = jest.spyOn(window, 'prompt').mockReturnValue('Test Filter');

    render(
      <FilterPanel
        filters={mockFilters}
        onFiltersChange={mockOnFiltersChange}
        onReset={mockOnReset}
        onSave={mockOnSave}
      />
    );

    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    expect(mockPrompt).toHaveBeenCalledWith('Filter name:');
    expect(mockOnSave).toHaveBeenCalledWith('Test Filter');

    mockPrompt.mockRestore();
  });

  it('handles traffic volume filtering', async () => {
    render(
      <FilterPanel
        filters={mockFilters}
        onFiltersChange={mockOnFiltersChange}
        onReset={mockOnReset}
      />
    );

    // Switch to advanced tab
    fireEvent.click(screen.getByText('Advanced'));

    const minBytesInput = screen.getByPlaceholderText('0');
    fireEvent.change(minBytesInput, { target: { value: '1000' } });

    await waitFor(() => {
      expect(mockOnFiltersChange).toHaveBeenCalledWith({
        minBytes: 1000
      });
    });
  });

  it('expands and collapses correctly', () => {
    render(
      <FilterPanel
        filters={mockFilters}
        onFiltersChange={mockOnFiltersChange}
        onReset={mockOnReset}
      />
    );

    // Should be expanded by default
    expect(screen.getByText('Basic')).toBeInTheDocument();

    // Find the collapse button by its SVG content
    const collapseButtons = screen.getAllByRole('button');
    const collapseButton = collapseButtons.find(button => 
      button.querySelector('svg')?.querySelector('path')?.getAttribute('d') === 'M19 9l-7 7-7-7'
    );
    
    expect(collapseButton).toBeTruthy();
    fireEvent.click(collapseButton!);

    // Content should be hidden
    expect(screen.queryByText('Basic')).not.toBeInTheDocument();
  });
});