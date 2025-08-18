'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Group as GroupType } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface GroupComponentProps {
  group: GroupType;
  bounds: { x: number; y: number; width: number; height: number };
  isSelected: boolean;
  isDragHovered?: boolean; // 是否被拖曳懸停
  zoomLevel?: number;
  shouldAutoFocus?: boolean;
  onAutoFocusHandled?: () => void;
  onSelect: (isMultiSelect?: boolean) => void;
  onUpdateName: (name: string) => void;
  onUpdateColor: (color: string) => void;
  onUngroup: () => void;
  onDelete: () => void;
  onStartDrag?: (e: React.MouseEvent) => void;
  onCreateParentGroup?: () => void; // 創建父群組
  isChildGroup?: boolean; // 是否為子群組
  hasChildGroups?: boolean; // 是否有子群組
}

const GROUP_COLORS = [
  { color: '#E3F2FD', name: '淺藍' },
  { color: '#F3E5F5', name: '淺紫' },
  { color: '#E8F5E8', name: '淺綠' },
  { color: '#FFF3E0', name: '淺橙' },
  { color: '#FCE4EC', name: '淺粉' },
  { color: '#E8EAF6', name: '淺靛' },
  { color: '#FFF9C4', name: '淺黃' },
  { color: '#EFEBE9', name: '淺棕' }
];

