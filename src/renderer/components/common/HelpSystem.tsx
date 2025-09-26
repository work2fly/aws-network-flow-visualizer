import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

// Tooltip component
export interface TooltipProps {
  content: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  trigger?: 'hover' | 'click' | 'focus';
  delay?: number;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  position = 'top',
  trigger = 'hover',
  delay = 200,
  disabled = false,
  className = '',
  children
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const showTooltip = () => {
    if (disabled) return;
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      updatePosition();
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  const updatePosition = () => {
    if (!triggerRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipElement = tooltipRef.current;
    
    if (!tooltipElement) return;

    const tooltipRect = tooltipElement.getBoundingClientRect();
    let x = 0;
    let y = 0;

    switch (position) {
      case 'top':
        x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        y = triggerRect.top - tooltipRect.height - 8;
        break;
      case 'bottom':
        x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        y = triggerRect.bottom + 8;
        break;
      case 'left':
        x = triggerRect.left - tooltipRect.width - 8;
        y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        break;
      case 'right':
        x = triggerRect.right + 8;
        y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        break;
    }

    // Keep tooltip within viewport
    const padding = 8;
    x = Math.max(padding, Math.min(x, window.innerWidth - tooltipRect.width - padding));
    y = Math.max(padding, Math.min(y, window.innerHeight - tooltipRect.height - padding));

    setTooltipPosition({ x, y });
  };

  useEffect(() => {
    if (isVisible) {
      updatePosition();
      window.addEventListener('scroll', updatePosition);
      window.addEventListener('resize', updatePosition);
      
      return () => {
        window.removeEventListener('scroll', updatePosition);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isVisible]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const triggerProps: any = {};
  
  if (trigger === 'hover') {
    triggerProps.onMouseEnter = showTooltip;
    triggerProps.onMouseLeave = hideTooltip;
  } else if (trigger === 'click') {
    triggerProps.onClick = () => isVisible ? hideTooltip() : showTooltip();
  } else if (trigger === 'focus') {
    triggerProps.onFocus = showTooltip;
    triggerProps.onBlur = hideTooltip;
  }

  const getArrowClasses = () => {
    const baseClasses = 'absolute w-2 h-2 bg-gray-900 transform rotate-45';
    switch (position) {
      case 'top':
        return `${baseClasses} -bottom-1 left-1/2 -translate-x-1/2`;
      case 'bottom':
        return `${baseClasses} -top-1 left-1/2 -translate-x-1/2`;
      case 'left':
        return `${baseClasses} -right-1 top-1/2 -translate-y-1/2`;
      case 'right':
        return `${baseClasses} -left-1 top-1/2 -translate-y-1/2`;
      default:
        return baseClasses;
    }
  };

  return (
    <>
      <div
        ref={triggerRef}
        className={`inline-block ${className}`}
        {...triggerProps}
      >
        {children}
      </div>
      
      {isVisible && createPortal(
        <div
          ref={tooltipRef}
          className="fixed z-50 px-3 py-2 text-sm text-white bg-gray-900 rounded-md shadow-lg max-w-xs pointer-events-none"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
          }}
        >
          {content}
          <div className={getArrowClasses()} />
        </div>,
        document.body
      )}
    </>
  );
};

// Help icon with tooltip
export interface HelpIconProps {
  content: React.ReactNode;
  position?: TooltipProps['position'];
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const HelpIcon: React.FC<HelpIconProps> = ({
  content,
  position = 'top',
  size = 'md',
  className = ''
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  return (
    <Tooltip content={content} position={position}>
      <div className={`inline-flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-help ${className}`}>
        <svg className={sizeClasses[size]} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
      </div>
    </Tooltip>
  );
};

// Help panel component
export interface HelpPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const HelpPanel: React.FC<HelpPanelProps> = ({
  isOpen,
  onClose,
  title = 'Help',
  children
}) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-96 bg-white shadow-xl">
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

// Contextual help component
export interface ContextualHelpProps {
  topic: string;
  className?: string;
}

export const ContextualHelp: React.FC<ContextualHelpProps> = ({ topic, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);

  const getHelpContent = (topic: string) => {
    const helpContent: Record<string, React.ReactNode> = {
      'aws-authentication': (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900">AWS Authentication</h3>
          <div className="space-y-3 text-sm text-gray-700">
            <p>
              The application supports multiple AWS authentication methods:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong>AWS SSO:</strong> Recommended for enterprise users. Provides secure, temporary credentials.</li>
              <li><strong>Named Profiles:</strong> Uses AWS CLI configuration files (~/.aws/config and ~/.aws/credentials).</li>
              <li><strong>IAM Roles:</strong> Assume roles for cross-account access or elevated permissions.</li>
            </ul>
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <p className="text-yellow-800">
                <strong>Security Note:</strong> Long-term access keys are discouraged. Use SSO or temporary credentials when possible.
              </p>
            </div>
          </div>
        </div>
      ),
      'flow-log-queries': (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900">Flow Log Queries</h3>
          <div className="space-y-3 text-sm text-gray-700">
            <p>
              Query CloudWatch Insights for VPC and Transit Gateway flow logs:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Select appropriate time range for your analysis</li>
              <li>Use filters to narrow down results (IP ranges, ports, protocols)</li>
              <li>Monitor query progress and costs in the status bar</li>
            </ul>
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-blue-800">
                <strong>Tip:</strong> Start with shorter time ranges to avoid large query costs and long processing times.
              </p>
            </div>
          </div>
        </div>
      ),
      'network-visualization': (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900">Network Visualization</h3>
          <div className="space-y-3 text-sm text-gray-700">
            <p>
              Interactive network topology features:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong>Zoom:</strong> Mouse wheel or pinch gestures</li>
              <li><strong>Pan:</strong> Click and drag on empty space</li>
              <li><strong>Select:</strong> Click on nodes or edges for details</li>
              <li><strong>Search:</strong> Use the search panel to find specific resources</li>
            </ul>
            <p>
              Node colors and edge thickness represent traffic volume and connection health.
            </p>
          </div>
        </div>
      ),
      'filtering': (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900">Filtering and Search</h3>
          <div className="space-y-3 text-sm text-gray-700">
            <p>
              Filter network flows by various criteria:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong>IP Ranges:</strong> CIDR notation (e.g., 10.0.0.0/16)</li>
              <li><strong>Ports:</strong> Single ports or ranges (e.g., 80, 443, 8000-9000)</li>
              <li><strong>Protocols:</strong> TCP, UDP, ICMP</li>
              <li><strong>Time Range:</strong> Custom or preset ranges</li>
            </ul>
            <p>
              Filters are applied in real-time and update statistics automatically.
            </p>
          </div>
        </div>
      )
    };

    return helpContent[topic] || (
      <div className="text-sm text-gray-700">
        <p>Help content for "{topic}" is not available.</p>
      </div>
    );
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors ${className}`}
        title="Get help"
      >
        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
        Help
      </button>
      
      <HelpPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Help"
      >
        {getHelpContent(topic)}
      </HelpPanel>
    </>
  );
};

// Quick help component for keyboard shortcuts
export const KeyboardShortcuts: React.FC = () => {
  const shortcuts = [
    { key: 'Ctrl/Cmd + F', description: 'Search network resources' },
    { key: 'Ctrl/Cmd + R', description: 'Refresh data' },
    { key: 'Ctrl/Cmd + E', description: 'Export visualization' },
    { key: 'Ctrl/Cmd + S', description: 'Save configuration' },
    { key: 'Ctrl/Cmd + Z', description: 'Reset zoom' },
    { key: 'Escape', description: 'Clear selection/Close dialogs' },
    { key: 'Space', description: 'Fit to screen' },
    { key: '?', description: 'Show keyboard shortcuts' }
  ];

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900">Keyboard Shortcuts</h3>
      <div className="space-y-2">
        {shortcuts.map((shortcut, index) => (
          <div key={index} className="flex justify-between items-center text-sm">
            <span className="text-gray-700">{shortcut.description}</span>
            <kbd className="px-2 py-1 text-xs font-mono bg-gray-100 border border-gray-300 rounded">
              {shortcut.key}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  );
};