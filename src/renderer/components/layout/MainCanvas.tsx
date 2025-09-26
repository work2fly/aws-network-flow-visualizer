import React from 'react';

export interface MainCanvasProps {
  children: React.ReactNode;
}

export const MainCanvas: React.FC<MainCanvasProps> = ({ children }) => {
  return (
    <div className="flex-1 bg-gray-50 overflow-hidden">
      <div className="h-full flex flex-col">
        {/* Canvas Content */}
        <div className="flex-1 relative">
          {children}
        </div>
      </div>
    </div>
  );
};