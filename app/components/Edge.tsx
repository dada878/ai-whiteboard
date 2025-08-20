'use client';

import React, { useState } from 'react';
import { Edge, StickyNote, ImageElement } from '../types';

interface EdgeComponentProps {
  edge: Edge;
  notes: StickyNote[];
  images?: ImageElement[];
  isSelected?: boolean;
  onSelect?: () => void;
  onDelete?: () => void;
  onStartDragEndpoint?: (edgeId: string, endpoint: 'from' | 'to', currentTarget: string) => void;
}

const EdgeComponent: React.FC<EdgeComponentProps> = ({ 
  edge, 
  notes, 
  images = [],
  isSelected = false, 
  onSelect, 
  onDelete,
  onStartDragEndpoint
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredEndpoint, setHoveredEndpoint] = useState<'from' | 'to' | null>(null);
  
  // 查找起點和終點（可能是便利貼或圖片）
  const fromNote = notes.find(note => note.id === edge.from);
  const fromImage = images.find(img => img.id === edge.from);
  const toNote = notes.find(note => note.id === edge.to);
  const toImage = images.find(img => img.id === edge.to);

  const fromElement = fromNote || fromImage;
  const toElement = toNote || toImage;

  if (!fromElement || !toElement) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Delete' && isSelected) {
      onDelete?.();
    }
  };

  // 計算連線的起點和終點（統一處理便利貼和圖片）
  const fromX = fromElement.x + fromElement.width / 2;
  const fromY = fromElement.y + fromElement.height / 2;
  const toX = toElement.x + toElement.width / 2;
  const toY = toElement.y + toElement.height / 2;

  // 計算箭頭角度
  const angle = Math.atan2(toY - fromY, toX - fromX);
  
  // 計算到正方形邊緣的實際距離
  const getDistanceToEdge = (width: number, height: number, angle: number) => {
    const absAngle = Math.abs(angle);
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    
    // 計算射線與正方形邊緣的交點
    if (Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle))) {
      // 射線主要朝向水平方向，與左右邊相交
      return halfWidth / Math.abs(Math.cos(angle));
    } else {
      // 射線主要朝向垂直方向，與上下邊相交
      return halfHeight / Math.abs(Math.sin(angle));
    }
  };
  
  // 調整起點和終點位置，留出間距避免箭頭被遮擋
  const gap = 15; // 間距
  const fromDistance = getDistanceToEdge(fromElement.width, fromElement.height, angle) + gap;
  const toDistance = getDistanceToEdge(toElement.width, toElement.height, angle) + gap;
  
  const adjustedFromX = fromX + Math.cos(angle) * fromDistance;
  const adjustedFromY = fromY + Math.sin(angle) * fromDistance;
  const adjustedToX = toX - Math.cos(angle) * toDistance;
  const adjustedToY = toY - Math.sin(angle) * toDistance;
  

  // 箭頭大小和位置調整
  const arrowSize = 16;
  const arrowOffset = 8; // 讓箭頭再往前一點
  const arrowTipX = adjustedToX + Math.cos(angle) * arrowOffset;
  const arrowTipY = adjustedToY + Math.sin(angle) * arrowOffset;
  
  const arrowPoints = [
    [arrowTipX, arrowTipY], // 箭頭尖端
    [
      arrowTipX - arrowSize * Math.cos(angle - Math.PI / 6),
      arrowTipY - arrowSize * Math.sin(angle - Math.PI / 6)
    ],
    [
      arrowTipX - arrowSize * Math.cos(angle + Math.PI / 6),
      arrowTipY - arrowSize * Math.sin(angle + Math.PI / 6)
    ]
  ].map(point => point.join(',')).join(' ');

  // 動態顏色和寬度
  const strokeColor = isSelected ? '#EF4444' : isHovered ? '#6B7280' : '#374151';
  const strokeWidth = isSelected ? 4.9 : isHovered ? 4.2 : 3.5; // 70% 的原始粗細

  // 處理端點拖曳（立即開始拖曳，不需要移動閾值）
  const handleEndpointMouseDown = (e: React.MouseEvent, endpoint: 'from' | 'to') => {
    e.stopPropagation();
    e.preventDefault();
    
    // 立即開始拖曳，不需要檢查移動距離
    const currentTarget = endpoint === 'from' ? edge.from : edge.to;
    onStartDragEndpoint?.(edge.id, endpoint, currentTarget);
  };

  return (
    <g>
      {/* 可點擊的透明線條（增加點擊區域） */}
      <line
        x1={adjustedFromX}
        y1={adjustedFromY}
        x2={arrowTipX - Math.cos(angle) * (arrowSize * 0.7)}
        y2={arrowTipY - Math.sin(angle) * (arrowSize * 0.7)}
        stroke="transparent"
        strokeWidth="15"
        style={{ cursor: 'pointer' }}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />
      
      {/* 可見連線 */}
      <line
        x1={adjustedFromX}
        y1={adjustedFromY}
        x2={adjustedToX}
        y2={adjustedToY}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        style={{ 
          pointerEvents: 'none',
          transition: 'all 0.2s ease'
        }}
      />
      
      {/* 箭頭 */}
      <polygon
        points={arrowPoints}
        fill={strokeColor}
        style={{ 
          pointerEvents: 'none',
          transition: 'all 0.2s ease'
        }}
      />
      
      {/* 選中時的端點拖曳手柄 */}
      {isSelected && (
        <>
          {/* From 端點 */}
          <g
            onMouseDown={(e) => handleEndpointMouseDown(e, 'from')}
            onMouseEnter={() => setHoveredEndpoint('from')}
            onMouseLeave={() => setHoveredEndpoint(null)}
            style={{ cursor: 'move' }}
          >
            {/* 增大的點擊區域 */}
            <circle
              cx={adjustedFromX}
              cy={adjustedFromY}
              r="24"
              fill="transparent"
              stroke="transparent"
            />
            {/* 陰影效果 */}
            {hoveredEndpoint === 'from' && (
              <circle
                cx={adjustedFromX}
                cy={adjustedFromY}
                r="16"
                fill="#3B82F6"
                fillOpacity="0.2"
                style={{
                  transition: 'all 0.2s ease'
                }}
              />
            )}
            {/* 主要端點 */}
            <circle
              cx={adjustedFromX}
              cy={adjustedFromY}
              r={hoveredEndpoint === 'from' ? 12 : 8}
              fill="#3B82F6"
              stroke="white"
              strokeWidth="2"
              style={{
                transition: 'all 0.2s ease',
                filter: hoveredEndpoint === 'from' ? 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))' : 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))'
              }}
            />
          </g>
          
          {/* To 端點 */}
          <g
            onMouseDown={(e) => handleEndpointMouseDown(e, 'to')}
            onMouseEnter={() => setHoveredEndpoint('to')}
            onMouseLeave={() => setHoveredEndpoint(null)}
            style={{ cursor: 'move' }}
          >
            {/* 增大的點擊區域 */}
            <circle
              cx={adjustedToX}
              cy={adjustedToY}
              r="24"
              fill="transparent"
              stroke="transparent"
            />
            {/* 陰影效果 */}
            {hoveredEndpoint === 'to' && (
              <circle
                cx={adjustedToX}
                cy={adjustedToY}
                r="16"
                fill="#3B82F6"
                fillOpacity="0.2"
                style={{
                  transition: 'all 0.2s ease'
                }}
              />
            )}
            {/* 主要端點 */}
            <circle
              cx={adjustedToX}
              cy={adjustedToY}
              r={hoveredEndpoint === 'to' ? 12 : 8}
              fill="#3B82F6"
              stroke="white"
              strokeWidth="2"
              style={{
                transition: 'all 0.2s ease',
                filter: hoveredEndpoint === 'to' ? 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))' : 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))'
              }}
            />
          </g>
        </>
      )}
      
      {/* 選中時的中點刪除按鈕 */}
      {isSelected && (
        <g 
          style={{ pointerEvents: 'all' }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onMouseUp={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete?.();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete?.();
          }}
        >
          {/* 增大點擊區域的透明圓 */}
          <circle
            cx={(adjustedFromX + adjustedToX) / 2}
            cy={(adjustedFromY + adjustedToY) / 2}
            r="15"
            fill="transparent"
            stroke="transparent"
            style={{ cursor: 'pointer' }}
          />
          {/* 可見的刪除按鈕 */}
          <circle
            cx={(adjustedFromX + adjustedToX) / 2}
            cy={(adjustedFromY + adjustedToY) / 2}
            r="10"
            fill="#EF4444"
            stroke="white"
            strokeWidth="2"
            style={{ pointerEvents: 'none' }}
          />
          <text
            x={(adjustedFromX + adjustedToX) / 2}
            y={(adjustedFromY + adjustedToY) / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fill="white"
            fontSize="12"
            fontWeight="bold"
            style={{ 
              pointerEvents: 'none',
              userSelect: 'none'
            }}
          >
            ×
          </text>
        </g>
      )}
    </g>
  );
};

export default EdgeComponent;