'use client';

import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface AlignmentGuide {
  type: 'horizontal' | 'vertical';
  position: number;
  start: number;
  end: number;
}

interface AlignmentGuidesProps {
  guides: AlignmentGuide[];
  zoomLevel: number;
  panOffset: { x: number; y: number };
}

const AlignmentGuides: React.FC<AlignmentGuidesProps> = ({ guides, zoomLevel, panOffset }) => {
  const { isDarkMode } = useTheme();
  
  return (
    <svg 
      className="absolute inset-0 pointer-events-none z-30"
      style={{ 
        width: '100%', 
        height: '100%',
        overflow: 'visible'
      }}
    >
      {guides.map((guide, index) => {
        if (guide.type === 'horizontal') {
          // 水平輔助線
          const y = guide.position * zoomLevel + panOffset.y;
          const x1 = guide.start * zoomLevel + panOffset.x;
          const x2 = guide.end * zoomLevel + panOffset.x;
          
          return (
            <g key={`h-${index}`}>
              <line
                x1={x1}
                y1={y}
                x2={x2}
                y2={y}
                stroke={isDarkMode ? '#60A5FA' : '#3B82F6'}
                strokeWidth="1"
                strokeDasharray="4,4"
                opacity="0.8"
              />
              {/* 中心點標記 */}
              <circle
                cx={(x1 + x2) / 2}
                cy={y}
                r="3"
                fill={isDarkMode ? '#60A5FA' : '#3B82F6'}
                opacity="0.8"
              />
            </g>
          );
        } else {
          // 垂直輔助線
          const x = guide.position * zoomLevel + panOffset.x;
          const y1 = guide.start * zoomLevel + panOffset.y;
          const y2 = guide.end * zoomLevel + panOffset.y;
          
          return (
            <g key={`v-${index}`}>
              <line
                x1={x}
                y1={y1}
                x2={x}
                y2={y2}
                stroke={isDarkMode ? '#60A5FA' : '#3B82F6'}
                strokeWidth="1"
                strokeDasharray="4,4"
                opacity="0.8"
              />
              {/* 中心點標記 */}
              <circle
                cx={x}
                cy={(y1 + y2) / 2}
                r="3"
                fill={isDarkMode ? '#60A5FA' : '#3B82F6'}
                opacity="0.8"
              />
            </g>
          );
        }
      })}
    </svg>
  );
};

export default AlignmentGuides;