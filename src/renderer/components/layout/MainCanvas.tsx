import React from 'react';

export interface MainCanvasProps {
  children: React.ReactNode;
}

export const MainCanvas: React.FC<MainCanvasProps> = ({ children }) => {
  return (
    <div className="flex-1 bg-gray-50 overflow-auto">
      <div className="h-full flex flex-col">
        {/* Canvas Content */}
        <div className="flex-1 relative p-4">
          <div className="max-w-4xl mx-auto">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};