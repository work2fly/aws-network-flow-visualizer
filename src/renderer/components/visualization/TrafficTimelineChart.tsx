import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { FlowLogRecord, TrafficAnomaly } from '@shared/types';

interface TimelineDataPoint {
  timestamp: Date;
  totalBytes: number;
  totalPackets: number;
  acceptedConnections: number;
  rejectedConnections: number;
  uniqueSourceIPs: number;
  uniqueDestinationIPs: number;
}

interface TrafficTimelineChartProps {
  data: FlowLogRecord[];
  anomalies?: TrafficAnomaly[];
  timeRange?: { start: Date; end: Date };
  onTimeRangeSelect?: (start: Date, end: Date) => void;
  onAnomalyClick?: (anomaly: TrafficAnomaly) => void;
  className?: string;
  height?: number;
}

export const TrafficTimelineChart: React.FC<TrafficTimelineChartProps> = ({
  data,
  anomalies = [],
  timeRange,
  onTimeRangeSelect,
  onAnomalyClick,
  className = '',
  height = 300
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height });
  const [selectedMetric, setSelectedMetric] = useState<keyof TimelineDataPoint>('totalBytes');
  const [brushSelection, setBrushSelection] = useState<[Date, Date] | null>(null);

  // Process flow log data into timeline data points
  const processedData = React.useMemo(() => {
    if (!data.length) return [];

    // Group data by time intervals (e.g., 5-minute buckets)
    const intervalMs = 5 * 60 * 1000; // 5 minutes
    const dataMap = new Map<number, TimelineDataPoint>();

    data.forEach(record => {
      const bucketTime = Math.floor(record.timestamp.getTime() / intervalMs) * intervalMs;
      
      if (!dataMap.has(bucketTime)) {
        dataMap.set(bucketTime, {
          timestamp: new Date(bucketTime),
          totalBytes: 0,
          totalPackets: 0,
          acceptedConnections: 0,
          rejectedConnections: 0,
          uniqueSourceIPs: 0,
          uniqueDestinationIPs: 0
        });
      }

      const point = dataMap.get(bucketTime)!;
      point.totalBytes += record.bytes;
      point.totalPackets += record.packets;
      
      if (record.action === 'ACCEPT') {
        point.acceptedConnections++;
      } else {
        point.rejectedConnections++;
      }
    });

    // Calculate unique IPs per bucket (simplified - in real implementation would track actual uniqueness)
    dataMap.forEach(point => {
      const relatedRecords = data.filter(r => 
        Math.abs(r.timestamp.getTime() - point.timestamp.getTime()) < intervalMs
      );
      
      point.uniqueSourceIPs = new Set(relatedRecords.map(r => r.sourceIP)).size;
      point.uniqueDestinationIPs = new Set(relatedRecords.map(r => r.destinationIP)).size;
    });

    return Array.from(dataMap.values()).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [data]);

  // Handle container resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const { width } = containerRef.current.getBoundingClientRect();
        setDimensions({ width: Math.max(width, 400), height });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [height]);

  // Create the timeline chart
  useEffect(() => {
    if (!svgRef.current || !processedData.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 80, bottom: 60, left: 80 };
    const width = dimensions.width - margin.left - margin.right;
    const chartHeight = dimensions.height - margin.top - margin.bottom;

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3.scaleTime()
      .domain(d3.extent(processedData, d => d.timestamp) as [Date, Date])
      .range([0, width]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(processedData, d => d[selectedMetric]) as number])
      .nice()
      .range([chartHeight, 0]);

    // Create line generator
    const line = d3.line<TimelineDataPoint>()
      .x(d => xScale(d.timestamp))
      .y(d => yScale(d[selectedMetric] as number))
      .curve(d3.curveMonotoneX);

    // Create area generator for filled chart
    const area = d3.area<TimelineDataPoint>()
      .x(d => xScale(d.timestamp))
      .y0(chartHeight)
      .y1(d => yScale(d[selectedMetric] as number))
      .curve(d3.curveMonotoneX);

    // Add gradient definition
    const gradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', 'area-gradient')
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('x1', 0).attr('y1', 0)
      .attr('x2', 0).attr('y2', chartHeight);

    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', getMetricColor(selectedMetric))
      .attr('stop-opacity', 0.8);

    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', getMetricColor(selectedMetric))
      .attr('stop-opacity', 0.1);

    // Add area
    g.append('path')
      .datum(processedData)
      .attr('class', 'area')
      .attr('d', area)
      .style('fill', 'url(#area-gradient)');

    // Add line
    g.append('path')
      .datum(processedData)
      .attr('class', 'line')
      .attr('d', line)
      .style('fill', 'none')
      .style('stroke', getMetricColor(selectedMetric))
      .style('stroke-width', 2);

    // Add dots for data points
    g.selectAll('.dot')
      .data(processedData)
      .enter().append('circle')
      .attr('class', 'dot')
      .attr('cx', d => xScale(d.timestamp))
      .attr('cy', d => yScale(d[selectedMetric] as number))
      .attr('r', 3)
      .style('fill', getMetricColor(selectedMetric))
      .style('stroke', '#fff')
      .style('stroke-width', 1)
      .on('mouseover', function(event, d) {
        showTooltip(event, d);
      })
      .on('mouseout', hideTooltip);

    // Add anomaly markers
    if (anomalies.length > 0) {
      g.selectAll('.anomaly')
        .data(anomalies)
        .enter().append('rect')
        .attr('class', 'anomaly')
        .attr('x', d => xScale(d.timeRange.start))
        .attr('y', 0)
        .attr('width', d => Math.max(xScale(d.timeRange.end) - xScale(d.timeRange.start), 2))
        .attr('height', chartHeight)
        .style('fill', getAnomalySeverityColor(d => d.severity))
        .style('opacity', 0.3)
        .style('cursor', 'pointer')
        .on('click', (event, d) => onAnomalyClick?.(d))
        .on('mouseover', function(event, d) {
          showAnomalyTooltip(event, d);
        })
        .on('mouseout', hideTooltip);
    }

    // Add axes
    const xAxis = d3.axisBottom(xScale)
      .tickFormat(d3.timeFormat('%H:%M'));

    const yAxis = d3.axisLeft(yScale)
      .tickFormat(d => formatMetricValue(d as number, selectedMetric));

    g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${chartHeight})`)
      .call(xAxis)
      .selectAll('text')
      .style('font-size', '12px');

    g.append('g')
      .attr('class', 'y-axis')
      .call(yAxis)
      .selectAll('text')
      .style('font-size', '12px');

    // Add axis labels
    g.append('text')
      .attr('class', 'y-label')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - margin.left)
      .attr('x', 0 - (chartHeight / 2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#666')
      .text(getMetricLabel(selectedMetric));

    g.append('text')
      .attr('class', 'x-label')
      .attr('transform', `translate(${width / 2}, ${chartHeight + margin.bottom - 10})`)
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#666')
      .text('Time');

    // Add brush for time range selection
    if (onTimeRangeSelect) {
      const brush = d3.brushX()
        .extent([[0, 0], [width, chartHeight]])
        .on('end', (event) => {
          if (!event.selection) {
            setBrushSelection(null);
            return;
          }

          const [x0, x1] = event.selection;
          const startTime = xScale.invert(x0);
          const endTime = xScale.invert(x1);
          
          setBrushSelection([startTime, endTime]);
          onTimeRangeSelect(startTime, endTime);
        });

      g.append('g')
        .attr('class', 'brush')
        .call(brush);
    }

  }, [processedData, selectedMetric, dimensions, anomalies, onTimeRangeSelect, onAnomalyClick]);

  // Tooltip functions
  const showTooltip = useCallback((event: any, d: TimelineDataPoint) => {
    const tooltip = d3.select('body').append('div')
      .attr('class', 'timeline-tooltip')
      .style('position', 'absolute')
      .style('background', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('padding', '8px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('z-index', '1000');

    tooltip.html(`
      <div><strong>${d3.timeFormat('%Y-%m-%d %H:%M')(d.timestamp)}</strong></div>
      <div>Bytes: ${formatBytes(d.totalBytes)}</div>
      <div>Packets: ${d.totalPackets.toLocaleString()}</div>
      <div>Accepted: ${d.acceptedConnections}</div>
      <div>Rejected: ${d.rejectedConnections}</div>
      <div>Source IPs: ${d.uniqueSourceIPs}</div>
      <div>Dest IPs: ${d.uniqueDestinationIPs}</div>
    `);

    tooltip
      .style('left', (event.pageX + 10) + 'px')
      .style('top', (event.pageY - 10) + 'px');
  }, []);

  const showAnomalyTooltip = useCallback((event: any, d: TrafficAnomaly) => {
    const tooltip = d3.select('body').append('div')
      .attr('class', 'anomaly-tooltip')
      .style('position', 'absolute')
      .style('background', 'rgba(220, 38, 38, 0.9)')
      .style('color', 'white')
      .style('padding', '8px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('z-index', '1000');

    tooltip.html(`
      <div><strong>Anomaly: ${d.type}</strong></div>
      <div>Severity: ${d.severity}</div>
      <div>Description: ${d.description}</div>
      <div>Time: ${d3.timeFormat('%H:%M')(d.timeRange.start)} - ${d3.timeFormat('%H:%M')(d.timeRange.end)}</div>
    `);

    tooltip
      .style('left', (event.pageX + 10) + 'px')
      .style('top', (event.pageY - 10) + 'px');
  }, []);

  const hideTooltip = useCallback(() => {
    d3.selectAll('.timeline-tooltip, .anomaly-tooltip').remove();
  }, []);

  return (
    <div ref={containerRef} className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      {/* Header with metric selector */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-900">Traffic Timeline</h3>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-600">Metric:</label>
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value as keyof TimelineDataPoint)}
            className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="totalBytes">Traffic Volume (Bytes)</option>
            <option value="totalPackets">Packet Count</option>
            <option value="acceptedConnections">Accepted Connections</option>
            <option value="rejectedConnections">Rejected Connections</option>
            <option value="uniqueSourceIPs">Unique Source IPs</option>
            <option value="uniqueDestinationIPs">Unique Destination IPs</option>
          </select>
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="overflow-visible"
        />
        
        {processedData.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-75 rounded">
            <div className="text-center">
              <div className="text-gray-500 text-sm">No timeline data available</div>
              <div className="text-gray-400 text-xs mt-1">Load flow log data to see traffic patterns</div>
            </div>
          </div>
        )}
      </div>

      {/* Time range selection info */}
      {brushSelection && (
        <div className="mt-2 text-xs text-gray-600">
          Selected range: {d3.timeFormat('%H:%M')(brushSelection[0])} - {d3.timeFormat('%H:%M')(brushSelection[1])}
          <button
            onClick={() => {
              setBrushSelection(null);
              d3.select(svgRef.current).select('.brush').call(d3.brushX().clear);
            }}
            className="ml-2 text-blue-600 hover:text-blue-800 underline"
          >
            Clear
          </button>
        </div>
      )}

      {/* Anomaly summary */}
      {anomalies.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="text-xs text-gray-600 mb-1">
            Anomalies detected: {anomalies.length}
          </div>
          <div className="flex flex-wrap gap-1">
            {anomalies.slice(0, 5).map((anomaly, index) => (
              <span
                key={index}
                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium cursor-pointer ${
                  getAnomalySeverityClass(anomaly.severity)
                }`}
                onClick={() => onAnomalyClick?.(anomaly)}
                title={anomaly.description}
              >
                {anomaly.type}
              </span>
            ))}
            {anomalies.length > 5 && (
              <span className="text-xs text-gray-500">+{anomalies.length - 5} more</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Utility functions
function getMetricColor(metric: keyof TimelineDataPoint): string {
  const colors = {
    totalBytes: '#3B82F6',
    totalPackets: '#10B981',
    acceptedConnections: '#22C55E',
    rejectedConnections: '#EF4444',
    uniqueSourceIPs: '#8B5CF6',
    uniqueDestinationIPs: '#F59E0B'
  };
  return colors[metric] || '#6B7280';
}

function getMetricLabel(metric: keyof TimelineDataPoint): string {
  const labels = {
    totalBytes: 'Traffic Volume (Bytes)',
    totalPackets: 'Packet Count',
    acceptedConnections: 'Accepted Connections',
    rejectedConnections: 'Rejected Connections',
    uniqueSourceIPs: 'Unique Source IPs',
    uniqueDestinationIPs: 'Unique Destination IPs'
  };
  return labels[metric] || metric;
}

function formatMetricValue(value: number, metric: keyof TimelineDataPoint): string {
  if (metric === 'totalBytes') {
    return formatBytes(value);
  }
  return value.toLocaleString();
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getAnomalySeverityColor(severity: number | string): string {
  if (typeof severity === 'string') {
    const severityMap = { low: 0.2, medium: 0.5, high: 0.7, critical: 0.9 };
    severity = severityMap[severity as keyof typeof severityMap] || 0.5;
  }
  
  if (severity > 0.8) return '#DC2626'; // Red
  if (severity > 0.6) return '#EA580C'; // Orange
  if (severity > 0.4) return '#D97706'; // Amber
  return '#65A30D'; // Yellow-green
}

function getAnomalySeverityClass(severity: number | string): string {
  if (typeof severity === 'string') {
    const classMap = {
      low: 'bg-yellow-100 text-yellow-800',
      medium: 'bg-orange-100 text-orange-800',
      high: 'bg-red-100 text-red-800',
      critical: 'bg-red-200 text-red-900'
    };
    return classMap[severity as keyof typeof classMap] || 'bg-gray-100 text-gray-800';
  }
  
  if (severity > 0.8) return 'bg-red-200 text-red-900';
  if (severity > 0.6) return 'bg-red-100 text-red-800';
  if (severity > 0.4) return 'bg-orange-100 text-orange-800';
  return 'bg-yellow-100 text-yellow-800';
}