const GroupComponent: React.FC<GroupComponentProps> = ({
  group,
  bounds,
  isSelected,
  isDragHovered = false,
  zoomLevel = 1,
  shouldAutoFocus = false,
  onAutoFocusHandled,
  onSelect,
  onUpdateName,
  onUpdateColor,
  onUngroup,
  onDelete,
  onStartDrag,
  onCreateParentGroup,
  isChildGroup = false,
  hasChildGroups = false
}) => {
  const { isDarkMode } = useTheme();
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(group.name);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  // Auto-focus effect for newly created groups
  useEffect(() => {
    if (shouldAutoFocus && !isEditingName) {
      setIsEditingName(true);
      setTempName(group.name);
      if (onAutoFocusHandled) {
        onAutoFocusHandled();
      }
    }
  }, [shouldAutoFocus, isEditingName, group.name, onAutoFocusHandled]);

  const handleNameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsEditingName(true);
    setTempName(group.name);
  };
  
  const handleNameDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    // 雙擊也進入編輯模式，但不會冒泡到畫布
    setIsEditingName(true);
    setTempName(group.name);
  };

  const handleNameSave = () => {
    if (tempName.trim() && tempName !== group.name) {
      onUpdateName(tempName.trim());
    }
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSave();
    } else if (e.key === 'Escape') {
      setTempName(group.name);
      setIsEditingName(false);
    }
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
    onSelect(false); // 右鍵不使用多選
  };

  const handleClick = (e: React.MouseEvent) => {
    // Click 事件現在不處理選擇，因為 mouseDown 已經處理了
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && !isEditingName) { // 左鍵點擊且非編輯模式
      e.stopPropagation();
      
      const isMultiSelect = e.ctrlKey || e.metaKey;
      
      // 立即處理選擇
      console.log(`GROUP_SELECT: MouseDown ${group.id}, multiSelect: ${isMultiSelect}`);
      onSelect(isMultiSelect);
      
      // 啟動拖曳（不管是否為多選）
      if (onStartDrag) {
        onStartDrag(e);
      }
    }
  };

  return (
    <>
      <g 
        style={{ cursor: 'move', pointerEvents: 'all' }}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onContextMenu={handleRightClick}
        onDoubleClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
      >
        <rect
          x={bounds.x}
          y={bounds.y}
          width={bounds.width}
          height={bounds.height}
          fill={group.color}
          fillOpacity={
            isDragHovered ? "0.8" : "0.5"
          }
          stroke={
            isDragHovered ? "rgb(34, 197, 94)" : 
            isSelected ? "rgb(59, 130, 246)" : group.color
          }
          strokeWidth={
            isDragHovered ? "4" :
            isSelected ? "3" : isChildGroup ? "3" : "2"
          }
          strokeDasharray={
            isDragHovered ? "8,4" :
            isSelected ? "6,3" : isChildGroup ? "8,4" : "5,3"
          }
          rx="8"
          style={{ pointerEvents: 'all', cursor: 'move' }}
          vectorEffect="non-scaling-stroke"
        />
        
        
        
        {/* 群組名稱 */}
        {isEditingName ? (
          <foreignObject
            x={bounds.x + 8}
            y={bounds.y - 28}
            width="250"
            height="28"
          >
            <input
              ref={nameInputRef}
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={handleNameKeyDown}
              onClick={(e) => e.stopPropagation()}
              className={`px-2 py-0 text-base font-bold rounded ${
                isDarkMode 
                  ? 'bg-dark-bg-secondary border-gray-600 text-dark-text' 
                  : 'bg-white border-gray-400 text-gray-900'
              }`}
              style={{
                fontSize: '20px'
              }}
            />
          </foreignObject>
        ) : (
          <text
            x={bounds.x + 8}
            y={bounds.y - 8}
            fontSize={24}
            fill={isSelected ? "rgb(59, 130, 246)" : "#374151"}
            fillOpacity="1"
            fontWeight="700"
            style={{ cursor: 'text' }}
            onClick={handleNameClick}
            onDoubleClick={handleNameDoubleClick}
          >
            {group.name}
          </text>
        )}
      </g>

      {/* 右鍵選單 */}
      {showContextMenu && createPortal(
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={() => setShowContextMenu(false)}
          />
          <div
            className={`context-menu fixed z-50 rounded-xl shadow-2xl border py-2 min-w-48 backdrop-blur-sm ${
              isDarkMode
                ? 'bg-dark-bg-secondary border-gray-700'
                : 'bg-white border-gray-200'
            }`}
            style={{
              left: Math.min(menuPosition.x + 10, window.innerWidth - 200),
              top: Math.min(menuPosition.y + 10, window.innerHeight - 300),
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onMouseUp={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <div className={`px-3 py-1 text-xs font-medium border-b mb-1 ${
              isDarkMode
                ? 'text-dark-text-secondary border-gray-700'
                : 'text-gray-500 border-gray-100'
            }`}>
              群組操作
            </div>
            
            <button
              className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors ${
                isDarkMode
                  ? 'text-dark-text hover:bg-blue-900/30 hover:text-blue-400'
                  : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'
              }`}
              onClick={() => {
                setIsEditingName(true);
                setShowContextMenu(false);
              }}
            >
              <span className="text-base">✏️</span>
              <span>重新命名</span>
            </button>

            {/* 顏色選擇區域 */}
            <div className="border-t border-gray-100 mt-1 pt-1">
              <div className="px-3 py-2">
                <div className="text-xs text-gray-500 mb-2">更換顏色</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {GROUP_COLORS.map((colorObj, index) => (
                    <button
                      key={index}
                      className="w-8 h-8 rounded border-2 hover:scale-110 transition-all shadow-sm hover:shadow-md"
                      style={{ 
                        backgroundColor: colorObj.color,
                        borderColor: group.color === colorObj.color 
                          ? 'rgb(59, 130, 246)' 
                          : isDarkMode ? '#4B5563' : '#D1D5DB'
                      }}
                      onClick={() => {
                        onUpdateColor(colorObj.color);
                        setShowContextMenu(false);
                      }}
                      title={colorObj.name}
                    >
                      {group.color === colorObj.color && (
                        <div className="flex items-center justify-center w-full h-full">
                          <span className="text-xs font-bold text-gray-700">✓</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <hr className={`my-1 ${
              isDarkMode ? 'border-gray-700' : 'border-gray-100'
            }`} />
            
            {/* 創建父群組選項 */}
            {onCreateParentGroup && (
              <button
                className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors ${
                  isDarkMode
                    ? 'text-dark-text hover:bg-purple-900/30 hover:text-purple-400'
                    : 'text-gray-700 hover:bg-purple-50 hover:text-purple-600'
                }`}
                onClick={() => {
                  onCreateParentGroup();
                  setShowContextMenu(false);
                }}
              >
                <span className="text-base">📁</span>
                <span>創建父群組</span>
              </button>
            )}
            
            <button
              className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors ${
                isDarkMode
                  ? 'text-dark-text hover:bg-indigo-900/30 hover:text-indigo-400'
                  : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-600'
              }`}
              onClick={() => {
                onUngroup();
                setShowContextMenu(false);
              }}
            >
              <span className="text-base">📂</span>
              <span>解散群組</span>
            </button>
            
            <button
              className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors ${
                isDarkMode
                  ? 'text-red-400 hover:bg-red-900/30'
                  : 'text-red-600 hover:bg-red-50'
              }`}
              onClick={() => {
                onDelete();
                setShowContextMenu(false);
              }}
            >
              <span className="text-base">🗑️</span>
              <span>刪除群組</span>
            </button>
          </div>
        </>,
        document.body
      )}
    </>
  );
};

export default GroupComponent;