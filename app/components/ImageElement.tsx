'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ImageElement as ImageElementType } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface ImageElementProps {
  image: ImageElementType;
  isSelected: boolean;
  isSingleSelected?: boolean; // 是否為唯一選取的項目
  isMultiSelected?: boolean; // 是否為多選狀態
  isPreviewSelected?: boolean; // 框選預覽狀態
  isConnecting?: boolean; // 是否正在連接模式
  isConnectTarget?: boolean; // 是否為可連接目標
  isHoveredForConnection?: boolean; // 是否為連接懸停目標
  zoomLevel: number;
  panOffset: { x: number; y: number };
  onSelect: () => void;
  onUpdatePosition: (x: number, y: number) => void;
  onUpdateSize: (width: number, height: number) => void;
  onDelete: () => void;
  onStartConnection?: () => void; // 開始連接
  onCreateGroup?: () => void; // 建立群組
  onUngroupImages?: () => void; // 取消群組
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onStartDrag?: () => void;
  onEndDrag?: () => void;
  viewportToLogical?: (viewportX: number, viewportY: number) => { x: number; y: number };
}

const ImageElementComponent: React.FC<ImageElementProps> = ({
  image,
  isSelected,
  isSingleSelected = false,
  isMultiSelected = false,
  isPreviewSelected = false,
  isConnecting = false,
  isConnectTarget = false,
  isHoveredForConnection = false,
  zoomLevel,
  panOffset,
  onSelect,
  onUpdatePosition,
  onUpdateSize,
  onDelete,
  onStartConnection,
  onCreateGroup,
  onUngroupImages,
  onMouseEnter,
  onMouseLeave,
  onStartDrag,
  onEndDrag,
  viewportToLogical
}) => {
  const { isDarkMode } = useTheme();
  const nodeRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [imageError, setImageError] = useState(false);
  
  // 拖曳狀態（參考 StickyNote 的實作）
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    startX: number;
    startY: number;
    initialImageX: number;
    initialImageY: number;
  } | null>(null);
  
  // Log when component mounts or image changes
  useEffect(() => {
    console.log('ImageElement rendered:', {
      id: image.id,
      filename: image.filename,
      urlType: image.url.startsWith('data:') ? 'base64' : 'url',
      urlLength: image.url.length,
      position: { x: image.x, y: image.y },
      size: { width: image.width, height: image.height }
    });
    
    // Check if URL is invalid placeholder
    if (image.url === '[LOCAL_IMAGE]') {
      console.error('Invalid image URL: [LOCAL_IMAGE] placeholder detected');
      setImageError(true);
    }
  }, [image]);

  // Handle context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowContextMenu(true);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    const handleClickOutside = () => setShowContextMenu(false);
    if (showContextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showContextMenu]);

  // 全域滑鼠移動處理（參考 StickyNote 的拖曳實作）
  useEffect(() => {
    if (!dragState || !viewportToLogical) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!dragState.isDragging) {
        // 檢查是否超過拖曳閾值
        const dx = e.clientX - dragState.startX;
        const dy = e.clientY - dragState.startY;
        if (Math.hypot(dx, dy) > 5) {
          setDragState(prev => prev ? { ...prev, isDragging: true } : null);
          // 觸發拖曳開始事件
          if (onStartDrag) {
            onStartDrag();
          }
        }
        return;
      }

      // 計算位移
      const currentPos = viewportToLogical(e.clientX, e.clientY);
      const startPos = viewportToLogical(dragState.startX, dragState.startY);
      
      const deltaX = currentPos.x - startPos.x;
      const deltaY = currentPos.y - startPos.y;
      
      // 移動圖片
      const newX = dragState.initialImageX + deltaX;
      const newY = dragState.initialImageY + deltaY;
      onUpdatePosition(newX, newY);
    };

    const handleGlobalMouseUp = () => {
      const wasDragging = dragState.isDragging;
      setDragState(null);
      
      // 如果正在拖曳，觸發拖曳結束事件
      if (wasDragging && onEndDrag) {
        onEndDrag();
      }
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [dragState, viewportToLogical, onUpdatePosition, onStartDrag, onEndDrag]);

  // 調整大小狀態
  const [resizeState, setResizeState] = useState<{
    isResizing: boolean;
    direction: 'se' | 'sw' | 'ne' | 'nw';
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    initialWidth: number;
    initialHeight: number;
  } | null>(null);

  // 全域調整大小處理（參考 StickyNote 的實作）
  useEffect(() => {
    if (!resizeState) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!resizeState.isResizing) return;

      // 計算視窗座標的位移
      const deltaX = e.clientX - resizeState.startX;
      const deltaY = e.clientY - resizeState.startY;
      
      // 將視窗座標的位移轉換為邏輯座標的位移（考慮縮放）
      const logicalDeltaX = deltaX / zoomLevel;
      const logicalDeltaY = deltaY / zoomLevel;
      
      let newX = resizeState.initialX;
      let newY = resizeState.initialY;
      let newWidth = resizeState.initialWidth;
      let newHeight = resizeState.initialHeight;
      
      // 保持圖片比例
      const aspectRatio = resizeState.initialWidth / resizeState.initialHeight;
      
      // 根據方向計算新的位置和尺寸
      switch (resizeState.direction) {
        case 'se': // 右下
          newWidth = Math.max(100, resizeState.initialWidth + logicalDeltaX);
          newHeight = newWidth / aspectRatio;
          break;
        case 'sw': // 左下
          newX = resizeState.initialX + logicalDeltaX;
          newWidth = Math.max(100, resizeState.initialWidth - logicalDeltaX);
          newHeight = newWidth / aspectRatio;
          break;
        case 'ne': // 右上
          newY = resizeState.initialY + logicalDeltaY;
          newHeight = Math.max(100, resizeState.initialHeight - logicalDeltaY);
          newWidth = newHeight * aspectRatio;
          break;
        case 'nw': // 左上
          newX = resizeState.initialX + logicalDeltaX;
          newY = resizeState.initialY + logicalDeltaY;
          const minDelta = Math.min(-logicalDeltaX, -logicalDeltaY);
          newWidth = Math.max(100, resizeState.initialWidth + minDelta);
          newHeight = newWidth / aspectRatio;
          break;
      }
      
      // 限制最大尺寸
      const maxSize = 800;
      if (newWidth > maxSize) {
        newWidth = maxSize;
        newHeight = newWidth / aspectRatio;
      }
      
      onUpdatePosition(newX, newY);
      onUpdateSize(newWidth, newHeight);
    };

    const handleGlobalMouseUp = () => {
      setResizeState(null);
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [resizeState, onUpdatePosition, onUpdateSize, zoomLevel]);

  // 開始調整大小
  const handleResizeStart = (e: React.MouseEvent, direction: 'se' | 'sw' | 'ne' | 'nw') => {
    e.preventDefault();
    e.stopPropagation();
    
    setResizeState({
      isResizing: true,
      direction,
      startX: e.clientX,
      startY: e.clientY,
      initialX: image.x,
      initialY: image.y,
      initialWidth: image.width,
      initialHeight: image.height
    });
    
    setIsResizing(true);
    onSelect();
  };

  return (
    <>
      <div
        ref={nodeRef}
        className={`image-element absolute select-none ${
          (isSelected || isPreviewSelected) ? 'z-20' : 'z-10'
        } ${dragState?.isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{
          left: `${image.x}px`,
          top: `${image.y}px`,
          width: `${image.width}px`,
          height: `${image.height}px`,
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onContextMenu={handleContextMenu}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onMouseDown={(e) => {
          if (e.button !== 0) return; // 只處理左鍵
          if (isResizing) return; // 調整大小時不處理拖曳
          if (!viewportToLogical) return; // 需要轉換函數
          
          e.preventDefault();
          e.stopPropagation();
          
          // 開始拖曳狀態
          setDragState({
            isDragging: false,
            startX: e.clientX,
            startY: e.clientY,
            initialImageX: image.x,
            initialImageY: image.y
          });
          
          // 選中圖片
          onSelect();
        }}
      >
          {/* Image */}
          <div 
            className={`w-full h-full rounded-lg overflow-hidden shadow-lg transition-all ${
              dragState?.isDragging
                ? 'cursor-grabbing border-2 border-blue-500 opacity-80'
                : isConnecting 
                ? `shadow-xl ring-2 ${
                    isDarkMode ? 'border-green-400 ring-green-400/30' : 'border-green-500 ring-green-300'
                  }` 
                : isHoveredForConnection
                ? `shadow-xl ring-2 cursor-pointer ${
                    isDarkMode ? 'border-purple-900 ring-purple-900/20' : 'border-purple-500 ring-purple-300'
                  }`
                : isSelected 
                ? `shadow-xl ring-2 ${
                    isDarkMode ? 'ring-blue-400 border-blue-400' : 'ring-blue-500 border-blue-500'
                  }` 
                : isPreviewSelected
                ? `shadow-lg ring-2 ring-dashed ${
                    isDarkMode ? 'ring-blue-400 border-blue-400' : 'ring-blue-300 border-blue-300'
                  }`
                : isDarkMode 
                ? 'ring-1 ring-gray-600'
                : 'ring-1 ring-gray-300'
            }`}
          >
            {!imageError ? (
              <img
                src={image.url}
                alt={image.filename || 'Uploaded image'}
                className="w-full h-full object-contain bg-white"
                onError={() => setImageError(true)}
                draggable={false}
              />
            ) : (
              <div className={`w-full h-full flex items-center justify-center ${
                isDarkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'
              }`}>
                <div className="text-center p-4">
                  <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
                    />
                  </svg>
                  <p className="text-sm">圖片載入失敗</p>
                </div>
              </div>
            )}
          </div>

          {/* 連接點 */}
          {isSelected && isSingleSelected && !isResizing && (
            <>
              {/* 上方連接點 */}
              <div
                className="absolute -top-10 left-1/2 transform -translate-x-1/2 w-12 h-12 cursor-pointer flex items-center justify-center group"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onStartConnection?.();
                }}
                title="開始連接"
              >
                <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-md group-hover:bg-green-600 group-hover:scale-150 transition-all duration-200" />
              </div>
              
              {/* 右方連接點 */}
              <div
                className="absolute -right-10 top-1/2 transform -translate-y-1/2 w-12 h-12 cursor-pointer flex items-center justify-center group"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onStartConnection?.();
                }}
                title="開始連接"
              >
                <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-md group-hover:bg-green-600 group-hover:scale-150 transition-all duration-200" />
              </div>
              
              {/* 下方連接點 */}
              <div
                className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 w-12 h-12 cursor-pointer flex items-center justify-center group"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onStartConnection?.();
                }}
                title="開始連接"
              >
                <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-md group-hover:bg-green-600 group-hover:scale-150 transition-all duration-200" />
              </div>
              
              {/* 左方連接點 */}
              <div
                className="absolute -left-10 top-1/2 transform -translate-y-1/2 w-12 h-12 cursor-pointer flex items-center justify-center group"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onStartConnection?.();
                }}
                title="開始連接"
              >
                <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-md group-hover:bg-green-600 group-hover:scale-150 transition-all duration-200" />
              </div>
            </>
          )}

          {/* Resize handles */}
          {isSelected && isSingleSelected && (
            <>
              {/* Southeast */}
              <div
                className="resize-handle absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-full cursor-se-resize hover:scale-125 transition-transform"
                onMouseDown={(e) => handleResizeStart(e, 'se')}
              />
              {/* Southwest */}
              <div
                className="resize-handle absolute -bottom-1 -left-1 w-3 h-3 bg-blue-500 rounded-full cursor-sw-resize hover:scale-125 transition-transform"
                onMouseDown={(e) => handleResizeStart(e, 'sw')}
              />
              {/* Northeast */}
              <div
                className="resize-handle absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full cursor-ne-resize hover:scale-125 transition-transform"
                onMouseDown={(e) => handleResizeStart(e, 'ne')}
              />
              {/* Northwest */}
              <div
                className="resize-handle absolute -top-1 -left-1 w-3 h-3 bg-blue-500 rounded-full cursor-nw-resize hover:scale-125 transition-transform"
                onMouseDown={(e) => handleResizeStart(e, 'nw')}
              />
            </>
          )}

          {/* Filename badge */}
          {isSelected && image.filename && (
            <div className={`absolute -top-8 left-0 px-2 py-1 rounded text-xs truncate max-w-full ${
              isDarkMode 
                ? 'bg-gray-800 text-gray-300' 
                : 'bg-gray-900 text-white'
            }`}>
              {image.filename}
            </div>
          )}
      </div>

      {/* Context Menu */}
      {showContextMenu && (
        <div
          className={`fixed z-50 py-2 rounded-lg shadow-lg min-w-48 ${
            isDarkMode 
              ? 'bg-dark-bg-secondary border border-gray-700' 
              : 'bg-white border border-gray-200'
          }`}
          style={{
            left: `${contextMenuPosition.x}px`,
            top: `${contextMenuPosition.y}px`,
          }}
        >
          <button
            onClick={() => {
              // Copy image URL to clipboard
              navigator.clipboard.writeText(image.url);
              setShowContextMenu(false);
            }}
            className={`w-full px-4 py-2 text-left text-sm ${
              isDarkMode 
                ? 'hover:bg-dark-bg-tertiary text-gray-300' 
                : 'hover:bg-gray-50 text-gray-700'
            }`}
          >
            複製圖片連結
          </button>
          <button
            onClick={() => {
              // Open image in new tab
              window.open(image.url, '_blank');
              setShowContextMenu(false);
            }}
            className={`w-full px-4 py-2 text-left text-sm ${
              isDarkMode 
                ? 'hover:bg-dark-bg-tertiary text-gray-300' 
                : 'hover:bg-gray-50 text-gray-700'
            }`}
          >
            在新分頁開啟
          </button>
          
          {/* 群組選項 */}
          {isMultiSelected && onCreateGroup && (
            <>
              <div className={`h-px ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
              <button
                onClick={() => {
                  onCreateGroup();
                  setShowContextMenu(false);
                }}
                className={`w-full px-4 py-2 text-left text-sm ${
                  isDarkMode 
                    ? 'hover:bg-indigo-900/30 text-indigo-400' 
                    : 'hover:bg-indigo-50 text-indigo-600'
                }`}
              >
                建立群組
              </button>
            </>
          )}
          
          {/* 如果圖片屬於群組，顯示取消群組選項 */}
          {image.groupId && onUngroupImages && (
            <>
              {!isMultiSelected && <div className={`h-px ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />}
              <button
                onClick={() => {
                  onUngroupImages();
                  setShowContextMenu(false);
                }}
                className={`w-full px-4 py-2 text-left text-sm ${
                  isDarkMode 
                    ? 'hover:bg-indigo-900/30 text-indigo-400' 
                    : 'hover:bg-indigo-50 text-indigo-600'
                }`}
              >
                取消群組
              </button>
            </>
          )}
          
          <div className={`h-px ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
          <button
            onClick={() => {
              onDelete();
              setShowContextMenu(false);
            }}
            className={`w-full px-4 py-2 text-left text-sm ${
              isDarkMode 
                ? 'hover:bg-red-900/30 text-red-400' 
                : 'hover:bg-red-50 text-red-600'
            }`}
          >
            刪除圖片
          </button>
        </div>
      )}
    </>
  );
};

export default ImageElementComponent;