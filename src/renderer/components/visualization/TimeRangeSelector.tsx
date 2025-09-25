import React, { useState, useCallback } from 'react';

interface TimeRangePreset {
    label: string;
    value: string;
    getRange: () => { start: Date; end: Date };
}

interface TimeRangeSelectorProps {
    selectedRange?: { start: Date; end: Date };
    onRangeChange: (range: { start: Date; end: Date }) => void;
    className?: string;
}

export const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
    selectedRange,
    onRangeChange,
    className = ''
}) => {
    const [selectedPreset, setSelectedPreset] = useState<string>('last1h');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [isCustomMode, setIsCustomMode] = useState(false);

    const presets: TimeRangePreset[] = [
        {
            label: 'Last 15 minutes',
            value: 'last15m',
            getRange: () => {
                const end = new Date();
                const start = new Date(end.getTime() - 15 * 60 * 1000);
                return { start, end };
            }
        },
        {
            label: 'Last 1 hour',
            value: 'last1h',
            getRange: () => {
                const end = new Date();
                const start = new Date(end.getTime() - 60 * 60 * 1000);
                return { start, end };
            }
        },
        {
            label: 'Last 6 hours',
            value: 'last6h',
            getRange: () => {
                const end = new Date();
                const start = new Date(end.getTime() - 6 * 60 * 60 * 1000);
                return { start, end };
            }
        },
        {
            label: 'Last 24 hours',
            value: 'last24h',
            getRange: () => {
                const end = new Date();
                const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
                return { start, end };
            }
        },
        {
            label: 'Last 7 days',
            value: 'last7d',
            getRange: () => {
                const end = new Date();
                const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
                return { start, end };
            }
        },
        {
            label: 'Today',
            value: 'today',
            getRange: () => {
                const now = new Date();
                const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
                return { start, end };
            }
        },
        {
            label: 'Yesterday',
            value: 'yesterday',
            getRange: () => {
                const now = new Date();
                const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
                const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
                return { start, end };
            }
        },
        {
            label: 'This week',
            value: 'thisweek',
            getRange: () => {
                const now = new Date();
                const dayOfWeek = now.getDay();
                const start = new Date(now.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
                start.setHours(0, 0, 0, 0);
                const end = new Date();
                return { start, end };
            }
        }
    ];

    const handlePresetChange = useCallback((presetValue: string) => {
        setSelectedPreset(presetValue);
        setIsCustomMode(false);

        const preset = presets.find(p => p.value === presetValue);
        if (preset) {
            const range = preset.getRange();
            onRangeChange(range);
        }
    }, [onRangeChange, presets]);

    const handleCustomRangeApply = useCallback(() => {
        if (!customStart || !customEnd) return;

        const start = new Date(customStart);
        const end = new Date(customEnd);

        if (start >= end) {
            alert('Start time must be before end time');
            return;
        }

        onRangeChange({ start, end });
    }, [customStart, customEnd, onRangeChange]);

    const formatDateTime = useCallback((date: Date) => {
        return date.toISOString().slice(0, 16); // Format for datetime-local input
    }, []);

    const formatDisplayDate = useCallback((date: Date) => {
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).format(date);
    }, []);

    // Initialize custom inputs when switching to custom mode
    const handleCustomModeToggle = useCallback(() => {
        if (!isCustomMode) {
            const now = new Date();
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
            setCustomStart(formatDateTime(oneHourAgo));
            setCustomEnd(formatDateTime(now));
        }
        setIsCustomMode(!isCustomMode);
    }, [isCustomMode, formatDateTime]);

    return (
        <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-900">Time Range</h3>
                <button
                    onClick={handleCustomModeToggle}
                    className={`text-xs px-2 py-1 rounded transition-colors ${isCustomMode
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}
                >
                    {isCustomMode ? 'Presets' : 'Custom'}
                </button>
            </div>

            {!isCustomMode ? (
                // Preset mode
                <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        {presets.map(preset => (
                            <button
                                key={preset.value}
                                onClick={() => handlePresetChange(preset.value)}
                                className={`text-xs px-3 py-2 rounded border transition-colors text-left ${selectedPreset === preset.value
                                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                                    }`}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                // Custom mode
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                            Start Time
                        </label>
                        <input
                            type="datetime-local"
                            value={customStart}
                            onChange={(e) => setCustomStart(e.target.value)}
                            className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                            End Time
                        </label>
                        <input
                            type="datetime-local"
                            value={customEnd}
                            onChange={(e) => setCustomEnd(e.target.value)}
                            className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    <button
                        onClick={handleCustomRangeApply}
                        disabled={!customStart || !customEnd}
                        className="w-full text-xs px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                        Apply Range
                    </button>
                </div>
            )}

            {/* Current selection display */}
            {selectedRange && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="text-xs text-gray-600">
                        <div className="font-medium mb-1">Current Selection:</div>
                        <div className="space-y-1">
                            <div>From: {formatDisplayDate(selectedRange.start)}</div>
                            <div>To: {formatDisplayDate(selectedRange.end)}</div>
                            <div className="text-gray-500">
                                Duration: {formatDuration(selectedRange.end.getTime() - selectedRange.start.getTime())}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick actions */}
            <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            const now = new Date();
                            onRangeChange({ start: now, end: now });
                        }}
                        className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                        title="Set to current time"
                    >
                        Now
                    </button>
                    <button
                        onClick={() => {
                            const preset = presets.find(p => p.value === 'last1h');
                            if (preset) {
                                handlePresetChange('last1h');
                            }
                        }}
                        className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                        title="Reset to last hour"
                    >
                        Reset
                    </button>
                </div>
            </div>
        </div>
    );
};

// Utility function to format duration
function formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}