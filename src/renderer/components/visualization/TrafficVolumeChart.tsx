import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { FlowLogRecord, ProtocolDistribution, PortStatistic } from '@shared/types';

interface TrafficVolumeData {
  protocols: ProtocolDistribution[];
  ports: PortStatistic[];
  sourceIPs: { ip: string; bytes: number; connections: number }[];
  destinationIPs: { ip: string; bytes: number; connections: number }[];
  timeDistribution: { hour: number; bytes: number; packets: number }[];
}

interface TrafficVolumeChartProps {
  data: FlowLogRecord[];
  chartType?: 'protocols' | 'ports' | 'sources' | 'destinations' | 'hourly';
  onDataPointClick?: (dataPoint: any) => void;
  className?: string;
  height?: number;
}

export const TrafficVolumeChart: React.FC<TrafficVolumeChartProps> = ({
  data,
  chartType = 'protocols',
  onDataPointClick,
  className = '',
  height = 250
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 400, height });

  // Process flow log data into chart data
  const processedData = React.useMemo((): TrafficVolumeData => {
    if (!data.length) {
      return {
        protocols: [],
        ports: [],
        sourceIPs: [],
        destinationIPs: [],
        timeDistribution: []
      };
    }

    // Process protocols
    const protocolMap = new Map<string, { bytes: number; packets: number; connections: number }>();
    const portMap = new Map<number, { bytes: number; connections: number; protocol: string }>();
    const sourceIPMap = new Map<string, { bytes: number; connections: number }>();
    const destIPMap = new Map<string, { bytes: number; connections: number }>();
    const hourlyMap = new Map<number, { bytes: number; packets: number }>();

    data.forEach(record => {
      // Protocols
      const protocol = record.protocol || 'Unknown';
      if (!protocolMap.has(protocol)) {
        protocolMap.set(protocol, { bytes: 0, packets: 0, connections: 0 });
      }
      const protocolData = protocolMap.get(protocol)!;
      protocolData.bytes += record.bytes;
      protocolData.packets += record.packets;
      protocolData.connections += 1;

      // Ports
      const port = record.destinationPort;
      if (port && port > 0) {
        if (!portMap.has(port)) {
          portMap.set(port, { bytes: 0, connections: 0, protocol });
        }
        const portData = portMap.get(port)!;
        portData.bytes += record.bytes;
        portData.connections += 1;
      }

      // Source IPs
      const sourceIP = record.sourceIP;
      if (!sourceIPMap.has(sourceIP)) {
        sourceIPMap.set(sourceIP, { bytes: 0, connections: 0 });
      }
      const sourceData = sourceIPMap.get(sourceIP)!;
      sourceData.bytes += record.bytes;
      sourceData.connections += 1;

      // Destination IPs
      const destIP = record.destinationIP;
      if (!destIPMap.has(destIP)) {
        destIPMap.set(destIP, { bytes: 0, connections: 0 });
      }
      const destData = destIPMap.get(destIP)!;
      destData.bytes += record.bytes;
      destData.connections += 1;

      // Hourly distribution
      const hour = record.timestamp.getHours();
      if (!hourlyMap.has(hour)) {
        hourlyMap.set(hour, { bytes: 0, packets: 0 });
      }
      const hourlyData = hourlyMap.get(hour)!;
      hourlyData.bytes += record.bytes;
      hourlyData.packets += record.packets;
    });

    // Calculate percentages and sort
    const totalBytes = data.reduce((sum, record) => sum + record.bytes, 0);

    const protocols = Array.from(protocolMap.entries())
      .map(([protocol, stats]) => ({
        protocol,
        bytes: stats.bytes,
        packets: stats.packets,
        connections: stats.connections,
        percentage: (stats.bytes / totalBytes) * 100
      }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 10);

    const ports = Array.from(portMap.entries())
      .map(([port, stats]) => ({
        port,
        protocol: stats.protocol,
        bytes: stats.bytes,
        connections: stats.connections
      }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 15);

    const sourceIPs = Array.from(sourceIPMap.entries())
      .map(([ip, stats]) => ({
        ip,
        bytes: stats.bytes,
        connections: stats.connections
      }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 10);

    const destinationIPs = Array.from(destIPMap.entries())
      .map(([ip, stats]) => ({
        ip,
        bytes: stats.bytes,
        connections: stats.connections
      }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 10);

    const timeDistribution = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      bytes: hourlyMap.get(hour)?.bytes || 0,
      packets: hourlyMap.get(hour)?.packets || 0
    }));

    return {
      protocols,
      ports,
      sourceIPs,
      destinationIPs,
      timeDistribution
    };
  }, [data]);

  // Handle container resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const { width } = containerRef.current.getBoundingClientRect();
        setDimensions({ width: Math.max(width, 300), height });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [height]);

  // Create the chart based on type
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    switch (chartType) {
      case 'protocols':
        createProtocolChart(svg, processedData.protocols, dimensions, onDataPointClick);
        break;
      case 'ports':
        createPortChart(svg, processedData.ports, dimensions, onDataPointClick);
        break;
      case 'sources':
        createIPChart(svg, processedData.sourceIPs, dimensions, onDataPointClick, 'Source IPs');
        break;
      case 'destinations':
        createIPChart(svg, processedData.destinationIPs, dimensions, onDataPointClick, 'Destination IPs');
        break;
      case 'hourly':
        createHourlyChart(svg, processedData.timeDistribution, dimensions, onDataPointClick);
        break;
    }
  }, [processedData, chartType, dimensions, onDataPointClick]);

  return (
    <div ref={containerRef} className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900">
          {getChartTitle(chartType)}
        </h3>
        <div className="text-xs text-gray-500">
          {data.length.toLocaleString()} records
        </div>
      </div>

      <div className="relative">
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="overflow-visible"
        />
        
        {data.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-75 rounded">
            <div className="text-center">
              <div className="text-gray-500 text-sm">No data available</div>
              <div className="text-gray-400 text-xs mt-1">Load flow log data to see traffic analysis</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Chart creation functions
function createProtocolChart(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  data: ProtocolDistribution[],
  dimensions: { width: number; height: number },
  onDataPointClick?: (dataPoint: any) => void
) {
  if (!data.length) return;

  const margin = { top: 20, right: 20, bottom: 40, left: 60 };
  const width = dimensions.width - margin.left - margin.right;
  const height = dimensions.height - margin.top - margin.bottom;

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Scales
  const xScale = d3.scaleBand()
    .domain(data.map(d => d.protocol))
    .range([0, width])
    .padding(0.1);

  const yScale = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.bytes) as number])
    .nice()
    .range([height, 0]);

  const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

  // Bars
  g.selectAll('.bar')
    .data(data)
    .enter().append('rect')
    .attr('class', 'bar')
    .attr('x', d => xScale(d.protocol)!)
    .attr('y', d => yScale(d.bytes))
    .attr('width', xScale.bandwidth())
    .attr('height', d => height - yScale(d.bytes))
    .attr('fill', (d, i) => colorScale(i.toString()))
    .style('cursor', 'pointer')
    .on('click', (event, d) => onDataPointClick?.(d))
    .on('mouseover', function(event, d) {
      d3.select(this).attr('opacity', 0.8);
      showTooltip(event, `
        <strong>${d.protocol}</strong><br/>
        Bytes: ${formatBytes(d.bytes)}<br/>
        Packets: ${d.packets.toLocaleString()}<br/>
        Connections: ${d.connections}<br/>
        Percentage: ${d.percentage.toFixed(1)}%
      `);
    })
    .on('mouseout', function() {
      d3.select(this).attr('opacity', 1);
      hideTooltip();
    });

  // Axes
  g.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(xScale))
    .selectAll('text')
    .style('font-size', '11px')
    .attr('transform', 'rotate(-45)')
    .style('text-anchor', 'end');

  g.append('g')
    .call(d3.axisLeft(yScale).tickFormat(d => formatBytes(d as number)))
    .selectAll('text')
    .style('font-size', '11px');
}

