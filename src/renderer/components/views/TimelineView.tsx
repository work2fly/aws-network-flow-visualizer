import React from 'react';

export const TimelineView: React.FC = () => {
  return (
    <div className="h-full flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Timeline View</h3>
        <p className="text-gray-600 max-w-md">
          Traffic timeline and temporal analysis will be displayed here.
          View traffic patterns over time and identify trends.
        </p>
      </div>
    </div>
  );
};