function createPortChart(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  data: PortStatistic[],
  dimensions: { width: number; height: number },
  onDataPointClick?: (dataPoint: any) => void
) {
  if (!data.length) return;

  const margin = { top: 20, right: 20, bottom: 40, left: 60 };
  const width = dimensions.width - margin.left - margin.right;
  const height = dimensions.height - margin.top - margin.bottom;

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Scales
  const xScale = d3.scaleBand()
    .domain(data.map(d => d.port.toString()))
    .range([0, width])
    .padding(0.1);

  const yScale = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.bytes) as number])
    .nice()
    .range([height, 0]);

  // Bars with port-specific colors
  g.selectAll('.bar')
    .data(data)
    .enter().append('rect')
    .attr('class', 'bar')
    .attr('x', d => xScale(d.port.toString())!)
    .attr('y', d => yScale(d.bytes))
    .attr('width', xScale.bandwidth())
    .attr('height', d => height - yScale(d.bytes))
    .attr('fill', d => getPortColor(d.port))
    .style('cursor', 'pointer')
    .on('click', (event, d) => onDataPointClick?.(d))
    .on('mouseover', function(event, d) {
      d3.select(this).attr('opacity', 0.8);
      showTooltip(event, `
        <strong>Port ${d.port}</strong><br/>
        Protocol: ${d.protocol}<br/>
        Bytes: ${formatBytes(d.bytes)}<br/>
        Connections: ${d.connections}
      `);
    })
    .on('mouseout', function() {
      d3.select(this).attr('opacity', 1);
      hideTooltip();
    });

  // Axes
  g.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(xScale))
    .selectAll('text')
    .style('font-size', '10px')
    .attr('transform', 'rotate(-45)')
    .style('text-anchor', 'end');

  g.append('g')
    .call(d3.axisLeft(yScale).tickFormat(d => formatBytes(d as number)))
    .selectAll('text')
    .style('font-size', '11px');
}

function createIPChart(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  data: { ip: string; bytes: number; connections: number }[],
  dimensions: { width: number; height: number },
  onDataPointClick?: (dataPoint: any) => void,
  title?: string
) {
  if (!data.length) return;

  const margin = { top: 20, right: 20, bottom: 60, left: 60 };
  const width = dimensions.width - margin.left - margin.right;
  const height = dimensions.height - margin.top - margin.bottom;

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Scales
  const xScale = d3.scaleBand()
    .domain(data.map(d => d.ip))
    .range([0, width])
    .padding(0.1);

  const yScale = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.bytes) as number])
    .nice()
    .range([height, 0]);

  // Bars
  g.selectAll('.bar')
    .data(data)
    .enter().append('rect')
    .attr('class', 'bar')
    .attr('x', d => xScale(d.ip)!)
    .attr('y', d => yScale(d.bytes))
    .attr('width', xScale.bandwidth())
    .attr('height', d => height - yScale(d.bytes))
    .attr('fill', '#3B82F6')
    .style('cursor', 'pointer')
    .on('click', (event, d) => onDataPointClick?.(d))
    .on('mouseover', function(event, d) {
      d3.select(this).attr('opacity', 0.8);
      showTooltip(event, `
        <strong>${d.ip}</strong><br/>
        Bytes: ${formatBytes(d.bytes)}<br/>
        Connections: ${d.connections}
      `);
    })
    .on('mouseout', function() {
      d3.select(this).attr('opacity', 1);
      hideTooltip();
    });

  // Axes
  g.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(xScale))
    .selectAll('text')
    .style('font-size', '9px')
    .attr('transform', 'rotate(-45)')
    .style('text-anchor', 'end');

  g.append('g')
    .call(d3.axisLeft(yScale).tickFormat(d => formatBytes(d as number)))
    .selectAll('text')
    .style('font-size', '11px');
}

function createHourlyChart(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  data: { hour: number; bytes: number; packets: number }[],
  dimensions: { width: number; height: number },
  onDataPointClick?: (dataPoint: any) => void
) {
  const margin = { top: 20, right: 20, bottom: 40, left: 60 };
  const width = dimensions.width - margin.left - margin.right;
  const height = dimensions.height - margin.top - margin.bottom;

  const g = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Scales
  const xScale = d3.scaleLinear()
    .domain([0, 23])
    .range([0, width]);

  const yScale = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.bytes) as number])
    .nice()
    .range([height, 0]);

  // Line generator
  const line = d3.line<{ hour: number; bytes: number; packets: number }>()
    .x(d => xScale(d.hour))
    .y(d => yScale(d.bytes))
    .curve(d3.curveMonotoneX);

  // Area generator
  const area = d3.area<{ hour: number; bytes: number; packets: number }>()
    .x(d => xScale(d.hour))
    .y0(height)
    .y1(d => yScale(d.bytes))
    .curve(d3.curveMonotoneX);

  // Add area
  g.append('path')
    .datum(data)
    .attr('d', area)
    .style('fill', '#3B82F6')
    .style('opacity', 0.3);

  // Add line
  g.append('path')
    .datum(data)
    .attr('d', line)
    .style('fill', 'none')
    .style('stroke', '#3B82F6')
    .style('stroke-width', 2);

  // Add dots
  g.selectAll('.dot')
    .data(data)
    .enter().append('circle')
    .attr('class', 'dot')
    .attr('cx', d => xScale(d.hour))
    .attr('cy', d => yScale(d.bytes))
    .attr('r', 3)
    .style('fill', '#3B82F6')
    .style('cursor', 'pointer')
    .on('click', (event, d) => onDataPointClick?.(d))
    .on('mouseover', function(event, d) {
      d3.select(this).attr('r', 5);
      showTooltip(event, `
        <strong>Hour ${d.hour}:00</strong><br/>
        Bytes: ${formatBytes(d.bytes)}<br/>
        Packets: ${d.packets.toLocaleString()}
      `);
    })
    .on('mouseout', function() {
      d3.select(this).attr('r', 3);
      hideTooltip();
    });

  // Axes
  g.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(xScale).tickFormat(d => `${d}:00`))
    .selectAll('text')
    .style('font-size', '11px');

  g.append('g')
    .call(d3.axisLeft(yScale).tickFormat(d => formatBytes(d as number)))
    .selectAll('text')
    .style('font-size', '11px');
}

// Utility functions
function getChartTitle(chartType: string): string {
  const titles = {
    protocols: 'Traffic by Protocol',
    ports: 'Traffic by Port',
    sources: 'Top Source IPs',
    destinations: 'Top Destination IPs',
    hourly: 'Traffic by Hour'
  };
  return titles[chartType as keyof typeof titles] || 'Traffic Analysis';
}

function getPortColor(port: number): string {
  // Common port colors
  if ([80, 8080].includes(port)) return '#10B981'; // HTTP - Green
  if ([443, 8443].includes(port)) return '#3B82F6'; // HTTPS - Blue
  if ([22].includes(port)) return '#F59E0B'; // SSH - Orange
  if ([21, 20].includes(port)) return '#8B5CF6'; // FTP - Purple
  if ([25, 587, 465].includes(port)) return '#EF4444'; // SMTP - Red
  if ([53].includes(port)) return '#06B6D4'; // DNS - Cyan
  if ([3389].includes(port)) return '#EC4899'; // RDP - Pink
  return '#6B7280'; // Default - Gray
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function showTooltip(event: any, content: string) {
  const tooltip = d3.select('body').append('div')
    .attr('class', 'chart-tooltip')
    .style('position', 'absolute')
    .style('background', 'rgba(0, 0, 0, 0.8)')
    .style('color', 'white')
    .style('padding', '8px')
    .style('border-radius', '4px')
    .style('font-size', '12px')
    .style('pointer-events', 'none')
    .style('z-index', '1000')
    .html(content);

  tooltip
    .style('left', (event.pageX + 10) + 'px')
    .style('top', (event.pageY - 10) + 'px');
}

function hideTooltip() {
  d3.selectAll('.chart-tooltip').remove();
}